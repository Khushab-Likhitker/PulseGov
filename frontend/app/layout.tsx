import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'PulseGov - Ministry of Civic Governance',
    description: 'Official Government of India Civic Grievance Management System',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body className="flex flex-col min-h-screen">
                {/* Government Header */}
                <header className="bg-white border-b border-gray-200 shadow-sm fixed top-0 w-full z-50">
                    <div className="tricolor-header"></div>
                    <div className="container mx-auto px-4 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="gov-emblem">🇮🇳</div>
                                <div>
                                    <h1 className="text-xl font-bold text-gray-900 tracking-tight">Ministry of Civic Governance</h1>
                                    <p className="text-xs uppercase tracking-widest text-gray-600 font-semibold">Government of India</p>
                                </div>
                            </div>
                            <div className="hidden md:flex items-center space-x-4 text-xs font-medium text-gray-500">
                                <span>Screen Reader Access</span>
                                <span>|</span>
                                <span className="hover:text-blue-600 cursor-pointer transition-colors">हिंदी</span>
                                <span>|</span>
                                <span className="hover:text-blue-600 cursor-pointer transition-colors font-bold">A+</span>
                                <span className="hover:text-blue-600 cursor-pointer transition-colors font-bold">A-</span>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-grow pt-32">
                    {children}
                </main>

                {/* Government Footer */}
                <footer className="gov-footer mt-16 shadow-2xl">
                    <div className="container mx-auto px-4 py-12">
                        <div className="grid md:grid-cols-4 gap-12">
                            <div>
                                <h3 className="text-white font-bold mb-4 text-lg">Ministry of Civic Governance</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    Official portal for citizen grievance redressal and transparent governance.
                                    An initiative under Digital India.
                                </p>
                            </div>
                            <div>
                                <h4 className="text-white font-semibold mb-4 underline decoration-blue-500 underline-offset-8">Quick Links</h4>
                                <ul className="space-y-3 text-sm">
                                    <li><a href="#" className="text-gray-400 hover:text-white transition-colors">About the Ministry</a></li>
                                    <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Citizen Charter</a></li>
                                    <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</a></li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="text-white font-semibold mb-4 underline decoration-blue-500 underline-offset-8">Support</h4>
                                <ul className="space-y-3 text-sm">
                                    <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Helpline: 1800-XXX-XXXX</a></li>
                                    <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Technical Support</a></li>
                                    <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Contact Us</a></li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="text-white font-semibold mb-4 underline decoration-blue-500 underline-offset-8">Social Media</h4>
                                <div className="flex space-x-6 text-2xl">
                                    <span className="cursor-pointer hover:text-blue-400 hover:scale-125 transition-all">📘</span>
                                    <span className="cursor-pointer hover:text-blue-300 hover:scale-125 transition-all">🐦</span>
                                    <span className="cursor-pointer hover:text-red-500 hover:scale-125 transition-all">📺</span>
                                </div>
                            </div>
                        </div>
                        <div className="border-t border-gray-700 mt-12 pt-8 text-center text-gray-500 text-sm italic">
                            © 2026 Ministry of Civic Governance, Government of India. All rights reserved.
                        </div>
                    </div>
                </footer>
            </body>
        </html>
    )
}
