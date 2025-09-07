async function collectMessages(kafkaHelper: KafkaHelper, consumer: Consumer, timeoutMs: number = 2000, expectedCount: number = 1): Promise<any[]> {
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
            eachMessage: async ({ partition, message }) => {
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

        // Set timeout
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
        }, timeoutMs);

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

export { collectMessages };
