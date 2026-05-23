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
    department_id: string; // Changed to string for UUID
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
     */
    async findBestOfficer(
        departmentId: string, // UUID
        categoryName: string,
        complaintLocation?: ComplaintLocation
    ): Promise<Officer | null> {
        try {
            // Get all officers from department
            // Note: cast department_id to uuid if necessary, depending on DB schema consistency
            const result = await db.query(
                `SELECT * FROM users 
                 WHERE department_id::text = $1 AND role = 'officer' 
                 ORDER BY active_complaints_count ASC, rating DESC 
                 LIMIT 10`,
                [departmentId]
            );

            const officers: Officer[] = result.rows;

            if (officers.length === 0) {
                console.log(`⚠️ No officers found for department ${departmentId}`);
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
        } catch (error) {
            console.error("Error finding best officer:", error);
            return null;
        }
    }

    async getDepartmentIdByCode(code: string): Promise<string | null> {
        try {
            const result = await db.query(
                "SELECT id FROM departments WHERE code = $1",
                [code]
            );
            if (result.rows.length > 0) {
                return result.rows[0].id.toString();
            }
            return null;
        } catch (error) {
            console.error(`Error resolving department code ${code}:`, error);
            return null;
        }
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
                    console.log(`⚠️  Complaint ${data.complaint_id} needs manual review. Skipping auto-routing.`);
                    rabbitChannel.ack(msg);
                    return;
                }

                // Resolve Department Code to UUID
                const departmentCode = data.department_code;
                if (!departmentCode) {
                    console.error("❌ Missing department_code in message");
                    rabbitChannel.nack(msg, false, false); // Dead letter
                    return;
                }

                const departmentId = await router.getDepartmentIdByCode(departmentCode);
                if (!departmentId) {
                    console.error(`❌ Could not resolve department code: ${departmentCode}`);
                    // Potentially requeue or log to dead letter
                    rabbitChannel.ack(msg);
                    return;
                }

                // Find best officer using the resolved UUID
                const officer = await router.findBestOfficer(
                    departmentId,
                    data.department_name || 'General' // Use name for basic keyword matching if needed
                );

                if (!officer) {
                    console.log(`❌ No officer available for department ${departmentCode} (${departmentId})`);
                    rabbitChannel.ack(msg);
                    return;
                }

                // Update complaint in database
                // Note: Ensure complaints table expects UUID for department_id if schema changed, 
                // or handle the mismatch. Assuming complaints.department_id is compatible or castable.
                await db.query(
                    `UPDATE complaints 
                     SET category_confidence = $1, 
                         department_id = $2, 
                         assigned_officer_id = $3, 
                         status = 'assigned',
                         updated_at = CURRENT_TIMESTAMP
                     WHERE complaint_id = $4`,
                    [
                        data.confidence,
                        departmentId, // UUID
                        officer.id,
                        data.complaint_id // Using string ID
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
                     VALUES ((SELECT id FROM complaints WHERE complaint_id = $1), $2, $3, $4)`,
                    [
                        data.complaint_id,
                        'ROUTED',
                        officer.id,
                        `Auto-assigned to ${officer.name} (${departmentCode}) based on AI classification.`
                    ]
                );

                // Publish routed event
                rabbitChannel.publish(
                    'complaints',
                    'complaint.routed',
                    Buffer.from(JSON.stringify({
                        ...data,
                        officer_id: officer.id,
                        officer_name: officer.name,
                        routing_notes: `Routed to ${officer.name} in ${data.department_name}`
                    })),
                    { persistent: true }
                );

                console.log(`✅ Routed ${data.complaint_id} to ${officer.name}`);
                rabbitChannel.ack(msg);
            } catch (error) {
                console.error('❌ Routing error:', error);
                // Requeue only if it's a transient error
                rabbitChannel.nack(msg, false, false);
            }
        });

        console.log('🎧 Routing engine listening for classified complaints...');
    } catch (error) {
        console.error('❌ RabbitMQ connection failed:', error);
        // Do not throw, keep retry logic if needed, or let container restart
        setTimeout(startConsumer, 5000);
    }
}

// Helper for resilient connections
async function connectWithRetry(name: string, connectFn: () => Promise<any>, retries = 5, delay = 5000) {
    while (retries > 0) {
        try {
            await connectFn();
            console.log(`✅ ${name} connected`);
            return;
        } catch (error) {
            retries--;
            console.error(`❌ ${name} connection failed. Retrying in ${delay / 1000}s... (${retries} retries left)`);
            if (retries === 0) throw error;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Initialize
async function initialize() {
    try {
        // PostgreSQL
        db = new Pool({ connectionString: process.env.DATABASE_URL });
        await connectWithRetry('PostgreSQL', () => db.query('SELECT NOW()'));

        // Redis
        redis = createClient({ url: process.env.REDIS_URL });
        redis.on('error', (err) => console.error('Redis Client Error', err));
        await connectWithRetry('Redis', () => redis.connect());

        // RabbitMQ
        await connectWithRetry('RabbitMQ', () => startConsumer());

        const PORT = process.env.PORT || 3002;
        app.listen(PORT, () => {
            console.log(`✅ Routing Engine running on port ${PORT}`);
        });
    } catch (error) {
        console.error('❌ Initialization failed:', error);
        // Retry entire initialization after delay
        setTimeout(initialize, 10000);
    }
}

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'routing-engine' });
});

initialize();
