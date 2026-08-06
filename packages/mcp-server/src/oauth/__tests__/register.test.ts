import { describe, expect, it } from 'vitest'
import { handleRegister } from '../register.js'
import type { OAuthEnv } from '../types.js'

const ENV: OAuthEnv = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  OAUTH_SIGNING_SECRET: 'secret',
  MCP_PUBLIC_URL: 'https://input-output.pages.dev',
}

function post(body: unknown): Request {
  return new Request('https://example.com/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('handleRegister', () => {
  it('rejects non-POST methods with 405', async () => {
    const res = await handleRegister(new Request('https://example.com/register'), ENV)
    expect(res.status).toBe(405)
  })

  it('rejects malformed JSON with 400', async () => {
    const res = await handleRegister(
      new Request('https://example.com/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      }),
      ENV,
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'invalid_request',
      error_description: 'Invalid JSON',
    })
  })

  it('rejects missing redirect_uris', async () => {
    const res = await handleRegister(post({ client_name: 'X' }), ENV)
    expect(res.status).toBe(400)
  })

  it('rejects insecure non-local redirect_uris', async () => {
    const res = await handleRegister(post({ redirect_uris: ['http://evil.example.com/cb'] }), ENV)
    expect(res.status).toBe(400)
  })

  it('registers a client and returns a non-empty id with 201', async () => {
    const res = await handleRegister(
      post({ client_name: 'Grok', redirect_uris: ['https://grok.com/oauth/callback'] }),
      ENV,
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as {
      client_id: string
      client_name: string
      redirect_uris: string[]
    }
    expect(body.client_id).toMatch(/^[A-Za-z0-9_-]{16,}$/)
    expect(body.client_name).toBe('Grok')
    expect(body.redirect_uris).toEqual(['https://grok.com/oauth/callback'])
  })
})
