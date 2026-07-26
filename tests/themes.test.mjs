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
    borderWidth: 2,
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
  const roleSelectors = [
    '[data-aura-role="sidebar-primary"]',
    '[data-aura-role="sidebar-row"]',
    '[data-aura-role="sidebar-section"]',
    '[data-aura-role="sidebar-list"]',
    '[data-aura-role="sidebar-footer"]',
    '[data-aura-role="composer-shell"]',
    '[data-aura-role="composer-editor"]',
    '[data-aura-role="composer-toolbar"]',
    '[data-aura-role^="control-"]',
  ];
  for (const selector of roleSelectors) {
    assert(baseCss.includes(`html.claude-aura ${selector}`),
      `Fixed native-chrome role ${selector} has no baseline recipe`);
  }
  const sidebarRootSelector = 'html.claude-aura [data-claude-aura-sidebar]';
  const primarySelector = 'html.claude-aura [data-aura-role="sidebar-primary"]';
  const rowSelector = 'html.claude-aura [data-aura-role="sidebar-row"]';
  const footerSelector = 'html.claude-aura [data-aura-role="sidebar-footer"]';
  const composerSelector = 'html.claude-aura [data-aura-role="composer-shell"]';
  const editorSelector = 'html.claude-aura [data-aura-role="composer-editor"]';
  const nativeControlSelector = 'html.claude-aura [data-aura-role^="control-"]';
  const ruleBody = (selector) => {
    const start = baseCss.indexOf(`${selector} {`);
    assert(start >= 0, `${selector} is missing`);
    return baseCss.slice(start, baseCss.indexOf("}", start));
  };
  assert.match(ruleBody(sidebarRootSelector),
    /--text-100:\s*var\(--aura-sidebar-text-primary\)\s*!important/,
    "Claude's icon-font foreground token must follow the live sidebar label token");
  assert.match(ruleBody(sidebarRootSelector),
    /--pictogram-100:\s*var\(--aura-sidebar-text-primary\)\s*!important/,
    "Claude's sidebar pictograms must follow the live sidebar label token");
  assert.match(ruleBody(primarySelector), /background:[\s\S]*--aura-accent-primary/);
  assert.match(ruleBody(primarySelector), /--aura-text-on-accent/);
  assert.match(ruleBody(primarySelector), /--aura-role-fg:\s*var\(--aura-text-on-accent\)/);
  assert.match(ruleBody(primarySelector), /--aura-role-fg-2:\s*var\(--aura-text-on-accent\)/);
  assert.match(ruleBody(rowSelector), /--aura-role-fg:\s*var\(--aura-sidebar-text-primary\)/);
  assert.match(ruleBody(rowSelector), /--aura-role-fg-2:\s*var\(--aura-sidebar-text-muted\)/);
  assert.match(ruleBody(footerSelector), /--aura-role-fg:\s*var\(--aura-sidebar-text-primary\)/);
  assert.match(ruleBody(footerSelector), /--aura-role-fg-2:\s*var\(--aura-sidebar-text-muted\)/);
  assert.match(ruleBody(nativeControlSelector), /--aura-role-fg:\s*var\(--aura-text-primary\)/);
  assert.match(ruleBody(nativeControlSelector), /--aura-role-fg-2:\s*var\(--aura-text-secondary\)/);
  assert.match(
    baseCss,
    /\[data-aura-f="p"\]\s*\{[^}]*color:\s*hsl\(var\(--aura-role-fg\)\)\s*!important/s,
    "The discovered primary label must paint from its role's current foreground",
  );
  assert.match(baseCss,
    /\[data-aura-f="s"\]\s*\{[^}]*color:\s*hsl\(var\(--aura-role-fg-2\)\)\s*!important/s,
    "Secondary labels must retain hierarchy through a separately paired foreground");
  assert.match(baseCss,
    /\[data-aura-bg\]\s*\{[^}]*background-color:\s*transparent\s*!important/s,
    "Only the discovered label paint chain may clear a native inner surface");
  assert(!baseCss.match(/\[data-aura-role(?:\^)?="(?:sidebar-primary|control-[^"]+)"\][^{}]*\*\s*\{[^}]*background:/s),
    "Role styling must not erase every nested background, badge, or painted icon");
  assert(!baseCss.includes('[data-aura-role^="sidebar-"] > :first-child'),
    "Leading-icon fallback must not leak into section or list roles without a paired foreground");
  assert(!baseCss.includes('[data-claude-aura-sidebar] svg'),
    "Sidebar icon correction must remain role-scoped instead of recoloring every native SVG");
  assert(baseCss.includes(`${primarySelector}:not([disabled]):not([aria-disabled="true"]):hover`));
  assert(baseCss.includes(`${primarySelector}:not([disabled]):not([aria-disabled="true"]):active`));
  assert(baseCss.includes(`${rowSelector}:where(:not([disabled]):not([aria-disabled="true"])):hover`));
  assert(baseCss.includes(`${rowSelector}:where(:not([disabled]):not([aria-disabled="true"])):active`));
  assert.match(
    ruleBody(`${rowSelector}:where(:not([disabled]):not([aria-disabled="true"])):hover`),
    /--aura-role-fg-2:\s*var\(--aura-sidebar-text-primary\)/,
    "Hovered row secondary labels must move to the foreground paired with their darker surface",
  );
  assert.match(
    ruleBody(`${rowSelector}:where(:not([disabled]):not([aria-disabled="true"])):active`),
    /--aura-role-fg-2:\s*var\(--aura-sidebar-text-primary\)/,
    "Pressed row secondary labels must move to the foreground paired with their darker surface",
  );
  assert(baseCss.includes(
    "linear-gradient(hsl(var(--aura-hover-surface) / 0.10), hsl(var(--aura-hover-surface) / 0.10))",
  ),
    "Primary hover must retain readable text-on-accent contrast across every Light/Dark recipe");
  assert.match(baseCss, /\[data-aura-role="sidebar-row"\]:is\(\s*\[aria-current\]:not\(\[aria-current="false"\]\),\s*\[aria-selected="true"\],\s*\[data-state="active"\]/s,
    "Current sidebar rows must use native state attributes");
  assert.match(ruleBody(composerSelector), /--aura-composer-background/);
  assert.match(ruleBody(composerSelector), /--aura-shadow-elevated/);
  assert(baseCss.includes(`${composerSelector}:focus-within`),
    "Composer focus must be carried by its discovered outer shell");
  assert.match(ruleBody(editorSelector), /background:\s*transparent\s*!important/);
  assert.match(ruleBody(editorSelector), /box-shadow:\s*none\s*!important/);
  for (const state of [
    ':where(:not([disabled]):not([aria-disabled="true"])):hover',
    ':where(:not([disabled]):not([aria-disabled="true"])):active',
    ':is([aria-pressed="true"], [aria-checked="true"], [data-state="checked"], [data-state="active"])',
    ':is([disabled], [aria-disabled="true"])',
  ]) {
    assert(baseCss.includes(`${nativeControlSelector}${state}`),
      `Role-scoped composer controls lack ${state} styling`);
  }
  assert.match(baseCss,
    /\[data-aura-role\^="control-"\]:is\(\[aria-pressed="true"[^}]+\{[^}]*--aura-role-fg:\s*var\(--aura-text-on-accent\)[^}]*background:\s*hsl\(var\(--aura-accent-primary\)\)\s*!important/s,
    "Selected composer controls must keep one paired accent foreground and background");
  assert.match(baseCss,
    /\[data-aura-role\^="control-"\]:is\(\[aria-pressed="true"[^}]+\{[^}]*--aura-role-fg-2:\s*var\(--aura-text-on-accent\)/s,
    "Selected composer controls must promote secondary labels onto the accent foreground");
  assert(
    baseCss.indexOf(`${nativeControlSelector}:is([aria-pressed="true"]`)
      > baseCss.indexOf(`${nativeControlSelector}:where(:not([disabled]):not([aria-disabled="true"])):hover`),
    "Equal-specificity selected control states must follow hover so selected backgrounds are not downgraded",
  );
  assert(!baseCss.includes('.input-box') && !baseCss.includes('[data-testid="composer"]')
      && !baseCss.includes('[data-testid="chat-input"]'),
    "Composer material must not target unrelated editors through broad host selectors");
  assert(!/\[data-claude-aura-sidebar\]\s+:is\([^{}]*(?:button|a\[href\])/.test(baseCss),
    "Sidebar states must not style every descendant control");
  assert(!baseCss.includes('html.claude-aura :is(button, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"])'),
    "Page buttons, dialog controls, and unrelated widgets must retain native presentation");
  assert.match(baseCss, /:is\(hr, \[role="separator"\]\)/);
  assert(!/:is\([^{}]*(?:button|\[role="button"\])[^{}]*\)\s+:is\(svg, \[data-icon\]\)\s*\{[^}]*\b(?:background|box-shadow|border-radius|transform)\s*:/s.test(`${baseCss}\n${variants}`),
    "Aura must not draw boxes, shadows, or transforms around Claude's nested icons");
  assert(baseCss.includes("[data-claude-aura-sidebar]"), "Live sidebar styling must use the semantic Aura marker");
  assert(!baseCss.includes(".dframe-sidebar"), "Live sidebar styling must not depend on Claude's unstable class name");
  assert(!variants.includes(".dframe-sidebar"), "Theme variants must use the semantic sidebar marker");
  assert(!/html\.claude-aura\s+:is\(\[aria-current/.test(baseCss),
    "Bare state wrappers must not receive selected styling");
  const focusStart = baseCss.indexOf("html.claude-aura :focus-visible");
  assert(focusStart > baseCss.indexOf(nativeControlSelector),
    "Visible focus styling must follow role-scoped interaction states");
  const focusBody = baseCss.slice(focusStart, baseCss.indexOf("}", focusStart));
  assert.match(focusBody, /outline:\s*1px solid hsl\(var\(--aura-focus-ring\) \/ 0\.72\)/,
    "Focus styling must use the softened one-pixel ring");
  assert.match(focusBody, /box-shadow:\s*0 0 0 4px hsl\(var\(--aura-focus-ring\) \/ 0\.14\)/,
    "Focus styling must retain a low-alpha halo");
  assert.match(baseCss, /@media \(forced-colors: active\)/);
  assert.match(baseCss, /claude-aura-reduce-motion/);
  const expectedSheen = {
    default: "0.08",
    "japanese-film-editorial": "0",
    "korean-prestige": "0.14",
    "cartoon-studio": "0",
    "anime-twilight": "0.22",
    "study-library": "0",
    "japanese-idol": "0.18",
    "korean-idol": "0.32",
  };
  for (const id of THEME_IDS) {
    const recipe = variants.match(new RegExp(
      `html\\.claude-aura\\[data-claude-aura-theme="${id}"\\]\\s*\\{([^}]*)--aura-primary-sheen:\\s*([^;]+);([^}]*)\\}`,
      "s",
    ));
    assert(recipe && recipe[0].includes("--aura-state-shadow:"),
      `${id} lacks its restrained state shadow`);
    assert.equal(recipe[2].trim(), expectedSheen[id],
      `${id} does not preserve its authorized primary-action sheen`);
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
        ["sidebar-muted", "--aura-sidebar-text-muted", "--aura-sidebar-background", 4.5],
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

test("all live chrome labels remain readable on their effective state backgrounds", async () => {
  const blend = (foreground, background, alpha) => foreground.map(
    (channel, index) => (channel * alpha) + (background[index] * (1 - alpha)),
  );
  const rgbLuminance = (rgb) => rgb
    .map((channel) => channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const rgbContrast = (foreground, background) => {
    const values = [rgbLuminance(foreground), rgbLuminance(background)].sort((left, right) => right - left);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };
  const primarySheen = {
    default: 0.08,
    "japanese-film-editorial": 0,
    "korean-prestige": 0.14,
    "cartoon-studio": 0,
    "anime-twilight": 0.22,
    "study-library": 0,
    "japanese-idol": 0.18,
    "korean-idol": 0.32,
  };
  const failures = [];
  for (const theme of await listThemes()) {
    for (const mode of ["light", "dark"]) {
      const tokens = theme[mode].semantic;
      const rgb = (token) => hslToRgb(tokens[token]);
      const check = (label, foreground, background, minimum = 4.5) => {
        const ratio = rgbContrast(foreground, background);
        if (ratio < minimum) {
          failures.push(`${theme.name}/${mode}: ${label} contrast ${ratio.toFixed(2)} is below ${minimum}:1`);
        }
      };
      const sidebar = rgb("--aura-sidebar-background");
      const composer = rgb("--aura-composer-background");
      const sidebarText = rgb("--aura-sidebar-text-primary");
      const mutedSidebarText = rgb("--aura-sidebar-text-muted");
      const text = rgb("--aura-text-primary");
      const secondaryText = rgb("--aura-text-secondary");
      const onAccent = rgb("--aura-text-on-accent");
      const accent = rgb("--aura-accent-primary");

      check("sidebar rest", sidebarText, sidebar, 7);
      check("sidebar muted rest", mutedSidebarText, sidebar);
      for (const [label, alpha] of [["row hover", 0.42], ["row press", 0.58], ["row current", 0.68]]) {
        check(label, sidebarText, blend(rgb("--aura-sidebar-selected"), sidebar, alpha));
        check(`${label} secondary`, sidebarText, blend(rgb("--aura-sidebar-selected"), sidebar, alpha));
      }
      const footer = blend(rgb("--aura-elevated-surface"), sidebar, 0.28);
      check("footer label", sidebarText, footer);
      check("footer secondary label", mutedSidebarText, footer);

      check("control rest", text, blend(rgb("--aura-elevated-surface"), composer, 0.28));
      check("control rest secondary", secondaryText,
        blend(rgb("--aura-elevated-surface"), composer, 0.28));
      check("control hover", text, blend(rgb("--aura-hover-surface"), composer, 0.42));
      check("control hover secondary", secondaryText, blend(rgb("--aura-hover-surface"), composer, 0.42));
      check("control press", text, blend(rgb("--aura-selected-surface"), composer, 0.58));
      check("control press secondary", secondaryText,
        blend(rgb("--aura-selected-surface"), composer, 0.58));
      check("control selected", onAccent, accent);
      check("control disabled", rgb("--aura-text-disabled"),
        blend(rgb("--aura-disabled-surface"), composer, 0.66), 3);

      for (let step = 0; step <= 20; step += 1) {
        const sheen = blend(
          rgb("--aura-accent-secondary"),
          accent,
          primarySheen[theme.name] * (step / 20),
        );
        check(`primary rest sheen ${step}`, onAccent, sheen);
        check(`primary hover sheen ${step}`, onAccent,
          blend(rgb("--aura-hover-surface"), sheen, 0.10));
      }
    }
  }
  assert.equal(failures.length, 0, failures.join("\n"));
});

test("the four mixed-mode themes keep a true Light sidebar palette", async () => {
  const expected = {
    "japanese-film-editorial": ["38 20% 84%", "210 9% 14%", "210 6% 37%", "12 28% 69%"],
    "korean-prestige": ["216 24% 84%", "220 32% 14%", "218 12% 37%", "216 32% 71%"],
    "anime-twilight": ["228 22% 90%", "232 34% 18%", "230 12% 42%", "248 24% 80%"],
    "study-library": ["44 28% 90%", "70 10% 17%", "70 6% 39%", "139 16% 78%"],
  };
  const themes = new Map((await listThemes()).map((theme) => [theme.name, theme]));
  for (const [themeId, values] of Object.entries(expected)) {
    const semantic = themes.get(themeId)?.light.semantic;
    assert(semantic, `${themeId} is missing`);
    assert.deepEqual([
      semantic["--aura-sidebar-background"],
      semantic["--aura-sidebar-text-primary"],
      semantic["--aura-sidebar-text-muted"],
      semantic["--aura-sidebar-selected"],
    ], values, `${themeId} regressed to a dark Light-appearance rail`);
  }
  assert.equal(themes.get("korean-prestige").light.semantic["--aura-accent-primary"], "216 44% 45%");
  assert.equal(themes.get("anime-twilight").light.semantic["--aura-accent-primary"], "258 38% 49%");
  for (const themeId of ["korean-prestige", "anime-twilight"]) {
    const semantic = themes.get(themeId).light.semantic;
    assert(
      contrast(semantic["--aura-text-on-accent"], semantic["--aura-accent-primary"]) >= 4.5,
      `${themeId} softened Light primary action lost text contrast`,
    );
  }
});

test("theme metadata localizes independently for English, Simplified Chinese, and Traditional Chinese", async () => {
  const [english, simplified, traditional] = await Promise.all([
    listThemes({ locale: "en" }),
    listThemes({ locale: "zh-CN" }),
    listThemes({ locale: "zh-HKTW" }),
  ]);
  assert.deepEqual(english.map((theme) => theme.name), THEME_IDS);
  assert.deepEqual(simplified.map((theme) => theme.name), THEME_IDS);
  assert.deepEqual(traditional.map((theme) => theme.name), THEME_IDS);
  assert.equal(english[0].label, "Default");
  assert.equal(simplified[0].label, "默认");
  assert.equal(traditional[0].label, "預設");
  assert.equal(normalizeLocale("zh-SG"), "zh-CN");
  assert.equal(normalizeLocale("zh-MO"), "zh-HKTW");
  assert.equal(normalizeLocale("zh_Hans_SG"), "zh-CN");
  assert.equal(normalizeLocale("zh_Hant_TW"), "zh-HKTW");
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
