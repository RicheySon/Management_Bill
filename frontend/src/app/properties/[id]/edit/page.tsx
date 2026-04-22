'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import {
    fetchProperty,
    updateProperty,
    updateCustomer,
    fetchPropertyClassifications,
    fetchElectoralAreas,
    fetchLocalAreas,
    fetchActivePropertyRateZones,
    reverseGeocode,
} from '@/lib/api-client';
import { ArrowLeft, Save, Navigation, Map as MapIcon, X, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const MapSelector = dynamic(() => import('@/components/MapSelector'), {
    ssr: false,
    loading: () => <div className="h-[400px] w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-500">Loading Map...</div>
});

interface PropertyEditForm {
    // Rate Payer fields
    full_name: string;
    phone_number: string;
    email?: string;
    gender?: string;
    marital_status?: string;
    next_of_kin_name?: string;
    next_of_kin_contact?: string;
    ghana_card_no?: string;
    // Property fields
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
    property_size?: number;
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
    property_rate_zone_id?: number;
}

export default function EditPropertyPage() {
    const router = useRouter();
    const { id } = useParams();
    const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<PropertyEditForm>();

    const [classifications, setClassifications] = useState([]);
    const [electoralAreas, setElectoralAreas] = useState([]);
    const [localAreas, setLocalAreas] = useState([]);
    const [rateZones, setRateZones] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(true);
    const [customerId, setCustomerId] = useState<string | null>(null);
    const [selectedRateZoneId, setSelectedRateZoneId] = useState<string>('');
    const [isDetecting, setIsDetecting] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);

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
                const [propertyData, classificationsData, areasData, rateZonesData] = await Promise.all([
                    fetchProperty(id as string),
                    fetchPropertyClassifications(),
                    fetchElectoralAreas(),
                    fetchActivePropertyRateZones(new Date().getFullYear()),
                ]);

                const p = propertyData.property;
                const c = propertyData.customer;

                // Fill property fields
                Object.keys(p).forEach(key => {
                    if (key !== 'id' && key !== 'created_at' && key !== 'updated_at') {
                        setValue(key as any, p[key]);
                    }
                });

                // Fill rate payer fields from linked customer
                if (c) {
                    setCustomerId(c.id);
                    setValue('full_name', c.full_name || '');
                    setValue('phone_number', c.phone_number || '');
                    setValue('email', c.email || '');
                    setValue('gender', c.gender || '');
                    setValue('marital_status', c.marital_status || '');
                    setValue('next_of_kin_name', c.next_of_kin_name || '');
                    setValue('next_of_kin_contact', c.next_of_kin_contact || '');
                    setValue('ghana_card_no', c.ghana_card_no || '');
                }

                if (p.property_rate_zone_id) {
                    setSelectedRateZoneId(p.property_rate_zone_id.toString());
                }

                setClassifications(classificationsData);
                setElectoralAreas(areasData);
                setRateZones(rateZonesData || []);

                if (p.electoral_area_id) {
                    const locals = await fetchLocalAreas(p.electoral_area_id);
                    setLocalAreas(locals);
                    setValue('local_area_id', p.local_area_id);
                }
            } catch (err: any) {
                console.error('Failed to load property data:', err);
                setError('Failed to load property data');
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

    const onSubmit = async (data: PropertyEditForm) => {
        setError(null);
        try {
            // Update the rate payer (customer) details alongside the property
            if (customerId) {
                await updateCustomer(customerId, {
                    full_name: data.full_name,
                    phone_number: data.phone_number,
                    email: data.email,
                    gender: data.gender,
                    marital_status: data.marital_status,
                    next_of_kin_name: data.next_of_kin_name,
                    next_of_kin_contact: data.next_of_kin_contact,
                    ghana_card_no: data.ghana_card_no,
                });
            }

            // Update property
            await updateProperty(id as string, {
                classification_id: data.classification_id,
                property_use: data.property_use,
                building_type: data.building_type,
                no_of_storeys: data.no_of_storeys,
                ownership: data.ownership,
                building_permit_status: data.building_permit_status,
                account_number: data.account_number,
                parcel_number: data.parcel_number,
                house_number: data.house_number,
                source_of_water: data.source_of_water,
                sanitation_facility: data.sanitation_facility,
                solid_waste_disposal: data.solid_waste_disposal,
                liquid_waste_disposal: data.liquid_waste_disposal,
                no_of_people: data.no_of_people,
                no_of_bedrooms: data.no_of_bedrooms,
                no_of_washrooms: data.no_of_washrooms,
                no_of_other_rooms: data.no_of_other_rooms,
                property_size: data.property_size,
                gps_address: data.gps_address,
                latitude: data.latitude,
                longitude: data.longitude,
                town: data.town,
                street_name: data.street_name,
                landmark: data.landmark,
                electoral_area_id: data.electoral_area_id,
                local_area_id: data.local_area_id,
                population_density: data.population_density,
                property_rate_zone_id: selectedRateZoneId ? parseInt(selectedRateZoneId) : null,
            });

            setSuccess(true);
            setTimeout(() => { router.push(`/properties/${id}`); }, 1500);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to update property');
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
                    <h1 className="text-3xl font-bold text-gray-900">Edit Property</h1>
                    <p className="text-gray-600 mt-1">Update all property and rate payer details</p>
                </div>
                <Link href={`/properties/${id}`} className="btn-secondary flex items-center space-x-2">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Cancel</span>
                </Link>
            </div>

            {success && (
                <div className="bg-green-50 border-2 border-green-500 text-green-800 px-6 py-4 rounded-lg mb-6">
                    <p className="font-semibold">✓ Property updated successfully!</p>
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

                {/* SECTION: Rate Payer Information */}
                <div className="card">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 mb-6 text-center">
                        <h2 className="text-municipal-teal font-bold text-lg">Rate Payer Information</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                            <label className="label">Full Name <span className="text-municipal-red">*</span></label>
                            <input type="text" {...register('full_name', { required: 'Full name is required' })} className="input-field" placeholder="Full name" />
                            {errors.full_name && <p className="text-red-500 text-sm mt-1">{errors.full_name.message}</p>}
                        </div>

                        <div>
                            <label className="label">Phone Number <span className="text-municipal-red">*</span></label>
                            <div className="flex">
                                <span className="inline-flex items-center px-3 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg text-sm text-gray-600">+233</span>
                                <input type="tel" {...register('phone_number', { required: 'Phone is required' })} className="input-field rounded-l-none" placeholder="245678901" />
                            </div>
                            {errors.phone_number && <p className="text-red-500 text-sm mt-1">{errors.phone_number.message}</p>}
                        </div>

                        <div>
                            <label className="label">Email</label>
                            <input type="email" {...register('email')} className="input-field" placeholder="Email" />
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
                            <label className="label">Ghana Card No.</label>
                            <input type="text" {...register('ghana_card_no')} className="input-field" placeholder="GHA-XXXXXXXXX-X" />
                        </div>

                        <div>
                            <label className="label">Next of Kin</label>
                            <input type="text" {...register('next_of_kin_name')} className="input-field" placeholder="Full name" />
                        </div>

                        <div>
                            <label className="label">Next of Kin Contact <span className="text-municipal-red">*</span></label>
                            <div className="flex">
                                <span className="inline-flex items-center px-3 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg text-sm text-gray-600">+233</span>
                                <input type="tel" {...register('next_of_kin_contact')} className="input-field rounded-l-none" placeholder="245678901" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* SECTION: Property Information */}
                <div className="card">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 mb-6 text-center">
                        <h2 className="text-municipal-teal font-bold text-lg">Property Information</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="label">Property Use</label>
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
                            <label className="label">Property Class <span className="text-municipal-red">*</span></label>
                            <select {...register('classification_id', { required: 'Please select property class' })} className="input-field">
                                <option value="">Select option</option>
                                {classifications.map((c: any) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            {errors.classification_id && <p className="text-red-500 text-sm mt-1">{errors.classification_id.message}</p>}
                        </div>

                        <div>
                            <label className="label">Rating Zone (Fee Schedule)</label>
                            <select className="input-field" value={selectedRateZoneId} onChange={(e) => setSelectedRateZoneId(e.target.value)}>
                                <option value="">Select rating zone (optional)</option>
                                {rateZones.map((zone: any) => (
                                    <option key={zone.id} value={zone.id}>
                                        {zone.zone_name} ({zone.zone_type}) - Min: GHS {Number(zone.minimum_rate_min).toLocaleString()}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="label">Building Type</label>
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
                            <label className="label">No of Storeys</label>
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
                            <label className="label">Ownership of Property</label>
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
                            <label className="label">Building Permit Status</label>
                            <select {...register('building_permit_status')} className="input-field">
                                <option value="">Select option</option>
                                <option value="Approved">Approved</option>
                                <option value="Pending">Pending</option>
                                <option value="None">None</option>
                                <option value="Expired">Expired</option>
                            </select>
                        </div>

                        <div>
                            <label className="label">Account Number</label>
                            <input type="text" {...register('account_number')} className="input-field" placeholder="Account no" />
                        </div>

                        <div>
                            <label className="label">Parcel Number</label>
                            <input type="text" {...register('parcel_number')} className="input-field" placeholder="Parcel no" />
                        </div>

                        <div>
                            <label className="label">House Number</label>
                            <input type="text" {...register('house_number')} className="input-field" placeholder="House no" />
                        </div>

                        <div>
                            <label className="label">Source of Water</label>
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
                            <label className="label">Sanitation Facility Available</label>
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
                            <label className="label">Solid Waste Disposal Method</label>
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
                            <label className="label">Liquid Waste Disposal Method</label>
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
                            <label className="label">No of People</label>
                            <input type="number" min="0" {...register('no_of_people')} className="input-field" placeholder="0" />
                        </div>

                        <div>
                            <label className="label">No of Bedrooms</label>
                            <input type="number" min="0" {...register('no_of_bedrooms')} className="input-field" placeholder="0" />
                        </div>

                        <div>
                            <label className="label">No of Washrooms</label>
                            <input type="number" min="0" {...register('no_of_washrooms')} className="input-field" placeholder="0" />
                        </div>

                        <div>
                            <label className="label">No of Other Rooms</label>
                            <input type="number" min="0" {...register('no_of_other_rooms')} className="input-field" placeholder="0" />
                        </div>

                        <div>
                            <label className="label">Property Size (sqm)</label>
                            <input type="number" step="0.01" {...register('property_size')} className="input-field" placeholder="0.00" />
                        </div>
                    </div>
                </div>

                {/* SECTION: Location Information */}
                <div className="card">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 mb-6 text-center">
                        <h2 className="text-municipal-teal font-bold text-lg">Location Information</h2>
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
                                            setLocationAccuracy(null);
                                            
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
                                        accuracy={locationAccuracy || undefined}
                                    />
                                    {locationAccuracy && locationAccuracy > 100 && (
                                        <div className="mt-2 text-xs bg-yellow-50 text-yellow-700 p-2 rounded border border-yellow-200 flex items-center">
                                            <AlertCircle className="w-3 h-3 mr-1" />
                                            Low GPS precision ({Math.round(locationAccuracy)}m). Please adjust the pin on the map.
                                        </div>
                                    )}
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

                        <div>
                            <label className="label">Population Density of Location</label>
                            <select {...register('population_density')} className="input-field">
                                <option value="">Select option</option>
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end space-x-4">
                    <Link href={`/properties/${id}`} className="btn-secondary">Cancel</Link>
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
