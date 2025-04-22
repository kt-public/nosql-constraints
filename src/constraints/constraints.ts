import { IDiGraph } from 'ya-digraph-js';
import { type Edge, type Vertex } from './types';

/**
 * Constraints class, supporting fast access to the constraints
 */
export class Constraints {
  constructor(public readonly constraintsGraph: IDiGraph<Vertex, Edge>) {
    this.build();
  }

  private build() {}
}
