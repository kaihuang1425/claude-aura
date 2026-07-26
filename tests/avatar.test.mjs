// Personal account-avatar overlay tests: the compile pipeline (embed, budget
// exemption, strip-when-absent, oversize rejection, fail-open shedding) and the
// renderer overlay lifecycle (mount over the account button, then clear).
import { test, runIfMain } from "./support/harness.mjs";
import {
  assert, fs, path, PROJECT_ROOT, DEFAULT_CONFIG,
  compileTheme, buildPayload, buildPayloadFromCompiled, writeConfig, readPayloadSettings,
} from "./support/context.mjs";

// A minimal but real 1x1 PNG.
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test("personal avatar embeds, stays budget-exempt, strips when absent, and fits every built-in theme", async () => {
  // Avatar-free payload carries none of the overlay code or CSS, and omits the setting.
  const base = await buildPayload({ config: { ...DEFAULT_CONFIG } });
  assert(!base.payload.includes("data-claude-aura-avatar"),
    "An avatar-free payload must ship no overlay code or CSS");
  assert.equal(readPayloadSettings(base.payload).avatarDataUrl, undefined,
    "An avatar-free payload must omit avatarDataUrl");

  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-avatar-"));
  try {
    const configPath = path.join(temporary, "config.json");
    const avatarPath = path.join(temporary, "me.png");
    await fs.writeFile(avatarPath, PNG_1x1);

    // A missing avatar file fails open to the native avatar with a stripped diagnostic.
    await writeConfig(configPath, { ...DEFAULT_CONFIG, avatar: path.join(temporary, "missing.png") });
    const missing = await compileTheme({ configPath });
    assert.equal(missing.settings.avatarDataUrl, undefined,
      "A missing avatar file must not produce a data URL");
    assert.equal(missing.settings.avatarUnavailable, true,
      "A missing avatar file must surface the unavailable diagnostic");
    const missingBundle = await buildPayloadFromCompiled(missing);
    assert.equal(readPayloadSettings(missingBundle.payload).avatarUnavailable, undefined,
      "The unavailable diagnostic must never ship to the renderer");

    // A valid avatar resolves to a data URL and ships the overlay code plus CSS.
    await writeConfig(configPath, { ...DEFAULT_CONFIG, avatar: avatarPath });
    const compiled = await compileTheme({ configPath });
    assert(compiled.settings.avatarDataUrl.startsWith("data:image/png;base64,"),
      "A valid avatar must resolve to a data URL");
    const bundle = await buildPayloadFromCompiled(compiled);
    assert(bundle.payload.includes("data-claude-aura-avatar-host"),
      "A configured avatar must ship the overlay markers");
    assert(bundle.css.includes("[data-claude-aura-avatar]"),
      "The overlay CSS must ride along only when an avatar is set");
    assert.equal(readPayloadSettings(bundle.payload).avatarDataUrl, compiled.settings.avatarDataUrl,
      "The runtime settings must carry the avatar data URL");

    // The avatar embed is excluded from the chrome budget and not counted as theme artwork.
    assert.equal(bundle.payloadBudget.embeddedArtworkBytes, base.payloadBudget.embeddedArtworkBytes,
      "A personal avatar must not count against the theme-artwork budget");
    const baseEmbedded = base.payloadBudget.payloadBytes - base.payloadBudget.chromeBytes;
    const avatarEmbedded = bundle.payloadBudget.payloadBytes - bundle.payloadBudget.chromeBytes;
    assert(avatarEmbedded > baseEmbedded,
      "The avatar image bytes must live outside the chrome budget");

    // An oversized avatar is rejected outright.
    const bigPath = path.join(temporary, "big.png");
    await fs.writeFile(bigPath, Buffer.concat([PNG_1x1, Buffer.alloc(2 * 1024 * 1024 + 1)]));
    await writeConfig(configPath, { ...DEFAULT_CONFIG, avatar: bigPath });
    await assert.rejects(compileTheme({ configPath }), /Avatar exceeds 2 MB/,
      "An avatar larger than 2 MB must be rejected");

    // The compact overlay fits even the heaviest built-in theme under the chrome
    // budget (buildPayload enforces it, so this throws if it neither fit nor shed).
    await writeConfig(configPath, { ...DEFAULT_CONFIG, theme: "korean-idol", avatar: avatarPath });
    const heavy = await buildPayload({ configPath });
    assert.equal(readPayloadSettings(heavy.payload).avatarDataUrl, compiled.settings.avatarDataUrl,
      "The overlay must fit even the heaviest built-in theme rather than shedding");
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("the renderer overlays the account avatar and clears it on teardown", async () => {
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-avatar-dom-"));
  try {
    const configPath = path.join(temporary, "config.json");
    const avatarPath = path.join(temporary, "me.png");
    await fs.writeFile(avatarPath, PNG_1x1);
    await writeConfig(configPath, { ...DEFAULT_CONFIG, avatar: avatarPath });
    const bundle = await buildPayload({ configPath });
    const avatarDataUrl = readPayloadSettings(bundle.payload).avatarDataUrl;
    assert(avatarDataUrl, "The avatar must survive into this theme's payload");

    // --- Minimal fake DOM reaching the avatar path ---
    const computed = new Map();
    class El {
      constructor(tag) {
        this.tagName = tag.toUpperCase();
        this.nodeName = this.tagName;
        this.children = [];
        this.parentNode = null;
        this.parentElement = null;
        this.textContent = "";
        this.dataset = {};
        this.naturalWidth = 8;
        this.attrs = {};
        this.classList = {
          _s: new Set(),
          add(...c) { for (const x of c) this._s.add(x); },
          remove(...c) { for (const x of c) this._s.delete(x); },
          contains(x) { return this._s.has(x); },
          toggle(x) { this._s.has(x) ? this._s.delete(x) : this._s.add(x); },
        };
        this.rect = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
        this.style = {
          _v: {},
          setProperty: (k, v) => { this.style._v[k] = String(v); },
          getPropertyValue: (k) => this.style._v[k] ?? "",
          removeProperty: (k) => { delete this.style._v[k]; },
        };
        if (this.tagName === "IMG") this.decode = () => Promise.resolve();
      }
      get childNodes() { return this.children; }
      get isConnected() { return this.tagName === "HTML" || Boolean(this.parentNode?.isConnected); }
      getBoundingClientRect() { return { ...this.rect }; }
      appendChild(c) { c.remove(); this.children.push(c); c.parentNode = this; c.parentElement = this; return c; }
      prepend(c) { c.remove(); this.children.unshift(c); c.parentNode = this; c.parentElement = this; return c; }
      remove() {
        if (!this.parentNode) return;
        this.parentNode.children = this.parentNode.children.filter((x) => x !== this);
        this.parentNode = null; this.parentElement = null;
      }
      contains(n) { return n === this || this.children.some((c) => c.contains(n)); }
      setAttribute(k, v) { this.attrs[k] = String(v); this[k] = String(v); }
      getAttribute(k) { return this.attrs[k] ?? null; }
      removeAttribute(k) { delete this.attrs[k]; delete this[k]; }
      _matchOne(sel) {
        sel = sel.trim();
        const tag = sel.match(/^[a-z]+/i)?.[0];
        if (tag && this.tagName !== tag.toUpperCase()) return false;
        const attr = sel.match(/\[([a-z-]+)(?:=["']([^"']*)["'])?\]/i);
        if (attr) {
          const have = this.getAttribute(attr[1]);
          if (attr[2] === undefined) return have !== null;
          return have === attr[2];
        }
        return Boolean(tag);
      }
      matches(sel) { return sel.split(",").some((p) => this._matchOne(p)); }
      querySelectorAll(sel) {
        return this.children.flatMap((c) => [...(c.matches(sel) ? [c] : []), ...c.querySelectorAll(sel)]);
      }
      querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
    }

    const document = {
      documentElement: new El("html"),
      head: new El("head"),
      body: new El("body"),
      createElement: (t) => new El(t),
      getElementById: () => null,
      addEventListener() {}, removeEventListener() {},
    };
    document.documentElement.appendChild(document.head);
    document.documentElement.appendChild(document.body);
    document.querySelectorAll = (sel) => document.documentElement.querySelectorAll(sel);
    document.querySelector = (sel) => document.querySelectorAll(sel)[0] ?? null;

    const sidebar = new El("nav");
    sidebar.rect = { left: 0, top: 0, right: 260, bottom: 760, width: 260, height: 760 };
    document.body.appendChild(sidebar);
    const account = new El("button");
    account.setAttribute("data-testid", "account-menu");
    account.rect = { left: 8, top: 712, right: 252, bottom: 752, width: 244, height: 40 };
    sidebar.appendChild(account);
    const avatar = new El("img");
    avatar.rect = { left: 12, top: 716, right: 44, bottom: 748, width: 32, height: 32 };
    account.appendChild(avatar);

    const style = (el) => ({
      display: "block", visibility: "visible", position: "static", translate: "none",
      color: "rgb(20, 20, 30)",
      backgroundImage: el === avatar ? "none" : "none",
      borderRadius: el === avatar ? "50%" : "0px",
    });
    const raf = (fn) => { fn(0); return 0; };
    const window = {
      innerWidth: 1280, innerHeight: 800,
      screen: { availWidth: 1440, availHeight: 900 },
      getComputedStyle: (el) => style(el),
      matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, media: "" }),
      requestAnimationFrame: raf,
      addEventListener() {}, removeEventListener() {},
      navigation: { addEventListener() {}, removeEventListener() {} },
      getSelection: () => null,
    };
    class FakeMutationObserver { observe() {} disconnect() {} takeRecords() { return []; } }

    const inject = new Function(
      "window", "document", "MutationObserver", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
      bundle.payload,
    );
    inject(window, document, FakeMutationObserver, () => 0, () => {}, (fn) => { fn(); return 0; }, () => {});

    const overlays = () => document.querySelectorAll("[data-claude-aura-avatar]");
    assert.equal(overlays().length, 1, "The renderer must overlay exactly one avatar image on the account button");
    const overlay = overlays()[0];
    assert.equal(overlay.parentElement, account, "The overlay must live inside the account button");
    assert.equal(overlay.getAttribute("aria-hidden"), "true", "The overlay must be hidden from assistive tech");
    // The overlay is positioned over the avatar box (12-8=4px inset within the button).
    assert.equal(overlay.style.getPropertyValue("width"), "32px");
    assert.equal(overlay.style.getPropertyValue("left"), "4px");

    // The image decodes; the host is marked ready so the CSS can reveal it.
    overlay.onload();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(overlay.src, avatarDataUrl, "The overlay must carry the avatar data URL");
    assert.equal(account.getAttribute("data-claude-aura-avatar-host"), "ready",
      "A decoded overlay must mark its host ready");
    assert.equal(account.getAttribute("data-claude-aura-avatar-flow"), "true",
      "A statically positioned host must receive the relative-position marker");

    // Disabling Aura tears the overlay down and restores the native avatar.
    window.__CLAUDE_AURA_STATE__.cleanup();
    assert.equal(overlays().length, 0, "Teardown must remove the avatar overlay");
    assert.equal(account.getAttribute("data-claude-aura-avatar-host"), null,
      "Teardown must clear the host markers");
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

runIfMain(import.meta.url);
