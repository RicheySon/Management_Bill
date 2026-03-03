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
    fetchActiveBusinessFeeItems,
} from '@/lib/api-client';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface BusinessForm {
    business_name: string;
    category_id: number;
    business_activity: string;
    business_contact?: string;
    business_type_main?: string;
    business_type_sub?: string;
    business_category_class?: string;
    business_email?: string;
    description?: string;
    account_number?: string;
    division_number?: string;
    block_number?: string;
    fee_item_id?: number;
    // Location fields
    gps_address?: string;
    latitude?: number;
    longitude?: number;
    town?: string;
    street_name?: string;
    landmark?: string;
    electoral_area_id?: number;
    local_area_id?: number;
}

const BUSINESS_TYPE_MAIN_OPTIONS = [
    'ADVERTISING',
    'ARTISAN',
    'AUTOMOBILE',
    'COMMERCE',
    'COMMUNICATION',
    'CONSTRUCTION',
    'EDUCATION',
    'ELECTRICAL',
    'ENERGY',
    'ENTERTAINMENT',
    'ESTATE',
    'FASHION/DECORATION',
    'FINANCIAL',
    'FOOD/DRINKS',
    'FORESTRY',
    'GENERAL',
    'HEALTH',
    'MANUFACTURING',
    'TOURISM',
    'WAREHOUSE',
];

