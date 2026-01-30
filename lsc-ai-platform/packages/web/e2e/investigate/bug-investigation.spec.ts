/**
 * BUG 调查脚本 — 只观察、截图、记录，不做任何 expect(true)
 * 按 PM 指令步骤 1 执行
 */
import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';

// ============================================================================
// BUG-1: Welcome 页（无 session）点「打开工作台」，Workbench 是否渲染？
// ============================================================================

test('BUG-1a welcome页点打开工作台', async ({ page }) => {
  await page.goto('/chat');
  await page.waitForLoadState('networkidle');

  // 确认在 welcome 页
  const welcome = page.locator('text=有什么可以帮你的');
  await expect(welcome).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: 'test-results/bug1a-step1-welcome.png' });

  // 点加号菜单
  const plusBtn = page.locator('main .anticon-plus').last();
  await plusBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/bug1a-step2-menu-open.png' });

  // 点"打开工作台"
  const workbenchItem = page.locator('.ant-dropdown-menu-item:has-text("工作台")').first();
  const menuVisible = await workbenchItem.isVisible().catch(() => false);
  console.log(`[BUG-1a] 菜单项"工作台"可见: ${menuVisible}`);

  if (menuVisible) {
    const menuText = await workbenchItem.textContent();
    console.log(`[BUG-1a] 菜单项文字: "${menuText}"`);
    await workbenchItem.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/bug1a-step3-after-click.png' });

    // 检查 workbench-container 是否出现
    const wb = page.locator('.workbench-container');
    const wbVisible = await wb.isVisible().catch(() => false);
    console.log(`[BUG-1a] welcome页 .workbench-container 可见: ${wbVisible}`);

    // 检查 store 状态
    const storeState = await page.evaluate(() => {
      // 尝试通过 zustand devtools 或 DOM 查看
      const wbEl = document.querySelector('.workbench-container');
      return {
        domExists: wbEl !== null,
        domDisplay: wbEl ? window.getComputedStyle(wbEl).display : 'N/A',
      };
    });
    console.log(`[BUG-1a] DOM 状态:`, JSON.stringify(storeState));
  } else {
    console.log(`[BUG-1a] ❌ 菜单项不可见，无法测试`);
  }

  // 结论断言 — 这里不绕过，直接断言 workbench 应该出现
  const wb = page.locator('.workbench-container');
  const wbVisible = await wb.isVisible().catch(() => false);
  // 不做 expect，只记录结论
  console.log(`[BUG-1a] 结论: welcome页打开工作台 → workbench ${wbVisible ? '渲染了' : '没渲染'}`);
});

