'use client';

import Link from 'next/link';

export default function HomePage() {
    return (
        <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
            <div className="max-w-5xl w-full text-center fade-in">
                <div className="inline-block mb-10 animate-bounce">
                    <div className="gov-emblem text-4xl shadow-2xl shadow-blue-500/20">⚖️</div>
                </div>

                <h1 className="text-5xl md:text-6xl font-extrabold mb-4 text-slate-900 tracking-tight">
                    PulseGov
                </h1>
                <p className="text-2xl text-slate-600 mb-6 font-medium">Civic Complaint Management System</p>

                <p className="text-lg text-slate-500 mb-12 max-w-2xl mx-auto leading-relaxed">
                    Official platform for citizens to submit and track civic grievances.
                    Powered by Artificial Intelligence for high-speed resolution and transparency.
                </p>

                <div className="grid md:grid-cols-2 gap-8 mb-16">
                    <Link href="/login" className="gov-card p-10 hover:shadow-2xl transition-all hover:-translate-y-2 cursor-pointer group bg-white">
                        <div className="w-20 h-20 bg-blue-700 rounded-2xl flex items-center justify-center mb-6 mx-auto group-hover:bg-blue-600 transition-colors shadow-lg">
                            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </div>
                        <h3 className="text-3xl font-bold mb-3 text-slate-900">Citizen Portal</h3>
                        <p className="text-slate-500 mb-4 font-medium">Lodge new complaints or track existing status</p>
                        <div className="text-blue-700 font-bold text-lg group-hover:translate-x-2 transition-transform inline-flex items-center">
                            Access Portal <span className="ml-2">→</span>
                        </div>
                    </Link>

                    <Link href="/officer" className="gov-card p-10 hover:shadow-2xl transition-all hover:-translate-y-2 cursor-pointer group bg-white border-l-4 border-l-green-600">
                        <div className="w-20 h-20 bg-green-700 rounded-2xl flex items-center justify-center mb-6 mx-auto group-hover:bg-green-600 transition-colors shadow-lg">
                            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </div>
                        <h3 className="text-3xl font-bold mb-3 text-slate-900">Officer Dashboard</h3>
                        <p className="text-slate-500 mb-4 font-medium">AI-powered resolution & analytics hub</p>
                        <div className="text-green-700 font-bold text-lg group-hover:translate-x-2 transition-transform inline-flex items-center">
                            Access Dashboard <span className="ml-2">→</span>
                        </div>
                    </Link>
                </div>

                <div className="bg-slate-100/50 p-6 rounded-2xl inline-flex items-center gap-4 border border-slate-200">
                    <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                    </span>
                    <p className="text-slate-600 font-semibold text-sm">
                        Live Tracking: Thousands of grievances resolved weekly across 13 departments.
                    </p>
                </div>
            </div>
        </div>
    );
}
