import {describe, it, expect} from 'bun:test'
import {LOCALES, DEFAULT_LOCALE, isLocale, localeTables, i18nModule} from '../../src/remote/ui-i18n.js'
import {mduiHtml} from '../../src/remote/ui-mdui.js'

/* The three tables are what keep a locale honest. A missing key is not a
   crash — t() falls back to the key, which prints `some.key` on screen — so
   nothing in the app would ever tell you a translation is missing. These are
   the tests that do. */

describe('locale tables', () => {
    const tables = localeTables()

    it('declares every supported locale', () => {
        expect(Object.keys(tables).sort()).toEqual(['en', 'zh-CN', 'zh-TW'])
        for (const l of LOCALES) expect(tables[l.id]).toBeTruthy()
    })

    it('gives every locale exactly the same key set', () => {
        const base = Object.keys(tables[DEFAULT_LOCALE]).sort()
        for (const l of LOCALES) {
            expect(Object.keys(tables[l.id]).sort()).toEqual(base)
        }
    })

    it('has no empty string in any locale', () => {
        for (const l of LOCALES) {
            for (const [k, v] of Object.entries(tables[l.id])) {
                // A blank is the one failure mode the runtime cannot surface:
                // t() returns '' happily and the control just looks unlabelled.
                expect(v.length, `${l.id}.${k}`).toBeGreaterThan(0)
            }
        }
    })

    it('keeps the two Chinese locales genuinely different where the terms differ', () => {
        /* The whole reason there are two authored tables instead of a
           runtime 简→繁 converter: these are different WORDS, not different
           glyphs. If someone "helpfully" collapses them, this fails. */
        expect(tables['zh-CN'].settings).not.toBe(tables['zh-TW'].settings)
        expect(tables['zh-CN'].file).not.toBe(tables['zh-TW'].file)
        expect(tables['zh-CN'].copyCode).not.toBe(tables['zh-TW'].copyCode)
    })

    it('agrees with the labels the menu shows', () => {
        for (const l of LOCALES) expect(l.label.length).toBeGreaterThan(0)
    })

    it('validates locale ids', () => {
        expect(isLocale('zh-CN')).toBe(true)
        expect(isLocale('zh-TW')).toBe(true)
        expect(isLocale('en')).toBe(true)
        expect(isLocale('zh')).toBe(false)
        expect(isLocale('zh-HK')).toBe(false)
        expect(isLocale(null)).toBe(false)
    })
})

describe('i18nModule()', () => {
    const src = i18nModule()

    it('emits parseable JS', () => {
        // Same reason as ui.test.ts: a syntax error here blanks the whole page.
        expect(() => new Function(src)).not.toThrow()
    })

    it('survives strings containing quotes and parentheses', () => {
        // JSON.stringify is the whole point: several entries carry 「」, （）,
        // ellipses and a {0} placeholder. A hand-written literal would break.
        expect(() => new Function(src)).not.toThrow()
        expect(src).toContain('LOCALE_TABLES')
    })

    it('interpolates {0} and leaves an unknown key visible', () => {
        const f = new Function(src + `
            // t() is a function declaration inside the evaluated source, so it
            // is reachable here the same way it is in the page.
            return {sent: t('confirmDeleteSession', 'my chat'), missing: t('nope.nope')};
        `)
        const r = f() as any
        expect(r.sent).toContain('my chat')
        expect(r.sent).not.toContain('{0}')
        // A gap must be loud, never a silent blank.
        expect(r.missing).toBe('nope.nope')
    })

    it('falls back to the default locale for an unknown locale id', () => {
        const f = new Function(src + `
            CURRENT_LOCALE = 'xx-YY';
            return t('send');
        `)
        expect(f()).toBe(localeTables()[DEFAULT_LOCALE].send)
    })
})

describe('mduiHtml()', () => {
    const out = mduiHtml('ws://localhost:7600/ws')

    it('embeds the locale table', () => {
        expect(out).toContain('LOCALE_TABLES')
    })

    it('marks static strings for the locale sweep', () => {
        expect(out).toContain('data-i18n=')
        expect(out).toContain('data-i18n-aria=')
    })

    it('still emits the client script without a syntax error', () => {
        const m = out.match(/<script type="module">([\s\S]*?)<\/script>/)
        expect(m).not.toBeNull()
        expect(() => new Function(m![1].replace(/import[\s\S]*?from '[^']*';/, ''))).not.toThrow()
    })
})
