const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory storage
let complaints = [
    {
        id: 1,
        complaint_id: 'CMP-1738345200-DEMO0001',
        citizen_id: 1,
        title: 'Streetlight not working at MG Road',
        description: 'The streetlight has been out for 3 days near City Mall',
        category_id: 1,
        category_name: 'Streetlight Not Working',
        department_name: 'Electricity Department',
        assigned_officer_name: 'Rajesh Kumar',
        status: 'assigned',
        created_at: new Date().toISOString(),
        sla_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 2,
        complaint_id: 'CMP-1738345100-DEMO0002',
        citizen_id: 1,
        title: 'Pothole on Main Street',
        description: 'Large pothole causing traffic issues',
        category_id: 5,
        category_name: 'Pothole on Road',
        department_name: 'Roads & Infrastructure',
        assigned_officer_name: 'Amit Patel',
        status: 'in_progress',
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        sla_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    }
];

// Mock AI suggestions data
const aiSuggestions = {
    1: {
        similar_complaints: [
            {
                complaint_id: 'CMP-1738245200-OLD0001',
                title: 'Street light broken at Park Avenue',
                description: 'Light pole damaged, needs replacement',
                resolution_text: 'Inspected the light fixture, found faulty bulb. Replaced with new LED bulb. Tested and working properly.',
                time_to_resolve_hours: 18,
                similarity_score: 0.87,
                success_rating: 5
            },
            {
                complaint_id: 'CMP-1738145200-OLD0002',
                title: 'Streetlight not illuminating',
                description: 'Dark area near school',
                resolution_text: 'Checked power supply to pole. Found loose connection. Tightened connection and replaced damaged wire.',
                time_to_resolve_hours: 24,
                similarity_score: 0.82,
                success_rating: 4
            },
            {
                complaint_id: 'CMP-1738045200-OLD0003',
                title: 'Multiple streetlights out',
                description: 'Entire street dark at night',
                resolution_text: 'Contacted electricity board. Main supply issue resolved. All lights restored within 20 hours.',
                time_to_resolve_hours: 20,
                similarity_score: 0.75,
                success_rating: 5
            }
        ],
        suggestions: {
            suggested_actions: [
                'Inspect the streetlight fixture and check for visible damage',
                'Test power supply to the lamp post using voltage meter',
                'Replace faulty bulb with LED bulb (if bulb issue)',
                'Check wiring connections and repair if loose/damaged',
                'Contact electricity board if main supply issue detected',
                'Follow up within 24 hours to confirm resolution',
                'Document resolution with before/after photos'
            ],
            estimated_time_hours: 18,
            success_probability: 0.87,
            based_on_cases: 3
        }
    },
    2: {
        similar_complaints: [
            {
                complaint_id: 'CMP-1738245100-OLD0004',
                title: 'Deep pothole causing accidents',
                description: 'Dangerous road condition',
                resolution_text: 'Marked area with warning signs. Filled pothole with hot mix asphalt. Compacted and smoothed surface.',
                time_to_resolve_hours: 36,
                similarity_score: 0.91,
                success_rating: 5
            },
            {
                complaint_id: 'CMP-1738145100-OLD0005',
                title: 'Road damage near market',
                description: 'Multiple potholes',
                resolution_text: 'Scheduled road repair team. Used cold mix for temporary fix. Permanent repair scheduled for next week.',
                time_to_resolve_hours: 48,
                similarity_score: 0.85,
                success_rating: 4
            }
        ],
        suggestions: {
            suggested_actions: [
                'Inspect pothole depth and diameter',
                'Place warning cones around the damaged area',
                'Arrange asphalt repair materials',
                'Fill pothole with hot mix asphalt',
                'Compact and level the surface',
                'Allow curing time before removing warnings',
                'Schedule follow-up inspection after 1 week'
            ],
            estimated_time_hours: 36,
            success_probability: 0.91,
            based_on_cases: 2
        }
    }
};

// API Routes
app.get('/api/complaints', (req, res) => {
    const { citizen_id, officer_id, status } = req.query;
    let filtered = complaints;

    if (citizen_id) filtered = filtered.filter(c => c.citizen_id == citizen_id);
    if (officer_id) filtered = filtered.filter(c => c.assigned_officer_name && officer_id == 3);
    if (status) filtered = filtered.filter(c => c.status === status);

    res.json({ success: true, complaints: filtered });
});

app.post('/api/complaints', (req, res) => {
    const { title, description, location, citizen_id } = req.body;

    const newComplaint = {
        id: complaints.length + 1,
        complaint_id: `CMP-${Date.now()}-DEMO${String(complaints.length + 1).padStart(4, '0')}`,
        citizen_id,
        title,
        description,
        category_name: 'Pending Classification',
        status: 'pending',
        created_at: new Date().toISOString(),
    };

    complaints.push(newComplaint);

    // Simulate AI classification after 2 seconds
    setTimeout(() => {
        const categories = [
            { name: 'Streetlight Not Working', dept: 'Electricity Department', officer: 'Rajesh Kumar' },
            { name: 'Pothole on Road', dept: 'Roads & Infrastructure', officer: 'Amit Patel' },
            { name: 'Garbage Not Collected', dept: 'Garbage Management', officer: 'Priya Sharma' },
        ];
        const category = categories[Math.floor(Math.random() * categories.length)];

        newComplaint.category_name = category.name;
        newComplaint.department_name = category.dept;
        newComplaint.assigned_officer_name = category.officer;
        newComplaint.status = 'assigned';
        newComplaint.sla_deadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    }, 2000);

    res.json({ success: true, complaint: newComplaint });
});

app.get('/api/resolution/suggestions/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const suggestions = aiSuggestions[id] || {
        similar_complaints: [],
        suggestions: {
            suggested_actions: ['Inspect the issue', 'Contact relevant department', 'Document findings'],
            estimated_time_hours: 48,
            success_probability: 0.5,
            based_on_cases: 0
        }
    };

    res.json({ success: true, ...suggestions });
});

app.post('/api/complaints/:id/resolve', (req, res) => {
    const { id } = req.params;
    const { resolution_text } = req.body;

    const complaint = complaints.find(c => c.complaint_id === id);
    if (complaint) {
        complaint.status = 'resolved';
        complaint.resolution_text = resolution_text;
        complaint.resolved_at = new Date().toISOString();
    }

    res.json({ success: true });
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 PulseGov Demo Server Running!                       ║
║                                                           ║
║   📍 http://localhost:${PORT}                              ║
║                                                           ║
║   ✨ Features Available:                                 ║
║   • Submit complaints (Citizen Portal)                   ║
║   • View AI suggestions (Officer Dashboard)              ║
║   • Track status in real-time                            ║
║                                                           ║
║   Press Ctrl+C to stop                                   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
