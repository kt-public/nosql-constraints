import { ZodLiteral, ZodNumber, ZodObject, ZodRawShape, ZodSchema, ZodString, ZodUnion } from 'zod';
import { DocumentSchemaChunk } from './schema';

export function zod(schema: ZodSchema): DocumentSchemaChunk[] {
  return extractChunks(schema, undefined);
}

function extractChunks(schema: ZodSchema, parentPath: string | undefined): DocumentSchemaChunk[] {
  if (schema instanceof ZodUnion) {
    return schema.options.map((option: ZodSchema) => extractChunks(option, parentPath)).flat();
  } else if (schema instanceof ZodObject) {
    return [extractChunkFromObject(schema, parentPath)];
  } else if (schema instanceof ZodString) {
    return [{ path: parentPath, type: 'string' }];
  } else if (schema instanceof ZodNumber) {
    return [{ path: parentPath, type: 'number' }];
  } else if (schema instanceof ZodLiteral) {
    return [{ path: parentPath, type: 'literal', value: schema.value }];
  } else {
    throw new Error('Unknown schema type');
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
