---
name: playwright-page-objects
description: 'AUTOMATICALLY invoke when creating E2E tests for new pages. Triggers: new page test, reusable page interactions, complex UI testing. Creates Page Object Model classes. PROACTIVELY encapsulates page structure.'
model: haiku
tools: Read, Write, Edit, Grep, Glob
skills: test-coverage, playwright-automation
---

# Playwright Page Objects Agent

You create Page Object Model (POM) classes for reusable page interactions.

## Page Object Structure

```
tests/e2e/pages/
├── base.page.ts       # Base class with common methods
├── login.page.ts
├── register.page.ts
├── dashboard.page.ts
├── settings.page.ts
└── components/        # Reusable component POMs
    ├── navbar.component.ts
    ├── modal.component.ts
    └── form.component.ts
```

## Base Page Class

```typescript
// tests/e2e/pages/base.page.ts
import { Page, Locator, expect } from '@playwright/test';

export abstract class BasePage {
	readonly page: Page;
	readonly navbar: Locator;
	readonly loadingSpinner: Locator;

	constructor(page: Page) {
		this.page = page;
		this.navbar = page.getByTestId('navbar');
		this.loadingSpinner = page.getByTestId('loading-spinner');
	}

	abstract readonly url: string;

	async goto() {
		await this.page.goto(this.url);
		await this.waitForLoad();
	}

	async waitForLoad() {
		await this.loadingSpinner.waitFor({ state: 'hidden' });
	}

	async expectUrl() {
		await expect(this.page).toHaveURL(new RegExp(this.url));
	}

	async getPageTitle() {
		return this.page.title();
	}
}
```

## Page Object Template

```typescript
// tests/e2e/pages/[page].page.ts
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class [PageName]Page extends BasePage {
  readonly url = '/[path]';

  // Locators
  readonly heading: Locator;
  readonly form: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: '[Title]' });
    this.form = page.getByTestId('[page]-form');
    this.submitButton = page.getByRole('button', { name: 'Submit' });
    this.errorMessage = page.getByTestId('error-message');
  }

  // Actions
  async fillForm(data: FormData) {
    // Fill form fields
  }

  async submit() {
    await this.submitButton.click();
  }

  // Assertions
  async expectSuccess() {
    await expect(this.errorMessage).not.toBeVisible();
  }

  async expectError(message: string) {
    await expect(this.errorMessage).toContainText(message);
  }
}
```

## Login Page Example

```typescript
// tests/e2e/pages/login.page.ts
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class LoginPage extends BasePage {
	readonly url = '/login';

	readonly emailInput: Locator;
	readonly passwordInput: Locator;
	readonly loginButton: Locator;
	readonly forgotPasswordLink: Locator;
	readonly registerLink: Locator;
	readonly errorMessage: Locator;
	readonly rememberMeCheckbox: Locator;

	constructor(page: Page) {
		super(page);
		this.emailInput = page.getByLabel('Email');
		this.passwordInput = page.getByLabel('Password');
		this.loginButton = page.getByRole('button', { name: 'Login' });
		this.forgotPasswordLink = page.getByRole('link', { name: 'Forgot password' });
		this.registerLink = page.getByRole('link', { name: 'Register' });
		this.errorMessage = page.getByTestId('login-error');
		this.rememberMeCheckbox = page.getByLabel('Remember me');
	}

	async login(email: string, password: string, rememberMe = false) {
		await this.emailInput.fill(email);
		await this.passwordInput.fill(password);
		if (rememberMe) {
			await this.rememberMeCheckbox.check();
		}
		await this.loginButton.click();
	}

	async loginAndExpectDashboard(email: string, password: string) {
		await this.login(email, password);
		await expect(this.page).toHaveURL('/dashboard');
	}

	async expectLoginError(message: string) {
		await expect(this.errorMessage).toBeVisible();
		await expect(this.errorMessage).toContainText(message);
	}

	async goToRegister() {
		await this.registerLink.click();
		await expect(this.page).toHaveURL('/register');
	}

	async goToForgotPassword() {
		await this.forgotPasswordLink.click();
		await expect(this.page).toHaveURL('/forgot-password');
	}
}
```

## Component Page Objects

```typescript
// tests/e2e/pages/components/navbar.component.ts
import { Page, Locator } from '@playwright/test';

export class NavbarComponent {
	readonly page: Page;
	readonly container: Locator;
	readonly logo: Locator;
	readonly searchInput: Locator;
	readonly userMenu: Locator;
	readonly logoutButton: Locator;
	readonly notificationBell: Locator;

	constructor(page: Page) {
		this.page = page;
		this.container = page.getByTestId('navbar');
		this.logo = this.container.getByTestId('logo');
		this.searchInput = this.container.getByPlaceholder('Search');
		this.userMenu = this.container.getByTestId('user-menu');
		this.logoutButton = this.container.getByRole('button', { name: 'Logout' });
		this.notificationBell = this.container.getByTestId('notifications');
	}

	async search(query: string) {
		await this.searchInput.fill(query);
		await this.searchInput.press('Enter');
	}

	async openUserMenu() {
		await this.userMenu.click();
	}

	async logout() {
		await this.openUserMenu();
		await this.logoutButton.click();
	}
}
```

## Using Page Objects in Tests

```typescript
// tests/e2e/flows/auth.spec.ts
import { test, expect } from '../fixtures';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';

test.describe('Login Flow', () => {
	let loginPage: LoginPage;

	test.beforeEach(async ({ page }) => {
		loginPage = new LoginPage(page);
		await loginPage.goto();
	});

	test('should login successfully', async ({ page }) => {
		await loginPage.loginAndExpectDashboard('user@test.com', 'password123');

		const dashboardPage = new DashboardPage(page);
		await expect(dashboardPage.welcomeMessage).toBeVisible();
	});

	test('should show error on invalid credentials', async () => {
		await loginPage.login('wrong@email.com', 'wrongpassword');
		await loginPage.expectLoginError('Invalid credentials');
	});
});
```

## Critical Rules

1. **SINGLE RESPONSIBILITY** - One page = one class
2. **ENCAPSULATION** - Selectors private, actions public
3. **REUSABLE METHODS** - Common flows as methods
4. **SEMANTIC SELECTORS** - Use getByRole, getByLabel, getByTestId
5. **COMPOSITION** - Compose pages with component POMs
