// The deep-import subpath ./types/* (frodo-cli uses it): it resolves only under moduleResolution node10.
import type { TreeSkeleton } from '@rockcarver/frodo-lib/types/api/TreeApi';

export type Tree = TreeSkeleton;
