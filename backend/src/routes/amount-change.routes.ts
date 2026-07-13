import { Router, Response } from 'express';
import { authenticateToken, authorize, AuthRequest } from '../middlewares/auth.middleware';
import { getAuditContext } from '../services/audit.service';
import {
    createAmountChangeRequest,
    listAmountChangeRequests,
    approveAmountChange,
    rejectAmountChange,
} from '../services/amount-change.service';

const router = Router();

router.use(authenticateToken);

/**
 * POST /api/amount-changes
 * Create a pending amount change (never applies directly).
 */
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const { entity_type, entity_id, proposed_values, reason } = req.body;

        if (!entity_type || !entity_id || !proposed_values) {
            return res.status(400).json({
                success: false,
                error: 'entity_type, entity_id, and proposed_values are required',
            });
        }

        if (!['BILL', 'PROPERTY_RATE_ZONE', 'BUSINESS_FEE_ITEM'].includes(entity_type)) {
            return res.status(400).json({ success: false, error: 'Invalid entity_type' });
        }

        // Permission gate by entity
        const perms = req.user?.permissions || [];
        if (entity_type === 'BILL') {
            const can =
                perms.includes('generate_bill') ||
                perms.includes('delete_bill') ||
                perms.includes('configure_rates') ||
                perms.includes('approve_amount_changes');
            if (!can) {
                return res.status(403).json({ success: false, error: 'Permission denied' });
            }
        } else {
            if (!perms.includes('configure_rates') && !perms.includes('approve_amount_changes')) {
                return res.status(403).json({ success: false, error: 'Permission denied' });
            }
        }

        // Super Admin also must go through pending — never apply directly
        const request = await createAmountChangeRequest({
            entityType: entity_type,
            entityId: String(entity_id),
            proposedValues: proposed_values,
            reason,
            requestedBy: req.user!.id,
            auditCtx: getAuditContext(req),
        });

        res.status(201).json({
            success: true,
            message: 'Amount change submitted for Super Admin approval',
            data: request,
        });
    } catch (error: any) {
        console.error('Create amount change error:', error);
        res.status(400).json({ success: false, error: error.message || 'Failed to create request' });
    }
});

/**
 * GET /api/amount-changes
 */
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const perms = req.user?.permissions || [];
        const canView =
            perms.includes('approve_amount_changes') ||
            perms.includes('view_logs') ||
            perms.includes('configure_rates') ||
            perms.includes('generate_bill');

        if (!canView) {
            return res.status(403).json({ success: false, error: 'Permission denied' });
        }

        const rows = await listAmountChangeRequests({
            status: req.query.status as string | undefined,
            entityType: req.query.entity_type as string | undefined,
            limit: req.query.limit ? Number(req.query.limit) : 100,
        });

        res.json({ success: true, data: rows });
    } catch (error: any) {
        console.error('List amount changes error:', error);
        res.status(500).json({ success: false, error: 'Failed to list amount changes' });
    }
});

/**
 * POST /api/amount-changes/:id/approve
 */
router.post(
    '/:id/approve',
    authorize(['approve_amount_changes']),
    async (req: AuthRequest, res: Response) => {
        try {
            const updated = await approveAmountChange(
                req.params.id,
                req.user!.id,
                req.body.review_note,
                getAuditContext(req)
            );
            res.json({ success: true, message: 'Amount change approved and applied', data: updated });
        } catch (error: any) {
            console.error('Approve amount change error:', error);
            res.status(400).json({ success: false, error: error.message || 'Failed to approve' });
        }
    }
);

/**
 * POST /api/amount-changes/:id/reject
 */
router.post(
    '/:id/reject',
    authorize(['approve_amount_changes']),
    async (req: AuthRequest, res: Response) => {
        try {
            const updated = await rejectAmountChange(
                req.params.id,
                req.user!.id,
                req.body.review_note,
                getAuditContext(req)
            );
            res.json({ success: true, message: 'Amount change rejected', data: updated });
        } catch (error: any) {
            console.error('Reject amount change error:', error);
            res.status(400).json({ success: false, error: error.message || 'Failed to reject' });
        }
    }
);

export default router;
