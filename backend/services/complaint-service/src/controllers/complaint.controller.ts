import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database';
import { publishEvent } from '../config/rabbitmq';
import { io } from '../main';
import { emitComplaintUpdate, emitUserNotification } from '../websocket/socket';

// Create new complaint
export async function createComplaint(req: Request, res: Response) {
    const db = getDb();
    const { title, description, location, citizen_id, category_id, department_id } = req.body;

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
       (complaint_id, citizen_id, title, description, location, attachments, status, category_id, department_id, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP) 
       RETURNING *`,
            [
                complaintId,
                citizen_id,
                title,
                description,
                location ? JSON.stringify(location) : null,
                JSON.stringify(attachments),
                'pending',
                category_id || null,
                department_id || null
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

// ENTERPRISE: Get officer complaints with server-side sorting, filtering, search, and pagination
export async function getOfficerComplaints(req: Request, res: Response) {
    const db = getDb();
    const {
        officer_id,
        status,
        category_id,
        department_id,
        sla_breached_only,
        search,
        sort = 'created_at',
        order = 'desc',
        page = '1',
        limit = '10'
    } = req.query;

    if (!officer_id) {
        return res.status(400).json({ error: 'officer_id is required' });
    }

    try {
        // Validate sort column to prevent SQL injection
        const validSortColumns = ['created_at', 'sla_deadline', 'priority', 'status', 'title'];
        const sortCol = validSortColumns.includes(sort as string) ? sort : 'created_at';
        const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

        // Build base query with JOINs
        let baseQuery = `
            FROM complaints c
            LEFT JOIN categories cat ON c.category_id = cat.id
            LEFT JOIN departments dept ON c.department_id = dept.id
            LEFT JOIN users officer ON c.assigned_officer_id = officer.id
            LEFT JOIN users citizen ON c.citizen_id = citizen.id
            WHERE c.assigned_officer_id = $1
        `;

        const params: any[] = [officer_id];
        let paramIndex = 2;

        // Status filter
        if (status && status !== '') {
            baseQuery += ` AND c.status = $${paramIndex++}`;
            params.push(status);
        }

        // Category filter
        if (category_id && category_id !== '') {
            baseQuery += ` AND c.category_id = $${paramIndex++}`;
            params.push(category_id);
        }

        // Department filter
        if (department_id && department_id !== '') {
            baseQuery += ` AND c.department_id = $${paramIndex++}`;
            params.push(department_id);
        }

        // SLA Breached only
        if (sla_breached_only === 'true') {
            baseQuery += ` AND (c.status = 'sla_breached' OR c.sla_deadline < NOW())`;
        }

        // Search (complaint ID or title)
        if (search && search !== '') {
            baseQuery += ` AND (c.complaint_id ILIKE $${paramIndex} OR c.title ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        // Get total count
        const countQuery = `SELECT COUNT(*) ${baseQuery}`;
        const countResult = await db.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count);

        // Calculate pagination
        const pageNum = Math.max(1, parseInt(page as string));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
        const offset = (pageNum - 1) * limitNum;

        // Build data query with sorting and pagination
        const dataQuery = `
            SELECT 
                c.id,
                c.complaint_id,
                c.title,
                c.description,
                c.status,
                c.priority,
                c.created_at,
                c.updated_at,
                c.sla_deadline,
                c.resolved_at,
                c.resolution_text,
                c.citizen_rating,
                cat.id as category_id,
                cat.name as category_name,
                dept.id as department_id,
                dept.name as department_name,
                officer.name as assigned_officer_name,
                citizen.name as citizen_name,
                citizen.email as citizen_email,
                CASE WHEN c.sla_deadline < NOW() AND c.status NOT IN ('resolved', 'closed') THEN true ELSE false END as is_sla_breached
            ${baseQuery}
            ORDER BY c.${sortCol} ${sortOrder}
            LIMIT $${paramIndex++} OFFSET $${paramIndex}
        `;
        params.push(limitNum, offset);

        const result = await db.query(dataQuery, params);

        res.json({
            success: true,
            data: result.rows,
            total: total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum)
        });
    } catch (error: any) {
        console.error('Error fetching officer complaints:', error);
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

// Escalate complaint
export async function escalateComplaint(req: Request, res: Response) {
    const db = getDb();
    const { id } = req.params;
    const { reason, from_officer_id, to_officer_id, level } = req.body;

    try {
        const complaintResult = await db.query(
            'SELECT id FROM complaints WHERE complaint_id = $1',
            [id]
        );

        if (complaintResult.rows.length === 0) {
            return res.status(404).json({ error: 'Complaint not found' });
        }

        const complaintDbId = complaintResult.rows[0].id;

        // Update complaint status and assignment
        await db.query(
            `UPDATE complaints 
             SET status = 'escalated', assigned_officer_id = $1 
             WHERE id = $2`,
            [to_officer_id, complaintDbId]
        );

        // Record escalation
        await db.query(
            `INSERT INTO escalations 
             (complaint_id, from_officer_id, to_officer_id, level, reason) 
             VALUES ($1, $2, $3, $4, $5)`,
            [complaintDbId, from_officer_id, to_officer_id, level || 1, reason]
        );

        // History
        await db.query(
            `INSERT INTO complaint_history 
             (complaint_id, action, performed_by, notes) 
             VALUES ($1, $2, $3, $4)`,
            [complaintDbId, 'ESCALATED', from_officer_id, reason]
        );

        res.json({ success: true, message: 'Complaint escalated successfully' });
    } catch (error: any) {
        res.status(500).json({ error: 'Escalation failed', message: error.message });
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

// Analytics and KPI endpoints
export async function getOfficerAnalytics(req: Request, res: Response) {
    const db = getDb();
    const { officer_id } = req.query;

    if (!officer_id) {
        return res.status(400).json({ error: 'officer_id is required' });
    }

    try {
        // 1. KPI Counts
        const kpiResult = await db.query(
            `SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
                COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
                COUNT(*) FILTER (WHERE status = 'sla_breached') as breached
             FROM complaints 
             WHERE assigned_officer_id = $1`,
            [officer_id]
        );

        // 2. Status Distribution (Bar Chart)
        const statusDist = await db.query(
            `SELECT status, COUNT(*) as count 
             FROM complaints 
             WHERE assigned_officer_id = $1 
             GROUP BY status`,
            [officer_id]
        );

        // 3. SLA Compliance (Pie Chart)
        const slaCompliance = await db.query(
            `SELECT 
                CASE WHEN status = 'sla_breached' THEN 'Breached' ELSE 'Compliant' END as label,
                COUNT(*) as value
             FROM complaints 
             WHERE assigned_officer_id = $1
             GROUP BY label`,
            [officer_id]
        );

        // 4. Monthly Trend (Line Chart)
        const trend = await db.query(
            `SELECT 
                TO_CHAR(created_at, 'Mon YYYY') as month,
                COUNT(*) as count
             FROM complaints 
             WHERE assigned_officer_id = $1
             GROUP BY month, DATE_TRUNC('month', created_at)
             ORDER BY DATE_TRUNC('month', created_at) DESC
             LIMIT 6`,
            [officer_id]
        );

        // 5. Category Distribution (Bar Chart)
        const categoryDist = await db.query(
            `SELECT cat.name as category, COUNT(*) as count
             FROM complaints c
             JOIN categories cat ON c.category_id = cat.id
             WHERE c.assigned_officer_id = $1
             GROUP BY cat.name
             LIMIT 5`,
            [officer_id]
        );

        // 6. Avg Resolution Time (Bar Chart)
        const resolutionTimes = await db.query(
            `SELECT cat.name as category, ROUND(AVG(EXTRACT(EPOCH FROM (c.resolved_at - c.created_at))/3600), 2) as avg_hours
             FROM complaints c
             JOIN categories cat ON c.category_id = cat.id
             WHERE c.assigned_officer_id = $1 AND c.resolved_at IS NOT NULL
             GROUP BY cat.name`,
            [officer_id]
        );

        res.json({
            success: true,
            analytics: {
                kpis: kpiResult.rows[0],
                statusDist: statusDist.rows,
                slaCompliance: slaCompliance.rows,
                trend: trend.rows.reverse(),
                categoryDist: categoryDist.rows,
                resolutionTimes: resolutionTimes.rows
            }
        });
    } catch (error: any) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
}

// Preparation and Seeding Logic
export async function prepareOfficerDashboard(req: Request, res: Response) {
    const db = getDb();
    const { officer_id } = req.body;

    if (!officer_id) {
        return res.status(400).json({ error: 'officer_id is required' });
    }

    try {
        // First, verify the officer exists
        const officerCheck = await db.query('SELECT id, department_id FROM users WHERE id = $1', [officer_id]);
        if (officerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Officer not found' });
        }

        // Check if officer has any complaints
        const checkResult = await db.query(
            'SELECT COUNT(*) FROM complaints WHERE assigned_officer_id = $1',
            [officer_id]
        );

        const count = parseInt(checkResult.rows[0].count);

        if (count === 0) {
            console.log(`Seeding demo data for officer ${officer_id}...`);

            // Attempt seeding with retry logic
            let seeded = false;
            let retries = 3;
            let lastError = null;

            while (retries > 0 && !seeded) {
                try {
                    await seedOfficerComplaints(officer_id);
                    seeded = true;
                } catch (seedError: any) {
                    lastError = seedError;
                    retries--;
                    console.log(`Seeding attempt failed, ${retries} retries left:`, seedError.message);
                    if (retries > 0) await new Promise(r => setTimeout(r, 500));
                }
            }

            if (seeded) {
                return res.json({ success: true, seeded: true, message: 'Dashboard prepared with demo intelligence.' });
            } else {
                // Graceful degradation - return success but note seeding failed
                console.error('Seeding ultimately failed after retries:', lastError?.message);
                return res.json({
                    success: true,
                    seeded: false,
                    warning: 'Demo data could not be loaded, dashboard will show empty state',
                    message: 'Intelligence ready (empty state).'
                });
            }
        }

        res.json({ success: true, seeded: false, message: 'Intelligence ready.' });
    } catch (error: any) {
        console.error('Preparation failed:', error);
        // Even on error, try to return a recoverable response
        res.json({
            success: true,
            seeded: false,
            warning: 'Preparation had issues but dashboard can proceed',
            message: error.message
        });
    }
}

async function seedOfficerComplaints(officerId: number) {
    const db = getDb();

    try {
        // 1. Get officer info
        const officerResult = await db.query('SELECT department_id FROM users WHERE id = $1', [officerId]);
        if (officerResult.rows.length === 0) {
            console.log(`Officer ${officerId} not found, skipping seeding`);
            return;
        }
        const deptId = officerResult.rows[0].department_id;

        // 2. Get categories for this department
        const catResult = await db.query('SELECT id FROM categories WHERE department_id = $1', [deptId]);
        let categories = catResult.rows.map(r => r.id);
        if (categories.length === 0) {
            // Fallback to all categories if department has none
            const allCat = await db.query('SELECT id FROM categories LIMIT 5');
            categories = allCat.rows.map(r => r.id);
        }

        if (categories.length === 0) {
            console.log('No categories found, skipping seeding');
            return;
        }

        // 3. Get some citizens
        const citizenResult = await db.query("SELECT id FROM users WHERE role = 'citizen' LIMIT 10");
        let citizens = citizenResult.rows.map(r => r.id);

        // If no citizens exist, create a demo citizen
        if (citizens.length === 0) {
            const newCitizen = await db.query(
                "INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id",
                ['demo.citizen@gov.in', '$2b$10$demo', 'Demo Citizen', 'citizen']
            );
            citizens = [newCitizen.rows[0].id];
        }

        const statuses = ['pending', 'in_progress', 'resolved', 'escalated', 'sla_breached'];
        const priorities = ['low', 'medium', 'high'];

        // Generate 20 complaints
        for (let i = 1; i <= 20; i++) {
            const citizenId = citizens[Math.floor(Math.random() * citizens.length)];
            const categoryId = categories[Math.floor(Math.random() * categories.length)];
            const status = statuses[i % statuses.length];
            const priority = priorities[i % priorities.length];
            const complaintId = `GOV-${deptId}-${Date.now() % 10000}-${i}`;

            // Random dates in last 30 days
            const daysAgo = Math.floor(Math.random() * 30);
            const createdAt = new Date();
            createdAt.setDate(createdAt.getDate() - daysAgo);

            const slaDeadline = new Date(createdAt);
            slaDeadline.setDate(slaDeadline.getDate() + 7); // 7 day SLA

            const resolvedAt = status === 'resolved' ? new Date() : null;

            const title = `Issue Report #${1000 + i}: Internal System Audit`;
            const description = `This is a generated grievance dossier for system verification. Citizen reports functional irregularities in sector ${i}. High priority administrative attention required.`;

            const result = await db.query(
                `INSERT INTO complaints 
                 (complaint_id, citizen_id, title, description, category_id, department_id, assigned_officer_id, status, priority, created_at, sla_deadline, resolved_at) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                 RETURNING id`,
                [complaintId, citizenId, title, description, categoryId, deptId, officerId, status, priority, createdAt, slaDeadline, resolvedAt]
            );

            // If status is resolved, add resolution record
            if (status === 'resolved') {
                const complaintDbId = result.rows[0].id;
                const timeToResolve = Math.floor(Math.random() * 72) + 1; // 1-72 hours
                await db.query(
                    `INSERT INTO resolutions (complaint_id, resolution_text, officer_id, time_to_resolve_hours, success_rating) 
                     VALUES ($1, $2, $3, $4, $5)`,
                    [complaintDbId, 'Issue analyzed and resolved by administrative protocol.', officerId, timeToResolve, Math.floor(Math.random() * 2) + 4]
                );
            }
        }

        console.log(`Successfully seeded 20 complaints for officer ${officerId}`);
    } catch (error: any) {
        console.error(`Error seeding complaints for officer ${officerId}:`, error);
        throw error;
    }
}


// Master Data
export async function getDepartments(req: Request, res: Response) {
    try {
        const db = getDb();
        const result = await db.query('SELECT id, name, code FROM departments ORDER BY name');
        res.json({ success: true, departments: result.rows });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch departments' });
    }
}

export async function getCategories(req: Request, res: Response) {
    try {
        const db = getDb();
        const result = await db.query('SELECT id, name, code, department_id FROM categories ORDER BY name');
        res.json({ success: true, categories: result.rows });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch categories' });
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
