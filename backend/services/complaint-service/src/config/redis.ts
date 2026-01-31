import { createClient } from 'redis';

let redisClient: ReturnType<typeof createClient>;

export async function initializeRedis() {
    redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    redisClient.on('error', (err) => console.error('❌ Redis error:', err));

    await redisClient.connect();
    console.log('✅ Redis connected');
}

export function getRedis() {
    if (!redisClient) {
        throw new Error('Redis not initialized');
    }
    return redisClient;
}
