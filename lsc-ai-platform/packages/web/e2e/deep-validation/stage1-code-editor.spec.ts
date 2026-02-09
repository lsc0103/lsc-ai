/**
 * Stage 1 - CodeEditor 深度验收测试 (H1-5 ~ H1-7)
 *
 * H1-5: Monaco 编辑器完整渲染
 * H1-6: 编辑代码后切换 Tab 再切回内容保留
 * H1-7: 打开 3+ 个文件 Tab 间切换内容不串
 */
import { test, expect } from '../fixtures/test-base';
import { SEL } from '../helpers/selectors';
import { ensureSession, injectSchema, clearWorkbench } from '../helpers/workbench.helper';
import { waitForAIComplete } from '../helpers/ai-retry.helper';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const screenshotDir = path.resolve(__dirname, '../../bf-reports/deep-validation/screenshots');
fs.mkdirSync(screenshotDir, { recursive: true });

// ============================================================================
// Schema definitions
// ============================================================================

/** H1-5: Single TypeScript CodeEditor tab */
const TYPESCRIPT_CODE_SCHEMA = {
  type: 'workbench',
  title: 'TypeScript 代码',
  tabs: [
    {
      key: 'ts-file',
      title: 'app.ts',
      components: [{
        type: 'CodeEditor',
        language: 'typescript',
        code: [
          'interface User {',
          '  id: number;',
          '  name: string;',
          '  email: string;',
          '}',
          '',
          'function getUser(id: number): User {',
          '  return { id, name: "Alice", email: "alice@example.com" };',
          '}',
          '',
          'const user: User = getUser(1);',
          'console.log(user.name);',
        ].join('\n'),
        readOnly: false,
      }],
    },
  ],
};

/** H1-6: Two-tab schema for edit-switch-switch-back test */
const EDIT_SWITCH_SCHEMA = {
  type: 'workbench',
  title: '编辑切换测试',
  tabs: [
    {
      key: 'edit-code',
      title: 'main.ts',
      components: [{
        type: 'CodeEditor',
        language: 'typescript',
        code: [
          'const greeting = "Hello World";',
          'console.log(greeting);',
        ].join('\n'),
        readOnly: false,
      }],
    },
    {
      key: 'edit-table',
      title: '数据表',
      components: [{
        type: 'DataTable',
        columns: [
          { key: 'name', title: '姓名', dataIndex: 'name' },
          { key: 'role', title: '角色', dataIndex: 'role' },
        ],
        data: [
          { name: '张三', role: '开发' },
          { name: '李四', role: '测试' },
        ],
      }],
    },
  ],
};

/** H1-7: Four-tab schema with different languages */
const MULTI_FILE_SCHEMA = {
  type: 'workbench',
  title: '多文件项目',
  tabs: [
    {
      key: 'file-ts',
      title: 'index.ts',
      components: [{
        type: 'CodeEditor',
        language: 'typescript',
        code: [
          'import express from "express";',
          'const app = express();',
          'app.get("/", (req, res) => res.send("OK"));',
          'app.listen(3000);',
        ].join('\n'),
        readOnly: false,
      }],
    },
    {
      key: 'file-py',
      title: 'utils.py',
      components: [{
        type: 'CodeEditor',
        language: 'python',
        code: [
          'def fibonacci(n: int) -> int:',
          '    if n <= 1:',
          '        return n',
          '    return fibonacci(n - 1) + fibonacci(n - 2)',
          '',
          'print(fibonacci(10))',
        ].join('\n'),
        readOnly: false,
      }],
    },
    {
      key: 'file-json',
      title: 'config.json',
      components: [{
        type: 'CodeEditor',
        language: 'json',
        code: JSON.stringify({
          name: 'my-app',
          version: '1.0.0',
          dependencies: { express: '^4.18.0' },
        }, null, 2),
        readOnly: false,
      }],
    },
    {
      key: 'file-sql',
      title: 'query.sql',
      components: [{
        type: 'CodeEditor',
        language: 'sql',
        code: [
          'SELECT u.id, u.name, COUNT(o.id) AS order_count',
          'FROM users u',
          'LEFT JOIN orders o ON u.id = o.user_id',
          'WHERE u.created_at > NOW() - INTERVAL 30 DAY',
          'GROUP BY u.id, u.name',
          'ORDER BY order_count DESC;',
        ].join('\n'),
        readOnly: false,
      }],
    },
  ],
};

// ============================================================================
// Helpers
// ============================================================================

/** Normalize Monaco textContent (replaces \u00a0 non-breaking spaces with regular spaces) */
function normalizeMonacoText(text: string): string {
  return text.replace(/\u00a0/g, ' ');
}

/** Read Monaco editor content as normalized plain text */
async function readMonacoContent(page: import('@playwright/test').Page): Promise<string> {
  const raw = await page.locator('.monaco-editor').first().evaluate((el) => {
    const lines = el.querySelectorAll('.view-line');
    return Array.from(lines).map(l => l.textContent || '').join('\n');
  });
  return normalizeMonacoText(raw);
}

