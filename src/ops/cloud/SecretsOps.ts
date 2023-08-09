import {
  createNewVersionOfSecret as _createNewVersionOfSecret,
  deleteSecret as _deleteSecret,
  deleteVersionOfSecret as _deleteVersionOfSecret,
  getSecret as _getSecret,
  getSecrets as _getSecrets,
  getSecretVersions as _getSecretVersions,
  getVersionOfSecret as _getVersionOfSecret,
  putSecret as _putSecret,
  setSecretDescription as _setSecretDescription,
  setStatusOfVersionOfSecret as _setStatusOfVersionOfSecret,
  SecretSkeleton,
  VersionOfSecretSkeleton,
  VersionOfSecretStatus,
} from '../../api/cloud/SecretsApi';
import { State } from '../../shared/State';

export type Secret = {
  /**
   * Read all secrets
   * @returns {Promise<SecretSkeleton[]>} a promise that resolves to an array of secrets
   */
  readSecrets(): Promise<SecretSkeleton[]>;
  /**
   * Read secret
   * @param secretId secret id/name
   * @returns {Promise<SecretSkeleton>} a promise that resolves to a secret
   */
  readSecret(secretId: string): Promise<SecretSkeleton>;
  /**
   * Create secret
   * @param {string} secretId secret id/name
   * @param {string} value secret value
   * @param {string} description secret description
   * @param {string} encoding secret encoding (only `generic` is supported)
   * @param {boolean} useInPlaceholders flag indicating if the secret can be used in placeholders
   * @returns {Promise<SecretSkeleton>} a promise that resolves to a secret
   */
  createSecret(
    secretId: string,
    value: string,
    description: string,
    encoding?: string,
    useInPlaceholders?: boolean
  ): Promise<SecretSkeleton>;
  /**
   * Update secret description
   * @param {string} secretId secret id/name
   * @param {string} description secret description
   * @returns {Promise<any>} a promise that resolves to an empty string
   */
  updateSecretDescription(secretId: string, description: string): Promise<any>;
  /**
   * Delete secret
   * @param {string} secretId secret id/name
   * @returns {Promise<SecretSkeleton>} a promise that resolves to a secret object
   */
  deleteSecret(secretId: string): Promise<SecretSkeleton>;
  /**
   * Read versions of secret
   * @param {string} secretId secret id/name
   * @returns {Promise<VersionOfSecretSkeleton[]>} a promise that resolves to an array of secret versions
   */
  readVersionsOfSecret(secretId: string): Promise<VersionOfSecretSkeleton[]>;
  /**
   * Create version of secret
   * @param {string} secretId secret id/name
   * @param {string} value secret value
   * @returns {Promise<VersionOfSecretSkeleton>} a promise that resolves to a version object
   */
  createVersionOfSecret(
    secretId: string,
    value: string
  ): Promise<VersionOfSecretSkeleton>;
  /**
   * Read version of secret
   * @param {string} secretId secret id/name
   * @param {string} version secret version
   * @returns {Promise<VersionOfSecretSkeleton>} a promise that resolves to a version object
   */
  readVersionOfSecret(
    secretId: string,
    version: string
  ): Promise<VersionOfSecretSkeleton>;
  /**
   * Enable a version of a secret
   * @param {string} secretId secret id/name
   * @param {string} version secret version
   * @returns {Promise<VersionOfSecretSkeleton>} a promise that resolves to a status object
   */
  enableVersionOfSecret(
    secretId: string,
    version: string
  ): Promise<VersionOfSecretSkeleton>;
  /**
   * Disable a version of a secret
   * @param {string} secretId secret id/name
   * @param {string} version secret version
   * @returns {Promise<VersionOfSecretSkeleton>} a promise that resolves to a status object
   */
  disableVersionOfSecret(
    secretId: string,
    version: string
  ): Promise<VersionOfSecretSkeleton>;
  /**
   * Delete version of secret
   * @param {string} secretId secret id/name
   * @param {string} version secret version
   * @returns {Promise<VersionOfSecretSkeleton>} a promise that resolves to a version object
   */
  deleteVersionOfSecret(
    secretId: string,
    version: string
  ): Promise<VersionOfSecretSkeleton>;

  // Deprecated

  /**
   * Get all secrets
   * @returns {Promise<any[]>} a promise that resolves to an array of secrets
   * @deprecated since v2.0.0 use {@link Secret.readSecrets | readSecrets} instead
   * ```javascript
   * readSecrets(): Promise<SecretSkeleton[]>
   * ```
   * @group Deprecated
   */
  getSecrets(): Promise<SecretSkeleton[]>;
  /**
   * Get secret
   * @param secretId secret id/name
   * @returns {Promise<SecretSkeleton>} a promise that resolves to a secret
   * @deprecated since v2.0.0 use {@link Secret.readSecret | readSecret} instead
   * ```javascript
   * readSecret(secretId: string): Promise<any>
   * ```
   * @group Deprecated
   */
  getSecret(secretId: string): Promise<SecretSkeleton>;
  /**
   * Create secret
   * @param {string} secretId secret id/name
   * @param {string} value secret value
   * @param {string} description secret description
   * @param {string} encoding secret encoding (only `generic` is supported)
   * @param {boolean} useInPlaceholders flag indicating if the secret can be used in placeholders
   * @returns {Promise<SecretSkeleton>} a promise that resolves to a secret
   * @deprecated since v2.0.0 use {@link Secret.createSecret | createSecret} instead
   * ```javascript
   * createSecret(secretId: string, value: string, description: string, encoding?: string, useInPlaceholders?: boolean): Promise<any>
   * ```
   * @group Deprecated
   */
  putSecret(
    secretId: string,
    value: string,
    description: string,
    encoding?: string,
    useInPlaceholders?: boolean
  ): Promise<SecretSkeleton>;
  /**
   * Set secret description
   * @param {string} secretId secret id/name
   * @param {string} description secret description
   * @returns {Promise<any>} a promise that resolves to an empty string
   * @deprecated since v2.0.0 use {@link Secret.updateSecretDescription | updateSecretDescription} instead
   * ```javascript
   * updateSecretDescription(secretId: string, description: string): Promise<any>
   * ```
   * @group Deprecated
   */
  setSecretDescription(secretId: string, description: string): Promise<any>;
  /**
   * Get secret versions
   * @param {string} secretId secret id/name
   * @returns {Promise<VersionOfSecretSkeleton[]>} a promise that resolves to an array of secret versions
   * @deprecated since v2.0.0 use {@link Secret.readVersionsOfSecret | readVersionsOfSecret} instead
   * ```javascript
   * readVersionsOfSecret(secretId: string): Promise<any>
   * ```
   * @group Deprecated
   */
  getSecretVersions(secretId: string): Promise<VersionOfSecretSkeleton[]>;
  /**
   * Create new secret version
   * @param {string} secretId secret id/name
   * @param {string} value secret value
   * @returns {Promise<VersionOfSecretSkeleton>} a promise that resolves to a version object
   * @deprecated since v2.0.0 use {@link Secret.createVersionOfSecret | createVersionOfSecret} instead
   * ```javascript
   * createVersionOfSecret(secretId: string, value: string): Promise<any>
   * ```
   * @group Deprecated
   */
  createNewVersionOfSecret(
    secretId: string,
    value: string
  ): Promise<VersionOfSecretSkeleton>;
  /**
   * Get version of secret
   * @param {string} secretId secret id/name
   * @param {string} version secret version
   * @returns {Promise<VersionOfSecretSkeleton>} a promise that resolves to a version object
   * @deprecated since v2.0.0 use {@link Secret.readVersionOfSecret | readVersionOfSecret} instead
   * ```javascript
   * readVersionOfSecret(secretId: string, version: string): Promise<any>
   * ```
   * @group Deprecated
   */
  getVersionOfSecret(
    secretId: string,
    version: string
  ): Promise<VersionOfSecretSkeleton>;
  /**
   * Update the status of a version of a secret
   * @param {string} secretId secret id/name
   * @param {string} version secret version
   * @param {VersionOfSecretStatus} status status
   * @returns {Promise<VersionOfSecretSkeleton>} a promise that resolves to a status object
   * @deprecated since v2.0.0 use {@link Secret.enableVersionOfSecret | enableVersionOfSecret} or {@link Secret.disableVersionOfSecret | disableVersionOfSecret} instead
   * ```javascript
   * enableVersionOfSecret(secretId: string, version: string): Promise<any>
   * disableVersionOfSecret(secretId: string, version: string): Promise<any>
   * ```
   * @group Deprecated
   */
  setStatusOfVersionOfSecret(
    secretId: string,
    version: string,
    status: VersionOfSecretStatus
  ): Promise<VersionOfSecretSkeleton>;
};

