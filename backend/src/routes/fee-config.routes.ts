import { Router, Response } from 'express';
import Joi from 'joi';
import multer from 'multer';
import { authenticateToken, authorize, AuthRequest } from '../middlewares/auth.middleware';
import {
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
} from '../services/fee-config.service';
import {
    createAmountChangeRequest,
    splitMoneyFields,
    ZONE_MONEY,
    FEE_ITEM_MONEY,
} from '../services/amount-change.service';
import { getAuditContext } from '../services/audit.service';
import pool from '../config/database';

const router = Router();

// File upload config (memory storage for Excel parsing)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.mimetype === 'application/vnd.ms-excel' ||
            file.originalname.endsWith('.xlsx') ||
            file.originalname.endsWith('.xls')) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
        }
    },
});

// Apply authentication to all routes
router.use(authenticateToken);

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const feeScheduleSchema = Joi.object({
    year: Joi.number().integer().min(2000).max(2100).required(),
    name: Joi.string().max(200).required(),
    effective_date: Joi.date().iso().required(),
    notes: Joi.string().allow('', null).optional(),
});

const feeScheduleUpdateSchema = Joi.object({
    name: Joi.string().max(200).optional(),
    effective_date: Joi.date().iso().optional(),
    notes: Joi.string().allow('', null).optional(),
});

const propertyRateZoneSchema = Joi.object({
    zone_name: Joi.string().max(100).required(),
    zone_type: Joi.string().valid('RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'MIXED_USE').required(),
    zone_class: Joi.number().integer().min(1).max(10).optional(),
    rate_impost_min: Joi.number().positive().required(),
    rate_impost_max: Joi.number().positive().allow(null).optional(),
    minimum_rate_min: Joi.number().positive().required(),
    minimum_rate_max: Joi.number().positive().allow(null).optional(),
    affected_areas: Joi.string().allow('', null).optional(),
    sort_order: Joi.number().integer().optional(),
});

const businessFeeItemSchema = Joi.object({
    main_item_number: Joi.number().integer().min(1).required(),
    sub_item_code: Joi.string().max(20).allow('', null).optional(),
    description: Joi.string().max(500).required(),
    parent_id: Joi.number().integer().allow(null).optional(),
    frequency: Joi.string().max(50).allow('', null).optional(),
    cat_a_fee: Joi.number().min(0).allow(null).optional(),
    cat_b_fee: Joi.number().min(0).allow(null).optional(),
    cat_c_fee: Joi.number().min(0).allow(null).optional(),
    cat_d_fee: Joi.number().min(0).allow(null).optional(),
    cat_e_fee: Joi.number().min(0).allow(null).optional(),
    cat_f_fee: Joi.number().min(0).allow(null).optional(),
    is_group_header: Joi.boolean().optional(),
    sort_order: Joi.number().integer().optional(),
});

// =====================================================
// FEE SCHEDULES
// =====================================================

/**
 * GET /api/fee-config/schedules
 */
router.get('/schedules', async (req: AuthRequest, res: Response) => {
    try {
        const perms = req.user?.permissions || [];
        const can =
            perms.includes('configure_rates') ||
            perms.includes('generate_bill') ||
            perms.includes('manage_users');
        if (!can) {
            return res.status(403).json({ success: false, error: 'Permission denied' });
        }
        const year = req.query.year ? parseInt(req.query.year as string) : undefined;
        const schedules = await getFeeSchedules(year);
        res.json({ success: true, data: schedules });
    } catch (error: any) {
        console.error('Error fetching fee schedules:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch fee schedules' });
    }
});

/**
 * GET /api/fee-config/schedules/:id
 */
router.get('/schedules/:id', async (req: AuthRequest, res: Response) => {
    try {
        const perms = req.user?.permissions || [];
        const can =
            perms.includes('configure_rates') ||
            perms.includes('generate_bill') ||
            perms.includes('manage_users');
        if (!can) {
            return res.status(403).json({ success: false, error: 'Permission denied' });
        }
        const schedule = await getFeeScheduleById(parseInt(req.params.id));
        if (!schedule) {
            return res.status(404).json({ success: false, error: 'Fee schedule not found' });
        }
        res.json({ success: true, data: schedule });
    } catch (error: any) {
        console.error('Error fetching fee schedule:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch fee schedule' });
    }
});

/**
 * POST /api/fee-config/schedules
 */
router.post('/schedules', authorize(['configure_rates']), async (req: AuthRequest, res: Response) => {
    try {
        const { error, value } = feeScheduleSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, error: error.details[0].message });
        }

        const schedule = await createFeeSchedule({
            ...value,
            created_by: req.user?.id,
        });
        res.status(201).json({ success: true, data: schedule, message: 'Fee schedule created successfully' });
    } catch (error: any) {
        console.error('Error creating fee schedule:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to create fee schedule' });
    }
});

/**
 * PUT /api/fee-config/schedules/:id
 */
