import { Router } from 'express';
import {
  getAllRelationships,
  getRelationshipById,
  getRelationshipsForPerson,
  createRelationship,
  deleteRelationship,
  getRelationshipStats,
  normalizeRelationships,
} from '../controllers/relationship.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validateRequest';
import {
  createRelationshipSchema,
  relationshipIdSchema,
} from '../validators/relationship.validator';
import { personIdSchema } from '../validators/person.validator';

const router = Router();

// All relationship routes require authentication
router.use(authenticate);

// Get all relationships
router.get('/', getAllRelationships);

// Get relationship statistics
router.get('/stats', getRelationshipStats);

// Normalize derived relationships
router.post('/normalize', normalizeRelationships);

// Get relationships for a specific person
router.get('/person/:personId', validate(personIdSchema), getRelationshipsForPerson);

// Get a single relationship by ID
router.get('/:id', validate(relationshipIdSchema), getRelationshipById);

// Create a new relationship
router.post('/', validate(createRelationshipSchema), createRelationship);

// Delete a relationship
router.delete('/:id', validate(relationshipIdSchema), deleteRelationship);

export default router;
