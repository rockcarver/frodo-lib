import {
  createOAuth2Provider as _createOAuth2Provider,
  deleteOAuth2Provider as _deleteOAuth2Provider,
  getOAuth2Provider as _getOAuth2Provider,
  OAuth2ProviderSkeleton,
  putOAuth2Provider as _putOAuth2Provider,
} from '../api/OAuth2ProviderApi';
import { State } from '../shared/State';
import { FrodoError } from './FrodoError';

export type OAuth2Provider = {
  /**
   * Read oauth2 provider
   * @returns {Promise<OAuth2ProviderSkeleton>} a promise resolving to an oauth2 provider object
   */
  readOAuth2Provider(): Promise<OAuth2ProviderSkeleton | null>;
  /**
   * Create oauth2 provider
   * @param {OAuth2ProviderSkeleton} providerData oauth2 provider data
   * @returns {Promise<OAuth2ProviderSkeleton>} a promise resolving to an oauth2 provider object
   */
  createOAuth2Provider(
    providerData?: OAuth2ProviderSkeleton
  ): Promise<OAuth2ProviderSkeleton>;
  /**
   * Update or create oauth2 provider
   * @param {OAuth2ProviderSkeleton} providerData oauth2 provider data
   * @returns {Promise<OAuth2ProviderSkeleton>} a promise resolving to an oauth2 provider object
   */
  updateOAuth2Provider(
    providerData: OAuth2ProviderSkeleton
  ): Promise<OAuth2ProviderSkeleton>;
  /**
   * Delete oauth2 provider
   * @returns {Promise<OAuth2ProviderSkeleton>} a promise resolving to an oauth2 provider object
   */
  deleteOAuth2Provider(): Promise<OAuth2ProviderSkeleton>;

  // Deprecated

  /**
   * Get oauth2 provider
   * @returns {Promise<OAuth2ProviderSkeleton>} a promise resolving to an oauth2 provider object
   * @deprecated since v2.0.0 use {@link OAuth2Provider.readOAuth2Provider | readOAuth2Provider} instead
   * ```javascript
   * importFirstSocialIdentityProvider(importData: SocialProviderExportInterface): Promise<SocialIdpSkeleton>
   * ```
   * @group Deprecated
   */
  getOAuth2Provider(): Promise<OAuth2ProviderSkeleton>;
};

export default (state: State): OAuth2Provider => {
  return {
    async readOAuth2Provider(): Promise<OAuth2ProviderSkeleton | null> {
      return readOAuth2Provider({ state });
    },
    async createOAuth2Provider(
      providerData?: OAuth2ProviderSkeleton
    ): Promise<OAuth2ProviderSkeleton> {
      return createOAuth2Provider({ providerData, state });
    },
    async updateOAuth2Provider(
      providerData: OAuth2ProviderSkeleton
    ): Promise<OAuth2ProviderSkeleton> {
      return updateOAuth2Provider({ providerData, state });
    },
    async deleteOAuth2Provider(): Promise<OAuth2ProviderSkeleton> {
      return deleteOAuth2Provider({ state });
    },

    // Deprecated

    async getOAuth2Provider(): Promise<OAuth2ProviderSkeleton> {
      return readOAuth2Provider({ state });
    },
  };
};

export async function readOAuth2Provider({
  state,
}: {
  state: State;
}): Promise<OAuth2ProviderSkeleton | null> {
  try {
    return _getOAuth2Provider({ state });
  } catch (error) {
    if (error.httpStatus === 404 || error.response?.status === 404) {
      // return null if no provider exists
      return null;
    } else {
      throw new FrodoError(`Error reading oauth2 provider`, error);
    }
  }
}

/**
 * Create OAuth2 provider
 * @param {OAuth2ProviderSkeleton} providerData oauth2 provider object
 * @returns {Promise<OAuth2ProviderSkeleton>} a promise that resolves to an oauth2 provider object
 */
export async function createOAuth2Provider({
  providerData: providerData,
  state,
}: {
  providerData: OAuth2ProviderSkeleton;
  state: State;
}): Promise<OAuth2ProviderSkeleton> {
  try {
    return _createOAuth2Provider({ providerData, state });
  } catch (error) {
    throw new FrodoError(`Error creating oauth2 provider`, error);
  }
}

/**
 * Update or create OAuth2 provider
 * @param {OAuth2ProviderSkeleton} providerData oauth2 provider object
 * @returns {Promise<OAuth2ProviderSkeleton>} a promise that resolves to an oauth2 provider object
 */
export async function updateOAuth2Provider({
  providerData: providerData,
  state,
}: {
  providerData: OAuth2ProviderSkeleton;
  state: State;
}): Promise<OAuth2ProviderSkeleton> {
  try {
    return _putOAuth2Provider({ providerData, state });
  } catch (error) {
    throw new FrodoError(`Error updating oauth2 provider`, error);
  }
}

/**
 * Delete OAuth2 Provider
 * @returns {Promise<OAuth2ProviderSkeleton>} a promise that resolves to an oauth2 provider object
 */
export async function deleteOAuth2Provider({
  state,
}: {
  state: State;
}): Promise<OAuth2ProviderSkeleton> {
  try {
    return _deleteOAuth2Provider({ state });
  } catch (error) {
    throw new FrodoError(`Error deleting oauth2 provider`, error);
  }
}
