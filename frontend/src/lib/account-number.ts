/**
 * Account Number for display: prefer the optional legacy/manual account,
 * otherwise the generated customer code (GNPRO / GNBPRO / GNBOP).
 */
export function displayAccountNumber(
    accountNumber?: string | null,
    customerCode?: string | null
): string {
    const account = typeof accountNumber === 'string' ? accountNumber.trim() : '';
    if (account) return account;
    const code = typeof customerCode === 'string' ? customerCode.trim() : '';
    if (code) return code;
    return '—';
}
