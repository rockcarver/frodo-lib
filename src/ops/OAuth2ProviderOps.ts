import { getOAuth2Provider as _getOAuth2Provider } from '../api/OAuth2ProviderApi';

/**
 * Get OAuth2 provider
 * @returns {Promise<any>} a promise that resolves to an oauth2 provider object
 */
export async function getOAuth2Provider() {
  return _getOAuth2Provider();
}
