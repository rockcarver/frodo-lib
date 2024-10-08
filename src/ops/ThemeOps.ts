import { v4 as uuidv4 } from 'uuid';

import { type IdObjectSkeletonInterface } from '../api/ApiTypes';
import { getConfigEntity, putConfigEntity } from '../api/IdmConfigApi';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { getCurrentRealmName } from '../utils/ForgeRockUtils';
import { FrodoError } from './FrodoError';
import { ExportMetaData } from './OpsTypes';

export type ThemeSkeleton = IdObjectSkeletonInterface & {
  name: string;
  isDefault: boolean;
  linkedTrees: string[];
};

export type UiThemeRealmObject = IdObjectSkeletonInterface & {
  name: string;
  realm: Map<string, ThemeSkeleton[]>;
};

export const THEMEREALM_ID = 'ui/themerealm';

export type Theme = {
  /**
   * Create an empty theme export template
   * @returns {ThemeExportInterface} an empty theme export template
   */
  createThemeExportTemplate(): ThemeExportInterface;
  /**
   * Read all themes
   * @param {string} realm realm name
   * @returns {Promise<ThemeSkeleton[]>} a promise that resolves to an array of themes
   */
  readThemes(): Promise<ThemeSkeleton[]>;
  /**
   * Read theme by id
   * @param {string} themeId theme id
   * @param {string} realm realm name
   * @returns {Promise<ThemeSkeleton>} a promise that resolves to a theme object
   */
  readTheme(themeId: string, realm?: string): Promise<ThemeSkeleton>;
  /**
   * Read theme by name
   * @param {string} themeName theme name
   * @param {string} realm realm name
   * @returns {Promise<ThemeSkeleton>} a promise that resolves to a theme object
   */
  readThemeByName(themeName: string, realm?: string): Promise<ThemeSkeleton>;
  /**
   * Export all themes. The response can be saved to file as is.
   * @returns {Promise<ThemeExportInterface>} Promise resolving to a ThemeExportInterface object.
   */
  exportThemes(): Promise<ThemeExportInterface>;
  /**
   * Update theme
   * @param {ThemeSkeleton} themeData theme object
   * @param {string} themeId theme id
   * @param {string} realm realm name
   * @returns {Promise<ThemeSkeleton>} a promise that resolves to a theme object
   */
  createTheme(
    themeData: ThemeSkeleton,
    themeId?: string,
    realm?: string
  ): Promise<ThemeSkeleton>;
  /**
   * Update theme
   * @param {string} themeId theme id
   * @param {ThemeSkeleton} themeData theme object
   * @param {string} realm realm name
   * @returns {Promise<ThemeSkeleton>} a promise that resolves to a theme object
   */
  updateTheme(
    themeId: string,
    themeData: ThemeSkeleton,
    realm?: string
  ): Promise<ThemeSkeleton>;
  /**
   * Update theme by name
   * @param {String} themeName theme name
   * @param {ThemeSkeleton} themeData theme object
   * @param {string} realm realm name
   * @returns {Promise<ThemeSkeleton>} a promise that resolves to a theme object
   */
  updateThemeByName(
    themeName: string,
    themeData: ThemeSkeleton,
    realm?: string
  ): Promise<ThemeSkeleton>;
  /**
   * Update all themes
   * @param {Map<string, ThemeSkeleton>} allThemesData themes object containing all themes for all realms
   * @param {string} realm realm name
   * @returns {Promise<Map<string, ThemeSkeleton>>} a promise that resolves to a themes object
   */
  updateThemes(
    themeMap: Record<string, ThemeSkeleton>
  ): Promise<Record<string, ThemeSkeleton>>;
  /**
   * Import themes
   * @param {ThemeExportInterface} importData import data
   * @returns {Promise<ThemeSkeleton[]>} a promise resolving to an array of theme objects
   */
  importThemes(importData: ThemeExportInterface): Promise<ThemeSkeleton[]>;
  /**
   * Delete theme by id
   * @param {string} themeId theme id
   * @param {string} realm realm name
   * @returns {Promise<ThemeSkeleton>} a promise that resolves to a themes object
   */
  deleteTheme(themeId: string, realm?: string): Promise<ThemeSkeleton>;
  /**
   * Delete theme by name
   * @param {string} themeName theme name
   * @param {string} realm realm name
   * @returns {Promise<ThemeSkeleton>} a promise that resolves to a themes object
   */
  deleteThemeByName(themeName: string, realm?: string): Promise<ThemeSkeleton>;
  /**
   * Delete all themes
   * @param {string} realm realm name
   * @returns {Promise<ThemeSkeleton[]>} a promise that resolves to an array of themes
   */
  deleteThemes(realm?: string): Promise<ThemeSkeleton[]>;

  // Deprecated

  /**
   * Get all themes
   * @param {string} realm realm name
   * @returns {Promise<ThemeSkeleton[]>} a promise that resolves to an array of themes
   * @deprecated since v2.0.0 use {@link Theme.readThemes | readThemes} instead
   * ```javascript
   * readThemes(): Promise<ThemeSkeleton[]>
   * ```
   * @group Deprecated
   */
  getThemes(): Promise<ThemeSkeleton[]>;
  /**
   * Get theme by id
   * @param {string} themeId theme id
   * @param {string} realm realm name
   * @returns {Promise<ThemeSkeleton>} a promise that resolves to a theme object
   * @deprecated since v2.0.0 use {@link Theme.readTheme | readTheme} instead
   * ```javascript
   * readTheme(themeId: string, realm?: string): Promise<ThemeSkeleton>
   * ```
   * @group Deprecated
   */
  getTheme(themeId: string, realm?: string): Promise<ThemeSkeleton>;
  /**
   * Get theme by name
   * @param {string} themeName theme name
   * @param {string} realm realm name
   * @returns {Promise<ThemeSkeleton>} a promise that resolves to a theme object
   * @deprecated since v2.0.0 use {@link Theme.readThemeByName | readThemeByName} instead
   * ```javascript
   * readThemeByName(themeName: string, realm?: string): Promise<ThemeSkeleton>
   * ```
   * @group Deprecated
   */
  getThemeByName(themeName: string, realm?: string): Promise<ThemeSkeleton>;
  /**
   * Put theme by id
   * @param {string} themeId theme id
   * @param {ThemeSkeleton} themeData theme object
   * @param {string} realm realm name
   * @returns {Promise<ThemeSkeleton>} a promise that resolves to a theme object
   * @deprecated since v2.0.0 use {@link Theme.updateTheme | updateTheme} or {@link Theme.createTheme | createTheme} instead
   * ```javascript
   * updateTheme(themeId: string, themeData: ThemeSkeleton, realm?: string): Promise<ThemeSkeleton>
   * createTheme(themeData: ThemeSkeleton, themeId?: string, realm?: string): Promise<ThemeSkeleton>
   * ```
   * @group Deprecated
   */
  putTheme(
    themeId: string,
    themeData: ThemeSkeleton,
    realm?: string
  ): Promise<ThemeSkeleton>;
  /**
   * Put theme by name
   * @param {String} themeName theme name
   * @param {ThemeSkeleton} themeData theme object
   * @param {string} realm realm name
   * @returns {Promise<ThemeSkeleton>} a promise that resolves to a theme object
   * @deprecated since v2.0.0 use {@link Theme.updateThemeByName | updateThemeByName} instead
   * ```javascript
   * updateThemeByName(themeName: string, themeData: ThemeSkeleton, realm?: string): Promise<ThemeSkeleton>
   * ```
   * @group Deprecated
   */
  putThemeByName(
    themeName: string,
    themeData: ThemeSkeleton,
    realm?: string
  ): Promise<ThemeSkeleton>;
  /**
   * Put all themes
   * @param {Map<string, ThemeSkeleton>} allThemesData themes object containing all themes for all realms
   * @param {string} realm realm name
   * @returns {Promise<Map<string, ThemeSkeleton>>} a promise that resolves to a themes object
   * @deprecated since v2.0.0 use {@link Theme.updateThemes | updateThemes} instead
   * ```javascript
   * updateThemes(themeMap: Map<string, ThemeSkeleton>): Promise<Map<string, ThemeSkeleton>>
   * ```
   * @group Deprecated
   */
  putThemes(
    themeMap: Record<string, ThemeSkeleton>
  ): Promise<Record<string, ThemeSkeleton>>;
};

