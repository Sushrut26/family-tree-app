import prisma from '../config/database';

export interface ExportData {
  version: string;
  exportedAt: string;
  exportedBy: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  persons: any[];
  relationships: any[];
  metadata: {
    totalPersons: number;
    totalRelationships: number;
    totalUsers: number;
  };
}

export class ExportService {
  /**
   * Export the entire family tree as JSON
   * Includes all persons, relationships, and metadata
   */
  async exportAsJSON(userId: string): Promise<ExportData> {
    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
          lastName: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get all persons
    const persons = await prisma.person.findMany({
      include: {
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
        createdAt: 'asc',
      },
    });

    // Get all relationships
    const relationships = await prisma.relationship.findMany({
      include: {
        person1: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        person2: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
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
        createdAt: 'asc',
      },
    });

    // Get counts
    const [totalPersons, totalRelationships, totalUsers] = await Promise.all([
      prisma.person.count(),
      prisma.relationship.count(),
      prisma.user.count(),
    ]);

    // Build export data
    const exportData: ExportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      exportedBy: user,
      persons: persons.map((person) => ({
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        fullName: [person.firstName, person.lastName].join(' '),
        createdBy: person.createdBy,
        createdAt: person.createdAt.toISOString(),
        updatedAt: person.updatedAt.toISOString(),
      })),
      relationships: relationships.map((rel) => ({
        id: rel.id,
        person1: rel.person1,
        person2: rel.person2,
        relationshipType: rel.relationshipType,
        createdBy: rel.createdBy,
        createdAt: rel.createdAt.toISOString(),
      })),
      metadata: {
        totalPersons,
        totalRelationships,
        totalUsers,
      },
    };

    return exportData;
  }

  /**
   * Generate a downloadable filename for the export
   */
  generateFilename(format: string = 'json'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `family-tree-export-${timestamp}.${format}`;
  }

  /**
   * Export user's owned branches only (not entire tree)
   * Returns only persons and relationships for branches the user created
   */
  async exportUserBranches(userId: string): Promise<ExportData> {
    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
          lastName: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get user's owned persons
    const ownerships = await prisma.branchOwnership.findMany({
      where: { userId },
      include: {
        person: {
          include: {
            createdBy: {
              select: {
                id: true,
                email: true,
                firstName: true,
          lastName: true,
              },
            },
          },
        },
      },
    });

    const ownedPersonIds = ownerships.map((o) => o.personId);
    const persons = ownerships.map((o) => o.person);

    // Get relationships involving owned persons
    const relationships = await prisma.relationship.findMany({
      where: {
        OR: [
          { person1Id: { in: ownedPersonIds } },
          { person2Id: { in: ownedPersonIds } },
        ],
      },
      include: {
        person1: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        person2: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
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
        createdAt: 'asc',
      },
    });

    // Build export data
    const exportData: ExportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      exportedBy: user,
      persons: persons.map((person) => ({
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        fullName: [person.firstName, person.lastName].join(' '),
        createdBy: person.createdBy,
        createdAt: person.createdAt.toISOString(),
        updatedAt: person.updatedAt.toISOString(),
      })),
      relationships: relationships.map((rel) => ({
        id: rel.id,
        person1: rel.person1,
        person2: rel.person2,
        relationshipType: rel.relationshipType,
        createdBy: rel.createdBy,
        createdAt: rel.createdAt.toISOString(),
      })),
      metadata: {
        totalPersons: persons.length,
        totalRelationships: relationships.length,
        totalUsers: 1, // Just the exporting user
      },
    };

    return exportData;
  }
}

export const exportService = new ExportService();
