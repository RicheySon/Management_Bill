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
                <div className="card">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 mb-6 text-center">
                        <h2 className="text-municipal-teal font-bold text-lg">Property Details</h2>
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
                            <label className="label">Property Class</label>
                            <select {...register('classification_id')} className="input-field">
                                {classifications.map((c: any) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="label">Building Type</label>
                            <select {...register('building_type')} className="input-field">
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
                            <label className="label">Rating Zone</label>
                            <select {...register('property_rate_zone_id')} className="input-field">
                                <option value="">Select rating zone</option>
                                {rateZones.map((z: any) => (
                                    <option key={z.id} value={z.id}>{z.zone_name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="label">No of People</label>
                            <input type="number" {...register('no_of_people')} className="input-field" />
                        </div>

                        <div>
                            <label className="label">Property Size (sqm)</label>
                            <input type="number" step="0.01" {...register('property_size')} className="input-field" />
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 mb-6 text-center">
                        <h2 className="text-municipal-teal font-bold text-lg">Location Details</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                            <label className="label">Physical Location</label>
                            <input type="text" {...register('street_name')} className="input-field" placeholder="Street Name" />
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
                            <label className="label">Landmark</label>
                            <input type="text" {...register('landmark')} className="input-field" />
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
