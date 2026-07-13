'use client';

import { useState, useEffect, useMemo } from 'react';
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
                fetchRevenueReport({ year: filters.year, period: 'month' }),
                fetchDefaulters(filters.electoral_area_id ? { electoral_area_id: filters.electoral_area_id } : {}),
                fetchElectoralAreas()
            ]);
            setRevenueData(rev || []);
            setDefaulters(def || []);
            setAreas(areaList || []);
        } catch (err) {
            console.error('Failed to load report data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [filters.year, filters.electoral_area_id]);

    const totalRevenue = revenueData.reduce((sum, item) => sum + parseFloat(item.total_collected || 0), 0);
    const totalBilled = revenueData.reduce((sum, item) => sum + parseFloat(item.total_billed || 0), 0);
    const totalOutstanding = revenueData.reduce((sum, item) => sum + parseFloat(item.total_outstanding || 0), 0);
    const collectionRate = totalBilled > 0 ? Math.round((totalRevenue / totalBilled) * 100) : 0;

    const yearOptions = useMemo(() => {
        const current = new Date().getFullYear();
        return [current - 2, current - 1, current, current + 1];
    }, []);

    const exportCsv = () => {
        const rows =
            activeTab === 'revenue'
                ? [
                      ['Period', 'Bill Type', 'Bill Count', 'Total Billed', 'Collected', 'Outstanding'],
                      ...revenueData.map((r) => [
                          r.period ? new Date(r.period).toLocaleDateString() : '',
                          r.bill_type || '',
                          r.bill_count || 0,
                          r.total_billed || 0,
                          r.total_collected || 0,
                          r.total_outstanding || 0,
                      ]),
                  ]
                : [
                      ['Customer', 'Phone', 'Electoral Area', 'Unpaid Bills', 'Outstanding'],
                      ...defaulters.map((d) => [
                          d.full_name || '',
                          d.phone_number || '',
                          d.electoral_area || '',
                          d.unpaid_bill_count || 0,
                          d.total_outstanding || 0,
                      ]),
                  ];

        const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = activeTab === 'revenue' ? `revenue-${filters.year}.csv` : `defaulters-${filters.year}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
                    <p className="text-gray-600 mt-1">Financial performance and collection insights</p>
                </div>
                <div className="flex space-x-3">
                    <button onClick={exportCsv} className="btn-secondary flex items-center space-x-2">
                        <Download className="w-4 h-4" />
                        <span>Export CSV</span>
                    </button>
                </div>
            </div>

            <div className="card flex flex-wrap items-center gap-4 py-4">
                <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <select
                        className="input-field py-1"
                        value={filters.year}
                        onChange={(e) => setFilters({ ...filters, year: parseInt(e.target.value) })}
                    >
                        {yearOptions.map((y) => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
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
                        {areas.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <SummaryCard
                    title="Yearly Collected"
                    value={`GHS ${totalRevenue.toLocaleString()}`}
                    trend={`Billed: GHS ${totalBilled.toLocaleString()}`}
                    icon={<TrendingUp className="text-green-600" />}
                    color="border-l-4 border-l-green-500"
                />
                <SummaryCard
                    title="Total Outstanding"
                    value={`GHS ${totalOutstanding.toLocaleString()}`}
                    trend={`Collection rate: ${collectionRate}%`}
                    icon={<AlertTriangle className="text-red-600" />}
                    color="border-l-4 border-l-red-500"
                />
                <SummaryCard
                    title="Defaulters"
                    value={String(defaulters.length)}
                    trend="Customers with unpaid balances"
                    icon={<Users className="text-municipal-red" />}
                    color="border-l-4 border-l-municipal-red"
                />
            </div>

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
                    DEFAULTERS
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-municipal-red" />
                </div>
            ) : activeTab === 'revenue' ? (
                <div className="card p-6 h-96">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={revenueData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis
                                dataKey="period"
                                tickFormatter={(v) => (v ? new Date(v).toLocaleDateString(undefined, { month: 'short' }) : '')}
                            />
                            <YAxis />
                            <Tooltip formatter={(value: any) => `GHS ${Number(value).toLocaleString()}`} />
                            <Bar dataKey="total_collected" name="Collected" fill="#16a34a" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="total_outstanding" name="Outstanding" fill="#dc2626" radius={[4, 4, 0, 0]}>
                                {revenueData.map((_, i) => (
                                    <Cell key={i} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="card overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-3 text-left">Customer</th>
                                <th className="px-4 py-3 text-left">Phone</th>
                                <th className="px-4 py-3 text-left">Area</th>
                                <th className="px-4 py-3 text-right">Unpaid Bills</th>
                                <th className="px-4 py-3 text-right">Outstanding</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {defaulters.map((d) => (
                                <tr key={d.id}>
                                    <td className="px-4 py-3 font-medium">{d.full_name}</td>
                                    <td className="px-4 py-3">{d.phone_number}</td>
                                    <td className="px-4 py-3">{d.electoral_area || '—'}</td>
                                    <td className="px-4 py-3 text-right">{d.unpaid_bill_count}</td>
                                    <td className="px-4 py-3 text-right font-bold text-red-600">
                                        GHS {parseFloat(d.total_outstanding || 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <Link href={`/customers/${d.id}`} className="text-municipal-red font-semibold text-xs">
                                            VIEW
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {defaulters.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                                        No defaulters for this filter.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function SummaryCard({
    title,
    value,
    trend,
    icon,
    color,
}: {
    title: string;
    value: string;
    trend: string;
    icon: React.ReactNode;
    color: string;
}) {
    return (
        <div className={`card p-5 ${color}`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs font-bold text-gray-500 uppercase">{title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
                    <p className="text-xs text-gray-500 mt-2">{trend}</p>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
            </div>
        </div>
    );
}
