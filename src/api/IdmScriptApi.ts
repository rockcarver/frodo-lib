import util from 'util';

import Constants from '../shared/Constants';
import { State } from '../shared/State';
import { getIdmBaseUrl } from '../utils/ForgeRockUtils';
import { generateIdmApi } from './BaseApi';

const scriptActionsUrlTemplate = '%s/script?_action=%s';

/**
 * Test connector servers
 * @returns {Promise<TestConnectorServersInterface>} a promise that resolves to a TestConnectorServersInterface object
 */
export async function compileScript({
  script,
  state,
}: {
  script: string;
  state: State;
}): Promise<string | object> {
  const urlString = util.format(
    scriptActionsUrlTemplate,
    getIdmBaseUrl(state),
    'compile'
  );
  const postData = {
    type: 'text/javascript',
    source: script,
  };
  const { data } = await generateIdmApi({
    requiredScopes: [Constants.AVAILABLE_SCOPES.IdmFullScope],
    state,
    requestOverride: {},
  }).post(urlString, postData);
  return data;
}

export async function evaluateScript({
  script,
  globals = {},
  state,
}: {
  script: string;
  globals?: { [key: string]: any };
  state: State;
}): Promise<any> {
  const urlString = util.format(
    scriptActionsUrlTemplate,
    getIdmBaseUrl(state),
    'eval'
  );
  const postData = {
    type: 'text/javascript',
    globals,
    source: script,
  };
  const { data } = await generateIdmApi({
    requiredScopes: [Constants.AVAILABLE_SCOPES.IdmFullScope],
    requestOverride: {},
    state,
  }).post(urlString, postData);
  return data;
}