export default (state: State): Theme => {
  return {
    createThemeExportTemplate(): ThemeExportInterface {
      return createThemeExportTemplate({ state });
    },
    async readThemes(): Promise<ThemeSkeleton[]> {
      return readThemes({ state });
    },
    async readTheme(
      themeId: string,
      realm: string = state.getRealm()
    ): Promise<ThemeSkeleton> {
      return readTheme({ themeId, realm, state });
    },
    async readThemeByName(
      themeName: string,
      realm: string = state.getRealm()
    ): Promise<ThemeSkeleton> {
      return readThemeByName({ themeName, realm, state });
    },
    async exportThemes(): Promise<ThemeExportInterface> {
      return exportThemes({ state });
    },
    async createTheme(
      themeData: ThemeSkeleton,
      themeId?: string,
      realm?: string
    ): Promise<ThemeSkeleton> {
      return createTheme({ themeId, themeData, realm, state });
    },
    async updateTheme(
      themeId: string,
      themeData: ThemeSkeleton,
      realm: string = state.getRealm()
    ): Promise<ThemeSkeleton> {
      return updateTheme({ themeId, themeData, realm, state });
    },
    async updateThemeByName(
      themeName: string,
      themeData: ThemeSkeleton,
      realm: string = state.getRealm()
    ): Promise<ThemeSkeleton> {
      return updateThemeByName({ themeName, themeData, realm, state });
    },
    async updateThemes(
      themeMap: Record<string, ThemeSkeleton>
    ): Promise<Record<string, ThemeSkeleton>> {
      return updateThemes({ themeMap, state });
    },
    async importThemes(
      importData: ThemeExportInterface
    ): Promise<ThemeSkeleton[]> {
      return importThemes({ importData, state });
    },
    async deleteTheme(
      themeId: string,
      realm: string = state.getRealm()
    ): Promise<ThemeSkeleton> {
      return deleteTheme({ themeId, realm, state });
    },
    async deleteThemeByName(
      themeName: string,
      realm: string = state.getRealm()
    ): Promise<ThemeSkeleton> {
      return deleteThemeByName({ themeName, realm, state });
    },
    async deleteThemes(
      realm: string = state.getRealm()
    ): Promise<ThemeSkeleton[]> {
      return deleteThemes({ realm, state });
    },

    // Deprecated

    async getThemes(): Promise<ThemeSkeleton[]> {
      return readThemes({ state });
    },
    async getTheme(
      themeId: string,
      realm: string = state.getRealm()
    ): Promise<ThemeSkeleton> {
      return readTheme({ themeId, realm, state });
    },
    async getThemeByName(
      themeName: string,
      realm: string = state.getRealm()
    ): Promise<ThemeSkeleton> {
      return readThemeByName({ themeName, realm, state });
    },
    async putTheme(
      themeId: string,
      themeData: ThemeSkeleton,
      realm: string = state.getRealm()
    ): Promise<ThemeSkeleton> {
      return updateTheme({ themeId, themeData, realm, state });
    },
    async putThemeByName(
      themeName: string,
      themeData: ThemeSkeleton,
      realm: string = state.getRealm()
    ): Promise<ThemeSkeleton> {
      return updateThemeByName({ themeName, themeData, realm, state });
    },
    async putThemes(
      themeMap: Record<string, ThemeSkeleton>
    ): Promise<Record<string, ThemeSkeleton>> {
      return updateThemes({ themeMap, state });
    },
  };
};

