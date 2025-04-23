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

function buildConstraints() {
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
    { refProperties: { id: 'id' } },
    { containerId: 'container2', refDocType: { type: 'C2B' } }
  );
  const constraints = factory.build();
  return constraints;
}

describe('Constraints', () => {
  describe('Build', () => {
    it('should be able to query direct constraints', ({ expect }) => {
      const constraints = buildConstraints();
      expect(constraints).toBeDefined();
      let directConstraints = constraints.getDirectConstraints<Container1Doc1>('container1', {
        type: 'C1A'
      });
      let expectedConstraints: _ConstraintPathElement[] = [
        {
          fromId: 'container1/{"type":"C1A"}',
          toId: 'container2/{"type":"C2A"}',
          from: {
            containerId: 'container1',
            refDocType: {
              type: 'C1A'
            }
          },
          to: {
            containerId: 'container2',
            refDocType: {
              type: 'C2A'
            }
          },
          constraint: {
            refProperties: {
              buddyId: 'id'
            },
            cascadeDelete: true
          }
        },
        {
          fromId: 'container1/{"type":"C1A"}',
          toId: 'container2/{"type":"C2C"}',
          from: {
            containerId: 'container1',
            refDocType: {
              type: 'C1A'
            }
          },
          to: {
            containerId: 'container2',
            refDocType: {
              type: 'C2C'
            }
          },
          constraint: {
            refProperties: {
              id: 'id'
            },
            cascadeDelete: true
          }
        },
        {
          fromId: 'container1/{"type":"C1A"}',
          toId: 'container2/undefined',
          from: {
            containerId: 'container1',
            refDocType: {
              type: 'C1A'
            }
          },
          to: {
            containerId: 'container2'
          },
          constraint: {
            refProperties: {
              'somePartitionKey.someBuddyId': 'id'
            },
            cascadeDelete: true
          }
        }
      ];
      expect(directConstraints).toEqual(expectedConstraints);
      directConstraints = constraints.getDirectConstraints<Container2Doc>('container2', {
        type: 'C2C'
      });
      expectedConstraints = [
        {
          fromId: 'container2/{"type":"C2C"}',
          toId: 'container2/{"type":"C2C"}/compound',
          from: {
            containerId: 'container2',
            refDocType: {
              type: 'C2C'
            }
          },
          to: {
            containerId: 'container2',
            refDocType: {
              type: 'C2C'
            }
          },
          constraint: {
            refProperties: {
              compoundId: 'id'
            },
            cascadeDelete: true
          }
        }
      ];
      expect(directConstraints).toEqual(expectedConstraints);
      directConstraints = constraints.getDirectConstraints<Container2Doc>('container2');
      expectedConstraints = [];
      expect(directConstraints).toEqual(expectedConstraints);
    });
    it('should be able to query direct cascade delete constraints', ({ expect }) => {
      const constraints = buildConstraints();
      expect(constraints).toBeDefined();
      let directConstraints = constraints.getDirectCascadeDeleteConstraints<Container1Doc1>(
        'container1',
        {
          type: 'C1A'
        }
      );
      let expectedConstraints: _ConstraintPathElement[] = [
        {
          fromId: 'container1/{"type":"C1A"}',
          toId: 'container2/{"type":"C2A"}',
          from: {
            containerId: 'container1',
            refDocType: {
              type: 'C1A'
            }
          },
          to: {
            containerId: 'container2',
            refDocType: {
              type: 'C2A'
            }
          },
          constraint: {
            refProperties: {
              buddyId: 'id'
            },
            cascadeDelete: true
          }
        },
        {
          fromId: 'container1/{"type":"C1A"}',
          toId: 'container2/{"type":"C2C"}',
          from: {
            containerId: 'container1',
            refDocType: {
              type: 'C1A'
            }
          },
          to: {
            containerId: 'container2',
            refDocType: {
              type: 'C2C'
            }
          },
          constraint: {
            refProperties: {
              id: 'id'
            },
            cascadeDelete: true
          }
        },
        {
          fromId: 'container1/{"type":"C1A"}',
          toId: 'container2/undefined',
          from: {
            containerId: 'container1',
            refDocType: {
              type: 'C1A'
            }
          },
          to: {
            containerId: 'container2'
          },
          constraint: {
            refProperties: {
              'somePartitionKey.someBuddyId': 'id'
            },
            cascadeDelete: true
          }
        }
      ];
      expect(directConstraints).toEqual(expectedConstraints);
      directConstraints = constraints.getDirectCascadeDeleteConstraints<Container2Doc>(
        'container2',
        {
          type: 'C2C'
        }
      );
      expectedConstraints = [
        {
          fromId: 'container2/{"type":"C2C"}',
          toId: 'container2/{"type":"C2C"}/compound',
          from: {
            containerId: 'container2',
            refDocType: {
              type: 'C2C'
            }
          },
          to: {
            containerId: 'container2',
            refDocType: {
              type: 'C2C'
            }
          },
          constraint: {
            refProperties: {
              compoundId: 'id'
            },
            cascadeDelete: true
          }
        }
      ];
      expect(directConstraints).toEqual(expectedConstraints);
      directConstraints =
        constraints.getDirectCascadeDeleteConstraints<Container2Doc>('container2');
      expectedConstraints = [];
      expect(directConstraints).toEqual(expectedConstraints);
      directConstraints = constraints.getDirectCascadeDeleteConstraints<Container2Doc2>(
        'container2',
        {
          type: 'C2B'
        }
      );
      expectedConstraints = [];
      expect(directConstraints).toEqual(expectedConstraints);
    });
    it('should be able to query direct no cascade delete constraints', ({ expect }) => {
      const constraints = buildConstraints();
      expect(constraints).toBeDefined();
      let directConstraints = constraints.getDirectCascadeDeleteConstraints<Container1Doc1>(
        'container1',
        {
          type: 'C1A'
        }
      );
      let expectedConstraints: _ConstraintPathElement[] = [
        {
          fromId: 'container1/{"type":"C1A"}',
          toId: 'container2/{"type":"C2A"}',
          from: {
            containerId: 'container1',
            refDocType: {
              type: 'C1A'
            }
          },
          to: {
            containerId: 'container2',
            refDocType: {
              type: 'C2A'
            }
          },
          constraint: {
            refProperties: {
              buddyId: 'id'
            },
            cascadeDelete: true
          }
        },
        {
          fromId: 'container1/{"type":"C1A"}',
          toId: 'container2/{"type":"C2C"}',
          from: {
            containerId: 'container1',
            refDocType: {
              type: 'C1A'
            }
          },
          to: {
            containerId: 'container2',
            refDocType: {
              type: 'C2C'
            }
          },
          constraint: {
            refProperties: {
              id: 'id'
            },
            cascadeDelete: true
          }
        },
        {
          fromId: 'container1/{"type":"C1A"}',
          toId: 'container2/undefined',
          from: {
            containerId: 'container1',
            refDocType: {
              type: 'C1A'
            }
          },
          to: {
            containerId: 'container2'
          },
          constraint: {
            refProperties: {
              'somePartitionKey.someBuddyId': 'id'
            },
            cascadeDelete: true
          }
        }
      ];
      expect(directConstraints).toEqual(expectedConstraints);
      directConstraints = constraints.getDirectNoCascadeDeleteConstraints<Container2Doc>(
        'container2',
        {
          type: 'C2C'
        }
      );
      expectedConstraints = [];
      expect(directConstraints).toEqual(expectedConstraints);
      directConstraints =
        constraints.getDirectNoCascadeDeleteConstraints<Container2Doc>('container2');
      expectedConstraints = [];
      expect(directConstraints).toEqual(expectedConstraints);
      directConstraints = constraints.getDirectNoCascadeDeleteConstraints<Container2Doc2>(
        'container2',
        {
          type: 'C2B'
        }
      );
      expectedConstraints = [
        {
          fromId: 'container2/{"type":"C2B"}',
          toId: 'container1/{"type":"C1B"}',
          from: {
            containerId: 'container2',
            refDocType: {
              type: 'C2B'
            }
          },
          to: {
            containerId: 'container1',
            refDocType: {
              type: 'C1B'
            }
          },
          constraint: {
            refProperties: {
              id: 'id'
            }
          }
        }
      ];
      expect(directConstraints).toEqual(expectedConstraints);
    });
  });
});
