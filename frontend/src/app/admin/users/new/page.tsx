'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createUser, fetchRoles, fetchElectoralAreas } from '@/lib/api-client';
import {
    ArrowLeft, Save, User, Mail, Lock, Shield,
    AlertCircle, CheckCircle2
} from 'lucide-react';

export default function NewUserPage() {
    const router = useRouter();
    const [roles, setRoles] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        password: '',
        role_id: ''
    });
    const [electoralAreas, setElectoralAreas] = useState<any[]>([]);
    const [selectedAreas, setSelectedAreas] = useState<number[]>([]);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [rolesData, areasData] = await Promise.all([
                    fetchRoles(),
                    fetchElectoralAreas()
                ]);
                setRoles(rolesData);
                setElectoralAreas(areasData);
                // Set default role if available
                if (rolesData.length > 0) {
                    setFormData(prev => ({ ...prev, role_id: rolesData[0].id }));
                }
            } catch (err) {
                console.error('Failed to load initial data:', err);
                setError('Failed to load available roles or electoral areas');
            }
        };
        loadInitialData();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const payload = {
                ...formData,
                electoral_areas: selectedAreas
            };
            await createUser(payload);
            router.push('/admin/users');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to create user');
            setLoading(false);
        }
    };

    const handleAreaToggle = (areaId: number) => {
        setSelectedAreas(prev => 
            prev.includes(areaId) 
                ? prev.filter(id => id !== areaId)
                : [...prev, areaId]
        );
    };

    const selectedRole = roles.find(r => r.id === Number(formData.role_id));
    const isRevenueCollector = selectedRole?.name === 'Revenue Collector';

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Link
                        href="/admin/users"
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Add New User</h1>
                        <p className="text-gray-500">Create a new system user account</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}

            <div className="card p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* User Details */}
                    <div>
                        <h3 className="section-title">Account Information</h3>
                        <div className="grid grid-cols-1 gap-6">
                            <div>
                                <label className="label">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        name="full_name"
                                        required
                                        className="input-field pl-10"
                                        placeholder="e.g. John Doe"
                                        value={formData.full_name}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="label">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="email"
                                        name="email"
                                        required
                                        className="input-field pl-10"
                                        placeholder="john.doe@ganorth.gov.gh"
                                        value={formData.email}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="label">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="password"
                                        name="password"
                                        required
                                        minLength={6}
                                        className="input-field pl-10"
                                        placeholder="••••••••"
                                        value={formData.password}
                                        onChange={handleChange}
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
                            </div>

                            <div>
                                <label className="label">Role</label>
                                <div className="relative">
                                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <select
                                        name="role_id"
                                        required
                                        className="input-field pl-10"
                                        value={formData.role_id}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select a role...</option>
                                        {roles.map(role => (
                                            <option key={role.id} value={role.id}>
                                                {role.name} - {role.description}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            
                            {isRevenueCollector && (
                                <div className="mt-6 border-t pt-4">
                                    <h4 className="text-sm font-semibold text-gray-800 mb-3">Assign Electoral Areas</h4>
                                    <p className="text-xs text-gray-500 mb-4">Select one or more electoral areas for this revenue collector.</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-2 border rounded-md bg-gray-50">
                                        {electoralAreas.map((area) => (
                                            <label key={area.id} className="flex items-center space-x-3 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedAreas.includes(area.id)}
                                                    onChange={() => handleAreaToggle(area.id)}
                                                    className="w-4 h-4 text-municipal-red border-gray-300 rounded focus:ring-municipal-red"
                                                />
                                                <span className="text-sm text-gray-700">{area.name} ({area.code})</span>
                                            </label>
                                        ))}
                                        {electoralAreas.length === 0 && (
                                            <p className="text-sm text-gray-500 italic col-span-2">No electoral areas available.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 space-x-4 border-t">
                        <Link
                            href="/admin/users"
                            className="btn-secondary"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            className="btn-primary flex items-center space-x-2"
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            ) : (
                                <Save className="w-5 h-5" />
                            )}
                            <span>Create User</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
