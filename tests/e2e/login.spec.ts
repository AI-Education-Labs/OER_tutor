// login.spec.ts
import { test } from '@playwright/test';

test('login and save state', async ({ page }) => {
  await page.goto('/auth');
  await page.getByRole('textbox', { name: 'Username' }).fill('coda2');
  await page.getByRole('textbox', { name: 'Password' }).fill('codacoda');
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
  await page.context().storageState({ path: 'storageState.json' });
});

