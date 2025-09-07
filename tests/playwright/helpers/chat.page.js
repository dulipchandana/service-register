"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatPage = void 0;
class ChatPage {
    constructor(page) {
        this.page = page;
        this.messageInput = '#message';
        this.sendButton = '#send';
        this.messageContent = '.message-content';
    }
    async goto() {
        await this.page.goto('/');
    }
    async sendMessage(message) {
        await this.page.fill(this.messageInput, message);
        await this.page.click(this.sendButton);
    }
    async getMessages() {
        return this.page.locator(this.messageContent).allTextContents();
    }
    async waitForMessage(message) {
        await this.page.locator(this.messageContent).filter({ hasText: message }).waitFor();
    }
}
exports.ChatPage = ChatPage;
//# sourceMappingURL=chat.page.js.map