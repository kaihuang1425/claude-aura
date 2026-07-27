[CmdletBinding()]
param(
  [switch]$NoShortcuts,
  [switch]$NoDesktopShortcuts,
  [switch]$Launch
)

$ErrorActionPreference = 'Stop'
$SourceRoot = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'common.ps1')

function Test-AuraInstalledWindowsIcon {
  param([Parameter(Mandatory = $true)][string]$Path)
  $expectedSizes = @(16, 20, 24, 32, 40, 48, 64, 128, 256)
  try {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
    $bytes = [IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -lt (6 + ($expectedSizes.Count * 16)) -or
        [BitConverter]::ToUInt16($bytes, 0) -ne 0 -or
        [BitConverter]::ToUInt16($bytes, 2) -ne 1 -or
        [BitConverter]::ToUInt16($bytes, 4) -ne $expectedSizes.Count) {
      return $false
    }

    $expectedOffset = 6 + ($expectedSizes.Count * 16)
    for ($index = 0; $index -lt $expectedSizes.Count; $index++) {
      $entryOffset = 6 + ($index * 16)
      $width = if ($bytes[$entryOffset] -eq 0) { 256 } else { [int]$bytes[$entryOffset] }
      $height = if ($bytes[$entryOffset + 1] -eq 0) { 256 } else { [int]$bytes[$entryOffset + 1] }
      $frameLength = [int][BitConverter]::ToUInt32($bytes, $entryOffset + 8)
      $frameOffset = [int][BitConverter]::ToUInt32($bytes, $entryOffset + 12)
      if ($width -ne $expectedSizes[$index] -or $height -ne $width -or
          $bytes[$entryOffset + 2] -ne 0 -or $bytes[$entryOffset + 3] -ne 0 -or
          [BitConverter]::ToUInt16($bytes, $entryOffset + 4) -ne 1 -or
          [BitConverter]::ToUInt16($bytes, $entryOffset + 6) -ne 32 -or
          $frameLength -le 0 -or $frameOffset -ne $expectedOffset -or
          ([uint64]$frameOffset + [uint64]$frameLength) -gt [uint64]$bytes.Length) {
        return $false
      }

      if ($width -eq 256) {
        if ($frameLength -lt 33 -or
            $bytes[$frameOffset] -ne 137 -or $bytes[$frameOffset + 1] -ne 80 -or
            $bytes[$frameOffset + 2] -ne 78 -or $bytes[$frameOffset + 3] -ne 71 -or
            $bytes[$frameOffset + 4] -ne 13 -or $bytes[$frameOffset + 5] -ne 10 -or
            $bytes[$frameOffset + 6] -ne 26 -or $bytes[$frameOffset + 7] -ne 10 -or
            $bytes[$frameOffset + 8] -ne 0 -or $bytes[$frameOffset + 9] -ne 0 -or
            $bytes[$frameOffset + 10] -ne 0 -or $bytes[$frameOffset + 11] -ne 13 -or
            $bytes[$frameOffset + 12] -ne 73 -or $bytes[$frameOffset + 13] -ne 72 -or
            $bytes[$frameOffset + 14] -ne 68 -or $bytes[$frameOffset + 15] -ne 82) {
          return $false
        }
        $pngWidth = ([int]$bytes[$frameOffset + 16] * 16777216) +
          ([int]$bytes[$frameOffset + 17] * 65536) + ([int]$bytes[$frameOffset + 18] * 256) +
          [int]$bytes[$frameOffset + 19]
        $pngHeight = ([int]$bytes[$frameOffset + 20] * 16777216) +
          ([int]$bytes[$frameOffset + 21] * 65536) + ([int]$bytes[$frameOffset + 22] * 256) +
          [int]$bytes[$frameOffset + 23]
        if ($pngWidth -ne 256 -or $pngHeight -ne 256) { return $false }
      } else {
        $maskStride = [int]([Math]::Ceiling($width / 32.0)) * 4
        $expectedFrameLength = 40 + ($width * $width * 4) + ($maskStride * $width)
        if ($frameLength -ne $expectedFrameLength -or
            [BitConverter]::ToUInt32($bytes, $frameOffset) -ne 40 -or
            [BitConverter]::ToInt32($bytes, $frameOffset + 4) -ne $width -or
            [BitConverter]::ToInt32($bytes, $frameOffset + 8) -ne ($width * 2) -or
            [BitConverter]::ToUInt16($bytes, $frameOffset + 12) -ne 1 -or
            [BitConverter]::ToUInt16($bytes, $frameOffset + 14) -ne 32 -or
            [BitConverter]::ToUInt32($bytes, $frameOffset + 16) -ne 0 -or
            [BitConverter]::ToUInt32($bytes, $frameOffset + 20) -ne ($width * $width * 4)) {
          return $false
        }
      }
      $expectedOffset += $frameLength
    }
    return $expectedOffset -eq $bytes.Length
  } catch { return $false }
}

