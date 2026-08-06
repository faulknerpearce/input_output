import { describe, expect, it } from 'vitest'
import { handleAuthorize } from '../authorize.js'
import type { OAuthEnv } from '../types.js'

const ENV: OAuthEnv = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  OAUTH_SIGNING_SECRET: 'test-signing-secret',
  MCP_PUBLIC_URL: 'https://input-output.pages.dev',
}

describe('handleAuthorize (GET)', () => {
  it('rejects unsupported response_type with 400', async () => {
    const url =
      'https://example.com/authorize?response_type=token&client_id=c&redirect_uri=https%3A%2F%2Fgrok.com%2Fcb&code_challenge=abc&code_challenge_method=S256'
    const res = await handleAuthorize(new Request(url), ENV)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'unsupported_response_type' })
  })

  it('rejects missing client_id with 400', async () => {
    const url =
      'https://example.com/authorize?response_type=code&redirect_uri=https%3A%2F%2Fgrok.com%2Fcb&code_challenge=abc&code_challenge_method=S256'
    const res = await handleAuthorize(new Request(url), ENV)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'invalid_request' })
  })

  it('rejects an insecure non-local redirect_uri with 400', async () => {
    const url =
      'https://example.com/authorize?response_type=code&client_id=c&redirect_uri=http%3A%2F%2Fevil.example.com%2Fcb&code_challenge=abc&code_challenge_method=S256'
    const res = await handleAuthorize(new Request(url), ENV)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'invalid_redirect_uri' })
  })

  it('renders a login page for a valid request', async () => {
    const url =
      'https://example.com/authorize?response_type=code&client_id=c&redirect_uri=https%3A%2F%2Fgrok.com%2Fcb&code_challenge=abc&code_challenge_method=S256&state=xyz'
    const res = await handleAuthorize(new Request(url), ENV)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toMatch(/text\/html/)
    const body = await res.text()
    expect(body).toContain('Connect to input output')
    expect(body).toContain('name="state" value="xyz"')
  })
})

describe('handleAuthorize (POST)', () => {
  it('rejects when OAUTH_SIGNING_SECRET is missing with 500', async () => {
    const form = new FormData()
    form.set('response_type', 'code')
    form.set('client_id', 'c')
    form.set('redirect_uri', 'https://grok.com/cb')
    form.set('code_challenge', 'abc')
    form.set('code_challenge_method', 'S256')
    form.set('email', 'u@example.com')
    form.set('password', 'hunter2')
    const res = await handleAuthorize(
      new Request('https://example.com/authorize', { method: 'POST', body: form }),
      { ...ENV, OAUTH_SIGNING_SECRET: '' },
    )
    expect(res.status).toBe(500)
  })

  it('rejects non-GET/POST with 405', async () => {
    const res = await handleAuthorize(
      new Request('https://example.com/authorize', { method: 'PUT' }),
      ENV,
    )
    expect(res.status).toBe(405)
  })
})
