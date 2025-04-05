import { DocumentSchemaAdapter, DocumentSchemaChunk } from '../adapter/schema';
import { DiGraph } from '../digraph';

type RefDocTypeLiteral = string | number;
type RefDocType = Record<string, RefDocTypeLiteral>;

type VertexProperties = {
  containerId: string;
  refDocType?: RefDocType;
};
type EdgeProperties = {
  cascadeDelete?: true;
  mapProperties?: Record<string, string>;
};
// const ReferencingPropertyNameRegex = /^(.+)(Id|Ids)$/;

type ContainerReference = {
  containerId: string;
};
// Constraint document -> document reference
type DocumentReference = ContainerReference & {
  refDocType?: RefDocType;
};
type Doc2DocConstraint = EdgeProperties & {
  refProperties: Record<string, string>;
};
// Constraint document -> partition reference
type PartitionReference = ContainerReference & {
  partitionKeyProperties: string[];
};
type PartitionReferenceConstraint = Doc2DocConstraint;

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

  protected findDocumentSchemaChunks(docRef: DocumentReference): DocumentSchemaChunk[] {
    const { containerId, refDocType } = docRef;
    const chunks = this.#containerSchemaChunks.get(containerId);
    if (!chunks || chunks.length === 0) {
      throw new Error(`Missing schema for container ${containerId}`);
    }
    if (!refDocType || Object.keys(refDocType).length === 0) {
      return chunks;
    }
    const result: DocumentSchemaChunk[] = [];
    for (const chunk of chunks) {
      const foundRefDocType: Record<string, boolean> = {};
      // Initialze foundRefDocType -> all properties are false
      for (const key of Object.keys(refDocType)) {
        foundRefDocType[key] = false;
      }

      for (const [refProperty, refValue] of Object.entries(refDocType)) {
        const schemaProperty = Object.entries(chunk.properties ?? {}).find(
          ([property, _chunks]) => {
            if (property !== refProperty) return false;
            // So the name matches, now we need to check the type
            // The refValue is the concrete value
            // the _chunks is the schema, describing the property, it can be a literal, union of literals, or a just a type
            // So we check if literal matches the refValue, or if the type matches the type of refValue
            for (const _chunk of _chunks) {
              if (_chunk.type === 'literal') {
                if (_chunk.value === refValue) {
                  return true;
                }
              } else if (_chunk.type === typeof refValue) {
                return true;
              }
            }
          }
        );
        if (!schemaProperty) {
          break;
        }
        foundRefDocType[refProperty] = true;
      }
      // Check if all properties are found
      const allFound = Object.values(foundRefDocType).every((value) => value);
      if (allFound) {
        result.push(chunk);
      }
    }
    return result;
  }

  protected findPartitionSchemaChunks(partitionRef: PartitionReference): DocumentSchemaChunk[] {
    const { containerId } = partitionRef;
    const chunks = this.#containerSchemaChunks.get(containerId);
    if (!chunks || chunks.length === 0) {
      throw new Error(`Missing schema for container ${containerId}`);
    }
    if (!partitionRef.partitionKeyProperties || partitionRef.partitionKeyProperties.length === 0) {
      return chunks;
    }
    const result: DocumentSchemaChunk[] = [];
    // partitionKeys are the properties that need to be present in the schema
    // they can be . separated paths
    for (const partitionKeyProperty of partitionRef.partitionKeyProperties) {
      const partitionChunks = this.findChunksForProperty(chunks, partitionKeyProperty);
      if (!partitionChunks || partitionChunks.length === 0) {
        break;
      }
      result.push(...partitionChunks);
    }
    return result;
  }

  protected validateDocumentReference(docRef: DocumentReference): void {
    // Check that vertex has schema
    const chunks = this.findDocumentSchemaChunks(docRef);
    if (!chunks || chunks.length === 0) {
      throw new Error(
        `Missing schema for container ${docRef.containerId} and refDocType ${JSON.stringify(docRef.refDocType)}`
      );
    }
  }

  protected findChunksForProperty(
    chunks: DocumentSchemaChunk[],
    propertyPath: string
  ): DocumentSchemaChunk[] | undefined {
    // We need to drill down the property path
    // and find the chunks that match the whole path
    const path = propertyPath.split('.');
    let foundChunks: DocumentSchemaChunk[] = [];
    let currentChunks = chunks;
    for (const property of path) {
      foundChunks = [];
      for (const chunk of currentChunks) {
        if (!chunk.properties) {
          continue;
        }
        const propertyChunks = chunk.properties[property];
        if (!propertyChunks) {
          continue;
        }
        foundChunks.push(...propertyChunks);
      }
      if (foundChunks.length === 0) {
        return undefined;
      }
      currentChunks = foundChunks;
    }
    return foundChunks;
  }

  protected validateDoc2DocConstraint(
    referencing: DocumentReference,
    constraint: Doc2DocConstraint,
    referenced: DocumentReference
  ): void {
    // Check that all refProperties are present in the referencing schema
    // At least one chunk should have all refProperties
    const referencingChunks = this.findDocumentSchemaChunks(referencing);
    const referencedChunks = this.findDocumentSchemaChunks(referenced);
    // Ref properties can be . separated paths
    for (const refProperty of Object.entries(constraint.refProperties)) {
      const [referencingProperty, referencedProperty] = refProperty;
      const foundReferencingChunks = this.findChunksForProperty(
        referencingChunks,
        referencingProperty
      );
      if (!foundReferencingChunks || foundReferencingChunks.length === 0) {
        throw new Error(
          `Failed to validate referencing constraint ${referencing.containerId}/${JSON.stringify(referencing.refDocType)}/${referencingProperty}: property not found`
        );
      }
      const foundReferencedChunks = this.findChunksForProperty(
        referencedChunks,
        referencedProperty
      );
      if (!foundReferencedChunks || foundReferencedChunks.length === 0) {
        throw new Error(
          `Failed to validate referenced constraint ${referenced.containerId}/${JSON.stringify(referenced.refDocType)}/${referencedProperty}: property not found`
        );
      }
    }
  }

  public addDocument2DocumentConstraint(
    referencing: DocumentReference,
    constraint: Doc2DocConstraint,
    referenced: DocumentReference
  ): void {
    // Validate first
    this.validateDocumentReference(referencing);
    this.validateDocumentReference(referenced);
    this.validateDoc2DocConstraint(referencing, constraint, referenced);

    // referenced = from, referencing = to
    const from = `${referenced.containerId}/${JSON.stringify(referenced.refDocType)}`;
    this.#constraintGraph.addVertex({ id: from });
    this.#vertexProperties.set(from, referenced);

    const to = `${referencing.containerId}/${JSON.stringify(referencing.refDocType)}`;
    this.#constraintGraph.addVertex({ id: to });
    this.#vertexProperties.set(to, referencing);

    // Check that the edge does not already exist
    const edgeId = `${from} -> ${JSON.stringify(constraint.refProperties)} -> ${to}`;
    if (this.#edgeProperties.has(edgeId)) {
      throw new Error(`Edge ${edgeId} already exists`);
    }
    this.#constraintGraph.addEdge({ from, to });
    this.#edgeProperties.set(edgeId, constraint);
  }

  protected validatePartitionReference(partitionRef: PartitionReference): void {
    // Check that vertex has schema
    const chunks = this.findPartitionSchemaChunks(partitionRef);
    if (!chunks || chunks.length === 0) {
      throw new Error(`Missing schema for container ${partitionRef.containerId}`);
    }
  }

  protected validatePartition2DocConstraint(
    referencing: PartitionReference,
    constraint: PartitionReferenceConstraint,
    referenced: DocumentReference
  ): void {
    // Check that all partitionKeyProperties are present in the referencing schema
    // At least one chunk should have all partitionKeyProperties
    const referencingChunks = this.findPartitionSchemaChunks(referencing);
    const referencedChunks = this.findDocumentSchemaChunks(referenced);
  }

  public addPartition2DocumentConstraint(
    referencing: PartitionReference,
    constraint: PartitionReferenceConstraint,
    referenced: DocumentReference
  ): void {
    // Validate first
    this.validatePartitionReference(referencing);
    this.validateDocumentReference(referenced);
    this.validatePartition2DocConstraint(referencing, referenced, constraint);

    // referenced = from, referencing = to
    const from = `${referenced.containerId}`;
    this.#constraintGraph.addVertex({ id: from });
    this.#vertexProperties.set(from, referenced);

    const to = `${referencing.containerId}/partition`;
    this.#constraintGraph.addVertex({ id: to });
    this.#vertexProperties.set(to, referencing);

    // Check that the edge does not already exist
    const edgeId = `${from} -> ${to}`;
    if (this.#edgeProperties.has(edgeId)) {
      throw new Error(`Edge ${edgeId} already exists`);
    }
    this.#constraintGraph.addEdge({ from, to });
    this.#edgeProperties.set(edgeId, constraint);
  }
}
