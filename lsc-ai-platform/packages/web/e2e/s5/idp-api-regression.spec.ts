/**
 * S5-IDP: API Endpoint Tests + Regression Checks
 *
 * Block 1: IDP API 接口测试 (6 tests)
 *   - 健康检查、任务列表、OCR/Table/Batch 无文件 400、无效 Job ID
 *
 * Block 2: S5 不退化测试 (6 tests)
 *   - 核心页面 /chat /knowledge /tasks /sentinel /projects /settings 加载正常
 */
import { test, expect } from '../fixtures/test-base';

const BASE_API = 'http://localhost:3000/api';

// ============================================================
// Block 1: S5-IDP API 接口测试
// ============================================================
test.describe('S5-IDP API: IDP 接口测试', () => {
  // ──────────────────────────────────────────────
  // API-1: GET /api/idp/health
  // ──────────────────────────────────────────────
  test('API-1: GET /api/idp/health — 健康检查', async ({ api }) => {
    const token = api.getToken();
    const res = await api['request'].get(`${BASE_API}/idp/health`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    console.log(`[API-1] Health: ${JSON.stringify(body)}`);
    // status field exists — value depends on whether OCR container is running
    // Could be "ok", "healthy", or "error"
    expect(body).toHaveProperty('status');
  });

  // ──────────────────────────────────────────────
  // API-2: GET /api/idp/jobs
  // ──────────────────────────────────────────────
  test('API-2: GET /api/idp/jobs — 任务列表', async ({ api }) => {
    const token = api.getToken();
    const res = await api['request'].get(`${BASE_API}/idp/jobs?page=1&pageSize=20`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    console.log(`[API-2] Jobs: total=${body.total}, items=${body.items?.length}`);
    // Service returns { items, total, page, pageSize }
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.items)).toBeTruthy();
    expect(typeof body.total).toBe('number');
  });

  // ──────────────────────────────────────────────
  // API-3: POST /api/idp/ocr — 无文件返回 400
  // ──────────────────────────────────────────────
  test('API-3: POST /api/idp/ocr — 无文件返回 400', async ({ api }) => {
    const token = api.getToken();
    const res = await api['request'].post(`${BASE_API}/idp/ocr`, {
      headers: { Authorization: `Bearer ${token}` },
      // No file body — should trigger BadRequestException
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    console.log(`[API-3] OCR no-file response: ${JSON.stringify(body)}`);
    // Controller throws BadRequestException('请上传文件')
    expect(body.message).toContain('请上传文件');
  });

  // ──────────────────────────────────────────────
  // API-4: POST /api/idp/table — 无文件返回 400
  // ──────────────────────────────────────────────
  test('API-4: POST /api/idp/table — 无文件返回 400', async ({ api }) => {
    const token = api.getToken();
    const res = await api['request'].post(`${BASE_API}/idp/table`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    console.log(`[API-4] Table no-file response: ${JSON.stringify(body)}`);
    // Same guard: BadRequestException('请上传文件')
    expect(body.message).toContain('请上传文件');
  });

  // ──────────────────────────────────────────────
  // API-5: GET /api/idp/jobs/nonexistent-id — 无效 ID
  // ──────────────────────────────────────────────
  test('API-5: GET /api/idp/jobs/nonexistent-id — 无效 ID', async ({ api }) => {
    const token = api.getToken();
    const res = await api['request'].get(`${BASE_API}/idp/jobs/nonexistent-id`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    console.log(`[API-5] Invalid job ID response: ${JSON.stringify(body)}`);
    // Controller: if (!job) throw new BadRequestException('任务不存在')
    expect(body.message).toContain('任务不存在');
  });

  // ──────────────────────────────────────────────
  // API-6: POST /api/idp/batch — 无文件返回 400
  // ──────────────────────────────────────────────
  test('API-6: POST /api/idp/batch — 无文件返回 400', async ({ api }) => {
    const token = api.getToken();
    const res = await api['request'].post(`${BASE_API}/idp/batch`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    console.log(`[API-6] Batch no-file response: ${JSON.stringify(body)}`);
    // Guard: if (!files?.length) throw BadRequestException('请上传文件')
    expect(body.message).toContain('请上传文件');
  });
});

// ============================================================
// Block 2: S5 不退化测试
// ============================================================
test.describe('S5-IDP Regression: S5 不退化测试', () => {
  // ──────────────────────────────────────────────
  // REG-1: /chat 页面正常加载
  // ──────────────────────────────────────────────
  test('REG-1: /chat 页面正常加载', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // Should not be redirected to /login
    expect(page.url()).not.toContain('/login');

    // Welcome screen or chat interface should be visible
    const welcomeOrChat = page.locator('textarea[placeholder*="输入消息"]')
      .or(page.locator('textarea[placeholder*="消息"]'));
    await expect(welcomeOrChat.first()).toBeVisible({ timeout: 15000 });

    // Textarea input must exist
    const textarea = page.locator('textarea');
    const count = await textarea.count();
    expect(count).toBeGreaterThanOrEqual(1);
    console.log('[REG-1] /chat loaded successfully');
  });

  // ──────────────────────────────────────────────
  // REG-2: /knowledge 页面正常加载
  // ──────────────────────────────────────────────
  test('REG-2: /knowledge 页面正常加载', async ({ page }) => {
    await page.goto('/knowledge');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/knowledge');

    // Page should have "知识库" text, or a list, or an empty state
    const knowledgeTitle = page.locator('text=知识库');
    const emptyState = page.locator('.ant-empty');
    const createButton = page.locator('button:has-text("创建")').or(
      page.locator('button:has-text("新建")')
    );

    const hasTitle = await knowledgeTitle.first().isVisible().catch(() => false);
    const hasEmpty = await emptyState.first().isVisible().catch(() => false);
    const hasButton = await createButton.first().isVisible().catch(() => false);

    expect(hasTitle || hasEmpty || hasButton).toBeTruthy();

    // Sidebar must be visible (page is not a white screen)
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible({ timeout: 10000 });
    console.log('[REG-2] /knowledge loaded successfully');
  });

  // ──────────────────────────────────────────────
  // REG-3: /tasks 页面正常加载
  // ──────────────────────────────────────────────
  test('REG-3: /tasks 页面正常加载', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/tasks');

    // Tasks page should have tabs: 定时任务, 自动化流程, 执行监控
    const scheduledTab = page.locator('.ant-tabs-tab:has-text("定时任务")');
    const rpaTab = page.locator('.ant-tabs-tab:has-text("自动化流程")');
    const monitorTab = page.locator('.ant-tabs-tab:has-text("执行监控")');

    await expect(scheduledTab).toBeVisible({ timeout: 15000 });
    await expect(rpaTab).toBeVisible();
    await expect(monitorTab).toBeVisible();
    console.log('[REG-3] /tasks loaded with 3 tabs');
  });

  // ──────────────────────────────────────────────
  // REG-4: /sentinel 页面正常加载
  // ──────────────────────────────────────────────
  test('REG-4: /sentinel 页面正常加载', async ({ page }) => {
    await page.goto('/sentinel');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/sentinel');

    // Page should have "Sentinel" text and overview cards
    const sentinelHeading = page.locator('h1:has-text("Sentinel")').or(
      page.locator('text=Sentinel Monitoring Center')
    );
    await expect(sentinelHeading.first()).toBeVisible({ timeout: 15000 });

    // Overview statistic cards should be present
    const statCards = page.locator('.ant-statistic');
    const cardCount = await statCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(1);
    console.log(`[REG-4] /sentinel loaded with ${cardCount} stat cards`);
  });

  // ──────────────────────────────────────────────
  // REG-5: /projects 页面正常加载
  // ──────────────────────────────────────────────
  test('REG-5: /projects 页面正常加载', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/projects');

    // Should show project list, table, or empty state
    const projectTable = page.locator('.ant-table');
    const emptyState = page.locator('.ant-empty');
    const projectCards = page.locator('.ant-card');
    const createButton = page.locator('button:has-text("创建")').or(
      page.locator('button:has-text("新建")')
    );

    const hasTable = await projectTable.first().isVisible().catch(() => false);
    const hasEmpty = await emptyState.first().isVisible().catch(() => false);
    const hasCards = await projectCards.first().isVisible().catch(() => false);
    const hasButton = await createButton.first().isVisible().catch(() => false);

    expect(hasTable || hasEmpty || hasCards || hasButton).toBeTruthy();

    // Sidebar must be visible
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible({ timeout: 10000 });
    console.log('[REG-5] /projects loaded successfully');
  });

  // ──────────────────────────────────────────────
  // REG-6: /settings 页面正常加载
  // ──────────────────────────────────────────────
  test('REG-6: /settings 页面正常加载', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/settings');

    // Settings page should have the heading
    const heading = page.locator('h1:has-text("设置")');
    await expect(heading).toBeVisible({ timeout: 15000 });

    // Should have at least one settings card
    const cards = page.locator('.ant-card');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(1);

    // Sidebar must be visible
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible({ timeout: 10000 });
    console.log(`[REG-6] /settings loaded with ${cardCount} cards`);
  });
});
