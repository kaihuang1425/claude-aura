// Aura theme-core public API barrel.
// Implementation lives in ./theme-core/*.mjs; this file re-exports the stable surface.

export {
  AURA_VERSION,
  PROJECT_ROOT,
  THEMES_DIR,
  THEME_REGISTRY_PATH,
  THEME_KIT_FILENAME,
  SUPPORTED_LOCALES,
  STUDIO_THEME_SCHEMA_VERSION,
  STUDIO_MAX_LAYERS,
  STUDIO_MAX_HISTORY,
  STUDIO_MAX_PATCH_CHANGES,
  STUDIO_FONT_UI_STACKS,
  STUDIO_FONT_DISPLAY_STACKS,
  STUDIO_SHADOWS,
  DEFAULT_CONFIG,
  BUILTIN_BRAND_MARK_ASSETS,
  BUILTIN_BRAND_WORDMARK_ASSETS,
  REQUIRED_SEMANTIC_TOKENS,
} from "./theme-core/constants.mjs";
export {
  validateTheme,
  normalizeLocale,
} from "./theme-core/validation.mjs";
export {
  readThemeKit,
  readThemeRegistry,
  listThemes,
  readConfig,
  writeConfig,
} from "./theme-core/registry.mjs";
export {
  resolveArtworkLayers,
  resolveArtwork,
  resolveBrandWordmark,
} from "./theme-core/artwork.mjs";
export {
  compileTheme,
  buildPayloadFromCompiled,
  buildPayload,
} from "./theme-core/compile.mjs";
export {
  createThemeCopy,
  beginThemeEdit,
  setThemeToken,
  setThemeLayer,
  applyThemePatch,
  attachThemeLayerImage,
  removeThemeLayer,
  moveThemeLayer,
  undoThemeEdit,
  redoThemeEdit,
  saveThemeEdit,
  discardThemeEdit,
  deleteUserTheme,
  readStudioState,
  hydrateStudioDraft,
  executeStudioRequest,
  studioStyleFromTheme,
} from "./theme-core/studio.mjs";
