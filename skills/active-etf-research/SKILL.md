---
name: active-etf-research
description: Research supported Taiwan-listed ETF holdings, portfolio changes, overlap, and stock ownership through the Active ETF member MCP. Use for factual ETF research and comparisons.
---

# A repeatable research workflow

The Skill helps your AI choose the right tools, check dates, and turn observations into a clear research note. MCP provides the data; the Skill provides the workflow.

The first release covers supported Taiwan-listed ETFs, including Taiwan-listed funds investing overseas. It does not yet cover US-listed ETFs or 13F portfolios.

## How the Skill works

1. Identify the ETF or stock and the observation period.
2. Use the smallest set of tools that answers the question. Prefer a single comparison or brief over repeated snapshots.
3. Check source dates, missing observations and differences between raw and scale-adjusted changes.
4. Present facts, uncertainty and source links in your language. Never turn missing data into zero or promise a return.

## Research tools

- `search_market_entities`: Find an ETF (0 points).
- `get_etf_snapshot`: Complete latest holdings (1 points).
- `get_etf_changes`: Recent holding changes (1 points).
- `compare_etfs`: Compare ETF holdings (2 points).
- `get_stock_context`: Stock ownership across ETFs (2 points).
- `build_research_brief`: Daily research brief (3 points).
- `get_my_plan_usage`: Your remaining points (0 points).

20 points reset at 00:00 Asia/Taipei. All connected clients share one balance. Unused points do not roll over. Website browsing does not spend MCP points.
Failed or empty queries do not consume points. Repeating the same query within 10 minutes returns the same cached snapshot without charging again. Maximum 20 calls per minute and 2 concurrent queries.

Tool arguments: search_market_entities({query}); get_etf_snapshot({code}); get_etf_changes({code, days:1..30}); compare_etfs({codes:[2..3 distinct codes]}); get_stock_context({symbol}); build_research_brief({codes:[1..3 distinct codes]}); get_my_plan_usage({}).

On invalid_token, ask the user to reconnect through OAuth. On quota_exceeded, report resetsAt and stop retries. On request_in_progress or rate_limited, do not loop. Keep missing observations explicit. Repeated queries within the cache window return the prior snapshot. Never ask users to paste tokens in chat.

## Try asking

- Compare 00981A and 00991A: shared holdings, different exposures, and source dates.
- Summarize the last 7 days of holding changes for 00981A. Separate raw changes from scale-adjusted changes.
- Which tracked ETFs hold 2330? Show their source dates and recent observed changes.

No trading, personalized buy/sell instructions or advertising. A data date is not a real-time quote. Company and fund names remain in their source language.
Public-source research data. Not personalized investment advice.
