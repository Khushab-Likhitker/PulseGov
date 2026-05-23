'use client';

import React, { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function Register() {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        role: 'citizen',
        phone: '',
        aadhaar: '',
        district: '',
        state: '',
        pincode: '',
        department_id: ''
    });
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const finalData: any = { ...formData };
            if (finalData.role !== 'officer') delete finalData.department_id;

            const response = await axios.post(`${API_URL}/api/auth/register`, finalData);
            if (response.data.success) {
                alert('✅ Account created successfully! Please login.');
                router.push('/login');
            }
        } catch (error: any) {
            alert('❌ Registration failed: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
            <div className="gov-card max-w-2xl w-full p-10 space-y-8 animate-in fade-in zoom-in duration-500 bg-white shadow-2xl border-t-4 border-t-blue-700">
                <div className="text-center">
                    <div className="gov-emblem mx-auto mb-4">🇮🇳</div>
                    <h2 className="text-3xl font-bold text-slate-900">Official Portal Registration</h2>
                    <p className="mt-2 text-slate-500 font-medium italic">Ministry of Civic Governance</p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Full Name *</label>
                            <input
                                type="text" required className="gov-input"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Enter your full name"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Email Address *</label>
                            <input
                                type="email" required className="gov-input"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="name@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Password *</label>
                            <input
                                type="password" required className="gov-input"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                placeholder="••••••••"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Mobile Number *</label>
                            <input
                                type="tel" required className="gov-input"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="+91 0000000000"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Aadhaar Number *</label>
                            <input
                                type="text" required className="gov-input uppercase"
                                value={formData.aadhaar}
                                onChange={(e) => setFormData({ ...formData, aadhaar: e.target.value })}
                                placeholder="1234 5678 9012"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">State *</label>
                            <input
                                type="text" required className="gov-input"
                                value={formData.state}
                                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                placeholder="State Name"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">District *</label>
                            <input
                                type="text" required className="gov-input"
                                value={formData.district}
                                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                                placeholder="District Name"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Pincode *</label>
                            <input
                                type="text" required className="gov-input"
                                value={formData.pincode}
                                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                                placeholder="400001"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-slate-700 mb-1">Role *</label>
                            <select
                                className="gov-input"
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                            >
                                <option value="citizen">👤 Citizen (Public Grievance)</option>
                                <option value="officer">👮 Department Officer (Resolution)</option>
                            </select>
                        </div>

                        {formData.role === 'officer' && (
                            <div className="md:col-span-2 space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-100 animate-in slide-in-from-top-2">
                                <label className="block text-sm font-bold text-blue-900 mb-1">Assign Department *</label>
                                <select
                                    required
                                    className="gov-input border-blue-300"
                                    value={formData.department_id}
                                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                                >
                                    <option value="">Select your assigned department</option>
                                    <option value="1">Electricity Department</option>
                                    <option value="2">Water & Sanitation</option>
                                    <option value="3">Roads & Infrastructure</option>
                                    <option value="4">Garbage Management</option>
                                    <option value="5">Public Health</option>
                                    <option value="6">Police</option>
                                    <option value="7">Fire Safety</option>
                                    <option value="8">Environment</option>
                                </select>
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="gov-btn-primary w-full py-4 text-lg font-bold"
                    >
                        {loading ? 'Processing...' : 'Register User'}
                    </button>
                </form>
                <div className="text-center pt-4 border-t border-slate-100">
                    <p className="text-sm text-slate-500">
                        Already have an official account?{' '}
                        <Link href="/login" className="text-blue-700 hover:text-blue-800 font-bold underline">
                            Login here
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
