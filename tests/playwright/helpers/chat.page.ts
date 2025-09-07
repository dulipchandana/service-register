import { Page, Locator } from '@playwright/test';

export class ChatPage {
    private page: Page;
    private messageInput: string;
    private sendButton: string;
    private messageContent: string;

    constructor(page: Page) {
        this.page = page;
        this.messageInput = '#message';
        this.sendButton = '#send';
        this.messageContent = '.message-content';
    }

    async goto(): Promise<void> {
        await this.page.goto('/');
    }

    async sendMessage(message: string): Promise<void> {
        await this.page.fill(this.messageInput, message);
        await this.page.click(this.sendButton);
    }

    async getMessages(): Promise<string[]> {
        return this.page.locator(this.messageContent).allTextContents();
    }

    async waitForMessage(message: string): Promise<void> {
        await this.page.locator(this.messageContent).filter({ hasText: message }).waitFor();
    }
}
