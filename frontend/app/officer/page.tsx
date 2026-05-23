'use client';

import React from 'react';
import Link from 'next/link';

export default function OfficerEntry() {
    return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6 relative overflow-hidden">
            {/* Abstract Background Design */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
                <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-blue-600 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-indigo-600 rounded-full blur-[120px] animate-pulse delay-700"></div>
            </div>

            <div className="max-w-4xl w-full relative z-10 text-center">
                <div className="inline-block mb-10 p-4 bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl">
                    <div className="text-6xl">🏛️</div>
                </div>

                <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter">
                    Officer <span className="text-blue-500">Command</span>
                </h1>
                <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto font-medium">
                    Secure gateway for departmental officers to monitor grievances,
                    analyze AI patterns, and drive administrative resolutions.
                </p>

                <div className="grid md:grid-cols-2 gap-8">
                    <Link href="/officer/login" className="group p-8 bg-slate-800 hover:bg-slate-700 rounded-3xl border border-slate-700 transition-all hover:-translate-y-2 hover:shadow-[0_0_40px_rgba(59,130,246,0.2)]">
                        <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">🔑</div>
                        <h3 className="text-2xl font-bold mb-2">Secure Login</h3>
                        <p className="text-slate-500 text-sm mb-6">Access your active command dashboard and dossiers.</p>
                        <div className="text-blue-400 font-bold flex items-center justify-center gap-2 group-hover:gap-4 transition-all uppercase text-xs tracking-widest">
                            Authenticate Now <span>→</span>
                        </div>
                    </Link>

                    <Link href="/officer/register" className="group p-8 bg-slate-800 hover:bg-slate-700 rounded-3xl border border-slate-700 transition-all hover:-translate-y-2 hover:shadow-[0_0_40px_rgba(34,197,94,0.1)]">
                        <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">📜</div>
                        <h3 className="text-2xl font-bold mb-2">Commission Account</h3>
                        <p className="text-slate-500 text-sm mb-6">New to the service? Register your official credentials.</p>
                        <div className="text-green-400 font-bold flex items-center justify-center gap-2 group-hover:gap-4 transition-all uppercase text-xs tracking-widest">
                            Start Commission <span>→</span>
                        </div>
                    </Link>
                </div>

                <div className="mt-16 text-slate-600 text-xs font-bold uppercase tracking-widest">
                    Ministry of Civic Governance • Authorized Personnel Only
                </div>
            </div>
        </div>
    );
}
