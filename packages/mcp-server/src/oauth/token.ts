import { createClient } from '@supabase/supabase-js'
import type { Database } from '@input_output/shared'
import { verifyPayload, verifyPkce } from './crypto.js'
import { redirectUriMatches } from './redirect.js'
import type { AuthCodePayload, OAuthEnv } from './types.js'

async function parseTokenBody(request: Request): Promise<URLSearchParams> {
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const json = (await request.json()) as Record<string, string>
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(json)) {
      if (typeof v === 'string') params.set(k, v)
    }
    return params
  }
  const text = await request.text()
  return new URLSearchParams(text)
}

function tokenResponse(accessToken: string, refreshToken: string, expiresIn = 3600): Response {
  return Response.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: expiresIn,
    refresh_token: refreshToken,
    scope: 'openid profile',
  })
}

async function handleAuthorizationCode(env: OAuthEnv, params: URLSearchParams): Promise<Response> {
  const code = params.get('code')
  const redirectUri = params.get('redirect_uri')
  const clientId = params.get('client_id')
  const codeVerifier = params.get('code_verifier')

  if (!code || !redirectUri || !clientId || !codeVerifier) {
    return Response.json(
      { error: 'invalid_request', error_description: 'Missing required parameters' },
      { status: 400 },
    )
  }

  const payload = await verifyPayload<AuthCodePayload>(env.OAUTH_SIGNING_SECRET, code)
  if (!payload || payload.typ !== 'auth_code') {
    return Response.json(
      { error: 'invalid_grant', error_description: 'Invalid or expired code' },
      { status: 400 },
    )
  }

  if (payload.client_id !== clientId) {
    return Response.json(
      { error: 'invalid_grant', error_description: 'client_id mismatch' },
      { status: 400 },
    )
  }

  if (!redirectUriMatches(payload.redirect_uri, redirectUri)) {
    return Response.json(
      { error: 'invalid_grant', error_description: 'redirect_uri mismatch' },
      { status: 400 },
    )
  }

  const pkceOk = await verifyPkce(
    codeVerifier,
    payload.code_challenge,
    payload.code_challenge_method,
  )
  if (!pkceOk) {
    return Response.json(
      { error: 'invalid_grant', error_description: 'PKCE verification failed' },
      { status: 400 },
    )
  }

  return tokenResponse(payload.access_token, payload.refresh_token)
}

async function handleRefreshToken(env: OAuthEnv, params: URLSearchParams): Promise<Response> {
  const refreshToken = params.get('refresh_token')
  if (!refreshToken) {
    return Response.json(
      { error: 'invalid_request', error_description: 'refresh_token is required' },
      { status: 400 },
    )
  }

  const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })
  if (error || !data.session) {
    return Response.json(
      { error: 'invalid_grant', error_description: error?.message ?? 'Refresh failed' },
      { status: 400 },
    )
  }

  return tokenResponse(
    data.session.access_token,
    data.session.refresh_token,
    data.session.expires_in ?? 3600,
  )
}

export async function handleToken(request: Request, env: OAuthEnv): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405 })
  }

  if (!env.OAUTH_SIGNING_SECRET) {
    return Response.json(
      { error: 'server_error', error_description: 'OAuth not configured' },
      { status: 500 },
    )
  }

  const params = await parseTokenBody(request)
  const grantType = params.get('grant_type')

  if (grantType === 'authorization_code') {
    return handleAuthorizationCode(env, params)
  }

  if (grantType === 'refresh_token') {
    return handleRefreshToken(env, params)
  }

  return Response.json(
    { error: 'unsupported_grant_type', error_description: `Unsupported grant_type: ${grantType}` },
    { status: 400 },
  )
}
