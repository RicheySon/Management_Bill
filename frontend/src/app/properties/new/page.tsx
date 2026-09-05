'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import {
    createProperty,
    createCustomer,
    fetchCustomer,
    fetchPropertyClassifications,
    fetchElectoralAreas,
    fetchLocalAreas,
    fetchActivePropertyRateZones,
    reverseGeocode,
    formatGeoAddress,
} from '@/lib/api-client';
import { toCoord } from '@/lib/geo';
import { ArrowLeft, Save, UserPlus, UserCheck, MapPin, Navigation, Map as MapIcon, X, Phone, Mail, User, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import CustomerSearchSelect from '@/components/CustomerSearchSelect';

const toNullableId = (v: any) =>
    (v === '' || v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v));

/** Empty / NaN number inputs become null so optional fields never block submit */
const toOptionalNumber = (v: any) => {
    if (v === '' || v === undefined || v === null) return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
};

const MapSelector = dynamic(() => import('@/components/MapSelector'), {
    ssr: false,
    loading: () => <div className="h-[400px] w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-500">Loading Map...</div>
});

interface PropertyForm {
    // Rate Payer fields
    full_name: string;
    phone_number: string;
    address?: string;
    gender?: string;
    marital_status?: string;
    email?: string;
    next_of_kin_name?: string;
    next_of_kin_contact?: string;
    // Property fields
    customer_id?: string;
    classification_id: number;
    property_use?: string;
    building_type?: string;
    no_of_storeys?: number;
    ownership?: string;
    building_permit_status?: string;
    account_number?: string;
    parcel_number?: string;
    house_number?: string;
    source_of_water?: string;
    sanitation_facility?: string;
    solid_waste_disposal?: string;
    liquid_waste_disposal?: string;
    no_of_people?: number;
    no_of_bedrooms?: number;
    no_of_washrooms?: number;
    no_of_other_rooms?: number;
    // Location fields
    gps_address?: string;
    latitude?: number;
    longitude?: number;
    town?: string;
    street_name?: string;
    landmark?: string;
    electoral_area_id?: number;
    local_area_id?: number;
    population_density?: string;
    property_size?: number;
}

