import prisma from '../config/database';
import { Person } from '@prisma/client';

export interface CreatePersonDto {
  firstName: string;
  lastName: string;
}

export interface UpdatePersonDto {
  firstName?: string;
  lastName?: string;
}

export class PersonService {
  /**
   * Get all persons (visible to all authenticated users)
   */
  async getAllPersons() {
    return await prisma.person.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
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
   * Get a single person by ID
   */
  async getPersonById(id: string) {
    return await prisma.person.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        relationshipsAsPerson1: {
          include: {
            person2: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                createdById: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
        relationshipsAsPerson2: {
          include: {
            person1: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                createdById: true,
                createdAt: true,
                updatedAt: true,
              },
            },
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

    // Only allow edits by the creator
    const person = await prisma.person.findUnique({
      where: { id: personId },
      select: { createdById: true },
    });

    if (!person) {
      return false;
    }

    return person.createdById === userId;
  }

  /**
   * Get all persons that a user has permission to edit
   */
  async getUserEditablePersons(
    userId: string,
    isAdmin: boolean
  ) {
    if (isAdmin) {
      // Admin can edit all persons
      return await this.getAllPersons();
    }

    // Only persons created by the user are editable
    return await prisma.person.findMany({
      where: { createdById: userId },
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
        createdAt: 'desc',
      },
    });
  }

  /**
   * Bulk create persons with relationships
   * Smart logic: keep parents, siblings, and spouses linked consistently
   */
  async bulkCreatePersonsWithRelationships(
    entries: BulkImportEntry[],
    userId: string
  ): Promise<{ persons: Person[]; relationshipsCreated: number }> {
    return await prisma.$transaction(async (tx) => {
      const createdPersons: Person[] = [];
      const personNameToIdMap = new Map<string, string>();
      let relationshipsCreated = 0;

      const getParentIds = async (childId: string): Promise<string[]> => {
        const parents = await tx.relationship.findMany({
          where: { person2Id: childId, relationshipType: 'PARENT' },
          select: { person1Id: true },
        });
        return parents.map((rel) => rel.person1Id);
      };

      const getChildIds = async (parentId: string): Promise<string[]> => {
        const children = await tx.relationship.findMany({
          where: { person1Id: parentId, relationshipType: 'PARENT' },
          select: { person2Id: true },
        });
        return children.map((rel) => rel.person2Id);
      };

      const getSpouseIds = async (personId: string): Promise<string[]> => {
        const spouses = await tx.relationship.findMany({
          where: {
            relationshipType: 'SPOUSE',
            OR: [{ person1Id: personId }, { person2Id: personId }],
          },
          select: { person1Id: true, person2Id: true },
        });
        return spouses.map((rel) =>
          rel.person1Id === personId ? rel.person2Id : rel.person1Id
        );
      };

      const createParentLinkIfMissing = async (parentId: string, childId: string) => {
        if (parentId === childId) return;
        const existingParentRel = await tx.relationship.findFirst({
          where: {
            relationshipType: 'PARENT',
            OR: [
              { person1Id: parentId, person2Id: childId },
              { person1Id: childId, person2Id: parentId },
            ],
          },
        });

        if (!existingParentRel) {
          await tx.relationship.create({
            data: {
              person1Id: parentId,
              person2Id: childId,
              relationshipType: 'PARENT',
              createdById: userId,
            },
          });
          relationshipsCreated++;
        }
      };

      // First, get all existing persons to check for matches
      const existingPersons = await tx.person.findMany({
        select: { id: true, firstName: true, lastName: true },
      });

      // Build a map of existing persons by name
      for (const person of existingPersons) {
        const key = `${person.firstName.toLowerCase()}_${person.lastName.toLowerCase()}`;
        personNameToIdMap.set(key, person.id);
      }

      // Process each entry
      for (const entry of entries) {
        // Create the new person if they don't already exist
        const newPersonKey = `${entry.firstName.toLowerCase()}_${entry.lastName.toLowerCase()}`;
        let newPersonId = personNameToIdMap.get(newPersonKey);

        if (!newPersonId) {
          const newPerson = await tx.person.create({
            data: {
              firstName: entry.firstName,
              lastName: entry.lastName,
              createdById: userId,
            },
          });

          // Create branch ownership
          await tx.branchOwnership.create({
            data: {
              userId: userId,
              personId: newPerson.id,
              ownershipType: 'CREATOR',
            },
          });

          createdPersons.push(newPerson);
          personNameToIdMap.set(newPersonKey, newPerson.id);
          newPersonId = newPerson.id;
        }

        // If there's a related person, create the relationship
        if (entry.relatedFirstName && entry.relatedLastName && entry.relationshipType) {
          const relatedPersonKey = `${entry.relatedFirstName.toLowerCase()}_${entry.relatedLastName.toLowerCase()}`;
          const relatedPersonId = personNameToIdMap.get(relatedPersonKey);

          if (relatedPersonId && newPersonId !== relatedPersonId) {
            // Check if relationship already exists
            const existingRel = await tx.relationship.findFirst({
              where: {
                OR: [
                  { person1Id: newPersonId, person2Id: relatedPersonId },
                  { person1Id: relatedPersonId, person2Id: newPersonId },
                ],
              },
            });

            if (!existingRel) {
              // Create the relationship
              // For PARENT: person1 is parent of person2
              // For SIBLING: either order works
              if (entry.relationshipType === 'PARENT') {
                // entry person is the CHILD of the related person
                await tx.relationship.create({
                  data: {
                    person1Id: relatedPersonId, // parent
                    person2Id: newPersonId, // child
                    relationshipType: 'PARENT',
                    createdById: userId,
                  },
                });
              } else if (entry.relationshipType === 'CHILD') {
                // entry person is the PARENT of the related person
                await tx.relationship.create({
                  data: {
                    person1Id: newPersonId, // parent
                    person2Id: relatedPersonId, // child
                    relationshipType: 'PARENT',
                    createdById: userId,
                  },
                });
              } else {
                // SPOUSE or SIBLING
                await tx.relationship.create({
                  data: {
                    person1Id: newPersonId,
                    person2Id: relatedPersonId,
                    relationshipType: entry.relationshipType === 'SIBLING' ? 'SIBLING' : 'SPOUSE',
                    createdById: userId,
                  },
                });
              }
              relationshipsCreated++;

              // Smart linking to keep family structure consistent
              if (entry.relationshipType === 'SIBLING') {
                const [parentsOfNew, parentsOfRelated] = await Promise.all([
                  getParentIds(newPersonId),
                  getParentIds(relatedPersonId),
                ]);

                const parentIds = new Set([...parentsOfNew, ...parentsOfRelated]);
                for (const parentId of parentIds) {
                  await createParentLinkIfMissing(parentId, newPersonId);
                  await createParentLinkIfMissing(parentId, relatedPersonId);
                }
              }

              if (entry.relationshipType === 'SPOUSE') {
                const [childrenOfNew, childrenOfRelated] = await Promise.all([
                  getChildIds(newPersonId),
                  getChildIds(relatedPersonId),
                ]);

                for (const childId of childrenOfNew) {
                  await createParentLinkIfMissing(relatedPersonId, childId);
                }

                for (const childId of childrenOfRelated) {
                  await createParentLinkIfMissing(newPersonId, childId);
                }
              }

              if (entry.relationshipType === 'PARENT' || entry.relationshipType === 'CHILD') {
                const parentId = entry.relationshipType === 'PARENT' ? relatedPersonId : newPersonId;
                const childId = entry.relationshipType === 'PARENT' ? newPersonId : relatedPersonId;
                const spouseIds = await getSpouseIds(parentId);
                for (const spouseId of spouseIds) {
                  await createParentLinkIfMissing(spouseId, childId);
                }
              }
            }
          }
        }
      }

      return { persons: createdPersons, relationshipsCreated };
    });
  }
}

export interface BulkImportEntry {
  firstName: string;
  lastName: string;
  relatedFirstName?: string;
  relatedLastName?: string;
  relationshipType?: 'PARENT' | 'CHILD' | 'SPOUSE' | 'SIBLING';
}

export const personService = new PersonService();
