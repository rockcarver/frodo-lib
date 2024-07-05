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
import FrodoLib from '../../lib/FrodoLib';
import { State } from '../../shared/State';
import { decode, encode, isBase64Encoded } from '../../utils/Base64Utils';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../../utils/Console';
import { getMetadata } from '../../utils/ExportImportUtils';
import { FrodoError } from '../FrodoError';
import { decrypt, decryptMap, isEncrypted } from '../IdmCryptoOps';
import { evaluateScript } from '../IdmScriptOps';
import { ExportMetaData } from '../OpsTypes';

export type Secret = {
  /**
   * Read all secrets
   * @returns {Promise<SecretSkeleton[]>} a promise that resolves to an array of secrets
   */
  readSecrets(): Promise<SecretSkeleton[]>;
  /**
   * Read secret
   * @param {string} secretId secret id/name
   * @returns {Promise<SecretSkeleton>} a promise that resolves to a secret
   */
  readSecret(secretId: string): Promise<SecretSkeleton>;
  /**
   * Read the value of a secret
   * @param {string} secretId secret id/name
   * @param {string} target Host URL of target environment to encrypt secret value for
   * @param {boolean} decrypt retrieve secret value in the clear (default: false)
   * @returns {Promise<string>} a promise that resolves to the value of the secret
   */
  readSecretValue(
    secretId: string,
    target?: string,
    decrypt?: boolean
  ): Promise<any>;
  /**
   * Read the values of an array of secrets
   * @param {string} secretIds secret id/name
   * @param {string} target Host URL of target environment to encrypt secret values for
   * @param {boolean} decrypt retrieve secret values in the clear (default: false)
   * @returns {Promise<{ [key: string]: string }>} a promise that resolves to a map of secret ids and values
   */
  readSecretValues(
    secretIds: string[],
    target?: string,
    decrypt?: boolean
  ): Promise<{ [key: string]: string }>;
  /**
   * Export secret. The response can be saved to file as is.
   * @param {string} secretId secret id/name
   * @param {boolean} includeActiveValue include active value of secret (default: false)
   * @param {string} target Host URL of target environment to encrypt secret value for
   * @returns {Promise<SecretsExportInterface>} Promise resolving to a SecretsExportInterface object.
   */
  exportSecret(
    secretId: string,
    includeActiveValue?: boolean,
    target?: string
  ): Promise<SecretsExportInterface>;
  /**
   * Export all secrets
   * @param {boolean} includeActiveValues include active values of secrets (default: false)
   * @param {string} target Host URL of target environment to encrypt secret values for
   * @returns {Promise<SecretsExportInterface>} Promise resolving to an SecretsExportInterface object.
   */
  exportSecrets(
    includeActiveValues?: boolean,
    target?: string
  ): Promise<SecretsExportInterface>;
  /**
   * Import secret by id
   * @param {string} secretId secret id/name
   * @param {SecretsExportInterface} importData import data
   * @param {boolean} includeActiveValue include active value of secret (default: false)
   * @param {string} source Host URL of source environment where the secret was exported from
   * @returns {Promise<SecretSkeleton>} imported secret object
   */
  importSecret(
    secretId: string,
    importData: SecretsExportInterface,
    includeActiveValue?: boolean,
    source?: string
  ): Promise<SecretSkeleton>;
  /**
   * Import secrets
   * @param {SecretsExportInterface} importData import data
   * @param {boolean} includeActiveValues include active values of secrets (default: false)
   * @param {string} source Host URL of source environment where the secrets were exported from
   * @returns {Promise<SecretSkeleton[]>} array of imported secret objects
   */
  importSecrets(
    importData: SecretsExportInterface,
    includeActiveValues?: boolean,
    source?: string
  ): Promise<SecretSkeleton[]>;
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
    async readSecretValue(
      secretId: string,
      target: string = null,
      decrypt: boolean = false
    ): Promise<any> {
      return readSecretValue({ secretId, target, decrypt, state });
    },
    async readSecretValues(
      secretIds: string[],
      target: string = null,
      decrypt: boolean = false
    ): Promise<{ [key: string]: string }> {
      return readSecretValues({ secretIds, target, decrypt, state });
    },
    async exportSecret(
      secretId: string,
      includeActiveValue: boolean = false,
      target: string = null
    ): Promise<SecretsExportInterface> {
      return exportSecret({
        secretId,
        options: { includeActiveValues: includeActiveValue, target },
        state,
      });
    },
    async exportSecrets(
      includeActiveValues: boolean = false,
      target: string = null
    ): Promise<SecretsExportInterface> {
      return exportSecrets({ options: { includeActiveValues, target }, state });
    },
    async importSecret(
      secretId: string,
      importData: SecretsExportInterface,
      includeActiveValue: boolean = false,
      source: string = null
    ): Promise<SecretSkeleton> {
      return importSecret({
        secretId,
        importData,
        options: { includeActiveValues: includeActiveValue, source },
        state,
      });
    },
    async importSecrets(
      importData: SecretsExportInterface,
      includeActiveValues: boolean = false,
      source: string = null
    ): Promise<SecretSkeleton[]> {
      return importSecrets({
        importData,
        options: { includeActiveValues, source },
        state,
      });
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

/**
 * Secrets import options
 */
export interface SecretImportOptions {
  /**
   * Import active values of secret
   */
  includeActiveValues: boolean;
  /**
   * Host URL of source environment to decrypt secret values from
   */
  source?: string;
}

/**
 * Secrets export options
 */
export interface SecretExportOptions {
  /**
   * Export active values of secret
   */
  includeActiveValues: boolean;
  /**
   * Host URL of target environment to encrypt secret values for
   */
  target?: string;
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
  } else if (encoding === 'base64aes') {
    if (isBase64Encoded(decode(value))) {
      finalValue = value; // the value is already doubly b64 encoded key
    } else {
      finalValue = encode(value); // value is b64 encoded key, need to encode before creating secret
    }
  } else {
    finalValue = encode(value);
  }
  debugMessage({ message: `SecretsOps.getEncodedValue: end`, state });
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
  options = { includeActiveValues: false, target: null },
  state,
}: {
  secretId: string;
  options?: SecretExportOptions;
  state: State;
}): Promise<SecretsExportInterface> {
  try {
    debugMessage({ message: `SecretsOps.exportSecret: start`, state });
    const { includeActiveValues, target } = options;
    const exportData = createSecretsExportTemplate({ state });
    const secret = await readSecret({ secretId, state });
    if (includeActiveValues) {
      secret.activeValue = await readSecretValue({
        secretId: secret._id,
        target,
        state,
      });
    }
    exportData.secrets[secret._id] = secret;
    debugMessage({ message: `SecretsOps.exportSecret: end`, state });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting secret ${secretId}`, error);
  }
}

export async function exportSecrets({
  options = { includeActiveValues: false, target: null },
  state,
}: {
  options?: SecretExportOptions;
  state: State;
}): Promise<SecretsExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({ message: `SecretsOps.exportSecrets: start`, state });
    const { includeActiveValues, target } = options;
    const exportData = createSecretsExportTemplate({ state });
    const secrets = await readSecrets({ state });
    indicatorId = createProgressIndicator({
      total: secrets.length,
      message: 'Exporting secrets...',
      state,
    });
    if (includeActiveValues) {
      const mapOfSecrets = await readSecretValues({
        secretIds: secrets.map((s) => s._id),
        target,
        state,
      });
      for (const secret of secrets) {
        updateProgressIndicator({
          id: indicatorId,
          message: `Exporting secret ${secret._id}`,
          state,
        });
        secret.activeValue = mapOfSecrets[secret._id];
        exportData.secrets[secret._id] = secret;
      }
    } else {
      for (const secret of secrets) {
        updateProgressIndicator({
          id: indicatorId,
          message: `Exporting secret ${secret._id}`,
          state,
        });
        exportData.secrets[secret._id] = secret;
      }
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

async function decryptExternalValue({
  source,
  value,
  state,
}: {
  source: string;
  value: any;
  state: State;
}): Promise<any> {
  debugMessage({
    message: `SecretsOps.decryptExternalValue: start [source=${source}]`,
    state,
  });
  const external = FrodoLib({ host: source });
  external.state.setDebug(state.getDebug());
  external.state.setVerbose(state.getVerbose());
  external.state.setCurlirize(state.getCurlirize());
  external.state.setAllowInsecureConnection(state.getAllowInsecureConnection());
  external.state.setUseTokenCache(false);
  try {
    await external.login.getTokens(false, false);
    const decryptedValue = await external.idm.crypto.decrypt(value);
    debugMessage({ message: `SecretsOps.decryptExternalValue: end`, state });
    return decryptedValue;
  } catch (error) {
    throw new FrodoError(
      `Error connecting to source encryption environment ${external.state.getHost()}`,
      error
    );
  }
}

async function decryptExternalMap({
  source,
  map,
  state,
}: {
  source: string;
  map: { [key: string]: any };
  state: State;
}): Promise<any> {
  debugMessage({
    message: `SecretsOps.decryptExternalMap: start [source=${source}]`,
    state,
  });
  const external = FrodoLib({ host: source, debug: true });
  external.state.setDebug(state.getDebug());
  external.state.setVerbose(state.getVerbose());
  external.state.setCurlirize(state.getCurlirize());
  external.state.setAllowInsecureConnection(state.getAllowInsecureConnection());
  external.state.setUseTokenCache(false);
  await external.login.getTokens(false, false);
  const decryptedMap = await external.idm.crypto.decryptMap(map);
  debugMessage({ message: `SecretsOps.decryptExternalMap: end`, state });
  return decryptedMap;
}

async function encryptExternalValue({
  target,
  value,
  state,
}: {
  target: string;
  value: any;
  state: State;
}): Promise<any> {
  debugMessage({
    message: `SecretsOps.encryptExternalValue: start [target=${target}]`,
    state,
  });
  const external = FrodoLib({ host: target, debug: true });
  external.state.setDebug(state.getDebug());
  external.state.setVerbose(state.getVerbose());
  external.state.setCurlirize(state.getCurlirize());
  external.state.setAllowInsecureConnection(state.getAllowInsecureConnection());
  external.state.setUseTokenCache(false);
  try {
    await external.login.getTokens(false, false);
    const encryptedValue = await external.idm.crypto.encrypt(value);
    debugMessage({ message: `SecretsOps.encryptExternalValue: end`, state });
    return encryptedValue;
  } catch (error) {
    throw new FrodoError(
      `Error connecting to target encryption environment ${external.state.getHost()}`,
      error
    );
  }
}

async function encryptExternalMap({
  target,
  map,
  state,
}: {
  target: string;
  map: { [key: string]: any };
  state: State;
}): Promise<{ [key: string]: any }> {
  debugMessage({
    message: `SecretsOps.encryptExternalMap: start [target=${target}]`,
    state,
  });
  const external = FrodoLib({ host: target, debug: true });
  external.state.setDebug(state.getDebug());
  external.state.setVerbose(state.getVerbose());
  external.state.setCurlirize(state.getCurlirize());
  external.state.setAllowInsecureConnection(state.getAllowInsecureConnection());
  external.state.setUseTokenCache(false);
  await external.login.getTokens(false, false);
  const encryptedMap = await external.idm.crypto.encryptMap(map);
  debugMessage({ message: `SecretsOps.encryptExternalMap: end`, state });
  return encryptedMap;
}

export async function readSecretValue({
  secretId,
  decrypt = false,
  target = null,
  state,
}: {
  secretId: string;
  decrypt?: boolean;
  target?: string;
  state: State;
}): Promise<any> {
  debugMessage({ message: `SecretsOps.readSecretValue: start`, state });
  const name = secretId.replaceAll('-', '.');
  let script = 'var value = identityServer.getProperty(name);\n';
  script += 'if (!decrypt && !target) {\n';
  script +=
    '  value = openidm.encrypt(value, null, "idm.password.encryption");\n';
  script += '}\n';
  script += 'value\n';
  const globals = {
    name,
    decrypt,
    target,
  };
  let secretValue = await evaluateScript({
    script,
    globals,
    state,
  });
  if (target) {
    secretValue = await encryptExternalValue({
      target,
      value: secretValue,
      state,
    });
  }
  debugMessage({ message: `SecretsOps.readSecretValue: end`, state });
  return secretValue;
}

export async function readSecretValues({
  secretIds,
  decrypt = false,
  target = null,
  state,
}: {
  secretIds: string[];
  decrypt?: boolean;
  target?: string;
  state: State;
}): Promise<{ [key: string]: string }> {
  debugMessage({
    message: `SecretsOps.readSecretValues: start [decrypt=${decrypt}, target='${target}']`,
    state,
  });
  let script = 'var secrets = {}\n';
  script += 'for (var i = 0; i < secretIds.length; i++) {\n';
  script +=
    '  var secretValue = identityServer.getProperty(secretIds[i].split("-").join("."));\n';
  script += '  if (secretValue) {\n';
  script += '    if (decrypt || target) {\n';
  script += '      secrets[secretIds[i]] = secretValue;\n';
  script += '    } else {\n';
  script +=
    '      secrets[secretIds[i]] = openidm.encrypt(secretValue, null, "idm.password.encryption");\n';
  script += '    }\n';
  script += '  }\n';
  script += '}\n';
  script += 'JSON.stringify(secrets);';
  const globals = {
    secretIds,
    decrypt,
    target,
  };
  const scriptResponse = await evaluateScript({
    script,
    globals,
    state,
  });
  let secretValues = JSON.parse(scriptResponse);
  if (target) {
    secretValues = await encryptExternalMap({
      target,
      map: secretValues,
      state,
    });
  }
  debugMessage({ message: `SecretsOps.readSecretValues: end`, state });
  return secretValues;
}

async function resolveSecretValue({
  secretData,
  includeActiveValues = false,
  source,
  state,
}: {
  secretData: SecretSkeleton;
  includeActiveValues: boolean;
  source: string;
  state: State;
}): Promise<any> {
  debugMessage({
    message: `SecretsOps.resolveSecretValue: start [values=${includeActiveValues}, source=${source}]`,
    state,
  });
  let secretValue = 'placeholder secret value';
  try {
    if (includeActiveValues) {
      const secretEnvName = '' + secretData._id.replaceAll('-', '_');
      if (process.env[secretEnvName]) {
        secretValue = process.env[secretEnvName];
      } else if (isEncrypted(secretData.activeValue)) {
        if (source) {
          secretValue = await decryptExternalValue({
            source,
            value: secretData.activeValue,
            state,
          });
        } else {
          secretValue = await decrypt({ value: secretData.activeValue, state });
        }
      } else {
        secretValue = secretData.activeValue;
      }
    }
  } catch (error) {
    throw new FrodoError(
      `Unable to resolve value for secret ${secretData._id}`,
      error
    );
  }
  debugMessage({ message: `SecretsOps.resolveSecretValue: end`, state });
  return secretValue;
}

async function resolveSecretValues({
  secrets,
  includeActiveValues = false,
  source,
  state,
}: {
  secrets: SecretSkeleton[];
  includeActiveValues: boolean;
  source: string;
  state: State;
}): Promise<{ [key: string]: any }> {
  debugMessage({ message: `SecretsOps.resolveSecretValues: start`, state });
  // final result map containing all resolved values
  const resolvedSecretValues: { [key: string]: any } = {};
  try {
    // working map of encrypted values that need decryption
    const mapOfEncryptedValues: { [key: string]: any } = {};
    // working map of decrypted values
    let mapOfDecryptedValues: { [key: string]: any } = {};
    if (includeActiveValues) {
      for (const secret of secrets) {
        let secretValue = 'placeholder secret value';
        const secretEnvName = '' + secret._id.replaceAll('-', '_');
        if (process.env[secretEnvName]) {
          secretValue = process.env[secretEnvName];
        } else {
          secretValue = secret.activeValue;
        }
        if (isEncrypted(secretValue)) {
          mapOfEncryptedValues[secret._id] = secretValue;
        }
        resolvedSecretValues[secret._id] = secretValue;
      }
    }
    // only decrypt if there is at least one encrypted value
    if (Object.keys(mapOfEncryptedValues).length > 0) {
      if (source) {
        mapOfDecryptedValues = await decryptExternalMap({
          source,
          map: mapOfEncryptedValues,
          state,
        });
      } else {
        mapOfDecryptedValues = await decryptMap({
          map: mapOfEncryptedValues,
          state,
        });
      }
    }
    // update the resolved values with the decrypted values
    for (const decryptedId of Object.keys(mapOfDecryptedValues)) {
      resolvedSecretValues[decryptedId] = mapOfDecryptedValues[decryptedId];
    }
  } catch (error) {
    throw new FrodoError(
      `Unable to resolve values for secrets ${secrets.map((s) => s._id).join(', ')}`,
      error
    );
  }
  debugMessage({ message: `SecretsOps.resolveSecretValues: end`, state });
  return resolvedSecretValues;
}

/**
 * Import secret
 * @param {string} secretId secret id/name
 * @param {SecretsExportInterface} importData import data
 * @returns {Promise<SecretSkeleton[]>} array of imported secret objects
 */
export async function importSecret({
  secretId,
  importData,
  options = { includeActiveValues: true, source: '' },
  state,
}: {
  secretId: string;
  importData: SecretsExportInterface;
  options?: SecretImportOptions;
  state: State;
}): Promise<SecretSkeleton> {
  debugMessage({ message: `SecretsOps.importSecret: start`, state });
  let response = null;
  const { includeActiveValues, source } = options;
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.secrets)) {
    if (id === secretId || !secretId) {
      try {
        const secretData = importData.secrets[id];
        delete secretData._rev;
        try {
          response = await createSecret({
            secretId: secretData._id,
            value: await resolveSecretValue({
              secretData,
              includeActiveValues,
              source,
              state,
            }),
            description: secretData.description,
            encoding: secretData.encoding,
            useInPlaceholders: secretData.useInPlaceholders,
            state,
          });
          imported.push(id);
        } catch (error) {
          if (
            (error as FrodoError).httpStatus === 400 &&
            (error as FrodoError).httpMessage ===
              'Failed to create secret, the secret already exists'
          ) {
            // secret already exists so just trying to update the description
            await updateSecretDescription({
              secretId: secretData._id,
              description: secretData.description,
              state,
            });
            // only create a new secret version if requested
            if (includeActiveValues) {
              await createVersionOfSecret({
                secretId: secretData._id,
                value: await resolveSecretValue({
                  secretData,
                  includeActiveValues,
                  source,
                  state,
                }),
                state,
              });
            }
            // read the final secret definition to return as the response
            response = await readSecret({ secretId: secretData._id, state });
            imported.push(id);
          } else {
            throw error;
          }
        }
      } catch (error) {
        errors.push(error);
      }
      break;
    }
  }
  if (errors.length > 0) {
    throw new FrodoError(`Error importing secret ${secretId}`, errors);
  }
  if (0 === imported.length) {
    throw new FrodoError(`Secret ${secretId} not found in import data`);
  }
  debugMessage({ message: `SecretsOps.importSecret: end`, state });
  return response;
}

/**
 * Import secrets
 * @param {SecretsExportInterface} importData import data
 * @returns {Promise<SecretSkeleton[]>} array of imported secret objects
 */
export async function importSecrets({
  importData,
  options = { includeActiveValues: true, source: '' },
  state,
}: {
  importData: SecretsExportInterface;
  options?: SecretImportOptions;
  state: State;
}): Promise<SecretSkeleton[]> {
  debugMessage({ message: `SecretsOps.importSecrets: start`, state });
  const response = [];
  const { includeActiveValues, source } = options;
  const errors = [];
  const resolvedSecretValues = await resolveSecretValues({
    secrets: Object.values(importData.secrets),
    includeActiveValues,
    source,
    state,
  });
  for (const id of Object.keys(importData.secrets)) {
    try {
      const secretData = importData.secrets[id];
      delete secretData._rev;
      try {
        response.push(
          await createSecret({
            secretId: secretData._id,
            value: resolvedSecretValues[secretData._id],
            description: secretData.description,
            encoding: secretData.encoding,
            useInPlaceholders: secretData.useInPlaceholders,
            state,
          })
        );
      } catch (error) {
        if (
          (error as FrodoError).httpStatus === 400 &&
          (error as FrodoError).httpMessage ===
            'Failed to create secret, the secret already exists'
        ) {
          // secret already exists so just trying to update the description
          await updateSecretDescription({
            secretId: secretData._id,
            description: secretData.description,
            state,
          });
          // only create a new secret version if requested
          if (includeActiveValues) {
            await createVersionOfSecret({
              secretId: secretData._id,
              value: resolvedSecretValues[secretData._id],
              state,
            });
          }
          // read the final secret definition to return as the response
          response.push(await readSecret({ secretId: secretData._id, state }));
        }
      }
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new FrodoError(`Error importing secrets`, errors);
  }
  debugMessage({ message: `SecretsOps.importSecrets: end`, state });
  return response;
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
    debugMessage({
      message: `SecretsOps.enableVersionOfSecret: start`,
      state,
    });
    const response = await _setStatusOfVersionOfSecret({
      secretId,
      version,
      status: 'ENABLED',
      state,
    });
    debugMessage({
      message: `SecretsOps.enableVersionOfSecret: end`,
      state,
    });
    return response;
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
}): Promise<VersionOfSecretSkeleton> {
  try {
    debugMessage({
      message: `SecretsOps.disableVersionOfSecret: start`,
      state,
    });
    const response = await _setStatusOfVersionOfSecret({
      secretId,
      version,
      status: 'DISABLED',
      state,
    });
    debugMessage({ message: `SecretsOps.disableVersionOfSecret: end`, state });
    return response;
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
    debugMessage({ message: `SecretsOps.readSecret: start`, state });
    const response = await _getSecret({ secretId, state });
    debugMessage({ message: `SecretsOps.readSecret: end`, state });
    return response;
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
    debugMessage({ message: `SecretsOps.readSecrets: start`, state });
    const { result } = await _getSecrets({ state });
    debugMessage({ message: `SecretsOps.readSecrets: end`, state });
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
    debugMessage({ message: `SecretsOps.createSecret: start`, state });
    const response = await _putSecret({
      secretId,
      value: getEncodedValue(value, encoding, state),
      description,
      encoding,
      useInPlaceholders,
      state,
    });
    debugMessage({ message: `SecretsOps.createSecret: end`, state });
    return response;
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
    debugMessage({ message: `SecretsOps.createVersionOfSecret: start`, state });
    // first get the secret encoding
    let secret: SecretSkeleton = null;
    secret = await readSecret({ secretId, state });
    // now create the new version (using encoding to calculate the correctly encoded value)
    const response = await _createNewVersionOfSecret({
      secretId,
      value: getEncodedValue(value, secret.encoding, state),
      state,
    });
    debugMessage({ message: `SecretsOps.createVersionOfSecret: end`, state });
    return response;
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
    debugMessage({ message: `SecretsOps.deleteSecret: start`, state });
    const response = await _deleteSecret({ secretId, state });
    debugMessage({ message: `SecretsOps.deleteSecret: end`, state });
    return response;
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
    debugMessage({ message: `SecretsOps.readVersionOfSecret: start`, state });
    const response = await _getVersionOfSecret({ secretId, version, state });
    debugMessage({ message: `SecretsOps.readVersionOfSecret: end`, state });
    return response;
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
    debugMessage({ message: `SecretsOps.readVersionsOfSecret: start`, state });
    const response = await _getSecretVersions({ secretId, state });
    debugMessage({ message: `SecretsOps.readVersionsOfSecret: end`, state });
    return response;
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
    debugMessage({
      message: `SecretsOps.updateSecretDescription: start`,
      state,
    });
    const response = await _setSecretDescription({
      secretId,
      description,
      state,
    });
    debugMessage({ message: `SecretsOps.updateSecretDescription: end`, state });
    return response;
  } catch (error) {
    throw new FrodoError(
      `Error updating description of secret ${secretId}`,
      error
    );
  }
}
