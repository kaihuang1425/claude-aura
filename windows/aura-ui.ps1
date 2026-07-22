[CmdletBinding()]
param(
  [ValidateSet('Open', 'Restore')][string]$Mode = 'Open',
  [string]$Theme,
  [string]$Image,
  [switch]$ClearImage,
  [switch]$OpenStudio
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
$StudioPreviewRoot = Join-Path $Root 'assets\studio-previews\masters'
$AuraIconPath = Join-Path $Root 'assets\brand\claude-aura.ico'
$StudioBackgroundRoot = Join-Path $DataRoot 'studio-background'
$StudioBackgroundMaxBytes = 16 * 1024 * 1024
$StudioEditorRoot = Join-Path $DataRoot 'theme-drafts'
$StudioEditorPreviewRoot = Join-Path $StudioEditorRoot 'preview'
$StudioEditorImportRoot = Join-Path $StudioEditorRoot 'imports'
$StudioEditorImageMaxBytes = 16 * 1024 * 1024
$ThemeAssetConverter = Join-Path $Root 'scripts\convert-theme-assets.mjs'
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
    launcher = Get-AuraUiPropertyValue -InputObject $Item -Names @('launcher')
    studioPreview = Get-AuraUiPropertyValue -InputObject $Item -Names @('studioPreview')
    studioPreviewFrame = Get-AuraUiPropertyValue -InputObject $Item -Names @('studioPreviewFrame')
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

function New-AuraUiIcon {
  param([ValidateSet(16, 20, 24, 32, 40, 48, 64, 128)][int]$Size = 32)
  if (-not (Test-Path -LiteralPath $AuraIconPath -PathType Leaf)) {
    throw "The Claude Aura icon is missing: $AuraIconPath"
  }
  $stream = $null
  $source = $null
  try {
    $stream = [IO.File]::Open($AuraIconPath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    $source = [Drawing.Icon]::new($stream, $Size, $Size)
    return [Drawing.Icon]$source.Clone()
  } finally {
    if ($null -ne $source) { $source.Dispose() }
    if ($null -ne $stream) { $stream.Dispose() }
  }
}

function New-AuraUiThemeIcon {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [ValidateSet(16, 20, 24, 32, 40, 48, 64, 128)][int]$Size = 32
  )
  $stream = $null
  $source = $null
  $canvas = $null
  $graphics = $null
  $handle = [IntPtr]::Zero
  try {
    $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    $source = [Drawing.Image]::FromStream($stream)
    $canvas = [Drawing.Bitmap]::new($Size, $Size, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [Drawing.Graphics]::FromImage($canvas)
    $graphics.Clear([Drawing.Color]::Transparent)
    $graphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.DrawImage($source, [Drawing.Rectangle]::new(0, 0, $Size, $Size))
    $handle = $canvas.GetHicon()
    $borrowed = [Drawing.Icon]::FromHandle($handle)
    return [Drawing.Icon]$borrowed.Clone()
  } finally {
    if ($handle -ne [IntPtr]::Zero -and ('AuraWindow' -as [type])) {
      try { [void][AuraWindow]::DestroyIcon($handle) } catch {}
    }
    if ($null -ne $graphics) { $graphics.Dispose() }
    if ($null -ne $canvas) { $canvas.Dispose() }
    if ($null -ne $source) { $source.Dispose() }
    if ($null -ne $stream) { $stream.Dispose() }
  }
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
  Update-AuraUiLauncherStyle
}

function Set-AuraUiConfig {
  param([string[]]$Options)
  $editorPayload = if ($script:StudioEditorState -and
      (Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('active')) -eq $true -and
      $script:Payload) { $script:Payload } else { $null }
  $arguments = @($ThemeCli, 'set', '--config', $ConfigPath, '--user-themes', $UserThemesRoot) + $Options
  if ($script:Locale) { $arguments += @('--locale', $script:Locale) }
  $arguments += '--payload'
  $payload = Invoke-AuraUiNode -CommandArguments $arguments
  $script:Config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
  Set-AuraUiPayloadState -Payload $(if ($editorPayload) { $editorPayload } else { $payload })
  if ($script:WebReady -or $script:StudioReady) { Set-AuraUiPreferredColorScheme }
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

function Get-AuraUiAppearance {
  if ($null -ne $script:Config -and $null -ne $script:Config.PSObject.Properties['appearance']) {
    $appearance = "$($script:Config.appearance)"
    if ($appearance -cin @('system', 'light', 'dark')) { return $appearance }
  }
  return 'system'
}

function Set-AuraUiPreferredColorScheme {
  param(
    [ValidateSet('system', 'light', 'dark')][string]$Appearance = (Get-AuraUiAppearance),
    [bool]$Enabled = (Get-AuraUiEnabled)
  )
  $scheme = if (-not $Enabled) {
    [Microsoft.Web.WebView2.Core.CoreWebView2PreferredColorScheme]::Auto
  } else {
    switch -CaseSensitive ($Appearance) {
      'light' { [Microsoft.Web.WebView2.Core.CoreWebView2PreferredColorScheme]::Light; break }
      'dark' { [Microsoft.Web.WebView2.Core.CoreWebView2PreferredColorScheme]::Dark; break }
      default { [Microsoft.Web.WebView2.Core.CoreWebView2PreferredColorScheme]::Auto; break }
    }
  }
  foreach ($webView in @($script:WebView, $script:StudioWebView)) {
    if ($null -ne $webView -and -not $webView.IsDisposed -and $null -ne $webView.CoreWebView2) {
      $webView.CoreWebView2.Profile.PreferredColorScheme = $scheme
    }
  }
}

function Update-AuraUiTrayAppearance {
  $appearanceText = if (Get-AuraUiEnabled) {
    "$($script:UiCopy.originalLook)"
  } else {
    "$($script:UiCopy.applyTheme)"
  }
  if ($null -ne $script:TrayAppearanceItem -and -not $script:TrayAppearanceItem.IsDisposed) {
    $script:TrayAppearanceItem.Text = $appearanceText
  }
  if ($null -ne $script:LauncherAppearanceItem -and -not $script:LauncherAppearanceItem.IsDisposed) {
    $script:LauncherAppearanceItem.Text = $appearanceText
  }
  Update-AuraUiLauncherStyle
}

function Get-AuraUiLauncherDefaultStyle {
  return [PSCustomObject]@{
    asset = 'assets/theme-art/default/launcher-mark.png'
    surface = '#2F2937'
    surfaceHover = '#3B3346'
    foreground = '#F4DFBB'
    accent = '#D66D4B'
    border = '#655C70'
    radius = 16
    borderWidth = 1
  }
}

function Get-AuraUiLauncherStyle {
  $fallback = Get-AuraUiLauncherDefaultStyle
  $themeName = if (Get-AuraUiEnabled) { Get-AuraUiSelectedThemeName } else { 'default' }
  if (-not $themeName) { $themeName = 'default' }
  $theme = Get-AuraUiThemeByName -Name $themeName
  $raw = if ($null -ne $theme) { Get-AuraUiPropertyValue -InputObject $theme -Names @('launcher') } else { $null }
  if ($null -eq $raw) { $raw = $fallback }
  $style = [ordered]@{}
  foreach ($key in @('surface', 'surfaceHover', 'foreground', 'accent', 'border')) {
    $candidate = Get-AuraUiPropertyValue -InputObject $raw -Names @($key)
    if ($null -eq $candidate -or "$candidate" -cnotmatch '^#[0-9A-Fa-f]{6}$') { $candidate = $fallback.$key }
    $style[$key] = "$candidate".ToUpperInvariant()
  }
  $radius = Get-AuraUiPropertyValue -InputObject $raw -Names @('radius')
  $borderWidth = Get-AuraUiPropertyValue -InputObject $raw -Names @('borderWidth')
  try { $radius = [double]$radius } catch { $radius = [double]$fallback.radius }
  try { $borderWidth = [double]$borderWidth } catch { $borderWidth = [double]$fallback.borderWidth }
  if ([double]::IsNaN($radius) -or [double]::IsInfinity($radius) -or $radius -lt 8 -or $radius -gt 24) {
    $radius = [double]$fallback.radius
  }
  if ([double]::IsNaN($borderWidth) -or [double]::IsInfinity($borderWidth) -or $borderWidth -lt 1 -or $borderWidth -gt 3) {
    $borderWidth = [double]$fallback.borderWidth
  }
  $asset = Get-AuraUiPropertyValue -InputObject $raw -Names @('asset')
  if ($null -eq $asset) { $asset = $fallback.asset }
  $style.asset = "$asset"
  $style.radius = $radius
  $style.borderWidth = $borderWidth
  $style.source = if ($null -ne $theme) { "$($theme.source)" } else { 'builtin' }
  $style.theme = "$themeName"
  return [PSCustomObject]$style
}

function Get-AuraUiLauncherAssetPath {
  param([Parameter(Mandatory = $true)][object]$Style)
  $relative = "$($Style.asset)".Replace('/', [IO.Path]::DirectorySeparatorChar)
  try {
    if ("$($Style.asset)" -cmatch '^assets/theme-art/[a-z][a-z0-9-]{1,39}/launcher-mark\.png$') {
      $rootPath = [IO.Path]::GetFullPath($ThemeArtRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)
      $candidate = [IO.Path]::GetFullPath((Join-Path $Root $relative))
      if (-not $candidate.StartsWith($rootPath + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        return $null
      }
    } elseif ("$($Style.asset)" -ceq 'launcher-mark.png' -and "$($Style.source)" -ceq 'user') {
      $themeRoot = [IO.Path]::GetFullPath((Join-Path $UserThemesRoot "$($Style.theme)"))
      $candidate = [IO.Path]::GetFullPath((Join-Path $themeRoot 'launcher-mark.png'))
      if (-not $candidate.StartsWith($themeRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        return $null
      }
    } else {
      return $null
    }
    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { return $null }
    $item = Get-Item -LiteralPath $candidate -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { return $null }
    return $candidate
  } catch { return $null }
}

function New-AuraUiRoundedRectanglePath {
  param([Parameter(Mandatory = $true)][Drawing.RectangleF]$Bounds, [double]$Radius)
  $path = [Drawing.Drawing2D.GraphicsPath]::new()
  $radiusValue = [float][Math]::Max(1, [Math]::Min($Radius, [Math]::Min($Bounds.Width, $Bounds.Height) / 2))
  $diameter = $radiusValue * 2
  $path.AddArc($Bounds.Left, $Bounds.Top, $diameter, $diameter, 180, 90)
  $path.AddArc($Bounds.Right - $diameter, $Bounds.Top, $diameter, $diameter, 270, 90)
  $path.AddArc($Bounds.Right - $diameter, $Bounds.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($Bounds.Left, $Bounds.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Update-AuraUiThemeIcons {
  param([AllowNull()][string]$AssetPath)
  if (-not $AssetPath -or -not ('AuraWindow' -as [type])) { return }
  if ([string]::Equals($script:ThemeIdentityAssetPath, $AssetPath, [StringComparison]::OrdinalIgnoreCase)) { return }

  $main = $null
  $studio = $null
  $notification = $null
  try {
    $main = New-AuraUiThemeIcon -Path $AssetPath -Size 64
    $studio = New-AuraUiThemeIcon -Path $AssetPath -Size 64
    $notification = New-AuraUiThemeIcon -Path $AssetPath -Size 32
  } catch {
    foreach ($pending in @($main, $studio, $notification)) {
      if ($null -ne $pending) { try { $pending.Dispose() } catch {} }
    }
    Write-AuraUiLog -Message "Theme app icon could not be loaded: $($_.Exception.Message)"
    return
  }

  $oldIcons = @($script:MainIcon, $script:StudioIcon, $script:NotificationIcon)
  $script:MainIcon = $main
  $script:StudioIcon = $studio
  $script:NotificationIcon = $notification
  $script:ThemeIdentityAssetPath = $AssetPath
  if ($null -ne $script:Form -and -not $script:Form.IsDisposed) { $script:Form.Icon = $script:MainIcon }
  if ($null -ne $script:StudioForm -and -not $script:StudioForm.IsDisposed) { $script:StudioForm.Icon = $script:StudioIcon }
  if ($null -ne $script:TrayIcon) { $script:TrayIcon.Icon = $script:NotificationIcon }
  foreach ($oldIcon in $oldIcons) {
    if ($null -ne $oldIcon) { try { $oldIcon.Dispose() } catch {} }
  }
}

function Update-AuraUiLauncherRegion {
  if ($null -eq $script:Launcher -or $script:Launcher.IsDisposed) { return }
  $radius = if ($null -ne $script:LauncherStyle) { [double]$script:LauncherStyle.radius } else { 16 }
  $bounds = [Drawing.RectangleF]::new(0, 0, $script:Launcher.ClientSize.Width, $script:Launcher.ClientSize.Height)
  $path = New-AuraUiRoundedRectanglePath -Bounds $bounds -Radius $radius
  $oldRegion = $script:Launcher.Region
  $script:Launcher.Region = [Drawing.Region]::new($path)
  $path.Dispose()
  if ($null -ne $oldRegion) { $oldRegion.Dispose() }
}

function Update-AuraUiLauncherStyle {
  if ($null -eq $script:Launcher -or $script:Launcher.IsDisposed) { return }
  $style = Get-AuraUiLauncherStyle
  $assetPath = Get-AuraUiLauncherAssetPath -Style $style
  if ($null -eq $assetPath -and "$($style.asset)" -cne 'assets/theme-art/default/launcher-mark.png') {
    $style = Get-AuraUiLauncherDefaultStyle
    Add-Member -InputObject $style -NotePropertyName source -NotePropertyValue 'builtin' -Force
    Add-Member -InputObject $style -NotePropertyName theme -NotePropertyValue 'default' -Force
    $assetPath = Get-AuraUiLauncherAssetPath -Style $style
  }
  $mark = $null
  if ($assetPath) {
    $stream = $null
    $source = $null
    try {
      $stream = [IO.File]::Open($assetPath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
      $source = [Drawing.Image]::FromStream($stream)
      $mark = [Drawing.Bitmap]::new($source)
    } catch { Write-AuraUiLog -Message "Launcher mark could not be loaded: $($_.Exception.Message)" }
    finally {
      if ($null -ne $source) { $source.Dispose() }
      if ($null -ne $stream) { $stream.Dispose() }
    }
  }
  if ($null -ne $script:LauncherMark) { $script:LauncherMark.Dispose() }
  $script:LauncherMark = $mark
  $script:LauncherStyle = $style
  $script:Launcher.BackColor = [Drawing.ColorTranslator]::FromHtml("$($style.surface)")
  if ($null -ne $script:LauncherButton -and -not $script:LauncherButton.IsDisposed) {
    $script:LauncherButton.BackColor = $script:Launcher.BackColor
    $script:LauncherButton.FlatAppearance.MouseOverBackColor = $script:Launcher.BackColor
    $script:LauncherButton.FlatAppearance.MouseDownBackColor = $script:Launcher.BackColor
    $script:LauncherButton.Invalidate()
  }
  Update-AuraUiThemeIcons -AssetPath $assetPath
  Update-AuraUiLauncherRegion
}

function Set-AuraUiLauncherExpanded {
  param([bool]$Expanded)
  if ($null -eq $script:Launcher -or $script:Launcher.IsDisposed -or $script:LauncherDragging) { return }
  $targetWidth = if ($Expanded) { $script:LauncherExpandedWidth } else { $script:LauncherCompactSize }
  if ($script:Launcher.ClientSize.Width -eq $targetWidth -and $script:LauncherExpanded -eq $Expanded) { return }
  $oldBounds = $script:Launcher.Bounds
  if ($Expanded) {
    try {
      $formLeft = $script:Form.PointToScreen([Drawing.Point]::new(0, 0)).X
      $formCenter = $formLeft + ($script:Form.ClientSize.Width / 2)
      $script:LauncherExpandsLeft = ($oldBounds.Left + ($oldBounds.Width / 2)) -ge $formCenter
    } catch { $script:LauncherExpandsLeft = $true }
  }
  $anchor = if ($script:LauncherExpandsLeft) { $oldBounds.Right } else { $oldBounds.Left }
  $script:Launcher.ClientSize = [Drawing.Size]::new($targetWidth, $script:LauncherCompactSize)
  $targetX = if ($script:LauncherExpandsLeft) { $anchor - $targetWidth } else { $anchor }
  $script:Launcher.Location = Get-AuraUiLauncherClampedLocation -Location ([Drawing.Point]::new($targetX, $oldBounds.Top))
  $script:LauncherExpanded = $Expanded
  Update-AuraUiLauncherRegion
  if ($null -ne $script:LauncherButton) { $script:LauncherButton.Invalidate() }
}

function Test-AuraUiLauncherGrip {
  param([Parameter(Mandatory = $true)][Drawing.Point]$Location)
  if (-not $script:LauncherExpanded) { return $false }
  if ($script:LauncherExpandsLeft) { return $Location.X -le 38 }
  return $Location.X -ge ($script:Launcher.ClientSize.Width - 38)
}

function Get-AuraUiLauncherClampedLocation {
  param([Parameter(Mandatory = $true)][Drawing.Point]$Location)
  try {
    $topLeft = $script:Form.PointToScreen([Drawing.Point]::new(0, 0))
    $bottomRight = $script:Form.PointToScreen(
      [Drawing.Point]::new($script:Form.ClientSize.Width, $script:Form.ClientSize.Height))
  } catch { return $Location }
  $gap = $script:LauncherSafeGap
  $x = [Math]::Max($topLeft.X + $gap, [Math]::Min($Location.X, $bottomRight.X - $script:Launcher.Width - $gap))
  $y = [Math]::Max($topLeft.Y + $gap, [Math]::Min($Location.Y, $bottomRight.Y - $script:Launcher.Height - $gap))
  return [Drawing.Point]::new([int]$x, [int]$y)
}

function Read-AuraUiLauncherPosition {
  try {
    $path = Join-Path $DataRoot 'launcher-pos.json'
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return }
    $data = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
    $right = [int]$data.right
    $bottom = [int]$data.bottom
    if ($right -ge 0 -and $right -le 8000 -and $bottom -ge 0 -and $bottom -le 8000) {
      $script:LauncherRightGap = [Math]::Max($script:LauncherSafeGap, $right)
      $script:LauncherBottomGap = [Math]::Max($script:LauncherSafeGap, $bottom)
    }
  } catch { Write-AuraUiLog -Message $_.Exception.ToString() }
}

function Save-AuraUiLauncherPosition {
  try {
    $bottomRight = $script:Form.PointToScreen(
      [Drawing.Point]::new($script:Form.ClientSize.Width, $script:Form.ClientSize.Height))
    $script:LauncherRightGap = [int][Math]::Max($script:LauncherSafeGap, $bottomRight.X - ($script:Launcher.Location.X + $script:Launcher.Width))
    $script:LauncherBottomGap = [int][Math]::Max($script:LauncherSafeGap, $bottomRight.Y - ($script:Launcher.Location.Y + $script:Launcher.Height))
    $payload = [ordered]@{ right = $script:LauncherRightGap; bottom = $script:LauncherBottomGap } | ConvertTo-Json -Compress
    [System.IO.File]::WriteAllText((Join-Path $DataRoot 'launcher-pos.json'), $payload)
  } catch { Write-AuraUiLog -Message $_.Exception.ToString() }
}

function Update-AuraUiLauncherPosition {
  if ($null -eq $script:Launcher -or $script:Launcher.IsDisposed) { return }
  if ($null -eq $script:Form -or $script:Form.IsDisposed) { return }
  if ($script:Form.WindowState -eq [System.Windows.Forms.FormWindowState]::Minimized -or -not $script:Form.Visible) {
    if ($script:Launcher.Visible) { $script:Launcher.Hide() }
    return
  }
  if ($script:LauncherDragging) { return }
  # Anchor to the bottom-right of the Claude content area by the saved gap so the
  # launcher floats clear of Claude's left sidebar, centre composer, and top
  # controls, and keeps the user's dragged position across window resizes.
  try {
    $bottomRight = $script:Form.PointToScreen(
      [Drawing.Point]::new($script:Form.ClientSize.Width, $script:Form.ClientSize.Height))
  } catch { return }
  $desired = [Drawing.Point]::new(
    $bottomRight.X - $script:Launcher.Width - $script:LauncherRightGap,
    $bottomRight.Y - $script:Launcher.Height - $script:LauncherBottomGap)
  $script:Launcher.Location = Get-AuraUiLauncherClampedLocation -Location $desired
  if (-not $script:Launcher.Visible) {
    $script:Launcher.Show($script:Form)
  }
}

function Show-AuraUiFirstRunNavHint {
  if ($null -eq $script:TrayIcon -or -not $script:TrayIcon.Visible) { return }
  $marker = Join-Path $DataRoot 'nav-hint-seen'
  if (Test-Path -LiteralPath $marker -PathType Leaf) { return }
  try {
    $script:TrayIcon.BalloonTipTitle = "$($script:UiCopy.navHintTitle)"
    $script:TrayIcon.BalloonTipText = "$($script:UiCopy.navHintBody)"
    $script:TrayIcon.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
    $script:TrayIcon.ShowBalloonTip(9000)
    [System.IO.File]::WriteAllText($marker, 'shown')
  } catch { Write-AuraUiLog -Message $_.Exception.ToString() }
}

function Register-AuraUiJumpList {
  # Add an "Open Studio" task to the app's taskbar Jump List. Uses the managed
  # WPF JumpList (catchable exceptions, no hand-written COM), which applies to the
  # process's explicit AppUserModelID set at startup. The task relaunches this
  # script with -OpenStudio; the single-instance guard turns that into an
  # OpenStudio signal to the already-running window. Fully guarded so a shell that
  # lacks WPF, or any failure, never affects the window.
  try {
    Add-Type -AssemblyName PresentationFramework -ErrorAction Stop
    $shellPath = [System.Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
    $scriptPath = Join-Path $PSScriptRoot 'aura-ui.ps1'
    if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) { return }
    $jumpList = [System.Windows.Shell.JumpList]::new()
    $jumpList.ShowFrequentCategory = $false
    $jumpList.ShowRecentCategory = $false
    $task = [System.Windows.Shell.JumpTask]::new()
    $task.Title = "$($script:UiCopy.openStudio)"
    $task.Description = "$($script:UiCopy.studioTitle)"
    $task.ApplicationPath = $shellPath
    $task.Arguments = '-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" -OpenStudio' -f $scriptPath
    $task.WorkingDirectory = $Root
    if (Test-Path -LiteralPath $AuraIconPath -PathType Leaf) {
      $task.IconResourcePath = $AuraIconPath
      $task.IconResourceIndex = 0
    }
    [void]$jumpList.JumpItems.Add($task)
    $jumpList.Apply()
  } catch { Write-AuraUiLog -Message "Jump List registration skipped: $($_.Exception.Message)" }
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
        zoom = ConvertTo-AuraUiStudioNumber -Value (Get-AuraUiPropertyValue -InputObject $crop -Names @('zoom')) -Minimum 1 -Maximum 6 -Label 'Studio preview zoom'
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

function Assert-AuraUiStudioEditorRoots {
  param([switch]$Create)
  $localRoot = [IO.Path]::GetFullPath($env:LOCALAPPDATA).TrimEnd(
    [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  $expectedDataRoot = [IO.Path]::GetFullPath((Join-Path (Join-Path $localRoot 'ClaudeAura') 'data')).TrimEnd(
    [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  $dataRootPath = [IO.Path]::GetFullPath($DataRoot).TrimEnd(
    [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  $editorRootPath = [IO.Path]::GetFullPath($StudioEditorRoot).TrimEnd(
    [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  $previewRootPath = [IO.Path]::GetFullPath($StudioEditorPreviewRoot).TrimEnd(
    [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  $importRootPath = [IO.Path]::GetFullPath($StudioEditorImportRoot).TrimEnd(
    [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  if (-not [string]::Equals($dataRootPath, $expectedDataRoot, [StringComparison]::OrdinalIgnoreCase) -or
      -not [string]::Equals($editorRootPath, (Join-Path $dataRootPath 'theme-drafts'), [StringComparison]::OrdinalIgnoreCase) -or
      -not [string]::Equals($previewRootPath, (Join-Path $editorRootPath 'preview'), [StringComparison]::OrdinalIgnoreCase) -or
      -not [string]::Equals($importRootPath, (Join-Path $editorRootPath 'imports'), [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Aura Studio editor storage is outside Claude Aura app data.'
  }
  foreach ($candidate in @(
      (Join-Path $localRoot 'ClaudeAura'), $dataRootPath, $editorRootPath, $previewRootPath, $importRootPath)) {
    if (-not (Test-Path -LiteralPath $candidate)) {
      if (-not $Create) { throw 'Aura Studio editor storage is unavailable.' }
      [void][IO.Directory]::CreateDirectory($candidate)
    }
    $item = Get-Item -LiteralPath $candidate -Force
    if (-not $item.PSIsContainer -or
        ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'Aura Studio editor folders cannot be symbolic links or junctions.'
    }
  }
  return $editorRootPath
}

function Test-AuraUiStudioExactProperties {
  param(
    [Parameter(Mandatory = $true)][object]$Message,
    [Parameter(Mandatory = $true)][string[]]$Names
  )
  $actual = @($Message.PSObject.Properties | ForEach-Object { $_.Name })
  if ($actual.Count -ne $Names.Count) { return $false }
  foreach ($name in $Names) {
    if ($actual -cnotcontains $name) { return $false }
  }
  return $true
}

function ConvertTo-AuraUiStudioInteger {
  param(
    [AllowNull()][object]$Value,
    [Parameter(Mandatory = $true)][int]$Minimum,
    [Parameter(Mandatory = $true)][int]$Maximum,
    [Parameter(Mandatory = $true)][string]$Label
  )
  if ($null -eq $Value -or $Value -is [bool] -or $Value -is [string] -or $Value -is [char]) {
    throw "$Label must be an integer."
  }
  try { $number = [Convert]::ToDouble($Value, [Globalization.CultureInfo]::InvariantCulture) }
  catch { throw "$Label must be an integer." }
  if ([double]::IsNaN($number) -or [double]::IsInfinity($number) -or
      [Math]::Truncate($number) -ne $number -or $number -lt $Minimum -or $number -gt $Maximum) {
    throw "$Label must be an integer between $Minimum and $Maximum."
  }
  return [int]$number
}

function ConvertTo-AuraUiBase64Url {
  param([Parameter(Mandatory = $true)][string]$Value)
  return [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Value)).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Assert-AuraUiStudioEditorPublicValue {
  param(
    [AllowNull()][object]$Value,
    [AllowEmptyString()][string]$Name = '',
    [int]$Depth = 0
  )
  if ($Depth -gt 10) { throw 'Aura Studio editor state is too deeply nested.' }
  if ($null -eq $Value -or $Value -is [bool] -or
      $Value -is [byte] -or $Value -is [sbyte] -or $Value -is [int16] -or $Value -is [uint16] -or
      $Value -is [int32] -or $Value -is [uint32] -or $Value -is [int64] -or $Value -is [uint64] -or
      $Value -is [single] -or $Value -is [double] -or $Value -is [decimal]) { return }
  if ($Value -is [string] -or $Value -is [char]) {
    $text = "$Value"
    if ($text.Length -gt 4096) { throw 'Aura Studio editor state contains an oversized string.' }
    if ($text -match '(?i)(?:^|[\s(])(?:[a-z]:[\\/]|\\\\)|\bfile:') {
      throw 'Aura Studio editor state cannot expose a filesystem path.'
    }
    if ($Name -ceq 'previewUrl' -and
        $text -cnotmatch '^https://aura\.editor/active/layer-[a-f0-9]{32}\.webp\?v=[a-f0-9]{64}$') {
      throw 'Aura Studio editor state contains an invalid preview URL.'
    }
    return
  }
  if ($Value -is [System.Collections.IEnumerable] -and
      $Value -isnot [System.Collections.IDictionary] -and
      $Value -isnot [System.Management.Automation.PSCustomObject]) {
    $items = @($Value)
    if ($items.Count -gt 256) { throw 'Aura Studio editor state contains too many items.' }
    foreach ($item in $items) {
      Assert-AuraUiStudioEditorPublicValue -Value $item -Depth ($Depth + 1)
    }
    return
  }
  $properties = if ($Value -is [System.Collections.IDictionary]) {
    @($Value.Keys | ForEach-Object { [PSCustomObject]@{ Name = "$_"; Value = $Value[$_] } })
  } else {
    @($Value.PSObject.Properties)
  }
  if ($properties.Count -gt 256) { throw 'Aura Studio editor state contains too many properties.' }
  foreach ($property in $properties) {
    $propertyName = [string]$property.Name
    if ($propertyName -cin @('path', 'file', 'fileName', 'sourcePath', 'targetPath', 'assetPath', 'draftPath')) {
      throw 'Aura Studio editor state cannot expose a filesystem property.'
    }
    Assert-AuraUiStudioEditorPublicValue -Value $property.Value -Name $propertyName -Depth ($Depth + 1)
  }
}

function ConvertTo-AuraUiStudioEditorState {
  param([Parameter(Mandatory = $true)][object]$State)
  if ($State -isnot [System.Management.Automation.PSCustomObject]) {
    throw 'Aura Studio editor state must be an object.'
  }
  $allowed = @(
    'active', 'id', 'sourceId', 'source', 'isNew', 'session', 'revision', 'dirty',
    'canUndo', 'canRedo', 'label', 'tokens', 'shared', 'layers', 'feedback',
    'lastAction', 'actionSucceeded', 'error')
  $actual = @($State.PSObject.Properties | ForEach-Object { $_.Name })
  foreach ($name in $actual) {
    if ($allowed -cnotcontains $name) { throw 'Aura Studio editor state contains an unexpected property.' }
  }
  $activeProperty = $State.PSObject.Properties['active']
  if ($null -eq $activeProperty -or $State.active -isnot [bool]) {
    throw 'Aura Studio editor state requires a Boolean active value.'
  }
  if ($State.active) {
    $required = @(
      'active', 'id', 'sourceId', 'source', 'isNew', 'session', 'revision', 'dirty',
      'canUndo', 'canRedo', 'label', 'tokens', 'shared', 'layers', 'feedback')
    foreach ($name in $required) {
      if ($actual -cnotcontains $name) { throw "Aura Studio editor state is missing $name." }
    }
    foreach ($name in @('id', 'sourceId')) {
      if ($State.$name -isnot [string] -or $State.$name -cnotmatch '^[a-z][a-z0-9-]{1,39}$') {
        throw "Aura Studio editor state has an invalid $name."
      }
    }
    if ($State.source -isnot [string] -or $State.source -cnotin @('builtin', 'user')) {
      throw 'Aura Studio editor state has an invalid source.'
    }
    if ($State.isNew -isnot [bool] -or $State.dirty -isnot [bool] -or
        $State.canUndo -isnot [bool] -or $State.canRedo -isnot [bool]) {
      throw 'Aura Studio editor state has an invalid Boolean value.'
    }
    if ($State.session -isnot [string] -or
        $State.session -cnotmatch '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$') {
      throw 'Aura Studio editor state has an invalid session.'
    }
    [void](ConvertTo-AuraUiStudioInteger -Value $State.revision -Minimum 0 -Maximum 2147483647 -Label 'Editor revision')
    if ($State.label -isnot [string] -or -not $State.label.Trim() -or $State.label.Length -gt 80) {
      throw 'Aura Studio editor state has an invalid label.'
    }
    if ($State.tokens -isnot [System.Management.Automation.PSCustomObject] -or
        $null -eq $State.tokens.PSObject.Properties['light'] -or
        $null -eq $State.tokens.PSObject.Properties['dark']) {
      throw 'Aura Studio editor state has invalid mode tokens.'
    }
    if ($State.shared -isnot [System.Management.Automation.PSCustomObject]) {
      throw 'Aura Studio editor state has invalid shared controls.'
    }
    $layers = @($State.layers)
    if ($layers.Count -gt 8) { throw 'Aura Studio editor state contains too many layers.' }
    if ($State.feedback -isnot [System.Management.Automation.PSCustomObject]) {
      throw 'Aura Studio editor state has invalid feedback.'
    }
  }
  if ($null -ne $State.PSObject.Properties['actionSucceeded'] -and $State.actionSucceeded -isnot [bool]) {
    throw 'Aura Studio editor state has an invalid action result.'
  }
  if ($null -ne $State.PSObject.Properties['lastAction'] -and $null -ne $State.lastAction -and
      ($State.lastAction -isnot [string] -or $State.lastAction -cnotin @(
        'create-theme-copy', 'begin-theme-edit', 'set-theme-token', 'set-theme-layer',
        'pick-theme-layer-image', 'remove-theme-layer', 'move-theme-layer',
        'undo-theme-edit', 'redo-theme-edit', 'save-theme-edit', 'discard-theme-edit',
        'delete-user-theme'))) {
    throw 'Aura Studio editor state has an invalid last action.'
  }
  if ($null -ne $State.PSObject.Properties['error'] -and $null -ne $State.error -and
      $State.error -isnot [string]) {
    throw 'Aura Studio editor state has an invalid error.'
  }
  Assert-AuraUiStudioEditorPublicValue -Value $State
  $result = [ordered]@{}
  foreach ($name in $allowed) {
    $property = $State.PSObject.Properties[$name]
    if ($null -ne $property) { $result[$name] = $property.Value }
  }
  return $result
}

function ConvertFrom-AuraUiStudioEditorResponse {
  param([Parameter(Mandatory = $true)][string]$Raw)
  try { $response = $Raw | ConvertFrom-Json } catch { throw 'Aura Studio editor helper returned invalid JSON.' }
  if ($response -isnot [System.Management.Automation.PSCustomObject] -or
      -not (Test-AuraUiStudioExactProperties -Message $response -Names @(
        'state', 'payload', 'themesChanged', 'configChanged', 'apply'))) {
    throw 'Aura Studio editor helper returned an invalid response shape.'
  }
  if ($response.themesChanged -isnot [bool] -or $response.configChanged -isnot [bool]) {
    throw 'Aura Studio editor helper returned an invalid change summary.'
  }
  if ($response.apply -isnot [string] -or
      $response.apply -cnotin @('draft', 'saved', 'persisted', 'none')) {
    throw 'Aura Studio editor helper returned an invalid apply action.'
  }
  if ($null -ne $response.payload -and $response.payload -isnot [string]) {
    throw 'Aura Studio editor helper returned an invalid payload.'
  }
  if (($null -ne $response.payload -and -not $response.payload.Trim()) -or
      ($response.apply -ceq 'none' -and $null -ne $response.payload) -or
      ($response.apply -cne 'none' -and $null -eq $response.payload)) {
    throw 'Aura Studio editor helper returned an inconsistent payload action.'
  }
  return [PSCustomObject]@{
    State = ConvertTo-AuraUiStudioEditorState -State $response.state
    Payload = $response.payload
    ThemesChanged = [bool]$response.themesChanged
    ConfigChanged = [bool]$response.configChanged
    Apply = [string]$response.apply
  }
}

function Invoke-AuraUiStudioEditorCore {
  param(
    [Parameter(Mandatory = $true)][object]$Request,
    [AllowNull()][string]$AssetPath
  )
  [void](Assert-AuraUiStudioEditorRoots -Create)
  [void](Assert-AuraUiThemeInstallRoot -Create)
  $requestJson = $Request | ConvertTo-Json -Depth 10 -Compress
  $arguments = @(
    $ThemeCli, 'studio', '--config', $ConfigPath, '--user-themes', $UserThemesRoot,
    '--editor-root', $StudioEditorRoot, '--locale', $script:Locale,
    '--request-base64', (ConvertTo-AuraUiBase64Url -Value $requestJson))
  if ($AssetPath) {
    $editorRoot = [IO.Path]::GetFullPath($StudioEditorRoot).TrimEnd(
      [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    $asset = [IO.Path]::GetFullPath($AssetPath)
    $editorPrefix = $editorRoot + [IO.Path]::DirectorySeparatorChar
    if (-not $asset.StartsWith($editorPrefix, [StringComparison]::OrdinalIgnoreCase) -or
        -not (Test-Path -LiteralPath $asset -PathType Leaf)) {
      throw 'Aura Studio refused an editor asset outside its app-owned folder.'
    }
    $assetItem = Get-Item -LiteralPath $asset -Force
    if (($assetItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'Aura Studio editor assets cannot be symbolic links.'
    }
    $arguments += @('--asset', $asset)
  }
  return ConvertFrom-AuraUiStudioEditorResponse -Raw (Invoke-AuraUiNode -CommandArguments $arguments)
}

function Get-AuraUiStudioEditorCoreState {
  [void](Assert-AuraUiStudioEditorRoots -Create)
  [void](Assert-AuraUiThemeInstallRoot -Create)
  $raw = Invoke-AuraUiNode -CommandArguments @(
    $ThemeCli, 'studio-state', '--config', $ConfigPath, '--user-themes', $UserThemesRoot,
    '--editor-root', $StudioEditorRoot, '--locale', $script:Locale)
  return ConvertFrom-AuraUiStudioEditorResponse -Raw $raw
}

function Sync-AuraUiStudioEditorDraft {
  $result = Get-AuraUiStudioEditorCoreState
  $script:StudioEditorState = $result.State
  if ($null -ne $result.Payload) {
    $payloadChanged = -not [string]::Equals($script:Payload, $result.Payload, [StringComparison]::Ordinal)
    Set-AuraUiPayloadState -Payload $result.Payload
    if ($payloadChanged -and $script:WebReady -and $result.Apply -cne 'none') { Apply-AuraUiTheme }
  }
  return $result
}

function Get-AuraUiStudioEditorStatus {
  param(
    [Parameter(Mandatory = $true)][string]$Action,
    [bool]$Succeeded = $true
  )
  if (-not $Succeeded) {
    switch -CaseSensitive ($Action) {
      'save-theme-edit' { return "$($script:UiCopy.themeEditSaveFailed)" }
      'delete-user-theme' { return "$($script:UiCopy.themeDeleteFailed)" }
      'pick-theme-layer-image' { return "$($script:UiCopy.themeLayerImageFailed)" }
      default { return "$($script:UiCopy.themeEditFailed)" }
    }
  }
  switch -CaseSensitive ($Action) {
    'create-theme-copy' { return "$($script:UiCopy.themeCopyReady)" }
    'begin-theme-edit' { return "$($script:UiCopy.themeEditReady)" }
    'pick-theme-layer-image' { return "$($script:UiCopy.themeLayerImageImported)" }
    'save-theme-edit' { return "$($script:UiCopy.themeEditSaved)" }
    'discard-theme-edit' { return "$($script:UiCopy.themeEditDiscarded)" }
    'delete-user-theme' { return "$($script:UiCopy.themeDeleted)" }
    default { return "$($script:UiCopy.themeDraftUpdated)" }
  }
}

function Complete-AuraUiStudioEditorAction {
  param(
    [Parameter(Mandatory = $true)][string]$Action,
    [Parameter(Mandatory = $true)][object]$Result
  )
  $script:StudioEditorState = $Result.State
  if ($Result.ConfigChanged) {
    $script:Config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Set-AuraUiPreferredColorScheme
  }
  if ($Result.ThemesChanged) { [void](Update-AuraUiThemes) }
  if ($null -ne $Result.Payload) {
    if (-not $Result.Payload.Trim()) { throw 'Aura Studio editor helper returned an empty payload.' }
    Set-AuraUiPayloadState -Payload $Result.Payload
    if ($Result.Apply -cne 'none') { Apply-AuraUiTheme }
  }
  Update-AuraUiTrayAppearance
  $succeeded = $true
  $actionSucceeded = Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('actionSucceeded')
  $errorValue = Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('error')
  if ($null -ne $actionSucceeded) { $succeeded = [bool]$actionSucceeded }
  if ($null -ne $errorValue -and "$errorValue".Trim()) { $succeeded = $false }
  Send-AuraUiStudioState -Status (Get-AuraUiStudioEditorStatus -Action $Action -Succeeded $succeeded) `
    -Tone $(if ($succeeded) { 'ok' } else { 'error' }) -Action $Action -ActionSucceeded $succeeded
  return $succeeded
}

function Assert-AuraUiStudioEditorSession {
  param([Parameter(Mandatory = $true)][object]$Request)
  $active = Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('active')
  if ($active -ne $true) { throw 'Aura Studio does not have an active editor session.' }
  $session = Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('session')
  $revision = Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('revision')
  if ($Request.session -isnot [string] -or
      -not [string]::Equals([string]$Request.session, [string]$session, [StringComparison]::Ordinal)) {
    throw 'Aura Studio rejected an editor message from a different session.'
  }
  $requestedRevision = ConvertTo-AuraUiStudioInteger -Value $Request.revision -Minimum 0 -Maximum 2147483647 -Label 'Editor revision'
  $activeRevision = ConvertTo-AuraUiStudioInteger -Value $revision -Minimum 0 -Maximum 2147483647 -Label 'Active editor revision'
  if ($requestedRevision -ne $activeRevision) { throw 'Aura Studio rejected a stale editor revision.' }
}

function Get-AuraUiStudioKnownTheme {
  param(
    [Parameter(Mandatory = $true)][string]$Theme,
    [switch]$UserOnly
  )
  if ($Theme -cnotmatch '^[a-z][a-z0-9-]{1,39}$') { throw 'Aura Studio theme id is invalid.' }
  $item = Get-AuraUiThemeByName -Name $Theme
  if ($null -eq $item -or -not [string]::Equals("$($item.name)", $Theme, [StringComparison]::Ordinal)) {
    throw 'Aura Studio requested an unknown theme.'
  }
  if ($UserOnly -and "$($item.source)" -cne 'user') {
    throw 'Built-in themes must be duplicated before they can be edited or deleted.'
  }
  return $item
}

function Invoke-AuraUiStudioEditorRequest {
  param(
    [Parameter(Mandatory = $true)][object]$Request,
    [AllowNull()][string]$AssetPath
  )
  $result = Invoke-AuraUiStudioEditorCore -Request $Request -AssetPath $AssetPath
  return Complete-AuraUiStudioEditorAction -Action ([string]$Request.type) -Result $result
}

function Invoke-AuraUiCreateThemeCopy {
  param([Parameter(Mandatory = $true)][object]$Request)
  if ((Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('active')) -eq $true) {
    throw 'Finish or discard the current Aura Studio edit first.'
  }
  [void](Get-AuraUiStudioKnownTheme -Theme ([string]$Request.theme))
  return Invoke-AuraUiStudioEditorRequest -Request $Request
}

function Invoke-AuraUiBeginThemeEdit {
  param([Parameter(Mandatory = $true)][object]$Request)
  $active = (Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('active')) -eq $true
  $activeId = Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('id')
  if ($active) {
    if (-not $Request.reset -or
        -not [string]::Equals([string]$activeId, [string]$Request.theme, [StringComparison]::Ordinal)) {
      throw 'Finish or discard the current Aura Studio edit first.'
    }
  } else {
    [void](Get-AuraUiStudioKnownTheme -Theme ([string]$Request.theme) -UserOnly)
  }
  return Invoke-AuraUiStudioEditorRequest -Request $Request
}

function Invoke-AuraUiSetThemeToken {
  param([Parameter(Mandatory = $true)][object]$Request)
  Assert-AuraUiStudioEditorSession -Request $Request
  return Invoke-AuraUiStudioEditorRequest -Request $Request
}

function Invoke-AuraUiSetThemeLayer {
  param([Parameter(Mandatory = $true)][object]$Request)
  Assert-AuraUiStudioEditorSession -Request $Request
  return Invoke-AuraUiStudioEditorRequest -Request $Request
}

function Invoke-AuraUiPickThemeLayerImage {
  param(
    [Parameter(Mandatory = $true)][object]$Request,
    [AllowNull()][System.Windows.Forms.IWin32Window]$Owner
  )
  Assert-AuraUiStudioEditorSession -Request $Request
  [void](Assert-AuraUiStudioEditorRoots -Create)
  $dialog = [System.Windows.Forms.OpenFileDialog]::new()
  $targetPath = $null
  try {
    $dialog.Title = "$($script:UiCopy.chooseThemeLayerImageTitle)"
    $dialog.Filter = "$($script:UiCopy.imagesFilter)|*.png;*.jpg;*.jpeg;*.webp;*.avif"
    $dialog.CheckFileExists = $true
    $dialog.Multiselect = $false
    $dialog.RestoreDirectory = $true
    if ($dialog.ShowDialog($Owner) -ne [System.Windows.Forms.DialogResult]::OK) {
      $script:StudioEditorState['lastAction'] = 'pick-theme-layer-image'
      $script:StudioEditorState['actionSucceeded'] = $false
      $script:StudioEditorState['error'] = $null
      Send-AuraUiStudioState -Action 'pick-theme-layer-image' -ActionSucceeded $false
      return $false
    }
    $sourceItem = Get-Item -LiteralPath $dialog.FileName -Force
    if (-not $sourceItem.PSIsContainer -and
        ($sourceItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0 -and
        $sourceItem.Length -gt 0 -and $sourceItem.Length -le $StudioEditorImageMaxBytes) {
      $targetPath = Join-Path $StudioEditorImportRoot ('layer-{0}.webp' -f [Guid]::NewGuid().ToString('N'))
    } else {
      throw 'The selected theme artwork is not a supported regular image file.'
    }
    $conversionJson = Invoke-AuraUiNode -CommandArguments @(
      $ThemeAssetConverter, '--studio-import', $sourceItem.FullName,
      '--target', $targetPath, '--output-root', $StudioEditorRoot)
    try { $conversion = $conversionJson | ConvertFrom-Json } catch { throw 'The artwork converter returned invalid JSON.' }
    if ($conversion -isnot [System.Management.Automation.PSCustomObject] -or
        -not (Test-AuraUiStudioExactProperties -Message $conversion -Names @('path', 'bytes', 'width', 'height'))) {
      throw 'The artwork converter returned an invalid response shape.'
    }
    $convertedPath = [IO.Path]::GetFullPath([string]$conversion.path)
    if (-not [string]::Equals($convertedPath, [IO.Path]::GetFullPath($targetPath), [StringComparison]::OrdinalIgnoreCase)) {
      throw 'The artwork converter returned an unexpected output path.'
    }
    [void](ConvertTo-AuraUiStudioInteger -Value $conversion.bytes -Minimum 1 -Maximum 399999 -Label 'Converted artwork bytes')
    [void](ConvertTo-AuraUiStudioInteger -Value $conversion.width -Minimum 1 -Maximum 32768 -Label 'Converted artwork width')
    [void](ConvertTo-AuraUiStudioInteger -Value $conversion.height -Minimum 1 -Maximum 32768 -Label 'Converted artwork height')
    return Invoke-AuraUiStudioEditorRequest -Request $Request -AssetPath $convertedPath
  } finally {
    $dialog.Dispose()
    if ($targetPath -and (Test-Path -LiteralPath $targetPath -PathType Leaf)) {
      try {
        $target = Get-Item -LiteralPath $targetPath -Force
        if (($target.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0 -and
            [string]::Equals($target.DirectoryName, [IO.Path]::GetFullPath($StudioEditorImportRoot), [StringComparison]::OrdinalIgnoreCase)) {
          [IO.File]::Delete($target.FullName)
        }
      } catch { Write-AuraUiLog -Message "Studio import cleanup failed: $($_.Exception.Message)" }
    }
  }
}

function Invoke-AuraUiRemoveThemeLayer {
  param([Parameter(Mandatory = $true)][object]$Request)
  Assert-AuraUiStudioEditorSession -Request $Request
  return Invoke-AuraUiStudioEditorRequest -Request $Request
}

function Invoke-AuraUiMoveThemeLayer {
  param([Parameter(Mandatory = $true)][object]$Request)
  Assert-AuraUiStudioEditorSession -Request $Request
  return Invoke-AuraUiStudioEditorRequest -Request $Request
}

function Invoke-AuraUiUndoThemeEdit {
  param([Parameter(Mandatory = $true)][object]$Request)
  Assert-AuraUiStudioEditorSession -Request $Request
  return Invoke-AuraUiStudioEditorRequest -Request $Request
}

function Invoke-AuraUiRedoThemeEdit {
  param([Parameter(Mandatory = $true)][object]$Request)
  Assert-AuraUiStudioEditorSession -Request $Request
  return Invoke-AuraUiStudioEditorRequest -Request $Request
}

function Invoke-AuraUiSaveThemeEdit {
  param([Parameter(Mandatory = $true)][object]$Request)
  Assert-AuraUiStudioEditorSession -Request $Request
  return Invoke-AuraUiStudioEditorRequest -Request $Request
}

function Invoke-AuraUiDiscardThemeEdit {
  param([Parameter(Mandatory = $true)][object]$Request)
  Assert-AuraUiStudioEditorSession -Request $Request
  return Invoke-AuraUiStudioEditorRequest -Request $Request
}

function Invoke-AuraUiDeleteUserTheme {
  param([Parameter(Mandatory = $true)][object]$Request)
  if ((Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('active')) -eq $true) {
    throw 'Finish or discard the current Aura Studio edit before deleting a theme.'
  }
  [void](Get-AuraUiStudioKnownTheme -Theme ([string]$Request.theme) -UserOnly)
  $configuredTheme = if ($null -ne $script:Config) {
    Get-AuraUiPropertyValue -InputObject $script:Config -Names @('theme')
  } else { $null }
  if ([string]::Equals([string]$configuredTheme, [string]$Request.theme, [StringComparison]::Ordinal) -or
      [string]::Equals([string]$script:ActiveThemeName, [string]$Request.theme, [StringComparison]::Ordinal)) {
    Set-AuraUiConfig -Options @('--theme', 'default', '--enabled', 'true')
    $restoredTheme = Get-AuraUiPropertyValue -InputObject $script:Config -Names @('theme')
    if (-not [string]::Equals([string]$restoredTheme, 'default', [StringComparison]::Ordinal) -or
        -not [string]::Equals([string]$script:ActiveThemeName, 'default', [StringComparison]::Ordinal)) {
      throw 'Aura Studio could not apply Default before deleting the active theme.'
    }
    Apply-AuraUiTheme
  }
  return Invoke-AuraUiStudioEditorRequest -Request $Request
}

function Send-AuraUiStudioState {
  param(
    [AllowEmptyString()][string]$Status = '',
    [ValidateSet('ok', 'busy', 'error')][string]$Tone = 'ok',
    [ValidateSet(
      '', 'set-image-framing', 'set-card-preview-crop',
      'create-theme-copy', 'begin-theme-edit', 'set-theme-token', 'set-theme-layer',
      'pick-theme-layer-image', 'remove-theme-layer', 'move-theme-layer',
      'undo-theme-edit', 'redo-theme-edit', 'save-theme-edit', 'discard-theme-edit',
      'delete-user-theme')][string]$Action = '',
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
      appearance = (Get-AuraUiAppearance)
      enabled = $enabled
      hasImage = ($null -ne $imageValue -and "$imageValue".Trim().Length -gt 0)
      imagePreviewUrl = $imagePreviewUrl
      backgroundAspectRatio = Get-AuraUiBackgroundAspectRatio
      backgroundCrop = Get-AuraUiStudioBackgroundCrop
      studioPreviewCrops = Get-AuraUiStudioPreviewCrops
      themes = @($script:Themes)
      editor = $script:StudioEditorState
      status = $Status
      tone = $Tone
    }
    if ($Action) {
      $state['action'] = $Action
      $state['actionSucceeded'] = $ActionSucceeded
    }
    $json = $state | ConvertTo-Json -Depth 10 -Compress
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
  Request-AuraUiMirror
}

function Show-AuraUiMain {
  if ($null -eq $script:Form -or $script:Form.IsDisposed) { return }
  if (-not $script:Form.Visible) { $script:Form.Show() }
  if ($script:Form.WindowState -eq [System.Windows.Forms.FormWindowState]::Minimized) {
    $script:Form.WindowState = [System.Windows.Forms.FormWindowState]::Normal
  }
  $script:Form.Activate()
  $script:Form.BringToFront()
}

function Set-AuraUiPreviewSize {
  param([Parameter(Mandatory = $true)][string]$Size)
  $customWidth = 0
  $customHeight = 0
  if ($Size -cmatch '^(\d{3,4})x(\d{3,4})$') {
    $customWidth = [int]$Matches[1]
    $customHeight = [int]$Matches[2]
    if ($customWidth -lt 920 -or $customWidth -gt 3840 -or $customHeight -lt 620 -or $customHeight -gt 2400) {
      throw 'Aura preview size is not allowed.'
    }
  } elseif ($Size -cnotin @('launch', 'wide', 'full')) {
    throw 'Aura preview size is not allowed.'
  }
  if ($null -eq $script:Form -or $script:Form.IsDisposed) { return }
  Show-AuraUiMain
  if ($Size -ceq 'full') {
    $script:Form.WindowState = [System.Windows.Forms.FormWindowState]::Maximized
    Request-AuraUiMirror
    return
  }
  $script:Form.WindowState = [System.Windows.Forms.FormWindowState]::Normal
  if ($customWidth -gt 0) {
    # Custom dimensions may exceed the working area on purpose: the Studio
    # mirror still captures the full webview, so oversized states remain
    # reviewable on smaller monitors. Only the location is kept on screen.
    $script:Form.ClientSize = [Drawing.Size]::new($customWidth, $customHeight)
    $workingArea = [System.Windows.Forms.Screen]::FromControl($script:Form).WorkingArea
    $script:Form.Location = [Drawing.Point]::new(
      [Math]::Max($workingArea.Left, [Math]::Min($script:Form.Location.X, $workingArea.Right - 240)),
      [Math]::Max($workingArea.Top, [Math]::Min($script:Form.Location.Y, $workingArea.Bottom - 160)))
  } else {
    $script:Form.ClientSize = if ($Size -ceq 'wide') {
      [Drawing.Size]::new(1560, 940)
    } else {
      [Drawing.Size]::new(1180, 640)
    }
    Set-AuraUiFormWithinWorkingArea -Form $script:Form
  }
  Request-AuraUiMirror
}

function Request-AuraUiMirror {
  if ($null -eq $script:StudioForm -or $script:StudioForm.IsDisposed -or -not $script:StudioForm.Visible) { return }
  if ($null -eq $script:Form -or $script:Form.IsDisposed) { return }
  if ($script:Form.WindowState -eq [System.Windows.Forms.FormWindowState]::Minimized) { return }
  $script:MirrorDue = [DateTime]::UtcNow.AddMilliseconds(350)
}

function Start-AuraUiMirrorCapture {
  try {
    $script:MirrorStream = [IO.MemoryStream]::new()
    $script:MirrorCaptureTask = $script:WebView.CoreWebView2.CapturePreviewAsync(
      [Microsoft.Web.WebView2.Core.CoreWebView2CapturePreviewImageFormat]::Jpeg, $script:MirrorStream)
  } catch {
    Write-AuraUiLog -Message "Aura mirror capture failed: $($_.Exception.Message)"
    if ($null -ne $script:MirrorStream) {
      $script:MirrorStream.Dispose()
      $script:MirrorStream = $null
    }
    $script:MirrorCaptureTask = $null
  }
}

function Update-AuraUiMirror {
  # Runs on the UI timer: never blocks on an incomplete probe or capture task.
  if ($null -ne $script:MirrorCaptureTask) {
    if (-not $script:MirrorCaptureTask.IsCompleted) { return }
    $task = $script:MirrorCaptureTask
    $stream = $script:MirrorStream
    $script:MirrorCaptureTask = $null
    $script:MirrorStream = $null
    try {
      [void]$task.GetAwaiter().GetResult()
      if ($null -ne $script:StudioWebView -and $null -ne $script:StudioWebView.CoreWebView2 -and $stream.Length -gt 0 -and $stream.Length -le 8000000) {
        $geometry = $script:MirrorGeometry
        $width = [int]$script:WebView.ClientSize.Width
        $height = [int]$script:WebView.ClientSize.Height
        if ($null -ne $geometry -and $geometry.innerWidth -ge 200 -and $geometry.innerHeight -ge 200) {
          # CSS pixels, so the page-reported layout rectangles line up 1:1.
          $width = [int]$geometry.innerWidth
          $height = [int]$geometry.innerHeight
        }
        $payload = [ordered]@{
          type = 'aura-mirror'
          image = 'data:image/jpeg;base64,' + [Convert]::ToBase64String($stream.ToArray())
          width = $width
          height = $height
        }
        if ($null -ne $geometry) {
          $rect = $null
          if ($null -ne $geometry.main) {
            $rect = [ordered]@{
              left = [double]$geometry.main.left; top = [double]$geometry.main.top
              width = [double]$geometry.main.width; height = [double]$geometry.main.height
            }
          }
          $promptRect = $null
          if ($null -ne $geometry.prompt) {
            $promptRect = [ordered]@{
              left = [double]$geometry.prompt.left; top = [double]$geometry.prompt.top
              width = [double]$geometry.prompt.width; height = [double]$geometry.prompt.height
            }
          }
          $payload['geometry'] = [ordered]@{
            context = [string]$geometry.context
            mode = [string]$geometry.mode
            main = $rect
            prompt = $promptRect
          }
        }
        $script:StudioWebView.CoreWebView2.PostWebMessageAsJson(($payload | ConvertTo-Json -Depth 6 -Compress))
      }
    } catch {
      Write-AuraUiLog -Message "Aura mirror capture failed: $($_.Exception.Message)"
    } finally {
      if ($null -ne $stream) { $stream.Dispose() }
    }
    return
  }
  if ($null -ne $script:MirrorProbeTask) {
    if (-not $script:MirrorProbeTask.IsCompleted) { return }
    $task = $script:MirrorProbeTask
    $script:MirrorProbeTask = $null
    $script:MirrorGeometry = $null
    try {
      $raw = $task.GetAwaiter().GetResult()
      if ($raw -and $raw -cne 'null') { $script:MirrorGeometry = $raw | ConvertFrom-Json }
    } catch {
      Write-AuraUiLog -Message "Aura mirror layout probe failed: $($_.Exception.Message)"
    }
    Start-AuraUiMirrorCapture
    return
  }
  if ($null -eq $script:MirrorDue -or [DateTime]::UtcNow -lt $script:MirrorDue) { return }
  $script:MirrorDue = $null
  if (-not $script:WebReady -or $null -eq $script:WebView -or $null -eq $script:WebView.CoreWebView2) { return }
  if ($null -eq $script:StudioForm -or $script:StudioForm.IsDisposed -or -not $script:StudioForm.Visible) { return }
  if ($script:Form.WindowState -eq [System.Windows.Forms.FormWindowState]::Minimized) { return }
  # The renderer marks the live layout; read it so the Studio stage aligns
  # its overlays with the real sidebar, prompt block, context, and mode.
  $probe = '(() => { try { const root = document.documentElement; const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; }; return { context: root.dataset.claudeAuraContext || "other", mode: root.dataset.claudeAuraEffectiveMode || "light", innerWidth: window.innerWidth, innerHeight: window.innerHeight, main: rect(document.querySelector("[data-claude-aura-main-canvas]")), prompt: rect(document.querySelector("[data-claude-aura-prompt]")) }; } catch { return null; } })()'
  try {
    $script:MirrorProbeTask = $script:WebView.CoreWebView2.ExecuteScriptAsync($probe)
  } catch {
    Write-AuraUiLog -Message "Aura mirror layout probe failed: $($_.Exception.Message)"
    Start-AuraUiMirrorCapture
  }
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
  $zoomValue = ConvertTo-AuraUiStudioNumber -Value $Zoom -Minimum 1 -Maximum 6 -Label 'Studio preview zoom'
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
  Set-AuraUiPreferredColorScheme -Enabled $Enabled
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

function Invoke-AuraUiSetAppearance {
  param([Parameter(Mandatory = $true)][string]$Appearance)
  if ($Appearance -cnotin @('system', 'light', 'dark')) { throw 'Studio appearance must be system, light, or dark.' }
  Set-AuraUiConfig -Options @('--appearance', $Appearance)
  Set-AuraUiPreferredColorScheme -Appearance $Appearance
  if (Get-AuraUiEnabled) { Apply-AuraUiTheme }
  Send-AuraUiStudioState
}

function Assert-AuraUiStudioEditorMessage {
  param([Parameter(Mandatory = $true)][object]$Message)
  $type = [string]$Message.type
  if ($type -in @('create-theme-copy', 'begin-theme-edit', 'delete-user-theme')) {
    if ($Message.theme -isnot [string] -or $Message.theme -cnotmatch '^[a-z][a-z0-9-]{1,39}$') {
      throw 'Aura Studio editor theme id is invalid.'
    }
    if ($type -ceq 'begin-theme-edit' -and $Message.reset -isnot [bool]) {
      throw 'Aura Studio editor reset must be a Boolean.'
    }
    return
  }

  if ($Message.session -isnot [string] -or
      $Message.session -cnotmatch '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$') {
    throw 'Aura Studio editor session is invalid.'
  }
  [void](ConvertTo-AuraUiStudioInteger -Value $Message.revision -Minimum 0 -Maximum 2147483647 -Label 'Editor revision')

  switch -CaseSensitive ($type) {
    'set-theme-token' {
      if ($Message.mode -isnot [string] -or
          $Message.mode -cnotin @('light', 'dark', 'shared', 'mode-copy') -or
          $Message.token -isnot [string]) {
        throw 'Aura Studio theme token mode or id is invalid.'
      }
      if ($Message.mode -ceq 'mode-copy') {
        if ($Message.token -cne 'tokens' -or $Message.value -isnot [string] -or
            $Message.value -cnotin @('light', 'dark')) {
          throw 'Aura Studio mode copy is invalid.'
        }
        return
      }
      if ($Message.mode -cin @('light', 'dark')) {
        if ($Message.token -cin @('canvas', 'sidebar', 'surface', 'text', 'accent', 'border')) {
          if ($Message.value -isnot [string] -or $Message.value -cnotmatch '^#[0-9A-Fa-f]{6}$') {
            throw 'Aura Studio color tokens require a six-digit hex color.'
          }
          return
        }
        if ($Message.token -ceq 'surfaceAlpha') {
          [void](ConvertTo-AuraUiStudioNumber -Value $Message.value -Minimum 0.35 -Maximum 1 -Label 'Surface alpha')
          return
        }
        if ($Message.token -ceq 'sidebarAlpha') {
          [void](ConvertTo-AuraUiStudioNumber -Value $Message.value -Minimum 0.62 -Maximum 1 -Label 'Sidebar alpha')
          return
        }
        throw 'Aura Studio mode token is not allowed.'
      }
      switch -CaseSensitive ($Message.token) {
        'fontUi' {
          if ($Message.value -isnot [string] -or
              $Message.value -cnotin @('system-sans', 'humanist-sans', 'rounded-sans')) {
            throw 'Aura Studio UI font is not allowed.'
          }
          break
        }
        'fontDisplay' {
          if ($Message.value -isnot [string] -or
              $Message.value -cnotin @('system-sans', 'humanist-sans', 'rounded-sans', 'editorial-serif')) {
            throw 'Aura Studio display font is not allowed.'
          }
          break
        }
        'radius' { [void](ConvertTo-AuraUiStudioNumber -Value $Message.value -Minimum 0 -Maximum 32 -Label 'Theme radius'); break }
        'blur' { [void](ConvertTo-AuraUiStudioNumber -Value $Message.value -Minimum 0 -Maximum 40 -Label 'Theme blur'); break }
        'shadow' {
          if ($Message.value -isnot [string] -or $Message.value -cnotin @('none', 'soft', 'elevated')) {
            throw 'Aura Studio shadow preset is not allowed.'
          }
          break
        }
        'backgroundScope' {
          if ($Message.value -isnot [string] -or $Message.value -cnotin @('content', 'full-window')) {
            throw 'Aura Studio background scope is not allowed.'
          }
          break
        }
        'promptWidth' { [void](ConvertTo-AuraUiStudioNumber -Value $Message.value -Minimum 0.4 -Maximum 0.96 -Label 'Prompt width'); break }
        'promptX' { [void](ConvertTo-AuraUiStudioNumber -Value $Message.value -Minimum -0.35 -Maximum 0.35 -Label 'Prompt horizontal position'); break }
        'promptY' { [void](ConvertTo-AuraUiStudioNumber -Value $Message.value -Minimum -0.3 -Maximum 0.3 -Label 'Prompt vertical position'); break }
        default { throw 'Aura Studio shared token is not allowed.' }
      }
      break
    }
    'set-theme-layer' {
      [void](ConvertTo-AuraUiStudioInteger -Value $Message.index -Minimum 0 -Maximum 7 -Label 'Theme layer index')
      if ($Message.preset -isnot [string] -or $Message.preset -cnotin @('shared', 'normal', 'wide') -or
          $Message.property -isnot [string]) {
        throw 'Aura Studio layer preset or property is invalid.'
      }
      if ($Message.preset -ceq 'shared') {
        switch -CaseSensitive ($Message.property) {
          'role' {
            if ($Message.value -isnot [string] -or
                $Message.value -cnotin @('background', 'hero', 'corner', 'decoration')) { throw 'Theme layer role is invalid.' }
            break
          }
          'appearance' {
            if ($Message.value -isnot [string] -or $Message.value -cnotin @('all', 'light', 'dark')) { throw 'Theme layer appearance is invalid.' }
            break
          }
          'context' {
            if ($Message.value -isnot [string] -or $Message.value -cnotin @('all', 'new-chat', 'conversation')) { throw 'Theme layer context is invalid.' }
            break
          }
          'viewport' {
            if ($Message.value -isnot [string] -or $Message.value -cnotin @('all', 'normal', 'wide')) { throw 'Theme layer viewport is invalid.' }
            break
          }
          'visible' { if ($Message.value -isnot [bool]) { throw 'Theme layer visibility must be a Boolean.' }; break }
          'opacity' { [void](ConvertTo-AuraUiStudioNumber -Value $Message.value -Minimum 0 -Maximum 1 -Label 'Theme layer opacity'); break }
          'mask' {
            if ($Message.value -isnot [string] -or $Message.value -cnotin @('none', 'soft-right')) { throw 'Theme layer mask is invalid.' }
            break
          }
          'mobile' {
            if ($Message.value -isnot [string] -or $Message.value -cnotin @('keep', 'reduce', 'hide')) { throw 'Theme layer mobile behavior is invalid.' }
            break
          }
          default { throw 'Aura Studio shared layer property is not allowed.' }
        }
        return
      }
      switch -CaseSensitive ($Message.property) {
        'anchor' {
          if ($Message.value -isnot [string] -or $Message.value -cnotin @(
              'top-left', 'top', 'top-right', 'left', 'center', 'right',
              'bottom-left', 'bottom', 'bottom-right')) { throw 'Theme layer anchor is invalid.' }
          break
        }
        'focalX' { [void](ConvertTo-AuraUiStudioNumber -Value $Message.value -Minimum 0 -Maximum 100 -Label 'Theme layer focal x'); break }
        'focalY' { [void](ConvertTo-AuraUiStudioNumber -Value $Message.value -Minimum 0 -Maximum 100 -Label 'Theme layer focal y'); break }
        'positionX' { [void](ConvertTo-AuraUiStudioNumber -Value $Message.value -Minimum -100 -Maximum 100 -Label 'Theme layer x'); break }
        'positionY' { [void](ConvertTo-AuraUiStudioNumber -Value $Message.value -Minimum -100 -Maximum 100 -Label 'Theme layer y'); break }
        'scale' { [void](ConvertTo-AuraUiStudioNumber -Value $Message.value -Minimum 0.25 -Maximum 3 -Label 'Theme layer scale'); break }
        default { throw 'Aura Studio framing property is not allowed.' }
      }
      break
    }
    'pick-theme-layer-image' {
      [void](ConvertTo-AuraUiStudioInteger -Value $Message.index -Minimum -1 -Maximum 7 -Label 'Theme layer index')
      if ($Message.role -isnot [string] -or
          $Message.role -cnotin @('background', 'hero', 'corner', 'decoration')) {
        throw 'Aura Studio image layer role is invalid.'
      }
      break
    }
    'remove-theme-layer' {
      [void](ConvertTo-AuraUiStudioInteger -Value $Message.index -Minimum 0 -Maximum 7 -Label 'Theme layer index')
      break
    }
    'move-theme-layer' {
      [void](ConvertTo-AuraUiStudioInteger -Value $Message.index -Minimum 0 -Maximum 7 -Label 'Theme layer index')
      if ($Message.direction -isnot [string] -or $Message.direction -cnotin @('up', 'down')) {
        throw 'Aura Studio layer move direction is invalid.'
      }
      break
    }
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
    'set-appearance' { 'type'; 'appearance'; break }
    'set-enabled' { 'type'; 'enabled'; break }
    'set-image-framing' { 'type'; 'x'; 'y'; 'zoom'; break }
    'set-card-preview-crop' { 'type'; 'theme'; 'x'; 'y'; 'zoom'; break }
    'create-theme-copy' { 'type'; 'theme'; break }
    'begin-theme-edit' { 'type'; 'theme'; 'reset'; break }
    'set-theme-token' { 'type'; 'session'; 'revision'; 'mode'; 'token'; 'value'; break }
    'set-theme-layer' { 'type'; 'session'; 'revision'; 'index'; 'preset'; 'property'; 'value'; break }
    'pick-theme-layer-image' { 'type'; 'session'; 'revision'; 'index'; 'role'; break }
    'remove-theme-layer' { 'type'; 'session'; 'revision'; 'index'; break }
    'move-theme-layer' { 'type'; 'session'; 'revision'; 'index'; 'direction'; break }
    'undo-theme-edit' { 'type'; 'session'; 'revision'; break }
    'redo-theme-edit' { 'type'; 'session'; 'revision'; break }
    'save-theme-edit' { 'type'; 'session'; 'revision'; break }
    'discard-theme-edit' { 'type'; 'session'; 'revision'; break }
    'delete-user-theme' { 'type'; 'theme'; break }
    'set-aura-preview' { 'type'; 'size'; break }
    'set-aura-topmost' { 'type'; 'enabled'; break }
    default { 'type'; break }
  })
  $propertyNames = @($message.PSObject.Properties | ForEach-Object { $_.Name })
  if ($propertyNames.Count -ne $expectedProperties.Count) { throw 'Studio message has unexpected properties.' }
  foreach ($name in $expectedProperties) {
    if ($propertyNames -cnotcontains $name) { throw 'Studio message is missing a required property.' }
  }
  if ($type -in @(
      'create-theme-copy', 'begin-theme-edit', 'set-theme-token', 'set-theme-layer',
      'pick-theme-layer-image', 'remove-theme-layer', 'move-theme-layer', 'undo-theme-edit',
      'redo-theme-edit', 'save-theme-edit', 'discard-theme-edit', 'delete-user-theme')) {
    Assert-AuraUiStudioEditorMessage -Message $message
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
    'get-state' {
      [void](Sync-AuraUiStudioEditorDraft)
      Send-AuraUiStudioState
      Request-AuraUiMirror
      break
    }
    'set-theme' {
      if ($message.theme -isnot [string]) { throw 'Studio theme must be a string.' }
      Invoke-AuraUiSelectTheme -Theme ([string]$message.theme)
      break
    }
    'set-appearance' {
      if ($message.appearance -isnot [string]) { throw 'Studio appearance must be a string.' }
      Invoke-AuraUiSetAppearance -Appearance ([string]$message.appearance)
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
    'open-aura' { Show-AuraUiMain; break }
    'set-aura-preview' {
      if ($message.size -isnot [string]) { throw 'Aura preview size must be a string.' }
      Set-AuraUiPreviewSize -Size ([string]$message.size)
      break
    }
    'set-aura-topmost' {
      if ($message.enabled -isnot [bool]) { throw 'Aura topmost state must be a Boolean.' }
      if ($null -ne $script:Form -and -not $script:Form.IsDisposed) {
        $script:Form.TopMost = [bool]$message.enabled
        if ([bool]$message.enabled) { Show-AuraUiMain }
      }
      break
    }
    'refresh-aura-mirror' { Request-AuraUiMirror; break }
    'open-desktop' { Invoke-AuraUiOpenDesktopApp; Send-AuraUiStudioState; break }
    'import-theme' {
      [void](Invoke-AuraUiImportTheme -Owner $script:StudioForm)
      break
    }
    'create-theme-copy' { [void](Invoke-AuraUiCreateThemeCopy -Request $message); break }
    'begin-theme-edit' { [void](Invoke-AuraUiBeginThemeEdit -Request $message); break }
    'set-theme-token' { [void](Invoke-AuraUiSetThemeToken -Request $message); break }
    'set-theme-layer' { [void](Invoke-AuraUiSetThemeLayer -Request $message); break }
    'pick-theme-layer-image' {
      [void](Invoke-AuraUiPickThemeLayerImage -Request $message -Owner $script:StudioForm)
      break
    }
    'remove-theme-layer' { [void](Invoke-AuraUiRemoveThemeLayer -Request $message); break }
    'move-theme-layer' { [void](Invoke-AuraUiMoveThemeLayer -Request $message); break }
    'undo-theme-edit' { [void](Invoke-AuraUiUndoThemeEdit -Request $message); break }
    'redo-theme-edit' { [void](Invoke-AuraUiRedoThemeEdit -Request $message); break }
    'save-theme-edit' { [void](Invoke-AuraUiSaveThemeEdit -Request $message); break }
    'discard-theme-edit' { [void](Invoke-AuraUiDiscardThemeEdit -Request $message); break }
    'delete-user-theme' { [void](Invoke-AuraUiDeleteUserTheme -Request $message); break }
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
  'set-appearance',
  'set-image',
  'clear-image',
  'set-image-framing',
  'set-card-preview-crop',
  'set-enabled',
  'open-aura',
  'open-desktop',
  'import-theme',
  'create-theme-copy',
  'begin-theme-edit',
  'set-theme-token',
  'set-theme-layer',
  'pick-theme-layer-image',
  'remove-theme-layer',
  'move-theme-layer',
  'undo-theme-edit',
  'redo-theme-edit',
  'save-theme-edit',
  'discard-theme-edit',
  'delete-user-theme',
  'set-aura-preview',
  'set-aura-topmost',
  'refresh-aura-mirror'
)
$script:StudioEditorState = [ordered]@{ active = $false }
$script:StudioForm = $null
$script:StudioWebView = $null
$script:StudioEnsureTask = $null
$script:StudioReady = $false
$script:StudioInitializationFailed = $false
$script:StudioBackgroundFingerprint = $null
$script:StudioBackgroundPreviewUrl = $null
$script:StudioBackgroundPreviewPath = $null
$script:MirrorCaptureTask = $null
$script:MirrorStream = $null
$script:MirrorDue = $null
$script:MirrorProbeTask = $null
$script:MirrorGeometry = $null
$script:WebViewEnvironment = $null
$script:TrayIcon = $null
$script:TrayMenu = $null
$script:TrayOpenStudioItem = $null
$script:TrayAppearanceItem = $null
$script:TrayOpenDesktopItem = $null
$script:TrayExitItem = $null
$script:MainIcon = $null
$script:StudioIcon = $null
$script:NotificationIcon = $null
$script:ThemeIdentityAssetPath = $null
$script:StudioOpenSignal = $null
$script:Launcher = $null
$script:LauncherButton = $null
$script:LauncherMenu = $null
$script:LauncherAppearanceItem = $null
$script:LauncherStyle = $null
$script:LauncherMark = $null
$script:LauncherDragging = $false
$script:LauncherDragged = $false
$script:LauncherDragArmed = $false
$script:LauncherClickArmed = $false
$script:LauncherDragStart = $null
$script:LauncherDragOrigin = $null
$script:LauncherHover = $false
$script:LauncherExpanded = $false
$script:LauncherExpandsLeft = $true
$script:LauncherCompactSize = 48
$script:LauncherExpandedWidth = 176
$script:LauncherSafeGap = 16
$script:LauncherRightGap = 16
$script:LauncherBottomGap = 16
$script:JumpListRegistered = $false
$script:Closing = $false
$mutex = $null
$ownsMutex = $false

try {
  if ([Threading.Thread]::CurrentThread.ApartmentState -ne [Threading.ApartmentState]::STA) {
    throw 'Claude Aura must run in a standard Windows desktop session.'
  }

  [void](Assert-AuraUiStudioEditorRoots -Create)
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
  [void](Sync-AuraUiStudioEditorDraft)

  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  $script:MainIcon = New-AuraUiIcon -Size 64
  $script:StudioIcon = New-AuraUiIcon -Size 64
  $script:NotificationIcon = New-AuraUiIcon -Size 32
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
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool DestroyIcon(IntPtr handle);
  [DllImport("shell32.dll")] public static extern int SetCurrentProcessExplicitAppUserModelID([MarshalAs(UnmanagedType.LPWStr)] string appID);
}
'@
  }
  # Give the process a stable taskbar identity so it stops grouping under the
  # generic PowerShell host. This is also the prerequisite for attaching a
  # taskbar Jump List to the running window in a later pass.
  try { [void][AuraWindow]::SetCurrentProcessExplicitAppUserModelID('ClaudeAura') } catch {}
  $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $studioSignalCreatedNew = $false
  $script:StudioOpenSignal = [System.Threading.EventWaitHandle]::new(
    $false,
    [System.Threading.EventResetMode]::AutoReset,
    "Local\ClaudeAura.$sid.OpenStudio",
    [ref]$studioSignalCreatedNew)
  $createdNew = $false
  $mutex = [System.Threading.Mutex]::new($true, "Local\ClaudeAura.$sid.Ui", [ref]$createdNew)
  $ownsMutex = $createdNew
  if (-not $createdNew) {
    if ($OpenStudio) {
      [void]$script:StudioOpenSignal.Set()
    } else {
      $handle = [AuraWindow]::FindWindow($null, 'Claude Aura')
      if ($handle -ne [IntPtr]::Zero) {
        [void][AuraWindow]::ShowWindow($handle, 9)
        [void][AuraWindow]::SetForegroundWindow($handle)
      }
    }
    return
  }
  if ($OpenStudio) { [void]$script:StudioOpenSignal.Set() }

  [System.Windows.Forms.Application]::EnableVisualStyles()
  [System.Windows.Forms.Application]::SetCompatibleTextRenderingDefault($false)

  $script:Form = [System.Windows.Forms.Form]::new()
  $script:Form.Text = 'Claude Aura'
  $script:Form.StartPosition = 'Manual'
  $script:Form.ClientSize = [Drawing.Size]::new(1180, 640)
  $script:Form.MinimumSize = [Drawing.Size]::new(920, 620)
  $script:Form.add_SizeChanged({ Request-AuraUiMirror })
  $script:Form.BackColor = [Drawing.ColorTranslator]::FromHtml('#F4F1EA')
  $script:Form.Icon = $script:MainIcon
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
  $script:StudioForm.Icon = $script:StudioIcon
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
  $script:TrayIcon.Icon = $script:NotificationIcon
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

  # A themed floating launcher: a separate owned overlay window pinned safely
  # inside the content. Being its own top-level window it renders above the
  # WebView without an in-content control's airspace limits, reserves no layout
  # space, never reflows or clips Claude, and keeps the main form content-only.
  # Hover names Studio and exposes a dedicated drag grip; the body opens Studio,
  # while right-click exposes appearance and Desktop actions. It never touches
  # the claude.ai document.
  $script:LauncherMenu = [System.Windows.Forms.ContextMenuStrip]::new()
  $launcherStudioItem = [System.Windows.Forms.ToolStripMenuItem]::new("$($script:UiCopy.openStudio)")
  $script:LauncherAppearanceItem = [System.Windows.Forms.ToolStripMenuItem]::new("$($script:UiCopy.originalLook)")
  $launcherDesktopItem = [System.Windows.Forms.ToolStripMenuItem]::new("$($script:UiCopy.openDesktopApp)")
  [void]$script:LauncherMenu.Items.AddRange(@($launcherStudioItem, $script:LauncherAppearanceItem, $launcherDesktopItem))
  $script:LauncherMenu.add_Opening({ Update-AuraUiTrayAppearance })
  $launcherStudioItem.add_Click({ Show-AuraUiStudio })
  $script:LauncherAppearanceItem.add_Click({
    try {
      Invoke-AuraUiSetEnabled -Enabled (-not (Get-AuraUiEnabled))
    } catch {
      Write-AuraUiLog -Message $_.Exception.ToString()
      Show-AuraUiMessage -Title "$($script:UiCopy.appearanceNotChangedTitle)" -Icon Warning -Message "$($script:UiCopy.appearanceNotChangedMessage)"
    }
  })
  $launcherDesktopItem.add_Click({
    try {
      Invoke-AuraUiOpenDesktopApp
    } catch {
      Write-AuraUiLog -Message $_.Exception.ToString()
      Show-AuraUiMessage -Title "$($script:UiCopy.desktopNotFoundTitle)" -Icon Information -Message "$($script:UiCopy.desktopNotFoundMessage)"
    }
  })

  $script:Launcher = [System.Windows.Forms.Form]::new()
  $script:Launcher.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
  $script:Launcher.ShowInTaskbar = $false
  $script:Launcher.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
  $script:Launcher.AutoScaleMode = [System.Windows.Forms.AutoScaleMode]::None
  $script:Launcher.ClientSize = [Drawing.Size]::new($script:LauncherCompactSize, $script:LauncherCompactSize)
  $script:Launcher.BackColor = [Drawing.ColorTranslator]::FromHtml('#2F2937')
  $script:Launcher.Opacity = 0.96
  $script:Launcher.Text = 'Claude Aura'

  $script:LauncherButton = [System.Windows.Forms.Button]::new()
  $script:LauncherButton.Dock = 'Fill'
  $script:LauncherButton.Text = ''
  $script:LauncherButton.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
  $script:LauncherButton.FlatAppearance.BorderSize = 0
  $script:LauncherButton.FlatAppearance.MouseOverBackColor = $script:Launcher.BackColor
  $script:LauncherButton.FlatAppearance.MouseDownBackColor = $script:Launcher.BackColor
  $script:LauncherButton.BackColor = $script:Launcher.BackColor
  $script:LauncherButton.UseVisualStyleBackColor = $false
  $script:LauncherButton.Cursor = [System.Windows.Forms.Cursors]::Hand
  $script:LauncherButton.TabStop = $false
  $script:LauncherButton.AccessibleName = "$($script:UiCopy.navLauncherName)"
  $script:LauncherButton.AccessibleRole = [System.Windows.Forms.AccessibleRole]::PushButton
  # Owner-drawn so every validated theme can supply its own launcher material
  # and local mark while an absent or invalid launcher always falls back to Aura.
  $script:LauncherButton.add_Paint({
    param($sender, $eventArgs)
    $graphics = $eventArgs.Graphics
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $width = $sender.ClientSize.Width
    $height = $sender.ClientSize.Height
    if ($width -le 0 -or $height -le 0) { return }
    $style = if ($null -ne $script:LauncherStyle) { $script:LauncherStyle } else { Get-AuraUiLauncherDefaultStyle }
    $surface = if ($script:LauncherHover) { "$($style.surfaceHover)" } else { "$($style.surface)" }
    $fill = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml($surface))
    $borderWidth = [float]$style.borderWidth
    $bounds = [Drawing.RectangleF]::new($borderWidth / 2, $borderWidth / 2, $width - $borderWidth, $height - $borderWidth)
    $shape = New-AuraUiRoundedRectanglePath -Bounds $bounds -Radius ([double]$style.radius)
    $graphics.FillPath($fill, $shape)
    $fill.Dispose()
    $rim = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml("$($style.border)"), $borderWidth)
    $graphics.DrawPath($rim, $shape)
    $rim.Dispose()
    $shape.Dispose()

    $iconX = if (-not $script:LauncherExpanded) {
      [Math]::Floor(($width - 32) / 2)
    } elseif ($script:LauncherExpandsLeft) {
      $width - 40
    } else { 8 }
    if ($null -ne $script:LauncherMark) {
      $previousInterpolation = $graphics.InterpolationMode
      $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.DrawImage($script:LauncherMark, [Drawing.Rectangle]::new($iconX, 8, 32, 32))
      $graphics.InterpolationMode = $previousInterpolation
    } else {
      $markCenterX = $iconX + 16
      $markCenterY = 24
      $markPen = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml("$($style.foreground)"), 2.2)
      $markPen.StartCap = [Drawing.Drawing2D.LineCap]::Round
      $markPen.EndCap = [Drawing.Drawing2D.LineCap]::Round
      for ($index = 0; $index -lt 8; $index++) {
        $angle = (-90 + ($index * 45)) * [Math]::PI / 180
        $graphics.DrawLine($markPen,
          [float]($markCenterX + [Math]::Cos($angle) * 8.5), [float]($markCenterY + [Math]::Sin($angle) * 8.5),
          [float]($markCenterX + [Math]::Cos($angle) * 13), [float]($markCenterY + [Math]::Sin($angle) * 13))
      }
      $markPen.Dispose()
      $core = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml("$($style.accent)"))
      $graphics.FillEllipse($core, $markCenterX - 5, $markCenterY - 5, 10, 10)
      $core.Dispose()
    }

    if ($script:LauncherExpanded) {
      $gripLeft = if ($script:LauncherExpandsLeft) { 0 } else { $width - 38 }
      $dividerX = if ($script:LauncherExpandsLeft) { 38 } else { $width - 39 }
      $divider = [Drawing.Pen]::new([Drawing.Color]::FromArgb(70, [Drawing.ColorTranslator]::FromHtml("$($style.foreground)")), 1)
      $graphics.DrawLine($divider, $dividerX, 11, $dividerX, $height - 11)
      $divider.Dispose()
      $textLeft = if ($script:LauncherExpandsLeft) { 46 } else { 48 }
      $textRight = if ($script:LauncherExpandsLeft) { $width - 47 } else { $width - 46 }
      $textRect = [Drawing.Rectangle]::new($textLeft, 0, [Math]::Max(1, $textRight - $textLeft), $height)
      $font = [Drawing.Font]::new('Segoe UI Semibold', 9.5, [Drawing.FontStyle]::Regular, [Drawing.GraphicsUnit]::Point)
      $flags = [System.Windows.Forms.TextFormatFlags]::VerticalCenter -bor
        [System.Windows.Forms.TextFormatFlags]::SingleLine -bor
        [System.Windows.Forms.TextFormatFlags]::EndEllipsis -bor
        [System.Windows.Forms.TextFormatFlags]::NoPrefix
      [System.Windows.Forms.TextRenderer]::DrawText($graphics, "$($script:UiCopy.openStudio)", $font, $textRect,
        [Drawing.ColorTranslator]::FromHtml("$($style.foreground)"), $flags)
      $font.Dispose()
      $grip = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(155, [Drawing.ColorTranslator]::FromHtml("$($style.foreground)")))
      $gripCenter = $gripLeft + 19
      foreach ($offsetX in @(-3, 3)) {
        foreach ($offsetY in @(-6, 0, 6)) {
          $graphics.FillEllipse($grip, [float]($gripCenter + $offsetX - 1.2), [float](24 + $offsetY - 1.2), 2.4, 2.4)
        }
      }
      $grip.Dispose()
    }
  })
  $script:LauncherButton.add_MouseDown({
    param($sender, $eventArgs)
    if ($eventArgs.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
      $script:LauncherDragArmed = Test-AuraUiLauncherGrip -Location $eventArgs.Location
      $script:LauncherClickArmed = -not $script:LauncherDragArmed
      $script:LauncherDragging = $script:LauncherDragArmed
      $script:LauncherDragged = $false
      if ($script:LauncherDragArmed) {
        $script:LauncherDragStart = [System.Windows.Forms.Cursor]::Position
        $script:LauncherDragOrigin = $script:Launcher.Location
      }
    }
  })
  $script:LauncherButton.add_MouseMove({
    param($sender, $eventArgs)
    if (-not $script:LauncherDragging) {
      $sender.Cursor = if (Test-AuraUiLauncherGrip -Location $eventArgs.Location) {
        [System.Windows.Forms.Cursors]::SizeAll
      } else { [System.Windows.Forms.Cursors]::Hand }
      return
    }
    $now = [System.Windows.Forms.Cursor]::Position
    $deltaX = $now.X - $script:LauncherDragStart.X
    $deltaY = $now.Y - $script:LauncherDragStart.Y
    if (-not $script:LauncherDragged -and ([Math]::Abs($deltaX) -gt 6 -or [Math]::Abs($deltaY) -gt 6)) {
      $script:LauncherDragged = $true
    }
    if ($script:LauncherDragged) {
      $target = [Drawing.Point]::new($script:LauncherDragOrigin.X + $deltaX, $script:LauncherDragOrigin.Y + $deltaY)
      $script:Launcher.Location = Get-AuraUiLauncherClampedLocation -Location $target
    }
  })
  $script:LauncherButton.add_MouseUp({
    param($sender, $eventArgs)
    if ($eventArgs.Button -eq [System.Windows.Forms.MouseButtons]::Right) {
      $script:LauncherDragging = $false
      $script:LauncherDragArmed = $false
      $script:LauncherClickArmed = $false
      $script:LauncherMenu.Show($script:LauncherButton, $eventArgs.Location)
      return
    }
    if ($eventArgs.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
      $moved = $script:LauncherDragged
      $wasDragArmed = $script:LauncherDragArmed
      $wasClickArmed = $script:LauncherClickArmed
      $script:LauncherDragging = $false
      $script:LauncherDragged = $false
      $script:LauncherDragArmed = $false
      $script:LauncherClickArmed = $false
      if ($wasDragArmed) {
        Set-AuraUiLauncherExpanded -Expanded $false
      }
      if ($moved -and $wasDragArmed) {
        Save-AuraUiLauncherPosition
      } elseif ($wasClickArmed) {
        Show-AuraUiStudio
      }
    }
  })
  $script:LauncherButton.add_MouseEnter({
    $script:LauncherHover = $true
    if ($null -ne $script:Launcher -and -not $script:Launcher.IsDisposed) { $script:Launcher.Opacity = 1.0 }
    Set-AuraUiLauncherExpanded -Expanded $true
    if ($null -ne $script:LauncherButton -and -not $script:LauncherButton.IsDisposed) { $script:LauncherButton.Invalidate() }
  })
  $script:LauncherButton.add_MouseLeave({
    $script:LauncherHover = $false
    if ($null -ne $script:Launcher -and -not $script:Launcher.IsDisposed) { $script:Launcher.Opacity = 0.96 }
    if (-not $script:LauncherDragging) { Set-AuraUiLauncherExpanded -Expanded $false }
    if ($null -ne $script:LauncherButton -and -not $script:LauncherButton.IsDisposed) { $script:LauncherButton.Invalidate() }
  })
  $script:Launcher.Controls.Add($script:LauncherButton)
  $script:Launcher.add_FormClosing({
    param($sender, $eventArgs)
    if (-not $script:Closing -and $eventArgs.CloseReason -eq [System.Windows.Forms.CloseReason]::UserClosing) {
      $eventArgs.Cancel = $true
      $sender.Hide()
    }
  })

  Read-AuraUiLauncherPosition
  $script:Form.add_LocationChanged({ Update-AuraUiLauncherPosition })
  $script:Form.add_SizeChanged({ Update-AuraUiLauncherPosition })
  $script:Form.add_Shown({ Update-AuraUiLauncherPosition })
  Update-AuraUiTrayAppearance

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
    if (-not $script:JumpListRegistered) {
      $script:JumpListRegistered = $true
      Register-AuraUiJumpList
    }
    try {
      if ($null -ne $script:StudioOpenSignal -and $script:StudioOpenSignal.WaitOne(0)) {
        Show-AuraUiStudio
      }
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
          Set-AuraUiPreferredColorScheme
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
          if (Test-Path -LiteralPath $StudioPreviewRoot -PathType Container) {
            $studioCore.SetVirtualHostNameToFolderMapping(
              'aura.previews',
              $StudioPreviewRoot,
              [Microsoft.Web.WebView2.Core.CoreWebView2HostResourceAccessKind]::Allow)
          } else {
            Write-AuraUiLog -Message "Studio preview master folder is missing: $StudioPreviewRoot"
          }
          if (Test-Path -LiteralPath $UserThemesRoot -PathType Container) {
            $studioCore.SetVirtualHostNameToFolderMapping(
              'aura.user-themes',
              $UserThemesRoot,
              [Microsoft.Web.WebView2.Core.CoreWebView2HostResourceAccessKind]::Allow)
          }
          $studioCore.SetVirtualHostNameToFolderMapping(
            'aura.background',
            $StudioBackgroundRoot,
            [Microsoft.Web.WebView2.Core.CoreWebView2HostResourceAccessKind]::Allow)
          $studioCore.SetVirtualHostNameToFolderMapping(
            'aura.editor',
            $StudioEditorPreviewRoot,
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
                    $failedMessage.type -in @(
                      'set-image-framing', 'set-card-preview-crop',
                      'create-theme-copy', 'begin-theme-edit', 'set-theme-token', 'set-theme-layer',
                      'pick-theme-layer-image', 'remove-theme-layer', 'move-theme-layer',
                      'undo-theme-edit', 'redo-theme-edit', 'save-theme-edit', 'discard-theme-edit',
                      'delete-user-theme')) {
                  $failedAction = [string]$failedMessage.type
                }
              } catch {}
              if ($failedAction) {
                if ($failedAction -in @(
                    'create-theme-copy', 'begin-theme-edit', 'set-theme-token', 'set-theme-layer',
                    'pick-theme-layer-image', 'remove-theme-layer', 'move-theme-layer',
                    'undo-theme-edit', 'redo-theme-edit', 'save-theme-edit', 'discard-theme-edit',
                    'delete-user-theme')) {
                  $script:StudioEditorState['lastAction'] = $failedAction
                  $script:StudioEditorState['actionSucceeded'] = $false
                  $script:StudioEditorState['error'] = 'request-rejected'
                  Send-AuraUiStudioState -Status (Get-AuraUiStudioEditorStatus -Action $failedAction -Succeeded $false) `
                    -Tone error -Action $failedAction -ActionSucceeded $false
                } else {
                  Send-AuraUiStudioState -Status "$($script:UiCopy.appearanceNotChangedMessage)" -Tone error -Action $failedAction -ActionSucceeded $false
                }
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
        Set-AuraUiPreferredColorScheme

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
            Show-AuraUiFirstRunNavHint
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
        # Keyboard accelerators live on CoreWebView2Controller, which this pinned
        # WinForms SDK (1.0.4078.44) does not surface publicly. Reach it through
        # the control's private field. The whole registration is guarded so a
        # missing field or SDK change can never abort startup — the shortcut is a
        # convenience on top of the rail and tray, never a load-bearing path.
        try {
          $controllerField = $script:WebView.GetType().GetField(
            '_coreWebView2Controller', [System.Reflection.BindingFlags]'Instance,NonPublic')
          $controller = if ($null -ne $controllerField) { $controllerField.GetValue($script:WebView) } else { $null }
          if ($null -ne $controller) {
            $controller.add_AcceleratorKeyPressed({
              param($sender, $eventArgs)
              try {
                if ($eventArgs.KeyEventKind -ne [Microsoft.Web.WebView2.Core.CoreWebView2KeyEventKind]::KeyDown -and
                    $eventArgs.KeyEventKind -ne [Microsoft.Web.WebView2.Core.CoreWebView2KeyEventKind]::SystemKeyDown) { return }
                $modifiers = [System.Windows.Forms.Control]::ModifierKeys
                $hasControl = ($modifiers -band [System.Windows.Forms.Keys]::Control) -ne 0
                $hasShift = ($modifiers -band [System.Windows.Forms.Keys]::Shift) -ne 0
                if (-not ($hasControl -and $hasShift)) { return }
                switch ([int]$eventArgs.VirtualKey) {
                  0x53 { $eventArgs.Handled = $true; Show-AuraUiStudio; break }
                  0x41 {
                    $eventArgs.Handled = $true
                    try {
                      Invoke-AuraUiSetEnabled -Enabled (-not (Get-AuraUiEnabled))
                    } catch {
                      Write-AuraUiLog -Message $_.Exception.ToString()
                    }
                    break
                  }
                }
              } catch { Write-AuraUiLog -Message $_.Exception.ToString() }
            })
          } else {
            Write-AuraUiLog -Message 'Keyboard accelerators unavailable: WebView2 controller was not reachable.'
          }
        } catch { Write-AuraUiLog -Message $_.Exception.ToString() }
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
        Request-AuraUiMirror
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
      Update-AuraUiMirror
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
      $script:TrayIcon = $null
    }
    if ($script:StudioForm -and -not $script:StudioForm.IsDisposed) { $script:StudioForm.Close() }
    if ($script:StudioWebView -and -not $script:StudioWebView.IsDisposed) { $script:StudioWebView.Dispose() }
    if ($script:Launcher -and -not $script:Launcher.IsDisposed) { $script:Launcher.Close() }
    if ($script:LauncherMark) { $script:LauncherMark.Dispose(); $script:LauncherMark = $null }
    if ($script:TrayMenu) { $script:TrayMenu.Dispose() }
    if ($script:LauncherMenu) { $script:LauncherMenu.Dispose() }
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
  if ($null -ne $script:TrayIcon) {
    try {
      $script:TrayIcon.Visible = $false
      $script:TrayIcon.Dispose()
    } catch {}
    $script:TrayIcon = $null
  }
  if ($null -ne $script:StudioOpenSignal) {
    try { $script:StudioOpenSignal.Dispose() } catch {}
    $script:StudioOpenSignal = $null
  }
  foreach ($ownedIcon in @($script:MainIcon, $script:StudioIcon, $script:NotificationIcon)) {
    if ($null -ne $ownedIcon) {
      try { $ownedIcon.Dispose() } catch {}
    }
  }
  $script:MainIcon = $null
  $script:StudioIcon = $null
  $script:NotificationIcon = $null
  $script:ThemeIdentityAssetPath = $null
  if ($ownsMutex -and $null -ne $mutex) {
    try { $mutex.ReleaseMutex() } catch {}
  }
  if ($null -ne $mutex) { $mutex.Dispose() }
}
