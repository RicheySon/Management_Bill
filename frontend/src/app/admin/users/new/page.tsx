'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createCustomer, createUser, fetchRoles } from '@/lib/api-client'; // Note: createCustomer imported by mistake? Fixing below.
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

    useEffect(() => {
        const loadRoles = async () => {
            try {
                const data = await fetchRoles();
                setRoles(data);
                // Set default role if available
                if (data.length > 0) {
                    setFormData(prev => ({ ...prev, role_id: data[0].id }));
                }
            } catch (err) {
                console.error('Failed to load roles:', err);
                setError('Failed to load available roles');
            }
        };
        loadRoles();
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
            await createUser(formData);
            router.push('/admin/users');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to create user');
            setLoading(false);
        }
    };

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
