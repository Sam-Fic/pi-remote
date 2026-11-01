// Wire format shared by the WS server and the inline browser app.
// Keep these shapes in sync with the hand-written `switch (msg.type)` in
// ui-script.ts, which is where the browser decodes them.

export interface PromptMessage {
    type: 'prompt'
    id: string
    question: string
    recommended?: string
    recommended2?: string
    /**
     * Buttons that answer with their own `value` instead of with an answer to the
     * question — /task-plan's "ask the model" and "proceed to execution". Absent
     * on every other prompt, and the browser's makeActionBtns then appends
     * nothing to the card.
     */
    actions?: {label: string; value: string}[]
    /**
     * The card only DISPLAYS. `recommended` carries the body, and the buttons
     * collapse to a single Close that answers with an empty string. Its one
     * producer is /task-plan's answer to a question the USER asked, which needs
     * dismissing rather than answering — and which needs to be a prompt, not a
     * broadcast-only frame, because only a prompt is in the reconnect snapshot.
     */
    dismissOnly?: boolean
    allowSkip: boolean
}

export interface PromptResolvedMessage {
    type: 'prompt_resolved'
    id: string
}

/** Structured task-widget payload — lets the browser render a real progress bar,
 *  phase badge and elapsed clock instead of reflowing the terminal's text lines.
 *  Always sent ALONGSIDE `lines`, which stays the authoritative fallback. */
export interface WidgetData {
    /** Head line, e.g. "TASK_0003 · auth routes" or "/task-auto · building". */
    title: string
    /** Current phase/stage label, e.g. "refine", "implementing", "enforcing guidelines". */
    phase: string
    /** Progress numerator (current step) — omitted for stages without numbering. */
    done?: number
    /** Progress denominator (total steps) — omitted for stages without numbering. */
    total?: number
    /** Pre-formatted elapsed clock, e.g. "2:14". */
    elapsed?: string
    /** The current action — the latest child/worker output line (the terminal's
     *  `↳` trailer). Shown under the widget so the remote isn't blind to progress. */
    action?: string
}

/** The model picker's data: every available model plus the session's current.
 *  Broadcast on session_start, after a successful switch, and to fresh
 *  connections (the snapshot carries the current model NAME already; this
 *  frame adds the switchable list). */
export interface ModelsMessage {
    type: 'models'
    /** Canonical `provider/id` of the session's model, null when unknown. */
    current: string | null
    models: {spec: string; name: string}[]
}

/** The session sidebar's data: every session for this project, newest first.
 *  `name` is the user-set display name (null when the session was never
 *  named); the browser falls back to `firstMessage` as the row's title. */
export interface SessionsMessage {
    type: 'sessions'
    /** Path of the active session, null when unknown. */
    current: string | null
    sessions: {
        path: string
        name: string | null
        firstMessage: string
        /** ISO timestamp of the last write. */
        modified: string
        messageCount: number
        /** True only for the synthesized row of the ACTIVE session while pi has
         *  not flushed its file yet (a brand-new conversation, or one whose only
         *  turns are user-side). Such a row has no timestamp or message count
         *  worth showing — the browser labels it instead. */
        unsaved?: boolean
    }[]
}

/** The single task-widget slot. `lines: null` clears it. `data` carries the
 *  structured view (null when clearing or when a producer only has text). */
export interface WidgetMessage {
    type: 'widget'
    lines: string[] | null
    data?: WidgetData | null
}

export interface NotifyMessage {
    type: 'notify'
    message: string
    level: 'info' | 'warning' | 'error'
}

/** Lines the user typed while a task run owned the session, waiting for the next
 *  task turn. Shown in the composer so a held message is never a silent one. */
export interface HeldMessage {
    type: 'held'
    texts: string[]
    /** True while a task run owns the session (drives the composer placeholder). */
    runActive: boolean
}

export interface ContextUsage {
    tokens?: number
    contextWindow?: number
    percent?: number
}

/** A standalone context-usage update. The browser handles it, but nothing in
 *  `src/` sends one: a connecting client is seeded from the snapshot's `context`
 *  field, and the live value rides on `agent_end`. The only caller of
 *  `setContext`, which emits this, is the test suite. */
export interface ContextMessage {
    type: 'context'
    contextUsage: ContextUsage
}

/** Tells the browser to wipe the transcript/widgets/prompt when a new session
 *  starts, so it reflects the fresh session instead of the previous one. */
export interface ResetMessage {
    type: 'reset'
}

/** One page of turns OLDER than the live 20-turn window, answering a
 *  ClientFetchHistory. `turns` is oldest→newest (the client prepends them above
 *  what it already has); `before` is the cursor for the next page back and is
 *  absent when the beginning of the session is reached (`hasMore` false). */
export interface HistoryPageMessage {
    type: 'history_page'
    turns: import('./history.js').Turn[]
    before?: string
    hasMore: boolean
}

