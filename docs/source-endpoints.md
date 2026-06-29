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

## Global ETF Holdings Radar sources

The overseas product line uses `src/config/globalEtfs.ts` and must not reuse Taiwan ranking collections. Enabled sources:

- `DRAM` Roundhill Memory ETF
  - Landing page: `https://www.roundhillinvestments.com/etf/dram/`
  - Holdings CSV pattern: `https://www.roundhillinvestments.com/assets/data/filepointroundhill.40ru.ru_holdings_MMDDYYYY.csv`
  - The provider scans the latest 15 calendar days and filters `Account == "DRAM"`.
- `NASA` Tema Space Innovators ETF
  - Holdings CSV: `https://temaetfs.com/hubfs/Website/Holdings/NASA-holdings.csv`
  - `percent_of_nav` is a fraction and is multiplied by 100.
- `BAI` iShares A.I. Innovation and Tech Active ETF
  - Product page: `https://www.ishares.com/us/products/339081/ishares-a-i-innovation-and-tech-active-etf`
  - BlackRock fund download endpoint returns SpreadsheetML `.xls`, not `.xlsx`.
  - Parser sanitizes HTML fragments and bare ampersands, then reads worksheet `Holdings`.
- `EUV` Corgi Lithography & Semiconductor Photonics ETF
  - API: `https://cmltk98h4m.execute-api.us-east-2.amazonaws.com/api/v1/holdings?account=EUV&limit=1000`
  - Provider follows `pagination.has_more`, then filters rows to the newest `holding_date` only. Historical rows must not be aggregated with the latest day.

ARK, JPMorgan, Capital Group, Amplify, T. Rowe Price, Goldman Sachs, and PIMCO candidates remain `needs_endpoint_verification` until official holdings endpoint behavior, source date, and parser fixtures are captured.

## TWSE listed stock daily market data

URL: `https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX`

Method: GET

Query:

```txt
date=YYYYMMDD
type=ALLBUT0999
response=json
```

Status: verified official JSON source for listed stock daily quote and trading data. The parser selects the table whose fields include `證券代號` and `收盤價`.

Field mapping:

```txt
證券代號 -> stock_daily_market.stockId
證券名稱 -> stock_daily_market.stockName
成交股數 -> stock_daily_market.volumeShares
成交金額 -> stock_daily_market.turnover
成交筆數 -> stock_daily_market.transactionCount
開盤價 -> stock_daily_market.openPrice
最高價 -> stock_daily_market.highPrice
最低價 -> stock_daily_market.lowPrice
收盤價 -> stock_daily_market.closePrice
漲跌價差 -> stock_daily_market.change
```

Raw snapshots are stored with source `twse_market`.

## TWSE listed stock institutional flows

URL: `https://www.twse.com.tw/rwd/zh/fund/T86`

Method: GET

Query:

```txt
date=YYYYMMDD
selectType=ALLBUT0999
response=json
```

Status: verified official JSON source for listed stock 三大法人 flow.

Field mapping:

```txt
證券代號 -> stock_institutional_flows.stockId
證券名稱 -> stock_institutional_flows.stockName
外陸資買賣超股數(不含外資自營商) + 外資自營商買賣超股數 -> foreignNetShares
投信買賣超股數 -> investmentTrustNetShares
自營商買賣超股數 -> dealerNetShares
三大法人買賣超股數 -> totalNetShares
```

Raw snapshots are stored with source `twse_institutional`.

## KGI 00407A PCF

Page: `https://www.kgifund.com.tw/Fund/RedemptionList`

URL: `https://www.kgifund.com.tw/Fund/RedemptionVC`

Method: POST

Payload:

```txt
fundID=J024&queryDate=YYYY/MM/DD
```

Status: verified official source for `00407A 主動凱基台灣` holdings and PCF summary. The official redemption list page embeds the fund mapping `主動凱基台灣 -> J024` and loads this endpoint through `UpdateRedemption`.

Field mapping:

