import { Request, Response } from 'express';
import { getDb } from '../config/database';
import bcrypt from 'bcryptjs';

export async function register(req: Request, res: Response) {
    const db = getDb();
    const { email, password, name, phone, role, department_id, aadhaar, district, state, pincode } = req.body;

    try {
        if (!email || !password || !name || !role) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Hash password
        const password_hash = await bcrypt.hash(password, 10);

        const result = await db.query(
            `INSERT INTO users (email, password_hash, name, phone, role, department_id, aadhaar, district, state, pincode) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
             RETURNING id, email, name, phone, role, department_id, aadhaar, district, state, pincode`,
            [email, password_hash, name, phone, role, department_id || null, aadhaar || null, district || null, state || null, pincode || null]
        );

        res.status(201).json({ success: true, user: result.rows[0] });
    } catch (error: any) {
        console.error('Registration error:', error);

        // Handle duplicate email (Postgres 23505)
        if (error.code === '23505') {
            return res.status(400).json({
                error: 'Account already exists',
                message: 'This email is already registered. Please login or use a different email.'
            });
        }

        res.status(500).json({ error: 'Registration failed', message: error.message });
    }
}

export async function login(req: Request, res: Response) {
    const db = getDb();
    const { email, password } = req.body;

    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);

        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                department_id: user.department_id,
                aadhaar: user.aadhaar,
                district: user.district,
                state: user.state,
                pincode: user.pincode,
                phone: user.phone
            }
        });
    } catch (error: any) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed', message: error.message });
    }
}
