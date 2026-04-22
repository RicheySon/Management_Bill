'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import {
    fetchBusiness,
    updateBusiness,
    updateCustomer,
    fetchBusinessCategories,
    fetchElectoralAreas,
    fetchLocalAreas,
    fetchActiveBusinessFeeItems,
    reverseGeocode,
} from '@/lib/api-client';
import { ArrowLeft, Save, Navigation, Map as MapIcon, X } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const MapSelector = dynamic(() => import('@/components/MapSelector'), {
    ssr: false,
    loading: () => <div className="h-[400px] w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-500">Loading Map...</div>
});

interface BusinessEditForm {
    // Business Owner fields
    full_name: string;
    phone_number: string;
    address?: string;
    email?: string;
    gender?: string;
    marital_status?: string;
    ghana_card_no?: string;
    // Business fields
    business_name: string;
    business_contact?: string;
    category_id: number;
    business_type_main?: string;
    business_type_sub?: string;
    business_category_class?: string;
    business_email?: string;
    business_activity: string;
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
    'ADVERTISING', 'ARTISAN', 'AUTOMOBILE', 'COMMERCE', 'COMMUNICATION',
    'CONSTRUCTION', 'EDUCATION', 'ELECTRICAL', 'ENERGY', 'ENTERTAINMENT',
    'ESTATE', 'FASHION/DECORATION', 'FINANCIAL', 'FOOD/DRINKS', 'FORESTRY',
    'GENERAL', 'HEALTH', 'MANUFACTURING', 'TOURISM', 'WAREHOUSE',
];

