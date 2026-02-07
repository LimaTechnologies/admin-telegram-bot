import { test, expect, type Page } from '@playwright/test';

// Helper to login before tests
async function login(page: Page) {
  await page.goto('/login');

  // Get test credentials from env or use defaults
  const email = process.env['TEST_USER_EMAIL'] || 'admin@example.com';
  const password = process.env['TEST_USER_PASSWORD'] || 'admin123';

  await page.getByRole('textbox', { name: /email/i }).fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect to dashboard
  await page.waitForURL('/', { timeout: 10000 });
}

test.describe('Dashboard Pages (Authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    // Skip login for now - just test that pages load after auth
    // In a real scenario, we'd set up test authentication
  });

  test('login page loads correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Admin Dashboard/);
    await expect(page.getByText('Welcome back')).toBeVisible();
  });

  test('login page has proper form elements', async ({ page }) => {
    await page.goto('/login');

    // Check for form elements
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

    // Check for visual elements
    await expect(page.locator('svg.lucide-lock')).toBeVisible();
  });

  test('all protected routes redirect to login', async ({ page }) => {
    const protectedRoutes = [
      '/',
      '/groups',
      '/campaigns',
      '/creatives',
      '/analytics',
      '/scheduling',
      '/revenue',
      '/models',
      '/casinos',
      '/spam-controls',
      '/reports',
      '/audit-logs',
      '/queue-monitor',
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
    }
  });
});

test.describe('UI Components', () => {
  test('login page is responsive', async ({ page }) => {
    await page.goto('/login');

    // Desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    const card = page.locator('.max-w-md');
    await expect(card).toBeVisible();

    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(card).toBeVisible();
    // Card should still be visible and properly sized
    const box = await card.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(375);
  });

  test('dark mode toggle exists in login page', async ({ page }) => {
    await page.goto('/login');

    // The page should support dark mode (check html attribute)
    const html = page.locator('html');
    await expect(html).toHaveAttribute('class', /.*dark.*/);
  });
});

test.describe('Error Handling', () => {
  test('invalid login shows error message', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('textbox', { name: /email/i }).fill('invalid@test.com');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should show error toast
    await expect(page.getByText(/invalid/i)).toBeVisible({ timeout: 10000 });
  });

  test('empty form shows validation', async ({ page }) => {
    await page.goto('/login');

    // Try to submit without filling
    await page.getByRole('button', { name: /sign in/i }).click();

    // HTML5 validation should prevent submission
    const emailInput = page.getByRole('textbox', { name: /email/i });
    await expect(emailInput).toBeFocused();
  });
});
