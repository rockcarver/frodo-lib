import { getConfigEntity, putConfigEntity } from './IdmConfigApi';
import { getCurrentRealmName } from './utils/ApiUtils';

const THEMEREALM_ID = 'ui/themerealm';

/**
 * Get realm themes
 * @param {Object} themes object containing themes
 * @returns {Object} array of theme pertaining to the current realm
 */
function getRealmThemes(themes) {
  return themes.realm[getCurrentRealmName()]
    ? themes.realm[getCurrentRealmName()]
    : [];
}

/**
 * Get all themes
 * @returns {Promise} a promise that resolves to an array of themes
 */
export async function getThemes() {
  const themes = await getConfigEntity(THEMEREALM_ID);
  return getRealmThemes(themes);
}

/**
 * Get theme by id
 * @param {String} themeId theme id
 * @returns {Promise} a promise that resolves to an array of themes
 */
export async function getTheme(themeId) {
  const themes = await getConfigEntity(THEMEREALM_ID);
  return getRealmThemes(themes).filter((theme) => theme._id === themeId);
}

/**
 * Get theme by name
 * @param {String} themeName theme name
 * @returns {Promise} a promise that resolves to an array of themes
 */
export async function getThemeByName(themeName) {
  const themes = await getConfigEntity(THEMEREALM_ID);
  return getRealmThemes(themes).filter((theme) => theme.name === themeName);
}

/**
 * Put theme by id
 * @param {String} themeId theme id
 * @param {Object} themeData theme object
 * @returns {Promise} a promise that resolves to a themes object
 */
export async function putTheme(themeId, themeData) {
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
  return putConfigEntity(THEMEREALM_ID, themes);
}

/**
 * Put theme by name
 * @param {String} themeName theme name
 * @param {Object} themeData theme object
 * @returns {Promise} a promise that resolves to a themes object
 */
export async function putThemeByName(themeName, themeData) {
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
  return putConfigEntity(THEMEREALM_ID, themes);
}

/**
 * Put all themes
 * @param {Object} allThemesData themes object containing all themes for all realms
 * @returns {Promise} a promise that resolves to a themes object
 */
export async function putThemes(allThemesData) {
  const data = allThemesData;
  const themes = await getConfigEntity(THEMEREALM_ID);
  const allThemeIDs = Object.keys(data);
  const existingThemeIDs = [];
  let defaultThemeId = null;
  // update existing themes
  let realmThemes = getRealmThemes(themes).map((theme) => {
    if (data[theme._id]) {
      existingThemeIDs.push(theme._id);
      // remember the id of the last default theme
      if (data[theme._id].isDefault) defaultThemeId = theme._id;
      return data[theme._id];
    }
    return theme;
  });
  const newThemeIDs = allThemeIDs.filter(
    (id) => !existingThemeIDs.includes(id)
  );
  // add new themes
  newThemeIDs.forEach((themeId) => {
    // remember the id of the last default theme
    if (data[themeId].isDefault) defaultThemeId = themeId;
    realmThemes.push(data[themeId]);
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
  return putConfigEntity(THEMEREALM_ID, themes);
}

/**
 * Delete theme by id
 * @param {String} themeId theme id
 * @returns {Promise} a promise that resolves to a themes object
 */
export async function deleteTheme(themeId) {
  const themes = await getConfigEntity(THEMEREALM_ID);
  const realmThemes = getRealmThemes(themes);
  const finalThemes = realmThemes.filter((theme) => theme._id !== themeId);
  if (realmThemes.length === finalThemes.length)
    throw new Error(`${themeId} not found`);
  themes.realm[getCurrentRealmName()] = realmThemes;
  return putConfigEntity(THEMEREALM_ID, themes);
}

/**
 * Delete theme by name
 * @param {String} themeName theme name
 * @returns {Promise} a promise that resolves to a themes object
 */
export async function deleteThemeByName(themeName) {
  const themes = await getConfigEntity(THEMEREALM_ID);
  const realmThemes = getRealmThemes(themes);
  const finalThemes = realmThemes.filter((theme) => theme.name !== themeName);
  if (realmThemes.length === finalThemes.length)
    throw new Error(`${themeName} not found`);
  themes.realm[getCurrentRealmName()] = finalThemes;
  return putConfigEntity(THEMEREALM_ID, themes);
}

/**
 * Delete all themes
 * @returns {Promise} a promise that resolves to an array of themes
 */
export async function deleteThemes() {
  const themes = await getConfigEntity(THEMEREALM_ID);
  themes.realm[getCurrentRealmName()] = [];
  return putConfigEntity(THEMEREALM_ID, themes);
}
