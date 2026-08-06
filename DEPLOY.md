# Cloudflare Deployment

Summary of the Cloudflare Pages setup and deploy steps after multi-user auth.

## What's in place

### Web app (`packages/web/`)

- Supabase Auth (email/password) with sign-in, sign-up, and log out
- Direct Supabase client queries with anon key + session JWT
- RLS scopes `food_entries` per user — no `/api/entries` proxy

### MCP server (`packages/mcp-server/`)

- `src/server.ts` — shared tool definitions; inserts include `user_id` from JWT
- `src/stdio.ts` — local stdio MCP; requires `SUPABASE_ACCESS_TOKEN`
- `src/http.ts` — JWT auth via `Authorization: Bearer`; uses anon key + user token
- `src/oauth/` — OAuth 2.1 + PKCE for Grok and other MCP clients

### Pages Functions (`packages/web/functions/`)

- `mcp/[[path]].ts` — wraps `handleMcp` from `@input_output/mcp-server/http`
- `authorize.ts`, `token.ts`, `register.ts` — OAuth endpoints
- `.well-known/oauth-*` — MCP OAuth metadata
- `.well-known/mcp.ts` — non-standard MCP discovery probe (returns the public tool manifest)

### Cloudflare config (`packages/web/wrangler.toml`)

- `pages_build_output_dir = "./dist"`
- Secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `OAUTH_SIGNING_SECRET`

## Routes exposed

| Path                                      | Purpose                                     |
| ----------------------------------------- | ------------------------------------------- |
| `/`                                       | Static React dashboard (auth required)      |
| `/mcp`                                    | MCP HTTP endpoint (Bearer JWT required)     |
| `/.well-known/oauth-authorization-server` | OAuth metadata for MCP clients (Grok, etc.) |
| `/.well-known/oauth-protected-resource`   | Protected resource metadata                 |
| `/.well-known/openid-configuration`       | OpenID Connect discovery                    |
| `/.well-known/mcp`                        | MCP connector probe (public tool manifest)  |
| `/authorize`                              | OAuth authorization + sign-in               |
| `/token`                                  | OAuth token exchange + refresh              |
| `/register`                               | Dynamic client registration                 |

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run build -w @input_output/mcp-server
```

## Cloudflare Pages (GitHub)

Connect `faulknerpearce/input_output` with these build settings (repo root):

| Setting                | Value                                                                   |
| ---------------------- | ----------------------------------------------------------------------- |
| Framework preset       | None                                                                    |
| Root directory         | _(blank)_                                                               |
| Build command          | `npm run build`                                                         |
| Build output directory | `packages/web/dist` _(or leave blank — root `wrangler.toml` sets this)_ |
| Node.js version        | `20`                                                                    |

The repo-root `wrangler.toml` and `functions/` wrappers exist so Git builds find Pages Functions (`/mcp`, OAuth) without changing the monorepo layout.

**Build-time env vars:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

**Runtime secrets:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `OAUTH_SIGNING_SECRET`

## Deploy steps

### 1. Supabase

Run migrations in SQL editor:

```
packages/shared/migrations/0001_add_entry_date.sql
packages/shared/migrations/0002_auth_and_user_scoping.sql
packages/shared/migrations/0003_activities.sql
```

Enable Email auth and set Site URL / redirect URLs in the Supabase dashboard.

### 2. Cloudflare one-time setup

```sh
npx wrangler login
npx wrangler pages project create input-output --production-branch main
```

### 3. Secrets

```sh
npx wrangler pages secret put SUPABASE_URL          --project-name input-output
npx wrangler pages secret put SUPABASE_ANON_KEY     --project-name input-output
npx wrangler pages secret put OAUTH_SIGNING_SECRET  --project-name input-output
# openssl rand -base64 32
```

### 4. Build and deploy

```sh
export VITE_SUPABASE_URL=https://<your-project>.supabase.co
export VITE_SUPABASE_ANON_KEY=<anon-key>
npm run build
cd packages/web && npx wrangler pages deploy dist --project-name input-output --branch main
```

### 5. Connect Grok (custom MCP connector)

1. Deploy and set all three secrets above.
2. In Grok, go to [grok.com/connectors](https://grok.com/connectors) → **New Connector** → **Custom**.
3. MCP server URL: `https://<your-pages-domain>/mcp`
4. Grok discovers OAuth metadata, opens `/authorize`, and prompts you to sign in with your Input Output account.
5. After authorization, Grok stores the Supabase access token and calls MCP tools on your behalf.

### 6. Connect other MCP clients

**OAuth-capable clients** (Grok, etc.): use the deployed `/mcp` URL — OAuth is automatic.

**Manual token clients** (local stdio, some IDEs): sign in via the web app, copy the Supabase `access_token`, and configure the client. For local stdio: set `SUPABASE_ACCESS_TOKEN` in `packages/mcp-server/.env` and run `npm run dev:mcp`.