export default function EditBusinessPage() {
    const router = useRouter();
    const { id } = useParams();
    const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<BusinessEditForm>();

    const [categories, setCategories] = useState([]);
    const [electoralAreas, setElectoralAreas] = useState([]);
    const [localAreas, setLocalAreas] = useState([]);
    const [feeItems, setFeeItems] = useState<any[]>([]);
    const [selectedFeeItemId, setSelectedFeeItemId] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(true);
    const [customerId, setCustomerId] = useState<string | null>(null);
    const [isDetecting, setIsDetecting] = useState(false);
    const [showMap, setShowMap] = useState(false);

    const selectedElectoralArea = watch('electoral_area_id');

    const detectLocation = () => {
        setIsDetecting(true);
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            setIsDetecting(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                setValue('latitude', parseFloat(lat.toFixed(6)));
                setValue('longitude', parseFloat(lng.toFixed(6)));
                
                // Attempt reverse geocoding
                try {
                    const geoData = await reverseGeocode(lat, lng);
                    if (geoData && geoData.address) {
                        const addr = geoData.address;
                        const town = addr.city || addr.town || addr.village || addr.suburb || '';
                        const street = addr.road || addr.street || '';
                        const suburb = addr.neighbourhood || addr.suburb || '';
                        
                        if (town) setValue('town', town);
                        if (street) setValue('street_name', street);
                        if (suburb) setValue('landmark', suburb);
                    }
                } catch (err) {
                    console.error('Auto-address failed:', err);
                }

                setIsDetecting(false);
            },
            (err) => {
                alert(`Failed to get location: ${err.message}`);
                setIsDetecting(false);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    useEffect(() => {
        const loadData = async () => {
            try {
                const [businessData, categoriesData, areasData, feeItemsData] = await Promise.all([
                    fetchBusiness(id as string),
                    fetchBusinessCategories(),
                    fetchElectoralAreas(),
                    fetchActiveBusinessFeeItems(new Date().getFullYear()),
                ]);

                const b = businessData.business;
                const c = businessData.customer;

                // Fill business fields
                Object.keys(b).forEach(key => {
                    if (key !== 'id' && key !== 'created_at' && key !== 'updated_at') {
                        setValue(key as any, b[key]);
                    }
                });

                if (b.fee_item_id) {
                    setSelectedFeeItemId(b.fee_item_id.toString());
                }

                // Fill business owner (customer) fields
                if (c) {
                    setCustomerId(c.id);
                    setValue('full_name', c.full_name || '');
                    setValue('phone_number', c.phone_number || '');
                    setValue('email', c.email || '');
                    setValue('address', c.address || '');
                    setValue('gender', c.gender || '');
                    setValue('marital_status', c.marital_status || '');
                    setValue('ghana_card_no', c.ghana_card_no || '');
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
            fetchLocalAreas(selectedElectoralArea).then(setLocalAreas).catch(() => setLocalAreas([]));
        } else {
            setLocalAreas([]);
        }
    }, [selectedElectoralArea]);

    const onSubmit = async (data: BusinessEditForm) => {
        setError(null);
        try {
            // Update the business owner (customer) details
            if (customerId) {
                await updateCustomer(customerId, {
                    full_name: data.full_name,
                    phone_number: data.phone_number,
                    email: data.email,
                    address: data.address,
                    gender: data.gender,
                    marital_status: data.marital_status,
                    ghana_card_no: data.ghana_card_no,
                });
            }

            // Update business
            await updateBusiness(id as string, {
                business_name: data.business_name,
                category_id: data.category_id,
                business_activity: data.business_activity,
                business_contact: data.business_contact,
                business_type_main: data.business_type_main,
                business_type_sub: data.business_type_sub,
                business_category_class: data.business_category_class,
                business_email: data.business_email,
                description: data.description,
                account_number: data.account_number,
                division_number: data.division_number,
                block_number: data.block_number,
                gps_address: data.gps_address,
                latitude: data.latitude,
                longitude: data.longitude,
                town: data.town,
                street_name: data.street_name,
                landmark: data.landmark,
                electoral_area_id: data.electoral_area_id,
                local_area_id: data.local_area_id,
                fee_item_id: selectedFeeItemId ? parseInt(selectedFeeItemId) : null,
            });

            setSuccess(true);
            setTimeout(() => { router.push(`/businesses/${id}`); }, 1500);
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
                    <p className="text-gray-600 mt-1">Update business and owner details</p>
                </div>
                <Link href={`/businesses/${id}`} className="btn-secondary flex items-center space-x-2">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Cancel</span>
                </Link>
            </div>

            {success && (
                <div className="bg-green-50 border-2 border-green-500 text-green-800 px-6 py-4 rounded-lg mb-6">
                    <p className="font-semibold">✓ Business updated successfully!</p>
                    <p className="text-sm">Redirecting...</p>
                </div>
            )}
            {error && (
                <div className="bg-red-50 border-2 border-municipal-red text-red-800 px-6 py-4 rounded-lg mb-6">
                    <p className="font-semibold">Error</p>
                    <p className="text-sm">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-20">

                {/* SECTION: Business Owner Information */}
                <div className="card">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 mb-6 text-center">
                        <h2 className="text-municipal-teal font-bold text-lg">Business Owner Information</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                            <label className="label">Full Name</label>
                            <input type="text" {...register('full_name')} className="input-field" placeholder="Full name" />
                        </div>

                        <div>
                            <label className="label">Phone Number <span className="text-municipal-red">*</span></label>
                            <div className="flex">
                                <span className="inline-flex items-center px-3 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg text-sm text-gray-600">+233</span>
                                <input type="tel" {...register('phone_number')} className="input-field rounded-l-none" placeholder="245678901" />
                            </div>
                        </div>

                        <div>
                            <label className="label">Address</label>
                            <input type="text" {...register('address')} className="input-field" placeholder="Enter address" />
                        </div>

                        <div>
                            <label className="label">Gender <span className="text-municipal-red">*</span></label>
                            <select {...register('gender')} className="input-field">
                                <option value="">Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                            </select>
                        </div>

                        <div>
                            <label className="label">Marital Status <span className="text-municipal-red">*</span></label>
                            <select {...register('marital_status')} className="input-field">
                                <option value="">Marital Status</option>
                                <option value="Single">Single</option>
                                <option value="Married">Married</option>
                                <option value="Divorced">Divorced</option>
                                <option value="Widowed">Widowed</option>
                            </select>
                        </div>

                        <div>
                            <label className="label">Email</label>
                            <input type="email" {...register('email')} className="input-field" placeholder="Email" />
                        </div>

                        <div>
                            <label className="label">Ghana Card No</label>
                            <input type="text" {...register('ghana_card_no')} className="input-field" placeholder="GHA-XXXXXXXXX-X" />
                        </div>
                    </div>
                </div>

                {/* SECTION: Business Details */}
                <div className="card">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 mb-6 text-center">
                        <h2 className="text-municipal-teal font-bold text-lg">Business Details</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                            <label className="label">Business Name <span className="text-municipal-red">*</span></label>
                            <input type="text" {...register('business_name', { required: 'Business name is required' })} className="input-field" placeholder="Business name" />
                            {errors.business_name && <p className="text-red-500 text-sm mt-1">{errors.business_name.message}</p>}
                        </div>

                        <div>
                            <label className="label">Business Contact</label>
                            <div className="flex">
                                <span className="inline-flex items-center px-3 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg text-sm text-gray-600">+233</span>
                                <input type="tel" {...register('business_contact')} className="input-field rounded-l-none" placeholder="245678901" />
                            </div>
                        </div>

                        <div>
                            <label className="label">Business Type (Main) <span className="text-municipal-red">*</span></label>
                            <select {...register('business_type_main')} className="input-field">
                                <option value="">Select business type</option>
                                {BUSINESS_TYPE_MAIN_OPTIONS.map((type) => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="label">Business Type (Sub)</label>
                            <input type="text" {...register('business_type_sub')} className="input-field" placeholder="Sub type" />
                        </div>

                        <div>
                            <label className="label">Business Category <span className="text-municipal-red">*</span></label>
                            <select {...register('business_category_class')} className="input-field">
                                <option value="">Select category</option>
                                <option value="Category A">Category A</option>
                                <option value="Category B">Category B</option>
                                <option value="Category C">Category C</option>
                            </select>
                        </div>

                        <div>
                            <label className="label">Fee Category <span className="text-municipal-red">*</span></label>
                            <select {...register('category_id', { required: 'Please select fee category' })} className="input-field">
                                <option value="">Select fee category</option>
                                {categories.map((category: any) => (
                                    <option key={category.id} value={category.id}>
                                        {category.name} (GHS {category.base_fee})
                                    </option>
                                ))}
                            </select>
                            {errors.category_id && <p className="text-red-500 text-sm mt-1">{errors.category_id.message}</p>}
                        </div>

                        {feeItems.length > 0 && (
                            <div className="md:col-span-2">
                                <label className="label">Fee Schedule Item (Configured Rate)</label>
                                <select className="input-field" value={selectedFeeItemId}
                                    onChange={(e) => {
                                        setSelectedFeeItemId(e.target.value);
                                        setValue('fee_item_id', e.target.value ? parseInt(e.target.value) : undefined);
                                    }}>
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
                            <input type="email" {...register('business_email')} className="input-field" placeholder="Business email" />
                        </div>

                        <div className="md:col-span-2">
                            <label className="label">Description / Business Activity <span className="text-municipal-red">*</span></label>
                            <textarea {...register('business_activity', { required: 'Please describe business activity' })} className="input-field" rows={3} placeholder="What the business sells or does" />
                            {errors.business_activity && <p className="text-red-500 text-sm mt-1">{errors.business_activity.message}</p>}
                        </div>

                        <div>
                            <label className="label">Account Number</label>
                            <input type="text" {...register('account_number')} className="input-field" placeholder="Account no" />
                        </div>

                        <div>
                            <label className="label">Division Number</label>
                            <input type="text" {...register('division_number')} className="input-field" placeholder="Division no" />
                        </div>

                        <div>
                            <label className="label">Block Number</label>
                            <input type="text" {...register('block_number')} className="input-field" placeholder="Block no" />
                        </div>
                    </div>
                </div>

                {/* SECTION: Location Details */}
                <div className="card">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 mb-6 text-center">
                        <h2 className="text-municipal-teal font-bold text-lg">Location Details</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="label">GPS Address</label>
                            <input type="text" {...register('gps_address')} className="input-field" placeholder="GPS address" />
                        </div>

                        <div className="md:col-span-2">
                            <div className="flex justify-between items-center mb-2">
                                <label className="label mb-0">Location Coordinates</label>
                                <div className="flex space-x-2">
                                    <button type="button" onClick={detectLocation} disabled={isDetecting}
                                        className="btn-secondary py-1 px-3 text-xs flex items-center space-x-1">
                                        {isDetecting ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-municipal-red"></div> : <Navigation className="w-3 h-3" />}
                                        <span>{isDetecting ? 'Detecting...' : 'Detect GPS'}</span>
                                    </button>
                                    <button type="button" onClick={() => setShowMap(!showMap)}
                                        className={`py-1 px-3 text-xs flex items-center space-x-1 rounded-md transition-all ${showMap ? 'bg-municipal-red text-white hover:bg-red-700' : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'}`}>
                                        {showMap ? <X className="w-3 h-3" /> : <MapIcon className="w-3 h-3" />}
                                        <span>{showMap ? 'Close Map' : 'Select on Map'}</span>
                                    </button>
                                </div>
                            </div>
                            {showMap && (
                                <div className="mb-4">
                                    <p className="text-xs text-blue-600 mb-2 font-medium">Click on the map to pin the exact location.</p>
                                    <MapSelector
                                        onLocationSelectAction={async (lat: number, lng: number) => {
                                            setValue('latitude', parseFloat(lat.toFixed(6)));
                                            setValue('longitude', parseFloat(lng.toFixed(6)));
                                            
                                            // Attempt reverse geocoding
                                            try {
                                                const geoData = await reverseGeocode(lat, lng);
                                                if (geoData && geoData.address) {
                                                    const addr = geoData.address;
                                                    const town = addr.city || addr.town || addr.village || addr.suburb || '';
                                                    const street = addr.road || addr.street || '';
                                                    
                                                    if (town) setValue('town', town);
                                                    if (street) setValue('street_name', street);
                                                }
                                            } catch (err) {
                                                console.error('Auto-address from map failed:', err);
                                            }
                                        }}
                                        initialLat={watch('latitude')}
                                        initialLng={watch('longitude')}
                                    />
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block uppercase tracking-wider font-bold italic">Latitude</label>
                                    <input type="number" step="any" {...register('latitude', { valueAsNumber: true })} className="input-field" placeholder="5.6037" />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block uppercase tracking-wider font-bold italic">Longitude</label>
                                    <input type="number" step="any" {...register('longitude', { valueAsNumber: true })} className="input-field" placeholder="-0.1870" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="label">Town</label>
                            <input type="text" {...register('town')} className="input-field" placeholder="Town" />
                        </div>

                        <div>
                            <label className="label">Street Name</label>
                            <input type="text" {...register('street_name')} className="input-field" placeholder="Name of street" />
                        </div>

                        <div>
                            <label className="label">Landmark</label>
                            <input type="text" {...register('landmark')} className="input-field" placeholder="Landmark" />
                        </div>

                        <div>
                            <label className="label">Electoral Area</label>
                            <select {...register('electoral_area_id')} className="input-field">
                                <option value="">Electoral area</option>
                                {electoralAreas.map((area: any) => (
                                    <option key={area.id} value={area.id}>{area.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="label">Local Area / Community</label>
                            <select {...register('local_area_id')} className="input-field" disabled={!selectedElectoralArea}>
                                <option value="">Select Local Area</option>
                                {localAreas.map((area: any) => (
                                    <option key={area.id} value={area.id}>{area.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end space-x-4">
                    <Link href={`/businesses/${id}`} className="btn-secondary">Cancel</Link>
                    <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center space-x-2 px-8">
                        {isSubmitting ? (
                            <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div><span>Saving...</span></>
                        ) : (
                            <><Save className="w-4 h-4" /><span>Save Changes</span></>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
