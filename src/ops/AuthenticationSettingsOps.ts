import {
  type AuthenticationSettingsSkeleton,
  getAuthenticationSettings as _getAuthenticationSettings,
  putAuthenticationSettings as _putAuthenticationSettings,
} from '../api/AuthenticationSettingsApi';
import { State } from '../shared/State';
import { debugMessage } from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { type ExportMetaData } from './OpsTypes';

export type Idp = {
  /**
   * Read authentication settings
   * @returns {Promise<AuthenticationSettingsSkeleton>} a promise that resolves an authentication settings object
   */
  readAuthenticationSettings(): Promise<AuthenticationSettingsSkeleton>;
  /**
   * Update authentication settings
   * @param {AuthenticationSettingsSkeleton} settings authentication settings data
   * @returns {Promise<AuthenticationSettingsSkeleton>} a promise that resolves an authentication settings object
   */
  updateAuthenticationSettings(
    settings: AuthenticationSettingsSkeleton
  ): Promise<AuthenticationSettingsSkeleton>;
  /**
   * Export authentication settings
   * @returns {Promise<AuthenticationSettingsExportInterface>} a promise that resolves to an AuthenticationSettingsExportInterface object
   */
  exportAuthenticationSettings(): Promise<AuthenticationSettingsExportInterface>;
  /**
   * Import authentication settings
   * @param {AuthenticationSettingsExportInterface} importData import data
   */
  importAuthenticationSettings(
    importData: AuthenticationSettingsExportInterface
  ): Promise<AuthenticationSettingsSkeleton>;
};

export default (state: State): Idp => {
  return {
    async readAuthenticationSettings() {
      return readAuthenticationSettings({ state });
    },
    async updateAuthenticationSettings(
      settings: AuthenticationSettingsSkeleton
    ) {
      return updateAuthenticationSettings({
        settings,
        state,
      });
    },
    async exportAuthenticationSettings(): Promise<AuthenticationSettingsExportInterface> {
      return exportAuthenticationSettings({ state });
    },
    async importAuthenticationSettings(
      importData: AuthenticationSettingsExportInterface
    ): Promise<AuthenticationSettingsSkeleton> {
      return importAuthenticationSettings({ importData, state });
    },
  };
};

export interface AuthenticationSettingsExportInterface {
  meta?: ExportMetaData;
  authentication: AuthenticationSettingsSkeleton;
}

/**
 * Create an empty authentication settings export template
 * @returns {AuthenticationSettingsExportInterface} an empty authentication settings export template
 */
function createAuthenticationSettingsExportTemplate({
  state,
}: {
  state: State;
}): AuthenticationSettingsExportInterface {
  return {
    meta: getMetadata({ state }),
    authentication: {},
  } as AuthenticationSettingsExportInterface;
}

/**
 * Read authentication settings
 * @returns {Promise} a promise that resolves to an object containing an array of authentication settingss
 */
export async function readAuthenticationSettings({
  state,
}: {
  state: State;
}): Promise<AuthenticationSettingsSkeleton> {
  const { result } = await _getAuthenticationSettings({ state });
  return result;
}

export async function updateAuthenticationSettings({
  settings,
  state,
}: {
  settings: AuthenticationSettingsSkeleton;
  state: State;
}): Promise<AuthenticationSettingsSkeleton> {
  debugMessage({
    message: `AuthenticationSettingsOps.updateAuthenticationSettings: start`,
    state,
  });
  const response = await _putAuthenticationSettings({
    settings,
    state,
  });
  debugMessage({
    message: `AuthenticationSettingsOps.updateAuthenticationSettings: end`,
    state,
  });
  return response;
}

/**
 * Export authentication settings
 * @returns {Promise<AuthenticationSettingsExportInterface>} a promise that resolves to a AuthenticationSettingsExportInterface object
 */
export async function exportAuthenticationSettings({
  state,
}: {
  state: State;
}): Promise<AuthenticationSettingsExportInterface> {
  debugMessage({
    message: `AuthenticationSettingsOps.exportAuthenticationSettings: start`,
    state,
  });
  const settingsData = await readAuthenticationSettings({ state });
  const exportData = createAuthenticationSettingsExportTemplate({ state });
  exportData.authentication = settingsData;
  debugMessage({
    message: `AuthenticationSettingsOps.exportAuthenticationSettings: end`,
    state,
  });
  return exportData;
}

/**
 * Export authentication settings
 * @returns {Promise<AuthenticationSettingsExportInterface>} a promise that resolves to a AuthenticationSettingsExportInterface object
 */
export async function exportSocialProviders({
  state,
}: {
  state: State;
}): Promise<AuthenticationSettingsExportInterface> {
  const exportData = createAuthenticationSettingsExportTemplate({ state });
  const settingsData = await readAuthenticationSettings({
    state,
  });
  exportData.authentication = settingsData;
  return exportData;
}

/**
 * Import authentication settings
 * @param {AuthenticationSettingsExportInterface} importData import data
 * @returns {Promise<AuthenticationSettingsSkeleton>} a promise resolving to a authentication settings object
 */
export async function importAuthenticationSettings({
  importData,
  state,
}: {
  importData: AuthenticationSettingsExportInterface;
  state: State;
}): Promise<AuthenticationSettingsSkeleton> {
  let response = null;
  const errors = [];
  try {
    response = await updateAuthenticationSettings({
      settings: importData.authentication,
      state,
    });
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Import error:\n${errorMessages}`);
  }
  return response;
}
