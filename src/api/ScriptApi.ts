import util from 'util';
import { generateAmApi } from './BaseApi';
import { getCurrentRealmPath } from './utils/ApiUtils';
import { State } from '../shared/State';
import { PagedResult, ScriptSkeleton } from './ApiTypes';

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
 * @param {String} scriptId script uuid/name
 * @returns {Promise} a promise that resolves to a script object
 */
export async function deleteScript({
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
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
