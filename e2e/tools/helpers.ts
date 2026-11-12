// P7.1 shared Playwright helpers for tool interaction tests.
// Deterministic: clipboard is stubbed (no OS clipboard dependence),
// no network beyond localhost, no real user data.

import { expect, type Page } from "@playwright/test";

export async function stubClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __clipboardWrites: string[] }).__clipboardWrites = [];
    Object.defineProperty(window.navigator, "clipboard", {
      value: {
        writeText: (text: string) => {
          (window as unknown as { __clipboardWrites: string[] }).__clipboardWrites.push(text);
          return Promise.resolve();
        },
      },
      configurable: true,
    });
  });
}

export function clipboardWrites(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as { __clipboardWrites?: string[] }).__clipboardWrites ?? [],
  );
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

export async function gotoMobile(page: Page, path: string): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path);
}
