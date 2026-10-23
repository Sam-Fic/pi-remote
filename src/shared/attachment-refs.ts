/**
 * The block that names attachments by path in a prompt.
 *
 * Shared by the two places that deliver a user line to the agent — the remote
 * composer (which also attaches images inline) and the held-input queue (whose
 * delivery is a plain string, so the path line is the ONLY way an attachment
 * survives). Keeping one formatter means the agent always sees the same shape,
 * whether the line was sent live or replayed at the next task turn.
 */
export type AttachmentRef = {path: string; kind: 'image' | 'file'}

export function attachmentPathRefs(refs: readonly AttachmentRef[]): string {
    if (refs.length === 0) return ''
    const lines = refs.map(r => `- ${r.path}${r.kind === 'image' ? ' (image)' : ''}`)
    return `\n\nAttached files (use the read tool to inspect them):\n${lines.join('\n')}`
}

/** Same block, from bare paths (the held-input queue only keeps paths). */
export function attachmentPathRefsFromPaths(paths: readonly string[]): string {
    return attachmentPathRefs(paths.map(p => ({path: p, kind: 'file' as const})))
}
