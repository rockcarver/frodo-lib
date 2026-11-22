// A .cts file (always CommonJS): resolves the `require` condition, so it reads index.d.cts.
import { frodo, state, type TreeSkeleton } from '@rockcarver/frodo-lib';

export const instance = frodo.createInstance({
  host: 'https://openam-matrix.example.com/am',
});
export const sharedState = state;
export type Tree = TreeSkeleton;
