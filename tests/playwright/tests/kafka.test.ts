import { test as baseTest, expect, TestInfo } from '@playwright/test';
import { KafkaHelper } from '../helpers/kafka.helper';
import { Producer, Consumer, KafkaMessage, Partitioners, logLevel } from 'kafkajs';

// Custom interfaces for type safety
interface MessageWithMetadata {
    msg: string;
    sequence?: number;
    __metadata?: {
        partition: number;
        offset: string;
        timestamp: string;
    };
}

const test = baseTest.extend<{ kafkaHelper: KafkaHelper }>({
    kafkaHelper: async ({ }, use) => {
        const helper = new KafkaHelper();
        await use(helper);
    }
});

async function startKafka(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const { exec } = require('child_process');
        // Start both kafka brokers
        const command = "powershell -Command \"Write-Host 'Starting Kafka cluster...'; docker compose start zookeeper kafka1 kafka2; Start-Sleep -Seconds 5\"";
        exec(command, { cwd: 'c:\\Workspace\\docker\\kafka' }, (error: any, stdout: string) => {
            if (error) {
                console.error('Error starting Kafka cluster:', error);
                reject(error);
            } else {
                console.log(stdout);
                resolve();
            }
        });
    });
}

async function stopKafka(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const { exec } = require('child_process');
        // Stop both kafka brokers
        const command = "powershell -Command \"Write-Host 'Stopping Kafka cluster...'; docker compose stop kafka1 kafka2 zookeeper; Start-Sleep -Seconds 5\"";
        exec(command, { cwd: 'c:\\Workspace\\docker\\kafka' }, (error: any, stdout: string) => {
            if (error) {
                console.error('Error stopping Kafka cluster:', error);
                reject(error);
            } else {
                console.log(stdout);
                resolve();
            }
        });
    });
}

