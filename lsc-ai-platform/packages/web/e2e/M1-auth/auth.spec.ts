/**
 * M1: 登录鉴权 (8 tests)
 * 依赖: 无（纯前端 + API）
 */
import { test, expect } from '@playwright/test';
import { SEL } from '../helpers/selectors';

const BASE = 'http://localhost:5173';

// M1-01: 未登录访问 /chat → 跳转到 /login
test('M1-01 未登录访问 /chat 跳转到 /login', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/chat`);
  // Wait for React to mount and PrivateRoute to redirect
  await page.waitForURL('**/login**', { timeout: 15000 });
  expect(page.url()).toContain('/login');
  await ctx.close();
});

// M1-02: 未登录访问 /settings → 跳转到 /login
test('M1-02 未登录访问 /settings 跳转到 /login', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/settings`);
  await page.waitForURL('**/login**', { timeout: 15000 });
  expect(page.url()).toContain('/login');
  await ctx.close();
});

// M1-03: 登录页渲染完整性
test('M1-03 登录页渲染完整性', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');

  // 用户名输入框
  const username = page.locator(SEL.login.usernameInput);
  await expect(username).toBeVisible();

  // 密码输入框 — type=password
  const password = page.locator(SEL.login.passwordInput);
  await expect(password).toBeVisible();
  await expect(password).toHaveAttribute('type', 'password');

  // 登录按钮
  const submit = page.locator(SEL.login.submitButton);
  await expect(submit).toBeVisible();
  await expect(submit).toHaveText(/登\s*录/);

  // 无 JS 错误
  expect(errors).toHaveLength(0);
  await ctx.close();
});

// M1-04: 空表单提交 → 表单验证提示
test('M1-04 空表单提交显示验证提示', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');

  await page.click(SEL.login.submitButton);
  await page.waitForTimeout(500);

  // Ant Design form validation shows .ant-form-item-explain-error
  const validationErrors = page.locator('.ant-form-item-explain-error');
  const count = await validationErrors.count();
  expect(count).toBeGreaterThan(0);
  await ctx.close();
});

// M1-05: 错误密码登录 → 错误提示
test('M1-05 错误密码登录显示错误提示', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');

  await page.fill(SEL.login.usernameInput, 'admin');
  await page.fill(SEL.login.passwordInput, 'WrongPassword123');
  await page.click(SEL.login.submitButton);

  // 等待错误提示（ant-message-error）
  const errorMsg = page.locator('.ant-message-error');
  await expect(errorMsg).toBeVisible({ timeout: 10000 });

  // 用户名输入框内容应保留
  await expect(page.locator(SEL.login.usernameInput)).toHaveValue('admin');
  await ctx.close();
});

// M1-06: 正确密码登录
test('M1-06 正确密码登录跳转到 /chat', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');

  await page.fill(SEL.login.usernameInput, 'admin');
  await page.fill(SEL.login.passwordInput, 'Admin@123');
  await page.click(SEL.login.submitButton);

  await page.waitForURL('**/chat**', { timeout: 15000 });
  expect(page.url()).toContain('/chat');

  // localStorage 包含 lsc-ai-auth
  const authData = await page.evaluate(() => localStorage.getItem('lsc-ai-auth'));
  expect(authData).toBeTruthy();
  const parsed = JSON.parse(authData!);
  expect(parsed.state.accessToken).toBeTruthy();
  await ctx.close();
});

// M1-07: 登录后刷新页面保持登录状态
test('M1-07 登录后刷新页面保持登录', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  // Login first
  await page.goto(`${BASE}/login`);
  await page.fill(SEL.login.usernameInput, 'admin');
  await page.fill(SEL.login.passwordInput, 'Admin@123');
  await page.click(SEL.login.submitButton);
  await page.waitForURL('**/chat**', { timeout: 15000 });

  // Reload
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Still on /chat, not redirected to /login
  expect(page.url()).toContain('/chat');
  // Welcome screen visible
  await expect(page.locator('text=有什么可以帮你的')).toBeVisible({ timeout: 10000 });
  await ctx.close();
});

// M1-08: 登出功能
test('M1-08 登出后跳转到 /login', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  // Login first
  await page.goto(`${BASE}/login`);
  await page.fill(SEL.login.usernameInput, 'admin');
  await page.fill(SEL.login.passwordInput, 'Admin@123');
  await page.click(SEL.login.submitButton);
  await page.waitForURL('**/chat**', { timeout: 15000 });

  // Click user avatar in sidebar
  await page.locator(SEL.sidebar.userAvatar).click();
  await page.waitForTimeout(300);

  // Click logout in dropdown
  const logoutItem = page.locator(SEL.sidebar.logoutMenuItem);
  await expect(logoutItem).toBeVisible({ timeout: 3000 });
  await logoutItem.click();

  // Should redirect to /login
  await page.waitForURL('**/login**', { timeout: 10000 });
  expect(page.url()).toContain('/login');

  // localStorage auth cleared
  const authData = await page.evaluate(() => localStorage.getItem('lsc-ai-auth'));
  if (authData) {
    const parsed = JSON.parse(authData);
    expect(parsed.state.accessToken).toBeFalsy();
  }
  await ctx.close();
});
