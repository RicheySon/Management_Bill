'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
    Settings, Plus, Upload, Trash2, Pencil, Check, X, FileSpreadsheet,
    ChevronDown, ChevronRight, Search, AlertCircle, CheckCircle2, Loader2,
    Building2, Briefcase, ArrowUpCircle
} from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';
import {
    fetchFeeSchedules, createFeeSchedule, activateFeeSchedule,
    fetchPropertyRateZones, createPropertyRateZone, updatePropertyRateZone, deletePropertyRateZone,
    fetchBusinessFeeItems, createBusinessFeeItem, updateBusinessFeeItem, deleteBusinessFeeItem,
    previewFeeScheduleImport, commitFeeScheduleImport,
} from '@/lib/api-client';

// =====================================================
// TYPES
// =====================================================

interface FeeSchedule {
    id: number;
    year: number;
    name: string;
    effective_date: string;
    status: string;
    notes?: string;
}

interface PropertyRateZone {
    id: number;
    fee_schedule_id: number;
    zone_name: string;
    zone_type: string;
    zone_class: number;
    rate_impost_min: number;
    rate_impost_max?: number;
    minimum_rate_min: number;
    minimum_rate_max?: number;
    affected_areas?: string;
    sort_order: number;
}

interface BusinessFeeItem {
    id: number;
    fee_schedule_id: number;
    main_item_number: number;
    sub_item_code?: string;
    description: string;
    parent_id?: number;
    frequency?: string;
    cat_a_fee?: number;
    cat_b_fee?: number;
    cat_c_fee?: number;
    cat_d_fee?: number;
    cat_e_fee?: number;
    cat_f_fee?: number;
    is_group_header: boolean;
    sort_order: number;
}

