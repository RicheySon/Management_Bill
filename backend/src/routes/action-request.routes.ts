import { Router, Response } from 'express';
import Joi from 'joi';
import { authenticateToken, authorize, AuthRequest } from '../middlewares/auth.middleware';
import { getAuditContext } from '../services/audit.service';
import {
    approvePrivilegedActionRequest,
    createPrivilegedActionRequest,
    listPrivilegedActionRequests,
    rejectPrivilegedActionRequest,
} from '../services/action-request.service';

const router = Router();

router.use(authenticateToken);

/**
 * POST /api/action-requests
 * Revenue Officer / Collector request print or delete approval
 */
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const perms = req.user?.permissions || [];
        const schema = Joi.object({
            action_type: Joi.string().valid('PRINT_BILL', 'DELETE_BILL').required(),
            bill_id: Joi.string().uuid().required(),
            reason: Joi.string().allow('', null).optional(),
        });
        const { error, value } = schema.validate(req.body);
        if (error) return res.status(400).json({ success: false, error: error.details[0].message });

        if (value.action_type === 'PRINT_BILL' && !perms.includes('request_print') && !perms.includes('print_bill')) {
            return res.status(403).json({ success: false, error: 'Permission denied to request print' });
        }
        if (value.action_type === 'DELETE_BILL' && !perms.includes('request_delete') && !perms.includes('delete_bill')) {
            return res.status(403).json({ success: false, error: 'Permission denied to request delete' });
        }

        // Users with direct permission don't need to request
        if (value.action_type === 'PRINT_BILL' && perms.includes('print_bill')) {
            return res.status(400).json({
                success: false,
                error: 'You already have direct print permission — use Print instead of requesting approval',
            });
        }
        if (value.action_type === 'DELETE_BILL' && perms.includes('delete_bill') && !perms.includes('request_delete')) {
            return res.status(400).json({
                success: false,
                error: 'You already have direct delete permission — use Delete instead of requesting approval',
            });
        }

        const request = await createPrivilegedActionRequest({
            actionType: value.action_type,
            billId: value.bill_id,
            reason: value.reason,
            requestedBy: req.user!.id,
            auditCtx: getAuditContext(req),
        });

        res.status(201).json({
            success: true,
            message: `${value.action_type === 'PRINT_BILL' ? 'Print' : 'Delete'} request submitted for admin approval`,
            data: request,
        });
    } catch (error: any) {
        console.error('Error creating action request:', error);
        res.status(400).json({ success: false, error: error.message || 'Failed to create request' });
    }
});

/**
 * GET /api/action-requests
 */
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const perms = req.user?.permissions || [];
        const canApprove = perms.includes('approve_privileged_actions') || perms.includes('manage_users');
        const status = typeof req.query.status === 'string' ? req.query.status : undefined;
        const limit = req.query.limit ? Number(req.query.limit) : 100;

        let rows = await listPrivilegedActionRequests({ status, limit: canApprove ? limit : 100 });

        // Non-approvers only see their own requests
        if (!canApprove) {
            rows = rows.filter((r) => r.requested_by === req.user!.id);
        }

        res.json({ success: true, data: rows });
    } catch (error: any) {
        console.error('Error listing action requests:', error);
        res.status(500).json({ success: false, error: 'Failed to list action requests' });
    }
});

router.post(
    '/:id/approve',
    authorize(['approve_privileged_actions']),
    async (req: AuthRequest, res: Response) => {
        try {
            const updated = await approvePrivilegedActionRequest({
                requestId: req.params.id,
                reviewedBy: req.user!.id,
                reviewNote: req.body?.review_note,
                auditCtx: getAuditContext(req),
            });
            res.json({
                success: true,
                message:
                    updated.action_type === 'DELETE_BILL'
                        ? 'Delete approved and bill removed'
                        : 'Print approved — requester may now print the bill',
                data: updated,
            });
        } catch (error: any) {
            res.status(400).json({ success: false, error: error.message || 'Approve failed' });
        }
    }
);

router.post(
    '/:id/reject',
    authorize(['approve_privileged_actions']),
    async (req: AuthRequest, res: Response) => {
        try {
            const updated = await rejectPrivilegedActionRequest({
                requestId: req.params.id,
                reviewedBy: req.user!.id,
                reviewNote: req.body?.review_note,
                auditCtx: getAuditContext(req),
            });
            res.json({ success: true, message: 'Request rejected', data: updated });
        } catch (error: any) {
            res.status(400).json({ success: false, error: error.message || 'Reject failed' });
        }
    }
);

export default router;
