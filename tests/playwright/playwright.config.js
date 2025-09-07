"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config = {
    timeout: 30000,
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
exports.default = config;
//# sourceMappingURL=playwright.config.js.map