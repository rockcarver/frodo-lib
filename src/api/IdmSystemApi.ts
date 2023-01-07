import util from 'util';
import { generateIdmApi } from './BaseApi';
import { getTenantURL } from './utils/ApiUtils';
import * as state from '../shared/State';

const testConnectorServersURLTemplate =
  '%s/openidm/system?_action=testConnectorServers';

export interface ConnectorServerStatusInterface {
  name: string;
  type: string;
  ok: boolean;
}

export interface TestConnectorServersInterface {
  openicf: ConnectorServerStatusInterface[];
}

/**
 * Test connector servers
 * @returns {Promise<TestConnectorServersInterface>} a promise that resolves to a TestConnectorServersInterface object
 */
export async function testConnectorServers(): Promise<TestConnectorServersInterface> {
  const urlString = util.format(
    testConnectorServersURLTemplate,
    getTenantURL(state.getHost())
  );
  const { data } = await generateIdmApi().post(urlString);
  return data as TestConnectorServersInterface;
}
