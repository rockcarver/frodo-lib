import { IdObjectSkeletonInterface } from '../../api/ApiTypes';
import {
  createManagedObject,
  getManagedObject,
} from '../../api/ManagedObjectApi';
import Constants from '../../shared/Constants';
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

const s = Constants.AVAILABLE_SCOPES;

export const SERVICE_ACCOUNT_ALLOWED_SCOPES: string[] = [
  s.AmFullScope,
  s.AnalyticsFullScope,
  s.AutoAccessFullScope,
  s.CertificateFullScope,
  s.CertificateReadScope,
  s.ContentSecurityPolicyFullScope,
  s.CustomDomainFullScope,
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
];

export const SERVICE_ACCOUNT_DEFAULT_SCOPES: string[] = [
  s.AmFullScope,
  s.AnalyticsFullScope,
  s.AutoAccessFullScope,
  s.CertificateFullScope,
  s.ContentSecurityPolicyFullScope,
  s.CookieDomainsFullScope,
  s.CustomDomainFullScope,
  s.ESVFullScope,
  s.IdmFullScope,
  s.IGAFullScope,
  s.PromotionScope,
  s.ReleaseFullScope,
  s.SSOCookieFullScope,
  s.ProxyConnectFullScope,
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
