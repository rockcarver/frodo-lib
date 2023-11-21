import {
  type CircleOfTrustSkeleton,
  createCircleOfTrust as _createCircleOfTrust,
  deleteCircleOfTrust as _deleteCircleOfTrust,
  getCircleOfTrust as _getCircleOfTrust,
  getCirclesOfTrust as _getCirclesOfTrust,
  updateCircleOfTrust as _updateCircleOfTrust,
} from '../api/CirclesOfTrustApi';
import { type Saml2ProviderSkeleton } from '../api/Saml2Api';
import { type ScriptSkeleton } from '../api/ScriptApi';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { type ExportMetaData } from './OpsTypes';
import { readSaml2EntityIds } from './Saml2Ops';

export type CirclesOfTrust = {
  /**
   * Create an empty agent export template
   * @returns {CirclesOfTrustExportInterface} an empty agent export template
   */
  createCirclesOfTrustExportTemplate(): CirclesOfTrustExportInterface;
  /**
   * Read all circles of trust
   * @param {string[]} entityProviders filter by entity providers
   */
  readCirclesOfTrust(
    entityProviders?: string[]
  ): Promise<CircleOfTrustSkeleton[]>;
  /**
   * Read circle of trust
   * @param {string} cotId circle of trust id/name
   */
  readCircleOfTrust(cotId: string): Promise<CircleOfTrustSkeleton>;
  /**
   * Create circle of trust
   * @param {string} cotId circle of trust id/name
   * @param {CircleOfTrustSkeleton} cotData circle of trust data
   */
  createCircleOfTrust(
    cotId?: string,
    cotData?: CircleOfTrustSkeleton
  ): Promise<CircleOfTrustSkeleton>;
  /**
   * Update circle of trust
   * @param {string} cotId circle of trust id/name
   * @param cotData circle of trust data
   */
  updateCircleOfTrust(
    cotId: string,
    cotData: CircleOfTrustSkeleton
  ): Promise<CircleOfTrustSkeleton>;
  /**
   * Delete circle of trust
   * @param {string} cotId circle of trust id/name
   */
  deleteCircleOfTrust(cotId: string): Promise<CircleOfTrustSkeleton>;
  /**
   * Delete circles of trust
   * @param {string[]} entityProviders filter by entity providers
   */
  deleteCirclesOfTrust(
    entityProviders?: string[]
  ): Promise<CircleOfTrustSkeleton[]>;
  /**
   * Export circle of trust
   * @param {string} cotId circle of trust id/name
   */
  exportCircleOfTrust(cotId: string): Promise<CirclesOfTrustExportInterface>;
  /**
   * Export all circles of trust
   * @param {string[]} entityProviders filter by entity providers
   */
  exportCirclesOfTrust(
    entityProviders?: string[]
  ): Promise<CirclesOfTrustExportInterface>;
  /**
   * Import a circle of trust by id/name from file
   * @param {string} cotId Circle of trust id/name
   * @param {CirclesOfTrustExportInterface} importData Import data
   * @returns {Promise<CircleOfTrustSkeleton[]>} a promise resolving to the circle of trust object that was created or updated. Note: If the circle of trust already exists and does not need updating, null is returned.
   */
  importCircleOfTrust(
    cotId: string,
    importData: CirclesOfTrustExportInterface
  ): Promise<CircleOfTrustSkeleton>;
  /**
   * Import first circle of trust
   * @param {CirclesOfTrustExportInterface} importData Import data
   * @returns {Promise<CircleOfTrustSkeleton[]>} a promise resolving to the circle of trust object that was created or updated. Note: If the circle of trust already exists and does not need updating, null is returned.
   */
  importFirstCircleOfTrust(
    importData: CirclesOfTrustExportInterface
  ): Promise<CircleOfTrustSkeleton>;
  /**
   * Import all circles of trust
   * @param {string[]} entityProviders filter by entity providers
   * @param {CirclesOfTrustExportInterface} importData Import data
   * @returns {Promise<CircleOfTrustSkeleton[]>} a promise resolving to an array of circle of trust objects that were created or updated. Note: If a circle of trust already exists and does not need updating, it is omitted from the response array.
   */
  importCirclesOfTrust(
    importData: CirclesOfTrustExportInterface,
    entityProviders?: string[]
  ): Promise<CircleOfTrustSkeleton[]>;

  // Deprecated

  /**
   * Get all circles of trust
   * @returns {Promise<CircleOfTrustSkeleton[]>} a promise resolving to an array of circle of trust objects
   * @deprecated since v2.0.0 use {@link CirclesOfTrust.readCirclesOfTrust | readCirclesOfTrust} instead
   * ```javascript
   * readCirclesOfTrust(): Promise<CircleOfTrustSkeleton[]>
   * ```
   * @group Deprecated
   */
  getCirclesOfTrust(): Promise<CircleOfTrustSkeleton[]>;
  /**
   * Get circle of trust
   * @param {string} cotId circle of trust id/name
   * @returns {Promise<CircleOfTrustSkeleton>} a promise resolving to a circle of trust object
   * @deprecated since v2.0.0 use {@link CirclesOfTrust.readCircleOfTrust | readCircleOfTrust} instead
   * ```javascript
   * readCircleOfTrust(cotId: string): Promise<CircleOfTrustSkeleton>
   * ```
   * @group Deprecated
   */
  getCircleOfTrust(cotId: string): Promise<CircleOfTrustSkeleton>;
};

