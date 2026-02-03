import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  expect: { timeout: 10000 },
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 10000,
  },

  projects: [
    // 1. 登录 setup（保存 storageState 供 e2e 项目复用）
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    // 2. 需要认证的 UI 测试（排除 api-health，它有自己的认证方式）
    {
      name: 'e2e',
      dependencies: ['setup'],
      testIgnore: /api-health\.spec\.ts/,
      use: {
        storageState: './e2e/.auth/user.json',
      },
    },
    // 3. API 健康检查（不需要浏览器 storageState，自行获取 token）
    {
      name: 'api-health',
      testMatch: /api-health\.spec\.ts/,
    },
  ],
});
