const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
const ID_PATTERN = /^[A-Za-z0-9._-]{1,200}$/;
const VERSION_PATTERN = /^\d{1,6}(?:\.\d{1,6}){1,3}$/;
const REASON_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const TARGET_TYPE_PATTERN = /^[a-z][a-z0-9_-]{0,47}$/;
const MARKER_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,47}$/;
const PACKAGING = new Set(["desktop", "msix"]);
const MAX_CDP_FRAME_BYTES = 262_144;

export const CDP_TIMEOUT_POLICY = Object.freeze({
  endpointMs: 2_000,
  socketOpenMs: 5_000,
  commandMs: 10_000,
  operationDefaultMs: 30_000,
  operationMinimumMs: 250,
  operationMaximumMs: 120_000,
});

export class BrowserIdentityChangedError extends Error {}

export function validatePort(value) {
  if (!Number.isInteger(value) || value < 1024 || value > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return value;
}

export function validateTimeoutPolicy(value) {
  if (!Number.isInteger(value)
      || value < CDP_TIMEOUT_POLICY.operationMinimumMs
      || value > CDP_TIMEOUT_POLICY.operationMaximumMs) {
    throw new Error(`Invalid timeout: ${value}`);
  }
  return value;
}

export function validateBrowserId(value) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new Error(`Invalid browser ID: ${value}`);
  }
  return value;
}

export function validateTargetId(value) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new Error("Rejected an invalid CDP target identity");
  }
  return value;
}

