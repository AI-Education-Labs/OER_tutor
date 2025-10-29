import { test } from '@playwright/test';

test.use({ storageState: 'storageState.json' });

test('user can chat with AI', async ({ page }) => {
  await page.goto('/');
});