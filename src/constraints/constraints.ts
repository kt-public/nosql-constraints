import { IDiGraph } from '@ktarmyshov/digraph-js';
import { UnknownStringRecord } from '@ktarmyshov/typesafe-utilities';
import _ from 'lodash';
import {
	Constraint,
	ConstraintPathElement,
	ConstraintVertexWithId,
	DocumentReference,
	RefDocType
} from './types';

type _ConstraintVertex = DocumentReference<UnknownStringRecord>;
type _ConstraintEdge = Constraint<UnknownStringRecord, UnknownStringRecord>;
type _ConstraintVertexWithId = ConstraintVertexWithId<UnknownStringRecord>;
type _ConstraintPathElement = ConstraintPathElement<UnknownStringRecord, UnknownStringRecord>;

/**
 * Constraints class, supporting fast access to the constraints
 */
export class Constraints {
	constructor(
		public readonly constraintsGraph: IDiGraph<_ConstraintVertex, _ConstraintEdge>,
		public readonly constraintsMap: ReadonlyMap<_ConstraintVertexWithId, _ConstraintPathElement[][]>
	) {}

	public getDirectConstraints<TDoc extends UnknownStringRecord>(
		containerId: string,
		refDocType?: RefDocType<TDoc>,
		cascadeDelete?: boolean
	): _ConstraintPathElement[] {
		// Find vertices that match the refDocType and return the direct constraints (first element of each path)
		const constraints: _ConstraintPathElement[] = [];
		const constraintEdgesSet = new Set<string>();
		for (const [vertex, paths] of this.constraintsMap.entries()) {
			if (
				containerId === vertex.vertex.containerId &&
				_.isMatch(refDocType ?? {}, vertex.vertex.refDocType ?? {})
			) {
				for (const path of paths) {
					if (path.length > 0) {
						const edgeId = `${path[0].referencedId} -> ${path[0].referencingId}`;
						if (
							!constraintEdgesSet.has(edgeId) &&
							(cascadeDelete === undefined ||
								(path[0].constraint.cascadeDelete ?? false) === cascadeDelete)
						) {
							constraintEdgesSet.add(edgeId);
							constraints.push(path[0]);
						}
					}
				}
			}
		}
		return constraints;
	}

	public getDirectCascadeDeleteConstraints<TDoc extends UnknownStringRecord>(
		containerId: string,
		refDocType?: RefDocType<TDoc>
	): _ConstraintPathElement[] {
		return this.getDirectConstraints(containerId, refDocType, true);
	}

	public getDirectNoCascadeDeleteConstraints<TDoc extends UnknownStringRecord>(
		containerId: string,
		refDocType?: RefDocType<TDoc>
	): _ConstraintPathElement[] {
		return this.getDirectConstraints(containerId, refDocType, false);
	}
}
