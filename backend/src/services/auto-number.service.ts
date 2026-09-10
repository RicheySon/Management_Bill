import pool from '../config/database';

/**
 * Auto Number Service
 *
 * Customer codes (property / business property / BOP):
 *   PREFIX + EA3 + COMMUNITY3 + NNNNNN
 *   e.g. GNPROTANBAA000001
 * Sequence is per electoral area (and per code type).
 *
 * Bill / receipt numbers remain PREFIX-YEAR-NNNNNN
 *   e.g. GN-BILL-2026-000123
 */

export type SequenceType = 'PROPERTY' | 'BUSINESS_PROPERTY' | 'BUSINESS' | 'BILL' | 'RECEIPT';
export type CustomerCodeType = 'PROPERTY' | 'BUSINESS_PROPERTY' | 'BUSINESS';

export const CUSTOMER_CODE_PREFIXES: Record<CustomerCodeType, string> = {
    PROPERTY: 'GNPRO',
    BUSINESS_PROPERTY: 'GNBPRO',
    BUSINESS: 'GNBOP',
};

interface AutoNumberResult {
    success: boolean;
    number: string;
    error?: string;
}

/** First 3 A–Z letters of a place name, uppercased (pad with X if shorter). */
export const areaCodeFromName = (name: string | null | undefined): string => {
    const letters = String(name || '')
        .replace(/[^A-Za-z]/g, '')
        .toUpperCase();
    if (!letters) {
        return 'XXX';
    }
    return (letters + 'XXX').slice(0, 3);
};

/** Build customer code string from parts (does not allocate a sequence). */
export const formatCustomerCode = (
    type: CustomerCodeType,
    electoralAreaName: string,
    communityName: string,
    sequence: number
): string => {
    const prefix = CUSTOMER_CODE_PREFIXES[type];
    const ea = areaCodeFromName(electoralAreaName);
    const community = areaCodeFromName(communityName);
    return `${prefix}${ea}${community}${String(sequence).padStart(6, '0')}`;
};

/**
 * Generate next customer code for property / business property / BOP.
 * Uses PostgreSQL generate_customer_code with row-level locking.
 */
export const generateCustomerCode = async (
    type: CustomerCodeType,
    electoralAreaId: number,
    localAreaId: number
): Promise<AutoNumberResult> => {
    const client = await pool.connect();

    try {
        const result = await client.query(
            'SELECT generate_customer_code($1, $2, $3) as customer_code',
            [type, electoralAreaId, localAreaId]
        );

        const customerCode = result.rows[0].customer_code;
        console.log(`✅ Generated ${type} customer code: ${customerCode}`);

        return {
            success: true,
            number: customerCode,
        };
    } catch (error: any) {
        console.error(`❌ Error generating ${type} customer code:`, error);
        return {
            success: false,
            number: '',
            error: error.message,
        };
    } finally {
        client.release();
    }
};

/**
 * Generate next auto number for BILL / RECEIPT (year-based).
 * Prefer generateCustomerCode for PROPERTY / BUSINESS_PROPERTY / BUSINESS.
 */
export const generateAutoNumber = async (
    type: SequenceType,
    year?: number
): Promise<AutoNumberResult> => {
    const client = await pool.connect();

    try {
        const targetYear = year || new Date().getFullYear();

        const result = await client.query(
            'SELECT generate_auto_number($1, $2) as auto_number',
            [type, targetYear]
        );

        const autoNumber = result.rows[0].auto_number;

        console.log(`✅ Generated ${type} number: ${autoNumber}`);

        return {
            success: true,
            number: autoNumber,
        };
    } catch (error: any) {
        console.error(`❌ Error generating ${type} number:`, error);
        return {
            success: false,
            number: '',
            error: error.message,
        };
    } finally {
        client.release();
    }
};

/**
 * Get the current area sequence number without incrementing
 */
export const getCurrentAreaSequence = async (
    type: CustomerCodeType,
    electoralAreaId: number
): Promise<number> => {
    try {
        const result = await pool.query(
            `SELECT last_number FROM area_sequences
             WHERE sequence_type = $1 AND electoral_area_id = $2`,
            [type, electoralAreaId]
        );

        return result.rows.length > 0 ? result.rows[0].last_number : 0;
    } catch (error) {
        console.error('Error getting current area sequence:', error);
        return 0;
    }
};

/**
 * Get the current year sequence number without incrementing (bills/receipts)
 */
