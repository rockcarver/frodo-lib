import util from 'util';

import { AxiosRequestConfig, AxiosResponse } from 'axios';
import qs from 'qs';

import { State } from '../shared/State';
import { encode } from '../utils/Base64Utils';
import { getCurrentRealmPath } from '../utils/ForgeRockUtils';
import { generateOauth2Api } from './BaseApi';

const authorizeUrlTemplate = '%s/oauth2%s/authorize';
const accessTokenUrlTemplate = '%s/oauth2%s/access_token';
const tokenInfoUrlTemplate = '%s/oauth2%s/tokeninfo';
const apiVersion = 'protocol=2.1,resource=1.0';
const getApiConfig = () => ({
  apiVersion,
});

export type AccessTokenResponseType = {
  access_token: string;
  id_token?: string;
  scope: string;
  token_type: string;
  expires_in: number;
};

export type TokenInfoResponseType = {
  sub: string;
  cts: string;
  auditTrackingId: string;
  subname: string;
  iss: string;
  tokenName: string;
  token_type: string;
  authGrantId: string;
  access_token: string;
  aud: string;
  nbf: number;
  grant_type: string;
  scope: string[];
  auth_time: number;
  sessionToken?: string;
  realm: string;
  exp: number;
  iat: number;
  expires_in: number;
  jti: string;
  [k: string]: string | number | string[];
};

/**
 * Perform the authorization step of the authorization code grant flow
 * @param {string} amBaseUrl access management base URL
 * @param {string} data body form data
 * @param {AxiosRequestConfig} config axios request config object
 * @param {State} state library state
 * @returns {Promise} a promise resolving to an object containing the authorization server response object
 */
export async function authorize({
  amBaseUrl,
  data,
  config,
  state,
}: {
  amBaseUrl: string;
  data: string;
  config: AxiosRequestConfig;
  state: State;
}): Promise<AxiosResponse<any, any>> {
  const authorizeURL = util.format(authorizeUrlTemplate, amBaseUrl, '');
  return generateOauth2Api({
    resource: getApiConfig(),
    requestOverride: {},
    state,
  }).post(authorizeURL, data, config);
}

/**
 * Perform access token request step of the authorization code grant flow
 * @param {string} amBaseUrl access management base URL
 * @param {string} data body form data
 * @param {AxiosRequestConfig} config config axios request config object
 * @param {State} state library state
 * @returns {Promise<AccessTokenResponseType>} a promise resolving to an object containing the authorization server response object containing the access token
 */
export async function accessToken({
  amBaseUrl,
  postData,
  config,
  realm = false,
  state,
}: {
  amBaseUrl: string;
  postData: any;
  config: AxiosRequestConfig;
  realm?: boolean;
  state: State;
}): Promise<AccessTokenResponseType> {
  const accessTokenURL = util.format(
    accessTokenUrlTemplate,
    amBaseUrl,
    realm ? getCurrentRealmPath(state) : ''
  );
  const { data } = await generateOauth2Api({
    resource: getApiConfig(),
    requestOverride: {},
    authenticate: false,
    state,
  }).post(accessTokenURL, postData, config);
  return data;
}

/**
 * Get token info
 * @param {string} amBaseUrl access management base URL
 * @param {AxiosRequestConfig} config config axios request config object
 * @param {State} state library state
 * @returns
 */
export async function getTokenInfo({
  amBaseUrl,
  config,
  state,
}: {
  amBaseUrl: string;
  config: AxiosRequestConfig;
  state: State;
}): Promise<TokenInfoResponseType> {
  const accessTokenURL = util.format(tokenInfoUrlTemplate, amBaseUrl, '');
  const { data } = await generateOauth2Api({
    resource: getApiConfig(),
    requestOverride: {},
    state,
  }).get(accessTokenURL, config);
  return data;
}

/**
 * Perform client credentials grant flow
 * @param {string} amBaseUrl access management base URL
 * @param {string} clientId client id
 * @param {string} clientSecret client secret
 * @param {string} scope space-delimited scope list
 * @param {State} state library state
 * @returns {Promise} a promise resolving to an object containing the authorization server response object
 */
export async function clientCredentialsGrant({
  amBaseUrl,
  clientId,
  clientSecret,
  scope,
  state,
}: {
  amBaseUrl: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  state: State;
}): Promise<AccessTokenResponseType> {
  const urlString = util.format(
    accessTokenUrlTemplate,
    amBaseUrl,
    getCurrentRealmPath(state)
  );
  const requestOverride = {
    headers: {
      Authorization: `Basic ${encode(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };
  const requestBody = {
    grant_type: 'client_credentials',
    scope,
  };
  const { data } = await generateOauth2Api({
    resource: getApiConfig(),
    requestOverride,
    state,
  }).post(urlString, qs.stringify(requestBody), { withCredentials: true });
  return data;
}
