export type VertexId = string;

export type VertexDefinition<Body> = {
  id: VertexId;
  adjacentTo: VertexId[];
  body?: Body;
};
