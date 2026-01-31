import pika
import json
import os
from classifier import ComplaintClassifier

def start_consumer(classifier: ComplaintClassifier):
    """
    RabbitMQ consumer that listens for new complaints and classifies them
    """
    rabbitmq_url = os.getenv('RABBITMQ_URL', 'amqp://pulsegov:pulsegov123@localhost:5672')
    
    try:
        # Connect to RabbitMQ
        params = pika.URLParameters(rabbitmq_url)
        connection = pika.BlockingConnection(params)
        channel = connection.channel()
        
        # Declare queues
        channel.queue_declare(queue='complaint.created', durable=True)
        channel.queue_declare(queue='complaint.classified', durable=True)
        
        def callback(ch, method, properties, body):
            """Process incoming complaint"""
            try:
                data = json.loads(body)
                print(f"📥 Received complaint: {data.get('complaint_id')}")
                
                # Classify the complaint
                result = classifier.classify(
                    text=data.get('description', ''),
                    title=data.get('title', '')
                )
                
                # Prepare classified data
                classified_data = {
                    'complaintId': data['complaintId'],
                    'complaint_id': data['complaint_id'],
                    'category_id': result['category_id'],
                    'category_name': result['category_name'],
                    'category_confidence': result['confidence'],
                    'department_id': result['department_id'],
                    'keywords_matched': result['keywords_matched'],
                    'needs_manual_review': result['needs_manual_review']
                }
                
                # Publish to classified queue
                channel.basic_publish(
                    exchange='complaints',
                    routing_key='complaint.classified',
                    body=json.dumps(classified_data),
                    properties=pika.BasicProperties(delivery_mode=2)  # persistent
                )
                
                print(f"✅ Classified: {data['complaint_id']} -> {result['category_name']} ({result['confidence']:.2f})")
                
                # Acknowledge message
                ch.basic_ack(delivery_tag=method.delivery_tag)
                
            except Exception as e:
                print(f"❌ Error processing complaint: {e}")
                # Reject and requeue on error
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
        
        # Start consuming
        channel.basic_qos(prefetch_count=1)
        channel.basic_consume(queue='complaint.created', on_message_callback=callback)
        
        print('🎧 Waiting for complaints to classify...')
        channel.start_consuming()
        
    except Exception as e:
        print(f"❌ RabbitMQ consumer error: {e}")
        raise
