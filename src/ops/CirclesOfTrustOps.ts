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
import { FrodoError } from './FrodoError';
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
    ): Promise<CircleOfTrustSkeleton[]> {
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
  try {
    debugMessage({
      message: `CirclesOfTrustOps.readCirclesOfTrust: start`,
      state,
    });
    let { result } = await _getCirclesOfTrust({ state });
    if (entityProviders.length) {
      debugMessage({
        message: `CirclesOfTrustOps.readCirclesOfTrust: filtering results to entity providers: ${entityProviders}`,
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
      message: `CirclesOfTrustOps.readCirclesOfTrust: end`,
      state,
    });
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading circles of trust`, error);
  }
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
  try {
    const response = await _getCircleOfTrust({ cotId, state });
    return response;
  } catch (error) {
    throw new FrodoError(`Error reading circle of trust ${cotId}`, error);
  }
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
  } catch (createError) {
    if (
      createError.response?.data?.code === 500 &&
      createError.response?.data?.message ===
        "Unable to update entity provider's circle of trust"
    ) {
      try {
        const response = await _updateCircleOfTrust({ cotId, cotData, state });
        return response;
      } catch (updateError) {
        throw new FrodoError(
          `Error creating circle of trust ${cotId}`,
          updateError
        );
      }
    } else {
      throw new FrodoError(
        `Error creating circle of trust ${cotId}`,
        createError
      );
    }
  }
}

/**
 * Update circle of trust
 * @param {string} cotId circle of trust id/name
 * @param {CircleOfTrustSkeleton} cotData circle of trust data
 * @returns {Promise<CircleOfTrustSkeleton>} a promise that resolves to an CircleOfTrustSkeleton object
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
    return response || cotData;
  } catch (error) {
    if (
      error.response?.data?.code === 500 &&
      (error.response?.data?.message ===
        "Unable to update entity provider's circle of trust" ||
        error.response?.data?.message ===
          'An error occurred while updating the COT memberships')
    ) {
      try {
        const response = await _updateCircleOfTrust({ cotId, cotData, state });
        return response || cotData;
      } catch (error) {
        throw new FrodoError(`Error updating circle of trust ${cotId}`, error);
      }
    } else {
      throw new FrodoError(`Error updating circle of trust ${cotId}`, error);
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
  try {
    const response = await _deleteCircleOfTrust({ cotId, state });
    return response;
  } catch (error) {
    throw new FrodoError(`Error deleting circle of trust ${cotId}`, error);
  }
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
  const errors: Error[] = [];
  try {
    debugMessage({
      message: `CirclesOfTrustOps.deleteCirclesOfTrust: start`,
      state,
    });
    const deleted: CircleOfTrustSkeleton[] = [];
    const cots = await readCirclesOfTrust({ entityProviders, state });
    for (const cot of cots) {
      try {
        deleted.push(await deleteCircleOfTrust({ cotId: cot._id, state }));
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error deleting circles of trust`, errors);
    }
    debugMessage({
      message: `CirclesOfTrustOps.deleteCirclesOfTrust: end`,
      state,
    });
    return deleted;
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error deleting circles of trust`, errors);
  }
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
  try {
    debugMessage({
      message: `CirclesOfTrustOps.exportCircleOfTrust: start`,
      state,
    });
    const exportData = createCirclesOfTrustExportTemplate({ state });
    const cotData = await readCircleOfTrust({
      cotId,
      state,
    });
    exportData.saml.cot[cotData._id] = cotData;
    debugMessage({
      message: `CirclesOfTrustOps.exportCircleOfTrust: end`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting circle of trust ${cotId}`, error);
  }
}

/**
 * Application export options
 */
export type CircleOfTrustExportOptions = {
  /**
   * Indicate progress
   */
  indicateProgress: boolean;
};

/**
 * Export circles of trust
 * @returns {Promise<CirclesOfTrustExportInterface>} a promise that resolves to an CirclesOfTrustExportInterface object
 */
