import { debugMessage } from './utils/Console';
import {
  getCirclesOfTrust as _getCirclesOfTrust,
  getCircleOfTrust,
  createCircleOfTrust,
  updateCircleOfTrust,
} from '../api/CirclesOfTrustApi';
import { getMetadata } from './utils/ExportImportUtils';
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
   * Get SAML circle of trust
   * @param {String} cotId circle of trust id/name
   */
  getCircleOfTrust(cotId: string): Promise<any>;
  /**
   * Get SAML circles of trust
   */
  getCirclesOfTrust(): Promise<any>;
  createCircleOfTrust(cotData: CircleOfTrustSkeleton): Promise<any>;
  /**
   * Export SAML circle of trust
   * @param {String} cotId circle of trust id/name
   */
  exportCircleOfTrust(cotId: string): Promise<CirclesOfTrustExportInterface>;
  /**
   * Export all SAML circles of trust
   */
  exportCirclesOfTrust(): Promise<CirclesOfTrustExportInterface>;
  /**
   * Import a SAML circle of trust by id/name from file
   * @param {String} cotId Circle of trust id/name
   * @param {CirclesOfTrustExportInterface} importData Import data
   */
  importCircleOfTrust(
    cotId: string,
    importData: CirclesOfTrustExportInterface
  ): Promise<any>;
  /**
   * Import first SAML circle of trust
   * @param {CirclesOfTrustExportInterface} importData Import data
   */
  importFirstCircleOfTrust(
    importData: CirclesOfTrustExportInterface
  ): Promise<any>;
  /**
   * Import all SAML circles of trust
   * @param {CirclesOfTrustExportInterface} importData Import file name
   */
  importCirclesOfTrust(
    importData: CirclesOfTrustExportInterface
  ): Promise<any[]>;
};

export default (state: State): CirclesOfTrust => {
  return {
    /**
     * Create an empty agent export template
     * @returns {CirclesOfTrustExportInterface} an empty agent export template
     */
    createCirclesOfTrustExportTemplate() {
      return createCirclesOfTrustExportTemplate({ state });
    },

    /**
     * Get SAML circle of trust
     * @param {String} cotId circle of trust id/name
     */
    async getCircleOfTrust(cotId: string) {
      return getCircleOfTrust({ cotId, state });
    },

    /**
     * Get SAML circles of trust
     */
    async getCirclesOfTrust() {
      return getCirclesOfTrust({ state });
    },

    async createCircleOfTrust(cotData: CircleOfTrustSkeleton) {
      return createCircleOfTrust({ cotData, state });
    },

    /**
     * Export SAML circle of trust
     * @param {String} cotId circle of trust id/name
     */
    async exportCircleOfTrust(cotId: string) {
      return exportCircleOfTrust({ cotId, state });
    },

    /**
     * Export all SAML circles of trust
     */
    async exportCirclesOfTrust() {
      return exportCirclesOfTrust({ state });
    },

    /**
     * Import a SAML circle of trust by id/name from file
     * @param {String} cotId Circle of trust id/name
     * @param {CirclesOfTrustExportInterface} importData Import data
     */
    async importCircleOfTrust(
      cotId: string,
      importData: CirclesOfTrustExportInterface
    ) {
      return importCircleOfTrust({ cotId, importData, state });
    },

    /**
     * Import first SAML circle of trust
     * @param {CirclesOfTrustExportInterface} importData Import data
     */
    async importFirstCircleOfTrust(importData: CirclesOfTrustExportInterface) {
      return importFirstCircleOfTrust({ importData, state });
    },

    /**
     * Import all SAML circles of trust
     * @param {CirclesOfTrustExportInterface} importData Import file name
     */
    async importCirclesOfTrust(importData: CirclesOfTrustExportInterface) {
      return importCirclesOfTrust({ importData, state });
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
}) {
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

export { getCircleOfTrust, createCircleOfTrust };

/**
 * Get circles of trust
 */
export async function getCirclesOfTrust({ state }: { state: State }) {
  const { result } = await _getCirclesOfTrust({ state });
  return result;
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
    const cotData = await getCircleOfTrust({
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
  state,
}: {
  state: State;
}): Promise<CirclesOfTrustExportInterface> {
  debugMessage({
    message: `CirclesOfTrustOps.exportCirclesOfTrust: start`,
    state,
  });
  const exportData = createCirclesOfTrustExportTemplate({ state });
  const errors = [];
  try {
    const cots = await getCirclesOfTrust({ state });
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
 * Import a SAML circle of trust by id/name from file
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
 * Import first SAML circle of trust
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
 * Import SAML circles of trust
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
