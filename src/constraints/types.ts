import { PartialDeep } from 'type-fest';
import { UnknownStringRecord } from 'typesafe-utilities';

export type RefDocType<TDoc extends UnknownStringRecord> = PartialDeep<TDoc>;
export type Vertex = {
  containerId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  refDocType?: RefDocType<any>;
};
export type Edge = {
  cascadeDelete?: true;
};
