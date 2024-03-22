import {
  createNewVersionOfSecret as _createNewVersionOfSecret,
  deleteSecret as _deleteSecret,
  deleteVersionOfSecret as _deleteVersionOfSecret,
  getSecret as _getSecret,
  getSecrets as _getSecrets,
  getSecretVersions as _getSecretVersions,
  getVersionOfSecret as _getVersionOfSecret,
  putSecret as _putSecret,
  SecretSkeleton,
  setSecretDescription as _setSecretDescription,
  setStatusOfVersionOfSecret as _setStatusOfVersionOfSecret,
  VersionOfSecretSkeleton,
  VersionOfSecretStatus,
} from '../../api/cloud/SecretsApi';
import { FrodoError } from '../FrodoError';
import { State } from '../../shared/State';
import { decode, encode, isBase64Encoded } from '../../utils/Base64Utils';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../../utils/Console';
import { getMetadata } from '../../utils/ExportImportUtils';
import { ExportMetaData } from '../OpsTypes';

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
   * Export secret. The response can be saved to file as is.
   * @param secretId secret id/name
   * @returns {Promise<SecretsExportInterface>} Promise resolving to a SecretsExportInterface object.
   */
  exportSecret(secretId): Promise<SecretsExportInterface>;
  /**
   * Export all secrets
   * @returns {Promise<SecretsExportInterface>} Promise resolving to an SecretsExportInterface object.
   */
  exportSecrets(): Promise<SecretsExportInterface>;
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
      return readSecret({ secretId, state });
    },
    async exportSecret(secretId: string): Promise<SecretsExportInterface> {
      return exportSecret({ secretId, state });
    },
    async exportSecrets(): Promise<SecretsExportInterface> {
      return exportSecrets({ state });
    },
    async createSecret(
      secretId: string,
      value: string,
      description: string,
      encoding = 'generic',
      useInPlaceholders = true
    ) {
      return createSecret({
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
      return createVersionOfSecret({ secretId, value, state });
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

    // Deprecated

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
        value: getEncodedValue(value, encoding, state),
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

export interface SecretsExportInterface {
  meta?: ExportMetaData;
  secrets: Record<string, SecretSkeleton>;
}

function getEncodedValue(
  value: string,
  encoding: string,
  state: State
): string {
  let finalValue: string = '';
  debugMessage({ message: `SecretsOps.getEncodedValue: start`, state });
  if (encoding === 'pem') {
    if (isBase64Encoded(value)) {
      finalValue = value; // this means the PEM is already b64 encoded
    } else {
      finalValue = encode(value); // the PEM is unencoded, we need to encode
    }
  } else if (encoding === 'base64hmac') {
    if (isBase64Encoded(decode(value))) {
      finalValue = value; // the value is already doubly b64 encoded key
    } else {
      finalValue = encode(value); // value is b64 encoded key, need to encode before creating secret
    }
  } else {
    finalValue = encode(value);
  }
  debugMessage({
    message: `SecretsOps.getEncodedValue: finalValue: ${finalValue}`,
    state,
  });
  return finalValue;
}

export function createSecretsExportTemplate({
  state,
}: {
  state: State;
}): SecretsExportInterface {
  return {
    meta: getMetadata({ state }),
    secrets: {},
  } as SecretsExportInterface;
}

export async function exportSecret({
  secretId,
  state,
}: {
  secretId: string;
  state: State;
}): Promise<SecretsExportInterface> {
  try {
    debugMessage({ message: `SecretsOps.exportSecret: start`, state });
    const exportData = createSecretsExportTemplate({ state });
    const secret = await _getSecret({ secretId, state });
    exportData.secrets[secret._id] = secret;
    debugMessage({ message: `VariablesOps.exportSecret: end`, state });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting secret ${secretId}`, error);
  }
}

export async function exportSecrets({
  state,
}: {
  state: State;
}): Promise<SecretsExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({ message: `SecretsOps.exportSecrets: start`, state });
    const exportData = createSecretsExportTemplate({ state });
    const secrets = await readSecrets({ state });
    indicatorId = createProgressIndicator({
      total: secrets.length,
      message: 'Exporting secrets...',
      state,
    });
    for (const secret of secrets) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting secret ${secret._id}`,
        state,
      });
      exportData.secrets[secret._id] = secret;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${secrets.length} secrets.`,
      state,
    });
    debugMessage({ message: `SecretsOps.exportSecrets: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting secrets`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error exporting secrets`, error);
  }
}

