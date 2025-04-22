import { IDiGraph } from 'ya-digraph-js';
import { type Edge, type Vertex } from './types';

export class Constraints {
  constructor(public readonly constraintsGraph: IDiGraph<Vertex, Edge>) {}
}
