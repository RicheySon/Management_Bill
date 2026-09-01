'use client';

import { useEffect, useState } from 'react';
import { fetchDashboardData } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';
import { DollarSign, Users, Building2, FileText, AlertCircle } from 'lucide-react';

export default function HomePage() {
    const { user, hasPermission } = useAuth();
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const canViewDashboard = hasPermission('view_reports') || hasPermission('record_payment') || hasPermission('manage_users');

    useEffect(() => {
        const loadDashboard = async () => {
            if (!canViewDashboard) {
                setLoading(false);
                return;
            }
            try {
                const data = await fetchDashboardData();
                setDashboardData(data);
            } catch (error) {
                console.error('Failed to load dashboard:', error);
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, [canViewDashboard]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-municipal-red mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    if (!canViewDashboard) {
        return (
            <div className="max-w-3xl mx-auto">
                <div className="card p-8">
                    <h1 className="text-3xl font-bold text-gray-900">Welcome, {user?.full_name}</h1>
                    <p className="text-gray-600 mt-2">
                        Role: {(user?.roles || []).join(', ') || 'Staff'}
                    </p>
                    <p className="text-gray-500 mt-4">
                        Use the sidebar to register customers, properties, and businesses in your assigned area.
                        Revenue analytics are available to officers with reporting access.
                    </p>
                    <div className="mt-6 grid sm:grid-cols-3 gap-3">
                        <a href="/customers" className="btn-secondary text-center">Customers</a>
                        <a href="/properties" className="btn-secondary text-center">Properties</a>
                        <a href="/businesses" className="btn-secondary text-center">Businesses</a>
                    </div>
                </div>
            </div>
        );
    }

    const { revenue, counts } = dashboardData || { revenue: {}, counts: {} };

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-600 mt-1">Revenue overview and system statistics</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                    title="Total Revenue"
                    value={`GHS ${parseFloat(revenue.total_collected || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`}
                    icon={<DollarSign className="w-8 h-8" />}
                    color="bg-green-500"
                />
                <StatCard
                    title="Outstanding"
                    value={`GHS ${parseFloat(revenue.total_outstanding || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`}
                    icon={<AlertCircle className="w-8 h-8" />}
                    color="bg-red-500"
                />
                <StatCard
                    title="Total Customers"
                    value={counts.customers || 0}
                    icon={<Users className="w-8 h-8" />}
                    color="bg-municipal-red"
                />
                <StatCard
                    title="Active Properties"
                    value={counts.properties || 0}
                    icon={<Building2 className="w-8 h-8" />}
                    color="bg-purple-500"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <StatCard
                    title="Active Businesses"
                    value={counts.businesses || 0}
                    icon={<FileText className="w-8 h-8" />}
                    color="bg-orange-500"
                />
                <StatCard
                    title="Unpaid Bills"
                    value={counts.unpaid_bills || 0}
                    icon={<AlertCircle className="w-8 h-8" />}
                    color="bg-yellow-500"
                />
            </div>

            {/* Quick Actions */}
            <div className="card">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ActionButton
                        href="/customers/new"
                        label="Register Customer"
                        icon={<Users className="w-5 h-5" />}
                    />
                    <ActionButton
                        href="/properties/new"
                        label="Register Property"
                        icon={<Building2 className="w-5 h-5" />}
                    />
                    <ActionButton
                        href="/businesses/new"
                        label="Register Business"
                        icon={<FileText className="w-5 h-5" />}
                    />
                </div>
            </div>

            {/* Recent Payments */}
            {dashboardData?.recent_payments && dashboardData.recent_payments.length > 0 && (
                <div className="card mt-8">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Payments</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receipt No.</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">GCR No.</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bill No.</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recorded By</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {dashboardData.recent_payments.map((payment: any) => (
                                    <tr key={payment.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {payment.receipt_number}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {payment.gcr_number || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {payment.full_name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {payment.bill_number}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                                            GHS {parseFloat(payment.amount).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-municipal-red">
                                            {payment.recorded_by_name || '—'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {new Date(payment.payment_date).toLocaleDateString()}
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

function StatCard({ title, value, icon, color }: any) {
    return (
        <div className="card">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-600 font-medium">{title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
                </div>
                <div className={`${color} text-white p-3 rounded-lg`}>
                    {icon}
                </div>
            </div>
        </div>
    );
}

function ActionButton({ href, label, icon }: any) {
    return (
        <a
            href={href}
            className="flex items-center space-x-3 p-4 bg-red-50 hover:bg-red-100 rounded-lg border-2 border-red-200 hover:border-red-300 transition-all group"
        >
            <div className="text-municipal-red group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <span className="font-semibold text-gray-800">{label}</span>
        </a>
    );
}