export async function enableVersionOfSecret({
  secretId,
  version,
  state,
}: {
  secretId: string;
  version: string;
  state: State;
}) {
  try {
    return _setStatusOfVersionOfSecret({
      secretId,
      version,
      status: 'ENABLED',
      state,
    });
  } catch (error) {
    throw new FrodoError(
      `Error enabling version ${version} of secret ${secretId}`,
      error
    );
  }
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
  try {
    return _setStatusOfVersionOfSecret({
      secretId,
      version,
      status: 'DISABLED',
      state,
    });
  } catch (error) {
    throw new FrodoError(
      `Error disabling version ${version} of secret ${secretId}`,
      error
    );
  }
}

export async function readSecret({
  secretId,
  state,
}: {
  secretId: string;
  state: State;
}): Promise<SecretSkeleton> {
  try {
    return await _getSecret({ secretId, state });
  } catch (error) {
    throw new FrodoError(`Error reading secret ${secretId}`, error);
  }
}

export async function readSecrets({
  state,
}: {
  state: State;
}): Promise<SecretSkeleton[]> {
  try {
    const { result } = await _getSecrets({ state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading secrets`, error);
  }
}

export async function createSecret({
  secretId,
  value,
  description,
  encoding = 'generic',
  useInPlaceholders = true,
  state,
}: {
  secretId: string;
  value: string;
  description: string;
  encoding: string;
  useInPlaceholders: boolean;
  state: State;
}) {
  try {
    return _putSecret({
      secretId,
      value: getEncodedValue(value, encoding, state),
      description,
      encoding,
      useInPlaceholders,
      state,
    });
  } catch (error) {
    throw new FrodoError(`Error creating secret ${secretId}`, error);
  }
}

export async function createVersionOfSecret({
  secretId,
  value,
  state,
}: {
  secretId: string;
  value: string;
  state: State;
}) {
  try {
    // first get the secret encoding
    let secret: SecretSkeleton = null;
    secret = await readSecret({ secretId, state });
    // now create the new version (using encoding to calculate the correctly encoded value)
    return _createNewVersionOfSecret({
      secretId,
      value: getEncodedValue(value, secret.encoding, state),
      state,
    });
  } catch (error) {
    throw new FrodoError(
      `Error creating new version of secret ${secretId}`,
      error
    );
  }
}

export async function deleteSecret({
  secretId,
  state,
}: {
  secretId: string;
  state: State;
}) {
  try {
    return _deleteSecret({ secretId, state });
  } catch (error) {
    throw new FrodoError(`Error deleting secret ${secretId}`, error);
  }
}

export async function readVersionOfSecret({
  secretId,
  version,
  state,
}: {
  secretId: string;
  version: string;
  state: State;
}) {
  try {
    return _getVersionOfSecret({ secretId, version, state });
  } catch (error) {
    throw new FrodoError(
      `Error deleting version ${version} of secret ${secretId}`,
      error
    );
  }
}

export async function readVersionsOfSecret({
  secretId,
  state,
}: {
  secretId: string;
  state: State;
}) {
  try {
    return _getSecretVersions({ secretId, state });
  } catch (error) {
    throw new FrodoError(`Error reading secret ${secretId}`, error);
  }
}

export async function updateSecretDescription({
  secretId,
  description,
  state,
}: {
  secretId: string;
  description: string;
  state: State;
}) {
  try {
    return _setSecretDescription({
      secretId,
      description,
      state,
    });
  } catch (error) {
    throw new FrodoError(
      `Error updating description of secret ${secretId}`,
      error
    );
  }
}
