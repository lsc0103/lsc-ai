/**
 * AI 重试助手
 *
 * 解决 DeepSeek API 限流导致的测试不稳定问题。
 * 所有依赖 AI 回复的测试都应使用 sendAndWaitWithRetry。
 */
import { Page } from '@playwright/test';
import { SEL } from './selectors';

export interface AIRetryResult {
  hasResponse: boolean;
  responseText: string;
}

/**
 * 发送消息并等待 AI 回复，带重试机制
 */
export async function sendAndWaitWithRetry(
  page: Page,
  message: string,
  options: {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
  } = {},
): Promise<AIRetryResult> {
  const { timeout = 60000, retries = 2, retryDelay = 5000 } = options;

  const assistantBubbles = page.locator('main .message-bubble.assistant');

  for (let attempt = 0; attempt <= retries; attempt++) {
    // 记录发送前的 AI 消息数量
    const countBefore = await assistantBubbles.count();

    if (attempt > 0) {
      // Retry: wait then resend
      await page.waitForTimeout(retryDelay);
      console.log(`[ai-retry] Attempt ${attempt + 1}/${retries + 1} for: "${message.slice(0, 40)}..."`);
    }

    const textarea = page.locator(SEL.chat.textarea);
    // Only send on first attempt, or if we need to resend
    if (attempt === 0) {
      await textarea.fill(message);
      await textarea.press('Enter');
      // Wait for session creation on first message
      await page.waitForURL('**/chat/**', { timeout: 15000 }).catch(() => {});
    } else {
      // On retry, send again
      await textarea.fill(message);
      await textarea.press('Enter');
    }

    // Wait for AI to start responding
    await page.waitForTimeout(1000);

    try {
      // Wait for stop button to appear then disappear
      await page.locator(SEL.chat.stopButton).waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
      await page.locator(SEL.chat.stopButton).waitFor({ state: 'hidden', timeout });
    } catch {
      // Timeout — but still check if response arrived
    }

    await page.waitForTimeout(2000);

    // Check if we got a NEW response (count must increase)
    const countAfter = await assistantBubbles.count();
    if (countAfter > countBefore) {
      const text = (await assistantBubbles.last().textContent()) || '';
      if (text.length > 0) {
        console.log(`[ai-retry] Got response (${countBefore} -> ${countAfter}): "${text.slice(0, 50)}..."`);
        return { hasResponse: true, responseText: text };
      }
    }

    // If stop button is still visible, AI is still working — wait more
    const stillStreaming = await page.locator(SEL.chat.stopButton).isVisible().catch(() => false);
    if (stillStreaming) {
      try {
        await page.locator(SEL.chat.stopButton).waitFor({ state: 'hidden', timeout: 60000 });
        await page.waitForTimeout(2000);
        const retryCount = await assistantBubbles.count();
        if (retryCount > countBefore) {
          const text = (await assistantBubbles.last().textContent()) || '';
          if (text.length > 0) {
            console.log(`[ai-retry] Got response after extra wait (${countBefore} -> ${retryCount}): "${text.slice(0, 50)}..."`);
            return { hasResponse: true, responseText: text };
          }
        }
      } catch {
        // Still streaming after extra wait
      }
    }

    console.log(`[ai-retry] No new response after attempt ${attempt + 1} (count: ${countBefore} -> ${countAfter})`);
    if (attempt < retries) continue;
  }

  return { hasResponse: false, responseText: '' };
}

/**
 * 等待 AI 回复完成（不发消息，只等待）
 */
export async function waitForAIComplete(page: Page, timeout = 60000) {
  await page.waitForTimeout(1000);
  try {
    await page.locator(SEL.chat.stopButton).waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    await page.locator(SEL.chat.stopButton).waitFor({ state: 'hidden', timeout });
  } catch {
    // Already done or never started
  }
  await page.waitForTimeout(1500);
}
