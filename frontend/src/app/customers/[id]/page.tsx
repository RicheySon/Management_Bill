'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchCustomer, downloadBillPDF, deleteCustomer } from '@/lib/api-client';
import { displayAccountNumber } from '@/lib/account-number';
import { useAuth } from '@/context/AuthContext';
import {
    User, Mail, Phone, MapPin, Navigation,
    Building2, Briefcase, FileText, Plus,
    Printer, CreditCard, ArrowLeft, Clock, Trash2
} from 'lucide-react';
import Link from 'next/link';

export default function CustomerDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { hasPermission } = useAuth();
    const canDelete = hasPermission('delete_customer');
    const [customer, setCustomer] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [regMenuOpen, setRegMenuOpen] = useState(false);

    useEffect(() => {
        const loadCustomer = async () => {
            try {
                const data = await fetchCustomer(id as string);
                // The backend returns { customer, properties, businesses, outstanding_bills }
                setCustomer({
                    ...data.customer,
                    properties: data.properties,
                    businesses: data.businesses,
                    bills: data.outstanding_bills
                });
            } catch (err: any) {
                setError(err.response?.data?.error || 'Failed to load customer details');
            } finally {
                setLoading(false);
            }
        };
        loadCustomer();
    }, [id]);

    const handleDelete = async () => {
        if (!canDelete || !customer) return;
        const ok = window.confirm(
            `Permanently delete ${customer.full_name}?\n\nThis removes the customer and ALL related properties, businesses, bills, and payments. This cannot be undone.`
        );
        if (!ok) return;
        try {
            setDeleting(true);
            setError(null);
            await deleteCustomer(id as string);
            router.push('/customers');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to delete customer');
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-municipal-red"></div>
            </div>
        );
    }

    if (error || !customer) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-lg text-center">
                <p className="text-lg font-bold">Error Loading Customer</p>
                <p className="mb-4">{error || 'Customer not found'}</p>
                <button onClick={() => router.back()} className="btn-primary inline-flex items-center space-x-2">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Go Back</span>
                </button>
            </div>
        );
    }

    const residentialProperties = (customer.properties || []).filter(
        (p: any) => p.property_kind !== 'BUSINESS_PROPERTY'
    );
    const businessProperties = (customer.properties || []).filter(
        (p: any) => p.property_kind === 'BUSINESS_PROPERTY'
    );

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-municipal-red text-white rounded-full flex items-center justify-center">
                        <User className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{customer.full_name}</h1>
                        <p className="text-gray-600">Registered since {new Date(customer.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Link href={`/customers/${id}/edit`} className="btn-secondary">
                        Edit Profile
                    </Link>
                    {canDelete && (
                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={deleting}
                            className="btn-secondary flex items-center space-x-2 text-red-700 border-red-200 hover:bg-red-50 disabled:opacity-50"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span>{deleting ? 'Deleting…' : 'Delete customer'}</span>
                        </button>
                    )}
                    <div className="relative">
                        <button
                            type="button"
                            className="btn-primary flex items-center space-x-2"
                            onClick={() => setRegMenuOpen((open) => !open)}
                            aria-expanded={regMenuOpen}
                            aria-haspopup="menu"
                        >
                            <Plus className="w-4 h-4" />
                            <span>New Registration</span>
                        </button>
                        {regMenuOpen && (
                            <div
                                className="absolute right-0 mt-2 w-56 bg-white border rounded-lg shadow-xl z-20"
                                role="menu"
                            >
                                <Link
                                    href={`/properties/new?customer_id=${id}`}
                                    className="block px-4 py-2.5 hover:bg-gray-50 text-gray-700"
                                    onClick={() => setRegMenuOpen(false)}
                                >
                                    Residential Property
                                </Link>
                                <Link
                                    href={`/business-properties/new?customer_id=${id}`}
                                    className="block px-4 py-2.5 hover:bg-gray-50 text-gray-700"
                                    onClick={() => setRegMenuOpen(false)}
                                >
                                    Business Property
                                </Link>
                                <Link
                                    href={`/businesses/new?customer_id=${id}`}
                                    className="block px-4 py-2.5 hover:bg-gray-50 text-gray-700"
                                    onClick={() => setRegMenuOpen(false)}
                                >
                                    Business Permit (BOP)
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Contact Info Card */}
                <div className="card space-y-6">
                    <h2 className="text-xl font-bold border-b pb-2 flex items-center space-x-2">
                        <User className="w-5 h-5 text-municipal-red" />
                        <span>Contact Information</span>
                    </h2>
                    <div className="space-y-4">
                        <div className="flex items-start space-x-3">
                            <Phone className="w-5 h-5 text-gray-400 mt-1" />
                            <div>
                                <p className="text-sm text-gray-500">Phone Number</p>
                                <p className="font-semibold text-gray-900">{customer.phone_number}</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <Mail className="w-5 h-5 text-gray-400 mt-1" />
                            <div>
                                <p className="text-sm text-gray-500">Email Address</p>
                                <p className="font-semibold text-gray-900">{customer.email || 'Not provided'}</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <Navigation className="w-5 h-5 text-gray-400 mt-1" />
                            <div>
                                <p className="text-sm text-gray-500">GPS Address</p>
                                <p className="font-semibold text-gray-900">{customer.gps_address || 'Not provided'}</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <MapPin className="w-5 h-5 text-gray-400 mt-1" />
                            <div>
                                <p className="text-sm text-gray-500">Physical Location</p>
                                <p className="font-semibold text-gray-900">{customer.physical_location || 'Not provided'}</p>
                                <p className="text-sm text-gray-600 italic">Landmark: {customer.landmark || 'None'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Assets & Billing Summary */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Residential Properties Section */}
                    <div className="card">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold flex items-center space-x-2">
                                <Building2 className="w-5 h-5 text-municipal-red" />
                                <span>Residential Properties</span>
                            </h2>
                            <span className="bg-red-50 text-red-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
                                {residentialProperties.length} Total
                            </span>
                        </div>
                        {residentialProperties.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prop. Number</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Number</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Classification</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {residentialProperties.map((prop: any) => (
                                            <tr key={prop.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-municipal-red">
                                                    <Link href={`/properties/${prop.id}`}>{prop.property_number}</Link>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-gray-600">{displayAccountNumber(prop.account_number, prop.property_number)}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{prop.classification_name}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 truncate max-w-[150px]">{prop.physical_location}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-bold text-red-600">GHS {parseFloat(prop.total_outstanding || 0).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-gray-500 text-center py-4 italic">No residential properties registered.</p>
                        )}
                    </div>

                    {/* Business Properties Section */}
                    <div className="card">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold flex items-center space-x-2">
                                <Building2 className="w-5 h-5 text-amber-700" />
                                <span>Business Properties</span>
                            </h2>
                            <span className="bg-amber-50 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                                {businessProperties.length} Total
                            </span>
                        </div>
                        {businessProperties.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Number</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Number</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Classification</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {businessProperties.map((prop: any) => (
                                            <tr key={prop.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-municipal-red">
                                                    <Link href={`/business-properties/${prop.id}`}>{prop.property_number}</Link>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-gray-600">{displayAccountNumber(prop.account_number, prop.property_number)}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{prop.classification_name}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 truncate max-w-[150px]">{prop.physical_location}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-bold text-red-600">GHS {parseFloat(prop.total_outstanding || 0).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-gray-500 text-center py-4 italic">No business properties registered.</p>
                        )}
                    </div>

                    {/* Businesses Section */}
                    <div className="card">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold flex items-center space-x-2">
                                <Briefcase className="w-5 h-5 text-municipal-red" />
                                <span>Businesses (BOP)</span>
                            </h2>
                            <span className="bg-orange-50 text-orange-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
                                {customer.businesses?.length || 0} Total
                            </span>
                        </div>
                        {customer.businesses && customer.businesses.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">BOP Number</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Number</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Business Name</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {customer.businesses.map((biz: any) => (
                                            <tr key={biz.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-municipal-red">
                                                    <Link href={`/businesses/${biz.id}`}>{biz.business_number}</Link>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-gray-600">{displayAccountNumber(biz.account_number, biz.business_number)}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">{biz.business_name}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{biz.business_category_class || biz.category_name || '—'}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-bold text-red-600">GHS {parseFloat(biz.total_outstanding || 0).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-gray-500 text-center py-4 italic">No businesses registered.</p>
                        )}
                    </div>

                    {/* Recent Bills Section */}
                    <div className="card">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold flex items-center space-x-2">
                                <FileText className="w-5 h-5 text-municipal-red" />
                                <span>Recent Billing History</span>
                            </h2>
                            <Link href="/billing" className="text-municipal-red text-sm hover:underline">View All Bills</Link>
                        </div>
                        {customer.bills && customer.bills.length > 0 ? (
                            <div className="space-y-3">
                                {customer.bills.slice(0, 5).map((bill: any) => {
                                    const status = bill.payment_status || bill.status;
                                    const year = bill.bill_period_year || bill.billing_year;
                                    const paid = parseFloat(bill.amount_paid || 0);
                                    const total = parseFloat(bill.total_amount || 0);
                                    return (
                                    <div key={bill.id} className="flex items-center justify-between p-4 border rounded-lg hover:border-municipal-red transition-colors">
                                        <div className="flex items-center space-x-4">
                                            <div className={`p-2 rounded-full ${status === 'PAID' ? 'bg-green-100 text-green-600' : status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'}`}>
                                                <FileText className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">{bill.bill_number}</p>
                                                <p className="text-xs text-gray-500">{bill.bill_type} ({year}) • Issued {new Date(bill.issue_date).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-6">
                                            <div className="text-right">
                                                <p className="font-bold text-gray-900">GHS {total.toFixed(2)}</p>
                                                <p className={`text-xs font-bold ${status === 'PAID' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {status === 'PAID' ? 'FULLY PAID' : `DUE: GHS ${(total - paid).toFixed(2)}`}
                                                </p>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => downloadBillPDF(bill.id)}
                                                    className="p-2 text-gray-500 hover:text-municipal-red transition-colors"
                                                    title="Download PDF"
                                                >
                                                    <Printer className="w-5 h-5" />
                                                </button>
                                                {status !== 'PAID' && (
                                                    <Link
                                                        href={`/billing/${bill.id}`}
                                                        className="p-2 text-gray-500 hover:text-green-600 transition-colors"
                                                        title="Record Payment"
                                                    >
                                                        <CreditCard className="w-5 h-5" />
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-gray-500 text-center py-4 italic">No billing history found.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
