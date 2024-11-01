import { AxiosInstance, AxiosRequestConfig } from 'axios';

import {
  generateAmApi,
  generateEnvApi,
  generateGovernanceApi,
  generateIdmApi,
  generateLogApi,
  generateLogKeysApi,
  generateOauth2Api,
  generateReleaseApi,
  ResourceConfig,
} from '../api/BaseApi';
import { State } from '../shared/State';

export type ApiFactory = {
  /**
   * Generates an AM Axios API instance
   * @param {ResourceConfig} resource Takes an object takes a resource object. example:
   * @param {AxiosRequestConfig} requestOverride Takes an object of AXIOS parameters that can be used to either
   * add on extra information or override default properties https://github.com/axios/axios#request-config
   *
   * @returns {AxiosInstance} Returns a reaady to use Axios instance
   */
  generateAmApi(
    resource: ResourceConfig,
    requestOverride?: AxiosRequestConfig
  ): AxiosInstance;
  /**
   * Generates an OAuth2 Axios API instance
   * @param {ResourceConfig} resource Takes a resource object. example:
   * @param {AxiosRequestConfig} requestOverride Takes an object of AXIOS parameters that can be used to either
   * add on extra information or override default properties https://github.com/axios/axios#request-config
   *
   * @returns {AxiosInstance} Returns a reaady to use Axios instance
   */
  generateOauth2Api(
    resource: ResourceConfig,
    requestOverride?: AxiosRequestConfig,
    authenticate?: boolean
  ): AxiosInstance;
  /**
   * Generates an IDM Axios API instance
   * @param {AxiosRequestConfig} requestOverride Takes an object of AXIOS parameters that can be used to either add
   * on extra information or override default properties https://github.com/axios/axios#request-config
   *
   * @returns {AxiosInstance} Returns a reaady to use Axios instance
   */
  generateIdmApi(requestOverride?: AxiosRequestConfig): AxiosInstance;
  /**
   * Generates a LogKeys API Axios instance
   * @param {AxiosRequestConfig} requestOverride Takes an object of AXIOS parameters that can be used to either add
   * on extra information or override default properties https://github.com/axios/axios#request-config
   *
   * @returns {AxiosInstance} Returns a reaady to use Axios instance
   */
  generateLogKeysApi(requestOverride?: AxiosRequestConfig): AxiosInstance;
  /**
   * Generates a Log API Axios instance
   * @param {AxiosRequestConfig} requestOverride Takes an object of AXIOS parameters that can be used to either add
   * on extra information or override default properties https://github.com/axios/axios#request-config
   *
   * @returns {AxiosInstance} Returns a reaady to use Axios instance
   */
  generateLogApi(requestOverride?: AxiosRequestConfig): AxiosInstance;
  /**
   * Generates an Axios instance for the Identity Cloud Environment API
   * @param {ResourceConfig} resource Resource config object.
   * @param {AxiosRequestConfig} requestOverride Takes an object of AXIOS parameters that can be used to either add
   * on extra information or override default properties https://github.com/axios/axios#request-config
   *
   * @returns {AxiosInstance} Returns a reaady to use Axios instance
   */
  generateEnvApi(
    resource: ResourceConfig,
    requestOverride?: AxiosRequestConfig
  ): AxiosInstance;
  /**
   * Generates an Axios instance for the Identity Cloud Governance API
   * @param {ResourceConfig} resource Resource config object.
   * @param {AxiosRequestConfig} requestOverride Takes an object of AXIOS parameters that can be used to either add
   * on extra information or override default properties https://github.com/axios/axios#request-config
   *
   * @returns {AxiosInstance} Returns a reaady to use Axios instance
   */
  generateGovernanceApi(
    resource: ResourceConfig,
    requestOverride?: AxiosRequestConfig
  ): AxiosInstance;
  /**
   * Generates a release (Github or Npm) Axios API instance
   * @param {string} baseUrl Base URL for the request
   * @param {AxiosRequestConfig} requestOverride Takes an object of AXIOS parameters that can be used to either add
   * on extra information or override default properties https://github.com/axios/axios#request-config
   *
   * @returns {AxiosInstance} Returns a reaady to use Axios instance
   */
  generateReleaseApi(
    baseUrl: string,
    requestOverride?: AxiosRequestConfig
  ): AxiosInstance;
};

export default (state: State): ApiFactory => {
  return {
    generateAmApi(
      resource: ResourceConfig,
      requestOverride?: AxiosRequestConfig
    ): AxiosInstance {
      return generateAmApi({ resource, requestOverride, state });
    },
    generateOauth2Api(
      resource: ResourceConfig,
      requestOverride?: AxiosRequestConfig,
      authenticate?: boolean
    ): AxiosInstance {
      return generateOauth2Api({
        resource,
        requestOverride,
        authenticate,
        state,
      });
    },
    generateIdmApi(requestOverride?: AxiosRequestConfig): AxiosInstance {
      return generateIdmApi({ requestOverride, state });
    },
    generateLogKeysApi(requestOverride?: AxiosRequestConfig): AxiosInstance {
      return generateLogKeysApi({ requestOverride, state });
    },
    generateLogApi(requestOverride?: AxiosRequestConfig): AxiosInstance {
      return generateLogApi({ requestOverride, state });
    },
    generateEnvApi(
      resource: ResourceConfig,
      requestOverride?: AxiosRequestConfig
    ): AxiosInstance {
      return generateEnvApi({ resource, requestOverride, state });
    },
    generateGovernanceApi(
      resource: ResourceConfig,
      requestOverride?: AxiosRequestConfig
    ): AxiosInstance {
      return generateGovernanceApi({ resource, requestOverride, state });
    },
    generateReleaseApi(
      baseUrl: string,
      requestOverride?: AxiosRequestConfig
    ): AxiosInstance {
      return generateReleaseApi({ baseUrl, requestOverride, state });
    },
  };
};
