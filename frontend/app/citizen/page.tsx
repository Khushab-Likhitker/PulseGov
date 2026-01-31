'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

export default function CitizenPortal() {
    const [complaints, setComplaints] = useState<any[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        location: { address: '' },
    });

    // Hardcoded citizen ID for demo
    const citizenId = 1;

    useEffect(() => {
        fetchComplaints();

        // WebSocket connection for real-time updates
        const socket = io(WS_URL);
        socket.emit('subscribe:user', citizenId.toString());

        socket.on('notification', (data) => {
            console.log('Real-time notification:', data);
            fetchComplaints(); // Refresh list
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const fetchComplaints = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/complaints?citizen_id=${citizenId}`);
            setComplaints(response.data.complaints || []);
        } catch (error) {
            console.error('Failed to fetch complaints:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const response = await axios.post(`${API_URL}/api/complaints`, {
                ...formData,
                citizen_id: citizenId,
            });

            if (response.data.success) {
                alert(`Complaint submitted! ID: ${response.data.complaint.complaint_id}`);
                setFormData({ title: '', description: '', location: { address: '' } });
                setShowForm(false);
                fetchComplaints();
            }
        } catch (error: any) {
            alert('Failed to submit complaint: ' + (error.response?.data?.error || error.message));
        }
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
            assigned: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            in_progress: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
            resolved: 'bg-green-500/20 text-green-400 border-green-500/30',
            closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
            escalated: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
            sla_breached: 'bg-red-500/20 text-red-400 border-red-500/30',
        };
        return colors[status] || 'bg-gray-500/20 text-gray-400';
    };

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">Citizen Portal</h1>
                        <p className="text-white/60">Track your civic grievances in real-time</p>
                    </div>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="btn-primary"
                    >
                        {showForm ? '✕ Cancel' : '+ New Complaint'}
                    </button>
                </div>

                {/* Complaint Form */}
                {showForm && (
                    <div className="glass-card p-8 mb-8 animate-in slide-in-from-top">
                        <h2 className="text-2xl font-bold mb-6">Submit New Complaint</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Title</label>
                                <input
                                    type="text"
                                    required
                                    className="input-field"
                                    placeholder="Brief description of the issue"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Description</label>
                                <textarea
                                    required
                                    rows={4}
                                    className="input-field"
                                    placeholder="Detailed explanation of the problem"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Location</label>
                                <input
                                    type="text"
                                    required
                                    className="input-field"
                                    placeholder="Address or landmark"
                                    value={formData.location.address}
                                    onChange={(e) => setFormData({ ...formData, location: { address: e.target.value } })}
                                />
                            </div>

                            <button type="submit" className="btn-primary w-full">
                                Submit Complaint
                            </button>
                        </form>
                    </div>
                )}

                {/* Complaints List */}
                <div className="space-y-4">
                    <h2 className="text-2xl font-bold mb-4">My Complaints ({complaints.length})</h2>

                    {complaints.length === 0 ? (
                        <div className="glass-card p-12 text-center">
                            <div className="text-6xl mb-4">📝</div>
                            <p className="text-white/60 text-lg">No complaints yet. Click "New Complaint" to submit one.</p>
                        </div>
                    ) : (
                        complaints.map((complaint) => (
                            <div key={complaint.id} className="glass-card p-6 hover:scale-[1.02] transition-transform">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-xl font-bold">{complaint.title}</h3>
                                            <span className={`status-badge border ${getStatusColor(complaint.status)}`}>
                                                {complaint.status.replace('_', ' ').toUpperCase()}
                                            </span>
                                        </div>
                                        <p className="text-white/60 text-sm mb-2">ID: {complaint.complaint_id}</p>
                                        <p className="text-white/80">{complaint.description}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/10">
                                    <div>
                                        <p className="text-xs text-white/40 mb-1">Category</p>
                                        <p className="font-medium">{complaint.category_name || 'Pending Classification'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-white/40 mb-1">Department</p>
                                        <p className="font-medium">{complaint.department_name || 'Not Assigned'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-white/40 mb-1">Assigned To</p>
                                        <p className="font-medium">{complaint.assigned_officer_name || 'Pending'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-white/40 mb-1">Created</p>
                                        <p className="font-medium">{new Date(complaint.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>

                                {complaint.resolution_text && (
                                    <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                                        <p className="text-xs text-green-400 mb-1 font-medium">✓ RESOLVED</p>
                                        <p className="text-white/80">{complaint.resolution_text}</p>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