router.put('/schedules/:id', authorize(['configure_rates']), async (req: AuthRequest, res: Response) => {
    try {
        const { error, value } = feeScheduleUpdateSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, error: error.details[0].message });
        }

        const schedule = await updateFeeSchedule(parseInt(req.params.id), value);
        res.json({ success: true, data: schedule, message: 'Fee schedule updated successfully' });
    } catch (error: any) {
        console.error('Error updating fee schedule:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to update fee schedule' });
    }
});

/**
 * PUT /api/fee-config/schedules/:id/activate
 */
router.put('/schedules/:id/activate', authorize(['configure_rates']), async (req: AuthRequest, res: Response) => {
    try {
        const schedule = await activateFeeSchedule(parseInt(req.params.id));
        res.json({ success: true, data: schedule, message: 'Fee schedule activated successfully' });
    } catch (error: any) {
        console.error('Error activating fee schedule:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to activate fee schedule' });
    }
});

// =====================================================
// PROPERTY RATE ZONES
// =====================================================

/**
 * GET /api/fee-config/schedules/:id/property-zones
 */
router.get('/schedules/:id/property-zones', async (req: AuthRequest, res: Response) => {
    try {
        const zones = await getPropertyRateZones(parseInt(req.params.id));
        res.json({ success: true, data: zones });
    } catch (error: any) {
        console.error('Error fetching property rate zones:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch property rate zones' });
    }
});

/**
 * POST /api/fee-config/schedules/:id/property-zones
 */
router.post('/schedules/:id/property-zones', authorize(['configure_rates']), async (req: AuthRequest, res: Response) => {
    try {
        const { error, value } = propertyRateZoneSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, error: error.details[0].message });
        }

        const zone = await createPropertyRateZone(parseInt(req.params.id), value);
        res.status(201).json({ success: true, data: zone, message: 'Property rate zone created successfully' });
    } catch (error: any) {
        console.error('Error creating property rate zone:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to create property rate zone' });
    }
});

/**
 * PUT /api/fee-config/property-zones/:zoneId
 * Money fields go to pending approval; metadata applies immediately.
 */
router.put('/property-zones/:zoneId', authorize(['configure_rates']), async (req: AuthRequest, res: Response) => {
    try {
        const { error, value } = propertyRateZoneSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, error: error.details[0].message });
        }

        const { money, metadata } = splitMoneyFields(value, ZONE_MONEY);
        let pendingRequest = null;

        if (Object.keys(metadata).length > 0) {
            await updatePropertyRateZone(parseInt(req.params.zoneId), metadata);
        }

        if (Object.keys(money).length > 0) {
            try {
                pendingRequest = await createAmountChangeRequest({
                    entityType: 'PROPERTY_RATE_ZONE',
                    entityId: String(req.params.zoneId),
                    proposedValues: money,
                    reason: req.body.reason || 'Fee zone rate update',
                    requestedBy: req.user!.id,
                    auditCtx: getAuditContext(req),
                });
            } catch (e: any) {
                if (!String(e.message || '').includes('No money field changes')) throw e;
            }
        }

        const zoneResult = await pool.query('SELECT * FROM property_rate_zones WHERE id = $1', [req.params.zoneId]);

        res.json({
            success: true,
            data: zoneResult.rows[0],
            pending_request: pendingRequest,
            message: pendingRequest
                ? 'Metadata saved. Money field changes submitted for Super Admin approval.'
                : 'Property rate zone updated successfully',
        });
    } catch (error: any) {
        console.error('Error updating property rate zone:', error);
        res.status(400).json({ success: false, error: error.message || 'Failed to update property rate zone' });
    }
});

/**
 * DELETE /api/fee-config/property-zones/:zoneId
 */
router.delete('/property-zones/:zoneId', authorize(['configure_rates']), async (req: AuthRequest, res: Response) => {
    try {
        await deletePropertyRateZone(parseInt(req.params.zoneId));
        res.json({ success: true, message: 'Property rate zone deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting property rate zone:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to delete property rate zone' });
    }
});

// =====================================================
// BUSINESS FEE ITEMS
// =====================================================

/**
 * GET /api/fee-config/schedules/:id/business-items
 */
router.get('/schedules/:id/business-items', async (req: AuthRequest, res: Response) => {
    try {
        const items = await getBusinessFeeItems(parseInt(req.params.id));
        res.json({ success: true, data: items });
    } catch (error: any) {
        console.error('Error fetching business fee items:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch business fee items' });
    }
});

/**
 * POST /api/fee-config/schedules/:id/business-items
 */
router.post('/schedules/:id/business-items', authorize(['configure_rates']), async (req: AuthRequest, res: Response) => {
    try {
        const { error, value } = businessFeeItemSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, error: error.details[0].message });
        }

        const item = await createBusinessFeeItem(parseInt(req.params.id), value);
        res.status(201).json({ success: true, data: item, message: 'Business fee item created successfully' });
    } catch (error: any) {
        console.error('Error creating business fee item:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to create business fee item' });
    }
});

