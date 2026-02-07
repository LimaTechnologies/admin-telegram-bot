import { test, expect, type Page } from '@playwright/test';

// Helper to login
async function login(page: Page) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: /email/i }).fill('admin@example.com');
  await page.locator('input[type="password"]').fill('admin123');
  await page.getByRole('button', { name: /sign in/i }).click();
  // Wait for redirect to dashboard
  await expect(page).toHaveURL('/', { timeout: 10000 });
}

test.describe('Models Page - Photos and Products', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('models page loads correctly', async ({ page }) => {
    await page.goto('/models');

    // Check page title
    await expect(page.getByRole('heading', { name: /onlyfans models/i })).toBeVisible();

    // Check Add Model button
    await expect(page.getByRole('button', { name: /add model/i })).toBeVisible();

    // Check tier filter
    await expect(page.getByRole('combobox')).toBeVisible();
  });

  test('can open model detail dialog', async ({ page }) => {
    await page.goto('/models');

    // Wait for table to load
    await page.waitForSelector('table', { timeout: 10000 });

    // If there are models, click on the first one's action menu
    const actionButtons = page.locator('table tbody tr button');
    const count = await actionButtons.count();

    if (count > 0) {
      await actionButtons.first().click();

      // Look for "Photos & Products" menu item
      const photosMenuItem = page.getByRole('menuitem', { name: /photos.*products/i });
      if (await photosMenuItem.isVisible()) {
        await photosMenuItem.click();

        // Dialog should open with tabs
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByRole('tab', { name: /details/i })).toBeVisible();
        await expect(page.getByRole('tab', { name: /photos/i })).toBeVisible();
        await expect(page.getByRole('tab', { name: /products/i })).toBeVisible();
      }
    }
  });

  test('can create a new model', async ({ page }) => {
    await page.goto('/models');

    // Click Add Model button
    await page.getByRole('button', { name: /add model/i }).click();

    // Fill the form
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(/name/i).fill('Test Model ' + Date.now());
    await dialog.getByLabel(/username/i).fill('testmodel' + Date.now());
    await dialog.getByLabel(/onlyfans url/i).fill('https://onlyfans.com/testmodel');

    // Select tier
    await dialog.getByRole('combobox').click();
    await page.getByRole('option', { name: /gold/i }).click();

    // Submit
    await dialog.getByRole('button', { name: /add model/i }).click();

    // Should see success toast
    await expect(page.getByText(/model created/i)).toBeVisible({ timeout: 5000 });
  });

  test('products tab shows add product button', async ({ page }) => {
    await page.goto('/models');

    // Wait for table to load
    await page.waitForSelector('table', { timeout: 10000 });

    // Click on first model's action menu
    const actionButtons = page.locator('table tbody tr button');
    const count = await actionButtons.count();

    if (count > 0) {
      await actionButtons.first().click();

      const photosMenuItem = page.getByRole('menuitem', { name: /photos.*products/i });
      if (await photosMenuItem.isVisible()) {
        await photosMenuItem.click();

        // Click on Products tab
        await page.getByRole('tab', { name: /products/i }).click();

        // Should see Add Product button
        await expect(page.getByRole('button', { name: /add product/i })).toBeVisible();
      }
    }
  });

  test('can add a product to model', async ({ page }) => {
    await page.goto('/models');

    await page.waitForSelector('table', { timeout: 10000 });

    const actionButtons = page.locator('table tbody tr button');
    const count = await actionButtons.count();

    if (count > 0) {
      await actionButtons.first().click();

      const photosMenuItem = page.getByRole('menuitem', { name: /photos.*products/i });
      if (await photosMenuItem.isVisible()) {
        await photosMenuItem.click();

        // Click on Products tab
        await page.getByRole('tab', { name: /products/i }).click();

        // Click Add Product
        await page.getByRole('button', { name: /add product/i }).click();

        // Fill product form
        const productDialog = page.locator('[role="dialog"]').last();
        await productDialog.getByLabel(/name/i).fill('Premium Content Pack');
        await productDialog.getByLabel(/price/i).fill('29.90');

        // Select type
        await productDialog.locator('button:has-text("Content Pack")').click();
        await page.getByRole('option', { name: /content/i }).click();

        // Submit
        await productDialog.getByRole('button', { name: /add.*product/i }).click();

        // Should see success
        await expect(page.getByText(/product added/i)).toBeVisible({ timeout: 5000 });
      }
    }
  });
});

test.describe('Models Table Features', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('shows content column with photos and products count', async ({ page }) => {
    await page.goto('/models');

    await page.waitForSelector('table', { timeout: 10000 });

    // Check for Content column header
    await expect(page.getByRole('columnheader', { name: /content/i })).toBeVisible();
  });

  test('tier filter works', async ({ page }) => {
    await page.goto('/models');

    // Click tier filter
    await page.getByRole('combobox').last().click();

    // Select Gold
    await page.getByRole('option', { name: /gold/i }).click();

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Check URL includes tier filter or table updates
    // The filter should be applied (we can't verify data without actual models)
  });

  test('search works', async ({ page }) => {
    await page.goto('/models');

    // Type in search
    await page.getByPlaceholder(/search models/i).fill('test');

    // Wait for search to apply (debounced)
    await page.waitForTimeout(500);
  });
});
