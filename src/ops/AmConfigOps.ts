import {
  AmConfigEntitiesInterface,
  ConfigEntitySkeleton,
  ConfigSkeleton,
  EntityInfo,
  getConfigEntity,
  putConfigEntity,
} from '../api/AmConfigApi';
import { AmConfigEntityInterface, PagedResult } from '../api/ApiTypes';
import Constants from '../shared/Constants';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import {
  getErrorCallback,
  getMetadata,
  getResult,
} from '../utils/ExportImportUtils';
import {
  getRealmsForExport,
  getRealmUsingExportFormat,
} from '../utils/ForgeRockUtils';
import { ExportMetaData, ResultCallback } from './OpsTypes';

export type AmConfig = {
  /**
   * Create an empty config entity export template
   * @returns {Promise<ConfigEntityExportInterface>} an empty config entity export template
   */
  createConfigEntityExportTemplate(
    realms?: string[]
  ): Promise<ConfigEntityExportInterface>;
  /**
   * Export all other AM config entities
   * @param {boolean} includeReadOnly Include read only config in the export
   * @param {boolean} onlyRealm Export config only from the active realm. If onlyGlobal is also active, then it will also export the global config.
   * @param {boolean} onlyGlobal Export global config only. If onlyRealm is also active, then it will also export the active realm config.
   * @param {ResultCallback} resultCallback Optional callback to process individual results
   * @returns {Promise<ConfigEntityExportInterface>} promise resolving to a ConfigEntityExportInterface object
   */
  exportAmConfigEntities(
    includeReadOnly: boolean,
    onlyRealm: boolean,
    onlyGlobal: boolean,
    resultCallback?: ResultCallback<AmConfigEntityInterface>
  ): Promise<ConfigEntityExportInterface>;
  /**
   * Import all other AM config entities
   * @param {ConfigEntityExportInterface} importData The config import data
   * @param {ResultCallback} resultCallback Optional callback to process individual results
   * @returns {Promise<ConfigSkeleton | null>} a promise that resolves to a config object containing global and realm config entities, or null if no import was performed
   */
  importAmConfigEntities(
    importData: ConfigEntityExportInterface,
    resultCallback?: ResultCallback<AmConfigEntityInterface>
  ): Promise<ConfigSkeleton | null>;
};

export default (state: State): AmConfig => {
  return {
    async createConfigEntityExportTemplate(
      realms?: string[]
    ): Promise<ConfigEntityExportInterface> {
      return createConfigEntityExportTemplate({ realms, state });
    },
    async exportAmConfigEntities(
      includeReadOnly = false,
      onlyRealm = false,
      onlyGlobal = false,
      resultCallback = void 0
    ): Promise<ConfigEntityExportInterface> {
      return exportAmConfigEntities({
        includeReadOnly,
        onlyRealm,
        onlyGlobal,
        resultCallback,
        state,
      });
    },
    async importAmConfigEntities(
      importData: ConfigEntityExportInterface,
      resultCallback = void 0
    ): Promise<ConfigSkeleton | null> {
      return importAmConfigEntities({ importData, resultCallback, state });
    },
  };
};

export interface ConfigEntityExportInterface {
  meta?: ExportMetaData;
  global: Record<string, Record<string, AmConfigEntityInterface>>;
  realm: Record<
    string,
    Record<string, Record<string, AmConfigEntityInterface>>
  >;
}

const ALL_DEPLOYMENTS = [
  Constants.CLASSIC_DEPLOYMENT_TYPE_KEY,
  Constants.CLOUD_DEPLOYMENT_TYPE_KEY,
  Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY,
];
const CLASSIC_DEPLOYMENT = [Constants.CLASSIC_DEPLOYMENT_TYPE_KEY];

const NEXT_DESCENDENTS_ACTION = 'nextdescendents';
const TRUE_QUERY_FILTER = 'true';

/**
 * Consists of all AM entities that are not currently being exported elsewhere in Frodo.
 * Endpoints and resource versions were scraped directly from the Amster entity reference documentation: https://backstage.forgerock.com/docs/amster/7.5/entity-reference/preface.html
 */
