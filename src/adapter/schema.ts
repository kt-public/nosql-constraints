export type DocumentSchemaChunkType =
	// primitive types
	| 'string'
	| 'number'
	| 'boolean'
	| 'date'
	| 'any'
	// special handling types
	| 'object'
	| 'array'
	| 'literal'
	| 'enum';

export type DocumentSchemaChunk = {
	path: string | undefined;
	type: DocumentSchemaChunkType;
	optional?: boolean;
	value?: unknown;
	default?: unknown;
	properties?: Record<string, DocumentSchemaChunk[]>;
};

export interface DocumentSchemaAdapter {
	extractChunks(): DocumentSchemaChunk[];
}
