import { getEnvInfo, EnvInfoInterface } from '../api/cloud/EnvInfoApi';
import Constants from '../shared/Constants';
import { getServerVersionInfo } from '../api/ServerInfoApi';
import { getServiceAccount } from './cloud/ServiceAccountOps';
import { State } from '../shared/State';

export type Info = {
  /**
   * Get info about the platform instance
   * @returns {Promise<PlatformInfo>} a promise that resolves to a json blob with information about the instance and tokens
   */
  getInfo(): Promise<PlatformInfo>;
};

export default (state: State): Info => {
  return {
    /**
     * Get info about the platform instance
     * @returns {Promise<PlatformInfo>} a promise that resolves to a json blob with information about the instance and tokens
     */
    getInfo(): Promise<PlatformInfo> {
      return getInfo(state);
    },
  };
};

export interface PlatformInfoInterface {
  host: string;
  authenticatedSubject: string;
  amVersion: string;
  cookieName: string;
  sessionToken: string;
  bearerToken?: string;
  deploymentType: string;
}

export type PlatformInfo = PlatformInfoInterface & Partial<EnvInfoInterface>;

async function getCloudInfo(state: State): Promise<Partial<EnvInfoInterface>> {
  let info: Partial<EnvInfoInterface> = {};
  info = await getEnvInfo({ state });
  delete info.message_box_html;
  delete info.message_box_title;
  delete info.message_variant;
  delete info.warning_message_html;
  if (!info.placeholder_management_migration_date)
    delete info.placeholder_management_migration_date;
  return info;
}

async function getAmVersion(state: State): Promise<string> {
  const versionObj = await getServerVersionInfo({ state });
  const amVersion = `${versionObj['version']} Build ${versionObj['revision']} (${versionObj['date']})`;
  return amVersion;
}

async function getAuthenticatedSubject(state: State): Promise<string> {
  let subjectString = `${state.getUsername()} (User)`;
  if (state.getUseBearerTokenForAmApis()) {
    const name = (
      await getServiceAccount({
        serviceAccountId: state.getServiceAccountId(),
        state,
      })
    ).name;
    subjectString = `${name} [${state.getServiceAccountId()}] (Service Account)`;
  }
  return subjectString;
}

/**
 * Get info about the platform instance
 * @param {State} state library state
 * @returns {Promise<PlatformInfo>} a promise that resolves to a json blob with information about the instance and tokens
 */
export async function getInfo(state: State): Promise<PlatformInfo> {
  const info: PlatformInfo = {
    host: state.getHost(),
    amVersion: await getAmVersion(state),
    authenticatedSubject: await getAuthenticatedSubject(state),
    deploymentType: state.getDeploymentType(),
    cookieName: state.getCookieName(),
    sessionToken: state.getCookieValue(),
    // only add bearerToken if we have it
    ...(state.getBearerToken() && { bearerToken: state.getBearerToken() }),
    // only add cloud env info if deployment type is cloud
    ...(state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY &&
      (await getCloudInfo(state))),
  };
  return info;
}
