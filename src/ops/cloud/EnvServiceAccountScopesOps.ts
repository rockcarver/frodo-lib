import {
  getServiceAccountScopes as _getServiceAccountScopes,
  ServiceAccountScope,
} from '../../api/cloud/EnvServiceAccountScopesApi';
import { State } from '../../shared/State';
import { FrodoError } from '../FrodoError';

// The api layer (api/cloud/EnvServiceAccountScopesApi.ts) reads this catalog
// with the AM-domain credential and no scope assertion: a session cookie, or
// under browser login the token exchanged for fr:am:*. It answers 401 to a
// call without a credential and to a browser login's primary token, as seen
// against a live tenant.

export type EnvServiceAccountScopes = {
  /**
   * Read available service account scopes
   * @returns {Promise<SSOCookieConfig>} a promise that resolves to an array of ServiceAccountScope objects or a flattened array of scope strings
   */
  readServiceAccountScopes(
    flatten?: boolean
  ): Promise<ServiceAccountScope[] | string[]>;
};

export default (state: State): EnvServiceAccountScopes => {
  return {
    async readServiceAccountScopes(
      flatten: false
    ): Promise<ServiceAccountScope[] | string[]> {
      return readServiceAccountScopes({ flatten, state });
    },
  };
};

export function flattenScopes(scopes: ServiceAccountScope[]): string[] {
  const flattenedScopes: string[] = [];
  for (const scope of scopes) {
    flattenedScopes.push(scope.scope);
    if (scope.childScopes) {
      flattenedScopes.push(...flattenScopes(scope.childScopes));
    }
  }
  return flattenedScopes;
}

/**
 * Read available service account scopes
 * @returns {Promise<SSOCookieConfig>} a promise that resolves to an array of ServiceAccountScope objects or a flattened array of scope strings
 */
export async function readServiceAccountScopes({
  flatten = false,
  state,
}: {
  flatten: boolean;
  state: State;
}): Promise<ServiceAccountScope[] | string[]> {
  try {
    const scopes = await _getServiceAccountScopes({ state });
    if (flatten) {
      return flattenScopes(scopes);
    }
    return scopes;
  } catch (error) {
    throw new FrodoError(`Error reading service account scopes`, error);
  }
}
