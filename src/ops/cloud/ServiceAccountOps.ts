import {
  createManagedObject,
  getManagedObject,
} from '../../api/ManagedObjectApi';
import { JwksInterface } from '../JoseOps';
import { IdObjectSkeletonInterface } from '../../api/ApiTypes';
import { debugMessage } from '../../utils/Console';
import { hasFeature } from './FeatureOps';
import { State } from '../../shared/State';

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
    accountStatus: 'Active' | 'Inactive',
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
      accountStatus: 'Active' | 'Inactive',
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

export type ServiceAccountType = IdObjectSkeletonInterface & {
  name: string;
  description: string;
  accountStatus: 'Active' | 'Inactive';
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
 * @param {'Active' | 'Inactive'} accountStatus Service account status
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
  accountStatus: 'Active' | 'Inactive';
  scopes: string[];
  jwks: JwksInterface;
  state: State;
}): Promise<ServiceAccountType> {
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
  const result = await createManagedObject({ moType, moData: payload, state });
  debugMessage({
    message: `ServiceAccountOps.createServiceAccount: end`,
    state,
  });
  return result as ServiceAccountType;
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
  const serviceAccount = await getManagedObject({
    type: moType,
    id: serviceAccountId,
    fields: ['*'],
    state,
  });
  return serviceAccount as ServiceAccountType;
}
