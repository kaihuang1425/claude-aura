import { spawnSync } from "node:child_process";
import vm from "node:vm";

import { test, runIfMain } from "./support/harness.mjs";
import {
  PROJECT_ROOT,
  assert,
  fs,
  os,
  path,
} from "./support/context.mjs";

const compactPath = path.join(PROJECT_ROOT, "studio", "work-hub.html");
const presentationPath = path.join(PROJECT_ROOT, "studio", "session-board-presentation.js");
const generatedThemesPath = path.join(PROJECT_ROOT, "studio", "generated-themes.js");
const sessionDockPath = path.join(PROJECT_ROOT, "windows", "aura-session-dock.ps1");
const webTabsPath = path.join(PROJECT_ROOT, "windows", "aura-web-tabs.ps1");
const auraUiPath = path.join(PROJECT_ROOT, "windows", "aura-ui.ps1");
const desktopPanelPath = path.join(PROJECT_ROOT, "windows", "desktop-taskboard-panel.ps1");
const overlayPath = path.join(PROJECT_ROOT, "windows", "desktop-overlay-proof.ps1");

const supportedLocales = [
  "en", "hi", "es", "fr", "id", "ja", "ko", "pt-BR", "de", "it", "vi", "pl", "tr",
  "zh-CN", "zh-HKTW",
];
const copyKeys = [
  "sessionBoardKicker", "sessionBoardTitle", "sessionBoardLede", "sessionBoardRefresh",
  "sessionBoardLoading", "sessionBoardReady", "sessionBoardError", "sessionBoardLaneActive",
  "sessionBoardLaneOpen", "sessionBoardLanePast", "sessionBoardEmptyActive", "sessionBoardEmptyOpen",
  "sessionBoardEmptyPast", "sessionBoardResponseWorking", "sessionBoardResponseCompleted",
  "sessionBoardResponseFailed", "sessionBoardResponseUnknown", "sessionBoardOpenSession",
  "sessionBoardReopen", "sessionBoardLastOpened", "sessionBoardKindChat", "sessionBoardKindCode",
  "sessionBoardScopeObservedStateNotGoalCompletion",
];
const mixedUnicode = "简体中文 | 繁體中文 | 日本語 | 한국어 | 𠀀 | 👩🏽‍💻 | Café | ⌘ § ∞ ⌁";

const psPath = (value) => value.replaceAll("'", "''");
const readIfPresent = async (file) => {
  try { return await fs.readFile(file, "utf8"); }
  catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
};

function copyFixture(prefix) {
  return Object.fromEntries(copyKeys.map((key) => [
    key,
    key === "sessionBoardTitle" ? `${prefix} ${mixedUnicode}` : `${prefix} ${key.slice(12)}`,
  ]));
}

function studioStyle(lightCanvas, darkCanvas, lightAccent, darkAccent) {
  const colors = (canvas, accent, text) => ({
    canvas,
    sidebar: canvas,
    surface: canvas,
    raised: canvas,
    text,
    textSecondary: text,
    textMuted: text,
    sidebarText: text,
    sidebarTextMuted: text,
    accent,
    accentText: canvas,
    border: text,
    focus: accent,
    surfaceAlpha: 1,
    sidebarAlpha: 1,
  });
  return {
    light: colors(lightCanvas, lightAccent, "#111111"),
    dark: colors(darkCanvas, darkAccent, "#F5F5F5"),
    shared: { fontUi: "system-sans", fontDisplay: "editorial-serif", radius: 18, blur: 20, shadow: "soft" },
  };
}

function createPresentationDocument() {
  const properties = new Map();
  return {
    title: "",
    documentElement: {
      lang: "en",
      dataset: {},
      style: {
        colorScheme: "",
        setProperty(name, value) { properties.set(name, String(value)); },
        getPropertyValue(name) { return properties.get(name) ?? ""; },
      },
    },
  };
}

async function loadPresentationApi() {
  const source = await readIfPresent(presentationPath);
  assert(source, "studio/session-board-presentation.js must own compact locale/theme presentation");
  const context = { console, window: {} };
  vm.runInNewContext(source, context, { filename: presentationPath });
  const api = context.window.CLAUDE_AURA_SESSION_BOARD_PRESENTATION;
  assert(api && typeof api === "object", "Compact presentation must expose one bounded test seam");
  return { api, source };
}

