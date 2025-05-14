import { CyclesDFS, DiGraph, EdgeId, GraphPaths, IDiGraph } from '@ktarmyshov/digraph-js';
import { type PropertyPaths, type UnknownStringRecord } from '@ktarmyshov/typesafe-utilities';
import stringify from 'safe-stable-stringify';
import { DocumentSchemaAdapter, DocumentSchemaChunk } from '../adapter/schema';
import { Constraints } from './constraints.js';
import {
	Constraint,
	ConstraintPathElement,
	ConstraintVertexWithId,
	DocumentReference
} from './types';

type _ConstraintVertex = DocumentReference<UnknownStringRecord>;
type _ConstraintEdge = Constraint<UnknownStringRecord, UnknownStringRecord>;
type _ConstraintVertexWithId = ConstraintVertexWithId<UnknownStringRecord>;
type _ConstraintPathElement = ConstraintPathElement<UnknownStringRecord, UnknownStringRecord>;

export class ConstraintsFactory {
	readonly #containerSchemaAdapters = new Map<string, DocumentSchemaAdapter[]>();
	readonly #containerSchemaChunks = new Map<string, DocumentSchemaChunk[]>();
	readonly #constraintsGraph = new DiGraph<_ConstraintVertex, _ConstraintEdge>();

	get constraintsGraph(): IDiGraph<_ConstraintVertex, _ConstraintEdge> {
		return this.#constraintsGraph;
	}

	public addDocumentSchema(containerId: string, schema: DocumentSchemaAdapter): void {
		let adapters = this.#containerSchemaAdapters.get(containerId);
		if (!adapters) {
			adapters = [];
			this.#containerSchemaAdapters.set(containerId, adapters);
		}
		adapters.push(schema);
		let chunks = this.#containerSchemaChunks.get(containerId);
		if (!chunks) {
			chunks = [];
			this.#containerSchemaChunks.set(containerId, chunks);
		}
		const newChunks = schema.extractChunks();
		chunks.push(...newChunks);
	}

	private findDocumentSchemaChunks<TDoc extends UnknownStringRecord>(
		docRef: DocumentReference<TDoc>
	): DocumentSchemaChunk[] {
		const { containerId, refDocType } = docRef;
		const chunks = this.#containerSchemaChunks.get(containerId);
		if (!chunks || chunks.length === 0) {
			throw new Error(`Missing schema for container ${containerId}`);
		}
		if (!refDocType || Object.keys(refDocType).length === 0) {
			return chunks;
		}

		const result: DocumentSchemaChunk[] = [];

		// Helper function to recursively match properties
		const matchProperties = (
			currentChunks: DocumentSchemaChunk[],
			currentRefDocType: UnknownStringRecord
		): DocumentSchemaChunk[] => {
			const isScalarMatch = (propertyChunks: DocumentSchemaChunk[], refValue: unknown): boolean =>
				propertyChunks.some((propertyChunk) => {
					if (propertyChunk.type === 'literal') {
						return propertyChunk.value === refValue;
					} else if (propertyChunk.type === typeof refValue) {
						return true;
					}
					return false;
				});

			const isPropertyMatch = (
				chunk: DocumentSchemaChunk,
				refProperty: string,
				refValue: unknown
			): boolean => {
				const propertyChunks = chunk.properties?.[refProperty];
				if (!propertyChunks) {
					return false;
				}

				if (typeof refValue === 'object' && refValue !== null) {
					// Drill down recursively for nested objects
					const nestedMatchedChunks = matchProperties(
						propertyChunks,
						refValue as UnknownStringRecord
					);
					return nestedMatchedChunks.length > 0;
				}

				// Check scalar values
				return isScalarMatch(propertyChunks, refValue);
			};

			return currentChunks.filter((chunk) =>
				Object.entries(currentRefDocType).every(([refProperty, refValue]) =>
					isPropertyMatch(chunk, refProperty, refValue)
				)
			);
		};

		// Start matching from the top-level chunks
		result.push(...matchProperties(chunks, refDocType));

		return result;
	}

	private validateDocumentReference<TDoc extends UnknownStringRecord>(
		docRef: DocumentReference<TDoc>
	): void {
		// Check that vertex has schema
		const chunks = this.findDocumentSchemaChunks(docRef);
		if (!chunks || chunks.length === 0) {
			throw new Error(
				`Missing schema for container ${docRef.containerId} and refDocType ${stringify(docRef.refDocType)}`
			);
		}
	}