test('BUG-1b 有session页点打开工作台（对比）', async ({ page }) => {
  await page.goto('/chat');
  await page.waitForLoadState('networkidle');

  // 先发一条消息创建 session
  const textarea = page.locator(SEL.chat.textarea);
  await textarea.fill('测试消息');
  await textarea.press('Enter');
  await page.waitForURL('**/chat/**', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/bug1b-step1-in-session.png' });

  // 点加号菜单
  const plusBtn = page.locator('main .anticon-plus').last();
  await plusBtn.click();
  await page.waitForTimeout(500);

  // 点"打开工作台"
  const workbenchItem = page.locator('.ant-dropdown-menu-item:has-text("工作台")').first();
  const menuVisible = await workbenchItem.isVisible().catch(() => false);
  console.log(`[BUG-1b] 菜单项"工作台"可见: ${menuVisible}`);

  if (menuVisible) {
    await workbenchItem.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/bug1b-step2-after-click.png' });

    const wb = page.locator('.workbench-container');
    const wbVisible = await wb.isVisible().catch(() => false);
    console.log(`[BUG-1b] 有session页 .workbench-container 可见: ${wbVisible}`);
  }

  console.log(`[BUG-1b] 结论: 有session时对比`);
});

// ============================================================================
// BUG-2: 云端模式确认后 agent store 状态
// ============================================================================

test('BUG-2 云端模式 agent store 状态', async ({ page, api }) => {
  await page.goto('/chat');
  await page.waitForLoadState('networkidle');

  // 先记录初始 store 状态
  const initialStore = await page.evaluate(() => {
    const data = localStorage.getItem('lsc-ai-agent');
    return data ? JSON.parse(data) : null;
  });
  console.log(`[BUG-2] 初始 agent store:`, JSON.stringify(initialStore));

  // 打开工作路径选择
  const plusBtn = page.locator('main .anticon-plus').last();
  await plusBtn.click();
  await page.waitForTimeout(500);

  const workdirItem = page.locator('.ant-dropdown-menu-item:has-text("选择工作路径")').first();
  if (!await workdirItem.isVisible().catch(() => false)) {
    console.log(`[BUG-2] ❌ "选择工作路径" 菜单项不可见`);
    return;
  }
  await workdirItem.click();
  await page.waitForTimeout(500);

  const modal = page.locator('.ant-modal').last();
  await expect(modal).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: 'test-results/bug2-step1-modal.png' });

  // 选择云端服务器
  await modal.locator('text=云端服务器').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/bug2-step2-cloud-selected.png' });

  // 输入工作目录
  const dirInput = modal.locator('input[type="text"]').first();
  if (await dirInput.isVisible().catch(() => false)) {
    await dirInput.fill('/workspace');
  }

  // 点确定
  const confirmBtn = modal.locator('button:has-text("确定")').first();
  await confirmBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/bug2-step3-after-confirm.png' });

  // 检查 store 状态
  const afterStore = await page.evaluate(() => {
    const data = localStorage.getItem('lsc-ai-agent');
    return data ? JSON.parse(data) : null;
  });
  console.log(`[BUG-2] 确认后 agent store:`, JSON.stringify(afterStore));
  console.log(`[BUG-2] currentDeviceId: ${afterStore?.state?.currentDeviceId || '(空)'}`);
  console.log(`[BUG-2] workDir: ${afterStore?.state?.workDir || '(空)'}`);

  // 分析
  if (!afterStore?.state?.currentDeviceId && !afterStore?.state?.workDir) {
    console.log(`[BUG-2] 结论: 云端模式确认后 store 未更新 — 需确认是设计如此还是遗漏`);
  } else {
    console.log(`[BUG-2] 结论: 云端模式确认后 store 已更新`);
  }
});

// ============================================================================
// BUG-3: M5-04 enterLocalMode() 每步调查
// ============================================================================

