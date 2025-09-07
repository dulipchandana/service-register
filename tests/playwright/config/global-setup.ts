import { chromium } from '@playwright/test';
import path from 'path';

async function globalSetup(): Promise<void> {
  const storageStatePath = path.join(__dirname, 'storage-state.json');
  
  // Setup browser
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Add any global setup like authentication here if needed
  await page.goto('http://localhost:5000');

  // Save storage state for reuse in tests
  await context.storageState({ path: storageStatePath });
  await browser.close();
}

export default globalSetup;
