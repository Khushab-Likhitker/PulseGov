import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { createClient } from 'redis';
import amqp from 'amqplib';
import cron from 'node-cron';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

let db: Pool;
let redis: ReturnType<typeof createClient>;
let rabbitChannel: amqp.Channel;

class SLATracker {
    /**
     * Calculate SLA deadline based on category
     */
    async calculateSLADeadline(categoryId: number, createdAt: Date): Promise<Date> {
        const result = await db.query(
            'SELECT sla_hours FROM sla_rules WHERE category_id = $1',
            [categoryId]
        );

        if (result.rows.length === 0) {
            // Default SLA: 48 hours
            return new Date(createdAt.getTime() + 48 * 60 * 60 * 1000);
        }

        const slaHours = result.rows[0].sla_hours;
        return new Date(createdAt.getTime() + slaHours * 60 * 60 * 1000);
    }

    /**
     * Get SLA time remaining in hours
     */
    calculateTimeRemaining(deadline: Date): number {
        const now = new Date();
        const diff = deadline.getTime() - now.getTime();
        return diff / (1000 * 60 * 60); // Convert to hours
    }

    /**
     * Calculate SLA utilization percentage
     */
    async calculateSLAUtilization(complaintId: number): Promise<number> {
        const result = await db.query(
            `SELECT c.created_at, c.sla_deadline, c.resolved_at
       FROM complaints c
       WHERE c.id = $1`,
            [complaintId]
        );

        if (result.rows.length === 0) return 0;

        const { created_at, sla_deadline, resolved_at } = result.rows[0];
        const totalSLA = new Date(sla_deadline).getTime() - new Date(created_at).getTime();
        const elapsed = (resolved_at || new Date()).getTime() - new Date(created_at).getTime();

        return Math.min((elapsed / totalSLA) * 100, 100);
    }

    /**
     * Predictive SLA breach detection using simple heuristics
     * In production, this would use ML model
     */
    async predictSLABreach(complaintId: number): Promise<{ willBreach: boolean; probability: number }> {
        const result = await db.query(
            `SELECT c.*, cat.name as category_name, u.avg_resolution_time_hours, u.active_complaints_count
       FROM complaints c
       LEFT JOIN categories cat ON c.category_id = cat.id
       LEFT JOIN users u ON c.assigned_officer_id = u.id
       WHERE c.id = $1`,
            [complaintId]
        );

        if (result.rows.length === 0) {
            return { willBreach: false, probability: 0 };
        }

        const complaint = result.rows[0];
        const timeRemaining = this.calculateTimeRemaining(new Date(complaint.sla_deadline));
        const officerAvgTime = complaint.avg_resolution_time_hours || 48;
        const officerWorkload = complaint.active_complaints_count || 0;

        // Simple prediction logic
        let riskScore = 0;

        // Factor 1: Officer's average resolution time vs time remaining
        if (officerAvgTime > timeRemaining) {
            riskScore += 40;
        } else if (officerAvgTime > timeRemaining * 0.8) {
            riskScore += 20;
        }

        // Factor 2: Officer workload
        if (officerWorkload > 10) {
            riskScore += 30;
        } else if (officerWorkload > 5) {
            riskScore += 15;
        }

        // Factor 3: Time remaining
        if (timeRemaining < 12) {
            riskScore += 20;
        } else if (timeRemaining < 24) {
            riskScore += 10;
        }

        // Factor 4: Complaint status
        if (complaint.status === 'pending' || complaint.status === 'assigned') {
            riskScore += 10;
        }

        const probability = Math.min(riskScore / 100, 0.95);
        return {
            willBreach: probability > 0.6,
            probability
        };
    }

    /**
     * Check and trigger escalations
     */
    async checkEscalations() {
        const result = await db.query(
            `SELECT c.*, sr.escalation_levels, cat.name as category_name
       FROM complaints c
       LEFT JOIN categories cat ON c.category_id = cat.id
       LEFT JOIN sla_rules sr ON cat.id = sr.category_id
       WHERE c.status NOT IN ('resolved', 'closed') 
       AND c.sla_deadline IS NOT NULL`
        );

        for (const complaint of result.rows) {
            const slaUtilization = await this.calculateSLAUtilization(complaint.id);
            const escalationLevels = complaint.escalation_levels || [];

            for (const level of escalationLevels) {
                // Check if escalation threshold reached
                if (slaUtilization >= level.at_percent) {
                    // Check if already escalated at this level
                    const existingEscalation = await db.query(
                        'SELECT * FROM escalations WHERE complaint_id = $1 AND level = $2',
                        [complaint.id, level.level]
                    );

                    if (existingEscalation.rows.length === 0) {
                        // Trigger escalation
                        await this.triggerEscalation(complaint, level);
                    }
                }
            }

            // Update status if SLA breached
            if (slaUtilization >= 100 && complaint.status !== 'sla_breached') {
                await db.query(
                    `UPDATE complaints 
           SET status = 'sla_breached' 
           WHERE id = $1`,
                    [complaint.id]
                );

                // Publish event
                rabbitChannel.publish(
                    'notifications',
                    'sla.breached',
                    Buffer.from(JSON.stringify({
                        complaintId: complaint.id,
                        complaint_id: complaint.complaint_id,
                        category_name: complaint.category_name
                    })),
                    { persistent: true }
                );

                console.log(`❌ SLA BREACHED: ${complaint.complaint_id}`);
            }
        }
    }

