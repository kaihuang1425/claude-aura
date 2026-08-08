// Extracted from theme-core.mjs. Public API is re-exported by scripts/theme-core.mjs.
import path from "node:path";
import { fileURLToPath } from "node:url";

export const AURA_VERSION = "0.3.0";
export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const THEMES_DIR = path.join(PROJECT_ROOT, "themes");
export const THEME_REGISTRY_PATH = path.join(THEMES_DIR, "registry.json");
export const THEME_KIT_FILENAME = "theme.json";
// Built-in and legacy schema-v1 theme metadata stays deliberately small and
// release-authored in these three locales.
export const SUPPORTED_LOCALES = Object.freeze(["en", "zh-CN", "zh-HKTW"]);
// Studio-authored themes may opt into any interface locale. Presence in both
// localized maps is the portable support declaration; English is the required
// runtime fallback.
export const STUDIO_METADATA_LOCALES = Object.freeze([
  "en", "hi", "es", "fr", "id", "ja", "ko", "pt-BR", "de", "it", "vi", "pl", "tr", "zh-CN", "zh-HKTW",
]);
export const STUDIO_THEME_SCHEMA_VERSION = 4;
// Studio-authored kit documents. v2 predates the WO-21 greeting surface; v3
// adds the optional newChatGreetingStyle; v4 makes localized metadata sparse
// and user-selected. Older Studio documents normalize to v4 in memory. Legacy
// hand-authored kits stay schemaVersion 1 and load through the registry path.
export const STUDIO_KIT_SCHEMA_VERSIONS = new Set([2, 3, 4]);
// WO-21 new-chat greeting style allowlists. The portable theme carries only
// presentation; personal phrases and names stay host-owned and never enter here.
export const GREETING_FONT_CATEGORIES = new Set([
  "system-sans", "humanist-sans", "rounded-sans", "editorial-serif",
]);
export const GREETING_COLOR_ROLES = new Set(["primary", "accent"]);
export const GREETING_ALIGNMENTS = new Set(["start", "center", "end"]);
export const GREETING_DECORATIONS = new Set(["none", "underline", "hairline", "glow"]);
export const GREETING_MARK_SOURCES = new Set(["none", "native", "compact"]);
export const GREETING_FONT_WEIGHTS = new Set([300, 400, 500, 600, 650, 700]);
// Host-owned greeting personalization bounds (never enter the portable theme).
export const GREETING_MAX_PHRASES = 12;
export const GREETING_MAX_PHRASE_SCALARS = 120;
export const GREETING_MAX_NAME_LENGTH = 40;
export const GREETING_MAX_COMPILED_BYTES = 2048;
export const GREETING_MAX_THEME_OVERRIDES = 64;
export const GREETING_PREFERENCE_SOURCES = new Set(["claude", "custom"]);
export const GREETING_THEME_OVERRIDE_MODES = new Set(["claude", "global", "custom"]);
export const STUDIO_MAX_LAYERS = 8;
export const STUDIO_MAX_HISTORY = 50;
export const STUDIO_MAX_PATCH_CHANGES = 16;
export const STUDIO_MAX_INSTANT_PROMPTS = 12;
export const INSTANT_PROMPT_LABEL_MAX_CHARS = 48;
export const INSTANT_PROMPT_TEXT_MAX_CHARS = 1200;
export const INSTANT_PROMPT_RUNTIME_TEXT_MAX_BYTES = 1536;
// These are the two logical Aura client sizes used by Studio's responsive
// framing presets. Legacy built-in artwork is resolved against the same sizes
// before it enters the native frame editor, so the first adjustment starts
// from the image users are already seeing rather than from scale 1.
export const STUDIO_FRAME_VIEWPORTS = Object.freeze({
  normal: Object.freeze({ width: 1180, height: 640 }),
  wide: Object.freeze({ width: 1560, height: 940 }),
});
export const STUDIO_FRAME_CONTENT_START = 280;
export const STUDIO_FONT_UI_STACKS = Object.freeze({
  "system-sans": "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
  "humanist-sans": "\"Segoe UI\", \"Hiragino Sans\", \"Yu Gothic UI\", system-ui, sans-serif",
  "rounded-sans": "\"Trebuchet MS\", \"Segoe UI\", system-ui, sans-serif",
});
export const STUDIO_FONT_DISPLAY_STACKS = Object.freeze({
  ...STUDIO_FONT_UI_STACKS,
  "editorial-serif": "ui-serif, Georgia, \"Times New Roman\", serif",
});
export const STUDIO_SHADOWS = Object.freeze({
  none: Object.freeze({ shadowSoft: "none", shadowElevated: "none" }),
  soft: Object.freeze({
    shadowSoft: "0 8px 28px rgb(0 0 0 / 0.08)",
    shadowElevated: "0 20px 60px rgb(0 0 0 / 0.18)",
  }),
  elevated: Object.freeze({
    shadowSoft: "0 12px 36px rgb(0 0 0 / 0.12)",
    shadowElevated: "0 28px 76px rgb(0 0 0 / 0.24)",
  }),
});
export const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  theme: "default",
  appearance: "system",
  image: null,
  // Per-user personal avatar: an absolute path to an image that overlays the
  // Claude account picture in the sidebar footer. `null` = keep Claude's own
  // avatar. Personal, never written into theme documents, exports, or packages.
  avatar: null,
  // Host-generated, device-local wide wordmark. The compiler accepts only a
  // validated 344x124 PNG below the fixed personal-wordmark data root.
  personalWordmark: null,
  imageOpacity: null,
  imagePosition: "center",
  imageZoom: 1,
  studioPreviewCrops: {},
  reduceMotion: false,
  // Host-owned greeting personalization. `null` = use Claude's native greeting.
  // Personal phrases/name never enter theme documents, exports, or packages.
  greetingPreferences: null,
});

