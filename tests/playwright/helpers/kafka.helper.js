"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KafkaHelper = void 0;
const kafkajs_1 = require("kafkajs");
class KafkaHelper {
    constructor() {
        this.kafka = new kafkajs_1.Kafka({
            clientId: 'playwright-test',
            brokers: ['localhost:9092', 'localhost:9093']
        });
    }
    async createProducer() {
        const producer = this.kafka.producer();
        await producer.connect();
        return producer;
    }
    async createConsumer(groupId = 'test-group') {
        const consumer = this.kafka.consumer({ groupId });
        await consumer.connect();
        await consumer.subscribe({ topic: 'chat', fromBeginning: true });
        return consumer;
    }
    async sendMessage(producer, message) {
        await producer.send({
            topic: 'chat',
            messages: [{ value: JSON.stringify(message) }]
        });
    }
    async cleanup(producer, consumer) {
        if (producer)
            await producer.disconnect();
        if (consumer)
            await consumer.disconnect();
    }
}
exports.KafkaHelper = KafkaHelper;
//# sourceMappingURL=kafka.helper.js.map