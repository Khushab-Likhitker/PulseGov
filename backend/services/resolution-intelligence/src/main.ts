import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import neo4j, { Driver, Session } from 'neo4j-driver';
import amqp from 'amqplib';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

let db: Pool;
let neo4jDriver: Driver;
let rabbitChannel: amqp.Channel;

/**
 * RESOLUTION INTELLIGENCE NETWORK
 * 
 * This is the KILLER FEATURE - AI-powered resolution suggestions
 * based on historical complaint data stored in Neo4j graph database
 */

interface SimilarComplaint {
    complaint_id: string;
    title: string;
    description: string;
    resolution_text: string;
    resolution_steps: any[];
    similarity_score: number;
    time_to_resolve_hours: number;
    success_rating: number;
    category_match: boolean;
}

interface ResolutionSuggestion {
    suggested_actions: string[];
    estimated_time_hours: number;
    success_probability: number;
    based_on_cases: number;
}

class ResolutionIntelligence {
    /**
     * Build complaint similarity graph in Neo4j
     */
    async addComplaintToGraph(complaintData: any) {
        const session: Session = neo4jDriver.session();

        try {
            await session.run(
                `
        MERGE (c:Complaint {id: $id})
        SET c.complaint_id = $complaint_id,
            c.title = $title,
            c.description = $description,
            c.category_id = $category_id,
            c.created_at = datetime($created_at)
        
        MERGE (cat:Category {id: $category_id})
        SET cat.name = $category_name
        
        MERGE (c)-[:BELONGS_TO]->(cat)
        `,
                {
                    id: complaintData.id,
                    complaint_id: complaintData.complaint_id,
                    title: complaintData.title,
                    description: complaintData.description,
                    category_id: complaintData.category_id,
                    category_name: complaintData.category_name,
                    created_at: complaintData.created_at
                }
            );

            console.log(`📊 Added complaint ${complaintData.complaint_id} to graph`);
        } finally {
            await session.close();
        }
    }

    /**
     * Add resolution to graph and create similarity links
     */
    async addResolutionToGraph(resolutionData: any) {
        const session: Session = neo4jDriver.session();

        try {
            // Add resolution node
            await session.run(
                `
        MATCH (c:Complaint {id: $complaint_id})
        MERGE (r:Resolution {id: $resolution_id})
        SET r.resolution_text = $resolution_text,
            r.time_to_resolve_hours = $time_to_resolve_hours,
            r.success_rating = $success_rating,
            r.resolved_at = datetime($resolved_at)
        
        MERGE (c)-[:RESOLVED_BY]->(r)
        
        MERGE (o:Officer {id: $officer_id})
        MERGE (r)-[:PERFORMED_BY]->(o)
        `,
                {
                    complaint_id: resolutionData.complaint_id,
                    resolution_id: resolutionData.resolution_id,
                    resolution_text: resolutionData.resolution_text,
                    time_to_resolve_hours: resolutionData.time_to_resolve_hours,
                    success_rating: resolutionData.success_rating || 4,
                    resolved_at: resolutionData.resolved_at,
                    officer_id: resolutionData.officer_id
                }
            );

            // Find and create similarity links
            await this.createSimilarityLinks(resolutionData.complaint_id);

            console.log(`✅ Added resolution for complaint ${resolutionData.complaint_id} to graph`);
        } finally {
            await session.close();
        }
    }

    /**
     * Create similarity relationships between complaints
     * Based on category match and text similarity (simplified)
     */
    async createSimilarityLinks(complaintId: number) {
        const session: Session = neo4jDriver.session();

        try {
            // Find similar complaints in same category
            await session.run(
                `
        MATCH (c1:Complaint {id: $complaintId})-[:BELONGS_TO]->(cat:Category)
        MATCH (c2:Complaint)-[:BELONGS_TO]->(cat)
        WHERE c1.id <> c2.id
        AND EXISTS((c2)-[:RESOLVED_BY]->(:Resolution))
        WITH c1, c2, 
             CASE 
               WHEN c1.title CONTAINS c2.title OR c2.title CONTAINS c1.title THEN 0.8
               ELSE 0.5
             END AS similarity
        WHERE similarity > 0.4
        MERGE (c1)-[s:SIMILAR_TO {score: similarity}]->(c2)
        `,
                { complaintId }
            );
        } finally {
            await session.close();
        }
    }

