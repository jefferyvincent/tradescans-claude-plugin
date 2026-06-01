#!/usr/bin/env node
// TradeScans MCP server (stdio, zero dependencies, Node 18+).
//
// Speaks newline-delimited JSON-RPC 2.0 over stdin/stdout (MCP stdio transport)
// and exposes TradeScans trade, position, strategy, and message-board tools.
// Each tool calls a Supabase Edge Function authenticated with the user's
// TradeScans API key (ts_live_...). The key is read from, in order:
//   1. TRADESCANS_API_KEY env var
//   2. the file at TRADESCANS_API_KEY_FILE
//   3. ~/.tradescans/api_key
// so it works whether or not the host injects env vars.

import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Treat an unsubstituted "${VAR}" placeholder (passed through by some hosts when
// the var is unset) the same as missing.
function envOr(name, fallback = "") {
  const v = process.env[name];
  if (!v || v.includes("${")) return fallback;
  return v;
}

function readKeyFile(path) {
  try {
    const v = readFileSync(path, "utf8").trim();
    return v && !v.includes("${") ? v : "";
  } catch {
    return "";
  }
}

function resolveApiKey() {
  const fromEnv = envOr("TRADESCANS_API_KEY");
  if (fromEnv) return fromEnv;
  const customFile = envOr("TRADESCANS_API_KEY_FILE");
  if (customFile) {
    const v = readKeyFile(customFile);
    if (v) return v;
  }
  return readKeyFile(join(homedir(), ".tradescans", "api_key"));
}

const API_BASE = envOr(
  "TRADESCANS_API_BASE",
  "https://fwchnblotwhnladyzpmf.supabase.co/functions/v1",
);
const API_KEY = resolveApiKey();

// Bundled brand icon -> data URI for the connectors list (MCP spec SEP-973).
// Best-effort: if the file is missing, just omit icons.
function loadIcon() {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const png = readFileSync(join(here, "..", "assets", "icon-128.png"));
    return [
      {
        src: `data:image/png;base64,${png.toString("base64")}`,
        mimeType: "image/png",
        sizes: ["128x128"],
      },
    ];
  } catch {
    return undefined;
  }
}

const SERVER_INFO = {
  name: "tradescans",
  title: "TradeScans",
  version: "0.1.0",
  icons: loadIcon(),
};
const PROTOCOL_VERSION = "2024-11-05";

