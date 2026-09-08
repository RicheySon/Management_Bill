/**
 * Fee-fixing helpers: property class / BOP category × CAT fee columns → bill amount
 * Matches Ga North fee fixing Excel (Category A–D = CAT A–D columns).
 */

const LETTER_TO_CLASS: Record<string, number> = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 };

/** "1st Class" / "Category A" / "CAT B" / legacy Residential → 1–4 */
export const propertyClassNumber = (classificationName?: string | null): number | null => {
    if (!classificationName) return null;
    const raw = String(classificationName).trim().toLowerCase();

    // Legacy use-type seeds (pre class-tier migration)
    if (raw === 'residential') return 1;
    if (raw === 'commercial') return 2;
    if (raw === 'industrial') return 3;
    if (raw === 'mixed use' || raw === 'mixed_use') return 4;

    const letterMatch =
        raw.match(/^category\s*([a-f])\b/) ||
        raw.match(/^cat[_\s-]?([a-f])\b/) ||
        raw.match(/\b([a-f])\s*class\b/);
    if (letterMatch) return LETTER_TO_CLASS[letterMatch[1]] || null;

    const digitMatch = raw.match(/(\d+)/);
    if (digitMatch) {
        const n = parseInt(digitMatch[1], 10);
        return Number.isFinite(n) && n > 0 ? n : null;
    }
    return null;
};

/** UI label: Category A–D (keeps legacy 1st–4th readable) */
export const propertyClassLabel = (classificationName?: string | null): string => {
    const n = propertyClassNumber(classificationName);
    if (!n || n > 4) return classificationName || '';
    return `Category ${String.fromCharCode(64 + n)}`;
};

export const feeAmountForPropertyClass = (
    zone: any,
    classificationName?: string | null,
    propertySize = 50
): number => {
    if (!zone) return 0;
    const classNum = propertyClassNumber(classificationName);
    const catMap: Record<number, any> = {
        1: zone.cat_a_fee,
        2: zone.cat_b_fee,
        3: zone.cat_c_fee,
        4: zone.cat_d_fee,
    };

    // Amount is always zone × property class (CAT A–D). Never guess CAT A alone.
    if (!classNum) return 0;

    const raw = catMap[classNum];
    if (raw != null && raw !== '') {
        const fee = parseFloat(String(raw));
        if (!isNaN(fee) && fee > 0) return fee;
    }
    return 0;
};

/** Hint text for registration UI when linking rating zone + property class */
export const zoneClassFeeMessage = (
    zone: any | null | undefined,
    classificationName?: string | null
): { amount: number; message: string } => {
    if (!zone) return { amount: 0, message: '' };
    if (!propertyClassNumber(classificationName)) {
        return {
            amount: 0,
            message: `${zone.zone_name} — select Property Class (Category A–D); amount comes from fee fixing for that class`,
        };
    }
    const amount = feeAmountForPropertyClass(zone, classificationName);
    if (amount > 0) {
        return {
            amount,
            message: `${zone.zone_name} × ${propertyClassLabel(classificationName)}: GHS ${amount.toLocaleString()}`,
        };
    }
    return {
        amount: 0,
        message: `${zone.zone_name} × ${propertyClassLabel(classificationName)} — no fee set for this category in Fee Configuration`,
    };
};

/** "Category A" / "A" / "CAT A" → a (null if unknown) */
export const businessCategoryLetter = (categoryClass?: string | null): string | null => {
    if (!categoryClass) return null;
    const raw = String(categoryClass).trim().toLowerCase();
    const match = raw.match(/([a-f])\b/) || raw.match(/cat[_\s-]?([a-f])/);
    if (match) return match[1];
    const stripped = raw.replace(/^category\s*/i, '').replace(/^cat[_\s-]*/i, '').trim();
    if (/^[a-f]$/.test(stripped)) return stripped;
    return null;
};

/**
 * BOP fee from fee-fixing item + category class (CAT A/B/C/D columns).
 */
export const feeAmountForBusinessCategory = (
    feeItem: any,
    categoryClass?: string | null
): number => {
    if (!feeItem) return 0;
    const letter = businessCategoryLetter(categoryClass);

    if (letter) {
        const preferred = parseFloat(String(feeItem[`cat_${letter}_fee`] ?? ''));
        if (!isNaN(preferred) && preferred > 0) return preferred;
        return 0;
    }

    // No category selected — first available fee (provisional)
    for (const key of ['cat_a_fee', 'cat_b_fee', 'cat_c_fee', 'cat_d_fee', 'cat_e_fee', 'cat_f_fee']) {
        const n = parseFloat(String(feeItem[key] ?? ''));
        if (!isNaN(n) && n > 0) return n;
    }
    return 0;
};
