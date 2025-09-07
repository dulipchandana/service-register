import { PlaywrightTestConfig, devices } from '@playwright/test';

const config: PlaywrightTestConfig = {
  timeout: 120000, // Increased to 2 minutes for Kafka tests
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:5000',
    browserName: 'chromium',
    headless: true,
    viewport: {
      width: 1280,
      height: 720
    }
  },
  reporter: [
    ['html'],
    ['list']
  ],
  workers: 1,
  retries: 2,
  projects: [
    {
      name: 'Chromium',
      use: { browserName: 'chromium' }
    },
    {
      name: 'Firefox',
      use: { browserName: 'firefox' }
    },
    {
      name: 'Webkit',
      use: { browserName: 'webkit' }
    }
  ]
};

export default config;
