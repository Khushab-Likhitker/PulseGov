import amqp, { Connection, Channel } from 'amqplib';

let connection: Connection;
let channel: Channel;

export async function initializeRabbitMQ() {
    try {
        connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
        channel = await connection.createChannel();

        // Declare exchanges
        await channel.assertExchange('complaints', 'topic', { durable: true });
        await channel.assertExchange('notifications', 'topic', { durable: true });

        // Declare queues
        await channel.assertQueue('complaint.created', { durable: true });
        await channel.assertQueue('complaint.classified', { durable: true });
        await channel.assertQueue('complaint.routed', { durable: true });
        await channel.assertQueue('complaint.updated', { durable: true });

        // Bind queues to exchanges
        await channel.bindQueue('complaint.created', 'complaints', 'complaint.created');
        await channel.bindQueue('complaint.classified', 'complaints', 'complaint.classified');
        await channel.bindQueue('complaint.routed', 'complaints', 'complaint.routed');
        await channel.bindQueue('complaint.updated', 'complaints', 'complaint.updated');

        console.log('✅ RabbitMQ connected');
    } catch (error) {
        console.error('❌ RabbitMQ connection failed:', error);
        throw error;
    }
}

export function getRabbitMQ() {
    if (!channel) {
        throw new Error('RabbitMQ not initialized');
    }
    return { connection, channel };
}

export async function publishEvent(exchange: string, routingKey: string, data: any) {
    if (!channel) {
        throw new Error('RabbitMQ not initialized');
    }

    const message = Buffer.from(JSON.stringify(data));
    channel.publish(exchange, routingKey, message, { persistent: true });
}
