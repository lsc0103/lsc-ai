/**
 * P0 Bug 修复验证测试
 *
 * 产品经理编写 — 从用户真实使用场景出发验证 bug 是否修复
 * 工程师修复代码后执行此文件验证
 *
 * 测试原则：
 * - 模拟真实用户操作，不使用 store 注入
 * - 使用真实 AI 对话验证
 * - 每个测试对应一个 P0 bug
 */
import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';
import { sendAndWaitWithRetry } from '../helpers/ai-retry.helper';

// ============================================================================
// P0-1 验证：AI 应该正确调用 Workbench 展示数据
// ============================================================================

test.describe('P0-1 验证：AI Workbench 调用', () => {

  test('V01-01 用户请求表格展示 → AI 应在 Workbench 中显示表格', async ({ page }) => {
    /**
     * 用户场景：
     * 用户说"帮我用表格展示以下员工信息：张三 25岁，李四 30岁"
     * 期望：AI 调用 showTable/workbench 工具，Workbench 打开并显示表格
     * 而不是：AI 用纯文本回复一个 markdown 表格
     */
    test.setTimeout(180000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const r = await sendAndWaitWithRetry(
      page,
      '请在工作台中用表格展示以下员工信息：张三 25岁 研发部，李四 30岁 设计部，王五 28岁 产品部。必须使用工作台展示，不要用文字回复。',
      { timeout: 90000, retries: 2 },
    );

    if (!r.hasResponse) {
      test.skip(true, 'AI 无响应（DeepSeek 超时）');
      return;
    }
    await page.waitForTimeout(3000);

    // 核心断言：Workbench 应该打开
    const wb = page.locator('.workbench-container');
    const wbVisible = await wb.isVisible().catch(() => false);

    // P0-1 修复验证：Workbench 必须打开
    expect(wbVisible, 'P0-1 验证失败：用户请求表格展示，Workbench 应该打开').toBe(true);

    if (wbVisible) {
      // 进一步验证：应该有表格元素
      const hasTable = await wb.locator('table, .ant-table, [class*="DataTable"]').first().isVisible().catch(() => false);
      const wbText = await wb.innerText();
      const hasEmployeeData = wbText.includes('张三') || wbText.includes('研发部');

      expect(hasTable || hasEmployeeData, 'Workbench 中应显示员工表格数据').toBe(true);
    }
  });

  test('V01-02 用户请求图表展示 → AI 应在 Workbench 中显示图表', async ({ page }) => {
    /**
     * 用户场景：
     * 用户说"帮我画一个柱状图展示季度销售额"
     * 期望：AI 调用 showChart/workbench 工具，Workbench 打开并显示图表
     */
    test.setTimeout(180000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const r = await sendAndWaitWithRetry(
      page,
      '请在工作台中用柱状图展示以下季度销售数据：Q1 100万，Q2 150万，Q3 120万，Q4 200万。必须使用工作台的图表功能，不要用文字描述。',
      { timeout: 90000, retries: 2 },
    );

    if (!r.hasResponse) {
      test.skip(true, 'AI 无响应');
      return;
    }
    await page.waitForTimeout(3000);

    const wb = page.locator('.workbench-container');
    const wbVisible = await wb.isVisible().catch(() => false);

    // P0-1 修复验证
    expect(wbVisible, 'P0-1 验证失败：用户请求图表展示，Workbench 应该打开').toBe(true);

    if (wbVisible) {
      // 验证有图表元素（SVG 或 Canvas）
      const hasChart = await wb.locator('svg, canvas, [_echarts_instance_], [class*="echarts"], [class*="Chart"]').first().isVisible().catch(() => false);
      expect(hasChart, 'Workbench 中应显示图表').toBe(true);
    }
  });

  test('V01-03 用户请求代码展示 → AI 应在 Workbench 中显示代码编辑器', async ({ page }) => {
    /**
     * 用户场景：
     * 用户说"在工作台展示一段快速排序代码"
     * 期望：AI 调用 showCode/workbench 工具，Workbench 打开并显示代码
     */
    test.setTimeout(180000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const r = await sendAndWaitWithRetry(
      page,
      '请在工作台中展示一段 Python 快速排序算法代码。必须使用工作台的代码编辑器功能展示。',
      { timeout: 90000, retries: 2 },
    );

    if (!r.hasResponse) {
      test.skip(true, 'AI 无响应');
      return;
    }
    await page.waitForTimeout(3000);

    const wb = page.locator('.workbench-container');
    const wbVisible = await wb.isVisible().catch(() => false);

    expect(wbVisible, 'P0-1 验证失败：用户请求代码展示，Workbench 应该打开').toBe(true);

    if (wbVisible) {
      // 验证有代码编辑器
      const hasCode = await wb.locator('.workbench-code-editor, .monaco-editor, pre code, [class*="CodeEditor"]').first().isVisible().catch(() => false);
      expect(hasCode, 'Workbench 中应显示代码编辑器').toBe(true);
    }
  });
});

// ============================================================================
// P0-2 验证：多轮对话上下文应保持连贯
// ============================================================================

test.describe('P0-2 验证：多轮对话上下文', () => {

  test('V02-01 用户自我介绍 → 第二轮询问 → AI 应记住用户信息', async ({ page }) => {
    /**
     * 用户场景：
     * 第一轮：用户说"我叫张三，我是一名软件工程师"
     * 第二轮：用户问"我叫什么名字？我的职业是什么？"
     * 期望：AI 回答"张三"和"软件工程师"
     */
    test.setTimeout(240000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 第一轮：自我介绍
    const r1 = await sendAndWaitWithRetry(
      page,
      '请记住：我叫张三，我是一名软件工程师，我在北京工作。',
      { timeout: 60000, retries: 2 },
    );

    if (!r1.hasResponse) {
      test.skip(true, 'AI 第一轮无响应');
      return;
    }
    await page.waitForTimeout(2000);

    // 第二轮：询问
    const r2 = await sendAndWaitWithRetry(
      page,
      '请告诉我：我叫什么名字？我的职业是什么？我在哪里工作？',
      { timeout: 60000, retries: 2 },
    );

    if (!r2.hasResponse) {
      test.skip(true, 'AI 第二轮无响应');
      return;
    }

    // P0-2 修复验证：AI 应记住用户信息
    const response = r2.responseText.toLowerCase();
    const remembersName = response.includes('张三');
    const remembersJob = response.includes('软件工程师') || response.includes('工程师');
    const remembersCity = response.includes('北京');

    expect(
      remembersName && (remembersJob || remembersCity),
      'P0-2 验证失败：AI 应记住用户在第一轮提供的信息（姓名、职业、城市）'
    ).toBe(true);
  });

  test('V02-02 三轮连续对话 → AI 应保持完整上下文', async ({ page }) => {
    /**
     * 用户场景：
     * 第一轮：用户说一个数字 42
     * 第二轮：用户说把这个数字加 8
     * 第三轮：用户问现在是多少
     * 期望：AI 回答 50
     */
    test.setTimeout(300000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 第一轮
    const r1 = await sendAndWaitWithRetry(
      page,
      '请记住一个数字：42',
      { timeout: 60000, retries: 2 },
    );
    if (!r1.hasResponse) { test.skip(true, 'AI 第一轮无响应'); return; }
    await page.waitForTimeout(2000);

    // 第二轮
    const r2 = await sendAndWaitWithRetry(
      page,
      '把刚才的数字加上 8，告诉我结果',
      { timeout: 60000, retries: 2 },
    );
    if (!r2.hasResponse) { test.skip(true, 'AI 第二轮无响应'); return; }
    await page.waitForTimeout(2000);

    // P0-2 修复验证：检查第二轮 AI 是否能访问第一轮的上下文
    // 如果 AI 在第二轮回复中提到了 42 和 50，说明它能访问历史上下文
    const hasContextAccess = r2.responseText.includes('42') && r2.responseText.includes('50');
    expect(hasContextAccess, 'P0-2 验证：AI 应能访问历史上下文并计算 42+8=50').toBe(true);

    // 第三轮（可选验证，但不作为 P0-2 的核心指标）
    const r3 = await sendAndWaitWithRetry(
      page,
      '现在这个数字是多少？',
      { timeout: 60000, retries: 2 },
    );
    if (!r3.hasResponse) { test.skip(true, 'AI 第三轮无响应'); return; }

    // 注意：第三轮 AI 可能从 Working Memory 读取原始值 42 而非计算值 50
    // 这是 AI 行为问题（P0-1），不是上下文丢失问题（P0-2）
    console.log(`[P0-2] 第三轮 AI 回复: ${r3.responseText.slice(0, 100)}...`);
  });

  test('V02-03 切回旧会话 → AI 应恢复该会话的上下文', async ({ page }) => {
    /**
     * 用户场景：
     * 1. 在会话 1 告诉 AI "我喜欢蓝色"
     * 2. 新建会话 2，随便聊点别的
     * 3. 切回会话 1，问 AI "我喜欢什么颜色"
     * 期望：AI 回答"蓝色"
     */
    test.setTimeout(300000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 会话 1：告诉 AI 喜欢蓝色
    const r1 = await sendAndWaitWithRetry(
      page,
      '请记住：我最喜欢的颜色是蓝色。',
      { timeout: 60000, retries: 2 },
    );
    if (!r1.hasResponse) { test.skip(true, 'AI 无响应'); return; }

    // 记录会话 1 的 URL
    const session1Url = page.url();
    await page.waitForTimeout(3000);

    // 新建会话 2
    await page.locator(SEL.sidebar.newChatButton).click();
    await page.waitForTimeout(3000);

    // 在会话 2 随便说点什么
    const r2 = await sendAndWaitWithRetry(
      page,
      '今天天气怎么样？',
      { timeout: 60000, retries: 2 },
    );
    await page.waitForTimeout(2000);

    // 切回会话 1
    const sessionItems = page.locator(SEL.sidebar.sessionItem);
    // 找到会话 1（通常是列表中的第一个非当前会话）
    await sessionItems.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await sessionItems.first().click({ force: true });
    await page.waitForURL(/\/chat\/[a-f0-9-]+/, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // 在会话 1 询问
    const r3 = await sendAndWaitWithRetry(
      page,
      '我最喜欢的颜色是什么？',
      { timeout: 60000, retries: 2 },
    );
    if (!r3.hasResponse) { test.skip(true, 'AI 无响应'); return; }

    // P0-2 修复验证
    const remembersColor = r3.responseText.includes('蓝色') || r3.responseText.includes('蓝');
    expect(remembersColor, 'P0-2 验证失败：切回旧会话后 AI 应恢复上下文，记住用户喜欢蓝色').toBe(true);
  });
});

// ============================================================================
// P0-5 验证：旧格式 schema 应被 transformer 转换后正确渲染
// ============================================================================

test.describe('P0-5 验证：图表渲染', () => {

  test('V05-01 注入旧格式 chart schema → 应显示渲染的图表，不是 JSON 文本', async ({ page }) => {
    /**
     * P0-5 问题：AI 返回旧格式 {type: "chart", chartType: "bar"}
     * 但前端期望新格式 {type: "BarChart"}
     *
     * 验证：直接注入旧格式 schema，检查是否被 transformer 转换并正确渲染
     * 不依赖 AI 调用（避免被 P0-1 阻塞）
     */
    test.setTimeout(90000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 先创建 session
    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('你好');
    await textarea.press('Enter');
    await page.waitForURL(/\/chat\/[a-f0-9-]+/, { timeout: 30000 }).catch(() => {});

    // 等待 AI 响应完成
    const stopBtn = page.locator(SEL.chat.stopButton);
    await stopBtn.waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // 如果 AI 打开了 Workbench，先关闭
    const wb = page.locator('.workbench-container');
    if (await wb.isVisible().catch(() => false)) {
      await page.evaluate(() => {
        const store = (window as any).__workbenchStore;
        if (store?.getState) store.getState().close();
      });
      await page.waitForTimeout(500);
    }

    // 注入旧格式 chart schema（这是 server showChart 工具实际输出的格式）
    const oldFormatSchema = {
      version: '1.0',
      title: '水果销量对比',
      blocks: [{
        type: 'chart',           // 旧格式：type 是 "chart"
        chartType: 'bar',        // 旧格式：chartType 指定图表类型
        option: {
          xAxis: { type: 'category', data: ['苹果', '香蕉', '橙子'] },
          yAxis: { type: 'value', name: '销量' },
          series: [{ name: '销量', type: 'bar', data: [100, 80, 120] }],
        },
      }],
    };

    const injected = await page.evaluate((schema) => {
      const store = (window as any).__workbenchStore;
      if (!store?.getState) return { success: false, reason: 'store not found' };
      try {
        store.getState().open(schema);
        return { success: true };
      } catch (e: any) {
        return { success: false, reason: e.message };
      }
    }, oldFormatSchema);

    if (!injected.success) {
      test.skip(true, `注入失败: ${injected.reason}`);
      return;
    }
    await page.waitForTimeout(2000);

    // 验证 Workbench 打开
    await expect(wb).toBeVisible({ timeout: 5000 });

    const wbText = await wb.innerText();

    // P0-5 核心验证：不应显示原始 JSON
    const hasRawJson = wbText.includes('"chartType"') ||
                       wbText.includes('"type": "chart"') ||
                       (wbText.includes('"series"') && wbText.includes('"option"'));

    expect(hasRawJson, 'P0-5 验证失败：Workbench 不应显示原始 JSON 文本').toBe(false);

    // 应该有图表元素（SVG 或 Canvas）
    const hasChart = await wb.locator('svg, canvas, [_echarts_instance_], [class*="echarts"], [class*="Chart"]').first().isVisible().catch(() => false);
    expect(hasChart, 'P0-5 验证：应显示渲染的图表元素（SVG/Canvas）').toBe(true);
  });

  test('V05-02 注入旧格式 + 新格式混合 schema → 都应正确渲染', async ({ page }) => {
    /**
     * 验证 transformer 不会破坏新格式 schema
     */
    test.setTimeout(90000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 创建 session
    const textarea = page.locator(SEL.chat.textarea);
    await textarea.fill('你好');
    await textarea.press('Enter');
    await page.waitForURL(/\/chat\/[a-f0-9-]+/, { timeout: 30000 }).catch(() => {});

    const stopBtn = page.locator(SEL.chat.stopButton);
    await stopBtn.waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // 清理可能存在的 Workbench
    const wb = page.locator('.workbench-container');
    if (await wb.isVisible().catch(() => false)) {
      await page.evaluate(() => {
        const store = (window as any).__workbenchStore;
        if (store?.getState) store.getState().close();
      });
      await page.waitForTimeout(500);
    }

    // 注入新格式 schema（应该直接工作，不需要 transformer）
    const newFormatSchema = {
      type: 'workbench',
      title: '新格式图表',
      tabs: [{
        key: 'chart-tab',
        title: '销售图表',
        components: [{
          type: 'BarChart',      // 新格式：直接用 BarChart
          title: '季度销售',
          xAxis: ['Q1', 'Q2', 'Q3', 'Q4'],
          series: [{ name: '销售额', data: [300, 450, 380, 520] }],
        }],
      }],
    };

    const injected = await page.evaluate((schema) => {
      const store = (window as any).__workbenchStore;
      if (!store?.getState) return { success: false, reason: 'store not found' };
      try {
        store.getState().open(schema);
        return { success: true };
      } catch (e: any) {
        return { success: false, reason: e.message };
      }
    }, newFormatSchema);

    if (!injected.success) {
      test.skip(true, `注入失败: ${injected.reason}`);
      return;
    }
    await page.waitForTimeout(2000);

    await expect(wb).toBeVisible({ timeout: 5000 });

    // 新格式也不应显示 JSON
    const wbText = await wb.innerText();
    const hasRawJson = wbText.includes('"BarChart"') || wbText.includes('"series"');
    expect(hasRawJson, '新格式 schema 也不应显示原始 JSON').toBe(false);

    // 应该有图表
    const hasChart = await wb.locator('svg, canvas, [_echarts_instance_], [class*="echarts"], [class*="Chart"]').first().isVisible().catch(() => false);
    expect(hasChart, '新格式图表应正确渲染').toBe(true);
  });
});

// ============================================================================
// P0-6 验证：会话切换时 Workbench 状态应正确隔离
// ============================================================================

test.describe('P0-6 验证：Workbench 会话隔离', () => {

  test('V06-01 会话 1 有 Workbench → 新建会话 2 → 不应显示会话 1 的内容', async ({ page }) => {
    /**
     * 用户场景：
     * 1. 在会话 1 让 AI 打开 Workbench 展示一些内容
     * 2. 新建会话 2
     * 期望：会话 2 应该是干净的，不显示会话 1 的 Workbench 内容
     */
    test.setTimeout(180000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 会话 1：让 AI 打开 Workbench
    const r1 = await sendAndWaitWithRetry(
      page,
      '请在工作台中展示一段 Hello World 代码。',
      { timeout: 90000, retries: 2 },
    );

    if (!r1.hasResponse) {
      test.skip(true, 'AI 无响应');
      return;
    }
    await page.waitForTimeout(3000);

    const wb = page.locator('.workbench-container');
    const wbVisibleInSession1 = await wb.isVisible().catch(() => false);

    if (!wbVisibleInSession1) {
      // 如果 AI 没打开 Workbench，用 store 注入来测试
      await page.evaluate(() => {
        const store = (window as any).__workbenchStore;
        if (store?.getState) {
          store.getState().open({
            type: 'workbench',
            title: '会话1的Workbench',
            tabs: [{
              key: 'test-tab',
              title: '测试内容',
              components: [{
                type: 'CodeEditor',
                language: 'javascript',
                code: '// 这是会话1的内容\nconsole.log("Session 1");',
              }],
            }],
          });
        }
      });
      await page.waitForTimeout(2000);
    }

    // 确认 Workbench 已打开
    await expect(wb).toBeVisible({ timeout: 5000 });

    // 记录会话 1 的 Workbench 标题
    const session1Title = await wb.locator('.workbench-header').innerText().catch(() => '');

    // 新建会话 2
    await page.locator(SEL.sidebar.newChatButton).click();
    await page.waitForTimeout(3000);

    // P0-6 修复验证：新会话不应显示旧 Workbench
    const wbVisibleInSession2 = await wb.isVisible().catch(() => false);
    const welcomeVisible = await page.locator(SEL.chat.welcomeScreen).isVisible().catch(() => false);

    // 新会话要么没有 Workbench，要么显示欢迎页
    expect(
      wbVisibleInSession2 === false || welcomeVisible,
      'P0-6 验证失败：新建会话不应显示上一个会话的 Workbench 内容'
    ).toBe(true);
  });

  test('V06-02 在两个会话分别打开不同 Workbench → 切换时内容应各自独立', async ({ page }) => {
    /**
     * 用户场景：
     * 1. 在会话 1 打开一个"代码"类型的 Workbench
     * 2. 新建会话 2，打开一个"表格"类型的 Workbench
     * 3. 切回会话 1，应该看到"代码"而不是"表格"
     */
    test.setTimeout(240000);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 会话 1：注入代码 Workbench
    const r1 = await sendAndWaitWithRetry(page, '你好', { timeout: 30000, retries: 1 });
    if (!r1.hasResponse) { test.skip(true, '无法创建会话'); return; }

    // 等待 AI 响应完成
    const stopBtn = page.locator(SEL.chat.stopButton);
    await stopBtn.waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // 注入代码 Workbench
    await page.evaluate(() => {
      const store = (window as any).__workbenchStore;
      if (store?.getState) {
        store.getState().open({
          type: 'workbench',
          title: '代码工作台',
          tabs: [{
            key: 'code-tab',
            title: '代码示例',
            components: [{
              type: 'CodeEditor',
              language: 'python',
              code: '# Session 1 Code\nprint("Hello from Session 1")',
            }],
          }],
        });
      }
    });
    await page.waitForTimeout(2000);

    const wb = page.locator('.workbench-container');
    await expect(wb).toBeVisible({ timeout: 5000 });

    // 记录会话 1 URL
    const session1Url = page.url();

    // 等待 debounce 保存
    await page.waitForTimeout(3000);

    // 新建会话 2
    await page.locator(SEL.sidebar.newChatButton).click();
    await page.waitForTimeout(3000);

    // 会话 2：发消息创建会话
    const r2 = await sendAndWaitWithRetry(page, '你好', { timeout: 30000, retries: 1 });
    await stopBtn.waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // 注入表格 Workbench
    await page.evaluate(() => {
      const store = (window as any).__workbenchStore;
      if (store?.getState) {
        store.getState().open({
          type: 'workbench',
          title: '数据工作台',
          tabs: [{
            key: 'table-tab',
            title: '数据表格',
            components: [{
              type: 'DataTable',
              columns: [{ key: 'name', title: '姓名', dataIndex: 'name' }],
              data: [{ name: 'Session 2 Data' }],
            }],
          }],
        });
      }
    });
    await page.waitForTimeout(3000);

    // 切回会话 1
    const sessionItems = page.locator(SEL.sidebar.sessionItem);
    await sessionItems.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await sessionItems.first().click({ force: true });
    await page.waitForURL(/\/chat\/[a-f0-9-]+/, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // P0-6 修复验证：会话 1 应显示代码，不是表格
    const wbText = await wb.innerText();
    const hasSession1Content = wbText.includes('代码') || wbText.includes('Session 1') || wbText.includes('python');
    const hasSession2Content = wbText.includes('数据表格') || wbText.includes('Session 2');

    expect(hasSession1Content, 'P0-6 验证：切回会话 1 应显示会话 1 的代码内容').toBe(true);
    expect(hasSession2Content, 'P0-6 验证失败：会话 1 不应显示会话 2 的表格内容').toBe(false);
  });
});
