import { IdObjectSkeletonInterface } from '../api/ApiTypes';
import { putConfigEntity } from '../api/IdmConfigApi';
import Constants from '../shared/Constants';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { FrodoError, isNotFoundError } from './FrodoError';
import {
  deleteConfigEntity,
  readConfigEntitiesByType,
  readConfigEntity,
} from './IdmConfigOps';
import {
  readApplicationsOfAllRealms,
  type ApplicationRecords,
} from './internal/ApplicationRecords';
import {
  defineReferenceSource,
  findReferencesForIds,
  type ReferenceLookupResult,
  type ReferenceSource,
} from './internal/ReferenceLookup';
import {
  ExportMetaData,
  ResultCallback,
  type ObjectReference,
} from './OpsTypes';

export type Mapping = {
  /**
   * Create an empty mapping export template
   * @returns {MappingExportInterface} an empty mapping export template
   */
  createMappingExportTemplate(): MappingExportInterface;
  /**
   * Read mappings from sync.json (legacy)
   * @returns {Promise<MappingSkeleton[]>} a promise that resolves to an array of mapping objects
   */
  readSyncMappings(): Promise<MappingSkeleton[]>;
  /**
   * Read mappings
   * @param {string} connectorId limit mappings to connector
   * @param {string} moType limit mappings to managed object type
   * @returns {Promise<MappingSkeleton[]>} a promise that resolves to an array of mapping objects
   */
  readMappings(
    connectorId?: string,
    moType?: string
  ): Promise<MappingSkeleton[]>;
  /**
   * Read mapping
   * @param {string} mappingId id of the mapping (new: 'mapping/\<name>', legacy: 'sync/\<name>')
   * @returns {Promise<MappingSkeleton>} a promise that resolves an mapping object
   */
  readMapping(mappingId: string): Promise<MappingSkeleton>;
  /**
   * Create mapping
   * @param {string} mappingId id of the mapping (new: 'mapping/\<name>', legacy: 'sync/\<name>')
   * @param {MappingSkeleton} mappingData mapping object
   * @returns {Promise<MappingSkeleton>} a promise that resolves to an mapping object
   */
  createMapping(
    mappingId: string,
    mappingData: MappingSkeleton
  ): Promise<MappingSkeleton>;
  /**
   * Update or create mapping
   * @param {string} mappingId id of the mapping (new: 'mapping/\<name>', legacy: 'sync/\<name>')
   * @param {MappingSkeleton} mappingData mapping object
   * @returns {Promise<MappingSkeleton>} a promise that resolves to an mapping object
   */
  updateMapping(
    mappingId: string,
    mappingData: MappingSkeleton
  ): Promise<MappingSkeleton>;
  /**
   * Update or create mappings in sync.json (legacy). The array is written as the `mappings` of the `sync` configuration object with an update (PUT) request, which replaces that object: a mapping that the array leaves out is not kept.
   * @param {MappingSkeleton[]} mappings array of mapping objects
   * @returns {Promise<MappingSkeleton[]>} a promise that resolves to an array of mapping objects
   */
  updateSyncMappings(mappings: MappingSkeleton[]): Promise<MappingSkeleton[]>;
  /**
   * Delete all mappings, or only the mappings of a connector and/or a managed object type. With both, only the mappings that belong to both are deleted. Every selected mapping is tried: a mapping that cannot be deleted does not stop the others. Mappings that are not selected are left alone.
   * @param {string} connectorId limit mappings to connector
   * @param {string} moType limit mappings to managed object type
   * @param {ResultCallback<MappingSkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every delete is passed to it as it happens (a failed delete as an error that names the mapping) and a failed delete does not throw. Without it, the failures are collected and thrown as one error after every mapping was tried. Failing to read the mappings always throws.
   * @returns {Promise<MappingSkeleton[]>} a promise that resolves to an array of the deleted mapping objects
   * @throws {FrodoError} If the mappings cannot be read (always), or if one or more mappings cannot be deleted and there is no result callback. The error carries one nested error per failed mapping, naming it.
   */
  deleteMappings(
    connectorId?: string,
    moType?: string,
    resultCallback?: ResultCallback<MappingSkeleton>
  ): Promise<MappingSkeleton[]>;
  /**
   * Delete mapping
   * @param {string} mappingId id of the mapping (new: 'mapping/\<name>', legacy: 'sync/\<name>')
   * @returns {Promise<MappingSkeleton>} a promise that resolves an mapping object
   */
  deleteMapping(mappingId: string): Promise<MappingSkeleton>;
  /**
   * Export mapping
   * @param {string} mappingId id of the mapping (new: 'mapping/\<name>', legacy: 'sync/\<name>')
   * @param {MappingExportOptions} options export options
   * @returns {Promise<MappingExportInterface>} a promise that resolves to a MappingExportInterface object
   */
  exportMapping(
    mappingId: string,
    options?: MappingExportOptions
  ): Promise<MappingExportInterface>;
  /**
   * Export all mappings
   * @param {MappingExportOptions} options export options
   * @returns {Promise<MappingExportInterface>} a promise that resolves to a MappingExportInterface object
   */
  exportMappings(
    options?: MappingExportOptions
  ): Promise<MappingExportInterface>;
  /**
   * Import mapping
   * @param {string} mappingId id of the mapping (new: 'mapping/\<name>', legacy: 'sync/\<name>')
   * @param {MappingExportInterface} importData import data
   * @param {MappingImportOptions} options import options
   * @returns {Promise<MappingSkeleton>} a promise resolving to a MappingSkeleton object
   */
  importMapping(
    mappingId: string,
    importData: MappingExportInterface,
    options?: MappingImportOptions
  ): Promise<MappingSkeleton>;
  /**
   * Import first mapping
   * @param {MappingExportInterface} importData import data
   * @param {MappingImportOptions} options import options
   * @returns {Promise<MappingSkeleton>} a promise resolving to a MappingSkeleton object
   */
  importFirstMapping(
    importData: MappingExportInterface,
    options?: MappingImportOptions
  ): Promise<MappingSkeleton>;
  /**
   * Import all mappings. Every mapping is tried: a mapping that cannot be imported does not stop the others.
   * @param {MappingExportInterface} importData import data
   * @param {MappingImportOptions} options import options
   * @param {ResultCallback<MappingSkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every mapping is passed to it as it happens (a failed mapping as an error that names the mapping and carries the cause) and a failed mapping does not throw: the mappings that were imported are returned. Without it, the failures are collected and thrown as one error after every mapping was tried.
   * @returns {Promise<MappingSkeleton[]>} a promise resolving to an array of MappingSkeleton objects
   * @throws {FrodoError} If one or more mappings cannot be imported and there is no result callback. The error carries one nested error per failed mapping.
   */
  importMappings(
    importData: MappingExportInterface,
    options?: MappingImportOptions,
    resultCallback?: ResultCallback<MappingSkeleton>
  ): Promise<MappingSkeleton[]>;
  /**
   * Helper that returns a boolean indicating whether the mapping is a legacy mapping or not given the id
   * @param {string} mappingId the mapping id
   * @returns {boolean} true if the mapping is a legacy mapping, false otherwise
   * @throws {FrodoError} if the id is invalid
   */
  isLegacyMapping(mappingId: string): boolean;
  /**
   * Find what still names a mapping, in the whole tenant, before it is deleted. The mapping is given by its name, without the `sync/` or `mapping/` prefix. Every source is read once, together, and the answer is joined in memory: the other mappings (a `links` that equals the name, which reuses the links of this mapping, or a `syncAfter` that lists it, in the `sync` configuration and in the `mapping/` configurations; a mapping is never a holder of itself, and a mapping that is stored in both places is one reference per field, not two), the schedules (`invokeContext.mapping` equal to the name) and the applications of every realm (`mappingNames`). Applications exist on Cloud and ForgeOps only: they are read there, in every realm and without switching the active realm, and a classic deployment is sent no request for them. That is about six requests on Cloud with two realms (one more for each further realm; three on a classic deployment) however many names are looked up. The mapping does not have to exist, so the same call after a delete lists what now points at nothing. Each reference has a source (`mapping`, `schedule` or `application`), a dependency flag, the id of the holder (`sync/<name>` or `mapping/<name>` for a mapping, `schedule/<name>`, the id of the application with its `realm`) and `from`, the field that holds the name (`links`, `syncAfter`, `invokeContext.mapping`, `mappingNames`); a mapping and an application also have their name. The flag is `hard` for a schedule, an application and a `links` (the holder needs the mapping to do its work) and `soft` for a `syncAfter` (it only puts the holders in order). It says what the holder needs, not what the platform does when the mapping is deleted, which this lookup does not say. The answer is ordered by source, then by id and field. Not read, and so not seen: scripts and endpoints that name a mapping, the link tables, running or past reconciliations, the order of the entries of the `sync` configuration (it is not read as a `syncAfter`: only an entry that lists the name in a `syncAfter` of its own is a holder), other tenants and environments; also an entry of the `sync` configuration that has no `name` (it cannot be addressed, so it is left out even when it names the mapping). An empty list is never proof that a mapping is unused: it means only that none of those sources names it. Fails closed: if any source cannot be read in full, every source is still attempted and one error is thrown that names each source that failed; there is no partial list. A source that is not there (no `sync` configuration, a realm without applications) is none, not a failure. Read-only. A caller that holds a value that is either one name or a list calls the form that fits it (`Array.isArray` tells which): the two forms answer differently, so the facade has no single signature for the union.
   * @param {string} mappingName name of the mapping, without the type prefix
   * @returns {Promise<MappingReference[]>} a promise that resolves to every reference found
   */
  findMappingReferences(mappingName: string): Promise<MappingReference[]>;
  /**
   * The same lookup for a list of mappings, with one set of reads whatever the number of names. This form does not fail when a source cannot be read: it answers with what it found and names the sources it could not read in `unreadable`, so that a caller can list the holders it found and say what it could not check (an empty `unreadable` means every source was read). `references` is an object with one entry per distinct name, and a name that nothing names has an empty list; read it by key, because an object does not promise the order of its keys (JavaScript lists keys that look like integers first). It has no prototype, so a name such as `__proto__` is a plain key. An empty list is answered with an empty result and no request. A blank or non-string name in the list throws before anything is read. A mapping that is looked up is not reported as a holder of itself, and a holder that is another mapping of the same list is reported like any other. Everything the single form says about what is read and not seen holds here too, and an empty list for a name is never proof that the mapping is unused.
   * @param {string[]} mappingNames names of the mappings, without the type prefix
   * @returns {Promise<object>} a promise that resolves to an object with `references` (the references to each name, as the single form returns them) and `unreadable` (the sources that could not be read)
   */
  findMappingReferences(
    mappingNames: string[]
  ): Promise<
    ReferenceLookupResult<MappingReference['source'], MappingReference>
  >;
};

