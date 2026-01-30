import { test as base } from '@playwright/test';
import { ApiHelper } from '../helpers/api.helper';
import * as fs from 'fs';
import * as path from 'path';

type TestFixtures = {
  api: ApiHelper;
  consoleErrors: string[];
  failedRequests: string[];
};

export const test = base.extend<TestFixtures>({
  api: async ({ request }, use) => {
    const api = new ApiHelper(request);
    await api.login();
    await use(api);
  },

  consoleErrors: async ({ page }, use, testInfo) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('requestfailed', (req) => {
      const url = req.url();
      // Ignore known optional requests (favicon, sourcemaps)
      if (url.includes('favicon') || url.includes('.map')) return;
      errors.push(`[REQ FAIL] ${req.method()} ${url}: ${req.failure()?.errorText}`);
    });

    await use(errors);

    // After each test: screenshot + log errors
    const screenshotDir = path.join('test-results', 'screenshots');
    fs.mkdirSync(screenshotDir, { recursive: true });
    const safeName = testInfo.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_').slice(0, 80);
    await page.screenshot({
      path: path.join(screenshotDir, `${safeName}.png`),
      fullPage: true,
    }).catch(() => {});

    if (errors.length > 0) {
      console.log(`[test-base] Console errors/failed requests for "${testInfo.title}":`);
      errors.forEach((e) => console.log(`  - ${e.slice(0, 200)}`));
    }
  },

  failedRequests: async ({}, use) => {
    // Alias — consoleErrors already captures request failures
    await use([]);
  },
});

export { expect } from '@playwright/test';
