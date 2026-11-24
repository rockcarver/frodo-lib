import { IdObjectSkeletonInterface } from '../api/ApiTypes';
import {
  ApiVersion,
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
import { mergeDeep } from '../utils/JsonUtils';
import { FrodoError } from './FrodoError';

export type RawConfig = {
  /**
   * Exports raw configuration. The first segment of the path selects the API: `am` (the host's own context, for example /am or /openam), `openidm` (the IDM host if one is set), `environment`, `iga` (governance), `keys` (log API keys), `monitoring` (logs) and `ws` (WS-Federation administration). Any other first segment is refused.
   * @param {RawExportOptions} options The export options, including the path to the resource
   * @returns {Promise<IdObjectSkeletonInterface>} The raw configuration JSON object at the specified path
   */
  exportRawConfig(
    options: RawExportOptions
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Imports raw configuration. The first segment of the path selects the API, as for the export.
   * @param {RawImportOptions} options The import options, including the path to the resource
   * @param {IdObjectSkeletonInterface} data the import data that will be pushed
   * @returns {Promise<IdObjectSkeletonInterface>} The raw configuration JSON object at the specified path
   */
  importRawConfig(
    options: RawImportOptions,
    data: IdObjectSkeletonInterface
  ): Promise<IdObjectSkeletonInterface>;
};

export default (state: State): RawConfig => {
  return {
    async exportRawConfig(
      options: RawExportOptions
    ): Promise<IdObjectSkeletonInterface> {
      return exportRawConfig({ options, state });
    },
    async importRawConfig(
      options: RawImportOptions,
      data: IdObjectSkeletonInterface
    ): Promise<IdObjectSkeletonInterface> {
      return importRawConfig({ options, data, state });
    },
  };
};

/**
 * Raw config export options from fr-config-manager (https://github.com/ForgeRock/fr-config-manager/blob/main/docs/raw.md)
 */
export interface RawExportOptions {
  /**
   * The URL path for the configuration object, relative to the tenant base URL
   */
  path: string;
  /**
   * An optional partial configuration object which should override the corresponding properties of the object exported from the tenant.
   */
  overrides?: IdObjectSkeletonInterface;
  /**
   * An optional object containing the properties 'protocol' and 'resource' to be used in the API version header. This allows specific values for specific configuration. The default is { protocol: "2.0". resource: "1.0" }. Only used for configuration under /am or /environment
   */
  pushApiVersion?: ApiVersion;
  /**
   * An optional object containing the properties 'protocol' and 'resource' for the Accept-API-Version header of the export request itself. Without it, requests under /am, /environment and /iga send protocol 2.0 and resource 1.0, and requests under the other roots send no version.
   */
  apiVersion?: ApiVersion;
}

/**
 * Raw config import options from fr-config-manager (https://github.com/ForgeRock/fr-config-manager/blob/main/docs/raw.md)
 */
export interface RawImportOptions {
  /**
   * The URL path for the configuration object, relative to the tenant base URL
   */
  path: string;
  /**
   * An optional object containing the properties 'protocol' and 'resource' for the Accept-API-Version header of the import request. For a path under /am or /environment it takes precedence over a `_pushApiVersion` in the data; a `_pushApiVersion` in the data applies to those two roots only and is removed from the data for every root. Without a version, requests under /am, /environment and /iga send protocol 2.0 and resource 1.0, and requests under the other roots send no version.
   */
  apiVersion?: ApiVersion;
}

/**
 * Exports raw configuration
 * @param {RawExportOptions} options The export options, including the path to the resource
 * @returns {Promise<IdObjectSkeletonInterface>} The raw configuration JSON object at the specified path
 */
export async function exportRawConfig({
  options,
  state,
}: {
  options: RawExportOptions;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  try {
    let response: IdObjectSkeletonInterface;

    // remove starting slash from path if it exists
    const path = options.path.startsWith('/')
      ? options.path.substring(1)
      : options.path;

    const urlParts: string[] = path.split('/');
    const startPath: string = urlParts[0];
    const noStart: string = urlParts.slice(1).join('/');
    const apiVersion = options.apiVersion;

    // support for these root paths only: am, openidm, environment, iga, keys, monitoring and ws
    switch (startPath) {
      case 'am':
        response = await getRawAm({ endpoint: noStart, apiVersion, state });
        // fr-config-manager has this option, only for am end points
        if (options.pushApiVersion) {
          response._pushApiVersion = options.pushApiVersion;
        }
        break;
      case 'openidm':
        response = await getRawIdm({ endpoint: noStart, apiVersion, state });
        break;
      case 'environment':
        response = await getRawEnv({ endpoint: noStart, apiVersion, state });
        break;
      // the roots below sit at the root of the host: the endpoint keeps its first segment
      case 'iga':
        response = await getRawIga({ endpoint: path, apiVersion, state });
        break;
      case 'keys':
        response = await getRawKeys({ endpoint: path, apiVersion, state });
        break;
      case 'monitoring':
        response = await getRawMonitoringLogs({
          endpoint: path,
          apiVersion,
          state,
        });
        break;
      case 'ws':
        response = await getRawWs({ endpoint: path, apiVersion, state });
        break;
      default:
        throw new FrodoError(
          `URL paths that start with ${startPath} are not supported`
        );
    }

    // all endpoints can have overrides
    if (options.overrides) {
      response = mergeDeep(response, options.overrides);
    }

    return response;
  } catch (error) {
    throw new FrodoError(
      `Error in exportRawIdm with relative url: ${options.path}`,
      error
    );
  }
}

/**
 * Imports raw configuration
 * @param {RawImportOptions} options The import options, including the path to the resource
 * @param {IdObjectSkeletonInterface} data the import data that will be pushed
 * @returns {Promise<IdObjectSkeletonInterface>} The raw configuration JSON object at the specified path
 */
export async function importRawConfig({
  options,
  data,
  state,
}: {
  options: RawImportOptions;
  data: IdObjectSkeletonInterface;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  try {
    let response: IdObjectSkeletonInterface;

    // remove starting slash from path if it exists
    const path = options.path.startsWith('/')
      ? options.path.substring(1)
      : options.path;

    const urlParts: string[] = path.split('/');
    const startPath: string = urlParts[0];
    const noStart: string = urlParts.slice(1).join('/');

    const { _pushApiVersion, ...payload } = data;
    // an explicit version wins over the one the data carries; the data's version applies to am and environment only
    const pushApiVersion =
      options.apiVersion ?? (_pushApiVersion as ApiVersion);

    // support for these root paths only: am, openidm, environment, iga, keys, monitoring and ws
    switch (startPath) {
      case 'am':
        response = await putRawAm({
          endpoint: noStart,
          payload,
          apiVersion: pushApiVersion,
          state,
        });
        break;
      case 'openidm':
        response = await putRawIdm({
          endpoint: noStart,
          payload,
          apiVersion: options.apiVersion,
          state,
        });
        break;
      case 'environment':
        response = await putRawEnv({
          endpoint: noStart,
          payload,
          apiVersion: pushApiVersion,
          state,
        });
        break;
      // the roots below sit at the root of the host: the endpoint keeps its first segment
      case 'iga':
        response = await putRawIga({
          endpoint: path,
          payload,
          apiVersion: options.apiVersion,
          state,
        });
        break;
      case 'keys':
        response = await putRawKeys({
          endpoint: path,
          payload,
          apiVersion: options.apiVersion,
          state,
        });
        break;
      case 'monitoring':
        response = await putRawMonitoringLogs({
          endpoint: path,
          payload,
          apiVersion: options.apiVersion,
          state,
        });
        break;
      case 'ws':
        response = await putRawWs({
          endpoint: path,
          payload,
          apiVersion: options.apiVersion,
          state,
        });
        break;
      default:
        throw new FrodoError(
          `URL paths that start with ${startPath} are not supported`
        );
    }

    return response;
  } catch (error) {
    throw new FrodoError(
      `Error in importRawConfig with relative url: ${options.path}`,
      error
    );
  }
}
