// Named imports: the root exports `frodo`, `state`, `FrodoError` and types.
import {
  frodo,
  FrodoError,
  state,
  type FullExportInterface,
  type TreeSkeleton,
} from '@rockcarver/frodo-lib';

export const tree: TreeSkeleton | undefined = undefined;
export const full: FullExportInterface | undefined = undefined;
export const instance = frodo.createInstance({
  host: 'https://openam-matrix.example.com/am',
  username: 'admin',
  password: 'secret',
});
export const tokens = instance.login.getTokens();
state.setHost('https://openam-matrix.example.com/am');
export const error: FrodoError = new FrodoError('x');
