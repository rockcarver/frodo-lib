import util from 'util';

import { State } from '../shared/State';
import { getCurrentRealmPath } from '../utils/ForgeRockUtils';
import { cloneDeep } from '../utils/JsonUtils';
import { type IdObjectSkeletonInterface } from './ApiTypes';
import { generateAmApi } from './BaseApi';
import { type AmServiceType } from './ServiceApi';

const oAuth2ProviderServiceURLTemplate =
  '%s/json%s/realm-config/services/oauth-oidc';

const createOAuth2ProviderServiceURLTemplate =
  '%s/json%s/realm-config/services/oauth-oidc?_action=create';

const apiVersion = 'protocol=2.1,resource=1.0';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

export type OAuth2ProviderSkeleton = IdObjectSkeletonInterface & {
  advancedOIDCConfig: {
    supportedRequestParameterEncryptionEnc?: string[];
    authorisedOpenIdConnectSSOClients?: string[];
    supportedUserInfoEncryptionAlgorithms?: string[];
    supportedAuthorizationResponseEncryptionEnc?: string[];
    supportedTokenIntrospectionResponseEncryptionAlgorithms?: string[];
    useForceAuthnForPromptLogin?: boolean;
    useForceAuthnForMaxAge?: boolean;
    alwaysAddClaimsToToken?: boolean;
    supportedTokenIntrospectionResponseSigningAlgorithms?: string[];
    supportedTokenEndpointAuthenticationSigningAlgorithms?: string[];
    supportedRequestParameterSigningAlgorithms?: string[];
    includeAllKtyAlgCombinationsInJwksUri?: boolean;
    amrMappings?: any;
    loaMapping?: any;
    authorisedIdmDelegationClients?: string[];
    idTokenInfoClientAuthenticationEnabled?: boolean;
    storeOpsTokens?: boolean;
    supportedUserInfoSigningAlgorithms?: string[];
    supportedAuthorizationResponseSigningAlgorithms?: string[];
    supportedUserInfoEncryptionEnc?: string[];
    claimsParameterSupported?: boolean;
    supportedTokenIntrospectionResponseEncryptionEnc?: string[];
    supportedAuthorizationResponseEncryptionAlgorithms?: string[];
    supportedRequestParameterEncryptionAlgorithms?: string[];
    defaultACR?: string[];
    [k: string]: string | number | boolean | string[] | object | undefined;
  };
  advancedOAuth2Config?: {
    passwordGrantAuthService?: string;
    tokenCompressionEnabled?: boolean;
    tokenEncryptionEnabled?: boolean;
    requirePushedAuthorizationRequests?: boolean;
    tlsCertificateBoundAccessTokensEnabled?: boolean;
    defaultScopes?: string[];
    moduleMessageEnabledInPasswordGrant?: boolean;
    allowClientCredentialsInTokenRequestQueryParameters?: boolean;
    supportedSubjectTypes?: string[];
    refreshTokenGracePeriod?: number;
    tlsClientCertificateHeaderFormat?: string;
    hashSalt?: string;
    macaroonTokenFormat?: string;
    maxAgeOfRequestObjectNbfClaim?: number;
    tlsCertificateRevocationCheckingEnabled?: boolean;
    nbfClaimRequiredInRequestObject?: boolean;
    requestObjectProcessing?: string;
    maxDifferenceBetweenRequestObjectNbfAndExp?: number;
    responseTypeClasses?: string[];
    expClaimRequiredInRequestObject?: boolean;
    tokenValidatorClasses?: string[];
    tokenSigningAlgorithm?: string;
    codeVerifierEnforced?: string;
    displayNameAttribute?: string;
    tokenExchangeClasses?: string[];
    parRequestUriLifetime?: number;
    allowedAudienceValues?: string[];
    persistentClaims?: string[];
    supportedScopes?: string[];
    authenticationAttributes?: string[];
    grantTypes?: string[];
    [k: string]: string | number | boolean | string[] | object | undefined;
  };
  clientDynamicRegistrationConfig?: {
    dynamicClientRegistrationScope: string;
    allowDynamicRegistration: boolean;
    requiredSoftwareStatementAttestedAttributes: string[];
    dynamicClientRegistrationSoftwareStatementRequired: boolean;
    generateRegistrationAccessTokens: boolean;
    [k: string]: string | number | boolean | string[] | object | undefined;
  };
  coreOIDCConfig?: {
    overrideableOIDCClaims: string[];
    oidcDiscoveryEndpointEnabled: boolean;
    supportedIDTokenEncryptionMethods: string[];
    supportedClaims: string[];
    supportedIDTokenSigningAlgorithms: string[];
    supportedIDTokenEncryptionAlgorithms: string[];
    jwtTokenLifetime: number;
    [k: string]: string | number | boolean | string[] | object | undefined;
  };
  coreOAuth2Config?: {
    refreshTokenLifetime: number;
    scopesPolicySet: string;
    accessTokenMayActScript: '[Empty]' | string;
    accessTokenLifetime: number;
    macaroonTokensEnabled: boolean;
    codeLifetime: number;
    statelessTokensEnabled: boolean;
    usePolicyEngineForScope: boolean;
    issueRefreshToken: boolean;
    oidcMayActScript: '[Empty]' | string;
    issueRefreshTokenOnRefreshedToken: boolean;
    [k: string]: string | number | boolean | string[] | object | undefined;
  };
  consent?: {
    supportedRcsRequestSigningAlgorithms: string[];
    supportedRcsResponseEncryptionAlgorithms: string[];
    supportedRcsRequestEncryptionMethods: string[];
    enableRemoteConsent: boolean;
    supportedRcsRequestEncryptionAlgorithms: string[];
    clientsCanSkipConsent: boolean;
    supportedRcsResponseSigningAlgorithms: string[];
    supportedRcsResponseEncryptionMethods: string[];
    [k: string]: string | number | boolean | string[] | object | undefined;
  };
  deviceCodeConfig?: {
    deviceUserCodeLength: number;
    deviceCodeLifetime: number;
    deviceUserCodeCharacterSet: string;
    devicePollInterval: number;
    [k: string]: string | number | boolean | string[] | object | undefined;
  };
  pluginsConfig?: {
    evaluateScopeClass?: string;
    validateScopeScript?: '[Empty]' | string;
    accessTokenEnricherClass?: string;
    oidcClaimsPluginType?: string;
    authorizeEndpointDataProviderClass?: string;
    authorizeEndpointDataProviderPluginType?: 'JAVA' | 'SCRIPTED';
    userCodeGeneratorClass?: string;
    evaluateScopeScript?: '[Empty]' | string;
    oidcClaimsClass?: string;
    evaluateScopePluginType?: 'JAVA' | 'SCRIPTED';
    authorizeEndpointDataProviderScript?: '[Empty]' | string;
    accessTokenModifierClass?: string;
    accessTokenModificationScript?: '[Empty]' | string;
    validateScopePluginType?: 'JAVA' | 'SCRIPTED';
    accessTokenModificationPluginType?: 'JAVA' | 'SCRIPTED';
    oidcClaimsScript?: '[Empty]' | string;
    validateScopeClass?: string;
    [k: string]: string | number | boolean | string[] | object | undefined;
  };
  cibaConfig?: {
    cibaMinimumPollingInterval: number;
    supportedCibaSigningAlgorithms: string[];
    cibaAuthReqIdLifetime: number;
    [k: string]: string | number | boolean | string[] | object | undefined;
  };
  _type?: AmServiceType;
  [k: string]: string | number | boolean | string[] | object | undefined;
};

