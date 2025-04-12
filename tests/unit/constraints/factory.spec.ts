import { describe, it } from 'vitest';
import { z } from 'zod';
import { ConstraintFactory, zod } from '../../../src/index';

const container1DocSchema1 = z.object({
  id: z.string(),
  type: z.literal('C1A'),
  name: z.string(),
  age: z.number()
});
const container1DocSchema2 = z.object({
  id: z.string(),
  type: z.literal('C1B'),
  firstname: z.string(),
  surname: z.string(),
  email: z.string(),
  childrenRefIds: z.array(z.string())
});
const container1DocSchema = z.discriminatedUnion('type', [
  container1DocSchema1,
  container1DocSchema2
]);
const container2DocSchema1 = z.object({
  id: z.string(),
  type: z.literal('C2A'),
  title: z.string(),
  description: z.string(),
  buddyId: z.string(),
  somePartitionKey: z.object({
    someBuddyId: z.string()
  })
});
const container2DocSchema2 = z.object({
  id: z.string(),
  type: z.literal('C2B'),
  title: z.string(),
  description: z.string(),
  buddyIds: z.array(z.string()),
  somePartitionKey: z.object({
    someBuddyId: z.string()
  })
});
const container2DocSchema3 = z.object({
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
const container2DocSchema = z.discriminatedUnion('type', [
  container2DocSchema1,
  container2DocSchema2,
  container2DocSchema3
]);

const testCaseSchemas = {
  container1: container1DocSchema,
  container2: container2DocSchema
};

describe('Constraint factory', () => {
  describe('Document 2 Document constraint', () => {
    it('should be able to add: container2/doc1.buddyId -> container1/doc1.id', () => {
      const factory = new ConstraintFactory();
      factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
      factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
      factory.addDocument2DocumentConstraint(
        { containerId: 'container2', refDocType: { type: 'C2A' } },
        { refProperties: { buddyId: 'id' } },
        { containerId: 'container1', refDocType: { type: 'C1A' } }
      );
    });
    it('should fail to add: container2/doc1.buddyId -> container1/doc1.id', ({ expect }) => {
      const factory = new ConstraintFactory();
      factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
      factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
      expect(() => {
        factory.addDocument2DocumentConstraint(
          { containerId: 'container2', refDocType: { type: 'C2A' } },
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
        factory.addDocument2DocumentConstraint(
          { containerId: 'container2', refDocType: { type: 'C2A' } },
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
      factory.addDocument2DocumentConstraint(
        { containerId: 'container2', refDocType: { type: 'C2B' } },
        { refProperties: { 'buddyIds[]': 'id' } },
        { containerId: 'container1', refDocType: { type: 'C1A' } }
      );
    });
    it('should be able to add: container2/doc3.parents[].parentId -> container1/doc1.id', () => {
      const factory = new ConstraintFactory();
      factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
      factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
      factory.addDocument2DocumentConstraint(
        { containerId: 'container2', refDocType: { type: 'C2C' } },
        { refProperties: { 'parents[].parentId': 'id' } },
        { containerId: 'container1', refDocType: { type: 'C1A' } }
      );
    });
  });
  describe('Partition 2 Document constraint', () => {
    it('should be able to add: container2/["somePartitionKey.someBuddyId"] -> container1/doc1.id', () => {
      const factory = new ConstraintFactory();
      factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
      factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
      factory.addPartition2DocumentConstraint(
        { containerId: 'container2', partitionKeyProperties: ['somePartitionKey.someBuddyId'] },
        { refProperties: { 'somePartitionKey.someBuddyId': 'id' } },
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
        factory.addPartition2DocumentConstraint(
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
      factory.addDocumentCompoundConstraint(
        { containerId: 'container2', refDocType: { type: 'C2C' } },
        { compoundProperties: ['compoundId'] }
      );
    });
    it('should fail to add compound: container2/doc3.compoundId -> container2/doc3.compoundId', ({
      expect
    }) => {
      const factory = new ConstraintFactory();
      factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
      factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
      expect(() => {
        factory.addDocumentCompoundConstraint(
          { containerId: 'container2', refDocType: { type: 'C2C' } },
          { compoundProperties: ['compoundId', 'compoundIdx'] }
        );
      }).toThrowError(
        'Failed to validate compound constraint container2/{"type":"C2C"}/compoundId,compoundIdx: compound properties must be present in each of the referenced document schema chunks'
      );
    });
  });
});
