'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function OfficerRegister() {
    const [formData, setFormData] = useState({
        email: '', password: '', name: '', phone: '', department_id: '', role: 'officer'
    });
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const fetchDepts = async () => {
            try {
                const response = await axios.get(`${API_URL}/api/complaints/master/departments`);
                setDepartments(response.data.departments || []);
            } catch (err) {
                console.error('Failed to load departments');
            }
        };
        fetchDepts();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Validate password
        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters long.');
            setLoading(false);
            return;
        }

        try {
            const response = await axios.post(`${API_URL}/api/auth/register`, formData);
            if (response.data.success) {
                setSuccess(true);
                setTimeout(() => router.push('/officer/login'), 2000);
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Registration failed. Please try again.';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
                <div className="max-w-md w-full p-10 bg-white rounded-2xl shadow-2xl text-center">
                    <div className="text-6xl mb-6">✅</div>
                    <h1 className="text-3xl font-black text-green-700 mb-4">Commission Successful!</h1>
                    <p className="text-slate-500 font-medium">Your officer account has been created. Redirecting to login...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
            <div className="max-w-2xl w-full p-10 bg-white rounded-2xl shadow-2xl border-t-8 border-t-blue-900">
                <div className="text-center mb-10">
                    <div className="text-4xl mb-4">📜</div>
                    <h1 className="text-3xl font-extrabold text-slate-900">Service Registration</h1>
                    <p className="text-slate-500 font-medium">New Departmental Officer Commissioning Flow</p>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl">
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">❌</span>
                            <div>
                                <p className="font-bold text-red-800">Registration Failed</p>
                                <p className="text-red-700 text-sm">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Full Legal Name</label>
                        <input
                            type="text" required className="gov-input"
                            value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Shri/Smt..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Service Email</label>
                        <input
                            type="email" required className="gov-input"
                            value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                            placeholder="name@gov.in"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Mobile Number</label>
                        <input
                            type="tel" required className="gov-input"
                            value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+91..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Department Assignment</label>
                        <select
                            required className="gov-input"
                            value={formData.department_id} onChange={e => setFormData({ ...formData, department_id: e.target.value })}
                        >
                            <option value="">Select Department</option>
                            {departments.map((dept: any) => (
                                <option key={dept.id} value={dept.id}>{dept.name} ({dept.code})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Secure Password</label>
                        <input
                            type="password" required className="gov-input" minLength={6}
                            value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                            placeholder="••••••••"
                        />
                        <p className="text-xs text-slate-400 mt-1">Minimum 6 characters</p>
                    </div>
                    <div className="md:col-span-2 pt-4">
                        <button
                            type="submit" disabled={loading}
                            className="w-full py-4 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl transition-all shadow-lg text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    Processing Commission...
                                </span>
                            ) : 'Register as Department Officer'}
                        </button>
                    </div>
                </form>
                <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                    <p className="text-sm text-slate-500">
                        Already have service credentials? <Link href="/officer/login" className="text-blue-700 font-bold hover:underline">Login here</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
