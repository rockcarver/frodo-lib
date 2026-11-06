import { IdObjectSkeletonInterface } from '../api/ApiTypes';
import { State } from '../shared/State';
import { debugMessage } from '../utils/Console';
import { FrodoError } from './FrodoError';
import { readConfigEntity, updateConfigEntity } from './IdmConfigOps';

export type StaticUserMapping = {
  /**
   * Read all static user mappings of the IDM authentication configuration
   * @returns {Promise<StaticUserMappingSkeleton[]>} a promise that resolves to an array of static user mappings (empty if there are none)
   */
  readStaticUserMappings(): Promise<StaticUserMappingSkeleton[]>;
  /**
   * Read the static user mapping of a subject. Fails if there is none.
   * @param {string} subject the subject (the `sub` of the access token, e.g. an OAuth2 client id)
   * @returns {Promise<StaticUserMappingSkeleton>} a promise that resolves to a static user mapping
   */
  readStaticUserMapping(subject: string): Promise<StaticUserMappingSkeleton>;
  /**
   * Create the static user mapping of a subject. Fails if the subject has one already.
   * @param {StaticUserMappingSkeleton} mapping the static user mapping
   * @returns {Promise<StaticUserMappingSkeleton>} a promise that resolves to the created static user mapping
   */
  createStaticUserMapping(
    mapping: StaticUserMappingSkeleton
  ): Promise<StaticUserMappingSkeleton>;
  /**
   * Update or create the static user mapping of a subject. An existing mapping
   * of the subject is replaced as given.
   * @param {StaticUserMappingSkeleton} mapping the static user mapping
   * @returns {Promise<StaticUserMappingSkeleton>} a promise that resolves to the written static user mapping
   */
  updateStaticUserMapping(
    mapping: StaticUserMappingSkeleton
  ): Promise<StaticUserMappingSkeleton>;
  /**
   * Make sure a subject has a static user mapping with at least the given roles,
   * and change nothing that is there already: a missing mapping is created, the
   * roles of an existing one are merged (never removed), other properties of an
   * existing mapping are kept, and nothing is written when there is nothing to
   * add. An existing mapping that names another local user (or another
   * `userRoles`) is not changed: that would point the subject at a different
   * identity, so the call fails, and `updateStaticUserMapping` is the explicit way.
   * @param {StaticUserMappingSkeleton} mapping the static user mapping to ensure
   * @returns {Promise<StaticUserMappingResult>} a promise that resolves to the resulting mapping and what was done
   */
  ensureStaticUserMapping(
    mapping: StaticUserMappingSkeleton
  ): Promise<StaticUserMappingResult>;
  /**
   * Delete the static user mapping of a subject. Fails if there is none. Other
   * mappings are not touched.
   * @param {string} subject the subject
   * @returns {Promise<StaticUserMappingSkeleton>} a promise that resolves to the deleted static user mapping
   */
  deleteStaticUserMapping(subject: string): Promise<StaticUserMappingSkeleton>;
};

export default (state: State): StaticUserMapping => {
  return {
    readStaticUserMappings(): Promise<StaticUserMappingSkeleton[]> {
      return readStaticUserMappings({ state });
    },
    readStaticUserMapping(subject: string): Promise<StaticUserMappingSkeleton> {
      return readStaticUserMapping({ subject, state });
    },
    createStaticUserMapping(
      mapping: StaticUserMappingSkeleton
    ): Promise<StaticUserMappingSkeleton> {
      return createStaticUserMapping({ mapping, state });
    },
    updateStaticUserMapping(
      mapping: StaticUserMappingSkeleton
    ): Promise<StaticUserMappingSkeleton> {
      return updateStaticUserMapping({ mapping, state });
    },
    ensureStaticUserMapping(
      mapping: StaticUserMappingSkeleton
    ): Promise<StaticUserMappingResult> {
      return ensureStaticUserMapping({ mapping, state });
    },
    deleteStaticUserMapping(
      subject: string
    ): Promise<StaticUserMappingSkeleton> {
      return deleteStaticUserMapping({ subject, state });
    },
  };
};

/**
 * The IDM config entity that holds the static user mappings
 */
const AUTHENTICATION_ENTITY = 'authentication';

/**
 * A static user mapping: it maps the `sub` of an access token (for example an
 * OAuth2 client id) to a local IDM user and roles, so that a client that
 * authenticates with a token acts as that user.
 */
export type StaticUserMappingSkeleton = {
  /**
   * The subject (the `sub` of the access token, e.g. an OAuth2 client id)
   */
  subject: string;
  /**
   * The local user the subject acts as, e.g. 'internal/user/openidm-admin'
   */
  localUser: string;
  /**
   * Where the user's roles come from, e.g. 'authzRoles/*'
   */
  userRoles?: string;
  /**
   * The roles the subject gets, e.g. 'internal/role/openidm-admin'
   */
  roles?: string[];
  // other properties of a mapping (e.g. executeAugmentationScript) are kept
  [key: string]: unknown;
};

