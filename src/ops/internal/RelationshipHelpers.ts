import {
  IdObjectSkeletonInterface,
  PatchOperationInterface,
} from '../../api/ApiTypes';
import { State } from '../../shared/State';
import { FrodoError } from '../FrodoError';

/**
 * Shared relationship-CRUD implementation for managed objects and managed
 * system objects. Both kinds of objects address relationship targets
 * identically (always under the managed/ collection) and only differ in
 * which read/patch primitive fetches or mutates the underlying object, so
 * that difference is injected as readObject/updateProperties rather than
 * duplicating this logic per object kind.
 */

/** A relationship target: the managed object type and id it points to, without any of the underlying _ref plumbing. */
export type RelationshipTarget = {
  type: string;
  id: string;
};

type ReadObjectFn = (args: {
  type: string;
  id: string;
  fields: string[];
  state: State;
}) => Promise<IdObjectSkeletonInterface>;

type UpdatePropertiesFn = (args: {
  type: string;
  id: string;
  operations: PatchOperationInterface[];
  rev?: string;
  state: State;
}) => Promise<IdObjectSkeletonInterface>;

/**
 * Builds the underlying { _ref, _refResourceCollection, _refResourceId }
 * shape IDM expects for a relationship reference in a "replace" operation,
 * so callers only ever need to think in plain { type, id } terms.
 * Relationship targets are always addressed under the managed/ collection
 * regardless of whether the object being patched is a regular managed
 * object or a managed system object.
 */
function buildRelationshipRefValue({ type, id }: RelationshipTarget): {
  _ref: string;
  _refResourceCollection: string;
  _refResourceId: string;
} {
  return {
    _ref: `managed/${type}/${id}`,
    _refResourceCollection: `managed/${type}`,
    _refResourceId: id,
  };
}

/**
 * Builds the minimal { _ref, _refProperties } shape an "add" operation
 * needs — captured directly from a real request AIC's own admin UI sends
 * for "add a role to this user", and verified live to work exactly as
 * shown. Deliberately not reusing buildRelationshipRefValue's shape:
 * "add" and "replace" turned out to want different value shapes, not
 * variations of the same one.
 */
function buildAddRelationshipValue({ type, id }: RelationshipTarget): {
  _ref: string;
  _refProperties: Record<string, never>;
} {
  return { _ref: `managed/${type}/${id}`, _refProperties: {} };
}

/** True if a stored relationship element refers to the given { type, id } target. */
function matchesRelationshipTarget(
  item: unknown,
  target: RelationshipTarget
): boolean {
  return (
    typeof item === 'object' &&
    item !== null &&
    (item as Record<string, unknown>)._refResourceCollection ===
      `managed/${target.type}` &&
    (item as Record<string, unknown>)._refResourceId === target.id
  );
}

/**
 * Reads the current value of a relationship field directly off the object —
 * the forward direction (e.g. an alpha_user's own `manager` or `roles`
 * field). For the reverse direction (e.g. an alpha_role's members), use
 * queryRelatedManagedObjects/queryRelatedManagedSystemObjects instead;
 * reverse relationships aren't stored as a field on the object at all, so
 * there's nothing here to read.
 */
export async function readRelationshipImpl({
  type,
  id,
  field,
  state,
  readObject,
}: {
  type: string;
  id: string;
  field: string;
  state: State;
  readObject: ReadObjectFn;
}): Promise<unknown> {
  const object = await readObject({ type, id, fields: [field], state });
  return object[field];
}

/**
 * Adds one target to a many-valued relationship field without disturbing
 * any existing members — the safe way to "add a member" (use
 * replaceRelationshipImpl instead only when you actually mean to overwrite
 * the whole field).
 *
 * @remarks
 * Uses the exact request shape captured from AIC's own admin UI performing
 * this action and verified live: field addressed as `/field/-` (JSON
 * Pointer append-to-array syntax, RFC 6902) with a bare (not array-wrapped)
 * { _ref, _refProperties: {} } value — not the field's own resourceCollection
 * fields.
 */
export async function addRelationshipImpl({
  type,
  id,
  field,
  target,
  rev,
  state,
  updateProperties,
}: {
  type: string;
  id: string;
  field: string;
  target: RelationshipTarget;
  rev?: string;
  state: State;
  updateProperties: UpdatePropertiesFn;
}): Promise<IdObjectSkeletonInterface> {
  return updateProperties({
    type,
    id,
    operations: [
      {
        operation: 'add',
        field: `/${field}/-`,
        value: buildAddRelationshipValue(target),
      },
    ],
    rev,
    state,
  });
}

/**
 * Removes one target from a many-valued relationship field without
 * disturbing any other members.
 *
 * @remarks
 * Reads the field's current value first to find the exact stored element,
 * then removes that exact object (not array-wrapped) — the request shape
 * captured directly from AIC's own admin UI performing this action and
 * verified live. Two things this gets exactly right that a naively-built
 * request gets wrong: the value must be the object matching what's
 * actually stored, _refProperties (an internal id/rev IDM itself generates
 * for the relationship, distinct from the referenced object's own id)
 * included — a freshly-built ref without it doesn't match and the request
 * is silently ignored; and unlike "add" (which needs its value array-
 * wrapped), "remove" needs a bare object, not an array containing one.
 * Throws if the target isn't currently a member, rather than silently
 * doing nothing the way a raw PATCH with a non-matching value would.
 */
export async function removeRelationshipImpl({
  type,
  id,
  field,
  target,
  rev,
  state,
  readObject,
  updateProperties,
}: {
  type: string;
  id: string;
  field: string;
  target: RelationshipTarget;
  rev?: string;
  state: State;
  readObject: ReadObjectFn;
  updateProperties: UpdatePropertiesFn;
}): Promise<IdObjectSkeletonInterface> {
  const currentValue = await readRelationshipImpl({
    type,
    id,
    field,
    state,
    readObject,
  });
  const currentArray = Array.isArray(currentValue)
    ? currentValue
    : currentValue
      ? [currentValue]
      : [];
  const matchingElement = currentArray.find((item) =>
    matchesRelationshipTarget(item, target)
  );
  if (!matchingElement) {
    throw new FrodoError(
      `Error removing relationship: ${target.type}/${target.id} is not currently a member of ${type}/${id}'s "${field}" field.`
    );
  }
  return updateProperties({
    type,
    id,
    operations: [
      {
        operation: 'remove',
        field: `/${field}`,
        value: matchingElement,
      },
    ],
    rev,
    state,
  });
}

/**
 * Replaces the entire value of a relationship field: a single target (or
 * null to clear it) for a single-valued field like 'manager', or an array
 * of targets for a many-valued field like 'roles' — replacing the whole
 * array, not adding to it. Use addRelationshipImpl/removeRelationshipImpl
 * instead when you only want to change one member of a many-valued field.
 */
export async function replaceRelationshipImpl({
  type,
  id,
  field,
  target,
  rev,
  state,
  updateProperties,
}: {
  type: string;
  id: string;
  field: string;
  target: RelationshipTarget | RelationshipTarget[] | null;
  rev?: string;
  state: State;
  updateProperties: UpdatePropertiesFn;
}): Promise<IdObjectSkeletonInterface> {
  const value =
    target === null
      ? null
      : Array.isArray(target)
        ? target.map(buildRelationshipRefValue)
        : buildRelationshipRefValue(target);
  return updateProperties({
    type,
    id,
    operations: [
      {
        operation: 'replace',
        field: `/${field}`,
        value,
      },
    ],
    rev,
    state,
  });
}
