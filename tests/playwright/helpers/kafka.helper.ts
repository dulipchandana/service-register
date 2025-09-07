import { Kafka, Producer, Consumer, Message, Partitioners } from 'kafkajs';

interface ChatMessage {
    msg: string;
}

export class KafkaHelper {
    public kafka: Kafka; // Changed to public for broker failover test

    constructor() {
        this.kafka = new Kafka({
            clientId: 'playwright-test',
            brokers: ['localhost:9092', 'localhost:9093'],
            retry: {
                initialRetryTime: 1000,
                retries: 30,
                maxRetryTime: 60000,
                factor: 0.5,
            },
            connectionTimeout: 30000,
            requestTimeout: 60000,
            enforceRequestTimeout: true,
            logLevel: 2 // INFO
        });
    }

    async waitForConnection(maxAttempts: number = 30, delayMs: number = 2000): Promise<void> {
        let lastError: Error | null = null;
        let admin;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`[${new Date().toISOString()}] Attempt ${attempt}/${maxAttempts} to connect to Kafka...`);
                admin = this.kafka.admin();
                await admin.connect();

                // First check if we can list topics
                const topics = await admin.listTopics();
                console.log(`[${new Date().toISOString()}] Connected to Kafka. Available topics:`, topics);

                // Check if chat topic exists
                if (!topics.includes('chat')) {
                    console.log(`[${new Date().toISOString()}] Creating chat topic...`);
                    await admin.createTopics({
                        topics: [{
                            topic: 'chat',
                            numPartitions: 2,
                            replicationFactor: 2,
                            configEntries: [
                                { name: 'min.insync.replicas', value: '1' }
                            ]
                        }]
                    });
                    console.log(`[${new Date().toISOString()}] Chat topic created successfully`);
                }

                // Verify topic metadata and leadership
                const metadata = await admin.fetchTopicMetadata({ topics: ['chat'] });
                const partitions = metadata.topics[0].partitions;

                // Detailed partition state logging
                console.log(`[${new Date().toISOString()}] Topic metadata:`, JSON.stringify({
                    topic: 'chat',
                    partitions: partitions.map(p => ({
                        id: p.partitionId,
                        leader: p.leader,
                        replicas: p.replicas,
                        isr: p.isr
                    }))
                }, null, 2));

                const allPartitionsHaveLeader = partitions.every(p => p.leader !== -1);
                const allPartitionsHaveReplicas = partitions.every(p => p.replicas.length > 0);
                const allPartitionsHaveISR = partitions.every(p => p.isr.length > 0);

                if (!allPartitionsHaveLeader || !allPartitionsHaveReplicas || !allPartitionsHaveISR) {
                    throw new Error('Topic is not fully ready: ' + JSON.stringify({
                        hasLeaders: allPartitionsHaveLeader,
                        hasReplicas: allPartitionsHaveReplicas,
                        hasISR: allPartitionsHaveISR
                    }));
                }

                console.log(`[${new Date().toISOString()}] Kafka connection verified successfully`);
                return;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                console.log(`[${new Date().toISOString()}] Connection attempt ${attempt} failed:`, lastError.message);

                if (attempt === maxAttempts) {
                    console.error(`[${new Date().toISOString()}] All connection attempts failed. Last error:`, lastError);
                    throw lastError;
                }

                // Exponential backoff with jitter
                const backoff = Math.min(delayMs * Math.pow(1.5, attempt), 30000);
                const jitter = Math.floor(Math.random() * 1000);
                const waitTime = backoff + jitter;
                console.log(`[${new Date().toISOString()}] Waiting ${waitTime}ms before next attempt...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            } finally {
                if (admin) {
                    try {
                        await admin.disconnect();
                    } catch (error) {
                        console.warn(`[${new Date().toISOString()}] Error disconnecting admin client:`, error);
                    }
                }
            }
        }
    }

    async createProducer(options?: { useFixedPartition?: boolean }): Promise<Producer> {
        try {
            await this.waitForConnection();
            const producer = this.kafka.producer({
                createPartitioner: options?.useFixedPartition 
                    ? Partitioners.LegacyPartitioner // Use legacy partitioner which is more predictable
                    : undefined, // Let KafkaJS choose the best partitioner
                retry: {
                    initialRetryTime: 1000,
                    retries: 30,
                    maxRetryTime: 60000,
                    factor: 0.5
                },
                transactionTimeout: 60000,
                idempotent: true, // Enable exactly-once delivery semantics
                maxInFlightRequests: 1
            });
            await producer.connect();
            return producer;
        } catch (error) {
            throw new Error(`Failed to create producer: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async createConsumer(groupId: string = 'test-group'): Promise<Consumer> {
        try {
            await this.waitForConnection();
            const consumer = this.kafka.consumer({ 
                groupId,
                sessionTimeout: 60000,
                rebalanceTimeout: 120000,
                heartbeatInterval: 5000,
                retry: {
                    initialRetryTime: 1000,
                    maxRetryTime: 60000,
                    retries: 30,
                    factor: 0.5
                },
                readUncommitted: false, // Only read committed messages
                maxWaitTimeInMs: 5000, // Max time to wait for batch of messages
                minBytes: 1, // Minimum bytes to wait for
                maxBytes: 1024 * 1024 // Maximum bytes to fetch
            });
            await consumer.connect();
            return consumer;
        } catch (error) {
            throw new Error(`Failed to create consumer: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async sendMessage(producer: Producer, message: ChatMessage): Promise<void> {
        await producer.send({
            topic: 'chat',
            messages: [{ value: JSON.stringify(message) }]
        });
    }

    async cleanup(producer?: Producer, consumer?: Consumer): Promise<void> {
        if (consumer) {
            try {
                console.log(`[${new Date().toISOString()}] Stopping consumer...`);
                await consumer.stop();
                console.log(`[${new Date().toISOString()}] Disconnecting consumer...`);
                await consumer.disconnect();
                console.log(`[${new Date().toISOString()}] Consumer cleanup completed`);
            } catch (error) {
                console.warn(`[${new Date().toISOString()}] Error during consumer cleanup:`, error);
            }
        }

        if (producer) {
            try {
                console.log(`[${new Date().toISOString()}] Disconnecting producer...`);
                await producer.disconnect();
                console.log(`[${new Date().toISOString()}] Producer cleanup completed`);
            } catch (error) {
                console.warn(`[${new Date().toISOString()}] Error during producer cleanup:`, error);
            }
        }

        // Give some time for connections to fully close
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}
