import { Router } from 'express';
import {
  getAllRelationships,
  getRelationshipById,
  getRelationshipsForPerson,
  createRelationship,
  deleteRelationship,
  getRelationshipStats,
} from '../controllers/relationship.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All relationship routes require authentication
router.use(authenticate);

// Get all relationships
router.get('/', getAllRelationships);

// Get relationship statistics
router.get('/stats', getRelationshipStats);

// Get relationships for a specific person
router.get('/person/:personId', getRelationshipsForPerson);

// Get a single relationship by ID
router.get('/:id', getRelationshipById);

// Create a new relationship
router.post('/', createRelationship);

// Delete a relationship
router.delete('/:id', deleteRelationship);

export default router;
