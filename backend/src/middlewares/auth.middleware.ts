import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'ganorth-municipal-secret-key-2026';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        permissions: string[];
    };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.user = decoded;
        next();
    } catch (err) {
        res.status(403).json({ success: false, error: 'Invalid or expired token.' });
    }
};

export const authorize = (requiredPermissions: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            res.status(401).json({ success: false, error: 'Authentication required.' });
            return;
        }

        const hasPermission = requiredPermissions.every(perm =>
            req.user?.permissions.includes(perm)
        );

        if (!hasPermission) {
            res.status(403).json({
                success: false,
                error: 'Permission denied. You do not have the required access for this action.'
            });
            return;
        }

        next();
    };
};
