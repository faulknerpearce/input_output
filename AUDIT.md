# Codebase Audit

A one-time audit of `input_output` to remove dead code, misconfigurations,
and duplications. Findings are organised by phase; each phase was applied as a
single, focused change set.

## Phase 1 — Dead code removal

| What                                       | Why it was dead                                                                                 |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `packages/web/src/lib/database.ts`         | Re-export shim with zero importers anywhere in the repo                                         |
| `packages/mcp-server/src/database.ts`      | Same shim, and not even declared in `mcp-server/package.json`'s `exports` map                   |
| `fetchPriorDaySummaries`                   | Exported from `lib/entries.ts` but never called                                                 |
| `buildNewEntry`                            | Exported from `parseEntryInput.ts` but never called; only `buildUpdate/InsertPayload` were used |
| `createSupabase`                           | Server-side helper exported but never imported; only `createAuthenticatedSupabase` is used      |
| `getAccessToken`                           | Unused helper in `lib/entries.ts`                                                               |
| `packages/web/functions/api/entries/`      | Empty dir left over from the removed `/api/entries` proxy                                       |
| `path === 'history'` alias in `routing.ts` | Vestigial alias no link or test ever produced                                                   |
| `entries.ts` re-export of `sumTotals` etc. | All consumers already import from `@input_output/shared` directly                          |
| Re-imports of `calGoal`/`proGoal`/etc.     | Brought in only because the unused re-export needed them                                        |

## Phase 2 — Misconfig fixes

- **CI env vars**: removed `SUPABASE_SERVICE_ROLE_KEY` and `VITE_NUTRITION_API_TOKEN` (leftover from the removed dev middleware) and replaced with the actual Vite build-time vars.
- **`.gitignore`**: dropped the redundant `packages/*/dist` line (already covered by the leading `dist` rule).
- **`useEffect` deps in modals**: removed the `onCloseRef` mirror pattern. Modal lifecycle already gives us the right semantics — the listener is torn down on unmount, so capturing the initial `onClose` is correct and explicit.
- **`dotenv` version**: aligned `mcp-server` (`^16.4.0`) with the web package (`^17.4.2`).
- **README**: removed the manual `build:shared`/`build:mcp-server` step (already in `prebuild`/`pretypecheck`); added the third migration to the docs; added the `/.well-known/mcp` discovery route to `DEPLOY.md`.

## Phase 3 — Type/contract cleanup

- **`McpEnv.MCP_PUBLIC_URL`** is now **required** (matches runtime behaviour — `_oauth-env.ts` always resolves it). The OAuth handler types already required it; `http.ts` was the inconsistency.
- **`parseHashRoute`** no longer touches `window` at import time — the hash is passed explicitly. Makes the module safe to import in a non-DOM test context.
- **`AuthProvider.tsx`**: documented that `display_name` lives in two places (auth user-metadata + `profiles.display_name`) and which is the canonical record. A follow-up should query `profiles` from the UI.

## Phase 4 — Duplication reduction

- **Root `wrangler.toml`**: kept but slimmed down to a comment header explaining the relationship to `packages/web/wrangler.toml`. Both files are needed (root for Cloudflare Git builds, package for `wrangler pages dev`).
- **`functions/README.md`**: new file documenting the shim pattern so future contributors don't accidentally delete one half of the layer.
- **`parseActivityInput`**: refactored the 5-level nested ternaries into three small helpers (`readNumber`, `readRoundedNumber`, `readString`). File shrank from 118 to ~95 lines and the precedence (camelCase → snake_case → null) is now obvious.
- **MCP `update_food_entry` / `update_activity`**: now route through the same `parseEntryInput` / `parseActivityInput` and `buildUpdatePayload` / `buildActivityUpdatePayload` helpers used by the inserts. Single source of truth for camelCase↔snake_case and rounding.
- **MCP server `instructions`**: derived programmatically from the `tools` list. Adding a tool can no longer desync the instructions.
- **`packages/web/src/lib/styles.ts`**: new file holding shared inline-style tokens (`cardSurface`, `iconTileSm`, `iconTileMd`, `inputBase`, `labelBase`, `sectionHeader`, `pageTitle`, `subtleSurface`, `pill`, `primaryButton`). Applied to the three card components, both modals, the dashboard preview list, and all three pages.

## Phase 5 — Tests

- **New tests** in `packages/mcp-server/src/oauth/__tests__/`:
  - `metadata.test.ts` — `authorizationServerMetadata`, `openIdConfigurationMetadata`, `protectedResourceMetadata`, `wwwAuthenticateHeader`, and the cache-control headers on the well-known responses.
  - `register.test.ts` — method, JSON, and redirect-URI validation plus a happy-path registration.
  - `token.test.ts` — `authorization_code` (valid, tampered, mismatched `redirect_uri`, mismatched `code_verifier`, expired), `refresh_token` (missing), and unsupported grant type.
  - `authorize.test.ts` — `GET` (unsupported `response_type`, missing `client_id`, insecure `redirect_uri`, valid request renders login page) and `POST` (missing secret, non-GET/POST method).
- **Robust assertions**: `http.integration.test.ts` now asserts on a _set_ of expected tool names rather than a hard-coded count. `netBalance.test.ts` uses `toMatch` for the context message (asserts on shape, not the exact phrasing).

## Phase 6 — Repo hygiene

- **`supabase/config.toml`**: new file so `supabase start` is reproducible for new contributors.
- **`dev:mcp` script**: now auto-creates `packages/mcp-server/.env` from `.env.example` if it doesn't exist, with a one-line log.
- **`functions/README.md`**: documents the shim layer.
- **`AUDIT.md`**: this file.

## Open / not addressed

- **Cloudflare Pages rootless-functions**: still uses the shim pattern. Removing the shim requires Cloudflare's `[build]` config and is out of scope for this pass.

## Phase 7 — Recipe food-log math & config (2026-07)

Deep pass focused on recipe → food-entry scaling and related drift.

### Fixed

| Issue | Fix |
| ----- | --- |
| **Double-rounding in `scaleRecipeToServings`** — intermediate `perServingTotals` round then re-round on multiply undercounted macros (~43% of batch/serving pairs). Full-batch log of 1000 kcal / 3 servings stored **999**. | Single-round from batch: `Math.round(batch * servingsLogged / defaultServings)` in `packages/shared/src/recipeTotals.ts`. Affects web `logRecipe`, MCP `logRecipeEntry`, and UI previews. |
| **Recipe update omitted `serving_weight_grams`** — editor UI saved weight but DB never updated (web + MCP). | Update payloads now include `serving_weight_grams` from `buildRecipeInsertPayload`. |
| **MCP `parseRecipeInput` ignored serving weight** | Accepts `servingWeightGrams` / `serving_weight_grams`. |
| **Add Entry → Recipe allowed grams with default 100g** when recipe had no weight | Grams mode only when recipe has `servingWeightGrams` (matches `LogRecipeModal`). |
| **“Today” for recipe logs used browser-local date inconsistently** | Inputs/Recipes pass profile TZ calendar day; `logRecipe` fallback uses `todayISOInTimeZone`. |

### Residual / deferred (P2)

- Web `lib/recipes.ts` and MCP `recipeHandlers.ts` remain near-duplicates (~250 lines each) — drift risk remains; full merge out of scope.
- `supabase/migrations/` is empty; real SQL lives in `packages/shared/migrations/` (run manually / document for CLI users).
- No backfill of historical food entries that were undercounted by double-rounding.
- Dashboard / Outputs still use `todayISO()` in places; only Inputs + recipe log path were aligned to profile TZ in this pass.

