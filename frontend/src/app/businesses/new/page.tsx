'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import {
    createBusiness,
    createCustomer,
    fetchCustomer,
    fetchElectoralAreas,
    fetchLocalAreas,
    fetchActiveBusinessFeeItems,
    reverseGeocode,
    formatGeoAddress,
} from '@/lib/api-client';
import { toCoord } from '@/lib/geo';
import { ArrowLeft, Save, UserPlus, UserCheck, Navigation, MapPin, Map as MapIcon, X, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import CustomerSearchSelect from '@/components/CustomerSearchSelect';

const toNullableId = (v: any) =>
    (v === '' || v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v));

const toOptionalNumber = (v: any) => {
    if (v === '' || v === undefined || v === null) return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
};

const MapSelector = dynamic(() => import('@/components/MapSelector'), {
    ssr: false,
    loading: () => <div className="h-[400px] w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-500">Loading Map...</div>
});

interface BusinessForm {
    // Business Owner fields
    full_name: string;
    phone_number: string;
    address?: string;
    gender?: string;
    marital_status?: string;
    email?: string;
    ghana_card_no?: string;
    // Business fields
    customer_id?: string;
    business_name: string;
    business_contact?: string;
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

export default function NewBusinessPage() {
    const router = useRouter();
    const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<BusinessForm>();

    const [electoralAreas, setElectoralAreas] = useState([]);
    const [localAreas, setLocalAreas] = useState([]);
    const [feeItems, setFeeItems] = useState<any[]>([]);
    const [selectedFeeItemId, setSelectedFeeItemId] = useState<string>('');
    const [selectedFeeAmount, setSelectedFeeAmount] = useState<string>('');
    const [assessedAmount, setAssessedAmount] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [businessNumber, setBusinessNumber] = useState<string | null>(null);
    const [isNewOwner, setIsNewOwner] = useState(true);
    const [isDetecting, setIsDetecting] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
    const [selectedCustomerProfile, setSelectedCustomerProfile] = useState<any>(null);
    const [loadingProfile, setLoadingProfile] = useState(false);

    const watchedCustomerId = watch('customer_id');
    const selectedElectoralArea = watch('electoral_area_id');

    // Auto-fetch customer profile when existing owner is selected
    useEffect(() => {
        if (!isNewOwner && watchedCustomerId) {
            const doFetch = async () => {
                setLoadingProfile(true);
                setSelectedCustomerProfile(null);
                try {
                    const data = await fetchCustomer(watchedCustomerId);
                    setSelectedCustomerProfile(data.customer);
                } catch (err) {
                    console.error('Failed to fetch customer profile', err);
                } finally {
                    setLoadingProfile(false);
                }
            };
            doFetch();
        } else if (isNewOwner) {
            setSelectedCustomerProfile(null);
        }
    }, [watchedCustomerId, isNewOwner]);

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
                const acc = position.coords.accuracy;
                
                setValue('latitude', parseFloat(lat.toFixed(6)));
                setValue('longitude', parseFloat(lng.toFixed(6)));
                setLocationAccuracy(acc);
                
                // Attempt reverse geocoding
                try {
                    const geoData = await reverseGeocode(lat, lng);
                    if (geoData) {
                        const geo = formatGeoAddress(geoData);
                        if (geo.town) setValue('town', geo.town);
                        if (geo.street) setValue('street_name', geo.street);
                        if (geo.landmark) setValue('landmark', geo.landmark);
                        if (!watch('gps_address')) {
                            setValue('gps_address', `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
                        }
                    }
                } catch (err) {
                    console.error('Auto-address failed:', err);
                }

                setIsDetecting(false);
            },
            (error) => {
                console.error('Geolocation error:', error);
                alert(error.code === 1 ? 'Location permission was denied. Allow location for this site, or use “Select on Map”.' : `Failed to get location: ${error.message}. You can use “Select on Map” instead.`);
                setIsDetecting(false);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    useEffect(() => {
        const loadData = async () => {
            try {
                const [areasData, feeItemsData] = await Promise.all([
                    fetchElectoralAreas(),
                    fetchActiveBusinessFeeItems(new Date().getFullYear()),
                ]);
                setElectoralAreas(areasData || []);
                setFeeItems(feeItemsData || []);
            } catch (err) {
                console.error('Failed to load data:', err);
                setError('Failed to load essential form data. Please refresh the page.');
            }
        };
        loadData();
    }, []);

    useEffect(() => {
        const eaId = toNullableId(selectedElectoralArea);
        if (!eaId) {
            setLocalAreas([]);
            setValue('local_area_id', undefined as any);
            return;
        }
        let cancelled = false;
        fetchLocalAreas(eaId)
            .then((areas) => {
                if (!cancelled) setLocalAreas(areas || []);
            })
            .catch(() => {
                if (!cancelled) setLocalAreas([]);
            });
        setValue('local_area_id', undefined as any);
        return () => {
            cancelled = true;
        };
    }, [selectedElectoralArea, setValue]);

    const onSubmit = async (data: BusinessForm) => {
        setError(null);
        try {
            let customerId = data.customer_id;

            // If creating new business owner, register them first
            if (isNewOwner) {
                if (!data.full_name || !data.phone_number) {
                    setError('Full Name and Phone Number are required for new business owner');
                    return;
                }
                const customerResult = await createCustomer({
                    full_name: data.full_name,
                    phone_number: data.phone_number,
                    email: data.email,
                    address: data.address,
                    gender: data.gender,
                    marital_status: data.marital_status,
                    ghana_card_no: data.ghana_card_no,
                });
                customerId = customerResult.data.id;
            }

            if (!customerId) {
                setError('Please select an existing business owner or create a new one');
                return;
            }

            const result = await createBusiness({
                business_name: data.business_name,
                customer_id: customerId,
                category_id: null,
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
                latitude: toOptionalNumber(data.latitude),
                longitude: toOptionalNumber(data.longitude),
                town: data.town,
                street_name: data.street_name,
                landmark: data.landmark,
                electoral_area_id: toNullableId(data.electoral_area_id),
                local_area_id: toNullableId(data.local_area_id),
                fee_item_id: selectedFeeItemId ? parseInt(selectedFeeItemId) : null,
                assessed_amount: toOptionalNumber(assessedAmount),
            });

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
                    <h1 className="text-3xl font-bold text-gray-900">New Business</h1>
                    <p className="text-gray-600 mt-1">Register a new Business Operating Permit (BOP)</p>
                </div>
                <Link href="/businesses" className="btn-secondary flex items-center space-x-2">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Go back</span>
                </Link>
            </div>

            {success && businessNumber && (
                <div className="bg-green-50 border-2 border-green-500 text-green-800 px-6 py-4 rounded-lg mb-6">
                    <p className="font-semibold">Business registered successfully!</p>
                    <p className="text-sm mt-1">BOP Number: <span className="font-mono font-bold">{businessNumber}</span></p>
                    <p className="text-sm">Redirecting...</p>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border-2 border-municipal-red text-red-800 px-6 py-4 rounded-lg mb-6">
                    <p className="font-semibold">Error</p>
                    <p className="text-sm">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* ============================================= */}
                {/* Owner Toggle */}
                {/* ============================================= */}
                <div className="flex space-x-2">
                    <button
                        type="button"
                        onClick={() => setIsNewOwner(true)}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isNewOwner ? 'bg-municipal-teal text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        <UserPlus className="w-4 h-4" />
                        <span>Add New</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsNewOwner(false)}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${!isNewOwner ? 'bg-municipal-teal text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        <UserCheck className="w-4 h-4" />
                        <span>Add Existing</span>
                    </button>
                </div>

                {/* ============================================= */}
                {/* SECTION: Business Owner Information */}
                {/* ============================================= */}
                <div className="card">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 mb-6">
                        <h2 className="text-municipal-teal font-bold text-lg text-center">Business Owner Information</h2>
                        <p className="text-center text-sm text-gray-600 mt-1">
                            Fields marked (optional) can be skipped. Only starred fields are required.
                        </p>
                    </div>

                    {isNewOwner ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="md:col-span-2">
                                <label className="label">Full Name</label>
                                <input
                                    type="text"
                                    {...register('full_name')}
                                    className="input-field"
                                    placeholder="Full name"
                                />
                            </div>

                            <div>
                                <label className="label">
                                    Phone Number <span className="text-municipal-red">*</span>
                                </label>
                                <div className="flex">
                                    <span className="inline-flex items-center px-3 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg text-sm text-gray-600">+233</span>
                                    <input
                                        type="tel"
                                        {...register('phone_number')}
                                        className="input-field rounded-l-none"
                                        placeholder="245678901"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="label">Address</label>
                                <input
                                    type="text"
                                    {...register('address')}
                                    className="input-field"
                                    placeholder="Enter address"
                                />
                            </div>

                            <div>
                                <label className="label">
                                    Gender <span className="text-gray-400 font-normal">(optional)</span>
                                </label>
                                <select {...register('gender')} className="input-field">
                                    <option value="">Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                </select>
                            </div>

                            <div>
                                <label className="label">
                                    Marital Status <span className="text-gray-400 font-normal">(optional)</span>
                                </label>
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
                                <input
                                    type="email"
                                    {...register('email')}
                                    className="input-field"
                                    placeholder="Email"
                                />
                            </div>

                            <div>
                                <label className="label">Ghana Card No</label>
                                <input
                                    type="text"
                                    {...register('ghana_card_no')}
                                    className="input-field"
                                    placeholder="GHA-XXXXXXXXX-X"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <CustomerSearchSelect
                                value={watchedCustomerId}
                                label="Select Existing Business Owner"
                                required={!isNewOwner}
                                error={errors.customer_id?.message as string | undefined}
                                onChange={(id, customer) => {
                                    setValue('customer_id', id || undefined, { shouldValidate: true });
                                    setSelectedCustomerProfile(customer);
                                }}
                            />
                            <input
                                type="hidden"
                                {...register('customer_id', { required: !isNewOwner ? 'Please select a business owner' : false })}
                            />

                            {/* Loading spinner */}
                            {loadingProfile && (
                                <div className="flex items-center space-x-2 text-gray-500 text-sm py-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-municipal-red"></div>
                                    <span>Loading owner details...</span>
                                </div>
                            )}

                            {/* Auto-filled profile card */}
                            {selectedCustomerProfile && !loadingProfile && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                                        <div className="flex items-center space-x-2 mb-3">
                                            <CheckCircle className="w-4 h-4 text-teal-600" />
                                            <span className="text-teal-800 font-semibold text-sm">Business Owner Details Auto-Loaded</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="md:col-span-2 flex items-center space-x-3 bg-white rounded-lg p-3 border border-teal-100">
                                                <div className="w-10 h-10 bg-municipal-red/10 text-municipal-red rounded-full flex items-center justify-center font-bold text-lg">
                                                    {selectedCustomerProfile.full_name?.[0]}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900">{selectedCustomerProfile.full_name}</p>
                                                    <p className="text-xs text-gray-500">{selectedCustomerProfile.gender || '—'} • {selectedCustomerProfile.marital_status || '—'}</p>
                                                </div>
                                            </div>
                                            <div className="bg-white rounded-lg p-3 border border-teal-100">
                                                <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Phone</p>
                                                <p className="text-sm font-semibold text-gray-800">{selectedCustomerProfile.phone_number || '—'}</p>
                                            </div>
                                            <div className="bg-white rounded-lg p-3 border border-teal-100">
                                                <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Email</p>
                                                <p className="text-sm font-semibold text-gray-800">{selectedCustomerProfile.email || '—'}</p>
                                            </div>
                                            {selectedCustomerProfile.ghana_card_no && (
                                                <div className="bg-white rounded-lg p-3 border border-teal-100">
                                                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Ghana Card</p>
                                                    <p className="text-sm font-semibold font-mono text-gray-800">{selectedCustomerProfile.ghana_card_no}</p>
                                                </div>
                                            )}
                                            {selectedCustomerProfile.address && (
                                                <div className="bg-white rounded-lg p-3 border border-teal-100">
                                                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Address</p>
                                                    <p className="text-sm font-semibold text-gray-800">{selectedCustomerProfile.address}</p>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-teal-600 mt-3 italic">✓ This owner's profile will be linked to the business you're registering.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ============================================= */}
                {/* SECTION: Property Information (Business Details) */}
                {/* ============================================= */}
                <div className="card">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 mb-6">
                        <h2 className="text-municipal-teal font-bold text-lg text-center">Property Information</h2>
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
                                Business Category Class <span className="text-gray-400 font-normal">(optional)</span>
                            </label>
                            <select
                                {...register('business_category_class')}
                                className="input-field"
                            >
                                <option value="">Select category</option>
                                <option value="Category A">Category A</option>
                                <option value="Category B">Category B</option>
                                <option value="Category C">Category C</option>
                                <option value="Category D">Category D</option>
                            </select>
                        </div>

                        {/* Fee Schedule Item (from configured fee schedule) */}
                        {feeItems.length > 0 && (
                            <div className="md:col-span-2">
                                <label className="label">
                                    Fee Schedule Item (Configured Rate) <span className="text-gray-400 font-normal">(optional)</span>
                                </label>
                                <select
                                    className="input-field"
                                    value={selectedFeeItemId}
                                    onChange={(e) => {
                                        setSelectedFeeItemId(e.target.value);
                                        if (e.target.value) {
                                            const item = feeItems.find((fi: any) => fi.id === parseInt(e.target.value));
                                            if (item) {
                                                const classVal = watch('business_category_class') || 'Category A';
                                                const letter = classVal.replace('Category ', '').toLowerCase();
                                                const fee =
                                                    item[`cat_${letter}_fee`] ||
                                                    item.cat_a_fee ||
                                                    item.cat_b_fee ||
                                                    item.cat_c_fee ||
                                                    0;
                                                setSelectedFeeAmount(
                                                    fee
                                                        ? `GHS ${Number(fee).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
                                                        : ''
                                                );
                                                if (fee) setAssessedAmount(String(fee));
                                            }
                                        } else {
                                            setSelectedFeeAmount('');
                                        }
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
                                {selectedFeeAmount && (
                                    <p className="text-sm text-green-700 font-medium mt-1">Selected fee: {selectedFeeAmount}</p>
                                )}
                            </div>
                        )}

                        <div className="md:col-span-2">
                            <label className="label">
                                Bill Amount (GHS) <span className="text-municipal-red">*</span>
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="input-field"
                                placeholder="e.g. 500"
                                value={assessedAmount}
                                onChange={(e) => setAssessedAmount(e.target.value)}
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                This amount is saved with the business and used when generating the bill.
                            </p>
                        </div>

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

                {/* ============================================= */}
                {/* SECTION: Location Information */}
                {/* ============================================= */}
                <div className="card">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 mb-6">
                        <h2 className="text-municipal-teal font-bold text-lg text-center">Location Information</h2>
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

                        <div className="md:col-span-2">
                            <div className="flex justify-between items-center mb-2">
                                <label className="label mb-0">Location Coordinates</label>
                                <div className="flex space-x-2">
                                    <button
                                        type="button"
                                        onClick={detectLocation}
                                        disabled={isDetecting}
                                        className="btn-secondary py-1 px-3 text-xs flex items-center space-x-1"
                                    >
                                        {isDetecting ? (
                                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-municipal-red"></div>
                                        ) : (
                                            <Navigation className="w-3 h-3" />
                                        )}
                                        <span>{isDetecting ? 'Detecting...' : 'Detect GPS'}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowMap(!showMap)}
                                        className={`py-1 px-3 text-xs flex items-center space-x-1 rounded-md transition-all ${showMap
                                            ? 'bg-municipal-red text-white hover:bg-red-700'
                                            : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
                                            }`}
                                    >
                                        {showMap ? <X className="w-3 h-3" /> : <MapIcon className="w-3 h-3" />}
                                        <span>{showMap ? 'Close Map' : 'Select on Map'}</span>
                                    </button>
                                </div>
                            </div>