```txt
hidden DataDate -> PCF announcement date
dated NAV label -> holdings/NAV trade date
基金淨資產價值(元) -> fund size
已發行受益權單位總數 -> total units
與前日已發行單位差異數 -> net creation units
每受益權單位淨資產價值(元) -> NAV
股票代號 -> stock ID
股票名稱 -> stock name
股數 -> shares
權重(%) -> weight
```

Raw snapshots are stored with source `kgi`.

## TPEx OTC stock daily market data

URL: `https://www.tpex.org.tw/www/zh-tw/afterTrading/otc`

Method: GET

Query:

```txt
date=YYYY/MM/DD
type=EW
response=json
```

Status: verified official JSON source for OTC stock daily quote and trading data.

Field mapping:

```txt
代號 -> stock_daily_market.stockId
名稱 -> stock_daily_market.stockName
成交股數 -> stock_daily_market.volumeShares
成交金額(元) -> stock_daily_market.turnover
成交筆數 -> stock_daily_market.transactionCount
開盤 -> stock_daily_market.openPrice
最高 -> stock_daily_market.highPrice
最低 -> stock_daily_market.lowPrice
收盤 -> stock_daily_market.closePrice
漲跌 -> stock_daily_market.change
```

Raw snapshots are stored with source `tpex_market`.

## TPEx OTC stock institutional flows

URL: `https://www.tpex.org.tw/www/zh-tw/insti/dailyTrade`

Method: GET

Query:

```txt
date=YYYY/MM/DD
type=Daily
response=json
```

Status: verified official JSON source for OTC 三大法人 flow. The JSON field labels repeat across grouped columns; mapping follows the official grouped order:

```txt
columns 8-10 -> 外資及陸資合計買進/賣出/買賣超
columns 11-13 -> 投信買進/賣出/買賣超
columns 20-22 -> 自營商合計買進/賣出/買賣超
column 23 -> 三大法人買賣超股數合計
```

Raw snapshots are stored with source `tpex_institutional`.

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
- `00402A`: `FundNo` `E0003`

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

Status: verified primary source for 安聯 holdings and PCF summary. `Date` is the PCF announcement date, while the actual holdings/NAV snapshot date is `Entries.CNavDt`. `00402A` live smoke on 2026-06-24 returned `CNavDt=2026-06-22` with 51 stock rows.

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

- The official `GetFundOverview` endpoint maps `00984A -> E0001`, `00993A -> E0002`, and `00402A -> E0003`.
- Market closing price is filled by the shared TWSE closing price sync.

## 兆豐 holdings and summary

Official product page: `https://www.megafunds.com.tw/MEGA/etf/etf_product.aspx?id=23`

Official PCF page: `https://www.megafunds.com.tw/MEGA/etf/trade_pcf.aspx`

Confirmed product:

- `00996A`: `id=23`, PCF `fund_id=23`

Status: verified official HTML fallback source for 兆豐 `00996A`. The public product page renders the current holdings, NAV, AUM, total units and stock allocation percentage server-side. The official JavaScript only controls UI tab behavior and did not expose a JSON/XHR holdings API. The PCF page is an ASP.NET Web Forms page; posting its hidden fields with `category_id=16` and `fund_id=23` returns the 00996A PCF summary, but the complete stock table is linked back to the product page.

Field mapping:

```txt
產品頁 "資料來源：兆豐投信，YYYY/MM/DD" -> tradeDate
"淨資產價值" -> etf_daily_summary.fundSize
"在外流通單位數" -> etf_daily_summary.totalUnits
"每單位淨值" -> etf_daily_summary.nav
"股票 ( N% )" -> etf_daily_summary.stockRatio
基金配置 / 股票 table "股票代號" -> etf_daily_holdings.stockId
基金配置 / 股票 table "股票名稱" -> etf_daily_holdings.stockName
基金配置 / 股票 table "股數" -> etf_daily_holdings.shares
基金配置 / 股票 table "持股權重" -> etf_daily_holdings.weight
fundSize * weight / 100 -> etf_daily_holdings.marketValue
```

Notes:

- The Mega product page is current-snapshot only; historical backfill for `00996A` is limited unless a separate official historical holdings file is found later.
- Market closing price is filled by the shared TWSE closing price sync.

