export interface OAuthEnv {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  OAUTH_SIGNING_SECRET: string
  /** Public origin, e.g. https://input-output.pages.dev */
  MCP_PUBLIC_URL: string
}

export interface AuthCodePayload {
  typ: 'auth_code'
  client_id: string
  redirect_uri: string
  code_challenge: string
  code_challenge_method: string
  access_token: string
  refresh_token: string
  exp: number
}

export interface RegisteredClient {
  client_id: string
  client_name?: string
  redirect_uris: string[]
  grant_types: string[]
  response_types: string[]
  token_endpoint_auth_method: string
}
