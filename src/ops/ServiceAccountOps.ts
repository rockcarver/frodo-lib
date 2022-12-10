import { createManagedObject } from '../api/ManagedObjectApi';
import { JwksInterface } from './JoseOps';
import { ObjectSkeletonInterface } from '../api/ApiTypes';
import { debugMessage } from './utils/Console';
import { getConfigEntity } from './IdmOps';

const moType = 'svcacct';

export interface SvcacctInterface {
  name: string;
  description: string;
  accountStatus: 'Active' | 'Inactive';
  scopes: string[];
  jwks: string;
}

let serviceAccountsFeatureAvailable: boolean = undefined;
export async function isServiceAccountsFeatureAvailable(): Promise<boolean> {
  debugMessage(`ServiceAccountOps.isServiceAccountsFeatureAvailable: start`);
  // only look up the schema once
  if (typeof serviceAccountsFeatureAvailable !== 'undefined')
    return serviceAccountsFeatureAvailable;

  serviceAccountsFeatureAvailable = false;
  const schema = await getConfigEntity('managed');
  for (const object of schema['objects']) {
    if (object['name'] === 'svcacct') serviceAccountsFeatureAvailable = true;
  }
  debugMessage(
    `ServiceAccountOps.isServiceAccountsFeatureAvailable: end, available=${serviceAccountsFeatureAvailable}`
  );
  return serviceAccountsFeatureAvailable;
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
  const payload: SvcacctInterface = {
    name,
    description,
    accountStatus,
    scopes,
    jwks: JSON.stringify(jwks),
  };
  debugMessage(`SvcacctOps: createSvcacct: payload:`);
  debugMessage(payload);
  const result = await createManagedObject(moType, payload);
  return result;
}