/** Wait for Monaco editor to fully load inside a container */
async function waitForMonaco(page: import('@playwright/test').Page, timeout = 15000) {
  // Wait for any loading indicator to disappear
  await page.locator('text=加载编辑器').waitFor({ state: 'hidden', timeout }).catch(() => {});
  // Wait for Monaco DOM to appear
  const monaco = page.locator('.monaco-editor').first();
  await monaco.waitFor({ state: 'visible', timeout });
  return monaco;
}

/** Wait for Monaco content to contain a specific marker after tab switch */
async function waitForMonacoWithContent(
  page: import('@playwright/test').Page,
  marker: string,
  timeout = 15000,
) {
  // Wait for animation to settle + Monaco to render content with the marker
  await page.waitForFunction(
    ({ marker: m }) => {
      const editors = document.querySelectorAll('.monaco-editor');
      if (editors.length === 0) return false;
      const editor = editors[0];
      const lines = editor.querySelectorAll('.view-line');
      if (lines.length === 0) return false;
      const text = Array.from(lines).map(l => (l.textContent || '').replace(/\u00a0/g, ' ')).join('\n');
      return text.includes(m);
    },
    { marker },
    { timeout },
  );
}

// ============================================================================
// Tests
// ============================================================================

test.describe('H1 CodeEditor: Monaco 编辑器深度验证', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    await ensureSession(page);
    await waitForAIComplete(page, 30_000);
    await clearWorkbench(page);
  });

  // --------------------------------------------------------------------------
  // H1-5: Monaco 编辑器完整渲染
  // --------------------------------------------------------------------------
  test('H1-5 Monaco 编辑器完整渲染 — TypeScript 语法高亮 + 行号 + 语言标签', async ({ page }) => {
    test.setTimeout(60_000);

    // Inject TypeScript code schema
    const result = await injectSchema(page, TYPESCRIPT_CODE_SCHEMA);
    expect(result.success, `Schema inject should succeed: ${result.reason}`).toBeTruthy();

    // Wait for Workbench container
    const wb = page.locator(SEL.workbench.container);
    await expect(wb).toBeVisible({ timeout: 5000 });

    // Wait for Monaco to load
    const monaco = await waitForMonaco(page);

    // 1. Monaco editor is visible
    await expect(monaco, 'Monaco editor should be visible').toBeVisible();

    // 2. Has line numbers
    const lineNumbers = monaco.locator('.line-numbers, .margin-view-overlays .line-numbers');
    const lineCount = await lineNumbers.count();
    expect(lineCount, 'Should have line numbers rendered').toBeGreaterThanOrEqual(1);

    // 3. Has syntax highlighting (tokenized spans with specific classes)
    const hasTokenization = await monaco.evaluate((el) => {
      // Monaco renders tokens as spans with mtk* classes
      const tokens = el.querySelectorAll('[class*="mtk"]');
      return tokens.length > 0;
    });
    expect(hasTokenization, 'Monaco should have syntax highlighting (mtk* tokens)').toBe(true);

    // 4. Language label shows "typescript" in the toolbar
    const toolbar = wb.locator('.workbench-code-editor').first();
    const langLabel = toolbar.locator('text=typescript');
    await expect(langLabel, 'Language label should show "typescript"').toBeVisible({ timeout: 3000 });

    // 5. Code content is present (verify actual code text is rendered)
    const editorContent = await monaco.evaluate((el) => {
      const lines = el.querySelectorAll('.view-line');
      return Array.from(lines).map(l => l.textContent).join('\n');
    });
    expect(editorContent, 'Editor should contain "interface User"').toContain('interface');
    expect(editorContent, 'Editor should contain "function"').toContain('function');

    // Screenshot
    await page.screenshot({
      path: path.join(screenshotDir, 'H1-05.png'),
      fullPage: true,
    });
  });

  // --------------------------------------------------------------------------
  // H1-6: 编辑代码后切换 Tab 再切回内容保留
  // --------------------------------------------------------------------------
  test('H1-6 编辑代码后切换 Tab 再切回 — 内容保留', async ({ page }) => {
    test.setTimeout(60_000);

    // Inject two-tab schema (first tab is editable CodeEditor)
    const result = await injectSchema(page, EDIT_SWITCH_SCHEMA);
    expect(result.success, `Schema inject should succeed: ${result.reason}`).toBeTruthy();

    const wb = page.locator(SEL.workbench.container);
    await expect(wb).toBeVisible({ timeout: 5000 });

    const tabs = page.locator(SEL.workbench.tab);
    await expect(tabs).toHaveCount(2, { timeout: 5000 });

    // Ensure first tab is active (click it)
    await tabs.nth(0).click();

    // Wait for Monaco to load
    const monaco = await waitForMonaco(page);
    await expect(monaco).toBeVisible();

    // Screenshot: before editing
    await page.screenshot({
      path: path.join(screenshotDir, 'H1-06-before.png'),
      fullPage: true,
    });

    // Edit: type a new comment line into the editor
    // Click on the Monaco editor to focus it
    await monaco.click();
    // Move to end of document and add a comment
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('// This is a test comment added by H1-6', { delay: 20 });

    // Wait for the edit to register in Monaco
    await page.waitForTimeout(500);

    // Verify the comment appears in the editor (Monaco uses \u00a0 for spaces)
    const contentAfterEdit = await readMonacoContent(page);
    expect(contentAfterEdit, 'Edited content should contain the test comment').toContain('test comment');

    // Switch to the second tab (DataTable)
    await tabs.nth(1).click();
    await page.waitForTimeout(500);

    // Verify we are on the table tab
    const tableContent = wb.locator(SEL.workbench.dataTable).first();
    const tableOrText = await tableContent.isVisible().catch(() => false) ||
      (await page.locator(SEL.workbench.content).innerText()).includes('张三');
    expect(tableOrText, 'Second tab should show table content').toBeTruthy();

    // Switch back to the first tab
    await tabs.nth(0).click();

    // Wait for Monaco to re-render — edited content should be preserved
    // (CodeEditor now reads from componentStates[schema.id] on remount)
    await waitForMonacoWithContent(page, 'test comment', 15000);

    // Verify BOTH original code AND edited content are preserved after tab switch
    const contentAfterReturn = await readMonacoContent(page);
    expect(contentAfterReturn, 'Edited content should be preserved after tab switch').toContain('test comment');
    expect(contentAfterReturn, 'Original code should still be present').toContain('greeting');
    expect(contentAfterReturn, 'Original code should contain console.log').toContain('console');

    // Screenshot: after switching back
    await page.screenshot({
      path: path.join(screenshotDir, 'H1-06-after.png'),
      fullPage: true,
    });
  });

  // --------------------------------------------------------------------------
  // H1-7: 打开 3+ 个文件 Tab 间切换内容不串
  // --------------------------------------------------------------------------
  test('H1-7 四个文件 Tab 切换 — 各 Tab 内容独立不串', async ({ page }) => {
    test.setTimeout(60_000);

    // Inject 4-tab multi-language schema
    const result = await injectSchema(page, MULTI_FILE_SCHEMA);
    expect(result.success, `Schema inject should succeed: ${result.reason}`).toBeTruthy();

    const wb = page.locator(SEL.workbench.container);
    await expect(wb).toBeVisible({ timeout: 5000 });

    const tabs = page.locator(SEL.workbench.tab);
    await expect(tabs).toHaveCount(4, { timeout: 5000 });

    // Define expected content markers for each tab
    const expectedContent = [
      { tabIndex: 0, title: 'index.ts', marker: 'express', language: 'typescript' },
      { tabIndex: 1, title: 'utils.py', marker: 'fibonacci', language: 'python' },
      { tabIndex: 2, title: 'config.json', marker: 'my-app', language: 'json' },
      { tabIndex: 3, title: 'query.sql', marker: 'SELECT', language: 'sql' },
    ];

    // First pass: click each tab and verify content
    for (const { tabIndex, title, marker, language } of expectedContent) {
      await tabs.nth(tabIndex).click();

      // Wait for Monaco to render with the expected content marker
      // AnimatePresence mode="wait": old tab exits → new tab enters → Monaco lazy loads
      await waitForMonacoWithContent(page, marker, 15000);

      // Read editor content (normalized)
      const content = await readMonacoContent(page);
      expect(content, `Tab "${title}" should contain "${marker}"`).toContain(marker);

      // Verify the language label is displayed correctly
      const codeEditorContainer = wb.locator('.workbench-code-editor').first();
      const labelText = await codeEditorContainer.locator('.text-xs').first().innerText().catch(() => '');
      expect(
        labelText.toLowerCase(),
        `Tab "${title}" language label should show "${language}"`,
      ).toContain(language);
    }

    // Second pass: reverse order to verify no content leaking
    for (let i = expectedContent.length - 1; i >= 0; i--) {
      const { tabIndex, title, marker } = expectedContent[i];
      await tabs.nth(tabIndex).click();

      // Wait for the correct content to appear after tab switch
      await waitForMonacoWithContent(page, marker, 15000);

      const content = await readMonacoContent(page);
      expect(content, `[Reverse] Tab "${title}" should still contain "${marker}"`).toContain(marker);

      // Verify content does NOT contain markers from OTHER tabs
      const otherMarkers = expectedContent
        .filter((_, idx) => idx !== i)
        .map(e => e.marker);

      for (const otherMarker of otherMarkers) {
        // Only check if the other marker wouldn't naturally appear in this file
        // Skip 'express' check for config.json since it contains "express" in dependencies
        if (tabIndex === 2 && otherMarker === 'express') continue;
        expect(
          content,
          `Tab "${title}" should NOT contain "${otherMarker}" from another tab`,
        ).not.toContain(otherMarker);
      }
    }

    // Screenshot
    await page.screenshot({
      path: path.join(screenshotDir, 'H1-07.png'),
      fullPage: true,
    });
  });
});
