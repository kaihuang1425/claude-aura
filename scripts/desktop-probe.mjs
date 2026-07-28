#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PROJECT_ROOT } from "./theme-core.mjs";
import {
  assertBrowserIdentity,
  BrowserIdentityChangedError,
  CDP_TIMEOUT_POLICY,
  decideDesktopCompatibility,
  sanitizeLogRecord,
  validateBrowserId,
  validateCompatibilityManifest,
  validateHttpEndpoint,
  validateTimeoutPolicy,
  validPageTarget,
} from "./desktop-cdp/validation.mjs";

const PROBE_RESOURCES = new Set(["/json/version", "/json/list"]);
const MAX_RESPONSE_BYTES = 262_144;

function parseArgs(argv) {
  const options = {
    endpoint: null,
    browserId: null,
    version: null,
    packaging: null,
    payloadSchema: 1,
    timeoutMs: CDP_TIMEOUT_POLICY.operationDefaultMs,
    compatibility: path.join(PROJECT_ROOT, "desktop-compatibility.json"),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--endpoint") options.endpoint = argv[++index];
    else if (arg === "--browser-id") options.browserId = argv[++index];
    else if (arg === "--desktop-version") options.version = argv[++index];
    else if (arg === "--packaging") options.packaging = argv[++index];
    else if (arg === "--payload-schema") options.payloadSchema = Number(argv[++index]);
    else if (arg === "--timeout-ms") options.timeoutMs = Number(argv[++index]);
    else if (arg === "--compatibility") options.compatibility = path.resolve(argv[++index]);
    else throw new Error("desktop-probe-argument-invalid");
  }
  options.endpoint = validateHttpEndpoint(options.endpoint);
  options.browserId = validateBrowserId(options.browserId);
  options.timeoutMs = validateTimeoutPolicy(options.timeoutMs);
  if (!Number.isInteger(options.payloadSchema) || options.payloadSchema < 1
      || typeof options.version !== "string" || typeof options.packaging !== "string") {
    throw new Error("desktop-probe-argument-invalid");
  }
  return options;
}

async function fetchProbeJson(endpoint, resource, timeoutMs, fetchImpl) {
  if (!PROBE_RESOURCES.has(resource)) throw new Error("desktop-probe-resource-rejected");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(
    timeoutMs,
    CDP_TIMEOUT_POLICY.endpointMs,
  ));
  try {
    const response = await fetchImpl(new URL(resource, endpoint), {
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("desktop-probe-http-error");
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) {
      throw new Error("desktop-probe-response-oversized");
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("desktop-probe-response-malformed");
    }
  } finally {
    clearTimeout(timeout);
  }
}

function targetRecord(target, port) {
  const targetIdValid = typeof target?.id === "string"
    && /^[A-Za-z0-9._-]{1,200}$/.test(target.id);
  const debuggerUrlValid = validPageTarget(target, port);
  const record = sanitizeLogRecord({
    type: typeof target?.type === "string" ? target.type : "unknown",
    url: typeof target?.url === "string" ? target.url : "",
    markers: {
      claudeOrigin: typeof target?.url === "string"
        && /^https?:\/\/(?:[^/]+\.)?claude\.ai(?::\d+)?(?:\/|$)/i.test(target.url),
      debuggerUrlValid,
      page: target?.type === "page",
      targetIdValid,
    },
  });
  return {
    type: record.type ?? "unknown",
    origin: record.origin ?? "unknown",
    markers: record.markers ?? {},
  };
}

function failureReason(error) {
  if (error instanceof BrowserIdentityChangedError) return "desktop-browser-identity-changed";
  if (error?.name === "AbortError") return "desktop-probe-timeout";
  if (typeof error?.message === "string"
      && /^[a-z][a-z0-9-]{1,63}$/.test(error.message)) return error.message;
  return "desktop-probe-failed";
}

export async function runDesktopProbe(options, dependencies = {}) {
  const fetchImpl = dependencies.fetch ?? fetch;
  const manifest = validateCompatibilityManifest(JSON.parse(
    await fs.readFile(options.compatibility, "utf8"),
  ));
  const endpoint = new URL(options.endpoint);
  const port = Number(endpoint.port);
  const versionResponse = await fetchProbeJson(
    options.endpoint,
    "/json/version",
    options.timeoutMs,
    fetchImpl,
  );
  assertBrowserIdentity(versionResponse, port, options.browserId);
  const targetResponse = await fetchProbeJson(
    options.endpoint,
    "/json/list",
    options.timeoutMs,
    fetchImpl,
  );
  if (!Array.isArray(targetResponse) || targetResponse.length > 64) {
    throw new Error("desktop-probe-target-list-invalid");
  }
  const targets = targetResponse.map((target) => targetRecord(target, port));
  const targetTypeCounts = {};
  for (const target of targets) {
    targetTypeCounts[target.type] = (targetTypeCounts[target.type] ?? 0) + 1;
  }
  const compatibility = decideDesktopCompatibility(manifest, {
    version: options.version,
    packaging: options.packaging,
    payloadSchema: options.payloadSchema,
    surface: "main",
    markers: [],
  });
  return {
    schemaVersion: 1,
    status: "ok",
    reasonCode: "desktop-probe-complete",
    browserPinned: true,
    compatibility,
    targetTypeCounts: Object.fromEntries(Object.entries(targetTypeCounts).sort()),
    targets,
  };
}

async function main() {
  try {
    const result = await runDesktopProbe(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      status: "blocked",
      reasonCode: failureReason(error),
    }, null, 2)}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
