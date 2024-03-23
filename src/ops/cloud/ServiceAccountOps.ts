import { IdObjectSkeletonInterface } from '../../api/ApiTypes';
import {
  createManagedObject,
  getManagedObject,
} from '../../api/ManagedObjectApi';
import { State } from '../../shared/State';
import { debugMessage } from '../../utils/Console';
import { FrodoError } from '../FrodoError';
import { JwksInterface } from '../JoseOps';
import { hasFeature } from './FeatureOps';

export type ServiceAccount = {
  /**
   * Check if service accounts are available
   * @returns {Promise<boolean>} true if service accounts are available, false otherwise
   */
  isServiceAccountsFeatureAvailable(): Promise<boolean>;
  /**
   * Create service account
   * @param {string} name Human-readable name of service account
   * @param {string} description Description of service account
   * @param {'Active' | 'Inactive'} accountStatus Service account status
   * @param {string[]} scopes Scopes.
   * @param {JwksInterface} jwks Java Web Key Set
   * @returns {Promise<IdObjectSkeletonInterface>} A promise resolving to a service account object
   */
  createServiceAccount(
    name: string,
    description: string,
    accountStatus: 'active' | 'inactive',
    scopes: string[],
    jwks: JwksInterface
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Get service account
   * @param {string} serviceAccountId service account id
   * @returns {Promise<ServiceAccountType>} a promise resolving to a service account object
   */
  getServiceAccount(serviceAccountId: string): Promise<ServiceAccountType>;
};

export default (state: State): ServiceAccount => {
  return {
    /**
     * Check if service accounts are available
     * @returns {Promise<boolean>} true if service accounts are available, false otherwise
     */
    async isServiceAccountsFeatureAvailable(): Promise<boolean> {
      return isServiceAccountsFeatureAvailable({ state });
    },

    /**
     * Create service account
     * @param {string} name Human-readable name of service account
     * @param {string} description Description of service account
     * @param {'Active' | 'Inactive'} accountStatus Service account status
     * @param {string[]} scopes Scopes.
     * @param {JwksInterface} jwks Java Web Key Set
     * @returns {Promise<IdObjectSkeletonInterface>} A promise resolving to a service account object
     */
    async createServiceAccount(
      name: string,
      description: string,
      accountStatus: 'active' | 'inactive',
      scopes: string[],
      jwks: JwksInterface
    ): Promise<IdObjectSkeletonInterface> {
      return createServiceAccount({
        name,
        description,
        accountStatus,
        scopes,
        jwks,
        state,
      });
    },

    /**
     * Get service account
     * @param {string} serviceAccountId service account id
     * @returns {Promise<ServiceAccountType>} a promise resolving to a service account object
     */
    async getServiceAccount(serviceAccountId: string) {
      return getServiceAccount({ serviceAccountId, state });
    },
  };
};

const moType = 'svcacct';

// Scopes
const scopes = {
  OpenIdScope: 'openid',
  ProfileScope: 'profile',
  AmFullScope: 'fr:am:*',
  IdmFullScope: 'fr:idm:*',
  AutoAccessFullScope: 'fr:autoaccess:*',
  IGAFullScope: 'fr:iga:*',
  AnalyticsFullScope: 'fr:idc:analytics:*',

  // AMIntrospectRealmTokenScope lets you introspect scopes _from the same realm_, there is a separate scope to introspect tokens from _all_ realms
  AMIntrospectRealmTokenScope: 'am-introspect-all-tokens',

  // Special AM scopes (used by resource servers)
  AMIntrospectAllTokens: 'am-introspect-all-tokens',
  AMIntrospectAllTokensAnyRealm: 'am-introspect-all-tokens-any-realm',

  // Certificate scopes
  CertificateFullScope: 'fr:idc:certificate:*',
  CertificateReadScope: 'fr:idc:certificate:read',

  // ESV API scopes
  ESVFullScope: 'fr:idc:esv:*',
  ESVReadScope: 'fr:idc:esv:read',
  ESVUpdateScope: 'fr:idc:esv:update',
  ESVRestartScope: 'fr:idc:esv:restart',

  // Content security policy scopes
  ContentSecurityPolicyFullScope: 'fr:idc:content-security-policy:*',

  // Federation scopes
  FederationFullScope: 'fr:idc:federation:*',
  FederationReadScope: 'fr:idc:federation:read',

  // Release scopes
  ReleaseFullScope: 'fr:idc:release:*',

  // SSOCookie scopes
  SSOCookieFullScope: 'fr:idc:sso-cookie:*',

  // CustomDomainFullScope Custom domain scopes
  CustomDomainFullScope: 'fr:idc:custom-domain:*',

  // Promotion scopes
  PromotionScope: 'fr:idc:promotion:*',
};

export const SERVICE_ACCOUNT_ALLOWED_SCOPES: string[] = [
  scopes.AmFullScope,
  scopes.AnalyticsFullScope,
  scopes.AutoAccessFullScope,
  scopes.CertificateFullScope,
  scopes.CertificateReadScope,
  scopes.ContentSecurityPolicyFullScope,
  scopes.CustomDomainFullScope,
  scopes.ESVFullScope,
  scopes.ESVReadScope,
  scopes.ESVRestartScope,
  scopes.ESVUpdateScope,
  scopes.IdmFullScope,
  scopes.IGAFullScope,
  scopes.PromotionScope,
  scopes.ReleaseFullScope,
  scopes.SSOCookieFullScope,
];

export const SERVICE_ACCOUNT_DEFAULT_SCOPES: string[] = [
  scopes.AmFullScope,
  scopes.AnalyticsFullScope,
  scopes.AutoAccessFullScope,
  scopes.CertificateFullScope,
  scopes.CertificateReadScope,
  scopes.ContentSecurityPolicyFullScope,
  scopes.CustomDomainFullScope,
  scopes.ESVFullScope,
  scopes.IdmFullScope,
  scopes.IGAFullScope,
  scopes.PromotionScope,
  scopes.ReleaseFullScope,
  scopes.SSOCookieFullScope,
];

export type ServiceAccountType = IdObjectSkeletonInterface & {
  name: string;
  description: string;
  accountStatus: 'active' | 'inactive';
  scopes: string[];
  jwks: string;
};

/**
 * Check if service accounts are available
 * @returns {Promise<boolean>} true if service accounts are available, false otherwise
 */
export async function isServiceAccountsFeatureAvailable({
  state,
}: {
  state: State;
}): Promise<boolean> {
  debugMessage({
    message: `ServiceAccountOps.isServiceAccountsFeatureAvailable: start`,
    state,
  });
  const featureAvailable = await hasFeature({
    featureId: 'service-accounts',
    state,
  });
  debugMessage({
    message: `ServiceAccountOps.isServiceAccountsFeatureAvailable: end, available=${featureAvailable}`,
    state,
  });
  return featureAvailable;
}

/**
 * Create service account
 * @param {string} name Human-readable name of service account
 * @param {string} description Description of service account
 * @param {'active' | 'inactive'} accountStatus Service account status
 * @param {string[]} scopes Scopes.
 * @param {JwksInterface} jwks Java Web Key Set
 * @param {State} state library state
 * @returns {Promise<ServiceAccountType>} A promise resolving to a service account object
 */
export async function createServiceAccount({
  name,
  description,
  accountStatus,
  scopes,
  jwks,
  state,
}: {
  name: string;
  description: string;
  accountStatus: 'active' | 'inactive';
  scopes: string[];
  jwks: JwksInterface;
  state: State;
}): Promise<ServiceAccountType> {
  try {
    debugMessage({
      message: `ServiceAccountOps.createServiceAccount: start`,
      state,
    });
    const payload: ServiceAccountType = {
      name,
      description,
      accountStatus,
      scopes,
      jwks: JSON.stringify(jwks),
    };
    debugMessage({
      message: `ServiceAccountOps: createServiceAccount: payload:`,
      state,
    });
    debugMessage({ message: payload, state });
    const result = await createManagedObject({
      moType,
      moData: payload,
      state,
    });
    debugMessage({
      message: `ServiceAccountOps.createServiceAccount: end`,
      state,
    });
    return result as ServiceAccountType;
  } catch (error) {
    throw new FrodoError(`Error creating service account ${name}`, error);
  }
}

/**
 * Get service account
 * @param {string} serviceAccountId service account id
 * @param {State} state library state
 * @returns {Promise} a promise resolving to a service account object
 */
export async function getServiceAccount({
  serviceAccountId,
  state,
}: {
  serviceAccountId: string;
  state: State;
}) {
  try {
    debugMessage({
      message: `ServiceAccountOps.getServiceAccount: start`,
      state,
    });
    const serviceAccount = await getManagedObject({
      type: moType,
      id: serviceAccountId,
      fields: ['*'],
      state,
    });
    debugMessage({ message: serviceAccount, state });
    debugMessage({
      message: `ServiceAccountOps.getServiceAccount: end`,
      state,
    });
    return serviceAccount as ServiceAccountType;
  } catch (error) {
    throw new FrodoError(
      `Error getting service account ${serviceAccountId}`,
      error
    );
  }
}
