'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import {
    createBusiness,
    fetchCustomers,
    fetchBusinessCategories,
    fetchElectoralAreas,
    fetchProperties
} from '@/lib/api-client';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

interface BusinessForm {
    business_name: string;
    customer_id: string;
    category_id: number;
    business_activity: string;
    property_id?: string;
    street_name?: string;
    gps_address?: string;
    physical_location?: string;
    landmark?: string;
    electoral_area_id?: number;
    year_registered?: number;
}

export default function NewBusinessPage() {
    const router = useRouter();
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<BusinessForm>();

    const [customers, setCustomers] = useState([]);
    const [categories, setCategories] = useState([]);
    const [electoralAreas, setElectoralAreas] = useState([]);
    const [properties, setProperties] = useState([]);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [businessNumber, setBusinessNumber] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [customersData, categoriesData, areasData, propertiesData] = await Promise.all([
                    fetchCustomers({ limit: 1000 }),
                    fetchBusinessCategories(),
                    fetchElectoralAreas(),
                    fetchProperties({ limit: 1000 }),
                ]);
                setCustomers(customersData.data);
                setCategories(categoriesData);
                setElectoralAreas(areasData);
                setProperties(propertiesData.data);
            } catch (err) {
                console.error('Failed to load data:', err);
            }
        };
        loadData();
    }, []);

    const onSubmit = async (data: BusinessForm) => {
        setError(null);
        try {
            const result = await createBusiness(data);
            setBusinessNumber(result.data.business_number);
            setSuccess(true);

            setTimeout(() => {
                router.push(`/businesses/${result.data.id}`);
            }, 2000);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to register business');
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Register New Business (BOP)</h1>
                    <p className="text-gray-600 mt-1">Add a new Business Operating Permit</p>
                </div>
                <Link href="/businesses" className="btn-secondary flex items-center space-x-2">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                </Link>
            </div>

            {success && businessNumber && (
                <div className="bg-green-50 border-2 border-green-500 text-green-800 px-6 py-4 rounded-lg mb-6">
                    <p className="font-semibold">✓ Business registered successfully!</p>
                    <p className="text-sm mt-1">BOP Number: <span className="font-mono font-bold">{businessNumber}</span></p>
                    <p className="text-sm">Redirecting...</p>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border-2 border-municipal-red text-red-800 px-6 py-4 rounded-lg mb-6">
                    <p className="font-semibold">✗ Error</p>
                    <p className="text-sm">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="card space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Business Name */}
                    <div className="md:col-span-2">
                        <label className="label">
                            Business Name <span className="text-municipal-red">*</span>
                        </label>
                        <input
                            type="text"
                            {...register('business_name', { required: 'Business name is required' })}
                            className="input-field"
                            placeholder="INSPIRE EVENT & GIFTS"
                        />
                        {errors.business_name && (
                            <p className="text-red-500 text-sm mt-1">{errors.business_name.message}</p>
                        )}
                    </div>

                    {/* Owner/Customer */}
                    <div>
                        <label className="label">
                            Business Owner <span className="text-municipal-red">*</span>
                        </label>
                        <select
                            {...register('customer_id', { required: 'Please select owner' })}
                            className="input-field"
                        >
                            <option value="">-- Select Owner --</option>
                            {customers.map((customer: any) => (
                                <option key={customer.id} value={customer.id}>
                                    {customer.full_name} ({customer.phone_number})
                                </option>
                            ))}
                        </select>
                        {errors.customer_id && (
                            <p className="text-red-500 text-sm mt-1">{errors.customer_id.message}</p>
                        )}
                    </div>

                    {/* Business Category */}
                    <div>
                        <label className="label">
                            Business Category <span className="text-municipal-red">*</span>
                        </label>
                        <select
                            {...register('category_id', { required: 'Please select category' })}
                            className="input-field"
                        >
                            <option value="">-- Select Category --</option>
                            {categories.map((category: any) => (
                                <option key={category.id} value={category.id}>
                                    {category.name} (Fee: GHS {category.base_fee})
                                </option>
                            ))}
                        </select>
                        {errors.category_id && (
                            <p className="text-red-500 text-sm mt-1">{errors.category_id.message}</p>
                        )}
                    </div>

                    {/* Business Activity */}
                    <div className="md:col-span-2">
                        <label className="label">
                            Business Activity (What you sell/do) <span className="text-municipal-red">*</span>
                        </label>
                        <textarea
                            {...register('business_activity', { required: 'Please describe business activity' })}
                            className="input-field"
                            rows={3}
                            placeholder="e.g., Event planning services, Sales of gift items and decorations"
                        />
                        {errors.business_activity && (
                            <p className="text-red-500 text-sm mt-1">{errors.business_activity.message}</p>
                        )}
                    </div>

                    {/* Linked Property (Optional) */}
                    <div className="md:col-span-2">
                        <label className="label">Linked Property (Optional)</label>
                        <select {...register('property_id')} className="input-field">
                            <option value="">-- None --</option>
                            {properties.map((property: any) => (
                                <option key={property.id} value={property.id}>
                                    {property.property_number} - {property.owner_name}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            Link to a property if this business operates from a registered property
                        </p>
                    </div>

                    {/* Street Name */}
                    <div>
                        <label className="label">Street Name</label>
                        <input
                            type="text"
                            {...register('street_name')}
                            className="input-field"
                            placeholder="NII AYI KUSHIE ST"
                        />
                    </div>

                    {/* GPS Address */}
                    <div>
                        <label className="label">GPS Address</label>
                        <input
                            type="text"
                            {...register('gps_address')}
                            className="input-field"
                            placeholder="GG-845-8731"
                        />
                    </div>

                    {/* Electoral Area */}
                    <div>
                        <label className="label">Electoral Area</label>
                        <select {...register('electoral_area_id')} className="input-field">
                            <option value="">Select Electoral Area</option>
                            {electoralAreas.map((area: any) => (
                                <option key={area.id} value={area.id}>
                                    {area.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Landmark */}
                    <div>
                        <label className="label">Landmark</label>
                        <input
                            type="text"
                            {...register('landmark')}
                            className="input-field"
                            placeholder="GOIL filling Station"
                        />
                    </div>

                    {/* Physical Location */}
                    <div className="md:col-span-2">
                        <label className="label">Physical Location</label>
                        <input
                            type="text"
                            {...register('physical_location')}
                            className="input-field"
                            placeholder="Detailed business location"
                        />
                    </div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800">
                        <strong>Note:</strong> A unique Business Operating Permit (BOP) Number will be automatically
                        generated in the format <code className="font-mono bg-white px-2 py-1 rounded">GN-BOP-2026-NNNNNN</code>
                    </p>
                </div>

                <div className="flex justify-end space-x-4 pt-4 border-t">
                    <Link href="/businesses" className="btn-secondary">
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn-primary flex items-center space-x-2"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span>Saving...</span>
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                <span>Register Business</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
