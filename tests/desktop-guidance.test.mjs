import { test, runIfMain } from "./support/harness.mjs";
import {
  PROJECT_ROOT,
  assert,
  fs,
  path,
  run,
} from "./support/context.mjs";

const hostPath = path.join(PROJECT_ROOT, "windows", "aura-ui.ps1");
const guidanceUrl = "https://code.claude.com/docs/en/desktop#coming-from-the-cli";
const authoredLocales = ["en", "zh-CN", "zh-HKTW"];
const guidanceKeys = [
  "openDesktopWorkspaceGuidance",
  "desktopWorkspaceGuidanceTitle",
  "desktopWorkspaceGuidanceMessage",
  "desktopWorkspaceGuidanceFailedTitle",
  "desktopWorkspaceGuidanceFailedMessage",
];
const expectedCopy = {
  en: {
    openDesktopWorkspaceGuidance: "Review full-workspace guidance",
    desktopWorkspaceGuidanceTitle: "Claude Desktop workspace",
    desktopWorkspaceGuidanceMessage: "Claude Desktop is a separate native workspace with its own appearance and controls. Aura will open Anthropic’s current guide. Aura will not choose or transfer your Remote Control session, send a project path or prompt, or style Claude Desktop. If your setup supports /desktop, run it yourself in the intended CLI session.\n\nOpen the guide?",
    desktopWorkspaceGuidanceFailedTitle: "Couldn’t open the guide",
    desktopWorkspaceGuidanceFailedMessage: "Open Anthropic’s Claude Desktop guide in your browser:\n{0}",
  },
  "zh-CN": {
    openDesktopWorkspaceGuidance: "查看完整工作区指南",
    desktopWorkspaceGuidanceTitle: "Claude Desktop 工作区",
    desktopWorkspaceGuidanceMessage: "Claude Desktop 是一个独立的原生工作区，拥有自己的界面和控件。Aura 将打开 Anthropic 的最新指南。Aura 不会选择或转移你的 Remote Control 会话，不会发送项目路径或提示词，也不会为 Claude Desktop 应用主题。如果你的设置支持 /desktop，请在目标 CLI 会话中自行运行。\n\n要打开指南吗？",
    desktopWorkspaceGuidanceFailedTitle: "无法打开指南",
    desktopWorkspaceGuidanceFailedMessage: "请在浏览器中打开 Anthropic 的 Claude Desktop 指南：\n{0}",
  },
  "zh-HKTW": {
    openDesktopWorkspaceGuidance: "查看完整工作區指南",
    desktopWorkspaceGuidanceTitle: "Claude Desktop 工作區",
    desktopWorkspaceGuidanceMessage: "Claude Desktop 是獨立的原生工作區，擁有自己的介面與控制項。Aura 會開啟 Anthropic 的最新指南。Aura 不會選擇或轉移你的 Remote Control 工作階段、不會傳送專案路徑或提示詞，也不會為 Claude Desktop 套用主題。如果你的設定支援 /desktop，請在目標 CLI 工作階段中自行執行。\n\n要開啟指南嗎？",
    desktopWorkspaceGuidanceFailedTitle: "無法開啟指南",
    desktopWorkspaceGuidanceFailedMessage: "請在瀏覽器中開啟 Anthropic 的 Claude Desktop 指南：\n{0}",
  },
};

function functionSource(source, name, nextName) {
  const start = source.indexOf(`function ${name} {`);
  const end = source.indexOf(`function ${nextName} {`, start);
  assert(start >= 0 && end > start, `${name} must be a standalone native host function`);
  return source.slice(start, end);
}

test("Desktop workspace guidance URI is exact and fail-closed", async () => {
  const source = await fs.readFile(hostPath, "utf8");
  const helper = functionSource(
    source,
    "Get-AuraUiDesktopWorkspaceGuidanceUri",
    "Request-AuraUiDesktopWorkspaceGuidance",
  );

  assert.equal(helper.split(guidanceUrl).length - 1, 1);
  for (const expected of [
    /\[Uri\]::new\(\$expectedAbsoluteUri, \[UriKind\]::Absolute\)/,
    /-not \$uri\.IsAbsoluteUri/,
    /\$uri\.Scheme -cne \[Uri\]::UriSchemeHttps/,
    /\$uri\.Host -cne 'code\.claude\.com'/,
    /-not \$uri\.IsDefaultPort/,
    /\$uri\.AbsolutePath -cne '\/docs\/en\/desktop'/,
    /\$uri\.Query\.Length -ne 0/,
    /\$uri\.UserInfo\.Length -ne 0/,
    /\$uri\.Fragment -cne '#coming-from-the-cli'/,
    /\$uri\.AbsoluteUri -cne \$expectedAbsoluteUri/,
  ]) {
    assert.match(helper, expected);
  }
  assert.doesNotMatch(
    helper,
    /Start-Process|Get-AuraClaudeInstall|Get-Process|Get-AppxPackage|claude:\/\//i,
  );

  if (process.platform === "win32") {
    const command = `${helper}\n(Get-AuraUiDesktopWorkspaceGuidanceUri).AbsoluteUri`;
    const stdout = run("powershell.exe", [
      "-NoProfile",
      "-EncodedCommand",
      Buffer.from(command, "utf16le").toString("base64"),
    ]);
    assert.equal(stdout.trim(), guidanceUrl);
  }
});