	private findPropertySchemaChunksForProperty(
		chunk: DocumentSchemaChunk,
		propertyPath: string
	): DocumentSchemaChunk[] {
		// We need to drill down the property path
		// and find the chunks that match the whole path
		let currentChunks = [chunk];
		const path = propertyPath.split('.');
		for (const property of path) {
			const foundChunks: DocumentSchemaChunk[] = [];
			for (const currentChunk of currentChunks) {
				if (!currentChunk.properties) {
					continue;
				}
				const propertyChunks = currentChunk.properties[property];
				if (!propertyChunks) {
					continue;
				}
				foundChunks.push(...propertyChunks);
			}
			if (foundChunks.length === 0) {
				return [];
			}
			currentChunks = foundChunks;
		}
		// If we reach here, we have found the property
		return currentChunks;
	}

	private findDocumentSchemaChunksForProperty(
		chunks: DocumentSchemaChunk[],
		propertyPath: string
	): DocumentSchemaChunk[] {
		// The return value is are the chunks from the provided chunks
		// that have propertyPath as a property
		const foundChunks: DocumentSchemaChunk[] = chunks.filter(
			(chunk) => this.findPropertySchemaChunksForProperty(chunk, propertyPath).length > 0
		);
		return foundChunks;
	}

	private validateConstraint<
		TReferencing extends UnknownStringRecord,
		TReferenced extends UnknownStringRecord
	>(
		referencing: DocumentReference<TReferencing>,
		constraint: Constraint<TReferencing, TReferenced>,
		referenced: DocumentReference<TReferenced>
	): void {
		// Check that all refProperties are present in the referencing schema
		// At least one chunk should have all refProperties
		const referencingChunks = this.findDocumentSchemaChunks(referencing);
		const referencedChunks = this.findDocumentSchemaChunks(referenced);
		// Ref properties can be . separated paths
		for (const refProperty of Object.entries(constraint.refProperties)) {
			const [referencingProperty, referencedProperty] = refProperty as [
				PropertyPaths<TReferencing>,
				PropertyPaths<TReferenced>
			];
			const foundReferencingChunks = this.findDocumentSchemaChunksForProperty(
				referencingChunks,
				referencingProperty
			);
			if (!foundReferencingChunks || foundReferencingChunks.length === 0) {
				throw new Error(
					`Failed to validate referencing constraint ${referencing.containerId}/${stringify(referencing.refDocType)}/${referencingProperty}: property not found`
				);
			}
			const foundReferencedChunks = this.findDocumentSchemaChunksForProperty(
				referencedChunks,
				referencedProperty
			);
			if (!foundReferencedChunks || foundReferencedChunks.length === 0) {
				throw new Error(
					`Failed to validate referenced constraint ${referenced.containerId}/${stringify(referenced.refDocType)}/${referencedProperty}: property not found`
				);
			}
		}
	}

	private constructDocRefVertex(
		reference: DocumentReference<UnknownStringRecord>
	): _ConstraintVertexWithId {
		const id = `${reference.containerId}/${stringify(reference.refDocType)}`;
		return {
			id,
			vertex: reference
		};
	}

