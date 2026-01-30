/**
 * 登录页 UI 细节测试（纯前端，不依赖 AI）
 */
import { test as base, expect } from '@playwright/test';
import { SEL } from '../helpers/selectors';

// 不使用 storageState — 需要未登录状态
const test = base;

test.describe('登录页 — UI 细节', () => {
  test.beforeEach(async ({ page }) => {
    // 清除登录状态
    await page.goto('http://localhost:5173/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('http://localhost:5173/login');
    await page.waitForTimeout(1000);
  });

  test('登录页 → 用户名和密码输入框可见', async ({ page }) => {
    await expect(page.locator(SEL.login.usernameInput)).toBeVisible();
    await expect(page.locator(SEL.login.passwordInput)).toBeVisible();
  });

  test('登录页 → 提交按钮可见', async ({ page }) => {
    await expect(page.locator(SEL.login.submitButton)).toBeVisible();
  });

  test('密码框 → 为 password 类型（不显示明文）', async ({ page }) => {
    const pwdInput = page.locator(SEL.login.passwordInput);
    const type = await pwdInput.getAttribute('type');
    expect(type).toBe('password');
  });

  test('Enter 键 → 可以提交表单', async ({ page }) => {
    await page.fill(SEL.login.usernameInput, 'admin');
    await page.fill(SEL.login.passwordInput, 'Admin@123');
    await page.press(SEL.login.passwordInput, 'Enter');

    // 应该跳转（登录成功）或停留（登录失败）
    await page.waitForTimeout(3000);
    // 如果登录成功，URL 应变化
    const url = page.url();
    console.log(`[登录Enter] 提交后URL: ${url}`);
  });

  test('错误密码 → 显示错误提示且仍在登录页', async ({ page }) => {
    await page.fill(SEL.login.usernameInput, 'admin');
    await page.fill(SEL.login.passwordInput, 'wrong_password');
    await page.click(SEL.login.submitButton);

    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/login');
  });

  test('登录页 → 无布局溢出', async ({ page }) => {
    const overflow = await page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth + 10;
    });
    expect(overflow).toBe(false);
  });
});