const AM_ENTITIES: Record<string, EntityInfo> = {
  applicationTypes: {
    realm: { path: '/applicationtypes', version: '1.0' },
    deployments: ALL_DEPLOYMENTS,
    queryFilter: TRUE_QUERY_FILTER,
    readonly: true,
  },
  authenticationChains: {
    realm: {
      path: '/realm-config/authentication/chains',
      version: '2.0',
      importWithId: true,
      queryFilter: TRUE_QUERY_FILTER,
    },
    global: {
      path: '/global-config/authentication/chains',
      version: '1.0',
      deployments: CLASSIC_DEPLOYMENT,
    },
    deployments: ALL_DEPLOYMENTS,
  },
  authenticationModules: {
    realm: { path: '/realm-config/authentication/modules', version: '2.0' },
    global: {
      path: '/global-config/authentication/modules',
      version: '1.0',
      deployments: CLASSIC_DEPLOYMENT,
    },
    deployments: ALL_DEPLOYMENTS,
    action: NEXT_DESCENDENTS_ACTION,
    readonly: true,
  },
  authenticationTreesConfiguration: {
    global: {
      path: '/global-config/authentication/authenticationtrees',
      version: '1.0',
    },
    deployments: CLASSIC_DEPLOYMENT,
  },
  conditionTypes: {
    realm: { path: '/conditiontypes', version: '1.0' },
    deployments: ALL_DEPLOYMENTS,
    queryFilter: TRUE_QUERY_FILTER,
    readonly: true,
  },
  decisionCombiners: {
    realm: { path: '/decisioncombiners', version: '1.0' },
    deployments: ALL_DEPLOYMENTS,
    queryFilter: TRUE_QUERY_FILTER,
    readonly: true,
  },
  secrets: {
    realm: { path: '/realm-config/secrets', version: '2.0' },
    global: {
      path: '/global-config/secrets',
      version: '1.0',
      deployments: CLASSIC_DEPLOYMENT,
    },
    deployments: ALL_DEPLOYMENTS,
    action: NEXT_DESCENDENTS_ACTION,
    readonly: true,
  },
  serverInformation: {
    // Note: Amster documentation says to do this by realm, but it really should be global (the API explorer does it this way and it makes more sense)
    global: { path: '/serverinfo/*', version: '2.0' },
    deployments: ALL_DEPLOYMENTS,
    readonly: true,
  },
  serverVersion: {
    // Note: Amster documentation says to do this by realm, but it really should be global (the API explorer does it this way and it makes more sense)
    global: { path: '/serverinfo/version', version: '1.0' },
    deployments: ALL_DEPLOYMENTS,
    readonly: true,
  },
  subjectAttributes: {
    // Due to a bug with this endpoint, protocol 1.0 is the only way for it to work as of version 7.5.0.
    realm: { path: '/subjectattributes', version: '1.0', protocol: '1.0' },
    deployments: ALL_DEPLOYMENTS,
    queryFilter: TRUE_QUERY_FILTER,
    readonly: true,
  },
  subjectTypes: {
    realm: { path: '/subjecttypes', version: '1.0' },
    deployments: ALL_DEPLOYMENTS,
    queryFilter: TRUE_QUERY_FILTER,
    readonly: true,
  },
  webhookService: {
    realm: {
      path: '/realm-config/webhooks',
      version: '2.0',
      importWithId: true,
      queryFilter: TRUE_QUERY_FILTER,
    },
    global: {
      path: '/global-config/webhooks',
      version: '1.0',
      ifMatch: '*',
      deployments: CLASSIC_DEPLOYMENT,
    },
    deployments: ALL_DEPLOYMENTS,
  },
  wsEntity: {
    realm: {
      path: '/realm-config/federation/entityproviders/ws',
      version: '2.0',
      importWithId: true,
    },
    deployments: ALL_DEPLOYMENTS,
    queryFilter: TRUE_QUERY_FILTER,
  },
};

/**
 * Create an empty config export template
 * @param {string[]} realms the list of realm names
 * @returns {Promise<ConfigEntityExportInterface>} an empty config entity export template
 */
export async function createConfigEntityExportTemplate({
  state,
  realms,
}: {
  state: State;
  realms?: string[];
}): Promise<ConfigEntityExportInterface> {
  if (!realms) {
    realms = await getRealmsForExport({ state });
  }
  return {
    meta: getMetadata({ state }),
    global: {},
    realm: Object.fromEntries(realms.map((r) => [r, {}])),
  } as ConfigEntityExportInterface;
}

