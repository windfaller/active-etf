# Provider Reverse Engineering Notes

This project does not guess provider APIs. A provider can be enabled for production sync only after its holdings and summary endpoints are verified from real JSON/XHR/CSV/XLSX traffic or a stable official downloadable file.

## Status

| Provider | ETF codes | Status | Source notes |
| --- | --- | --- | --- |
| 統一投信 `uniPresident` | `00981A`, `00403A`, `00988A` | Verified | Official Ezmoney `GetPCF` JSON endpoint. `00988A` is already supported from the previous build and remains enabled to avoid removing existing functionality. |
| 野村投信 `nomura` | `00980A`, `00985A`, `00999A` | Verified provider, sync pending | Official ETFWEB Angular app calls `Fund/GetFundAssets`; holdings, NAV, AUM, total units and allocation rows were verified for all three ETFs. Production sync is not enabled yet. |
| 群益投信 `capital` | `00982A`, `00992A` | Pending | Do not enable until official holdings and summary endpoints are captured. |
| 國泰投信 `cathay` | `00400A` | Pending | Do not enable until official holdings and summary endpoints are captured. |
| 摩根投信 `jpmorgan` | `00401A` | Pending | The user prompt listed `allianz` in the folder plan, but the first-stage ETF is 摩根; implementation uses `jpmorgan`. |
| 中信投信 `ctbc` | `00983A` | Pending | Do not enable until official holdings and summary endpoints are captured. |
| 台新投信 `taishin` | `00986A`, `00987A` | Pending | Do not enable until official holdings and summary endpoints are captured. |
| 元大投信 `yuanta` | `00990A` | Pending | Do not enable until official holdings and summary endpoints are captured. |
| 復華投信 `fh` | `00991A` | Pending | Do not enable until official holdings and summary endpoints are captured. |
| 第一金投信 `first` | `00994A` | Pending | Do not enable until official holdings and summary endpoints are captured. |
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
- Limitation: this endpoint does not provide market closing price. Premium/discount should continue to be calculated with TWSE closing price sync after Nomura production sync is wired.

## Provider Enablement Checklist

1. Capture the real provider endpoint from browser Network/XHR or official downloadable file.
2. Save a sample raw response under `tests/fixtures/<provider>/`.
3. Implement `parser.ts` with no hard-coded DOM selector dependency unless HTML is the only source.
4. Implement `normalizer.ts` to output `NormalizedHolding` and `NormalizedSummary`.
5. Add parser and normalization tests.
6. Add the ETF to production sync only after tests pass and raw snapshot saving works.
7. Keep failures isolated to that provider; never let one provider block `daily-refresh` for all providers.
