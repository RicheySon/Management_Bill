'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    fetchBill,
    recordPayment,
    downloadBillPDF,
    printBillPDF,
    requestBillAmountChange,
    requestPrivilegedAction,
} from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';
import {
    ArrowLeft, Printer, CreditCard,
    User, Building2, Briefcase, Calendar,
    Wallet, CheckCircle2, AlertCircle, History,
    FileDown, Pencil, Send
} from 'lucide-react';

const GCR_HINT = 'Enter the General Counterfoil Receipt serial from the GCR book (4–20 characters). Examples: 012345 or GCR-012345';

export default function BillDetailPage() {
    const { id } = useParams();
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
    const [amountForm, setAmountForm] = useState({ current_rate: '', arrears: '', rebate: '', reason: '' });
    const [amountMsg, setAmountMsg] = useState<string | null>(null);
    const [actionMsg, setActionMsg] = useState<string | null>(null);

    const canPrintDirect = hasPermission('print_bill') || hasPermission('bulk_print') || hasPermission('manage_users');
    const canRequestPrint = hasPermission('request_print');
    const canPay = hasPermission('record_payment');

    const loadBill = async () => {
        try {
            const data = await fetchBill(id as string);
            const billRow = data.bill ?? data;
            const paymentRows = data.payments ?? [];
            setBill(billRow);
            setPayments(paymentRows);
            const outstanding = parseFloat(billRow.total_amount) - parseFloat(billRow.amount_paid);
            setPaymentAmount(Math.max(0, outstanding).toFixed(2));
            setAmountForm({
                current_rate: String(billRow.current_rate ?? ''),
                arrears: String(billRow.arrears ?? ''),
                rebate: String(billRow.rebate ?? ''),
                reason: '',
            });
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load bill details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBill();
    }, [id]);

    const handlePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        try {
            const gcr = gcrNumber.trim().toUpperCase();
            if (!/^[A-Z0-9][A-Z0-9\-]{3,19}$/.test(gcr)) {
                throw new Error(GCR_HINT);
            }
            await recordPayment(id as string, {
                amount: parseFloat(paymentAmount),
                payment_method: paymentMethod,
                gcr_number: gcr,
                customer_id: bill.customer_id,
            });
            setSuccess(true);
            setGcrNumber('');
            await loadBill();
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to record payment');
        } finally {
            setIsSubmitting(false);
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
            setAmountMsg(res.message || 'Submitted for Super Admin approval');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to submit amount change');
        }
    };

    const handleRequestPrint = async () => {
        try {
            const res = await requestPrivilegedAction({
                action_type: 'PRINT_BILL',
                bill_id: bill.id,
                reason: 'Bill hardcopy / PDF print',
            });
            setActionMsg(res.message);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to request print');
        }
    };

    if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-municipal-red"></div></div>;
    if (!bill) return <div className="text-center py-20 text-red-500">Bill not found</div>;

    const balance = parseFloat(bill.total_amount) - parseFloat(bill.amount_paid);

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <button onClick={() => router.back()} className="btn-secondary flex items-center space-x-2">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                </button>
                <div className="flex space-x-3 flex-wrap">
                    {canPrintDirect ? (
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
                    ) : canRequestPrint ? (
                        <>
                            <button
                                onClick={handleRequestPrint}
                                className="btn-secondary flex items-center space-x-2"
                            >
                                <Send className="w-4 h-4" />
                                <span>Request Print Approval</span>
                            </button>
                            <button
                                onClick={() => downloadBillPDF(bill.id).catch(() => undefined)}
                                className="btn-secondary flex items-center space-x-2"
                                title="Works after admin approves your print request"
                            >
                                <FileDown className="w-4 h-4" />
                                <span>Print If Approved</span>
                            </button>
                        </>
                    ) : null}
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
                        <div className={`px-6 py-4 flex justify-between items-center ${bill.payment_status === 'PAID' ? 'bg-green-600' : 'bg-municipal-red'} text-white`}>
                            <div>
                                <h2 className="text-2xl font-bold">{bill.bill_number}</h2>
                                <p className="text-sm opacity-90">{bill.bill_type} Invoice - {bill.bill_period_year}</p>
                            </div>
                            <div className="text-right">
                                <span className="text-xs uppercase tracking-wider opacity-75">Status</span>
                                <p className="text-lg font-bold">{bill.payment_status}</p>
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
                                    {bill.bill_type === 'PROPERTY_RATE' ? <Building2 className="w-5 h-5 text-gray-400 mt-1" /> : <Briefcase className="w-5 h-5 text-gray-400 mt-1" />}
                                    <div>
                                        <p className="font-bold text-gray-900">
                                            {bill.bill_type === 'PROPERTY_RATE' ? bill.property_number : bill.business_name}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            {bill.bill_type === 'PROPERTY_RATE' ? bill.classification_name : bill.business_number}
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
                                    <div key={p.id} className="flex justify-between items-center p-3 border rounded-lg bg-white">
                                        <div>
                                            <p className="font-bold text-gray-900">{p.receipt_number}</p>
                                            <p className="text-xs text-gray-500">
                                                GCR: {p.gcr_number || 'N/A'} • {new Date(p.payment_date).toLocaleString()} • {p.payment_method}
                                            </p>
                                            <p className="text-xs text-municipal-red font-medium mt-1">
                                                Recorded by: {p.recorded_by_name || user?.full_name || 'Unknown'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-green-600">GHS {parseFloat(p.amount).toFixed(2)}</p>
                                        </div>
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
                                Edit current rate, <strong>arrears</strong>, and rebate. Changes go to Super Admin for approval before they take effect.
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
                                    <label className="text-xs font-bold text-gray-500 uppercase">Arrears</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="input-field mt-1 border-amber-300 focus:ring-amber-500"
                                        value={amountForm.arrears}
                                        onChange={(e) => setAmountForm({ ...amountForm, arrears: e.target.value })}
                                        required
                                    />
                                    <p className="text-[11px] text-gray-500 mt-1">Adjust outstanding prior-year balance here.</p>
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
                        <div className="card sticky top-6">
                            <h3 className="text-lg font-bold mb-4 flex items-center space-x-2">
                                <CreditCard className="w-5 h-5 text-municipal-red" />
                                <span>Record Payment</span>
                            </h3>

                            {success && (
                                <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm mb-4 border border-green-200 flex items-center space-x-2">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Payment recorded successfully!</span>
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
                                            disabled={balance <= 0}
                                            max={balance}
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
                                        disabled={balance <= 0}
                                    >
                                        <option value="CASH">Cash</option>
                                        <option value="MOBILE_MONEY">Mobile Money</option>
                                        <option value="BANK_TRANSFER">Bank Transfer</option>
                                        <option value="CHEQUE">Cheque</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="label">General Counterfoil Receipt (GCR) Number</label>
                                    <input
                                        type="text"
                                        className="input-field font-mono uppercase"
                                        placeholder="e.g. 012345 or GCR-012345"
                                        value={gcrNumber}
                                        onChange={(e) => setGcrNumber(e.target.value.toUpperCase())}
                                        disabled={balance <= 0}
                                        minLength={4}
                                        maxLength={20}
                                        pattern="[A-Za-z0-9][A-Za-z0-9\-]{3,19}"
                                        required
                                    />
                                    <p className="text-[11px] text-gray-500 mt-1 leading-snug">{GCR_HINT}</p>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full btn-primary py-3 flex items-center justify-center space-x-2 disabled:bg-gray-300 disabled:shadow-none"
                                    disabled={isSubmitting || balance <= 0 || !paymentAmount || !gcrNumber.trim()}
                                >
                                    {isSubmitting ? (
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    ) : (
                                        <CheckCircle2 className="w-5 h-5" />
                                    )}
                                    <span>Confirm Payment</span>
                                </button>
                            </form>

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
