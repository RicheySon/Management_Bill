import pool from '../config/database';
import * as XLSX from 'xlsx';

// =====================================================
// TYPES
// =====================================================

interface FeeSchedule {
    id: number;
    year: number;
    name: string;
    effective_date: string;
    status: string;
    notes?: string;
    created_by?: string;
}

interface PropertyRateZone {
    id: number;
    fee_schedule_id: number;
    zone_name: string;
    zone_type: string;
    zone_class: number;
    rate_impost_min: number;
    rate_impost_max?: number;
    minimum_rate_min: number;
    minimum_rate_max?: number;
    affected_areas?: string;
    sort_order: number;
}

interface BusinessFeeItem {
    id: number;
    fee_schedule_id: number;
    main_item_number: number;
    sub_item_code?: string;
    description: string;
    parent_id?: number;
    frequency?: string;
    cat_a_fee?: number;
    cat_b_fee?: number;
    cat_c_fee?: number;
    cat_d_fee?: number;
    cat_e_fee?: number;
    cat_f_fee?: number;
    is_group_header: boolean;
    sort_order: number;
}

interface ParsedPropertyZone {
    zone_name: string;
    zone_type: string;
    zone_class: number;
    rate_impost_min: number;
    rate_impost_max?: number;
    minimum_rate_min: number;
    minimum_rate_max?: number;
    affected_areas?: string;
}

interface ParsedBusinessItem {
    main_item_number: number;
    sub_item_code?: string;
    description: string;
    parent_description?: string;
    frequency?: string;
    cat_a_fee?: number;
    cat_b_fee?: number;
    cat_c_fee?: number;
    cat_d_fee?: number;
    cat_e_fee?: number;
    cat_f_fee?: number;
    is_group_header: boolean;
}

interface ParsedFeeData {
    propertyZones: ParsedPropertyZone[];
    businessItems: ParsedBusinessItem[];
}

// =====================================================
// FEE SCHEDULES
// =====================================================

export const getFeeSchedules = async (year?: number): Promise<FeeSchedule[]> => {
    let query = 'SELECT * FROM fee_schedules';
    const params: any[] = [];

    if (year) {
        query += ' WHERE year = $1';
        params.push(year);
    }

    query += ' ORDER BY year DESC, created_at DESC';
    const result = await pool.query(query, params);
    return result.rows;
};

export const getFeeScheduleById = async (id: number): Promise<FeeSchedule | null> => {
    const result = await pool.query('SELECT * FROM fee_schedules WHERE id = $1', [id]);
    return result.rows[0] || null;
};

export const createFeeSchedule = async (data: {
    year: number;
    name: string;
    effective_date: string;
    notes?: string;
    created_by?: string;
}): Promise<FeeSchedule> => {
    const result = await pool.query(
        `INSERT INTO fee_schedules (year, name, effective_date, notes, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [data.year, data.name, data.effective_date, data.notes || null, data.created_by || null]
    );
    return result.rows[0];
};

export const updateFeeSchedule = async (id: number, data: {
    name?: string;
    effective_date?: string;
    notes?: string;
}): Promise<FeeSchedule> => {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
        fields.push(`name = $${paramIndex++}`);
        values.push(data.name);
    }
    if (data.effective_date !== undefined) {
        fields.push(`effective_date = $${paramIndex++}`);
        values.push(data.effective_date);
    }
    if (data.notes !== undefined) {
        fields.push(`notes = $${paramIndex++}`);
        values.push(data.notes);
    }

    if (fields.length === 0) {
        throw new Error('No fields to update');
    }

    values.push(id);
    const result = await pool.query(
        `UPDATE fee_schedules SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
    );

    if (result.rows.length === 0) {
        throw new Error('Fee schedule not found');
    }
    return result.rows[0];
};

