import { Router } from 'express';
import {
  getAuditLogs,
  getEntityLogs,
  getUserLogs,
  getAuditStats,
  deleteOldLogs,
} from '../controllers/auditLog.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All audit log routes require authentication
// Admin-only check is done in controllers
router.use(authenticate);

// Get all audit logs with optional filters (admin only)
router.get('/', getAuditLogs);

// Get audit statistics (admin only)
router.get('/stats', getAuditStats);

// Get logs for a specific entity (admin only)
router.get('/entity/:entityType/:entityId', getEntityLogs);

// Get logs for a specific user (admin only)
router.get('/user/:userId', getUserLogs);

// Delete old audit logs (admin only)
router.delete('/cleanup', deleteOldLogs);

export default router;
