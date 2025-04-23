import { PartialDeep } from 'type-fest';
import { PropertyPaths, UnknownStringRecord } from 'typesafe-utilities';
import { VertexWithId } from 'ya-digraph-js';

// Types for vertices in the constraints graph
export type RefDocType<TDoc extends UnknownStringRecord> = PartialDeep<TDoc>;
export type DocumentReference<TDoc extends UnknownStringRecord> = {
  containerId: string;
  refDocType?: RefDocType<TDoc>;
};

export type ConstraintVertexWithId<TDoc extends UnknownStringRecord> = VertexWithId<
  DocumentReference<TDoc>
>;

// Types for edges in the constraints graph
export type Constraint<
  TReferencing extends UnknownStringRecord,
  TReferenced extends UnknownStringRecord
> = {
  cascadeDelete?: true;
  refProperties: Partial<Record<PropertyPaths<TReferencing>, PropertyPaths<TReferenced>>>;
};

export type ConstraintPathElement<
  TReferencing extends UnknownStringRecord,
  TReferenced extends UnknownStringRecord
> = {
  fromId: string;
  toId: string;
  from: DocumentReference<TReferenced>;
  to: DocumentReference<TReferencing>;
  constraint: Constraint<TReferenced, TReferencing>;
};
