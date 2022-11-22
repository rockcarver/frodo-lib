import { ThemeSkeleton, UiThemeRealmObject } from '../api/ApiTypes';
import { getConfigEntity, putConfigEntity } from '../api/IdmConfigApi';
import { getCurrentRealmName } from '../api/utils/ApiUtils';
import { debugMessage } from '../ops/utils/Console';

export const THEMEREALM_ID = 'ui/themerealm';

/**
 * Get realm themes
 * @param {UiThemeRealmObject} themes object containing themes
 * @returns {ThemeSkeleton[]} array of theme pertaining to the current realm
 */
function getRealmThemes(themes: UiThemeRealmObject): ThemeSkeleton[] {
  if (themes.realm && themes.realm[getCurrentRealmName()]) {
    return themes.realm[getCurrentRealmName()];
  }
  return [];
}

/**
 * Get all themes
 * @returns {Promise<ThemeSkeleton[]>} a promise that resolves to an array of themes
 */
export async function getThemes(): Promise<ThemeSkeleton[]> {
  const themes = await getConfigEntity(THEMEREALM_ID);
  return getRealmThemes(themes);
}

/**
 * Get theme by id
 * @param {string} themeId theme id
 * @returns {Promise<ThemeSkeleton>} a promise that resolves to a theme object
 */
export async function getTheme(themeId: string): Promise<ThemeSkeleton> {
  const themes = await getConfigEntity(THEMEREALM_ID);
  const found = getRealmThemes(themes).filter((theme) => theme._id === themeId);
  if (found.length === 1) {
    return found[0];
  }
  if (found.length > 1) {
    throw new Error(`Multiple themes with id "${themeId}" found!`);
  }
  throw new Error(`Theme with id "${themeId}" not found!`);
}

/**
 * Get theme by name
 * @param {string} themeName theme name
 * @returns {Promise<ThemeSkeleton>} a promise that resolves to a theme object
 */
export async function getThemeByName(
  themeName: string
): Promise<ThemeSkeleton> {
  const themes = await getConfigEntity(THEMEREALM_ID);
  const found = getRealmThemes(themes).filter(
    (theme) => theme.name === themeName
  );
  if (found.length === 1) {
    return found[0];
  }
  if (found.length > 1) {
    throw new Error(`Multiple themes with the name "${themeName}" found!`);
  }
  throw new Error(`Theme "${themeName}" not found!`);
}

/**
 * Put theme by id
 * @param {string} themeId theme id
 * @param {ThemeSkeleton} themeData theme object
 * @returns {Promise<ThemeSkeleton>} a promise that resolves to a theme object
 */
export async function putTheme(
  themeId: string,
  themeData: ThemeSkeleton
): Promise<ThemeSkeleton> {
  const data = themeData;
  data._id = themeId;
  const themes = await getConfigEntity(THEMEREALM_ID);
  let isNew = true;
  const realmThemes = getRealmThemes(themes).map((theme) => {
    if (theme._id === themeId) {
      isNew = false;
      return data;
    }
    // eslint-disable-next-line no-param-reassign
    if (data.isDefault) theme.isDefault = false;
    return theme;
  });
  if (isNew) {
    realmThemes.push(data);
  }
  themes.realm[getCurrentRealmName()] = realmThemes;
  const found = getRealmThemes(
    await putConfigEntity(THEMEREALM_ID, themes)
  ).filter((theme) => theme._id === themeId);
  if (found.length === 1) {
    return found[0];
  }
  if (found.length > 1) {
    throw new Error(`Multiple themes with id "${themeId}" found!`);
  }
  throw new Error(`Theme with id "${themeId}" not saved!`);
}

/**
 * Put theme by name
 * @param {String} themeName theme name
 * @param {ThemeSkeleton} themeData theme object
 * @returns {Promise<ThemeSkeleton>} a promise that resolves to a theme object
 */
export async function putThemeByName(
  themeName: string,
  themeData: ThemeSkeleton
): Promise<ThemeSkeleton> {
  const data = themeData;
  data.name = themeName;
  const themes = await getConfigEntity(THEMEREALM_ID);
  let isNew = true;
  const realmThemes = getRealmThemes(themes).map((theme) => {
    if (theme.name === themeName) {
      isNew = false;
      return data;
    }
    // eslint-disable-next-line no-param-reassign
    if (data.isDefault) theme.isDefault = false;
    return theme;
  });
  if (isNew) {
    realmThemes.push(data);
  }
  themes['realm'][getCurrentRealmName()] = realmThemes;
  const found = getRealmThemes(
    await putConfigEntity(THEMEREALM_ID, themes)
  ).filter((theme) => theme.name === themeName);
  if (found.length === 1) {
    return found[0];
  }
  if (found.length > 1) {
    throw new Error(`Multiple themes "${themeName}" found!`);
  }
  throw new Error(`Theme "${themeName}" not saved!`);
}

