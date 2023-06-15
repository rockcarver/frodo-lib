import { VersionOfSecretStatus } from '../../api/ApiTypes';
import {
  createNewVersionOfSecret,
  deleteSecret,
  deleteVersionOfSecret,
  getSecret,
  getSecrets,
  getSecretVersions,
  getVersionOfSecret,
  putSecret,
  setSecretDescription,
  setStatusOfVersionOfSecret,
} from '../../api/cloud/SecretsApi';
import State from '../../shared/State';

export default class SecretsOps {
  state: State;
  constructor(state: State) {
    this.state = state;
  }

  /**
   * Get all secrets
   * @returns {Promise<unknown[]>} a promise that resolves to an array of secrets
   */
  async getSecrets() {
    return getSecrets({ state: this.state });
  }

  /**
   * Get secret
   * @param secretId secret id/name
   * @returns {Promise<unknown>} a promise that resolves to a secret
   */
  async getSecret(secretId: string) {
    return getSecret({ secretId, state: this.state });
  }

  /**
   * Create secret
   * @param {string} secretId secret id/name
   * @param {string} value secret value
   * @param {string} description secret description
   * @param {string} encoding secret encoding (only `generic` is supported)
   * @param {boolean} useInPlaceholders flag indicating if the secret can be used in placeholders
   * @returns {Promise<unknown>} a promise that resolves to a secret
   */
  async putSecret(
    secretId: string,
    value: string,
    description: string,
    encoding = 'generic',
    useInPlaceholders = true
  ) {
    return putSecret({
      secretId,
      value,
      description,
      encoding,
      useInPlaceholders,
      state: this.state,
    });
  }

  /**
   * Set secret description
   * @param {string} secretId secret id/name
   * @param {string} description secret description
   * @returns {Promise<unknown>} a promise that resolves to a status object
   */
  async setSecretDescription(secretId: string, description: string) {
    return setSecretDescription({ secretId, description, state: this.state });
  }

  /**
   * Delete secret
   * @param {string} secretId secret id/name
   * @returns {Promise<unknown>} a promise that resolves to a secret object
   */
  async deleteSecret(secretId: string) {
    return deleteSecret({ secretId, state: this.state });
  }

  /**
   * Get secret versions
   * @param {string} secretId secret id/name
   * @returns {Promise<unknown>} a promise that resolves to an array of secret versions
   */
  async getSecretVersions(secretId: string) {
    return getSecretVersions({ secretId, state: this.state });
  }

  /**
   * Create new secret version
   * @param {string} secretId secret id/name
   * @param {string} value secret value
   * @returns {Promise<unknown>} a promise that resolves to a version object
   */
  async createNewVersionOfSecret(secretId: string, value: string) {
    return createNewVersionOfSecret({ secretId, value, state: this.state });
  }

  /**
   * Get version of secret
   * @param {string} secretId secret id/name
   * @param {string} version secret version
   * @returns {Promise<unknown>} a promise that resolves to a version object
   */
  async getVersionOfSecret(secretId: string, version: string) {
    return getVersionOfSecret({ secretId, version, state: this.state });
  }

  /**
   * Update the status of a version of a secret
   * @param {string} secretId secret id/name
   * @param {string} version secret version
   * @param {VersionOfSecretStatus} status status
   * @returns {Promise<unknown>} a promise that resolves to a status object
   */
  async setStatusOfVersionOfSecret(
    secretId: string,
    version: string,
    status: VersionOfSecretStatus
  ) {
    return setStatusOfVersionOfSecret({
      secretId,
      version,
      status,
      state: this.state,
    });
  }

  /**
   * Delete version of secret
   * @param {string} secretId secret id/name
   * @param {string} version secret version
   * @returns {Promise<unknown>} a promise that resolves to a version object
   */
  async deleteVersionOfSecret(secretId: string, version: string) {
    return deleteVersionOfSecret({ secretId, version, state: this.state });
  }
}

export {
  createNewVersionOfSecret,
  deleteSecret,
  deleteVersionOfSecret,
  getSecret,
  getSecrets,
  getSecretVersions,
  putSecret,
  setSecretDescription,
  setStatusOfVersionOfSecret,
};
