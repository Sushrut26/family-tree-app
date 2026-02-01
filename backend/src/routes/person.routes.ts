import { Router } from 'express';
import {
  getAllPersons,
  getPersonById,
  createPerson,
  updatePerson,
  deletePerson,
  getUserEditablePersons,
  checkEditPermission,
} from '../controllers/person.controller';
import { authenticate } from '../middleware/auth';
import { familyPasswordCheck } from '../middleware/familyPasswordCheck';

const router = Router();

// All person routes require authentication and family password verification
router.use(authenticate);
router.use(familyPasswordCheck);

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

// Update a person (ownership check applies)
router.put('/:id', updatePerson);

// Delete a person (ownership check applies, cascades relationships)
router.delete('/:id', deletePerson);

export default router;