export default (state: State): Mapping => {
  return {
    createMappingExportTemplate(): MappingExportInterface {
      return createMappingExportTemplate({ state });
    },
    async readSyncMappings(): Promise<MappingSkeleton[]> {
      return readSyncMappings({ state });
    },
    async readMappings(
      connectorId: string = undefined,
      moType: string = undefined
    ): Promise<any> {
      return readMappings({ connectorId, moType, state });
    },
    async readMapping(mappingId: string): Promise<any> {
      return readMapping({ mappingId, state });
    },
    async createMapping(
      mappingId: string,
      mappingData: MappingSkeleton
    ): Promise<any> {
      return createMapping({
        mappingId,
        mappingData,
        state,
      });
    },
    async updateMapping(
      mappingId: string,
      mappingData: MappingSkeleton
    ): Promise<MappingSkeleton> {
      return updateMapping({
        mappingId,
        mappingData,
        state,
      });
    },
    async updateSyncMappings(
      mappings: MappingSkeleton[]
    ): Promise<MappingSkeleton[]> {
      return updateLegacyMappings({
        mappings,
        state,
      });
    },
    async deleteMappings(
      connectorId: string = undefined,
      moType: string = undefined,
      resultCallback: ResultCallback<MappingSkeleton> = undefined
    ): Promise<MappingSkeleton[]> {
      return deleteMappings({ connectorId, moType, resultCallback, state });
    },
    async deleteMapping(mappingId: string): Promise<MappingSkeleton> {
      return deleteMapping({ mappingId, state });
    },
    async exportMapping(
      mappingId: string,
      options: MappingExportOptions = { deps: true, useStringArrays: true }
    ): Promise<MappingExportInterface> {
      return exportMapping({ mappingId, options, state });
    },
    async exportMappings(
      options: MappingExportOptions = { deps: true, useStringArrays: true }
    ): Promise<MappingExportInterface> {
      return exportMappings({ options, state });
    },
    async importMapping(
      mappingId: string,
      importData: MappingExportInterface,
      options?: MappingImportOptions
    ): Promise<MappingSkeleton> {
      return importMapping({ mappingId, importData, options, state });
    },
    async importFirstMapping(
      importData: MappingExportInterface,
      options?: MappingImportOptions
    ): Promise<MappingSkeleton> {
      return importFirstMapping({ importData, options, state });
    },
    async importMappings(
      importData: MappingExportInterface,
      options?: MappingImportOptions,
      resultCallback: ResultCallback<MappingSkeleton> = undefined
    ): Promise<MappingSkeleton[]> {
      return importMappings({ importData, options, resultCallback, state });
    },
    isLegacyMapping,
    // one name answers a list, a list of names answers an object: the
    // overloads of the type say which, this delegates both to the one function
    findMappingReferences: (async (mappingNames: string | string[]) =>
      findMappingReferences({
        mappingNames,
        state,
      })) as Mapping['findMappingReferences'],
  };
};

