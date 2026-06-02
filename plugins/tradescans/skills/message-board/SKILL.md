---
name: message-board
description: >
  Read or post to the TradeScans community message board. Use when the user asks
  what people are posting, to read the feed or community board, to share a trade
  or thought, "post to the board", or to see recent TradeScans posts.
---

# TradeScans message board

Read and write the community board through the MCP tools.

## Reading

Use `get_message_board`. Defaults to the `community` feed, 25 most-recent posts.
Pass `type`, `limit` (max 100), or `offset` to page. Summarize the posts:
author display name, the content, and when relevant the attached trade. If the
user asks "what's being discussed", group by theme rather than listing every
post verbatim.

## Posting

Use `create_post` with `content` (required). Optionally set `type` (defaults to
community) and `trade_id` to attach one of the user's trades.

- Show the user the exact text you will post and get confirmation before
  calling `create_post` — posts are public to the community.
- After posting, confirm it went through and echo the returned post id.

## Errors

A scope error on read means the key lacks `posts:read`; on write, `posts:write`.
Point the user to the plugin README to enable the scope.
