import { describe, expect, it } from 'vitest'
import {
  authorizationServerMetadata,
  handleAuthorizationServerMetadata,
  handleOpenIdConfigurationMetadata,
  handleProtectedResourceMetadata,
  openIdConfigurationMetadata,
  protectedResourceMetadata,
  wwwAuthenticateHeader,
} from '../metadata.js'
import type { OAuthEnv } from '../types.js'

const ENV: OAuthEnv = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  OAUTH_SIGNING_SECRET: 'secret',
  MCP_PUBLIC_URL: 'https://input-output.pages.dev',
}

describe('authorizationServerMetadata', () => {
  it('exposes the required OAuth 2.0 fields and matches the public origin', () => {
    const m = authorizationServerMetadata(ENV)
    expect(m.issuer).toBe('https://input-output.pages.dev')
    expect(m.authorization_endpoint).toBe('https://input-output.pages.dev/authorize')
    expect(m.token_endpoint).toBe('https://input-output.pages.dev/token')
    expect(m.registration_endpoint).toBe('https://input-output.pages.dev/register')
    expect(m.response_types_supported).toEqual(['code'])
    expect(m.grant_types_supported).toEqual(['authorization_code', 'refresh_token'])
    expect(m.code_challenge_methods_supported).toEqual(['S256'])
    expect(m.token_endpoint_auth_methods_supported).toEqual(['none'])
    expect(m.authorization_response_iss_parameter_supported).toBe(true)
  })

  it('strips trailing slashes from the origin', () => {
    const m = authorizationServerMetadata({ ...ENV, MCP_PUBLIC_URL: 'https://x.example.com/' })
    expect(m.issuer).toBe('https://x.example.com')
  })
})

describe('openIdConfigurationMetadata', () => {
  it('extends OAuth metadata with OIDC subject types', () => {
    const m = openIdConfigurationMetadata(ENV)
    expect(m.subject_types_supported).toEqual(['public'])
    expect(m.id_token_signing_alg_values_supported).toEqual(['none'])
    expect(m.issuer).toBe(ENV.MCP_PUBLIC_URL)
  })
})

describe('protectedResourceMetadata', () => {
  it('points at the /mcp resource and advertises header bearer auth', () => {
    const m = protectedResourceMetadata(ENV)
    expect(m.resource).toBe('https://input-output.pages.dev/mcp')
    expect(m.authorization_servers).toEqual(['https://input-output.pages.dev'])
    expect(m.bearer_methods_supported).toEqual(['header'])
  })
})

describe('wwwAuthenticateHeader', () => {
  it('quotes the resource_metadata URL and the supported scope', () => {
    const h = wwwAuthenticateHeader(ENV)
    expect(h).toContain('Bearer')
    expect(h).toContain(
      'resource_metadata="https://input-output.pages.dev/.well-known/oauth-protected-resource"',
    )
    expect(h).toContain('scope="openid profile"')
  })
})

describe('metadata response handlers', () => {
  it('set a 1-hour Cache-Control on each well-known response', async () => {
    for (const response of [
      handleAuthorizationServerMetadata(ENV),
      handleOpenIdConfigurationMetadata(ENV),
      handleProtectedResourceMetadata(ENV),
    ]) {
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600')
      const body = await response.json()
      expect(body).toBeDefined()
    }
  })
})
