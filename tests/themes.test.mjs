// themes tests. Extracted from the former monolithic tests/run-tests.mjs.
import { test, runIfMain } from "./support/harness.mjs";
import {
  AURA_VERSION,
  DEFAULT_CONFIG,
  PROJECT_ROOT,
  REQUIRED_SEMANTIC_TOKENS,
  STUDIO_FONT_DISPLAY_STACKS,
  STUDIO_FONT_UI_STACKS,
  STUDIO_MAX_LAYERS,
  STUDIO_PREVIEW_MASTERS,
  STUDIO_SHADOWS,
  STUDIO_THEME_SCHEMA_VERSION,
  THEME_IDS,
  assert,
  buildAuraIcon,
  buildLauncherAssets,
  buildPayload,
  buildPayloadFromCompiled,
  compileTheme,
  contrast,
  crypto,
  deliverableFiles,
  executeStudioRequest,
  fs,
  hslToRgb,
  hydrateStudioDraft,
  listThemes,
  luminance,
  normalizeLocale,
  os,
  path,
  readPayloadSettings,
  readThemeKit,
  readThemeRegistry,
  resolveArtwork,
  run,
  spawnSync,
  validateTheme,
  writeConfig,
  zipEntryNames,
} from "./support/context.mjs";
test("registry exposes exactly Default plus the seven requested themes", async () => {
  const registry = await readThemeRegistry();
  const themes = await listThemes();
  assert.equal(registry.defaultTheme, "default");
  assert.deepEqual(themes.map((theme) => theme.name), THEME_IDS);
  assert.equal(new Set(themes.map((theme) => theme.name)).size, 8);
  assert.deepEqual(registry.legacyAliases, {
    midnight: "default",
    ember: "japanese-film-editorial",
    forest: "study-library",
    sakura: "japanese-idol",
  });
  for (const theme of themes) {
    assert.deepEqual(Object.keys(theme.launcher).sort(), [
      "accent", "asset", "border", "borderWidth", "foreground", "radius", "surface", "surfaceHover",
    ]);
    assert.equal(theme.launcher.asset, `assets/theme-art/${theme.name}/launcher-mark.png`);
    for (const key of ["surface", "surfaceHover", "foreground", "accent", "border"]) {
      assert.match(theme.launcher[key], /^#[0-9A-F]{6}$/, `${theme.name} launcher ${key} is invalid`);
    }
    assert(theme.launcher.radius >= 8 && theme.launcher.radius <= 24);
    assert(theme.launcher.borderWidth >= 1 && theme.launcher.borderWidth <= 3);
    const mark = await fs.readFile(path.join(PROJECT_ROOT, theme.launcher.asset));
    assert(mark.length > 0 && mark.length < 400_000, `${theme.name} launcher mark exceeds its raster budget`);
    assert.deepEqual([...mark.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(mark.readUInt32BE(16), 96, `${theme.name} launcher mark width must be 96px`);
    assert.equal(mark.readUInt32BE(20), 96, `${theme.name} launcher mark height must be 96px`);
    assert.equal(mark[25], 6, `${theme.name} launcher mark must retain RGBA transparency`);
  }
  assert.deepEqual(themes.find((theme) => theme.name === "cartoon-studio")?.artworkLayers, [
    {
      path: "assets/theme-art/cartoon-studio/background.webp",
      position: "center",
      size: "cover",
      mobile: "keep",
      opacity: 0.5,
      mask: "none",
      role: "background",
      appearance: "light",
      contextOverrides: null,
    },
    {
      path: "assets/theme-art/cartoon-studio/dark-background.webp",
      position: "center",
      size: "cover",
      mobile: "keep",
      opacity: 0.5,
      mask: "none",
      role: "background",
      appearance: "dark",
      contextOverrides: null,
    },
    {
      path: "assets/theme-art/cartoon-studio/hero.webp",
      position: "right bottom",
      size: "min(26vw, 420px) auto",
      mobile: "reduce",
      opacity: 0.95,
      mask: "none",
      role: "hero",
      appearance: null,
      contextOverrides: {
        conversation: { hidden: true },
        other: { hidden: true },
      },
    },
  ]);
  assert.deepEqual(themes.find((theme) => theme.name === "anime-twilight")?.artworkLayers, [
    {
      path: "assets/theme-art/anime-twilight/background.webp",
      position: "center",
      size: "cover",
      mobile: "keep",
      opacity: 0.62,
      mask: "none",
      role: "background",
      appearance: null,
      contextOverrides: null,
    },
  ]);
  assert.deepEqual(themes.find((theme) => theme.name === "study-library")?.artworkLayers, [
    {
      path: "assets/theme-art/study-library/background.webp",
      position: "center",
      size: "cover",
      mobile: "keep",
      opacity: 0.4,
      mask: "none",
      role: "background",
      appearance: "light",
      contextOverrides: null,
    },
    {
      path: "assets/theme-art/study-library/dark-background.webp",
      position: "center",
      size: "cover",
      mobile: "keep",
      opacity: 0.4,
      mask: "none",
      role: "background",
      appearance: "dark",
      contextOverrides: null,
    },
    {
      path: "assets/theme-art/study-library/corner-bottom.webp",
      position: "left bottom",
      size: "min(20vw, 320px) auto",
      mobile: "hide",
      opacity: 0.6,
      mask: "none",
      role: "decoration",
      appearance: null,
      contextOverrides: null,
    },
  ]);
  const japaneseIdol = themes.find((theme) => theme.name === "japanese-idol");
  assert.equal(japaneseIdol.light.wallpaper.surfaceAlpha, 0.72);
  assert.equal(japaneseIdol.dark.wallpaper.surfaceAlpha, 0.76);
  assert.deepEqual(japaneseIdol.artworkLayers, [
    {
      path: "assets/theme-art/kawaii-idol/background.webp",
      position: "center",
      size: "cover",
      mobile: "keep",
      opacity: 0.5,
      mask: "none",
      role: "background",
      appearance: "light",
      contextOverrides: null,
    },
    {
      path: "assets/theme-art/kawaii-idol/hero.webp",
      position: "right top",
      size: "auto min(74%, 660px)",
      mobile: "reduce",
      opacity: 0.92,
      mask: "soft-right",
      role: "hero",
      appearance: "light",
      contextOverrides: { conversation: { hidden: true }, other: { hidden: true } },
    },
    {
      path: "assets/theme-art/kawaii-idol/dark-new-chat.webp",
      position: "right top",
      size: "cover",
      mobile: "keep",
      opacity: 0.82,
      mask: "none",
      role: "background",
      appearance: "dark",
      contextOverrides: { conversation: { hidden: true }, other: { hidden: true } },
    },
    {
      path: "assets/theme-art/kawaii-idol/dark-conversation.webp",
      position: "right top",
      size: "cover",
      mobile: "keep",
      opacity: 0.82,
      mask: "none",
      role: "background",
      appearance: "dark",
      contextOverrides: { "new-chat": { hidden: true }, other: { hidden: true } },
    },
  ]);
  const koreanIdol = themes.find((theme) => theme.name === "korean-idol");
  assert.deepEqual(koreanIdol.newChatLayout, {
    widthRatio: 0.76,
    offsetXRatio: -0.07,
    offsetYRatio: 0,
  });
  assert.deepEqual(koreanIdol.artworkLayers, [
    {
      path: "assets/theme-art/korean-idol/light-scene.webp",
      position: "center",
      size: "cover",
      mobile: "keep",
      opacity: 1,
      mask: "none",
      role: "background",
      appearance: "light",
      contextOverrides: null,
    },
    {
      path: "assets/theme-art/korean-idol/hero.webp",
      position: "right top",
      size: "min(38vw, 620px) auto",
      mobile: "reduce",
      opacity: 0.96,
      mask: "soft-right",
      role: "hero",
      appearance: "light",
      contextOverrides: {
        conversation: { hidden: true },
        other: { hidden: true },
      },
    },
    {
      path: "assets/theme-art/korean-idol/dark-new-chat.webp",
      position: "right top",
      size: "cover",
      mobile: "keep",
      opacity: 0.78,
      mask: "none",
      role: "background",
      appearance: "dark",
      contextOverrides: { conversation: { hidden: true }, other: { hidden: true } },
    },
    {
      path: "assets/theme-art/korean-idol/dark-conversation.webp",
      position: "right top",
      size: "cover",
      mobile: "keep",
      opacity: 0.78,
      mask: "none",
      role: "background",
      appearance: "dark",
      contextOverrides: { "new-chat": { hidden: true }, other: { hidden: true } },
    },
  ]);
});

test("every theme provides complete semantic roles and a distinct component profile", async () => {
  const themes = await listThemes();
  const profiles = [];
  for (const theme of themes) {
    assert.equal(theme.variant, theme.name);
    assert(theme.swatches.length >= 3);
    assert(theme.typography.ui);
    assert(theme.typography.display);
    assert(theme.typography.body);
    assert(theme.typography.mono);
    for (const mode of ["light", "dark"]) {
      for (const token of REQUIRED_SEMANTIC_TOKENS) {
        assert(token in theme[mode].semantic, `${theme.name}/${mode} is missing ${token}`);
        assert(token in theme[mode].tokens, `${theme.name}/${mode} did not emit ${token}`);
        assert.match(theme[mode].semantic[token], /^\d{1,3}(?:\.\d+)?\s+\d{1,3}(?:\.\d+)?%\s+\d{1,3}(?:\.\d+)?%$/, `${theme.name}/${mode} emitted an invalid ${token}`);
        assert.equal(theme[mode].tokens[token], theme[mode].semantic[token], `${theme.name}/${mode} did not preserve ${token}`);
      }
      assert(theme[mode].wallpaper.surfaceAlpha >= 0.35);
      assert(theme[mode].wallpaper.sidebarAlpha >= 0.62);
      assert(theme[mode].wallpaper.artOpacity <= 0.46);
    }
    profiles.push(JSON.stringify({ typography: theme.typography, shape: theme.shape, effects: theme.effects }));
  }
  const legacyDefault = JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, "themes", "default.json"), "utf8"));
  delete legacyDefault.launcher;
  assert.deepEqual(validateTheme(legacyDefault).launcher, {
    asset: "assets/theme-art/default/launcher-mark.png",
    surface: "#2F2937",
    surfaceHover: "#3B3346",
    foreground: "#F4DFBB",
    accent: "#D66D4B",
    border: "#655C70",
    radius: 16,
    borderWidth: 1,
  }, "A theme without launcher metadata must receive the safe Aura default");
  assert.throws(() => validateTheme({
    ...legacyDefault,
    launcher: { asset: "https://example.com/launcher.png" },
  }), /launcher.*asset/, "Launcher assets must remain local and allowlisted");
  assert.throws(() => validateTheme({
    ...legacyDefault,
    launcher: { surface: "#FFFFFF", surfaceHover: "#FFFFFF", foreground: "#FFFFFF" },
  }), /4\.5:1 contrast/, "Launcher text must remain readable at rest and on hover");
  assert.equal(new Set(profiles).size, THEME_IDS.length, "Every theme must have a distinct typography/shape/effects profile");
  const baseCss = await fs.readFile(path.join(PROJECT_ROOT, "assets", "base.css"), "utf8");
  const variants = await fs.readFile(path.join(PROJECT_ROOT, "assets", "theme-variants.css"), "utf8");
  const interactiveSelector = 'html.claude-aura :is(button, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"])';
  const broadLinkSelector = 'html.claude-aura :is(button, [role="button"], a, [role="link"], [role="tab"], [role="menuitem"], [role="option"])';
  assert(baseCss.includes(`${interactiveSelector} {`), "Shared interactive typography rule is missing");
  const controlSelector = 'html.claude-aura :is(button, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"])';
  const controlStart = baseCss.indexOf(`${controlSelector},`);
  assert(controlStart >= 0, "Shared semantic-control rule is missing");
  const controlBody = baseCss.slice(controlStart, baseCss.indexOf("}", controlStart));
  assert.match(controlBody, /border-radius:\s*var\(--aura-control-radius\)/);
  for (const state of [":not([disabled]):not([aria-disabled=\"true\"]):hover", ":not([disabled]):not([aria-disabled=\"true\"]):active", ":is([disabled], [aria-disabled=\"true\"])"]) {
    assert(baseCss.includes(`${controlSelector}${state}`), `Shared semantic controls lack ${state} styling`);
    assert(!baseCss.includes(`${broadLinkSelector}${state}`), `Bare prose links must not receive ${state} control styling`);
  }
  assert.match(baseCss, /:is\(hr, \[role="separator"\]\)/);
  for (const status of ["info", "success", "warning", "loading"]) assert(baseCss.includes(`[data-status="${status}"]`), `${status} status styling is missing`);
  assert.match(baseCss, /\[role="progressbar"\]/);
  assert.match(baseCss, /\[data-settings-panel\]/);
  assert.match(baseCss, /\[data-testid\*="workspace"\]/);
  assert.match(baseCss, /\[data-testid\*="quick-action"\]/);
  assert(!/:is\([^{}]*(?:button|\[role="button"\])[^{}]*\)\s+:is\(svg, \[data-icon\]\)\s*\{[^}]*\b(?:background|box-shadow|border-radius|transform)\s*:/s.test(`${baseCss}\n${variants}`),
    "Aura must not draw boxes, shadows, or transforms around Claude's nested icons");
  assert(baseCss.includes("[data-claude-aura-sidebar]"), "Live sidebar styling must use the semantic Aura marker");
  const sidebarIconStart = baseCss.indexOf("html.claude-aura [data-claude-aura-sidebar] svg {");
  assert(sidebarIconStart >= 0, "The live sidebar must bind its icons and native SVG logo to the label foreground");
  const sidebarIconBody = baseCss.slice(sidebarIconStart, baseCss.indexOf("}", sidebarIconStart));
  assert.match(sidebarIconBody, /color:\s*inherit\s*!important/,
    "Live sidebar icons and native SVG logo must inherit their exact computed foreground");
  assert(!/\b(?:fill|stroke)\s*:/.test(sidebarIconBody),
    "Sidebar foreground synchronization must not overwrite Claude's native icon paint");
  assert(!/\bfilter\s*:/.test(sidebarIconBody),
    "Sidebar foreground synchronization must preserve the approved native brand treatment");
  assert(!baseCss.includes(".dframe-sidebar"), "Live sidebar styling must not depend on Claude's unstable class name");
  assert(!variants.includes(".dframe-sidebar"), "Theme variants must use the semantic sidebar marker");
  const hoverStart = baseCss.indexOf(`${controlSelector}:not([disabled]):not([aria-disabled="true"]):hover`);
  const hoverBody = baseCss.slice(hoverStart, baseCss.indexOf("}", hoverStart));
  assert(hoverStart >= 0 && /background:\s*hsl\(var\(--aura-hover-surface\)/.test(hoverBody));
  assert.match(hoverBody, /color:\s*hsl\(var\(--aura-text-primary\)\)/);
  assert(!/border-color:[^;]*--aura-accent-primary/.test(hoverBody));
  assert.match(hoverBody, /transform:\s*none/);
  const selectedStart = baseCss.indexOf('html.claude-aura :is(button, a[href], [role="button"]');
  assert(selectedStart >= 0, "Selected states must be scoped to interactive elements");
  assert(!/html\.claude-aura\s+:is\(\[aria-current/.test(baseCss), "Bare state wrappers must not receive selected styling");
  const focusStart = baseCss.indexOf("html.claude-aura :focus-visible");
  assert(focusStart > selectedStart,
    "Visible focus styling must follow hover/selected/active styling");
  const focusBody = baseCss.slice(focusStart, baseCss.indexOf("}", focusStart));
  assert.match(focusBody, /outline:\s*1px solid hsl\(var\(--aura-focus-ring\) \/ 0\.72\)/,
    "Focus styling must use the softened one-pixel ring");
  assert.match(focusBody, /box-shadow:\s*0 0 0 4px hsl\(var\(--aura-focus-ring\) \/ 0\.14\)/,
    "Focus styling must retain a low-alpha halo");
  for (const id of THEME_IDS) {
    assert(variants.includes(`data-claude-aura-theme="${id}"] { --aura-state-shadow:`),
      `${id} lacks its restrained state shadow`);
  }
  const exactArtworkSelector = 'html.claude-aura:is([data-claude-aura-theme="cartoon-studio"], [data-claude-aura-theme="anime-twilight"], [data-claude-aura-theme="study-library"]) #claude-aura-backdrop .claude-aura-theme-art-layer';
  assert(variants.includes(`${exactArtworkSelector} {\n  animation: none;\n}`),
    "Recipe-defined layered themes must preserve their exact per-layer opacity");
  const studyCornerSelector = 'html.claude-aura[data-claude-aura-theme="study-library"] #claude-aura-backdrop [data-art-role="decoration"]';
  assert(variants.includes(`${studyCornerSelector} {\n  left: var(--aura-main-start, 0px);\n}`),
    "Study Library corner must anchor to the content edge instead of beneath the sidebar");
  assert(!variants.includes('.claude-aura-theme-art-layer + .claude-aura-theme-art-layer'),
    "Study Library must not offset an appearance-specific full-bleed background as if it were the corner vignette");
  assert(!variants.includes('[data-claude-aura-effective-mode="dark"] #claude-aura-backdrop [data-art-role="hero"]'),
    "Korean Idol dark mode must use dedicated scenes instead of dimming the light portrait");
  const koreanSidebarSelector = 'html.claude-aura[data-claude-aura-theme="korean-idol"] [data-claude-aura-sidebar]';
  const koreanSidebarStart = variants.indexOf(`${koreanSidebarSelector} {`);
  assert(koreanSidebarStart >= 0, "Korean Idol must expose its full-window art beneath one sidebar overlay");
  const koreanSidebarBody = variants.slice(koreanSidebarStart, variants.indexOf("}", koreanSidebarStart));
  assert.match(koreanSidebarBody, /--cds-page-bg:\s*transparent\s*!important/);
  assert.match(koreanSidebarBody, /background-color:\s*hsl\(var\(--aura-sidebar-background\) \/ var\(--aura-sidebar-alpha\)\)\s*!important/);
  const converter = await fs.readFile(path.join(PROJECT_ROOT, "scripts", "convert-theme-assets.mjs"), "utf8");
  assert(!converter.includes('src: "study-library.svg"'),
    "Study Library selector media must not derive from its retired procedural stand-in");
});

test("all theme text, focus colours, and accents clear contrast guardrails", async () => {
  const failures = [];
  for (const theme of await listThemes()) {
    for (const mode of ["light", "dark"]) {
      const tokens = theme[mode].semantic;
      const checks = [
        ["primary", "--aura-text-primary", "--aura-background-primary", 7],
        ["secondary", "--aura-text-secondary", "--aura-panel-background", 4.5],
        ["muted", "--aura-text-muted", "--aura-panel-background", 4.5],
        ["accent", "--aura-accent-primary", "--aura-background-primary", 3],
        ["on-accent", "--aura-text-on-accent", "--aura-accent-primary", 4.5],
        ["sidebar", "--aura-sidebar-text-primary", "--aura-sidebar-background", 7],
        ["hover", "--aura-text-primary", "--aura-hover-surface", 4.5],
        ["selected", "--aura-text-primary", "--aura-selected-surface", 4.5],
        ["sidebar-selected", "--aura-sidebar-text-primary", "--aura-sidebar-selected", 4.5],
        ["focus", "--aura-focus-ring", "--aura-background-primary", 3],
        ["focus-panel", "--aura-focus-ring", "--aura-panel-background", 3],
        ["focus-card", "--aura-focus-ring", "--aura-card-background", 3],
        ["sidebar-indicator", "--aura-sidebar-indicator", "--aura-sidebar-background", 3],
        ["destructive-card", "--aura-destructive", "--aura-card-background", 4.5],
        ["destructive-elevated", "--aura-destructive", "--aura-elevated-surface", 4.5],
        ["success-card", "--aura-success", "--aura-card-background", 4.5],
        ["success-elevated", "--aura-success", "--aura-elevated-surface", 4.5],
        ["warning-card", "--aura-warning", "--aura-card-background", 4.5],
        ["warning-elevated", "--aura-warning", "--aura-elevated-surface", 4.5],
        ["info-card", "--aura-info", "--aura-card-background", 4.5],
        ["info-elevated", "--aura-info", "--aura-elevated-surface", 4.5],
      ];
      for (const [label, foreground, background, minimum] of checks) {
        const ratio = contrast(tokens[foreground], tokens[background]);
        if (ratio < minimum) failures.push(`${theme.name}/${mode}: ${label} contrast ${ratio.toFixed(2)} is below ${minimum}:1`);
      }
    }
  }
  assert.equal(failures.length, 0, failures.join("\n"));
});

test("theme metadata localizes independently for English, Simplified Chinese, and Traditional Chinese", async () => {
  const [english, simplified, traditional] = await Promise.all([
    listThemes({ locale: "en" }),
    listThemes({ locale: "zh-CN" }),
    listThemes({ locale: "zh-TW" }),
  ]);
  assert.deepEqual(english.map((theme) => theme.name), THEME_IDS);
  assert.deepEqual(simplified.map((theme) => theme.name), THEME_IDS);
  assert.deepEqual(traditional.map((theme) => theme.name), THEME_IDS);
  assert.equal(english[0].label, "Default");
  assert.equal(simplified[0].label, "默认");
  assert.equal(traditional[0].label, "預設");
  assert.equal(normalizeLocale("zh-SG"), "zh-CN");
  assert.equal(normalizeLocale("zh-MO"), "zh-TW");
  assert.equal(normalizeLocale("zh_Hans_SG"), "zh-CN");
  assert.equal(normalizeLocale("zh_Hant_TW"), "zh-TW");
  assert.notEqual(simplified[1].description, traditional[1].description);
  for (const theme of [...simplified, ...traditional]) {
    assert(theme.label.trim());
    assert(theme.description.trim());
  }
});

test("Default is the persistent baseline and invalid saved IDs fall back safely", async () => {
  assert.equal(DEFAULT_CONFIG.theme, "default");
  assert.equal(DEFAULT_CONFIG.appearance, "system");
  const baseline = await compileTheme({
    configPath: path.join(PROJECT_ROOT, "config.example.json"),
    config: { ...DEFAULT_CONFIG, theme: "midnight" },
  });
  assert.equal(baseline.theme.name, "default");
  const unknown = await compileTheme({
    configPath: path.join(PROJECT_ROOT, "config.example.json"),
    config: { ...DEFAULT_CONFIG, theme: "missing-theme" },
  });
  assert.equal(unknown.theme.name, "default");
  assert.equal(unknown.settings.fallbackFrom, "missing-theme");
  assert.equal(unknown.effectiveConfig.theme, "default");
});

runIfMain(import.meta.url);
