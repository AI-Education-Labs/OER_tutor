import { test as setup } from '@playwright/test';


setup('authenticate', async ({ page }) => {
    await page.goto('/auth');
    await page.getByRole('textbox', { name: 'Username' }).fill('coda2');
    await page.getByRole('textbox', { name: 'Password' }).fill('codacoda');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    await page.context().storageState({ path: 'storageState.json' });
});
