/// <reference types="@cloudflare/workers-types" />

import { handleProtectedResourceMetadata } from '@input_output/mcp-server/oauth'
import { resolveOAuthEnv, type PagesOAuthEnv } from '../../_oauth-env'

export const onRequest = async (context: EventContext<PagesOAuthEnv, string, unknown>) => {
  return handleProtectedResourceMetadata(resolveOAuthEnv(context.request, context.env))
}
