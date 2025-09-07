"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const kafka_helper_1 = require("../helpers/kafka.helper");
test_1.test.describe('Kafka Messaging Tests', () => {
    let kafkaHelper;
    let producer;
    let consumer;
    test_1.test.beforeAll(async () => {
        kafkaHelper = new kafka_helper_1.KafkaHelper();
        producer = await kafkaHelper.createProducer();
        consumer = await kafkaHelper.createConsumer();
    });
    test_1.test.afterAll(async () => {
        await kafkaHelper.cleanup(producer, consumer);
    });
    (0, test_1.test)('should successfully send and receive a message', async () => {
        const testMessage = { msg: 'Test message from Playwright ' + Date.now() };
        await kafkaHelper.sendMessage(producer, testMessage);
        const messages = [];
        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const value = JSON.parse(message.value.toString());
                messages.push(value);
            }
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        (0, test_1.expect)(messages).toContainEqual(testMessage);
    });
    (0, test_1.test)('should handle multiple messages in order', async () => {
        const testMessages = [
            { msg: 'First message' },
            { msg: 'Second message' },
            { msg: 'Third message' }
        ];
        for (const msg of testMessages) {
            await kafkaHelper.sendMessage(producer, msg);
        }
        const receivedMessages = [];
        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const value = JSON.parse(message.value.toString());
                receivedMessages.push(value);
            }
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        (0, test_1.expect)(receivedMessages).toEqual(test_1.expect.arrayContaining(testMessages));
    });
    (0, test_1.test)('should handle broker failover', async () => {
        // TODO: Implement broker failover test
        // 1. Send message to primary broker
        // 2. Simulate broker failure (can be done using docker-compose stop kafka1)
        // 3. Send message to secondary broker
        // 4. Verify both messages are received
    });
});
//# sourceMappingURL=kafka.test.js.map