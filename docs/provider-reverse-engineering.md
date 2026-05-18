# Provider Reverse Engineering Notes

This project does not guess provider APIs. A provider can be enabled for production sync only after its holdings and summary endpoints are verified from real JSON/XHR/CSV/XLSX traffic or a stable official downloadable file.

## Status

| Provider | ETF codes | Status | Source notes |
| --- | --- | --- | --- |
| 統一投信 `uniPresident` | `00981A`, `00403A`, `00988A` | Verified | Official Ezmoney `GetPCF` JSON endpoint. `00988A` is already supported from the previous build and remains enabled to avoid removing existing functionality. |
| 野村投信 `nomura` | `00980A`, `00985A`, `00999A` | Verified and enabled | Official ETFWEB Angular app calls `Fund/GetFundAssets`; holdings, NAV, AUM, total units and allocation rows were verified for all three ETFs. Production daily refresh is enabled. |
| 群益投信 `capital` | `00982A`, `00992A` | Verified and enabled | Official CFWeb Angular app calls `/api/etf/buyback`; holdings, NAV, AUM, total units, creation units and allocation rows were verified for both ETFs. Production daily refresh is enabled. |
| 國泰投信 `cathay` | `00400A` | Verified and enabled | Official Cathay `DownloadETFWeightExcel` XLSX endpoint uses `FundCode=EA&SearchDate=YYYY-MM-DD`; holdings, NAV, AUM, total units, stock value and cash value were verified. Production daily refresh is enabled. |
| 摩根投信 `jpmorgan` | `00401A` | Verified and enabled | Official product page exposes the ETF supplement PCF XLSX file. The file is fetched with browser Excel headers and parsed as OOXML; production daily refresh is enabled. |
| 中信投信 `ctbc` | `00983A` | Verified and enabled | Official CTBC Vue app calls `home/AuthToken` then `etf/Buyback`; holdings, NAV, AUM, total units, creation unit delta and allocation rows were verified. Production daily refresh is enabled. |
| 台新投信 `taishin` | `00986A`, `00987A` | Verified and enabled | Official `ETF/Home/Pcf/{code}` page renders complete server-side PCF HTML. No JSON/XLSX endpoint was found in the official JS, so this provider uses the HTML parser fallback with table-header validation. Production daily refresh is enabled. |
| 元大投信 `yuanta` | `00990A` | Verified and enabled | Official Yuanta Nuxt app calls `ETFAPI` `PCF/Daily` through the `etfapi.yuantaetfs.com` bridge; complete stock weights and PCF summary were verified. Production daily refresh is enabled. |
| 復華投信 `fh` | `00991A` | Pending | Do not enable until official holdings and summary endpoints are captured. |
| 第一金投信 `first` | `00994A` | Verified and enabled | Official FundDetail page calls ASP.NET WebAPI endpoints `Get_hd` and `Get_BuySellA`; holdings, NAV, AUM, total units and allocation rows were verified. Production daily refresh is enabled. |
| Allianz `allianz` | none | Out of first-stage scope | Folder exists only because the architecture prompt included it. |

## Verified Endpoints

### Uni-President Ezmoney PCF

- Method: `POST`
- URL: `https://www.ezmoney.com.tw/ETF/Transaction/GetPCF`
- Body: `{ "fundCode": "...", "date": "115/05/18", "specificDate": true }`
- Confirmed fund codes:
  - `00981A`: `49YTW`
  - `00403A`: `63YTW`
  - `00988A`: `61YTW`
- Response type: JSON
- Contains:
  - `pcf` rows for NAV, total units, fund size, creation unit deltas
  - `asset` rows with stock details

### TWSE Closing Price

- Method: `GET`
- URL: `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=YYYYMM01&stockNo=ETF_CODE`
- Response type: JSON
- Used only for market closing price and premium/discount calculation.

### Nomura ETFWEB Fund Assets

