# Source Endpoints

This file records observed and verified source endpoints. Do not promote a candidate endpoint to production parsing until its request and response have been captured and field mappings are confirmed.

## Reverse Engineering Status

Date checked: 2026-05-17

- `https://www.ezmoney.com.tw/ETF/Fund/Info?fundCode=49YTW`
  - Result from Playwright Chromium: HTTP 200.
  - Observed XHR:
    - `POST https://www.ezmoney.com.tw/ETF/Fund/fundNav`
    - `GET https://www.ezmoney.com.tw/ETF/Fund/ValueJson/?fundCode=49YTW`
  - Status: useful for master/NAV history, not the main holdings source.

- `https://www.ezmoney.com.tw/ETF/Transaction/PCF?fundCode=49YTW`
  - Result from Playwright Chromium: HTTP 200.
  - Observed XHR:
    - `POST https://www.ezmoney.com.tw/ETF/Transaction/GetPCF`
  - Status: verified primary source for holdings and PCF summary.

- `https://www.ezmoney.com.tw/ETF/Transaction/UnitMarketRatio?fundCode=49YTW`
  - Result from Playwright Chromium: redirected to risk disclosure page:
    `https://www.ezmoney.com.tw/ETF/Transaction/RiskDisclosure?actionName=UnitMarketRatio&fundCode=49YTW`
  - Status: requires extra risk-disclosure flow before discount/premium endpoint discovery.

- `https://webuat.ezmoney.com.tw/ETF/Fund/ETFNavPrint?fundCode=49YTW`
  - Discovery source: search result snippet exposed historical NAV-like tabular data.
  - Local escalated `curl -I` hung and was terminated after roughly 36 seconds.
  - Status: candidate only, not production.

## 00981A holdings

URL: `https://www.ezmoney.com.tw/ETF/Transaction/GetPCF`

Method: POST

Headers:

```txt
Accept: application/json, text/javascript, */*; q=0.01
Content-Type: application/json; charset=UTF-8
X-Requested-With: XMLHttpRequest
Referer: https://www.ezmoney.com.tw/ETF/Transaction/PCF?fundCode=49YTW
User-Agent: browser user-agent
```

Payload:

```json
{
  "fundCode": "49YTW",
  "date": "115/05/18",
  "specificDate": false
}
```

Response sample:

```json
{
  "pcf": [
    { "PCFCode": "NAV", "PCFName": "基金淨資產價值(元)", "Amount": 257218842106 },
    { "PCFCode": "OUT_UNIT", "PCFName": "已發行受益權單位總數", "Amount": 9078209000 },
    { "PCFCode": "P_UNIT", "PCFName": "每受益權單位淨資產價值(元)", "Amount": 28.33, "ValueDate": "115/05/15 " }
  ],
  "asset": [
    {
      "AssetCode": "ST",
      "AssetName": "股票",
      "Value": 244519834210,
      "Details": [
        {
          "DetailCode": "2330",
          "DetailName": "台積電",
          "Share": 11657000,
          "Amount": 26403105000,
          "NavRate": 10.26,
          "TranDate": "/Date(1778774400000)/"
        }
      ]
    }
  ]
}
```

Fields mapping:

```txt
asset[AssetCode=ST].Details[].DetailCode -> etf_daily_holdings.stockId
asset[AssetCode=ST].Details[].DetailName -> etf_daily_holdings.stockName
asset[AssetCode=ST].Details[].Share -> etf_daily_holdings.shares
asset[AssetCode=ST].Details[].Share / 1000 -> etf_daily_holdings.lots
asset[AssetCode=ST].Details[].NavRate -> etf_daily_holdings.weight
asset[AssetCode=ST].Details[].Amount -> etf_daily_holdings.marketValue
asset[AssetCode=ST].Details[].TranDate -> etf_daily_holdings.tradeDate

pcf[PCFCode=P_UNIT].Amount -> etf_daily_summary.nav
pcf[PCFCode=NAV].Amount -> etf_daily_summary.fundSize
pcf[PCFCode=OUT_UNIT].Amount -> etf_daily_summary.totalUnits
pcf[PCFCode=DIFF_UNIT].Amount -> etf_daily_summary.netCreationUnits
asset[AssetCode=ST].Value / pcf[PCFCode=NAV].Amount * 100 -> etf_daily_summary.stockRatio
```

Need cookie: yes for direct non-browser calls. First POST returns 307 with `__nxquid`; replaying the POST with that cookie returns JSON.

Need csrf token: no observed CSRF token.

Notes:

- Playwright capture file: `output/playwright/source-discovery/xhr-200-284bd03c72b68dd6.json`.
- Direct `curl` works when using a cookie jar and `-L`.
- Empty `date` returns HTML, not JSON. Date should be ROC format such as `115/05/18`.

## 00981A PCF

URL: `https://www.ezmoney.com.tw/ETF/Transaction/GetPCF`

Method: POST

Headers: same as holdings endpoint.

Payload: same as holdings endpoint.

Response sample: same as holdings endpoint.

Fields mapping: see holdings section.

Need cookie: yes for direct non-browser calls.

Need csrf token: no observed CSRF token.

Notes:

- This endpoint is the primary MVP source because it contains both PCF rows and stock holding details.

## 00981A NAV candidate

URL: `https://webuat.ezmoney.com.tw/ETF/Fund/ETFNavPrint?fundCode=49YTW`

Method: GET

Headers: standard browser headers, unverified

Payload: none

Response sample: not captured locally

Fields mapping:

- Candidate fields observed from search snippet: ROC date, NAV, change, change percent.
- Not mapped in code until a raw response is captured.

Need cookie: unknown

Need csrf token: unknown

Notes:

- Treat as candidate evidence only. Do not depend on the `webuat` host for production without confirmation.
