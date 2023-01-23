import {
  createManagedObject,
  getManagedObject,
} from '../../api/ManagedObjectApi';
import { JwksInterface } from '../JoseOps';
import { ObjectSkeletonInterface } from '../../api/ApiTypes';
import { debugMessage } from '../utils/Console';
import { hasFeature } from './FeatureOps';

const moType = 'svcacct';

export interface ServiceAccountPayloadInterface {
  name: string;
  description: string;
  accountStatus: 'Active' | 'Inactive';
  scopes: string[];
  jwks: string;
}

export type ServiceAccount = ObjectSkeletonInterface &
  ServiceAccountPayloadInterface;

/**
 * Global flag indicating if service accounts are available
 */
let _featureAvailable: boolean = undefined;

/**
 * Check if service accounts are available
 * @returns {Promise<boolean>} true if service accounts are available, false otherwise
 */
export async function isServiceAccountsFeatureAvailable(): Promise<boolean> {
  debugMessage(`ServiceAccountOps.isServiceAccountsFeatureAvailable: start`);
  // only perform check once
  if (typeof _featureAvailable !== 'undefined') return _featureAvailable;

  _featureAvailable = await hasFeature('service-accounts');
  debugMessage(
    `ServiceAccountOps.isServiceAccountsFeatureAvailable: end, available=${_featureAvailable}`
  );
  return _featureAvailable;
}

/**
 * Create service account
 * @param {string} name Human-readable name of service account
 * @param {string} description Description of service account
 * @param {'Active' | 'Inactive'} accountStatus Service account status
 * @param {string[]} scopes Scopes.
 * @param {JwksInterface} jwks Java Web Key Set
 * @returns {Promise<ObjectSkeletonInterface>} A promise resolving to a service account object
 */
export async function createServiceAccount(
  name: string,
  description: string,
  accountStatus: 'Active' | 'Inactive',
  scopes: string[],
  jwks: JwksInterface
): Promise<ObjectSkeletonInterface> {
  debugMessage(`ServiceAccountOps.createServiceAccount: start`);
  const payload: ServiceAccountPayloadInterface = {
    name,
    description,
    accountStatus,
    scopes,
    jwks: JSON.stringify(jwks),
  };
  debugMessage(`ServiceAccountOps: createServiceAccount: payload:`);
  debugMessage(payload);
  const result = await createManagedObject(moType, payload);
  debugMessage(`ServiceAccountOps.createServiceAccount: end`);
  return result;
}

export async function getServiceAccount(serviceAccountId: string) {
  const serviceAccount = await getManagedObject(moType, serviceAccountId);
  return serviceAccount as ServiceAccount;
}
