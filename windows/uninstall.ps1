[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [switch]$RemoveData,
  [switch]$Interactive
)

$ErrorActionPreference = 'Stop'
$productRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'ClaudeAura'))
$installRoot = [IO.Path]::GetFullPath((Join-Path $productRoot 'app'))
$dataRoot = [IO.Path]::GetFullPath((Join-Path $productRoot 'data'))
$webViewRoot = [IO.Path]::GetFullPath((Join-Path $productRoot 'webview'))
$separator = [IO.Path]::DirectorySeparatorChar

function Assert-AuraOwnedPath([string]$Path) {
  $candidate = [IO.Path]::GetFullPath($Path)
  if (-not $candidate.StartsWith("$productRoot$separator", [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove a path outside $productRoot"
  }
}

Assert-AuraOwnedPath -Path $installRoot
Assert-AuraOwnedPath -Path $dataRoot
Assert-AuraOwnedPath -Path $webViewRoot

if ($Interactive -and -not $RemoveData) {
  Write-Host 'Claude Aura can keep your local theme settings and its separate WebView sign-in profile for a later reinstall.'
  $choice = Read-Host 'Also erase those local settings and sign-in data? [y/N]'
  $RemoveData = $choice -match '^(?i:y|yes)$'
}

$uiScript = [regex]::Escape((Join-Path $installRoot 'windows\aura-ui.ps1'))
try {
  $activeAura = @(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
    $_.ProcessId -ne $PID -and $_.CommandLine -match $uiScript
  })
  if ($activeAura.Count -gt 0) {
    throw 'Claude Aura is still open. Close its window, then run the uninstaller again.'
  }
} catch {
  if ($_.Exception.Message -like 'Claude Aura is still open*') { throw }
  Write-Verbose "Could not inspect running processes: $($_.Exception.Message)"
}

$desktop = [Environment]::GetFolderPath('Desktop')
$programs = [Environment]::GetFolderPath('Programs')
$menuRoot = Join-Path $programs 'Claude Aura'
foreach ($shortcut in @(
  (Join-Path $desktop 'Claude Aura.lnk'),
  (Join-Path $menuRoot 'Claude Aura.lnk'),
  (Join-Path $menuRoot 'Uninstall Claude Aura.lnk')
)) {
  if ((Test-Path -LiteralPath $shortcut) -and $PSCmdlet.ShouldProcess($shortcut, 'Remove Claude Aura shortcut')) {
    Remove-Item -LiteralPath $shortcut -Force -ErrorAction SilentlyContinue
  }
}

$safeWorkingDirectory = if (Test-Path -LiteralPath $env:TEMP -PathType Container) { $env:TEMP } else { $env:LOCALAPPDATA }
Set-Location -LiteralPath $safeWorkingDirectory

if ((Test-Path -LiteralPath $installRoot) -and $PSCmdlet.ShouldProcess($installRoot, 'Remove Claude Aura application files')) {
  Remove-Item -LiteralPath $installRoot -Recurse -Force
}

if ($RemoveData -and (Test-Path -LiteralPath $dataRoot)) {
  if ($PSCmdlet.ShouldProcess($dataRoot, 'Remove Claude Aura settings and logs')) {
    Remove-Item -LiteralPath $dataRoot -Recurse -Force
  }
}

if ($RemoveData -and (Test-Path -LiteralPath $webViewRoot)) {
  if ($PSCmdlet.ShouldProcess($webViewRoot, 'Remove Claude Aura WebView sign-in data')) {
    Remove-Item -LiteralPath $webViewRoot -Recurse -Force
  }
}

if (Test-Path -LiteralPath $menuRoot) {
  $remaining = @(Get-ChildItem -LiteralPath $menuRoot -Force -ErrorAction SilentlyContinue)
  if ($remaining.Count -eq 0 -and $PSCmdlet.ShouldProcess($menuRoot, 'Remove empty Claude Aura Start-menu folder')) {
    Remove-Item -LiteralPath $menuRoot -Force
  }
}

if (Test-Path -LiteralPath $productRoot) {
  $remaining = @(Get-ChildItem -LiteralPath $productRoot -Force -ErrorAction SilentlyContinue)
  if ($remaining.Count -eq 0 -and $PSCmdlet.ShouldProcess($productRoot, 'Remove empty Claude Aura data folder')) {
    Remove-Item -LiteralPath $productRoot -Force
  }
}

if ($WhatIfPreference) {
  Write-Host 'Dry run complete. No files were removed.'
} else {
  Write-Host 'Claude Aura application files and shortcuts were removed.'
  if ($RemoveData) {
    Write-Host 'Local theme settings and the separate WebView sign-in profile were also removed.'
  } else {
    Write-Host "Local theme settings were kept at $dataRoot"
    Write-Host "The separate WebView sign-in profile was kept at $webViewRoot"
  }
}
