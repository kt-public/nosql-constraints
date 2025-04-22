import _ from 'lodash';
import { type DeepPartial, type PropertyPaths } from 'typesafe-utilities';
import { DiGraph } from 'ya-digraph-js';
import { DocumentSchemaAdapter, DocumentSchemaChunk } from '../adapter/schema';

type RefDocType<TDoc extends Record<string, unknown>> = DeepPartial<TDoc>;

type Vertex = {
  containerId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  refDocType?: RefDocType<any>;
};
type Edge = {
  cascadeDelete?: true;
};

type ContainerReference = {
  containerId: string;
};
// Constraint document -> document reference
type DocumentReference<TDoc extends Record<string, unknown>> = ContainerReference & {
  refDocType?: RefDocType<TDoc>;
};
type Doc2DocConstraint<
  TReferencing extends Record<string, unknown>,
  TReferenced extends Record<string, unknown>
> = Edge & {
  refProperties: Partial<Record<PropertyPaths<TReferencing>, PropertyPaths<TReferenced>>>;
};
// Constraint document -> partition reference
type PartitionReference<TDoc extends Record<string, unknown>> = ContainerReference & {
  partitionKeyProperties: PropertyPaths<TDoc>[];
};
type PartitionReferenceConstraint<
  TReferencing extends Record<string, unknown>,
  TReferenced extends Record<string, unknown>
> = Doc2DocConstraint<TReferencing, TReferenced>;
type DocCompoundConstraint<TDoc extends Record<string, unknown>> = Edge & {
  compoundProperties: PropertyPaths<TDoc>[];
};

export class ConstraintFactory {
  readonly #containerSchemaAdapters = new Map<string, DocumentSchemaAdapter[]>();
  readonly #containerSchemaChunks = new Map<string, DocumentSchemaChunk[]>();
  readonly #constraintsGraph = new DiGraph<Vertex, Edge>();

  get constraintsGraph(): DiGraph<Vertex, Edge> {
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

  private findDocumentSchemaChunks<TDoc extends Record<string, unknown>>(
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
      currentRefDocType: Record<string, unknown>
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
            refValue as Record<string, unknown>
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

  private findPartitionSchemaChunks<TDoc extends Record<string, unknown>>(
    partitionRef: PartitionReference<TDoc>
  ): DocumentSchemaChunk[] {
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

  private validateDocumentReference<TDoc extends Record<string, unknown>>(
    docRef: DocumentReference<TDoc>
  ): void {
    // Check that vertex has schema
    const chunks = this.findDocumentSchemaChunks(docRef);
    if (!chunks || chunks.length === 0) {
      throw new Error(
        `Missing schema for container ${docRef.containerId} and refDocType ${JSON.stringify(docRef.refDocType)}`
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

  private validateDoc2DocConstraint<
    TReferencing extends Record<string, unknown>,
    TReferenced extends Record<string, unknown>
  >(
    referencing: DocumentReference<TReferencing>,
    constraint: Doc2DocConstraint<TReferencing, TReferenced>,
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

  public addDocument2DocumentConstraint<
    TReferencing extends Record<string, unknown>,
    TReferenced extends Record<string, unknown>
  >(
    referencing: DocumentReference<TReferencing>,
    constraint: Doc2DocConstraint<TReferencing, TReferenced>,
    referenced: DocumentReference<TReferenced>
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

  private validateDocCompoundConstraint<TDoc extends Record<string, unknown>>(
    compound: DocumentReference<TDoc>,
    constraint: DocCompoundConstraint<TDoc>
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

  public addDocumentCompoundConstraint<TDoc extends Record<string, unknown>>(
    compound: DocumentReference<TDoc>,
    constraint: DocCompoundConstraint<TDoc>
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

  private validatePartitionReference<TDoc extends Record<string, string>>(
    partitionRef: PartitionReference<TDoc>
  ): void {
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

  private validatePartition2DocConstraint<
    TReferencing extends Record<string, unknown>,
    TReferenced extends Record<string, unknown>
  >(
    referencing: PartitionReference<TReferencing>,
    constraint: PartitionReferenceConstraint<TReferencing, TReferenced>,
    referenced: DocumentReference<TReferenced>
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

  public addPartition2DocumentConstraint<
    TReferencing extends Record<string, unknown>,
    TReferenced extends Record<string, unknown>
  >(
    referencing: PartitionReference<TReferencing>,
    constraint: PartitionReferenceConstraint<TReferencing, TReferenced>,
    referenced: DocumentReference<TReferenced>
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
