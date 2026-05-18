# Source Endpoints

This file records observed and verified source endpoints. Do not promote a candidate endpoint to production parsing until its request and response have been captured and field mappings are confirmed.

## Reverse Engineering Status

Date checked: 2026-05-18

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

## TWSE ETFortune active ETF discovery

Page: `https://wwwc.twse.com.tw/zh/ETFortune-institute/products`

URL: `https://wwwc.twse.com.tw/zh/ETFortune-institute/ajaxProducts`

Method: POST

Payload:

```txt
managerType=Active&sort=listingDate&orderBy=DESC
```

Status: verified primary source for listed Taiwan active ETF discovery. The endpoint was found from the official product screener form `data-productsurl="/zh/ETFortune-institute/ajaxProducts"` and `/rsrc/sites/etfortune-institute/js/products-filter.js`, which POSTs the serialized filter form.

Field mapping:

```txt
stockNo -> ETF code
stockName -> ETF display name
listingDate -> listing date
indexName -> underlying index
totalAv -> asset value
close1 -> closing price
valueYTD -> YTD average traded value
volumeYTD -> YTD average traded volume
holders -> beneficiary count
issuer -> issuer
```

The discovery job stores the complete raw JSON response in `raw_snapshots` with source `twse_etfortune`, then upserts `active_etf_discoveries`.

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

## 群益 holdings and summary

URL: `https://www.capitalfund.com.tw/CFWeb/api/etf/buyback`

Method: POST

Confirmed products:

- `00997A`: `fundId` `502`
- `00982A`: `fundId` `399`
- `00992A`: `fundId` `500`

Headers:

```txt
Accept: application/json
Content-Type: application/json
Referer: https://www.capitalfund.com.tw/etf/product/detail/399/buyback
User-Agent: browser user-agent
```

Payload:

```json
{
  "fundId": "399",
  "date": "2026/05/18"
}
```

Status: verified primary source for 群益 holdings and PCF summary. The request date is the buyback/announcement date; the holdings trade date must be read from `data.pcf.date2`. `00997A` can include foreign equity tickers in addition to Taiwan stock codes.

## 元大 holdings and summary

URL: `https://etfapi.yuantaetfs.com/ectranslation/api/bridge`

Method: GET

Confirmed products:

- `00990A`: `ticker` `00990A`

Required query parameters:

```txt
APIType=ETFAPI
CompanyName=YUANTAFUNDS
FuncId=PCF/Daily
AppName=ETF
Device=3
Platform=ETF
ticker=00990A
ndate=YYYYMMDD
```

Status: verified primary source for 元大 holdings and PCF summary. The endpoint returns complete `FundWeights.StockWeights` JSON; do not parse only the collapsed HTML rows.

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

## 台新 holdings and summary

URL pattern: `https://www.tsit.com.tw/ETF/Home/Pcf/{etfCode}?FundType=ALL&DataDate=YYYY-MM-DD`

Method: GET

Confirmed products:

- `00986A`
- `00987A`

Headers:

```txt
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
Referer: https://www.tsit.com.tw/ETF/Home/Pcf
User-Agent: browser user-agent
```

Status: verified official fallback source for 台新 holdings and PCF summary. The official PCF page renders complete server-side HTML; `/ETF/JS/Pcf.js` only navigates to the ETF/date URL and did not expose JSON/CSV/XLSX endpoints during capture.

Field mapping:

```txt
input#PUB_DATE or input#DATA_DATE -> tradeDate
PCF summary row "基金淨資產價值(元)" -> etf_daily_summary.fundSize
PCF summary row "每受益權單位淨資產價值(元)" -> etf_daily_summary.nav
PCF summary row "已發行受益權單位總數" -> etf_daily_summary.totalUnits
PCF summary row "與前日已發行單位差異數" -> etf_daily_summary.netCreationUnits
stock table "代號" -> etf_daily_holdings.stockId; TW tickers drop the " TT" suffix
stock table "名稱" -> etf_daily_holdings.stockName
stock table "股數" -> etf_daily_holdings.shares
stock table "持股權重" -> etf_daily_holdings.weight
stock table "股票合計" -> etf_daily_summary.stockRatio
```

## 國泰 holdings and summary

URL: `https://cwapi.cathaysite.com.tw/api/ETF/DownloadETFWeightExcel`