export interface ThemeExportInterface {
  meta?: ExportMetaData;
  theme: Record<string, ThemeSkeleton>;
}

/**
 * Create an empty theme export template
 * @returns {ThemeExportInterface} an empty theme export template
 */
export function createThemeExportTemplate({
  state,
}: {
  state: State;
}): ThemeExportInterface {
  return {
    meta: getMetadata({ state }),
    theme: {},
  } as ThemeExportInterface;
}

/**
 * Get realm themes
 * @param {UiThemeRealmObject} themes object containing themes
 * @param {string} realm realm name
 * @returns {ThemeSkeleton[]} array of theme pertaining to the current realm
 */
function getRealmThemes({
  themes,
  realm,
}: {
  themes: UiThemeRealmObject;
  realm: string;
}): ThemeSkeleton[] {
  if (themes.realm && themes.realm[realm]) {
    return themes.realm[realm];
  }
  return [];
}

/**
 * Read all themes
 * @param {string} realm realm name
 * @returns {Promise<ThemeSkeleton[]>} a promise that resolves to an array of themes
 */
export async function readThemes({
  realm = null,
  state,
}: {
  realm?: string;
  state: State;
}): Promise<ThemeSkeleton[]> {
  try {
    realm = realm ? realm : getCurrentRealmName(state);
    const themes = await getConfigEntity({ entityId: THEMEREALM_ID, state });
    return getRealmThemes({ themes, realm });
  } catch (error) {
    throw new FrodoError(`Error reading themes`, error);
  }
}

