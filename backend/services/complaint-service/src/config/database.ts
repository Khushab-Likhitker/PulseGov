import { Pool } from 'pg';

let pool: Pool;

export async function initializeDatabase() {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });

    try {
        const client = await pool.connect();
        console.log('✅ PostgreSQL connected');
        client.release();
    } catch (error) {
        console.error('❌ PostgreSQL connection failed. Retrying in 5s...', error);
        await new Promise(resolve => setTimeout(resolve, 5000));
        return initializeDatabase();
    }
}

export function getDb() {
    if (!pool) {
        throw new Error('Database not initialized');
    }
    return pool;
}
