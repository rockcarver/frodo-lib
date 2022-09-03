import {
  createKeyValueTable,
  createProgressIndicator,
  createTable,
  printMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from './utils/Console';
import {
  createNewVersionOfSecret,
  deleteSecret,
  deleteVersionOfSecret,
  getSecret,
  getSecrets,
  getSecretVersions,
  putSecret,
  setSecretDescription,
  setStatusOfVersionOfSecret,
} from '../api/SecretsApi';
import wordwrap from './utils/Wordwrap';
import { resolveUserName } from './ManagedObjectOps';

/**
 * List secrets
 * @param {boolean} long Long version, all the fields
 */
export async function listSecrets(long) {
  let secrets = [];
  try {
    secrets = await getSecrets();
  } catch (error) {
    printMessage(`${error.message}`, 'error');
    printMessage(error.response.data, 'error');
  }
  if (long) {
    const table = createTable([
      'Id'['brightCyan'],
      { hAlign: 'right', content: 'Active\nVersion'['brightCyan'] },
      { hAlign: 'right', content: 'Loaded\nVersion'['brightCyan'] },
      'Status'['brightCyan'],
      'Description'['brightCyan'],
      'Modifier'['brightCyan'],
      'Modified'['brightCyan'],
    ]);
    secrets.sort((a, b) => a._id.localeCompare(b._id));
    for (const secret of secrets) {
      table.push([
        secret._id,
        { hAlign: 'right', content: secret.activeVersion },
        { hAlign: 'right', content: secret.loadedVersion },
        secret.loaded ? 'loaded'['brightGreen'] : 'unloaded'['brightRed'],
        wordwrap(secret.description, 40),
        // eslint-disable-next-line no-await-in-loop
        await resolveUserName('teammember', secret.lastChangedBy),
        new Date(secret.lastChangeDate).toLocaleString(),
      ]);
    }
    printMessage(table.toString());
  } else {
    secrets.forEach((secret) => {
      printMessage(secret._id);
    });
  }
}

/**
 * Create secret
 * @param {String} id secret id
 * @param {String} value secret value
 * @param {String} description secret description
 * @param {String} encoding secret encoding
 * @param {boolean} useInPlaceholders use secret in placeholders
 */
export async function createSecret(
  id,
  value,
  description,
  encoding,
  useInPlaceholders
) {
  createProgressIndicator(
    undefined,
    `Creating secret ${id}...`,
    'indeterminate'
  );
  try {
    await putSecret(id, value, description, encoding, useInPlaceholders);
    stopProgressIndicator(`Created secret ${id}`, 'success');
  } catch (error) {
    stopProgressIndicator(
      `Error: ${error.response.data.code} - ${error.response.data.message}`,
      'fail'
    );
  }
}

/**
 * Set description of secret
 * @param {String} secretId secret id
 * @param {String} description secret description
 */
export async function setDescriptionOfSecret(secretId, description) {
  createProgressIndicator(
    undefined,
    `Setting description of secret ${secretId}...`,
    'indeterminate'
  );
  try {
    await setSecretDescription(secretId, description);
    stopProgressIndicator(`Set description of secret ${secretId}`, 'success');
  } catch (error) {
    stopProgressIndicator(
      `Error: ${error.response.data.code} - ${error.response.data.message}`,
      'fail'
    );
  }
}

/**
 * Delete a secret
 * @param {String} secretId secret id
 */
export async function deleteSecretCmd(secretId) {
  createProgressIndicator(
    undefined,
    `Deleting secret ${secretId}...`,
    'indeterminate'
  );
  try {
    await deleteSecret(secretId);
    stopProgressIndicator(`Deleted secret ${secretId}`, 'success');
  } catch (error) {
    stopProgressIndicator(
      `Error: ${error.response.data.code} - ${error.response.data.message}`,
      'fail'
    );
  }
}

/**
 * Delete all secrets
 */
export async function deleteSecretsCmd() {
  try {
    const secrets = await getSecrets();
    createProgressIndicator(secrets.length, `Deleting secrets...`);
    for (const secret of secrets) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await deleteSecret(secret._id);
        updateProgressIndicator(`Deleted secret ${secret._id}`);
      } catch (error) {
        printMessage(
          `Error: ${error.response.data.code} - ${error.response.data.message}`,
          'error'
        );
      }
    }
    stopProgressIndicator(`Secrets deleted.`);
  } catch (error) {
    printMessage(
      `Error: ${error.response.data.code} - ${error.response.data.message}`,
      'error'
    );
  }
}

/**
 * List all the versions of the secret
 * @param {String} secretId secret id
 */