- Product page: `https://www.nomurafunds.com.tw/ETFWEB/product-description?fundNo=00980A`
- Angular API base discovered from the official bundle: `/API/ETFAPI/api/`
- Method: `POST`
- URL: `https://www.nomurafunds.com.tw/API/ETFAPI/api/Fund/GetFundAssets`
- Body for latest available data: `{ "FundID": "00980A", "SearchDate": null }`
- Body for a specified date: `{ "FundID": "00980A", "SearchDate": "2026-05-14T00:00:00.000Z" }`
- Confirmed ETF codes:
  - `00980A`: latest response date `2026/05/15`, 48 stock rows
  - `00985A`: latest response date `2026/05/15`, 50 stock rows
  - `00999A`: latest response date `2026/05/15`, 61 stock rows
- Response type: JSON
- Contains:
  - `Entries.Data.FundAsset` for AUM, total units, NAV and NAV date
  - `Entries.Data.Table[]` with `股票` holdings rows: stock code, stock name, shares and weight
  - allocation rows for stocks, futures, cash and receivables
- Limitation: this endpoint does not provide market closing price. Premium/discount is calculated by the shared TWSE closing price sync after Nomura holdings/NAV sync.

### Capital CFWeb ETF Buyback

- Product page: `https://www.capitalfund.com.tw/etf/product/detail/399/buyback`
- API base discovered from the official app config: `https://www.capitalfund.com.tw/CFWeb`
- Angular API call discovered from the official bundle: `POST /api/etf/buyback`
- Method: `POST`
- URL: `https://www.capitalfund.com.tw/CFWeb/api/etf/buyback`
- Body: `{ "fundId": "399", "date": "2026/05/18" }`
- Confirmed fund IDs:
  - `00982A`: `399`, latest `pcf.date2` verified as `2026-05-15`, 57 stock rows
  - `00992A`: `500`, latest `pcf.date2` verified as `2026-05-15`, 46 stock rows
- Response type: JSON
- Contains:
  - `data.pcf` for NAV, AUM, total units, creation unit deltas, stock ratio and snapshot date
  - `data.stocks[]` for stock code, stock name, shares and weight
  - `data.assets[]` for cash and other allocation rows
- Important date rule: request `date` is the buyback/announcement date, while the actual holdings snapshot date is `data.pcf.date2`. Historical sync queries the next business day and validates `pcf.date2` before saving.
- Limitation: this endpoint does not provide market closing price. Premium/discount is calculated by the shared TWSE closing price sync after Capital holdings/NAV sync.

### Yuanta ETFAPI PCF/Daily

- Product page: `https://www.yuantaetfs.com/tradeInfo/pcf/00990A`
- Nuxt API call discovered from the official bundle: `$getAPI("ETFAPI", "PCF/Daily", ..., "/api/bridge")`
- Method: `GET`
- URL: `https://etfapi.yuantaetfs.com/ectranslation/api/bridge`
- Required query parameters include:
  - `APIType=ETFAPI`
  - `CompanyName=YUANTAFUNDS`
  - `FuncId=PCF/Daily`
  - `AppName=ETF`
  - `Device=3`
  - `Platform=ETF`
  - `ticker=00990A`
  - `ndate=YYYYMMDD` for historical date queries
- Confirmed ETF codes:
  - `00990A`: latest and historical responses returned complete `FundWeights.StockWeights` rows, including 53 stock rows for `2026-05-15`
- Response type: JSON
- Contains:
  - `PCF` for NAV, AUM, total units, unit delta and trade/announcement dates
  - `FundWeights.StockWeights[]` for stock code, stock name, shares and weights
  - `Cash.CashPosition[]` for cash and other allocation rows
- Limitation: this endpoint does not provide market closing price. Premium/discount is calculated by the shared TWSE closing price sync after Yuanta holdings/NAV sync.

### Taishin ETF/Home/Pcf

