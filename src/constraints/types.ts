import { PartialDeep } from 'type-fest';
import { PropertyPaths, UnknownStringRecord } from 'typesafe-utilities';
import { EdgeWithId, VertexWithId } from 'ya-digraph-js';

// Types for vertices in the constraints graph
export type RefDocType<TDoc extends UnknownStringRecord> = PartialDeep<TDoc>;
export type BaseReference = {
  type: string;
  containerId: string;
};
export type DocumentReference<TDoc extends UnknownStringRecord> = BaseReference & {
  type: 'document';
  refDocType?: RefDocType<TDoc>;
};
export type PartitionReference<TDoc extends UnknownStringRecord> = BaseReference & {
  type: 'partition';
  partitionKeyProperties: PropertyPaths<TDoc>[];
};

export type ConstraintVertex<TDoc extends UnknownStringRecord> =
  | DocumentReference<TDoc>
  | PartitionReference<TDoc>;
export type ConstraintVertexWithId<TDoc extends UnknownStringRecord> = VertexWithId<
  ConstraintVertex<TDoc>
>;

// Types for edges in the constraints graph
export type BaseConstraint = {
  type: string;
  cascadeDelete?: true;
};
export type Doc2DocConstraint<
  TReferencing extends UnknownStringRecord,
  TReferenced extends UnknownStringRecord
> = BaseConstraint & {
  type: 'doc2doc';
  refProperties: Partial<Record<PropertyPaths<TReferencing>, PropertyPaths<TReferenced>>>;
};
export type Partition2DocConstraint<
  TReferencing extends UnknownStringRecord,
  TReferenced extends UnknownStringRecord
> = BaseConstraint & {
  type: 'partition2doc';
  refProperties: Partial<Record<PropertyPaths<TReferencing>, PropertyPaths<TReferenced>>>;
};
export type CompoundConstraint<TDoc extends UnknownStringRecord> = BaseConstraint & {
  type: 'compound';
  compoundProperties: PropertyPaths<TDoc>[];
};
export type ConstraintEdge<
  TReferencing extends UnknownStringRecord,
  TReferenced extends UnknownStringRecord
> =
  | Doc2DocConstraint<TReferencing, TReferenced>
  | Partition2DocConstraint<TReferencing, TReferenced>
  | CompoundConstraint<TReferencing>;

export type ConstraintEdgeWithId<
  TReferencing extends UnknownStringRecord,
  TReferenced extends UnknownStringRecord
> = EdgeWithId<ConstraintEdge<TReferencing, TReferenced>>;

export type ConstraintPathElement<
  TReferencing extends UnknownStringRecord,
  TReferenced extends UnknownStringRecord
> = {
  to: ConstraintVertexWithId<TReferencing>;
  edge: ConstraintEdgeWithId<TReferenced, TReferencing>;
};
