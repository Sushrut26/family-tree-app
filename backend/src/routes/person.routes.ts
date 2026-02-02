import { Router } from 'express';
import {
  getAllPersons,
  getPersonById,
  createPerson,
  updatePerson,
  deletePerson,
  getUserEditablePersons,
  checkEditPermission,
  bulkImport,
} from '../controllers/person.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validateRequest';
import {
  createPersonSchema,
  updatePersonSchema,
  personIdSchema,
  bulkImportSchema,
} from '../validators/person.validator';

const router = Router();

// All person routes require authentication
router.use(authenticate);

// Get all persons (visible to all authenticated users)
router.get('/', getAllPersons);

// Get persons that the current user can edit
router.get('/editable', getUserEditablePersons);

// Get a single person by ID
router.get('/:id', validate(personIdSchema), getPersonById);

// Check if user can edit a specific person
router.get('/:id/can-edit', validate(personIdSchema), checkEditPermission);

// Create a new person (auto-creates branch ownership)
router.post('/', validate(createPersonSchema), createPerson);

// Bulk import persons with relationships
router.post('/bulk-import', validate(bulkImportSchema), bulkImport);

// Update a person (ownership check applies)
router.put('/:id', validate(updatePersonSchema), updatePerson);

// Delete a person (ownership check applies, cascades relationships)
router.delete('/:id', validate(personIdSchema), deletePerson);

export default router;