export const activateFeeSchedule = async (id: number): Promise<FeeSchedule> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get schedule to activate
        const schedule = await client.query('SELECT * FROM fee_schedules WHERE id = $1', [id]);
        if (schedule.rows.length === 0) {
            throw new Error('Fee schedule not found');
        }

        const year = schedule.rows[0].year;

        // Archive any existing ACTIVE schedule for the same year
        await client.query(
            `UPDATE fee_schedules SET status = 'ARCHIVED' WHERE year = $1 AND status = 'ACTIVE'`,
            [year]
        );

        // Activate the selected schedule
        const result = await client.query(
            `UPDATE fee_schedules SET status = 'ACTIVE' WHERE id = $1 RETURNING *`,
            [id]
        );

        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// =====================================================
// PROPERTY RATE ZONES
// =====================================================

export const getPropertyRateZones = async (feeScheduleId: number): Promise<PropertyRateZone[]> => {
    const result = await pool.query(
        'SELECT * FROM property_rate_zones WHERE fee_schedule_id = $1 ORDER BY sort_order, zone_type, zone_class',
        [feeScheduleId]
    );
    return result.rows;
};

export const createPropertyRateZone = async (feeScheduleId: number, data: Omit<PropertyRateZone, 'id' | 'fee_schedule_id' | 'created_at' | 'updated_at'>): Promise<PropertyRateZone> => {
    const result = await pool.query(
        `INSERT INTO property_rate_zones (fee_schedule_id, zone_name, zone_type, zone_class, rate_impost_min, rate_impost_max, minimum_rate_min, minimum_rate_max, affected_areas, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [feeScheduleId, data.zone_name, data.zone_type, data.zone_class || 1, data.rate_impost_min, data.rate_impost_max || null, data.minimum_rate_min, data.minimum_rate_max || null, data.affected_areas || null, data.sort_order || 0]
    );
    return result.rows[0];
};

export const updatePropertyRateZone = async (zoneId: number, data: Partial<PropertyRateZone>): Promise<PropertyRateZone> => {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const allowedFields = ['zone_name', 'zone_type', 'zone_class', 'rate_impost_min', 'rate_impost_max', 'minimum_rate_min', 'minimum_rate_max', 'affected_areas', 'sort_order'];

    for (const field of allowedFields) {
        if ((data as any)[field] !== undefined) {
            fields.push(`${field} = $${paramIndex++}`);
            values.push((data as any)[field]);
        }
    }

    if (fields.length === 0) throw new Error('No fields to update');

    values.push(zoneId);
    const result = await pool.query(
        `UPDATE property_rate_zones SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
    );

    if (result.rows.length === 0) throw new Error('Property rate zone not found');
    return result.rows[0];
};

export const deletePropertyRateZone = async (zoneId: number): Promise<void> => {
    const result = await pool.query('DELETE FROM property_rate_zones WHERE id = $1', [zoneId]);
    if (result.rowCount === 0) throw new Error('Property rate zone not found');
};

// =====================================================
// BUSINESS FEE ITEMS
// =====================================================

export const getBusinessFeeItems = async (feeScheduleId: number): Promise<BusinessFeeItem[]> => {
    const result = await pool.query(
        'SELECT * FROM business_fee_items WHERE fee_schedule_id = $1 ORDER BY sort_order, main_item_number, sub_item_code',
        [feeScheduleId]
    );
    return result.rows;
};

export const createBusinessFeeItem = async (feeScheduleId: number, data: any): Promise<BusinessFeeItem> => {
    const result = await pool.query(
        `INSERT INTO business_fee_items (fee_schedule_id, main_item_number, sub_item_code, description, parent_id, frequency, cat_a_fee, cat_b_fee, cat_c_fee, cat_d_fee, cat_e_fee, cat_f_fee, is_group_header, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
            feeScheduleId,
            data.main_item_number,
            data.sub_item_code || null,
            data.description,
            data.parent_id || null,
            data.frequency || null,
            data.cat_a_fee || null,
            data.cat_b_fee || null,
            data.cat_c_fee || null,
            data.cat_d_fee || null,
            data.cat_e_fee || null,
            data.cat_f_fee || null,
            data.is_group_header || false,
            data.sort_order || 0,
        ]
    );
    return result.rows[0];
};

export const updateBusinessFeeItem = async (itemId: number, data: any): Promise<BusinessFeeItem> => {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const allowedFields = ['main_item_number', 'sub_item_code', 'description', 'parent_id', 'frequency', 'cat_a_fee', 'cat_b_fee', 'cat_c_fee', 'cat_d_fee', 'cat_e_fee', 'cat_f_fee', 'is_group_header', 'sort_order'];

    for (const field of allowedFields) {
        if (data[field] !== undefined) {
            fields.push(`${field} = $${paramIndex++}`);
            values.push(data[field]);
        }
    }

    if (fields.length === 0) throw new Error('No fields to update');

    values.push(itemId);
    const result = await pool.query(
        `UPDATE business_fee_items SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
    );

    if (result.rows.length === 0) throw new Error('Business fee item not found');
    return result.rows[0];
};

