import util from 'util';

import { State } from '../shared/State';
import { getCurrentRealmPath } from '../utils/ForgeRockUtils';
import { type IdObjectSkeletonInterface, type PagedResult } from './ApiTypes';
import { generateAmApi } from './BaseApi';

const scriptURLTemplate = '%s/json%s/scripts/%s';
const scriptListURLTemplate = '%s/json%s/scripts?_queryFilter=true';
const scriptQueryURLTemplate =
  '%s/json%s/scripts?_queryFilter=name+eq+%%22%s%%22';
const apiVersion = 'protocol=2.0,resource=1.0';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

export type ScriptLanguage = 'GROOVY' | 'JAVASCRIPT';

export type ScriptContext =
  | 'OAUTH2_ACCESS_TOKEN_MODIFICATION'
  | 'AUTHENTICATION_CLIENT_SIDE'
  | 'AUTHENTICATION_TREE_DECISION_NODE'
  | 'AUTHENTICATION_SERVER_SIDE'
  | 'SOCIAL_IDP_PROFILE_TRANSFORMATION'
  | 'OAUTH2_VALIDATE_SCOPE'
  | 'CONFIG_PROVIDER_NODE'
  | 'OAUTH2_AUTHORIZE_ENDPOINT_DATA_PROVIDER'
  | 'OAUTH2_EVALUATE_SCOPE'
  | 'POLICY_CONDITION'
  | 'OIDC_CLAIMS'
  | 'SAML2_IDP_ADAPTER'
  | 'SAML2_IDP_ATTRIBUTE_MAPPER'
  | 'OAUTH2_MAY_ACT';

export type ScriptSkeleton = IdObjectSkeletonInterface & {
  name: string;
  description: string;
  default: boolean;
  script: string | string[];
  language: ScriptLanguage;
  context: ScriptContext;
  createdBy: string;
  creationDate: number;
  lastModifiedBy: string;
  lastModifiedDate: number;
};

/**
 * Get all scripts
 * @returns {Promise} a promise that resolves to an object containing an array of script objects
 */
export async function getScripts({
  state,
}: {
  state: State;
}): Promise<PagedResult<ScriptSkeleton>> {
  const urlString = util.format(
    scriptListURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state)
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).get<
    PagedResult<ScriptSkeleton>
  >(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get script by name
 * @param {String} scriptName script name
 * @returns {Promise} a promise that resolves to an object containing a script object
 */
export async function getScriptByName({
  scriptName,
  state,
}: {
  scriptName: string;
  state: State;
}): Promise<PagedResult<ScriptSkeleton>> {
  const urlString = util.format(
    scriptQueryURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    encodeURIComponent(scriptName)
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).get<
    PagedResult<ScriptSkeleton>
  >(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get script by id
 * @param {String} scriptId script uuid/name
 * @returns {Promise} a promise that resolves to a script object
 */
export async function getScript({
  scriptId,
  state,
}: {
  scriptId: string;
  state: State;
}) {
  const urlString = util.format(
    scriptURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    scriptId
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).get(
    urlString,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Put script
 * @param {string} scriptId script uuid
 * @param {Object} scriptData script object
 * @returns {Promise} a promise that resolves to an object containing a script object
 */
export async function putScript({
  scriptId,
  scriptData,
  state,
}: {
  scriptId: string;
  scriptData: ScriptSkeleton;
  state: State;
}) {
  const urlString = util.format(
    scriptURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    scriptId
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).put(
    urlString,
    scriptData,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Delete script by id
 * @param {String} scriptId script uuid
 * @returns {Promise<ScriptSkeleton>>} a promise that resolves to a script object
 */
export async function deleteScript({
  scriptId,
  state,
}: {
  scriptId: string;
  state: State;
}): Promise<ScriptSkeleton> {
  const urlString = util.format(
    scriptURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    scriptId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Delete script by name
 * @param {String} scriptId script name
 * @returns {Promise<ScriptSkeleton>} a promise that resolves to a script object
 */
export async function deleteScriptByName({
  scriptName,
  state,
}: {
  scriptName: string;
  state: State;
}): Promise<ScriptSkeleton> {
  const { result } = await getScriptByName({ scriptName, state });
  if (!result[0]) {
    throw new Error(`Script with name ${scriptName} does not exist.`);
  }
  const scriptId = result[0]._id;
  return deleteScript({
    scriptId,
    state,
  });
}

/**
 * Delete all non-default scripts
 * @returns {Promise<ScriptSkeleton[]>>} a promise that resolves to an array of script objects
 */
export async function deleteScripts({
  state,
}: {
  state: State;
}): Promise<ScriptSkeleton[]> {
  const { result } = await getScripts({ state });
  //Unable to delete default scripts, so filter them out
  const scripts = result.filter((s) => !s.default);
  const deletedScripts = [];
  const errors = [];
  for (const script of scripts) {
    try {
      deletedScripts.push(
        await deleteScript({
          scriptId: script._id,
          state,
        })
      );
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Delete error:\n${errorMessages}`);
  }
  return deletedScripts;
}
