import { Router } from 'express';
import { verifyFamilyPassword, updateFamilyPassword } from '../controllers/familyConfig.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Verify family password (requires authentication)
router.post('/verify', authenticate, verifyFamilyPassword);

// Update family password (admin only)
router.put('/update', authenticate, updateFamilyPassword);

export default router;
