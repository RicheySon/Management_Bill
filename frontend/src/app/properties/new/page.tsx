'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import {
    createProperty,
    fetchCustomers,
    fetchPropertyClassifications,
    fetchElectoralAreas,
    fetchLocalAreas
} from '@/lib/api-client';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

interface PropertyForm {
    customer_id: string;
    classification_id: number;
    street_name?: string;
    gps_address?: string;
    physical_location?: string;
    landmark?: string;
    electoral_area_id?: number;
    local_area_id?: number;
    property_size?: number;
    year_registered?: number;
}

export default function NewPropertyPage() {
    const router = useRouter();
    const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<PropertyForm>();

    const [customers, setCustomers] = useState([]);
    const [classifications, setClassifications] = useState([]);
    const [electoralAreas, setElectoralAreas] = useState([]);
    const [localAreas, setLocalAreas] = useState([]);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [propertyNumber, setPropertyNumber] = useState<string | null>(null);

    const selectedElectoralArea = watch('electoral_area_id');

    useEffect(() => {
        const loadData = async () => {
            try {
                const [customersData, classificationsData, areasData] = await Promise.all([
                    fetchCustomers({ limit: 1000 }),
                    fetchPropertyClassifications(),
                    fetchElectoralAreas(),
                ]);
                setCustomers(customersData.data);
                setClassifications(classificationsData);
                setElectoralAreas(areasData);
            } catch (err) {
                console.error('Failed to load data:', err);
            }
        };
        loadData();
    }, []);

    useEffect(() => {
        if (selectedElectoralArea) {
            const loadLocalAreas = async () => {
                try {
                    const areas = await fetchLocalAreas(Number(selectedElectoralArea));
                    setLocalAreas(areas);
                } catch (err) {
                    console.error('Failed to load local areas:', err);
                }
            };
            loadLocalAreas();
        }
    }, [selectedElectoralArea]);

    const onSubmit = async (data: PropertyForm) => {
        setError(null);
        try {
            const result = await createProperty(data);
            setPropertyNumber(result.data.property_number);
            setSuccess(true);

            setTimeout(() => {
                router.push(`/properties/${result.data.id}`);
            }, 2000);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to register property');
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Register New Property</h1>
                    <p className="text-gray-600 mt-1">Add a new property to the system</p>
                </div>
                <Link href="/properties" className="btn-secondary flex items-center space-x-2">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                </Link>
            </div>

            {success && propertyNumber && (
                <div className="bg-green-50 border-2 border-green-500 text-green-800 px-6 py-4 rounded-lg mb-6">
                    <p className="font-semibold">✓ Property registered successfully!</p>
                    <p className="text-sm mt-1">Property Number: <span className="font-mono font-bold">{propertyNumber}</span></p>
                    <p className="text-sm">Redirecting...</p>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border-2 border-red-500 text-red-800 px-6 py-4 rounded-lg mb-6">
                    <p className="font-semibold">✗ Error</p>
                    <p className="text-sm">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="card space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Customer/Owner */}
                    <div className="md:col-span-2">
                        <label className="label">
                            Select Owner (Customer) <span className="text-red-500">*</span>
                        </label>
                        <select
                            {...register('customer_id', { required: 'Please select a customer' })}
                            className="input-field"
                        >
                            <option value="">-- Select Customer --</option>
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

                    {/* Property Classification */}
                    <div>
                        <label className="label">
                            Property Type <span className="text-red-500">*</span>
                        </label>
                        <select
                            {...register('classification_id', { required: 'Please select property type' })}
                            className="input-field"
                        >
                            <option value="">-- Select Type --</option>
                            {classifications.map((classification: any) => (
                                <option key={classification.id} value={classification.id}>
                                    {classification.name} (Rate: GHS {classification.base_rate}/sqm)
                                </option>
                            ))}
                        </select>
                        {errors.classification_id && (
                            <p className="text-red-500 text-sm mt-1">{errors.classification_id.message}</p>
                        )}
                    </div>

                    {/* Property Size */}
                    <div>
                        <label className="label">Property Size (sqm)</label>
                        <input
                            type="number"
                            step="0.01"
                            {...register('property_size')}
                            className="input-field"
                            placeholder="50.00"
                        />
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

                    {/* Local Area */}
                    <div>
                        <label className="label">Local Area</label>
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
                        <label className="label">Physical Location</label>
                        <input
                            type="text"
                            {...register('physical_location')}
                            className="input-field"
                            placeholder="Detailed property location"
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

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                        <strong>Note:</strong> A unique Property Number will be automatically generated upon registration
                        in the format <code className="font-mono bg-white px-2 py-1 rounded">GN-PR-2026-NNNNNN</code>
                    </p>
                </div>

                <div className="flex justify-end space-x-4 pt-4 border-t">
                    <Link href="/properties" className="btn-secondary">
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
                                <span>Register Property</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
