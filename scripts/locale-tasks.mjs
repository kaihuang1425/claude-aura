#!/usr/bin/env node
// Locale handoff for Aura Studio.
//
// English, Simplified Chinese, and Traditional Chinese are written by hand in
// this repository. Every other Studio language is translated outside it, so no
// in-repo session spends its budget rewriting twelve files by hand. The flow:
//
//   node scripts/locale-tasks.mjs check              what is missing or stale
//   node scripts/locale-tasks.mjs export [--locale x] work packet to hand out
//   node scripts/locale-tasks.mjs import <packet>     validate and write back
//   node scripts/locale-tasks.mjs baseline            record English as done
//   node scripts/locale-tasks.mjs normalize           canonical file form
//
// `check` runs in the test suite, so a change to English copy fails the repo
// until the twelve delegated languages have been handed out and imported.
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PROJECT_ROOT } from "./theme-core.mjs";

export const SOURCE_LOCALE = "en";
// Written in this repository, natively, never machine-translated.
export const AUTHORED_LOCALES = Object.freeze(["en", "zh-CN", "zh-HKTW"]);
export const SECTIONS = Object.freeze(["shell", "editor"]);
export const STUDIO_LOCALE_DIR = path.join(PROJECT_ROOT, "studio", "locales");
export const BASELINE_PATH = path.join(STUDIO_LOCALE_DIR, "en-keys.json");

export const LOCALE_NAMES = Object.freeze({
  en: "English",
  hi: "Hindi",
  es: "Spanish",
  fr: "French",
  id: "Indonesian",
  ja: "Japanese",
  ko: "Korean",
  "pt-BR": "Portuguese (Brazil)",
  de: "German",
  it: "Italian",
  vi: "Vietnamese",
  pl: "Polish",
  tr: "Turkish",
  "zh-CN": "Simplified Chinese",
  "zh-HKTW": "Traditional Chinese",
});

const PLACEHOLDER = /\{\d+\}/g;
// eslint-disable-next-line no-control-regex -- copy must never carry control codes
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;

export function localeDisplayName(tag) {
  return LOCALE_NAMES[tag] ?? tag;
}

export function isAuthoredLocale(tag) {
  return AUTHORED_LOCALES.includes(tag);
}

export async function listStudioLocales() {
  const entries = await fs.readdir(STUDIO_LOCALE_DIR);
  return entries.filter((name) => name.endsWith(".js")).map((name) => name.slice(0, -3)).sort();
}

export function localePath(tag) {
  return path.join(STUDIO_LOCALE_DIR, `${tag}.js`);
}

// Each locale file registers itself on window.CLAUDE_AURA_STRINGS, so it is
// replayed against a bare object rather than parsed as text.
export async function readLocale(tag) {
  const source = await fs.readFile(localePath(tag), "utf8");
  const registry = {};
  Function("window", `"use strict";\n${source.replace(/^\uFEFF/, "")}`)(registry);
  const copy = registry.CLAUDE_AURA_STRINGS?.[tag];
  if (!copy) throw new Error(`studio/locales/${tag}.js does not register a "${tag}" entry`);
  return Object.fromEntries(SECTIONS.map((section) => [section, { ...copy[section] }]));
}

export async function readAllLocales() {
  const tags = await listStudioLocales();
  const entries = await Promise.all(tags.map(async (tag) => [tag, await readLocale(tag)]));
  return Object.fromEntries(entries);
}

