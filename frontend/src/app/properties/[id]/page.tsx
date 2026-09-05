'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchProperty, deleteProperty } from '@/lib/api-client';
import {
    Building2, User, MapPin, Tag, Calendar,
    ArrowLeft, History, FileText, Plus, AlertCircle, Trash2, Edit
} from 'lucide-react';
import Link from 'next/link';

export default function PropertyDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const [property, setProperty] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadProperty = async () => {
            try {
                const data = await fetchProperty(id as string);
                // Correctly destructure property and bills from the response
                setProperty({
                    ...data.property,
                    bills: data.bills
                });
            } catch (err: any) {
                setError(err.response?.data?.error || 'Failed to load property details');
            } finally {
                setLoading(false);
            }
        };
        loadProperty();
    }, [id]);

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this property? This will also affect associated bills and records.')) return;
        try {
            await deleteProperty(id as string);
            router.push('/properties');
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to delete property');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-municipal-red"></div>
            </div>
        );
    }

    if (error || !property) {
        return (
            <div className="bg-red-50 border-2 border-red-200 text-red-800 p-8 rounded-xl text-center max-w-2xl mx-auto mt-10">
                <AlertCircle className="w-12 h-12 mx-auto mb-4" />
                <h2 className="text-xl font-bold">Error</h2>
                <p className="mb-6">{error || 'Property not found'}</p>
                <button onClick={() => router.back()} className="btn-primary inline-flex items-center space-x-2">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Go Back</span>
                </button>
            </div>
        );
    }

    const bills = property.bills || [];
    const outstandingFromBills = bills
        .filter((b: any) => ['UNPAID', 'PARTIAL', 'OVERDUE'].includes(b.payment_status))
        .reduce((sum: number, b: any) => sum + (parseFloat(b.amount_due) || 0), 0);
    const paidFromBills = bills.reduce(
        (sum: number, b: any) => sum + (parseFloat(b.amount_paid) || 0),
        0
    );
    const totalOutstanding =
        property.total_outstanding !== undefined && property.total_outstanding !== null
            ? parseFloat(property.total_outstanding)
            : outstandingFromBills;
    const totalPaid =
        property.total_paid !== undefined && property.total_paid !== null
            ? parseFloat(property.total_paid)
            : paidFromBills;
    const assessedAmount = parseFloat(property.assessed_amount);

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 bg-red-100 text-municipal-red rounded-xl flex items-center justify-center">
                        <Building2 className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900">{property.property_number}</h1>
                        <p className="text-gray-500 font-medium">Registered on {new Date(property.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    <Link href={`/properties/${id}/edit`} className="btn-secondary flex items-center space-x-2">
                        <Edit className="w-4 h-4" />
                        <span>Edit</span>
                    </Link>
                    <button onClick={handleDelete} className="btn-secondary text-red-600 border-red-100 hover:bg-red-50 flex items-center space-x-2">
                        <Trash2 className="w-4 h-4" />
                        <span>Delete</span>
                    </button>
                    <Link href={`/billing/generate?property_id=${id}`} className="btn-primary flex items-center space-x-2">
                        <Plus className="w-4 h-4" />
                        <span>Generate Bill</span>
                    </Link>
                    <button onClick={() => router.back()} className="btn-secondary flex items-center space-x-2">
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Information Column */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Owner Card */}
                    <div className="card">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Ownership</h3>
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-red-50 text-municipal-red rounded-full flex items-center justify-center">
                                <User className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="font-bold text-gray-900">{property.owner_name}</p>
                                <Link href={`/customers/${property.customer_id}`} className="text-xs text-municipal-red hover:underline">
                                    View Owner Profile
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Property Specs Card */}
                    <div className="card">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Property Specs</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                                <span className="text-gray-500">Account Number</span>
                                <span className="font-semibold font-mono text-gray-900">{property.account_number || '—'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                                <span className="text-gray-500 flex items-center"><Tag className="w-3.5 h-3.5 mr-1.5" /> Type</span>
                                <span className="font-semibold text-gray-900">{property.classification_name}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                                <span className="text-gray-500 flex items-center"><Calendar className="w-3.5 h-3.5 mr-1.5" /> Reg. Year</span>
                                <span className="font-semibold text-gray-900">{property.year_registered}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                                <span className="text-gray-500 flex items-center"><AlertCircle className="w-3.5 h-3.5 mr-1.5" /> Status</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${property.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                    {property.status}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                                <span className="text-gray-500">Annual Bill Amount</span>
                                <span className="font-semibold text-gray-900">
                                    {!isNaN(assessedAmount) && assessedAmount > 0
                                        ? `GHS ${assessedAmount.toFixed(2)}`
                                        : '—'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">Property Size</span>
                                <span className="font-semibold text-gray-900">{property.property_size || 'N/A'} sqm</span>
                            </div>
                        </div>
                    </div>

                    {/* Location Card */}
                    <div className="card">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Location Details</h3>
                        <div className="space-y-4 text-sm">
                            <div className="flex items-start space-x-3">
                                <MapPin className="w-5 h-5 text-gray-300 mt-1" />
                                <div>
                                    <p className="font-bold text-gray-900">{property.physical_location || 'Not Set'}</p>
                                    <p className="text-gray-500">Landmark: {property.landmark || 'None'}</p>
                                    <p className="text-gray-500 mt-1">Electoral Area: {property.electoral_area_name || '—'}</p>
                                    <p className="text-gray-500">Community: {property.local_area_name || '—'}</p>
                                </div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
                                <span className="text-xs text-gray-500 font-bold">GPS ADDRESS</span>
                                <span className="font-mono text-xs font-bold text-municipal-red">{property.gps_address || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Billing Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="card bg-municipal-red text-white">
                            <p className="text-xs text-red-100 font-bold uppercase tracking-wider mb-1">Current Balance</p>
                            <h4 className="text-3xl font-extrabold">GHS {totalOutstanding.toFixed(2)}</h4>
                        </div>
                        <div className="card border-2 border-red-50">
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Total Paid (All Time)</p>
                            <h4 className="text-2xl font-extrabold text-green-600">GHS {totalPaid.toFixed(2)}</h4>
                        </div>
                    </div>

                    {/* Billing History */}
                    <div className="card">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold flex items-center space-x-2 text-gray-800">
                                <History className="w-5 h-5 text-municipal-red" />
                                <span>Recent Property Bills</span>
                            </h2>
                        </div>

                        {bills.length > 0 ? (
                            <div className="space-y-4">
                                {bills.map((bill: any) => (
                                    <div key={bill.id} className="flex items-center justify-between p-5 border rounded-xl hover:border-municipal-red transition-all group">
                                        <div className="flex items-center space-x-4">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${bill.payment_status === 'PAID' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                                                }`}>
                                                <FileText className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 group-hover:text-municipal-red transition-colors">{bill.bill_number}</p>
                                                <p className="text-xs text-gray-500 font-medium">Period: {bill.bill_period_year} • Issued {new Date(bill.issue_date).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-extrabold text-gray-900 text-lg">GHS {parseFloat(bill.total_amount).toFixed(2)}</p>
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${bill.payment_status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'
                                                }`}>
                                                {bill.payment_status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed">
                                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                <p className="text-gray-500 font-medium mb-1">No bills found for this property.</p>
                                {!isNaN(assessedAmount) && assessedAmount > 0 && (
                                    <p className="text-sm text-gray-500 mb-4">
                                        Annual amount on file:{' '}
                                        <span className="font-semibold text-gray-800">GHS {assessedAmount.toFixed(2)}</span>
                                    </p>
                                )}
                                <Link
                                    href={`/billing/generate?property_id=${id}`}
                                    className="btn-primary inline-flex items-center space-x-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Generate Bill</span>
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