    /**
     * THE CORE FEATURE: Get AI-powered resolution suggestions
     */
    async getSuggestions(complaintId: number): Promise<{
        similar_complaints: SimilarComplaint[];
        suggestions: ResolutionSuggestion;
    }> {
        const session: Session = neo4jDriver.session();

        try {
            // Find similar resolved complaints
            const result = await session.run(
                `
        MATCH (c:Complaint {id: $complaintId})-[sim:SIMILAR_TO]->(similar:Complaint)
        MATCH (similar)-[:RESOLVED_BY]->(r:Resolution)
        MATCH (c)-[:BELONGS_TO]->(cat:Category)
        MATCH (similar)-[:BELONGS_TO]->(cat)
        RETURN similar.complaint_id as complaint_id,
               similar.title as title,
               similar.description as description,
               r.resolution_text as resolution_text,
               r.time_to_resolve_hours as time_to_resolve_hours,
               r.success_rating as success_rating,
               sim. score as similarity_score
        ORDER BY sim.score DESC, r.success_rating DESC
        LIMIT 5
        `,
                { complaintId }
            );

            const similarComplaints: SimilarComplaint[] = result.records.map(record => ({
                complaint_id: record.get('complaint_id'),
                title: record.get('title'),
                description: record.get('description'),
                resolution_text: record.get('resolution_text'),
                resolution_steps: [],
                similarity_score: record.get('similarity_score'),
                time_to_resolve_hours: record.get('time_to_resolve_hours'),
                success_rating: record.get('success_rating'),
                category_match: true
            }));

            // Generate suggestions based on similar cases
            const suggestions = this.generateSuggestions(similarComplaints);

            return {
                similar_complaints: similarComplaints,
                suggestions
            };
        } finally {
            await session.close();
        }
    }

    /**
     * Generate actionable suggestions from similar complaints
     */
    generateSuggestions(similarComplaints: SimilarComplaint[]): ResolutionSuggestion {
        if (similarComplaints.length === 0) {
            return {
                suggested_actions: ['Inspect the complaint location', 'Contact relevant department', 'Document findings'],
                estimated_time_hours: 48,
                success_probability: 0.5,
                based_on_cases: 0
            };
        }

        // Extract common actions from resolution texts
        const suggestedActions: string[] = [];
        const avgTime = similarComplaints.reduce((sum, c) => sum + c.time_to_resolve_hours, 0) / similarComplaints.length;
        const avgRating = similarComplaints.reduce((sum, c) => sum + c.success_rating, 0) / similarComplaints.length;

        // Add most successful resolution as primary suggestion
        const bestResolution = similarComplaints[0];
        suggestedActions.push(bestResolution.resolution_text);

        // Add common patterns
        suggestedActions.push('Follow up within 24 hours');
        suggestedActions.push('Document resolution with photos');
        suggestedActions.push('Request citizen feedback after completion');

        return {
            suggested_actions: suggestedActions,
            estimated_time_hours: Math.round(avgTime),
            success_probability: Math.min((avgRating / 5.0) * 0.9, 0.95),
            based_on_cases: similarComplaints.length
        };
    }

    /**
     * Get complaint network visualization data
     */
    async getComplaintNetwork(categoryId: number) {
        const session: Session = neo4jDriver.session();

        try {
            const result = await session.run(
                `
        MATCH (c:Complaint)-[:BELONGS_TO]->(cat:Category {id: $categoryId})
        OPTIONAL MATCH (c)-[sim:SIMILAR_TO]-(other:Complaint)
        OPTIONAL MATCH (c)-[:RESOLVED_BY]->(r:Resolution)
        RETURN c, sim, other, r
        LIMIT 50
        `,
                { categoryId }
            );

            // Format for graph visualization
            const nodes = new Set();
            const edges: any[] = [];

            result.records.forEach(record => {
                const complaint = record.get('c');
                nodes.add({
                    id: complaint.properties.id,
                    label: complaint.properties.complaint_id,
                    resolved: record.get('r') !== null
                });

                const similar = record.get('other');
                if (similar) {
                    nodes.add({
                        id: similar.properties.id,
                        label: similar.properties.complaint_id
                    });

                    const simRel = record.get('sim');
                    edges.push({
                        from: complaint.properties.id,
                        to: similar.properties.id,
                        weight: simRel.properties.score
                    });
                }
            });

            return {
                nodes: Array.from(nodes),
                edges
            };
        } finally {
            await session.close();
        }
    }
}

