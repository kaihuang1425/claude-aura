#!/usr/bin/env node
import fs from "node:fs/promises";
import http from "node:http";
import { isIP } from "node:net";
import path from "node:path";
import { PROJECT_ROOT } from "./theme-core.mjs";

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
]);

const args = process.argv.slice(2);
let port = 4173;
let host = "127.0.0.1";
while (args.length) {
  const argument = args.shift();
  if (!args.length) throw new Error(`Missing value for argument: ${argument}`);
  const value = args.shift();
  if (argument === "--port") port = Number(value);
  else if (argument === "--host") host = value;
  else throw new Error(`Unexpected argument: ${argument}`);
}
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Port must be between 1024 and 65535");
if (!(isIP(host) === 4 && host.startsWith("127.")) && host !== "::1") {
  throw new Error("Host must be a loopback address");
}

const root = path.resolve(PROJECT_ROOT);
const publicRoots = [path.join(root, "preview"), path.join(root, "assets", "theme-art")];
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
    const requestedPath = url.pathname === "/" ? "/preview/" : url.pathname;
    const pathname = decodeURIComponent(requestedPath.endsWith("/") ? `${requestedPath}index.html` : requestedPath);
    const filePath = path.resolve(root, `.${pathname}`);
    const isPublic = publicRoots.some((publicRoot) => filePath === publicRoot || filePath.startsWith(`${publicRoot}${path.sep}`));
    if (!isPublic) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw Object.assign(new Error("Not found"), { code: "ENOENT" });
    const bytes = await fs.readFile(filePath);
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Length": bytes.length,
      "Content-Type": MIME_TYPES.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(bytes);
  } catch (error) {
    const status = error.code === "ENOENT" ? 404 : 500;
    response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(status === 404 ? "Not found" : "Preview server error");
  }
});

server.listen(port, host, () => {
  const displayHost = host === "::1" ? `[${host}]` : host;
  console.log(`Claude Aura preview: http://${displayHost}:${port}/preview/`);
});
