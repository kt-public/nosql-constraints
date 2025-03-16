import { VertexId } from './vertex';

export type EdgeBody = Record<string, unknown>;
export type EdgeDefinition<Body extends EdgeBody> = {
  from: VertexId;
  to: VertexId;
  body: Body;
};
