'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { fetchCustomer, updateCustomer, fetchElectoralAreas, fetchLocalAreas } from '@/lib/api-client';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface CustomerForm {
    full_name: string;
    phone_number: string;
    email?: string;
    gps_address?: string;
    latitude?: number;
    longitude?: number;
    physical_location?: string;
    landmark?: string;
    electoral_area_id?: number;
    local_area_id?: number;
}

export default function EditCustomerPage() {
    const { id } = useParams();
    const router = useRouter();
    const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<CustomerForm>();

    const [electoralAreas, setElectoralAreas] = useState<any[]>([]);
    const [localAreas, setLocalAreas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const selectedElectoralArea = watch('electoral_area_id');

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // Fetch lookups
                const areas = await fetchElectoralAreas();
                setElectoralAreas(areas);

                // Fetch customer data
                const response = await fetchCustomer(id as string);
                const customer = response.customer;

                // Set form values
                setValue('full_name', customer.full_name);
                setValue('phone_number', customer.phone_number);
                setValue('email', customer.email || '');
                setValue('gps_address', customer.gps_address || '');
                setValue('latitude', customer.latitude);
                setValue('longitude', customer.longitude);
                setValue('physical_location', customer.physical_location || '');
                setValue('landmark', customer.landmark || '');
                setValue('electoral_area_id', customer.electoral_area_id);

                if (customer.electoral_area_id) {
                    const lAreas = await fetchLocalAreas(Number(customer.electoral_area_id));
                    setLocalAreas(lAreas);
                    setValue('local_area_id', customer.local_area_id);
                }
            } catch (err: any) {
                console.error('Failed to load initial data:', err);
                setError('Failed to load customer data');
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, [id, setValue]);

    useEffect(() => {
        if (selectedElectoralArea) {
            const loadLocalAreas = async () => {
                try {
                    const areas = await fetchLocalAreas(Number(selectedElectoralArea));
                    setLocalAreas(Array.isArray(areas) ? areas : []);
                } catch (err) {
                    console.error('Failed to load local areas:', err);
                }
            };
            loadLocalAreas();
        } else {
            setLocalAreas([]);
        }
    }, [selectedElectoralArea]);

    const onSubmit = async (data: CustomerForm) => {
        setError(null);
        try {
            await updateCustomer(id as string, data);
            setSuccess(true);

            setTimeout(() => {
                router.push(`/customers/${id}`);
            }, 1500);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to update customer');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-municipal-red"></div>
            </div>
        );
    }

    if (error && !success && loading === false && !selectedElectoralArea) {
        // Only show fatal error if we couldn't load initial data
        if (!watch('full_name')) {
            return (
                <div className="bg-red-50 border-2 border-red-200 text-red-800 p-8 rounded-xl text-center max-w-2xl mx-auto mt-10">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4" />
                    <h2 className="text-xl font-bold">Error</h2>
                    <p className="mb-6">{error}</p>
                    <button onClick={() => router.back()} className="btn-primary inline-flex items-center space-x-2">
                        <ArrowLeft className="w-4 h-4" />
                        <span>Go Back</span>
                    </button>
                </div>
            );
        }
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Edit Customer Profile</h1>
                    <p className="text-gray-600 mt-1">Update information for {watch('full_name')}</p>
                </div>
                <button onClick={() => router.back()} className="btn-secondary flex items-center space-x-2">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                </button>
            </div>

            {success && (
                <div className="bg-green-50 border-2 border-green-500 text-green-800 px-6 py-4 rounded-lg mb-6 shadow-sm">
                    <p className="font-semibold text-lg flex items-center">
                        <span className="mr-2">✓</span> Profile updated successfully!
                    </p>
                    <p className="text-sm opacity-90">Changes have been saved. Redirecting back to profile...</p>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border-2 border-municipal-red text-red-800 px-6 py-4 rounded-lg mb-6">
                    <p className="font-semibold">✗ Error</p>
                    <p className="text-sm">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="card space-y-6 shadow-xl border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Full Name */}
                    <div className="md:col-span-2">
                        <label className="label">
                            Full Name <span className="text-municipal-red">*</span>
                        </label>
                        <input
                            type="text"
                            {...register('full_name', { required: 'Full name is required' })}
                            className="input-field"
                            placeholder="Enter full name"
                        />
                        {errors.full_name && (
                            <p className="text-red-500 text-sm mt-1">{errors.full_name.message}</p>
                        )}
                    </div>

                    {/* Phone Number */}
                    <div>
                        <label className="label">
                            Phone Number <span className="text-municipal-red">*</span>
                        </label>
                        <input
                            type="tel"
                            {...register('phone_number', { required: 'Phone number is required' })}
                            className="input-field"
                            placeholder="0245678901"
                        />
                        {errors.phone_number && (
                            <p className="text-red-500 text-sm mt-1">{errors.phone_number.message}</p>
                        )}
                    </div>

                    {/* Email */}
                    <div>
                        <label className="label">Email Address</label>
                        <input
                            type="email"
                            {...register('email')}
                            className="input-field"
                            placeholder="customer@email.com"
                        />
                    </div>

                    {/* GPS Address */}
                    <div>
                        <label className="label font-mono tracking-tighter">GPS ADDRESS</label>
                        <input
                            type="text"
                            {...register('gps_address')}
                            className="input-field font-mono"
                            placeholder="GG-845-8731"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Latitude</label>
                            <input
                                type="number"
                                step="any"
                                {...register('latitude', { valueAsNumber: true })}
                                className="input-field"
                                placeholder="5.6037"
                            />
                        </div>
                        <div>
                            <label className="label">Longitude</label>
                            <input
                                type="number"
                                step="any"
                                {...register('longitude', { valueAsNumber: true })}
                                className="input-field"
                                placeholder="-0.1870"
                            />
                        </div>
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

                    {/* Local Area */}
                    <div>
                        <label className="label">Local Area / Community</label>
                        <select {...register('local_area_id')} className="input-field" disabled={!selectedElectoralArea}>
                            <option value="">Select Local Area</option>
                            {localAreas.map((area: any) => (
                                <option key={area.id} value={area.id}>
                                    {area.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Physical Location */}
                    <div className="md:col-span-2">
                        <label className="label">Physical Location / Street Name</label>
                        <input
                            type="text"
                            {...register('physical_location')}
                            className="input-field"
                            placeholder="NII AYI KUSHIE ST"
                        />
                    </div>

                    {/* Landmark */}
                    <div className="md:col-span-2">
                        <label className="label">Landmark</label>
                        <input
                            type="text"
                            {...register('landmark')}
                            className="input-field"
                            placeholder="Near GOIL filling Station"
                        />
                    </div>
                </div>

                <div className="flex justify-end space-x-4 pt-6 border-t">
                    <button type="button" onClick={() => router.back()} className="btn-secondary">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn-primary flex items-center space-x-2 px-8"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span>Saving Changes...</span>
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                <span>Save Changes</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
