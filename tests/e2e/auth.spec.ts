import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');

    // Check page title
    await expect(page).toHaveTitle(/Admin Dashboard/);

    // Check main elements
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByText('Enter your email to receive a magic link')).toBeVisible();
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /send magic link/i })).toBeVisible();
  });

  test('login form validates email input', async ({ page }) => {
    await page.goto('/login');

    const emailInput = page.getByRole('textbox', { name: /email/i });
    const submitButton = page.getByRole('button', { name: /send magic link/i });

    // Empty email should not submit (HTML5 validation)
    await submitButton.click();
    await expect(emailInput).toBeFocused();
  });

  test('login form accepts valid email', async ({ page }) => {
    await page.goto('/login');

    const emailInput = page.getByRole('textbox', { name: /email/i });

    // Fill valid email
    await emailInput.fill('admin@example.com');
    await expect(emailInput).toHaveValue('admin@example.com');
  });

  test('verify page shows loading state', async ({ page }) => {
    await page.goto('/verify?token=test-token');

    // Should show verifying message initially
    await expect(page.getByText('Verifying...')).toBeVisible();
  });

  test('verify page shows error for invalid token', async ({ page }) => {
    await page.goto('/verify?token=invalid-token-123');

    // Wait for verification to complete
    await page.waitForSelector('text=Verification Failed', { timeout: 10000 });

    // Should show error state
    await expect(page.getByText('Verification Failed')).toBeVisible();
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible();
  });

  test('try again button redirects to login', async ({ page }) => {
    await page.goto('/verify?token=invalid-token');

    // Wait for error state
    await page.waitForSelector('text=Verification Failed', { timeout: 10000 });

    // Click try again
    await page.getByRole('button', { name: /try again/i }).click();

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Protected Routes', () => {
  test('groups page redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/groups');
    await expect(page).toHaveURL(/\/login/);
  });

  test('campaigns page redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/campaigns');
    await expect(page).toHaveURL(/\/login/);
  });

  test('creatives page redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/creatives');
    await expect(page).toHaveURL(/\/login/);
  });

  test('analytics page redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/analytics');
    await expect(page).toHaveURL(/\/login/);
  });

  test('scheduling page redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/scheduling');
    await expect(page).toHaveURL(/\/login/);
  });

  test('revenue page redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/revenue');
    await expect(page).toHaveURL(/\/login/);
  });

  test('models page redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/models');
    await expect(page).toHaveURL(/\/login/);
  });

  test('casinos page redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/casinos');
    await expect(page).toHaveURL(/\/login/);
  });

  test('spam-controls page redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/spam-controls');
    await expect(page).toHaveURL(/\/login/);
  });

  test('reports page redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/reports');
    await expect(page).toHaveURL(/\/login/);
  });

  test('audit-logs page redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/audit-logs');
    await expect(page).toHaveURL(/\/login/);
  });

  test('queue-monitor page redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/queue-monitor');
    await expect(page).toHaveURL(/\/login/);
  });
});