export default (state: State): CirclesOfTrust => {
  return {
    createCirclesOfTrustExportTemplate() {
      return createCirclesOfTrustExportTemplate({ state });
    },
    async readCirclesOfTrust(entityProviders: string[] = []) {
      return readCirclesOfTrust({ entityProviders, state });
    },
    async readCircleOfTrust(cotId: string) {
      return readCircleOfTrust({ cotId, state });
    },
    async createCircleOfTrust(cotId: string, cotData: CircleOfTrustSkeleton) {
      return createCircleOfTrust({ cotId, cotData, state });
    },
    async updateCircleOfTrust(cotId: string, cotData: CircleOfTrustSkeleton) {
      return updateCircleOfTrust({ cotId, cotData, state });
    },
    async deleteCircleOfTrust(cotId: string) {
      return deleteCircleOfTrust({ cotId, state });
    },
    async deleteCirclesOfTrust(
      entityProviders: string[] = []
    ): Promise<CircleOfTrustSkeleton[]> {
      return deleteCirclesOfTrust({ entityProviders, state });
    },
    async exportCircleOfTrust(cotId: string) {
      return exportCircleOfTrust({ cotId, state });
    },
    async exportCirclesOfTrust(entityProviders: string[] = []) {
      return exportCirclesOfTrust({ entityProviders, state });
    },
    async importCircleOfTrust(
      cotId: string,
      importData: CirclesOfTrustExportInterface
    ) {
      return importCircleOfTrust({ cotId, importData, state });
    },
    async importFirstCircleOfTrust(importData: CirclesOfTrustExportInterface) {
      return importFirstCircleOfTrust({ importData, state });
    },
    async importCirclesOfTrust(
      importData: CirclesOfTrustExportInterface,
      entityProviders: string[] = []
    ) {
      return importCirclesOfTrust({ importData, entityProviders, state });
    },

    // Deprecated

    async getCirclesOfTrust() {
      return readCirclesOfTrust({ state });
    },
    async getCircleOfTrust(cotId: string) {
      return readCircleOfTrust({ cotId, state });
    },
  };
};

export interface CirclesOfTrustExportInterface {
  meta?: ExportMetaData;
  script: Record<string, ScriptSkeleton>;
  saml: {
    hosted: Record<string, Saml2ProviderSkeleton>;
    remote: Record<string, Saml2ProviderSkeleton>;
    metadata: Record<string, string[]>;
    cot: Record<string, CircleOfTrustSkeleton>;
  };
}

/**
 * Create an empty agent export template
 * @returns {CirclesOfTrustExportInterface} an empty agent export template
 */
export function createCirclesOfTrustExportTemplate({
  state,
}: {
  state: State;
}): CirclesOfTrustExportInterface {
  return {
    meta: getMetadata({ state }),
    script: {},
    saml: {
      hosted: {},
      remote: {},
      metadata: {},
      cot: {},
    },
  } as CirclesOfTrustExportInterface;
}

/**
 * Get circles of trust
 */
