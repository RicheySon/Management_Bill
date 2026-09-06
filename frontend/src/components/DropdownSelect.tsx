'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export type DropdownOption = {
    value: string;
    label: string;
};

interface DropdownSelectProps {
    value?: string | number | null;
    onChange: (value: string) => void;
    options: DropdownOption[];
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    /** Optional id for label association */
    id?: string;
}

/**
 * Custom dropdown that opens an inline list instead of the native mobile
 * radio picker modal. Matches the look of `.input-field` selects.
 */
export default function DropdownSelect({
    value,
    onChange,
    options,
    placeholder = 'Select option',
    disabled,
    className = '',
    id,
}: DropdownSelectProps) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const stringValue = value === undefined || value === null ? '' : String(value);
    const selected = options.find((o) => o.value === stringValue);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <div ref={rootRef} className={`relative ${className}`}>
            <button
                id={id}
                type="button"
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => !disabled && setOpen((v) => !v)}
                className="input-field w-full flex items-center justify-between gap-2 text-left"
            >
                <span className={selected ? 'text-gray-900 truncate' : 'text-gray-400 truncate'}>
                    {selected ? selected.label : placeholder}
                </span>
                <ChevronDown
                    className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {open && (
                <ul
                    role="listbox"
                    className="absolute z-40 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1"
                >
                    <li>
                        <button
                            type="button"
                            role="option"
                            aria-selected={!stringValue}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50"
                            onClick={() => {
                                onChange('');
                                setOpen(false);
                            }}
                        >
                            {placeholder}
                        </button>
                    </li>
                    {options.map((opt) => {
                        const active = opt.value === stringValue;
                        return (
                            <li key={opt.value}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={active}
                                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-2 hover:bg-gray-50 ${
                                        active ? 'bg-red-50 text-municipal-red font-medium' : 'text-gray-900'
                                    }`}
                                    onClick={() => {
                                        onChange(opt.value);
                                        setOpen(false);
                                    }}
                                >
                                    <span className="truncate">{opt.label}</span>
                                    {active && <Check className="w-4 h-4 shrink-0" />}
                                </button>
                            </li>
                        );
                    })}
                    {options.length === 0 && (
                        <li className="px-4 py-3 text-sm text-gray-500 text-center">No options</li>
                    )}
                </ul>
            )}
        </div>
    );
}
