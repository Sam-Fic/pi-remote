/**
 * The composer's attachments, from browser bytes to what the agent receives.
 *
 * Two things have to hold, and each one has pushed a decision:
 *
 *  - A message may carry images AND files. pi's `sendUserMessage` takes a
 *    content array whose only two block kinds are text and image, so images
 *    ride inline (vision models see them) while every attachment — images
 *    included — is ALSO named by absolute path in the text. That path line is
 *    what makes a file usable by a non-vision model, after a restart, or once
 *    the image has fallen out of the provider's window: the agent can just
 *    `read` it.
 *
 *  - Images are re-encoded before they reach the model. pi's `resizeImage` is
 *    the same worker the terminal's own image path uses, so a 12 MP phone
 *    screenshot is clamped to the provider's inline limits here instead of
 *    being rejected by the API mid-turn.
 *
 * Nothing in here imports @earendil-works/pi-ai: `ImageContent` is derived from
 * pi's own `sendUserMessage` signature, the same trick model-resolve.ts uses for
 * `Model`, so this package keeps its three peer dependencies.
 */
import * as fsp from 'node:fs/promises'
import type {ExtensionAPI} from '@earendil-works/pi-coding-agent'
import type {AttachmentInfo} from './protocol.js'
import {attachmentRefs, type UploadedFile} from './uploads.js'

type SendUserMessageContent = Parameters<ExtensionAPI['sendUserMessage']>[0]
type UserContentBlock = Exclude<SendUserMessageContent, string>[number]

/** pi-ai's ImageContent, named through pi's own public signature. */
export type InlineImage = Extract<UserContentBlock, {type: 'image'}>

/** Everything a chat line brought with it. `info` is what the transcript shows;
 *  `files` carries the absolute paths the agent is told about. */
export interface AttachmentBatch {
    info: AttachmentInfo[]
    files: UploadedFile[]
}

/** Largest image, per axis, handed to the provider inline. pi's own reader uses
 *  2000×2000; matching it keeps remote pastes and `read`-tool images consistent. */
const MAX_INLINE_DIMENSION = 2000

async function inlineImage(file: UploadedFile): Promise<InlineImage | undefined> {
    try {
        const bytes = await fsp.readFile(file.path)
        // Loaded lazily: the resize worker (Photon/WASM) is only worth pulling
        // in for a line that actually carries an image.
        const {resizeImage} = await import('@earendil-works/pi-coding-agent')
        const resized = await resizeImage(new Uint8Array(bytes), file.mimeType, {
            maxWidth: MAX_INLINE_DIMENSION,
            maxHeight: MAX_INLINE_DIMENSION
        })
        // `resizeImage` returns null when Photon is unavailable or the image
        // cannot be brought under the byte ceiling. The original bytes are then
        // still the best we have — the provider decides what to do with them.
        const data = resized ? resized.data : bytes.toString('base64')
        const mimeType = resized ? resized.mimeType : file.mimeType
        return {type: 'image', data, mimeType}
    } catch {
        return undefined
    }
}

/** Build the content blocks for one line: the text (with the attachment path
 *  block appended), then one image block per image that could be re-encoded.
 *  A line with no attachments stays a plain string — the exact old shape. */
export async function buildUserContent(
    text: string,
    batch: AttachmentBatch | undefined
): Promise<SendUserMessageContent> {
    if (!batch || batch.files.length === 0) return text
    const withRefs = `${text}${attachmentRefs(batch.files)}`.trim()
    const images: InlineImage[] = []
    for (const file of batch.files) {
        if (file.kind !== 'image') continue
        const img = await inlineImage(file)
        if (img) images.push(img)
    }
    if (images.length === 0) return withRefs
    const blocks: UserContentBlock[] = [{type: 'text', text: withRefs}, ...images]
    return blocks
}
