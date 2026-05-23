'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import OfficerNav from '@/components/OfficerNav';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Complaint {
    id: number;
    complaint_id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    created_at: string;
    sla_deadline: string;
    category_name: string;
    department_name: string;
    assigned_officer_name: string;
    citizen_name: string;
    is_sla_breached: boolean;
}

interface FilterState {
    status: string;
    category_id: string;
    department_id: string;
    sla_breached_only: boolean;
    search: string;
}

interface SortState {
    field: string;
    order: 'asc' | 'desc';
}

export default function OfficerComplaints() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [complaints, setComplaints] = useState<Complaint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Pagination state
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    // Filter state
    const [filters, setFilters] = useState<FilterState>({
        status: '',
        category_id: '',
        department_id: '',
        sla_breached_only: false,
        search: ''
    });

    // Sort state
    const [sort, setSort] = useState<SortState>({ field: 'created_at', order: 'desc' });

    // Master data
    const [categories, setCategories] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);

    // Modal state
    const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
    const [modalMode, setModalMode] = useState<'resolve' | 'escalate' | null>(null);
    const [resolutionNote, setResolutionNote] = useState('');
    const [escalationReason, setEscalationReason] = useState('');

    // Debounced search
    const [searchInput, setSearchInput] = useState('');

    useEffect(() => {
        const storedUser = localStorage.getItem('user_token');
        if (!storedUser) {
            router.push('/officer/login');
            return;
        }
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser.role !== 'officer') {
            router.push('/officer/login');
            return;
        }
        setUser(parsedUser);
        fetchMasterData();
    }, []);

    useEffect(() => {
        if (user) {
            fetchComplaints();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, page, limit, filters, sort]);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setFilters(prev => ({ ...prev, search: searchInput }));
            setPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const fetchMasterData = async () => {
        try {
            const [catRes, deptRes] = await Promise.all([
                axios.get(`${API_URL}/api/complaints/master/categories`),
                axios.get(`${API_URL}/api/complaints/master/departments`)
            ]);
            setCategories(catRes.data.categories || []);
            setDepartments(deptRes.data.departments || []);
        } catch (err) {
            console.error('Failed to load master data');
        }
    };

    const fetchComplaints = async () => {
        if (!user) return;
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                officer_id: user.id.toString(),
                page: page.toString(),
                limit: limit.toString(),
                sort: sort.field,
                order: sort.order
            });

            if (filters.status) params.append('status', filters.status);
            if (filters.category_id) params.append('category_id', filters.category_id);
            if (filters.department_id) params.append('department_id', filters.department_id);
            if (filters.sla_breached_only) params.append('sla_breached_only', 'true');
            if (filters.search) params.append('search', filters.search);

            const res = await axios.get(`${API_URL}/api/complaints/officer/list?${params.toString()}`);

            if (res.data.success) {
                setComplaints(res.data.data);
                setTotal(res.data.total);
                setTotalPages(res.data.totalPages);
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to fetch complaints');
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (field: string) => {
        setSort(prev => ({
            field,
            order: prev.field === field && prev.order === 'desc' ? 'asc' : 'desc'
        }));
        setPage(1);
    };

    const handleFilterChange = (key: keyof FilterState, value: any) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1);
    };

    const handleUpdateStatus = async (complaintId: string, newStatus: string) => {
        try {
            const res = await axios.patch(`${API_URL}/api/complaints/${complaintId}/status`, {
                status: newStatus,
                performed_by: user.id,
                notes: `Status changed to ${newStatus}`
            });
            if (res.data.success) {
                fetchComplaints();
            }
        } catch (err) {
            alert('❌ Failed to update status');
        }
    };

    const handleResolve = async () => {
        if (!resolutionNote || !selectedComplaint) return;
        try {
            const res = await axios.post(`${API_URL}/api/complaints/${selectedComplaint.complaint_id}/resolve`, {
                resolution_text: resolutionNote,
                resolution_steps: ["Investigation Complete", "Administrative Action Applied", "Final Verification"],
                officer_id: user.id
            });
            if (res.data.success) {
                closeModal();
                fetchComplaints();
            }
        } catch (err) {
            alert('❌ Resolution failed');
        }
    };

    const handleEscalate = async () => {
        if (!escalationReason || !selectedComplaint) return;
        try {
            const res = await axios.post(`${API_URL}/api/complaints/${selectedComplaint.complaint_id}/escalate`, {
                reason: escalationReason,
                from_officer_id: user.id,
                to_officer_id: 1,
                level: 2
            });
            if (res.data.success) {
                closeModal();
                fetchComplaints();
            }
        } catch (err) {
            alert('❌ Escalation failed');
        }
    };

    const openModal = (complaint: Complaint, mode: 'resolve' | 'escalate') => {
        setSelectedComplaint(complaint);
        setModalMode(mode);
        setResolutionNote('');
        setEscalationReason('');
    };

    const closeModal = () => {
        setSelectedComplaint(null);
        setModalMode(null);
        setResolutionNote('');
        setEscalationReason('');
    };

    const SortIcon = ({ field }: { field: string }) => {
        if (sort.field !== field) return <span className="text-slate-300 ml-1">↕</span>;
        return <span className="text-blue-500 ml-1">{sort.order === 'asc' ? '↑' : '↓'}</span>;
    };

    const getStatusBadge = (status: string, isBreached: boolean) => {
        const base = "px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest";
        if (isBreached) return `${base} bg-red-100 text-red-700 border border-red-200 animate-pulse`;
        switch (status) {
            case 'resolved': return `${base} bg-green-100 text-green-700 border border-green-200`;
            case 'in_progress': return `${base} bg-blue-100 text-blue-700 border border-blue-200`;
            case 'escalated': return `${base} bg-orange-100 text-orange-700 border border-orange-200`;
            case 'sla_breached': return `${base} bg-red-100 text-red-700 border border-red-200`;
            default: return `${base} bg-slate-100 text-slate-600 border border-slate-200`;
        }
    };

    const getPriorityBadge = (priority: string) => {
        const base = "px-2 py-0.5 rounded text-[10px] font-black uppercase";
        switch (priority) {
            case 'high': return `${base} bg-red-500 text-white`;
            case 'medium': return `${base} bg-yellow-500 text-white`;
            default: return `${base} bg-green-500 text-white`;
        }
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            <OfficerNav />

            <div className="p-8">
                {/* Header */}
                <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Complaint Registry</h1>
                        <p className="text-slate-500 font-bold uppercase text-xs tracking-widest mt-1">
                            Enterprise-Scale Dossier Management • {total} Records
                        </p>
                    </div>
                </header>

                {/* Filter Bar */}
                <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 mb-6 border border-slate-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                        {/* Search */}
                        <div className="lg:col-span-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Search ID / Title</label>
                            <input
                                type="text"
                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all font-medium"
                                placeholder="Search complaints..."
                                value={searchInput}
                                onChange={e => setSearchInput(e.target.value)}
                            />
                        </div>

                        {/* Status Filter */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Status</label>
                            <select
                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 transition-all font-medium"
                                value={filters.status}
                                onChange={e => handleFilterChange('status', e.target.value)}
                            >
                                <option value="">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="in_progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                                <option value="escalated">Escalated</option>
                                <option value="sla_breached">SLA Breached</option>
                            </select>
                        </div>

                        {/* Category Filter */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Category</label>
                            <select
                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 transition-all font-medium"
                                value={filters.category_id}
                                onChange={e => handleFilterChange('category_id', e.target.value)}
                            >
                                <option value="">All Categories</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* SLA Breached Toggle */}
                        <div className="flex items-end">
                            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 transition-all w-full">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded border-2 border-slate-300 text-red-600 focus:ring-red-500"
                                    checked={filters.sla_breached_only}
                                    onChange={e => handleFilterChange('sla_breached_only', e.target.checked)}
                                />
                                <span className="text-xs font-black uppercase text-slate-600">SLA Breached Only</span>
                            </label>
                        </div>

                        {/* Page Size */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Page Size</label>
                            <select
                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 transition-all font-medium"
                                value={limit}
                                onChange={e => { setLimit(parseInt(e.target.value)); setPage(1); }}
                            >
                                <option value="10">10 per page</option>
                                <option value="25">25 per page</option>
                                <option value="50">50 per page</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Data Table */}
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100">
                    {loading ? (
                        <div className="p-20 text-center">
                            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-slate-400 font-bold uppercase tracking-widest">Querying Database...</p>
                        </div>
                    ) : error ? (
                        <div className="p-20 text-center">
                            <p className="text-red-500 font-bold text-xl">❌ {error}</p>
                            <button onClick={fetchComplaints} className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-xl font-bold">Retry</button>
                        </div>
                    ) : complaints.length === 0 ? (
                        <div className="p-20 text-center">
                            <p className="text-slate-400 font-bold text-xl">No complaints found</p>
                            <p className="text-slate-300 mt-2">Try adjusting your filters</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-900 text-white">
                                    <tr>
                                        <th className="px-6 py-4 text-left cursor-pointer hover:bg-slate-800 transition-all" onClick={() => handleSort('complaint_id')}>
                                            <span className="text-[10px] font-black uppercase tracking-widest">ID</span>
                                            <SortIcon field="complaint_id" />
                                        </th>
                                        <th className="px-6 py-4 text-left cursor-pointer hover:bg-slate-800 transition-all" onClick={() => handleSort('title')}>
                                            <span className="text-[10px] font-black uppercase tracking-widest">Title</span>
                                            <SortIcon field="title" />
                                        </th>
                                        <th className="px-6 py-4 text-left">
                                            <span className="text-[10px] font-black uppercase tracking-widest">Category</span>
                                        </th>
                                        <th className="px-6 py-4 text-left cursor-pointer hover:bg-slate-800 transition-all" onClick={() => handleSort('priority')}>
                                            <span className="text-[10px] font-black uppercase tracking-widest">Priority</span>
                                            <SortIcon field="priority" />
                                        </th>
                                        <th className="px-6 py-4 text-left cursor-pointer hover:bg-slate-800 transition-all" onClick={() => handleSort('status')}>
                                            <span className="text-[10px] font-black uppercase tracking-widest">Status</span>
                                            <SortIcon field="status" />
                                        </th>
                                        <th className="px-6 py-4 text-left cursor-pointer hover:bg-slate-800 transition-all" onClick={() => handleSort('sla_deadline')}>
                                            <span className="text-[10px] font-black uppercase tracking-widest">SLA Deadline</span>
                                            <SortIcon field="sla_deadline" />
                                        </th>
                                        <th className="px-6 py-4 text-left cursor-pointer hover:bg-slate-800 transition-all" onClick={() => handleSort('created_at')}>
                                            <span className="text-[10px] font-black uppercase tracking-widest">Created</span>
                                            <SortIcon field="created_at" />
                                        </th>
                                        <th className="px-6 py-4 text-right">
                                            <span className="text-[10px] font-black uppercase tracking-widest">Actions</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {complaints.map((c) => (
                                        <tr key={c.id} className="hover:bg-blue-50/50 transition-all group">
                                            <td className="px-6 py-4">
                                                <span className="font-mono font-bold text-blue-700">{c.complaint_id}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="max-w-xs">
                                                    <p className="font-bold text-slate-900 truncate">{c.title}</p>
                                                    <p className="text-xs text-slate-400 truncate">{c.citizen_name}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm font-medium text-slate-600">{c.category_name || 'Uncategorized'}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={getPriorityBadge(c.priority)}>{c.priority}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={getStatusBadge(c.status, c.is_sla_breached)}>
                                                    {c.status.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-sm font-medium ${c.is_sla_breached ? 'text-red-600' : 'text-slate-600'}`}>
                                                    {new Date(c.sla_deadline).toLocaleDateString()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm text-slate-500">{new Date(c.created_at).toLocaleDateString()}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-end gap-2 opacity-30 group-hover:opacity-100 transition-all">
                                                    {c.status !== 'resolved' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleUpdateStatus(c.complaint_id, 'in_progress')}
                                                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-100 text-blue-600 hover:bg-blue-200 transition-all"
                                                                title="Mark In Progress"
                                                            >⚒️</button>
                                                            <button
                                                                onClick={() => openModal(c, 'resolve')}
                                                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-green-100 text-green-600 hover:bg-green-200 transition-all"
                                                                title="Resolve"
                                                            >✅</button>
                                                            <button
                                                                onClick={() => openModal(c, 'escalate')}
                                                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-100 text-red-600 hover:bg-red-200 transition-all"
                                                                title="Escalate"
                                                            >🚨</button>
                                                        </>
                                                    )}
                                                    <button
                                                        onClick={() => router.push(`/complaint/${c.complaint_id}`)}
                                                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                                                        title="View Details"
                                                    >👁️</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {!loading && complaints.length > 0 && (
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="text-sm font-bold text-slate-500">
                                Showing {(page - 1) * limit + 1} - {Math.min(page * limit, total)} of {total} records
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    disabled={page === 1}
                                    onClick={() => setPage(1)}
                                    className="px-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-50 transition-all"
                                >First</button>
                                <button
                                    disabled={page === 1}
                                    onClick={() => setPage(p => p - 1)}
                                    className="px-4 py-2 text-xs font-bold bg-white border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-50 transition-all"
                                >Previous</button>

                                <div className="flex items-center gap-1">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum;
                                        if (totalPages <= 5) {
                                            pageNum = i + 1;
                                        } else if (page <= 3) {
                                            pageNum = i + 1;
                                        } else if (page >= totalPages - 2) {
                                            pageNum = totalPages - 4 + i;
                                        } else {
                                            pageNum = page - 2 + i;
                                        }
                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => setPage(pageNum)}
                                                className={`w-10 h-10 text-xs font-bold rounded-lg transition-all ${page === pageNum
                                                    ? 'bg-blue-900 text-white'
                                                    : 'bg-white border border-slate-200 hover:bg-slate-50'
                                                    }`}
                                            >{pageNum}</button>
                                        );
                                    })}
                                </div>

                                <button
                                    disabled={page === totalPages}
                                    onClick={() => setPage(p => p + 1)}
                                    className="px-4 py-2 text-xs font-bold bg-white border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-50 transition-all"
                                >Next</button>
                                <button
                                    disabled={page === totalPages}
                                    onClick={() => setPage(totalPages)}
                                    className="px-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-50 transition-all"
                                >Last</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal */}
                {selectedComplaint && modalMode && (
                    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6 z-50">
                        <div className="bg-white max-w-lg w-full p-10 rounded-3xl shadow-2xl">
                            <h2 className="text-3xl font-black mb-2">
                                {modalMode === 'resolve' ? '✅ Resolve Complaint' : '🚨 Escalate Complaint'}
                            </h2>
                            <p className="text-slate-400 font-bold text-sm mb-6">
                                Dossier: {selectedComplaint.complaint_id}
                            </p>

                            {modalMode === 'resolve' ? (
                                <>
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Resolution Notes</label>
                                    <textarea
                                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl mb-6 focus:border-green-500 transition-all"
                                        rows={4}
                                        placeholder="Describe the resolution applied..."
                                        value={resolutionNote}
                                        onChange={e => setResolutionNote(e.target.value)}
                                    />
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleResolve}
                                            disabled={!resolutionNote}
                                            className="flex-1 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                                        >Confirm Resolution</button>
                                        <button onClick={closeModal} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all">Cancel</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Escalation Reason</label>
                                    <textarea
                                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl mb-6 focus:border-red-500 transition-all"
                                        rows={4}
                                        placeholder="Why is this being escalated..."
                                        value={escalationReason}
                                        onChange={e => setEscalationReason(e.target.value)}
                                    />
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleEscalate}
                                            disabled={!escalationReason}
                                            className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                                        >Execute Escalation</button>
                                        <button onClick={closeModal} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all">Cancel</button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

