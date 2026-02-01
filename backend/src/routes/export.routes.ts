import { Router } from 'express';
import { exportTree, getExportPreview } from '../controllers/export.controller';
import { authenticate } from '../middleware/auth';
import { familyPasswordCheck } from '../middleware/familyPasswordCheck';

const router = Router();

// All export routes require authentication and family password verification
router.use(authenticate);
router.use(familyPasswordCheck);

// Get export preview (metadata and sample data)
router.get('/preview', getExportPreview);

// Export family tree
// Query params:
// - format: 'json' (default and only option for V1)
// - scope: 'full' (entire tree) or 'user-only' (user's owned branches)
router.get('/', exportTree);

export default router;