export const LEGACY_REQUIRED_TOKENS = [
  "--bg-000",
  "--bg-100",
  "--bg-200",
  "--text-000",
  "--text-200",
  "--text-400",
  "--accent-brand",
  "--border-200",
  "--claude-background-color",
  "--claude-foreground-color",
];
export const REQUIRED_SEMANTIC_TOKENS = Object.freeze([
  "--aura-background-primary",
  "--aura-background-secondary",
  "--aura-sidebar-background",
  "--aura-sidebar-text-primary",
  "--aura-sidebar-text-muted",
  "--aura-sidebar-selected",
  "--aura-sidebar-indicator",
  "--aura-panel-background",
  "--aura-elevated-surface",
  "--aura-overlay-background",
  "--aura-text-primary",
  "--aura-text-secondary",
  "--aura-text-muted",
  "--aura-text-disabled",
  "--aura-text-on-accent",
  "--aura-accent-primary",
  "--aura-accent-secondary",
  "--aura-border-subtle",
  "--aura-border-emphasis",
  "--aura-focus-ring",
  "--aura-composer-background",
  "--aura-card-background",
  "--aura-hover-surface",
  "--aura-selected-surface",
  "--aura-disabled-surface",
  "--aura-destructive",
  "--aura-success",
  "--aura-warning",
  "--aura-info",
]);
export const REQUIRED_SEMANTIC_INPUTS = Object.freeze([
  "--aura-background-primary",
  "--aura-background-secondary",
  "--aura-sidebar-background",
  "--aura-panel-background",
  "--aura-elevated-surface",
  "--aura-text-primary",
  "--aura-text-secondary",
  "--aura-text-muted",
  "--aura-text-on-accent",
  "--aura-accent-primary",
  "--aura-accent-secondary",
  "--aura-border-emphasis",
  "--aura-composer-background",
  "--aura-card-background",
  "--aura-destructive",
  "--aura-success",
  "--aura-warning",
]);
export const IMAGE_TYPES = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".avif", "image/avif"],
]);
export const ARTWORK_TYPES = new Map([
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
]);
export const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
// Personal avatars are small display elements (~40px), so cap them far below the
// wallpaper. Like the wallpaper, the avatar is excluded from the chrome budget
// but still ships inside the payload, so keep it lean.
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const MAX_PERSONAL_WORDMARK_BYTES = 256 * 1024;
export const MAX_ARTWORK_BYTES = 3 * 1024 * 1024;
export const MAX_USER_RASTER_ARTWORK_BYTES = 400_000;
export const MAX_USER_ARTWORK_TOTAL_BYTES = 1_400_000;
export const MAX_CHROME_PAYLOAD_BYTES = 65_000;
export const WINDOWS_TRANSIENT_FILESYSTEM_CODES = Object.freeze([
  "EACCES",
  "EBUSY",
  "EEXIST", // Antivirus/indexer races can briefly retain the previous rename target.
  "EPERM",
  "UNKNOWN",
]);
export const WINDOWS_FILESYSTEM_RETRY_DELAYS_MS = Object.freeze([12, 30, 60, 120, 240]);
export const HEX_COLOR = /^#[0-9a-f]{6}$/i;
export const THEME_ID_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;
export const FROZEN_BUILTIN_THEME_IDS = new Set([
  "default", "japanese-film-editorial", "korean-prestige", "cartoon-studio",
  "anime-twilight", "study-library", "japanese-idol", "korean-idol",
]);
export const BUILTIN_BRAND_MARK_ASSETS = Object.freeze({
  "japanese-film-editorial": "assets/theme-art/japanese-film-editorial/brand-mark.svg",
  "korean-prestige": "assets/theme-art/korean-prestige/brand-mark.svg",
  "japanese-idol": "assets/theme-art/japanese-idol/brand-mark.svg",
});
export const BUILTIN_GREETING_MARK_ASSETS = Object.freeze({
  ...BUILTIN_BRAND_MARK_ASSETS,
  "study-library": "assets/theme-art/study-library/launcher-mark.png",
});
export const BUILTIN_BRAND_WORDMARK_ASSETS = Object.freeze({
  ...Object.fromEntries([...FROZEN_BUILTIN_THEME_IDS].map((themeId) => [
    themeId,
    Object.freeze({
      light: `assets/theme-art/${themeId}/brand-wordmark-light.png`,
      dark: `assets/theme-art/${themeId}/brand-wordmark-dark.png`,
      minWidth: 136,
      width: 160,
    }),
  ])),
});
export const DEFAULT_LAUNCHER_STYLE = Object.freeze({
  asset: "assets/theme-art/default/launcher-mark.png",
  surface: "#2F2937",
  surfaceHover: "#3B3346",
  foreground: "#F4DFBB",
  accent: "#D66D4B",
  border: "#655C70",
  radius: 16,
  borderWidth: 2,
});
export const BUILTIN_LAUNCHER_ASSET_PATTERN = /^assets\/theme-art\/([a-z][a-z0-9-]{1,39})\/launcher-mark\.png$/;
export const USER_LAUNCHER_ASSET_PATTERN = /^launcher-mark\.png$/;
export const USER_ARTWORK_PATH_PATTERN = /^(?:background|hero|corner-top-right|corner-bottom|card-[1-3]|brand-mark)\.(?:png|webp|avif)$/;
export const STUDIO_ARTWORK_PATH_PATTERN = /^artwork\/layer-[a-f0-9]{32}\.webp$/;
export const STUDIO_LAYER_ID_PATTERN = /^layer-[a-f0-9]{32}$/;
export const STUDIO_INSTANT_PROMPT_ID_PATTERN = /^prompt-[a-f0-9]{32}$/;
export const STUDIO_SESSION_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export const STUDIO_COLOR_TOKENS = Object.freeze({
  canvas: "--aura-background-primary",
  sidebar: "--aura-sidebar-background",
  surface: "--aura-panel-background",
  text: "--aura-text-primary",
  accent: "--aura-accent-primary",
  border: "--aura-border-emphasis",
});
export const STUDIO_SHARED_TOKENS = new Set([
  "fontUi", "fontDisplay", "radius", "blur", "shadow", "backgroundScope",
  "promptWidth", "promptX", "promptY",
  "launcherSurface", "launcherSurfaceHover", "launcherForeground", "launcherAccent",
  "launcherBorder", "launcherRadius", "launcherBorderWidth",
]);
export const STUDIO_RECIPE_CONTROL_OVERRIDES = new Set(["fontUi", "fontDisplay", "radius", "shadow"]);
export const STUDIO_LAYER_ROLES = new Set(["background", "hero", "corner", "decoration"]);
export const STUDIO_LAYER_APPEARANCES = new Set(["all", "light", "dark"]);
export const STUDIO_LAYER_CONTEXTS = new Set(["all", "new-chat", "conversation"]);
export const STUDIO_LAYER_VIEWPORTS = new Set(["all", "normal", "wide"]);
export const STUDIO_LAYER_MASKS = new Set(["none", "soft-right"]);
export const STUDIO_LAYER_MOBILE = new Set(["keep", "reduce", "hide"]);
export const STUDIO_LAYER_ANCHORS = new Set([
  "top-left", "top", "top-right", "left", "center", "right", "bottom-left", "bottom", "bottom-right",
]);
export const STUDIO_LAYER_SLOTS = new Set([
  "background", "hero", "corner-top-right", "corner-bottom", "card-1", "card-2", "card-3", "brand-mark",
]);
export const STUDIO_STATE_FILENAME = ".editor-state.json";
export const AVIF_BRANDS = new Set(["avif", "avis"]);
export const ANIMATED_AVIF_BRANDS = new Set(["avis"]);
