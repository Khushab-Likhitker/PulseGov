'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
    href: string;
    label: string;
    icon: string;
}

const navItems: NavItem[] = [
    { href: '/officer/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/officer/complaints', label: 'Complaints', icon: '📋' },
    { href: '/officer/analysis', label: 'AI Analysis', icon: '🤖' },
];

export default function OfficerNav() {
    const pathname = usePathname();

    const handleLogout = () => {
        localStorage.removeItem('user_token');
        window.location.href = '/officer/login';
    };

    return (
        <nav className="bg-slate-900 text-white shadow-2xl sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/officer" className="flex items-center gap-3 group">
                        <span className="text-2xl">🏛️</span>
                        <span className="font-black text-lg tracking-tight group-hover:text-blue-400 transition-colors">
                            PulseGov <span className="text-blue-400">Officer</span>
                        </span>
                    </Link>

                    {/* Nav Links */}
                    <div className="flex items-center gap-2">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${isActive
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                        }`}
                                >
                                    <span>{item.icon}</span>
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-4">
                        <Link
                            href="/"
                            className="text-xs text-slate-500 hover:text-slate-300 font-bold uppercase tracking-widest transition-colors"
                        >
                            Main Site
                        </Link>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl font-bold text-sm transition-all"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}