export async function readBaseline() {
  try {
    return JSON.parse(await fs.readFile(BASELINE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function keyToken(key) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

export function renderLocaleFile(tag, copy) {
  const origin = isAuthoredLocale(tag)
    ? "Written by hand in this repository; never machine-translated."
    : "Translated outside this repository through scripts/locale-tasks.mjs.";
  const body = SECTIONS.map((section) => {
    const entries = Object.entries(copy[section])
      .map(([key, value]) => `      ${keyToken(key)}: ${JSON.stringify(value)},`)
      .join("\n");
    return `    ${section}: {\n${entries}\n    },`;
  }).join("\n");
  return `// Aura Studio ${localeDisplayName(tag)} interface copy.
// One file per language: \`shell\` is the Studio page (studio/app.js) and
// \`editor\` is the visual theme editor (studio/editor.js). The key set must
// match studio/locales/${SOURCE_LOCALE}.js exactly.
// ${origin}
(() => {
  "use strict";

  const registry = (window.CLAUDE_AURA_STRINGS ??= {});
  registry[${JSON.stringify(tag)}] = {
${body}
  };
})();
`;
}

export async function writeLocale(tag, copy) {
  await fs.writeFile(localePath(tag), renderLocaleFile(tag, copy), "utf8");
}

export function flatten(copy) {
  const flat = new Map();
  for (const section of SECTIONS) {
    for (const [key, value] of Object.entries(copy[section] ?? {})) flat.set(`${section}.${key}`, value);
  }
  return flat;
}

function placeholders(value) {
  return [...String(value).matchAll(PLACEHOLDER)].map((match) => match[0]).sort().join(",");
}

// One locale measured against English: shape problems plus keys whose English
// text moved since the last completed translation round.
export function inspectLocale(tag, copy, english, baseline) {
  const source = flatten(english);
  const target = flatten(copy);
  const base = baseline ? flatten(baseline) : null;
  const missing = [];
  const stale = [];
  const empty = [];
  const placeholderMismatch = [];
  for (const [id, englishText] of source) {
    const value = target.get(id);
    if (value === undefined) {
      missing.push(id);
      continue;
    }
    if (typeof value !== "string" || !value.trim() || CONTROL_CHARACTERS.test(value)) {
      empty.push(id);
      continue;
    }
    if (placeholders(englishText) !== placeholders(value)) placeholderMismatch.push(id);
    if (base && base.has(id) && base.get(id) !== englishText) stale.push(id);
  }
  const extra = [...target.keys()].filter((id) => !source.has(id));
  return { tag, missing, extra, empty, stale, placeholderMismatch };
}

export function localeHasIssues(report) {
  return report.missing.length > 0 || report.extra.length > 0 || report.empty.length > 0
    || report.stale.length > 0 || report.placeholderMismatch.length > 0;
}

export function baselineDrift(english, baseline) {
  if (!baseline) return { missing: [...flatten(english).keys()], changed: [], removed: [] };
  const source = flatten(english);
  const base = flatten(baseline);
  return {
    missing: [...source.keys()].filter((id) => !base.has(id)),
    changed: [...source].filter(([id, text]) => base.has(id) && base.get(id) !== text).map(([id]) => id),
    removed: [...base.keys()].filter((id) => !source.has(id)),
  };
}

const PACKET_INSTRUCTIONS = [
  "You are translating the interface of Claude Aura, a Windows app that themes the Claude website.",
  "Fill in the empty \"translation\" field of every entry. Change nothing else in this file.",
  "Return the whole file as JSON with the same shape.",
  "Rules:",
  "1. Translate into the language named by displayName, in the register a native speaker expects from a polished desktop app. Do not translate word by word from English.",
  "2. Keep every {0}, {1} placeholder exactly as it appears in the English text. They are substituted at runtime.",
  "3. Keep the product names Claude, Claude Aura, Aura, and Studio untranslated.",
  "4. Interface labels and buttons stay short: no longer than the English text plus about 40%.",
  "5. \"current\" is the existing translation, when there is one. Keep its terminology unless the English source changed meaning.",
  "6. No trailing spaces, no straight-quote escaping, no HTML, no markdown.",
];

async function commandCheck() {
  const locales = await readAllLocales();
  const english = locales[SOURCE_LOCALE];
  if (!english) throw new Error("studio/locales/en.js is missing");
  const baseline = await readBaseline();
  const drift = baselineDrift(english, baseline);
  const reports = Object.entries(locales)
    .filter(([tag]) => tag !== SOURCE_LOCALE)
    .map(([tag, copy]) => inspectLocale(tag, copy, english, baseline));

  let failed = false;
  const driftCount = drift.missing.length + drift.changed.length + drift.removed.length;
  if (driftCount > 0) {
    failed = true;
    console.log(`English copy moved since the last translation round: ${drift.missing.length} added, `
      + `${drift.changed.length} changed, ${drift.removed.length} removed.`);
    for (const id of [...drift.missing, ...drift.changed].slice(0, 10)) console.log(`  ${id}`);
    console.log("  Run: node scripts/locale-tasks.mjs export");
  }
  for (const report of reports) {
    if (!localeHasIssues(report)) continue;
    failed = true;
    const parts = [];
    if (report.missing.length) parts.push(`${report.missing.length} missing`);
    if (report.extra.length) parts.push(`${report.extra.length} unknown`);
    if (report.empty.length) parts.push(`${report.empty.length} empty`);
    if (report.stale.length) parts.push(`${report.stale.length} stale`);
    if (report.placeholderMismatch.length) parts.push(`${report.placeholderMismatch.length} broken placeholders`);
    console.log(`${report.tag.padEnd(8)} ${parts.join(", ")}`);
    for (const id of [...report.missing, ...report.extra, ...report.empty, ...report.placeholderMismatch].slice(0, 6)) {
      console.log(`  ${id}`);
    }
  }
  if (!failed) {
    const delegated = reports.filter((report) => !isAuthoredLocale(report.tag)).length;
    console.log(`Locale copy is complete: ${Object.keys(locales).length} languages `
      + `(${AUTHORED_LOCALES.length} written here, ${delegated} translated outside).`);
  }
  return failed ? 1 : 0;
}

async function commandExport(argv) {
  const requested = argv.locale ? [argv.locale] : null;
  const locales = await readAllLocales();
  const english = locales[SOURCE_LOCALE];
  const baseline = await readBaseline();
  const tags = requested ?? (await listStudioLocales()).filter((tag) => !isAuthoredLocale(tag));
  const source = flatten(english);
  const packetLocales = {};
  let total = 0;
  for (const tag of tags) {
    if (isAuthoredLocale(tag) && !requested) continue;
    const copy = locales[tag] ?? { shell: {}, editor: {} };
    const report = inspectLocale(tag, copy, english, baseline);
    const wanted = argv.all
      ? [...source.keys()]
      : [...new Set([...report.missing, ...report.empty, ...report.stale, ...report.placeholderMismatch])];
    if (wanted.length === 0) continue;
    const target = flatten(copy);
    const base = baseline ? flatten(baseline) : null;
    packetLocales[tag] = {
      displayName: localeDisplayName(tag),
      entries: wanted.sort().map((id) => {
        const [section, key] = [id.slice(0, id.indexOf(".")), id.slice(id.indexOf(".") + 1)];
        const entry = { section, key, english: source.get(id), translation: "" };
        if (target.has(id)) entry.current = target.get(id);
        if (base?.has(id) && base.get(id) !== source.get(id)) entry.englishBefore = base.get(id);
        return entry;
      }),
    };
    total += wanted.length;
  }
  if (total === 0) {
    console.log("Nothing to hand out: every delegated language is current.");
    return 0;
  }
  const packet = {
    schemaVersion: 1,
    generated: new Date().toISOString(),
    sourceLocale: SOURCE_LOCALE,
    instructions: PACKET_INSTRUCTIONS,
    locales: packetLocales,
  };
  const outputDirectory = argv.out ? path.resolve(argv.out) : path.join(PROJECT_ROOT, "dist", "locale-tasks");
  await fs.mkdir(outputDirectory, { recursive: true });
  const stamp = packet.generated.replaceAll(":", "").replace(/\..*$/, "");
  const outputPath = path.join(outputDirectory, `locale-packet-${stamp}.json`);
  await fs.writeFile(outputPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  console.log(`${total} strings across ${Object.keys(packetLocales).length} languages: ${outputPath}`);
  console.log("Hand that file to the outside translation model, then run:");
  console.log(`  node scripts/locale-tasks.mjs import "${outputPath}"`);
  return 0;
}

async function commandImport(argv) {
  const packetPath = argv._[0];
  if (!packetPath) throw new Error("import needs a packet path");
  const packet = JSON.parse(await fs.readFile(path.resolve(packetPath), "utf8"));
  if (packet?.schemaVersion !== 1 || !packet.locales || typeof packet.locales !== "object") {
    throw new Error("The packet is not a schemaVersion 1 locale packet");
  }
  const locales = await readAllLocales();
  const english = locales[SOURCE_LOCALE];
  const source = flatten(english);
  const problems = [];
  const pending = [];
  for (const [tag, block] of Object.entries(packet.locales)) {
    if (isAuthoredLocale(tag)) {
      problems.push(`${tag} is written in this repository and cannot be imported`);
      continue;
    }
    const copy = locales[tag]
      ?? Object.fromEntries(SECTIONS.map((section) => [section, {}]));
    for (const entry of block.entries ?? []) {
      const id = `${entry.section}.${entry.key}`;
      if (!source.has(id)) {
        problems.push(`${tag}: ${id} is not a key in ${SOURCE_LOCALE}.js`);
        continue;
      }
      const value = entry.translation;
      if (typeof value !== "string" || !value.trim()) {
        problems.push(`${tag}: ${id} has no translation`);
        continue;
      }
      if (CONTROL_CHARACTERS.test(value)) {
        problems.push(`${tag}: ${id} contains control characters`);
        continue;
      }
      if (placeholders(source.get(id)) !== placeholders(value)) {
        problems.push(`${tag}: ${id} lost or invented a {0} placeholder`);
        continue;
      }
      copy[entry.section][entry.key] = value.trim();
    }
    // Key order follows English so the files stay diffable against each other.
    const ordered = Object.fromEntries(SECTIONS.map((section) => [
      section,
      Object.fromEntries(Object.keys(english[section]).map((key) => [key, copy[section][key]])),
    ]));
    const report = inspectLocale(tag, ordered, english, null);
    if (localeHasIssues(report)) {
      problems.push(`${tag}: still incomplete after import `
        + `(${report.missing.length} missing, ${report.empty.length} empty)`);
      continue;
    }
    pending.push([tag, ordered]);
  }
  if (problems.length > 0) {
    console.error("The packet was rejected; no file was written.");
    for (const problem of problems.slice(0, 20)) console.error(`  ${problem}`);
    if (problems.length > 20) console.error(`  ...and ${problems.length - 20} more`);
    return 1;
  }
  for (const [tag, copy] of pending) await writeLocale(tag, copy);
  console.log(`Imported ${pending.length} languages: ${pending.map(([tag]) => tag).join(", ")}`);
  console.log("Run `node scripts/locale-tasks.mjs check` and then `npm test`.");
  return 0;
}

async function commandBaseline() {
  const english = await readLocale(SOURCE_LOCALE);
  await fs.writeFile(BASELINE_PATH, `${JSON.stringify(english, null, 2)}\n`, "utf8");
  console.log(`Recorded ${flatten(english).size} English strings as the translated baseline.`);
  return 0;
}

async function commandNormalize() {
  const tags = await listStudioLocales();
  const changed = [];
  for (const tag of tags) {
    const copy = await readLocale(tag);
    const before = await fs.readFile(localePath(tag), "utf8");
    const after = renderLocaleFile(tag, copy);
    if (before === after) continue;
    await fs.writeFile(localePath(tag), after, "utf8");
    const verified = await readLocale(tag);
    if (JSON.stringify(verified) !== JSON.stringify(copy)) {
      throw new Error(`normalizing ${tag} changed its copy`);
    }
    changed.push(tag);
  }
  console.log(changed.length === 0 ? "Every locale file is already canonical."
    : `Rewrote ${changed.length} files: ${changed.join(", ")}`);
  return 0;
}

function parseArguments(argv) {
  const parsed = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--all") parsed.all = true;
    else if (value === "--locale") parsed.locale = argv[++index];
    else if (value === "--out") parsed.out = argv[++index];
    else parsed._.push(value);
  }
  return parsed;
}

const COMMANDS = {
  check: commandCheck,
  export: commandExport,
  import: commandImport,
  baseline: commandBaseline,
  normalize: commandNormalize,
};

// Only the direct `node scripts/locale-tasks.mjs ...` run takes the CLI path;
// the test suite imports the helpers above.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [name = "check", ...rest] = process.argv.slice(2);
  const command = COMMANDS[name];
  if (!command) {
    console.error(`Unknown command "${name}". Use: ${Object.keys(COMMANDS).join(", ")}`);
    process.exit(2);
  }
  try {
    process.exit(await command(parseArguments(rest)));
  } catch (error) {
    console.error(`locale-tasks ${name} failed: ${error.message}`);
    process.exit(1);
  }
}
