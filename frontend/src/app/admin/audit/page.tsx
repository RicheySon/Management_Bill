'use client';

import { useState, useEffect } from 'react';
import { fetchAuditLogs, fetchUsers } from '@/lib/api-client';
import {
    Shield, Search, Calendar, Filter,
    Clock, User, FileText, Activity
} from 'lucide-react';

export default function AuditPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        action_type: '',
        start_date: '',
        end_date: ''
    });

    const loadData = async () => {
        try {
            setLoading(true);
            const [logsData, usersData] = await Promise.all([
                fetchAuditLogs(filters),
                fetchUsers()
            ]);
            setLogs(logsData);
            setUsers(usersData);
        } catch (err) {
            console.error('Failed to load audit data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [filters]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const actionTypes = [
        'USER_LOGIN', 'USER_CREATED', 'USER_UPDATED',
        'BILL_GENERATED', 'PAYMENT_RECORDED',
        'CUSTOMER_CREATED', 'PROPERTY_CREATED', 'BUSINESS_CREATED'
    ];

    if (loading && logs.length === 0) return (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-municipal-red"></div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Shield className="w-8 h-8 text-municipal-red" />
                        System Audit Logs
                    </h1>
                    <p className="text-gray-500">Track system activities and user actions</p>
                </div>
            </div>

            {/* Filters */}
            <div className="card p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Action Type</label>
                        <select
                            name="action_type"
                            className="input-field mt-1"
                            value={filters.action_type}
                            onChange={handleFilterChange}
                        >
                            <option value="">All Actions</option>
                            {actionTypes.map(type => (
                                <option key={type} value={type}>{type.replace('_', ' ')}</option>
                            ))}
                        </select>
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
                        <button
                            onClick={loadData}
                            className="btn-secondary w-full flex items-center justify-center gap-2"
                        >
                            <Filter className="w-4 h-4" />
                            Apply Filters
                        </button>
                    </div>
                </div>
            </div>

            {/* Logs Table */}
            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b">
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {logs.length > 0 ? (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50 text-sm">
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-gray-400" />
                                                {new Date(log.created_at).toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4 text-gray-400" />
                                                <span className="font-medium text-gray-900">
                                                    {log.user_name || 'System'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${log.action.includes('DELETE') ? 'bg-red-100 text-red-800' :
                                                    log.action.includes('CREATE') ? 'bg-green-100 text-green-800' :
                                                        log.action.includes('UPDATE') ? 'bg-blue-100 text-blue-800' :
                                                            'bg-gray-100 text-gray-800'
                                                }`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-gray-500 font-mono text-xs">
                                                {log.entity_type.toUpperCase()} #{log.entity_id}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 max-w-md truncate" title={log.details}>
                                            {log.details}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
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