/**
 * One place that names a mapping, found by {@link findMappingReferences}: a
 * schedule that reconciles it (`hard`), an application that owns it (`hard`),
 * or another mapping that reuses its links (`links`, `hard`) or runs after it
 * (`syncAfter`, `soft`). `id` is the id of the holder (`sync/<name>` or
 * `mapping/<name>` for a mapping, `schedule/<name>`, the id of the application
 * with its `realm`), `from` is the field that holds the name. An empty answer
 * is never proof that a mapping is unused, see {@link findMappingReferences}.
 */
export type MappingReference = ObjectReference<
  'mapping' | 'schedule' | 'application'
>;

export type MappingPolicy = {
  action: 'CREATE' | 'DELETE' | 'EXCEPTION' | 'IGNORE' | 'UPDATE';
  situation:
    | 'ABSENT'
    | 'ALL_GONE'
    | 'AMBIGUOUS'
    | 'CONFIRMED'
    | 'FOUND'
    | 'FOUND_ALREADY_LINKED'
    | 'LINK_ONLY'
    | 'MISSING'
    | 'SOURCE_IGNORED'
    | 'SOURCE_MISSING'
    | 'TARGET_IGNORED'
    | 'UNASSIGNED'
    | 'UNQUALIFIED';
};

export type MappingProperty = {
  source?: string;
  target: string;
  transform?: {
    globals: any;
    source: string;
    type: string;
  };
};

export type MappingSkeleton = IdObjectSkeletonInterface & {
  name: string;
  displayName?: string;
  linkQualifiers?: string[];
  consentRequired?: boolean;
  policies?: MappingPolicy[];
  properties?: MappingProperty[];
  source?: string;
  target?: string;
  syncAfter?: string[];
};

export type SyncSkeleton = IdObjectSkeletonInterface & {
  mappings: MappingSkeleton[];
};

export interface MappingExportInterface {
  meta?: ExportMetaData;
  mapping: Record<string, MappingSkeleton>;
  sync: SyncSkeleton;
}

/**
 * Mapping export options
 */
export interface MappingExportOptions {
  /**
   * Use string arrays to store multi-line text in scripts.
   */
  useStringArrays: boolean;
  /**
   * Include any dependencies.
   */
  deps: boolean;
  /**
   * limit mappings to connector
   */
  connectorId?: string;
  /**
   * limit mappings to managed object type
   */
  moType?: string;
}

/**
 * Mapping import options
 */
export interface MappingImportOptions {
  /**
   * Include any dependencies.
   */
  deps: boolean;
}

export function createMappingExportTemplate({
  state,
}: {
  state: State;
}): MappingExportInterface {
  return {
    meta: getMetadata({ state }),
    mapping: {},
    sync: {
      _id: 'sync',
      mappings: [],
    },
  } as MappingExportInterface;
}

function noLegacySyncMappings(error: unknown): boolean {
  const queue: unknown[] = [error];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);

    const status = (current as { response?: { status?: number } }).response
      ?.status;
    const url = (current as { config?: { url?: string } }).config?.url;
    if (
      status === 404 &&
      typeof url === 'string' &&
      /\/openidm\/config\/sync(?:\?|$)/.test(url)
    ) {
      return true;
    }

    const nestedErrors = (current as { originalErrors?: unknown[] })
      .originalErrors;
    if (Array.isArray(nestedErrors)) {
      queue.push(...nestedErrors);
    }
  }

  return false;
}

/**
 * Read mappings from sync.json (legacy)
 * @returns {Promise<MappingSkeleton[]>} a promise that resolves to an array of mapping objects
 */
export async function readSyncMappings({
  state,
}: {
  state: State;
}): Promise<MappingSkeleton[]> {
  try {
    debugMessage({
      message: `MappingOps.readLegacyMappings: start`,
      state,
    });
    const sync = await readConfigEntity({
      entityId: 'sync',
      state,
    });
    const rawMappings = sync.mappings as MappingSkeleton[];
    const mappings = rawMappings
      .filter((it) => {
        if (!it) {
          debugMessage({
            message:
              'MappingOps.readLegacyMappings: skipping null/malformed entry in sync.json mappings array',
            state,
          });
          return false;
        }
        return true;
      })
      .map((it) => {
        it._id = `sync/${it.name}`;
        return it;
      });
    //Add syncAfter property to mappings, according to the ordering
    const syncAfter = [];
    for (const mapping of mappings) {
      mapping.syncAfter = syncAfter.slice();
      syncAfter.push(mapping.name);
    }
    debugMessage({
      message: `MappingOps.readLegacyMappings: end`,
      state,
    });
    return mappings;
  } catch (error) {
    // Newer IDM deployments may not expose the legacy /config/sync endpoint.
    if (noLegacySyncMappings(error)) {
      debugMessage({
        message:
          'MappingOps.readLegacyMappings: legacy sync endpoint not available, continuing without legacy mappings',
        state,
      });
      return [];
    }
    throw new FrodoError(`Error reading sync mappings`, error);
  }
}

/**
 * Read the new mappings that are not legacy (i.e. those not from sync.json)
 * @returns {Promise<MappingSkeleton[]>} a promise that resolves to an array of mapping objects
 */
export async function readNewMappings({
  state,
}: {
  state: State;
}): Promise<MappingSkeleton[]> {
  try {
    debugMessage({
      message: `MappingOps.readNewMappings: start`,
      state,
    });
    const mapping = (await readConfigEntitiesByType({
      type: 'mapping',
      state,
    })) as MappingSkeleton[];
    const mappings = mapping.map((it) => {
      it._id = `mapping/${it.name}`;
      return it;
    });
    debugMessage({
      message: `MappingOps.readNewMappings: end`,
      state,
    });
    return sortMappings(mappings);
  } catch (error) {
    throw new FrodoError(`Error reading new mappings`, error);
  }
}

/**
 * Select the mappings that belong to a connector and/or a managed object type.
 * With both, a mapping has to belong to both. With neither, every mapping is selected.
 * @param {MappingSkeleton[]} mappings the mappings to select from
 * @param {string} connectorId limit mappings to connector
 * @param {string} moType limit mappings to managed object type
 * @returns {MappingSkeleton[]} the selected mappings
 */
function filterMappings({
  mappings,
  connectorId,
  moType,
}: {
  mappings: MappingSkeleton[];
  connectorId?: string;
  moType?: string;
}): MappingSkeleton[] {
  let selected = mappings;
  if (connectorId)
    selected = selected.filter(
      (mapping) =>
        mapping.source.startsWith(`system/${connectorId}/`) ||
        mapping.target.startsWith(`system/${connectorId}/`)
    );
  if (moType)
    selected = selected.filter(
      (mapping) =>
        mapping.source === `managed/${moType}` ||
        mapping.target === `managed/${moType}`
    );
  return selected;
}