function sourceUrl(value) {
  const source = typeof value === "string" ? value : value?.webSocketDebuggerUrl;
  if (typeof source !== "string") throw new Error("Rejected an invalid CDP URL");
  const pathSource = source.replace(/^[a-z]+:\/\/[^/]+/i, "").split(/[?#]/, 1)[0];
  if (/(?:^|\/)\.{1,2}(?:\/|$)/.test(pathSource) || /%2e|%2f|%5c/i.test(pathSource)) {
    throw new Error("Rejected a CDP URL containing path traversal");
  }
  return source;
}

export function validateHttpEndpoint(value) {
  const source = sourceUrl(value);
  const url = new URL(source);
  const port = Number(url.port);
  if (url.protocol !== "http:" || !LOOPBACK_HOSTS.has(url.hostname)
      || !Number.isInteger(port) || port < 1024 || port > 65535
      || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("Rejected a CDP HTTP endpoint outside loopback");
  }
  return url.href;
}

export function validatedDebuggerUrl(value, port) {
  validatePort(port);
  const source = sourceUrl(value);
  const url = new URL(source);
  const pathIsValid = /^\/devtools\/(?:page|browser)\/[A-Za-z0-9._-]{1,200}$/.test(url.pathname);
  if (url.protocol !== "ws:" || !LOOPBACK_HOSTS.has(url.hostname) || Number(url.port) !== port
      || url.username || url.password || url.search || url.hash || !pathIsValid) {
    throw new Error("Rejected a CDP WebSocket URL outside the loopback endpoint");
  }
  return url.href;
}

export function browserIdFromVersion(version, port) {
  const url = new URL(validatedDebuggerUrl(version, port));
  const match = url.pathname.match(/^\/devtools\/browser\/([A-Za-z0-9._-]{1,200})$/);
  if (!match || !ID_PATTERN.test(match[1])) throw new Error("Rejected an invalid CDP browser identity");
  return match[1];
}

export function assertBrowserIdentity(version, port, expectedBrowserId) {
  validateBrowserId(expectedBrowserId);
  const actualBrowserId = browserIdFromVersion(version, port);
  if (actualBrowserId !== expectedBrowserId) {
    throw new BrowserIdentityChangedError(
      `CDP browser identity changed from ${expectedBrowserId} to ${actualBrowserId}`,
    );
  }
  return actualBrowserId;
}

export function potentialClaudeUrl(value) {
  try {
    const url = new URL(value);
    if (["file:", "app:"].includes(url.protocol)) return true;
    if (url.protocol === "about:" && url.pathname === "blank") return true;
    if (!["https:", "http:"].includes(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    return host === "claude.ai" || host.endsWith(".claude.ai");
  } catch {
    return false;
  }
}

export function validPageTarget(target, port) {
  if (target?.type !== "page" || typeof target.id !== "string" || !ID_PATTERN.test(target.id)
      || typeof target.url !== "string" || !potentialClaudeUrl(target.url)) return false;
  try {
    const url = new URL(validatedDebuggerUrl(target, port));
    return url.pathname === `/devtools/page/${target.id}`;
  } catch {
    return false;
  }
}

export function parseCdpFrame(value) {
  const text = String(value);
  if (Buffer.byteLength(text, "utf8") > MAX_CDP_FRAME_BYTES) {
    throw new Error("Rejected an oversized CDP frame");
  }
  let message;
  try {
    message = JSON.parse(text);
  } catch {
    throw new Error("Rejected a malformed CDP frame");
  }
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    throw new Error("Rejected a malformed CDP frame");
  }
  return message;
}

function sanitizeOrigin(value) {
  try {
    const url = new URL(value);
    if (["file:", "app:", "about:"].includes(url.protocol)) return url.protocol;
    if (!["https:", "http:"].includes(url.protocol) || url.origin.length > 200) return "unknown";
    return url.origin;
  } catch {
    return "unknown";
  }
}

export function sanitizeLogRecord(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const output = {};
  if (typeof source.reasonCode === "string" && REASON_PATTERN.test(source.reasonCode)) {
    output.reasonCode = source.reasonCode;
  }
  if (typeof source.decision === "string" && ["unknown", "verified"].includes(source.decision)) {
    output.decision = source.decision;
  }
  if (typeof source.version === "string" && VERSION_PATTERN.test(source.version)) {
    output.version = source.version;
  }
  if (typeof source.packaging === "string" && PACKAGING.has(source.packaging)) {
    output.packaging = source.packaging;
  }
  if (typeof source.type === "string" && TARGET_TYPE_PATTERN.test(source.type)) {
    output.type = source.type;
  }
  if (typeof source.origin === "string" || typeof source.url === "string") {
    output.origin = sanitizeOrigin(source.origin ?? source.url);
  }
  if (source.markers && typeof source.markers === "object" && !Array.isArray(source.markers)) {
    output.markers = Object.fromEntries(Object.entries(source.markers)
      .filter(([key, enabled]) => MARKER_PATTERN.test(key) && typeof enabled === "boolean")
      .slice(0, 32)
      .sort(([left], [right]) => left.localeCompare(right)));
  }
  return output;
}

function compareVersions(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

export function validateCompatibilityManifest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).sort().join(",") !== "defaultDecision,schemaVersion,verifiedRanges"
      || value.schemaVersion !== 1 || value.defaultDecision !== "unknown"
      || !Array.isArray(value.verifiedRanges) || value.verifiedRanges.length > 64) {
    throw new Error("Desktop compatibility manifest is invalid");
  }
  const ids = new Set();
  for (const entry of value.verifiedRanges) {
    const keys = [
      "id", "maximumVersion", "minimumVersion", "packaging",
      "payloadSchema", "requiredMarkerSets", "supportedSurfaces",
    ];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)
        || Object.keys(entry).sort().join(",") !== keys.sort().join(",")
        || typeof entry.id !== "string" || !REASON_PATTERN.test(entry.id) || ids.has(entry.id)
        || !VERSION_PATTERN.test(entry.minimumVersion) || !VERSION_PATTERN.test(entry.maximumVersion)
        || compareVersions(entry.minimumVersion, entry.maximumVersion) > 0
        || !Array.isArray(entry.packaging) || !entry.packaging.length
        || entry.packaging.some((item) => !PACKAGING.has(item))
        || !Number.isInteger(entry.payloadSchema) || entry.payloadSchema < 1
        || !Array.isArray(entry.supportedSurfaces) || !entry.supportedSurfaces.length
        || entry.supportedSurfaces.some((item) => !REASON_PATTERN.test(item))
        || !entry.requiredMarkerSets || typeof entry.requiredMarkerSets !== "object"
        || Array.isArray(entry.requiredMarkerSets)) {
      throw new Error("Desktop compatibility manifest is invalid");
    }
    for (const surface of entry.supportedSurfaces) {
      const markers = entry.requiredMarkerSets[surface];
      if (!Array.isArray(markers) || !markers.length || markers.length > 32
          || markers.some((marker) => !MARKER_PATTERN.test(marker))) {
        throw new Error("Desktop compatibility manifest is invalid");
      }
    }
    if (Object.keys(entry.requiredMarkerSets).sort().join(",")
        !== [...entry.supportedSurfaces].sort().join(",")) {
      throw new Error("Desktop compatibility manifest is invalid");
    }
    ids.add(entry.id);
  }
  return value;
}

export function decideDesktopCompatibility(manifest, input) {
  validateCompatibilityManifest(manifest);
  const version = typeof input?.version === "string" && VERSION_PATTERN.test(input.version)
    ? input.version : null;
  const packaging = typeof input?.packaging === "string" && PACKAGING.has(input.packaging)
    ? input.packaging : null;
  if (!version || !packaging || !Number.isInteger(input?.payloadSchema)) {
    return { decision: "unknown", reasonCode: "desktop-identity-invalid" };
  }
  const versionMatches = manifest.verifiedRanges.filter((entry) =>
    compareVersions(version, entry.minimumVersion) >= 0
    && compareVersions(version, entry.maximumVersion) <= 0
    && entry.packaging.includes(packaging)
    && entry.payloadSchema === input.payloadSchema);
  if (!versionMatches.length) {
    return { decision: manifest.defaultDecision, reasonCode: "desktop-version-unverified" };
  }
  const surface = typeof input.surface === "string" ? input.surface : "";
  const markers = new Set(Array.isArray(input.markers) ? input.markers : []);
  const match = versionMatches.find((entry) =>
    entry.supportedSurfaces.includes(surface)
    && entry.requiredMarkerSets[surface].every((marker) => markers.has(marker)));
  if (!match) return { decision: "unknown", reasonCode: "desktop-markers-unverified" };
  return { decision: "verified", reasonCode: "desktop-compatible", rangeId: match.id };
}
