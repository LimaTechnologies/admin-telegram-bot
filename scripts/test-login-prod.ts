/**
 * Test login flow on production
 * Run: bun scripts/test-login-prod.ts
 */
import { chromium } from 'playwright';

async function testLogin() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('1. Navigating to login page...');
  await page.goto('https://admin-telegram-bot.vercel.app/login');

  console.log('2. Filling email...');
  await page.fill('input[type="email"]', 'admin@example.com');

  console.log('3. Filling password...');
  await page.fill('input[type="password"]', 'Ggr83@KAUE%CrEDs');

  console.log('4. Clicking Sign In...');
  await page.click('button[type="submit"]');

  console.log('5. Waiting for navigation or error...');
  try {
    await page.waitForURL('https://admin-telegram-bot.vercel.app/', { timeout: 15000 });
    console.log('   Redirected to dashboard!');
  } catch {
    console.log('   Timeout waiting for redirect, checking page state...');
  }

  const currentUrl = page.url();
  console.log(`6. Current URL: ${currentUrl}`);

  const title = await page.title();
  console.log(`7. Page title: ${title}`);

  // Take screenshot
  await page.screenshot({ path: '/tmp/login-result.png' });
  console.log('8. Screenshot saved to /tmp/login-result.png');

  // Check if we're on the dashboard
  if (currentUrl.includes('/login')) {
    console.log('\n❌ Still on login page - login may have failed');
    const pageContent = await page.content();
    if (pageContent.includes('Invalid') || pageContent.includes('error')) {
      console.log('Error message found on page');
    }
  } else if (currentUrl === 'https://admin-telegram-bot.vercel.app/' || currentUrl === 'https://admin-telegram-bot.vercel.app') {
    console.log('\n✅ Successfully redirected to dashboard!');
  } else {
    console.log(`\n⚠️ Redirected to unexpected URL: ${currentUrl}`);
  }

  await browser.close();
}

testLogin().catch(console.error);
