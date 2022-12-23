import util from 'util';
import { generateAmApi } from './BaseApi';
import * as state from '../shared/State';
import { getRealmPath } from './utils/ApiUtils';

const authenticateUrlTemplate = '%s/json%s/authenticate';
const authenticateWithServiceUrlTemplate = `${authenticateUrlTemplate}?authIndexType=service&authIndexValue=%s`;

const apiVersion = 'resource=2.0, protocol=1.0';
const getApiConfig = () => ({
  apiVersion,
});

export async function step(body = {}, config = {}) {
  const urlString = state.getAuthenticationService()
    ? util.format(
        authenticateWithServiceUrlTemplate,
        state.getHost(),
        getRealmPath('/'),
        state.getAuthenticationService()
      )
    : util.format(authenticateUrlTemplate, state.getHost(), getRealmPath('/'));
  const { data } = await generateAmApi(getApiConfig()).post(
    urlString,
    body,
    config
  );
  return data;
}