export async function listSecretVersionsCmd(secretId) {
  let versions = [];
  try {
    versions = await getSecretVersions(secretId);
  } catch (error) {
    printMessage(`${error.message}`, 'error');
    printMessage(error.response.data, 'error');
  }
  const table = createTable([
    { hAlign: 'right', content: 'Version'['brightCyan'] },
    'Status'['brightCyan'],
    'Loaded'['brightCyan'],
    'Created'['brightCyan'],
  ]);
  // versions.sort((a, b) => a._id.localeCompare(b._id));
  const statusMap = {
    ENABLED: 'active'['brightGreen'],
    DISABLED: 'inactive'['brightRed'],
    DESTROYED: 'deleted'['brightRed'],
  };
  for (const version of versions) {
    table.push([
      { hAlign: 'right', content: version.version },
      statusMap[version.status],
      version.loaded ? 'loaded'['brightGreen'] : 'unloaded'['brightRed'],
      new Date(version.createDate).toLocaleString(),
    ]);
  }
  printMessage(table.toString());
}

/**
 * Describe a secret
 * @param {String} secretId Secret id
 */
export async function describeSecret(secretId) {
  const secret = await getSecret(secretId);
  const table = createKeyValueTable();
  table.push(['Name'['brightCyan'], secret._id]);
  table.push(['Active Version'['brightCyan'], secret.activeVersion]);
  table.push(['Loaded Version'['brightCyan'], secret.loadedVersion]);
  table.push([
    'Status'['brightCyan'],
    secret.loaded ? 'loaded'['brightGreen'] : 'unloaded'['brightRed'],
  ]);
  table.push(['Description'['brightCyan'], wordwrap(secret.description, 60)]);
  table.push([
    'Modified'['brightCyan'],
    new Date(secret.lastChangeDate).toLocaleString(),
  ]);
  table.push([
    'Modifier'['brightCyan'],
    await resolveUserName('teammember', secret.lastChangedBy),
  ]);
  table.push(['Modifier UUID'['brightCyan'], secret.lastChangedBy]);
  table.push(['Encoding'['brightCyan'], secret.encoding]);
  table.push(['Use In Placeholders'['brightCyan'], secret.useInPlaceholders]);
  printMessage(table.toString());
  printMessage('\nSecret Versions:');
  await listSecretVersionsCmd(secretId);
}

/**
 * Create new version of secret
 * @param {String} secretId secret id
 * @param {String} value secret value
 */
export async function createNewVersionOfSecretCmd(secretId, value) {
  createProgressIndicator(
    undefined,
    `Creating new version of secret ${secretId}...`,
    'indeterminate'
  );
  try {
    const version = await createNewVersionOfSecret(secretId, value);
    stopProgressIndicator(
      `Created version ${version.version} of secret ${secretId}`,
      'success'
    );
  } catch (error) {
    stopProgressIndicator(
      `Error: ${error.response.data.code} - ${error.response.data.message}`,
      'fail'
    );
  }
}

/**
 * Activate a version of a secret
 * @param {String} secretId secret id
 * @param {Number} version version of secret
 */
export async function activateVersionOfSecret(secretId, version) {
  createProgressIndicator(
    undefined,
    `Activating version ${version} of secret ${secretId}...`,
    'indeterminate'
  );
  try {
    await setStatusOfVersionOfSecret(secretId, version, 'ENABLED');
    stopProgressIndicator(
      `Activated version ${version} of secret ${secretId}`,
      'success'
    );
  } catch (error) {
    stopProgressIndicator(
      `Error: ${error.response.data.code} - ${error.response.data.message}`,
      'fail'
    );
  }
}

/**
 * Deactivate a version of a secret
 * @param {String} secretId secret id
 * @param {Number} version version of secret
 */
export async function deactivateVersionOfSecret(secretId, version) {
  createProgressIndicator(
    undefined,
    `Deactivating version ${version} of secret ${secretId}...`,
    'indeterminate'
  );
  try {
    await setStatusOfVersionOfSecret(secretId, version, 'DISABLED');
    stopProgressIndicator(
      `Deactivated version ${version} of secret ${secretId}`,
      'success'
    );
  } catch (error) {
    stopProgressIndicator(
      `Error: ${error.response.data.code} - ${error.response.data.message}`,
      'fail'
    );
  }
}

/**
 * Delete version of secret
 * @param {String} secretId secret id
 * @param {Number} version version of secret
 */
export async function deleteVersionOfSecretCmd(secretId, version) {
  createProgressIndicator(
    undefined,
    `Deleting version ${version} of secret ${secretId}...`,
    'indeterminate'
  );
  try {
    await deleteVersionOfSecret(secretId, version);
    stopProgressIndicator(
      `Deleted version ${version} of secret ${secretId}`,
      'success'
    );
  } catch (error) {
    stopProgressIndicator(
      `Error: ${error.response.data.code} - ${error.response.data.message}`,
      'fail'
    );
  }
}
