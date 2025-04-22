[![CI](https://github.com/kt-public/nosql-constraints/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/kt-public/nosql-constraints/actions/workflows/ci.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=kt-public_nosql-constraints&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=kt-public_nosql-constraints)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=kt-public_nosql-constraints&metric=bugs)](https://sonarcloud.io/summary/new_code?id=kt-public_nosql-constraints)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=kt-public_nosql-constraints&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=kt-public_nosql-constraints)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=kt-public_nosql-constraints&metric=coverage)](https://sonarcloud.io/summary/new_code?id=kt-public_nosql-constraints)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=kt-public_nosql-constraints&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=kt-public_nosql-constraints)

# nosql-constraints

Helpers to manage constrants (i.e. cascade delete) in a NoSQL database

**Still in progress**

# Supported schema packages

- zod

# Usage

## zod

```ts
import { describe, it } from 'vitest';
import { z } from 'zod';
import { ConstraintsFactory, zod } from 'nosql-constraints';

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

const factory = new ConstraintsFactory();
factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
```

## Adding constraints

```ts
it('should be able to add: container2/doc1.buddyId -> container1/doc1.id', () => {
  const factory = new ConstraintsFactory();
  factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
  factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
  factory.addDocument2DocumentConstraint(
    { containerId: 'container2', refDocType: { type: 'C2A' } },
    { refProperties: { buddyId: 'id' }, cascadeDelete: true },
    { containerId: 'container1', refDocType: { type: 'C1A' } }
  );
});

it('should be able to add: container2/doc2.buddyIds -> container1/doc1.id', () => {
  const factory = new ConstraintsFactory();
  factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
  factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
  factory.addDocument2DocumentConstraint(
    { containerId: 'container2', refDocType: { type: 'C2B' } },
    { refProperties: { 'buddyIds[]': 'id' }, cascadeDelete: true },
    { containerId: 'container1', refDocType: { type: 'C1A' } }
  );
});

it('should be able to add: container2/doc3.parents[].parentId -> container1/doc1.id', () => {
  const factory = new ConstraintsFactory();
  factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
  factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
  factory.addDocument2DocumentConstraint(
    { containerId: 'container2', refDocType: { type: 'C2C' } },
    { refProperties: { 'parents[].parentId': 'id' }, cascadeDelete: true },
    { containerId: 'container1', refDocType: { type: 'C1A' } }
  );
});

it('should be able to add: container2/["somePartitionKey.someBuddyId"] -> container1/doc1.id', () => {
  const factory = new ConstraintsFactory();
  factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
  factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
  factory.addPartition2DocumentConstraint(
    { containerId: 'container2', partitionKeyProperties: ['somePartitionKey.someBuddyId'] },
    { refProperties: { 'somePartitionKey.someBuddyId': 'id' }, cascadeDelete: true },
    { containerId: 'container1', refDocType: { type: 'C1A' } }
  );
});

it('should be able to add compound: container2/doc3.compoundId -> container2/doc3.compoundId', () => {
  const factory = new ConstraintsFactory();
  factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
  factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
  factory.addDocumentCompoundConstraint(
    { containerId: 'container2', refDocType: { type: 'C2C' } },
    { compoundProperties: ['compoundId'], cascadeDelete: true }
  );
});
```
