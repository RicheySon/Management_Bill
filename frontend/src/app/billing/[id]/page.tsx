'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    fetchBill,
    recordPayment,
    downloadBillPDF,
    printBillPDF,
    requestBillAmountChange,
    approveChequePayment,
    rejectChequePayment,
} from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';
import {
    ArrowLeft, Printer, CreditCard,
    User, Building2, Briefcase, Calendar,
    Wallet, CheckCircle2, AlertCircle, History,
    FileDown, Pencil, XCircle
} from 'lucide-react';

import { GCR_HINT, GCR_PLACEHOLDER, formatGcrInput, isValidGcr, normalizeGcr } from '@/lib/gcr';

export default function BillDetailPage() {
    const params = useParams();
    const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);
    const router = useRouter();
    const { hasPermission, user } = useAuth();
    const [bill, setBill] = useState<any>(null);
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [gcrNumber, setGcrNumber] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [amountForm, setAmountForm] = useState({ current_rate: '', arrears: '', rebate: '', reason: '' });
    const [amountMsg, setAmountMsg] = useState<string | null>(null);
    const [actionMsg, setActionMsg] = useState<string | null>(null);
    const [chequeBusyId, setChequeBusyId] = useState<string | null>(null);

    const canPrintDirect = hasPermission('print_bill') || hasPermission('bulk_print') || hasPermission('manage_users');
    const canPay = hasPermission('record_payment');
    const canClearCheques = hasPermission('approve_cheque_payments');

    const loadBill = async () => {
        if (!id) {
            setError('Invalid bill link');
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await fetchBill(id);
            const billRow = data.bill ?? data;
            let details = billRow.bill_details;
            if (typeof details === 'string') {
                try {
                    details = JSON.parse(details);
                } catch {
                    details = null;
                }
            }
            billRow.bill_details = details;
            const paymentRows = data.payments ?? [];
            setBill(billRow);
            setPayments(paymentRows);
            const outstanding = parseFloat(billRow.total_amount) - parseFloat(billRow.amount_paid || 0);
            const pendingCheque = paymentRows
                .filter((p: any) => p.clearance_status === 'PENDING')
                .reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);
            const available = Math.max(0, outstanding - pendingCheque);
            setPaymentAmount(available.toFixed(2));
            setAmountForm({
                current_rate: String(billRow.current_rate ?? ''),
                arrears: String(billRow.arrears ?? ''),
                rebate: String(billRow.rebate ?? ''),
                reason: '',
            });
        } catch (err: any) {
            const apiError = err.response?.data?.error;
            setError(apiError || err.message || 'Failed to load bill details');
            setBill(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBill();
    }, [id]);

    useEffect(() => {
        if (loading || !bill || !canPay) return;
        if (typeof window === 'undefined') return;
        if (window.location.hash !== '#payment') return;
        const el = document.getElementById('payment');
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [loading, bill, canPay]);

    const handlePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        try {
            const gcr = normalizeGcr(gcrNumber);
            if (!isValidGcr(gcr)) {
                throw new Error(GCR_HINT);
            }
            const res = await recordPayment(id as string, {
                amount: parseFloat(paymentAmount),
                payment_method: paymentMethod,
                gcr_number: gcr,
                customer_id: bill.customer_id,
            });
            setSuccess(true);
            setSuccessMsg(res.message || 'Payment recorded');
            setGcrNumber('');
            await loadBill();
            setTimeout(() => setSuccess(false), 5000);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to record payment');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleApproveCheque = async (paymentId: string) => {
        setChequeBusyId(paymentId);
        setError(null);
        try {
            await approveChequePayment(paymentId, 'Cheque cleared — funds received');
            setSuccess(true);
            setSuccessMsg('Cheque approved. Amount applied to the bill.');
            await loadBill();
            setTimeout(() => setSuccess(false), 4000);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to approve cheque');
        } finally {
            setChequeBusyId(null);
        }
    };

    const handleRejectCheque = async (paymentId: string) => {
        setChequeBusyId(paymentId);
        setError(null);
        try {
            await rejectChequePayment(paymentId, 'Cheque bounced');
            setSuccess(true);
            setSuccessMsg('Cheque declined as bounced. Bill balance unchanged.');
            await loadBill();
            setTimeout(() => setSuccess(false), 4000);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to decline cheque');
        } finally {
            setChequeBusyId(null);
        }
    };

    const canRequestAmountChange =
        hasPermission('generate_bill') ||
        hasPermission('delete_bill') ||
        hasPermission('configure_rates') ||
        hasPermission('approve_amount_changes');

    const handleAmountChangeRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setAmountMsg(null);
        setError(null);
        try {
            const res = await requestBillAmountChange(id as string, {
                current_rate: parseFloat(amountForm.current_rate),
                arrears: parseFloat(amountForm.arrears),
                rebate: parseFloat(amountForm.rebate),
                reason: amountForm.reason,
            });
            if (res.applied) {
                setAmountMsg(res.message || 'Bill amount updated successfully');
                await loadBill();
            } else {
                setAmountMsg(res.message || 'Submitted for Super Admin approval');
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to submit amount change');
        }
    };

    if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-municipal-red"></div></div>;
    if (!bill) {
        return (
            <div className="text-center py-20 space-y-3">
                <p className="text-red-600 font-semibold">{error || 'Bill not found'}</p>
                <button onClick={() => router.push('/billing')} className="btn-secondary">
                    Back to Billing
                </button>
            </div>
        );
    }

    const balance = parseFloat(bill.total_amount) - parseFloat(bill.amount_paid);
    const pendingChequeTotal = payments
        .filter((p: any) => p.clearance_status === 'PENDING')
        .reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);
    const availableToPay = Math.max(0, balance - pendingChequeTotal);

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <button onClick={() => router.back()} className="btn-secondary flex items-center space-x-2">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                </button>
                <div className="flex space-x-3 flex-wrap">
                    {canPrintDirect && (
                        <>
                            <button
                                onClick={() => printBillPDF(bill.id)}
                                className="btn-primary flex items-center space-x-2"
                            >
                                <Printer className="w-4 h-4" />
                                <span>Print Hardcopy</span>
                            </button>
                            <button
                                onClick={() => downloadBillPDF(bill.id)}
                                className="btn-secondary flex items-center space-x-2"
                            >
                                <FileDown className="w-4 h-4" />
                                <span>Download PDF</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {actionMsg && (
                <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-sm border border-amber-200">
                    {actionMsg}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="card overflow-hidden">
                        <div className={`px-4 sm:px-6 py-4 flex justify-between items-center gap-3 ${bill.payment_status === 'PAID' ? 'bg-green-600' : 'bg-municipal-red'} text-white`}>
                            <div className="min-w-0">
                                <h2 className="text-xl sm:text-2xl font-bold truncate">{bill.bill_number}</h2>
                                <p className="text-sm opacity-90 truncate">{bill.bill_type} Invoice - {bill.bill_period_year}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <span className="text-xs uppercase tracking-wider opacity-75">Status</span>
                                <p className="text-base sm:text-lg font-bold">{bill.payment_status}</p>
                            </div>
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-400 text-xs uppercase tracking-widest">Customer Information</h3>
                                <div className="flex items-start space-x-3">
                                    <User className="w-5 h-5 text-gray-400 mt-1" />
                                    <div>
                                        <p className="font-bold text-gray-900">{bill.full_name}</p>
                                        <p className="text-sm text-gray-500">{bill.phone_number}</p>
                                    </div>
                                </div>
                                <div className="flex items-start space-x-3">
                                    {bill.bill_type === 'BOP' ? <Briefcase className="w-5 h-5 text-gray-400 mt-1" /> : <Building2 className="w-5 h-5 text-gray-400 mt-1" />}
                                    <div>
                                        <p className="font-bold text-gray-900">
                                            {bill.bill_type === 'BOP' ? bill.business_name : bill.property_number}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            {bill.bill_type === 'BOP' ? bill.business_number : bill.classification_name}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-400 text-xs uppercase tracking-widest">Invoice Details</h3>
                                <div className="flex items-center space-x-3 text-sm">
                                    <Calendar className="w-5 h-5 text-gray-400" />
                                    <span className="text-gray-600">Issued On: {bill.issue_date ? new Date(bill.issue_date).toLocaleDateString() : 'N/A'}</span>
                                </div>
                                <div className="flex items-center space-x-3 text-sm">
                                    <History className="w-5 h-5 text-gray-400" />
                                    <span className="text-gray-600">Billing Year: {bill.bill_period_year}</span>
                                </div>
                            </div>
                        </div>

                        <div className="border-t bg-gray-50 p-6">
                            <div className="flex flex-col space-y-2">
                                <div className="flex justify-between text-gray-600">
                                    <span>Current Charge</span>
                                    <span>GHS {parseFloat(bill.current_rate || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-gray-600">
                                    <span>Basic Rate (annual)</span>
                                    <span>
                                        GHS{' '}
                                        {parseFloat(
                                            bill.bill_details?.basic_rate ??
                                                bill.basic_rate ??
                                                8
                                        ).toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-gray-600">
                                    <span>Arrears</span>
                                    <span>GHS {parseFloat(bill.arrears || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-gray-600 border-b pb-2">
                                    <span>Rebate / Discount</span>
                                    <span className="text-green-600">- GHS {parseFloat(bill.rebate || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-lg font-bold pt-2 text-gray-900">
                                    <span>Total Bill Amount</span>
                                    <span>GHS {parseFloat(bill.total_amount || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm font-semibold text-green-600">
                                    <span>Total Paid to Date</span>
                                    <span>GHS {parseFloat(bill.amount_paid || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xl font-black text-red-600 mt-2 p-3 bg-red-50 rounded-lg border border-red-100">
                                    <span>Outstanding Balance</span>
                                    <span>GHS {Math.max(0, balance).toFixed(2)}</span>
                                </div>
                                {pendingChequeTotal > 0 && (
                                    <div className="flex justify-between text-sm font-semibold text-amber-700 mt-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
                                        <span>Pending cheque(s) held</span>
                                        <span>GHS {pendingChequeTotal.toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <h3 className="text-lg font-bold mb-4 flex items-center space-x-2">
                            <History className="w-5 h-5 text-municipal-red" />
                            <span>Payment History</span>
                        </h3>
                        {payments && payments.length > 0 ? (
                            <div className="space-y-3">
                                {payments.map((p: any) => (
                                    <div key={p.id} className="p-3 border rounded-lg bg-white space-y-2">
                                        <div className="flex justify-between items-start gap-3">
                                            <div>
                                                <p className="font-bold text-gray-900">{p.receipt_number}</p>
                                                <p className="text-xs text-gray-500">
                                                    GCR: {p.gcr_number || 'N/A'} • {new Date(p.payment_date).toLocaleString()} • {p.payment_method}
                                                </p>
                                                <p className="text-xs text-municipal-red font-medium mt-1">
                                                    Recorded by: {p.recorded_by_name || user?.full_name || 'Unknown'}
                                                </p>
                                                {p.clearance_status && p.clearance_status !== 'CLEARED' && (
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Clearance: {p.clearance_status}
                                                        {p.cleared_by_name ? ` · by ${p.cleared_by_name}` : ''}
                                                        {p.clearance_note ? ` · ${p.clearance_note}` : ''}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-bold ${
                                                    p.clearance_status === 'PENDING'
                                                        ? 'text-amber-600'
                                                        : p.clearance_status === 'REJECTED'
                                                          ? 'text-red-600'
                                                          : 'text-green-600'
                                                }`}>
                                                    GHS {parseFloat(p.amount).toFixed(2)}
                                                </p>
                                                {p.clearance_status === 'PENDING' && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                                                        Awaiting clearance
                                                    </span>
                                                )}
                                                {p.clearance_status === 'REJECTED' && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-red-700 bg-red-50 px-2 py-0.5 rounded">
                                                        Bounced
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {canClearCheques && p.clearance_status === 'PENDING' && (
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                <button
                                                    type="button"
                                                    disabled={chequeBusyId === p.id}
                                                    onClick={() => handleApproveCheque(p.id)}
                                                    className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1"
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    Approve cleared
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={chequeBusyId === p.id}
                                                    onClick={() => handleRejectCheque(p.id)}
                                                    className="btn-secondary text-xs py-1.5 px-3 text-red-700 border-red-200 hover:bg-red-50 inline-flex items-center gap-1"
                                                >
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    Decline bounced
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 italic text-center py-4">No payments recorded yet.</p>
                        )}
                    </div>

                    {canRequestAmountChange && (
                        <div className="card">
                            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                                <Pencil className="w-5 h-5 text-municipal-red" />
                                Edit Amounts (incl. Arrears)
                            </h3>
                            <p className="text-sm text-gray-500 mb-4">
                                Edit current rate, <strong>arrears</strong>, and rebate.
                                Super Admins apply changes immediately; other roles send them for approval.
                            </p>
                            {amountMsg && (
                                <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-sm mb-4 border border-amber-200">
                                    {amountMsg}
                                </div>
                            )}
                            <form onSubmit={handleAmountChangeRequest} className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase">Current Rate</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="input-field mt-1"
                                        value={amountForm.current_rate}
                                        onChange={(e) => setAmountForm({ ...amountForm, current_rate: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase">Arrears (amount already owed)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="input-field mt-1 border-amber-300 focus:ring-amber-500"
                                        value={amountForm.arrears}
                                        onChange={(e) => setAmountForm({ ...amountForm, arrears: e.target.value })}
                                        required
                                    />
                                    <p className="text-[11px] text-gray-500 mt-1">Enter or adjust outstanding prior balance.</p>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase">Rebate</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="input-field mt-1"
                                        value={amountForm.rebate}
                                        onChange={(e) => setAmountForm({ ...amountForm, rebate: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase">Reason</label>
                                    <input
                                        type="text"
                                        className="input-field mt-1"
                                        value={amountForm.reason}
                                        onChange={(e) => setAmountForm({ ...amountForm, reason: e.target.value })}
                                        placeholder="Why is this change needed?"
                                    />
                                </div>
                                    <div className="md:col-span-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm flex justify-between items-center">
                                    <span className="font-medium text-gray-600">Estimated total (incl. GHS 8 basic rate)</span>
                                    <span className="font-bold text-gray-900">
                                        GHS{' '}
                                        {(
                                            (parseFloat(amountForm.current_rate) || 0) +
                                            8 +
                                            (parseFloat(amountForm.arrears) || 0) -
                                            (parseFloat(amountForm.rebate) || 0)
                                        ).toFixed(2)}
                                    </span>
                                </div>
                                <div className="md:col-span-2">
                                    <button type="submit" className="btn-secondary">
                                        Submit Amount / Arrears Change for Approval
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    {canPay && (
                        <div id="payment" className="card lg:sticky lg:top-6 scroll-mt-24">
                            <h3 className="text-lg font-bold mb-4 flex items-center space-x-2">
                                <CreditCard className="w-5 h-5 text-municipal-red" />
                                <span>Record Payment</span>
                            </h3>

                            {success && (
                                <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm mb-4 border border-green-200 flex items-start space-x-2">
                                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <span>{successMsg || 'Payment recorded successfully!'}</span>
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4 border border-red-200 flex items-center space-x-2">
                                    <AlertCircle className="w-4 h-4" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <form onSubmit={handlePayment} className="space-y-4">
                                <div>
                                    <label className="label">Amount to Pay (GHS)</label>
                                    <div className="relative">
                                        <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="input-field pl-10"
                                            placeholder="0.00"
                                            value={paymentAmount}
                                            onChange={(e) => setPaymentAmount(e.target.value)}
                                            disabled={availableToPay <= 0}
                                            max={availableToPay}
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="label">Payment Method</label>
                                    <select
                                        className="input-field"
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        disabled={availableToPay <= 0}
                                    >
                                        <option value="CASH">Cash</option>
                                        <option value="MOBILE_MONEY">Mobile Money</option>
                                        <option value="BANK_TRANSFER">Bank Transfer</option>
                                        <option value="CHEQUE">Cheque</option>
                                    </select>
                                    {paymentMethod === 'CHEQUE' && (
                                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mt-2">
                                            Cheque payments do not hit the account until a Revenue Officer confirms the cheque has cleared. If it bounces, they will decline it.
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="label">General Counterfoil Receipt (GCR) Number</label>
                                    <input
                                        type="text"
                                        className="input-field font-mono tracking-wider"
                                        placeholder={GCR_PLACEHOLDER}
                                        value={gcrNumber}
                                        onChange={(e) => setGcrNumber(formatGcrInput(e.target.value))}
                                        disabled={availableToPay <= 0}
                                        minLength={10}
                                        maxLength={10}
                                        inputMode="numeric"
                                        autoComplete="off"
                                        enterKeyHint="done"
                                        required
                                    />
                                    <p className="text-[11px] text-gray-500 mt-1 leading-snug">{GCR_HINT}</p>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full btn-primary py-3 flex items-center justify-center space-x-2 disabled:bg-gray-300 disabled:shadow-none"
                                    disabled={isSubmitting || availableToPay <= 0 || !paymentAmount || !gcrNumber.trim()}
                                >
                                    {isSubmitting ? (
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    ) : (
                                        <CheckCircle2 className="w-5 h-5" />
                                    )}
                                    <span>{paymentMethod === 'CHEQUE' ? 'Submit Cheque (pending clearance)' : 'Confirm Payment'}</span>
                                </button>
                            </form>

                            {availableToPay <= 0 && balance > 0 && (
                                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
                                    <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                                    <p className="text-amber-900 font-bold">Outstanding is fully covered by pending cheque(s).</p>
                                    <p className="text-amber-800 text-sm mt-1">Await Revenue Officer clearance before recording another payment.</p>
                                </div>
                            )}

                            {balance <= 0 && (
                                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                                    <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                                    <p className="text-green-800 font-bold">This bill is fully paid!</p>
                                </div>
                            )}
                        </div>
                    )}

                    {!canPay && (
                        <div className="card text-sm text-gray-500">
                            You do not have permission to record payments on this bill.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
