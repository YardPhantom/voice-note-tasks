const { test, expect } = require('@playwright/test');
test.beforeEach(async ({ page }) => { await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload(); });

test('empty state shows tips', async ({ page }) => {
  await expect(page.locator('#empty')).toBeVisible();
  await expect(page.locator('#empty')).toContainText('Load demo transcript');
});

test('demo mode extracts tasks', async ({ page }) => {
  await page.click('#demo'); await page.click('#parse');
  await expect(page.locator('#tasks li.task')).toHaveCount(9);
  await expect(page.locator('#status')).toHaveText(/9 task\(s\) extracted/);
  await expect(page.locator('#status')).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('#empty')).toBeHidden();
});

test('?demo auto-loads', async ({ page }) => {
  await page.goto('/?demo'); await expect(page.locator('#tasks li.task')).not.toHaveCount(0);
});

test('?t= prefills transcript and share builds link', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/?t=' + encodeURIComponent('Buy milk tomorrow. Call Sam'));
  await expect(page.locator('#transcript')).toHaveValue('Buy milk tomorrow. Call Sam');
  await page.click('#share');
  await expect(page.locator('#status')).toHaveText(/Share link copied|address bar/);
  await page.goto('/?auto&t=Buy+milk'); await expect(page.locator('#tasks li.task')).toHaveCount(1);
});

test('checklist edits: toggle, rename, date, delete + undo, persist', async ({ page }) => {
  await page.fill('#transcript', 'Buy milk. Call the dentist'); await page.click('#parse');
  const first = page.locator('#tasks li.task').first();
  await first.locator('[type=checkbox]').check(); await expect(first).toHaveClass(/done/);
  const title = page.locator('#tasks li.task').nth(1).locator('.t');
  await title.click(); await title.press('Control+a'); await title.pressSequentially('Call the vet'); await title.press('Enter');
  await expect(page.locator('#tasks li.task').nth(1).locator('.t')).toHaveText('Call the vet');
  await page.locator('#tasks li.task').nth(1).locator('[type=date]').fill('2026-12-01');
  await page.locator('#tasks li.task').first().locator('.del').click();
  await expect(page.locator('#tasks li.task')).toHaveCount(1);
  await page.click('#undobtn'); await expect(page.locator('#tasks li.task')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('#tasks li.task').nth(1).locator('.t')).toHaveText('Call the vet');
  await expect(page.locator('#tasks li.task').nth(1).locator('[type=date]')).toHaveValue('2026-12-01');
  await expect(page.locator('#tasks li.task').first()).toHaveClass(/done/);
});

test('keyboard checklist navigation', async ({ page }) => {
  await page.fill('#transcript', 'Buy milk. Call the dentist. Pay rent'); await page.click('#parse');
  await page.locator('#tasks li.task').first().focus();
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space');
  await expect(page.locator('#tasks li.task').nth(1)).toHaveClass(/done/);
  await expect(page.locator('#tasks li.task').nth(1)).toBeFocused();
  await page.keyboard.press('Delete'); await expect(page.locator('#tasks li.task')).toHaveCount(2);
  await page.keyboard.press('Control+z'); await expect(page.locator('#tasks li.task')).toHaveCount(3);
});

test('dark mode toggle persists', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' }); await page.click('#theme');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
