import util from 'util';
import { getTenantURL } from '../utils/ApiUtils';
import { generateEnvApi } from '../BaseApi';
import State from '../../shared/State';

const startupURLTemplate = '%s/environment/startup';
const startupInitiateRestartURLTemplate = `${startupURLTemplate}?_action=restart`;

const apiVersion = 'protocol=1.0,resource=1.0';
const getApiConfig = () => ({
  path: `/environment/startup`,
  apiVersion,
});

export enum RestartStatus {
  restarting = 'restarting',
  ready = 'ready',
}

/**
 * Get status
 * @returns {Promise<RestartStatus>} a promise that resolves to a string indicating status
 */
export async function getStatus({
  state,
}: {
  state: State;
}): Promise<RestartStatus> {
  const urlString = util.format(
    startupURLTemplate,
    getTenantURL(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data.restartStatus;
}

/**
 * Initiate restart
 * @returns {Promise<string>} a promise that resolves to a string indicating status
 */
export async function initiateRestart({
  state,
}: {
  state: State;
}): Promise<RestartStatus> {
  const restartStatus = await getStatus({ state });
  if (restartStatus === RestartStatus.ready) {
    const urlString = util.format(
      startupInitiateRestartURLTemplate,
      getTenantURL(state.getHost())
    );
    const { data } = await generateEnvApi({
      resource: getApiConfig(),
      state,
    }).post(urlString, null, {
      withCredentials: true,
    });
    return data.restartStatus;
  }
  throw new Error(`Not ready! Current status: ${restartStatus}`);
}
