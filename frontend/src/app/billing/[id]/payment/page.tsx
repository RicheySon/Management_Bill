'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Legacy payment URL used from customer bill links.
 * The payment UI lives on /billing/[id] — redirect so payments show correctly.
 */
export default function BillPaymentRedirectPage() {
    const { id } = useParams();
    const router = useRouter();

    useEffect(() => {
        if (id) {
            router.replace(`/billing/${id}`);
        }
    }, [id, router]);

    return (
        <div className="flex justify-center py-20">
            <div className="text-center space-y-3">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-municipal-red mx-auto" />
                <p className="text-gray-600 text-sm">Opening payment page…</p>
            </div>
        </div>
    );
}
