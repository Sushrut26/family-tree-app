import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  relationshipService,
  CreateRelationshipDto,
} from '../services/relationship.service';
import { RelationshipType, ActionType, EntityType } from '@prisma/client';
import { getClientIp, getStringParam } from '../utils/requestHelpers';
import { auditLogService } from '../services/auditLog.service';
import { sendAdminAlert } from '../services/email.service';
import prisma from '../config/database';

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

    try {
      await auditLogService.logAction({
        userId: req.user.id,
        actionType: ActionType.CREATE,
        entityType: EntityType.RELATIONSHIP,
        entityId: relationship.id,
        ipAddress: getClientIp(req),
        newData: {
          person1Id: relationship.person1Id,
          person2Id: relationship.person2Id,
          relationshipType: relationship.relationshipType,
        },
      });
    } catch (error) {
      console.error('Failed to log relationship creation:', error);
    }

    // Fetch person names for email notification
    const [person1, person2] = await Promise.all([
      prisma.person.findUnique({
        where: { id: relationship.person1Id },
        select: { firstName: true, lastName: true },
      }),
      prisma.person.findUnique({
        where: { id: relationship.person2Id },
        select: { firstName: true, lastName: true },
      }),
    ]);

    const person1Name = person1
      ? `${person1.firstName} ${person1.lastName}`
      : relationship.person1Id;
    const person2Name = person2
      ? `${person2.firstName} ${person2.lastName}`
      : relationship.person2Id;

    void sendAdminAlert({
      subject: 'New relationship added',
      text: `${req.user.firstName} ${req.user.lastName} added a ${relationship.relationshipType} relationship between ${person1Name} and ${person2Name}.`,
    }).catch((error) => {
      console.error('Failed to send relationship alert email:', error);
    });

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

    const existingRelationship = await relationshipService.getRelationshipById(id);

    await relationshipService.deleteRelationship(
      id,
      req.user.id,
      req.user.role === 'ADMIN'
    );

    try {
      await auditLogService.logAction({
        userId: req.user.id,
        actionType: ActionType.DELETE,
        entityType: EntityType.RELATIONSHIP,
        entityId: id,
        ipAddress: getClientIp(req),
        oldData: existingRelationship ? {
          person1Id: existingRelationship.person1Id,
          person2Id: existingRelationship.person2Id,
          relationshipType: existingRelationship.relationshipType,
        } : undefined,
      });
    } catch (error) {
      console.error('Failed to log relationship deletion:', error);
    }

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

export const normalizeRelationships = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    await relationshipService.normalizeRelationships(
      req.user.id,
      req.user.role === 'ADMIN'
    );

    res.json({ message: 'Relationships normalized' });
  } catch (error) {
    console.error('Normalize relationships error:', error);
    res.status(500).json({ error: 'Failed to normalize relationships' });
  }
};
