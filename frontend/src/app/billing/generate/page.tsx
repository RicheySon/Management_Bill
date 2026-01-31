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

    const onSubmit = async (data: GenerateBillForm) => {
        setError(null);
        try {
            const result = await generateBill(data);
            setSuccess(true);
            setTimeout(() => {
                router.push(`/billing/${result.data.id}`);
            }, 1500);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to generate bill');
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
                        type="submit"
                        disabled={isSubmitting || (watchBillType === 'PROPERTY' && !selectedCustomerData?.properties?.length) || (watchBillType === 'BOP' && !selectedCustomerData?.businesses?.length)}
                        className="btn-primary flex items-center space-x-2"
                    >
                        {isSubmitting ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                            <FileText className="w-4 h-4" />
                        )}
                        <span>Generate Bill</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