- PCF page: `https://www.tsit.com.tw/ETF/Home/Pcf/00986A`
- Official JS reviewed: `/ETF/JS/Pcf.js`
- Method: `GET`
- URL pattern: `https://www.tsit.com.tw/ETF/Home/Pcf/{etfCode}?FundType=ALL&DataDate=YYYY-MM-DD`
- Confirmed ETF codes:
  - `00986A`: `2026-05-18` response rendered complete stock table and PCF summary.
  - `00987A`: `2026-05-18` response rendered complete stock table and PCF summary.
- Response type: server-rendered HTML
- Contains:
  - hidden `PUB_DATE`/`DATA_DATE` fields for snapshot date
  - PCF summary table for NAV, fund size, total units and unit delta
  - stock table with code, name, shares and weight
- Important source note: the official PCF page and its `Pcf.js` only perform page navigation for date/ETF changes; no JSON, CSV or XLSX endpoint was present in the captured code. The implementation therefore uses the allowed HTML fallback and validates the table headers before parsing.
- Limitation: this source does not provide market closing price. Premium/discount is calculated by the shared TWSE closing price sync after Taishin holdings/NAV sync.

### JPMorgan ETF Supplement PCF XLSX

- Product page: `https://am.jpmorgan.com/tw/zh/asset-management/twetf/products/jpmorgan-taiwan-taiwan-equity-high-income-active-etf-TW00000401A1`
- Official document source: the product page embeds the `documents` payload for ISIN `TW00000401A1`.
- Method: `GET`
- URL: `https://am.jpmorgan.com/content/dam/jpm-am-aem/asiapacific/tw/zh/regulatory/etf-supplement/jpm_apac_tw_etf_pcf_updates_00401A_TW00000401A1.xlsx`
- Required request note: direct generic requests can be rejected by Akamai. The verified fetch uses a normal browser user-agent, the product page as `Referer`, and Excel `Accept` headers.
- Confirmed ETF codes:
  - `00401A`: XLSX valuation date `2026-05-18`, 73 components, 62 Taiwan equity rows.
- Response type: XLSX / OOXML
- Contains:
  - summary row with fund ticker, fund name, valuation date, component count, estimated NAV, estimated NAV per share and outstanding shares
  - component rows with ISIN, ticker, type, description, shares, prices and market value
- Field mapping:
  - `Valuation Date` -> trade date
  - `Estimated NAV per Share` -> NAV
  - `Estimated NAV` -> fund size
  - `Outstanding Shares` -> total units
  - `Constituent Type = Equity` and four-digit `Constituent Ticker` -> Taiwan stock holdings
  - `Shares or PAR Amount` -> shares
  - `Market Value Base / Estimated NAV * 100` -> weight
- Limitation: this official PCF file uses English constituent descriptions and does not include creation unit delta or market closing price. Premium/discount is calculated by the shared TWSE closing price sync after JPMorgan NAV sync.

### Cathay ETF Weight XLSX

- Product page: `https://www.cathaysite.com.tw/ETF/purchase?code=EA`
- Official API base discovered from the Cathay Angular bundle: `https://cwapi.cathaysite.com.tw/`
- Method: `GET`
- URL: `https://cwapi.cathaysite.com.tw/api/ETF/DownloadETFWeightExcel?FundCode=EA&SearchDate=YYYY-MM-DD`
- Confirmed ETF codes:
  - `00400A`: fund code `EA`; `SearchDate=2026-05-15` returned a valid XLSX, 51 stock rows and trade date `2026-05-15`.
- Response type: XLSX / OOXML
- Contains:
  - summary rows for fund size, total units, NAV, cash value and stock value
  - stock rows with stock code, stock name, shares and weight
- Field mapping:
  - workbook title row `YYYY/MM/DD基金持股權重` -> trade date
  - `基金淨資產價值` -> fund size
  - `基金在外流通單位數` -> total units
  - `基金每單位淨值` -> NAV
  - `現金` and `股票` rows -> cash/stock ratios
  - stock table `股票代號` / `股票名稱` / `股數` / `持股權重` -> normalized holdings