export default function NewPropertyPage() {
    const router = useRouter();
    const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<PropertyForm>();

    const [classifications, setClassifications] = useState([]);
    const [electoralAreas, setElectoralAreas] = useState([]);
    const [localAreas, setLocalAreas] = useState([]);
    const [rateZones, setRateZones] = useState<any[]>([]);
    const [selectedRateZoneId, setSelectedRateZoneId] = useState<string>('');
    const [selectedRateInfo, setSelectedRateInfo] = useState<string>('');
    const [assessedAmount, setAssessedAmount] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [propertyNumber, setPropertyNumber] = useState<string | null>(null);
    const [isNewRatePayer, setIsNewRatePayer] = useState(true);
    const [isDetecting, setIsDetecting] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
    const [selectedCustomerProfile, setSelectedCustomerProfile] = useState<any>(null);
    const [loadingProfile, setLoadingProfile] = useState(false);

    const watchedCustomerId = watch('customer_id');
    const selectedElectoralArea = watch('electoral_area_id');

    // Auto-fetch customer profile when existing rate payer is selected
    useEffect(() => {
        if (!isNewRatePayer && watchedCustomerId) {
            const fetchProfile = async () => {
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
            fetchProfile();
        } else if (isNewRatePayer) {
            setSelectedCustomerProfile(null);
        }
    }, [watchedCustomerId, isNewRatePayer]);

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
                
                if (acc > 100) {
                    console.warn(`Low GPS accuracy: ${acc} meters`);
                }
                
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
                const [classificationsData, areasData, rateZonesData] = await Promise.all([
                    fetchPropertyClassifications(),
                    fetchElectoralAreas(),
                    fetchActivePropertyRateZones(new Date().getFullYear()),
                ]);
                setClassifications(classificationsData || []);
                setElectoralAreas(areasData || []);
                setRateZones(rateZonesData || []);
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

    const onSubmit = async (data: PropertyForm) => {
        setError(null);
        try {
            let customerId = data.customer_id;

            // If creating new rate payer, register them first
            if (isNewRatePayer) {
                if (!data.full_name || !data.phone_number) {
                    setError('Full Name and Phone Number are required for new rate payer');
                    return;
                }
                const customerResult = await createCustomer({
                    full_name: data.full_name,
                    phone_number: data.phone_number,
                    email: data.email,
                    address: data.address,
                    gender: data.gender,
                    marital_status: data.marital_status,
                    next_of_kin_name: data.next_of_kin_name,
                    next_of_kin_contact: data.next_of_kin_contact,
                });
                customerId = customerResult.data.id;
            }

            if (!customerId) {
                setError('Please select an existing rate payer or create a new one');
                return;
            }

            if (!toNullableId(data.classification_id)) {
                setError('Please select a property class');
                return;
            }

            const billAmount = toOptionalNumber(assessedAmount);
            if (billAmount === null || billAmount <= 0) {
                setError('Please enter a bill amount greater than zero');
                return;
            }

            const propertyResult = await createProperty({
                customer_id: customerId,
                classification_id: toNullableId(data.classification_id),
                property_use: data.property_use || null,
                building_type: data.building_type || null,
                no_of_storeys: toOptionalNumber(data.no_of_storeys),
                ownership: data.ownership || null,
                building_permit_status: data.building_permit_status || null,
                account_number: data.account_number || null,
                parcel_number: data.parcel_number || null,
                house_number: data.house_number || null,
                source_of_water: data.source_of_water || null,
                sanitation_facility: data.sanitation_facility || null,
                solid_waste_disposal: data.solid_waste_disposal || null,
                liquid_waste_disposal: data.liquid_waste_disposal || null,
                no_of_people: toOptionalNumber(data.no_of_people),
                no_of_bedrooms: toOptionalNumber(data.no_of_bedrooms),
                no_of_washrooms: toOptionalNumber(data.no_of_washrooms),
                no_of_other_rooms: toOptionalNumber(data.no_of_other_rooms),
                gps_address: data.gps_address || null,
                latitude: toOptionalNumber(data.latitude),
                longitude: toOptionalNumber(data.longitude),
                town: data.town || null,
                street_name: data.street_name || null,
                landmark: data.landmark || null,
                electoral_area_id: toNullableId(data.electoral_area_id),
                local_area_id: toNullableId(data.local_area_id),
                population_density: data.population_density || null,
                property_size: toOptionalNumber(data.property_size),
                property_rate_zone_id: selectedRateZoneId ? parseInt(selectedRateZoneId) : null,
                assessed_amount: billAmount,
            });

            setPropertyNumber(propertyResult.data.property_number);
            setSuccess(true);

            setTimeout(() => {
                router.push(`/properties/${propertyResult.data.id}`);
            }, 2000);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to register property');
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">New Property</h1>
                    <p className="text-gray-600 mt-1">Register a new property with rate payer details</p>
                </div>
                <Link href="/properties" className="btn-secondary flex items-center space-x-2">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Go back</span>
                </Link>
            </div>

            {success && propertyNumber && (
                <div className="bg-green-50 border-2 border-green-500 text-green-800 px-6 py-4 rounded-lg mb-6">
                    <p className="font-semibold">Property registered successfully!</p>
                    <p className="text-sm mt-1">Property Number: <span className="font-mono font-bold">{propertyNumber}</span></p>
                    <p className="text-sm">Redirecting...</p>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border-2 border-municipal-red text-red-800 px-6 py-4 rounded-lg mb-6">
                    <p className="font-semibold">Error</p>
                    <p className="text-sm">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
                {/* ============================================= */}
                {/* Rate Payer Toggle */}
                {/* ============================================= */}
                <div className="flex space-x-2">
                    <button
                        type="button"
                        onClick={() => setIsNewRatePayer(true)}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isNewRatePayer ? 'bg-municipal-teal text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        <UserPlus className="w-4 h-4" />
                        <span>New Rate Payer</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsNewRatePayer(false)}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${!isNewRatePayer ? 'bg-municipal-teal text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        <UserCheck className="w-4 h-4" />
                        <span>Existing Rate Payer</span>
                    </button>
                </div>

                {/* ============================================= */}
                {/* SECTION: Rate Payer Information */}
                {/* ============================================= */}
                <div className="card">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 mb-6">
                        <h2 className="text-municipal-teal font-bold text-lg text-center">Rate Payer Information</h2>
                        <p className="text-center text-sm text-gray-600 mt-1">
                            Only <span className="text-municipal-red font-semibold">*</span> fields are required (Full Name and Phone).
                        </p>
                    </div>

                    {isNewRatePayer ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="md:col-span-2">
                                <label className="label">
                                    Full Name <span className="text-municipal-red">*</span>
                                </label>
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
                                <label className="label">Next of Kin</label>
                                <input
                                    type="text"
                                    {...register('next_of_kin_name')}
                                    className="input-field"
                                    placeholder="Full name"
                                />
                            </div>

                            <div>
                                <label className="label">
                                    Next of Kin Contact <span className="text-gray-400 font-normal">(optional)</span>
                                </label>
                                <div className="flex">
                                    <span className="inline-flex items-center px-3 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg text-sm text-gray-600">+233</span>
                                    <input
                                        type="tel"
                                        {...register('next_of_kin_contact')}
                                        className="input-field rounded-l-none"
                                        placeholder="245678901"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <CustomerSearchSelect
                                value={watchedCustomerId}
                                label="Select Existing Rate Payer"
                                required={!isNewRatePayer}
                                error={errors.customer_id?.message as string | undefined}
                                onChange={(id, customer) => {
                                    setValue('customer_id', id || undefined, { shouldValidate: true });
                                    setSelectedCustomerProfile(customer);
                                }}
                            />
                            <input
                                type="hidden"
                                {...register('customer_id', { required: !isNewRatePayer ? 'Please select a rate payer' : false })}
                            />

                            {/* Loading spinner */}
                            {loadingProfile && (
                                <div className="flex items-center space-x-2 text-gray-500 text-sm py-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-municipal-red"></div>
                                    <span>Loading rate payer details...</span>
                                </div>
                            )}

                            {/* Auto-filled profile card */}
                            {selectedCustomerProfile && !loadingProfile && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                                        <div className="flex items-center space-x-2 mb-3">
                                            <CheckCircle className="w-4 h-4 text-teal-600" />
                                            <span className="text-teal-800 font-semibold text-sm">Rate Payer Details Auto-Loaded</span>
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
                                            {selectedCustomerProfile.next_of_kin_name && (
                                                <div className="bg-white rounded-lg p-3 border border-teal-100">
                                                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Next of Kin</p>
                                                    <p className="text-sm font-semibold text-gray-800">{selectedCustomerProfile.next_of_kin_name}</p>
                                                    {selectedCustomerProfile.next_of_kin_contact && (
                                                        <p className="text-xs text-gray-500">{selectedCustomerProfile.next_of_kin_contact}</p>
                                                    )}
                                                </div>
                                            )}
                                            {selectedCustomerProfile.ghana_card_no && (
                                                <div className="bg-white rounded-lg p-3 border border-teal-100">
                                                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Ghana Card</p>
                                                    <p className="text-sm font-semibold font-mono text-gray-800">{selectedCustomerProfile.ghana_card_no}</p>
                                                </div>
                                            )}
                                            {selectedCustomerProfile.gps_address && (
                                                <div className="bg-white rounded-lg p-3 border border-teal-100">
                                                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">GPS Address</p>
                                                    <p className="text-sm font-semibold font-mono text-gray-800">{selectedCustomerProfile.gps_address}</p>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-teal-600 mt-3 italic">✓ This customer's profile will be linked to the property you're registering.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ============================================= */}
                {/* SECTION: Property Information */}
                {/* ============================================= */}
                <div className="card">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 mb-6">
                        <h2 className="text-municipal-teal font-bold text-lg text-center">Property Information</h2>
                        <p className="text-center text-sm text-gray-600 mt-1">
                            Only fields marked <span className="text-municipal-red font-semibold">*</span> are required. Everything else can be left blank.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="label">Property Use <span className="text-gray-400 font-normal">(optional)</span></label>
                            <select {...register('property_use')} className="input-field">
                                <option value="">Select option</option>
                                <option value="Residential">Residential</option>
                                <option value="Commercial">Commercial</option>
                                <option value="Mixed Use">Mixed Use</option>
                                <option value="Industrial">Industrial</option>
                                <option value="Agricultural">Agricultural</option>
                                <option value="Institutional">Institutional</option>
                            </select>
                        </div>

                        <div>
                            <label className="label">
                                Property Class <span className="text-municipal-red">*</span>
                            </label>
                            <select
                                {...register('classification_id', { required: 'Please select property class' })}
                                className="input-field"
                            >
                                <option value="">Select option</option>
                                {classifications.map((c: any) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                            {errors.classification_id && (
                                <p className="text-red-500 text-sm mt-1">{errors.classification_id.message}</p>
                            )}
                        </div>

                        {/* Rating Zone (from configured fee schedule) */}
                        {rateZones.length > 0 && (
                            <div>
                                <label className="label">Rating Zone (Fee Schedule)</label>
                                <select
                                    className="input-field"
                                    value={selectedRateZoneId}
                                    onChange={(e) => {
                                        setSelectedRateZoneId(e.target.value);
                                        if (e.target.value) {
                                            const zone = rateZones.find((z: any) => z.id === parseInt(e.target.value));
                                            if (zone) {
                                                const rateStr = zone.rate_impost_max
                                                    ? `${zone.rate_impost_min} - ${zone.rate_impost_max}`
                                                    : `${zone.rate_impost_min}`;
                                                const minStr = zone.minimum_rate_max
                                                    ? `GHS ${Number(zone.minimum_rate_min).toLocaleString()} - ${Number(zone.minimum_rate_max).toLocaleString()}`
                                                    : `GHS ${Number(zone.minimum_rate_min).toLocaleString()}`;
                                                setSelectedRateInfo(`Rate Impost: ${rateStr} | Min: ${minStr}`);
                                                // Prefill bill amount with zone minimum so it persists on the bill
                                                if (zone.minimum_rate_min != null && zone.minimum_rate_min !== '') {
                                                    setAssessedAmount(String(zone.minimum_rate_min));
                                                }
                                            }
                                        } else {
                                            setSelectedRateInfo('');
                                        }
                                    }}
                                >
                                    <option value="">Select rating zone (optional)</option>
                                    {rateZones.map((zone: any) => (
                                        <option key={zone.id} value={zone.id}>
                                            {zone.zone_name} ({zone.zone_type}) - Min: GHS {Number(zone.minimum_rate_min).toLocaleString()}
                                        </option>
                                    ))}
                                </select>
                                {selectedRateInfo && (
                                    <p className="text-sm text-green-700 font-medium mt-1">{selectedRateInfo}</p>
                                )}
                            </div>
                        )}

                        <div>
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
                                This amount is saved with the property and used when generating the bill.
                            </p>
                        </div>

                        <div>
                            <label className="label">Building Type <span className="text-gray-400 font-normal">(optional)</span></label>
                            <select {...register('building_type')} className="input-field">
                                <option value="">Select option</option>
                                <option value="Bungalow">Bungalow</option>
                                <option value="Story Building">Story Building</option>
                                <option value="Flat/Apartment">Flat/Apartment</option>
                                <option value="Compound House">Compound House</option>
                                <option value="Semi-detached">Semi-detached</option>
                                <option value="Detached">Detached</option>
                                <option value="Kiosk/Container">Kiosk/Container</option>
                                <option value="Temporary Structure">Temporary Structure</option>
                            </select>
                        </div>

                        <div>
                            <label className="label">No of Storeys <span className="text-gray-400 font-normal">(optional)</span></label>
                            <select {...register('no_of_storeys')} className="input-field">
                                <option value="">Select option</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4">4</option>
                                <option value="5">5+</option>
                            </select>
                        </div>

                        <div>
                            <label className="label">Ownership of Property <span className="text-gray-400 font-normal">(optional)</span></label>
                            <select {...register('ownership')} className="input-field">
                                <option value="">Select option</option>
                                <option value="Owner Occupied">Owner Occupied</option>
                                <option value="Rented">Rented</option>
                                <option value="Family Property">Family Property</option>
                                <option value="Government">Government</option>
                                <option value="Leased">Leased</option>
                            </select>
                        </div>

                        <div>
                            <label className="label">Building Permit Status <span className="text-gray-400 font-normal">(optional)</span></label>
                            <select {...register('building_permit_status')} className="input-field">
                                <option value="">Select option</option>
                                <option value="Approved">Approved</option>
                                <option value="Pending">Pending</option>
                                <option value="None">None</option>
                                <option value="Expired">Expired</option>
                            </select>
                        </div>

                        <div>
                            <label className="label">Account Number <span className="text-gray-400 font-normal">(optional)</span></label>
                            <input
                                type="text"
                                {...register('account_number')}
                                className="input-field"
                                placeholder="Account no"
                            />
                        </div>

                        <div>
                            <label className="label">Parcel Number <span className="text-gray-400 font-normal">(optional)</span></label>
                            <input
                                type="text"
                                {...register('parcel_number')}
                                className="input-field"
                                placeholder="Parcel no"
                            />
                        </div>

                        <div>
                            <label className="label">House Number <span className="text-gray-400 font-normal">(optional)</span></label>
                            <input
                                type="text"
                                {...register('house_number')}
                                className="input-field"
                                placeholder="House no"
                            />
                        </div>

                        <div>
                            <label className="label">Source of Water <span className="text-gray-400 font-normal">(optional)</span></label>
                            <select {...register('source_of_water')} className="input-field">
                                <option value="">Select option</option>
                                <option value="Pipe-borne">Pipe-borne</option>
                                <option value="Borehole">Borehole</option>
                                <option value="Well">Well</option>
                                <option value="Tanker">Tanker</option>
                                <option value="Sachet/Bottled">Sachet/Bottled</option>
                                <option value="River/Stream">River/Stream</option>
                            </select>
                        </div>

                        <div>
                            <label className="label">Sanitation Facility Available <span className="text-gray-400 font-normal">(optional)</span></label>
                            <select {...register('sanitation_facility')} className="input-field">
                                <option value="">Select option</option>
                                <option value="WC">WC (Water Closet)</option>
                                <option value="KVIP">KVIP</option>
                                <option value="Pit Latrine">Pit Latrine</option>
                                <option value="Public Toilet">Public Toilet</option>
                                <option value="None">None</option>
                            </select>
                        </div>

                        <div>
                            <label className="label">Solid Waste Disposal Method <span className="text-gray-400 font-normal">(optional)</span></label>
                            <select {...register('solid_waste_disposal')} className="input-field">
                                <option value="">Select option</option>
                                <option value="Collected">Collected</option>
                                <option value="Public Container">Public Container</option>
                                <option value="Dumped">Dumped</option>
                                <option value="Burned">Burned</option>
                                <option value="Buried">Buried</option>
                            </select>
                        </div>

                        <div>
                            <label className="label">Liquid Waste Disposal Method <span className="text-gray-400 font-normal">(optional)</span></label>
                            <select {...register('liquid_waste_disposal')} className="input-field">
                                <option value="">Select option</option>
                                <option value="Sewer">Sewer</option>
                                <option value="Septic Tank">Septic Tank</option>
                                <option value="Open Drain">Open Drain</option>
                                <option value="Soakaway">Soakaway</option>
                                <option value="None">None</option>
                            </select>
                        </div>

                        <div>
                            <label className="label">No of People <span className="text-gray-400 font-normal">(optional)</span></label>
                            <input
                                type="number"
                                min="0"
                                {...register('no_of_people')}
                                className="input-field"
                                placeholder="Optional"
                            />
                        </div>

                        <div>
                            <label className="label">No of Bedrooms <span className="text-gray-400 font-normal">(optional)</span></label>
                            <input
                                type="number"
                                min="0"
                                {...register('no_of_bedrooms')}
                                className="input-field"
                                placeholder="Optional"
                            />
                        </div>

                        <div>
                            <label className="label">No of Washrooms <span className="text-gray-400 font-normal">(optional)</span></label>
                            <input
                                type="number"
                                min="0"
                                {...register('no_of_washrooms')}
                                className="input-field"
                                placeholder="Optional"
                            />
                        </div>

                        <div>
                            <label className="label">No of Other Rooms <span className="text-gray-400 font-normal">(optional)</span></label>
                            <input
                                type="number"
                                min="0"
                                {...register('no_of_other_rooms')}
                                className="input-field"
                                placeholder="Optional"
                            />
                        </div>

                        <div>
                            <label className="label">Property Size (sqm) <span className="text-gray-400 font-normal">(optional)</span></label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                {...register('property_size')}
                                className="input-field"
                                placeholder="Optional"
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
                            <label className="label">GPS Address <span className="text-gray-400 font-normal">(optional)</span></label>
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
                                            setLocationAccuracy(null); // Manual selection clears accuracy warning
                                            
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
                                        {...register('latitude')}
                                        className="input-field"
                                        placeholder="5.6037"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block uppercase tracking-wider font-bold italic">Longitude</label>
                                    <input
                                        type="number"
                                        step="any"
                                        {...register('longitude')}
                                        className="input-field"
                                        placeholder="-0.1870"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="label">Town <span className="text-gray-400 font-normal">(optional)</span></label>
                            <input
                                type="text"
                                {...register('town')}
                                className="input-field"
                                placeholder="Town"
                            />
                        </div>

                        <div>
                            <label className="label">Street Name <span className="text-gray-400 font-normal">(optional)</span></label>
                            <input
                                type="text"
                                {...register('street_name')}
                                className="input-field"
                                placeholder="Name of street"
                            />
                        </div>

                        <div>
                            <label className="label">Landmark <span className="text-gray-400 font-normal">(optional)</span></label>
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

                        <div>
                            <label className="label">Population Density of Location <span className="text-gray-400 font-normal">(optional)</span></label>
                            <select {...register('population_density')} className="input-field">
                                <option value="">Select option</option>
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* ============================================= */}
                {/* Submit */}
                {/* ============================================= */}
                <div className="flex justify-end space-x-4">
                    <Link href="/properties" className="btn-secondary">
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
