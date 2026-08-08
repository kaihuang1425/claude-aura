// WO-25 public contracts: sparse surface resolution and bounded layer filters.
import { test, runIfMain } from "./support/harness.mjs";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  PROJECT_ROOT,
  layerFilterCss,
  promptFrameOverrides,
  resolveBrandWordmark,
  renderInterfaceSurfacesCss,
  resolveInterfaceSurface,
  validateInterfaceSurfaces,
  validateLayerFilters,
} from "../scripts/theme-core.mjs";

const SURFACES = Object.freeze({
  sidebar: {
    base: { primaryText: "#111111", spacing: "comfortable", rowRadius: 12 },
    appearance: { dark: { primaryText: "#F5F5F5", surface: "#191919" } },
  },
  sidebarIdentity: {
    base: { mode: "styled-label", font: "editorial-serif", weight: 600, fontSize: 20 },
    appearance: { dark: { color: "#F4F4F4" } },
  },
  promptBlock: {
    base: { surface: "#FFFFFF", foreground: "#171717", focus: "#7866D5", radius: 20, shadow: "soft" },
    appearance: { dark: { surface: "#202020", foreground: "#F7F7F7", focus: "#B7A7FF" } },
    frame: {
      standard: { widthRatio: 0.64, offsetXRatio: 0, offsetYRatio: -0.05 },
      wide: { widthRatio: 0.58, offsetXRatio: 0.08, offsetYRatio: -0.08 },
    },
  },
});

test("interface surfaces resolve sparse values base then appearance then frame", () => {
  const value = validateInterfaceSurfaces(SURFACES, "theme.interfaceSurfaces");
  assert.deepEqual(resolveInterfaceSurface(value.sidebar, { appearance: "light" }), {
    primaryText: "#111111", spacing: "comfortable", rowRadius: 12,
  });
  assert.deepEqual(resolveInterfaceSurface(value.sidebar, { appearance: "dark" }), {
    primaryText: "#F5F5F5", spacing: "comfortable", rowRadius: 12, surface: "#191919",
  });
  assert.equal(resolveInterfaceSurface(value.promptBlock, {
    appearance: "dark", view: "new-chat", frame: "wide",
  }).offsetXRatio, 0.08);
  assert.deepEqual(promptFrameOverrides(value, {
    widthRatio: 0.7, offsetXRatio: 0, offsetYRatio: 0,
  }), {
    standard: { widthRatio: 0.64, offsetXRatio: 0, offsetYRatio: -0.05 },
    wide: { widthRatio: 0.58, offsetXRatio: 0.08, offsetYRatio: -0.08 },
  });
});

test("interface surfaces reject arbitrary selectors, slots, values, and unsafe identity references", () => {
  assert.throws(() => validateInterfaceSurfaces({ sidebar: { view: { code: { surface: "#FFFFFF" } } } }),
    /not supported|unsupported/);
  assert.throws(() => validateInterfaceSurfaces({ sidebar: { base: { selector: "body" } } }),
    /unsupported property/);
  assert.throws(() => validateInterfaceSurfaces({ promptBlock: { base: { surface: "url(https:\/\/example.com)" } } }),
    /six-digit hex/);
  assert.throws(() => validateInterfaceSurfaces({ sidebarIdentity: { base: {
    mode: "local-mark", markDigest: "A".repeat(64),
  } } }), /lowercase SHA-256/);
  assert.throws(() => validateInterfaceSurfaces({ sidebarIdentity: { base: {
    mode: "inherited-builtin",
  } } }), /requires sourceRecipe/);
});

test("interface CSS stays role-scoped and never carries author selectors or URLs", () => {
  const css = renderInterfaceSurfacesCss(validateInterfaceSurfaces(SURFACES));
  assert.match(css, /\[data-claude-aura-sidebar]/);
  assert.match(css, /\[data-aura-role="composer-shell"]/);
  assert.match(css, /:focus-within/);
  assert(!css.includes("url("));
  assert(!css.includes("body{"));
});

test("sidebar identity keeps Light and Dark mode, sizing, and treatment independent", async () => {
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-surface-identity-"));
  try {
    await fs.copyFile(
      path.join(PROJECT_ROOT, "assets", "theme-art", "default", "launcher-mark.png"),
      path.join(temporary, "sidebar-identity.png"),
    );
    const wordmark = await resolveBrandWordmark({
      source: "user",
      sourceRecipe: "default",
      artworkRoot: temporary,
      artworkAllowedRoot: temporary,
      light: { semantic: { "--aura-sidebar-text-primary": "0 0% 12%" } },
      dark: { semantic: { "--aura-sidebar-text-primary": "0 0% 92%" } },
      interfaceSurfaces: {
        sidebarIdentity: {
          base: { mode: "styled-label", font: "editorial-serif", fontSize: 18 },
          appearance: {
            dark: {
              mode: "local-mark",
              markDigest: "a".repeat(64),
              markSize: 60,
              markTreatment: "accent",
            },
          },
        },
      },
    });
    assert.deepEqual({
      lightKind: wordmark.lightKind,
      darkKind: wordmark.darkKind,
      lightMinWidth: wordmark.lightMinWidth,
      lightWidth: wordmark.lightWidth,
      darkMinWidth: wordmark.darkMinWidth,
      darkWidth: wordmark.darkWidth,
      lightTreatment: wordmark.lightTreatment,
      darkTreatment: wordmark.darkTreatment,
    }, {
      lightKind: "wordmark",
      darkKind: "local",
      lightMinWidth: 96,
      lightWidth: 104,
      darkMinWidth: 36,
      darkWidth: 60,
      lightTreatment: "original",
      darkTreatment: "accent",
    });
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("layer filters normalize neutral values and compile in one fixed order", () => {
  assert.equal(validateLayerFilters({
    hueDeg: 0, saturation: 1, brightness: 1, contrast: 1, blurPx: 0,
  }), null);
  const filters = validateLayerFilters({
    contrast: 1.2, hueDeg: -15, blurPx: 3, saturation: 0.8, brightness: 1.1,
  });
  assert.deepEqual(filters, {
    contrast: 1.2, hueDeg: -15, blurPx: 3, saturation: 0.8, brightness: 1.1,
  });
  assert.equal(layerFilterCss(filters),
    "hue-rotate(-15deg) saturate(0.8) brightness(1.1) contrast(1.2) blur(3px)");
  assert.throws(() => validateLayerFilters({ hueDeg: 181 }), /between -180 and 180/);
  assert.throws(() => validateLayerFilters({ blurPx: "4px" }), /between 0 and 24/);
  assert.throws(() => validateLayerFilters({ raw: "invert(1)" }), /unsupported property/);
});

await runIfMain(import.meta.url);
