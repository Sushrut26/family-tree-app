import { describe, expect, it } from 'vitest';
import {
  createPersonSchema,
  bulkImportSchema,
} from '../validators/person.validator';
import { createRelationshipSchema } from '../validators/relationship.validator';

describe('person validators', () => {
  it('trims and normalizes names', async () => {
    const parsed = await createPersonSchema.parseAsync({
      body: {
        firstName: '  John   ',
        lastName: '  Doe ',
      },
    });

    expect(parsed.body.firstName).toBe('John');
    expect(parsed.body.lastName).toBe('Doe');
  });

  it('rejects names longer than 100 chars', async () => {
    const longName = 'a'.repeat(101);
    const result = await createPersonSchema.safeParseAsync({
      body: {
        firstName: longName,
        lastName: 'Doe',
      },
    });

    expect(result.success).toBe(false);
  });

  it('limits bulk import to 1000 entries', async () => {
    const entries = Array.from({ length: 1001 }).map((_, index) => ({
      firstName: `First${index}`,
      lastName: `Last${index}`,
    }));

    const result = await bulkImportSchema.safeParseAsync({
      body: { entries },
    });

    expect(result.success).toBe(false);
  });
});

describe('relationship validators', () => {
  it('rejects self relationships', async () => {
    const result = await createRelationshipSchema.safeParseAsync({
      body: {
        person1Id: '11111111-1111-1111-1111-111111111111',
        person2Id: '11111111-1111-1111-1111-111111111111',
        relationshipType: 'PARENT',
      },
    });

    expect(result.success).toBe(false);
  });
});