test("compact Work Hub loads validated Studio locale/theme assets without raw key fallbacks", async () => {
  const [html, presentation, generatedThemes] = await Promise.all([
    fs.readFile(compactPath, "utf8"),
    readIfPresent(presentationPath),
    fs.readFile(generatedThemesPath, "utf8"),
  ]);
  assert(presentation, "The compact presentation module is missing");
  assert.match(html, /generated-themes\.js\?v=\d+/u);
  assert.match(html, /session-board-presentation\.js\?v=\d+/u);
  for (const locale of supportedLocales) {
    assert.match(html, new RegExp(`locales/${locale}\\.js\\?v=\\d+`, "u"),
      `Compact Work Hub does not load the existing ${locale} Studio locale asset`);
  }
  assert.match(generatedThemes, /window\.CLAUDE_AURA_THEMES\s*=/u);
  assert.match(html, /addEventListener\?\.\("change"[\s\S]*?refreshSystemAppearance/u);
  assert.doesNotMatch(html, /copy\[key\]\s*\?\?\s*key|\?\?\s*["']sessionBoard|>sessionBoard[A-Z]/u);
  assert.doesNotMatch(html, /<title>Claude Aura Work Hub<\/title>/u,
    "The document title must wait for validated localized copy");
  for (const locale of ["en", "zh-CN", "zh-HKTW"]) {
    const localeSource = await fs.readFile(path.join(PROJECT_ROOT, "studio", "locales", `${locale}.js`), "utf8");
    for (const key of copyKeys) assert(localeSource.includes(`${key}:`), `${locale}.${key} is missing`);
  }
});

test("compact presentation preserves Unicode, locale fallback, and mounted theme updates", async () => {
  const { api } = await loadPresentationApi();
  assert.deepEqual(Array.from(api.SUPPORTED_LOCALES), supportedLocales);
  for (const locale of supportedLocales) assert.equal(api.normalizeLocale(locale), locale);
  for (const [input, expected] of [
    ["en-US", "en"], ["zh-TW", "zh-HKTW"], ["zh-Hans", "zh-CN"],
    ["pt-PT", "pt-BR"], ["ja-JP", "ja"], ["not-a-locale", "en"],
  ]) assert.equal(api.normalizeLocale(input), expected);

  const strings = {
    en: { shell: copyFixture("English") },
    "zh-CN": { shell: copyFixture("简体中文") },
    "zh-HKTW": { shell: { ...copyFixture("繁體中文"), sessionBoardReady: undefined } },
  };
  const themes = {
    default: { name: "default", source: "builtin", studioStyle: studioStyle("#F1F2F9", "#1B1D2C", "#4721A1", "#BA8BF4") },
    "study-library": { name: "study-library", source: "builtin", studioStyle: studioStyle("#FFF8E8", "#211B15", "#8A4D00", "#F0B35B") },
  };
  const document = createPresentationDocument();
  let systemDark = false;
  const presenter = api.createSessionBoardPresentation({
    document, strings, themes, prefersDark: () => systemDark,
  });
  const first = {
    type: "session-board-presentation", version: 1, revision: 1,
    locale: "zh-HKTW", themeId: "default", appearance: "light", enabled: true,
  };
  assert.equal(presenter.receive(first), true);
  assert.equal(document.documentElement.lang, "zh-Hant-TW");
  assert.equal(document.title, strings["zh-HKTW"].shell.sessionBoardTitle);
  assert.equal(presenter.t("sessionBoardTitle"), strings["zh-HKTW"].shell.sessionBoardTitle);
  assert.equal(presenter.t("sessionBoardReady"), strings.en.shell.sessionBoardReady,
    "Incomplete localized copy falls back to English without exposing its key");
  assert.equal(presenter.t("notAVisibleCopyKey"), "");
  assert.equal(document.documentElement.style.getPropertyValue("--bg"), themes.default.studioStyle.light.canvas);
  assert.equal(document.documentElement.style.getPropertyValue("--accent"), themes.default.studioStyle.light.accent);

  const mountedRoot = document.documentElement;
  assert.equal(presenter.receive({ ...first, revision: 2, locale: "zh-CN", themeId: "study-library", appearance: "dark" }), true);
  assert.equal(document.documentElement, mountedRoot, "Theme changes update the mounted compact document");
  assert.equal(document.documentElement.lang, "zh-Hans-CN");
  assert.equal(document.documentElement.style.getPropertyValue("--bg"), themes["study-library"].studioStyle.dark.canvas);
  assert.equal(document.documentElement.style.getPropertyValue("--accent"), themes["study-library"].studioStyle.dark.accent);
  assert.equal(document.title, strings["zh-CN"].shell.sessionBoardTitle);
  assert(document.title.includes(mixedUnicode));
  assert.doesNotMatch(document.title, /\uFFFD|sessionBoard/u);

  assert.equal(presenter.receive({
    ...first, revision: 3, locale: "en", themeId: "study-library", appearance: "system",
  }), true);
  assert.equal(document.documentElement.style.getPropertyValue("--bg"),
    themes["study-library"].studioStyle.light.canvas);
  systemDark = true;
  assert.equal(presenter.refreshSystemAppearance(), true);
  assert.equal(document.documentElement.style.getPropertyValue("--bg"),
    themes["study-library"].studioStyle.dark.canvas,
    "A live system color-scheme change reapplies the mounted style without a host revision");

  const invalid = [
    { ...first, revision: 4, css: "body{display:none}" },
    { ...first, revision: 4, html: "<img src=x>" },
    { ...first, revision: 4, url: "https://example.com" },
    { ...first, revision: 4, locale: "en<script>" },
    { ...first, revision: 4, themeId: "unknown" },
    { ...first, revision: 4, themeId: "a".repeat(4097) },
    { ...first, revision: 4, appearance: "sepia" },
    { ...first, revision: 4, enabled: "true" },
    { ...first, version: 2, revision: 4 },
    { ...first, revision: -1 },
    { ...first, revision: Number.MAX_SAFE_INTEGER + 1 },
    {
      type: "session-board-presentation", version: 1, revision: 3,
      locale: "en", themeId: "default", appearance: "light",
    },
    null,
    [],
  ];
  for (const candidate of invalid) assert.equal(presenter.receive(candidate), false);
  assert.equal(presenter.receive({ ...first, revision: 1 }), false, "Stale presentation updates are rejected");
});

test("Aura hosts emit one exact presentation message without touching the provider WebView", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-session-board-presentation-"));
  const updateHarnessPath = path.join(temporaryRoot, "compact-update.ps1");
  const updateHarness = `
$ErrorActionPreference='Stop'
$DataRoot='${psPath(path.join(temporaryRoot, "data"))}'
. '${psPath(webTabsPath)}'
$script:PostCount=0
$script:NavigateCount=0
$script:EnsureCount=0
$script:ProviderSelectionCount=0
$script:PostedJson=''
$core=[pscustomobject]@{}
$core|Add-Member ScriptMethod PostWebMessageAsJson {param([string]$Json)$script:PostCount+=1;$script:PostedJson=$Json}
$core|Add-Member ScriptMethod Navigate {param([string]$Uri)$script:NavigateCount+=1}
$workHub=[pscustomobject]@{IsDisposed=$false;CoreWebView2=$core}
$workHub|Add-Member ScriptMethod EnsureCoreWebView2Async {param($Environment)$script:EnsureCount+=1}
$providerCore=[pscustomobject]@{}
$providerCore|Add-Member ScriptMethod Navigate {param([string]$Uri)$script:NavigateCount+=1}
$provider=[pscustomobject]@{IsDisposed=$false;CoreWebView2=$providerCore}
$provider|Add-Member ScriptMethod EnsureCoreWebView2Async {param($Environment)$script:EnsureCount+=1}
$provider|Add-Member ScriptMethod Show {$script:ProviderSelectionCount+=1}
$provider|Add-Member ScriptMethod Hide {$script:ProviderSelectionCount+=1}
$provider|Add-Member ScriptMethod BringToFront {$script:ProviderSelectionCount+=1}
function Request-AuraUiSelectWebTab {$script:ProviderSelectionCount+=1}
function Set-AuraWebTabActive {$script:ProviderSelectionCount+=1}
$script:AuraWebTabWorkHubWebView=$workHub
$script:AuraWebTabWorkHubReady=$true
$script:AuraWebTabWorkHubPresentationRevision=[long]1
$script:AuraWebTabRuntime=@{'11111111-1111-4111-8111-111111111111'=[pscustomobject]@{View=$provider}}
$valid=[pscustomobject][ordered]@{
  type='session-board-presentation';version=1;revision=[long]2
  locale='zh-HKTW';themeId='study-library';appearance='dark';enabled=$true
}
[void](Update-AuraWebTabWorkHubPresentation -Presentation $valid)
[void](Update-AuraWebTabWorkHubPresentation -Presentation $valid)
$stale=[pscustomobject][ordered]@{
  type='session-board-presentation';version=1;revision=[long]1
  locale='en';themeId='default';appearance='light';enabled=$true
}
[void](Update-AuraWebTabWorkHubPresentation -Presentation $stale)
$invalid=[pscustomobject][ordered]@{
  type='session-board-presentation';version=1;revision=[long]3
  locale='en';themeId='default';appearance='light';enabled=$true;html='<b>unsafe</b>'
}
try{[void](Update-AuraWebTabWorkHubPresentation -Presentation $invalid)}catch{}
[pscustomobject][ordered]@{
  posts=$script:PostCount;navigates=$script:NavigateCount;ensures=$script:EnsureCount
  providerSelections=$script:ProviderSelectionCount;posted=($script:PostedJson|ConvertFrom-Json -ErrorAction Stop)
}|ConvertTo-Json -Depth 5 -Compress
`;
  await fs.writeFile(updateHarnessPath, updateHarness, "utf8");
  const updateResult = spawnSync("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", updateHarnessPath,
  ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
  try {
    assert.equal(updateResult.status, 0, `${updateResult.stdout}\n${updateResult.stderr}`);
    assert.deepEqual(JSON.parse(updateResult.stdout.trim().split(/\r?\n/u).at(-1)), {
      posts: 1, navigates: 0, ensures: 0, providerSelections: 0,
      posted: {
        type: "session-board-presentation", version: 1, revision: 2,
        locale: "zh-HKTW", themeId: "study-library", appearance: "dark", enabled: true,
      },
    });

    const messageHarnessPath = path.join(temporaryRoot, "presentation-message.ps1");
    const messageHarness = `
$ErrorActionPreference='Stop'
$DataRoot='${psPath(path.join(temporaryRoot, "data"))}'
. '${psPath(sessionDockPath)}'
$value=New-AuraSessionBoardPresentationMessage -Locale 'zh-HKTW' -ThemeId 'study-library' -Appearance 'dark' -Enabled $true -Revision 4
$value|ConvertTo-Json -Compress
`;
    await fs.writeFile(messageHarnessPath, messageHarness, "utf8");
    const messageResult = spawnSync("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", messageHarnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(messageResult.status, 0, `${messageResult.stdout}\n${messageResult.stderr}`);
    assert.deepEqual(JSON.parse(messageResult.stdout.trim().split(/\r?\n/u).at(-1)), {
      type: "session-board-presentation", version: 1, revision: 4,
      locale: "zh-HKTW", themeId: "study-library", appearance: "dark", enabled: true,
    });

    const resolutionHarnessPath = path.join(temporaryRoot, "presentation-theme-resolution.ps1");
    const resolutionHarness = `
$ErrorActionPreference='Stop'
$DataRoot='${psPath(path.join(temporaryRoot, "data"))}'
. '${psPath(sessionDockPath)}'
[pscustomobject][ordered]@{
  inherited=(Resolve-AuraSessionBoardPresentationThemeId -ThemeId 'my-theme' -SourceRecipe 'study-library')
  fallback=(Resolve-AuraSessionBoardPresentationThemeId -ThemeId 'my-theme' -SourceRecipe 'not-a-recipe')
}|ConvertTo-Json -Compress
`;
    await fs.writeFile(resolutionHarnessPath, resolutionHarness, "utf8");
    const resolutionResult = spawnSync("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", resolutionHarnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(resolutionResult.status, 0, `${resolutionResult.stdout}\n${resolutionResult.stderr}`);
    assert.deepEqual(JSON.parse(resolutionResult.stdout.trim().split(/\r?\n/u).at(-1)), {
      inherited: "study-library", fallback: "default",
    }, "A custom theme resolves through only its validated permanent source recipe");
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }

  const [webTabs, panel, sessionDock, auraUi] = await Promise.all([
    fs.readFile(webTabsPath, "utf8"),
    fs.readFile(desktopPanelPath, "utf8"),
    fs.readFile(sessionDockPath, "utf8"),
    fs.readFile(auraUiPath, "utf8"),
  ]);
  const compactUpdate = /function Update-AuraWebTabWorkHubPresentation\b[\s\S]*?^\}/mu.exec(webTabs)?.[0] ?? "";
  assert(compactUpdate, "Pinned Work Hub has no presentation-update seam");
  assert.match(compactUpdate, /AuraWebTabWorkHubWebView[\s\S]*?PostWebMessageAsJson/u);
  assert.doesNotMatch(compactUpdate, /\.Navigate\(|Request-AuraUiSelectWebTab|Set-AuraWebTabActive|EnsureCoreWebView2Async/u);
  assert.match(panel, /Send-AuraDesktopWorkHubPresentation/u);
  assert.match(panel, /PostWebMessageAsJson/u);
  assert.match(sessionDock, /New-AuraSessionBoardPresentationMessage/u);
  assert.match(auraUi,
    /Get-AuraUiSessionBoardThemeId[\s\S]*?Resolve-AuraSessionBoardPresentationThemeId/u);
  assert.match(sessionDock,
    /Surface -cin @\('compact', 'desktop'\)[\s\S]{0,180}Query\.Length -eq 0/u,
    "Compact presentation is message-only; its local URL accepts no query input");
});

test("pinned and Desktop Work Hub titles use localized copy instead of hard-coded English", async () => {
  const [webTabs, panel, overlay] = await Promise.all([
    fs.readFile(webTabsPath, "utf8"),
    fs.readFile(desktopPanelPath, "utf8"),
    fs.readFile(overlayPath, "utf8"),
  ]);
  assert.match(webTabs, /Title = Get-AuraWebTabWorkHubTitle/u);
  assert.doesNotMatch(panel, /\.Text = 'Claude Aura Work Hub'|\.AccessibleName = 'Claude Aura Work Hub'/u);
  assert.match(panel, /\$workHubTitle = \[string\]\$uiCopy\.workHubTitle/u);
  assert.match(panel, /\$form\.Text = \$workHubTitle/u);
  assert.match(panel, /\$form\.AccessibleName = \$workHubTitle/u);
  assert.match(overlay, /-Locale/u, "The source-only overlay passes its validated locale to the panel");

  if (process.platform === "win32") {
    const titleHarness = `
$ErrorActionPreference='Stop'
$DataRoot='${psPath(path.join(os.tmpdir(), "aura-work-hub-title"))}'
. '${psPath(webTabsPath)}'
$script:UiCopy=[PSCustomObject]@{workHubTitle=''}
$fallback=Get-AuraWebTabWorkHubTitle
$script:UiCopy=[PSCustomObject]@{workHubTitle='  Localized hub  '}
$localized=Get-AuraWebTabWorkHubTitle
[ordered]@{fallback=$fallback;localized=$localized} | ConvertTo-Json -Compress
`;
    const titleResult = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", titleHarness,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(titleResult.status, 0, `${titleResult.stdout}\n${titleResult.stderr}`);
    assert.deepEqual(JSON.parse(titleResult.stdout.trim().split(/\r?\n/u).at(-1)), {
      fallback: "Work Hub",
      localized: "Localized hub",
    });
  }

  const expected = {
    en: "Dashboard",
    "zh-CN": "仪表板",
    "zh-HKTW": "儀表板",
  };
  for (const [locale, title] of Object.entries(expected)) {
    const value = JSON.parse(await fs.readFile(
      path.join(PROJECT_ROOT, "windows", "locales", `${locale}.json`), "utf8"));
    assert.equal(value.workHubTitle, title, `${locale} must localize the native dashboard title`);
  }
});

runIfMain(import.meta.url);
