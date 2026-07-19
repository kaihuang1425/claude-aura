[CmdletBinding()]
param(
  [ValidateSet('Open', 'Restore')][string]$Mode = 'Open',
  [string]$Theme,
  [string]$Image,
  [switch]$ClearImage
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
$ThemeCli = Join-Path $Root 'scripts\theme-cli.mjs'
$VendorRoot = Join-Path $Root 'vendor\webview2'
$DataRoot = Join-Path $env:LOCALAPPDATA 'ClaudeAura\data'
$ConfigPath = Join-Path $DataRoot 'config.json'
$UserThemesRoot = Join-Path $DataRoot 'themes'
$WebDataRoot = Join-Path $env:LOCALAPPDATA 'ClaudeAura\webview'
$LogPath = Join-Path $DataRoot 'aura-ui.log'
$UiCopyPath = Join-Path $PSScriptRoot 'ui-copy.json'
$StudioRoot = Join-Path $Root 'studio'
$ThemeArtRoot = Join-Path $Root 'assets\theme-art'
$StudioBackgroundRoot = Join-Path $DataRoot 'studio-background'
$StudioBackgroundMaxBytes = 16 * 1024 * 1024
. (Join-Path $PSScriptRoot 'common.ps1')

function Write-AuraUiLog {
  param([string]$Message)
  try {
    [System.IO.Directory]::CreateDirectory($DataRoot) | Out-Null
    $line = '[{0}] {1}{2}' -f (Get-Date).ToUniversalTime().ToString('o'), $Message, [Environment]::NewLine
    [System.IO.File]::AppendAllText($LogPath, $line, [System.Text.UTF8Encoding]::new($false))
  } catch {}
}

function Get-AuraUiCopy {
  param([AllowEmptyString()][string]$Locale)
  $tag = if ($Locale) { $Locale.Replace('_', '-') } else { 'en' }
  $localeKey = if ($tag -match '^zh-(?i:cn|sg|hans)(?:-|$)' -or $tag -match '^zh-(?i:hans)(?:-|$)') {
    'zh-CN'
  } elseif ($tag -match '^zh-(?i:tw|hk|mo|hant)(?:-|$)' -or $tag -match '^zh-(?i:hant)(?:-|$)') {
    'zh-TW'
  } else {
    'en'
  }
  $source = [IO.File]::ReadAllText($UiCopyPath, [Text.Encoding]::UTF8)
  $allCopy = $source | ConvertFrom-Json
  $property = $allCopy.PSObject.Properties[$localeKey]
  if ($null -eq $property) { $property = $allCopy.PSObject.Properties['en'] }
  return $property.Value
}

function ConvertTo-AuraUiArgument {
  param([AllowEmptyString()][string]$Value)
  if ($Value -notmatch '[\s"]') { return $Value }
  return '"' + ([regex]::Replace($Value, '(\\*)"', '$1$1\"') -replace '(\\+)$', '$1$1') + '"'
}

function Get-AuraUiPropertyValue {
  param(
    [AllowNull()][object]$InputObject,
    [Parameter(Mandatory = $true)][string[]]$Names
  )
  if ($null -eq $InputObject) { return $null }
  foreach ($name in $Names) {
    $value = $null
    if ($InputObject -is [System.Collections.IDictionary] -and $InputObject.Contains($name)) {
      $value = $InputObject[$name]
    } else {
      $property = $InputObject.PSObject.Properties[$name]
      if ($null -ne $property) { $value = $property.Value }
    }
    if ($null -ne $value -and (-not ($value -is [string]) -or $value.Trim().Length -gt 0)) {
      return $value
    }
  }
  return $null
}

function ConvertTo-AuraUiThemeMetadata {
  param([AllowNull()][object]$Item, [int]$Index)
  $nameValue = Get-AuraUiPropertyValue -InputObject $Item -Names @('name', 'id', 'value')
  if ($null -eq $nameValue -or -not "$nameValue".Trim()) { return $null }
  $name = "$nameValue".Trim()

  $labelValue = Get-AuraUiPropertyValue -InputObject $Item -Names @('label', 'displayName', 'title')
  if ($null -eq $labelValue) {
    $words = ($name -replace '[-_]+', ' ').Trim()
    try { $labelValue = [Globalization.CultureInfo]::CurrentUICulture.TextInfo.ToTitleCase($words) }
    catch { $labelValue = $words }
  }
  $label = "$labelValue".Trim()
  if (-not $label) { $label = "$($script:UiCopy.theme) $($Index + 1)" }

  $descriptionValue = Get-AuraUiPropertyValue -InputObject $Item -Names @('description', 'subtitle', 'summary')
  $description = if ($null -ne $descriptionValue -and "$descriptionValue".Trim()) {
    "$descriptionValue".Trim()
  } else {
    "$($script:UiCopy.themeFallbackDescription)"
  }

  return [PSCustomObject]@{
    name = $name
    label = $label
    description = $description
    labels = Get-AuraUiPropertyValue -InputObject $Item -Names @('labels')
    descriptions = Get-AuraUiPropertyValue -InputObject $Item -Names @('descriptions')
    swatches = @(Get-AuraUiPropertyValue -InputObject $Item -Names @('swatches'))
    preview = Get-AuraUiPropertyValue -InputObject $Item -Names @('preview')
    studioPreview = Get-AuraUiPropertyValue -InputObject $Item -Names @('studioPreview')
    source = Get-AuraUiPropertyValue -InputObject $Item -Names @('source')
  }
}

function Set-AuraUiFormWithinWorkingArea {
  param([AllowNull()][System.Windows.Forms.Form]$Form, [int]$Margin = 12)
  if ($null -eq $Form -or $Form.IsDisposed) { return }
  $workingArea = [System.Windows.Forms.Screen]::FromControl($Form).WorkingArea
  $maximumWidth = [Math]::Max(1, $workingArea.Width - ($Margin * 2))
  $maximumHeight = [Math]::Max(1, $workingArea.Height - ($Margin * 2))
  $width = [Math]::Min($Form.Width, $maximumWidth)
  $height = [Math]::Min($Form.Height, $maximumHeight)
  $Form.Size = [Drawing.Size]::new($width, $height)
  $Form.Location = [Drawing.Point]::new(
    $workingArea.Left + [Math]::Max($Margin, [Math]::Floor(($workingArea.Width - $width) / 2)),
    $workingArea.Top + [Math]::Max($Margin, [Math]::Floor(($workingArea.Height - $height) / 2)))
}

function Get-AuraUiThemeByName {
  param([AllowNull()][object]$Name)
  if ($null -eq $Name) { return $null }
  foreach ($themeItem in @($script:Themes)) {
    if ([string]::Equals("$($themeItem.name)", "$Name", [StringComparison]::OrdinalIgnoreCase)) {
      return $themeItem
    }
  }
  return $null
}

function Get-AuraUiSelectedThemeName {
  if ($script:ActiveThemeName) { return $script:ActiveThemeName }
  if ($null -ne $script:Config) { return Get-AuraUiPropertyValue -InputObject $script:Config -Names @('theme') }
  return $null
}

function Invoke-AuraUiNode {
  param([Parameter(Mandatory = $true)][string[]]$CommandArguments)
  $start = [System.Diagnostics.ProcessStartInfo]::new()
  $start.FileName = $script:Node.Path
  $start.Arguments = (($CommandArguments | ForEach-Object { ConvertTo-AuraUiArgument -Value "$_" }) -join ' ')
  $start.UseShellExecute = $false
  $start.CreateNoWindow = $true
  $start.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  # The helper emits UTF-8. Decode it as UTF-8 explicitly; otherwise .NET falls
  # back to the console/OEM code page (for example Big5 on a zh-TW system), which
  # corrupts localized theme metadata and can swallow JSON quote bytes.
  $start.StandardOutputEncoding = [System.Text.UTF8Encoding]::new($false)
  $start.StandardErrorEncoding = [System.Text.UTF8Encoding]::new($false)
  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $start
  if (-not $process.Start()) { throw 'A required Claude Aura helper could not start.' }
  $stdoutTask = $process.StandardOutput.ReadToEndAsync()
  $stderrTask = $process.StandardError.ReadToEndAsync()
  $process.WaitForExit()
  $stdout = $stdoutTask.GetAwaiter().GetResult()
  $stderr = $stderrTask.GetAwaiter().GetResult()
  if ($process.ExitCode -ne 0) {
    $detail = if ($stderr.Trim()) { $stderr.Trim() } else { "Helper exited with code $($process.ExitCode)." }
    throw $detail
  }
  if ($stderr.Trim()) { Write-AuraUiLog -Message "Theme helper warning: $($stderr.Trim())" }
  return $stdout
}

function Update-AuraUiThemes {
  $arguments = @($ThemeCli, 'list', '--json', '--locale', $script:Locale, '--user-themes', $UserThemesRoot)
  $themesJson = Invoke-AuraUiNode -CommandArguments $arguments
  $parsedThemes = $themesJson | ConvertFrom-Json
  $themeItems = @($parsedThemes)
  $normalizedThemes = @()
  for ($index = 0; $index -lt $themeItems.Count; $index++) {
    $metadata = ConvertTo-AuraUiThemeMetadata -Item $themeItems[$index] -Index $index
    if ($null -ne $metadata) { $normalizedThemes += $metadata }
  }
  if ($normalizedThemes.Count -eq 0) { throw "$($script:UiCopy.noThemes)" }
  $script:Themes = @($normalizedThemes)
  return $script:Themes
}

function Set-AuraUiPayloadState {
  param([Parameter(Mandatory = $true)][string]$Payload)
  $script:Payload = $Payload
  $match = [regex]::Match($script:Payload, '"label":"(?<label>[^"\\]+)"')
  if ($match.Success) { $script:ActiveLabel = $match.Groups['label'].Value }
  $themeMatch = [regex]::Match($script:Payload, '"theme":"(?<theme>[^"\\]+)"')
  if ($themeMatch.Success) { $script:ActiveThemeName = $themeMatch.Groups['theme'].Value }
}

function Set-AuraUiConfig {
  param([string[]]$Options)
  $arguments = @($ThemeCli, 'set', '--config', $ConfigPath, '--user-themes', $UserThemesRoot) + $Options
  if ($script:Locale) { $arguments += @('--locale', $script:Locale) }
  $arguments += '--payload'
  $payload = Invoke-AuraUiNode -CommandArguments $arguments
  $script:Config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
  Set-AuraUiPayloadState -Payload $payload
  Update-AuraUiTrayAppearance
  Send-AuraUiStudioState
}

function Test-AuraUiClaudeUri {
  param([AllowNull()][object]$Value)
  try {
    $uri = if ($Value -is [Uri]) { $Value } else { [Uri]"$Value" }
    if ($uri.Scheme -ne 'https') { return $false }
    $uriHost = $uri.Host.ToLowerInvariant()
    return $uriHost -eq 'claude.ai' -or $uriHost.EndsWith('.claude.ai') -or
      $uriHost -eq 'claude.com' -or $uriHost.EndsWith('.claude.com')
  } catch { return $false }
}

function Test-AuraUiSignInUri {
  param([AllowNull()][object]$Value)
  try {
    $uri = if ($Value -is [Uri]) { $Value } else { [Uri]"$Value" }
    if ($uri.Scheme -ne 'https') { return $false }
    $uriHost = $uri.Host.ToLowerInvariant()
    return $uriHost.EndsWith('.anthropic.com') -or $uriHost -eq 'anthropic.com' -or
      $uriHost -eq 'accounts.google.com' -or $uriHost.EndsWith('.accounts.google.com') -or
      $uriHost -eq 'appleid.apple.com' -or $uriHost -eq 'login.microsoftonline.com'
  } catch { return $false }
}

function Show-AuraUiMessage {
  param([string]$Message, [string]$Title = 'Claude Aura', [System.Windows.Forms.MessageBoxIcon]$Icon = [System.Windows.Forms.MessageBoxIcon]::Information)
  [void][System.Windows.Forms.MessageBox]::Show($script:Form, $Message, $Title,
    [System.Windows.Forms.MessageBoxButtons]::OK, $Icon)
}

function Show-AuraUiLoading {
  param([string]$Message, [bool]$Retry = $false)
  $script:LoadingLabel.Text = $Message
  $script:RetryButton.Visible = $Retry
  $script:LoadingProgress.Visible = -not $Retry
  $script:LoadingPanel.Visible = $true
  $script:LoadingPanel.BringToFront()
}

function Hide-AuraUiLoading {
  $script:LoadingPanel.Visible = $false
}

function Start-AuraUiScript {
  param([string]$Source, [ValidateSet('Apply', 'Restore')][string]$Action, [bool]$Cover = $false)
  if (-not $script:WebReady -or $null -eq $script:WebView.CoreWebView2) { return }
  if ($null -ne $script:ScriptTask -and -not $script:ScriptTask.IsCompleted) {
    # A script is already running (a common case during the sign-in redirect
    # burst). Keep the most recent user intent so Studio/tray changes cannot leave
    # persisted state out of sync with the live Claude document. A later Apply
    # supersedes Restore when the user turns the theme back on, and vice versa.
    if ($Action -eq 'Restore') {
      $script:PendingRestore = $true
      $script:PendingApply = $false
    } else {
      $script:PendingApply = $true
      $script:PendingRestore = $false
    }
    return
  }
  if ($Cover) { Show-AuraUiLoading -Message "$($script:UiCopy.applyingTheme)" }
  $script:ScriptAction = $Action
  $script:ScriptCovered = $Cover
  $script:ScriptTask = $script:WebView.ExecuteScriptAsync($Source)
}

function Apply-AuraUiTheme {
  param([bool]$Cover = $false)
  if (-not (Test-AuraUiClaudeUri -Value $script:WebView.Source)) {
    if ($Cover) { Hide-AuraUiLoading }
    return
  }
  Start-AuraUiScript -Source $script:Payload -Action Apply -Cover $Cover
}

function Fail-AuraUiStartup {
  param([System.Exception]$Exception)
  Write-AuraUiLog -Message $Exception.ToString()
  Show-AuraUiMessage -Title "$($script:UiCopy.startupTitle)" -Icon Error -Message (
    "$($script:UiCopy.startupMessage)" +
    [Environment]::NewLine + [Environment]::NewLine + "$($script:UiCopy.technicalDetails)" +
    [Environment]::NewLine + $LogPath)
  $script:Form.Close()
}

function Get-AuraUiEnabled {
  if ($null -eq $script:Config -or $null -eq $script:Config.PSObject.Properties['enabled']) { return $true }
  return [bool]$script:Config.enabled
}

function Update-AuraUiTrayAppearance {
  if ($null -eq $script:TrayAppearanceItem -or $script:TrayAppearanceItem.IsDisposed) { return }
  $script:TrayAppearanceItem.Text = if (Get-AuraUiEnabled) {
    "$($script:UiCopy.originalLook)"
  } else {
    "$($script:UiCopy.applyTheme)"
  }
}

function ConvertTo-AuraUiStudioNumber {
  param(
    [AllowNull()][object]$Value,
    [Parameter(Mandatory = $true)][double]$Minimum,
    [Parameter(Mandatory = $true)][double]$Maximum,
    [Parameter(Mandatory = $true)][string]$Label
  )
  if ($null -eq $Value -or $Value -is [bool] -or $Value -is [string] -or $Value -is [char]) {
    throw "$Label must be a number."
  }
  try { $number = [Convert]::ToDouble($Value, [Globalization.CultureInfo]::InvariantCulture) }
  catch { throw "$Label must be a number." }
  if ([double]::IsNaN($number) -or [double]::IsInfinity($number) -or
      $number -lt $Minimum -or $number -gt $Maximum) {
    throw "$Label must be between $Minimum and $Maximum."
  }
  return [Math]::Round($number, 2, [MidpointRounding]::AwayFromZero)
}

function Get-AuraUiStudioBackgroundCrop {
  $x = 50.0
  $y = 50.0
  $zoom = 1.0
  $supported = $true
  if ($null -ne $script:Config) {
    $positionValue = Get-AuraUiPropertyValue -InputObject $script:Config -Names @('imagePosition')
    if ($null -ne $positionValue) {
      $position = "$positionValue".Trim().ToLowerInvariant()
      $numberPattern = '[+-]?(?:\d+(?:\.\d+)?|\.\d+)'
      $match = [regex]::Match($position, "^(?<x>$numberPattern)%\s+(?<y>$numberPattern)%$")
      if ($match.Success) {
        $x = [double]::Parse($match.Groups['x'].Value, [Globalization.CultureInfo]::InvariantCulture)
        $y = [double]::Parse($match.Groups['y'].Value, [Globalization.CultureInfo]::InvariantCulture)
        $supported = $x -ge 0 -and $x -le 100 -and $y -ge 0 -and $y -le 100
      } else {
        $singlePercent = [regex]::Match($position, "^(?<x>$numberPattern)%$")
        if ($singlePercent.Success) {
          $x = [double]::Parse($singlePercent.Groups['x'].Value, [Globalization.CultureInfo]::InvariantCulture)
          $supported = $x -ge 0 -and $x -le 100
        } else {
          $keywordMatched = $true
          switch ($position) {
            'left' { $x = 0; break }
            'right' { $x = 100; break }
            'top' { $y = 0; break }
            'bottom' { $y = 100; break }
            'center' { break }
            'left top' { $x = 0; $y = 0; break }
            'top left' { $x = 0; $y = 0; break }
            'left center' { $x = 0; break }
            'center left' { $x = 0; break }
            'left bottom' { $x = 0; $y = 100; break }
            'bottom left' { $x = 0; $y = 100; break }
            'center top' { $y = 0; break }
            'top center' { $y = 0; break }
            'center center' { break }
            'center bottom' { $y = 100; break }
            'bottom center' { $y = 100; break }
            'right top' { $x = 100; $y = 0; break }
            'top right' { $x = 100; $y = 0; break }
            'right center' { $x = 100; break }
            'center right' { $x = 100; break }
            'right bottom' { $x = 100; $y = 100; break }
            'bottom right' { $x = 100; $y = 100; break }
            default { $keywordMatched = $false }
          }
          $supported = $keywordMatched
        }
      }
    }
    $zoomValue = Get-AuraUiPropertyValue -InputObject $script:Config -Names @('imageZoom')
    if ($null -ne $zoomValue) {
      try { $zoom = ConvertTo-AuraUiStudioNumber -Value $zoomValue -Minimum 1 -Maximum 2 -Label 'Background zoom' }
      catch { $zoom = 1.0 }
    }
  }
  return [ordered]@{
    x = [Math]::Max(0, [Math]::Min(100, $x))
    y = [Math]::Max(0, [Math]::Min(100, $y))
    zoom = $zoom
    supported = $supported
  }
}

function Get-AuraUiStudioPreviewCrops {
  $result = [ordered]@{}
  if ($null -eq $script:Config) { return $result }
  $source = Get-AuraUiPropertyValue -InputObject $script:Config -Names @('studioPreviewCrops')
  if ($null -eq $source) { return $result }
  foreach ($property in @($source.PSObject.Properties)) {
    $themeId = [string]$property.Name
    if ($themeId -cnotmatch '^[a-z][a-z0-9-]{1,39}$') { continue }
    $crop = $property.Value
    try {
      $result[$themeId] = [ordered]@{
        x = ConvertTo-AuraUiStudioNumber -Value (Get-AuraUiPropertyValue -InputObject $crop -Names @('x')) -Minimum 0 -Maximum 100 -Label 'Studio preview x'
        y = ConvertTo-AuraUiStudioNumber -Value (Get-AuraUiPropertyValue -InputObject $crop -Names @('y')) -Minimum 0 -Maximum 100 -Label 'Studio preview y'
        zoom = ConvertTo-AuraUiStudioNumber -Value (Get-AuraUiPropertyValue -InputObject $crop -Names @('zoom')) -Minimum 1 -Maximum 2 -Label 'Studio preview zoom'
      }
    } catch {
      Write-AuraUiLog -Message "Ignored invalid Studio preview crop for $themeId."
    }
  }
  return $result
}

function Get-AuraUiStudioBackgroundSourcePath {
  $imageValue = if ($null -ne $script:Config) {
    Get-AuraUiPropertyValue -InputObject $script:Config -Names @('image')
  } else { $null }
  if ($null -eq $imageValue -or -not "$imageValue".Trim()) { return $null }
  try {
    if ([IO.Path]::IsPathRooted("$imageValue")) {
      return [IO.Path]::GetFullPath("$imageValue")
    }
    return [IO.Path]::GetFullPath((Join-Path (Split-Path $ConfigPath -Parent) "$imageValue"))
  } catch { return $null }
}

function Clear-AuraUiStudioBackgroundPreview {
  param([AllowNull()][string]$PreservePath)
  $preserveFullPath = if ($PreservePath) {
    try { [IO.Path]::GetFullPath($PreservePath) } catch { $null }
  } else { $null }
  if (Test-Path -LiteralPath $StudioBackgroundRoot -PathType Container) {
    foreach ($marker in @(Get-ChildItem -LiteralPath $StudioBackgroundRoot -Filter '*.aura-cache' -File -ErrorAction SilentlyContinue)) {
      $targetPath = $marker.FullName.Substring(0, $marker.FullName.Length - '.aura-cache'.Length)
      $targetName = [IO.Path]::GetFileName($targetPath)
      if ($targetName -cnotmatch '^preview-[a-f0-9]{64}(?:-[a-f0-9]{32})?\.(?:png|jpe?g|webp|gif|avif)$') { continue }
      try { Remove-Item -LiteralPath $marker.FullName -Force } catch {}
      if ($preserveFullPath -and [string]::Equals($targetPath, $preserveFullPath, [StringComparison]::OrdinalIgnoreCase)) {
        continue
      }
      if (Test-Path -LiteralPath $targetPath -PathType Leaf) {
        try { Remove-Item -LiteralPath $targetPath -Force } catch {}
      }
    }
  }
  $script:StudioBackgroundFingerprint = $null
  $script:StudioBackgroundPreviewUrl = $null
  $script:StudioBackgroundPreviewPath = $null
}

function Sync-AuraUiStudioBackgroundPreview {
  $sourceStream = $null
  try {
    $sourcePath = Get-AuraUiStudioBackgroundSourcePath
    if (-not $sourcePath) {
      Clear-AuraUiStudioBackgroundPreview
      return $null
    }
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
      Clear-AuraUiStudioBackgroundPreview -PreservePath $sourcePath
      return $null
    }
    $extension = [IO.Path]::GetExtension($sourcePath).ToLowerInvariant()
    if ($extension -notin @('.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif')) {
      Clear-AuraUiStudioBackgroundPreview -PreservePath $sourcePath
      return $null
    }
    $info = [IO.FileInfo]::new($sourcePath)
    $sourceStream = [IO.File]::Open(
      $sourcePath,
      [IO.FileMode]::Open,
      [IO.FileAccess]::Read,
      [IO.FileShare]::Read)
    $sourceLength = $sourceStream.Length
    if ($sourceLength -gt $StudioBackgroundMaxBytes) {
      Clear-AuraUiStudioBackgroundPreview -PreservePath $sourcePath
      return $null
    }
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
      $hashBytes = $sha.ComputeHash($sourceStream)
      $contentHash = [BitConverter]::ToString($hashBytes).Replace('-', '').ToLowerInvariant()
    } finally {
      $sha.Dispose()
    }
    $sourceStream.Position = 0
    $fingerprint = "$sourcePath|$sourceLength|$($info.LastWriteTimeUtc.Ticks)|$contentHash"
    if ($script:StudioBackgroundFingerprint -ne $fingerprint -or
        -not $script:StudioBackgroundPreviewPath -or
        -not (Test-Path -LiteralPath $script:StudioBackgroundPreviewPath -PathType Leaf)) {
      [IO.Directory]::CreateDirectory($StudioBackgroundRoot) | Out-Null
      $targetName = "preview-$contentHash$extension"
      $targetPath = Join-Path $StudioBackgroundRoot $targetName
      Clear-AuraUiStudioBackgroundPreview -PreservePath $sourcePath
      while ([string]::Equals($sourcePath, $targetPath, [StringComparison]::OrdinalIgnoreCase) -or
             (Test-Path -LiteralPath $targetPath)) {
        $targetName = "preview-$contentHash-$([Guid]::NewGuid().ToString('N'))$extension"
        $targetPath = Join-Path $StudioBackgroundRoot $targetName
      }
      $markerPath = "$targetPath.aura-cache"
      $targetStream = [IO.File]::Open(
        $targetPath,
        [IO.FileMode]::CreateNew,
        [IO.FileAccess]::Write,
        [IO.FileShare]::None)
      try { $sourceStream.CopyTo($targetStream) } finally { $targetStream.Dispose() }
      [IO.File]::WriteAllText($markerPath, 'Claude Aura Studio background preview cache')
      $script:StudioBackgroundFingerprint = $fingerprint
      $script:StudioBackgroundPreviewPath = $targetPath
      $script:StudioBackgroundPreviewUrl = "https://aura.background/$targetName?v=$contentHash"
    }
    return $script:StudioBackgroundPreviewUrl
  } catch {
    Write-AuraUiLog -Message "Studio background preview could not be prepared: $($_.Exception.Message)"
    Clear-AuraUiStudioBackgroundPreview -PreservePath $sourcePath
    return $null
  } finally {
    if ($null -ne $sourceStream) { $sourceStream.Dispose() }
  }
}

