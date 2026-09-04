'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { createCustomer, fetchElectoralAreas, fetchLocalAreas, reverseGeocode, formatGeoAddress } from '@/lib/api-client';
import { toCoord } from '@/lib/geo';
import { ArrowLeft, Save, Navigation, Map as MapIcon, X, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const toNullableId = (v: any) =>
    (v === '' || v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v));

const MapSelector = dynamic(() => import('@/components/MapSelector'), {
    ssr: false,
    loading: () => (
        <div className="h-[400px] w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-500">
            Loading Map...
        </div>
    ),
});

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
    gender?: string;
    marital_status?: string;
    next_of_kin_name?: string;
    next_of_kin_contact?: string;
    ghana_card_no?: string;
}

export default function NewCustomerPage() {
    const router = useRouter();
    const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<CustomerForm>();

    const [electoralAreas, setElectoralAreas] = useState<any[]>([]);
    const [localAreas, setLocalAreas] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isDetecting, setIsDetecting] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
    const prevElectoralAreaRef = useRef<number | null>(null);

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
                const acc = position.coords.accuracy;
                
                setValue('latitude', parseFloat(lat.toFixed(6)));
                setValue('longitude', parseFloat(lng.toFixed(6)));
                setLocationAccuracy(acc);
                
                // Attempt reverse geocoding
                try {
                    const geoData = await reverseGeocode(lat, lng);
                    if (geoData) {
                        const geo = formatGeoAddress(geoData);
                        if (geo.label) setValue('physical_location', geo.label);
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
            (err) => {
                alert(err.code === 1 ? 'Location permission was denied. Allow location for this site, or use “Select on Map”.' : `Failed to get location: ${err.message}. You can use “Select on Map” instead.`);
                setIsDetecting(false);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    useEffect(() => {
        const loadLookups = async () => {
            try {
                const areas = await fetchElectoralAreas();
                if (Array.isArray(areas)) setElectoralAreas(areas);
            } catch (err) {
                console.error('Failed to load electoral areas:', err);
                setError('Failed to connect to backend service');
            }
        };
        loadLookups();
    }, []);

    useEffect(() => {
        if (!selectedElectoralArea) {
            setLocalAreas([]);
            setValue('local_area_id', undefined);
            prevElectoralAreaRef.current = null;
            return;
        }
        const areaId = Number(selectedElectoralArea);
        if (Number.isNaN(areaId)) {
            setLocalAreas([]);
            return;
        }
        fetchLocalAreas(areaId)
            .then(areas => {
                setLocalAreas(Array.isArray(areas) ? areas : []);
                if (prevElectoralAreaRef.current !== null && prevElectoralAreaRef.current !== areaId) {
                    setValue('local_area_id', undefined);
                }
                prevElectoralAreaRef.current = areaId;
            })
            .catch(() => setLocalAreas([]));
    }, [selectedElectoralArea, setValue]);

    const onSubmit = async (data: CustomerForm) => {
        setError(null);
        try {
            const result = await createCustomer({
                ...data,
                electoral_area_id: toNullableId(data.electoral_area_id) as any,
                local_area_id: toNullableId(data.local_area_id) as any,
            });
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

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                {/* Personal Information */}
                <div className="card">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 mb-6 text-center">
                        <h2 className="text-municipal-teal font-bold text-lg">Personal Information</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="label">Full Name <span className="text-municipal-red">*</span></label>
                            <input
                                type="text"
                                {...register('full_name', { required: 'Full name is required' })}
                                className="input-field"
                                placeholder="Enter full name"
                            />
                            {errors.full_name && <p className="text-red-500 text-sm mt-1">{errors.full_name.message}</p>}
                        </div>

                        <div>
                            <label className="label">Phone Number <span className="text-municipal-red">*</span></label>
                            <div className="flex">
                                <span className="inline-flex items-center px-3 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg text-sm text-gray-600">+233</span>
                                <input
                                    type="tel"
                                    {...register('phone_number', { required: 'Phone number is required' })}
                                    className="input-field rounded-l-none"
                                    placeholder="245678901"
                                />
                            </div>
                            {errors.phone_number && <p className="text-red-500 text-sm mt-1">{errors.phone_number.message}</p>}
                        </div>

                        <div>
                            <label className="label">Email (Optional)</label>
                            <input
                                type="email"
                                {...register('email')}
                                className="input-field"
                                placeholder="customer@email.com"
                            />
                        </div>

                        <div>
                            <label className="label">Gender</label>
                            <select {...register('gender')} className="input-field">
                                <option value="">Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                            </select>
                        </div>

                        <div>
                            <label className="label">Marital Status</label>
                            <select {...register('marital_status')} className="input-field">
                                <option value="">Select Marital Status</option>
                                <option value="Single">Single</option>
                                <option value="Married">Married</option>
                                <option value="Divorced">Divorced</option>
                                <option value="Widowed">Widowed</option>
                            </select>
                        </div>

                        <div>
                            <label className="label">Ghana Card No.</label>
                            <input
                                type="text"
                                {...register('ghana_card_no')}
                                className="input-field"
                                placeholder="GHA-XXXXXXXXX-X"
                            />
                        </div>

                        <div>
                            <label className="label">Next of Kin Name</label>
                            <input
                                type="text"
                                {...register('next_of_kin_name')}
                                className="input-field"
                                placeholder="Full name"
                            />
                        </div>

                        <div>
                            <label className="label">Next of Kin Contact</label>
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
                </div>

                {/* Location Information */}
                <div className="card">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 mb-6 text-center">
                        <h2 className="text-municipal-teal font-bold text-lg">Location Information</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="label font-mono tracking-tighter">GPS ADDRESS</label>
                            <input
                                type="text"
                                {...register('gps_address')}
                                className="input-field font-mono"
                                placeholder="GG-845-8731"
                            />
                        </div>

                        {/* Coordinates Row */}
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
                                        {isDetecting
                                            ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-municipal-red" />
                                            : <Navigation className="w-3 h-3" />
                                        }
                                        <span>{isDetecting ? 'Detecting...' : 'Detect GPS'}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowMap(!showMap)}
                                        className={`py-1 px-3 text-xs flex items-center space-x-1 rounded-md transition-all ${showMap
                                            ? 'bg-municipal-red text-white hover:bg-red-700'
                                            : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'}`}
                                    >
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
                                            setLocationAccuracy(null);
                                            
                                            // Attempt reverse geocoding
                                            try {
                                                const geoData = await reverseGeocode(lat, lng);
                                                if (geoData) {
                                                    const geo = formatGeoAddress(geoData);
                                                    if (geo.label) setValue('physical_location', geo.label);
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
                            <label className="label">Electoral Area</label>
                            <select {...register('electoral_area_id')} className="input-field">
                                <option value="">Select Electoral Area</option>
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

                        <div className="md:col-span-2">
                            <label className="label">Physical Location / Street Name</label>
                            <input
                                type="text"
                                {...register('physical_location')}
                                className="input-field"
                                placeholder="NII AYI KUSHIE ST"
                            />
                        </div>

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
                </div>

                <div className="flex justify-end space-x-4 pt-2">
                    <Link href="/customers" className="btn-secondary">Cancel</Link>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn-primary flex items-center space-x-2 px-8"
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