export async function readCirclesOfTrust({
  entityProviders = [],
  state,
}: {
  entityProviders?: string[];
  state: State;
}): Promise<CircleOfTrustSkeleton[]> {
  debugMessage({
    message: `CirclesOfTrustOps.getCirclesOfTrust: start`,
    state,
  });
  let { result } = await _getCirclesOfTrust({ state });
  if (entityProviders.length) {
    debugMessage({
      message: `CirclesOfTrustOps.getCirclesOfTrust: filtering results to entity providers: ${entityProviders}`,
      state,
    });
    entityProviders = entityProviders.map((id) => `${id}|saml2`);
    result = result.filter((circleOfTrust) => {
      let hasEntityId = false;
      for (const trustedProvider of circleOfTrust.trustedProviders) {
        if (!hasEntityId && entityProviders.includes(trustedProvider)) {
          hasEntityId = true;
        }
      }
      return hasEntityId;
    });
  }
  debugMessage({
    message: `CirclesOfTrustOps.getCirclesOfTrust: end`,
    state,
  });
  return result;
}

/**
 * Get circle of trust
 * @param {string} cotId circle of trust id/name
 * @returns {Promise<CirclesOfTrustExportInterface>} a promise that resolves to an CirclesOfTrustExportInterface object
 */
export async function readCircleOfTrust({
  cotId,
  state,
}: {
  cotId: string;
  state: State;
}): Promise<CircleOfTrustSkeleton> {
  return _getCircleOfTrust({ cotId, state });
}

/**
 * Create circle of trust
 * @param {string} cotId circle of trust id/name
 * @param {CircleOfTrustSkeleton} cotData circle of trust data
 * @returns {Promise<CirclesOfTrustExportInterface>} a promise that resolves to an CirclesOfTrustExportInterface object
 */
export async function createCircleOfTrust({
  cotId = undefined,
  cotData = {},
  state,
}: {
  cotId?: string;
  cotData?: CircleOfTrustSkeleton;
  state: State;
}): Promise<CircleOfTrustSkeleton> {
  if (cotId) cotData._id = cotId;
  try {
    const response = await _createCircleOfTrust({ cotData, state });
    return response;
  } catch (error) {
    if (
      error.response?.data?.code === 500 &&
      error.response?.data?.message ===
        "Unable to update entity provider's circle of trust"
    ) {
      const response = await _updateCircleOfTrust({ cotId, cotData, state });
      return response;
    } else {
      throw error;
    }
  }
}

/**
 * Update circle of trust
 * @param {string} cotId circle of trust id/name
 * @param {CircleOfTrustSkeleton} cotData circle of trust data
 * @returns {Promise<CirclesOfTrustExportInterface>} a promise that resolves to an CirclesOfTrustExportInterface object
 */
export async function updateCircleOfTrust({
  cotId,
  cotData,
  state,
}: {
  cotId: string;
  cotData: CircleOfTrustSkeleton;
  state: State;
}): Promise<CircleOfTrustSkeleton> {
  try {
    const response = await _updateCircleOfTrust({ cotId, cotData, state });
    return response;
  } catch (error) {
    if (
      error.response?.data?.code === 500 &&
      (error.response?.data?.message ===
        "Unable to update entity provider's circle of trust" ||
        error.response?.data?.message ===
          'An error occurred while updating the COT memberships')
    ) {
      const response = await _updateCircleOfTrust({ cotId, cotData, state });
      return response;
    } else {
      throw error;
    }
  }
}

/**
 * Delete circle of trust
 * @param {string} cotId circle of trust id/name
 * @returns {Promise<CirclesOfTrustExportInterface>} a promise that resolves to an CirclesOfTrustExportInterface object
 */
export async function deleteCircleOfTrust({
  cotId,
  state,
}: {
  cotId: string;
  state: State;
}): Promise<CircleOfTrustSkeleton> {
  return _deleteCircleOfTrust({ cotId, state });
}

/**
 * Delete circles of trust
 * @returns {Promise<CirclesOfTrustExportInterface>} a promise that resolves to an CirclesOfTrustExportInterface object
 */
