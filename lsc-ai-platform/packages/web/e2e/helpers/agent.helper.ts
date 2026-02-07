/**
 * Agent 测试辅助工具
 *
 * 统一 Client Agent 在线检查和本地模式进入/退出操作。
 * 提取自 S04-V2 的重复模式。
 */
import type { Page } from '@playwright/test';
import type { ApiHelper } from './api.helper';

// ============================================================================
// Agent 状态检查
// ============================================================================

/**
 * 检查是否有 Agent 在线。
 */
export async function isAgentOnline(api: ApiHelper): Promise<boolean> {
  try {
    const res = await api.getAgents();
    if (!res.ok()) return false;
    const agents = await res.json();
    return Array.isArray(agents) && agents.some((a: any) => a.status === 'online');
  } catch {
    return false;
  }
}

/**
 * 获取第一个在线 Agent 的设备信息。
 */
export async function getOnlineAgent(
  api: ApiHelper,
): Promise<{ deviceName: string; platform: string } | null> {
  try {
    const res = await api.getAgents();
    if (!res.ok()) return null;
    const agents = await res.json();
    const online = agents.find((a: any) => a.status === 'online');
    return online ? { deviceName: online.deviceName, platform: online.platform || '' } : null;
  } catch {
    return null;
  }
}

// ============================================================================
// 本地模式操作
// ============================================================================

const DEFAULT_WORK_DIR = process.env.S04_WORK_DIR || 'D:\\u3d-projects\\lscmade7';

/**
 * 打开工作空间选择 Modal。
 */
export async function openWorkspaceModal(page: Page): Promise<boolean> {
  const plusBtn = page.locator('main .anticon-plus').last();
  if (!await plusBtn.isVisible().catch(() => false)) return false;
  await plusBtn.click();
  await page.waitForTimeout(500);

  const menuItem = page.locator('.ant-dropdown-menu-item:has-text("选择工作路径")').first();
  if (!await menuItem.isVisible().catch(() => false)) return false;
  await menuItem.click();
  await page.waitForTimeout(500);

  const modal = page.locator('.ant-modal-content:visible');
  await modal.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  return await modal.isVisible().catch(() => false);
}

/**
 * 进入本地模式（完整流程）。
 */
export async function enterLocalMode(
  page: Page,
  workDir = DEFAULT_WORK_DIR,
): Promise<{ success: boolean; reason?: string }> {
  const modalOpened = await openWorkspaceModal(page);
  if (!modalOpened) return { success: false, reason: 'Modal 未打开' };

  const modal = page.locator('.ant-modal-content:visible');

  // 选择"本地电脑"
  await modal.locator('text=本地电脑').first().click();
  await page.waitForTimeout(1500);

  // 选择第一个在线设备
  const deviceItems = modal.locator('.ant-list-item');
  const deviceCount = await deviceItems.count();
  if (deviceCount === 0) return { success: false, reason: '没有可用设备' };

  let clicked = false;
  for (let i = 0; i < deviceCount; i++) {
    const opacity = await deviceItems.nth(i).evaluate(el => getComputedStyle(el).opacity);
    if (opacity !== '0.5') {
      await deviceItems.nth(i).click();
      clicked = true;
      break;
    }
  }
  if (!clicked) return { success: false, reason: '没有在线设备' };
  await page.waitForTimeout(500);

  // 输入工作目录
  const dirInput = modal.locator('input[type="text"]').last();
  if (await dirInput.isVisible().catch(() => false)) {
    await dirInput.clear();
    await dirInput.fill(workDir);
    await page.waitForTimeout(300);
  }

  // 点确定
  const confirmBtn = modal.getByRole('button', { name: /确.*定/ });
  const isDisabled = await confirmBtn.isDisabled().catch(() => true);
  if (isDisabled) return { success: false, reason: '确定按钮被禁用（可能工作目录为空）' };
  await confirmBtn.click();
  await page.waitForTimeout(3000);

  // 验证 AgentStatusIndicator 可见
  const indicator = page.locator('[data-testid="agent-status-indicator"]');
  const entered = await indicator.isVisible().catch(() => false);
  if (!entered) {
    await page.waitForTimeout(2000);
    const retryEntered = await indicator.isVisible().catch(() => false);
    if (!retryEntered) return { success: false, reason: '本地模式指示器未显示' };
  }

  return { success: true };
}

/**
 * 退出本地模式。
 */
export async function exitLocalMode(page: Page): Promise<boolean> {
  const indicator = page.locator('[data-testid="agent-status-indicator"]');
  const exitBtn = indicator.locator('button:has-text("退出")').first();
  if (!await exitBtn.isVisible().catch(() => false)) {
    const globalExit = page.locator('button:has-text("退出")').first();
    if (!await globalExit.isVisible().catch(() => false)) return false;
    await globalExit.click();
  } else {
    await exitBtn.click();
  }
  await page.waitForTimeout(1500);
  const still = await page.locator('[data-testid="agent-status-indicator"]').isVisible().catch(() => false);
  return !still;
}

/**
 * 检查当前是否在本地模式。
 */
export async function isInLocalMode(page: Page): Promise<boolean> {
  return await page.locator('[data-testid="agent-status-indicator"]').isVisible().catch(() => false);
}
