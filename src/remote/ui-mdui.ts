/** Stage 0 — Minimal Viable mdui webui.
 * Loads the pre-bundled mdui.esm.js (single file, 358 KB) which contains
 * tslib, lit, all components and all helper functions — it does NOT use
 * the per-component paths under /components/*.js because those have bare
 * `import 'tslib'`/`import 'lit'` specifiers the browser can't resolve.
 *
 * What works:
 *  - WS connect / reconnect (no animation yet)
 *  - Plain chat bubbles (no Markdown / thinking / tools yet)
 *  - agent_running / connected indicator + token counter
 *  - Send while idle, click-to-stop while running (no two-tap arm yet)
 *  - mdui light / dark / auto theme switcher
 *
 * Subsequent stages add: Markdown, thinking <details>, tool cards,
 * prompt card (3 modes + manual), push notifications, scan-to-connect,
 * command autocomplete, reconnect animation, jump-to-bottom button.
 */

// Stage 1-3: import upstream's reusable render helpers. They emit the
// top-level functions (renderMarkdown, syntaxHighlight, toolSummary,
// toolBadge, toolDiffHtml, escHtml) as a JS string we splice into our
// <script> tag. Reusing them keeps the heavy lifting — fence parsing,
// inline formatting, tool summaries, diffs — in upstream-tested code.
import {renderModule} from './ui-render.js'
import {highlightModule} from './ui-highlight.js'
import {toolsModule} from './ui-tools.js'
import {i18nModule} from './ui-i18n.js'

const M3E_VERSION = '2.7.9'

// @mdui/icons 1.x — used only for the named Material glyphs that mdui
// itself does not register as <mdui-icon-*> web components. Stage 0
// renders icons via <mdui-icon name="..."> which mdui 2.x ships natively.
// @mdui/icons 1.x path kept for future stages that need per-icon components.
// Stage 0 uses mdui-icon name="..." which is resolved by mdui 2.x internally.
// const ICON_BASE = `https://unpkg.com/@mdui/icons@1.0.4`

// Every @m3e/web module is loaded LAZILY (see the import block in stage0Logic).
// Nothing third-party is imported statically here on purpose: a static import
// whose module cannot be fetched or whose export does not exist is a module
// INSTANTIATION error, so the whole client script never runs and the page comes
// up blank — which is exactly what `import { snackbar }` did (that subpath
// exports `M3eSnackbar`, not `snackbar`). One lazy import per component keeps a
// CDN hiccup or a renamed export to one broken control, not a dead UI.
const BUNDLE_IMPORTS = ''

// Stage 0 doesn't import any @mdui/icons — we use mdui-icon name= lookups,
// which work out of the box once the bundle is loaded.
const ICON_IMPORTS = ''