	private constructAndFilterVertices(
		...vertices: _ConstraintVertexWithId[]
	): _ConstraintVertexWithId[] {
		return vertices.filter((v) => !this.#constraintsGraph.hasVertex(v.id));
	}

	public addConstraint<
		TReferencing extends UnknownStringRecord,
		TReferenced extends UnknownStringRecord
	>(
		referencing: DocumentReference<TReferencing>,
		constraint: Constraint<TReferencing, TReferenced>,
		referenced: DocumentReference<TReferenced>
	): void {
		// Validate first
		this.validateDocumentReference(referencing);
		this.validateDocumentReference(referenced);
		this.validateConstraint(referencing, constraint, referenced);

		// referenced = from, referencing = to
		const vfrom = this.constructDocRefVertex(referenced);
		const vto = this.constructDocRefVertex(referencing);
		const vertices = this.constructAndFilterVertices(vfrom, vto);
		this.#constraintsGraph.addVertices(...vertices);
		this.#constraintsGraph.addEdges({
			from: vfrom.id,
			to: vto.id,
			edge: constraint
		});
	}

	public addCompoundConstraint<TDoc extends UnknownStringRecord>(
		compound: DocumentReference<TDoc>,
		constraint: Constraint<TDoc, TDoc>
	): void {
		// Validate first
		this.validateDocumentReference(compound);
		this.validateConstraint(compound, constraint, compound);

		// referenced = from, referencing = to
		const vfrom = this.constructDocRefVertex(compound);
		const vto = { ...vfrom, id: `${vfrom.id}/compound` };
		const vertices = this.constructAndFilterVertices(vfrom, vto);
		this.#constraintsGraph.addVertices(...vertices);
		this.#constraintsGraph.addEdges({
			from: vfrom.id,
			to: vto.id,
			edge: constraint
		});
	}

	public validate(): void {
		// Check that there are no cycles in the graph
		const cycles = new CyclesDFS(this.#constraintsGraph);
		if (cycles.hasCycles()) {
			throw new Error(
				'Validation failed: cycles detected in the constraints graph, only acyclic graph is supported at the moment'
			);
		}
		// Now we need to validate cascade delete
		// We need to check that for each edge, that has cascadeDelete = true, all further edges are also cascadeDelete = true
		// Otherwise its an error
		const edgeIds = this.#constraintsGraph.getEdgeIds();
		const paths = new GraphPaths(this.#constraintsGraph);
		for (const edgeId of edgeIds) {
			const edge = this.#constraintsGraph.getEdge(edgeId);
			if (edge?.cascadeDelete !== true) {
				// Nothing to check
				continue;
			}
			// Check that all edges from this edge are also cascadeDelete = true
			const to = edgeId.to;
			const allPaths = [...paths.getPathsFrom(to)].filter((path) => path.length > 1);
			if (allPaths.length === 0) {
				// No paths from edge.to, nothing to check
				continue;
			}
			// Check that all paths have cascadeDelete = true down to the leaves
			const cascadeDeletePathsEdges = allPaths.map((path) => {
				const pathEdgeIds = path
					.map((vertexId, index) => {
						if (index === 0) {
							return undefined;
						}
						return { from: path[index - 1], to: vertexId } as EdgeId;
					})
					.filter((e) => e !== undefined);
				const cascadeDeleteEdges = pathEdgeIds.map(
					(edgeId) => this.#constraintsGraph.getEdge(edgeId)?.cascadeDelete ?? false
				);
				return cascadeDeleteEdges;
			});
			const cascadeDeletePaths = cascadeDeletePathsEdges.map((edges) =>
				edges.every((e) => e === true)
			);
			// Check that all edges in the path have cascadeDelete = true
			const allCascadeDelete = cascadeDeletePaths.every((e) => e === true);
			if (!allCascadeDelete) {
				// Find paths that are not cascadeDelete
				const invalidPaths = allPaths
					.map((path, index) => [path, index] as [string[], number])
					.filter((_, index) => cascadeDeletePaths[index] !== true)
					.map(
						([path, pathIndex]) =>
							[
								[edgeId.from, edge.cascadeDelete ?? false],
								...path.map((v, vertexIndex) => [
									v,
									cascadeDeletePathsEdges[pathIndex].length > vertexIndex
										? cascadeDeletePathsEdges[pathIndex][vertexIndex]
										: undefined
								])
							] as [string, boolean | undefined][]
					);
				const pathStrings = invalidPaths.map((path) =>
					path
						.map((e) => {
							if (e[1] === undefined) {
								return `${e[0]}`;
							}
							return `${e[0]}: delete=${e[1]}`;
						})
						.join(' -> ')
				);
				throw new Error(
					`Validation failed: cascadeDelete = true is not set for all edges in the path(s): ${pathStrings.join(
						', '
					)}. All edges in the path(s) must have cascadeDelete = true.`
				);
			}
		}
	}

	public build(): Constraints {
		this.validate();
		// Prepare data for fast access to the constraints
		// Map<ConstraintVertex, ConstraintEdge[][]>: Map all vertices to all paths from this vertex
		const constraintsMap: Map<_ConstraintVertexWithId, _ConstraintPathElement[][]> = new Map();
		const paths = new GraphPaths(this.#constraintsGraph);
		for (const vertexId of this.#constraintsGraph.getVertexIds()) {
			const vertex = this.#constraintsGraph.getVertex(vertexId)!;
			const allPaths = [...paths.getPathsFrom(vertexId)].filter((path) => path.length > 1);
			const allConstraints: _ConstraintPathElement[][] = allPaths.map((path) => {
				// Get all the edges in the path
				const pathEdgeIds = path
					.map((vertexId, index) => {
						if (index === 0) {
							return undefined;
						}
						return { from: path[index - 1], to: vertexId } as EdgeId;
					})
					.filter((e) => e !== undefined);
				return pathEdgeIds.map((edgeId) => ({
					referencedId: edgeId.from,
					referencingId: edgeId.to,
					referenced: this.#constraintsGraph.getVertex(edgeId.from)!,
					referencing: this.#constraintsGraph.getVertex(edgeId.to)!,
					constraint: this.#constraintsGraph.getEdge(edgeId)!
				}));
			});
			constraintsMap.set({ id: vertexId, vertex }, allConstraints);
		}
		return new Constraints(this.#constraintsGraph, constraintsMap);
	}
}
