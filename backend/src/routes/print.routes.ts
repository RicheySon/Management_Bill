import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { authenticateToken, authorize } from '../middlewares/auth.middleware';
import { generateBillPDF, generateBulkBillsPDF } from '../services/pdf.service';
import pool from '../config/database';

const router = Router();

// Apply authentication to all print routes
router.use(authenticateToken);

/**
 * GET /api/print/bill/:id
 * Generate and download a single bill PDF
 */
router.get('/bill/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const doc = await generateBillPDF(id);

        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=bill-${id}.pdf`);

        // Pipe the PDF to response
        doc.pipe(res);
        doc.end();
    } catch (error: any) {
        console.error('Error generating bill PDF:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate PDF',
        });
    }
});

/**
 * POST /api/print/bills/bulk
 * Generate a single PDF with multiple bills based on filters
 */
router.post('/bills/bulk', authorize(['bulk_print']), async (req: Request, res: Response) => {
    try {
        const schema = Joi.object({
            filters: Joi.object({
                electoral_area_id: Joi.number().integer().optional(),
                bill_type: Joi.string().valid('PROPERTY_RATE', 'BOP').optional(),
                payment_status: Joi.string().valid('UNPAID', 'PARTIAL', 'PAID', 'OVERDUE').optional(),
                classification_id: Joi.number().integer().optional(),
                category_id: Joi.number().integer().optional(),
                year: Joi.number().integer().optional(),
            }),
            bill_ids: Joi.array().items(Joi.string().uuid()).optional(),
        });

        const { error, value } = schema.validate(req.body);

        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message,
            });
        }

        const { filters, bill_ids } = value;

        let billIdsToGenerate: string[] = [];

        // If specific bill IDs provided, use those
        if (bill_ids && bill_ids.length > 0) {
            billIdsToGenerate = bill_ids;
        } else {
            // Otherwise, fetch based on filters
            let query = `
                SELECT b.id
                FROM bills b
                LEFT JOIN properties p ON b.property_id = p.id
                LEFT JOIN businesses bus ON b.business_id = bus.id
                WHERE 1 = 1
            `;

            const queryParams: any[] = [];
            let paramIndex = 1;

            if (filters?.electoral_area_id) {
                query += ` AND (p.electoral_area_id = $${paramIndex} OR bus.electoral_area_id = $${paramIndex})`;
                queryParams.push(filters.electoral_area_id);
                paramIndex++;
            }

            if (filters?.bill_type) {
                query += ` AND b.bill_type = $${paramIndex}`;
                queryParams.push(filters.bill_type);
                paramIndex++;
            }

            if (filters?.payment_status) {
                query += ` AND b.payment_status = $${paramIndex}`;
                queryParams.push(filters.payment_status);
                paramIndex++;
            }

            if (filters?.classification_id) {
                query += ` AND p.classification_id = $${paramIndex}`;
                queryParams.push(filters.classification_id);
                paramIndex++;
            }

            if (filters?.category_id) {
                query += ` AND bus.category_id = $${paramIndex}`;
                queryParams.push(filters.category_id);
                paramIndex++;
            }

            if (filters?.year) {
                query += ` AND b.bill_period_year = $${paramIndex}`;
                queryParams.push(filters.year);
                paramIndex++;
            }

            query += ` ORDER BY b.issue_date DESC LIMIT 100`;

            const result = await pool.query(query, queryParams);
            billIdsToGenerate = result.rows.map(row => row.id);
        }

        if (billIdsToGenerate.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No bills found matching the criteria',
            });
        }

        // Generate bulk PDF using the service
        const doc = await generateBulkBillsPDF(billIdsToGenerate);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=bulk-bills-${Date.now()}.pdf`);

        doc.pipe(res);
        doc.end();
    } catch (error: any) {
        console.error('Error generating bulk PDFs:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate bulk PDFs',
        });
    }
});

/**
 * GET /api/print/receipt/:paymentId
 * Generate payment receipt PDF
 */
router.get('/receipt/:paymentId', async (req: Request, res: Response) => {
    try {
        const { paymentId } = req.params;

        // Get payment details
        const paymentResult = await pool.query(
            `SELECT p.*, b.bill_number, b.bill_type, c.full_name, c.phone_number
            FROM payments p
            LEFT JOIN bills b ON p.bill_id = b.id
            LEFT JOIN customers c ON p.customer_id = c.id
            WHERE p.id = $1`,
            [paymentId]
        );

        if (paymentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Payment not found',
            });
        }

        const payment = paymentResult.rows[0];

        // Generate simple receipt using PDFDocument
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ size: 'A4' });

        doc.fontSize(20).font('Helvetica-Bold').text('PAYMENT RECEIPT', { align: 'center' });
        doc.moveDown();
        doc.fontSize(16).text('GA NORTH MUNICIPAL', { align: 'center' });
        doc.moveDown(2);

        doc.fontSize(12).font('Helvetica');
        doc.text(`Receipt Number: ${payment.receipt_number}`);
        doc.text(`Date: ${new Date(payment.payment_date).toLocaleDateString()}`);
        doc.text(`Customer: ${payment.full_name}`);
        doc.text(`Phone: ${payment.phone_number}`);
        doc.text(`Bill Number: ${payment.bill_number}`);
        doc.text(`Bill Type: ${payment.bill_type}`);
        doc.moveDown();

        doc.fontSize(14).font('Helvetica-Bold');
        doc.text(`Amount Paid: GHS ${parseFloat(payment.amount).toFixed(2)}`);
        doc.fontSize(12).font('Helvetica');
        doc.text(`Payment Method: ${payment.payment_method}`);
        if (payment.payment_reference) {
            doc.text(`Reference: ${payment.payment_reference}`);
        }

        doc.moveDown(3);
        doc.fontSize(10);
        doc.text('Thank you for your payment', { align: 'center' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=receipt-${payment.receipt_number}.pdf`);

        doc.pipe(res);
        doc.end();
    } catch (error: any) {
        console.error('Error generating receipt PDF:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate receipt',
        });
    }
});

export default router;
