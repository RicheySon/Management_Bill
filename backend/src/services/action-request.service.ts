import pool from '../config/database';
import { logAction, AuditContext } from './audit.service';

export type PrivilegedActionType = 'PRINT_BILL' | 'DELETE_BILL';

export const createPrivilegedActionRequest = async (params: {
    actionType: PrivilegedActionType;
    billId: string;
    reason?: string;
    requestedBy: string;
    auditCtx?: AuditContext;
}) => {
    const { actionType, billId, reason, requestedBy, auditCtx } = params;

    const bill = await pool.query('SELECT id, bill_number FROM bills WHERE id = $1', [billId]);
    if (bill.rows.length === 0) throw new Error('Bill not found');

    const pending = await pool.query(
        `SELECT id FROM privileged_action_requests
         WHERE action_type = $1 AND bill_id = $2 AND status = 'PENDING'
           AND requested_by = $3`,
        [actionType, billId, requestedBy]
    );
    if (pending.rows.length > 0) {
        throw new Error(`A pending ${actionType === 'PRINT_BILL' ? 'print' : 'delete'} request already exists for this bill`);
    }

    const insert = await pool.query(
        `INSERT INTO privileged_action_requests (
            action_type, bill_id, reason, status, requested_by
        ) VALUES ($1, $2, $3, 'PENDING', $4)
        RETURNING *`,
        [actionType, billId, reason || null, requestedBy]
    );

    const request = insert.rows[0];

    await logAction(
        requestedBy,
        actionType === 'PRINT_BILL' ? 'PRINT_REQUESTED' : 'DELETE_REQUESTED',
        'privileged_action_requests',
        request.id,
        null,
        { bill_id: billId, bill_number: bill.rows[0].bill_number, action_type: actionType },
        auditCtx
    );

    return request;
};

export const listPrivilegedActionRequests = async (params: {
    status?: string;
    limit?: number;
}) => {
    const { status, limit = 100 } = params;
    const queryParams: any[] = [];
    let query = `
        SELECT r.*,
               u.full_name as requested_by_name,
               rev.full_name as reviewed_by_name,
               b.bill_number,
               b.bill_type,
               c.full_name as customer_name
        FROM privileged_action_requests r
        LEFT JOIN system_users u ON r.requested_by = u.id
        LEFT JOIN system_users rev ON r.reviewed_by = rev.id
        LEFT JOIN bills b ON r.bill_id = b.id
        LEFT JOIN customers c ON b.customer_id = c.id
        WHERE 1=1
    `;
    if (status) {
        queryParams.push(status);
        query += ` AND r.status = $${queryParams.length}`;
    }
    queryParams.push(Number(limit));
    query += ` ORDER BY r.created_at DESC LIMIT $${queryParams.length}`;

    const result = await pool.query(query, queryParams);
    return result.rows;
};

export const approvePrivilegedActionRequest = async (params: {
    requestId: string;
    reviewedBy: string;
    reviewNote?: string;
    auditCtx?: AuditContext;
}) => {
    const { requestId, reviewedBy, reviewNote, auditCtx } = params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const result = await client.query(
            `SELECT * FROM privileged_action_requests WHERE id = $1 FOR UPDATE`,
            [requestId]
        );
        if (result.rows.length === 0) throw new Error('Request not found');
        const request = result.rows[0];
        if (request.status !== 'PENDING') throw new Error('Only pending requests can be approved');

        if (request.action_type === 'DELETE_BILL') {
            // Execute delete immediately on approval
            await client.query('DELETE FROM payments WHERE bill_id = $1', [request.bill_id]);
            await client.query(
                'UPDATE bills SET rolled_into_bill_id = NULL WHERE rolled_into_bill_id = $1',
                [request.bill_id]
            );
            await client.query('DELETE FROM bills WHERE id = $1', [request.bill_id]);

            await client.query(
                `UPDATE privileged_action_requests
                 SET status = 'COMPLETED', reviewed_by = $1, reviewed_at = NOW(), review_note = $2
                 WHERE id = $3`,
                [reviewedBy, reviewNote || null, requestId]
            );
        } else {
            // Print: approve so requester can print once
            await client.query(
                `UPDATE privileged_action_requests
                 SET status = 'APPROVED', reviewed_by = $1, reviewed_at = NOW(), review_note = $2
                 WHERE id = $3`,
                [reviewedBy, reviewNote || null, requestId]
            );
        }

        await client.query('COMMIT');

        await logAction(
            reviewedBy,
            request.action_type === 'PRINT_BILL' ? 'PRINT_APPROVED' : 'DELETE_APPROVED',
            'privileged_action_requests',
            requestId,
            { status: 'PENDING' },
            { status: request.action_type === 'DELETE_BILL' ? 'COMPLETED' : 'APPROVED', bill_id: request.bill_id },
            auditCtx
        );

        const updated = await pool.query('SELECT * FROM privileged_action_requests WHERE id = $1', [requestId]);
        return updated.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const rejectPrivilegedActionRequest = async (params: {
    requestId: string;
    reviewedBy: string;
    reviewNote?: string;
    auditCtx?: AuditContext;
}) => {
    const { requestId, reviewedBy, reviewNote, auditCtx } = params;

    const result = await pool.query(
        `UPDATE privileged_action_requests
         SET status = 'REJECTED', reviewed_by = $1, reviewed_at = NOW(), review_note = $2
         WHERE id = $3 AND status = 'PENDING'
         RETURNING *`,
        [reviewedBy, reviewNote || null, requestId]
    );
    if (result.rows.length === 0) throw new Error('Pending request not found');

    await logAction(
        reviewedBy,
        result.rows[0].action_type === 'PRINT_BILL' ? 'PRINT_REJECTED' : 'DELETE_REJECTED',
        'privileged_action_requests',
        requestId,
        { status: 'PENDING' },
        { status: 'REJECTED' },
        auditCtx
    );

    return result.rows[0];
};

/**
 * True if user may print immediately (has print_bill) or has an APPROVED print request for this bill.
 */
export const canUserPrintBill = async (userId: string, permissions: string[], billId: string) => {
    if (permissions.includes('print_bill') || permissions.includes('bulk_print') || permissions.includes('manage_users')) {
        return { allowed: true, requestId: null as string | null };
    }

    const result = await pool.query(
        `SELECT id FROM privileged_action_requests
         WHERE bill_id = $1 AND requested_by = $2 AND action_type = 'PRINT_BILL' AND status = 'APPROVED'
         ORDER BY reviewed_at DESC NULLS LAST
         LIMIT 1`,
        [billId, userId]
    );

    if (result.rows.length > 0) {
        return { allowed: true, requestId: result.rows[0].id as string };
    }

    return { allowed: false, requestId: null };
};

export const markPrintRequestCompleted = async (requestId: string) => {
    await pool.query(
        `UPDATE privileged_action_requests SET status = 'COMPLETED', updated_at = NOW()
         WHERE id = $1 AND status = 'APPROVED'`,
        [requestId]
    );
};

export default {
    createPrivilegedActionRequest,
    listPrivilegedActionRequests,
    approvePrivilegedActionRequest,
    rejectPrivilegedActionRequest,
    canUserPrintBill,
    markPrintRequestCompleted,
};
