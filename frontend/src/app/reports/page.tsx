'use client';

import { useState, useEffect } from 'react';
import { fetchRevenueReport, fetchDefaulters, fetchElectoralAreas } from '@/lib/api-client';
import { BarChart3, TrendingUp, Users, AlertTriangle, Download, Filter, Calendar } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell
} from 'recharts';

import Link from 'next/link';

export default function ReportsPage() {
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('revenue');
    const [revenueData, setRevenueData] = useState<any[]>([]);
    const [defaulters, setDefaulters] = useState<any[]>([]);
    const [areas, setAreas] = useState<any[]>([]);
    const [filters, setFilters] = useState({
        year: new Date().getFullYear(),
        electoral_area_id: ''
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const [rev, def, areaList] = await Promise.all([
                fetchRevenueReport(filters),
                fetchDefaulters(filters),
                fetchElectoralAreas()
            ]);
            setRevenueData(rev);
            setDefaulters(def);
            setAreas(areaList);
        } catch (err) {
            console.error('Failed to load report data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [filters.year, filters.electoral_area_id]);

    const totalRevenue = revenueData.reduce((sum, item) => sum + parseFloat(item.total_collected), 0);
    const totalOutstanding = revenueData.reduce((sum, item) => sum + parseFloat(item.total_outstanding), 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
                    <p className="text-gray-600 mt-1">Financial performance and collection insights</p>
                </div>
                <div className="flex space-x-3">
                    <button className="btn-secondary flex items-center space-x-2">
                        <Download className="w-4 h-4" />
                        <span>Export CSV</span>
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="card flex flex-wrap items-center gap-4 py-4">
                <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <select
                        className="input-field py-1"
                        value={filters.year}
                        onChange={(e) => setFilters({ ...filters, year: parseInt(e.target.value) })}
                    >
                        {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div className="flex items-center space-x-2">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <select
                        className="input-field py-1"
                        value={filters.electoral_area_id}
                        onChange={(e) => setFilters({ ...filters, electoral_area_id: e.target.value })}
                    >
                        <option value="">All Areas</option>
                        {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <SummaryCard
                    title="Yearly Collected"
                    value={`GHS ${totalRevenue.toLocaleString()}`}
                    trend="+12% vs last year"
                    icon={<TrendingUp className="text-green-600" />}
                    color="border-l-4 border-l-green-500"
                />
                <SummaryCard
                    title="Total Outstanding"
                    value={`GHS ${totalOutstanding.toLocaleString()}`}
                    trend="Collection rate: 64%"
                    icon={<AlertTriangle className="text-red-600" />}
                    color="border-l-4 border-l-red-500"
                />
                <SummaryCard
                    title="Top Area"
                    value={revenueData[0]?.area_name || 'N/A'}
                    trend="Highest compliance"
                    icon={<BarChart3 className="text-municipal-red" />}
                    color="border-l-4 border-l-municipal-red"
                />
            </div>

            {/* Tabs */}
            <div className="border-b flex space-x-8">
                <button
                    onClick={() => setActiveTab('revenue')}
                    className={`pb-4 px-2 font-bold text-sm transition-all ${activeTab === 'revenue' ? 'border-b-2 border-municipal-red text-municipal-red' : 'text-gray-400'}`}
                >
                    REVENUE BY PERIOD
                </button>
                <button
                    onClick={() => setActiveTab('defaulters')}
                    className={`pb-4 px-2 font-bold text-sm transition-all ${activeTab === 'defaulters' ? 'border-b-2 border-municipal-red text-municipal-red' : 'text-gray-400'}`}
                >
                    DEFAULTERS LIST
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 /></div>
            ) : activeTab === 'revenue' ? (
                <div className="space-y-6">
                    <div className="card h-80">
                        <h3 className="font-bold mb-4">Revenue Collection Trend (Monthly)</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={revenueData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="period_label" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="total_collected" fill="#991B1B" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="card">
                        <h3 className="font-bold mb-4">Detailed Revenue Breakdown</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead>
                                    <tr className="bg-gray-50 text-left text-xs text-gray-500 font-bold uppercase">
                                        <th className="p-4">Period</th>
                                        <th className="p-4">Bill Type</th>
                                        <th className="p-4 text-right">Collected</th>
                                        <th className="p-4 text-right">Outstanding</th>
                                        <th className="p-4 text-right">Bills Count</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {revenueData.map((item, i) => (
                                        <tr key={i} className="text-sm">
                                            <td className="p-4 font-semibold">{item.period_label}</td>
                                            <td className="p-4 text-gray-600">{item.bill_type}</td>
                                            <td className="p-4 text-right font-bold text-green-600">GHS {parseFloat(item.total_collected).toFixed(2)}</td>
                                            <td className="p-4 text-right font-bold text-red-600">GHS {parseFloat(item.total_outstanding).toFixed(2)}</td>
                                            <td className="p-4 text-right text-gray-600">{item.bill_count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="card">
                    <h3 className="font-bold mb-4">Priority Defaulters (Over GHS 500)</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead>
                                <tr className="bg-gray-50 text-left text-xs text-gray-500 font-bold uppercase">
                                    <th className="p-4">Customer</th>
                                    <th className="p-4">Phone</th>
                                    <th className="p-4">Area</th>
                                    <th className="p-4 text-right">Outstanding</th>
                                    <th className="p-4 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {defaulters.map((item, i) => (
                                    <tr key={i} className="text-sm">
                                        <td className="p-4 font-bold">{item.full_name}</td>
                                        <td className="p-4 text-gray-600">{item.phone_number}</td>
                                        <td className="p-4 text-gray-600">{item.area_name}</td>
                                        <td className="p-4 text-right font-black text-red-600">GHS {parseFloat(item.total_outstanding).toLocaleString()}</td>
                                        <td className="p-4 text-center">
                                            <Link href={`/customers/${item.id}`} className="text-municipal-red hover:underline text-xs font-bold">SEND REMINDER</Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

function SummaryCard({ title, value, trend, icon, color }: any) {
    return (
        <div className={`card ${color}`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-gray-500 text-xs font-bold uppercase">{title}</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">{value}</p>
                    <p className="text-xs text-gray-400 mt-2">{trend}</p>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
            </div>
        </div>
    );
}

function Loader2() {
    return <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-municipal-red"></div>;
}
