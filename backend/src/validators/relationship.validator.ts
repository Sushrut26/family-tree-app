import { z } from 'zod';

// UUID validation
const uuidSchema = z.string().uuid('Invalid ID format');

// Relationship type validation
const relationshipTypeSchema = z.enum(['PARENT', 'SPOUSE', 'SIBLING'], {
  message: 'Relationship type must be PARENT, SPOUSE, or SIBLING',
});

// Create relationship validation
export const createRelationshipSchema = z.object({
  body: z
    .object({
      person1Id: uuidSchema,
      person2Id: uuidSchema,
      relationshipType: relationshipTypeSchema,
    })
    .refine((data) => data.person1Id !== data.person2Id, {
      message: 'Cannot create a relationship with the same person',
      path: ['person2Id'],
    }),
});

// Update relationship validation
export const updateRelationshipSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    relationshipType: relationshipTypeSchema,
  }),
});

// Relationship ID param validation
export const relationshipIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export type CreateRelationshipInput = z.infer<typeof createRelationshipSchema>;
export type UpdateRelationshipInput = z.infer<typeof updateRelationshipSchema>;
export type RelationshipIdInput = z.infer<typeof relationshipIdSchema>;