/**
 * Read mappings in order of which they are synced.
 * @param {string} connectorId limit mappings to connector
 * @param {string} moType limit mappings to managed object type
 * @returns {Promise<MappingSkeleton[]>} a promise that resolves to an array of mapping objects
 */
export async function readMappings({
  connectorId,
  moType,
  state,
}: {
  connectorId?: string;
  moType?: string;
  state: State;
}): Promise<MappingSkeleton[]> {
  try {
    debugMessage({
      message: `MappingOps.readMappings: start [connectorId=${
        connectorId ? connectorId : 'all'
      }, moType=${moType ? moType : 'all'}]`,
      state,
    });
    let mappings = await readSyncMappings({ state });
    mappings = mappings.concat(await readNewMappings({ state }));
    mappings = filterMappings({ mappings, connectorId, moType });
    debugMessage({
      message: `MappingOps.readMappings: end`,
      state,
    });
    return sortMappings(mappings);
  } catch (error) {
    throw new FrodoError(`Error reading mappings`, error);
  }
}

/**
 * Read mapping
 * @param {string} mappingId id of the mapping (new: 'mapping/\<name>', legacy: 'sync/\<name>')
 * @returns {Promise<MappingSkeleton>} a promise that resolves an mapping object
 */
export async function readMapping({
  mappingId,
  state,
}: {
  mappingId: string;
  state: State;
}): Promise<MappingSkeleton> {
  const mappings = await readMappings({ state });
  for (const mapping of mappings) {
    if (mapping._id === mappingId) return mapping;
  }
  throw new FrodoError(`Mapping '${mappingId}' not found!`);
}

/**
 * Create mapping
 * @param {string} mappingId id of the mapping (new: 'mapping/\<name>', legacy: 'sync/\<name>')
 * @param {MappingSkeleton} mappingData mapping object
 * @returns {Promise<MappingSkeleton>} a promise that resolves to an mapping object
 */
export async function createMapping({
  mappingId,
  mappingData,
  state,
}: {
  mappingId: string;
  mappingData: MappingSkeleton;
  state: State;
}): Promise<MappingSkeleton> {
  debugMessage({
    message: `MappingOps.createMapping: start`,
    state,
  });
  // readMapping's own "not found" signal is a synthetic, locally-thrown
  // FrodoError (readMappings reads the whole list; there's no per-item GET
  // to return a real 404 from), not an HTTP status isNotFoundError could
  // recognize -- so existence is checked directly against the list instead
  // of via a try/catch around readMapping. A genuine readMappings failure
  // (permission/network/5xx) propagates unchanged, not treated as "absent".
  const mappings = await readMappings({ state });
  if (mappings.some((mapping) => mapping._id === mappingId)) {
    throw new FrodoError(`Mapping ${mappingId} already exists!`);
  }
  try {
    const result = await updateMapping({
      mappingId,
      mappingData,
      state,
    });
    debugMessage({
      message: `MappingOps.createMapping: end`,
      state,
    });
    return result as MappingSkeleton;
  } catch (error) {
    throw new FrodoError(`Error creating mapping ${mappingId}`, error);
  }
}

/**
 * Update or create mapping
 * @param {string} mappingId id of the mapping (new: 'mapping/\<name>', legacy: 'sync/\<name>')
 * @param {MappingSkeleton} mappingData mapping object
 * @returns {Promise<MappingSkeleton>} a promise that resolves to an mapping object
 */
export async function updateMapping({
  mappingId,
  mappingData,
  state,
}: {
  mappingId: string;
  mappingData: MappingSkeleton;
  state: State;
}): Promise<MappingSkeleton> {
  if (isLegacyMapping(mappingId)) {
    try {
      let mappings = await readSyncMappings({ state });
      mappings = mappings.map((mapping) => {
        if (mappingId === mapping._id) {
          // update existing mapping with incoming
          return mappingData;
        }
        return mapping;
      });
      if (mappings.findIndex((mapping) => mapping._id === mappingId) === -1) {
        // incoming mapping does not exist, add it as new in the array
        mappings.push(mappingData);
      }
      const sync = await putConfigEntity({
        entityId: 'sync',
        entityData: { mappings },
        state,
      });
      for (const mapping of (sync.mappings as MappingSkeleton[])
        .filter((it) => !!it)
        .map((it: MappingSkeleton) => {
          it._id = `sync/${it.name}`;
          return it;
        })) {
        if (mapping._id === mappingId) return mapping;
      }
    } catch (error) {
      throw new FrodoError(`Error updating sync mapping ${mappingId}`, error);
    }
    throw new FrodoError(
      `Mapping ${mappingId} not found after successful update!`
    );
  } else {
    try {
      const mapping = await putConfigEntity({
        entityId: mappingId,
        entityData: mappingData,
        state,
      });
      return mapping as MappingSkeleton;
    } catch (error) {
      throw new FrodoError(`Error updating mapping ${mappingId}`, error);
    }
  }
}

/**
 * Update or create multiple mappings
 * @param {MappingSkeleton[]} mappings array of mapping objects
 * @returns {Promise<MappingSkeleton[]>} a promise that resolves to an array of mapping objects
 */
export async function updateLegacyMappings({
  mappings,
  state,
}: {
  mappings: MappingSkeleton[];
  state: State;
}): Promise<MappingSkeleton[]> {
  try {
    const sync = await putConfigEntity({
      entityId: 'sync',
      entityData: { mappings },
      state,
    });
    return sync.mappings as MappingSkeleton[];
  } catch (error) {
    throw new FrodoError(`Error updating legacy mappings`, error);
  }
}

/**
 * Delete all mappings, or only the mappings of a connector and/or a managed object type. With both, only the mappings that belong to both are deleted. Every selected mapping is tried: a mapping that cannot be deleted does not stop the others. Mappings that are not selected are left alone.
 * @param {string} connectorId limit mappings to connector
 * @param {string} moType limit mappings to managed object type
 * @param {ResultCallback<MappingSkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every delete is passed to it as it happens (a failed delete as an error that names the mapping) and a failed delete does not throw. Without it, the failures are collected and thrown as one error after every mapping was tried. Failing to read the mappings always throws.
 * @returns {Promise<MappingSkeleton[]>} a promise that resolves to an array of the deleted mapping objects
 * @throws {FrodoError} If the mappings cannot be read (always), or if one or more mappings cannot be deleted and there is no result callback. The error carries one nested error per failed mapping, naming it.
 */
