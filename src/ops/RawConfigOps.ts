import { IdObjectSkeletonInterface } from '../api/ApiTypes';
import {
  ApiVersion,
  getRawAm,
  getRawEnv,
  getRawIdm,
} from '../api/RawConfigApi';
import { State } from '../shared/State';
import { mergeDeep } from '../utils/JsonUtils';
import { FrodoError } from './FrodoError';

export type RawConfig = {
  /**
   * Exports raw configuration
   * @param {RawExportOptions} options The export options, including the path to the resource
   * @returns {Promise<IdObjectSkeletonInterface>} The raw configuration JSON object at the specified path
   */
  exportRawConfig(
    options: RawExportOptions
  ): Promise<IdObjectSkeletonInterface>;
};

export default (state: State): RawConfig => {
  return {
    async exportRawConfig(
      options: RawExportOptions
    ): Promise<IdObjectSkeletonInterface> {
      return exportRawConfig({ options, state });
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

    // support for only three root paths: am, openidm, and environment
    switch (startPath) {
      case 'am':
        response = await getRawAm({ endpoint: noStart, state });
        // fr-config-manager has this option, only for am end points
        if (options.pushApiVersion) {
          response._pushApiVersion = options.pushApiVersion;
        }
        break;
      case 'openidm':
        response = await getRawIdm({ endpoint: noStart, state });
        break;
      case 'environment':
        response = await getRawEnv({ endpoint: noStart, state });
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
