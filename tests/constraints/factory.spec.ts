import { describe, it } from 'vitest';
import { z } from 'zod';
import { ConstraintFactory, zod } from '../../src/index';

const container1Doc1Schema = z.object({
  id: z.string(),
  type: z.literal('C1A'),
  name: z.string(),
  age: z.number()
});
type Container1Doc1 = z.infer<typeof container1Doc1Schema>;
const container1Doc2Schema = z.object({
  id: z.string(),
  type: z.literal('C1B'),
  firstname: z.string(),
  surname: z.string(),
  email: z.string(),
  childrenRefIds: z.array(z.string())
});
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type Container1Doc2 = z.infer<typeof container1Doc2Schema>;
const container1DocSchema = z.discriminatedUnion('type', [
  container1Doc1Schema,
  container1Doc2Schema
]);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type Container1Doc = z.infer<typeof container1DocSchema>;
const container2Doc1Schema = z.object({
  id: z.string(),
  type: z.literal('C2A'),
  title: z.string(),
  description: z.string(),
  buddyId: z.string(),
  somePartitionKey: z.object({
    someBuddyId: z.string()
  })
});
type Container2Doc1 = z.infer<typeof container2Doc1Schema>;
const container2Doc2Schema = z.object({
  id: z.string(),
  type: z.literal('C2B'),
  title: z.string(),
  description: z.string(),
  buddyIds: z.array(z.string()),
  somePartitionKey: z.object({
    someBuddyId: z.string()
  })
});
type Container2Doc2 = z.infer<typeof container2Doc2Schema>;
const container2Doc3Schema = z.object({
  id: z.string(),
  type: z.literal('C2C'),
  title: z.string(),
  description: z.string(),
  parents: z.array(
    z.object({
      parentId: z.string(),
      comment: z.string()
    })
  ),
  somePartitionKey: z.object({
    someBuddyId: z.string()
  }),
  compoundId: z.string()
});
type Container2Doc3 = z.infer<typeof container2Doc3Schema>;
const container2DocSchema = z.discriminatedUnion('type', [
  container2Doc1Schema,
  container2Doc2Schema,
  container2Doc3Schema
]);
type Container2Doc = z.infer<typeof container2DocSchema>;

const testCaseSchemas = {
  container1: container1DocSchema,
  container2: container2DocSchema
};

