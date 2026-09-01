'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

/**
 * Active back navigation — uses history when available, otherwise falls back to a sensible parent route.
 */
export default function BackButton({
    fallbackHref,
    label = 'Back',
    className = '',
}: {
    fallbackHref?: string;
    label?: string;
    className?: string;
}) {
    const router = useRouter();
    const pathname = usePathname();

    if (pathname === '/' || pathname === '/login') {
        return null;
    }

    const inferredFallback = () => {
        if (fallbackHref) return fallbackHref;
        const parts = pathname.split('/').filter(Boolean);
        if (parts.length <= 1) return '/';
        // /billing/123 -> /billing ; /customers/new -> /customers
        return '/' + parts.slice(0, -1).join('/');
    };

    const handleBack = () => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back();
            return;
        }
        router.push(inferredFallback());
    };

    return (
        <button
            type="button"
            onClick={handleBack}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-municipal-red transition-colors text-sm font-medium shadow-sm ${className}`}
            aria-label="Go back"
        >
            <ArrowLeft className="w-4 h-4" />
            <span>{label}</span>
        </button>
    );
}
