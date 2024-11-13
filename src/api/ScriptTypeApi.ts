import util from 'util';

import { State } from '../shared/State';
import {
  AmConfigEntityInterface,
  IdObjectSkeletonInterface,
  PagedResult,
} from './ApiTypes';
import { generateAmApi } from './BaseApi';

const scriptTypeURLTemplate =
  '%s/json/global-config/services/scripting/contexts/%s';
const scriptTypesURLTemplate =
  '%s/json/global-config/services/scripting/contexts?_queryFilter=true';
const scriptTypeContextURLTemplate = '%s/json/contexts/%s';

const scriptingEngineConfigurationURLTemplate =
  scriptTypeURLTemplate + '/engineConfiguration';

const apiVersion = 'protocol=2.0,resource=1.0';

function getApiConfig() {
  return {
    apiVersion,
  };
}

export type ScriptTypeSkeleton = AmConfigEntityInterface & {
  defaultScript: string;
  languages: string[];
};

export type EngineConfigurationSkeleton = AmConfigEntityInterface & {
  blackList: string[];
  coreThreads: number;
  idleTimeout: number;
  maxThreads: number;
  propertyNamePrefix: string;
  queueSize: number;
  serverTimeout: number;
  useSecurityManager: boolean;
  whiteList: string[];
};

export type ScriptingContextSkeleton = IdObjectSkeletonInterface & {
  allowLists: Record<string, string[]>;
  evaluatorVersions: Record<string, string[]>;
};

/**
 * Get scriptType
 * @param {string} scriptTypeId scriptType id
 * @returns {Promise<ScriptTypeSkeleton>} a promise that resolves to a scriptType object
 */
export async function getScriptType({
  scriptTypeId,
  state,
}: {
  scriptTypeId: string;
  state: State;
}): Promise<ScriptTypeSkeleton> {
  const urlString = util.format(
    scriptTypeURLTemplate,
    state.getHost(),
    scriptTypeId
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
 * Get all scriptTypes
 * @returns {Promise<PagedResult<ScriptTypeSkeleton[]>>} a promise that resolves to an array of scriptType objects
 */
export async function getScriptTypes({
  state,
}: {
  state: State;
}): Promise<PagedResult<ScriptTypeSkeleton>> {
  const urlString = util.format(scriptTypesURLTemplate, state.getHost());
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get scripting engine configuration
 * @param {string} scriptTypeId Script type id
 * @returns {Promise<EngineConfigurationSkeleton>} a promise that resolves to an EngineConfigurationSkeleton object
 */
export async function getScriptingEngineConfiguration({
  scriptTypeId,
  state,
}: {
  scriptTypeId: string;
  state: State;
}): Promise<EngineConfigurationSkeleton> {
  const urlString = util.format(
    scriptingEngineConfigurationURLTemplate,
    state.getHost(),
    scriptTypeId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get scripting contexts
 * @param {string} scriptTypeId Script type id
 * @returns {Promise<ScriptingContextSkeleton>} a promise that resolves to an ScriptingContextSkeleton object
 */
export async function getScriptingContext({
  scriptTypeId,
  state,
}: {
  scriptTypeId: string;
  state: State;
}): Promise<ScriptingContextSkeleton> {
  const urlString = util.format(
    scriptTypeContextURLTemplate,
    state.getHost(),
    scriptTypeId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Put script type
 * @param {string} scriptTypeId script type id
 * @param {ScriptTypeSkeleton} scriptTypeData script type config object
 * @returns {Promise<ScriptTypeSkeleton>} a promise that resolves to a script type object
 */
export async function putScriptType({
  scriptTypeId,
  scriptTypeData,
  state,
}: {
  scriptTypeId: string;
  scriptTypeData: ScriptTypeSkeleton;
  state: State;
}): Promise<ScriptTypeSkeleton> {
  const urlString = util.format(
    scriptTypeURLTemplate,
    state.getHost(),
    scriptTypeId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).put(urlString, scriptTypeData, {
    withCredentials: true,
    headers: { 'If-Match': '*' },
  });
  return data;
}

/**
 * Put scripting engine configuration
 * @param {string} scriptTypeId script type id
 * @param {EngineConfigurationSkeleton} engineConfigurationData engine config object
 * @returns {Promise<EngineConfigurationSkeleton>} a promise that resolves to a script type object
 */
export async function putScriptingEngineConfiguration({
  scriptTypeId,
  engineConfigurationData,
  state,
}: {
  scriptTypeId: string;
  engineConfigurationData: EngineConfigurationSkeleton;
  state: State;
}): Promise<EngineConfigurationSkeleton> {
  const urlString = util.format(
    scriptingEngineConfigurationURLTemplate,
    state.getHost(),
    scriptTypeId
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).put(
    urlString,
    engineConfigurationData,
    {
      withCredentials: true,
    }
  );
  return data;
}