export const deleteBusinessFeeItem = async (itemId: number): Promise<void> => {
    const result = await pool.query('DELETE FROM business_fee_items WHERE id = $1', [itemId]);
    if (result.rowCount === 0) throw new Error('Business fee item not found');
};

// =====================================================
// ACTIVE SCHEDULE LOOKUPS (for billing/forms)
// =====================================================

export const getActivePropertyRateZones = async (year: number): Promise<PropertyRateZone[]> => {
    const result = await pool.query(
        `SELECT prz.* FROM property_rate_zones prz
         INNER JOIN fee_schedules fs ON prz.fee_schedule_id = fs.id
         WHERE fs.year = $1 AND fs.status = 'ACTIVE'
         ORDER BY prz.sort_order, prz.zone_type, prz.zone_class`,
        [year]
    );
    return result.rows;
};

export const getActiveBusinessFeeItems = async (year: number): Promise<BusinessFeeItem[]> => {
    const result = await pool.query(
        `SELECT bfi.* FROM business_fee_items bfi
         INNER JOIN fee_schedules fs ON bfi.fee_schedule_id = fs.id
         WHERE fs.year = $1 AND fs.status = 'ACTIVE'
         ORDER BY bfi.sort_order, bfi.main_item_number, bfi.sub_item_code`,
        [year]
    );
    return result.rows;
};

// =====================================================
// EXCEL IMPORT
// =====================================================

function cleanNumber(val: any): number | undefined {
    if (val === null || val === undefined || val === '') return undefined;
    const str = String(val).replace(/,/g, '').trim();
    const num = parseFloat(str);
    return isNaN(num) ? undefined : num;
}

export function parseRateRange(val: any): { min: number; max?: number } | null {
    if (val === null || val === undefined || val === '') return null;
    const str = String(val).replace(/,/g, '').trim();

    if (str.includes('-')) {
        const parts = str.split('-').map(s => s.trim());
        if (parts.length === 2) {
            const min = parseFloat(parts[0]);
            const max = parseFloat(parts[1]);
            if (!isNaN(min) && !isNaN(max)) {
                return { min, max };
            }
            if (!isNaN(min)) return { min };
        }
    }

    const num = parseFloat(str);
    if (!isNaN(num)) return { min: num };
    return null;
}

function detectZoneType(zoneName: string): string {
    const lower = zoneName.toLowerCase();
    if (lower.includes('industrial')) return 'INDUSTRIAL';
    if (lower.includes('commercial')) return 'COMMERCIAL';
    if (lower.includes('mixed')) return 'MIXED_USE';
    return 'RESIDENTIAL';
}

function detectZoneClass(zoneName: string): number {
    const match = zoneName.match(/(\d+)(?:st|nd|rd|th)/i);
    if (match) return parseInt(match[1]);
    return 1;
}