export async function deleteCirclesOfTrust({
  entityProviders = [],
  state,
}: {
  entityProviders?: string[];
  state: State;
}): Promise<CircleOfTrustSkeleton[]> {
  debugMessage({
    message: `CirclesOfTrustOps.deleteCirclesOfTrust: start`,
    state,
  });
  const deleted: CircleOfTrustSkeleton[] = [];
  const errors = [];
  try {
    const cots = await readCirclesOfTrust({ entityProviders, state });
    for (const cot of cots) {
      try {
        deleted.push(await deleteCircleOfTrust({ cotId: cot._id, state }));
      } catch (error) {
        errors.push(error);
      }
    }
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Export error:\n${errorMessages}`);
  }
  debugMessage({
    message: `CirclesOfTrustOps.deleteCirclesOfTrust: end`,
    state,
  });
  return deleted;
}

/**
 * Export circle of trust
 * @param {string} cotId circle of trust id/name
 * @returns {Promise<CirclesOfTrustExportInterface>} a promise that resolves to an CirclesOfTrustExportInterface object
 */
export async function exportCircleOfTrust({
  cotId,
  state,
}: {
  cotId: string;
  state: State;
}): Promise<CirclesOfTrustExportInterface> {
  debugMessage({
    message: `CirclesOfTrustOps.exportCircleOfTrust: start`,
    state,
  });
  const exportData = createCirclesOfTrustExportTemplate({ state });
  const errors = [];
  try {
    const cotData = await readCircleOfTrust({
      cotId,
      state,
    });
    exportData.saml.cot[cotData._id] = cotData;
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors
      .map((error) => {
        if (error.response?.status === 404) {
          return `Circle of trust ${cotId} does not exist in realm ${state.getRealm()}`;
        } else {
          return error.response?.data?.message || error.message;
        }
      })
      .join('\n');
    throw new Error(`Export error:\n${errorMessages}`);
  }
  debugMessage({
    message: `CirclesOfTrustOps.exportCircleOfTrust: end`,
    state,
  });
  return exportData;
}

/**
 * Export circles of trust
 * @returns {Promise<CirclesOfTrustExportInterface>} a promise that resolves to an CirclesOfTrustExportInterface object
 */
export async function exportCirclesOfTrust({
  entityProviders = [],
  state,
}: {
  entityProviders?: string[];
  state: State;
}): Promise<CirclesOfTrustExportInterface> {
  debugMessage({
    message: `CirclesOfTrustOps.exportCirclesOfTrust: start`,
    state,
  });
  const exportData = createCirclesOfTrustExportTemplate({ state });
  const errors = [];
  try {
    const cots = await readCirclesOfTrust({ entityProviders, state });
    createProgressIndicator({
      total: cots.length,
      message: 'Exporting circles of trust...',
      state,
    });
    for (const cot of cots) {
      updateProgressIndicator({
        message: `Exporting circle of trust ${cot._id}`,
        state,
      });
      exportData.saml.cot[cot._id] = cot;
    }
    stopProgressIndicator({
      message: `Exported ${cots.length} circles of trust.`,
      state,
    });
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Export error:\n${errorMessages}`);
  }
  debugMessage({
    message: `CirclesOfTrustOps.exportCirclesOfTrust: end`,
    state,
  });
  return exportData;
}

/**
 * Import a circle of trust by id/name from file
 * @param {String} cotId Circle of trust id/name
 * @param {CirclesOfTrustExportInterface} importData import data
 */
export async function importCircleOfTrust({
  cotId,
  importData,
  state,
}: {
  cotId: string;
  importData: CirclesOfTrustExportInterface;
  state: State;
}) {
  let response = null;
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.saml.cot)) {
    if (id === cotId) {
      try {
        const validEntityIds = await readSaml2EntityIds({ state });
        const validProviders = validEntityIds.map((id) => `${id}|saml2`);
        const cotData = importData.saml.cot[id];
        delete cotData._rev;
        // only allow adding valid providers
        cotData.trustedProviders = validProviders.filter((value) =>
          cotData.trustedProviders.includes(value)
        );
        try {
          response = await createCircleOfTrust({ cotId, cotData, state });
        } catch (createError) {
          if (createError.response?.status === 409) {
            debugMessage({
              message: `Circle of trust: ${cotId} already exists, updating...`,
              state,
            });
            const existingCot = await readCircleOfTrust({ cotId, state });
            debugMessage({
              message: `CirclesOfTrustOps.importCirclesOfTrust: Existing trusted providers for ${cotId}:\n${existingCot.trustedProviders
                .map((it) => it.split('|')[0])
                .join('\n')}.`,
              state,
            });
            const providers = [
              ...new Set([
                ...existingCot.trustedProviders,
                ...cotData.trustedProviders,
              ]),
            ];
            debugMessage({
              message: `CirclesOfTrustOps.importCirclesOfTrust: Merged trusted providers for ${cotId}:\n${providers
                .map((it) => it.split('|')[0])
                .join('\n')}.`,
              state,
            });
            if (providers.length > existingCot.trustedProviders.length) {
              existingCot.trustedProviders = providers;
              response = await updateCircleOfTrust({
                cotId,
                cotData: existingCot,
                state,
              });
            } else {
              debugMessage({
                message: `CirclesOfTrustOps.importCirclesOfTrust: No new trusted providers for ${cotId}.`,
                state,
              });
            }
          } else {
            throw createError;
          }
        }
        imported.push(id);
      } catch (error) {
        errors.push(error);
      }
    }
  }
  if (errors.length) {
    const errorMessages = errors
      .map((error) => JSON.stringify(error.response?.data) || error.message)
      .join('\n');
    throw new Error(`Import error:\n${errorMessages}`);
  }
  if (0 === imported.length) {
    throw new Error(`Import error:\n${cotId} not found in import data!`);
  }
  return response;
}

