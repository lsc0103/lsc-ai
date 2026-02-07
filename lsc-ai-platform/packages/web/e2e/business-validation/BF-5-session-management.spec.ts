/**
 * BF-5：会话管理与记忆 — 数据采集
 *
 * 用户故事：用户在多个项目之间切换，需要每个会话独立、历史可恢复。
 * 通过标准：6/6（由 PM 判定）
 */
import { test, expect } from '../fixtures/test-base';
import { BFCollector } from './bf-collector';
import { SEL } from '../helpers/selectors';

test.describe.serial('BF-5 会话管理与记忆', () => {
  test('BF-5 数据采集', async ({ page }) => {
    test.setTimeout(600_000);
    const collector = new BFCollector(page, 'BF-5', '会话管理与记忆');

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // ==================== BF-5.1 新建会话，发送记忆请求 ====================
    {
      await collector.sendAndCollect(
        'BF-5.1',
        '记住：我的项目叫海运数据分析',
        { timeout: 60_000 },
      );
    }

    // 记录第一个会话的 URL
    const session1Url = page.url();
    const session1Id = session1Url.match(/\/chat\/([a-f0-9-]+)/)?.[1] || '';
    console.log(`[BF-5] 会话1 URL: ${session1Url}, ID: ${session1Id}`);

    await page.waitForTimeout(10_000);

    // ==================== BF-5.2 新建第二个会话，测试隔离 ====================
    {
      // 点击新建会话
      const newChatBtn = page.locator(SEL.sidebar.newChatButton);
      await newChatBtn.click();
      await page.waitForTimeout(3000);

      await collector.sendAndCollect(
        'BF-5.2',
        '我的项目叫什么？',
        {
          timeout: 60_000,
          notes: '会话隔离测试：AI 应该不知道"海运数据分析"',
        },
      );
    }

    // 记录第二个会话的 URL
    const session2Url = page.url();
    const session2Id = session2Url.match(/\/chat\/([a-f0-9-]+)/)?.[1] || '';
    console.log(`[BF-5] 会话2 URL: ${session2Url}, ID: ${session2Id}`);

    await page.waitForTimeout(10_000);

    // ==================== BF-5.3 切回第一个会话 ====================
    {
      // 在侧边栏找到第一个会话并点击
      if (session1Id) {
        // 尝试通过侧边栏会话列表点击
        const sessionItems = page.locator(SEL.sidebar.sessionItem);
        const count = await sessionItems.count();
        let clicked = false;

        for (let i = 0; i < count; i++) {
          const item = sessionItems.nth(i);
          const text = await item.textContent().catch(() => '');
          // 第一个会话可能包含"海运"或"记住"等关键字
          if (text && (text.includes('海运') || text.includes('记住'))) {
            await item.click();
            clicked = true;
            break;
          }
        }

        // 如果没找到，直接导航
        if (!clicked) {
          await page.goto(`/chat/${session1Id}`);
        }

        await page.waitForTimeout(3000);
      }

      await collector.sendAndCollect(
        'BF-5.3',
        '我的项目叫什么？',
        {
          timeout: 60_000,
          notes: '上下文恢复测试：AI 应该回答"海运数据分析"',
        },
      );
    }

    await page.waitForTimeout(5_000);

    // ==================== BF-5.4 刷新页面 ====================
    {
      const messagesBeforeRefresh = await page.locator('main .message-bubble').count().catch(() => 0);

      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(5000);

      const messagesAfterRefresh = await page.locator('main .message-bubble').count().catch(() => 0);

      await collector.collectUIStep(
        'BF-5.4',
        '刷新页面，检查历史保留',
        messagesAfterRefresh > 0 ? '✅' : '❌',
        `刷新前消息数=${messagesBeforeRefresh}, 刷新后消息数=${messagesAfterRefresh}`,
      );
    }

    // ==================== BF-5.5 删除第二个会话 ====================
    {
      // 确保侧边栏可见
      const sessionItems = page.locator(SEL.sidebar.sessionItem);
      const countBefore = await sessionItems.count();

      // 找到第二个会话并右键删除
      let deleted = false;
      for (let i = 0; i < countBefore; i++) {
        const item = sessionItems.nth(i);
        const text = await item.textContent().catch(() => '');
        // 第二个会话不包含"海运"
        if (text && !text.includes('海运') && !text.includes('记住')) {
          await item.click({ button: 'right' });
          await page.waitForTimeout(500);

          const deleteBtn = page.locator('.ant-dropdown-menu-item:has-text("删除")').first();
          if (await deleteBtn.isVisible().catch(() => false)) {
            await deleteBtn.click();
            await page.waitForTimeout(500);

            // 确认删除
            const confirmBtn = page.locator('.ant-popconfirm-buttons .ant-btn-primary, .ant-modal-confirm-btns .ant-btn-primary, button:has-text("确")').first();
            if (await confirmBtn.isVisible().catch(() => false)) {
              await confirmBtn.click();
            }
            deleted = true;
            break;
          }
        }
      }

      await page.waitForTimeout(3000);
      const countAfter = await sessionItems.count();

      // 检查第一个会话是否正常
      const currentUrl = page.url();
      const firstSessionOk = currentUrl.includes(session1Id) ||
        await page.locator('main .message-bubble').count().then(c => c > 0).catch(() => false);

      await collector.collectUIStep(
        'BF-5.5',
        '删除第二个会话',
        deleted ? '✅' : '⚠️',
        `删除操作=${deleted ? '成功' : '未找到删除入口'}, 会话数: ${countBefore} → ${countAfter}, 第一个会话正常=${firstSessionOk}`,
      );
    }

    // ==================== BF-5.6 连续创建 5 个会话 ====================
    {
      const newChatBtn = page.locator(SEL.sidebar.newChatButton);
      const sessionsBefore = await page.locator(SEL.sidebar.sessionItem).count();
      let createdCount = 0;

      for (let i = 0; i < 5; i++) {
        await newChatBtn.click();
        await page.waitForTimeout(2000);

        // 检查是否在新会话（欢迎页或空聊天）
        const isNew = await page.locator('text=有什么可以帮你的').isVisible().catch(() => false) ||
          page.url().includes('/chat') && !page.url().includes(session1Id);

        if (isNew) createdCount++;
      }

      const sessionsAfter = await page.locator(SEL.sidebar.sessionItem).count();

      await collector.collectUIStep(
        'BF-5.6',
        '连续创建 5 个会话',
        createdCount >= 4 ? '✅' : (createdCount >= 2 ? '⚠️' : '❌'),
        `创建了 ${createdCount}/5 个新会话, 侧边栏会话数: ${sessionsBefore} → ${sessionsAfter}`,
      );
    }

    // ==================== 保存报告 ====================
    collector.saveReport();
  });
});
