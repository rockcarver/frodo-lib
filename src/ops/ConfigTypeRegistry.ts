/**
 * The list of the configuration types that can be pulled to a file set and pushed from one. It is one explicit list, kept
 * by hand, in the order that a pull and a push visit the types: a type is on it when the module that owns the type has
 * given it a descriptor, and this list names the descriptor. A module does not register itself. A test
 * (`ConfigTypeRegistry.unit.test.ts`) fails when a module of `src/ops` exports a function that starts with `pull` or `push`
 * and no descriptor names it.
 *
 * This module imports the owner modules of the types, for their descriptors, and nothing else: no api module, no state and
 * no utility. The checklist for a new type is in `CONTRIBUTE.md`.
 */
import { kbaConfigType } from './IdmConfigOps';

/** A configuration type: its key. The keys are plain strings: the word that the type goes by, in lower case (`kba`). */
export type ConfigType = string;

/** A function of a configuration type: it takes what the type needs, and answers when it is done. */
type ConfigTypeFunction = (...args: never[]) => Promise<unknown>;

/**
 * What the registry knows about one configuration type. The module that owns the type writes it (one owner per type).
 */
export interface ConfigTypeDescriptor {
  /** The key of the type. */
  key: ConfigType;
  /** Whether the type lives once for the tenant (`global`) or once for every realm (`realm`). */
  scope: 'global' | 'realm';
  /** Whether the type is static configuration (what a promotion carries) or dynamic. */
  isStatic: boolean;
  /** The deployment types that offer the type. */
  deployments: ('cloud' | 'forgeops' | 'classic')[];
  /** The place of the type in an export: types are exported in ascending order. */
  exportOrder: number;
  /** The place of the type in an import: types are imported in ascending order, which need not be the export order. */
  importOrder: number;
  /** The function that exports the type, if it has one. */
  export?: ConfigTypeFunction;
  /** The function that imports the type, if it has one. */
  import?: ConfigTypeFunction;
  /** The function that pulls the type to a file set, if it has one. */
  pull?: ConfigTypeFunction;
  /** The function that pushes the type from a file set, if it has one. */
  push?: ConfigTypeFunction;
}

/** The configuration types, in the order of a pull and a push. */
export const ConfigTypeRegistry: ConfigTypeDescriptor[] = [kbaConfigType];