/**
 * What `ensureStaticUserMapping` did
 */
export type StaticUserMappingResult = {
  mapping: StaticUserMappingSkeleton;
  outcome: 'created' | 'updated' | 'unchanged';
};

type AuthenticationEntity = IdObjectSkeletonInterface & {
  rsFilter?: {
    staticUserMapping?: StaticUserMappingSkeleton[];
    [key: string]: unknown;
  };
};

/**
 * Check a static user mapping before anything is written
 * @param {StaticUserMappingSkeleton} mapping the static user mapping
 */
function validateMapping(mapping: StaticUserMappingSkeleton): void {
  if (typeof mapping?.subject !== 'string' || mapping.subject === '') {
    throw new FrodoError(`A static user mapping needs a subject`);
  }
  if (typeof mapping.localUser !== 'string' || mapping.localUser === '') {
    throw new FrodoError(
      `The static user mapping of '${mapping.subject}' needs a localUser`
    );
  }
  if (
    mapping.roles !== undefined &&
    (!Array.isArray(mapping.roles) ||
      mapping.roles.some((role) => typeof role !== 'string' || role === ''))
  ) {
    throw new FrodoError(
      `The roles of the static user mapping of '${mapping.subject}' must be an array of role names`
    );
  }
  if (
    mapping.userRoles !== undefined &&
    (typeof mapping.userRoles !== 'string' || mapping.userRoles === '')
  ) {
    throw new FrodoError(
      `The userRoles of the static user mapping of '${mapping.subject}' must be a non-empty string`
    );
  }
}

async function readAuthentication(state: State): Promise<AuthenticationEntity> {
  return (await readConfigEntity({
    entityId: AUTHENTICATION_ENTITY,
    state,
  })) as AuthenticationEntity;
}

function mappingsOf(authentication: AuthenticationEntity) {
  const mappings = authentication?.rsFilter?.staticUserMapping;
  return Array.isArray(mappings) ? mappings : [];
}

/**
 * Write the list of mappings back into the authentication config entity. The
 * rest of the entity (every other property of `rsFilter` and of the entity)
 * is written back exactly as it was read.
 */
async function writeMappings({
  authentication,
  mappings,
  state,
}: {
  authentication: AuthenticationEntity;
  mappings: StaticUserMappingSkeleton[];
  state: State;
}): Promise<void> {
  if (
    !authentication?.rsFilter ||
    typeof authentication.rsFilter !== 'object'
  ) {
    throw new FrodoError(
      `The ${AUTHENTICATION_ENTITY} configuration has no rsFilter; not writing static user mappings into it`
    );
  }
  await updateConfigEntity({
    entityId: AUTHENTICATION_ENTITY,
    entityData: {
      ...authentication,
      rsFilter: { ...authentication.rsFilter, staticUserMapping: mappings },
    },
    state,
  });
}

/**
 * Read all static user mappings
 * @returns {Promise<StaticUserMappingSkeleton[]>} a promise that resolves to an array of static user mappings
 */
export async function readStaticUserMappings({
  state,
}: {
  state: State;
}): Promise<StaticUserMappingSkeleton[]> {
  try {
    return structuredClone(mappingsOf(await readAuthentication(state)));
  } catch (error) {
    throw new FrodoError(`Error reading static user mappings`, error);
  }
}

/**
 * Read the static user mapping of a subject
 * @param {string} subject the subject
 * @returns {Promise<StaticUserMappingSkeleton>} a promise that resolves to a static user mapping
 */
export async function readStaticUserMapping({
  subject,
  state,
}: {
  subject: string;
  state: State;
}): Promise<StaticUserMappingSkeleton> {
  const mapping = (await readStaticUserMappings({ state })).find(
    (m) => m.subject === subject
  );
  if (!mapping) {
    throw new FrodoError(`Static user mapping '${subject}' not found`);
  }
  return mapping;
}

/**
 * Create the static user mapping of a subject. Fails if it exists already.
 * @param {StaticUserMappingSkeleton} mapping the static user mapping
 * @returns {Promise<StaticUserMappingSkeleton>} a promise that resolves to the created static user mapping
 */
export async function createStaticUserMapping({
  mapping,
  state,
}: {
  mapping: StaticUserMappingSkeleton;
  state: State;
}): Promise<StaticUserMappingSkeleton> {
  validateMapping(mapping);
  debugMessage({
    message: `StaticUserMappingOps.createStaticUserMapping: start [subject=${mapping.subject}]`,
    state,
  });
  try {
    const authentication = await readAuthentication(state);
    const mappings = mappingsOf(authentication);
    if (mappings.some((m) => m.subject === mapping.subject)) {
      throw new FrodoError(
        `Static user mapping '${mapping.subject}' already exists!`
      );
    }
    const created = structuredClone(mapping);
    await writeMappings({
      authentication,
      mappings: [...mappings, created],
      state,
    });
    return created;
  } catch (error) {
    throw new FrodoError(
      `Error creating static user mapping '${mapping.subject}'`,
      error
    );
  }
}

