'use client';

import { useState, useEffect } from 'react';
import { fetchCustomers } from '@/lib/api-client';
import { Plus, Search, User, Phone, MapPin } from 'lucide-react';
import Link from 'next/link';

export default function CustomersPage() {
    const [customers, setCustomers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const loadCustomers = async () => {
            try {
                const result = await fetchCustomers();
                setCustomers(result.data || []);
            } catch (error) {
                console.error('Failed to fetch customers:', error);
            } finally {
                setLoading(false);
            }
        };
        loadCustomers();
    }, []);

    const filteredCustomers = customers.filter(customer =>
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
                <Link href="/customers/new" className="btn-primary flex items-center space-x-2 self-start">
                    <Plus className="w-5 h-5" />
                    <span>Register New Customer</span>
                </Link>
            </div>

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
