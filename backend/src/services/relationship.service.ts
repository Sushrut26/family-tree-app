import prisma from '../config/database';
import { Relationship, RelationshipType } from '@prisma/client';

export interface CreateRelationshipDto {
  person1Id: string;
  person2Id: string;
  relationshipType: RelationshipType;
}

export class RelationshipService {
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
            fullName: true,
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
            fullName: true,
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
    userId: string
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
    return await prisma.relationship.create({
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
  }

  /**
   * Delete a relationship
   */
  async deleteRelationship(id: string): Promise<void> {
    const relationship = await prisma.relationship.findUnique({
      where: { id },
    });

    if (!relationship) {
      throw new Error('Relationship not found');
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