const CSS = `
/* ── Material 3 Expressive accents (on top of mdui 2.x, which is plain M3) ──
   Spring motion tokens, shape morphing, wavy progress. Motion respects
   prefers-reduced-motion. */
:root {
    --m3e-spring-fast: linear(0, 0.0134 1.85%, 0.0487 3.7%, 0.1664 7.4%, 0.5724 12.4%, 0.8029 15.9%, 0.9432 19.7%, 1.0292 23.8%, 1.0834 28.4%, 1.1068 32.8%, 1.1121 37.2%, 1.101 41.6%, 1.083 46%, 1.0605 50.9%, 1.0229 58.5%, 1.0039 66.2%, 0.9985 74%, 1.0011 84.6%, 1);
    --m3e-spring-spatial: linear(0, 0.0062 0.9%, 0.025 1.9%, 0.1 4.1%, 0.4174 8.7%, 0.6829 12.5%, 0.8764 16.4%, 0.9841 20.4%, 1.0665 24.6%, 1.1161 29.1%, 1.1349 33.9%, 1.1353 38.4%, 1.1266 42.9%, 1.1049 48%, 1.0581 55.5%, 1.0254 62.4%, 1.0072 70.1%, 0.9997 79.5%, 1 100%);
}
/* ── Composer: two concentric capsules ─────────────────────────────────────
   Outer = m3e-toolbar (vibrant), inner = the input pill, and the trailing
   button is STACKED in the pill's bottom-right corner rather than standing
   beside it. Only the first number below is typed in; every other radius is
   derived from it, so the relation that makes the two capsules read as one
   object survives a change to any of them:
     outer 36  →  inner 36 − 8 = 28  →  button end inset 28 − 40/2 = 8
   The outer radius must be FIXED. The library's own rounded shape is
   corner.full, and a full radius on a box that grows to six lines stretches
   into a giant capsule — the inner capsule is then nowhere near its corner.
   Values are px, not rem, on purpose: m3e's form-field min-height is a
   hardcoded 56px, so a root font-size change would otherwise desync the
   capsules from the field they wrap. */
#composer-bar {
    --c-outer-r: 36px;
    --c-gap: 8px;
    --c-inner-r: calc(var(--c-outer-r) - var(--c-gap));
    --c-btn: 40px;
    --c-inset: calc(var(--c-inner-r) - var(--c-btn) / 2);
    --c-field-min: 56px;
    --c-bar-min: calc(var(--c-field-min) + 2 * var(--c-gap));
    /* One button's worth of room, as the pill's reserved trailing slot:
       the disc plus an inset on each side of it. */
    --c-reserve: calc(var(--c-btn) + 2 * var(--c-inset));

    display: block;
    width: 100%;
    min-height: var(--c-bar-min);
    box-sizing: border-box;
    --m3e-toolbar-rounded-shape: var(--c-outer-r);
    --m3e-toolbar-rounded-padding: var(--c-gap);
    --m3e-toolbar-spacing: 4px;
    /* The row's min-height is this token plus a density term, which is 0 at
       the default density scale: 56 + 2×8 padding = --c-bar-min exactly, so a
       one-line composer is a true capsule and a six-line one is a rounded
       rectangle. */
    --m3e-toolbar-size: var(--c-field-min);
    --m3e-toolbar-vibrant-container-color: var(--md-sys-color-primary-container);
    --m3e-toolbar-vibrant-color: var(--md-sys-color-on-primary-container);
}
/* The toolbar's own .base pins every icon button to a 48px interactive
   minimum, and slotted content inherits that declaration — a value set on
   #composer-bar would be shadowed by it. Declaring on each button's host
   element wins, and 40 is what makes the inset arithmetic above true. */
#composer-bar m3e-icon-button {
    --_icon-button-size: var(--c-btn);
    --_icon-button-min-size: var(--c-btn);
    --m3e-icon-button-container-height: var(--c-btn);
    /* Always a plain circle, pressed or not. The pressed rule reads the
       size-specific morph token BEFORE the generic one, so overriding only the
       generic name leaves the plate morphing to a squircle mid-tap. Every
       composer button is size="small"; the other sizes are pinned too so the
       override survives a size change. */
    --m3e-icon-button-shape-round: 999px;
    --m3e-icon-button-shape-square: 999px;
    --m3e-icon-button-shape-pressed-morph: 999px;
    --m3e-icon-button-extra-small-shape-pressed-morph: 999px;
    --m3e-icon-button-small-shape-pressed-morph: 999px;
    --m3e-icon-button-medium-shape-pressed-morph: 999px;
    --m3e-icon-button-large-shape-pressed-morph: 999px;
}
.composer-slot { flex: 0 0 auto; }
/* The model button is the panel's only entry point now that the app-bar pill
   is gone, so it has to answer for the open state the pill used to carry. A
   tonal disc mixed from the toolbar's own foreground ink — hierarchy by color,
   never a stroke. The standard variant never reads
   --m3e-icon-button-container-color (only filled/tonal paint a container), so
   the disc goes on the HOST, which is the button's painted surface — same
   approach the copy buttons take. */
#composer-bar #model-btn.open {
    background: color-mix(in srgb, var(--md-sys-color-on-primary-container) 20%, transparent);
    border-radius: 999px;
}
/* Left action group. The toolbar row is align-items:center, so both this and
   the pill must be pulled to the bottom edge explicitly: otherwise the
   buttons sit on the field's midline and hang in the air as it grows. With
   8px of its own bottom padding a button's centre lands 16px from the bar's
   edge — the same 16px it has from the top and the bottom, which is what
   makes the discs concentric with the outer R36 caps. */
#composer-actions {
    display: flex;
    align-items: flex-end;
    gap: var(--m3e-toolbar-spacing);
    flex: 0 0 auto;
    align-self: flex-end;
    padding-bottom: var(--c-gap);
    margin-inline-start: var(--c-gap);
    max-width: 10rem;
    overflow: hidden;
    transition: max-width 0.42s var(--m3e-spring-spatial),
                margin-inline-start 0.42s var(--m3e-spring-spatial),
                /* Not the spring: it overshoots the 4px by ~1.6px, which would
                   push the pill's left cap through the outer capsule's rim
                   mid-collapse. The width carries the motion; this only has to
                   land on the concentric inset. */
                margin-inline-end 0.42s linear,
                opacity 0.2s linear;
}
/* Narrow screens only, and only while the field is focused with text in it:
   the group gives its width to the field. The collapse is layout-driven
   (max-width on the group, the pill is the row's flex:1 child) — no animated
   size on a clipped element, which is what cut the capsule ends flat in the
   reference's porting notes. */
#composer-bar.compact #composer-actions {
    max-width: 0;
    margin-inline-start: 0;
    /* A zero-width child still costs the row one 4px gap, which would land the
       pill's left cap 12px from the outer capsule instead of the concentric 8.
       Pulling the group's trailing edge back by exactly that gap cancels it. */
    margin-inline-end: calc(-1 * var(--m3e-toolbar-spacing));
    opacity: 0;
    pointer-events: none;
}
/* The inner capsule. It paints the surface itself and the form-field inside
   is made transparent, so there is exactly ONE opaque layer under the field,
   the loader and the button — with two half-alpha layers cross-fading, the
   vibrant toolbar behind would show through the middle of the pill. */
#composer-pill {
    position: relative;
    display: flex;
    align-items: stretch;
    flex: 1 1 auto;
    min-width: 0;
    align-self: flex-end;
    min-height: var(--c-field-min);
    box-sizing: border-box;
    padding-inline-end: var(--c-reserve);
    border-radius: var(--c-inner-r);
    /* Same as the app base surface (body/#root), so the capsule reads as the
       input field cut straight out of the page rather than a gray tray sitting
       inside the vibrant ring. Still OPAQUE — the comment above explains why a
       transparent fill would let the vibrant toolbar bleed through the middle
       of the pill. */
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
    /* Opens up when the loader appears, closes when it goes — same width
       arithmetic as the trailing slot. */
    padding-inline-start: calc(var(--c-btn));
    transition: padding-inline-start 0.42s var(--m3e-spring-spatial);
}
m3e-icon-button#send-btn {
    /* In the corner, not beside: 8px from both inner edges of the pill, which
       for a single line puts the disc exactly on the field's midline. */
    position: absolute;
    inset-inline-end: var(--c-inset);
    bottom: var(--c-inset);
    z-index: 1;
}
/* send ⇄ stop is a morph, not a swap-in-place: the glyph shrinks and fades
   out, the new one comes back up on the fast spring. */
#send-btn m3e-icon {
    transition: transform 0.28s var(--m3e-spring-fast), opacity 0.12s linear;
}
m3e-icon-button#send-btn.swapping m3e-icon {
    transform: scale(0.8);
    opacity: 0;
}
/* The streaming loader takes the field's leading slot as a 40px disc sitting
   at the SAME concentric offset as the send button — inset by exactly
   --c-inset (8px) from both the left cap and the bottom edge, so the two
   discs share the pill's corner arc centres. Bottom-aligned (not centred) to
   match #send-btn; the field grows upward, and both stay pinned to the
   base line. */
#composer-loading {
    position: absolute;
    inset-inline-start: var(--c-inset);
    bottom: var(--c-inset);
    display: block;
    width: var(--c-btn);
    height: var(--c-btn);
}
/* "+" doubles as the close affordance of its own menu: the same glyph turns
   45deg into a ×, on the spatial spring. */
#add-btn m3e-icon {
    transition: transform 0.35s var(--m3e-spring-spatial);
}
m3e-icon-button#add-btn.open m3e-icon {
    transform: rotate(45deg);
}

/* mdui 2.x does not load the Material Icons font itself — without this,
   icon="..." attributes render as raw ligature text ("send", "close"...).
   Load it from the same CDN as the mdui bundle so offline/LAN usage
   never depends on Google Fonts. */
@font-face {
    font-family: 'Material Icons';
    font-style: normal;
    font-weight: 400;
    src: url(https://cdn.jsdelivr.net/npm/material-icons@1.13.12/iconfont/material-icons.woff2) format('woff2');
}
:root {
    color-scheme: light dark;
    --chat-max-width: 920px;
    /* One deliberate face: the platform monospace for code blocks and
       terminal-style output. Everything else sets no font-family at all
       and rides the browser's system default. */
    --font-mono: ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace;
    /* Dynamic M3 color tokens (--md-sys-color-*) are generated by <m3e-theme>
       (wrapping <body>) from its seed color for both light and dark — no manual
       bridge needed. Every m3e component and the layout CSS below read these
       tokens directly. */
}
html, body {
    height: 100%;
    margin: 0;
    overflow: hidden;
    /* <m3e-theme> publishes --md-sys-color-* on ITSELF (#app-theme), a
       DESCENDANT of body — so html/body can never resolve them. The Canvas/
       CanvasText system colors (which honour color-scheme) are the fallback
       that keeps the page from flashing white behind #root; the real themed
       base lives on #root (see below). */
    background: var(--md-sys-color-surface, Canvas);
    color: var(--md-sys-color-on-surface, CanvasText);
    font-family: system-ui, sans-serif;
    /* deliberately no color: see #app-theme below */
    /* Suppress the WebKit/Blink mobile tap flash on every tapped surface —
       the property inherits, so one declaration here (rather than per
       component) covers light DOM, slotted content and shadow trees alike.
       Press feedback is already provided by each component's state layer. */
    -webkit-tap-highlight-color: transparent;
}
/* The real themed base. <m3e-theme> publishes --md-sys-color-* on ITSELF, so
   this is the highest element that can actually resolve them, and the only
   anchor that reaches everything: #root covers the app shell, but the overlay
   panels (#settings-panel, #notif-panel, #prompt-card, #reconnect-overlay) are
   direct children of #app-theme — siblings of #root, not descendants — so they
   never picked up #root's colour. Anchoring here means anything that doesn't
   set its own colour follows the theme instead of falling back to the initial
   black (invisible on the dark surface) or to CanvasText (which tracks the
   BROWSER's scheme, not the app's, and so can be the exact opposite). */
#app-theme { color: var(--md-sys-color-on-surface); }
/* Native scrollbars are hidden app-wide — scrolling surfaces get the
   custom .scroll-thumb overlay instead (see attachScrollbar in the client:
   fades in while scrolling, idles out, draggable). */
* {
    scrollbar-width: none;
}
*::-webkit-scrollbar { width: 0; height: 0; display: none; }
.scroll-thumb {
    position: absolute;
    width: 5px;
    /* Half the width — the round cap. Where a thumb is overlaid on a rounded
       host, attachScrollbar's inset/rightInset options exist so these caps'
       centers land on the host's corner arcs' centers (corner − half width). */
    border-radius: 2.5px;
    background: color-mix(in srgb, var(--md-sys-color-on-surface-variant) 55%, transparent);
    opacity: 0;
    transition: opacity 250ms;
    pointer-events: auto;
    cursor: default;
    z-index: 6;
}
.scroll-thumb.on { opacity: 1; }
.scroll-thumb.dragging { background: color-mix(in srgb, var(--md-sys-color-on-surface-variant) 80%, transparent); }
#root {
    display: grid;
    /* One child: the session drawer wraps the whole main column. */
    grid-template-rows: minmax(0, 1fr);
    height: var(--app-height, 100dvh);
    /* #root is the outermost element INSIDE <m3e-theme>, so this is where the
       generated tokens are first resolvable. Anchor the base surface and text
       color here — every descendant that doesn't set its own colour inherits
       these adaptive values. Without it they fall back to the initial black,
       which is invisible on the dark surface (e.g. the settings-card labels). */
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
}

/* Session sidebar. m3e-drawer-container overlays the drawer (over-mode, with
   scrim) on the main column; #main-col takes over #root's old rows so the
   app-bar/chat/bands layout is untouched. The drawer's .content pane is
   height:100%, but the slotted column must CLAIM that height — otherwise it
   sizes to content, the whole page scrolls, and the composer ends up at the
   bottom of the document instead of the viewport. */
#main-col {
    display: grid;
    /* A track that starts at auto is minmax(auto, auto): its base size is the
       widest item's min-content, so the composer row (whose textarea still has
       an intrinsic 238px) would push the track to 482px on a 390px phone and the
       send button would land off-screen. minmax(0, 1fr) lets the track shrink to
       the container, and every box below it already knows how to follow. */
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto auto auto;
    height: 100%;
    min-height: 0;
    /* The same trap one level up: as a #root grid item its automatic minimum
       size is its own min-content, so without min-width:0 the column could not
       shrink below the composer's intrinsic width either. */
    min-width: 0;
}
#drawer { --m3e-drawer-container-width: min(84vw, 20rem); }
#session-drawer {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: calc(var(--safe-top) + 0.5rem) 0.5rem 0.75rem;
    box-sizing: border-box;
    height: 100%;
}
#session-drawer-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 0.5rem;
}
#session-drawer-title { font-size: 0.95rem; font-weight: 600; }
#session-list { flex: 1; min-height: 0; overflow-y: auto; }
#session-list .s-title {
    font-size: 0.875rem;
    line-height: 1.3;
    /* One line, ellipsised, and the trash on every row lands on the same x.
       The option's text column (div.content, shadow DOM, no ::part hook) is a flex
       item with min-width: auto, so this span's min-content decides how far that
       column — and the trailing button behind it — gets pushed: a long title took
       210px where the other rows got 196px, sliding its trash 7px right.
       Inline-size containment drops the contribution to zero, so the column always
       fills the row exactly and the clamp does the truncating. */
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
    contain: inline-size;
}
#session-list .s-sub { font-size: 0.72rem; color: var(--md-sys-color-on-surface-variant); }
/* Per-row delete: a 28px icon button in the row's trailing slot, revealed on
   row hover or keyboard focus, always visible on hover-less (touch) devices —
   the same treatment the code block's copy button gets. Present on every row;
   the CURRENT row's button is disabled while the agent is replying (the server
   refuses that window too). The list option reserves the trailing column
   itself, so the button needs no anchor box and no overflow escape. */
#session-list .s-del {
    --_d: 1.75rem;
    flex: none;
    width: var(--_d);
    height: var(--_d);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: var(--md-sys-color-surface-container-highest);
    color: var(--md-sys-color-on-surface-variant);
    cursor: pointer;
    opacity: 0;
    transition: opacity 150ms, color 150ms;
}
#session-list m3e-list-option:hover .s-del,
#session-list m3e-list-option:focus-within .s-del,
#session-list .s-del:focus-visible { opacity: 1; }
#session-list .s-del:hover { color: var(--md-sys-color-error); }
#session-list .s-del m3e-icon { font-size: 1rem; }
@media (hover: none) {
    #session-list .s-del { opacity: 1; }
}
/* Disabled (current row mid-run): stay faded even on row hover, and the
   error hover tint is off — it must read as unavailable, not armed. */
#session-list .s-del:disabled,
#session-list m3e-list-option:hover .s-del:disabled,
#session-list m3e-list-option:focus-within .s-del:disabled {
    opacity: 0.35;
    cursor: not-allowed;
}
#session-list .s-del:disabled:hover { color: var(--md-sys-color-on-surface-variant); }
/* A destructive confirm reads in the error palette: the filled button paints
   --md-sys-color-primary, so swap the pair rather than restyle the component. */
#session-delete-confirm {
    --md-sys-color-primary: var(--md-sys-color-error);
    --md-sys-color-on-primary: var(--md-sys-color-on-error);
}
#session-list .s-empty {
    padding: 1.25rem 1rem;
    font-size: 0.85rem;
    color: var(--md-sys-color-on-surface-variant);
    text-align: center;
}

/* Content of the bottom bands aligns with the centered chat column
   without extra wrappers: at least 1rem, else centered-column + 1rem. */
:root {
    --col-pad: max(1rem, calc((100vw - var(--chat-max-width)) / 2 + 1rem));
}
/* Notch/home-bar insets (viewport-fit=cover): with a single merged app bar
   nobody else compensates for the status bar, and the composer must clear
   the home indicator. Zero in normal browsers. */
:root {
    --safe-top: env(safe-area-inset-top, 0px);
    --safe-bottom: env(safe-area-inset-bottom, 0px);
    /* Everything that hangs below the bar (the context wave, the chat's first
       row, the anchored dropdowns) clears its full height. The small app-bar's
       own 64px is only the floor: with a title AND a subtitle slotted, the bar
       is content-sized, so JS re-measures it and writes the real number here. */
    --_topbar-h: 4rem;
    /* The same problem at the other end, and worse: the band under the chat is
       the composer plus the held bar plus the task panel, the field grows as
       you type, and the attach tray appears and goes. The chat scrolls beneath
       all of it, so the bottom clearance is measured in JS and published here
       for the scroller's padding, the fade's anchor and the fab's seat. The
       default is the composer at rest: 72px bar + 12px top pad + 16px bottom. */
    --_composer-h: 100px;
    /* How far ABOVE that band the dissolve already begins. The capsule is
       opaque and covers most of the band, so a ramp that waited for the
       band's top edge would do all its fading behind paint — the chat has to
       be visibly thinning while it is still in the clear. */
    --_fade-h: 1.5rem;
}
/* The app bar stays a quiet neutral band — the expressive accents live in
   the composer, avatars and the task panel instead. */
/* The bar's height, surface and padding are owned by <m3e-app-bar> now. These
   four slotted clusters just lay out their own content; M3E's template slots
   them into leading / title / subtitle / trailing. */
#app-bar { display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; }
#app-title { display: flex; align-items: center; min-width: 0; }
#app-subtitle { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
#app-actions { display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; }
/* The bar reports, it no longer acts: line one is the conversation's title,
   line two the model serving it (switching models lives on the composer). Both
   lines have to give way — the title of an unsaved conversation IS its first
   message, which has no natural length — and neither may push the trailing
   icons off screen, hence min-width: 0 on the slot wrappers plus ellipsis on
   the text itself. */
#chat-title {
    font-size: 1.05rem;
    font-weight: 650;
    letter-spacing: 0.01em;
    line-height: 1.35;
    color: var(--md-sys-color-on-surface);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
/* One step down from the title: same platform UI font, no weight, muted. */
#status-model {
    font-size: 0.78rem;
    line-height: 1.4;
    color: var(--md-sys-color-on-surface-variant);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
#status-ctx {
    font-size: 0.78rem;
    color: var(--md-sys-color-on-surface-variant);
    white-space: nowrap;
    flex-shrink: 0;
}
/* Narrow phones: the context figures duplicate the ctx-bar below, so the
   text yields its space to the model name. */
@media (max-width: 420px) {
    #status-ctx { display: none; }
}
/* App-bar icon pair reads at on-surface (brighter than the icon-button
   default). */
#notif-btn,
#settings-btn {
    --md-sys-color-on-surface-variant: var(--md-sys-color-on-surface);
}
#notif-btn { flex-shrink: 0; }
/* Inside m3e-button-group, the two are tonally-tinted toggles; the group owns
   the spacing and the shared shape, so no per-button margin is needed. The
   selected (pressed) look is the library's own tonal container. */
#app-actions m3e-button-group { flex-shrink: 0; }
#status-dot {
    width: 0.5rem; height: 0.5rem; border-radius: 50%;
    background: var(--md-sys-color-outline);
    transition: background 0.2s;
    flex-shrink: 0;
}
#status-dot.connected.idle    { background: var(--md-sys-color-tertiary); }
#status-dot.connected.running { background: var(--md-sys-color-primary);
    animation: pulse 1.4s ease-in-out infinite; }
#status-dot.disconnected      { background: var(--md-sys-color-error); }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }
/* Context-window usage as the same M3 Expressive wavy indicator the task
   widget uses. Track sits one tonal step above the bar; the wave turns
   error-red once usage runs hot (the old gradient's danger signal). */
#ctx-stack {
    position: absolute;
    /* Sits in the band just below the app bar (whose rendered height the
       --_topbar-h token carries). Below the bar's z-index (30), so it must
       clear its full height or the bar would paint over the wave. */
    top: calc(var(--safe-top) + var(--_topbar-h));
    left: 0; right: 0;
    height: 0.5rem;
    display: block;
    width: 100%;
    z-index: 29;
    --md-sys-color-secondary-container: var(--md-sys-color-surface-container-highest);
}
#ctx-stack.hot { --md-sys-color-primary: var(--md-sys-color-error); }
#ctx-stack m3e-linear-progress-indicator { display: block; width: 100%; }
/* The indicator is a custom element from a SECOND CDN (mdui itself comes
   from jsdelivr). Until it is defined the tag is unknown: zero height, so
   the bar is simply absent, and every value write lands on a plain
   HTMLElement as a no-op — a failure that is completely silent. This
   CSS-only bar is the floor: paintCtx() drives its fill width directly,
   with no library at all, and it is retired only once the element really
   upgrades (see customElements.whenDefined below). */
#ctx-fallback {
    display: block;
    height: 4px;
    border-radius: 999px;
    overflow: hidden;
    background: var(--md-sys-color-surface-container-highest);
}
#ctx-fallback > i {
    display: block;
    height: 100%;
    width: 0;
    border-radius: inherit;
    background: var(--md-sys-color-primary);
    transition: width 300ms;
}
#ctx-stack.hot #ctx-fallback > i { background: var(--md-sys-color-error); }
#ctx-stack.m3e #ctx-fallback { display: none; }
/* The wavy layer lives on top; the two layers crossfade exclusively so
   the flat fill never lingers under the rolling wave. */
#ctx-bar {
    position: absolute;
    inset: 0;
    opacity: 0;
    transition: opacity 300ms;
}
#ctx-bar-flat { transition: opacity 300ms; }
#ctx-stack.live #ctx-bar { opacity: 1; }
#ctx-stack.live #ctx-bar-flat { opacity: 0; }
/* The top-app-bar is absolutely positioned inside this wrapper (its
   scroll-target mode requires a relative, overflow-hidden parent) and the
   chat scrolls beneath it. The wrapper spans every row of #main-col, so the
   conversation carries on DOWN behind the composer instead of stopping dead
   at the band's top edge — the band floats back over it (see #status-panel /
   #held-bar / #input-bar) and the scroller reserves its height below. */
#chat-wrap { position: relative; min-height: 0; display: flex; overflow: hidden;
    grid-column: 1; grid-row: 1 / -1; }
#chat-log { flex: 1; min-width: 0; overflow-y: auto; overflow-x: hidden;
    padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem;
    /* Own the top inset: the bar's measured height plus the 10px wave band
       plus air, so the first message never tucks under the bar. !important
       beats the component's own inline padding-top. */
    padding-top: calc(var(--safe-top) + var(--_topbar-h) + 10px + 0.5rem) !important;
    /* Rest position: clear of the band AND clear of the dissolve, so the last
       bubble lands fully opaque instead of permanently ghosted. */
    padding-bottom: calc(var(--_composer-h) + var(--_fade-h) + 0.75rem);
    /* Fade, not a cover: the content's OWN alpha ramps to zero, so what
       reaches the eye around the capsule is the plain surface the bubbles
       already sit on — no second painted layer, no opaque scrim, and nothing
       theme-dependent (a mask reads alpha, so light and dark get the same
       ramp for free). The ramp leads in --_fade-h above the band and dies at
       the screen edge: the capsule is opaque and covers most of the band, so
       a ramp that started at the band's top edge would only ever fade behind
       paint. Masking the scroller rather than the wrapper keeps the app bar
       and the scroll fab out of it. */
    --_chat-fade: linear-gradient(to bottom, #000 0,
        #000 calc(100% - var(--_composer-h) - var(--_fade-h)),
        transparent 100%);
    -webkit-mask-image: var(--_chat-fade);
    mask-image: var(--_chat-fade); }
/* The bar paints neutral (matching the #app-bar row); it also must clear
   the notch. m3e tokens are full color values — reference --md-sys-color-*
   directly, never rgb()-wrapped, and never self-referentially (a var
   citing itself turns guaranteed-invalid down the whole subtree, which is
   how the app-bar icons once ended up at 1.7:1 contrast). */
m3e-app-bar#top-bar {
    --md-sys-color-surface: var(--md-sys-color-surface-container);
    /* Pinned to the top of the scroll-wrap; the chat clears it via
       #chat-log's padding-top. z above the chat and the ctx wave. */
    position: absolute; top: 0; left: 0; right: 0; z-index: 30;
    width: 100%;
    /* The small variant hardcodes a 64px host with 12px padding, which
       double-centers our 52px row and pushes the context wave outside the
       bar. Our row owns its spacing — the component just wraps it. */
    padding: 0;
    height: auto;
}
/* Children must keep their natural height: overflow-hidden collapse wrappers
   would otherwise be flex-shrunk to a squashed strip instead of scrolling. */
#chat-log > * { flex-shrink: 0; }
.msg {
    max-width: var(--chat-max-width); width: 100%; margin: 0 auto;
    display: flex; gap: 0.75rem;
}
.msg.user { flex-direction: row-reverse; }
.bubble {
    position: relative;
    padding: var(--_bubble-pad);
    /* Concentric with the code blocks it wraps: the block's corner arc
       center sits (code-r + pad, code-r + pad) in from the bubble corner.
       The padding is uniform, and a code block at the bubble's top/bottom
       edge gets the same 12px gap as at the sides (its edge margins are
       zeroed below), so the buffered outer corner is a plain 32px circle —
       no elliptical slash pair needed. Prose blocks buy their roomier
       24px side inset below, in their own margins, so the corner math
       stays code-driven. */
    --_code-r: calc(1rem + var(--md-sys-shape-corner-extra-small));
    /* The corner contract, in one place: a nested surface sits --_bubble-pad
       from this edge and carries --_code-r, so the two arcs share a centre
       (r_outer − r_inner == gap). Every nested surface — code blocks, tables,
       attachment cards — consumes these two values rather than inventing its
       own radius, which is what keeps them concentric. */
    --_bubble-pad: 0.75rem;
    /* Concentric means r_inner == r_outer − gap, which only has a solution
       while gap < r_outer. At the tail corner (radius 0.5rem) the 0.75rem
       gutter already exceeds the arc, so the nested surface never reaches into
       it and the relation simply does not apply — hence one radius
       (--_code-r) serves every nested surface and every corner it can touch. */
    border-radius: calc(var(--_code-r) + var(--_bubble-pad));
    /* Single-line content turns the bubble into a capsule of its big
       corner radius: total height = 2 × radius. min-height is content-box
       (no global border-box here), so it carries the padding subtraction:
       2×(code-r + pad) − 2×pad = 2×code-r. The single-line code block
       (40px) lands exactly on it too. align-content centers short content
       in the extra space; taller content overflows the min-height and
       centering is a no-op. Same rule horizontally: a lone letter must not
       produce a bubble narrower than the arcs can express. */
    min-height: calc(2 * var(--_code-r));
    min-width: calc(2 * var(--_code-r));
    align-content: center;
    background: var(--md-sys-color-surface-container-high);
    color: var(--md-sys-color-on-surface);
    line-height: 1.55;
    max-width: 80%;
    word-wrap: break-word;
}
.msg.user .bubble {
    background: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
    border-top-right-radius: 0.5rem;
    /* Pure-text bubble: the prose inset comes straight from the padding. The
       attachment strip below cancels the extra 12px (see .bubble-attachments)
       so nested cards still sit in the 12px gutter the corner math needs. */
    padding: var(--_bubble-pad) 1.5rem;
    /* Roomier 24px sides mean the shared content min-width would land the
       capsule at 88px; subtract it from the 2 × radius TOTAL instead:
       64 − 48 padding = 16px content (2×code-r − 1.5rem), so a lone letter
       still caps at exactly 2 × radius. */
    min-width: calc(2 * var(--_code-r) - 1.5rem);
}
.msg.assistant .bubble, .msg.error .bubble {
    /* The one tail corner, pointing at the avatar side. The top-right keeps
       the bubble's concentric elliptical pair — the floating copy circle
       buffers inside that arc (see .bubble-copy). */
    border-top-left-radius: 0.5rem;
}
.msg.error .bubble {
    /* Same shape as an assistant bubble, tinted toward the error palette
       (matching the tool-call error mix) so it reads as an error at a
       glance while staying on-voice with the rest of the chat. */
    background: color-mix(in srgb, var(--md-sys-color-error-container) 35%, var(--md-sys-color-surface-container-high));
}

/* Markdown surface (Stage 1) */
.bubble.md {
    line-height: 1.55;
}
/* Prose buys the roomier 1.5rem/0.875rem inset via its own margins — the
   bubble's padding stays block-tight so the concentric corner math is
   untouched. Code blocks (div.code-block and headless pre) AND tables are
   deliberately excluded: a table keeps the tight padded edge the radius
   buffers around, exactly like a code block, so both axes get the bubble's
   0.75rem padding and its radius is the same --_code-r (32 − 12 = 20,
   concentric with the bubble's corner). */
.bubble.md > p, .bubble.md > ul, .bubble.md > ol, .bubble.md > blockquote,
.bubble.md > h1, .bubble.md > h2, .bubble.md > h3,
.bubble.md > h4, .bubble.md > h5, .bubble.md > h6 {
    margin-left: 0.75rem; margin-right: 0.75rem;
}
.bubble.md > :first-child { margin-top: 0; }
/* :last-of-type, not :last-child — the floating copy button is appended
   inside the bubble and would otherwise count as the last block, keeping
   the real final block's bottom margin (unequal bubble heights). Zeroing
   covers prose AND edge code blocks: with uniform 0.75rem padding, a code
   block at the top or bottom edge sits 12px from the bubble edge — the
   same gap it gets at the sides. */
.bubble.md > :last-of-type { margin-bottom: 0; }
.bubble.md h1, .bubble.md h2, .bubble.md h3, .bubble.md h4, .bubble.md h5, .bubble.md h6 {
    /* margin-block, not the shorthand: the prose inset (margin-inline from
       the child-selector rule above) must survive this rule. */
    margin-block: 0.8em 0.4em;
    font-weight: 600;
    line-height: 1.25;
}
.bubble.md h1 { font-size: 1.4em; }
.bubble.md h2 { font-size: 1.2em; }
.bubble.md h3 { font-size: 1.05em; }
.bubble.md p  { margin-block: 0.5em; }
.bubble.md ul, .bubble.md ol { margin-block: 0.5em; padding-left: 1.5em; }
.bubble.md li { margin-block: 0.2em; }
.bubble.md blockquote {
    margin-block: 0.6em;
    padding: 0.2em 0.8em;
    border-left: 3px solid var(--md-sys-color-outline-variant);
    color: var(--md-sys-color-on-surface-variant);
}
.bubble.md a { color: var(--md-sys-color-primary); text-decoration: none; }
.bubble.md a:hover { text-decoration: underline; }
.bubble.md strong { font-weight: 600; }
.bubble.md em { font-style: italic; }
.bubble.md code {
    background: var(--md-sys-color-surface-container-highest);
    color: var(--md-sys-color-on-surface);
    padding: 0.1em 0.4em;
    border-radius: 0.25rem;
    font-family: var(--font-mono);
    font-size: 0.9em;
}
/* Code block. The copy button floats as a bare circular icon button over the
   top-right corner instead of a full-width header bar, so the code surface
   stays clean. It used to share a 「lang ⧉」 capsule with the language label;
   that pill read as a capsule-shaped BUTTON on any hover-capable device and is
   gone (the label itself is no longer rendered — see ui-render.ts). The
   concentric radius math below still holds: the head is 2rem tall and sits
   --_pill-inset from the corner, so block radius = button radius (1rem) + inset
   and both arcs share a center. */
.bubble .code-block {
    position: relative;
    font-family: var(--font-mono);
    --_pill-inset: var(--md-sys-shape-corner-extra-small);
    --_code-line: 1.25rem;
    background: var(--md-sys-color-surface-container-lowest);
    /* Same radius the bubble's concentric formula consumes (--_code-r is
       defined on .bubble and inherits here). */
    border-radius: var(--_code-r);
    overflow: hidden;
    margin: 0.6em 0;
    font-size: 0.9em;
    /* Capsule recipe: one code line plus two of these paddings is exactly
       2 × --_code-r, so a single-line block IS a capsule (height = 2 ×
       radius) — and the floating pill (top: --_pill-inset, height 2rem)
       lands at its exact vertical center with concentric arcs, since
       2×(1rem + inset) − 2rem = 2×inset leaves inset as the half-space per
       side. Multi-line blocks grow in whole --_code-line steps past it. */
    padding: calc((2 * var(--_code-r) - var(--_code-line)) / 2) 1em;
    line-height: var(--_code-line);
}
.bubble .code-head {
    position: absolute;
    top: var(--_pill-inset);
    right: var(--_pill-inset);
    height: 2rem;
    box-sizing: border-box;
    z-index: 1;
    display: flex; align-items: center;
    opacity: 0;
    transition: opacity 0.15s;
}
.bubble .code-block:hover .code-head { opacity: 1; }
/* Touch devices have no hover — keep the button faintly visible so it never
   hides entirely (and never covers the code: it is one 2rem circle). */
@media (hover: none) {
    .bubble .code-head { opacity: 0.75; }
}
.bubble .code-block pre {
    margin: 0;
    border-radius: 0;
    /* The shrink lives on the pre, not the inner code: strut and inline
       box then share one font size, so each line box is exactly
       --_code-line and the capsule height stays exact. */
    font-size: 0.85em;
    /* Long lines scroll inside the block (the container's overflow:hidden
       would clip them for good). The header pill stays put: it is a child
       of the non-scrolling container. Same pattern as headless pre/tables. */
    overflow-x: auto;
}
/* Direct child only — a pre inside .code-block keeps its own zero-radius
   rule above and lets the container's clipping own the shape. */
.bubble.md > pre {
    font-family: var(--font-mono);
    font-size: 0.85em;
    background: var(--md-sys-color-surface-container-lowest);
    color: var(--md-sys-color-on-surface);
    /* Same capsule recipe as .code-block: line + 2 paddings = 2 × radius. */
    --_code-line: 1.25rem;
    padding: calc((2 * var(--_code-r) - var(--_code-line)) / 2) 1em;
    /* Headless code blocks share the .code-block radius so the bubble's
       concentric corner math covers both kinds. */
    border-radius: var(--_code-r);
    overflow-x: auto;
    margin: 0.6em 0;
    line-height: var(--_code-line);
}
.bubble.md pre code {
    background: transparent; padding: 0;
    font-size: inherit;
    /* Zero the inline-chip radius too: as a block box it would otherwise
       carry .bubble.md code's 0.25rem corners (invisible with a transparent
       background, but it reads as a rounded box nested in the block). */
    border-radius: 0;
    /* Block-level inner box: while the code is an inline box, its half-leading
       is unioned with the pre's OWN strut (a different font size), and their
       baseline-aligned union made the line box 22px instead of --_code-line
       (20px) — the single-line capsule then measured 42 instead of
       2 × --_code-r (40). As a block it carries its own strut, so each line
       is exactly --_code-line again and the capsule is exact. */
    display: block;
}
/* Tables. The SCROLL CONTAINER — not the table — is the rounded plate, the
   same pattern as .code-block. The reason is the corner math: the plate spans
   the bubble's content width always, so the table can never shrink it. A
   shrunk plate loses the concentric relation (its corners would sit at insets
   the bubble's arcs don't answer: with fit-content a narrow table pulled the
   right edge inward and the two 20px arcs no longer matched the bubble's 32px
   one on both sides). A genuinely wide table still scrolls INSIDE the plate.
   No inline margins (the prose-inset rule above leaves tables out), so the
   gap is the bubble's 0.75rem padding on both axes and the radius is
   --_code-r = 32 − 12: the arcs then share the bubble corner's centre. */
/* Two classes (not .bubble.md …): the edge-zeroing rules above
   (.bubble.md > :first-child / :last-of-type) are three-class specific and
   must out-rank this one, exactly like .bubble .code-block — a table at the
   bubble's top/bottom edge then sits 12px from it on BOTH axes and is
   concentric; a mid-content one keeps the block rhythm. */
.bubble .table-scroll {
    overflow-x: auto;
    border-radius: var(--_code-r);
    margin: 0.6em 0;
}
.bubble.md table {
    border-collapse: collapse;
    font-size: 0.9em;
    /* Fill the plate: narrow tables stretch so every band reaches the rounded
       edge on both sides; wide ones grow past 100% (a table never shrinks
       below min-content) and the wrapper scrolls them. (Unbreakable tokens —
       long paths, code spans — are what force the overflow.) */
    width: 100%;
}
/* Bands, not hairlines: every row carries a shade, and no shade equals the
   bubble behind the plate. A transparent row (the old body cells were) shows
   the bubble's own colour and the plate's rounded corners vanish with it —
   the top and bottom rows must be painted for the shape to read. */
.bubble.md th, .bubble.md td {
    border: none;
    padding: 0.4em 0.7em;
    text-align: left;
}
.bubble.md th { background: var(--md-sys-color-surface-container-highest); font-weight: 600; }
.bubble.md tbody tr:nth-child(odd) td { background: var(--md-sys-color-surface-container); }
.bubble.md tbody tr:nth-child(even) td { background: var(--md-sys-color-surface-container-lowest); }
.bubble.md hr {
    border: 0;
    border-top: 1px solid var(--md-sys-color-outline-variant);
    margin: 1em 0;
}

/* Thinking (Stage 2, m3e-expansion-panel) */
m3e-expansion-panel.thinking {
    display: block;
    max-width: var(--chat-max-width);
    width: 100%;
    /* Vertical spacing comes from #chat-log's flex gap alone — every block
       (bubbles, cards, timestamps) then sits the same distance apart no
       matter the neighbour. Extra margins would stack onto the gap and make
       card-adjacent pairs visibly wider than bubble-to-bubble. */
    margin: 0 auto;
    /* Capsule radius: exactly half the collapsed card's height (one
       0.85rem/1.4 header line + two 0.6rem paddings) — a one-line card is
       a stadium. Taller (open) states keep this same fixed radius; it is
       the shared token the flush header consumes too. */
    --_card-r: calc((0.85rem * 1.4 + 1.2rem) / 2);
    border-radius: var(--_card-r);
    /* The m3e-expansion-header the panel renders internally pins its height
       to --m3e-expansion-header-collapsed-height (default 48px) — ~10px
       taller than this card's one-line header (2 × --_card-r), which pushed
       the collapsed card off the exact-capsule shape (radius < half height).
       Pin it to the card's own metric; the open state too, so the header row
       never pads out. */
    --m3e-expansion-header-collapsed-height: calc(2 * var(--_card-r));
    --m3e-expansion-header-expanded-height: calc(2 * var(--_card-r));
    /* The header/body are FLUSH children of the card (the header's own
       0.85rem padding is the whole inset, and radii match with gap 0) — the
       same inset system the pre-m3e card had. m3e-expansion-header ships its
       own space300 left/right padding and m3e-expansion-panel adds a content
       padding on top, which pushed the text ~24px further in per side. Zero
       them so the app's padding is the only inset. */
    --m3e-expansion-header-padding-left: 0;
    --m3e-expansion-header-padding-right: 0;
    --m3e-expansion-panel-content-padding: 0;
    /* The panel's internal .base paints its own OPAQUE container color, which
       would bury the card background below (this card's secondary tint, the
       tool card's surface-container) — and leave a faint 1px seam where that
       opaque layer meets the app's rounded corner. Let the app's own
       background be the only paint. */
    --m3e-expansion-panel-container-color: transparent;
    /* No elevation: the pre-m3e card was a flat tinted surface. The component
       would otherwise paint an elevation shadow on its square-radius .base,
       which the host clip turns into a faint hairline at the right edge. */
    --m3e-expansion-panel-elevation: none;
    --m3e-expansion-panel-open-elevation: none;
    /* A whisper of secondary tint marks "model reasoning" apart from the
       neutral tool-call cards it sits between — expressive, but the body
       text stays on the mixed (mostly neutral) surface. */
    background: color-mix(in srgb, var(--md-sys-color-secondary-container) 30%, var(--md-sys-color-surface-container));
    overflow: hidden;
}
.thinking .thinking-header {
    display: flex; align-items: center;
    cursor: pointer;
    /* Identical box metrics to .tool-header (same padding, font-size and
       explicit line-height) so both collapsed cards are one height. */
    padding: 0.6rem 0.85rem;
    font-size: 0.85rem;
    line-height: 1.4;
    color: var(--md-sys-color-on-surface-variant);
    font-weight: 500;
    user-select: none;
    /* Flush child of the collapse (through the collapse-item wrapper, so
       "inherit" would resolve against that — set the pair explicitly):
       concentric with gap 0 means equal radii. One radius for both states —
       the card keeps its collapsed stadium shape when expanded. */
    border-radius: var(--_card-r);
}
/* Pure-CSS chevron. An L of side s and stroke t has its centroid
   0.25*(s-t) toward the corner, so the shape is pulled back by that
   amount in its own frame before rotating - the visual mass, not the
   box, lands on the flex centerline. */
.thinking .thinking-header {
    --_chev-shift: calc((0.4rem - 1.5px) / -4);
}
.thinking .thinking-header::before {
    content: '';
    width: 0.4rem; height: 0.4rem;
    border-right: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    transform: rotate(-45deg) translate(var(--_chev-shift), var(--_chev-shift));
    transition: transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1);
    transition: transform 350ms var(--m3e-spring-fast);
    margin-right: 0.55em;
    flex-shrink: 0;
}
m3e-expansion-panel.thinking[open] .thinking-header::before { transform: rotate(45deg) translate(var(--_chev-shift), var(--_chev-shift)); }
/* The live loading indicator sits where the old ✻ glyph was: sized to the
   header's em (the component default is 38px) and tinted with the header ink
   so it reads as part of the row, not an imported foreign object. */
.thinking .thinking-spin {
    flex-shrink: 0;
    margin-right: 0.55em;
    --m3e-loading-indicator-size: 1.1em;
    --m3e-loading-indicator-active-indicator-color: var(--md-sys-color-on-surface-variant);
}
.thinking-body {
    margin: 0;
    padding: 0.5rem 1rem 0.85rem;
    /* Reasoning prose, not code — inherit the system default (explicit
       because the element is a <pre>, whose UA font would win). */
    font-family: inherit;
    font-size: 0.82rem;
    line-height: 1.5;
    color: var(--md-sys-color-on-surface-variant);
    white-space: pre-wrap;
    word-wrap: break-word;
    max-height: 16rem;
    overflow-y: auto;
}

/* Tool-call (Stage 2, m3e-expansion-panel) */
m3e-expansion-panel.tool-call {
    display: block;
    max-width: var(--chat-max-width);
    width: 100%;
    /* Same rule as .thinking: #chat-log's flex gap owns the vertical rhythm.
       Same capsule radius token too — both collapsed cards are identical
       stadiums. */
    margin: 0 auto;
    --_card-r: calc((0.85rem * 1.4 + 1.2rem) / 2);
    border-radius: var(--_card-r);
    /* Same exact-capsule pin as .thinking: the panel's internal
       m3e-expansion-header would otherwise hold the collapsed card at its
       48px default instead of one header line (2 × --_card-r). */
    --m3e-expansion-header-collapsed-height: calc(2 * var(--_card-r));
    --m3e-expansion-header-expanded-height: calc(2 * var(--_card-r));
    /* Same flush-child inset as .thinking — drop the component's own
       header/content horizontal padding so the header's 0.85rem (and the
       diff/result rows' padding) is the only inset. */
    --m3e-expansion-header-padding-left: 0;
    --m3e-expansion-header-padding-right: 0;
    --m3e-expansion-panel-content-padding: 0;
    /* Same as .thinking: let the card's own surface-container paint instead
       of the component's opaque .base layer, and drop the component's
       elevation shadow. */
    --m3e-expansion-panel-container-color: transparent;
    --m3e-expansion-panel-elevation: none;
    --m3e-expansion-panel-open-elevation: none;
    background: var(--md-sys-color-surface-container);
    overflow: hidden;
}
m3e-expansion-panel.tool-call.error {
    background: color-mix(in srgb, var(--md-sys-color-error-container) 35%, var(--md-sys-color-surface-container));
}
.tool-call .tool-header {
    cursor: pointer;
    padding: 0.6rem 0.85rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    line-height: 1.4;
    user-select: none;
    /* Flush child of the collapse — same concentric pair as the thinking
       header (explicit, since the collapse-item wrapper breaks "inherit").
       One radius for both states, matching the thinking card. */
    border-radius: var(--_card-r);
}
.tool-call .tool-header {
    --_chev-shift: calc((0.4rem - 1.5px) / -4);
}
.tool-call .tool-header::before {
    content: '';
    width: 0.4rem; height: 0.4rem;
    border-right: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    transform: rotate(-45deg) translate(var(--_chev-shift), var(--_chev-shift));
    transition: transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1);
    transition: transform 350ms var(--m3e-spring-fast);
    margin-right: 0.1em;
    flex-shrink: 0;
}
m3e-expansion-panel.tool-call[open] .tool-header::before { transform: rotate(45deg) translate(var(--_chev-shift), var(--_chev-shift)); }
.tool-label {
    flex: 1;
    font-size: 0.85rem;
    color: var(--md-sys-color-on-surface);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
}
.tool-badge {
    flex-shrink: 0;
    font-size: 0.75rem;
    padding: 0.1rem 0.4rem;
    border-radius: var(--md-sys-shape-corner-extra-small);
    background: var(--md-sys-color-tertiary-container);
    color: var(--md-sys-color-on-tertiary-container);
}
.tool-elapsed {
    flex-shrink: 0;
    font-size: 0.75rem;
    color: var(--md-sys-color-on-surface-variant);
}
/* The result area (result text + diff) is ONE inset, concentric plate rather
   than a full-bleed surface: it floats inside the card with a 0.6rem gap on
   the left/right/bottom and sits flush under the header. Its radius is the
   card radius minus that gap, so the bottom arcs share a centre with the
   card's (the concentric rule). It is empty until a result arrives, hence the
   :empty hide — an empty body would paint a bare 0.6rem strip. */
.tool-body {
    background: var(--md-sys-color-surface-container-lowest);
    /* margin, not padding: padding would leave the background full-bleed and
       only inset the text. The margin insets the whole plate. */
    margin: 0 0.6rem 0.6rem;
    border-radius: calc(var(--_card-r) - 0.6rem);
    overflow: hidden;
}
.tool-body:empty { display: none; }
.tool-diff {
    /* Both children are transparent and share the .tool-body plate. Each one
       carries the SAME roomy padding on all four sides, so the text sits an
       equal 0.75rem from the plate's edges (the plate's top/bottom inset
       comes from the first and last child's own padding). */
    padding: 0.75rem;
    background: transparent;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    line-height: 1.45;
    overflow-x: auto;
    max-height: 14rem;
    overflow-y: auto;
}
.tool-result {
    margin: 0;
    /* Transparent: the shared .tool-body plate carries the surface. Equal,
       roomy padding on all four sides gives the terminal output breathing
       room and matches .tool-diff's inset. */
    padding: 0.75rem;
    background: transparent;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    line-height: 1.45;
    white-space: pre-wrap;
    word-wrap: break-word;
    max-height: 18rem;
    overflow: auto;
    color: var(--md-sys-color-on-surface-variant);
}
.avatar {
    width: 2.25rem; height: 2.25rem;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.15rem; flex-shrink: 0;
}
/* Both avatars are library shapes now: the user gets the M3 arch, pi keeps
   the 4-leaf-clover flower (see makeAvatar). m3e-shape clips its children,
   so each role's tonal surface lives on the inner fill element. */
m3e-shape.avatar { font-size: 1.15rem; }
m3e-shape.avatar .avatar-fill {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    /* π's flower in tertiary-container — the third voice of the expressive
       triad (user = primary arch, composer = filled primary). */
    background: var(--md-sys-color-tertiary-container);
    color: var(--md-sys-color-on-tertiary-container);
}
m3e-shape.avatar .avatar-fill.user {
    background: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
}
m3e-shape.avatar .avatar-fill.error {
    background: var(--md-sys-color-error-container);
    color: var(--md-sys-color-on-error-container);
}
/* Circle fallback while the shape module is still loading. */
m3e-shape.avatar:not(:defined) .avatar-fill { border-radius: 50%; }
#input-bar {
    display: flex; flex-direction: column; gap: 0.5rem;
    align-items: stretch;
    padding: 0.75rem var(--col-pad) calc(var(--safe-bottom) + 1rem);
    /* Row 4 of #main-col, floated OVER the chat wrapper that now spans every
       row (the wrapper is positioned, so z-index is what decides it). Both
       axes must be explicit: with only a row, auto column placement reads the
       wrapper's span as an occupied cell and parks this row in an implicit
       auto-sized column instead — the chat then collapses to nothing. The
       band's own height is what JS publishes as --_composer-h. */
    grid-column: 1;
    grid-row: 4;
    position: relative;
    z-index: 40;
    /* No plate. The footer used to paint surface-container as a band behind the
       old text field, but the composer is now a floating capsule that carries
       its OWN opaque surface (#composer-pill), so the band only read as a tray
       it was sitting in. The drag-over state still paints, explicitly. */
    background: none;
    width: 100%;
    box-sizing: border-box;
}
/* The flat action buttons have no container to dim, so their disabled state is
   carried by the icon alone — the same 0.38 the previous tonal paperclip used. */
m3e-icon-button#gallery-btn:disabled,
m3e-icon-button#add-btn:disabled,
m3e-icon-button#model-btn:disabled {
    opacity: 0.38;
}
/* Drag-and-drop affordance: the whole footer lifts to primary-container while
   files are hovering over it. */
#input-bar.dragging {
    background: var(--md-sys-color-primary-container);
    outline: 2px dashed var(--md-sys-color-primary);
    outline-offset: -6px;
}
/* The drop hint has to be translated, and ::after content cannot call t().
   attr() reads an attribute of the HOST, so the text is carried on
   #input-bar itself and re-stamped by the locale sweep (data-i18n-drag), with
   the fallback below covering the moment before the first sweep runs. */
#input-bar.dragging::after {
    content: attr(data-drag-text);
    position: absolute;
    inset: 0;
    display: flex; align-items: center; justify-content: center;
    color: var(--md-sys-color-on-primary-container);
    font-weight: 600; font-size: 0.9rem;
    pointer-events: none;
    background: color-mix(in srgb, var(--md-sys-color-primary-container) 88%, transparent);
}
/* Attachment tray: a horizontal strip of chips/thumbnails above the field. */
#attach-tray {
    display: none;
    gap: 0.5rem;
    align-items: stretch;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 2px;
    scrollbar-width: none;
}
#attach-tray.show { display: flex; }
#attach-tray::-webkit-scrollbar { display: none; }
.attach-chip {
    position: relative;
    display: flex; align-items: center; gap: 0.4rem;
    flex: 0 0 auto;
    max-width: 11rem;
    padding: 0.35rem 2rem 0.35rem 0.6rem;
    /* The chip and everything clipped to its corner share one radius, and the
       remove button's position is DERIVED from it (see .attach-remove): a
       circle dropped on a rounded corner is concentric only when its centre
       lands on the corner arc's centre, i.e. r_chip − r_btn from the edge. */
    --_chip-r: var(--md-sys-shape-corner-large);
    --_remove-r: 0.7rem;
    --_remove-inset: calc(var(--_chip-r) - var(--_remove-r));
    border-radius: var(--_chip-r);
    background: var(--md-sys-color-surface-container-highest);
    color: var(--md-sys-color-on-surface);
    font-size: 0.8rem;
    line-height: 1.2;
}
.attach-chip .attach-name {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.attach-chip .attach-size {
    color: var(--md-sys-color-on-surface-variant);
    font-size: 0.72rem;
    flex: 0 0 auto;
}
.attach-chip.thumb {
    width: 4.5rem; height: 4.5rem;
    padding: 0;
    justify-content: center;
    background: transparent;
}
.attach-chip.thumb img {
    /* Gap to its chip is zero, so the radii are equal by definition — and
       inherit keeps them locked together if --_chip-r ever changes. */
    width: 100%; height: 100%;
    object-fit: cover;
    border-radius: inherit;
    display: block;
}
/* Concentric with the chip's corner arc: the button is a circle of radius
   --_remove-r whose centre sits --_remove-inset in from the corner, so
   r_chip − r_remove == inset on both axes and the two arcs share a centre.
   (The old 0.1rem inset put the circle's centre 3.2px off that centre, which
   is why it read as pasted on rather than sitting IN the corner.) */
.attach-chip .attach-remove {
    position: absolute;
    top: var(--_remove-inset); right: var(--_remove-inset);
    width: calc(2 * var(--_remove-r)); height: calc(2 * var(--_remove-r));
    min-width: 0;
    border: none;
    border-radius: 50%;
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
    box-shadow: 0 1px 3px rgba(0,0,0,.35);
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.85rem; line-height: 1;
    padding: 0;
}
.attach-chip .attach-remove:hover { background: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container); }
.attach-chip.uploading { opacity: 0.6; }
/* Attachments inside a committed user bubble.
   Three nested rounded surfaces here, each concentric with its parent:
     bubble  (r = _code-r + pad, padded 12px)
       └ card (r = _code-r, in that 12px gutter)
           └ thumb/img (r = _code-r − card padding, inset by card padding)
   The user bubble pads its prose 24px horizontally for a roomier read, but a
   card in a 24px gutter could never be concentric with a 32px corner (the
   radius would have to be 8px, a shape the M3 scale does not have and one that
   reads as a square inside a round bubble). So the strip pulls itself back to
   the 12px gutter instead — the same gutter code blocks use — and every corner
   then obeys r_outer − r_inner == gap. */
.bubble .bubble-attachments {
    display: flex; flex-wrap: wrap; gap: 0.4rem;
    /* Natural heights only: the default stretch made a one-line file chip as
       tall as the photo beside it, which turned a capsule into a slab and put
       its 20px arcs nowhere near the bubble's corners. */
    align-items: flex-start;
    margin-top: 0.5rem;
    /* The card's inner padding lives HERE, not on the card: the image's radius
       is derived from it (r_card − r_card_pad) and the image is the card's
       descendant, so the property must sit on a shared ancestor. */
    --_card-pad: 0.25rem;
}
/* Only the USER bubble over-pads its prose; cancel exactly that surplus so the
   cards sit in the 12px corner gutter. An assistant bubble already pads 12px,
   so there is nothing to cancel and the rule stays off it. */
.msg.user .bubble .bubble-attachments {
    margin-left: calc(var(--_bubble-pad) - 1.5rem);
    margin-right: calc(var(--_bubble-pad) - 1.5rem);
}
/* First block: the strip becomes the bubble's first child, so it must start on
   the padding line (which is the gutter the corner math uses) rather than keep
   the prose's 8px top margin. */
.bubble .bubble-attachments:first-child { margin-top: 0; }
/* Card = file chip and image tile alike: one radius, --_code-r (20px), which
   is the bubble's 32px minus the 12px gutter. */
.bubble .bubble-attachments a {
    display: flex; align-items: center; gap: 0.35rem;
    max-width: 14rem;
    padding: var(--_card-pad) 0.55rem;
    border-radius: var(--_code-r);
    background: color-mix(in srgb, var(--md-sys-color-on-primary-container) 8%, transparent);
    color: inherit; text-decoration: none;
    font-size: 0.8rem;
    overflow: hidden;
}
.bubble .bubble-attachments a:hover { text-decoration: underline; }
.bubble .bubble-attachments a .fname {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
/* The image card is the thumbnail's frame: it pads --_card-pad, so the image's
   corner must be the card's radius MINUS that padding to stay concentric.
   The card must SHRINK-WRAP its thumbnail so its padding is exactly
   --_card-pad on all four sides (the strip is align-items:flex-start, so no
   row-stretch can pad it unevenly). line-height:0 kills the inline baseline
   gap a block image would otherwise leave under itself. */
.bubble .bubble-attachments a.image-card {
    padding: var(--_card-pad);
    border-radius: var(--_code-r);
    line-height: 0;
}
.bubble .bubble-attachments img {
    display: block;
    max-width: min(18rem, 100%);
    max-height: 14rem;
    border-radius: calc(var(--_code-r) - var(--_card-pad));
    /* A stray inline baseline gap would break the frame's symmetry. */
    vertical-align: middle;
}
/* The filled variant reserves the floating-label row at the TOP of its content
   box (24px) while .base keeps only 8px below the text. This field has no label,
   so nothing ever fills that row and the text sat 8px below the optical centre
   (measured above/below = 24/8 inside the 56px visible field). A margin PAIR —
   not a transform, which would blur the glyphs — lifts the text by the
   imbalance (24 − 8) / 2 = 8px and leaves the field's own height untouched;
   that also holds when the autosize component grows it, where the text block
   then sits 16/16.

   min-height MUST be a full line box. m3e-textarea-autosize measures one line
   by cloning the control into a hidden node (a clone carrying none of this
   stylesheet, and with its padding forced to "2px 0") and subtracting a
   hardcoded 4px. That clone measures 19px here, so the EMPTY field was set to
   height:19px — 5px short of the 24px line-height. The text then overflowed
   its own box by 5px, the form-field clipped the descender, and the placeholder
   sat visibly low. 1lh pins the control to exactly one line while leaving the
   component free to grow it to N lines. (It is not 24px: 1lh follows the
   textarea's own line-height, so a theme or font change cannot desync them.) */
#input {
    flex: 1; min-width: 0; width: 100%;
    margin-top: -8px; margin-bottom: 8px;
    /* MUST be !important: the component writes min-height/height as an INLINE
       style on the control, so a plain declaration here loses no matter how
       specific it is. Only min-height is forced — height keeps following the
       component's measurements, which is what makes it grow line by line. */
    min-height: 1lh !important;
}
/* An EMPTY field is one line tall, whatever the hint says. The autosize clone
   measures the placeholder too (it stands in for the value while the field is
   empty), so on a phone — where the composer is only 114px wide because the
   action group and the trailing disc take the rest — 'type a message…
   (/ 查看命令)' wrapped onto three lines and the empty bar stood 120px high
   instead of a 72px capsule. The reference pins this with maxLines = 1 on its
   placeholder text; :placeholder-shown is the same contract, and it stops
   matching the moment there is a value, so real text still grows to six lines.
   !important for the same reason as above: the height is an inline style. */
#input:placeholder-shown {
    height: 1lh !important;
}
/* …but that clamp only covers the EMPTY state, and the component's own number is
   stale in a way the clamp cannot hide: its clone measures the placeholder at
   whatever width the field happens to have at that moment, so on a phone the
   hint wraps to three lines at the pre-compact 114px and writes height:72px —
   which then survives into a one-word draft, since the component only ever
   grows from there. The bar stood 120px tall for a single CJK character. Where
   the platform can size a control to its content, let it: the value drives the
   height, the hint never does, and the autosize component is left in charge of
   nothing. min-height and the max-rows cap stay ours. */
@supports (field-sizing: content) {
    #input {
        field-sizing: content;
        height: auto !important;
        max-height: calc(6 * 1lh);
    }
}
/* The flex child of the bar is the m3e-form-field WRAPPER, not the inner
   #input textarea. The wrapper must grow to fill the row; otherwise it keeps
   its intrinsic width and leaves a gap beside the send button. (#input's own
   flex:1 only governs the textarea inside the wrapper.)
   At the component's default density the visible field is 56px (the height the
   old MDUI text-field had, and what reads as "normal"), but the host is 76px:
   the extra ~20px is the form-field's RESERVED supporting-text row at the
   bottom (16px body-small line-height + 4px margin). This field never shows a
   supporting/error/hint line, so the row is pure dead space — and it is what
   made the buttons look taller than the box they sit beside.
   hide-subscript="always" removes it at the source (the component's own
   state, so the host equals the visible box exactly); the line-height token is
   zeroed as well, belt-and-braces, because the collapsed row's 4px margin is
   not a token and older builds of the component drop the attribute's effect.
   Density is left at default on purpose: density:-3 had shrunk the VISIBLE
   field to 44px, which looked too short. Scoped to this host only. */
#composer-pill > m3e-form-field {
    flex: 1 1 auto;
    min-width: 0;
    --md-sys-typescale-body-small-line-height: 0px;
    /* One painted surface only: the pill behind already IS the inner capsule,
       so the field's own container is transparent — otherwise the field's
       radius (the library's extraLarge) and the pill's derived 28 would be two
       different arcs, and a second layer would sit over the first. */
    --m3e-form-field-container-color: transparent;
    /* No underline, in any state. The filled variant draws it as .base::before's
       bottom border — 1px from --m3e-form-field-outline-color at rest, 3px from
       --m3e-form-field-focused-outline-color once the field has focus or is
       pressed. A floating capsule has nothing to underline (the reference sets
       its indicator colours to transparent), so both are zeroed. */
    --m3e-form-field-outline-color: transparent;
    --m3e-form-field-focused-outline-color: transparent;
    /* …and in the states the library assigns NOTHING (blocked/disabled field)
       the border colour falls back to currentColor, i.e. the 38%-onSurface grey.
       The internal property is only ever set ON .base by the rules above, so a
       value declared here is inherited in every other state and covers them all. */
    --_form-field-outline-color: transparent;
    /* No grey press/hover region. Two separate paints: the hover wash (.base::after,
       onSurface at 8% — drawn as a SQUARE, since that layer carries no radius, so
       it would also break the capsule's arcs) and the disabled container block
       (onSurface at 4% on .base::before, visible whenever a prompt is pending or
       the socket is down). Both are read inside a color-mix, so naming them
       transparent removes the mix itself. */
    --m3e-form-field-hover-container-color: transparent;
    --m3e-form-field-disabled-container-color: transparent;
}
/* Expressive send button: a filled primary circle — the composer's one
   loud accent, stacked in the pill's corner. running/armed retarget the
   primary tokens to the error palette (armed is full error). */
m3e-icon-button#send-btn.running {
    --md-sys-color-primary: var(--md-sys-color-error-container);
    --md-sys-color-on-primary: var(--md-sys-color-on-error-container);
}
m3e-icon-button#send-btn.armed {
    --md-sys-color-primary: var(--md-sys-color-error);
    --md-sys-color-on-primary: var(--md-sys-color-on-error);
}
#reconnect-overlay {
    position: fixed; inset: 0;
    /* Scrim is M3-black by design; its text is always white — the only
       non-token pair here, deliberate per the M3 scrim spec. */
    /* m3e-theme emits FULL COLOR VALUES (#rrggbb), not "r, g, b" triplets, so
       rgb(var(--md-sys-color-scrim) / .6) is invalid CSS and silently dropped
       the scrim — leaving the white text floating on the bare surface and
       practically invisible in light mode. color-mix handles hex tokens. */
    background: color-mix(in srgb, var(--md-sys-color-scrim) 60%, transparent);
    color: #fff; font-weight: 500;
    display: none;
    align-items: center; justify-content: center;
    z-index: 200;
}
#reconnect-overlay.show { display: flex; }

/* ───────── Stage 3: held bar, status panel, bell, prompt card, etc. ───────── */
#held-bar {
    display: none;
    align-items: center; gap: 0.5rem;
    padding: 0.5rem var(--col-pad);
    /* Row 3, floated over the chat alongside the composer (see #input-bar). */
    grid-column: 1;
    grid-row: 3;
    position: relative;
    z-index: 40;
    background: var(--md-sys-color-tertiary-container);
    color: var(--md-sys-color-on-tertiary-container);
    width: 100%;
    box-sizing: border-box;
    font-size: 0.85rem;
}
#held-bar #held-label { font-weight: 600; }
#held-bar #held-text {
    flex: 1; font-style: italic;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
m3e-icon-button#held-clear {
    /* The component paints from its own token chain, not host color — match
       the held text it sits next to (the bar is tertiary-container). */
    --md-sys-color-on-surface-variant: var(--md-sys-color-on-tertiary-container);
}

/* Live-task panel as an expressive color block: secondary-container reads
   as "the agent is working now" — the held bar (tertiary) stays distinct. */
m3e-card#status-panel {
    display: none;
    box-sizing: border-box;
    width: 100%;
    padding: 0.6rem var(--col-pad);
    /* Row 2, the top of the band the chat runs behind (see #input-bar). */
    grid-column: 1;
    grid-row: 2;
    position: relative;
    z-index: 40;
    border-radius: 0;
    font-size: 0.85rem;
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
}
#status-panel.structured .widget-title { font-weight: 600; margin-bottom: 0.3rem; }
#status-panel.structured .widget-meta {
    display: flex; gap: 0.6rem; align-items: center;
    color: color-mix(in srgb, var(--md-sys-color-on-secondary-container) 82%, transparent);
    font-size: 0.78rem; margin-bottom: 0.4rem;
}
/* Phase chip matches the app bar's status pill: a stroke-free tonal pill
   (mdui-chip's own look is a hairline-outlined assist chip). On the
   secondary field it goes translucent so the block reads through. */
#status-panel .widget-phase {
    font-size: 0.78rem;
    border: none;
    border-radius: 999px;
    background-color: color-mix(in srgb, var(--md-sys-color-on-secondary-container) 14%, transparent);
    color: var(--md-sys-color-on-secondary-container);
}
/* Wavy determinate indicator — the M3 Expressive signature — rendered by
   @m3e/web's <m3e-linear-progress-indicator variant="wavy"> (loaded from
   esm.sh; mdui 2.x has no Expressive components). Its color tokens are
   scoped here so light/dark follow the same palette; on the secondary
   field the track goes translucent rather than one-tonal-up. */
#status-panel m3e-linear-progress-indicator.widget-bar {
    display: block;
    width: 100%;
    margin: 0.15rem 0 0.3rem;
    --md-sys-color-primary: var(--md-sys-color-on-secondary-container);
    --md-sys-color-secondary-container: color-mix(in srgb, var(--md-sys-color-on-secondary-container) 22%, transparent);
    --md-sys-color-on-surface-variant: var(--md-sys-color-on-secondary-container);
}
@media (prefers-reduced-motion: reduce) {
    m3e-button, m3e-icon-button { transition: none; }
}
#status-panel.structured .widget-action {
    font-family: var(--font-mono); font-size: 0.78rem;
    color: color-mix(in srgb, var(--md-sys-color-on-secondary-container) 82%, transparent);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ── Wide screens: the anchored dropdowns (the app's original form) ──
   These three are the rules the app used before the bottom sheets existed,
   kept verbatim: a fixed card under the app-bar button, its own shadow and its
   own corner. They apply at every width by default; the narrow-screen block
   below hides them in favour of the sheets.
   The corner is concentric with the segmented rows the card wraps: the library
   paints a 16px group corner (--md-sys-shape-corner-large) and the row plate
   ends --_gap short of the card edge, so the card arc is the two added and both
   arcs share one centre. --_gap feeds the padding too, so the sum cannot drift
   if either number changes. 28px sat 4px too round next to those rows. */
#notif-panel {
    --_row-r: var(--md-sys-shape-corner-large);
    --_gap: 0.5rem;
    position: fixed;
    top: calc(var(--safe-top) + var(--_topbar-h));
    right: 3.6rem;
    width: min(320px, calc(100vw - 4.6rem)); max-height: 60vh;
    background: var(--md-sys-color-surface-container-high);
    border-radius: calc(var(--_row-r) + var(--_gap));
    box-shadow: 0 4px 8px 3px rgba(0,0,0,.3);
    padding: var(--_gap);
    display: none;
    flex-direction: column; gap: 0.4rem;
    z-index: 60;
    overflow: hidden;
    /* Rounded rectangle mask shield: clips scrolling content to the card's
       rounded corners so partially visible rows never show straight edges. */
}
#notif-panel::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: calc(var(--_row-r) + var(--_gap));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--md-sys-color-outline) 30%, transparent);
    pointer-events: none;
    z-index: 10;
}
#notif-panel.open { display: flex; }
#settings-panel {
    --_row-r: var(--md-sys-shape-corner-large);
    --_gap: 0.5rem;
    position: fixed;
    top: calc(var(--safe-top) + var(--_topbar-h));
    right: 0.5rem;
    width: min(320px, calc(100vw - 1rem));
    background: var(--md-sys-color-surface-container-high);
    border-radius: calc(var(--_row-r) + var(--_gap));
    box-shadow: 0 4px 8px 3px rgba(0,0,0,.3);
    padding: var(--_gap);
    display: none;
    flex-direction: column; gap: 0.4rem;
    z-index: 60;
    overflow: hidden;
}
#settings-panel.open { display: flex; }
#model-menu {
    --m3e-menu-container-color: var(--md-sys-color-surface-container-high);
    --m3e-menu-container-elevation: 0 4px 8px 3px rgba(0,0,0,.3);
    --m3e-menu-container-max-height: 55vh;
}
/* The composer's attachment menu is the same anchored surface. It stays a menu
   at every width — it opens from the input bar, not from the app bar, so it has
   no bottom-sheet twin. */
#add-menu {
    --m3e-menu-container-color: var(--md-sys-color-surface-container-high);
    --m3e-menu-container-elevation: 0 4px 8px 3px rgba(0,0,0,.3);
}
.add-item { display: inline-flex; align-items: center; gap: 0.5rem; }
.add-item m3e-icon { font-size: 1.1rem; }

/* ── Narrow screens: the same three as modal bottom sheets ──
   The dropdown cards are hidden outright (display:none, not just off-screen:
   they are position:fixed and would otherwise keep a hit area), and the sheets
   take over. Only the sheet's container colour is set here — the surface,
   elevation, slide-in, scrim and drag handle are all the component's own, so
   there is no chrome to restate. */
@media (max-width: 600px) {
    #notif-panel,
    #settings-panel,
    #model-menu { display: none !important; }
    #notif-sheet,
    #settings-sheet,
    #model-sheet {
        --m3e-bottom-sheet-container-color: var(--md-sys-color-surface-container-high);
    }
}
#notif-toggle-row,
#notif-sheet-toggle-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.4rem 0.6rem;
    font-size: 0.9rem;
}
/* Row labels never fold. CJK text may break between any two characters, so a
   bare <span> label's min-content is ONE glyph: in these flex rows the label
   then lost the shrink race to its control and 「通知」 folded onto two lines.
   nowrap lifts the label's min-content to its whole width. Scoped to the
   labels so no control inherits it. */
#notif-toggle-row > span,
#notif-sheet-toggle-row > span { white-space: nowrap; }
#settings-title { font-weight: 600; padding: 0.4rem 0.6rem; font-size: 0.9rem; }
/* The row labels are the items' own light DOM, so this reaches them. CJK text
   may break between any two characters, and a folded 主题色 reads as a bug. */
.settings-row > span { white-space: nowrap; }
#notif-title,
#notif-sheet-title { font-weight: 600; font-size: 0.9rem; }

/* Theme-color swatch: shows the literal seed it stands for, both on the
   settings row's button and inside each accent-menu item. A swatch is the one
   place a hardcoded color is the content, not the chrome, so it keeps the
   seed's own value; the hairline ring is what makes a pale seed readable on a
   pale surface. */
.accent-swatch {
    display: inline-block; flex: none;
    width: 0.9rem; height: 0.9rem;
    border-radius: 50%;
    vertical-align: -0.12rem;
    margin-inline-end: 0.35rem;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--md-sys-color-outline) 50%, transparent);
}
/* One wrapper per item: the menu item lays its default slot out as a flex row,
   so swatch and label must travel together to stay side by side. */
.accent-item { display: inline-flex; align-items: center; gap: 0.4rem; }
.accent-item m3e-icon { font-size: 1rem; }

#notif-list,
#notif-sheet-list {
    overflow-y: auto; flex: 1;
    font-size: 0.85rem;
    padding: 0;
    background: transparent;
}
.notif-item { word-wrap: break-word; white-space: normal; }
.notif-item.warning, .notif-item.error { color: var(--md-sys-color-error); }
#notif-empty {
    padding: 1rem;
    color: var(--md-sys-color-on-surface-variant);
    text-align: center;
    font-size: 0.85rem;
}

/* Model picker rows. The wide form is an m3e-menu of radio items (its tokens
   are declared with the other dropdowns above); the phone form is a scrollable
   segmented action list inside the sheet. */
#model-sheet-list { max-height: 55vh; overflow-y: auto; }
/* The sheet's rows are m3e-list-action items in a segmented action list, so
   their metrics, hover state, shape and focus ring are the component's. Only
   the current row's emphasis and the tick's colour are ours. */
.model-row.current .model-row-name { font-weight: 600; }
.model-row-check { color: var(--md-sys-color-primary); }
/* Two-line rows inside the plain radios: the item lays its default slot out
   as a flex row, so one block wrapper stacks the name over the provider.
   Font metrics (line-height, sizes, shape) stay the component's defaults. */
.model-row-main {
    display: block;
    min-width: 0;
}
.model-row-name {
    display: block;
    font-weight: 600;
}
.model-row-spec {
    display: block;
    font-size: 0.74rem;
    color: var(--md-sys-color-on-surface-variant);
}
#model-empty {
    padding: 1rem;
    color: var(--md-sys-color-on-surface-variant);
    text-align: center;
    font-size: 0.85rem;
}

/* Cmd suggestions (above input): a segmented m3e-list, exactly like the notif
   and settings lists. Row metrics, the plate each row paints, the corner family
   the segmented variant derives per position (first / middle / last) and the
   supporting-text line are all the component's own, so nothing is restated
   here. The list is the scroller — its host is overflow:auto natively — which
   is why the card neither scrolls nor carries a hand-drawn thumb any more. */
#cmd-suggestions {
    position: absolute;
    bottom: 100%;
    left: var(--col-pad);
    right: var(--col-pad);
    /* The composer is one capsule now (the send button lives inside it), so the
       panel spans the footer exactly and shares its 28px corner family. */
    margin-bottom: 0.25rem;
    background: var(--md-sys-color-surface-container-high);
    border-radius: var(--md-sys-shape-corner-extra-large);
    box-shadow: 0 2px 6px 2px rgba(0,0,0,.3);
    overflow: hidden;
    display: none;
    padding: 0.5rem;
    box-sizing: border-box;
}
/* The cap lives on the scroller. 55vh is the model sheet's own ceiling, and
   26rem is what shows every command on a desktop window without scrolling.
   App-wide the native bar is hidden and a hand-drawn thumb is overlaid instead;
   this scroller gets the platform's own behaviour back, which is one standard
   property — once scrollbar-width is not auto the browser ignores the
   ::-webkit-scrollbar rules entirely. */
#cmd-suggestions m3e-list {
    max-height: min(26rem, 55vh);
    scrollbar-width: thin;
}
#cmd-suggestions m3e-list-item { cursor: pointer; }
#cmd-suggestions m3e-list-item.active {
    --m3e-list-item-container-color: var(--md-sys-color-surface-container-highest);
}
/* Only the command name is emphasised; its description rides the component's
   supporting-text line at the library's own size and colour. */
#cmd-suggestions .cmd-name { font-weight: 600; }

/* Scroll-to-bottom (mdui-fab) */
m3e-fab#scroll-bottom {
    position: absolute;
    /* The wrapper reaches the viewport's bottom edge now, so the fab seats
       itself above the whole band instead of 1rem from the screen edge —
       which also keeps it out of the chat's dissolve. */
    bottom: calc(var(--_composer-h) + 1rem); right: var(--col-pad);
    /* Must out-rank the code-head pill (z-index: 1) — a code block at the
       bottom of the viewport otherwise floats its copy button over this. */
    z-index: 5;
    transform: scale(0) rotate(-45deg);
    opacity: 0;
    pointer-events: none;
    transition: transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease;
    transition: transform 400ms var(--m3e-spring-spatial), opacity 200ms ease;
    box-shadow: none;
}
m3e-fab#scroll-bottom.show {
    transform: scale(1) rotate(0deg);
    opacity: 1;
    pointer-events: auto;
}
m3e-fab#scroll-bottom.show:active { transform: scale(0.92) rotate(0deg); }

/* Turn-time divider */
.turn-time {
    max-width: var(--chat-max-width);
    width: 100%; margin: 0 auto;
    text-align: center;
    font-size: 0.7rem;
    color: var(--md-sys-color-on-surface-variant);
}
/* Timestamps are the same kind of metadata whatever the role — the bubbles
   already carry the role color, so all three stay muted. */
.turn-time.assistant { color: var(--md-sys-color-on-surface-variant); }
.turn-time.user { color: var(--md-sys-color-on-surface-variant); }
.turn-time.system { color: var(--md-sys-color-on-surface-variant); }

/* System note (centered, muted) */
.sysnote {
    max-width: var(--chat-max-width);
    width: 100%; margin: 0 auto;
    text-align: center;
    font-size: 0.78rem;
    color: var(--md-sys-color-on-surface-variant);
    background: var(--md-sys-color-surface-container);
    border-radius: 9999px;
    padding: 0.25rem 0.6rem;
    box-sizing: border-box;
    /* addSystemLine sets textContent, so without this a multi-line note
       (e.g. the /task-config settings table) collapses to one line. */
    white-space: pre-wrap;
}

/* Copy buttons: one circle per code block (in .code-head), one per finished
   assistant bubble (.bubble-copy). Both are identical 2rem circles carrying the
   same glyph; only their anchoring differs.
     - m3e-icon-button's HOST is the painted surface and — unlike the old
       mdui-button-icon — ships NO default corner radius, so the radius has to
       come from here (it wins over the component's :host styles).
     - The component's own surface (the shadow's .base), its state layer, ripple
       and focus ring take their HEIGHT from --m3e-icon-button-container-height
       (default 40px) while their WIDTH is 100% of the host: at a 2rem host that
       painted a 32×40 stadium — a vertical capsule — so the container is pinned
       to the host's own square.
     - The glyph is --m3e-icon-button-icon-size (default 24px) — 3/4 of a 2rem
       circle, which is what read as "the icon is too large" — so it drops to
       1.2rem (19.2px, the MD3 60% ratio against a 32px container).
     - The round shape is forced in every state: the pressed "shape morph" would
       otherwise swap the circle for a squircle mid-tap. */
.copy-btn {
    width: 2rem; height: 2rem;
    border-radius: 999px;
    background: var(--md-sys-color-surface-container-high);
    color: var(--md-sys-color-on-surface-variant);
    --m3e-icon-button-container-height: 2rem;
    --m3e-icon-button-icon-size: 1.2rem;
    --m3e-icon-button-shape-round: 999px;
    --m3e-icon-button-shape-square: 999px;
    --m3e-icon-button-shape-pressed-morph: 999px;
}
.copy-btn.copied { color: var(--md-sys-color-primary); }
.bubble-copy {
    position: absolute;
    /* Concentric with the bubble's top-right arc: the arc's center sits
       (code-r + 0.75rem pad, code-r + 0.75rem pad) in from the corner;
       subtract this button's 1rem radius per axis and the 2rem circle lands
       dead on that center — riding inside the big curve, not overhanging. */
    top: calc(var(--_code-r) - 0.25rem); right: calc(var(--_code-r) - 0.25rem);
    opacity: 0;
    transition: opacity 0.15s;
}
.msg.assistant:hover .bubble-copy, .msg.error:hover .bubble-copy { opacity: 1; }
/* Touch devices have no hover — keep the button faintly visible. */
@media (hover: none) { .bubble-copy { opacity: 0.55; } }

/* Prompt dialog (m3e-dialog) in the extra-large corner family (28px).
   Its inner boxes (rec-panel, text field, buttons) sit mid-content —
   never corner-aligned with the dialog's arcs — so the concentric rule
   (outer − inner = gap) does not bind them; they keep their own radii. */

#prompt-card .q, #session-delete-dialog .q { font-size: 0.95rem; line-height: 1.5; }
#prompt-card .rec-panel {
    display: none;
    margin-top: 0.85rem;
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
    padding: 0.75rem;
    border-radius: var(--md-sys-shape-corner-small);
}
#prompt-card .rec-label {
    font-size: 0.72rem;
    opacity: 0.7;
    margin-bottom: 0.3rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
#prompt-card .rec-text {
    font-size: 0.9rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-wrap: break-word;
}
#prompt-card .rec-text.md p:first-child { margin-top: 0; }
#prompt-card .rec-text.md p:last-child { margin-bottom: 0; }
#prompt-input { width: 100%; margin-top: 0.85rem; }
#prompt-buttons {
    display: flex; gap: 0.5rem; flex-wrap: wrap;
    justify-content: flex-end;
}
#prompt-buttons m3e-button.cancel { font-size: 0.85rem; }
`

