#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { listThemes, PROJECT_ROOT, studioStyleFromTheme } from "./theme-core.mjs";

const SAFE_ARTWORK_PATH = /^assets\/theme-art\/(?:[a-z0-9-]+\/)?[a-z0-9-]+\.(?:svg|png|webp|avif)$/;
const SAFE_LAUNCHER_PATH = /^assets\/theme-art\/[a-z0-9-]+\/launcher-mark\.png$/;
const RETRIABLE_WINDOWS_WRITE_CODES = new Set(["EACCES", "EBUSY", "EPERM", "UNKNOWN"]);
const MAX_WRITE_ATTEMPTS = 6;

function samePath(left, right) {
  const normalize = (value) => {
    const resolved = path.resolve(value);
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
  };
  return normalize(left) === normalize(right);
}

async function sourcePublicationTempRoot() {
  const gitPath = path.join(PROJECT_ROOT, ".git");
  const stat = await fs.lstat(gitPath);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("Studio metadata publication requires a real source-checkout .git directory");
  }
  const [realProject, realGit] = await Promise.all([
    fs.realpath(PROJECT_ROOT),
    fs.realpath(gitPath),
  ]);
  if (!samePath(path.dirname(realGit), realProject)) {
    throw new Error("Studio metadata publication .git directory escaped the source checkout");
  }
  return realGit;
}

async function writeGeneratedFile(filePath, contents, temporaryRoot) {
  const temporary = path.join(
    temporaryRoot,
    `.claude-aura-generated-${process.pid}-${crypto.randomBytes(8).toString("hex")}.tmp`,
  );
  await fs.writeFile(temporary, contents, { encoding: "utf8", mode: 0o600, flag: "wx" });
  try {
    for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt += 1) {
      try {
        await fs.rename(temporary, filePath);
        return;
      } catch (error) {
        const canRetry = process.platform === "win32"
          && RETRIABLE_WINDOWS_WRITE_CODES.has(error?.code)
          && attempt < MAX_WRITE_ATTEMPTS;
        if (!canRetry) throw error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 100));
      }
    }
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

function studioMode(mode) {
  const semantic = { ...mode.semantic };
  const compat = Object.fromEntries(
    Object.entries(mode.tokens).filter(([name]) => !name.startsWith("--aura-")),
  );
  return {
    semantic,
    compat,
    // Keep the merged map so Studio applies exactly what the runtime emits.
    tokens: { ...mode.tokens },
    wallpaper: { ...mode.wallpaper },
  };
}

function studioArtwork(artwork, themeName, { layered = false } = {}) {
  if (!artwork) return null;
  if (!SAFE_ARTWORK_PATH.test(artwork.path)) {
    throw new Error(`Studio artwork for ${themeName} must be an isolated asset in assets/theme-art`);
  }
  if (layered && artwork.id) {
    return {
      id: artwork.id,
      path: artwork.path,
      role: artwork.role,
      appearance: artwork.appearance,
      context: artwork.context,
      viewport: artwork.viewport,
      visible: artwork.visible,
      opacity: artwork.opacity,
      mask: artwork.mask,
      mobile: artwork.mobile,
      frames: {
        normal: { ...artwork.frames.normal },
        wide: { ...artwork.frames.wide },
      },
    };
  }
  const result = {
    path: artwork.path,
    position: artwork.position,
    size: artwork.size,
    mobile: artwork.mobile,
  };
  if (layered) {
    result.opacity = artwork.opacity;
    result.mask = artwork.mask;
    result.role = artwork.role;
    result.appearance = artwork.appearance;
    result.contextOverrides = artwork.contextOverrides
      ? Object.fromEntries(Object.entries(artwork.contextOverrides).map(([context, override]) => [context, { ...override }]))
      : null;
  }
  return result;
}

function studioLauncher(launcher, themeName) {
  if (!launcher || !SAFE_LAUNCHER_PATH.test(launcher.asset)) {
    throw new Error(`Studio launcher for ${themeName} must use an isolated launcher mark`);
  }
  return { ...launcher };
}

const themes = await listThemes({ locale: "en" });
const compact = Object.fromEntries(themes.map((theme) => [theme.name, {
  name: theme.name,
  source: theme.source,
  variant: theme.variant,
  label: theme.label,
  description: theme.description,
  labels: { ...theme.labels },
  descriptions: { ...theme.descriptions },
  swatches: [...theme.swatches],
  preview: { ...theme.preview },
  launcher: studioLauncher(theme.launcher, theme.name),
  studioStyle: studioStyleFromTheme(theme),
  studioPreview: theme.studioPreview,
  studioPreviewFrame: theme.studioPreviewFrame ? { ...theme.studioPreviewFrame } : null,
  newChatLayout: theme.newChatLayout ? { ...theme.newChatLayout } : null,
  artwork: studioArtwork(theme.artwork, theme.name),
  artworkLayers: theme.artworkLayers
    ? theme.artworkLayers.map((layer) => studioArtwork(layer, theme.name, { layered: true }))
    : null,
  radius: theme.radius,
  blur: theme.blur,
  typography: { ...theme.typography },
  shape: { ...theme.shape },
  effects: { ...theme.effects },
  light: studioMode(theme.light),
  dark: studioMode(theme.dark),
}]));

// Studio preview masters are product assets, never renderer backgrounds or
// acceptance evidence. Registry validation keeps their paths theme-scoped.
const output = `// Generated by scripts/build-studio-themes.mjs.\nwindow.CLAUDE_AURA_THEMES = ${JSON.stringify(compact, null, 2)};\n`;
const outputPath = path.join(PROJECT_ROOT, "studio", "generated-themes.js");
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await writeGeneratedFile(outputPath, output, await sourcePublicationTempRoot());
console.log(outputPath);
