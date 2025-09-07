from kafka import KafkaProducer
import json

KAFKA_TOPIC = 'chat'
KAFKA_BOOTSTRAP_SERVERS = ['localhost:9092', 'localhost:9093']

producer = KafkaProducer(
    bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
    value_serializer=lambda v: json.dumps(v).encode('utf-8'),
    security_protocol="PLAINTEXT"
)

try:
    msg = input('Enter message to send to Kafka: ')
    future = producer.send(KAFKA_TOPIC, {'msg': msg})
    record_metadata = future.get(timeout=10)
    producer.flush()
    print(f"Message sent successfully to Kafka topic '{KAFKA_TOPIC}' at partition {record_metadata.partition}, offset {record_metadata.offset}")
except Exception as e:
    print(f"Error sending message to Kafka: {str(e)}")
finally:
    producer.close()
