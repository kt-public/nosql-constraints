import _ from 'lodash';
import { DiGraph } from 'ya-digraph-js';
import { DocumentSchemaAdapter, DocumentSchemaChunk } from '../adapter/schema';

type RefDocTypeLiteral = string | number;
type RefDocType = Record<string, RefDocTypeLiteral>;

type Vertex = {
  containerId: string;
  refDocType?: RefDocType;
};
type Edge = {
  cascadeDelete?: true;
};
// const ReferencingPropertyNameRegex = /^(.+)(Id|Ids)$/;

type ContainerReference = {
  containerId: string;
};
// Constraint document -> document reference
type DocumentReference = ContainerReference & {
  refDocType?: RefDocType;
};
type Doc2DocConstraint = Edge & {
  refProperties: Record<string, string>;
};
// Constraint document -> partition reference
type PartitionReference = ContainerReference & {
  partitionKeyProperties: string[];
};
type PartitionReferenceConstraint = Doc2DocConstraint;
type DocCompoundConstraint = Edge & {
  compoundProperties: string[];
};

export class ConstraintFactory {
  #containerSchemaAdapters = new Map<string, DocumentSchemaAdapter[]>();
  #containerSchemaChunks = new Map<string, DocumentSchemaChunk[]>();
  readonly #constraintsGraph = new DiGraph<Vertex, Edge>();

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
    let currentChunks = this.#containerSchemaChunks.get(containerId);
    if (!currentChunks || currentChunks.length === 0) {
      throw new Error(`Missing schema for container ${containerId}`);
    }
    if (!partitionRef.partitionKeyProperties || partitionRef.partitionKeyProperties.length === 0) {
      return currentChunks;
    }
    // partitionKeys are the properties that need to be present in the schema
    // they can be . separated paths
    // Each partitionKeyProperty must be present in the document schema chunk
    for (const partitionKeyProperty of partitionRef.partitionKeyProperties) {
      currentChunks = this.findDocumentSchemaChunksForProperty(currentChunks, partitionKeyProperty);
      if (!currentChunks || currentChunks.length === 0) {
        break;
      }
    }
    return currentChunks;
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

  protected findPropertySchemaChunksForProperty(
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

  protected findDocumentSchemaChunksForProperty(
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
      const foundReferencingChunks = this.findDocumentSchemaChunksForProperty(
        referencingChunks,
        referencingProperty
      );
      if (!foundReferencingChunks || foundReferencingChunks.length === 0) {
        throw new Error(
          `Failed to validate referencing constraint ${referencing.containerId}/${JSON.stringify(referencing.refDocType)}/${referencingProperty}: property not found`
        );
      }
      const foundReferencedChunks = this.findDocumentSchemaChunksForProperty(
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
    const to = `${referencing.containerId}/${JSON.stringify(referencing.refDocType)}`;
    //const edgeId = `${from} -> ${JSON.stringify(constraint.refProperties)} -> ${to}`;
    this.#constraintsGraph.addVertices(
      { id: from, vertex: referenced },
      { id: to, vertex: referencing }
    );
    this.#constraintsGraph.addEdges({ from, to, edge: constraint });
  }

  protected validateDocCompoundConstraint(
    compound: DocumentReference,
    constraint: DocCompoundConstraint
  ): void {
    // Check that all compoundProperties are all present in all document schema chunks
    const compoundChunks = this.findDocumentSchemaChunks(compound);
    const allValid = compoundChunks.every((chunk) => {
      const allPresent = constraint.compoundProperties.every((compoundProperty) => {
        const foundChunks = this.findPropertySchemaChunksForProperty(chunk, compoundProperty);
        return foundChunks.length > 0;
      });
      return allPresent;
    });
    if (!allValid) {
      throw new Error(
        `Failed to validate compound constraint ${compound.containerId}/${JSON.stringify(
          compound.refDocType
        )}/${constraint.compoundProperties}: compound properties must be present in each of the referenced document schema chunks`
      );
    }
  }

  public addDocumentCompoundConstraint(
    compound: DocumentReference,
    constraint: DocCompoundConstraint
  ): void {
    // Validate first
    this.validateDocumentReference(compound);
    this.validateDocCompoundConstraint(compound, constraint);

    // referenced = from, referencing = to
    const from = `${compound.containerId}/${JSON.stringify(compound.refDocType)}`;
    const to = `${compound.containerId}/${JSON.stringify(compound.refDocType)}/compound`;
    //const edgeId = `${from} -> ${JSON.stringify(constraint.compoundProperties)} -> ${to}`;

    this.#constraintsGraph.addVertices(
      { id: from, vertex: compound },
      { id: to, vertex: compound }
    );
    this.#constraintsGraph.addEdges({ from, to, edge: constraint });
  }

