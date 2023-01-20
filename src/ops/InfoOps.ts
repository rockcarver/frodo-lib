import { getEnvInfo } from '../api/cloud/EnvInfoApi';
import * as state from '../shared/State';
import { EnvInfoInterface } from '../api/cloud/EnvInfoApi';
import * as globalConfig from '../storage/StaticStorage';
import { getServerVersionInfo } from '../api/ServerInfoApi';
import { printMessage } from './utils/Console';
import { getServiceAccount } from './cloud/ServiceAccountOps';

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

async function getCloudInfo(): Promise<Partial<EnvInfoInterface>> {
  let info: Partial<EnvInfoInterface> = {};
  try {
    info = await getEnvInfo();
    delete info.message_box_html;
    delete info.message_box_title;
    delete info.message_variant;
    delete info.warning_message_html;
    if (!info.placeholder_management_migration_date)
      delete info.placeholder_management_migration_date;
  } catch (error) {
    printMessage(error.response?.data, 'error');
    printMessage(`Error getting env info: ${error.message}`, 'error');
  }
  return info;
}

async function getAmVersion(): Promise<string> {
  const versionObj = await getServerVersionInfo();
  const amVersion = `${versionObj['version']} Build ${versionObj['revision']} (${versionObj['date']})`;
  return amVersion;
}

async function getAuthenticatedSubject(): Promise<string> {
  let subjectString = `${state.getUsername()} (User)`;
  if (state.getUseBearerTokenForAmApis()) {
    const name = (await getServiceAccount(state.getServiceAccountId())).name;
    subjectString = `${name} [${state.getServiceAccountId()}] (Service Account)`;
  }
  return subjectString;
}

/**
 * Get info about the platform instance
 * @returns {Promise<PlatformInfo>} a promise that resolves to a json blob with information about the instance and tokens
 */
export async function getInfo(): Promise<PlatformInfo> {
  const info: PlatformInfo = {
    host: state.getHost(),
    amVersion: await getAmVersion(),
    authenticatedSubject: await getAuthenticatedSubject(),
    deploymentType: state.getDeploymentType(),
    cookieName: state.getCookieName(),
    sessionToken: state.getCookieValue(),
    // only add bearerToken if we have it
    ...(state.getBearerToken() && { bearerToken: state.getBearerToken() }),
    // only add cloud env info if deployment type is cloud
    ...(state.getDeploymentType() === globalConfig.CLOUD_DEPLOYMENT_TYPE_KEY &&
      (await getCloudInfo())),
  };
  return info;
}
