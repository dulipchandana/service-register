"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const chat_page_1 = require("../helpers/chat.page");
test_1.test.describe('Chat Application Tests', () => {
    let chatPage;
    test_1.test.beforeEach(async ({ page }) => {
        chatPage = new chat_page_1.ChatPage(page);
        await chatPage.goto();
    });
    (0, test_1.test)('should load the main chat page', async ({ page }) => {
        await (0, test_1.expect)(page).toHaveTitle('Chat Application');
        await (0, test_1.expect)(page.locator('h1')).toHaveText('Chat Application');
    });
    (0, test_1.test)('should be able to send a message', async () => {
        const testMessage = 'Test message ' + Date.now();
        await chatPage.sendMessage(testMessage);
        await chatPage.waitForMessage(testMessage);
    });
    (0, test_1.test)('should display messages across multiple clients', async ({ browser }) => {
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();
        const page1 = await context1.newPage();
        const page2 = await context2.newPage();
        const chatPage1 = new chat_page_1.ChatPage(page1);
        const chatPage2 = new chat_page_1.ChatPage(page2);
        await chatPage1.goto();
        await chatPage2.goto();
        const testMessage = 'Cross-client test message ' + Date.now();
        await chatPage1.sendMessage(testMessage);
        await chatPage2.waitForMessage(testMessage);
        await context1.close();
        await context2.close();
    });
    (0, test_1.test)('should persist messages across page reloads', async ({ page }) => {
        const testMessage = 'Persistence test message ' + Date.now();
        await chatPage.sendMessage(testMessage);
        await page.reload();
        await chatPage.waitForMessage(testMessage);
    });
    (0, test_1.test)('should handle special characters in messages', async () => {
        const specialMessage = '!@#$%^&*()_+ Special चाराक्टर्स 你好 👋';
        await chatPage.sendMessage(specialMessage);
        await chatPage.waitForMessage(specialMessage);
    });
});
//# sourceMappingURL=chat.test.js.map