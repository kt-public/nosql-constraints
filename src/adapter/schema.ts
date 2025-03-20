/**
 * Examples of how referencing properties could be named
 * {
 *   portfolioId: '123',
 * },
 * {
 *   accountIds: ['123', '456'],
 * },
 * {
 *   account: {
 *     accountId: '123',
 *   },
 * }
 * {
 *   accounts: [
 *     {
 *       accountId: '123',
 *     },
 *     {
 *       accountId: '456',
 *     }
 *   ]
 * },
 */

type DocumentSchemaChunkType =
  | 'object'
  | 'array'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'literal';
export interface DocumentSchemaChunk {
  path: string | undefined;
  type: DocumentSchemaChunkType;
  value?: unknown;
  properties?: Record<string, DocumentSchemaChunk[]>;
}
