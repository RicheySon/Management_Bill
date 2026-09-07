'use client';

import { useState, useEffect } from 'react';
import { fetchCustomers, purgeAllCustomers } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';
import { Plus, Search, User, Phone, MapPin, Trash2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function CustomersPage() {
    const { hasPermission } = useAuth();
    const canDelete = hasPermission('delete_customer');
    const [customers, setCustomers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [purging, setPurging] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const loadCustomers = async () => {
        try {
            setLoading(true);
            const result = await fetchCustomers();
            setCustomers(result.data || []);
        } catch (error) {
            console.error('Failed to fetch customers:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCustomers();
    }, []);

    const handleClearAll = async () => {
        if (!canDelete) return;
        const phrase = window.prompt(
            'This permanently deletes ALL customers, properties, businesses, and bills.\n\nType DELETE_ALL_CUSTOMERS to confirm:'
        );
        if (phrase !== 'DELETE_ALL_CUSTOMERS') {
            if (phrase !== null) {
                setMessage({ type: 'error', text: 'Clear cancelled — confirmation phrase did not match.' });
            }
            return;
        }
        if (!window.confirm('Final confirmation: wipe every customer and all related records? This cannot be undone.')) {
            return;
        }

        try {
            setPurging(true);
            setMessage(null);
            const res = await purgeAllCustomers();
            const s = res.data || {};
            setMessage({
                type: 'success',
                text:
                    res.message ||
                    `Cleared ${s.customers || 0} customers, ${s.properties || 0} properties, ${s.businesses || 0} businesses, ${s.bills || 0} bills.`,
            });
            await loadCustomers();
        } catch (err: any) {
            setMessage({
                type: 'error',
                text: err.response?.data?.error || 'Failed to clear customers',
            });
        } finally {
            setPurging(false);
        }
    };

    const filteredCustomers = customers.filter(
        (customer) =>
            customer.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            customer.phone_number.includes(searchTerm)
    );

    return (
        <div>
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
                    <p className="text-gray-600 mt-1">Manage all registered municipal citizens</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 self-start">
                    {canDelete && (
                        <button
                            type="button"
                            onClick={handleClearAll}
                            disabled={purging || customers.length === 0}
                            className="btn-secondary flex items-center space-x-2 text-red-700 border-red-200 hover:bg-red-50 disabled:opacity-50"
                            title="Permanently delete all customers and related records"
                        >
                            <Trash2 className="w-5 h-5" />
                            <span>{purging ? 'Clearing…' : 'Clear all customers'}</span>
                        </button>
                    )}
                    <Link href="/customers/new" className="btn-primary flex items-center space-x-2">
                        <Plus className="w-5 h-5" />
                        <span>Register New Customer</span>
                    </Link>
                </div>
            </div>

            {message && (
                <div
                    className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
                        message.type === 'success'
                            ? 'border-green-200 bg-green-50 text-green-800'
                            : 'border-red-200 bg-red-50 text-red-800'
                    }`}
                >
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{message.text}</span>
                </div>
            )}

            <div className="card mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search by name or phone number..."
                        className="input-field pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-municipal-red mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading customers...</p>
                </div>
            ) : filteredCustomers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCustomers.map((customer) => (
                        <Link
                            key={customer.id}
                            href={`/customers/${customer.id}`}
                            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow group"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-municipal-red group-hover:bg-municipal-red group-hover:text-white transition-colors">
                                    <User className="w-6 h-6" />
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">{customer.full_name}</h3>
                            <div className="space-y-2">
                                <div className="flex items-center text-sm text-gray-600">
                                    <Phone className="w-4 h-4 mr-2" />
                                    {customer.phone_number}
                                </div>
                                {customer.gps_address && (
                                    <div className="flex items-center text-sm text-gray-600 line-clamp-1">
                                        <MapPin className="w-4 h-4 mr-2" />
                                        {customer.gps_address}
                                    </div>
                                )}
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center">
                                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    View Details →
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="card text-center py-20">
                    <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <User className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No customers found</h3>
                    <p className="text-gray-600 mt-1">Try a different search or register a new customer.</p>
                </div>
            )}
        </div>
    );
}
