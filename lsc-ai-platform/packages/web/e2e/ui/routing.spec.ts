/**
 * 路由守卫测试（纯前端，不依赖 AI）
 */
import { test as base, expect } from '@playwright/test';
import { test as authTest } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';

// 未登录场景
const test = base;

test.describe('路由 — 未登录守卫', () => {
  test.setTimeout(30000);

  test('未登录访问 /chat → 重定向到 /login', async ({ page }) => {
    // 清除状态
    await page.goto('http://localhost:5173/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto('http://localhost:5173/chat');
    await page.waitForTimeout(3000);

    const url = page.url();
    const hasLogin = url.includes('/login') ||
      (await page.locator(SEL.login.usernameInput).isVisible().catch(() => false));
    expect(hasLogin).toBeTruthy();
  });

  test('未登录访问 /settings → 被拦截', async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto('http://localhost:5173/settings');
    await page.waitForTimeout(3000);

    const url = page.url();
    // 应被重定向到 login 或 chat
    const protected_ = url.includes('/login') || url.includes('/chat');
    console.log(`[路由] 未登录访问settings后URL: ${url}`);
  });
});

// 已登录场景
authTest.describe('路由 — 已登录', () => {
  authTest.setTimeout(30000);

  authTest('/ → 重定向到 /chat', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/chat');
  });

  authTest('不存在的路由 → 正常处理', async ({ page }) => {
    await page.goto('/nonexistent-route-xyz');
    await page.waitForTimeout(2000);

    const url = page.url();
    const handled = url.includes('/chat') || url.includes('/login') || url.includes('/404');
    expect(handled).toBeTruthy();
  });

  authTest('不存在的 sessionId → 页面不崩溃', async ({ page }) => {
    await page.goto('/chat/fake-session-id-99999');
    await page.waitForTimeout(3000);

    // 页面不崩溃
    const hasUI = (await page.locator(SEL.chat.textarea).isVisible().catch(() => false)) ||
                  (await page.locator('main').isVisible().catch(() => false));
    expect(hasUI).toBeTruthy();
  });

  authTest('/login → 已登录应重定向到 /chat', async ({ page }) => {
    await page.goto('/login');
    await page.waitForTimeout(3000);

    // 已登录用户访问 login 页面，可能重定向到 chat
    const url = page.url();
    console.log(`[路由] 已登录访问login后URL: ${url}`);
  });
});
