import pool from '../config/database';
import { logAction, AuditContext } from './audit.service';

export type AmountEntityType = 'BILL' | 'PROPERTY_RATE_ZONE' | 'BUSINESS_FEE_ITEM';

const BILL_MONEY_FIELDS = ['current_rate', 'arrears', 'rebate', 'total_amount'] as const;
const ZONE_MONEY_FIELDS = ['rate_impost_min', 'rate_impost_max', 'minimum_rate_min', 'minimum_rate_max'] as const;
const FEE_ITEM_MONEY_FIELDS = ['cat_a_fee', 'cat_b_fee', 'cat_c_fee', 'cat_d_fee', 'cat_e_fee', 'cat_f_fee'] as const;

const pickFields = (row: Record<string, any>, fields: readonly string[]) => {
    const out: Record<string, any> = {};
    for (const f of fields) {
        if (row[f] !== undefined) {
            out[f] = row[f] === null ? null : Number(row[f]);
        }
    }
    return out;
};

const moneyFieldsChanged = (oldVals: Record<string, any>, newVals: Record<string, any>) => {
    return Object.keys(newVals).some((k) => {
        const a = oldVals[k] == null ? null : Number(oldVals[k]);
        const b = newVals[k] == null ? null : Number(newVals[k]);
        return a !== b;
    });
};

export const createAmountChangeRequest = async (params: {
    entityType: AmountEntityType;
    entityId: string;
    proposedValues: Record<string, any>;
    reason?: string;
    requestedBy: string;
    auditCtx?: AuditContext;
}) => {
    const { entityType, entityId, proposedValues, reason, requestedBy, auditCtx } = params;

    let oldValues: Record<string, any> = {};
    let newValues: Record<string, any> = {};
    let fields: readonly string[] = [];

    if (entityType === 'BILL') {
        fields = BILL_MONEY_FIELDS;
        const result = await pool.query('SELECT * FROM bills WHERE id = $1', [entityId]);
        if (result.rows.length === 0) throw new Error('Bill not found');
        const bill = result.rows[0];
        oldValues = pickFields(bill, fields);
        newValues = { ...oldValues, ...pickFields(proposedValues, fields) };

        // Recalculate total if components provided without explicit total
        if (
            (proposedValues.current_rate !== undefined ||
                proposedValues.arrears !== undefined ||
                proposedValues.rebate !== undefined) &&
            proposedValues.total_amount === undefined
        ) {
            newValues.total_amount =
                Number(newValues.current_rate || 0) +
                Number(newValues.arrears || 0) -
                Number(newValues.rebate || 0);
        }
        // Keep amount_due consistent with remaining unpaid portion of new total
        const amountPaid = Number(bill.amount_paid || 0);
        (newValues as any).amount_due = Math.max(Number(newValues.total_amount) - amountPaid, 0);
        (oldValues as any).amount_due = Number(bill.amount_due);
        (oldValues as any).amount_paid = amountPaid;
    } else if (entityType === 'PROPERTY_RATE_ZONE') {
        fields = ZONE_MONEY_FIELDS;
        const result = await pool.query('SELECT * FROM property_rate_zones WHERE id = $1', [entityId]);
        if (result.rows.length === 0) throw new Error('Property rate zone not found');
        oldValues = pickFields(result.rows[0], fields);
        newValues = { ...oldValues, ...pickFields(proposedValues, fields) };
    } else if (entityType === 'BUSINESS_FEE_ITEM') {
        fields = FEE_ITEM_MONEY_FIELDS;
        const result = await pool.query('SELECT * FROM business_fee_items WHERE id = $1', [entityId]);
        if (result.rows.length === 0) throw new Error('Business fee item not found');
        oldValues = pickFields(result.rows[0], fields);
        newValues = { ...oldValues, ...pickFields(proposedValues, fields) };
    } else {
        throw new Error('Unsupported entity type');
    }

    if (!moneyFieldsChanged(oldValues, newValues)) {
        throw new Error('No money field changes detected');
    }

    // Prevent duplicate pending requests for same entity
    const pending = await pool.query(
        `SELECT id FROM amount_change_requests
         WHERE entity_type = $1 AND entity_id = $2 AND status = 'PENDING'`,
        [entityType, entityId]
    );
    if (pending.rows.length > 0) {
        throw new Error('A pending amount change already exists for this record');
    }

    const changedKeys = Object.keys(newValues).filter(
        (k) => Number(oldValues[k]) !== Number(newValues[k]) && fields.includes(k as any)
    );

    const insert = await pool.query(
        `INSERT INTO amount_change_requests (
            entity_type, entity_id, field_changes, old_values, new_values,
            reason, status, requested_by
        ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7)
        RETURNING *`,
        [
            entityType,
            entityId,
            JSON.stringify(changedKeys),
            JSON.stringify(oldValues),
            JSON.stringify(newValues),
            reason || null,
            requestedBy,
        ]
    );

    const request = insert.rows[0];

    await logAction(
        requestedBy,
        'AMOUNT_CHANGE_REQUESTED',
        entityType,
        entityId,
        oldValues,
        { ...newValues, request_id: request.id, reason },
        auditCtx
    );

    return request;
};

