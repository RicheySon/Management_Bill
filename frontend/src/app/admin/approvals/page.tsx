'use client';

import { useEffect, useState } from 'react';
import {
    approveAmountChange,
    fetchAmountChanges,
    rejectAmountChange,
    fetchActionRequests,
    approveActionRequest,
    rejectActionRequest,
    fetchChequePayments,
    approveChequePayment,
    rejectChequePayment,
} from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';
import { CheckCircle2, XCircle, ShieldCheck, Clock } from 'lucide-react';
import Link from 'next/link';

type Tab = 'amounts' | 'actions' | 'cheques';

export default function ApprovalsPage() {
    const { hasPermission } = useAuth();
    const canAmount = hasPermission('approve_amount_changes');
    const canActions = hasPermission('approve_privileged_actions');
    const canCheques = hasPermission('approve_cheque_payments');

    const defaultTab: Tab = canCheques ? 'cheques' : canAmount ? 'amounts' : 'actions';
    const [tab, setTab] = useState<Tab>(defaultTab);
    const [requests, setRequests] = useState<any[]>([]);
    const [actionRequests, setActionRequests] = useState<any[]>([]);
    const [chequePayments, setChequePayments] = useState<any[]>([]);
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
            if (tab === 'cheques' && canCheques) {
                const chequeStatus =
                    status === 'APPROVED' ? 'CLEARED' : status === 'REJECTED' ? 'REJECTED' : 'PENDING';
                const data = await fetchChequePayments({ status: chequeStatus, limit: 100 });
                setChequePayments(data);
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load approval queue');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (canAmount || canActions || canCheques) load();
    }, [status, tab]);

    if (!canAmount && !canActions && !canCheques) {
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

    const handleApproveCheque = async (id: string) => {
        setBusyId(id);
        try {
            await approveChequePayment(id, note[id] || 'Cheque cleared — funds received');
            await load();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Cheque clearance failed');
        } finally {
            setBusyId(null);
        }
    };

    const handleRejectCheque = async (id: string) => {
        setBusyId(id);
        try {
            await rejectChequePayment(id, note[id] || 'Cheque bounced');
            await load();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Cheque decline failed');
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
                        Review cheque clearances, amount changes, and print/delete requests.
                    </p>
                </div>
                <select
                    className="input-field w-48"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                >
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">{tab === 'cheques' ? 'Cleared' : 'Approved'}</option>
                    <option value="REJECTED">Rejected</option>
                    {tab === 'actions' && <option value="COMPLETED">Completed</option>}
                </select>
            </div>

            <div className="flex flex-wrap gap-2">
                {canCheques && (
                    <button
                        className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'cheques' ? 'bg-municipal-red text-white' : 'bg-white border text-gray-700'}`}
                        onClick={() => setTab('cheques')}
                    >
                        Cheque Clearance
                    </button>
                )}
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
            ) : tab === 'cheques' ? (
                chequePayments.length === 0 ? (
                    <div className="card p-10 text-center text-gray-500">
                        No {status === 'APPROVED' ? 'cleared' : status.toLowerCase()} cheque payments.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {chequePayments.map((pay) => (
                            <div key={pay.id} className="card p-5 space-y-4">
                                <div className="flex flex-wrap justify-between gap-3">
                                    <div>
                                        <p className="font-bold text-gray-900">
                                            Cheque · {pay.receipt_number} · GHS {parseFloat(pay.amount).toFixed(2)}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            {pay.customer_name} · Bill{' '}
                                            <Link href={`/billing/${pay.bill_id}`} className="text-municipal-red hover:underline">
                                                {pay.bill_number}
                                            </Link>
                                            {' · '}GCR {pay.gcr_number}
                                        </p>
                                        <p className="text-sm text-gray-500 mt-1">
                                            Recorded by {pay.recorded_by_name || 'Unknown'} ·{' '}
                                            {new Date(pay.created_at || pay.payment_date).toLocaleString()}
                                        </p>
                                        {pay.clearance_note && (
                                            <p className="text-sm text-gray-600 mt-1">Note: {pay.clearance_note}</p>
                                        )}
                                        {pay.cleared_by_name && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Reviewed by {pay.cleared_by_name}
                                                {pay.cleared_at ? ` · ${new Date(pay.cleared_at).toLocaleString()}` : ''}
                                            </p>
                                        )}
                                    </div>
                                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded ${
                                        pay.clearance_status === 'PENDING'
                                            ? 'bg-amber-50 text-amber-700'
                                            : pay.clearance_status === 'CLEARED'
                                              ? 'bg-green-50 text-green-700'
                                              : 'bg-red-50 text-red-700'
                                    }`}>
                                        <Clock className="w-3 h-3" />
                                        {pay.clearance_status}
                                    </span>
                                </div>

                                {pay.clearance_status === 'PENDING' && (
                                    <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-end">
                                        <div className="flex-1">
                                            <label className="text-xs font-bold text-gray-500 uppercase">Review note</label>
                                            <input
                                                className="input-field mt-1"
                                                placeholder="e.g. Cleared at bank / Cheque bounced"
                                                value={note[pay.id] || ''}
                                                onChange={(e) => setNote({ ...note, [pay.id]: e.target.value })}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            disabled={busyId === pay.id}
                                            onClick={() => handleApproveCheque(pay.id)}
                                            className="btn-primary inline-flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            Approve (cleared)
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busyId === pay.id}
                                            onClick={() => handleRejectCheque(pay.id)}
                                            className="btn-secondary text-red-700 border-red-200 hover:bg-red-50 inline-flex items-center justify-center gap-2"
                                        >
                                            <XCircle className="w-4 h-4" />
                                            Decline (bounced)
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )
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
                                                    onChange={(e) => setNote({ ...note, [req.id]: e.target.value })}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                disabled={busyId === req.id}
                                                onClick={() => handleApproveAmount(req.id)}
                                                className="btn-primary inline-flex items-center justify-center gap-2"
                                            >
                                                <CheckCircle2 className="w-4 h-4" />
                                                Approve
                                            </button>
                                            <button
                                                type="button"
                                                disabled={busyId === req.id}
                                                onClick={() => handleRejectAmount(req.id)}
                                                className="btn-secondary text-red-700 border-red-200 hover:bg-red-50 inline-flex items-center justify-center gap-2"
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
                <div className="card p-10 text-center text-gray-500">No {status.toLowerCase()} action requests.</div>
            ) : (
                <div className="space-y-4">
                    {actionRequests.map((req) => (
                        <div key={req.id} className="card p-5 space-y-4">
                            <div className="flex flex-wrap justify-between gap-3">
                                <div>
                                    <p className="font-bold text-gray-900">{req.action_type}</p>
                                    <p className="text-sm text-gray-500">
                                        Requested by {req.requested_by_name || 'Unknown'} ·{' '}
                                        {new Date(req.created_at).toLocaleString()}
                                    </p>
                                    {req.reason && <p className="text-sm text-gray-600 mt-1">Reason: {req.reason}</p>}
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
                                            onChange={(e) => setNote({ ...note, [req.id]: e.target.value })}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        disabled={busyId === req.id}
                                        onClick={() => handleApproveAction(req.id)}
                                        className="btn-primary inline-flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        Approve
                                    </button>
                                    <button
                                        type="button"
                                        disabled={busyId === req.id}
                                        onClick={() => handleRejectAction(req.id)}
                                        className="btn-secondary text-red-700 border-red-200 hover:bg-red-50 inline-flex items-center justify-center gap-2"
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