export const getCurrentSequence = async (
    type: SequenceType,
    year?: number
): Promise<number> => {
    try {
        const targetYear = year || new Date().getFullYear();

        const result = await pool.query(
            'SELECT last_number FROM system_sequences WHERE sequence_type = $1 AND year = $2',
            [type, targetYear]
        );

        return result.rows.length > 0 ? result.rows[0].last_number : 0;
    } catch (error) {
        console.error('Error getting current sequence:', error);
        return 0;
    }
};

/**
 * Parse a customer code (GNPROTANBAA000001) into components
 */
export const parseCustomerCode = (
    customerCode: string
): {
    prefix: string;
    type: CustomerCodeType | null;
    electoralAreaCode: string;
    communityCode: string;
    sequence: number;
} | null => {
    const match = customerCode.match(/^(GNPRO|GNBPRO|GNBOP)([A-Z]{3})([A-Z]{3})(\d{6})$/);
    if (!match) {
        return null;
    }

    const prefix = match[1];
    const typeByPrefix: Record<string, CustomerCodeType> = {
        GNPRO: 'PROPERTY',
        GNBPRO: 'BUSINESS_PROPERTY',
        GNBOP: 'BUSINESS',
    };

    return {
        prefix,
        type: typeByPrefix[prefix] || null,
        electoralAreaCode: match[2],
        communityCode: match[3],
        sequence: parseInt(match[4], 10),
    };
};

/**
 * Parse a legacy or bill/receipt auto number (PREFIX-YEAR-SEQ)
 */
export const parseAutoNumber = (
    autoNumber: string
): {
    prefix: string;
    year: number;
    sequence: number;
} | null => {
    const parts = autoNumber.split('-');

    if (parts.length !== 4) {
        return null;
    }

    return {
        prefix: `${parts[0]}-${parts[1]}`,
        year: parseInt(parts[2], 10),
        sequence: parseInt(parts[3], 10),
    };
};

/**
 * Validate customer code format for a given type
 */
export const validateCustomerCode = (
    customerCode: string,
    type: CustomerCodeType
): boolean => {
    const parsed = parseCustomerCode(customerCode);
    return !!parsed && parsed.type === type;
};

/**
 * Validate year-based auto number format (bills / receipts / legacy)
 */
export const validateAutoNumber = (autoNumber: string, type: SequenceType): boolean => {
    const parsed = parseAutoNumber(autoNumber);

    if (!parsed) {
        return false;
    }

    const expectedPrefixes: Record<SequenceType, string> = {
        PROPERTY: 'GNPRO',
        BUSINESS_PROPERTY: 'GNBPRO',
        BUSINESS: 'GNBOP',
        BILL: 'GN-BILL',
        RECEIPT: 'GN-RCT',
    };

    // Legacy hyphenated customer codes still validate via parseAutoNumber shape
    if (type === 'BILL' || type === 'RECEIPT') {
        return parsed.prefix === expectedPrefixes[type];
    }

    // New customer codes are not hyphenated — accept either legacy or new
    if (validateCustomerCode(autoNumber, type as CustomerCodeType)) {
        return true;
    }

    const legacyPrefixes: Record<string, string> = {
        PROPERTY: 'GN-PR',
        BUSINESS_PROPERTY: 'GN-BP',
        BUSINESS: 'GN-BOP',
    };

    return parsed.prefix === legacyPrefixes[type];
};

/**
 * Reset year sequence for bills/receipts (admin function)
 */
export const resetSequenceForYear = async (
    type: SequenceType,
    year: number
): Promise<boolean> => {
    try {
        const prefixes: Record<SequenceType, string> = {
            PROPERTY: 'GNPRO',
            BUSINESS_PROPERTY: 'GNBPRO',
            BUSINESS: 'GNBOP',
            BILL: 'GN-BILL',
            RECEIPT: 'GN-RCT',
        };

        await pool.query(
            `INSERT INTO system_sequences (sequence_type, year, last_number, prefix)
       VALUES ($1, $2, 0, $3)
       ON CONFLICT (sequence_type, year) DO NOTHING`,
            [type, year, prefixes[type]]
        );

        console.log(`✅ Initialized sequence for ${type} - ${year}`);
        return true;
    } catch (error) {
        console.error('Error resetting sequence:', error);
        return false;
    }
};

export default {
    areaCodeFromName,
    formatCustomerCode,
    generateCustomerCode,
    generateAutoNumber,
    getCurrentAreaSequence,
    getCurrentSequence,
    parseCustomerCode,
    parseAutoNumber,
    validateCustomerCode,
    validateAutoNumber,
    resetSequenceForYear,
    CUSTOMER_CODE_PREFIXES,
};