/**
 * Update or create the static user mapping of a subject
 * @param {StaticUserMappingSkeleton} mapping the static user mapping
 * @returns {Promise<StaticUserMappingSkeleton>} a promise that resolves to the written static user mapping
 */
export async function updateStaticUserMapping({
  mapping,
  state,
}: {
  mapping: StaticUserMappingSkeleton;
  state: State;
}): Promise<StaticUserMappingSkeleton> {
  validateMapping(mapping);
  debugMessage({
    message: `StaticUserMappingOps.updateStaticUserMapping: start [subject=${mapping.subject}]`,
    state,
  });
  try {
    const authentication = await readAuthentication(state);
    const mappings = mappingsOf(authentication);
    const written = structuredClone(mapping);
    const exists = mappings.some((m) => m.subject === mapping.subject);
    await writeMappings({
      authentication,
      mappings: exists
        ? mappings.map((m) => (m.subject === mapping.subject ? written : m))
        : [...mappings, written],
      state,
    });
    return written;
  } catch (error) {
    throw new FrodoError(
      `Error updating static user mapping '${mapping.subject}'`,
      error
    );
  }
}

/**
 * Make sure a subject has a static user mapping with at least the given roles
 * @param {StaticUserMappingSkeleton} mapping the static user mapping to ensure
 * @returns {Promise<StaticUserMappingResult>} a promise that resolves to the resulting mapping and what was done
 */
export async function ensureStaticUserMapping({
  mapping,
  state,
}: {
  mapping: StaticUserMappingSkeleton;
  state: State;
}): Promise<StaticUserMappingResult> {
  validateMapping(mapping);
  debugMessage({
    message: `StaticUserMappingOps.ensureStaticUserMapping: start [subject=${mapping.subject}]`,
    state,
  });
  try {
    const authentication = await readAuthentication(state);
    const mappings = mappingsOf(authentication);
    const existing = mappings.find((m) => m.subject === mapping.subject);
    if (!existing) {
      const created = structuredClone(mapping);
      await writeMappings({
        authentication,
        mappings: [...mappings, created],
        state,
      });
      return { mapping: created, outcome: 'created' };
    }
    if (existing.localUser !== mapping.localUser) {
      throw new FrodoError(
        `Static user mapping '${mapping.subject}' exists and maps to '${existing.localUser}', not '${mapping.localUser}'; refusing to point the subject at another user (use updateStaticUserMapping to replace it)`
      );
    }
    if (
      existing.userRoles !== undefined &&
      mapping.userRoles !== undefined &&
      existing.userRoles !== mapping.userRoles
    ) {
      throw new FrodoError(
        `Static user mapping '${mapping.subject}' exists with userRoles '${existing.userRoles}', not '${mapping.userRoles}'; refusing to change where its roles come from (use updateStaticUserMapping to replace it)`
      );
    }
    const merged: StaticUserMappingSkeleton = structuredClone(existing);
    const roles = Array.isArray(existing.roles) ? [...existing.roles] : [];
    let changed = false;
    for (const role of mapping.roles ?? []) {
      if (!roles.includes(role)) {
        roles.push(role);
        changed = true;
      }
    }
    if (changed) {
      merged.roles = roles;
    }
    if (existing.userRoles === undefined && mapping.userRoles !== undefined) {
      merged.userRoles = mapping.userRoles;
      changed = true;
    }
    if (!changed) {
      return { mapping: merged, outcome: 'unchanged' };
    }
    await writeMappings({
      authentication,
      mappings: mappings.map((m) =>
        m.subject === mapping.subject ? merged : m
      ),
      state,
    });
    return { mapping: merged, outcome: 'updated' };
  } catch (error) {
    throw new FrodoError(
      `Error ensuring static user mapping '${mapping.subject}'`,
      error
    );
  }
}

/**
 * Delete the static user mapping of a subject. Fails if there is none.
 * @param {string} subject the subject
 * @returns {Promise<StaticUserMappingSkeleton>} a promise that resolves to the deleted static user mapping
 */
export async function deleteStaticUserMapping({
  subject,
  state,
}: {
  subject: string;
  state: State;
}): Promise<StaticUserMappingSkeleton> {
  if (typeof subject !== 'string' || subject === '') {
    throw new FrodoError(`A static user mapping needs a subject`);
  }
  debugMessage({
    message: `StaticUserMappingOps.deleteStaticUserMapping: start [subject=${subject}]`,
    state,
  });
  try {
    const authentication = await readAuthentication(state);
    const mappings = mappingsOf(authentication);
    const existing = mappings.find((m) => m.subject === subject);
    if (!existing) {
      throw new FrodoError(`Static user mapping '${subject}' not found`);
    }
    await writeMappings({
      authentication,
      mappings: mappings.filter((m) => m.subject !== subject),
      state,
    });
    return structuredClone(existing);
  } catch (error) {
    throw new FrodoError(
      `Error deleting static user mapping '${subject}'`,
      error
    );
  }
}
