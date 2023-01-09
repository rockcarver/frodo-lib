import { createManagedObject } from '../api/ManagedObjectApi';
import { JwksInterface } from './JoseOps';
import { ObjectSkeletonInterface } from '../api/ApiTypes';
import { debugMessage } from './utils/Console';
import { step } from '../api/AuthenticateApi';

const moType = 'svcacct';

export interface SvcacctInterface {
  name: string;
  description: string;
  accountStatus: 'Active' | 'Inactive';
  scopes: string[];
  jwks: string;
}

/**
 * Global flag indicating if service accounts are available
 */
let serviceAccountsFeatureAvailable: boolean = undefined;

/**
 * Check if service accounts are available
 * @returns {Promise<boolean>} true if service accounts are available, false otherwise
 */
export async function isServiceAccountsFeatureAvailable(): Promise<boolean> {
  debugMessage(`ServiceAccountOps.isServiceAccountsFeatureAvailable: start`);
  // only perform check once
  if (typeof serviceAccountsFeatureAvailable !== 'undefined')
    return serviceAccountsFeatureAvailable;

  serviceAccountsFeatureAvailable = true;
  try {
    await step({}, {}, '/', 'FRServiceAccountInternal');
  } catch (error) {
    debugMessage(error.response?.data);
    if (
      error.response?.status === 400 &&
      error.response?.data?.message === 'No Configuration found'
    ) {
      serviceAccountsFeatureAvailable = false;
    }
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
  debugMessage(`ServiceAccountOps.createServiceAccount: start`);
  const payload: SvcacctInterface = {
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
