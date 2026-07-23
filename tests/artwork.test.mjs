// artwork tests. Extracted from the former monolithic tests/run-tests.mjs.
import { test, runIfMain } from "./support/harness.mjs";
import { decodePng } from "../scripts/build-launcher-assets.mjs";
import {
  AURA_VERSION,
  BUILTIN_BRAND_MARK_ASSETS,
  BUILTIN_BRAND_WORDMARK_ASSETS,
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
  buildBrandWordmarks,
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

test("bundled artwork is isolated, lightweight, pointer-safe, and free of embedded UI text", async () => {
  const expected = {
    "japanese-film-editorial": {
      path: "assets/theme-art/japanese-film-editorial/brand-mark.svg",
      viewBox: "0 0 64 64",
      sha256: "2f8bced7e65883335abf304f2a48eb314405c138b6e4a2b989fdece4262eeff9",
      colors: ["#B24C2C", "#F2E4CC"],
    },
    "korean-prestige": {
      path: "assets/theme-art/korean-prestige/brand-mark.svg",
      viewBox: "0 0 24 24",
      sha256: "a99babfe25ff460f1bbc0e0e877ac39d4ddb3d024929095a1d3a62ec4a51cc31",
      colors: ["#C7A46B"],
    },
    "japanese-idol": {
      path: "assets/theme-art/japanese-idol/brand-mark.svg",
      viewBox: "0 0 128 128",
      sha256: "4722eb3838614b9d222e37830025526a5299d853b6e3323dfe51802de6efed08",
      colors: ["#F69AAA", "#EC7F95"],
    },
  };
  assert.deepEqual(BUILTIN_BRAND_MARK_ASSETS,
    Object.fromEntries(Object.entries(expected).map(([themeId, item]) => [themeId, item.path])),
  "The implementation-facing brand-mark map differs from the approved asset set");

  const hashes = [];
  for (const [themeId, item] of Object.entries(expected)) {
    const absolutePath = path.join(PROJECT_ROOT, item.path);
    const [stat, source, bytes] = await Promise.all([
      fs.stat(absolutePath),
      fs.readFile(absolutePath, "utf8"),
      fs.readFile(absolutePath),
    ]);
    const digest = crypto.createHash("sha256").update(bytes).digest("hex");
    hashes.push(digest);
    assert(stat.isFile() && stat.size > 0 && stat.size < 100_000,
      `${themeId} brand mark is empty or exceeds its vector budget`);
    assert.equal(digest, item.sha256, `${themeId} brand mark differs from its approved derivative`);
    assert.match(source, new RegExp(`viewBox=["']${item.viewBox.replaceAll(" ", "\\s+")}["']`, "i"));
    assert.match(source, /aria-hidden="true"/);
    assert.match(source, /focusable="false"/);
    assert.match(source, /pointer-events="none"/);
    assert(!/<(?:script|style|foreignObject|image|use|text|title|desc)\b/i.test(source),
      `${themeId} brand mark contains active or textual SVG content`);
    assert(!/\b(?:xlink:)?href\s*=|\bcurrentColor\b|\bon[a-z]+\s*=/i.test(source),
      `${themeId} brand mark contains a dynamic SVG feature`);
    for (const color of item.colors) assert(source.includes(color), `${themeId} brand mark lost ${color}`);
  }
  assert.equal(new Set(hashes).size, hashes.length, "Approved brand marks must remain visually distinct assets");

  for (const themeId of THEME_IDS.filter((id) => !Object.hasOwn(expected, id))) {
    for (const extension of ["svg", "png", "webp", "avif"]) {
      await assert.rejects(
        fs.access(path.join(PROJECT_ROOT, "assets", "theme-art", themeId, `brand-mark.${extension}`)),
        (error) => error?.code === "ENOENT",
        `${themeId} gained an unapproved in-page brand mark instead of using the native Claude fallback`,
      );
    }
  }

  assert.deepEqual(
    Object.keys(BUILTIN_BRAND_WORDMARK_ASSETS),
    THEME_IDS,
    "Every built-in theme must own one registered Light/Dark wordmark pair",
  );
  const themes = await listThemes();
  const themesById = new Map(themes.map((theme) => [theme.name, theme]));
  const beforeBuildDigests = new Map();
  const allWordmarkDigests = [];
  for (const themeId of THEME_IDS) {
    const registered = BUILTIN_BRAND_WORDMARK_ASSETS[themeId];
    assert.deepEqual(
      registered,
      {
        light: `assets/theme-art/${themeId}/brand-wordmark-light.png`,
        dark: `assets/theme-art/${themeId}/brand-wordmark-dark.png`,
        minWidth: 136,
        width: 160,
      },
      `${themeId} wordmark registration differs from the built-in desktop contract`,
    );
    const pairDigests = [];
    const pairAlphaDigests = [];
    for (const appearance of ["light", "dark"]) {
      const assetPath = registered[appearance];
      const absolutePath = path.join(PROJECT_ROOT, assetPath);
      const [stat, bytes] = await Promise.all([fs.stat(absolutePath), fs.readFile(absolutePath)]);
      const digest = crypto.createHash("sha256").update(bytes).digest("hex");
      const image = decodePng(bytes, `${themeId} ${appearance} wordmark`);
      const alpha = Buffer.alloc(image.width * image.height);
      const wordmarkLumas = [];
      let transparentPixels = 0;
      let visiblePixels = 0;
      let partiallyTransparentPixels = 0;
      for (let index = 0; index < alpha.length; index += 1) {
        const value = image.pixels[(index * 4) + 3];
        alpha[index] = value;
        if (value === 0) transparentPixels += 1;
        else {
          visiblePixels += 1;
          if (value < 255) partiallyTransparentPixels += 1;
          if (value >= 128 && (index % image.width) >= Math.floor(image.width * 0.28)) {
            const pixel = index * 4;
            wordmarkLumas.push(
              (image.pixels[pixel] * 0.2126)
              + (image.pixels[pixel + 1] * 0.7152)
              + (image.pixels[pixel + 2] * 0.0722),
            );
          }
        }
      }
      pairDigests.push(digest);
      pairAlphaDigests.push(crypto.createHash("sha256").update(alpha).digest("hex"));
      allWordmarkDigests.push(digest);
      beforeBuildDigests.set(assetPath, digest);
      assert(stat.isFile() && stat.size > 0 && stat.size < 400_000,
        `${themeId} ${appearance} wordmark is empty or exceeds its raster budget`);
      assert.deepEqual([image.width, image.height], [344, 124],
        `${themeId} ${appearance} wordmark must remain at the approved @2x dimensions`);
      assert(transparentPixels > 0 && visiblePixels > 0 && partiallyTransparentPixels > 0,
        `${themeId} ${appearance} wordmark lost its transparent antialiased silhouette`);
      wordmarkLumas.sort((left, right) => left - right);
      const quartile = (ratio) => wordmarkLumas[Math.floor((wordmarkLumas.length - 1) * ratio)];
      const sidebarText = themesById.get(themeId)[appearance].semantic["--aura-sidebar-text-primary"];
      if (luminance(sidebarText) > 0.5) {
        assert(quartile(0.75) > 160,
          `${themeId} ${appearance} wordmark stayed dark beside light sidebar labels`);
      } else {
        assert(quartile(0.25) < 128,
          `${themeId} ${appearance} wordmark stayed light beside dark sidebar labels`);
      }
    }
    if (themeId === "korean-idol") {
      const approvedSource = await fs.readFile(path.join(
        PROJECT_ROOT,
        "assets",
        "studio-previews",
        "references",
        "in-page-brand-wordmarks-v1",
        "korean-idol.png",
      ));
      const approvedDigest = crypto.createHash("sha256").update(approvedSource).digest("hex");
      assert.deepEqual(pairDigests, [approvedDigest, approvedDigest],
        "Korean Idol must preserve its approved full-color demo lockup in both appearances");
    } else {
      assert.equal(new Set(pairDigests).size, 2,
        `${themeId} must retain distinct Light and Dark wordmark assets`);
    }
    assert.equal(new Set(pairAlphaDigests).size, 1,
      `${themeId} Light and Dark must preserve the exact same lockup silhouette`);
  }
  assert.equal(new Set(allWordmarkDigests).size, (THEME_IDS.length * 2) - 1,
    "Only Korean Idol may intentionally share its approved full-color wordmark across appearances");

  await buildBrandWordmarks();
  for (const [assetPath, expectedDigest] of beforeBuildDigests) {
    const rebuiltBytes = await fs.readFile(path.join(PROJECT_ROOT, assetPath));
    assert.equal(
      crypto.createHash("sha256").update(rebuiltBytes).digest("hex"),
      expectedDigest,
      `${assetPath} was not reproduced deterministically`,
    );
  }

  assert.equal(themes.filter((theme) => theme.artwork || theme.artworkLayers).length, 7);
  const validateSvgArtwork = async (themeName, artworkPath) => {
    const stat = await fs.stat(artworkPath);
    const source = await fs.readFile(artworkPath, "utf8");
    assert(stat.isFile() && stat.size > 0 && stat.size < 100_000, `${themeName} artwork size is unexpected`);
    assert.match(source, /<svg\b/);
    assert.match(source, /pointer-events="none"/);
    assert(!/<text\b/i.test(source), `${themeName} artwork contains embedded text`);
    assert(!/(?:https?:\/\/(?!www\.w3\.org\/2000\/svg)|data:|(?:xlink:)?href=)/i.test(source),
      `${themeName} artwork contains an external or embedded resource`);
  };
  const validateRasterArtwork = async (themeName, artworkPath) => {
    const stat = await fs.stat(artworkPath);
    assert(stat.isFile() && stat.size > 0 && stat.size < 400_000, `${themeName} raster artwork size is unexpected`);
    const bytes = await fs.readFile(artworkPath);
    assert(bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP",
      `${themeName} raster artwork must be WebP`);
    return bytes;
  };
  const assertWebpAlpha = (themeName, artworkPath, bytes) => {
    const vp8xOffset = bytes.indexOf(Buffer.from("VP8X"));
    assert(vp8xOffset >= 0 && (bytes[vp8xOffset + 8] & 0x10) !== 0,
      `${themeName} ${path.basename(artworkPath)} must retain real alpha instead of a baked matte`);
  };
  for (const theme of themes.filter((item) => item.artwork)) {
    await validateSvgArtwork(theme.name, path.join(PROJECT_ROOT, theme.artwork.path));
  }
  for (const theme of themes.filter((item) => item.artworkLayers)) {
    for (const layer of theme.artworkLayers) {
      const artworkPath = path.join(PROJECT_ROOT, layer.path);
      if (layer.path.endsWith(".svg")) await validateSvgArtwork(theme.name, artworkPath);
      else {
        const bytes = await validateRasterArtwork(theme.name, artworkPath);
        if (["hero", "decoration"].includes(layer.role)) assertWebpAlpha(theme.name, artworkPath, bytes);
      }
    }
  }
  const baseCss = await fs.readFile(path.join(PROJECT_ROOT, "assets", "base.css"), "utf8");
  assert.match(baseCss, /#claude-aura-backdrop \*/);
  assert.match(baseCss, /pointer-events: none !important/);
  assert.match(baseCss, /prefers-contrast: more/);
  assert.match(baseCss, /forced-colors: active/);
  assert.equal(await resolveArtwork({ artwork: { path: "assets/theme-art/not-present.svg" } }), null);
  await assert.rejects(resolveArtwork({ artwork: { path: "themes/default.json" } }), /inside/);
  assert.match(baseCss, /prefers-reduced-motion: reduce/);
  const verifier = await fs.readFile(path.join(PROJECT_ROOT, "scripts", "verify-cycle.mjs"), "utf8");
  assert.match(verifier, /const MODES = \["light", "dark"\]/);
  assert.match(verifier, /for \(const mode of MODES\)/);
  assert.match(verifier, /new Function\(bundle\.payload\)/);
  assert.match(verifier, /actual Aura on live claude\.ai/);
  for (const forbidden of ["claude-dom", "--screenshot", "docs/golden", "dist/verify", "aura-verify-preload"]){
    assert(!verifier.includes(forbidden), `verify:cycle retains forbidden image-fixture hook: ${forbidden}`);
  }
  await assert.rejects(fs.access(path.join(PROJECT_ROOT, "docs", "golden")),
    (error) => error?.code === "ENOENT", "Fixture golden directory still exists");
  await assert.rejects(fs.access(path.join(PROJECT_ROOT, "tests", "fixtures", "claude-dom.html")),
    (error) => error?.code === "ENOENT", "Claude DOM image fixture still exists");
  for (const retiredPath of [
    "preview",
    "docs/theme-screenshots",
    "scripts/qa-board.mjs",
  ]) {
    await assert.rejects(fs.access(path.join(PROJECT_ROOT, ...retiredPath.split("/"))),
      (error) => error?.code === "ENOENT", `Retired fixture surface still exists: ${retiredPath}`);
  }

  const artifactFiles = [];
  const scanArtifacts = async (directory, relativeDirectory = "") => {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) await scanArtifacts(absolutePath, relativePath);
      else if (entry.isFile()) artifactFiles.push(relativePath.replaceAll("\\", "/"));
    }
  };
  await scanArtifacts(path.join(PROJECT_ROOT, "dist", "verify"), "dist/verify");
  await scanArtifacts(path.join(PROJECT_ROOT, "themes"), "themes");
  const retiredFixturePatterns = [
    /^dist\/verify\/[^/]+-(?:light|dark)-1440x900\.(?:html|png)$/,
    /\/qa\/qa-board\.png$/,
    /\/provisional\/candidates\/.*candidate-[123]-(?:light|dark)-1440x900\.png$/,
    /\/qa\/selected-(?:light|dark)-1440x900\.png$/,
    /\/references\/checkpoint-a-(?:light|dark)-1440x900\.png$/,
  ];
  assert.deepEqual(artifactFiles.filter((file) => retiredFixturePatterns.some((pattern) => pattern.test(file))), [],
    "A retired fixture image or render harness artifact was recreated");

  // The planning docs under docs/plans/ are now developer-local (git rm --cached
  // + .gitignore), so they are no longer asserted here; the retired-fixture-image
  // guard above is the shipped enforcement and stays.
});

runIfMain(import.meta.url);
