import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  relationshipService,
  CreateRelationshipDto,
} from '../services/relationship.service';
import { RelationshipType } from '@prisma/client';
import { getStringParam } from '../utils/requestHelpers';

export const getAllRelationships = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const relationships = await relationshipService.getAllRelationships();
    res.json(relationships);
  } catch (error) {
    console.error('Get all relationships error:', error);
    res.status(500).json({ error: 'Failed to fetch relationships' });
  }
};

export const getRelationshipById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const id = getStringParam(req.params.id);
    const relationship = await relationshipService.getRelationshipById(id);

    if (!relationship) {
      res.status(404).json({ error: 'Relationship not found' });
      return;
    }

    res.json(relationship);
  } catch (error) {
    console.error('Get relationship by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch relationship' });
  }
};

export const getRelationshipsForPerson = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const personId = getStringParam(req.params.personId);
    const relationships = await relationshipService.getRelationshipsForPerson(
      personId
    );
    res.json(relationships);
  } catch (error) {
    console.error('Get relationships for person error:', error);
    res.status(500).json({ error: 'Failed to fetch relationships' });
  }
};

export const createRelationship = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { person1Id, person2Id, relationshipType } = req.body;

    if (!person1Id || !person2Id || !relationshipType) {
      res.status(400).json({
        error: 'person1Id, person2Id, and relationshipType are required',
      });
      return;
    }

    // Validate relationship type
    if (!['PARENT', 'SPOUSE', 'SIBLING'].includes(relationshipType)) {
      res.status(400).json({
        error: 'Invalid relationship type. Must be PARENT, SPOUSE, or SIBLING',
      });
      return;
    }

    const createRelationshipDto: CreateRelationshipDto = {
      person1Id,
      person2Id,
      relationshipType: relationshipType as RelationshipType,
    };

    const relationship = await relationshipService.createRelationship(
      createRelationshipDto,
      req.user.id,
      req.user.role === 'ADMIN'
    );

    res.status(201).json(relationship);
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes('not found') ||
        error.message.includes('already exists') ||
        error.message.includes('cycle') ||
        error.message.includes('themselves') ||
        error.message.includes('permission')
      ) {
        res.status(error.message.includes('permission') ? 403 : 400).json({ error: error.message });
        return;
      }
    }
    console.error('Create relationship error:', error);
    res.status(500).json({ error: 'Failed to create relationship' });
  }
};

export const deleteRelationship = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const id = getStringParam(req.params.id);

    await relationshipService.deleteRelationship(
      id,
      req.user.id,
      req.user.role === 'ADMIN'
    );

    res.json({ message: 'Relationship deleted successfully' });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error.message.includes('permission')) {
        res.status(403).json({ error: error.message });
        return;
      }
    }
    console.error('Delete relationship error:', error);
    res.status(500).json({ error: 'Failed to delete relationship' });
  }
};

export const getRelationshipStats = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const stats = await relationshipService.getRelationshipStats();
    res.json(stats);
  } catch (error) {
    console.error('Get relationship stats error:', error);
    res.status(500).json({ error: 'Failed to fetch relationship statistics' });
  }
};
