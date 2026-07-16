[CmdletBinding()]
param([switch]$Json)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
$VendorRoot = Join-Path $Root 'vendor\webview2'
$DataRoot = Join-Path $env:LOCALAPPDATA 'ClaudeAura\data'
$ConfigPath = Join-Path $DataRoot 'config.json'
. (Join-Path $PSScriptRoot 'common.ps1')

$lock = Enter-AuraOperationLock
try {
  $node = Get-AuraNodeRuntime
  $architecture = [System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture.ToString().ToLowerInvariant()
  if ($architecture -notin @('x64', 'x86', 'arm64')) { $architecture = 'x64' }
  $loaderRoot = Join-Path $VendorRoot "runtimes\$architecture"
  $required = @(
    (Join-Path $VendorRoot 'Microsoft.Web.WebView2.Core.dll'),
    (Join-Path $VendorRoot 'Microsoft.Web.WebView2.WinForms.dll'),
    (Join-Path $loaderRoot 'WebView2Loader.dll')
  )
  foreach ($file in $required) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing required component: $file" }
  }
  New-Item -ItemType Directory -Force -Path $DataRoot | Out-Null
  & $node.Path (Join-Path $Root 'scripts\theme-cli.mjs') init --config $ConfigPath | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'The Claude Aura configuration could not be initialized.' }
  $payload = @(& $node.Path (Join-Path $Root 'scripts\webview-cli.mjs') --config $ConfigPath) -join "`n"
  if ($LASTEXITCODE -ne 0 -or $payload -notmatch '__CLAUDE_AURA_STATE__') { throw 'The selected theme could not be prepared.' }
  $config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
  $env:PATH = "$loaderRoot;$VendorRoot;$env:PATH"
  [void][Reflection.Assembly]::LoadFrom($required[0])
  $runtime = [Microsoft.Web.WebView2.Core.CoreWebView2Environment]::GetAvailableBrowserVersionString()
  if (-not $runtime) { throw 'Microsoft Edge WebView2 Runtime is not installed.' }
  $result = [pscustomobject]@{
    pass = $true
    runtime = $runtime
    theme = "$($config.theme)"
    enabled = if ($null -eq $config.PSObject.Properties['enabled']) { $true } else { [bool]$config.enabled }
    config = $ConfigPath
  }
  if ($Json) { $result | ConvertTo-Json -Compress }
  else {
    Write-Host 'Claude Aura is ready.'
    Write-Host "Theme: $($result.theme)"
    Write-Host "WebView2: $($result.runtime)"
  }
} finally {
  Exit-AuraOperationLock -Mutex $lock
}
