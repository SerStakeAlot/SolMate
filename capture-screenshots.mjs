import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function captureScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2, // High DPI for better quality
  });

  const page = await context.newPage();
  const baseURL = 'http://localhost:3000';

  try {
    console.log('Starting screenshot capture...');

    // 1. Home page/landing screen
    console.log('Capturing home page...');
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // Wait for animations
    await page.screenshot({
      path: join(__dirname, 'public/images/screenshots/homepage.png'),
      fullPage: false
    });
    console.log('✓ Home page captured');

    // 2. Try to capture practice mode or game interface
    console.log('Looking for chess gameplay...');
    const playButton = await page.locator('button:has-text("Play"), a:has-text("Play"), button:has-text("Practice"), a:has-text("Practice")').first();
    if (await playButton.count() > 0) {
      await playButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: join(__dirname, 'public/images/screenshots/gameplay.png'),
        fullPage: false
      });
      console.log('✓ Gameplay screen captured');
    } else {
      console.log('⚠ Play/Practice button not found, skipping gameplay screenshot');
    }

    // 3. Go back to home and try to capture wallet connection
    console.log('Navigating back to home...');
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    console.log('Looking for wallet connect button...');
    const walletButton = await page.locator('button:has-text("Connect"), button:has-text("Wallet"), button[class*="wallet"]').first();
    if (await walletButton.count() > 0) {
      await walletButton.click();
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: join(__dirname, 'public/images/screenshots/wallet-connect.png'),
        fullPage: false
      });
      console.log('✓ Wallet connection screen captured');
    } else {
      console.log('⚠ Wallet button not found, skipping wallet screenshot');
    }

    // 4. Try to capture match creation/joining interface
    console.log('Looking for match creation/joining...');
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const arenaButton = await page.locator('button:has-text("Arena"), a:has-text("Arena"), button:has-text("Create"), a:has-text("Match")').first();
    if (await arenaButton.count() > 0) {
      await arenaButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: join(__dirname, 'public/images/screenshots/match-interface.png'),
        fullPage: false
      });
      console.log('✓ Match interface captured');
    } else {
      console.log('⚠ Arena/Match button not found, skipping match interface screenshot');
    }

    console.log('\n✅ Screenshot capture complete!');
    console.log('Screenshots saved to: public/images/screenshots/');

  } catch (error) {
    console.error('❌ Error capturing screenshots:', error);
  } finally {
    await browser.close();
  }
}

// Create screenshots directory if it doesn't exist
import { mkdirSync } from 'fs';
import { existsSync } from 'fs';

const screenshotsDir = join(__dirname, 'public/images/screenshots');
if (!existsSync(screenshotsDir)) {
  mkdirSync(screenshotsDir, { recursive: true });
  console.log('Created screenshots directory');
}

captureScreenshots();
