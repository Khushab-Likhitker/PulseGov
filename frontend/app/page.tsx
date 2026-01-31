'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function HomePage() {
    const [activeRole, setActiveRole] = useState<'citizen' | 'officer' | 'admin'>('citizen');

    return (
        <div className="min-h-screen flex items-center justify-center p-8">
            <div className="max-w-6xl w-full">
                {/* Hero Section */}
                <div className="text-center mb-16">
                    <div className="inline-block mb-6">
                        <div className="w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-primary-500/50">
                            <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                    </div>

                    <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-white via-primary-200 to-white bg-clip-text text-transparent">
                        PulseGov
                    </h1>
                    <p className="text-2xl text-white/60 mb-2">AI-Powered Civic Governance</p>
                    <p className="text-lg text-white/40 max-w-2xl mx-auto">
                        Smart grievance management with resolution intelligence, predictive SLA analytics, and blockchain transparency
                    </p>
                </div>

                {/* Role Selector */}
                <div className="flex gap-4 justify-center mb-12">
                    <button
                        onClick={() => setActiveRole('citizen')}
                        className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${activeRole === 'citizen'
                                ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/50'
                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                            }`}
                    >
                        👤 Citizen
                    </button>
                    <button
                        onClick={() => setActiveRole('officer')}
                        className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${activeRole === 'officer'
                                ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/50'
                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                            }`}
                    >
                        👮 Officer
                    </button>
                    <button
                        onClick={() => setActiveRole('admin')}
                        className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${activeRole === 'admin'
                                ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/50'
                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                            }`}
                    >
                        ⚙️ Admin
                    </button>
                </div>

                {/* Portal Cards */}
                <div className="grid md:grid-cols-3 gap-8">
                    {/* Citizen Portal */}
                    {activeRole === 'citizen' && (
                        <Link href="/citizen" className="glass-card p-8 hover:scale-105 transition-transform duration-300 group">
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:shadow-2xl group-hover:shadow-blue-500/50 transition-all">
                                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-bold mb-2">File Complaint</h3>
                            <p className="text-white/60 mb-4">Submit and track your civic grievances with real-time updates</p>
                            <div className="flex items-center text-primary-400 font-semibold">
                                Get Started <span className="ml-2">→</span>
                            </div>
                        </Link>
                    )}

                    {/* Officer Dashboard */}
                    {activeRole === 'officer' && (
                        <Link href="/officer" className="glass-card p-8 hover:scale-105 transition-transform duration-300 group">
                            <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center mb-4 group-hover:shadow-2xl group-hover:shadow-green-500/50 transition-all">
                                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-bold mb-2">Resolution Hub</h3>
                            <p className="text-white/60 mb-4">AI-powered suggestions, SLA tracking, and collaborative resolution</p>
                            <div className="flex items-center text-primary-400 font-semibold">
                                View Dashboard <span className="ml-2">→</span>
                            </div>
                        </Link>
                    )}

                    {/* Admin Analytics */}
                    {activeRole === 'admin' && (
                        <Link href="/admin" className="glass-card p-8 hover:scale-105 transition-transform duration-300 group">
                            <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:shadow-2xl group-hover:shadow-purple-500/50 transition-all">
                                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-bold mb-2">Analytics Center</h3>
                            <p className="text-white/60 mb-4">Predictive insights, performance metrics, and blockchain audit</p>
                            <div className="flex items-center text-primary-400 font-semibold">
                                View Analytics <span className="ml-2">→</span>
                            </div>
                        </Link>
                    )}
                </div>

                {/* Feature Highlights */}
                <div className="mt-20 grid md:grid-cols-4 gap-6 text-center">
                    <div className="p-6">
                        <div className="text-4xl mb-2">🤖</div>
                        <h4 className="font-bold mb-1">AI Classification</h4>
                        <p className="text-sm text-white/60">Auto-categorize complaints with 95% accuracy</p>
                    </div>
                    <div className="p-6">
                        <div className="text-4xl mb-2">⚡</div>
                        <h4 className="font-bold mb-1">Smart Routing</h4>
                        <p className="text-sm text-white/60">Assign to best officer based on workload & expertise</p>
                    </div>
                    <div className="p-6">
                        <div className="text-4xl mb-2">🎯</div>
                        <h4 className="font-bold mb-1">Predictive SLA</h4>
                        <p className="text-sm text-white/60">Forecast breaches before they happen</p>
                    </div>
                    <div className="p-6">
                        <div className="text-4xl mb-2">🔗</div>
                        <h4 className="font-bold mb-1">Blockchain Audit</h4>
                        <p className="text-sm text-white/60">Immutable transparency for all actions</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
