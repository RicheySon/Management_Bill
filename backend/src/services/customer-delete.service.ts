import { PoolClient } from 'pg';
import pool from '../config/database';
import { logAction, AuditContext } from './audit.service';

export type CascadeDeleteSummary = {
    customers: number;
    bills: number;
    payments: number;
    properties: number;
    businesses: number;
    amount_change_requests: number;
};

const emptySummary = (): CascadeDeleteSummary => ({
    customers: 0,
    bills: 0,
    payments: 0,
    properties: 0,
    businesses: 0,
    amount_change_requests: 0,
});

/**
 * Wipe one customer and all related operational records:
 * payments, amount-change requests on their bills, bills,
 * then the customer (CASCADE removes properties + businesses).
 */
export const cascadeDeleteCustomer = async (
    customerId: string,
    deletedBy: string,
    auditCtx?: AuditContext
): Promise<CascadeDeleteSummary> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const summary = await cascadeDeleteCustomersInTx(client, [customerId]);
        if (summary.customers === 0) {
            await client.query('ROLLBACK');
            const err: any = new Error('Customer not found');
            err.statusCode = 404;
            throw err;
        }
        await client.query('COMMIT');

        await logAction(
            deletedBy,
            'CUSTOMER_CASCADE_DELETED',
            'customers',
            customerId,
            summary,
            null,
            auditCtx
        );

        return summary;
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch {
            /* ignore */
        }
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Wipe every customer and all bills / payments / properties / businesses.
 */
export const cascadeDeleteAllCustomers = async (
    deletedBy: string,
    auditCtx?: AuditContext
): Promise<CascadeDeleteSummary> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const idsResult = await client.query<{ id: string }>('SELECT id FROM customers');
        const ids = idsResult.rows.map((r) => r.id);
        const summary =
            ids.length === 0
                ? emptySummary()
                : await cascadeDeleteCustomersInTx(client, ids);

        await client.query('COMMIT');

        await logAction(
            deletedBy,
            'CUSTOMERS_PURGED_ALL',
            'customers',
            'ALL',
            summary,
            null,
            auditCtx
        );

        return summary;
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch {
            /* ignore */
        }
        throw error;
    } finally {
        client.release();
    }
};

async function cascadeDeleteCustomersInTx(
    client: PoolClient,
    customerIds: string[]
): Promise<CascadeDeleteSummary> {
    const summary = emptySummary();
    if (customerIds.length === 0) return summary;

    const billsResult = await client.query<{ id: string }>(
        `SELECT id FROM bills WHERE customer_id = ANY($1::uuid[])`,
        [customerIds]
    );
    const billIds = billsResult.rows.map((r) => r.id);

    const propsResult = await client.query(
        `SELECT COUNT(*)::int AS c FROM properties WHERE customer_id = ANY($1::uuid[])`,
        [customerIds]
    );
    const bizResult = await client.query(
        `SELECT COUNT(*)::int AS c FROM businesses WHERE customer_id = ANY($1::uuid[])`,
        [customerIds]
    );
    summary.properties = propsResult.rows[0]?.c || 0;
    summary.businesses = bizResult.rows[0]?.c || 0;
    summary.bills = billIds.length;

    if (billIds.length > 0) {
        const acr = await client.query(
            `DELETE FROM amount_change_requests
             WHERE entity_type = 'BILL' AND entity_id = ANY($1::text[])`,
            [billIds]
        );
        summary.amount_change_requests = acr.rowCount || 0;

        // Payments linked by bill or by customer
        const pay = await client.query(
            `DELETE FROM payments
             WHERE bill_id = ANY($1::uuid[])
                OR customer_id = ANY($2::uuid[])`,
            [billIds, customerIds]
        );
        summary.payments = pay.rowCount || 0;

        await client.query(
            `UPDATE bills SET rolled_into_bill_id = NULL
             WHERE rolled_into_bill_id = ANY($1::uuid[])`,
            [billIds]
        );

        // privileged_action_requests CASCADE on bill delete, but clear explicitly first
        await client.query(
            `DELETE FROM privileged_action_requests WHERE bill_id = ANY($1::uuid[])`,
            [billIds]
        );

        await client.query(`DELETE FROM bills WHERE id = ANY($1::uuid[])`, [billIds]);
    } else {
        const pay = await client.query(
            `DELETE FROM payments WHERE customer_id = ANY($1::uuid[])`,
            [customerIds]
        );
        summary.payments = pay.rowCount || 0;
    }

    const cust = await client.query(
        `DELETE FROM customers WHERE id = ANY($1::uuid[]) RETURNING id`,
        [customerIds]
    );
    summary.customers = cust.rowCount || 0;

    return summary;
}