## 富邦 holdings and summary

Official assets pages:

- `00405A`: `https://websys.fsit.com.tw/FubonETF/Fund/Assets.aspx?stkId=00405A`
- `00982D`: `https://websys.fsit.com.tw/FubonETF/Fund/Assets.aspx?stkId=00982D`
- `00983D`: `https://websys.fsit.com.tw/FubonETF/Fund/Assets.aspx?stkId=00983D`

Status: verified official HTML fallback source for 富邦 `00405A`, `00982D` and `00983D`. `00405A` is enabled for production sync; `00982D` and `00983D` stay disabled for current equity-only production sync. The public assets page renders the current snapshot server-side, including data date, NAV, fund size, total units, holdings, market value and weights.

Field mapping:

```txt
"資料日期：YYYY/MM/DD" -> tradeDate
"基金淨資產(新台幣)" -> etf_daily_summary.fundSize
"基金在外流通單位數(單位)" -> etf_daily_summary.totalUnits
"基金每單位淨值(新台幣)" -> etf_daily_summary.nav
股票 table "股票代碼" -> etf_daily_holdings.stockId
股票 table "股票名稱" -> etf_daily_holdings.stockName
股票 table "股數" -> etf_daily_holdings.shares
債券 table "債券代碼" -> etf_daily_holdings.stockId
債券 table "債券名稱" -> etf_daily_holdings.stockName
債券 table "面額" -> etf_daily_holdings.shares
基金 table "基金代碼" -> etf_daily_holdings.stockId
基金 table "基金名稱" -> etf_daily_holdings.stockName
基金 table "單位數" -> etf_daily_holdings.shares
table "金額" -> etf_daily_holdings.marketValue
table "權重(%)" -> etf_daily_holdings.weight
```

Notes:

- `lots` remains `shares / 1000` only for shared-schema compatibility; for bond ETFs this is not a Taiwan board-lot measure.
- Market closing price is filled by the shared TWSE closing price sync.

## 聯博 holdings and summary

Official PCF page pattern: `https://www.abfunds.com.tw/zh-tw/etfs/pcf.{shareClassId}.html`

API endpoints:

- Holdings: `https://webapi.alliancebernstein.com/v2/funds/tw/zh-tw/investor/{shareClassId}/holdings`
- Basket: `https://webapi.alliancebernstein.com/v2/funds/tw/zh-tw/investor/{shareClassId}/basket`

Confirmed share classes:

- `00404A`: `TW00000404A5`
- `00984D`: `TW00000984D0`

Status: verified primary JSON source for 聯博 `00404A` and `00984D`. `00404A` is enabled for production sync; `00984D` stays disabled for current equity-only production sync. The official React PCF page sets `shareClassId` and calls the two endpoints above. The provider stores a combined raw JSON payload containing both responses, so holdings and PCF summary share one raw snapshot.

Field mapping:

```txt
basket.asOfDate -> tradeDate
basket.nav -> etf_daily_summary.nav
basket.aum -> etf_daily_summary.fundSize
basket.shares -> etf_daily_summary.totalUnits
basket.sharesChange -> etf_daily_summary.netCreationUnits
holdings.domesticHoldings[].holdings[].holdingCode -> etf_daily_holdings.stockId
holdings.domesticHoldings[].holdings[].holding -> etf_daily_holdings.stockName
holdings.domesticHoldings[].holdings[].holdingShares -> etf_daily_holdings.shares
holdings.domesticHoldings[].holdings[].holdingValue -> etf_daily_holdings.marketValue
holdings.domesticHoldings[].holdings[].holdingPerc -> etf_daily_holdings.weight
```

Notes:

- Futures rows can have an empty `holdingCode`; the provider assigns a deterministic category row id for shared-schema uniqueness.
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
- `00406A`: `FID` `E0038`

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

Status: verified primary source for 中信 holdings and PCF summary. The official Vue SPA calls `home/AuthToken` with the public bootstrap token, then calls `etf/Buyback`. `ETFCNOList` maps ETF code to `FID`, including `00995A -> E0036`, `00983A -> E0034` and `00406A -> E0038`.

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
