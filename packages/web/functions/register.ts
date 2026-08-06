/// <reference types="@cloudflare/workers-types" />

import { handleRegister } from '@input_output/mcp-server/oauth'
import { resolveOAuthEnv, type PagesOAuthEnv } from './_oauth-env'

export const onRequest = async (context: EventContext<PagesOAuthEnv, string, unknown>) => {
  return handleRegister(context.request, resolveOAuthEnv(context.request, context.env))
}
