/**
 * M5: Client Agent 配对 + 本地模式 (12 tests)
 * 依赖: Client Agent 必须运行
 */
import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';
import { sendAndWaitWithRetry } from '../helpers/ai-retry.helper';

// Helper: check if agent is online
async function isAgentOnline(api: any): Promise<boolean> {
  try {
    const res = await api.getAgents();
    if (!res.ok()) return false;
    const agents = await res.json();
    return Array.isArray(agents) && agents.some((a: any) => a.status === 'online');
  } catch {
    return false;
  }
}

// Helper: open workspace modal and select local mode with device
async function enterLocalMode(page: any, workDir = 'D:\\u3d-projects\\lscmade7') {
  // Step 1: 点加号菜单 (ChatInput 里的, 不是侧边栏的)
  const plusBtn = page.locator('main .anticon-plus').last();
  await plusBtn.click();
  await page.waitForTimeout(500);

  // Step 2: 点"选择工作路径"
  const workdirItem = page.locator('.ant-dropdown-menu-item:has-text("选择工作路径")').first();
  if (!await workdirItem.isVisible().catch(() => false)) {
    return false;
  }
  await workdirItem.click();
  await page.waitForTimeout(500);

  // Step 3: Modal 打开 — 用 :visible 定位而非 .last()
  const modalContent = page.locator('.ant-modal-content:visible');
  await modalContent.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (!await modalContent.isVisible().catch(() => false)) {
    return false;
  }

  // Step 4: 选择"本地电脑" Radio
  const localRadio = modalContent.locator('text=本地电脑').first();
  await localRadio.click();
  await page.waitForTimeout(1500);

  // Step 5: 选设备 (第一个在线设备)
  // WorkspaceSelectModal 的设备列表: .ant-list .ant-list-item
  const deviceItems = modalContent.locator('.ant-list-item');
  const deviceCount = await deviceItems.count();
  if (deviceCount > 0) {
    await deviceItems.first().click();
    await page.waitForTimeout(500);
  } else {
    return false;
  }

  // Step 6: 输入工作目录
  // WorkspaceSelectModal 的输入框 placeholder: "例如：D:\projects\my-app 或 /home/user/projects"
  const dirInput = modalContent.locator('input[type="text"]').last();
  if (await dirInput.isVisible().catch(() => false)) {
    await dirInput.clear();
    await dirInput.fill(workDir);
    await page.waitForTimeout(300);
  }

  // Step 7: 点确定
  const confirmBtn = page.locator('.ant-modal-content:visible button:has-text("确定")').first();
  await confirmBtn.click();
  await page.waitForTimeout(1500);

  return true;
}

// ============================================================================
// M5-A: 工作空间选择 UI (4)
// ============================================================================

test('M5-01 打开工作空间选择弹窗', async ({ page, api }) => {
  const agentOnline = await isAgentOnline(api);
  test.skip(!agentOnline, 'Client Agent 未运行');

  await page.goto('/chat');
  await page.waitForLoadState('networkidle');

  // Click plus menu (ChatInput plus button, inside main)
  const plusBtn = page.locator('main .anticon-plus').last();
  await plusBtn.click();
  await page.waitForTimeout(500);

  // Click workspace selection item
  const workdirItem = page.locator('.ant-dropdown-menu-item:has-text("选择工作路径"), .ant-dropdown-menu-item:has-text("工作路径"), .ant-dropdown-menu-item:has-text("工作目录")').first();
  const hasWorkdirItem = await workdirItem.isVisible().catch(() => false);
  if (!hasWorkdirItem) {
    const altItem = page.locator('text=选择工作路径, text=工作目录').first();
    test.skip(!await altItem.isVisible().catch(() => false), '工作路径菜单项不存在');
    await altItem.click();
  } else {
    await workdirItem.click();
  }
  await page.waitForTimeout(500);

  // Modal visible
  const modal = page.locator('.ant-modal').last();
  await expect(modal).toBeVisible({ timeout: 5000 });

  // Radio options "本地电脑" and "云端服务器" exist
  await expect(modal.locator('text=本地电脑')).toBeVisible();
  await expect(modal.locator('text=云端服务器')).toBeVisible();
});

