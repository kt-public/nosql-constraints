import {
  ZodArray,
  ZodDiscriminatedUnion,
  ZodLiteral,
  ZodNumber,
  ZodObject,
  ZodRawShape,
  ZodSchema,
  ZodString,
  ZodTypeAny,
  ZodUnion
} from 'zod';
import { DocumentSchemaAdapter, DocumentSchemaChunk } from './schema';

export function zod(schema: ZodSchema): DocumentSchemaAdapter {
  return new ZodAdapter(schema);
}

export class ZodAdapter implements DocumentSchemaAdapter {
  #schema: ZodSchema;
  constructor(schema: ZodSchema) {
    this.#schema = schema;
  }
  extractChunks(): DocumentSchemaChunk[] {
    return extractChunks(this.#schema, undefined);
  }
}

function extractChunks(schema: ZodSchema, parentPath: string | undefined): DocumentSchemaChunk[] {
  if (schema instanceof ZodUnion) {
    return schema.options.map((option: ZodSchema) => extractChunks(option, parentPath)).flat();
  } else if (schema instanceof ZodDiscriminatedUnion) {
    return schema.options.map((option: ZodSchema) => extractChunks(option, parentPath)).flat();
  } else if (schema instanceof ZodObject) {
    return [extractChunkFromObject(schema, parentPath)];
  } else if (schema instanceof ZodString) {
    return [{ path: parentPath, type: 'string' }];
  } else if (schema instanceof ZodNumber) {
    return [{ path: parentPath, type: 'number' }];
  } else if (schema instanceof ZodLiteral) {
    return [{ path: parentPath, type: 'literal', value: schema.value }];
  } else if (schema instanceof ZodArray) {
    return [extractChunksFromArray(schema, parentPath)];
  } else {
    throw new Error(`Unsupported schema type: ${schema.constructor.name}`);
  }
}

function extractChunkFromObject(
  schema: ZodObject<ZodRawShape>,
  parentPath: string | undefined
): DocumentSchemaChunk {
  const properties: Record<string, DocumentSchemaChunk[]> = {};
  for (const [key, value] of Object.entries(schema.shape)) {
    const path = `${parentPath ? `${parentPath}.` : ''}${key}`;
    properties[key] = extractChunks(value, path);
  }
  return {
    path: parentPath,
    type: 'object',
    properties
  };
}

function extractChunksFromArray(
  schema: ZodArray<ZodTypeAny>,
  parentPath: string | undefined
): DocumentSchemaChunk {
  const path = parentPath ? `${parentPath}.[]` : '[]';
  return {
    path: parentPath,
    type: 'array',
    properties: {
      '[]': extractChunks(schema.element, path)
    }
  };
}
