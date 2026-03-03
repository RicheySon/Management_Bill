'use client';

import { useState, useEffect } from 'react';
import { fetchBills, downloadBillPDF, fetchElectoralAreas, deleteBill } from '@/lib/api-client';
import {
    FileText, Search, Filter, Printer,
    CreditCard, Plus, CheckCircle2, AlertCircle, Clock, Trash
} from 'lucide-react';
import Link from 'next/link';

export default function BillingPage() {
    const [bills, setBills] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [electoralAreas, setElectoralAreas] = useState<any[]>([]);
    const [filters, setFilters] = useState({
        status: '',
        type: '',
        electoral_area_id: '',
        search: '',
    });

    const loadData = async () => {
        setLoading(true);
        try {
            // Map 'type' to 'bill_type' for backend compatibility
            const apiParams = {
                ...filters,
                bill_type: filters.type,
            };
            delete (apiParams as any).type;

            const [billsData, areasData] = await Promise.all([
                fetchBills(apiParams),
                fetchElectoralAreas()
            ]);
            setBills(billsData.data);
            setElectoralAreas(areasData);
        } catch (error) {
            console.error('Failed to load bills:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            loadData();
        }, filters.search ? 500 : 0); // Debounce search

        return () => clearTimeout(timer);
    }, [filters.status, filters.type, filters.electoral_area_id, filters.search]);

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this bill?')) return;
        try {
            await deleteBill(id);
            loadData();
        } catch (error) {
            console.error('Delete failed:', error);
            alert('Failed to delete bill');
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        loadData();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Billing Management</h1>
                    <p className="text-gray-600 mt-1">Manage invoices, payments and collection status</p>
                </div>
                <Link href="/billing/generate" className="btn-primary flex items-center space-x-2 self-start md:self-auto">
                    <Plus className="w-4 h-4" />
                    <span>Generate New Bill</span>
                </Link>
            </div>

            {/* Filters & Search */}
            <div className="card">
                <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search Bill No/Name..."
                            className="input-field pl-10"
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                        />
                    </div>
                    <select
                        className="input-field"
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    >
                        <option value="">All Statuses</option>
                        <option value="UNPAID">Unpaid</option>
                        <option value="PARTIAL">Partial</option>
                        <option value="PAID">Fully Paid</option>
                    </select>
                    <select
                        className="input-field"
                        value={filters.type}
                        onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                    >
                        <option value="">All Bill Types</option>
                        <option value="PROPERTY">Property Rate</option>
                        <option value="BOP">Business Permit (BOP)</option>
                    </select>
                    <select
                        className="input-field"
                        value={filters.electoral_area_id}
                        onChange={(e) => setFilters({ ...filters, electoral_area_id: e.target.value })}
                    >
                        <option value="">All Areas</option>
                        {electoralAreas.map(area => (
                            <option key={area.id} value={area.id}>{area.name}</option>
                        ))}
                    </select>
                </form>
            </div>

            {/* Bills Table */}
            <div className="card overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-municipal-red"></div>
                    </div>
                ) : bills.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bill Details</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {bills.map((bill) => (
                                    <tr key={bill.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-bold text-municipal-red">{bill.bill_number}</div>
                                            <div className="text-xs text-gray-500">{bill.bill_type} ({bill.billing_year})</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-semibold text-gray-900">{bill.full_name}</div>
                                            <div className="text-xs text-gray-500">{bill.property_number || bill.business_number}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-bold text-gray-900">GHS {parseFloat(bill.total_amount).toFixed(2)}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className={`text-sm font-bold ${(parseFloat(bill.total_amount) - parseFloat(bill.amount_paid)) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                GHS {(parseFloat(bill.total_amount) - parseFloat(bill.amount_paid)).toFixed(2)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <StatusBadge status={bill.payment_status} />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                                            <button
                                                onClick={() => downloadBillPDF(bill.id)}
                                                className="inline-flex items-center p-2 text-gray-600 hover:text-municipal-red hover:bg-red-50 rounded-lg transition-all"
                                                title="Download Bill"
                                            >
                                                <Printer className="w-5 h-5" />
                                            </button>
                                            <Link
                                                href={`/billing/${bill.id}/edit`}
                                                className="inline-flex items-center p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                title="Edit Bill"
                                            >
                                                <Pencil className="w-5 h-5" />
                                            </Link>
                                            <Link
                                                href={`/billing/${bill.id}`}
                                                className="inline-flex items-center p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                                                title="View & Pay"
                                            >
                                                <CreditCard className="w-5 h-5" />
                                            </Link>
                                            <button
                                                onClick={() => handleDelete(bill.id)}
                                                className="inline-flex items-center p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                title="Delete Bill"
                                            >
                                                <Trash className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="py-12 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 text-gray-400 mb-4">
                            <FileText className="w-8 h-8" />
                        </div>
                        <p className="text-gray-500 font-medium">No bills found matching your filters.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles = {
        PAID: 'bg-green-100 text-green-700 border-green-200',
        PARTIAL: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        UNPAID: 'bg-red-100 text-red-700 border-red-200',
    };

    const icons = {
        PAID: <CheckCircle2 className="w-3 h-3" />,
        PARTIAL: <Clock className="w-3 h-3" />,
        UNPAID: <AlertCircle className="w-3 h-3" />,
    };

    return (
        <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${styles[status as keyof typeof styles]}`}>
            {icons[status as keyof typeof icons]}
            <span>{status}</span>
        </span>
    );
}
