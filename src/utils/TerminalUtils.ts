import {
  FRODO_COLOR_THEME_ENV_KEY,
  resolveThemeMode,
  theme,
  themeForMode,
} from './ColorTheme';
import {
  detectTerminalBackgroundRgb,
  matchBackgroundPreset,
} from './TerminalBackgroundDetection';
import {
  ALL_ANSI_COLOR_NAMES,
  contrastRatio,
  TerminalContrastFilter,
} from './TerminalContrast';

export type Terminal = {
  theme: typeof theme;
  themeForMode: typeof themeForMode;
  resolveThemeMode: typeof resolveThemeMode;
  FRODO_COLOR_THEME_ENV_KEY: typeof FRODO_COLOR_THEME_ENV_KEY;
  contrastRatio: typeof contrastRatio;
  TerminalContrastFilter: typeof TerminalContrastFilter;
  ALL_ANSI_COLOR_NAMES: typeof ALL_ANSI_COLOR_NAMES;
  detectTerminalBackgroundRgb: typeof detectTerminalBackgroundRgb;
  matchBackgroundPreset: typeof matchBackgroundPreset;
};

export default (): Terminal => ({
  theme,
  themeForMode,
  resolveThemeMode,
  FRODO_COLOR_THEME_ENV_KEY,
  contrastRatio,
  TerminalContrastFilter,
  ALL_ANSI_COLOR_NAMES,
  detectTerminalBackgroundRgb,
  matchBackgroundPreset,
});