function Get-AuraUiBackgroundAspectRatio {
  try {
    if ($null -ne $script:WebView -and -not $script:WebView.IsDisposed -and
        $script:WebView.ClientSize.Width -gt 0 -and $script:WebView.ClientSize.Height -gt 0) {
      return [Math]::Round($script:WebView.ClientSize.Width / $script:WebView.ClientSize.Height, 4)
    }
  } catch {}
  return [Math]::Round(16 / 9, 4)
}

function Send-AuraUiStudioState {
  param(
    [AllowEmptyString()][string]$Status = '',
    [ValidateSet('ok', 'busy', 'error')][string]$Tone = 'ok',
    [ValidateSet('', 'set-image-framing', 'set-card-preview-crop')][string]$Action = '',
    [bool]$ActionSucceeded = $true
  )
  if (-not $script:StudioReady -or $null -eq $script:StudioWebView -or
      $null -eq $script:StudioWebView.CoreWebView2) { return }
  try {
    $themeName = Get-AuraUiSelectedThemeName
    if (-not $themeName) { $themeName = 'default' }
    $enabled = Get-AuraUiEnabled
    if (-not $Status) {
      if ($enabled) {
        $theme = Get-AuraUiThemeByName -Name $themeName
        $label = if ($null -ne $theme) { "$($theme.label)" } elseif ($script:ActiveLabel) { $script:ActiveLabel } else { $themeName }
        $Status = "$($script:UiCopy.activeTheme)" -f $label
      } else {
        $Status = "$($script:UiCopy.originalActive)"
      }
    }
    $imageValue = if ($null -ne $script:Config) {
      Get-AuraUiPropertyValue -InputObject $script:Config -Names @('image')
    } else { $null }
    $imagePreviewUrl = Sync-AuraUiStudioBackgroundPreview
    $state = [ordered]@{
      type = 'state'
      theme = "$themeName"
      enabled = $enabled
      hasImage = ($null -ne $imageValue -and "$imageValue".Trim().Length -gt 0)
      imagePreviewUrl = $imagePreviewUrl
      backgroundAspectRatio = Get-AuraUiBackgroundAspectRatio
      backgroundCrop = Get-AuraUiStudioBackgroundCrop
      studioPreviewCrops = Get-AuraUiStudioPreviewCrops
      themes = @($script:Themes)
      status = $Status
      tone = $Tone
    }
    if ($Action) {
      $state['action'] = $Action
      $state['actionSucceeded'] = $ActionSucceeded
    }
    $json = $state | ConvertTo-Json -Depth 6 -Compress
    $script:StudioWebView.CoreWebView2.PostWebMessageAsJson($json)
  } catch {
    Write-AuraUiLog -Message "Studio state update failed: $($_.Exception.Message)"
  }
}

