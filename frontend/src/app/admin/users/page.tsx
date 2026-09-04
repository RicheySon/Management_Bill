'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchUsers, updateUserStatus, deleteUser, updateUserPassword } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';
import {
    Users, Plus, Search, Pencil, Trash2, KeyRound,
    UserCheck, UserX, CheckCircle2, X
} from 'lucide-react';

export default function UsersPage() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [passwordUser, setPasswordUser] = useState<any | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordSaving, setPasswordSaving] = useState(false);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const data = await fetchUsers();
            setUsers(data);
        } catch (err) {
            console.error('Failed to load users:', err);
            setError('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const flashSuccess = (message: string) => {
        setSuccessMessage(message);
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    const flashError = (message: string) => {
        setError(message);
        setTimeout(() => setError(null), 4000);
    };

    const isSuperAdmin = (user: any) => user.roles?.includes('Super Admin');

    const handleStatusChange = async (user: any) => {
        if (isSuperAdmin(user)) return;
        if (currentUser?.id === user.id) {
            flashError('You cannot deactivate your own account');
            return;
        }
        const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        try {
            setBusyId(user.id);
            await updateUserStatus(user.id, newStatus);
            flashSuccess(`User ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`);
            await loadUsers();
        } catch (err: any) {
            flashError(err.response?.data?.error || 'Failed to update user status');
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (user: any) => {
        if (isSuperAdmin(user)) return;
        if (currentUser?.id === user.id) {
            flashError('You cannot delete your own account');
            return;
        }
        const confirmed = window.confirm(
            `Delete user "${user.full_name}" (${user.email})?\n\nThis cannot be undone.`
        );
        if (!confirmed) return;
        try {
            setBusyId(user.id);
            await deleteUser(user.id);
            flashSuccess('User deleted successfully');
            await loadUsers();
        } catch (err: any) {
            flashError(err.response?.data?.error || 'Failed to delete user');
        } finally {
            setBusyId(null);
        }
    };

    const openPasswordModal = (user: any) => {
        setPasswordUser(user);
        setNewPassword('');
        setConfirmPassword('');
    };

    const handlePasswordSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!passwordUser) return;
        if (newPassword.length < 6) {
            flashError('Password must be at least 6 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            flashError('Passwords do not match');
            return;
        }
        try {
            setPasswordSaving(true);
            await updateUserPassword(passwordUser.id, newPassword);
            setPasswordUser(null);
            setNewPassword('');
            setConfirmPassword('');
            flashSuccess(`Password updated for ${passwordUser.full_name}`);
        } catch (err: any) {
            flashError(err.response?.data?.error || 'Failed to update password');
        } finally {
            setPasswordSaving(false);
        }
    };

    const filteredUsers = users.filter(user =>
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-municipal-red"></div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Users className="w-8 h-8 text-municipal-red" />
                        User Management
                    </h1>
                    <p className="text-gray-500">Manage system users and access roles</p>
                </div>
                <Link
                    href="/admin/users/new"
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Add New User
                </Link>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
                    <UserX className="w-5 h-5" />
                    {error}
                </div>
            )}

            {successMessage && (
                <div className="bg-green-50 text-green-600 p-4 rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    {successMessage}
                </div>
            )}

            <div className="card p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search users by name or email..."
                        className="input-field pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b">
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map((user) => {
                                    const superAdmin = isSuperAdmin(user);
                                    const isSelf = currentUser?.id === user.id;
                                    const rowBusy = busyId === user.id;
                                    return (
                                        <tr key={user.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center text-municipal-red font-bold">
                                                        {user.full_name.charAt(0)}
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                                                        <div className="text-sm text-gray-500">{user.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {user.roles?.filter(Boolean).map((role: string) => (
                                                        <span key={role} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                            {role}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.status === 'ACTIVE'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {user.status === 'ACTIVE' && <UserCheck className="w-3 h-3 mr-1" />}
                                                    {user.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex flex-wrap justify-end gap-2">
                                                    <Link
                                                        href={`/admin/users/${user.id}/edit`}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                        Edit
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        onClick={() => openPasswordModal(user)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
                                                    >
                                                        <KeyRound className="w-3.5 h-3.5" />
                                                        Password
                                                    </button>
                                                    {!superAdmin && (
                                                        <button
                                                            type="button"
                                                            disabled={rowBusy || isSelf}
                                                            onClick={() => handleStatusChange(user)}
                                                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border disabled:opacity-50 ${user.status === 'ACTIVE'
                                                                ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                                                                : 'border-green-200 text-green-700 hover:bg-green-50'
                                                                }`}
                                                        >
                                                            {user.status === 'ACTIVE' ? (
                                                                <><UserX className="w-3.5 h-3.5" /> Deactivate</>
                                                            ) : (
                                                                <><UserCheck className="w-3.5 h-3.5" /> Activate</>
                                                            )}
                                                        </button>
                                                    )}
                                                    {!superAdmin && (
                                                        <button
                                                            type="button"
                                                            disabled={rowBusy || isSelf}
                                                            onClick={() => handleDelete(user)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                                        No users found matching your search.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {passwordUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between px-5 py-4 border-b">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
                                <p className="text-sm text-gray-500">{passwordUser.full_name} · {passwordUser.email}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPasswordUser(null)}
                                className="p-1 rounded hover:bg-gray-100"
                                aria-label="Close"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <form onSubmit={handlePasswordSave} className="p-5 space-y-4">
                            <div>
                                <label className="label">New Password</label>
                                <input
                                    type="password"
                                    className="input-field"
                                    minLength={6}
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Minimum 6 characters"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="label">Confirm Password</label>
                                <input
                                    type="password"
                                    className="input-field"
                                    minLength={6}
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Re-enter password"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => setPasswordUser(null)}
                                    disabled={passwordSaving}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" disabled={passwordSaving}>
                                    {passwordSaving ? 'Saving...' : 'Update Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