/**
 * Get OAuth2 Provider
 * @returns {Promise<OAuth2ProviderSkeleton>} a promise that resolves to an OAuth2Provider object
 */
export async function getOAuth2Provider({
  state,
}: {
  state: State;
}): Promise<OAuth2ProviderSkeleton> {
  const urlString = util.format(
    oAuth2ProviderServiceURLTemplate,
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

const providerTemplate: OAuth2ProviderSkeleton = {
  advancedOAuth2Config: {
    supportedScopes: [] as string[],
    persistentClaims: [] as string[],
    passwordGrantAuthService: '[Empty]',
  },
  advancedOIDCConfig: { authorisedOpenIdConnectSSOClients: [] as string[] },
  pluginsConfig: { oidcClaimsClass: '', accessTokenModifierClass: '' },
};

/**
 * Create OAuth2 provider
 * @param {OAuth2ProviderSkeleton} providerData (optional) oauth2 provider object
 * @returns {Promise<OAuth2ProviderSkeleton>} a promise that resolves to an oauth2 provider object
 */
export async function createOAuth2Provider({
  providerData = providerTemplate,
  state,
}: {
  providerData?: OAuth2ProviderSkeleton;
  state: State;
}): Promise<OAuth2ProviderSkeleton> {
  const urlString = util.format(
    createOAuth2ProviderServiceURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state)
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).post(urlString, providerData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Put OAuth2 provider
 * @param {OAuth2ProviderSkeleton} providerData oauth2 provider object
 * @returns {Promise<OAuth2ProviderSkeleton>} a promise that resolves to an oauth2 provider object
 */
export async function putOAuth2Provider({
  providerData: providerData,
  state,
}: {
  providerData: OAuth2ProviderSkeleton;
  state: State;
}): Promise<OAuth2ProviderSkeleton> {
  const provider = cloneDeep(providerData);
  delete provider._rev;
  const urlString = util.format(
    oAuth2ProviderServiceURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state)
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).put(
    urlString,
    provider,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Delete OAuth2 Provider
 * @returns {Promise<OAuth2ProviderSkeleton>} a promise that resolves to an oauth2 provider object
 */
export async function deleteOAuth2Provider({
  state,
}: {
  state: State;
}): Promise<OAuth2ProviderSkeleton> {
  const urlString = util.format(
    oAuth2ProviderServiceURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state)
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