export function mduiHtml(wsUrl: string): string {
    const iconSvg = encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">`
            + `<rect width="180" height="180" rx="38" fill="#6750a4"/>`
            + `<text x="90" y="130" font-family="Georgia,serif" font-size="100" `
            + `text-anchor="middle" fill="#ffffff">π</text></svg>`
    )
    const iconUrl = `data:image/svg+xml,${iconSvg}`
    const manifest = encodeURIComponent(
        JSON.stringify({
            name: 'pi-task remote',
            short_name: 'pi-task',
            display: 'standalone',
            background_color: '#fef7ff',
            theme_color: '#6750a4',
            icons: [{src: iconUrl, sizes: 'any', type: 'image/svg+xml'}]
        })
    )

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="pi-task">
  <meta name="theme-color" content="#6750a4">
  <link rel="apple-touch-icon" href="${iconUrl}">
  <link rel="manifest" href="data:application/manifest+json,${manifest}">
  <title>pi-task remote</title>

  <style>${CSS}</style>
</head>
<body>
  <div id="theme-host" style="display:contents">
    <m3e-theme id="app-theme" variant="tonal-spot" scheme="auto" color="#6750A4" style="display:contents">
  <div id="root">
    <m3e-drawer-container id="drawer" start-mode="over">
      <!-- Session sidebar: populated by the sessions frame, refreshed every
           time the drawer opens. -->
      <nav slot="start" id="session-drawer" data-i18n-aria="sessions" aria-label="会话列表">
        <div id="session-drawer-head">
          <span id="session-drawer-title" data-i18n="sessions">会话</span>
          <m3e-icon-button id="session-drawer-close" data-i18n-aria="close" aria-label="关闭"><m3e-icon name="close"></m3e-icon></m3e-icon-button>
        </div>
        <m3e-selection-list id="session-list" variant="segmented" data-i18n-aria="sessions" aria-label="会话" hide-selection-indicator></m3e-selection-list>
      </nav>

      <div id="main-col">
    <main id="chat-wrap">
      <!-- Single compact bar: identity/model + status + actions. mdui's
           top-app-bar drives the hide-on-scroll-down / show-on-scroll-up
           behavior against the chat log as its scroll target (M3E's app-bar
           has no scroll behavior, and the scroller is an inner element, so
           the attribute is set from JS after the DOM is parsed). -->
      <m3e-app-bar id="top-bar" variant="small" scroll-behavior="hide">
        <!-- M3E's app-bar has NO default slot — its content only renders when
           assigned to the named slots (leading / title / subtitle / trailing).
           The old MDUI shell used a single flex wrapper (\`bar-stack\`); M3E
           silently drops unassigned light children, so the bar came up empty
           until the content was re-homed into slots below. -->
        <div id="app-bar" slot="leading">
          <!-- Tonal: the menu opener gets a substrate plate like the trailing
               toggle group, so the two bar ends read as the same button family
               rather than a bare glyph floating on the bar. -->
          <m3e-icon-button id="menu-btn" variant="tonal" data-i18n-aria="sessions" aria-label="会话列表"><m3e-icon name="menu"></m3e-icon></m3e-icon-button>
          <span id="status-dot"></span>
        </div>
        <!-- Two-line identity readout, both ends informational: which
             conversation this is, and which model serves it. The model used to
             be a picker pill here; the composer's model button is the only
             entry point now, so nothing in the bar is clickable but the icons. -->
        <div id="app-title" slot="title"><span id="chat-title">π-task</span></div>
        <div id="app-subtitle" slot="subtitle">
          <span id="status-model" data-i18n="noModel">未选择模型</span>
          <span id="status-ctx"></span>
        </div>
        <div id="app-actions" slot="trailing">
          <!-- Grouped as a toggle pair WITHOUT multi: it is a radiogroup, so
               selecting one deselects the other — opening a panel closes the
               other (setNotifOpen/setSettingsOpen also enforce this in code, so
               the "pressed" fill is exactly the open indicator and never two at
               once). -->
          <m3e-button-group>
            <m3e-icon-button id="notif-btn" variant="tonal" toggle data-i18n-aria="notifications" aria-label="通知"><m3e-icon name="notifications"></m3e-icon></m3e-icon-button>
            <m3e-icon-button id="settings-btn" variant="tonal" toggle data-i18n-aria="settings" aria-label="设置"><m3e-icon name="settings"></m3e-icon></m3e-icon-button>
          </m3e-button-group>
        </div>
      </m3e-app-bar>
      <!-- Context-usage wave: a second row under the bar. M3E's small app-bar
           has no room for it, so it lives as an absolutely-positioned sibling
           in the band below the bar row (cleared by #chat-log's padding-top). -->
      <div id="ctx-stack">
        <div id="ctx-fallback" aria-hidden="true"><i></i></div>
        <m3e-linear-progress-indicator id="ctx-bar-flat" value="0" max="100"
          aria-hidden="true"></m3e-linear-progress-indicator>
        <m3e-linear-progress-indicator id="ctx-bar" variant="wavy" value="0" max="100"
          data-i18n-aria="contextUsage" aria-label="上下文用量"></m3e-linear-progress-indicator>
      </div>
      <div id="chat-log"></div>
      <m3e-fab id="scroll-bottom" variant="tertiary-container" size="small" lowered data-i18n-aria="jumpToBottom" data-i18n-title="jumpToBottom" aria-label="跳到底部" title="跳到底部"><m3e-icon name="arrow_downward"></m3e-icon></m3e-fab>
    </main>

    <!-- Status panel: shows structured task progress (phase / step / elapsed) -->
    <m3e-card id="status-panel" variant="filled" style="display:none"></m3e-card>

    <!-- Held input: lines typed while a task run owns the session -->
    <div id="held-bar" style="display:none">
      <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 20a8 8 0 1 0-8-8 8 8 0 0 0 8 8zm0-18a10 10 0 1 1-10 10A10 10 0 0 1 12 2zm.5 5v5.25l4.5 2.67-.75 1.23L11 13V7z"/></svg>
      <span id="held-label">waiting:</span>
      <span id="held-text"></span>
      <m3e-icon-button id="held-clear" data-i18n-title="clear" title="清除"><m3e-icon name="close"></m3e-icon></m3e-icon-button>
    </div>

    <footer id="input-bar" data-i18n-drag="dropToAttach" data-drag-text="松开以添加附件">
      <div id="cmd-suggestions"></div>
      <!-- Attachments waiting to be sent. Sits directly above the composer and
           shares its width, so a thumbnail row reads as part of the field. -->
      <div id="attach-tray" aria-live="polite"></div>
      <m3e-toolbar id="composer-bar" variant="vibrant" shape="rounded">
        <!-- Left action group: the reference's three (attach menu, gallery,
             model). Each is wrapped in a slot div because m3e-menu-trigger
             anchors its menu to the trigger's PARENT element, so that parent has
             to hug the button. align-self puts them on the field's bottom
             baseline instead of its midline (see the CSS). -->
        <div id="composer-actions">
          <div class="composer-slot">
            <m3e-menu-trigger for="add-menu" data-i18n-aria="addAttachment" aria-label="添加附件">
              <m3e-icon-button id="add-btn" size="small" variant="standard" data-i18n-aria="addAttachment" data-i18n-title="addAttachment" aria-label="添加附件" title="添加附件" disabled><m3e-icon name="add"></m3e-icon></m3e-icon-button>
            </m3e-menu-trigger>
          </div>
          <div class="composer-slot">
            <m3e-icon-button id="gallery-btn" size="small" variant="standard" data-i18n-aria="pickImage" data-i18n-title="pickImage" aria-label="选择图片" title="选择图片" disabled><m3e-icon name="image"></m3e-icon></m3e-icon-button>
          </div>
          <div class="composer-slot" id="model-slot">
            <m3e-menu-trigger for="model-menu" data-i18n-aria="switchModel" aria-label="切换模型">
              <m3e-icon-button id="model-btn" size="small" variant="standard" data-i18n-aria="switchModel" data-i18n-title="switchModel" aria-label="切换模型" title="切换模型" disabled><m3e-icon name="auto_awesome"></m3e-icon></m3e-icon-button>
            </m3e-menu-trigger>
          </div>
        </div>
        <!-- The inner capsule. Its own background is painted opaque at all
             times, not only behind the field: the trailing button and the
             loading indicator sit ON this box, and a transparent gap between
             them and the form-field would let the vibrant toolbar show
             through. -->
        <div id="composer-pill">
          <m3e-circular-progress-indicator id="composer-loading" variant="wavy" value="0" aria-label="上下文用量"></m3e-circular-progress-indicator>
          <m3e-tooltip id="usage-tip" for="composer-loading" position="above" show-delay="200" hide-delay="0">上下文用量</m3e-tooltip>
          <!-- hide-subscript="always": this field has no supporting text, and the
               reserved row for it is what made the host taller than the visible
               box (and the buttons beside it look mismatched). -->
          <m3e-form-field variant="filled" hide-subscript="always">
            <textarea id="input" data-i18n-placeholder="inputPlaceholder" placeholder="输入消息（/ 查看命令）…" rows="1" disabled></textarea>
          </m3e-form-field>
          <m3e-textarea-autosize for="input" min-rows="1" max-rows="6"></m3e-textarea-autosize>
          <m3e-icon-button id="send-btn" size="small" variant="filled" disabled data-i18n-aria="send" aria-label="发送"><m3e-icon name="send" filled></m3e-icon></m3e-icon-button>
          <!-- The stop gesture is two taps (arm, then confirm), which is not
               discoverable from a square glyph alone. A tooltip on the button
               says so: hover/focus gets it, and the arm tap pops it
               immediately (see armStop) so the "now what" is answered at the
               exact moment it becomes a question. for= resolves by id inside
               the root, so this can sit anywhere — here, next to the button
               it describes. -->
          <m3e-tooltip id="stop-tip" for="send-btn" position="above" show-delay="0" hide-delay="200" touch-gestures="off" data-i18n="stopArmHint">点击两次以停止</m3e-tooltip>
        </div>
      </m3e-toolbar>
      <input type="file" id="attach-input" multiple hidden>
      <!-- Lives beside the toolbar, not inside it: a menu is fixed-position
           chrome and would be clipped by the toolbar's own surface. -->
      <m3e-menu id="add-menu" data-i18n-aria="addAttachment" aria-label="添加附件">
        <m3e-menu-item data-add="image"><span class="add-item"><m3e-icon name="image"></m3e-icon><span data-i18n="image">图片</span></span></m3e-menu-item>
        <m3e-menu-item data-add="file"><span class="add-item"><m3e-icon name="attach_file"></m3e-icon><span data-i18n="file">文件</span></span></m3e-menu-item>
        <m3e-menu-item data-add="clear"><span class="add-item"><m3e-icon name="delete"></m3e-icon><span data-i18n="clearAll">清除全部</span></span></m3e-menu-item>
      </m3e-menu>
    </footer>
      </div><!-- /main-col -->
    </m3e-drawer-container>
  </div>

  <!-- Notifications dropdown: the toggle plus the history list, nothing
       else — appearance and behaviour settings live in #settings-panel. -->
  <div id="notif-panel" aria-hidden="true">
    <div id="notif-toggle-row">
      <span id="notif-title" data-i18n="notifications">通知</span>
      <m3e-switch id="notif-toggle" icons="both"></m3e-switch>
    </div>
    <m3e-list id="notif-list" variant="segmented"></m3e-list>
  </div>
  <m3e-bottom-sheet id="notif-sheet" modal handle data-i18n-handle-label="dragHandleNotifications" handle-label="通知面板拖拽手柄">
    <div id="notif-sheet-toggle-row">
      <span id="notif-sheet-title" data-i18n="notifications">通知</span>
      <m3e-switch id="notif-sheet-toggle" icons="both"></m3e-switch>
    </div>
    <m3e-list id="notif-sheet-list" variant="segmented"></m3e-list>
  </m3e-bottom-sheet>

  <!-- Settings: appearance and behaviour only, as a segmented list — one item
       per choice, with the library's own metrics instead of hand-rolled flex
       rows. The two palette choices are menus of radio items: the row shows the
       value in force, the menu shows the whole set and draws the tick.
       The panel has TWO hosts, one per form factor: a bottom sheet on a phone
       and an anchored dropdown on a wide screen. The CONTENT lives once, in a
       template, and is cloned into whichever host is active (see
       moveSettingsContent) — the other host is emptied, or the duplicate ids
       would resolve to a stale copy.
       The menus and the wallpaper input live OUTSIDE that template, at the top
       level: a menu is position:fixed chrome, and inside a sheet it would be
       clipped by the sheet's own surface. -->
  <template id="settings-content">
    <div id="settings-title" data-i18n="settings">设置</div>
    <m3e-list id="settings-list" variant="segmented">
      <m3e-list-item class="settings-row">
        <span data-i18n="darkLightMode">深浅色模式</span>
        <m3e-button slot="trailing" variant="text" size="small">
          <m3e-menu-trigger for="theme-menu"><span id="theme-value" data-i18n="themeAuto">自动</span></m3e-menu-trigger>
        </m3e-button>
      </m3e-list-item>
      <m3e-list-item class="settings-row">
        <span data-i18n="themeColor">主题色</span>
        <m3e-button slot="trailing" variant="text" size="small">
          <m3e-menu-trigger for="accent-menu"><span class="accent-swatch" id="accent-value-swatch"></span><span id="accent-value" data-i18n="accentDefault">默认</span></m3e-menu-trigger>
        </m3e-button>
      </m3e-list-item>
      <!-- Language: a menu of radio items, exactly like the two palette rows
           above, so the settings list stays one component with one set of
           metrics. Filled from LOCALES at boot (see renderLocaleMenu). -->
      <m3e-list-item class="settings-row">
        <span data-i18n="language">语言</span>
        <m3e-button slot="trailing" variant="text" size="small">
          <m3e-menu-trigger for="locale-menu"><span id="locale-value" data-i18n="appTitle">简体中文</span></m3e-menu-trigger>
        </m3e-button>
      </m3e-list-item>
      <m3e-list-item class="settings-row">
        <span data-i18n="autoCollapseThinking">Thinking 自动收起</span>
        <m3e-switch slot="trailing" id="thinking-collapse" icons="both"></m3e-switch>
      </m3e-list-item>
    </m3e-list>
  </template>
  <m3e-menu id="theme-menu" data-i18n-aria="darkLightMode" aria-label="深浅色模式">
    <m3e-menu-item-radio data-value="light" data-i18n="themeLight">浅色</m3e-menu-item-radio>
    <m3e-menu-item-radio data-value="dark" data-i18n="themeDark">深色</m3e-menu-item-radio>
    <m3e-menu-item-radio data-value="auto" data-i18n="themeAuto">自动</m3e-menu-item-radio>
  </m3e-menu>
  <!-- Language menu. Its items are built from LOCALES, because the list of
       supported languages is data, not markup: adding a locale should not
       mean editing four places. -->
  <m3e-menu id="locale-menu" data-i18n-aria="language" aria-label="语言"></m3e-menu>
  <!-- One radio per seed colour, each showing its own swatch; the last row is
       an action, not a choice, so it is a plain menu item. -->
  <m3e-menu id="accent-menu" data-i18n-aria="themeColor" aria-label="主题色">
    <m3e-menu-item-radio data-accent="" data-i18n-name="accentDefault" data-name="默认"><span class="accent-item"><span class="accent-swatch" style="background:#6750A4"></span><span data-i18n="accentDefault">默认</span></span></m3e-menu-item-radio>
    <m3e-menu-item-radio data-accent="#1E88E5" data-i18n-name="accentBlue" data-name="蓝色"><span class="accent-item"><span class="accent-swatch" style="background:#1E88E5"></span><span data-i18n="accentBlue">蓝色</span></span></m3e-menu-item-radio>
    <m3e-menu-item-radio data-accent="#00897B" data-i18n-name="accentTeal" data-name="青色"><span class="accent-item"><span class="accent-swatch" style="background:#00897B"></span><span data-i18n="accentTeal">青色</span></span></m3e-menu-item-radio>
    <m3e-menu-item-radio data-accent="#43A047" data-i18n-name="accentGreen" data-name="绿色"><span class="accent-item"><span class="accent-swatch" style="background:#43A047"></span><span data-i18n="accentGreen">绿色</span></span></m3e-menu-item-radio>
    <m3e-menu-item-radio data-accent="#EF6C00" data-i18n-name="accentOrange" data-name="橙色"><span class="accent-item"><span class="accent-swatch" style="background:#EF6C00"></span><span data-i18n="accentOrange">橙色</span></span></m3e-menu-item-radio>
    <m3e-menu-item-radio data-accent="#D32F2F" data-i18n-name="accentRed" data-name="红色"><span class="accent-item"><span class="accent-swatch" style="background:#D32F2F"></span><span data-i18n="accentRed">红色</span></span></m3e-menu-item-radio>
    <m3e-menu-item-radio data-accent="#7B1FA2" data-i18n-name="accentPurple" data-name="紫色"><span class="accent-item"><span class="accent-swatch" style="background:#7B1FA2"></span><span data-i18n="accentPurple">紫色</span></span></m3e-menu-item-radio>
    <m3e-menu-item id="accent-extract"><span class="accent-item"><m3e-icon name="image"></m3e-icon><span data-i18n="extractFromImage">从图片提取</span></span></m3e-menu-item>
  </m3e-menu>
  <input type="file" id="accent-wallpaper" accept="image/*" hidden>
  <!-- Wide-screen dropdown: the recipe the app used before the sheets, kept
       verbatim so a desktop keeps the anchored card, its shadow and its 28px
       corner. -->
  <div id="settings-panel" aria-hidden="true"></div>
  <!-- Phone: the same content inside a modal bottom sheet. -->
  <m3e-bottom-sheet id="settings-sheet" modal handle data-i18n-handle-label="dragHandleSettings" handle-label="设置面板拖拽手柄"></m3e-bottom-sheet>

  <!-- Model picker: the two forms of one panel, both opened from the composer's
       model button. Fed by the models frame (authed catalogue + current spec)
       rendered as rows; choosing one sends set_model, and the fresh frame that
       answers re-renders the tick — no optimistic check, so a rejected switch
       can't leave the list lying. -->
  <m3e-menu id="model-menu" data-i18n-aria="switchModel" aria-label="切换模型"></m3e-menu>
  <m3e-bottom-sheet id="model-sheet" modal handle data-i18n-handle-label="dragHandleModel" data-i18n-aria="switchModel" handle-label="模型列表拖拽手柄" aria-label="切换模型">
    <m3e-action-list id="model-sheet-list" variant="segmented"></m3e-action-list>
  </m3e-bottom-sheet>

  <!-- Prompt dialog: shown when pi asks for user input -->
  <m3e-dialog id="prompt-card">
    <div slot="header" data-i18n="promptTitle">π 需要你的输入</div>
    <div class="q" id="prompt-q"></div>
    <div class="rec-panel" id="prompt-rec">
      <div class="rec-label" data-i18n="recommended">推荐答案</div>
      <div class="rec-text" id="prompt-rec-text"></div>
    </div>
    <textarea id="prompt-input" data-i18n-placeholder="promptPlaceholder" placeholder="输入你的回答…" rows="3" style="display:none"></textarea>
    <m3e-textarea-autosize for="prompt-input" min-rows="3" max-rows="8"></m3e-textarea-autosize>
    <div slot="actions" class="row" id="prompt-buttons"></div>
  </m3e-dialog>
  <m3e-dialog id="session-delete-dialog" alert>
    <span slot="header" data-i18n="deleteSession">删除会话</span>
    <p class="q" id="session-delete-text"></p>
    <div slot="actions" end>
      <m3e-button id="session-delete-cancel" autofocus data-i18n="cancel">取消</m3e-button>
      <m3e-button id="session-delete-confirm" variant="tonal" data-i18n="delete">删除</m3e-button>
    </div>
  </m3e-dialog>

  <!-- Reconnect overlay with live countdown -->
  <div id="reconnect-overlay"><span id="reconnect-msg" data-i18n="reconnecting">重新连接中…</span></div>

  <script type="module">
    ${BUNDLE_IMPORTS}
    ${ICON_IMPORTS}
    ${renderModule()}
    ${highlightModule()}
    ${toolsModule()}
    ${i18nModule()}
    ${stage0Logic(wsUrl)}
  </script>
    </m3e-theme>
  </div>
</body>
</html>`
}

