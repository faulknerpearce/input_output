import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js'
import { SERVER_NAME, SERVER_VERSION, tools } from './server.js'

/** Public MCP manifest for connector registration probes (no auth required). */
export function publicToolManifest() {
  return {
    protocolVersion: LATEST_PROTOCOL_VERSION,
    serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
    capabilities: { tools: { listChanged: false } },
    instructions:
      'input output food log connector. Tools read and write per-user food entries, daily macro totals, and calorie goals.',
    tools,
  }
}

export function handlePublicToolSchema(): Response {
  return Response.json(publicToolManifest(), {
    headers: { 'Cache-Control': 'public, max-age=300' },
  })
}