Method: GET

Confirmed products:

- `00400A`: `FundCode` `EA`

Required query parameters:

```txt
FundCode=EA
SearchDate=YYYY-MM-DD
```

Status: verified primary source for 國泰 00400A holdings and summary. `SearchDate=2026-05-15` returned an OOXML workbook with stock code, stock name, shares and holding weight. Requests for an unpublished current date can return a 200 response with an empty body, so the provider retries previous dates and stores the date detected from the workbook title row.

Fields mapping:

```txt
Workbook row "YYYY/MM/DD基金持股權重" -> etf_daily_holdings.tradeDate / etf_daily_summary.tradeDate
Summary "基金淨資產價值" -> etf_daily_summary.fundSize
Summary "基金在外流通單位數" -> etf_daily_summary.totalUnits
Summary "基金每單位淨值" -> etf_daily_summary.nav
Summary "現金" / fundSize * 100 -> etf_daily_summary.cashRatio
Summary "股票" / fundSize * 100 -> etf_daily_summary.stockRatio
Stock table "股票代號" -> etf_daily_holdings.stockId
Stock table "股票名稱" -> etf_daily_holdings.stockName
Stock table "股數" -> etf_daily_holdings.shares
Stock table "持股權重" -> etf_daily_holdings.weight
fundSize * weight / 100 -> etf_daily_holdings.marketValue
```

Notes:

- The verified endpoint parameter is `SearchDate`; generic `date`, `DataDate`, `TradeDate` and similar candidates returned no holdings.
- `GetIndexStockWeights?FundCode=EA` returns stock weights but not shares, so it is not used as the primary holdings source.
- Market closing price is filled by the shared TWSE closing price sync.

## 安聯 holdings and summary

Site page: `https://etf.allianzgi.com.tw/list-trade`

Anti-forgery URL: `https://etf.allianzgi.com.tw/webapi/api/AntiForgery/GetAntiForgeryToken`

Data URL: `https://etf.allianzgi.com.tw/webapi/api/Fund/GetFundTradeInfo`

Method: GET for anti-forgery token, POST for trade info.

Confirmed products:

- `00984A`: `FundNo` `E0001`
- `00993A`: `FundNo` `E0002`

Headers for trade info:

```txt
Accept: application/json
Content-Type: application/json
Referer: https://etf.allianzgi.com.tw/list-trade
X-XSRF-TOKEN: token from AntiForgery/GetAntiForgeryToken
Cookie: cookies from AntiForgery/GetAntiForgeryToken
User-Agent: browser user-agent
```

Payload:

```json
{
  "FundNo": "E0002",
  "Date": "2026-05-18T00:00:00.000Z"
}
```

Status: verified primary source for 安聯 holdings and PCF summary. `Date` is the PCF announcement date, while the actual holdings/NAV snapshot date is `Entries.CNavDt`.

Field mapping:

```txt
Entries.CNavDt -> etf_daily_holdings.tradeDate / etf_daily_summary.tradeDate
Entries.CAnceTotalAv -> etf_daily_summary.fundSize
Entries.CAnceTotalIssues -> etf_daily_summary.totalUnits
Entries.CAnceIssuesDiff -> etf_daily_summary.netCreationUnits
Entries.CAnceNav -> etf_daily_summary.nav
DynamicTableData[TableTitle contains 股票] title percentage -> etf_daily_summary.stockRatio
stock table "股票代號" -> etf_daily_holdings.stockId
stock table "股票名稱" -> etf_daily_holdings.stockName
stock table "股數" -> etf_daily_holdings.shares
stock table "權重(%)" -> etf_daily_holdings.weight
fundSize * weight / 100 -> etf_daily_holdings.marketValue
```

Notes:

- The official `GetFundOverview` endpoint maps `00984A -> E0001`, `00993A -> E0002`; it also currently returns `00402A -> E0003`, which should be reviewed by the discovery/onboarding flow before enabling.
- Market closing price is filled by the shared TWSE closing price sync.

## 復華 holdings and summary

Official product page: `https://www.fhtrust.com.tw/ETF/etf_detail/ETF23`

The official page loads `/js/etf_detail.js`, which calls shared API helpers from `/js/util_footer.js`. The verified API helpers map to:

```txt
getAssets -> GET /api/assets
getETFPcf -> GET /api/ETFPcf
```