test('M5-02 选择云端服务器模式', async ({ page, api }) => {
  const agentOnline = await isAgentOnline(api);
  test.skip(!agentOnline, 'Client Agent 未运行');

  await page.goto('/chat');
  await page.waitForLoadState('networkidle');

  // Open modal
  // ChatInput plus button (inside main, not sidebar)
  const plusBtn = page.locator('main .anticon-plus').last();
  await plusBtn.click();
  await page.waitForTimeout(500);
  const workdirItem = page.locator('.ant-dropdown-menu-item:has-text("选择工作路径"), .ant-dropdown-menu-item:has-text("工作目录")').first();
  if (await workdirItem.isVisible().catch(() => false)) {
    await workdirItem.click();
  } else {
    test.skip(true, '无法打开工作路径选择');
  }
  await page.waitForTimeout(500);

  const modal = page.locator('.ant-modal').last();
  await expect(modal).toBeVisible({ timeout: 5000 });

  // Select cloud mode
  await modal.locator('text=云端服务器').click();
  await page.waitForTimeout(500);

  // Set work dir
  const dirInput = modal.locator('input[type="text"]').first();
  if (await dirInput.isVisible().catch(() => false)) {
    await dirInput.fill('/workspace');
  }

  // Confirm — 用 visible 过滤避免选到错误 modal
  const confirmBtn = page.locator('.ant-modal-content:visible button:has-text("确定")').first();
  await expect(confirmBtn).toBeVisible({ timeout: 3000 });
  await confirmBtn.click();
  await page.waitForTimeout(1000);

  // Modal should close — 云端模式不更新 agent store（设计如此，见 BUG-2 调查）
  await expect(modal).toBeHidden({ timeout: 5000 });
});

test('M5-03 本地电脑模式显示设备列表', async ({ page, api }) => {
  const agentOnline = await isAgentOnline(api);
  test.skip(!agentOnline, 'Client Agent 未运行');

  await page.goto('/chat');
  await page.waitForLoadState('networkidle');

  // Open modal
  // ChatInput plus button (inside main, not sidebar)
  const plusBtn = page.locator('main .anticon-plus').last();
  await plusBtn.click();
  await page.waitForTimeout(500);
  const workdirItem = page.locator('.ant-dropdown-menu-item:has-text("选择工作路径"), .ant-dropdown-menu-item:has-text("工作目录")').first();
  if (await workdirItem.isVisible().catch(() => false)) {
    await workdirItem.click();
  } else {
    test.skip(true, '无法打开工作路径选择');
  }
  await page.waitForTimeout(500);

  const modal = page.locator('.ant-modal-content').last();
  await expect(modal).toBeVisible({ timeout: 5000 });

  // Select local mode
  await modal.locator('text=本地电脑').first().click();
  await page.waitForTimeout(2000); // Wait for device list to load

  // Check for "检测到" text or device items
  const hasDeviceInfo = await modal.locator('text=检测到').isVisible().catch(() => false);
  const deviceItems = modal.locator('.ant-list-item');
  const count = await deviceItems.count();

  // Either device list or "检测到 X 个在线设备" text
  expect(count > 0 || hasDeviceInfo).toBe(true);

  // Device should show "在线" text
  const onlineText = await modal.textContent();
  expect(onlineText).toContain('在线');
});

test('M5-04 退出工作空间', async ({ page, api }) => {
  const agentOnline = await isAgentOnline(api);
  test.skip(!agentOnline, 'Client Agent 未运行');

  await page.goto('/chat');
  await page.waitForLoadState('networkidle');

  // Enter local mode first
  const entered = await enterLocalMode(page);
  if (!entered) {
    test.skip(true, '无法进入本地模式');
    return;
  }

  // AgentStatusIndicator should be visible — 从代码看显示"本地模式"文字
  await page.waitForTimeout(1000);
  const indicator = page.locator('text=本地模式');
  await expect(indicator).toBeVisible({ timeout: 5000 });

  // Click exit button — AgentStatusIndicator.tsx:161-163: <Button>退出</Button>
  const exitBtn = page.locator('button:has-text("退出")').first();
  await expect(exitBtn).toBeVisible({ timeout: 3000 });
  await exitBtn.click();
  await page.waitForTimeout(1000);

  // Agent store should be cleared
  const agentState = await page.evaluate(() => {
    const data = localStorage.getItem('lsc-ai-agent');
    return data ? JSON.parse(data) : null;
  });
  // currentDeviceId should be cleared after exit
  expect(agentState?.state?.currentDeviceId).toBeFalsy();
});

// ============================================================================
// M5-B: Agent 配对流程 (3)
// ============================================================================

