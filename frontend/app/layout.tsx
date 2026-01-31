import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'PulseGov - AI-Powered Civic Governance',
    description: 'Smart grievance management with AI-powered resolution intelligence',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    )
}
