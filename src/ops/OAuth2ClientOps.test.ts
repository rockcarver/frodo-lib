/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record OAuth2ClientOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you musty manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update OAuth2ClientOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only OAuth2ClientOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { state } from '../index';
import * as OAuth2ClientOps from './OAuth2ClientOps';
import { autoSetupPolly } from '../utils/AutoSetupPolly';
import { cloneDeep } from './utils/OpsUtils';
import {
  NoIdObjectSkeletonInterface,
  OAuth2ClientSkeleton,
} from '../api/ApiTypes';

autoSetupPolly();

async function stageOAuth2Client(
  client: {
    id: string;
    data: OAuth2ClientSkeleton | NoIdObjectSkeletonInterface;
  },
  create = true
) {
  // delete if exists, then create
  try {
    await OAuth2ClientOps.getOAuth2Client({ clientId: client.id, state });
    await OAuth2ClientOps.deleteOAuth2Client({ clientId: client.id, state });
  } catch (error) {
    // ignore
  } finally {
    if (create) {
      await OAuth2ClientOps.putOAuth2Client({
        clientId: client.id,
        clientData: client.data,
        state,
      });
    }
  }
}

function applyOAuth2ClientImportTemplate(template, ids: string[]) {
  const configured: OAuth2ClientOps.OAuth2ClientExportInterface =
    cloneDeep(template);
  const key = cloneDeep(Object.keys(configured.application)[0]);
  const clientData = configured.application[key];
  for (const key of Object.keys(configured.application)) {
    delete configured.application[key];
  }
  for (const id of ids) {
    configured.application[id] = cloneDeep(clientData);
  }
  console.log(`apply template ${ids}`);
  console.dir(configured);
  return configured;
}