// ---- HTTP helper -----------------------------------------------------------
async function callFunction(path, { method = "GET", query, body } = {}) {
  if (!API_KEY) {
    throw new Error(
      "No TradeScans API key found. Set TRADESCANS_API_KEY, or put your ts_live_ key in ~/.tradescans/api_key.",
    );
  }
  let url = `${API_BASE}/${path}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  const res = await fetch(url, {
    method,
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok) {
    const detail = parsed?.error || parsed?.raw || res.statusText;
    throw new Error(`${res.status}: ${detail}`);
  }
  return parsed;
}

// ---- Tool definitions ------------------------------------------------------
const tools = [
  {
    name: "get_trades",
    description:
      "List the user's trades. Filter by status (open/closed/expired/assigned), symbol, and date range.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["open", "closed", "expired", "assigned"] },
        symbol: { type: "string", description: "Ticker, e.g. AAPL" },
        start_date: { type: "string", description: "YYYY-MM-DD (entry date >=)" },
        end_date: { type: "string", description: "YYYY-MM-DD (entry date <=)" },
        limit: { type: "number", description: "Max rows (default 100, max 500)" },
        offset: { type: "number" },
      },
    },
    run: (a) =>
      callFunction("api-trades", {
        query: {
          status: a.status,
          symbol: a.symbol,
          start_date: a.start_date,
          end_date: a.end_date,
          limit: a.limit,
          offset: a.offset,
        },
      }),
  },
  {
    name: "get_open_positions",
    description: "List the user's currently open positions (trades with status=open).",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
    },
    run: (a) =>
      callFunction("api-trades", {
        query: { status: "open", symbol: a.symbol, limit: a.limit, offset: a.offset },
      }),
  },
  {
    name: "create_trade",
    description:
      "Create a new trade. Required: symbol, spread_type, entry_date (YYYY-MM-DD), entry_price. Optional journal/risk fields are passed through.",
    inputSchema: {
      type: "object",
      required: ["symbol", "spread_type", "entry_date", "entry_price"],
      properties: {
        symbol: { type: "string" },
        spread_type: { type: "string", description: "e.g. long_call, bull_put_credit, covered_call" },
        entry_date: { type: "string", description: "YYYY-MM-DD" },
        entry_price: { type: "number" },
        status: { type: "string", enum: ["open", "closed", "expired", "assigned"] },
        legs: { type: "array", description: "Option legs as JSON objects", items: { type: "object" } },
        notes: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        setup_rationale: { type: "string" },
        max_profit: { type: "number" },
        max_loss: { type: "number" },
      },
    },
    run: (a) => callFunction("api-trades-write", { method: "POST", body: a }),
  },
  {
    name: "update_trade",
    description: "Update fields on an existing trade. Requires id. Only provided fields change.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Trade id (uuid)" },
        notes: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        lessons_learned: { type: "string" },
        is_favorite: { type: "boolean" },
        status: { type: "string", enum: ["open", "closed", "expired", "assigned"] },
      },
    },
    run: (a) => callFunction("api-trades-write", { method: "PATCH", body: a }),
  },
  {
    name: "close_trade",
    description: "Close an open trade: sets status=closed and records exit details.",
    inputSchema: {
      type: "object",
      required: ["id", "exit_date", "exit_price"],
      properties: {
        id: { type: "string" },
        exit_date: { type: "string", description: "YYYY-MM-DD" },
        exit_price: { type: "number" },
        realized_pnl: { type: "number" },
        exit_reason: { type: "string" },
        closing_remarks: { type: "string" },
      },
    },
    run: (a) =>
      callFunction("api-trades-write", { method: "PATCH", body: { ...a, status: "closed" } }),
  },
  {
    name: "run_strategy_scan",
    description:
      "Run the TradeScans strategy engine for a symbol and return the top ranked option strategies.",
    inputSchema: {
      type: "object",
      required: ["symbol"],
      properties: {
        symbol: { type: "string" },
        profile: {
          type: "string",
          enum: [
            "ultra_conservative",
            "conservative",
            "moderate",
            "aggressive",
            "ultra_aggressive",
          ],
          description: "Risk profile (default moderate)",
        },
        overlay: { type: "string", enum: ["income", "growth"], description: "Default income" },
      },
    },
    run: (a) => callFunction("api-strategy", { method: "POST", body: a }),
  },
  {
    name: "get_message_board",
    description: "Read recent posts from the TradeScans message board.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Feed type (default community)" },
        limit: { type: "number", description: "Default 25, max 100" },
        offset: { type: "number" },
      },
    },
    run: (a) =>
      callFunction("api-posts", { query: { type: a.type, limit: a.limit, offset: a.offset } }),
  },
  {
    name: "create_post",
    description: "Post a message to the TradeScans message board.",
    inputSchema: {
      type: "object",
      required: ["content"],
      properties: {
        content: { type: "string" },
        type: { type: "string", description: "Feed type (default community)" },
        trade_id: { type: "string", description: "Optional trade to attach" },
      },
    },
    run: (a) => callFunction("api-posts", { method: "POST", body: a }),
  },
];

const toolByName = new Map(tools.map((t) => [t.name, t]));

// ---- JSON-RPC plumbing -----------------------------------------------------
function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function reply(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function replyError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handleMessage(msg) {
  const { id, method, params } = msg;

  // Notifications (no id) require no response.
  if (id === undefined || id === null) {
    return;
  }

  switch (method) {
    case "initialize":
      reply(id, {
        // Echo the client's protocol version so newer hosts apply newer
        // features (e.g. serverInfo icons); fall back to our baseline.
        protocolVersion:
          typeof params?.protocolVersion === "string"
            ? params.protocolVersion
            : PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
      return;

    case "ping":
      reply(id, {});
      return;

    case "tools/list":
      reply(id, {
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });
      return;

    case "tools/call": {
      const name = params?.name;
      const args = params?.arguments ?? {};
      const tool = toolByName.get(name);
      if (!tool) {
        replyError(id, -32602, `Unknown tool: ${name}`);
        return;
      }
      try {
        const data = await tool.run(args);
        reply(id, {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        });
      } catch (err) {
        reply(id, {
          isError: true,
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        });
      }
      return;
    }

    default:
      replyError(id, -32601, `Method not found: ${method}`);
  }
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return; // ignore non-JSON lines
  }
  handleMessage(msg).catch((err) => {
    process.stderr.write(`tradescans-mcp error: ${err?.stack || err}\n`);
  });
});
