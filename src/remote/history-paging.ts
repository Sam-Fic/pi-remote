// History paging: serve turns OLDER than the 20-turn live window on demand.
//
// The live HistoryBuffer deliberately keeps only the newest 20 turns, so a
// client that scrolls to the top of a long conversation hit a hard floor. This
// module rebuilds the FULL turn list from pi's persisted session entries (the
// same reconstruction backfill.ts does at restart) and slices it from the end,
// so a client can walk backwards page by page:
//
//   fetch_history {path?, before?, limit?}  →  history_page {turns, before, hasMore}
//
// The cursor `before` is the exclusive turn index in that full list, as a
// decimal string — the server answers with turns[end-limit … end) where `end`
// is `before` (or the list length on the first page) and reports the new cursor
// plus whether anything remains. Indexes are stable enough for this because a
// session file only ever grows at the end; a page fetched mid-run may shift by
// a turn or two against a later one, which costs a duplicate render, never a
// lost message.
//
// Everything here is pure (entries/text in, frames out) so the server wiring
// in register.ts stays thin and the tests need no pi.

import type {Turn} from './history.js'
import {reconstructTurns} from './backfill.js'
import type {BackfillEntry} from './backfill.js'
import type {HistoryPageMessage} from './protocol.js'

export const MAX_HISTORY_PAGE = 100
export const DEFAULT_HISTORY_PAGE = 40

/** Clamp a client-supplied page size into [1, MAX_HISTORY_PAGE]. */
export function normalizeLimit(limit: number | undefined): number {
    if (typeof limit !== 'number' || !Number.isFinite(limit)) return DEFAULT_HISTORY_PAGE
    return Math.max(1, Math.min(MAX_HISTORY_PAGE, Math.floor(limit)))
}

/** Parse the `before` cursor: a decimal turn index, or null for "from the
 *  newest". Anything unparseable or negative falls back to null — a bogus
 *  cursor must degrade to the first page, never throw. */
export function parseBefore(before: string | undefined): number | null {
    if (typeof before !== 'string' || !/^\d+$/.test(before)) return null
    const n = Number.parseInt(before, 10)
    return Number.isFinite(n) && n >= 0 ? n : null
}

/** Slice one page off the end of the full turn list. `turns` is oldest→newest
 *  (client prepends); `before` is the cursor for the NEXT (older) page, null
 *  when exhausted. */
export function sliceHistoryPage(
    allTurns: readonly Turn[],
    before: number | null,
    limit: number
): {turns: Turn[]; before: number | null; hasMore: boolean} {
    const end = before === null ? allTurns.length : Math.min(before, allTurns.length)
    const start = Math.max(0, end - limit)
    return {
        turns: allTurns.slice(start, end),
        before: start > 0 ? start : null,
        hasMore: start > 0
    }
}

/** Parse a persisted pi session file (JSONL) into backfill entries. Defensive
 *  by design: the first line may be a header, a line may be truncated by a
 *  crash mid-write, and a future pi version may add entry types — anything
 *  that is not a `{type: 'message'|'compaction', timestamp}` object is skipped,
 *  and an unreadable file yields [] (the client sees an empty page, the agent
 *  is untouched). */
export function parseSessionEntries(text: string): BackfillEntry[] {
    const out: BackfillEntry[] = []
    for (const line of text.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        let parsed: unknown
        try {
            parsed = JSON.parse(trimmed)
        } catch {
            continue
        }
        if (typeof parsed !== 'object' || parsed === null) continue
        const e = parsed as Record<string, unknown>
        if (e.type !== 'message' && e.type !== 'compaction') continue
        if (typeof e.timestamp !== 'string') continue
        out.push(parsed as BackfillEntry)
    }
    return out
}

/** Build the history_page frame from raw session entries in one step. */
export function buildHistoryPage(
    entries: readonly BackfillEntry[],
    before: string | undefined,
    limit: number | undefined
): HistoryPageMessage {
    const all = reconstructTurns(entries)
    const page = sliceHistoryPage(all, parseBefore(before), normalizeLimit(limit))
    return {
        type: 'history_page',
        turns: page.turns,
        before: page.before === null ? undefined : String(page.before),
        hasMore: page.hasMore
    }
}
