import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from 'redis';
import amqp from 'amqplib';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

let redis: ReturnType<typeof createClient>;
let rabbitChannel: amqp.Channel;
let emailTransporter: nodemailer.Transporter;

// Notification templates
const templates = {
    complaint_created: {
        subject: 'Complaint Submitted Successfully - {complaint_id}',
        body: `Dear {citizen_name},\n\nYour complaint has been successfully submitted.\n\nComplaint ID: {complaint_id}\nStatus: Pending Classification\n\nYou will receive updates as your complaint is processed.\n\nThank you,\nPulseGov Team`
    },
    complaint_routed: {
        subject: 'Complaint Assigned - {complaint_id}',
        body: `Dear {citizen_name},\n\nYour complaint has been assigned to an officer.\n\nComplaint ID: {complaint_id}\nAssigned to: {officer_name}\nDepartment: {department_name}\nExpected Resolution: {sla_deadline}\n\nThank you,\nPulseGov Team`
    },
    complaint_resolved: {
        subject: 'Complaint Resolved - {complaint_id}',
        body: `Dear {citizen_name},\n\nYour complaint has been resolved.\n\nComplaint ID: {complaint_id}\nResolution: {resolution_text}\n\nPlease provide feedback on the resolution.\n\nThank you,\nPulseGov Team`
    },
    sla_warning: {
        subject: 'SLA Alert - {complaint_id}',
        body: `Dear Officer,\n\nComplaint {complaint_id} is approaching SLA deadline.\n\nTime Remaining: {time_remaining} hours\nCurrent Status: {status}\n\nPlease take action.\n\nPulseGov System`
    },
    sla_breached: {
        subject: 'SLA BREACHED - {complaint_id}',
        body: `URGENT: SLA has been breached for complaint {complaint_id}.\n\nThis requires immediate attention.\n\nPulseGov System`
    },
    escalation: {
        subject: 'Complaint Escalated - {complaint_id}',
        body: `Complaint {complaint_id} has been escalated to you.\n\nLevel: {escalation_level}\nReason: {reason}\n\nPlease review immediately.\n\nPulseGov System`
    }
};

class NotificationService {
    /**
     * Send email notification with retry logic
     */
    async sendEmail(to: string, template: string, data: any, retryCount = 0): Promise<boolean> {
        const maxRetries = 3;

        try {
            const templateData = templates[template as keyof typeof templates];
            if (!templateData) {
                console.error(`Template ${template} not found`);
                return false;
            }

            // Replace placeholders
            let subject = templateData.subject;
            let body = templateData.body;

            for (const [key, value] of Object.entries(data)) {
                subject = subject.replace(`{${key}}`, String(value));
                body = body.replace(`{${key}}`, String(value));
            }

            await emailTransporter.sendMail({
                from: process.env.SMTP_USER,
                to,
                subject,
                text: body
            });

            console.log(`✅ Email sent to ${to}: ${template}`);
            return true;
        } catch (error) {
            console.error(`❌ Email send failed (attempt ${retryCount + 1}):`, error);

            if (retryCount < maxRetries) {
                // Exponential backoff
                const delay = Math.pow(2, retryCount) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.sendEmail(to, template, data, retryCount + 1);
            }

            return false;
        }
    }

    /**
     * Send SMS notification (simulated - integrate with Twilio/AWS SNS in production)
     */
    async sendSMS(to: string, message: string): Promise<boolean> {
        console.log(`📱 SMS to ${to}: ${message}`);
        // In production: integrate with Twilio, AWS SNS, or other SMS provider
        return true;
    }

    /**
     * Send push notification (simulated - integrate with FCM in production)
     */
    async sendPush(userId: string, notification: any): Promise<boolean> {
        console.log(`🔔 Push to user ${userId}:`, notification);
        // In production: integrate with Firebase Cloud Messaging
        return true;
    }
}

const notificationService = new NotificationService();

// RabbitMQ Consumer
async function startConsumer() {
    try {
        const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
        rabbitChannel = await connection.createChannel();

        // Listen to notification exchange
        await rabbitChannel.assertExchange('notifications', 'topic', { durable: true });
        const queue = await rabbitChannel.assertQueue('', { exclusive: true });

        // Bind to all notification events
        await rabbitChannel.bindQueue(queue.queue, 'notifications', '#');

        rabbitChannel.consume(queue.queue, async (msg) => {
            if (!msg) return;

            try {
                const event = msg.fields.routingKey;
                const data = JSON.parse(msg.content.toString());

                console.log(`📥 Notification event: ${event}`);

                // Route to appropriate handler
                switch (event) {
                    case 'complaint.created':
                        await notificationService.sendEmail(
                            data.citizen_email,
                            'complaint_created',
                            data
                        );
                        break;

                    case 'complaint.routed':
                        await notificationService.sendEmail(
                            data.citizen_email,
                            'complaint_routed',
                            data
                        );
                        await notificationService.sendEmail(
                            data.officer_email,
                            'new_assignment',
                            data
                        );
                        break;

                    case 'complaint.resolved':
                        await notificationService.sendEmail(
                            data.citizen_email,
                            'complaint_resolved',
                            data
                        );
                        break;

                    case 'sla.warning':
                        await notificationService.sendEmail(
                            data.officer_email,
                            'sla_warning',
                            data
                        );
                        await notificationService.sendSMS(data.officer_phone, `SLA Warning: ${data.complaint_id}`);
                        break;

                    case 'sla.breached':
                        await notificationService.sendEmail(
                            data.officer_email,
                            'sla_breached',
                            data
                        );
                        await notificationService.sendSMS(data.officer_phone, `URGENT: SLA BREACHED ${data.complaint_id}`);
                        break;

                    case 'complaint.escalated':
                        await notificationService.sendEmail(
                            data.to_officer_email,
                            'escalation',
                            data
                        );
                        break;
                }

                rabbitChannel.ack(msg);
            } catch (error) {
                console.error('❌ Notification error:', error);
                rabbitChannel.nack(msg, false, true);
            }
        });

        console.log('🎧 Notification service listening...');
    } catch (error) {
        console.error('❌ RabbitMQ connection failed:', error);
        throw error;
    }
}

// Initialize
async function initialize() {
    try {
        // Redis
        redis = createClient({ url: process.env.REDIS_URL });
        await redis.connect();
        console.log('✅ Redis connected');

        // Email transporter
        emailTransporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
        console.log('✅ Email transporter configured');

        // RabbitMQ
        await startConsumer();

        const PORT = process.env.PORT || 3004;
        app.listen(PORT, () => {
            console.log(`✅ Notification Service running on port ${PORT}`);
        });
    } catch (error) {
        console.error('❌ Initialization failed:', error);
        process.exit(1);
    }
}

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'notification-service' });
});

initialize();
