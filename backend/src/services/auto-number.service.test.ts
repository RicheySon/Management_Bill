/**
 * Unit tests for customer code formatting helpers (no DB required).
 */
import {
    areaCodeFromName,
    formatCustomerCode,
    parseCustomerCode,
    validateCustomerCode,
    CUSTOMER_CODE_PREFIXES,
} from './auto-number.service';

describe('customer code format', () => {
    it('builds the documented Tantra / Baabs property example', () => {
        expect(formatCustomerCode('PROPERTY', 'Tantra', 'Baabs', 1)).toBe(
            'GNPROTANBAA000001'
        );
    });

    it('uses type-specific prefixes', () => {
        expect(CUSTOMER_CODE_PREFIXES.PROPERTY).toBe('GNPRO');
        expect(CUSTOMER_CODE_PREFIXES.BUSINESS_PROPERTY).toBe('GNBPRO');
        expect(CUSTOMER_CODE_PREFIXES.BUSINESS).toBe('GNBOP');

        expect(formatCustomerCode('BUSINESS_PROPERTY', 'Tantra', 'Baabs', 1)).toBe(
            'GNBPROTANBAA000001'
        );
        expect(formatCustomerCode('BUSINESS', 'Tantra', 'Baabs', 1)).toBe(
            'GNBOPTANBAA000001'
        );
    });

    it('takes the first three letters of electoral area and community', () => {
        expect(areaCodeFromName('Tantra')).toBe('TAN');
        expect(areaCodeFromName('Baabs')).toBe('BAA');
        expect(areaCodeFromName('Trobu')).toBe('TRO');
        expect(areaCodeFromName('Ofankor Manhean')).toBe('OFA');
    });

    it('strips non-letters and pads short names', () => {
        expect(areaCodeFromName('A-1')).toBe('AXX');
        expect(areaCodeFromName('')).toBe('XXX');
        expect(areaCodeFromName(null)).toBe('XXX');
    });

    it('zero-pads the per-area sequence to 6 digits', () => {
        expect(formatCustomerCode('PROPERTY', 'Tantra', 'Baabs', 5)).toBe(
            'GNPROTANBAA000005'
        );
        expect(formatCustomerCode('PROPERTY', 'Trobu', 'Baabs', 10)).toBe(
            'GNPROTROBAA000010'
        );
    });

    it('parses and validates customer codes', () => {
        const parsed = parseCustomerCode('GNPROTANBAA000001');
        expect(parsed).toEqual({
            prefix: 'GNPRO',
            type: 'PROPERTY',
            electoralAreaCode: 'TAN',
            communityCode: 'BAA',
            sequence: 1,
        });
        expect(validateCustomerCode('GNPROTANBAA000001', 'PROPERTY')).toBe(true);
        expect(validateCustomerCode('GNPROTANBAA000001', 'BUSINESS')).toBe(false);
        expect(parseCustomerCode('GN-PR-2026-000001')).toBeNull();
    });
});
