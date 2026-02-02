import { z } from 'zod';

// Sanitization helper - trim and remove control characters
const sanitizeString = (str: string) => {
  return str
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, ' '); // Normalize multiple spaces to single space
};

// Name validation: 1-100 characters, no only-whitespace
const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name must be 100 characters or less')
  .transform(sanitizeString)
  .refine((val) => val.length > 0, {
    message: 'Name cannot be only whitespace',
  });

// UUID validation
const uuidSchema = z.string().uuid('Invalid ID format');

// Person creation validation
export const createPersonSchema = z.object({
  body: z.object({
    firstName: nameSchema,
    lastName: nameSchema,
  }),
});

// Person update validation
export const updatePersonSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    firstName: nameSchema.optional(),
    lastName: nameSchema.optional(),
  }),
});

// Person ID param validation
export const personIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// Bulk import entry validation
export const bulkImportEntrySchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  relatedFirstName: nameSchema.optional(),
  relatedLastName: nameSchema.optional(),
  relationshipType: z.enum(['PARENT', 'SPOUSE', 'SIBLING', 'CHILD']).optional(),
});

// Bulk import validation - max 1000 entries
export const bulkImportSchema = z.object({
  body: z.object({
    entries: z
      .array(bulkImportEntrySchema)
      .min(1, 'At least one entry is required')
      .max(1000, 'Maximum 1000 entries allowed per import')
      .refine(
        (entries) => {
          // Validate that if relationship info is provided, all fields are present
          return entries.every((entry) => {
            const hasRelationship =
              entry.relatedFirstName ||
              entry.relatedLastName ||
              entry.relationshipType;

            if (!hasRelationship) return true;

            return (
              entry.relatedFirstName &&
              entry.relatedLastName &&
              entry.relationshipType
            );
          });
        },
        {
          message:
            'If specifying a relationship, all fields (related first name, related last name, relationship type) are required',
        }
      ),
  }),
});

export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
export type PersonIdInput = z.infer<typeof personIdSchema>;
export type BulkImportInput = z.infer<typeof bulkImportSchema>;
