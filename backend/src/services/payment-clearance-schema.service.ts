import pool from '../config/database';

let clearanceEnsured = false;

/**
 * Ensure payments clearance columns exist (cheque clearance feature).
 * Production DBs that skipped 2026_z_cheque_payment_clearance.sql fail
 * GET /bills/:id with "Failed to fetch bill details" for EVERY role.
 */
export const ensurePaymentClearanceSchema = async (): Promise<void> => {
    if (clearanceEnsured) return;

    await pool.query(`
        ALTER TABLE payments
            ADD COLUMN IF NOT EXISTS clearance_status VARCHAR(20) NOT NULL DEFAULT 'CLEARED'
    `);
    await pool.query(`
        ALTER TABLE payments
            ADD COLUMN IF NOT EXISTS cleared_by UUID REFERENCES system_users(id) ON DELETE SET NULL
    `);
    await pool.query(`
        ALTER TABLE payments
            ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMP
    `);
    await pool.query(`
        ALTER TABLE payments
            ADD COLUMN IF NOT EXISTS clearance_note TEXT
    `);
    await pool.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'payments_clearance_status_check'
            ) THEN
                ALTER TABLE payments
                    ADD CONSTRAINT payments_clearance_status_check
                    CHECK (clearance_status IN ('PENDING', 'CLEARED', 'REJECTED'));
            END IF;
        END $$
    `);
    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_payments_clearance_status ON payments(clearance_status)
    `);

    clearanceEnsured = true;
};

/**
 * Load payments for a bill. Retries with a legacy select if clearance columns
 * are still missing (race / locked migrate).
 */
export const fetchBillPayments = async (billId: string) => {
    await ensurePaymentClearanceSchema();

    try {
        return await pool.query(
            `SELECT p.*,
                u.full_name as recorded_by_name,
                clr.full_name as cleared_by_name
             FROM payments p
             LEFT JOIN system_users u ON p.recorded_by = u.id
             LEFT JOIN system_users clr ON p.cleared_by = clr.id
             WHERE p.bill_id = $1
             ORDER BY p.payment_date DESC, p.created_at DESC`,
            [billId]
        );
    } catch (err: any) {
        const msg = String(err?.message || '');
        if (err?.code === '42703' || /cleared_by|clearance_/i.test(msg)) {
            console.warn('payments clearance columns unavailable; using legacy payments select');
            clearanceEnsured = false;
            return pool.query(
                `SELECT p.*,
                    u.full_name as recorded_by_name
                 FROM payments p
                 LEFT JOIN system_users u ON p.recorded_by = u.id
                 WHERE p.bill_id = $1
                 ORDER BY p.payment_date DESC, p.created_at DESC`,
                [billId]
            );
        }
        throw err;
    }
};
