import { debugMessage } from '../utils/Console';
import {
  getCirclesOfTrust as _getCirclesOfTrust,
  getCircleOfTrust as _getCircleOfTrust,
  createCircleOfTrust as _createCircleOfTrust,
  updateCircleOfTrust as _updateCircleOfTrust,
  deleteCircleOfTrust as _deleteCircleOfTrust,
} from '../api/CirclesOfTrustApi';
import { getMetadata } from '../utils/ExportImportUtils';
import { State } from '../shared/State';
import { CirclesOfTrustExportInterface } from './OpsTypes';
import { CircleOfTrustSkeleton } from '../api/ApiTypes';

export type CirclesOfTrust = {
  /**
   * Create an empty agent export template
   * @returns {CirclesOfTrustExportInterface} an empty agent export template
   */
  createCirclesOfTrustExportTemplate(): CirclesOfTrustExportInterface;
  /**
   * Read all circles of trust
   */
  readCirclesOfTrust(): Promise<CircleOfTrustSkeleton[]>;
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
   * Export circle of trust
   * @param {string} cotId circle of trust id/name
   */
  exportCircleOfTrust(cotId: string): Promise<CirclesOfTrustExportInterface>;
  /**
   * Export all circles of trust
   */
  exportCirclesOfTrust(): Promise<CirclesOfTrustExportInterface>;
  /**
   * Import a circle of trust by id/name from file
   * @param {string} cotId Circle of trust id/name
   * @param {CirclesOfTrustExportInterface} importData Import data
   */
  importCircleOfTrust(
    cotId: string,
    importData: CirclesOfTrustExportInterface
  ): Promise<CircleOfTrustSkeleton>;
  /**
   * Import first circle of trust
   * @param {CirclesOfTrustExportInterface} importData Import data
   */
  importFirstCircleOfTrust(
    importData: CirclesOfTrustExportInterface
  ): Promise<CircleOfTrustSkeleton>;
  /**
   * Import all circles of trust
   * @param {CirclesOfTrustExportInterface} importData Import file name
   */
  importCirclesOfTrust(
    importData: CirclesOfTrustExportInterface
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
    async readCirclesOfTrust() {
      return readCirclesOfTrust({ state });
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
    async exportCircleOfTrust(cotId: string) {
      return exportCircleOfTrust({ cotId, state });
    },
    async exportCirclesOfTrust() {
      return exportCirclesOfTrust({ state });
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
    async importCirclesOfTrust(importData: CirclesOfTrustExportInterface) {
      return importCirclesOfTrust({ importData, state });
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
  if (entityProviders.length > 0) {
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
  return _createCircleOfTrust({ cotData, state });
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
  return _updateCircleOfTrust({ cotId, cotData, state });
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
    for (const cot of cots) {
      exportData.saml.cot[cot._id] = cot;
    }
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
        const cotData = importData.saml.cot[id];
        delete cotData._rev;
        try {
          response = await createCircleOfTrust({ cotData, state });
        } catch (createError) {
          if (createError.response?.status === 409)
            response = await updateCircleOfTrust({
              cotId: id,
              cotData,
              state,
            });
          else throw createError;
        }
        imported.push(id);
      } catch (error) {
        errors.push(error);
      }
    }
  }
  if (errors.length) {
    const errorMessages = errors
      .map((error) => error.response?.data?.message || error.message)
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
  for (const id of Object.keys(importData.saml.cot)) {
    try {
      const cotData = importData.saml.cot[id];
      delete cotData._rev;
      try {
        response = await createCircleOfTrust({ cotData, state });
      } catch (createError) {
        if (createError.response?.status === 409)
          response = await updateCircleOfTrust({
            cotId: id,
            cotData,
            state,
          });
        else throw createError;
      }
      imported.push(id);
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
  importData,
  state,
}: {
  importData: CirclesOfTrustExportInterface;
  state: State;
}) {
  const response = [];
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.saml.cot)) {
    try {
      const cotData = importData.saml.cot[id];
      delete cotData._rev;
      try {
        response.push(await createCircleOfTrust({ cotData, state }));
      } catch (createError) {
        if (createError.response?.status === 409)
          response.push(
            await updateCircleOfTrust({
              cotId: id,
              cotData,
              state,
            })
          );
        else throw createError;
      }
      imported.push(id);
    } catch (error) {
      errors.push(error);
    }
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
