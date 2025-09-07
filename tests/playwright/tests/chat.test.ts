import { test, expect, Page, Browser } from '@playwright/test';
import { ChatPage } from '../helpers/chat.page';

test.describe('Chat Application Tests', () => {
    let chatPage: ChatPage;

    test.beforeEach(async ({ page }) => {
        chatPage = new ChatPage(page);
        await chatPage.goto();
    });

    test('should load the main chat page', async ({ page }) => {
        await expect(page).toHaveTitle('Chat Application');
        await expect(page.locator('h1')).toHaveText('Chat Application');
    });

    test('should be able to send a message', async () => {
        const testMessage = 'Test message ' + Date.now();
        await chatPage.sendMessage(testMessage);
        await chatPage.waitForMessage(testMessage);
    });

    test('should display messages across multiple clients', async ({ browser }) => {
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();
        
        const page1 = await context1.newPage();
        const page2 = await context2.newPage();
        
        const chatPage1 = new ChatPage(page1);
        const chatPage2 = new ChatPage(page2);
        
        await chatPage1.goto();
        await chatPage2.goto();
        
        const testMessage = 'Cross-client test message ' + Date.now();
        await chatPage1.sendMessage(testMessage);
        await chatPage2.waitForMessage(testMessage);
        
        await context1.close();
        await context2.close();
    });

    test('should persist messages across page reloads', async ({ page }) => {
        const testMessage = 'Persistence test message ' + Date.now();
        await chatPage.sendMessage(testMessage);
        
        await page.reload();
        await chatPage.waitForMessage(testMessage);
    });

    test('should handle special characters in messages', async () => {
        const specialMessage = '!@#$%^&*()_+ Special चाराक्टर्स 你好 👋';
        await chatPage.sendMessage(specialMessage);
        await chatPage.waitForMessage(specialMessage);
    });
});
