/**
 * The list of the configuration types that can be pulled to a file set and pushed from one. It is one explicit list, kept
 * by hand, in the order that a pull and a push visit the types: a type is on it when the module that owns the type has
 * given it a descriptor, and this list names the descriptor. A module does not register itself. A test
 * (`ConfigTypeRegistry.unit.test.ts`) fails when a module of `src/ops` exports a function that starts with `pull` or `push`
 * and no descriptor names it.
 *
 * This module imports the owner modules of the types, for their descriptors, and the types of a descriptor, and nothing else:
 * no api module, no state and no utility. The checklist for a new type is in `CONTRIBUTE.md`.
 */
import { kbaConfigType } from './IdmConfigOps';
import type { ConfigTypeDescriptor } from './OpsTypes';

// the shape of a descriptor is declared in `OpsTypes.ts`, which the owner modules import too: the owner modules do not import
// this module, and no import cycle is left
export type { ConfigType, ConfigTypeDescriptor } from './OpsTypes';

/** The configuration types, in the order of a pull and a push. */
export const ConfigTypeRegistry: ConfigTypeDescriptor[] = [kbaConfigType];
