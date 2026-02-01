import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { auditLogService, AuditLogFilters } from '../services/auditLog.service';
import { ActionType, EntityType } from '@prisma/client';
import { getStringParam } from '../utils/requestHelpers';

export const getAuditLogs = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Only admin can view audit logs
    if (req.user?.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const {
      userId,
      actionType,
      entityType,
      startDate,
      endDate,
      limit,
      offset,
    } = req.query;

    const filters: AuditLogFilters = {};

    if (userId) {
      filters.userId = userId as string;
    }

    if (actionType) {
      filters.actionType = actionType as ActionType;
    }

    if (entityType) {
      filters.entityType = entityType as EntityType;
    }

    if (startDate) {
      filters.startDate = new Date(startDate as string);
    }

    if (endDate) {
      filters.endDate = new Date(endDate as string);
    }

    if (limit) {
      filters.limit = parseInt(limit as string);
    }

    if (offset) {
      filters.offset = parseInt(offset as string);
    }

    const result = await auditLogService.getAuditLogs(filters);
    res.json(result);
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};

export const getEntityLogs = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Only admin can view audit logs
    if (req.user?.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const entityType = getStringParam(req.params.entityType);
    const entityId = getStringParam(req.params.entityId);

    if (!['PERSON', 'RELATIONSHIP', 'USER'].includes(entityType)) {
      res.status(400).json({
        error: 'Invalid entity type. Must be PERSON, RELATIONSHIP, or USER',
      });
      return;
    }

    const logs = await auditLogService.getEntityLogs(
      entityType as EntityType,
      entityId
    );
    res.json(logs);
  } catch (error) {
    console.error('Get entity logs error:', error);
    res.status(500).json({ error: 'Failed to fetch entity logs' });
  }
};

export const getUserLogs = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Only admin can view audit logs
    if (req.user?.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const userId = getStringParam(req.params.userId);

    const logs = await auditLogService.getUserLogs(userId);
    res.json(logs);
  } catch (error) {
    console.error('Get user logs error:', error);
    res.status(500).json({ error: 'Failed to fetch user logs' });
  }
};

export const getAuditStats = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Only admin can view audit stats
    if (req.user?.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const stats = await auditLogService.getAuditStats();
    res.json(stats);
  } catch (error) {
    console.error('Get audit stats error:', error);
    res.status(500).json({ error: 'Failed to fetch audit statistics' });
  }
};

export const deleteOldLogs = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Only admin can delete logs
    if (req.user?.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { daysToKeep } = req.body;

    const days = daysToKeep ? parseInt(daysToKeep) : 90;

    if (days < 1) {
      res.status(400).json({ error: 'Days to keep must be at least 1' });
      return;
    }

    const deletedCount = await auditLogService.deleteOldLogs(days);
    res.json({
      message: `Deleted ${deletedCount} old audit logs`,
      deletedCount,
    });
  } catch (error) {
    console.error('Delete old logs error:', error);
    res.status(500).json({ error: 'Failed to delete old logs' });
  }
};
