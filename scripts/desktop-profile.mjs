#!/usr/bin/env node
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import {
  assertBrowserIdentity,
  CDP_TIMEOUT_POLICY,
  sanitizeLogRecord,
  validateBrowserId,
  validatedDebuggerUrl,
  validateHttpEndpoint,
  validateTimeoutPolicy,
  validPageTarget,
} from "./desktop-cdp/validation.mjs";
import { DesktopCdpSession } from "./desktop-cdp/session.mjs";

const PROFILE_RESOURCES = new Set(["/json/version", "/json/list"]);
const MAX_RESPONSE_BYTES = 262_144;
const SAFE_VARIABLE = /^--(?:accent|background|bg|border|color|font|gray|grey|icon|radius|shadow|sidebar|surface|text)[-a-z0-9]{0,63}$/;
const OWNER = "claude-aura-desktop-probe-v1";
const PROFILE_GATE_A_ENABLED = false;

function parseArgs(argv) {
  const options = {
    endpoint: null,
    browserId: null,
    timeoutMs: CDP_TIMEOUT_POLICY.operationDefaultMs,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--endpoint") options.endpoint = argv[++index];
    else if (arg === "--browser-id") options.browserId = argv[++index];
    else if (arg === "--timeout-ms") options.timeoutMs = Number(argv[++index]);
    else throw new Error("desktop-profile-argument-invalid");
  }
  options.endpoint = validateHttpEndpoint(options.endpoint);
  options.browserId = validateBrowserId(options.browserId);
  options.timeoutMs = validateTimeoutPolicy(options.timeoutMs);
  return options;
}

async function fetchJson(endpoint, resource, timeoutMs, fetchImpl = fetch) {
  if (!PROFILE_RESOURCES.has(resource)) throw new Error("desktop-profile-resource-rejected");
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
    if (!response.ok) throw new Error("desktop-profile-http-error");
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) {
      throw new Error("desktop-profile-response-oversized");
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("desktop-profile-response-malformed");
    }
  } finally {
    clearTimeout(timeout);
  }
}

export function diagnosticExpression() {
  return `(() => {
    const owner = ${JSON.stringify(OWNER)};
    const root = document.documentElement;
    if (!root || !document.body) return { pass: false, reasonCode: "desktop-document-unready" };
    const styleId = "claude-aura-desktop-probe";
    const existing = document.getElementById(styleId);
    if (existing && existing.getAttribute("data-claude-aura-owner") !== owner) {
      return { pass: false, reasonCode: "desktop-owned-id-collision" };
    }
    if (root.hasAttribute("data-claude-aura-desktop-probe")
        && root.getAttribute("data-claude-aura-desktop-probe") !== owner) {
      return { pass: false, reasonCode: "desktop-owned-marker-collision" };
    }
    let style = null;
    let probeApplied = false;
    let cleanupComplete = false;
    const variables = [];
    let reasonCode = "desktop-profile-complete";
    try {
      existing?.remove();
      root.removeAttribute("data-claude-aura-desktop-probe");
      style = document.createElement("style");
      style.id = styleId;
      style.setAttribute("data-claude-aura-owner", owner);
      style.textContent = ':root[data-claude-aura-desktop-probe="' + owner
        + '"]{--claude-aura-desktop-probe:1}';
      (document.head || root).appendChild(style);
      root.setAttribute("data-claude-aura-desktop-probe", owner);
      const computed = getComputedStyle(root);
      probeApplied = computed
        .getPropertyValue("--claude-aura-desktop-probe").trim() === "1";
      for (let index = 0;
        index < computed.length && index < 4096 && variables.length < 128;
        index += 1) {
        const name = computed.item(index);
        if (${SAFE_VARIABLE.toString()}.test(name)) variables.push(name);
      }
    } catch {
      reasonCode = "desktop-profile-evaluation-failed";
    } finally {
      try {
        root.removeAttribute("data-claude-aura-desktop-probe");
      } catch {}
      try {
        style?.remove();
      } catch {}
      try {
        cleanupComplete = !document.getElementById(styleId)
          && !root.hasAttribute("data-claude-aura-desktop-probe")
          && getComputedStyle(root)
            .getPropertyValue("--claude-aura-desktop-probe").trim() === "";
      } catch {
        cleanupComplete = false;
      }
    }
    variables.sort();
    if (reasonCode === "desktop-profile-complete" && !probeApplied) {
      reasonCode = "desktop-profile-apply-failed";
    }
    const pass = reasonCode === "desktop-profile-complete"
      && probeApplied && cleanupComplete;
    if (!cleanupComplete) reasonCode = "desktop-profile-cleanup-failed";
    return {
      pass,
      reasonCode,
      markers: {
        body: Boolean(document.body),
        documentRoot: Boolean(root),
        probeApplied,
        cleanupComplete,
        themeVariables: variables.length > 0,
      },
      variables,
    };
  })()`;
}

