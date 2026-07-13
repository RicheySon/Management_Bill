'use client';

import { useState, useEffect } from 'react';
import { fetchAuditLogs } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';
import {
    Shield, Filter, Clock, User, Monitor
} from 'lucide-react';

export default function AuditPage() {
    const { hasPermission } = useAuth();
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        action_type: '',
        start_date: '',
        end_date: '',
        ip_address: '',
    });

    const loadData = async () => {
        try {
            setLoading(true);
            const logsData = await fetchAuditLogs(filters);
            setLogs(logsData);
        } catch (err) {
            console.error('Failed to load audit data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (hasPermission('view_logs')) loadData();
    }, [filters]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const actionTypes = [
        'USER_LOGIN',
        'USER_LOGIN_FAILED',
        'USER_LOGOUT',
        'USER_CREATED',
        'USER_STATUS_CHANGED',
        'BILL_GENERATED',
        'PAYMENT_RECORDED',
        'AMOUNT_CHANGE_REQUESTED',
        'AMOUNT_CHANGE_APPROVED',
        'AMOUNT_CHANGE_REJECTED',
        'CUSTOMER_CREATED',
        'PROPERTY_CREATED',
        'BUSINESS_CREATED',
    ];

    if (!hasPermission('view_logs')) {
        return <div className="card p-8 text-center text-red-600">You do not have permission to view audit logs.</div>;
    }

    if (loading && logs.length === 0) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-municipal-red"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Shield className="w-8 h-8 text-municipal-red" />
                    System Audit Logs
                </h1>
                <p className="text-gray-500">
                    Logins, amount changes, and system activity with IP / device metadata. MAC is unavailable in browsers.
                </p>
            </div>

            <div className="card p-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Action Type</label>
                        <select
                            name="action_type"
                            className="input-field mt-1"
                            value={filters.action_type}
                            onChange={handleFilterChange}
                        >
                            <option value="">All Actions</option>
                            {actionTypes.map((type) => (
                                <option key={type} value={type}>
                                    {type.replace(/_/g, ' ')}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">IP Address</label>
                        <input
                            type="text"
                            name="ip_address"
                            className="input-field mt-1"
                            value={filters.ip_address}
                            onChange={handleFilterChange}
                            placeholder="e.g. 41.210"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Start Date</label>
                        <input
                            type="date"
                            name="start_date"
                            className="input-field mt-1"
                            value={filters.start_date}
                            onChange={handleFilterChange}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">End Date</label>
                        <input
                            type="date"
                            name="end_date"
                            className="input-field mt-1"
                            value={filters.end_date}
                            onChange={handleFilterChange}
                        />
                    </div>
                    <div className="flex items-end">
                        <button onClick={loadData} className="btn-secondary w-full flex items-center justify-center gap-2">
                            <Filter className="w-4 h-4" />
                            Apply Filters
                        </button>
                    </div>
                </div>
            </div>

            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b">
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">MAC / Device</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {logs.length > 0 ? (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50 text-sm">
                                        <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-gray-400" />
                                                {new Date(log.created_at).toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4 text-gray-400" />
                                                <span className="font-medium text-gray-900">
                                                    {log.user_name || 'System'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-gray-600">
                                            {log.ip_address || '—'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                                            <div className="flex items-center gap-1">
                                                <Monitor className="w-3 h-3" />
                                                <span>{log.mac_address || 'unavailable'}</span>
                                            </div>
                                            {log.device_fingerprint && (
                                                <div className="text-[10px] text-gray-400 truncate max-w-[120px]" title={log.device_fingerprint}>
                                                    {log.device_fingerprint}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-gray-500">
                                            {log.entity_type || '—'} {log.entity_id ? `#${log.entity_id}` : ''}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 max-w-xs truncate text-xs" title={JSON.stringify(log.new_values || log.old_values || {})}>
                                            {log.new_values
                                                ? JSON.stringify(log.new_values).slice(0, 80)
                                                : log.user_agent?.slice(0, 60) || '—'}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                                        No audit logs found matching your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
