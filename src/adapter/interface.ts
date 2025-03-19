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

export type ReferencingPropertyName = `${string}Id`;
export type ReferencingPropertyArrayName = `${string}Ids`;
export type ReferencingDocumentChunk = {
  // Literal properties - always constants, that identify the type of the document
  // e.g. type: 'portfolio' or type: 'account', countryCode: 'DE', accountType: 'statePension'
  [literal: string]: string;
} & {
  [referencingProperty: string]: undefined | ReferencingDocumentChunk;
};
export interface DocumentSchemaAdapter {
  findReferencingChunks(): ReferencingDocumentChunk;
  findReferencingFields(): string[];
}
