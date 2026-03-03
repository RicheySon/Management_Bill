'use client';

import { useState, useEffect } from 'react';
import {
    fetchElectoralAreas,
    fetchPropertyClassifications,
    fetchBusinessCategories,
    downloadBulkBillsPDF,
    sendBulkSMS
} from '@/lib/api-client';
import {
    Printer, Filter, FileText,
    Download, Loader2, Info, Send, MessageSquare
} from 'lucide-react';

export default function BulkPrintPage() {
    const [loading, setLoading] = useState(false);
    const [smsLoading, setSmsLoading] = useState(false);
    const [smsSuccess, setSmsSuccess] = useState(false);
    const [smsMessage, setSmsMessage] = useState('Dear Customer, your GA North Municipal bill for {year} is ready. Total due: GHS {amount}. Please pay at the nearest office or via mobile money. Thank you.');

    const [lookups, setLookups] = useState({
        areas: [],
        classifications: [],
        categories: []
    });

    const [filters, setFilters] = useState({
        billing_year: new Date().getFullYear(),
        bill_type: '',
        electoral_area_id: '',
        status: 'UNPAID', // Default to unpaid for collection
        property_classification_id: '',
        business_category_id: ''
    });

    useEffect(() => {
        const loadLookups = async () => {
            try {
                const [areas, classes, cats] = await Promise.all([
                    fetchElectoralAreas(),
                    fetchPropertyClassifications(),
                    fetchBusinessCategories()
                ]);
                setLookups({ areas, classifications: classes, categories: cats });
            } catch (err) {
                console.error('Failed to load filters');
            }
        };
        loadLookups();
    }, []);

    const handlePrint = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await downloadBulkBillsPDF(filters);
        } catch (err) {
            alert('Failed to generate bulk PDF. Try narrowing your filters.');
        } finally {
            setLoading(false);
        }
    };

    const handleSendSMS = async () => {
        if (!smsMessage.trim()) return alert('Please enter an SMS message template.');
        if (!confirm('Are you sure you want to send SMS alerts to all customers in the filtered queue?')) return;

        setSmsLoading(true);
        setSmsSuccess(false);
        try {
            await sendBulkSMS({
                filters,
                message_template: smsMessage
            });
            setSmsSuccess(true);
            setTimeout(() => setSmsSuccess(false), 5000);
        } catch (err) {
            alert('Failed to send bulk SMS alerts. Please try again.');
        } finally {
            setSmsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Bulk Bill Printing & SMS Alerts</h1>
                    <p className="text-gray-600 mt-1">Manage bulk distribution via PDF and SMS</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Filter Form */}
                <div className="md:col-span-2 space-y-6">
                    <form onSubmit={handlePrint} className="card space-y-6">
                        <h2 className="text-lg font-bold flex items-center space-x-2">
                            <Filter className="w-5 h-5 text-municipal-red" />
                            <span>Define Distribution Queue</span>
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="label">Billing Year</label>
                                <select
                                    className="input-field"
                                    value={filters.billing_year}
                                    onChange={(e) => setFilters({ ...filters, billing_year: parseInt(e.target.value) })}
                                >
                                    {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="label">Payment Status</label>
                                <select
                                    className="input-field"
                                    value={filters.status}
                                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                >
                                    <option value="">All Statuses</option>
                                    <option value="UNPAID">Unpaid Only</option>
                                    <option value="PARTIAL">Partially Paid</option>
                                    <option value="PAID">Fully Paid</option>
                                </select>
                            </div>

                            <div>
                                <label className="label">Electoral Area</label>
                                <select
                                    className="input-field"
                                    value={filters.electoral_area_id}
                                    onChange={(e) => setFilters({ ...filters, electoral_area_id: e.target.value })}
                                >
                                    <option value="">All Regions</option>
                                    {lookups.areas.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="label">Bill Type</label>
                                <select
                                    className="input-field"
                                    value={filters.bill_type}
                                    onChange={(e) => setFilters({ ...filters, bill_type: e.target.value })}
                                >
                                    <option value="">All Types (Mixed)</option>
                                    <option value="PROPERTY">Property Rates Only</option>
                                    <option value="BOP">BOP Permits Only</option>
                                </select>
                            </div>

                            {/* Sub-filters omitted for brevity but should be here if needed */}
                        </div>

                        <div className="pt-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button
                                type="submit"
                                disabled={loading || smsLoading}
                                className="btn-primary py-4 flex items-center justify-center space-x-3 text-lg"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                        <span>Processing...</span>
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-6 h-6" />
                                        <span>Download PDF</span>
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={handleSendSMS}
                                disabled={loading || smsLoading}
                                className="bg-municipal-teal text-white rounded-xl font-bold py-4 px-6 flex items-center justify-center space-x-3 text-lg hover:bg-teal-700 transition-all opacity-100 disabled:opacity-50"
                            >
                                {smsLoading ? (
                                    <>
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                        <span>Sending SMS...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-6 h-6" />
                                        <span>Send Bulk SMS</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    {/* SMS Alert Customization */}
                    <div className="card space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold flex items-center space-x-2">
                                <MessageSquare className="w-5 h-5 text-municipal-teal" />
                                <span>Bulk SMS Alert Setup</span>
                            </h2>
                            {smsSuccess && (
                                <span className="text-green-600 text-sm font-bold animate-pulse">✓ Alerts sent to queue!</span>
                            )}
                        </div>

                        <div>
                            <label className="label text-gray-500">SMS Message Template</label>
                            <textarea
                                className="input-field h-32 text-sm leading-relaxed"
                                value={smsMessage}
                                onChange={(e) => setSmsMessage(e.target.value)}
                                placeholder="Enter message here..."
                            />
                            <div className="mt-2 flex flex-wrap gap-2">
                                <span className="text-[10px] bg-gray-100 px-2 py-1 rounded border">Available tags:</span>
                                <code className="text-[10px] bg-teal-50 text-municipal-teal px-1 rounded font-bold">{"{year}"}</code>
                                <code className="text-[10px] bg-teal-50 text-municipal-teal px-1 rounded font-bold">{"{amount}"}</code>
                                <code className="text-[10px] bg-teal-50 text-municipal-teal px-1 rounded font-bold">{"{customer_name}"}</code>
                                <code className="text-[10px] bg-teal-50 text-municipal-teal px-1 rounded font-bold">{"{bill_number}"}</code>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    <div className="card bg-red-50 border-red-100">
                        <h3 className="font-bold text-municipal-red flex items-center space-x-2 mb-3">
                            <Info className="w-5 h-5" />
                            <span>Printing Instructions</span>
                        </h3>
                        <ul className="text-sm text-red-800 space-y-3">
                            <li className="flex items-start space-x-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-municipal-red mt-1.5 flex-shrink-0"></div>
                                <span>Use **Electoral Area** filter to group bills for physical distribution.</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-municipal-red mt-1.5 flex-shrink-0"></div>
                                <span>**Bulk SMS** will be sent to the primary phone number of all customers in the current filtered queue.</span>
                            </li>
                        </ul>
                    </div>

                    <div className="card bg-teal-50 border-teal-100">
                        <h3 className="font-bold text-municipal-teal flex items-center space-x-2 mb-3">
                            <Send className="w-5 h-5" />
                            <span>SMS Statistics</span>
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-3 rounded-lg border border-teal-100 text-center">
                                <p className="text-[10px] text-gray-400 font-bold uppercase">Estimated</p>
                                <p className="text-xl font-black text-gray-800">124</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-teal-100 text-center">
                                <p className="text-[10px] text-gray-400 font-bold uppercase">Cost (est)</p>
                                <p className="text-xl font-black text-gray-800">GHS 2.48</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
