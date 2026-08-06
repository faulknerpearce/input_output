import type { OAuthEnv } from '@input_output/mcp-server/oauth'

export interface PagesOAuthEnv {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  OAUTH_SIGNING_SECRET: string
  MCP_PUBLIC_URL?: string
}

export function resolveOAuthEnv(request: Request, env: PagesOAuthEnv): OAuthEnv {
  const url = new URL(request.url)
  const publicUrl = env.MCP_PUBLIC_URL?.replace(/\/$/, '') ?? `${url.protocol}//${url.host}`
  return {
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
    OAUTH_SIGNING_SECRET: env.OAUTH_SIGNING_SECRET,
    MCP_PUBLIC_URL: publicUrl,
  }
}