export async function deleteMappings({
  connectorId,
  moType,
  resultCallback,
  state,
}: {
  connectorId?: string;
  moType?: string;
  resultCallback?: ResultCallback<MappingSkeleton>;
  state: State;
}): Promise<MappingSkeleton[]> {
  const errors: FrodoError[] = [];
  try {
    debugMessage({ message: `MappingOps.deleteMappings: start`, state });
    const mappings = await readMappings({ state });
    const deletedMappings: MappingSkeleton[] = [];
    // a deleted mapping goes to the result and to the callback
    const succeed = (mapping: MappingSkeleton) => {
      deletedMappings.push(mapping);
      if (resultCallback) resultCallback(undefined, mapping);
    };
    // a failure goes to the callback, or is collected to be thrown after every mapping was tried
    const fail = (error: FrodoError) => {
      if (resultCallback) resultCallback(error, undefined);
      else errors.push(error);
    };
    // delete the new-style mappings one by one: a failed delete does not stop the others
    const deleteNewMappings = async (toDelete: MappingSkeleton[]) => {
      for (const mapping of toDelete) {
        let deleted: MappingSkeleton;
        let failure: FrodoError;
        try {
          deleted = await deleteMapping({ mappingId: mapping._id, state });
        } catch (error) {
          // deleteMapping names the mapping in its error
          failure = error;
        }
        if (failure) fail(failure);
        else succeed(deleted);
      }
    };
    // delete all mappings
    if (!connectorId && !moType) {
      // delete all mappings in sync.json (one update: if it fails, that is one error)
      let failure: FrodoError;
      try {
        await updateLegacyMappings({
          mappings: [],
          state,
        });
      } catch (error) {
        failure = error;
      }
      if (failure) fail(failure);
      else {
        for (const mapping of mappings.filter((it) =>
          isLegacyMapping(it._id)
        )) {
          succeed(mapping);
        }
      }
      // delete all the new mappings
      await deleteNewMappings(
        mappings.filter((it) => !isLegacyMapping(it._id))
      );
      if (errors.length > 0) {
        throw new FrodoError(`Error deleting mappings`, errors);
      }
      return deletedMappings;
    }
    // delete filtered mappings
    else {
      // select first: only the selected mappings are touched
      debugMessage({
        message: `MappingOps.deleteMappings: select mappings [connectorId=${
          connectorId ? connectorId : 'all'
        }, moType=${moType ? moType : 'all'}]`,
        state,
      });
      const mappingsToDelete = filterMappings({
        mappings,
        connectorId,
        moType,
      });
      const legacyMappingsToDelete = mappingsToDelete.filter((it) =>
        isLegacyMapping(it._id)
      );
      const newMappingsToDelete = mappingsToDelete.filter(
        (it) => !isLegacyMapping(it._id)
      );
      const legacyMappingIdsToDelete = legacyMappingsToDelete.map(
        (it) => it._id
      );
      debugMessage({
        message: `MappingOps.deleteMappings: selected ${
          mappingsToDelete.length
        } mappings: ${mappingsToDelete.map((it) => it._id).join(', ')}`,
        state,
      });
      // the legacy mappings that stay in sync.json: the legacy mappings that were not selected
      // (the new-style mappings are not part of sync.json and must never be written to it)
      const updatedLegacyMappings = mappings.filter(
        (mapping) =>
          isLegacyMapping(mapping._id) &&
          !legacyMappingIdsToDelete.includes(mapping._id)
      );
      debugMessage({
        message: `MappingOps.deleteMappings: ${
          updatedLegacyMappings.length
        } remaining legacy mappings: ${updatedLegacyMappings
          .map((mapping) => mapping._id)
          .join(', ')}`,
        state,
      });
      // update sync.json only if a legacy mapping was selected (one update: if it fails, that is one error)
      let undeletedMappings: MappingSkeleton[] = [];
      if (legacyMappingsToDelete.length > 0) {
        let finalMappings: MappingSkeleton[];
        let failure: FrodoError;
        try {
          finalMappings = await updateLegacyMappings({
            mappings: updatedLegacyMappings,
            state,
          });
        } catch (error) {
          failure = error;
        }
        if (failure) fail(failure);
        else {
          debugMessage({
            message: `MappingOps.deleteMappings: ${
              finalMappings.length
            } mappings after update: ${finalMappings
              .map((mapping) => mapping._id)
              .join(', ')}`,
            state,
          });
          // are there any mappings that were not deleted?
          undeletedMappings = finalMappings.filter((mapping) =>
            legacyMappingIdsToDelete.includes(mapping._id)
          );
          const undeletedIds = undeletedMappings.map((it) => it._id);
          for (const mapping of legacyMappingsToDelete.filter(
            (it) => !undeletedIds.includes(it._id)
          )) {
            succeed(mapping);
          }
        }
      }
      // delete the selected new mappings
      await deleteNewMappings(newMappingsToDelete);
      // if there were undeleted mappings, that is an error too
      if (undeletedMappings.length > 0) {
        const message = `${
          undeletedMappings.length
        } mappings were not deleted from sync.json: ${undeletedMappings
          .map((mapping) => mapping._id)
          .join(', ')}`;
        debugMessage({
          message,
          state,
        });
        fail(new FrodoError(message));
      }
      if (errors.length > 0) {
        throw new FrodoError(`Error deleting mappings`, errors);
      }
      debugMessage({
        message: `MappingOps.deleteMappings: deleted ${
          deletedMappings.length
        } mappings: ${deletedMappings.map((it) => it._id).join(', ')}`,
        state,
      });
      debugMessage({ message: `MappingOps.deleteMappings: end`, state });
      // otherwise return deleted mappings
      return deletedMappings;
    }
  } catch (error) {
    // just re-throw previously collected errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error deleting mappings`, error);
  }
}

/**
 * Delete mapping
 * @param {string} mappingId id of the mapping (new: 'mapping/\<name>', legacy: 'sync/\<name>')
 * @returns {Promise<MappingSkeleton>} a promise that resolves an mapping object
 */
