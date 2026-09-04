'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
    fetchUser,
    updateUser,
    updateUserPassword,
    fetchRoles,
    fetchElectoralAreas,
} from '@/lib/api-client';
import {
    ArrowLeft, Save, User, Mail, Lock, Shield,
    AlertCircle, CheckCircle2, KeyRound
} from 'lucide-react';

export default function EditUserPage() {
    const router = useRouter();
    const params = useParams();
    const userId = params.id as string;

    const [roles, setRoles] = useState<any[]>([]);
    const [electoralAreas, setElectoralAreas] = useState<any[]>([]);
    const [selectedAreas, setSelectedAreas] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        role_id: '',
        status: 'ACTIVE',
    });
    const [passwordData, setPasswordData] = useState({
        password: '',
        confirm: '',
    });

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const [user, rolesData, areasData] = await Promise.all([
                    fetchUser(userId),
                    fetchRoles(),
                    fetchElectoralAreas(),
                ]);
                setRoles(rolesData);
                setElectoralAreas(areasData);
                setFormData({
                    full_name: user.full_name || '',
                    email: user.email || '',
                    role_id: String(user.role_id || ''),
                    status: user.status || 'ACTIVE',
                });
                setSelectedAreas((user.electoral_areas || []).map((id: any) => Number(id)));
                setIsSuperAdmin(Boolean(user.roles?.includes('Super Admin')));
            } catch (err) {
                console.error(err);
                setError('Failed to load user');
            } finally {
                setLoading(false);
            }
        };
        if (userId) load();
    }, [userId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAreaToggle = (areaId: number) => {
        setSelectedAreas(prev =>
            prev.includes(areaId)
                ? prev.filter(id => id !== areaId)
                : [...prev, areaId]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            await updateUser(userId, {
                full_name: formData.full_name,
                email: formData.email,
                role_id: Number(formData.role_id),
                status: formData.status,
                electoral_areas: selectedAreas,
            });
            setSuccess('User updated successfully');
            setTimeout(() => router.push('/admin/users'), 1200);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to update user');
            setSaving(false);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        if (passwordData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (passwordData.password !== passwordData.confirm) {
            setError('Passwords do not match');
            return;
        }
        try {
            setPasswordSaving(true);
            await updateUserPassword(userId, passwordData.password);
            setPasswordData({ password: '', confirm: '' });
            setSuccess('Password updated successfully');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to update password');
        } finally {
            setPasswordSaving(false);
        }
    };

    const selectedRole = roles.find(r => r.id === Number(formData.role_id));
    const isRevenueCollector = selectedRole?.name === 'Revenue Collector';

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-municipal-red"></div>
            </div>
        );
    }

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
                        <h1 className="text-2xl font-bold text-gray-900">Edit User</h1>
                        <p className="text-gray-500">Update account details, role, and password</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}
            {success && (
                <div className="bg-green-50 text-green-700 p-4 rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    {success}
                </div>
            )}

            <div className="card p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
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
                                        value={formData.email}
                                        onChange={handleChange}
                                    />
                                </div>
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
                                        disabled={isSuperAdmin}
                                    >
                                        <option value="">Select a role...</option>
                                        {roles.map(role => (
                                            <option key={role.id} value={role.id}>
                                                {role.name} - {role.description}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {isSuperAdmin && (
                                    <p className="text-xs text-gray-500 mt-1">Super Admin role cannot be changed.</p>
                                )}
                            </div>

                            <div>
                                <label className="label">Status</label>
                                <select
                                    name="status"
                                    className="input-field"
                                    value={formData.status}
                                    onChange={handleChange}
                                    disabled={isSuperAdmin}
                                >
                                    <option value="ACTIVE">ACTIVE</option>
                                    <option value="INACTIVE">INACTIVE</option>
                                </select>
                            </div>

                            {isRevenueCollector && (
                                <div className="mt-2 border-t pt-4">
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
                        <Link href="/admin/users" className="btn-secondary">Cancel</Link>
                        <button type="submit" className="btn-primary flex items-center space-x-2" disabled={saving}>
                            {saving ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            ) : (
                                <Save className="w-5 h-5" />
                            )}
                            <span>Save Changes</span>
                        </button>
                    </div>
                </form>
            </div>

            <div className="card p-6">
                <form onSubmit={handlePasswordSubmit} className="space-y-6">
                    <div>
                        <h3 className="section-title flex items-center gap-2">
                            <KeyRound className="w-5 h-5 text-municipal-red" />
                            Change Password
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">Admin can set a new password for this user immediately.</p>
                        <div className="grid grid-cols-1 gap-6">
                            <div>
                                <label className="label">New Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="password"
                                        minLength={6}
                                        required
                                        className="input-field pl-10"
                                        placeholder="Minimum 6 characters"
                                        value={passwordData.password}
                                        onChange={(e) => setPasswordData(prev => ({ ...prev, password: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="label">Confirm Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="password"
                                        minLength={6}
                                        required
                                        className="input-field pl-10"
                                        placeholder="Re-enter password"
                                        value={passwordData.confirm}
                                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirm: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end pt-4 border-t">
                        <button type="submit" className="btn-primary flex items-center space-x-2" disabled={passwordSaving}>
                            {passwordSaving ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            ) : (
                                <KeyRound className="w-5 h-5" />
                            )}
                            <span>Update Password</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
