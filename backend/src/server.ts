import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { testConnection } from './config/database';

// Import routes
import customerRoutes from './routes/customer.routes';
import propertyRoutes from './routes/property.routes';
import businessRoutes from './routes/business.routes';
import billingRoutes from './routes/billing.routes';
import printRoutes from './routes/print.routes';
import reportsRoutes from './routes/reports.routes';
import lookupRoutes from './routes/lookup.routes';
import usersRoutes from './routes/users.routes';
import auditRoutes from './routes/audit.routes';
import authRoutes from './routes/auth.routes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
}));
app.use(morgan('dev')); // Logging
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.json({
        success: true,
        message: 'Municipal Revenue Management System API',
        timestamp: new Date().toISOString(),
    });
});

// API Routes
app.use('/api/customers', customerRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/bills', billingRoutes);
app.use('/api/print', printRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/lookups', lookupRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/auth', authRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
    });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message,
    });
});

// Start server
const startServer = async () => {
    try {
        // Test database connection
        const dbConnected = await testConnection();

        if (!dbConnected) {
            console.error('❌ Failed to connect to database. Please check your configuration.');
            process.exit(1);
        }

        app.listen(PORT, () => {
            console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   Municipal Revenue Management System - Backend      ║
║                                                       ║
║   Server running on port ${PORT}                      ║
║   Environment: ${process.env.NODE_ENV || 'development'}                          ║
║                                                       ║
║   📊 Dashboard: http://localhost:${PORT}/health        ║
║   📖 API Base: http://localhost:${PORT}/api            ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
      `);

            console.log('✅ Available Endpoints:');
            console.log('   - POST   /api/customers');
            console.log('   - GET    /api/customers/:id');
            console.log('   - POST   /api/properties');
            console.log('   - POST   /api/businesses');
            console.log('   - POST   /api/bills/generate');
            console.log('   - POST   /api/bills/:id/payment');
            console.log('   - GET    /api/print/bill/:id');
            console.log('   - POST   /api/print/bills/bulk');
            console.log('   - GET    /api/reports/dashboard');
            console.log('');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

export default app;