Holdings URL:

```txt
https://www.fhtrust.com.tw/api/assets?fundID=ETF23&qDate=YYYY/MM/DD
```

PCF URL:

```txt
https://www.fhtrust.com.tw/api/ETFPcf?fundID=ETF23&pcfDate=YYYYMMDD
```

Confirmed product:

- `00991A`: `fundID` `ETF23`

Status: verified primary JSON source for 復華 00991A holdings and summary. `qDate=2026/05/15` returned a full `detail[]` list with 52 rows including 50 stock holdings and other asset rows. If a requested `qDate` is not published yet, `/api/assets` returns a 200 JSON shell with null `dDate` and null `detail`, so the provider retries previous dates.

Important date rule: `/api/assets` is the holdings snapshot date. `/api/ETFPcf` is the PCF announcement date and can be the next business day for the same asset snapshot. For example, assets `qDate=2026/05/15` match PCF `pcfDate=20260518`, whose NAV and total units mirror the 2026/05/15 assets row.

Field mapping:

```txt
assets.result[0].dDate -> etf_daily_holdings.tradeDate / etf_daily_summary.tradeDate
assets.result[0].pcf_FundNav -> etf_daily_summary.fundSize
assets.result[0].pcf_FundQissue -> etf_daily_summary.totalUnits
assets.result[0].pcf_Fundpnav -> etf_daily_summary.nav
assets.result[0].result item "股票" / fundSize * 100 -> etf_daily_summary.stockRatio
assets.result[0].result item "扣除應付買入證券款後現金餘額(NTD)" / fundSize * 100 -> etf_daily_summary.cashRatio
pcf.result[0].qDiff -> etf_daily_summary.netCreationUnits
detail[].stockid -> etf_daily_holdings.stockId
detail[].stockname -> etf_daily_holdings.stockName
detail[].qshare -> etf_daily_holdings.shares
detail[].prate_addaccint -> etf_daily_holdings.weight
detail[].mvalue -> etf_daily_holdings.marketValue
```

## 中信 holdings and summary

Auth URL: `https://www.ctbcinvestments.com.tw/API/home/AuthToken?token=www.ctbcinvestments.com`

Data URL: `https://www.ctbcinvestments.com.tw/API/etf/Buyback?token={authToken}`

Method: POST

Confirmed products:

- `00995A`: `FID` `E0036`
- `00983A`: `FID` `E0034`

Headers:

```txt
Accept: application/json
Content-Type: application/json; charset=utf-8
Origin: https://www.ctbcinvestments.com.tw
Referer: https://www.ctbcinvestments.com.tw/ETF/Buyback
User-Agent: browser user-agent
```

Payload:

```json
{
  "FID": "E0034",
  "StartDate": "2026-05-18"
}
```

Status: verified primary source for 中信 holdings and PCF summary. The official Vue SPA calls `home/AuthToken` with the public bootstrap token, then calls `etf/Buyback`. `ETFCNOList` maps ETF code to `FID`, including `00995A -> E0036` and `00983A -> E0034`.

Field mapping:

```txt
Data.Data[0].NAV_DATE or Data.Data[0].淨值日期 -> tradeDate
Data.Data[0].基金淨資產價值 -> etf_daily_summary.fundSize
Data.Data[0].每受益權單位淨資產價值 -> etf_daily_summary.nav
Data.Data[0].已發行受益權單位總數 -> etf_daily_summary.totalUnits
Data.Data[0].與前日已發行單位差異數 -> etf_daily_summary.netCreationUnits
Data.Detail[Code=STOCK].Sum -> etf_daily_summary.stockRatio
Data.Detail[Code=STOCK].Data[].code_ -> etf_daily_holdings.stockId
Data.Detail[Code=STOCK].Data[].name_ -> etf_daily_holdings.stockName
Data.Detail[Code=STOCK].Data[].qty_ -> etf_daily_holdings.shares
Data.Detail[Code=STOCK].Data[].weights_ -> etf_daily_holdings.weight
Data.Detail[Code=STOCK].Data[].amount_ -> etf_daily_holdings.marketValue
```

## 摩根 holdings and summary

Product page:
`https://am.jpmorgan.com/tw/zh/asset-management/twetf/products/jpmorgan-taiwan-taiwan-equity-high-income-active-etf-TW00000401A1`

