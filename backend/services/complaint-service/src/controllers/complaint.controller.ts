import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database';
import { publishEvent } from '../config/rabbitmq';
import { io } from '../main';
import { emitComplaintUpdate, emitUserNotification } from '../websocket/socket';

// Create new complaint
export async function createComplaint(req: Request, res: Response) {
    const db = getDb();
    const { title, description, location, citizen_id } = req.body;

    try {
        // Validate input
        if (!title || !description || !citizen_id) {
            return res.status(400).json({
                error: 'Missing required fields: title, description, citizen_id'
            });
        }

        // Generate unique complaint ID
        const complaintId = `CMP-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;

        // Handle file attachments
        const attachments = req.files ? (req.files as Express.Multer.File[]).map(file => ({
            filename: file.originalname,
            path: file.path,
            mimetype: file.mimetype,
            size: file.size
        })) : [];

        // Insert complaint into database
        const result = await db.query(
            `INSERT INTO complaints 
       (complaint_id, citizen_id, title, description, location, attachments, status, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP) 
       RETURNING *`,
            [
                complaintId,
                citizen_id,
                title,
                description,
                location ? JSON.stringify(location) : null,
                JSON.stringify(attachments),
                'pending'
            ]
        );

        const complaint = result.rows[0];

        // Log to complaint history
        await db.query(
            `INSERT INTO complaint_history 
       (complaint_id, action, performed_by, new_state, created_at) 
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
            [complaint.id, 'CREATED', citizen_id, JSON.stringify(complaint)]
        );

        // Publish event to RabbitMQ for classification
        await publishEvent('complaints', 'complaint.created', {
            complaintId: complaint.id,
            complaint_id: complaintId,
            title,
            description,
            citizen_id
        });

        // Emit real-time update to citizen
        emitUserNotification(io, citizen_id.toString(), {
            type: 'complaint_created',
            complaintId: complaintId,
            message: 'Your complaint has been submitted successfully'
        });

        res.status(201).json({
            success: true,
            complaint: {
                id: complaint.id,
                complaint_id: complaintId,
                title: complaint.title,
                status: complaint.status,
                created_at: complaint.created_at
            }
        });
    } catch (error: any) {
        console.error('Error creating complaint:', error);
        res.status(500).json({ error: 'Failed to create complaint', message: error.message });
    }
}

