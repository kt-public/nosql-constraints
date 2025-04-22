import _ from 'lodash';
import { UnknownStringRecord } from 'typesafe-utilities';
import { ConstraintPathElement, ConstraintVertexWithId, RefDocType } from './types';

type _ConstraintVertexWithId = ConstraintVertexWithId<UnknownStringRecord>;
type _ConstraintPathElement = ConstraintPathElement<UnknownStringRecord, UnknownStringRecord>;

/**
 * Constraints class, supporting fast access to the constraints
 */
export class Constraints {
  constructor(
    public readonly constraintsMap: ReadonlyMap<_ConstraintVertexWithId, _ConstraintPathElement[][]>
  ) {}

  public getDirectDocumentConstraints<TDoc extends UnknownStringRecord>(
    containerId: string,
    refDocType?: RefDocType<TDoc>
  ): _ConstraintPathElement[] {
    // Find vertices that match the refDocType and return the direct constraints (first element of each path)
    const constraints: _ConstraintPathElement[] = [];
    for (const [vertex, paths] of this.constraintsMap.entries()) {
      // Check if the vertex is a document reference
      if (vertex.vertex.type !== 'document') continue;
      // Check if the vertex is in the same container
      if (vertex.vertex.containerId !== containerId) continue;
      // Check if refDocType both are undefined
      if (refDocType === undefined && vertex.vertex.refDocType === undefined) {
        for (const path of paths) {
          constraints.push(path[0]);
        }
        continue;
      }
      // Check if one is undefined and the other is not (previous condition checked if both are undefined)
      if (refDocType === undefined || vertex.vertex.refDocType === undefined) continue;
      // Now check if there is a match
      if (_.isMatch(refDocType, vertex.vertex.refDocType)) {
        for (const path of paths) {
          if (path.length > 0) {
            constraints.push(path[0]);
          }
        }
      }
    }
    return constraints;
  }
}
