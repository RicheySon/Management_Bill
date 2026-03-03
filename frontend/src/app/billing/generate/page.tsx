'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import {
    fetchCustomers,
    generateBill,
    fetchCustomer
} from '@/lib/api-client';
import { ArrowLeft, Send, Search, Building2, Briefcase, FileText } from 'lucide-react';
import Link from 'next/link';

interface GenerateBillForm {
    bill_type: 'PROPERTY' | 'BOP';
    customer_id: string;
    property_id?: string;
    business_id?: string;
    billing_year: number;
}

export default function GenerateBillPage() {
    const router = useRouter();
    const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<GenerateBillForm>({
        defaultValues: {
            bill_type: 'PROPERTY',
            billing_year: new Date().getFullYear(),
        }
    });

    const [customers, setCustomers] = useState<any[]>([]);
    const [selectedCustomerData, setSelectedCustomerData] = useState<any>(null);
    const [loadingCustomer, setLoadingCustomer] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [showPreview, setShowPreview] = useState(false);
    const [previewData, setPreviewData] = useState<any>(null);

    const watchBillType = watch('bill_type');
    const watchCustomerId = watch('customer_id');

    useEffect(() => {
        const loadCustomers = async () => {
            try {
                const data = await fetchCustomers({ limit: 1000 });
                setCustomers(data.data);
            } catch (err) {
                console.error('Failed to load customers');
            }
        };
        loadCustomers();
    }, []);

    useEffect(() => {
        if (watchCustomerId) {
            const loadCustomerDetails = async () => {
                setLoadingCustomer(true);
                try {
                    const data = await fetchCustomer(watchCustomerId);
                    setSelectedCustomerData(data);
                    // Reset selection
                    setValue('property_id', '');
                    setValue('business_id', '');
                } catch (err) {
                    console.error('Failed to load customer details');
                } finally {
                    setLoadingCustomer(false);
                }
            };
            loadCustomerDetails();
        } else {
            setSelectedCustomerData(null);
        }
    }, [watchCustomerId, setValue]);

    const handlePreview = (data: GenerateBillForm) => {
        const targetId = data.bill_type === 'PROPERTY' ? data.property_id : data.business_id;
        const target = data.bill_type === 'PROPERTY'
            ? selectedCustomerData.properties.find((p: any) => p.id === targetId)
            : selectedCustomerData.businesses.find((b: any) => b.id === targetId);

        setPreviewData({
            ...data,
            customer_name: selectedCustomerData.customer.full_name,
            target_name: data.bill_type === 'PROPERTY' ? target.property_number : target.business_name,
            target_details: data.bill_type === 'PROPERTY' ? target.classification_name : target.category_name
        });
        setShowPreview(true);
    };

    const onSubmit = async (data: GenerateBillForm) => {
        setError(null);
        try {
            const apiData = {
                bill_type: data.bill_type === 'PROPERTY' ? 'PROPERTY_RATE' : 'BOP',
                target_id: data.bill_type === 'PROPERTY' ? data.property_id : data.business_id,
                customer_id: data.customer_id,
                bill_year: parseInt(data.billing_year as any)
            };

            const result = await generateBill(apiData);
            setSuccess(true);
            setTimeout(() => {
                router.push(`/billing/${result.data.id}`);
            }, 1500);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to generate bill');
            setShowPreview(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Generate New Bill</h1>
                    <p className="text-gray-600 mt-1">Issue a new property rate or BOP invoice</p>
                </div>
                <Link href="/billing" className="btn-secondary flex items-center space-x-2">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                </Link>
            </div>

            {success && (
                <div className="bg-green-50 border-2 border-green-500 text-green-800 px-6 py-4 rounded-lg mb-6">
                    <p className="font-semibold">✓ Bill generated successfully!</p>
                    <p className="text-sm">Redirecting to payment page...</p>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border-2 border-red-500 text-red-800 px-6 py-4 rounded-lg mb-6">
                    <p className="font-semibold">✗ Error</p>
                    <p className="text-sm">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="card space-y-6">
                <div className="space-y-4">
                    {/* Bill Type Selection */}
                    <div>
                        <label className="label">What type of bill are you generating?</label>
                        <div className="grid grid-cols-2 gap-4">
                            <label className={`flex items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all ${watchBillType === 'PROPERTY' ? 'border-municipal-red bg-red-50' : 'border-gray-200'}`}>
                                <input type="radio" value="PROPERTY" {...register('bill_type')} className="hidden" />
                                <div className="text-center">
                                    <Building2 className={`w-8 h-8 mx-auto mb-2 ${watchBillType === 'PROPERTY' ? 'text-municipal-red' : 'text-gray-400'}`} />
                                    <span className={`font-bold ${watchBillType === 'PROPERTY' ? 'text-municipal-red' : 'text-gray-500'}`}>Property Rate</span>
                                </div>
                            </label>
                            <label className={`flex items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all ${watchBillType === 'BOP' ? 'border-municipal-red bg-red-50' : 'border-gray-200'}`}>
                                <input type="radio" value="BOP" {...register('bill_type')} className="hidden" />
                                <div className="text-center">
                                    <Briefcase className={`w-8 h-8 mx-auto mb-2 ${watchBillType === 'BOP' ? 'text-municipal-red' : 'text-gray-400'}`} />
                                    <span className={`font-bold ${watchBillType === 'BOP' ? 'text-municipal-red' : 'text-gray-500'}`}>BOP Permit</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    <hr className="my-4" />

                    {/* Customer Selection */}
                    <div>
                        <label className="label">Select Customer</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <select
                                {...register('customer_id', { required: 'Please select a customer' })}
                                className="input-field pl-10"
                            >
                                <option value="">-- Choose Customer --</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.full_name} ({c.phone_number})</option>
                                ))}
                            </select>
                        </div>
                        {errors.customer_id && <p className="text-red-500 text-sm mt-1">{errors.customer_id.message}</p>}
                    </div>

                    {/* Conditional Asset Selection */}
                    {selectedCustomerData && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                            {watchBillType === 'PROPERTY' ? (
                                <div>
                                    <label className="label">Select Property</label>
                                    {selectedCustomerData.properties?.length > 0 ? (
                                        <div className="grid gap-3">
                                            {selectedCustomerData.properties.map((p: any) => (
                                                <label key={p.id} className={`flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${watch('property_id') === p.id ? 'border-municipal-red bg-red-50 ring-1 ring-municipal-red' : ''}`}>
                                                    <input type="radio" value={p.id} {...register('property_id', { required: watchBillType === 'PROPERTY' ? 'Please select a property' : false })} className="mr-3" />
                                                    <div>
                                                        <p className="font-bold text-sm">{p.property_number}</p>
                                                        <p className="text-xs text-gray-500">{p.classification_name} • {p.physical_location}</p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm border border-yellow-100 italic">
                                            This customer has no registered properties.
                                        </div>
                                    )}
                                    {errors.property_id && <p className="text-red-500 text-sm mt-1">{errors.property_id.message}</p>}
                                </div>
                            ) : (
                                <div>
                                    <label className="label">Select Business</label>
                                    {selectedCustomerData.businesses?.length > 0 ? (
                                        <div className="grid gap-3">
                                            {selectedCustomerData.businesses.map((b: any) => (
                                                <label key={b.id} className={`flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${watch('business_id') === b.id ? 'border-municipal-red bg-red-50 ring-1 ring-municipal-red' : ''}`}>
                                                    <input type="radio" value={b.id} {...register('business_id', { required: watchBillType === 'BOP' ? 'Please select a business' : false })} className="mr-3" />
                                                    <div>
                                                        <p className="font-bold text-sm">{b.business_name}</p>
                                                        <p className="text-xs text-gray-500">{b.business_number} • {b.category_name}</p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm border border-yellow-100 italic">
                                            This customer has no registered businesses.
                                        </div>
                                    )}
                                    {errors.business_id && <p className="text-red-500 text-sm mt-1">{errors.business_id.message}</p>}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Billing Year */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                        <div>
                            <label className="label">Billing Year</label>
                            <select {...register('billing_year', { required: true })} className="input-field">
                                {[2023, 2024, 2025, 2026, 2027].map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end">
                            <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border italic">
                                The system will automatically calculate rates and aggregate any existing arrears for this selection.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end space-x-4 pt-6">
                    <Link href="/billing" className="btn-secondary">Cancel</Link>
                    <button
                        type="button"
                        onClick={handleSubmit(handlePreview)}
                        disabled={isSubmitting || (watchBillType === 'PROPERTY' && !watch('property_id')) || (watchBillType === 'BOP' && !watch('business_id'))}
                        className="btn-secondary flex items-center space-x-2"
                    >
                        <Search className="w-4 h-4" />
                        <span>Preview Bill</span>
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting || (watchBillType === 'PROPERTY' && !watch('property_id')) || (watchBillType === 'BOP' && !watch('business_id'))}
                        className="btn-primary flex items-center space-x-2"
                    >
                        {isSubmitting ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                            <FileText className="w-4 h-4" />
                        )}
                        <span>Generate Bill Now</span>
                    </button>
                </div>
            </form>

            {/* Preview Modal */}
            {showPreview && previewData && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="bg-municipal-red p-6 text-white">
                            <h3 className="text-xl font-bold flex items-center">
                                <FileText className="w-6 h-6 mr-2" />
                                Bill Preview
                            </h3>
                            <p className="text-red-100 text-sm mt-1">Review bill details before final generation</p>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-y-4 text-sm">
                                <div className="text-gray-500 font-medium">Customer:</div>
                                <div className="font-bold text-gray-900">{previewData.customer_name}</div>

                                <div className="text-gray-500 font-medium">Bill Type:</div>
                                <div className="font-bold text-gray-900">{previewData.bill_type === 'PROPERTY' ? 'Property Rate' : 'BOP Permit'}</div>

                                <div className="text-gray-500 font-medium">{previewData.bill_type === 'PROPERTY' ? 'Property No:' : 'Business:'}</div>
                                <div className="font-bold text-municipal-red">{previewData.target_name}</div>

                                <div className="text-gray-500 font-medium">Category:</div>
                                <div className="font-bold text-gray-900">{previewData.target_details}</div>

                                <div className="text-gray-500 font-medium">Billing Year:</div>
                                <div className="font-bold text-gray-900">{previewData.billing_year}</div>
                            </div>

                            <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-xl">
                                <p className="text-xs text-yellow-800 leading-relaxed italic">
                                    Note: Final amount including current year rate and any outstanding arrears will be calculated upon generation.
                                </p>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-6 flex justify-end space-x-3">
                            <button
                                onClick={() => setShowPreview(false)}
                                className="px-6 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-all text-sm"
                            >
                                Back to Edit
                            </button>
                            <button
                                onClick={handleSubmit(onSubmit)}
                                disabled={isSubmitting}
                                className="px-8 py-2.5 bg-municipal-red text-white rounded-xl font-bold shadow-lg shadow-red-200 hover:bg-red-700 transition-all flex items-center space-x-2 text-sm"
                            >
                                {isSubmitting ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                                <span>Confirm & Generate</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
