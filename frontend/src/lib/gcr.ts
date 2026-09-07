/** GCR book format: YY/####### (2 digits, slash, 7 digits) — e.g. 25/1234567 */
export const GCR_PATTERN = /^\d{2}\/\d{7}$/;
export const GCR_HINT =
    'Type digits only — the slash is added automatically after the first 2 digits. Example: 251234567 → 25/1234567';
export const GCR_PLACEHOLDER = '25/1234567';
export const GCR_INPUT_PATTERN = '\\d{2}/\\d{7}';

/** Digits only (max 9 = 2 year + 7 serial). */
export function gcrDigitsOnly(value: string): string {
    return String(value || '').replace(/\D/g, '').slice(0, 9);
}

/**
 * Mobile-friendly mask: insert "/" after the first two digits.
 * Typing 251234567 becomes 25/1234567 without needing a slash key.
 */
export function formatGcrInput(value: string): string {
    const digits = gcrDigitsOnly(value);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function normalizeGcr(value: string): string {
    return formatGcrInput(value);
}

export function isValidGcr(value: string): boolean {
    return GCR_PATTERN.test(normalizeGcr(value));
}
