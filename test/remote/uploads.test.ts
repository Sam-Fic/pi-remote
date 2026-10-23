import {afterEach, beforeEach, describe, expect, test} from 'bun:test'
import {tmpDir} from '../test-utils/tmp-dir.js'
import {rmSync} from 'node:fs'
import {startServer} from '../../src/remote/server.js'
import type {ServerHandle} from '../../src/remote/server.js'
import {isClientMessage} from '../../src/remote/protocol.js'
import {getBridge} from '../../src/remote/bridge.js'
import {reset} from '../../src/remote/session-state.js'
import WebSocket from 'ws'

// Uploads land under data-home; redirect it at a temp dir so this suite never
// writes to the real ~/.local/share.
let xdgDir: string | null = null
let prevXdg: string | undefined
beforeEach(() => {
    prevXdg = process.env.XDG_DATA_HOME
    xdgDir = tmpDir('uploads-xdg-')
    process.env.XDG_DATA_HOME = xdgDir
})
afterEach(() => {
    const b = getBridge()
    b.pending.clear()
    reset()
    if (prevXdg === undefined) delete process.env.XDG_DATA_HOME
    else process.env.XDG_DATA_HOME = prevXdg
    if (xdgDir) rmSync(xdgDir, {recursive: true, force: true})
    xdgDir = null
})

let handle: ServerHandle | null = null
afterEach(() => {
    handle?.stop()
    handle = null
})

// A 1×1 PNG — the smallest thing the byte-sniffer will recognise as an image.
const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
)

async function serve(): Promise<ServerHandle> {
    handle = await startServer(
        () => {},
        () => '<html></html>'
    )
    return handle
}

describe('POST /upload', () => {
    test('stores a text file and returns its metadata', async () => {
        const server = await serve()
        const res = await fetch(
            `http://127.0.0.1:${server.port}/upload?name=${encodeURIComponent('notes.txt')}`,
            {
                method: 'POST',
                headers: {'Content-Type': 'application/octet-stream'},
                body: 'hello attachment'
            }
        )
        expect(res.status).toBe(201)
        const info = (await res.json()) as Record<string, unknown>
        expect(info).toMatchObject({
            name: 'notes.txt',
            kind: 'file',
            mimeType: 'text/plain',
            size: 'hello attachment'.length
        })
        expect(String(info.id)).toMatch(/^[a-f0-9]{16}$/)
        expect(info.url).toBe(`/uploads/${info.id}`)
    })

    test('detects an image from its BYTES, not from the declared type', async () => {
        const server = await serve()
        const res = await fetch(
            `http://127.0.0.1:${server.port}/upload?name=shot&type=text/plain`,
            {method: 'POST', body: PNG}
        )
        expect(res.status).toBe(201)
        const info = (await res.json()) as {kind: string; mimeType: string; id: string}
        expect(info.kind).toBe('image')
        expect(info.mimeType).toBe('image/png')

        // The bytes are served back inline for an image.
        const get = await fetch(`http://127.0.0.1:${server.port}/uploads/${info.id}`)
        expect(get.status).toBe(200)
        expect(get.headers.get('content-type')).toBe('image/png')
        expect(get.headers.get('x-content-type-options')).toBe('nosniff')
        expect(Buffer.from(await get.arrayBuffer()).length).toBe(PNG.length)
    })

    test('a non-image is never served inline (no script executes on the origin)', async () => {
        const server = await serve()
        const res = await fetch(
            `http://127.0.0.1:${server.port}/upload?name=page.html&type=text/html`,
            {method: 'POST', body: '<script>alert(1)</script>'}
        )
        const info = (await res.json()) as {id: string}
        const get = await fetch(`http://127.0.0.1:${server.port}/uploads/${info.id}`)
        expect(get.headers.get('content-type')).toBe('application/octet-stream')
        expect(get.headers.get('content-disposition')).toContain('attachment')
    })

    test('an empty body is rejected', async () => {
        const server = await serve()
        const res = await fetch(`http://127.0.0.1:${server.port}/upload?name=empty.txt`, {
            method: 'POST',
            body: ''
        })
        expect(res.status).toBe(400)
    })

    test('an unknown id is a 404 and a traversal attempt never reaches the disk', async () => {
        const server = await serve()
        expect((await fetch(`http://127.0.0.1:${server.port}/uploads/deadbeefdeadbeef`)).status).toBe(
            404
        )
        expect((await fetch(`http://127.0.0.1:${server.port}/uploads/..%2f..%2fetc%2fpasswd`)).status).toBe(
            404
        )
    })
})

describe('attachments on the wire', () => {
    test('isClientMessage accepts ids and rejects a malformed list', () => {
        expect(isClientMessage({type: 'message', text: 'hi', attachments: ['abc']})).toBe(true)
        expect(isClientMessage({type: 'message', text: '', attachments: ['abc']})).toBe(true)
        expect(isClientMessage({type: 'message', text: 'hi', attachments: [42]})).toBe(false)
        expect(isClientMessage({type: 'message', text: 'hi', attachments: 'abc'})).toBe(false)
        expect(
            isClientMessage({type: 'message', text: 'hi', attachments: Array(21).fill('a')})
        ).toBe(false)
    })

    test('a message frame carrying ids delivers the resolved files to the callback', async () => {
        const server = await serve()
        const res = await fetch(
            `http://127.0.0.1:${server.port}/upload?name=${encodeURIComponent('a.txt')}`,
            {method: 'POST', body: 'body'}
        )
        const info = (await res.json()) as {id: string}

        const seen: Array<{text: string; info?: Array<{name: string}>}> = []
        handle?.stop()
        handle = await startServer(
            (text, attachments) => seen.push({text, ...(attachments ? {info: attachments.info} : {})}),
            () => '<html></html>'
        )

        await new Promise<void>((resolve, reject) => {
            const ws = new WebSocket(`ws://127.0.0.1:${handle!.port}/ws`)
            ws.on('open', () => {
                ws.send(JSON.stringify({type: 'message', text: 'look', attachments: [info.id]}))
                setTimeout(() => {
                    ws.close()
                    resolve()
                }, 150)
            })
            ws.on('error', reject)
        })
        expect(seen).toHaveLength(1)
        expect(seen[0]!.text).toBe('look')
        expect(seen[0]!.info?.[0]?.name).toBe('a.txt')
    })

    test('an unknown id is dropped and the text still reaches the agent', async () => {
        const seen: string[] = []
        handle = await startServer(
            (text, attachments) => {
                seen.push(text)
                expect(attachments?.files ?? []).toHaveLength(0)
            },
            () => '<html></html>'
        )
        await new Promise<void>((resolve, reject) => {
            const ws = new WebSocket(`ws://127.0.0.1:${handle!.port}/ws`)
            ws.on('open', () => {
                ws.send(JSON.stringify({type: 'message', text: 'hi', attachments: ['deadbeefdeadbeef']}))
                setTimeout(() => {
                    ws.close()
                    resolve()
                }, 150)
            })
            ws.on('error', reject)
        })
        expect(seen).toEqual(['hi'])
    })
})
