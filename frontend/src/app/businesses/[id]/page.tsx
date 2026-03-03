'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchBusiness, deleteBusiness } from '@/lib/api-client';
import {
    ShoppingBag, User, MapPin, Tag, Calendar,
    ArrowLeft, History, FileText, Plus, AlertCircle,
    Info, Building2, Trash2, Edit
} from 'lucide-react';
import Link from 'next/link';

export default function BusinessDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const [business, setBusiness] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadBusiness = async () => {
            try {
                const data = await fetchBusiness(id as string);
                // Correctly destructure business and bills from the response
                setBusiness({
                    ...data.business,
                    bills: data.bills
                });
            } catch (err: any) {
                setError(err.response?.data?.error || 'Failed to load business details');
            } finally {
                setLoading(false);
            }
        };
        loadBusiness();
    }, [id]);

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this business? This will also affect associated bills.')) return;
        try {
            await deleteBusiness(id as string);
            router.push('/businesses');
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to delete business');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-municipal-red"></div>
            </div>
        );
    }

    if (error || !business) {
        return (
            <div className="bg-red-50 border-2 border-red-200 text-red-800 p-8 rounded-xl text-center max-w-2xl mx-auto mt-10">
                <AlertCircle className="w-12 h-12 mx-auto mb-4" />
                <h2 className="text-xl font-bold">Error</h2>
                <p className="mb-6">{error || 'Business not found'}</p>
                <button onClick={() => router.back()} className="btn-primary inline-flex items-center space-x-2">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Go Back</span>
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 bg-red-100 text-municipal-red rounded-xl flex items-center justify-center">
                        <ShoppingBag className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900">{business.business_name}</h1>
                        <p className="text-gray-500 font-medium tracking-tight">BOP Number: <span className="text-municipal-red font-bold">{business.business_number}</span></p>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    <Link href={`/businesses/${id}/edit`} className="btn-secondary flex items-center space-x-2">
                        <Edit className="w-4 h-4" />
                        <span>Edit</span>
                    </Link>
                    <button onClick={handleDelete} className="btn-secondary text-red-600 border-red-100 hover:bg-red-50 flex items-center space-x-2">
                        <Trash2 className="w-4 h-4" />
                        <span>Delete</span>
                    </button>
                    <Link href={`/billing/generate?business_id=${id}`} className="btn-primary flex items-center space-x-2">
                        <Plus className="w-4 h-4" />
                        <span>Issue BOP Bill</span>
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
                                <p className="font-bold text-gray-900">{business.owner_name}</p>
                                <Link href={`/customers/${business.customer_id}`} className="text-xs text-municipal-red hover:underline">
                                    View Owner Profile
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Business Info Card */}
                    <div className="card">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Business Details</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                                <span className="text-gray-500 flex items-center"><Tag className="w-3.5 h-3.5 mr-1.5" /> Category</span>
                                <span className="font-semibold text-gray-900 text-right">{business.category_name}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                                <span className="text-gray-500 flex items-center"><Calendar className="w-3.5 h-3.5 mr-1.5" /> Reg. Year</span>
                                <span className="font-semibold text-gray-900">{business.year_registered}</span>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 font-bold uppercase mb-2">Activities</p>
                                <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700 leading-relaxed border border-gray-100">
                                    {business.business_activity || 'No activities described.'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Linked Property Card */}
                    {business.property_id && (
                        <div className="card border-red-100 bg-red-50/30">
                            <h3 className="text-sm font-bold text-red-800 uppercase tracking-wider mb-4 flex items-center">
                                <Building2 className="w-4 h-4 mr-2" /> Linked Property
                            </h3>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold font-mono text-municipal-red">{business.property_number}</span>
                                <Link href={`/properties/${business.property_id}`} className="text-xs font-bold text-red-600 hover:underline">
                                    DETAILS →
                                </Link>
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Content Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Financial Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="card border-l-4 border-l-municipal-red">
                            <p className="text-xs text-gray-400 font-bold uppercase mb-1">Total Outstanding</p>
                            <h4 className="text-3xl font-black text-gray-900">GHS {parseFloat(business.total_outstanding || 0).toFixed(2)}</h4>
                        </div>
                        <div className="card border-l-4 border-l-green-500">
                            <p className="text-xs text-gray-400 font-bold uppercase mb-1">Total Paid (All Time)</p>
                            <h4 className="text-3xl font-black text-gray-900">GHS {parseFloat(business.total_paid || 0).toFixed(2)}</h4>
                        </div>
                    </div>

                    {/* Billing History */}
                    <div className="card">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold flex items-center space-x-2 text-gray-800">
                                <History className="w-5 h-5 text-municipal-red" />
                                <span>Recent Business Permits & Bills</span>
                            </h2>
                        </div>

                        {business.bills && business.bills.length > 0 ? (
                            <div className="space-y-4">
                                {business.bills.map((bill: any) => (
                                    <div key={bill.id} className="flex items-center justify-between p-5 border rounded-xl hover:shadow-sm transition-all bg-white">
                                        <div className="flex items-center space-x-4">
                                            <div className="w-10 h-10 rounded-lg bg-red-50 text-municipal-red flex items-center justify-center">
                                                <FileText className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">{bill.bill_number}</p>
                                                <p className="text-xs text-gray-500">Permit Year: {bill.bill_period_year} • {new Date(bill.issue_date).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-6">
                                            <div className="text-right">
                                                <p className="font-bold text-gray-900">GHS {parseFloat(bill.total_amount).toFixed(2)}</p>
                                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${bill.payment_status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                                                    }`}>
                                                    {bill.payment_status}
                                                </span>
                                            </div>
                                            <Link href={`/billing/${bill.id}`} className="text-municipal-red hover:text-red-800">
                                                <Info className="w-5 h-5" />
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                <ShoppingBag className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                <p className="text-gray-500 font-medium">No permit history found for this business.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