function stage0Logic(wsUrl: string): string {
    return `
    // ───────────── Constants & DOM ─────────────
    const WS_URL_PLACEHOLDER = ${JSON.stringify(wsUrl)};
    const FALLBACK_WS_URL = WS_URL_PLACEHOLDER;
    const WS_URL_RESOLVED = (location && location.host)
      ? (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'
      : FALLBACK_WS_URL;

    const chatLog      = document.getElementById('chat-log');
    // Drive M3E's hide-on-scroll against the chat scroller. The property is
    // guarded because the component only upgrades once its CDN module loads.
    const topBar = document.getElementById('top-bar');
    if (topBar && 'control' in topBar) { try { topBar.control = chatLog; } catch (_) {} }
    /* The bar is height:auto and now stacks two text lines, so nothing else can
       assume its 4rem default: publish its measured height and let the wave
       band, the chat's top inset and the anchored dropdowns clear that. */
    if (topBar && typeof ResizeObserver !== 'undefined') {
      const publishBarHeight = () => {
        const h = topBar.offsetHeight;
        if (h) document.documentElement.style.setProperty('--_topbar-h', h + 'px');
      };
      new ResizeObserver(publishBarHeight).observe(topBar);
      publishBarHeight();
    }
    const inputEl      = document.getElementById('input');
    const sendBtn      = document.getElementById('send-btn');
    const stopTip      = document.getElementById('stop-tip');
    const inputBar     = document.getElementById('input-bar');
    const composerBar  = document.getElementById('composer-bar');
    const composerPill = document.getElementById('composer-pill');
    const composerLoading = document.getElementById('composer-loading');
    const usageTip = document.getElementById('usage-tip');
    const addBtn       = document.getElementById('add-btn');
    const addMenu      = document.getElementById('add-menu');
    const galleryBtn   = document.getElementById('gallery-btn');
    const modelBtn     = document.getElementById('model-btn');
    const attachInput  = document.getElementById('attach-input');
    const attachTray   = document.getElementById('attach-tray');
    const ctxBar       = document.getElementById('ctx-bar');
    const ctxFlat      = document.getElementById('ctx-bar-flat');
    const ctxStack     = document.getElementById('ctx-stack');
    const ctxFill      = document.getElementById('ctx-fallback').firstElementChild;
    const statusDot    = document.getElementById('status-dot');
    const chatTitle    = document.getElementById('chat-title');
    const statusModel  = document.getElementById('status-model');
    const statusCtx    = document.getElementById('status-ctx');
    const overlay      = document.getElementById('reconnect-overlay');
    const reconnectMsg = document.getElementById('reconnect-msg');
    const notifBtn     = document.getElementById('notif-btn');
    const settingsBtn  = document.getElementById('settings-btn');
    const settingsPanel= document.getElementById('settings-panel');
    const settingsSheet= document.getElementById('settings-sheet');
    const cmdSuggestions = document.getElementById('cmd-suggestions');
    const scrollBtn    = document.getElementById('scroll-bottom');
    const heldBar      = document.getElementById('held-bar');
    const heldLabel    = document.getElementById('held-label');
    const heldTextEl   = document.getElementById('held-text');
    const heldClearBtn = document.getElementById('held-clear');
    const statusPanel  = document.getElementById('status-panel');
    const promptCard   = document.getElementById('prompt-card');
    const promptQ      = document.getElementById('prompt-q');
    const promptRec    = document.getElementById('prompt-rec');
    const promptRecText= document.getElementById('prompt-rec-text');
    const promptInput  = document.getElementById('prompt-input');
    const promptButtons= document.getElementById('prompt-buttons');
    const sessionDeleteDialog  = document.getElementById('session-delete-dialog');
    const sessionDeleteText    = document.getElementById('session-delete-text');
    const notifPanel   = document.getElementById('notif-panel');
    const notifSheet   = document.getElementById('notif-sheet');
    const notifList    = document.getElementById('notif-list');
    const notifSheetList = document.getElementById('notif-sheet-list');
    const notifToggle  = document.getElementById('notif-toggle');
    const notifSheetToggle = document.getElementById('notif-sheet-toggle');
    const notifTitle   = document.getElementById('notif-title');
    const modelMenu    = document.getElementById('model-menu');
    const modelSheet   = document.getElementById('model-sheet');
    const modelSheetList = document.getElementById('model-sheet-list');
    /* Detents as a JS property, not the attribute: the component parses the
       attribute's comma string into ONE detent ("fit,") rather than two.
       The ladder is fit → half → full, so a short panel (settings, an empty
       notification list) hugs its content instead of opening half the screen
       with dead space above it, and a long one (the model list) can still be
       dragged taller. 'fit' is measured at open time, which is exactly when
       renderModelMenu()/renderNotifList() have just run.
       Must run AFTER upgrade: these elements exist in the initial HTML, but
       m3e-bottom-sheet is loaded lazily, so at parse time they are plain
       HTMLElements with no detents property — assigning earlier would be a
       no-op on a native element. */
    /* ── Two forms, one panel ──
       Each of the three app-bar panels exists twice: an anchored dropdown (the
       app's original form, for wide screens) and a modal bottom sheet (for
       phones). This object is the seam — everything above it just says
       open/close/render and gets whichever form the current width calls for.

       The two hosts are NOT allowed to be visible at once: the dropdown is
       position:fixed and would keep a hit area behind the sheet's scrim. */
    const WIDE = '(min-width: 601px)';
    const panels = {
      notif:   {dropdown: notifPanel,   sheet: notifSheet},
      settings:{dropdown: settingsPanel, sheet: settingsSheet},
      model:   {dropdown: modelMenu,    sheet: modelSheet}
    };
    const isWide = () => window.matchMedia(WIDE).matches;
    /** The element that should be showing for a panel right now. */
    const hostOf = name => (isWide() ? panels[name].dropdown : panels[name].sheet);
    /** The OTHER element — hidden, but still worth closing so it cannot be
     *  mid-animation when the breakpoint is crossed. */
    const otherOf = name => (isWide() ? panels[name].sheet : panels[name].dropdown);

    customElements.whenDefined('m3e-bottom-sheet').then(() => {
      for (const name of Object.keys(panels)) {
        const el = panels[name].sheet;
        if (el) el.detents = ['fit', 'half', 'full'];
      }
      applyForm();
      // A rotation, a window resize onto a dock, or a phone held sideways all
      // cross the breakpoint, so the form follows it live.
      window.matchMedia(WIDE).addEventListener('change', applyForm);
    }).catch(() => {});

    /* Move the shared content into whichever host is active, and close the
       other one. Called on load and on every breakpoint crossing. */
    function applyForm() {
      for (const name of Object.keys(panels)) {
        const {dropdown, sheet} = panels[name];
        if (!sheet) continue;
        // Settings content lives in a template and is remounted into the active
        // host, so the two forms can never drift apart.
        if (name === 'settings') moveSettingsContent();
        if (isWide()) { if (sheet.open) sheet.hide(); }
        else { dropdown.classList.remove('open'); }
      }
      // The model list is rendered by JS into whichever container is live.
      if (modelCatalog.models.length) renderModelMenu();
    }

    /* Settings: one <template>, two hosts. The content is cloned into whichever
       host is active and the other is emptied — a copy left behind would
       duplicate every id in it, and getElementById resolves to the detached
       one. The labels show live theme/accent state, so they are re-stamped on
       each fresh mount (syncSettingsLabels). */
    let settingsMountedIn = null;
    function moveSettingsContent() {
      const tpl = document.getElementById('settings-content');
      if (!tpl) return;
      const target = isWide() ? settingsPanel : settingsSheet;
      // Crossing the breakpoint within the same form (a resize that never
      // changes the width class) must not rebuild the controls mid-gesture.
      if (settingsMountedIn === target && target.firstElementChild) return;
      const other = target === settingsPanel ? settingsSheet : settingsPanel;
      if (other) other.innerHTML = '';
      target.innerHTML = '';
      target.append(tpl.content.cloneNode(true));
      settingsMountedIn = target;
      /* The clone is BRAND NEW markup every time: it carries the template's
         Chinese and has never been through the locale sweep. Re-stamp it here
         — this runs on boot, on every breakpoint crossing, and on every
         settings remount, which is exactly when fresh nodes appear. */
      paintStaticI18n(target);
      syncSettingsLabels();
    }
    const drawer       = document.getElementById('drawer');
    const menuBtn      = document.getElementById('menu-btn');
    const drawerClose  = document.getElementById('session-drawer-close');
    const sessionList  = document.getElementById('session-list');
    const localeMenu   = document.getElementById('locale-menu');

    // ───────────── Locale ─────────────
    /* Static markup is authored in Chinese on purpose — it is the default
       locale, so the first paint is never a flash of untranslated keys or of
       empty boxes waiting on a table. Switching language therefore has to go
       back and re-stamp that markup, which is what data-i18n* marks: one
       attribute per target property, so the sweep is one query and not a
       hand-written list of forty textContent assignments that would silently
       rot every time a row was added.
       Everything dynamic (toasts, placeholders, session rows) just calls
       t() again the next time it paints, so it needs no marking. */
    const I18N_ATTRS = [
      ['data-i18n', 'textContent'],
      ['data-i18n-title', 'title'],
      ['data-i18n-aria', 'ariaLabel'],
      ['data-i18n-placeholder', 'placeholder'],
      // Both written as ATTRIBUTES, not IDL properties: m3e-bottom-sheet's
      // handleLabel and ariaLabel may or may not reflect depending on whether
      // the lazy module has upgraded the element yet, and setAttribute is the
      // one form that always lands and is always readable back.
      ['data-i18n-handle-label', 'handle-label'],
      // Not a DOM property: the drop hint is painted by ::after, which can
      // only read attr(). See the CSS note on #input-bar.dragging::after.
      ['data-i18n-drag', 'data-drag-text']
    ];
    function paintStaticI18n(root) {
      for (const [attr, prop] of I18N_ATTRS) {
        for (const el of (root || document).querySelectorAll('[' + attr + ']')) {
          const key = el.getAttribute(attr);
          if (!key) continue;
          /* aria-label goes through the attribute, not the IDL property:
             ariaLabel is reflected but several of these hosts are custom
             elements mid-upgrade, and setAttribute is the one form that
             always lands. */
          if (prop === 'ariaLabel' || prop === 'handle-label' || prop === 'data-drag-text')
            el.setAttribute(prop === 'ariaLabel' ? 'aria-label' : prop, t(key));
          else el[prop] = t(key);
        }
      }
    }
    /* Language menu: built from LOCALE_LABELS so the supported set lives in
       one place (ui-i18n.ts) instead of being mirrored into markup. */
    function renderLocaleMenu() {
      if (!localeMenu) return;
      let html = '';
      for (const id of Object.keys(LOCALE_LABELS)) {
        html += '<m3e-menu-item-radio data-locale="' + id + '" data-i18n="' + id + '"></m3e-menu-item-radio>';
      }
      localeMenu.innerHTML = html;
      // Each item shows its own language's name for that language — "English"
      // stays "English" in every locale, which is what makes the menu
      // readable to someone who cannot read the current one.
      for (const it of localeMenu.querySelectorAll('[data-locale]')) {
        it.textContent = LOCALE_LABELS[it.getAttribute('data-locale')];
        it.addEventListener('click', () => pickLocale(it.getAttribute('data-locale')));
      }
      localeItems = Array.from(localeMenu.querySelectorAll('[data-locale]'));
    }
    let localeItems = [];
    function applyLocaleSelection(id) {
      for (const it of localeItems) it.toggleAttribute('checked', it.getAttribute('data-locale') === id);
      const lbl = settingsHost().querySelector('#locale-value');
      if (lbl) lbl.textContent = LOCALE_LABELS[id] || id;
    }
    function pickLocale(id) {
      if (!id || id === CURRENT_LOCALE) { localeMenu?.hideAll?.(true); return; }
      applyLocale(id, repaintLocale);
      localeMenu?.hideAll?.(true);
      showToast(t('languageSwitched') + (LOCALE_LABELS[id] || id), 'info');
    }
    /* Everything that has to be re-stamped when the language changes. Order
       matters only in that the static sweep comes first: the re-renders below
       regenerate whole subtrees (menus, session rows, chat titles), and those
       fresh nodes must be built against the NEW locale. */
    function repaintLocale() {
      paintStaticI18n(document);
      renderLocaleMenu();
      applyLocaleSelection(CURRENT_LOCALE);
      applyThemeSelection(localStorage.getItem('pi-task-theme') || 'auto');
      applyAccent(localStorage.getItem('pi-task-accent') || '', false);
      if (modelCatalog.models.length) renderModelMenu();
      renderSessions();
      syncChatTitle();
      renderAttachments();
      if (notifHistory.length) renderNotifList();
      else if (notifList) notifList.innerHTML = '<div id="notif-empty">' + t('noNotifications') + '</div>';
      if (notifSheetList) notifSheetList.innerHTML = notifList ? notifList.innerHTML : '';
      /* Live composer state, all of which is phrased: the placeholder, the
         button tooltips, the stop-tooltip, the status line's "no model"
         fallback, and the reconnect countdown. */
      refreshComposer();
      setSendBtn(true);
      setModelName();
      /* The countdown is re-painted by its own interval (90ms), so it picks
         the new locale up on the next tick without being forced here. */
    }
    /* Boot: restore the stored locale, or infer a sensible default from the
       browser. navigator.language is only a hint — it is the browser UI's
       language, not the user's keyboard — so it seeds the FIRST visit only
       and is never allowed to override a choice already made. */
    function initialLocale() {
      let stored = null;
      try { stored = localStorage.getItem('pi-task-locale'); } catch (e) {}
      if (stored && LOCALE_TABLES[stored]) return stored;
      const nav = (navigator.language || '').toLowerCase();
      if (nav.startsWith('zh')) {
        // Traditional is signalled by the region subtag (zh-TW, zh-HK, zh-MO)
        // or by an explicit script subtag (zh-Hant).
        return (nav.includes('hant') || /(^|[-_])(tw|hk|mo)($|[-_])/.test(nav)) ? 'zh-TW' : 'zh-CN';
      }
      return DEFAULT_LOCALE;
    }

    // ───────────── State ─────────────
    let connected = false, agentRunning = false, modelName = '';
    let currentBubble = null, streamText = '';
    let reconnectDelay = 1000, reconnectTimer = null, reconnectAnim = null, ws = null;
    let autoScroll = true;
    const toolCallMap = {};
    let currentThinking = null, thinkingText = '';
    let held = [], runHolding = false;
    let taskWidgetLines = null, taskWidgetData = null;
    let turnHadContent = false;
    let activePromptId = null;
    let activeRecommended = '', activeRecommended2 = '', activeActions = [];
    /* Attachments picked but not yet sent. Each entry is either a finished
       upload ({id, name, kind, mimeType, size, url}) or an upload in flight
       ({localId, name, pending:true}) so a big file shows up immediately. */
    let pendingAttachments = [];
    const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
    let cancelArmTimer = null;
    let stopArmed = false, stopArmTimer = null;
    let sendSwapTimer = null;
    /* Which glyph the send button is MEANT to show. Not "what the DOM reads":
       the morph is deferred, so a button that already looks right can still
       have a swap in flight, and that swap is the bug — see setSendBtn. */
    let sendIconWanted = 'send';
    let notifHistory = [];
    let notifOpen = false;
    let settingsOpen = false;
    let modelCatalog = {current: null, models: []};
    let modelMenuOpen = false;
    let sessionData = {current: null, sessions: []};

    // M3 Expressive wavy progress (mdui 2.x has no Expressive components yet).
    // Pinned version; loaded async so a slow CDN never blocks the app boot.
    import('https://esm.sh/@m3e/web@2.7.9/progress-indicator').catch(() => {});
    /* The import resolving is not the same as the element being live, and a
       rejected import (offline, LAN-only, blocked CDN) leaves #ctx-bar an
       unknown zero-height tag forever. customElements.whenDefined is the one
       signal that is true exactly when the library is really there: retire
       the CSS fallback and arm the wave only on it. */
    customElements.whenDefined('m3e-linear-progress-indicator').then(() => {
      ctxStack.classList.add('m3e');
      paintCtxWave();
    });
    import('https://esm.sh/@m3e/web@2.7.9/shape').catch(() => {});
    // m3e-icon renders inline SVG for icons registered through the library's
    // registerIcon API and otherwise falls back to ligature text in the
    // "Material Symbols Outlined" font (a multi-MB download). Register the
    // handful of icons this app uses instead; paths are the Material Icons
    // set (Apache-2.0), viewBox 0 0 24 24.
    import('https://esm.sh/@m3e/web@2.7.9/icon').then(m => {
      const VB = '0 0 24 24';
      // name: [outlined path, filled path]
      const iconPaths = {
        send: ['m4.01 6.03 7.51 3.22-7.52-1 .01-2.22m7.5 8.72L4 17.97v-2.22l7.51-1M2.01 3 2 10l15 2-15 2 .01 7L23 12 2.01 3z',
               'M2.01 21 23 12 2.01 3 2 10l15 2-15 2z'],
        stop: ['M16 8v8H8V8h8m2-2H6v12h12V6z',
               'M6 6h12v12H6z'],
        notifications: ['M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z',
                        'M12 22c1.1 0 2-.9 2-2h-4a2 2 0 0 0 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z'],
        close: ['M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z',
                'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'],
        arrow_downward: ['m20 12-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z',
                         'm20 12-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z'],
        menu: ['M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
               'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z'],
        history: ['M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z',
                  'M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9z'],
        check: ['M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
                'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'],
        settings: ['M19.43 12.98c.04-.32.07-.64.07-.98 0-.34-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65A.488.488 0 0 0 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1a.566.566 0 0 0-.18-.03c-.17 0-.34.09-.43.25l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98 0 .33.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46a.5.5 0 0 0 .61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.06.02.12.03.18.03.17 0 .34-.09.43-.25l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zm-1.98-1.71c.04.31.05.52.05.73 0 .21-.02.43-.05.73l-.14 1.13.89.7 1.08.84-.7 1.21-1.27-.51-1.04-.42-.9.68c-.43.32-.84.56-1.25.73l-1.06.43-.16 1.13-.2 1.35h-1.4l-.19-1.35-.16-1.13-1.06-.43c-.43-.18-.83-.41-1.23-.71l-.91-.7-1.06.43-1.27.51-.7-1.21 1.08-.84.89-.7-.14-1.13c-.03-.31-.05-.54-.05-.74s.02-.43.05-.73l.14-1.13-.89-.7-1.08-.84.7-1.21 1.27.51 1.04.42.9-.68c.43-.32.84-.56 1.25-.73l1.06-.43.16-1.13.2-1.35h1.39l.19 1.35.16 1.13 1.06.43c.43.18.83.41 1.23.71l.91.7 1.06-.43 1.27-.51.7 1.21-1.07.85-.89.7.14 1.13zM12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
                   'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z'],
        content_copy: ['M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
                'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z'],
        person: ['M12 6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2m0 10c2.7 0 5.8 1.29 6 2H6c.23-.72 3.31-2 6-2m0-12C9.79 4 8 5.79 8 8s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 10c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
                'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'],
        error_outline: ['M11 15h2v2h-2v-2zm0-8h2v6h-2V7zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z',
                'M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z'],
        auto_awesome: ['m19 9 1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25zm0 6-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25zm-7.5-5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zm-1.51 3.49L9 15.17l-.99-2.18L5.83 12l2.18-.99L9 8.83l.99 2.18 2.18.99-2.18.99z',
                'm19 9 1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z'],
        // The theme picker's image swatch is an outlined dot, so it needs a
        // glyph that says "from a picture". Paths from @material-design-icons/
        // svg (image), same 24×24 grid as the rest.
        image: ['M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4.86 8.86-3 3.87L9 13.14 6 17h12l-3.86-5.14z',
                'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z'],
        // The session drawer's per-row delete button. Paths from
        // @material-design-icons/svg (delete), same 24×24 grid as the rest.
        delete: ['M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z',
                 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z'],
        // The composer's paperclip. Paths from @material-design-icons/svg
        // (attach_file), same 24×24 grid as the rest.
        attach_file: ['M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z',
                      'M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z'],
        // The composer's "+" action. Paths from @material-design-icons/svg
        // (add) — outlined and filled share one glyph — same grid as the rest.
        add: ['M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
              'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z'],
        // A generic file chip (draft / insert_drive_file).
        description: ['M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
                      'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z'],
        // The notification list's per-level leading icons. Paths from
        // @material-design-icons/svg (info, warning, error), same grid.
        info: ['M11 7h2v2h-2V7zm0 4h2v6h-2v-6zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
               'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z'],
        warning: ['M12 5.99L19.53 19H4.47L12 5.99M12 2 1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z',
                  'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z'],
        error: ['M11 15h2v2h-2v-2zm0-8h2v6h-2V7zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z',
                'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z']
      };
      for (const name in iconPaths) {
        m.registerIcon(name, 'outlined', {
          outlined: { viewBox: VB, path: iconPaths[name][0] },
          filled:  { viewBox: VB, path: iconPaths[name][1] }
        });
      }
      /* m3e-icon's own catch-up (registry observer) is lost whenever an
         unregistered icon is disconnected even once — a host that re-slots
         its light DOM on upgrade does exactly that. Re-set the
         name attribute on every icon to force a re-render now that the
         paths are in; anything created after this point resolves directly. */
      document.querySelectorAll('m3e-icon[name]').forEach(el => {
        /* The PROPERTY, not the attribute: name is not reflected, so the
           attribute keeps the markup value forever while the app changes what
           the icon shows (the send ⇄ stop morph especially). Re-stamping from
           the attribute would silently revert a running button to 'send'.
           The '' bounce forces the repaint even where the value is unchanged. */
        const n = el.name || el.getAttribute('name');
        if (!n) return;
        el.name = '';
        el.name = n;
      });
      /* …and if the library landed mid-morph, the send glyph was painted as a
         ligature with no path behind it. Re-assert its current state now that
         the paths exist — force, because the state has not changed. */
      setSendBtn(true);
    }).catch(() => {});
    import('https://esm.sh/@m3e/web@2.7.9/icon-button').catch(() => {});
    import('https://esm.sh/@m3e/web@2.7.9/button').catch(() => {});
    import('https://esm.sh/@m3e/web@2.7.9/button-group').catch(() => {});
    import('https://esm.sh/@m3e/web@2.7.9/tooltip').catch(() => {});
    import('https://esm.sh/@m3e/web@2.7.9/expansion-panel').catch(() => {});
    import('https://esm.sh/@m3e/web@2.7.9/fab').catch(() => {});
    import('https://esm.sh/@m3e/web@2.7.9/drawer-container').catch(() => {});
    import('https://esm.sh/@m3e/web@2.7.9/menu').catch(() => {});
    import('https://esm.sh/@m3e/web@2.7.9/loading-indicator').catch(() => {});
    import('https://esm.sh/@m3e/web@2.7.9/app-bar').catch(() => {});
    import('https://esm.sh/@m3e/web@2.7.9/card').catch(() => {});
    import('https://esm.sh/@m3e/web@2.7.9/dialog').catch(() => {});
    import('https://esm.sh/@m3e/web@2.7.9/list').catch(() => {});
    import('https://esm.sh/@m3e/web@2.7.9/switch').catch(() => {});
    import('https://esm.sh/@m3e/web@2.7.9/form-field').catch(() => {});
    import('https://esm.sh/@m3e/web@2.7.9/toolbar').catch(() => {});
    import('https://esm.sh/@m3e/web@2.7.9/textarea-autosize').catch(() => {});
    import('https://esm.sh/@m3e/web@2.7.9/theme').catch(() => {});
    import('https://esm.sh/@m3e/web@2.7.9/bottom-sheet').catch(() => {});

    const SPIN = '\u280B\u2819\u2839\u2838\u283C\u2834\u2826\u2827\u2807\u280F';
    let spinIdx = 0, spinTimer = null;
    function spinPaint() {
      const g = SPIN[spinIdx % SPIN.length];
      const els = document.getElementsByClassName('spin');
      for (let i = 0; i < els.length; i++) els[i].textContent = g;
    }
    function startSpin() {
      spinPaint();
      if (spinTimer) return;
      spinTimer = setInterval(function () {
        spinIdx = (spinIdx + 1) % SPIN.length;
        spinPaint();
      }, 90);
    }
    function stopSpinIfIdle() {
      if (spinTimer && !document.querySelector('.spin')) {
        clearInterval(spinTimer); spinTimer = null;
      }
    }

    // ───────────── Theme (in the settings panel) ─────────────
    // Light / dark / auto is a menu of radio items now: the settings row carries
    // the value in force, the menu shows all three and draws the library's own
    // tick. The menus live at the top level (see the markup note in the panel),
    // so their items are stable elements and take direct listeners — only the
    // row labels, which live in the remounted content, need host lookups.
    const appTheme = document.getElementById('app-theme');
    const themeMenu = document.getElementById('theme-menu');
    const accentMenu = document.getElementById('accent-menu');
    const accentWallpaper = document.getElementById('accent-wallpaper');
    // The mobile browser chrome (address bar / task switcher tile) tints from
    // <meta name="theme-color">, so it follows the accent seed like everything
    // else.
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    /* NOT a const object built from t(): that would be evaluated once at
       boot and would keep the boot locale's words forever, so switching
       language would leave the settings row showing the old one. A function
       re-reads the table on every call. */
    const themeLabel = (val) =>
      val === 'light' ? t('themeLight') : val === 'dark' ? t('themeDark') : t('themeAuto');
    // m3e-theme's own baseline: an empty seed means "stock palette", and both
    // the swatch and the browser chrome must show that, not nothing.
    const BASELINE_ACCENT = '#6750A4';
    const storedTheme = localStorage.getItem('pi-task-theme') || 'auto';
    if (appTheme) appTheme.scheme = storedTheme;
    /* Settings content is cloned into whichever host is active, so every
       reference into it is resolved through this helper instead of being
       captured once. */
    const settingsHost = () => (isWide() ? settingsPanel : settingsSheet);
    const thinkingCollapseNow = () => settingsHost().querySelector('#thinking-collapse');
    const themeItems = () => Array.from(themeMenu?.querySelectorAll('m3e-menu-item-radio') || []);
    const accentItems = () => Array.from(accentMenu?.querySelectorAll('m3e-menu-item-radio') || []);
    const applyThemeSelection = (val) => {
      // The checked attribute is observed by the radio item, so setting it is
      // safe before the lazily loaded module upgrades the element.
      for (const it of themeItems()) it.toggleAttribute('checked', it.getAttribute('data-value') === val);
      const lbl = settingsHost().querySelector('#theme-value');
      if (lbl) lbl.textContent = themeLabel(val);
    };
    applyThemeSelection(storedTheme);
    for (const it of themeItems()) {
      it.addEventListener('click', () => {
        const val = it.getAttribute('data-value') || 'auto';
        if (appTheme) appTheme.scheme = val;
        localStorage.setItem('pi-task-theme', val);
        applyThemeSelection(val);
        themeMenu?.hideAll?.(true);
        showToast(val === 'auto' ? t('themeFollowSystem') : val === 'dark' ? t('themeSwitchedDark') : t('themeSwitchedLight'), 'info');
      });
    }

    // ───────────── Accent color (in the settings panel) ─────────────
    // Preset seeds set <m3e-theme>.color, which regenerates the full M3
    // tonal palette for BOTH light and dark from one seed; an empty seed keeps
    // the stock baseline. <m3e-theme> writes --md-sys-color-* directly
    // onto :root, so every m3e component follows automatically. The seed
    // persists and is re-applied on boot before first paint of the chat surface.
    const applyAccent = (seed, persist) => {
      if (appTheme) appTheme.color = seed || BASELINE_ACCENT;
      const chosen = accentItems().find((it) => (it.getAttribute('data-accent') || '') === seed);
      for (const it of accentItems()) it.toggleAttribute('checked', it === chosen);
      const host = settingsHost();
      const swatch = host.querySelector('#accent-value-swatch');
      if (swatch) swatch.style.background = seed || BASELINE_ACCENT;
      const lbl = host.querySelector('#accent-value');
      // A seed that matches no preset came out of a picture: say so rather
      // than naming a colour the app is not using.
      const nameKey = chosen && chosen.getAttribute('data-i18n-name');
      if (lbl) lbl.textContent = chosen ? (nameKey ? t(nameKey) : chosen.getAttribute('data-name') || '') : t('accentCustom');
      if (themeColorMeta) themeColorMeta.setAttribute('content', (seed || BASELINE_ACCENT).toLowerCase());
      if (persist) localStorage.setItem('pi-task-accent', seed);
    };
    applyAccent(localStorage.getItem('pi-task-accent') || '', false);
    for (const it of accentItems()) {
      it.addEventListener('click', () => {
        applyAccent(it.getAttribute('data-accent') || '', true);
        accentMenu?.hideAll?.(true);
        const k = it.getAttribute('data-i18n-name');
        showToast(t('accentSwitched') + (k ? t(k) : it.getAttribute('data-name') || ''), 'info');
      });
    }
    /* The row labels read live state, and the content carrying them is cloned
       afresh every time the panel changes host. */
    function syncSettingsLabels() {
      applyThemeSelection(localStorage.getItem('pi-task-theme') || 'auto');
      applyAccent(localStorage.getItem('pi-task-accent') || '', false);
      applyLocaleSelection(CURRENT_LOCALE);
    }

    // "Extract from image": pick an image, derive its dominant seed color with
    // material-color-utilities (same algorithm as Android's wallpaper theming),
    // and feed it to <m3e-theme> as the new accent seed.
    document.getElementById('accent-extract')?.addEventListener('click', () => {
      accentMenu?.hideAll?.(true);
      accentWallpaper?.click();
    });
    accentWallpaper?.addEventListener('change', async () => {
      const file = accentWallpaper.files && accentWallpaper.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        const { getColorFromImage } = await import('https://esm.sh/@m3e/web@2.7.9/theme');
        const hex = await getColorFromImage(img);
        applyAccent(hex, true);
        showToast(t('accentExtracted'), 'info');
      } catch (e) {
        showToast(t('extractFailed') + (e && e.message ? e.message : e), 'warning');
      } finally {
        URL.revokeObjectURL(url);
        accentWallpaper.value = '';
      }
    });

    // ───────────── Status ─────────────
    function fmtTokens(n) {
      if (n == null) return '';
      if (n < 1000) return String(n);
      if (n < 10000) return (n / 1000).toFixed(1) + 'k';
      if (n < 1000000) return Math.round(n / 1000) + 'k';
      return (n / 1000000).toFixed(1) + 'M';
    }
    /* pi reports a percent only when it knows BOTH the token count and the
       window: getContextUsage() returns undefined for a model with no
       contextWindow, and {tokens:null, percent:null} until the first
       assistant message after a compaction. A missing percent must never
       mean "keep the old fill" — a frozen bar reads as a working gauge while
       lying — so derive it when the pieces are there and clear it when they
       are not. */
    function ctxPercent(usage) {
      if (!usage) return null;
      if (usage.percent != null) return Math.max(0, Math.min(100, usage.percent));
      if (usage.tokens != null && usage.contextWindow > 0) {
        return Math.max(0, Math.min(100, (usage.tokens / usage.contextWindow) * 100));
      }
      return null;
    }
    function paintCtx(pct) {
      ctxBar.value = pct;
      ctxFlat.value = pct;
      ctxFill.style.width = pct + '%';
      ctxStack.classList.toggle('hot', pct >= 85);
    }
    function setContextBar(usage) {
      paintCtxWave();
      const pct = ctxPercent(usage);
      paintCtx(pct == null ? 0 : pct);
      const parts = [];
      if (pct != null) parts.push(Math.round(pct) + '%');
      if (usage && usage.tokens != null && usage.contextWindow) {
        parts.push(fmtTokens(usage.tokens) + '/' + fmtTokens(usage.contextWindow));
      }
      statusCtx.textContent = parts.join(' · ');
      // Update the composer's circular progress indicator and tooltip
      const val = pct == null ? 0 : Math.round(pct);
      if (composerLoading) composerLoading.value = val;
      if (usageTip) usageTip.textContent = parts.join(' · ') || t('contextUsage');
    }
    function setModelName(name) {
      if (name === undefined || name === modelName) return;
      modelName = name || '';
      // The bar's second line: which model is answering. It is no longer a
      // control (the composer owns switching), so before the first frame
      // reports one the line says that plainly instead of showing the app name.
      statusModel.textContent = modelName || t('noModel');
    }
    /* One title per session, shared by the sidebar row and the app bar so the
       two can never disagree: a user-set name, else the first message, else
       whichever placeholder fits. */
    function sessionTitle(s) {
      return s.name || s.firstMessage || (s.unsaved ? t('unsavedSession') : t('emptySession'));
    }
    function syncChatTitle() {
      const cur = sessionData.current;
      const s = (sessionData.sessions || []).find((x) => x.path === cur);
      chatTitle.textContent = s ? sessionTitle(s) : 'π-task';
      chatTitle.title = chatTitle.textContent;
    }
    function updateStatusDot() {
      statusDot.className = !connected ? 'disconnected'
                          : agentRunning ? 'connected running'
                          :                 'connected idle';
      paintCtxWave();
    }
    /* m3e's determinate wavy bar rolls its wave continuously by design and
       exposes no pause API (the 1.5s wave-slide is hardcoded, no part
       attribute). Reach into the open shadow root and freeze the wave
       unless a live turn is streaming, so the bar only "breathes" while
       the agent is actually working. */
    function paintCtxWave() {
      const apply = () => {
        ctxStack.classList.toggle('live', agentRunning);
        const p = ctxBar.shadowRoot && ctxBar.shadowRoot.querySelector('.primary path');
        if (p) p.style.animationPlayState = agentRunning ? 'running' : 'paused';
      };
      /* Lit renders asynchronously — a value change in this same task would
         run after a synchronous apply and wipe the play-state again. */
      if (ctxBar.updateComplete && ctxBar.updateComplete.then) {
        ctxBar.updateComplete.then(apply);
      } else {
        requestAnimationFrame(apply);
      }
    }
    function setSendBtn(force) {
      composerBar.classList.toggle('running', agentRunning);
      sendBtn.classList.toggle('running', agentRunning);
      const icon = sendBtn.querySelector('m3e-icon');
      if (!icon) return;
      const wanted = agentRunning ? 'stop' : 'send';
      /* Three ways the glyph could disagree with the tint, so the guard is on
         the INTENT plus what the DOM really reads — never on the DOM alone:
           · a flip back to the state already on screen (agent_end → agent_start
             inside the 120ms morph window) used to return early and let the
             PENDING timer land its now-wrong glyph, leaving a red button with
             a send arrow for the whole turn;
           · the icon library resolving AFTER a flip re-stamps every
             <m3e-icon name> from its ATTRIBUTE, and name is not reflected, so
             the attribute still says 'send' long after the property said
             'stop' (fixed on that side too, below);
           · force: a re-stamp with no state change at all — that is exactly
             the "library just landed" case.
         Every path that proceeds therefore cancels the old timer first, so a
         glyph can never arrive from a state the app has already left. */
      if (wanted === sendIconWanted && icon.name === wanted && !force) return;
      sendIconWanted = wanted;
      if (sendSwapTimer) { clearTimeout(sendSwapTimer); sendSwapTimer = null; }
      if (icon.name === wanted) {
        /* Nothing to morph (or a forced re-stamp): just make sure the glyph is
           not parked mid-fade and is really rendered from the current name. */
        sendBtn.classList.remove('swapping');
        stampSendIcon(icon, wanted);
        return;
      }
      /* Morph, not swap-in-place: fade+shrink out, change the glyph at the
         bottom of the fade, spring back up. */
      sendBtn.classList.add('swapping');
      sendSwapTimer = setTimeout(function () {
        sendSwapTimer = null;
        stampSendIcon(icon, wanted);
        requestAnimationFrame(function () { sendBtn.classList.remove('swapping'); });
      }, 120);
    }
    /* m3e-icon does not reflect name back to the attribute, so left alone the
       attribute would keep the markup's 'send' forever while the glyph on
       screen says 'stop' — a DOM that lies about its own state, and a trap for
       anything that reads the attribute (the library's own catch-up pass used
       to, and that is half of this bug). Write BOTH, so they can never
       disagree. And writing the same value again is a no-op Lit never
       re-renders for — bouncing through '' is what makes a re-stamp (the
       forced path) actually repaint. */
    function stampSendIcon(icon, name) {
      icon.name = '';
      icon.name = name;
      if (icon.getAttribute('name') !== name) icon.setAttribute('name', name);
    }

    // ───────────── Custom scrollbars ─────────────
    /* Native scrollbars are hidden app-wide; this overlay thumb replaces
       them on the main surfaces: fades in while scrolling, idles out after
       700ms, and is draggable (1px of thumb travel = scrollHeight/clientHeight
       px of content). host must be a positioned ancestor of scroller. */
    // opts.inset / opts.rightInset: the thumb's end gap and right gap. On the
    // rounded command panel both are 28 (corner) - 2.5 (cap radius) = 25.5px,
    // which translates the thumb so its round caps' centers land exactly on
    // the card corners' arc centers — the parallel-shift concentric design.
    // opts.bottomInset: the end gap at the BOTTOM only, which may be a
    // function because the chat's scroller reaches the viewport's bottom edge
    // and its thumb must stop above a band that changes height as you type.
    function attachScrollbar(scroller, host, opts) {
      opts = opts || {};
      const inset = opts.inset != null ? opts.inset : 4;
      const rightInset = opts.rightInset != null ? opts.rightInset : 6;
      const bottomInset = opts.bottomInset != null ? opts.bottomInset : inset;
      const bottomGap = () => (typeof bottomInset === 'function' ? bottomInset() : bottomInset);
      const track = () => scroller.clientHeight - inset - bottomGap();
      const thumb = document.createElement('div');
      thumb.className = 'scroll-thumb';
      host.appendChild(thumb);
      let hideTimer = null, dragging = false, startPointerY = 0, startScrollTop = 0;
      function paint() {
        const max = scroller.scrollHeight - scroller.clientHeight;
        if (max <= 2) { thumb.style.display = 'none'; return; }
        thumb.style.display = 'block';
        const h = Math.max(28, Math.round(scroller.clientHeight * scroller.clientHeight / scroller.scrollHeight));
        const top = scroller.getBoundingClientRect().top - host.getBoundingClientRect().top
          + inset + (max ? (scroller.scrollTop / max) * Math.max(0, track() - h) : 0);
        const right = host.getBoundingClientRect().right - scroller.getBoundingClientRect().right + rightInset;
        thumb.style.height = h + 'px';
        thumb.style.top = top + 'px';
        thumb.style.right = right + 'px';
      }
      function show() {
        paint();
        thumb.classList.add('on');
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => { if (!dragging) thumb.classList.remove('on'); }, 700);
      }
      thumb.addEventListener('pointerdown', (e) => {
        dragging = true;
        startPointerY = e.clientY;
        startScrollTop = scroller.scrollTop;
        thumb.classList.add('dragging');
        thumb.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      thumb.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const max = scroller.scrollHeight - scroller.clientHeight;
        const h = parseFloat(thumb.style.height) || 28;
        scroller.scrollTop = startScrollTop + (e.clientY - startPointerY) * (max / Math.max(1, track() - h));
      });
      const endDrag = (e) => {
        if (!dragging) return;
        dragging = false;
        thumb.classList.remove('dragging');
        try { thumb.releasePointerCapture(e.pointerId); } catch (err) {}
        show();
      };
      thumb.addEventListener('pointerup', endDrag);
      thumb.addEventListener('pointercancel', endDrag);
      scroller.addEventListener('scroll', show);
      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(show).observe(scroller);
      show();
      return { paint };
    }
    /* The band under the chat is three rows that all come and go — the live
       task panel, the held bar, and a composer whose field grows as you type
       and whose attach tray appears. The scroller reserves their sum (a hidden
       row measures 0), so publish it as ONE measured number that the bottom
       padding, the fade's anchor and the fab's seat all read, and let the
       thumb re-seat itself against it. */
    const bandEls = [inputBar, heldBar, statusPanel];
    const bandHeight = () => bandEls.reduce((h, el) => h + el.offsetHeight, 0);
    const chatScroll = attachScrollbar(chatLog, document.getElementById('chat-wrap'), {
      bottomInset: () => bandHeight() + 4,
    });
    attachScrollbar(notifList, notifPanel);
    function publishBandHeight() {
      const h = bandHeight();
      if (h) document.documentElement.style.setProperty('--_composer-h', h + 'px');
      chatScroll.paint();
    }
    if (typeof ResizeObserver !== 'undefined') {
      const bandObserver = new ResizeObserver(publishBandHeight);
      bandEls.forEach((el) => bandObserver.observe(el));
    }
    publishBandHeight();

    // ───────────── Scroll tracking ─────────────
    function atBottom() {
      return chatLog.scrollTop + chatLog.clientHeight >= chatLog.scrollHeight - 24;
    }
    function scrollBottom() {
      if (autoScroll) {
        /* Instant jump, never smooth: deltas arrive faster than a smooth
           animation converges, and the mid-flight lag trips the scroll
           handler's atBottom() check, which disengages auto-scroll for the
           rest of the stream. An exact jump keeps every scroll event at the
           bottom, so the handler always re-confirms auto-scroll. */
        chatLog.scrollTop = chatLog.scrollHeight;
      }
      scrollBtn.classList.toggle('show', !atBottom());
      /* Auto-scroll counts as "scrolling down" to the top-app-bar's hide
         behavior — the bar must not collapse just because a reply arrived.
         Double rAF: the component re-hides from its own throttled scroll
         handler one frame after ours, so reset on the frame after that. */
      requestAnimationFrame(() => requestAnimationFrame(() => {

      }));
    }
    chatLog.addEventListener('scroll', () => {
      autoScroll = atBottom();
      scrollBtn.classList.toggle('show', !autoScroll);
    });
    /* User intent beats the race where a queued delta task re-jumps to the
       bottom before the scroll handler can see the user's upward scroll. */
    const userScrollIntent = () => {
      autoScroll = false;
      scrollBtn.classList.toggle('show', !atBottom());
    };
    chatLog.addEventListener('wheel', userScrollIntent, {passive: true});
    chatLog.addEventListener('touchmove', userScrollIntent, {passive: true});
    scrollBtn.addEventListener('click', () => {
      autoScroll = true;
      chatLog.scrollTo({ top: chatLog.scrollHeight, behavior: 'smooth' });
      const hideWhenDone = () => {
        scrollBtn.classList.remove('show');
        chatLog.removeEventListener('scrollend', hideWhenDone);
      };
      chatLog.addEventListener('scrollend', hideWhenDone);
      setTimeout(hideWhenDone, 500);
    });

    // ───────────── Bubbles (Stage 1: Markdown) ─────────────
    function setContent(el, text) {
      el.classList.add('md');
      mountMarkdown(el, text);
    }
    // The markdown module emits a plain <button class="copy-btn"> in each code
    // header. Swap it for a real MD3 icon button (state layer, ripple, theme).
    function mountMarkdown(el, text) {
      el.innerHTML = renderMarkdown(text);
      el.querySelectorAll('.code-head .copy-btn').forEach((b) => {
        const btn = document.createElement('m3e-icon-button');
        btn.type = 'button';
        btn.className = 'copy-btn';
        // m3e-icon-button does NOT render its icon property (the slotted
        // <m3e-icon> is what actually paints) — so give it a real child icon,
        // the same way #send-btn carries its glyph. Setting .icon='content_copy'
        // leaves a blank circle.
        const ic = document.createElement('m3e-icon');
        ic.setAttribute('name', 'content_copy');
        btn.appendChild(ic);
        btn.setAttribute('aria-label', t('copyCode'));
        b.replaceWith(btn);
      });
    }
    // User stays a plain circle; pi wears the M3 Expressive flower from
    // @m3e/web's shape library. Errors keep the error palette but drop the
    // flower for a plain circle, so they read as a system voice, not pi.
    function makeAvatar(role) {
      const icon = role === 'user'
        ? '<m3e-icon name="person"></m3e-icon>'
        : role === 'error'
          ? '<m3e-icon name="error_outline"></m3e-icon>'
          : '<m3e-icon name="auto_awesome"></m3e-icon>';
      const s = document.createElement('m3e-shape');
      s.name = role === 'user' ? 'arch'
        : role === 'error' ? 'circle' : '4-leaf-clover';
      s.className = 'avatar';
      const fill = document.createElement('div');
      fill.className = 'avatar-fill'
        + (role === 'error' ? ' error' : role === 'user' ? ' user' : '');
      fill.innerHTML = icon;
      s.appendChild(fill);
      return s;
    }
    /* The file chips / thumbnails inside a committed user bubble. A text that
       was only the server's "(attached: x)" placeholder is suppressed: the chips
       already say it, and showing both reads like a duplicate. */
    function mountAttachments(bub, attachments) {
      const list = (attachments || []).filter(a => a && a.url);
      if (!list.length) return;
      const box = document.createElement('div');
      box.className = 'bubble-attachments';
      for (const a of list) {
        const link = document.createElement('a');
        link.href = a.url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.title = a.name;
        if (a.kind === 'image') {
          // The card frames the thumbnail, so it carries the padding the image's
          // radius is derived from (see .image-card / img in the stylesheet).
          link.classList.add('image-card');
          const img = document.createElement('img');
          img.src = a.url;
          img.alt = a.name;
          img.loading = 'lazy';
          link.appendChild(img);
        } else {
          const glyph = document.createElement('m3e-icon');
          glyph.setAttribute('name', 'description');
          glyph.style.fontSize = '1rem';
          const name = document.createElement('span');
          name.className = 'fname';
          name.textContent = a.name;
          link.append(glyph, name);
        }
        box.appendChild(link);
      }
      bub.appendChild(box);
    }
    function addBubble(role, text, attachments) {
      const wrap = document.createElement('div');
      wrap.className = 'msg ' + role;
      const avatar = makeAvatar(role);
      const bub = document.createElement('div');
      bub.className = 'bubble';
      const hasFiles = !!(attachments && attachments.length);
      // The server substitutes a descriptive line for a file-only message; with
      // the chips rendered that line is redundant.
      const placeholder = hasFiles && /^\\(attached(:| \\d)/.test(text || '');
      if (role === 'assistant' || role === 'error') {
        bub.classList.add('md');
        mountMarkdown(bub, text);
        attachBubbleCopy(bub, text);
      } else if (!(hasFiles && placeholder)) {
        bub.textContent = text;
      }
      wrap.appendChild(avatar);
      wrap.appendChild(bub);
      if (hasFiles) mountAttachments(bub, attachments);
      chatLog.appendChild(wrap);
      scrollBottom();
      return bub;
    }
    function appendTextDelta(delta) {
      streamText += delta;
      if (!currentBubble) {
        // Models emit whitespace-only text parts around tool calls; a bubble
        // for them renders as an empty min-height blob, so hold off until
        // real (non-whitespace) text arrives.
        if (!streamText.trim()) return;
        const wrap = document.createElement('div');
        wrap.className = 'msg assistant';
        const av = makeAvatar('assistant');
        const bub = document.createElement('div');
        bub.className = 'bubble md';
        wrap.appendChild(av); wrap.appendChild(bub);
        chatLog.appendChild(wrap);
        currentBubble = bub;
      }
      currentBubble.textContent = streamText;
      scrollBottom();
    }
    function closeBubble() {
      if (currentBubble) {
        if (streamText.trim()) {
          mountMarkdown(currentBubble, streamText);
          attachBubbleCopy(currentBubble, streamText);
        } else {
          // Whitespace-only turn: the placeholder row would linger as an
          // empty bubble — remove it entirely.
          const wrap = currentBubble.closest('.msg') || currentBubble.parentNode;
          if (wrap) wrap.remove();
        }
      }
      currentBubble = null; streamText = '';
    }
    function attachBubbleCopy(el, rawText) {
      el.__copyText = rawText;
      const b = document.createElement('m3e-icon-button');
      b.type = 'button';
      b.className = 'copy-btn bubble-copy';
      const ic = document.createElement('m3e-icon');
      ic.setAttribute('name', 'content_copy');
      b.appendChild(ic);
      b.setAttribute('aria-label', t('copyMessage'));
      el.appendChild(b);
    }
    chatLog.addEventListener('click', (e) => {
      const btn = e.target.closest && e.target.closest('.copy-btn');
      if (!btn) return;
      // A code-block copy button copies only that block; a bubble copy button
      // copies the whole message. Both are styled by .copy-btn upstream.
      const block = btn.closest('.code-block');
      if (block) {
        const code = block.querySelector('code');
        copyText(code ? code.textContent : '', btn);
        return;
      }
      const bub = btn.closest('.bubble');
      if (!bub) return;
      copyText(bub.__copyText != null ? bub.__copyText : bub.textContent, btn);
    });
    function flashCopied(btn) {
      if (!btn) return;
      const ic = btn.querySelector('m3e-icon');
      if (ic) ic.setAttribute('name', 'check');
      btn.classList.add('copied');
      setTimeout(() => { if (ic) ic.setAttribute('name', 'content_copy'); btn.classList.remove('copied'); }, 1200);
    }
    function fallbackCopy(text, btn) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        flashCopied(btn);
      } catch (e) {}
    }
    function copyText(text, btn) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => flashCopied(btn), () => fallbackCopy(text, btn));
      } else {
        fallbackCopy(text, btn);
      }
    }

    // ───────────── Turn time / system line ─────────────
    function fmtClock(ts) {
      if (!ts) return '';
      const d = new Date(ts);
      const pad = n => (n < 10 ? '0' : '') + n;
      return pad(d.getHours()) + ':' + pad(d.getMinutes());
    }
    function addTurnTime(ts, roleClass) {
      const el = document.createElement('div');
      el.className = 'turn-time ' + roleClass;
      el.textContent = fmtClock(ts || Date.now());
      chatLog.appendChild(el);
      scrollBottom();
    }
    function addSystemLine(text) {
      const el = document.createElement('div');
      el.className = 'sysnote';
      el.textContent = text;
      chatLog.appendChild(el);
      scrollBottom();
      return el;
    }

    // ───────────── Stage 2: Thinking ─────────────
    function thinkingSummary(n) {
      return 'Thinking… (' + n + (n === 1 ? ' line' : ' lines') + ')';
    }
    function thinkingLineCount(text) {
      return text ? text.split('\\n').length : 0;
    }
    function makeThinkingEl(text, live) {
      const wrap = document.createElement('m3e-expansion-panel');
      wrap.className = 'thinking';
      // The card draws its own chevron (.thinking-header::before, left of the
      // label); m3e-expansion-panel would add a second one on the right.
      // hide-toggle forwards to the inner m3e-expansion-header and drops it.
      wrap.setAttribute('hide-toggle', '');
      const header = document.createElement('div');
      header.setAttribute('slot', 'header');
      header.className = 'thinking-header';
      // The live loading indicator marks streaming; finished cards carry the
      // label alone — a spinner on a folded card would read as activity
      // that isn't there.
      if (live) {
        const spin = document.createElement('m3e-loading-indicator');
        spin.className = 'thinking-spin';
        header.appendChild(spin);
      }
      const lbl = document.createElement('span');
      lbl.className = 'thinking-label';
      lbl.textContent = thinkingSummary(thinkingLineCount(text));
      header.appendChild(lbl);
      const body = document.createElement('pre');
      body.className = 'thinking-body';
      body.textContent = text || '';
      wrap.appendChild(header);
      wrap.appendChild(body);
      if (live || !text) wrap.open = true;
      chatLog.appendChild(wrap);
      scrollBottom();
      return wrap;
    }
    function appendThinkingDelta(delta) {
      if (!currentThinking) {
        currentThinking = makeThinkingEl('', true);
        thinkingText = '';
        startSpin();
      }
      thinkingText += delta;
      currentThinking.querySelector('.thinking-body').textContent = thinkingText;
      currentThinking.querySelector('.thinking-label').textContent =
        thinkingSummary(thinkingLineCount(thinkingText));
      scrollBottom();
    }
    function finalizeThinking() {
      if (currentThinking) {
        /* Streaming stays expanded so you can watch it think; on completion
           the block folds back up unless the user turned that off. */
        if (thinkingAutoCollapse()) {
          currentThinking.open = false;
        }
        currentThinking.querySelector('.thinking-spin')?.remove();
        currentThinking = null; thinkingText = '';
        stopSpinIfIdle();
      } else {
        thinkingText = '';
      }
    }

    // ───────────── Stage 2: Tool call cards ─────────────
    // Returns a small facade {root, header, body} over the m3e-expansion-panel
    // structure so call sites can append results/elapsed without knowing it.
    function addToolCall(toolName, args, toolCallId, isError) {
      const wrap = document.createElement('m3e-expansion-panel');
      wrap.className = 'tool-call' + (isError ? ' error' : '');
      wrap.id = 'tool-' + toolCallId;
      // Same as .thinking: the card's own ::before chevron is the only one.
      wrap.setAttribute('hide-toggle', '');
      const header = document.createElement('div');
      header.setAttribute('slot', 'header');
      header.className = 'tool-header';
      const lbl = document.createElement('span');
      lbl.className = 'tool-label';
      lbl.textContent = toolSummary(toolName, args);
      header.appendChild(lbl);
      const badge = toolBadge(toolName, args);
      if (badge && (badge.added || badge.removed)) {
        const b = document.createElement('span');
        b.className = 'tool-badge';
        b.textContent = '+' + badge.added + ' −' + badge.removed;
        header.appendChild(b);
      }
      const body = document.createElement('div');
      body.className = 'tool-body';
      const diffHtml = toolDiffHtml(toolName, args);
      if (diffHtml) {
        const dv = document.createElement('div');
        dv.className = 'tool-diff';
        dv.innerHTML = diffHtml;
        body.appendChild(dv);
      }
      wrap.appendChild(header);
      wrap.appendChild(body);
      chatLog.appendChild(wrap);
      scrollBottom();
      return { root: wrap, header: header, body: body };
    }
    function appendElapsed(d, elapsedMs) {
      const s = d && d.header;
      if (!s || s.querySelector('.tool-elapsed')) return;
      const txt = fmtElapsed(elapsedMs);
      if (!txt) return;
      const e = document.createElement('span');
      e.className = 'tool-elapsed';
      e.textContent = '· ' + txt;
      s.appendChild(e);
    }
    function contentBlocksText(result) {
      const blocks = Array.isArray(result) ? result
        : (result && Array.isArray(result.content)) ? result.content
        : null;
      if (!blocks) return null;
      const parts = [];
      for (const b of blocks) {
        if (typeof b === 'string') parts.push(b);
        else if (b && b.type === 'text' && typeof b.text === 'string') parts.push(b.text);
      }
      return parts.length ? parts.join('\\n') : null;
    }
    function toolResultText(result) {
      if (result == null) return '';
      if (typeof result === 'string') return result.slice(0, 8000);
      const text = contentBlocksText(result);
      const r = text != null ? text : JSON.stringify(result, null, 2);
      return (r == null ? '' : r).slice(0, 8000);
    }

    // ───────────── Stage 3: Held bar ─────────────
    function renderHeld() {
      if (!held.length) { heldBar.style.display = 'none'; return; }
      heldBar.style.display = 'flex';
      heldLabel.textContent = held.length === 1
        ? 'waiting for the task turn:'
        : held.length + ' waiting for the task turn:';
      heldTextEl.textContent = held.join(' · ');
    }
    heldClearBtn.addEventListener('click', () => {
      if (!ws || ws.readyState !== 1) return;
      ws.send(JSON.stringify({ type: 'clear_held' }));
    });

    // ───────────── Stage 3: Widget panel ─────────────
    function renderWidgets() {
      if (taskWidgetData) {
        statusPanel.classList.add('structured');
        statusPanel.style.display = 'block';
        const d = taskWidgetData;
        const title = '<div class="widget-title">' + escHtml(d.title || '') + '</div>';
        const meta = '<div class="widget-meta">'
          + (d.phase ? '<span class="widget-phase">' + escHtml(d.phase) + '</span>' : '')
          + (d.total > 0 && d.done != null ? '<span class="widget-step">' + d.done + '/' + d.total + '</span>' : '')
          + (d.elapsed ? '<span class="widget-elapsed">' + escHtml(d.elapsed) + '</span>' : '')
          + '</div>';
        let bar = '';
        if (d.total > 0 && d.done != null) {
          bar = '<m3e-linear-progress-indicator class="widget-bar" variant="wavy"'
            + ' value="' + d.done + '" max="' + d.total + '"'
            + ' aria-label="task progress"></m3e-linear-progress-indicator>';
        }
        const action = d.action ? '<div class="widget-action">↳ ' + escHtml(d.action) + '</div>' : '';
        statusPanel.innerHTML = title + meta + bar + action;
        return;
      }
      statusPanel.classList.remove('structured');
      if (taskWidgetLines && taskWidgetLines.length) {
        statusPanel.textContent = taskWidgetLines.join('\\n');
        statusPanel.style.display = 'block';
      } else {
        statusPanel.style.display = 'none';
      }
    }

    // ───────────── Stage 3: Toast + notif history ─────────────
    function showToast(message, level) {
      const prefix = level === 'error' ? '✕ ' : level === 'warning' ? '⚠ ' : '';
      // Recorded first: the history panel must survive a CDN that will not load.
      recordNotif(message, level);
      // The @m3e/web snackbar subpath exports the M3eSnackbar class, not a
      // snackbar() function, so the call is M3eSnackbar.open(text, options).
      // The options this used to pass (placement/closeable/autoCloseDelay) were
      // mdui 2.x's shape and are silently ignored here — m3e's own names are
      // duration/closeLabel. Loaded lazily so a CDN failure costs a toast, not
      // the whole client.
      import('https://esm.sh/@m3e/web@${M3E_VERSION}/snackbar')
        .then((mod) => mod.M3eSnackbar.open(prefix + message, {duration: 4000}))
        .catch(() => {});
    }
    function recordNotif(message, level) {
      notifHistory.unshift({message, level: level || 'info', ts: Date.now()});
      if (notifHistory.length > 20) notifHistory.pop();
      if (notifOpen) renderNotifList();
    }
    /* Both hosts' lists are filled: only one is visible, but the hidden one
       must not be stale, or crossing the breakpoint would show an old list. */
    const notifListNow = () => (isWide() ? notifList : notifSheetList);
    function renderNotifList() {
      const html = notifHistory.length ? notifListHtml() : '<div id="notif-empty">' + t('noNotifications') + '</div>';
      for (const el of [notifList, notifSheetList]) if (el) el.innerHTML = html;
    }
    function notifListHtml() {
      const LEVEL_ICON = { error: 'error', warning: 'warning', info: 'info' };
      let html = '';
      for (let i = 0; i < notifHistory.length; i++) {
        const n = notifHistory[i];
        html += '<m3e-list-item class="notif-item ' + escHtml(n.level) + '">'
          + '<m3e-icon slot="leading" name="' + (LEVEL_ICON[n.level] || 'info') + '"></m3e-icon>'
          + '<div>' + escHtml(n.message) + '</div>'
          + '<div slot="supporting-text">' + escHtml(fmtClock(n.ts)) + '</div>'
          + '</m3e-list-item>';
      }
      return html;
    }

    // ───────────── Stage 3: Bell + push ─────────────
    const NOTIFY_KEY = 'piRemoteNotify';
    const THINKING_COLLAPSE_KEY = 'piRemoteThinkingCollapse';
    function thinkingAutoCollapse() {
      return localStorage.getItem(THINKING_COLLAPSE_KEY) !== '0';
    }
    function updateThinkingCollapseSwitch() {
      const el = thinkingCollapseNow();
      if (el) el.checked = thinkingAutoCollapse();
    }
    function notifyEnabled() {
      return localStorage.getItem(NOTIFY_KEY) === '1'
        && typeof Notification !== 'undefined'
        && Notification.permission === 'granted';
    }
    function notifyEnvIssue() {
      if (typeof Notification === 'undefined') return t('notifNoPush');
      if (!window.isSecureContext) return t('notifNeedsHttps');
      const isIOS = /iP(hone|ad|od)/i.test(navigator.userAgent);
      const standalone = navigator.standalone === true
        || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
      if (isIOS && !standalone) return t('notifIosInstall');
      return null;
    }
    function updateBell() {
      const on = notifyEnabled();
      // The bell's LIT state used to be a primary-colour tint via .on; now the
      // button is a tonal toggle and its pressed fill already means "panel
      // open", so push-enabled is shown only by the switch in the panel.
      // Both hosts carry a switch; the invisible one is kept in step so
      // crossing the breakpoint cannot show a stale toggle.
      for (const el of [notifToggle, notifSheetToggle]) if (el) el.checked = on;
      updateThinkingCollapseSwitch();
    }
    /* Open/close goes through the host the current form calls for: a class
       toggle on the dropdown card, show()/hide() on the sheet. The flags stay
       the app bar's mirror of whichever one is live. */
    function setNotifOpen(open) {
      notifOpen = open;
      // Tonal toggle: selected IS the open indicator, so the button reads as
      // pressed exactly while its panel is up. Multi-mode keeps the two
      // independent (opening settings need not close notifications).
      notifBtn.toggleAttribute('selected', open);
      notifBtn.selected = open;
      if (open) { renderNotifList(); updateBell(); }
      openPanel('notif', open);
    }
    function setSettingsOpen(open) {
      settingsOpen = open;
      settingsBtn.toggleAttribute('selected', open);
      settingsBtn.selected = open;
      if (open) { updateThinkingCollapseSwitch(); renderModelMenu(); }
      openPanel('settings', open);
    }
    /** Show or hide one panel in whichever form is active. */
    function openPanel(name, open) {
      const host = hostOf(name);
      if (host === panels[name].sheet) {
        if (open) host.show(); else host.hide();
      } else if (host === modelMenu) {
        /* The library's menu owns its own opening (the trigger does it) and its
           outside click and Escape, so the app only ever closes it — hideAll, so
           a nested submenu cannot survive the parent going away. */
        if (!open) host.hideAll(true);
      } else {
        host.classList.toggle('open', open);
        host.setAttribute('aria-hidden', open ? 'false' : 'true');
      }
    }
    document.addEventListener('change', (e) => {
      const el = thinkingCollapseNow();
      if (!el || e.target !== el) return;
      localStorage.setItem(THINKING_COLLAPSE_KEY, el.checked ? '1' : '0');
      if (el.checked) {
        document.querySelectorAll('m3e-expansion-panel.thinking[open]').forEach((c) => {
          c.open = false;
        });
      }
      showToast(el.checked ? t('thinkingWillCollapse') : t('thinkingStaysOpen'), 'info');
    });
    function togglePush() {
      if (localStorage.getItem(NOTIFY_KEY) === '1') {
        localStorage.setItem(NOTIFY_KEY, '0');
        updateBell();
        showToast(t('notifOff'), 'info');
        return;
      }
      const issue = notifyEnvIssue();
      if (issue) { showToast(issue, 'warning'); return; }
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        showToast(t('notifUnsupported'), 'warning');
        return;
      }
      Notification.requestPermission().then((perm) => {
        if (perm !== 'granted') {
          showToast(t('notifPermissionDenied'), 'warning');
          return;
        }
        subscribePush().then((ok) => {
          if (ok) {
            localStorage.setItem(NOTIFY_KEY, '1');
            showToast(t('notifOn'), 'info');
          } else {
            showToast(t('notifSubscribeFailed'), 'warning');
          }
          updateBell();
        }).catch((e) => {
          showToast(t('notifSetupFailed') + (e && e.message ? e.message : e), 'warning');
          updateBell();
        });
      });
    }
    function urlB64ToUint8Array(base64) {
      const pad = '='.repeat((4 - base64.length % 4) % 4);
      const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
      const raw = atob(b64);
      const arr = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
      return arr;
    }
    function subscribePush() {
      return navigator.serviceWorker.register('/sw.js')
        .then(() => navigator.serviceWorker.ready)
        .then((reg) => fetch('/push-key').then((r) => r.text()).then((key) =>
          reg.pushManager.getSubscription().then((existing) =>
            existing || reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlB64ToUint8Array(key.trim())
            })
          )
        ))
        .then((sub) => fetch('/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub)
        }).then((r) => r.ok));
    }
    function closeModelMenu() {
      if (modelMenuOpen) openPanel('model', false);
    }
    notifBtn.addEventListener('click', (e) => {
      e.stopImmediatePropagation();
      closeModelMenu();
      setSettingsOpen(false);
      setNotifOpen(!notifOpen);
    });
    settingsBtn.addEventListener('click', (e) => {
      e.stopImmediatePropagation();
      closeModelMenu();
      setNotifOpen(false);
      setSettingsOpen(!settingsOpen);
    });
    /* Two ways a panel can close without the buttons: the dropdown's
       click-outside, and the sheet's scrim / drag handle / Escape. Both feed
       the same flags. */
    document.addEventListener('click', (e) => {
      /* A click inside one of the menus is a click on a control the panel
         opened, not an outside click: #theme-menu and #accent-menu live at the
         top level so a sheet cannot clip them, which puts them outside
         #settings-panel's subtree. */
      if (e.target instanceof Element && e.target.closest && e.target.closest('m3e-menu')) return;
      for (const [name, flag] of [['notif', () => notifOpen], ['settings', () => settingsOpen]]) {
        const host = panels[name].dropdown;
        if (!host.classList.contains('open')) continue;
        const btn = name === 'notif' ? notifBtn : settingsBtn;
        if (host.contains(e.target) || e.target === btn) continue;
        if (name === 'notif') setNotifOpen(false); else setSettingsOpen(false);
      }
    });
    for (const name of ['notif', 'settings']) {
      const sheet = panels[name].sheet;
      if (!sheet) continue;
      sheet.addEventListener('closed', () => { if (name === 'notif') { notifOpen = false; notifBtn.toggleAttribute('selected', false); notifBtn.selected = false; } else { settingsOpen = false; settingsBtn.toggleAttribute('selected', false); settingsBtn.selected = false; } });
      sheet.addEventListener('opened', () => { if (name === 'notif') { notifOpen = true; notifBtn.toggleAttribute('selected', true); notifBtn.selected = true; } else { settingsOpen = true; settingsBtn.toggleAttribute('selected', true); settingsBtn.selected = true; } });
    }
    notifToggle.addEventListener('change', togglePush);
    updateBell();

    // ───────────── Model picker ─────────────
    // Fed by the server's models frame (on connect, on session_start and after
    // each switch). Two forms: an m3e-menu anchored to the composer's model
    // button on a wide screen, a segmented action list inside a modal bottom
    // sheet on a phone. Choosing one sends set_model, and the fresh frame that
    // comes back re-renders the tick — no optimistic check, so a rejected
    // switch can't leave the list lying.
    function escAttr(s) {
      return escHtml(s).replace(/"/g, '&quot;');
    }
    /* The wide form is a real m3e-menu and takes m3e-menu-item-radio rows
       (the library's own selection, keyboard handling and tick); the sheet form
       takes m3e-list-action rows in a segmented action list — same two-line
       content, and the app's own tick in the trailing slot. Both are rendered
       every time — the hidden one must not go stale, or crossing the breakpoint
       would show an outdated list. */
    function renderModelMenu() {
      if (!modelCatalog.models.length) {
        const empty = '<div id="model-empty">' + t('noSwitchableModel') + '</div>';
        modelMenu.innerHTML = empty;
        if (modelSheetList) modelSheetList.innerHTML = empty;
        return;
      }
      let menuHtml = '', sheetHtml = '';
      for (const md of modelCatalog.models) {
        const cur = md.spec === modelCatalog.current;
        const provider = md.spec.split('/')[0] || md.spec;
        menuHtml += '<m3e-menu-item-radio data-spec="' + escAttr(md.spec) + '"'
                  + (cur ? ' checked' : '') + '>'
                  // Single root child: the item lays its default-slot content
                  // out as a flex ROW (leading check + label), so the two text
                  // lines must live inside one wrapper to stack vertically.
                  + '<span class="model-row-main">'
                  + '<span class="model-row-name">' + escHtml(md.name) + '</span>'
                  + '<span class="model-row-spec">' + escHtml(provider) + '</span>'
                  + '</span>'
                  + '</m3e-menu-item-radio>';
        sheetHtml += '<m3e-list-action class="model-row' + (cur ? ' current' : '') + '"'
                   + ' data-spec="' + escAttr(md.spec) + '"'
                   + (cur ? ' aria-current="true"' : '') + '>'
                   + '<span class="model-row-main">'
                   + '<span class="model-row-name">' + escHtml(md.name) + '</span>'
                   + '<span class="model-row-spec">' + escHtml(provider) + '</span>'
                   + '</span>'
                   + (cur ? '<m3e-icon slot="trailing" class="model-row-check" name="check"></m3e-icon>' : '')
                   + '</m3e-list-action>';
      }
      modelMenu.innerHTML = menuHtml;
      if (modelSheetList) modelSheetList.innerHTML = sheetHtml;
    }
    /* Two forms, like the other panels: an m3e-menu anchored to the composer's
       model button on a wide screen, and a modal bottom sheet on a phone.

       The wide form keeps the library's own trigger and its toggle event —
       that is what anchors the menu, owns its focus ring and Escape handling,
       and closes it on an outside click. (A click listener on the trigger
       itself never fires: m3e-menu-trigger stops the event inside itself.)
       Rows are refreshed when the menu opens, exactly as before. */
    modelMenu.addEventListener('toggle', () => {
      const open = modelMenu.isOpen;
      modelMenuOpen = open;
      modelBtn.classList.toggle('open', open);
      if (open) { setNotifOpen(false); setSettingsOpen(false); renderModelMenu(); }
    });
    /* Phone form. The handler sits on the BUTTON, not on #model-slot: the
       trigger wraps the button and stops the click before it bubbles one level
       further, so a wrapper-level listener would never run and a phone tap
       would open nothing. On a wide screen this returns immediately and the
       library's trigger owns the menu. */
    function toggleModelPhonePanel(e) {
      if (isWide()) return; // the library's trigger handles the wide form
      if (e) e.preventDefault();
      setNotifOpen(false);
      setSettingsOpen(false);
      if (modelMenuOpen) { openPanel('model', false); return; }
      renderModelMenu();
      openPanel('model', true);
    }
    modelBtn.addEventListener('click', toggleModelPhonePanel);
    // Narrow form: the sheet's lifecycle.
    if (modelSheet) {
      modelSheet.addEventListener('opened', () => {
        modelMenuOpen = true;
        modelBtn.classList.add('open');
      });
      modelSheet.addEventListener('closed', () => {
        modelMenuOpen = false;
        modelBtn.classList.remove('open');
      });
    }
    /* A pick is a pick in either form: send it, say so, close the panel. The
       tick only moves when the server's next models frame says it may. */
    function pickModel(spec) {
      if (!spec || !ws || ws.readyState !== 1) return;
      ws.send(JSON.stringify({ type: 'set_model', spec }));
      const chosen = modelCatalog.models.find((x) => x.spec === spec);
      showToast(chosen ? t('modelSwitched') + chosen.name : t('modelSwitching'), 'info');
      openPanel('model', false);
    }
    /* Rows and items are re-created with every catalogue frame, so activation
       is delegated: on the document for the sheet's action-list rows, and on
       the menu element (a stable top-level host) for its radio items. */
    document.addEventListener('click', (e) => {
      const row = e.target instanceof Element && e.target.closest ? e.target.closest('.model-row') : null;
      if (row) pickModel(row.getAttribute('data-spec'));
    });
    modelMenu.addEventListener('click', (e) => {
      const item = e.target instanceof Element && e.target.closest
        ? e.target.closest('m3e-menu-item-radio') : null;
      if (item) pickModel(item.getAttribute('data-spec'));
    });

    // ───────────── Session sidebar ─────────────
    // Fed by the server's sessions frame (on connect and every drawer open).
    // Tapping a row asks the server to switchSession; the replacement re-runs
    // registration, whose session_start resets the view and backfills the
    // target transcript, so the update arrives as frames — never optimistic.
    function fmtSessionTime(iso) {
      const d = new Date(iso);
      if (isNaN(d)) return '';
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      }
      const md = (d.getMonth() + 1) + '/' + d.getDate();
      return d.getFullYear() === now.getFullYear() ? md : d.getFullYear() + '/' + md;
    }
    function syncSessionItem(it, s, cur) {
      it._sessionPath = s.path;
      // The unsaved row is the session pi has not flushed to disk yet (a
      // brand-new conversation): it has no timestamp or message count to show,
      // and calling it 空会话 would read as some stale empty conversation
      // instead of the one being typed into right now.
      it.querySelector('.s-title').textContent = sessionTitle(s);
      it.querySelector('.s-sub').textContent = s.unsaved
        ? t('currentSessionUnsaved')
        : fmtSessionTime(s.modified) + ' · ' + s.messageCount + ' ' + t('messageCount');
      // toggleAttribute is a no-op when unchanged: the freshly clicked item
      // already carries native selected, so the indicator's grow animation
      // is never restarted by a data refresh. The property is the one the
      // component writes when its own click handler selects a row, so it is
      // stamped too — an attribute-only write would leave a stale property.
      it.selected = !!cur;
      it.toggleAttribute('selected', !!cur);
      // The trash button sits on every row. The CURRENT row keeps it
      // disabled while the model is replying (the server refuses the same
      // window — a run keeps appending to the file). Managed here, not at
      // row-creation time, because which row is current — and whether the
      // agent is running — both change without the row set changing.
      let del = it.querySelector('.s-del');
      if (!del) {
        del = document.createElement('button');
        del.type = 'button';
        del.className = 's-del';
        del.slot = 'trailing';
        del.title = t('deleteSession');
        del.setAttribute('aria-label', t('deleteSession'));
        const di = document.createElement('m3e-icon');
        di.setAttribute('name', 'delete');
        del.appendChild(di);
        // The row's own click handler switches sessions; a trash tap must stay
        // a trash tap, so it never reaches that listener.
        del.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          openSessionDelete(it);
        });
        it.appendChild(del);
      }
      del.disabled = !!cur && agentRunning;
      del.title = del.disabled ? t('deleteBusy') : t('deleteSession');
    }
    // The current row's trash greys out for the whole agent run and comes
    // back when the reply ends. Called from every agentRunning flip and at
    // the end of renderSessions, so a data refresh re-derives the state too.
    function syncDeleteStates() {
      for (const it of sessionList.querySelectorAll('m3e-list-option')) {
        const del = it.querySelector('.s-del');
        if (!del) continue;
        const cur = it._sessionPath === sessionData.current;
        del.disabled = cur && agentRunning;
        del.title = del.disabled ? t('deleteBusy') : t('deleteSession');
      }
    }
    function renderSessions() {
      const sessions = sessionData.sessions || [];
      if (!sessions.length) {
        sessionList.innerHTML = '<div class="s-empty">' + t('noOtherSessions') + '</div>';
        return;
      }
      // Keyed in-place update: when the catalogue is unchanged (same paths,
      // same order), sync text + selection on the existing items instead of
      // rebuilding. Recreating the nodes re-mounts the selected item, which
      // replays the indicator animation and flashes the whole row.
      const existing = sessionList.querySelectorAll('m3e-list-option');
      const sameOrder = existing.length === sessions.length
        && [...existing].every((el, i) => el._sessionPath === sessions[i].path);
      if (!sameOrder) {
        sessionList.innerHTML = '';
        for (const s of sessions) {
          const it = document.createElement('m3e-list-option');
          const ic = document.createElement('m3e-icon');
          ic.slot = 'leading';
          ic.setAttribute('name', 'history');
          const title = document.createElement('span');
          title.className = 's-title';
          const sub = document.createElement('span');
          sub.slot = 'supporting-text';
          sub.className = 's-sub';
          it.append(ic, title, sub);
          it.addEventListener('click', e => {
            // Trash taps bubble here too — the confirm-dialog flow owns them.
            if (e.target && e.target.closest && e.target.closest('.s-del')) return;
            drawer.start = false;
            if (!ws || ws.readyState !== 1) return;
            // Compare against the SERVER's current session, never against the
            // row's selected state. m3e-list-option marks the clicked row (and
            // the selection list clears the previous one) from inside the
            // component, and that mutation lands before this host-level bubble
            // listener runs — so a state check would swallow every real tap and
            // no row could ever be switched. Path equality is the same fact
            // with no timing trap.
            if (it._sessionPath === sessionData.current) return;
            ws.send(JSON.stringify({ type: 'switch_session', path: it._sessionPath }));
            showToast(t('sessionSwitching'), 'info');
          });
          syncSessionItem(it, s, s.path === sessionData.current);
          sessionList.appendChild(it);
        }
        return;
      }
      sessions.forEach((s, i) => syncSessionItem(existing[i], s, s.path === sessionData.current));
      syncDeleteStates();
    }
    // ── Session delete: the trash button opens the dialog, the two buttons
    // close it, and the confirm one also fires delete_session for the row
    // that was pending when the dialog opened. ──
    let pendingDeletePath = null;
    function openSessionDelete(it) {
      const title = it.querySelector('.s-title').textContent || '';
      pendingDeletePath = it._sessionPath;
      sessionDeleteText.textContent = t('confirmDeleteSession', title);
      sessionDeleteDialog.open = true;
    }
    // Plain buttons + explicit open=false, exactly the prompt-card's mechanism
    // (m3e-dialog-action's hide() path breaks slot rendering on the SECOND
    // open of the same dialog, so the working pattern wins). The server
    // re-scans and pushes a fresh sessions frame; the keyed renderer rebuilds
    // the list and the deleted row is simply gone.
    document.getElementById('session-delete-cancel').addEventListener('click', () => {
      pendingDeletePath = null;
      sessionDeleteDialog.open = false;
    });
    document.getElementById('session-delete-confirm').addEventListener('click', () => {
      const path = pendingDeletePath;
      pendingDeletePath = null;
      sessionDeleteDialog.open = false;
      if (!path) return;
      if (!ws || ws.readyState !== 1) {
        showToast(t('sessionDeleteFailed'), 'error');
        return;
      }
      ws.send(JSON.stringify({ type: 'delete_session', path }));
    });
    menuBtn.addEventListener('click', () => {
      drawer.start = true;
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'list_sessions' }));
    });
    drawerClose.addEventListener('click', () => {
      drawer.start = false;
    });

    // ───────────── Stage 3: Command autocomplete ─────────────
    const COMMANDS = [
      { name: '/task',             desc: 'Start a new task' },
      { name: '/task-plan',        desc: 'Plan one task with the model, then run it' },
      { name: '/task-list',        desc: 'List tasks in this project' },
      { name: '/task-resume',      desc: 'Resume a task' },
      { name: '/task-cancel',      desc: 'Cancel the currently running task' },
      { name: '/task-auto',        desc: 'Plan a feature into tasks and run them' },
      { name: '/task-auto-resume', desc: 'Resume the active /task-auto run' },
      { name: '/task-auto-cancel', desc: 'Stop the running /task-auto loop' },
      { name: '/new',              desc: 'Start a new session' },
      { name: '/compact',          desc: 'Compact context to save tokens' },
      { name: '/remote stop',      desc: 'Stop the remote server' },
    ];
    let cmdActive = [], cmdIndex = -1;
    function updateSuggestions() {
      const val = inputEl.value || '';
      if (!val.startsWith('/')) { cmdActive = []; cmdIndex = -1; renderSuggestions(); return; }
      cmdActive = COMMANDS.filter((c) => c.name.startsWith(val));
      cmdIndex = cmdActive.length === 1 ? 0 : -1;
      renderSuggestions();
    }
    function renderSuggestions() {
      cmdSuggestions.innerHTML = '';
      if (!cmdActive.length) { cmdSuggestions.style.display = 'none'; return; }
      cmdSuggestions.style.display = 'block';
      // The notif and settings lists' own component: a segmented m3e-list whose
      // rows are m3e-list-item, so the metrics, the per-position corners, the
      // plate and the supporting-text line all come from the library — as does
      // the scrolling, which is why no hand-drawn thumb is painted for this
      // panel any more.
      let html = '<m3e-list variant="segmented">';
      cmdActive.forEach((cmd, i) => {
        html += '<m3e-list-item' + (i === cmdIndex ? ' class="active"' : '')
              + ' data-i="' + i + '">'
              + '<span class="cmd-name">' + escHtml(cmd.name) + '</span>'
              + '<span slot="supporting-text">' + escHtml(cmd.desc) + '</span>'
              + '</m3e-list-item>';
      });
      cmdSuggestions.innerHTML = html + '</m3e-list>';
    }
    // Bound once, outside the render: the panel element survives every
    // re-render, so registering per render would stack duplicate handlers.
    // mousedown, not click — pressing a row must not move focus out of the
    // field — and mousedown retargets to the m3e-list-item host, which is what
    // makes one delegated handler cover rows parsed from the string above.
    cmdSuggestions.addEventListener('mousedown', (e) => {
      const row = (e.target instanceof Element ? e.target.closest('m3e-list-item') : null);
      if (!row) return;
      e.preventDefault();
      pickCmd(Number(row.dataset.i));
    });
    function pickCmd(i) {
      const cmd = cmdActive[i];
      if (!cmd) return;
      inputEl.value = cmd.name + ' ';
      // Same autosize catch-up as sendMessage: value was set programmatically.
      inputEl.dispatchEvent(new Event('input'));
      cmdActive = []; cmdIndex = -1; renderSuggestions();
      inputEl.focus();
    }

    // ───────────── Attachments ─────────────
    /* Files are uploaded the moment they are picked/dropped, so Send only has
       to reference ids — a 20 MB paste never rides the transcript socket. The
       tray shows progress and lets a single chip be removed; the ids are sent
       with the chat line and the server stores/resolves them (uploads.ts). */
    function attachmentBytes(n) {
      if (n < 1024) return n + ' B';
      if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
      return (n / (1024 * 1024)).toFixed(1) + ' MB';
    }
    function uploadsBusy() {
      return pendingAttachments.some(a => a.pending);
    }
    function renderAttachments() {
      attachTray.innerHTML = '';
      attachTray.classList.toggle('show', pendingAttachments.length > 0);
      for (const a of pendingAttachments) {
        const chip = document.createElement('div');
        chip.className = 'attach-chip'
          + (a.kind === 'image' ? ' thumb' : '')
          + (a.pending ? ' uploading' : '');
        if (a.kind === 'image' && !a.pending) {
          const img = document.createElement('img');
          img.src = a.url;
          img.alt = a.name;
          chip.appendChild(img);
        } else {
          const glyph = document.createElement('m3e-icon');
          glyph.setAttribute('name', 'description');
          glyph.style.fontSize = '1.1rem';
          const name = document.createElement('span');
          name.className = 'attach-name';
          name.textContent = a.pending ? t('uploading') + a.name : a.name;
          chip.append(glyph, name);
          if (!a.pending) {
            const size = document.createElement('span');
            size.className = 'attach-size';
            size.textContent = attachmentBytes(a.size);
            chip.appendChild(size);
          }
        }
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'attach-remove';
        rm.title = t('removeAttachment');
        rm.setAttribute('aria-label', t('removeAttachment'));
        rm.textContent = '\u00d7';
        rm.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          pendingAttachments = pendingAttachments.filter(x => x !== a);
          renderAttachments();
          refreshComposer();
        });
        chip.appendChild(rm);
        attachTray.appendChild(chip);
      }
      if (pendingAttachments.length === 0) attachTray.classList.remove('show');
      refreshComposer();
    }
    function addFiles(files) {
      if (!files || !files.length) return;
      if (!ws || ws.readyState !== 1) { showToast(t('uploadOffline'), 'error'); return; }
      const list = Array.prototype.slice.call(files);
      for (const file of list) {
        if (file.size === 0) { showToast(t('skipEmptyFile') + file.name, 'warning'); continue; }
        if (file.size > MAX_ATTACHMENT_BYTES) {
          showToast(t('fileTooLarge') + file.name, 'error');
          continue;
        }
        if (pendingAttachments.length >= 20) { showToast(t('tooManyAttachments'), 'warning'); break; }
        const local = {
          localId: Math.random().toString(36).slice(2),
          name: file.name,
          pending: true,
          kind: /^image\\//.test(file.type) ? 'image' : 'file'
        };
        pendingAttachments.push(local);
        renderAttachments();
        fetch('/upload?name=' + encodeURIComponent(file.name)
              + '&type=' + encodeURIComponent(file.type || ''), {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: file
        })
          .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
          .then(info => {
            const at = pendingAttachments.indexOf(local);
            if (at === -1) return; // removed while uploading
            pendingAttachments[at] = info;
            renderAttachments();
          })
          .catch(err => {
            pendingAttachments = pendingAttachments.filter(x => x !== local);
            renderAttachments();
            showToast(t('uploadFailed') + file.name + '（' + (err && err.message || err) + '）', 'error');
          });
      }
      renderAttachments();
    }
    /* One picker for both entry points. accept is set at open time and dropped
       again on change AND cancel — a dismissed picker fires no change, so the
       image-only filter would otherwise stick and block the next file. */
    function openPicker(imagesOnly) {
      attachInput.accept = imagesOnly ? 'image/*' : '';
      attachInput.click();
    }
    galleryBtn.addEventListener('click', () => {
      if (galleryBtn.disabled) return;
      openPicker(true);
    });
    addMenu.addEventListener('toggle', () => {
      addBtn.classList.toggle('open', addMenu.isOpen);
    });
    addMenu.addEventListener('click', (e) => {
      const item = e.target instanceof Element && e.target.closest
        ? e.target.closest('m3e-menu-item[data-add]') : null;
      if (!item) return;
      addMenu.hide();
      const kind = item.getAttribute('data-add');
      if (kind === 'clear') {
        if (!pendingAttachments.length) return;
        pendingAttachments = [];
        renderAttachments();
        showToast(t('attachmentsCleared'), 'info');
        return;
      }
      openPicker(kind === 'image');
    });
    attachInput.addEventListener('cancel', () => { attachInput.accept = ''; });
    attachInput.addEventListener('change', () => {
      addFiles(attachInput.files);
      attachInput.value = '';
      attachInput.accept = '';
    });
    // Paste: images (and any other clipboard files) land as attachments; plain
    // text keeps the textarea's own handling. Gated on the composer being the
    // live surface — pasting into the answer dialog must not queue files for a
    // message that is not being composed.
    document.addEventListener('paste', (e) => {
      if (!e.clipboardData || activePromptId !== null) return;
      const files = [];
      for (const item of e.clipboardData.items || []) {
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (!files.length) return;
      e.preventDefault();
      // A screenshot usually arrives with no text, but some clipboards carry
      // both — keep the text rather than silently discarding it.
      const text = e.clipboardData.getData('text/plain');
      if (text && inputEl === document.activeElement) {
        const start = inputEl.selectionStart || 0;
        const end = inputEl.selectionEnd || 0;
        inputEl.value = inputEl.value.slice(0, start) + text + inputEl.value.slice(end);
        inputEl.selectionStart = inputEl.selectionEnd = start + text.length;
        inputEl.dispatchEvent(new Event('input'));
      }
      addFiles(files);
    });
    // Drag and drop anywhere over the composer.
    let dragDepth = 0;
    inputBar.addEventListener('dragenter', (e) => {
      if (!e.dataTransfer || !Array.prototype.some.call(e.dataTransfer.types || [], t => t === 'Files')) return;
      e.preventDefault();
      dragDepth++;
      inputBar.classList.add('dragging');
    });
    inputBar.addEventListener('dragover', (e) => {
      if (e.dataTransfer && Array.prototype.some.call(e.dataTransfer.types || [], t => t === 'Files')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    });
    inputBar.addEventListener('dragleave', () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) inputBar.classList.remove('dragging');
    });
    inputBar.addEventListener('drop', (e) => {
      if (!e.dataTransfer) return;
      e.preventDefault();
      dragDepth = 0;
      inputBar.classList.remove('dragging');
      addFiles(e.dataTransfer.files);
    });

    // ───────────── Composer + stop-arm ─────────────
    function refreshComposer() {
      updateStatusDot();
      const promptOpen = activePromptId !== null;
      const blocked = !connected || promptOpen;
      const why = !connected ? t('disconnectedSuffix') : promptOpen ? t('answerPromptFirst') : '';
      inputEl.disabled = blocked;
      addBtn.disabled = blocked;
      galleryBtn.disabled = blocked;
      modelBtn.disabled = blocked;
      addBtn.title = t('addAttachment') + why;
      galleryBtn.title = t('pickImage') + why;
      modelBtn.title = t('switchModel') + why;
      if (blocked && addMenu.isOpen) addMenu.hide();
      /* These three are the live composer's own states, and unlike the idle
         placeholder they are set from JS every refresh — so they read t()
         directly and need no marking. */
      inputEl.placeholder = agentRunning
        ? t('placeholderLiveTurn')
        : (runHolding
            ? t('placeholderHeld')
            : t('inputPlaceholder'));
      if (agentRunning && !promptOpen) {
        sendBtn.disabled = !connected;
        /* No title while running: the m3e-tooltip carries this button's
           explanation, and a native title on top of it is a second, delayed
           bubble with the same words (in English, where the rest of this UI
           is Chinese). The tooltip is the one that can be shown on demand,
           so the native fallback is dropped rather than duplicated. */
        sendBtn.removeAttribute('title');
      } else {
        disarmStop();
        // An attachment with no text is still a message ("look at this"), so the
        // button unlocks on files alone — but never while an upload is in flight.
        sendBtn.disabled = !connected || promptOpen || uploadsBusy();
        sendBtn.title = t('send');
      }
      syncStopTip();
      syncComposerCompact();
    }
    /* The tooltip is the discoverability answer for a gesture the glyph cannot
       explain: stop takes TWO taps, and nothing about a red square says so.
       It is offered only where it can be true — running, connected, and no
       question card up (a blocked button never arms) — and is withdrawn the
       instant it stops being true, because a tooltip describing a state the
       button has left is worse than none.
       m3e-tooltip also refuses to show for a disabled control on its own, so
       the disabled gate is belt-and-braces; the real reason to drive it here
       is the armed state, where the message must change. */
    function syncStopTip() {
      if (!stopTip) return;
      stopTip.textContent = stopArmed ? t('stopConfirmHint') : t('stopArmHint');
      const live = agentRunning && connected && activePromptId === null && !sendBtn.disabled;
      stopTip.disabled = !live;
      if (!live) hideStopTip();
    }
    function showStopTip() {
      if (!stopTip || stopTip.disabled) return;
      /* Async: the module is imported lazily, so the element may still be a
         plain tag with no show() — and show() is async itself (it awaits the
         anchor position). */
      Promise.resolve(stopTip.show && stopTip.show()).catch(() => {});
    }
    function hideStopTip() {
      if (!stopTip) return;
      Promise.resolve(stopTip.hide && stopTip.hide()).catch(() => {});
    }
    /* Narrow screens give the field the action group's width while a message is
       actually being written — a phone keyboard plus three 40px discs and a
       two-word draft leaves the textarea nothing. Wide screens keep the group
       always: there the field is never the scarce resource. */
    function syncComposerCompact() {
      composerBar.classList.toggle('compact',
        !isWide() && document.activeElement === inputEl && !!inputEl.value);
    }
    function disarmStop() {
      stopArmed = false;
      if (stopArmTimer) { clearTimeout(stopArmTimer); stopArmTimer = null; }
      /* Unconditional, and NOT "only while running" as it used to be: the
         arm is also dropped when a turn ENDS (agentRunning already false by
         then), and that guard made the class survive exactly the case that
         matters — a button parked at the armed error-red on an idle
         composer, which reads as "still stopping" forever. */
      sendBtn.classList.remove('armed');
      /* Order matters: stopArmed is already false, so syncStopTip re-points
         the text at the un-armed wording before the bubble is dismissed —
         otherwise a button that has just left the armed state would show
         "再次点击以停止" fading out, which now describes nothing. */
      syncStopTip();
      hideStopTip();
    }
    function sendInterrupt() {
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'interrupt' }));
      }
    }
    function onSendClick() {
      if (agentRunning && activePromptId === null) {
        if (stopArmed) { disarmStop(); sendInterrupt(); return; }
        armStop();
        return;
      }
      sendMessage();
    }
    /* First tap of the stop gesture. Arms, and says out loud what the second
       tap will do — the tooltip pops NOW, not on hover, because this is the
       moment the user is holding a half-finished gesture and wondering.
       m3e-tooltip hides itself on the control's click, so this has to be
       ordered after its own handler has run: a rAF's delay is enough, and
       cheaper than fighting the library's listener order.
       touch-gestures is off, so on a phone this never competes with the
       long-press; the tooltip is hover/focus decoration that the tap
       supplements, not a third way to trigger it. */
    function armStop() {
      stopArmed = true;
      sendBtn.classList.add('armed');
      if (stopArmTimer) clearTimeout(stopArmTimer);
      stopArmTimer = setTimeout(disarmStop, 3000);
      syncStopTip();
      requestAnimationFrame(showStopTip);
    }
    function sendMessage() {
      const text = (inputEl.value || '').trim();
      if (!ws || ws.readyState !== 1) return;
      if (uploadsBusy()) { showToast(t('attachmentsStillUploading'), 'warning'); return; }
      const ids = pendingAttachments.map(a => a.id).filter(Boolean);
      if (!text && ids.length === 0) return;
      // Slash commands are text-only on the server (they parse an argument
      // string), so a command line does not carry attachment ids.
      const isCommand = text.startsWith('/');
      const frame = { type: 'message', text };
      if (!isCommand && ids.length > 0) frame.attachments = ids;
      ws.send(JSON.stringify(frame));
      // The server echoes a user_message frame back to every client (including
      // this one), which is the only renderer of the bubble — the ids are just
      // dropped from the tray so the next line starts clean.
      if (!isCommand && ids.length > 0) {
        pendingAttachments = [];
        renderAttachments();
      }
      inputEl.value = '';
      // The autosize component only recomputes on the textarea's input event,
      // which a programmatic value set never fires — dispatch one so the box
      // shrinks back to min-rows instead of staying at its old height.
      inputEl.dispatchEvent(new Event('input'));
      cmdActive = []; cmdIndex = -1; renderSuggestions();
      if (text.startsWith('/')) return;
      if (!agentRunning && !runHolding) {
        // Optimistic spinner bubble. Stage 0 stub; stage 2 shows thinking bubble.
      }
    }
    sendBtn.addEventListener('click', onSendClick);
    /* A pinyin/kanji candidate list is committed with Enter, and that Enter must
       not also send the half-typed line: isComposing is the modern flag, keyCode
       229 the legacy one some engines still report on the committing event. */
    function imeComposing(e) { return e.isComposing || e.keyCode === 229; }
    inputEl.addEventListener('keydown', (e) => {
      if (cmdActive.length > 0 && !imeComposing(e)) {
        if (e.key === 'ArrowDown') { e.preventDefault(); cmdIndex = Math.min(cmdIndex + 1, cmdActive.length - 1); renderSuggestions(); return; }
        if (e.key === 'ArrowUp')   { e.preventDefault(); cmdIndex = Math.max(cmdIndex - 1, 0); renderSuggestions(); return; }
        if (e.key === 'Tab')       { e.preventDefault(); pickCmd(cmdIndex >= 0 ? cmdIndex : 0); return; }
        if (e.key === 'Escape')    { cmdActive = []; cmdIndex = -1; renderSuggestions(); return; }
        if (e.key === 'Enter' && !e.shiftKey && cmdIndex >= 0) { e.preventDefault(); pickCmd(cmdIndex); return; }
      }
      if (e.key === 'Enter' && !e.shiftKey && !imeComposing(e)) { e.preventDefault(); sendMessage(); }
    });
    /* The toolbar keeps a roving tabindex over its buttons, and its keydown
       listener is the slot's — the textarea is one of the "interactive elements"
       it collects, so a bare ArrowLeft would move focus to a button instead of
       the caret. Swallowing the event before it reaches the slot leaves the
       caret alone; the toolbar still keys its buttons off clicks. */
    composerPill.addEventListener('keydown', (e) => {
      if (e.target === inputEl) e.stopPropagation();
    });
    inputEl.addEventListener('input', () => { updateSuggestions(); syncComposerCompact(); });
    inputEl.addEventListener('focus', syncComposerCompact);
    inputEl.addEventListener('blur', syncComposerCompact);
    window.addEventListener('resize', syncComposerCompact);

    // ───────────── Stage 3: Prompt dialog ─────────────
    function answer(value) {
      if (activePromptId === null) return;
      ws.send(JSON.stringify({ type: 'prompt_answer', id: activePromptId, value }));
      closePrompt();
    }
    function closePrompt() {
      activePromptId = null;
      if (promptCard.open) promptCard.open = false;
      promptInput.value = '';
      // Same autosize catch-up as sendMessage: value was set programmatically.
      promptInput.dispatchEvent(new Event('input'));
      promptInput.style.display = 'none';
      promptRec.style.display = 'none';
      activeRecommended2 = '';
      activeActions = [];
      if (cancelArmTimer) { clearTimeout(cancelArmTimer); cancelArmTimer = null; }
      refreshComposer();
    }
    function makeBtn(label, cls, onClick) {
      const btn = document.createElement('m3e-button');
      btn.type = 'button';
      btn.textContent = label;
      btn.setAttribute('variant', cls === 'primary' ? 'filled' : cls === 'cancel' ? 'text' : 'tonal');
      if (cls === 'cancel') {
        btn.classList.add('cancel');
        btn.style.setProperty('--md-sys-color-primary', 'var(--md-sys-color-error)');
      }
      btn.addEventListener('click', onClick);
      return btn;
    }
    function makeCancelBtn() {
      const btn = makeBtn('Cancel task', 'cancel', null);
      let armed = false;
      btn.addEventListener('click', () => {
        if (armed) { answer(undefined); return; }
        armed = true;
        btn.classList.add('armed');
        btn.textContent = 'Tap again to cancel';
        if (cancelArmTimer) clearTimeout(cancelArmTimer);
        cancelArmTimer = setTimeout(() => {
          armed = false;
          btn.classList.remove('armed');
          btn.textContent = 'Cancel task';
          cancelArmTimer = null;
        }, 3000);
      });
      return btn;
    }
    function makeActionBtns() {
      const out = [];
      for (let i = 0; i < activeActions.length; i++) {
        const a = activeActions[i];
        out.push(makeBtn(a.label, 'secondary', () => answer(a.value)));
      }
      return out;
    }
    function renderButtons(buttons, stacked, omitCancel) {
      promptButtons.innerHTML = '';
      for (let i = 0; i < buttons.length; i++) promptButtons.appendChild(buttons[i]);
      const acts = makeActionBtns();
      for (let i = 0; i < acts.length; i++) promptButtons.appendChild(acts[i]);
      if (!omitCancel) promptButtons.appendChild(makeCancelBtn());

    }
    function showManualEntry() {
      promptRec.style.display = 'none';
      promptInput.style.display = 'block';
      promptInput.value = '';
      // Same autosize catch-up as sendMessage: value was set programmatically.
      promptInput.dispatchEvent(new Event('input'));
      renderButtons([
        makeBtn('Submit', 'primary', () => answer(promptInput.value)),
        makeBtn('Back', 'secondary', showRecommendation)
      ]);
      promptInput.focus();
    }
    function showRecommendation() {
      promptInput.style.display = 'none';
      const buttons = [];
      if (activeRecommended2) {
        promptRec.style.display = 'none';
        buttons.push(makeBtn(activeRecommended, 'primary', () => answer(activeRecommended)));
        buttons.push(makeBtn(activeRecommended2, 'secondary', () => answer(activeRecommended2)));
        buttons.push(makeBtn('Manual answer', 'secondary', showManualEntry));
        renderButtons(buttons, true);
        return;
      }
      promptRec.style.display = 'block';
      buttons.push(makeBtn('Accept', 'primary', () => answer(activeRecommended)));
      buttons.push(makeBtn('Manual answer', 'secondary', showManualEntry));
      renderButtons(buttons);
    }
    function showPrompt(msg) {
      activePromptId = msg.id;
      promptQ.textContent = msg.question;
      activeRecommended = msg.recommended || '';
      activeRecommended2 = msg.recommended2 || '';
      activeActions = msg.actions || [];
      if (msg.dismissOnly) {
        promptInput.style.display = 'none';
        promptRec.style.display = 'block';
        setContent(promptRecText, msg.recommended || '');
        renderButtons([makeBtn('Close', 'primary', () => answer(''))], false, true);
      } else if (msg.recommended) {
        setContent(promptRecText, msg.recommended);
        showRecommendation();
      } else {
        promptRec.style.display = 'none';
        promptInput.style.display = 'block';
        promptInput.value = '';
        // Same autosize catch-up as sendMessage: value was set programmatically.
        promptInput.dispatchEvent(new Event('input'));
        const buttons = [makeBtn('Submit', 'primary', () => answer(promptInput.value))];
        if (msg.allowSkip) buttons.push(makeBtn('Skip', 'secondary', () => answer('')));
        renderButtons(buttons);
        promptInput.focus();
      }
      promptCard.open = true;
      refreshComposer();
    }
    // Esc / programmatic close both land here — the prompt stays pending
    // server-side and is restored from the next snapshot.
    promptCard.addEventListener('closed', () => {
      if (activePromptId !== null) closePrompt();
    });

    // ───────────── WS ─────────────
    function connect() {
      const sock = new WebSocket(WS_URL_RESOLVED);
      ws = sock;
      sock.addEventListener('open', () => {
        if (ws !== sock) return;
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
        if (reconnectAnim) { clearInterval(reconnectAnim); reconnectAnim = null; }
        overlay.classList.remove('show');
        reconnectDelay = 1000;
        connected = true;
        refreshComposer(); setSendBtn(); syncDeleteStates();
        if (notifyEnabled()) subscribePush().catch(() => {});
      });
      sock.addEventListener('message', (e) => {
        if (ws !== sock) return;
        try { handleMsg(JSON.parse(e.data)); } catch {}
      });
      sock.addEventListener('close', () => {
        if (ws !== sock) return;
        connected = false;
        refreshComposer();
        overlay.classList.add('show');
        const until = Date.now() + reconnectDelay;
        let frame = 0;
        const paint = () => {
          const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
          const glyph = SPIN[frame++ % SPIN.length];
          reconnectMsg.textContent = left > 0
            ? glyph + '  ' + t('connectionLostRetrying', left)
            : glyph + '  ' + t('reconnecting');
        };
        if (reconnectAnim) clearInterval(reconnectAnim);
        paint();
        reconnectAnim = setInterval(paint, 90);
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          reconnectDelay = Math.min(reconnectDelay * 2, 30000);
          connect();
        }, reconnectDelay);
      });
      sock.addEventListener('error', () => { try { sock.close(); } catch {} });
    }
    function connectNow() {
      if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      reconnectDelay = 1000;
      connect();
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) connectNow(); });
    window.addEventListener('online', connectNow);
    window.addEventListener('focus', connectNow);

    // ───────────── Message dispatch ─────────────
    function handleMsg(m) {
      switch (m.type) {
        case 'held':
          held = m.texts || [];
          runHolding = !!m.runActive;
          renderHeld();
          refreshComposer();
          break;
        case 'snapshot': {
          chatLog.innerHTML = '';
          closePrompt();
          currentThinking = null; thinkingText = '';
          currentBubble = null; streamText = '';
          for (const k in toolCallMap) delete toolCallMap[k];
          for (const t of (m.turns || [])) { try { renderTurn(t); } catch (e) {} }
          if (m.live) { try { renderLiveTurn(m.live); } catch (e) {} }
          taskWidgetLines = (m.taskWidget && m.taskWidget.length) ? m.taskWidget : null;
          taskWidgetData = m.taskWidgetData || null;
          renderWidgets();
          setModelName(m.model);
          if (m.context) setContextBar(m.context); else paintCtx(0);
          agentRunning = !!m.agentRunning;
          held = m.held || [];
          runHolding = !!m.heldRunActive;
          renderHeld();
          turnHadContent = !!(m.live && m.live.parts && m.live.parts.length);
          if (m.prompt) showPrompt(m.prompt);
          refreshComposer(); setSendBtn(); syncDeleteStates();
          break;
        }
        case 'models':
          modelCatalog = {current: m.current || null, models: m.models || []};
          // A switch changes the session model without a fresh agent run, so
          // the chip could keep the old name until the next message: re-sync
          // it from the catalogue whenever the current spec is known.
          {
            const cur = modelCatalog.models.find((x) => x.spec === modelCatalog.current);
            if (cur) setModelName(cur.name);
          }
          // The sheet's own flag, not modelMenuOpen: the opened event has not
          // fired yet while the opening animation runs, so a catalogue that
          // arrives during it would otherwise leave the list showing stale rows.
          if (modelMenuOpen) renderModelMenu();
          break;
        case 'sessions':
          sessionData = {current: m.current || null, sessions: m.sessions || []};
          renderSessions();
          syncChatTitle();
          break;
        case 'agent_start':
          autoScroll = true;
          streamText = '';
          currentBubble = null;
          turnHadContent = false;
          agentRunning = true;
          setModelName(m.model);
          refreshComposer(); setSendBtn(); syncDeleteStates();
          break;
        case 'thinking_delta':
          turnHadContent = true;
          if (!currentThinking) {
            currentThinking = makeThinkingEl('', true);
            chatLog.appendChild(currentThinking);
            thinkingText = '';
            startSpin();
          }
          thinkingText += m.delta;
          currentThinking.querySelector('.thinking-body').textContent = thinkingText;
          currentThinking.querySelector('.thinking-label').textContent =
            thinkingSummary(thinkingLineCount(thinkingText));
          scrollBottom();
          break;
        case 'thinking_end':
          finalizeThinking();
          break;
        case 'text_delta':
          turnHadContent = true;
          // finalizeThinking only when this delta actually births the bubble
          // (whitespace-only deltas defer it — appendTextDelta decides).
          if (!currentBubble && (streamText + m.delta).trim()) finalizeThinking();
          appendTextDelta(m.delta);
          break;
        case 'text_end':
          if (currentBubble) {
            const hadText = streamText.trim();
            // Same mount-or-remove decision as closeBubble: a whitespace-only
            // stream must not leave an empty bubble behind.
            if (hadText) {
              mountMarkdown(currentBubble, streamText);
              attachBubbleCopy(currentBubble, streamText);
              /* Rendered markdown is usually taller than the streamed plain
                 text: re-jump so the final layout still sits at the bottom. */
              scrollBottom();
            } else {
              const wrap = currentBubble.closest('.msg') || currentBubble.parentNode;
              if (wrap) wrap.remove();
            }
            currentBubble = null; streamText = '';
          }
          break;
        case 'tool_start': {
          turnHadContent = true;
          finalizeThinking();
          const d = addToolCall(m.toolName, m.args, m.toolCallId, false);
          toolCallMap[m.toolCallId] = d;
          break;
        }
        case 'tool_end': {
          const d = toolCallMap[m.toolCallId];
          if (d) {
            if (m.isError) d.root.classList.add('error');
            appendElapsed(d, m.elapsedMs);
            const pre = document.createElement('pre');
            pre.className = 'tool-result';
            pre.textContent = toolResultText(m.result);
            d.body.appendChild(pre);
            delete toolCallMap[m.toolCallId];
          }
          currentBubble = null; streamText = '';
          break;
        }
        case 'user_message':
          addBubble('user', m.text, m.attachments);
          addTurnTime(Date.now(), 'user');
          break;
        case 'system_note':
          addSystemLine(m.text);
          addTurnTime(Date.now(), 'system');
          break;
        case 'agent_error':
          finalizeThinking();
          if (currentBubble) {
            if (streamText) {
              mountMarkdown(currentBubble, streamText);
              attachBubbleCopy(currentBubble, streamText);
            }
            currentBubble = null; streamText = '';
          }
          addBubble('error', m.message || 'Error');
          if (turnHadContent) addTurnTime(Date.now(), 'assistant');
          turnHadContent = false;
          agentRunning = false;
          refreshComposer(); setSendBtn(); syncDeleteStates();
          break;
        case 'agent_end':
          finalizeThinking();
          currentBubble = null; streamText = '';
          if (turnHadContent) addTurnTime(Date.now(), 'assistant');
          turnHadContent = false;
          agentRunning = false;
          setModelName(m.model);
          refreshComposer(); setSendBtn(); syncDeleteStates();
          setContextBar(m.contextUsage);
          /* pi only writes a session file once it holds an assistant message, so
             THIS is the frame after which the conversation the bar names can
             actually be named. Re-ask while the current session is still the
             synthesized unsaved row (or has no row at all) — once a persisted
             row exists, nothing about the title can change from here. */
          {
            const cur = (sessionData.sessions || []).find((x) => x.path === sessionData.current);
            if (ws && ws.readyState === 1 && (!cur || cur.unsaved)) {
              ws.send(JSON.stringify({ type: 'list_sessions' }));
            }
          }
          break;
        case 'context':
          setContextBar(m.contextUsage);
          break;
        case 'prompt':
          showPrompt(m);
          break;
        case 'prompt_resolved':
          if (activePromptId === m.id) closePrompt();
          break;
        case 'widget':
          taskWidgetLines = (m.lines && m.lines.length) ? m.lines : null;
          taskWidgetData = m.data || null;
          renderWidgets();
          break;
        case 'notify':
          showToast(m.message, m.level);
          break;
        case 'reset':
          chatLog.innerHTML = '';
          pendingAttachments = [];
          renderAttachments();
          finalizeThinking();
          currentBubble = null; streamText = '';
          turnHadContent = false;
          closePrompt();
          agentRunning = false;
          refreshComposer(); setSendBtn(); syncDeleteStates();
          taskWidgetLines = null; taskWidgetData = null;
          renderWidgets();
          paintCtx(0);
          break;
      }
    }

    // ───────────── Snapshot renderers ─────────────
    function renderTurn(t) {
      if (t.error) { addBubble('error', t.text); return; }
      if (t.role === 'system') { addSystemLine(t.text); addTurnTime(t.ts, 'system'); return; }
      if (t.role === 'user') { addBubble('user', t.text, t.attachments); addTurnTime(t.ts, 'user'); return; }
      for (const p of (t.parts || [])) {
        if (p.kind === 'text') {
          if (p.text.trim()) addBubble('assistant', p.text);
        } else if (p.kind === 'thinking') {
          if (p.text) makeThinkingEl(p.text, false);
        } else {
          renderToolPart(p);
        }
      }
      addTurnTime(t.ts, 'assistant');
    }
    function renderToolPart(p) {
      const d = addToolCall(p.toolName, p.args, p.toolCallId, p.isError);
      if (p.done) {
        appendElapsed(d, p.elapsedMs);
        const pre = document.createElement('pre');
        pre.className = 'tool-result';
        pre.textContent = toolResultText(p.result);
        d.body.appendChild(pre);
      } else {
        toolCallMap[p.toolCallId] = d;
      }
      return d;
    }
    function renderLiveTurn(live) {
      const parts = live.parts || [];
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const last = i === parts.length - 1;
        if (p.kind === 'text') {
          if (last && live.textOpen) {
            // Same structure as the delta path: an .msg row with the shape
            // avatar, not a bare bubble — a bare bubble renders with no
            // avatar and full column width.
            const wrap = document.createElement('div');
            wrap.className = 'msg assistant';
            wrap.appendChild(makeAvatar('assistant'));
            currentBubble = document.createElement('div');
            currentBubble.className = 'bubble md';
            if (p.text) currentBubble.textContent = p.text;
            streamText = p.text || '';
            wrap.appendChild(currentBubble);
            chatLog.appendChild(wrap);
            scrollBottom();
          } else if (p.text.trim()) {
            addBubble('assistant', p.text);
          }
        } else if (p.kind === 'thinking') {
          if (last && !p.done) {
            currentThinking = makeThinkingEl(p.text || '', true);
            thinkingText = p.text || '';
            startSpin();
          } else if (p.text) {
            makeThinkingEl(p.text, false);
          }
        } else {
          renderToolPart(p);
        }
      }
    }

    // ───────────── Mobile keyboard: track visual viewport ─────────────
    function setAppHeight() {
      const h = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
      document.documentElement.style.setProperty('--app-height', h + 'px');
    }
    setAppHeight();
    window.addEventListener('resize', setAppHeight);
    window.addEventListener('orientationchange', setAppHeight);


    /* Locale comes FIRST, before anything paints: applyLocale's repaint would
       otherwise run against markup that has already been rendered in the old
       language, and several of the renderers below (sessions, menus,
       notifications) build subtrees that must be built against the new one.
       The stored choice wins; on a first visit navigator.language only
       suggests which of the three to start in. */
    const startLocale = initialLocale();
    CURRENT_LOCALE = startLocale;
    document.documentElement.lang = startLocale;
    paintStaticI18n(document);
    renderLocaleMenu();

    setSendBtn();
    refreshComposer();
    connect();
`
}
