[CmdletBinding()]
param(
  [switch]$NoShortcuts,
  [switch]$Launch
)

$ErrorActionPreference = 'Stop'
$SourceRoot = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'common.ps1')

$lock = Enter-AuraOperationLock
try {
  $node = Get-AuraNodeRuntime
  & $node.Path (Join-Path $SourceRoot 'tests\run-tests.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Claude Aura checks failed; installation stopped.' }

  $installRoot = Join-Path $env:LOCALAPPDATA 'ClaudeAura\app'
  $dataRoot = Join-Path $env:LOCALAPPDATA 'ClaudeAura\data'
  New-Item -ItemType Directory -Force -Path $installRoot, $dataRoot | Out-Null
  if (-not (Test-AuraPathEqual -Left $SourceRoot -Right $installRoot)) {
    foreach ($directory in @('assets', 'macos', 'preview', 'scripts', 'studio', 'themes', 'tests', 'vendor', 'windows')) {
      Copy-Item -LiteralPath (Join-Path $SourceRoot $directory) -Destination $installRoot -Recurse -Force
    }
    $installedDocs = Join-Path $installRoot 'docs'
    New-Item -ItemType Directory -Force -Path $installedDocs | Out-Null
    Copy-Item -Path (Join-Path $SourceRoot 'docs\*.md') -Destination $installedDocs -Force
    foreach ($file in @('README.md', 'SECURITY.md', 'NOTICE.md', 'THIRD_PARTY_NOTICES.md', 'LICENSE', 'package.json',
      'config.example.json', 'Install Claude Aura.cmd', 'Install Claude Aura.command', 'Uninstall Claude Aura.cmd')) {
      $source = Join-Path $SourceRoot $file
      if (Test-Path -LiteralPath $source) { Copy-Item -LiteralPath $source -Destination $installRoot -Force }
    }
  }

  $configPath = Join-Path $dataRoot 'config.json'
  & $node.Path (Join-Path $installRoot 'scripts\theme-cli.mjs') init --config $configPath | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'The installed configuration could not be initialized.' }

  $powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
  $scriptPath = Join-Path $installRoot 'windows\aura-ui.ps1'
  if (-not $NoShortcuts) {
    $desktop = [Environment]::GetFolderPath('Desktop')
    $programs = [Environment]::GetFolderPath('Programs')
    $menuRoot = Join-Path $programs 'Claude Aura'
    New-Item -ItemType Directory -Force -Path $menuRoot | Out-Null
    foreach ($legacyName in @('Claude Aura - Switch Theme.lnk', 'Claude Aura - Restore.lnk')) {
      Remove-Item -LiteralPath (Join-Path $desktop $legacyName) -Force -ErrorAction SilentlyContinue
      Remove-Item -LiteralPath (Join-Path $menuRoot $legacyName) -Force -ErrorAction SilentlyContinue
    }
    $shell = New-Object -ComObject WScript.Shell
    $icon = $null
    try { $icon = (Get-AuraClaudeInstall).Executable } catch {}
    foreach ($folder in @($desktop, $menuRoot)) {
      $shortcut = $shell.CreateShortcut((Join-Path $folder 'Claude Aura.lnk'))
      $shortcut.TargetPath = $powershell
      $shortcut.Arguments = "-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""
      $shortcut.WorkingDirectory = $installRoot
      $shortcut.WindowStyle = 7
      $shortcut.IconLocation = if ($icon) { "$icon,0" } else { "$env:SystemRoot\System32\shell32.dll,13" }
      $shortcut.Description = 'Open Claude with Aura themes'
      $shortcut.Save()
    }
    $uninstallShortcut = $shell.CreateShortcut((Join-Path $menuRoot 'Uninstall Claude Aura.lnk'))
    $uninstallShortcut.TargetPath = $powershell
    $uninstallShortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $installRoot 'windows\uninstall.ps1')`" -Interactive"
    $uninstallShortcut.WorkingDirectory = $env:LOCALAPPDATA
    $uninstallShortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,31"
    $uninstallShortcut.Description = 'Remove Claude Aura and optionally its local data'
    $uninstallShortcut.Save()
  }

  Write-Host "Claude Aura installed at $installRoot"
  Write-Host 'Open the Claude Aura shortcut; all appearance controls are inside the window.'

  if ($Launch) {
    $launchArguments = "-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""
    Start-Process -FilePath $powershell -ArgumentList $launchArguments -WindowStyle Hidden | Out-Null
  }
} finally {
  Exit-AuraOperationLock -Mutex $lock
}
