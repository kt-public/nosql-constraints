import { DocumentSchemaAdapter, DocumentSchemaChunk } from "../adapter/schema";
import { DiGraph } from "../digraph";

type RefDocTypeLiteral = string | number | boolean | undefined | null;

type VertexProperties = {
  containerId: string;
  refDocType?: Record<string, RefDocTypeLiteral>;
}
type EdgeProperties = {
  cascadeDelete?: true;
  refProperties?: Record<string, string>;
}
// const ReferencingPropertyNameRegex = /^(.+)(Id|Ids)$/;

// Constraint document -> document reference
type DocumentReference = {
  containerId: string;
  refDocType?: Record<string, RefDocTypeLiteral>;
}
type DocumentReferenceConstraint = EdgeProperties & {
  refProperties: Record<string, string>;
};
// Constraint document -> partition reference
type PartitionReference = Omit<DocumentReference, 'refDocType'>;
type PartitionReferenceConstraint = DocumentReferenceConstraint;

export class ConstraintFactory {
  #containerSchemaAdapters = new Map<string, DocumentSchemaAdapter[]>();
  #containerSchemaChunks = new Map<string, DocumentSchemaChunk[]>();
  #vertexProperties = new Map<string, VertexProperties>();
  #edgeProperties = new Map<string, EdgeProperties>();
  #constraintGraph = new DiGraph();

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

  public addDocument2DocumentConstraint(referencing: DocumentReference, referenced: DocumentReference, constraint: DocumentReferenceConstraint): void {
    // referenced = from, referencing = to
    const from = `${referenced.containerId}/${JSON.stringify(referenced.refDocType)}`;
    this.#constraintGraph.addVertex({ id: from });
    this.#vertexProperties.set(from, referenced);

    const to = `${referencing.containerId}/${JSON.stringify(referencing.refDocType)}`;
    this.#constraintGraph.addVertex({ id: to });
    this.#vertexProperties.set(to, referencing);

    this.#constraintGraph.addEdge({ from, to });
    this.#edgeProperties.set(`${from} -> ${to}`, constraint);
  }

  public addPartition2DocumentConstraint(referencing: PartitionReference, referenced: DocumentReference, constraint: PartitionReferenceConstraint): void {
    // referenced = from, referencing = to
    const from = `${referenced.containerId}`;
    this.#constraintGraph.addVertex({ id: from });
    this.#vertexProperties.set(from, referenced);

    const to = `${referencing.containerId}/partition`;
    this.#constraintGraph.addVertex({ id: to });
    this.#vertexProperties.set(to, referencing);

    this.#constraintGraph.addEdge({ from, to });
    this.#edgeProperties.set(`${from} -> ${to}`, constraint);
  }
}