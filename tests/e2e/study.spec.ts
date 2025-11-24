import { test, expect } from '@playwright/test';

test.use({ storageState: 'storageState.json' });

test('pdf panel loads from s3', async ({ page }) => {
    const [response] = await Promise.all([
        page.waitForResponse(resp => resp.url().includes('s3') && resp.status() === 200), // make sure textbook is fetched from s3
        page.goto('/study/852f0488-7903-4555-bf5e-a7618f2552ff'),
    ]);

    await page.screenshot()
    expect(response.ok()).toBeTruthy();
})


test('navigation panel loads', async ({ page }) => {
    await page.goto('/study/852f0488-7903-4555-bf5e-a7618f2552ff', { waitUntil: 'networkidle' });
    await expect(page.locator('div').filter({ hasText: /^CHAPTERS$/ })).toBeVisible();
    await expect(page.getByText('Research Methods in Psychology').nth(1)).toBeVisible();
})

test('tools panel loads', async ({ page }) => {
    await page.goto('/study/852f0488-7903-4555-bf5e-a7618f2552ff', { waitUntil: 'networkidle' });

    await expect(page.locator('div').filter({ hasText: /^LEARNING TOOLS$/ }).first()).toBeVisible();
})

test('redirects with no authentication', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto('/study/852f0488-7903-4555-bf5e-a7618f2552ff');
    await expect(page).toHaveURL(/\/auth/);

    await context.close();
});