Product page:
`https://am.jpmorgan.com/tw/zh/asset-management/twetf/products/jpmorgan-taiwan-us-tech-leaders-active-etf-TW00000989A5`

PCF XLSX URL:
`https://am.jpmorgan.com/content/dam/jpm-am-aem/asiapacific/tw/zh/regulatory/etf-supplement/jpm_apac_tw_etf_pcf_updates_00401A_TW00000401A1.xlsx`

PCF XLSX URL:
`https://am.jpmorgan.com/content/dam/jpm-am-aem/asiapacific/tw/zh/regulatory/etf-supplement/jpm_apac_tw_etf_pcf_updates_00989A_TW00000989A5.xlsx`

Method: GET

Confirmed products:

- `00989A`: ISIN `TW00000989A5`
- `00401A`: ISIN `TW00000401A1`

Headers:

```txt
Accept: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,*/*
Referer: https://am.jpmorgan.com/tw/zh/asset-management/twetf/products/jpmorgan-taiwan-taiwan-equity-high-income-active-etf-TW00000401A1
User-Agent: browser user-agent
Sec-Fetch-Dest: document
Sec-Fetch-Mode: navigate
Sec-Fetch-Site: same-origin
```

Status: verified official XLSX source for 摩根 holdings and PCF summary. The product page embeds this URL in its `documents` JSON payload as `ETF估值檔案 *`. Generic direct requests returned Akamai Access Denied during validation; the browser/Excel headers above returned the OOXML workbook.

Field mapping:

```txt
summary row "Valuation Date" -> etf_daily_summary.tradeDate
summary row "Estimated NAV per Share" -> etf_daily_summary.nav
summary row "Estimated NAV" -> etf_daily_summary.fundSize
summary row "Outstanding Shares" -> etf_daily_summary.totalUnits
component row "Constituent Type" == "Equity" -> included holding
component row "Constituent Ticker" -> etf_daily_holdings.stockId
component row "Constituent Description" -> etf_daily_holdings.stockName
component row "Shares or PAR Amount" -> etf_daily_holdings.shares
component row "Market Value Base" -> etf_daily_holdings.marketValue
component row "Market Value Base" / "Estimated NAV" * 100 -> etf_daily_holdings.weight
```

## 第一金 holdings and summary

Product page: `https://www.fsitc.com.tw/FundDetail.aspx?ID=182`

Confirmed product:

- `00994A`: `pStrFundID` `182`

Summary URL: `https://www.fsitc.com.tw/WebAPI.aspx/Get_BuySellA`

Holdings URL: `https://www.fsitc.com.tw/WebAPI.aspx/Get_hd`

Method: POST

Headers:

```txt
Accept: application/json, text/javascript, */*; q=0.01
Content-Type: application/json; charset=utf-8
X-Requested-With: XMLHttpRequest
Referer: https://www.fsitc.com.tw/FundDetail.aspx?ID=182
User-Agent: browser user-agent
```

Payload:

```json
{
  "pStrFundID": "182",
  "pStrDate": "2026-05-18"
}
```

Status: verified primary source for 第一金 holdings and PCF summary. The ASP.NET response has a `d` field containing a JSON string. `Get_hd` `group = "1"` rows are Taiwan stock holdings.

Field mapping:

```txt
Get_hd[].sdate -> detected holdings tradeDate
Get_hd[group=1].A -> etf_daily_holdings.stockId
Get_hd[group=1].B -> etf_daily_holdings.stockName
Get_hd[group=1].D -> etf_daily_holdings.shares
Get_hd[group=1].D / 1000 -> etf_daily_holdings.lots
Get_hd[group=1].C -> etf_daily_holdings.weight

Get_BuySellA[A contains 基金淨資產價值].B -> etf_daily_summary.fundSize
Get_BuySellA[A contains 每受益權單位淨資產價值].B -> etf_daily_summary.nav
Get_BuySellA[A contains 已發行受益權單位總數].B -> etf_daily_summary.totalUnits
Get_BuySellA[A contains 與前日已發行單位差異數].B -> etf_daily_summary.netCreationUnits
sum(Get_hd[group=1].C) -> etf_daily_summary.stockRatio
```

Need cookie: no observed cookie requirement for direct browser-header POST.

Need csrf token: no observed CSRF token.