describe('OAuth2ClientOps', () => {
  const rawClientTemplate = {
    overrideOAuth2ClientConfig: {
      issueRefreshToken: true,
      validateScopePluginType: 'PROVIDER',
      tokenEncryptionEnabled: false,
      evaluateScopePluginType: 'PROVIDER',
      oidcMayActScript: '[Empty]',
      oidcClaimsScript: '[Empty]',
      scopesPolicySet: 'oauth2Scopes',
      accessTokenModificationPluginType: 'PROVIDER',
      authorizeEndpointDataProviderClass:
        'org.forgerock.oauth2.core.plugins.registry.DefaultEndpointDataProvider',
      oidcClaimsPluginType: 'PROVIDER',
      providerOverridesEnabled: false,
      authorizeEndpointDataProviderScript: '[Empty]',
      statelessTokensEnabled: false,
      authorizeEndpointDataProviderPluginType: 'PROVIDER',
      remoteConsentServiceId: null,
      enableRemoteConsent: false,
      validateScopeClass:
        'org.forgerock.oauth2.core.plugins.registry.DefaultScopeValidator',
      usePolicyEngineForScope: false,
      evaluateScopeClass:
        'org.forgerock.oauth2.core.plugins.registry.DefaultScopeEvaluator',
      overrideableOIDCClaims: [],
      accessTokenMayActScript: '[Empty]',
      evaluateScopeScript: '[Empty]',
      clientsCanSkipConsent: false,
      accessTokenModificationScript: '[Empty]',
      issueRefreshTokenOnRefreshedToken: true,
      validateScopeScript: '[Empty]',
    },
    advancedOAuth2ClientConfig: {
      logoUri: {
        inherited: false,
        value: [],
      },
      subjectType: {
        inherited: false,
        value: 'public',
      },
      clientUri: {
        inherited: false,
        value: [],
      },
      tokenExchangeAuthLevel: {
        inherited: false,
        value: 0,
      },
      responseTypes: {
        inherited: false,
        value: ['code', 'token', 'id_token'],
      },
      mixUpMitigation: {
        inherited: false,
        value: false,
      },
      customProperties: {
        inherited: false,
        value: [],
      },
      javascriptOrigins: {
        inherited: false,
        value: [],
      },
      policyUri: {
        inherited: false,
        value: [],
      },
      softwareVersion: {
        inherited: false,
      },
      tosURI: {
        inherited: false,
        value: [],
      },
      sectorIdentifierUri: {
        inherited: false,
      },
      tokenEndpointAuthMethod: {
        inherited: false,
        value: 'client_secret_basic',
      },
      refreshTokenGracePeriod: {
        inherited: false,
        value: 0,
      },
      isConsentImplied: {
        inherited: false,
        value: true,
      },
      softwareIdentity: {
        inherited: false,
      },
      grantTypes: {
        inherited: false,
        value: ['authorization_code', 'refresh_token'],
      },
      require_pushed_authorization_requests: {
        inherited: false,
        value: false,
      },
      descriptions: {
        inherited: false,
        value: [],
      },
      requestUris: {
        inherited: false,
        value: [],
      },
      name: {
        inherited: false,
        value: [],
      },
      contacts: {
        inherited: false,
        value: [],
      },
      updateAccessToken: {
        inherited: false,
      },
    },
    signEncOAuth2ClientConfig: {
      tokenEndpointAuthSigningAlgorithm: {
        inherited: false,
        value: 'RS256',
      },
      idTokenEncryptionEnabled: {
        inherited: false,
        value: false,
      },
      tokenIntrospectionEncryptedResponseEncryptionAlgorithm: {
        inherited: false,
        value: 'A128CBC-HS256',
      },
      requestParameterSignedAlg: {
        inherited: false,
      },
      authorizationResponseSigningAlgorithm: {
        inherited: false,
        value: 'RS256',
      },
      clientJwtPublicKey: {
        inherited: false,
      },
      idTokenPublicEncryptionKey: {
        inherited: false,
      },
      mTLSSubjectDN: {
        inherited: false,
      },
      jwkStoreCacheMissCacheTime: {
        inherited: false,
        value: 60000,
      },
      jwkSet: {
        inherited: false,
      },
      idTokenEncryptionMethod: {
        inherited: false,
        value: 'A128CBC-HS256',
      },
      jwksUri: {
        inherited: false,
      },
      tokenIntrospectionEncryptedResponseAlg: {
        inherited: false,
        value: 'RSA-OAEP-256',
      },
      authorizationResponseEncryptionMethod: {
        inherited: false,
      },
      userinfoResponseFormat: {
        inherited: false,
        value: 'JSON',
      },
      mTLSCertificateBoundAccessTokens: {
        inherited: false,
        value: false,
      },
      publicKeyLocation: {
        inherited: false,
        value: 'jwks_uri',
      },
      tokenIntrospectionResponseFormat: {
        inherited: false,
        value: 'JSON',
      },
      requestParameterEncryptedEncryptionAlgorithm: {
        inherited: false,
        value: 'A128CBC-HS256',
      },
      userinfoSignedResponseAlg: {
        inherited: false,
      },
      idTokenEncryptionAlgorithm: {
        inherited: false,
        value: 'RSA-OAEP-256',
      },
      requestParameterEncryptedAlg: {
        inherited: false,
      },
      authorizationResponseEncryptionAlgorithm: {
        inherited: false,
      },
      mTLSTrustedCert: {
        inherited: false,
      },
      jwksCacheTimeout: {
        inherited: false,
        value: 3600000,
      },
      userinfoEncryptedResponseAlg: {
        inherited: false,
      },
      idTokenSignedResponseAlg: {
        inherited: false,
        value: 'RS256',
      },
      tokenIntrospectionSignedResponseAlg: {
        inherited: false,
        value: 'RS256',
      },
      userinfoEncryptedResponseEncryptionAlgorithm: {
        inherited: false,
        value: 'A128CBC-HS256',
      },
    },
    coreOpenIDClientConfig: {
      claims: {
        inherited: false,
        value: [],
      },
      backchannel_logout_uri: {
        inherited: false,
      },
      defaultAcrValues: {
        inherited: false,
        value: [],
      },
      jwtTokenLifetime: {
        inherited: false,
        value: 3600,
      },
      defaultMaxAgeEnabled: {
        inherited: false,
        value: false,
      },
      clientSessionUri: {
        inherited: false,
      },
      defaultMaxAge: {
        inherited: false,
        value: 600,
      },
      postLogoutRedirectUri: {
        inherited: false,
        value: [],
      },
      backchannel_logout_session_required: {
        inherited: false,
        value: false,
      },
    },
    coreOAuth2ClientConfig: {
      status: {
        inherited: false,
        value: 'Active',
      },
      clientName: {
        inherited: false,
        value: [],
      },
      clientType: {
        inherited: false,
        value: 'Public',
      },
      loopbackInterfaceRedirection: {
        inherited: false,
        value: false,
      },
      defaultScopes: {
        inherited: false,
        value: [],
      },
      refreshTokenLifetime: {
        inherited: false,
        value: 604800,
      },
      scopes: {
        inherited: false,
        value: ['openid'],
      },
      accessTokenLifetime: {
        inherited: false,
        value: 3600,
      },
      redirectionUris: {
        inherited: false,
        value: [],
      },
      authorizationCodeLifetime: {
        inherited: false,
        value: 120,
      },
    },
    coreUmaClientConfig: {
      claimsRedirectionUris: {
        inherited: false,
        value: [],
      },
    },
    // _type: {
    //   _id: 'OAuth2Client',
    //   name: 'OAuth2 Clients',
    //   collection: true,
    // },
    // _provider: {
    //   _id: '',
    //   _rev: '745152125',
    //   advancedOIDCConfig: {
    //     supportedRequestParameterEncryptionEnc: [
    //       'A256GCM',
    //       'A192GCM',
    //       'A128GCM',
    //       'A128CBC-HS256',
    //       'A192CBC-HS384',
    //       'A256CBC-HS512',
    //     ],
    //     authorisedOpenIdConnectSSOClients: [],
    //     supportedUserInfoEncryptionAlgorithms: [
    //       'ECDH-ES+A256KW',
    //       'ECDH-ES+A192KW',
    //       'RSA-OAEP',
    //       'ECDH-ES+A128KW',
    //       'RSA-OAEP-256',
    //       'A128KW',
    //       'A256KW',
    //       'ECDH-ES',
    //       'dir',
    //       'A192KW',
    //     ],
    //     supportedAuthorizationResponseEncryptionEnc: [
    //       'A256GCM',
    //       'A192GCM',
    //       'A128GCM',
    //       'A128CBC-HS256',
    //       'A192CBC-HS384',
    //       'A256CBC-HS512',
    //     ],
    //     supportedTokenIntrospectionResponseEncryptionAlgorithms: [
    //       'ECDH-ES+A256KW',
    //       'ECDH-ES+A192KW',
    //       'RSA-OAEP',
    //       'ECDH-ES+A128KW',
    //       'RSA-OAEP-256',
    //       'A128KW',
    //       'A256KW',
    //       'ECDH-ES',
    //       'dir',
    //       'A192KW',
    //     ],
    //     useForceAuthnForPromptLogin: false,
    //     alwaysAddClaimsToToken: true,
    //     supportedTokenIntrospectionResponseSigningAlgorithms: [
    //       'PS384',
    //       'RS384',
    //       'EdDSA',
    //       'ES384',
    //       'HS256',
    //       'HS512',
    //       'ES256',
    //       'RS256',
    //       'HS384',
    //       'ES512',
    //       'PS256',
    //       'PS512',
    //       'RS512',
    //     ],
    //     supportedTokenEndpointAuthenticationSigningAlgorithms: [
    //       'PS384',
    //       'ES384',
    //       'RS384',
    //       'HS256',
    //       'HS512',
    //       'ES256',
    //       'RS256',
    //       'HS384',
    //       'ES512',
    //       'PS256',
    //       'PS512',
    //       'RS512',
    //     ],
    //     supportedRequestParameterSigningAlgorithms: [
    //       'PS384',
    //       'ES384',
    //       'RS384',
    //       'HS256',
    //       'HS512',
    //       'ES256',
    //       'RS256',
    //       'HS384',
    //       'ES512',
    //       'PS256',
    //       'PS512',
    //       'RS512',
    //     ],
    //     includeAllKtyAlgCombinationsInJwksUri: false,
    //     amrMappings: {},
    //     loaMapping: {},
    //     authorisedIdmDelegationClients: [],
    //     idTokenInfoClientAuthenticationEnabled: true,
    //     storeOpsTokens: true,
    //     supportedUserInfoSigningAlgorithms: [
    //       'ES384',
    //       'HS256',
    //       'HS512',
    //       'ES256',
    //       'RS256',
    //       'HS384',
    //       'ES512',
    //     ],
    //     supportedAuthorizationResponseSigningAlgorithms: [
    //       'PS384',
    //       'RS384',
    //       'EdDSA',
    //       'ES384',
    //       'HS256',
    //       'HS512',
    //       'ES256',
    //       'RS256',
    //       'HS384',
    //       'ES512',
    //       'PS256',
    //       'PS512',
    //       'RS512',
    //     ],
    //     supportedUserInfoEncryptionEnc: [
    //       'A256GCM',
    //       'A192GCM',
    //       'A128GCM',
    //       'A128CBC-HS256',
    //       'A192CBC-HS384',
    //       'A256CBC-HS512',
    //     ],
    //     claimsParameterSupported: false,
    //     supportedTokenIntrospectionResponseEncryptionEnc: [
    //       'A256GCM',
    //       'A192GCM',
    //       'A128GCM',
    //       'A128CBC-HS256',
    //       'A192CBC-HS384',
    //       'A256CBC-HS512',
    //     ],
    //     supportedAuthorizationResponseEncryptionAlgorithms: [
    //       'ECDH-ES+A256KW',
    //       'ECDH-ES+A192KW',
    //       'RSA-OAEP',
    //       'ECDH-ES+A128KW',
    //       'RSA-OAEP-256',
    //       'A128KW',
    //       'A256KW',
    //       'ECDH-ES',
    //       'dir',
    //       'A192KW',
    //     ],
    //     supportedRequestParameterEncryptionAlgorithms: [
    //       'ECDH-ES+A256KW',
    //       'ECDH-ES+A192KW',
    //       'ECDH-ES+A128KW',
    //       'RSA-OAEP',
    //       'RSA-OAEP-256',
    //       'A128KW',
    //       'A256KW',
    //       'ECDH-ES',
    //       'dir',
    //       'A192KW',
    //     ],
    //     defaultACR: [],
    //   },
    //   advancedOAuth2Config: {
    //     passwordGrantAuthService: 'PasswordGrant',
    //     tokenCompressionEnabled: false,
    //     tokenEncryptionEnabled: false,
    //     requirePushedAuthorizationRequests: false,
    //     tlsCertificateBoundAccessTokensEnabled: true,
    //     defaultScopes: ['address', 'phone', 'openid', 'profile', 'email'],
    //     moduleMessageEnabledInPasswordGrant: false,
    //     supportedSubjectTypes: ['public', 'pairwise'],
    //     refreshTokenGracePeriod: 0,
    //     tlsClientCertificateHeaderFormat: 'URLENCODED_PEM',
    //     hashSalt: 'qAWV0MFSQpC/f1GPbZAZnMRksak=',
    //     macaroonTokenFormat: 'V2',
    //     maxAgeOfRequestObjectNbfClaim: 0,
    //     tlsCertificateRevocationCheckingEnabled: false,
    //     nbfClaimRequiredInRequestObject: false,
    //     requestObjectProcessing: 'OIDC',
    //     maxDifferenceBetweenRequestObjectNbfAndExp: 0,
    //     responseTypeClasses: [
    //       'code|org.forgerock.oauth2.core.AuthorizationCodeResponseTypeHandler',
    //       'device_code|org.forgerock.oauth2.core.TokenResponseTypeHandler',
    //       'token|org.forgerock.oauth2.core.TokenResponseTypeHandler',
    //       'id_token|org.forgerock.openidconnect.IdTokenResponseTypeHandler',
    //     ],
    //     expClaimRequiredInRequestObject: false,
    //     tokenValidatorClasses: [
    //       'urn:ietf:params:oauth:token-type:id_token|org.forgerock.oauth2.core.tokenexchange.idtoken.OidcIdTokenValidator',
    //       'urn:ietf:params:oauth:token-type:access_token|org.forgerock.oauth2.core.tokenexchange.accesstoken.OAuth2AccessTokenValidator',
    //     ],
    //     tokenSigningAlgorithm: 'HS256',
    //     codeVerifierEnforced: 'false',
    //     displayNameAttribute: 'cn',
    //     tokenExchangeClasses: [
    //       'urn:ietf:params:oauth:token-type:access_token=>urn:ietf:params:oauth:token-type:access_token|org.forgerock.oauth2.core.tokenexchange.accesstoken.AccessTokenToAccessTokenExchanger',
    //       'urn:ietf:params:oauth:token-type:id_token=>urn:ietf:params:oauth:token-type:id_token|org.forgerock.oauth2.core.tokenexchange.idtoken.IdTokenToIdTokenExchanger',
    //       'urn:ietf:params:oauth:token-type:access_token=>urn:ietf:params:oauth:token-type:id_token|org.forgerock.oauth2.core.tokenexchange.accesstoken.AccessTokenToIdTokenExchanger',
    //       'urn:ietf:params:oauth:token-type:id_token=>urn:ietf:params:oauth:token-type:access_token|org.forgerock.oauth2.core.tokenexchange.idtoken.IdTokenToAccessTokenExchanger',
    //     ],
    //     parRequestUriLifetime: 90,
    //     allowedAudienceValues: [],
    //     persistentClaims: [],
    //     supportedScopes: [
    //       'email|Your email address',
    //       'openid|',
    //       'address|Your postal address',
    //       'phone|Your telephone number(s)',
    //       'profile|Your personal information',
    //       'fr:idm:*',
    //       'am-introspect-all-tokens',
    //     ],
    //     authenticationAttributes: ['uid'],
    //     grantTypes: [
    //       'implicit',
    //       'urn:ietf:params:oauth:grant-type:saml2-bearer',
    //       'refresh_token',
    //       'password',
    //       'client_credentials',
    //       'urn:ietf:params:oauth:grant-type:device_code',
    //       'authorization_code',
    //       'urn:openid:params:grant-type:ciba',
    //       'urn:ietf:params:oauth:grant-type:uma-ticket',
    //       'urn:ietf:params:oauth:grant-type:jwt-bearer',
    //     ],
    //   },
    //   clientDynamicRegistrationConfig: {
    //     dynamicClientRegistrationScope: 'dynamic_client_registration',
    //     allowDynamicRegistration: false,
    //     requiredSoftwareStatementAttestedAttributes: ['redirect_uris'],
    //     dynamicClientRegistrationSoftwareStatementRequired: false,
    //     generateRegistrationAccessTokens: true,
    //   },
    //   coreOIDCConfig: {
    //     overrideableOIDCClaims: [],
    //     oidcDiscoveryEndpointEnabled: true,
    //     supportedIDTokenEncryptionMethods: [
    //       'A256GCM',
    //       'A192GCM',
    //       'A128GCM',
    //       'A128CBC-HS256',
    //       'A192CBC-HS384',
    //       'A256CBC-HS512',
    //     ],
    //     supportedClaims: [],
    //     supportedIDTokenSigningAlgorithms: [
    //       'PS384',
    //       'ES384',
    //       'RS384',
    //       'HS256',
    //       'HS512',
    //       'ES256',
    //       'RS256',
    //       'HS384',
    //       'ES512',
    //       'PS256',
    //       'PS512',
    //       'RS512',
    //     ],
    //     supportedIDTokenEncryptionAlgorithms: [
    //       'ECDH-ES+A256KW',
    //       'ECDH-ES+A192KW',
    //       'RSA-OAEP',
    //       'ECDH-ES+A128KW',
    //       'RSA-OAEP-256',
    //       'A128KW',
    //       'A256KW',
    //       'ECDH-ES',
    //       'dir',
    //       'A192KW',
    //     ],
    //     jwtTokenLifetime: 3600,
    //   },
    //   coreOAuth2Config: {
    //     refreshTokenLifetime: 604800,
    //     scopesPolicySet: 'oauth2Scopes',
    //     accessTokenMayActScript: '[Empty]',
    //     accessTokenLifetime: 3600,
    //     macaroonTokensEnabled: false,
    //     codeLifetime: 120,
    //     statelessTokensEnabled: true,
    //     usePolicyEngineForScope: false,
    //     issueRefreshToken: true,
    //     oidcMayActScript: '[Empty]',
    //     issueRefreshTokenOnRefreshedToken: true,
    //   },
    //   consent: {
    //     supportedRcsRequestSigningAlgorithms: [
    //       'PS384',
    //       'ES384',
    //       'RS384',
    //       'HS256',
    //       'HS512',
    //       'ES256',
    //       'RS256',
    //       'HS384',
    //       'ES512',
    //       'PS256',
    //       'PS512',
    //       'RS512',
    //     ],
    //     supportedRcsResponseEncryptionAlgorithms: [
    //       'ECDH-ES+A256KW',
    //       'ECDH-ES+A192KW',
    //       'ECDH-ES+A128KW',
    //       'RSA-OAEP',
    //       'RSA-OAEP-256',
    //       'A128KW',
    //       'A256KW',
    //       'ECDH-ES',
    //       'dir',
    //       'A192KW',
    //     ],
    //     supportedRcsRequestEncryptionMethods: [
    //       'A256GCM',
    //       'A192GCM',
    //       'A128GCM',
    //       'A128CBC-HS256',
    //       'A192CBC-HS384',
    //       'A256CBC-HS512',
    //     ],
    //     enableRemoteConsent: false,
    //     supportedRcsRequestEncryptionAlgorithms: [
    //       'ECDH-ES+A256KW',
    //       'ECDH-ES+A192KW',
    //       'RSA-OAEP',
    //       'ECDH-ES+A128KW',
    //       'RSA-OAEP-256',
    //       'A128KW',
    //       'A256KW',
    //       'ECDH-ES',
    //       'dir',
    //       'A192KW',
    //     ],
    //     clientsCanSkipConsent: true,
    //     supportedRcsResponseSigningAlgorithms: [
    //       'PS384',
    //       'ES384',
    //       'RS384',
    //       'HS256',
    //       'HS512',
    //       'ES256',
    //       'RS256',
    //       'HS384',
    //       'ES512',
    //       'PS256',
    //       'PS512',
    //       'RS512',
    //     ],
    //     supportedRcsResponseEncryptionMethods: [
    //       'A256GCM',
    //       'A192GCM',
    //       'A128GCM',
    //       'A128CBC-HS256',
    //       'A192CBC-HS384',
    //       'A256CBC-HS512',
    //     ],
    //   },
    //   deviceCodeConfig: {
    //     deviceUserCodeLength: 8,
    //     deviceCodeLifetime: 300,
    //     deviceUserCodeCharacterSet:
    //       '234567ACDEFGHJKLMNPQRSTWXYZabcdefhijkmnopqrstwxyz',
    //     devicePollInterval: 5,
    //   },
    //   pluginsConfig: {
    //     evaluateScopeClass:
    //       'org.forgerock.openam.oauth2.OpenAMScopeValidator',
    //     validateScopeScript: '[Empty]',
    //     accessTokenEnricherClass:
    //       'org.forgerock.openam.oauth2.OpenAMScopeValidator',
    //     oidcClaimsPluginType: 'SCRIPTED',
    //     authorizeEndpointDataProviderClass:
    //       'org.forgerock.openam.oauth2.OpenAMScopeValidator',
    //     authorizeEndpointDataProviderPluginType: 'JAVA',
    //     userCodeGeneratorClass:
    //       'org.forgerock.oauth2.core.plugins.registry.DefaultUserCodeGenerator',
    //     evaluateScopeScript: '[Empty]',
    //     oidcClaimsClass: 'org.forgerock.openam.oauth2.OpenAMScopeValidator',
    //     evaluateScopePluginType: 'JAVA',
    //     authorizeEndpointDataProviderScript: '[Empty]',
    //     accessTokenModifierClass:
    //       'org.forgerock.openam.oauth2.OpenAMScopeValidator',
    //     accessTokenModificationScript: '39c08084-1238-43e8-857f-2e11005eac49',
    //     validateScopePluginType: 'JAVA',
    //     accessTokenModificationPluginType: 'SCRIPTED',
    //     oidcClaimsScript: 'cf3515f0-8278-4ee3-a530-1bad7424c416',
    //     validateScopeClass:
    //       'org.forgerock.openam.oauth2.OpenAMScopeValidator',
    //   },
    //   cibaConfig: {
    //     cibaMinimumPollingInterval: 2,
    //     supportedCibaSigningAlgorithms: ['ES256', 'PS256'],
    //     cibaAuthReqIdLifetime: 600,
    //   },
    //   _type: {
    //     _id: 'oauth-oidc',
    //     name: 'OAuth2 Provider',
    //     collection: false,
    //   },
    // },
  };
  const depsClientImportTemplate = {
    meta: {
      origin: 'https://openam-frodo-dev.forgeblocks.com/am',
      originAmVersion: '7.3.0',
      exportedBy: 'volker.scheuber@forgerock.com',
      exportDate: '2023-04-17T15:29:35.013Z',
      exportTool: 'frodo',
      exportToolVersion: 'v0.18.9-1 [v19.4.0]',
    },
    script: {
      'cf3515f0-8278-4ee3-a530-1bad7424c416': {
        _id: 'cf3515f0-8278-4ee3-a530-1bad7424c416',
        name: 'Alpha OIDC Claims Script',
        description: 'Default alpha realm script for OIDC claims',
        script: [
          '/*',
          ' * Copyright 2014-2021 ForgeRock AS. All Rights Reserved',
          ' *',
          ' * Use of this code requires a commercial software license with ForgeRock AS',
          ' * or with one of its affiliates. All use shall be exclusively subject',
          ' * to such license between the licensee and ForgeRock AS.',
          ' */',
          '',
          '/*',
          ' * This script computes claim values returned in ID tokens and/or at the UserInfo Endpoint.',
          ' * The claim values are computed for:',
          ' * the claims derived from the requested scopes,',
          ' * the claims provided by the authorization server,',
          ' * and the claims requested by the client via the claims parameter.',
          ' *',
          ' * In the CONFIGURATION AND CUSTOMIZATION section, you can',
          ' * define the scope-to-claims mapping, and',
          ' * assign to each claim a resolver function that will compute the claim value.',
          ' *',
          ' * Defined variables (class references are provided below):',
          ' * scopes - Set<String> (6).',
          ' *          Always present, the requested scopes.',
          ' * claims - Map<String, Object> (5).',
          ' *          Always present, default server provided claims.',
          ' * claimObjects - List<Claim> (7, 2).',
          ' *                Always present, the default server provided claims.',
          ' * requestedClaims - Map<String, Set<String>> (5).',
          ' *                   Always present, not empty if the request contains the claims parameter and the server has enabled',
          ' *                   claims_parameter_supported. A map of the requested claims to possible values, otherwise empty;',
          ' *                   requested claims with no requested values will have a key but no value in the map. A key with',
          ' *                   a single value in its Set (6) indicates that this is the only value that should be returned.',
          ' * requestedTypedClaims - List<Claim> (7, 2).',
          ' *                        Always present, the requested claims.',
          ' *                        Requested claims with no requested values will have a claim with no values.',
          ' *                        A claim with a single value indicates this is the only value that should be returned.',
          ' * claimsLocales - List<String> (7).',
          " *                 The values from the 'claims_locales' parameter.",
          ' *                 See https://openid.net/specs/openid-connect-core-1_0.html#ClaimsLanguagesAndScripts for the OIDC specification details.',
          ' * requestProperties - Unmodifiable Map (5).',
          ' *                     Always present, contains a map of request properties:',
          ' *                     requestUri - The request URI.',
          ' *                     realm - The realm that the request relates to.',
          ' *                     requestParams - A map of the request params and/or posted data.',
          ' *                                     Each value is a list of one or more properties.',
          ' *                                     Please note that these should be handled in accordance with OWASP best practices:',
          ' *                                     https://owasp.org/www-community/vulnerabilities/Unsafe_use_of_Reflection.',
          ' * clientProperties - Unmodifiable Map (5).',
          ' *                    Present if the client specified in the request was identified, contains a map of client properties:',
          " *                    clientId - The client's URI for the request locale.",
          ' *                    allowedGrantTypes - List of the allowed grant types (org.forgerock.oauth2.core.GrantType) for the client.',
          ' *                    allowedResponseTypes - List of the allowed response types for the client.',
          ' *                    allowedScopes - List of the allowed scopes for the client.',
          ' *                    customProperties - A map of the custom properties of the client.',
          ' *                                       Lists or maps will be included as sub-maps; for example:',
          ' *                                       customMap[Key1]=Value1 will be returned as customMap -> Key1 -> Value1.',
          ' *                                       To add custom properties to a client, update the Custom Properties field',
          ' *                                       in AM Console > Realm Name > Applications > OAuth 2.0 > Clients > Client ID > Advanced.',
          ' * identity - AMIdentity (3).',
          ' *            Always present, the identity of the resource owner.',
          ' * session - SSOToken (4).',
          " *           Present if the request contains the session cookie, the user's session object.",
          ' * scriptName - String (primitive).',
          ' *              Always present, the display name of the script.',
          ' * logger - Always present, the "OAuth2Provider" debug logger instance:',
          ' *          https://backstage.forgerock.com/docs/am/7/scripting-guide/scripting-api-global-logger.html#scripting-api-global-logger.',
          ' *          Corresponding files will be prefixed with: scripts.OIDC_CLAIMS.',
          ' * httpClient - HTTP Client (8).',
          ' *              Always present, the HTTP Client instance:',
          ' *              https://backstage.forgerock.com/docs/am/7/scripting-guide/scripting-api-global-http-client.html#scripting-api-global-http-client.',
          ' *              In order to use the client, you may need to add',
          ' *              org.forgerock.http.Client,',
          ' *              org.forgerock.http.protocol.*,',
          ' *              and org.forgerock.util.promise.PromiseImpl',
          ' *              to the allowed Java classes in the scripting engine configuration, as described in:',
          ' *              https://backstage.forgerock.com/docs/am/7/scripting-guide/script-engine-security.html',
          ' *',
          ' * Return - a new UserInfoClaims(Map<String, Object> values, Map<String, List<String>> compositeScopes) (1) object.',
          ' *          The result of the last statement in the script is returned to the server.',
          ' *          Currently, the Immediately Invoked Function Expression (also known as Self-Executing Anonymous Function)',
          ' *          is the last (and only) statement in this script, and its return value will become the script result.',
          ' *          Do not use "return variable" statement outside of a function definition.',
          ' *          See RESULTS section for additional details.',
          ' *',
          ' * Class reference:',
          ' * (1) UserInfoClaims - https://backstage.forgerock.com/docs/am/7/apidocs/org/forgerock/oauth2/core/UserInfoClaims.html.',
          ' * (2) Claim - https://backstage.forgerock.com/docs/am/7/apidocs/org/forgerock/openidconnect/Claim.html).',
          ' *         An instance of org.forgerock.openidconnect.Claim has methods to access',
          ' *         the claim name, requested values, locale, and whether the claim is essential.',
          ' * (3) AMIdentity - https://backstage.forgerock.com/docs/am/7/apidocs/com/sun/identity/idm/AMIdentity.html.',
          ' * (4) SSOToken - https://backstage.forgerock.com/docs/am/7/apidocs/com/iplanet/sso/SSOToken.html.',
          ' * (5) Map - https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/util/HashMap.html,',
          ' *           or https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/util/LinkedHashMap.html.',
          ' * (6) Set - https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/util/HashSet.html.',
          ' * (7) List - https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/util/ArrayList.html.',
          ' * (8) Client - https://backstage.forgerock.com/docs/am/7/apidocs/org/forgerock/http/Client.html.',
          '*/',
          '',
          '(function () {',
          '    // SETUP',
          '',
          '    /**',
          '     * Claim processing utilities.',
          '     * An object that contains reusable functions for processing claims.',
          '     * @see CLAIM PROCESSING UTILITIES section for details.',
          '     */',
          '    var utils = getUtils();',
          '',
          '    // CONFIGURATION AND CUSTOMIZATION',
          '',
          '    /**',
          '     * OAuth 2.0 scope values (scopes) can be used by the Client to request OIDC claims.',
          '     *',
          '     * Call this configuration method, and pass in as the first argument',
          '     * an object that maps a scope value to an array of claim names',
          '     * to specify which claims need to be processed and returned for the requested scopes.',
          '     * @see {@link https://openid.net/specs/openid-connect-core-1_0.html#ScopeClaims}',
          '     * for the scope values that could be used to request claims as defined in the OIDC specification.',
          '     *',
          '     * Below, find a default configuration that is expected to work in the current environment.',
          '     *',
          '     * CUSTOMIZATION',
          '     * You can choose the claim names returned for a scope.',
          '     */',
          '    utils.setScopeClaimsMap({',
          '        profile: [',
          "            'name',",
          "            'family_name',",
          "            'given_name',",
          "            'zoneinfo',",
          "            'locale'",
          '        ],',
          "        email: ['email'],",
          "        address: ['address'],",
          "        phone: ['phone_number']",
          '    });',
          '',
          '    /**',
          '     * In this script, each claim',
          '     * derived from the requested scopes,',
          '     * provided by the authorization server, and',
          '     * requested by the client via the claims parameter',
          '     * will be processed by a function associated with the claim name.',
          '     *',
          '     * Call this configuration method, and pass in as the first argument',
          '     * an object that maps a claim name to a resolver function,',
          '     * which will be automatically executed for each claim processed by the script.',
          '     *',
          '     * The claim resolver function will receive the requested claim information',
          '     * in an instance of org.forgerock.openidconnect.Claim as the first argument.',
          '     * @see {@link https://backstage.forgerock.com/docs/am/7/apidocs/org/forgerock/openidconnect/Claim.html}',
          '     * for details on the Claim class.',
          '     *',
          '     * If the claim resolver function returns a value,',
          '     * other than undefined or null,',
          "     * the claim will be included in the script's results.",
          '     *',
          '     * The Claim instance provides methods to check',
          '     * what the name of the claim is,',
          '     * which values the claim request contains,',
          '     * whether the claim is essential, and',
          '     * which locale the claim is associated with.',
          '     * The resolver function can consider this information when computing and returning the claim value.',
          '     *',
          '     * Below, find a default configuration that is expected to work in the current environment.',
          '     * A reusable function, utils.getUserProfileClaimResolver(String attribute-name),',
          '     * is called to return a claim resolver function based on a user profile attribute.',
          '     * @see CLAIM RESOLVERS section for the implementation details and examples.',
          '     * For the address claim, an example of a claim resolver that uses another claim resolver is provided.',
          '     *',
          '     * CUSTOMIZATION',
          '     * You can reuse the predefined utils methods with your custom arguments.',
          '     * You can also specify a custom resolver function for a claim name,',
          '     * that will compute and return the claim value—as shown in the commented out example below.',
          '     */',
          '    utils.setClaimResolvers({',
          '        /*',
          '        // An example of a simple claim resolver function that is defined for a claim',
          '        // directly in the configuration object:',
          '        custom-claim-name: function (requestedClaim) {',
          '            // In this case, initially, the claim value comes straight from a user profile attribute value:',
          "            var claimValue = identity.getAttribute('custom-attribute-name').toArray()[0]",
          '',
          '            // Optionally, provide additional logic for processing (filtering, formatting, etc.) the claim value.',
          '            // You can use:',
          '            // requestedClaim.getName()',
          '            // requestedClaim.getValues()',
          '            // requestedClaim.getLocale()',
          '            // requestedClaim.isEssential()',
          '',
          '            return claimValue',
          '        },',
          '        */',
          '        /**',
          '         * The use of utils.getUserProfileClaimResolver shows how',
          '         * an argument passed to a function that returns a claim resolver',
          '         * becomes available to the resolver function (via its lexical context).',
          '         */',
          "        name: utils.getUserProfileClaimResolver('cn'),",
          "        family_name: utils.getUserProfileClaimResolver('sn'),",
          "        given_name: utils.getUserProfileClaimResolver('givenname'),",
          "        zoneinfo: utils.getUserProfileClaimResolver('preferredtimezone'),",
          "        locale: utils.getUserProfileClaimResolver('preferredlocale'),",
          "        email: utils.getUserProfileClaimResolver('mail'),",
          '        address: utils.getAddressClaimResolver(',
          '            /**',
          '             * The passed in user profile claim resolver function',
          '             * can be used by the address claim resolver function',
          '             * to obtain the claim value to be formatted as per the OIDC specification:',
          '             * @see https://openid.net/specs/openid-connect-core-1_0.html#AddressClaim.',
          '             */',
          "            utils.getUserProfileClaimResolver('postaladdress')",
          '        ),',
          "        phone_number: utils.getUserProfileClaimResolver('telephonenumber')",
          '    });',
          '',
          '    // CLAIM PROCESSING UTILITIES',
          '',
          '    /**',
          '     * @returns {object} An object that contains reusable claim processing utilities.',
          '     * @see PUBLIC METHODS section and the return statement for the list of exported functions.',
          '     */',
          '    function getUtils () {',
          '        // IMPORT JAVA',
          '',
          '        /**',
          '         * Provides Java scripting functionality.',
          '         * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Projects/Rhino/Scripting_Java#javaimporter_constructor}.',
          '         */',
          '        var frJava = JavaImporter(',
          '            org.forgerock.oauth2.core.exceptions.InvalidRequestException,',
          '            org.forgerock.oauth2.core.UserInfoClaims,',
          '            org.forgerock.openidconnect.Claim,',
          '',
          '            java.util.LinkedHashMap,',
          '            java.util.ArrayList',
          '        );',
          '',
          '        // SET UP CONFIGURATION',
          '',
          '        /**',
          '         * Placeholder for a configuration option that contains',
          '         * an object that maps the supported scope values (scopes)',
          '         * and the corresponding claim names for each scope value.',
          '         */',
          '        var scopeClaimsMap;',
          '',
          '        /**',
          '         * Placeholder for a configuration option that contains',
          '         * an object that maps the supported claim names',
          '         * and the resolver functions returning the claim value.',
          '         */',
          '        var claimResolvers;',
          '',
          '        /**',
          '         * A (public) method that accepts an object that maps the supported scopes and the corresponding claim names,',
          '         * and assigns it to a (private) variable that serves as a configuration option.',
          '         * @param {object} params - An object that maps each supported scope value to an array of claim names,',
          '         * in order to specify which claims need to be processed for the requested scopes.',
          '         * @see {@link https://openid.net/specs/openid-connect-core-1_0.html#ScopeClaims} for details.',
          '         * @param {string[]} [params.profile] - An array of claim names to be returned if the profile scope is requested.',
          '         * @param {string[]} [params.email] - An array of claim names to be returned if the email scope is requested.',
          '         * @param {string[]} [params.address] - An array of claim names to be returned if the address scope is requested.',
          '         * @param {string[]} [params.phone] - An array of claim names to be returned if the phone scope is requested.',
          '         * @returns {undefined}',
          '         */',
          '        function setScopeClaimsMap(params) {',
          '            scopeClaimsMap = params;',
          '        }',
          '',
          '        /**',
          '         * A (public) method that accepts an object that maps the supported claim names',
          '         * and the resolver functions returning the claim value,',
          '         * and assigns it to a (private) variable that serves as a configuration option.',
          '         * @param {object} params - An object that maps',
          '         * each supported claim name to a function that computes and returns the claim value.',
          '         */',
          '        function setClaimResolvers(params) {',
          '            claimResolvers = params;',
          '        }',
          '',
          '        // CLAIM RESOLVERS',
          '',
          '        /**',
          '         * Claim resolvers are functions that return a claim value.',
          '         * @param {*}',
          '         * @returns {*}',
          '         */',
          '',
          '        /**',
          '         * Defines a claim resolver based on a user profile attribute.',
          '         * @param {string} attributeName - Name of the user profile attribute.',
          '         * @returns {function} A function that will determine the claim value',
          '         * based on the user profile attribute and the (requested) claim properties.',
          '         */',
          '        function getUserProfileClaimResolver (attributeName) {',
          '            /**',
          '             * Resolves a claim with a user profile attribute value.',
          '             * Returns undefined if the identity attribute is not populated,',
          '             * OR if the claim has requested values that do not contain the identity attribute value.',
          '             * ATTENTION: the aforementioned comparison is case-sensitive.',
          '             * @param {org.forgerock.openidconnect.Claim} claim',
          '             * An object that provides methods to obtain information/requirements associated with a claim.',
          '             * @see {@link https://backstage.forgerock.com/docs/am/7/apidocs/org/forgerock/openidconnect/Claim.html} for details.',
          '             * @returns {string|HashSet|undefined}',
          '             */',
          '            function resolveClaim(claim) {',
          '                var userProfileValue;',
          '',
          '                if (identity) {',
          '                    userProfileValue = getClaimValueFromSet(claim, identity.getAttribute(attributeName));',
          '',
          '                    if (userProfileValue && !userProfileValue.isEmpty()) {',
          '                        if (!claim.getValues() || claim.getValues().isEmpty() || claim.getValues().contains(userProfileValue)) {',
          '                            return userProfileValue;',
          '                        }',
          '                    }',
          '                }',
          '            }',
          '',
          '            return resolveClaim;',
          '        }',
          '',
          '        /**',
          '         * Returns an address claim resolver based on a claim value obtained with another claim resolver.',
          '         * @param {function} resolveClaim - A function that returns a claim value.',
          '         * @returns {function} A function that will accept a claim as an argument,',
          '         * run the claim resolver function for the claim and obtain the claim value,',
          '         * and apply additional formatting to the value before returning it.',
          '         */',
          '        function getAddressClaimResolver (resolveClaim) {',
          '            /**',
          '             * Creates an address claim object from a value returned by a claim resolver,',
          '             * and returns the address claim object as the claim value.',
          '             * @see {@link https://openid.net/specs/openid-connect-core-1_0.html#AddressClaim}.',
          '             * The claim value is obtained with a claim resolving function available from the closure.',
          '             * @param {org.forgerock.openidconnect.Claim} claim',
          '             * An object that provides methods to obtain information/requirements associated with a claim.',
          '             * @see {@link https://backstage.forgerock.com/docs/am/7/apidocs/org/forgerock/openidconnect/Claim.html} for details.',
          '             * @returns {java.util.LinkedHashMap|undefined} The address claim object created from a claim value.',
          '             */',
          '            function resolveAddressClaim(claim) {',
          '                var claimValue = resolveClaim(claim);',
          '                var addressObject;',
          '',
          '                if (isClaimValueValid(claimValue)) {',
          '                    addressObject = new frJava.LinkedHashMap();',
          '',
          "                    addressObject.put('formatted', claimValue);",
          '',
          '                    return addressObject;',
          '                }',
          '            }',
          '',
          '            return resolveAddressClaim;',
          '        }',
          '',
          '        /**',
          '         * Returns an essential claim resolver based on a claim value obtained with another claim resolver.',
          '         * @param {function} resolveClaim - A function that returns a claim value.',
          '         * @returns {function} A function that will accept a claim as an argument,',
          '         * run the claim resolver function for the claim and obtain the claim value,',
          '         * and apply additional logic for essential claims.',
          '         */',
          '        function getEssentialClaimResolver (resolveClaim) {',
          '            /**',
          '             * Returns a claim value or throws an error.',
          '             * The claim value is obtained with a claim resolving function available from the closure.',
          '             * Throws an exception if the claim is essential and no value is returned for the claim.',
          '             *',
          '             * Use of this resolver is optional.',
          '             * @see {@link https://openid.net/specs/openid-connect-core-1_0.html#IndividualClaimsRequests} stating:',
          '             * "Note that even if the Claims are not available because the End-User did not authorize their release or they are not present,',
          '             * the Authorization Server MUST NOT generate an error when Claims are not returned, whether they are Essential or Voluntary,',
          '             * unless otherwise specified in the description of the specific claim."',
          '             *',
          '             * @param {org.forgerock.openidconnect.Claim} claim',
          '             * An object that provides methods to obtain information/requirements associated with a claim.',
          '             * @see {@link https://backstage.forgerock.com/docs/am/7/apidocs/org/forgerock/openidconnect/Claim.html} for details.',
          '             * @returns {*}',
          '             * @throws {org.forgerock.oauth2.core.exceptions.InvalidRequestException}',
          '             */',
          '            function resolveEssentialClaim(claim) {',
          '                var claimValue = resolveClaim(claim);',
          '',
          '                if (claim.isEssential() && !isClaimValueValid(claimValue)) {',
          "                    throw new frJava.InvalidRequestException('Could not provide value for essential claim: ' + claim.getName());",
          '                }',
          '',
          '                return claimValue;',
          '            }',
          '',
          '            return resolveEssentialClaim;',
          '        }',
          '',
          '        /**',
          '         * Provides default resolution for a claim.',
          '         * Use it if a claim-specific resolver is not defined in the configuration.',
          '         * @param {org.forgerock.openidconnect.Claim} claim',
          '         * An object that provides methods to obtain information/requirements associated with a claim.',
          '         * @see {@link https://backstage.forgerock.com/docs/am/7/apidocs/org/forgerock/openidconnect/Claim.html} for details.',
          '         * @returns {*} A single value associated with this claim.',
          '         */',
          '        function resolveAnyClaim (claim) {',
          '            if (claim.getValues().size() === 1) {',
          '                return claim.getValues().toArray()[0];',
          '            }',
          '        }',
          '',
          '        // UTILITIES',
          '',
          '        /**',
          '         * Returns claim value from a set.',
          '         * If the set contains a single value, returns the value.',
          '         * If the set contains multiple values, returns the set.',
          '         * Otherwise, returns undefined.',
          '         *',
          '         * @param {org.forgerock.openidconnect.Claim} claim',
          '         * An object that provides methods to obtain information/requirements associated with a claim.',
          '         * @see {@link https://backstage.forgerock.com/docs/am/7/apidocs/org/forgerock/openidconnect/Claim.html} for details.',
          '         * @param {java.util.HashSet} set The set—for example, a user profile attribute value.',
          '         * @returns {string|java.util.HashSet|undefined}',
          '         */',
          '        function getClaimValueFromSet (claim, set) {',
          '            if (set && set.size()) {',
          '                if (set.size() === 1) {',
          '                    return set.toArray()[0];',
          '                } else {',
          '                    return set;',
          '                }',
          '            } else if (logger.warningEnabled()) {',
          "                logger.warning('OIDC Claims script. Got an empty set for claim: ' + claim.getName());",
          '            }',
          '        }',
          '',
          '        function isClaimValueValid (claimValue) {',
          "            if (typeof claimValue === 'undefined' || claimValue === null) {",
          '                return false;',
          '            }',
          '',
          '            return true;',
          '        }',
          '',
          '        // CLAIM PROCESSING',
          '',
          '        /**',
          '         * Constructs and returns an object populated with the computed claim values',
          '         * and the requested scopes mapped to the claim names.',
          '         * @returns {org.forgerock.oauth2.core.UserInfoClaims} The object to be returned to the authorization server.',
          '         * @see {@link https://backstage.forgerock.com/docs/am/7/apidocs/org/forgerock/oauth2/core/UserInfoClaims.html}.',
          '         * @see RESULTS section for the use of this function.',
          '         */',
          '        function getUserInfoClaims () {',
          '            return new frJava.UserInfoClaims(getComputedClaims(), getCompositeScopes());',
          '        }',
          '',
          '        /**',
          '         * Creates a map of (requested) claim names populated with the computed claim values.',
          '         * @returns {java.util.LinkedHashMap}',
          '         * A map of the requested claim names and the corresponding claim values.',
          '         */',
          '        function getComputedClaims () {',
          '            /**',
          '             * Creates a complete list of claim objects from:',
          '             * the claims derived from the scopes,',
          '             * the claims provided by the authorization server,',
          '             * and the claims requested by the client.',
          '             * @returns {java.util.ArrayList}',
          '             * Returns a complete list of org.forgerock.openidconnect.Claim objects available to the script.',
          '             * @see {@link https://backstage.forgerock.com/docs/am/7/apidocs/org/forgerock/openidconnect/Claim.html} for the claim object details.',
          '             */',
          '            function getClaims() {',
          '                /**',
          '                 * Returns a list of claim objects for the requested scopes.',
          '                 * Uses the scopeClaimsMap configuration option to derive the claim names;',
          '                 * no other properties of a claim derived from a scope are populated.',
          '                 * @returns {java.util.ArrayList}',
          '                 * A list of org.forgerock.openidconnect.Claim objects derived from the requested scopes.',
          '                 * @see {@link https://backstage.forgerock.com/docs/am/7/apidocs/org/forgerock/openidconnect/Claim.html} for the claim object details.',
          '                 */',
          '                function convertScopeToClaims() {',
          '                    var claims = new frJava.ArrayList();',
          '',
          '                    scopes.toArray().forEach(function (scope) {',
          "                        if (String(scope) !== 'openid' && scopeClaimsMap[scope]) {",
          '                            scopeClaimsMap[scope].forEach(function (claimName) {',
          '                                claims.add(new frJava.Claim(claimName));',
          '                            });',
          '                        }',
          '                    });',
          '',
          '                    return claims;',
          '                }',
          '',
          '                var claims = new frJava.ArrayList();',
          '',
          '                claims.addAll(convertScopeToClaims());',
          '                claims.addAll(claimObjects);',
          '                claims.addAll(requestedTypedClaims);',
          '',
          '                return claims;',
          '            }',
          '',
          '            /**',
          '             * Computes and returns a claim value.',
          '             * To obtain the claim value, uses the resolver function specified for the claim in the claimResolvers configuration object.',
          '             * @see claimResolvers',
          '             * If no resolver function is found, uses the default claim resolver function.',
          '             *',
          '             * @param {org.forgerock.openidconnect.Claim} claim',
          '             * An object that provides methods to obtain information/requirements associated with a claim.',
          '             * @see {@link https://backstage.forgerock.com/docs/am/7/apidocs/org/forgerock/openidconnect/Claim.html} for details.',
          '             * @returns {*} Claim value.',
          '             * @throws {org.forgerock.oauth2.core.exceptions.InvalidRequestException}',
          '             * Rethrows this exception if a claim resolver throws it.',
          '             * You can throw org.forgerock.oauth2.core.exceptions.InvalidRequestException from your custom claim resolver',
          '             * if you want to terminate the claim processing.',
          '             */',
          '            function computeClaim(claim) {',
          '                var resolveClaim;',
          '                var message;',
          '',
          '                try {',
          '                    resolveClaim = claimResolvers[claim.getName()] || resolveAnyClaim;',
          '',
          '                    return resolveClaim(claim);',
          '                } catch (e) {',
          "                    message = 'OIDC Claims script exception. Unable to resolve OIDC Claim. ' + e;",
          '',
          "                    if (String(e).indexOf('org.forgerock.oauth2.core.exceptions.InvalidRequestException') !== -1) {",
          '                        throw e;',
          '                    }',
          '',
          '                    if (logger.warningEnabled()) {',
          '                        logger.warning(message);',
          '                    }',
          '                }',
          '            }',
          '',
          '            var computedClaims = new frJava.LinkedHashMap();',
          '',
          '            getClaims().toArray().forEach(function (claim) {',
          '                var claimValue = computeClaim(claim);',
          '',
          '                if (isClaimValueValid(claimValue)) {',
          '                    computedClaims.put(claim.getName(), claimValue);',
          '                } else {',
          '                    /**',
          '                     * If a claim has been processed, but appears in the list again,',
          '                     * and its value cannot be computed under the new conditions,',
          '                     * the claim is removed from the final result.',
          '                     *',
          '                     * For example, a claim could be mapped to a scope and found in the user profile,',
          "                     * but also requested by the client with required values that don't match the computed one.",
          '                     * @see {link https://openid.net/specs/openid-connect-core-1_0.html#IndividualClaimsRequests}.',
          '                     * for the relevant OIDC specification details.',
          '                     */',
          '                    computedClaims.remove(claim.getName());',
          '                }',
          '            });',
          '',
          '            return computedClaims;',
          '        }',
          '',
          '        /**',
          '         * Creates a map of requested scopes and the corresponding claim names.',
          '         * @returns {java.util.LinkedHashMap}',
          '         */',
          '        function getCompositeScopes () {',
          '            var compositeScopes = new frJava.LinkedHashMap();',
          '',
          '            scopes.toArray().forEach(function (scope) {',
          '                var scopeClaims = new frJava.ArrayList();',
          '',
          '                if (scopeClaimsMap[scope]) {',
          '                    scopeClaimsMap[scope].forEach(function (claimName) {',
          '                        scopeClaims.add(claimName);',
          '                    });',
          '                }',
          '',
          '                if (scopeClaims.size()) {',
          '                    compositeScopes.put(scope, scopeClaims);',
          '                }',
          '            });',
          '',
          '            return compositeScopes;',
          '        }',
          '',
          '        // PUBLIC METHODS',
          '',
          '        return {',
          '            setScopeClaimsMap: setScopeClaimsMap,',
          '            setClaimResolvers: setClaimResolvers,',
          '            getUserProfileClaimResolver: getUserProfileClaimResolver,',
          '            getAddressClaimResolver: getAddressClaimResolver,',
          '            getEssentialClaimResolver: getEssentialClaimResolver,',
          '            getUserInfoClaims: getUserInfoClaims',
          '        };',
          '    }',
          '',
          '    // RESULTS',
          '',
          '    /**',
          '     * This script returns an instance of the org.forgerock.oauth2.core.UserInfoClaims class',
          '     * populated with the computed claim values and',
          '     * the requested scopes mapped to the claim names.',
          '     * @see {@link https://backstage.forgerock.com/docs/am/7/apidocs/org/forgerock/oauth2/core/UserInfoClaims.html}.',
          '     *',
          '     * Assigning it to a variable gives you an opportunity',
          '     * to log the content of the returned value during development.',
          '     */',
          '    var userInfoClaims = utils.getUserInfoClaims();',
          '',
          '    /*',
          "    logger.error(scriptName + ' results:')",
          "    logger.error('Values: ' + userInfoClaims.getValues())",
          "    logger.error('Scopes: ' + userInfoClaims.getCompositeScopes())",
          '    */',
          '',
          '    return userInfoClaims;',
          '}());',
        ],
        default: false,
        language: 'JAVASCRIPT',
        context: 'OIDC_CLAIMS',
        createdBy: 'null',
        creationDate: 0,
        lastModifiedBy: 'null',
        lastModifiedDate: 0,
      },
      '39c08084-1238-43e8-857f-2e11005eac49': {
        _id: '39c08084-1238-43e8-857f-2e11005eac49',
        name: 'Alpha OAuth2 Access Token Modification Script',
        description:
          'Default alpha realm script for OAuth2 Access Token Modification',
        script: [
          '/*',
          ' * Copyright 2019-2021 ForgeRock AS. All Rights Reserved.',
          ' *',
          ' * Use of this code requires a commercial software license with ForgeRock AS',
          ' * or with one of its affiliates. All use shall be exclusively subject',
          ' * to such license between the licensee and ForgeRock AS.',
          ' */',
          '',
          '/*',
          ' * This script lets you modify information associated with an OAuth2 access token',
          ' * with methods provided by the AccessToken (1) interface.',
          ' * The changes made to OAuth2 access tokens will directly impact the size of the CTS tokens,',
          ' * and, similarly, the size of the JWTs if client-based OAuth2 tokens are utilized.',
          ' * When adding/updating fields make sure that the token size remains within client/user-agent limits.',
          ' *',
          ' * Defined variables:',
          ' * accessToken - AccessToken (1).',
          ' *               The access token to be updated.',
          ' *               Mutable object, all changes to the access token will be reflected.',
          ' * scopes - Set<String> (6).',
          ' *          Always present, the requested scopes.',
          ' * requestProperties - Unmodifiable Map (5).',
          ' *                     Always present, contains a map of request properties:',
          ' *                     requestUri - The request URI.',
          ' *                     realm - The realm that the request relates to.',
          ' *                     requestParams - A map of the request params and/or posted data.',
          ' *                                     Each value is a list of one or more properties.',
          ' *                                     Please note that these should be handled in accordance with OWASP best practices:',
          ' *                                     https://owasp.org/www-community/vulnerabilities/Unsafe_use_of_Reflection.',
          ' * clientProperties - Unmodifiable Map (5).',
          ' *                    Present if the client specified in the request was identified, contains a map of client properties:',
          " *                    clientId - The client's URI for the request locale.",
          ' *                    allowedGrantTypes - List of the allowed grant types (org.forgerock.oauth2.core.GrantType) for the client.',
          ' *                    allowedResponseTypes - List of the allowed response types for the client.',
          ' *                    allowedScopes - List of the allowed scopes for the client.',
          ' *                    customProperties - A map of the custom properties of the client.',
          ' *                                       Lists or maps will be included as sub-maps; for example:',
          ' *                                       customMap[Key1]=Value1 will be returned as customMap -> Key1 -> Value1.',
          ' *                                       To add custom properties to a client, update the Custom Properties field',
          ' *                                       in AM Console > Realm Name > Applications > OAuth 2.0 > Clients > Client ID > Advanced.',
          ' * identity - AMIdentity (3).',
          ' *            Always present, the identity of the resource owner.',
          ' * session - SSOToken (4).',
          " *           Present if the request contains the session cookie, the user's session object.",
          ' * scriptName - String (primitive).',
          ' *              Always present, the display name of the script.',
          ' * logger - Always present, the "OAuth2Provider" debug logger instance:',
          ' *          https://backstage.forgerock.com/docs/am/7/scripting-guide/scripting-api-global-logger.html#scripting-api-global-logger.',
          ' *          Corresponding log files will be prefixed with: scripts.OAUTH2_ACCESS_TOKEN_MODIFICATION.',
          ' * httpClient - HTTP Client (8).',
          ' *              Always present, the HTTP Client instance:',
          ' *              https://backstage.forgerock.com/docs/am/7/scripting-guide/scripting-api-global-http-client.html#scripting-api-global-http-client.',
          ' *',
          ' * Return - no value is expected, changes shall be made to the accessToken parameter directly.',
          ' *',
          ' * Class reference:',
          ' * (1) AccessToken - https://backstage.forgerock.com/docs/am/7/apidocs/org/forgerock/oauth2/core/AccessToken.html.',
          ' * (3) AMIdentity - https://backstage.forgerock.com/docs/am/7/apidocs/com/sun/identity/idm/AMIdentity.html.',
          ' * (4) SSOToken - https://backstage.forgerock.com/docs/am/7/apidocs/com/iplanet/sso/SSOToken.html.',
          ' * (5) Map - https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/util/HashMap.html,',
          ' *           or https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/util/LinkedHashMap.html.',
          ' * (6) Set - https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/util/HashSet.html.',
          ' * (8) Client - https://backstage.forgerock.com/docs/am/7/apidocs/org/forgerock/http/Client.html.',
          ' */',
          '',
          '/* EXAMPLE',
          '(function () {',
          '    var frJava = JavaImporter(',
          '        org.forgerock.http.protocol.Request,',
          '        org.forgerock.http.protocol.Response',
          '    );',
          '',
          '    // Always includes this field in the token.',
          "    accessToken.setField('key1', 'value1');",
          '',
          '    // Receives and adds to the access token additional values by performing a REST call to an external service.',
          '    // WARNING: Below, you will find a reference to a third-party site, which is provided only as an example.',
          "    var uri = 'https://jsonplaceholder.typicode.com/posts';",
          '',
          '    try {',
          '        var request = new frJava.Request();',
          '',
          '        // You can chain methods that return the request object.',
          '        request.setUri(uri)',
          "            .setMethod('POST')",
          '            .setEntity(JSON.stringify({',
          '                updatedFields: {',
          "                    key2: 'value2',",
          "                    key3: 'value3'",
          '                }',
          '            }));',
          '',
          '        // You can call a method when chaining is not possible.',
          "        request.getHeaders().add('Content-Type', 'application/json; charset=UTF-8');",
          '',
          '        // Sends the request and receives the response.',
          '        var response = httpClient.send(request).getOrThrow();',
          '',
          '        // Checks if the response status is as expected.',
          '        if (response.getStatus() === org.forgerock.http.protocol.Status.CREATED) {',
          '            var result = JSON.parse(response.getEntity().getString());',
          '',
          '            // Set multiple token fields at once.',
          '            accessToken.setFields(result.updatedFields);',
          '        } else {',
          "            logger.error('Unable to obtain access token modifications. Status: ' + response.getStatus() + '. Content: ' + response.getEntity().getString());",
          '        }',
          '    } catch (e) {',
          "        logger.error('The request processing was interrupted. ' + e);",
          '',
          '        // The access token request fails with the HTTP 500 error in this case.',
          "        throw ('Unable to obtain response from: ' + uri);",
          '    }',
          '',
          '    // Adds new fields containing identity attribute values to the access token.',
          "    accessToken.setField('mail', identity.getAttribute('mail'));",
          "    accessToken.setField('phone', identity.getAttribute('telephoneNumber').toArray()[0]);",
          '',
          '    // Adds new fields containing the session property values.',
          '    // NOTE: session may not be available for non-interactive authorization grants.',
          '    if (session) {',
          '        try {',
          "            accessToken.setField('ipAddress', session.getProperty('Host'));",
          '        } catch (e) {',
          "            logger.error('Unable to retrieve session property value. ' + e);",
          '        }',
          '    }',
          '',
          '    // Removes a native field from the token entry, that was set by AM.',
          '    // WARNING: removing native fields from the token may result in loss of functionality.',
          '    // accessToken.removeTokenName()',
          '',
          '    // No return value is expected. Let it be undefined.',
          '}());',
          '*/',
        ],
        default: false,
        language: 'JAVASCRIPT',
        context: 'OAUTH2_ACCESS_TOKEN_MODIFICATION',
        createdBy: 'null',
        creationDate: 0,
        lastModifiedBy: 'null',
        lastModifiedDate: 0,
      },
    },
    application: {
      FrodoTestOAuth2Client1: {
        overrideOAuth2ClientConfig: {
          issueRefreshToken: true,
          validateScopePluginType: 'PROVIDER',
          tokenEncryptionEnabled: false,
          evaluateScopePluginType: 'PROVIDER',
          oidcMayActScript: '[Empty]',
          oidcClaimsScript: 'cf3515f0-8278-4ee3-a530-1bad7424c416',
          scopesPolicySet: 'oauth2Scopes',
          accessTokenModificationPluginType: 'SCRIPTED',
          authorizeEndpointDataProviderClass:
            'org.forgerock.oauth2.core.plugins.registry.DefaultEndpointDataProvider',
          oidcClaimsPluginType: 'SCRIPTED',
          providerOverridesEnabled: true,
          authorizeEndpointDataProviderScript: '[Empty]',
          statelessTokensEnabled: false,
          authorizeEndpointDataProviderPluginType: 'PROVIDER',
          remoteConsentServiceId: '[Empty]',
          enableRemoteConsent: false,
          validateScopeClass:
            'org.forgerock.oauth2.core.plugins.registry.DefaultScopeValidator',
          usePolicyEngineForScope: false,
          evaluateScopeClass:
            'org.forgerock.oauth2.core.plugins.registry.DefaultScopeEvaluator',
          overrideableOIDCClaims: [],
          accessTokenMayActScript: '[Empty]',
          evaluateScopeScript: '[Empty]',
          clientsCanSkipConsent: false,
          accessTokenModificationScript: '39c08084-1238-43e8-857f-2e11005eac49',
          issueRefreshTokenOnRefreshedToken: true,
          validateScopeScript: '[Empty]',
        },
        advancedOAuth2ClientConfig: {
          logoUri: {
            inherited: false,
            value: [],
          },
          subjectType: {
            inherited: false,
            value: 'public',
          },
          clientUri: {
            inherited: false,
            value: [],
          },
          tokenExchangeAuthLevel: {
            inherited: false,
            value: 0,
          },
          responseTypes: {
            inherited: false,
            value: ['code', 'token', 'id_token'],
          },
          mixUpMitigation: {
            inherited: false,
            value: false,
          },
          customProperties: {
            inherited: false,
            value: [],
          },
          javascriptOrigins: {
            inherited: false,
            value: [
              'https://my.application.com',
              'https://my.application.com:443',
            ],
          },
          policyUri: {
            inherited: false,
            value: [],
          },
          softwareVersion: {
            inherited: false,
          },
          tosURI: {
            inherited: false,
            value: [],
          },
          sectorIdentifierUri: {
            inherited: false,
          },
          tokenEndpointAuthMethod: {
            inherited: false,
            value: 'client_secret_basic',
          },
          refreshTokenGracePeriod: {
            inherited: false,
            value: 0,
          },
          isConsentImplied: {
            inherited: false,
            value: true,
          },
          softwareIdentity: {
            inherited: false,
          },
          grantTypes: {
            inherited: false,
            value: [
              'authorization_code',
              'client_credentials',
              'refresh_token',
            ],
          },
          require_pushed_authorization_requests: {
            inherited: false,
            value: false,
          },
          descriptions: {
            inherited: false,
            value: [],
          },
          requestUris: {
            inherited: false,
            value: [],
          },
          name: {
            inherited: false,
            value: [],
          },
          contacts: {
            inherited: false,
            value: [],
          },
          updateAccessToken: {
            inherited: false,
          },
        },
        signEncOAuth2ClientConfig: {
          tokenEndpointAuthSigningAlgorithm: {
            inherited: false,
            value: 'RS256',
          },
          idTokenEncryptionEnabled: {
            inherited: false,
            value: false,
          },
          tokenIntrospectionEncryptedResponseEncryptionAlgorithm: {
            inherited: false,
            value: 'A128CBC-HS256',
          },
          requestParameterSignedAlg: {
            inherited: false,
          },
          authorizationResponseSigningAlgorithm: {
            inherited: false,
            value: 'RS256',
          },
          clientJwtPublicKey: {
            inherited: false,
          },
          idTokenPublicEncryptionKey: {
            inherited: false,
          },
          mTLSSubjectDN: {
            inherited: false,
          },
          jwkStoreCacheMissCacheTime: {
            inherited: false,
            value: 60000,
          },
          jwkSet: {
            inherited: false,
          },
          idTokenEncryptionMethod: {
            inherited: false,
            value: 'A128CBC-HS256',
          },
          jwksUri: {
            inherited: false,
          },
          tokenIntrospectionEncryptedResponseAlg: {
            inherited: false,
            value: 'RSA-OAEP-256',
          },
          authorizationResponseEncryptionMethod: {
            inherited: false,
          },
          userinfoResponseFormat: {
            inherited: false,
            value: 'JSON',
          },
          mTLSCertificateBoundAccessTokens: {
            inherited: false,
            value: false,
          },
          publicKeyLocation: {
            inherited: false,
            value: 'jwks_uri',
          },
          tokenIntrospectionResponseFormat: {
            inherited: false,
            value: 'JSON',
          },
          requestParameterEncryptedEncryptionAlgorithm: {
            inherited: false,
            value: 'A128CBC-HS256',
          },
          userinfoSignedResponseAlg: {
            inherited: false,
          },
          idTokenEncryptionAlgorithm: {
            inherited: false,
            value: 'RSA-OAEP-256',
          },
          requestParameterEncryptedAlg: {
            inherited: false,
          },
          authorizationResponseEncryptionAlgorithm: {
            inherited: false,
          },
          mTLSTrustedCert: {
            inherited: false,
          },
          jwksCacheTimeout: {
            inherited: false,
            value: 3600000,
          },
          userinfoEncryptedResponseAlg: {
            inherited: false,
          },
          idTokenSignedResponseAlg: {
            inherited: false,
            value: 'RS256',
          },
          tokenIntrospectionSignedResponseAlg: {
            inherited: false,
            value: 'RS256',
          },
          userinfoEncryptedResponseEncryptionAlgorithm: {
            inherited: false,
            value: 'A128CBC-HS256',
          },
        },
        coreOpenIDClientConfig: {
          claims: {
            inherited: false,
            value: [],
          },
          backchannel_logout_uri: {
            inherited: false,
          },
          defaultAcrValues: {
            inherited: false,
            value: [],
          },
          jwtTokenLifetime: {
            inherited: false,
            value: 3600,
          },
          defaultMaxAgeEnabled: {
            inherited: false,
            value: false,
          },
          clientSessionUri: {
            inherited: false,
          },
          defaultMaxAge: {
            inherited: false,
            value: 600,
          },
          postLogoutRedirectUri: {
            inherited: false,
            value: [],
          },
          backchannel_logout_session_required: {
            inherited: false,
            value: false,
          },
        },
        coreOAuth2ClientConfig: {
          userpassword: null,
          status: {
            inherited: false,
            value: 'Active',
          },
          clientName: {
            inherited: false,
            value: [],
          },
          clientType: {
            inherited: false,
            value: 'Confidential',
          },
          loopbackInterfaceRedirection: {
            inherited: false,
            value: false,
          },
          defaultScopes: {
            inherited: false,
            value: [],
          },
          refreshTokenLifetime: {
            inherited: false,
            value: 604800,
          },
          scopes: {
            inherited: false,
            value: ['openid', 'profile', 'email'],
          },
          accessTokenLifetime: {
            inherited: false,
            value: 3600,
          },
          redirectionUris: {
            inherited: false,
            value: ['https://my.application.com/callback'],
          },
          authorizationCodeLifetime: {
            inherited: false,
            value: 120,
          },
        },
        coreUmaClientConfig: {
          claimsRedirectionUris: {
            inherited: false,
            value: [],
          },
        },
        _type: {
          _id: 'OAuth2Client',
          name: 'OAuth2 Clients',
          collection: true,
        },
        _provider: {
          _id: '',
          _rev: '745152125',
          advancedOIDCConfig: {
            supportedRequestParameterEncryptionEnc: [
              'A256GCM',
              'A192GCM',
              'A128GCM',
              'A128CBC-HS256',
              'A192CBC-HS384',
              'A256CBC-HS512',
            ],
            authorisedOpenIdConnectSSOClients: [],
            supportedUserInfoEncryptionAlgorithms: [
              'ECDH-ES+A256KW',
              'ECDH-ES+A192KW',
              'RSA-OAEP',
              'ECDH-ES+A128KW',
              'RSA-OAEP-256',
              'A128KW',
              'A256KW',
              'ECDH-ES',
              'dir',
              'A192KW',
            ],
            supportedAuthorizationResponseEncryptionEnc: [
              'A256GCM',
              'A192GCM',
              'A128GCM',
              'A128CBC-HS256',
              'A192CBC-HS384',
              'A256CBC-HS512',
            ],
            supportedTokenIntrospectionResponseEncryptionAlgorithms: [
              'ECDH-ES+A256KW',
              'ECDH-ES+A192KW',
              'RSA-OAEP',
              'ECDH-ES+A128KW',
              'RSA-OAEP-256',
              'A128KW',
              'A256KW',
              'ECDH-ES',
              'dir',
              'A192KW',
            ],
            useForceAuthnForPromptLogin: false,
            alwaysAddClaimsToToken: true,
            supportedTokenIntrospectionResponseSigningAlgorithms: [
              'PS384',
              'RS384',
              'EdDSA',
              'ES384',
              'HS256',
              'HS512',
              'ES256',
              'RS256',
              'HS384',
              'ES512',
              'PS256',
              'PS512',
              'RS512',
            ],
            supportedTokenEndpointAuthenticationSigningAlgorithms: [
              'PS384',
              'ES384',
              'RS384',
              'HS256',
              'HS512',
              'ES256',
              'RS256',
              'HS384',
              'ES512',
              'PS256',
              'PS512',
              'RS512',
            ],
            supportedRequestParameterSigningAlgorithms: [
              'PS384',
              'ES384',
              'RS384',
              'HS256',
              'HS512',
              'ES256',
              'RS256',
              'HS384',
              'ES512',
              'PS256',
              'PS512',
              'RS512',
            ],
            includeAllKtyAlgCombinationsInJwksUri: false,
            amrMappings: {},
            loaMapping: {},
            authorisedIdmDelegationClients: [],
            idTokenInfoClientAuthenticationEnabled: true,
            storeOpsTokens: true,
            supportedUserInfoSigningAlgorithms: [
              'ES384',
              'HS256',
              'HS512',
              'ES256',
              'RS256',
              'HS384',
              'ES512',
            ],
            supportedAuthorizationResponseSigningAlgorithms: [
              'PS384',
              'RS384',
              'EdDSA',
              'ES384',
              'HS256',
              'HS512',
              'ES256',
              'RS256',
              'HS384',
              'ES512',
              'PS256',
              'PS512',
              'RS512',
            ],
            supportedUserInfoEncryptionEnc: [
              'A256GCM',
              'A192GCM',
              'A128GCM',
              'A128CBC-HS256',
              'A192CBC-HS384',
              'A256CBC-HS512',
            ],
            claimsParameterSupported: false,
            supportedTokenIntrospectionResponseEncryptionEnc: [
              'A256GCM',
              'A192GCM',
              'A128GCM',
              'A128CBC-HS256',
              'A192CBC-HS384',
              'A256CBC-HS512',
            ],
            supportedAuthorizationResponseEncryptionAlgorithms: [
              'ECDH-ES+A256KW',
              'ECDH-ES+A192KW',
              'RSA-OAEP',
              'ECDH-ES+A128KW',
              'RSA-OAEP-256',
              'A128KW',
              'A256KW',
              'ECDH-ES',
              'dir',
              'A192KW',
            ],
            supportedRequestParameterEncryptionAlgorithms: [
              'ECDH-ES+A256KW',
              'ECDH-ES+A192KW',
              'ECDH-ES+A128KW',
              'RSA-OAEP',
              'RSA-OAEP-256',
              'A128KW',
              'A256KW',
              'ECDH-ES',
              'dir',
              'A192KW',
            ],
            defaultACR: [],
          },
          advancedOAuth2Config: {
            passwordGrantAuthService: 'PasswordGrant',
            tokenCompressionEnabled: false,
            tokenEncryptionEnabled: false,
            requirePushedAuthorizationRequests: false,
            tlsCertificateBoundAccessTokensEnabled: true,
            defaultScopes: ['address', 'phone', 'openid', 'profile', 'email'],
            moduleMessageEnabledInPasswordGrant: false,
            supportedSubjectTypes: ['public', 'pairwise'],
            refreshTokenGracePeriod: 0,
            tlsClientCertificateHeaderFormat: 'URLENCODED_PEM',
            hashSalt: 'qAWV0MFSQpC/f1GPbZAZnMRksak=',
            macaroonTokenFormat: 'V2',
            maxAgeOfRequestObjectNbfClaim: 0,
            tlsCertificateRevocationCheckingEnabled: false,
            nbfClaimRequiredInRequestObject: false,
            requestObjectProcessing: 'OIDC',
            maxDifferenceBetweenRequestObjectNbfAndExp: 0,
            responseTypeClasses: [
              'code|org.forgerock.oauth2.core.AuthorizationCodeResponseTypeHandler',
              'device_code|org.forgerock.oauth2.core.TokenResponseTypeHandler',
              'token|org.forgerock.oauth2.core.TokenResponseTypeHandler',
              'id_token|org.forgerock.openidconnect.IdTokenResponseTypeHandler',
            ],
            expClaimRequiredInRequestObject: false,
            tokenValidatorClasses: [
              'urn:ietf:params:oauth:token-type:id_token|org.forgerock.oauth2.core.tokenexchange.idtoken.OidcIdTokenValidator',
              'urn:ietf:params:oauth:token-type:access_token|org.forgerock.oauth2.core.tokenexchange.accesstoken.OAuth2AccessTokenValidator',
            ],
            tokenSigningAlgorithm: 'HS256',
            codeVerifierEnforced: 'false',
            displayNameAttribute: 'cn',
            tokenExchangeClasses: [
              'urn:ietf:params:oauth:token-type:access_token=>urn:ietf:params:oauth:token-type:access_token|org.forgerock.oauth2.core.tokenexchange.accesstoken.AccessTokenToAccessTokenExchanger',
              'urn:ietf:params:oauth:token-type:id_token=>urn:ietf:params:oauth:token-type:id_token|org.forgerock.oauth2.core.tokenexchange.idtoken.IdTokenToIdTokenExchanger',
              'urn:ietf:params:oauth:token-type:access_token=>urn:ietf:params:oauth:token-type:id_token|org.forgerock.oauth2.core.tokenexchange.accesstoken.AccessTokenToIdTokenExchanger',
              'urn:ietf:params:oauth:token-type:id_token=>urn:ietf:params:oauth:token-type:access_token|org.forgerock.oauth2.core.tokenexchange.idtoken.IdTokenToAccessTokenExchanger',
            ],
            parRequestUriLifetime: 90,
            allowedAudienceValues: [],
            persistentClaims: [],
            supportedScopes: [
              'email|Your email address',
              'openid|',
              'address|Your postal address',
              'phone|Your telephone number(s)',
              'profile|Your personal information',
              'fr:idm:*',
              'am-introspect-all-tokens',
            ],
            authenticationAttributes: ['uid'],
            grantTypes: [
              'implicit',
              'urn:ietf:params:oauth:grant-type:saml2-bearer',
              'refresh_token',
              'password',
              'client_credentials',
              'urn:ietf:params:oauth:grant-type:device_code',
              'authorization_code',
              'urn:openid:params:grant-type:ciba',
              'urn:ietf:params:oauth:grant-type:uma-ticket',
              'urn:ietf:params:oauth:grant-type:jwt-bearer',
            ],
          },
          clientDynamicRegistrationConfig: {
            dynamicClientRegistrationScope: 'dynamic_client_registration',
            allowDynamicRegistration: false,
            requiredSoftwareStatementAttestedAttributes: ['redirect_uris'],
            dynamicClientRegistrationSoftwareStatementRequired: false,
            generateRegistrationAccessTokens: true,
          },
          coreOIDCConfig: {
            overrideableOIDCClaims: [],
            oidcDiscoveryEndpointEnabled: true,
            supportedIDTokenEncryptionMethods: [
              'A256GCM',
              'A192GCM',
              'A128GCM',
              'A128CBC-HS256',
              'A192CBC-HS384',
              'A256CBC-HS512',
            ],
            supportedClaims: [],
            supportedIDTokenSigningAlgorithms: [
              'PS384',
              'ES384',
              'RS384',
              'HS256',
              'HS512',
              'ES256',
              'RS256',
              'HS384',
              'ES512',
              'PS256',
              'PS512',
              'RS512',
            ],
            supportedIDTokenEncryptionAlgorithms: [
              'ECDH-ES+A256KW',
              'ECDH-ES+A192KW',
              'RSA-OAEP',
              'ECDH-ES+A128KW',
              'RSA-OAEP-256',
              'A128KW',
              'A256KW',
              'ECDH-ES',
              'dir',
              'A192KW',
            ],
            jwtTokenLifetime: 3600,
          },
          coreOAuth2Config: {
            refreshTokenLifetime: 604800,
            scopesPolicySet: 'oauth2Scopes',
            accessTokenMayActScript: '[Empty]',
            accessTokenLifetime: 3600,
            macaroonTokensEnabled: false,
            codeLifetime: 120,
            statelessTokensEnabled: true,
            usePolicyEngineForScope: false,
            issueRefreshToken: true,
            oidcMayActScript: '[Empty]',
            issueRefreshTokenOnRefreshedToken: true,
          },
          consent: {
            supportedRcsRequestSigningAlgorithms: [
              'PS384',
              'ES384',
              'RS384',
              'HS256',
              'HS512',
              'ES256',
              'RS256',
              'HS384',
              'ES512',
              'PS256',
              'PS512',
              'RS512',
            ],
            supportedRcsResponseEncryptionAlgorithms: [
              'ECDH-ES+A256KW',
              'ECDH-ES+A192KW',
              'ECDH-ES+A128KW',
              'RSA-OAEP',
              'RSA-OAEP-256',
              'A128KW',
              'A256KW',
              'ECDH-ES',
              'dir',
              'A192KW',
            ],
            supportedRcsRequestEncryptionMethods: [
              'A256GCM',
              'A192GCM',
              'A128GCM',
              'A128CBC-HS256',
              'A192CBC-HS384',
              'A256CBC-HS512',
            ],
            enableRemoteConsent: false,
            supportedRcsRequestEncryptionAlgorithms: [
              'ECDH-ES+A256KW',
              'ECDH-ES+A192KW',
              'RSA-OAEP',
              'ECDH-ES+A128KW',
              'RSA-OAEP-256',
              'A128KW',
              'A256KW',
              'ECDH-ES',
              'dir',
              'A192KW',
            ],
            clientsCanSkipConsent: true,
            supportedRcsResponseSigningAlgorithms: [
              'PS384',
              'ES384',
              'RS384',
              'HS256',
              'HS512',
              'ES256',
              'RS256',
              'HS384',
              'ES512',
              'PS256',
              'PS512',
              'RS512',
            ],
            supportedRcsResponseEncryptionMethods: [
              'A256GCM',
              'A192GCM',
              'A128GCM',
              'A128CBC-HS256',
              'A192CBC-HS384',
              'A256CBC-HS512',
            ],
          },
          deviceCodeConfig: {
            deviceUserCodeLength: 8,
            deviceCodeLifetime: 300,
            deviceUserCodeCharacterSet:
              '234567ACDEFGHJKLMNPQRSTWXYZabcdefhijkmnopqrstwxyz',
            devicePollInterval: 5,
          },
          pluginsConfig: {
            evaluateScopeClass:
              'org.forgerock.openam.oauth2.OpenAMScopeValidator',
            validateScopeScript: '[Empty]',
            accessTokenEnricherClass:
              'org.forgerock.openam.oauth2.OpenAMScopeValidator',
            oidcClaimsPluginType: 'SCRIPTED',
            authorizeEndpointDataProviderClass:
              'org.forgerock.openam.oauth2.OpenAMScopeValidator',
            authorizeEndpointDataProviderPluginType: 'JAVA',
            userCodeGeneratorClass:
              'org.forgerock.oauth2.core.plugins.registry.DefaultUserCodeGenerator',
            evaluateScopeScript: '[Empty]',
            oidcClaimsClass: 'org.forgerock.openam.oauth2.OpenAMScopeValidator',
            evaluateScopePluginType: 'JAVA',
            authorizeEndpointDataProviderScript: '[Empty]',
            accessTokenModifierClass:
              'org.forgerock.openam.oauth2.OpenAMScopeValidator',
            accessTokenModificationScript:
              '39c08084-1238-43e8-857f-2e11005eac49',
            validateScopePluginType: 'JAVA',
            accessTokenModificationPluginType: 'SCRIPTED',
            oidcClaimsScript: 'cf3515f0-8278-4ee3-a530-1bad7424c416',
            validateScopeClass:
              'org.forgerock.openam.oauth2.OpenAMScopeValidator',
          },
          cibaConfig: {
            cibaMinimumPollingInterval: 2,
            supportedCibaSigningAlgorithms: ['ES256', 'PS256'],
            cibaAuthReqIdLifetime: 600,
          },
          _type: {
            _id: 'oauth-oidc',
            name: 'OAuth2 Provider',
            collection: false,
          },
        },
      },
    },
  };
  const client1 = {
    id: 'FrodoTestOAuth2Client1',
    data: cloneDeep(rawClientTemplate),
  };
  const client2 = {
    id: 'FrodoTestOAuth2Client2',
    data: cloneDeep(rawClientTemplate),
  };
  const client3 = {
    id: 'FrodoTestOAuth2Client3',
    data: cloneDeep(rawClientTemplate),
  };
  const client4 = {
    id: 'FrodoTestOAuth2Client4',
    data: {},
  };
  const client5 = {
    id: 'FrodoTestOAuth2Client5',
    data: {},
  };
  const client6 = {
    id: 'FrodoTestOAuth2Client6',
    data: {},
  };
  const client7 = {
    id: 'FrodoTestOAuth2Client7',
    data: {},
  };
  const client8 = {
    id: 'FrodoTestOAuth2Client8',
    data: {},
  };
  const client9 = {
    id: 'FrodoTestOAuth2Client9',
    data: {},
  };
  const client10 = {
    id: 'FrodoTestOAuth2Client10',
    data: {},
  };
  const client11 = {
    id: 'FrodoTestOAuth2Client11',
    data: {},
  };
  const client12 = {
    id: 'FrodoTestOAuth2Client12',
    data: {},
  };
  const client13 = {
    id: 'FrodoTestOAuth2Client13',
    data: {},
  };
  const import1: {
    id: string;
    data: object;
  } = {
    id: 'FrodoTestOAuth2Client4',
    data: applyOAuth2ClientImportTemplate(depsClientImportTemplate, [
      'FrodoTestOAuth2Client4',
    ]),
  };
  const import2: {
    id: string;
    data: object;
  } = {
    id: 'FrodoTestOAuth2Client5',
    data: applyOAuth2ClientImportTemplate(depsClientImportTemplate, [
      'FrodoTestOAuth2Client5',
    ]),
  };
  const importData1 = applyOAuth2ClientImportTemplate(
    depsClientImportTemplate,
    ['FrodoTestOAuth2Client6', 'FrodoTestOAuth2Client7']
  );
  const importData2 = applyOAuth2ClientImportTemplate(
    depsClientImportTemplate,
    ['FrodoTestOAuth2Client8', 'FrodoTestOAuth2Client9']
  );
  const importData3 = applyOAuth2ClientImportTemplate(
    depsClientImportTemplate,
    ['FrodoTestOAuth2Client10', 'FrodoTestOAuth2Client11']
  );
  const importData4 = applyOAuth2ClientImportTemplate(
    depsClientImportTemplate,
    ['FrodoTestOAuth2Client12', 'FrodoTestOAuth2Client13']
  );
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageOAuth2Client(client1);
      await stageOAuth2Client(client2);
      await stageOAuth2Client(client3, false);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageOAuth2Client(client1, false);
      await stageOAuth2Client(client2, false);
      await stageOAuth2Client(client3, false);
      await stageOAuth2Client(client4, false);
      await stageOAuth2Client(client5, false);
      await stageOAuth2Client(client6, false);
      await stageOAuth2Client(client7, false);
      await stageOAuth2Client(client8, false);
      await stageOAuth2Client(client9, false);
      await stageOAuth2Client(client10, false);
      await stageOAuth2Client(client11, false);
      await stageOAuth2Client(client12, false);
      await stageOAuth2Client(client13, false);
    }
  });

  describe('exportOAuth2Client()', () => {
    test('0: Method is implemented', async () => {
      expect(OAuth2ClientOps.exportOAuth2Client).toBeDefined();
    });

    test(`1: Export oauth2 client ${client1.id}`, async () => {
      const response = await OAuth2ClientOps.exportOAuth2Client({
        clientId: client1.id,
        state,
      });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('exportOAuth2Clients()', () => {
    test('0: Method is implemented', async () => {
      expect(OAuth2ClientOps.exportOAuth2Clients).toBeDefined();
    });

    test('1: Export all oauth2 clients', async () => {
      const response = await OAuth2ClientOps.exportOAuth2Clients({ state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('getOAuth2Clients()', () => {
    test('0: Method is implemented', async () => {
      expect(OAuth2ClientOps.getOAuth2Clients).toBeDefined();
    });

    test(`1: Get oauth2 clients`, async () => {
      const response = await OAuth2ClientOps.getOAuth2Clients({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('getOAuth2Client()', () => {
    test('0: Method is implemented', async () => {
      expect(OAuth2ClientOps.getOAuth2Client).toBeDefined();
    });

    test(`1: Get oauth2 client ${client1.id}`, async () => {
      const response = await OAuth2ClientOps.getOAuth2Client({
        clientId: client1.id,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('putOAuth2Client()', () => {
    test('0: Method is implemented', async () => {
      expect(OAuth2ClientOps.putOAuth2Client).toBeDefined();
    });

    test(`1: Put oauth2 client ${client3.id}`, async () => {
      const response = await OAuth2ClientOps.putOAuth2Client({
        clientId: client3.id,
        clientData: client3.data,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('importOAuth2Client()', () => {
    test('0: Method is implemented', async () => {
      expect(OAuth2ClientOps.importOAuth2Client).toBeDefined();
    });

    test(`1: Import oauth2 client ${import1.id} w/ dependencies`, async () => {
      expect.assertions(1);
      const response = await OAuth2ClientOps.importOAuth2Client({
        clientId: import1.id,
        importData: import1.data as OAuth2ClientOps.OAuth2ClientExportInterface,
        options: { deps: true },
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`2: Import oauth2 client ${import2.id} w/o dependencies`, async () => {
      expect.assertions(1);
      const response = await OAuth2ClientOps.importOAuth2Client({
        clientId: import2.id,
        importData: import2.data as OAuth2ClientOps.OAuth2ClientExportInterface,
        options: { deps: false },
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('importFirstOAuth2Client()', () => {
    test('0: Method is implemented', async () => {
      expect(OAuth2ClientOps.importFirstOAuth2Client).toBeDefined();
    });

    test(`1: Import first oauth2 client w/ dependencies`, async () => {
      expect.assertions(1);
      const outcome = await OAuth2ClientOps.importFirstOAuth2Client({
        importData: importData1 as OAuth2ClientOps.OAuth2ClientExportInterface,
        options: { deps: true },
        state,
      });
      expect(outcome).toMatchSnapshot();
    });

    test(`2: Import first oauth2 client w/o dependencies`, async () => {
      expect.assertions(1);
      const outcome = await OAuth2ClientOps.importFirstOAuth2Client({
        importData: importData2 as OAuth2ClientOps.OAuth2ClientExportInterface,
        options: { deps: false },
        state,
      });
      expect(outcome).toMatchSnapshot();
    });
  });

  describe('importOAuth2Clients()', () => {
    test('0: Method is implemented', async () => {
      expect(OAuth2ClientOps.importOAuth2Clients).toBeDefined();
    });
  });

  test(`1: Import all oauth2 clients w/ dependencies`, async () => {
    expect.assertions(1);
    const outcome = await OAuth2ClientOps.importOAuth2Clients({
      importData: importData3 as OAuth2ClientOps.OAuth2ClientExportInterface,
      options: { deps: true },
      state,
    });
    expect(outcome).toMatchSnapshot();
  });

  test(`1: Import all oauth2 clients w/o dependencies`, async () => {
    expect.assertions(1);
    const outcome = await OAuth2ClientOps.importOAuth2Clients({
      importData: importData4 as OAuth2ClientOps.OAuth2ClientExportInterface,
      options: { deps: false },
      state,
    });
    expect(outcome).toMatchSnapshot();
  });
});