export async function deleteMapping({
  mappingId,
  state,
}: {
  mappingId: string;
  state: State;
}): Promise<MappingSkeleton> {
  try {
    debugMessage({ message: `MappingOps.deleteMapping: start`, state });
    if (isLegacyMapping(mappingId)) {
      const mappings = await readSyncMappings({ state });
      const mappingsToDelete = mappings.filter(
        (mapping) => mapping._id === mappingId
      );
      if (mappingsToDelete.length !== 1) {
        const message = `Mapping ${mappingId} not found in sync.json or multiple mappings found!`;
        debugMessage({
          message: `MappingOps.deleteMapping: ${message}`,
          state,
        });
        throw new FrodoError(message);
      }
      const updatedMappings = mappings.filter(
        (mapping) => mapping._id !== mappingId
      );
      debugMessage({
        message: `MappingOps.deleteMapping: ${
          updatedMappings.length
        } remaining mappings in sync.json: ${updatedMappings
          .map((mapping) => mapping._id)
          .join(', ')}`,
        state,
      });
      // update the mappings
      const finalMappings = await updateLegacyMappings({
        mappings: updatedMappings,
        state,
      });
      debugMessage({
        message: `MappingOps.deleteMapping: ${
          finalMappings.length
        } mappings in sync.json after update: ${finalMappings
          .map((mapping) => mapping._id)
          .join(', ')}`,
        state,
      });
      // are there any mappings that were not deleted?
      const undeletedMappings = finalMappings.filter(
        (mapping) => mappingId == mapping._id
      );
      // if so, throw exception
      if (undeletedMappings.length > 0) {
        const message = `Mapping ${undeletedMappings[0]._id} was not deleted from sync.json after successful update.`;
        debugMessage({
          message,
          state,
        });
        throw new FrodoError(message);
      }
      debugMessage({
        message: `MappingOps.deleteMapping: deleted legacy mapping ${mappingId} from sync.json.`,
        state,
      });
      debugMessage({ message: `MappingOps.deleteMapping: end`, state });
      // otherwise return deleted mapping
      return mappingsToDelete[0];
    } else {
      const mapping = await deleteConfigEntity({
        entityId: mappingId,
        state,
      });
      debugMessage({ message: `MappingOps.deleteMapping: end`, state });
      return mapping as MappingSkeleton;
    }
  } catch (error) {
    throw new FrodoError(`Error deleting mapping ${mappingId}`, error);
  }
}

/**
 * Export mapping
 * @param {string} mappingId id of the mapping (new: 'mapping/\<name>', legacy: 'sync/\<name>')
 * @param {MappingExportOptions} options export options
 * @returns {Promise<MappingExportInterface>} a promise that resolves to a MappingExportInterface object
 */
export async function exportMapping({
  mappingId,
  options = { deps: true, useStringArrays: true },
  state,
}: {
  mappingId: string;
  options?: MappingExportOptions;
  state: State;
}): Promise<MappingExportInterface> {
  try {
    debugMessage({ message: `MappingOps.exportMapping: start`, state });
    const mappingData = await readMapping({ mappingId, state });
    const exportData = createMappingExportTemplate({ state });
    if (options.deps) {
      // TODO
    }
    if (options.useStringArrays) {
      // TODO
    }
    if (isLegacyMapping(mappingId)) {
      exportData.sync.mappings.push(mappingData);
    } else {
      exportData.mapping[mappingId] = mappingData;
    }
    debugMessage({ message: `MappingOps.exportMapping: end`, state });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting mappings`, error);
  }
}

/**
 * Export all mappings
 * @param {MappingExportOptions} options export options
 * @returns {Promise<MappingExportInterface>} a promise that resolves to a MappingExportInterface object
 */
export async function exportMappings({
  options = { deps: true, useStringArrays: true },
  state,
}: {
  options?: MappingExportOptions;
  state: State;
}): Promise<MappingExportInterface> {
  let indicatorId: string | undefined;
  try {
    const exportData = createMappingExportTemplate({ state });
    const allMappingsData = await readMappings({
      connectorId: options.connectorId,
      moType: options.moType,
      state,
    });
    indicatorId = createProgressIndicator({
      total: allMappingsData.length,
      message: 'Exporting mappings',
      state,
    });
    for (const mappingData of allMappingsData) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting mapping ${mappingData._id}`,
        state,
      });
      if (options.deps) {
        // TODO
      }
      if (options.useStringArrays) {
        // TODO
      }
      if (isLegacyMapping(mappingData._id)) {
        exportData.sync.mappings.push(mappingData);
      } else {
        exportData.mapping[mappingData._id] = mappingData;
      }
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `${allMappingsData.length} mappings exported.`,
      state,
    });
    return exportData;
  } catch (error) {
    if (indicatorId) {
      stopProgressIndicator({
        id: indicatorId,
        message: `Error exporting mappings`,
        status: 'fail',
        state,
      });
    }
    throw new FrodoError(`Error exporting mappings`, error);
  }
}

/**
 * Import mapping
 * @param {string} mappingId id of the mapping (new: 'mapping/\<name>', legacy: 'sync/\<name>')
 * @param {MappingExportInterface} importData import data
 * @param {MappingImportOptions} options import options
 * @returns {Promise<MappingSkeleton>} a promise resolving to a MappingSkeleton object
 */
export async function importMapping({
  mappingId,
  importData,
  options = { deps: true },
  state,
}: {
  mappingId: string;
  importData: MappingExportInterface;
  options?: MappingImportOptions;
  state: State;
}): Promise<MappingSkeleton> {
  let response = null;
  const errors = [];
  const imported = [];
  const isLegacy = isLegacyMapping(mappingId);
  for (const key of isLegacy
    ? importData.sync.mappings.map((m) => m._id)
    : Object.keys(importData.mapping)) {
    if (key === mappingId) {
      try {
        if (options.deps) {
          // TODO
        }
        response = await updateMapping({
          mappingId,
          mappingData: isLegacy
            ? importData.sync.mappings.find((m) => m._id === mappingId)
            : importData.mapping[mappingId],
          state,
        });
        imported.push(key);
      } catch (error) {
        errors.push(error);
      }
    }
  }
  if (errors.length > 0) {
    throw new FrodoError(`Error importing mapping ${mappingId}`, errors);
  }
  if (0 === imported.length) {
    throw new FrodoError(`Mapping ${mappingId} not found in import data`);
  }
  return response;
}

/**
 * Import first mapping
 * @param {MappingExportInterface} importData import data
 * @param {MappingImportOptions} options import options
 * @returns {Promise<MappingSkeleton>} a promise resolving to a MappingSkeleton object
 */
