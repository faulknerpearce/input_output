import { createClient } from '@supabase/supabase-js'
import type { Database } from '@input_output/shared'
import { signPayload } from './crypto.js'
import { isValidRedirectUri } from './redirect.js'
import type { AuthCodePayload, OAuthEnv } from './types.js'

const AUTH_CODE_TTL_SEC = 300

interface AuthorizeParams {
  response_type: string
  client_id: string
  redirect_uri: string
  code_challenge: string
  code_challenge_method: string
  state?: string
}

function parseAuthorizeParams(url: URL): AuthorizeParams | { error: string } {
  const response_type = url.searchParams.get('response_type') ?? ''
  const client_id = url.searchParams.get('client_id') ?? ''
  const redirect_uri = url.searchParams.get('redirect_uri') ?? ''
  const code_challenge = url.searchParams.get('code_challenge') ?? ''
  const code_challenge_method = url.searchParams.get('code_challenge_method') ?? 'S256'
  const state = url.searchParams.get('state') ?? undefined

  if (response_type !== 'code') return { error: 'unsupported_response_type' }
  if (!client_id) return { error: 'invalid_request' }
  if (!redirect_uri || !isValidRedirectUri(redirect_uri)) return { error: 'invalid_redirect_uri' }
  if (!code_challenge) return { error: 'invalid_request' }
  if (code_challenge_method !== 'S256') return { error: 'invalid_request' }

  return { response_type, client_id, redirect_uri, code_challenge, code_challenge_method, state }
}

function parseFormParams(form: FormData): AuthorizeParams | { error: string } {
  const get = (key: string) => {
    const v = form.get(key)
    return typeof v === 'string' ? v : ''
  }
  const response_type = get('response_type')
  const client_id = get('client_id')
  const redirect_uri = get('redirect_uri')
  const code_challenge = get('code_challenge')
  const code_challenge_method = get('code_challenge_method') || 'S256'
  const state = get('state') || undefined

  if (response_type !== 'code') return { error: 'unsupported_response_type' }
  if (!client_id) return { error: 'invalid_request' }
  if (!redirect_uri || !isValidRedirectUri(redirect_uri)) return { error: 'invalid_redirect_uri' }
  if (!code_challenge) return { error: 'invalid_request' }
  if (code_challenge_method !== 'S256') return { error: 'invalid_request' }

  return { response_type, client_id, redirect_uri, code_challenge, code_challenge_method, state }
}

function loginPage(params: AuthorizeParams, error?: string): Response {
  const hidden = (name: string, value: string) =>
    `<input type="hidden" name="${name}" value="${escapeHtml(value)}" />`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Authorize — input output</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Inter, system-ui, sans-serif; background: #fafafa; margin: 0; padding: 24px; color: #18181b; }
    .card { max-width: 400px; margin: 48px auto; padding: 32px; background: white; border-radius: 16px; border: 1px solid #e4e4e7; }
    h1 { font-family: 'Space Grotesk', Inter, system-ui, sans-serif; font-size: 24px; margin: 0 0 8px; }
    p { font-size: 14px; color: #71717a; margin: 0 0 24px; }
    label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; margin-bottom: 16px; }
    input[type="email"], input[type="password"] { padding: 10px 12px; border-radius: 8px; border: 1px solid #e4e4e7; font-size: 14px; }
    button { width: 100%; margin-top: 8px; padding: 12px 16px; border-radius: 8px; border: none; background: #134e4b; color: white; font-weight: 600; font-size: 14px; cursor: pointer; }
    .error { color: #dc2626; font-size: 13px; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Connect to input output</h1>
    <p>Sign in to let Grok access your food log on your behalf.</p>
    ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
    <form method="POST" action="/authorize">
      ${hidden('response_type', params.response_type)}
      ${hidden('client_id', params.client_id)}
      ${hidden('redirect_uri', params.redirect_uri)}
      ${hidden('code_challenge', params.code_challenge)}
      ${hidden('code_challenge_method', params.code_challenge_method)}
      ${params.state ? hidden('state', params.state) : ''}
      <label>Email
        <input type="email" name="email" required autocomplete="email" />
      </label>
      <label>Password
        <input type="password" name="password" required minlength="6" autocomplete="current-password" />
      </label>
      <button type="submit">Authorize</button>
    </form>
  </div>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function issueAuthCode(
  env: OAuthEnv,
  params: AuthorizeParams,
  accessToken: string,
  refreshToken: string,
): Promise<string> {
  const payload: AuthCodePayload = {
    typ: 'auth_code',
    client_id: params.client_id,
    redirect_uri: params.redirect_uri,
    code_challenge: params.code_challenge,
    code_challenge_method: params.code_challenge_method,
    access_token: accessToken,
    refresh_token: refreshToken,
    exp: Math.floor(Date.now() / 1000) + AUTH_CODE_TTL_SEC,
  }
  return signPayload(env.OAUTH_SIGNING_SECRET, payload)
}

export async function handleAuthorize(request: Request, env: OAuthEnv): Promise<Response> {
  if (!env.OAUTH_SIGNING_SECRET) {
    return Response.json(
      { error: 'server_error', error_description: 'OAuth not configured' },
      { status: 500 },
    )
  }

  if (request.method === 'GET') {
    const url = new URL(request.url)
    const parsed = parseAuthorizeParams(url)
    if ('error' in parsed) {
      return Response.json({ error: parsed.error }, { status: 400 })
    }
    return loginPage(parsed)
  }

  if (request.method === 'POST') {
    const form = await request.formData()
    const parsed = parseFormParams(form)
    if ('error' in parsed) {
      return Response.json({ error: parsed.error }, { status: 400 })
    }

    const email = form.get('email')
    const password = form.get('password')
    if (typeof email !== 'string' || typeof password !== 'string') {
      return loginPage(parsed, 'Email and password are required.')
    }

    const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.session) {
      return loginPage(parsed, error?.message ?? 'Sign in failed.')
    }

    const code = await issueAuthCode(
      env,
      parsed,
      data.session.access_token,
      data.session.refresh_token,
    )

    const redirect = new URL(parsed.redirect_uri)
    redirect.searchParams.set('code', code)
    redirect.searchParams.set('iss', env.MCP_PUBLIC_URL.replace(/\/$/, ''))
    if (parsed.state) redirect.searchParams.set('state', parsed.state)
    return Response.redirect(redirect.toString(), 302)
  }

  return Response.json({ error: 'method_not_allowed' }, { status: 405 })
}
