import {
  createManagedObject,
  getManagedObject,
} from '../../api/ManagedObjectApi';
import { JwksInterface } from '../JoseOps';
import { IdObjectSkeletonInterface } from '../../api/ApiTypes';
import { debugMessage } from '../utils/Console';
import { hasFeature } from './FeatureOps';
import { getTenantURL } from '../../api/utils/ApiUtils';
import State from '../../shared/State';

export default class ServiceAccountOps {
  state: State;
  constructor(state: State) {
    this.state = state;
  }

  /**
   * Check if service accounts are available
   * @returns {Promise<boolean>} true if service accounts are available, false otherwise
   */
  async isServiceAccountsFeatureAvailable(): Promise<boolean> {
    return isServiceAccountsFeatureAvailable({ state: this.state });
  }

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
      state: this.state,
    });
  }

  /**
   * Get service account
   * @param {string} serviceAccountId service account id
   * @returns {Promise<ServiceAccount>} a promise resolving to a service account object
   */
  async getServiceAccount(serviceAccountId: string) {
    return getServiceAccount({ serviceAccountId, state: this.state });
  }
}

const moType = 'svcacct';

export interface ServiceAccountPayloadInterface {
  name: string;
  description: string;
  accountStatus: 'Active' | 'Inactive';
  scopes: string[];
  jwks: string;
}

export type ServiceAccount = IdObjectSkeletonInterface &
  ServiceAccountPayloadInterface;

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
 * @returns {Promise<IdObjectSkeletonInterface>} A promise resolving to a service account object
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
}): Promise<IdObjectSkeletonInterface> {
  debugMessage({
    message: `ServiceAccountOps.createServiceAccount: start`,
    state,
  });
  const payload: ServiceAccountPayloadInterface = {
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
  const result = await createManagedObject(
    getTenantURL(state.getHost()),
    moType,
    payload,
    state
  );
  debugMessage({
    message: `ServiceAccountOps.createServiceAccount: end`,
    state,
  });
  return result;
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
    baseUrl: getTenantURL(state.getHost()),
    type: moType,
    id: serviceAccountId,
    fields: ['*'],
    state,
  });
  return serviceAccount as ServiceAccount;
}
