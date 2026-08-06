import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { McpEnv } from '../http.js'

const FAKE_USER = {
  id: 'test-user-id',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
}

const mockGetUser = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}))

const { handleMcp } = await import('../http.js')

const TEST_ENV: McpEnv = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
}

const MCP_ACCEPT = 'application/json, text/event-stream'

function mcpPost(
  body: unknown,
  options: { protocolVersion?: string; token?: string } = {},
): Request {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.token ?? 'fake-access-token'}`,
    Accept: MCP_ACCEPT,
    'Content-Type': 'application/json',
  }

  if (options.protocolVersion) {
    headers['mcp-protocol-version'] = options.protocolVersion
  }

  return new Request('https://example.com/mcp', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text()
  return JSON.parse(text)
}

describe('handleMcp HTTP integration', () => {
  beforeEach(() => {
    mockGetUser.mockReset()
    mockGetUser.mockResolvedValue({
      data: { user: FAKE_USER },
      error: null,
    })
  })

  it('handles MCP initialize and tools/list without a real Supabase token', async () => {
    const initializeRequest = mcpPost({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: LATEST_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'integration-test', version: '1.0.0' },
      },
    })

    const initializeResponse = await handleMcp(initializeRequest, TEST_ENV)
    const initializeBody = await readJsonBody(initializeResponse)

    expect(initializeResponse.status).toBe(200)
    expect(initializeResponse.headers.get('content-type')).toContain('application/json')
    expect(initializeBody).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: expect.any(String),
        capabilities: expect.objectContaining({
          tools: expect.any(Object),
        }),
        serverInfo: {
          name: 'input_output',
          version: '1.3.0',
        },
      },
    })
    expect((initializeBody as { error?: unknown }).error).toBeUndefined()

    const toolsListRequest = mcpPost(
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      },
      { protocolVersion: LATEST_PROTOCOL_VERSION },
    )

    const toolsListResponse = await handleMcp(toolsListRequest, TEST_ENV)
    const toolsListBody = await readJsonBody(toolsListResponse)

    expect(toolsListResponse.status).toBe(200)
    expect(toolsListResponse.headers.get('content-type')).toContain('application/json')
    expect(toolsListBody).toMatchObject({
      jsonrpc: '2.0',
      id: 2,
      result: {
        tools: expect.arrayContaining([
          expect.objectContaining({ name: 'list_food_entries' }),
          expect.objectContaining({ name: 'add_food_entry' }),
          expect.objectContaining({ name: 'update_food_entry' }),
          expect.objectContaining({ name: 'delete_food_entry' }),
          expect.objectContaining({ name: 'get_daily_totals' }),
        ]),
      },
    })
    expect((toolsListBody as { error?: unknown }).error).toBeUndefined()

    const tools = (toolsListBody as { result: { tools: { name: string }[] } }).result.tools
    const toolNames = tools.map((t) => t.name)
    expect(toolNames).toEqual(
      expect.arrayContaining([
        'list_food_entries',
        'add_food_entry',
        'update_food_entry',
        'delete_food_entry',
        'get_daily_totals',
        'list_activities',
        'add_activity',
        'update_activity',
        'delete_activity',
        'get_activity_totals',
        'manage_day_log',
        'list_recipes',
        'get_recipe',
        'save_recipe',
        'delete_recipe',
        'log_recipe',
      ]),
    )
  })

  it('returns 401 when Authorization header is missing', async () => {
    const request = new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        Accept: MCP_ACCEPT,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: LATEST_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'integration-test', version: '1.0.0' },
        },
      }),
    })

    const response = await handleMcp(request, TEST_ENV)
    const body = await readJsonBody(response)

    expect(response.status).toBe(401)
    expect(body).toEqual({
      error: 'Missing or invalid Authorization header (Bearer token required)',
    })
  })
})