/**
 * Get all other AM config entities
 * @param {boolean} includeReadOnly Include read only config in the export
 * @param {boolean} onlyRealm Get config only from the active realm. If onlyGlobal is also active, then it will also get the global config.
 * @param {boolean} onlyGlobal Get global config only. If onlyRealm is also active, then it will also get the active realm config.
 * @param {ResultCallback} resultCallback Optional callback to process individual results
 * @returns {Promise<ConfigSkeleton>} a promise that resolves to a config object containing global and realm config entities
 */
export async function getConfigEntities({
  includeReadOnly = false,
  onlyRealm = false,
  onlyGlobal = false,
  resultCallback = void 0,
  state,
}: {
  includeReadOnly: boolean;
  onlyRealm: boolean;
  onlyGlobal: boolean;
  resultCallback: ResultCallback<ConfigEntitySkeleton>;
  state: State;
}): Promise<ConfigSkeleton> {
  debugMessage({
    message: `AmConfigOps.getConfigEntities: start`,
    state,
  });
  const realms = await getRealmsForExport({ state });
  const stateRealms = realms.map(getRealmUsingExportFormat);
  const entities = {
    global: {},
    realm: Object.fromEntries(realms.map((r) => [r, {}])),
  } as ConfigSkeleton;
  for (const [key, entityInfo] of Object.entries(AM_ENTITIES)) {
    if (!includeReadOnly && entityInfo.readonly) {
      continue;
    }
    const deploymentAllowed =
      entityInfo.deployments &&
      entityInfo.deployments.includes(state.getDeploymentType());
    if (
      (onlyGlobal || !onlyRealm) &&
      entityInfo.global &&
      ((entityInfo.global.deployments &&
        entityInfo.global.deployments.includes(state.getDeploymentType())) ||
        (entityInfo.global.deployments == undefined && deploymentAllowed))
    ) {
      debugMessage({
        message: `AmConfigOps.getConfigEntities: delegating to getResult (global)`,
        state,
      });
      const result: ConfigEntitySkeleton = await getResult(
        resultCallback,
        `Error getting '${key}' from resource path '${entityInfo.global.path}'`,
        getConfigEntity,
        {
          state,
          path: entityInfo.global.path,
          version: entityInfo.global.version,
          protocol: entityInfo.global.protocol,
          queryFilter: entityInfo.global.queryFilter
            ? entityInfo.global.queryFilter
            : entityInfo.queryFilter,
          action: entityInfo.global.action
            ? entityInfo.global.action
            : entityInfo.action,
        }
      );
      if (result) {
        entities.global[key] = result;
      }
    }
    if (
      (!onlyGlobal || onlyRealm) &&
      entityInfo.realm &&
      ((entityInfo.realm.deployments &&
        entityInfo.realm.deployments.includes(state.getDeploymentType())) ||
        (entityInfo.realm.deployments == undefined && deploymentAllowed))
    ) {
      const activeRealm = state.getRealm();
      for (let i = 0; i < realms.length; i++) {
        if (
          onlyRealm &&
          (activeRealm.startsWith('/') ? activeRealm : '/' + activeRealm) !==
            stateRealms[i]
        ) {
          debugMessage({
            message: `AmConfigOps.getConfigEntities: skipping realm: ${activeRealm}`,
            state,
          });
          continue;
        }
        debugMessage({
          message: `AmConfigOps.getConfigEntities: delegating to getResult (realm: ${activeRealm})`,
          state,
        });
        const result: ConfigEntitySkeleton = await getResult(
          resultCallback,
          `Error getting '${key}' from resource path '${entityInfo.realm.path}'`,
          getConfigEntity,
          {
            state,
            path: entityInfo.realm.path,
            version: entityInfo.realm.version,
            protocol: entityInfo.realm.protocol,
            realm: stateRealms[i],
            queryFilter: entityInfo.realm.queryFilter
              ? entityInfo.realm.queryFilter
              : entityInfo.queryFilter,
            action: entityInfo.realm.action
              ? entityInfo.realm.action
              : entityInfo.action,
          }
        );
        if (result) {
          entities.realm[realms[i]][key] = result;
        }
      }
    }
  }
  return entities;
}