function Get-AuraInstalledThemeIconPath {
  param(
    [Parameter(Mandatory = $true)][string]$InstallRoot,
    [Parameter(Mandatory = $true)][string]$ThemeId
  )
  if ($ThemeId -cnotmatch '^[a-z][a-z0-9-]{1,39}$') { return $null }
  try {
    $themeArtRoot = [IO.Path]::GetFullPath((Join-Path $InstallRoot 'assets\theme-art')).TrimEnd(
      [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    $candidate = [IO.Path]::GetFullPath((Join-Path $themeArtRoot "$ThemeId\launcher-mark.ico"))
    if (-not $candidate.StartsWith($themeArtRoot + [IO.Path]::DirectorySeparatorChar,
        [StringComparison]::OrdinalIgnoreCase) -or
        -not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
      return $null
    }
    $relative = $candidate.Substring($themeArtRoot.Length + 1).Replace('\', '/')
    if ($relative -cne "$ThemeId/launcher-mark.ico") { return $null }
    $cursor = $candidate
    while ($true) {
      $item = Get-Item -LiteralPath $cursor -Force
      if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { return $null }
      if ([string]::Equals($cursor.TrimEnd(
            [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar),
          $themeArtRoot, [StringComparison]::OrdinalIgnoreCase)) {
        if (Test-AuraInstalledWindowsIcon -Path $candidate) { return $candidate }
        return $null
      }
      $parent = Split-Path $cursor -Parent
      if (-not $parent) { return $null }
      $cursor = [IO.Path]::GetFullPath($parent).TrimEnd(
        [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
      if (-not [string]::Equals($cursor, $themeArtRoot, [StringComparison]::OrdinalIgnoreCase) -and
          -not $cursor.StartsWith($themeArtRoot + [IO.Path]::DirectorySeparatorChar,
            [StringComparison]::OrdinalIgnoreCase)) {
        return $null
      }
    }
  } catch { return $null }
}

function Get-AuraInstallFullPath {
  param([Parameter(Mandatory = $true)][string]$Path)
  $fullPath = [IO.Path]::GetFullPath($Path)
  $pathRoot = [IO.Path]::GetPathRoot($fullPath)
  if ([string]::Equals($fullPath, $pathRoot, [StringComparison]::OrdinalIgnoreCase)) {
    return $pathRoot
  }
  return $fullPath.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
}

function Test-AuraInstallPathWithin {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$Path,
    [switch]$AllowRoot
  )
  try {
    $rootFull = Get-AuraInstallFullPath -Path $Root
    $pathFull = Get-AuraInstallFullPath -Path $Path
    if ($AllowRoot -and [string]::Equals($rootFull, $pathFull, [StringComparison]::OrdinalIgnoreCase)) {
      return $true
    }
    $rootPrefix = if ($rootFull.EndsWith([string][IO.Path]::DirectorySeparatorChar,
        [StringComparison]::Ordinal)) {
      $rootFull
    } else {
      $rootFull + [IO.Path]::DirectorySeparatorChar
    }
    return $pathFull.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)
  } catch { return $false }
}

function Get-AuraInstallRelativePath {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$Path
  )
  $rootFull = Get-AuraInstallFullPath -Path $Root
  $pathFull = Get-AuraInstallFullPath -Path $Path
  if (-not (Test-AuraInstallPathWithin -Root $rootFull -Path $pathFull)) {
    throw "Aura path is not below its validated root: $pathFull"
  }
  $rootPrefix = if ($rootFull.EndsWith([string][IO.Path]::DirectorySeparatorChar,
      [StringComparison]::Ordinal)) {
    $rootFull
  } else {
    $rootFull + [IO.Path]::DirectorySeparatorChar
  }
  return $pathFull.Substring($rootPrefix.Length).Replace('\', '/')
}

function Assert-AuraInstallItemIsNotReparsePoint {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$Path
  )
  $rootFull = Get-AuraInstallFullPath -Path $Root
  $pathFull = Get-AuraInstallFullPath -Path $Path
  if (-not (Test-AuraInstallPathWithin -Root $rootFull -Path $pathFull -AllowRoot)) {
    throw "Refusing an Aura install path outside its validated root: $pathFull"
  }
  $cursor = $pathFull
  while ($true) {
    if (Test-Path -LiteralPath $cursor) {
      $item = Get-Item -LiteralPath $cursor -Force
      if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Refusing an Aura install path that contains a reparse point: $cursor"
      }
    }
    if ([string]::Equals($cursor, $rootFull, [StringComparison]::OrdinalIgnoreCase)) { return }
    $parent = Split-Path $cursor -Parent
    if (-not $parent) { throw "Aura install path escaped its validated root: $pathFull" }
    $cursor = Get-AuraInstallFullPath -Path $parent
    if (-not (Test-AuraInstallPathWithin -Root $rootFull -Path $cursor -AllowRoot)) {
      throw "Aura install path escaped its validated root: $pathFull"
    }
  }
}

function Assert-AuraInstallTreeHasNoReparsePoints {
  param([Parameter(Mandatory = $true)][string]$Root)
  $rootFull = Get-AuraInstallFullPath -Path $Root
  if (-not (Test-Path -LiteralPath $rootFull -PathType Container)) {
    throw "Required Aura install directory is missing: $rootFull"
  }
  Assert-AuraInstallItemIsNotReparsePoint -Root $rootFull -Path $rootFull
  $pending = [Collections.Generic.Stack[string]]::new()
  $pending.Push($rootFull)
  while ($pending.Count -gt 0) {
    $directory = $pending.Pop()
    foreach ($entry in @(Get-ChildItem -LiteralPath $directory -Force)) {
      if (-not (Test-AuraInstallPathWithin -Root $rootFull -Path $entry.FullName)) {
        throw "Aura install tree entry escaped its validated root: $($entry.FullName)"
      }
      if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Refusing an Aura install tree that contains a reparse point: $($entry.FullName)"
      }
      if ($entry.PSIsContainer) { $pending.Push($entry.FullName) }
    }
  }
}

function Test-AuraInstallLocalOrTemporaryPath {
  param([Parameter(Mandatory = $true)][string]$RelativePath)
  $segments = @($RelativePath.Replace('\', '/') -split '/' | Where-Object { $_ })
  if ($segments.Count -eq 0) { return $true }
  $name = $segments[$segments.Count - 1]
  if (@($segments | Where-Object { $_.StartsWith('.', [StringComparison]::Ordinal) }).Count -gt 0) {
    return $true
  }
  return $name.StartsWith('.tmp-', [StringComparison]::Ordinal) -or
    $name.EndsWith('.log', [StringComparison]::OrdinalIgnoreCase) -or
    $name.Contains('.corrupt-') -or
    @('config.json', 'config.local.json', 'state.json') -contains $name.ToLowerInvariant() -or
    $name -match '(?i)(?:^|\.)local(?:\.|$)'
}

function Test-AuraInstallExcludedReleasePath {
  param([Parameter(Mandatory = $true)][string]$RelativePath)
  $normalized = $RelativePath.Replace('\', '/')
  if ($normalized -ceq 'scripts/qa-board.mjs' -or
      $normalized -ceq 'tests/fixtures/claude-dom.html') {
    return $true
  }
  foreach ($directory in @(
    'docs/golden',
    'docs/theme-screenshots',
    'tests/fixtures',
    'assets/studio-previews/references'
  )) {
    if ($normalized -ceq $directory -or
        $normalized.StartsWith($directory + '/', [StringComparison]::Ordinal)) {
      return $true
    }
  }
  return $false
}

function Add-AuraInstallSourceFile {
  param(
    [Parameter(Mandatory = $true)][string]$SourceRoot,
    [Parameter(Mandatory = $true)][string]$RelativePath,
    [Parameter(Mandatory = $true)][AllowEmptyCollection()][Collections.Generic.List[object]]$Files,
    [Parameter(Mandatory = $true)][AllowEmptyCollection()][Collections.Generic.HashSet[string]]$Seen
  )
  $normalized = $RelativePath.Replace('\', '/').Trim('/')
  if (-not $normalized -or [IO.Path]::IsPathRooted($normalized) -or
      @($normalized -split '/' | Where-Object { -not $_ -or $_ -eq '.' -or $_ -eq '..' }).Count -gt 0) {
    throw "Invalid Aura release path: $RelativePath"
  }
  $sourcePath = Get-AuraInstallFullPath -Path (Join-Path $SourceRoot $normalized.Replace('/', '\'))
  if (-not (Test-AuraInstallPathWithin -Root $SourceRoot -Path $sourcePath)) {
    throw "Aura release path escaped its source root: $sourcePath"
  }
  if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
    throw "Required Aura release file is missing: $sourcePath"
  }
  Assert-AuraInstallItemIsNotReparsePoint -Root $SourceRoot -Path $sourcePath
  if (-not $Seen.Add($normalized)) {
    throw "Duplicate Aura release path: $normalized"
  }
  $Files.Add([PSCustomObject]@{
    RelativePath = $normalized
    SourcePath = $sourcePath
    SourceRoot = $SourceRoot
  })
}

function Get-AuraInstallSourceFiles {
  param(
    [Parameter(Mandatory = $true)][string]$SourceRoot,
    [Parameter(Mandatory = $true)][string[]]$ThemeJsonNames,
    [Parameter(Mandatory = $true)][string[]]$DocumentationNames
  )
  $sourceRootFull = Get-AuraInstallFullPath -Path $SourceRoot
  if (-not (Test-Path -LiteralPath $sourceRootFull -PathType Container)) {
    throw "Claude Aura source directory is missing: $sourceRootFull"
  }
  Assert-AuraInstallItemIsNotReparsePoint -Root $sourceRootFull -Path $sourceRootFull
  $files = [Collections.Generic.List[object]]::new()
  $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)

  $releaseRootFiles = @(
    'CONTRIBUTING.md',
    'Install Claude Aura.cmd',
    'Install Claude Aura.command',
    'LICENSE',
    'NOTICE.md',
    'README.md',
    'SECURITY.md',
    'THIRD_PARTY_NOTICES.md',
    'Uninstall Claude Aura.cmd',
    'config.example.json',
    'package.json'
  )
  foreach ($relativePath in $releaseRootFiles) {
    Add-AuraInstallSourceFile -SourceRoot $sourceRootFull -RelativePath $relativePath -Files $files -Seen $seen
  }
  foreach ($documentationName in $DocumentationNames) {
    Add-AuraInstallSourceFile -SourceRoot $sourceRootFull -RelativePath "docs/$documentationName" `
      -Files $files -Seen $seen
  }
  $themesRoot = Get-AuraInstallFullPath -Path (Join-Path $sourceRootFull 'themes')
  if (-not (Test-Path -LiteralPath $themesRoot -PathType Container)) {
    throw "Required Aura release directory is missing: $themesRoot"
  }
  Assert-AuraInstallItemIsNotReparsePoint -Root $sourceRootFull -Path $themesRoot
  foreach ($themeEntry in @(Get-ChildItem -LiteralPath $themesRoot -Force | Sort-Object Name)) {
    if (($themeEntry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "Refusing an Aura source tree that contains a reparse point: $($themeEntry.FullName)"
    }
    # Per-theme directories are supplied source kits. The release builder and
    # installer both leave them untouched and include top-level JSON only.
    if ($themeEntry.PSIsContainer) { continue }
    $relativePath = Get-AuraInstallRelativePath -Root $sourceRootFull -Path $themeEntry.FullName
    if (Test-AuraInstallLocalOrTemporaryPath -RelativePath $relativePath) { continue }
    if ([IO.Path]::GetExtension($themeEntry.Name).ToLowerInvariant() -ne '.json') { continue }
    Add-AuraInstallSourceFile -SourceRoot $sourceRootFull -RelativePath $relativePath `
      -Files $files -Seen $seen
  }
  foreach ($themeJsonName in $ThemeJsonNames) {
    $requiredThemePath = "themes/$themeJsonName"
    if (-not $seen.Contains($requiredThemePath)) {
      throw "Required Aura release file is missing: $(Join-Path $sourceRootFull $requiredThemePath.Replace('/', '\'))"
    }
  }

  $releaseDirectories = [ordered]@{
    assets = @('.avif', '.css', '.ico', '.js', '.md', '.png', '.svg', '.webp')
    macos = @('.command', '.sh')
    scripts = @('.mjs')
    studio = @('.css', '.html', '.js')
    tests = @('.mjs')
    vendor = @('.dll', '.txt')
    windows = @('.json', '.ps1')
  }
  foreach ($directoryName in $releaseDirectories.Keys) {
    $directoryRoot = Get-AuraInstallFullPath -Path (Join-Path $sourceRootFull $directoryName)
    if (-not (Test-Path -LiteralPath $directoryRoot -PathType Container)) {
      throw "Required Aura release directory is missing: $directoryRoot"
    }
    Assert-AuraInstallItemIsNotReparsePoint -Root $sourceRootFull -Path $directoryRoot
    $pending = [Collections.Generic.Stack[string]]::new()
    $pending.Push($directoryRoot)
    while ($pending.Count -gt 0) {
      $directory = $pending.Pop()
      foreach ($entry in @(Get-ChildItem -LiteralPath $directory -Force | Sort-Object Name)) {
        if (-not (Test-AuraInstallPathWithin -Root $sourceRootFull -Path $entry.FullName)) {
          throw "Aura source entry escaped its validated root: $($entry.FullName)"
        }
        if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
          throw "Refusing an Aura source tree that contains a reparse point: $($entry.FullName)"
        }
        $relativePath = Get-AuraInstallRelativePath -Root $sourceRootFull -Path $entry.FullName
        if (Test-AuraInstallLocalOrTemporaryPath -RelativePath $relativePath) { continue }
        if (Test-AuraInstallExcludedReleasePath -RelativePath $relativePath) { continue }
        if ($entry.PSIsContainer) {
          $pending.Push($entry.FullName)
          continue
        }
        $extension = [IO.Path]::GetExtension($entry.Name).ToLowerInvariant()
        if ($releaseDirectories[$directoryName] -notcontains $extension) { continue }
        Add-AuraInstallSourceFile -SourceRoot $sourceRootFull -RelativePath $relativePath `
          -Files $files -Seen $seen
      }
    }
  }
  return @($files | Sort-Object RelativePath)
}

function Assert-AuraManagedAppPath {
  param(
    [Parameter(Mandatory = $true)][string]$AuraRoot,
    [Parameter(Mandatory = $true)][string]$Path
  )
  $auraRootFull = Get-AuraInstallFullPath -Path $AuraRoot
  $pathFull = Get-AuraInstallFullPath -Path $Path
  if (-not (Test-AuraInstallPathWithin -Root $auraRootFull -Path $pathFull) -or
      -not [string]::Equals((Split-Path $pathFull -Parent), $auraRootFull,
        [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing an app-tree operation outside the Claude Aura root: $pathFull"
  }
  $name = Split-Path $pathFull -Leaf
  if ($name -cne 'app' -and
      $name -cnotmatch '^\.app-(?:stage|backup|rollback)-[0-9a-f]{32}$') {
    throw "Refusing an unmanaged Claude Aura app-tree path: $pathFull"
  }
}

function Remove-AuraManagedAppTree {
  param(
    [Parameter(Mandatory = $true)][string]$AuraRoot,
    [Parameter(Mandatory = $true)][string]$Path
  )
  Assert-AuraManagedAppPath -AuraRoot $AuraRoot -Path $Path
  if (-not (Test-Path -LiteralPath $Path)) { return }
  Assert-AuraInstallTreeHasNoReparsePoints -Root $Path
  Remove-Item -LiteralPath $Path -Recurse -Force
}

function Move-AuraManagedAppTree {
  param(
    [Parameter(Mandatory = $true)][string]$AuraRoot,
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination
  )
  Assert-AuraManagedAppPath -AuraRoot $AuraRoot -Path $Source
  Assert-AuraManagedAppPath -AuraRoot $AuraRoot -Path $Destination
  if (Test-Path -LiteralPath $Destination) {
    throw "Claude Aura app-tree destination already exists: $Destination"
  }
  Assert-AuraInstallTreeHasNoReparsePoints -Root $Source
  Move-Item -LiteralPath $Source -Destination $Destination
}

function New-AuraInstallStage {
  param(
    [Parameter(Mandatory = $true)][string]$AuraRoot,
    [Parameter(Mandatory = $true)][string]$StageRoot,
    [Parameter(Mandatory = $true)][object[]]$SourceFiles
  )
  Assert-AuraManagedAppPath -AuraRoot $AuraRoot -Path $StageRoot
  if (Test-Path -LiteralPath $StageRoot) {
    throw "Claude Aura staging directory already exists: $StageRoot"
  }
  New-Item -ItemType Directory -Path $StageRoot | Out-Null
  Assert-AuraInstallItemIsNotReparsePoint -Root $AuraRoot -Path $StageRoot
  $stagedRelativePaths = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  foreach ($sourceFile in $SourceFiles) {
    $relativePath = [string]$sourceFile.RelativePath
    $sourcePath = [string]$sourceFile.SourcePath
    Assert-AuraInstallItemIsNotReparsePoint -Root ([string]$sourceFile.SourceRoot) -Path $sourcePath
    $destination = Get-AuraInstallFullPath -Path (Join-Path $StageRoot $relativePath.Replace('/', '\'))
    if (-not (Test-AuraInstallPathWithin -Root $StageRoot -Path $destination)) {
      throw "Aura staging path escaped its validated root: $destination"
    }
    $destinationDirectory = Split-Path $destination -Parent
    New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
    Assert-AuraInstallItemIsNotReparsePoint -Root $StageRoot -Path $destinationDirectory
    Copy-Item -LiteralPath $sourcePath -Destination $destination
    Assert-AuraInstallItemIsNotReparsePoint -Root $StageRoot -Path $destination
    $sourceItem = Get-Item -LiteralPath $sourcePath -Force
    $destinationItem = Get-Item -LiteralPath $destination -Force
    if ($sourceItem.Length -ne $destinationItem.Length -or
        (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash -cne
          (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash) {
      throw "Aura staging verification failed for: $relativePath"
    }
    [void]$stagedRelativePaths.Add($relativePath)
  }
  Assert-AuraInstallTreeHasNoReparsePoints -Root $StageRoot
  $stagedFiles = @(Get-ChildItem -LiteralPath $StageRoot -Recurse -Force -File)
  if ($stagedFiles.Count -ne $SourceFiles.Count -or
      $stagedRelativePaths.Count -ne $SourceFiles.Count) {
    throw 'Aura staging verification found an incomplete application tree.'
  }
  foreach ($stagedFile in $stagedFiles) {
    $relativePath = Get-AuraInstallRelativePath -Root $StageRoot -Path $stagedFile.FullName
    if (-not $stagedRelativePaths.Contains($relativePath)) {
      throw "Aura staging verification found an unexpected file: $relativePath"
    }
  }
}

function Restore-AuraInstalledAppTree {
  param(
    [Parameter(Mandatory = $true)][string]$AuraRoot,
    [Parameter(Mandatory = $true)][string]$InstallRoot,
    [Parameter(Mandatory = $true)][string]$BackupRoot,
    [Parameter(Mandatory = $true)][string]$RollbackRoot,
    [Parameter(Mandatory = $true)][bool]$HadPreviousApp
  )
  if (-not $HadPreviousApp) {
    Remove-AuraManagedAppTree -AuraRoot $AuraRoot -Path $InstallRoot
    return
  }
  if (-not (Test-Path -LiteralPath $BackupRoot -PathType Container)) {
    throw "The previous Claude Aura app backup is missing: $BackupRoot"
  }
  $movedReplacement = $false
  if (Test-Path -LiteralPath $InstallRoot) {
    Move-AuraManagedAppTree -AuraRoot $AuraRoot -Source $InstallRoot -Destination $RollbackRoot
    $movedReplacement = $true
  }
  try {
    Move-AuraManagedAppTree -AuraRoot $AuraRoot -Source $BackupRoot -Destination $InstallRoot
  } catch {
    if ($movedReplacement -and -not (Test-Path -LiteralPath $InstallRoot) -and
        (Test-Path -LiteralPath $RollbackRoot -PathType Container)) {
      Move-AuraManagedAppTree -AuraRoot $AuraRoot -Source $RollbackRoot -Destination $InstallRoot
    }
    throw
  }
  if ($movedReplacement) {
    try {
      Remove-AuraManagedAppTree -AuraRoot $AuraRoot -Path $RollbackRoot
    } catch {
      Write-Warning "Claude Aura restored the prior app but could not remove the rejected replacement: $($_.Exception.Message)"
    }
  }
}

function New-AuraInstallFileSnapshot {
  param(
    [Parameter(Mandatory = $true)][string]$ValidationRoot,
    [Parameter(Mandatory = $true)][string]$Path
  )
  $rootFull = Get-AuraInstallFullPath -Path $ValidationRoot
  $pathFull = Get-AuraInstallFullPath -Path $Path
  if (-not (Test-Path -LiteralPath $rootFull -PathType Container)) {
    throw "Required snapshot root is missing: $rootFull"
  }
  if (-not (Test-AuraInstallPathWithin -Root $rootFull -Path $pathFull)) {
    throw "Refusing to snapshot a path outside its validated root: $pathFull"
  }
  Assert-AuraInstallItemIsNotReparsePoint -Root $rootFull -Path $pathFull
  if (-not (Test-Path -LiteralPath $pathFull)) {
    return [PSCustomObject]@{
      ValidationRoot = $rootFull
      Path = $pathFull
      Existed = $false
      Bytes = $null
      Attributes = $null
      CreationTimeUtc = $null
      LastWriteTimeUtc = $null
    }
  }
  if (-not (Test-Path -LiteralPath $pathFull -PathType Leaf)) {
    throw "Refusing to replace a non-file install artifact: $pathFull"
  }
  $item = Get-Item -LiteralPath $pathFull -Force
  return [PSCustomObject]@{
    ValidationRoot = $rootFull
    Path = $pathFull
    Existed = $true
    Bytes = [IO.File]::ReadAllBytes($pathFull)
    Attributes = $item.Attributes
    CreationTimeUtc = $item.CreationTimeUtc
    LastWriteTimeUtc = $item.LastWriteTimeUtc
  }
}

function Restore-AuraInstallFileSnapshot {
  param([Parameter(Mandatory = $true)][object]$Snapshot)
  $rootFull = Get-AuraInstallFullPath -Path ([string]$Snapshot.ValidationRoot)
  $pathFull = Get-AuraInstallFullPath -Path ([string]$Snapshot.Path)
  if (-not (Test-AuraInstallPathWithin -Root $rootFull -Path $pathFull)) {
    throw "Refusing to restore a path outside its validated root: $pathFull"
  }
  $parent = Split-Path $pathFull -Parent
  Assert-AuraInstallItemIsNotReparsePoint -Root $rootFull -Path $parent
  if ([bool]$Snapshot.Existed) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    Assert-AuraInstallItemIsNotReparsePoint -Root $rootFull -Path $parent
    if ((Test-Path -LiteralPath $pathFull) -and
        -not (Test-Path -LiteralPath $pathFull -PathType Leaf)) {
      throw "Refusing to overwrite a non-file install artifact during rollback: $pathFull"
    }
    Assert-AuraInstallItemIsNotReparsePoint -Root $rootFull -Path $pathFull
    $temporary = Join-Path $parent ".aura-install-restore-$([Guid]::NewGuid().ToString('N')).tmp"
    if (-not (Test-AuraInstallPathWithin -Root $rootFull -Path $temporary) -or
        (Test-Path -LiteralPath $temporary)) {
      throw "Refusing an unsafe install rollback temporary path: $temporary"
    }
    $displaced = Join-Path $parent ".aura-install-displaced-$([Guid]::NewGuid().ToString('N')).tmp"
    if (-not (Test-AuraInstallPathWithin -Root $rootFull -Path $displaced) -or
        (Test-Path -LiteralPath $displaced)) {
      throw "Refusing an unsafe install rollback backup path: $displaced"
    }
    $publishedAndVerified = $false
    try {
      [IO.File]::WriteAllBytes($temporary, [byte[]]$Snapshot.Bytes)
      Assert-AuraInstallItemIsNotReparsePoint -Root $rootFull -Path $temporary
      if (Test-Path -LiteralPath $pathFull -PathType Leaf) {
        $currentAttributes = [IO.File]::GetAttributes($pathFull)
        if (($currentAttributes -band [IO.FileAttributes]::ReadOnly) -ne 0) {
          [IO.File]::SetAttributes($pathFull,
            ($currentAttributes -band (-bnot [IO.FileAttributes]::ReadOnly)))
        }
        [IO.File]::Replace($temporary, $pathFull, $displaced, $true)
      } else {
        Move-Item -LiteralPath $temporary -Destination $pathFull
      }
      $restoredBytes = [IO.File]::ReadAllBytes($pathFull)
      if ($restoredBytes.Length -ne ([byte[]]$Snapshot.Bytes).Length -or
          -not [Linq.Enumerable]::SequenceEqual([byte[]]$Snapshot.Bytes, $restoredBytes)) {
        throw "Restored bytes did not match the install snapshot: $pathFull"
      }
      [IO.File]::SetCreationTimeUtc($pathFull, [DateTime]$Snapshot.CreationTimeUtc)
      [IO.File]::SetLastWriteTimeUtc($pathFull, [DateTime]$Snapshot.LastWriteTimeUtc)
      [IO.File]::SetAttributes($pathFull, [IO.FileAttributes]$Snapshot.Attributes)
      $publishedAndVerified = $true
    } catch {
      $recoveryPaths = [Collections.Generic.List[string]]::new()
      foreach ($candidate in @($temporary, $displaced)) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
          Assert-AuraInstallItemIsNotReparsePoint -Root $rootFull -Path $candidate
          $recoveryPaths.Add($candidate)
        }
      }
      $recoveryMessage = if ($recoveryPaths.Count -gt 0) {
        " Recovery files were retained at $($recoveryPaths -join ', ')."
      } else { '' }
      throw "Exact file rollback failed for ${pathFull}: $($_.Exception.Message).$recoveryMessage"
    }
    if (-not $publishedAndVerified) {
      throw "Exact file rollback was not verified: $pathFull"
    }
    foreach ($candidate in @($temporary, $displaced)) {
      if (Test-Path -LiteralPath $candidate) {
        Assert-AuraInstallItemIsNotReparsePoint -Root $rootFull -Path $candidate
        Remove-Item -LiteralPath $candidate -Force
      }
    }
    return
  }
  if (Test-Path -LiteralPath $pathFull) {
    if (-not (Test-Path -LiteralPath $pathFull -PathType Leaf)) {
      throw "Refusing to remove a non-file install artifact during rollback: $pathFull"
    }
    Assert-AuraInstallItemIsNotReparsePoint -Root $rootFull -Path $pathFull
    Remove-Item -LiteralPath $pathFull -Force
  }
}

function Get-AuraConfigCorruptBackupPaths {
  param(
    [Parameter(Mandatory = $true)][string]$AuraRoot,
    [Parameter(Mandatory = $true)][string]$DataRoot
  )
  $paths = [Collections.Generic.List[string]]::new()
  if (-not (Test-Path -LiteralPath $DataRoot -PathType Container)) { return @() }
  Assert-AuraInstallItemIsNotReparsePoint -Root $AuraRoot -Path $DataRoot
  foreach ($entry in @(Get-ChildItem -LiteralPath $DataRoot -Force)) {
    if ($entry.PSIsContainer -or
        $entry.Name -cnotmatch '^config\.json\.corrupt-\d{14}-[0-9a-f]{10}\.json$') {
      continue
    }
    Assert-AuraInstallItemIsNotReparsePoint -Root $AuraRoot -Path $entry.FullName
    $paths.Add((Get-AuraInstallFullPath -Path $entry.FullName))
  }
  return @($paths)
}

function New-AuraConfigInstallSnapshot {
  param(
    [Parameter(Mandatory = $true)][string]$AuraRoot,
    [Parameter(Mandatory = $true)][string]$DataRoot,
    [Parameter(Mandatory = $true)][string]$ConfigPath,
    [Parameter(Mandatory = $true)][bool]$DataRootExisted
  )
  return [PSCustomObject]@{
    AuraRoot = Get-AuraInstallFullPath -Path $AuraRoot
    DataRoot = Get-AuraInstallFullPath -Path $DataRoot
    DataRootExisted = $DataRootExisted
    Config = New-AuraInstallFileSnapshot -ValidationRoot $AuraRoot -Path $ConfigPath
    CorruptBackupPaths = @(Get-AuraConfigCorruptBackupPaths -AuraRoot $AuraRoot -DataRoot $DataRoot)
  }
}

function Restore-AuraConfigInstallSnapshot {
  param([Parameter(Mandatory = $true)][object]$Snapshot)
  $failures = [Collections.Generic.List[string]]::new()
  $previousCorruptPaths = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  foreach ($path in @($Snapshot.CorruptBackupPaths)) { [void]$previousCorruptPaths.Add([string]$path) }
  $configRestored = $false
  try {
    Restore-AuraInstallFileSnapshot -Snapshot $Snapshot.Config
    $configRestored = $true
  } catch {
    $failures.Add("config.json: $($_.Exception.Message)")
  }
  try {
    $newCorruptPaths = [Collections.Generic.List[string]]::new()
    foreach ($path in @(Get-AuraConfigCorruptBackupPaths -AuraRoot $Snapshot.AuraRoot `
        -DataRoot $Snapshot.DataRoot)) {
      if ($previousCorruptPaths.Contains($path)) { continue }
      $newCorruptPaths.Add($path)
      if (-not $configRestored) { continue }
      try {
        Assert-AuraInstallItemIsNotReparsePoint -Root $Snapshot.AuraRoot -Path $path
        Remove-Item -LiteralPath $path -Force
      } catch {
        $failures.Add("${path}: $($_.Exception.Message)")
      }
    }
    if (-not $configRestored -and $newCorruptPaths.Count -gt 0) {
      $failures.Add("original config recovery retained at $($newCorruptPaths -join ', ')")
    }
  } catch {
    $failures.Add("corrupt-config inventory: $($_.Exception.Message)")
  }
  try {
    if ($configRestored -and -not [bool]$Snapshot.DataRootExisted -and
        (Test-Path -LiteralPath $Snapshot.DataRoot -PathType Container)) {
      Assert-AuraInstallItemIsNotReparsePoint -Root $Snapshot.AuraRoot -Path $Snapshot.DataRoot
      if (@(Get-ChildItem -LiteralPath $Snapshot.DataRoot -Force).Count -eq 0) {
        Remove-Item -LiteralPath $Snapshot.DataRoot -Force
      }
    }
  } catch {
    $failures.Add("data directory: $($_.Exception.Message)")
  }
  if ($failures.Count -gt 0) {
    throw "Configuration rollback was incomplete: $($failures -join '; ')"
  }
}

function New-AuraShortcutInstallSnapshot {
  param(
    [Parameter(Mandatory = $true)][string]$Desktop,
    [Parameter(Mandatory = $true)][string]$Programs,
    [Parameter(Mandatory = $true)][string]$MenuRoot
  )
  $desktopFull = Get-AuraInstallFullPath -Path $Desktop
  $programsFull = Get-AuraInstallFullPath -Path $Programs
  $menuRootFull = Get-AuraInstallFullPath -Path $MenuRoot
  foreach ($knownFolder in @($desktopFull, $programsFull)) {
    if (-not (Test-Path -LiteralPath $knownFolder -PathType Container)) {
      throw "Required Windows shortcut folder is missing: $knownFolder"
    }
    Assert-AuraInstallItemIsNotReparsePoint -Root $knownFolder -Path $knownFolder
  }
  $menuRootExisted = Test-Path -LiteralPath $menuRootFull -PathType Container
  if ((Test-Path -LiteralPath $menuRootFull) -and -not $menuRootExisted) {
    throw "Claude Aura Start-menu path is not a directory: $menuRootFull"
  }
  Assert-AuraInstallItemIsNotReparsePoint -Root $programsFull -Path $menuRootFull

  $snapshots = [Collections.Generic.List[object]]::new()
  foreach ($name in @(
    'Claude Aura - Switch Theme.lnk',
    'Claude Aura - Restore.lnk',
    'Claude Aura.lnk',
    'Claude Aura Studio.lnk'
  )) {
    $snapshots.Add((New-AuraInstallFileSnapshot -ValidationRoot $desktopFull `
      -Path (Join-Path $desktopFull $name)))
  }
  foreach ($name in @(
    'Claude Aura - Switch Theme.lnk',
    'Claude Aura - Restore.lnk',
    'Claude Aura.lnk',
    'Claude Aura Studio.lnk',
    'Uninstall Claude Aura.lnk'
  )) {
    $snapshots.Add((New-AuraInstallFileSnapshot -ValidationRoot $programsFull `
      -Path (Join-Path $menuRootFull $name)))
  }
  return [PSCustomObject]@{
    Programs = $programsFull
    MenuRoot = $menuRootFull
    MenuRootExisted = $menuRootExisted
    Files = @($snapshots)
  }
}

function Restore-AuraShortcutInstallSnapshot {
  param([Parameter(Mandatory = $true)][object]$Snapshot)
  $failures = [Collections.Generic.List[string]]::new()
  foreach ($fileSnapshot in @($Snapshot.Files)) {
    try {
      Restore-AuraInstallFileSnapshot -Snapshot $fileSnapshot
    } catch {
      $failures.Add("$($fileSnapshot.Path): $($_.Exception.Message)")
    }
  }
  try {
    if (-not [bool]$Snapshot.MenuRootExisted -and
        (Test-Path -LiteralPath $Snapshot.MenuRoot -PathType Container)) {
      Assert-AuraInstallItemIsNotReparsePoint -Root $Snapshot.Programs -Path $Snapshot.MenuRoot
      if (@(Get-ChildItem -LiteralPath $Snapshot.MenuRoot -Force).Count -eq 0) {
        Remove-Item -LiteralPath $Snapshot.MenuRoot -Force
      }
    }
  } catch {
    $failures.Add("$($Snapshot.MenuRoot): $($_.Exception.Message)")
  }
  if ($failures.Count -gt 0) {
    throw "Shortcut rollback was incomplete: $($failures -join '; ')"
  }
}

$deferredLaunch = $false
$deferredLaunchPowerShell = $null
$deferredLaunchScript = $null
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
    'TROUBLESHOOTING.md',
    'WINDOWS_INSTALLER.md',
    'recipes/RECIPES.md'
  )

  # Refuse the live host before repository tests or package validation can
  # invoke any source-tree command, then stage only after validation has passed.
  if (Test-AuraUiHostRunning) {
    throw 'Claude Aura is running. Exit Aura from its window or tray, then run the installer again.'
  }
  $installedAppPath = Get-AuraInstallFullPath -Path (
    Join-Path $env:LOCALAPPDATA 'ClaudeAura\app')
  if (Test-AuraPathEqual -Left $SourceRoot -Right $installedAppPath) {
    throw 'Claude Aura cannot update itself in place. Run the installer from a freshly extracted release package.'
  }

  if (Test-Path -LiteralPath (Join-Path $SourceRoot '.git')) {
    & $node.Path (Join-Path $SourceRoot 'tests\run-tests.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Claude Aura checks failed; installation stopped.' }
  } else {
    foreach ($themeId in $canonicalThemeIds) {
      & $node.Path (Join-Path $SourceRoot 'scripts\theme-cli.mjs') validate --theme $themeId | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "Claude Aura package validation failed for $themeId; installation stopped." }
    }
  }

  $sourceFiles = @(Get-AuraInstallSourceFiles -SourceRoot $SourceRoot `
    -ThemeJsonNames $themeJsonNames -DocumentationNames $documentationNames)
  if ($sourceFiles.Count -eq 0) { throw 'Claude Aura release tree is empty.' }
  $safeWorkingDirectory = if (Test-Path -LiteralPath $env:LOCALAPPDATA -PathType Container) {
    $env:LOCALAPPDATA
  } elseif (Test-Path -LiteralPath $env:TEMP -PathType Container) {
    $env:TEMP
  } else {
    throw 'Claude Aura could not find a safe working directory for app-tree replacement.'
  }
  Set-Location -LiteralPath $safeWorkingDirectory

  $auraRootExpected = Join-Path $env:LOCALAPPDATA 'ClaudeAura'
  $auraRoot = Get-AuraInstallFullPath -Path $auraRootExpected
  if (-not (Test-AuraPathEqual -Left $auraRootExpected -Right $auraRoot)) {
    throw "Claude Aura root could not be resolved exactly: $auraRootExpected"
  }
  if (Test-Path -LiteralPath $auraRoot) {
    if (-not (Test-Path -LiteralPath $auraRoot -PathType Container)) {
      throw "Claude Aura root is not a directory: $auraRoot"
    }
    Assert-AuraInstallItemIsNotReparsePoint -Root $auraRoot -Path $auraRoot
  } else {
    New-Item -ItemType Directory -Path $auraRoot | Out-Null
    Assert-AuraInstallItemIsNotReparsePoint -Root $auraRoot -Path $auraRoot
  }

  $installRoot = Join-Path $auraRoot 'app'
  $dataRoot = Join-Path $auraRoot 'data'
  $transactionId = [Guid]::NewGuid().ToString('N')
  $stageRoot = Join-Path $auraRoot ".app-stage-$transactionId"
  $backupRoot = Join-Path $auraRoot ".app-backup-$transactionId"
  $rollbackRoot = Join-Path $auraRoot ".app-rollback-$transactionId"

  $hadPreviousApp = Test-Path -LiteralPath $installRoot -PathType Container
  if ((Test-Path -LiteralPath $installRoot) -and -not $hadPreviousApp) {
    throw "Claude Aura app path is not a directory: $installRoot"
  }
  if ($hadPreviousApp) {
    Assert-AuraInstallTreeHasNoReparsePoints -Root $installRoot
  }
  $dataRootExisted = Test-Path -LiteralPath $dataRoot -PathType Container
  if ((Test-Path -LiteralPath $dataRoot) -and -not $dataRootExisted) {
    throw "Claude Aura data path is not a directory: $dataRoot"
  }
  if ($dataRootExisted) {
    Assert-AuraInstallItemIsNotReparsePoint -Root $auraRoot -Path $dataRoot
  }
  $replacementActivated = $false
  $installSucceeded = $false
  $configInstallSnapshot = $null
  $shortcutInstallSnapshot = $null
  try {
    New-AuraInstallStage -AuraRoot $auraRoot -StageRoot $stageRoot -SourceFiles $sourceFiles
    if (Test-AuraUiHostRunning) {
      throw 'Claude Aura started while the update was staged. Exit Aura from its window or tray, then run the installer again.'
    }
    if ($hadPreviousApp) {
      Move-AuraManagedAppTree -AuraRoot $auraRoot -Source $installRoot -Destination $backupRoot
    }
    try {
      Move-AuraManagedAppTree -AuraRoot $auraRoot -Source $stageRoot -Destination $installRoot
      $replacementActivated = $true
    } catch {
      if ($hadPreviousApp -and -not (Test-Path -LiteralPath $installRoot) -and
          (Test-Path -LiteralPath $backupRoot -PathType Container)) {
        Move-AuraManagedAppTree -AuraRoot $auraRoot -Source $backupRoot -Destination $installRoot
      }
      throw
    }

    New-Item -ItemType Directory -Force -Path $dataRoot | Out-Null
    Assert-AuraInstallItemIsNotReparsePoint -Root $auraRoot -Path $dataRoot
    $configPath = Join-Path $dataRoot 'config.json'
    $configInstallSnapshot = New-AuraConfigInstallSnapshot -AuraRoot $auraRoot `
      -DataRoot $dataRoot -ConfigPath $configPath -DataRootExisted $dataRootExisted
    & $node.Path (Join-Path $installRoot 'scripts\theme-cli.mjs') init --config $configPath | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'The installed configuration could not be initialized.' }

  $powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
  $scriptPath = Join-Path $installRoot 'windows\aura-ui.ps1'
  $brandIconPath = Join-Path $installRoot 'assets\brand\claude-aura.ico'
  if (-not (Test-Path -LiteralPath $brandIconPath -PathType Leaf)) {
    throw "The Claude Aura icon is missing: $brandIconPath"
  }
  if (-not (Test-AuraInstalledWindowsIcon -Path $brandIconPath)) {
    throw "The Claude Aura icon is invalid: $brandIconPath"
  }
  $selectedBuiltInTheme = 'default'
  try {
    $installedConfig = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($installedConfig.enabled -is [bool] -and $installedConfig.enabled -and
        $installedConfig.theme -is [string] -and
        $canonicalThemeIds -ccontains $installedConfig.theme) {
      $selectedBuiltInTheme = [string]$installedConfig.theme
    }
  } catch {}
  $iconPath = Get-AuraInstalledThemeIconPath -InstallRoot $installRoot -ThemeId $selectedBuiltInTheme
  if (-not $iconPath -and $selectedBuiltInTheme -cne 'default') {
    $iconPath = Get-AuraInstalledThemeIconPath -InstallRoot $installRoot -ThemeId 'default'
  }
  if (-not $iconPath) { $iconPath = $brandIconPath }
  if (-not $NoShortcuts) {
    $desktop = [Environment]::GetFolderPath('Desktop')
    $programs = [Environment]::GetFolderPath('Programs')
    $menuRoot = Join-Path $programs 'Claude Aura'
    $shortcutInstallSnapshot = New-AuraShortcutInstallSnapshot -Desktop $desktop `
      -Programs $programs -MenuRoot $menuRoot
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
    $shortcutFolders = @($menuRoot)
    if (-not $NoDesktopShortcuts) {
      $shortcutFolders = @($desktop, $menuRoot)
    } else {
      foreach ($definition in $shortcutDefinitions) {
        $shortcutPath = Join-Path $desktop $definition.Name
        if (-not (Test-Path -LiteralPath $shortcutPath -PathType Leaf)) { continue }
        try {
          $existingShortcut = $shell.CreateShortcut($shortcutPath)
          $ownedTarget = [string]::Equals(
            [IO.Path]::GetFullPath([string]$existingShortcut.TargetPath),
            [IO.Path]::GetFullPath($powershell),
            [StringComparison]::OrdinalIgnoreCase)
          $ownedArguments = [string]::Equals(
            [string]$existingShortcut.Arguments,
            [string]$definition.Arguments,
            [StringComparison]::Ordinal)
          if ($ownedTarget -and $ownedArguments) {
            Remove-Item -LiteralPath $shortcutPath -Force
          }
        } catch {
          Write-Verbose "Could not validate optional Desktop shortcut $shortcutPath`: $($_.Exception.Message)"
        }
      }
    }
    foreach ($folder in $shortcutFolders) {
      foreach ($definition in $shortcutDefinitions) {
        $shortcutPath = Join-Path $folder $definition.Name
        $shortcut = $shell.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = $powershell
        $shortcut.Arguments = $definition.Arguments
        $shortcut.WorkingDirectory = $installRoot
        $shortcut.WindowStyle = 7
        $shortcut.IconLocation = "$iconPath,0"
        $shortcut.Description = $definition.Description
        $shortcut.Save()
        Set-AuraShortcutAppUserModelId -Path $shortcutPath
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

    $installSucceeded = $true
    if ($Launch) {
      $deferredLaunch = $true
      $deferredLaunchPowerShell = $powershell
      $deferredLaunchScript = $scriptPath
    }
    Write-Host "Claude Aura installed at $installRoot"
    Write-Host 'Open the Claude Aura shortcut; all appearance controls are inside the window.'
  } catch {
    $installationError = $_
    $rollbackFailures = [Collections.Generic.List[string]]::new()
    if ($replacementActivated) {
      try {
        Restore-AuraInstalledAppTree -AuraRoot $auraRoot -InstallRoot $installRoot `
          -BackupRoot $backupRoot -RollbackRoot $rollbackRoot -HadPreviousApp $hadPreviousApp
      } catch {
        $rollbackFailures.Add("app tree: $($_.Exception.Message)")
      }
    }
    if ($null -ne $configInstallSnapshot) {
      try {
        Restore-AuraConfigInstallSnapshot -Snapshot $configInstallSnapshot
      } catch {
        $rollbackFailures.Add("configuration: $($_.Exception.Message)")
      }
    }
    if ($null -ne $shortcutInstallSnapshot) {
      try {
        Restore-AuraShortcutInstallSnapshot -Snapshot $shortcutInstallSnapshot
      } catch {
        $rollbackFailures.Add("shortcuts: $($_.Exception.Message)")
      }
    }
    if ($rollbackFailures.Count -gt 0) {
      throw "Claude Aura installation failed ($($installationError.Exception.Message)); rollback also failed for $($rollbackFailures -join '; ')"
    }
    throw $installationError
  } finally {
    if (Test-Path -LiteralPath $stageRoot) {
      try {
        Remove-AuraManagedAppTree -AuraRoot $auraRoot -Path $stageRoot
      } catch {
        Write-Warning "Claude Aura could not remove its staging tree: $($_.Exception.Message)"
      }
    }
    if ($installSucceeded -and (Test-Path -LiteralPath $backupRoot)) {
      try {
        Remove-AuraManagedAppTree -AuraRoot $auraRoot -Path $backupRoot
      } catch {
        Write-Warning "Claude Aura was installed, but its prior app backup could not be removed: $($_.Exception.Message)"
      }
    }
  }
} finally {
  Exit-AuraOperationLock -Mutex $lock
}

if ($deferredLaunch) {
  $launchArguments = "-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$deferredLaunchScript`""
  try {
    Start-Process -FilePath $deferredLaunchPowerShell -ArgumentList $launchArguments -WindowStyle Hidden | Out-Null
  } catch {
    Write-Warning "Claude Aura was installed but could not be launched: $($_.Exception.Message)"
  }
}
