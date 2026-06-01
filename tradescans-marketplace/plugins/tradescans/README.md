# TradeScans plugin for Claude

<img src="assets/icon.png" alt="TradeScans" width="96" />

Access your [TradeScans](https://tradescans.com) trading journal from Claude. The
plugin ships a small MCP server that talks to your TradeScans account using a
personal API key, and skills for the common workflows.

## What it can do

| Skill / tools | Capability | API scope needed |
| --- | --- | --- |
| `analyze-performance` — `get_trades`, `get_open_positions` | Read trades & open positions, analyze P&L / win rate | `trades:read` |
| `log-trade` — `create_trade`, `update_trade`, `close_trade` | Log, edit, and close trades | `trades:write` |
| `run-strategy-scan` — `run_strategy_scan` | Run the options strategy engine for a ticker | `strategy:run` |
| `message-board` — `get_message_board`, `create_post` | Read and post to the community board | `posts:read`, `posts:write` |

## Setup (per user)

1. **Create an API key** in the TradeScans app (Settings → API keys). Copy the
   `ts_live_…` key — it is shown only once.
2. **Enable the scopes** the plugin needs. New keys are created with
   `trades:read` only. While signed in to TradeScans, run this once in the
   Supabase SQL editor (or call the RPC from the app), replacing the prefix with
   your key's first 12 characters:

   ```sql
   select public.add_api_key_scopes(
     'ts_live_abcd',
     array['trades:read','trades:write','strategy:run','posts:read','posts:write']
   );
   ```

3. **Install the plugin** and provide the API key one of two ways:

   - **File (simplest):** save your `ts_live_…` key to `~/.tradescans/api_key`:

     ```bash
     mkdir -p ~/.tradescans && printf '%s' 'ts_live_yourkey' > ~/.tradescans/api_key
     ```

   - **Env var:** set `TRADESCANS_API_KEY` in the plugin's MCP environment (if
     your host lets you set env vars on connectors).

The server reads the key from `TRADESCANS_API_KEY`, then `TRADESCANS_API_KEY_FILE`,
then `~/.tradescans/api_key` — the first one found wins. `TRADESCANS_API_BASE` is
optional and defaults to `https://fwchnblotwhnladyzpmf.supabase.co/functions/v1`.

The MCP server is zero-dependency and runs on Node 18+ (uses only built-in
modules and global `fetch`). No `npm install` is required.

## Backend deployment (one time, by the TradeScans operator)

The plugin calls these Supabase Edge Functions. Three are new and must be
deployed. Like the existing `api-trades` function, they authenticate by
`X-API-Key`, so deploy them with JWT verification off:

```bash
supabase functions deploy api-trades-write --no-verify-jwt
supabase functions deploy api-posts        --no-verify-jwt
supabase functions deploy api-strategy      --no-verify-jwt

# strategy engine needs a server-side market-data key:
supabase secrets set MASSIVE_API_KEY=...

# scopes RPC:
supabase db push   # applies supabase/migrations/20260531_plugin_api_scopes.sql
```

### Strategy function — single bundled file

`api-strategy/index.ts` is a **single self-contained file**: the strategy engine
(`src/services/strategy-engine`) is pre-bundled into it with esbuild, so the
function has no local subfolder imports and deploys via the CLI, dashboard, or
CI without any extra files. Run one live scan after deploying to confirm.

If you change the engine in `src/`, re-bundle it:

```bash
cd supabase/functions
# (temporarily re-vendor, bundle to a single file, then drop the copy)
cp -R ../../src/services/strategy-engine api-strategy/_engine
# rewrite index.ts's engine import to ./_engine/index.ts, then:
npx esbuild api-strategy/index.ts --bundle --format=esm --platform=neutral \
  --target=esnext '--external:https://*' '--external:http://*' \
  --outfile=api-strategy/index.ts
rm -rf api-strategy/_engine
```

## How auth works

Each tool call sends your `ts_live_…` key as `X-API-Key`. The Edge Function
hashes it (SHA-256), validates it via the `validate_api_key` RPC, checks the
required scope, and scopes every query to your `user_id`. The key never leaves
your machine except as a request header to your own TradeScans backend.
