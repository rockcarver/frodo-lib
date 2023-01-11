import util from 'util';
import { getTenantURL } from '../utils/ApiUtils';
import { generateAmApi } from '../BaseApi';
import * as state from '../../shared/State';

const envInfoURLTemplate = '%s/environment/info';

const apiVersion = 'protocol=1.0,resource=1.0';
const getApiConfig = () => ({
  path: `/environment/info`,
  apiVersion,
});

export interface EnvInfoInterface {
  immutable: boolean;
  locked: boolean;
  region: string;
  tier: string;
  warning_message_html: string;
  message_box_title: string;
  message_box_html: string;
  message_variant: string;
  config_promotion_done: boolean;
  placeholder_management: 'CUSTOMER' | 'SRE';
  placeholder_management_migration_date: string;
}

/**
 * Get info about the environment
 * @returns {Promise<EnvInfoInterface>} a promise that resolves to an environment info object
 */
export async function getEnvInfo(): Promise<EnvInfoInterface> {
  const urlString = util.format(
    envInfoURLTemplate,
    getTenantURL(state.getHost())
  );
  const { data } = await generateAmApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data as EnvInfoInterface;
}
