import { frodo, state } from './lib/FrodoLib';
import { FrodoError } from './ops/FrodoError';

export * from './mcp';

// Main library exports
export { frodo, FrodoError, state };

// Flat (non-relationship) managed-object schema property support -- pure
// helpers and shared types for building/parsing/navigating a property
// definition, reused by consumers (e.g. frodo-cli) that need to preview a
// change before committing it via frodo.idm.managed.schema's orchestration
// functions. See ManagedObjectSchemaOps.ts's own doc comments for details.
export {
  buildManagedObjectSchemaPropertyPayload,
  extractManagedObjectSchemaPropertyFields,
  MANAGED_OBJECT_SCHEMA_CREATABLE_PROPERTY_TYPES,
  navigatePropertyPath,
  navigateToPropertyContainer,
  parseSubPropertyPath,
  removeSchemaProperty,
  setSchemaProperty,
  type ManagedObjectSchemaCreatablePropertyType,
  type ManagedObjectSchemaPropertyFields,
  type PropertyContainer,
} from './ops/ManagedObjectSchemaOps';

// Managed-object type-level (title/icon/description) create/update support
// -- pure helpers and shared types, reused the same way as the flat-property
// exports above. See ManagedObjectSchemaOps.ts's own doc comments.
export {
  buildManagedObjectTypeSchema,
  MANAGED_OBJECT_TYPE_DEFAULT_ICON,
  type ManagedObjectTypeFields,
} from './ops/ManagedObjectSchemaOps';

// Relationship-property support -- pure helpers and shared types, reused
// the same way as the flat-property exports above (e.g. so frodo-cli can
// build its own current/proposed preview before committing a change via
// frodo.idm.managed.schema's relationship-property orchestration
// functions). See ManagedObjectSchemaOps.ts's own doc comments.
export {
  buildManagedObjectSchemaRelationshipPropertyPayload,
  extractManagedObjectSchemaRelationshipPropertyFields,
  inferManagedObjectSchemaRelationshipReverseIdentity,
  toManagedObjectSchemaRelationshipReverseFields,
  type ManagedObjectSchemaRelationshipPropertyFields,
  type ManagedObjectSchemaRelationshipReverseFields,
} from './ops/ManagedObjectSchemaOps';
