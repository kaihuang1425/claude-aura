#!/usr/bin/env node
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

const INDEX_BYTES_MAX = 2 * 1024 * 1024;
const SESSION_LIMIT_DEFAULT = 12;
const SESSION_LIMIT_MAX = 20;
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;

function parseArguments(argv) {
  const options = {
    indexPath: path.join(os.homedir(), ".codex", "session_index.jsonl"),
    databasePath: path.join(os.homedir(), ".codex", "state_5.sqlite"),
    limit: SESSION_LIMIT_DEFAULT,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (!["--index", "--database", "--limit"].includes(name) || index + 1 >= argv.length) {
      throw new Error("codex_session_index_arguments_invalid");
    }
    const value = argv[index += 1];
    if (name === "--index") options.indexPath = path.resolve(value);
    else if (name === "--database") options.databasePath = path.resolve(value);
    else {
      const limit = Number(value);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > SESSION_LIMIT_MAX) {
        throw new Error("codex_session_index_limit_invalid");
      }
      options.limit = limit;
    }
  }
  return Object.freeze(options);
}

function safeText(value, maximum, { required = false } = {}) {
  if (typeof value !== "string" || CONTROL_PATTERN.test(value)) return null;
  const text = value.trim();
  if ((required && !text) || text.length > maximum) return null;
  return text;
}

function safeTimestamp(value) {
  const timestamp = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isSafeInteger(timestamp) && timestamp >= 0 ? timestamp : null;
}

async function readIndex(indexPath) {
  const stat = await fsp.lstat(indexPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > INDEX_BYTES_MAX) {
    throw new Error("codex_session_index_file_invalid");
  }
  const source = await fsp.readFile(indexPath, "utf8");
  const byId = new Map();
  for (const line of source.split(/\r?\n/u)) {
    if (!line.trim() || line.length > 16_384) continue;
    let value;
    try { value = JSON.parse(line); } catch { continue; }
    if (!value || typeof value !== "object" || Array.isArray(value)
        || !UUID_PATTERN.test(value.id ?? "")) continue;
    const title = safeText(value.thread_name, 160, { required: true });
    const updatedAt = safeTimestamp(value.updated_at);
    if (!title || updatedAt === null) continue;
    const prior = byId.get(value.id);
    if (!prior || updatedAt >= prior.updatedAt) {
      byId.set(value.id, Object.freeze({ id: value.id, title, updatedAt }));
    }
  }
  return byId;
}

function databaseMetadata(databasePath, visibleIds) {
  let database;
  const metadata = new Map();
  try {
    const stat = fs.lstatSync(databasePath);
    if (!stat.isFile() || stat.isSymbolicLink()) return metadata;
    database = new DatabaseSync(databasePath, { readOnly: true, timeout: 1_000 });
    const rows = database.prepare(`
      SELECT id, cwd, git_branch, archived, agent_role,
             updated_at_ms, recency_at_ms, is_pinned
      FROM threads
      ORDER BY recency_at_ms DESC
      LIMIT 5000
    `).all();
    for (const row of rows) {
      if (!visibleIds.has(row.id) || metadata.has(row.id)) continue;
      const role = safeText(row.agent_role, 80);
      const archived = row.archived === 1 || row.archived === true;
      if (archived || role) {
        metadata.set(row.id, Object.freeze({ hidden: true }));
        continue;
      }
      const cwd = safeText(row.cwd, 520);
      const workspace = cwd ? safeText(path.basename(cwd.replaceAll("\\", "/")), 120) ?? "" : "";
      const branch = safeText(row.git_branch, 160) ?? "";
      const dbUpdatedAt = [row.recency_at_ms, row.updated_at_ms]
        .filter((value) => Number.isSafeInteger(value) && value >= 0)
        .reduce((latest, value) => Math.max(latest, value), 0);
      metadata.set(row.id, Object.freeze({
        hidden: false,
        workspace,
        branch,
        updatedAt: dbUpdatedAt,
        pinned: row.is_pinned === 1 || row.is_pinned === true,
      }));
    }
  } catch {
    return metadata;
  } finally {
    try { database?.close(); } catch {}
  }
  return metadata;
}

export async function buildCodexSessionIndex({ indexPath, databasePath, limit }) {
  let index;
  try {
    index = await readIndex(indexPath);
  } catch {
    return Object.freeze({ schemaVersion: 1, available: false, sessions: Object.freeze([]) });
  }
  const metadata = databaseMetadata(databasePath, new Set(index.keys()));
  const sessions = [...index.values()].flatMap((entry) => {
    const details = metadata.get(entry.id);
    if (details?.hidden) return [];
    return [Object.freeze({
      id: entry.id,
      title: entry.title,
      updatedAt: Math.max(entry.updatedAt, details?.updatedAt ?? 0),
      workspace: details?.workspace ?? "",
      branch: details?.branch ?? "",
      pinned: details?.pinned === true,
    })];
  }).sort((left, right) => Number(right.pinned) - Number(left.pinned)
    || right.updatedAt - left.updatedAt || left.id.localeCompare(right.id))
    .slice(0, limit);
  return Object.freeze({ schemaVersion: 1, available: true, sessions: Object.freeze(sessions) });
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = await buildCodexSessionIndex(options);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