/**
 * Put all themes
 * @param {Map<string, ThemeSkeleton>} allThemesData themes object containing all themes for all realms
 * @returns {Promise<Map<string, ThemeSkeleton>>} a promise that resolves to a themes object
 */
export async function putThemes(
  themeMap: Map<string, ThemeSkeleton>
): Promise<Map<string, ThemeSkeleton>> {
  debugMessage(`ThemeApi.putThemes: start`);
  const themes = await getConfigEntity(THEMEREALM_ID);
  const allThemeIDs = Object.keys(themeMap);
  const existingThemeIDs = [];
  let defaultThemeId = null;
  // update existing themes
  let realmThemes = getRealmThemes(themes).map((theme) => {
    if (themeMap[theme._id]) {
      debugMessage(`Update theme: ${theme._id} - ${theme.name}`);
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
    debugMessage(
      `Add theme: ${themeMap[themeId]._id} - ${themeMap[themeId].name}`
    );
    // remember the id of the last default theme
    if (themeMap[themeId].isDefault) defaultThemeId = themeId;
    realmThemes.push(themeMap[themeId]);
  });
  // if we imported a default theme, flag all the other themes as not default
  if (defaultThemeId) {
    realmThemes = realmThemes.map((theme) => {
      // eslint-disable-next-line no-param-reassign
      theme.isDefault = theme._id === defaultThemeId;
      return theme;
    });
  }
  themes.realm[getCurrentRealmName()] = realmThemes;
  const updatedThemes = new Map(
    getRealmThemes(await putConfigEntity(THEMEREALM_ID, themes)).map(
      (theme) => [theme._id, theme]
    )
  );
  debugMessage(updatedThemes);
  debugMessage(`ThemeApi.putThemes: finished`);
  return updatedThemes;
}

/**
 * Delete theme by id
 * @param {string} themeId theme id
 * @returns {Promise<ThemeSkeleton>} a promise that resolves to a themes object
 */
export async function deleteTheme(themeId: string): Promise<ThemeSkeleton> {
  const themes = await getConfigEntity(THEMEREALM_ID);
  const realmThemes = getRealmThemes(themes);
  const deletedThemes: ThemeSkeleton[] = [];
  const finalThemes = realmThemes.filter((theme) => {
    if (theme._id !== themeId) {
      return true;
    }
    deletedThemes.push(theme);
    return false;
  });
  if (realmThemes.length === finalThemes.length)
    throw new Error(`${themeId} not found`);
  themes.realm[getCurrentRealmName()] = realmThemes;
  const undeletedThemes = getRealmThemes(
    await putConfigEntity(THEMEREALM_ID, themes)
  ).filter((theme) => deletedThemes.includes(theme));
  if (deletedThemes.length > 0 && undeletedThemes.length === 0) {
    return deletedThemes[0];
  }
  throw new Error(
    `Theme(s) with id(s) "${undeletedThemes.map(
      (theme) => theme._id
    )}" not deleted!`
  );
}

/**
 * Delete theme by name
 * @param {string} themeName theme name
 * @returns {Promise<ThemeSkeleton>} a promise that resolves to a themes object
 */
export async function deleteThemeByName(
  themeName: string
): Promise<ThemeSkeleton> {
  const themes = await getConfigEntity(THEMEREALM_ID);
  const realmThemes = getRealmThemes(themes);
  const deletedThemes: ThemeSkeleton[] = [];
  const finalThemes = realmThemes.filter((theme) => {
    if (theme.name !== themeName) {
      return true;
    }
    deletedThemes.push(theme);
    return false;
  });
  if (realmThemes.length === finalThemes.length)
    throw new Error(`${themeName} not found`);
  themes.realm[getCurrentRealmName()] = finalThemes;
  // return putConfigEntity(THEMEREALM_ID, themes);
  const undeletedThemes = getRealmThemes(
    await putConfigEntity(THEMEREALM_ID, themes)
  ).filter((theme) => deletedThemes.includes(theme));
  if (deletedThemes.length > 0 && undeletedThemes.length === 0) {
    return deletedThemes[0];
  }
  throw new Error(
    `Theme(s) with id(s) "${undeletedThemes.map(
      (theme) => theme._id
    )}" not deleted!`
  );
}

/**
 * Delete all themes
 * @returns {Promise<ThemeSkeleton[]>} a promise that resolves to an array of themes
 */
export async function deleteThemes(): Promise<ThemeSkeleton[]> {
  const themes = await getConfigEntity(THEMEREALM_ID);
  const realmThemes = themes.realm[getCurrentRealmName()];
  if (!realmThemes)
    throw new Error(
      `No theme configuration found for realm "${getCurrentRealmName()}"`
    );
  const deletedThemes: ThemeSkeleton[] = [];
  for (const theme of realmThemes) {
    deletedThemes.push(theme);
  }
  themes.realm[getCurrentRealmName()] = [];
  await putConfigEntity(THEMEREALM_ID, themes);
  return deletedThemes;
}
