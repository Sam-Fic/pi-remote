// Remote access token: a shared secret every client must present.
//
// The remote server binds 0.0.0.0 with no origin checks, so anyone on the LAN
// could drive the agent. A single persistent token — generated once per machine
// and shown in the terminal / QR overlay — raises the bar to "someone who has
// seen your screen or your QR". It is NOT encryption: frames still travel in
// plaintext over http/ws unless Tailscale serve provides the TLS layer.
//
// Delivery is uniform across surfaces: a `token` query parameter on the WS URL
// and on every HTTP route that does something (upload, uploads, push
// subscribe). The webui reads it from its own page URL — `GET /` without a
// token 302-redirects to `/?token=…`, so a browser that can load the page at
// all already holds the token, and the QR can encode the whole authenticated
// URL.
//
// Opt-out: PI_REMOTE_NO_AUTH=1 restores the previous open behaviour (register.ts
// then passes mode 'off'). Tests pin the token file with PI_REMOTE_TOKEN_PATH,
// the same pattern config.ts uses for PI_TASK_CONFIG_PATH — without it a test
// would silently create/read a token in the developer's real data-home.

import {randomBytes} from 'node:crypto'
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs'
import * as path from 'node:path'
import {stateFile} from '../shared/data-home.js'

/** The override for where the persistent token lives (tests point it at tmp). */
export const TOKEN_PATH_ENV = 'PI_REMOTE_TOKEN_PATH'

/** The env flag that disables token auth entirely (register.ts reads it). */
export const NO_AUTH_ENV = 'PI_REMOTE_NO_AUTH'

/** Who must present a token, and which one. `mode: 'off'` keeps the historical
 *  open-access behaviour; startServer defaults to it so existing callers (and
 *  the test suite) are unchanged. */
export type RemoteAuth =
    | {mode: 'off'}
    | {mode: 'token'; token: string}

export function tokenFilePath(): string {
    return process.env[TOKEN_PATH_ENV]?.trim() || stateFile('remote-token.json')
}

/** Read the machine's token, generating and persisting it on first use. The
 *  file is 0600 and the token is 128-bit hex: it travels in URLs, so it must
 *  be guess-proof but also short enough to display in a terminal line. A read
 *  failure (corrupt file, unwritable home) regenerates in memory only — losing
 *  the persisted copy must never take the server down. */
export function loadOrCreateToken(): string {
    const file = tokenFilePath()
    try {
        const parsed = JSON.parse(readFileSync(file, 'utf8')) as {token?: unknown}
        if (typeof parsed.token === 'string' && /^[a-f0-9]{32}$/.test(parsed.token)) {
            return parsed.token
        }
    } catch {
        /* first run, or a hand-broken file — fall through and regenerate */
    }
    const token = randomBytes(16).toString('hex')
    try {
        mkdirSync(path.dirname(file), {recursive: true})
        writeFileSync(file, JSON.stringify({token}) + '\n', {mode: 0o600})
    } catch {
        /* unwritable home: the token still works for this process's lifetime */
    }
    return token
}

/** Constant-time-ish comparison. `crypto.timingSafeEqual` needs equal-length
 *  buffers and throws otherwise; the length check itself leaks nothing worth
 *  protecting (the token length is fixed and public). */
export function tokenMatches(auth: RemoteAuth, provided: string | null | undefined): boolean {
    if (auth.mode === 'off') return true
    if (typeof provided !== 'string' || provided.length !== auth.token.length) return false
    let diff = 0
    for (let i = 0; i < provided.length; i++) {
        diff |= provided.charCodeAt(i) ^ auth.token.charCodeAt(i)
    }
    return diff === 0
}

/** Extract the token from a request/upgrade URL's query. Returns null when
 *  absent so tokenMatches can answer "not provided" and "wrong" the same way —
 *  the client never learns which one it was. */
export function tokenFromUrl(rawUrl: string | undefined): string | null {
    if (!rawUrl) return null
    try {
        return new URL(rawUrl, 'http://localhost').searchParams.get('token')
    } catch {
        return null
    }
}

/** Append `token=…` to a URL that may already carry a query. Used for the QR /
 *  announced URL and for the served page's WS URL. */
export function withTokenQuery(url: string, token: string): string {
    return url + (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token)
}