export const parseExcelFeeSchedule = (buffer: Buffer): ParsedFeeData => {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const propertyZones: ParsedPropertyZone[] = [];
    const businessItems: ParsedBusinessItem[] = [];

    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        let currentSection: 'UNKNOWN' | 'PROPERTY' | 'BUSINESS' = 'UNKNOWN';
        let sectionLocked = false;

        if (sheetName.toLowerCase().includes('table')) {
            currentSection = 'BUSINESS';
            sectionLocked = true;
        }

        let currentMainItemNumber = 0;
        let currentMainDescription = '';

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.every((cell: any) => cell === '' || cell === null || cell === undefined)) continue;

            const rowStr = row.map((c: any) => String(c || '').toLowerCase()).join(' ');

            // Section Detection - Only if not already locked by sheet name
            if (!sectionLocked) {
                if (rowStr.includes('rating zone') || rowStr.includes('property rates')) {
                    currentSection = 'PROPERTY';
                    continue;
                }
                if (rowStr.includes('main item') && rowStr.includes('sub item')) {
                    currentSection = 'BUSINESS';
                    sectionLocked = true;
                    continue;
                }
                if (rowStr.includes('business licence')) {
                    currentSection = 'BUSINESS';
                    sectionLocked = true;
                    continue;
                }
            }

            const fees = extractFees(row);
            const hasFees = Object.keys(fees).length > 0;
            const desc = String(row[0] || row[1] || row[2] || '').trim();

            if (desc && desc.length > 2 && !desc.toLowerCase().includes('page') && !desc.toLowerCase().includes('municipal')) {
                // Property Zone Catch-all: ONLY in PROPERTY section or very first rows
                if (currentSection === 'PROPERTY') {
                    const vals = Object.values(fees) as number[];
                    const rateImpost = vals.find(v => v < 1) || 0;
                    const minRate = vals.find(v => v >= 1) || 0;

                    if (rateImpost > 0 || minRate > 0) {
                        propertyZones.push({
                            zone_name: desc,
                            zone_type: detectZoneType(desc),
                            zone_class: detectZoneClass(desc),
                            rate_impost_min: rateImpost,
                            minimum_rate_min: minRate,
                        });
                        continue;
                    }
                }

                // Business Item Logic
                const col0 = String(row[0] || '').trim();
                const mainItemNum = parseInt(col0);

                if (!isNaN(mainItemNum) && mainItemNum > 0) {
                    currentMainItemNumber = mainItemNum;
                    currentMainDescription = String(row[2] || row[1] || '').trim();
                }

                if (hasFees || currentMainItemNumber > 0) {
                    // Filter out rows that are clearly property rates being misclassified (extremely small first value)
                    if (currentSection === 'UNKNOWN' && hasFees && (fees as any).cat_a_fee < 1) {
                        // This looks like a property rate impost, maybe treat as property if section not locked
                        propertyZones.push({
                            zone_name: desc,
                            zone_type: detectZoneType(desc),
                            zone_class: detectZoneClass(desc),
                            rate_impost_min: (fees as any).cat_a_fee,
                            minimum_rate_min: (fees as any).cat_b_fee || 0,
                        });
                        currentSection = 'PROPERTY';
                        continue;
                    }

                    businessItems.push({
                        main_item_number: currentMainItemNumber || 999,
                        sub_item_code: String(row[1] || '').length <= 10 ? String(row[1] || '') : undefined,
                        description: desc,
                        parent_description: currentMainDescription !== desc ? currentMainDescription : undefined,
                        is_group_header: !hasFees,
                        frequency: findFrequency(row),
                        ...fees,
                    });
                    if (currentSection === 'UNKNOWN') currentSection = 'BUSINESS';
                }
            }
        }
    }

    return { propertyZones, businessItems };
};

function findFrequency(row: any[]): string | undefined {
    const freqKeywords = ['per annum', 'per month', 'per day', 'per event', 'per trip', 'per load', 'per item', 'per week', 'annual', 'per visit', 'per animal', 'per offe', 'per message', 'per unit', 'per year'];
    for (const cell of row) {
        const str = String(cell || '').toLowerCase().trim();
        if (freqKeywords.some(kw => str.includes(kw))) {
            return String(cell).trim();
        }
    }
    return undefined;
}

function extractFees(row: any[]): { cat_a_fee?: number; cat_b_fee?: number; cat_c_fee?: number; cat_d_fee?: number; cat_e_fee?: number; cat_f_fee?: number } {
    const fees: number[] = [];
    for (let c = 1; c < row.length; c++) {
        const n = cleanNumber(row[c]);
        if (n !== undefined && n > 0) {
            const str = String(row[c]).toLowerCase();
            if (['per', 'annum', 'month', 'year', 'visit', 'offence', 'animal', 'message', 'meter', 'foot'].some(k => str.includes(k))) continue;
            if (n === 2026 || n === 2025) continue;
            fees.push(n);
        }
    }

    if (fees.length === 0) return {};

    const result: any = {};
    const cats = ['cat_a_fee', 'cat_b_fee', 'cat_c_fee', 'cat_d_fee', 'cat_e_fee', 'cat_f_fee'];
    for (let i = 0; i < Math.min(fees.length, 6); i++) {
        result[cats[i]] = fees[i];
    }
    return result;
}

