import util from 'util';

import { State } from '../shared/State';
import { getCurrentRealmPath } from '../utils/ForgeRockUtils';
import { deleteDeepByKey } from '../utils/JsonUtils';
import {
  type AmConfigEntityInterface,
  type NoIdObjectSkeletonInterface,
  type PagedResult,
  type Readable,
  type Writable,
} from './ApiTypes';
import { generateAmApi } from './BaseApi';

const oauth2ClientURLTemplate = '%s/json%s/realm-config/agents/OAuth2Client/%s';
const oauth2ClientListURLTemplate =
  '%s/json%s/realm-config/agents/OAuth2Client?_queryFilter=true';
const apiVersion = 'protocol=2.1,resource=1.0';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

export type OAuth2ClientSkeleton = AmConfigEntityInterface & {
  overrideOAuth2ClientConfig?: {
    [k: string]: string | number | boolean | string[] | object | undefined;
  };
  advancedOAuth2ClientConfig?: {
    descriptions: {
      inherited: boolean;
      value: string[];
    };
    grantTypes?: Readable<string[]> | Writable<string[]>;
    isConsentImplied?: Readable<boolean> | Writable<boolean>;
    tokenEndpointAuthMethod?: Readable<string> | Writable<string>;
    responseTypes?: Readable<string[]> | Writable<string[]>;
    [k: string]: string | number | boolean | string[] | object | undefined;
  };
  signEncOAuth2ClientConfig?: {
    jwkSet?: Readable<string> | Writable<string>;
    publicKeyLocation?: Readable<string> | Writable<string>;
    [k: string]: string | number | boolean | string[] | object | undefined;
  };
  coreOpenIDClientConfig?: {
    [k: string]: string | number | boolean | string[] | object | undefined;
  };
  coreOAuth2ClientConfig?: {
    userpassword?: string;
    clientName?: Readable<string[]> | Writable<string[]>;
    clientType?: Readable<string> | Writable<string>;
    accessTokenLifetime?: Readable<number> | Writable<number>;
    scopes?: Readable<string[]> | Writable<string[]>;
    defaultScopes?: {
      value: string[];
      [k: string]: string | number | boolean | string[] | object | undefined;
    };
    [k: string]: string | number | boolean | string[] | object | undefined;
  };
  coreUmaClientConfig?: {
    [k: string]: string | number | boolean | string[] | object | undefined;
  };
};

/**
 * Get OAuth2 Clients
 * @returns {Promise<PagedResult>} a promise that resolves to a PagedResults object containing an array of oauth2client objects
 */
export async function getOAuth2Clients({
  state,
}: {
  state: State;
}): Promise<PagedResult<OAuth2ClientSkeleton>> {
  const urlString = util.format(
    oauth2ClientListURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state)
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
 * Get OAuth2 Client
 * @param {string} id client id
 * @returns {Promise<OAuth2ClientSkeleton>} a promise that resolves to an oauth2 client object
 */
export async function getOAuth2Client({
  id,
  state,
}: {
  id: string;
  state: State;
}): Promise<OAuth2ClientSkeleton> {
  const urlString = util.format(
    oauth2ClientURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    id
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
 * Put OAuth2 Client
 * @param {string} id client id
 * @param {OAuth2ClientSkeleton} clientData oauth2client object
 * @returns {Promise<OAuth2ClientSkeleton>} a promise that resolves to an oauth2 client object
 */
export async function putOAuth2Client({
  id,
  clientData,
  state,
}: {
  id: string;
  clientData: OAuth2ClientSkeleton | NoIdObjectSkeletonInterface;
  state: State;
}): Promise<OAuth2ClientSkeleton> {
  // until we figure out a way to use transport keys in Frodo,
  // we'll have to drop those encrypted attributes.
  const client = deleteDeepByKey(clientData, '-encrypted');
  delete client._provider;
  delete client._rev;
  const urlString = util.format(
    oauth2ClientURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    id
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).put(
    urlString,
    client,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Delete OAuth2 Client
 * @param {string} id OAuth2 Client
 * @returns {Promise<OAuth2ClientSkeleton>} a promise that resolves to an oauth2client object
 */
export async function deleteOAuth2Client({
  id,
  state,
}: {
  id: string;
  state: State;
}): Promise<OAuth2ClientSkeleton> {
  const urlString = util.format(
    oauth2ClientURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    id
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
