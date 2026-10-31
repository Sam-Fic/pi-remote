import {describe, expect, test} from 'bun:test'
import {
    normalizeLimit,
    parseBefore,
    sliceHistoryPage,
    parseSessionEntries,
    buildHistoryPage,
    MAX_HISTORY_PAGE,
    DEFAULT_HISTORY_PAGE
} from '../../src/remote/history-paging.js'
import type {Turn} from '../../src/remote/history.js'
import type {BackfillEntry} from '../../src/remote/backfill.js'

/** N synthetic user turns, oldest → newest, each with a distinct text. */
function turns(n: number): Turn[] {
    return Array.from({length: n}, (_, i) => ({role: 'user' as const, text: `t${i}`, ts: 1000 + i}))
}

describe('normalizeLimit()', () => {
    test('defaults when absent or non-finite', () => {
        expect(normalizeLimit(undefined)).toBe(DEFAULT_HISTORY_PAGE)
        expect(normalizeLimit(NaN)).toBe(DEFAULT_HISTORY_PAGE)
    })
    test('clamps into [1, MAX]', () => {
        expect(normalizeLimit(0)).toBe(1)
        expect(normalizeLimit(-5)).toBe(1)
        expect(normalizeLimit(10_000)).toBe(MAX_HISTORY_PAGE)
        expect(normalizeLimit(7)).toBe(7)
    })
    test('floors a fractional limit', () => {
        expect(normalizeLimit(3.9)).toBe(3)
    })
})

describe('parseBefore()', () => {
    test('reads a decimal cursor', () => {
        expect(parseBefore('42')).toBe(42)
        expect(parseBefore('0')).toBe(0)
    })
    test('null for absent, blank, negative or non-numeric', () => {
        expect(parseBefore(undefined)).toBeNull()
        expect(parseBefore('')).toBeNull()
        expect(parseBefore('-1')).toBeNull()
        expect(parseBefore('abc')).toBeNull()
    })
})

describe('sliceHistoryPage()', () => {
    const all = turns(10) // t0..t9

    test('first page (before=null) takes the newest `limit` turns', () => {
        const page = sliceHistoryPage(all, null, 4)
        expect(page.turns.map(t => t.text)).toEqual(['t6', 't7', 't8', 't9'])
        expect(page.before).toBe(6)
        expect(page.hasMore).toBe(true)
    })

    test('next page walks backwards from the cursor', () => {
        const page = sliceHistoryPage(all, 6, 4)
        expect(page.turns.map(t => t.text)).toEqual(['t2', 't3', 't4', 't5'])
        expect(page.before).toBe(2)
        expect(page.hasMore).toBe(true)
    })

    test('last page clamps to the start and reports exhausted', () => {
        const page = sliceHistoryPage(all, 2, 4)
        expect(page.turns.map(t => t.text)).toEqual(['t0', 't1'])
        expect(page.before).toBeNull()
        expect(page.hasMore).toBe(false)
    })

    test('a cursor past the end is clamped', () => {
        const page = sliceHistoryPage(all, 999, 3)
        expect(page.turns.map(t => t.text)).toEqual(['t7', 't8', 't9'])
    })

    test('empty history yields an empty exhausted page', () => {
        const page = sliceHistoryPage([], null, 4)
        expect(page.turns).toEqual([])
        expect(page.before).toBeNull()
        expect(page.hasMore).toBe(false)
    })
})

describe('parseSessionEntries()', () => {
    test('keeps message/compaction entries and drops everything else', () => {
        const jsonl = [
            JSON.stringify({type: 'header', version: 1}),
            JSON.stringify({type: 'message', timestamp: '2026-01-01T00:00:00Z', message: {role: 'user', content: 'hi'}}),
            '',
            'not json at all',
            JSON.stringify({type: 'compaction', timestamp: '2026-01-01T00:01:00Z'}),
            JSON.stringify({type: 'message', timestamp: 12345}), // timestamp not a string → dropped
            JSON.stringify({type: 'unknown-future', timestamp: '2026-01-01T00:02:00Z'})
        ].join('\n')
        const entries = parseSessionEntries(jsonl)
        expect(entries).toHaveLength(2)
        expect(entries[0]!.type).toBe('message')
        expect(entries[1]!.type).toBe('compaction')
    })

    test('a string-but-unparseable timestamp is KEPT (date parsing is reconstructTurns’ job)', () => {
        const jsonl = JSON.stringify({type: 'message', timestamp: 'MISSING', message: {role: 'user', content: 'x'}})
        expect(parseSessionEntries(jsonl)).toHaveLength(1)
    })

    test('an empty or garbage file yields []', () => {
        expect(parseSessionEntries('')).toEqual([])
        expect(parseSessionEntries('\n\n')).toEqual([])
    })
})

describe('buildHistoryPage()', () => {
    function msg(timestamp: string, content: string): BackfillEntry {
        return {type: 'message', timestamp, message: {role: 'user', content}} as BackfillEntry
    }
    // 5 user turns → reconstructTurns gives 5 turns.
    const entries = Array.from({length: 5}, (_, i) =>
        msg(`2026-01-01T00:00:0${i}Z`, `u${i}`)
    )

    test('first page from raw entries, newest last', () => {
        const frame = buildHistoryPage(entries, undefined, 2)
        expect(frame.type).toBe('history_page')
        expect(frame.turns.map(t => t.text)).toEqual(['u3', 'u4'])
        expect(frame.hasMore).toBe(true)
        expect(frame.before).toBe('3')
    })

    test('paging to the beginning exhausts', () => {
        const frame = buildHistoryPage(entries, '2', 5)
        expect(frame.turns.map(t => t.text)).toEqual(['u0', 'u1'])
        expect(frame.hasMore).toBe(false)
        expect(frame.before).toBeUndefined()
    })
})
