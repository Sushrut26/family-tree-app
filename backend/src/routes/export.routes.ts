import { Router } from 'express';
import { exportTree, getExportPreview } from '../controllers/export.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All export routes require authentication
router.use(authenticate);

// Get export preview (metadata and sample data)
router.get('/preview', getExportPreview);

// Export family tree
// Query params:
// - format: 'json' (default and only option for V1)
// - scope: 'full' (entire tree) or 'user-only' (user's owned branches)
router.get('/', exportTree);

export default router;
