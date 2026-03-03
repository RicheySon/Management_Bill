'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import {
    fetchBusiness,
    updateBusiness,
    fetchBusinessCategories,
    fetchElectoralAreas,
    fetchLocalAreas,
} from '@/lib/api-client';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface BusinessForm {
    business_name: string;
    category_id: number;
    business_activity: string;
    business_contact?: string;
    business_email?: string;
    street_name?: string;
    gps_address?: string;
    landmark?: string;
    electoral_area_id?: number;
    local_area_id?: number;
    town?: string;
}

export default function EditBusinessPage() {
    const router = useRouter();
    const { id } = useParams();
    const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<BusinessForm>();

    const [categories, setCategories] = useState([]);
    const [electoralAreas, setElectoralAreas] = useState([]);
    const [localAreas, setLocalAreas] = useState([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const selectedElectoralArea = watch('electoral_area_id');

    useEffect(() => {
        const loadData = async () => {
            try {
                const [businessData, categoriesData, areasData] = await Promise.all([
                    fetchBusiness(id as string),
                    fetchBusinessCategories(),
                    fetchElectoralAreas(),
                ]);

                // Fill form
                const b = businessData.business;
                Object.keys(b).forEach(key => {
                    setValue(key as any, b[key]);
                });

                setCategories(categoriesData);
                setElectoralAreas(areasData);

                if (b.electoral_area_id) {
                    const locals = await fetchLocalAreas(b.electoral_area_id);
                    setLocalAreas(locals);
                    setValue('local_area_id', b.local_area_id);
                }
            } catch (err: any) {
                console.error('Failed to load business data:', err);
                setError('Failed to load business data');
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [id, setValue]);

    useEffect(() => {
        if (selectedElectoralArea) {
            fetchLocalAreas(selectedElectoralArea).then(setLocalAreas);
        } else {
            setLocalAreas([]);
        }
    }, [selectedElectoralArea]);

    const onSubmit = async (data: BusinessForm) => {
        setError(null);
        try {
            await updateBusiness(id as string, data);
            router.push(`/businesses/${id}`);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to update business');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-municipal-red"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Edit Business</h1>
                    <p className="text-gray-600 mt-1">Update business details</p>
                </div>
                <Link href={`/businesses/${id}`} className="btn-secondary flex items-center space-x-2">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Cancel</span>
                </Link>
            </div>

            {error && (
                <div className="bg-red-50 border-2 border-municipal-red text-red-800 px-6 py-4 rounded-lg mb-6">
                    <p className="font-semibold">Error</p>
                    <p className="text-sm">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-20">
                <div className="card">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 mb-6 text-center">
                        <h2 className="text-municipal-teal font-bold text-lg">Business Details</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                            <label className="label">Business Name</label>
                            <input type="text" {...register('business_name', { required: true })} className="input-field" />
                        </div>

                        <div>
                            <label className="label">Category</label>
                            <select {...register('category_id')} className="input-field">
                                {categories.map((c: any) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="label">Contact Number</label>
                            <input type="text" {...register('business_contact')} className="input-field" />
                        </div>

                        <div className="md:col-span-2">
                            <label className="label">Business Activity</label>
                            <textarea {...register('business_activity')} className="input-field h-24" />
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 mb-6 text-center">
                        <h2 className="text-municipal-teal font-bold text-lg">Location Details</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                            <label className="label">Physical Location / Street</label>
                            <input type="text" {...register('street_name')} className="input-field" />
                        </div>

                        <div>
                            <label className="label">Electoral Area</label>
                            <select {...register('electoral_area_id')} className="input-field">
                                {electoralAreas.map((area: any) => (
                                    <option key={area.id} value={area.id}>{area.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="label">Local Area</label>
                            <select {...register('local_area_id')} className="input-field">
                                <option value="">Select Local Area</option>
                                {localAreas.map((la: any) => (
                                    <option key={la.id} value={la.id}>{la.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="label">GPS Address</label>
                            <input type="text" {...register('gps_address')} className="input-field" />
                        </div>

                        <div>
                            <label className="label">Town</label>
                            <input type="text" {...register('town')} className="input-field" />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end space-x-4">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn-primary flex items-center space-x-2 px-8"
                    >
                        {isSubmitting ? 'Saving...' : <><Save className="w-4 h-4" /><span>Save Changes</span></>}
                    </button>
                </div>
            </form>
        </div>
    );
}
