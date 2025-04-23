[![CI](https://github.com/kt-public/nosql-constraints/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/kt-public/nosql-constraints/actions/workflows/ci.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=kt-public_nosql-constraints&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=kt-public_nosql-constraints)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=kt-public_nosql-constraints&metric=bugs)](https://sonarcloud.io/summary/new_code?id=kt-public_nosql-constraints)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=kt-public_nosql-constraints&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=kt-public_nosql-constraints)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=kt-public_nosql-constraints&metric=coverage)](https://sonarcloud.io/summary/new_code?id=kt-public_nosql-constraints)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=kt-public_nosql-constraints&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=kt-public_nosql-constraints)

# nosql-constraints

Helpers to manage constrants (i.e. cascade delete) in a NoSQL database

**in progress, expect breaking changes**

**README file may not be up to date with the functionality, [refer to the test files](https://github.com/kt-public/nosql-constraints/blob/main/tests/constraints/constraints.spec.ts)**

# Supported schema packages

- zod

# Usage

## zod

```ts
import { UnknownStringRecord } from 'typesafe-utilities';
import { describe, it } from 'vitest';
import { z } from 'zod';
import { ConstraintPathElement, ConstraintsFactory, zod } from '../../src/index';

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

type _ConstraintPathElement = ConstraintPathElement<UnknownStringRecord, UnknownStringRecord>;

const factory = new ConstraintsFactory();
factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
```

## Adding and building constraints

```ts
function buildConstraints() {
	const factory = new ConstraintsFactory();
	factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
	factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
	factory.addConstraint<Container2Doc1, Container1Doc1>(
		// Referencing document
		{ containerId: 'container2', refDocType: { type: 'C2A' } },
		// Constraint details with mapping of properties (referencing.buddyId -> referenced.id)
		{ refProperties: { buddyId: 'id' }, cascadeDelete: true },
		// Referenced document
		{ containerId: 'container1', refDocType: { type: 'C1A' } }
	);
	factory.addConstraint<Container2Doc3, Container1Doc1>(
		{ containerId: 'container2', refDocType: { type: 'C2C' } },
		{ refProperties: { id: 'id' }, cascadeDelete: true },
		{ containerId: 'container1', refDocType: { type: 'C1A' } }
	);
	factory.addCompoundConstraint<Container2Doc3>(
		{ containerId: 'container2', refDocType: { type: 'C2C' } },
		{
			refProperties: {
				compoundId: 'id'
			},
			cascadeDelete: true
		}
	);
	factory.addConstraint<Container2Doc, Container1Doc1>(
		{ containerId: 'container2' },
		{ refProperties: { 'somePartitionKey.someBuddyId': 'id' }, cascadeDelete: true },
		{ containerId: 'container1', refDocType: { type: 'C1A' } }
	);
	factory.addConstraint<Container1Doc1, Container1Doc2>(
		{ containerId: 'container1', refDocType: { type: 'C1A' } },
		{ refProperties: { id: 'id' }, cascadeDelete: true },
		{ containerId: 'container1', refDocType: { type: 'C1B' } }
	);
	factory.addConstraint<Container1Doc2, Container2Doc2>(
		{ containerId: 'container1', refDocType: { type: 'C1B' } },
		{ refProperties: { id: 'id' } },
		{ containerId: 'container2', refDocType: { type: 'C2B' } }
	);
	// This will also validate constraints
	// Currently:
	//    A graph of constraints (referenced -> referencing) must not have cycles
	//    a constraint that have cascadeDelete = true, must have all following children with cascade delete = true
	//      otherwise an exception is thrown
	const constraints = factory.build();
	return constraints;
}
```

## Querying constraints

```ts
// All direct constraints from the document (referenced) to other documents (referencing)
let directConstraints = constraints.getDirectCascadeDeleteConstraints<Container2Doc>('container2', {
	type: 'C2C'
});
// All direct constraints from the document (referenced) to other documents (referencing) that have cascade delete = true
let directConstraints = constraints.getDirectCascadeDeleteConstraints<Container1Doc1>(
	'container1',
	{
		type: 'C1A'
	}
);
// All direct constraints from the document (referenced) to other documents (referencing) that have cascade delete = false/undefined
let directConstraints = constraints.getDirectCascadeDeleteConstraints<Container1Doc1>(
	'container1',
	{
		type: 'C1A'
	}
);
```
