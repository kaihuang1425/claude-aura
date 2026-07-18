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
$WebDataRoot = Join-Path $env:LOCALAPPDATA 'ClaudeAura\webview'
$LogPath = Join-Path $DataRoot 'aura-ui.log'
$UiCopyPath = Join-Path $PSScriptRoot 'ui-copy.json'
$StudioRoot = Join-Path $Root 'studio'
$ThemeArtRoot = Join-Path $Root 'assets\theme-art'
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

function ConvertTo-AuraUiThemeColor {
  param([AllowNull()][object]$Value)
  if ($null -eq $Value) { return $null }
  $text = "$Value".Trim()
  if ($text -notmatch '^#[0-9a-fA-F]{3,8}$') { return $null }
  switch ($text.Length) {
    4 { return ('#{0}{0}{1}{1}{2}{2}' -f $text[1], $text[2], $text[3]).ToUpperInvariant() }
    5 { return ('#{0}{0}{1}{1}{2}{2}' -f $text[1], $text[2], $text[3]).ToUpperInvariant() }
    7 { return $text.ToUpperInvariant() }
    9 { return $text.Substring(0, 7).ToUpperInvariant() }
    default { return $null }
  }
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

  $previewSource = Get-AuraUiPropertyValue -InputObject $Item -Names @('preview', 'previewColors')
  if ($null -eq $previewSource) { $previewSource = $Item }
  $chrome = ConvertTo-AuraUiThemeColor -Value (Get-AuraUiPropertyValue -InputObject $previewSource -Names @('chrome', 'toolbar', 'header', 'shell', 'navigation'))
  $background = ConvertTo-AuraUiThemeColor -Value (Get-AuraUiPropertyValue -InputObject $previewSource -Names @('background', 'canvas', 'page', 'base'))
  $surface = ConvertTo-AuraUiThemeColor -Value (Get-AuraUiPropertyValue -InputObject $previewSource -Names @('surface', 'panel', 'card', 'elevated'))
  $accent = ConvertTo-AuraUiThemeColor -Value (Get-AuraUiPropertyValue -InputObject $previewSource -Names @('accent', 'primary', 'highlight', 'focus'))
  $textColor = ConvertTo-AuraUiThemeColor -Value (Get-AuraUiPropertyValue -InputObject $previewSource -Names @('text', 'foreground', 'ink'))

  $swatches = @()
  $swatchValues = Get-AuraUiPropertyValue -InputObject $Item -Names @('swatches', 'palette')
  if ($null -eq $swatchValues) {
    $swatchValues = Get-AuraUiPropertyValue -InputObject $previewSource -Names @('swatches', 'palette')
  }
  foreach ($swatchValue in @($swatchValues)) {
    $candidate = $swatchValue
    if (-not ($swatchValue -is [string])) {
      $candidate = Get-AuraUiPropertyValue -InputObject $swatchValue -Names @('hex', 'color', 'value')
    }
    $normalized = ConvertTo-AuraUiThemeColor -Value $candidate
    if ($normalized -and $swatches -notcontains $normalized) { $swatches += $normalized }
    if ($swatches.Count -ge 6) { break }
  }

  if (-not $chrome -and $swatches.Count -gt 0) { $chrome = $swatches[0] }
  if (-not $background -and $swatches.Count -gt 1) { $background = $swatches[1] }
  if (-not $surface -and $swatches.Count -gt 2) { $surface = $swatches[2] }
  if (-not $accent -and $swatches.Count -gt 3) { $accent = $swatches[3] }
  if (-not $accent -and $swatches.Count -gt 0) { $accent = $swatches[$swatches.Count - 1] }

  if ($swatches.Count -eq 0) {
    foreach ($candidate in @($chrome, $background, $surface, $accent, $textColor)) {
      if ($candidate -and $swatches -notcontains $candidate) { $swatches += $candidate }
    }
  }
  if ($swatches.Count -eq 0) { $swatches = @('#18131F', '#F4F1EA', '#FFF9F0', '#8C5CA3') }

  return [PSCustomObject]@{
    name = $name
    label = $label
    description = $description
    swatches = @($swatches)
    preview = [PSCustomObject]@{
      chrome = $chrome
      background = $background
      surface = $surface
      accent = $accent
      text = $textColor
    }
  }
}

function ConvertTo-AuraUiDrawingColor {
  param([AllowNull()][object]$Value, [string]$Fallback = '#18131F')
  if ($Value -is [Drawing.Color]) { return $Value }
  $colorValue = ConvertTo-AuraUiThemeColor -Value $Value
  if (-not $colorValue) { $colorValue = ConvertTo-AuraUiThemeColor -Value $Fallback }
  if (-not $colorValue) { $colorValue = '#18131F' }
  try { return [Drawing.ColorTranslator]::FromHtml($colorValue) }
  catch { return [Drawing.Color]::FromArgb(24, 19, 31) }
}

function Get-AuraUiMixedColor {
  param([Drawing.Color]$From, [Drawing.Color]$To, [double]$Amount)
  $mix = [Math]::Max(0.0, [Math]::Min(1.0, $Amount))
  return [Drawing.Color]::FromArgb(
    [int][Math]::Round($From.R + (($To.R - $From.R) * $mix)),
    [int][Math]::Round($From.G + (($To.G - $From.G) * $mix)),
    [int][Math]::Round($From.B + (($To.B - $From.B) * $mix)))
}

function Get-AuraUiRelativeLuminance {
  param([Drawing.Color]$Color)
  $linear = @()
  foreach ($component in @($Color.R, $Color.G, $Color.B)) {
    $channel = $component / 255.0
    if ($channel -le 0.03928) { $linear += ($channel / 12.92) }
    else { $linear += [Math]::Pow((($channel + 0.055) / 1.055), 2.4) }
  }
  return (0.2126 * $linear[0]) + (0.7152 * $linear[1]) + (0.0722 * $linear[2])
}

function Get-AuraUiContrastRatio {
  param([Drawing.Color]$First, [Drawing.Color]$Second)
  $firstLuminance = Get-AuraUiRelativeLuminance -Color $First
  $secondLuminance = Get-AuraUiRelativeLuminance -Color $Second
  $lighter = [Math]::Max($firstLuminance, $secondLuminance)
  $darker = [Math]::Min($firstLuminance, $secondLuminance)
  return ($lighter + 0.05) / ($darker + 0.05)
}

function Get-AuraUiReadableColor {
  param([AllowNull()][object]$Preferred, [Drawing.Color]$Background)
  $preferredColor = if ($null -ne $Preferred) { ConvertTo-AuraUiDrawingColor -Value $Preferred } else { [Drawing.Color]::Empty }
  if (-not $preferredColor.IsEmpty -and (Get-AuraUiContrastRatio -First $preferredColor -Second $Background) -ge 4.5) {
    return $preferredColor
  }
  $light = [Drawing.Color]::FromArgb(255, 252, 247)
  $dark = [Drawing.Color]::FromArgb(29, 25, 34)
  if ((Get-AuraUiContrastRatio -First $light -Second $Background) -ge
      (Get-AuraUiContrastRatio -First $dark -Second $Background)) { return $light }
  return $dark
}

function ConvertTo-AuraUiColorRef {
  param([Drawing.Color]$Color)
  return [int]($Color.R -bor ($Color.G -shl 8) -bor ($Color.B -shl 16))
}