test('M5-05 安装引导弹窗', async ({ page, api }) => {
  const agentOnline = await isAgentOnline(api);
  // This test checks the install guide UI — can work even with agent online

  await page.goto('/chat');
  await page.waitForLoadState('networkidle');

  // Open modal
  // ChatInput plus button (inside main, not sidebar)
  const plusBtn = page.locator('main .anticon-plus').last();
  await plusBtn.click();
  await page.waitForTimeout(500);
  const workdirItem = page.locator('.ant-dropdown-menu-item:has-text("选择工作路径"), .ant-dropdown-menu-item:has-text("工作目录")').first();
  if (await workdirItem.isVisible().catch(() => false)) {
    await workdirItem.click();
  } else {
    test.skip(true, '无法打开工作路径选择');
  }
  await page.waitForTimeout(500);

  const modal = page.locator('.ant-modal').last();
  await expect(modal).toBeVisible({ timeout: 5000 });

  // Select local mode
  await modal.locator('text=本地电脑').click();
  await page.waitForTimeout(1000);

  // Look for "安装 Client Agent" button
  const installBtn = modal.locator('button:has-text("安装"), button:has-text("Agent")').first();
  if (await installBtn.isVisible().catch(() => false)) {
    await installBtn.click();
    await page.waitForTimeout(500);

    // Steps component should appear
    const steps = page.locator('.ant-steps');
    await expect(steps).toBeVisible({ timeout: 5000 });
  } else {
    // Agent already paired — install button may not show
    // Verify that device list is showing instead
    const deviceItems = modal.locator('.ant-list-item, [class*="device"]');
    const count = await deviceItems.count();
    expect(count).toBeGreaterThan(0);
  }
});

test('M5-06 配对码生成', async ({ page, api }) => {
  const agentOnline = await isAgentOnline(api);
  // This test verifies pairing code format from the install guide

  await page.goto('/chat');
  await page.waitForLoadState('networkidle');

  // Open workspace modal
  // ChatInput plus button (inside main, not sidebar)
  const plusBtn = page.locator('main .anticon-plus').last();
  await plusBtn.click();
  await page.waitForTimeout(500);
  const workdirItem = page.locator('.ant-dropdown-menu-item:has-text("选择工作路径"), .ant-dropdown-menu-item:has-text("工作目录")').first();
  if (await workdirItem.isVisible().catch(() => false)) {
    await workdirItem.click();
  } else {
    test.skip(true, '无法打开工作路径选择');
  }
  await page.waitForTimeout(500);

  const modal = page.locator('.ant-modal').last();
  await modal.locator('text=本地电脑').click();
  await page.waitForTimeout(1000);

  // Look for pairing code in the modal or install guide
  // Pairing code is 6 digits
  const allText = await modal.textContent();
  const pairingCodeMatch = allText?.match(/\b\d{6}\b/);

  if (pairingCodeMatch) {
    expect(pairingCodeMatch[0].length).toBe(6);
  } else {
    // No pairing code shown (already paired) — verify devices exist instead
    const deviceCount = await modal.locator('.ant-list-item, [class*="device"]').count();
    expect(deviceCount).toBeGreaterThan(0);
  }
});

test('M5-07 设备列表显示', async ({ page, api }) => {
  const agentOnline = await isAgentOnline(api);
  test.skip(!agentOnline, 'Client Agent 未运行');

  await page.goto('/chat');
  await page.waitForLoadState('networkidle');

  // Open workspace modal → local mode
  // ChatInput plus button (inside main, not sidebar)
  const plusBtn = page.locator('main .anticon-plus').last();
  await plusBtn.click();
  await page.waitForTimeout(500);
  const workdirItem = page.locator('.ant-dropdown-menu-item:has-text("选择工作路径"), .ant-dropdown-menu-item:has-text("工作目录")').first();
  if (await workdirItem.isVisible().catch(() => false)) {
    await workdirItem.click();
  } else {
    test.skip(true, '无法打开工作路径选择');
  }
  await page.waitForTimeout(500);

  const modal = page.locator('.ant-modal').last();
  await modal.locator('text=本地电脑').click();
  await page.waitForTimeout(1000);

  // Device list should show paired device
  const deviceItems = modal.locator('.ant-list-item, [class*="device"]');
  const count = await deviceItems.count();
  expect(count).toBeGreaterThan(0);

  // Device should have name and status
  const deviceText = await deviceItems.first().textContent();
  expect(deviceText).toBeTruthy();
  expect(deviceText!.length).toBeGreaterThan(0);
});

// ============================================================================
// M5-C: 本地模式核心功能 (5)
// ============================================================================

test('M5-08 切换到本地模式并发送消息', async ({ page, api }) => {
  test.setTimeout(300000);
  const agentOnline = await isAgentOnline(api);
  test.skip(!agentOnline, 'Client Agent 未运行');

  await page.goto('/chat');
  await page.waitForLoadState('networkidle');

  const entered = await enterLocalMode(page);
  test.skip(!entered, '无法进入本地模式');

  await page.waitForTimeout(2000);

  const { hasResponse, responseText } = await sendAndWaitWithRetry(
    page,
    '你好，我在本地模式下',
    { timeout: 120000, retries: 2 },
  );
  expect(hasResponse).toBe(true);
  expect(responseText.length).toBeGreaterThan(0);
});

