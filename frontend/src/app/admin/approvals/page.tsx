'use client';

import { useEffect, useState } from 'react';
import {
    approveAmountChange,
    fetchAmountChanges,
    rejectAmountChange,
    fetchActionRequests,
    approveActionRequest,
    rejectActionRequest,
} from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';
import { CheckCircle2, XCircle, ShieldCheck, Clock } from 'lucide-react';

export default function ApprovalsPage() {
    const { hasPermission } = useAuth();
    const canAmount = hasPermission('approve_amount_changes');
    const canActions = hasPermission('approve_privileged_actions');

    const [tab, setTab] = useState<'amounts' | 'actions'>(canAmount ? 'amounts' : 'actions');
    const [requests, setRequests] = useState<any[]>([]);
    const [actionRequests, setActionRequests] = useState<any[]>([]);
    const [status, setStatus] = useState('PENDING');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [note, setNote] = useState<Record<string, string>>({});
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = async () => {
        try {
            setLoading(true);
            setError(null);
            if (tab === 'amounts' && canAmount) {
                const data = await fetchAmountChanges({ status, limit: 100 });
                setRequests(data);
            }
            if (tab === 'actions' && canActions) {
                const data = await fetchActionRequests({ status, limit: 100 });
                setActionRequests(data);
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load approval queue');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (canAmount || canActions) load();
    }, [status, tab]);

    if (!canAmount && !canActions) {
        return (
            <div className="card p-8 text-center text-red-600">
                You do not have permission to approve requests.
            </div>
        );
    }

    const handleApproveAmount = async (id: string) => {
        setBusyId(id);
        try {
            await approveAmountChange(id, note[id]);
            await load();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Approve failed');
        } finally {
            setBusyId(null);
        }
    };

    const handleRejectAmount = async (id: string) => {
        setBusyId(id);
        try {
            await rejectAmountChange(id, note[id]);
            await load();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Reject failed');
        } finally {
            setBusyId(null);
        }
    };

    const handleApproveAction = async (id: string) => {
        setBusyId(id);
        try {
            await approveActionRequest(id, note[id]);
            await load();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Approve failed');
        } finally {
            setBusyId(null);
        }
    };

    const handleRejectAction = async (id: string) => {
        setBusyId(id);
        try {
            await rejectActionRequest(id, note[id]);
            await load();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Reject failed');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <ShieldCheck className="w-8 h-8 text-municipal-red" />
                        Approvals
                    </h1>
                    <p className="text-gray-500">
                        Review amount changes and print/delete requests from officers and collectors.
                    </p>
                </div>
                <select
                    className="input-field w-48"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                >
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                    {tab === 'actions' && <option value="COMPLETED">Completed</option>}
                </select>
            </div>

            <div className="flex gap-2">
                {canAmount && (
                    <button
                        className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'amounts' ? 'bg-municipal-red text-white' : 'bg-white border text-gray-700'}`}
                        onClick={() => setTab('amounts')}
                    >
                        Amount Changes
                    </button>
                )}
                {canActions && (
                    <button
                        className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'actions' ? 'bg-municipal-red text-white' : 'bg-white border text-gray-700'}`}
                        onClick={() => setTab('actions')}
                    >
                        Print / Delete Requests
                    </button>
                )}
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{error}</div>
            )}

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-municipal-red" />
                </div>
            ) : tab === 'amounts' ? (
                requests.length === 0 ? (
                    <div className="card p-10 text-center text-gray-500">No {status.toLowerCase()} amount requests.</div>
                ) : (
                    <div className="space-y-4">
                        {requests.map((req) => {
                            const oldVals = typeof req.old_values === 'string' ? JSON.parse(req.old_values) : req.old_values;
                            const newVals = typeof req.new_values === 'string' ? JSON.parse(req.new_values) : req.new_values;
                            return (
                                <div key={req.id} className="card p-5 space-y-4">
                                    <div className="flex flex-wrap justify-between gap-3">
                                        <div>
                                            <p className="font-bold text-gray-900">
                                                {req.entity_type} #{req.entity_id}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                Requested by {req.requested_by_name || 'Unknown'} ·{' '}
                                                {new Date(req.created_at).toLocaleString()}
                                            </p>
                                            {req.reason && (
                                                <p className="text-sm text-gray-600 mt-1">Reason: {req.reason}</p>
                                            )}
                                        </div>
                                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-amber-50 text-amber-700">
                                            <Clock className="w-3 h-3" />
                                            {req.status}
                                        </span>
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                                        <div className="bg-gray-50 rounded-lg p-3">
                                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Old</p>
                                            <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(oldVals, null, 2)}</pre>
                                        </div>
                                        <div className="bg-green-50 rounded-lg p-3">
                                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">New</p>
                                            <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(newVals, null, 2)}</pre>
                                        </div>
                                    </div>

                                    {req.status === 'PENDING' && (
                                        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-end">
                                            <div className="flex-1">
                                                <label className="text-xs font-bold text-gray-500 uppercase">Review note</label>
                                                <input
                                                    className="input-field mt-1"
                                                    value={note[req.id] || ''}
                                                    onChange={(e) =>
                                                        setNote((prev) => ({ ...prev, [req.id]: e.target.value }))
                                                    }
                                                    placeholder="Optional note"
                                                />
                                            </div>
                                            <button
                                                className="btn-primary flex items-center justify-center gap-2"
                                                disabled={busyId === req.id}
                                                onClick={() => handleApproveAmount(req.id)}
                                            >
                                                <CheckCircle2 className="w-4 h-4" />
                                                Approve
                                            </button>
                                            <button
                                                className="btn-secondary flex items-center justify-center gap-2 text-red-700"
                                                disabled={busyId === req.id}
                                                onClick={() => handleRejectAmount(req.id)}
                                            >
                                                <XCircle className="w-4 h-4" />
                                                Reject
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )
            ) : actionRequests.length === 0 ? (
                <div className="card p-10 text-center text-gray-500">No {status.toLowerCase()} print/delete requests.</div>
            ) : (
                <div className="space-y-4">
                    {actionRequests.map((req) => (
                        <div key={req.id} className="card p-5 space-y-4">
                            <div className="flex flex-wrap justify-between gap-3">
                                <div>
                                    <p className="font-bold text-gray-900">
                                        {req.action_type.replace('_', ' ')} — {req.bill_number || req.bill_id}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {req.customer_name || 'Customer'} · Requested by {req.requested_by_name || 'Unknown'} ·{' '}
                                        {new Date(req.created_at).toLocaleString()}
                                    </p>
                                    {req.reason && (
                                        <p className="text-sm text-gray-600 mt-1">Reason: {req.reason}</p>
                                    )}
                                </div>
                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-amber-50 text-amber-700">
                                    <Clock className="w-3 h-3" />
                                    {req.status}
                                </span>
                            </div>

                            {req.status === 'PENDING' && (
                                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-end">
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Review note</label>
                                        <input
                                            className="input-field mt-1"
                                            value={note[req.id] || ''}
                                            onChange={(e) =>
                                                setNote((prev) => ({ ...prev, [req.id]: e.target.value }))
                                            }
                                            placeholder="Optional note"
                                        />
                                    </div>
                                    <button
                                        className="btn-primary flex items-center justify-center gap-2"
                                        disabled={busyId === req.id}
                                        onClick={() => handleApproveAction(req.id)}
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        Approve
                                    </button>
                                    <button
                                        className="btn-secondary flex items-center justify-center gap-2 text-red-700"
                                        disabled={busyId === req.id}
                                        onClick={() => handleRejectAction(req.id)}
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Reject
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
