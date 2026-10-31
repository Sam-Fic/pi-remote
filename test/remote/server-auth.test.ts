import {describe, it, expect, afterEach} from 'bun:test'
import WebSocket from 'ws'
import {startServer} from '../../src/remote/server.js'
import type {ServerHandle} from '../../src/remote/server.js'
import type {RemoteAuth} from '../../src/remote/auth.js'

const TOKEN = 'f'.repeat(32)
const auth: RemoteAuth = {mode: 'token', token: TOKEN}

let handle: ServerHandle | null = null
afterEach(() => {
    handle?.stop()
    handle = null
})

/** startServer with every optional callback left empty and only `auth` set. The
 *  positional undefineds are counted once here so the call sites can't drift. */
function start(
    authPolicy: RemoteAuth,
    getHtml: (wsUrl: string) => string = () => '<html></html>'
): Promise<ServerHandle> {
    return startServer(
        () => {},        // onMessage
        getHtml,         // getHtml
        undefined,       // onInterrupt
        undefined,       // onClearHeld
        undefined,       // onSetModel
        undefined,       // getModels
        undefined,       // getSessions
        undefined,       // onSwitchSession
        undefined,       // onDeleteSession
        undefined,       // onFetchHistory
        authPolicy       // auth
    )
}

/** Connect a WS and resolve with either the first frame or the rejection reason. */
function connect(url: string): Promise<{ok: true; first: unknown} | {ok: false; status?: number}> {
    return new Promise(resolve => {
        const ws = new WebSocket(url)
        const timer = setTimeout(() => {
            ws.terminate()
            resolve({ok: false})
        }, 3000)
        ws.on('unexpected-response', (_req, res) => {
            clearTimeout(timer)
            resolve({ok: false, status: res.statusCode})
        })
        ws.on('error', () => {
            clearTimeout(timer)
            resolve({ok: false})
        })
        ws.on('message', data => {
            clearTimeout(timer)
            const first = JSON.parse(data.toString())
            ws.close()
            resolve({ok: true, first})
        })
    })
}

describe('token-gated server', () => {
    it('rejects a WS handshake with no token (401), never a snapshot', async () => {
        handle = await start(auth)
        const res = await connect(`ws://127.0.0.1:${handle.port}/ws`)
        expect(res.ok).toBe(false)
        if (!res.ok) expect(res.status).toBe(401)
    })

    it('rejects a WS handshake with a WRONG token', async () => {
        handle = await start(auth)
        const res = await connect(`ws://127.0.0.1:${handle.port}/ws?token=${'0'.repeat(32)}`)
        expect(res.ok).toBe(false)
    })

    it('accepts a WS handshake with the token and sends a snapshot', async () => {
        handle = await start(auth)
        const res = await connect(`ws://127.0.0.1:${handle.port}/ws?token=${TOKEN}`)
        expect(res.ok).toBe(true)
        if (res.ok) expect((res.first as {type: string}).type).toBe('snapshot')
    })

    it('redirects GET / without a token to the authenticated URL', async () => {
        handle = await start(auth)
        const res = await fetch(`http://127.0.0.1:${handle.port}/`, {redirect: 'manual'})
        expect(res.status).toBe(302)
        expect(res.headers.get('location')).toBe(`/?token=${TOKEN}`)
    })

    it('serves GET / with the token, embedding the token in the WS url', async () => {
        handle = await start(auth, wsUrl => `WSURL:${wsUrl}`)
        const res = await fetch(`http://127.0.0.1:${handle.port}/?token=${TOKEN}`)
        expect(res.status).toBe(200)
        const body = await res.text()
        expect(body).toContain(`token=${TOKEN}`)
    })

    it('rejects POST /upload and GET /uploads/<id> without a token (401)', async () => {
        handle = await start(auth)
        const up = await fetch(`http://127.0.0.1:${handle.port}/upload?name=x.png`, {
            method: 'POST',
            body: 'bytes'
        })
        expect(up.status).toBe(401)
        const serve = await fetch(`http://127.0.0.1:${handle.port}/uploads/${'a'.repeat(16)}`)
        expect(serve.status).toBe(401)
    })

    it('off mode keeps the historical open access (no redirect, WS open)', async () => {
        handle = await start({mode: 'off'})
        const page = await fetch(`http://127.0.0.1:${handle.port}/`, {redirect: 'manual'})
        expect(page.status).toBe(200)
        const res = await connect(`ws://127.0.0.1:${handle.port}/ws`)
        expect(res.ok).toBe(true)
    })
})
