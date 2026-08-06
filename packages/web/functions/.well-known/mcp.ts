/// <reference types="@cloudflare/workers-types" />

// MCP connector probe endpoint. Some MCP clients (e.g. Grok) call `/.well-known/mcp`
// to discover the server's public tool manifest before opening the OAuth flow.
// The same payload is also served at `/.well-known/mcp/schema` for clients that
// follow the RFC 8615 sub-resource convention.

import { handlePublicToolSchema } from '@input_output/mcp-server/schema'

export const onRequest = async () => handlePublicToolSchema()