/**
 * Read theme by id
 * @param {string} themeId theme id
 * @param {string} realm realm name
 * @returns {Promise<ThemeSkeleton>} a promise that resolves to a theme object
 */
export async function readTheme({
  themeId,
  realm,
  state,
}: {
  themeId: string;
  realm?: string;
  state: State;
}): Promise<ThemeSkeleton> {
  try {
    realm = realm ? realm : getCurrentRealmName(state);
    const themes = await getConfigEntity({ entityId: THEMEREALM_ID, state });
    const found = getRealmThemes({ themes, realm }).filter(
      (theme) => theme._id === themeId
    );
    if (found.length === 1) {
      return found[0];
    }
    if (found.length > 1) {
      throw new FrodoError(
        `Multiple themes with id '${themeId}' found in realm '${realm}'!`
      );
    }
    throw new FrodoError(
      `Theme with id '${themeId}' not found in realm '${realm}'!`
    );
  } catch (error) {
    throw new FrodoError(`Error reading theme ${themeId}`, error);
  }
}

/**
 * Read theme by name
 * @param {string} themeName theme name
 * @param {string} realm realm name
 * @returns {Promise<ThemeSkeleton>} a promise that resolves to a theme object
 */
export async function readThemeByName({
  themeName,
  realm,
  state,
}: {
  themeName: string;
  realm?: string;
  state: State;
}): Promise<ThemeSkeleton> {
  try {
    realm = realm ? realm : getCurrentRealmName(state);
    const themes = await getConfigEntity({ entityId: THEMEREALM_ID, state });
    const found = getRealmThemes({ themes, realm }).filter(
      (theme) => theme.name === themeName
    );
    if (found.length === 1) {
      return found[0];
    }
    if (found.length > 1) {
      throw new Error(
        `Multiple themes with the name '${themeName}' found in realm '${realm}'!`
      );
    }
    throw new Error(`Theme '${themeName}' not found in realm '${realm}'!`);
  } catch (error) {
    throw new FrodoError(`Error reading theme ${themeName}`, error);
  }
}

/**
 * Export all themes. The response can be saved to file as is.
 * @returns {Promise<ThemeExportInterface>} Promise resolving to a ThemeExportInterface object.
 */
