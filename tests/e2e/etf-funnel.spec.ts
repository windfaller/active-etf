import { expect, test, type Page } from 'playwright/test';
import { mockP1Apis } from './p1-fixtures.js';

const research = '/compare/etfs?type=tw&codes=00981A,00982A';
async function events(page: Page, event: string) {
  return page.evaluate(name => ((window as any).dataLayer ?? []).map((entry: any) => Array.from(entry)).filter((entry: any) => entry[0] === 'event' && entry[1] === name).map((entry: any) => entry[2]), event);
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('active_etf_tracking_consent_v1', 'denied'));
  await page.route(/googletagmanager|google-analytics|connect.facebook.net|facebook.com\/tr/u, route => route.fulfill({ status: 200, body: '' }));
  await mockP1Apis(page, false);
});
for (const width of [1365, 390, 360]) {
  test(`preset result and result jump appear above bottom navigation at ${width}x844`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(research);
    const summary = page.getByTestId('comparison-summary');
    await expect(summary).toContainText('00981A'); await expect(summary).toContainText('00982A');
    await expect(summary).toContainText('2026-07-21'); await expect(summary).toContainText('30 檔'); await expect(summary).toContainText('44.00%');
    expect(await page.locator('.builder-disclosure').getAttribute('open')).toBeNull();
    const jump = await page.getByRole('link', { name: '查看比較結果 ↓' }).boundingBox();
    const nav = await page.locator('.mobile-primary-nav').boundingBox();
    expect(jump!.y + jump!.height).toBeLessThan(nav?.y ?? 844);
    const signup = await page.locator('.comparison-unlock button').first().boundingBox();
    expect(signup!.y + signup!.height).toBeLessThan(nav?.y ?? 844);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.builder-disclosure>summary').click(); await expect(page.locator('.compare-builder')).toBeVisible();
    await page.locator('.builder-disclosure>summary').click();
    await page.getByRole('link', { name: '查看比較結果 ↓' }).click();
    await expect(page.getByRole('button', { name: '持股', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
test('direct URL starts/completes one request; metric changes and reload do not create a new comparison', async ({ page }) => {
  await page.goto(research); await expect(page.getByTestId('comparison-summary')).toBeVisible();
  const started = await events(page, 'active_etf_compare_started'); const completed = await events(page, 'active_etf_compare_complete');
  expect(started).toHaveLength(1); expect(completed).toHaveLength(1);
  expect(started[0].compare_id).toBe(completed[0].compare_id); expect(started[0].interaction_source).toBe('direct_url');
  await page.getByRole('button', { name: '持股', exact: true }).click();
  expect(await events(page, 'active_etf_compare_complete')).toHaveLength(1);
  await page.reload(); await expect(page.getByTestId('comparison-summary')).toBeVisible();
  expect(await events(page, 'active_etf_compare_started')).toHaveLength(0); expect(await events(page, 'active_etf_compare_complete')).toHaveLength(0);
  await page.locator('.builder-disclosure>summary').click();
  await page.getByRole('button', { name: '比較 ETF', exact: true }).click();
  await expect.poll(async () => (await events(page, 'active_etf_compare_complete')).length).toBe(1);
  const again = (await events(page, 'active_etf_compare_started'))[0];
  expect(again.compare_id).not.toBe(started[0].compare_id);
  expect((await events(page, 'active_etf_compare_complete'))[0].compare_id).toBe(again.compare_id);
});
test('failed comparison reports an error and never completes', async ({ page }) => {
  await page.route('**/api/compare/etfs**', route => route.fulfill({ status: 503, json: { error: 'QA source unavailable' } }));
  await page.goto(research); await expect(page.locator('.compare-error')).toBeVisible();
  await expect(page.getByTestId('comparison-summary')).toHaveCount(0);
  expect(await events(page, 'active_etf_compare_started')).toHaveLength(1); expect(await events(page, 'active_etf_compare_complete')).toHaveLength(0);
});
test('landing preview is separate from the requested comparison and CTA retains the request ID', async ({ page }) => {
  await page.route('**/api/etfs/coverage**', route => route.fulfill({ json: { etfs: [], trackedCount: 28, availableCount: 24 } }));
  await page.goto('/start');
  await expect.poll(async () => (await events(page, 'active_etf_preview_loaded')).length).toBe(1);
  expect(await events(page, 'active_etf_compare_complete')).toHaveLength(0);
  expect(await events(page, 'active_etf_compare_started')).toHaveLength(0);
  await page.getByRole('button', { name: '立即比較 ETF', exact: true }).click();
  await expect(page.getByTestId('comparison-summary')).toBeVisible();
  const start = (await events(page, 'active_etf_compare_started'))[0];
  const complete = (await events(page, 'active_etf_compare_complete'))[0];
  expect(start.interaction_source).toBe('start_primary'); expect(complete.compare_id).toBe(start.compare_id);
});
test('missing holdings are identified as insufficient data and do not complete', async ({ page }) => {
  await page.route('**/api/compare/etfs**', route => route.fulfill({ json: {
    type: 'tw', generatedAt: '2026-10-01T00:00:00Z', sourceAsOf: null,
    coverage: { tracked: 2, available: 0, delayed: 2 }, confidence: { level: 'low', reason: 'QA missing source' },
    cards: ['00981A', '00982A'].map(code => ({ code, name: 'QA source missing', issuer: 'QA', sourceAsOf: null, holdingCount: 0, fundSize: null, hhi: null, top10Concentration: null, topHoldings: [], sectorExposure: [] })),
    pairwise: [], methodology: { setOverlap: 'QA', weightedOverlap: 'QA', commonDateOnly: true, missingWeight: '缺漏不代表零', exposureIdentity: 'QA' }
  } }));
  await page.goto(research);
  await expect(page.getByTestId('comparison-summary')).toContainText('資料不足或日期不同');
  await expect(page.locator('.summary-pairs')).toHaveCount(0);
  expect(await events(page, 'active_etf_compare_complete')).toHaveLength(0);
});
test('signup preserves holdings intent, goes directly to register, and denied tracking stays denied', async ({ page }) => {
  let body: any;
  await page.route('**/api/auth/start', route => {
    body = route.request().postDataJSON();
    return route.fulfill({ json: { authUrl: 'https://auth-app.gogowinners.me/register?returnMode=post&authFlow=10000000-0000-4000-8000-000000000001' } });
  });
  await page.route('https://auth-app.gogowinners.me/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>QA register destination</h1>' }));
  await page.goto(`${research}&utm_source=qa`); await expect(page.getByTestId('comparison-summary')).toBeVisible();
  await page.locator('.comparison-unlock button').first().click();
  await expect(page).toHaveURL(/auth-app.gogowinners.me\/register/u);
  expect(body.intent).toBe('sign_up'); expect(body.trackingAllowed).toBe(false);
  const returned = new URL(body.returnUrl);
  expect(returned.searchParams.get('metric')).toBe('holdings'); expect(returned.searchParams.get('codes')).toBe('00981A,00982A');
  expect(returned.searchParams.has('utm_source')).toBe(false);
});
