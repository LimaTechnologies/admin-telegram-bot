import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');

    // Check page title
    await expect(page).toHaveTitle(/Admin Dashboard/);

    // Check main elements
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByText('Enter your credentials to sign in')).toBeVisible();
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('login form validates email input', async ({ page }) => {
    await page.goto('/login');

    const emailInput = page.getByRole('textbox', { name: /email/i });
    const submitButton = page.getByRole('button', { name: /sign in/i });

    // Empty email should not submit (HTML5 validation)
    await submitButton.click();
    await expect(emailInput).toBeFocused();
  });

  test('login form accepts valid email and password', async ({ page }) => {
    await page.goto('/login');

    const emailInput = page.getByRole('textbox', { name: /email/i });
    const passwordInput = page.locator('input[type="password"]');

    // Fill valid credentials
    await emailInput.fill('admin@example.com');
    await passwordInput.fill('password123');
    await expect(emailInput).toHaveValue('admin@example.com');
    await expect(passwordInput).toHaveValue('password123');
  });

  test('password visibility toggle works', async ({ page }) => {
    await page.goto('/login');

    const passwordInput = page.locator('input[placeholder="Enter your password"]');
    const toggleButton = page.locator('button').filter({ has: page.locator('svg') }).last();

    // Initially password should be hidden
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click toggle to show password
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Click toggle to hide password again
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');

    const emailInput = page.getByRole('textbox', { name: /email/i });
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.getByRole('button', { name: /sign in/i });

    // Fill invalid credentials
    await emailInput.fill('invalid@example.com');
    await passwordInput.fill('wrongpassword');
    await submitButton.click();

    // Should show error toast (wait for it)
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Protected Routes', () => {
  test('dashboard redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

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

test.describe('Root Page Redirect', () => {
  test('root page redirects to dashboard', async ({ page }) => {
    await page.goto('/');
    // Should redirect to dashboard, which redirects to login (unauthenticated)
    await expect(page).toHaveURL(/\/(dashboard|login)/);
  });
});