const waitForKafka = async (retries = 30, delay = 1000): Promise<boolean> => {
    const helper = new KafkaHelper();
    let admin;
    try {
        admin = helper.kafka.admin();
        await admin.connect();
        
        for (let i = 0; i < retries; i++) {
            try {
                console.log(`Waiting for Kafka (attempt ${i + 1}/${retries})...`);
                const topics = await admin.listTopics();
                const metadata = await admin.fetchTopicMetadata({ topics: ['chat'] });
                
                if (!topics.includes('chat') || !metadata.topics[0].partitions) {
                    console.log('Topic metadata not ready, retrying...');
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                const allPartitionsHaveLeader = metadata.topics[0].partitions.every((p: any) => p.leader !== -1);
                if (allPartitionsHaveLeader) {
                    console.log('Kafka is ready with partition leaders assigned');
                    return true;
                } else {
                    console.log('Waiting for partition leaders...');
                }
            } catch (err) {
                if (i === retries - 1) throw err;
                console.log('Waiting for Kafka metadata...', err);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    } catch (error) {
        console.error('waitForKafka error:', error);
        throw error;
    } finally {
        if (admin) {
            try {
                await admin.disconnect();
            } catch {}
        }
    }
    return false;
};

let globalProducer: Producer;
let globalConsumer: Consumer;

// Use a single test setup to initialize Kafka for all tests
test.beforeAll(async () => {
    test.setTimeout(180000); // Give 3 minutes for the complete setup
    
    console.log('[SETUP] Initializing Kafka cluster...');
    try {
        // Start Kafka if not already running
        await startKafka();
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Wait for Kafka to be ready with generous timeouts
        await waitForKafka(90, 2000);
    } catch (error) {
        console.error('[SETUP] Failed to initialize Kafka cluster:', error);
        throw error;
    }
});

test.beforeEach(async ({ kafkaHelper }) => {
    test.setTimeout(120000); // Give each test 2 minutes
    
    console.log('[TEST SETUP] Initializing test environment...');
    try {
        // Clean up any existing connections
        if (globalConsumer) {
            try {
                await globalConsumer.stop();
                await globalConsumer.disconnect();
            } catch (err) {
                console.warn('[TEST SETUP] Error cleaning up consumer:', err);
            }
        }
        if (globalProducer) {
            try {
                await globalProducer.disconnect();
            } catch (err) {
                console.warn('[TEST SETUP] Error cleaning up producer:', err);
            }
        }
        
        // Wait for any previous connections to fully close
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Create fresh consumer and producer
        console.log('[TEST SETUP] Creating new producer...');
        globalProducer = await kafkaHelper.createProducer();
        
        console.log('[TEST SETUP] Creating new consumer...');
        globalConsumer = await kafkaHelper.createConsumer(`test-group-${Date.now()}`);
        
        console.log('[TEST SETUP] Subscribing consumer to chat topic...');
        await globalConsumer.subscribe({ topic: 'chat', fromBeginning: false });
        
        // Give extra time for connections to stabilize
        console.log('[TEST SETUP] Waiting for connections to stabilize...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        console.log('[TEST SETUP] Test environment ready');
    } catch (error) {
        console.error('[TEST SETUP] Error in test setup:', error);
        throw error;
    }
});

test.afterEach(async ({ kafkaHelper }) => {
    console.log('[TEST CLEANUP] Cleaning up test environment...');
    try {
        // Stop consumer first to avoid it picking up messages during cleanup
        if (globalConsumer) {
            try {
                console.log('[TEST CLEANUP] Stopping consumer...');
                await globalConsumer.stop();
                console.log('[TEST CLEANUP] Disconnecting consumer...');
                await globalConsumer.disconnect();
            } catch (err) {
                console.warn('[TEST CLEANUP] Error cleaning up consumer:', err);
            }
        }
        
        // Then clean up producer
        if (globalProducer) {
            try {
                console.log('[TEST CLEANUP] Disconnecting producer...');
                await globalProducer.disconnect();
            } catch (err) {
                console.warn('[TEST CLEANUP] Error cleaning up producer:', err);
            }
        }
        
        // Wait for connections to fully close
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log('[TEST CLEANUP] Test environment cleanup completed');
    } catch (error) {
        console.error('[TEST CLEANUP] Error in test cleanup:', error);
        throw error;
    }
});

// Final cleanup after all tests
test.afterAll(async ({ }, testInfo) => {
    console.log('[TEARDOWN] Starting final cleanup...');
    try {
        testInfo.setTimeout(120000); // 2 minutes timeout

        // Clean up Kafka clients first
        if (globalConsumer) {
            try {
                console.log('[TEARDOWN] Stopping consumer...');
                await globalConsumer.stop();
                console.log('[TEARDOWN] Disconnecting consumer...');
                await globalConsumer.disconnect();
            } catch (err) {
                console.warn('[TEARDOWN] Error cleaning up consumer:', err);
            }
        }

        if (globalProducer) {
            try {
                console.log('[TEARDOWN] Disconnecting producer...');
                await globalProducer.disconnect();
            } catch (err) {
                console.warn('[TEARDOWN] Error cleaning up producer:', err);
            }
        }

        // Wait for clients to disconnect
        await new Promise(resolve => setTimeout(resolve, 10000));
        console.log('[TEARDOWN] Final cleanup completed');
    } catch (error) {
        console.error('[TEARDOWN] Error in final cleanup:', error);
        throw error;
    }
});

async function collectMessages(kafkaHelper: KafkaHelper, consumer: Consumer, timeoutMs: number = 30000, expectedCount: number = 1): Promise<any[]> {
    const messages: any[] = [];
    let collectionPromise: Promise<any[]>;
    let collectionResolve: (msgs: any[]) => void;
    let collectionReject: (err: Error) => void;
    let collectionTimeout: NodeJS.Timeout | undefined;

    try {
        function processMessage(partition: number, message: KafkaMessage): void {
            if (!message.value) {
                console.warn('Received message with null value');
                return;
            }

            try {
                const value = JSON.parse(message.value.toString());
                console.log(`Received message on partition ${partition}: ${JSON.stringify(value)}`);
                
                messages.push({
                    ...value,
                    __metadata: {
                        partition,
                        offset: message.offset,
                        timestamp: message.timestamp
                    }
                });
                
                console.log(`Current message count: ${messages.length}/${expectedCount}`);
            } catch (error) {
                console.error('Error processing message:', error);
            }
        }

        function getProcessedMessages(): any[] {
            // Sort messages first by sequence number, then by timestamp, then by offset
            const sorted = [...messages].sort((a, b) => {
                if ('sequence' in a && 'sequence' in b) {
                    return (a.sequence as number) - (b.sequence as number);
                }
                const tsA = Number(a.__metadata?.timestamp) || 0;
                const tsB = Number(b.__metadata?.timestamp) || 0;
                if (tsA !== tsB) return tsA - tsB;
                return Number(a.__metadata?.offset || 0) - Number(b.__metadata?.offset || 0);
            });

            // Remove metadata
            return sorted.map(m => {
                const { __metadata, ...rest } = m;
                return rest;
            });
        }

        // Create a promise that will be resolved when we have all the messages
        collectionPromise = new Promise<any[]>((resolve, reject) => {
            collectionResolve = resolve;
            collectionReject = reject;
        });

        // Start consuming messages
        await consumer.run({
            autoCommit: true,
            eachMessage: async ({ partition, message }: { partition: number, message: KafkaMessage }) => {
                processMessage(partition, message);
                
                if (messages.length === expectedCount) {
                    clearTimeout(collectionTimeout);
                    const finalMessages = getProcessedMessages();
                    console.log(`All ${expectedCount} messages received in order`);
                    collectionResolve(finalMessages);
                }
            }
        });

        console.log('Consumer started successfully');

        // Set timeout (increase to 60s for failover scenarios)
        collectionTimeout = setTimeout(() => {
            if (messages.length >= expectedCount) {
                collectionResolve(getProcessedMessages());
            } else {
                console.log(`Collection timeout after ${timeoutMs}ms. Messages received: ${messages.length}/${expectedCount}`);
                if (messages.length > 0) {
                    collectionResolve(getProcessedMessages()); // Return what we have
                } else {
                    collectionReject(new Error(`Timeout waiting for messages. Expected ${expectedCount}, got 0`));
                }
            }
        }, Math.max(timeoutMs, 60000));

        // Wait for messages
        const result = await collectionPromise;
        console.log('Final messages array:', result);
        return result;
    } catch (error) {
        console.error('collectMessages failed:', error);
        throw error;
    } finally {
        if (collectionTimeout) clearTimeout(collectionTimeout);
    }
}

test('should successfully send and receive a message', async ({ kafkaHelper }) => {
    test.setTimeout(60000); // 1 minute timeout
    const testMessage = { msg: 'Test message from Playwright ' + Date.now(), sequence: 1 };
    
    try {
        // Wait for consumer to be ready
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Start collecting messages before sending
        console.log('Starting message collection...');
        const messagesPromise = collectMessages(kafkaHelper, globalConsumer, 30000, 1);
        
        // Wait for consumer to start
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('Sending message:', testMessage);
        await kafkaHelper.sendMessage(globalProducer, testMessage);

        console.log('Waiting for message to be received...');
        const messages = await messagesPromise;
        console.log('Received messages:', messages);
        
        // Check if message was received
        const found = messages.some((m: any) => m.msg === testMessage.msg);
        if (!found) {
            throw new Error(`Message was not received. Expected: ${JSON.stringify(testMessage)}, Received: ${JSON.stringify(messages)}`);
        }
        
        expect(found).toBe(true);
    } catch (error) {
        console.error('Test failed:', error);
        throw error;
    }
});

test('should handle multiple messages in order', async ({ kafkaHelper }) => {
    test.setTimeout(60000); // 1 minute timeout
    const testMessages = [
        { msg: 'First message', sequence: 1 },
        { msg: 'Second message', sequence: 2 },
        { msg: 'Third message', sequence: 3 }
    ];

    try {
        // Wait for consumer to be ready
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Configure producer to use consistent partitioning
        globalProducer = await kafkaHelper.createProducer({ useFixedPartition: true });
        
        console.log('Starting message collection...');
        const messagesPromise = collectMessages(kafkaHelper, globalConsumer, 30000, testMessages.length);
        
        // Wait for consumer to start
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Send messages with small delay to ensure order
        console.log('Sending messages with sequence numbers...');
        for (const msg of testMessages) {
            console.log(`Sending message sequence ${msg.sequence}: ${JSON.stringify(msg)}`);
            await kafkaHelper.sendMessage(globalProducer, msg);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Increased delay between messages
        }

        console.log('Waiting for messages to be received...');
        const receivedMessages = await messagesPromise;
        console.log(`Received ${receivedMessages.length} messages: ${JSON.stringify(receivedMessages)}`);
        
        // Verify each message was received in the correct sequence
        for (let i = 0; i < testMessages.length; i++) {
            const expected = testMessages[i].msg;
            const received = receivedMessages[i]?.msg;
            
            console.log(`Message ${i + 1} comparison:`, {
                expected,
                received,
                match: expected === received
            });
            
            expect(received).toBe(expected);
        }
        
        expect(receivedMessages).toHaveLength(testMessages.length);
    } catch (error) {
        console.error('Test failed:', error);
        throw error;
    }
});

test.skip('should handle broker failover', async ({ kafkaHelper }) => {
    test.setTimeout(120000); // 2 minutes for failover test
    
    const firstMessage = { msg: 'Message before broker failure', sequence: 1 };
    const secondMessage = { msg: 'Message after broker failure', sequence: 2 };
    const allMessages: any[] = [];
    
    // Track partition leadership state
    interface PartitionState {
        partition: number;
        leader: number;
        replicas: number[];
        isr: number[];
    }

    async function getKafkaState(): Promise<{ ready: boolean; state?: PartitionState[] }> {
        const helper = new KafkaHelper();
        const admin = helper.kafka.admin();
        try {
            await admin.connect();
            const topics = await admin.listTopics();
            
            if (topics.includes('chat')) {
                const metadata = await admin.fetchTopicMetadata({ topics: ['chat'] });
                const partitions = metadata.topics[0].partitions;
                
                const partitionStates = partitions.map((p: any) => ({
                    partition: p.partitionId,
                    leader: p.leader,
                    replicas: p.replicas,
                    isr: p.isr
                }));
                
                const allPartitionsHaveLeader = partitions.every((p: any) => p.leader !== -1);
                if (allPartitionsHaveLeader) {
                    return { ready: true, state: partitionStates };
                }
                return { ready: false, state: partitionStates };
            }
            return { ready: false };
        } catch (error) {
            console.log('Kafka not ready:', error);
            return { ready: false };
        } finally {
            try {
                await admin.disconnect();
            } catch {}
        }
    }

    async function waitForBrokerFailover(maxAttempts: number = 60, delayMs: number = 2000): Promise<boolean> {
        let lastState: PartitionState[] | undefined;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            console.log(`Checking broker failover (attempt ${attempt}/${maxAttempts})...`);
            const result = await getKafkaState();
            if (result.ready) {
                if (result.state && lastState) {
                    // Check if leadership has changed
                    const leadershipChanged = result.state.some((current, i) => {
                        const previous = lastState![i];
                        return current.leader !== previous.leader;
                    });
                    if (leadershipChanged) {
                        console.log('Detected leadership change:', {
                            previous: lastState,
                            current: result.state
                        });
                        console.log('Kafka ready after failover with new leadership');
                        // Wait extra for cluster stabilization
                        await new Promise(r => setTimeout(r, 10000));
                        return true;
                    }
                }
                lastState = result.state;
            } else {
                console.log('Kafka not ready yet:', result);
            }
            await new Promise(r => setTimeout(r, delayMs));
        }
        return false;
    }

    try {
        // Wait for initial consumer to be ready
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Phase 1: Send first message to primary broker
        console.log('Phase 1: Setting up initial connection...');
        const firstConsumer = await kafkaHelper.createConsumer(`test-group-${Date.now()}`);
        await firstConsumer.subscribe({ topic: 'chat', fromBeginning: false });

        // Wait for consumer to be ready
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Ensure topic and partition leaders are ready
        let ready = false;
        for (let i = 0; i < 10; i++) {
            try {
                const helper = new KafkaHelper();
                const admin = helper.kafka.admin();
                await admin.connect();
                const topics = await admin.listTopics();
                const metadata = await admin.fetchTopicMetadata({ topics: ['chat'] });
                const allPartitionsHaveLeader = metadata.topics[0].partitions.every((p: any) => p.leader !== -1);
                await admin.disconnect();
                if (topics.includes('chat') && allPartitionsHaveLeader) {
                    ready = true;
                    break;
                }
            } catch {}
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        if (!ready) throw new Error('Topic/partition leaders not ready');

        console.log('Starting first message collection...');
        const firstMessagePromise = collectMessages(kafkaHelper, firstConsumer, 60000, 1);

        // Wait for consumer to start
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log('Sending first message:', firstMessage);
        await kafkaHelper.sendMessage(globalProducer, firstMessage);

        // Collect first phase messages
        const firstPhaseMessages = await firstMessagePromise;
        console.log('First phase messages:', firstPhaseMessages);
        allMessages.push(...firstPhaseMessages);

        await firstConsumer.stop();
        await firstConsumer.disconnect();

        // Stop kafka1 with docker stop
        await new Promise<void>((resolve, reject) => {
            const { exec } = require('child_process');
            const command = "powershell -Command \"Write-Host 'Stopping kafka1...'; docker stop (docker compose ps -q kafka1); Start-Sleep -Seconds 10\"";
            exec(command, { cwd: 'c:\\Workspace\\docker\\kafka' }, (error: any, stdout: string) => {
                if (error) {
                    console.error('Error stopping kafka1:', error);
                    reject(error);
                } else {
                    console.log('kafka1 stop output:', stdout);
                    resolve();
                }
            });
        });

        // Wait for failover to complete (increase attempts and delay)
        const failoverSuccess = await waitForBrokerFailover(60, 2000);
        if (!failoverSuccess) {
            throw new Error('Broker failover check failed');
        }

        // Wait for cluster to stabilize
        await new Promise(resolve => setTimeout(resolve, 15000));

        // Phase 2: Setup new clients
        console.log('Phase 2: Setting up new connections...');
        const secondConsumer = await kafkaHelper.createConsumer(`test-group-${Date.now()}`);
        await secondConsumer.subscribe({ topic: 'chat', fromBeginning: false });

        // Wait for consumer to be ready
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Ensure topic and partition leaders are ready again
        ready = false;
        for (let i = 0; i < 10; i++) {
            try {
                const helper = new KafkaHelper();
                const admin = helper.kafka.admin();
                await admin.connect();
                const topics = await admin.listTopics();
                const metadata = await admin.fetchTopicMetadata({ topics: ['chat'] });
                const allPartitionsHaveLeader = metadata.topics[0].partitions.every((p: any) => p.leader !== -1);
                await admin.disconnect();
                if (topics.includes('chat') && allPartitionsHaveLeader) {
                    ready = true;
                    break;
                }
            } catch {}
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        if (!ready) throw new Error('Topic/partition leaders not ready after failover');

        // Start collecting second phase messages
        console.log('Starting second message collection...');
        const secondMessagePromise = collectMessages(kafkaHelper, secondConsumer, 60000, 1);

        // Wait for consumer to start
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Create a new producer
        const secondProducer = await kafkaHelper.createProducer();

        // Send second message
        console.log('Sending second message:', secondMessage);
        await kafkaHelper.sendMessage(secondProducer, secondMessage);

        // Collect second phase messages
        const secondPhaseMessages = await secondMessagePromise;
        console.log('Second phase messages:', secondPhaseMessages);
        allMessages.push(...secondPhaseMessages);

        await secondConsumer.stop();
        await secondConsumer.disconnect();
        await secondProducer.disconnect();

        // Check results
        expect(allMessages).toHaveLength(2);
        expect(allMessages[0].msg).toBe(firstMessage.msg);
        expect(allMessages[1].msg).toBe(secondMessage.msg);

    } catch (error) {
        console.error('Test failed:', error);
        throw error;
    } finally {
        // Restore the cluster
        console.log('Restoring Kafka cluster...');
        await startKafka();
        await waitForKafka(60, 2000);
    }
});
