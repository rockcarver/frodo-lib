import util from 'util';

import { State } from '../shared/State';
import { getIdmBaseUrl } from '../utils/ForgeRockUtils';
import { generateAmApi, generateEnvApi, generateIdmApi } from './BaseApi';

const idmTemplate: string = '%s/%s';
const amTemplate: string = '%s/%s';
const envTemplate: string = '%s/environment/%s';

export async function restGetRawIdm({
  state,
  url,
}: {
  state: State;
  url: string;
}) {
  const urlString = util.format(idmTemplate, getIdmBaseUrl(state), url);
  const { data } = await generateIdmApi({ state }).get(urlString);

  return data;
}

export async function restGetRawAm({
  state,
  url,
}: {
  state: State;
  url: string;
}) {
  const urlString = util.format(amTemplate, state.getHost(), url);
  const { data } = await generateAmApi({
    resource: { apiVersion: 'protocol=2.1,resource=1.0' },
    state,
  }).get(urlString, { withCredentials: true });

  return data;
}

export async function restGetRawEnv({
  state,
  url,
}: {
  state: State;
  url: string;
}) {
  const urlString = util.format(
    envTemplate,
    state
      .getHost()
      .split('/')
      .filter((_, i, a) => i !== a.length - 1)
      .join('/'),
    url
  );
  const { data } = await generateEnvApi({
    resource: { apiVersion: 'protocol=2.1,resource=1.0' },
    state,
  }).get(urlString, { withCredentials: true });

  return data;
}
