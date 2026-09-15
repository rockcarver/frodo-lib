import { ApiVersion } from '../api/BaseApi';
import {
  getRawAm,
  getRawEnv,
  getRawIdm,
  getRawIga,
  getRawKeys,
  getRawMonitoringLogs,
  getRawWs,
  putRawAm,
  putRawEnv,
  putRawIdm,
  putRawIga,
  putRawKeys,
  putRawMonitoringLogs,
  putRawWs,
} from '../api/RawConfigApi';
import { State } from '../shared/State';
import { FrodoError } from './FrodoError';

export type RawConfig = {
  /**
   * Exports raw configuration
   * @param {string} endpoint The path to the resource
   * @param {ApiVersion} apiVersion Optional API version.
   * @returns {Promise<object>} The raw configuration JSON object at the specified path
   */
  exportRawConfig(endpoint: string, apiVersion?: ApiVersion): Promise<object>;
  /**
   * Imports raw configuration
   * @param {string} endpoint The path to the resource
   * @param {object} payload the import payload that will be pushed
   * @param {ApiVersion} apiVersion Optional API version.
   * @returns {Promise<object>} The raw configuration JSON object at the specified path
   */
  importRawConfig(
    endpoint: string,
    payload: object,
    apiVersion?: ApiVersion
  ): Promise<object>;
};

export default (state: State): RawConfig => {
  return {
    async exportRawConfig(
      endpoint: string,
      apiVersion?: ApiVersion
    ): Promise<object> {
      return exportRawConfig({ endpoint, apiVersion, state });
    },
    async importRawConfig(
      endpoint: string,
      payload: object,
      apiVersion?: ApiVersion
    ): Promise<object> {
      return importRawConfig({ endpoint, payload, apiVersion, state });
    },
  };
};

/**
 * Exports raw configuration
 * @param {string} endpoint The path to the resource
 * @param {ApiVersion} apiVersion Optional API version.
 * @returns {Promise<object>} The raw configuration JSON object at the specified path
 */
export async function exportRawConfig({
  endpoint,
  apiVersion,
  state,
}: {
  endpoint: string;
  apiVersion?: ApiVersion;
  state: State;
}): Promise<object> {
  try {
    // remove starting slash from path if it exists
    endpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;

    const urlParts: string[] = endpoint.split('/');
    const startPath: string = urlParts[0];

    switch (startPath) {
      case 'openidm':
        return await getRawIdm({ endpoint, apiVersion, state });
      case 'environment':
        return await getRawEnv({ endpoint, apiVersion, state });
      case 'iga':
        return await getRawIga({ endpoint, apiVersion, state });
      case 'keys':
        return await getRawKeys({ endpoint, apiVersion, state });
      case 'monitoring':
        return await getRawMonitoringLogs({ endpoint, apiVersion, state });
      case 'ws':
        return await getRawWs({ endpoint, apiVersion, state });
      case state.getHost().substring(state.getHost().lastIndexOf('/') + 1):
        return await getRawAm({ endpoint, apiVersion, state });
      default:
        throw new FrodoError(
          `Endpoints that start with ${startPath} are not supported`
        );
    }
  } catch (error) {
    throw new FrodoError(
      `Error in exportRawConfig with endpoint: ${endpoint}`,
      error
    );
  }
}

/**
 * Imports raw configuration
 * @param {string} endpoint The path to the resource
 * @param {object} payload The import payload that will be pushed
 * @param {ApiVersion} apiVersion Optional API version.
 * @returns {Promise<object>} The raw configuration JSON object at the specified path
 */
export async function importRawConfig({
  endpoint,
  payload,
  apiVersion,
  state,
}: {
  endpoint: string;
  payload: object;
  apiVersion?: ApiVersion;
  state: State;
}): Promise<object> {
  try {
    // remove starting slash from path if it exists
    endpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;

    const urlParts: string[] = endpoint.split('/');
    const startPath: string = urlParts[0];

    switch (startPath) {
      case 'openidm':
        return await putRawIdm({
          endpoint,
          payload,
          apiVersion,
          state,
        });
      case 'environment':
        return await putRawEnv({
          endpoint,
          payload,
          apiVersion,
          state,
        });
      case 'iga':
        return await putRawIga({
          endpoint,
          payload,
          apiVersion,
          state,
        });
      case 'keys':
        return await putRawKeys({
          endpoint,
          payload,
          apiVersion,
          state,
        });
      case 'monitoring':
        return await putRawMonitoringLogs({
          endpoint,
          payload,
          apiVersion,
          state,
        });
      case 'ws':
        return await putRawWs({
          endpoint,
          payload,
          apiVersion,
          state,
        });
      case state.getHost().substring(state.getHost().lastIndexOf('/') + 1):
        return await putRawAm({
          endpoint,
          payload,
          apiVersion,
          state,
        });
      default:
        throw new FrodoError(
          `Endpoints that start with ${startPath} are not supported`
        );
    }
  } catch (error) {
    throw new FrodoError(
      `Error in importRawConfig with endpoint: ${endpoint}`,
      error
    );
  }
}