test('BUG-3 enterLocalMode 逐步调查', async ({ page, api }) => {
  // 先确认 Agent 在线
  let agentOnline = false;
  try {
    const res = await api.getAgents();
    if (res.ok()) {
      const agents = await res.json();
      agentOnline = Array.isArray(agents) && agents.some((a: any) => a.status === 'online');
    }
  } catch {}
  console.log(`[BUG-3] Agent 在线: ${agentOnline}`);
  if (!agentOnline) {
    console.log(`[BUG-3] ❌ Agent 不在线，无法测试`);
    return;
  }

  await page.goto('/chat');
  await page.waitForLoadState('networkidle');

  // Step 1: 点加号菜单
  const plusBtn = page.locator('main .anticon-plus').last();
  await plusBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/bug3-step1-menu.png' });

  // Step 2: 点"选择工作路径"
  const workdirItem = page.locator('.ant-dropdown-menu-item:has-text("选择工作路径")').first();
  const workdirVisible = await workdirItem.isVisible().catch(() => false);
  console.log(`[BUG-3] Step2 "选择工作路径" 可见: ${workdirVisible}`);
  if (!workdirVisible) return;
  await workdirItem.click();
  await page.waitForTimeout(500);

  // Step 3: Modal 打开了吗？
  const modal = page.locator('.ant-modal').last();
  const modalVisible = await modal.isVisible().catch(() => false);
  console.log(`[BUG-3] Step3 Modal 可见: ${modalVisible}`);
  await page.screenshot({ path: 'test-results/bug3-step3-modal.png' });
  if (!modalVisible) return;

  // Step 4: 选择"本地电脑" Radio
  const localRadio = modal.locator('text=本地电脑').first();
  const radioVisible = await localRadio.isVisible().catch(() => false);
  console.log(`[BUG-3] Step4 "本地电脑" Radio 可见: ${radioVisible}`);
  if (!radioVisible) return;
  await localRadio.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/bug3-step4-local-selected.png' });

  // Step 5: 设备列表有设备吗？
  const deviceItems = modal.locator('.ant-list-item');
  const deviceCount = await deviceItems.count();
  console.log(`[BUG-3] Step5 设备列表数量: ${deviceCount}`);

  if (deviceCount > 0) {
    const firstDeviceText = await deviceItems.first().textContent();
    console.log(`[BUG-3] Step5 第一个设备: "${firstDeviceText}"`);
  }

  // Step 6: 选设备
  if (deviceCount > 0) {
    await deviceItems.first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/bug3-step6-device-selected.png' });
  }

  // Step 7: 输入工作目录
  const dirInput = modal.locator('input[type="text"]').first();
  const dirInputVisible = await dirInput.isVisible().catch(() => false);
  console.log(`[BUG-3] Step7 工作目录输入框可见: ${dirInputVisible}`);
  if (dirInputVisible) {
    await dirInput.fill('D:\\u3d-projects\\lscmade7');
  }

  // Step 8: 点确定
  const confirmBtn = modal.locator('button:has-text("确定")').first();
  const confirmVisible = await confirmBtn.isVisible().catch(() => false);
  const confirmDisabled = await confirmBtn.isDisabled().catch(() => true);
  console.log(`[BUG-3] Step8 确定按钮可见: ${confirmVisible}, 禁用: ${confirmDisabled}`);
  await page.screenshot({ path: 'test-results/bug3-step8-before-confirm.png' });

  if (confirmVisible && !confirmDisabled) {
    await confirmBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/bug3-step9-after-confirm.png' });
  }

  // Step 9: AgentStatusIndicator 出现了吗？
  // 从代码看，它渲染条件是 currentDeviceId || workDir
  const indicator = page.locator('text=本地模式');
  const indicatorVisible = await indicator.isVisible().catch(() => false);
  console.log(`[BUG-3] Step9 "本地模式" 指示器可见: ${indicatorVisible}`);

  // Step 10: 退出按钮在哪？
  // 从代码看: <Button type="text" size="small" icon={<CloseOutlined />}>退出</Button>
  const exitBtn = page.locator('button:has-text("退出")');
  const exitCount = await exitBtn.count();
  const exitVisible = exitCount > 0 ? await exitBtn.first().isVisible().catch(() => false) : false;
  console.log(`[BUG-3] Step10 "退出"按钮数量: ${exitCount}, 可见: ${exitVisible}`);

  const switchBtn = page.locator('button:has-text("切换")');
  const switchCount = await switchBtn.count();
  const switchVisible = switchCount > 0 ? await switchBtn.first().isVisible().catch(() => false) : false;
  console.log(`[BUG-3] Step10 "切换"按钮数量: ${switchCount}, 可见: ${switchVisible}`);

  await page.screenshot({ path: 'test-results/bug3-step10-indicator.png' });

  // Step 11: 点退出
  if (exitVisible) {
    await exitBtn.first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/bug3-step11-after-exit.png' });

    const afterStore = await page.evaluate(() => {
      const data = localStorage.getItem('lsc-ai-agent');
      return data ? JSON.parse(data) : null;
    });
    console.log(`[BUG-3] Step11 退出后 store:`, JSON.stringify(afterStore?.state));
  }

  console.log(`[BUG-3] 调查完成`);
});
