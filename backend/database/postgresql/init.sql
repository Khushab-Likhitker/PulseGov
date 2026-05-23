-- PulseGov Database Schema

-- Users table (Citizens, Officers, Admins)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL CHECK (role IN ('citizen', 'officer', 'admin')),
    department_id INTEGER,
    aadhaar VARCHAR(20),
    district VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    expertise JSONB DEFAULT '[]',
    rating DECIMAL(3,2) DEFAULT 0.0,
    active_complaints_count INTEGER DEFAULT 0,
    total_resolved_count INTEGER DEFAULT 0,
    avg_resolution_time_hours DECIMAL(10,2) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Departments table
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    head_officer_id INTEGER,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    jurisdiction JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    department_id INTEGER REFERENCES departments(id),
    keywords JSONB DEFAULT '[]',
    priority_level VARCHAR(20) DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SLA Rules table
CREATE TABLE sla_rules (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id),
    sla_hours INTEGER NOT NULL,
    first_response_hours INTEGER,
    escalation_levels JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Complaints table
CREATE TABLE complaints (
    id SERIAL PRIMARY KEY,
    complaint_id VARCHAR(50) UNIQUE NOT NULL,
    citizen_id INTEGER REFERENCES users(id) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    category_confidence DECIMAL(5,4),
    department_id INTEGER REFERENCES departments(id),
    assigned_officer_id INTEGER REFERENCES users(id),
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'resolved', 'closed', 'escalated', 'sla_breached')),
    location JSONB,
    attachments JSONB DEFAULT '[]',
    sla_deadline TIMESTAMP,
    sla_breach_predicted BOOLEAN DEFAULT false,
    sla_breach_probability DECIMAL(5,4),
    resolved_at TIMESTAMP,
    resolution_text TEXT,
    citizen_rating INTEGER CHECK (citizen_rating >= 1 AND citizen_rating <= 5),
    citizen_feedback TEXT,
    duplicate_of INTEGER REFERENCES complaints(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Complaint History (Audit Trail)
CREATE TABLE complaint_history (
    id SERIAL PRIMARY KEY,
    complaint_id INTEGER REFERENCES complaints(id) NOT NULL,
    action VARCHAR(100) NOT NULL,
    performed_by INTEGER REFERENCES users(id),
    previous_state JSONB,
    new_state JSONB,
    notes TEXT,
    blockchain_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Escalations table
CREATE TABLE escalations (
    id SERIAL PRIMARY KEY,
    complaint_id INTEGER REFERENCES complaints(id) NOT NULL,
    from_officer_id INTEGER REFERENCES users(id),
    to_officer_id INTEGER REFERENCES users(id) NOT NULL,
    level INTEGER NOT NULL,
    reason VARCHAR(255) NOT NULL,
    auto_escalated BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Resolutions table (for ML learning)
CREATE TABLE resolutions (
    id SERIAL PRIMARY KEY,
    complaint_id INTEGER REFERENCES complaints(id) NOT NULL,
    resolution_text TEXT NOT NULL,
    resolution_steps JSONB,
    time_to_resolve_hours DECIMAL(10,2),
    success_rating INTEGER CHECK (success_rating >= 1 AND success_rating <= 5),
    officer_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    complaint_id INTEGER REFERENCES complaints(id),
    type VARCHAR(50) NOT NULL,
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'whatsapp')),
    message TEXT NOT NULL,
    sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Collaboration Sessions (for multi-department complaints)
CREATE TABLE collaboration_sessions (
    id SERIAL PRIMARY KEY,
    complaint_id INTEGER REFERENCES complaints(id) NOT NULL,
    participants JSONB NOT NULL,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP
);

-- Blockchain Ledger (metadata only, actual chain is in Hyperledger)
CREATE TABLE blockchain_ledger (
    id SERIAL PRIMARY KEY,
    complaint_id INTEGER REFERENCES complaints(id) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    transaction_hash VARCHAR(255) UNIQUE NOT NULL,
    block_number INTEGER,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_complaints_citizen ON complaints(citizen_id);
CREATE INDEX idx_complaints_officer ON complaints(assigned_officer_id);
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_complaints_category ON complaints(category_id);
CREATE INDEX idx_complaints_department ON complaints(department_id);
CREATE INDEX idx_complaints_created ON complaints(created_at DESC);
CREATE INDEX idx_complaint_history_complaint ON complaint_history(complaint_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_sent ON notifications(sent);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_complaints_updated_at BEFORE UPDATE ON complaints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample departments
INSERT INTO departments (name, code, description) VALUES
('Electricity Department', 'ELEC', 'Handles power supply, streetlights, electrical issues'),
('Water & Sanitation', 'WATER', 'Water supply, drainage, sewage issues'),
('Roads & Infrastructure', 'ROADS', 'Road repairs, potholes, traffic signals'),
('Garbage Management', 'GARBAGE', 'Waste collection, cleanliness, recycling'),
('Public Health', 'HEALTH', 'Health hazards, epidemic control'),
('Police', 'POLICE', 'Law and order, safety concerns'),
('Fire Safety', 'FIRE', 'Fire incidents, building safety'),
('Environment', 'ENV', 'Pollution, tree cutting, environmental issues');

-- Insert sample categories
INSERT INTO categories (name, code, department_id, keywords, priority_level) VALUES
('Streetlight Not Working', 'LIGHT-001', 1, '["streetlight", "light", "bulb", "dark", "night"]', 'medium'),
('Power Outage', 'POWER-001', 1, '["power", "electricity", "outage", "blackout", "supply"]', 'high'),
('Water Leakage', 'WATER-001', 2, '["water", "leak", "pipe", "burst", "overflow"]', 'high'),
('No Water Supply', 'WATER-002', 2, '["water", "supply", "tap", "shortage"]', 'high'),
('Pothole on Road', 'ROAD-001', 3, '["pothole", "road", "damage", "crater"]', 'medium'),
('Garbage Not Collected', 'GARB-001', 4, '["garbage", "waste", "trash", "collection"]', 'medium'),
('Overflowing Dustbin', 'GARB-002', 4, '["dustbin", "overflow", "bin", "full"]', 'low'),
('Stray Animals', 'HEALTH-001', 5, '["dog", "stray", "animal", "bite"]', 'medium'),
('Mosquito Menace', 'HEALTH-002', 5, '["mosquito", "dengue", "malaria", "insect"]', 'medium'),
('Illegal Parking', 'POLICE-001', 6, '["parking", "illegal", "vehicle", "block"]', 'low'),
('Noise Pollution', 'ENV-001', 8, '["noise", "sound", "loud", "pollution"]', 'low'),
('Tree Fallen', 'ENV-002', 8, '["tree", "fallen", "branch", "blocking"]', 'high');

-- Insert SLA rules
INSERT INTO sla_rules (category_id, sla_hours, first_response_hours, escalation_levels) VALUES
(1, 48, 12, '[{"level": 1, "at_percent": 80, "escalate_to": "supervisor"}, {"level": 2, "at_percent": 100, "escalate_to": "department_head"}]'),
(2, 24, 4, '[{"level": 1, "at_percent": 75, "escalate_to": "supervisor"}, {"level": 2, "at_percent": 100, "escalate_to": "department_head"}]'),
(3, 12, 2, '[{"level": 1, "at_percent": 75, "escalate_to": "supervisor"}, {"level": 2, "at_percent": 100, "escalate_to": "emergency_team"}]'),
(4, 8, 2, '[{"level": 1, "at_percent": 75, "escalate_to": "supervisor"}, {"level": 2, "at_percent": 100, "escalate_to": "emergency_team"}]'),
(5, 72, 24, '[{"level": 1, "at_percent": 85, "escalate_to": "supervisor"}, {"level": 2, "at_percent": 100, "escalate_to": "department_head"}]'),
(6, 48, 12, '[{"level": 1, "at_percent": 80, "escalate_to": "supervisor"}, {"level": 2, "at_percent": 100, "escalate_to": "department_head"}]'),
(7, 24, 8, '[{"level": 1, "at_percent": 80, "escalate_to": "supervisor"}]'),
(8, 48, 12, '[{"level": 1, "at_percent": 80, "escalate_to": "health_officer"}]'),
(9, 72, 24, '[{"level": 1, "at_percent": 85, "escalate_to": "health_officer"}]'),
(10, 24, 6, '[{"level": 1, "at_percent": 80, "escalate_to": "senior_officer"}]'),
(11, 48, 12, '[{"level": 1, "at_percent": 80, "escalate_to": "supervisor"}]'),
(12, 6, 1, '[{"level": 1, "at_percent": 75, "escalate_to": "emergency_team"}, {"level": 2, "at_percent": 100, "escalate_to": "municipal_head"}]');

-- Insert sample users
INSERT INTO users (email, password_hash, name, phone, role, department_id, expertise, rating) VALUES
-- Citizens
('john.doe@example.com', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'John Doe', '+919876543210', 'citizen', NULL, '[]', 0),
('jane.smith@example.com', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'Jane Smith', '+919876543211', 'citizen', NULL, '[]', 0),
-- Officers
('officer.electric@gov.in', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'Rajesh Kumar', '+919876543220', 'officer', 1, '["streetlights", "power_distribution"]', 4.5),
('officer.water@gov.in', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'Priya Sharma', '+919876543221', 'officer', 2, '["water_supply", "plumbing"]', 4.7),
('officer.roads@gov.in', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'Amit Patel', '+919876543222', 'officer', 3, '["road_repair", "infrastructure"]', 4.2),
-- Admin
('admin@pulsegov.com', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'Admin User', '+919876543230', 'admin', NULL, '[]', 0);
