import { describe, expect, it } from 'vitest'
import { signPayload } from '../crypto.js'
import { handleToken } from '../token.js'
import type { AuthCodePayload, OAuthEnv } from '../types.js'

const ENV: OAuthEnv = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  OAUTH_SIGNING_SECRET: 'test-signing-secret',
  MCP_PUBLIC_URL: 'https://input-output.pages.dev',
}

function makeForm(fields: Record<string, string>): Request {
  const body = new URLSearchParams(fields).toString()
  return new Request('https://example.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
}

async function makeAuthCode(overrides: Partial<AuthCodePayload> = {}): Promise<string> {
  const payload: AuthCodePayload = {
    typ: 'auth_code',
    client_id: 'client-1',
    redirect_uri: 'https://grok.com/oauth/callback',
    code_challenge: await sha256b64u('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
    code_challenge_method: 'S256',
    access_token: 'access',
    refresh_token: 'refresh',
    exp: Math.floor(Date.now() / 1000) + 300,
    ...overrides,
  }
  return signPayload(ENV.OAUTH_SIGNING_SECRET, payload)
}

async function sha256b64u(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Buffer.from(new Uint8Array(buf)).toString('base64url')
}

describe('handleToken / authorization_code', () => {
  it('rejects non-POST methods with 405', async () => {
    const res = await handleToken(new Request('https://example.com/token'), ENV)
    expect(res.status).toBe(405)
  })

  it('exchanges a valid code for the access + refresh token', async () => {
    const code = await makeAuthCode()
    const res = await handleToken(
      makeForm({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'https://grok.com/oauth/callback',
        client_id: 'client-1',
        code_verifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
      }),
      ENV,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      access_token: string
      refresh_token: string
      token_type: string
    }
    expect(body.access_token).toBe('access')
    expect(body.refresh_token).toBe('refresh')
    expect(body.token_type).toBe('Bearer')
  })

  it('rejects a tampered code (signature mismatch)', async () => {
    const code = await makeAuthCode()
    const tampered = code.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'))
    const res = await handleToken(
      makeForm({
        grant_type: 'authorization_code',
        code: tampered,
        redirect_uri: 'https://grok.com/oauth/callback',
        client_id: 'client-1',
        code_verifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
      }),
      ENV,
    )
    expect(res.status).toBe(400)
  })

  it('rejects a redirect_uri that does not match the code', async () => {
    const code = await makeAuthCode()
    const res = await handleToken(
      makeForm({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'https://attacker.example.com/cb',
        client_id: 'client-1',
        code_verifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
      }),
      ENV,
    )
    expect(res.status).toBe(400)
  })

  it('rejects a code_verifier that does not match the challenge', async () => {
    const code = await makeAuthCode()
    const res = await handleToken(
      makeForm({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'https://grok.com/oauth/callback',
        client_id: 'client-1',
        code_verifier: 'a-different-verifier-string-of-sufficient-length',
      }),
      ENV,
    )
    expect(res.status).toBe(400)
  })

  it('rejects an expired code', async () => {
    const code = await makeAuthCode({ exp: Math.floor(Date.now() / 1000) - 10 })
    const res = await handleToken(
      makeForm({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'https://grok.com/oauth/callback',
        client_id: 'client-1',
        code_verifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
      }),
      ENV,
    )
    expect(res.status).toBe(400)
  })

  it('rejects unsupported grant types', async () => {
    const res = await handleToken(makeForm({ grant_type: 'password' }), ENV)
    expect(res.status).toBe(400)
  })
})

describe('handleToken / refresh_token', () => {
  it('rejects when refresh_token is missing', async () => {
    const res = await handleToken(makeForm({ grant_type: 'refresh_token' }), ENV)
    expect(res.status).toBe(400)
  })
})
