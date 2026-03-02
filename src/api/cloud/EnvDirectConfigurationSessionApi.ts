import util from 'util';

import { State } from '../../shared/State';
import { getHostOnlyUrl } from '../../utils/ForgeRockUtils';
import { generateEnvApi } from '../BaseApi';

const directConfigurationSessionInitURLTemplate = '%s/environment/ccc/init';
const directConfigurationSessionApplyURLTemplate = '%s/environment/ccc/apply';
const directConfigurationSessionAbortURLTemplate = '%s/environment/ccc/abort';
const directConfigurationSessionStateURLTemplate = '%s/environment/ccc/state';

const apiVersion = 'protocol=1.0,resource=1.0';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

/**
 * Direct Configuration Session State object
 */
export type DirectConfigurationSessionState = {
  editable: boolean;
};

/**
 * Initiate direct configuration session
 * @param {Object} params Parameters object.
 * @param {State} params.state State object.
 * @returns {Promise<DirectConfigurationSessionState>} a promise that resolves to a DirectConfigurationSessionState object.
 */
export async function initDirectConfigurationSession({
  state,
}: {
  state: State;
}): Promise<DirectConfigurationSessionState> {
  const urlString = util.format(
    directConfigurationSessionInitURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).put(urlString, null, { withCredentials: true });
  return data;
}

/**
 * Apply direct configuration session
 * @param {Object} params Parameters object.
 * @param {State} params.state State object.
 * @returns {Promise<DirectConfigurationSessionState>} a promise that resolves to a DirectConfigurationSessionState object.
 */
export async function applyDirectConfigurationSession({
  state,
}: {
  state: State;
}): Promise<DirectConfigurationSessionState> {
  const urlString = util.format(
    directConfigurationSessionApplyURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).put(urlString, null, { withCredentials: true });
  return data;
}

/**
 * Abort direct configuration session
 * @param {Object} params Parameters object.
 * @param {State} params.state State object.
 * @returns {Promise<DirectConfigurationSessionState>} a promise that resolves to a DirectConfigurationSessionState object.
 */
export async function abortDirectConfigurationSession({
  state,
}: {
  state: State;
}): Promise<DirectConfigurationSessionState> {
  const urlString = util.format(
    directConfigurationSessionAbortURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).put(urlString, null, { withCredentials: true });
  return data;
}

/**
 * Get direct configuration session state
 * @returns {Promise<DirectConfigurationSessionState>} a promise that resolves to a DirectConfigurationSessionState object
 */
export async function getDirectConfigurationSessionState({
  state,
}: {
  state: State;
}): Promise<DirectConfigurationSessionState> {
  const urlString = util.format(
    directConfigurationSessionStateURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}
