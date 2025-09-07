"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const path_1 = __importDefault(require("path"));
async function globalSetup() {
    const storageStatePath = path_1.default.join(__dirname, 'storage-state.json');
    // Setup browser
    const browser = await test_1.chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    // Add any global setup like authentication here if needed
    await page.goto('http://localhost:5000');
    // Save storage state for reuse in tests
    await context.storageState({ path: storageStatePath });
    await browser.close();
}
exports.default = globalSetup;
//# sourceMappingURL=global-setup.js.map