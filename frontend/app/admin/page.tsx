'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function AdminDashboard() {
    const [stats, setStats] = useState<any>({
        total: 0,
        resolved: 0,
        pending: 0,
        sla_breached: 0,
        avg_resolution_time: 0,
    });

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        // Simulated data for demo
        setStats({
            total: 247,
            resolved: 189,
            pending: 42,
            sla_breached: 16,
            avg_resolution_time: 28.5,
        });
    };

    const categoryData = [
        { name: 'Streetlight', value: 45, color: '#3b82f6' },
        { name: 'Roads', value: 38, color: '#10b981' },
        { name: 'Water', value: 32, color: '#f59e0b' },
        { name: 'Garbage', value: 28, color: '#ef4444' },
        { name: 'Others', value: 20, color: '#8b5cf6' },
    ];

    const trendData = [
        { month: 'Jan', complaints: 45, resolved: 42 },
        { month: 'Feb', complaints: 52, resolved: 48 },
        { month: 'Mar', complaints: 61, resolved: 58 },
        { month: 'Apr', complaints: 58, resolved: 55 },
        { month: 'May', complaints: 67, resolved: 63 },
        { month: 'Jun', complaints: 74, resolved: 71 },
    ];

    const departmentPerformance = [
        { dept: 'Electricity', resolved: 95, avg_time: 24 },
        { dept: 'Water', resolved: 88, avg_time: 32 },
        { dept: 'Roads', resolved: 82, avg_time: 48 },
        { dept: 'Garbage', resolved: 91, avg_time: 18 },
    ];

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold mb-2">Admin Analytics</h1>
                    <p className="text-white/60">Real-time insights and predictive analytics dashboard</p>
                </div>

                {/* Stats Grid */}
                <div className="grid md:grid-cols-5 gap-6 mb-8">
                    <div className="glass-card p-6">
                        <p className="text-white/60 text-sm mb-1">Total Complaints</p>
                        <p className="text-3xl font-bold">{stats.total}</p>
                    </div>
                    <div className="glass-card p-6">
                        <p className="text-white/60 text-sm mb-1">Resolved</p>
                        <p className="text-3xl font-bold text-green-400">{stats.resolved}</p>
                    </div>
                    <div className="glass-card p-6">
                        <p className="text-white/60 text-sm mb-1">Pending</p>
                        <p className="text-3xl font-bold text-yellow-400">{stats.pending}</p>
                    </div>
                    <div className="glass-card p-6">
                        <p className="text-white/60 text-sm mb-1">SLA Breached</p>
                        <p className="text-3xl font-bold text-red-400">{stats.sla_breached}</p>
                    </div>
                    <div className="glass-card p-6">
                        <p className="text-white/60 text-sm mb-1">Avg Resolution</p>
                        <p className="text-3xl font-bold text-blue-400">{stats.avg_resolution_time}h</p>
                    </div>
                </div>

                {/* Charts Grid */}
                <div className="grid lg:grid-cols-2 gap-8 mb-8">
                    {/* Trend Chart */}
                    <div className="glass-card p-6">
                        <h3 className="text-xl font-bold mb-4">Complaint Trends</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis dataKey="month" stroke="#9ca3af" />
                                <YAxis stroke="#9ca3af" />
                                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                                <Legend />
                                <Line type="monotone" dataKey="complaints" stroke="#3b82f6" strokeWidth={2} />
                                <Line type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Category Distribution */}
                    <div className="glass-card p-6">
                        <h3 className="text-xl font-bold mb-4">Complaints by Category</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, value }) => `${name}: ${value}`}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Department Performance */}
                <div className="glass-card p-6 mb-8">
                    <h3 className="text-xl font-bold mb-4">Department Performance</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={departmentPerformance}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="dept" stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" />
                            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                            <Legend />
                            <Bar dataKey="resolved" fill="#10b981" name="Resolution Rate %" />
                            <Bar dataKey="avg_time" fill="#3b82f6" name="Avg Time (hours)" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Predictive Alerts */}
                <div className="glass-card p-6">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <span className="text-2xl">🔮</span> Predictive SLA Breach Alerts
                    </h3>
                    <div className="space-y-3">
                        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="font-semibold text-red-400">High Risk - CMP-1234567</p>
                                    <p className="text-sm text-white/80 mt-1">Pothole on MG Road</p>
                                    <p className="text-xs text-white/60 mt-2">Officer: Amit Patel • Time Remaining: 8 hours</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-bold text-red-400">92%</p>
                                    <p className="text-xs text-white/60">Breach Risk</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="font-semibold text-yellow-400">Medium Risk - CMP-1234568</p>
                                    <p className="text-sm text-white/80 mt-1">Water leakage at Sector 15</p>
                                    <p className="text-xs text-white/60 mt-2">Officer: Priya Sharma • Time Remaining: 18 hours</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-bold text-yellow-400">67%</p>
                                    <p className="text-xs text-white/60">Breach Risk</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
