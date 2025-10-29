import { test, expect } from '@playwright/test';

test.describe('Auth page', () => {
    test.beforeEach(async ({ page }) => {
        // Start on the login tab explicitly for isolation
        await page.goto('/auth?tab=login');
    });

    test('shows login tab and core controls', async ({ page }) => {
        // Tabs visible
        await expect(page.getByRole('tablist')).toBeVisible();
        const signInTab = page.getByRole('tab', { name: 'Sign In' });
        const signUpTab = page.getByRole('tab', { name: 'Sign Up' });
        await expect(signInTab).toBeVisible();
        await expect(signUpTab).toBeVisible();

        // Login form content
        await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
        await expect(page.getByText('Enter your credentials to access your account')).toBeVisible();

        // Labeled inputs are present
        // TODO: ideally, this should support accessibilty tooling to identify it's a password field
        const username = page.getByRole('textbox', { name: 'Username' });
        const password = page.getByRole('textbox', { name: 'Password' });
        await expect(username).toBeVisible();
        await expect(password).toBeVisible();

        // Password visibility toggle
        const toggle = page.getByRole('button', { name: 'Show password' });
        await expect(toggle).toBeVisible();
        await toggle.click();
        await expect(page.getByRole('button', { name: 'Hide password' })).toBeVisible();

        // Submit button
        const submit = page.getByRole('button', { name: 'Sign In' });
        await expect(submit).toBeVisible();
        await expect(submit).toBeEnabled();
    });

    test('switching to Sign Up shows register controls', async ({ page }) => {
        await page.getByRole('tab', { name: 'Sign Up' }).click();

        // Register form content
        await expect(page.getByRole('textbox', { name: 'Username' })).toBeVisible();
        await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
        await expect(page.getByRole('textbox', { name: 'Password' }).first()).toBeVisible();
        //TODO: back to accessability, second field needs to managed differently in frontend in order to not grab both

        const signUpSubmit = page.getByRole('button', { name: 'Create Account' });
        await expect(signUpSubmit).toBeVisible();
        await expect(signUpSubmit).toBeEnabled();
    });
});