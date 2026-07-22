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
  $themeJsonNames = @(
    'registry.json',
    'default.json',
    'japanese-film-editorial.json',
    'korean-prestige.json',
    'cartoon-studio.json',
    'anime-twilight.json',
    'study-library.json',
    'japanese-idol.json',
    'korean-idol.json',
    'midnight.json',
    'ember.json',
    'forest.json',
    'sakura.json'
  )
  $canonicalThemeIds = @(
    'default',
    'japanese-film-editorial',
    'korean-prestige',
    'cartoon-studio',
    'anime-twilight',
    'study-library',
    'japanese-idol',
    'korean-idol'
  )
  $documentationNames = @(
    'ACCEPTANCE_AUDIT.md',
    'FILE_MANIFEST.md',
    'IMPLEMENTATION_REPORT.md',
    'SCREENSHOT_PLAN.md',
    'THEME_KIT_SPEC.md',
    'THEMING.md',
    'TROUBLESHOOTING.md'
  )
  if (Test-Path -LiteralPath (Join-Path $SourceRoot '.git')) {
    & $node.Path (Join-Path $SourceRoot 'tests\run-tests.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Claude Aura checks failed; installation stopped.' }
  } else {
    foreach ($themeId in $canonicalThemeIds) {
      & $node.Path (Join-Path $SourceRoot 'scripts\theme-cli.mjs') validate --theme $themeId | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "Claude Aura package validation failed for $themeId; installation stopped." }
    }
  }

  $installRoot = Join-Path $env:LOCALAPPDATA 'ClaudeAura\app'
  $dataRoot = Join-Path $env:LOCALAPPDATA 'ClaudeAura\data'
  New-Item -ItemType Directory -Force -Path $installRoot, $dataRoot | Out-Null
  $installRootFull = [IO.Path]::GetFullPath($installRoot).TrimEnd('\')
  $installedThemes = Join-Path $installRootFull 'themes'
  if (-not (Test-AuraPathEqual -Left $SourceRoot -Right $installRoot)) {
    foreach ($directory in @('assets', 'macos', 'scripts', 'studio', 'tests', 'vendor', 'windows')) {
      Copy-Item -LiteralPath (Join-Path $SourceRoot $directory) -Destination $installRoot -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $installedThemes | Out-Null
    foreach ($themeJsonName in $themeJsonNames) {
      $sourceTheme = Join-Path (Join-Path $SourceRoot 'themes') $themeJsonName
      if (-not (Test-Path -LiteralPath $sourceTheme -PathType Leaf)) {
        throw "Required theme descriptor is missing: $sourceTheme"
      }
      Copy-Item -LiteralPath $sourceTheme -Destination $installedThemes -Force
    }
    $installedDocs = Join-Path $installRoot 'docs'
    New-Item -ItemType Directory -Force -Path $installedDocs | Out-Null
    foreach ($documentationName in $documentationNames) {
      $sourceDocumentation = Join-Path (Join-Path $SourceRoot 'docs') $documentationName
      if (-not (Test-Path -LiteralPath $sourceDocumentation -PathType Leaf)) {
        throw "Required documentation is missing: $sourceDocumentation"
      }
      Copy-Item -LiteralPath $sourceDocumentation -Destination $installedDocs -Force
    }
    foreach ($installedDocumentation in @(Get-ChildItem -LiteralPath $installedDocs -Force)) {
      $keepDocumentation = (-not $installedDocumentation.PSIsContainer) -and
        ($documentationNames -contains $installedDocumentation.Name)
      if ($keepDocumentation) { continue }
      $resolvedDocumentation = [IO.Path]::GetFullPath($installedDocumentation.FullName)
      if (-not $resolvedDocumentation.StartsWith($installRootFull + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove a path outside the Aura installation: $resolvedDocumentation"
      }
      Remove-Item -LiteralPath $resolvedDocumentation -Recurse -Force
    }
    foreach ($file in @('README.md', 'SECURITY.md', 'NOTICE.md', 'THIRD_PARTY_NOTICES.md', 'LICENSE', 'package.json',
      'config.example.json', 'Install Claude Aura.cmd', 'Install Claude Aura.command', 'Uninstall Claude Aura.cmd')) {
      $source = Join-Path $SourceRoot $file
      if (Test-Path -LiteralPath $source) { Copy-Item -LiteralPath $source -Destination $installRoot -Force }
    }
  }

  New-Item -ItemType Directory -Force -Path $installedThemes | Out-Null
  foreach ($themeEntry in @(Get-ChildItem -LiteralPath $installedThemes -Force)) {
    $keepThemeDescriptor = (-not $themeEntry.PSIsContainer) -and ($themeJsonNames -contains $themeEntry.Name)
    if ($keepThemeDescriptor) { continue }
    $resolvedThemeEntry = [IO.Path]::GetFullPath($themeEntry.FullName)
    if (-not $resolvedThemeEntry.StartsWith($installRootFull + '\', [StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing to remove a path outside the Aura installation: $resolvedThemeEntry"
    }
    Remove-Item -LiteralPath $resolvedThemeEntry -Recurse -Force
  }

  foreach ($obsoletePath in @(
    (Join-Path $installRootFull 'preview'),
    (Join-Path $installRootFull 'scripts\build-preview.mjs'),
    (Join-Path $installRootFull 'scripts\preview-server.mjs'),
    (Join-Path $installRootFull 'scripts\qa-board.mjs'),
    (Join-Path $installRootFull 'docs\preview.png'),
    (Join-Path $installRootFull 'docs\golden'),
    (Join-Path $installRootFull 'docs\theme-screenshots'),
    (Join-Path $installRootFull 'tests\fixtures'),
    (Join-Path $installRootFull 'dist\qa'),
    (Join-Path $installRootFull 'assets\studio-previews\references'),
    (Join-Path $installRootFull 'assets\theme-art\japanese-film-editorial.svg'),
    (Join-Path $installRootFull 'assets\theme-art\japanese-film-editorial\hero.webp'),
    (Join-Path $installRootFull 'assets\theme-art\korean-prestige.svg'),
    (Join-Path $installRootFull 'assets\theme-art\korean-idol\background.webp'),
    (Join-Path $installRootFull 'assets\theme-art\korean-idol\constellation.webp'),
    (Join-Path $installRootFull 'assets\theme-art\kawaii-idol\mark.svg'),
    (Join-Path $installRootFull 'assets\theme-art\kawaii-idol\sakura-bottom-right.webp'),
    (Join-Path $installRootFull 'assets\theme-art\kawaii-idol\sakura-top-right.webp'),
    (Join-Path $installRootFull 'assets\theme-art\kawaii-idol\card-analyze.svg'),
    (Join-Path $installRootFull 'assets\theme-art\kawaii-idol\card-brainstorm.svg'),
    (Join-Path $installRootFull 'assets\theme-art\kawaii-idol\card-continue.svg'),
    (Join-Path $installRootFull 'assets\theme-art\kawaii-idol\keep-shining-sticker.svg'),
    (Join-Path $installRootFull 'assets\theme-art\kawaii-idol\logo-horizontal.svg'),
    (Join-Path $installRootFull 'assets\theme-art\kawaii-idol\note-heart.svg'),
    (Join-Path $installRootFull 'assets\theme-art\kawaii-idol\signature-hinata.svg'),
    (Join-Path $installRootFull 'assets\theme-art\kawaii-idol\sparkle-8.svg'),
    (Join-Path $installRootFull 'assets\theme-art\kawaii-idol\sparkle-cluster.svg'),
    (Join-Path $installRootFull 'assets\theme-art\kawaii-idol\sparkle-soft.svg'),
    (Join-Path $installRootFull 'assets\theme-art\kawaii-idol\star-outline.svg')
  )) {
    $resolvedObsoletePath = [IO.Path]::GetFullPath($obsoletePath)
    if (-not $resolvedObsoletePath.StartsWith($installRootFull + '\', [StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing to remove a path outside the Aura installation: $resolvedObsoletePath"
    }
    if (Test-Path -LiteralPath $resolvedObsoletePath) {
      Remove-Item -LiteralPath $resolvedObsoletePath -Recurse -Force
    }
  }

  $installedVerifyRoot = Join-Path $installRootFull 'dist\verify'
  if (Test-Path -LiteralPath $installedVerifyRoot -PathType Container) {
    foreach ($verifyEntry in @(Get-ChildItem -LiteralPath $installedVerifyRoot -Force)) {
      $keepLiveEvidence = ($verifyEntry.PSIsContainer -and @('live-aura', 'live-content-audit', 'wo17-icon') -contains $verifyEntry.Name) -or
        ((-not $verifyEntry.PSIsContainer) -and $verifyEntry.Name -match '-live-content\.(?:avif|jpe?g|png|webp)$')
      if ($keepLiveEvidence) { continue }
      $resolvedVerifyEntry = [IO.Path]::GetFullPath($verifyEntry.FullName)
      if (-not $resolvedVerifyEntry.StartsWith($installRootFull + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove a path outside the Aura installation: $resolvedVerifyEntry"
      }
      Remove-Item -LiteralPath $resolvedVerifyEntry -Recurse -Force
    }
  }

  $configPath = Join-Path $dataRoot 'config.json'
  & $node.Path (Join-Path $installRoot 'scripts\theme-cli.mjs') init --config $configPath | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'The installed configuration could not be initialized.' }

  $powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
  $scriptPath = Join-Path $installRoot 'windows\aura-ui.ps1'
  $iconPath = Join-Path $installRoot 'assets\brand\claude-aura.ico'
  if (-not (Test-Path -LiteralPath $iconPath -PathType Leaf)) {
    throw "The Claude Aura icon is missing: $iconPath"
  }
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
    $baseArguments = "-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""
    $shortcutDefinitions = @(
      [PSCustomObject]@{
        Name = 'Claude Aura.lnk'
        Arguments = $baseArguments
        Description = 'Open Claude with Aura themes'
      },
      [PSCustomObject]@{
        Name = 'Claude Aura Studio.lnk'
        Arguments = "$baseArguments -OpenStudio"
        Description = 'Claude Aura Studio'
      }
    )
    foreach ($folder in @($desktop, $menuRoot)) {
      foreach ($definition in $shortcutDefinitions) {
        $shortcut = $shell.CreateShortcut((Join-Path $folder $definition.Name))
        $shortcut.TargetPath = $powershell
        $shortcut.Arguments = $definition.Arguments
        $shortcut.WorkingDirectory = $installRoot
        $shortcut.WindowStyle = 7
        $shortcut.IconLocation = "$iconPath,0"
        $shortcut.Description = $definition.Description
        $shortcut.Save()
      }
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