function validateDiagnostic(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
      || typeof value.pass !== "boolean"
      || typeof value.reasonCode !== "string"
      || !/^[a-z][a-z0-9-]{1,63}$/.test(value.reasonCode)
      || !value.markers || typeof value.markers !== "object"
      || !Array.isArray(value.variables) || value.variables.length > 128
      || value.variables.some((name) => typeof name !== "string" || !SAFE_VARIABLE.test(name))) {
    throw new Error("desktop-profile-result-invalid");
  }
  return {
    pass: value.pass,
    reasonCode: value.reasonCode,
    markers: Object.fromEntries(Object.entries(value.markers)
      .filter(([key, enabled]) => /^[A-Za-z][A-Za-z0-9]{0,47}$/.test(key)
        && typeof enabled === "boolean")
      .sort(([left], [right]) => left.localeCompare(right))),
    variables: [...new Set(value.variables)].sort(),
  };
}

function targetDescriptor(target, port) {
  if (!validPageTarget(target, port)) return null;
  return Object.freeze({
    id: target.id,
    origin: sanitizeLogRecord({ url: target.url }).origin ?? "unknown",
    webSocketDebuggerUrl: validatedDebuggerUrl(target, port),
  });
}

export async function runDesktopProfile(options, dependencies = {}) {
  const fetchImpl = dependencies.fetch ?? fetch;
  const now = dependencies.monotonicNow ?? (() => performance.now());
  const deadline = now() + options.timeoutMs;
  const remaining = () => {
    const value = Math.floor(deadline - now());
    if (value < 1) throw new Error("desktop-profile-timeout");
    return value;
  };
  const beforeDeadline = async (operation) => {
    const timeoutMs = remaining();
    let timeout;
    try {
      return await Promise.race([
        operation,
        new Promise((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("desktop-profile-timeout")),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
  };
  const expression = diagnosticExpression();
  const version = await fetchJson(
    options.endpoint,
    "/json/version",
    remaining(),
    fetchImpl,
  );
  const endpoint = new URL(options.endpoint);
  const port = Number(endpoint.port);
  assertBrowserIdentity(version, port, options.browserId);
  const assertCurrentBrowser = async () => {
    const current = await fetchJson(
      options.endpoint,
      "/json/version",
      remaining(),
      fetchImpl,
    );
    assertBrowserIdentity(current, port, options.browserId);
  };
  const listTargets = async () => {
    const listed = await fetchJson(
      options.endpoint,
      "/json/list",
      remaining(),
      fetchImpl,
    );
    if (!Array.isArray(listed) || listed.length > 64) {
      throw new Error("desktop-profile-target-list-invalid");
    }
    return listed.map((target) => targetDescriptor(target, port)).filter(Boolean);
  };
  const assertCurrentTarget = async (expected) => {
    const matches = (await listTargets()).filter((target) => target.id === expected.id);
    if (matches.length !== 1
        || matches[0].webSocketDebuggerUrl !== expected.webSocketDebuggerUrl
        || matches[0].origin !== expected.origin) {
      throw new Error("desktop-profile-target-changed");
    }
    return matches[0];
  };
  const targets = await listTargets();
  if (!targets.length) throw new Error("desktop-profile-target-missing");
  const results = [];
  for (const target of targets) {
    await assertCurrentBrowser();
    const currentTarget = await assertCurrentTarget(target);
    const targetBudget = remaining();
    const session = new DesktopCdpSession(currentTarget, port, {
      ...dependencies,
      allowedExpression: expression,
      commandTimeoutMs: Math.min(CDP_TIMEOUT_POLICY.commandMs, targetBudget),
      socketOpenTimeoutMs: Math.min(CDP_TIMEOUT_POLICY.socketOpenMs, targetBudget),
    });
    try {
      await beforeDeadline(session.open());
      await assertCurrentBrowser();
      const contextId = await beforeDeadline(
        session.isolatedContext("claude-aura-desktop-probe"),
      );
      await assertCurrentTarget(currentTarget);
      const diagnostic = validateDiagnostic(await beforeDeadline(session.evaluate(
        expression,
        contextId,
      )));
      await assertCurrentBrowser();
      const finalTarget = await assertCurrentTarget(currentTarget);
      results.push({
        origin: finalTarget.origin,
        ...diagnostic,
      });
    } finally {
      session.close();
    }
  }
  await assertCurrentBrowser();
  return {
    schemaVersion: 1,
    status: results.every((item) => item.pass) ? "ok" : "blocked",
    reasonCode: results.every((item) => item.pass)
      ? "desktop-profile-complete"
      : "desktop-profile-failed",
    targetCount: results.length,
    targets: results,
  };
}

function failureReason(error) {
  if (error?.name === "AbortError") return "desktop-profile-timeout";
  if (typeof error?.message === "string"
      && /^[a-z][a-z0-9-]{1,63}$/.test(error.message)) return error.message;
  return "desktop-profile-failed";
}

async function main() {
  if (!PROFILE_GATE_A_ENABLED) {
    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      status: "blocked",
      reasonCode: "desktop-profile-gate-a-no-go",
    }, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }
  try {
    const result = await runDesktopProfile(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status !== "ok") process.exitCode = 2;
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