/**
 * Put all other AM config entities
 * @param {ConfigSkeleton} config the config object containing global and realm config entities
 * @param {ResultCallback} resultCallback Optional callback to process individual results
 * @returns {Promise<ConfigSkeleton>} a promise that resolves to a config object containing global and realm config entities
 */
export async function putConfigEntities({
  config,
  resultCallback = void 0,
  state,
}: {
  config: ConfigSkeleton;
  resultCallback: ResultCallback<ConfigEntitySkeleton>;
  state: State;
}): Promise<ConfigSkeleton> {
  const realms = config.realm ? Object.keys(config.realm) : [];
  const stateRealms = realms.map(getRealmUsingExportFormat);
  const entities = {
    global: {},
    realm: Object.fromEntries(realms.map((r) => [r, {}])),
  } as ConfigSkeleton;
  for (const [key, entityInfo] of Object.entries(AM_ENTITIES)) {
    if (entityInfo.readonly) {
      continue;
    }
    const deploymentAllowed =
      entityInfo.deployments &&
      entityInfo.deployments.includes(state.getDeploymentType());
    if (
      entityInfo.global &&
      ((entityInfo.global.deployments &&
        entityInfo.global.deployments.includes(state.getDeploymentType())) ||
        (entityInfo.global.deployments == undefined && deploymentAllowed)) &&
      config.global &&
      config.global[key]
    ) {
      for (const [id, entityData] of Object.entries(config.global[key])) {
        if (!entities.global[key]) {
          entities.global[key] = {};
        }
        const result: ConfigEntitySkeleton = await getResult(
          resultCallback,
          `Error putting entity '${id}' of type '${key}' to global resource path '${entityInfo.global.path}'`,
          putConfigEntity,
          {
            state,
            entityData: entityData as ConfigEntitySkeleton,
            path:
              entityInfo.global.path +
              (entityInfo.global.importWithId ? `/${id}` : ''),
            version: entityInfo.global.version,
            protocol: entityInfo.global.protocol,
            ifMatch: entityInfo.global.ifMatch,
          }
        );
        if (result) {
          entities.global[key][id] = result;
        }
      }
    }
    if (
      entityInfo.realm &&
      ((entityInfo.realm.deployments &&
        entityInfo.realm.deployments.includes(state.getDeploymentType())) ||
        (entityInfo.realm.deployments == undefined && deploymentAllowed))
    ) {
      for (let i = 0; i < realms.length; i++) {
        if (!config.realm[realms[i]][key]) {
          continue;
        }
        for (const [id, entityData] of Object.entries(
          config.realm[realms[i]][key]
        )) {
          if (!entities.realm[realms[i]][key]) {
            entities.realm[realms[i]][key] = {};
          }
          const result: ConfigEntitySkeleton = await getResult(
            resultCallback,
            `Error putting entity '${id}' of type '${key}' to realm resource path '${entityInfo.realm.path}'`,
            putConfigEntity,
            {
              state,
              entityData: entityData as ConfigEntitySkeleton,
              path:
                entityInfo.realm.path +
                (entityInfo.realm.importWithId ? `/${id}` : ''),
              version: entityInfo.realm.version,
              protocol: entityInfo.realm.protocol,
              ifMatch: entityInfo.realm.ifMatch,
              realm: stateRealms[i],
            }
          );
          if (result) {
            entities.realm[realms[i]][key][id] = result;
          }
        }
      }
    }
  }
  return entities;
}

/**
 * Export all other AM config entities
 * @param {boolean} includeReadOnly Include read only config in the export
 * @param {boolean} onlyRealm Export config only from the active realm. If onlyGlobal is also active, then it will also export the global config.
 * @param {boolean} onlyGlobal Export global config only. If onlyRealm is also active, then it will also export the active realm config.
 * @param {ResultCallback} resultCallback Optional callback to process individual results
 * @returns {Promise<ConfigEntityExportInterface>} promise resolving to a ConfigEntityExportInterface object
 */