const ZONE_TYPES = ['RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'MIXED_USE'];

// =====================================================
// MAIN PAGE COMPONENT
// =====================================================

export default function FeeConfigurationPage() {
    const { hasPermission } = useAuth();
    const [schedules, setSchedules] = useState<FeeSchedule[]>([]);
    const [selectedSchedule, setSelectedSchedule] = useState<FeeSchedule | null>(null);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [loading, setLoading] = useState(true);
    const [showNewSchedule, setShowNewSchedule] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const canConfigure = hasPermission('configure_rates');

    const loadSchedules = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchFeeSchedules(selectedYear);
            setSchedules(data || []);
            if (data && data.length > 0) {
                const active = data.find((s: FeeSchedule) => s.status === 'ACTIVE');
                setSelectedSchedule(active || data[0]);
            } else {
                setSelectedSchedule(null);
            }
        } catch (err) {
            console.error('Failed to load schedules:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedYear]);

    useEffect(() => {
        loadSchedules();
    }, [loadSchedules]);

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 4000);
    };

    const handleCreateSchedule = async (data: { name: string; effective_date: string; notes: string }) => {
        try {
            await createFeeSchedule({ year: selectedYear, ...data });
            showMessage('success', 'Fee schedule created successfully');
            setShowNewSchedule(false);
            loadSchedules();
        } catch (err: any) {
            showMessage('error', err.response?.data?.error || 'Failed to create schedule');
        }
    };

    const handleActivateSchedule = async () => {
        if (!selectedSchedule) return;
        try {
            await activateFeeSchedule(selectedSchedule.id);
            showMessage('success', 'Fee schedule activated successfully');
            loadSchedules();
        } catch (err: any) {
            showMessage('error', err.response?.data?.error || 'Failed to activate schedule');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-12 h-12 text-municipal-red animate-spin" />
            </div>
        );
    }

    const years = [];
    const currentYear = new Date().getFullYear();
    for (let y = currentYear + 1; y >= currentYear - 3; y--) {
        years.push(y);
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-municipal-red rounded-lg flex items-center justify-center">
                            <Settings className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Fee Configuration</h1>
                            <p className="text-sm text-gray-500">Configure fee schedules for property rates and business licenses</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Alert Messages */}
            {message && (
                <div className={`flex items-center space-x-3 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                    {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <span className="font-medium">{message.text}</span>
                </div>
            )}

            {/* Schedule Selector */}
            <div className="card">
                <div className="flex flex-wrap items-center gap-4">
                    <div>
                        <label className="label">Year</label>
                        <select
                            className="input-field w-32"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        >
                            {years.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    {schedules.length > 0 && (
                        <div>
                            <label className="label">Schedule</label>
                            <select
                                className="input-field w-64"
                                value={selectedSchedule?.id || ''}
                                onChange={(e) => {
                                    const s = schedules.find(s => s.id === parseInt(e.target.value));
                                    if (s) setSelectedSchedule(s);
                                }}
                            >
                                {schedules.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} ({s.status})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {selectedSchedule && selectedSchedule.status !== 'ACTIVE' && canConfigure && (
                        <div className="flex items-end">
                            <button
                                onClick={handleActivateSchedule}
                                className="btn-primary flex items-center space-x-2"
                            >
                                <ArrowUpCircle className="w-4 h-4" />
                                <span>Activate Schedule</span>
                            </button>
                        </div>
                    )}

                    {selectedSchedule && (
                        <div className="flex items-end">
                            <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                                selectedSchedule.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                                selectedSchedule.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-600'
                            }`}>
                                {selectedSchedule.status}
                            </span>
                        </div>
                    )}

                    {canConfigure && (
                        <div className="flex items-end ml-auto">
                            <button
                                onClick={() => setShowNewSchedule(true)}
                                className="btn-primary flex items-center space-x-2"
                            >
                                <Plus className="w-4 h-4" />
                                <span>New Schedule</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* New Schedule Form */}
                {showNewSchedule && (
                    <NewScheduleForm
                        year={selectedYear}
                        onSubmit={handleCreateSchedule}
                        onCancel={() => setShowNewSchedule(false)}
                    />
                )}
            </div>

            {/* Tabs */}
            {selectedSchedule ? (
                <Tabs.Root defaultValue="property-rates">
                    <Tabs.List className="flex border-b border-gray-200 mb-6">
                        <Tabs.Trigger value="property-rates" className="px-6 py-3 text-sm font-semibold text-gray-500 border-b-2 border-transparent hover:text-municipal-red data-[state=active]:text-municipal-red data-[state=active]:border-municipal-red transition-colors flex items-center space-x-2">
                            <Building2 className="w-4 h-4" />
                            <span>Property Rates</span>
                        </Tabs.Trigger>
                        <Tabs.Trigger value="business-licenses" className="px-6 py-3 text-sm font-semibold text-gray-500 border-b-2 border-transparent hover:text-municipal-red data-[state=active]:text-municipal-red data-[state=active]:border-municipal-red transition-colors flex items-center space-x-2">
                            <Briefcase className="w-4 h-4" />
                            <span>Business Licenses</span>
                        </Tabs.Trigger>
                        <Tabs.Trigger value="import" className="px-6 py-3 text-sm font-semibold text-gray-500 border-b-2 border-transparent hover:text-municipal-red data-[state=active]:text-municipal-red data-[state=active]:border-municipal-red transition-colors flex items-center space-x-2">
                            <Upload className="w-4 h-4" />
                            <span>Import Excel</span>
                        </Tabs.Trigger>
                    </Tabs.List>

                    <Tabs.Content value="property-rates">
                        <PropertyRatesTab
                            scheduleId={selectedSchedule.id}
                            canConfigure={canConfigure}
                            showMessage={showMessage}
                        />
                    </Tabs.Content>

                    <Tabs.Content value="business-licenses">
                        <BusinessLicensesTab
                            scheduleId={selectedSchedule.id}
                            canConfigure={canConfigure}
                            showMessage={showMessage}
                        />
                    </Tabs.Content>

                    <Tabs.Content value="import">
                        <ImportTab
                            scheduleId={selectedSchedule.id}
                            canConfigure={canConfigure}
                            showMessage={showMessage}
                            onImportComplete={loadSchedules}
                        />
                    </Tabs.Content>
                </Tabs.Root>
            ) : (
                <div className="card text-center py-12">
                    <Settings className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">No Fee Schedule Found</h3>
                    <p className="text-gray-500 mb-4">Create a fee schedule for {selectedYear} to get started.</p>
                    {canConfigure && (
                        <button onClick={() => setShowNewSchedule(true)} className="btn-primary">
                            Create Fee Schedule
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// =====================================================
// NEW SCHEDULE FORM
// =====================================================

function NewScheduleForm({ year, onSubmit, onCancel }: {
    year: number;
    onSubmit: (data: { name: string; effective_date: string; notes: string }) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState(`${year} Fee Fixing Schedule`);
    const [effectiveDate, setEffectiveDate] = useState(`${year}-01-01`);
    const [notes, setNotes] = useState('');

    return (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Create New Fee Schedule</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="label">Schedule Name *</label>
                    <input className="input-field" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div>
                    <label className="label">Effective Date *</label>
                    <input type="date" className="input-field" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
                </div>
                <div>
                    <label className="label">Notes</label>
                    <input className="input-field" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" />
                </div>
            </div>
            <div className="flex space-x-3 mt-4">
                <button onClick={() => onSubmit({ name, effective_date: effectiveDate, notes })} className="btn-primary">
                    Create Schedule
                </button>
                <button onClick={onCancel} className="btn-secondary">Cancel</button>
            </div>
        </div>
    );
}

// =====================================================
// PROPERTY RATES TAB
// =====================================================

function PropertyRatesTab({ scheduleId, canConfigure, showMessage }: {
    scheduleId: number;
    canConfigure: boolean;
    showMessage: (type: 'success' | 'error', text: string) => void;
}) {
    const [zones, setZones] = useState<PropertyRateZone[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingZone, setEditingZone] = useState<PropertyRateZone | null>(null);

    const loadZones = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchPropertyRateZones(scheduleId);
            setZones(data || []);
        } catch (err) {
            console.error('Failed to load zones:', err);
        } finally {
            setLoading(false);
        }
    }, [scheduleId]);

    useEffect(() => { loadZones(); }, [loadZones]);

    const handleSaveZone = async (data: any) => {
        try {
            if (editingZone) {
                await updatePropertyRateZone(editingZone.id, data);
                showMessage('success', 'Property rate zone updated');
            } else {
                await createPropertyRateZone(scheduleId, data);
                showMessage('success', 'Property rate zone added');
            }
            setShowForm(false);
            setEditingZone(null);
            loadZones();
        } catch (err: any) {
            showMessage('error', err.response?.data?.error || 'Failed to save zone');
        }
    };

    const handleDeleteZone = async (zoneId: number) => {
        if (!confirm('Delete this property rate zone?')) return;
        try {
            await deletePropertyRateZone(zoneId);
            showMessage('success', 'Zone deleted');
            loadZones();
        } catch (err: any) {
            showMessage('error', err.response?.data?.error || 'Failed to delete zone');
        }
    };

    if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-municipal-red" /></div>;

    return (
        <div className="card">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Property Rating Zones</h2>
                {canConfigure && (
                    <button onClick={() => { setEditingZone(null); setShowForm(true); }} className="btn-primary flex items-center space-x-2">
                        <Plus className="w-4 h-4" />
                        <span>Add Zone</span>
                    </button>
                )}
            </div>

            {showForm && (
                <PropertyZoneForm
                    zone={editingZone}
                    onSubmit={handleSaveZone}
                    onCancel={() => { setShowForm(false); setEditingZone(null); }}
                />
            )}

            {zones.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No property rate zones configured yet.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Zone Name</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Class</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rate Impost (GHc)</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Minimum Rate (GHc)</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Affected Areas</th>
                                {canConfigure && <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {zones.map(zone => (
                                <tr key={zone.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-900">{zone.zone_name}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                            zone.zone_type === 'RESIDENTIAL' ? 'bg-blue-100 text-blue-700' :
                                            zone.zone_type === 'COMMERCIAL' ? 'bg-purple-100 text-purple-700' :
                                            zone.zone_type === 'INDUSTRIAL' ? 'bg-orange-100 text-orange-700' :
                                            'bg-teal-100 text-teal-700'
                                        }`}>
                                            {zone.zone_type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">{zone.zone_class}</td>
                                    <td className="px-4 py-3 text-gray-600">
                                        {zone.rate_impost_min}{zone.rate_impost_max ? ` - ${zone.rate_impost_max}` : ''}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">
                                        {Number(zone.minimum_rate_min).toLocaleString()}{zone.minimum_rate_max ? ` - ${Number(zone.minimum_rate_max).toLocaleString()}` : ''}
                                    </td>
                                    <td className="px-4 py-3 text-gray-500 text-sm max-w-xs truncate" title={zone.affected_areas || ''}>
                                        {zone.affected_areas || '-'}
                                    </td>
                                    {canConfigure && (
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end space-x-2">
                                                <button onClick={() => { setEditingZone(zone); setShowForm(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50">
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDeleteZone(zone.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// =====================================================
// PROPERTY ZONE FORM
// =====================================================

function PropertyZoneForm({ zone, onSubmit, onCancel }: {
    zone: PropertyRateZone | null;
    onSubmit: (data: any) => void;
    onCancel: () => void;
}) {
    const [formData, setFormData] = useState({
        zone_name: zone?.zone_name || '',
        zone_type: zone?.zone_type || 'RESIDENTIAL',
        zone_class: zone?.zone_class || 1,
        rate_impost_min: zone?.rate_impost_min || '',
        rate_impost_max: zone?.rate_impost_max || '',
        minimum_rate_min: zone?.minimum_rate_min || '',
        minimum_rate_max: zone?.minimum_rate_max || '',
        affected_areas: zone?.affected_areas || '',
        sort_order: zone?.sort_order || 0,
    });

    const handleChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            ...formData,
            rate_impost_min: parseFloat(String(formData.rate_impost_min)),
            rate_impost_max: formData.rate_impost_max ? parseFloat(String(formData.rate_impost_max)) : null,
            minimum_rate_min: parseFloat(String(formData.minimum_rate_min)),
            minimum_rate_max: formData.minimum_rate_max ? parseFloat(String(formData.minimum_rate_max)) : null,
            zone_class: parseInt(String(formData.zone_class)),
            sort_order: parseInt(String(formData.sort_order)),
        });
    };

    return (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <h3 className="font-semibold text-gray-900 mb-3">{zone ? 'Edit' : 'Add'} Property Rate Zone</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label className="label">Zone Name *</label>
                    <input className="input-field" value={formData.zone_name} onChange={e => handleChange('zone_name', e.target.value)} required placeholder="e.g. 1st Class Residential" />
                </div>
                <div>
                    <label className="label">Zone Type *</label>
                    <select className="input-field" value={formData.zone_type} onChange={e => handleChange('zone_type', e.target.value)}>
                        {ZONE_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                    </select>
                </div>
                <div>
                    <label className="label">Class</label>
                    <input type="number" className="input-field" value={formData.zone_class} onChange={e => handleChange('zone_class', e.target.value)} min={1} max={10} />
                </div>
                <div>
                    <label className="label">Sort Order</label>
                    <input type="number" className="input-field" value={formData.sort_order} onChange={e => handleChange('sort_order', e.target.value)} />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                <div>
                    <label className="label">Rate Impost Min *</label>
                    <input type="number" step="0.000001" className="input-field" value={formData.rate_impost_min} onChange={e => handleChange('rate_impost_min', e.target.value)} required placeholder="0.0023" />
                </div>
                <div>
                    <label className="label">Rate Impost Max</label>
                    <input type="number" step="0.000001" className="input-field" value={formData.rate_impost_max} onChange={e => handleChange('rate_impost_max', e.target.value)} placeholder="0.0030" />
                </div>
                <div>
                    <label className="label">Minimum Rate Min (GHc) *</label>
                    <input type="number" step="0.01" className="input-field" value={formData.minimum_rate_min} onChange={e => handleChange('minimum_rate_min', e.target.value)} required placeholder="1500.00" />
                </div>
                <div>
                    <label className="label">Minimum Rate Max (GHc)</label>
                    <input type="number" step="0.01" className="input-field" value={formData.minimum_rate_max} onChange={e => handleChange('minimum_rate_max', e.target.value)} placeholder="2000.00" />
                </div>
            </div>
            <div className="mt-4">
                <label className="label">Affected Areas</label>
                <input className="input-field" value={formData.affected_areas} onChange={e => handleChange('affected_areas', e.target.value)} placeholder="La Hotels Area, Switch Back Ragoon, Cantonments..." />
            </div>
            <div className="flex space-x-3 mt-4">
                <button type="submit" className="btn-primary flex items-center space-x-2">
                    <Check className="w-4 h-4" />
                    <span>{zone ? 'Update' : 'Add'} Zone</span>
                </button>
                <button type="button" onClick={onCancel} className="btn-secondary flex items-center space-x-2">
                    <X className="w-4 h-4" />
                    <span>Cancel</span>
                </button>
            </div>
        </form>
    );
}

// =====================================================
// BUSINESS LICENSES TAB
// =====================================================

function BusinessLicensesTab({ scheduleId, canConfigure, showMessage }: {
    scheduleId: number;
    canConfigure: boolean;
    showMessage: (type: 'success' | 'error', text: string) => void;
}) {
    const [items, setItems] = useState<BusinessFeeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState<BusinessFeeItem | null>(null);

    const loadItems = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchBusinessFeeItems(scheduleId);
            setItems(data || []);
            // Expand all groups by default
            const groupIds = new Set<number>();
            (data || []).forEach((item: BusinessFeeItem) => {
                if (item.is_group_header) groupIds.add(item.id);
            });
            setExpandedGroups(groupIds);
        } catch (err) {
            console.error('Failed to load business items:', err);
        } finally {
            setLoading(false);
        }
    }, [scheduleId]);

    useEffect(() => { loadItems(); }, [loadItems]);

    const handleSaveItem = async (data: any) => {
        try {
            if (editingItem) {
                await updateBusinessFeeItem(editingItem.id, data);
                showMessage('success', 'Business fee item updated');
            } else {
                await createBusinessFeeItem(scheduleId, data);
                showMessage('success', 'Business fee item added');
            }
            setShowForm(false);
            setEditingItem(null);
            loadItems();
        } catch (err: any) {
            showMessage('error', err.response?.data?.error || 'Failed to save item');
        }
    };

    const handleDeleteItem = async (itemId: number) => {
        if (!confirm('Delete this business fee item?')) return;
        try {
            await deleteBusinessFeeItem(itemId);
            showMessage('success', 'Item deleted');
            loadItems();
        } catch (err: any) {
            showMessage('error', err.response?.data?.error || 'Failed to delete item');
        }
    };

    const toggleGroup = (groupId: number) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    };

    // Build tree structure
    const parentItems = items.filter(i => !i.parent_id);
    const childrenMap: Record<number, BusinessFeeItem[]> = {};
    items.forEach(i => {
        if (i.parent_id) {
            if (!childrenMap[i.parent_id]) childrenMap[i.parent_id] = [];
            childrenMap[i.parent_id].push(i);
        }
    });

    // Filter
    const filteredParents = searchTerm
        ? parentItems.filter(p => {
            const matchSelf = p.description.toLowerCase().includes(searchTerm.toLowerCase());
            const matchChildren = (childrenMap[p.id] || []).some(c =>
                c.description.toLowerCase().includes(searchTerm.toLowerCase())
            );
            return matchSelf || matchChildren;
        })
        : parentItems;

    if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-municipal-red" /></div>;

    const formatFee = (fee: any) => {
        if (fee === null || fee === undefined) return '-';
        return Number(fee).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
        <div className="card">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Business License Fee Items</h2>
                <div className="flex items-center space-x-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            className="input-field pl-9 w-64"
                            placeholder="Search items..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {canConfigure && (
                        <button onClick={() => { setEditingItem(null); setShowForm(true); }} className="btn-primary flex items-center space-x-2">
                            <Plus className="w-4 h-4" />
                            <span>Add Item</span>
                        </button>
                    )}
                </div>
            </div>

            {showForm && (
                <BusinessFeeItemForm
                    item={editingItem}
                    parentItems={parentItems}
                    onSubmit={handleSaveItem}
                    onCancel={() => { setShowForm(false); setEditingItem(null); }}
                />
            )}

            {items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    <Briefcase className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No business fee items configured yet.</p>
                    <p className="text-sm mt-1">Use the Import tab to upload a fee fixing Excel file.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-8">#</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Frequency</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">CAT A</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">CAT B</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">CAT C</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">CAT D</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">CAT E</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">CAT F</th>
                                {canConfigure && <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredParents.map(parent => (
                                <>
                                    {/* Parent/Group Row */}
                                    <tr key={parent.id} className="bg-gray-50 hover:bg-gray-100 cursor-pointer" onClick={() => parent.is_group_header && toggleGroup(parent.id)}>
                                        <td className="px-4 py-2 font-bold text-gray-700">{parent.main_item_number}</td>
                                        <td className="px-4 py-2 font-bold text-gray-900 flex items-center space-x-2">
                                            {parent.is_group_header && childrenMap[parent.id]?.length > 0 && (
                                                expandedGroups.has(parent.id)
                                                    ? <ChevronDown className="w-4 h-4 text-gray-400" />
                                                    : <ChevronRight className="w-4 h-4 text-gray-400" />
                                            )}
                                            <span>{parent.description}</span>
                                        </td>
                                        <td className="px-4 py-2 text-gray-600 text-sm">{parent.frequency || ''}</td>
                                        <td className="px-4 py-2 text-right text-gray-700">{formatFee(parent.cat_a_fee)}</td>
                                        <td className="px-4 py-2 text-right text-gray-700">{formatFee(parent.cat_b_fee)}</td>
                                        <td className="px-4 py-2 text-right text-gray-700">{formatFee(parent.cat_c_fee)}</td>
                                        <td className="px-4 py-2 text-right text-gray-700">{formatFee(parent.cat_d_fee)}</td>
                                        <td className="px-4 py-2 text-right text-gray-700">{formatFee(parent.cat_e_fee)}</td>
                                        <td className="px-4 py-2 text-right text-gray-700">{formatFee(parent.cat_f_fee)}</td>
                                        {canConfigure && (
                                            <td className="px-4 py-2 text-right" onClick={e => e.stopPropagation()}>
                                                <div className="flex justify-end space-x-1">
                                                    <button onClick={() => { setEditingItem(parent); setShowForm(true); }} className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50">
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => handleDeleteItem(parent.id)} className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>

                                    {/* Children Rows */}
                                    {expandedGroups.has(parent.id) && (childrenMap[parent.id] || []).map(child => (
                                        <tr key={child.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 text-gray-400"></td>
                                            <td className="px-4 py-2 text-gray-700 pl-10">
                                                {child.sub_item_code && <span className="text-gray-400 mr-2">{child.sub_item_code}.</span>}
                                                {child.description}
                                            </td>
                                            <td className="px-4 py-2 text-gray-600 text-sm">{child.frequency || ''}</td>
                                            <td className="px-4 py-2 text-right text-gray-700 font-medium">{formatFee(child.cat_a_fee)}</td>
                                            <td className="px-4 py-2 text-right text-gray-700 font-medium">{formatFee(child.cat_b_fee)}</td>
                                            <td className="px-4 py-2 text-right text-gray-700 font-medium">{formatFee(child.cat_c_fee)}</td>
                                            <td className="px-4 py-2 text-right text-gray-700 font-medium">{formatFee(child.cat_d_fee)}</td>
                                            <td className="px-4 py-2 text-right text-gray-700 font-medium">{formatFee(child.cat_e_fee)}</td>
                                            <td className="px-4 py-2 text-right text-gray-700 font-medium">{formatFee(child.cat_f_fee)}</td>
                                            {canConfigure && (
                                                <td className="px-4 py-2 text-right">
                                                    <div className="flex justify-end space-x-1">
                                                        <button onClick={() => { setEditingItem(child); setShowForm(true); }} className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50">
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button onClick={() => handleDeleteItem(child.id)} className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </>
                            ))}
                        </tbody>
                    </table>
                    <div className="text-sm text-gray-500 mt-3 px-4">
                        Showing {filteredParents.length} main items, {items.length} total items
                    </div>
                </div>
            )}
        </div>
    );
}

// =====================================================
// BUSINESS FEE ITEM FORM
// =====================================================

function BusinessFeeItemForm({ item, parentItems, onSubmit, onCancel }: {
    item: BusinessFeeItem | null;
    parentItems: BusinessFeeItem[];
    onSubmit: (data: any) => void;
    onCancel: () => void;
}) {
    const [formData, setFormData] = useState({
        main_item_number: item?.main_item_number || 1,
        sub_item_code: item?.sub_item_code || '',
        description: item?.description || '',
        parent_id: item?.parent_id || '',
        frequency: item?.frequency || '',
        cat_a_fee: item?.cat_a_fee ?? '',
        cat_b_fee: item?.cat_b_fee ?? '',
        cat_c_fee: item?.cat_c_fee ?? '',
        cat_d_fee: item?.cat_d_fee ?? '',
        cat_e_fee: item?.cat_e_fee ?? '',
        cat_f_fee: item?.cat_f_fee ?? '',
        is_group_header: item?.is_group_header || false,
    });

    const handleChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const feeFields = ['cat_a_fee', 'cat_b_fee', 'cat_c_fee', 'cat_d_fee', 'cat_e_fee', 'cat_f_fee'];
        const data: any = {
            main_item_number: parseInt(String(formData.main_item_number)),
            sub_item_code: formData.sub_item_code || null,
            description: formData.description,
            parent_id: formData.parent_id ? parseInt(String(formData.parent_id)) : null,
            frequency: formData.frequency || null,
            is_group_header: formData.is_group_header,
        };
        feeFields.forEach(f => {
            const val = (formData as any)[f];
            data[f] = val !== '' && val !== null && val !== undefined ? parseFloat(String(val)) : null;
        });
        onSubmit(data);
    };

    return (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <h3 className="font-semibold text-gray-900 mb-3">{item ? 'Edit' : 'Add'} Business Fee Item</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label className="label">Main Item # *</label>
                    <input type="number" className="input-field" value={formData.main_item_number} onChange={e => handleChange('main_item_number', e.target.value)} required min={1} />
                </div>
                <div>
                    <label className="label">Sub Item Code</label>
                    <input className="input-field" value={formData.sub_item_code} onChange={e => handleChange('sub_item_code', e.target.value)} placeholder="e.g. A, i, ii" />
                </div>
                <div className="md:col-span-2">
                    <label className="label">Description *</label>
                    <input className="input-field" value={formData.description} onChange={e => handleChange('description', e.target.value)} required placeholder="e.g. Abattoir (Private)" />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                <div>
                    <label className="label">Parent Item</label>
                    <select className="input-field" value={formData.parent_id} onChange={e => handleChange('parent_id', e.target.value)}>
                        <option value="">None (Top Level)</option>
                        {parentItems.filter(p => p.is_group_header).map(p => (
                            <option key={p.id} value={p.id}>{p.main_item_number}. {p.description}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="label">Frequency</label>
                    <select className="input-field" value={formData.frequency} onChange={e => handleChange('frequency', e.target.value)}>
                        <option value="">None</option>
                        <option>Per Annum</option>
                        <option>Per Month</option>
                        <option>Per Day</option>
                        <option>Per Event</option>
                        <option>Per Trip</option>
                    </select>
                </div>
                <div className="flex items-end">
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" checked={formData.is_group_header} onChange={e => handleChange('is_group_header', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-municipal-red focus:ring-municipal-red" />
                        <span className="text-sm font-medium text-gray-700">Group Header (no fees)</span>
                    </label>
                </div>
            </div>
            {!formData.is_group_header && (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-4">
                    <div>
                        <label className="label">CAT A Fee</label>
                        <input type="number" step="0.01" className="input-field" value={formData.cat_a_fee} onChange={e => handleChange('cat_a_fee', e.target.value)} placeholder="0.00" />
                    </div>
                    <div>
                        <label className="label">CAT B Fee</label>
                        <input type="number" step="0.01" className="input-field" value={formData.cat_b_fee} onChange={e => handleChange('cat_b_fee', e.target.value)} placeholder="0.00" />
                    </div>
                    <div>
                        <label className="label">CAT C Fee</label>
                        <input type="number" step="0.01" className="input-field" value={formData.cat_c_fee} onChange={e => handleChange('cat_c_fee', e.target.value)} placeholder="0.00" />
                    </div>
                    <div>
                        <label className="label">CAT D Fee</label>
                        <input type="number" step="0.01" className="input-field" value={formData.cat_d_fee} onChange={e => handleChange('cat_d_fee', e.target.value)} placeholder="0.00" />
                    </div>
                    <div>
                        <label className="label">CAT E Fee</label>
                        <input type="number" step="0.01" className="input-field" value={formData.cat_e_fee} onChange={e => handleChange('cat_e_fee', e.target.value)} placeholder="0.00" />
                    </div>
                    <div>
                        <label className="label">CAT F Fee</label>
                        <input type="number" step="0.01" className="input-field" value={formData.cat_f_fee} onChange={e => handleChange('cat_f_fee', e.target.value)} placeholder="0.00" />
                    </div>
                </div>
            )}
            <div className="flex space-x-3 mt-4">
                <button type="submit" className="btn-primary flex items-center space-x-2">
                    <Check className="w-4 h-4" />
                    <span>{item ? 'Update' : 'Add'} Item</span>
                </button>
                <button type="button" onClick={onCancel} className="btn-secondary flex items-center space-x-2">
                    <X className="w-4 h-4" />
                    <span>Cancel</span>
                </button>
            </div>
        </form>
    );
}

// =====================================================
// IMPORT TAB
// =====================================================

function ImportTab({ scheduleId, canConfigure, showMessage, onImportComplete }: {
    scheduleId: number;
    canConfigure: boolean;
    showMessage: (type: 'success' | 'error', text: string) => void;
    onImportComplete: () => void;
}) {
    const [file, setFile] = useState<File | null>(null);
    const [previewing, setPreviewing] = useState(false);
    const [importing, setImporting] = useState(false);
    const [previewData, setPreviewData] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setPreviewData(null);
        }
    };

    const handlePreview = async () => {
        if (!file) return;
        try {
            setPreviewing(true);
            const result = await previewFeeScheduleImport(scheduleId, file);
            setPreviewData(result.data);
        } catch (err: any) {
            showMessage('error', err.response?.data?.error || 'Failed to parse Excel file');
        } finally {
            setPreviewing(false);
        }
    };

    const handleCommit = async () => {
        if (!previewData) return;
        if (!confirm('This will replace all existing data for this schedule. Continue?')) return;

        try {
            setImporting(true);
            const result = await commitFeeScheduleImport(scheduleId, {
                propertyZones: previewData.propertyZones,
                businessItems: previewData.businessItems,
            });
            showMessage('success', result.message || 'Import completed successfully');
            setPreviewData(null);
            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            onImportComplete();
        } catch (err: any) {
            showMessage('error', err.response?.data?.error || 'Failed to import data');
        } finally {
            setImporting(false);
        }
    };

    if (!canConfigure) {
        return (
            <div className="card text-center py-8 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>You do not have permission to import fee schedules.</p>
            </div>
        );
    }

    return (
        <div className="card space-y-6">
            <h2 className="text-lg font-bold text-gray-900">Import Fee Fixing Document</h2>

            {/* Upload Area */}
            <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-municipal-red transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
            >
                <FileSpreadsheet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-700 font-medium mb-1">
                    {file ? file.name : 'Click to select or drop Excel file here'}
                </p>
                <p className="text-sm text-gray-500">Supported: .xlsx files (Fee Fixing Document)</p>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleFileChange}
                />
            </div>

            {file && !previewData && (
                <button
                    onClick={handlePreview}
                    disabled={previewing}
                    className="btn-primary flex items-center space-x-2"
                >
                    {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    <span>{previewing ? 'Parsing...' : 'Preview Import'}</span>
                </button>
            )}

            {/* Preview Results */}
            {previewData && (
                <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h3 className="font-semibold text-green-800 mb-2 flex items-center space-x-2">
                            <CheckCircle2 className="w-5 h-5" />
                            <span>File Parsed Successfully</span>
                        </h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="bg-white rounded p-3">
                                <div className="flex items-center space-x-2 mb-1">
                                    <Building2 className="w-4 h-4 text-blue-600" />
                                    <span className="font-semibold text-gray-700">Property Rate Zones</span>
                                </div>
                                <p className="text-2xl font-bold text-blue-600">{previewData.summary.propertyZonesCount}</p>
                            </div>
                            <div className="bg-white rounded p-3">
                                <div className="flex items-center space-x-2 mb-1">
                                    <Briefcase className="w-4 h-4 text-purple-600" />
                                    <span className="font-semibold text-gray-700">Business Fee Items</span>
                                </div>
                                <p className="text-2xl font-bold text-purple-600">{previewData.summary.businessItemsCount}</p>
                            </div>
                        </div>
                    </div>

                    {/* Property Zones Preview */}
                    {previewData.propertyZones.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-gray-700 mb-2">Property Rate Zones Preview</h4>
                            <div className="overflow-x-auto max-h-64 overflow-y-auto border rounded-lg">
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Zone Name</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Type</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Rate Impost</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Min Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {previewData.propertyZones.map((z: any, i: number) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-3 py-2">{z.zone_name}</td>
                                                <td className="px-3 py-2">{z.zone_type}</td>
                                                <td className="px-3 py-2">{z.rate_impost_min}{z.rate_impost_max ? ` - ${z.rate_impost_max}` : ''}</td>
                                                <td className="px-3 py-2">{z.minimum_rate_min}{z.minimum_rate_max ? ` - ${z.minimum_rate_max}` : ''}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Business Items Preview */}
                    {previewData.businessItems.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-gray-700 mb-2">Business Fee Items Preview (first 20)</h4>
                            <div className="overflow-x-auto max-h-64 overflow-y-auto border rounded-lg">
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">#</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Description</th>
                                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">CAT A</th>
                                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">CAT B</th>
                                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">CAT C</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {previewData.businessItems.slice(0, 20).map((item: any, i: number) => (
                                            <tr key={i} className={`hover:bg-gray-50 ${item.is_group_header ? 'bg-gray-50 font-semibold' : ''}`}>
                                                <td className="px-3 py-2">{item.main_item_number}</td>
                                                <td className="px-3 py-2">{item.description}</td>
                                                <td className="px-3 py-2 text-right">{item.cat_a_fee || '-'}</td>
                                                <td className="px-3 py-2 text-right">{item.cat_b_fee || '-'}</td>
                                                <td className="px-3 py-2 text-right">{item.cat_c_fee || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex space-x-3">
                        <button
                            onClick={handleCommit}
                            disabled={importing}
                            className="btn-primary flex items-center space-x-2"
                        >
                            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            <span>{importing ? 'Importing...' : 'Confirm Import'}</span>
                        </button>
                        <button
                            onClick={() => { setPreviewData(null); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                            className="btn-secondary"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
