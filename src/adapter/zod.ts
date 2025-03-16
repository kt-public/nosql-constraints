import { type ZodSchema } from 'zod';
import { DocumentSchemaAdapter, ReferencingDocumentChunk } from './interface';

export class ZodDocumentSchemaAdapter implements DocumentSchemaAdapter {
  #schema: ZodSchema;
  constructor(schema: ZodSchema) {
    this.#schema = schema;
  }
  findReferencingChunks(): ReferencingDocumentChunk {
    this.#schema.parse({});
    return {
      chunkType: 'object'
    };
  }
  findReferencingFields(): string[] {
    return [];
  }
}
