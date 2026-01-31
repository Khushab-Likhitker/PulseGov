import { Server as SocketIOServer } from 'socket.io';

export function setupWebSocket(io: SocketIOServer) {
    io.on('connection', (socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);

        // Join room for specific complaint updates
        socket.on('subscribe:complaint', (complaintId: string) => {
            socket.join(`complaint:${complaintId}`);
            console.log(`📡 Client subscribed to complaint: ${complaintId}`);
        });

        // Join room for user-specific notifications
        socket.on('subscribe:user', (userId: string) => {
            socket.join(`user:${userId}`);
            console.log(`📡 Client subscribed to user: ${userId}`);
        });

        socket.on('disconnect', () => {
            console.log(`🔌 Client disconnected: ${socket.id}`);
        });
    });
}

// Helper function to emit complaint updates
export function emitComplaintUpdate(io: SocketIOServer, complaintId: string, data: any) {
    io.to(`complaint:${complaintId}`).emit('complaint:update', data);
}

// Helper function to emit user notifications
export function emitUserNotification(io: SocketIOServer, userId: string, data: any) {
    io.to(`user:${userId}`).emit('notification', data);
}
