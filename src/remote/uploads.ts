// Browser uploads (images + arbitrary files) for the remote composer.
//
// The browser POSTs the raw bytes to `/upload?name=…&type=…`; we write them to
// a per-machine directory under data-home and hand back a short id. A chat line
// then references those ids (see protocol.ClientChatMessage), so a WebSocket
// frame never carries megabytes of base64 — and a big paste cannot stall the
// same socket the transcript streams on.
//
// Saved files are deliberately REAL FILES with absolute paths: a text file is
// read by the agent's `read` tool, an image is both attached inline to the model
// and readable later, and any other file can be inspected with bash. Nothing is
// held only in memory, so a pi restart (or a long turn) cannot lose an
// attachment.
//
// State lives on globalThis because pi re-evaluates extensions through
// `createJiti(..., {moduleCache: false})`: a reload must not orphan the uploads
// that connected browsers are still displaying.

import {createReadStream} from 'node:fs'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import {randomBytes} from 'node:crypto'
import * as path from 'node:path'
import type {IncomingMessage, ServerResponse} from 'node:http'
import {dataHome} from '../shared/data-home.js'
import {attachmentPathRefs} from '../shared/attachment-refs.js'
import type {AttachmentInfo} from './protocol.js'

/** Per-file ceiling. Bigger pastes are rejected at the HTTP layer with 413. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

/** An upload on disk, with everything the browser needs to render it plus the
 *  absolute path the agent is told about. */
export interface UploadedFile extends AttachmentInfo {
    path: string
}

interface UploadIndex {
    files: Map<string, UploadedFile>
    lastPrune: number
}

const g = globalThis as unknown as {__piRemoteUploads?: UploadIndex}
if (!g.__piRemoteUploads) g.__piRemoteUploads = {files: new Map(), lastPrune: 0}
const index = g.__piRemoteUploads

const UPLOAD_ID = /^[a-f0-9]{16}$/
const PRUNE_INTERVAL_MS = 60 * 60 * 1000
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export function uploadsDir(): string {
    return path.join(dataHome(), 'pi-task', 'remote-uploads')
}

export function isUploadId(id: string): boolean {
    return UPLOAD_ID.test(id)
}

/** JSON shape handed to the browser (no server path leaks). */
export function toAttachmentInfo(file: UploadedFile): AttachmentInfo {
    return {
        id: file.id,
        name: file.name,
        kind: file.kind,
        mimeType: file.mimeType,
        size: file.size,
        url: file.url
    }
}

/** The block appended to the model-facing prompt so the agent knows where each
 *  attachment lives. Images are ALSO attached inline; this line is what keeps a
 *  file readable later, after a restart or in a held input line. */
export function attachmentRefs(files: readonly UploadedFile[]): string {
    return attachmentPathRefs(files)
}

// ─── Persistence ────────────────────────────────────────────────────────────

