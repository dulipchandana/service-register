from kafka import KafkaConsumer
import json
import time
import sys

KAFKA_TOPIC = 'chat'
KAFKA_BOOTSTRAP_SERVERS = ['localhost:9092', 'localhost:9093']

print(f"Connecting to Kafka cluster at {KAFKA_BOOTSTRAP_SERVERS}...")
consumer = KafkaConsumer(
    KAFKA_TOPIC,
    bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
    value_deserializer=lambda m: json.loads(m.decode('utf-8')),
    auto_offset_reset='earliest',
    group_id='chat-group',
    security_protocol="PLAINTEXT",
    session_timeout_ms=30000,
    heartbeat_interval_ms=10000
)

print(f"Listening for messages on Kafka topic '{KAFKA_TOPIC}'...")
for message in consumer:
    msg = message.value.get('msg')
    print(f"Received message: {msg}")
