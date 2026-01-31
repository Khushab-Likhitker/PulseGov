import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { createClient } from 'redis';
import amqp from 'amqplib';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

let db: Pool;
let redis: ReturnType<typeof createClient>;
let rabbitChannel: amqp.Channel;

// Smart Routing Algorithm
interface Officer {
    id: number;
    name: string;
    department_id: number;
    expertise: string[];
    rating: number;
    active_complaints_count: number;
    avg_resolution_time_hours: number;
    location?: { lat: number; lng: number };
}

interface ComplaintLocation {
    lat?: number;
    lng?: number;
    address?: string;
}

class SmartRouter {
    /**
     * Smart routing algorithm considering:
     * 1. Department match
     * 2. Officer expertise
     * 3. Current workload
     * 4. Past performance (rating)
     * 5. Geographic proximity
     */
    async findBestOfficer(
        departmentId: number,
        categoryName: string,
        complaintLocation?: ComplaintLocation
    ): Promise<Officer | null> {
        // Get all officers from department
        const result = await db.query(
            `SELECT * FROM users 
       WHERE department_id = $1 AND role = 'officer' 
       ORDER BY active_complaints_count ASC, rating DESC 
       LIMIT 10`,
            [departmentId]
        );

        const officers: Officer[] = result.rows;

        if (officers.length === 0) {
            return null;
        }

        // Score each officer
        const scoredOfficers = officers.map(officer => {
            let score = 0;

            // 1. Workload score (lower is better) - 40% weight
            const maxWorkload = Math.max(...officers.map(o => o.active_complaints_count), 1);
            const workloadScore = (1 - officer.active_complaints_count / maxWorkload) * 40;
            score += workloadScore;

            // 2. Rating score - 30% weight
            const ratingScore = (officer.rating / 5.0) * 30;
            score += ratingScore;

            // 3. Expertise match - 20% weight
            const keywords = categoryName.toLowerCase().split(' ');
            const expertiseMatch = officer.expertise?.some(exp =>
                keywords.some(kw => exp.toLowerCase().includes(kw))
            );
            score += expertiseMatch ? 20 : 0;

            // 4. Resolution time score (faster is better) - 10% weight
            const avgTime = officer.avg_resolution_time_hours || 48;
            const timeScore = Math.max(0, (100 - avgTime) / 100) * 10;
            score += timeScore;

            return { officer, score };
        });

        // Sort by score descending
        scoredOfficers.sort((a, b) => b.score - a.score);

        return scoredOfficers[0].officer;
    }
}

const router = new SmartRouter();

// RabbitMQ Consumer
async function startConsumer() {
    try {
        const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
        rabbitChannel = await connection.createChannel();

        await rabbitChannel.assertQueue('complaint.classified', { durable: true });
        await rabbitChannel.assertQueue('complaint.routed', { durable: true });

        rabbitChannel.consume('complaint.classified', async (msg) => {
            if (!msg) return;

            try {
                const data = JSON.parse(msg.content.toString());
                console.log(`📥 Received classified complaint: ${data.complaint_id}`);

                // Skip if needs manual review
                if (data.needs_manual_review) {
                    console.log(`⚠️  Complaint ${data.complaint_id} needs manual review`);
                    rabbitChannel.ack(msg);
                    return;
                }

                // Find best officer
                const officer = await router.findBestOfficer(
                    data.department_id,
                    data.category_name
                );

                if (!officer) {
                    console.log(`❌ No officer available for department ${data.department_id}`);
                    rabbitChannel.ack(msg);
                    return;
                }

                // Update complaint in database
                await db.query(
                    `UPDATE complaints 
           SET category_id = $1, 
               category_confidence = $2, 
               department_id = $3, 
               assigned_officer_id = $4, 
               status = 'assigned',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $5`,
                    [
                        data.category_id,
                        data.category_confidence,
                        data.department_id,
                        officer.id,
                        data.complaintId
                    ]
                );

                // Update officer workload
                await db.query(
                    `UPDATE users 
           SET active_complaints_count = active_complaints_count + 1 
           WHERE id = $1`,
                    [officer.id]
                );

                // Log history
                await db.query(
                    `INSERT INTO complaint_history 
           (complaint_id, action, performed_by, notes) 
           VALUES ($1, $2, $3, $4)`,
                    [
                        data.complaintId,
                        'ROUTED',
                        officer.id,
                        `Assigned to ${officer.name} from department ${data.department_id}`
                    ]
                );

                // Publish routed event
                rabbitChannel.publish(
                    'complaints',
                    'complaint.routed',
                    Buffer.from(JSON.stringify({
                        ...data,
                        officer_id: officer.id,
                        officer_name: officer.name
                    })),
                    { persistent: true }
                );

                console.log(`✅ Routed ${data.complaint_id} to ${officer.name}`);
                rabbitChannel.ack(msg);
            } catch (error) {
                console.error('❌ Routing error:', error);
                rabbitChannel.nack(msg, false, true);
            }
        });

        console.log('🎧 Routing engine listening for classified complaints...');
    } catch (error) {
        console.error('❌ RabbitMQ connection failed:', error);
        throw error;
    }
}

// Initialize
async function initialize() {
    try {
        // PostgreSQL
        db = new Pool({ connectionString: process.env.DATABASE_URL });
        await db.query('SELECT NOW()');
        console.log('✅ PostgreSQL connected');

        // Redis
        redis = createClient({ url: process.env.REDIS_URL });
        await redis.connect();
        console.log('✅ Redis connected');

        // RabbitMQ
        await startConsumer();

        const PORT = process.env.PORT || 3002;
        app.listen(PORT, () => {
            console.log(`✅ Routing Engine running on port ${PORT}`);
        });
    } catch (error) {
        console.error('❌ Initialization failed:', error);
        process.exit(1);
    }
}

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'routing-engine' });
});

initialize();
