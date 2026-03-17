import { IdObjectSkeletonInterface } from '../../api/ApiTypes';
import {
  createManagedSystemObject,
  getManagedSystemObject,
} from '../../api/ManagedSystemObjectApi';
import Constants from '../../shared/Constants';
import { State } from '../../shared/State';
import { debugMessage } from '../../utils/Console';
import { getFreshSaBearerToken } from '../AuthenticateOps';
import { FrodoError } from '../FrodoError';
import { JwkRsa, JwksInterface } from '../JoseOps';
import { AccessTokenMetaType } from '../OAuth2OidcOps';
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
  /**
   * Validate service account
   * @param {string} saId optional service account id
   * @param {JwkRsa} saJwk optional service account JWK
   * @returns {Promise<AccessTokenMetaType | null>} Access token or null if validation fails
   */
  validateServiceAccount(
    saId?: string,
    saJwk?: JwkRsa
  ): Promise<AccessTokenMetaType | null>;
};

export default (state: State): ServiceAccount => {
  return {
    async isServiceAccountsFeatureAvailable(): Promise<boolean> {
      return isServiceAccountsFeatureAvailable({ state });
    },
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
    async getServiceAccount(serviceAccountId: string) {
      return getServiceAccount({ serviceAccountId, state });
    },
    async validateServiceAccount(
      saId?: string,
      saJwk?: JwkRsa
    ): Promise<AccessTokenMetaType | null> {
      return validateServiceAccount({ saId, saJwk, state });
    },
  };
};

const MANAGED_OBJECT_TYPE = 'svcacct';

const s = Constants.AVAILABLE_SCOPES;

export const SERVICE_ACCOUNT_ALLOWED_SCOPES: string[] = [
  s.AmFullScope,
  s.AnalyticsFullScope,
  s.DirectConfigurationSessionFullScope,
  s.AutoAccessFullScope,
  s.CertificateFullScope,
  s.CertificateReadScope,
  s.ContentSecurityPolicyFullScope,
  s.CustomDomainFullScope,
  s.DatasetDeletionFullScope,
  s.ESVFullScope,
  s.ESVReadScope,
  s.ESVRestartScope,
  s.ESVUpdateScope,
  s.IdmFullScope,
  s.IGAFullScope,
  s.PromotionScope,
  s.ReleaseFullScope,
  s.SSOCookieFullScope,
  s.ProxyConnectFullScope,
  s.ProxyConnectReadScope,
  s.ProxyConnectWriteScope,
  s.CookieDomainsFullScope,
  s.WSFedAdminScope,
];

export const SERVICE_ACCOUNT_DEFAULT_SCOPES: string[] = [
  s.AmFullScope,
  s.AnalyticsFullScope,
  s.DirectConfigurationSessionFullScope,
  s.AutoAccessFullScope,
  s.CertificateFullScope,
  s.ContentSecurityPolicyFullScope,
  s.CookieDomainsFullScope,
  s.CustomDomainFullScope,
  s.DatasetDeletionFullScope,
  s.ESVFullScope,
  s.IdmFullScope,
  s.IGAFullScope,
  s.PromotionScope,
  s.ReleaseFullScope,
  s.SSOCookieFullScope,
  s.ProxyConnectFullScope,
  s.WSFedAdminScope,
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
    const result = await createManagedSystemObject({
      type: MANAGED_OBJECT_TYPE,
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
    const serviceAccount = await getManagedSystemObject({
      type: MANAGED_OBJECT_TYPE,
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

export async function validateServiceAccount({
  saId = undefined,
  saJwk = undefined,
  state,
}: {
  saId?: string;
  saJwk?: JwkRsa;
  state: State;
}): Promise<AccessTokenMetaType | null> {
  try {
    debugMessage({
      message: `ServiceAccountOps.validateServiceAccount: start`,
      state,
    });
    const token = await getFreshSaBearerToken({ saId, saJwk, state });
    debugMessage({
      message: `ServiceAccountOps.validateServiceAccount: end, token ${token ? 'obtained' : 'not obtained'}`,
      state,
    });
    return token;
  } catch (error) {
    throw new FrodoError(`Error validating service account ${saId}`, error);
  }
}
