import { Page, expect } from '@playwright/test';
import { SEL } from './selectors';

export async function sendMessage(page: Page, message: string) {
  const textarea = page.locator(SEL.chat.textarea);
  await textarea.fill(message);
  await textarea.press('Enter');
}

export async function waitForResponse(page: Page, timeout = 60000) {
  // Wait for loading to start
  await page.waitForTimeout(500);
  // Wait for streaming to finish (stop button disappears)
  try {
    await page.locator(SEL.chat.stopButton).waitFor({ state: 'hidden', timeout });
  } catch {
    // If stop button never appeared, response was fast
  }
  // Extra wait for content to settle
  await page.waitForTimeout(500);
}

export async function sendAndWait(page: Page, message: string, timeout = 60000) {
  await sendMessage(page, message);
  await waitForResponse(page, timeout);
}
