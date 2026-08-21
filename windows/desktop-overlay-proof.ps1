[CmdletBinding()]
param(
  [ValidatePattern('^[a-z][a-z0-9-]{1,39}$')]
  [string]$ThemeId,
  [ValidateSet('system', 'light', 'dark')]
  [string]$Appearance,
  [ValidateSet(
    'en', 'hi', 'es', 'fr', 'id', 'ja', 'ko', 'pt-BR', 'de', 'it',
    'vi', 'pl', 'tr', 'zh-CN', 'zh-HKTW')]
  [string]$Locale = 'en',
  [ValidateRange(10, 300)]
  [int]$DurationSeconds = 60,
  [switch]$RunUntilClaudeCloses,
  [switch]$FrameOnly,
  [switch]$DoNotLaunchClaude,
  [switch]$NoPersist,
  [switch]$CyclePermanentThemeMatrix,
  [switch]$OriginalLook,
  [switch]$NoShellTint,
  [switch]$NoArtwork,
  [switch]$NoIdentity,
  [switch]$NoStructureAccents,
  [switch]$NoColorFilter,
  [switch]$ConfirmUnsupportedDesktopExperiment
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')

$script:DesktopOverlayCandidateVersions = @('1.28929.0.0')

function Write-AuraDesktopOverlayResult {
  param([Parameter(Mandatory = $true)][hashtable]$Result)
  $Result | ConvertTo-Json -Depth 6 -Compress
}

function Get-AuraDesktopOverlayProcesses {
  param([Parameter(Mandatory = $true)][string]$ExecutablePath)
  $matches = @()
  foreach ($candidate in @(Get-CimInstance -ClassName Win32_Process `
      -Filter "Name = 'Claude.exe'" -Property ProcessId, ExecutablePath `
      -ErrorAction Stop)) {
    if ($candidate.ExecutablePath -and
        (Test-AuraPathEqual -Left "$($candidate.ExecutablePath)" -Right $ExecutablePath)) {
      $matches += [int]$candidate.ProcessId
    }
  }
  return @($matches | Sort-Object -Unique)
}

function ConvertTo-AuraDesktopOverlayArgument {
  param([AllowEmptyString()][string]$Value)
  if ($Value -notmatch '[\s"]') { return $Value }
  return '"' + ([regex]::Replace($Value, '(\\*)"', '$1$1\"') -replace '(\\+)$', '$1$1') + '"'
}

function Get-AuraDesktopOverlayThemes {
  param(
    [Parameter(Mandatory = $true)][string]$ProjectRoot,
    [Parameter(Mandatory = $true)][string]$UserThemesRoot
  )
  $node = Get-AuraNodeRuntime
  $themeCli = [IO.Path]::GetFullPath((Join-Path $ProjectRoot 'scripts\theme-cli.mjs'))
  if (-not (Test-Path -LiteralPath $themeCli -PathType Leaf)) {
    throw 'desktop-overlay-theme-registry-invalid'
  }
  if (Test-Path -LiteralPath $UserThemesRoot) {
    $userRootItem = Get-Item -LiteralPath $UserThemesRoot -Force -ErrorAction Stop
    if (-not $userRootItem.PSIsContainer -or
        ($userRootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'desktop-overlay-theme-registry-invalid'
    }
  }
  $arguments = @($themeCli, 'list', '--json', '--locale', 'en',
    '--user-themes', $UserThemesRoot)
  $start = [Diagnostics.ProcessStartInfo]::new()
  $start.FileName = $node.Path
  $start.Arguments = (($arguments | ForEach-Object {
        ConvertTo-AuraDesktopOverlayArgument -Value "$_"
      }) -join ' ')
  $start.UseShellExecute = $false
  $start.CreateNoWindow = $true
  $start.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  $start.StandardOutputEncoding = [Text.UTF8Encoding]::new($false)
  $start.StandardErrorEncoding = [Text.UTF8Encoding]::new($false)
  $process = [Diagnostics.Process]::new()
  try {
    $process.StartInfo = $start
    if (-not $process.Start()) { throw 'desktop-overlay-theme-registry-invalid' }
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    $stdout = $stdoutTask.GetAwaiter().GetResult()
    [void]$stderrTask.GetAwaiter().GetResult()
    if ($process.ExitCode -ne 0 -or $stdout.Length -gt 2097152) {
      throw 'desktop-overlay-theme-registry-invalid'
    }
    $parsed = $stdout | ConvertFrom-Json -ErrorAction Stop
    foreach ($theme in $parsed) { Write-Output $theme }
  } catch {
    if ($_.Exception.Message -ceq 'desktop-overlay-theme-registry-invalid') { throw }
    throw 'desktop-overlay-theme-registry-invalid'
  } finally {
    $process.Dispose()
  }
}

function Get-AuraDesktopOverlayArtworkPaths {
  param(
    [Parameter(Mandatory = $true)][string]$ProjectRoot,
    [Parameter(Mandatory = $true)][string[]]$FrozenThemeIds
  )
  try {
    $registryPath = [IO.Path]::GetFullPath(
      (Join-Path $ProjectRoot 'themes\registry.json'))
    $registryItem = Get-Item -LiteralPath $registryPath -Force -ErrorAction Stop
    if ($registryItem.PSIsContainer -or $registryItem.Length -gt 2097152 -or
        ($registryItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'desktop-overlay-artwork-registry-invalid'
    }
    $registry = Get-Content -LiteralPath $registryPath -Raw -Encoding UTF8 |
      ConvertFrom-Json -ErrorAction Stop
    $entries = @($registry.themes)
    if ([int]$registry.schemaVersion -ne 1 -or
        $entries.Count -ne $FrozenThemeIds.Count) {
      throw 'desktop-overlay-artwork-registry-invalid'
    }
    $assetRoot = [IO.Path]::GetFullPath(
      (Join-Path $ProjectRoot 'assets\theme-art'))
    $assetRootPrefix = $assetRoot.TrimEnd('\') + '\'
    $boundedNumber = {
      param($Value, [double]$Minimum, [double]$Maximum)
      try { $number = [double]$Value } catch {
        throw 'desktop-overlay-artwork-registry-invalid'
      }
      if ([double]::IsNaN($number) -or [double]::IsInfinity($number) -or
          $number -lt $Minimum -or $number -gt $Maximum) {
        throw 'desktop-overlay-artwork-registry-invalid'
      }
      return $number
    }
    $layerVisibleOnNewChat = {
      param($Layer)
      if ($null -eq $Layer -or
          -not $Layer.PSObject.Properties['contextOverrides']) {
        return $true
      }
      $overrides = $Layer.contextOverrides
      if ($null -eq $overrides -or
          -not $overrides.PSObject.Properties['new-chat']) {
        return $true
      }
      $newChat = $overrides.'new-chat'
      if ($null -eq $newChat -or -not $newChat.PSObject.Properties['hidden']) {
        return $true
      }
      if ($newChat.hidden -isnot [bool]) {
        throw 'desktop-overlay-artwork-registry-invalid'
      }
      return -not [bool]$newChat.hidden
    }
    $resolveAssetPath = {
      param($Layer)
      if ($null -eq $Layer) { return '' }
      $relative = "$($Layer.path)" -replace '/', '\'
      if ($relative -cnotmatch '^assets\\theme-art\\(?:japanese-film-editorial|korean-prestige|cartoon-studio|anime-twilight|study-library|kawaii-idol|korean-idol)\\[a-z0-9-]+\.webp$') {
        throw 'desktop-overlay-artwork-registry-invalid'
      }
      $absolute = [IO.Path]::GetFullPath((Join-Path $ProjectRoot $relative))
      if (-not $absolute.StartsWith(
          $assetRootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'desktop-overlay-artwork-registry-invalid'
      }
      if (-not (Test-Path -LiteralPath $absolute -PathType Leaf)) { return '' }
      $assetItem = Get-Item -LiteralPath $absolute -Force -ErrorAction Stop
      if (($assetItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'desktop-overlay-artwork-registry-invalid'
      }
      if ($assetItem.Length -le 0 -or $assetItem.Length -ge 409600) { return '' }
      return $absolute
    }
    $selectLayer = {
      param($Layers, [string]$Role, [string]$Appearance)
      $roleLayers = @($Layers | Where-Object {
          "$($_.role)" -ceq $Role -and (& $layerVisibleOnNewChat $_)
        })
      $exact = @($roleLayers | Where-Object {
          "$($_.appearance)" -ceq $Appearance
        })
      $neutral = @($roleLayers | Where-Object {
          -not $_.PSObject.Properties['appearance'] -or
          [string]::IsNullOrWhiteSpace("$($_.appearance)")
        })
      if ($exact.Count -gt 0) { return $exact[0] }
      if ($neutral.Count -gt 0) { return $neutral[0] }
      return $null
    }
    $positionCodes = @{
      'center' = 0
      'right center' = 1
      'right bottom' = 2
      'right top' = 3
      'left bottom' = 4
    }
    $invariant = [Globalization.CultureInfo]::InvariantCulture
    foreach ($id in $FrozenThemeIds) {
      $matching = @($entries | Where-Object { "$($_.id)" -ceq $id })
      if ($matching.Count -ne 1) {
        throw 'desktop-overlay-artwork-registry-invalid'
      }
      $themePath = [IO.Path]::GetFullPath(
        (Join-Path $ProjectRoot "themes\$id.json"))
      $themeItem = Get-Item -LiteralPath $themePath -Force -ErrorAction Stop
      if ($themeItem.PSIsContainer -or $themeItem.Length -gt 2097152 -or
          ($themeItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'desktop-overlay-artwork-registry-invalid'
      }
      $themeDescriptor = Get-Content -LiteralPath $themePath -Raw -Encoding UTF8 |
        ConvertFrom-Json -ErrorAction Stop
      if ("$($themeDescriptor.name)" -cne $id) {
        throw 'desktop-overlay-artwork-registry-invalid'
      }
      $composerRadius = & $boundedNumber $themeDescriptor.shape.composer 4 32
      $cardRadius = & $boundedNumber $themeDescriptor.shape.card 2 32
      $controlRadius = & $boundedNumber $themeDescriptor.shape.control 2 24
      $borderWidth = & $boundedNumber $themeDescriptor.shape.borderWidth 1 3
      foreach ($integerShape in @(
          $composerRadius, $cardRadius, $controlRadius, $borderWidth)) {
        if ($integerShape -ne [Math]::Floor($integerShape)) {
          throw 'desktop-overlay-artwork-registry-invalid'
        }
      }
      $layout = $matching[0].newChatLayout
      $promptWidth = & $boundedNumber $layout.widthRatio 0.45 0.85
      $promptOffsetX = & $boundedNumber $layout.offsetXRatio -0.2 0.2
      $promptOffsetY = & $boundedNumber $layout.offsetYRatio -0.2 0.2
      $resolved = @{}
      foreach ($appearance in @('light', 'dark')) {
        $layers = @($matching[0].artworkLayers)
        $background = & $selectLayer $layers 'background' $appearance
        $feature = & $selectLayer $layers 'hero' $appearance
        $featureRole = 1
        if ($null -eq $feature) {
          $feature = & $selectLayer $layers 'decoration' $appearance
          $featureRole = if ($null -eq $feature) { 0 } else { 2 }
        }
        $backgroundPath = & $resolveAssetPath $background
        $featurePath = & $resolveAssetPath $feature
        $backgroundPosition = if ($null -eq $background) { 'center' } else {
          "$($background.position)"
        }
        $featurePosition = if ($null -eq $feature) { 'center' } else {
          "$($feature.position)"
        }
        if (-not $positionCodes.ContainsKey($backgroundPosition) -or
            -not $positionCodes.ContainsKey($featurePosition)) {
          throw 'desktop-overlay-artwork-registry-invalid'
        }
        $backgroundOpacity = if ($null -eq $background) { 0.0 } else {
          & $boundedNumber $background.opacity 0 1
        }
        $featureOpacity = if ($null -eq $feature) { 0.0 } else {
          & $boundedNumber $feature.opacity 0 1
        }
        if ($null -ne $background -and
            ("$($background.size)" -cne 'cover' -or
              "$($background.mask)" -cne 'none')) {
          throw 'desktop-overlay-artwork-registry-invalid'
        }
        $featureMaskCodes = @{ 'none' = 0; 'soft-right' = 1 }
        $featureMask = if ($null -eq $feature) { 'none' } else {
          "$($feature.mask)"
        }
        if (-not $featureMaskCodes.ContainsKey($featureMask)) {
          throw 'desktop-overlay-artwork-registry-invalid'
        }
        $featureSizeMode = 0
        $featureSizeRatio = 0.0
        $featurePixelCap = 0.0
        if ($null -ne $feature) {
          $featureSize = "$($feature.size)"
          if ($featureSize -cmatch '^auto min\(([0-9]{1,3})%, ([0-9]{2,4})px\)$') {
            $featureSizeMode = 1
            $featureSizeRatio = & $boundedNumber (
              [double]$Matches[1] / 100.0) 0.18 0.96
            $featurePixelCap = & $boundedNumber $Matches[2] 120 1200
          } elseif ($featureSize -cmatch '^min\(([0-9]{1,3})vw, ([0-9]{2,4})px\) auto$') {
            $featureSizeMode = 2
            $featureSizeRatio = & $boundedNumber (
              [double]$Matches[1] / 100.0) 0.18 0.80
            $featurePixelCap = & $boundedNumber $Matches[2] 120 1200
          } else {
            throw 'desktop-overlay-artwork-registry-invalid'
          }
        }
        $decorationCodes = @{ 'none' = 0; 'glow' = 1; 'hairline' = 2 }
        $markCodes = @{ 'native' = 0; 'compact' = 1 }
        $alignCodes = @{ 'center' = 0; 'start' = 1 }
        $colorCodes = @{ 'primary' = 0; 'accent' = 1 }
        $fontCodes = @{
          'editorial-serif' = 0
          'humanist-sans' = 1
          'rounded-sans' = 2
          'system-sans' = 3
        }
        $resolveGreeting = {
          param($Greeting)
          $decoration = "$($Greeting.decoration)"
          $markSource = "$($Greeting.mark.source)"
          $alignment = "$($Greeting.align)"
          $colorRole = "$($Greeting.color)"
          $font = "$($Greeting.font)"
          if (-not $decorationCodes.ContainsKey($decoration) -or
              -not $markCodes.ContainsKey($markSource) -or
              -not $alignCodes.ContainsKey($alignment) -or
              -not $colorCodes.ContainsKey($colorRole) -or
              -not $fontCodes.ContainsKey($font)) {
            throw 'desktop-overlay-artwork-registry-invalid'
          }
          $weight = & $boundedNumber $Greeting.weight 100 900
          if ($weight -ne [Math]::Floor($weight) -or
              $Greeting.italic -isnot [bool]) {
            throw 'desktop-overlay-artwork-registry-invalid'
          }
          return @(
            [string]$decorationCodes[$decoration],
            [string]$markCodes[$markSource],
            [string]$alignCodes[$alignment],
            [string]$colorCodes[$colorRole],
            (& $boundedNumber $Greeting.maxWidthRatio 0.45 0.85).ToString(
              '0.####', $invariant),
            (& $boundedNumber $Greeting.xRatio -0.2 0.2).ToString(
              '0.####', $invariant),
            (& $boundedNumber $Greeting.yRatio -0.2 0.2).ToString(
              '0.####', $invariant),
            (& $boundedNumber $Greeting.fontSize 24 48).ToString(
              '0.####', $invariant),
            $weight.ToString('0', $invariant),
            $(if ([bool]$Greeting.italic) { '1' } else { '0' }),
            (& $boundedNumber $Greeting.letterSpacing -0.1 0.1).ToString(
              '0.####', $invariant),
            [string]$fontCodes[$font],
            (& $boundedNumber $Greeting.mark.scale 0.5 1.25).ToString(
              '0.####', $invariant)
          )
        }
        $standardGreeting = @(& $resolveGreeting (
            $matching[0].newChatGreetingStyle.$appearance.standard))
        $wideGreeting = @(& $resolveGreeting (
            $matching[0].newChatGreetingStyle.$appearance.wide))
        $parts = @(
          $backgroundPath,
          [string]$positionCodes[$backgroundPosition],
          $backgroundOpacity.ToString('0.####', $invariant),
          $featurePath,
          [string]$positionCodes[$featurePosition],
          $featureOpacity.ToString('0.####', $invariant),
          [string]$featureRole,
          [string]$featureMaskCodes[$featureMask],
          [string]$featureSizeMode,
          $featureSizeRatio.ToString('0.####', $invariant),
          $featurePixelCap.ToString('0.####', $invariant)
        )
        $parts += $standardGreeting
        $parts += @(
          $promptWidth.ToString('0.####', $invariant),
          $promptOffsetX.ToString('0.####', $invariant),
          $promptOffsetY.ToString('0.####', $invariant),
          $composerRadius.ToString('0', $invariant),
          $cardRadius.ToString('0', $invariant),
          $controlRadius.ToString('0', $invariant),
          $borderWidth.ToString('0', $invariant)
        )
        $parts += $wideGreeting
        $resolved[$appearance] = $parts -join '|'
      }
      [pscustomobject]@{
        id = $id
        light = $resolved.light
        dark = $resolved.dark
      }
    }
  } catch {
    if ($_.Exception.Message -ceq 'desktop-overlay-artwork-registry-invalid') { throw }
    throw 'desktop-overlay-artwork-registry-invalid'
  }
}

function Get-AuraDesktopCaptureFilterExecutable {
  param([Parameter(Mandatory = $true)][string]$ProjectRoot)
  try {
    $buildScript = [IO.Path]::GetFullPath(
      (Join-Path $PSScriptRoot 'build-desktop-capture-filter.ps1'))
    $scriptItem = Get-Item -LiteralPath $buildScript -Force -ErrorAction Stop
    if ($scriptItem.PSIsContainer -or $scriptItem.Length -le 0 -or
        $scriptItem.Length -gt 65536 -or
        ($scriptItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      return ''
    }
    $powerShellPath = [IO.Path]::GetFullPath((Join-Path $PSHOME 'powershell.exe'))
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $powerShellPath
    $start.Arguments = ((@(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $buildScript
      ) | ForEach-Object {
        ConvertTo-AuraDesktopOverlayArgument -Value "$_"
      }) -join ' ')
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.StandardOutputEncoding = [Text.UTF8Encoding]::new($false)
    $start.StandardErrorEncoding = [Text.UTF8Encoding]::new($false)
    $process = [Diagnostics.Process]::new()
    try {
      $process.StartInfo = $start
      if (-not $process.Start()) { return '' }
      $stdoutTask = $process.StandardOutput.ReadToEndAsync()
      $stderrTask = $process.StandardError.ReadToEndAsync()
      if (-not $process.WaitForExit(120000)) { return '' }
      $stdout = $stdoutTask.GetAwaiter().GetResult()
      [void]$stderrTask.GetAwaiter().GetResult()
      if ($process.ExitCode -ne 0 -or $stdout.Length -gt 32768) { return '' }
      $build = $stdout | ConvertFrom-Json -ErrorAction Stop
      if ("$($build.status)" -cne 'ok' -or
          "$($build.reasonCode)" -cne 'desktop-capture-build-complete' -or
          -not [bool]$build.sourceOnly -or
          "$($build.sourceHash)" -cnotmatch '^[A-F0-9]{64}$' -or
          "$($build.executableHash)" -cnotmatch '^[A-F0-9]{64}$') {
        return ''
      }
      $buildRoot = [IO.Path]::GetFullPath(
        (Join-Path $ProjectRoot 'dist\desktop-capture-filter')).TrimEnd('\') + '\'
      $executablePath = [IO.Path]::GetFullPath("$($build.executablePath)")
      if (-not $executablePath.StartsWith(
          $buildRoot, [StringComparison]::OrdinalIgnoreCase)) {
        return ''
      }
      $item = Get-Item -LiteralPath $executablePath -Force -ErrorAction Stop
      if ($item.PSIsContainer -or $item.Length -lt 65536 -or
          $item.Length -gt 2097152 -or
          ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
          (Get-FileHash -LiteralPath $executablePath -Algorithm SHA256).Hash `
            -cne "$($build.executableHash)") {
        return ''
      }
      return $executablePath
    } finally {
      $process.Dispose()
    }
  } catch {
    return ''
  }
}

function Add-AuraDesktopOverlayType {
  if ('ClaudeAuraDesktopExperiment.DesktopAccentOverlay' -as [type]) { return }
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  Add-Type -AssemblyName PresentationCore
  Add-Type -AssemblyName WindowsBase
  Add-Type -AssemblyName System.Xaml
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  Add-Type -ReferencedAssemblies @(
    'System.Windows.Forms', 'System.Drawing', 'PresentationCore', 'WindowsBase',
    'System.Xaml', 'UIAutomationClient', 'UIAutomationTypes'
  ) -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using Microsoft.Win32;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

namespace ClaudeAuraDesktopExperiment {
  public sealed class OverlayResult {
    public string ReasonCode { get; set; }
    public int PresentCount { get; set; }
    public int HiddenTransitions { get; set; }
    public int SurfaceBuildCount { get; set; }
    public int ThemeSwitchCount { get; set; }
    public int OriginalLookTransitions { get; set; }
    public int AppearanceSwitchCount { get; set; }
    public int ArtworkRenderCount { get; set; }
    public int ArtworkFailureCount { get; set; }
    public int BackgroundArtworkRenderCount { get; set; }
    public int FeatureArtworkRenderCount { get; set; }
    public int IdentityRenderCount { get; set; }
    public int IdentityFailureCount { get; set; }
    public int SidebarCompositionCount { get; set; }
    public int PromptCompositionCount { get; set; }
    public int GreetingCompositionCount { get; set; }
    public int StructureSnapshotCount { get; set; }
    public int StructureElementCount { get; set; }
    public int StructureAccentCount { get; set; }
    public int StructureFailureCount { get; set; }
    public int ColorFilterPresentCount { get; set; }
    public int ColorFilterFailureCount { get; set; }
    public bool ColorFilterInitialized { get; set; }
    public bool ColorFilterAvailable { get; set; }
    public bool GpuColorFilterAvailable { get; set; }
    public bool GpuColorFilterStarted { get; set; }
    public bool GpuColorFilterInitialized { get; set; }
    public bool GpuColorFilterEvidenceValid { get; set; }
    public bool GpuSurfacePaletteMapping { get; set; }
    public bool GpuSemanticPaletteMapping { get; set; }
    public bool GpuSurfaceAlphaMapping { get; set; }
    public bool GpuDarkNeutralRemap { get; set; }
    public bool GpuCoverageSafeAffineMapping { get; set; }
    public bool GpuNonlinearTextRemap { get; set; }
    public bool GpuNativeResolutionPreserved { get; set; }
    public int GpuCaptureWidth { get; set; }
    public int GpuCaptureHeight { get; set; }
    public int GpuSwapChainWidth { get; set; }
    public int GpuSwapChainHeight { get; set; }
    public int GpuOutputClientWidth { get; set; }
    public int GpuOutputClientHeight { get; set; }
    public int GpuColorFilterStartCount { get; set; }
    public int GpuColorFilterFailureCount { get; set; }
    public long GpuColorFilterFramesPresented { get; set; }
    public int ControlPresentCount { get; set; }
    public string SelectedThemeId { get; set; }
    public string SelectedAppearance { get; set; }
    public string EffectiveAppearance { get; set; }
    public string SourceEffectiveAppearance { get; set; }
    public bool OriginalLook { get; set; }
    public int PersistenceWriteCount { get; set; }
    public bool PersistenceFailed { get; set; }
    public int ExternalStateApplyCount { get; set; }
    public int ExternalStateFailureCount { get; set; }
    public bool StateReloadRequested { get; set; }
    public bool MatrixCycleCompleted { get; set; }
    public bool CleanupComplete { get; set; }
  }

  public static class DesktopWindowProbe {
    private const int GWL_EXSTYLE = -20;
    private const long WS_EX_TOOLWINDOW = 0x00000080L;
    private const uint DWMWA_CLOAKED = 14;
    private const uint GA_ROOT = 2;

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT {
      public int Left;
      public int Top;
      public int Right;
      public int Bottom;
    }

    private delegate bool EnumWindowsProc(IntPtr window, IntPtr parameter);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr parameter);
    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr window, out RECT rectangle);
    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("user32.dll")]
    private static extern IntPtr GetAncestor(IntPtr window, uint flags);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")]
    private static extern IntPtr GetWindowLongPtr64(IntPtr window, int index);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongW")]
    private static extern IntPtr GetWindowLong32(IntPtr window, int index);
    [DllImport("dwmapi.dll")]
    private static extern int DwmGetWindowAttribute(
      IntPtr window, uint attribute, out int value, int valueSize);
    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetProcessDpiAwarenessContext(IntPtr value);
    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetProcessDPIAware();

    private static IntPtr GetWindowLongPtr(IntPtr window, int index) {
      return IntPtr.Size == 8
        ? GetWindowLongPtr64(window, index)
        : GetWindowLong32(window, index);
    }

    private static bool IsCloaked(IntPtr window) {
      int value;
      return DwmGetWindowAttribute(window, DWMWA_CLOAKED, out value, sizeof(int)) == 0
        && value != 0;
    }

    public static void EnablePerMonitorDpiAwareness() {
      try {
        if (SetProcessDpiAwarenessContext(new IntPtr(-4))) return;
      } catch (EntryPointNotFoundException) {
      }
      SetProcessDPIAware();
    }

    public static IntPtr[] FindCandidateWindows(int[] processIds) {
      HashSet<uint> allowed = new HashSet<uint>();
      foreach (int processId in processIds) {
        if (processId > 0) allowed.Add((uint)processId);
      }
      List<IntPtr> windows = new List<IntPtr>();
      EnumWindows(delegate(IntPtr window, IntPtr parameter) {
        uint processId;
        GetWindowThreadProcessId(window, out processId);
        if (!allowed.Contains(processId) || !IsWindowVisible(window)
            || GetAncestor(window, GA_ROOT) != window || IsCloaked(window)
            || (GetWindowLongPtr(window, GWL_EXSTYLE).ToInt64() & WS_EX_TOOLWINDOW) != 0) {
          return true;
        }
        RECT rectangle;
        if (!GetWindowRect(window, out rectangle)
            || rectangle.Right - rectangle.Left < 480
            || rectangle.Bottom - rectangle.Top < 320) {
          return true;
        }
        windows.Add(window);
        return true;
      }, IntPtr.Zero);
      return windows.ToArray();
    }

    public static uint GetProcessId(IntPtr window) {
      uint processId;
      GetWindowThreadProcessId(window, out processId);
      return processId;
    }
  }

  internal sealed class DesktopWorkHubPanelController : IDisposable {
    private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    private const uint SWP_NOSIZE = 0x0001;
    private const uint SWP_NOMOVE = 0x0002;
    private const uint SWP_NOACTIVATE = 0x0010;
    private const uint SWP_SHOWWINDOW = 0x0040;

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetWindowPos(IntPtr handle, IntPtr insertAfter,
      int x, int y, int width, int height, uint flags);

    private readonly IntPtr target;
    private readonly uint targetProcessId;
    private readonly string scriptPath;
    private readonly string presentationStatePath;
    private readonly string locale;
    private readonly string closeEventName;
    private Process process;

    public DesktopWorkHubPanelController(IntPtr targetWindow, uint processId,
        string panelScriptPath, string statePath, string localeId) {
      target = targetWindow;
      targetProcessId = processId;
      scriptPath = panelScriptPath;
      presentationStatePath = statePath;
      locale = localeId;
      string sid = System.Security.Principal.WindowsIdentity.GetCurrent().User.Value;
      closeEventName = "Local\\ClaudeAura.WorkHubPanel." + sid + "." + processId;
      CleanupComplete = true;
    }

    public bool CleanupComplete { get; private set; }

    public bool IsRunning {
      get {
        RefreshProcess();
        return process != null;
      }
    }

    public void Toggle(string themeId, string appearance, bool originalLook) {
      if (IsRunning) {
        SignalClose();
        return;
      }
      string powershell = Path.Combine(Environment.SystemDirectory,
        @"WindowsPowerShell\v1.0\powershell.exe");
      if (!File.Exists(powershell) || !File.Exists(scriptPath)) return;
      string arguments = "-NoProfile -ExecutionPolicy Bypass -File " + Quote(scriptPath)
        + " -TargetWindow " + target.ToInt64().ToString(CultureInfo.InvariantCulture)
        + " -TargetProcessId " + targetProcessId.ToString(CultureInfo.InvariantCulture)
        + " -ThemeId " + Quote(themeId)
        + " -Appearance " + Quote(appearance)
        + " -Locale " + Quote(locale);
      if (originalLook) arguments += " -OriginalLook";
      if (!String.IsNullOrWhiteSpace(presentationStatePath)) {
        arguments += " -PresentationStatePath " + Quote(presentationStatePath);
      }
      ProcessStartInfo start = new ProcessStartInfo {
        FileName = powershell,
        Arguments = arguments,
        UseShellExecute = false,
        CreateNoWindow = true,
        WindowStyle = ProcessWindowStyle.Hidden
      };
      try {
        process = Process.Start(start);
      } catch {
        process = null;
      }
    }

    public void KeepAbovePresentation() {
      if (!IsRunning) return;
      try {
        process.Refresh();
        IntPtr handle = process.MainWindowHandle;
        if (handle != IntPtr.Zero) {
          SetWindowPos(handle, HWND_TOPMOST, 0, 0, 0, 0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW);
        }
      } catch { }
    }

    private void RefreshProcess() {
      if (process == null) return;
      try {
        if (!process.HasExited) return;
      } catch { }
      try { process.Dispose(); } catch { }
      process = null;
    }

    private void SignalClose() {
      try {
        using (System.Threading.EventWaitHandle signal =
            System.Threading.EventWaitHandle.OpenExisting(closeEventName)) {
          signal.Set();
        }
      } catch { }
    }

    public void Dispose() {
      if (IsRunning) {
        SignalClose();
        try {
          if (!process.WaitForExit(2500)) CleanupComplete = false;
        } catch {
          CleanupComplete = false;
        }
      }
      if (process != null) {
        try { process.Dispose(); } catch { }
        process = null;
      }
    }

    private static string Quote(string value) {
      return "\"" + value.Replace("\"", "\\\"") + "\"";
    }
  }

  internal sealed class ThemeRailForm : Form {
    private const int WS_EX_TOOLWINDOW = 0x00000080;
    private const int WS_EX_NOACTIVATE = 0x08000000;
    private const int WM_MOUSEACTIVATE = 0x0021;
    private const int MA_NOACTIVATE = 3;

    private readonly string[] themeIds;
    private readonly string[] themeLabels;
    private readonly Color[] accents;
    private readonly Color[] surfaces;
    private readonly Color[] surfaceHovers;
    private readonly Color[] borders;
    private readonly Color[] foregrounds;
    private readonly double[] launcherRadii;
    private readonly double[] launcherBorderWidths;
    private readonly string[] uiFontIds;
    private readonly string[] displayFontIds;
    private readonly Image[] marks;
    private readonly Action<int> selectTheme;
    private readonly Action<int> selectAppearance;
    private readonly Action selectOriginal;
    private readonly Action toggleWorkHub;
    private readonly Action closeSession;
    private readonly ToolTip tooltip;
    private int selectedIndex;
    private int selectedAppearanceIndex;
    private int hoverIndex = -1;
    private bool originalLook;
    private float scale = 1.0f;
    private readonly int columnCount;
    private int regionThemeIndex = -1;
    private float regionScale = -1.0f;

    public ThemeRailForm(string[] ids, string[] labels,
        Color[] accentColors, Color[] surfaceColors,
        Color[] surfaceHoverColors, Color[] borderColors, Color[] foregroundColors,
        double[] radiusValues, double[] borderWidthValues,
        string[] uiFonts, string[] displayFonts, string[] markPaths,
        int initialIndex, string initialAppearance, bool initialOriginalLook,
        Action<int> themeSelection, Action<int> appearanceSelection,
        Action originalSelection, Action workHubSelection, Action closeSelection) {
      themeIds = (string[])ids.Clone();
      themeLabels = (string[])labels.Clone();
      accents = (Color[])accentColors.Clone();
      surfaces = (Color[])surfaceColors.Clone();
      surfaceHovers = (Color[])surfaceHoverColors.Clone();
      borders = (Color[])borderColors.Clone();
      foregrounds = (Color[])foregroundColors.Clone();
      launcherRadii = (double[])radiusValues.Clone();
      launcherBorderWidths = (double[])borderWidthValues.Clone();
      uiFontIds = (string[])uiFonts.Clone();
      displayFontIds = (string[])displayFonts.Clone();
      marks = new Image[markPaths.Length];
      for (int index = 0; index < markPaths.Length; index++) {
        try {
          using (FileStream stream = File.OpenRead(markPaths[index]))
          using (Image source = Image.FromStream(stream)) {
            marks[index] = new Bitmap(source);
          }
        } catch {
          marks[index] = null;
        }
      }
      selectedIndex = initialIndex;
      selectedAppearanceIndex = AppearanceIndex(initialAppearance);
      originalLook = initialOriginalLook;
      selectTheme = themeSelection;
      selectAppearance = appearanceSelection;
      selectOriginal = originalSelection;
      toggleWorkHub = workHubSelection;
      closeSession = closeSelection;
      columnCount = themeIds.Length <= 8 ? 2 : themeIds.Length <= 18 ? 3 : 4;
      tooltip = new ToolTip();
      FormBorderStyle = FormBorderStyle.None;
      ShowInTaskbar = false;
      StartPosition = FormStartPosition.Manual;
      TopMost = true;
      DoubleBuffered = true;
      Cursor = Cursors.Hand;
      AccessibleName = "Claude Aura";
      AccessibleRole = AccessibleRole.Pane;
      Bounds = new Rectangle(0, 0, LogicalWidth(), LogicalHeight());
    }

    protected override bool ShowWithoutActivation { get { return true; } }

    protected override CreateParams CreateParams {
      get {
        CreateParams parameters = base.CreateParams;
        parameters.ExStyle |= WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE;
        return parameters;
      }
    }

    protected override void WndProc(ref Message message) {
      if (message.Msg == WM_MOUSEACTIVATE) {
        message.Result = new IntPtr(MA_NOACTIVATE);
        return;
      }
      base.WndProc(ref message);
    }

    public void SetSelection(int index, bool isOriginal) {
      selectedIndex = index;
      originalLook = isOriginal;
      regionThemeIndex = -1;
      UpdateThemeRegion();
      Invalidate();
    }

    public void SetAppearance(string appearance) {
      selectedAppearanceIndex = AppearanceIndex(appearance);
      Invalidate();
    }

    public bool PlaceAndShow(int targetLeft, int targetTop, int targetRight,
        int targetBottom, int dpi) {
      scale = Math.Max(1.0f, dpi / 96.0f);
      int railWidth = Math.Max(72, (int)Math.Round(LogicalWidth() * scale));
      int railHeight = Math.Max(192, (int)Math.Round(LogicalHeight() * scale));
      int gap = Math.Max(8, (int)Math.Round(12 * scale));
      Rectangle working = Screen.FromRectangle(new Rectangle(
        targetLeft, targetTop, Math.Max(1, targetRight - targetLeft),
        Math.Max(1, targetBottom - targetTop))).WorkingArea;
      int x;
      if (targetRight + gap + railWidth <= working.Right) {
        x = targetRight + gap;
      } else if (targetLeft - gap - railWidth >= working.Left) {
        x = targetLeft - gap - railWidth;
      } else {
        x = Math.Max(working.Left + gap, targetRight - railWidth - gap);
      }
      int desiredY = targetTop + Math.Max(gap, (int)Math.Round(72 * scale));
      int y = Math.Max(working.Top + gap,
        Math.Min(desiredY, working.Bottom - railHeight - gap));
      Rectangle next = new Rectangle(x, y, railWidth, railHeight);
      if (Bounds != next) Bounds = next;
      UpdateThemeRegion();
      bool transitioned = !Visible;
      if (!Visible) Show();
      BringToFront();
      return transitioned;
    }

    private int PaletteIndex() {
      return selectedIndex >= 0 && selectedIndex < themeIds.Length
        ? selectedIndex : 0;
    }

    private void UpdateThemeRegion() {
      int paletteIndex = PaletteIndex();
      if (ClientSize.Width <= 1 || ClientSize.Height <= 1
          || (regionThemeIndex == paletteIndex
            && Math.Abs(regionScale - scale) < 0.001f)) return;
      double logicalRadius = originalLook ? 18.0 : launcherRadii[paletteIndex];
      int radius = Math.Max(4, (int)Math.Round(logicalRadius * scale));
      using (GraphicsPath shape = RoundedRectangle(
          new Rectangle(0, 0, ClientSize.Width, ClientSize.Height), radius)) {
        Region previous = Region;
        Region = new Region(shape);
        if (previous != null) previous.Dispose();
      }
      regionThemeIndex = paletteIndex;
      regionScale = scale;
    }

    public void HideControl() {
      if (Visible) Hide();
    }

    protected override void OnPaint(PaintEventArgs eventArgs) {
      base.OnPaint(eventArgs);
      Graphics graphics = eventArgs.Graphics;
      graphics.SmoothingMode = SmoothingMode.AntiAlias;
      int paletteIndex = PaletteIndex();
      Color surface = originalLook ? Color.FromArgb(38, 39, 43) : surfaces[paletteIndex];
      Color surfaceHover = originalLook
        ? Color.FromArgb(54, 55, 61) : surfaceHovers[paletteIndex];
      Color foreground = originalLook ? Color.WhiteSmoke : foregrounds[paletteIndex];
      Color border = originalLook ? Color.FromArgb(104, 106, 112) : borders[paletteIndex];
      double logicalRadius = originalLook ? 18.0 : launcherRadii[paletteIndex];
      double borderWidth = originalLook ? 1.0 : launcherBorderWidths[paletteIndex];
      using (SolidBrush background = new SolidBrush(surface)) {
        graphics.FillRectangle(background, ClientRectangle);
      }
      int outlineInset = Math.Max(1, (int)Math.Ceiling(borderWidth * scale * 0.5f));
      Rectangle outlineBounds = Rectangle.Inflate(ClientRectangle,
        -outlineInset, -outlineInset);
      using (GraphicsPath outlinePath = RoundedRectangle(outlineBounds,
          Math.Max(3, (int)Math.Round(logicalRadius * scale) - outlineInset)))
      using (Pen outline = new Pen(Color.FromArgb(220, border),
          (float)Math.Max(1.0, borderWidth * scale))) {
        graphics.DrawPath(outline, outlinePath);
      }
      using (Font label = new Font(FontFamilyFor(displayFontIds[paletteIndex]),
          Math.Max(7.0f, 7.0f * scale), FontStyle.Bold, GraphicsUnit.Pixel))
      using (SolidBrush labelBrush = new SolidBrush(Color.FromArgb(210, foreground))) {
        StringFormat centered = new StringFormat();
        centered.Alignment = StringAlignment.Center;
        centered.LineAlignment = StringAlignment.Center;
        graphics.DrawString("AURA", label, labelBrush,
          new RectangleF(0, 5 * scale, ClientSize.Width, 19 * scale), centered);
        centered.Dispose();
      }
      Rectangle close = CloseBounds();
      if (hoverIndex == -3) {
        using (SolidBrush closeHover = new SolidBrush(Color.FromArgb(210, surfaceHover))) {
          graphics.FillEllipse(closeHover, close);
        }
      }
      int closeInset = Math.Max(4, (int)Math.Round(5 * scale));
      using (Pen closePen = new Pen(Color.FromArgb(205, foreground),
          Math.Max(1.0f, scale))) {
        graphics.DrawLine(closePen, close.Left + closeInset, close.Top + closeInset,
          close.Right - closeInset, close.Bottom - closeInset);
        graphics.DrawLine(closePen, close.Right - closeInset, close.Top + closeInset,
          close.Left + closeInset, close.Bottom - closeInset);
      }
      for (int index = 0; index < themeIds.Length; index++) {
        Rectangle chip = ChipBounds(index);
        bool active = !originalLook && selectedIndex == index;
        bool hovered = hoverIndex == index;
        int padding = Math.Max(2, (int)Math.Round(3 * scale));
        Rectangle imageBounds = Rectangle.Inflate(chip, -padding, -padding);
        int chipRadius = Math.Max(2, Math.Min(chip.Width / 2,
          (int)Math.Round(launcherRadii[index] * 0.45f * scale)));
        using (GraphicsPath chipPath = RoundedRectangle(chip, chipRadius)) {
          Color chipSurface = active || hovered ? surfaceHovers[index] : surfaces[index];
          using (SolidBrush fill = new SolidBrush(Color.FromArgb(
              active ? 242 : hovered ? 226 : 198, chipSurface))) {
            graphics.FillPath(fill, chipPath);
          }
          using (Pen ring = new Pen(Color.FromArgb(active ? 255 : 184,
              active ? accents[index] : borders[index]),
              (float)Math.Max(1.0, launcherBorderWidths[index] * scale))) {
            graphics.DrawPath(ring, chipPath);
          }
        }
        if (marks[index] != null) {
          graphics.DrawImage(marks[index], imageBounds);
        } else {
          using (SolidBrush fallback = new SolidBrush(accents[index])) {
            using (GraphicsPath fallbackPath = RoundedRectangle(imageBounds,
                Math.Max(2, chipRadius - padding))) {
              graphics.FillPath(fallback, fallbackPath);
            }
          }
        }
      }
      for (int index = 0; index < 3; index++) {
        Rectangle mode = AppearanceBounds(index);
        bool active = selectedAppearanceIndex == index;
        bool hovered = hoverIndex == -10 - index;
        int modeRadius = Math.Max(2, Math.Min(mode.Height / 2,
          (int)Math.Round(logicalRadius * 0.38f * scale)));
        using (GraphicsPath modePath = RoundedRectangle(mode, modeRadius))
        using (SolidBrush fill = new SolidBrush(active
            ? Color.FromArgb(102, accents[paletteIndex])
            : hovered ? Color.FromArgb(220, surfaceHover)
            : Color.FromArgb(24, foreground)))
        using (Pen modeBorder = new Pen(Color.FromArgb(
            active ? 238 : 132, active ? accents[paletteIndex] : border),
            (float)Math.Max(1.0, scale * (active ? borderWidth : 1.0)))) {
          graphics.FillPath(fill, modePath);
          graphics.DrawPath(modeBorder, modePath);
        }
        using (Font modeFont = new Font(FontFamilyFor(uiFontIds[paletteIndex]),
            Math.Max(8.0f, 8.0f * scale), FontStyle.Bold, GraphicsUnit.Pixel))
        using (SolidBrush modeText = new SolidBrush(foreground)) {
          StringFormat centered = new StringFormat();
          centered.Alignment = StringAlignment.Center;
          centered.LineAlignment = StringAlignment.Center;
          graphics.DrawString(index == 0 ? "S" : index == 1 ? "L" : "D",
            modeFont, modeText, mode, centered);
          centered.Dispose();
        }
      }
      Rectangle taskboard = TaskboardBounds();
      bool taskboardHovered = hoverIndex == -4;
      int taskboardRadius = Math.Max(3, (int)Math.Round(logicalRadius * 0.34f * scale));
      using (GraphicsPath taskboardPath = RoundedRectangle(taskboard, taskboardRadius))
      using (SolidBrush taskboardFill = new SolidBrush(taskboardHovered
          ? Color.FromArgb(220, surfaceHover) : Color.FromArgb(28, foreground)))
      using (Pen taskboardBorder = new Pen(Color.FromArgb(
          taskboardHovered ? 230 : 142, taskboardHovered ? accents[paletteIndex] : border),
          Math.Max(1.0f, scale))) {
        graphics.FillPath(taskboardFill, taskboardPath);
        graphics.DrawPath(taskboardBorder, taskboardPath);
      }
      int taskGap = Math.Max(2, (int)Math.Round(3 * scale));
      int taskCell = Math.Max(4, (int)Math.Round(5 * scale));
      int taskIconWidth = taskCell * 3 + taskGap * 2;
      int taskIconLeft = taskboard.Left + (taskboard.Width - taskIconWidth) / 2;
      int taskIconTop = taskboard.Top + (taskboard.Height - taskCell * 2 - taskGap) / 2;
      using (SolidBrush taskCellBrush = new SolidBrush(Color.FromArgb(210, foreground))) {
        for (int row = 0; row < 2; row++) {
          for (int column = 0; column < 3; column++) {
            graphics.FillRectangle(taskCellBrush,
              taskIconLeft + column * (taskCell + taskGap),
              taskIconTop + row * (taskCell + taskGap), taskCell, taskCell);
          }
        }
      }
      Rectangle original = OriginalBounds();
      bool originalActive = originalLook;
      bool originalHovered = hoverIndex == -2;
      if (originalActive || originalHovered) {
        using (SolidBrush halo = new SolidBrush(Color.FromArgb(
            originalActive ? 88 : 38, foreground))) {
          graphics.FillEllipse(halo, original);
        }
      }
      int originalInset = Math.Max(4, (int)Math.Round(6 * scale));
      Rectangle ringBounds = Rectangle.Inflate(original, -originalInset, -originalInset);
      using (Pen originalPen = new Pen(Color.FromArgb(
          originalActive ? 255 : 180, foreground),
          Math.Max(1.0f, (originalActive ? 2.0f : 1.0f) * scale))) {
        graphics.DrawEllipse(originalPen, ringBounds);
        graphics.DrawLine(originalPen, ringBounds.Left + 2, ringBounds.Bottom - 2,
          ringBounds.Right - 2, ringBounds.Top + 2);
      }
    }

    protected override void OnMouseMove(MouseEventArgs eventArgs) {
      base.OnMouseMove(eventArgs);
      int next = HitIndex(eventArgs.Location);
      if (next == hoverIndex) return;
      hoverIndex = next;
      string hint = "Claude Aura";
      if (next >= 0) hint = themeLabels[next];
      else if (next == -2) hint = "original-look";
      else if (next == -3) hint = "close-presentation";
      else if (next == -4) hint = "work-hub";
      else if (next <= -10 && next >= -12) {
        hint = next == -10 ? "system" : next == -11 ? "light" : "dark";
      }
      tooltip.SetToolTip(this, hint);
      Invalidate();
    }

    protected override void OnMouseLeave(EventArgs eventArgs) {
      base.OnMouseLeave(eventArgs);
      hoverIndex = -1;
      Invalidate();
    }

    protected override void OnMouseDown(MouseEventArgs eventArgs) {
      base.OnMouseDown(eventArgs);
      if (eventArgs.Button != MouseButtons.Left) return;
      int index = HitIndex(eventArgs.Location);
      if (index >= 0) selectTheme(index);
      else if (index == -2) selectOriginal();
      else if (index == -3) closeSession();
      else if (index == -4) toggleWorkHub();
      else if (index <= -10 && index >= -12) selectAppearance(-10 - index);
    }

    protected override void Dispose(bool disposing) {
      if (disposing) {
        tooltip.Dispose();
        foreach (Image mark in marks) {
          if (mark != null) mark.Dispose();
        }
      }
      base.Dispose(disposing);
    }

    private Rectangle ChipBounds(int index) {
      int chip = Math.Max(22, (int)Math.Round(24 * scale));
      int left = Math.Max(8, (int)Math.Round(9 * scale));
      int gap = Math.Max(7, (int)Math.Round(9 * scale));
      int top = Math.Max(28, (int)Math.Round(29 * scale));
      int rowGap = Math.Max(7, (int)Math.Round(8 * scale));
      int column = index % columnCount;
      int row = index / columnCount;
      return new Rectangle(left + column * (chip + gap),
        top + row * (chip + rowGap), chip, chip);
    }

    private Rectangle AppearanceBounds(int index) {
      int gap = Math.Max(3, (int)Math.Round(4 * scale));
      int side = Math.Max(6, (int)Math.Round(8 * scale));
      int width = Math.Max(12, (ClientSize.Width - side * 2 - gap * 2) / 3);
      int height = Math.Max(16, (int)Math.Round(20 * scale));
      int top = Math.Max(0, (int)Math.Round(ThemeChipsBottom() * scale + 8 * scale));
      return new Rectangle(side + index * (width + gap), top, width, height);
    }

    private Rectangle OriginalBounds() {
      int chip = Math.Max(24, (int)Math.Round(27 * scale));
      return new Rectangle((ClientSize.Width - chip) / 2,
        ClientSize.Height - chip - Math.Max(6, (int)Math.Round(8 * scale)),
        chip, chip);
    }

    private Rectangle TaskboardBounds() {
      int side = Math.Max(6, (int)Math.Round(8 * scale));
      int top = AppearanceBounds(0).Bottom + Math.Max(5, (int)Math.Round(7 * scale));
      int height = Math.Max(22, (int)Math.Round(26 * scale));
      return new Rectangle(side, top, ClientSize.Width - side * 2, height);
    }

    private Rectangle CloseBounds() {
      int size = Math.Max(14, (int)Math.Round(17 * scale));
      int inset = Math.Max(3, (int)Math.Round(4 * scale));
      return new Rectangle(ClientSize.Width - size - inset, inset, size, size);
    }

    private int HitIndex(Point point) {
      if (CloseBounds().Contains(point)) return -3;
      for (int index = 0; index < themeIds.Length; index++) {
        if (ChipBounds(index).Contains(point)) return index;
      }
      for (int index = 0; index < 3; index++) {
        if (AppearanceBounds(index).Contains(point)) return -10 - index;
      }
      if (TaskboardBounds().Contains(point)) return -4;
      return OriginalBounds().Contains(point) ? -2 : -1;
    }

    private int LogicalWidth() {
      return 18 + columnCount * 24 + Math.Max(0, columnCount - 1) * 9;
    }

    private int LogicalHeight() {
      return ThemeChipsBottom() + 8 + 20 + 7 + 26 + 8 + 27 + 8;
    }

    private int ThemeChipsBottom() {
      int rows = Math.Max(1, (themeIds.Length + columnCount - 1) / columnCount);
      return 29 + rows * 24 + Math.Max(0, rows - 1) * 8;
    }

    private static int AppearanceIndex(string appearance) {
      return appearance == "light" ? 1 : appearance == "dark" ? 2 : 0;
    }

    private static string FontFamilyFor(string fontId) {
      if (fontId == "editorial-serif") return "Georgia";
      if (fontId == "rounded-sans") return "Trebuchet MS";
      if (fontId == "humanist-sans") return "Segoe UI";
      return "Segoe UI Variable Text";
    }

    private static GraphicsPath RoundedRectangle(Rectangle bounds, int radius) {
      int diameter = Math.Max(2, radius * 2);
      GraphicsPath path = new GraphicsPath();
      path.AddArc(bounds.Left, bounds.Top, diameter, diameter, 180, 90);
      path.AddArc(bounds.Right - diameter, bounds.Top, diameter, diameter, 270, 90);
      path.AddArc(bounds.Right - diameter, bounds.Bottom - diameter,
        diameter, diameter, 0, 90);
      path.AddArc(bounds.Left, bounds.Bottom - diameter, diameter, diameter, 90, 90);
      path.CloseFigure();
      return path;
    }
  }

  internal sealed class GpuCaptureColorFilterController : IDisposable {
    private readonly string executablePath;
    private readonly IntPtr target;
    private Process process;
    private System.Threading.EventWaitHandle stopEvent;
    private System.Threading.EventWaitHandle readyEvent;
    private string activeKey = String.Empty;
    private bool disposed;
    private bool processStarted;
    private bool evidenceFinalized;

    public bool Available { get; private set; }
    public bool Started { get; private set; }
    public bool Initialized { get; private set; }
    public bool EvidenceValid { get; private set; }
    public bool SurfacePaletteMapping { get; private set; }
    public bool SemanticPaletteMapping { get; private set; }
    public bool SurfaceAlphaMapping { get; private set; }
    public bool DarkNeutralRemapApplied { get; private set; }
    public bool CoverageSafeAffineMapping { get; private set; }
    public bool NonlinearTextRemap { get; private set; }
    public bool NativeResolutionPreserved { get; private set; }
    public int CaptureWidth { get; private set; }
    public int CaptureHeight { get; private set; }
    public int SwapChainWidth { get; private set; }
    public int SwapChainHeight { get; private set; }
    public int OutputClientWidth { get; private set; }
    public int OutputClientHeight { get; private set; }
    public bool CleanupComplete { get; private set; }
    public int StartCount { get; private set; }
    public int FailureCount { get; private set; }
    public long FramesPresented { get; private set; }

    public GpuCaptureColorFilterController(
        string helperExecutable, IntPtr targetWindow, bool requested) {
      executablePath = helperExecutable ?? String.Empty;
      target = targetWindow;
      CleanupComplete = true;
      try {
        if (!requested || SystemInformation.HighContrast || target == IntPtr.Zero
            || String.IsNullOrWhiteSpace(executablePath)
            || !File.Exists(executablePath)) return;
        FileInfo item = new FileInfo(executablePath);
        Available = item.Length >= 65536 && item.Length <= 2097152
          && (item.Attributes & FileAttributes.ReparsePoint) == 0;
      } catch {
        Available = false;
      }
    }

    private static string Hex(Color color) {
      return "#" + color.R.ToString("X2", CultureInfo.InvariantCulture)
        + color.G.ToString("X2", CultureInfo.InvariantCulture)
        + color.B.ToString("X2", CultureInfo.InvariantCulture);
    }

    private static string QuotePath(string value) {
      if (String.IsNullOrWhiteSpace(value) || value.IndexOf('"') >= 0) {
        throw new ArgumentException("Invalid artwork path.");
      }
      return "\"" + value + "\"";
    }

    private bool ProcessIsActive() {
      if (process == null) return false;
      try { return !process.HasExited; } catch { return false; }
    }

    private static int ReadUnsignedEvidence(string stdout, string name) {
      System.Text.RegularExpressions.Match match =
        System.Text.RegularExpressions.Regex.Match(stdout,
          "\"" + System.Text.RegularExpressions.Regex.Escape(name)
            + "\":(?<value>[0-9]+)");
      int value = 0;
      return match.Success && Int32.TryParse(match.Groups["value"].Value,
        NumberStyles.None, CultureInfo.InvariantCulture, out value) ? value : 0;
    }

    private bool FinalizeActiveProcess() {
      if (process == null) return true;
      bool clean = false;
      bool transformed = false;
      bool stoppedBeforeFrame = false;
      bool paletteMapped = false;
      bool semanticPaletteMapped = false;
      bool surfaceAlphaMapped = false;
      bool sourceAppearanceSampled = false;
      bool darkNeutralRemapped = false;
      bool coverageSafeAffineMapped = false;
      bool nonlinearTextRemapped = true;
      bool nativeResolutionPreserved = false;
      try {
        if (!process.HasExited) return false;
        string stdout = process.StandardOutput.ReadToEnd();
        string stderr = process.StandardError.ReadToEnd();
        process.WaitForExit();
        System.Text.RegularExpressions.Match frameMatch =
          System.Text.RegularExpressions.Regex.Match(
            stdout, "\"framesPresented\":(?<count>[0-9]+)");
        long frames = 0;
        if (frameMatch.Success && Int64.TryParse(frameMatch.Groups["count"].Value,
            NumberStyles.None, CultureInfo.InvariantCulture, out frames)) {
          FramesPresented += frames;
        }
        CaptureWidth = ReadUnsignedEvidence(stdout, "captureWidth");
        CaptureHeight = ReadUnsignedEvidence(stdout, "captureHeight");
        SwapChainWidth = ReadUnsignedEvidence(stdout, "swapChainWidth");
        SwapChainHeight = ReadUnsignedEvidence(stdout, "swapChainHeight");
        OutputClientWidth = ReadUnsignedEvidence(stdout, "outputClientWidth");
        OutputClientHeight = ReadUnsignedEvidence(stdout, "outputClientHeight");
        clean = process.ExitCode == 0 && String.IsNullOrWhiteSpace(stderr)
          && stdout.IndexOf("\"schemaVersion\":6", StringComparison.Ordinal) >= 0
          && stdout.IndexOf("\"pixelReadback\":false", StringComparison.Ordinal) >= 0
          && stdout.IndexOf("\"cpuFrameAccess\":false", StringComparison.Ordinal) >= 0
          && stdout.IndexOf("\"screenshotWritten\":false", StringComparison.Ordinal) >= 0
          && stdout.IndexOf("\"inputTransparent\":true", StringComparison.Ordinal) >= 0
          && stdout.IndexOf("\"inputIntercepted\":false", StringComparison.Ordinal) >= 0
          && stdout.IndexOf("\"cleanupComplete\":true", StringComparison.Ordinal) >= 0;
        paletteMapped = clean
          && stdout.IndexOf("\"surfacePaletteMapping\":true", StringComparison.Ordinal) >= 0
          && stdout.IndexOf("\"surfacePaletteSize\":13", StringComparison.Ordinal) >= 0;
        sourceAppearanceSampled = paletteMapped
          && stdout.IndexOf("\"sourceAppearanceSampling\":true", StringComparison.Ordinal) >= 0;
        semanticPaletteMapped = sourceAppearanceSampled
          && stdout.IndexOf("\"semanticPaletteMapping\":true", StringComparison.Ordinal) >= 0
          && stdout.IndexOf("\"semanticPaletteSize\":13", StringComparison.Ordinal) >= 0;
        surfaceAlphaMapped = semanticPaletteMapped
          && stdout.IndexOf("\"surfaceAlphaMapping\":true", StringComparison.Ordinal) >= 0;
        darkNeutralRemapped = semanticPaletteMapped
          && stdout.IndexOf("\"darkNeutralRemap\":true", StringComparison.Ordinal) >= 0;
        coverageSafeAffineMapped = semanticPaletteMapped
          && stdout.IndexOf("\"coverageSafeAffineMapping\":true",
            StringComparison.Ordinal) >= 0;
        nonlinearTextRemapped = stdout.IndexOf("\"nonlinearTextRemap\":true",
          StringComparison.Ordinal) >= 0;
        nativeResolutionPreserved = clean
          && stdout.IndexOf("\"dpiAwarenessPerMonitorV2\":true",
            StringComparison.Ordinal) >= 0
          && stdout.IndexOf("\"nativeResolutionPreserved\":true",
            StringComparison.Ordinal) >= 0
          && CaptureWidth > 0 && CaptureHeight > 0
          && CaptureWidth == SwapChainWidth && CaptureHeight == SwapChainHeight
          && CaptureWidth == OutputClientWidth && CaptureHeight == OutputClientHeight;
        transformed = semanticPaletteMapped && surfaceAlphaMapped
          && coverageSafeAffineMapped && !nonlinearTextRemapped
          && nativeResolutionPreserved && frames > 0
          && stdout.IndexOf("\"status\":\"ok\"", StringComparison.Ordinal) >= 0
          && stdout.IndexOf("\"readySignaled\":true", StringComparison.Ordinal) >= 0
          && stdout.IndexOf("\"exactHwndIsolation\":true", StringComparison.Ordinal) >= 0
          && stdout.IndexOf("\"gpuPixelTransform\":true", StringComparison.Ordinal) >= 0;
        stoppedBeforeFrame = clean && frames == 0
          && stdout.IndexOf("\"status\":\"stopped\"", StringComparison.Ordinal) >= 0
          && stdout.IndexOf("\"reasonCode\":\"desktop-capture-filter-stopped-before-frame\"",
            StringComparison.Ordinal) >= 0
          && stdout.IndexOf("\"readySignaled\":true", StringComparison.Ordinal) >= 0
          && stdout.IndexOf("\"stopRequested\":true", StringComparison.Ordinal) >= 0;
      } catch {
        clean = false;
        transformed = false;
        stoppedBeforeFrame = false;
      } finally {
        try { process.Dispose(); } catch { }
        process = null;
        processStarted = false;
        if (stopEvent != null) {
          try { stopEvent.Dispose(); } catch { }
          stopEvent = null;
        }
        if (readyEvent != null) {
          try { readyEvent.Dispose(); } catch { }
          readyEvent = null;
        }
        activeKey = String.Empty;
      }
      if (transformed) {
        EvidenceValid = evidenceFinalized ? EvidenceValid : true;
        SurfacePaletteMapping = true;
        SemanticPaletteMapping = semanticPaletteMapped;
        SurfaceAlphaMapping = surfaceAlphaMapped;
        DarkNeutralRemapApplied = DarkNeutralRemapApplied || darkNeutralRemapped;
        CoverageSafeAffineMapping = coverageSafeAffineMapped;
        NonlinearTextRemap = nonlinearTextRemapped;
        NativeResolutionPreserved = true;
        evidenceFinalized = true;
      } else if (!stoppedBeforeFrame) {
        EvidenceValid = false;
        NativeResolutionPreserved = false;
        evidenceFinalized = true;
      }
      CleanupComplete = CleanupComplete && clean;
      bool lifecycleValid = transformed || stoppedBeforeFrame;
      if (!lifecycleValid) FailureCount += 1;
      return lifecycleValid;
    }

    private bool StopActiveProcess() {
      if (process == null) {
        processStarted = false;
        if (stopEvent != null) {
          try { stopEvent.Dispose(); } catch { }
          stopEvent = null;
        }
        if (readyEvent != null) {
          try { readyEvent.Dispose(); } catch { }
          readyEvent = null;
        }
        activeKey = String.Empty;
        return true;
      }
      if (!processStarted) {
        try { process.Dispose(); } catch { }
        process = null;
        processStarted = false;
        if (stopEvent != null) {
          try { stopEvent.Dispose(); } catch { }
          stopEvent = null;
        }
        if (readyEvent != null) {
          try { readyEvent.Dispose(); } catch { }
          readyEvent = null;
        }
        activeKey = String.Empty;
        return true;
      }
      try {
        if (!process.HasExited) {
          if (stopEvent == null || !stopEvent.Set() || !process.WaitForExit(4000)) {
            FailureCount += 1;
            CleanupComplete = false;
            return false;
          }
        }
      } catch {
        FailureCount += 1;
        CleanupComplete = false;
        return false;
      }
      return FinalizeActiveProcess();
    }

    public bool Apply(Color accent, Color focus, Color accentText, Color border,
        Color sidebar, Color sidebarText, Color sidebarTextMuted,
        Color text, Color textSecondary, Color textMuted,
        Color surface, Color raised, Color canvas,
        double surfaceAlpha, double sidebarAlpha, bool dark, bool sourceDark,
        ThemeComposition composition, bool applyArtwork, bool landingLayout,
        double sidebarRatio, double titleRatio, Rectangle greetingBounds,
        Rectangle greetingDestinationBounds, int targetWidth, int targetHeight,
        int targetDpi, bool wideGreeting) {
      if (!Available || disposed) return false;
      bool greetingActive = composition != null && !greetingBounds.IsEmpty
        && !greetingDestinationBounds.IsEmpty
        && targetWidth > 0 && targetHeight > 0;
      string backgroundPath = applyArtwork && composition != null
        ? composition.BackgroundPath : String.Empty;
      string featurePath = applyArtwork && (landingLayout || greetingActive)
          && composition != null
        ? composition.FeaturePath : String.Empty;
      double featureOpacity = composition == null ? 0.0
        : composition.FeatureOpacity * (landingLayout ? 1.0 : 0.34);
      double greetingX = greetingActive
        ? greetingBounds.X / (double)targetWidth : 0.0;
      double greetingY = greetingActive
        ? greetingBounds.Y / (double)targetHeight : 0.0;
      double greetingWidth = greetingActive
        ? greetingBounds.Width / (double)targetWidth : 0.0;
      double greetingHeight = greetingActive
        ? greetingBounds.Height / (double)targetHeight : 0.0;
      double greetingDestinationX = greetingActive
        ? greetingDestinationBounds.X / (double)targetWidth : 0.0;
      double greetingDestinationY = greetingActive
        ? greetingDestinationBounds.Y / (double)targetHeight : 0.0;
      double greetingDestinationWidth = greetingActive
        ? greetingDestinationBounds.Width / (double)targetWidth : 0.0;
      double greetingDestinationHeight = greetingActive
        ? greetingDestinationBounds.Height / (double)targetHeight : 0.0;
      double featureMaximumWidth = composition == null ? 0.48
        : composition.ResolvedFeatureMaximumWidthRatio(targetWidth,
            targetHeight, targetDpi, sidebarRatio, titleRatio);
      double featureMaximumHeight = composition == null ? 0.84
        : composition.ResolvedFeatureMaximumHeightRatio(targetWidth,
            targetHeight, targetDpi, sidebarRatio, titleRatio);
      string key = String.Join(":", new string[] {
        Hex(accent), Hex(focus), Hex(accentText), Hex(border), Hex(sidebar),
        Hex(sidebarText), Hex(sidebarTextMuted), Hex(text), Hex(textSecondary),
        Hex(textMuted), Hex(surface), Hex(raised), Hex(canvas),
        surfaceAlpha.ToString("0.###", CultureInfo.InvariantCulture),
        sidebarAlpha.ToString("0.###", CultureInfo.InvariantCulture),
        dark ? "dark" : "light", sourceDark ? "source-dark" : "source-light",
        backgroundPath, featurePath,
        composition == null ? "none" : composition.BackgroundOpacity.ToString(
          "0.###", CultureInfo.InvariantCulture),
        composition == null ? "none" : featureOpacity.ToString(
          "0.###", CultureInfo.InvariantCulture),
        landingLayout ? "landing" : "content",
        sidebarRatio.ToString("0.####", CultureInfo.InvariantCulture),
        titleRatio.ToString("0.####", CultureInfo.InvariantCulture),
        greetingX.ToString("0.####", CultureInfo.InvariantCulture),
        greetingY.ToString("0.####", CultureInfo.InvariantCulture),
        greetingWidth.ToString("0.####", CultureInfo.InvariantCulture),
        greetingHeight.ToString("0.####", CultureInfo.InvariantCulture),
        greetingDestinationX.ToString("0.####", CultureInfo.InvariantCulture),
        greetingDestinationY.ToString("0.####", CultureInfo.InvariantCulture),
        greetingDestinationWidth.ToString("0.####", CultureInfo.InvariantCulture),
        greetingDestinationHeight.ToString("0.####", CultureInfo.InvariantCulture),
        wideGreeting ? "wide" : "standard"
      });
      if (activeKey == key && ProcessIsActive()) return true;
      if (process != null && !StopActiveProcess()) return false;
      string eventSuffix = Guid.NewGuid().ToString("N").ToUpperInvariant();
      string eventName = "Local\\ClaudeAuraDesktopGpu-" + eventSuffix;
      string readyEventName = "Local\\ClaudeAuraDesktopGpuReady-" + eventSuffix;
      bool stopCreatedNew;
      bool readyCreatedNew;
      try {
        stopEvent = new System.Threading.EventWaitHandle(false,
          System.Threading.EventResetMode.ManualReset, eventName, out stopCreatedNew);
        readyEvent = new System.Threading.EventWaitHandle(false,
          System.Threading.EventResetMode.ManualReset, readyEventName, out readyCreatedNew);
        if (!stopCreatedNew || !readyCreatedNew) throw new InvalidOperationException();
        ProcessStartInfo start = new ProcessStartInfo();
        start.FileName = executablePath;
        string artworkArguments = String.Empty;
        if (!String.IsNullOrWhiteSpace(backgroundPath)) {
          artworkArguments += " --background-art " + QuotePath(backgroundPath)
            + " --background-opacity "
            + composition.BackgroundOpacity.ToString("0.####", CultureInfo.InvariantCulture)
            + " --background-position "
            + composition.BackgroundPosition.ToString(CultureInfo.InvariantCulture);
        }
        if (!String.IsNullOrWhiteSpace(featurePath)) {
          artworkArguments += " --feature-art " + QuotePath(featurePath)
            + " --feature-opacity "
            + featureOpacity.ToString("0.####", CultureInfo.InvariantCulture)
            + " --feature-position "
            + composition.FeaturePosition.ToString(CultureInfo.InvariantCulture)
            + " --feature-role "
            + composition.FeatureRole.ToString(CultureInfo.InvariantCulture)
            + " --feature-mask "
            + composition.FeatureMask.ToString(CultureInfo.InvariantCulture)
            + " --feature-max-width "
            + featureMaximumWidth.ToString("0.####", CultureInfo.InvariantCulture)
            + " --feature-max-height "
            + featureMaximumHeight.ToString("0.####", CultureInfo.InvariantCulture);
        }
        string greetingArguments = String.Empty;
        if (greetingActive) {
          greetingArguments = " --greeting --greeting-x "
            + greetingX.ToString("0.####", CultureInfo.InvariantCulture)
            + " --greeting-y "
            + greetingY.ToString("0.####", CultureInfo.InvariantCulture)
            + " --greeting-width "
            + greetingWidth.ToString("0.####", CultureInfo.InvariantCulture)
            + " --greeting-height "
            + greetingHeight.ToString("0.####", CultureInfo.InvariantCulture)
            + " --greeting-destination-x "
            + greetingDestinationX.ToString("0.####", CultureInfo.InvariantCulture)
            + " --greeting-destination-y "
            + greetingDestinationY.ToString("0.####", CultureInfo.InvariantCulture)
            + " --greeting-destination-width "
            + greetingDestinationWidth.ToString("0.####", CultureInfo.InvariantCulture)
            + " --greeting-destination-height "
            + greetingDestinationHeight.ToString("0.####", CultureInfo.InvariantCulture)
            + " --greeting-weight "
            + composition.ResolvedGreetingWeight(wideGreeting).ToString(
              CultureInfo.InvariantCulture)
            + " --greeting-font "
            + composition.ResolvedGreetingFontCategory(wideGreeting).ToString(
              CultureInfo.InvariantCulture)
            + " --greeting-mark-scale "
            + composition.ResolvedGreetingMarkScale(wideGreeting).ToString(
              "0.####", CultureInfo.InvariantCulture)
            + (composition.ResolvedGreetingItalic(wideGreeting)
              ? " --greeting-italic" : String.Empty)
            + (composition.ResolvedGreetingMarkSource(wideGreeting) == 1
              ? " --greeting-compact-mark" : String.Empty)
            + (composition.ResolvedGreetingColorRole(wideGreeting) == 1
              ? " --greeting-accent" : String.Empty);
        }
        start.Arguments = "--target-hwnd "
          + target.ToInt64().ToString(CultureInfo.InvariantCulture)
          + " --duration-ms 0 --accent " + Hex(accent)
          + " --focus " + Hex(focus)
          + " --accent-text " + Hex(accentText)
          + " --border " + Hex(border)
          + " --sidebar " + Hex(sidebar)
          + " --sidebar-text " + Hex(sidebarText)
          + " --sidebar-text-muted " + Hex(sidebarTextMuted)
          + " --text " + Hex(text)
          + " --text-secondary " + Hex(textSecondary)
          + " --text-muted " + Hex(textMuted)
          + " --surface " + Hex(surface)
          + " --raised " + Hex(raised)
          + " --canvas " + Hex(canvas)
          + " --surface-alpha "
          + surfaceAlpha.ToString("0.###", CultureInfo.InvariantCulture)
          + " --sidebar-alpha "
          + sidebarAlpha.ToString("0.###", CultureInfo.InvariantCulture)
          + " --sidebar-ratio "
          + sidebarRatio.ToString("0.####", CultureInfo.InvariantCulture)
          + " --title-ratio "
          + titleRatio.ToString("0.####", CultureInfo.InvariantCulture)
          + " --strength 0.24 --stop-event " + eventName
          + " --ready-event " + readyEventName
          + artworkArguments
          + greetingArguments
          + (landingLayout ? " --landing" : String.Empty)
          + (dark ? " --dark" : String.Empty)
          + (sourceDark ? " --source-dark" : String.Empty);
        start.UseShellExecute = false;
        start.CreateNoWindow = true;
        start.WindowStyle = ProcessWindowStyle.Hidden;
        start.RedirectStandardOutput = true;
        start.RedirectStandardError = true;
        process = new Process();
        process.StartInfo = start;
        if (!process.Start()) throw new InvalidOperationException();
        processStarted = true;
        Started = true;
        StartCount += 1;
        activeKey = key;
        DateTime deadline = DateTime.UtcNow.AddMilliseconds(3500);
        do {
          if (readyEvent.WaitOne(25)) {
            Initialized = true;
            return true;
          }
          process.Refresh();
          if (process.HasExited) {
            FinalizeActiveProcess();
            return false;
          }
        } while (DateTime.UtcNow < deadline);
        FailureCount += 1;
        StopActiveProcess();
        return false;
      } catch {
        FailureCount += 1;
        bool stopped = false;
        try { stopped = StopActiveProcess(); } catch { stopped = false; }
        if (!stopped) CleanupComplete = false;
        return false;
      }
    }

    public void HideFilter() {
      if (process != null) StopActiveProcess();
    }

    public void Dispose() {
      if (disposed) return;
      disposed = true;
      if (process != null) StopActiveProcess();
    }
  }

  internal sealed class CompositorColorFilterForm : Form {
    private const int WS_EX_LAYERED = 0x00080000;
    private const int WS_EX_TRANSPARENT = 0x00000020;
    private const int WS_EX_TOOLWINDOW = 0x00000080;
    private const int WS_EX_NOACTIVATE = 0x08000000;
    private const int WS_CHILD = 0x40000000;
    private const int WS_VISIBLE = 0x10000000;
    private const int WM_NCHITTEST = 0x0084;
    private const int WM_MOUSEACTIVATE = 0x0021;
    private const int HTTRANSPARENT = -1;
    private const int MA_NOACTIVATE = 3;
    private const int SW_HIDE = 0;
    private const int SWP_NOACTIVATE = 0x0010;
    private const int SWP_SHOWWINDOW = 0x0040;
    private const int LWA_ALPHA = 0x00000002;
    private const uint MW_FILTERMODE_EXCLUDE = 0;
    private const uint SPI_GETDISABLEOVERLAPPEDCONTENT = 0x1040;
    private static readonly IntPtr HWND_TOP = IntPtr.Zero;

    [StructLayout(LayoutKind.Sequential)]
    private struct SOURCE_RECT {
      public int Left;
      public int Top;
      public int Right;
      public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MAGTRANSFORM {
      [MarshalAs(UnmanagedType.ByValArray, SizeConst = 9)]
      public float[] Values;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MAGCOLOREFFECT {
      [MarshalAs(UnmanagedType.ByValArray, SizeConst = 25)]
      public float[] Values;
    }

    [DllImport("Magnification.dll", SetLastError = true)]
    private static extern bool MagInitialize();
    [DllImport("Magnification.dll", SetLastError = true)]
    private static extern bool MagUninitialize();
    [DllImport("Magnification.dll", SetLastError = true)]
    private static extern bool MagSetWindowSource(IntPtr window, SOURCE_RECT rectangle);
    [DllImport("Magnification.dll", SetLastError = true)]
    private static extern bool MagSetWindowTransform(
      IntPtr window, ref MAGTRANSFORM transform);
    [DllImport("Magnification.dll", SetLastError = true)]
    private static extern bool MagSetWindowFilterList(
      IntPtr window, uint mode, int count, IntPtr[] windows);
    [DllImport("Magnification.dll", SetLastError = true)]
    private static extern bool MagSetColorEffect(
      IntPtr window, ref MAGCOLOREFFECT effect);
    [DllImport("Magnification.dll", EntryPoint = "MagSetColorEffect",
      SetLastError = true)]
    private static extern bool MagClearColorEffect(IntPtr window, IntPtr effect);
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr CreateWindowEx(int extendedStyle,
      string className, string windowName, int style,
      int x, int y, int width, int height,
      IntPtr parent, IntPtr menu, IntPtr instance, IntPtr parameter);
    [DllImport("user32.dll")]
    private static extern bool DestroyWindow(IntPtr window);
    [DllImport("user32.dll")]
    private static extern bool SetWindowPos(IntPtr window, IntPtr insertAfter,
      int x, int y, int width, int height, int flags);
    [DllImport("user32.dll")]
    private static extern bool MoveWindow(IntPtr window,
      int x, int y, int width, int height, bool repaint);
    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr window, int command);
    [DllImport("user32.dll")]
    private static extern bool SetLayeredWindowAttributes(
      IntPtr window, int colorKey, byte alpha, int flags);
    [DllImport("user32.dll")]
    private static extern bool InvalidateRect(
      IntPtr window, IntPtr rectangle, bool erase);
    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SystemParametersInfo(
      uint action, uint parameter, out bool value, uint flags);

    private IntPtr magnifier = IntPtr.Zero;
    private bool magnificationInitialized;
    private bool filterListSet;
    private bool presentationVisible;
    private int tintArgb;

    public bool Available { get; private set; }
    public bool Initialized { get; private set; }
    public bool InitializationSucceeded { get; private set; }
    public bool CleanupComplete { get; private set; }
    public int PresentCount { get; private set; }
    public int FailureCount { get; private set; }

    public CompositorColorFilterForm(bool requested) {
      bool overlapDisabled;
      bool overlapQuerySucceeded = SystemParametersInfo(
        SPI_GETDISABLEOVERLAPPEDCONTENT, 0, out overlapDisabled, 0);
      Available = requested && IntPtr.Size == 8
        && SystemInformation.MonitorCount == 1
        && !SystemInformation.HighContrast
        && overlapQuerySucceeded && !overlapDisabled;
      CleanupComplete = true;
      FormBorderStyle = FormBorderStyle.None;
      ShowInTaskbar = false;
      StartPosition = FormStartPosition.Manual;
      BackColor = Color.Black;
      TopMost = false;
      Bounds = new Rectangle(-32000, -32000, 1, 1);
    }

    protected override bool ShowWithoutActivation { get { return true; } }

    protected override CreateParams CreateParams {
      get {
        CreateParams parameters = base.CreateParams;
        parameters.ExStyle |= WS_EX_LAYERED | WS_EX_TRANSPARENT
          | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE;
        return parameters;
      }
    }

    protected override void WndProc(ref Message message) {
      if (message.Msg == WM_NCHITTEST) {
        message.Result = new IntPtr(HTTRANSPARENT);
        return;
      }
      if (message.Msg == WM_MOUSEACTIVATE) {
        message.Result = new IntPtr(MA_NOACTIVATE);
        return;
      }
      base.WndProc(ref message);
    }

    protected override void Dispose(bool disposing) {
      Shutdown();
      base.Dispose(disposing);
    }

    private void InitializeFilter(IntPtr[] helperWindows) {
      if (Initialized || !Available) return;
      if (!MagInitialize()) throw new InvalidOperationException();
      magnificationInitialized = true;
      magnifier = CreateWindowEx(0, "Magnifier", "AuraDesktopColorEffect",
        WS_CHILD | WS_VISIBLE, 0, 0, 1, 1,
        Handle, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
      if (magnifier == IntPtr.Zero) throw new InvalidOperationException();
      MAGTRANSFORM transform = new MAGTRANSFORM { Values = new float[] {
        1, 0, 0, 0, 1, 0, 0, 0, 1
      }};
      if (!MagSetWindowTransform(magnifier, ref transform)
          || !SetLayeredWindowAttributes(Handle, 0, 255, LWA_ALPHA)) {
        throw new InvalidOperationException();
      }
      List<IntPtr> exclusions = new List<IntPtr>();
      exclusions.Add(Handle);
      foreach (IntPtr helperWindow in helperWindows) {
        if (helperWindow != IntPtr.Zero && !exclusions.Contains(helperWindow)) {
          exclusions.Add(helperWindow);
        }
      }
      if (!MagSetWindowFilterList(magnifier, MW_FILTERMODE_EXCLUDE,
          exclusions.Count, exclusions.ToArray())) {
        throw new InvalidOperationException();
      }
      filterListSet = true;
      Initialized = true;
      InitializationSucceeded = true;
      CleanupComplete = false;
    }

    private void SetTint(Color tint) {
      if (tintArgb == tint.ToArgb()) return;
      const float strength = 0.065f;
      float keep = 1.0f - strength;
      MAGCOLOREFFECT effect = new MAGCOLOREFFECT { Values = new float[] {
        keep, 0, 0, 0, 0,
        0, keep, 0, 0, 0,
        0, 0, keep, 0, 0,
        0, 0, 0, 1, 0,
        (tint.R / 255.0f) * strength,
        (tint.G / 255.0f) * strength,
        (tint.B / 255.0f) * strength, 0, 1
      }};
      if (!MagSetColorEffect(magnifier, ref effect)) {
        throw new InvalidOperationException();
      }
      tintArgb = tint.ToArgb();
    }

    public bool PlaceAndShow(int left, int top, int right, int bottom,
        Color tint, IntPtr[] helperWindows) {
      if (!Available) return false;
      try {
        InitializeFilter(helperWindows);
        if (!Initialized || !filterListSet) return false;
        SetTint(tint);
        int width = right - left;
        int height = bottom - top;
        if (!SetWindowPos(Handle, HWND_TOP, left, top, width, height,
            SWP_NOACTIVATE | SWP_SHOWWINDOW)
            || !MoveWindow(magnifier, 0, 0, width, height, true)) {
          throw new InvalidOperationException();
        }
        SOURCE_RECT source = new SOURCE_RECT {
          Left = left, Top = top, Right = right, Bottom = bottom
        };
        if (!MagSetWindowSource(magnifier, source)) {
          throw new InvalidOperationException();
        }
        InvalidateRect(magnifier, IntPtr.Zero, true);
        presentationVisible = true;
        PresentCount += 1;
        return true;
      } catch {
        FailureCount += 1;
        Available = false;
        Shutdown();
        return false;
      }
    }

    public void HideFilter() {
      if (!presentationVisible) return;
      ShowWindow(Handle, SW_HIDE);
      presentationVisible = false;
    }

    public void Shutdown() {
      HideFilter();
      if (magnifier == IntPtr.Zero && !magnificationInitialized) return;
      bool complete = true;
      if (magnifier != IntPtr.Zero) {
        complete = MagClearColorEffect(magnifier, IntPtr.Zero) && complete;
        complete = DestroyWindow(magnifier) && complete;
        magnifier = IntPtr.Zero;
      }
      if (magnificationInitialized) {
        complete = MagUninitialize() && complete;
        magnificationInitialized = false;
      }
      Initialized = false;
      CleanupComplete = complete;
    }
  }

  internal sealed class StructuralAccent {
    public int Kind { get; private set; }
    public Rectangle Bounds { get; private set; }

    public StructuralAccent(int kind, Rectangle bounds) {
      Kind = kind;
      Bounds = bounds;
    }

    public string Key {
      get {
        return Kind + ":" + Bounds.X + ":" + Bounds.Y + ":"
          + Bounds.Width + ":" + Bounds.Height;
      }
    }
  }

  internal sealed class ThemeComposition {
    public string BackgroundPath { get; private set; }
    public int BackgroundPosition { get; private set; }
    public float BackgroundOpacity { get; private set; }
    public string FeaturePath { get; private set; }
    public int FeaturePosition { get; private set; }
    public float FeatureOpacity { get; private set; }
    public int FeatureRole { get; private set; }
    public int FeatureMask { get; private set; }
    public int FeatureSizeMode { get; private set; }
    public double FeatureSizeRatio { get; private set; }
    public double FeaturePixelCap { get; private set; }
    public int GreetingDecoration { get; private set; }
    public int GreetingMarkSource { get; private set; }
    public int GreetingAlignment { get; private set; }
    public int GreetingColorRole { get; private set; }
    public double GreetingMaxWidthRatio { get; private set; }
    public double GreetingXRatio { get; private set; }
    public double GreetingYRatio { get; private set; }
    public double GreetingFontSize { get; private set; }
    public int GreetingWeight { get; private set; }
    public bool GreetingItalic { get; private set; }
    public double GreetingLetterSpacing { get; private set; }
    public int GreetingFontCategory { get; private set; }
    public double GreetingMarkScale { get; private set; }
    public double PromptWidthRatio { get; private set; }
    public double PromptOffsetXRatio { get; private set; }
    public double PromptOffsetYRatio { get; private set; }
    public int ComposerRadius { get; private set; }
    public int CardRadius { get; private set; }
    public int ControlRadius { get; private set; }
    public int BorderWidth { get; private set; }
    public int WideGreetingDecoration { get; private set; }
    public int WideGreetingMarkSource { get; private set; }
    public int WideGreetingAlignment { get; private set; }
    public int WideGreetingColorRole { get; private set; }
    public double WideGreetingMaxWidthRatio { get; private set; }
    public double WideGreetingXRatio { get; private set; }
    public double WideGreetingYRatio { get; private set; }
    public double WideGreetingFontSize { get; private set; }
    public int WideGreetingWeight { get; private set; }
    public bool WideGreetingItalic { get; private set; }
    public double WideGreetingLetterSpacing { get; private set; }
    public int WideGreetingFontCategory { get; private set; }
    public double WideGreetingMarkScale { get; private set; }

    private static int BoundedInt(string value, int minimum, int maximum) {
      int parsed;
      if (!Int32.TryParse(value, NumberStyles.Integer,
          CultureInfo.InvariantCulture, out parsed)
          || parsed < minimum || parsed > maximum) {
        throw new ArgumentException("Invalid theme composition descriptor.");
      }
      return parsed;
    }

    private static double BoundedDouble(string value,
        double minimum, double maximum) {
      double parsed;
      if (!Double.TryParse(value, NumberStyles.Float,
          CultureInfo.InvariantCulture, out parsed)
          || Double.IsNaN(parsed) || Double.IsInfinity(parsed)
          || parsed < minimum || parsed > maximum) {
        throw new ArgumentException("Invalid theme composition descriptor.");
      }
      return parsed;
    }

    public static ThemeComposition Parse(string value) {
      string[] parts = (value ?? String.Empty).Split(
        new char[] { '|' }, StringSplitOptions.None);
      if (parts.Length != 44) {
        throw new ArgumentException("Invalid theme composition descriptor.");
      }
      ThemeComposition result = new ThemeComposition();
      result.BackgroundPath = parts[0];
      result.BackgroundPosition = BoundedInt(parts[1], 0, 4);
      result.BackgroundOpacity = (float)BoundedDouble(parts[2], 0.0, 1.0);
      result.FeaturePath = parts[3];
      result.FeaturePosition = BoundedInt(parts[4], 0, 4);
      result.FeatureOpacity = (float)BoundedDouble(parts[5], 0.0, 1.0);
      result.FeatureRole = BoundedInt(parts[6], 0, 2);
      result.FeatureMask = BoundedInt(parts[7], 0, 1);
      result.FeatureSizeMode = BoundedInt(parts[8], 0, 2);
      result.FeatureSizeRatio = BoundedDouble(parts[9], 0.0, 0.96);
      result.FeaturePixelCap = BoundedDouble(parts[10], 0.0, 1200.0);
      result.GreetingDecoration = BoundedInt(parts[11], 0, 2);
      result.GreetingMarkSource = BoundedInt(parts[12], 0, 1);
      result.GreetingAlignment = BoundedInt(parts[13], 0, 1);
      result.GreetingColorRole = BoundedInt(parts[14], 0, 1);
      result.GreetingMaxWidthRatio = BoundedDouble(parts[15], 0.45, 0.85);
      result.GreetingXRatio = BoundedDouble(parts[16], -0.2, 0.2);
      result.GreetingYRatio = BoundedDouble(parts[17], -0.2, 0.2);
      result.GreetingFontSize = BoundedDouble(parts[18], 24.0, 48.0);
      result.GreetingWeight = BoundedInt(parts[19], 100, 900);
      result.GreetingItalic = BoundedInt(parts[20], 0, 1) == 1;
      result.GreetingLetterSpacing = BoundedDouble(parts[21], -0.1, 0.1);
      result.GreetingFontCategory = BoundedInt(parts[22], 0, 3);
      result.GreetingMarkScale = BoundedDouble(parts[23], 0.5, 1.25);
      result.PromptWidthRatio = BoundedDouble(parts[24], 0.45, 0.85);
      result.PromptOffsetXRatio = BoundedDouble(parts[25], -0.2, 0.2);
      result.PromptOffsetYRatio = BoundedDouble(parts[26], -0.2, 0.2);
      result.ComposerRadius = BoundedInt(parts[27], 4, 32);
      result.CardRadius = BoundedInt(parts[28], 2, 32);
      result.ControlRadius = BoundedInt(parts[29], 2, 24);
      result.BorderWidth = BoundedInt(parts[30], 1, 3);
      result.WideGreetingDecoration = BoundedInt(parts[31], 0, 2);
      result.WideGreetingMarkSource = BoundedInt(parts[32], 0, 1);
      result.WideGreetingAlignment = BoundedInt(parts[33], 0, 1);
      result.WideGreetingColorRole = BoundedInt(parts[34], 0, 1);
      result.WideGreetingMaxWidthRatio = BoundedDouble(parts[35], 0.45, 0.85);
      result.WideGreetingXRatio = BoundedDouble(parts[36], -0.2, 0.2);
      result.WideGreetingYRatio = BoundedDouble(parts[37], -0.2, 0.2);
      result.WideGreetingFontSize = BoundedDouble(parts[38], 24.0, 48.0);
      result.WideGreetingWeight = BoundedInt(parts[39], 100, 900);
      result.WideGreetingItalic = BoundedInt(parts[40], 0, 1) == 1;
      result.WideGreetingLetterSpacing = BoundedDouble(parts[41], -0.1, 0.1);
      result.WideGreetingFontCategory = BoundedInt(parts[42], 0, 3);
      result.WideGreetingMarkScale = BoundedDouble(parts[43], 0.5, 1.25);
      return result;
    }

    public bool UsesWideGreeting(int targetWidth, int dpi) {
      double scale = Math.Max(1.0, dpi / 96.0);
      return targetWidth / scale >= 1440.0;
    }

    public int ResolvedGreetingDecoration(bool wide) {
      return wide ? WideGreetingDecoration : GreetingDecoration;
    }

    public int ResolvedGreetingMarkSource(bool wide) {
      return wide ? WideGreetingMarkSource : GreetingMarkSource;
    }

    public int ResolvedGreetingAlignment(bool wide) {
      return wide ? WideGreetingAlignment : GreetingAlignment;
    }

    public int ResolvedGreetingColorRole(bool wide) {
      return wide ? WideGreetingColorRole : GreetingColorRole;
    }

    public double ResolvedGreetingMaxWidthRatio(bool wide) {
      return wide ? WideGreetingMaxWidthRatio : GreetingMaxWidthRatio;
    }

    public double ResolvedGreetingXRatio(bool wide) {
      return wide ? WideGreetingXRatio : GreetingXRatio;
    }

    public double ResolvedGreetingYRatio(bool wide) {
      return wide ? WideGreetingYRatio : GreetingYRatio;
    }

    public double ResolvedGreetingFontSize(bool wide) {
      return wide ? WideGreetingFontSize : GreetingFontSize;
    }

    public int ResolvedGreetingWeight(bool wide) {
      return wide ? WideGreetingWeight : GreetingWeight;
    }

    public bool ResolvedGreetingItalic(bool wide) {
      return wide ? WideGreetingItalic : GreetingItalic;
    }

    public double ResolvedGreetingLetterSpacing(bool wide) {
      return wide ? WideGreetingLetterSpacing : GreetingLetterSpacing;
    }

    public int ResolvedGreetingFontCategory(bool wide) {
      return wide ? WideGreetingFontCategory : GreetingFontCategory;
    }

    public double ResolvedGreetingMarkScale(bool wide) {
      return wide ? WideGreetingMarkScale : GreetingMarkScale;
    }

    public double ResolvedFeatureMaximumWidthRatio(int targetWidth,
        int targetHeight, int dpi, double sidebarRatio, double titleRatio) {
      if (FeatureSizeMode == 1) return 0.96;
      if (FeatureSizeMode != 2) return FeatureRole == 2 ? 0.30 : 0.48;
      double scale = Math.Max(1.0, dpi / 96.0);
      double mainWidth = Math.Max(1.0, targetWidth * (1.0 - sidebarRatio));
      double desired = Math.Min(targetWidth * FeatureSizeRatio,
        FeaturePixelCap * scale);
      return Math.Max(0.18, Math.Min(0.96, desired / mainWidth));
    }

    public double ResolvedFeatureMaximumHeightRatio(int targetWidth,
        int targetHeight, int dpi, double sidebarRatio, double titleRatio) {
      if (FeatureSizeMode == 2) return 0.96;
      if (FeatureSizeMode != 1) return FeatureRole == 2 ? 0.34 : 0.84;
      double scale = Math.Max(1.0, dpi / 96.0);
      double mainHeight = Math.Max(1.0, targetHeight * (1.0 - titleRatio));
      double desired = Math.Min(mainHeight * FeatureSizeRatio,
        FeaturePixelCap * scale);
      return Math.Max(0.18, Math.Min(0.96, desired / mainHeight));
    }

    public static ThemeComposition[] ParseAll(string[] values) {
      ThemeComposition[] parsed = new ThemeComposition[values.Length];
      for (int index = 0; index < values.Length; index++) {
        parsed[index] = Parse(values[index]);
      }
      return parsed;
    }
  }

  internal sealed class StructureSnapshot {
    public StructuralAccent[] Accents { get; private set; }
    public int ElementCount { get; private set; }
    public Rectangle SidebarBounds { get; private set; }
    public Rectangle PromptBounds { get; private set; }
    public Rectangle GreetingBounds { get; private set; }
    public bool LandingLayout { get; private set; }
    public string Signature { get; private set; }

    public StructureSnapshot(List<StructuralAccent> accents, int elementCount,
        Rectangle sidebarBounds, Rectangle promptBounds,
        Rectangle greetingBounds, bool landingLayout) {
      Accents = accents.ToArray();
      ElementCount = elementCount;
      SidebarBounds = sidebarBounds;
      PromptBounds = promptBounds;
      GreetingBounds = greetingBounds;
      LandingLayout = landingLayout;
      List<string> keys = new List<string>();
      foreach (StructuralAccent accent in Accents) keys.Add(accent.Key);
      Signature = String.Join("|", keys.ToArray())
        + ";sidebar=" + RectangleKey(SidebarBounds)
        + ";prompt=" + RectangleKey(PromptBounds)
        + ";greeting=" + RectangleKey(GreetingBounds)
        + ";landing=" + (LandingLayout ? "1" : "0");
    }

    private static string RectangleKey(Rectangle bounds) {
      return bounds.X + ":" + bounds.Y + ":"
        + bounds.Width + ":" + bounds.Height;
    }
  }

  internal sealed class AccentOverlayForm : Form {
    private const int WS_EX_LAYERED = 0x00080000;
    private const int WS_EX_TRANSPARENT = 0x00000020;
    private const int WS_EX_TOOLWINDOW = 0x00000080;
    private const int WS_EX_NOACTIVATE = 0x08000000;
    private const int WM_NCHITTEST = 0x0084;
    private const int WM_MOUSEACTIVATE = 0x0021;
    private const int HTTRANSPARENT = -1;
    private const int MA_NOACTIVATE = 3;
    private const int SW_HIDE = 0;
    private const uint SWP_NOSIZE = 0x0001;
    private const uint SWP_NOMOVE = 0x0002;
    private const uint SWP_NOACTIVATE = 0x0010;
    private const uint SWP_SHOWWINDOW = 0x0040;
    private const uint ULW_ALPHA = 0x00000002;
    private const byte AC_SRC_ALPHA = 0x01;
    private const uint GA_ROOTOWNER = 3;

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT {
      public int Left;
      public int Top;
      public int Right;
      public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct POINT {
      public int X;
      public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct SIZE {
      public int Width;
      public int Height;
    }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    private struct BLENDFUNCTION {
      public byte BlendOp;
      public byte BlendFlags;
      public byte SourceConstantAlpha;
      public byte AlphaFormat;
    }

    [DllImport("user32.dll")]
    private static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")]
    private static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr window, out RECT rectangle);
    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    private static extern IntPtr GetAncestor(IntPtr window, uint flags);
    [DllImport("user32.dll")]
    private static extern uint GetDpiForWindow(IntPtr window);
    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr window, int command);
    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetWindowPos(
      IntPtr window, IntPtr insertAfter, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll")]
    private static extern IntPtr GetDC(IntPtr window);
    [DllImport("user32.dll")]
    private static extern int ReleaseDC(IntPtr window, IntPtr deviceContext);
    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UpdateLayeredWindow(
      IntPtr window, IntPtr destinationDeviceContext, ref POINT destination,
      ref SIZE size, IntPtr sourceDeviceContext, ref POINT source,
      int colorKey, ref BLENDFUNCTION blend, uint flags);
    [DllImport("gdi32.dll")]
    private static extern IntPtr CreateCompatibleDC(IntPtr deviceContext);
    [DllImport("gdi32.dll")]
    private static extern bool DeleteDC(IntPtr deviceContext);
    [DllImport("gdi32.dll")]
    private static extern IntPtr SelectObject(IntPtr deviceContext, IntPtr handle);
    [DllImport("gdi32.dll")]
    private static extern bool DeleteObject(IntPtr handle);

    private readonly IntPtr target;
    private readonly uint targetProcessId;
    private readonly DateTime deadline;
    private readonly bool deadlineEnabled;
    private readonly Timer timer;
    private readonly string[] themeIds;
    private readonly Color[] primaries;
    private readonly Color[] secondaries;
    private readonly Color[] tertiaries;
    private readonly Color[] highlights;
    private readonly Color[] launcherSurfaceHovers;
    private readonly double[] launcherControlRadii;
    private readonly double[] launcherControlBorderWidths;
    private readonly string[] themeUiFontIds;
    private readonly string[] themeDisplayFontIds;
    private readonly Color[] lightPrimaries;
    private readonly Color[] lightSecondaries;
    private readonly Color[] lightTertiaries;
    private readonly Color[] lightHighlights;
    private readonly Color[] lightFocuses;
    private readonly Color[] lightAccentTexts;
    private readonly Color[] lightSidebarTexts;
    private readonly Color[] lightSidebarTextMuted;
    private readonly Color[] lightTextSecondaries;
    private readonly Color[] lightTextMuted;
    private readonly Color[] lightSurfaces;
    private readonly Color[] lightRaisedSurfaces;
    private readonly Color[] lightCanvases;
    private readonly double[] lightSurfaceAlphas;
    private readonly double[] lightSidebarAlphas;
    private readonly Color[] darkPrimaries;
    private readonly Color[] darkSecondaries;
    private readonly Color[] darkTertiaries;
    private readonly Color[] darkHighlights;
    private readonly Color[] darkFocuses;
    private readonly Color[] darkAccentTexts;
    private readonly Color[] darkSidebarTexts;
    private readonly Color[] darkSidebarTextMuted;
    private readonly Color[] darkTextSecondaries;
    private readonly Color[] darkTextMuted;
    private readonly Color[] darkSurfaces;
    private readonly Color[] darkRaisedSurfaces;
    private readonly Color[] darkCanvases;
    private readonly double[] darkSurfaceAlphas;
    private readonly double[] darkSidebarAlphas;
    private readonly string[] markPaths;
    private readonly ThemeComposition[] lightCompositions;
    private readonly ThemeComposition[] darkCompositions;
    private readonly string[] lightWordmarkPaths;
    private readonly string[] darkWordmarkPaths;
    private readonly int[] themeRadii;
    private readonly int[] themeBlurs;
    private readonly string statePath;
    private readonly System.Threading.EventWaitHandle stateSyncEvent;
    private readonly System.Threading.EventWaitHandle stateReloadEvent;
    private readonly bool shellTintEnabled;
    private readonly bool artworkEnabled;
    private readonly bool identityEnabled;
    private readonly bool structureAccentsEnabled;
    private readonly bool colorFilterEnabled;
    private readonly CompositorColorFilterForm colorFilter;
    private readonly GpuCaptureColorFilterController gpuColorFilter;
    private readonly ThemeRailForm rail;
    private readonly DesktopWorkHubPanelController workHubPanel;
    private Bitmap surface;
    private int surfaceDpi;
    private int surfaceTargetWidth;
    private int surfaceTargetHeight;
    private int surfaceThemeIndex = -1;
    private int selectedThemeIndex;
    private string appearance;
    private bool effectiveDark;
    private readonly bool sourceDark;
    private bool originalLook;
    private bool targetClosed;
    private bool sessionClosed;
    private bool presentationShown;
    private int presentCount;
    private int hiddenTransitions;
    private int surfaceBuildCount;
    private int themeSwitchCount;
    private int originalLookTransitions;
    private int appearanceSwitchCount;
    private int artworkRenderCount;
    private int artworkFailureCount;
    private int backgroundArtworkRenderCount;
    private int featureArtworkRenderCount;
    private int identityRenderCount;
    private int identityFailureCount;
    private int sidebarCompositionCount;
    private int promptCompositionCount;
    private int greetingCompositionCount;
    private int controlPresentCount;
    private int persistenceWriteCount;
    private bool persistenceFailed;
    private int externalStateApplyCount;
    private int externalStateFailureCount;
    private bool stateReloadRequested;
    private readonly bool cyclePermanentThemeMatrix;
    private int matrixCycleStep;
    private DateTime nextMatrixTransition = DateTime.MinValue;
    private bool matrixCycleCompleted;
    private bool structureDisabled;
    private DateTime nextStructureRefresh = DateTime.MinValue;
    private StructuralAccent[] structureAccents = new StructuralAccent[0];
    private Rectangle structureSidebarBounds = Rectangle.Empty;
    private Rectangle structurePromptBounds = Rectangle.Empty;
    private Rectangle structureGreetingBounds = Rectangle.Empty;
    private bool structureLandingLayout;
    private string structureSignature = String.Empty;
    private int structureSnapshotCount;
    private int structureElementCount;
    private int structureFailureCount;

    private sealed class RawStructureCandidate {
      public int Kind;
      public Rectangle Bounds;

      public RawStructureCandidate(int kind, Rectangle bounds) {
        Kind = kind;
        Bounds = bounds;
      }
    }

    public AccentOverlayForm(IntPtr targetWindow, uint processId, int durationSeconds,
        string[] ids, string[] labels,
        Color[] primaryColors, Color[] secondaryColors,
        Color[] tertiaryColors, Color[] highlightColors, Color[] launcherHoverColors,
        double[] launcherRadii, double[] launcherBorderWidths,
        string[] uiFontIds, string[] displayFontIds, string[] launcherMarkPaths,
        Color[] lightPrimaryColors, Color[] lightSecondaryColors,
        Color[] lightTertiaryColors, Color[] lightHighlightColors,
        Color[] lightFocusColors, Color[] lightAccentTextColors,
        Color[] lightSidebarTextColors, Color[] lightSidebarTextMutedColors,
        Color[] lightTextSecondaryColors, Color[] lightTextMutedColors,
        Color[] lightSurfaceColors, Color[] lightRaisedColors, Color[] lightCanvasColors,
        double[] lightSurfaceAlphaValues, double[] lightSidebarAlphaValues,
        Color[] darkPrimaryColors, Color[] darkSecondaryColors,
        Color[] darkTertiaryColors, Color[] darkHighlightColors,
        Color[] darkFocusColors, Color[] darkAccentTextColors,
        Color[] darkSidebarTextColors, Color[] darkSidebarTextMutedColors,
        Color[] darkTextSecondaryColors, Color[] darkTextMutedColors,
        Color[] darkSurfaceColors, Color[] darkRaisedColors, Color[] darkCanvasColors,
        double[] darkSurfaceAlphaValues, double[] darkSidebarAlphaValues,
        string[] lightCompositionDescriptors, string[] darkCompositionDescriptors,
        string[] lightBrandWordmarkPaths, string[] darkBrandWordmarkPaths,
        int[] structureRadii, int[] materialBlurs,
        int initialThemeIndex, string initialAppearance,
        bool initialOriginalLook, bool showThemeRail,
        bool applyShellTint, bool applyArtwork, bool applyIdentity,
        bool applyStructureAccents, bool applyColorFilter,
        bool runPermanentThemeMatrix,
        string gpuFilterExecutable, string persistenceStatePath,
        string workHubPanelScriptPath, string locale) {
      target = targetWindow;
      targetProcessId = processId;
      deadlineEnabled = durationSeconds > 0;
      deadline = deadlineEnabled
        ? DateTime.UtcNow.AddSeconds(durationSeconds)
        : DateTime.MaxValue;
      themeIds = (string[])ids.Clone();
      primaries = (Color[])primaryColors.Clone();
      secondaries = (Color[])secondaryColors.Clone();
      tertiaries = (Color[])tertiaryColors.Clone();
      highlights = (Color[])highlightColors.Clone();
      launcherSurfaceHovers = (Color[])launcherHoverColors.Clone();
      launcherControlRadii = (double[])launcherRadii.Clone();
      launcherControlBorderWidths = (double[])launcherBorderWidths.Clone();
      themeUiFontIds = (string[])uiFontIds.Clone();
      themeDisplayFontIds = (string[])displayFontIds.Clone();
      lightPrimaries = (Color[])lightPrimaryColors.Clone();
      lightSecondaries = (Color[])lightSecondaryColors.Clone();
      lightTertiaries = (Color[])lightTertiaryColors.Clone();
      lightHighlights = (Color[])lightHighlightColors.Clone();
      lightFocuses = (Color[])lightFocusColors.Clone();
      lightAccentTexts = (Color[])lightAccentTextColors.Clone();
      lightSidebarTexts = (Color[])lightSidebarTextColors.Clone();
      lightSidebarTextMuted = (Color[])lightSidebarTextMutedColors.Clone();
      lightTextSecondaries = (Color[])lightTextSecondaryColors.Clone();
      lightTextMuted = (Color[])lightTextMutedColors.Clone();
      lightSurfaces = (Color[])lightSurfaceColors.Clone();
      lightRaisedSurfaces = (Color[])lightRaisedColors.Clone();
      lightCanvases = (Color[])lightCanvasColors.Clone();
      lightSurfaceAlphas = (double[])lightSurfaceAlphaValues.Clone();
      lightSidebarAlphas = (double[])lightSidebarAlphaValues.Clone();
      darkPrimaries = (Color[])darkPrimaryColors.Clone();
      darkSecondaries = (Color[])darkSecondaryColors.Clone();
      darkTertiaries = (Color[])darkTertiaryColors.Clone();
      darkHighlights = (Color[])darkHighlightColors.Clone();
      darkFocuses = (Color[])darkFocusColors.Clone();
      darkAccentTexts = (Color[])darkAccentTextColors.Clone();
      darkSidebarTexts = (Color[])darkSidebarTextColors.Clone();
      darkSidebarTextMuted = (Color[])darkSidebarTextMutedColors.Clone();
      darkTextSecondaries = (Color[])darkTextSecondaryColors.Clone();
      darkTextMuted = (Color[])darkTextMutedColors.Clone();
      darkSurfaces = (Color[])darkSurfaceColors.Clone();
      darkRaisedSurfaces = (Color[])darkRaisedColors.Clone();
      darkCanvases = (Color[])darkCanvasColors.Clone();
      darkSurfaceAlphas = (double[])darkSurfaceAlphaValues.Clone();
      darkSidebarAlphas = (double[])darkSidebarAlphaValues.Clone();
      lightCompositions = ThemeComposition.ParseAll(lightCompositionDescriptors);
      darkCompositions = ThemeComposition.ParseAll(darkCompositionDescriptors);
      lightWordmarkPaths = (string[])lightBrandWordmarkPaths.Clone();
      darkWordmarkPaths = (string[])darkBrandWordmarkPaths.Clone();
      themeRadii = (int[])structureRadii.Clone();
      themeBlurs = (int[])materialBlurs.Clone();
      markPaths = (string[])launcherMarkPaths.Clone();
      statePath = persistenceStatePath;
      stateSyncEvent = null;
      stateReloadEvent = null;
      if (!String.IsNullOrWhiteSpace(statePath)) {
        try {
          string sid = System.Security.Principal.WindowsIdentity.GetCurrent().User.Value;
          stateSyncEvent = new System.Threading.EventWaitHandle(false,
            System.Threading.EventResetMode.AutoReset,
            "Local\\ClaudeAura." + sid + ".DesktopPresentationSync");
          stateReloadEvent = new System.Threading.EventWaitHandle(false,
            System.Threading.EventResetMode.AutoReset,
            "Local\\ClaudeAura." + sid + ".DesktopPresentationReload");
        } catch {
          externalStateFailureCount += 1;
        }
      }
      shellTintEnabled = applyShellTint;
      artworkEnabled = applyArtwork;
      identityEnabled = applyIdentity;
      structureAccentsEnabled = applyStructureAccents;
      colorFilterEnabled = applyColorFilter;
      cyclePermanentThemeMatrix = runPermanentThemeMatrix;
      selectedThemeIndex = initialThemeIndex;
      appearance = NormalizeAppearance(initialAppearance);
      effectiveDark = EffectiveDarkAppearance(appearance);
      sourceDark = EffectiveDarkAppearance("system");
      originalLook = initialOriginalLook;
      FormBorderStyle = FormBorderStyle.None;
      ShowInTaskbar = false;
      StartPosition = FormStartPosition.Manual;
      TopMost = true;
      Bounds = new Rectangle(0, 0, 1, 1);
      workHubPanel = new DesktopWorkHubPanelController(
        target, targetProcessId, workHubPanelScriptPath, persistenceStatePath, locale);
      if (showThemeRail) {
        rail = new ThemeRailForm(themeIds, labels,
          primaries, tertiaries, launcherSurfaceHovers, secondaries, highlights,
          launcherControlRadii, launcherControlBorderWidths,
          themeUiFontIds, themeDisplayFontIds, markPaths,
          selectedThemeIndex, appearance, originalLook,
          delegate(int index) { SelectTheme(index); },
          delegate(int index) { SelectAppearance(index); },
          delegate { SelectOriginalLook(); },
          delegate { ToggleWorkHub(); },
          delegate { sessionClosed = true; Close(); });
      }
      colorFilter = new CompositorColorFilterForm(colorFilterEnabled);
      gpuColorFilter = new GpuCaptureColorFilterController(
        gpuFilterExecutable, target, colorFilterEnabled);
      ApplyExternalPresentationState(false);
      if (!stateReloadRequested) PersistState();
      timer = new Timer();
      timer.Interval = 50;
      timer.Tick += delegate {
        HandleExternalPresentationSignals();
        if (stateReloadRequested) return;
        RefreshPresentation();
        AdvancePermanentThemeMatrix();
      };
    }

    public bool TargetClosed { get { return targetClosed; } }
    public bool SessionClosed { get { return sessionClosed; } }
    public int PresentCount { get { return presentCount; } }
    public int HiddenTransitions { get { return hiddenTransitions; } }
    public int SurfaceBuildCount { get { return surfaceBuildCount; } }
    public int ThemeSwitchCount { get { return themeSwitchCount; } }
    public int OriginalLookTransitions { get { return originalLookTransitions; } }
    public int AppearanceSwitchCount { get { return appearanceSwitchCount; } }
    public int ArtworkRenderCount { get { return artworkRenderCount; } }
    public int ArtworkFailureCount { get { return artworkFailureCount; } }
    public int BackgroundArtworkRenderCount { get { return backgroundArtworkRenderCount; } }
    public int FeatureArtworkRenderCount { get { return featureArtworkRenderCount; } }
    public int IdentityRenderCount { get { return identityRenderCount; } }
    public int IdentityFailureCount { get { return identityFailureCount; } }
    public int SidebarCompositionCount { get { return sidebarCompositionCount; } }
    public int PromptCompositionCount { get { return promptCompositionCount; } }
    public int GreetingCompositionCount { get { return greetingCompositionCount; } }
    public int StructureSnapshotCount { get { return structureSnapshotCount; } }
    public int StructureElementCount { get { return structureElementCount; } }
    public int StructureAccentCount { get { return structureAccents.Length; } }
    public int StructureFailureCount { get { return structureFailureCount; } }
    public int ColorFilterPresentCount {
      get { return colorFilter.PresentCount + gpuColorFilter.StartCount; }
    }
    public int ColorFilterFailureCount {
      get { return colorFilter.FailureCount + gpuColorFilter.FailureCount; }
    }
    public bool ColorFilterInitialized {
      get { return gpuColorFilter.Initialized || colorFilter.InitializationSucceeded; }
    }
    public bool ColorFilterAvailable {
      get { return gpuColorFilter.Available || colorFilter.Available; }
    }
    public bool ColorFilterCleanupComplete {
      get { return gpuColorFilter.CleanupComplete && colorFilter.CleanupComplete
        && workHubPanel.CleanupComplete; }
    }
    public bool GpuColorFilterAvailable { get { return gpuColorFilter.Available; } }
    public bool GpuColorFilterStarted { get { return gpuColorFilter.Started; } }
    public bool GpuColorFilterInitialized { get { return gpuColorFilter.Initialized; } }
    public bool GpuColorFilterEvidenceValid { get { return gpuColorFilter.EvidenceValid; } }
    public bool GpuSurfacePaletteMapping { get { return gpuColorFilter.SurfacePaletteMapping; } }
    public bool GpuSemanticPaletteMapping { get { return gpuColorFilter.SemanticPaletteMapping; } }
    public bool GpuSurfaceAlphaMapping { get { return gpuColorFilter.SurfaceAlphaMapping; } }
    public bool GpuDarkNeutralRemap { get { return gpuColorFilter.DarkNeutralRemapApplied; } }
    public bool GpuCoverageSafeAffineMapping { get { return gpuColorFilter.CoverageSafeAffineMapping; } }
    public bool GpuNonlinearTextRemap { get { return gpuColorFilter.NonlinearTextRemap; } }
    public bool GpuNativeResolutionPreserved { get { return gpuColorFilter.NativeResolutionPreserved; } }
    public int GpuCaptureWidth { get { return gpuColorFilter.CaptureWidth; } }
    public int GpuCaptureHeight { get { return gpuColorFilter.CaptureHeight; } }
    public int GpuSwapChainWidth { get { return gpuColorFilter.SwapChainWidth; } }
    public int GpuSwapChainHeight { get { return gpuColorFilter.SwapChainHeight; } }
    public int GpuOutputClientWidth { get { return gpuColorFilter.OutputClientWidth; } }
    public int GpuOutputClientHeight { get { return gpuColorFilter.OutputClientHeight; } }
    public int GpuColorFilterStartCount { get { return gpuColorFilter.StartCount; } }
    public int GpuColorFilterFailureCount { get { return gpuColorFilter.FailureCount; } }
    public long GpuColorFilterFramesPresented { get { return gpuColorFilter.FramesPresented; } }
    public int ControlPresentCount { get { return controlPresentCount; } }
    public string SelectedThemeId {
      get { return themeIds[selectedThemeIndex]; }
    }
    public bool OriginalLook { get { return originalLook; } }
    public string SelectedAppearance { get { return appearance; } }
    public string EffectiveAppearance { get { return effectiveDark ? "dark" : "light"; } }
    public string SourceEffectiveAppearance { get { return sourceDark ? "dark" : "light"; } }
    public int PersistenceWriteCount { get { return persistenceWriteCount; } }
    public bool PersistenceFailed { get { return persistenceFailed; } }
    public int ExternalStateApplyCount { get { return externalStateApplyCount; } }
    public int ExternalStateFailureCount { get { return externalStateFailureCount; } }
    public bool StateReloadRequested { get { return stateReloadRequested; } }
    public bool MatrixCycleCompleted { get { return matrixCycleCompleted; } }

    protected override bool ShowWithoutActivation { get { return true; } }

    protected override CreateParams CreateParams {
      get {
        CreateParams parameters = base.CreateParams;
        parameters.ExStyle |= WS_EX_LAYERED | WS_EX_TRANSPARENT
          | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE;
        return parameters;
      }
    }

    protected override void OnShown(EventArgs eventArgs) {
      base.OnShown(eventArgs);
      if (stateReloadRequested) {
        Close();
        return;
      }
      nextMatrixTransition = DateTime.UtcNow.AddMilliseconds(900);
      timer.Start();
      RefreshPresentation();
    }

    protected override void OnFormClosed(FormClosedEventArgs eventArgs) {
      timer.Stop();
      timer.Dispose();
      if (stateSyncEvent != null) stateSyncEvent.Dispose();
      if (stateReloadEvent != null) stateReloadEvent.Dispose();
      if (surface != null) surface.Dispose();
      surface = null;
      gpuColorFilter.Dispose();
      colorFilter.Dispose();
      workHubPanel.Dispose();
      if (rail != null) {
        rail.Close();
        rail.Dispose();
      }
      base.OnFormClosed(eventArgs);
    }

    protected override void WndProc(ref Message message) {
      if (message.Msg == WM_NCHITTEST) {
        message.Result = new IntPtr(HTTRANSPARENT);
        return;
      }
      if (message.Msg == WM_MOUSEACTIVATE) {
        message.Result = new IntPtr(MA_NOACTIVATE);
        return;
      }
      base.WndProc(ref message);
    }

    private bool TargetIsForeground() {
      IntPtr foreground = GetForegroundWindow();
      return foreground == target
        || (rail != null && foreground == rail.Handle)
        || (foreground != IntPtr.Zero && GetAncestor(foreground, GA_ROOTOWNER) == target);
    }

    private void SelectTheme(int index) {
      if (index < 0 || index >= themeIds.Length) return;
      if (selectedThemeIndex != index || originalLook) themeSwitchCount += 1;
      selectedThemeIndex = index;
      originalLook = false;
      PersistState();
      DropSurface();
      if (rail != null) rail.SetSelection(selectedThemeIndex, false);
      RefreshPresentation();
    }

    private void SelectOriginalLook() {
      if (!originalLook) originalLookTransitions += 1;
      originalLook = true;
      PersistState();
      gpuColorFilter.HideFilter();
      colorFilter.HideFilter();
      HidePresentation();
      if (rail != null) rail.SetSelection(selectedThemeIndex, true);
    }

    private void SelectAppearance(int index) {
      string next = index == 1 ? "light" : index == 2 ? "dark" : "system";
      if (appearance != next) appearanceSwitchCount += 1;
      appearance = next;
      effectiveDark = EffectiveDarkAppearance(appearance);
      PersistState();
      DropSurface();
      if (rail != null) rail.SetAppearance(appearance);
      RefreshPresentation();
    }

    private void ToggleWorkHub() {
      workHubPanel.Toggle(themeIds[selectedThemeIndex], appearance, originalLook);
    }

    private void AdvancePermanentThemeMatrix() {
      if (!cyclePermanentThemeMatrix || matrixCycleCompleted) return;
      if (matrixCycleStep == 16) {
        if (DateTime.UtcNow < nextMatrixTransition || !originalLook) return;
        matrixCycleCompleted = true;
        sessionClosed = true;
        Close();
        return;
      }
      if (themeIds.Length < 8 || !presentationShown
          || !gpuColorFilter.Initialized
          || DateTime.UtcNow < nextMatrixTransition) return;
      if (matrixCycleStep < 7) {
        SelectTheme(matrixCycleStep + 1);
      } else if (matrixCycleStep == 7) {
        SelectAppearance(2);
      } else if (matrixCycleStep < 15) {
        SelectTheme(14 - matrixCycleStep);
      } else {
        SelectOriginalLook();
      }
      matrixCycleStep += 1;
      nextMatrixTransition = DateTime.UtcNow.AddMilliseconds(900);
    }

    private void DropSurface() {
      if (surface != null) surface.Dispose();
      surface = null;
      surfaceThemeIndex = -1;
    }

    private bool TryReadExternalPresentationState(out string themeId,
        out string nextAppearance, out bool nextOriginalLook) {
      themeId = String.Empty;
      nextAppearance = "system";
      nextOriginalLook = false;
      try {
        if (String.IsNullOrWhiteSpace(statePath)) return false;
        FileInfo state = new FileInfo(statePath);
        if (!state.Exists || state.Length > 768
            || (state.Attributes & FileAttributes.ReparsePoint) != 0
            || (state.Directory.Attributes & FileAttributes.ReparsePoint) != 0) {
          throw new IOException();
        }
        string json = File.ReadAllText(statePath, new UTF8Encoding(false, true));
        System.Text.RegularExpressions.Match match =
          System.Text.RegularExpressions.Regex.Match(json,
            "^\\{\\\"schemaVersion\\\":2,\\\"themeId\\\":\\\"(?<theme>[a-z][a-z0-9-]{1,39})\\\",\\\"appearance\\\":\\\"(?<appearance>system|light|dark)\\\",\\\"originalLook\\\":(?<original>true|false)\\}$",
            System.Text.RegularExpressions.RegexOptions.CultureInvariant);
        if (!match.Success) throw new IOException();
        themeId = match.Groups["theme"].Value;
        nextAppearance = match.Groups["appearance"].Value;
        nextOriginalLook = String.Equals(match.Groups["original"].Value, "true",
          StringComparison.Ordinal);
        return true;
      } catch {
        externalStateFailureCount += 1;
        return false;
      }
    }

    private void ApplyExternalPresentationState(bool requestReloadForUnknownTheme) {
      string themeId;
      string nextAppearance;
      bool nextOriginalLook;
      if (!TryReadExternalPresentationState(
          out themeId, out nextAppearance, out nextOriginalLook)) return;
      int nextThemeIndex = Array.IndexOf(themeIds, themeId);
      if (nextThemeIndex < 0) {
        if (requestReloadForUnknownTheme) {
          stateReloadRequested = true;
          if (IsHandleCreated) Close();
        } else {
          externalStateFailureCount += 1;
        }
        return;
      }
      bool themeChanged = nextThemeIndex != selectedThemeIndex;
      bool appearanceChanged = !String.Equals(
        appearance, nextAppearance, StringComparison.Ordinal);
      bool originalChanged = originalLook != nextOriginalLook;
      if (!themeChanged && !appearanceChanged && !originalChanged) return;
      if (themeChanged || (originalLook && !nextOriginalLook)) themeSwitchCount += 1;
      if (appearanceChanged) appearanceSwitchCount += 1;
      if (originalChanged) originalLookTransitions += 1;
      selectedThemeIndex = nextThemeIndex;
      appearance = nextAppearance;
      effectiveDark = EffectiveDarkAppearance(appearance);
      originalLook = nextOriginalLook;
      externalStateApplyCount += 1;
      DropSurface();
      if (rail != null) {
        rail.SetSelection(selectedThemeIndex, originalLook);
        rail.SetAppearance(appearance);
      }
      if (originalLook) {
        gpuColorFilter.HideFilter();
        colorFilter.HideFilter();
        HidePresentation();
      }
    }

    private void HandleExternalPresentationSignals() {
      if (stateReloadEvent != null && stateReloadEvent.WaitOne(0)) {
        stateReloadRequested = true;
        Close();
        return;
      }
      if (stateSyncEvent != null && stateSyncEvent.WaitOne(0)) {
        ApplyExternalPresentationState(true);
      }
    }

    private void PersistState() {
      if (String.IsNullOrWhiteSpace(statePath)) return;
      string temporary = statePath + ".tmp-" + Guid.NewGuid().ToString("N");
      try {
        string directory = Path.GetDirectoryName(statePath);
        if (String.IsNullOrWhiteSpace(directory)) throw new IOException();
        Directory.CreateDirectory(directory);
        string themeId = themeIds[selectedThemeIndex]
          .Replace("\\", "\\\\").Replace("\"", "\\\"");
        string json = "{\"schemaVersion\":2,\"themeId\":\"" + themeId
          + "\",\"appearance\":\"" + appearance + "\",\"originalLook\":"
          + (originalLook ? "true" : "false") + "}";
        File.WriteAllText(temporary, json, new UTF8Encoding(false));
        if (File.Exists(statePath)) File.Replace(temporary, statePath, null);
        else File.Move(temporary, statePath);
        persistenceWriteCount += 1;
      } catch {
        persistenceFailed = true;
        try { if (File.Exists(temporary)) File.Delete(temporary); } catch { }
      }
    }

    private static void VisitStructure(
        System.Windows.Automation.AutomationElement element,
        System.Windows.Automation.TreeWalker walker,
        int depth, ref int elementCount,
        List<RawStructureCandidate> candidates) {
      if (element == null || elementCount >= 512 || depth > 24) return;
      elementCount += 1;
      try {
        object controlValue = element.GetCurrentPropertyValue(
          System.Windows.Automation.AutomationElement.ControlTypeProperty, true);
        object rectangleValue = element.GetCurrentPropertyValue(
          System.Windows.Automation.AutomationElement.BoundingRectangleProperty, true);
        object offscreenValue = element.GetCurrentPropertyValue(
          System.Windows.Automation.AutomationElement.IsOffscreenProperty, true);
        System.Windows.Automation.ControlType controlType =
          controlValue as System.Windows.Automation.ControlType;
        if (controlType != null && rectangleValue is System.Windows.Rect
            && !(offscreenValue is bool && (bool)offscreenValue)) {
          System.Windows.Rect rectangle = (System.Windows.Rect)rectangleValue;
          int kind = controlType == System.Windows.Automation.ControlType.Button ? 1
            : controlType == System.Windows.Automation.ControlType.ListItem ? 2
            : controlType == System.Windows.Automation.ControlType.ComboBox ? 3
            : controlType == System.Windows.Automation.ControlType.CheckBox ? 4
            : controlType == System.Windows.Automation.ControlType.Group ? 5
            : controlType == System.Windows.Automation.ControlType.Text ? 6
            : controlType == System.Windows.Automation.ControlType.Image ? 7
            : controlType == System.Windows.Automation.ControlType.List ? 8 : 0;
          if (kind != 0 && rectangle.Width > 0 && rectangle.Height > 0) {
            candidates.Add(new RawStructureCandidate(kind, new Rectangle(
              (int)Math.Round(rectangle.X), (int)Math.Round(rectangle.Y),
              (int)Math.Round(rectangle.Width), (int)Math.Round(rectangle.Height))));
          }
        }
      } catch {
      }
      System.Windows.Automation.AutomationElement child = null;
      try { child = walker.GetFirstChild(element); } catch { }
      while (child != null && elementCount < 512) {
        VisitStructure(child, walker, depth + 1, ref elementCount, candidates);
        try { child = walker.GetNextSibling(child); } catch { child = null; }
      }
    }

    private static bool ContainsAccent(
        List<StructuralAccent> accents, int kind, Rectangle bounds) {
      foreach (StructuralAccent accent in accents) {
        if (accent.Kind == kind && accent.Bounds.Contains(bounds)) return true;
      }
      return false;
    }

    private static bool IsInsideStructureAccent(
        List<StructuralAccent> accents, Rectangle bounds) {
      foreach (StructuralAccent accent in accents) {
        if (accent.Kind != 6 && accent.Bounds.Contains(bounds)) return true;
      }
      return false;
    }

    private static void AddStructureAccent(List<StructuralAccent> accents,
        HashSet<string> keys, int kind, Rectangle bounds) {
      if (accents.Count >= 48 || bounds.Width < 1 || bounds.Height < 1) return;
      StructuralAccent accent = new StructuralAccent(kind, bounds);
      if (keys.Add(accent.Key)) accents.Add(accent);
    }

    private static StructureSnapshot ReadStructure(
        IntPtr targetWindow, RECT targetRectangle, int dpi) {
      System.Windows.Automation.AutomationElement root =
        System.Windows.Automation.AutomationElement.FromHandle(targetWindow);
      if (root == null) throw new InvalidOperationException();
      System.Windows.Automation.TreeWalker walker =
        System.Windows.Automation.TreeWalker.ControlViewWalker;
      List<RawStructureCandidate> raw = new List<RawStructureCandidate>();
      int elementCount = 0;
      VisitStructure(root, walker, 0, ref elementCount, raw);
      int targetWidth = targetRectangle.Right - targetRectangle.Left;
      int targetHeight = targetRectangle.Bottom - targetRectangle.Top;
      float scale = Math.Max(1.0f, dpi / 96.0f);
      List<RawStructureCandidate> local = new List<RawStructureCandidate>();
      foreach (RawStructureCandidate candidate in raw) {
        Rectangle bounds = new Rectangle(
          candidate.Bounds.X - targetRectangle.Left,
          candidate.Bounds.Y - targetRectangle.Top,
          candidate.Bounds.Width, candidate.Bounds.Height);
        if (bounds.Left < 0 || bounds.Top < 0
            || bounds.Right > targetWidth + 2 || bounds.Bottom > targetHeight + 2) {
          continue;
        }
        local.Add(new RawStructureCandidate(candidate.Kind, bounds));
      }
      List<StructuralAccent> accents = new List<StructuralAccent>();
      HashSet<string> keys = new HashSet<string>(StringComparer.Ordinal);
      int listCount = 0;
      foreach (RawStructureCandidate candidate in local) {
        if (candidate.Kind != 8) continue;
        double x = candidate.Bounds.X / scale;
        double y = candidate.Bounds.Y / scale;
        double width = candidate.Bounds.Width / scale;
        double height = candidate.Bounds.Height / scale;
        if (x >= 300 && y >= 100 && width >= 300 && width <= 760
            && height >= 48 && height <= 320) {
          AddStructureAccent(accents, keys, 8, candidate.Bounds);
          listCount += 1;
          if (listCount >= 4) break;
        }
      }
      foreach (RawStructureCandidate candidate in local) {
        if (candidate.Kind != 2) continue;
        double width = candidate.Bounds.Width / scale;
        double height = candidate.Bounds.Height / scale;
        if (width >= 200 && height >= 32 && height <= 100) {
          AddStructureAccent(accents, keys, 2, candidate.Bounds);
        }
      }
      foreach (RawStructureCandidate candidate in local) {
        if (candidate.Kind != 5) continue;
        double x = candidate.Bounds.X / scale;
        double y = candidate.Bounds.Y / scale;
        double width = candidate.Bounds.Width / scale;
        double height = candidate.Bounds.Height / scale;
        double targetLogicalHeight = targetHeight / scale;
        if (x >= 280 && width >= 360 && height >= 48 && height <= 150
            && (y < 190 || y > targetLogicalHeight - 220)) {
          AddStructureAccent(accents, keys, 5, candidate.Bounds);
        }
      }
      foreach (RawStructureCandidate candidate in local) {
        if (candidate.Kind != 3 && candidate.Kind != 4) continue;
        double width = candidate.Bounds.Width / scale;
        double height = candidate.Bounds.Height / scale;
        if (width >= 40 && width <= 240 && height >= 20 && height <= 80) {
          AddStructureAccent(accents, keys, candidate.Kind, candidate.Bounds);
        }
      }
      foreach (RawStructureCandidate candidate in local) {
        if (candidate.Kind != 1 || ContainsAccent(accents, 2, candidate.Bounds)) continue;
        double x = candidate.Bounds.X / scale;
        double y = candidate.Bounds.Y / scale;
        double width = candidate.Bounds.Width / scale;
        double height = candidate.Bounds.Height / scale;
        bool sidebar = x < 300 && width >= 100;
        bool mainControl = x >= 300 && width <= 300;
        if (y >= 40 && width >= 56 && height >= 20 && height <= 64
            && (sidebar || mainControl)) {
          AddStructureAccent(accents, keys, 1, candidate.Bounds);
        }
      }
      int imageCount = 0;
      foreach (RawStructureCandidate candidate in local) {
        if (candidate.Kind != 7) continue;
        double x = candidate.Bounds.X / scale;
        double width = candidate.Bounds.Width / scale;
        double height = candidate.Bounds.Height / scale;
        double ratio = width / Math.Max(1.0, height);
        if (x < 320 && width >= 12 && width <= 48
            && height >= 12 && height <= 48 && ratio >= 0.72 && ratio <= 1.38) {
          AddStructureAccent(accents, keys, 7, candidate.Bounds);
          imageCount += 1;
          if (imageCount >= 10) break;
        }
      }
      int headingCount = 0;
      foreach (RawStructureCandidate candidate in local) {
        if (candidate.Kind != 6 || IsInsideStructureAccent(accents, candidate.Bounds)) {
          continue;
        }
        double x = candidate.Bounds.X / scale;
        double y = candidate.Bounds.Y / scale;
        double width = candidate.Bounds.Width / scale;
        double height = candidate.Bounds.Height / scale;
        if (x >= 300 && y >= 50 && width >= 32 && width <= 480
            && height >= 18 && height <= 54) {
          AddStructureAccent(accents, keys, 6, candidate.Bounds);
          headingCount += 1;
          if (headingCount >= 8) break;
        }
      }
      int sidebarRight = Math.Min(targetWidth,
        Math.Max((int)Math.Round(220 * scale),
          (int)Math.Round(290 * scale)));
      int detectedSidebarRight = 0;
      foreach (RawStructureCandidate candidate in local) {
        if (candidate.Kind != 1 && candidate.Kind != 2
            && candidate.Kind != 7 && candidate.Kind != 8) continue;
        double x = candidate.Bounds.X / scale;
        double right = candidate.Bounds.Right / scale;
        double width = candidate.Bounds.Width / scale;
        if (x < 300 && right >= 180 && right <= 330 && width >= 40) {
          detectedSidebarRight = Math.Max(
            detectedSidebarRight, candidate.Bounds.Right);
        }
      }
      if (detectedSidebarRight > 0) {
        sidebarRight = detectedSidebarRight
          + Math.Max(4, (int)Math.Round(8 * scale));
        sidebarRight = Math.Max((int)Math.Round(220 * scale),
          Math.Min((int)Math.Round(320 * scale), sidebarRight));
      }
      sidebarRight = Math.Min(targetWidth, sidebarRight);
      Rectangle sidebarBounds = new Rectangle(
        0, 0, Math.Max(1, sidebarRight), Math.Max(1, targetHeight));

      Rectangle promptBounds = Rectangle.Empty;
      long promptScore = Int64.MinValue;
      foreach (RawStructureCandidate candidate in local) {
        if (candidate.Kind != 5) continue;
        double x = candidate.Bounds.X / scale;
        double y = candidate.Bounds.Y / scale;
        double width = candidate.Bounds.Width / scale;
        double height = candidate.Bounds.Height / scale;
        double targetLogicalHeight = targetHeight / scale;
        if (x < sidebarRight / scale - 12 || width < 300
            || height < 40 || height > 150
            || y < targetLogicalHeight - 180
            || candidate.Bounds.Right > targetWidth + 2) continue;
        long score = (long)candidate.Bounds.Y * 8L + candidate.Bounds.Width;
        if (score > promptScore) {
          promptScore = score;
          promptBounds = candidate.Bounds;
        }
      }

      Rectangle greetingBounds = Rectangle.Empty;
      long greetingScore = Int64.MinValue;
      foreach (RawStructureCandidate candidate in local) {
        if (candidate.Kind != 6) continue;
        double x = candidate.Bounds.X / scale;
        double y = candidate.Bounds.Y / scale;
        double width = candidate.Bounds.Width / scale;
        double height = candidate.Bounds.Height / scale;
        if (x < sidebarRight / scale + 18 || y < 50 || y > 190
            || width < 110 || width > 620 || height < 18 || height > 72) {
          continue;
        }
        long score = (long)candidate.Bounds.Width * 8L
          - candidate.Bounds.Y - candidate.Bounds.X / 4;
        if (score > greetingScore) {
          greetingScore = score;
          greetingBounds = candidate.Bounds;
        }
      }

      int mainCollectionCount = 0;
      foreach (RawStructureCandidate candidate in local) {
        if (candidate.Kind != 8 && candidate.Kind != 2) continue;
        double x = candidate.Bounds.X / scale;
        double y = candidate.Bounds.Y / scale;
        double width = candidate.Bounds.Width / scale;
        if (x >= sidebarRight / scale + 12 && y >= 100 && width >= 280) {
          mainCollectionCount += 1;
        }
      }
      bool landingLayout = !greetingBounds.IsEmpty && mainCollectionCount == 0;
      accents.Sort(delegate(StructuralAccent left, StructuralAccent right) {
        int leftLayer = left.Kind == 8 ? 0 : left.Kind + 1;
        int rightLayer = right.Kind == 8 ? 0 : right.Kind + 1;
        int layer = leftLayer.CompareTo(rightLayer);
        if (layer != 0) return layer;
        int y = left.Bounds.Y.CompareTo(right.Bounds.Y);
        return y != 0 ? y : left.Bounds.X.CompareTo(right.Bounds.X);
      });
      return new StructureSnapshot(accents, elementCount,
        sidebarBounds, promptBounds, greetingBounds, landingLayout);
    }

    private void RefreshStructure(RECT targetRectangle, int dpi) {
      if (!structureAccentsEnabled || structureDisabled
          || DateTime.UtcNow < nextStructureRefresh) return;
      nextStructureRefresh = DateTime.UtcNow.AddMilliseconds(1500);
      try {
        StructureSnapshot snapshot = ReadStructure(target, targetRectangle, dpi);
        structureSnapshotCount += 1;
        structureElementCount = snapshot.ElementCount;
        if (!String.Equals(structureSignature, snapshot.Signature,
            StringComparison.Ordinal)) {
          structureSignature = snapshot.Signature;
          structureAccents = snapshot.Accents;
          structureSidebarBounds = snapshot.SidebarBounds;
          structurePromptBounds = snapshot.PromptBounds;
          structureGreetingBounds = snapshot.GreetingBounds;
          structureLandingLayout = snapshot.LandingLayout;
          DropSurface();
        }
      } catch {
        structureFailureCount += 1;
        if (structureFailureCount >= 3) {
          structureDisabled = true;
          if (structureAccents.Length > 0
              || !structureSidebarBounds.IsEmpty
              || !structurePromptBounds.IsEmpty
              || !structureGreetingBounds.IsEmpty
              || structureLandingLayout) {
            structureAccents = new StructuralAccent[0];
            structureSidebarBounds = Rectangle.Empty;
            structurePromptBounds = Rectangle.Empty;
            structureGreetingBounds = Rectangle.Empty;
            structureLandingLayout = false;
            structureSignature = String.Empty;
            DropSurface();
          }
        }
      }
    }

    private void RefreshPresentation() {
      if (deadlineEnabled && DateTime.UtcNow >= deadline) {
        Close();
        return;
      }
      uint currentProcessId;
      if (!IsWindow(target)
          || GetWindowThreadProcessId(target, out currentProcessId) == 0
          || currentProcessId != targetProcessId) {
        targetClosed = true;
        Close();
        return;
      }
      if (!IsWindowVisible(target) || IsIconic(target) || !TargetIsForeground()) {
        HideAll();
        return;
      }
      RECT rectangle;
      if (!GetWindowRect(target, out rectangle)) {
        HideAll();
        return;
      }
      int width = rectangle.Right - rectangle.Left;
      int height = rectangle.Bottom - rectangle.Top;
      if (width < 480 || height < 320) {
        HideAll();
        return;
      }
      int dpi = (int)GetDpiForWindow(target);
      if (dpi <= 0) dpi = 96;
      bool nextEffectiveDark = EffectiveDarkAppearance(appearance);
      if (nextEffectiveDark != effectiveDark) {
        effectiveDark = nextEffectiveDark;
        DropSurface();
      }
      if (rail != null && rail.PlaceAndShow(rectangle.Left, rectangle.Top,
          rectangle.Right, rectangle.Bottom, dpi)) {
        controlPresentCount += 1;
      }
      workHubPanel.KeepAbovePresentation();
      if (originalLook) {
        gpuColorFilter.HideFilter();
        colorFilter.HideFilter();
        HidePresentation();
        return;
      }
      Color[] filterPrimaries = effectiveDark ? darkPrimaries : lightPrimaries;
      Color[] filterSecondaries = effectiveDark ? darkSecondaries : lightSecondaries;
      Color[] filterTertiaries = effectiveDark ? darkTertiaries : lightTertiaries;
      Color[] filterHighlights = effectiveDark ? darkHighlights : lightHighlights;
      Color[] filterFocuses = effectiveDark ? darkFocuses : lightFocuses;
      Color[] filterAccentTexts = effectiveDark ? darkAccentTexts : lightAccentTexts;
      Color[] filterSidebarTexts = effectiveDark ? darkSidebarTexts : lightSidebarTexts;
      Color[] filterSidebarTextMuted = effectiveDark
        ? darkSidebarTextMuted : lightSidebarTextMuted;
      Color[] filterTextSecondaries = effectiveDark
        ? darkTextSecondaries : lightTextSecondaries;
      Color[] filterTextMuted = effectiveDark ? darkTextMuted : lightTextMuted;
      Color[] filterSurfaces = effectiveDark ? darkSurfaces : lightSurfaces;
      Color[] filterRaisedSurfaces = effectiveDark
        ? darkRaisedSurfaces : lightRaisedSurfaces;
      Color[] filterCanvases = effectiveDark ? darkCanvases : lightCanvases;
      double[] filterSurfaceAlphas = effectiveDark
        ? darkSurfaceAlphas : lightSurfaceAlphas;
      double[] filterSidebarAlphas = effectiveDark
        ? darkSidebarAlphas : lightSidebarAlphas;
      ThemeComposition[] filterCompositions = effectiveDark
        ? darkCompositions : lightCompositions;
      RefreshStructure(rectangle, dpi);
      ThemeComposition filterComposition = filterCompositions[selectedThemeIndex];
      double filterSidebarRatio = structureSidebarBounds.IsEmpty
        ? 0.29 : Math.Max(0.10, Math.Min(0.46,
            structureSidebarBounds.Width / (double)Math.Max(1, width)));
      double filterTitleRatio = Math.Max(0.02, Math.Min(0.20,
        Math.Max(40.0, 48.0 * Math.Max(1.0, dpi / 96.0))
          / Math.Max(1.0, height)));
      bool wideGreeting = filterComposition.UsesWideGreeting(width, dpi);
      Rectangle resolvedGreetingBounds = structureGreetingBounds;
      IntPtr[] filterExclusions = rail == null
        ? new IntPtr[] { Handle }
        : new IntPtr[] { Handle, rail.Handle };
      bool gpuFilterApplied = gpuColorFilter.Apply(
        filterPrimaries[selectedThemeIndex], filterFocuses[selectedThemeIndex],
        filterAccentTexts[selectedThemeIndex], filterSecondaries[selectedThemeIndex],
        filterTertiaries[selectedThemeIndex], filterSidebarTexts[selectedThemeIndex],
        filterSidebarTextMuted[selectedThemeIndex], filterHighlights[selectedThemeIndex],
        filterTextSecondaries[selectedThemeIndex], filterTextMuted[selectedThemeIndex],
        filterSurfaces[selectedThemeIndex], filterRaisedSurfaces[selectedThemeIndex],
        filterCanvases[selectedThemeIndex], filterSurfaceAlphas[selectedThemeIndex],
        filterSidebarAlphas[selectedThemeIndex], effectiveDark, sourceDark,
        filterComposition, artworkEnabled, structureLandingLayout,
        filterSidebarRatio, filterTitleRatio, structureGreetingBounds,
        resolvedGreetingBounds, width, height, dpi, wideGreeting);
      if (gpuFilterApplied) {
        colorFilter.HideFilter();
      } else {
        colorFilter.PlaceAndShow(rectangle.Left, rectangle.Top,
          rectangle.Right, rectangle.Bottom,
          filterPrimaries[selectedThemeIndex], filterExclusions);
      }
      int margin = OverlayMargin(dpi, themeBlurs[selectedThemeIndex]);
      if (surface == null || surfaceTargetWidth != width || surfaceTargetHeight != height
          || surfaceDpi != dpi || surfaceThemeIndex != selectedThemeIndex) {
        DropSurface();
        Color[] materialPrimaries = effectiveDark ? darkPrimaries : lightPrimaries;
        Color[] materialSecondaries = effectiveDark ? darkSecondaries : lightSecondaries;
        Color[] materialTertiaries = effectiveDark ? darkTertiaries : lightTertiaries;
        Color[] materialHighlights = effectiveDark ? darkHighlights : lightHighlights;
        Color[] materialSurfaces = effectiveDark ? darkSurfaces : lightSurfaces;
        Color[] materialRaisedSurfaces = effectiveDark
          ? darkRaisedSurfaces : lightRaisedSurfaces;
        ThemeComposition[] materialCompositions = effectiveDark
          ? darkCompositions : lightCompositions;
        double[] materialSurfaceAlphas = effectiveDark
          ? darkSurfaceAlphas : lightSurfaceAlphas;
        double[] materialSidebarAlphas = effectiveDark
          ? darkSidebarAlphas : lightSidebarAlphas;
        string[] materialWordmarkPaths = effectiveDark
          ? darkWordmarkPaths : lightWordmarkPaths;
        bool artworkRendered;
        bool backgroundArtworkRendered;
        bool featureArtworkRendered;
        bool identityAttempted;
        bool identityRendered;
        bool sidebarRendered;
        bool promptRendered;
        bool greetingRendered;
        ThemeComposition composition = materialCompositions[selectedThemeIndex];
        surface = BuildSurface(width, height, dpi,
          materialPrimaries[selectedThemeIndex], materialSecondaries[selectedThemeIndex],
          materialTertiaries[selectedThemeIndex], materialHighlights[selectedThemeIndex],
          materialSurfaces[selectedThemeIndex], materialRaisedSurfaces[selectedThemeIndex],
          markPaths[selectedThemeIndex], composition,
          materialWordmarkPaths[selectedThemeIndex], shellTintEnabled,
          artworkEnabled && !gpuFilterApplied, identityEnabled, structureAccents,
          structureSidebarBounds, structurePromptBounds,
          gpuFilterApplied ? resolvedGreetingBounds : structureGreetingBounds,
          structureLandingLayout, wideGreeting,
          themeBlurs[selectedThemeIndex],
          materialSurfaceAlphas[selectedThemeIndex],
          materialSidebarAlphas[selectedThemeIndex],
          out artworkRendered,
          out backgroundArtworkRendered, out featureArtworkRendered,
          out identityAttempted, out identityRendered,
          out sidebarRendered, out promptRendered, out greetingRendered);
        if (gpuFilterApplied && artworkEnabled) {
          backgroundArtworkRendered = !String.IsNullOrWhiteSpace(
            composition.BackgroundPath);
          featureArtworkRendered = !structureGreetingBounds.IsEmpty
            && !String.IsNullOrWhiteSpace(composition.FeaturePath);
          artworkRendered = backgroundArtworkRendered || featureArtworkRendered;
        }
        if (artworkRendered) artworkRenderCount += 1;
        else if (artworkEnabled
            && (!String.IsNullOrWhiteSpace(composition.BackgroundPath)
              || (!String.IsNullOrWhiteSpace(composition.FeaturePath)
                && structureLandingLayout))) {
          artworkFailureCount += 1;
        }
        if (backgroundArtworkRendered) backgroundArtworkRenderCount += 1;
        if (featureArtworkRendered) featureArtworkRenderCount += 1;
        if (identityRendered) identityRenderCount += 1;
        else if (identityAttempted) identityFailureCount += 1;
        if (sidebarRendered) sidebarCompositionCount += 1;
        if (promptRendered) promptCompositionCount += 1;
        if (greetingRendered) greetingCompositionCount += 1;
        surfaceDpi = dpi;
        surfaceTargetWidth = width;
        surfaceTargetHeight = height;
        surfaceThemeIndex = selectedThemeIndex;
        surfaceBuildCount += 1;
      }
      if (Present(surface, rectangle.Left - margin, rectangle.Top - margin)) {
        SetWindowPos(Handle, new IntPtr(-1), 0, 0, 0, 0,
          SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW);
        presentCount += 1;
        presentationShown = true;
        if (rail != null) {
          rail.PlaceAndShow(rectangle.Left, rectangle.Top,
            rectangle.Right, rectangle.Bottom, dpi);
        }
        workHubPanel.KeepAbovePresentation();
      }
    }

    private static int OverlayMargin(int dpi, int themeBlur) {
      float scale = Math.Max(1.0f, dpi / 96.0f);
      return Math.Max(12, (int)Math.Round((12 + themeBlur / 3.0) * scale));
    }

    private static string NormalizeAppearance(string value) {
      return value == "light" || value == "dark" ? value : "system";
    }

    private static bool EffectiveDarkAppearance(string value) {
      if (value == "dark") return true;
      if (value == "light") return false;
      try {
        object setting = Registry.GetValue(
          @"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize",
          "AppsUseLightTheme", 1);
        return Convert.ToInt32(setting) == 0;
      } catch {
        return false;
      }
    }

    private void HidePresentation() {
      if (!presentationShown) return;
      ShowWindow(Handle, SW_HIDE);
      presentationShown = false;
      hiddenTransitions += 1;
    }

    private void HideAll() {
      colorFilter.HideFilter();
      HidePresentation();
      if (rail != null) rail.HideControl();
    }

    private static Bitmap LoadArtwork(string path) {
      using (FileStream stream = File.OpenRead(path)) {
        System.Windows.Media.Imaging.BitmapDecoder decoder =
          System.Windows.Media.Imaging.BitmapDecoder.Create(stream,
            System.Windows.Media.Imaging.BitmapCreateOptions.PreservePixelFormat,
            System.Windows.Media.Imaging.BitmapCacheOption.OnLoad);
        if (decoder.Frames.Count != 1) throw new InvalidDataException();
        System.Windows.Media.Imaging.BitmapSource source = decoder.Frames[0];
        if (source.PixelWidth < 1 || source.PixelHeight < 1
            || source.PixelWidth > 4096 || source.PixelHeight > 4096) {
          throw new InvalidDataException();
        }
        System.Windows.Media.Imaging.FormatConvertedBitmap converted =
          new System.Windows.Media.Imaging.FormatConvertedBitmap(source,
            System.Windows.Media.PixelFormats.Bgra32, null, 0);
        int stride = checked(converted.PixelWidth * 4);
        byte[] pixels = new byte[checked(stride * converted.PixelHeight)];
        converted.CopyPixels(pixels, stride, 0);
        Bitmap bitmap = new Bitmap(converted.PixelWidth, converted.PixelHeight,
          PixelFormat.Format32bppArgb);
        BitmapData data = bitmap.LockBits(
          new Rectangle(0, 0, bitmap.Width, bitmap.Height),
          ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        try {
          Marshal.Copy(pixels, 0, data.Scan0, pixels.Length);
        } finally {
          bitmap.UnlockBits(data);
        }
        return bitmap;
      }
    }

    private static bool DrawArtworkLayer(Graphics graphics, Rectangle bounds,
        string artworkPath, int position, float opacity, bool cover,
        double maximumWidthRatio, double maximumHeightRatio) {
      if (bounds.Width < 1 || bounds.Height < 1
          || String.IsNullOrWhiteSpace(artworkPath)) return false;
      try {
        using (Bitmap artwork = LoadArtwork(artworkPath))
        using (ImageAttributes attributes = new ImageAttributes()) {
          ColorMatrix alpha = new ColorMatrix();
          alpha.Matrix33 = Math.Max(0.0f, Math.Min(0.55f, opacity));
          attributes.SetColorMatrix(alpha, ColorMatrixFlag.Default,
            ColorAdjustType.Bitmap);
          attributes.SetWrapMode(WrapMode.TileFlipXY);
          if (cover) {
            double fit = Math.Max(
              bounds.Width / (double)artwork.Width,
              bounds.Height / (double)artwork.Height);
            int sourceWidth = Math.Max(1,
              Math.Min(artwork.Width, (int)Math.Round(bounds.Width / fit)));
            int sourceHeight = Math.Max(1,
              Math.Min(artwork.Height, (int)Math.Round(bounds.Height / fit)));
            int sourceX = position == 1 || position == 2 || position == 3
              ? artwork.Width - sourceWidth
              : position == 4 ? 0 : (artwork.Width - sourceWidth) / 2;
            int sourceY = position == 3 ? 0
              : position == 2 || position == 4
                ? artwork.Height - sourceHeight
                : (artwork.Height - sourceHeight) / 2;
            graphics.DrawImage(artwork, bounds,
              Math.Max(0, sourceX), Math.Max(0, sourceY),
              sourceWidth, sourceHeight, GraphicsUnit.Pixel, attributes);
          } else {
            int maximumWidth = Math.Max(1,
              (int)Math.Round(bounds.Width * maximumWidthRatio));
            int maximumHeight = Math.Max(1,
              (int)Math.Round(bounds.Height * maximumHeightRatio));
            double fit = Math.Min(maximumWidth / (double)artwork.Width,
              maximumHeight / (double)artwork.Height);
            int drawWidth = Math.Max(1, (int)Math.Round(artwork.Width * fit));
            int drawHeight = Math.Max(1, (int)Math.Round(artwork.Height * fit));
            int drawX = position == 1 || position == 2 || position == 3
              ? bounds.Right - drawWidth
              : position == 4 ? bounds.Left
                : bounds.Left + (bounds.Width - drawWidth) / 2;
            int drawY = position == 3 ? bounds.Top
              : position == 2 || position == 4
                ? bounds.Bottom - drawHeight
                : bounds.Top + (bounds.Height - drawHeight) / 2;
            Rectangle destination = new Rectangle(
              drawX, drawY, drawWidth, drawHeight);
            graphics.DrawImage(artwork, destination,
              0, 0, artwork.Width, artwork.Height,
              GraphicsUnit.Pixel, attributes);
          }
          return true;
        }
      } catch {
        return false;
      }
    }

    private static bool DrawWordmark(Graphics graphics, Rectangle sidebarBounds,
        string wordmarkPath, float scale) {
      int wrapperHeight = (int)Math.Round(48 * scale);
      if (sidebarBounds.Width < (int)Math.Round(230 * scale)
          || sidebarBounds.Height < wrapperHeight
          || String.IsNullOrWhiteSpace(wordmarkPath)) return false;
      try {
        using (FileStream stream = File.OpenRead(wordmarkPath))
        using (Image wordmark = Image.FromStream(stream, true, true))
        using (ImageAttributes attributes = new ImageAttributes()) {
          int reservedControls = Math.Max(116, (int)Math.Round(116 * scale));
          int targetWidth = (int)Math.Round(160 * scale);
          int minimumWidth = (int)Math.Round(136 * scale);
          int availableWidth = sidebarBounds.Width - reservedControls
            - (int)Math.Round(16 * scale);
          int drawWidth = Math.Min(targetWidth, availableWidth);
          if (drawWidth < minimumWidth) return false;
          int drawHeight = Math.Max(1, (int)Math.Round(
            drawWidth * wordmark.Height / (double)wordmark.Width));
          Rectangle destination = new Rectangle(
            sidebarBounds.Right - drawWidth - (int)Math.Round(12 * scale),
            sidebarBounds.Top + (wrapperHeight - drawHeight) / 2,
            drawWidth, drawHeight);
          ColorMatrix alpha = new ColorMatrix();
          alpha.Matrix33 = 0.96f;
          attributes.SetColorMatrix(alpha, ColorMatrixFlag.Default,
            ColorAdjustType.Bitmap);
          graphics.CompositingQuality = CompositingQuality.HighQuality;
          graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
          graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
          graphics.DrawImage(wordmark, destination,
            0, 0, wordmark.Width, wordmark.Height,
            GraphicsUnit.Pixel, attributes);
          return true;
        }
      } catch {
        return false;
      }
    }

    private static bool DrawLauncherMark(Graphics graphics, Rectangle bounds,
        string launcherMarkPath, float opacity) {
      if (bounds.Width < 1 || bounds.Height < 1
          || String.IsNullOrWhiteSpace(launcherMarkPath)) return false;
      try {
        using (FileStream stream = File.OpenRead(launcherMarkPath))
        using (Image mark = Image.FromStream(stream, true, true))
        using (ImageAttributes attributes = new ImageAttributes()) {
          ColorMatrix alpha = new ColorMatrix();
          alpha.Matrix33 = Math.Max(0.0f, Math.Min(1.0f, opacity));
          attributes.SetColorMatrix(alpha, ColorMatrixFlag.Default,
            ColorAdjustType.Bitmap);
          graphics.DrawImage(mark, bounds, 0, 0, mark.Width, mark.Height,
            GraphicsUnit.Pixel, attributes);
          return true;
        }
      } catch {
        return false;
      }
    }

    private static GraphicsPath AccentRoundedRectangle(Rectangle bounds, int radius) {
      int safeRadius = Math.Max(1, Math.Min(radius,
        Math.Min(bounds.Width, bounds.Height) / 2));
      int diameter = Math.Max(2, safeRadius * 2);
      GraphicsPath path = new GraphicsPath();
      path.AddArc(bounds.Left, bounds.Top, diameter, diameter, 180, 90);
      path.AddArc(bounds.Right - diameter, bounds.Top, diameter, diameter, 270, 90);
      path.AddArc(bounds.Right - diameter, bounds.Bottom - diameter,
        diameter, diameter, 0, 90);
      path.AddArc(bounds.Left, bounds.Bottom - diameter,
        diameter, diameter, 90, 90);
      path.CloseFigure();
      return path;
    }

    private static bool DrawSidebarMaterial(Graphics graphics,
        Rectangle sidebarBounds, float scale,
        Color primaryColor, Color secondaryColor,
        Color sidebarColor, Color surfaceColor, double sidebarAlpha) {
      if (sidebarBounds.Width < 1 || sidebarBounds.Height < 1) return false;
      int fillAlpha = Math.Max(14, Math.Min(34,
        14 + (int)Math.Round((sidebarAlpha - 0.62) * 52.0)));
      using (LinearGradientBrush fill = new LinearGradientBrush(
          sidebarBounds, Color.FromArgb(fillAlpha, sidebarColor),
          Color.FromArgb(Math.Max(8, fillAlpha - 12), surfaceColor),
          LinearGradientMode.Horizontal)) {
        graphics.FillRectangle(fill, sidebarBounds);
      }
      int headerHeight = Math.Min(sidebarBounds.Height,
        Math.Max(42, (int)Math.Round(48 * scale)));
      Rectangle header = new Rectangle(sidebarBounds.Left, sidebarBounds.Top,
        sidebarBounds.Width, headerHeight);
      using (LinearGradientBrush headerFill = new LinearGradientBrush(
          header, Color.FromArgb(20, primaryColor),
          Color.FromArgb(6, surfaceColor), LinearGradientMode.Horizontal)) {
        graphics.FillRectangle(headerFill, header);
      }
      using (Pen divider = new Pen(Color.FromArgb(88, secondaryColor),
          Math.Max(1.0f, scale * 0.75f))) {
        graphics.DrawLine(divider, sidebarBounds.Right - 1, header.Bottom,
          sidebarBounds.Right - 1, sidebarBounds.Bottom);
      }
      return true;
    }

    private static Rectangle ResolvePromptBounds(int width, int height,
        int targetLeft, int targetTop, int edge, float scale,
        Rectangle sidebarBounds, Rectangle detectedPrompt,
        ThemeComposition composition) {
      int sidebarRight = Math.Max(0, Math.Min(width - 1, sidebarBounds.Right));
      int mainLeft = targetLeft + sidebarRight;
      int mainRight = targetLeft + width;
      int mainWidth = Math.Max(1, mainRight - mainLeft);
      int inset = Math.Max(edge, (int)Math.Round(16 * scale));
      bool detected = !detectedPrompt.IsEmpty
        && detectedPrompt.Width >= (int)Math.Round(300 * scale)
        && detectedPrompt.Height >= (int)Math.Round(36 * scale)
        && detectedPrompt.Left >= sidebarRight
        && detectedPrompt.Top >= 0
        && detectedPrompt.Right <= width
        && detectedPrompt.Bottom <= height;
      if (detected) {
        return new Rectangle(targetLeft + detectedPrompt.X,
          targetTop + detectedPrompt.Y,
          detectedPrompt.Width, detectedPrompt.Height);
      }
      int available = Math.Max(1, mainWidth - inset * 2);
      int desired = (int)Math.Round(mainWidth * composition.PromptWidthRatio);
      desired = Math.Min(available,
        Math.Max((int)Math.Round(280 * scale), desired));
      int center = mainLeft + mainWidth / 2
        + (int)Math.Round(mainWidth * composition.PromptOffsetXRatio);
      int left = Math.Max(mainLeft + inset,
        Math.Min(mainRight - inset - desired, center - desired / 2));
      int nativeHeight = Math.Max(46, (int)Math.Round(56 * scale));
      int heightEnvelope = Math.Max((int)Math.Round(56 * scale),
        Math.Min((int)Math.Round(120 * scale),
          (int)Math.Round(height * 0.18)));
      int promptHeight = Math.Min(nativeHeight, heightEnvelope);
      int top = targetTop + height - promptHeight
        - Math.Max(28, (int)Math.Round(36 * scale));
      top += (int)Math.Round(height * composition.PromptOffsetYRatio);
      top = Math.Max(targetTop + inset,
        Math.Min(targetTop + height - promptHeight - inset, top));
      return new Rectangle(left, top, desired, promptHeight);
    }

    private static Rectangle ResolveGreetingBounds(int width, int height,
        int dpi, Rectangle sidebarBounds, Rectangle detectedGreeting,
        ThemeComposition composition, bool wideGreeting) {
      if (detectedGreeting.IsEmpty) return Rectangle.Empty;
      /* Authored greeting geometry remains in ThemeComposition for Aura Web
         and Studio editing. Desktop keeps the live native pixels and their
         hit target at one sharp, identical rectangle. */
      return detectedGreeting.Left >= 0 && detectedGreeting.Top >= 0
          && detectedGreeting.Right <= width
          && detectedGreeting.Bottom <= height
        ? detectedGreeting : Rectangle.Empty;
    }

    private static bool DrawPromptMaterial(Graphics graphics, Rectangle bounds,
        float scale, Color primaryColor, Color secondaryColor,
        Color surfaceColor, Color raisedSurfaceColor, double surfaceAlpha,
        ThemeComposition composition) {
      if (bounds.Width < 1 || bounds.Height < 1) return false;
      int radius = Math.Max(3,
        (int)Math.Round(composition.ComposerRadius * scale));
      int expansion = Math.Max(2, (int)Math.Round(3 * scale));
      Rectangle glowBounds = Rectangle.Inflate(bounds, expansion, expansion);
      using (GraphicsPath glow = AccentRoundedRectangle(glowBounds, radius + expansion))
      using (Pen glowPen = new Pen(Color.FromArgb(24, primaryColor),
          Math.Max(1.0f, 1.6f * scale))) {
        graphics.DrawPath(glowPen, glow);
      }
      int fillAlpha = Math.Max(12, Math.Min(26,
        12 + (int)Math.Round(surfaceAlpha * 14.0)));
      using (GraphicsPath shape = AccentRoundedRectangle(bounds, radius))
      using (SolidBrush fill = new SolidBrush(
          Color.FromArgb(fillAlpha, raisedSurfaceColor)))
      using (Pen border = new Pen(Color.FromArgb(184, secondaryColor),
          Math.Max(1.0f, composition.BorderWidth * 0.85f * scale))) {
        graphics.FillPath(fill, shape);
        graphics.DrawPath(border, shape);
      }
      Rectangle insetBounds = Rectangle.Inflate(bounds,
        -Math.Max(1, (int)Math.Round(scale)),
        -Math.Max(1, (int)Math.Round(scale)));
      if (insetBounds.Width > 2 && insetBounds.Height > 2) {
        using (GraphicsPath inset = AccentRoundedRectangle(
            insetBounds, Math.Max(2, radius - 1)))
        using (Pen highlight = new Pen(Color.FromArgb(72, primaryColor),
            Math.Max(1.0f, 0.7f * scale))) {
          graphics.DrawPath(highlight, inset);
        }
      }
      return true;
    }

    private static bool DrawGreetingTreatment(Graphics graphics,
        Rectangle greetingBounds, bool landingLayout, float scale,
        string launcherMarkPath, Color primaryColor,
        Color highlightColor, Color surfaceColor,
        ThemeComposition composition, bool wideGreeting) {
      if (greetingBounds.IsEmpty) return false;
      Color greetingColor = composition.ResolvedGreetingColorRole(wideGreeting) == 1
        ? primaryColor : highlightColor;
      int horizontal = Math.Max(16, (int)Math.Round(22 * scale));
      int vertical = Math.Max(10, (int)Math.Round(14 * scale));
      Rectangle stage = Rectangle.Inflate(greetingBounds, horizontal, vertical);
      if (composition.ResolvedGreetingDecoration(wideGreeting) == 1) {
        using (GraphicsPath glowPath = new GraphicsPath()) {
          glowPath.AddEllipse(stage);
          using (PathGradientBrush glow = new PathGradientBrush(glowPath)) {
            glow.CenterColor = Color.FromArgb(42, primaryColor);
            glow.SurroundColors = new Color[] { Color.Transparent };
            graphics.FillPath(glow, glowPath);
          }
        }
      } else if (composition.ResolvedGreetingDecoration(wideGreeting) == 2) {
        int y = greetingBounds.Bottom + Math.Max(2, (int)Math.Round(4 * scale));
        int lineWidth = Math.Min(greetingBounds.Width,
          Math.Max(72, (int)Math.Round(128 * scale)));
        using (Pen line = new Pen(Color.FromArgb(154, greetingColor),
            Math.Max(1.0f, 0.8f * scale))) {
          graphics.DrawLine(line, greetingBounds.Left, y,
            greetingBounds.Left + lineWidth, y);
        }
      }
      int markSize = Math.Max((int)Math.Round(28 * scale),
        Math.Min((int)Math.Round(44 * scale),
          (int)Math.Round(Math.Max(greetingBounds.Height,
            composition.ResolvedGreetingFontSize(wideGreeting) * scale)
              * composition.ResolvedGreetingMarkScale(wideGreeting))));
      Rectangle markBounds = new Rectangle(
        greetingBounds.Left - markSize - Math.Max(5, (int)Math.Round(7 * scale)),
        greetingBounds.Top + (greetingBounds.Height - markSize) / 2,
        markSize, markSize);
      if (composition.ResolvedGreetingMarkSource(wideGreeting) == 1) {
        int plateExpansion = Math.Max(2, (int)Math.Round(3 * scale));
        Rectangle plate = Rectangle.Inflate(
          markBounds, plateExpansion, plateExpansion);
        using (SolidBrush cover = new SolidBrush(Color.FromArgb(224, surfaceColor))) {
          graphics.FillEllipse(cover, plate);
        }
        using (Pen ring = new Pen(Color.FromArgb(112, greetingColor),
            Math.Max(1.0f, 0.8f * scale))) {
          graphics.DrawEllipse(ring, plate);
        }
        DrawLauncherMark(graphics, markBounds, launcherMarkPath, 0.98f);
      }
      return true;
    }

    private static void DrawStructureAccents(Graphics graphics,
        StructuralAccent[] accents, int targetLeft, int targetTop, float scale,
        Color primaryColor, Color secondaryColor, Color tertiaryColor,
        Color highlightColor, Color surfaceColor, Color raisedSurfaceColor,
        ThemeComposition composition, int sidebarRight) {
      if (accents == null) return;
      foreach (StructuralAccent accent in accents) {
        if (accent.Bounds.Left < sidebarRight) continue;
        int inset = Math.Max(1, (int)Math.Round(scale));
        Rectangle bounds = new Rectangle(
          targetLeft + accent.Bounds.X + inset,
          targetTop + accent.Bounds.Y + inset,
          Math.Max(1, accent.Bounds.Width - inset * 2),
          Math.Max(1, accent.Bounds.Height - inset * 2));
        if (accent.Kind == 5 || accent.Kind == 6) continue;
        if (accent.Kind == 8) {
          int containerRadius = Math.Max(2,
            (int)Math.Round((composition.CardRadius + 2) * scale));
          using (GraphicsPath container = AccentRoundedRectangle(
              bounds, containerRadius))
          using (SolidBrush fill = new SolidBrush(
              Color.FromArgb(7, surfaceColor)))
          using (Pen border = new Pen(Color.FromArgb(34, secondaryColor),
              Math.Max(1.0f, 0.8f * scale))) {
            graphics.FillPath(fill, container);
            graphics.DrawPath(border, container);
          }
          continue;
        }
        if (accent.Kind == 7) {
          int expansion = Math.Max(2, (int)Math.Round(2 * scale));
          Rectangle ringBounds = Rectangle.Inflate(bounds, expansion, expansion);
          int ringRadius = Math.Max(4,
            Math.Min(ringBounds.Width, ringBounds.Height) / 2);
          using (GraphicsPath ring = AccentRoundedRectangle(ringBounds, ringRadius))
          using (Pen glow = new Pen(Color.FromArgb(34, highlightColor),
              Math.Max(2.0f, 2.4f * scale)))
          using (Pen border = new Pen(Color.FromArgb(122, primaryColor),
              Math.Max(1.0f, 0.9f * scale))) {
            graphics.DrawPath(glow, ring);
            graphics.DrawPath(border, ring);
          }
          continue;
        }
        int logicalRadius = accent.Kind == 2
          ? composition.CardRadius
          : composition.ControlRadius;
        int radius = Math.Max(2, (int)Math.Round(logicalRadius * scale));
        Color fillColor = accent.Kind == 2
          ? Color.FromArgb(10, raisedSurfaceColor)
          : accent.Kind == 3 || accent.Kind == 4
            ? Color.FromArgb(8, primaryColor)
            : Color.FromArgb(4, surfaceColor);
        Color borderColor = accent.Kind == 2
          ? Color.FromArgb(42, secondaryColor)
          : accent.Kind == 3 || accent.Kind == 4
            ? Color.FromArgb(50, primaryColor)
            : Color.FromArgb(22, primaryColor);
        using (GraphicsPath shape = AccentRoundedRectangle(bounds, radius))
        using (SolidBrush fill = new SolidBrush(fillColor))
        using (Pen border = new Pen(borderColor, Math.Max(1.0f, 0.85f * scale))) {
          graphics.FillPath(fill, shape);
          graphics.DrawPath(border, shape);
        }
        if (accent.Kind == 1 && accent.Bounds.X / scale < 300) {
          int lineInset = Math.Max(5, (int)Math.Round(8 * scale));
          using (Pen marker = new Pen(Color.FromArgb(44, primaryColor),
              Math.Max(1.0f, 1.2f * scale))) {
            graphics.DrawLine(marker, bounds.Left + inset,
              bounds.Top + lineInset, bounds.Left + inset,
              bounds.Bottom - lineInset);
          }
        }
      }
    }

    private static Bitmap BuildSurface(int width, int height, int dpi,
        Color primaryColor, Color secondaryColor, Color tertiaryColor,
        Color highlightColor, Color surfaceColor, Color raisedSurfaceColor,
        string launcherMarkPath, ThemeComposition composition,
        string wordmarkPath, bool applyShellTint, bool applyArtwork,
        bool applyIdentity, StructuralAccent[] structureAccents,
        Rectangle detectedSidebar, Rectangle detectedPrompt,
        Rectangle visualGreeting, bool landingLayout, bool wideGreeting,
        int themeBlur, double surfaceAlpha, double sidebarAlpha,
        out bool artworkRendered,
        out bool backgroundArtworkRendered, out bool featureArtworkRendered,
        out bool identityAttempted, out bool identityRendered,
        out bool sidebarRendered, out bool promptRendered,
        out bool greetingRendered) {
      float scale = Math.Max(1.0f, dpi / 96.0f);
      int margin = OverlayMargin(dpi, themeBlur);
      int canvasWidth = width + margin * 2;
      int canvasHeight = height + margin * 2;
      Bitmap bitmap = new Bitmap(canvasWidth, canvasHeight, PixelFormat.Format32bppArgb);
      int edge = Math.Max(2, (int)Math.Round(3 * scale));
      int glow = Math.Max(edge + 3,
        (int)Math.Round((5 + themeBlur * 0.18) * scale));
      Color primary = Color.FromArgb(246, primaryColor);
      Color secondary = Color.FromArgb(238, secondaryColor);
      Color tertiary = Color.FromArgb(230, tertiaryColor);
      using (Graphics graphics = Graphics.FromImage(bitmap)) {
        graphics.Clear(Color.Transparent);
        graphics.SmoothingMode = SmoothingMode.AntiAlias;
        graphics.CompositingMode = CompositingMode.SourceOver;

        int targetLeft = margin;
        int targetTop = margin;
        int targetRight = margin + width - 1;
        int targetBottom = margin + height - 1;
        int titleHeight = Math.Min(height - edge * 2,
          Math.Max(40, (int)Math.Round(48 * scale)));
        Rectangle localSidebar = detectedSidebar.IsEmpty
          ? new Rectangle(0, 0,
              Math.Min(width, Math.Max((int)Math.Round(220 * scale),
                (int)Math.Round(290 * scale))), height)
          : new Rectangle(0, 0,
              Math.Min(width, detectedSidebar.Width), height);
        Rectangle sidebarBounds = new Rectangle(
          targetLeft + edge, targetTop + edge,
          Math.Max(1, localSidebar.Width - edge),
          Math.Max(1, height - edge * 2));
        Rectangle artworkBounds = new Rectangle(
          targetLeft + localSidebar.Width,
          targetTop + titleHeight,
          Math.Max(1, width - localSidebar.Width - edge),
          Math.Max(1, height - titleHeight - edge));
        using (SolidBrush mainMaterial = new SolidBrush(
            Color.FromArgb(12, surfaceColor))) {
          graphics.FillRectangle(mainMaterial, artworkBounds);
        }
        float backgroundOpacity = Math.Min(0.36f,
          0.16f + composition.BackgroundOpacity * 0.20f);
        backgroundArtworkRendered = applyArtwork
          && DrawArtworkLayer(graphics, artworkBounds,
            composition.BackgroundPath, composition.BackgroundPosition,
            backgroundOpacity, true, 1.0, 1.0);
        float featureOpacity = composition.FeatureRole == 2
          ? Math.Min(0.32f, 0.12f + composition.FeatureOpacity * 0.30f)
          : Math.Min(0.42f, 0.12f + composition.FeatureOpacity * 0.32f);
        double featureMaximumWidth = composition.ResolvedFeatureMaximumWidthRatio(
          width, height, dpi, localSidebar.Width / (double)Math.Max(1, width),
          titleHeight / (double)Math.Max(1, height));
        double featureMaximumHeight = composition.ResolvedFeatureMaximumHeightRatio(
          width, height, dpi, localSidebar.Width / (double)Math.Max(1, width),
          titleHeight / (double)Math.Max(1, height));
        featureArtworkRendered = applyArtwork && landingLayout
          && DrawArtworkLayer(graphics, artworkBounds,
            composition.FeaturePath, composition.FeaturePosition,
            featureOpacity, false,
            featureMaximumWidth, featureMaximumHeight);
        artworkRendered = backgroundArtworkRendered || featureArtworkRendered;
        sidebarRendered = applyShellTint && DrawSidebarMaterial(
          graphics, sidebarBounds, scale, primaryColor, secondaryColor,
          tertiaryColor, surfaceColor, sidebarAlpha);
        DrawStructureAccents(graphics, structureAccents,
          targetLeft, targetTop, scale, primaryColor, secondaryColor,
          tertiaryColor, highlightColor, surfaceColor, raisedSurfaceColor,
          composition, localSidebar.Right);
        Rectangle promptBounds = ResolvePromptBounds(
          width, height, targetLeft, targetTop, edge, scale,
          localSidebar, detectedPrompt, composition);
        promptRendered = applyShellTint && DrawPromptMaterial(
          graphics, promptBounds, scale, primaryColor, secondaryColor,
          surfaceColor, raisedSurfaceColor, surfaceAlpha, composition);
        Rectangle greetingBounds = visualGreeting.IsEmpty
          ? Rectangle.Empty
          : new Rectangle(targetLeft + visualGreeting.X,
              targetTop + visualGreeting.Y,
              visualGreeting.Width, visualGreeting.Height);
        greetingRendered = applyIdentity && DrawGreetingTreatment(
          graphics, greetingBounds, landingLayout, scale,
          launcherMarkPath, primaryColor, highlightColor,
          surfaceColor, composition, wideGreeting);
        identityAttempted = applyIdentity
          && !String.IsNullOrWhiteSpace(wordmarkPath)
          && width >= (int)Math.Round(760 * scale);
        identityRendered = identityAttempted
          && DrawWordmark(graphics, sidebarBounds, wordmarkPath, scale);
        for (int spread = margin; spread >= 1; spread--) {
          int alpha = 1 + ((margin - spread) * 15 / Math.Max(1, margin));
          using (Pen halo = new Pen(Color.FromArgb(alpha, secondaryColor), 1.0f)) {
            graphics.DrawRectangle(halo,
              targetLeft - spread, targetTop - spread,
              Math.Max(1, width + spread * 2 - 1),
              Math.Max(1, height + spread * 2 - 1));
          }
        }

        ColorBlend palette = new ColorBlend();
        palette.Colors = new Color[] { primary, secondary, tertiary, primary };
        palette.Positions = new float[] { 0.0f, 0.38f, 0.72f, 1.0f };
        using (LinearGradientBrush top = new LinearGradientBrush(
            new Rectangle(targetLeft, targetTop, width, edge), primary, tertiary,
            LinearGradientMode.Horizontal)) {
          top.InterpolationColors = palette;
          graphics.FillRectangle(top, targetLeft, targetTop, width, edge);
        }
        using (LinearGradientBrush bottom = new LinearGradientBrush(
            new Rectangle(targetLeft, targetBottom - edge + 1, width, edge),
            Color.FromArgb(176, primaryColor), Color.FromArgb(164, tertiaryColor),
            LinearGradientMode.Horizontal)) {
          bottom.InterpolationColors = palette;
          graphics.FillRectangle(bottom, targetLeft, targetBottom - edge + 1, width, edge);
        }
        using (LinearGradientBrush left = new LinearGradientBrush(
            new Rectangle(targetLeft, targetTop, edge, height), primary, secondary,
            LinearGradientMode.Vertical)) {
          graphics.FillRectangle(left, targetLeft, targetTop, edge, height);
        }
        using (LinearGradientBrush right = new LinearGradientBrush(
            new Rectangle(targetRight - edge + 1, targetTop, edge, height), tertiary, primary,
            LinearGradientMode.Vertical)) {
          graphics.FillRectangle(right, targetRight - edge + 1, targetTop, edge, height);
        }

        for (int inset = edge; inset < glow; inset++) {
          int alpha = Math.Max(0, 26 - ((inset - edge) * 26 / Math.Max(1, glow - edge)));
          using (Pen pen = new Pen(Color.FromArgb(alpha, secondaryColor), 1.0f)) {
            graphics.DrawRectangle(pen, targetLeft + inset, targetTop + inset,
              Math.Max(1, width - inset * 2 - 1),
              Math.Max(1, height - inset * 2 - 1));
          }
        }
        using (Pen innerHighlight = new Pen(Color.FromArgb(90, highlightColor), 1.0f)) {
          graphics.DrawRectangle(innerHighlight, targetLeft + edge, targetTop + edge,
            Math.Max(1, width - edge * 2 - 1),
            Math.Max(1, height - edge * 2 - 1));
        }
      }
      return bitmap;
    }

    private bool Present(Bitmap bitmap, int left, int top) {
      IntPtr screenDeviceContext = GetDC(IntPtr.Zero);
      if (screenDeviceContext == IntPtr.Zero) return false;
      IntPtr memoryDeviceContext = IntPtr.Zero;
      IntPtr nativeBitmap = IntPtr.Zero;
      IntPtr previous = IntPtr.Zero;
      try {
        memoryDeviceContext = CreateCompatibleDC(screenDeviceContext);
        if (memoryDeviceContext == IntPtr.Zero) return false;
        nativeBitmap = bitmap.GetHbitmap(Color.FromArgb(0));
        previous = SelectObject(memoryDeviceContext, nativeBitmap);
        POINT destination = new POINT();
        destination.X = left;
        destination.Y = top;
        POINT source = new POINT();
        SIZE size = new SIZE();
        size.Width = bitmap.Width;
        size.Height = bitmap.Height;
        BLENDFUNCTION blend = new BLENDFUNCTION();
        blend.SourceConstantAlpha = 255;
        blend.AlphaFormat = AC_SRC_ALPHA;
        return UpdateLayeredWindow(Handle, screenDeviceContext,
          ref destination, ref size, memoryDeviceContext, ref source,
          0, ref blend, ULW_ALPHA);
      } finally {
        if (previous != IntPtr.Zero) SelectObject(memoryDeviceContext, previous);
        if (nativeBitmap != IntPtr.Zero) DeleteObject(nativeBitmap);
        if (memoryDeviceContext != IntPtr.Zero) DeleteDC(memoryDeviceContext);
        ReleaseDC(IntPtr.Zero, screenDeviceContext);
      }
    }
  }

  public static class DesktopAccentOverlay {
    private static Color ParseColor(string value) {
      Color color = ColorTranslator.FromHtml(value);
      if (color.IsEmpty) throw new ArgumentException("Invalid overlay palette color.");
      return color;
    }

    private static Color[] ParseColors(string[] values) {
      Color[] colors = new Color[values.Length];
      for (int index = 0; index < values.Length; index++) {
        colors[index] = ParseColor(values[index]);
      }
      return colors;
    }

    public static OverlayResult Run(IntPtr targetWindow, uint processId, int durationSeconds,
        string[] themeIds, string[] themeLabels,
        string[] primaryHex, string[] secondaryHex,
        string[] tertiaryHex, string[] highlightHex, string[] launcherHoverHex,
        double[] launcherRadii, double[] launcherBorderWidths,
        string[] uiFontIds, string[] displayFontIds, string[] launcherMarkPaths,
        string[] lightPrimaryHex, string[] lightSecondaryHex,
        string[] lightTertiaryHex, string[] lightHighlightHex,
        string[] lightFocusHex, string[] lightAccentTextHex,
        string[] lightSidebarTextHex, string[] lightSidebarTextMutedHex,
        string[] lightTextSecondaryHex, string[] lightTextMutedHex,
        string[] lightSurfaceHex, string[] lightRaisedHex, string[] lightCanvasHex,
        double[] lightSurfaceAlpha, double[] lightSidebarAlpha,
        string[] darkPrimaryHex, string[] darkSecondaryHex,
        string[] darkTertiaryHex, string[] darkHighlightHex,
        string[] darkFocusHex, string[] darkAccentTextHex,
        string[] darkSidebarTextHex, string[] darkSidebarTextMutedHex,
        string[] darkTextSecondaryHex, string[] darkTextMutedHex,
        string[] darkSurfaceHex, string[] darkRaisedHex, string[] darkCanvasHex,
        double[] darkSurfaceAlpha, double[] darkSidebarAlpha,
        string[] lightCompositionDescriptors, string[] darkCompositionDescriptors,
        string[] lightWordmarkPaths, string[] darkWordmarkPaths,
        int[] themeRadii, int[] themeBlurs,
        int initialThemeIndex, string initialAppearance,
        bool initialOriginalLook, bool showThemeRail,
        bool applyShellTint, bool applyArtwork, bool applyIdentity,
        bool applyStructureAccents, bool applyColorFilter,
        bool cyclePermanentThemeMatrix,
        string gpuFilterExecutable, string persistenceStatePath,
        string workHubPanelScriptPath, string locale) {
      OverlayResult result = new OverlayResult();
      using (AccentOverlayForm form = new AccentOverlayForm(
          targetWindow, processId, durationSeconds,
          themeIds, themeLabels,
          ParseColors(primaryHex), ParseColors(secondaryHex),
          ParseColors(tertiaryHex), ParseColors(highlightHex),
          ParseColors(launcherHoverHex), launcherRadii, launcherBorderWidths,
          uiFontIds, displayFontIds, launcherMarkPaths,
          ParseColors(lightPrimaryHex), ParseColors(lightSecondaryHex),
          ParseColors(lightTertiaryHex), ParseColors(lightHighlightHex),
          ParseColors(lightFocusHex), ParseColors(lightAccentTextHex),
          ParseColors(lightSidebarTextHex), ParseColors(lightSidebarTextMutedHex),
          ParseColors(lightTextSecondaryHex), ParseColors(lightTextMutedHex),
          ParseColors(lightSurfaceHex), ParseColors(lightRaisedHex), ParseColors(lightCanvasHex),
          lightSurfaceAlpha, lightSidebarAlpha,
          ParseColors(darkPrimaryHex), ParseColors(darkSecondaryHex),
          ParseColors(darkTertiaryHex), ParseColors(darkHighlightHex),
          ParseColors(darkFocusHex), ParseColors(darkAccentTextHex),
          ParseColors(darkSidebarTextHex), ParseColors(darkSidebarTextMutedHex),
          ParseColors(darkTextSecondaryHex), ParseColors(darkTextMutedHex),
          ParseColors(darkSurfaceHex), ParseColors(darkRaisedHex), ParseColors(darkCanvasHex),
          darkSurfaceAlpha, darkSidebarAlpha,
          lightCompositionDescriptors, darkCompositionDescriptors,
          lightWordmarkPaths, darkWordmarkPaths,
          themeRadii, themeBlurs,
          initialThemeIndex, initialAppearance, initialOriginalLook, showThemeRail,
          applyShellTint, applyArtwork, applyIdentity, applyStructureAccents,
          applyColorFilter, cyclePermanentThemeMatrix, gpuFilterExecutable,
          persistenceStatePath, workHubPanelScriptPath, locale)) {
        Application.Run(form);
        result.ReasonCode = form.TargetClosed
          ? "desktop-overlay-target-closed"
          : form.StateReloadRequested
            ? "desktop-overlay-state-reload-requested"
          : form.SessionClosed
            ? "desktop-overlay-session-closed"
            : "desktop-overlay-preview-complete";
        result.PresentCount = form.PresentCount;
        result.HiddenTransitions = form.HiddenTransitions;
        result.SurfaceBuildCount = form.SurfaceBuildCount;
        result.ThemeSwitchCount = form.ThemeSwitchCount;
        result.OriginalLookTransitions = form.OriginalLookTransitions;
        result.AppearanceSwitchCount = form.AppearanceSwitchCount;
        result.ArtworkRenderCount = form.ArtworkRenderCount;
        result.ArtworkFailureCount = form.ArtworkFailureCount;
        result.BackgroundArtworkRenderCount = form.BackgroundArtworkRenderCount;
        result.FeatureArtworkRenderCount = form.FeatureArtworkRenderCount;
        result.IdentityRenderCount = form.IdentityRenderCount;
        result.IdentityFailureCount = form.IdentityFailureCount;
        result.SidebarCompositionCount = form.SidebarCompositionCount;
        result.PromptCompositionCount = form.PromptCompositionCount;
        result.GreetingCompositionCount = form.GreetingCompositionCount;
        result.StructureSnapshotCount = form.StructureSnapshotCount;
        result.StructureElementCount = form.StructureElementCount;
        result.StructureAccentCount = form.StructureAccentCount;
        result.StructureFailureCount = form.StructureFailureCount;
        result.ColorFilterPresentCount = form.ColorFilterPresentCount;
        result.ColorFilterFailureCount = form.ColorFilterFailureCount;
        result.ColorFilterInitialized = form.ColorFilterInitialized;
        result.ColorFilterAvailable = form.ColorFilterAvailable;
        result.GpuColorFilterAvailable = form.GpuColorFilterAvailable;
        result.GpuColorFilterStarted = form.GpuColorFilterStarted;
        result.GpuColorFilterInitialized = form.GpuColorFilterInitialized;
        result.GpuColorFilterEvidenceValid = form.GpuColorFilterEvidenceValid;
        result.GpuSurfacePaletteMapping = form.GpuSurfacePaletteMapping;
        result.GpuSemanticPaletteMapping = form.GpuSemanticPaletteMapping;
        result.GpuSurfaceAlphaMapping = form.GpuSurfaceAlphaMapping;
        result.GpuDarkNeutralRemap = form.GpuDarkNeutralRemap;
        result.GpuCoverageSafeAffineMapping = form.GpuCoverageSafeAffineMapping;
        result.GpuNonlinearTextRemap = form.GpuNonlinearTextRemap;
        result.GpuNativeResolutionPreserved = form.GpuNativeResolutionPreserved;
        result.GpuCaptureWidth = form.GpuCaptureWidth;
        result.GpuCaptureHeight = form.GpuCaptureHeight;
        result.GpuSwapChainWidth = form.GpuSwapChainWidth;
        result.GpuSwapChainHeight = form.GpuSwapChainHeight;
        result.GpuOutputClientWidth = form.GpuOutputClientWidth;
        result.GpuOutputClientHeight = form.GpuOutputClientHeight;
        result.GpuColorFilterStartCount = form.GpuColorFilterStartCount;
        result.GpuColorFilterFailureCount = form.GpuColorFilterFailureCount;
        result.GpuColorFilterFramesPresented = form.GpuColorFilterFramesPresented;
        result.ControlPresentCount = form.ControlPresentCount;
        result.SelectedThemeId = form.SelectedThemeId;
        result.OriginalLook = form.OriginalLook;
        result.SelectedAppearance = form.SelectedAppearance;
        result.EffectiveAppearance = form.EffectiveAppearance;
        result.SourceEffectiveAppearance = form.SourceEffectiveAppearance;
        result.PersistenceWriteCount = form.PersistenceWriteCount;
        result.PersistenceFailed = form.PersistenceFailed;
        result.ExternalStateApplyCount = form.ExternalStateApplyCount;
        result.ExternalStateFailureCount = form.ExternalStateFailureCount;
        result.StateReloadRequested = form.StateReloadRequested;
        result.MatrixCycleCompleted = form.MatrixCycleCompleted;
        result.CleanupComplete = form.ColorFilterCleanupComplete;
      }
      return result;
    }
  }
}
'@
}

$overlayMutex = $null
$ownsOverlayMutex = $false
$preview = $null
try {
  if (-not $ConfirmUnsupportedDesktopExperiment) {
    throw 'desktop-overlay-consent-required'
  }
  if ($CyclePermanentThemeMatrix -and (
      -not $NoPersist -or $RunUntilClaudeCloses -or $FrameOnly -or
      $DurationSeconds -lt 20)) {
    throw 'desktop-overlay-matrix-mode-invalid'
  }
  $overlayMutex = [Threading.Mutex]::new(
    $false, 'Local\ClaudeAuraDesktopPresentation')
  try {
    $ownsOverlayMutex = $overlayMutex.WaitOne(0)
  } catch [Threading.AbandonedMutexException] {
    $ownsOverlayMutex = $true
  }
  if (-not $ownsOverlayMutex) { throw 'desktop-overlay-already-running' }

  $install = Get-AuraClaudeInstall
  if ("$($install.Packaging)" -cne 'msix' -or
      "$($install.PackageFamilyName)" -cne 'Claude_pzs8sxrjxfjjc' -or
      "$($install.AppUserModelId)" -cne 'Claude_pzs8sxrjxfjjc!Claude') {
    throw 'desktop-overlay-msix-required'
  }
  if ($script:DesktopOverlayCandidateVersions -cnotcontains "$($install.Version)") {
    throw 'desktop-overlay-build-not-authorized'
  }
  $executablePath = [IO.Path]::GetFullPath(
    (Get-Item -LiteralPath $install.Executable -ErrorAction Stop).FullName)
  if (-not (Test-AuraAnthropicSignature -Path $executablePath)) {
    throw 'desktop-overlay-signature-invalid'
  }
  $launchedClaude = $false
  $processIds = @(Get-AuraDesktopOverlayProcesses -ExecutablePath $executablePath)
  if ($processIds.Count -eq 0 -and -not $DoNotLaunchClaude) {
    Start-Process -FilePath 'explorer.exe' -ArgumentList @(
      "shell:AppsFolder\$($install.AppUserModelId)") -ErrorAction Stop
    $launchedClaude = $true
    $launchDeadline = [DateTime]::UtcNow.AddSeconds(20)
    do {
      Start-Sleep -Milliseconds 200
      $processIds = @(Get-AuraDesktopOverlayProcesses -ExecutablePath $executablePath)
    } while ($processIds.Count -eq 0 -and [DateTime]::UtcNow -lt $launchDeadline)
  }
  if ($processIds.Count -eq 0) { throw 'desktop-overlay-desktop-not-running' }
  if ($processIds.Count -gt 32) { throw 'desktop-overlay-process-set-oversized' }

  $projectRoot = Split-Path -Parent $PSScriptRoot
  [string[]]$frozenThemeIds = @(
    'default',
    'japanese-film-editorial',
    'korean-prestige',
    'cartoon-studio',
    'anime-twilight',
    'study-library',
    'japanese-idol',
    'korean-idol'
  )
  $userThemesRoot = [IO.Path]::GetFullPath(
    (Join-Path $env:LOCALAPPDATA 'ClaudeAura\data\themes'))
  $themeItems = @(Get-AuraDesktopOverlayThemes -ProjectRoot $projectRoot `
      -UserThemesRoot $userThemesRoot)
  if ($themeItems.Count -lt $frozenThemeIds.Count -or $themeItems.Count -gt 32) {
    throw 'desktop-overlay-theme-registry-invalid'
  }
  for ($index = 0; $index -lt $frozenThemeIds.Count; $index++) {
    if ("$($themeItems[$index].name)" -cne $frozenThemeIds[$index] -or
        "$($themeItems[$index].source)" -cne 'builtin') {
      throw 'desktop-overlay-theme-registry-invalid'
    }
  }
  $artworkItems = @(Get-AuraDesktopOverlayArtworkPaths `
      -ProjectRoot $projectRoot -FrozenThemeIds $frozenThemeIds)
  if ($artworkItems.Count -ne $frozenThemeIds.Count) {
    throw 'desktop-overlay-artwork-registry-invalid'
  }
  $artworkById = @{}
  foreach ($artworkItem in $artworkItems) {
    $artworkId = "$($artworkItem.id)"
    if ($frozenThemeIds -cnotcontains $artworkId -or
        $artworkById.ContainsKey($artworkId)) {
      throw 'desktop-overlay-artwork-registry-invalid'
    }
    $artworkById[$artworkId] = $artworkItem
  }
  [string[]]$themeIds = @($themeItems | ForEach-Object { "$($_.name)" })
  if (@($themeIds | Sort-Object -Unique).Count -ne $themeIds.Count -or
      @($themeIds | Where-Object { $_ -cnotmatch '^[a-z][a-z0-9-]{1,39}$' }).Count -gt 0) {
    throw 'desktop-overlay-theme-registry-invalid'
  }
  [string[]]$themeLabels = @()
  $accentPalette = @()
  $borderPalette = @()
  $surfacePalette = @()
  $surfaceHoverPalette = @()
  $foregroundPalette = @()
  $launcherRadiusPalette = @()
  $launcherBorderWidthPalette = @()
  $fontUiPalette = @()
  $fontDisplayPalette = @()
  $lightPrimaryPalette = @()
  $lightSecondaryPalette = @()
  $lightTertiaryPalette = @()
  $lightHighlightPalette = @()
  $lightFocusPalette = @()
  $lightAccentTextPalette = @()
  $lightSidebarTextPalette = @()
  $lightSidebarTextMutedPalette = @()
  $lightTextSecondaryPalette = @()
  $lightTextMutedPalette = @()
  $lightComponentSurfacePalette = @()
  $lightRaisedSurfacePalette = @()
  $lightCanvasPalette = @()
  $lightSurfaceAlphaPalette = @()
  $lightSidebarAlphaPalette = @()
  $darkPrimaryPalette = @()
  $darkSecondaryPalette = @()
  $darkTertiaryPalette = @()
  $darkHighlightPalette = @()
  $darkFocusPalette = @()
  $darkAccentTextPalette = @()
  $darkSidebarTextPalette = @()
  $darkSidebarTextMutedPalette = @()
  $darkTextSecondaryPalette = @()
  $darkTextMutedPalette = @()
  $darkComponentSurfacePalette = @()
  $darkRaisedSurfacePalette = @()
  $darkCanvasPalette = @()
  $darkSurfaceAlphaPalette = @()
  $darkSidebarAlphaPalette = @()
  $launcherMarks = @()
  $lightCompositionDescriptors = @()
  $darkCompositionDescriptors = @()
  $lightWordmarkPaths = @()
  $darkWordmarkPaths = @()
  $radiusPalette = @()
  $blurPalette = @()
  $assetRoot = [IO.Path]::GetFullPath(
    (Join-Path $projectRoot 'assets\theme-art'))
  $assetRootPrefix = $assetRoot.TrimEnd('\') + '\'
  $userRootPrefix = $userThemesRoot.TrimEnd('\') + '\'
  $desktopFontCodes = @{
    'editorial-serif' = 0
    'humanist-sans' = 1
    'rounded-sans' = 2
    'system-sans' = 3
  }
  $resolveIdentityPair = {
    param([string]$RecipeId)
    if ($frozenThemeIds -cnotcontains $RecipeId) {
      throw 'desktop-overlay-identity-invalid'
    }
    $paths = @{}
    foreach ($wordmarkAppearance in @('light', 'dark')) {
      $wordmarkPath = [IO.Path]::GetFullPath((Join-Path $assetRoot `
            "$RecipeId\brand-wordmark-$wordmarkAppearance.png"))
      if (-not $wordmarkPath.StartsWith(
          $assetRootPrefix, [StringComparison]::OrdinalIgnoreCase) -or
          -not (Test-Path -LiteralPath $wordmarkPath -PathType Leaf)) {
        throw 'desktop-overlay-identity-invalid'
      }
      $wordmarkItem = Get-Item -LiteralPath $wordmarkPath -Force -ErrorAction Stop
      if (($wordmarkItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
          $wordmarkItem.Length -le 0 -or $wordmarkItem.Length -ge 409600) {
        throw 'desktop-overlay-identity-invalid'
      }
      $paths[$wordmarkAppearance] = $wordmarkPath
    }
    return [pscustomobject]@{
      light = "$($paths.light)"
      dark = "$($paths.dark)"
    }
  }
  $adaptUserComposition = {
    param(
      [AllowEmptyString()][string]$Descriptor,
      [int]$ThemeRadius,
      [double]$ThemeBorderWidth,
      [string]$ThemeDisplayFont
    )
    $fontCode = [int]$desktopFontCodes[$ThemeDisplayFont]
    $composerRadius = [Math]::Max(4, [Math]::Min(32, $ThemeRadius))
    $cardRadius = [Math]::Max(2, [Math]::Min(32, $ThemeRadius))
    $controlRadius = [Math]::Max(2, [Math]::Min(24, $ThemeRadius))
    $compositionBorderWidth = [Math]::Max(1,
      [Math]::Min(3, [int][Math]::Round($ThemeBorderWidth)))
    if ([string]::IsNullOrWhiteSpace($Descriptor)) {
      $parts = @(
        '', '0', '0', '', '0', '0', '0', '0', '0', '0', '0',
        '0', '1', '0', '0', '0.72', '0', '0', '34', '500', '0', '0',
        "$fontCode", '1', '0.64', '0', '0', "$composerRadius",
        "$cardRadius", "$controlRadius", "$compositionBorderWidth",
        '0', '1', '0', '0', '0.68', '0', '0', '40', '500', '0', '0',
        "$fontCode", '1'
      )
    } else {
      $parts = @($Descriptor -split '\|')
      if ($parts.Count -ne 44) { throw 'desktop-overlay-theme-invalid' }
      $parts[12] = '1'
      $parts[22] = "$fontCode"
      $parts[27] = "$composerRadius"
      $parts[28] = "$cardRadius"
      $parts[29] = "$controlRadius"
      $parts[30] = "$compositionBorderWidth"
      $parts[32] = '1'
      $parts[42] = "$fontCode"
    }
    if ($parts.Count -ne 44) { throw 'desktop-overlay-theme-invalid' }
    return $parts -join '|'
  }
  foreach ($theme in $themeItems) {
    $id = "$($theme.name)"
    $source = "$($theme.source)"
    $label = "$($theme.label)"
    if (($source -cne 'builtin' -and $source -cne 'user') -or
        -not $label -or $label.Length -gt 80 -or $label -match '[\x00-\x1F\x7F]') {
      throw 'desktop-overlay-theme-invalid'
    }
    $sourceRecipe = "$($theme.sourceRecipe)"
    if (($source -ceq 'builtin' -and
          -not [string]::IsNullOrWhiteSpace($sourceRecipe)) -or
        ($source -ceq 'user' -and
          -not [string]::IsNullOrWhiteSpace($sourceRecipe) -and
          $frozenThemeIds -cnotcontains $sourceRecipe)) {
      throw 'desktop-overlay-theme-invalid'
    }
    try {
      $radiusValue = [double]$theme.studioStyle.shared.radius
    } catch {
      throw 'desktop-overlay-theme-invalid'
    }
    if ([double]::IsNaN($radiusValue) -or [double]::IsInfinity($radiusValue) -or
        $radiusValue -lt 0 -or $radiusValue -gt 32 -or
        $radiusValue -ne [Math]::Floor($radiusValue)) {
      throw 'desktop-overlay-theme-invalid'
    }
    $themeRadius = [int]$radiusValue
    try {
      $blurValue = [double]$theme.studioStyle.shared.blur
    } catch {
      throw 'desktop-overlay-theme-invalid'
    }
    if ([double]::IsNaN($blurValue) -or [double]::IsInfinity($blurValue) -or
        $blurValue -lt 0 -or $blurValue -gt 40 -or
        $blurValue -ne [Math]::Floor($blurValue)) {
      throw 'desktop-overlay-theme-invalid'
    }
    $themeBlur = [int]$blurValue
    $fontUi = "$($theme.studioStyle.shared.fontUi)"
    $fontDisplay = "$($theme.studioStyle.shared.fontDisplay)"
    if ($fontUi -cnotin @('system-sans', 'humanist-sans', 'rounded-sans') -or
        $fontDisplay -cnotin @(
          'system-sans', 'humanist-sans', 'rounded-sans', 'editorial-serif')) {
      throw 'desktop-overlay-theme-invalid'
    }
    try {
      $launcherRadius = [double]$theme.launcher.radius
      $launcherBorderWidth = [double]$theme.launcher.borderWidth
      $lightSurfaceAlpha = [double]$theme.studioStyle.light.surfaceAlpha
      $lightSidebarAlpha = [double]$theme.studioStyle.light.sidebarAlpha
      $darkSurfaceAlpha = [double]$theme.studioStyle.dark.surfaceAlpha
      $darkSidebarAlpha = [double]$theme.studioStyle.dark.sidebarAlpha
    } catch {
      throw 'desktop-overlay-theme-invalid'
    }
    $boundedNumbers = @(
      [pscustomobject]@{ Value = $launcherRadius; Minimum = 8.0; Maximum = 24.0 }
      [pscustomobject]@{ Value = $launcherBorderWidth; Minimum = 1.0; Maximum = 3.0 }
      [pscustomobject]@{ Value = $lightSurfaceAlpha; Minimum = 0.35; Maximum = 1.0 }
      [pscustomobject]@{ Value = $lightSidebarAlpha; Minimum = 0.62; Maximum = 1.0 }
      [pscustomobject]@{ Value = $darkSurfaceAlpha; Minimum = 0.35; Maximum = 1.0 }
      [pscustomobject]@{ Value = $darkSidebarAlpha; Minimum = 0.62; Maximum = 1.0 }
    )
    foreach ($bounded in $boundedNumbers) {
      $number = [double]$bounded.Value
      if ([double]::IsNaN($number) -or [double]::IsInfinity($number) -or
          $number -lt [double]$bounded.Minimum -or
          $number -gt [double]$bounded.Maximum) {
        throw 'desktop-overlay-theme-invalid'
      }
    }
    $launcherPalette = @(
      "$($theme.launcher.accent)",
      "$($theme.launcher.border)",
      "$($theme.launcher.surface)",
      "$($theme.launcher.foreground)",
      "$($theme.launcher.surfaceHover)"
    )
    $lightPalette = @(
      "$($theme.studioStyle.light.accent)",
      "$($theme.studioStyle.light.border)",
      "$($theme.studioStyle.light.sidebar)",
      "$($theme.studioStyle.light.text)",
      "$($theme.studioStyle.light.surface)",
      "$($theme.studioStyle.light.raised)",
      "$($theme.studioStyle.light.canvas)",
      "$($theme.studioStyle.light.focus)",
      "$($theme.studioStyle.light.accentText)",
      "$($theme.studioStyle.light.sidebarText)",
      "$($theme.studioStyle.light.sidebarTextMuted)",
      "$($theme.studioStyle.light.textSecondary)",
      "$($theme.studioStyle.light.textMuted)"
    )
    $darkPalette = @(
      "$($theme.studioStyle.dark.accent)",
      "$($theme.studioStyle.dark.border)",
      "$($theme.studioStyle.dark.sidebar)",
      "$($theme.studioStyle.dark.text)",
      "$($theme.studioStyle.dark.surface)",
      "$($theme.studioStyle.dark.raised)",
      "$($theme.studioStyle.dark.canvas)",
      "$($theme.studioStyle.dark.focus)",
      "$($theme.studioStyle.dark.accentText)",
      "$($theme.studioStyle.dark.sidebarText)",
      "$($theme.studioStyle.dark.sidebarTextMuted)",
      "$($theme.studioStyle.dark.textSecondary)",
      "$($theme.studioStyle.dark.textMuted)"
    )
    $allColors = @($launcherPalette + $lightPalette + $darkPalette)
    if (@($allColors | Where-Object { $_ -cnotmatch '^#[0-9A-Fa-f]{6}$' }).Count -gt 0) {
      throw 'desktop-overlay-theme-invalid'
    }
    $assetRelative = "$($theme.launcher.asset)" -replace '/', '\'
    if ($assetRelative -cmatch '^assets\\theme-art\\(?:default|japanese-film-editorial|korean-prestige|cartoon-studio|anime-twilight|study-library|japanese-idol|korean-idol)\\launcher-mark\.png$') {
      $assetPath = [IO.Path]::GetFullPath((Join-Path $projectRoot $assetRelative))
      if (-not $assetPath.StartsWith(
          $assetRootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'desktop-overlay-theme-invalid'
      }
    } elseif ($source -ceq 'user' -and $assetRelative -ceq 'launcher-mark.png') {
      $kitRoot = [IO.Path]::GetFullPath((Join-Path $userThemesRoot $id))
      $assetPath = [IO.Path]::GetFullPath((Join-Path $kitRoot $assetRelative))
      if (-not $assetPath.StartsWith(
          $userRootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'desktop-overlay-theme-invalid'
      }
    } else {
      throw 'desktop-overlay-theme-invalid'
    }
    if (-not (Test-Path -LiteralPath $assetPath -PathType Leaf)) {
      throw 'desktop-overlay-theme-invalid'
    }
    $assetItem = Get-Item -LiteralPath $assetPath -Force -ErrorAction Stop
    if (($assetItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'desktop-overlay-theme-invalid'
    }
    $themeLabels += $label
    $accentPalette += $launcherPalette[0]
    $borderPalette += $launcherPalette[1]
    $surfacePalette += $launcherPalette[2]
    $foregroundPalette += $launcherPalette[3]
    $surfaceHoverPalette += $launcherPalette[4]
    $launcherRadiusPalette += $launcherRadius
    $launcherBorderWidthPalette += $launcherBorderWidth
    $fontUiPalette += $fontUi
    $fontDisplayPalette += $fontDisplay
    $lightPrimaryPalette += $lightPalette[0]
    $lightSecondaryPalette += $lightPalette[1]
    $lightTertiaryPalette += $lightPalette[2]
    $lightHighlightPalette += $lightPalette[3]
    $lightComponentSurfacePalette += $lightPalette[4]
    $lightRaisedSurfacePalette += $lightPalette[5]
    $lightCanvasPalette += $lightPalette[6]
    $lightFocusPalette += $lightPalette[7]
    $lightAccentTextPalette += $lightPalette[8]
    $lightSidebarTextPalette += $lightPalette[9]
    $lightSidebarTextMutedPalette += $lightPalette[10]
    $lightTextSecondaryPalette += $lightPalette[11]
    $lightTextMutedPalette += $lightPalette[12]
    $lightSurfaceAlphaPalette += $lightSurfaceAlpha
    $lightSidebarAlphaPalette += $lightSidebarAlpha
    $darkPrimaryPalette += $darkPalette[0]
    $darkSecondaryPalette += $darkPalette[1]
    $darkTertiaryPalette += $darkPalette[2]
    $darkHighlightPalette += $darkPalette[3]
    $darkComponentSurfacePalette += $darkPalette[4]
    $darkRaisedSurfacePalette += $darkPalette[5]
    $darkCanvasPalette += $darkPalette[6]
    $darkFocusPalette += $darkPalette[7]
    $darkAccentTextPalette += $darkPalette[8]
    $darkSidebarTextPalette += $darkPalette[9]
    $darkSidebarTextMutedPalette += $darkPalette[10]
    $darkTextSecondaryPalette += $darkPalette[11]
    $darkTextMutedPalette += $darkPalette[12]
    $darkSurfaceAlphaPalette += $darkSurfaceAlpha
    $darkSidebarAlphaPalette += $darkSidebarAlpha
    $launcherMarks += $assetPath
    $presentationRecipe = if ($source -ceq 'builtin') { $id } else { $sourceRecipe }
    if (-not [string]::IsNullOrWhiteSpace($presentationRecipe)) {
      if (-not $artworkById.ContainsKey($presentationRecipe)) {
        throw 'desktop-overlay-artwork-registry-invalid'
      }
      $lightComposition = "$($artworkById[$presentationRecipe].light)"
      $darkComposition = "$($artworkById[$presentationRecipe].dark)"
      if ($source -ceq 'user') {
        $lightComposition = & $adaptUserComposition $lightComposition `
          $themeRadius $launcherBorderWidth $fontDisplay
        $darkComposition = & $adaptUserComposition $darkComposition `
          $themeRadius $launcherBorderWidth $fontDisplay
      }
      $lightCompositionDescriptors += $lightComposition
      $darkCompositionDescriptors += $darkComposition
      $identityPair = & $resolveIdentityPair $presentationRecipe
      $lightWordmarkPaths += "$($identityPair.light)"
      $darkWordmarkPaths += "$($identityPair.dark)"
    } else {
      $fallbackComposition = & $adaptUserComposition '' $themeRadius `
        $launcherBorderWidth $fontDisplay
      $lightCompositionDescriptors += $fallbackComposition
      $darkCompositionDescriptors += $fallbackComposition
      $lightWordmarkPaths += ''
      $darkWordmarkPaths += ''
    }
    $radiusPalette += $themeRadius
    $blurPalette += $themeBlur
  }
  $artworkAvailableThemeCount = @(0..($themeIds.Count - 1) | Where-Object {
      $lightParts = @("$($lightCompositionDescriptors[$_])" -split '\|')
      $darkParts = @("$($darkCompositionDescriptors[$_])" -split '\|')
      -not [string]::IsNullOrWhiteSpace("$($lightParts[0])") -or
      -not [string]::IsNullOrWhiteSpace("$($lightParts[3])") -or
      -not [string]::IsNullOrWhiteSpace("$($darkParts[0])") -or
      -not [string]::IsNullOrWhiteSpace("$($darkParts[3])")
    }).Count
  $identityAvailableThemeCount = @(0..($themeIds.Count - 1) | Where-Object {
      -not [string]::IsNullOrWhiteSpace("$($lightWordmarkPaths[$_])") -and
      -not [string]::IsNullOrWhiteSpace("$($darkWordmarkPaths[$_])")
    }).Count

  $statePath = Join-Path $env:LOCALAPPDATA 'ClaudeAura\data\desktop-presentation.json'
  $stateLoaded = $false
  $initialOriginalLook = $false
  $resolvedThemeId = 'default'
  $resolvedAppearance = 'system'
  if (-not $NoPersist -and (Test-Path -LiteralPath $statePath -PathType Leaf)) {
    try {
      $stateItem = Get-Item -LiteralPath $statePath -Force -ErrorAction Stop
      if ($stateItem.Length -gt 768 -or
          ($stateItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'desktop-overlay-state-invalid'
      }
      $state = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 |
        ConvertFrom-Json -ErrorAction Stop
      $stateKeys = @($state.PSObject.Properties.Name | Sort-Object)
      $stateVersion = [int]$state.schemaVersion
      $validShape = ($stateVersion -eq 1 -and
          ($stateKeys -join ',') -ceq 'originalLook,schemaVersion,themeId') -or
        ($stateVersion -eq 2 -and
          ($stateKeys -join ',') -ceq 'appearance,originalLook,schemaVersion,themeId')
      $stateAppearance = if ($stateVersion -eq 2) { "$($state.appearance)" } else { 'system' }
      if (-not $validShape -or $themeIds -cnotcontains "$($state.themeId)" -or
          $state.originalLook -isnot [bool] -or
          $stateAppearance -cnotin @('system', 'light', 'dark')) {
        throw 'desktop-overlay-state-invalid'
      }
      $resolvedThemeId = "$($state.themeId)"
      $resolvedAppearance = $stateAppearance
      $initialOriginalLook = [bool]$state.originalLook
      $stateLoaded = $true
    } catch {
      $stateLoaded = $false
      $resolvedThemeId = 'default'
      $resolvedAppearance = 'system'
      $initialOriginalLook = $false
    }
  }
  if ($PSBoundParameters.ContainsKey('ThemeId')) {
    if ($themeIds -cnotcontains $ThemeId) { throw 'desktop-overlay-theme-invalid' }
    $resolvedThemeId = $ThemeId
    $initialOriginalLook = $false
  }
  if ($PSBoundParameters.ContainsKey('Appearance')) {
    $resolvedAppearance = $Appearance
    $initialOriginalLook = $false
  }
  if ($OriginalLook) {
    $initialOriginalLook = $true
  }
  if ($CyclePermanentThemeMatrix -and (
      $resolvedThemeId -cne 'default' -or
      $resolvedAppearance -cne 'light' -or
      $initialOriginalLook)) {
    throw 'desktop-overlay-matrix-start-invalid'
  }
  $initialThemeIndex = [Array]::IndexOf($themeIds, $resolvedThemeId)
  if ($initialThemeIndex -lt 0) { throw 'desktop-overlay-theme-invalid' }

  $gpuFilterExecutable = if (-not $NoColorFilter) {
    Get-AuraDesktopCaptureFilterExecutable -ProjectRoot $projectRoot
  } else {
    ''
  }
  $workHubPanelScript = Join-Path $PSScriptRoot 'desktop-taskboard-panel.ps1'
  if (-not (Test-Path -LiteralPath $workHubPanelScript -PathType Leaf)) {
    throw 'desktop-work-hub-panel-missing'
  }
  Add-AuraDesktopOverlayType
  [ClaudeAuraDesktopExperiment.DesktopWindowProbe]::EnablePerMonitorDpiAwareness()
  if ([System.Windows.Forms.SystemInformation]::HighContrast) {
    throw 'desktop-overlay-high-contrast-active'
  }
  $windowDeadline = [DateTime]::UtcNow.AddSeconds(20)
  do {
    $processIds = @(Get-AuraDesktopOverlayProcesses -ExecutablePath $executablePath)
    if ($processIds.Count -gt 32) { throw 'desktop-overlay-process-set-oversized' }
    $windows = @([ClaudeAuraDesktopExperiment.DesktopWindowProbe]::FindCandidateWindows(
        [int[]]$processIds))
    if ($windows.Count -eq 1) { break }
    Start-Sleep -Milliseconds 200
  } while ([DateTime]::UtcNow -lt $windowDeadline)
  if ($windows.Count -ne 1) { throw 'desktop-overlay-window-ambiguous' }
  $targetProcessId = [ClaudeAuraDesktopExperiment.DesktopWindowProbe]::GetProcessId(
    [IntPtr]$windows[0])
  if ($targetProcessId -le 0 -or $processIds -notcontains [int]$targetProcessId) {
    throw 'desktop-overlay-window-owner-invalid'
  }

  $effectiveDuration = if ($RunUntilClaudeCloses) { 0 } else { $DurationSeconds }
  $persistenceStatePath = if ($NoPersist) { '' } else { $statePath }
  $preview = [ClaudeAuraDesktopExperiment.DesktopAccentOverlay]::Run(
    [IntPtr]$windows[0], [uint32]$targetProcessId, $effectiveDuration,
    $themeIds, $themeLabels,
    [string[]]$accentPalette, [string[]]$borderPalette,
    [string[]]$surfacePalette, [string[]]$foregroundPalette,
    [string[]]$surfaceHoverPalette,
    [double[]]$launcherRadiusPalette, [double[]]$launcherBorderWidthPalette,
    [string[]]$fontUiPalette, [string[]]$fontDisplayPalette,
    [string[]]$launcherMarks,
    [string[]]$lightPrimaryPalette, [string[]]$lightSecondaryPalette,
    [string[]]$lightTertiaryPalette, [string[]]$lightHighlightPalette,
    [string[]]$lightFocusPalette, [string[]]$lightAccentTextPalette,
    [string[]]$lightSidebarTextPalette, [string[]]$lightSidebarTextMutedPalette,
    [string[]]$lightTextSecondaryPalette, [string[]]$lightTextMutedPalette,
    [string[]]$lightComponentSurfacePalette, [string[]]$lightRaisedSurfacePalette,
    [string[]]$lightCanvasPalette,
    [double[]]$lightSurfaceAlphaPalette, [double[]]$lightSidebarAlphaPalette,
    [string[]]$darkPrimaryPalette, [string[]]$darkSecondaryPalette,
    [string[]]$darkTertiaryPalette, [string[]]$darkHighlightPalette,
    [string[]]$darkFocusPalette, [string[]]$darkAccentTextPalette,
    [string[]]$darkSidebarTextPalette, [string[]]$darkSidebarTextMutedPalette,
    [string[]]$darkTextSecondaryPalette, [string[]]$darkTextMutedPalette,
    [string[]]$darkComponentSurfacePalette, [string[]]$darkRaisedSurfacePalette,
    [string[]]$darkCanvasPalette,
    [double[]]$darkSurfaceAlphaPalette, [double[]]$darkSidebarAlphaPalette,
    [string[]]$lightCompositionDescriptors,
    [string[]]$darkCompositionDescriptors,
    [string[]]$lightWordmarkPaths, [string[]]$darkWordmarkPaths,
    [int[]]$radiusPalette, [int[]]$blurPalette,
    $initialThemeIndex, $resolvedAppearance, $initialOriginalLook,
    (-not $FrameOnly), (-not $NoShellTint), (-not $NoArtwork),
    (-not $NoIdentity), (-not $NoStructureAccents), (-not $NoColorFilter),
    [bool]$CyclePermanentThemeMatrix,
    $gpuFilterExecutable,
    $persistenceStatePath,
    $workHubPanelScript,
    $Locale)
  if (-not $preview.CleanupComplete -or
      (($preview.PresentCount -le 0 -and $preview.ControlPresentCount -le 0) -and
        -not $preview.StateReloadRequested)) {
    throw 'desktop-overlay-presentation-failed'
  }
  if (-not $NoPersist -and $preview.PersistenceFailed) {
    throw 'desktop-overlay-state-write-failed'
  }
  if ($CyclePermanentThemeMatrix -and -not $preview.MatrixCycleCompleted) {
    throw 'desktop-overlay-matrix-incomplete'
  }
  $finalThemeIndex = [Array]::IndexOf($themeIds, "$($preview.SelectedThemeId)")
  if ($finalThemeIndex -lt 0) { throw 'desktop-overlay-theme-invalid' }
  Write-AuraDesktopOverlayResult @{
    schemaVersion = 6
    status = 'ok'
    reasonCode = "$($preview.ReasonCode)"
    layerType = if ($FrameOnly) {
      if ($NoShellTint) {
        'external-click-through-material-frame'
      } else {
        'external-click-through-material-shell'
      }
    } else {
      if ($NoShellTint) {
        'external-theme-rail-and-click-through-material-frame'
      } else {
        'external-theme-rail-and-click-through-material-shell'
      }
    }
    mode = if ($RunUntilClaudeCloses) { 'session' } else { 'preview' }
    startedThemeId = $resolvedThemeId
    themeId = "$($preview.SelectedThemeId)"
    themeRadius = [int]$radiusPalette[$finalThemeIndex]
    themeBlur = [int]$blurPalette[$finalThemeIndex]
    themeFontUi = "$($fontUiPalette[$finalThemeIndex])"
    themeFontDisplay = "$($fontDisplayPalette[$finalThemeIndex])"
    launcherRadius = [double]$launcherRadiusPalette[$finalThemeIndex]
    launcherBorderWidth = [double]$launcherBorderWidthPalette[$finalThemeIndex]
    appearance = "$($preview.SelectedAppearance)"
    effectiveAppearance = "$($preview.EffectiveAppearance)"
    sourceAppearanceHint = "$($preview.SourceEffectiveAppearance)"
    sourceAppearanceBasis = 'gpu-top-chrome-sampling-with-windows-fallback'
    originalLook = [bool]$preview.OriginalLook
    availableThemeCount = [int]$themeIds.Count
    userThemeCount = [int]($themeIds.Count - $frozenThemeIds.Count)
    themeRailEnabled = -not [bool]$FrameOnly
    shellTintEnabled = -not [bool]$NoShellTint
    artworkEnabled = -not [bool]$NoArtwork
    artworkAvailableThemeCount = [int]$artworkAvailableThemeCount
    artworkRenderCount = [int]$preview.ArtworkRenderCount
    artworkFailureCount = [int]$preview.ArtworkFailureCount
    backgroundArtworkRenderCount = [int]$preview.BackgroundArtworkRenderCount
    featureArtworkRenderCount = [int]$preview.FeatureArtworkRenderCount
    identityEnabled = -not [bool]$NoIdentity
    identityAvailableThemeCount = [int]$identityAvailableThemeCount
    identityRenderCount = [int]$preview.IdentityRenderCount
    identityFailureCount = [int]$preview.IdentityFailureCount
    sidebarCompositionCount = [int]$preview.SidebarCompositionCount
    promptCompositionCount = [int]$preview.PromptCompositionCount
    greetingCompositionCount = [int]$preview.GreetingCompositionCount
    compositionContract = 'permanent-theme-new-chat'
    structureAccentsEnabled = -not [bool]$NoStructureAccents
    structureSnapshotCount = [int]$preview.StructureSnapshotCount
    structureElementCount = [int]$preview.StructureElementCount
    structureAccentCount = [int]$preview.StructureAccentCount
    structureFailureCount = [int]$preview.StructureFailureCount
    accessibilityGeometryAccess = -not [bool]$NoStructureAccents
    accessibilityTextAccess = $false
    colorFilterRequested = (-not [bool]$NoColorFilter) -and
      (-not [bool]$preview.OriginalLook)
    colorFilterAvailable = [bool]$preview.ColorFilterAvailable
    colorFilterEnabled = (-not [bool]$NoColorFilter) -and
      (-not [bool]$preview.OriginalLook) -and
      [bool]$preview.ColorFilterAvailable
    colorFilterInitialized = [bool]$preview.ColorFilterInitialized
    colorFilterPresentCount = [int]$preview.ColorFilterPresentCount
    colorFilterFailureCount = [int]$preview.ColorFilterFailureCount
    gpuColorFilterAvailable = [bool]$preview.GpuColorFilterAvailable
    gpuColorFilterStarted = [bool]$preview.GpuColorFilterStarted
    gpuColorFilterInitialized = [bool]$preview.GpuColorFilterInitialized
    gpuColorFilterEvidenceValid = [bool]$preview.GpuColorFilterEvidenceValid
    gpuSurfacePaletteMapping = [bool]$preview.GpuSurfacePaletteMapping
    gpuSemanticPaletteMapping = [bool]$preview.GpuSemanticPaletteMapping
    gpuSurfaceAlphaMapping = [bool]$preview.GpuSurfaceAlphaMapping
    gpuSemanticPaletteSize = 13
    studioAppearanceRoleCount = 15
    gpuDarkNeutralRemap = [bool]$preview.GpuDarkNeutralRemap
    gpuCoverageSafeAffineMapping = [bool]$preview.GpuCoverageSafeAffineMapping
    gpuNonlinearTextRemap = [bool]$preview.GpuNonlinearTextRemap
    gpuNativeResolutionPreserved = [bool]$preview.GpuNativeResolutionPreserved
    gpuCaptureWidth = [int]$preview.GpuCaptureWidth
    gpuCaptureHeight = [int]$preview.GpuCaptureHeight
    gpuSwapChainWidth = [int]$preview.GpuSwapChainWidth
    gpuSwapChainHeight = [int]$preview.GpuSwapChainHeight
    gpuOutputClientWidth = [int]$preview.GpuOutputClientWidth
    gpuOutputClientHeight = [int]$preview.GpuOutputClientHeight
    gpuColorFilterStartCount = [int]$preview.GpuColorFilterStartCount
    gpuColorFilterFailureCount = [int]$preview.GpuColorFilterFailureCount
    gpuColorFilterFramesPresented = [int64]$preview.GpuColorFilterFramesPresented
    colorFilterBackend = if ([int]$preview.ColorFilterPresentCount -le 0) {
      'none'
    } elseif ([bool]$preview.GpuColorFilterStarted) {
      'windows-graphics-capture-exact-hwnd-gpu'
    } else {
      'magnification-desktop-rectangle'
    }
    compositorSourceKind = if ([int]$preview.ColorFilterPresentCount -le 0) {
      'none'
    } elseif ([bool]$preview.GpuColorFilterStarted) {
      'exact-window-frame'
    } else {
      'desktop-rectangle'
    }
    exactHwndIsolation = [bool]$preview.GpuColorFilterStarted
    gpuPixelTransform = [bool]$preview.GpuColorFilterStarted
    pixelCallbackDeclared = $false
    pixelReadback = $false
    persistenceEnabled = -not [bool]$NoPersist
    persistenceStateLoaded = [bool]$stateLoaded
    persistenceWriteCount = [int]$preview.PersistenceWriteCount
    externalStateApplyCount = [int]$preview.ExternalStateApplyCount
    externalStateFailureCount = [int]$preview.ExternalStateFailureCount
    stateReloadRequested = [bool]$preview.StateReloadRequested
    routeAgnosticPresentation = $true
    launchedClaude = [bool]$launchedClaude
    packageKind = "$($install.Packaging)"
    productVersion = "$($install.Version)"
    signatureValid = $true
    windowBound = $true
    presentationVisible = [int]$preview.PresentCount -gt 0
    controllerVisible = [int]$preview.ControlPresentCount -gt 0
    presentCount = [int]$preview.PresentCount
    hiddenTransitions = [int]$preview.HiddenTransitions
    surfaceBuildCount = [int]$preview.SurfaceBuildCount
    themeSwitchCount = [int]$preview.ThemeSwitchCount
    originalLookTransitions = [int]$preview.OriginalLookTransitions
    appearanceSwitchCount = [int]$preview.AppearanceSwitchCount
    matrixCycleRequested = [bool]$CyclePermanentThemeMatrix
    matrixCycleCompleted = [bool]$preview.MatrixCycleCompleted
    matrixStateCount = if ($preview.MatrixCycleCompleted) { 16 } else { 0 }
    controlPresentCount = [int]$preview.ControlPresentCount
    contentAccess = [bool]$preview.GpuColorFilterStarted
    contentAccessKind = if ([bool]$preview.GpuColorFilterStarted) {
      'gpu-window-frame-transform-only'
    } else {
      'none'
    }
    inputIntercepted = $false
    controllerInputEnabled = -not [bool]$FrameOnly
    cleanupComplete = [bool]$preview.CleanupComplete
  }
  exit 0
} catch {
  $reasonCode = if ($_.Exception.Message -cmatch '^desktop-overlay-[a-z0-9-]+$') {
    $_.Exception.Message
  } else {
    'desktop-overlay-failed'
  }
  $hasPreview = $null -ne $preview
  Write-AuraDesktopOverlayResult @{
    schemaVersion = 6
    status = 'blocked'
    reasonCode = $reasonCode
    layerType = 'external-desktop-presentation'
    contentAccess = $hasPreview -and [bool]$preview.GpuColorFilterStarted
    contentAccessKind = if ($hasPreview -and [bool]$preview.GpuColorFilterStarted) {
      'gpu-window-frame-transform-only'
    } else {
      'none'
    }
    gpuColorFilterStarted = $hasPreview -and [bool]$preview.GpuColorFilterStarted
    gpuColorFilterStartCount = if ($hasPreview) {
      [int]$preview.GpuColorFilterStartCount
    } else { 0 }
    gpuColorFilterFailureCount = if ($hasPreview) {
      [int]$preview.GpuColorFilterFailureCount
    } else { 0 }
    gpuColorFilterFramesPresented = if ($hasPreview) {
      [int64]$preview.GpuColorFilterFramesPresented
    } else { [int64]0 }
    gpuColorFilterEvidenceValid = $hasPreview -and
      [bool]$preview.GpuColorFilterEvidenceValid
    gpuSurfacePaletteMapping = $hasPreview -and
      [bool]$preview.GpuSurfacePaletteMapping
    gpuSemanticPaletteMapping = $hasPreview -and
      [bool]$preview.GpuSemanticPaletteMapping
    gpuSurfaceAlphaMapping = $hasPreview -and
      [bool]$preview.GpuSurfaceAlphaMapping
    gpuDarkNeutralRemap = $hasPreview -and [bool]$preview.GpuDarkNeutralRemap
    gpuCoverageSafeAffineMapping = $hasPreview -and
      [bool]$preview.GpuCoverageSafeAffineMapping
    gpuNonlinearTextRemap = $hasPreview -and [bool]$preview.GpuNonlinearTextRemap
    gpuNativeResolutionPreserved = $hasPreview -and
      [bool]$preview.GpuNativeResolutionPreserved
    gpuCaptureWidth = if ($hasPreview) { [int]$preview.GpuCaptureWidth } else { 0 }
    gpuCaptureHeight = if ($hasPreview) { [int]$preview.GpuCaptureHeight } else { 0 }
    gpuSwapChainWidth = if ($hasPreview) { [int]$preview.GpuSwapChainWidth } else { 0 }
    gpuSwapChainHeight = if ($hasPreview) { [int]$preview.GpuSwapChainHeight } else { 0 }
    gpuOutputClientWidth = if ($hasPreview) {
      [int]$preview.GpuOutputClientWidth
    } else { 0 }
    gpuOutputClientHeight = if ($hasPreview) {
      [int]$preview.GpuOutputClientHeight
    } else { 0 }
    themeSwitchCount = if ($hasPreview) { [int]$preview.ThemeSwitchCount } else { 0 }
    appearanceSwitchCount = if ($hasPreview) {
      [int]$preview.AppearanceSwitchCount
    } else { 0 }
    originalLookTransitions = if ($hasPreview) {
      [int]$preview.OriginalLookTransitions
    } else { 0 }
    matrixCycleRequested = [bool]$CyclePermanentThemeMatrix
    matrixCycleCompleted = $hasPreview -and [bool]$preview.MatrixCycleCompleted
    matrixStateCount = if ($hasPreview -and $preview.MatrixCycleCompleted) {
      16
    } else { 0 }
    controlPresentCount = if ($hasPreview) { [int]$preview.ControlPresentCount } else { 0 }
    presentCount = if ($hasPreview) { [int]$preview.PresentCount } else { 0 }
    pixelReadback = $false
    inputIntercepted = $false
    cleanupComplete = if ($hasPreview) {
      [bool]$preview.CleanupComplete
    } else {
      $reasonCode -ne 'desktop-overlay-presentation-failed'
    }
  }
  exit 2
} finally {
  if ($ownsOverlayMutex -and $null -ne $overlayMutex) {
    try { $overlayMutex.ReleaseMutex() } catch { }
  }
  if ($null -ne $overlayMutex) { $overlayMutex.Dispose() }
}
