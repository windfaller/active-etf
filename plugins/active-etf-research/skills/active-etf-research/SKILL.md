---
name: active-etf-research
description: Research supported Taiwan-listed and US-listed ETF holdings, observed portfolio changes, overlap, and stock ownership with the ETF Holdings Radar member MCP. Use for source-linked ETF research, not trades or personalized investment advice.
---

# ETF Holdings Radar research

Use the bundled `active-etf` MCP connection. If authentication is needed, let the client start OAuth and ask the user to approve the read-only connection in the browser. Never request passwords, tokens, authorization codes, or copied OAuth URLs in chat. If authorization expires, restart the connection in the client; do not replay an old link.

The service covers supported Taiwan-listed and US-listed ETFs, including some funds investing outside their listing market. It does not cover 13F portfolios. Compare ETFs only within the same listing market. Data are issuer observations, not live quotes or proof of trades.

## Research workflow

1. Identify the ETF codes or stock ticker, market, and observation period. Use `search_market_entities` when the code is uncertain.
2. Use the smallest set of tools that answers the user's question. `get_my_plan_usage` and `search_market_entities` cost 0 points; snapshots and changes cost 1; comparisons and stock context cost 2; a brief costs 3. Members share 20 points per Asia/Taipei day across connected clients.
3. Check each source date, source link, coverage gap, and missing field. For US-listed ETFs, holding-change output can be truncated and weight changes are not necessarily trades. Do not turn missing data into zero.
4. Summarize the observed facts in the user's language. Distinguish raw holding changes from changes adjusted for fund scale when the data supports that distinction. State uncertainty and avoid return predictions or personal buy/sell directions.

Available tools: `search_market_entities({query, market?: "all"|"tw"|"us"})`, `get_etf_snapshot({code})`, `get_etf_changes({code, days?: 1..30, limit?: 1..500})`, `compare_etfs({codes: [2..3 same-market ETF codes]})`, `get_stock_context({symbol, market?: "tw"|"us"})`, `build_research_brief({codes: [1..3 ETF codes]})`, and `get_my_plan_usage({})`.

If a query has no current data, say so and identify the latest available source date when provided. Failed or empty queries do not consume research points. A repeated query within ten minutes can return a cached snapshot. On `quota_exceeded`, report `resetsAt` and stop; on `rate_limited` or `request_in_progress`, avoid repeated retries. This plugin cannot place trades, send messages, change accounts, or display advertisements.

Examples: compare 00981A with 00982A and cite each data date; show the latest DRAM holdings and issuer date; find which tracked Taiwan ETFs hold 2330; or check today's remaining research points.

Service guide: https://active-etf-mcp.inthewins.com/en/mcp/skill
