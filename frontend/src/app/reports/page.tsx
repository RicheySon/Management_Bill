'use client';

import { useState, useEffect, useMemo } from 'react';
import { fetchMonthlyReport, fetchDefaulters, fetchElectoralAreas } from '@/lib/api-client';
import { TrendingUp, Users, AlertTriangle, Download, Filter, Calendar } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend
} from 'recharts';

import Link from 'next/link';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

export default function ReportsPage() {
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'monthly' | 'defaulters'>('monthly');
    const [monthlyReport, setMonthlyReport] = useState<any>(null);
    const [defaulters, setDefaulters] = useState<any[]>([]);
    const [areas, setAreas] = useState<any[]>([]);
    const [filters, setFilters] = useState({
        year: new Date().getFullYear(),
        month: '' as number | '',
        electoral_area_id: '',
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const params: any = { year: filters.year };
            if (filters.month) params.month = filters.month;
            if (filters.electoral_area_id) params.electoral_area_id = filters.electoral_area_id;

            const [monthly, def, areaList] = await Promise.all([
                fetchMonthlyReport(params),
                fetchDefaulters(filters.electoral_area_id ? { electoral_area_id: filters.electoral_area_id } : {}),
                fetchElectoralAreas(),
            ]);
            setMonthlyReport(monthly || { months: [], totals: {} });
            setDefaulters(def || []);
            setAreas(areaList || []);
        } catch (err) {
            console.error('Failed to load report data', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [filters.year, filters.month, filters.electoral_area_id]);

    const months = monthlyReport?.months || [];
    const totals = monthlyReport?.totals || {};
    const totalCollected = Number(totals.total_collected || 0);
    const totalBilled = Number(totals.total_billed || 0);
    const totalOutstanding = Number(totals.total_outstanding || 0);
    const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

    const chartData = useMemo(
        () =>
            months.map((m: any) => ({
                ...m,
                label: m.label || MONTH_NAMES[m.month - 1],
                total_collected: Number(m.total_collected || 0),
                total_billed: Number(m.total_billed || 0),
                total_outstanding: Number(m.total_outstanding || 0),
            })),
        [months]
    );

    const yearOptions = useMemo(() => {
        const current = new Date().getFullYear();
        return [current - 2, current - 1, current, current + 1];
    }, []);

    const reportTitle = filters.month
        ? `${MONTH_NAMES[Number(filters.month) - 1]} ${filters.year}`
        : `Year ${filters.year}`;

    const exportCsv = () => {
        const rows: Array<Array<string | number>> =
            activeTab === 'monthly'
                ? [
                      ['Month', 'Bills', 'Total Billed', 'Payments', 'Collected', 'Outstanding'],
                      ...months.map((r: any) => [
                          r.label || `${MONTH_NAMES[r.month - 1]} ${r.year}`,
                          r.bill_count || 0,
                          r.total_billed || 0,
                          r.payment_count || 0,
                          r.total_collected || 0,
                          r.total_outstanding || 0,
                      ]),
                      [
                          'TOTAL',
                          totals.bill_count || 0,
                          totals.total_billed || 0,
                          totals.payment_count || 0,
                          totals.total_collected || 0,
                          totals.total_outstanding || 0,
                      ],
                  ]
                : [
                      ['Customer', 'Phone', 'Electoral Area', 'Unpaid Bills', 'Outstanding'],
                      ...defaulters.map((d: any) => [
                          d.full_name || '',
                          d.phone_number || '',
                          d.electoral_area || '',
                          d.unpaid_bill_count || 0,
                          d.total_outstanding || 0,
                      ]),
                  ];

        const csv = rows
            .map((row) => row.map((cell: string | number) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const monthSuffix = filters.month ? `-${String(filters.month).padStart(2, '0')}` : '';
        link.download =
            activeTab === 'monthly'
                ? `monthly-report-${filters.year}${monthSuffix}.csv`
                : `defaulters-${filters.year}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
                    <p className="text-gray-600 mt-1">Generate monthly and yearly collection reports</p>
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
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <select
                        className="input-field py-1"
                        value={filters.month}
                        onChange={(e) =>
                            setFilters({
                                ...filters,
                                month: e.target.value ? parseInt(e.target.value) : '',
                            })
                        }
                    >
                        <option value="">All Months</option>
                        {MONTH_NAMES.map((name, idx) => (
                            <option key={name} value={idx + 1}>
                                {name}
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
                    title={filters.month ? 'Month Collected' : 'Yearly Collected'}
                    value={`GHS ${totalCollected.toLocaleString()}`}
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
                    onClick={() => setActiveTab('monthly')}
                    className={`pb-4 px-2 font-bold text-sm transition-all ${activeTab === 'monthly' ? 'border-b-2 border-municipal-red text-municipal-red' : 'text-gray-400'}`}
                >
                    MONTHLY REPORT
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
            ) : activeTab === 'monthly' ? (
                <div className="space-y-6">
                    <div className="card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Revenue by Month</h2>
                                <p className="text-sm text-gray-500">{reportTitle} — chronological order</p>
                            </div>
                        </div>
                        <div className="h-80">
                            {chartData.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-gray-500">
                                    No billing or payment data for this period.
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="label" />
                                        <YAxis />
                                        <Tooltip formatter={(value: any) => `GHS ${Number(value).toLocaleString()}`} />
                                        <Legend />
                                        <Bar dataKey="total_collected" name="Collected" fill="#16a34a" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="total_billed" name="Billed" fill="#64748b" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="total_outstanding" name="Outstanding" fill="#dc2626" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    <div className="card overflow-hidden">
                        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                            <h3 className="font-bold text-gray-900">Monthly Breakdown — {reportTitle}</h3>
                            <button onClick={exportCsv} className="text-sm text-municipal-red font-semibold flex items-center gap-1">
                                <Download className="w-3.5 h-3.5" />
                                Download report
                            </button>
                        </div>
                        <table className="w-full text-sm">
                            <thead className="bg-white border-b">
                                <tr>
                                    <th className="px-4 py-3 text-left">Month</th>
                                    <th className="px-4 py-3 text-right">Bills</th>
                                    <th className="px-4 py-3 text-right">Billed</th>
                                    <th className="px-4 py-3 text-right">Payments</th>
                                    <th className="px-4 py-3 text-right">Collected</th>
                                    <th className="px-4 py-3 text-right">Outstanding</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {months.map((m: any) => (
                                    <tr key={`${m.year}-${m.month}`}>
                                        <td className="px-4 py-3 font-medium">
                                            {m.label || `${MONTH_NAMES[m.month - 1]} ${m.year}`}
                                        </td>
                                        <td className="px-4 py-3 text-right">{m.bill_count}</td>
                                        <td className="px-4 py-3 text-right">
                                            GHS {Number(m.total_billed || 0).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right">{m.payment_count}</td>
                                        <td className="px-4 py-3 text-right text-green-700 font-semibold">
                                            GHS {Number(m.total_collected || 0).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right text-red-600 font-semibold">
                                            GHS {Number(m.total_outstanding || 0).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                                {months.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                                            No monthly data for this filter. Try another year or month.
                                        </td>
                                    </tr>
                                )}
                                {months.length > 0 && (
                                    <tr className="bg-gray-50 font-bold">
                                        <td className="px-4 py-3">Total</td>
                                        <td className="px-4 py-3 text-right">{totals.bill_count || 0}</td>
                                        <td className="px-4 py-3 text-right">
                                            GHS {Number(totals.total_billed || 0).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right">{totals.payment_count || 0}</td>
                                        <td className="px-4 py-3 text-right text-green-700">
                                            GHS {Number(totals.total_collected || 0).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right text-red-600">
                                            GHS {Number(totals.total_outstanding || 0).toLocaleString()}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
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
