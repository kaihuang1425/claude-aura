import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  buildPayload,
  DEFAULT_CONFIG,
  listThemes,
  PROJECT_ROOT,
  readThemeRegistry,
} from "./theme-core.mjs";

const ARTWORK_ROOT = path.resolve(PROJECT_ROOT, "assets", "theme-art");
const MIME_TYPES = new Map([
  [".avif", "image/avif"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);
const MODES = ["light", "dark"];

function slash(value) {
  return value.replaceAll(path.sep, "/");
}

function isWithin(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

async function resolveAssets(entry) {
  const layered = Array.isArray(entry.artworkLayers) && entry.artworkLayers.length > 0;
  const registered = layered ? entry.artworkLayers : (entry.artwork ? [entry.artwork] : []);
  const realRoot = await fs.realpath(ARTWORK_ROOT);
  const assets = [];
  for (let index = 0; index < registered.length; index += 1) {
    const registry = registered[index];
    const candidate = path.resolve(PROJECT_ROOT, registry.path);
    if (!isWithin(ARTWORK_ROOT, candidate)) {
      throw new Error(`Theme artwork must remain inside ${ARTWORK_ROOT}: ${registry.path}`);
    }
    const mime = MIME_TYPES.get(path.extname(candidate).toLowerCase());
    if (!mime) throw new Error(`Unsupported theme artwork type: ${registry.path}`);
    const realPath = await fs.realpath(candidate).catch((error) => {
      if (error.code === "ENOENT") throw new Error(`Registered artwork is missing: ${registry.path}`);
      throw error;
    });
    if (!isWithin(realRoot, realPath)) {
      throw new Error(`Registered artwork resolves outside ${realRoot}: ${registry.path}`);
    }
    const bytes = await fs.readFile(realPath);
    if (!bytes.length) throw new Error(`Registered artwork is empty: ${registry.path}`);
    assets.push({
      layerIndex: index,
      path: registry.path,
      bytes: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      format: path.extname(candidate).slice(1).toLowerCase(),
      mime,
      registry: {
        position: registry.position,
        size: registry.size,
        mobile: registry.mobile,
        opacity: registry.opacity ?? 1,
        mask: registry.mask ?? "soft-right",
        role: registry.role ?? "decoration",
        appearance: registry.appearance ?? null,
        contextOverrides: registry.contextOverrides ?? null,
      },
    });
  }
  return { assets, layered };
}

async function writeJsonAtomic(filePath, value) {
  const temporary = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  try {
    await fs.rename(temporary, filePath);
  } catch (error) {
    if (!["EEXIST", "EPERM"].includes(error.code)) {
      await fs.rm(temporary, { force: true });
      throw error;
    }
    await fs.rm(filePath, { force: true });
    await fs.rename(temporary, filePath);
  }
}

export async function generateAssetAudit(themeId, { cwd = process.cwd() } = {}) {
  if (!/^[a-z][a-z0-9-]{1,39}$/.test(themeId ?? "")) {
    throw new Error("Theme id must be a lowercase kebab-case id");
  }
  const registry = await readThemeRegistry();
  const canonicalId = registry.legacyAliases[themeId] ?? themeId;
  const entry = registry.themes.find((candidate) => candidate.id === canonicalId);
  if (!entry) throw new Error(`Unknown theme: ${themeId}`);
  const theme = (await listThemes({ locale: "en" })).find((candidate) => candidate.name === canonicalId);
  const { assets, layered } = await resolveAssets(entry);

  const payloads = [];
  for (const mode of MODES) {
    const bundle = await buildPayload({
      config: { ...DEFAULT_CONFIG, theme: canonicalId, appearance: mode },
      locale: "en",
    });
    new Function(bundle.payload);
    const layerCount = Array.isArray(bundle.settings.artLayers) ? bundle.settings.artLayers.length : 0;
    const usesLegacyArtwork = typeof bundle.settings.artDataUrl === "string";
    if (layered && (layerCount !== assets.length || usesLegacyArtwork)) {
      throw new Error(`${mode} payload did not compile all ${assets.length} registered artwork layers`);
    }
    if (!layered && assets.length === 1 && (!usesLegacyArtwork || layerCount !== 0)) {
      throw new Error(`${mode} payload did not compile the registered artwork`);
    }
    payloads.push({
      mode,
      theme: bundle.settings.theme,
      digest: bundle.digest,
      bytes: Buffer.byteLength(bundle.payload, "utf8"),
      layerCount,
      usesLegacyArtwork,
      syntax: "pass",
    });
  }

  const resolvedCwd = await fs.realpath(path.resolve(cwd));
  const kitDirectory = path.join(resolvedCwd, "themes", canonicalId);
  const hasKit = await fs.stat(kitDirectory).then((stat) => stat.isDirectory()).catch((error) => {
    if (error.code === "ENOENT") return false;
    throw error;
  });
  const outputDir = hasKit
    ? path.join(kitDirectory, "qa")
    : path.join(resolvedCwd, "dist", "qa", canonicalId);
  if (!isWithin(resolvedCwd, outputDir)) throw new Error(`QA output resolves outside ${resolvedCwd}`);
  await fs.mkdir(outputDir, { recursive: true });
  const realOutputDir = await fs.realpath(outputDir);
  if (!isWithin(resolvedCwd, realOutputDir)) throw new Error(`QA output resolves outside ${resolvedCwd}`);

  const statusPath = path.join(outputDir, "status.json");
  const status = {
    schemaVersion: 2,
    theme: { id: canonicalId, label: theme.label },
    state: "asset-audit-pass",
    generatedAt: new Date().toISOString(),
    visualReview: {
      requiredSurface: "actual Aura WebView2 on live claude.ai",
      fixtureImages: "forbidden",
    },
    payloads,
    assets,
  };
  await writeJsonAtomic(statusPath, status);
  return {
    themeId: canonicalId,
    outputDir: slash(path.relative(resolvedCwd, outputDir)),
    boardPath: null,
    statusPath,
    assetCount: assets.length,
    layerCount: layered ? assets.length : 0,
    modes: [...MODES],
  };
}
