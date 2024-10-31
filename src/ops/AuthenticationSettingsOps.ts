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

export default (state: State): AuthenticationSettings => {
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
 * @returns {Promise} a promise that resolves to an object containing an array of authentication settingss
 */
export async function readAuthenticationSettings({
  state,
}: {
  state: State;
}): Promise<AuthenticationSettingsSkeleton> {
  try {
    const settings = await _getAuthenticationSettings({ state });
    return settings;
  } catch (error) {
    throw new FrodoError(`Error reading authentication settings`, error);
  }
}

export async function updateAuthenticationSettings({
  settings,
  state,
}: {
  settings: AuthenticationSettingsSkeleton;
  state: State;
}): Promise<AuthenticationSettingsSkeleton> {
  try {
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
  } catch (error) {
    throw new FrodoError(`Error updating authentication settings`, error);
  }
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
  try {
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
  } catch (error) {
    throw new FrodoError(`Error exporting authentication settings`, error);
  }
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
  try {
    response = await updateAuthenticationSettings({
      settings: importData.authentication,
      state,
    });
    return response;
  } catch (error) {
    throw new FrodoError(`Error importing authentication settings`, error);
  }
}
