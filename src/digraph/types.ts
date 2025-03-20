export type VertexId = string;

export type VertexBody = Record<string, unknown> | undefined;
export type EdgeBody = Record<string, unknown> | undefined;

export type VertexDefinition<VBody extends VertexBody, EBody extends EdgeBody> = {
  id: VertexId;
  adjacentTo: Record<VertexId, EBody>;
  body?: VBody;
};
export type EdgeId = {
  from: VertexId;
  to: VertexId;
};
export type EdgeDefinition<Body extends EdgeBody> = EdgeId & {
  body?: Body;
};
