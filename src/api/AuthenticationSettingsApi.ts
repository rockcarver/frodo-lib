import util from 'util';

import { State } from '../shared/State';
import { debugMessage } from '../utils/Console';
import { getConfigPath, getRealmPathGlobal } from '../utils/ForgeRockUtils';
import { type IdObjectSkeletonInterface } from './ApiTypes';
import { generateAmApi } from './BaseApi';

const authenticationSettingsURLTemplate = '%s/json%s/%s/authentication';
const apiVersion = 'protocol=2.1,resource=%s';
const globalVersion = '1.0';
const realmVersion = '1.0';
const getApiConfig = (globalConfig) => {
  return {
    apiVersion: util.format(
      apiVersion,
      globalConfig ? globalVersion : realmVersion
    ),
  };
};

export type AuthenticationSettingsSkeleton = IdObjectSkeletonInterface & {
  _id: '';
  _type: {
    _id: 'EMPTY';
    name: 'Core';
    collection: false;
  };
};

/**
 * Get authentication settings
 * @param {boolean} globalConfig true if global authentication settings are the target of the operation, false otherwise. Default: false.
 * @returns {Promise<AuthenticationSettingsSkeleton>} a promise that resolves to an authentication settings object
 */
export async function getAuthenticationSettings({
  state,
  globalConfig = false,
}: {
  state: State;
  globalConfig: boolean;
}): Promise<AuthenticationSettingsSkeleton> {
  debugMessage({
    message: `AuthenticationSettingsApi.getAuthenticationSettings: start`,
    state,
  });
  const urlString = util.format(
    authenticationSettingsURLTemplate,
    state.getHost(),
    getRealmPathGlobal(globalConfig, state),
    getConfigPath(globalConfig)
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(globalConfig),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  debugMessage({
    message: `AuthenticationSettingsApi.getAuthenticationSettings: end`,
    state,
  });
  return data;
}

/**
 * Put authentication settings
 * @param {AuthenticationSettingsSkeleton} settings authentication settings object
 * @param {boolean} globalConfig true if global authentication settings are the target of the operation, false otherwise. Default: false.
 * @returns {Promise<AuthenticationSettingsSkeleton>} a promise that resolves to an authentiction settings object
 */
export async function putAuthenticationSettings({
  settings,
  globalConfig = false,
  state,
}: {
  settings: AuthenticationSettingsSkeleton;
  globalConfig: boolean;
  state: State;
}): Promise<AuthenticationSettingsSkeleton> {
  debugMessage({
    message: `AuthenticationSettingsApi.putAuthenticationSettings: start`,
    state,
  });
  const urlString = util.format(
    authenticationSettingsURLTemplate,
    state.getHost(),
    getRealmPathGlobal(globalConfig, state),
    getConfigPath(globalConfig)
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(globalConfig),
    state,
  }).put(urlString, settings, {
    withCredentials: true,
  });
  debugMessage({
    message: `AuthenticationSettingsApi.putAuthenticationSettings: end`,
    state,
  });
  return data;
}