const intelligence = new ResolutionIntelligence();

// RabbitMQ Consumer - Listen for routed and resolved complaints
async function startConsumer() {
    try {
        const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
        rabbitChannel = await connection.createChannel();

        await rabbitChannel.assertQueue('complaint.routed', { durable: true });
        await rabbitChannel.assertQueue('complaint.resolved', { durable: true });

        // Add routed complaints to graph
        rabbitChannel.consume('complaint.routed', async (msg) => {
            if (!msg) return;

            try {
                const data = JSON.parse(msg.content.toString());

                // Get full complaint data from PostgreSQL
                const result = await db.query(
                    `SELECT c.*, cat.name as category_name 
           FROM complaints c 
           LEFT JOIN categories cat ON c.category_id = cat.id 
           WHERE c.id = $1`,
                    [data.complaintId]
                );

                if (result.rows.length > 0) {
                    await intelligence.addComplaintToGraph(result.rows[0]);
                }

                rabbitChannel.ack(msg);
            } catch (error) {
                console.error('❌ Error adding to graph:', error);
                rabbitChannel.nack(msg, false, true);
            }
        });

        // Add resolutions to graph
        rabbitChannel.consume('complaint.resolved', async (msg) => {
            if (!msg) return;

            try {
                const data = JSON.parse(msg.content.toString());

                // Get resolution data
                const result = await db.query(
                    `SELECT r.*, c.id as complaint_id 
           FROM resolutions r 
           JOIN complaints c ON r.complaint_id = c.id 
           WHERE c.id = $1`,
                    [data.complaintId]
                );

                if (result.rows.length > 0) {
                    const resolution = result.rows[0];
                    await intelligence.addResolutionToGraph({
                        complaint_id: resolution.complaint_id,
                        resolution_id: resolution.id,
                        resolution_text: resolution.resolution_text,
                        time_to_resolve_hours: resolution.time_to_resolve_hours,
                        success_rating: resolution.success_rating,
                        officer_id: resolution.officer_id,
                        resolved_at: resolution.created_at
                    });
                }

                rabbitChannel.ack(msg);
            } catch (error) {
                console.error('❌ Error adding resolution:', error);
                rabbitChannel.nack(msg, false, true);
            }
        });

        console.log('🎧 Resolution Intelligence listening...');
    } catch (error) {
        console.error('❌ RabbitMQ connection failed:', error);
        throw error;
    }
}

// API Routes
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'resolution-intelligence' });
});

// Get AI suggestions for a complaint
app.get('/suggestions/:complaintId', async (req, res) => {
    try {
        const complaintId = parseInt(req.params.complaintId);
        const result = await intelligence.getSuggestions(complaintId);
        res.json({ success: true, ...result });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get complaint network visualization
app.get('/network/:categoryId', async (req, res) => {
    try {
        const categoryId = parseInt(req.params.categoryId);
        const network = await intelligence.getComplaintNetwork(categoryId);
        res.json({ success: true, network });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Initialize
async function initialize() {
    try {
        // PostgreSQL
        db = new Pool({ connectionString: process.env.DATABASE_URL });
        await db.query('SELECT NOW()');
        console.log('✅ PostgreSQL connected');

        // Neo4j
        neo4jDriver = neo4j.driver(
            process.env.NEO4J_URL || 'bolt://localhost:7687',
            neo4j.auth.basic(
                process.env.NEO4J_USER || 'neo4j',
                process.env.NEO4J_PASSWORD || 'password'
            )
        );
        await neo4jDriver.verifyConnectivity();
        console.log('✅ Neo4j connected');

        // RabbitMQ
        await startConsumer();

        const PORT = process.env.PORT || 8002;
        app.listen(PORT, () => {
            console.log(`✅ Resolution Intelligence running on port ${PORT}`);
        });
    } catch (error) {
        console.error('❌ Initialization failed:', error);
        process.exit(1);
    }
}

initialize();
