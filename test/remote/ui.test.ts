import {describe, it, expect} from 'bun:test'
import {mduiHtml} from '../../src/remote/ui-mdui.js'

/** The MD UI is one inline `<script type="module">`; the only module syntax in
 *  it is the CDN imports at the top, so stripping those leaves a body that
 *  `new Function` can parse. A syntax error anywhere kills the whole script,
 *  leaving the client stuck at "connecting…". */
function clientScript(out: string): string {
    const m = out.match(/<script type="module">([\s\S]*?)<\/script>/)
    expect(m).not.toBeNull()
    return m![1].replace(/import[\s\S]*?from '[^']*';/, '')
}

describe('mduiHtml()', () => {
    it('returns a string', () => {
        expect(typeof mduiHtml('ws://localhost:7600/ws')).toBe('string')
    })

    it('embeds the wsUrl as a fallback in the output', () => {
        const out = mduiHtml('ws://192.168.1.5:7601/ws')
        expect(out).toContain('ws://192.168.1.5:7601/ws')
    })

    it('derives the WebSocket URL from the page origin so LAN and Tailscale URLs both connect', () => {
        const out = mduiHtml('ws://192.168.1.5:7601/ws')
        // WS must follow whatever host served the page, not a baked-in IP.
        expect(out).toContain('location.host')
        expect(out).toContain("'wss://'")
        expect(out).toContain("'ws://'")
    })

    it('contains required DOM element ids', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        for (const id of [
            'chat-log',
            'input',
            'send-btn',
            'reconnect-overlay',
            'chat-title',
            'model-menu',
            'prompt-card',
            'status-panel'
        ]) {
            expect(out).toContain(`id="${id}"`)
        }
    })

    it('emits a syntactically valid module script (no unescaped newlines etc.)', () => {
        expect(() => new Function(clientScript(mduiHtml('ws://1.2.3.4:8800/ws')))).not.toThrow()
    })

    it('handles every protocol frame the client renders', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        for (const type of [
            'snapshot',
            'models',
            'agent_start',
            'thinking_delta',
            'text_delta',
            'tool_start',
            'tool_end',
            'user_message',
            'system_note',
            'agent_error',
            'agent_end',
            'context',
            'prompt',
            'prompt_resolved',
            'widget',
            'notify',
            'reset'
        ]) {
            expect(out).toContain(`case '${type}'`)
        }
        expect(out).toContain('prompt_answer')
    })

    it("does not optimistically render the sender's own user bubble", () => {
        // The server records remote-typed messages via addUserTurn, which
        // broadcasts a user_message back to ALL clients — including the sender.
        // If sendMessage ALSO renders the bubble locally, the sender sees it
        // twice. User bubbles must come solely from the user_message delta.
        const out = mduiHtml('ws://localhost:7600/ws')
        const start = out.indexOf('function sendMessage()')
        const end = out.indexOf('function answer(value)', start)
        expect(start).toBeGreaterThan(-1)
        const sendBody = out.slice(start, end)
        expect(sendBody).not.toContain('addBubble(')
    })

    it('guards enabling notifications on permission and secure context', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        expect(out).toContain('Notification.permission')
        expect(out).toContain('window.isSecureContext')
    })

    it('registers a service worker and a push subscription (works on iOS)', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        expect(out).toContain("serviceWorker.register('/sw.js')")
        expect(out).toContain('pushManager.subscribe')
        expect(out).toContain('/push-key')
        expect(out).toContain('/subscribe')
        // The broken in-page constructor must NOT be used to deliver notifications.
        expect(out).not.toContain('new Notification(')
    })

    it('shows a live countdown on the reconnect overlay', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        expect(out).toContain('id="reconnect-msg"')
        expect(out).toContain('reconnectMsg.textContent')
    })

    it('reconnects immediately when the tab is refocused instead of waiting out the backoff', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // A backgrounded phone throttles the retry timer and drops the radio, so
        // returning to the tab, or regaining network, must retry at once.
        expect(out).toContain("addEventListener('visibilitychange'")
        expect(out).toContain("addEventListener('online'")
        expect(out).toContain("addEventListener('focus'")
        expect(out).toContain('function connectNow')
        expect(out).toContain('reconnectDelay = 1000')
        // The scheduled reconnect must be cancellable — held in a tracked timer —
        // so an early retry does not leave a second connect firing later.
        expect(out).toContain('reconnectTimer = setTimeout')
    })

    it('clears the remote view on a reset message (new session)', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        expect(out).toContain("case 'reset'")
    })

    it('reconciles a full snapshot on (re)connect by replacing the whole view', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // The snapshot handler is the heart of the sync rebuild: it must wipe the
        // transcript and rebuild from server truth so reconnects never duplicate or
        // strand stale content — and guard each turn so one bad turn can't blank all.
        const m = out.match(/case 'snapshot':[\s\S]*?break;/)
        expect(m).not.toBeNull()
        const handler = m![0]
        expect(handler).toContain("chatLog.innerHTML = ''")
        expect(handler).toContain('renderTurn')
        expect(handler).toContain('renderLiveTurn')
        expect(handler).toContain('renderWidgets()')
        expect(handler).toContain('try { renderTurn(t)')
    })

    it('uses a single task-widget slot, not a per-key map', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // ONE slot, so a cleared widget always disappears. A per-key map can strand
        // an orphan: two widgets under different keys, one cleared, one left behind.
        expect(out).toContain('taskWidgetLines')
        expect(out).not.toContain('delete widgets[')
        // The widget delta carries no key — one slot, so there is nothing to key on.
        const m = out.match(/case 'widget':[\s\S]*?break;/)
        expect(m).not.toBeNull()
        expect(m![0]).not.toContain('msg.key')
    })

    it('no longer ships a separate history replay (snapshot subsumes it)', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        expect(out).not.toContain("case 'history'")
    })

    it('renders an assistant turn as ordered parts (text + thinking + tools interleaved)', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // A turn must render its `parts` in sequence so the layout matches the
        // terminal — not one merged text blob with tools dumped at the end.
        const m = out.match(/function renderTurn\(t\) \{[\s\S]*?\n {4}\}/)
        expect(m).not.toBeNull()
        const body = m![0]
        expect(body).toContain('t.parts')
        expect(body).toContain("p.kind === 'text'")
        expect(body).toContain('renderToolPart')
    })

    it('renders persistent system notes (e.g. context compaction) inline', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // A system note must render both live (delta) and from the snapshot (a
        // role:'system' turn), as a muted inline divider that survives reconnect.
        expect(out).toContain("case 'system_note'")
        expect(out).toContain('function addSystemLine')
        expect(out).toContain("t.role === 'system'")
        expect(out).toContain('.sysnote')
    })

    it('renders tool results null-safely so a missing result cannot blank the view', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // A null/undefined result must not reach `JSON.stringify(...).slice()`, whose
        // `undefined.slice` throws and aborts the snapshot rebuild mid-clear.
        expect(out).toContain('function toolResultText')
        expect(out).toContain('result == null')
        expect(out).not.toContain('JSON.stringify(tool.result, null, 2)')
        expect(out).not.toContain('JSON.stringify(msg.result, null, 2)')
    })

    it('renders content-block tool results as text, not escaped JSON', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // Tools (Read, Bash, MCP) return { content: [{type:'text', text:'...'}] };
        // dumping that through JSON.stringify shows the user escaped \n garbage.
        expect(out).toContain('function contentBlocksText')
        expect(out).toContain("b.type === 'text'")
        expect(out).toContain('Array.isArray(result.content)')
    })

    it('summarizes tool calls by kind instead of dumping raw JSON', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // toolSummary (ui-tools.ts) turns {command} into "$ …", a path into "read …",
        // etc., and addToolCall passes RAW args (not a pre-stringified blob).
        expect(out).toContain('function toolSummary')
        expect(out).toContain('function toolDiffHtml')
        expect(out).toContain('toolSummary(toolName, args)')
    })

    it('renders assistant text as markdown but leaves user bubbles plain', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        expect(out).toContain('function renderMarkdown')
        // addBubble markdown-renders only the assistant role.
        const m = out.match(/function addBubble\(role, text, attachments\) \{[\s\S]*?\n {4}\}/)
        expect(m).not.toBeNull()
        expect(m![0]).toContain("role === 'assistant'")
        expect(m![0]).toContain('textContent = text')
    })

    it('builds the composer from standard m3e components, not hand-rolled divs', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // Outer capsule = the library's vibrant rounded toolbar; inner = the
        // pill that carries the field, the loader and the trailing button.
        expect(out).toMatch(/<m3e-toolbar id="composer-bar" variant="vibrant" shape="rounded">/)
        expect(out).toContain("import('https://esm.sh/@m3e/web@2.7.9/toolbar')")
        const bar = out.match(/<m3e-toolbar id="composer-bar"[\s\S]*?<\/m3e-toolbar>/)![0]
        for (const id of ['add-btn', 'gallery-btn', 'model-btn']) {
            // The reference's three: attach menu, gallery, model — all the
            // library's 40px (small) buttons, the flat standard variant.
            expect(bar).toMatch(new RegExp(`<m3e-icon-button id="${id}" size="small" variant="standard"`))
        }
        // Trailing button stacked INSIDE the pill, with the loader beside it.
        const pill = bar.match(/<div id="composer-pill">[\s\S]*?<\/m3e-toolbar>/)![0]
        expect(pill).toContain('<m3e-icon-button id="send-btn" size="small" variant="filled"')
        expect(pill).toContain('<m3e-loading-indicator id="composer-loading" variant="contained"')
        expect(pill).toContain('<m3e-form-field variant="filled" hide-subscript="always">')
        expect(pill).toContain('<m3e-textarea-autosize for="input" min-rows="1" max-rows="6">')
    })

    it('derives every composer radius from the fixed outer one', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        const bar = out.match(/#composer-bar \{[\s\S]*?\n\}/)![0]
        expect(bar).toContain('--c-outer-r: 36px')
        expect(bar).toContain('--c-inner-r: calc(var(--c-outer-r) - var(--c-gap))')
        expect(bar).toContain('--c-inset: calc(var(--c-inner-r) - var(--c-btn) / 2)')
        expect(bar).toContain('--c-bar-min: calc(var(--c-field-min) + 2 * var(--c-gap))')
        // Pitfall 1: the library's rounded shape is corner.full, which turns a
        // six-line composer into a giant capsule. The radius must be the token.
        expect(bar).toContain('--m3e-toolbar-rounded-shape: var(--c-outer-r)')
        expect(bar).toContain('--m3e-toolbar-rounded-padding: var(--c-gap)')
        // Nothing downstream may hardcode the derived numbers.
        for (const derived of ['28px', '72px']) expect(bar).not.toContain(derived)
    })

    it('sits the action group and the pill on the field\u2019s bottom baseline', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // Pitfall 5: the toolbar row is align-items:center, so both children
        // must be pulled to the bottom edge explicitly.
        for (const id of ['composer-actions', 'composer-pill']) {
            const rule = out.match(new RegExp(`#${id} \\{[^}]*\\}`))![0]
            expect(rule).toContain('align-self: flex-end')
        }
        // 8px of its own bottom padding puts a button centre 16px from the
        // outer edge — the same 16px it has top and bottom, i.e. concentric.
        const actions = out.match(/#composer-actions \{[^}]*\}/)![0]
        expect(actions).toContain('padding-bottom: var(--c-gap)')
        expect(actions).toContain('margin-inline-start: var(--c-gap)')
        // The trailing disc is corner-stacked on the pill, inset by the derived
        // 8px (28 \u2212 40/2), not by a literal.
        const send = out.match(/m3e-icon-button#send-btn \{[^}]*\}/)![0]
        expect(send).toContain('position: absolute')
        expect(send).toContain('inset-inline-end: var(--c-inset)')
        expect(send).toContain('bottom: var(--c-inset)')
    })

    it('paints one opaque capsule surface instead of a field over a gap', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // Pitfall 4: with the pill transparent, the vibrant toolbar shows
        // through wherever the loader or the button overlaps the field. The
        // pill must stay OPAQUE (here matching the page background, not a
        // raised grey surface-container) so the toolbar behind never bleeds
        // through the middle.
        const pill = out.match(/#composer-pill \{[^}]*\}/)![0]
        expect(pill).toContain('border-radius: var(--c-inner-r)')
        expect(pill).toContain('background: var(--md-sys-color-surface)')
        expect(pill).toContain('padding-inline-end: var(--c-reserve)')
        // ...and the field's own container is silenced so it does not paint a
        // second layer at a second radius.
        const field = out.match(/#composer-pill > m3e-form-field \{[^}]*\}/)![0]
        expect(field).toContain('--m3e-form-field-container-color: transparent')
        // The filled variant's underline is .base::before's bottom border: 1px
        // drawn from --m3e-form-field-outline-color at rest, 3px from
        // --m3e-form-field-focused-outline-color once the field has focus. A
        // floating capsule must carry neither, or the line appears as soon as
        // the user starts typing.
        expect(field).toContain('--m3e-form-field-outline-color: transparent')
        expect(field).toContain('--m3e-form-field-focused-outline-color: transparent')
        // …and where the library assigns nothing (blocked/disabled field) the
        // border falls back to currentColor, so the internal property is pinned too.
        expect(field).toContain('--_form-field-outline-color: transparent')
        // Neither grey overlay may paint: the 8% onSurface hover wash and the 4%
        // disabled container block both come from a color-mix on these tokens.
        expect(field).toContain('--m3e-form-field-hover-container-color: transparent')
        expect(field).toContain('--m3e-form-field-disabled-container-color: transparent')
    })

    it('keeps every composer button a plain circle, pressed or not', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        const btn = out.match(/#composer-bar m3e-icon-button \{[^}]*\}/)![0]
        expect(btn).toContain('--m3e-icon-button-shape-round: 999px')
        expect(btn).toContain('--m3e-icon-button-shape-square: 999px')
        expect(btn).toContain('--m3e-icon-button-shape-pressed-morph: 999px')
        // The pressed rule reads the size-specific name FIRST, so the generic
        // override alone leaves the Expressive morph in charge of the plate.
        for (const size of ['extra-small', 'small', 'medium', 'large']) {
            expect(btn).toContain(`--m3e-icon-button-${size}-shape-pressed-morph: 999px`)
        }
        // …and no author rule may squeeze the disc on top of that.
        expect(out).not.toContain('#send-btn:active')
    })

    it('floats the capsule instead of sitting it in a painted tray', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // The footer used to paint surface-container as a band behind the old
        // text field; the composer carries its own opaque surface now, so the
        // band would read as a tray. Drag-over still paints, explicitly.
        const bar = out.match(/#input-bar \{[^}]*\}/)![0]
        expect(bar).toContain('background: none')
        expect(out).toMatch(/#input-bar\.dragging \{[^}]*background: var\(--md-sys-color-primary-container\)/)
    })

    it('runs the conversation on behind the composer instead of cutting it', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // The wrapper spans every row of #main-col, so bubbles reach the
        // viewport's bottom edge instead of stopping dead at the band's top.
        const wrap = out.match(/#chat-wrap \{[^}]*\}/)![0]
        expect(wrap).toContain('grid-column: 1')
        expect(wrap).toContain('grid-row: 1 / -1')
        // …and each band row is placed back over it. z-index is what decides
        // this, since the wrapper is itself positioned. Both axes must be
        // explicit — an automatic column reads the wrapper's row span as an
        // occupied cell and creates an implicit column, collapsing the chat.
        const panel = out.match(/m3e-card#status-panel \{[^}]*\}/)![0]
        const held = out.match(/#held-bar \{[^}]*\}/)![0]
        const bar = out.match(/#input-bar \{[^}]*\}/)![0]
        const rows: Array<[string, number]> = [[panel, 2], [held, 3], [bar, 4]]
        for (const [rule, row] of rows) {
            expect(rule).toContain('grid-column: 1')
            expect(rule).toContain(`grid-row: ${row}`)
            expect(rule).toContain('position: relative')
            expect(rule).toContain('z-index: 40')
        }
        // Placement lives in CSS now, not on a stray inline style.
        // By id, not the whole tag: it carries the drag-hint attributes now.
        expect(out).toMatch(/<footer id="input-bar"[^>]*>/)
        // The last bubble still rests clear of the band, by its measured height.
        const log = out.match(/#chat-log \{[^}]*\}/)![0]
        expect(log).toContain('padding-bottom: calc(var(--_composer-h) + var(--_fade-h) + 0.75rem)')
    })

    it('dissolves the chat into the band with alpha, not a painted cover', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // A mask ramps the content's own alpha to zero, so what shows through is
        // the surface the bubbles already sit on: no second layer, no theme
        // dependency, and nothing opaque laid over the conversation.
        const log = out.match(/#chat-log \{[^}]*\}/)![0]
        expect(log).toContain('-webkit-mask-image: var(--_chat-fade)')
        expect(log).toContain('mask-image: var(--_chat-fade)')
        const fade = out.match(/--_chat-fade: linear-gradient\([\s\S]*?\);/)![0]
        expect(fade).toContain('to bottom')
        // The ramp leads in above the band: the capsule is opaque and covers
        // most of it, so a fade that started at the band's top edge would only
        // ever thin the conversation behind paint.
        expect(fade).toContain('#000 calc(100% - var(--_composer-h) - var(--_fade-h))')
        expect(fade).toContain('transparent 100%')
        expect(out).toContain('--_fade-h: 1.5rem;')
        // The band may not start painting a background to do the same job.
        expect(out.match(/#input-bar \{[^}]*\}/)![0]).toContain('background: none')
    })

    it('measures the band so the thumb and the fab stop above it', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // A token with a floor, republished whenever any of the three rows
        // changes size — the field grows, the tray and the panel come and go.
        expect(out).toContain('--_composer-h: 100px;')
        expect(out).toContain("setProperty('--_composer-h', h + 'px')")
        expect(out).toMatch(/bandEls\.forEach\(\(el\) => bandObserver\.observe\(el\)\)/)
        // The chat's thumb travels a different distance at each end now, so the
        // symmetric inset is gone from both the paint and the drag math.
        expect(out).toContain('const track = () => scroller.clientHeight - inset - bottomGap();')
        expect(out).not.toContain('inset * 2')
        const attach = out.match(/const chatScroll = attachScrollbar\([\s\S]*?\n {4}\}\)/)![0]
        expect(attach).toContain('bottomInset: () => bandHeight() + 4')
        // Repainted with the reserve, not just once at attach time.
        expect(out).toMatch(/function publishBandHeight\(\) \{[\s\S]*?chatScroll\.paint\(\);/)
        expect(out).toMatch(/m3e-fab#scroll-bottom \{[\s\S]*?bottom: calc\(var\(--_composer-h\) \+ 1rem\)/)
    })

    it('lets the composer shrink instead of running off a phone screen', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // The textarea has an intrinsic 238px, and an `auto` grid track takes its
        // base size from the widest item's min-content — so the row demanded 482px
        // on a 390px viewport and the send button fell off the right edge.
        const col = out.match(/#main-col \{[\s\S]*?\n\}/)![0]
        expect(col).toContain('grid-template-columns: minmax(0, 1fr)')
        expect(col).toContain('min-width: 0')
        // The pill is the row's only growable child, and it must be allowed down
        // to zero so the field gives way before the capsules.
        const pill = out.match(/#composer-pill \{[^}]*\}/)![0]
        expect(pill).toContain('flex: 1 1 auto')
        expect(pill).toContain('min-width: 0')
        // The action group must not be the thing that holds the row open.
        const actions = out.match(/#composer-actions \{[^}]*\}/)![0]
        expect(actions).toContain('flex: 0 0 auto')
    })

    it('gives the field the action group\u2019s width only on a narrow, typing composer', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        const sync = out.match(/function syncComposerCompact\(\) \{[\s\S]*?\n {4}\}/)![0]
        expect(sync).toContain('!isWide()')
        expect(sync).toContain('document.activeElement === inputEl')
        expect(sync).toContain('!!inputEl.value')
        // The collapse is width-driven with no animated clip (pitfall 3).
        const rule = out.match(/#composer-bar\.compact #composer-actions \{[^}]*\}/)![0]
        expect(rule).toContain('max-width: 0')
        expect(rule).not.toContain('width: auto')
        // A zero-width child still costs the row one 4px gap, so the pill's left
        // cap would land 12px from the outer capsule instead of the concentric 8.
        expect(rule).toContain('margin-inline-end: calc(-1 * var(--m3e-toolbar-spacing))')
        // …and that correction must not ride the spatial spring, which overshoots
        // it by ~1.6px and pushes the cap through the capsule's rim mid-collapse.
        const group = out.match(/#composer-actions \{[^}]*\}/)![0]
        expect(group).toContain('margin-inline-end 0.42s linear')
        expect(group).not.toMatch(/margin-inline-end[^,]*spring/)
    })

    it('turns the plus glyph into a close affordance while its menu is open', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        expect(out).toMatch(/m3e-icon-button#add-btn\.open m3e-icon \{[^}]*transform: rotate\(45deg\)/)
        expect(out).toContain("addMenu.addEventListener('toggle'")
        expect(out).toContain("addBtn.classList.toggle('open', addMenu.isOpen)")
        // The three rows: image picker, file picker, clear the tray.
        const menu = out.match(/<m3e-menu id="add-menu"[\s\S]*?<\/m3e-menu>/)![0]
        for (const kind of ['image', 'file', 'clear']) {
            expect(menu).toContain(`data-add="${kind}"`)
        }
        // The image-only filter must not outlive the picker it was set for.
        expect(out).toContain("attachInput.accept = imagesOnly ? 'image/*' : ''")
        expect(out).toContain("attachInput.addEventListener('cancel'")
    })

    it('renders the slash typeahead as a plain segmented list that scrolls itself', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        const render = out.match(/function renderSuggestions\(\) \{[\s\S]*?\n {4}\}/)![0]
        // The same component the notif and settings lists use: rows are plain
        // m3e-list-item, so their metrics, per-position corners and plate are the
        // library's own, and the description rides the supporting-text slot.
        expect(render).toContain('<m3e-list variant="segmented">')
        expect(render).toContain('<m3e-list-item')
        expect(render).toContain('<span slot="supporting-text">')
        expect(render).toContain("cmdSuggestions.innerHTML = html + '</m3e-list>'")
        expect(out).not.toMatch(/#cmd-suggestions m3e-list-item \{[^}]*--m3e-list-item-container-shape/)
        // One delegated handler, bound outside the render: the panel element
        // survives every re-render, so binding inside would stack a listener per
        // keystroke. mousedown, so a row press never moves focus out of the field.
        expect(out).toContain("cmdSuggestions.addEventListener('mousedown'")
        expect(out).toContain("e.target.closest('m3e-list-item')")
        expect(render).not.toContain("addEventListener('mousedown'")
        // Scrolling is the list's own: the card only clips at its corner radius,
        // so no hand-drawn thumb is overlaid on it any more.
        const card = out.match(/#cmd-suggestions \{[^}]*\}/)![0]
        expect(card).toContain('overflow: hidden')
        expect(card).not.toContain('overflow-y')
        expect(card).not.toContain('max-height')
        expect(out).not.toMatch(/attachScrollbar\(cmdSuggestions/)
        // …and the cap is the generous one, on the scroller itself.
        const list = out.match(/#cmd-suggestions m3e-list \{[^}]*\}/)![0]
        expect(list).toContain('max-height: min(26rem, 55vh)')
        expect(list).toContain('scrollbar-width: thin')
    })

    it('keeps an IME commit and a caret move out of the composer\u2019s key handling', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        expect(out).toContain('function imeComposing(e) { return e.isComposing || e.keyCode === 229; }')
        // Both Enter paths (pick a slash command, send) are guarded.
        expect(out).toContain("if (e.key === 'Enter' && !e.shiftKey && !imeComposing(e)) { e.preventDefault(); sendMessage(); }")
        const keydown = out.match(/inputEl\.addEventListener\('keydown', \(e\) => \{[\s\S]*?\n {4}\}\);/)![0]
        expect((keydown.match(/!imeComposing\(e\)/g) || []).length).toBe(2)
        // The toolbar's roving tabindex would steal ArrowLeft/Up/Down from the
        // caret; the pill swallows those before the slot sees them.
        expect(out).toContain("composerPill.addEventListener('keydown'")
        expect(out).toContain('if (e.target === inputEl) e.stopPropagation();')
    })

    it('pins the textarea to at least one full line so the placeholder is not clipped', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        const m = out.match(/#input\s*\{[^}]*\}/)
        expect(m).not.toBeNull()
        const rule = m![0]
        // m3e-textarea-autosize measures a line with a detached clone (whose
        // padding it forces to "2px 0") and subtracts a hardcoded 4px, yielding
        // 19px here. Without a floor the EMPTY field is set to 19px against a
        // 24px line-height: the descender clips and the text sits low.
        expect(rule).toContain('min-height: 1lh !important')
        // !important is required: the component writes min-height INLINE.
        // height must stay free, or the field could never grow.
        // `height` must stay free so the field can still grow — only the floor
        // is ours. (The comment above the declaration mentions "height", so
        // strip comments before checking.)
        expect(rule.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/(^|[^-\w])height\s*:/)
    })

    it('holds an empty field at one line even when the hint would wrap', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // The autosize clone measures the placeholder while the field is empty,
        // so a hint that wraps at a phone's 114px stood the bar 120px high. The
        // reference pins it with maxLines = 1 on its placeholder text.
        expect(out).toMatch(/#input:placeholder-shown \{\s*\n {4}height: 1lh !important;/)
        // It must be scoped to the empty state: a value has to grow freely.
        const pin = out.match(/#input:placeholder-shown \{[^}]*\}/)![0]
        expect(pin).toContain(':placeholder-shown')
        // The clamp only covers the empty state, and the stale number is not
        // self-correcting: the component only grows from what the hint measured,
        // so a one-character draft inherited the hint's three lines. Where the
        // platform can size a control to its content, the value must drive it.
        const fs = out.match(/@supports \(field-sizing: content\) \{[\s\S]*?\n\}/)![0]
        expect(fs).toContain('field-sizing: content')
        // !important again: the component writes height inline.
        expect(fs).toContain('height: auto !important')
        // …and the six-row ceiling the component promised still applies.
        expect(fs).toContain('max-height: calc(6 * 1lh)')
    })

    it('derives nested attachment radii from the bubble so the arcs stay concentric', () => {
        const out = mduiHtml('ws://localhost:7600/ws')

        // One contract, declared on the bubble: a nested surface sits
        // --_bubble-pad in and carries --_code-r, so r_outer - r_inner == gap.
        expect(out).toContain('--_bubble-pad: 0.75rem')
        expect(out).toMatch(/border-radius: calc\(var\(--_code-r\) \+ var\(--_bubble-pad\)\)/)

        // The card and the thumbnail inside it must BOTH read that contract:
        // the card is --_code-r, the image one card-padding tighter.
        const card = out.match(/\.bubble \.bubble-attachments a \{[^}]*\}/)
        expect(card).not.toBeNull()
        expect(card![0]).toContain('border-radius: var(--_code-r)')

        const img = out.match(/\.bubble \.bubble-attachments img \{[^}]*\}/)
        expect(img).not.toBeNull()
        expect(img![0]).toContain('border-radius: calc(var(--_code-r) - var(--_card-pad))')

        // The padding the image's radius is derived from must be readable from
        // the image (i.e. declared on the strip, a shared ancestor) -- a
        // property on the card alone would not inherit down to the img.
        const strip = out.match(/\.bubble \.bubble-attachments \{[\s\S]*?\n\}/)
        expect(strip).not.toBeNull()
        expect(strip![0]).toContain('--_card-pad:')
    })

    it('keeps the user bubble gutter equal to the corner gap attachments assume', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // The user bubble pads prose 1.5rem wide, but a card in a 24px gutter
        // could never be concentric with a 32px corner. The strip cancels
        // exactly that surplus so cards land in the 12px gutter instead.
        expect(out).toMatch(/margin-left: calc\(var\(--_bubble-pad\) - 1\.5rem\)/)
        expect(out).toMatch(/margin-right: calc\(var\(--_bubble-pad\) - 1\.5rem\)/)
        const strip = out.match(/\.bubble \.bubble-attachments \{[\s\S]*?\n\}/)
        // Row-stretch would pad a short image unevenly (4px sides, 13px top and
        // bottom), breaking the single-radius concentric relation.
        expect(strip![0]).toContain('align-items: flex-start')
    })

    it('sits the remove button concentric with the chip corner it covers', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // One radius name for the chip and one for the button circle, and the
        // inset derived from the difference: r_chip - r_btn == inset is what
        // puts both arcs' centres on the same point.
        const chip = out.match(/\.attach-chip \{[^}]*\}/)
        expect(chip).not.toBeNull()
        expect(chip![0]).toContain('--_chip-r: var(--md-sys-shape-corner-large)')
        expect(chip![0]).toContain('--_remove-r:')
        expect(chip![0]).toContain('--_remove-inset: calc(var(--_chip-r) - var(--_remove-r))')

        const btn = out.match(/\.attach-chip \.attach-remove \{[^}]*\}/)
        expect(btn).not.toBeNull()
        // Positioned BY the derived inset, sized BY the derived diameter — the
        // old hardcoded top/right (.1rem) left the centre 3.2px off the arc.
        expect(btn![0]).toContain('top: var(--_remove-inset)')
        expect(btn![0]).toContain('right: var(--_remove-inset)')
        expect(btn![0]).toMatch(/width: calc\(2 \* var\(--_remove-r\)\)/)
        // No hardcoded offsets may survive next to the derived ones.
        expect(btn![0]).not.toMatch(/top:\s*\.?\d/)

        // The thumbnail clipped to the chip shares its radius (gap 0), so it
        // must read the same variable rather than restate the token.
        const img = out.match(/\.attach-chip\.thumb img \{[^}]*\}/)
        expect(img![0]).toContain('border-radius: inherit')
    })

    it('reads the conversation and its model as two app-bar lines, not a picker', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // M3E's app-bar has no default slot: each line has to claim its own.
        expect(out).toMatch(/<div id="app-title" slot="title"><span id="chat-title">/)
        expect(out).toMatch(/<div id="app-subtitle" slot="subtitle">/)
        // Both lines are informational text that must ellipsize rather than
        // push the trailing icons off a phone.
        for (const sel of ['#chat-title', '#status-model']) {
            const rule = out.match(new RegExp(`${sel} \\{[^}]*\\}`))![0]
            expect(rule).toContain('overflow: hidden')
            expect(rule).toContain('text-overflow: ellipsis')
            expect(rule).toContain('white-space: nowrap')
        }
        // The whole activation surface is gone, along with the caret that
        // announced it. Nothing may still look one up.
        for (const dead of ['model-picker', 'model-trigger', 'model-caret']) {
            expect(out).not.toContain(dead)
        }
        expect(out).not.toContain("getElementById('model-picker')")
    })

    it('names the conversation with the same words the sidebar row uses', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // One helper owns the fallback chain, so the bar and the drawer cannot
        // disagree about what a session is called.
        expect(out).toMatch(/function sessionTitle\(s\) \{\n {6}return s\.name \|\| s\.firstMessage/)
        // Both readers go through it: the sidebar row and the bar.
        expect(out).toContain("it.querySelector('.s-title').textContent = sessionTitle(s)")
        expect(out).toContain("chatTitle.textContent = s ? sessionTitle(s) : 'π-task'")
        // The bar re-derives its line from every sessions frame, so a switch or
        // a delete lands on it without a second data path.
        expect(out).toMatch(/case 'sessions':[\s\S]{0,200}?renderSessions\(\);\n {10}syncChatTitle\(\);/)
    })

    it('clears the bar by its measured height instead of an assumed 64px', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // A token with a floor, published from JS once the bar lays out.
        expect(out).toContain('--_topbar-h: 4rem;')
        expect(out).toMatch(/new ResizeObserver\(publishBarHeight\)\.observe\(topBar\)/)
        expect(out).toContain("setProperty('--_topbar-h'")
        // Every surface that hangs below it reads the token — none may keep a
        // hardcoded 4rem and drift when the second line makes the bar taller.
        expect(out).not.toContain('calc(var(--safe-top) + 4rem)')
        expect(out).toContain('top: calc(var(--safe-top) + var(--_topbar-h));')
        expect(out).toContain('padding-top: calc(var(--safe-top) + var(--_topbar-h) + 10px + 0.5rem)')
    })

    it('keeps the composer button the single model entry point', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // Wide: the library trigger anchors the menu to the button's parent.
        expect(out).toMatch(/id="model-slot"[\s\S]{0,80}<m3e-menu-trigger for="model-menu"/)
        // Phone: the handler sits on the BUTTON, because m3e-menu-trigger stops
        // its click before it bubbles to the wrapper — a wrapper listener would
        // leave a phone tap doing nothing.
        expect(out).toContain('modelBtn.addEventListener(\'click\', toggleModelPhonePanel)')
        expect(out).not.toContain("getElementById('model-slot').addEventListener")
        // The open state moved with the entry point.
        expect(out).toContain("modelBtn.classList.toggle('open', open)")
        expect(out).toMatch(/#composer-bar #model-btn\.open \{[^}]*background: color-mix/)
        expect(out).toMatch(/#composer-bar #model-btn\.open \{[^}]*border-radius: 999px/)
    })

    it('re-asks for the session list while the conversation is still unsaved', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // pi writes the session file on the first assistant message, so the
        // title only becomes derivable at agent_end — and only asks again while
        // the current row is still the synthesized one.
        const body = out.slice(out.indexOf("case 'agent_end':"), out.indexOf("case 'context':"))
        expect(body).toContain("type: 'list_sessions'")
        expect(body).toMatch(/\(!cur \|\| cur\.unsaved\)/)
    })

    it('gives each app-bar panel two hosts: a dropdown and a bottom sheet', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // Wide screens keep the app's original dropdowns, byte for byte.
        expect(out).toContain('<div id="notif-panel" aria-hidden="true">')
        expect(out).toContain('<div id="settings-panel" aria-hidden="true">')
        // Matched by id + attribute, not by the whole tag: the tag also
        // carries data-i18n-aria now, so a literal `>` would not follow the
        // aria-label any more.
        expect(out).toMatch(/<m3e-menu id="model-menu"[^>]*aria-label="切换模型"/)
        // Phones get the sheet form of the same three panels.
        for (const id of ['notif-sheet', 'settings-sheet', 'model-sheet']) {
            const m = out.match(new RegExp(`<m3e-bottom-sheet id="${id}"([^>]*)>`))
            expect(m).not.toBeNull()
            expect(m![1]).toContain('modal')
            expect(m![1]).toContain('handle')
            expect(m![1]).toMatch(/handle-label="[^"]+"/)
        }
        // The command suggestions are NOT among them: a typeahead must stay
        // anchored to the field it completes.
        expect(out).not.toContain('id="cmd-suggestions-sheet"')
    })

    it('keeps the wide-screen dropdown chrome, its corner concentric with the rows', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // The dropdown rules apply at every width; the narrow block hides them.
        for (const id of ['notif-panel', 'settings-panel']) {
            const m = out.match(new RegExp(`#${id} \\{[^}]*\\}`))
            expect(m).not.toBeNull()
            expect(m![0]).toContain('position: fixed')
            // Concentric, not a fixed shape token: the card wraps segmented rows
            // whose own group corner is 16px, and they sit --_gap from the card
            // edge, so the card arc is the two added. --_gap also IS the padding,
            // so the sum cannot drift if either number changes.
            expect(m![0]).toContain('--_row-r: var(--md-sys-shape-corner-large)')
            expect(m![0]).toContain('border-radius: calc(var(--_row-r) + var(--_gap))')
            expect(m![0]).toContain('padding: var(--_gap)')
            expect(m![0]).not.toContain('border-radius: var(--md-sys-shape-corner-extra-large)')
            expect(m![0]).toContain('box-shadow: 0 4px 8px 3px rgba(0,0,0,.3)')
            expect(m![0]).toContain('display: none')
        }
        expect(out).toContain('#notif-panel.open { display: flex; }')
        expect(out).toContain('#settings-panel.open { display: flex; }')
        // Anchors unchanged from the original.
        expect(out).toMatch(/#notif-panel \{[^}]*right: 3\.6rem/)
        expect(out).toMatch(/#settings-panel \{[^}]*right: 0\.5rem/)
        // The model list is the library menu with its own trigger.
        expect(out).toContain('<m3e-menu-trigger for="model-menu"')
        expect(out).toMatch(/#model-menu \{[^}]*--m3e-menu-container-max-height: 55vh/)
    })

    it('switches form at the breakpoint and hides the other host outright', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // Grab the whole block (up to the closing brace at column 0).
        const mq = out.match(/@media \(max-width: 600px\) \{([\s\S]*?)\n\}/)
        expect(mq).not.toBeNull()
        // display:none, not off-screen: a position:fixed card would otherwise
        // keep a hit area behind the sheet's scrim.
        expect(mq![1].replace(/\s+/g, ' ')).toContain(
            '#notif-panel, #settings-panel, #model-menu { display: none !important; }'
        )
        // ...and the sheets are styled in the same block.
        expect(mq![1]).toContain('--m3e-bottom-sheet-container-color')
        // The sheets follow the same breakpoint, live, not just at load.
        expect(out).toContain("window.matchMedia(WIDE).addEventListener('change', applyForm)")
        // One breakpoint constant for the CSS, the JS and the listener.
        expect(out).toContain("const WIDE = '(min-width: 601px)'")
        // One seam for both forms.
        expect(out).toContain('const hostOf = name =>')
        expect(out).toContain('function openPanel(name, open)')
    })

    it('shares one settings panel between the two hosts instead of duplicating it', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // The content lives once, in a template, and is cloned into the active
        // host only.
        expect(out).toContain('<template id="settings-content">')
        expect(out).toContain('function moveSettingsContent()')
        // The host it leaves must be emptied: a second copy would duplicate
        // every id in it, and getElementById resolves to the detached one.
        expect(out).toMatch(/const other = target === settingsPanel \? settingsSheet : settingsPanel;\s*\n\s*if \(other\) other\.innerHTML = ''/)
        // Every reference into it is resolved through the live host, so cloning
        // cannot leave a captured element pointing at a detached copy.
        expect(out).toContain('const settingsHost = () =>')
        expect(out).toContain('const applyThemeSelection = (val) =>')
        expect(out).toContain('const thinkingCollapseNow = () =>')
        // And the labels show live state, so they are re-stamped on each mount.
        expect(out).toContain('syncSettingsLabels();')
        // Interaction is delegated on the document for the same reason.
        expect(out).toContain("document.addEventListener('change'")
    })

    it('renders the app-bar panels as segmented lists', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        for (const id of ['notif-list', 'notif-sheet-list', 'settings-list']) {
            expect(out).toContain(`<m3e-list id="${id}" variant="segmented">`)
        }
        // The model list is the action-list flavour: its rows are choices, so
        // they need the button-like item and roving tab index.
        expect(out).toContain('<m3e-action-list id="model-sheet-list" variant="segmented">')
        // Notification rows use the slots the component defines. `start` and
        // `headline` are mdui's names: unrecognised slots fall through to the
        // default one, which rendered the icon inline with the text.
        expect(out).toContain('<m3e-icon slot="leading" name="')
        expect(out).not.toContain('slot="headline"')
    })

    it('renders the session sidebar as a segmented single-select list', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        expect(out).toContain('<m3e-selection-list id="session-list" variant="segmented"')
        // The component shows a selection radio by default, and hiding it is also
        // what makes the trailing slot render at all: without this attribute the
        // per-row trash is display:none.
        expect(out).toContain('hide-selection-indicator')
        expect(out).not.toContain('m3e-nav-menu')
        expect(out).not.toContain('s-label')
        expect(out).toContain("document.createElement('m3e-list-option')")
        expect(out).toContain("ic.slot = 'leading'")
        expect(out).toContain("sub.slot = 'supporting-text'")
        expect(out).toContain("del.slot = 'trailing'")
        // The option writes its own `selected` property when it is clicked, so an
        // attribute-only sync could leave a stale property behind.
        expect(out).toContain('it.selected = !!cur;')
        expect(out).toContain("it.toggleAttribute('selected', !!cur);")
        // Titles are one line, ellipsised — never a wrapped block that makes rows
        // a ragged height. Not a nowrap + text-overflow rule either: the option's
        // text column is a flex item with an automatic minimum size, so one
        // unbreakable nowrap line stretches the column instead of clipping.
        const titleRule = out.match(/#session-list \.s-title \{([^}]*)\}/)![1]
        expect(titleRule).toContain('-webkit-line-clamp: 1')
        expect(titleRule).toContain('overflow: hidden')
        // Without containment the long title widens div.content (shadow, min-width
        // auto) and every row's trash lands on a different x.
        expect(titleRule).toContain('contain: inline-size')
        expect(titleRule).not.toContain('white-space: nowrap')
        expect(titleRule).not.toContain('line-clamp: 2')
    })

    it('registers every icon name the client asks for', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // An unregistered name is not a missing glyph: m3e-icon falls back to
        // painting the ligature TEXT, so the row shows the word "info".
        const registered = new Set(
            [...out.matchAll(/([a-z][a-z0-9_]*)\s*:\s*\['[Mm\d]/g)].map((m) => m[1])
        )
        const used = new Set(
            [...out.matchAll(/<m3e-icon\b[^>]*\bname="([a-z0-9_]+)"/g)].map((m) => m[1])
        )
        const levels = out.match(/const LEVEL_ICON = \{([^}]*)\}/)
        expect(levels).not.toBeNull()
        for (const m of levels![1].matchAll(/:\s*'([a-z0-9_]+)'/g)) used.add(m[1])
        expect(used.size).toBeGreaterThan(10)
        expect([...used].filter((n) => !registered.has(n))).toEqual([])
    })

    it('drives theme mode and accent colour from menus of radio items', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        expect(out).toContain('<m3e-menu id="theme-menu"')
        expect(out).toContain('<m3e-menu id="accent-menu"')
        // The label text is wrapped in a span and tagged for the locale
        // sweep, so these are matched on structure rather than verbatim.
        expect(out).toMatch(/<m3e-menu-item-radio data-value="dark"[^>]*>[\s\S]*?深色/)
        expect(out).toMatch(/<m3e-menu-item-radio data-accent="#1E88E5"[^>]*data-name="蓝色"/)
        // Opened from the row through the library's own trigger.
        expect(out).toContain('<m3e-menu-trigger for="theme-menu">')
        expect(out).toContain('<m3e-menu-trigger for="accent-menu">')
        // The menus live OUTSIDE the settings template: a menu is fixed chrome
        // and a bottom sheet would clip it.
        const tpl = out.slice(out.indexOf('<template id="settings-content">'), out.indexOf('</template>'))
        expect(tpl).not.toContain('<m3e-menu ')
        expect(tpl).toContain('<m3e-menu-trigger for="theme-menu">')
        // State goes through the observed attribute, not a property, so it is
        // safe before the lazily loaded module has upgraded the element.
        expect(out).toContain("it.toggleAttribute('checked', ")
        // A click inside those menus is a click on a control the panel opened,
        // not an outside click that would close it mid-choice.
        expect(out).toContain("e.target.closest('m3e-menu')")
    })

    it('gives every switch both icons', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        const switches = out.match(/<m3e-switch\b[^>]*>/g) || []
        expect(switches.length).toBe(3)
        for (const el of switches) expect(el).toContain('icons="both"')
    })

    it('sends set_model from either model-picker form', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // The wide form's radio items were dead clicks: the only activation
        // path matched the sheet's rows.
        expect(out).toContain("modelMenu.addEventListener('click'")
        expect(out).toContain("e.target.closest('m3e-menu-item-radio')")
        expect(out).toContain('function pickModel(spec)')
        // The sheet's rows are action-list items, still matched by .model-row.
        expect(out).toContain('<m3e-list-action class="model-row')
        // Closing the wide form goes through the menu's own API: an .open class
        // is one the component never reads.
        expect(out).toMatch(/host === modelMenu[\s\S]{0,300}?host\.hideAll\(true\)/)
    })

    it('keeps the hidden host of each panel in step with the visible one', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // Crossing the breakpoint must not reveal a stale list or toggle.
        expect(out).toMatch(/for \(const el of \[notifList, notifSheetList\]\) if \(el\)/)
        expect(out).toMatch(/for \(const el of \[notifToggle, notifSheetToggle\]\)/)
        // Both model forms are rendered on every catalogue frame.
        expect(out).toContain('if (modelSheetList) modelSheetList.innerHTML = sheetHtml')
    })

    it('derives the detent ladder after the sheet upgrades', () => {
        const out = mduiHtml('ws://localhost:7600/ws')
        // These elements are plain HTMLElements until the lazily loaded module
        // upgrades them, so assigning earlier would be a silent no-op.
        expect(out).toContain("customElements.whenDefined('m3e-bottom-sheet')")
        // fit first: a short panel hugs its content instead of opening at half
        // the screen with dead space above it.
        const m = out.match(/el\.detents = \[([^\]]*)\]/)
        expect(m).not.toBeNull()
        expect(m![1]).toContain("'fit'")
        expect(m![1]).toContain("'half'")
        expect(m![1]).toContain("'full'")
    })

    it('removes the form-field subscript row instead of leaving dead space', () => {
        // The reserved supporting-text row is what made the field host taller
        // than its visible box. hide-subscript is the component's own switch.
        expect(mduiHtml('ws://localhost:7600/ws')).toContain('hide-subscript="always"')
    })

    it('anchors layout to the bottom safe-area so there is no gap', () => {
        // viewport-fit=cover makes fixed bottom content ride the home indicator
        // unless the CSS consumes the inset.
        expect(mduiHtml('ws://localhost:7600/ws')).toContain('env(safe-area-inset-bottom')
    })
})
