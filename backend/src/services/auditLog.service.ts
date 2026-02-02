import prisma from '../config/database';
import { AuditLog, ActionType, EntityType } from '@prisma/client';

export interface CreateAuditLogDto {
  userId: string;
  actionType: ActionType;
  entityType: EntityType;
  entityId: string;
  oldData?: any;
  newData?: any;
  ipAddress?: string;
}

export interface AuditLogFilters {
  userId?: string;
  actionType?: ActionType;
  entityType?: EntityType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class AuditLogService {
  /**
   * Create a new audit log entry
   * This should be called after every create/update/delete operation
   */
  async logAction(data: CreateAuditLogDto): Promise<AuditLog> {
    const {
      userId,
      actionType,
      entityType,
      entityId,
      oldData,
      newData,
      ipAddress,
    } = data;

    return await prisma.auditLog.create({
      data: {
        userId,
        actionType,
        entityType,
        entityId,
        oldData: oldData ? JSON.stringify(oldData) : null,
        newData: newData ? JSON.stringify(newData) : null,
        ipAddress,
      },
    });
  }

  /**
   * Get all audit logs with optional filters
   * Supports pagination and filtering by user, action type, entity type, and date range
   */
  async getAuditLogs(filters: AuditLogFilters = {}): Promise<{
    logs: AuditLog[];
    total: number;
    hasMore: boolean;
  }> {
    const {
      userId,
      actionType,
      entityType,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = filters;

    // Build where clause
    const where: any = {};

    if (userId) {
      where.userId = userId;
    }

    if (actionType) {
      where.actionType = actionType;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    // Get logs with pagination
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
          lastName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      hasMore: offset + logs.length < total,
    };
  }

  /**
   * Get audit logs for a specific entity
   */
  async getEntityLogs(
    entityType: EntityType,
    entityId: string
  ): Promise<AuditLog[]> {
    return await prisma.auditLog.findMany({
      where: {
        entityType,
        entityId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
          lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get audit logs for a specific user
   */
  async getUserLogs(userId: string): Promise<AuditLog[]> {
    return await prisma.auditLog.findMany({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
          lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get audit log statistics
   */
  async getAuditStats(): Promise<{
    total: number;
    byActionType: { actionType: ActionType; count: number }[];
    byEntityType: { entityType: EntityType; count: number }[];
    recentActivityCount: number;
  }> {
    const [
      total,
      createCount,
      updateCount,
      deleteCount,
      personCount,
      relationshipCount,
      userCount,
      recentActivityCount,
    ] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.count({ where: { actionType: 'CREATE' } }),
      prisma.auditLog.count({ where: { actionType: 'UPDATE' } }),
      prisma.auditLog.count({ where: { actionType: 'DELETE' } }),
      prisma.auditLog.count({ where: { entityType: 'PERSON' } }),
      prisma.auditLog.count({ where: { entityType: 'RELATIONSHIP' } }),
      prisma.auditLog.count({ where: { entityType: 'USER' } }),
      prisma.auditLog.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      }),
    ]);

    return {
      total,
      byActionType: [
        { actionType: 'CREATE' as ActionType, count: createCount },
        { actionType: 'UPDATE' as ActionType, count: updateCount },
        { actionType: 'DELETE' as ActionType, count: deleteCount },
      ],
      byEntityType: [
        { entityType: 'PERSON' as EntityType, count: personCount },
        { entityType: 'RELATIONSHIP' as EntityType, count: relationshipCount },
        { entityType: 'USER' as EntityType, count: userCount },
      ],
      recentActivityCount,
    };
  }

  /**
   * Delete old audit logs (cleanup utility)
   * Removes logs older than specified days
   */
  async deleteOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }
}

export const auditLogService = new AuditLogService();
