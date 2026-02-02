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

const router = Router();

// All person routes require authentication
router.use(authenticate);

// Get all persons (visible to all authenticated users)
router.get('/', getAllPersons);

// Get persons that the current user can edit
router.get('/editable', getUserEditablePersons);

// Get a single person by ID
router.get('/:id', getPersonById);

// Check if user can edit a specific person
router.get('/:id/can-edit', checkEditPermission);

// Create a new person (auto-creates branch ownership)
router.post('/', createPerson);

// Bulk import persons with relationships
router.post('/bulk-import', bulkImport);

// Update a person (ownership check applies)
router.put('/:id', updatePerson);

// Delete a person (ownership check applies, cascades relationships)
router.delete('/:id', deletePerson);

export default router;
