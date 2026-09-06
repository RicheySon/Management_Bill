/**
 * Fee-fixing helpers: property class / BOP category × CAT fee columns → bill amount
 * Matches Ga North fee fixing Excel.
 */

export const propertyClassNumber = (classificationName?: string | null): number | null => {
    if (!classificationName) return null;
    const match = String(classificationName).match(/(\d+)/);
    if (!match) return null;
    const n = parseInt(match[1], 10);
    return Number.isFinite(n) && n > 0 ? n : null;
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
    if (classNum && catMap[classNum] != null && catMap[classNum] !== '') {
        const fee = parseFloat(String(catMap[classNum]));
        if (!isNaN(fee) && fee > 0) return fee;
    }

    const catA = parseFloat(String(zone.cat_a_fee ?? ''));
    if (!isNaN(catA) && catA > 0) return catA;

    const rateImpost = parseFloat(String(zone.rate_impost_min ?? 0)) || 0;
    const minimumRate = parseFloat(String(zone.minimum_rate_min ?? 0)) || 0;
    const calculatedRate = rateImpost * propertySize;
    let current = Math.max(calculatedRate, minimumRate || 0);
    if ((!current || current <= 0) && minimumRate > 0) current = minimumRate;
    return current || 0;
};

/** "Category A" / "A" / "CAT A" → a */
export const businessCategoryLetter = (categoryClass?: string | null): string => {
    if (!categoryClass) return 'a';
    const raw = String(categoryClass).trim().toLowerCase();
    const match = raw.match(/([a-f])\b/) || raw.match(/cat[_\s-]?([a-f])/);
    if (match) return match[1];
    const stripped = raw.replace(/^category\s*/i, '').replace(/^cat[_\s-]*/i, '').trim();
    if (/^[a-f]$/.test(stripped)) return stripped;
    return 'a';
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
    const preferred = parseFloat(String(feeItem[`cat_${letter}_fee`] ?? ''));
    if (!isNaN(preferred) && preferred > 0) return preferred;

    for (const key of ['cat_a_fee', 'cat_b_fee', 'cat_c_fee', 'cat_d_fee', 'cat_e_fee', 'cat_f_fee']) {
        const n = parseFloat(String(feeItem[key] ?? ''));
        if (!isNaN(n) && n > 0) return n;
    }
    return 0;
};
