import prisma from '../config/database';
import { Relationship, RelationshipType } from '@prisma/client';

export interface CreateRelationshipDto {
  person1Id: string;
  person2Id: string;
  relationshipType: RelationshipType;
}

export class RelationshipService {
  private async getParentIds(childId: string): Promise<string[]> {
    const parents = await prisma.relationship.findMany({
      where: {
        person2Id: childId,
        relationshipType: 'PARENT',
      },
      select: { person1Id: true },
    });
    return parents.map((rel) => rel.person1Id);
  }

  private async getChildIds(parentId: string): Promise<string[]> {
    const children = await prisma.relationship.findMany({
      where: {
        person1Id: parentId,
        relationshipType: 'PARENT',
      },
      select: { person2Id: true },
    });
    return children.map((rel) => rel.person2Id);
  }

  private async getSpouseIds(personId: string): Promise<string[]> {
    const spouses = await prisma.relationship.findMany({
      where: {
        relationshipType: 'SPOUSE',
        OR: [{ person1Id: personId }, { person2Id: personId }],
      },
      select: { person1Id: true, person2Id: true },
    });

    return spouses.map((rel) =>
      rel.person1Id === personId ? rel.person2Id : rel.person1Id
    );
  }

  private async createParentLinkIfMissing(
    parentId: string,
    childId: string,
    userId: string,
    isAdmin: boolean
  ): Promise<void> {
    if (parentId === childId) {
      return;
    }

    if (!isAdmin) {
      const [parent, child] = await Promise.all([
        prisma.person.findUnique({
          where: { id: parentId },
          select: { createdById: true },
        }),
        prisma.person.findUnique({
          where: { id: childId },
          select: { createdById: true },
        }),
      ]);

      if (!parent || !child) {
        return;
      }

      if (parent.createdById !== userId || child.createdById !== userId) {
        return;
      }
    }

    const existingParentRel = await prisma.relationship.findFirst({
      where: {
        relationshipType: 'PARENT',
        OR: [
          { person1Id: parentId, person2Id: childId },
          { person1Id: childId, person2Id: parentId },
        ],
      },
    });

    if (existingParentRel) {
      return;
    }

    const wouldCreateCycle = await this.checkForCycle(parentId, childId);
    if (wouldCreateCycle) {
      return;
    }

    await prisma.relationship.create({
      data: {
        person1Id: parentId,
        person2Id: childId,
        relationshipType: 'PARENT',
        createdById: userId,
      },
    });
  }
  /**
   * Get all relationships
   */
  async getAllRelationships(): Promise<Relationship[]> {
    return await prisma.relationship.findMany({
      include: {
        person1: true,
        person2: true,
        createdBy: {
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
   * Get a single relationship by ID
   */
  async getRelationshipById(id: string): Promise<Relationship | null> {
    return await prisma.relationship.findUnique({
      where: { id },
      include: {
        person1: true,
        person2: true,
        createdBy: {
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
   * Get all relationships for a specific person
   */
  async getRelationshipsForPerson(personId: string): Promise<Relationship[]> {
    return await prisma.relationship.findMany({
      where: {
        OR: [{ person1Id: personId }, { person2Id: personId }],
      },
      include: {
        person1: true,
        person2: true,
      },
    });
  }

  /**
   * Create a new relationship
   * Validates that both persons exist and checks for cycles
   */
  async createRelationship(
    data: CreateRelationshipDto,
    userId: string,
    isAdmin: boolean
  ): Promise<Relationship> {
    const { person1Id, person2Id, relationshipType } = data;

    // Validate that both persons exist
    const [person1, person2] = await Promise.all([
      prisma.person.findUnique({ where: { id: person1Id } }),
      prisma.person.findUnique({ where: { id: person2Id } }),
    ]);

    if (!person1) {
      throw new Error(`Person with ID ${person1Id} not found`);
    }

    if (!person2) {
      throw new Error(`Person with ID ${person2Id} not found`);
    }

    // Non-admins can create relationships if they created at least one of the persons
    // This allows users to connect their family members to existing persons in the tree
    if (!isAdmin) {
      const createdPerson1 = person1.createdById === userId;
      const createdPerson2 = person2.createdById === userId;
      if (!createdPerson1 && !createdPerson2) {
        throw new Error('You do not have permission to relate these persons. You must have created at least one of them.');
      }
    }

    // Prevent self-relationships
    if (person1Id === person2Id) {
      throw new Error('A person cannot have a relationship with themselves');
    }

    // Check if relationship already exists
    const existingRelationship = await prisma.relationship.findFirst({
      where: {
        OR: [
          {
            person1Id: person1Id,
            person2Id: person2Id,
          },
          {
            person1Id: person2Id,
            person2Id: person1Id,
          },
        ],
      },
    });

    if (existingRelationship) {
      throw new Error('A relationship between these two persons already exists');
    }

    // For PARENT relationships, check for cycles (simplified cycle detection)
    if (relationshipType === 'PARENT') {
      const wouldCreateCycle = await this.checkForCycle(person1Id, person2Id);
      if (wouldCreateCycle) {
        throw new Error(
          'This relationship would create a cycle in the family tree'
        );
      }
    }

    // Create the relationship
    const createdRelationship = await prisma.relationship.create({
      data: {
        person1Id,
        person2Id,
        relationshipType,
        createdById: userId,
      },
      include: {
        person1: true,
        person2: true,
      },
    });

    if (relationshipType === 'SIBLING') {
      const [parentsOfPerson1, parentsOfPerson2] = await Promise.all([
        this.getParentIds(person1Id),
        this.getParentIds(person2Id),
      ]);

      const parentIds = new Set([...parentsOfPerson1, ...parentsOfPerson2]);

      for (const parentId of parentIds) {
        await this.createParentLinkIfMissing(parentId, person1Id, userId, isAdmin);
        await this.createParentLinkIfMissing(parentId, person2Id, userId, isAdmin);
      }
    }

    if (relationshipType === 'SPOUSE') {
      const [childrenOfPerson1, childrenOfPerson2] = await Promise.all([
        this.getChildIds(person1Id),
        this.getChildIds(person2Id),
      ]);

      for (const childId of childrenOfPerson1) {
        await this.createParentLinkIfMissing(person2Id, childId, userId, isAdmin);
      }

      for (const childId of childrenOfPerson2) {
        await this.createParentLinkIfMissing(person1Id, childId, userId, isAdmin);
      }
    }

    if (relationshipType === 'PARENT') {
      const spouseIds = await this.getSpouseIds(person1Id);
      for (const spouseId of spouseIds) {
        await this.createParentLinkIfMissing(spouseId, person2Id, userId, isAdmin);
      }
    }

    return createdRelationship;
  }

  /**
   * Delete a relationship with permission checks
   */
  async deleteRelationship(
    id: string,
    userId: string,
    isAdmin: boolean
  ): Promise<void> {
    const relationship = await prisma.relationship.findUnique({
      where: { id },
    });

    if (!relationship) {
      throw new Error('Relationship not found');
    }

    if (!isAdmin && relationship.createdById !== userId) {
      throw new Error('You do not have permission to delete this relationship');
    }

    await prisma.relationship.delete({
      where: { id },
    });
  }

  /**
   * Check if adding a PARENT relationship would create a cycle
   * This is a simplified cycle detection - for production, you'd want a more robust algorithm
   */
  private async checkForCycle(
    parentId: string,
    childId: string
  ): Promise<boolean> {
    // Get all descendants of the potential child
    const descendants = await this.getAllDescendants(childId);

    // If the potential parent is already a descendant of the child, it would create a cycle
    return descendants.includes(parentId);
  }

  /**
   * Get all descendants of a person (recursive)
   */
  private async getAllDescendants(personId: string): Promise<string[]> {
    const descendants: string[] = [];
    const visited = new Set<string>();

    const findDescendants = async (id: string): Promise<void> => {
      if (visited.has(id)) return;
      visited.add(id);

      // Find all children (where person is person1 in PARENT relationships)
      const children = await prisma.relationship.findMany({
        where: {
          person1Id: id,
          relationshipType: 'PARENT',
        },
      });

      for (const child of children) {
        descendants.push(child.person2Id);
        await findDescendants(child.person2Id);
      }
    };

    await findDescendants(personId);
    return descendants;
  }

  /**
   * Get relationship statistics
   */
  async getRelationshipStats(): Promise<{
    total: number;
    byType: { type: RelationshipType; count: number }[];
  }> {
    const [total, parentCount, spouseCount, siblingCount] = await Promise.all([
      prisma.relationship.count(),
      prisma.relationship.count({ where: { relationshipType: 'PARENT' } }),
      prisma.relationship.count({ where: { relationshipType: 'SPOUSE' } }),
      prisma.relationship.count({ where: { relationshipType: 'SIBLING' } }),
    ]);

    return {
      total,
      byType: [
        { type: 'PARENT' as RelationshipType, count: parentCount },
        { type: 'SPOUSE' as RelationshipType, count: spouseCount },
        { type: 'SIBLING' as RelationshipType, count: siblingCount },
      ],
    };
  }
}

export const relationshipService = new RelationshipService();