function Show-AuraUiStudio {
  if ($null -eq $script:StudioForm -or $script:StudioForm.IsDisposed) { return }
  if (-not $script:StudioForm.Visible) { $script:StudioForm.Show() }
  if ($script:StudioForm.WindowState -eq [System.Windows.Forms.FormWindowState]::Minimized) {
    $script:StudioForm.WindowState = [System.Windows.Forms.FormWindowState]::Normal
  }
  Set-AuraUiFormWithinWorkingArea -Form $script:StudioForm
  $script:StudioForm.Activate()
  $script:StudioForm.BringToFront()
}

function Invoke-AuraUiOpenDesktopApp {
  $claude = Get-AuraClaudeInstall
  Start-Process -FilePath $claude.Executable | Out-Null
}

function Assert-AuraUiThemeKitTree {
  param([Parameter(Mandatory = $true)][string]$Source)
  $sourceItem = Get-Item -LiteralPath $Source -Force
  if (-not $sourceItem.PSIsContainer) { throw 'The selected theme kit must be a folder.' }
  if (($sourceItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'Theme kit folders cannot be symbolic links or junctions.'
  }
  $sourceRoot = [IO.Path]::GetFullPath($sourceItem.FullName).TrimEnd(
    [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  $sourcePrefix = $sourceRoot + [IO.Path]::DirectorySeparatorChar
  $pending = [Collections.Generic.Queue[IO.DirectoryInfo]]::new()
  $pending.Enqueue([IO.DirectoryInfo]$sourceItem)
  while ($pending.Count -gt 0) {
    $directory = $pending.Dequeue()
    foreach ($entry in $directory.GetFileSystemInfos()) {
      if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Theme kit entries cannot be symbolic links or junctions: $($entry.Name)"
      }
      $entryPath = [IO.Path]::GetFullPath($entry.FullName)
      if (-not $entryPath.StartsWith($sourcePrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'A theme kit entry resolves outside the selected folder.'
      }
      if ($entry -is [IO.DirectoryInfo]) { $pending.Enqueue($entry) }
      elseif ($entry -isnot [IO.FileInfo]) { throw "Unsupported theme kit entry: $($entry.Name)" }
    }
  }
  return $sourceRoot
}

function Assert-AuraUiThemeInstallRoot {
  param([switch]$Create)
  $localRoot = [IO.Path]::GetFullPath($env:LOCALAPPDATA).TrimEnd(
    [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  $expectedDataRoot = [IO.Path]::GetFullPath((Join-Path (Join-Path $localRoot 'ClaudeAura') 'data')).TrimEnd(
    [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  $dataRootPath = [IO.Path]::GetFullPath($DataRoot).TrimEnd(
    [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  $userRoot = [IO.Path]::GetFullPath($UserThemesRoot).TrimEnd(
    [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  $expectedUserRoot = [IO.Path]::GetFullPath((Join-Path $dataRootPath 'themes')).TrimEnd(
    [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  if (-not [string]::Equals($dataRootPath, $expectedDataRoot, [StringComparison]::OrdinalIgnoreCase) -or
      -not [string]::Equals($userRoot, $expectedUserRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'The installed user themes folder is outside Claude Aura app data.'
  }

  $paths = @((Join-Path $localRoot 'ClaudeAura'), $dataRootPath, $userRoot)
  foreach ($candidate in $paths) {
    if (-not (Test-Path -LiteralPath $candidate)) {
      if (-not $Create) { throw 'The installed user themes folder is unavailable.' }
      [void][IO.Directory]::CreateDirectory($candidate)
    }
    $item = Get-Item -LiteralPath $candidate -Force
    if (-not $item.PSIsContainer -or
        ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'Claude Aura theme install folders cannot be symbolic links or junctions.'
    }
  }
  return $userRoot
}

function Copy-AuraUiThemeKit {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Id
  )
  if ($Id -cnotmatch '^[a-z][a-z0-9-]{1,39}$') { throw 'The validated theme id is invalid.' }
  $sourceRoot = Assert-AuraUiThemeKitTree -Source $Source
  $userRoot = Assert-AuraUiThemeInstallRoot -Create
  $userPrefix = $userRoot + [IO.Path]::DirectorySeparatorChar
  $sourcePrefix = $sourceRoot + [IO.Path]::DirectorySeparatorChar
  if ([string]::Equals($sourceRoot, $userRoot, [StringComparison]::OrdinalIgnoreCase) -or
      $sourceRoot.StartsWith($userPrefix, [StringComparison]::OrdinalIgnoreCase) -or
      $userRoot.StartsWith($sourcePrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Select a theme kit folder outside the installed user themes folder.'
  }
  $destination = [IO.Path]::GetFullPath((Join-Path $userRoot $Id))
  if (-not $destination.StartsWith($userPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'The theme destination resolves outside the user themes folder.'
  }
  if ([IO.Directory]::Exists($destination) -or [IO.File]::Exists($destination)) {
    throw ("$($script:UiCopy.themeAlreadyInstalled)" -f $Id)
  }
  $staging = [IO.Path]::GetFullPath((Join-Path $userRoot ('.install-{0}-{1}' -f $Id, [Guid]::NewGuid().ToString('N'))))
  if (-not $staging.StartsWith($userPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'The staging folder resolves outside the user themes folder.'
  }
  [void][IO.Directory]::CreateDirectory($staging)
  try {
    $pending = [Collections.Generic.Queue[object]]::new()
    $pending.Enqueue([PSCustomObject]@{
      Source = [IO.DirectoryInfo]::new($sourceRoot)
      Target = $staging
    })
    while ($pending.Count -gt 0) {
      $item = $pending.Dequeue()
      foreach ($entry in $item.Source.GetFileSystemInfos()) {
        if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
          throw "Theme kit entries cannot be symbolic links or junctions: $($entry.Name)"
        }
        $entryPath = [IO.Path]::GetFullPath($entry.FullName)
        if (-not $entryPath.StartsWith($sourcePrefix, [StringComparison]::OrdinalIgnoreCase)) {
          throw 'A theme kit entry resolves outside the selected folder.'
        }
        $targetPath = [IO.Path]::GetFullPath((Join-Path $item.Target $entry.Name))
        if (-not $targetPath.StartsWith(($staging + [IO.Path]::DirectorySeparatorChar), [StringComparison]::OrdinalIgnoreCase)) {
          throw 'A copied theme kit entry resolves outside the staging folder.'
        }
        if ($entry -is [IO.DirectoryInfo]) {
          [void][IO.Directory]::CreateDirectory($targetPath)
          $pending.Enqueue([PSCustomObject]@{ Source = $entry; Target = $targetPath })
        } elseif ($entry -is [IO.FileInfo]) {
          [IO.File]::Copy($entry.FullName, $targetPath, $false)
        } else {
          throw "Unsupported theme kit entry: $($entry.Name)"
        }
      }
    }
    $verifiedUserRoot = Assert-AuraUiThemeInstallRoot
    if (-not [string]::Equals($verifiedUserRoot, $userRoot, [StringComparison]::OrdinalIgnoreCase)) {
      throw 'The installed user themes folder changed during import.'
    }
    $stagingItem = Get-Item -LiteralPath $staging -Force
    if (-not $stagingItem.PSIsContainer -or
        ($stagingItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'The theme staging folder changed during import.'
    }
    [IO.Directory]::Move($staging, $destination)
    return $destination
  } catch {
    $copyFailure = $_
    try {
      $cleanupRoot = Assert-AuraUiThemeInstallRoot
      if ([string]::Equals($cleanupRoot, $userRoot, [StringComparison]::OrdinalIgnoreCase) -and
          [IO.Directory]::Exists($staging) -and
          $staging.StartsWith($userPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        $cleanupItem = Get-Item -LiteralPath $staging -Force
        if ($cleanupItem.PSIsContainer -and
            ($cleanupItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) {
          [IO.Directory]::Delete($staging, $true)
        }
      }
    } catch {}
    throw $copyFailure
  }
}

function Remove-AuraUiInstalledTheme {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Id
  )
  if ($Id -cnotmatch '^[a-z][a-z0-9-]{1,39}$') { throw 'The installed theme id is invalid.' }
  $userRoot = Assert-AuraUiThemeInstallRoot
  $target = [IO.Path]::GetFullPath($Path)
  $expectedTarget = [IO.Path]::GetFullPath((Join-Path $userRoot $Id))
  if (-not [string]::Equals($target, $expectedTarget, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Refusing to remove a theme outside its exact user-theme destination.'
  }
  if ([IO.Directory]::Exists($target)) {
    $targetItem = Get-Item -LiteralPath $target -Force
    if (-not $targetItem.PSIsContainer -or
        ($targetItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'Refusing to recursively remove a linked theme destination.'
    }
    [IO.Directory]::Delete($target, $true)
  }
}

function Restore-AuraUiConfigSnapshot {
  param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Json)
  [void]($Json | ConvertFrom-Json)
  $configDirectory = Split-Path $ConfigPath -Parent
  [void][IO.Directory]::CreateDirectory($configDirectory)
  $temporary = Join-Path $configDirectory ('.config-rollback-{0}.json' -f [Guid]::NewGuid().ToString('N'))
  $backup = Join-Path $configDirectory ('.config-backup-{0}.json' -f [Guid]::NewGuid().ToString('N'))
  try {
    [IO.File]::WriteAllText($temporary, $Json, [Text.UTF8Encoding]::new($false))
    if ([IO.File]::Exists($ConfigPath)) {
      [IO.File]::Replace($temporary, $ConfigPath, $backup)
    } else {
      [IO.File]::Move($temporary, $ConfigPath)
    }
  } finally {
    if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) }
    if ([IO.File]::Exists($backup)) { [IO.File]::Delete($backup) }
  }
  $payload = Invoke-AuraUiNode -CommandArguments @(
    $ThemeCli, 'init', '--config', $ConfigPath, '--locale', $script:Locale,
    '--user-themes', $UserThemesRoot, '--payload')
  $script:Config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
  Set-AuraUiPayloadState -Payload $payload
  Update-AuraUiTrayAppearance
  Apply-AuraUiTheme
}

function Invoke-AuraUiImportTheme {
  param([AllowNull()][System.Windows.Forms.IWin32Window]$Owner)
  $dialog = [System.Windows.Forms.FolderBrowserDialog]::new()
  $installedPath = $null
  $importedId = $null
  $previousConfigJson = $null
  try {
    $previousConfigJson = [IO.File]::ReadAllText($ConfigPath, [Text.Encoding]::UTF8)
    $dialog.Description = "$($script:UiCopy.chooseThemeFolder)"
    $dialog.ShowNewFolderButton = $false
    if ($dialog.ShowDialog($Owner) -ne [System.Windows.Forms.DialogResult]::OK) {
      Send-AuraUiStudioState
      return $false
    }
    Send-AuraUiStudioState -Status "$($script:UiCopy.installingTheme)" -Tone busy
    $validationJson = Invoke-AuraUiNode -CommandArguments @(
      $ThemeCli, 'validate', $dialog.SelectedPath, '--locale', $script:Locale,
      '--user-themes', $UserThemesRoot)
    $validation = $validationJson | ConvertFrom-Json
    if ($validation.pass -isnot [bool] -or -not $validation.pass -or
        $validation.theme -isnot [string] -or $validation.theme -cnotmatch '^[a-z][a-z0-9-]{1,39}$') {
      throw 'The theme validator did not return a valid theme id.'
    }
    $importedId = [string]$validation.theme
    if ($null -ne (Get-AuraUiThemeByName -Name $importedId)) {
      throw ("$($script:UiCopy.themeAlreadyInstalled)" -f $importedId)
    }
    $installedPath = Copy-AuraUiThemeKit -Source $dialog.SelectedPath -Id $importedId
    [void](Update-AuraUiThemes)
    $importedTheme = Get-AuraUiThemeByName -Name $importedId
    if ($null -eq $importedTheme -or "$($importedTheme.source)" -cne 'user') {
      throw 'The installed theme did not appear in the user theme registry.'
    }
    Invoke-AuraUiSelectTheme -Theme $importedId
    Send-AuraUiStudioState -Status ("$($script:UiCopy.themeInstalled)" -f "$($importedTheme.label)")
    return $true
  } catch {
    $failure = $_
    if ($installedPath) {
      try { Remove-AuraUiInstalledTheme -Path $installedPath -Id $importedId }
      catch { Write-AuraUiLog -Message "Theme import rollback failed: $($_.Exception.Message)" }
      try {
        [void](Update-AuraUiThemes)
        Restore-AuraUiConfigSnapshot -Json $previousConfigJson
      } catch { Write-AuraUiLog -Message "Theme import state recovery failed: $($_.Exception.Message)" }
    }
    $detail = ($failure.Exception.Message -replace '[\r\n]+', ' ').Trim()
    if ($detail.Length -gt 600) { $detail = $detail.Substring(0, 600) }
    Write-AuraUiLog -Message "Theme import failed: $detail"
    Send-AuraUiStudioState -Status ("$($script:UiCopy.themeInstallFailed)" -f $detail) -Tone error
    return $false
  } finally {
    $dialog.Dispose()
  }
}

function Invoke-AuraUiSelectTheme {
  param([Parameter(Mandatory = $true)][string]$Theme)
  if ($Theme -cnotmatch '^[a-z][a-z0-9-]{1,39}$') { throw 'Invalid Studio theme id.' }
  $knownTheme = $false
  foreach ($themeItem in @($script:Themes)) {
    if ([string]::Equals("$($themeItem.name)", $Theme, [StringComparison]::Ordinal)) {
      $knownTheme = $true
      break
    }
  }
  if (-not $knownTheme) { throw 'The Studio requested an unknown theme.' }
  Set-AuraUiConfig -Options @('--theme', $Theme, '--enabled', 'true')
  Apply-AuraUiTheme
  Send-AuraUiStudioState -Status "$($script:UiCopy.applyingTheme)" -Tone busy
}

function Invoke-AuraUiChooseBackground {
  param([AllowNull()][System.Windows.Forms.IWin32Window]$Owner)
  $dialog = [System.Windows.Forms.OpenFileDialog]::new()
  try {
    $dialog.Title = "$($script:UiCopy.chooseBackgroundTitle)"
    $dialog.Filter = "$($script:UiCopy.imagesFilter)|*.png;*.jpg;*.jpeg;*.webp;*.gif;*.avif"
    $dialog.CheckFileExists = $true
    if ($dialog.ShowDialog($Owner) -ne [System.Windows.Forms.DialogResult]::OK) {
      Send-AuraUiStudioState
      return $false
    }
    Clear-AuraUiStudioBackgroundPreview -PreservePath (Get-AuraUiStudioBackgroundSourcePath)
    Set-AuraUiConfig -Options @(
      '--image', $dialog.FileName,
      '--image-position', 'center',
      '--image-zoom', '1',
      '--enabled', 'true')
    Apply-AuraUiTheme
    Send-AuraUiStudioState -Status "$($script:UiCopy.applyingBackground)" -Tone busy
    return $true
  } finally {
    $dialog.Dispose()
  }
}

function Invoke-AuraUiClearBackground {
  Clear-AuraUiStudioBackgroundPreview -PreservePath (Get-AuraUiStudioBackgroundSourcePath)
  Set-AuraUiConfig -Options @(
    '--clear-image',
    '--image-position', 'center',
    '--image-zoom', '1',
    '--enabled', 'true')
  Apply-AuraUiTheme
  Send-AuraUiStudioState -Status "$($script:UiCopy.removingBackground)" -Tone busy
}

function Invoke-AuraUiSetImageFraming {
  param(
    [Parameter(Mandatory = $true)][object]$X,
    [Parameter(Mandatory = $true)][object]$Y,
    [Parameter(Mandatory = $true)][object]$Zoom
  )
  $imageValue = if ($null -ne $script:Config) {
    Get-AuraUiPropertyValue -InputObject $script:Config -Names @('image')
  } else { $null }
  if ($null -eq $imageValue -or -not "$imageValue".Trim()) { throw 'No background image is available to frame.' }
  $xValue = ConvertTo-AuraUiStudioNumber -Value $X -Minimum 0 -Maximum 100 -Label 'Background x'
  $yValue = ConvertTo-AuraUiStudioNumber -Value $Y -Minimum 0 -Maximum 100 -Label 'Background y'
  $zoomValue = ConvertTo-AuraUiStudioNumber -Value $Zoom -Minimum 1 -Maximum 2 -Label 'Background zoom'
  $culture = [Globalization.CultureInfo]::InvariantCulture
  $position = $xValue.ToString('0.##', $culture) + '% ' + $yValue.ToString('0.##', $culture) + '%'
  Set-AuraUiConfig -Options @(
    '--image-position', $position,
    '--image-zoom', $zoomValue.ToString('0.##', $culture),
    '--enabled', 'true')
  Apply-AuraUiTheme
  Send-AuraUiStudioState -Status "$($script:UiCopy.backgroundPositionSaved)" -Action 'set-image-framing'
}

function Invoke-AuraUiSetCardPreviewCrop {
  param(
    [Parameter(Mandatory = $true)][string]$Theme,
    [Parameter(Mandatory = $true)][object]$X,
    [Parameter(Mandatory = $true)][object]$Y,
    [Parameter(Mandatory = $true)][object]$Zoom
  )
  if ($Theme -cnotmatch '^[a-z][a-z0-9-]{1,39}$') { throw 'Invalid Studio preview theme id.' }
  $knownTheme = $false
  foreach ($themeItem in @($script:Themes)) {
    if ([string]::Equals("$($themeItem.name)", $Theme, [StringComparison]::Ordinal)) {
      $knownTheme = $true
      break
    }
  }
  if (-not $knownTheme) { throw 'The Studio requested an unknown preview theme.' }
  $xValue = ConvertTo-AuraUiStudioNumber -Value $X -Minimum 0 -Maximum 100 -Label 'Studio preview x'
  $yValue = ConvertTo-AuraUiStudioNumber -Value $Y -Minimum 0 -Maximum 100 -Label 'Studio preview y'
  $zoomValue = ConvertTo-AuraUiStudioNumber -Value $Zoom -Minimum 1 -Maximum 2 -Label 'Studio preview zoom'
  $culture = [Globalization.CultureInfo]::InvariantCulture
  Set-AuraUiConfig -Options @(
    '--studio-preview-theme', $Theme,
    '--studio-preview-x', $xValue.ToString('0.##', $culture),
    '--studio-preview-y', $yValue.ToString('0.##', $culture),
    '--studio-preview-zoom', $zoomValue.ToString('0.##', $culture))
  Send-AuraUiStudioState -Status "$($script:UiCopy.previewPositionSaved)" -Action 'set-card-preview-crop'
}

function Invoke-AuraUiSetEnabled {
  param([Parameter(Mandatory = $true)][bool]$Enabled)
  Set-AuraUiConfig -Options @('--enabled', $Enabled.ToString().ToLowerInvariant())
  if ($Enabled) {
    Apply-AuraUiTheme
    Send-AuraUiStudioState -Status "$($script:UiCopy.applyingTheme)" -Tone busy
  } else {
    $cleanup = '(() => { window.__CLAUDE_AURA_DISABLED__ = true; return window.__CLAUDE_AURA_STATE__?.cleanup?.() ?? true; })()'
    if ($script:WebReady -and (Test-AuraUiClaudeUri -Value $script:WebView.Source)) {
      Start-AuraUiScript -Source $cleanup -Action Restore
    }
    Send-AuraUiStudioState -Status "$($script:UiCopy.originalActive)"
  }
}

function Get-AuraUiStudioMessage {
  param(
    [Parameter(Mandatory = $true)][string]$Json,
    [Parameter(Mandatory = $true)][string]$Source
  )
  if ($Json.Length -gt 4096) { throw 'Studio message is too large.' }
  try { $sourceUri = [Uri]$Source } catch { throw 'Studio message source is invalid.' }
  if ($sourceUri.Scheme -cne 'https' -or $sourceUri.Host -cne 'aura.studio') {
    throw 'Studio message source is not allowed.'
  }
  try { $message = $Json | ConvertFrom-Json } catch { throw 'Studio message is not valid JSON.' }
  if ($message -isnot [System.Management.Automation.PSCustomObject]) { throw 'Studio message must be an object.' }
  $typeProperty = $message.PSObject.Properties['type']
  if ($null -eq $typeProperty -or $message.type -isnot [string]) { throw 'Studio message type is required.' }
  if ($script:StudioMessageTypes -cnotcontains $message.type) { throw 'Studio message type is not allowed.' }
  $type = [string]$message.type
  $expectedProperties = @(switch -CaseSensitive ($type) {
    'set-theme' { 'type'; 'theme'; break }
    'set-enabled' { 'type'; 'enabled'; break }
    'set-image-framing' { 'type'; 'x'; 'y'; 'zoom'; break }
    'set-card-preview-crop' { 'type'; 'theme'; 'x'; 'y'; 'zoom'; break }
    default { 'type'; break }
  })
  $propertyNames = @($message.PSObject.Properties | ForEach-Object { $_.Name })
  if ($propertyNames.Count -ne $expectedProperties.Count) { throw 'Studio message has unexpected properties.' }
  foreach ($name in $expectedProperties) {
    if ($propertyNames -cnotcontains $name) { throw 'Studio message is missing a required property.' }
  }
  return $message
}

function Invoke-AuraUiStudioMessage {
  param(
    [Parameter(Mandatory = $true)][string]$Json,
    [Parameter(Mandatory = $true)][string]$Source
  )
  $message = Get-AuraUiStudioMessage -Json $Json -Source $Source
  $type = [string]$message.type
  switch -CaseSensitive ($type) {
    'get-state' { Send-AuraUiStudioState; break }
    'set-theme' {
      if ($message.theme -isnot [string]) { throw 'Studio theme must be a string.' }
      Invoke-AuraUiSelectTheme -Theme ([string]$message.theme)
      break
    }
    'set-image' { [void](Invoke-AuraUiChooseBackground -Owner $script:StudioForm); break }
    'clear-image' { Invoke-AuraUiClearBackground; break }
    'set-image-framing' {
      Invoke-AuraUiSetImageFraming -X $message.x -Y $message.y -Zoom $message.zoom
      break
    }
    'set-card-preview-crop' {
      if ($message.theme -isnot [string]) { throw 'Studio preview theme must be a string.' }
      Invoke-AuraUiSetCardPreviewCrop -Theme ([string]$message.theme) -X $message.x -Y $message.y -Zoom $message.zoom
      break
    }
    'set-enabled' {
      if ($message.enabled -isnot [bool]) { throw 'Studio enabled state must be a Boolean.' }
      Invoke-AuraUiSetEnabled -Enabled $message.enabled
      break
    }
    'open-desktop' { Invoke-AuraUiOpenDesktopApp; Send-AuraUiStudioState; break }
    'import-theme' {
      [void](Invoke-AuraUiImportTheme -Owner $script:StudioForm)
      break
    }
  }
}

$script:Node = $null
$script:Config = $null
$script:Payload = ''
$script:ActiveLabel = ''
$script:ActiveThemeName = $null
$script:Form = $null
$script:WebView = $null
$script:WebReady = $false
$script:EnvironmentTask = $null
$script:EnsureTask = $null
$script:ScriptTask = $null
$script:ScriptAction = $null
$script:ScriptCovered = $false
$script:Themes = @()
$script:UiCopy = $null
$script:Locale = 'en'
$script:StudioMessageTypes = @(
  'get-state',
  'set-theme',
  'set-image',
  'clear-image',
  'set-image-framing',
  'set-card-preview-crop',
  'set-enabled',
  'open-desktop',
  'import-theme'
)
$script:StudioForm = $null
$script:StudioWebView = $null
$script:StudioEnsureTask = $null
$script:StudioReady = $false
$script:StudioInitializationFailed = $false
$script:StudioBackgroundFingerprint = $null
$script:StudioBackgroundPreviewUrl = $null
$script:StudioBackgroundPreviewPath = $null
$script:WebViewEnvironment = $null
$script:TrayIcon = $null
$script:TrayMenu = $null
$script:TrayOpenStudioItem = $null
$script:TrayAppearanceItem = $null
$script:TrayOpenDesktopItem = $null
$script:TrayExitItem = $null
$script:Closing = $false
$mutex = $null
$ownsMutex = $false

try {
  if ([Threading.Thread]::CurrentThread.ApartmentState -ne [Threading.ApartmentState]::STA) {
    throw 'Claude Aura must run in a standard Windows desktop session.'
  }

  New-Item -ItemType Directory -Force -Path $DataRoot, $WebDataRoot, $StudioBackgroundRoot | Out-Null
  $script:Node = Get-AuraNodeRuntime
  $locale = [Globalization.CultureInfo]::CurrentUICulture.Name
  if (-not $locale) { $locale = 'en' }
  $script:Locale = $locale
  $script:UiCopy = Get-AuraUiCopy -Locale $locale
  $script:ActiveLabel = "$($script:UiCopy.theme)"

  $initialOptions = @()
  if ($Theme) { $initialOptions += @('--theme', $Theme) }
  if ($Image) {
    $initialOptions += @(
      '--image', [System.IO.Path]::GetFullPath($Image),
      '--image-position', 'center',
      '--image-zoom', '1')
  }
  if ($ClearImage) {
    $initialOptions += @('--clear-image', '--image-position', 'center', '--image-zoom', '1')
  }
  if ($Mode -eq 'Restore') { $initialOptions += @('--enabled', 'false') }
  elseif ($Theme -or $Image -or $ClearImage) { $initialOptions += @('--enabled', 'true') }
  if ($initialOptions.Count -gt 0) { Set-AuraUiConfig -Options $initialOptions }
  else {
    $initialPayload = Invoke-AuraUiNode -CommandArguments @(
      $ThemeCli, 'init', '--config', $ConfigPath, '--locale', $script:Locale,
      '--user-themes', $UserThemesRoot, '--payload')
    $script:Config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Set-AuraUiPayloadState -Payload $initialPayload
  }

  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  $coreDll = Join-Path $VendorRoot 'Microsoft.Web.WebView2.Core.dll'
  $formsDll = Join-Path $VendorRoot 'Microsoft.Web.WebView2.WinForms.dll'
  $architecture = [System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture.ToString().ToLowerInvariant()
  if ($architecture -notin @('x64', 'x86', 'arm64')) { $architecture = 'x64' }
  $loaderRoot = Join-Path $VendorRoot "runtimes\$architecture"
  $loaderDll = Join-Path $loaderRoot 'WebView2Loader.dll'
  foreach ($required in @($coreDll, $formsDll, $loaderDll)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "A required WebView2 component is missing: $required" }
  }
  $env:PATH = "$loaderRoot;$VendorRoot;$env:PATH"
  [void][Reflection.Assembly]::LoadFrom($coreDll)
  [void][Reflection.Assembly]::LoadFrom($formsDll)

  if (-not ('AuraWindow' -as [type])) {
    Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class AuraWindow {
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindow(string className, string windowName);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr handle);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr handle, int command);
}
'@
  }
  $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $createdNew = $false
  $mutex = [System.Threading.Mutex]::new($true, "Local\ClaudeAura.$sid.Ui", [ref]$createdNew)
  $ownsMutex = $createdNew
  if (-not $createdNew) {
    $handle = [AuraWindow]::FindWindow($null, 'Claude Aura')
    if ($handle -ne [IntPtr]::Zero) {
      [void][AuraWindow]::ShowWindow($handle, 9)
      [void][AuraWindow]::SetForegroundWindow($handle)
    }
    return
  }

  [System.Windows.Forms.Application]::EnableVisualStyles()
  [System.Windows.Forms.Application]::SetCompatibleTextRenderingDefault($false)

  $script:Form = [System.Windows.Forms.Form]::new()
  $script:Form.Text = 'Claude Aura'
  $script:Form.StartPosition = 'Manual'
  $script:Form.ClientSize = [Drawing.Size]::new(1180, 640)
  $script:Form.MinimumSize = [Drawing.Size]::new(920, 620)
  $script:Form.BackColor = [Drawing.ColorTranslator]::FromHtml('#F4F1EA')
  $script:Form.AutoScaleMode = [System.Windows.Forms.AutoScaleMode]::Dpi
  Set-AuraUiFormWithinWorkingArea -Form $script:Form
  $script:Form.add_Shown({ Set-AuraUiFormWithinWorkingArea -Form $script:Form })

  [void](Update-AuraUiThemes)

  $script:WebView = [Microsoft.Web.WebView2.WinForms.WebView2]::new()
  $script:WebView.Dock = 'Fill'
  $script:WebView.BackColor = [Drawing.ColorTranslator]::FromHtml('#F4F1EA')
  $script:WebView.add_Resize({
    if ($null -ne $script:StudioForm -and $script:StudioForm.Visible) { Send-AuraUiStudioState }
  })

  $script:StudioForm = [System.Windows.Forms.Form]::new()
  $script:StudioForm.Text = "$($script:UiCopy.studioTitle)"
  $script:StudioForm.StartPosition = 'Manual'
  $script:StudioForm.ClientSize = [Drawing.Size]::new(1080, 720)
  $script:StudioForm.MinimumSize = [Drawing.Size]::new(760, 560)
  $script:StudioForm.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::Sizable
  $script:StudioForm.AutoScaleMode = [System.Windows.Forms.AutoScaleMode]::Dpi
  $script:StudioForm.BackColor = [Drawing.ColorTranslator]::FromHtml('#FAF9F5')
  $script:StudioForm.ShowInTaskbar = $true
  $script:StudioWebView = [Microsoft.Web.WebView2.WinForms.WebView2]::new()
  $script:StudioWebView.Dock = 'Fill'
  $script:StudioWebView.BackColor = [Drawing.ColorTranslator]::FromHtml('#FAF9F5')
  $script:StudioForm.Controls.Add($script:StudioWebView)
  $script:StudioForm.add_Shown({
    Set-AuraUiFormWithinWorkingArea -Form $script:StudioForm
    Send-AuraUiStudioState
  })
  $script:StudioForm.add_FormClosing({
    param($sender, $eventArgs)
    if (-not $script:Closing -and $eventArgs.CloseReason -eq [System.Windows.Forms.CloseReason]::UserClosing) {
      $eventArgs.Cancel = $true
      $sender.Hide()
    }
  })

  $script:TrayOpenStudioItem = [System.Windows.Forms.ToolStripMenuItem]::new("$($script:UiCopy.openStudio)")
  $script:TrayAppearanceItem = [System.Windows.Forms.ToolStripMenuItem]::new("$($script:UiCopy.originalLook)")
  $script:TrayOpenDesktopItem = [System.Windows.Forms.ToolStripMenuItem]::new("$($script:UiCopy.openDesktopApp)")
  $script:TrayExitItem = [System.Windows.Forms.ToolStripMenuItem]::new("$($script:UiCopy.exitApp)")
  $script:TrayMenu = [System.Windows.Forms.ContextMenuStrip]::new()
  [void]$script:TrayMenu.Items.AddRange(@(
    $script:TrayOpenStudioItem,
    $script:TrayAppearanceItem,
    $script:TrayOpenDesktopItem,
    [System.Windows.Forms.ToolStripSeparator]::new(),
    $script:TrayExitItem
  ))
  $script:TrayMenu.add_Opening({ Update-AuraUiTrayAppearance })
  $script:TrayOpenStudioItem.add_Click({ Show-AuraUiStudio })
  $script:TrayAppearanceItem.add_Click({
    try {
      Invoke-AuraUiSetEnabled -Enabled (-not (Get-AuraUiEnabled))
    } catch {
      Write-AuraUiLog -Message $_.Exception.ToString()
      Show-AuraUiMessage -Title "$($script:UiCopy.appearanceNotChangedTitle)" -Icon Warning -Message "$($script:UiCopy.appearanceNotChangedMessage)"
      Send-AuraUiStudioState -Status "$($script:UiCopy.appearanceNotChangedMessage)" -Tone error
    }
  })
  $script:TrayOpenDesktopItem.add_Click({
    try {
      Invoke-AuraUiOpenDesktopApp
    } catch {
      Write-AuraUiLog -Message $_.Exception.ToString()
      Show-AuraUiMessage -Title "$($script:UiCopy.desktopNotFoundTitle)" -Icon Information -Message "$($script:UiCopy.desktopNotFoundMessage)"
    }
  })
  $script:TrayExitItem.add_Click({ $script:Form.Close() })
  $script:TrayIcon = [System.Windows.Forms.NotifyIcon]::new()
  $script:TrayIcon.Text = 'Claude Aura'
  $script:TrayIcon.Icon = [Drawing.SystemIcons]::Application
  $script:TrayIcon.ContextMenuStrip = $script:TrayMenu
  $script:TrayIcon.add_DoubleClick({ Show-AuraUiStudio })
  $script:TrayIcon.Visible = $true
  Update-AuraUiTrayAppearance

  $script:LoadingPanel = [System.Windows.Forms.Panel]::new()
  $script:LoadingPanel.Dock = 'Fill'
  $script:LoadingPanel.BackColor = [Drawing.ColorTranslator]::FromHtml('#F7F3EB')
  $script:LoadingLabel = [System.Windows.Forms.Label]::new()
  $script:LoadingLabel.Text = "$($script:UiCopy.openingClaude)"
  $script:LoadingLabel.TextAlign = 'MiddleCenter'
  $script:LoadingLabel.Font = [Drawing.Font]::new('Segoe UI Semibold', 15)
  $script:LoadingLabel.ForeColor = [Drawing.ColorTranslator]::FromHtml('#332A3B')
  $script:LoadingLabel.Size = [Drawing.Size]::new(500, 44)
  $script:LoadingProgress = [System.Windows.Forms.ProgressBar]::new()
  $script:LoadingProgress.Style = 'Marquee'
  $script:LoadingProgress.MarqueeAnimationSpeed = 24
  $script:LoadingProgress.Size = [Drawing.Size]::new(320, 7)
  $script:RetryButton = [System.Windows.Forms.Button]::new()
  $script:RetryButton.Text = "$($script:UiCopy.retry)"
  $script:RetryButton.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
  $script:RetryButton.FlatAppearance.BorderSize = 1
  $script:RetryButton.FlatAppearance.BorderColor = [Drawing.ColorTranslator]::FromHtml('#5B3E73')
  $script:RetryButton.BackColor = [Drawing.ColorTranslator]::FromHtml('#5B3E73')
  $script:RetryButton.ForeColor = [Drawing.Color]::White
  $script:RetryButton.UseVisualStyleBackColor = $false
  $script:RetryButton.Cursor = [System.Windows.Forms.Cursors]::Hand
  $script:RetryButton.AccessibleName = "$($script:UiCopy.retry)"
  $script:RetryButton.AccessibleRole = [System.Windows.Forms.AccessibleRole]::PushButton
  $script:RetryButton.TabStop = $true
  $script:RetryButton.Size = [Drawing.Size]::new(96, 38)
  $script:RetryButton.Visible = $false
  $script:LoadingPanel.Controls.AddRange(@($script:LoadingLabel, $script:LoadingProgress, $script:RetryButton))
  $script:LoadingPanel.add_Resize({
    $centerX = [Math]::Floor(($script:LoadingPanel.ClientSize.Width - $script:LoadingLabel.Width) / 2)
    $centerY = [Math]::Floor(($script:LoadingPanel.ClientSize.Height - 90) / 2)
    $script:LoadingLabel.Location = [Drawing.Point]::new([Math]::Max(0, $centerX), [Math]::Max(20, $centerY))
    $script:LoadingProgress.Location = [Drawing.Point]::new(
      [Math]::Floor(($script:LoadingPanel.ClientSize.Width - $script:LoadingProgress.Width) / 2), $centerY + 52)
    $script:RetryButton.Location = [Drawing.Point]::new(
      [Math]::Floor(($script:LoadingPanel.ClientSize.Width - $script:RetryButton.Width) / 2), $centerY + 54)
  })

  $content = [System.Windows.Forms.Panel]::new()
  $content.Dock = 'Fill'
  $content.Controls.Add($script:WebView)
  $content.Controls.Add($script:LoadingPanel)
  $script:Form.Controls.Add($content)
  $script:LoadingPanel.BringToFront()

  $script:RetryButton.add_Click({
    if ($script:WebReady -and $null -ne $script:WebView.CoreWebView2) {
      Show-AuraUiLoading -Message "$($script:UiCopy.openingClaude)"
      $script:WebView.CoreWebView2.Navigate('https://claude.ai/')
    }
  })

  $timer = [System.Windows.Forms.Timer]::new()
  $timer.Interval = 60
  $timer.add_Tick({
    if ($script:Closing) { return }
    try {
      if ($null -ne $script:EnvironmentTask -and $script:EnvironmentTask.IsCompleted) {
        $task = $script:EnvironmentTask
        $script:EnvironmentTask = $null
        $environment = $task.GetAwaiter().GetResult()
        $script:WebViewEnvironment = $environment
        $script:EnsureTask = $script:WebView.EnsureCoreWebView2Async($environment)
        if (Test-Path -LiteralPath $StudioRoot -PathType Container) {
          $script:StudioEnsureTask = $script:StudioWebView.EnsureCoreWebView2Async($environment)
        } else {
          $script:StudioInitializationFailed = $true
          Write-AuraUiLog -Message "Studio folder is missing: $StudioRoot"
        }
      }
      if ($null -ne $script:StudioEnsureTask -and $script:StudioEnsureTask.IsCompleted) {
        try {
          $task = $script:StudioEnsureTask
          $script:StudioEnsureTask = $null
          [void]$task.GetAwaiter().GetResult()
          $studioCore = $script:StudioWebView.CoreWebView2
          $studioCore.Settings.AreDevToolsEnabled = $false
          $studioCore.Settings.IsStatusBarEnabled = $false
          $studioCore.Settings.AreDefaultContextMenusEnabled = $false
          $studioCore.Settings.AreBrowserAcceleratorKeysEnabled = $true
          $studioCore.Settings.IsZoomControlEnabled = $true
          $studioCore.Settings.IsWebMessageEnabled = $true
          $studioCore.SetVirtualHostNameToFolderMapping(
            'aura.studio',
            $StudioRoot,
            [Microsoft.Web.WebView2.Core.CoreWebView2HostResourceAccessKind]::Allow)
          if (Test-Path -LiteralPath $ThemeArtRoot -PathType Container) {
            $studioCore.SetVirtualHostNameToFolderMapping(
              'aura.assets',
              $ThemeArtRoot,
              [Microsoft.Web.WebView2.Core.CoreWebView2HostResourceAccessKind]::Allow)
          } else {
            Write-AuraUiLog -Message "Studio theme artwork folder is missing: $ThemeArtRoot"
          }
          $studioCore.SetVirtualHostNameToFolderMapping(
            'aura.background',
            $StudioBackgroundRoot,
            [Microsoft.Web.WebView2.Core.CoreWebView2HostResourceAccessKind]::Allow)
          $studioCore.add_NavigationStarting({
            param($sender, $eventArgs)
            try {
              $uri = [Uri]$eventArgs.Uri
              if ($uri.Scheme -cne 'https' -or $uri.Host -cne 'aura.studio') { $eventArgs.Cancel = $true }
            } catch { $eventArgs.Cancel = $true }
          })
          $studioCore.add_NavigationCompleted({
            param($sender, $eventArgs)
            if ($eventArgs.IsSuccess) {
              $script:StudioReady = $true
              Send-AuraUiStudioState
            } else {
              Write-AuraUiLog -Message "Studio navigation failed: $($eventArgs.WebErrorStatus)"
            }
          })
          $studioCore.add_WebMessageReceived({
            param($sender, $eventArgs)
            try {
              Invoke-AuraUiStudioMessage -Json $eventArgs.WebMessageAsJson -Source $eventArgs.Source
            } catch {
              Write-AuraUiLog -Message "Studio message rejected: $($_.Exception.Message)"
              $failedAction = ''
              try {
                $failedMessage = $eventArgs.WebMessageAsJson | ConvertFrom-Json
                if ($failedMessage.type -is [string] -and
                    $script:StudioMessageTypes -ccontains $failedMessage.type -and
                    $failedMessage.type -in @('set-image-framing', 'set-card-preview-crop')) {
                  $failedAction = [string]$failedMessage.type
                }
              } catch {}
              if ($failedAction) {
                Send-AuraUiStudioState -Status "$($script:UiCopy.appearanceNotChangedMessage)" -Tone error -Action $failedAction -ActionSucceeded $false
              } else {
                Send-AuraUiStudioState -Status "$($script:UiCopy.appearanceNotChangedMessage)" -Tone error
              }
            }
          })
          $studioCore.add_NewWindowRequested({
            param($sender, $eventArgs)
            $eventArgs.Handled = $true
          })
          $script:StudioReady = $true
          $studioCore.Navigate('https://aura.studio/index.html')
        } catch {
          $script:StudioEnsureTask = $null
          $script:StudioReady = $false
          $script:StudioInitializationFailed = $true
          Write-AuraUiLog -Message "Studio initialization failed: $($_.Exception.ToString())"
        }
      }
      if ($null -ne $script:EnsureTask -and $script:EnsureTask.IsCompleted) {
        $task = $script:EnsureTask
        $script:EnsureTask = $null
        [void]$task.GetAwaiter().GetResult()
        $core = $script:WebView.CoreWebView2
        $core.Settings.AreDevToolsEnabled = $false
        $core.Settings.IsStatusBarEnabled = $false
        $core.Settings.AreDefaultContextMenusEnabled = $true
        $core.Settings.AreBrowserAcceleratorKeysEnabled = $true
        $core.Settings.IsZoomControlEnabled = $true

        $core.add_NavigationStarting({
          $script:PageReady = $false
          Show-AuraUiLoading -Message "$($script:UiCopy.openingClaude)"
        })
        $core.add_NavigationCompleted({
          param($sender, $eventArgs)
          if (-not $eventArgs.IsSuccess) {
            # A genuine navigation failure is the only case that keeps the cover.
            Show-AuraUiLoading -Message "$($script:UiCopy.loadFailed)" -Retry $true
            return
          }
          $enabled = $true
          if ($null -ne $script:Config.PSObject.Properties['enabled']) { $enabled = [bool]$script:Config.enabled }
          if (Test-AuraUiClaudeUri -Value $script:WebView.Source) {
            # The claude.ai document has loaded and is usable, including right after
            # the very first sign-in. Reveal it now and inject the theme over the live
            # page (the in-page renderer self-heals its own styling). Hiding the cover
            # on this real navigation signal — rather than waiting for the async theme
            # script to confirm — is what prevents an injection race from stranding an
            # opaque cover over a working, signed-in interface.
            $script:PageReady = $true
            Hide-AuraUiLoading
            if ($enabled) { Apply-AuraUiTheme }
          } else {
            Hide-AuraUiLoading
          }
        })
        $core.add_NewWindowRequested({
          param($sender, $eventArgs)
          try {
            $uri = [Uri]$eventArgs.Uri
            if ((Test-AuraUiClaudeUri -Value $uri) -or (Test-AuraUiSignInUri -Value $uri)) {
              $eventArgs.Handled = $true
              $script:WebView.CoreWebView2.Navigate($uri.AbsoluteUri)
            } elseif ($uri.Scheme -eq 'https') {
              $eventArgs.Handled = $true
              Start-Process $uri.AbsoluteUri | Out-Null
            }
          } catch {
            $eventArgs.Handled = $true
            Write-AuraUiLog -Message $_.Exception.ToString()
          }
        })
        $core.add_ProcessFailed({
          Show-AuraUiLoading -Message "$($script:UiCopy.reloadRetry)" -Retry $true
        })
        $script:WebReady = $true
        $core.Navigate('https://claude.ai/')
      }
      if ($null -ne $script:ScriptTask -and $script:ScriptTask.IsCompleted) {
        $task = $script:ScriptTask
        $action = $script:ScriptAction
        $covered = $script:ScriptCovered
        $script:ScriptTask = $null
        $script:ScriptAction = $null
        $script:ScriptCovered = $false
        $result = $task.GetAwaiter().GetResult()
        if ($action -eq 'Apply' -and $result -notmatch '"installed"\s*:\s*true') {
          throw 'The theme script completed without confirming installation.'
        }
        if ($covered) { Hide-AuraUiLoading }
        Send-AuraUiStudioState
        if ($script:PendingRestore) {
          $script:PendingRestore = $false
          $script:PendingApply = $false
          $cleanup = '(() => { window.__CLAUDE_AURA_DISABLED__ = true; return window.__CLAUDE_AURA_STATE__?.cleanup?.() ?? true; })()'
          Start-AuraUiScript -Source $cleanup -Action Restore
        } elseif ($script:PendingApply) {
          $script:PendingApply = $false
          Apply-AuraUiTheme
        }
      }
    } catch {
      $script:EnvironmentTask = $null
      $script:EnsureTask = $null
      $script:ScriptTask = $null
      $script:PendingApply = $false
      $script:PendingRestore = $false
      if (-not $script:WebReady) {
        Fail-AuraUiStartup -Exception $_.Exception
      } elseif ($script:PageReady) {
        # claude.ai is loaded and visible; a theme-injection hiccup must never cover
        # it with an opaque panel. Log the error and leave the interface usable.
        # NavigationCompleted and Studio/tray changes provide recovery paths.
        Write-AuraUiLog -Message $_.Exception.ToString()
        Hide-AuraUiLoading
      } else {
        Write-AuraUiLog -Message $_.Exception.ToString()
        Show-AuraUiLoading -Message "$($script:UiCopy.openedRetry)" -Retry $true
      }
    }
  })

  $script:Form.add_Shown({
    $script:PageReady = $false
    $script:PendingApply = $false
    $script:PendingRestore = $false
    Show-AuraUiLoading -Message "$($script:UiCopy.openingClaude)"
    try {
      $script:EnvironmentTask = [Microsoft.Web.WebView2.Core.CoreWebView2Environment]::CreateAsync($null, $WebDataRoot, $null)
      $timer.Start()
    } catch { Fail-AuraUiStartup -Exception $_.Exception }
  })
  $script:Form.add_FormClosing({
    $script:Closing = $true
    $timer.Stop()
    if ($script:TrayIcon) {
      $script:TrayIcon.Visible = $false
      $script:TrayIcon.Dispose()
    }
    if ($script:StudioForm -and -not $script:StudioForm.IsDisposed) { $script:StudioForm.Close() }
    if ($script:StudioWebView -and -not $script:StudioWebView.IsDisposed) { $script:StudioWebView.Dispose() }
    if ($script:TrayMenu) { $script:TrayMenu.Dispose() }
    if ($script:WebView) { $script:WebView.Dispose() }
  })

  [System.Windows.Forms.Application]::Run($script:Form)
} catch {
  Write-AuraUiLog -Message $_.Exception.ToString()
  try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
    $fatalMessage = if ($null -ne $script:UiCopy) {
      "$($script:UiCopy.startupTitle) $($script:UiCopy.technicalDetails)" + [Environment]::NewLine + $LogPath
    } else {
      'Claude Aura could not open. Technical details were saved to:' + [Environment]::NewLine + $LogPath
    }
    [void][System.Windows.Forms.MessageBox]::Show(
      $fatalMessage,
      'Claude Aura', 'OK', 'Error')
  } catch {}
  exit 1
} finally {
  if ($ownsMutex -and $null -ne $mutex) {
    try { $mutex.ReleaseMutex() } catch {}
  }
  if ($null -ne $mutex) { $mutex.Dispose() }
}
