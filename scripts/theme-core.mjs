// Aura theme-core public API barrel.
// Implementation lives in ./theme-core/*.mjs; this file re-exports the stable surface.

export {
  AURA_VERSION,
  PROJECT_ROOT,
  THEMES_DIR,
  THEME_REGISTRY_PATH,
  THEME_KIT_FILENAME,
  SUPPORTED_LOCALES,
  STUDIO_METADATA_LOCALES,
  STUDIO_THEME_SCHEMA_VERSION,
  STUDIO_KIT_SCHEMA_VERSIONS,
  GREETING_FONT_CATEGORIES,
  GREETING_COLOR_ROLES,
  GREETING_ALIGNMENTS,
  GREETING_DECORATIONS,
  GREETING_MARK_SOURCES,
  GREETING_FONT_WEIGHTS,
  STUDIO_MAX_LAYERS,
  STUDIO_MAX_HISTORY,
  STUDIO_MAX_PATCH_CHANGES,
  STUDIO_MAX_INSTANT_PROMPTS,
  INSTANT_PROMPT_LABEL_MAX_CHARS,
  INSTANT_PROMPT_TEXT_MAX_CHARS,
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
  validateNewChatGreetingStyle,
  validateInstantPrompts,
  normalizeLocale,
} from "./theme-core/validation.mjs";
export {
  INTERFACE_SURFACE_SPECS,
  validateInterfaceSurfaces,
  resolveInterfaceSurface,
  renderInterfaceSurfacesCss,
  promptFrameOverrides,
  validateLayerFilters,
  layerFilterCss,
} from "./theme-core/surface-overrides.mjs";
export {
  RESPONSIVE_LAYOUT_ID_PATTERN,
  RESPONSIVE_LAYOUT_LIMITS,
  LEGACY_RESPONSIVE_LAYOUTS,
  RESPONSIVE_ARTWORK_FIELDS,
  RESPONSIVE_GREETING_FIELDS,
  RESPONSIVE_PROMPT_FIELDS,
  RESPONSIVE_INSTANT_PROMPT_FIELDS,
  validateResponsiveLayouts,
  validateResponsiveFrames,
  createResponsiveResolver,
  resolveResponsiveFrame,
  insertResponsiveLayoutSet,
  upgradeStudioDocumentToResponsive,
} from "./theme-core/responsive-layouts.mjs";
export {
  readThemeKit,
  readThemeRegistry,
  listThemes,
  readConfig,
  writeConfig,
  resolvePersonalWordmark,
} from "./theme-core/registry.mjs";
export {
  resolveArtworkLayers,
  resolveArtwork,
  resolveBrandWordmark,
} from "./theme-core/artwork.mjs";
export {
  validateGreetingPreferences,
  validateGreetingShuffleState,
  validateGreetingPhrase,
  greetingPhraseDigest,
  resolveGreetingPhrases,
  resolveGreetingRuntime,
  DEFAULT_GREETING_PREFERENCES,
} from "./theme-core/greeting.mjs";
export { createInstantPromptController } from "./theme-core/instant-prompts.mjs";
export {
  compileTheme,
  buildPayloadFromCompiled,
  buildPayload,
  renderGreetingCss,
} from "./theme-core/compile.mjs";
export {
  buildTerminalTheme,
  exportTerminalThemePair,
  exportTerminalThemes,
  TERMINAL_THEME_SCHEMA,
} from "./theme-core/terminal.mjs";
export {
  CODE_ROLE_SIGNATURES,
  codeContextFromUrl,
  createInertCodeAdapter,
} from "./theme-core/code-adapter.mjs";
export {
  createThemeCopy,
  beginThemeEdit,
  setThemeToken,
  setThemeLayer,
  enableResponsiveLayouts,
  mutateResponsiveLayout,
  applyThemePatch,
  setGreetingPhrases,
  resetGreeting,
  attachThemeLayerImage,
  attachThemeSidebarIdentityMark,
  attachInstantPromptIcon,
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
  studioReframeCoverScale,
} from "./theme-core/studio.mjs";
