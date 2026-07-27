import { test, runIfMain } from "./support/harness.mjs";
import {
  PROJECT_ROOT,
  STUDIO_LOCALES,
  UI_LOCALES,
  assert,
  fs,
  path,
  readHostCopy,
} from "./support/context.mjs";
import {
  AUTHORED_LOCALES,
  SOURCE_LOCALE,
  baselineDrift,
  flatten,
  inspectLocale,
  listStudioLocales,
  localeHasIssues,
  readAllLocales,
  readBaseline,
  renderLocaleFile,
} from "../scripts/locale-tasks.mjs";

// English, Simplified Chinese, and Traditional Chinese are written in this
// repository. The other Studio languages are translated outside it, so these
// gates are what stands between a copy edit and twelve silently stale files.
test("delegated locales stay complete, current, and canonical", async () => {
  const locales = await readAllLocales();
  const english = locales[SOURCE_LOCALE];
  assert(english, "studio/locales/en.js must exist");

  const baseline = await readBaseline();
  assert(baseline, "studio/locales/en-keys.json records the English text the translations were made from");
  const drift = baselineDrift(english, baseline);
  assert.deepEqual(
    { added: drift.missing, changed: drift.changed, removed: drift.removed },
    { added: [], changed: [], removed: [] },
    "English copy moved since the last translation round. Run `npm run locale:export`, have the "
    + "outside model fill the packet, then `npm run locale:import <packet>` and `npm run locale:baseline`",
  );

  for (const [tag, copy] of Object.entries(locales)) {
    if (tag === SOURCE_LOCALE) continue;
    const report = inspectLocale(tag, copy, english, baseline);
    assert(!localeHasIssues(report), `${tag} copy is not usable: ${report.missing.length} missing, `
      + `${report.extra.length} unknown, ${report.empty.length} empty, ${report.stale.length} stale, `
      + `${report.placeholderMismatch.length} with broken placeholders`);
  }

  // A rewrite must be a no-op, so `locale:import` never reformats a whole file
  // and buries the translated lines in noise.
  for (const [tag, copy] of Object.entries(locales)) {
    const file = path.join(PROJECT_ROOT, "studio", "locales", `${tag}.js`);
    const onDisk = await fs.readFile(file, "utf8");
    assert.notEqual(onDisk.codePointAt(0), 0xfeff, `studio/locales/${tag}.js must be UTF-8 without a byte-order mark`);
    assert.equal(onDisk, renderLocaleFile(tag, copy), `studio/locales/${tag}.js is not in canonical form; `
      + "run `node scripts/locale-tasks.mjs normalize`");
  }
});

test("every locale surface names exactly the same languages", async () => {
  const files = await listStudioLocales();
  const ui = await fs.readFile(path.join(PROJECT_ROOT, "windows", "aura-ui.ps1"), "utf8");
  const app = await fs.readFile(path.join(PROJECT_ROOT, "studio", "app.js"), "utf8");
  const html = await fs.readFile(path.join(PROJECT_ROOT, "studio", "index.html"), "utf8");

  const tagList = (block) => [...block.matchAll(/["']([A-Za-z-]+)["']/g)].map((match) => match[1]).sort();
  const hostBlock = ui.match(/\$StudioLocaleIds = @\(([\s\S]*?)\)/);
  assert(hostBlock, "aura-ui.ps1 must declare $StudioLocaleIds");
  const pageBlock = app.match(/const supportedLocales = new Set\(\[([\s\S]*?)\]\)/);
  assert(pageBlock, "studio/app.js must declare supportedLocales");

  const scripts = [...html.matchAll(/<script src="locales\/([^"]+)\.js"><\/script>/g)].map((match) => match[1]).sort();
  const settings = [...html.matchAll(/name="settings-locale" value="([^"]+)"/g)].map((match) => match[1]).sort();
  const welcome = [...html.matchAll(/name="welcome-locale" value="([^"]+)"/g)].map((match) => match[1]).sort();

  const expected = [...files].sort();
  assert.deepEqual(tagList(hostBlock[1]), expected, "aura-ui.ps1 $StudioLocaleIds does not match studio/locales");
  assert.deepEqual(tagList(pageBlock[1]), expected, "studio/app.js supportedLocales does not match studio/locales");
  assert.deepEqual(scripts, expected, "studio/index.html does not load exactly one script per locale file");
  assert.deepEqual(settings, expected, "Settings does not offer exactly the installed languages");
  assert.deepEqual(welcome, expected, "The welcome guide does not offer exactly the installed languages");
  assert.deepEqual([...STUDIO_LOCALES].sort(), expected, "tests/support/context.mjs STUDIO_LOCALES is stale");

  // Copy has to be registered before the two scripts that read it.
  const lastLocaleScript = html.lastIndexOf('<script src="locales/');
  for (const script of ["editor.js", "app.js"]) {
    assert(lastLocaleScript < html.indexOf(`<script src="${script}"></script>`),
      `studio/index.html must load every locale file before ${script}`);
  }

  for (const tag of AUTHORED_LOCALES) {
    assert(files.includes(tag), `${tag} is written in this repository and must have a locale file`);
  }
});

test("Windows host copy covers its languages completely", async () => {
  const hostCopy = await readHostCopy();
  const directory = path.join(PROJECT_ROOT, "windows", "locales");
  const ui = await fs.readFile(path.join(PROJECT_ROOT, "windows", "aura-ui.ps1"), "utf8");
  const files = (await fs.readdir(directory)).filter((name) => name.endsWith(".json"))
    .map((name) => name.slice(0, -5)).sort();
  assert.deepEqual(files, [...UI_LOCALES].sort(),
    "windows/locales does not match the host languages the tests declare");
  assert.deepEqual(UI_LOCALES, STUDIO_LOCALES,
    "Aura and Studio must expose the same interface languages");
  const copySelector = ui.slice(
    ui.indexOf("function Get-AuraUiCopy {"),
    ui.indexOf("function ConvertTo-AuraUiLocale {"),
  );
  assert.match(copySelector, /\$localeKey = ConvertTo-AuraUiLocale -Locale \$tag/,
    "Windows host copy must use the canonical fifteen-locale normalizer");

  const englishKeys = Object.keys(hostCopy.en).sort();
  assert(englishKeys.length > 0, "windows/locales/en.json must not be empty");
  for (const [tag, copy] of Object.entries(hostCopy)) {
    assert.deepEqual(Object.keys(copy).sort(), englishKeys, `${tag} host copy is incomplete`);
    for (const [key, value] of Object.entries(copy)) {
      assert(typeof value === "string" && value.trim(), `${tag}.${key} is empty`);
      const wanted = [...String(hostCopy.en[key]).matchAll(/\{\d+\}/g)].map((match) => match[0]).sort().join();
      const got = [...value.matchAll(/\{\d+\}/g)].map((match) => match[0]).sort().join();
      assert.equal(got, wanted, `${tag}.${key} lost or invented a {0} placeholder`);
    }
  }

  // Every host language must also exist in Studio, or the two windows disagree.
  const studio = await listStudioLocales();
  for (const tag of files) {
    assert(studio.includes(tag), `windows/locales/${tag}.json has no matching studio/locales/${tag}.js`);
  }
});

test("the English baseline mirrors the English locale file", async () => {
  const locales = await readAllLocales();
  const baseline = await readBaseline();
  assert.deepEqual([...flatten(baseline).entries()], [...flatten(locales[SOURCE_LOCALE]).entries()],
    "studio/locales/en-keys.json is stale; run `npm run locale:baseline` once the translations land");
});

runIfMain(import.meta.url);