export async function exportThemes({
  state,
}: {
  state: State;
}): Promise<ThemeExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({ message: `ThemeOps.exportThemes: start`, state });
    const exportData = createThemeExportTemplate({ state });
    const themes = await readThemes({ state });
    indicatorId = createProgressIndicator({
      total: themes.length,
      message: 'Exporting themes...',
      state,
    });
    for (const theme of themes) {
      if (!theme._id) theme._id = uuidv4();
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting theme ${theme.name}`,
        state,
      });
      exportData.theme[theme._id] = theme;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${themes.length} themes.`,
      state,
    });
    debugMessage({ message: `ThemeOps.exportThemes: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting themes.`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error reading themes`, error);
  }
}

/**
 * Create theme
 * @param {string} themeId theme id
 * @param {ThemeSkeleton} themeData theme object
 * @param {string} realm realm name
 * @returns {Promise<ThemeSkeleton>} a promise that resolves to a theme object
 */
export async function createTheme({
  themeData,
  themeId,
  realm,
  state,
}: {
  themeData: ThemeSkeleton;
  themeId?: string;
  realm?: string;
  state: State;
}): Promise<ThemeSkeleton> {
  try {
    await readTheme({ themeId, realm, state });
  } catch (error) {
    try {
      const result = await updateTheme({
        themeId,
        themeData,
        realm,
        state,
      });
      return result;
    } catch (error) {
      throw new FrodoError(`Error creating theme ${themeId}`, error);
    }
  }
}

/**
 * Update theme
 * @param {string} themeId theme id
 * @param {ThemeSkeleton} themeData theme object
 * @param {string} realm realm name
 * @returns {Promise<ThemeSkeleton>} a promise that resolves to a theme object
 */
export async function updateTheme({
  themeId,
  themeData,
  realm,
  state,
}: {
  themeId: string;
  themeData: ThemeSkeleton;
  realm?: string;
  state: State;
}): Promise<ThemeSkeleton> {
  try {
    realm = realm ? realm : getCurrentRealmName(state);
    const data = themeData;
    data._id = themeId;
    const themes = await getConfigEntity({ entityId: THEMEREALM_ID, state });
    let isNew = true;
    const realmThemes = getRealmThemes({ themes, realm }).map((theme) => {
      if (theme._id === themeId) {
        isNew = false;
        return data;
      }
      if (data.isDefault) theme.isDefault = false;
      return theme;
    });
    if (isNew) {
      realmThemes.push(data);
    }
    themes.realm[realm] = realmThemes;
    const found = getRealmThemes({
      themes: (await putConfigEntity({
        entityId: THEMEREALM_ID,
        entityData: themes,
        state,
      })) as UiThemeRealmObject,
      realm,
    }).filter((theme) => theme._id === themeId);
    if (found.length === 1) {
      return found[0];
    }
    if (found.length > 1) {
      throw new FrodoError(
        `Multiple themes with id '${themeId}' found in realm '${realm}'!`
      );
    }
    throw new FrodoError(
      `Theme with id '${themeId}' not saved in realm '${realm}'!`
    );
  } catch (error) {
    throw new FrodoError(`Error updating theme ${themeId}`, error);
  }
}

/**
 * Update theme by name
 * @param {String} themeName theme name
 * @param {ThemeSkeleton} themeData theme object
 * @param {string} realm realm name
 * @returns {Promise<ThemeSkeleton>} a promise that resolves to a theme object
 */
export async function updateThemeByName({
  themeName,
  themeData,
  realm,
  state,
}: {
  themeName: string;
  themeData: ThemeSkeleton;
  realm?: string;
  state: State;
}): Promise<ThemeSkeleton> {
  try {
    realm = realm ? realm : getCurrentRealmName(state);
    const data = themeData;
    data.name = themeName;
    const themes = await getConfigEntity({ entityId: THEMEREALM_ID, state });
    let isNew = true;
    const realmThemes = getRealmThemes({ themes, realm }).map((theme) => {
      if (theme.name === themeName) {
        isNew = false;
        return data;
      }
      if (data.isDefault) theme.isDefault = false;
      return theme;
    });
    if (isNew) {
      realmThemes.push(data);
    }
    themes['realm'][realm] = realmThemes;
    const found = getRealmThemes({
      themes: (await putConfigEntity({
        entityId: THEMEREALM_ID,
        entityData: themes,
        state,
      })) as UiThemeRealmObject,
      realm,
    }).filter((theme) => theme.name === themeName);
    if (found.length === 1) {
      return found[0];
    }
    if (found.length > 1) {
      throw new FrodoError(
        `Multiple themes '${themeName}' found in realm '${realm}'!`
      );
    }
    throw new FrodoError(`Theme '${themeName}' not saved in realm '${realm}'!`);
  } catch (error) {
    throw new FrodoError(`Error updating theme ${themeName}`, error);
  }
}

/**
 * Update all themes
 * @param {Map<string, ThemeSkeleton>} allThemesData themes object containing all themes for all realms
 * @param {string} realm realm name
 * @returns {Promise<Map<string, ThemeSkeleton>>} a promise that resolves to a themes object
 */
export async function updateThemes({
  themeMap,
  realm = null,
  state,
}: {
  themeMap: Record<string, ThemeSkeleton>;
  realm?: string;
  state: State;
}): Promise<Record<string, ThemeSkeleton>> {
  try {
    debugMessage({ message: `ThemeApi.putThemes: start`, state });
    realm = realm ? realm : getCurrentRealmName(state);
    const themes = await getConfigEntity({ entityId: THEMEREALM_ID, state });
    const allThemeIDs = Object.keys(themeMap);
    const existingThemeIDs = [];
    let defaultThemeId = null;
    // update existing themes
    let realmThemes = getRealmThemes({ themes, realm }).map((theme) => {
      if (themeMap[theme._id]) {
        debugMessage({
          message: `Update theme: ${theme._id} - ${theme.name}`,
          state,
        });
        existingThemeIDs.push(theme._id);
        // remember the id of the last default theme
        if (themeMap[theme._id].isDefault) defaultThemeId = theme._id;
        return themeMap[theme._id];
      }
      return theme;
    });
    const newThemeIDs = allThemeIDs.filter(
      (id) => !existingThemeIDs.includes(id)
    );
    // add new themes
    newThemeIDs.forEach((themeId) => {
      debugMessage({
        message: `Add theme: ${themeMap[themeId]._id} - ${themeMap[themeId].name}`,
        state,
      });
      // remember the id of the last default theme
      if (themeMap[themeId].isDefault) defaultThemeId = themeId;
      realmThemes.push(themeMap[themeId]);
    });
    // if we imported a default theme, flag all the other themes as not default
    if (defaultThemeId) {
      realmThemes = realmThemes.map((theme) => {
        theme.isDefault = theme._id === defaultThemeId;
        return theme;
      });
    }
    themes.realm[realm] = realmThemes;
    const updatedThemes: unknown = new Map(
      getRealmThemes({
        themes: (await putConfigEntity({
          entityId: THEMEREALM_ID,
          entityData: themes,
          state,
        })) as UiThemeRealmObject,
        realm,
      }).map((theme) => [theme._id, theme])
    );
    debugMessage({
      message: updatedThemes as Record<string, ThemeSkeleton>,
      state,
    });
    debugMessage({ message: `ThemeApi.putThemes: finished`, state });
    return updatedThemes as Record<string, ThemeSkeleton>;
  } catch (error) {
    throw new FrodoError(`Error updating themes`, error);
  }
}

/**
 * Import themes
 * @param {ThemeExportInterface} importData import data
 * @param {string} realm realm name
 * @returns {Promise<ThemeSkeleton[]>} a promise resolving to an array of theme objects
 */
export async function importThemes({
  importData,
  realm = null,
  state,
}: {
  importData: ThemeExportInterface;
  realm?: string;
  state: State;
}): Promise<ThemeSkeleton[]> {
  try {
    debugMessage({ message: `ThemeOps.importThemes: start`, state });
    const map = (await updateThemes({
      themeMap: importData.theme,
      realm,
      state,
    })) as unknown as Map<string, ThemeSkeleton>;
    const response = Array.from(map.values());
    debugMessage({ message: `ThemeOps.importThemes: end`, state });
    return response;
  } catch (error) {
    throw new FrodoError(`Error importing themes`, error);
  }
}

/**
 * Delete theme by id
 * @param {string} themeId theme id
 * @param {string} realm realm name
 * @returns {Promise<ThemeSkeleton>} a promise that resolves to a themes object
 */
export async function deleteTheme({
  themeId,
  realm,
  state,
}: {
  themeId: string;
  realm?: string;
  state: State;
}): Promise<ThemeSkeleton> {
  try {
    realm = realm ? realm : getCurrentRealmName(state);
    const themes = await getConfigEntity({ entityId: THEMEREALM_ID, state });
    const realmThemes = getRealmThemes({ themes, realm });
    const deletedThemes: ThemeSkeleton[] = [];
    const finalThemes = realmThemes.filter((theme) => {
      if (theme._id !== themeId) {
        return true;
      }
      deletedThemes.push(theme);
      return false;
    });
    if (realmThemes.length === finalThemes.length)
      throw new FrodoError(`'${themeId}' not found in realm '${realm}'`);
    themes.realm[realm] = finalThemes;
    const undeletedThemes = getRealmThemes({
      themes: (await putConfigEntity({
        entityId: THEMEREALM_ID,
        entityData: themes,
        state,
      })) as UiThemeRealmObject,
      realm,
    }).filter((theme) => deletedThemes.includes(theme));
    if (deletedThemes.length > 0 && undeletedThemes.length === 0) {
      return deletedThemes[0];
    }
    throw new FrodoError(
      `Theme with id '${undeletedThemes.map(
        (theme) => theme._id
      )}' not deleted from realm '${realm}'!`
    );
  } catch (error) {
    throw new FrodoError(`Error deleting theme ${themeId}`, error);
  }
}

