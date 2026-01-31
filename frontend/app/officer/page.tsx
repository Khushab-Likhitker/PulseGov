'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function OfficerDashboard() {
    const [complaints, setComplaints] = useState<any[]>([]);
    const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
    const [suggestions, setSuggestions] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Hardcoded officer ID for demo
    const officerId = 3;

    useEffect(() => {
        fetchAssignedComplaints();
    }, []);

    const fetchAssignedComplaints = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/complaints?officer_id=${officerId}&status=assigned`);
            setComplaints(response.data.complaints || []);
        } catch (error) {
            console.error('Failed to fetch complaints:', error);
        }
    };

    const loadAISuggestions = async (complaintId: number) => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_URL}/api/resolution/suggestions/${complaintId}`);
            setSuggestions(response.data);
        } catch (error) {
            console.error('Failed to load AI suggestions:', error);
            setSuggestions(null);
        } finally {
            setLoading(false);
        }
    };

    const handleComplaintClick = (complaint: any) => {
        setSelectedComplaint(complaint);
        loadAISuggestions(complaint.id);
    };

    const handleResolve = async () => {
        if (!selectedComplaint) return;

        const resolutionText = prompt('Enter resolution details:');
        if (!resolutionText) return;

        try {
            await axios.post(`${API_URL}/api/complaints/${selectedComplaint.complaint_id}/resolve`, {
                resolution_text: resolutionText,
                officer_id: officerId,
            });

            alert('Complaint resolved successfully!');
            setSelectedComplaint(null);
            setSuggestions(null);
            fetchAssignedComplaints();
        } catch (error: any) {
            alert('Failed to resolve: ' + (error.response?.data?.error || error.message));
        }
    };

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold mb-2">Officer Dashboard</h1>
                    <p className="text-white/60">AI-powered resolution intelligence at your fingertips</p>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Complaints List */}
                    <div className="lg:col-span-1">
                        <div className="glass-card p-6">
                            <h2 className="text-xl font-bold mb-4">Assigned Complaints ({complaints.length})</h2>
                            <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                {complaints.map((complaint) => (
                                    <div
                                        key={complaint.id}
                                        onClick={() => handleComplaintClick(complaint)}
                                        className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedComplaint?.id === complaint.id
                                                ? 'bg-primary-500/20 border-primary-500'
                                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                                            }`}
                                    >
                                        <p className="font-semibold text-sm mb-1">{complaint.complaint_id}</p>
                                        <p className="text-white/80 text-sm line-clamp-2">{complaint.title}</p>
                                        <div className="flex items-center gap-2 mt-2 text-xs">
                                            <span className="text-white/40">{complaint.category_name}</span>
                                        </div>
                                    </div>
                                ))}

                                {complaints.length === 0 && (
                                    <div className="text-center py-12 text-white/40">
                                        <div className="text-4xl mb-2">🎉</div>
                                        <p>No pending complaints!</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Complaint Details & AI Suggestions */}
                    <div className="lg:col-span-2">
                        {!selectedComplaint ? (
                            <div className="glass-card p-12 text-center h-full flex items-center justify-center">
                                <div>
                                    <div className="text-6xl mb-4">👈</div>
                                    <p className="text-white/60 text-lg">Select a complaint to view AI-powered suggestions</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Complaint Details */}
                                <div className="glass-card p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h2 className="text-2xl font-bold mb-2">{selectedComplaint.title}</h2>
                                            <p className="text-white/60 text-sm">ID: {selectedComplaint.complaint_id}</p>
                                        </div>
                                        <button onClick={handleResolve} className="btn-primary">
                                            ✓ Mark Resolved
                                        </button>
                                    </div>

                                    <p className="text-white/80  mb-4">{selectedComplaint.description}</p>

                                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
                                        <div>
                                            <p className="text-xs text-white/40 mb-1">Category</p>
                                            <p className="font-medium text-sm">{selectedComplaint.category_name}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-white/40 mb-1">Submitted</p>
                                            <p className="font-medium text-sm">{new Date(selectedComplaint.created_at).toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-white/40 mb-1">SLA Deadline</p>
                                            <p className="font-medium text-sm">{selectedComplaint.sla_deadline ? new Date(selectedComplaint.sla_deadline).toLocaleString() : 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* AI-POWERED SUGGESTIONS (THE KILLER FEATURE) */}
                                {loading ? (
                                    <div className="glass-card p-12 text-center">
                                        <div className="animate-pulse-slow text-4xl mb-4">🤖</div>
                                        <p className="text-white/60">AI is analyzing similar cases...</p>
                                    </div>
                                ) : suggestions && suggestions.similar_complaints?.length > 0 ? (
                                    <div className="glass-card p-6 border-2 border-primary-500/30">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center">
                                                <span className="text-xl">🤖</span>
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-bold text-primary-400">AI Resolution Suggestions</h3>
                                                <p className="text-sm text-white/60">Based on {suggestions.similar_complaints.length} similar resolved cases</p>
                                            </div>
                                        </div>

                                        {/* Suggested Actions */}
                                        <div className="mb-6">
                                            <h4 className="font-semibold mb-3 text-green-400">✓ Recommended Actions:</h4>
                                            <div className="space-y-2">
                                                {suggestions.suggestions?.suggested_actions?.map((action: string, idx: number) => (
                                                    <div key={idx} className="flex items-start gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                                                        <span className="text-green-400 font-bold">{idx + 1}.</span>
                                                        <p className="text-white/90">{action}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Estimated Time */}
                                        <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-white/5 rounded-xl">
                                            <div>
                                                <p className="text-xs text-white/40 mb-1">Est. Resolution Time</p>
                                                <p className="font-bold text-lg text-primary-400">{suggestions.suggestions?.estimated_time_hours}h</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-white/40 mb-1">Success Probability</p>
                                                <p className="font-bold text-lg text-green-400">{(suggestions.suggestions?.success_probability * 100).toFixed(0)}%</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-white/40 mb-1">Based on Cases</p>
                                                <p className="font-bold text-lg text-blue-400">{suggestions.suggestions?.based_on_cases}</p>
                                            </div>
                                        </div>

                                        {/* Similar Cases */}
                                        <div>
                                            <h4 className="font-semibold mb-3 text-blue-400">🔍 Similar Resolved Cases:</h4>
                                            <div className="space-y-3 max-h-60 overflow-y-auto">
                                                {suggestions.similar_complaints.map((similar: any, idx: number) => (
                                                    <div key={idx} className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <p className="font-medium text-sm">{similar.complaint_id}</p>
                                                            <span className="text-xs text-green-400">✓ Resolved in {Math.round(similar.time_to_resolve_hours)}h</span>
                                                        </div>
                                                        <p className="text-sm text-white/80 mb-2">{similar.title}</p>
                                                        <div className="p-2 bg-white/5 rounded text-xs text-white/70">
                                                            <strong>Resolution:</strong> {similar.resolution_text}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="glass-card p-8 text-center">
                                        <div className="text-4xl mb-2">💡</div>
                                        <p className="text-white/60">No similar cases found yet. You'll be setting the precedent!</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
