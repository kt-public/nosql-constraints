export type ReferencingPropertyName = `${string}Id`;
export type ReferencingDocumentChunk = {
  type?: string;
  chunkType: 'object' | 'array';
} & {
  [key: ReferencingPropertyName]: undefined | ReferencingDocumentChunk;
};
export interface DocumentSchemaAdapter {
  findReferencingChunks(): ReferencingDocumentChunk;
  findReferencingFields(): string[];
}
