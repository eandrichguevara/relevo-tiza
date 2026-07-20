import { test, expect } from '@playwright/test';

test.describe('TIZA Landing Page', () => {
  test('carga la landing page y navega al login', async ({ page }) => {
    // Navigate to the landing page
    await page.goto('/');

    // Verify the landing page loads with the brand title visible
    const brandTitle = page.locator('text=TIZA');
    await expect(brandTitle).toBeVisible();

    // Verify the "Iniciar sesión" link is present
    const loginLink = page.locator('a:has-text("Iniciar sesión")');
    await expect(loginLink).toBeVisible();

    // Click the login link
    await loginLink.click();

    // Verify we're on the login page
    await page.waitForURL('**/login');

    // Verify the login form is present — look for email input and password field
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();

    // Also verify there's a link to register
    const registerLink = page.locator('a:has-text("Registrarse")');
    await expect(registerLink).toBeVisible();
  });
});