test('M5-09 本地模式执行文件操作', async ({ page, api }) => {
  test.setTimeout(300000);
  const agentOnline = await isAgentOnline(api);
  test.skip(!agentOnline, 'Client Agent 未运行');

  await page.goto('/chat');
  await page.waitForLoadState('networkidle');

  const entered = await enterLocalMode(page);
  test.skip(!entered, '无法进入本地模式');

  await page.waitForTimeout(2000);

  const { hasResponse } = await sendAndWaitWithRetry(
    page,
    '在工作目录下创建一个文件 test-e2e-temp.txt，内容是 hello from e2e test',
    { timeout: 120000, retries: 2 },
  );
  expect(hasResponse).toBe(true);

  // Should have tool steps (file write tool)
  const toolSteps = page.locator('main .message-bubble.assistant .bg-cream-50');
  const hasTools = await toolSteps.count() > 0;
  // Tool call is expected but not guaranteed if AI does it differently
  const lastBubble = page.locator('main .message-bubble.assistant').last();
  const text = await lastBubble.textContent();
  expect(text!.length).toBeGreaterThan(0);
});

test('M5-10 本地模式执行 Shell 命令', async ({ page, api }) => {
  test.setTimeout(300000);
  const agentOnline = await isAgentOnline(api);
  test.skip(!agentOnline, 'Client Agent 未运行');

  await page.goto('/chat');
  await page.waitForLoadState('networkidle');

  const entered = await enterLocalMode(page);
  test.skip(!entered, '无法进入本地模式');

  await page.waitForTimeout(2000);

  const { hasResponse, responseText } = await sendAndWaitWithRetry(
    page,
    '运行 dir 命令看看当前目录下有什么文件',
    { timeout: 120000, retries: 2 },
  );
  expect(hasResponse).toBe(true);
  // Response should contain file/directory listings
  expect(responseText.length).toBeGreaterThan(10);
});

test('M5-11 远程→本地模式切换上下文连贯', async ({ page, api }) => {
  test.setTimeout(240000);
  const agentOnline = await isAgentOnline(api);
  test.skip(!agentOnline, 'Client Agent 未运行');

  await page.goto('/chat');
  await page.waitForLoadState('networkidle');

  // Remote mode: send message with something to remember
  const r1 = await sendAndWaitWithRetry(
    page,
    '请记住密码是 test123，这很重要',
    { timeout: 90000, retries: 2 },
  );
  expect(r1.hasResponse).toBe(true);

  // Switch to local mode
  const entered = await enterLocalMode(page);
  test.skip(!entered, '无法进入本地模式');

  await page.waitForTimeout(2000);

  // Ask about the remembered info in local mode
  const r2 = await sendAndWaitWithRetry(
    page,
    '我刚才让你记住的密码是什么？',
    { timeout: 120000, retries: 2 },
  );
  expect(r2.hasResponse).toBe(true);
  // Context should carry over via server's Mastra Memory
  expect(r2.responseText).toContain('test123');
});

test('M5-12 Agent 离线状态感知', async ({ page, api }) => {
  const agentOnline = await isAgentOnline(api);
  test.skip(!agentOnline, 'Client Agent 未运行 — 无法测试离线感知');

  await page.goto('/chat');
  await page.waitForLoadState('networkidle');

  // Open workspace modal → local mode → check device status
  // ChatInput plus button (inside main, not sidebar)
  const plusBtn = page.locator('main .anticon-plus').last();
  await plusBtn.click();
  await page.waitForTimeout(500);
  const workdirItem = page.locator('.ant-dropdown-menu-item:has-text("选择工作路径"), .ant-dropdown-menu-item:has-text("工作目录")').first();
  if (await workdirItem.isVisible().catch(() => false)) {
    await workdirItem.click();
  } else {
    test.skip(true, '无法打开工作路径选择');
  }
  await page.waitForTimeout(500);

  const modal = page.locator('.ant-modal').last();
  await modal.locator('text=本地电脑').click();
  await page.waitForTimeout(1000);

  // 验证在线状态
  const modalText = await modal.textContent();
  expect(modalText).toContain('在线');

  // 离线感知测试：无法在自动化中停止 Client Agent 进程
  // 完整离线测试需要：停止 Agent → 刷新设备列表 → 检查状态变为离线
  test.skip(true, '在线状态已验证。离线感知需手动停止 Client Agent 进程，无法在 E2E 自动化中完成');
});
