'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, User, X } from 'lucide-react';
import { fetchCustomers } from '@/lib/api-client';

type CustomerOption = {
    id: string;
    full_name: string;
    phone_number: string;
    email?: string;
    gender?: string;
    marital_status?: string;
    ghana_card_no?: string;
    gps_address?: string;
};

interface CustomerSearchSelectProps {
    value?: string;
    onChange: (customerId: string, customer: CustomerOption | null) => void;
    label?: string;
    required?: boolean;
    error?: string;
}

export default function CustomerSearchSelect({
    value,
    onChange,
    label = 'Select Existing Customer',
    required,
    error,
}: CustomerSearchSelectProps) {
    const [query, setQuery] = useState('');
    const [customers, setCustomers] = useState<CustomerOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<CustomerOption | null>(null);

    useEffect(() => {
        let cancelled = false;
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const result = await fetchCustomers({
                    search: query.trim() || undefined,
                    limit: 25,
                });
                if (!cancelled) {
                    setCustomers(result.data || []);
                }
            } catch {
                if (!cancelled) setCustomers([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 250);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [query]);

    useEffect(() => {
        if (!value) {
            setSelected(null);
            return;
        }
        const match = customers.find((c) => c.id === value);
        if (match) setSelected(match);
    }, [value, customers]);

    const helper = useMemo(() => {
        if (loading) return 'Searching…';
        if (query.trim() && customers.length === 0) return 'No customers match that search.';
        if (!query.trim()) return 'Type a name or phone to search (shows first 25).';
        return `${customers.length} result${customers.length === 1 ? '' : 's'}`;
    }, [loading, query, customers.length]);

    return (
        <div className="space-y-3">
            <label className="label">
                {label} {required && <span className="text-municipal-red">*</span>}
            </label>

            {selected && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-municipal-red/10 text-municipal-red flex items-center justify-center font-bold">
                            {selected.full_name?.[0] || <User className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{selected.full_name}</p>
                            <p className="text-xs text-gray-500">{selected.phone_number}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="text-gray-500 hover:text-red-600"
                        onClick={() => {
                            setSelected(null);
                            setQuery('');
                            onChange('', null);
                        }}
                        title="Clear selection"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="search"
                    className="input-field pl-10"
                    placeholder="Search by name or phone…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>
            <p className="text-xs text-gray-500">{helper}</p>

            <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 divide-y bg-white">
                {customers.map((customer) => (
                    <button
                        key={customer.id}
                        type="button"
                        onClick={() => {
                            setSelected(customer);
                            onChange(customer.id, customer);
                        }}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                            value === customer.id ? 'bg-red-50' : ''
                        }`}
                    >
                        <p className="font-medium text-gray-900">{customer.full_name}</p>
                        <p className="text-xs text-gray-500">{customer.phone_number}</p>
                    </button>
                ))}
                {!loading && customers.length === 0 && (
                    <p className="px-4 py-6 text-sm text-gray-500 text-center">No customers to show.</p>
                )}
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
    );
}