/**
 * PUT /api/fee-config/business-items/:itemId
 * Money fields (cat fees) go to pending approval; metadata applies immediately.
 */
router.put('/business-items/:itemId', authorize(['configure_rates']), async (req: AuthRequest, res: Response) => {
    try {
        const { error, value } = businessFeeItemSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, error: error.details[0].message });
        }

        const { money, metadata } = splitMoneyFields(value, FEE_ITEM_MONEY);
        let pendingRequest = null;

        if (Object.keys(metadata).length > 0) {
            await updateBusinessFeeItem(parseInt(req.params.itemId), metadata);
        }

        if (Object.keys(money).length > 0) {
            try {
                pendingRequest = await createAmountChangeRequest({
                    entityType: 'BUSINESS_FEE_ITEM',
                    entityId: String(req.params.itemId),
                    proposedValues: money,
                    reason: req.body.reason || 'Business fee item rate update',
                    requestedBy: req.user!.id,
                    auditCtx: getAuditContext(req),
                });
            } catch (e: any) {
                if (!String(e.message || '').includes('No money field changes')) throw e;
            }
        }

        const itemResult = await pool.query('SELECT * FROM business_fee_items WHERE id = $1', [req.params.itemId]);

        res.json({
            success: true,
            data: itemResult.rows[0],
            pending_request: pendingRequest,
            message: pendingRequest
                ? 'Metadata saved. Fee amount changes submitted for Super Admin approval.'
                : 'Business fee item updated successfully',
        });
    } catch (error: any) {
        console.error('Error updating business fee item:', error);
        res.status(400).json({ success: false, error: error.message || 'Failed to update business fee item' });
    }
});

/**
 * DELETE /api/fee-config/business-items/:itemId
 */
router.delete('/business-items/:itemId', authorize(['configure_rates']), async (req: AuthRequest, res: Response) => {
    try {
        await deleteBusinessFeeItem(parseInt(req.params.itemId));
        res.json({ success: true, message: 'Business fee item deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting business fee item:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to delete business fee item' });
    }
});

// =====================================================
// EXCEL IMPORT
// =====================================================

/**
 * POST /api/fee-config/schedules/:id/import/preview
 * Parse uploaded Excel file and return preview without saving
 */
router.post('/schedules/:id/import/preview', authorize(['configure_rates']), upload.single('file'), async (req: AuthRequest, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const parsedData = parseExcelFeeSchedule(req.file.buffer);

        res.json({
            success: true,
            data: {
                propertyZones: parsedData.propertyZones,
                businessItems: parsedData.businessItems,
                summary: {
                    propertyZonesCount: parsedData.propertyZones.length,
                    businessItemsCount: parsedData.businessItems.length,
                },
            },
            message: 'File parsed successfully. Review the data and confirm to import.',
        });
    } catch (error: any) {
        console.error('Error parsing Excel file:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to parse Excel file' });
    }
});

/**
 * POST /api/fee-config/schedules/:id/import/commit
 * Save previously parsed data to the database
 */
router.post('/schedules/:id/import/commit', authorize(['configure_rates']), async (req: AuthRequest, res: Response) => {
    try {
        const { propertyZones, businessItems } = req.body;

        if (!propertyZones && !businessItems) {
            return res.status(400).json({ success: false, error: 'No data to import' });
        }

        const result = await importFeeScheduleFromExcel(parseInt(req.params.id), {
            propertyZones: propertyZones || [],
            businessItems: businessItems || [],
        });

        res.json({
            success: true,
            data: result,
            message: `Import completed: ${result.propertyZonesCreated} property zones, ${result.businessItemsCreated} business items created`,
        });
    } catch (error: any) {
        console.error('Error importing fee schedule:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to import fee schedule data' });
    }
});

// =====================================================
// ACTIVE SCHEDULE LOOKUPS (for forms/billing)
// =====================================================

/**
 * GET /api/fee-config/active/property-zones
 */
router.get('/active/property-zones', async (req: AuthRequest, res: Response) => {
    try {
        const year = parseInt(req.query.year as string) || new Date().getFullYear();
        const zones = await getActivePropertyRateZones(year);
        res.json({ success: true, data: zones });
    } catch (error: any) {
        console.error('Error fetching active property rate zones:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch active property rate zones' });
    }
});

/**
 * GET /api/fee-config/active/business-items
 */
router.get('/active/business-items', async (req: AuthRequest, res: Response) => {
    try {
        const year = parseInt(req.query.year as string) || new Date().getFullYear();
        const items = await getActiveBusinessFeeItems(year);
        res.json({ success: true, data: items });
    } catch (error: any) {
        console.error('Error fetching active business fee items:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch active business fee items' });
    }
});

export default router;
