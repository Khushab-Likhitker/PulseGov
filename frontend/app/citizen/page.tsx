'use client';

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

export default function CitizenPortal() {
    const [complaints, setComplaints] = useState<any[]>([]);
    const [viewMode, setViewMode] = useState<'form' | 'list'>('list');
    const [user, setUser] = useState<any>(null);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        department_code: '',
        aadhaar: '',
        mobile: '',
        city: '',
        district: '',
        state: '',
        pincode: '',
    });

    const fetchComplaints = useCallback(async (uid: number) => {
        try {
            const response = await axios.get(`${API_URL}/api/complaints?citizen_id=${uid}`);
            setComplaints(response.data.complaints || []);
        } catch (error) {
            console.error('Failed to fetch complaints:', error);
        }
    }, []);

    useEffect(() => {
        const storedUser = localStorage.getItem('user_token');
        if (storedUser) {
            const userData = JSON.parse(storedUser);
            setUser(userData);
            fetchComplaints(userData.id);

            // WebSocket connection
            const socket = io(WS_URL);
            socket.emit('subscribe:user', userData.id.toString());
            socket.on('notification', () => fetchComplaints(userData.id));
            return () => { socket.disconnect(); };
        }
    }, [fetchComplaints]);

    const formatAadhaar = (val: string) => {
        let value = val.replace(/\D/g, '').slice(0, 12);
        return value.replace(/(.{4})/g, '$1 ').trim();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Mapping the complex form to our backend expected structure
            const submissionData = {
                title: formData.title || `Issue in ${formData.department_code}`,
                description: `${formData.description}\n\nLocation: ${formData.city}, ${formData.district}, ${formData.state} - ${formData.pincode}`,
                citizen_id: user.id,
                location: {
                    address: formData.city,
                    city: formData.city,
                    district: formData.district,
                    state: formData.state,
                    pincode: formData.pincode
                }
            };

            const response = await axios.post(`${API_URL}/api/complaints`, submissionData);

            if (response.data.success) {
                alert(`✅ Complaint submitted successfully!\n\nID: ${response.data.complaint.complaint_id}`);
                setFormData({
                    title: '', description: '', department_code: '',
                    aadhaar: '', mobile: '', city: '', district: '', state: '', pincode: ''
                });
                setViewMode('list');
                fetchComplaints(user.id);
            }
        } catch (error: any) {
            alert('Failed to submit complaint: ' + (error.response?.data?.error || error.message));
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                <div>
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Citizen Portal</h1>
                    <p className="text-slate-600 font-medium">Lodge grievances and monitor official progress</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => setViewMode('form')}
                        className={`gov-btn-primary ${viewMode === 'form' ? 'ring-4 ring-offset-2 ring-blue-500' : ''}`}
                    >
                        + New Complaint
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`gov-btn-secondary ${viewMode === 'list' ? 'bg-slate-200 ring-2 ring-slate-400' : ''}`}
                    >
                        👁 View History
                    </button>
                </div>
            </div>

            {/* Form Mode */}
            {viewMode === 'form' && (
                <div className="gov-card p-10 fade-in bg-white shadow-2xl border-t-4 border-t-blue-700">
                    <h2 className="text-3xl font-bold mb-8 text-slate-900 border-b border-slate-100 pb-4">Submit New Grievance</h2>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Subject / Title *</label>
                                <input
                                    type="text" required className="gov-input" placeholder="Brief subject of issue"
                                    value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Department *</label>
                                <select
                                    required className="gov-input"
                                    value={formData.department_code} onChange={e => setFormData({ ...formData, department_code: e.target.value })}
                                >
                                    <option value="">Select Department</option>
                                    <option value="MUN">Municipal Services</option>
                                    <option value="ELC">Electricity Department</option>
                                    <option value="WTR">Water Supply</option>
                                    <option value="PWD">Public Works (PWD)</option>
                                    <option value="HLT">Health Department</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Description of Complaint *</label>
                            <textarea
                                required rows={4} className="gov-input" placeholder="Explain the problem in detail"
                                value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        <div className="grid md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Aadhaar (Last 4) *</label>
                                <input
                                    type="text" required maxLength={14} className="gov-input" placeholder="XXXX XXXX XXXX"
                                    value={formData.aadhaar} onChange={e => setFormData({ ...formData, aadhaar: formatAadhaar(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Mobile Number *</label>
                                <input
                                    type="tel" required className="gov-input" placeholder="10-digit number"
                                    value={formData.mobile} onChange={e => setFormData({ ...formData, mobile: e.target.value.slice(0, 10) })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">City/Village</label>
                                <input type="text" className="gov-input" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">District</label>
                                <input type="text" className="gov-input" value={formData.district} onChange={e => setFormData({ ...formData, district: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">State</label>
                                <input type="text" className="gov-input" value={formData.state} onChange={e => setFormData({ ...formData, state: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Pincode</label>
                                <input type="text" className="gov-input" value={formData.pincode} onChange={e => setFormData({ ...formData, pincode: e.target.value })} />
                            </div>
                        </div>

                        <button type="submit" className="gov-btn-primary w-full py-5 text-xl">Submit Official Grievance</button>
                    </form>
                </div>
            )}

            {/* List Mode */}
            {viewMode === 'list' && (
                <div className="space-y-6 fade-in">
                    <div className="flex items-center justify-between border-b pb-4">
                        <h2 className="text-3xl font-bold text-slate-900">Your Submitted Complaints ({complaints.length})</h2>
                        <span className="text-slate-500 font-medium">Sorted by: Recent</span>
                    </div>

                    {complaints.length === 0 ? (
                        <div className="gov-card p-20 text-center border-dashed border-2">
                            <div className="text-7xl mb-6 opacity-30">📁</div>
                            <p className="text-slate-500 text-xl font-medium">No complaints found on your record.</p>
                            <button onClick={() => setViewMode('form')} className="mt-6 text-blue-700 font-bold underline">Submit your first complaint now</button>
                        </div>
                    ) : (
                        complaints.map(c => (
                            <div key={c.id} className="gov-card p-8 hover:shadow-xl transition-all border-l-8 border-l-blue-800 bg-white">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-2xl font-bold text-slate-900">{c.title}</h3>
                                            <span className={`status-badge-gov p-1 px-3 ${c.status === 'resolved' ? 'status-resolved' :
                                                c.status === 'pending' ? 'status-pending' : 'status-assigned'
                                                }`}>
                                                {c.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <p className="text-slate-500 font-mono text-sm leading-none bg-slate-100 p-2 inline-block rounded">ID: {c.complaint_id}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-slate-400 uppercase font-bold mb-1 tracking-widest leading-none">Submitted On</p>
                                        <p className="text-slate-700 font-bold">{new Date(c.created_at).toLocaleDateString('en-GB')}</p>
                                    </div>
                                </div>
                                <p className="text-slate-700 mb-6 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">{c.description}</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-slate-100">
                                    <div>
                                        <p className="text-xs text-slate-400 font-bold uppercase mb-1">Status</p>
                                        <p className="font-bold text-slate-900">{c.status === 'pending' ? '📜 Classifying' : '🚀 Processing'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-bold uppercase mb-1">Department</p>
                                        <p className="font-bold text-slate-900">{c.department_name || 'Allocating...'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-bold uppercase mb-1">Assigned Officer</p>
                                        <p className="font-bold text-slate-900">{c.assigned_officer_name || 'Pending'}</p>
                                    </div>
                                    <Link href={`/citizen/complaint/${c.id}`} className="flex items-center justify-end text-blue-700 font-bold hover:translate-x-1 transition-transform">
                                        Full Details →
                                    </Link>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