test("Desktop workspace guidance is consent-first and browser-only", async () => {
  const source = await fs.readFile(hostPath, "utf8");
  const guidance = functionSource(
    source,
    "Request-AuraUiDesktopWorkspaceGuidance",
    "Assert-AuraUiThemeKitTree",
  );

  assert.match(guidance, /MessageBoxButtons\]::YesNo/);
  assert.match(guidance, /MessageBoxDefaultButton\]::Button2/);
  assert.match(guidance, /if \(\$result -ne \[System\.Windows\.Forms\.DialogResult\]::Yes\) \{ return \$false \}/);
  assert.equal(guidance.split(guidanceUrl).length - 1, 1);
  assert.match(guidance, /\$guidanceUri = Get-AuraUiDesktopWorkspaceGuidanceUri/);
  assert.match(guidance, /Start-Process -FilePath \$guidanceUri\.AbsoluteUri -ErrorAction Stop/);
  assert.match(guidance, /Write-AuraUiLog -Message 'Desktop workspace guidance open failed\.'/);
  assert.match(
    guidance,
    /desktopWorkspaceGuidanceFailedMessage\)" -f \$guidanceUrl/,
  );
  assert.doesNotMatch(
    guidance,
    /Get-AuraClaudeInstall|claude:\/\/|Get-Process|Get-AppxPackage|Set-AuraUiConfig|\.Executable|Exception/i,
  );
});

test("Desktop workspace guidance stays native-only and keeps Open Desktop unchanged", async () => {
  const source = await fs.readFile(hostPath, "utf8");
  const openDesktop = functionSource(
    source,
    "Invoke-AuraUiOpenDesktopApp",
    "Get-AuraUiDesktopWorkspaceGuidanceUri",
  );

  assert.match(openDesktop, /Get-AuraClaudeInstall/);
  assert.match(openDesktop, /Start-Process -FilePath \$claude\.Executable/);
  assert.doesNotMatch(source, /open-desktop-workspace-guidance/);
  assert.match(
    source,
    /\$script:TrayDesktopWorkspaceGuidanceItem\.add_Click\(\{\s+\[void\]\(Request-AuraUiDesktopWorkspaceGuidance\)\s+\}\)/,
  );
  assert.match(
    source,
    /\$script:LauncherDesktopWorkspaceGuidanceItem\.add_Click\(\{\s+\[void\]\(Request-AuraUiDesktopWorkspaceGuidance\)\s+\}\)/,
  );
});

test("authored Windows locales preserve the reviewed guidance boundary", async () => {
  for (const locale of authoredLocales) {
    const file = path.join(PROJECT_ROOT, "windows", "locales", `${locale}.json`);
    const copy = JSON.parse(await fs.readFile(file, "utf8"));
    const actual = Object.fromEntries(guidanceKeys.map((key) => [key, copy[key]]));
    assert.deepEqual(actual, expectedCopy[locale]);
    assert.deepEqual(
      [...copy.desktopWorkspaceGuidanceFailedMessage.matchAll(/\{\d+\}/g)].map((match) => match[0]),
      ["{0}"],
      `${locale} failure guidance must preserve exactly one {0} URL placeholder`,
    );
    assert.doesNotMatch(
      guidanceKeys.map((key) => copy[key]).join("\n"),
      /claude:\/\//i,
    );
  }
});

test("Aura host parses after adding native Desktop guidance", async () => {
  if (process.platform !== "win32") return;
  const command = [
    "$ErrorActionPreference='Stop'",
    "$tokens=$null;$errors=$null",
    `$null=[System.Management.Automation.Language.Parser]::ParseFile('${hostPath.replaceAll("'", "''")}',[ref]$tokens,[ref]$errors)`,
    "if($errors.Count){$errors|ForEach-Object{Write-Error $_};exit 1}",
  ].join(";");
  run("powershell.exe", ["-NoProfile", "-Command", command]);
});

runIfMain(import.meta.url);
