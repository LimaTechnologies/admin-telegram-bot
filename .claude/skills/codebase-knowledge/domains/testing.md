# Domain: Testing

## Last Update

- **Date:** 2026-02-07
- **Commit:** (session changes)
- **Summary:** Created E2E test suite with Playwright for authentication flow, dashboard routes, and responsive design validation

## Files

### E2E Tests

- `tests/e2e/auth.spec.ts` - Authentication flow tests (login form, validation, password visibility toggle)
- `tests/e2e/dashboard.spec.ts` - Dashboard page loading tests (login helper, protected route redirect)
- `tests/e2e/responsive.spec.ts` - Responsive design tests (mobile 375x667 viewport validation)

### Configuration

- `playwright.config.ts` - Playwright test configuration (base URL, timeout, browser options)

## Connections

- **authentication** - Tests validate login UI, form inputs, password fields
- **pages** - Tests verify dashboard page loads and redirects
- **infrastructure** - Tests run against docker-compose services

## Recent Commits

| Hash | Date | Description |
|------|------|-------------|
| Session | 2026-02-07 | Added E2E tests for password-based auth, dashboard loading, mobile responsiveness |

## Attention Points

### Test Structure

- Tests use Playwright with `@playwright/test`
- Each test file has `test.describe()` blocks for logical grouping
- Helper functions like `login()` should be reused across test files
- Tests check for HTML5 form validation (email required, empty submit behavior)

### Login Tests (auth.spec.ts)

1. **Form Rendering** - Checks for "Welcome back", email/password inputs, sign-in button
2. **Validation** - Verifies HTML5 email validation, required field behavior
3. **Password Field** - Tests password visibility toggle button works correctly
4. **Credentials** - Validates form accepts email + password input

### Dashboard Tests (dashboard.spec.ts)

1. **Login Helper** - `login()` function fills credentials, clicks sign-in, waits for redirect
2. **Protected Routes** - Tests that unauthenticated access redirects to `/login?from=[path]`
3. **Middleware Check** - Verifies all dashboard routes require authentication

### Responsive Tests (responsive.spec.ts)

1. **Mobile Viewport** - Uses 375x667 (iPhone SE size)
2. **Form Visibility** - All form elements visible on mobile
3. **Card Sizing** - Login card scales properly (300-375px width on mobile)
4. **Touch Targets** - Button sizes appropriate for touch interaction

### Test Environment Variables

```env
TEST_USER_EMAIL=admin@example.com
TEST_USER_PASSWORD=admin123
```

Tests read from `process.env['TEST_USER_EMAIL']` with fallback defaults.

### Gotchas

- Password input selector must account for visibility toggle button location
- Mobile viewport test uses `test.use({ viewport: { width: 375, height: 667 } })`
- Form element selectors use accessible names: `getByRole('textbox', { name: /email/i })`
- Dashboard tests include a `login()` helper but tests don't authenticate yet (placeholder for real auth setup)
- Playwright waits for URL change: `await page.waitForURL('/', { timeout: 10000 })`
- `boundingBox()` calls may return null - need proper type handling
- Tests verify redirect to login but don't yet test POST to auth endpoint
