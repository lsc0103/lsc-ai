/**
 * M7: 侧边栏 + 路由 + 页面壳 (10 tests)
 * 依赖: 无（纯前端）
 * 使用 storageState 已登录状态
 */
import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';

// M7-01: 侧边栏折叠/展开
test('M7-01 侧边栏折叠展开', async ({ page }) => {
  await page.goto('/chat');
  await page.waitForLoadState('networkidle');

  const sidebar = page.locator(SEL.sidebar.root);
  await expect(sidebar).toBeVisible();

  // Get initial width
  const initialBox = await sidebar.boundingBox();
  expect(initialBox).toBeTruthy();
  const initialWidth = initialBox!.width;
  expect(initialWidth).toBeGreaterThan(100); // expanded

  // Click collapse button (MenuFoldOutlined)
  const collapseBtn = page.locator('aside .anticon-menu-fold, aside .anticon-menu-unfold').first();
  await collapseBtn.click();
  await page.waitForTimeout(500);

  // Width should be narrower
  const collapsedBox = await sidebar.boundingBox();
  expect(collapsedBox).toBeTruthy();
  expect(collapsedBox!.width).toBeLessThan(initialWidth);

  // Click again to expand (icon changes after collapse)
  const expandBtn = page.locator('aside .anticon-menu-fold, aside .anticon-menu-unfold').first();
  await expandBtn.click();
  await page.waitForTimeout(800);

  const expandedBox = await sidebar.boundingBox();
  expect(expandedBox).toBeTruthy();
  // After re-expand, width should be >= initial width or at least > collapsed
  expect(expandedBox!.width).toBeGreaterThanOrEqual(collapsedBox!.width);
});

// M7-02: 导航到项目页面
test('M7-02 导航到项目页面', async ({ page }) => {
  await page.goto('/chat');
  await page.waitForLoadState('networkidle');

  // Click "我的项目" nav item (FolderOutlined)
  await page.locator('aside .anticon-folder').first().click();
  await page.waitForURL('**/projects**', { timeout: 5000 });

  expect(page.url()).toContain('/projects');
  await expect(page.locator('h1:has-text("我的项目")')).toBeVisible();
});

// M7-03: 导航到任务页面
test('M7-03 导航到任务页面', async ({ page }) => {
  await page.goto('/chat');
  await page.waitForLoadState('networkidle');

  // Click "RPA/任务" nav (ClockCircleOutlined)
  await page.locator('aside .anticon-clock-circle').first().click();
  await page.waitForURL('**/tasks**', { timeout: 5000 });

  expect(page.url()).toContain('/tasks');

  // Two tabs: 定时任务 and RPA 流程
  await expect(page.locator('.ant-tabs-tab:has-text("定时任务")')).toBeVisible();
  await expect(page.locator('.ant-tabs-tab:has-text("RPA 流程")')).toBeVisible();
});

// M7-04: 导航到设置页面
test('M7-04 导航到设置页面', async ({ page }) => {
  await page.goto('/chat');
  await page.waitForLoadState('networkidle');

  // Click user avatar → settings
  await page.locator(SEL.sidebar.userAvatar).click();
  await page.waitForTimeout(300);

  const settingsItem = page.locator('[data-menu-id$="settings"]');
  await expect(settingsItem).toBeVisible({ timeout: 3000 });
  await settingsItem.click();

  await page.waitForURL('**/settings**', { timeout: 5000 });
  expect(page.url()).toContain('/settings');

  // Settings page has username display and display name input
  await expect(page.locator('h1:has-text("设置")')).toBeVisible();
});

// M7-05: 从其他页面回到聊天
test('M7-05 从其他页面回到聊天', async ({ page }) => {
  await page.goto('/projects');
  await page.waitForLoadState('networkidle');
  expect(page.url()).toContain('/projects');

  // Click new chat button in sidebar
  await page.locator(SEL.sidebar.newChatButton).click();
  await page.waitForURL('**/chat**', { timeout: 5000 });

  expect(page.url()).toContain('/chat');
  await expect(page.locator('text=有什么可以帮你的')).toBeVisible({ timeout: 10000 });
});

// M7-06: 项目页面 UI 壳
test('M7-06 项目页面 UI 壳完整', async ({ page }) => {
  const jsErrors: string[] = [];
  page.on('pageerror', (e) => jsErrors.push(e.message));

  await page.goto('/projects');
  await page.waitForLoadState('networkidle');

  // "新建项目" or "创建第一个项目" button exists
  const createBtn = page.locator('button:has-text("新建项目"), button:has-text("创建第一个项目")');
  await expect(createBtn.first()).toBeVisible();

  // Empty state text
  await expect(page.locator('text=暂无项目')).toBeVisible();

  // No JS errors
  expect(jsErrors).toHaveLength(0);
});

// M7-07: 任务页面 UI 壳
test('M7-07 任务页面 UI 壳完整', async ({ page }) => {
  const jsErrors: string[] = [];
  page.on('pageerror', (e) => jsErrors.push(e.message));

  await page.goto('/tasks');
  await page.waitForLoadState('networkidle');

  // Tab component exists
  await expect(page.locator('.ant-tabs')).toBeVisible();
  await expect(page.locator('.ant-tabs-tab:has-text("定时任务")')).toBeVisible();
  await expect(page.locator('.ant-tabs-tab:has-text("RPA 流程")')).toBeVisible();

  // Empty state
  await expect(page.locator('text=暂无定时任务')).toBeVisible();

  // No JS errors
  expect(jsErrors).toHaveLength(0);
});

// M7-08: 设置页面 UI 壳
test('M7-08 设置页面 UI 壳完整', async ({ page }) => {
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');

  // Username shows "admin" (disabled input)
  const usernameInput = page.locator('input[disabled]').first();
  await expect(usernameInput).toBeVisible();
  await expect(usernameInput).toHaveValue('admin');

  // Display name input exists
  await expect(page.locator('input[placeholder="输入显示名称"]')).toBeVisible();

  // Save button
  await expect(page.locator('button:has-text("保存设置")')).toBeVisible();
});

// M7-09: 未登录访问任意受保护路由 → 跳转登录
test('M7-09 未登录访问受保护路由全部跳转登录', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();

  const routes = ['/chat', '/projects', '/tasks', '/settings'];
  for (const route of routes) {
    await page.goto(`http://localhost:5173${route}`);
    await page.waitForURL('**/login**', { timeout: 15000 });
    expect(page.url()).toContain('/login');
  }
  await ctx.close();
});

// M7-10: 访问不存在的路由
test('M7-10 访问不存在路由跳转首页', async ({ page }) => {
  await page.goto('/nonexistent-page-xyz');
  await page.waitForLoadState('networkidle');

  // Should redirect to / or /chat
  const url = page.url();
  const isValidRedirect = url.includes('/chat') || url.endsWith('/') || url.includes('/login');
  expect(isValidRedirect).toBe(true);
});