export default function EditBusinessPage() {
    const router = useRouter();
    const { id } = useParams();
    const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<BusinessForm>();

    const [categories, setCategories] = useState([]);
    const [electoralAreas, setElectoralAreas] = useState([]);
    const [localAreas, setLocalAreas] = useState([]);
    const [feeItems, setFeeItems] = useState<any[]>([]);
    const [selectedFeeItemId, setSelectedFeeItemId] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const selectedElectoralArea = watch('electoral_area_id');

    useEffect(() => {
        const loadData = async () => {
            try {
                const [businessData, categoriesData, areasData, feeItemsData] = await Promise.all([
                    fetchBusiness(id as string),
                    fetchBusinessCategories(),
                    fetchElectoralAreas(),
                    fetchActiveBusinessFeeItems(new Date().getFullYear()),
                ]);

                // Fill form
                const b = businessData.business;
                Object.keys(b).forEach(key => {
                    setValue(key as any, b[key]);
                });

                if (b.fee_item_id) {
                    setSelectedFeeItemId(b.fee_item_id.toString());
                }

                setCategories(categoriesData);
                setElectoralAreas(areasData);
                setFeeItems(feeItemsData || []);

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
                            <label className="label">
                                Business Name <span className="text-municipal-red">*</span>
                            </label>
                            <input
                                type="text"
                                {...register('business_name', { required: 'Business name is required' })}
                                className="input-field"
                                placeholder="Business name"
                            />
                            {errors.business_name && (
                                <p className="text-red-500 text-sm mt-1">{errors.business_name.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="label">Business Contact</label>
                            <div className="flex">
                                <span className="inline-flex items-center px-3 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg text-sm text-gray-600">+233</span>
                                <input
                                    type="tel"
                                    {...register('business_contact')}
                                    className="input-field rounded-l-none"
                                    placeholder="245678901"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="label">
                                Business Type (Main) <span className="text-municipal-red">*</span>
                            </label>
                            <select
                                {...register('business_type_main')}
                                className="input-field"
                            >
                                <option value="">Select business type</option>
                                {BUSINESS_TYPE_MAIN_OPTIONS.map((type) => (
                                    <option key={type} value={type}>
                                        {type}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="label">Business Type (Sub)</label>
                            <input
                                type="text"
                                {...register('business_type_sub')}
                                className="input-field"
                                placeholder="Sub type"
                            />
                        </div>

                        <div>
                            <label className="label">
                                Business Category <span className="text-municipal-red">*</span>
                            </label>
                            <select
                                {...register('business_category_class')}
                                className="input-field"
                            >
                                <option value="">Select category</option>
                                <option value="Category A">Category A</option>
                                <option value="Category B">Category B</option>
                                <option value="Category C">Category C</option>
                            </select>
                        </div>

                        <div>
                            <label className="label">
                                Fee Category <span className="text-municipal-red">*</span>
                            </label>
                            <select
                                {...register('category_id', { required: 'Please select fee category' })}
                                className="input-field"
                            >
                                <option value="">Select fee category</option>
                                {categories.map((category: any) => (
                                    <option key={category.id} value={category.id}>
                                        {category.name} (GHS {category.base_fee})
                                    </option>
                                ))}
                            </select>
                            {errors.category_id && (
                                <p className="text-red-500 text-sm mt-1">{errors.category_id.message}</p>
                            )}
                        </div>

                        {/* Fee Schedule Item (from configured fee schedule) */}
                        {feeItems.length > 0 && (
                            <div className="md:col-span-2">
                                <label className="label">
                                    Fee Schedule Item (Configured Rate)
                                </label>
                                <select
                                    className="input-field"
                                    value={selectedFeeItemId}
                                    onChange={(e) => {
                                        setSelectedFeeItemId(e.target.value);
                                        setValue('fee_item_id', e.target.value ? parseInt(e.target.value) : undefined);
                                    }}
                                >
                                    <option value="">Select from fee schedule (optional)</option>
                                    {feeItems.filter((fi: any) => !fi.is_group_header).map((item: any) => (
                                        <option key={item.id} value={item.id}>
                                            {item.main_item_number}. {item.description}
                                            {item.cat_a_fee ? ` - CAT A: GHS ${Number(item.cat_a_fee).toFixed(2)}` : ''}
                                            {item.cat_b_fee ? ` | CAT B: GHS ${Number(item.cat_b_fee).toFixed(2)}` : ''}
                                            {item.cat_c_fee ? ` | CAT C: GHS ${Number(item.cat_c_fee).toFixed(2)}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="label">Business Email</label>
                            <input
                                type="email"
                                {...register('business_email')}
                                className="input-field"
                                placeholder="Business email"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="label">
                                Description / Business Activity <span className="text-municipal-red">*</span>
                            </label>
                            <textarea
                                {...register('business_activity', { required: 'Please describe business activity' })}
                                className="input-field"
                                rows={3}
                                placeholder="What the business sells or does"
                            />
                            {errors.business_activity && (
                                <p className="text-red-500 text-sm mt-1">{errors.business_activity.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="label">Account Number</label>
                            <input
                                type="text"
                                {...register('account_number')}
                                className="input-field"
                                placeholder="Account no"
                            />
                        </div>

                        <div>
                            <label className="label">Division Number</label>
                            <input
                                type="text"
                                {...register('division_number')}
                                className="input-field"
                                placeholder="Division no"
                            />
                        </div>

                        <div>
                            <label className="label">Block Number</label>
                            <input
                                type="text"
                                {...register('block_number')}
                                className="input-field"
                                placeholder="Block no"
                            />
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 mb-6 text-center">
                        <h2 className="text-municipal-teal font-bold text-lg">Location Details</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="label">GPS Address</label>
                            <input
                                type="text"
                                {...register('gps_address')}
                                className="input-field"
                                placeholder="GPS address"
                            />
                        </div>

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

                        <div>
                            <label className="label">Town</label>
                            <input
                                type="text"
                                {...register('town')}
                                className="input-field"
                                placeholder="Town"
                            />
                        </div>

                        <div>
                            <label className="label">Street Name</label>
                            <input
                                type="text"
                                {...register('street_name')}
                                className="input-field"
                                placeholder="Name of street"
                            />
                        </div>

                        <div>
                            <label className="label">Landmark</label>
                            <input
                                type="text"
                                {...register('landmark')}
                                className="input-field"
                                placeholder="Landmark"
                            />
                        </div>

                        <div>
                            <label className="label">Electoral Area</label>
                            <select {...register('electoral_area_id')} className="input-field">
                                <option value="">Electoral area</option>
                                {electoralAreas.map((area: any) => (
                                    <option key={area.id} value={area.id}>
                                        {area.name}
                                    </option>
                                ))}
                            </select>
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
