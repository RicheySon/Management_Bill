'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import {
    fetchProperty,
    updateProperty,
    fetchPropertyClassifications,
    fetchElectoralAreas,
    fetchLocalAreas,
    fetchActivePropertyRateZones,
} from '@/lib/api-client';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface PropertyForm {
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
    property_rate_zone_id?: number;
}

export default function EditPropertyPage() {
    const router = useRouter();
    const { id } = useParams();
    const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<PropertyForm>();

    const [classifications, setClassifications] = useState([]);
    const [electoralAreas, setElectoralAreas] = useState([]);
    const [localAreas, setLocalAreas] = useState([]);
    const [rateZones, setRateZones] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const selectedElectoralArea = watch('electoral_area_id');

    useEffect(() => {
        const loadData = async () => {
            try {
                const [propertyData, classificationsData, areasData, rateZonesData] = await Promise.all([
                    fetchProperty(id as string),
                    fetchPropertyClassifications(),
                    fetchElectoralAreas(),
                    fetchActivePropertyRateZones(new Date().getFullYear()),
                ]);

                // Fill form
                const p = propertyData.property;
                Object.keys(p).forEach(key => {
                    setValue(key as any, p[key]);
                });

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
            fetchLocalAreas(selectedElectoralArea).then(setLocalAreas);
        } else {
            setLocalAreas([]);
        }
    }, [selectedElectoralArea]);

    const onSubmit = async (data: PropertyForm) => {
        setError(null);
        try {
            await updateProperty(id as string, data);
            router.push(`/properties/${id}`);
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
                    <p className="text-gray-600 mt-1">Update property details</p>
                </div>
                <Link href={`/properties/${id}`} className="btn-secondary flex items-center space-x-2">
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
                            <label className="label">
                                Property Class <span className="text-municipal-red">*</span>
                            </label>
                            <select
                                {...register('classification_id', { required: 'Please select property class' })}
                                className="input-field"
                            >
                                <option value="">Select option</option>
                                {classifications.map((c: any) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            {errors.classification_id && (
                                <p className="text-red-500 text-sm mt-1">{errors.classification_id.message}</p>
                            )}
                        </div>

                        {/* Rating Zone (from configured fee schedule) */}
                        <div>
                            <label className="label">Rating Zone (Fee Schedule)</label>
                            <select {...register('property_rate_zone_id')} className="input-field">
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
                            <input
                                type="text"
                                {...register('account_number')}
                                className="input-field"
                                placeholder="Account no"
                            />
                        </div>

                        <div>
                            <label className="label">Parcel Number</label>
                            <input
                                type="text"
                                {...register('parcel_number')}
                                className="input-field"
                                placeholder="Parcel no"
                            />
                        </div>

                        <div>
                            <label className="label">House Number</label>
                            <input
                                type="text"
                                {...register('house_number')}
                                className="input-field"
                                placeholder="House no"
                            />
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
                            <input
                                type="number"
                                min="0"
                                {...register('no_of_people')}
                                className="input-field"
                                placeholder="0"
                            />
                        </div>

                        <div>
                            <label className="label">No of Bedrooms</label>
                            <input
                                type="number"
                                min="0"
                                {...register('no_of_bedrooms')}
                                className="input-field"
                                placeholder="0"
                            />
                        </div>

                        <div>
                            <label className="label">No of Washrooms</label>
                            <input
                                type="number"
                                min="0"
                                {...register('no_of_washrooms')}
                                className="input-field"
                                placeholder="0"
                            />
                        </div>

                        <div>
                            <label className="label">No of Other Rooms</label>
                            <input
                                type="number"
                                min="0"
                                {...register('no_of_other_rooms')}
                                className="input-field"
                                placeholder="0"
                            />
                        </div>

                        <div>
                            <label className="label">Property Size (sqm)</label>
                            <input
                                type="number"
                                step="0.01"
                                {...register('property_size')}
                                className="input-field"
                                placeholder="0.00"
                            />
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
                    <Link href={`/properties/${id}`} className="btn-secondary">
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
                                <span>Saving...</span>
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                <span>Save Changes</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
