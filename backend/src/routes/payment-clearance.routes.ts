import { Router, Response } from 'express';
import Joi from 'joi';
import { authenticateToken, authorize, AuthRequest } from '../middlewares/auth.middleware';
import {
    approveChequePayment,
    rejectChequePayment,
    listChequePayments,
} from '../services/billing.service';
import { getAuditContext, logAction } from '../services/audit.service';

const router = Router();

router.use(authenticateToken);

/**
 * GET /api/payments/cheques?status=PENDING
 * List cheque payments by clearance status
 */
router.get('/cheques', authorize(['approve_cheque_payments']), async (req: AuthRequest, res: Response) => {
    try {
        const status = String(req.query.status || 'PENDING').toUpperCase();
        if (!['PENDING', 'CLEARED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid clearance status' });
        }
        const limit = Math.min(Number(req.query.limit) || 100, 200);
        const rows = await listChequePayments(status, limit);
        res.json({ success: true, data: rows });
    } catch (error: any) {
        console.error('Error listing cheque payments:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to list cheque payments' });
    }
});

/**
 * POST /api/payments/:id/approve-cheque
 * Confirm cheque cleared — amount hits the bill
 */
router.post(
    '/:id/approve-cheque',
    authorize(['approve_cheque_payments']),
    async (req: AuthRequest, res: Response) => {
        try {
            const schema = Joi.object({
                clearance_note: Joi.string().allow('', null).optional(),
            });
            const { error, value } = schema.validate(req.body || {});
            if (error) {
                return res.status(400).json({ success: false, error: error.details[0].message });
            }

            const payment = await approveChequePayment(
                req.params.id,
                req.user!.id,
                value.clearance_note
            );

            await logAction(
                req.user!.id,
                'CHEQUE_PAYMENT_CLEARED',
                'payments',
                payment.id,
                null,
                {
                    bill_id: payment.bill_id,
                    amount: payment.amount,
                    receipt_number: payment.receipt_number,
                    note: value.clearance_note || null,
                },
                getAuditContext(req)
            );

            res.json({
                success: true,
                data: payment,
                message: `Cheque cleared. GHS ${parseFloat(payment.amount).toFixed(2)} applied to the bill.`,
            });
        } catch (error: any) {
            console.error('Error approving cheque:', error);
            res.status(400).json({ success: false, error: error.message || 'Failed to approve cheque' });
        }
    }
);

/**
 * POST /api/payments/:id/reject-cheque
 * Decline bounced cheque — bill unchanged
 */
router.post(
    '/:id/reject-cheque',
    authorize(['approve_cheque_payments']),
    async (req: AuthRequest, res: Response) => {
        try {
            const schema = Joi.object({
                clearance_note: Joi.string().allow('', null).optional(),
            });
            const { error, value } = schema.validate(req.body || {});
            if (error) {
                return res.status(400).json({ success: false, error: error.details[0].message });
            }

            const payment = await rejectChequePayment(
                req.params.id,
                req.user!.id,
                value.clearance_note || 'Cheque bounced'
            );

            await logAction(
                req.user!.id,
                'CHEQUE_PAYMENT_REJECTED',
                'payments',
                payment.id,
                null,
                {
                    bill_id: payment.bill_id,
                    amount: payment.amount,
                    receipt_number: payment.receipt_number,
                    note: value.clearance_note || 'Cheque bounced',
                },
                getAuditContext(req)
            );

            res.json({
                success: true,
                data: payment,
                message: 'Cheque declined as bounced. Bill balance was not changed.',
            });
        } catch (error: any) {
            console.error('Error rejecting cheque:', error);
            res.status(400).json({ success: false, error: error.message || 'Failed to reject cheque' });
        }
    }
);

export default router;
