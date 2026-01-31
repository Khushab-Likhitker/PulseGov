import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import complaintRoutes from './routes/complaint.routes';
import { initializeDatabase } from './config/database';
import { initializeRedis } from './config/redis';
import { initializeRabbitMQ } from './config/rabbitmq';
import { setupWebSocket } from './websocket/socket';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/complaints', complaintRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'complaint-service' });
});

// Initialize services
async function initialize() {
    try {
        await initializeDatabase();
        await initializeRedis();
        await initializeRabbitMQ();
        setupWebSocket(io);

        const PORT = process.env.PORT || 3001;
        httpServer.listen(PORT, () => {
            console.log(`✅ Complaint Service running on port ${PORT}`);
        });
    } catch (error) {
        console.error('❌ Failed to initialize service:', error);
        process.exit(1);
    }
}

initialize();

export { io };