/**
 * Import first circle of trust
 * @param {CirclesOfTrustExportInterface} importData import data
 */
export async function importFirstCircleOfTrust({
  importData,
  state,
}: {
  importData: CirclesOfTrustExportInterface;
  state: State;
}) {
  let response = null;
  const errors = [];
  const imported = [];
  for (const cotId of Object.keys(importData.saml.cot)) {
    try {
      const validEntityIds = await readSaml2EntityIds({ state });
      const validProviders = validEntityIds.map((id) => `${id}|saml2`);
      const cotData = importData.saml.cot[cotId];
      delete cotData._rev;
      // only allow adding valid providers
      cotData.trustedProviders = validProviders.filter((value) =>
        cotData.trustedProviders.includes(value)
      );
      try {
        response = await createCircleOfTrust({ cotId, cotData, state });
      } catch (createError) {
        if (createError.response?.status === 409) {
          debugMessage({
            message: `Circle of trust: ${cotId} already exists, updating...`,
            state,
          });
          const existingCot = await readCircleOfTrust({ cotId, state });
          debugMessage({
            message: `CirclesOfTrustOps.importCirclesOfTrust: Existing trusted providers for ${cotId}:\n${existingCot.trustedProviders
              .map((it) => it.split('|')[0])
              .join('\n')}.`,
            state,
          });
          const providers = [
            ...new Set([
              ...existingCot.trustedProviders,
              ...cotData.trustedProviders,
            ]),
          ];
          debugMessage({
            message: `CirclesOfTrustOps.importCirclesOfTrust: Merged trusted providers for ${cotId}:\n${providers
              .map((it) => it.split('|')[0])
              .join('\n')}.`,
            state,
          });
          if (providers.length > existingCot.trustedProviders.length) {
            existingCot.trustedProviders = providers;
            response = await updateCircleOfTrust({
              cotId,
              cotData: existingCot,
              state,
            });
          } else {
            debugMessage({
              message: `CirclesOfTrustOps.importCirclesOfTrust: No new trusted providers for ${cotId}.`,
              state,
            });
          }
        } else {
          throw createError;
        }
      }
      imported.push(cotId);
    } catch (error) {
      errors.push(error);
    }
    break;
  }
  if (errors.length) {
    const errorMessages = errors
      .map((error) => error.response?.data?.message || error.message)
      .join('\n');
    throw new Error(`Import error:\n${errorMessages}`);
  }
  if (0 === imported.length) {
    throw new Error(`Import error:\nNo circles of trust found in import data!`);
  }
  return response;
}

/**
 * Import circles of trust
 * @param {CirclesOfTrustExportInterface} importData import data
 */
