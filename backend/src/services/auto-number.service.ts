import pool from '../config/database';

/**
 * Auto Number Service
 * Generates unique sequential numbers for properties, businesses, bills, and receipts
 * Format: PREFIX-YEAR-NNNNNN (e.g., GN-PR-2026-000123)
 */

export type SequenceType = 'PROPERTY' | 'BUSINESS' | 'BILL' | 'RECEIPT';

interface AutoNumberResult {
    success: boolean;
    number: string;
    error?: string;
}

/**
 * Generate next auto number for the specified type
 * Uses PostgreSQL function with row-level locking to prevent duplicates
 */
export const generateAutoNumber = async (
    type: SequenceType,
    year?: number
): Promise<AutoNumberResult> => {
    const client = await pool.connect();

    try {
        const targetYear = year || new Date().getFullYear();

        // Call PostgreSQL function to generate number
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
 * Get the current sequence number without incrementing
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
 * Parse an auto number to extract components
 */
export const parseAutoNumber = (autoNumber: string): {
    prefix: string;
    year: number;
    sequence: number;
} | null => {
    // Format: GN-PR-2026-000123
    const parts = autoNumber.split('-');

    if (parts.length !== 4) {
        return null;
    }

    return {
        prefix: `${parts[0]}-${parts[1]}`,
        year: parseInt(parts[2]),
        sequence: parseInt(parts[3]),
    };
};

/**
 * Validate auto number format
 */
export const validateAutoNumber = (autoNumber: string, type: SequenceType): boolean => {
    const parsed = parseAutoNumber(autoNumber);

    if (!parsed) {
        return false;
    }

    // Check prefix matches type
    const expectedPrefixes: Record<SequenceType, string> = {
        PROPERTY: 'GN-PR',
        BUSINESS: 'GN-BOP',
        BILL: 'GN-BILL',
        RECEIPT: 'GN-RCT',
    };

    return parsed.prefix === expectedPrefixes[type];
};

/**
 * Reset sequence for a new year (admin function)
 */
export const resetSequenceForYear = async (
    type: SequenceType,
    year: number
): Promise<boolean> => {
    try {
        const prefixes: Record<SequenceType, string> = {
            PROPERTY: 'GN-PR',
            BUSINESS: 'GN-BOP',
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
    generateAutoNumber,
    getCurrentSequence,
    parseAutoNumber,
    validateAutoNumber,
    resetSequenceForYear,
};
