import util from 'util';

import { State } from '../shared/State';
import { getCurrentRealmPath } from '../utils/ForgeRockUtils';
import { deleteDeepByKey } from '../utils/JsonUtils';
import {
  type IdObjectSkeletonInterface,
  type NoIdObjectSkeletonInterface,
  type PagedResult,
  type Readable,
  type Writable,
} from './ApiTypes';
import { generateAmApi } from './BaseApi';

const oauth2TrustedJwtIssuerURLTemplate =
  '%s/json%s/realm-config/agents/TrustedJwtIssuer/%s';
const oauth2TrustedJwtIssuerListURLTemplate =
  '%s/json%s/realm-config/agents/TrustedJwtIssuer?_queryFilter=true';
const apiVersion = 'protocol=2.0,resource=1.0';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

export type OAuth2TrustedJwtIssuerSkeleton = IdObjectSkeletonInterface & {
  allowedSubjects?: Readable<string[]> | Writable<string[]>;
  jwksCacheTimeout?: Readable<number> | Writable<number>;
  jwkSet?: Readable<string> | Writable<string>;
  consentedScopesClaim?: Readable<string> | Writable<string>;
  issuer: Readable<string> | Writable<string>;
  jwkStoreCacheMissCacheTime?: Readable<number> | Writable<number>;
  resourceOwnerIdentityClaim?: Readable<string> | Writable<string>;
  jwksUri?: Readable<string> | Writable<string>;
  _type: {
    _id: 'TrustedJwtIssuer';
    name: 'OAuth2 Trusted JWT Issuer';
    collection: true;
  };
};

/**
 * Get OAuth2 Trusted JWT Issuers
 * @returns {Promise<PagedResult>} a promise that resolves to a PagedResults object containing an array of oauth2TrustedJwtIssuer objects
 */
export async function getOAuth2TrustedJwtIssuers({
  state,
}: {
  state: State;
}): Promise<PagedResult<OAuth2TrustedJwtIssuerSkeleton>> {
  const urlString = util.format(
    oauth2TrustedJwtIssuerListURLTemplate,
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
 * Get OAuth2 Trusted JWT Issuer
 * @param {string} id oauth2 trusted jwt issuer id
 * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton>} a promise that resolves to an oauth2TrustedJwtIssuer object
 */
export async function getOAuth2TrustedJwtIssuer({
  id,
  state,
}: {
  id: string;
  state: State;
}): Promise<OAuth2TrustedJwtIssuerSkeleton> {
  const urlString = util.format(
    oauth2TrustedJwtIssuerURLTemplate,
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
 * Put OAuth2 Trusted JWT Issuer
 * @param {string} id issuer id
 * @param {OAuth2TrustedJwtIssuerSkeleton} issuerData TrustedJwtIssuer object
 * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton>} a promise that resolves to an oauth2TrustedJwtIssuer object
 */
export async function putOAuth2TrustedJwtIssuer({
  id,
  issuerData,
  state,
}: {
  id: string;
  issuerData: OAuth2TrustedJwtIssuerSkeleton | NoIdObjectSkeletonInterface;
  state: State;
}): Promise<OAuth2TrustedJwtIssuerSkeleton> {
  // until we figure out a way to use transport keys in Frodo,
  // we'll have to drop those encrypted attributes.
  const issuer = deleteDeepByKey(issuerData, '-encrypted');
  delete issuer._provider;
  delete issuer._rev;
  const urlString = util.format(
    oauth2TrustedJwtIssuerURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    id
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).put(
    urlString,
    issuer,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Delete OAuth2 Trusted JWT Issuer
 * @param {string} id OAuth2 issuer id
 * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton>} a promise that resolves to a trusted jwt issuer object
 */
export async function deleteOAuth2TrustedJwtIssuer({
  id,
  state,
}: {
  id: string;
  state: State;
}): Promise<OAuth2TrustedJwtIssuerSkeleton> {
  const urlString = util.format(
    oauth2TrustedJwtIssuerURLTemplate,
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
