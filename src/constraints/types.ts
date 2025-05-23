import { VertexWithId } from '@ktarmyshov/digraph-js';
import { PropertyPaths, UnknownStringRecord } from '@ktarmyshov/typesafe-utilities';
import { PartialDeep } from 'type-fest';

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
	refProperties: Record<PropertyPaths<TReferencing>, PropertyPaths<TReferenced>>;
};

export type ConstraintPathElement<
	TReferencing extends UnknownStringRecord,
	TReferenced extends UnknownStringRecord
> = {
	referencedId: string;
	referencingId: string;
	referenced: DocumentReference<TReferenced>;
	referencing: DocumentReference<TReferencing>;
	constraint: Constraint<TReferenced, TReferencing>;
};
