import util from 'util';

import { State } from '../shared/State';
import { debugMessage } from '../utils/Console';
import { getCurrentRealmPath } from '../utils/ForgeRockUtils';
import { type IdObjectSkeletonInterface } from './ApiTypes';
import { generateAmApi } from './BaseApi';

const authenticationSettingsURLTemplate =
  '%s/json%s/realm-config/authentication';
const apiVersion = 'resource=1.0';
const getApiConfig = () => {
  return {
    apiVersion,
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
 * @returns {Promise<AuthenticationSettingsSkeleton>} a promise that resolves to an authentication settings object
 */
export async function getAuthenticationSettings({
  state,
}: {
  state: State;
}): Promise<AuthenticationSettingsSkeleton> {
  debugMessage({
    message: `AuthenticationSettingsApi.getAuthenticationSettings: start`,
    state,
  });
  const urlString = util.format(
    authenticationSettingsURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state)
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).get(
    urlString,
    {
      withCredentials: true,
    }
  );
  debugMessage({
    message: `AuthenticationSettingsApi.getAuthenticationSettings: end`,
    state,
  });
  return data;
}

/**
 * Put authentiction settings
 * @param {AuthenticationSettingsSkeleton} settings authentiction settings object
 * @returns {Promise<AuthenticationSettingsSkeleton>} a promise that resolves to an authentiction settings object
 */
export async function putAuthenticationSettings({
  settings,
  state,
}: {
  settings: AuthenticationSettingsSkeleton;
  state: State;
}): Promise<AuthenticationSettingsSkeleton> {
  debugMessage({
    message: `AuthenticationSettingsApi.putAuthenticationSettings: start`,
    state,
  });
  const urlString = util.format(
    authenticationSettingsURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state)
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).put(
    urlString,
    settings,
    {
      withCredentials: true,
    }
  );
  debugMessage({
    message: `AuthenticationSettingsApi.putAuthenticationSettings: end`,
    state,
  });
  return data;
}