function sniffImageMime(b: Buffer): string | undefined {
    if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
    if (
        b.length >= 8 &&
        b[0] === 0x89 &&
        b[1] === 0x50 &&
        b[2] === 0x4e &&
        b[3] === 0x47 &&
        b[4] === 0x0d &&
        b[5] === 0x0a &&
        b[6] === 0x1a &&
        b[7] === 0x0a
    )
        return 'image/png'
    if (b.length >= 3 && b.subarray(0, 3).toString('ascii') === 'GIF') return 'image/gif'
    if (
        b.length >= 12 &&
        b.subarray(0, 4).toString('ascii') === 'RIFF' &&
        b.subarray(8, 12).toString('ascii') === 'WEBP'
    )
        return 'image/webp'
    if (b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp'
    return undefined
}

/** The name shown in the UI and used for downloads. Path separators and control
 *  characters are stripped: the browser only ever sends a basename, but the
 *  value lands in headers and a `download` attribute. */
function displayName(raw: string): string {
    const base = path.basename(raw.replace(/\\/g, '/'))
    // eslint-disable-next-line no-control-regex
    const clean = base.replace(/[\u0000-\u001f\u007f]/g, '').trim()
    return (clean || 'file').slice(0, 160)
}

/** Keep a short, boring extension for the on-disk name (the display name keeps
 *  the real one). */
function diskExtension(name: string): string {
    const ext = path.extname(name)
    return /^\.[A-Za-z0-9]{1,8}$/.test(ext) ? ext.toLowerCase() : ''
}

function sanitizeMime(raw: string | undefined): string | undefined {
    if (!raw) return undefined
    const m = raw.trim().toLowerCase()
    return /^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/.test(m) ? m : undefined
}

const MIME_BY_EXT: Record<string, string> = {
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.json': 'application/json',
    '.csv': 'text/csv',
    '.log': 'text/plain',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.html': 'text/html',
    '.xml': 'application/xml',
    '.yaml': 'text/yaml',
    '.yml': 'text/yaml',
    '.ts': 'text/plain',
    '.tsx': 'text/plain',
    '.js': 'text/plain',
    '.jsx': 'text/plain',
    '.py': 'text/plain',
    '.go': 'text/plain',
    '.rs': 'text/plain',
    '.sh': 'text/plain'
}

function mimeFromName(name: string): string {
    return MIME_BY_EXT[path.extname(name).toLowerCase()] ?? 'application/octet-stream'
}

/** Write one uploaded file and register it. Image-ness is decided from the
 *  BYTES, never from the client's declared type: a file is served inline only
 *  when it really is a raster image. */
export async function saveUpload(
    rawName: string,
    bytes: Buffer,
    declaredType?: string
): Promise<UploadedFile> {
    const id = randomBytes(8).toString('hex')
    const name = displayName(rawName)
    const imageMime = sniffImageMime(bytes)
    const kind: AttachmentInfo['kind'] = imageMime ? 'image' : 'file'
    const mimeType = imageMime ?? sanitizeMime(declaredType) ?? mimeFromName(name)
    const dir = uploadsDir()
    await fsp.mkdir(dir, {recursive: true})
    const filePath = path.join(dir, id + diskExtension(name))
    await fsp.writeFile(filePath, bytes, {mode: 0o600})
    // A sidecar keeps the REAL display name/mime across a reload (the on-disk
    // name is deliberately boring). Best-effort: losing it costs only a label.
    const meta: UploadMeta = {name, mimeType, kind, size: bytes.length}
    await fsp.writeFile(metaPath(id), JSON.stringify(meta), {mode: 0o600}).catch(() => {})
    const file: UploadedFile = {
        id,
        name,
        kind,
        mimeType,
        size: bytes.length,
        url: `/uploads/${id}`,
        path: filePath
    }
    index.files.set(id, file)
    void pruneUploads()
    return file
}

/** What the sidecar remembers about one upload. */
interface UploadMeta {
    name: string
    mimeType: string
    kind: AttachmentInfo['kind']
    size: number
}

function metaPath(id: string): string {
    return path.join(uploadsDir(), `${id}.meta.json`)
}

/** Rebuild one entry from disk after a reload/restart (the index is memory-only
 *  but the files are not). Returns undefined when the id has no file. */
async function recoverUpload(id: string): Promise<UploadedFile | undefined> {
    if (!isUploadId(id)) return undefined
    let names: string[]
    try {
        names = await fsp.readdir(uploadsDir())
    } catch {
        return undefined
    }
    // `.meta.json` shares the id prefix, so exclude it explicitly.
    const diskName = names.find(n => n === id || (n.startsWith(`${id}.`) && !n.endsWith('.meta.json')))
    if (!diskName) return undefined
    const filePath = path.join(uploadsDir(), diskName)
    const st = await fsp.stat(filePath).catch(() => null)
    if (!st) return undefined
    const meta = await fsp
        .readFile(metaPath(id), 'utf8')
        .then(raw => JSON.parse(raw) as UploadMeta)
        .catch(() => undefined)
    let mimeType = meta?.mimeType ?? 'application/octet-stream'
    if (!meta) {
        try {
            const fh = await fsp.open(filePath, 'r')
            try {
                const buf = Buffer.alloc(64)
                const {bytesRead} = await fh.read(buf, 0, buf.length, 0)
                mimeType = sniffImageMime(buf.subarray(0, bytesRead)) ?? mimeFromName(diskName)
            } finally {
                await fh.close()
            }
        } catch {
            /* unreadable — treat as a generic file */
        }
    }
    const kind: AttachmentInfo['kind'] = meta?.kind ?? (mimeType.startsWith('image/') ? 'image' : 'file')
    const file: UploadedFile = {
        id,
        name: meta?.name ?? diskName,
        kind,
        mimeType,
        size: st.size,
        url: `/uploads/${id}`,
        path: filePath
    }
    index.files.set(id, file)
    return file
}

/** Resolve the ids a browser referenced in one chat line. Unknown ids are
 *  dropped — the message still goes through with whatever survived, exactly
 *  like an ignored duplicate frame. */
export async function resolveUploads(ids: readonly string[]): Promise<UploadedFile[]> {
    const out: UploadedFile[] = []
    for (const id of ids) {
        if (!isUploadId(id) || out.some(f => f.id === id)) continue
        const file = index.files.get(id) ?? (await recoverUpload(id))
        if (file) out.push(file)
    }
    return out
}

/** Best-effort age-based cleanup, at most once an hour. Uploads are inputs to a
 *  conversation, not permanent state; a week is long enough to reopen one. */
async function pruneUploads(): Promise<void> {
    const now = Date.now()
    if (now - index.lastPrune < PRUNE_INTERVAL_MS) return
    index.lastPrune = now
    const dir = uploadsDir()
    try {
        const names = await fsp.readdir(dir)
        for (const name of names) {
            const p = path.join(dir, name)
            const st = await fsp.stat(p).catch(() => null)
            if (st && now - st.mtimeMs > MAX_AGE_MS) {
                await fsp.unlink(p).catch(() => {})
                // The sidecar goes with its data file, never on its own.
                if (UPLOAD_ID.test(name.slice(0, 16)) && !name.endsWith('.meta.json')) {
                    await fsp.unlink(metaPath(name.slice(0, 16))).catch(() => {})
                }
            }
        }
        for (const [id, file] of index.files) {
            if (!fs.existsSync(file.path)) index.files.delete(id)
        }
    } catch {
        /* no directory yet, or a transient read error — nothing to prune */
    }
}

// ─── HTTP routes ────────────────────────────────────────────────────────────

function sendText(res: ServerResponse, status: number, text: string): void {
    res.writeHead(status, {'Content-Type': 'text/plain; charset=utf-8'})
    res.end(text)
}

/** `POST /upload?name=…&type=…` — the raw request body is the file. */
export function handleUploadRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '/upload', 'http://localhost')
    const name = url.searchParams.get('name') ?? 'file'
    const type = url.searchParams.get('type') ?? ''
    const declared = Number(req.headers['content-length'] ?? '')
    if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES) {
        req.resume()
        sendText(res, 413, 'too large')
        return
    }
    const chunks: Buffer[] = []
    let total = 0
    let rejected = false
    req.on('data', (chunk: Buffer) => {
        if (rejected) return
        total += chunk.length
        if (total > MAX_UPLOAD_BYTES) {
            rejected = true
            sendText(res, 413, 'too large')
            req.destroy()
            return
        }
        chunks.push(chunk)
    })
    req.on('end', () => {
        if (rejected) return
        if (total === 0) {
            sendText(res, 400, 'empty upload')
            return
        }
        void saveUpload(name, Buffer.concat(chunks), type)
            .then(file => {
                res.writeHead(201, {'Content-Type': 'application/json; charset=utf-8'})
                res.end(JSON.stringify(toAttachmentInfo(file)))
            })
            .catch(() => sendText(res, 500, 'upload failed'))
    })
    req.on('error', () => {
        if (!res.headersSent) sendText(res, 400, 'upload aborted')
    })
}

/** `GET /uploads/<id>` — serve one saved file. Only sniffed raster images are
 *  eligible for inline rendering; everything else downloads as opaque bytes, so
 *  an uploaded HTML/SVG file can never execute on the remote origin. */
export function handleServeUpload(res: ServerResponse, id: string): void {
    if (!isUploadId(id)) {
        sendText(res, 404, 'Not found')
        return
    }
    void (async () => {
        const file = index.files.get(id) ?? (await recoverUpload(id))
        const st = file ? await fsp.stat(file.path).catch(() => null) : null
        if (!file || !st) {
            sendText(res, 404, 'Not found')
            return
        }
        const inlineSafe = file.kind === 'image'
        const disposition = inlineSafe ? 'inline' : 'attachment'
        res.writeHead(200, {
            'Content-Type': inlineSafe ? file.mimeType : 'application/octet-stream',
            'Content-Length': String(st.size),
            'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
            'Cache-Control': 'private, max-age=31536000, immutable',
            'X-Content-Type-Options': 'nosniff'
        })
        const stream = createReadStream(file.path)
        stream.on('error', () => res.destroy())
        stream.pipe(res)
    })()
}
