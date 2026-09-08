'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { useForm } from 'react-hook-form';
import {
    fetchProperty,
    updateProperty,
    updateCustomer,
    fetchCustomer,
    fetchPropertyClassifications,
    fetchElectoralAreas,
    fetchLocalAreas,
    fetchActivePropertyRateZones,
    reverseGeocode,
    formatGeoAddress,
} from '@/lib/api-client';
import { toCoord } from '@/lib/geo';
import DropdownSelect from '@/components/DropdownSelect';
import { feeAmountForPropertyClass, propertyClassLabel } from '@/lib/property-fee';
import { sectorFromPath } from '@/lib/property-sector';
import { ArrowLeft, Save, Navigation, Map as MapIcon, X, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

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
    const pathname = usePathname();
    const sector = sectorFromPath(pathname);
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
    const [assessedAmount, setAssessedAmount] = useState('');
    const [arrearsAmount, setArrearsAmount] = useState('');
    const [selectedRateInfo, setSelectedRateInfo] = useState('');
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
                        if (geo.town) setValue('town', geo.town);
                        if (geo.street) setValue('street_name', geo.street);
                        if (geo.landmark) setValue('landmark', geo.landmark);
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
        const loadData = async () => {
            try {
                const [propertyData, classificationsData, areasData, rateZonesData] = await Promise.all([
                    fetchProperty(id as string),
                    fetchPropertyClassifications(),
                    fetchElectoralAreas(),
                    fetchActivePropertyRateZones(new Date().getFullYear()),
                ]);

                const p = propertyData.property;
                let c = propertyData.customer;

                // Fill property fields
                Object.keys(p).forEach(key => {
                    if (key !== 'id' && key !== 'created_at' && key !== 'updated_at') {
                        setValue(key as any, p[key]);
                    }
                });

                // Fill rate payer fields from linked customer (API returns owner_* when customer nest is absent)
                if (!c && p.customer_id) {
                    try {
                        const customerResp = await fetchCustomer(p.customer_id);
                        c = customerResp.customer || customerResp;
                    } catch (err) {
                        console.error('Failed to fetch linked customer:', err);
                    }
                }

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
                } else {
                    if (p.customer_id) setCustomerId(p.customer_id);
                    setValue('full_name', p.owner_name || '');
                    setValue('phone_number', p.owner_phone || '');
                }

                if (p.property_rate_zone_id) {
                    setSelectedRateZoneId(p.property_rate_zone_id.toString());
                }
                if (p.assessed_amount != null && p.assessed_amount !== '') {
                    setAssessedAmount(String(p.assessed_amount));
                }
                const latestBill = (propertyData.bills || propertyData.outstanding_bills || [])[0];
                if (latestBill?.arrears != null) {
                    setArrearsAmount(String(latestBill.arrears));
                }

                setClassifications(classificationsData);
                setElectoralAreas(areasData);
                setRateZones(rateZonesData || []);

                if (p.electoral_area_id) {
                    const locals = await fetchLocalAreas(p.electoral_area_id);
                    setLocalAreas(locals);
                    setValue('local_area_id', p.local_area_id);
                    prevElectoralAreaRef.current = Number(p.electoral_area_id);
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
        const eaId = toNullableId(selectedElectoralArea);
        if (!eaId) {
            setLocalAreas([]);
            return;
        }
        let cancelled = false;
        fetchLocalAreas(eaId).then((areas) => {
            if (cancelled) return;
            setLocalAreas(areas || []);
            if (prevElectoralAreaRef.current !== null && prevElectoralAreaRef.current !== eaId) {
                setValue('local_area_id', undefined as any);
            }
            prevElectoralAreaRef.current = eaId;
        }).catch(() => {
            if (!cancelled) setLocalAreas([]);
        });
        return () => {
            cancelled = true;
        };
    }, [selectedElectoralArea, setValue]);

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
                classification_id: toNullableId(data.classification_id),
                property_use: data.property_use,
                building_type: data.building_type,
                no_of_storeys: toOptionalNumber(data.no_of_storeys),
                ownership: data.ownership,
                building_permit_status: data.building_permit_status,
                account_number: data.account_number,
                parcel_number: data.parcel_number,
                house_number: data.house_number,
                source_of_water: data.source_of_water,
                sanitation_facility: data.sanitation_facility,
                solid_waste_disposal: data.solid_waste_disposal,
                liquid_waste_disposal: data.liquid_waste_disposal,
                no_of_people: toOptionalNumber(data.no_of_people),
                no_of_bedrooms: toOptionalNumber(data.no_of_bedrooms),
                no_of_washrooms: toOptionalNumber(data.no_of_washrooms),
                no_of_other_rooms: toOptionalNumber(data.no_of_other_rooms),
                property_size: toOptionalNumber(data.property_size),
                gps_address: data.gps_address,
                latitude: toOptionalNumber(data.latitude),
                longitude: toOptionalNumber(data.longitude),
                town: data.town,
                street_name: data.street_name,
                landmark: data.landmark,
                electoral_area_id: toNullableId(data.electoral_area_id),
                local_area_id: toNullableId(data.local_area_id),
                population_density: data.population_density,
                property_rate_zone_id: selectedRateZoneId ? parseInt(selectedRateZoneId) : null,
                assessed_amount: assessedAmount === '' ? null : Number(assessedAmount),
                arrears: arrearsAmount === '' ? undefined : Number(arrearsAmount),
            });

            setSuccess(true);
            setTimeout(() => { router.push(`${sector.basePath}/${id}`); }, 1500);
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
                <Link href={`${sector.basePath}/${id}`} className="btn-secondary flex items-center space-x-2">
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
                            <input type="text" {...register('full_name', { required: 'Full name is required' })} className="input-field" placeholder="Full Name" />
                            {errors.full_name && <p className="text-red-500 text-sm mt-1">{errors.full_name.message}</p>}
                        </div>

                        <div>
                            <label className="label">Phone Number <span className="text-municipal-red">*</span></label>
                            <div className="flex">
                                <span className="inline-flex items-center px-3 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg text-sm text-gray-600">+233</span>
                                <input type="tel" {...register('phone_number', { required: 'Phone is required' })} className="input-field rounded-l-none" placeholder="Phone Number" />
                            </div>
                            {errors.phone_number && <p className="text-red-500 text-sm mt-1">{errors.phone_number.message}</p>}
                        </div>

                        <div>
                            <label className="label">Email</label>
                            <input type="email" {...register('email')} className="input-field" placeholder="Email" />
                        </div>

                        <div>
                            <label className="label">Gender <span className="text-municipal-red">*</span></label>
                            <DropdownSelect
                                value={watch('gender') || ''}
                                onChange={(v) => setValue('gender', v as any, { shouldValidate: true })}
                                placeholder="Gender"
                                options={[
                                { value: 'Male', label: 'Male' },
                                { value: 'Female', label: 'Female' }
                                ]}
                            />
                        </div>

                        <div>
                            <label className="label">Marital Status <span className="text-municipal-red">*</span></label>
                            <DropdownSelect
                                value={watch('marital_status') || ''}
                                onChange={(v) => setValue('marital_status', v as any, { shouldValidate: true })}
                                placeholder="Marital Status"
                                options={[
                                { value: 'Single', label: 'Single' },
                                { value: 'Married', label: 'Married' },
                                { value: 'Divorced', label: 'Divorced' },
                                { value: 'Widowed', label: 'Widowed' }
                                ]}
                            />
                        </div>

                        <div>
                            <label className="label">Ghana Card No.</label>
                            <input type="text" {...register('ghana_card_no')} className="input-field" placeholder="Ghana Card No." />
                        </div>

                        <div>
                            <label className="label">Next of Kin</label>
                            <input type="text" {...register('next_of_kin_name')} className="input-field" placeholder="Next of Kin" />
                        </div>

                        <div>
                            <label className="label">Next of Kin Contact <span className="text-municipal-red">*</span></label>
                            <div className="flex">
                                <span className="inline-flex items-center px-3 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg text-sm text-gray-600">+233</span>
                                <input type="tel" {...register('next_of_kin_contact')} className="input-field rounded-l-none" placeholder="Next of Kin Contact" />
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
                            <DropdownSelect
                                value={watch('property_use') || ''}
                                onChange={(v) => setValue('property_use', v as any, { shouldValidate: true })}
                                placeholder="Select option"
                                options={[
                                { value: 'Residential', label: 'Residential' },
                                { value: 'Commercial', label: 'Commercial' },
                                { value: 'Mixed Use', label: 'Mixed Use' },
                                { value: 'Industrial', label: 'Industrial' }
                                ]}
                            />
                        </div>

                        <div>
                            <label className="label">Property Class (Category) <span className="text-municipal-red">*</span></label>
                            <DropdownSelect
                                value={watch('classification_id') ?? ''}
                                onChange={(v) => {
                                    const classId = v === '' ? undefined : Number(v);
                                    setValue('classification_id', classId as any, { shouldValidate: true });
                                    const cls = (classifications as any[]).find((c: any) => c.id === classId);
                                    if (selectedRateZoneId) {
                                        const zone = rateZones.find((z: any) => z.id === parseInt(selectedRateZoneId));
                                        if (zone && cls) {
                                            const amount = feeAmountForPropertyClass(zone, cls.name);
                                            if (amount > 0) {
                                                setAssessedAmount(String(amount));
                                                setSelectedRateInfo(
                                                    `${zone.zone_name} × ${propertyClassLabel(cls.name)}: GHS ${amount.toLocaleString()}`
                                                );
                                            } else {
                                                setAssessedAmount('');
                                                setSelectedRateInfo(
                                                    `${zone.zone_name} × ${propertyClassLabel(cls.name)} — no fee set for this category`
                                                );
                                            }
                                        }
                                    }
                                }}
                                placeholder="Select Category A–D"
                                options={(classifications as any[]).map((c: any) => ({
                                    value: String(c.id),
                                    label: propertyClassLabel(c.name) || c.name,
                                }))}
                            />
                            <input type="hidden" {...register('classification_id', { required: 'Please select property class' })} />
                            {errors.classification_id && <p className="text-red-500 text-sm mt-1">{errors.classification_id.message}</p>}
                        </div>

                        <div>
                            <label className="label">Rating Zone <span className="text-gray-400 font-normal">(zone / house name)</span></label>
                            <DropdownSelect
                                value={selectedRateZoneId}
                                onChange={(v) => {
                                    setSelectedRateZoneId(v);
                                    if (v) {
                                        const zone = rateZones.find((z: any) => z.id === parseInt(v));
                                        const classId = watch('classification_id');
                                        const cls = (classifications as any[]).find((c: any) => c.id === Number(classId));
                                        if (zone) {
                                            const amount = feeAmountForPropertyClass(zone, cls?.name);
                                            if (amount > 0) {
                                                setAssessedAmount(String(amount));
                                                setSelectedRateInfo(
                                                    cls
                                                        ? `${zone.zone_name} × ${propertyClassLabel(cls.name)}: GHS ${amount.toLocaleString()}`
                                                        : `${zone.zone_name} — select Category A–D for the bill amount`
                                                );
                                            } else {
                                                setAssessedAmount('');
                                                setSelectedRateInfo(
                                                    cls
                                                        ? `${zone.zone_name} × ${propertyClassLabel(cls.name)} — no fee set for this category`
                                                        : `${zone.zone_name} — select Category A–D for the bill amount`
                                                );
                                            }
                                        }
                                    } else {
                                        setSelectedRateInfo('');
                                    }
                                }}
                                placeholder="Select rating zone"
                                options={rateZones.map((zone: any) => ({
                                    value: String(zone.id),
                                    label: zone.zone_name,
                                }))}
                            />
                            {selectedRateInfo && (
                                <p className="text-sm text-green-700 font-medium mt-1">{selectedRateInfo}</p>
                            )}
                        </div>

                        <div>
                            <label className="label">Bill Amount (GHS)</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="input-field"
                                placeholder="Bill Amount (GHS)"
                                value={assessedAmount}
                                onChange={(e) => setAssessedAmount(e.target.value)}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Auto-fills from fee fixing when you pick Category A–D + Rating Zone (editable).
                            </p>
                        </div>

                        <div>
                            <label className="label">Arrears (GHS)</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="input-field border-amber-300 focus:ring-amber-500"
                                placeholder="0.00"
                                value={arrearsAmount}
                                onChange={(e) => setArrearsAmount(e.target.value)}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Updates arrears on the latest property bill when saved.
                            </p>
                        </div>

                        <div>
                            <label className="label">Building Type</label>
                            <DropdownSelect
                                value={watch('building_type') || ''}
                                onChange={(v) => setValue('building_type', v as any, { shouldValidate: true })}
                                placeholder="Select option"
                                options={[
                                { value: 'Bungalow', label: 'Bungalow' },
                                { value: 'Story Building', label: 'Story Building' },
                                { value: 'Flat/Apartment', label: 'Flat/Apartment' },
                                { value: 'Compound House', label: 'Compound House' },
                                { value: 'Semi-detached', label: 'Semi-detached' },
                                { value: 'Detached', label: 'Detached' },
                                { value: 'Kiosk/Container', label: 'Kiosk/Container' },
                                { value: 'Temporary Structure', label: 'Temporary Structure' }
                                ]}
                            />
                        </div>

                        <div>
                            <label className="label">No of Storeys</label>
                            <DropdownSelect
                                value={watch('no_of_storeys') || ''}
                                onChange={(v) => setValue('no_of_storeys', v as any, { shouldValidate: true })}
                                placeholder="Select option"
                                options={[
                                { value: '1', label: '1' },
                                { value: '2', label: '2' },
                                { value: '3', label: '3' },
                                { value: '4', label: '4' },
                                { value: '5', label: '5+' }
                                ]}
                            />
                        </div>

                        <div>
                            <label className="label">Ownership of Property</label>
                            <DropdownSelect
                                value={watch('ownership') || ''}
                                onChange={(v) => setValue('ownership', v as any, { shouldValidate: true })}
                                placeholder="Select option"
                                options={[
                                { value: 'Owner Occupied', label: 'Owner Occupied' },
                                { value: 'Rented', label: 'Rented' },
                                { value: 'Family Property', label: 'Family Property' },
                                { value: 'Government', label: 'Government' },
                                { value: 'Leased', label: 'Leased' }
                                ]}
                            />
                        </div>

                        <div>
                            <label className="label">Building Permit Status</label>
                            <DropdownSelect
                                value={watch('building_permit_status') || ''}
                                onChange={(v) => setValue('building_permit_status', v as any, { shouldValidate: true })}
                                placeholder="Select option"
                                options={[
                                { value: 'Approved', label: 'Approved' },
                                { value: 'Pending', label: 'Pending' },
                                { value: 'None', label: 'None' },
                                { value: 'Expired', label: 'Expired' }
                                ]}
                            />
                        </div>

                        <div>
                            <label className="label">Account Number</label>
                            <input type="text" {...register('account_number')} className="input-field" placeholder="Account Number" />
                        </div>

                        <div>
                            <label className="label">Parcel Number</label>
                            <input type="text" {...register('parcel_number')} className="input-field" placeholder="Parcel Number" />
                        </div>

                        <div>
                            <label className="label">House Number</label>
                            <input type="text" {...register('house_number')} className="input-field" placeholder="House Number" />
                        </div>

                        <div>
                            <label className="label">Source of Water</label>
                            <DropdownSelect
                                value={watch('source_of_water') || ''}
                                onChange={(v) => setValue('source_of_water', v as any, { shouldValidate: true })}
                                placeholder="Select option"
                                options={[
                                { value: 'Ghana water', label: 'Ghana water' },
                                { value: 'Borehole', label: 'Borehole' },
                                { value: 'Well', label: 'Well' },
                                { value: 'Tanker', label: 'Tanker' },
                                { value: 'Sachet/Bottled', label: 'Sachet/Bottled' },
                                { value: 'River/Stream', label: 'River/Stream' }
                                ]}
                            />
                        </div>

                        <div>
                            <label className="label">Sanitation Facility Available</label>
                            <DropdownSelect
                                value={watch('sanitation_facility') || ''}
                                onChange={(v) => setValue('sanitation_facility', v as any, { shouldValidate: true })}
                                placeholder="Select option"
                                options={[
                                { value: 'WC', label: 'WC (Water Closet)' },
                                { value: 'KVIP', label: 'KVIP' },
                                { value: 'Pit Latrine', label: 'Pit Latrine' },
                                { value: 'Public Toilet', label: 'Public Toilet' },
                                { value: 'None', label: 'None' }
                                ]}
                            />
                        </div>

                        <div>
                            <label className="label">Solid Waste Disposal Method</label>
                            <DropdownSelect
                                value={watch('solid_waste_disposal') || ''}
                                onChange={(v) => setValue('solid_waste_disposal', v as any, { shouldValidate: true })}
                                placeholder="Select option"
                                options={[
                                { value: 'Collected', label: 'Collected' },
                                { value: 'Public Container', label: 'Public Container' },
                                { value: 'Dumped', label: 'Dumped' },
                                { value: 'Burned', label: 'Burned' },
                                { value: 'Buried', label: 'Buried' }
                                ]}
                            />
                        </div>

                        <div>
                            <label className="label">Liquid Waste Disposal Method</label>
                            <DropdownSelect
                                value={watch('liquid_waste_disposal') || ''}
                                onChange={(v) => setValue('liquid_waste_disposal', v as any, { shouldValidate: true })}
                                placeholder="Select option"
                                options={[
                                { value: 'Sewer', label: 'Sewer' },
                                { value: 'Septic Tank', label: 'Septic Tank' },
                                { value: 'Open Drain', label: 'Open Drain' },
                                { value: 'Soakaway', label: 'Soakaway' },
                                { value: 'None', label: 'None' }
                                ]}
                            />
                        </div>

                        <div>
                            <label className="label">No of People <span className="text-gray-400 font-normal">(optional)</span></label>
                            <input type="number" min="0" {...register('no_of_people')} className="input-field" placeholder="No of People" />
                        </div>

                        <div>
                            <label className="label">No of Bedrooms <span className="text-gray-400 font-normal">(optional)</span></label>
                            <input type="number" min="0" {...register('no_of_bedrooms')} className="input-field" placeholder="No of Bedrooms" />
                        </div>

                        <div>
                            <label className="label">No of Washrooms <span className="text-gray-400 font-normal">(optional)</span></label>
                            <input type="number" min="0" {...register('no_of_washrooms')} className="input-field" placeholder="No of Washrooms" />
                        </div>

                        <div>
                            <label className="label">No of Other Rooms <span className="text-gray-400 font-normal">(optional)</span></label>
                            <input type="number" min="0" {...register('no_of_other_rooms')} className="input-field" placeholder="No of Other Rooms" />
                        </div>

                        <div>
                            <label className="label">Property Size (sqm) <span className="text-gray-400 font-normal">(optional)</span></label>
                            <input type="number" step="0.01" min="0" {...register('property_size')} className="input-field" placeholder="Property Size (sqm)" />
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
                            <input type="text" {...register('gps_address')} className="input-field" placeholder="Type GhanaPost GPS (manual)" />
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
                                                if (geoData) {
                                                    const geo = formatGeoAddress(geoData);
                                                    if (geo.town) setValue('town', geo.town);
                                                    if (geo.street) setValue('street_name', geo.street);
                                                    if (geo.landmark) setValue('landmark', geo.landmark);
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
                                            Low GPS precision ({Math.round(locationAccuracy)}m). Please adjust the pin on the map.
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block uppercase tracking-wider font-bold italic">Latitude</label>
                                    <input type="number" step="any" {...register('latitude', { valueAsNumber: true })} className="input-field" placeholder="Latitude" />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block uppercase tracking-wider font-bold italic">Longitude</label>
                                    <input type="number" step="any" {...register('longitude', { valueAsNumber: true })} className="input-field" placeholder="Longitude" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="label">Town</label>
                            <input type="text" {...register('town')} className="input-field" placeholder="Town" />
                        </div>

                        <div>
                            <label className="label">Street Name</label>
                            <input type="text" {...register('street_name')} className="input-field" placeholder="Street Name" />
                        </div>

                        <div>
                            <label className="label">Landmark</label>
                            <input type="text" {...register('landmark')} className="input-field" placeholder="Landmark" />
                        </div>

                        <div>
                            <label className="label">Electoral Area <span className="text-gray-400 font-normal">(optional)</span></label>
                            <DropdownSelect
                                value={watch('electoral_area_id') ?? ''}
                                onChange={(v) => setValue('electoral_area_id', (v === '' ? undefined : Number(v)) as any, { shouldValidate: true })}
                                placeholder="Select Electoral Area"
                                options={electoralAreas.map((area: any) => ({ value: String(area.id), label: area.name }))}
                            />
                        </div>

                        <div>
                            <label className="label">Local Area / Community <span className="text-gray-400 font-normal">(optional)</span></label>
                            <DropdownSelect
                                value={watch('local_area_id') ?? ''}
                                onChange={(v) => setValue('local_area_id', (v === '' ? undefined : Number(v)) as any, { shouldValidate: true })}
                                placeholder="Select Local Area"
                                options={localAreas.map((area: any) => ({ value: String(area.id), label: area.name }))}
                            />
                            {!toNullableId(selectedElectoralArea) ? (
                                <p className="text-xs text-gray-500 mt-1">Choose an electoral area above to load communities.</p>
                            ) : localAreas.length === 0 ? (
                                <p className="text-xs text-amber-700 mt-1">
                                    No communities linked yet. An admin can add them under Administration → Areas & Communities.
                                </p>
                            ) : null}
                        </div>

                        <div>
                            <label className="label">Population Density of Location</label>
                            <DropdownSelect
                                value={watch('population_density') || ''}
                                onChange={(v) => setValue('population_density', v as any, { shouldValidate: true })}
                                placeholder="Select option"
                                options={[
                                { value: 'High', label: 'High' },
                                { value: 'Medium', label: 'Medium' },
                                { value: 'Low', label: 'Low' }
                                ]}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end space-x-4">
                    <Link href={`${sector.basePath}/${id}`} className="btn-secondary">Cancel</Link>
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
