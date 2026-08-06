/// <reference types="@cloudflare/workers-types" />

import { handleMcp } from '@input_output/mcp-server/http'
import { resolveOAuthEnv, type PagesOAuthEnv } from '../_oauth-env'

export const onRequest = async (context: EventContext<PagesOAuthEnv, string, unknown>) => {
  const oauthEnv = resolveOAuthEnv(context.request, context.env)
  return handleMcp(context.request, {
    SUPABASE_URL: oauthEnv.SUPABASE_URL,
    SUPABASE_ANON_KEY: oauthEnv.SUPABASE_ANON_KEY,
    OAUTH_SIGNING_SECRET: oauthEnv.OAUTH_SIGNING_SECRET,
    MCP_PUBLIC_URL: oauthEnv.MCP_PUBLIC_URL,
  })
}
