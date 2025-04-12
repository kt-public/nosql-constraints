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

class ZodAdapter implements DocumentSchemaAdapter {
  readonly #schema: ZodSchema;
  constructor(schema: ZodSchema) {
    this.#schema = schema;
  }
  extractChunks(): DocumentSchemaChunk[] {
    return extractChunks(undefined, undefined, this.#schema)[1];
  }
}

function extractChunks(
  propertyKey: string | undefined,
  propertyPath: string | undefined,
  schema: ZodSchema
): [string | undefined, DocumentSchemaChunk[]] {
  if (schema instanceof ZodUnion || schema instanceof ZodDiscriminatedUnion) {
    return [
      propertyKey,
      schema.options
        .map((option: ZodSchema) => extractChunks(propertyKey, propertyPath, option)[1])
        .flat()
    ];
  } else if (schema instanceof ZodObject) {
    return [propertyKey, [extractChunkFromObject(propertyPath, schema)]];
  } else if (schema instanceof ZodString) {
    return [propertyKey, [{ path: propertyPath, type: 'string' }]];
  } else if (schema instanceof ZodNumber) {
    return [propertyKey, [{ path: propertyPath, type: 'number' }]];
  } else if (schema instanceof ZodLiteral) {
    return [propertyKey, [{ path: propertyPath, type: 'literal', value: schema.value }]];
  } else if (schema instanceof ZodArray) {
    return [
      propertyKey ? `${propertyKey}[]` : '[]',
      extractChunksFromArray(propertyKey, propertyPath, schema)
    ];
  } else {
    throw new Error(`Unsupported schema type: ${schema.constructor.name}`);
  }
}

function extractChunkFromObject(
  propertyPath: string | undefined,
  schema: ZodObject<ZodRawShape>
): DocumentSchemaChunk {
  const properties: Record<string, DocumentSchemaChunk[]> = {};
  for (const [key, value] of Object.entries(schema.shape)) {
    const _propertyPath = propertyPath ? `${propertyPath}.${key}` : key;
    const [chunkPropertyKey, chunkPropertyValue] = extractChunks(key, _propertyPath, value);
    properties[chunkPropertyKey!] = chunkPropertyValue;
  }
  return {
    path: propertyPath,
    type: 'object',
    properties
  };
}

function extractChunksFromArray(
  propertyKey: string | undefined,
  propertyPath: string | undefined,
  schema: ZodArray<ZodTypeAny>
): DocumentSchemaChunk[] {
  const _propertyKey = propertyKey ? `${propertyKey}[]` : '[]';
  const _propertyPath = propertyPath ? `${propertyPath}[]` : '[]';
  const [, chunkPropertyValue] = extractChunks(_propertyKey, _propertyPath, schema.element);
  return chunkPropertyValue;
}