export async function importCirclesOfTrust({
  entityProviders = [],
  importData,
  state,
}: {
  entityProviders?: string[];
  importData: CirclesOfTrustExportInterface;
  state: State;
}): Promise<CircleOfTrustSkeleton[]> {
  const responses = [];
  const errors = [];
  const imported = [];
  entityProviders = entityProviders.map((id) => `${id}|saml2`);
  const validEntityIds = await readSaml2EntityIds({ state });
  const validProviders = validEntityIds.map((id) => `${id}|saml2`);
  for (const cotId of Object.keys(importData.saml.cot)) {
    try {
      const cotData: CircleOfTrustSkeleton = importData.saml.cot[cotId];
      delete cotData._rev;
      // apply filter and merge logic
      if (entityProviders.length) {
        // only allow filtering for valid providers
        entityProviders = validProviders.filter((value) =>
          entityProviders.includes(value)
        );
        // determine if cot import candidate matches entity providers filter
        let hasEntityId = false;
        for (const trustedProvider of cotData.trustedProviders) {
          if (!hasEntityId && entityProviders.includes(trustedProvider)) {
            hasEntityId = true;
          }
        }
        if (hasEntityId) {
          try {
            const response = await createCircleOfTrust({
              cotId,
              cotData,
              state,
            });
            imported.push(cotId);
            responses.push(response);
          } catch (createError) {
            if (createError.response?.status === 409) {
              debugMessage({
                message: `Circle of trust: ${cotId} already exists, updating...`,
                state,
              });
              const existingCot = await readCircleOfTrust({ cotId, state });
              debugMessage({
                message: `CirclesOfTrustOps.importCirclesOfTrust: Existing trusted providers for ${cotId}:\n${existingCot.trustedProviders
                  .map((it) => it.split('|')[0])
                  .join('\n')}.`,
                state,
              });
              const providers = [
                ...new Set([
                  ...existingCot.trustedProviders,
                  ...entityProviders,
                ]),
              ];
              debugMessage({
                message: `CirclesOfTrustOps.importCirclesOfTrust: Updated trusted providers for ${cotId}:\n${providers
                  .map((it) => it.split('|')[0])
                  .join('\n')}.`,
                state,
              });
              if (providers.length > existingCot.trustedProviders.length) {
                existingCot.trustedProviders = providers;
                const response = await updateCircleOfTrust({
                  cotId,
                  cotData: existingCot,
                  state,
                });
                imported.push(cotId);
                responses.push(response);
              } else {
                debugMessage({
                  message: `CirclesOfTrustOps.importCirclesOfTrust: No new trusted providers for ${cotId}.`,
                  state,
                });
              }
            } else {
              throw createError;
            }
          }
        }
      }
      // import unfiltered but merge if existing cot
      else {
        // only allow adding valid providers
        cotData.trustedProviders = validProviders.filter((value) =>
          cotData.trustedProviders.includes(value)
        );
        try {
          const response = await createCircleOfTrust({ cotId, cotData, state });
          responses.push(response);
        } catch (createError) {
          if (createError.response?.status === 409) {
            debugMessage({
              message: `Circle of trust: ${cotId} already exists, updating...`,
              state,
            });
            const existingCot = await readCircleOfTrust({ cotId, state });
            debugMessage({
              message: `CirclesOfTrustOps.importCirclesOfTrust: Existing trusted providers for ${cotId}:\n${existingCot.trustedProviders
                .map((it) => it.split('|')[0])
                .join('\n')}.`,
              state,
            });
            const providers = [
              ...new Set([
                ...existingCot.trustedProviders,
                ...cotData.trustedProviders,
              ]),
            ];
            debugMessage({
              message: `CirclesOfTrustOps.importCirclesOfTrust: Merged trusted providers for ${cotId}:\n${providers
                .map((it) => it.split('|')[0])
                .join('\n')}.`,
              state,
            });
            if (providers.length > existingCot.trustedProviders.length) {
              existingCot.trustedProviders = providers;
              const response = await updateCircleOfTrust({
                cotId,
                cotData: existingCot,
                state,
              });
              responses.push(response);
            } else {
              debugMessage({
                message: `CirclesOfTrustOps.importCirclesOfTrust: No new trusted providers for ${cotId}.`,
                state,
              });
            }
          } else {
            throw createError;
          }
        }
      }
    } catch (error) {
      debugMessage({
        message: `Error ${error.response?.status} creating/updating circle of trust: ${error.response?.data?.message}`,
        state,
      });
      errors.push(error);
    }
    imported.push(cotId);
  }
  if (errors.length) {
    const errorMessages = errors
      .map((error) => error.response?.data?.message || error.message)
      .join('\n');
    throw new Error(`${errorMessages}`);
  }
  if (0 === imported.length) {
    throw new Error(`Import error:\nNo circles of trust found in import data!`);
  }
  return responses;
}