                            {showMap && (
                                <div className="mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <p className="text-xs text-blue-600 mb-2 font-medium">Click on the map to pin the exact location.</p>
                                    <MapSelector
                                        onLocationSelectAction={async (lat: number, lng: number) => {
                                            setValue('latitude', parseFloat(lat.toFixed(6)));
                                            setValue('longitude', parseFloat(lng.toFixed(6)));
                                            setLocationAccuracy(null);
                                            
                                            // Attempt reverse geocoding
                                            try {
                                                const geoData = await reverseGeocode(lat, lng);
                                                if (geoData) {
                                                    const geo = formatGeoAddress(geoData);
                                                    if (geo.town) setValue('town', geo.town);
                                                    if (geo.street) setValue('street_name', geo.street);
                                                    if (geo.landmark) setValue('landmark', geo.landmark);
                                                    if (!watch('gps_address')) {
                                                        setValue('gps_address', `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
                                                    }
                                                }
                                            } catch (err) {
                                                console.error('Auto-address from map failed:', err);
                                            }
                                        }}
                                        initialLat={toCoord(watch('latitude'))}
                                        initialLng={toCoord(watch('longitude'))}
                                        accuracy={locationAccuracy || undefined}
                                    />
                                    {locationAccuracy && locationAccuracy > 100 && (
                                        <div className="mt-2 text-xs bg-yellow-50 text-yellow-700 p-2 rounded border border-yellow-200 flex items-center">
                                            <AlertCircle className="w-3 h-3 mr-1" />
                                            Low GPS precision ({Math.round(locationAccuracy)}m). Please adjust the pin on the map if needed.
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block uppercase tracking-wider font-bold italic">Latitude</label>
                                    <input
                                        type="number"
                                        step="any"
                                        {...register('latitude', { valueAsNumber: true })}
                                        className="input-field"
                                        placeholder="5.6037"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block uppercase tracking-wider font-bold italic">Longitude</label>
                                    <input
                                        type="number"
                                        step="any"
                                        {...register('longitude', { valueAsNumber: true })}
                                        className="input-field"
                                        placeholder="-0.1870"
                                    />
                                </div>
                            </div>
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
                            <label className="label">Electoral Area <span className="text-gray-400 font-normal">(optional)</span></label>
                            <select {...register('electoral_area_id')} className="input-field">
                                <option value="">Select Electoral Area</option>
                                {electoralAreas.map((area: any) => (
                                    <option key={area.id} value={area.id}>
                                        {area.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="label">Local Area / Community <span className="text-gray-400 font-normal">(optional)</span></label>
                            <select {...register('local_area_id')} className="input-field">
                                <option value="">
                                    {!toNullableId(selectedElectoralArea)
                                        ? 'Select electoral area first'
                                        : localAreas.length === 0
                                          ? 'No communities for this area yet'
                                          : 'Select Local Area'}
                                </option>
                                {localAreas.map((area: any) => (
                                    <option key={area.id} value={area.id}>
                                        {area.name}
                                    </option>
                                ))}
                            </select>
                            {!toNullableId(selectedElectoralArea) ? (
                                <p className="text-xs text-gray-500 mt-1">Choose an electoral area above to load communities.</p>
                            ) : localAreas.length === 0 ? (
                                <p className="text-xs text-amber-700 mt-1">
                                    No communities linked yet. An admin can add them under Administration → Areas & Communities.
                                </p>
                            ) : null}
                        </div>
                    </div>
                </div>

                {/* ============================================= */}
                {/* Submit */}
                {/* ============================================= */}
                <div className="flex justify-end space-x-4">
                    <Link href="/businesses" className="btn-secondary">
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn-primary flex items-center space-x-2 px-8"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span>Submitting...</span>
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                <span>Submit</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