export async function importFirstMapping({
  importData,
  options = { deps: true },
  state,
}: {
  importData: MappingExportInterface;
  options?: MappingImportOptions;
  state: State;
}): Promise<MappingSkeleton> {
  let response = null;
  const errors = [];
  const imported = [];
  const mappingIds = Object.keys(importData.mapping);
  let mappingId;
  // Sync order starts with mappings in sync.json first before moving on to sync the individual mapping files, so try sync mappings first.
  // See https://backstage.forgerock.com/docs/idm/7.5/synchronization-guide/mappings.html
  if (importData.sync?.mappings?.length > 0) {
    mappingId = importData.sync.mappings[0]._id;
  } else if (mappingIds.length > 0) {
    mappingId = mappingIds[0];
  }
  if (mappingId) {
    try {
      if (options.deps) {
        // TODO
      }
      response = await updateMapping({
        mappingId,
        mappingData: isLegacyMapping(mappingId)
          ? importData.sync.mappings.find((m) => m._id === mappingId)
          : importData.mapping[mappingId],
        state,
      });
      imported.push(mappingId);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new FrodoError(`Error importing first mapping`, errors);
  }
  if (0 === imported.length) {
    throw new FrodoError(`No mappings found in import data!`);
  }
  return response;
}

/**
 * Import all mappings. Every mapping is tried: a mapping that cannot be imported does not stop the others.
 * @param {MappingExportInterface} importData import data
 * @param {MappingImportOptions} options import options
 * @param {ResultCallback<MappingSkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every mapping is passed to it as it happens (a failed mapping as an error that names the mapping and carries the cause) and a failed mapping does not throw: the mappings that were imported are returned. Without it, the failures are collected and thrown as one error after every mapping was tried.
 * @returns {Promise<MappingSkeleton[]>} a promise resolving to an array of MappingSkeleton objects
 * @throws {FrodoError} If one or more mappings cannot be imported and there is no result callback. The error carries one nested error per failed mapping.
 */
export async function importMappings({
  importData,
  options = { deps: true },
  resultCallback = undefined,
  state,
}: {
  importData: MappingExportInterface;
  options?: MappingImportOptions;
  resultCallback?: ResultCallback<MappingSkeleton>;
  state: State;
}): Promise<MappingSkeleton[]> {
  const response = [];
  const errors = [];
  let mappings = [];
  if (importData.mapping) {
    mappings = mappings.concat(Object.values(importData.mapping));
  }
  if (importData.sync && Array.isArray(importData.sync.mappings)) {
    mappings = mappings.concat(importData.sync.mappings);
  }
  for (const [index, mappingData] of mappings.entries()) {
    let imported: MappingSkeleton;
    let failed = false;
    let failure: unknown;
    try {
      if (options.deps) {
        // TODO
      }
      imported = await updateMapping({
        mappingId: mappingData._id,
        mappingData,
        state,
      });
    } catch (error) {
      failed = true;
      failure = error;
    }
    // the callback is called outside the try: an exception of the callback must
    // not be taken for a failed import and reported a second time
    if (!failed) {
      response.push(imported);
      if (resultCallback) resultCallback(undefined, imported);
    } else if (resultCallback) {
      // a mapping without an id is named by its name, or else by its position
      const label =
        mappingData?._id ?? mappingData?.name ?? `at position ${index + 1}`;
      resultCallback(
        new FrodoError(`Error importing mapping ${label}`, failure as Error),
        undefined
      );
    } else {
      errors.push(failure);
    }
  }
  if (errors.length > 0) {
    throw new FrodoError(`Error importing mappings`, errors);
  }
  return response;
}

/**
 * Helper that returns a boolean indicating whether the mapping is a legacy mapping or not given the id
 * @param {string} mappingId the mapping id
 * @returns {boolean} true if the mapping is a legacy mapping, false otherwise
 * @throws {FrodoError} if the id is invalid
 */
export function isLegacyMapping(mappingId: string): boolean {
  if (
    !mappingId ||
    (!mappingId.startsWith('sync/') && !mappingId.startsWith('mapping/'))
  ) {
    throw new FrodoError(
      `Invalid mapping id ${mappingId}. Must start with 'sync/' or 'mapping/'`
    );
  }
  return mappingId.startsWith('sync/');
}

/**
 * Helper that sorts an array of mappings in place and returns the sorted array. It sorts first by mapping type (legacy mappings come before non-legacy mappings), and then by the syncAfter property.
 * If syncAfter doesn't exist, it prioritizes mappings without the syncAfter property (note that the behavior that should happen in this instance is not specified in the documentation, at least as of July 9, 2024).
 *
 * See sync order documentation: https://backstage.forgerock.com/docs/idm/7.5/synchronization-guide/mappings.html
 *
 * Note: According to the documentation, then endpoint /openidm/sync/mappings?_queryFilter=true should return all mappings (legacy and new) in the correct order, which would make this method unnecessary when reading mappings. However, this doesn't
 * seem to always be the case. The endpoint prioritizes non-legacy mappings over legacy mappings which is opposite what the documentation says the correct sync order should be. Additionally, the endpoint does not always return all the mappings.
 * In the future, if the endpoint is fixed, we may instead want to use /openidm/sync/mappings?_queryFilter=true to determine correct ordering.
 *
 * @param {MappingSkeleton[]} mappings The list of mappings to sort in place
 * @returns The sorted list of mappings
 */
export function sortMappings(mappings: MappingSkeleton[]) {
  return mappings.sort((m1, m2) => {
    // Order by mapping type first. Sync (legacy) mappings get synced first according to the documentation: https://backstage.forgerock.com/docs/idm/7.5/synchronization-guide/mappings.html
    const m1IsLegacy = isLegacyMapping(m1._id);
    const m2IsLegacy = isLegacyMapping(m2._id);
    if (m1IsLegacy && !m2IsLegacy) {
      return -1;
    }
    if (m2IsLegacy && !m1IsLegacy) {
      return 1;
    }
    // The reason for sorting by the length of the syncAfter array is because this is how syncAfter works for sync.json mappings when you query the /openidm/sync/mappings?_queryFilter=true endpoint. For example, the last mapping
    // in sync.json would have a list of all the mappings that get synced prior to it, meaning it would have the longest syncAfter array, while the first mapping would have an empty syncAfter array.
    if (m1.syncAfter && m2.syncAfter) {
      if (m1.syncAfter.length < m2.syncAfter.length) {
        return -1;
      }
      if (m1.syncAfter.length > m2.syncAfter.length) {
        return 1;
      }
      return 0;
    }
    // Prioritize those mappings that don't have a syncAfter property if none is provided for one of them. The reason for this decision is this is how the /openidm/sync/mappings?_queryFilter=true endpoint orders mappings that don't
    // have this property, at least according to my observations. The actual behavior for when mappings don't have syncAfter is not specified in the documentation.
    if (m1.syncAfter) {
      return 1;
    }
    if (m2.syncAfter) {
      return -1;
    }
    return 0;
  });
}

const MAPPING_PREFIX = 'mapping/';
const SCHEDULE_PREFIX = 'schedule/';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const byIdThenFrom = (a: MappingReference, b: MappingReference) =>
  a.id.localeCompare(b.id) || a.from.localeCompare(b.from);

/**
 * Reads the `sync` configuration. One that is not there (no legacy
 * configuration) is none (null), any other failure is thrown.
 */
async function readSyncConfigOrNone(state: State): Promise<unknown> {
  try {
    return await readConfigEntity({ entityId: 'sync', state });
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

/** What the mapping source reads: the `sync` configuration and the `mapping/` configurations. */
type MappingStores = { sync: unknown; mappings: unknown };

/** The two fields of a mapping that name another mapping, and how much the holder depends on it. */
const MAPPING_HOLDER_FIELDS = [
  { from: 'links', dependency: 'hard' },
  { from: 'syncAfter', dependency: 'soft' },
] as const;

/** Whether a mapping entry names `mappingName` in the field: `links` is the name, `syncAfter` lists it. */
function namesMapping(
  entry: Record<string, unknown>,
  from: (typeof MAPPING_HOLDER_FIELDS)[number]['from'],
  mappingName: string
): boolean {
  const value = entry[from];
  return from === 'links'
    ? value === mappingName
    : Array.isArray(value) && value.includes(mappingName);
}

/**
 * The mappings that name a mapping, in either store. A mapping is never a
 * holder of itself (by name, so a mapping that is stored in both places is
 * neither). A holder that is stored in both places is one reference per field:
 * the id is `mapping/<name>` when that store holds a match for the field, else
 * `sync/<name>`. A `sync` entry without a name cannot be addressed and is left
 * out.
 */
function findMappingHolders(
  stores: MappingStores,
  mappingName: string
): MappingReference[] {
  const folded = new Map<
    string,
    {
      name: string;
      from: (typeof MAPPING_HOLDER_FIELDS)[number]['from'];
      dependency: (typeof MAPPING_HOLDER_FIELDS)[number]['dependency'];
      id: string;
    }
  >();
  const note = (
    entry: Record<string, unknown>,
    name: string,
    id: string | undefined
  ) => {
    if (name === mappingName) return;
    for (const { from, dependency } of MAPPING_HOLDER_FIELDS) {
      if (namesMapping(entry, from, mappingName)) {
        // the sync store is noted first, so a note with an id (the mapping
        // configuration) replaces the legacy id of the same mapping and field
        folded.set(JSON.stringify([name, from]), {
          name,
          from,
          dependency,
          id: id ?? `sync/${name}`,
        });
      }
    }
  };
  const syncMappings =
    isRecord(stores.sync) && Array.isArray(stores.sync.mappings)
      ? stores.sync.mappings
      : [];
  for (const entry of syncMappings) {
    if (!isRecord(entry) || typeof entry.name !== 'string') continue;
    note(entry, entry.name, undefined);
  }
  for (const entry of Array.isArray(stores.mappings) ? stores.mappings : []) {
    if (
      !isRecord(entry) ||
      typeof entry._id !== 'string' ||
      !entry._id.startsWith(MAPPING_PREFIX)
    )
      continue;
    note(
      entry,
      typeof entry.name === 'string'
        ? entry.name
        : entry._id.substring(MAPPING_PREFIX.length),
      entry._id
    );
  }
  return [...folded.values()]
    .map(({ name, from, dependency, id }) => ({
      source: 'mapping' as const,
      dependency,
      id,
      name,
      from,
    }))
    .sort(byIdThenFrom);
}

/** The schedules that name a mapping: an `invokeContext.mapping` equal to the name. */
function findScheduleHolders(
  schedules: unknown,
  mappingName: string
): MappingReference[] {
  return (Array.isArray(schedules) ? schedules : [])
    .flatMap((schedule) => {
      if (
        !isRecord(schedule) ||
        typeof schedule._id !== 'string' ||
        !schedule._id.startsWith(SCHEDULE_PREFIX) ||
        !isRecord(schedule.invokeContext) ||
        schedule.invokeContext.mapping !== mappingName
      ) {
        return [];
      }
      return [
        {
          source: 'schedule' as const,
          dependency: 'hard' as const,
          id: schedule._id,
          from: 'invokeContext.mapping',
        },
      ];
    })
    .sort(byIdThenFrom);
}

/** The applications that name a mapping: a `mappingNames` that lists the name. */
function findApplicationHolders(
  records: ApplicationRecords,
  mappingName: string
): MappingReference[] {
  return records
    .flatMap(({ realm, application }) => {
      if (
        !isRecord(application) ||
        typeof application._id !== 'string' ||
        !Array.isArray(application.mappingNames) ||
        !application.mappingNames.includes(mappingName)
      ) {
        return [];
      }
      return [
        {
          source: 'application' as const,
          dependency: 'hard' as const,
          id: application._id,
          ...(typeof application.name === 'string' && {
            name: application.name,
          }),
          ...(realm !== undefined && { realm }),
          from: 'mappingNames',
        },
      ];
    })
    .sort(byIdThenFrom);
}

/**
 * Every source that findMappingReferences reads, in the order of the result.
 * Adding a holder is a row here.
 */
const mappingReferenceSources: readonly ReferenceSource<
  MappingReference['source'],
  MappingReference
>[] = [
  defineReferenceSource<
    MappingReference['source'],
    MappingReference,
    MappingStores
  >({
    source: 'mapping',
    label: 'mappings',
    read: async (state) => {
      const [sync, mappings] = await Promise.all([
        readSyncConfigOrNone(state),
        readConfigEntitiesByType({ type: 'mapping', state }),
      ]);
      return { sync, mappings };
    },
    find: findMappingHolders,
  }),
  defineReferenceSource<MappingReference['source'], MappingReference, unknown>({
    source: 'schedule',
    label: 'schedules',
    read: async (state) =>
      readConfigEntitiesByType({ type: 'schedule', state }),
    find: findScheduleHolders,
  }),
  defineReferenceSource<
    MappingReference['source'],
    MappingReference,
    ApplicationRecords
  >({
    source: 'application',
    label: 'applications',
    // applications are an object of Cloud and ForgeOps: a classic deployment
    // is sent no request for them
    appliesTo: (state) =>
      state.getDeploymentType() !== Constants.CLASSIC_DEPLOYMENT_TYPE_KEY,
    read: async (state) =>
      readApplicationsOfAllRealms({ fields: ['name', 'mappingNames'], state }),
    find: findApplicationHolders,
  }),
];

/**
 * Find what still names a mapping, in the whole tenant. See the facade method
 * for the sources, for what is not seen and for what an empty answer does and
 * does not mean.
 *
 * For one name the lookup fails closed: if any source cannot be read, every
 * source is still attempted, then one error is thrown that nests one error per
 * source that failed. For a list of names the same reads answer every name, and
 * a source that cannot be read is named in `unreadable` instead of failing the
 * call.
 * @param {string | string[]} mappingNames name of the mapping without the type prefix, or a list of them
 * @returns {Promise<MappingReference[] | object>} a promise that resolves to every reference found for one name, or to `{ references, unreadable }` for a list
 */
export function findMappingReferences(params: {
  mappingNames: string;
  state: State;
}): Promise<MappingReference[]>;
export function findMappingReferences(params: {
  mappingNames: string[];
  state: State;
}): Promise<
  ReferenceLookupResult<MappingReference['source'], MappingReference>
>;
export function findMappingReferences(params: {
  mappingNames: string | string[];
  state: State;
}): Promise<
  | MappingReference[]
  | ReferenceLookupResult<MappingReference['source'], MappingReference>
>;
export async function findMappingReferences({
  mappingNames,
  state,
}: {
  mappingNames: string | string[];
  state: State;
}) {
  return findReferencesForIds({
    sources: mappingReferenceSources,
    state,
    ids: mappingNames,
    subject: 'mapping',
  });
}