export const listAmountChangeRequests = async (filters: {
    status?: string;
    entityType?: string;
    limit?: number;
}) => {
    const params: any[] = [];
    let paramIndex = 1;
    let query = `
        SELECT acr.*,
               req.full_name as requested_by_name, req.email as requested_by_email,
               rev.full_name as reviewed_by_name
        FROM amount_change_requests acr
        LEFT JOIN system_users req ON acr.requested_by = req.id
        LEFT JOIN system_users rev ON acr.reviewed_by = rev.id
        WHERE 1=1
    `;

    if (filters.status) {
        query += ` AND acr.status = $${paramIndex++}`;
        params.push(filters.status);
    }
    if (filters.entityType) {
        query += ` AND acr.entity_type = $${paramIndex++}`;
        params.push(filters.entityType);
    }

    query += ` ORDER BY acr.created_at DESC LIMIT $${paramIndex}`;
    params.push(filters.limit || 100);

    const result = await pool.query(query, params);
    return result.rows;
};

export const approveAmountChange = async (
    requestId: string,
    reviewedBy: string,
    reviewNote?: string,
    auditCtx?: AuditContext
) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const reqResult = await client.query(
            `SELECT * FROM amount_change_requests WHERE id = $1 FOR UPDATE`,
            [requestId]
        );
        if (reqResult.rows.length === 0) throw new Error('Amount change request not found');
        const request = reqResult.rows[0];
        if (request.status !== 'PENDING') throw new Error('Request is not pending');

        const newValues =
            typeof request.new_values === 'string'
                ? JSON.parse(request.new_values)
                : request.new_values;

        if (request.entity_type === 'BILL') {
            const amountDue =
                newValues.amount_due != null
                    ? Number(newValues.amount_due)
                    : Math.max(
                          Number(newValues.total_amount) -
                              Number(
                                  (
                                      await client.query('SELECT amount_paid FROM bills WHERE id = $1', [
                                          request.entity_id,
                                      ])
                                  ).rows[0]?.amount_paid || 0
                              ),
                          0
                      );

            let paymentStatus = 'UNPAID';
            const paidResult = await client.query('SELECT amount_paid FROM bills WHERE id = $1', [
                request.entity_id,
            ]);
            const amountPaid = Number(paidResult.rows[0]?.amount_paid || 0);
            if (amountDue <= 0) paymentStatus = 'PAID';
            else if (amountPaid > 0) paymentStatus = 'PARTIAL';

            await client.query(
                `UPDATE bills SET
                    current_rate = $1,
                    arrears = $2,
                    rebate = $3,
                    total_amount = $4,
                    amount_due = $5,
                    payment_status = $6,
                    updated_at = NOW()
                 WHERE id = $7`,
                [
                    Number(newValues.current_rate),
                    Number(newValues.arrears),
                    Number(newValues.rebate),
                    Number(newValues.total_amount),
                    amountDue,
                    paymentStatus,
                    request.entity_id,
                ]
            );
        } else if (request.entity_type === 'PROPERTY_RATE_ZONE') {
            await client.query(
                `UPDATE property_rate_zones SET
                    rate_impost_min = COALESCE($1, rate_impost_min),
                    rate_impost_max = COALESCE($2, rate_impost_max),
                    minimum_rate_min = COALESCE($3, minimum_rate_min),
                    minimum_rate_max = COALESCE($4, minimum_rate_max),
                    updated_at = NOW()
                 WHERE id = $5`,
                [
                    newValues.rate_impost_min,
                    newValues.rate_impost_max,
                    newValues.minimum_rate_min,
                    newValues.minimum_rate_max,
                    Number(request.entity_id),
                ]
            );
        } else if (request.entity_type === 'BUSINESS_FEE_ITEM') {
            await client.query(
                `UPDATE business_fee_items SET
                    cat_a_fee = COALESCE($1, cat_a_fee),
                    cat_b_fee = COALESCE($2, cat_b_fee),
                    cat_c_fee = COALESCE($3, cat_c_fee),
                    cat_d_fee = COALESCE($4, cat_d_fee),
                    cat_e_fee = COALESCE($5, cat_e_fee),
                    cat_f_fee = COALESCE($6, cat_f_fee),
                    updated_at = NOW()
                 WHERE id = $7`,
                [
                    newValues.cat_a_fee,
                    newValues.cat_b_fee,
                    newValues.cat_c_fee,
                    newValues.cat_d_fee,
                    newValues.cat_e_fee,
                    newValues.cat_f_fee,
                    Number(request.entity_id),
                ]
            );
        }

        const updated = await client.query(
            `UPDATE amount_change_requests SET
                status = 'APPROVED',
                reviewed_by = $1,
                reviewed_at = NOW(),
                review_note = $2,
                updated_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [reviewedBy, reviewNote || null, requestId]
        );

        await client.query('COMMIT');

        await logAction(
            reviewedBy,
            'AMOUNT_CHANGE_APPROVED',
            request.entity_type,
            request.entity_id,
            typeof request.old_values === 'string' ? JSON.parse(request.old_values) : request.old_values,
            { ...newValues, request_id: requestId, review_note: reviewNote },
            auditCtx
        );

        return updated.rows[0];
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

export const rejectAmountChange = async (
    requestId: string,
    reviewedBy: string,
    reviewNote?: string,
    auditCtx?: AuditContext
) => {
    const reqResult = await pool.query(
        `SELECT * FROM amount_change_requests WHERE id = $1`,
        [requestId]
    );
    if (reqResult.rows.length === 0) throw new Error('Amount change request not found');
    const request = reqResult.rows[0];
    if (request.status !== 'PENDING') throw new Error('Request is not pending');

    const updated = await pool.query(
        `UPDATE amount_change_requests SET
            status = 'REJECTED',
            reviewed_by = $1,
            reviewed_at = NOW(),
            review_note = $2,
            updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [reviewedBy, reviewNote || null, requestId]
    );

    await logAction(
        reviewedBy,
        'AMOUNT_CHANGE_REJECTED',
        request.entity_type,
        request.entity_id,
        typeof request.old_values === 'string' ? JSON.parse(request.old_values) : request.old_values,
        {
            ...(typeof request.new_values === 'string'
                ? JSON.parse(request.new_values)
                : request.new_values),
            request_id: requestId,
            review_note: reviewNote,
        },
        auditCtx
    );

    return updated.rows[0];
};

/** Split a fee-zone/item update into metadata (apply now) vs money (enqueue). */
export const ZONE_MONEY = ZONE_MONEY_FIELDS;
export const FEE_ITEM_MONEY = FEE_ITEM_MONEY_FIELDS;
export const BILL_MONEY = BILL_MONEY_FIELDS;

export const splitMoneyFields = (
    payload: Record<string, any>,
    moneyFields: readonly string[]
): { money: Record<string, any>; metadata: Record<string, any> } => {
    const money: Record<string, any> = {};
    const metadata: Record<string, any> = {};
    for (const [k, v] of Object.entries(payload)) {
        if (moneyFields.includes(k)) money[k] = v;
        else metadata[k] = v;
    }
    return { money, metadata };
};