export default (state: State): Secret => {
  return {
    async readSecrets() {
      return readSecrets({ state });
    },
    async readSecret(secretId: string) {
      return _getSecret({ secretId, state });
    },
    async createSecret(
      secretId: string,
      value: string,
      description: string,
      encoding = 'generic',
      useInPlaceholders = true
    ) {
      return _putSecret({
        secretId,
        value,
        description,
        encoding,
        useInPlaceholders,
        state,
      });
    },
    async updateSecretDescription(secretId: string, description: string) {
      return _setSecretDescription({ secretId, description, state });
    },
    async deleteSecret(secretId: string) {
      return _deleteSecret({ secretId, state });
    },
    async readVersionsOfSecret(secretId: string) {
      return _getSecretVersions({ secretId, state });
    },
    async createVersionOfSecret(secretId: string, value: string) {
      return _createNewVersionOfSecret({ secretId, value, state });
    },
    async readVersionOfSecret(secretId: string, version: string) {
      return _getVersionOfSecret({ secretId, version, state });
    },
    async enableVersionOfSecret(secretId: string, version: string) {
      return enableVersionOfSecret({
        secretId,
        version,
        state,
      });
    },
    async disableVersionOfSecret(secretId: string, version: string) {
      return disableVersionOfSecret({
        secretId,
        version,
        state,
      });
    },
    async deleteVersionOfSecret(secretId: string, version: string) {
      return _deleteVersionOfSecret({ secretId, version, state });
    },

    // Deprecatd

    async getSecrets() {
      return readSecrets({ state });
    },
    async getSecret(secretId: string) {
      return _getSecret({ secretId, state });
    },
    async putSecret(
      secretId: string,
      value: string,
      description: string,
      encoding = 'generic',
      useInPlaceholders = true
    ) {
      return _putSecret({
        secretId,
        value,
        description,
        encoding,
        useInPlaceholders,
        state,
      });
    },
    async setSecretDescription(secretId: string, description: string) {
      return _setSecretDescription({ secretId, description, state });
    },
    async getSecretVersions(secretId: string) {
      return _getSecretVersions({ secretId, state });
    },
    async createNewVersionOfSecret(secretId: string, value: string) {
      return _createNewVersionOfSecret({ secretId, value, state });
    },
    async getVersionOfSecret(secretId: string, version: string) {
      return _getVersionOfSecret({ secretId, version, state });
    },
    async setStatusOfVersionOfSecret(
      secretId: string,
      version: string,
      status: VersionOfSecretStatus
    ) {
      return _setStatusOfVersionOfSecret({
        secretId,
        version,
        status,
        state,
      });
    },
  };
};

export async function enableVersionOfSecret({
  secretId,
  version,
  state,
}: {
  secretId: string;
  version: string;
  state: State;
}) {
  return _setStatusOfVersionOfSecret({
    secretId,
    version,
    status: 'ENABLED',
    state,
  });
}

export async function disableVersionOfSecret({
  secretId,
  version,
  state,
}: {
  secretId: string;
  version: string;
  state: State;
}) {
  return _setStatusOfVersionOfSecret({
    secretId,
    version,
    status: 'DISABLED',
    state,
  });
}

export async function readSecrets({
  state,
}: {
  state: State;
}): Promise<SecretSkeleton[]> {
  const { result } = await _getSecrets({ state });
  return result;
}

export {
  _getSecret as readSecret,
  _putSecret as createSecret,
  _setSecretDescription as updateSecretDescription,
  _deleteSecret as deleteSecret,
  _getSecretVersions as readVersionsOfSecret,
  _createNewVersionOfSecret as createVersionOfSecret,
  _getVersionOfSecret as readVersionOfSecret,
  _deleteVersionOfSecret as deleteVersionOfSecret,
};