export const importFeeScheduleFromExcel = async (
    feeScheduleId: number,
    parsedData: ParsedFeeData
): Promise<{ propertyZonesCreated: number; businessItemsCreated: number }> => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Clear existing data for this schedule
        await client.query('DELETE FROM business_fee_items WHERE fee_schedule_id = $1', [feeScheduleId]);
        await client.query('DELETE FROM property_rate_zones WHERE fee_schedule_id = $1', [feeScheduleId]);

        // Insert property zones
        let propertyZonesCreated = 0;
        for (let i = 0; i < parsedData.propertyZones.length; i++) {
            const zone = parsedData.propertyZones[i];
            await client.query(
                `INSERT INTO property_rate_zones (fee_schedule_id, zone_name, zone_type, zone_class, rate_impost_min, rate_impost_max, minimum_rate_min, minimum_rate_max, affected_areas, sort_order)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [feeScheduleId, zone.zone_name, zone.zone_type, zone.zone_class, zone.rate_impost_min, zone.rate_impost_max || null, zone.minimum_rate_min, zone.minimum_rate_max || null, zone.affected_areas || null, i]
            );
            propertyZonesCreated++;
        }

        // Insert business items - handle hierarchy
        let businessItemsCreated = 0;
        const parentIdMap: Record<string, number> = {}; // description -> id

        // First pass: insert group headers (parents)
        for (let i = 0; i < parsedData.businessItems.length; i++) {
            const item = parsedData.businessItems[i];
            if (!item.is_group_header) continue;

            const result = await client.query(
                `INSERT INTO business_fee_items (fee_schedule_id, main_item_number, sub_item_code, description, parent_id, frequency, is_group_header, sort_order)
                 VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
                 RETURNING id`,
                [feeScheduleId, item.main_item_number, item.sub_item_code || null, item.description, null, item.frequency || null, i]
            );
            parentIdMap[`${item.main_item_number}:${item.description}`] = result.rows[0].id;
            businessItemsCreated++;
        }

        // Second pass: insert leaf items (with fees)
        for (let i = 0; i < parsedData.businessItems.length; i++) {
            const item = parsedData.businessItems[i];
            if (item.is_group_header) continue;

            // Find parent
            let parentId = null;
            if (item.parent_description) {
                parentId = parentIdMap[`${item.main_item_number}:${item.parent_description}`] || null;
            }

            await client.query(
                `INSERT INTO business_fee_items (fee_schedule_id, main_item_number, sub_item_code, description, parent_id, frequency, cat_a_fee, cat_b_fee, cat_c_fee, cat_d_fee, cat_e_fee, cat_f_fee, is_group_header, sort_order)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, FALSE, $13)`,
                [feeScheduleId, item.main_item_number, item.sub_item_code || null, item.description, parentId, item.frequency || null, item.cat_a_fee || null, item.cat_b_fee || null, item.cat_c_fee || null, item.cat_d_fee || null, item.cat_e_fee || null, item.cat_f_fee || null, i + parsedData.businessItems.length]
            );
            businessItemsCreated++;
        }

        await client.query('COMMIT');
        return { propertyZonesCreated, businessItemsCreated };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export default {
    getFeeSchedules,
    getFeeScheduleById,
    createFeeSchedule,
    updateFeeSchedule,
    activateFeeSchedule,
    getPropertyRateZones,
    createPropertyRateZone,
    updatePropertyRateZone,
    deletePropertyRateZone,
    getBusinessFeeItems,
    createBusinessFeeItem,
    updateBusinessFeeItem,
    deleteBusinessFeeItem,
    getActivePropertyRateZones,
    getActiveBusinessFeeItems,
    parseExcelFeeSchedule,
    importFeeScheduleFromExcel,
};