describe('Constraint factory', () => {
  describe('Document schema', () => {
    it('should be able to add container1 schema', () => {
      const factory = new ConstraintFactory();
      factory.addDocumentSchema('container1', zod(container1Doc1Schema));
      factory.addDocumentSchema('container1', zod(container1Doc2Schema));
    });
    it('should be able to add container2 schema', () => {
      const factory = new ConstraintFactory();
      factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
    });
  });
  describe('Document 2 Document constraint', () => {
    it('should fail to add: container2/doc1.buddyId -> container1/doc1.id - without schema', ({
      expect
    }) => {
      const factory = new ConstraintFactory();
      expect(() => {
        factory.addDocument2DocumentConstraint<Container2Doc1, Container1Doc1>(
          { containerId: 'container2', refDocType: { type: 'C2A' } },
          { refProperties: { buddyId: 'id' }, cascadeDelete: true },
          { containerId: 'container1', refDocType: { type: 'C1A' } }
        );
      }).toThrowError('Missing schema for container container2');
    });
    it('should be able to add: container2/doc1.buddyId -> container1/doc1.id', () => {
      const factory = new ConstraintFactory();
      factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
      factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
      factory.addDocument2DocumentConstraint<Container2Doc1, Container1Doc1>(
        { containerId: 'container2', refDocType: { type: 'C2A' } },
        { refProperties: { buddyId: 'id' }, cascadeDelete: true },
        { containerId: 'container1', refDocType: { type: 'C1A' } }
      );
    });
    it('should fail to add: container2/doc1.buddyId -> container1/doc1.id', ({ expect }) => {
      const factory = new ConstraintFactory();
      factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
      factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
      expect(() => {
        factory.addDocument2DocumentConstraint<Container2Doc1, Container1Doc1>(
          { containerId: 'container2', refDocType: { type: 'C2A' } },
          // @ts-expect-error: Testing invalid property name to ensure error handling
          { refProperties: { buddyIdx: 'id' } },
          { containerId: 'container1', refDocType: { type: 'C1A' } }
        );
      }).toThrowError(
        'Failed to validate referencing constraint container2/{"type":"C2A"}/buddyIdx: property not found'
      );
    });
    it('should fail to add: container2/doc1.buddyId -> container1/doc1.id', ({ expect }) => {
      const factory = new ConstraintFactory();
      factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
      factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
      expect(() => {
        factory.addDocument2DocumentConstraint<Container2Doc1, Container1Doc1>(
          { containerId: 'container2', refDocType: { type: 'C2A' } },
          // @ts-expect-error: Testing invalid property name to ensure error handling
          { refProperties: { buddyId: 'idx' } },
          { containerId: 'container1', refDocType: { type: 'C1A' } }
        );
      }).toThrowError(
        'Failed to validate referenced constraint container1/{"type":"C1A"}/idx: property not found'
      );
    });
    it('should be able to add: container2/doc2.buddyIds -> container1/doc1.id', () => {
      const factory = new ConstraintFactory();
      factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
      factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
      factory.addDocument2DocumentConstraint<Container2Doc2, Container1Doc1>(
        { containerId: 'container2', refDocType: { type: 'C2B' } },
        { refProperties: { 'buddyIds[]': 'id' }, cascadeDelete: true },
        { containerId: 'container1', refDocType: { type: 'C1A' } }
      );
    });
    it('should be able to add: container2/doc3.parents[].parentId -> container1/doc1.id', () => {
      const factory = new ConstraintFactory();
      factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
      factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
      factory.addDocument2DocumentConstraint<Container2Doc3, Container1Doc1>(
        { containerId: 'container2', refDocType: { type: 'C2C' } },
        { refProperties: { 'parents[].parentId': 'id' }, cascadeDelete: true },
        { containerId: 'container1', refDocType: { type: 'C1A' } }
      );
    });
  });
  describe('Partition 2 Document constraint', () => {
    it('should be able to add: container2/["somePartitionKey.someBuddyId"] -> container1/doc1.id', () => {
      const factory = new ConstraintFactory();
      factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
      factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
      factory.addPartition2DocumentConstraint<Container2Doc, Container1Doc1>(
        { containerId: 'container2', partitionKeyProperties: ['somePartitionKey.someBuddyId'] },
        { refProperties: { 'somePartitionKey.someBuddyId': 'id' }, cascadeDelete: true },
        { containerId: 'container1', refDocType: { type: 'C1A' } }
      );
    });
    it('should fail to add: container2/["somePartitionKey.someBuddyId"] -> container1/doc1.id', ({
      expect
    }) => {
      const factory = new ConstraintFactory();
      factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
      factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
      expect(() => {
        factory.addPartition2DocumentConstraint<Container2Doc, Container1Doc1>(
          { containerId: 'container2', partitionKeyProperties: ['somePartitionKey.someBuddyId'] },
          { refProperties: { somePartitionKey: 'id' } },
          { containerId: 'container1', refDocType: { type: 'C1A' } }
        );
      }).toThrowError(
        'Failed to validate referencing constraint container2/["somePartitionKey.someBuddyId"]: all of the partition keys must be present in the keys of the constraint.refProperties'
      );
    });
  });
  describe('Document compound constraint', () => {
    it('should be able to add compound: container2/doc3.compoundId -> container2/doc3.compoundId', () => {
      const factory = new ConstraintFactory();
      factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
      factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
      factory.addDocumentCompoundConstraint<Container2Doc3>(
        { containerId: 'container2', refDocType: { type: 'C2C' } },
        { compoundProperties: ['compoundId'], cascadeDelete: true }
      );
    });
    it('should fail to add compound: container2/doc3.compoundId -> container2/doc3.compoundId', ({
      expect
    }) => {
      const factory = new ConstraintFactory();
      factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
      factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
      expect(() => {
        factory.addDocumentCompoundConstraint<Container2Doc3>(
          { containerId: 'container2', refDocType: { type: 'C2C' } },
          // @ts-expect-error: Testing invalid property name to ensure error handling
          { compoundProperties: ['compoundId', 'compoundIdx'] }
        );
      }).toThrowError(
        'Failed to validate compound constraint container2/{"type":"C2C"}/compoundId,compoundIdx: compound properties must be present in each of the referenced document schema chunks'
      );
    });
  });
});
