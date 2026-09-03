/** GCR book format: YY/####### (2 digits, slash, 7 digits) — e.g. 25/1234567 */
export const GCR_PATTERN = /^\d{2}\/\d{7}$/;
export const GCR_HINT =
    'Enter GCR as two digits, a slash, then seven digits (10 characters). Example: 25/1234567';
export const GCR_PLACEHOLDER = '25/1234567';
export const GCR_INPUT_PATTERN = '\\d{2}/\\d{7}';

export function normalizeGcr(value: string): string {
    return String(value || '').trim();
}

export function isValidGcr(value: string): boolean {
    return GCR_PATTERN.test(normalizeGcr(value));
}