function Set-AuraUiTitleBarPalette {
  param([AllowNull()][object]$Palette, [AllowNull()][System.Windows.Forms.Form]$Form = $script:Form)
  if ($null -eq $Form -or $Form.IsDisposed -or $null -eq $Palette) { return }
  try {
    $handle = $Form.Handle
    if ($handle -eq [IntPtr]::Zero) { return }
    $darkValue = if ((Get-AuraUiRelativeLuminance -Color $Palette.Chrome) -lt 0.42) { 1 } else { 0 }
    $result = [AuraWindow]::DwmSetWindowAttribute($handle, 20, [ref]$darkValue, 4)
    if ($result -ne 0) { [void][AuraWindow]::DwmSetWindowAttribute($handle, 19, [ref]$darkValue, 4) }
    $caption = ConvertTo-AuraUiColorRef -Color $Palette.Chrome
    $captionText = ConvertTo-AuraUiColorRef -Color $Palette.ChromeText
    $border = ConvertTo-AuraUiColorRef -Color $Palette.Border
    [void][AuraWindow]::DwmSetWindowAttribute($handle, 35, [ref]$caption, 4)
    [void][AuraWindow]::DwmSetWindowAttribute($handle, 36, [ref]$captionText, 4)
    [void][AuraWindow]::DwmSetWindowAttribute($handle, 34, [ref]$border, 4)
  } catch {
    Write-AuraUiLog -Message "Title-bar theming is unavailable: $($_.Exception.Message)"
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

function Get-AuraUiThemePalette {
  param([AllowNull()][object]$Theme)
  if ([System.Windows.Forms.SystemInformation]::HighContrast) {
    return [PSCustomObject]@{
      Chrome = [Drawing.SystemColors]::Control
      ChromeText = [Drawing.SystemColors]::ControlText
      ChromeTextMuted = [Drawing.SystemColors]::ControlText
      Background = [Drawing.SystemColors]::Window
      BackgroundText = [Drawing.SystemColors]::WindowText
      Surface = [Drawing.SystemColors]::Window
      SurfaceText = [Drawing.SystemColors]::WindowText
      SurfaceTextMuted = [Drawing.SystemColors]::WindowText
      Accent = [Drawing.SystemColors]::Highlight
      AccentText = [Drawing.SystemColors]::HighlightText
      ButtonSurface = [Drawing.SystemColors]::Control
      ButtonHover = [Drawing.SystemColors]::Highlight
      ButtonText = [Drawing.SystemColors]::ControlText
      Border = [Drawing.SystemColors]::WindowText
    }
  }
  $preview = if ($null -ne $Theme) { Get-AuraUiPropertyValue -InputObject $Theme -Names @('preview') } else { $null }
  $chromeValue = Get-AuraUiPropertyValue -InputObject $preview -Names @('chrome')
  $backgroundValue = Get-AuraUiPropertyValue -InputObject $preview -Names @('background')
  $surfaceValue = Get-AuraUiPropertyValue -InputObject $preview -Names @('surface')
  $accentValue = Get-AuraUiPropertyValue -InputObject $preview -Names @('accent')
  $textValue = Get-AuraUiPropertyValue -InputObject $preview -Names @('text')

  $chrome = ConvertTo-AuraUiDrawingColor -Value $chromeValue -Fallback '#18131F'
  $background = ConvertTo-AuraUiDrawingColor -Value $backgroundValue -Fallback '#F4F1EA'
  $surface = ConvertTo-AuraUiDrawingColor -Value $surfaceValue -Fallback '#FFF9F0'
  $accent = ConvertTo-AuraUiDrawingColor -Value $accentValue -Fallback '#8C5CA3'
  $chromeText = Get-AuraUiReadableColor -Preferred $textValue -Background $chrome
  $backgroundText = Get-AuraUiReadableColor -Preferred $textValue -Background $background
  $surfaceText = Get-AuraUiReadableColor -Preferred $textValue -Background $surface
  $accentText = Get-AuraUiReadableColor -Preferred $null -Background $accent
  $buttonSurface = Get-AuraUiMixedColor -From $chrome -To $chromeText -Amount 0.11
  $buttonText = Get-AuraUiReadableColor -Preferred $chromeText -Background $buttonSurface
  $mutedChromeText = Get-AuraUiMixedColor -From $chromeText -To $chrome -Amount 0.22
  if ((Get-AuraUiContrastRatio -First $mutedChromeText -Second $chrome) -lt 4.5) { $mutedChromeText = $chromeText }
  $mutedSurfaceText = Get-AuraUiMixedColor -From $surfaceText -To $surface -Amount 0.28
  if ((Get-AuraUiContrastRatio -First $mutedSurfaceText -Second $surface) -lt 4.5) { $mutedSurfaceText = $surfaceText }

  return [PSCustomObject]@{
    Chrome = $chrome
    ChromeText = $chromeText
    ChromeTextMuted = $mutedChromeText
    Background = $background
    BackgroundText = $backgroundText
    Surface = $surface
    SurfaceText = $surfaceText
    SurfaceTextMuted = $mutedSurfaceText
    Accent = $accent
    AccentText = $accentText
    ButtonSurface = $buttonSurface
    ButtonHover = (Get-AuraUiMixedColor -From $buttonSurface -To $accent -Amount 0.18)
    ButtonText = $buttonText
    Border = (Get-AuraUiMixedColor -From $surface -To $surfaceText -Amount 0.28)
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
  return $stdout
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
  $arguments = @($ThemeCli, 'set', '--config', $ConfigPath) + $Options
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

function Set-AuraUiToolbarButtonPalette {
  param([AllowNull()][object]$Button, [AllowNull()][object]$Palette, [bool]$Emphasized = $false)
  if ($null -eq $Button -or $null -eq $Palette) { return }
  $Button.UseVisualStyleBackColor = $false
  $Button.BackColor = $Palette.ButtonSurface
  $Button.ForeColor = $Palette.ButtonText
  if ([System.Windows.Forms.SystemInformation]::HighContrast) {
    $Button.FlatAppearance.BorderColor = if ($Emphasized) { $Palette.Accent } else { $Palette.Border }
    $Button.FlatAppearance.BorderSize = if ($Emphasized) { 2 } else { 1 }
    $Button.FlatAppearance.MouseOverBackColor = $Palette.ButtonSurface
    $Button.FlatAppearance.MouseDownBackColor = $Palette.ButtonSurface
    return
  }
  $Button.FlatAppearance.BorderColor = if ($Emphasized) { $Palette.Accent } else { Get-AuraUiMixedColor -From $Palette.Chrome -To $Palette.ChromeText -Amount 0.28 }
  $Button.FlatAppearance.BorderSize = if ($Emphasized) { 2 } else { 1 }
  $Button.FlatAppearance.MouseOverBackColor = $Palette.ButtonHover
  $Button.FlatAppearance.MouseDownBackColor = Get-AuraUiMixedColor -From $Palette.ButtonSurface -To $Palette.Accent -Amount 0.3
}

function Get-AuraUiControlDpiScale {
  param([AllowNull()][object]$Control)
  if ($null -ne $Control) {
    $dpiProperty = $Control.PSObject.Properties['DeviceDpi']
    if ($null -ne $dpiProperty -and [int]$dpiProperty.Value -gt 0) {
      return ([int]$dpiProperty.Value) / 96.0
    }
  }
  return 1.0
}

function ConvertTo-AuraUiScaledPixel {
  param([double]$Value, [double]$Scale)
  return [int][Math]::Round($Value * $Scale, [MidpointRounding]::AwayFromZero)
}

function Get-AuraUiThemeCardMetrics {
  param([AllowNull()][object]$Control)
  $scale = Get-AuraUiControlDpiScale -Control $Control
  return [PSCustomObject]@{
    Hairline = [Math]::Max(1, (ConvertTo-AuraUiScaledPixel -Value 1 -Scale $scale))
    SelectedBorder = [Math]::Max(2, (ConvertTo-AuraUiScaledPixel -Value 3 -Scale $scale))
    SelectedInset = ConvertTo-AuraUiScaledPixel -Value 2 -Scale $scale
    ContentInset = ConvertTo-AuraUiScaledPixel -Value 14 -Scale $scale
    TitleTop = ConvertTo-AuraUiScaledPixel -Value 10 -Scale $scale
    TitleHeight = ConvertTo-AuraUiScaledPixel -Value 27 -Scale $scale
    TitleReserve = ConvertTo-AuraUiScaledPixel -Value 28 -Scale $scale
    SelectedTitleReserve = ConvertTo-AuraUiScaledPixel -Value 76 -Scale $scale
    MinimumTitleWidth = ConvertTo-AuraUiScaledPixel -Value 60 -Scale $scale
    BadgeRight = ConvertTo-AuraUiScaledPixel -Value 76 -Scale $scale
    BadgeTop = ConvertTo-AuraUiScaledPixel -Value 11 -Scale $scale
    BadgeWidth = ConvertTo-AuraUiScaledPixel -Value 62 -Scale $scale
    BadgeHeight = ConvertTo-AuraUiScaledPixel -Value 22 -Scale $scale
    DescriptionTop = ConvertTo-AuraUiScaledPixel -Value 39 -Scale $scale
    DescriptionReserve = ConvertTo-AuraUiScaledPixel -Value 112 -Scale $scale
    DescriptionHeight = ConvertTo-AuraUiScaledPixel -Value 54 -Scale $scale
    MinimumDescriptionWidth = ConvertTo-AuraUiScaledPixel -Value 80 -Scale $scale
    PreviewRight = ConvertTo-AuraUiScaledPixel -Value 82 -Scale $scale
    PreviewTop = ConvertTo-AuraUiScaledPixel -Value 43 -Scale $scale
    PreviewWidth = ConvertTo-AuraUiScaledPixel -Value 68 -Scale $scale
    PreviewHeight = ConvertTo-AuraUiScaledPixel -Value 43 -Scale $scale
    PreviewChromeHeight = ConvertTo-AuraUiScaledPixel -Value 8 -Scale $scale
    PreviewInset = ConvertTo-AuraUiScaledPixel -Value 8 -Scale $scale
    PreviewSurfaceTop = ConvertTo-AuraUiScaledPixel -Value 14 -Scale $scale
    PreviewSurfaceWidth = ConvertTo-AuraUiScaledPixel -Value 51 -Scale $scale
    PreviewSurfaceHeight = ConvertTo-AuraUiScaledPixel -Value 22 -Scale $scale
    PreviewAccentTop = ConvertTo-AuraUiScaledPixel -Value 31 -Scale $scale
    PreviewAccentWidth = ConvertTo-AuraUiScaledPixel -Value 20 -Scale $scale
    PreviewAccentHeight = ConvertTo-AuraUiScaledPixel -Value 5 -Scale $scale
    PreviewTextLeft = ConvertTo-AuraUiScaledPixel -Value 33 -Scale $scale
    PreviewTextTop = ConvertTo-AuraUiScaledPixel -Value 19 -Scale $scale
    PreviewTextWidth = ConvertTo-AuraUiScaledPixel -Value 19 -Scale $scale
    PreviewTextTop2 = ConvertTo-AuraUiScaledPixel -Value 24 -Scale $scale
    PreviewTextWidth2 = ConvertTo-AuraUiScaledPixel -Value 13 -Scale $scale
    PreviewTextHeight = [Math]::Max(1, (ConvertTo-AuraUiScaledPixel -Value 2 -Scale $scale))
    SwatchBottom = ConvertTo-AuraUiScaledPixel -Value 23 -Scale $scale
    SwatchWidth = ConvertTo-AuraUiScaledPixel -Value 20 -Scale $scale
    SwatchHeight = ConvertTo-AuraUiScaledPixel -Value 10 -Scale $scale
    SwatchStep = ConvertTo-AuraUiScaledPixel -Value 26 -Scale $scale
    FocusInset = ConvertTo-AuraUiScaledPixel -Value 6 -Scale $scale
    FocusReserve = ConvertTo-AuraUiScaledPixel -Value 13 -Scale $scale
  }
}

function Update-AuraUiThemeGalleryLayout {
  if ($null -eq $script:ThemeGalleryFlow -or $script:ThemeGalleryFlow.IsDisposed) { return }
  $scale = Get-AuraUiControlDpiScale -Control $script:ThemeGalleryFlow
  $usableWidth = $script:ThemeGalleryFlow.ClientSize.Width - $script:ThemeGalleryFlow.Padding.Horizontal -
    (ConvertTo-AuraUiScaledPixel -Value 2 -Scale $scale)
  if ($usableWidth -le 0) { return }
  $columns = if ($usableWidth -ge (ConvertTo-AuraUiScaledPixel -Value 560 -Scale $scale)) { 2 } else { 1 }
  $cardWidth = [Math]::Floor($usableWidth / $columns) - (ConvertTo-AuraUiScaledPixel -Value 12 -Scale $scale)
  $cardWidth = [Math]::Max((ConvertTo-AuraUiScaledPixel -Value 240 -Scale $scale), $cardWidth)
  $cardHeight = ConvertTo-AuraUiScaledPixel -Value 126 -Scale $scale
  foreach ($button in @($script:ThemeOptionButtons)) {
    if ($null -ne $button -and -not $button.IsDisposed) {
      $button.Size = [Drawing.Size]::new($cardWidth, $cardHeight)
    }
  }
}

function Update-AuraUiThemePresentation {
  $themeName = Get-AuraUiSelectedThemeName
  $selectedTheme = Get-AuraUiThemeByName -Name $themeName
  $script:SelectedTheme = $selectedTheme
  $palette = Get-AuraUiThemePalette -Theme $selectedTheme
  $script:CurrentPalette = $palette

  if ($null -ne $script:Form) { $script:Form.BackColor = $palette.Background }
  if ($null -ne $script:Toolbar) { $script:Toolbar.BackColor = $palette.Chrome }
  if ($null -ne $script:TitleLabel) { $script:TitleLabel.ForeColor = $palette.ChromeText }
  if ($null -ne $script:StatusLabel) { $script:StatusLabel.ForeColor = $palette.ChromeTextMuted }
  foreach ($button in @($script:CustomizeThemesButton, $script:BackgroundButton, $script:ClearButton,
      $script:AppearanceButton, $script:DesktopButton)) {
    Set-AuraUiToolbarButtonPalette -Button $button -Palette $palette -Emphasized ($button -eq $script:CustomizeThemesButton)
  }

  if ($null -ne $script:CustomizeThemesButton) {
    $selectedLabel = if ($null -ne $selectedTheme) { "$($selectedTheme.label)" } elseif ($script:ActiveLabel) { $script:ActiveLabel } else { "$($script:UiCopy.savedTheme)" }
    $script:CustomizeThemesButton.AccessibleDescription = "$($script:UiCopy.customizeDescription)" -f $selectedLabel
  }
  if ($null -ne $script:WebView) { $script:WebView.BackColor = $palette.Background }
  if ($null -ne $script:LoadingPanel) { $script:LoadingPanel.BackColor = $palette.Background }
  if ($null -ne $script:LoadingLabel) { $script:LoadingLabel.ForeColor = $palette.BackgroundText }
  if ($null -ne $script:RetryButton) {
    $script:RetryButton.BackColor = $palette.Accent
    $script:RetryButton.ForeColor = $palette.AccentText
    $script:RetryButton.FlatAppearance.BorderColor = $palette.Accent
    $script:RetryButton.FlatAppearance.MouseOverBackColor = Get-AuraUiMixedColor -From $palette.Accent -To $palette.AccentText -Amount 0.12
  }

  if ($null -ne $script:ThemeGalleryForm) {
    $script:ThemeGalleryForm.BackColor = $palette.Background
    $script:ThemeGalleryHeader.BackColor = $palette.Surface
    $script:ThemeGalleryTitle.ForeColor = $palette.SurfaceText
    $script:ThemeGallerySubtitle.ForeColor = $palette.SurfaceTextMuted
    $script:ThemeGalleryFlow.BackColor = $palette.Background
  }
  foreach ($button in @($script:ThemeOptionButtons)) {
    if ($null -eq $button -or $button.IsDisposed) { continue }
    $isSelected = [string]::Equals("$($button.Tag.name)", "$themeName", [StringComparison]::OrdinalIgnoreCase)
    $button.Checked = $isSelected
    $button.AccessibleName = "$($script:UiCopy.themeAccessibleName)" -f "$($button.Tag.label)"
    $button.AccessibleDescription = if ($isSelected) {
      "$($script:UiCopy.themeSelectedDescription)" -f "$($button.Tag.description)"
    } else {
      "$($script:UiCopy.themeApplyDescription)" -f "$($button.Tag.description)"
    }
    $button.Invalidate()
  }
  Set-AuraUiTitleBarPalette -Palette $palette -Form $script:Form
  Set-AuraUiTitleBarPalette -Palette $palette -Form $script:ThemeGalleryForm
  Set-AuraUiTitleBarPalette -Palette $palette -Form $script:StudioForm
}

function Show-AuraUiThemeGallery {
  if ($null -eq $script:ThemeGalleryForm -or $script:ThemeGalleryForm.IsDisposed) { return }
  if (-not $script:ThemeGalleryForm.Visible) { $script:ThemeGalleryForm.Show($script:Form) }
  Set-AuraUiFormWithinWorkingArea -Form $script:ThemeGalleryForm
  Update-AuraUiThemeGalleryLayout
  $galleryScale = Get-AuraUiControlDpiScale -Control $script:ThemeGalleryForm
  $galleryGap = ConvertTo-AuraUiScaledPixel -Value 4 -Scale $galleryScale
  $anchor = $script:CustomizeThemesButton.PointToScreen([Drawing.Point]::new(0, $script:CustomizeThemesButton.Height))
  $workingArea = [System.Windows.Forms.Screen]::FromControl($script:Form).WorkingArea
  $x = $anchor.X
  $y = $anchor.Y + $galleryGap
  if (($x + $script:ThemeGalleryForm.Width) -gt $workingArea.Right) {
    $x = $workingArea.Right - $script:ThemeGalleryForm.Width
  }
  if (($y + $script:ThemeGalleryForm.Height) -gt $workingArea.Bottom) {
    $above = $script:CustomizeThemesButton.PointToScreen([Drawing.Point]::Empty).Y -
      $script:ThemeGalleryForm.Height - $galleryGap
    $y = if ($above -ge $workingArea.Top) { $above } else { $workingArea.Top }
  }
  $x = [Math]::Max($workingArea.Left, $x)
  $y = [Math]::Max($workingArea.Top, $y)
  $script:ThemeGalleryForm.Location = [Drawing.Point]::new($x, $y)
  $script:ThemeGalleryForm.Activate()

  $themeName = Get-AuraUiSelectedThemeName
  $focusButton = $null
  foreach ($button in @($script:ThemeOptionButtons)) {
    if ([string]::Equals("$($button.Tag.name)", "$themeName", [StringComparison]::OrdinalIgnoreCase)) {
      $focusButton = $button
      break
    }
  }
  if ($null -eq $focusButton -and $script:ThemeOptionButtons.Count -gt 0) { $focusButton = $script:ThemeOptionButtons[0] }
  if ($null -ne $focusButton) { [void]$focusButton.Focus() }
}

function Set-AuraUiBusy {
  param([bool]$Busy)
  foreach ($control in @($script:CustomizeThemesButton, $script:BackgroundButton, $script:ClearButton, $script:AppearanceButton)) {
    if ($control) { $control.Enabled = -not $Busy }
  }
  foreach ($control in @($script:ThemeOptionButtons)) {
    if ($control) { $control.Enabled = -not $Busy }
  }
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
  Set-AuraUiBusy -Busy $true
  $script:ScriptAction = $Action
  $script:ScriptCovered = $Cover
  $script:ScriptTask = $script:WebView.ExecuteScriptAsync($Source)
}

function Apply-AuraUiTheme {
  param([bool]$Cover = $false)
  if (-not (Test-AuraUiClaudeUri -Value $script:WebView.Source)) {
    if ($Cover) { Hide-AuraUiLoading }
    $script:StatusLabel.Text = "$($script:UiCopy.continueSigningIn)"
    return
  }
  Start-AuraUiScript -Source $script:Payload -Action Apply -Cover $Cover
}

function Update-AuraUiAppearanceButton {
  $enabled = $true
  if ($null -ne $script:Config.PSObject.Properties['enabled']) { $enabled = [bool]$script:Config.enabled }
  $script:AppearanceButton.Text = if ($enabled) { "$($script:UiCopy.originalLook)" } else { "$($script:UiCopy.applyTheme)" }
  Update-AuraUiTrayAppearance
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

function Send-AuraUiStudioState {
  param(
    [AllowEmptyString()][string]$Status = '',
    [ValidateSet('ok', 'busy', 'error')][string]$Tone = 'ok'
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
    $state = [ordered]@{
      type = 'state'
      theme = "$themeName"
      enabled = $enabled
      status = $Status
      tone = $Tone
    }
    $json = $state | ConvertTo-Json -Compress
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
  Update-AuraUiAppearanceButton
  Update-AuraUiThemePresentation
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
    Set-AuraUiConfig -Options @('--image', $dialog.FileName, '--enabled', 'true')
    Update-AuraUiAppearanceButton
    Apply-AuraUiTheme
    Send-AuraUiStudioState -Status "$($script:UiCopy.applyingBackground)" -Tone busy
    return $true
  } finally {
    $dialog.Dispose()
  }
}

function Invoke-AuraUiClearBackground {
  Set-AuraUiConfig -Options @('--clear-image', '--enabled', 'true')
  Update-AuraUiAppearanceButton
  Apply-AuraUiTheme
  Send-AuraUiStudioState -Status "$($script:UiCopy.removingBackground)" -Tone busy
}

function Invoke-AuraUiSetEnabled {
  param([Parameter(Mandatory = $true)][bool]$Enabled)
  Set-AuraUiConfig -Options @('--enabled', $Enabled.ToString().ToLowerInvariant())
  Update-AuraUiAppearanceButton
  if ($Enabled) {
    Apply-AuraUiTheme
    Send-AuraUiStudioState -Status "$($script:UiCopy.applyingTheme)" -Tone busy
  } else {
    $cleanup = '(() => { window.__CLAUDE_AURA_DISABLED__ = true; return window.__CLAUDE_AURA_STATE__?.cleanup?.() ?? true; })()'
    if ($script:WebReady -and (Test-AuraUiClaudeUri -Value $script:WebView.Source)) {
      Start-AuraUiScript -Source $cleanup -Action Restore
    } else {
      $script:StatusLabel.Text = "$($script:UiCopy.originalActive)"
      Set-AuraUiBusy -Busy $false
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
    'set-enabled' {
      if ($message.enabled -isnot [bool]) { throw 'Studio enabled state must be a Boolean.' }
      Invoke-AuraUiSetEnabled -Enabled $message.enabled
      break
    }
    'open-desktop' { Invoke-AuraUiOpenDesktopApp; Send-AuraUiStudioState; break }
    'import-theme' {
      Send-AuraUiStudioState -Status "$($script:UiCopy.studioImportPending)" -Tone busy
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
$script:SelectedTheme = $null
$script:CurrentPalette = $null
$script:Toolbar = $null
$script:TitleLabel = $null
$script:CustomizeThemesButton = $null
$script:DesktopButton = $null
$script:ThemeOptionButtons = @()
$script:ThemeGalleryForm = $null
$script:ThemeGalleryHeader = $null
$script:ThemeGalleryTitle = $null
$script:ThemeGallerySubtitle = $null
$script:ThemeGalleryFlow = $null
$script:ThemeCardTitleFont = $null
$script:ThemeCardDescriptionFont = $null
$script:ThemeCardBadgeFont = $null
$script:UiCopy = $null
$script:Locale = 'en'
$script:StudioMessageTypes = @(
  'get-state',
  'set-theme',
  'set-image',
  'clear-image',
  'set-enabled',
  'open-desktop',
  'import-theme'
)
$script:StudioForm = $null
$script:StudioWebView = $null
$script:StudioEnsureTask = $null
$script:StudioReady = $false
$script:StudioInitializationFailed = $false
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

  New-Item -ItemType Directory -Force -Path $DataRoot, $WebDataRoot | Out-Null
  $script:Node = Get-AuraNodeRuntime
  $locale = [Globalization.CultureInfo]::CurrentUICulture.Name
  if (-not $locale) { $locale = 'en' }
  $script:Locale = $locale
  $script:UiCopy = Get-AuraUiCopy -Locale $locale
  $script:ActiveLabel = "$($script:UiCopy.theme)"

  $initialOptions = @()
  if ($Theme) { $initialOptions += @('--theme', $Theme) }
  if ($Image) { $initialOptions += @('--image', [System.IO.Path]::GetFullPath($Image)) }
  if ($ClearImage) { $initialOptions += '--clear-image' }
  if ($Mode -eq 'Restore') { $initialOptions += @('--enabled', 'false') }
  elseif ($Theme -or $Image -or $ClearImage) { $initialOptions += @('--enabled', 'true') }
  if ($initialOptions.Count -gt 0) { Set-AuraUiConfig -Options $initialOptions }
  else {
    $initialPayload = Invoke-AuraUiNode -CommandArguments @($ThemeCli, 'init', '--config', $ConfigPath, '--locale', $script:Locale, '--payload')
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
  [DllImport("dwmapi.dll", PreserveSig = true)] public static extern int DwmSetWindowAttribute(IntPtr handle, int attribute, ref int value, int size);
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

  $script:Toolbar = [System.Windows.Forms.FlowLayoutPanel]::new()
  $script:Toolbar.Dock = 'Top'
  $script:Toolbar.Height = 72
  $script:Toolbar.Padding = [System.Windows.Forms.Padding]::new(14, 10, 8, 8)
  $script:Toolbar.WrapContents = $false
  $script:Toolbar.FlowDirection = 'LeftToRight'
  $script:Toolbar.BackColor = [Drawing.ColorTranslator]::FromHtml('#18131F')

  $identityPanel = [System.Windows.Forms.Panel]::new()
  $identityPanel.Size = [Drawing.Size]::new(190, 50)
  $script:TitleLabel = [System.Windows.Forms.Label]::new()
  $script:TitleLabel.Text = 'Claude Aura'
  $script:TitleLabel.ForeColor = [Drawing.ColorTranslator]::FromHtml('#FFF9F0')
  $script:TitleLabel.Font = [Drawing.Font]::new('Segoe UI Semibold', 14)
  $script:TitleLabel.Location = [Drawing.Point]::new(0, 0)
  $script:TitleLabel.AutoSize = $true
  $script:StatusLabel = [System.Windows.Forms.Label]::new()
  $script:StatusLabel.Text = "$($script:UiCopy.openingClaude)"
  $script:StatusLabel.ForeColor = [Drawing.ColorTranslator]::FromHtml('#BFB5CC')
  $script:StatusLabel.Font = [Drawing.Font]::new('Segoe UI', 8.5)
  $script:StatusLabel.Location = [Drawing.Point]::new(1, 28)
  $script:StatusLabel.AutoEllipsis = $true
  $script:StatusLabel.Size = [Drawing.Size]::new(185, 18)
  $identityPanel.Controls.AddRange(@($script:TitleLabel, $script:StatusLabel))

  function New-AuraToolbarButton {
    param([string]$Text, [int]$Width)
    $button = [System.Windows.Forms.Button]::new()
    $button.Text = $Text
    $button.Size = [Drawing.Size]::new($Width, 36)
    $button.Margin = [System.Windows.Forms.Padding]::new(6, 7, 0, 0)
    $button.FlatStyle = 'Flat'
    $button.FlatAppearance.BorderColor = [Drawing.ColorTranslator]::FromHtml('#4A4057')
    $button.FlatAppearance.MouseOverBackColor = [Drawing.ColorTranslator]::FromHtml('#33283F')
    $button.BackColor = [Drawing.ColorTranslator]::FromHtml('#251D2E')
    $button.ForeColor = [Drawing.ColorTranslator]::FromHtml('#FFF9F0')
    $button.Font = [Drawing.Font]::new('Segoe UI Semibold', 9)
    $button.Cursor = 'Hand'
    $button.UseVisualStyleBackColor = $false
    $button.AccessibleRole = [System.Windows.Forms.AccessibleRole]::PushButton
    return $button
  }

  $themesJson = Invoke-AuraUiNode -CommandArguments @($ThemeCli, 'list', '--json', '--locale', $locale)
  $parsedThemes = $themesJson | ConvertFrom-Json
  $themeItems = @($parsedThemes)
  $normalizedThemes = @()
  for ($index = 0; $index -lt $themeItems.Count; $index++) {
    $metadata = ConvertTo-AuraUiThemeMetadata -Item $themeItems[$index] -Index $index
    if ($null -ne $metadata) { $normalizedThemes += $metadata }
  }
  if ($normalizedThemes.Count -eq 0) { throw "$($script:UiCopy.noThemes)" }
  $script:Themes = @($normalizedThemes)

  $script:CustomizeThemesButton = New-AuraToolbarButton -Text "$($script:UiCopy.customizeThemes)" -Width 142
  $script:CustomizeThemesButton.AccessibleName = "$($script:UiCopy.customizeThemes)"
  $script:BackgroundButton = New-AuraToolbarButton -Text "$($script:UiCopy.background)" -Width 112
  $script:ClearButton = New-AuraToolbarButton -Text "$($script:UiCopy.clearImage)" -Width 92
  $script:AppearanceButton = New-AuraToolbarButton -Text "$($script:UiCopy.originalLook)" -Width 106
  $script:DesktopButton = New-AuraToolbarButton -Text "$($script:UiCopy.desktopApp)" -Width 100
  $script:Toolbar.Controls.AddRange(@($identityPanel, $script:CustomizeThemesButton, $script:BackgroundButton,
    $script:ClearButton, $script:AppearanceButton, $script:DesktopButton))

  $script:ThemeGalleryForm = [System.Windows.Forms.Form]::new()
  $script:ThemeGalleryForm.Text = "$($script:UiCopy.customizeThemes)"
  $script:ThemeGalleryForm.StartPosition = 'Manual'
  $script:ThemeGalleryForm.ClientSize = [Drawing.Size]::new(660, 540)
  $script:ThemeGalleryForm.MinimumSize = [Drawing.Size]::new(500, 400)
  $script:ThemeGalleryForm.ShowInTaskbar = $false
  $script:ThemeGalleryForm.MinimizeBox = $false
  $script:ThemeGalleryForm.MaximizeBox = $false
  $script:ThemeGalleryForm.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::SizableToolWindow
  $script:ThemeGalleryForm.AutoScaleMode = [System.Windows.Forms.AutoScaleMode]::Dpi
  $script:ThemeGalleryForm.KeyPreview = $true
  $script:ThemeGalleryForm.AccessibleName = "$($script:UiCopy.themeGallery)"

  $script:ThemeGalleryHeader = [System.Windows.Forms.Panel]::new()
  $script:ThemeGalleryHeader.Dock = 'Top'
  $script:ThemeGalleryHeader.Height = 78
  $script:ThemeGalleryTitle = [System.Windows.Forms.Label]::new()
  $script:ThemeGalleryTitle.Text = "$($script:UiCopy.chooseLook)"
  $script:ThemeGalleryTitle.Font = [Drawing.Font]::new('Segoe UI Semibold', 14)
  $script:ThemeGalleryTitle.Location = [Drawing.Point]::new(18, 13)
  $script:ThemeGalleryTitle.AutoSize = $true
  $script:ThemeGallerySubtitle = [System.Windows.Forms.Label]::new()
  $script:ThemeGallerySubtitle.Text = "$($script:UiCopy.gallerySubtitle)"
  $script:ThemeGallerySubtitle.Font = [Drawing.Font]::new('Segoe UI', 9)
  $script:ThemeGallerySubtitle.Location = [Drawing.Point]::new(19, 43)
  $script:ThemeGallerySubtitle.AutoEllipsis = $true
  $script:ThemeGallerySubtitle.Size = [Drawing.Size]::new(610, 22)
  $script:ThemeGallerySubtitle.Anchor = 'Top, Left, Right'
  $script:ThemeGalleryHeader.Controls.AddRange(@($script:ThemeGalleryTitle, $script:ThemeGallerySubtitle))

  $script:ThemeGalleryFlow = [System.Windows.Forms.FlowLayoutPanel]::new()
  $script:ThemeGalleryFlow.Dock = 'Fill'
  $script:ThemeGalleryFlow.FlowDirection = 'LeftToRight'
  $script:ThemeGalleryFlow.WrapContents = $true
  $script:ThemeGalleryFlow.AutoScroll = $true
  $script:ThemeGalleryFlow.Padding = [System.Windows.Forms.Padding]::new(12)
  $script:ThemeGalleryFlow.AccessibleName = "$($script:UiCopy.availableThemes)"
  $script:ThemeGalleryForm.Controls.Add($script:ThemeGalleryFlow)
  $script:ThemeGalleryForm.Controls.Add($script:ThemeGalleryHeader)

  $script:ThemeCardTitleFont = [Drawing.Font]::new('Segoe UI Semibold', 11)
  $script:ThemeCardDescriptionFont = [Drawing.Font]::new('Segoe UI', 8.5)
  $script:ThemeCardBadgeFont = [Drawing.Font]::new('Segoe UI Semibold', 8)
  for ($index = 0; $index -lt $script:Themes.Count; $index++) {
    $themeButton = [System.Windows.Forms.RadioButton]::new()
    $themeButton.Tag = $script:Themes[$index]
    $themeButton.Text = ''
    $themeButton.Appearance = [System.Windows.Forms.Appearance]::Button
    $themeButton.AutoCheck = $false
    $themeButton.TabIndex = $index
    $themeButton.TabStop = $true
    $themeButton.Size = [Drawing.Size]::new(300, 126)
    $themeButton.Margin = [System.Windows.Forms.Padding]::new(6)
    $themeButton.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $themeButton.FlatAppearance.BorderSize = 0
    $themeButton.UseVisualStyleBackColor = $false
    $themeButton.Cursor = 'Hand'
    $themeButton.AccessibleRole = [System.Windows.Forms.AccessibleRole]::RadioButton
    $themeButton.add_Paint({
      param($sender, $eventArgs)
      $themeItem = $sender.Tag
      if ($null -eq $themeItem) { return }
      $palette = Get-AuraUiThemePalette -Theme $themeItem
      $metrics = Get-AuraUiThemeCardMetrics -Control $sender
      $fill = $palette.Surface
      if (-not $sender.Enabled) {
        $fill = Get-AuraUiMixedColor -From $fill -To $palette.Background -Amount 0.45
      } elseif ($sender.Capture) {
        $fill = Get-AuraUiMixedColor -From $fill -To $palette.Accent -Amount 0.16
      } elseif ($sender.ClientRectangle.Contains($sender.PointToClient([System.Windows.Forms.Cursor]::Position))) {
        $fill = Get-AuraUiMixedColor -From $fill -To $palette.Accent -Amount 0.08
      }
      $textColor = Get-AuraUiReadableColor -Preferred $themeItem.preview.text -Background $fill
      $mutedText = Get-AuraUiMixedColor -From $textColor -To $fill -Amount 0.28
      if ((Get-AuraUiContrastRatio -First $mutedText -Second $fill) -lt 4.5) { $mutedText = $textColor }
      $selectedName = Get-AuraUiSelectedThemeName
      $isSelected = [string]::Equals("$($themeItem.name)", "$selectedName", [StringComparison]::OrdinalIgnoreCase)
      $eventArgs.Graphics.Clear($fill)

      $borderColor = if ($isSelected) { $palette.Accent } else { Get-AuraUiMixedColor -From $fill -To $textColor -Amount 0.25 }
      $borderWidth = if ($isSelected) { $metrics.SelectedBorder } else { $metrics.Hairline }
      $borderPen = [Drawing.Pen]::new($borderColor, $borderWidth)
      try {
        $inset = if ($isSelected) { $metrics.SelectedInset } else { 0 }
        $eventArgs.Graphics.DrawRectangle($borderPen, $inset, $inset,
          [Math]::Max(0, $sender.ClientSize.Width - (2 * $inset) - $metrics.Hairline),
          [Math]::Max(0, $sender.ClientSize.Height - (2 * $inset) - $metrics.Hairline))
      } finally { $borderPen.Dispose() }

      $titleWidth = $sender.ClientSize.Width - $metrics.TitleReserve
      if ($isSelected) { $titleWidth -= $metrics.SelectedTitleReserve }
      $titleRectangle = [Drawing.Rectangle]::new($metrics.ContentInset, $metrics.TitleTop,
        [Math]::Max($metrics.MinimumTitleWidth, $titleWidth), $metrics.TitleHeight)
      $titleFlags = [System.Windows.Forms.TextFormatFlags]::Left -bor
        [System.Windows.Forms.TextFormatFlags]::VerticalCenter -bor
        [System.Windows.Forms.TextFormatFlags]::EndEllipsis -bor
        [System.Windows.Forms.TextFormatFlags]::NoPrefix
      [System.Windows.Forms.TextRenderer]::DrawText($eventArgs.Graphics, "$($themeItem.label)",
        $script:ThemeCardTitleFont, $titleRectangle, $textColor, $titleFlags)

      if ($isSelected) {
        $badgeRectangle = [Drawing.Rectangle]::new($sender.ClientSize.Width - $metrics.BadgeRight,
          $metrics.BadgeTop, $metrics.BadgeWidth, $metrics.BadgeHeight)
        $badgeBrush = [Drawing.SolidBrush]::new($palette.Accent)
        try { $eventArgs.Graphics.FillRectangle($badgeBrush, $badgeRectangle) }
        finally { $badgeBrush.Dispose() }
        $badgeFlags = [System.Windows.Forms.TextFormatFlags]::HorizontalCenter -bor
          [System.Windows.Forms.TextFormatFlags]::VerticalCenter -bor
          [System.Windows.Forms.TextFormatFlags]::NoPrefix
        [System.Windows.Forms.TextRenderer]::DrawText($eventArgs.Graphics, "$($script:UiCopy.selected)",
          $script:ThemeCardBadgeFont, $badgeRectangle, $palette.AccentText, $badgeFlags)
      }

      $descriptionRectangle = [Drawing.Rectangle]::new($metrics.ContentInset, $metrics.DescriptionTop,
        [Math]::Max($metrics.MinimumDescriptionWidth, $sender.ClientSize.Width - $metrics.DescriptionReserve),
        $metrics.DescriptionHeight)
      $descriptionFlags = [System.Windows.Forms.TextFormatFlags]::Left -bor
        [System.Windows.Forms.TextFormatFlags]::Top -bor
        [System.Windows.Forms.TextFormatFlags]::WordBreak -bor
        [System.Windows.Forms.TextFormatFlags]::EndEllipsis -bor
        [System.Windows.Forms.TextFormatFlags]::NoPrefix
      [System.Windows.Forms.TextRenderer]::DrawText($eventArgs.Graphics, "$($themeItem.description)",
        $script:ThemeCardDescriptionFont, $descriptionRectangle, $mutedText, $descriptionFlags)

      $previewRectangle = [Drawing.Rectangle]::new($sender.ClientSize.Width - $metrics.PreviewRight,
        $metrics.PreviewTop, $metrics.PreviewWidth, $metrics.PreviewHeight)
      $previewBackgroundBrush = [Drawing.SolidBrush]::new($palette.Background)
      $previewChromeBrush = [Drawing.SolidBrush]::new($palette.Chrome)
      $previewSurfaceBrush = [Drawing.SolidBrush]::new($palette.Surface)
      $previewAccentBrush = [Drawing.SolidBrush]::new($palette.Accent)
      $previewTextBrush = [Drawing.SolidBrush]::new($palette.SurfaceText)
      $previewBorderPen = [Drawing.Pen]::new((Get-AuraUiMixedColor -From $palette.Background -To $palette.BackgroundText -Amount 0.32), $metrics.Hairline)
      try {
        $eventArgs.Graphics.FillRectangle($previewBackgroundBrush, $previewRectangle)
        $eventArgs.Graphics.FillRectangle($previewChromeBrush, $previewRectangle.X, $previewRectangle.Y,
          $previewRectangle.Width, $metrics.PreviewChromeHeight)
        $eventArgs.Graphics.FillRectangle($previewSurfaceBrush, $previewRectangle.X + $metrics.PreviewInset,
          $previewRectangle.Y + $metrics.PreviewSurfaceTop, $metrics.PreviewSurfaceWidth, $metrics.PreviewSurfaceHeight)
        $eventArgs.Graphics.FillRectangle($previewAccentBrush, $previewRectangle.X + $metrics.PreviewInset,
          $previewRectangle.Y + $metrics.PreviewAccentTop, $metrics.PreviewAccentWidth, $metrics.PreviewAccentHeight)
        $eventArgs.Graphics.FillRectangle($previewTextBrush, $previewRectangle.X + $metrics.PreviewTextLeft,
          $previewRectangle.Y + $metrics.PreviewTextTop, $metrics.PreviewTextWidth, $metrics.PreviewTextHeight)
        $eventArgs.Graphics.FillRectangle($previewTextBrush, $previewRectangle.X + $metrics.PreviewTextLeft,
          $previewRectangle.Y + $metrics.PreviewTextTop2, $metrics.PreviewTextWidth2, $metrics.PreviewTextHeight)
        $eventArgs.Graphics.DrawRectangle($previewBorderPen, $previewRectangle)
      } finally {
        $previewBackgroundBrush.Dispose()
        $previewChromeBrush.Dispose()
        $previewSurfaceBrush.Dispose()
        $previewAccentBrush.Dispose()
        $previewTextBrush.Dispose()
        $previewBorderPen.Dispose()
      }

      $swatchX = $metrics.ContentInset
      $swatchY = $sender.ClientSize.Height - $metrics.SwatchBottom
      $swatchBorder = [Drawing.Pen]::new((Get-AuraUiMixedColor -From $fill -To $textColor -Amount 0.35), $metrics.Hairline)
      try {
        foreach ($swatch in @($themeItem.swatches)) {
          if (($swatchX + $metrics.SwatchWidth) -gt ($sender.ClientSize.Width - $metrics.ContentInset)) { break }
          $swatchColor = ConvertTo-AuraUiDrawingColor -Value $swatch -Fallback '#8C5CA3'
          $swatchBrush = [Drawing.SolidBrush]::new($swatchColor)
          try { $eventArgs.Graphics.FillRectangle($swatchBrush, $swatchX, $swatchY, $metrics.SwatchWidth, $metrics.SwatchHeight) }
          finally { $swatchBrush.Dispose() }
          $eventArgs.Graphics.DrawRectangle($swatchBorder, $swatchX, $swatchY, $metrics.SwatchWidth, $metrics.SwatchHeight)
          $swatchX += $metrics.SwatchStep
        }
      } finally { $swatchBorder.Dispose() }

      if ($sender.Focused) {
        $focusPen = [Drawing.Pen]::new($palette.Accent, $metrics.Hairline)
        $focusPen.DashStyle = [Drawing.Drawing2D.DashStyle]::Dot
        try { $eventArgs.Graphics.DrawRectangle($focusPen, $metrics.FocusInset, $metrics.FocusInset,
            $sender.ClientSize.Width - $metrics.FocusReserve, $sender.ClientSize.Height - $metrics.FocusReserve) }
        finally { $focusPen.Dispose() }
      }
    })
    $themeButton.add_Click({
      param($sender, $eventArgs)
      $selection = $sender.Tag
      if ($null -eq $selection) { return }
      $selectionSaved = $false
      try {
        $script:StatusLabel.Text = "$($script:UiCopy.applyingTheme)"
        Set-AuraUiConfig -Options @('--theme', "$($selection.name)", '--enabled', 'true')
        $selectionSaved = $true
        Update-AuraUiAppearanceButton
        Update-AuraUiThemePresentation
        Apply-AuraUiTheme
      } catch {
        Write-AuraUiLog -Message $_.Exception.ToString()
        if ($selectionSaved) {
          $script:ActiveThemeName = "$($selection.name)"
          $script:ActiveLabel = "$($selection.label)"
          Update-AuraUiThemePresentation
          $script:StatusLabel.Text = "$($script:UiCopy.themeSavedWaiting)"
          Show-AuraUiMessage -Title "$($script:UiCopy.themeSavedTitle)" -Icon Warning -Message "$($script:UiCopy.themeSavedMessage)"
        } else {
          Update-AuraUiThemePresentation
          Show-AuraUiMessage -Title "$($script:UiCopy.themeNotChangedTitle)" -Icon Warning -Message "$($script:UiCopy.themeNotChangedMessage)"
        }
        Set-AuraUiBusy -Busy $false
      }
    })
    $themeButton.add_MouseEnter({ param($sender, $eventArgs) $sender.Invalidate() })
    $themeButton.add_MouseLeave({ param($sender, $eventArgs) $sender.Invalidate() })
    $themeButton.add_Enter({ param($sender, $eventArgs) $sender.Invalidate() })
    $themeButton.add_Leave({ param($sender, $eventArgs) $sender.Invalidate() })
    $themeButton.add_EnabledChanged({ param($sender, $eventArgs) $sender.Invalidate() })
    $script:ThemeOptionButtons += $themeButton
    $script:ThemeGalleryFlow.Controls.Add($themeButton)
  }

  $script:ThemeGalleryFlow.add_Resize({ Update-AuraUiThemeGalleryLayout })
  $script:ThemeGalleryForm.add_KeyDown({
    param($sender, $eventArgs)
    if ($eventArgs.KeyCode -eq [System.Windows.Forms.Keys]::Escape) {
      $eventArgs.Handled = $true
      $eventArgs.SuppressKeyPress = $true
      $script:ThemeGalleryForm.Hide()
      [void]$script:CustomizeThemesButton.Focus()
    }
  })
  $script:ThemeGalleryForm.add_FormClosing({
    param($sender, $eventArgs)
    if (-not $script:Closing -and $eventArgs.CloseReason -eq [System.Windows.Forms.CloseReason]::UserClosing) {
      $eventArgs.Cancel = $true
      $sender.Hide()
      [void]$script:CustomizeThemesButton.Focus()
    }
  })
  $script:CustomizeThemesButton.add_Click({ Show-AuraUiThemeGallery })

  $script:WebView = [Microsoft.Web.WebView2.WinForms.WebView2]::new()
  $script:WebView.Dock = 'Fill'
  $script:WebView.BackColor = [Drawing.ColorTranslator]::FromHtml('#F4F1EA')

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
  $script:RetryButton = New-AuraToolbarButton -Text "$($script:UiCopy.retry)" -Width 96
  $script:RetryButton.BackColor = [Drawing.ColorTranslator]::FromHtml('#5B3E73')
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
  $script:Form.Controls.Add($script:Toolbar)
  $script:LoadingPanel.BringToFront()

  Update-AuraUiAppearanceButton
  Update-AuraUiThemePresentation
  Update-AuraUiThemeGalleryLayout

  $script:BackgroundButton.add_Click({
    $dialog = [System.Windows.Forms.OpenFileDialog]::new()
    $dialog.Title = "$($script:UiCopy.chooseBackgroundTitle)"
    $dialog.Filter = "$($script:UiCopy.imagesFilter)|*.png;*.jpg;*.jpeg;*.webp;*.gif;*.avif"
    $dialog.CheckFileExists = $true
    if ($dialog.ShowDialog($script:Form) -ne [System.Windows.Forms.DialogResult]::OK) { return }
    try {
      $script:StatusLabel.Text = "$($script:UiCopy.applyingBackground)"
      Set-AuraUiConfig -Options @('--image', $dialog.FileName, '--enabled', 'true')
      Update-AuraUiAppearanceButton
      Apply-AuraUiTheme
    } catch {
      Write-AuraUiLog -Message $_.Exception.ToString()
      Show-AuraUiMessage -Title "$($script:UiCopy.backgroundNotChangedTitle)" -Icon Warning -Message "$($script:UiCopy.invalidBackgroundMessage)"
      Set-AuraUiBusy -Busy $false
    } finally { $dialog.Dispose() }
  })

  $script:ClearButton.add_Click({
    try {
      $script:StatusLabel.Text = "$($script:UiCopy.removingBackground)"
      Set-AuraUiConfig -Options @('--clear-image', '--enabled', 'true')
      Update-AuraUiAppearanceButton
      Apply-AuraUiTheme
    } catch {
      Write-AuraUiLog -Message $_.Exception.ToString()
      Show-AuraUiMessage -Title "$($script:UiCopy.backgroundNotChangedTitle)" -Icon Warning -Message "$($script:UiCopy.removeBackgroundMessage)"
      Set-AuraUiBusy -Busy $false
    }
  })

  $script:AppearanceButton.add_Click({
    try {
      $enabled = $true
      if ($null -ne $script:Config.PSObject.Properties['enabled']) { $enabled = [bool]$script:Config.enabled }
      if ($enabled) {
        Set-AuraUiConfig -Options @('--enabled', 'false')
        Update-AuraUiAppearanceButton
        $cleanup = '(() => { window.__CLAUDE_AURA_DISABLED__ = true; return window.__CLAUDE_AURA_STATE__?.cleanup?.() ?? true; })()'
        if (Test-AuraUiClaudeUri -Value $script:WebView.Source) { Start-AuraUiScript -Source $cleanup -Action Restore }
        else { $script:StatusLabel.Text = "$($script:UiCopy.originalActive)"; Set-AuraUiBusy -Busy $false }
      } else {
        Set-AuraUiConfig -Options @('--enabled', 'true')
        Update-AuraUiAppearanceButton
        Apply-AuraUiTheme
      }
    } catch {
      Write-AuraUiLog -Message $_.Exception.ToString()
      Show-AuraUiMessage -Title "$($script:UiCopy.appearanceNotChangedTitle)" -Icon Warning -Message "$($script:UiCopy.appearanceNotChangedMessage)"
      Set-AuraUiBusy -Busy $false
    }
  })

  $script:DesktopButton.add_Click({
    try {
      $claude = Get-AuraClaudeInstall
      Start-Process -FilePath $claude.Executable | Out-Null
    } catch {
      Write-AuraUiLog -Message $_.Exception.ToString()
      Show-AuraUiMessage -Title "$($script:UiCopy.desktopNotFoundTitle)" -Icon Information -Message "$($script:UiCopy.desktopNotFoundMessage)"
    }
  })

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
              Send-AuraUiStudioState -Status "$($script:UiCopy.appearanceNotChangedMessage)" -Tone error
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
          $script:StatusLabel.Text = "$($script:UiCopy.loadingClaude)"
        })
        $core.add_NavigationCompleted({
          param($sender, $eventArgs)
          if (-not $eventArgs.IsSuccess) {
            # A genuine navigation failure is the only case that keeps the cover.
            $script:StatusLabel.Text = "$($script:UiCopy.couldNotLoadClaude)"
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
            else { $script:StatusLabel.Text = "$($script:UiCopy.originalActive)" }
          } else {
            Hide-AuraUiLoading
            $script:StatusLabel.Text = "$($script:UiCopy.continueSigningIn)"
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
          $script:StatusLabel.Text = "$($script:UiCopy.needsReloadStatus)"
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
        $script:StatusLabel.Text = if ($action -eq 'Apply') { "$($script:UiCopy.activeTheme)" -f "$($script:ActiveLabel)" } else { "$($script:UiCopy.originalActive)" }
        if ($covered) { Hide-AuraUiLoading }
        Set-AuraUiBusy -Busy $false
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
      Set-AuraUiBusy -Busy $false
      if (-not $script:WebReady) {
        Fail-AuraUiStartup -Exception $_.Exception
      } elseif ($script:PageReady) {
        # claude.ai is loaded and visible; a theme-injection hiccup must never cover
        # it with an opaque panel. Surface a quiet status and leave the interface
        # usable. The navigation that caused the hiccup re-drives Apply on its own
        # NavigationCompleted, and the toolbar "Apply theme" control is a manual path.
        Write-AuraUiLog -Message $_.Exception.ToString()
        $script:StatusLabel.Text = "$($script:UiCopy.themeRetryStatus)"
        Hide-AuraUiLoading
      } else {
        Write-AuraUiLog -Message $_.Exception.ToString()
        $script:StatusLabel.Text = "$($script:UiCopy.themeRetryStatus)"
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
    if ($script:ThemeGalleryForm -and -not $script:ThemeGalleryForm.IsDisposed) { $script:ThemeGalleryForm.Close() }
    foreach ($font in @($script:ThemeCardTitleFont, $script:ThemeCardDescriptionFont, $script:ThemeCardBadgeFont)) {
      if ($font) { $font.Dispose() }
    }
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
