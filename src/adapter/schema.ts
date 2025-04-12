type DocumentSchemaChunkType =
  | 'object'
  | 'array'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'literal';
export type DocumentSchemaChunk = {
  path: string | undefined;
  type: DocumentSchemaChunkType;
  value?: unknown;
  properties?: Record<string, DocumentSchemaChunk[]>;
};

export interface DocumentSchemaAdapter {
  extractChunks(): DocumentSchemaChunk[];
}