export async function exportAmConfigEntities({
  includeReadOnly = false,
  onlyRealm = false,
  onlyGlobal = false,
  resultCallback = void 0,
  state,
}: {
  includeReadOnly: boolean;
  onlyRealm: boolean;
  onlyGlobal: boolean;
  resultCallback?: ResultCallback<AmConfigEntityInterface>;
  state: State;
}): Promise<ConfigEntityExportInterface> {
  debugMessage({
    message: `AmConfigOps.exportAmConfigEntities: start`,
    state,
  });
  const entities = await getConfigEntities({
    includeReadOnly,
    onlyRealm,
    onlyGlobal,
    resultCallback: getErrorCallback(resultCallback),
    state,
  });
  const exportData = await createConfigEntityExportTemplate({
    state,
    realms: Object.keys(entities.realm),
  });
  const totalEntities =
    Object.keys(entities.global).length +
    Object.values(entities.realm).reduce(
      (total, realmEntities) => total + Object.keys(realmEntities).length,
      0
    );
  const indicatorId = createProgressIndicator({
    total: totalEntities,
    message: 'Exporting am config entities...',
    state,
  });
  exportData.global = processConfigEntitiesForExport({
    state,
    indicatorId,
    entities: entities.global,
    resultCallback,
  });
  Object.entries(entities.realm).forEach(
    ([key, value]) =>
      (exportData.realm[key] = processConfigEntitiesForExport({
        state,
        indicatorId,
        entities: value,
        resultCallback,
      }))
  );
  stopProgressIndicator({
    id: indicatorId,
    message: `Exported ${totalEntities} am config entities.`,
    state,
  });
  return exportData;
}

/**
 * Import all other AM config entities
 * @param {ConfigEntityExportInterface} importData The config import data
 * @param {ResultCallback} resultCallback Optional callback to process individual results
 * @returns {Promise<ConfigSkeleton | null>} a promise that resolves to a config object containing global and realm config entities, or null if no import was performed
 */
export async function importAmConfigEntities({
  importData,
  resultCallback = void 0,
  state,
}: {
  importData: ConfigEntityExportInterface;
  resultCallback?: ResultCallback<AmConfigEntityInterface>;
  state: State;
}): Promise<ConfigSkeleton | null> {
  debugMessage({
    message: `ServiceOps.importAmConfigEntities: start`,
    state,
  });
  const result = await putConfigEntities({
    config: importData as unknown as ConfigSkeleton,
    resultCallback,
    state,
  });
  debugMessage({ message: `AmConfigOps.importAmConfigEntities: end`, state });
  // If no import was accomplished, return null
  if (
    Object.keys(result.global).length === 0 &&
    !Object.values(result.realm).find((r) => Object.keys(r).length > 0)
  ) {
    return null;
  }
  return result;
}

/**
 * Helper to process the API results into export format
 * @param {AmConfigEntities} entities the entities being processed
 * @param {string} indicatorId the progress indicator id
 * @param {ResultCallback} resultCallback Optional callback to process individual exports
 * @returns {Record<string, AmConfigEntityInterface>} the processed entities
 */
function processConfigEntitiesForExport({
  state,
  entities,
  indicatorId,
  resultCallback,
}: {
  state: State;
  entities: AmConfigEntitiesInterface;
  indicatorId: string;
  resultCallback: ResultCallback<AmConfigEntityInterface>;
}): Record<string, Record<string, AmConfigEntityInterface>> {
  const exportedEntities = {};
  const entries = Object.entries(entities);
  for (const [key, value] of entries) {
    updateProgressIndicator({
      id: indicatorId,
      message: `Exporting ${key}`,
      state,
    });
    if (!value) {
      continue;
    }
    if (!value.result) {
      if ((value as AmConfigEntityInterface)._id) {
        exportedEntities[key] = {
          [(value as AmConfigEntityInterface)._id]: value,
        };
      } else if (
        (value as AmConfigEntityInterface)._type &&
        (value as AmConfigEntityInterface)._type._id
      ) {
        exportedEntities[key] = {
          [(value as AmConfigEntityInterface)._type._id]: value,
        };
      } else {
        exportedEntities[key] = value;
      }
    } else {
      const { result } = value as PagedResult<AmConfigEntityInterface>;
      const exportedValue = {};
      result.forEach((o) => (exportedValue[o._id] = o));
      exportedEntities[key] = exportedValue;
    }
    if (resultCallback) {
      resultCallback(undefined, exportedEntities[key]);
    }
  }
  return exportedEntities;
}
