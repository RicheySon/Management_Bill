'use client';

import { useEffect, useState } from 'react';
import {
    approveAmountChange,
    fetchAmountChanges,
    rejectAmountChange,
} from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';
import { CheckCircle2, XCircle, ShieldCheck, Clock } from 'lucide-react';

export default function ApprovalsPage() {
    const { hasPermission } = useAuth();
    const [requests, setRequests] = useState<any[]>([]);
    const [status, setStatus] = useState('PENDING');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [note, setNote] = useState<Record<string, string>>({});
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await fetchAmountChanges({ status, limit: 100 });
            setRequests(data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load approval queue');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (hasPermission('approve_amount_changes')) load();
    }, [status]);

    if (!hasPermission('approve_amount_changes')) {
        return (
            <div className="card p-8 text-center text-red-600">
                Only Super Admin can approve amount changes.
            </div>
        );
    }

    const handleApprove = async (id: string) => {
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

    const handleReject = async (id: string) => {
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

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <ShieldCheck className="w-8 h-8 text-municipal-red" />
                        Amount Change Approvals
                    </h1>
                    <p className="text-gray-500">
                        Review pending bill and fee rate changes. Approving applies them; rejecting discards them.
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
                </select>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{error}</div>
            )}

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-municipal-red" />
                </div>
            ) : requests.length === 0 ? (
                <div className="card p-10 text-center text-gray-500">No {status.toLowerCase()} requests.</div>
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
                                            onClick={() => handleApprove(req.id)}
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            Approve
                                        </button>
                                        <button
                                            className="btn-secondary flex items-center justify-center gap-2 text-red-700"
                                            disabled={busyId === req.id}
                                            onClick={() => handleReject(req.id)}
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
            )}
        </div>
    );
}
