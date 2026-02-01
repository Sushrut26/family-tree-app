import prisma from '../config/database';
import { Person, Prisma } from '@prisma/client';

export interface CreatePersonDto {
  firstName: string;
  middleName?: string;
  lastName: string;
}

export interface UpdatePersonDto {
  firstName?: string;
  middleName?: string;
  lastName?: string;
}

export class PersonService {
  /**
   * Get all persons (visible to all authenticated users)
   */
  async getAllPersons(): Promise<Person[]> {
    return await prisma.person.findMany({
      include: {
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
   * Get a single person by ID
   */
  async getPersonById(id: string): Promise<Person | null> {
    return await prisma.person.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        relationshipsAsPerson1: {
          include: {
            person2: true,
          },
        },
        relationshipsAsPerson2: {
          include: {
            person1: true,
          },
        },
      },
    });
  }

  /**
   * Create a new person
   * Automatically creates a BranchOwnership entry for the creator
   */
  async createPerson(
    data: CreatePersonDto,
    userId: string
  ): Promise<Person> {
    return await prisma.$transaction(async (tx) => {
      // Create the person
      const person = await tx.person.create({
        data: {
          firstName: data.firstName,
          middleName: data.middleName,
          lastName: data.lastName,
          createdById: userId,
        },
      });

      // Create branch ownership for the creator
      await tx.branchOwnership.create({
        data: {
          userId: userId,
          personId: person.id,
          ownershipType: 'CREATOR',
        },
      });

      return person;
    });
  }

  /**
   * Update a person
   * Checks ownership permissions before allowing update
   */
  async updatePerson(
    id: string,
    data: UpdatePersonDto,
    userId: string,
    isAdmin: boolean
  ): Promise<Person> {
    // Check if user has permission to edit
    const canEdit = await this.canUserEditPerson(id, userId, isAdmin);

    if (!canEdit) {
      throw new Error('You do not have permission to edit this person');
    }

    return await prisma.person.update({
      where: { id },
      data: {
        firstName: data.firstName,
        middleName: data.middleName,
        lastName: data.lastName,
      },
    });
  }

  /**
   * Delete a person
   * Checks ownership permissions before allowing deletion
   * Also deletes all relationships and branch ownerships
   */
  async deletePerson(
    id: string,
    userId: string,
    isAdmin: boolean
  ): Promise<void> {
    // Check if user has permission to delete
    const canEdit = await this.canUserEditPerson(id, userId, isAdmin);

    if (!canEdit) {
      throw new Error('You do not have permission to delete this person');
    }

    await prisma.$transaction(async (tx) => {
      // Delete all relationships involving this person
      await tx.relationship.deleteMany({
        where: {
          OR: [{ person1Id: id }, { person2Id: id }],
        },
      });

      // Delete all branch ownerships for this person
      await tx.branchOwnership.deleteMany({
        where: { personId: id },
      });

      // Delete the person
      await tx.person.delete({
        where: { id },
      });
    });
  }

  /**
   * Check if a user can edit a person
   * Admin can edit anyone, regular users can only edit persons they created
   */
  async canUserEditPerson(
    personId: string,
    userId: string,
    isAdmin: boolean
  ): Promise<boolean> {
    // Admin has full access
    if (isAdmin) {
      return true;
    }

    // Check if user owns this person's branch
    const ownership = await prisma.branchOwnership.findFirst({
      where: {
        personId: personId,
        userId: userId,
      },
    });

    return ownership !== null;
  }

  /**
   * Get all persons that a user has permission to edit
   */
  async getUserEditablePersons(
    userId: string,
    isAdmin: boolean
  ): Promise<Person[]> {
    if (isAdmin) {
      // Admin can edit all persons
      return await this.getAllPersons();
    }

    // Get persons where user has branch ownership
    const ownerships = await prisma.branchOwnership.findMany({
      where: { userId },
      include: {
        person: {
          include: {
            createdBy: {
              select: {
                id: true,
                email: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    return ownerships.map((ownership) => ownership.person);
  }
}

export const personService = new PersonService();
