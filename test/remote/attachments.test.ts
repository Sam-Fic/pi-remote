import {afterEach, beforeEach, describe, expect, test} from 'bun:test'
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import * as path from 'node:path'
import {buildUserContent} from '../../src/remote/attachments.js'
import type {UploadedFile} from '../../src/remote/uploads.js'
import {attachmentRefs} from '../../src/remote/uploads.js'

const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
)

let dir: string
beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'attach-'))
})
afterEach(() => {
    rmSync(dir, {recursive: true, force: true})
})

function upload(name: string, kind: 'image' | 'file', bytes: Buffer): UploadedFile {
    const file = path.join(dir, name)
    writeFileSync(file, bytes)
    return {
        id: 'a'.repeat(16),
        name,
        kind,
        mimeType: kind === 'image' ? 'image/png' : 'text/plain',
        size: bytes.length,
        url: `/uploads/${'a'.repeat(16)}`,
        path: file
    }
}

describe('attachmentRefs()', () => {
    test('names every file by absolute path so the agent can read it', () => {
        const a = upload('a.txt', 'file', Buffer.from('x'))
        const b = upload('b.png', 'image', PNG)
        const refs = attachmentRefs([a, b])
        expect(refs).toContain(a.path)
        expect(refs).toContain(`${b.path} (image)`)
        expect(refs).toContain('read tool')
    })

    test('is empty with no files (so a plain line keeps its exact old shape)', () => {
        expect(attachmentRefs([])).toBe('')
    })
})

describe('buildUserContent()', () => {
    test('a plain line stays a plain string', async () => {
        expect(await buildUserContent('hello', undefined)).toBe('hello')
        expect(await buildUserContent('hello', {info: [], files: []})).toBe('hello')
    })

    test('a file-only line becomes text with the path, never an empty string', async () => {
        const f = upload('notes.txt', 'file', Buffer.from('hi'))
        const content = await buildUserContent('', {info: [], files: [f]})
        expect(typeof content).toBe('string')
        expect(content as string).toContain(f.path)
    })

    test('an image rides inline as a real image block, next to its path text', async () => {
        const f = upload('shot.png', 'image', PNG)
        const content = await buildUserContent('look', {info: [], files: [f]})
        expect(Array.isArray(content)).toBe(true)
        const blocks = content as Array<{type: string; text?: string; mimeType?: string}>
        expect(blocks[0]).toMatchObject({type: 'text'})
        expect(blocks[0]!.text).toContain(f.path)
        expect(blocks[1]).toMatchObject({type: 'image', mimeType: 'image/png'})
        // base64 payload, not a URL
        expect((blocks[1] as unknown as {data: string}).data).toMatch(/^[A-Za-z0-9+/=]+$/)
    })

    test('a file that vanished from disk degrades to its path text (never throws)', async () => {
        const f = upload('gone.png', 'image', PNG)
        rmSync(f.path)
        const content = await buildUserContent('look', {info: [], files: [f]})
        expect(content).toBe('look\n\nAttached files (use the read tool to inspect them):\n- ' + f.path + ' (image)')
    })
})
