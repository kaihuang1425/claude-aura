#!/usr/bin/env node
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { buildInstallerAssets } from "./build-installer-assets.mjs";
import { AURA_VERSION, PROJECT_ROOT } from "./theme-core.mjs";

const INSTALLER_SCRIPT = path.join(PROJECT_ROOT, "installer", "ClaudeAura.iss");
const RELEASE_ROOT = path.join(PROJECT_ROOT, "release");
const SETUP_RELEASE_DIRECTORY = path.join(RELEASE_ROOT, "windows");
const MAX_ARCHIVE_FILES = 10_000;
const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
const SIGN_COMMAND_ENVIRONMENT = "AURA_SIGNTOOL_COMMAND";
const SIGNER_THUMBPRINT_ENVIRONMENT = "AURA_SIGNER_THUMBPRINT";
const PINNED_INNO_SETUP = Object.freeze({
  version: "7.0.2",
  architecture: "x64",
  isccSha256: "0ff6140d641f84b64204a2c4d52207c6fc437c9f4db8779c83083d84f7e3d70d",
  publisher: "Pyrsys B.V.",
});
const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function commandResult(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
    ...options,
  });
  if (result.error) throw result.error;
  return result;
}

function checkedCommand(command, args, label, options = {}) {
  const result = commandResult(command, args, options);
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${label} failed with exit code ${result.status}.${detail ? `\n${detail}` : ""}`);
  }
  return result;
}

function parseArguments(argv) {
  const options = { mode: null, iscc: null };
  const buildModes = new Map([
    ["--signed", "signed"],
    ["--allow-unsigned-release", "unsigned-release"],
    ["--allow-unsigned-development", "unsigned-development"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (buildModes.has(argument)) {
      const mode = buildModes.get(argument);
      if (options.mode && options.mode !== mode) {
        throw new Error(
          "--signed, --allow-unsigned-release, and --allow-unsigned-development are mutually exclusive.",
        );
      }
      options.mode = mode;
    } else if (argument === "--iscc") {
      options.iscc = argv[index + 1] ?? null;
      index += 1;
      if (!options.iscc) throw new Error("--iscc requires an explicit ISCC.exe path.");
    } else {
      throw new Error(`Unknown installer build argument: ${argument}`);
    }
  }
  if (options.mode === null) {
    throw new Error(
      "Choose --signed, --allow-unsigned-release, or --allow-unsigned-development.",
    );
  }
  return {
    ...options,
    signed: options.mode === "signed",
    unsignedRelease: options.mode === "unsigned-release",
  };
}

async function isFile(candidate) {
  try {
    return (await fs.stat(candidate)).isFile();
  } catch {
    return false;
  }
}

async function findCompiler(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.INNO_SETUP_COMPILER,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs", "Inno Setup 7", "ISCC.exe"),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Inno Setup 7", "ISCC.exe"),
    process.env["ProgramFiles(x86)"] && path.join(process.env["ProgramFiles(x86)"], "Inno Setup 7", "ISCC.exe"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (await isFile(resolved)) return resolved;
  }
  throw new Error(
    "Inno Setup 7 was not found. Install the official compiler from https://jrsoftware.org/isdl.php "
    + "or pass --iscc with the full path to ISCC.exe.",
  );
}

function findEndOfCentralDirectory(bytes) {
  const minimumOffset = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("Release archive is missing its end-of-central-directory record.");
}

function safeArchivePath(name, seen) {
  if (!name.startsWith("claude-aura/") || name.endsWith("/") || name.includes("\\")
      || name.includes("\0")) {
    throw new Error(`Installer payload contains an invalid archive path: ${name}`);
  }
  const relative = name.slice("claude-aura/".length);
  const segments = relative.split("/");
  if (segments.length === 0 || segments.some((segment) => !segment || segment === "."
      || segment === ".." || segment.includes(":"))) {
    throw new Error(`Installer payload contains an unsafe archive path: ${name}`);
  }
  const identity = relative.toLowerCase();
  if (seen.has(identity)) throw new Error(`Installer payload contains a duplicate path: ${relative}`);
  seen.add(identity);
  return relative;
}

async function extractReleaseArchive(archivePath, destinationRoot, expectedSha256) {
  const bytes = await fs.readFile(archivePath);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  if (!/^[0-9a-f]{64}$/u.test(expectedSha256) || sha256 !== expectedSha256.toLowerCase()) {
    throw new Error("Release archive SHA-256 changed after the release builder returned.");
  }
  const endOffset = findEndOfCentralDirectory(bytes);
  const entryCount = bytes.readUInt16LE(endOffset + 10);
  const centralSize = bytes.readUInt32LE(endOffset + 12);
  let centralOffset = bytes.readUInt32LE(endOffset + 16);
  if (entryCount === 0 || entryCount > MAX_ARCHIVE_FILES
      || centralOffset + centralSize > endOffset) {
    throw new Error("Release archive central directory is out of bounds.");
  }

  const root = path.resolve(destinationRoot);
  const rootPrefix = `${root}${path.sep}`;
  const seen = new Set();
  let totalBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (centralOffset + 46 > endOffset || bytes.readUInt32LE(centralOffset) !== 0x02014b50) {
      throw new Error("Release archive has an invalid central-directory entry.");
    }
    const flags = bytes.readUInt16LE(centralOffset + 8);
    const method = bytes.readUInt16LE(centralOffset + 10);
    const expectedCrc = bytes.readUInt32LE(centralOffset + 16);
    const compressedSize = bytes.readUInt32LE(centralOffset + 20);
    const uncompressedSize = bytes.readUInt32LE(centralOffset + 24);
    const nameLength = bytes.readUInt16LE(centralOffset + 28);
    const extraLength = bytes.readUInt16LE(centralOffset + 30);
    const commentLength = bytes.readUInt16LE(centralOffset + 32);
    const externalAttributes = bytes.readUInt32LE(centralOffset + 38);
    const localOffset = bytes.readUInt32LE(centralOffset + 42);
    const nextCentralOffset = centralOffset + 46 + nameLength + extraLength + commentLength;
    if (nextCentralOffset > endOffset) throw new Error("Release archive entry metadata is truncated.");
    const name = bytes.subarray(centralOffset + 46, centralOffset + 46 + nameLength).toString("utf8");
    const relative = safeArchivePath(name, seen);
    const unixType = (externalAttributes >>> 16) & 0o170000;
    if ((flags & 0x0001) !== 0 || (flags & 0x0800) === 0 || method !== 8
        || (unixType !== 0 && unixType !== 0o100000)) {
      throw new Error(`Installer payload entry uses unsupported ZIP features: ${relative}`);
    }
    if (localOffset + 30 > bytes.length || bytes.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error(`Installer payload has an invalid local header: ${relative}`);
    }
    const localFlags = bytes.readUInt16LE(localOffset + 6);
    const localMethod = bytes.readUInt16LE(localOffset + 8);
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (localFlags !== flags || localMethod !== method || dataOffset + compressedSize > bytes.length) {
      throw new Error(`Installer payload local metadata does not match: ${relative}`);
    }
    const localName = bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength).toString("utf8");
    if (localName !== name) throw new Error(`Installer payload local path does not match: ${relative}`);

    const content = zlib.inflateRawSync(bytes.subarray(dataOffset, dataOffset + compressedSize), {
      maxOutputLength: Math.min(MAX_ARCHIVE_BYTES, uncompressedSize + 1),
    });
    totalBytes += content.length;
    if (content.length !== uncompressedSize || crc32(content) !== expectedCrc
        || totalBytes > MAX_ARCHIVE_BYTES) {
      throw new Error(`Installer payload verification failed: ${relative}`);
    }
    const destination = path.resolve(root, ...relative.split("/"));
    if (!destination.startsWith(rootPrefix)) {
      throw new Error(`Installer payload escaped its staging root: ${relative}`);
    }
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, content);
    centralOffset = nextCentralOffset;
  }
  if (centralOffset !== bytes.readUInt32LE(endOffset + 16) + centralSize) {
    throw new Error("Release archive central-directory length does not match.");
  }
  return { files: entryCount, bytes: totalBytes, sha256 };
}

function windowsPowerShellPath() {
  const windowsRoot = process.env.SystemRoot;
  if (!windowsRoot || !path.win32.isAbsolute(windowsRoot)
      || !/^[a-z]:\\/iu.test(path.win32.resolve(windowsRoot))) {
    throw new Error("SystemRoot must resolve to an absolute local Windows path.");
  }
  return path.win32.join(
    path.win32.resolve(windowsRoot),
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
}

function powershellSignature(powerShellPath, artifactPath) {
  const trustedModulePath = path.join(path.dirname(powerShellPath), "Modules");
  const script = [
    "$signature = Get-AuthenticodeSignature -LiteralPath $env:AURA_INSTALLER_ARTIFACT",
    "[pscustomobject]@{",
    "  status = [string]$signature.Status",
    "  subject = if ($signature.SignerCertificate) { $signature.SignerCertificate.Subject } else { $null }",
    "  thumbprint = if ($signature.SignerCertificate) { $signature.SignerCertificate.Thumbprint } else { $null }",
    "  timestampSubject = if ($signature.TimeStamperCertificate) { $signature.TimeStamperCertificate.Subject } else { $null }",
    "  timestampThumbprint = if ($signature.TimeStamperCertificate) { $signature.TimeStamperCertificate.Thumbprint } else { $null }",
    "} | ConvertTo-Json -Compress",
  ].join("\n");
  const result = checkedCommand(powerShellPath, [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    script,
  ], "Authenticode inspection", {
    env: {
      ...process.env,
      PSModulePath: trustedModulePath,
      AURA_INSTALLER_ARTIFACT: artifactPath,
    },
  });
  return JSON.parse(result.stdout.trim());
}

async function sha256File(filePath) {
  return crypto.createHash("sha256").update(await fs.readFile(filePath)).digest("hex");
}

async function promoteInstallerOutputs(entries) {
  const releaseRoot = path.resolve(SETUP_RELEASE_DIRECTORY);
  const token = crypto.randomBytes(12).toString("hex");
  const prepared = entries.map(({ source, destination }) => {
    const resolvedDestination = path.resolve(destination);
    if (path.dirname(resolvedDestination) !== releaseRoot) {
      throw new Error(`Refusing to publish an installer output outside ${releaseRoot}.`);
    }
    return {
      source: path.resolve(source),
      destination: resolvedDestination,
      incoming: `${resolvedDestination}.incoming-${token}`,
      backup: `${resolvedDestination}.previous-${token}`,
      hadPrevious: false,
      promoted: false,
    };
  });
  const rollbackErrors = [];
  try {
    for (const entry of prepared) {
      await fs.copyFile(entry.source, entry.incoming);
      if (await sha256File(entry.source) !== await sha256File(entry.incoming)) {
        throw new Error(`Installer output changed while staging ${path.basename(entry.destination)}.`);
      }
    }
    for (const entry of prepared) {
      if (await isFile(entry.destination)) {
        await fs.rename(entry.destination, entry.backup);
        entry.hadPrevious = true;
      }
    }
    for (const entry of prepared) {
      await fs.rename(entry.incoming, entry.destination);
      entry.promoted = true;
    }
  } catch (error) {
    for (const entry of [...prepared].reverse()) {
      try {
        if (entry.promoted) await fs.rm(entry.destination, { force: true });
        else await fs.rm(entry.incoming, { force: true });
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
      if (entry.hadPrevious) {
        try {
          await fs.rename(entry.backup, entry.destination);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        "Installer publication failed and could not restore every prior output.",
      );
    }
    throw error;
  }
  const cleanupErrors = [];
  for (const entry of prepared) {
    if (!entry.hadPrevious) continue;
    try {
      await fs.rm(entry.backup, { force: true });
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      cleanupErrors,
      "Installer outputs were published, but prior-output cleanup is incomplete.",
    );
  }
}

function normalizeThumbprint(value) {
  return value?.replaceAll(/\s/gu, "").toUpperCase() ?? "";
}

async function buildRelease(outputDirectory) {
  const result = checkedCommand(process.execPath, [
    "scripts/build-release.mjs",
    "--native-payload",
    "--output-directory",
    outputDirectory,
  ], "Release payload build");
  return JSON.parse(result.stdout.trim());
}

async function removeSupersededInstallerOutputs(keepPaths) {
  const keep = new Set(keepPaths.map((candidate) => path.resolve(candidate).toLowerCase()));
  const releaseRoot = path.resolve(SETUP_RELEASE_DIRECTORY);
  for (const entry of await fs.readdir(releaseRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !/^Claude-Aura-Setup-v.+\.(?:exe|sha256|manifest\.json)$/u.test(entry.name)) {
      continue;
    }
    const candidate = path.resolve(releaseRoot, entry.name);
    if (path.dirname(candidate) !== releaseRoot || keep.has(candidate.toLowerCase())) { continue; }
    await fs.rm(candidate, { force: true });
  }
}

async function main() {
  if (process.platform !== "win32") {
    throw new Error("The Claude Aura Windows installer can only be compiled on Windows.");
  }
  const options = parseArguments(process.argv.slice(2));
  const outputBasename = options.signed
    ? `Claude-Aura-Setup-v${AURA_VERSION}`
    : options.unsignedRelease
      ? `Claude-Aura-Setup-v${AURA_VERSION}-UNSIGNED`
      : `Claude-Aura-Setup-v${AURA_VERSION}-UNSIGNED-DEV`;
  const compilerPath = await findCompiler(options.iscc);
  const powerShellPath = windowsPowerShellPath();
  if (!await isFile(powerShellPath)) {
    throw new Error(`Windows PowerShell was not found at its trusted system path: ${powerShellPath}`);
  }
  const compilerSha256 = await sha256File(compilerPath);
  if (compilerSha256 !== PINNED_INNO_SETUP.isccSha256) {
    throw new Error(
      `ISCC.exe does not match pinned Inno Setup ${PINNED_INNO_SETUP.version} `
      + `${PINNED_INNO_SETUP.architecture} (${compilerSha256}).`,
    );
  }
  const compilerSignature = powershellSignature(powerShellPath, compilerPath);
  if (compilerSignature.status !== "Valid"
      || !compilerSignature.subject?.includes(PINNED_INNO_SETUP.publisher)) {
    throw new Error("The pinned Inno Setup compiler did not pass publisher signature verification.");
  }
  const signCommand = process.env[SIGN_COMMAND_ENVIRONMENT]?.trim() ?? "";
  const expectedSignerThumbprint = normalizeThumbprint(
    process.env[SIGNER_THUMBPRINT_ENVIRONMENT]?.trim(),
  );
  if (options.signed && (!signCommand || !signCommand.includes("$f"))) {
    throw new Error(
      `${SIGN_COMMAND_ENVIRONMENT} must contain an Inno Setup SignTool command with the required $f file token.`,
    );
  }
  if (options.signed && !/^[0-9A-F]{40}$/u.test(expectedSignerThumbprint)) {
    throw new Error(
      `${SIGNER_THUMBPRINT_ENVIRONMENT} must contain the expected 40-character certificate thumbprint.`,
    );
  }

  await fs.mkdir(SETUP_RELEASE_DIRECTORY, { recursive: true });
  const stagingParent = await fs.mkdtemp(path.join(os.tmpdir(), "claude-aura-installer-"));
  try {
    const payloadOutputDirectory = path.join(stagingParent, "payload");
    const release = await buildRelease(payloadOutputDirectory);
    const releaseArchive = path.resolve(release.outputPath);
    const expectedReleaseRoot = `${path.resolve(payloadOutputDirectory)}${path.sep}`;
    if (!releaseArchive.startsWith(expectedReleaseRoot) || !await isFile(releaseArchive)) {
      throw new Error("Release builder returned an installer payload outside its private staging directory.");
    }
    const stagingRoot = path.join(stagingParent, "claude-aura");
    const compilerOutputDirectory = path.join(stagingParent, "compiled");
    await fs.mkdir(stagingRoot);
    await fs.mkdir(compilerOutputDirectory);
    const staged = await extractReleaseArchive(releaseArchive, stagingRoot, release.sha256);
    if (release.files !== staged.files || release.unpackedBytes !== staged.bytes) {
      throw new Error("Extracted installer payload does not match the release builder inventory.");
    }
    await buildInstallerAssets();

    const compilerArguments = [
      "/Qp",
      `/O${compilerOutputDirectory}`,
      `/F${outputBasename}`,
      `/DAppVersion=${AURA_VERSION}`,
      `/DAppFileVersion=${AURA_VERSION}.0`,
      `/DSourceRoot=${stagingRoot}`,
      `/DOutputDir=${compilerOutputDirectory}`,
      `/DOutputBaseFilename=${outputBasename}`,
    ];
    if (options.signed) {
      compilerArguments.push("/DSignedBuild=1", `/Sclaudeaura=${signCommand}`);
    } else if (options.unsignedRelease) {
      compilerArguments.push("/DUnsignedPublicBuild=1");
    }
    compilerArguments.push(INSTALLER_SCRIPT);
    const compile = checkedCommand(compilerPath, compilerArguments, "Windows installer compile");
    if (compile.stdout) process.stderr.write(compile.stdout);
    if (compile.stderr) process.stderr.write(compile.stderr);

    const stagedArtifactPath = path.join(compilerOutputDirectory, `${outputBasename}.exe`);
    const artifactPath = path.join(SETUP_RELEASE_DIRECTORY, `${outputBasename}.exe`);
    const artifact = await fs.readFile(stagedArtifactPath);
    if (artifact.length < 2 || artifact[0] !== 0x4d || artifact[1] !== 0x5a) {
      throw new Error("Compiled installer is not a valid Windows PE image.");
    }
    const signature = powershellSignature(powerShellPath, stagedArtifactPath);
    if (options.signed && signature.status !== "Valid") {
      throw new Error(`The signed release build failed Authenticode verification: ${signature.status}`);
    }
    if (options.signed
        && normalizeThumbprint(signature.thumbprint) !== expectedSignerThumbprint) {
      throw new Error("The signed release build used a certificate other than the expected signer.");
    }
    if (options.signed && !signature.timestampThumbprint) {
      throw new Error("The signed release build is missing an Authenticode timestamp certificate.");
    }
    if (!options.signed && signature.status !== "NotSigned") {
      throw new Error(
        `Unsigned build unexpectedly reported Authenticode status ${signature.status}.`,
      );
    }
    const digest = crypto.createHash("sha256").update(artifact).digest("hex");
    const stagedChecksumPath = `${stagedArtifactPath}.sha256`;
    const checksumPath = `${artifactPath}.sha256`;
    await fs.writeFile(
      stagedChecksumPath,
      `${digest}  ${path.basename(artifactPath)}\n`,
      "utf8",
    );
    const stagedManifestPath = path.join(
      compilerOutputDirectory,
      `${outputBasename}.manifest.json`,
    );
    const manifestPath = path.join(SETUP_RELEASE_DIRECTORY, `${outputBasename}.manifest.json`);
    const manifest = {
      schemaVersion: 2,
      product: "Claude Aura",
      version: AURA_VERSION,
      buildType: options.signed
        ? "signed-release"
        : options.unsignedRelease ? "unsigned-release" : "unsigned-development",
      releaseEligible: options.signed || options.unsignedRelease,
      distribution: {
        public: options.signed || options.unsignedRelease,
        recommended: options.signed,
        trust: options.signed
          ? "authenticode-and-sha256"
          : options.unsignedRelease ? "sha256-only" : "development-only",
        warning: options.unsignedRelease
          ? "Windows cannot verify this unsigned publisher. Use only the official GitHub release asset with its matching SHA-256."
          : null,
      },
      artifact: {
        file: path.basename(artifactPath),
        bytes: artifact.length,
        sha256: digest,
      },
      payload: {
        file: path.basename(releaseArchive),
        profile: release.profile,
        files: staged.files,
        bytes: release.bytes,
        unpackedBytes: staged.bytes,
        sha256: staged.sha256,
      },
      signing: {
        requiredForRelease: !options.unsignedRelease,
        requested: options.signed,
        status: signature.status,
        subject: signature.subject,
        thumbprint: signature.thumbprint,
        timestampSubject: signature.timestampSubject,
        timestampThumbprint: signature.timestampThumbprint,
      },
      compiler: {
        product: "Inno Setup",
        version: PINNED_INNO_SETUP.version,
        architecture: PINNED_INNO_SETUP.architecture,
        isccSha256: compilerSha256,
        signature: compilerSignature,
      },
    };
    await fs.writeFile(stagedManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await promoteInstallerOutputs([
      { source: stagedArtifactPath, destination: artifactPath },
      { source: stagedChecksumPath, destination: checksumPath },
      { source: stagedManifestPath, destination: manifestPath },
    ]);
    await removeSupersededInstallerOutputs([artifactPath, checksumPath, manifestPath]);
    console.log(JSON.stringify({
      artifactPath,
      checksumPath,
      manifestPath,
      bytes: artifact.length,
      sha256: digest,
      signature,
      releaseEligible: manifest.releaseEligible,
      payload: manifest.payload,
    }, null, 2));
  } finally {
    const resolved = path.resolve(stagingParent);
    const expectedPrefix = `${path.resolve(os.tmpdir())}${path.sep}claude-aura-installer-`;
    if (!resolved.startsWith(expectedPrefix)) {
      throw new Error(`Refusing to remove an unexpected installer staging path: ${resolved}`);
    }
    await fs.rm(resolved, { recursive: true, force: true });
  }
}

await main();