  protected validatePartitionReference(partitionRef: PartitionReference): void {
    // Check that vertex has schema
    const chunks = this.findPartitionSchemaChunks(partitionRef);
    if (!chunks || chunks.length === 0) {
      throw new Error(`Missing schema for container ${partitionRef.containerId}`);
    }
    // found chunks must be exactly all of the chunks for the container -> all documents must contain the provided partition key properties
    const containerChunks = this.#containerSchemaChunks.get(partitionRef.containerId);
    if (!_.isEqual(chunks, containerChunks)) {
      throw new Error(
        `Partition key properties ${JSON.stringify(
          partitionRef.partitionKeyProperties
        )} do not match schema for container ${partitionRef.containerId}. All documents must contain the provided partition key properties.`
      );
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
    // Check that all referencing.partitionKeys are present in the constraint.refProperties.keys()
    const referencingKeys = new Set(Object.keys(constraint.refProperties));
    const refHasAllPartitionKeys = referencing.partitionKeyProperties.every((partitionKey) =>
      referencingKeys.has(partitionKey)
    );
    if (!refHasAllPartitionKeys) {
      throw new Error(
        `Failed to validate referencing constraint ${referencing.containerId}/${JSON.stringify(
          referencing.partitionKeyProperties
        )}: all of the partition keys must be present in the keys of the constraint.refProperties`
      );
    }

    const referencedChunks = this.findDocumentSchemaChunks(referenced);
    // Ref properties can be . separated paths
    for (const refProperty of Object.entries(constraint.refProperties)) {
      const [referencingProperty, referencedProperty] = refProperty;
      const foundReferencingChunks = this.findDocumentSchemaChunksForProperty(
        referencingChunks,
        referencingProperty
      );
      if (!foundReferencingChunks || foundReferencingChunks.length === 0) {
        throw new Error(
          `Failed to validate referencing constraint ${referencing.containerId}/${JSON.stringify(referencing.partitionKeyProperties)}/${referencingProperty}: property not found`
        );
      }
      const foundReferencedChunks = this.findDocumentSchemaChunksForProperty(
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

  public addPartition2DocumentConstraint(
    referencing: PartitionReference,
    constraint: PartitionReferenceConstraint,
    referenced: DocumentReference
  ): void {
    // Validate first
    this.validatePartitionReference(referencing);
    this.validateDocumentReference(referenced);
    this.validatePartition2DocConstraint(referencing, constraint, referenced);

    // referenced = from, referencing = to
    const from = `${referenced.containerId}/${JSON.stringify(referenced.refDocType)}`;
    const to = `${referencing.containerId}/${JSON.stringify(referencing.partitionKeyProperties)}`;
    //const edgeId = `${from} -> ${JSON.stringify(constraint.refProperties)} -> ${to}`;

    this.#constraintsGraph.addVertices(
      { id: from, vertex: referenced },
      { id: to, vertex: referencing }
    );
    this.#constraintsGraph.addEdges({ from, to, edge: constraint });
  }
}
