/// <reference types="@cloudflare/workers-types" />

import { handlePublicToolSchema } from '@input_output/mcp-server/schema'

export const onRequest = async () => handlePublicToolSchema()
