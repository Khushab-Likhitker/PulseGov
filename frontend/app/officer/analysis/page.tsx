'use client';

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import OfficerNav from '@/components/OfficerNav';

// Force graph can be heavy, load it dynamically
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function AIAnalysis() {
    const [user, setUser] = useState<any>(null);
    const [graphData, setGraphData] = useState<any>({ nodes: [], links: [] });
    const [loading, setLoading] = useState(true);
    const [hoverNode, setHoverNode] = useState<any>(null);
    const router = useRouter();

    const fetchNetwork = useCallback(async (officerId: number) => {
        try {
            const res = await axios.get(`${API_URL}/api/resolution/network/officer/${officerId}`);
            if (res.data.success) {
                const { nodes, edges } = res.data.network;
                // Transform for react-force-graph
                setGraphData({
                    nodes: nodes.map((n: any) => ({
                        ...n,
                        color: n.type === 'citizen' ? '#ef4444' :
                            (n.status === 'resolved' ? '#10b981' : '#3b82f6'),
                        size: n.type === 'citizen' ? 4 : 3
                    })),
                    links: edges.map((e: any) => ({
                        source: e.from,
                        target: e.to,
                        color: e.type === 'similarity' ? '#cbd5e1' : '#1e3a8a',
                        curvature: e.type === 'citizen_link' ? 0.2 : 0
                    }))
                });
            }
        } catch (err) {
            console.error('Failed to fetch network data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const storedUser = localStorage.getItem('user_token');
        if (!storedUser) { router.push('/officer/login'); return; }
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        fetchNetwork(parsedUser.id);
    }, [router, fetchNetwork]);

    if (loading) return <div className="p-20 text-center font-bold text-2xl animate-pulse">🧠 AI NEURAL NETWORK INITIALIZING...</div>;

    return (
        <div className="min-h-screen bg-slate-900 text-white overflow-hidden">
            <OfficerNav />

            <div className="relative">
                {/* Overlay Header */}
                <div className="absolute top-8 left-8 z-10 p-6 bg-slate-800/80 backdrop-blur-md rounded-2xl border border-slate-700 max-w-md shadow-2xl">
                    <h1 className="text-2xl font-black text-blue-400 mb-2">AI Resolution Intelligence</h1>
                    <p className="text-slate-400 text-sm mb-4">
                        Visualizing complaint interconnectedness. Nodes represent individual cases, edges indicate AI-detected similarities (category, location, or recurring citizen).
                    </p>
                    <div className="flex gap-4 mb-4">
                        <div className="flex items-center gap-2"><span className="w-3 h-3 bg-blue-500 rounded-full"></span> <span className="text-xs">Active Case</span></div>
                        <div className="flex items-center gap-2"><span className="w-3 h-3 bg-green-500 rounded-full"></span> <span className="text-xs">Resolved</span></div>
                        <div className="flex items-center gap-2"><span className="w-3 h-3 bg-red-500 rounded-full"></span> <span className="text-xs">Citizen Node</span></div>
                    </div>
                </div>

                {/* AI HUD Tooltip */}
                {hoverNode && (
                    <div className="absolute bottom-8 right-8 z-10 p-6 bg-blue-900/90 backdrop-blur-md rounded-2xl border border-blue-500/50 max-w-sm shadow-[0_0_30px_rgba(59,130,246,0.5)] animate-in fade-in slide-in-from-bottom-5">
                        <h3 className="font-black text-lg mb-1">{hoverNode.label}</h3>
                        <p className="text-blue-200 text-xs mb-3 italic uppercase">{hoverNode.type}</p>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-blue-300">Status:</span> <span>{hoverNode.status || 'N/A'}</span></div>
                            <div className="flex justify-between"><span className="text-blue-300">Priority:</span> <span>{hoverNode.priority || 'N/A'}</span></div>
                        </div>
                    </div>
                )}

                {/* Graph Rendering */}
                <div className="w-full h-[calc(100vh-64px)]">
                    <ForceGraph2D
                        graphData={graphData}
                        nodeRelSize={2}
                        nodeLabel={(node: any) => `${node.type}: ${node.label}`}
                        linkColor={(link: any) => link.color}
                        nodeColor={(node: any) => node.color}
                        linkDirectionalParticles={2}
                        linkDirectionalParticleSpeed={0.005}
                        onNodeHover={(node) => setHoverNode(node)}
                        backgroundColor="#0f172a"
                        onNodeClick={(node: any) => node.type === 'complaint' && router.push(`/complaint/${node.label}`)}
                    />
                </div>
            </div>
        </div>
    );
}
