import prisma from '../config/database';
import { BranchOwnership, OwnershipType } from '@prisma/client';

export interface CreateOwnershipDto {
  userId: string;
  personId: string;
  ownershipType?: OwnershipType;
}

export class BranchOwnershipService {
  /**
   * Create a branch ownership entry
   * Typically called automatically when a user creates a person
   */
  async createOwnership(data: CreateOwnershipDto): Promise<BranchOwnership> {
    const { userId, personId, ownershipType = 'CREATOR' } = data;

    // Check if ownership already exists
    const existing = await prisma.branchOwnership.findFirst({
      where: {
        userId,
        personId,
      },
    });

    if (existing) {
      throw new Error('Ownership already exists for this user and person');
    }

    return await prisma.branchOwnership.create({
      data: {
        userId,
        personId,
        ownershipType,
      },
    });
  }

  /**
   * Check if a user can edit a person
   * Returns true if user owns the branch or is admin
   */
  async canEdit(
    userId: string,
    personId: string,
    isAdmin: boolean
  ): Promise<boolean> {
    // Admin has full access
    if (isAdmin) {
      return true;
    }

    // Check if user owns this person's branch
    const ownership = await prisma.branchOwnership.findFirst({
      where: {
        userId,
        personId,
      },
    });

    return ownership !== null;
  }

  /**
   * Grant ownership to a user (admin only)
   * Allows admin to give other users edit access to specific branches
   */
  async grantOwnership(
    adminId: string,
    targetUserId: string,
    personId: string,
    ownershipType: OwnershipType = 'GRANTED'
  ): Promise<BranchOwnership> {
    // Verify admin has admin role
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new Error('Only admins can grant ownership');
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new Error('Target user not found');
    }

    // Verify person exists
    const person = await prisma.person.findUnique({
      where: { id: personId },
    });

    if (!person) {
      throw new Error('Person not found');
    }

    // Check if ownership already exists
    const existing = await prisma.branchOwnership.findFirst({
      where: {
        userId: targetUserId,
        personId,
      },
    });

    if (existing) {
      throw new Error('User already has ownership of this person');
    }

    return await prisma.branchOwnership.create({
      data: {
        userId: targetUserId,
        personId,
        ownershipType,
        grantedById: adminId,
      },
    });
  }

  /**
   * Revoke ownership from a user (admin only)
   * Removes edit access from a user for a specific branch
   */
  async revokeOwnership(
    adminId: string,
    targetUserId: string,
    personId: string
  ): Promise<void> {
    // Verify admin has admin role
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new Error('Only admins can revoke ownership');
    }

    // Find the ownership
    const ownership = await prisma.branchOwnership.findFirst({
      where: {
        userId: targetUserId,
        personId,
      },
    });

    if (!ownership) {
      throw new Error('Ownership not found');
    }

    // Don't allow revoking CREATOR ownership
    if (ownership.ownershipType === 'CREATOR') {
      throw new Error('Cannot revoke creator ownership');
    }

    await prisma.branchOwnership.delete({
      where: { id: ownership.id },
    });
  }

  /**
   * Get all ownerships for a user
   */
  async getUserOwnerships(userId: string): Promise<BranchOwnership[]> {
    return await prisma.branchOwnership.findMany({
      where: { userId },
      include: {
        person: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
          lastName: true,
          },
        },
      },
    });
  }

  /**
   * Get all ownerships for a person
   */
  async getPersonOwnerships(personId: string): Promise<BranchOwnership[]> {
    return await prisma.branchOwnership.findMany({
      where: { personId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
          lastName: true,
          },
        },
        person: true,
      },
    });
  }

  /**
   * Get all ownerships in the system (admin only)
   */
  async getAllOwnerships(): Promise<BranchOwnership[]> {
    return await prisma.branchOwnership.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
          lastName: true,
          },
        },
        person: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}

export const branchOwnershipService = new BranchOwnershipService();