/**
 * Delete theme by name
 * @param {string} themeName theme name
 * @param {string} realm realm name
 * @returns {Promise<ThemeSkeleton>} a promise that resolves to a themes object
 */
export async function deleteThemeByName({
  themeName,
  realm,
  state,
}: {
  themeName: string;
  realm?: string;
  state: State;
}): Promise<ThemeSkeleton> {
  try {
    realm = realm ? realm : getCurrentRealmName(state);
    const themes = await getConfigEntity({ entityId: THEMEREALM_ID, state });
    const realmThemes = getRealmThemes({ themes, realm });
    const deletedThemes: ThemeSkeleton[] = [];
    const finalThemes = realmThemes.filter((theme) => {
      if (theme.name !== themeName) {
        return true;
      }
      deletedThemes.push(theme);
      return false;
    });
    if (realmThemes.length === finalThemes.length)
      throw new FrodoError(`'${themeName}' not found in realm '${realm}'`);
    themes.realm[realm] = finalThemes;
    const undeletedThemes = getRealmThemes({
      themes: (await putConfigEntity({
        entityId: THEMEREALM_ID,
        entityData: themes,
        state,
      })) as UiThemeRealmObject,
      realm,
    }).filter((theme) => deletedThemes.includes(theme));
    if (deletedThemes.length > 0 && undeletedThemes.length === 0) {
      return deletedThemes[0];
    }
    throw new FrodoError(
      `Theme(s) with id(s) '${undeletedThemes.map(
        (theme) => theme._id
      )}' not deleted from realm '${realm}'!`
    );
  } catch (error) {
    throw new FrodoError(`Error deleting theme ${themeName}`, error);
  }
}

/**
 * Delete all themes
 * @param {string} realm realm name
 * @returns {Promise<ThemeSkeleton[]>} a promise that resolves to an array of themes
 */
export async function deleteThemes({
  realm,
  state,
}: {
  realm?: string;
  state: State;
}): Promise<ThemeSkeleton[]> {
  try {
    realm = realm ? realm : getCurrentRealmName(state);
    const themes = await getConfigEntity({ entityId: THEMEREALM_ID, state });
    const realmThemes = themes.realm[realm];
    if (!realmThemes || realmThemes.length == 0)
      throw new FrodoError(`No theme configuration found for realm '${realm}'`);
    const deletedThemes: ThemeSkeleton[] = [];
    for (const theme of realmThemes) {
      deletedThemes.push(theme);
    }
    themes.realm[realm] = [];
    await putConfigEntity({
      entityId: THEMEREALM_ID,
      entityData: themes,
      state,
    });
    return deletedThemes;
  } catch (error) {
    throw new FrodoError(`Error deleting themes`, error);
  }
}