- Important date rule: current calendar date can return an empty workbook before Cathay publishes data. The implementation retries prior dates and saves the trade date detected inside the XLSX.
- Limitation: this endpoint does not provide market closing price or creation unit delta. Premium/discount is calculated by the shared TWSE closing price sync after Cathay NAV sync.

### First Securities Investment Trust FundDetail WebAPI

- Product page: `https://www.fsitc.com.tw/FundDetail.aspx?ID=182`
- Official page JavaScript reviewed: the `申購買回清單` tab calls `WebAPI.aspx/Get_BuySellA` for summary rows and `WebAPI.aspx/Get_hd` for holding/allocation rows.
- Method: `POST`
- URLs:
  - `https://www.fsitc.com.tw/WebAPI.aspx/Get_BuySellA`
  - `https://www.fsitc.com.tw/WebAPI.aspx/Get_hd`
- Body: `{ "pStrFundID": "182", "pStrDate": "YYYY-MM-DD" }`
- Confirmed ETF codes:
  - `00994A`: official page maps it to fund ID `182`; latest run returned holdings trade date `2026-05-15` and 41 stock rows.
- Response type: ASP.NET JSON envelope, where `d` is a JSON string.
- Contains:
  - `Get_BuySellA` rows for fund size, NAV, total units, unit delta and creation/redemption summary
  - `Get_hd` rows grouped by asset type; `group = "1"` contains stock code, name, weight and shares
- Important date rule: the request date is the announcement/search date. For PCF-style current data, `Get_hd` can return the prior business day's holdings snapshot, so the implementation detects the saved trade date from the holdings `sdate`.
- Limitation: this endpoint does not provide market closing price. Premium/discount is calculated by the shared TWSE closing price sync after First NAV sync.

### CTBC ETF Buyback

- ETF page: `https://www.ctbcinvestments.com.tw/ETF/00983A/Info`
- Buyback page: `https://www.ctbcinvestments.com.tw/ETF/Buyback`
- Vue app chunks reviewed: root bundle plus `assets/Buyback-*.js`
- Auth method: `POST https://www.ctbcinvestments.com.tw/API/home/AuthToken?token=www.ctbcinvestments.com`
- Data method: `POST https://www.ctbcinvestments.com.tw/API/etf/Buyback?token={authToken}`
- Body: `{ "FID": "E0034", "StartDate": "YYYY-MM-DD" }`
- Confirmed ETF codes:
  - `00983A`: official ETF list maps it to `FID=E0034`, `FID_SNAME=主動中信ARK創新`; buyback response returned complete stock rows.
- Response type: JSON
- Contains:
  - `Data.Data[0]` for NAV, AUM, total units, unit delta and NAV date
  - `Data.Detail[Code=STOCK].Data[]` for stock code, stock name, shares, market amount and weights
  - `Data.Detail` cash/other allocation rows
- Important date rule: the request date is the announcement/search date, while the holdings snapshot date is `NAV_DATE`/`淨值日期`. Historical sync searches forward and validates the returned NAV date before saving.
- Limitation: this endpoint does not provide market closing price. Premium/discount is calculated by the shared TWSE closing price sync after CTBC holdings/NAV sync.

## Provider Enablement Checklist

1. Capture the real provider endpoint from browser Network/XHR or official downloadable file.
2. Save a sample raw response under `tests/fixtures/<provider>/`.
3. Implement `parser.ts` with no hard-coded DOM selector dependency unless HTML is the only source.
4. Implement `normalizer.ts` to output `NormalizedHolding` and `NormalizedSummary`.
5. Add parser and normalization tests.
6. Add the ETF to production sync only after tests pass and raw snapshot saving works.
7. Keep failures isolated to that provider; never let one provider block `daily-refresh` for all providers.
