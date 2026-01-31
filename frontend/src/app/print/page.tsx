'use client';

import { useState, useEffect } from 'react';
import {
    fetchElectoralAreas,
    fetchPropertyClassifications,
    fetchBusinessCategories,
    downloadBulkBillsPDF
} from '@/lib/api-client';
import {
    Printer, Filter, FileText,
    Download, Loader2, Info
} from 'lucide-react';

export default function BulkPrintPage() {
    const [loading, setLoading] = useState(false);
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

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Bulk Bill Printing</h1>
                <p className="text-gray-600 mt-1">Generate and download multiple bills in a single A4 PDF document</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Filter Form */}
                <div className="md:col-span-2">
                    <form onSubmit={handlePrint} className="card space-y-6">
                        <h2 className="text-lg font-bold flex items-center space-x-2">
                            <Filter className="w-5 h-5 text-municipal-red" />
                            <span>Define Print Queue</span>
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

                            {/* Sub-filters */}
                            {filters.bill_type === 'PROPERTY' && (
                                <div className="md:col-span-2 animate-in fade-in zoom-in duration-300">
                                    <label className="label">Property Classification</label>
                                    <select
                                        className="input-field"
                                        value={filters.property_classification_id}
                                        onChange={(e) => setFilters({ ...filters, property_classification_id: e.target.value })}
                                    >
                                        <option value="">All Classifications</option>
                                        {lookups.classifications.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            )}

                            {filters.bill_type === 'BOP' && (
                                <div className="md:col-span-2 animate-in fade-in zoom-in duration-300">
                                    <label className="label">Business Category</label>
                                    <select
                                        className="input-field"
                                        value={filters.business_category_id}
                                        onChange={(e) => setFilters({ ...filters, business_category_id: e.target.value })}
                                    >
                                        <option value="">All Categories</option>
                                        {lookups.categories.map((k: any) => <option key={k.id} value={k.id}>{k.name}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="pt-4 border-t">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full btn-primary py-4 flex items-center justify-center space-x-3 text-lg"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                        <span>Processing Print Queue...</span>
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-6 h-6" />
                                        <span>Download Bulk PDF</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    <div className="card bg-red-50 border-blue-100">
                        <h3 className="font-bold text-municipal-red flex items-center space-x-2 mb-3">
                            <Info className="w-5 h-5" />
                            <span>Printing Instructions</span>
                        </h3>
                        <ul className="text-sm text-blue-800 space-y-3">
                            <li className="flex items-start space-x-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 flex-shrink-0"></div>
                                <span>Use **Electoral Area** filter to group bills for physical distribution by field officers.</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 flex-shrink-0"></div>
                                <span>Filter by **Unpaid** to focus on active revenue collection.</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 flex-shrink-0"></div>
                                <span>Bulk printing generates 1 bill per A4 page, optimized for standard municipal stationary.</span>
                            </li>
                        </ul>
                    </div>

                    <div className="card text-center p-8 bg-gray-50 border-dashed border-2">
                        <Printer className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-sm text-gray-400">PDFs will include official GA NORTH MUNICIPAL branding and itemized charge tables.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