/** The full authoritative state sent to a (re)connecting client. Defined in
 *  session-state.ts (its serializer); re-exported here as part of the wire type. */
export type {SnapshotMessage} from './session-state.js'

/** A user turn committed to the transcript. `attachments` are the files the
 *  browser uploaded with it (absent for plain text, so the old shape is kept). */
export interface UserMessage {
    type: 'user_message'
    text: string
    attachments?: AttachmentInfo[]
}

/** Server → browser messages. The live text_delta / tool_* / agent_* /
 *  user_message deltas are emitted by the SessionState mutators
 *  and not all enumerated here; the snapshot below carries the full state. */
export type ServerMessage =
    | UserMessage
    | PromptMessage
    | PromptResolvedMessage
    | WidgetMessage
    | NotifyMessage
    | HeldMessage
    | ContextMessage
    | ResetMessage
    | HistoryPageMessage
    | ModelsMessage
    | SessionsMessage
    | import('./session-state.js').SnapshotMessage

/** One file a browser attached to a chat line, as echoed back to every client.
 *  The transcript only needs enough to draw a chip; the bytes live at `url`. */
export interface AttachmentInfo {
    /** Server-assigned id (also the `/uploads/<id>` path segment). */
    id: string
    /** Original file name, sanitised. */
    name: string
    /** `image` files are rendered inline as thumbnails; `file` is a chip. */
    kind: 'image' | 'file'
    mimeType: string
    /** Size in bytes. */
    size: number
    /** Where the browser fetches the bytes from. */
    url: string
}

/** Browser → server messages. */
export interface ClientChatMessage {
    type: 'message'
    text: string
    /** Ids returned by POST /upload, already stored on disk. Optional and
     *  additive: an older client that only sends `text` still works. */
    attachments?: string[]
}
export interface ClientPromptAnswer {
    type: 'prompt_answer'
    id: string
    value: string | undefined
}
/** Stop the running agent turn (the browser Stop button). */
export interface ClientInterrupt {
    type: 'interrupt'
}
/** Drop everything held for the next task turn (the composer's ✕). */
export interface ClientClearHeld {
    type: 'clear_held'
}
/** Switch the session model (browser model picker). */
export interface ClientSetModel {
    type: 'set_model'
    spec: string
}
/** Refresh the sidebar's session list (sent when the drawer opens). */
export interface ClientListSessions {
    type: 'list_sessions'
}
/** Start a brand-new session (Eta's "+" with the server's capsule selected).
 *  Same lifecycle as the remote `/new` line: pending prompts are cancelled, the
 *  replacement session fires session_start (reset + snapshot), and the fresh
 *  sessions frame marks the new path as `current`. */
export interface ClientNewSession {
    type: 'new_session'
}
/** Switch the active session (browser sidebar row). */
export interface ClientSwitchSession {
    type: 'switch_session'
    path: string
}
/** Delete a persisted session (browser sidebar trash button). */
export interface ClientDeleteSession {
    type: 'delete_session'
    path: string
}
/** Request a page of history older than the live window (client scrolled to
 *  the top). `path` selects which session to read — absent means the active
 *  one; `before` is the cursor from the previous history_page (absent = from
 *  the newest); `limit` is clamped server-side. */
export interface ClientFetchHistory {
    type: 'fetch_history'
    path?: string
    before?: string
    limit?: number
}
export type ClientMessage =
    | ClientChatMessage
    | ClientPromptAnswer
    | ClientInterrupt
    | ClientClearHeld
    | ClientSetModel
    | ClientListSessions
    | ClientNewSession
    | ClientSwitchSession
    | ClientDeleteSession
    | ClientFetchHistory

export function isClientMessage(x: unknown): x is ClientMessage {
    if (typeof x !== 'object' || x === null) return false
    const m = x as Record<string, unknown>
    if (m.type === 'message') {
        return (
            typeof m.text === 'string' &&
            (m.attachments === undefined ||
                (Array.isArray(m.attachments) &&
                    m.attachments.length <= 20 &&
                    m.attachments.every(id => typeof id === 'string' && id.length > 0)))
        )
    }
    if (m.type === 'interrupt') return true
    if (m.type === 'clear_held') return true
    if (m.type === 'prompt_answer') {
        return typeof m.id === 'string' && (m.value === undefined || typeof m.value === 'string')
    }
    if (m.type === 'set_model') return typeof m.spec === 'string' && m.spec.length > 0
    if (m.type === 'list_sessions') return true
    if (m.type === 'new_session') return true
    if (m.type === 'switch_session') return typeof m.path === 'string' && m.path.length > 0
    if (m.type === 'delete_session') return typeof m.path === 'string' && m.path.length > 0
    if (m.type === 'fetch_history') {
        return (
            (m.path === undefined || (typeof m.path === 'string' && m.path.length > 0)) &&
            (m.before === undefined || typeof m.before === 'string') &&
            (m.limit === undefined || (typeof m.limit === 'number' && Number.isFinite(m.limit)))
        )
    }
    return false
}
