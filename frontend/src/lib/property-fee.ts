/**
 * Fee-fixing helpers: property class (1st–4th) × zone CAT columns → bill amount
 * Matches Ga North fee fixing Excel (Unassessed … 1st / 2nd / 3rd columns).
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
