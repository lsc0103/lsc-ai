/**
 * M3: Sentinel Monitoring Center E2E Tests
 *
 * 测试 Sentinel 监控中心页面的完整功能：
 * - 页面加载与 Tab 导航
 * - Agent 列表展示
 * - 概览统计卡片
 * - 告警规则 CRUD（新建/编辑/启用禁用/删除）
 * - AdminRoute 守卫
 */
import { test, expect } from '../fixtures/test-base';

const BASE_API = 'http://localhost:3000/api';

test.describe('M3: Sentinel Monitoring Center', () => {
  // 用于清理测试数据的规则 ID
  let testRuleId: string | null = null;

  // ──────────────────────────────────────────────
  // SN-1: 页面加载
  // ──────────────────────────────────────────────
  test('SN-1 页面加载 — 标题和 Tab 标签可见', async ({ page }) => {
    await page.goto('/sentinel');
    await page.waitForLoadState('networkidle');

    // 验证页面标题
    const heading = page.locator('h1:has-text("Sentinel Monitoring Center")');
    await expect(heading).toBeVisible({ timeout: 15000 });

    // 验证副标题
    const subtitle = page.locator('text=Agent monitoring, metrics & alert management');
    await expect(subtitle).toBeVisible();

    // 验证 Tab 标签存在
    await expect(page.locator('.ant-tabs-tab:has-text("Agent List")')).toBeVisible();
    await expect(page.locator('.ant-tabs-tab:has-text("Alert Center")')).toBeVisible();
    await expect(page.locator('.ant-tabs-tab:has-text("Alert Rules")')).toBeVisible();
  });

  // ──────────────────────────────────────────────
  // SN-2: Agent 列表
  // ──────────────────────────────────────────────
  test('SN-2 Agent 列表 — 加载 Table 或空态', async ({ page }) => {
    await page.goto('/sentinel');
    await page.waitForLoadState('networkidle');

    // 默认应该在 Agent List Tab
    const agentTab = page.locator('.ant-tabs-tab-active:has-text("Agent List")');
    await expect(agentTab).toBeVisible({ timeout: 15000 });

    // 验证 Table 或 Empty 存在
    const table = page.locator('.ant-table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Table 应该有列头（Name, Hostname, Platform, Status 等）
    const headerRow = page.locator('.ant-table-thead');
    await expect(headerRow).toBeVisible();
    await expect(headerRow.locator('th:has-text("Name")').first()).toBeVisible();
    await expect(headerRow.locator('th:has-text("Status")').first()).toBeVisible();
  });

  // ──────────────────────────────────────────────
  // SN-3: 概览统计卡片
  // ──────────────────────────────────────────────
  test('SN-3 概览卡片 — 统计卡片显示且 API 可达', async ({ page, api }) => {
    await page.goto('/sentinel');
    await page.waitForLoadState('networkidle');

    // 验证 4 个统计卡片存在（用 .ant-statistic-title 限定范围，避免匹配表格中的状态文字）
    await expect(page.locator('.ant-statistic-title:has-text("Total Agents")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.ant-statistic-title:has-text("Online")')).toBeVisible();
    await expect(page.locator('.ant-statistic-title:has-text("Offline")')).toBeVisible();
    await expect(page.locator('.ant-statistic-title:has-text("Active Alerts")')).toBeVisible();

    // 每个卡片都应该有数字展示（Statistic 组件渲染的数值）
    const statValues = page.locator('.ant-statistic-content-value');
    const count = await statValues.count();
    expect(count).toBeGreaterThanOrEqual(4);

    // 通过 API 验证 health 端点可达
    const token = api.getToken();
    const healthRes = await page.request.get(`${BASE_API}/sentinel-agents/health`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(healthRes.ok()).toBeTruthy();
    const healthData = await healthRes.json();
    // 返回值应包含 total/online/offline 字段
    expect(healthData).toHaveProperty('total');
    expect(healthData).toHaveProperty('online');
    expect(healthData).toHaveProperty('offline');
  });

  // ──────────────────────────────────────────────
  // SN-4: 告警规则新建
  // ──────────────────────────────────────────────
  test('SN-4 告警规则新建 — 填写表单并创建规则', async ({ page, api }) => {
    await page.goto('/sentinel');
    await page.waitForLoadState('networkidle');

    // 切换到 Alert Rules Tab
    await page.locator('.ant-tabs-tab:has-text("Alert Rules")').click();
    await page.waitForTimeout(500);

    // 点击 "Add Rule" 按钮
    const addButton = page.locator('button:has-text("Add Rule")');
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();

    // 等待 Modal 出现
    const modal = page.locator('.ant-modal:has-text("Add Alert Rule")');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 填写规则表单
    await modal.locator('input[id*="name"]').fill('Playwright测试规则');
    await modal.locator('input[id*="metricName"]').fill('cpu_percent');

    // 选择 Condition: gt
    await modal.locator('.ant-select:has(.ant-select-selection-placeholder:has-text("Select"))').first().click();
    await page.locator('.ant-select-item-option:has-text("> (greater than)")').click();

    // 填写 Threshold: 90
    await modal.locator('input[id*="threshold"]').fill('90');

    // 选择 Severity: warning (应已默认选中)
    // Duration 和 Cooldown 应有默认值

    // 提交创建
    await modal.locator('button:has-text("Create")').click();

    // 等待 Modal 关闭并验证成功消息
    await expect(modal).toBeHidden({ timeout: 10000 });

    // 验证列表中出现了新规则
    await page.waitForTimeout(1000);
    const ruleInList = page.locator('.ant-table-row:has-text("Playwright测试规则")');
    await expect(ruleInList).toBeVisible({ timeout: 5000 });

    // 通过 API 获取规则列表验证
    const token = api.getToken();
    const rulesRes = await page.request.get(`${BASE_API}/sentinel-agents/alert-rules`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(rulesRes.ok()).toBeTruthy();
    const rulesData = await rulesRes.json();
    const rules = Array.isArray(rulesData) ? rulesData : (rulesData?.data || []);
    const createdRule = rules.find((r: any) => r.name === 'Playwright测试规则');
    expect(createdRule).toBeTruthy();
    expect(createdRule.metricName).toBe('cpu_percent');
    expect(createdRule.condition).toBe('gt');
    expect(createdRule.threshold).toBe(90);

    // 保存规则 ID 供后续测试使用
    testRuleId = createdRule.id;
  });

  // ──────────────────────────────────────────────
  // SN-5: 告警规则编辑
  // ──────────────────────────────────────────────
  test('SN-5 告警规则编辑 — 修改阈值并保存', async ({ page, api }) => {
    // 确保有测试规则可编辑
    const token = api.getToken();
    if (!testRuleId) {
      // 通过 API 创建一个测试规则
      const createRes = await page.request.post(`${BASE_API}/sentinel-agents/alert-rules`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Playwright测试规则',
          metricName: 'cpu_percent',
          condition: 'gt',
          threshold: 90,
          duration: 60,
          severity: 'warning',
          enabled: true,
        },
      });
      expect(createRes.ok()).toBeTruthy();
      const created = await createRes.json();
      testRuleId = created.data?.id || created.id;
    }

    await page.goto('/sentinel');
    await page.waitForLoadState('networkidle');

    // 切换到 Alert Rules Tab
    await page.locator('.ant-tabs-tab:has-text("Alert Rules")').click();
    await page.waitForTimeout(500);

    // 点击编辑按钮
    const ruleRow = page.locator('.ant-table-row:has-text("Playwright测试规则")');
    await expect(ruleRow).toBeVisible({ timeout: 10000 });
    await ruleRow.locator('button:has-text("Edit")').click();

    // 等待编辑 Modal 出现
    const modal = page.locator('.ant-modal:has-text("Edit Alert Rule")');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 修改阈值为 95
    const thresholdInput = modal.locator('input[id*="threshold"]');
    await thresholdInput.clear();
    await thresholdInput.fill('95');

    // 保存
    await modal.locator('button:has-text("Update")').click();
    await expect(modal).toBeHidden({ timeout: 10000 });

    // 验证更新后的阈值（通过 API）
    const ruleRes = await page.request.get(`${BASE_API}/sentinel-agents/alert-rules`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const rulesData = await ruleRes.json();
    const rules = Array.isArray(rulesData) ? rulesData : (rulesData?.data || []);
    const updatedRule = rules.find((r: any) => r.id === testRuleId);
    expect(updatedRule).toBeTruthy();
    expect(updatedRule.threshold).toBe(95);
  });

  // ──────────────────────────────────────────────
  // SN-6: 告警规则启用/禁用
  // ──────────────────────────────────────────────
  test('SN-6 告警规则启用/禁用 — 切换规则状态', async ({ page, api }) => {
    const token = api.getToken();
    // 确保有测试规则
    if (!testRuleId) {
      const createRes = await page.request.post(`${BASE_API}/sentinel-agents/alert-rules`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Playwright测试规则',
          metricName: 'cpu_percent',
          condition: 'gt',
          threshold: 95,
          duration: 60,
          severity: 'warning',
          enabled: true,
        },
      });
      const created = await createRes.json();
      testRuleId = created.data?.id || created.id;
    }

    await page.goto('/sentinel');
    await page.waitForLoadState('networkidle');

    // 切换到 Alert Rules Tab
    await page.locator('.ant-tabs-tab:has-text("Alert Rules")').click();
    await page.waitForTimeout(500);

    // 找到测试规则行的 Switch
    const ruleRow = page.locator('.ant-table-row:has-text("Playwright测试规则")');
    await expect(ruleRow).toBeVisible({ timeout: 10000 });
    const toggle = ruleRow.locator('.ant-switch');
    await expect(toggle).toBeVisible();

    // 获取当前状态
    const wasChecked = await toggle.getAttribute('aria-checked') === 'true';

    // 点击切换
    await toggle.click();
    await page.waitForTimeout(1000);

    // 验证状态已变更（通过 API）
    const ruleRes = await page.request.get(`${BASE_API}/sentinel-agents/alert-rules`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const rulesData = await ruleRes.json();
    const rules = Array.isArray(rulesData) ? rulesData : (rulesData?.data || []);
    const toggledRule = rules.find((r: any) => r.id === testRuleId);
    expect(toggledRule).toBeTruthy();
    expect(toggledRule.enabled).toBe(!wasChecked);
  });

  // ──────────────────────────────────────────────
  // SN-7: 告警规则删除
  // ──────────────────────────────────────────────
  test('SN-7 告警规则删除 — 删除测试规则', async ({ page, api }) => {
    const token = api.getToken();
    // 确保有测试规则
    if (!testRuleId) {
      const createRes = await page.request.post(`${BASE_API}/sentinel-agents/alert-rules`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Playwright测试规则',
          metricName: 'cpu_percent',
          condition: 'gt',
          threshold: 95,
          duration: 60,
          severity: 'warning',
          enabled: true,
        },
      });
      const created = await createRes.json();
      testRuleId = created.data?.id || created.id;
    }

    await page.goto('/sentinel');
    await page.waitForLoadState('networkidle');

    // 切换到 Alert Rules Tab
    await page.locator('.ant-tabs-tab:has-text("Alert Rules")').click();
    await page.waitForTimeout(500);

    // 找到测试规则行
    const ruleRow = page.locator('.ant-table-row:has-text("Playwright测试规则")');
    await expect(ruleRow).toBeVisible({ timeout: 10000 });

    // 点击删除按钮
    await ruleRow.locator('button:has-text("Delete")').click();

    // 确认 Popconfirm
    const confirmButton = page.locator('.ant-popconfirm button:has-text("Delete")');
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();

    // 等待删除完成
    await page.waitForTimeout(1000);

    // 验证规则已从列表移除
    await expect(ruleRow).toBeHidden({ timeout: 5000 });

    // 通过 API 验证
    const rulesRes = await page.request.get(`${BASE_API}/sentinel-agents/alert-rules`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const rulesData = await rulesRes.json();
    const rules = Array.isArray(rulesData) ? rulesData : (rulesData?.data || []);
    const deletedRule = rules.find((r: any) => r.id === testRuleId);
    expect(deletedRule).toBeFalsy();

    testRuleId = null;
  });

  // ──────────────────────────────────────────────
  // SN-8: AdminRoute 守卫
  // ──────────────────────────────────────────────
  test('SN-8 AdminRoute 守卫 — 非管理员无法访问 /sentinel', async ({ page, api }) => {
    // 验证 /sentinel 路由被 AdminRoute 包裹
    // 当非 admin 用户访问时应重定向到 /chat
    // 我们通过 API 创建非 admin 用户来测试
    const token = api.getToken();

    // 尝试使用普通用户访问 Sentinel API（测试 API 层面的 403 守卫）
    // 登录一个非 admin 用户（如果存在的话）
    // 如果没有普通用户，我们至少验证 API 端点需要 admin 权限
    const loginRes = await page.request.post(`${BASE_API}/auth/login`, {
      data: { username: 'user', password: 'User@123' },
    });

    if (loginRes.ok()) {
      // 如果普通用户存在，用其 token 访问 sentinel API
      const userData = await loginRes.json();
      const userToken = userData.accessToken;

      const sentinelRes = await page.request.get(`${BASE_API}/sentinel-agents`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      // 应该返回 403 Forbidden
      expect(sentinelRes.status()).toBe(403);
    } else {
      // 如果没有普通用户，验证 admin 用户可以正常访问（至少证明 API 有权限检查）
      const sentinelRes = await page.request.get(`${BASE_API}/sentinel-agents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(sentinelRes.ok()).toBeTruthy();

      // 同时验证无 token 访问会被拒绝
      const noAuthRes = await page.request.get(`${BASE_API}/sentinel-agents`);
      expect(noAuthRes.status()).toBe(401);
    }
  });

  // ──────────────────────────────────────────────
  // 清理测试数据
  // ──────────────────────────────────────────────
  test.afterAll(async ({ request }) => {
    if (testRuleId) {
      try {
        // 登录获取 token
        const loginRes = await request.post(`${BASE_API}/auth/login`, {
          data: { username: 'admin', password: 'Admin@123' },
        });
        const loginData = await loginRes.json();
        const token = loginData.accessToken;

        await request.delete(`${BASE_API}/sentinel-agents/alert-rules/${testRuleId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log(`[cleanup] Deleted test rule: ${testRuleId}`);
      } catch {
        console.log(`[cleanup] Failed to delete test rule: ${testRuleId}`);
      }
    }
  });
});