    /**
     * Trigger escalation
     */
    async triggerEscalation(complaint: any, escalationLevel: any) {
        // Find escalation target (simplified - in production, use proper hierarchy)
        const supervisorResult = await db.query(
            `SELECT id FROM users 
       WHERE department_id = $1 
       AND role = 'officer' 
       ORDER BY rating DESC 
       LIMIT 1`,
            [complaint.department_id]
        );

        if (supervisorResult.rows.length === 0) return;

        const supervisorId = supervisorResult.rows[0].id;

        await db.query(
            `INSERT INTO escalations 
       (complaint_id, from_officer_id, to_officer_id, level, reason, auto_escalated) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                complaint.id,
                complaint.assigned_officer_id,
                supervisorId,
                escalationLevel.level,
                `SLA ${escalationLevel.at_percent}% utilized`,
                true
            ]
        );

        // Update assignment
        await db.query(
            `UPDATE complaints 
       SET assigned_officer_id = $1, status = 'escalated' 
       WHERE id = $2`,
            [supervisorId, complaint.id]
        );

        // Publish notification
        rabbitChannel.publish(
            'notifications',
            'complaint.escalated',
            Buffer.from(JSON.stringify({
                complaintId: complaint.id,
                complaint_id: complaint.complaint_id,
                level: escalationLevel.level,
                to_officer_id: supervisorId
            })),
            { persistent: true }
        );

        console.log(`⬆️  Escalated: ${complaint.complaint_id} - Level ${escalationLevel.level}`);
    }
}

const slaTracker = new SLATracker();

// RabbitMQ Consumer
async function startConsumer() {
    try {
        const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
        rabbitChannel = await connection.createChannel();

        await rabbitChannel.assertQueue('complaint.routed', { durable: true });

        rabbitChannel.consume('complaint.routed', async (msg) => {
            if (!msg) return;

            try {
                const data = JSON.parse(msg.content.toString());
                console.log(`📥 SLA tracking started: ${data.complaint_id}`);

                // Calculate SLA deadline
                const complaintResult = await db.query(
                    'SELECT * FROM complaints WHERE id = $1',
                    [data.complaintId]
                );
                const complaint = complaintResult.rows[0];
                const deadline = await slaTracker.calculateSLADeadline(
                    data.category_id,
                    new Date(complaint.created_at)
                );

                // Predict SLA breach
                const prediction = await slaTracker.predictSLABreach(data.complaintId);

                // Update complaint with SLA info
                await db.query(
                    `UPDATE complaints 
           SET sla_deadline = $1, 
               sla_breach_predicted = $2, 
               sla_breach_probability = $3 
           WHERE id = $4`,
                    [deadline, prediction.willBreach, prediction.probability, data.complaintId]
                );

                // Store in Redis for real-time tracking
                await redis.zAdd('sla:active', {
                    score: deadline.getTime(),
                    value: data.complaintId.toString()
                });

                if (prediction.willBreach) {
                    console.log(`⚠️  Predicted SLA breach: ${data.complaint_id} (${(prediction.probability * 100).toFixed(0)}%)`);
                }

                rabbitChannel.ack(msg);
            } catch (error) {
                console.error('❌ SLA tracking error:', error);
                rabbitChannel.nack(msg, false, true);
            }
        });

        console.log('🎧 SLA Tracker listening...');
    } catch (error) {
        console.error('❌ RabbitMQ connection failed:', error);
        throw error;
    }
}

// Cron job to check SLAs every 5 minutes
cron.schedule('*/5 * * * *', async () => {
    console.log('🔍 Checking SLAs and escalations...');
    try {
        await slaTracker.checkEscalations();
    } catch (error) {
        console.error('❌ Escalation check failed:', error);
    }
});

// Initialize
async function initialize() {
    try {
        db = new Pool({ connectionString: process.env.DATABASE_URL });
        await db.query('SELECT NOW()');
        console.log('✅ PostgreSQL connected');

        redis = createClient({ url: process.env.REDIS_URL });
        await redis.connect();
        console.log('✅ Redis connected');

        await startConsumer();

        const PORT = process.env.PORT || 3003;
        app.listen(PORT, () => {
            console.log(`✅ SLA Tracker running on port ${PORT}`);
        });
    } catch (error) {
        console.error('❌ Initialization failed:', error);
        process.exit(1);
    }
}

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'sla-tracker' });
});

// Get SLA status for a complaint
app.get('/sla/:complaintId', async (req, res) => {
    try {
        const complaintId = parseInt(req.params.complaintId);
        const utilization = await slaTracker.calculateSLAUtilization(complaintId);
        const prediction = await slaTracker.predictSLABreach(complaintId);

        res.json({
            success: true,
            sla_utilization: utilization,
            breach_prediction: prediction
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

initialize();
