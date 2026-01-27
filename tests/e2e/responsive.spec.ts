import { test, expect } from '@playwright/test';

test.describe('Responsive Design - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('login page is mobile-friendly', async ({ page }) => {
    await page.goto('/login');

    // Check elements are visible on mobile
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /send magic link/i })).toBeVisible();

    // Form should be reasonably sized on mobile (accounting for padding)
    const form = page.locator('form').first();
    const formBox = await form.boundingBox();
    expect(formBox?.width).toBeGreaterThan(250);
  });

  test('verify page is mobile-friendly', async ({ page }) => {
    await page.goto('/verify?token=test');

    // Check elements are visible
    await expect(page.getByText('Verifying...')).toBeVisible();
  });
});

test.describe('Responsive Design - Tablet', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('login page renders on tablet', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
  });
});

test.describe('Responsive Design - Desktop', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('login page renders on desktop', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();

    // Desktop should have form visible and centered
    const form = page.locator('form').first();
    await expect(form).toBeVisible();
    const box = await form.boundingBox();
    expect(box?.width).toBeGreaterThan(300);
  });
});