// Get single complaint by ID
export async function getComplaint(req: Request, res: Response) {
    const db = getDb();
    const { id } = req.params;

    try {
        const result = await db.query(
            `SELECT c.*, 
              cat.name as category_name,
              dept.name as department_name,
              u.name as assigned_officer_name,
              citizen.name as citizen_name,
              citizen.email as citizen_email
       FROM complaints c
       LEFT JOIN categories cat ON c.category_id = cat.id
       LEFT JOIN departments dept ON c.department_id = dept.id
       LEFT JOIN users u ON c.assigned_officer_id = u.id
       LEFT JOIN users citizen ON c.citizen_id = citizen.id
       WHERE c.complaint_id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Complaint not found' });
        }

        res.json({ success: true, complaint: result.rows[0] });
    } catch (error: any) {
        console.error('Error fetching complaint:', error);
        res.status(500).json({ error: 'Failed to fetch complaint', message: error.message });
    }
}

// Get all complaints with filters
export async function getComplaints(req: Request, res: Response) {
    const db = getDb();
    const {
        citizen_id,
        officer_id,
        status,
        department_id,
        category_id,
        limit = 50,
        offset = 0
    } = req.query;

    try {
        let query = `
      SELECT c.*, 
             cat.name as category_name,
             dept.name as department_name,
             u.name as assigned_officer_name
      FROM complaints c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN departments dept ON c.department_id = dept.id
      LEFT JOIN users u ON c.assigned_officer_id = u.id
      WHERE 1=1
    `;

        const params: any[] = [];
        let paramIndex = 1;

        if (citizen_id) {
            query += ` AND c.citizen_id = $${paramIndex++}`;
            params.push(citizen_id);
        }

        if (officer_id) {
            query += ` AND c.assigned_officer_id = $${paramIndex++}`;
            params.push(officer_id);
        }

        if (status) {
            query += ` AND c.status = $${paramIndex++}`;
            params.push(status);
        }

        if (department_id) {
            query += ` AND c.department_id = $${paramIndex++}`;
            params.push(department_id);
        }

        if (category_id) {
            query += ` AND c.category_id = $${paramIndex++}`;
            params.push(category_id);
        }

        query += ` ORDER BY c.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(limit, offset);

        const result = await db.query(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM complaints WHERE 1=1';
        const countParams: any[] = [];
        let countIndex = 1;

        if (citizen_id) {
            countQuery += ` AND citizen_id = $${countIndex++}`;
            countParams.push(citizen_id);
        }
        if (officer_id) {
            countQuery += ` AND assigned_officer_id = $${countIndex++}`;
            countParams.push(officer_id);
        }
        if (status) {
            countQuery += ` AND status = $${countIndex++}`;
            countParams.push(status);
        }
        if (department_id) {
            countQuery += ` AND department_id = $${countIndex++}`;
            countParams.push(department_id);
        }
        if (category_id) {
            countQuery += ` AND category_id = $${countIndex++}`;
            countParams.push(category_id);
        }

        const countResult = await db.query(countQuery, countParams);

        res.json({
            success: true,
            complaints: result.rows,
            pagination: {
                total: parseInt(countResult.rows[0].count),
                limit: parseInt(limit as string),
                offset: parseInt(offset as string)
            }
        });
    } catch (error: any) {
        console.error('Error fetching complaints:', error);
        res.status(500).json({ error: 'Failed to fetch complaints', message: error.message });
    }
}

// Update complaint status
export async function updateComplaintStatus(req: Request, res: Response) {
    const db = getDb();
    const { id } = req.params;
    const { status, notes, performed_by } = req.body;

    try {
        const validStatuses = ['pending', 'assigned', 'in_progress', 'resolved', 'closed', 'escalated', 'sla_breached'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Get current complaint state
        const currentResult = await db.query(
            'SELECT * FROM complaints WHERE complaint_id = $1',
            [id]
        );

        if (currentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Complaint not found' });
        }

        const previousState = currentResult.rows[0];

        // Update complaint
        const result = await db.query(
            `UPDATE complaints 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE complaint_id = $2 
       RETURNING *`,
            [status, id]
        );

        const updatedComplaint = result.rows[0];

        // Log history
        await db.query(
            `INSERT INTO complaint_history 
       (complaint_id, action, performed_by, previous_state, new_state, notes) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                updatedComplaint.id,
                'STATUS_UPDATED',
                performed_by,
                JSON.stringify(previousState),
                JSON.stringify(updatedComplaint),
                notes
            ]
        );

        // Publish event
        await publishEvent('complaints', 'complaint.updated', {
            complaintId: updatedComplaint.id,
            complaint_id: id,
            status,
            previousStatus: previousState.status
        });

        // Emit real-time update
        emitComplaintUpdate(io, id, {
            type: 'status_updated',
            status,
            updated_at: updatedComplaint.updated_at
        });

        res.json({ success: true, complaint: updatedComplaint });
    } catch (error: any) {
        console.error('Error updating complaint:', error);
        res.status(500).json({ error: 'Failed to update complaint', message: error.message });
    }
}

// Resolve complaint
export async function resolveComplaint(req: Request, res: Response) {
    const db = getDb();
    const { id } = req.params;
    const { resolution_text, resolution_steps, officer_id } = req.body;

    try {
        // Get complaint
        const complaintResult = await db.query(
            'SELECT * FROM complaints WHERE complaint_id = $1',
            [id]
        );

        if (complaintResult.rows.length === 0) {
            return res.status(404).json({ error: 'Complaint not found' });
        }

        const complaint = complaintResult.rows[0];

        // Calculate resolution time
        const createdAt = new Date(complaint.created_at);
        const resolvedAt = new Date();
        const timeToResolveHours = (resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

        // Update complaint
        await db.query(
            `UPDATE complaints 
       SET status = 'resolved', 
           resolution_text = $1, 
           resolved_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP 
       WHERE complaint_id = $2`,
            [resolution_text, id]
        );

        // Insert resolution record
        await db.query(
            `INSERT INTO resolutions 
       (complaint_id, resolution_text, resolution_steps, time_to_resolve_hours, officer_id) 
       VALUES ($1, $2, $3, $4, $5)`,
            [complaint.id, resolution_text, JSON.stringify(resolution_steps), timeToResolveHours, officer_id]
        );

        // Log history
        await db.query(
            `INSERT INTO complaint_history 
       (complaint_id, action, performed_by, notes) 
       VALUES ($1, $2, $3, $4)`,
            [complaint.id, 'RESOLVED', officer_id, resolution_text]
        );

        // Update officer stats
        await db.query(
            `UPDATE users 
       SET total_resolved_count = total_resolved_count + 1,
           active_complaints_count = active_complaints_count - 1,
           avg_resolution_time_hours = (
             (avg_resolution_time_hours * total_resolved_count + $1) / (total_resolved_count + 1)
           )
       WHERE id = $2`,
            [timeToResolveHours, officer_id]
        );

        // Publish resolution event
        await publishEvent('complaints', 'complaint.resolved', {
            complaintId: complaint.id,
            complaint_id: id,
            officer_id,
            resolution_time_hours: timeToResolveHours
        });

        // Emit updates
        emitComplaintUpdate(io, id, {
            type: 'resolved',
            resolution_text,
            resolved_at: resolvedAt
        });

        emitUserNotification(io, complaint.citizen_id.toString(), {
            type: 'complaint_resolved',
            complaintId: id,
            message: 'Your complaint has been resolved'
        });

        res.json({
            success: true,
            message: 'Complaint resolved successfully',
            resolution_time_hours: timeToResolveHours
        });
    } catch (error: any) {
        console.error('Error resolving complaint:', error);
        res.status(500).json({ error: 'Failed to resolve complaint', message: error.message });
    }
}

// Get complaint history
export async function getComplaintHistory(req: Request, res: Response) {
    const db = getDb();
    const { id } = req.params;

    try {
        // Get complaint ID from complaint_id
        const complaintResult = await db.query(
            'SELECT id FROM complaints WHERE complaint_id = $1',
            [id]
        );

        if (complaintResult.rows.length === 0) {
            return res.status(404).json({ error: 'Complaint not found' });
        }

        const complaintDbId = complaintResult.rows[0].id;

        const result = await db.query(
            `SELECT ch.*, u.name as performed_by_name
       FROM complaint_history ch
       LEFT JOIN users u ON ch.performed_by = u.id
       WHERE ch.complaint_id = $1
       ORDER BY ch.created_at DESC`,
            [complaintDbId]
        );

        res.json({ success: true, history: result.rows });
    } catch (error: any) {
        console.error('Error fetching complaint history:', error);
        res.status(500).json({ error: 'Failed to fetch history', message: error.message });
    }
}

// Upload attachment
export async function uploadAttachment(req: Request, res: Response) {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const db = getDb();

        const attachment = {
            filename: file.originalname,
            path: file.path,
            mimetype: file.mimetype,
            size: file.size,
            uploaded_at: new Date().toISOString()
        };

        await db.query(
            `UPDATE complaints 
       SET attachments = attachments || $1::jsonb 
       WHERE complaint_id = $2`,
            [JSON.stringify(attachment), id]
        );

        res.json({ success: true, attachment });
    } catch (error: any) {
        console.error('Error uploading attachment:', error);
        res.status(500).json({ error: 'Failed to upload attachment', message: error.message });
    }
}
