'use client';

import React, { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function OfficerLogin() {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await axios.post(`${API_URL}/api/auth/login`, formData);
            if (response.data.success) {
                const user = response.data.user;
                if (user.role !== 'officer') {
                    alert('❌ Error: This portal is for Department Officers only.');
                    setLoading(false);
                    return;
                }
                localStorage.setItem('user_token', JSON.stringify(user));
                alert(`✅ Welcome Officer ${user.name}!`);
                router.push('/officer/dashboard');
            }
        } catch (error: any) {
            alert('❌ Login failed: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
            <div className="max-w-md w-full p-10 bg-white rounded-2xl shadow-2xl border-t-8 border-t-blue-900">
                <div className="text-center mb-8">
                    <div className="text-4xl mb-4">🏛️</div>
                    <h1 className="text-3xl font-extrabold text-slate-900">Officer Portal</h1>
                    <p className="text-slate-500 font-medium">Internal Government Security Authenticator</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Service Email</label>
                        <input
                            type="email" required className="gov-input"
                            value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                            placeholder="officer@gov.in"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Secure Password</label>
                        <input
                            type="password" required className="gov-input"
                            value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                            placeholder="••••••••"
                        />
                    </div>
                    <button
                        type="submit" disabled={loading}
                        className="w-full py-4 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl transition-all shadow-lg"
                    >
                        {loading ? 'Authenticating...' : 'Secure Login'}
                    </button>
                </form>
                <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                    <p className="text-sm text-slate-500">
                        New officer commission? <Link href="/officer/register" className="text-blue-700 font-bold hover:underline">Register Service Account</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
