import {
  type AuthenticationSettingsSkeleton,
  getAuthenticationSettings as _getAuthenticationSettings,
  putAuthenticationSettings as _putAuthenticationSettings,
} from '../api/AuthenticationSettingsApi';
import { State } from '../shared/State';
import { debugMessage } from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { FrodoError } from './FrodoError';
import { type ExportMetaData } from './OpsTypes';

export type AuthenticationSettings = {
  /**
   * Read authentication settings
   * @param {boolean} globalConfig true if global authentication settings is the target of the operation, false otherwise. Default: false.
   * @returns {Promise<AuthenticationSettingsSkeleton>} a promise that resolves an authentication settings object
   */
  readAuthenticationSettings(
    globalConfig: boolean
  ): Promise<AuthenticationSettingsSkeleton>;
  /**
   * Update authentication settings
   * @param {AuthenticationSettingsSkeleton} settings authentication settings data
   * @param {boolean} globalConfig true if global authentication settings are the target of the operation, false otherwise. Default: false.
   * @returns {Promise<AuthenticationSettingsSkeleton>} a promise that resolves an authentication settings object
   */
  updateAuthenticationSettings(
    settings: AuthenticationSettingsSkeleton,
    globalConfig: boolean
  ): Promise<AuthenticationSettingsSkeleton>;
  /**
   * Export authentication settings
   * @param {boolean} globalConfig true if global authentication settings is the target of the operation, false otherwise. Default: false.
   * @returns {Promise<AuthenticationSettingsExportInterface>} a promise that resolves to an AuthenticationSettingsExportInterface object
   */
  exportAuthenticationSettings(
    globalConfig: boolean
  ): Promise<AuthenticationSettingsExportInterface>;
  /**
   * Import authentication settings
   * @param {AuthenticationSettingsExportInterface} importData import data
   * @param {boolean} globalConfig true if global authentication settings are the target of the operation, false otherwise. Default: false.
   */
  importAuthenticationSettings(
    importData: AuthenticationSettingsExportInterface,
    globalConfig: boolean
  ): Promise<AuthenticationSettingsSkeleton>;
};

export default (state: State): AuthenticationSettings => {
  return {
    async readAuthenticationSettings(globalConfig = false) {
      return readAuthenticationSettings({ state, globalConfig });
    },
    async updateAuthenticationSettings(
      settings: AuthenticationSettingsSkeleton,
      globalConfig: boolean
    ) {
      return updateAuthenticationSettings({
        settings,
        globalConfig,
        state,
      });
    },
    async exportAuthenticationSettings(
      globalConfig = false
    ): Promise<AuthenticationSettingsExportInterface> {
      return exportAuthenticationSettings({ state, globalConfig });
    },
    async importAuthenticationSettings(
      importData: AuthenticationSettingsExportInterface,
      globalConfig: boolean
    ): Promise<AuthenticationSettingsSkeleton> {
      return importAuthenticationSettings({ importData, globalConfig, state });
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
export function createAuthenticationSettingsExportTemplate({
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
 * @param {boolean} globalConfig true if global agent is the target of the operation, false otherwise. Default: false.
 * @returns {Promise} a promise that resolves to an object containing an array of authentication settingss
 */
export async function readAuthenticationSettings({
  state,
  globalConfig = false,
}: {
  state: State;
  globalConfig: boolean;
}): Promise<AuthenticationSettingsSkeleton> {
  try {
    const settings = await _getAuthenticationSettings({ state, globalConfig });
    return settings;
  } catch (error) {
    throw new FrodoError(`Error reading authentication settings`, error);
  }
}

export async function updateAuthenticationSettings({
  settings,
  globalConfig = false,
  state,
}: {
  settings: AuthenticationSettingsSkeleton;
  globalConfig: boolean;
  state: State;
}): Promise<AuthenticationSettingsSkeleton> {
  try {
    debugMessage({
      message: `AuthenticationSettingsOps.updateAuthenticationSettings: start`,
      state,
    });
    const response = await _putAuthenticationSettings({
      settings,
      globalConfig,
      state,
    });
    debugMessage({
      message: `AuthenticationSettingsOps.updateAuthenticationSettings: end`,
      state,
    });
    return response;
  } catch (error) {
    throw new FrodoError(`Error updating authentication settings`, error);
  }
}

/**
 * Export authentication settings
 * @param {boolean} globalConfig true if global agent is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<AuthenticationSettingsExportInterface>} a promise that resolves to a AuthenticationSettingsExportInterface object
 */
export async function exportAuthenticationSettings({
  state,
  globalConfig = false,
}: {
  state: State;
  globalConfig: boolean;
}): Promise<AuthenticationSettingsExportInterface> {
  try {
    debugMessage({
      message: `AuthenticationSettingsOps.exportAuthenticationSettings: start`,
      state,
    });
    const settingsData = await readAuthenticationSettings({
      state,
      globalConfig,
    });
    const exportData = createAuthenticationSettingsExportTemplate({ state });
    exportData.authentication = settingsData;
    debugMessage({
      message: `AuthenticationSettingsOps.exportAuthenticationSettings: end`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting authentication settings`, error);
  }
}

export async function exportAuthenticationSettingsForAllRealms() {}

/**
 * Import authentication settings
 * @param {AuthenticationSettingsExportInterface} importData import data
 * @param {boolean} globalConfig true if global authentication settings are the target of the operation, false otherwise. Default: false.
 * @returns {Promise<AuthenticationSettingsSkeleton>} a promise resolving to a authentication settings object
 */
export async function importAuthenticationSettings({
  importData,
  globalConfig,
  state,
}: {
  importData: AuthenticationSettingsExportInterface;
  globalConfig: boolean;
  state: State;
}): Promise<AuthenticationSettingsSkeleton> {
  let response = null;
  try {
    response = await updateAuthenticationSettings({
      settings: importData.authentication,
      globalConfig,
      state,
    });
    return response;
  } catch (error) {
    throw new FrodoError(`Error importing authentication settings`, error);
  }
}
