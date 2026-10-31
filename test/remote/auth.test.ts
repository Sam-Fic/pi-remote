import {afterEach, beforeEach, describe, expect, test} from 'bun:test'
import {readFileSync, existsSync, writeFileSync, mkdirSync} from 'node:fs'
import * as path from 'node:path'
import {tmpDir} from '../test-utils/tmp-dir.js'
import {
    loadOrCreateToken,
    tokenMatches,
    tokenFromUrl,
    withTokenQuery,
    tokenFilePath,
    TOKEN_PATH_ENV
} from '../../src/remote/auth.js'
import type {RemoteAuth} from '../../src/remote/auth.js'

let tokenFile: string
let prevEnv: string | undefined

beforeEach(() => {
    prevEnv = process.env[TOKEN_PATH_ENV]
    tokenFile = path.join(tmpDir('auth-token-'), 'remote-token.json')
    process.env[TOKEN_PATH_ENV] = tokenFile
})
afterEach(() => {
    if (prevEnv === undefined) delete process.env[TOKEN_PATH_ENV]
    else process.env[TOKEN_PATH_ENV] = prevEnv
})

describe('loadOrCreateToken()', () => {
    test('generates a 32-hex token and persists it on first use', () => {
        const token = loadOrCreateToken()
        expect(token).toMatch(/^[a-f0-9]{32}$/)
        expect(existsSync(tokenFile)).toBe(true)
        expect((JSON.parse(readFileSync(tokenFile, 'utf8')) as {token: string}).token).toBe(token)
    })

    test('returns the SAME token on a second call (restart stability)', () => {
        const first = loadOrCreateToken()
        const second = loadOrCreateToken()
        expect(second).toBe(first)
    })

    test('regenerates over a corrupt persisted file rather than throwing', () => {
        // Write a file whose token field fails the shape check.
        mkdirSync(path.dirname(tokenFile), {recursive: true})
        writeFileSync(tokenFile, JSON.stringify({token: 'not-hex'}), 'utf8')
        const token = loadOrCreateToken()
        expect(token).toMatch(/^[a-f0-9]{32}$/)
        expect(token).not.toBe('not-hex')
    })
})

describe('tokenMatches()', () => {
    const auth: RemoteAuth = {mode: 'token', token: 'a'.repeat(32)}

    test('accepts the exact token', () => {
        expect(tokenMatches(auth, 'a'.repeat(32))).toBe(true)
    })
    test('rejects a wrong token of the same length', () => {
        expect(tokenMatches(auth, 'b'.repeat(32))).toBe(false)
    })
    test('rejects a token of a different length', () => {
        expect(tokenMatches(auth, 'a'.repeat(31))).toBe(false)
    })
    test('rejects a missing token', () => {
        expect(tokenMatches(auth, null)).toBe(false)
        expect(tokenMatches(auth, undefined)).toBe(false)
    })
    test('off mode accepts everything, including nothing', () => {
        expect(tokenMatches({mode: 'off'}, null)).toBe(true)
        expect(tokenMatches({mode: 'off'}, 'whatever')).toBe(true)
    })
})

describe('tokenFromUrl()', () => {
    test('reads the token query param', () => {
        expect(tokenFromUrl('/ws?token=abc123')).toBe('abc123')
        expect(tokenFromUrl('/upload?name=x.png&type=image/png&token=t0k')).toBe('t0k')
    })
    test('returns null when absent or unparseable', () => {
        expect(tokenFromUrl('/ws')).toBeNull()
        expect(tokenFromUrl(undefined)).toBeNull()
    })
})

describe('withTokenQuery()', () => {
    test('uses ? on a bare URL and & on one that already has a query', () => {
        expect(withTokenQuery('http://h:1/', 'tok')).toBe('http://h:1/?token=tok')
        expect(withTokenQuery('/upload?name=x', 'tok')).toBe('/upload?name=x&token=tok')
    })
    test('percent-encodes the token', () => {
        expect(withTokenQuery('http://h/', 'a b')).toBe('http://h/?token=a%20b')
    })
})

describe('tokenFilePath()', () => {
    test('honours the env override', () => {
        expect(tokenFilePath()).toBe(tokenFile)
    })
})