export async function exportCirclesOfTrust({
  entityProviders = [],
  options = { indicateProgress: true },
  state,
}: {
  entityProviders?: string[];
  options?: CircleOfTrustExportOptions;
  state: State;
}): Promise<CirclesOfTrustExportInterface> {
  try {
    debugMessage({
      message: `CirclesOfTrustOps.exportCirclesOfTrust: start`,
      state,
    });
    const exportData = createCirclesOfTrustExportTemplate({ state });
    let indicatorId: string;
    const cots = await readCirclesOfTrust({ entityProviders, state });
    if (options.indicateProgress)
      indicatorId = createProgressIndicator({
        total: cots.length,
        message: 'Exporting circles of trust...',
        state,
      });
    for (const cot of cots) {
      if (options.indicateProgress)
        updateProgressIndicator({
          id: indicatorId,
          message: `Exporting circle of trust ${cot._id}`,
          state,
        });
      exportData.saml.cot[cot._id] = cot;
    }
    if (options.indicateProgress)
      stopProgressIndicator({
        id: indicatorId,
        message:
          cots.length > 1 ? `Exported ${cots.length} circles of trust.` : null,
        state,
      });
    debugMessage({
      message: `CirclesOfTrustOps.exportCirclesOfTrust: end`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting circles of trust`);
  }
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
  const imported = [];
  try {
    let response = null;
    for (const id of Object.keys(importData.saml.cot)) {
      if (id === cotId) {
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
          return response;
        } catch (createError) {
          if ((createError as FrodoError).httpStatus === 409) {
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
              imported.push(id);
              return response;
            } else {
              debugMessage({
                message: `CirclesOfTrustOps.importCirclesOfTrust: No new trusted providers for ${cotId}.`,
                state,
              });
              imported.push(id);
              return existingCot;
            }
          } else {
            throw createError;
          }
        }
      }
    }
    if (imported.length == 0) {
      throw new FrodoError(`Import error:\n${cotId} not found in import data!`);
    }
  } catch (error) {
    // just re-throw our own errors
    if (imported.length == 0) {
      throw error;
    }
    throw new FrodoError(`Error importing circle of trust ${cotId}`);
  }
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
}): Promise<CircleOfTrustSkeleton> {
  try {
    for (const cotId of Object.keys(importData.saml.cot)) {
      const validEntityIds = await readSaml2EntityIds({ state });
      const validProviders = validEntityIds.map((id) => `${id}|saml2`);
      const cotData = importData.saml.cot[cotId];
      delete cotData._rev;
      // only allow adding valid providers
      cotData.trustedProviders = validProviders.filter((value) =>
        cotData.trustedProviders.includes(value)
      );
      try {
        const response = await createCircleOfTrust({ cotId, cotData, state });
        return response;
      } catch (createError) {
        if ((createError as FrodoError).httpStatus === 409) {
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
            return response;
          } else {
            debugMessage({
              message: `CirclesOfTrustOps.importCirclesOfTrust: No new trusted providers for ${cotId}.`,
              state,
            });
            return existingCot;
          }
        } else {
          throw createError;
        }
      }
      break;
    }
  } catch (error) {
    throw new FrodoError(`Error importing first circle of trust`, error);
  }
  throw new FrodoError(`No circles of trust found in import data!`);
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
  try {
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
              if ((createError as FrodoError).httpStatus === 409) {
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
            const response = await createCircleOfTrust({
              cotId,
              cotData,
              state,
            });
            responses.push(response);
          } catch (createError) {
            if ((createError as FrodoError).httpStatus === 409) {
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
    if (errors.length > 0) {
      throw new FrodoError(`Error importing circles of trust`);
    }
    if (0 === imported.length) {
      throw new Error(
        `Import error:\nNo circles of trust found in import data!`
      );
    }
    return responses;
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0 || imported.length == 0) {
      throw error;
    }
    throw new FrodoError(`Error importing circles of trust`, error);
  }
}
