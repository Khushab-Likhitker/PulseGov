'use client';

import React, { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function Login() {
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await axios.post(`${API_URL}/api/auth/login`, formData);
            if (response.data.success) {
                const user = response.data.user;
                localStorage.setItem('user_token', JSON.stringify(user));

                alert(`✅ Welcome back, ${user.name}!`);

                if (user.role === 'citizen') router.push('/citizen');
                else if (user.role === 'officer') router.push('/officer');
                else router.push('/admin');
            }
        } catch (error: any) {
            alert('❌ Login failed: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
            <div className="gov-card max-w-md w-full p-10 space-y-8 animate-in fade-in zoom-in duration-500 bg-white shadow-2xl border-t-4 border-t-blue-700">
                <div className="text-center">
                    <div className="gov-emblem mx-auto mb-4">🇮🇳</div>
                    <h2 className="text-3xl font-bold text-slate-900">Official Login</h2>
                    <p className="mt-2 text-slate-500 font-medium italic">Ministry of Civic Governance</p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Email Address</label>
                            <input
                                type="email" required className="gov-input"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="name@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
                            <input
                                type="password" required className="gov-input"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="gov-btn-primary w-full py-4 text-lg font-bold"
                    >
                        {loading ? 'Authenticating...' : 'Sign In'}
                    </button>
                </form>
                <div className="text-center pt-4 border-t border-slate-100">
                    <p className="text-sm text-slate-500">
                        Don't have an account?{' '}
                        <Link href="/register" className="text-blue-700 hover:text-blue-800 font-bold underline">
                            Register now
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
