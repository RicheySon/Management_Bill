'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { fetchCustomer, updateCustomer, fetchElectoralAreas, fetchLocalAreas } from '@/lib/api-client';
import { ArrowLeft, Save, AlertCircle, Navigation, Map as MapIcon, X } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const MapSelector = dynamic(() => import('@/components/MapSelector'), {
    ssr: false,
    loading: () => <div className="h-[400px] w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-500">Loading Map...</div>
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

export default function EditCustomerPage() {
    const { id } = useParams();
    const router = useRouter();
    const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<CustomerForm>();

    const [electoralAreas, setElectoralAreas] = useState<any[]>([]);
    const [localAreas, setLocalAreas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
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
            (position) => {
                setValue('latitude', parseFloat(position.coords.latitude.toFixed(6)));
                setValue('longitude', parseFloat(position.coords.longitude.toFixed(6)));
                setIsDetecting(false);
            },
            (err) => {
                alert(`Failed to get location: ${err.message}`);
                setIsDetecting(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const areas = await fetchElectoralAreas();
                setElectoralAreas(areas);

                const response = await fetchCustomer(id as string);
                const customer = response.customer;

                setValue('full_name', customer.full_name);
                setValue('phone_number', customer.phone_number);
                setValue('email', customer.email || '');
                setValue('gps_address', customer.gps_address || '');
                setValue('latitude', customer.latitude);
                setValue('longitude', customer.longitude);
                setValue('physical_location', customer.physical_location || '');
                setValue('landmark', customer.landmark || '');
                setValue('gender', customer.gender || '');
                setValue('marital_status', customer.marital_status || '');
                setValue('next_of_kin_name', customer.next_of_kin_name || '');
                setValue('next_of_kin_contact', customer.next_of_kin_contact || '');
                setValue('ghana_card_no', customer.ghana_card_no || '');
                setValue('electoral_area_id', customer.electoral_area_id);

                if (customer.electoral_area_id) {
                    const lAreas = await fetchLocalAreas(Number(customer.electoral_area_id));
                    setLocalAreas(lAreas);
                    setValue('local_area_id', customer.local_area_id);
                }
            } catch (err: any) {
                console.error('Failed to load initial data:', err);
                setError('Failed to load customer data');
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, [id, setValue]);

    useEffect(() => {
        if (selectedElectoralArea) {
            fetchLocalAreas(Number(selectedElectoralArea)).then(areas => {
                setLocalAreas(Array.isArray(areas) ? areas : []);
            }).catch(() => setLocalAreas([]));
        } else {
            setLocalAreas([]);
        }
    }, [selectedElectoralArea]);

    const onSubmit = async (data: CustomerForm) => {
        setError(null);
        try {
            await updateCustomer(id as string, data);
            setSuccess(true);
            setTimeout(() => { router.push(`/customers/${id}`); }, 1500);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to update customer');
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
                    <h1 className="text-3xl font-bold text-gray-900">Edit Customer Profile</h1>
                    <p className="text-gray-600 mt-1">Update information for {watch('full_name')}</p>
                </div>
                <button onClick={() => router.back()} className="btn-secondary flex items-center space-x-2">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                </button>
            </div>

            {success && (
                <div className="bg-green-50 border-2 border-green-500 text-green-800 px-6 py-4 rounded-lg mb-6 shadow-sm">
                    <p className="font-semibold text-lg flex items-center"><span className="mr-2">✓</span> Profile updated successfully!</p>
                    <p className="text-sm opacity-90">Redirecting back to profile...</p>
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
                <div className="card shadow-xl border-gray-100">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 mb-6 text-center">
                        <h2 className="text-municipal-teal font-bold text-lg">Personal Information</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="label">Full Name <span className="text-municipal-red">*</span></label>
                            <input type="text" {...register('full_name', { required: 'Full name is required' })} className="input-field" placeholder="Enter full name" />
                            {errors.full_name && <p className="text-red-500 text-sm mt-1">{errors.full_name.message}</p>}
                        </div>

                        <div>
                            <label className="label">Phone Number <span className="text-municipal-red">*</span></label>
                            <div className="flex">
                                <span className="inline-flex items-center px-3 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg text-sm text-gray-600">+233</span>
                                <input type="tel" {...register('phone_number', { required: 'Phone number is required' })} className="input-field rounded-l-none" placeholder="245678901" />
                            </div>
                            {errors.phone_number && <p className="text-red-500 text-sm mt-1">{errors.phone_number.message}</p>}
                        </div>

                        <div>
                            <label className="label">Email Address</label>
                            <input type="email" {...register('email')} className="input-field" placeholder="customer@email.com" />
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
                            <input type="text" {...register('ghana_card_no')} className="input-field" placeholder="GHA-XXXXXXXXX-X" />
                        </div>

                        <div>
                            <label className="label">Next of Kin Name</label>
                            <input type="text" {...register('next_of_kin_name')} className="input-field" placeholder="Full name" />
                        </div>

                        <div>
                            <label className="label">Next of Kin Contact</label>
                            <div className="flex">
                                <span className="inline-flex items-center px-3 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg text-sm text-gray-600">+233</span>
                                <input type="tel" {...register('next_of_kin_contact')} className="input-field rounded-l-none" placeholder="245678901" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Location Information */}
                <div className="card shadow-xl border-gray-100">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 mb-6 text-center">
                        <h2 className="text-municipal-teal font-bold text-lg">Location Information</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="label font-mono tracking-tighter">GPS ADDRESS</label>
                            <input type="text" {...register('gps_address')} className="input-field font-mono" placeholder="GG-845-8731" />
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
                                        onLocationSelectAction={(lat: number, lng: number) => {
                                            setValue('latitude', parseFloat(lat.toFixed(6)));
                                            setValue('longitude', parseFloat(lng.toFixed(6)));
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
                            <input type="text" {...register('physical_location')} className="input-field" placeholder="NII AYI KUSHIE ST" />
                        </div>

                        <div className="md:col-span-2">
                            <label className="label">Landmark</label>
                            <input type="text" {...register('landmark')} className="input-field" placeholder="Near GOIL filling Station" />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end space-x-4 pt-2">
                    <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
                    <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center space-x-2 px-8">
                        {isSubmitting ? (
                            <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div><span>Saving Changes...</span></>
                        ) : (
                            <><Save className="w-4 h-4" /><span>Save Changes</span></>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
