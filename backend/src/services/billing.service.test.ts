/**
 * Smoke tests for billing money path (mocked pg).
 */
jest.mock('../config/database', () => {
    const query = jest.fn();
    const connect = jest.fn();
    return {
        __esModule: true,
        default: { query, connect },
        query,
        connect,
    };
});

import pool from '../config/database';
import { calculatePropertyBill, generateBill, recordPayment } from './billing.service';

describe('billing.service smoke', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('calculatePropertyBill uses legacy rate and excludes rolled arrears', async () => {
        (pool.query as jest.Mock)
            .mockResolvedValueOnce({
                rows: [
                    {
                        id: 'prop-1',
                        property_size: 100,
                        base_rate: 2,
                        classification_name: 'Residential',
                        property_rate_zone_id: null,
                    },
                ],
            })
            .mockResolvedValueOnce({ rows: [] }) // no active fee schedule
            .mockResolvedValueOnce({
                rows: [{ total_arrears: '50', prior_bill_ids: ['bill-old'] }],
            });

        const calc = await calculatePropertyBill('prop-1', 2026);
        expect(calc.current_rate).toBe(200);
        expect(calc.arrears).toBe(50);
        expect(calc.total_amount).toBe(250);
        expect(calc.prior_bill_ids).toContain('bill-old');
    });

    it('generateBill inserts bill and rolls prior bills', async () => {
        (pool.query as jest.Mock)
            // calculatePropertyBill
            .mockResolvedValueOnce({
                rows: [
                    {
                        id: 'prop-1',
                        property_size: 50,
                        base_rate: 1,
                        classification_name: 'Residential',
                        property_rate_zone_id: null,
                    },
                ],
            })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({
                rows: [{ total_arrears: '10', prior_bill_ids: ['11111111-1111-1111-1111-111111111111'] }],
            })
            // existing bill check
            .mockResolvedValueOnce({ rows: [] })
            // auto number
            .mockResolvedValueOnce({ rows: [{ bill_number: 'GN-BILL-2026-000001' }] })
            // insert
            .mockResolvedValueOnce({
                rows: [
                    {
                        id: '22222222-2222-2222-2222-222222222222',
                        bill_number: 'GN-BILL-2026-000001',
                        total_amount: 60,
                    },
                ],
            })
            // roll prior
            .mockResolvedValueOnce({ rows: [] });

        const bill = await generateBill(
            'PROPERTY_RATE',
            'prop-1',
            '33333333-3333-3333-3333-333333333333',
            2026
        );
        expect(bill.bill_number).toBe('GN-BILL-2026-000001');
        expect((pool.query as jest.Mock).mock.calls.some((c) => String(c[0]).includes('rolled_into_bill_id'))).toBe(
            true
        );
    });

    it('recordPayment updates bill status transactionally', async () => {
        const client = {
            query: jest
                .fn()
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({
                    rows: [
                        {
                            id: 'bill-1',
                            amount_paid: 0,
                            total_amount: 100,
                            payment_status: 'UNPAID',
                        },
                    ],
                })
                .mockResolvedValueOnce({ rows: [{ receipt_number: 'GN-RCT-2026-000001' }] })
                .mockResolvedValueOnce({
                    rows: [{ id: 'pay-1', receipt_number: 'GN-RCT-2026-000001', amount: 100 }],
                })
                .mockResolvedValueOnce({}) // update bill
                .mockResolvedValueOnce({}), // COMMIT
            release: jest.fn(),
        };
        (pool.connect as jest.Mock).mockResolvedValue(client);

        const payment = await recordPayment(
            'bill-1',
            'cust-1',
            100,
            'CASH',
            'GCR-001',
            undefined,
            'user-1'
        );
        expect(payment.receipt_number).toBe('GN-RCT-2026-000001');
        expect(client.query).toHaveBeenCalledWith('BEGIN');
        expect(client.query).toHaveBeenCalledWith('COMMIT');
        const insertCall = client.query.mock.calls.find(
            (c: any[]) => typeof c[0] === 'string' && c[0].includes('INSERT INTO payments')
        );
        expect(insertCall).toBeTruthy();
        expect(insertCall[1]).toContain('user-1');
        expect(insertCall[1]).toContain('GCR-001');
    });
});

describe('pdf.service smoke', () => {
    it('module exports generateBillPDF', async () => {
        jest.resetModules();
        jest.doMock('../config/database', () => ({
            __esModule: true,
            default: { query: jest.fn() },
        }));
        const pdf = await import('./pdf.service');
        expect(typeof pdf.generateBillPDF).toBe('function');
    });
});
