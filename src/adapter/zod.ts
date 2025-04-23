import {
  ZodAny,
  ZodArray,
  ZodBoolean,
  ZodDate,
  ZodDefault,
  ZodDiscriminatedUnion,
  ZodEffects,
  ZodEnum,
  ZodLiteral,
  ZodNumber,
  ZodObject,
  ZodOptional,
  ZodRawShape,
  ZodSchema,
  ZodString,
  ZodType,
  ZodTypeAny,
  ZodUnion
} from 'zod';
import { DocumentSchemaAdapter, DocumentSchemaChunk, DocumentSchemaChunkType } from './schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _DocumentSchemaChunkType2ZodType: { [key: string]: typeof ZodType<any, any, any> } = {
  string: ZodString,
  number: ZodNumber,
  boolean: ZodBoolean,
  date: ZodDate,
  any: ZodAny
};

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
  // First check primitive types
  for (const primitiveType of Object.keys(_DocumentSchemaChunkType2ZodType)) {
    const zodType = _DocumentSchemaChunkType2ZodType[primitiveType];
    if (schema instanceof zodType) {
      return [
        propertyKey,
        [{ path: propertyPath, type: primitiveType as DocumentSchemaChunkType }]
      ];
    }
  }
  if (schema instanceof ZodUnion || schema instanceof ZodDiscriminatedUnion) {
    return [
      propertyKey,
      schema.options
        .map((option: ZodSchema) => extractChunks(propertyKey, propertyPath, option)[1])
        .flat()
    ];
  } else if (schema instanceof ZodObject) {
    return [propertyKey, [extractChunkFromObject(propertyPath, schema)]];
  } else if (schema instanceof ZodLiteral) {
    return [propertyKey, [{ path: propertyPath, type: 'literal', value: schema.value }]];
  } else if (schema instanceof ZodArray) {
    return [
      propertyKey ? `${propertyKey}[]` : '[]',
      extractChunksFromArray(propertyKey, propertyPath, schema)
    ];
  } else if (schema instanceof ZodOptional) {
    const [chunkPropertyKey, chunkPropertyValue] = extractChunks(
      propertyKey,
      propertyPath,
      schema.unwrap()
    );
    return [chunkPropertyKey, chunkPropertyValue.map((chunk) => ({ ...chunk, optional: true }))];
  } else if (schema instanceof ZodEnum) {
    return [
      propertyKey,
      [
        {
          path: propertyPath,
          type: 'enum',
          value: schema.options
        }
      ]
    ];
  } else if (schema instanceof ZodDefault) {
    const [chunkPropertyKey, chunkPropertyValue] = extractChunks(
      propertyKey,
      propertyPath,
      schema.removeDefault()
    );
    return [
      chunkPropertyKey,
      chunkPropertyValue.map((chunk) => ({ ...chunk, default: schema._def.defaultValue() }))
    ];
  } else if (schema instanceof ZodEffects) {
    const [chunkPropertyKey, chunkPropertyValue] = extractChunks(
      propertyKey,
      propertyPath,
      schema.innerType()
    );
    return [chunkPropertyKey, chunkPropertyValue];
  } else {
    throw new Error(
      `Unsupported schema type: ${schema.constructor.name} at ${propertyPath} with key ${propertyKey}`
    );
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
