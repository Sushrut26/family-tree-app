import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { personService, CreatePersonDto, UpdatePersonDto } from '../services/person.service';
import { getStringParam } from '../utils/requestHelpers';

export const getAllPersons = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const persons = await personService.getAllPersons();
    res.json(persons);
  } catch (error) {
    console.error('Get all persons error:', error);
    res.status(500).json({ error: 'Failed to fetch persons' });
  }
};

export const getPersonById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const id = getStringParam(req.params.id);
    const person = await personService.getPersonById(id);

    if (!person) {
      res.status(404).json({ error: 'Person not found' });
      return;
    }

    res.json(person);
  } catch (error) {
    console.error('Get person by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch person' });
  }
};

export const createPerson = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { firstName, middleName, lastName } = req.body;

    if (!firstName || !lastName) {
      res.status(400).json({ error: 'First name and last name are required' });
      return;
    }

    const createPersonDto: CreatePersonDto = {
      firstName,
      middleName,
      lastName,
    };

    const person = await personService.createPerson(
      createPersonDto,
      req.user.id
    );

    res.status(201).json(person);
  } catch (error) {
    console.error('Create person error:', error);
    res.status(500).json({ error: 'Failed to create person' });
  }
};

export const updatePerson = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const id = getStringParam(req.params.id);
    const { firstName, middleName, lastName } = req.body;

    const updatePersonDto: UpdatePersonDto = {
      firstName,
      middleName,
      lastName,
    };

    const isAdmin = req.user.role === 'ADMIN';

    const person = await personService.updatePerson(
      id,
      updatePersonDto,
      req.user.id,
      isAdmin
    );

    res.json(person);
  } catch (error) {
    if (error instanceof Error && error.message.includes('permission')) {
      res.status(403).json({ error: error.message });
      return;
    }
    console.error('Update person error:', error);
    res.status(500).json({ error: 'Failed to update person' });
  }
};

export const deletePerson = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const id = getStringParam(req.params.id);
    const isAdmin = req.user.role === 'ADMIN';

    await personService.deletePerson(id, req.user.id, isAdmin);

    res.json({ message: 'Person deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.message.includes('permission')) {
      res.status(403).json({ error: error.message });
      return;
    }
    console.error('Delete person error:', error);
    res.status(500).json({ error: 'Failed to delete person' });
  }
};

export const getUserEditablePersons = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const isAdmin = req.user.role === 'ADMIN';
    const persons = await personService.getUserEditablePersons(
      req.user.id,
      isAdmin
    );

    res.json(persons);
  } catch (error) {
    console.error('Get user editable persons error:', error);
    res.status(500).json({ error: 'Failed to fetch editable persons' });
  }
};

export const checkEditPermission = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const id = getStringParam(req.params.id);
    const isAdmin = req.user.role === 'ADMIN';

    const canEdit = await personService.canUserEditPerson(
      id,
      req.user.id,
      isAdmin
    );

    res.json({ canEdit });
  } catch (error) {
    console.error('Check edit permission error:', error);
    res.status(500).json({ error: 'Failed to check permission' });
  }
};
