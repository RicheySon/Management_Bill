'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { createCustomer, fetchElectoralAreas, fetchLocalAreas } from '@/lib/api-client';
import { ArrowLeft, Save } from 'lucide-react';
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

export default function NewCustomerPage() {
    const router = useRouter();
    const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<CustomerForm>();

    const [electoralAreas, setElectoralAreas] = useState<any[]>([]);
    const [localAreas, setLocalAreas] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const selectedElectoralArea = watch('electoral_area_id');

    useEffect(() => {
        const loadLookups = async () => {
            try {
                console.log('Fetching electoral areas...');
                const areas = await fetchElectoralAreas();
                console.log('Received electoral areas:', areas);
                if (Array.isArray(areas)) {
                    setElectoralAreas(areas);
                } else {
                    console.error('Electoral areas is not an array:', areas);
                }
            } catch (err) {
                console.error('Failed to load electoral areas:', err);
                setError('Failed to connect to backend service');
            }
        };
        loadLookups();
    }, []);

    useEffect(() => {
        if (selectedElectoralArea) {
            const loadLocalAreas = async () => {
                try {
                    console.log(`Fetching local areas for ID: ${selectedElectoralArea}`);
                    const areas = await fetchLocalAreas(Number(selectedElectoralArea));
                    console.log('Received local areas:', areas);
                    if (Array.isArray(areas)) {
                        setLocalAreas(areas);
                    } else {
                        setLocalAreas([]);
                    }
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
            const result = await createCustomer(data);
            setSuccess(true);

            setTimeout(() => {
                router.push(`/customers/${result.data.id}`);
            }, 1500);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to register customer');
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Register New Customer</h1>
                    <p className="text-gray-600 mt-1">Add a new customer to the system</p>
                </div>
                <Link href="/customers" className="btn-secondary flex items-center space-x-2">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                </Link>
            </div>

            {success && (
                <div className="bg-green-50 border-2 border-green-500 text-green-800 px-6 py-4 rounded-lg mb-6">
                    <p className="font-semibold">✓ Customer registered successfully!</p>
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
                        <label className="label">Email (Optional)</label>
                        <input
                            type="email"
                            {...register('email')}
                            className="input-field"
                            placeholder="customer@email.com"
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

                    {/* Latitude */}
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

                    {/* Longitude */}
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

                <div className="flex justify-end space-x-4 pt-4 border-t">
                    <Link href="/customers" className="btn-secondary">
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
                                <span>Register Customer</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
