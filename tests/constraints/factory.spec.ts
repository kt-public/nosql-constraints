import { describe, it } from 'vitest';
import { z } from 'zod';
import { ConstraintsFactory, zod } from '../../src/index';

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

describe('Constraint factory', () => {
	describe('Document schema', () => {
		it('should be able to add container1 schema', ({ expect }) => {
			const factory = new ConstraintsFactory();
			factory.addDocumentSchema('container1', zod(container1Doc1Schema));
			factory.addDocumentSchema('container1', zod(container1Doc2Schema));
			expect([...factory.constraintsGraph.getVertexIds()].length).toBe(0);
			expect([...factory.constraintsGraph.getEdgeIds()].length).toBe(0);
		});
		it('should be able to add container2 schema', ({ expect }) => {
			const factory = new ConstraintsFactory();
			factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
			expect([...factory.constraintsGraph.getVertexIds()].length).toBe(0);
			expect([...factory.constraintsGraph.getEdgeIds()].length).toBe(0);
		});
	});
	describe('Document 2 Document constraint', () => {
		it('should fail to add: container2/doc1.buddyId -> container1/doc1.id - without schema', ({
			expect
		}) => {
			const factory = new ConstraintsFactory();
			expect(() => {
				factory.addConstraint<Container2Doc1, Container1Doc1>(
					{ containerId: 'container2', refDocType: { type: 'C2A' } },
					{ refProperties: { buddyId: 'id' }, cascadeDelete: true },
					{ containerId: 'container1', refDocType: { type: 'C1A' } }
				);
			}).toThrowError('Missing schema for container container2');
		});
		it('should fail to add: container2/doc1.buddyId -> container1/doc1.id - no match for refDocType', ({
			expect
		}) => {
			const factory = new ConstraintsFactory();
			factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
			factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
			expect(() => {
				factory.addConstraint<Container2Doc1, Container1Doc1>(
					{ containerId: 'container2', refDocType: { type: 'C2A' } },
					{ refProperties: { buddyId: 'id' }, cascadeDelete: true },
					// @ts-expect-error: Testing invalid refDocType to ensure error handling
					{ containerId: 'container1', refDocType: { type: 'C1X' } }
				);
			}).toThrowError('Missing schema for container container1 and refDocType {"type":"C1X"}');
			expect(() => {
				factory.addConstraint<Container2Doc1, Container1Doc1>(
					{ containerId: 'container2', refDocType: { type: 'C2A' } },
					{ refProperties: { buddyId: 'id' }, cascadeDelete: true },
					// @ts-expect-error: Testing invalid refDocType to ensure error handling
					{ containerId: 'container1', refDocType: { typeZ: 'C1X' } }
				);
			}).toThrowError('Missing schema for container container1 and refDocType {"typeZ":"C1X"}');
		});
		it('should be able to add: container2/doc1.buddyId -> container1/doc1.id', ({ expect }) => {
			const factory = new ConstraintsFactory();
			factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
			factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
			factory.addConstraint<Container2Doc1, Container1Doc1>(
				{ containerId: 'container2', refDocType: { type: 'C2A' } },
				{ refProperties: { buddyId: 'id' }, cascadeDelete: true },
				{ containerId: 'container1', refDocType: { type: 'C1A' } }
			);
			expect([...factory.constraintsGraph.getVertexIds()].length).toBe(2);
			expect([...factory.constraintsGraph.getEdgeIds()].length).toBe(1);
		});
		it('should fail to add: container2/doc1.buddyId -> container1/doc1.id', ({ expect }) => {
			const factory = new ConstraintsFactory();
			factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
			factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
			expect(() => {
				factory.addConstraint<Container2Doc1, Container1Doc1>(
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
			const factory = new ConstraintsFactory();
			factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
			factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
			expect(() => {
				factory.addConstraint<Container2Doc1, Container1Doc1>(
					{ containerId: 'container2', refDocType: { type: 'C2A' } },
					// @ts-expect-error: Testing invalid property name to ensure error handling
					{ refProperties: { buddyId: 'idx' } },
					{ containerId: 'container1', refDocType: { type: 'C1A' } }
				);
			}).toThrowError(
				'Failed to validate referenced constraint container1/{"type":"C1A"}/idx: property not found'
			);
		});
		it('should be able to add: container2/doc2.buddyIds -> container1/doc1.id', ({ expect }) => {
			const factory = new ConstraintsFactory();
			factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
			factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
			factory.addConstraint<Container2Doc2, Container1Doc1>(
				{ containerId: 'container2', refDocType: { type: 'C2B' } },
				{ refProperties: { 'buddyIds[]': 'id' }, cascadeDelete: true },
				{ containerId: 'container1', refDocType: { type: 'C1A' } }
			);
			expect([...factory.constraintsGraph.getVertexIds()].length).toBe(2);
			expect([...factory.constraintsGraph.getEdgeIds()].length).toBe(1);
		});
		it('should be able to add: container2/doc3.parents[].parentId -> container1/doc1.id', ({
			expect
		}) => {
			const factory = new ConstraintsFactory();
			factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
			factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
			factory.addConstraint<Container2Doc3, Container1Doc1>(
				{ containerId: 'container2', refDocType: { type: 'C2C' } },
				{ refProperties: { 'parents[].parentId': 'id' }, cascadeDelete: true },
				{ containerId: 'container1', refDocType: { type: 'C1A' } }
			);
			expect([...factory.constraintsGraph.getVertexIds()].length).toBe(2);
			expect([...factory.constraintsGraph.getEdgeIds()].length).toBe(1);
		});
		it('should be able to add: container2/doc3.parents[].parentId -> container1/doc1.id -> funny refDocType', ({
			expect
		}) => {
			const factory = new ConstraintsFactory();
			factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
			factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
			factory.addConstraint<Container2Doc2, Container1Doc1>(
				{
					containerId: 'container2',
					refDocType: { somePartitionKey: { someBuddyId: 'whateverId' } }
				},
				{ refProperties: { 'buddyIds[]': 'id' }, cascadeDelete: true },
				{ containerId: 'container1', refDocType: { type: 'C1A' } }
			);
			expect([...factory.constraintsGraph.getVertexIds()].length).toBe(2);
			expect([...factory.constraintsGraph.getEdgeIds()].length).toBe(1);
		});
	});
	describe('Partition 2 Document constraint', () => {
		it('should be able to add: container2/["somePartitionKey.someBuddyId"] -> container1/doc1.id', ({
			expect
		}) => {
			const factory = new ConstraintsFactory();
			factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
			factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
			factory.addConstraint<Container2Doc, Container1Doc1>(
				{ containerId: 'container2' },
				{ refProperties: { 'somePartitionKey.someBuddyId': 'id' }, cascadeDelete: true },
				{ containerId: 'container1', refDocType: { type: 'C1A' } }
			);
			expect([...factory.constraintsGraph.getVertexIds()].length).toBe(2);
			expect([...factory.constraintsGraph.getEdgeIds()].length).toBe(1);
		});
	});
	describe('Document compound constraint', () => {
		it('should be able to add compound: container2/doc3.compoundId -> container2/doc3.compoundId', ({
			expect
		}) => {
			const factory = new ConstraintsFactory();
			factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
			factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
			factory.addCompoundConstraint<Container2Doc3>(
				{ containerId: 'container2', refDocType: { type: 'C2C' } },
				{
					refProperties: {
						compoundId: 'id'
					},
					cascadeDelete: true
				}
			);
			expect([...factory.constraintsGraph.getVertexIds()].length).toBe(2);
			expect([...factory.constraintsGraph.getEdgeIds()].length).toBe(1);
		});
		it('should fail to add compound: container2/doc3.compoundId -> container2/doc3.compoundId', ({
			expect
		}) => {
			const factory = new ConstraintsFactory();
			factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
			factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
			expect(() => {
				factory.addCompoundConstraint<Container2Doc3>(
					{ containerId: 'container2', refDocType: { type: 'C2C' } },
					// @ts-expect-error: Testing invalid property name to ensure error handling
					{ refProperties: { compoundIdxx: 'id' } }
				);
			}).toThrowError(
				'Failed to validate referencing constraint container2/{"type":"C2C"}/compoundIdxx: property not found'
			);
			expect(() => {
				factory.addCompoundConstraint<Container2Doc3>(
					{ containerId: 'container2', refDocType: { type: 'C2C' } },
					// @ts-expect-error: Testing invalid property name to ensure error handling
					{ refProperties: { compoundId: 'idxxx' } }
				);
			}).toThrowError(
				'Failed to validate referenced constraint container2/{"type":"C2C"}/idxxx: property not found'
			);
		});
	});
	describe('Validation', () => {
		it('should be able to validate: container2/doc1.buddyId -> container1/doc1.id', ({
			expect
		}) => {
			const factory = new ConstraintsFactory();
			factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
			factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
			factory.addConstraint<Container2Doc1, Container1Doc1>(
				{ containerId: 'container2', refDocType: { type: 'C2A' } },
				{ refProperties: { buddyId: 'id' }, cascadeDelete: true },
				{ containerId: 'container1', refDocType: { type: 'C1A' } }
			);
			expect(factory.validate()).toBeUndefined();
		});
		it('should fail to add self cycle: container2/doc1.buddyId -> container2/doc1.buddyId', ({
			expect
		}) => {
			const factory = new ConstraintsFactory();
			factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
			factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
			expect(() =>
				factory.addConstraint<Container2Doc1, Container2Doc1>(
					{ containerId: 'container2', refDocType: { type: 'C2A' } },
					{ refProperties: { buddyId: 'id' }, cascadeDelete: true },
					{ containerId: 'container2', refDocType: { type: 'C2A' } }
				)
			).toThrowError('Duplicate vertex ids found in the input: container2/{"type":"C2A"}');
		});
		it('should be fail to validate with cycles: container2/doc1.buddyId -> container1/doc1.id -> container2/doc1.buddyId', ({
			expect
		}) => {
			const factory = new ConstraintsFactory();
			factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
			factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
			factory.addConstraint<Container2Doc1, Container1Doc1>(
				{ containerId: 'container2', refDocType: { type: 'C2A' } },
				{ refProperties: { buddyId: 'id' }, cascadeDelete: true },
				{ containerId: 'container1', refDocType: { type: 'C1A' } }
			);
			factory.addConstraint<Container1Doc1, Container2Doc1>(
				{ containerId: 'container1', refDocType: { type: 'C1A' } },
				{ refProperties: { id: 'buddyId' }, cascadeDelete: true },
				{ containerId: 'container2', refDocType: { type: 'C2A' } }
			);
			expect([...factory.constraintsGraph.getEdgeIds()].length).toBe(2);
			expect(() => factory.validate()).toThrowError(
				'Validation failed: cycles detected in the constraints graph, only acyclic graph is supported at the moment'
			);
		});
		it('should be able to validate cascade delete: container2/doc1.buddyId -> container1/doc1.id -> container1/doc2.id -> container2/doc2.id', ({
			expect
		}) => {
			const factory = new ConstraintsFactory();
			factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
			factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
			factory.addConstraint<Container2Doc1, Container1Doc1>(
				{ containerId: 'container2', refDocType: { type: 'C2A' } },
				{ refProperties: { buddyId: 'id' }, cascadeDelete: true },
				{ containerId: 'container1', refDocType: { type: 'C1A' } }
			);
			factory.addConstraint<Container2Doc3, Container1Doc1>(
				{ containerId: 'container2', refDocType: { type: 'C2C' } },
				{ refProperties: { id: 'id' }, cascadeDelete: true },
				{ containerId: 'container1', refDocType: { type: 'C1A' } }
			);
			factory.addConstraint<Container1Doc1, Container1Doc2>(
				{ containerId: 'container1', refDocType: { type: 'C1A' } },
				{ refProperties: { id: 'id' }, cascadeDelete: true },
				{ containerId: 'container1', refDocType: { type: 'C1B' } }
			);
			factory.addConstraint<Container1Doc2, Container2Doc2>(
				{ containerId: 'container1', refDocType: { type: 'C1B' } },
				{ refProperties: { id: 'id' }, cascadeDelete: true },
				{ containerId: 'container2', refDocType: { type: 'C2B' } }
			);
			expect(factory.validate()).toBeUndefined();
		});
		it('should fail to validate cascade delete: container2/doc1.buddyId -> container1/doc1.id -> container1/doc2.id -> container2/doc2.id', ({
			expect
		}) => {
			const factory = new ConstraintsFactory();
			factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
			factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
			factory.addConstraint<Container2Doc1, Container1Doc1>(
				{ containerId: 'container2', refDocType: { type: 'C2A' } },
				{ refProperties: { buddyId: 'id' }, cascadeDelete: true },
				{ containerId: 'container1', refDocType: { type: 'C1A' } }
			);
			factory.addConstraint<Container2Doc3, Container1Doc1>(
				{ containerId: 'container2', refDocType: { type: 'C2C' } },
				{ refProperties: { id: 'id' } },
				{ containerId: 'container1', refDocType: { type: 'C1A' } }
			);
			factory.addConstraint<Container1Doc1, Container1Doc2>(
				{ containerId: 'container1', refDocType: { type: 'C1A' } },
				{ refProperties: { id: 'id' }, cascadeDelete: true },
				{ containerId: 'container1', refDocType: { type: 'C1B' } }
			);
			factory.addConstraint<Container1Doc2, Container2Doc2>(
				{ containerId: 'container1', refDocType: { type: 'C1B' } },
				{ refProperties: { id: 'id' }, cascadeDelete: true },
				{ containerId: 'container2', refDocType: { type: 'C2B' } }
			);
			expect(() => factory.validate()).toThrowError(
				'Validation failed: cascadeDelete = true is not set for all edges in the path(s): container1/{"type":"C1B"}: delete=true -> container1/{"type":"C1A"}: delete=false -> container2/{"type":"C2C"}. All edges in the path(s) must have cascadeDelete = true.'
			);
		});
	});
	describe('Build', () => {
		it('should be able build constraints', ({ expect }) => {
			const factory = new ConstraintsFactory();
			factory.addDocumentSchema('container1', zod(testCaseSchemas.container1));
			factory.addDocumentSchema('container2', zod(testCaseSchemas.container2));
			factory.addConstraint<Container2Doc1, Container1Doc1>(
				{ containerId: 'container2', refDocType: { type: 'C2A' } },
				{ refProperties: { buddyId: 'id' }, cascadeDelete: true },
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
				{ refProperties: { id: 'id' }, cascadeDelete: true },
				{ containerId: 'container2', refDocType: { type: 'C2B' } }
			);
			const constraints = factory.build();
			expect(constraints).toBeDefined();
			let directConstraints = constraints.getDirectConstraints<Container1Doc1>('container1', {
				type: 'C1A'
			});
			expect(directConstraints.length).toBe(3);
			directConstraints = constraints.getDirectConstraints<Container2Doc>('container2', {
				type: 'C2C'
			});
			expect(directConstraints.length).toBe(1);
		});
	});
});
