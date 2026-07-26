[CmdletBinding()]
param(
  [ValidateSet('Open', 'Restore')][string]$Mode = 'Open',
  [string]$Theme,
  [string]$Image,
  [switch]$ClearImage,
  [switch]$OpenStudio,
  [switch]$RescueSession
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
$UiCopyRoot = Join-Path $PSScriptRoot 'locales'
$StudioRoot = Join-Path $Root 'studio'
$ThemeArtRoot = Join-Path $Root 'assets\theme-art'
$StudioPreviewRoot = Join-Path $Root 'assets\studio-previews\masters'
$AuraIconPath = Join-Path $Root 'assets\brand\claude-aura.ico'
$ShortcutIconRoot = Join-Path $DataRoot 'shortcut-icons'
$StudioBackgroundRoot = Join-Path $DataRoot 'studio-background'
$AvatarRoot = Join-Path $DataRoot 'avatar'
$AvatarStatePath = Join-Path $AvatarRoot 'crop.json'
$AvatarBakedPath = Join-Path $AvatarRoot 'current.png'
# The avatar renders around 32 logical pixels; 256 keeps it crisp on any DPI while
# keeping the embedded data URL small, since the baked square ships in the payload.
$AvatarBakeSize = 256
$StudioPreferencesPath = Join-Path $DataRoot 'studio-preferences.json'
$StudioIntroductionVersion = 1
$StudioBackgroundMaxBytes = 16 * 1024 * 1024
$AvatarSourceMaxBytes = 16 * 1024 * 1024
$StudioMirrorJpegMaxBytes = 8000000
$StudioEditorRoot = Join-Path $DataRoot 'theme-drafts'
$StudioEditorPreviewRoot = Join-Path $StudioEditorRoot 'preview'
$StudioEditorImportRoot = Join-Path $StudioEditorRoot 'imports'
$StudioLocaleIds = @(
  'en',
  'hi',
  'es',
  'fr',
  'id',
  'ja',
  'ko',
  'pt-BR',
  'de',
  'it',
  'vi',
  'pl',
  'tr',
  'zh-CN',
  'zh-HKTW'
)
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

function Get-AuraUiCopyFile {
  # Window copy is one file per language under windows/locales. Reading them
  # separately keeps a translation edit inside a single file.
  param([Parameter(Mandatory = $true)][string]$Locale)
  $path = Join-Path $UiCopyRoot ('{0}.json' -f $Locale)
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return $null }
  return ([IO.File]::ReadAllText($path, [Text.Encoding]::UTF8) | ConvertFrom-Json)
}

function Get-AuraUiCopy {
  param([AllowEmptyString()][string]$Locale)
  $tag = if ($Locale) { $Locale.Replace('_', '-') } else { 'en' }
  $localeKey = if ($tag -match '^zh-(?i:cn|sg|hans)(?:-|$)' -or $tag -match '^zh-(?i:hans)(?:-|$)') {
    'zh-CN'
  } elseif ($tag -match '^zh-(?i:hktw|tw|hk|mo|hant)(?:-|$)' -or $tag -match '^zh-(?i:hant)(?:-|$)') {
    'zh-HKTW'
  } else {
    'en'
  }
  # English is the base layer, so a language file that is missing or still
  # incomplete shows English words instead of blank labels and buttons.
  $baseCopy = Get-AuraUiCopyFile -Locale 'en'
  if ($null -eq $baseCopy) {
    throw "Claude Aura interface copy is missing: $(Join-Path $UiCopyRoot 'en.json')"
  }
  $copy = [ordered]@{}
  foreach ($property in $baseCopy.PSObject.Properties) { $copy[$property.Name] = $property.Value }
  if ($localeKey -cne 'en') {
    $localizedCopy = Get-AuraUiCopyFile -Locale $localeKey
    if ($null -ne $localizedCopy) {
      foreach ($property in $localizedCopy.PSObject.Properties) {
        if ($property.Value -is [string] -and $property.Value.Trim()) { $copy[$property.Name] = $property.Value }
      }
    } else {
      Write-AuraUiLog -Message "Interface copy for $localeKey is missing; English is in use."
    }
  }
  return [PSCustomObject]$copy
}

function ConvertTo-AuraUiLocale {
  param([AllowEmptyString()][string]$Locale)
  $tag = if ($Locale) { $Locale.Replace('_', '-') } else { 'en' }
  if ($tag -match '^pt(?:-|$)' -or $tag -eq 'pt') {
    return 'pt-BR'
  }
  if ($tag -match '^zh-(?i:cn|sg|hans)(?:-|$)' -or $tag -match '^zh-(?i:hans)(?:-|$)') {
    return 'zh-CN'
  }
  if ($tag -match '^zh-(?i:hktw|tw|hk|mo|hant)(?:-|$)' -or $tag -match '^zh-(?i:hant)(?:-|$)') {
    return 'zh-HKTW'
  }
  $base = $tag.Split('-')[0]
  if ($base -cin $StudioLocaleIds) { return $base }
  return 'en'
}

function Get-AuraUiDefaultLocale {
  $locale = [Globalization.CultureInfo]::CurrentUICulture.Name
  $candidate = if ($locale) { $locale } else { 'en' }
  return ConvertTo-AuraUiLocale -Locale $candidate
}

function Get-AuraUiStudioPreferences {
  $fallback = [PSCustomObject]@{
    schemaVersion = 1
    locale = (Get-AuraUiDefaultLocale)
    introductionVersion = 0
  }
  if (-not (Test-Path -LiteralPath $StudioPreferencesPath -PathType Leaf)) { return $fallback }
  try {
    $bytes = [IO.File]::ReadAllBytes($StudioPreferencesPath)
    if ($bytes.Length -le 0 -or $bytes.Length -gt 4096) {
      throw 'Aura Studio preferences have an invalid size.'
    }
    $source = [Text.UTF8Encoding]::new($false, $true).GetString($bytes)
    $value = $source | ConvertFrom-Json
    if ($value -isnot [System.Management.Automation.PSCustomObject]) {
      throw 'Aura Studio preferences must be an object.'
    }
    $names = @($value.PSObject.Properties | ForEach-Object { $_.Name })
    if ($names.Count -ne 3 -or
        $names -cnotcontains 'schemaVersion' -or
        $names -cnotcontains 'locale' -or
        $names -cnotcontains 'introductionVersion' -or
        ($value.schemaVersion -isnot [int] -and $value.schemaVersion -isnot [long]) -or
        $value.schemaVersion -ne 1 -or
        $value.locale -isnot [string] -or $value.locale -cnotin $StudioLocaleIds -or
        ($value.introductionVersion -isnot [int] -and $value.introductionVersion -isnot [long]) -or
        $value.introductionVersion -lt 0 -or
        $value.introductionVersion -gt $StudioIntroductionVersion) {
      throw 'Aura Studio preferences are invalid.'
    }
    return [PSCustomObject]@{
      schemaVersion = 1
      locale = [string]$value.locale
      introductionVersion = [int]$value.introductionVersion
    }
  } catch {
    Write-AuraUiLog -Message "Studio preferences were ignored: $($_.Exception.Message)"
    return $fallback
  }
}

function Write-AuraUiStudioPreferences {
  param(
    [Parameter(Mandatory = $true)][string]$Locale,
    [Parameter(Mandatory = $true)][int]$IntroductionVersion
  )
  if ($Locale -cnotin $StudioLocaleIds) {
    throw 'Aura Studio locale must be in the supported locale list.'
  }
  if ($IntroductionVersion -lt 0 -or $IntroductionVersion -gt $StudioIntroductionVersion) {
    throw 'Aura Studio introduction version is invalid.'
  }
  [void][IO.Directory]::CreateDirectory($DataRoot)
  $temporary = Join-Path $DataRoot ('.studio-preferences-{0}.tmp' -f [Guid]::NewGuid().ToString('N'))
  $backup = Join-Path $DataRoot ('.studio-preferences-{0}.bak' -f [Guid]::NewGuid().ToString('N'))
  $value = [ordered]@{
    schemaVersion = 1
    locale = $Locale
    introductionVersion = $IntroductionVersion
  }
  try {
    $json = ($value | ConvertTo-Json -Compress) + [Environment]::NewLine
    [IO.File]::WriteAllText($temporary, $json, [Text.UTF8Encoding]::new($false))
    if (Test-Path -LiteralPath $StudioPreferencesPath -PathType Leaf) {
      [IO.File]::Replace($temporary, $StudioPreferencesPath, $backup)
    } else {
      [IO.File]::Move($temporary, $StudioPreferencesPath)
    }
  } finally {
    if (Test-Path -LiteralPath $temporary -PathType Leaf) {
      try { Remove-Item -LiteralPath $temporary -Force } catch {}
    }
    if (Test-Path -LiteralPath $backup -PathType Leaf) {
      try { Remove-Item -LiteralPath $backup -Force } catch {}
    }
  }
  return [PSCustomObject]@{
    schemaVersion = 1
    locale = $Locale
    introductionVersion = $IntroductionVersion
  }
}

function Get-AuraUiStudioUrl {
  param([switch]$PreserveView)
  if ($script:Locale -cnotin $StudioLocaleIds) {
    throw 'Aura Studio cannot navigate with an invalid locale.'
  }
  $url = 'https://aura.studio/index.html?locale={0}' -f [Uri]::EscapeDataString($script:Locale)
  if (-not $PreserveView -or $null -eq $script:StudioWebView) { return $url }
  try {
    $source = [Uri]$script:StudioWebView.Source
    if ($source.Scheme -ceq 'https' -and $source.Host -ceq 'aura.studio' -and
        $source.AbsolutePath -ceq '/index.html' -and
        $source.Fragment -cin @('#themes', '#background', '#create', '#settings')) {
      $view = $source.Fragment.TrimStart('#').ToLowerInvariant()
      return $url + '&view=' + [Uri]::EscapeDataString($view)
    }
  } catch {}
  return $url
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
    studioStyle = Get-AuraUiPropertyValue -InputObject $Item -Names @('studioStyle')
    studioPreview = Get-AuraUiPropertyValue -InputObject $Item -Names @('studioPreview')
    studioPreviewFrame = Get-AuraUiPropertyValue -InputObject $Item -Names @('studioPreviewFrame')
    source = Get-AuraUiPropertyValue -InputObject $Item -Names @('source')
    sourceRecipe = Get-AuraUiPropertyValue -InputObject $Item -Names @('sourceRecipe')
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
  $sourceIcon = $null
  $canvas = $null
  $graphics = $null
  $handle = [IntPtr]::Zero
  try {
    $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    if ([string]::Equals([IO.Path]::GetExtension($Path), '.ico', [StringComparison]::OrdinalIgnoreCase)) {
      # Keep the ICO stream intact so System.Drawing selects the closest native
      # frame. Built-in launcher icons contain the full Windows frame set and
      # must not be flattened through the 96 px launcher PNG.
      $sourceIcon = [Drawing.Icon]::new($stream, $Size, $Size)
      return [Drawing.Icon]$sourceIcon.Clone()
    }
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
    if ($null -ne $sourceIcon) { $sourceIcon.Dispose() }
    if ($null -ne $stream) { $stream.Dispose() }
  }
}

function Test-AuraUiWindowsIcon {
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
      $entry = 6 + ($index * 16)
      $width = if ($bytes[$entry] -eq 0) { 256 } else { [int]$bytes[$entry] }
      $height = if ($bytes[$entry + 1] -eq 0) { 256 } else { [int]$bytes[$entry + 1] }
      $frameLength = [BitConverter]::ToUInt32($bytes, $entry + 8)
      $frameOffset = [BitConverter]::ToUInt32($bytes, $entry + 12)
      if ($width -ne $expectedSizes[$index] -or $height -ne $width -or
          $bytes[$entry + 2] -ne 0 -or $bytes[$entry + 3] -ne 0 -or
          [BitConverter]::ToUInt16($bytes, $entry + 4) -ne 1 -or
          [BitConverter]::ToUInt16($bytes, $entry + 6) -ne 32 -or
          $frameLength -eq 0 -or $frameOffset -ne $expectedOffset -or
          ([uint64]$frameOffset + [uint64]$frameLength) -gt [uint64]$bytes.Length) {
        return $false
      }
      if ($width -eq 256) {
        if ($frameLength -lt 33 -or
            -not [Linq.Enumerable]::SequenceEqual(
              [byte[]]$bytes[$frameOffset..($frameOffset + 7)],
              [byte[]](137, 80, 78, 71, 13, 10, 26, 10)) -or
            [BitConverter]::ToUInt32([byte[]]($bytes[($frameOffset + 19)..($frameOffset + 16)]), 0) -ne 256 -or
            [BitConverter]::ToUInt32([byte[]]($bytes[($frameOffset + 23)..($frameOffset + 20)]), 0) -ne 256) {
          return $false
        }
      } else {
        $stream = $null
        $icon = $null
        try {
          $stream = [IO.MemoryStream]::new($bytes, $false)
          $icon = [Drawing.Icon]::new($stream, $width, $height)
          if ($icon.Width -ne $width -or $icon.Height -ne $height) { return $false }
        } finally {
          if ($null -ne $icon) { $icon.Dispose() }
          if ($null -ne $stream) { $stream.Dispose() }
        }
      }
      $expectedOffset += [int]$frameLength
    }
    return $expectedOffset -eq $bytes.Length
  } catch { return $false }
}

function New-AuraUiMultiFramePngIconBytes {
  [CmdletBinding(DefaultParameterSetName = 'Path')]
  param(
    [Parameter(Mandatory = $true, ParameterSetName = 'Path')][string]$SourcePath,
    [Parameter(Mandatory = $true, ParameterSetName = 'Bytes')][byte[]]$SourceBytes
  )
  $sizes = @(16, 20, 24, 32, 40, 48, 64, 128, 256)
  $sourceStream = $null
  $source = $null
  try {
    $sourceStream = if ($PSCmdlet.ParameterSetName -ceq 'Bytes') {
      [IO.MemoryStream]::new($SourceBytes, $false)
    } else {
      [IO.File]::Open($SourcePath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    }
    $source = [Drawing.Image]::FromStream($sourceStream)
    if ($source.Width -ne 96 -or $source.Height -ne 96) {
      throw 'A custom launcher mark must be exactly 96 by 96 pixels.'
    }
    $frames = [Collections.Generic.List[byte[]]]::new()
    foreach ($size in $sizes) {
      $bitmap = $null
      $graphics = $null
      $memory = $null
      try {
        $bitmap = [Drawing.Bitmap]::new($size, $size, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [Drawing.Graphics]::FromImage($bitmap)
        $graphics.Clear([Drawing.Color]::Transparent)
        $graphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.DrawImage($source, [Drawing.Rectangle]::new(0, 0, $size, $size))
        $memory = [IO.MemoryStream]::new()
        $bitmap.Save($memory, [Drawing.Imaging.ImageFormat]::Png)
        $frames.Add($memory.ToArray())
      } finally {
        if ($null -ne $memory) { $memory.Dispose() }
        if ($null -ne $graphics) { $graphics.Dispose() }
        if ($null -ne $bitmap) { $bitmap.Dispose() }
      }
    }
    $output = [IO.MemoryStream]::new()
    $writer = [IO.BinaryWriter]::new($output)
    try {
      $writer.Write([uint16]0)
      $writer.Write([uint16]1)
      $writer.Write([uint16]$sizes.Count)
      $offset = 6 + ($sizes.Count * 16)
      for ($index = 0; $index -lt $sizes.Count; $index++) {
        $dimension = if ($sizes[$index] -eq 256) { 0 } else { $sizes[$index] }
        $writer.Write([byte]$dimension)
        $writer.Write([byte]$dimension)
        $writer.Write([byte]0)
        $writer.Write([byte]0)
        $writer.Write([uint16]1)
        $writer.Write([uint16]32)
        $writer.Write([uint32]$frames[$index].Length)
        $writer.Write([uint32]$offset)
        $offset += $frames[$index].Length
      }
      foreach ($frame in $frames) { $writer.Write($frame) }
      $writer.Flush()
      return $output.ToArray()
    } finally {
      $writer.Dispose()
      $output.Dispose()
    }
  } finally {
    if ($null -ne $source) { $source.Dispose() }
    if ($null -ne $sourceStream) { $sourceStream.Dispose() }
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
  # back to the console/OEM code page (for example Big5 on a zh-HKTW system), which
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

function ConvertFrom-AuraUiPayloadSettings {
  param([Parameter(Mandatory = $true)][string]$Payload)
  # buildPayloadFromCompiled ends with `})(<CSS JSON string>,<settings JSON>)`.
  # Locate the unescaped separator after the CSS string and parse the settings
  # object. Searching the whole payload for a short compact key is unsafe:
  # valid custom CSS can contain text such as `"t":"other-theme"`.
  $settingsMarker = '",{'
  $settingsIndex = $Payload.LastIndexOf($settingsMarker)
  if ($settingsIndex -lt 0 -or -not $Payload.EndsWith('})', [StringComparison]::Ordinal)) {
    return $null
  }
  $settingsStart = $settingsIndex + 2
  $settingsLength = $Payload.Length - $settingsStart - 1
  if ($settingsLength -lt 2) { return $null }
  try {
    $settings = $Payload.Substring($settingsStart, $settingsLength) | ConvertFrom-Json
  } catch {
    return $null
  }
  if ($settings -isnot [System.Management.Automation.PSCustomObject]) { return $null }
  return $settings
}

function Set-AuraUiPayloadState {
  param([Parameter(Mandatory = $true)][string]$Payload)
  $script:Payload = $Payload
  $script:GreetingShuffleCheckpointSummary = $null
  $runtimeSettings = ConvertFrom-AuraUiPayloadSettings -Payload $script:Payload
  $runtimeLabel = if ($null -ne $runtimeSettings) {
    Get-AuraUiPropertyValue -InputObject $runtimeSettings -Names @('label')
  } else { $null }
  if ($runtimeLabel -is [string] -and $runtimeLabel.Trim()) {
    $script:ActiveLabel = [string]$runtimeLabel
  } elseif ($null -eq $runtimeSettings) {
    $match = [regex]::Match($script:Payload, '"label":"(?<label>[^"\\]+)"')
    if ($match.Success) { $script:ActiveLabel = $match.Groups['label'].Value }
  }
  $runtimeTheme = if ($null -ne $runtimeSettings) {
    Get-AuraUiPropertyValue -InputObject $runtimeSettings -Names @('theme', 't')
  } else { $null }
  if ($runtimeTheme -is [string] -and $runtimeTheme -cmatch '^[a-z][a-z0-9-]{1,39}$') {
    $script:ActiveThemeName = [string]$runtimeTheme
  } elseif ($null -eq $runtimeSettings) {
    # Backward-compatible fallback for a development payload that predates the
    # final two-argument renderer wrapper. Current payloads never reach this
    # branch, so CSS text cannot impersonate the compact identity.
    $themeMatch = [regex]::Match(
      $script:Payload,
      '"(?:theme|t)":"(?<theme>[^"\\]+)"')
    if ($themeMatch.Success) { $script:ActiveThemeName = $themeMatch.Groups['theme'].Value }
  } else {
    $script:ActiveThemeName = $null
  }
  # Runtime settings use the compact `x` key; accept the long key as a
  # development/backward-compatible form so delayed probes bind to the payload
  # that actually reached the page.
  $runtimeDigest = if ($null -ne $runtimeSettings) {
    Get-AuraUiPropertyValue -InputObject $runtimeSettings -Names @('digest', 'x')
  } else { $null }
  $script:ActivePayloadDigest = if ($runtimeDigest -is [string] -and
      $runtimeDigest -cmatch '^[0-9a-f]{64}$') {
    [string]$runtimeDigest
  } elseif ($null -eq $runtimeSettings) {
    $digestMatch = [regex]::Match(
      $script:Payload,
      '"(?:digest|x)":"(?<digest>[0-9a-f]{64})"')
    if ($digestMatch.Success) { $digestMatch.Groups['digest'].Value } else { $null }
  } else {
    $null
  }
  [void](Update-AuraUiLauncherStyle)
  Update-AuraUiLoadingTheme
  # An identity commit can land after the main window is already visible; refresh
  # the anchored bottom-right position and show the launcher if it is ready.
  Update-AuraUiLauncherPosition
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

function Get-AuraUiNavigationRequestIdentity {
  param([AllowNull()][object]$Value)
  try {
    $uri = if ($Value -is [Uri]) { $Value } else { [Uri]"$Value" }
    if ($uri.Scheme -cne 'https' -or $uri.UserInfo) { return $null }
    $components = [UriComponents]::SchemeAndServer -bor [UriComponents]::PathAndQuery
    return $uri.GetComponents($components, [UriFormat]::UriEscaped)
  } catch { return $null }
}

function Test-AuraUiCloudflareChallengeSignal {
  param(
    [AllowNull()][object]$NavigationId,
    [AllowNull()][object]$NavigationUri,
    [AllowNull()][object]$RequestUri,
    [int]$StatusCode,
    [AllowNull()][string]$MitigatedHeader
  )
  if ($null -eq $NavigationId -or $StatusCode -lt 100 -or $StatusCode -gt 599) { return $false }
  $navigationIdentity = Get-AuraUiNavigationRequestIdentity -Value $NavigationUri
  $requestIdentity = Get-AuraUiNavigationRequestIdentity -Value $RequestUri
  if (-not $navigationIdentity -or -not $requestIdentity -or
      -not [string]::Equals($navigationIdentity, $requestIdentity, [StringComparison]::Ordinal) -or
      -not (Test-AuraUiClaudeUri -Value $RequestUri)) {
    return $false
  }
  return [string]::Equals(
    "$MitigatedHeader".Trim(),
    'challenge',
    [StringComparison]::OrdinalIgnoreCase)
}

function Test-AuraUiRescueChallengeCandidate {
  param(
    [AllowNull()][object]$Candidate,
    [UInt64]$CompletedNavigationId,
    [AllowNull()][object]$CurrentSource,
    [AllowNull()][Nullable[int]]$CompletedStatusCode
  )
  if ($null -eq $Candidate -or
      $null -eq $Candidate.PSObject.Properties['NavigationId'] -or
      $null -eq $Candidate.PSObject.Properties['RequestIdentity'] -or
      [UInt64]$Candidate.NavigationId -ne $CompletedNavigationId) {
    return $false
  }
  if ($null -ne $CompletedStatusCode -and
      ($null -eq $Candidate.PSObject.Properties['StatusCode'] -or
        [int]$Candidate.StatusCode -ne [int]$CompletedStatusCode)) {
    return $false
  }
  $currentIdentity = Get-AuraUiNavigationRequestIdentity -Value $CurrentSource
  return $currentIdentity -and [string]::Equals(
    [string]$Candidate.RequestIdentity,
    $currentIdentity,
    [StringComparison]::Ordinal)
}

function Test-AuraUiRescueNavigationFallback {
  param(
    [AllowNull()][object]$CurrentNavigationId,
    [UInt64]$CompletedNavigationId,
    [AllowNull()][object]$CurrentSource,
    [int]$HttpStatusCode
  )
  return $null -ne $CurrentNavigationId -and
    [UInt64]$CurrentNavigationId -eq $CompletedNavigationId -and
    $HttpStatusCode -eq 403 -and
    (Test-AuraUiClaudeUri -Value $CurrentSource)
}

function Complete-AuraUiPendingNavigationVerification {
  if ($null -eq $script:PendingNavigationCompletion -or
      [DateTime]::UtcNow -lt [DateTime]$script:PendingNavigationCompletion.DueUtc) {
    return
  }
  $pending = $script:PendingNavigationCompletion
  $script:PendingNavigationCompletion = $null
  if ($null -eq $script:ActiveNavigationId -or
      [UInt64]$script:ActiveNavigationId -ne [UInt64]$pending.NavigationId) {
    return
  }

  # WebResourceResponseReceived is explicitly non-blocking. Keep the genuine
  # Claude document visible while giving a late cf-mitigated callback one short,
  # bounded UI-timer turn before any renderer or Studio mirror work can begin.
  $challengeCandidate = Test-AuraUiRescueChallengeCandidate `
    -Candidate $script:RescueChallengeCandidate `
    -CompletedNavigationId ([UInt64]$pending.NavigationId) `
    -CurrentSource $script:WebView.Source `
    -CompletedStatusCode ([int]$pending.StatusCode)
  $navigationId = [UInt64]$pending.NavigationId
  $script:ActiveNavigationId = $null
  $script:ActiveNavigationUri = $null
  $script:RescueVerificationPending = $false
  if ($challengeCandidate) {
    Enter-AuraUiRescueMode -NavigationId $navigationId -Reason Challenge
    return
  }

  $script:RescueChallengeCandidate = $null
  if (Test-AuraUiClaudeUri -Value $script:WebView.Source) {
    if ($script:RescueActive) { Exit-AuraUiRescueMode }
    $script:ReadyNavigationId = $navigationId
    $script:PageReady = $true
    Hide-AuraUiLoading
    Show-AuraUiLauncherHint
    $enabled = $true
    if ($null -ne $script:Config.PSObject.Properties['enabled']) {
      $enabled = [bool]$script:Config.enabled
    }
    if ($enabled) { Apply-AuraUiTheme }
  } else {
    $script:ReadyNavigationId = $null
    Hide-AuraUiLoading
  }
  Request-AuraUiContextMirror
}

function Get-AuraUiNewWindowDisposition {
  param([AllowNull()][object]$Value)
  try {
    $uri = if ($Value -is [Uri]) { $Value } else { [Uri]"$Value" }
    if ((Test-AuraUiClaudeUri -Value $uri) -or (Test-AuraUiSignInUri -Value $uri)) {
      return 'Popup'
    }
    if ($uri.Scheme -ceq 'https') { return 'External' }
  } catch {}
  return 'Block'
}

function Show-AuraUiMessage {
  param([string]$Message, [string]$Title = 'Claude Aura', [System.Windows.Forms.MessageBoxIcon]$Icon = [System.Windows.Forms.MessageBoxIcon]::Information)
  [void][System.Windows.Forms.MessageBox]::Show($script:Form, $Message, $Title,
    [System.Windows.Forms.MessageBoxButtons]::OK, $Icon)
}

function Request-AuraUiExit {
  $script:ExitRequested = $true
  if ($null -ne $script:Form -and -not $script:Form.IsDisposed) {
    $script:Form.Close()
  }
}

function Get-AuraUiPermanentThemeIds {
  return @(
    'default',
    'japanese-film-editorial',
    'korean-prestige',
    'cartoon-studio',
    'anime-twilight',
    'study-library',
    'japanese-idol',
    'korean-idol'
  )
}

function Get-AuraUiLoadingThemeId {
  $permanentThemeIds = @(Get-AuraUiPermanentThemeIds)
  if (-not (Get-AuraUiEnabled)) { return 'default' }

  $editorActive = (Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('active')) -eq $true
  if ($editorActive) {
    $editorSourceId = Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('sourceId')
    if ($editorSourceId -is [string] -and $permanentThemeIds -ccontains $editorSourceId) {
      return $editorSourceId
    }
  }

  $selectedThemeId = Get-AuraUiSelectedThemeName
  if ($selectedThemeId -is [string]) {
    $selectedTheme = Get-AuraUiThemeByName -Name $selectedThemeId
    if ($permanentThemeIds -ccontains $selectedThemeId -and
        "$($selectedTheme.source)" -ceq 'builtin') {
      return $selectedThemeId
    }
    $sourceRecipe = Get-AuraUiPropertyValue -InputObject $selectedTheme -Names @('sourceRecipe')
    if ($sourceRecipe -is [string] -and $permanentThemeIds -ccontains $sourceRecipe) {
      return $sourceRecipe
    }
  }
  return 'default'
}

function Get-AuraUiLoadingColorValue {
  param(
    [AllowNull()][object]$InputObject,
    [Parameter(Mandatory = $true)][string]$Property,
    [Parameter(Mandatory = $true)][string]$Fallback
  )
  $value = Get-AuraUiPropertyValue -InputObject $InputObject -Names @($Property)
  if ($value -is [string] -and $value -cmatch '^#[0-9A-Fa-f]{6}$') {
    return $value.ToUpperInvariant()
  }
  return $Fallback
}

function Get-AuraUiLoadingProfile {
  $themeId = Get-AuraUiLoadingThemeId
  $theme = Get-AuraUiThemeByName -Name $themeId
  if ($null -eq $theme) { $theme = Get-AuraUiThemeByName -Name 'default'; $themeId = 'default' }
  $appearance = if (Test-AuraUiDarkChrome) { 'dark' } else { 'light' }
  $studioStyle = Get-AuraUiPropertyValue -InputObject $theme -Names @('studioStyle')
  if (Get-AuraUiEnabled) {
    $permanentThemeIds = @(Get-AuraUiPermanentThemeIds)
    $selectedTheme = Get-AuraUiThemeByName -Name (Get-AuraUiSelectedThemeName)
    $selectedSourceRecipe = Get-AuraUiPropertyValue -InputObject $selectedTheme -Names @('sourceRecipe')
    $selectedHasPermanentProfile = "$($selectedTheme.source)" -ceq 'builtin' -or
      ($selectedSourceRecipe -is [string] -and $permanentThemeIds -ccontains $selectedSourceRecipe)
    $editorActive = (Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('active')) -eq $true
    $editorSourceId = Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('sourceId')
    $editorStyle = if ($editorActive) {
      Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('studioStyle')
    } else { $null }
    if ($null -ne $editorStyle -and
        (($editorSourceId -is [string] -and $permanentThemeIds -ccontains $editorSourceId) -or
          $selectedHasPermanentProfile)) {
      $studioStyle = $editorStyle
    } elseif ($selectedHasPermanentProfile) {
      $selectedStyle = Get-AuraUiPropertyValue -InputObject $selectedTheme -Names @('studioStyle')
      if ($null -ne $selectedStyle) { $studioStyle = $selectedStyle }
    }
  }
  $palette = Get-AuraUiPropertyValue -InputObject $studioStyle -Names @($appearance)
  $secondaryByTheme = @{
    'default' = '#4BC7EE'
    'japanese-film-editorial' = '#B64B32'
    'korean-prestige' = '#5A91E6'
    'cartoon-studio' = '#EA6047'
    'anime-twilight' = '#F0B875'
    'study-library' = '#AA884C'
    'japanese-idol' = '#C7B3E6'
    'korean-idol' = '#79D7E4'
  }
  $cueByTheme = @{
    'default' = 'orbit'
    'japanese-film-editorial' = 'editorial-rule'
    'korean-prestige' = 'facet'
    'cartoon-studio' = 'ink-frame'
    'anime-twilight' = 'horizon'
    'study-library' = 'folio'
    'japanese-idol' = 'ribbon'
    'korean-idol' = 'capsule'
  }

  if ([System.Windows.Forms.SystemInformation]::HighContrast) {
    return [PSCustomObject]@{
      ThemeId = $themeId
      Appearance = $appearance
      Cue = 'none'
      HighContrast = $true
      Background = [Drawing.SystemColors]::Window
      Surface = [Drawing.SystemColors]::Control
      Text = [Drawing.SystemColors]::WindowText
      Muted = [Drawing.SystemColors]::GrayText
      Accent = [Drawing.SystemColors]::Highlight
      AccentSecondary = [Drawing.SystemColors]::Highlight
      AccentText = [Drawing.SystemColors]::HighlightText
      Border = [Drawing.SystemColors]::WindowText
    }
  }

  $fallback = if ($appearance -ceq 'dark') {
    @{
      Background = '#1B1D2C'; Surface = '#282B3E'; Text = '#E9ECF6'; Muted = '#979DB4'
      Accent = '#BA8BF4'; AccentText = '#0F101F'; Border = '#B2BADC'
    }
  } else {
    @{
      Background = '#F1F2F9'; Surface = '#FBFCFE'; Text = '#171A31'; Muted = '#5F647C'
      Accent = '#4721A1'; AccentText = '#FFFFFF'; Border = '#21243B'
    }
  }
  return [PSCustomObject]@{
    ThemeId = $themeId
    Appearance = $appearance
    Cue = "$($cueByTheme[$themeId])"
    HighContrast = $false
    Background = [Drawing.ColorTranslator]::FromHtml(
      (Get-AuraUiLoadingColorValue -InputObject $palette -Property 'canvas' -Fallback $fallback.Background))
    Surface = [Drawing.ColorTranslator]::FromHtml(
      (Get-AuraUiLoadingColorValue -InputObject $palette -Property 'raised' -Fallback $fallback.Surface))
    Text = [Drawing.ColorTranslator]::FromHtml(
      (Get-AuraUiLoadingColorValue -InputObject $palette -Property 'text' -Fallback $fallback.Text))
    Muted = [Drawing.ColorTranslator]::FromHtml(
      (Get-AuraUiLoadingColorValue -InputObject $palette -Property 'textMuted' -Fallback $fallback.Muted))
    Accent = [Drawing.ColorTranslator]::FromHtml(
      (Get-AuraUiLoadingColorValue -InputObject $palette -Property 'accent' -Fallback $fallback.Accent))
    AccentSecondary = [Drawing.ColorTranslator]::FromHtml("$($secondaryByTheme[$themeId])")
    AccentText = [Drawing.ColorTranslator]::FromHtml(
      (Get-AuraUiLoadingColorValue -InputObject $palette -Property 'accentText' -Fallback $fallback.AccentText))
    Border = [Drawing.ColorTranslator]::FromHtml(
      (Get-AuraUiLoadingColorValue -InputObject $palette -Property 'border' -Fallback $fallback.Border))
  }
}

function Test-AuraUiLoadingAnimationEnabled {
  if ([System.Windows.Forms.SystemInformation]::HighContrast) { return $false }
  try {
    $windowMetrics = Get-ItemProperty `
      -LiteralPath 'HKCU:\Control Panel\Desktop\WindowMetrics' `
      -Name MinAnimate `
      -ErrorAction Stop
    if ("$($windowMetrics.MinAnimate)" -ceq '0') { return $false }
  } catch {}
  return $true
}

function New-AuraUiLoadingMarkBitmap {
  param([Parameter(Mandatory = $true)][string]$ThemeId)
  if (@(Get-AuraUiPermanentThemeIds) -cnotcontains $ThemeId) { return $null }
  $themeArtRootFull = [IO.Path]::GetFullPath($ThemeArtRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)
  $candidate = [IO.Path]::GetFullPath((Join-Path $ThemeArtRoot "$ThemeId\launcher-mark.png"))
  if (-not $candidate.StartsWith(
      $themeArtRootFull + [IO.Path]::DirectorySeparatorChar,
      [StringComparison]::OrdinalIgnoreCase) -or
      -not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
    return $null
  }
  $stream = $null
  $source = $null
  try {
    $stream = [IO.File]::Open($candidate, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    $source = [Drawing.Image]::FromStream($stream)
    if ($source.Width -ne 96 -or $source.Height -ne 96) { return $null }
    return [Drawing.Bitmap]::new($source)
  } catch {
    Write-AuraUiLog -Message "Loading-screen identity could not be loaded: $($_.Exception.Message)"
    return $null
  } finally {
    if ($null -ne $source) { $source.Dispose() }
    if ($null -ne $stream) { $stream.Dispose() }
  }
}

function Paint-AuraUiLoadingPanel {
  param(
    [Parameter(Mandatory = $true)][Drawing.Graphics]$Graphics,
    [Parameter(Mandatory = $true)][Drawing.Rectangle]$Bounds
  )
  $profile = $script:LoadingProfile
  if ($null -eq $profile -or $Bounds.Width -lt 2 -or $Bounds.Height -lt 2) { return }
  $Graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $Graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  if ($profile.HighContrast) {
    $Graphics.Clear($profile.Background)
    return
  }

  $gradient = [Drawing.Drawing2D.LinearGradientBrush]::new(
    $Bounds, $profile.Background, $profile.Surface, [float]32)
  $primaryPen = [Drawing.Pen]::new([Drawing.Color]::FromArgb(34, $profile.Accent), [float]1.6)
  $secondaryPen = [Drawing.Pen]::new([Drawing.Color]::FromArgb(42, $profile.AccentSecondary), [float]1.25)
  $secondaryBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(38, $profile.AccentSecondary))
  try {
    $Graphics.FillRectangle($gradient, $Bounds)
    $width = [float]$Bounds.Width
    $height = [float]$Bounds.Height
    $centerX = $width / 2
    $centerY = $height / 2
    switch -CaseSensitive ("$($profile.Cue)") {
      'orbit' {
        $Graphics.DrawEllipse($primaryPen, $centerX - 218, $centerY - 112, 436, 224)
        $Graphics.DrawArc($secondaryPen, $centerX - 166, $centerY - 166, 332, 332, 205, 210)
        break
      }
      'editorial-rule' {
        $ruleX = [float]($width * 0.17)
        $Graphics.DrawLine($primaryPen, $ruleX, 38, $ruleX, $height - 38)
        $Graphics.DrawLine($secondaryPen, $ruleX, $height - 74, $width * 0.46, $height - 74)
        $Graphics.FillEllipse($secondaryBrush, $ruleX - 5, $height - 80, 10, 10)
        break
      }
      'facet' {
        $points = [Drawing.PointF[]]@(
          [Drawing.PointF]::new($centerX, $centerY - 206),
          [Drawing.PointF]::new($centerX + 246, $centerY),
          [Drawing.PointF]::new($centerX, $centerY + 206),
          [Drawing.PointF]::new($centerX - 246, $centerY)
        )
        $Graphics.DrawPolygon($primaryPen, $points)
        $Graphics.DrawLine($secondaryPen, $points[0], $points[2])
        $Graphics.DrawLine($secondaryPen, $points[1], $points[3])
        break
      }
      'ink-frame' {
        $outer = [Drawing.RectangleF]::new(42, 38, [Math]::Max(1, $width - 104), [Math]::Max(1, $height - 92))
        $inner = [Drawing.RectangleF]::new(58, 54, [Math]::Max(1, $width - 104), [Math]::Max(1, $height - 92))
        $Graphics.DrawRectangle($primaryPen, $outer.X, $outer.Y, $outer.Width, $outer.Height)
        $Graphics.DrawRectangle($secondaryPen, $inner.X, $inner.Y, $inner.Width, $inner.Height)
        $Graphics.FillEllipse($secondaryBrush, $width - 92, 52, 12, 12)
        break
      }
      'horizon' {
        $Graphics.DrawArc($primaryPen, $centerX - 264, $centerY - 202, 528, 404, 194, 152)
        $Graphics.DrawArc($secondaryPen, $centerX - 204, $centerY - 150, 408, 300, 12, 154)
        $Graphics.DrawLine($secondaryPen, 72, $centerY + 156, $width - 72, $centerY + 156)
        break
      }
      'folio' {
        for ($line = 0; $line -lt 4; $line++) {
          $lineY = [float]($height - 116 + ($line * 18))
          $Graphics.DrawLine($(if ($line -eq 0) { $secondaryPen } else { $primaryPen }),
            78, $lineY, $width - 78, $lineY)
        }
        $Graphics.DrawLine($secondaryPen, 124, 42, 124, $height - 44)
        break
      }
      'ribbon' {
        $path = [Drawing.Drawing2D.GraphicsPath]::new()
        try {
          $path.AddBezier(54, $height * 0.68, $width * 0.24, $height * 0.24,
            $width * 0.72, $height * 0.86, $width - 54, $height * 0.32)
          $Graphics.DrawPath($primaryPen, $path)
          $Graphics.FillEllipse($secondaryBrush, $width * 0.78, $height * 0.24, 10, 10)
        } finally {
          $path.Dispose()
        }
        break
      }
      'capsule' {
        foreach ($offset in @(0, 18, 36)) {
          $capsule = [Drawing.RectangleF]::new(
            58 + $offset, 58 + $offset,
            [Math]::Max(1, $width - 152), [Math]::Max(1, $height - 152))
          $capsulePath = New-AuraUiRoundedRectanglePath -Bounds $capsule -Radius 44
          try {
            $Graphics.DrawPath($(if ($offset -eq 18) { $secondaryPen } else { $primaryPen }), $capsulePath)
          } finally {
            $capsulePath.Dispose()
          }
        }
        break
      }
    }
  } finally {
    $secondaryBrush.Dispose()
    $secondaryPen.Dispose()
    $primaryPen.Dispose()
    $gradient.Dispose()
  }
}

function Set-AuraUiLoadingLayout {
  if ($null -eq $script:LoadingPanel -or $script:LoadingPanel.IsDisposed) { return }
  $centerX = [Math]::Floor($script:LoadingPanel.ClientSize.Width / 2)
  $clusterTop = [Math]::Max(28, [Math]::Floor(($script:LoadingPanel.ClientSize.Height - 196) / 2))
  $script:LoadingMark.Location = [Drawing.Point]::new($centerX - 38, $clusterTop)
  $script:LoadingLabel.Location = [Drawing.Point]::new(
    [Math]::Max(0, $centerX - [Math]::Floor($script:LoadingLabel.Width / 2)), $clusterTop + 82)
  $script:LoadingProgress.Location = [Drawing.Point]::new(
    $centerX - [Math]::Floor($script:LoadingProgress.Width / 2), $clusterTop + 142)
  $script:RetryButton.Location = [Drawing.Point]::new(
    $centerX - [Math]::Floor($script:RetryButton.Width / 2), $clusterTop + 132)
  $indicatorWidth = [Math]::Max(54, [Math]::Floor($script:LoadingProgress.Width * 0.28))
  $script:LoadingProgressIndicator.Size = [Drawing.Size]::new($indicatorWidth, $script:LoadingProgress.Height)
  if (-not (Test-AuraUiLoadingAnimationEnabled)) {
    $script:LoadingProgressIndicator.Left = [Math]::Floor(($script:LoadingProgress.Width - $indicatorWidth) / 2)
  }
}

function Update-AuraUiLoadingTheme {
  if ($null -eq $script:LoadingPanel -or $script:LoadingPanel.IsDisposed) { return }
  try {
    $profile = Get-AuraUiLoadingProfile
    $script:LoadingProfile = $profile
    Update-AuraUiWindowChrome `
      -Dark ([string]::Equals("$($profile.Appearance)", 'dark', [StringComparison]::Ordinal)) `
      -MainColor $profile.Background
    $script:LoadingPanel.BackColor = $profile.Background
    $script:LoadingLabel.ForeColor = $profile.Text
    $script:LoadingProgress.BackColor = ConvertTo-AuraUiBlendedColor `
      -From $profile.Surface -To $profile.Border -Amount 0.18
    $script:LoadingProgressIndicator.BackColor = $profile.Accent
    $script:RetryButton.FlatAppearance.BorderColor = $profile.Border
    $script:RetryButton.FlatAppearance.MouseOverBackColor = ConvertTo-AuraUiBlendedColor `
      -From $profile.Accent -To $profile.AccentText -Amount 0.1
    $script:RetryButton.FlatAppearance.MouseDownBackColor = ConvertTo-AuraUiBlendedColor `
      -From $profile.Accent -To $profile.Text -Amount 0.16
    $script:RetryButton.BackColor = $profile.Accent
    $script:RetryButton.ForeColor = $profile.AccentText
    $script:RetryButton.UseVisualStyleBackColor = [bool]$profile.HighContrast
    $script:LoadingMark.Visible = -not [bool]$profile.HighContrast
    $nextMark = if ($profile.HighContrast) { $null } else {
      New-AuraUiLoadingMarkBitmap -ThemeId "$($profile.ThemeId)"
    }
    $previousMark = $script:LoadingMark.Image
    $script:LoadingMark.Image = $nextMark
    if ($null -ne $previousMark) { $previousMark.Dispose() }
    if ($null -ne $script:Form -and -not $script:Form.IsDisposed) {
      $script:Form.BackColor = $profile.Background
    }
    if ($null -ne $script:WebView -and -not $script:WebView.IsDisposed) {
      $script:WebView.BackColor = $profile.Background
    }
    Set-AuraUiLoadingLayout
    $script:LoadingPanel.Invalidate()
    Update-AuraUiRescueWindowTheme
  } catch {
    Write-AuraUiLog -Message "Loading-screen theme could not be refreshed: $($_.Exception.Message)"
  }
}

function Show-AuraUiLoading {
  param([string]$Message, [bool]$Retry = $false)
  if ($null -eq $script:LoadingPanel -or $script:LoadingPanel.IsDisposed) { return }
  Update-AuraUiLoadingTheme
  $script:LoadingLabel.Text = $Message
  $script:LoadingProgress.AccessibleName = $Message
  $script:RetryButton.Visible = $Retry
  $script:LoadingProgress.Visible = -not $Retry
  if ($Retry -or -not (Test-AuraUiLoadingAnimationEnabled)) {
    if ($null -ne $script:LoadingAnimationTimer) { $script:LoadingAnimationTimer.Stop() }
  } else {
    if ($null -ne $script:LoadingAnimationTimer) { $script:LoadingAnimationTimer.Start() }
  }
  $script:LoadingPanel.Visible = $true
  $script:LoadingPanel.BringToFront()
}

function Hide-AuraUiLoading {
  if ($null -ne $script:LoadingAnimationTimer) { $script:LoadingAnimationTimer.Stop() }
  if ($null -ne $script:LoadingPanel -and -not $script:LoadingPanel.IsDisposed) {
    $script:LoadingPanel.Visible = $false
  }
}

function Get-AuraUiNavigationCompletionDisposition {
  param(
    [AllowNull()][object]$CurrentNavigationId,
    [AllowNull()][object]$ReadyNavigationId,
    [UInt64]$CompletedNavigationId,
    [bool]$IsSuccess
  )
  if ($null -eq $CurrentNavigationId -or
      [UInt64]$CurrentNavigationId -ne $CompletedNavigationId) {
    return 'Ignore'
  }
  if ($IsSuccess -or
      ($null -ne $ReadyNavigationId -and [UInt64]$ReadyNavigationId -eq $CompletedNavigationId)) {
    return 'Loaded'
  }
  return 'Failure'
}

function Get-AuraUiRescueBreakerTransition {
  param(
    [ValidateSet('Closed', 'Open', 'HalfOpen')][string]$State,
    [ValidateRange(0, 2)][int]$Count,
    [bool]$Distinct
  )
  if (-not $Distinct) {
    return [PSCustomObject]@{ State = $State; Count = $Count }
  }
  $nextCount = [Math]::Min(2, $Count + 1)
  $nextState = if ($State -ceq 'HalfOpen' -or $State -ceq 'Open' -or $nextCount -ge 2) {
    'Open'
  } else {
    'Closed'
  }
  return [PSCustomObject]@{ State = $nextState; Count = $nextCount }
}

function Stop-AuraUiMirrorForRescue {
  # Invalidate any in-flight probe/capture without reading or serializing the
  # access-check document. Completed stale work is drained by the normal timer.
  $script:MirrorGeneration = [long]$script:MirrorGeneration + 1
  $script:MirrorDue = $null
  $script:MirrorSemanticRetries = 0
  $script:MirrorSemanticPreviousContext = $null
  $script:MirrorGeometry = $null
  Stop-AuraUiGreetingProbe
}

function Update-AuraUiRescueWindowCopy {
  if ($null -eq $script:RescueForm -or $script:RescueForm.IsDisposed) { return }
  $isAccessDenied = $script:RescueReason -ceq 'AccessDenied'
  $eyebrow = if ($isAccessDenied) {
    "$($script:UiCopy.rescueAccessEyebrow)"
  } else {
    "$($script:UiCopy.rescueEyebrow)"
  }
  $title = if ($isAccessDenied) {
    "$($script:UiCopy.rescueAccessTitle)"
  } else {
    "$($script:UiCopy.rescueTitle)"
  }
  $body = if ($script:IsRescueSession -and $isAccessDenied) {
    "$($script:UiCopy.rescueAccessPrivateBody)"
  } elseif ($script:IsRescueSession) {
    "$($script:UiCopy.rescuePrivateBody)"
  } elseif ($script:RescueBreakerState -ceq 'Open' -and $isAccessDenied) {
    "$($script:UiCopy.rescueAccessRepeatedBody)"
  } elseif ($script:RescueBreakerState -ceq 'Open') {
    "$($script:UiCopy.rescueRepeatedBody)"
  } elseif ($isAccessDenied) {
    "$($script:UiCopy.rescueAccessBody)"
  } else {
    "$($script:UiCopy.rescueBody)"
  }
  $script:RescueForm.AccessibleName = "$($script:UiCopy.rescueAccessibleName)"
  $script:RescueForm.Text = "$($script:UiCopy.rescueAccessibleName)"
  $script:RescueEyebrowLabel.Text = $eyebrow
  $script:RescueTitleLabel.Text = $title
  $script:RescueBodyLabel.Text = $body
  $script:RescueBrowserButton.Text = "$($script:UiCopy.rescueOpenBrowser)"
  $script:RescueCleanButton.Text = if ($script:IsRescueSession) {
    "$($script:UiCopy.rescueCleanSessionActive)"
  } else {
    "$($script:UiCopy.rescueCleanSession)"
  }
  $script:RescueCleanButton.Enabled = -not $script:IsRescueSession
  $script:RescueRetryButton.Text = if ($script:RescueBreakerState -ceq 'HalfOpen') {
    "$($script:UiCopy.rescueRetrying)"
  } else {
    "$($script:UiCopy.rescueRetryHere)"
  }
  $script:RescueRetryButton.Enabled = $script:RescueBreakerState -cne 'HalfOpen'
  $script:RescueForm.AccessibleDescription = $body
}

function Update-AuraUiRescueWindowTheme {
  if ($null -eq $script:RescueForm -or $script:RescueForm.IsDisposed) { return }
  try {
    $profile = Get-AuraUiLoadingProfile
    $script:RescueForm.BackColor = $profile.Surface
    $script:RescueAccentPanel.BackColor = $profile.Accent
    $script:RescueEyebrowLabel.ForeColor = $profile.Accent
    $script:RescueTitleLabel.ForeColor = $profile.Text
    $script:RescueBodyLabel.ForeColor = $profile.Muted
    $script:RescueBrowserButton.BackColor = $profile.Accent
    $script:RescueBrowserButton.ForeColor = $profile.AccentText
    $script:RescueBrowserButton.FlatAppearance.BorderColor = $profile.Accent
    foreach ($button in @($script:RescueCleanButton, $script:RescueRetryButton)) {
      $button.BackColor = $profile.Surface
      $button.ForeColor = $profile.Text
      $button.FlatAppearance.BorderColor = $profile.Border
    }
    foreach ($button in @(
        $script:RescueBrowserButton,
        $script:RescueCleanButton,
        $script:RescueRetryButton)) {
      $button.UseVisualStyleBackColor = [bool]$profile.HighContrast
    }
  } catch {
    Write-AuraUiLog -Message 'Rescue window theme refresh failed.'
  }
}

function Update-AuraUiRescueWindowPosition {
  if ($null -eq $script:RescueForm -or $script:RescueForm.IsDisposed -or
      $null -eq $script:Form -or $script:Form.IsDisposed) {
    return
  }
  try {
    $origin = $script:Form.PointToScreen([Drawing.Point]::Empty)
    $workingArea = [System.Windows.Forms.Screen]::FromControl($script:Form).WorkingArea
    $left = [Math]::Max(
      $workingArea.Left + 12,
      [Math]::Min($origin.X + 24, $workingArea.Right - $script:RescueForm.Width - 12))
    $top = [Math]::Max(
      $workingArea.Top + 12,
      [Math]::Min(
        $origin.Y + $script:Form.ClientSize.Height - $script:RescueForm.Height - 24,
        $workingArea.Bottom - $script:RescueForm.Height - 12))
    $script:RescueForm.Location = [Drawing.Point]::new($left, $top)
  } catch {
    Write-AuraUiLog -Message 'Rescue window position refresh failed.'
  }
}

function New-AuraUiRescueWindow {
  $form = [System.Windows.Forms.Form]::new()
  $form.Text = ''
  $form.AccessibleRole = [System.Windows.Forms.AccessibleRole]::Dialog
  $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
  $form.ControlBox = $true
  $form.MinimizeBox = $false
  $form.MaximizeBox = $false
  $form.ShowIcon = $false
  $form.ShowInTaskbar = $false
  $form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
  $form.ClientSize = [Drawing.Size]::new(560, 286)
  $form.AutoScaleMode = [System.Windows.Forms.AutoScaleMode]::Dpi
  $form.KeyPreview = $true

  $script:RescueAccentPanel = [System.Windows.Forms.Panel]::new()
  $script:RescueAccentPanel.Bounds = [Drawing.Rectangle]::new(0, 0, 7, 286)
  $script:RescueAccentPanel.Anchor = 'Top,Bottom,Left'
  $script:RescueAccentPanel.TabStop = $false

  $script:RescueEyebrowLabel = [System.Windows.Forms.Label]::new()
  $script:RescueEyebrowLabel.Bounds = [Drawing.Rectangle]::new(32, 24, 496, 22)
  $script:RescueEyebrowLabel.Font = [Drawing.Font]::new('Segoe UI Semibold', 9)
  $script:RescueEyebrowLabel.BackColor = [Drawing.Color]::Transparent

  $script:RescueTitleLabel = [System.Windows.Forms.Label]::new()
  $script:RescueTitleLabel.Bounds = [Drawing.Rectangle]::new(32, 50, 496, 38)
  $script:RescueTitleLabel.Font = [Drawing.Font]::new('Segoe UI Semibold', 17)
  $script:RescueTitleLabel.BackColor = [Drawing.Color]::Transparent

  $script:RescueBodyLabel = [System.Windows.Forms.Label]::new()
  $script:RescueBodyLabel.Bounds = [Drawing.Rectangle]::new(32, 96, 496, 86)
  $script:RescueBodyLabel.Font = [Drawing.Font]::new('Segoe UI', 10)
  $script:RescueBodyLabel.BackColor = [Drawing.Color]::Transparent

  $script:RescueBrowserButton = [System.Windows.Forms.Button]::new()
  $script:RescueBrowserButton.Bounds = [Drawing.Rectangle]::new(32, 214, 154, 42)
  $script:RescueCleanButton = [System.Windows.Forms.Button]::new()
  $script:RescueCleanButton.Bounds = [Drawing.Rectangle]::new(196, 214, 190, 42)
  $script:RescueRetryButton = [System.Windows.Forms.Button]::new()
  $script:RescueRetryButton.Bounds = [Drawing.Rectangle]::new(396, 214, 132, 42)
  foreach ($button in @(
      $script:RescueBrowserButton,
      $script:RescueCleanButton,
      $script:RescueRetryButton)) {
    $button.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $button.FlatAppearance.BorderSize = 1
    $button.Cursor = [System.Windows.Forms.Cursors]::Hand
    $button.Font = [Drawing.Font]::new('Segoe UI Semibold', 9)
    $button.TabStop = $true
    $button.AutoEllipsis = $true
  }

  $script:RescueBrowserButton.add_Click({ Open-AuraUiRescueInBrowser })
  $script:RescueCleanButton.add_Click({ Request-AuraUiCleanSession })
  $script:RescueRetryButton.add_Click({ Request-AuraUiRescueRetry })
  $form.AcceptButton = $script:RescueBrowserButton
  $form.add_KeyDown({
    param($sender, $eventArgs)
    if ($eventArgs.KeyCode -eq [System.Windows.Forms.Keys]::Escape) {
      $sender.Hide()
      if ($null -ne $script:WebView -and -not $script:WebView.IsDisposed) { $script:WebView.Focus() }
    }
  })
  $form.add_FormClosing({
    param($sender, $eventArgs)
    if (-not $script:Closing -and
        $eventArgs.CloseReason -eq [System.Windows.Forms.CloseReason]::UserClosing) {
      $eventArgs.Cancel = $true
      $sender.Hide()
    }
  })
  $form.Controls.AddRange(@(
    $script:RescueAccentPanel,
    $script:RescueEyebrowLabel,
    $script:RescueTitleLabel,
    $script:RescueBodyLabel,
    $script:RescueBrowserButton,
    $script:RescueCleanButton,
    $script:RescueRetryButton
  ))
  $script:RescueForm = $form
  Update-AuraUiRescueWindowCopy
  Update-AuraUiRescueWindowTheme
  return $form
}

function Show-AuraUiRescueWindow {
  if ($null -eq $script:Form -or $script:Form.IsDisposed) { return }
  if ($null -eq $script:RescueForm -or $script:RescueForm.IsDisposed) {
    [void](New-AuraUiRescueWindow)
  }
  Update-AuraUiRescueWindowCopy
  Update-AuraUiRescueWindowTheme
  Update-AuraUiRescueWindowPosition
  if (-not $script:RescueForm.Visible) {
    $script:RescueForm.Show($script:Form)
  } else {
    $script:RescueForm.BringToFront()
  }
  Update-AuraUiRescueWindowPosition
  $script:RescueBrowserButton.Select()
}

function Hide-AuraUiRescueWindow {
  if ($null -ne $script:RescueForm -and -not $script:RescueForm.IsDisposed) {
    $script:RescueForm.Hide()
  }
}

function Enter-AuraUiRescueMode {
  param(
    [UInt64]$NavigationId,
    [ValidateSet('Challenge', 'AccessDenied')][string]$Reason = 'Challenge'
  )
  $distinct = $null -eq $script:RescueLastNavigationId -or
    [UInt64]$script:RescueLastNavigationId -ne $NavigationId
  $transition = Get-AuraUiRescueBreakerTransition `
    -State $script:RescueBreakerState `
    -Count $script:RescueAttemptCount `
    -Distinct $distinct
  $script:RescueBreakerState = [string]$transition.State
  $script:RescueAttemptCount = [int]$transition.Count
  if ($distinct) { $script:RescueLastNavigationId = $NavigationId }
  $script:RescueGeneration = [long]$script:RescueGeneration + 1
  $script:RescueReason = $Reason
  $script:RescueActive = $true
  $script:RescueChallengeCandidate = $null
  $script:RescueVerificationPending = $false
  $script:PendingNavigationCompletion = $null
  $script:ReadyNavigationId = $null
  $script:PageReady = $false
  $script:PendingApply = $false
  $script:PendingRestore = $false
  Stop-AuraUiMirrorForRescue
  Hide-AuraUiLoading
  Write-AuraUiLog -Message $(if ($Reason -ceq 'AccessDenied') {
      'Rescue mode entered: access denied.'
    } elseif ($script:RescueBreakerState -ceq 'Open') {
      'Rescue mode entered: repeated access challenge.'
    } else {
      'Rescue mode entered: access challenge.'
    })
  Show-AuraUiRescueWindow
}

function Exit-AuraUiRescueMode {
  $script:RescueGeneration = [long]$script:RescueGeneration + 1
  $script:RescueActive = $false
  $script:RescueReason = 'Challenge'
  $script:RescueChallengeCandidate = $null
  $script:RescueVerificationPending = $false
  $script:PendingNavigationCompletion = $null
  $script:RescueAttemptCount = 0
  $script:RescueBreakerState = 'Closed'
  $script:RescueLastNavigationId = $null
  Hide-AuraUiRescueWindow
}

function Open-AuraUiRescueInBrowser {
  if (-not $script:RescueActive) { return }
  try {
    Start-Process -FilePath 'https://claude.ai/' | Out-Null
  } catch {
    Write-AuraUiLog -Message 'Rescue browser launch failed.'
    Show-AuraUiMessage `
      -Title "$($script:UiCopy.rescueBrowserFailedTitle)" `
      -Message "$($script:UiCopy.rescueBrowserFailedMessage)" `
      -Icon Warning
  }
}

function Request-AuraUiRescueRetry {
  if (-not $script:RescueActive -or $script:RescueBreakerState -ceq 'HalfOpen' -or
      -not $script:WebReady -or $null -eq $script:WebView.CoreWebView2) {
    return
  }
  $script:RescueBreakerState = 'HalfOpen'
  Update-AuraUiRescueWindowCopy
  Hide-AuraUiLoading
  try {
    $script:WebView.CoreWebView2.Navigate('https://claude.ai/')
  } catch {
    $script:RescueBreakerState = 'Open'
    Write-AuraUiLog -Message 'Rescue retry could not start.'
    Show-AuraUiRescueWindow
  }
}

function Request-AuraUiCleanSession {
  if (-not $script:RescueActive -or $script:IsRescueSession) { return }
  $rescueGeneration = [long]$script:RescueGeneration
  $owner = if ($null -ne $script:RescueForm -and -not $script:RescueForm.IsDisposed) {
    $script:RescueForm
  } else {
    $script:Form
  }
  $result = [System.Windows.Forms.MessageBox]::Show(
    $owner,
    "$($script:UiCopy.rescueConfirmMessage)",
    "$($script:UiCopy.rescueConfirmTitle)",
    [System.Windows.Forms.MessageBoxButtons]::YesNo,
    [System.Windows.Forms.MessageBoxIcon]::Question,
    [System.Windows.Forms.MessageBoxDefaultButton]::Button2)
  if ($result -ne [System.Windows.Forms.DialogResult]::Yes) { return }
  if (-not $script:RescueActive -or $script:IsRescueSession -or
      [long]$script:RescueGeneration -ne $rescueGeneration) {
    return
  }
  $script:RescueRestartRequested = $true
  Request-AuraUiExit
}

function Start-AuraUiCleanSessionProcess {
  $hostExecutable = [IO.Path]::GetFullPath("$($script:HostExecutable)")
  $scriptPath = [IO.Path]::GetFullPath("$($script:CurrentScriptPath)")
  $rootPath = [IO.Path]::GetFullPath($Root).TrimEnd([IO.Path]::DirectorySeparatorChar)
  if (-not (Test-Path -LiteralPath $hostExecutable -PathType Leaf) -or
      -not (Test-Path -LiteralPath $scriptPath -PathType Leaf) -or
      [IO.Path]::GetFileName($scriptPath) -cne 'aura-ui.ps1' -or
      -not $scriptPath.StartsWith(
        $rootPath + [IO.Path]::DirectorySeparatorChar,
        [StringComparison]::OrdinalIgnoreCase)) {
    throw 'The clean Aura session launcher is unavailable.'
  }
  $arguments = '-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" -RescueSession' -f (
    $scriptPath.Replace('"', '""'))
  Start-Process `
    -FilePath $hostExecutable `
    -ArgumentList $arguments `
    -WorkingDirectory $Root | Out-Null
}

function Start-AuraUiScript {
  param([string]$Source, [ValidateSet('Apply', 'Restore')][string]$Action, [bool]$Cover = $false)
  if ($script:RescueActive -or $script:RescueVerificationPending) {
    if ($Cover) { Hide-AuraUiLoading }
    return
  }
  if ($null -ne $script:RescueChallengeCandidate) {
    if ($Cover) { Hide-AuraUiLoading }
    return
  }
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
  if ($script:RescueActive -or $script:RescueVerificationPending) {
    if ($Cover) { Hide-AuraUiLoading }
    return
  }
  if ($null -ne $script:RescueChallengeCandidate) {
    if ($Cover) { Hide-AuraUiLoading }
    return
  }
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
  Request-AuraUiExit
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

function Test-AuraUiDarkChrome {
  param(
    [ValidateSet('system', 'light', 'dark')][string]$Appearance = (Get-AuraUiAppearance),
    [bool]$Enabled = (Get-AuraUiEnabled)
  )
  if ($Enabled -and $Appearance -ceq 'dark') { return $true }
  if ($Enabled -and $Appearance -ceq 'light') { return $false }
  try {
    $personalize = Get-ItemProperty `
      -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize' `
      -Name AppsUseLightTheme `
      -ErrorAction Stop
    return ([int]$personalize.AppsUseLightTheme -eq 0)
  } catch {
    return $false
  }
}

function Update-AuraUiWindowChrome {
  param(
    [bool]$Dark = (Test-AuraUiDarkChrome),
    [AllowNull()][Drawing.Color]$MainColor
  )
  if ($null -eq $MainColor -or $MainColor.IsEmpty) {
    $MainColor = if ($Dark) {
      [Drawing.ColorTranslator]::FromHtml('#19191D')
    } else {
      [Drawing.ColorTranslator]::FromHtml('#F4F1EA')
    }
  }
  $studioColor = if ($Dark) {
    [Drawing.ColorTranslator]::FromHtml('#19191D')
  } else {
    [Drawing.ColorTranslator]::FromHtml('#FAF9F5')
  }
  foreach ($entry in @(
    @{ Tracker = $script:MainIconWindow; Color = $MainColor },
    @{ Tracker = $script:StudioIconWindow; Color = $studioColor }
  )) {
    if ($null -eq $entry.Tracker) { continue }
    try {
      $entry.Tracker.SetDarkMode($Dark)
      $entry.Tracker.SetCaptionColor(
        [byte]$entry.Color.R,
        [byte]$entry.Color.G,
        [byte]$entry.Color.B)
    } catch {
      Write-AuraUiLog -Message "Native window chrome could not follow appearance: $($_.Exception.Message)"
    }
  }
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
  $darkChrome = Test-AuraUiDarkChrome -Appearance $Appearance -Enabled $Enabled
  Update-AuraUiWindowChrome -Dark $darkChrome
  Update-AuraUiLoadingTheme
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
    borderWidth = 2
  }
}

function Resolve-AuraUiLauncherModeMaterial {
  param(
    [Parameter(Mandatory = $true)][object]$Raw,
    [AllowNull()][object]$StudioStyle,
    [Parameter(Mandatory = $true)][bool]$Dark
  )
  $authoredSurface = Get-AuraUiPropertyValue -InputObject $Raw -Names @('surface')
  if ($authoredSurface -isnot [string] -or $authoredSurface -cnotmatch '^#[0-9A-Fa-f]{6}$') {
    return $Raw
  }
  try {
    $authoredDark = [Drawing.ColorTranslator]::FromHtml($authoredSurface).GetBrightness() -lt 0.5
  } catch {
    return $Raw
  }
  # Preserve each recipe's authored launcher material in its native appearance.
  # Only its complementary appearance comes from the validated Studio palette,
  # so Light/Dark changes the surface without flattening the mark or identity.
  if ($authoredDark -eq $Dark) { return $Raw }
  $mode = if ($Dark) { 'dark' } else { 'light' }
  $palette = Get-AuraUiPropertyValue -InputObject $StudioStyle -Names @($mode)
  if ($null -eq $palette) { return $Raw }
  $mapped = [ordered]@{
    surface = Get-AuraUiPropertyValue -InputObject $palette -Names @('surface')
    surfaceHover = Get-AuraUiPropertyValue -InputObject $palette -Names @('raised')
    foreground = Get-AuraUiPropertyValue -InputObject $palette -Names @('text')
    border = Get-AuraUiPropertyValue -InputObject $palette -Names @('border')
  }
  foreach ($value in $mapped.Values) {
    if ($value -isnot [string] -or $value -cnotmatch '^#[0-9A-Fa-f]{6}$') {
      return $Raw
    }
  }
  return [PSCustomObject][ordered]@{
    asset = Get-AuraUiPropertyValue -InputObject $Raw -Names @('asset')
    surface = "$($mapped.surface)".ToUpperInvariant()
    surfaceHover = "$($mapped.surfaceHover)".ToUpperInvariant()
    foreground = "$($mapped.foreground)".ToUpperInvariant()
    accent = Get-AuraUiPropertyValue -InputObject $Raw -Names @('accent')
    border = "$($mapped.border)".ToUpperInvariant()
    radius = Get-AuraUiPropertyValue -InputObject $Raw -Names @('radius')
    borderWidth = Get-AuraUiPropertyValue -InputObject $Raw -Names @('borderWidth')
  }
}

function Get-AuraUiLauncherStyle {
  $fallback = Get-AuraUiLauncherDefaultStyle
  $enabled = Get-AuraUiEnabled
  $themeName = if ($enabled) { Get-AuraUiSelectedThemeName } else { 'default' }
  if (-not $themeName) { $themeName = 'default' }
  $editorActive = $enabled -and
    (Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('active')) -eq $true
  $editorSourceId = if ($editorActive) {
    Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('sourceId')
  } else { $null }
  $editorSource = if ($editorActive) {
    Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('source')
  } else { $null }
  $editorId = if ($editorActive) {
    Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('id')
  } else { $null }
  $editorLauncherPreviewUrl = if ($editorActive) {
    Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('launcherStylePreviewUrl')
  } else { $null }
  # The active editor payload is the appearance Aura is actually rendering,
  # even before a duplicate exists in the persisted theme list. Resolve its
  # unchanged mark through the validated source theme while taking material
  # values from the last-valid draft.
  if ($editorActive -and $editorSourceId -is [string] -and
      $editorSourceId -cmatch '^[a-z][a-z0-9-]{1,39}$') {
    $themeName = $editorSourceId
  }
  $theme = Get-AuraUiThemeByName -Name $themeName
  $raw = if ($null -ne $theme) { Get-AuraUiPropertyValue -InputObject $theme -Names @('launcher') } else { $null }
  if ($editorActive) {
    $draftLauncher = Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('launcherStyle')
    if ($null -ne $draftLauncher) { $raw = $draftLauncher }
  }
  if ($null -eq $raw) { $raw = $fallback }
  $studioStyle = if ($editorActive) {
    Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('studioStyle')
  } elseif ($null -ne $theme) {
    Get-AuraUiPropertyValue -InputObject $theme -Names @('studioStyle')
  } else { $null }
  $raw = Resolve-AuraUiLauncherModeMaterial -Raw $raw -StudioStyle $studioStyle `
    -Dark (Test-AuraUiDarkChrome)
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
  $editorLocalMark = $editorActive -and "$asset" -ceq 'launcher-mark.png' -and
    $editorId -is [string] -and $editorId -cmatch '^[a-z][a-z0-9-]{1,39}$' -and
    $editorLauncherPreviewUrl -is [string] -and
    $editorLauncherPreviewUrl -cmatch '^https://aura\.editor/active/launcher-[a-f0-9]{64}\.png$'
  $style.source = if ($editorLocalMark) {
    'editor'
  } elseif ($editorActive -and "$asset" -ceq 'launcher-mark.png' -and "$editorSource" -ceq 'user') {
    'user'
  } elseif ($null -ne $theme) { "$($theme.source)" } else { 'builtin' }
  $style.theme = if ($editorLocalMark) { "$editorId" } else { "$themeName" }
  if ($editorLocalMark) { $style.editorPreviewUrl = "$editorLauncherPreviewUrl" }
  return [PSCustomObject]$style
}

function Get-AuraUiLauncherAssetPath {
  param([Parameter(Mandatory = $true)][object]$Style)
  $relative = "$($Style.asset)".Replace('/', [IO.Path]::DirectorySeparatorChar)
  try {
    $allowedRoot = $null
    $expectedEditorDigest = $null
    if ("$($Style.asset)" -cmatch '^assets/theme-art/[a-z][a-z0-9-]{1,39}/launcher-mark\.png$') {
      $rootPath = [IO.Path]::GetFullPath($ThemeArtRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)
      $candidate = [IO.Path]::GetFullPath((Join-Path $Root $relative))
      if (-not $candidate.StartsWith($rootPath + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        return $null
      }
      $allowedRoot = $rootPath
    } elseif ("$($Style.asset)" -ceq 'launcher-mark.png' -and "$($Style.source)" -ceq 'user') {
      $themeRoot = [IO.Path]::GetFullPath((Join-Path $UserThemesRoot "$($Style.theme)"))
      $candidate = [IO.Path]::GetFullPath((Join-Path $themeRoot 'launcher-mark.png'))
      if (-not $candidate.StartsWith($themeRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        return $null
      }
      $allowedRoot = [IO.Path]::GetFullPath($UserThemesRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)
    } elseif ("$($Style.asset)" -ceq 'launcher-mark.png' -and "$($Style.source)" -ceq 'editor' -and
        "$($Style.editorPreviewUrl)" -cmatch '^https://aura\.editor/active/(?<file>launcher-(?<digest>[a-f0-9]{64})\.png)$') {
      $expectedEditorDigest = "$($Matches['digest'])"
      $allowedRoot = [IO.Path]::GetFullPath($StudioEditorPreviewRoot).TrimEnd(
        [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
      $candidate = [IO.Path]::GetFullPath((Join-Path (Join-Path $allowedRoot 'active') $Matches['file']))
      if (-not $candidate.StartsWith($allowedRoot + [IO.Path]::DirectorySeparatorChar,
          [StringComparison]::OrdinalIgnoreCase)) { return $null }
    } else {
      return $null
    }
    if (-not (Test-AuraUiIdentityFileWithinRoot -Path $candidate -AllowedRoot $allowedRoot)) { return $null }
    if ($expectedEditorDigest) {
      $stream = $null
      $sha256 = $null
      try {
        $stream = [IO.File]::Open($candidate, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
        $sha256 = [Security.Cryptography.SHA256]::Create()
        $actualDigest = ([BitConverter]::ToString($sha256.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
        if (-not [string]::Equals($actualDigest, $expectedEditorDigest, [StringComparison]::Ordinal)) {
          return $null
        }
      } finally {
        if ($null -ne $sha256) { $sha256.Dispose() }
        if ($null -ne $stream) { $stream.Dispose() }
      }
    }
    return $candidate
  } catch { return $null }
}

function Test-AuraUiIdentityFileWithinRoot {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$AllowedRoot
  )
  try {
    $rootFull = [IO.Path]::GetFullPath($AllowedRoot).TrimEnd(
      [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    $candidateFull = [IO.Path]::GetFullPath($Path)
    if (-not $candidateFull.StartsWith($rootFull + [IO.Path]::DirectorySeparatorChar,
        [StringComparison]::OrdinalIgnoreCase) -or
        -not (Test-Path -LiteralPath $candidateFull -PathType Leaf)) {
      return $false
    }
    $cursor = $candidateFull
    while ($true) {
      $item = Get-Item -LiteralPath $cursor -Force
      if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { return $false }
      if ([string]::Equals($cursor.TrimEnd(
            [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar),
          $rootFull, [StringComparison]::OrdinalIgnoreCase)) {
        return $true
      }
      $parent = Split-Path $cursor -Parent
      if (-not $parent) { return $false }
      $cursor = [IO.Path]::GetFullPath($parent).TrimEnd(
        [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
      if (-not [string]::Equals($cursor, $rootFull, [StringComparison]::OrdinalIgnoreCase) -and
          -not $cursor.StartsWith($rootFull + [IO.Path]::DirectorySeparatorChar,
            [StringComparison]::OrdinalIgnoreCase)) {
        return $false
      }
    }
  } catch { return $false }
}

function Remove-AuraUiUnusedShortcutIcons {
  param([AllowNull()][string]$KeepPath)
  try {
    $rootFull = [IO.Path]::GetFullPath($ShortcutIconRoot).TrimEnd(
      [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    if (-not (Test-Path -LiteralPath $rootFull -PathType Container)) { return }
    $rootItem = Get-Item -LiteralPath $rootFull -Force
    if (($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { return }
    $keepFull = if ($KeepPath) { [IO.Path]::GetFullPath($KeepPath) } else { $null }
    foreach ($candidate in [IO.Directory]::EnumerateFiles(
        $rootFull, '*.ico', [IO.SearchOption]::TopDirectoryOnly)) {
      $candidateFull = [IO.Path]::GetFullPath($candidate)
      if ($keepFull -and [string]::Equals($candidateFull, $keepFull,
          [StringComparison]::OrdinalIgnoreCase)) { continue }
      if ([IO.Path]::GetFileName($candidateFull) -cnotmatch '^[a-z][a-z0-9-]{1,39}-[a-f0-9]{16}\.ico$') {
        continue
      }
      if (Test-AuraUiIdentityFileWithinRoot -Path $candidateFull -AllowedRoot $rootFull) {
        [IO.File]::Delete($candidateFull)
      }
    }
  } catch {
    Write-AuraUiLog -Message "Unused theme identity cleanup failed: $($_.Exception.Message)"
  }
}

function Get-AuraUiBuiltInLauncherThemeId {
  param([Parameter(Mandatory = $true)][object]$Style)
  $asset = "$($Style.asset)"
  if ($asset -cnotmatch '^assets/theme-art/(?<theme>[a-z][a-z0-9-]{1,39})/launcher-mark\.png$') { return $null }
  $themeId = $Matches['theme']
  $theme = Get-AuraUiThemeByName -Name $themeId
  if ($null -eq $theme -or "$($theme.source)" -cne 'builtin' -or
      -not [string]::Equals("$($theme.name)", $themeId, [StringComparison]::Ordinal)) { return $null }
  $launcher = Get-AuraUiPropertyValue -InputObject $theme -Names @('launcher')
  $registeredAsset = Get-AuraUiPropertyValue -InputObject $launcher -Names @('asset')
  if (-not [string]::Equals([string]$registeredAsset, $asset, [StringComparison]::Ordinal)) { return $null }
  return $themeId
}

function Get-AuraUiBuiltInThemeIconPath {
  param([Parameter(Mandatory = $true)][object]$Style)
  $themeId = Get-AuraUiBuiltInLauncherThemeId -Style $Style
  if (-not $themeId) { return $null }
  $candidate = [IO.Path]::GetFullPath((Join-Path $ThemeArtRoot "$themeId\launcher-mark.ico"))
  if (-not (Test-AuraUiIdentityFileWithinRoot -Path $candidate -AllowedRoot $ThemeArtRoot) -or
      -not (Test-AuraUiWindowsIcon -Path $candidate)) { return $null }
  return $candidate
}

function New-AuraUiCustomShortcutIcon {
  param(
    [Parameter(Mandatory = $true)][object]$Style,
    [Parameter(Mandatory = $true)][string]$LauncherAssetPath,
    [Parameter(Mandatory = $true)][byte[]]$LauncherAssetBytes,
    [Parameter(Mandatory = $true)][byte[]]$ExpectedIconBytes
  )
  if ("$($Style.source)" -cnotin @('user', 'editor') -or "$($Style.asset)" -cne 'launcher-mark.png' -or
      "$($Style.theme)" -cnotmatch '^[a-z][a-z0-9-]{1,39}$' -or
      -not (Test-Path -LiteralPath $LauncherAssetPath -PathType Leaf)) {
    return $null
  }

  $temporary = $null
  $output = $null
  try {
    $auraDataParent = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'ClaudeAura')).TrimEnd(
      [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    $dataRootFull = [IO.Path]::GetFullPath($DataRoot).TrimEnd(
      [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    if (-not [string]::Equals($dataRootFull, (Join-Path $auraDataParent 'data'),
        [StringComparison]::OrdinalIgnoreCase) -or
        -not (Test-Path -LiteralPath $auraDataParent -PathType Container) -or
        -not (Test-Path -LiteralPath $dataRootFull -PathType Container)) {
      return $null
    }
    $auraDataParentItem = Get-Item -LiteralPath $auraDataParent -Force
    $dataRootItem = Get-Item -LiteralPath $dataRootFull -Force
    if (($auraDataParentItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        ($dataRootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { return $null }
    $iconRootFull = [IO.Path]::GetFullPath($ShortcutIconRoot).TrimEnd(
      [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    if (-not $iconRootFull.StartsWith($dataRootFull + [IO.Path]::DirectorySeparatorChar,
        [StringComparison]::OrdinalIgnoreCase)) {
      return $null
    }
    [void][IO.Directory]::CreateDirectory($iconRootFull)
    $iconRootItem = Get-Item -LiteralPath $iconRootFull -Force
    if (($iconRootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { return $null }

    $sha256 = $null
    try {
      $sha256 = [Security.Cryptography.SHA256]::Create()
      $digest = ([BitConverter]::ToString($sha256.ComputeHash($LauncherAssetBytes))).Replace('-', '').ToLowerInvariant()
    } finally {
      if ($null -ne $sha256) { $sha256.Dispose() }
    }
    $target = [IO.Path]::GetFullPath((Join-Path $iconRootFull ("{0}-{1}.ico" -f "$($Style.theme)", $digest.Substring(0, 16))))
    if (-not $target.StartsWith($iconRootFull + [IO.Path]::DirectorySeparatorChar,
        [StringComparison]::OrdinalIgnoreCase)) {
      return $null
    }
    if (Test-Path -LiteralPath $target -PathType Leaf) {
      $existingBytes = [IO.File]::ReadAllBytes($target)
      $sameBytes = $existingBytes.Length -eq $ExpectedIconBytes.Length
      for ($index = 0; $sameBytes -and $index -lt $existingBytes.Length; $index++) {
        if ($existingBytes[$index] -ne $ExpectedIconBytes[$index]) { $sameBytes = $false }
      }
      if ($sameBytes -and
          (Test-AuraUiIdentityFileWithinRoot -Path $target -AllowedRoot $iconRootFull) -and
          (Test-AuraUiWindowsIcon -Path $target)) { return $target }
      [IO.File]::Delete($target)
    }

    $temporary = Join-Path $iconRootFull ('.identity-{0}.tmp' -f [Guid]::NewGuid().ToString('N'))
    $output = [IO.File]::Open($temporary, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    $output.Write($ExpectedIconBytes, 0, $ExpectedIconBytes.Length)
    $output.Flush($true)
    $output.Dispose()
    $output = $null
    if (-not (Test-AuraUiWindowsIcon -Path $temporary)) {
      throw 'The generated custom shortcut icon is invalid.'
    }
    [IO.File]::Move($temporary, $target)
    $temporary = $null
    if (-not (Test-AuraUiIdentityFileWithinRoot -Path $target -AllowedRoot $iconRootFull) -or
        -not (Test-AuraUiWindowsIcon -Path $target)) { return $null }
    return $target
  } catch {
    Write-AuraUiLog -Message "Custom shortcut icon could not be generated: $($_.Exception.Message)"
    return $null
  } finally {
    if ($null -ne $output) { $output.Dispose() }
    if ($temporary -and (Test-Path -LiteralPath $temporary -PathType Leaf)) {
      try { [IO.File]::Delete($temporary) } catch {}
    }
  }
}

function Get-AuraUiShortcutIconPath {
  param(
    [Parameter(Mandatory = $true)][object]$Style,
    [AllowNull()][string]$IdentityAssetPath,
    [AllowNull()][string]$LauncherAssetPath,
    [AllowNull()][byte[]]$LauncherAssetBytes,
    [AllowNull()][byte[]]$ExpectedIconBytes
  )
  if ((Get-AuraUiBuiltInLauncherThemeId -Style $Style) -and $IdentityAssetPath -and
      [string]::Equals([IO.Path]::GetExtension($IdentityAssetPath), '.ico', [StringComparison]::OrdinalIgnoreCase)) {
    return $IdentityAssetPath
  }
  if ("$($Style.source)" -cin @('user', 'editor') -and "$($Style.asset)" -ceq 'launcher-mark.png' -and
      $LauncherAssetPath -and $null -ne $LauncherAssetBytes -and $null -ne $ExpectedIconBytes) {
    $customIcon = New-AuraUiCustomShortcutIcon -Style $Style -LauncherAssetPath $LauncherAssetPath `
      -LauncherAssetBytes $LauncherAssetBytes -ExpectedIconBytes $ExpectedIconBytes
    if ($customIcon) { return $customIcon }
  }
  return $null
}

function Test-AuraUiOwnedShortcutIconPath {
  param([Parameter(Mandatory = $true)][string]$Path)
  try {
    $candidate = [IO.Path]::GetFullPath($Path)
    $themeRoot = [IO.Path]::GetFullPath($ThemeArtRoot).TrimEnd(
      [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    if ($candidate.StartsWith($themeRoot + [IO.Path]::DirectorySeparatorChar,
        [StringComparison]::OrdinalIgnoreCase)) {
      $relative = $candidate.Substring($themeRoot.Length + 1).Replace('\', '/')
      return $relative -cmatch '^[a-z][a-z0-9-]{1,39}/launcher-mark\.ico$' -and
        (Test-AuraUiIdentityFileWithinRoot -Path $candidate -AllowedRoot $themeRoot) -and
        (Test-AuraUiWindowsIcon -Path $candidate)
    }
    $customRoot = [IO.Path]::GetFullPath($ShortcutIconRoot).TrimEnd(
      [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    if ($candidate.StartsWith($customRoot + [IO.Path]::DirectorySeparatorChar,
        [StringComparison]::OrdinalIgnoreCase)) {
      return [IO.Path]::GetFileName($candidate) -cmatch '^[a-z][a-z0-9-]{1,39}-[a-f0-9]{16}\.ico$' -and
        (Test-AuraUiIdentityFileWithinRoot -Path $candidate -AllowedRoot $customRoot) -and
        (Test-AuraUiWindowsIcon -Path $candidate)
    }
    return [string]::Equals($candidate, [IO.Path]::GetFullPath($AuraIconPath),
        [StringComparison]::OrdinalIgnoreCase) -and
      (Test-AuraUiIdentityFileWithinRoot -Path $candidate -AllowedRoot (Join-Path $Root 'assets\brand')) -and
      (Test-AuraUiWindowsIcon -Path $candidate)
  } catch { return $false }
}

function Test-AuraUiOwnedShortcutTarget {
  param(
    [Parameter(Mandatory = $true)][object]$Shortcut,
    [Parameter(Mandatory = $true)][string]$ExpectedPowerShell,
    [Parameter(Mandatory = $true)][string]$ExpectedScript,
    [Parameter(Mandatory = $true)][string]$ExpectedArguments
  )
  try {
    if (-not [string]::Equals([IO.Path]::GetFullPath("$($Shortcut.TargetPath)"), $ExpectedPowerShell,
        [StringComparison]::OrdinalIgnoreCase) -or
        -not [string]::Equals("$($Shortcut.Arguments)", $ExpectedArguments, [StringComparison]::Ordinal)) {
      return $false
    }
    $fileMatch = [regex]::Match("$($Shortcut.Arguments)",
      '(?i)(?:^|\s)-File\s+"(?<script>[^"]+)"(?:\s|$)')
    return $fileMatch.Success -and
      [string]::Equals([IO.Path]::GetFullPath($fileMatch.Groups['script'].Value), $ExpectedScript,
        [StringComparison]::OrdinalIgnoreCase)
  } catch { return $false }
}

function Update-AuraUiOwnedShortcuts {
  param([AllowNull()][string]$IconPath)
  if (-not $IconPath -or -not ('AuraWindow' -as [type]) -or
      -not (Test-AuraUiOwnedShortcutIconPath -Path $IconPath)) {
    return $null
  }
  try {
    $installedScript = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'ClaudeAura\app\windows\aura-ui.ps1'))
    $currentScript = [IO.Path]::GetFullPath($PSCommandPath)
    if (-not [string]::Equals($currentScript, $installedScript, [StringComparison]::OrdinalIgnoreCase)) {
      return [PSCustomObject]@{ Success = $true; Managed = $false; Changes = @() }
    }
    $powershell = [IO.Path]::GetFullPath((Get-Command powershell.exe -ErrorAction Stop).Source)
    $baseArguments = "-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$installedScript`""
    $desktop = [Environment]::GetFolderPath('Desktop')
    $menuRoot = Join-Path ([Environment]::GetFolderPath('Programs')) 'Claude Aura'
    # This explicit allowlist is the complete mutation surface: two app-owned
    # names in each of the two installer-owned locations.
    $ownedShortcuts = @(
      [PSCustomObject]@{ Path = (Join-Path $desktop 'Claude Aura.lnk'); Arguments = $baseArguments },
      [PSCustomObject]@{ Path = (Join-Path $desktop 'Claude Aura Studio.lnk'); Arguments = "$baseArguments -OpenStudio" },
      [PSCustomObject]@{ Path = (Join-Path $menuRoot 'Claude Aura.lnk'); Arguments = $baseArguments },
      [PSCustomObject]@{ Path = (Join-Path $menuRoot 'Claude Aura Studio.lnk'); Arguments = "$baseArguments -OpenStudio" }
    )
    $present = @($ownedShortcuts | Where-Object { Test-Path -LiteralPath $_.Path -PathType Leaf })
    if ($present.Count -eq 0) {
      return [PSCustomObject]@{ Success = $true; Managed = $false; Changes = @() }
    }
    if ($present.Count -ne $ownedShortcuts.Count) {
      Write-AuraUiLog -Message 'Owned shortcut identity was not changed because only part of the four-shortcut set exists.'
      return $null
    }

    $shell = New-Object -ComObject WScript.Shell
    $validated = [Collections.Generic.List[object]]::new()
    $changed = [Collections.Generic.List[object]]::new()
    try {
      foreach ($owned in $ownedShortcuts) {
        $item = Get-Item -LiteralPath $owned.Path -Force
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
          throw "Owned shortcut is redirected: $($owned.Path)"
        }
        $shortcut = $null
        try {
          $shortcut = $shell.CreateShortcut($owned.Path)
          if (-not (Test-AuraUiOwnedShortcutTarget -Shortcut $shortcut -ExpectedPowerShell $powershell `
              -ExpectedScript $installedScript -ExpectedArguments $owned.Arguments)) {
            throw "Owned shortcut target does not match the installed Aura host: $($owned.Path)"
          }
          $validated.Add([PSCustomObject]@{
            Path = $owned.Path
            Arguments = $owned.Arguments
            PreviousIcon = "$($shortcut.IconLocation)"
          })
        } finally {
          if ($null -ne $shortcut -and [Runtime.InteropServices.Marshal]::IsComObject($shortcut)) {
            try { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shortcut) } catch {}
          }
        }
      }

      $nextIconLocation = "$IconPath,0"
      foreach ($entry in $validated) {
        if ([string]::Equals($entry.PreviousIcon, $nextIconLocation, [StringComparison]::OrdinalIgnoreCase)) {
          continue
        }
        $shortcut = $null
        try {
          $shortcut = $shell.CreateShortcut($entry.Path)
          $shortcut.IconLocation = $nextIconLocation
          $shortcut.Save()
          $changed.Add($entry)
        } catch {
          # Save can write a .lnk and still report an error. Restore the complete
          # prevalidated snapshot, including the in-flight entry, rather than
          # trusting only calls that returned normally.
          $rollbackComplete = $true
          for ($rollbackIndex = $validated.Count - 1; $rollbackIndex -ge 0; $rollbackIndex--) {
            $rollback = $null
            try {
              $rollback = $shell.CreateShortcut($validated[$rollbackIndex].Path)
              $rollback.IconLocation = $validated[$rollbackIndex].PreviousIcon
              $rollback.Save()
            } catch {
              $rollbackComplete = $false
              Write-AuraUiLog -Message "Owned shortcut rollback failed for $($validated[$rollbackIndex].Path): $($_.Exception.Message)"
            } finally {
              if ($null -ne $rollback -and [Runtime.InteropServices.Marshal]::IsComObject($rollback)) {
                try { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($rollback) } catch {}
              }
            }
          }
          if (-not $rollbackComplete) {
            return [PSCustomObject]@{
              Success = $false
              Managed = $true
              Changes = @($validated)
              RollbackIncomplete = $true
            }
          }
          throw
        } finally {
          if ($null -ne $shortcut -and [Runtime.InteropServices.Marshal]::IsComObject($shortcut)) {
            try { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shortcut) } catch {}
          }
        }
      }
    } finally {
      if ($null -ne $shell -and [Runtime.InteropServices.Marshal]::IsComObject($shell)) {
        try { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell) } catch {}
      }
    }
    foreach ($entry in $changed) {
      [AuraWindow]::SHChangeNotify(0x00002000, 0x0005, $entry.Path, $null)
    }
    if ($changed.Count -gt 0) {
      [AuraWindow]::SHChangeNotify(0x08000000, 0x0000, $null, $null)
    }
    return [PSCustomObject]@{ Success = $true; Managed = $true; Changes = @($changed) }
  } catch {
    Write-AuraUiLog -Message "Owned shortcut icons could not be refreshed: $($_.Exception.Message)"
    return $null
  }
}

function Restore-AuraUiOwnedShortcuts {
  param([AllowNull()][object]$Snapshot)
  if ($null -eq $Snapshot -or -not $Snapshot.Managed -or @($Snapshot.Changes).Count -eq 0) { return $true }
  $shell = $null
  $restored = $true
  try {
    $shell = New-Object -ComObject WScript.Shell
    foreach ($entry in @($Snapshot.Changes)) {
      $shortcut = $null
      try {
        $shortcut = $shell.CreateShortcut($entry.Path)
        $shortcut.IconLocation = $entry.PreviousIcon
        $shortcut.Save()
        [AuraWindow]::SHChangeNotify(0x00002000, 0x0005, $entry.Path, $null)
      } catch {
        $restored = $false
        Write-AuraUiLog -Message "Owned shortcut rollback failed for $($entry.Path): $($_.Exception.Message)"
      } finally {
        if ($null -ne $shortcut -and [Runtime.InteropServices.Marshal]::IsComObject($shortcut)) {
          try { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shortcut) } catch {}
        }
      }
    }
    [AuraWindow]::SHChangeNotify(0x08000000, 0x0000, $null, $null)
  } catch {
    $restored = $false
    Write-AuraUiLog -Message "Owned shortcut rollback could not start: $($_.Exception.Message)"
  } finally {
    if ($null -ne $shell -and [Runtime.InteropServices.Marshal]::IsComObject($shell)) {
      try { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell) } catch {}
    }
  }
  return $restored
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

function Get-AuraUiIdentityDigest {
  param([Parameter(Mandatory = $true)][string]$Path)
  $stream = $null
  $sha256 = $null
  try {
    $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    $sha256 = [Security.Cryptography.SHA256]::Create()
    return ([BitConverter]::ToString($sha256.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
  } finally {
    if ($null -ne $sha256) { $sha256.Dispose() }
    if ($null -ne $stream) { $stream.Dispose() }
  }
}

function Get-AuraUiWindowDpi {
  param([AllowNull()][System.Windows.Forms.Form]$Form)
  try {
    if ($null -ne $Form -and -not $Form.IsDisposed) {
      $dpi = [int][AuraWindow]::GetDpiForWindow($Form.Handle)
      if ($dpi -ge 96 -and $dpi -le 768) { return $dpi }
    }
  } catch {}
  try {
    $dpi = [int][AuraWindow]::GetDpiForSystem()
    if ($dpi -ge 96 -and $dpi -le 768) { return $dpi }
  } catch {}
  return 96
}

function Get-AuraUiSystemIconDimensions {
  param([Parameter(Mandatory = $true)][int]$Dpi, [switch]$Small)
  $widthMetric = if ($Small) { 49 } else { 11 } # SM_CXSMICON / SM_CXICON
  $heightMetric = if ($Small) { 50 } else { 12 } # SM_CYSMICON / SM_CYICON
  try {
    $width = [int][AuraWindow]::GetSystemMetricsForDpi($widthMetric, [uint32]$Dpi)
    $height = [int][AuraWindow]::GetSystemMetricsForDpi($heightMetric, [uint32]$Dpi)
    if ($width -ge 8 -and $width -le 512 -and $height -ge 8 -and $height -le 512) {
      return [PSCustomObject]@{ Width = $width; Height = $height }
    }
  } catch {}
  $baseSize = if ($Small) { 16 } else { 32 }
  $fallback = [int][Math]::Max(8, [Math]::Round($baseSize * $Dpi / 96))
  return [PSCustomObject]@{ Width = $fallback; Height = $fallback }
}

function New-AuraUiNativeIconHandle {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][int]$Width,
    [Parameter(Mandatory = $true)][int]$Height
  )
  if ($Width -lt 8 -or $Width -gt 512 -or $Height -lt 8 -or $Height -gt 512) {
    throw 'The requested native icon size is outside the safe range.'
  }
  $handle = [AuraWindow]::LoadImageW(
    [IntPtr]::Zero, [IO.Path]::GetFullPath($Path), 1, $Width, $Height, 0x00000010)
  if ($handle -eq [IntPtr]::Zero) {
    throw [ComponentModel.Win32Exception]::new(
      [Runtime.InteropServices.Marshal]::GetLastWin32Error(),
      "Windows could not load the ${Width}x${Height} identity frame.")
  }
  return $handle
}

function New-AuraUiNativeFormIconPair {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][int]$Dpi
  )
  $small = [IntPtr]::Zero
  $large = [IntPtr]::Zero
  try {
    $smallSize = Get-AuraUiSystemIconDimensions -Dpi $Dpi -Small
    $largeSize = Get-AuraUiSystemIconDimensions -Dpi $Dpi
    $small = New-AuraUiNativeIconHandle -Path $Path -Width $smallSize.Width -Height $smallSize.Height
    $large = New-AuraUiNativeIconHandle -Path $Path -Width $largeSize.Width -Height $largeSize.Height
    return [PSCustomObject]@{ Small = $small; Large = $large; Dpi = $Dpi }
  } catch {
    foreach ($handle in @($small, $large)) {
      if ($handle -ne [IntPtr]::Zero) { try { [void][AuraWindow]::DestroyIcon($handle) } catch {} }
    }
    throw
  }
}

function Dispose-AuraUiNativeFormIconPair {
  param([AllowNull()][object]$Pair)
  if ($null -eq $Pair) { return }
  foreach ($handle in @($Pair.Small, $Pair.Large)) {
    if ($null -ne $handle -and $handle -ne [IntPtr]::Zero) {
      try { [void][AuraWindow]::DestroyIcon($handle) } catch {}
    }
  }
}

function Set-AuraUiNativeFormIcons {
  param(
    [Parameter(Mandatory = $true)][System.Windows.Forms.Form]$Form,
    [AllowNull()][IntPtr]$Small = [IntPtr]::Zero,
    [AllowNull()][IntPtr]$Large = [IntPtr]::Zero
  )
  if ($Form.IsDisposed) { throw 'The identity target window has been disposed.' }
  $handle = $Form.Handle
  [void][AuraWindow]::SendMessage($handle, 0x0080, [IntPtr]::Zero, $Small) # WM_SETICON / ICON_SMALL
  [void][AuraWindow]::SendMessage($handle, 0x0080, [IntPtr]::new(1), $Large) # WM_SETICON / ICON_BIG
}

function New-AuraUiNotificationIcon {
  param([Parameter(Mandatory = $true)][string]$Path)
  $native = [IntPtr]::Zero
  $borrowed = $null
  try {
    $dpi = Get-AuraUiWindowDpi
    $size = Get-AuraUiSystemIconDimensions -Dpi $dpi -Small
    # NotifyIcon has no per-monitor DPI callback. Keep a 64 px native source so
    # Windows can downsample it crisply on notification areas through 400%.
    $width = [Math]::Max(64, $size.Width)
    $height = [Math]::Max(64, $size.Height)
    $native = New-AuraUiNativeIconHandle -Path $Path -Width $width -Height $height
    $borrowed = [Drawing.Icon]::FromHandle($native)
    return [Drawing.Icon]$borrowed.Clone()
  } finally {
    if ($null -ne $borrowed) { try { $borrowed.Dispose() } catch {} }
    if ($native -ne [IntPtr]::Zero) { try { [void][AuraWindow]::DestroyIcon($native) } catch {} }
  }
}

function New-AuraUiThemeIconSet {
  param([Parameter(Mandatory = $true)][string]$AssetPath)
  if (-not ('AuraWindow' -as [type]) -or -not (Test-AuraUiWindowsIcon -Path $AssetPath)) {
    throw 'The prepared theme identity is not a complete Windows icon.'
  }
  $notification = $null
  $mainNative = $null
  $studioNative = $null
  try {
    $digest = Get-AuraUiIdentityDigest -Path $AssetPath
    $mainDpi = Get-AuraUiWindowDpi -Form $script:Form
    $studioDpi = Get-AuraUiWindowDpi -Form $script:StudioForm
    $mainNative = New-AuraUiNativeFormIconPair -Path $AssetPath -Dpi $mainDpi
    $studioNative = New-AuraUiNativeFormIconPair -Path $AssetPath -Dpi $studioDpi
    $notification = New-AuraUiNotificationIcon -Path $AssetPath
    return [PSCustomObject]@{
      Notification = $notification
      MainNative = $mainNative
      StudioNative = $studioNative
      AssetPath = [IO.Path]::GetFullPath($AssetPath)
      Digest = $digest
    }
  } catch {
    if ($null -ne $notification) { try { $notification.Dispose() } catch {} }
    Dispose-AuraUiNativeFormIconPair -Pair $mainNative
    Dispose-AuraUiNativeFormIconPair -Pair $studioNative
    throw
  }
}

function Dispose-AuraUiThemeIconSet {
  param([AllowNull()][object]$IconSet)
  if ($null -eq $IconSet) { return }
  if ($null -ne $IconSet.Notification) { try { $IconSet.Notification.Dispose() } catch {} }
  Dispose-AuraUiNativeFormIconPair -Pair $IconSet.MainNative
  Dispose-AuraUiNativeFormIconPair -Pair $IconSet.StudioNative
}

function Update-AuraUiNativeIdentityForDpi {
  param(
    [Parameter(Mandatory = $true)][ValidateSet('Main', 'Studio')][string]$Target,
    [Parameter(Mandatory = $true)][System.Windows.Forms.Form]$Form,
    [Parameter(Mandatory = $true)][int]$Dpi
  )
  if (-not $script:ThemeIdentityAssetPath -or -not $script:ThemeIdentityDigest -or
      $null -eq $script:ThemeIdentityLock -or $script:IdentityRollbackIncomplete -or
      $Dpi -lt 96 -or $Dpi -gt 768) { return }
  $next = $null
  try {
    if (-not (Test-AuraUiOwnedShortcutIconPath -Path $script:ThemeIdentityAssetPath) -or
        -not [string]::Equals(
          (Get-AuraUiIdentityDigest -Path $script:ThemeIdentityAssetPath),
          $script:ThemeIdentityDigest, [StringComparison]::Ordinal)) {
      throw 'The locked identity asset no longer matches its committed digest.'
    }
    $next = New-AuraUiNativeFormIconPair -Path $script:ThemeIdentityAssetPath -Dpi $Dpi
    Set-AuraUiNativeFormIcons -Form $Form -Small $next.Small -Large $next.Large
    if ($Target -ceq 'Main') {
      $old = $script:MainWindowIconPair
      $script:MainWindowIconPair = $next
    } else {
      $old = $script:StudioWindowIconPair
      $script:StudioWindowIconPair = $next
    }
    $next = $null
    Dispose-AuraUiNativeFormIconPair -Pair $old
  } catch {
    Write-AuraUiLog -Message "$Target window DPI identity refresh failed: $($_.Exception.Message)"
  } finally {
    Dispose-AuraUiNativeFormIconPair -Pair $next
  }
}

function Get-AuraUiLauncherMetrics {
  param([int]$Dpi = $script:LauncherDpi)
  # The window is the collapsed circular button plus a transparent halo that
  # gives the layered renderer room for its soft shadow and hover growth. The
  # halo derives arithmetically from the compact size so DPI sizing keeps a
  # single logical conversion for the collapsed button.
  $compact = ConvertTo-AuraUiLauncherPixels -Logical $script:LauncherCompactSize -Dpi $Dpi
  $halo = [int][Math]::Max(1, [Math]::Round($compact * ($script:LauncherHaloSize / $script:LauncherCompactSize)))
  return [PSCustomObject]@{ Compact = $compact; Halo = $halo; Client = $compact + (2 * $halo) }
}

function New-AuraUiLauncherRegion {
  if ($null -eq $script:Launcher -or $script:Launcher.IsDisposed) { return $null }
  # Classic fallback shape: the collapsed circular button inset by the halo, so
  # the region path clips the same circle the layered surface would paint.
  $metrics = Get-AuraUiLauncherMetrics
  $bounds = [Drawing.RectangleF]::new($metrics.Halo, $metrics.Halo, $metrics.Compact, $metrics.Compact)
  $path = New-AuraUiRoundedRectanglePath -Bounds $bounds -Radius ([double]$metrics.Compact / 2)
  try { return [Drawing.Region]::new($path) }
  finally { $path.Dispose() }
}

function Update-AuraUiLauncherRegion {
  if ($null -eq $script:Launcher -or $script:Launcher.IsDisposed) { return }
  $nextRegion = New-AuraUiLauncherRegion
  if ($null -eq $nextRegion) { return }
  $oldRegion = $script:Launcher.Region
  $script:Launcher.Region = $nextRegion
  if ($null -ne $oldRegion) { $oldRegion.Dispose() }
}

function ConvertTo-AuraUiBlendedColor {
  param(
    [Parameter(Mandatory = $true)][Drawing.Color]$From,
    [Parameter(Mandatory = $true)][Drawing.Color]$To,
    [Parameter(Mandatory = $true)][double]$Amount
  )
  $mix = [Math]::Min(1.0, [Math]::Max(0.0, $Amount))
  return [Drawing.Color]::FromArgb(
    [int][Math]::Round($From.A + (($To.A - $From.A) * $mix)),
    [int][Math]::Round($From.R + (($To.R - $From.R) * $mix)),
    [int][Math]::Round($From.G + (($To.G - $From.G) * $mix)),
    [int][Math]::Round($From.B + (($To.B - $From.B) * $mix)))
}

function New-AuraUiLauncherSurfaceBitmap {
  param(
    [Parameter(Mandatory = $true)][object]$Style,
    [AllowNull()][object]$Mark,
    [int]$Dpi = $script:LauncherDpi,
    [double]$Hover = 0,
    [bool]$Pressed = $false
  )
  # Renders the complete launcher at device pixels into an ARGB bitmap for
  # UpdateLayeredWindow: soft shadow in the halo, antialiased circle, theme mark,
  # and accent badge. Hover eases the circle slightly outward; a press compresses
  # it. Future launcher states (greeting bubble, companion poses) belong here.
  $bitmap = $null
  $graphics = $null
  try {
    $metrics = Get-AuraUiLauncherMetrics -Dpi $Dpi
    $scale = Get-AuraUiLauncherScale -Dpi $Dpi
    $eased = [Math]::Min(1.0, [Math]::Max(0.0, $Hover))
    $eased = $eased * $eased * (3.0 - (2.0 * $eased))
    $bitmap = [Drawing.Bitmap]::new($metrics.Client, $metrics.Client, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $center = [double]$metrics.Client / 2
    $radius = ([double]$metrics.Compact / 2) * (1.0 + (0.07 * $eased))
    if ($Pressed) { $radius = ([double]$metrics.Compact / 2) * 0.94 }
    # Soft drop shadow: a radial gradient fading to fully transparent, nudged
    # down so the button reads as floating above the page.
    $shadowRadius = $radius + (4.5 * $scale)
    $shadowPath = [Drawing.Drawing2D.GraphicsPath]::new()
    $shadowPath.AddEllipse(
      [float]($center - $shadowRadius), [float]($center - $shadowRadius + (1.5 * $scale)),
      [float]($shadowRadius * 2), [float]($shadowRadius * 2))
    $shadowBrush = [Drawing.Drawing2D.PathGradientBrush]::new($shadowPath)
    $shadowBrush.CenterColor = [Drawing.Color]::FromArgb([int](46 + (22 * $eased)), 0, 0, 0)
    $shadowBrush.SurroundColors = @([Drawing.Color]::FromArgb(0, 0, 0, 0))
    $graphics.FillPath($shadowBrush, $shadowPath)
    $shadowBrush.Dispose()
    $shadowPath.Dispose()
    $surfaceColor = ConvertTo-AuraUiBlendedColor `
      -From ([Drawing.ColorTranslator]::FromHtml("$($Style.surface)")) `
      -To ([Drawing.ColorTranslator]::FromHtml("$($Style.surfaceHover)")) `
      -Amount $eased
    $borderWidth = [Math]::Max(1.0, [double]$Style.borderWidth * $scale)
    $face = [Drawing.RectangleF]::new(
      [float]($center - $radius + ($borderWidth / 2)), [float]($center - $radius + ($borderWidth / 2)),
      [float](($radius * 2) - $borderWidth), [float](($radius * 2) - $borderWidth))
    $fill = [Drawing.SolidBrush]::new($surfaceColor)
    $graphics.FillEllipse($fill, $face)
    $fill.Dispose()
    $rim = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml("$($Style.border)"), [float]$borderWidth)
    $graphics.DrawEllipse($rim, $face)
    $rim.Dispose()
    # The mark keeps the classic 2:3 ratio to the circle and scales with it so
    # hover growth moves the whole composition, not just the rim.
    $markSize = ($radius * 2) * (2.0 / 3.0)
    $markLeft = $center - ($markSize / 2)
    $markTop = $center - ($markSize / 2)
    if ($null -ne $Mark) {
      $graphics.DrawImage($Mark, [Drawing.RectangleF]::new(
        [float]$markLeft, [float]$markTop, [float]$markSize, [float]$markSize))
    } else {
      # Fallback Aura mark: the eight-ray star around an accent core, matching
      # the classic owner-drawn button.
      $markPen = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml("$($Style.foreground)"), [float](2.2 * $scale))
      $markPen.StartCap = [Drawing.Drawing2D.LineCap]::Round
      $markPen.EndCap = [Drawing.Drawing2D.LineCap]::Round
      $innerRay = $radius * (8.5 / 24.0)
      $outerRay = $radius * (13.0 / 24.0)
      for ($index = 0; $index -lt 8; $index++) {
        $angle = (-90 + ($index * 45)) * [Math]::PI / 180
        $graphics.DrawLine($markPen,
          [float]($center + ([Math]::Cos($angle) * $innerRay)), [float]($center + ([Math]::Sin($angle) * $innerRay)),
          [float]($center + ([Math]::Cos($angle) * $outerRay)), [float]($center + ([Math]::Sin($angle) * $outerRay)))
      }
      $markPen.Dispose()
      $coreRadius = $radius * (5.0 / 24.0)
      $core = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml("$($Style.accent)"))
      $graphics.FillEllipse($core,
        [float]($center - $coreRadius), [float]($center - $coreRadius),
        [float]($coreRadius * 2), [float]($coreRadius * 2))
      $core.Dispose()
    }
    if ($null -ne $Mark) {
      # Keep the bounded accent token visible over authored bitmaps so the
      # editor's accent control always has a live effect.
      $badgeRadius = $markSize * 0.078
      $badgeCenter = $center + ($markSize * 0.36)
      $badge = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml("$($Style.accent)"))
      $graphics.FillEllipse($badge,
        [float]($badgeCenter - $badgeRadius), [float]($badgeCenter - $badgeRadius),
        [float]($badgeRadius * 2), [float]($badgeRadius * 2))
      $badge.Dispose()
    }
    $graphics.Dispose()
    $graphics = $null
    return $bitmap
  } catch {
    Write-AuraUiLog -Message "Launcher surface could not be rendered: $($_.Exception.Message)"
    if ($null -ne $graphics) { try { $graphics.Dispose() } catch {} }
    if ($null -ne $bitmap) { try { $bitmap.Dispose() } catch {} }
    return $null
  }
}

function Push-AuraUiLauncherFrame {
  param(
    [Parameter(Mandatory = $true)][Drawing.Bitmap]$Bitmap,
    [byte]$Alpha = 255
  )
  if ($null -eq $script:Launcher -or $script:Launcher.IsDisposed) { return $false }
  try { return [bool][AuraLayered]::Apply($script:Launcher.Handle, $Bitmap, $Alpha) }
  catch {
    Write-AuraUiLog -Message "Launcher frame could not be presented: $($_.Exception.Message)"
    return $false
  }
}

function Disable-AuraUiLauncherLayering {
  # Permanent in-session fallback to the classic region look: clear the
  # per-pixel style (Windows forbids mixing layering modes), restore the legacy
  # translucency, and clip the window back to the circle.
  $script:LauncherLayeredActive = $false
  if ($null -eq $script:Launcher -or $script:Launcher.IsDisposed) { return }
  try { [AuraLayered]::ClearLayeredStyle($script:Launcher.Handle) } catch {}
  try { $script:Launcher.Opacity = 0.96 } catch {}
  Update-AuraUiLauncherRegion
  if ($null -ne $script:LauncherButton -and -not $script:LauncherButton.IsDisposed) {
    $script:LauncherButton.Invalidate()
  }
  Write-AuraUiLog -Message 'Launcher layered rendering is unavailable; using the classic region fallback.'
}

function Update-AuraUiLauncherSurface {
  # Re-present the launcher for the current theme, DPI, and interaction state.
  if ($null -eq $script:Launcher -or $script:Launcher.IsDisposed) { return }
  if (-not $script:LauncherLayeredActive) {
    Update-AuraUiLauncherRegion
    if ($null -ne $script:LauncherButton -and -not $script:LauncherButton.IsDisposed) {
      $script:LauncherButton.Invalidate()
    }
    return
  }
  $style = if ($null -ne $script:LauncherStyle) { $script:LauncherStyle } else { Get-AuraUiLauncherDefaultStyle }
  $hover = $script:LauncherAnimValue
  $bitmap = New-AuraUiLauncherSurfaceBitmap -Style $style -Mark $script:LauncherMark `
    -Hover $hover -Pressed $script:LauncherPressed
  if ($null -eq $bitmap) { return }
  $alpha = [byte][Math]::Min(255, [Math]::Round(245 + (10 * $hover)))
  $presented = Push-AuraUiLauncherFrame -Bitmap $bitmap -Alpha $alpha
  $bitmap.Dispose()
  if (-not $presented) { Disable-AuraUiLauncherLayering }
}

function Start-AuraUiLauncherAnimation {
  # Eases the hover state in and out on a UI timer; each tick re-renders one
  # layered frame. The classic fallback keeps its immediate repaint behavior.
  if (-not $script:LauncherLayeredActive) {
    if ($null -ne $script:Launcher -and -not $script:Launcher.IsDisposed) {
      try { $script:Launcher.Opacity = $(if ($script:LauncherHover) { 1.0 } else { 0.96 }) } catch {}
    }
    if ($null -ne $script:LauncherButton -and -not $script:LauncherButton.IsDisposed) {
      $script:LauncherButton.Invalidate()
    }
    return
  }
  if ($null -ne $script:LauncherAnimTimer -and -not $script:LauncherAnimTimer.Enabled) {
    $script:LauncherAnimTimer.Start()
  }
}

function Resolve-AuraUiLauncherAppearance {
  param(
    [Parameter(Mandatory = $true)][psobject]$Style,
    [AllowNull()][string]$ResolvedAssetPath,
    [AllowNull()][byte[]]$AssetBytes
  )
  # Pure resolver: computes the mark/identity paths and loads the launcher mark
  # bitmap without mutating the launcher, windows, tray, shortcuts, or Jump List.
  $assetPath = if ($ResolvedAssetPath) {
    [IO.Path]::GetFullPath($ResolvedAssetPath)
  } else {
    Get-AuraUiLauncherAssetPath -Style $Style
  }
  $builtInIconPath = Get-AuraUiBuiltInThemeIconPath -Style $Style
  $identityPath = if ($builtInIconPath) {
    $builtInIconPath
  } elseif ("$($Style.source)" -cin @('user', 'editor') -and "$($Style.asset)" -ceq 'launcher-mark.png') {
    $assetPath
  } else { $null }
  $mark = $null
  if ($assetPath) {
    $stream = $null
    $source = $null
    try {
      $stream = if ($null -ne $AssetBytes) {
        [IO.MemoryStream]::new($AssetBytes, $false)
      } else {
        [IO.File]::Open($assetPath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
      }
      $source = [Drawing.Image]::FromStream($stream)
      if ($source.Width -eq 96 -and $source.Height -eq 96) { $mark = [Drawing.Bitmap]::new($source) }
    } catch {
      Write-AuraUiLog -Message "Launcher mark could not be loaded: $($_.Exception.Message)"
    } finally {
      if ($null -ne $source) { $source.Dispose() }
      if ($null -ne $stream) { $stream.Dispose() }
    }
  }
  return [PSCustomObject]@{ Style = $Style; Mark = $mark; AssetPath = $assetPath; IdentityPath = $identityPath }
}

function Get-AuraUiLauncherPreviewUrl {
  param([Parameter(Mandatory = $true)][object]$Style)
  $builtInTheme = Get-AuraUiBuiltInLauncherThemeId -Style $Style
  if ($builtInTheme) { return "https://aura.assets/$builtInTheme/launcher-mark.png" }
  if ("$($Style.source)" -ceq 'user' -and "$($Style.asset)" -ceq 'launcher-mark.png' -and
      "$($Style.theme)" -cmatch '^[a-z][a-z0-9-]{1,39}$') {
    return "https://aura.user-themes/$($Style.theme)/launcher-mark.png"
  }
  if ("$($Style.source)" -ceq 'editor' -and "$($Style.asset)" -ceq 'launcher-mark.png' -and
      "$($Style.editorPreviewUrl)" -cmatch '^https://aura\.editor/active/launcher-[a-f0-9]{64}\.png$') {
    return "$($Style.editorPreviewUrl)"
  }
  return $null
}

function Dispose-AuraUiIdentityCandidate {
  param([AllowNull()][object]$Candidate)
  if ($null -eq $Candidate) { return }
  if ($null -ne $Candidate.Mark) {
    try { $Candidate.Mark.Dispose() } catch {}
    $Candidate.Mark = $null
  }
  if ($null -ne $Candidate.Region) {
    try { $Candidate.Region.Dispose() } catch {}
    $Candidate.Region = $null
  }
  if ($null -ne $Candidate.Surface) {
    try { $Candidate.Surface.Dispose() } catch {}
    $Candidate.Surface = $null
  }
  if ($null -ne $Candidate.IconSet) {
    Dispose-AuraUiThemeIconSet -IconSet $Candidate.IconSet
    $Candidate.IconSet = $null
  }
  foreach ($lockName in @('AssetLock', 'IdentityLock')) {
    $lock = $Candidate.$lockName
    if ($null -ne $lock) {
      try { $lock.Dispose() } catch {}
      $Candidate.$lockName = $null
    }
  }
}

function New-AuraUiIdentityCandidate {
  param([Parameter(Mandatory = $true)][object]$Style)
  $appearance = $null
  $iconSet = $null
  $region = $null
  $surface = $null
  $assetLock = $null
  $identityLock = $null
  try {
    if ($null -eq $script:Launcher -or $script:Launcher.IsDisposed -or
        $null -eq $script:LauncherButton -or $script:LauncherButton.IsDisposed -or
        $null -eq $script:Form -or $script:Form.IsDisposed -or
        $null -eq $script:StudioForm -or $script:StudioForm.IsDisposed -or
        $null -eq $script:TrayIcon) {
      throw 'Aura identity controls are not ready.'
    }
    $assetPath = Get-AuraUiLauncherAssetPath -Style $Style
    if (-not $assetPath) { throw 'The launcher mark path could not be resolved safely.' }
    $assetLock = [IO.File]::Open(
      $assetPath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    $lockedAssetPath = Get-AuraUiLauncherAssetPath -Style $Style
    if (-not $lockedAssetPath -or -not [string]::Equals(
        [IO.Path]::GetFullPath($lockedAssetPath), [IO.Path]::GetFullPath($assetPath),
        [StringComparison]::OrdinalIgnoreCase)) {
      throw 'The locked launcher mark is no longer inside its approved source root.'
    }
    $assetMemory = [IO.MemoryStream]::new()
    try {
      $assetLock.CopyTo($assetMemory)
      $assetBytes = $assetMemory.ToArray()
      $assetLock.Position = 0
    } finally {
      $assetMemory.Dispose()
    }
    $appearance = Resolve-AuraUiLauncherAppearance -Style $Style `
      -ResolvedAssetPath $assetPath -AssetBytes $assetBytes
    if ($null -eq $appearance.Mark -or -not $appearance.AssetPath -or -not $appearance.IdentityPath) {
      throw 'The launcher mark and identity assets could not both be loaded.'
    }
    # A duplicated theme is a user theme that can still carry a built-in mark.
    # Those keep the authored multi-frame ICO, which is deliberately not a
    # re-render of the 96 px PNG, so only a genuinely custom mark is rebuilt.
    $builtInThemeId = Get-AuraUiBuiltInLauncherThemeId -Style $Style
    $expectedIconBytes = if (-not $builtInThemeId -and "$($Style.source)" -cin @('user', 'editor')) {
      New-AuraUiMultiFramePngIconBytes -SourceBytes $assetBytes
    } else { $null }
    $shortcutIconPath = Get-AuraUiShortcutIconPath -Style $Style `
      -IdentityAssetPath $appearance.IdentityPath -LauncherAssetPath $appearance.AssetPath `
      -LauncherAssetBytes $assetBytes -ExpectedIconBytes $expectedIconBytes
    if (-not $shortcutIconPath -or -not (Test-AuraUiOwnedShortcutIconPath -Path $shortcutIconPath)) {
      throw 'The candidate shortcut icon is not an Aura-owned Windows icon.'
    }
    if ($builtInThemeId) {
      if (-not [string]::Equals(
          [IO.Path]::GetFullPath($shortcutIconPath), [IO.Path]::GetFullPath($appearance.IdentityPath),
          [StringComparison]::OrdinalIgnoreCase)) {
        throw 'The built-in launcher and Windows identity do not name the same theme.'
      }
    } elseif ("$($Style.source)" -cin @('user', 'editor')) {
      $customRootFull = [IO.Path]::GetFullPath($ShortcutIconRoot).TrimEnd(
        [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
      $shortcutFull = [IO.Path]::GetFullPath($shortcutIconPath)
      if (-not $shortcutFull.StartsWith(
          $customRootFull + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or
          [IO.Path]::GetFileName($shortcutFull) -cnotmatch ('^{0}-[a-f0-9]{{16}}\.ico$' -f
            [regex]::Escape("$($Style.theme)"))) {
        throw 'The custom Windows identity is not the content-addressed icon for this theme.'
      }
    } else {
      throw 'The launcher identity source is not supported.'
    }

    # Keep the exact ICO snapshot locked against replacement while it backs the
    # running windows. All validation and native-handle creation below reopen it
    # read-only, which remains permitted by this lock.
    $identityLock = [IO.File]::Open(
      $shortcutIconPath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    if (-not (Test-AuraUiOwnedShortcutIconPath -Path $shortcutIconPath)) {
      throw 'The locked candidate shortcut icon is no longer an Aura-owned Windows icon.'
    }
    if ($null -ne $expectedIconBytes) {
      $identityMemory = [IO.MemoryStream]::new()
      try {
        $identityLock.CopyTo($identityMemory)
        $identityBytes = $identityMemory.ToArray()
        $identityLock.Position = 0
      } finally {
        $identityMemory.Dispose()
      }
      $sameBytes = $identityBytes.Length -eq $expectedIconBytes.Length
      for ($index = 0; $sameBytes -and $index -lt $identityBytes.Length; $index++) {
        if ($identityBytes[$index] -ne $expectedIconBytes[$index]) { $sameBytes = $false }
      }
      if (-not $sameBytes) {
        throw 'The custom Windows identity is not derived from the locked launcher-mark snapshot.'
      }
    }

    # Every visible surface consumes the same exact multi-frame ICO. The 96 px
    # PNG remains only the painted launcher/Studio mark.
    $iconSet = New-AuraUiThemeIconSet -AssetPath $shortcutIconPath
    $region = New-AuraUiLauncherRegion
    if ($null -eq $region) { throw 'The launcher region could not be prepared.' }
    # The layered look is validated before commit exactly like the region: a
    # style that cannot render never replaces the running identity.
    $surface = $null
    if ($script:LauncherLayeredActive) {
      $surface = New-AuraUiLauncherSurfaceBitmap -Style $Style -Mark $appearance.Mark
      if ($null -eq $surface) { throw 'The launcher layered surface could not be prepared.' }
    }
    $previewUrl = Get-AuraUiLauncherPreviewUrl -Style $Style
    if (-not $previewUrl) { throw 'The launcher preview URL could not be resolved safely.' }
    $material = [PSCustomObject][ordered]@{
      surface = "$($Style.surface)"
      surfaceHover = "$($Style.surfaceHover)"
      foreground = "$($Style.foreground)"
      accent = "$($Style.accent)"
      border = "$($Style.border)"
      radius = [double]$Style.radius
      borderWidth = [double]$Style.borderWidth
    }
    $candidate = [PSCustomObject]@{
      Style = $Style
      Material = $material
      PreviewUrl = $previewUrl
      Mark = $appearance.Mark
      Region = $region
      Surface = $surface
      IconSet = $iconSet
      ShortcutIconPath = [IO.Path]::GetFullPath($shortcutIconPath)
      AssetLock = $assetLock
      IdentityLock = $identityLock
    }
    $assetLock = $null
    $identityLock = $null
    return $candidate
  } catch {
    if ($null -ne $appearance -and $null -ne $appearance.Mark) {
      try { $appearance.Mark.Dispose() } catch {}
    }
    if ($null -ne $region) { try { $region.Dispose() } catch {} }
    if ($null -ne $surface) { try { $surface.Dispose() } catch {} }
    if ($null -ne $iconSet) { Dispose-AuraUiThemeIconSet -IconSet $iconSet }
    if ($null -ne $identityLock) { try { $identityLock.Dispose() } catch {} }
    if ($null -ne $assetLock) { try { $assetLock.Dispose() } catch {} }
    Write-AuraUiLog -Message "Theme identity candidate could not be prepared: $($_.Exception.Message)"
    return $null
  }
}

function Set-AuraUiIdentityCandidate {
  param([Parameter(Mandatory = $true)][object]$Candidate)
  $script:IdentityRollbackIncomplete = $false
  $old = [PSCustomObject]@{
    LauncherStyle = $script:LauncherStyle
    LauncherMark = $script:LauncherMark
    LauncherRegion = $script:Launcher.Region
    LauncherBackColor = $script:Launcher.BackColor
    ButtonBackColor = $script:LauncherButton.BackColor
    ButtonHoverColor = $script:LauncherButton.FlatAppearance.MouseOverBackColor
    ButtonDownColor = $script:LauncherButton.FlatAppearance.MouseDownBackColor
    NotificationIcon = $script:NotificationIcon
    MainWindowIconPair = $script:MainWindowIconPair
    StudioWindowIconPair = $script:StudioWindowIconPair
    ThemeIdentityAssetPath = $script:ThemeIdentityAssetPath
    ThemeIdentityDigest = $script:ThemeIdentityDigest
    ThemeIdentityLock = $script:ThemeIdentityLock
    ShellIdentityIconPath = $script:ShellIdentityIconPath
    EffectiveLauncherIdentity = $script:EffectiveLauncherIdentity
  }
  try {
    $surface = [Drawing.ColorTranslator]::FromHtml("$($Candidate.Material.surface)")
    $layeredPresented = $false
    if ($script:LauncherLayeredActive) {
      # Present the pre-validated layered frame; the region stays unapplied so
      # the per-pixel alpha keeps defining both the shape and the hit area. If
      # composition is unavailable this machine falls back to the classic
      # region identity instead of failing the whole commit.
      $layeredPresented = Push-AuraUiLauncherFrame -Bitmap $Candidate.Surface -Alpha 245
      if (-not $layeredPresented) { Disable-AuraUiLauncherLayering }
    }
    if (-not $layeredPresented) {
      $interimRegion = $script:Launcher.Region
      $script:Launcher.Region = $Candidate.Region
      if ($null -ne $interimRegion -and -not [object]::ReferenceEquals($interimRegion, $old.LauncherRegion)) {
        try { $interimRegion.Dispose() } catch {}
      }
    }
    $script:Launcher.BackColor = $surface
    $script:LauncherButton.BackColor = $surface
    $script:LauncherButton.FlatAppearance.MouseOverBackColor = $surface
    $script:LauncherButton.FlatAppearance.MouseDownBackColor = $surface
    $script:TrayIcon.Icon = $Candidate.IconSet.Notification
    Set-AuraUiNativeFormIcons -Form $script:Form `
      -Small $Candidate.IconSet.MainNative.Small -Large $Candidate.IconSet.MainNative.Large
    Set-AuraUiNativeFormIcons -Form $script:StudioForm `
      -Small $Candidate.IconSet.StudioNative.Small -Large $Candidate.IconSet.StudioNative.Large

    $script:LauncherStyle = $Candidate.Style
    $script:LauncherMark = $Candidate.Mark
    $script:NotificationIcon = $Candidate.IconSet.Notification
    $script:MainWindowIconPair = $Candidate.IconSet.MainNative
    $script:StudioWindowIconPair = $Candidate.IconSet.StudioNative
    $script:ThemeIdentityAssetPath = $Candidate.IconSet.AssetPath
    $script:ThemeIdentityDigest = $Candidate.IconSet.Digest
    $script:ThemeIdentityLock = $Candidate.IdentityLock
    $script:ShellIdentityIconPath = $Candidate.ShortcutIconPath
    $script:EffectiveLauncherIdentity = [PSCustomObject][ordered]@{
      launcher = $Candidate.Material
      previewUrl = $Candidate.PreviewUrl
    }
  } catch {
    $commitFailure = $_.Exception
    # Restore every independently owned surface even if a preceding restoration
    # fails. When any rollback is incomplete, the coordinator quarantines the
    # entire candidate until process shutdown rather than disposing a resource
    # that a live native control may still reference.
    $script:LauncherStyle = $old.LauncherStyle
    $script:LauncherMark = $old.LauncherMark
    try {
      if ($script:LauncherLayeredActive) {
        # Re-render the restored style/mark; a failure inside falls back to the
        # classic region path on its own.
        Update-AuraUiLauncherSurface
      } else {
        $script:Launcher.Region = $old.LauncherRegion
      }
    } catch {
      $script:IdentityRollbackIncomplete = $true
      Write-AuraUiLog -Message "Theme identity launcher-region rollback failed: $($_.Exception.Message)"
    }
    try {
      $script:Launcher.BackColor = $old.LauncherBackColor
      $script:LauncherButton.BackColor = $old.ButtonBackColor
      $script:LauncherButton.FlatAppearance.MouseOverBackColor = $old.ButtonHoverColor
      $script:LauncherButton.FlatAppearance.MouseDownBackColor = $old.ButtonDownColor
    } catch {
      $script:IdentityRollbackIncomplete = $true
      Write-AuraUiLog -Message "Theme identity launcher-material rollback failed: $($_.Exception.Message)"
    }
    try {
      $script:TrayIcon.Icon = $old.NotificationIcon
    } catch {
      $script:IdentityRollbackIncomplete = $true
      Write-AuraUiLog -Message "Theme identity notification-area rollback failed: $($_.Exception.Message)"
    }
    try {
      if ($null -ne $old.MainWindowIconPair) {
        Set-AuraUiNativeFormIcons -Form $script:Form `
          -Small $old.MainWindowIconPair.Small -Large $old.MainWindowIconPair.Large
      } else {
        Set-AuraUiNativeFormIcons -Form $script:Form
        $script:Form.Icon = $script:MainIcon
      }
    } catch {
      $script:IdentityRollbackIncomplete = $true
      Write-AuraUiLog -Message "Theme identity Aura-window rollback failed: $($_.Exception.Message)"
    }
    try {
      if ($null -ne $old.StudioWindowIconPair) {
        Set-AuraUiNativeFormIcons -Form $script:StudioForm `
          -Small $old.StudioWindowIconPair.Small -Large $old.StudioWindowIconPair.Large
      } else {
        Set-AuraUiNativeFormIcons -Form $script:StudioForm
        $script:StudioForm.Icon = $script:StudioIcon
      }
    } catch {
      $script:IdentityRollbackIncomplete = $true
      Write-AuraUiLog -Message "Theme identity Studio-window rollback failed: $($_.Exception.Message)"
    }
    $script:NotificationIcon = $old.NotificationIcon
    $script:MainWindowIconPair = $old.MainWindowIconPair
    $script:StudioWindowIconPair = $old.StudioWindowIconPair
    $script:ThemeIdentityAssetPath = $old.ThemeIdentityAssetPath
    $script:ThemeIdentityDigest = $old.ThemeIdentityDigest
    $script:ThemeIdentityLock = $old.ThemeIdentityLock
    $script:ShellIdentityIconPath = $old.ShellIdentityIconPath
    $script:EffectiveLauncherIdentity = $old.EffectiveLauncherIdentity
    if ($script:IdentityRollbackIncomplete) {
      Write-AuraUiLog -Message 'Theme identity runtime rollback was incomplete; the candidate is quarantined until shutdown.'
    }
    Write-AuraUiLog -Message "Theme identity runtime commit failed: $($commitFailure.Message)"
    return $false
  }
  $Candidate.Mark = $null
  if ($script:LauncherLayeredActive) {
    # The layered path never applied the region candidate, and the presented
    # frame was copied by Windows, so both stay owned here and are released.
    if ($null -ne $Candidate.Region) { try { $Candidate.Region.Dispose() } catch {} }
  }
  $Candidate.Region = $null
  if ($null -ne $Candidate.Surface) { try { $Candidate.Surface.Dispose() } catch {} }
  $Candidate.Surface = $null
  $Candidate.IconSet = $null
  $Candidate.IdentityLock = $null
  try { $script:LauncherButton.Invalidate() } catch {}
  # A theme change restyles the launcher, so the hover tip and launch hint are
  # rebuilt from the new material the next time they appear.
  Hide-AuraUiLauncherTip
  if ($null -ne $script:LauncherHint -and -not $script:LauncherHint.IsDisposed) {
    try { $script:LauncherHint.Close() } catch {}
  }
  foreach ($resource in @($old.LauncherMark, $old.LauncherRegion, $old.NotificationIcon)) {
    if ($null -ne $resource) { try { $resource.Dispose() } catch {} }
  }
  Dispose-AuraUiNativeFormIconPair -Pair $old.MainWindowIconPair
  Dispose-AuraUiNativeFormIconPair -Pair $old.StudioWindowIconPair
  if ($null -ne $old.ThemeIdentityLock) { try { $old.ThemeIdentityLock.Dispose() } catch {} }
  return $true
}

function Stop-AuraUiAfterIdentityFailure {
  # An incomplete rollback means at least one native surface may no longer match
  # the last complete identity. Hide every product surface immediately and close
  # on the UI queue; continuing to present a mixed identity is never safe.
  $wasVisible = ($null -ne $script:TrayIcon -and $script:TrayIcon.Visible) -or
    ($null -ne $script:Launcher -and -not $script:Launcher.IsDisposed -and $script:Launcher.Visible) -or
    ($null -ne $script:StudioForm -and -not $script:StudioForm.IsDisposed -and $script:StudioForm.Visible) -or
    ($null -ne $script:Form -and -not $script:Form.IsDisposed -and $script:Form.Visible)
  if (-not $wasVisible) { return }
  Write-AuraUiLog -Message 'Claude Aura is closing because its application identity could not be rolled back completely.'
  try { if ($null -ne $script:TrayIcon) { $script:TrayIcon.Visible = $false } } catch {}
  try { if ($null -ne $script:Launcher -and -not $script:Launcher.IsDisposed) { $script:Launcher.Hide() } } catch {}
  try { if ($null -ne $script:StudioForm -and -not $script:StudioForm.IsDisposed) { $script:StudioForm.Hide() } } catch {}
  try { if ($null -ne $script:Form -and -not $script:Form.IsDisposed) { $script:Form.Hide() } } catch {}
  if ($null -eq $script:Form -or $script:Form.IsDisposed) { return }
  try {
    $closeAction = [Action]{
      Request-AuraUiExit
    }
    [void]$script:Form.BeginInvoke($closeAction)
  } catch {
    try { Request-AuraUiExit } catch {}
  }
}

function Update-AuraUiLauncherStyle {
  # The requested identity and one complete Default candidate are the only
  # attempts. A candidate is prepared fully, its four installed shortcuts move
  # transactionally, and only then do the launcher, windows, taskbar, and tray
  # swap together. If both attempts fail, the previous complete identity stays.
  $script:LauncherStyleAppliedAsRequested = $false
  if ($script:IdentityRollbackIncomplete) {
    Write-AuraUiLog -Message 'Theme identity update was refused after an incomplete runtime rollback.'
    return $false
  }
  if ($null -eq $script:Launcher -or $script:Launcher.IsDisposed) { return $false }
  $requestedStyle = Get-AuraUiLauncherStyle
  # The Default candidate is a last resort, but it still has to respect Light and
  # Dark. Its authored material is dark, so an unresolved fallback would paint a
  # dark launcher over a light theme.
  $defaultTheme = Get-AuraUiThemeByName -Name 'default'
  $defaultStyle = Resolve-AuraUiLauncherModeMaterial -Raw (Get-AuraUiLauncherDefaultStyle) `
    -StudioStyle $(if ($null -ne $defaultTheme) {
      Get-AuraUiPropertyValue -InputObject $defaultTheme -Names @('studioStyle')
    } else { $null }) -Dark (Test-AuraUiDarkChrome)
  Add-Member -InputObject $defaultStyle -NotePropertyName source -NotePropertyValue 'builtin' -Force
  Add-Member -InputObject $defaultStyle -NotePropertyName theme -NotePropertyValue 'default' -Force
  $styles = @($requestedStyle, $defaultStyle)

  for ($attempt = 0; $attempt -lt 2; $attempt++) {
    $candidate = New-AuraUiIdentityCandidate -Style $styles[$attempt]
    if ($null -eq $candidate) { continue }
    $shortcutSnapshot = $null
    $runtimeCommitted = $false
    try {
      $shortcutSnapshot = Update-AuraUiOwnedShortcuts -IconPath $candidate.ShortcutIconPath
      if ($null -ne $shortcutSnapshot -and $shortcutSnapshot.RollbackIncomplete -eq $true) {
        $script:IdentityRollbackIncomplete = $true
        if ($null -ne $candidate.AssetLock) {
          try { $candidate.AssetLock.Dispose() } catch {}
          $candidate.AssetLock = $null
        }
        $script:DeferredIdentityCandidates.Add($candidate)
        $candidate = $null
        Stop-AuraUiAfterIdentityFailure
        break
      }
      if ($null -eq $shortcutSnapshot -or $shortcutSnapshot.Success -ne $true) { continue }
      if (-not (Set-AuraUiIdentityCandidate -Candidate $candidate)) {
        $shortcutsRestored = Restore-AuraUiOwnedShortcuts -Snapshot $shortcutSnapshot
        if (-not $shortcutsRestored) {
          $script:IdentityRollbackIncomplete = $true
          Write-AuraUiLog -Message 'Theme identity shortcut rollback was incomplete.'
        }
        if ($script:IdentityRollbackIncomplete) {
          if ($null -ne $candidate.AssetLock) {
            try { $candidate.AssetLock.Dispose() } catch {}
            $candidate.AssetLock = $null
          }
          $script:DeferredIdentityCandidates.Add($candidate)
          $candidate = $null
          Stop-AuraUiAfterIdentityFailure
          break
        }
        continue
      }
      $runtimeCommitted = $true

      $script:LauncherStyleAppliedAsRequested = ($attempt -eq 0)
      $jumpListCurrent = $script:JumpListRegistered -and [string]::Equals(
        $script:JumpListIdentityPath, $script:ShellIdentityIconPath,
        [StringComparison]::OrdinalIgnoreCase)
      if ($script:JumpListRegistered) {
        if (-not $jumpListCurrent) {
          $jumpListCurrent = Register-AuraUiJumpList
          $script:JumpListRegistered = $jumpListCurrent
          if (-not $jumpListCurrent) {
            $script:JumpListRegistrationDue = [DateTime]::UtcNow.AddSeconds(30)
          }
        }
      }
      if ($jumpListCurrent) {
        Remove-AuraUiUnusedShortcutIcons -KeepPath $script:ShellIdentityIconPath
      }
      return $true
    } catch {
      if (-not $runtimeCommitted -and $null -ne $shortcutSnapshot) {
        if (-not (Restore-AuraUiOwnedShortcuts -Snapshot $shortcutSnapshot)) {
          $script:IdentityRollbackIncomplete = $true
        }
      }
      $scope = if ($runtimeCommitted) { 'post-commit shell refresh' } else { 'atomic identity apply' }
      Write-AuraUiLog -Message "Theme $scope failed: $($_.Exception.Message)"
      if ($runtimeCommitted) { return $true }
      if ($script:IdentityRollbackIncomplete -and $null -ne $candidate) {
        if ($null -ne $candidate.AssetLock) {
          try { $candidate.AssetLock.Dispose() } catch {}
          $candidate.AssetLock = $null
        }
        $script:DeferredIdentityCandidates.Add($candidate)
        $candidate = $null
        Stop-AuraUiAfterIdentityFailure
        break
      }
    } finally {
      Dispose-AuraUiIdentityCandidate -Candidate $candidate
    }
  }
  Write-AuraUiLog -Message 'Theme identity remained unchanged because no complete safe identity could be loaded.'
  return $false
}

function Get-AuraUiLauncherScale {
  param([int]$Dpi = $script:LauncherDpi)
  if ($Dpi -lt 96 -or $Dpi -gt 768) { $Dpi = 96 }
  return [double]$Dpi / 96.0
}

function ConvertTo-AuraUiLauncherPixels {
  param([Parameter(Mandatory = $true)][double]$Logical, [int]$Dpi = $script:LauncherDpi)
  return [int][Math]::Max(1, [Math]::Round($Logical * (Get-AuraUiLauncherScale -Dpi $Dpi)))
}

function Update-AuraUiLauncherDpi {
  param([Parameter(Mandatory = $true)][int]$Dpi)
  if ($Dpi -lt 96 -or $Dpi -gt 768 -or $null -eq $script:Launcher -or $script:Launcher.IsDisposed) { return }
  $script:LauncherDpi = $Dpi
  # DPI sizing performs a single logical conversion — the collapsed circular
  # button — and derives the transparent halo arithmetically from it.
  $compactPixels = ConvertTo-AuraUiLauncherPixels -Logical $script:LauncherCompactSize -Dpi $Dpi
  $haloPixels = [int][Math]::Max(1, [Math]::Round($compactPixels * ($script:LauncherHaloSize / $script:LauncherCompactSize)))
  $clientPixels = $compactPixels + (2 * $haloPixels)
  $script:Launcher.ClientSize = [Drawing.Size]::new($clientPixels, $clientPixels)
  if ($null -ne $script:LauncherButton -and -not $script:LauncherButton.IsDisposed) {
    $script:LauncherButton.Bounds = [Drawing.Rectangle]::new($haloPixels, $haloPixels, $compactPixels, $compactPixels)
  }
  Update-AuraUiLauncherSurface
  if ($script:Form -and -not $script:Form.IsDisposed -and $script:Form.Visible) {
    Update-AuraUiLauncherPosition
  }
  if ($script:LauncherButton -and -not $script:LauncherButton.IsDisposed) {
    $script:LauncherButton.Invalidate()
  }
}

function Get-AuraUiLauncherClampedLocation {
  param([Parameter(Mandatory = $true)][Drawing.Point]$Location)
  try {
    $topLeft = $script:Form.PointToScreen([Drawing.Point]::new(0, 0))
    $bottomRight = $script:Form.PointToScreen(
      [Drawing.Point]::new($script:Form.ClientSize.Width, $script:Form.ClientSize.Height))
  } catch { return $Location }
  $gap = ConvertTo-AuraUiLauncherPixels -Logical $script:LauncherSafeGap
  # Clamp the visible circle, not the transparent halo, so the safe inset keeps
  # its classic meaning around the painted button.
  $halo = (Get-AuraUiLauncherMetrics).Halo
  $x = [Math]::Max($topLeft.X + $gap - $halo,
    [Math]::Min($Location.X, $bottomRight.X - $script:Launcher.Width + $halo - $gap))
  $y = [Math]::Max($topLeft.Y + $gap - $halo,
    [Math]::Min($Location.Y, $bottomRight.Y - $script:Launcher.Height + $halo - $gap))
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
    $scale = Get-AuraUiLauncherScale
    # Gaps measure from the visible circle's edge (window edge minus halo) so
    # positions saved before the halo existed keep meaning the same thing.
    $halo = (Get-AuraUiLauncherMetrics).Halo
    $script:LauncherRightGap = [int][Math]::Max(
      $script:LauncherSafeGap,
      [Math]::Round(($bottomRight.X - ($script:Launcher.Location.X + $script:Launcher.Width - $halo)) / $scale))
    $script:LauncherBottomGap = [int][Math]::Max(
      $script:LauncherSafeGap,
      [Math]::Round(($bottomRight.Y - ($script:Launcher.Location.Y + $script:Launcher.Height - $halo)) / $scale))
    $payload = [ordered]@{ right = $script:LauncherRightGap; bottom = $script:LauncherBottomGap } | ConvertTo-Json -Compress
    [System.IO.File]::WriteAllText((Join-Path $DataRoot 'launcher-pos.json'), $payload)
  } catch { Write-AuraUiLog -Message $_.Exception.ToString() }
}

function Update-AuraUiLauncherPosition {
  if ($null -eq $script:Launcher -or $script:Launcher.IsDisposed) { return }
  if ($null -eq $script:Form -or $script:Form.IsDisposed) { return }
  if ($script:Form.WindowState -eq [System.Windows.Forms.FormWindowState]::Minimized -or -not $script:Form.Visible) {
    if ($script:Launcher.Visible) { $script:Launcher.Hide() }
    Hide-AuraUiLauncherTip
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
  $halo = (Get-AuraUiLauncherMetrics).Halo
  $desired = [Drawing.Point]::new(
    $bottomRight.X - $script:Launcher.Width + $halo -
      (ConvertTo-AuraUiLauncherPixels -Logical $script:LauncherRightGap),
    $bottomRight.Y - $script:Launcher.Height + $halo -
      (ConvertTo-AuraUiLauncherPixels -Logical $script:LauncherBottomGap))
  $script:Launcher.Location = Get-AuraUiLauncherClampedLocation -Location $desired
  if (-not $script:Launcher.Visible) {
    if (($null -eq $script:LauncherStyle -or $null -eq $script:EffectiveLauncherIdentity) -and
        -not (Update-AuraUiLauncherStyle)) {
      return
    }
    if ($null -eq $script:LauncherStyle -or $null -eq $script:EffectiveLauncherIdentity) { return }
    $script:Launcher.Show($script:Form)
    # Showing (and owner assignment) rewrites the extended style, which drops
    # the layered bit and its composited frame; present a fresh one.
    if ($script:LauncherLayeredActive) { Update-AuraUiLauncherSurface }
  }
  Update-AuraUiLauncherHintPosition
  Update-AuraUiLauncherTipPosition
}

function New-AuraUiLauncherTipBitmap {
  param(
    [Parameter(Mandatory = $true)][object]$Style,
    [int]$Dpi = $script:LauncherDpi
  )
  # A stylized hover caption for the launcher: theme surface, "Aura Studio"
  # title, and a one-line usage hint. Rendered per-pixel so the rounded card and
  # its shadow composite cleanly over the page like the launcher itself.
  $bitmap = $null
  $graphics = $null
  $titleFont = $null
  $hintFont = $null
  try {
    $scale = Get-AuraUiLauncherScale -Dpi $Dpi
    $titleFont = [Drawing.Font]::new('Segoe UI Semibold', [float](13 * $scale), [Drawing.GraphicsUnit]::Pixel)
    $hintFont = [Drawing.Font]::new('Segoe UI', [float](11 * $scale), [Drawing.GraphicsUnit]::Pixel)
    $title = "$($script:UiCopy.launcherTipTitle)"
    $hint = "$($script:UiCopy.launcherTipHint)"
    $measure = [Drawing.Graphics]::FromImage([Drawing.Bitmap]::new(1, 1))
    $measure.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $titleSize = $measure.MeasureString($title, $titleFont)
    $hintSize = $measure.MeasureString($hint, $hintFont)
    $measure.Dispose()
    $margin = [int][Math]::Ceiling(5 * $scale)
    $padX = 12 * $scale
    $padY = 8 * $scale
    $gap = 2 * $scale
    $cardWidth = [Math]::Max($titleSize.Width, $hintSize.Width) + (2 * $padX)
    $cardHeight = (2 * $padY) + $titleSize.Height + $gap + $hintSize.Height
    $width = [int][Math]::Ceiling($cardWidth) + (2 * $margin)
    $height = [int][Math]::Ceiling($cardHeight) + (2 * $margin)
    $bitmap = [Drawing.Bitmap]::new($width, $height, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $cardRadius = 9 * $scale
    $card = [Drawing.RectangleF]::new($margin, $margin, [float]$cardWidth, [float]$cardHeight)
    for ($inflate = 3; $inflate -ge 1; $inflate--) {
      $shadowRect = [Drawing.RectangleF]::new(
        $card.X - $inflate, ($card.Y - $inflate) + (1.5 * $scale),
        $card.Width + (2 * $inflate), $card.Height + (2 * $inflate))
      $shadowPath = New-AuraUiRoundedRectanglePath -Bounds $shadowRect -Radius ($cardRadius + $inflate)
      $shadowBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb((4 * (4 - $inflate)), 0, 0, 0))
      $graphics.FillPath($shadowBrush, $shadowPath)
      $shadowBrush.Dispose()
      $shadowPath.Dispose()
    }
    $surfaceColor = [Drawing.ColorTranslator]::FromHtml("$($Style.surface)")
    $foregroundColor = [Drawing.ColorTranslator]::FromHtml("$($Style.foreground)")
    $cardPath = New-AuraUiRoundedRectanglePath -Bounds $card -Radius $cardRadius
    $fill = [Drawing.SolidBrush]::new($surfaceColor)
    $graphics.FillPath($fill, $cardPath)
    $fill.Dispose()
    $rim = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml("$($Style.border)"), [float][Math]::Max(1.0, 1 * $scale))
    $graphics.DrawPath($rim, $cardPath)
    $rim.Dispose()
    $cardPath.Dispose()
    $titleBrush = [Drawing.SolidBrush]::new($foregroundColor)
    $graphics.DrawString($title, $titleFont, $titleBrush, [float]($card.X + $padX), [float]($card.Y + $padY))
    $titleBrush.Dispose()
    $hintBrush = [Drawing.SolidBrush]::new((ConvertTo-AuraUiBlendedColor -From $foregroundColor -To $surfaceColor -Amount 0.32))
    $graphics.DrawString($hint, $hintFont, $hintBrush,
      [float]($card.X + $padX), [float]($card.Y + $padY + $titleSize.Height + $gap))
    $hintBrush.Dispose()
    $graphics.Dispose()
    $graphics = $null
    return $bitmap
  } catch {
    Write-AuraUiLog -Message "Launcher tip could not be rendered: $($_.Exception.Message)"
    if ($null -ne $graphics) { try { $graphics.Dispose() } catch {} }
    if ($null -ne $bitmap) { try { $bitmap.Dispose() } catch {} }
    return $null
  } finally {
    if ($null -ne $titleFont) { try { $titleFont.Dispose() } catch {} }
    if ($null -ne $hintFont) { try { $hintFont.Dispose() } catch {} }
  }
}

function Get-AuraUiLauncherPopupLocation {
  param(
    [Parameter(Mandatory = $true)][Drawing.Rectangle]$Anchor,
    [Parameter(Mandatory = $true)][Drawing.Size]$PopupSize,
    [Parameter(Mandatory = $true)][Drawing.Rectangle]$Bounds,
    [Parameter(Mandatory = $true)][int]$Gap
  )
  # Prefer the familiar above/right-aligned placement. Flip at the top or left
  # edge before clamping so a popup keeps moving with its button instead of
  # appearing pinned to the window while the launcher moves underneath it.
  $desiredX = $Anchor.Right - $PopupSize.Width
  if ($desiredX -lt $Bounds.Left) { $desiredX = $Anchor.Left }
  $desiredY = $Anchor.Top - $PopupSize.Height - $Gap
  if ($desiredY -lt $Bounds.Top) { $desiredY = $Anchor.Bottom + $Gap }
  $maximumX = [Math]::Max($Bounds.Left, $Bounds.Right - $PopupSize.Width)
  $maximumY = [Math]::Max($Bounds.Top, $Bounds.Bottom - $PopupSize.Height)
  $desiredX = [Math]::Max($Bounds.Left, [Math]::Min($desiredX, $maximumX))
  $desiredY = [Math]::Max($Bounds.Top, [Math]::Min($desiredY, $maximumY))
  return [Drawing.Point]::new([int]$desiredX, [int]$desiredY)
}

function Update-AuraUiLauncherTipPosition {
  if ($null -eq $script:LauncherTip -or $script:LauncherTip.IsDisposed) { return }
  if ($null -eq $script:Launcher -or $script:Launcher.IsDisposed) { return }
  if ($null -eq $script:Form -or $script:Form.IsDisposed) { return }
  try {
    $metrics = Get-AuraUiLauncherMetrics
    $gap = ConvertTo-AuraUiLauncherPixels -Logical 6
    $anchor = [Drawing.Rectangle]::new(
      $script:Launcher.Location.X + $metrics.Halo,
      $script:Launcher.Location.Y + $metrics.Halo,
      $metrics.Compact,
      $metrics.Compact)
    $topLeft = $script:Form.PointToScreen([Drawing.Point]::new(0, 0))
    $bottomRight = $script:Form.PointToScreen(
      [Drawing.Point]::new($script:Form.ClientSize.Width, $script:Form.ClientSize.Height))
    $bounds = [Drawing.Rectangle]::FromLTRB(
      $topLeft.X, $topLeft.Y, $bottomRight.X, $bottomRight.Y)
    $script:LauncherTip.Location = Get-AuraUiLauncherPopupLocation `
      -Anchor $anchor -PopupSize $script:LauncherTip.Size -Bounds $bounds -Gap $gap
  } catch {}
}

function Show-AuraUiLauncherTip {
  if ($script:LauncherTipDisabled -or $script:LauncherTipVisible -or $script:LauncherDragging) { return }
  if ($null -eq $script:Launcher -or $script:Launcher.IsDisposed -or -not $script:Launcher.Visible) { return }
  $style = if ($null -ne $script:LauncherStyle) { $script:LauncherStyle } else { Get-AuraUiLauncherDefaultStyle }
  $bitmap = New-AuraUiLauncherTipBitmap -Style $style
  if ($null -eq $bitmap) { return }
  try {
    if ($null -eq $script:LauncherTip -or $script:LauncherTip.IsDisposed) {
      $script:LauncherTip = [System.Windows.Forms.Form]::new()
      $script:LauncherTip.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
      $script:LauncherTip.ShowInTaskbar = $false
      $script:LauncherTip.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
      $script:LauncherTip.AutoScaleMode = [System.Windows.Forms.AutoScaleMode]::None
      $script:LauncherTip.Text = 'Claude Aura Studio tip'
      $script:LauncherTip.Owner = $script:Form
    }
    $script:LauncherTip.ClientSize = [Drawing.Size]::new($bitmap.Width, $bitmap.Height)
    # Use one live attachment path for the first frame and every later launcher
    # relocation so the caption cannot be left behind by window or DPI changes.
    Update-AuraUiLauncherTipPosition
    [AuraLayered]::SetTipStyles($script:LauncherTip.Handle)
    # The classic launcher has no running frame animation, so present its tip
    # fully opaque instead of leaving the initial alpha-zero frame invisible.
    $tipInitialAlpha = if ($script:LauncherLayeredActive) { [byte]0 } else { [byte]255 }
    if (-not [AuraLayered]::Apply($script:LauncherTip.Handle, $bitmap, $tipInitialAlpha)) {
      $script:LauncherTipDisabled = $true
      $bitmap.Dispose()
      return
    }
    if ($null -ne $script:LauncherTipBitmap) { try { $script:LauncherTipBitmap.Dispose() } catch {} }
    $script:LauncherTipBitmap = $bitmap
    $bitmap = $null
    $script:LauncherTipAlpha = [int]$tipInitialAlpha
    $script:LauncherTipVisible = $true
    # SW_SHOWNA: visible without stealing activation from Claude's composer.
    [void][AuraWindow]::ShowWindow($script:LauncherTip.Handle, 8)
    if ($script:LauncherLayeredActive -and $null -ne $script:LauncherAnimTimer -and
        -not $script:LauncherAnimTimer.Enabled) {
      $script:LauncherAnimTimer.Start()
    }
  } catch {
    Write-AuraUiLog -Message "Launcher tip could not be shown: $($_.Exception.Message)"
    $script:LauncherTipDisabled = $true
  } finally {
    if ($null -ne $bitmap) { try { $bitmap.Dispose() } catch {} }
  }
}

function Hide-AuraUiLauncherTip {
  if ($null -ne $script:LauncherTipTimer) { try { $script:LauncherTipTimer.Stop() } catch {} }
  if (-not $script:LauncherTipVisible) { return }
  $script:LauncherTipVisible = $false
  $script:LauncherTipAlpha = 0
  if ($null -ne $script:LauncherTip -and -not $script:LauncherTip.IsDisposed) {
    try { [void][AuraWindow]::ShowWindow($script:LauncherTip.Handle, 0) } catch {}
  }
}

function Update-AuraUiLauncherHintPosition {
  if ($null -eq $script:LauncherHint -or $script:LauncherHint.IsDisposed) { return }
  if ($null -eq $script:Launcher -or $script:Launcher.IsDisposed) { return }
  if ($null -eq $script:Form -or $script:Form.IsDisposed) { return }
  try {
    $metrics = Get-AuraUiLauncherMetrics
    $gap = ConvertTo-AuraUiLauncherPixels -Logical 12
    $anchor = [Drawing.Rectangle]::new(
      $script:Launcher.Location.X + $metrics.Halo,
      $script:Launcher.Location.Y + $metrics.Halo,
      $metrics.Compact,
      $metrics.Compact)
    $topLeft = $script:Form.PointToScreen([Drawing.Point]::new(0, 0))
    $bottomRight = $script:Form.PointToScreen(
      [Drawing.Point]::new($script:Form.ClientSize.Width, $script:Form.ClientSize.Height))
    $bounds = [Drawing.Rectangle]::FromLTRB(
      $topLeft.X, $topLeft.Y, $bottomRight.X, $bottomRight.Y)
    $script:LauncherHint.Location = Get-AuraUiLauncherPopupLocation `
      -Anchor $anchor -PopupSize $script:LauncherHint.Size -Bounds $bounds -Gap $gap
  } catch {}
}

function Show-AuraUiLauncherHint {
  # A stylized launch reminder pinned near the launcher. "Got it" closes it for
  # this session; "Don't show again" persists the dismissal marker. Real WinForms
  # controls keep it keyboard- and screen-reader-accessible.
  if ($script:LauncherHintShown) { return }
  if ($null -eq $script:Launcher -or $script:Launcher.IsDisposed -or -not $script:Launcher.Visible) { return }
  $marker = Join-Path $DataRoot 'launcher-hint-dismissed'
  if (Test-Path -LiteralPath $marker -PathType Leaf) { return }
  $script:LauncherHintShown = $true
  try {
    $style = if ($null -ne $script:LauncherStyle) { $script:LauncherStyle } else { Get-AuraUiLauncherDefaultStyle }
    $scale = Get-AuraUiLauncherScale
    $surfaceColor = [Drawing.ColorTranslator]::FromHtml("$($style.surface)")
    $foregroundColor = [Drawing.ColorTranslator]::FromHtml("$($style.foreground)")
    $accentColor = [Drawing.ColorTranslator]::FromHtml("$($style.accent)")
    $accentLuminance = (0.299 * $accentColor.R) + (0.587 * $accentColor.G) + (0.114 * $accentColor.B)
    $accentText = if ($accentLuminance -gt 150) { [Drawing.Color]::FromArgb(255, 26, 22, 31) } else { [Drawing.Color]::White }
    $px = { param([double]$Logical) [int][Math]::Round($Logical * $scale) }
    $hint = [System.Windows.Forms.Form]::new()
    $hint.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
    $hint.ShowInTaskbar = $false
    $hint.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
    $hint.AutoScaleMode = [System.Windows.Forms.AutoScaleMode]::None
    $hint.BackColor = $surfaceColor
    $hint.KeyPreview = $true
    $hint.Text = "$($script:UiCopy.launcherHintTitle)"
    $hint.AccessibleName = "$($script:UiCopy.launcherHintTitle)"
    $hint.ClientSize = [Drawing.Size]::new((& $px 336), (& $px 148))
    $hintBounds = [Drawing.RectangleF]::new(0, 0, $hint.ClientSize.Width, $hint.ClientSize.Height)
    $hintPath = New-AuraUiRoundedRectanglePath -Bounds $hintBounds -Radius (14 * $scale)
    try { $hint.Region = [Drawing.Region]::new($hintPath) } finally { $hintPath.Dispose() }

    $markPanel = [System.Windows.Forms.Panel]::new()
    $markPanel.Bounds = [Drawing.Rectangle]::new((& $px 20), (& $px 20), (& $px 40), (& $px 40))
    $markPanel.BackColor = $surfaceColor
    $markPanel.add_Paint({
      param($sender, $eventArgs)
      $graphics = $eventArgs.Graphics
      $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
      $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $side = [Math]::Min($sender.ClientSize.Width, $sender.ClientSize.Height)
      if ($null -ne $script:LauncherMark) {
        $graphics.DrawImage($script:LauncherMark, [Drawing.Rectangle]::new(0, 0, $side, $side))
      } else {
        $paintStyle = if ($null -ne $script:LauncherStyle) { $script:LauncherStyle } else { Get-AuraUiLauncherDefaultStyle }
        $accent = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml("$($paintStyle.accent)"))
        $graphics.FillEllipse($accent, [Drawing.Rectangle]::new([int]($side / 4), [int]($side / 4), [int]($side / 2), [int]($side / 2)))
        $accent.Dispose()
      }
    })

    $titleLabel = [System.Windows.Forms.Label]::new()
    $titleLabel.Text = "$($script:UiCopy.launcherHintTitle)"
    $titleLabel.Font = [Drawing.Font]::new('Segoe UI Semibold', [float](14 * $scale), [Drawing.GraphicsUnit]::Pixel)
    $titleLabel.ForeColor = $foregroundColor
    $titleLabel.BackColor = $surfaceColor
    $titleLabel.Bounds = [Drawing.Rectangle]::new((& $px 74), (& $px 22), (& $px 242), (& $px 20))

    $bodyLabel = [System.Windows.Forms.Label]::new()
    $bodyLabel.Text = "$($script:UiCopy.launcherHintBody)"
    $bodyLabel.Font = [Drawing.Font]::new('Segoe UI', [float](11.5 * $scale), [Drawing.GraphicsUnit]::Pixel)
    $bodyLabel.ForeColor = ConvertTo-AuraUiBlendedColor -From $foregroundColor -To $surfaceColor -Amount 0.22
    $bodyLabel.BackColor = $surfaceColor
    $bodyLabel.Bounds = [Drawing.Rectangle]::new((& $px 74), (& $px 44), (& $px 242), (& $px 56))

    $dismissButton = [System.Windows.Forms.Button]::new()
    $dismissButton.Text = "$($script:UiCopy.launcherHintDismiss)"
    $dismissButton.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $dismissButton.FlatAppearance.BorderSize = 0
    $dismissButton.FlatAppearance.MouseOverBackColor = ConvertTo-AuraUiBlendedColor -From $surfaceColor -To $foregroundColor -Amount 0.08
    $dismissButton.BackColor = $surfaceColor
    $dismissButton.ForeColor = ConvertTo-AuraUiBlendedColor -From $foregroundColor -To $surfaceColor -Amount 0.3
    $dismissButton.UseVisualStyleBackColor = $false
    $dismissButton.Cursor = [System.Windows.Forms.Cursors]::Hand
    $dismissButton.AccessibleName = "$($script:UiCopy.launcherHintDismiss)"
    $dismissButton.AccessibleRole = [System.Windows.Forms.AccessibleRole]::PushButton
    $dismissButton.Bounds = [Drawing.Rectangle]::new((& $px 96), (& $px 108), (& $px 128), (& $px 28))

    $gotItButton = [System.Windows.Forms.Button]::new()
    $gotItButton.Text = "$($script:UiCopy.launcherHintGotIt)"
    $gotItButton.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $gotItButton.FlatAppearance.BorderSize = 0
    $gotItButton.FlatAppearance.MouseOverBackColor = ConvertTo-AuraUiBlendedColor -From $accentColor -To $accentText -Amount 0.12
    $gotItButton.BackColor = $accentColor
    $gotItButton.ForeColor = $accentText
    $gotItButton.UseVisualStyleBackColor = $false
    $gotItButton.Cursor = [System.Windows.Forms.Cursors]::Hand
    $gotItButton.AccessibleName = "$($script:UiCopy.launcherHintGotIt)"
    $gotItButton.AccessibleRole = [System.Windows.Forms.AccessibleRole]::PushButton
    $gotItButton.Bounds = [Drawing.Rectangle]::new((& $px 232), (& $px 108), (& $px 84), (& $px 28))

    $hint.Controls.AddRange(@($markPanel, $titleLabel, $bodyLabel, $dismissButton, $gotItButton))
    $gotItButton.add_Click({ if ($null -ne $script:LauncherHint -and -not $script:LauncherHint.IsDisposed) { $script:LauncherHint.Close() } })
    $dismissButton.add_Click({
      try {
        [System.IO.File]::WriteAllText((Join-Path $DataRoot 'launcher-hint-dismissed'), 'dismissed')
      } catch { Write-AuraUiLog -Message $_.Exception.ToString() }
      if ($null -ne $script:LauncherHint -and -not $script:LauncherHint.IsDisposed) { $script:LauncherHint.Close() }
    })
    $hint.add_KeyDown({
      param($sender, $eventArgs)
      if ($eventArgs.KeyCode -eq [System.Windows.Forms.Keys]::Escape) { $sender.Close() }
    })
    $hint.add_FormClosed({ $script:LauncherHint = $null })

    $hint.Owner = $script:Form
    $script:LauncherHint = $hint
    # Keep the card attached to the launcher through window resize, movement,
    # DPI relocation, and a user drag of the launcher itself.
    Update-AuraUiLauncherHintPosition
    # SW_SHOWNA keeps focus in Claude; the card still accepts clicks and Escape
    # once the user interacts with it.
    [void][AuraWindow]::ShowWindow($hint.Handle, 8)
  } catch {
    Write-AuraUiLog -Message $_.Exception.ToString()
  }
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
    if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) { return $false }
    $jumpList = [System.Windows.Shell.JumpList]::new()
    $jumpList.ShowFrequentCategory = $false
    $jumpList.ShowRecentCategory = $false
    $task = [System.Windows.Shell.JumpTask]::new()
    $task.Title = "$($script:UiCopy.openStudio)"
    $task.Description = "$($script:UiCopy.studioTitle)"
    $task.ApplicationPath = $shellPath
    $task.Arguments = '-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" -OpenStudio' -f $scriptPath
    $task.WorkingDirectory = $Root
    $jumpIconPath = if ($script:ShellIdentityIconPath -and
        (Test-AuraUiOwnedShortcutIconPath -Path $script:ShellIdentityIconPath)) {
      $script:ShellIdentityIconPath
    } else { $AuraIconPath }
    if (Test-Path -LiteralPath $jumpIconPath -PathType Leaf) {
      $task.IconResourcePath = $jumpIconPath
      $task.IconResourceIndex = 0
    }
    [void]$jumpList.JumpItems.Add($task)
    $jumpList.Apply()
    $script:JumpListIdentityPath = $jumpIconPath
    return $true
  } catch {
    Write-AuraUiLog -Message "Jump List registration skipped: $($_.Exception.Message)"
    return $false
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

function Get-AuraUiUnicodeScalarLength {
  param([Parameter(Mandatory = $true)][string]$Value)
  $count = 0
  for ($index = 0; $index -lt $Value.Length; $index++) {
    $codeUnit = [int]$Value[$index]
    if ($codeUnit -ge 0xD800 -and $codeUnit -le 0xDBFF) {
      if ($index + 1 -ge $Value.Length) {
        throw 'Text contains an incomplete Unicode surrogate pair.'
      }
      $low = [int]$Value[$index + 1]
      if ($low -lt 0xDC00 -or $low -gt 0xDFFF) {
        throw 'Text contains an invalid Unicode surrogate pair.'
      }
      $index++
    } elseif ($codeUnit -ge 0xDC00 -and $codeUnit -le 0xDFFF) {
      throw 'Text contains an invalid Unicode surrogate pair.'
    }
    $count++
  }
  return $count
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

function Assert-AuraUiStudioStyle {
  param([Parameter(Mandatory = $true)][object]$Style)
  if ($Style -isnot [System.Management.Automation.PSCustomObject] -or
      -not (Test-AuraUiStudioExactProperties -Message $Style -Names @('light', 'dark', 'shared'))) {
    throw 'Aura Studio editor state has an invalid Studio style.'
  }
  $modeNames = @(
    'canvas', 'sidebar', 'surface', 'raised', 'text', 'textSecondary', 'textMuted',
    'sidebarText', 'sidebarTextMuted', 'accent', 'accentText', 'border', 'focus',
    'surfaceAlpha', 'sidebarAlpha')
  foreach ($mode in @('light', 'dark')) {
    $colors = $Style.$mode
    if ($colors -isnot [System.Management.Automation.PSCustomObject] -or
        -not (Test-AuraUiStudioExactProperties -Message $colors -Names $modeNames)) {
      throw "Aura Studio editor state has an invalid $mode Studio style."
    }
    foreach ($name in $modeNames[0..12]) {
      if ($colors.$name -isnot [string] -or $colors.$name -cnotmatch '^#[0-9A-Fa-f]{6}$') {
        throw "Aura Studio editor state has an invalid $mode Studio color."
      }
    }
    foreach ($name in @('surfaceAlpha', 'sidebarAlpha')) {
      if ($colors.$name -is [bool] -or $colors.$name -is [string] -or $colors.$name -is [char]) {
        throw "Aura Studio editor state has an invalid $mode Studio material value."
      }
      try { $alpha = [Convert]::ToDouble($colors.$name, [Globalization.CultureInfo]::InvariantCulture) }
      catch { throw "Aura Studio editor state has an invalid $mode Studio material value." }
      if ([double]::IsNaN($alpha) -or [double]::IsInfinity($alpha) -or $alpha -lt 0 -or $alpha -gt 1) {
        throw "Aura Studio editor state has an invalid $mode Studio material value."
      }
    }
  }
  $shared = $Style.shared
  if ($shared -isnot [System.Management.Automation.PSCustomObject] -or
      -not (Test-AuraUiStudioExactProperties -Message $shared -Names @('fontUi', 'fontDisplay', 'radius', 'blur', 'shadow')) -or
      $shared.fontUi -isnot [string] -or $shared.fontUi -cnotin @('system-sans', 'humanist-sans', 'rounded-sans') -or
      $shared.fontDisplay -isnot [string] -or $shared.fontDisplay -cnotin @('system-sans', 'humanist-sans', 'rounded-sans', 'editorial-serif') -or
      $shared.shadow -isnot [string] -or $shared.shadow -cnotin @('none', 'soft', 'elevated')) {
    throw 'Aura Studio editor state has invalid shared Studio styling.'
  }
  foreach ($item in @(@('radius', 0, 32), @('blur', 0, 40))) {
    $value = $shared.($item[0])
    if ($value -is [bool] -or $value -is [string] -or $value -is [char]) {
      throw 'Aura Studio editor state has an invalid Studio style measurement.'
    }
    try { $number = [Convert]::ToDouble($value, [Globalization.CultureInfo]::InvariantCulture) }
    catch { throw 'Aura Studio editor state has an invalid Studio style measurement.' }
    if ([double]::IsNaN($number) -or [double]::IsInfinity($number) -or
        $number -lt [double]$item[1] -or $number -gt [double]$item[2]) {
      throw 'Aura Studio editor state has an invalid Studio style measurement.'
    }
  }
}

function Assert-AuraUiStudioLauncherStyle {
  param([Parameter(Mandatory = $true)][object]$Style)
  $names = @('asset', 'surface', 'surfaceHover', 'foreground', 'accent', 'border', 'radius', 'borderWidth')
  if ($Style -isnot [System.Management.Automation.PSCustomObject] -or
      -not (Test-AuraUiStudioExactProperties -Message $Style -Names $names)) {
    throw 'Aura Studio editor state has an invalid launcher style.'
  }
  if ($Style.asset -isnot [string] -or $Style.asset -cnotmatch '^(assets/theme-art/(default|japanese-film-editorial|korean-prestige|cartoon-studio|anime-twilight|study-library|japanese-idol|korean-idol)/launcher-mark\.png|launcher-mark\.png)$') {
    throw 'Aura Studio editor state has an invalid launcher asset.'
  }
  foreach ($name in @('surface', 'surfaceHover', 'foreground', 'accent', 'border')) {
    if ($Style.$name -isnot [string] -or $Style.$name -cnotmatch '^#[0-9A-F]{6}$') {
      throw 'Aura Studio editor state has an invalid launcher color.'
    }
  }
  [void](ConvertTo-AuraUiStudioNumber -Value $Style.radius -Minimum 8 -Maximum 24 -Label 'Launcher radius')
  [void](ConvertTo-AuraUiStudioNumber -Value $Style.borderWidth -Minimum 1 -Maximum 3 -Label 'Launcher border width')
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
    # User-authored metadata may legitimately mention path-like examples. Real
    # filesystem exposure is rejected by the property-name checks below, while
    # the sole public preview URL retains its exact allowlisted shape.
    if ($Name -ceq 'previewUrl' -and
        $text -cnotmatch '^https://aura\.editor/active/layer-[a-f0-9]{32}\.webp\?v=[a-f0-9]{64}$') {
      throw 'Aura Studio editor state contains an invalid preview URL.'
    }
    if ($Name -cin @('launcherPreviewUrl', 'launcherStylePreviewUrl') -and
        $text -cnotmatch '^https://aura\.(assets/(default|japanese-film-editorial|korean-prestige|cartoon-studio|anime-twilight|study-library|japanese-idol|korean-idol)/launcher-mark\.png|editor/active/launcher-[a-f0-9]{64}\.png)$') {
      throw 'Aura Studio editor state contains an invalid launcher preview URL.'
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
    'canUndo', 'canRedo', 'label', 'metadata', 'tokens', 'studioStyle', 'launcher', 'launcherStyle',
    'launcherPreviewUrl', 'launcherStylePreviewUrl', 'shared', 'greetingPreferences', 'layers', 'feedback',
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
      'canUndo', 'canRedo', 'label', 'metadata', 'tokens', 'studioStyle', 'launcher', 'launcherStyle',
      'launcherPreviewUrl', 'launcherStylePreviewUrl', 'shared', 'greetingPreferences', 'layers', 'feedback')
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
    if ($State.metadata -isnot [System.Management.Automation.PSCustomObject] -or
        -not (Test-AuraUiStudioExactProperties -Message $State.metadata -Names @('labels', 'descriptions'))) {
      throw 'Aura Studio editor state has invalid metadata.'
    }
    foreach ($field in @('labels', 'descriptions')) {
      $localized = $State.metadata.$field
      if ($localized -isnot [System.Management.Automation.PSCustomObject] -or
          -not (Test-AuraUiStudioExactProperties -Message $localized -Names @('en', 'zh-CN', 'zh-HKTW'))) {
        throw "Aura Studio editor state has invalid localized $field."
      }
      $maximum = if ($field -ceq 'labels') { 80 } else { 220 }
      foreach ($locale in @('en', 'zh-CN', 'zh-HKTW')) {
        $text = $localized.$locale
        if ($text -isnot [string] -or -not $text.Trim() -or $text.Length -gt $maximum) {
          throw "Aura Studio editor state has invalid $field.$locale."
        }
      }
    }
    if ($State.tokens -isnot [System.Management.Automation.PSCustomObject] -or
        $null -eq $State.tokens.PSObject.Properties['light'] -or
        $null -eq $State.tokens.PSObject.Properties['dark']) {
      throw 'Aura Studio editor state has invalid mode tokens.'
    }
    if ($State.shared -isnot [System.Management.Automation.PSCustomObject]) {
      throw 'Aura Studio editor state has invalid shared controls.'
    }
    Assert-AuraUiStudioStyle -Style $State.studioStyle
    Assert-AuraUiStudioLauncherStyle -Style $State.launcher
    Assert-AuraUiStudioLauncherStyle -Style $State.launcherStyle
    foreach ($name in @('launcherPreviewUrl', 'launcherStylePreviewUrl')) {
      if ($State.$name -isnot [string] -or
          $State.$name -cnotmatch '^https://aura\.(assets/(default|japanese-film-editorial|korean-prestige|cartoon-studio|anime-twilight|study-library|japanese-idol|korean-idol)/launcher-mark\.png|editor/active/launcher-[a-f0-9]{64}\.png)$') {
        throw "Aura Studio editor state has an invalid $name."
      }
    }
    $layers = @($State.layers)
    if ($layers.Count -gt 8) { throw 'Aura Studio editor state contains too many layers.' }
    $layerIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($layer in $layers) {
      if ($layer -isnot [System.Management.Automation.PSCustomObject] -or
          $null -eq $layer.PSObject.Properties['id'] -or
          $layer.id -isnot [string] -or
          $layer.id -cnotmatch '^layer-[a-f0-9]{32}$' -or
          -not $layerIds.Add($layer.id)) {
        throw 'Aura Studio editor state has an invalid or duplicate layer identity.'
      }
    }
    if ($State.feedback -isnot [System.Management.Automation.PSCustomObject]) {
      throw 'Aura Studio editor state has invalid feedback.'
    }
  }
  if ($null -ne $State.PSObject.Properties['actionSucceeded'] -and $State.actionSucceeded -isnot [bool]) {
    throw 'Aura Studio editor state has an invalid action result.'
  }
  if ($null -ne $State.PSObject.Properties['lastAction'] -and $null -ne $State.lastAction -and
      ($State.lastAction -isnot [string] -or $State.lastAction -cnotin @(
        'create-theme-copy', 'begin-theme-edit', 'set-theme-token', 'set-theme-layer', 'apply-theme-patch',
        'pick-theme-layer-image', 'pick-theme-launcher-mark', 'remove-theme-layer', 'move-theme-layer',
        'undo-theme-edit', 'redo-theme-edit', 'save-theme-edit', 'discard-theme-edit',
        'delete-user-theme', 'set-greeting-phrases', 'reset-greeting'))) {
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

function Update-AuraUiStudioEditorSessionTracking {
  param([Parameter(Mandatory = $true)][object]$State)
  $active = (Get-AuraUiPropertyValue -InputObject $State -Names @('active')) -eq $true
  if (-not $active) {
    $script:StudioEditorTrackedSession = $null
    $script:StudioEditorEntryAppearance = $null
    return
  }
  $session = Get-AuraUiPropertyValue -InputObject $State -Names @('session')
  if ($session -isnot [string] -or -not $session.Trim()) { return }
  if (-not [string]::Equals([string]$script:StudioEditorTrackedSession, $session,
      [StringComparison]::Ordinal)) {
    $script:StudioEditorTrackedSession = $session
    $script:StudioEditorEntryAppearance = Get-AuraUiAppearance
  }
}

function Restore-AuraUiStudioPreviewState {
  if ($null -ne $script:Form -and -not $script:Form.IsDisposed) {
    try { $script:Form.TopMost = $false }
    catch { Write-AuraUiLog -Message "Aura preview topmost state could not be cleared: $($_.Exception.Message)" }
  }
  if (-not $script:StudioEditorTrackedSession -or
      $script:StudioEditorEntryAppearance -notin @('system', 'light', 'dark') -or
      [string]::Equals((Get-AuraUiAppearance), [string]$script:StudioEditorEntryAppearance,
        [StringComparison]::Ordinal)) {
    return
  }
  try {
    Invoke-AuraUiSetAppearance -Appearance ([string]$script:StudioEditorEntryAppearance)
  } catch {
    Write-AuraUiLog -Message "Aura Studio entry appearance could not be restored: $($_.Exception.Message)"
  }
}

function Sync-AuraUiStudioEditorDraft {
  $result = Get-AuraUiStudioEditorCoreState
  Update-AuraUiStudioEditorSessionTracking -State $result.State
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
      'pick-theme-launcher-mark' { return "$($script:UiCopy.themeLauncherMarkFailed)" }
      default { return "$($script:UiCopy.themeEditFailed)" }
    }
  }
  switch -CaseSensitive ($Action) {
    'create-theme-copy' { return "$($script:UiCopy.themeCopyReady)" }
    'begin-theme-edit' { return "$($script:UiCopy.themeEditReady)" }
    'pick-theme-layer-image' { return "$($script:UiCopy.themeLayerImageImported)" }
    'pick-theme-launcher-mark' { return "$($script:UiCopy.themeLauncherMarkImported)" }
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
  Update-AuraUiStudioEditorSessionTracking -State $Result.State
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
  if ($Action -ceq 'pick-theme-launcher-mark' -and $succeeded -and
      $script:LauncherStyleAppliedAsRequested -ne $true) {
    $succeeded = $false
    $script:StudioEditorState['actionSucceeded'] = $false
    $script:StudioEditorState['error'] = 'identity-apply-failed'
  }
  $status = if ($Action -ceq 'pick-theme-launcher-mark' -and
      (Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('error')) -ceq 'identity-apply-failed') {
    "$($script:UiCopy.themeLauncherMarkApplyFailed)"
  } else {
    Get-AuraUiStudioEditorStatus -Action $Action -Succeeded $succeeded
  }
  Send-AuraUiStudioState -Status $status `
    -Tone $(if ($succeeded) { 'ok' } else { 'error' }) -Action $Action -ActionSucceeded $succeeded
  # Invalid edits advance the editor revision but deliberately keep Aura on the
  # previous valid payload. Re-capture that honest last-valid result under the
  # new revision; successful applies request their capture after injection.
  if ($Result.Apply -ceq 'none') { Request-AuraUiMirror }
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

function Invoke-AuraUiApplyThemePatch {
  param([Parameter(Mandatory = $true)][object]$Request)
  Assert-AuraUiStudioEditorSession -Request $Request
  return Invoke-AuraUiStudioEditorRequest -Request $Request
}

function Invoke-AuraUiSetGreetingPhrases {
  param([Parameter(Mandatory = $true)][object]$Request)
  Assert-AuraUiStudioEditorSession -Request $Request
  return Invoke-AuraUiStudioEditorRequest -Request $Request
}

function Invoke-AuraUiResetGreeting {
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
      $script:StudioEditorState['actionSucceeded'] = $true
      $script:StudioEditorState['error'] = 'picker-cancelled'
      Send-AuraUiStudioState -Action 'pick-theme-layer-image' -ActionSucceeded $true
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

function Invoke-AuraUiPickThemeLauncherMark {
  param(
    [Parameter(Mandatory = $true)][object]$Request,
    [AllowNull()][System.Windows.Forms.IWin32Window]$Owner
  )
  Assert-AuraUiStudioEditorSession -Request $Request
  [void](Assert-AuraUiStudioEditorRoots -Create)
  $dialog = [System.Windows.Forms.OpenFileDialog]::new()
  $targetPath = $null
  try {
    $dialog.Title = "$($script:UiCopy.chooseThemeLauncherMarkTitle)"
    $dialog.Filter = 'PNG (*.png)|*.png'
    $dialog.CheckFileExists = $true
    $dialog.Multiselect = $false
    $dialog.RestoreDirectory = $true
    if ($dialog.ShowDialog($Owner) -ne [System.Windows.Forms.DialogResult]::OK) {
      $script:StudioEditorState['lastAction'] = 'pick-theme-launcher-mark'
      $script:StudioEditorState['actionSucceeded'] = $true
      $script:StudioEditorState['error'] = 'picker-cancelled'
      Send-AuraUiStudioState -Action 'pick-theme-launcher-mark' -ActionSucceeded $true
      return $false
    }
    $sourceItem = Get-Item -LiteralPath $dialog.FileName -Force
    if ($sourceItem.PSIsContainer -or
        ($sourceItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        $sourceItem.Length -le 0 -or $sourceItem.Length -ge 400000) {
      throw 'The selected launcher mark must be a regular PNG file smaller than 400 KB.'
    }
    $targetPath = Join-Path $StudioEditorImportRoot ('launcher-{0}.png' -f [Guid]::NewGuid().ToString('N'))
    [IO.File]::Copy($sourceItem.FullName, $targetPath, $false)
    return Invoke-AuraUiStudioEditorRequest -Request $Request -AssetPath $targetPath
  } finally {
    $dialog.Dispose()
    if ($targetPath -and (Test-Path -LiteralPath $targetPath -PathType Leaf)) {
      try {
        $target = Get-Item -LiteralPath $targetPath -Force
        if (($target.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0 -and
            [string]::Equals($target.DirectoryName, [IO.Path]::GetFullPath($StudioEditorImportRoot), [StringComparison]::OrdinalIgnoreCase)) {
          [IO.File]::Delete($target.FullName)
        }
      } catch { Write-AuraUiLog -Message "Studio launcher import cleanup failed: $($_.Exception.Message)" }
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

function Test-AuraUiByteSequenceEqual {
  param(
    [Parameter(Mandatory = $true)][byte[]]$First,
    [Parameter(Mandatory = $true)][byte[]]$Second
  )
  if ($First.Length -ne $Second.Length) { return $false }
  for ($index = 0; $index -lt $First.Length; $index++) {
    if ($First[$index] -ne $Second[$index]) { return $false }
  }
  return $true
}

function New-AuraUiDeleteRecoverySnapshot {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][byte[]]$ConfigBytes,
    [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Payload,
    [Parameter(Mandatory = $true)][string]$RequestedTheme,
    [AllowNull()][string]$ActiveThemeName,
    [AllowNull()][string]$ActiveLabel
  )
  $configDirectory = [IO.Path]::GetFullPath((Split-Path $ConfigPath -Parent)).TrimEnd(
    [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  $recoveryPath = [IO.Path]::GetFullPath($Path)
  if (-not $recoveryPath.StartsWith($configDirectory + [IO.Path]::DirectorySeparatorChar,
      [StringComparison]::OrdinalIgnoreCase) -or
      [IO.Path]::GetFileName($recoveryPath) -cnotmatch '^\.delete-recovery-[a-f0-9]{32}$') {
    throw 'Refusing to write a theme-delete recovery snapshot outside app data.'
  }
  [void][IO.Directory]::CreateDirectory($recoveryPath)
  $item = Get-Item -LiteralPath $recoveryPath -Force
  if (-not $item.PSIsContainer -or
      ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'Theme-delete recovery storage cannot be a symbolic link or junction.'
  }
  [IO.File]::WriteAllBytes((Join-Path $recoveryPath 'config.snapshot.json'), $ConfigBytes)
  [IO.File]::WriteAllText((Join-Path $recoveryPath 'payload.snapshot.js'), $Payload,
    [Text.UTF8Encoding]::new($false))
  $state = [ordered]@{
    requestedTheme = $RequestedTheme
    activeThemeName = $ActiveThemeName
    activeLabel = $ActiveLabel
    capturedUtc = [DateTime]::UtcNow.ToString('o')
  } | ConvertTo-Json -Depth 3
  [IO.File]::WriteAllText((Join-Path $recoveryPath 'state.snapshot.json'), $state,
    [Text.UTF8Encoding]::new($false))
}

function Restore-AuraUiDeleteConfigBytes {
  param(
    [Parameter(Mandatory = $true)][byte[]]$Bytes,
    [AllowNull()][string]$RecoveryPath
  )
  if ($Bytes.Length -eq 0) { throw 'The theme-delete config snapshot is empty.' }
  $configDirectory = [IO.Path]::GetFullPath((Split-Path $ConfigPath -Parent))
  [void][IO.Directory]::CreateDirectory($configDirectory)
  $temporary = Join-Path $configDirectory ('.delete-config-restore-{0}.tmp' -f [Guid]::NewGuid().ToString('N'))
  $backup = if ($RecoveryPath -and (Test-Path -LiteralPath $RecoveryPath -PathType Container)) {
    Join-Path $RecoveryPath 'switched-config.json'
  } else { $null }
  $stream = $null
  try {
    $stream = [IO.File]::Open($temporary, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    $stream.Write($Bytes, 0, $Bytes.Length)
    $stream.Flush($true)
    $stream.Dispose()
    $stream = $null
    if ([IO.File]::Exists($ConfigPath)) {
      [IO.File]::Replace($temporary, $ConfigPath, $backup)
    } else {
      [IO.File]::Move($temporary, $ConfigPath)
    }
    $restored = [IO.File]::ReadAllBytes($ConfigPath)
    if (-not (Test-AuraUiByteSequenceEqual -First $restored -Second $Bytes)) {
      throw 'The theme-delete config rollback did not restore the exact bytes.'
    }
  } finally {
    if ($null -ne $stream) { $stream.Dispose() }
    if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) }
  }
}

function Restore-AuraUiDeleteInMemoryState {
  param(
    [Parameter(Mandatory = $true)][object]$Config,
    [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Payload,
    [AllowNull()][string]$ActiveThemeName,
    [AllowNull()][string]$ActiveLabel
  )
  $script:Config = $Config
  $script:Payload = $Payload
  $script:ActiveThemeName = $ActiveThemeName
  $script:ActiveLabel = $ActiveLabel
}

function Remove-AuraUiDeleteRecoverySnapshot {
  param([Parameter(Mandatory = $true)][string]$Path)
  $configDirectory = [IO.Path]::GetFullPath((Split-Path $ConfigPath -Parent)).TrimEnd(
    [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  $recoveryPath = [IO.Path]::GetFullPath($Path)
  if (-not $recoveryPath.StartsWith($configDirectory + [IO.Path]::DirectorySeparatorChar,
      [StringComparison]::OrdinalIgnoreCase) -or
      [IO.Path]::GetFileName($recoveryPath) -cnotmatch '^\.delete-recovery-[a-f0-9]{32}$' -or
      -not (Test-Path -LiteralPath $recoveryPath -PathType Container)) {
    return
  }
  $item = Get-Item -LiteralPath $recoveryPath -Force
  if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'Refusing to remove redirected theme-delete recovery storage.'
  }
  foreach ($name in @('config.snapshot.json', 'payload.snapshot.js', 'state.snapshot.json', 'switched-config.json')) {
    $candidate = Join-Path $recoveryPath $name
    if ([IO.File]::Exists($candidate)) { [IO.File]::Delete($candidate) }
  }
  [IO.Directory]::Delete($recoveryPath, $false)
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
  $mustSwitch = [string]::Equals([string]$configuredTheme, [string]$Request.theme, [StringComparison]::Ordinal) -or
    [string]::Equals([string]$script:ActiveThemeName, [string]$Request.theme, [StringComparison]::Ordinal)
  if (-not $mustSwitch) { return Invoke-AuraUiStudioEditorRequest -Request $Request }

  $previousConfigBytes = [IO.File]::ReadAllBytes($ConfigPath)
  if ($previousConfigBytes.Length -eq 0) { throw 'Aura Studio cannot delete a theme with an empty config snapshot.' }
  $previousConfigState = $script:Config
  $previousPayload = [string]$script:Payload
  $previousActiveThemeName = $script:ActiveThemeName
  $previousActiveLabel = $script:ActiveLabel
  $wasEnabled = Get-AuraUiEnabled
  $switchAttempted = $false
  try {
    $switchAttempted = $true
    Set-AuraUiConfig -Options @(
      '--theme', 'default', '--enabled', $wasEnabled.ToString().ToLowerInvariant())
    $restoredTheme = Get-AuraUiPropertyValue -InputObject $script:Config -Names @('theme')
    $restoredEnabled = Get-AuraUiPropertyValue -InputObject $script:Config -Names @('enabled')
    if (-not [string]::Equals([string]$restoredTheme, 'default', [StringComparison]::Ordinal) -or
        $restoredEnabled -isnot [bool] -or [bool]$restoredEnabled -ne $wasEnabled -or
        -not [string]::Equals([string]$script:ActiveThemeName, 'default', [StringComparison]::Ordinal)) {
      throw 'Aura Studio could not select Default safely before deleting the active theme.'
    }
    if ($wasEnabled) { Apply-AuraUiTheme }
    $result = Invoke-AuraUiStudioEditorCore -Request $Request
  } catch {
    $primaryFailure = $_.Exception
    if (-not $switchAttempted) { throw $primaryFailure }

    $rollbackFailures = [Collections.Generic.List[Exception]]::new()
    $artifactFailure = $null
    $configDirectory = [IO.Path]::GetFullPath((Split-Path $ConfigPath -Parent))
    $recoveryPath = Join-Path $configDirectory ('.delete-recovery-{0}' -f [Guid]::NewGuid().ToString('N'))
    try {
      New-AuraUiDeleteRecoverySnapshot -Path $recoveryPath -ConfigBytes $previousConfigBytes `
        -Payload $previousPayload -RequestedTheme ([string]$Request.theme) `
        -ActiveThemeName $previousActiveThemeName -ActiveLabel $previousActiveLabel
    } catch { $artifactFailure = $_.Exception }

    try { Restore-AuraUiDeleteConfigBytes -Bytes $previousConfigBytes -RecoveryPath $recoveryPath }
    catch { $rollbackFailures.Add($_.Exception) }
    try {
      Restore-AuraUiDeleteInMemoryState -Config $previousConfigState -Payload $previousPayload `
        -ActiveThemeName $previousActiveThemeName -ActiveLabel $previousActiveLabel
    } catch { $rollbackFailures.Add($_.Exception) }
    try { Set-AuraUiPreferredColorScheme }
    catch { $rollbackFailures.Add($_.Exception) }
    try { Update-AuraUiTrayAppearance }
    catch { $rollbackFailures.Add($_.Exception) }
    try { Apply-AuraUiTheme }
    catch { $rollbackFailures.Add($_.Exception) }
    try {
      $restoredBytes = [IO.File]::ReadAllBytes($ConfigPath)
      if (-not (Test-AuraUiByteSequenceEqual -First $restoredBytes -Second $previousConfigBytes) -or
          -not [object]::ReferenceEquals($script:Config, $previousConfigState) -or
          -not [string]::Equals($script:Payload, $previousPayload, [StringComparison]::Ordinal) -or
          -not [object]::Equals($script:ActiveThemeName, $previousActiveThemeName) -or
          -not [object]::Equals($script:ActiveLabel, $previousActiveLabel)) {
        throw 'Theme-delete rollback verification found incomplete config or runtime state.'
      }
    } catch { $rollbackFailures.Add($_.Exception) }

    if ($rollbackFailures.Count -eq 0) {
      if ($artifactFailure) {
        Write-AuraUiLog -Message "Theme-delete recovery snapshot could not be written: $($artifactFailure.Message)"
      }
      try { Remove-AuraUiDeleteRecoverySnapshot -Path $recoveryPath }
      catch { Write-AuraUiLog -Message "Theme-delete recovery snapshot cleanup failed: $($_.Exception.Message)" }
      throw $primaryFailure
    }

    $combined = [Collections.Generic.List[Exception]]::new()
    $combined.Add($primaryFailure)
    if ($artifactFailure) { $combined.Add($artifactFailure) }
    foreach ($rollbackFailure in $rollbackFailures) { $combined.Add($rollbackFailure) }
    $recoveryAvailable = Test-Path -LiteralPath $recoveryPath -PathType Container
    $message = if ($recoveryAvailable) {
      "Theme deletion failed and rollback was incomplete. Recovery snapshots were retained at $recoveryPath"
    } else {
      'Theme deletion failed and rollback was incomplete. Recovery snapshots could not be retained.'
    }
    Write-AuraUiLog -Message $message
    throw [AggregateException]::new($message, [Exception[]]$combined.ToArray())
  }
  return Complete-AuraUiStudioEditorAction -Action ([string]$Request.type) -Result $result
}

function Send-AuraUiStudioState {
  param(
    [AllowEmptyString()][string]$Status = '',
    [ValidateSet('ok', 'busy', 'error')][string]$Tone = 'ok',
    [ValidateSet(
      '', 'set-image-framing', 'set-card-preview-crop', 'set-avatar', 'set-avatar-framing',
      'create-theme-copy', 'begin-theme-edit', 'set-theme-token', 'set-theme-layer', 'apply-theme-patch',
      'pick-theme-layer-image', 'pick-theme-launcher-mark', 'remove-theme-layer', 'move-theme-layer',
      'undo-theme-edit', 'redo-theme-edit', 'save-theme-edit', 'discard-theme-edit',
      'delete-user-theme', 'set-greeting-phrases', 'reset-greeting')][string]$Action = '',
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
    $avatarValue = if ($null -ne $script:Config) {
      Get-AuraUiPropertyValue -InputObject $script:Config -Names @('avatar')
    } else { $null }
    $imagePreviewUrl = Sync-AuraUiStudioBackgroundPreview
    $state = [ordered]@{
      type = 'state'
      theme = "$themeName"
      appearance = (Get-AuraUiAppearance)
      locale = "$($script:Locale)"
      introductionPending = ($null -eq $script:StudioPreferences -or
        [int]$script:StudioPreferences.introductionVersion -lt $StudioIntroductionVersion)
      introductionRequested = [bool]$script:StudioIntroductionRequested
      enabled = $enabled
      hasImage = ($null -ne $imageValue -and "$imageValue".Trim().Length -gt 0)
      hasAvatar = ($null -ne $avatarValue -and "$avatarValue".Trim().Length -gt 0)
      avatarPreviewUrl = Get-AuraUiAvatarPreviewUrl
      avatarCrop = Get-AuraUiAvatarCrop
      avatarBackground = Get-AuraUiAvatarBackground
      avatarHasAlpha = Test-AuraUiAvatarHasAlpha
      imagePreviewUrl = $imagePreviewUrl
      backgroundAspectRatio = Get-AuraUiBackgroundAspectRatio
      backgroundCrop = Get-AuraUiStudioBackgroundCrop
      studioPreviewCrops = Get-AuraUiStudioPreviewCrops
      themes = @($script:Themes)
      editor = $script:StudioEditorState
      effectiveIdentity = $script:EffectiveLauncherIdentity
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
  param([switch]$OfferIntroduction)
  if ($null -eq $script:StudioForm -or $script:StudioForm.IsDisposed) { return }
  if ($OfferIntroduction) { $script:StudioIntroductionRequested = $true }
  if (-not $script:StudioForm.Visible) { $script:StudioForm.Show() }
  if ($script:StudioForm.WindowState -eq [System.Windows.Forms.FormWindowState]::Minimized) {
    $script:StudioForm.WindowState = [System.Windows.Forms.FormWindowState]::Normal
  }
  Set-AuraUiFormWithinWorkingArea -Form $script:StudioForm
  $script:StudioForm.Activate()
  $script:StudioForm.BringToFront()
  if ($OfferIntroduction) { Send-AuraUiStudioState }
  Request-AuraUiMirror
}

function Show-AuraUiMain {
  if ($null -eq $script:Form -or $script:Form.IsDisposed) { return }
  if (-not $script:Form.Visible) { $script:Form.Show() }
  if ($script:Form.WindowState -eq [System.Windows.Forms.FormWindowState]::Minimized) {
    if ('AuraWindow' -as [type] -and $script:Form.IsHandleCreated) {
      [void][AuraWindow]::ShowWindow($script:Form.Handle, 9)
    } else {
      $script:Form.WindowState = [System.Windows.Forms.FormWindowState]::Normal
    }
  }
  $script:Form.Activate()
  $script:Form.BringToFront()
  if ('AuraWindow' -as [type] -and $script:Form.IsHandleCreated) {
    [void][AuraWindow]::SetForegroundWindow($script:Form.Handle)
  }
}

function Show-AuraUiMainForPreview {
  if ($null -eq $script:Form -or $script:Form.IsDisposed) { return }
  if (-not $script:Form.Visible -or
      $script:Form.WindowState -eq [System.Windows.Forms.FormWindowState]::Minimized) {
    if ('AuraWindow' -as [type]) {
      # SW_SHOWNOACTIVATE: make a capturable window available without stealing
      # focus from the Studio inspector that requested the preview size.
      [void][AuraWindow]::ShowWindow($script:Form.Handle, 4)
    } elseif (-not $script:Form.Visible) {
      $script:Form.Show()
    }
  }
}

function Restore-AuraUiStudioFocus {
  param([IntPtr]$PreviousForeground)
  if ($null -eq $script:StudioForm -or $script:StudioForm.IsDisposed -or -not $script:StudioForm.Visible) { return }
  if ($PreviousForeground -eq [IntPtr]::Zero -or $PreviousForeground -ne $script:StudioForm.Handle) { return }
  $currentForeground = [AuraWindow]::GetForegroundWindow()
  if ($currentForeground -eq $script:StudioForm.Handle) { return }
  if ($null -ne $script:Form -and -not $script:Form.IsDisposed -and
      $currentForeground -ne [IntPtr]::Zero -and $currentForeground -ne $script:Form.Handle) { return }
  $script:StudioForm.Activate()
  $script:StudioForm.BringToFront()
}

function Set-AuraUiPreviewSize {
  param(
    [Parameter(Mandatory = $true)][string]$Size,
    [Parameter(Mandatory = $true)][int]$Request
  )
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
  $script:MirrorPreviewRequest = $Request
  $previousForeground = [AuraWindow]::GetForegroundWindow()
  Show-AuraUiMainForPreview
  if ($Size -ceq 'full') {
    $script:Form.WindowState = [System.Windows.Forms.FormWindowState]::Maximized
    Request-AuraUiMirror
    Restore-AuraUiStudioFocus -PreviousForeground $previousForeground
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
  Restore-AuraUiStudioFocus -PreviousForeground $previousForeground
}

function Request-AuraUiMirror {
  # Every accepted request invalidates older probes and captures so a delayed
  # frame can never rewind the canvas to a superseded size or page state.
  $script:MirrorGeneration = [long]$script:MirrorGeneration + 1
  $script:MirrorSemanticRetries = 0
  $script:MirrorSemanticPreviousContext = $null
  if ($script:RescueActive -or $script:RescueVerificationPending -or
      $null -ne $script:RescueChallengeCandidate) {
    $script:MirrorDue = $null
    return
  }
  if ((Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('active')) -ne $true) {
    $script:MirrorDue = $null
    return
  }
  if ($null -eq $script:StudioForm -or $script:StudioForm.IsDisposed -or -not $script:StudioForm.Visible) { return }
  if ($null -eq $script:Form -or $script:Form.IsDisposed) { return }
  if ($script:Form.WindowState -eq [System.Windows.Forms.FormWindowState]::Minimized) { return }
  $script:MirrorDue = [DateTime]::UtcNow.AddMilliseconds(350)
}

function Request-AuraUiContextMirror {
  if ($script:RescueActive -or $script:RescueVerificationPending -or
      $null -ne $script:RescueChallengeCandidate) { return }
  $previousContext = $null
  if ($null -ne $script:MirrorGeometry -and
      [string]$script:MirrorGeometry.context -in @('new-chat', 'conversation')) {
    $previousContext = [string]$script:MirrorGeometry.context
  }
  Request-AuraUiMirror
  $script:MirrorSemanticRetries = 3
  $script:MirrorSemanticPreviousContext = $previousContext
}

function ConvertTo-AuraUiGreetingShuffleCheckpoint {
  param(
    [Parameter(Mandatory = $true)][object]$Value,
    [Parameter(Mandatory = $true)][string]$ExpectedTheme
  )
  if ($Value -isnot [System.Management.Automation.PSCustomObject] -or
      -not (Test-AuraUiStudioExactProperties -Message $Value -Names @(
        'themeId', 'phraseDigest', 'order', 'cursor', 'lastIndex')) -or
      $Value.themeId -isnot [string] -or
      -not [string]::Equals([string]$Value.themeId, $ExpectedTheme, [StringComparison]::Ordinal) -or
      $Value.phraseDigest -isnot [string] -or
      $Value.phraseDigest -cnotmatch '^[a-f0-9]{64}$' -or
      $Value.order -isnot [System.Array]) {
    throw 'Greeting shuffle checkpoint has an invalid shape.'
  }
  $rawOrder = @($Value.order)
  if ($rawOrder.Count -lt 1 -or $rawOrder.Count -gt 12) {
    throw 'Greeting shuffle checkpoint has an invalid order.'
  }
  $order = [Collections.Generic.List[int]]::new()
  $seen = [Collections.Generic.HashSet[int]]::new()
  foreach ($rawIndex in $rawOrder) {
    $index = ConvertTo-AuraUiStudioInteger `
      -Value $rawIndex -Minimum 0 -Maximum ($rawOrder.Count - 1) -Label 'Greeting shuffle index'
    if (-not $seen.Add($index)) { throw 'Greeting shuffle checkpoint has a duplicate index.' }
    $order.Add($index)
  }
  $cursor = ConvertTo-AuraUiStudioInteger `
    -Value $Value.cursor -Minimum 1 -Maximum $order.Count -Label 'Greeting shuffle cursor'
  $lastIndex = ConvertTo-AuraUiStudioInteger `
    -Value $Value.lastIndex -Minimum 0 -Maximum ($order.Count - 1) -Label 'Greeting shuffle last index'
  if ($lastIndex -ne $order[$cursor - 1]) {
    throw 'Greeting shuffle checkpoint does not name its completed selection.'
  }
  return [ordered]@{
    themeId = $ExpectedTheme
    phraseDigest = [string]$Value.phraseDigest
    order = @($order)
    cursor = $cursor
    lastIndex = $lastIndex
  }
}

function Invoke-AuraUiGreetingShuffleCheckpoint {
  param([Parameter(Mandatory = $true)][object]$Shuffle)
  $json = $Shuffle | ConvertTo-Json -Depth 4 -Compress
  $summary = ([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))).TrimEnd('=').Replace('+', '-').Replace('/', '_')
  if ([string]::Equals(
      $summary, [string]$script:GreetingShuffleCheckpointSummary,
      [StringComparison]::Ordinal)) {
    return
  }
  $raw = Invoke-AuraUiNode -CommandArguments @(
    $ThemeCli, 'greeting-checkpoint', '--config', $ConfigPath, '--state-base64', $summary)
  try { $result = $raw | ConvertFrom-Json }
  catch { throw 'Greeting checkpoint helper returned invalid JSON.' }
  if ($result -isnot [System.Management.Automation.PSCustomObject] -or
      -not (Test-AuraUiStudioExactProperties -Message $result -Names @('changed', 'shuffle')) -or
      $result.changed -isnot [bool]) {
    throw 'Greeting checkpoint helper returned an invalid response.'
  }
  $returned = ConvertTo-AuraUiGreetingShuffleCheckpoint `
    -Value $result.shuffle -ExpectedTheme ([string]$Shuffle.themeId)
  if (($returned | ConvertTo-Json -Depth 4 -Compress) -cne $json) {
    throw 'Greeting checkpoint helper changed the bounded state.'
  }
  if ($result.changed) {
    $script:Config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
  }
  # Do not compile, apply, reroll, or send personal words back through Studio.
  $script:GreetingShuffleCheckpointSummary = $summary
}

function Stop-AuraUiGreetingProbe {
  $script:GreetingProbeGeneration = [long]$script:GreetingProbeGeneration + 1
  $script:GreetingProbeDue = $null
  $script:GreetingProbeRetries = 0
  $script:GreetingProbeTask = $null
  $script:GreetingProbeTaskGeneration = [long]-1
  $script:GreetingProbeTaskDigest = $null
}

function Request-AuraUiGreetingProbe {
  $script:GreetingProbeGeneration = [long]$script:GreetingProbeGeneration + 1
  $script:GreetingProbeRetries = 4
  if ($script:RescueActive -or $script:RescueVerificationPending -or
      $null -ne $script:RescueChallengeCandidate -or
      -not $script:WebReady -or $null -eq $script:WebView -or
      $null -eq $script:WebView.CoreWebView2 -or
      -not (Get-AuraUiEnabled) -or
      -not (Test-AuraUiClaudeUri -Value $script:WebView.Source)) {
    $script:GreetingProbeDue = $null
    return
  }
  $script:GreetingProbeDue = [DateTime]::UtcNow.AddMilliseconds(250)
}

function Update-AuraUiGreetingProbe {
  if ($null -ne $script:GreetingProbeTask) {
    if (-not $script:GreetingProbeTask.IsCompleted) { return }
    $task = $script:GreetingProbeTask
    $generation = $script:GreetingProbeTaskGeneration
    $expectedDigest = $script:GreetingProbeTaskDigest
    $script:GreetingProbeTask = $null
    $script:GreetingProbeTaskGeneration = [long]-1
    $script:GreetingProbeTaskDigest = $null
    try {
      $raw = $task.GetAwaiter().GetResult()
      if ($generation -ne $script:GreetingProbeGeneration -or
          -not $expectedDigest -or
          -not [string]::Equals(
            [string]$expectedDigest, [string]$script:ActivePayloadDigest,
            [StringComparison]::Ordinal)) {
        return
      }
      $probe = if ($raw -and $raw -cne 'null') { $raw | ConvertFrom-Json } else { $null }
      if ($null -eq $probe -or
          $probe -isnot [System.Management.Automation.PSCustomObject] -or
          -not (Test-AuraUiStudioExactProperties -Message $probe -Names @(
              'version', 'digest', 'context', 'status', 'candidateCount', 'source',
              'nativeConnected', 'replacementConnected', 'replacementVisible',
              'nativeHidden', 'visitEpoch', 'shuffle', 'rect')) -or
          $probe.version -ne 1 -or
          $probe.digest -isnot [string] -or
          -not [string]::Equals(
            [string]$probe.digest, [string]$expectedDigest,
            [StringComparison]::Ordinal) -or
          $probe.context -isnot [string] -or
          $probe.context -cnotin @('new-chat', 'conversation', 'other') -or
          $probe.status -isnot [string] -or
          $probe.status -cnotin @(
            'inactive', 'missing', 'ambiguous', 'pending', 'verifying', 'unmeasurable',
            'native', 'custom', 'forced-colors', 'conversation', 'other') -or
          $probe.source -isnot [string] -or
          $probe.source -cnotin @('inactive', 'native', 'custom') -or
          $probe.nativeConnected -isnot [bool] -or
          $probe.replacementConnected -isnot [bool] -or
          $probe.replacementVisible -isnot [bool] -or
          $probe.nativeHidden -isnot [bool]) {
        throw 'Greeting probe returned an invalid bounded result.'
      }
      $status = [string]$probe.status
      $shuffleCheckpoint = $null
      try {
        $candidateCount = ConvertTo-AuraUiStudioInteger `
          -Value $probe.candidateCount -Minimum -1 -Maximum 32 -Label 'Greeting candidate count'
        [void](ConvertTo-AuraUiStudioInteger `
          -Value $probe.visitEpoch -Minimum 0 -Maximum 2147483647 -Label 'Greeting visit epoch')
        if ($null -ne $probe.shuffle) {
          if (-not $script:ActiveThemeName) {
            throw 'Greeting shuffle checkpoint has no active theme.'
          }
          $shuffleCheckpoint = ConvertTo-AuraUiGreetingShuffleCheckpoint `
            -Value $probe.shuffle -ExpectedTheme ([string]$script:ActiveThemeName)
        }
        if ($null -ne $probe.rect) {
          if ($probe.rect -isnot [System.Management.Automation.PSCustomObject] -or
              -not (Test-AuraUiStudioExactProperties -Message $probe.rect `
                -Names @('left', 'top', 'width', 'height'))) {
            throw 'Greeting probe rectangle has an invalid shape.'
          }
          [void](ConvertTo-AuraUiStudioNumber `
            -Value $probe.rect.left -Minimum -100000 -Maximum 100000 -Label 'Greeting left')
          [void](ConvertTo-AuraUiStudioNumber `
            -Value $probe.rect.top -Minimum -100000 -Maximum 100000 -Label 'Greeting top')
          [void](ConvertTo-AuraUiStudioNumber `
            -Value $probe.rect.width -Minimum 0 -Maximum 100000 -Label 'Greeting width')
          [void](ConvertTo-AuraUiStudioNumber `
            -Value $probe.rect.height -Minimum 0 -Maximum 100000 -Label 'Greeting height')
        }
      } catch {
        throw 'Greeting probe returned an invalid bounded result.'
      }
      $unsettled = $status -in @(
        'missing', 'ambiguous', 'pending', 'verifying', 'unmeasurable', 'other')
      if ($unsettled -and $script:GreetingProbeRetries -gt 0) {
        $script:GreetingProbeRetries--
        $script:GreetingProbeDue = [DateTime]::UtcNow.AddMilliseconds(300)
        return
      }
      if ($status -ceq 'custom' -and $probe.source -ceq 'custom') {
        if ($null -eq $shuffleCheckpoint) {
          throw 'Custom greeting probe omitted its bounded shuffle checkpoint.'
        }
        Invoke-AuraUiGreetingShuffleCheckpoint -Shuffle $shuffleCheckpoint
      } elseif ($null -ne $shuffleCheckpoint -and $probe.source -cne 'custom') {
        throw 'Native greeting probe returned a custom shuffle checkpoint.'
      }
      $summary = "$status`:$candidateCount`:$($probe.source)"
      if (-not [string]::Equals(
          $summary, [string]$script:GreetingProbeLastSummary,
          [StringComparison]::Ordinal)) {
        $previousFailure = [string]$script:GreetingProbeLastStatus -in @(
          'missing', 'ambiguous', 'unmeasurable')
        if ($status -in @('missing', 'ambiguous', 'unmeasurable')) {
          Write-AuraUiLog -Message (
            "Greeting binding status: $status (candidates: $candidateCount).")
        } elseif ($previousFailure -and $status -in @('native', 'custom')) {
          Write-AuraUiLog -Message "Greeting binding recovered: $status."
        }
        $script:GreetingProbeLastSummary = $summary
        $script:GreetingProbeLastStatus = $status
      }
    } catch {
      if ($generation -eq $script:GreetingProbeGeneration -and
          -not $script:RescueActive -and -not $script:RescueVerificationPending -and
          $null -eq $script:RescueChallengeCandidate) {
        Write-AuraUiLog -Message "Greeting binding probe failed: $($_.Exception.Message)"
      }
    }
    return
  }
  if ($null -eq $script:GreetingProbeDue -or
      [DateTime]::UtcNow -lt $script:GreetingProbeDue) {
    return
  }
  $script:GreetingProbeDue = $null
  if ($script:RescueActive -or $script:RescueVerificationPending -or
      $null -ne $script:RescueChallengeCandidate -or
      -not $script:WebReady -or $null -eq $script:WebView -or
      $null -eq $script:WebView.CoreWebView2 -or
      -not (Get-AuraUiEnabled) -or
      -not $script:ActivePayloadDigest -or
      -not (Test-AuraUiClaudeUri -Value $script:WebView.Source)) {
    return
  }
  $probeSource = '(() => { try { const state = window.__CLAUDE_AURA_STATE__; return state && typeof state.getGreetingProbe === "function" ? state.getGreetingProbe() : null; } catch { return null; } })()'
  try {
    $script:GreetingProbeTaskGeneration = [long]$script:GreetingProbeGeneration
    $script:GreetingProbeTaskDigest = [string]$script:ActivePayloadDigest
    $script:GreetingProbeTask = $script:WebView.CoreWebView2.ExecuteScriptAsync($probeSource)
  } catch {
    $script:GreetingProbeTaskGeneration = [long]-1
    $script:GreetingProbeTaskDigest = $null
    if (-not $script:RescueActive -and -not $script:RescueVerificationPending -and
        $null -eq $script:RescueChallengeCandidate) {
      Write-AuraUiLog -Message "Greeting binding probe failed: $($_.Exception.Message)"
    }
  }
}

function Start-AuraUiMirrorCapture {
  if ($script:RescueActive -or $script:RescueVerificationPending -or
      $null -ne $script:RescueChallengeCandidate) { return }
  if ((Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('active')) -ne $true) { return }
  if ($null -eq $script:StudioForm -or $script:StudioForm.IsDisposed -or -not $script:StudioForm.Visible) { return }
  try {
    $script:MirrorCaptureSession = [string](Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('session'))
    if (-not $script:MirrorCaptureSession) { return }
    $script:MirrorCaptureRevision = [long](Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('revision'))
    $script:MirrorCapturePreviewRequest = [int]$script:MirrorPreviewRequest
    $script:MirrorCaptureGeneration = [long]$script:MirrorGeneration
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
    $script:MirrorCaptureSession = $null
    $script:MirrorCaptureRevision = [long]-1
    $script:MirrorCapturePreviewRequest = -1
    $script:MirrorCaptureGeneration = [long]-1
  }
}

function Update-AuraUiMirror {
  # Runs on the UI timer: never blocks on an incomplete probe or capture task.
  if ($null -ne $script:MirrorCaptureTask) {
    if (-not $script:MirrorCaptureTask.IsCompleted) { return }
    $task = $script:MirrorCaptureTask
    $stream = $script:MirrorStream
    $captureSession = $script:MirrorCaptureSession
    $captureRevision = $script:MirrorCaptureRevision
    $capturePreviewRequest = $script:MirrorCapturePreviewRequest
    $captureGeneration = $script:MirrorCaptureGeneration
    $script:MirrorCaptureTask = $null
    $script:MirrorStream = $null
    $script:MirrorCaptureSession = $null
    $script:MirrorCaptureRevision = [long]-1
    $script:MirrorCapturePreviewRequest = -1
    $script:MirrorCaptureGeneration = [long]-1
    try {
      [void]$task.GetAwaiter().GetResult()
      $activeSession = [string](Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('session'))
      $activeRevision = [long](Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('revision'))
      if ((Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('active')) -eq $true -and
          $captureSession -and $captureSession -ceq $activeSession -and
          $captureRevision -eq $activeRevision -and
          $capturePreviewRequest -eq $script:MirrorPreviewRequest -and
          $captureGeneration -eq $script:MirrorGeneration -and
          $null -ne $script:StudioForm -and -not $script:StudioForm.IsDisposed -and $script:StudioForm.Visible -and
          $null -ne $script:StudioWebView -and $null -ne $script:StudioWebView.CoreWebView2 -and
          $stream.Length -gt 0 -and $stream.Length -le $StudioMirrorJpegMaxBytes) {
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
          revision = $captureRevision
          request = $capturePreviewRequest
        }
        $mirrorViewport = if ($null -ne $geometry) { [string]$geometry.viewport } else { '' }
        if ($mirrorViewport -in @('normal', 'wide')) {
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
          $greetingGeometry = [ordered]@{
            status = 'inactive'
            source = 'none'
            rect = $null
          }
          if ($null -ne $geometry.greeting -and
              [string]$geometry.greeting.status -in @('found', 'missing', 'ambiguous', 'inactive') -and
              [string]$geometry.greeting.source -in @('native', 'custom', 'none')) {
            $greetingGeometry.status = [string]$geometry.greeting.status
            $greetingGeometry.source = [string]$geometry.greeting.source
            if ($greetingGeometry.status -eq 'found' -and $null -ne $geometry.greeting.rect) {
              $candidateGreetingRect = [ordered]@{
                left = [double]$geometry.greeting.rect.left
                top = [double]$geometry.greeting.rect.top
                width = [double]$geometry.greeting.rect.width
                height = [double]$geometry.greeting.rect.height
              }
              if (-not [double]::IsNaN($candidateGreetingRect.left) -and
                  -not [double]::IsInfinity($candidateGreetingRect.left) -and
                  -not [double]::IsNaN($candidateGreetingRect.top) -and
                  -not [double]::IsInfinity($candidateGreetingRect.top) -and
                  $candidateGreetingRect.width -gt 0 -and
                  $candidateGreetingRect.height -gt 0 -and
                  $candidateGreetingRect.width -le $width -and
                  $candidateGreetingRect.height -le $height) {
                $greetingGeometry.rect = $candidateGreetingRect
              } else {
                $greetingGeometry.status = 'missing'
                $greetingGeometry.source = 'none'
              }
            }
          }
          $payload['geometry'] = [ordered]@{
            context = [string]$geometry.context
            mode = [string]$geometry.mode
            viewport = $mirrorViewport
            main = $rect
            prompt = $promptRect
            greeting = $greetingGeometry
          }
        }
        $script:StudioWebView.CoreWebView2.PostWebMessageAsJson(($payload | ConvertTo-Json -Depth 6 -Compress))
      }
    } catch {
      if ($captureGeneration -ne $script:MirrorGeneration -or
          $script:RescueActive -or $script:RescueVerificationPending -or
          $null -ne $script:RescueChallengeCandidate) {
        Write-AuraUiLog -Message 'A stale mirror capture ended during navigation verification.'
      } else {
        Write-AuraUiLog -Message "Aura mirror capture failed: $($_.Exception.Message)"
      }
    } finally {
      if ($null -ne $stream) { $stream.Dispose() }
    }
    return
  }
  if ($null -ne $script:MirrorProbeTask) {
    if (-not $script:MirrorProbeTask.IsCompleted) { return }
    $task = $script:MirrorProbeTask
    $probeGeneration = $script:MirrorProbeGeneration
    $script:MirrorProbeTask = $null
    $script:MirrorProbeGeneration = [long]-1
    $script:MirrorGeometry = $null
    try {
      $raw = $task.GetAwaiter().GetResult()
      if ($probeGeneration -ne $script:MirrorGeneration) { return }
      if ($raw -and $raw -cne 'null') { $script:MirrorGeometry = $raw | ConvertFrom-Json }
    } catch {
      if ($probeGeneration -ne $script:MirrorGeneration -or
          $script:RescueActive -or $script:RescueVerificationPending -or
          $null -ne $script:RescueChallengeCandidate) {
        Write-AuraUiLog -Message 'A stale mirror probe ended during navigation verification.'
      } else {
        Write-AuraUiLog -Message "Aura mirror layout probe failed: $($_.Exception.Message)"
      }
    }
    $semanticContext = if ($null -ne $script:MirrorGeometry) { [string]$script:MirrorGeometry.context } else { 'other' }
    $semanticUnsettled = $semanticContext -notin @('new-chat', 'conversation') -or
      ($script:MirrorSemanticPreviousContext -and
       [string]::Equals($semanticContext, [string]$script:MirrorSemanticPreviousContext, [StringComparison]::Ordinal))
    if ($semanticUnsettled -and $script:MirrorSemanticRetries -gt 0) {
      $script:MirrorSemanticRetries--
      $script:MirrorDue = [DateTime]::UtcNow.AddMilliseconds(250)
      return
    }
    $script:MirrorSemanticRetries = 0
    $script:MirrorSemanticPreviousContext = $null
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
  $probe = '(() => { try { const root = document.documentElement; const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; }; const viewport = root.dataset.claudeAuraViewport; const state = window.__CLAUDE_AURA_STATE__; const gp = state && typeof state.getGreetingProbe === "function" ? state.getGreetingProbe() : null; const greetingStatus = gp?.status === "native" || gp?.status === "custom" ? "found" : gp?.status === "ambiguous" ? "ambiguous" : gp?.status === "missing" || gp?.status === "pending" || gp?.status === "verifying" || gp?.status === "unmeasurable" ? "missing" : "inactive"; const greetingSource = gp?.source === "native" || gp?.source === "custom" ? gp.source : "none"; return { context: root.dataset.claudeAuraContext || "other", mode: root.dataset.claudeAuraEffectiveMode || "light", viewport: viewport === "normal" || viewport === "wide" ? viewport : null, innerWidth: window.innerWidth, innerHeight: window.innerHeight, main: rect(document.querySelector("[data-claude-aura-main-canvas]")), prompt: rect(document.querySelector("[data-claude-aura-prompt]")), greeting: { status: greetingStatus, source: greetingSource, rect: greetingStatus === "found" ? gp.rect : null } }; } catch { return null; } })()'
  try {
    $script:MirrorProbeGeneration = [long]$script:MirrorGeneration
    $script:MirrorProbeTask = $script:WebView.CoreWebView2.ExecuteScriptAsync($probe)
  } catch {
    $script:MirrorProbeGeneration = [long]-1
    if ($script:RescueActive -or $script:RescueVerificationPending -or
        $null -ne $script:RescueChallengeCandidate) {
      Write-AuraUiLog -Message 'A mirror probe was skipped during navigation verification.'
    } else {
      Write-AuraUiLog -Message "Aura mirror layout probe failed: $($_.Exception.Message)"
    }
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

function Read-AuraUiAvatarState {
  if (-not (Test-Path -LiteralPath $AvatarStatePath -PathType Leaf)) { return $null }
  try {
    $raw = Get-Content -LiteralPath $AvatarStatePath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($raw -is [System.Management.Automation.PSCustomObject]) { return $raw }
  } catch {}
  return $null
}

function Get-AuraUiAvatarCrop {
  # The framing the user last confirmed, defaulting to a centered, unzoomed square.
  $x = 50.0; $y = 50.0; $zoom = 1.0
  $state = Read-AuraUiAvatarState
  $crop = if ($null -ne $state) { $state.crop } else { $null }
  if ($null -ne $crop) {
    try { $x = ConvertTo-AuraUiStudioNumber -Value $crop.x -Minimum 0 -Maximum 100 -Label 'Avatar x' } catch {}
    try { $y = ConvertTo-AuraUiStudioNumber -Value $crop.y -Minimum 0 -Maximum 100 -Label 'Avatar y' } catch {}
    try { $zoom = ConvertTo-AuraUiStudioNumber -Value $crop.zoom -Minimum 1 -Maximum 2 -Label 'Avatar zoom' } catch {}
  }
  return [ordered]@{ x = $x; y = $y; zoom = $zoom }
}

function Get-AuraUiAvatarBackground {
  $state = Read-AuraUiAvatarState
  if ($null -eq $state) { return 'transparent' }
  try { return ConvertTo-AuraUiAvatarBackground -Value $state.background } catch { return 'transparent' }
}

function Test-AuraUiAvatarHasAlpha {
  $state = Read-AuraUiAvatarState
  if ($null -eq $state) { return $false }
  return $state.hasAlpha -eq $true
}

function Get-AuraUiAvatarSourcePath {
  $state = Read-AuraUiAvatarState
  if ($null -eq $state -or -not $state.source) { return $null }
  $name = [string]$state.source
  if ($name -notmatch '^source\.(png|jpg|jpeg|gif)$') { return $null }
  $path = Join-Path $AvatarRoot $name
  if (Test-Path -LiteralPath $path -PathType Leaf) { return $path }
  return $null
}

function Get-AuraUiAvatarPreviewUrl {
  # The unmodified original, served to the Studio crop editor over the sandboxed
  # aura.avatar host so the framing preview matches what the host will bake.
  $state = Read-AuraUiAvatarState
  if ($null -eq (Get-AuraUiAvatarSourcePath)) { return $null }
  $hash = if ($null -ne $state -and $state.hash) { [string]$state.hash } else { 'x' }
  return "https://aura.avatar/$([Uri]::EscapeDataString([string]$state.source))?v=$hash"
}

function Clear-AuraUiAvatarFiles {
  foreach ($name in @('crop.json', 'current.png')) {
    $path = Join-Path $AvatarRoot $name
    try { if (Test-Path -LiteralPath $path -PathType Leaf) { [IO.File]::Delete($path) } } catch {}
  }
  try {
    if (Test-Path -LiteralPath $AvatarRoot -PathType Container) {
      foreach ($file in @(Get-ChildItem -LiteralPath $AvatarRoot -Filter 'source.*' -File -ErrorAction SilentlyContinue)) {
        try { [IO.File]::Delete($file.FullName) } catch {}
      }
    }
  } catch {}
}

function ConvertTo-AuraUiAvatarBackground {
  # 'transparent' (keep the alpha channel) or an exact #RRGGBB fill.
  param([AllowNull()][object]$Value)
  if ($null -eq $Value) { return 'transparent' }
  $text = "$Value".Trim()
  if (-not $text -or [string]::Equals($text, 'transparent', [StringComparison]::OrdinalIgnoreCase)) {
    return 'transparent'
  }
  if ($text -cnotmatch '^#[0-9A-Fa-f]{6}$') { throw 'Avatar background must be transparent or a #RRGGBB color.' }
  return $text.ToUpperInvariant()
}

function Test-AuraUiImageHasAlpha {
  # Does the source actually contain see-through pixels? Rendering a small copy
  # over a cleared canvas catches PNG alpha and indexed GIF transparency alike,
  # without walking every pixel of a large photograph. A small tolerance keeps
  # antialiased edge blending from reporting a fully opaque image as transparent.
  param([Parameter(Mandatory = $true)][string]$Path)
  $stream = $null; $source = $null; $probe = $null; $graphics = $null
  try {
    $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    $source = [Drawing.Image]::FromStream($stream)
    $side = 64
    $probe = [Drawing.Bitmap]::new($side, $side, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [Drawing.Graphics]::FromImage($probe)
    $graphics.Clear([Drawing.Color]::Transparent)
    $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.DrawImage($source, [Drawing.Rectangle]::new(0, 0, $side, $side))
    $graphics.Dispose(); $graphics = $null
    $sheer = 0
    for ($y = 0; $y -lt $side; $y++) {
      for ($x = 0; $x -lt $side; $x++) {
        if ($probe.GetPixel($x, $y).A -lt 250) { $sheer++ }
      }
    }
    return $sheer -gt (($side * $side) * 0.005)
  } catch {
    Write-AuraUiLog -Message "Avatar transparency could not be inspected: $($_.Exception.Message)"
    return $false
  } finally {
    if ($null -ne $graphics) { try { $graphics.Dispose() } catch {} }
    if ($null -ne $probe) { try { $probe.Dispose() } catch {} }
    if ($null -ne $source) { try { $source.Dispose() } catch {} }
    if ($null -ne $stream) { try { $stream.Dispose() } catch {} }
  }
}

function Invoke-AuraUiBakeAvatar {
  # Crop the original into a square PNG per the confirmed x/y/zoom framing, so the
  # renderer only ever displays a ready-made square (no crop code in the payload).
  param(
    [Parameter(Mandatory = $true)][string]$SourcePath,
    [Parameter(Mandatory = $true)][double]$X,
    [Parameter(Mandatory = $true)][double]$Y,
    [Parameter(Mandatory = $true)][double]$Zoom,
    [AllowNull()][string]$Background = 'transparent'
  )
  $stream = $null; $source = $null; $bitmap = $null; $graphics = $null
  try {
    $stream = [IO.File]::Open($SourcePath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    $source = [Drawing.Image]::FromStream($stream)
    $w = [double]$source.Width; $h = [double]$source.Height
    if ($w -le 0 -or $h -le 0) { throw 'Avatar source has no pixels.' }
    $size = [int]$AvatarBakeSize
    $zoomValue = [Math]::Max(1.0, [Math]::Min(2.0, $Zoom))
    $scale = [Math]::Max($size / $w, $size / $h) * $zoomValue
    $overflowX = [Math]::Max(0.0, ($w * $scale) - $size)
    $overflowY = [Math]::Max(0.0, ($h * $scale) - $size)
    $srcSide = $size / $scale
    $srcLeft = ($overflowX * ([Math]::Max(0.0, [Math]::Min(100.0, $X)) / 100.0)) / $scale
    $srcTop = ($overflowY * ([Math]::Max(0.0, [Math]::Min(100.0, $Y)) / 100.0)) / $scale
    $bitmap = [Drawing.Bitmap]::new($size, $size, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $graphics.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::HighQuality
    # Paint the chosen backdrop first so a PNG or GIF with transparency lands on a
    # solid square instead of showing Claude's own avatar through its gaps.
    $backgroundValue = ConvertTo-AuraUiAvatarBackground -Value $Background
    if ($backgroundValue -cne 'transparent') {
      $graphics.Clear([Drawing.ColorTranslator]::FromHtml($backgroundValue))
    }
    $graphics.DrawImage(
      $source, [Drawing.Rectangle]::new(0, 0, $size, $size),
      [single]$srcLeft, [single]$srcTop, [single]$srcSide, [single]$srcSide,
      [Drawing.GraphicsUnit]::Pixel)
    $graphics.Dispose(); $graphics = $null
    [IO.Directory]::CreateDirectory($AvatarRoot) | Out-Null
    $temporary = "$AvatarBakedPath.tmp-$([Guid]::NewGuid().ToString('N'))"
    $bitmap.Save($temporary, [Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose(); $bitmap = $null
    [IO.File]::Copy($temporary, $AvatarBakedPath, $true)
    try { [IO.File]::Delete($temporary) } catch {}
    return $true
  } catch {
    Write-AuraUiLog -Message "Avatar could not be baked: $($_.Exception.Message)"
    return $false
  } finally {
    if ($null -ne $graphics) { try { $graphics.Dispose() } catch {} }
    if ($null -ne $bitmap) { try { $bitmap.Dispose() } catch {} }
    if ($null -ne $source) { try { $source.Dispose() } catch {} }
    if ($null -ne $stream) { try { $stream.Dispose() } catch {} }
  }
}

function Save-AuraUiAvatarState {
  param(
    [Parameter(Mandatory = $true)][string]$SourceName,
    [Parameter(Mandatory = $true)][string]$Hash,
    [Parameter(Mandatory = $true)][double]$X,
    [Parameter(Mandatory = $true)][double]$Y,
    [Parameter(Mandatory = $true)][double]$Zoom,
    [AllowNull()][string]$Background = 'transparent',
    [bool]$HasAlpha = $false
  )
  $state = [ordered]@{
    source = $SourceName
    hash = $Hash
    hasAlpha = $HasAlpha
    background = (ConvertTo-AuraUiAvatarBackground -Value $Background)
    crop = [ordered]@{ x = $X; y = $Y; zoom = $Zoom }
  }
  [IO.Directory]::CreateDirectory($AvatarRoot) | Out-Null
  [IO.File]::WriteAllText($AvatarStatePath, ($state | ConvertTo-Json -Compress), [Text.UTF8Encoding]::new($false))
}

function Invoke-AuraUiChooseAvatar {
  param([AllowNull()][System.Windows.Forms.IWin32Window]$Owner)
  $dialog = [System.Windows.Forms.OpenFileDialog]::new()
  try {
    $dialog.Title = "$($script:UiCopy.chooseAvatarTitle)"
    # Sources are cropped with GDI+, which decodes PNG, JPEG, and GIF (not WebP/AVIF).
    $dialog.Filter = "$($script:UiCopy.imagesFilter)|*.png;*.jpg;*.jpeg;*.gif"
    $dialog.CheckFileExists = $true
    if ($dialog.ShowDialog($Owner) -ne [System.Windows.Forms.DialogResult]::OK) {
      Send-AuraUiStudioState
      return $false
    }
    $chosen = $dialog.FileName
    $extension = [IO.Path]::GetExtension($chosen).ToLowerInvariant()
    if ($extension -notmatch '^\.(png|jpg|jpeg|gif)$') {
      Show-AuraUiMessage -Title "$($script:UiCopy.appearanceNotChangedTitle)" -Icon Warning -Message "$($script:UiCopy.invalidBackgroundMessage)"
      Send-AuraUiStudioState
      return $false
    }
    $info = [IO.FileInfo]::new($chosen)
    if ($info.Length -gt $AvatarSourceMaxBytes) {
      Show-AuraUiMessage -Title "$($script:UiCopy.appearanceNotChangedTitle)" -Icon Warning -Message "$($script:UiCopy.invalidBackgroundMessage)"
      Send-AuraUiStudioState
      return $false
    }
    Clear-AuraUiAvatarFiles
    [IO.Directory]::CreateDirectory($AvatarRoot) | Out-Null
    $sourceName = "source$extension"
    $sourcePath = Join-Path $AvatarRoot $sourceName
    [IO.File]::Copy($chosen, $sourcePath, $true)
    $hash = 'x'
    try {
      $sha = [Security.Cryptography.SHA256]::Create()
      $bytes = [IO.File]::ReadAllBytes($sourcePath)
      $hash = [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-', '').ToLowerInvariant()
      $sha.Dispose()
    } catch {}
    # Keep the image exactly as authored by default; the framing editor offers the
    # backdrop swatches whenever the source actually has see-through pixels.
    $hasAlpha = Test-AuraUiImageHasAlpha -Path $sourcePath
    if (-not (Invoke-AuraUiBakeAvatar -SourcePath $sourcePath -X 50 -Y 50 -Zoom 1 -Background 'transparent')) {
      Clear-AuraUiAvatarFiles
      Show-AuraUiMessage -Title "$($script:UiCopy.appearanceNotChangedTitle)" -Icon Warning -Message "$($script:UiCopy.invalidBackgroundMessage)"
      Send-AuraUiStudioState
      return $false
    }
    Save-AuraUiAvatarState -SourceName $sourceName -Hash $hash -X 50 -Y 50 -Zoom 1 `
      -Background 'transparent' -HasAlpha $hasAlpha
    Set-AuraUiConfig -Options @('--avatar', $AvatarBakedPath, '--enabled', 'true')
    Apply-AuraUiTheme
    # Open the framing editor immediately so the user positions the crop before
    # settling on it, mirroring the theme-card preview flow.
    Send-AuraUiStudioState -Status "$($script:UiCopy.applyingAvatar)" -Tone busy -Action 'set-avatar'
    return $true
  } finally {
    $dialog.Dispose()
  }
}

function Invoke-AuraUiSetAvatarFraming {
  param(
    [Parameter(Mandatory = $true)][object]$X,
    [Parameter(Mandatory = $true)][object]$Y,
    [Parameter(Mandatory = $true)][object]$Zoom,
    [AllowNull()][object]$Background = $null
  )
  $sourcePath = Get-AuraUiAvatarSourcePath
  if (-not $sourcePath) { throw 'No avatar is available to frame.' }
  $state = Read-AuraUiAvatarState
  $hash = if ($null -ne $state -and $state.hash) { [string]$state.hash } else { 'x' }
  $sourceName = [string]$state.source
  $hasAlpha = $state.hasAlpha -eq $true
  $xValue = ConvertTo-AuraUiStudioNumber -Value $X -Minimum 0 -Maximum 100 -Label 'Avatar x'
  $yValue = ConvertTo-AuraUiStudioNumber -Value $Y -Minimum 0 -Maximum 100 -Label 'Avatar y'
  $zoomValue = ConvertTo-AuraUiStudioNumber -Value $Zoom -Minimum 1 -Maximum 2 -Label 'Avatar zoom'
  $backgroundValue = if ($null -eq $Background) {
    Get-AuraUiAvatarBackground
  } else {
    ConvertTo-AuraUiAvatarBackground -Value $Background
  }
  if (-not (Invoke-AuraUiBakeAvatar -SourcePath $sourcePath -X $xValue -Y $yValue -Zoom $zoomValue `
      -Background $backgroundValue)) {
    throw 'The avatar could not be reframed.'
  }
  Save-AuraUiAvatarState -SourceName $sourceName -Hash $hash -X $xValue -Y $yValue -Zoom $zoomValue `
    -Background $backgroundValue -HasAlpha $hasAlpha
  Set-AuraUiConfig -Options @('--avatar', $AvatarBakedPath, '--enabled', 'true')
  Apply-AuraUiTheme
  Send-AuraUiStudioState -Status "$($script:UiCopy.backgroundPositionSaved)" -Action 'set-avatar-framing'
}

function Invoke-AuraUiClearAvatar {
  Clear-AuraUiAvatarFiles
  Set-AuraUiConfig -Options @('--clear-avatar', '--enabled', 'true')
  Apply-AuraUiTheme
  Send-AuraUiStudioState -Status "$($script:UiCopy.removingAvatar)" -Tone busy
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
  $options = @('--enabled', $Enabled.ToString().ToLowerInvariant())
  if (-not $Enabled) { $options += @('--appearance', 'system') }
  Set-AuraUiConfig -Options $options
  $appearance = if ($Enabled) { Get-AuraUiAppearance } else { 'system' }
  Set-AuraUiPreferredColorScheme -Appearance $appearance -Enabled $Enabled
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
  $enabled = Get-AuraUiEnabled
  $effectiveAppearance = if ($enabled) { $Appearance } else { 'system' }
  Set-AuraUiConfig -Options @('--appearance', $effectiveAppearance)
  Set-AuraUiPreferredColorScheme -Appearance $effectiveAppearance -Enabled $enabled
  if ($enabled) { Apply-AuraUiTheme }
  Send-AuraUiStudioState
}

function Update-AuraUiLocalizedChrome {
  try {
    if ($null -ne $script:StudioForm -and -not $script:StudioForm.IsDisposed) {
      $script:StudioForm.Text = "$($script:UiCopy.studioTitle)"
      $script:StudioForm.AccessibleName = "$($script:UiCopy.studioTitle)"
    }
    if ($null -ne $script:TrayOpenStudioItem -and -not $script:TrayOpenStudioItem.IsDisposed) {
      $script:TrayOpenStudioItem.Text = "$($script:UiCopy.openStudio)"
    }
    if ($null -ne $script:TrayOpenDesktopItem -and -not $script:TrayOpenDesktopItem.IsDisposed) {
      $script:TrayOpenDesktopItem.Text = "$($script:UiCopy.openDesktopApp)"
    }
    if ($null -ne $script:TrayExitItem -and -not $script:TrayExitItem.IsDisposed) {
      $script:TrayExitItem.Text = "$($script:UiCopy.exitApp)"
    }
    if ($null -ne $script:LauncherStudioItem -and -not $script:LauncherStudioItem.IsDisposed) {
      $script:LauncherStudioItem.Text = "$($script:UiCopy.openStudio)"
    }
    if ($null -ne $script:LauncherDesktopItem -and -not $script:LauncherDesktopItem.IsDisposed) {
      $script:LauncherDesktopItem.Text = "$($script:UiCopy.openDesktopApp)"
    }
    if ($null -ne $script:LauncherButton -and -not $script:LauncherButton.IsDisposed) {
      $script:LauncherButton.AccessibleName = "$($script:UiCopy.navLauncherName)"
    }
    if ($null -ne $script:RetryButton -and -not $script:RetryButton.IsDisposed) {
      $script:RetryButton.Text = "$($script:UiCopy.retry)"
      $script:RetryButton.AccessibleName = "$($script:UiCopy.retry)"
    }
    Update-AuraUiRescueWindowCopy
    Update-AuraUiRescueWindowTheme
    if ($null -ne $script:LoadingPanel -and -not $script:LoadingPanel.IsDisposed -and
        $script:LoadingPanel.Visible -and $null -ne $script:LoadingLabel -and
        -not $script:LoadingLabel.IsDisposed) {
      $script:LoadingLabel.Text = if ($script:RetryButton.Visible) {
        "$($script:UiCopy.loadFailed)"
      } else {
        "$($script:UiCopy.loadingClaude)"
      }
    }
    Hide-AuraUiLauncherTip
    if ($null -ne $script:LauncherHint -and -not $script:LauncherHint.IsDisposed) {
      $script:LauncherHint.Close()
    }
    Update-AuraUiTrayAppearance
    $script:JumpListRegistered = $false
    $script:JumpListRegistrationDue = [DateTime]::UtcNow
  } catch {
    Write-AuraUiLog -Message "Localized Aura chrome could not be fully refreshed: $($_.Exception.Message)"
  }
}

function Invoke-AuraUiSetLocale {
  param([Parameter(Mandatory = $true)][string]$Locale)
  if ($Locale -cnotin $StudioLocaleIds) {
    throw 'Studio locale is invalid.'
  }
  if ((Get-AuraUiPropertyValue -InputObject $script:StudioEditorState -Names @('active')) -eq $true) {
    throw 'Finish or discard the current Aura Studio edit before changing language.'
  }
  if ($null -ne $script:StudioPreferences -and
      $script:StudioPreferences.locale -ceq $Locale -and $script:Locale -ceq $Locale) {
    Send-AuraUiStudioState
    return
  }

  $previousPreferences = $script:StudioPreferences
  $previousLocale = $script:Locale
  try {
    $introductionVersion = if ($null -ne $previousPreferences) {
      [int]$previousPreferences.introductionVersion
    } else { 0 }
    $script:StudioPreferences = Write-AuraUiStudioPreferences `
      -Locale $Locale -IntroductionVersion $introductionVersion
    $script:Locale = $Locale
    $script:UiCopy = Get-AuraUiCopy -Locale $script:Locale
    Update-AuraUiLocalizedChrome
    [void](Update-AuraUiThemes)
    Set-AuraUiConfig -Options @()
    if ($null -ne $script:StudioWebView -and $null -ne $script:StudioWebView.CoreWebView2) {
      $script:StudioReady = $false
      $script:StudioWebView.CoreWebView2.Navigate((Get-AuraUiStudioUrl -PreserveView))
    }
  } catch {
    $failure = $_
    $script:Locale = $previousLocale
    $script:UiCopy = Get-AuraUiCopy -Locale $script:Locale
    if ($null -ne $previousPreferences) {
      try {
        $script:StudioPreferences = Write-AuraUiStudioPreferences `
          -Locale ([string]$previousPreferences.locale) `
          -IntroductionVersion ([int]$previousPreferences.introductionVersion)
      } catch {
        Write-AuraUiLog -Message "Studio locale rollback could not restore preferences: $($_.Exception.Message)"
        $script:StudioPreferences = $previousPreferences
      }
    }
    Update-AuraUiLocalizedChrome
    try {
      [void](Update-AuraUiThemes)
      Set-AuraUiConfig -Options @()
    } catch {
      Write-AuraUiLog -Message "Studio locale rollback could not refresh runtime state: $($_.Exception.Message)"
    }
    throw $failure
  }
}

function Invoke-AuraUiCompleteStudioIntroduction {
  $locale = if ($StudioLocaleIds -ccontains $script:Locale) { $script:Locale } else { 'en' }
  $script:StudioPreferences = Write-AuraUiStudioPreferences `
    -Locale $locale -IntroductionVersion $StudioIntroductionVersion
  $script:StudioIntroductionRequested = $false
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
        { $_ -cin @('launcherSurface', 'launcherSurfaceHover', 'launcherForeground', 'launcherAccent', 'launcherBorder') } {
          if ($Message.value -isnot [string] -or $Message.value -cnotmatch '^#[0-9A-Fa-f]{6}$') {
            throw 'Aura Studio launcher colors require a six-digit hex color.'
          }
          break
        }
        'launcherRadius' { [void](ConvertTo-AuraUiStudioNumber -Value $Message.value -Minimum 8 -Maximum 24 -Label 'Launcher radius'); break }
        'launcherBorderWidth' { [void](ConvertTo-AuraUiStudioNumber -Value $Message.value -Minimum 1 -Maximum 3 -Label 'Launcher border width'); break }
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
    'apply-theme-patch' {
      if ($Message.changes -isnot [System.Array]) {
        throw 'Aura Studio theme patches must supply a changes array.'
      }
      $changes = @($Message.changes)
      if ($changes.Count -lt 1 -or $changes.Count -gt 16) {
        throw 'Aura Studio theme patches must contain between 1 and 16 changes.'
      }
      foreach ($change in $changes) {
        if ($change -isnot [System.Management.Automation.PSCustomObject] -or
            $change.kind -isnot [string]) {
          throw 'Aura Studio theme patch changes must be objects with a kind.'
        }
        switch -CaseSensitive ([string]$change.kind) {
          'token' {
            if (-not (Test-AuraUiStudioExactProperties -Message $change -Names @('kind', 'mode', 'token', 'value'))) {
              throw 'Aura Studio token patches have an invalid shape.'
            }
            $tokenMessage = [PSCustomObject][ordered]@{
              type = 'set-theme-token'; session = $Message.session; revision = $Message.revision
              mode = $change.mode; token = $change.token; value = $change.value
            }
            Assert-AuraUiStudioEditorMessage -Message $tokenMessage
            break
          }
          'layer' {
            if (-not (Test-AuraUiStudioExactProperties -Message $change -Names @('kind', 'index', 'preset', 'property', 'value'))) {
              throw 'Aura Studio layer patches have an invalid shape.'
            }
            $layerMessage = [PSCustomObject][ordered]@{
              type = 'set-theme-layer'; session = $Message.session; revision = $Message.revision
              index = $change.index; preset = $change.preset; property = $change.property; value = $change.value
            }
            Assert-AuraUiStudioEditorMessage -Message $layerMessage
            break
          }
          'metadata' {
            if (-not (Test-AuraUiStudioExactProperties -Message $change -Names @('kind', 'field', 'locale', 'value')) -or
                $change.field -isnot [string] -or $change.field -cnotin @('label', 'description') -or
                $change.locale -isnot [string] -or $change.locale -cnotin @('en', 'zh-CN', 'zh-HKTW') -or
                $change.value -isnot [string]) {
              throw 'Aura Studio metadata patches are invalid.'
            }
            $maximum = if ($change.field -ceq 'label') { 80 } else { 220 }
            if (-not $change.value.Trim() -or $change.value.Length -gt $maximum -or
                $change.value -match '[\x00-\x08\x0B\x0C\x0E-\x1F]') {
              throw 'Aura Studio metadata text is invalid.'
            }
            break
          }
          'greeting' {
            # One gesture sends one complete bounded Light/Dark + Standard/Wide
            # frame. The host validates that exact wire shape before Node sees it.
            if (-not (Test-AuraUiStudioExactProperties -Message $change `
                  -Names @('kind', 'operation', 'appearance', 'frame', 'value')) -or
                $change.operation -isnot [string] -or
                $change.operation -cnotin @('set-frame', 'reset') -or
                $change.appearance -isnot [string] -or
                $change.appearance -cnotin @('light', 'dark') -or
                $change.frame -isnot [string] -or
                $change.frame -cnotin @('standard', 'wide')) {
              throw 'Aura Studio greeting patches have an invalid shape.'
            }
            if ($change.operation -ceq 'reset') {
              if ($null -ne $change.value) {
                throw 'Aura Studio greeting reset must carry a null value.'
              }
              break
            }
            $value = $change.value
            $frameNames = @(
              'font', 'color', 'fontSize', 'weight', 'italic', 'align',
              'letterSpacing', 'lineHeight', 'maxWidthRatio', 'xRatio', 'yRatio',
              'decoration', 'markSource', 'markScale')
            if ($value -isnot [System.Management.Automation.PSCustomObject] -or
                -not (Test-AuraUiStudioExactProperties -Message $value -Names $frameNames)) {
              throw 'Aura Studio greeting frame has an invalid shape.'
            }
            if ($value.font -isnot [string] -or
                $value.font -cnotin @('system-sans', 'humanist-sans', 'rounded-sans', 'editorial-serif') -or
                $value.color -isnot [string] -or $value.color -cnotin @('primary', 'accent') -or
                $value.align -isnot [string] -or $value.align -cnotin @('start', 'center', 'end') -or
                $value.decoration -isnot [string] -or
                $value.decoration -cnotin @('none', 'underline', 'hairline', 'glow') -or
                $value.markSource -isnot [string] -or
                $value.markSource -cnotin @('none', 'native', 'compact') -or
                $value.italic -isnot [bool]) {
              throw 'Aura Studio greeting frame has an invalid option.'
            }
            $weight = ConvertTo-AuraUiStudioInteger `
              -Value $value.weight -Minimum 300 -Maximum 700 -Label 'Greeting weight'
            if ($weight -notin @(300, 400, 500, 600, 650, 700)) {
              throw 'Aura Studio greeting weight is invalid.'
            }
            [void](ConvertTo-AuraUiStudioNumber -Value $value.fontSize -Minimum 24 -Maximum 72 -Label 'Greeting size')
            [void](ConvertTo-AuraUiStudioNumber -Value $value.letterSpacing -Minimum -0.06 -Maximum 0.12 -Label 'Greeting letter spacing')
            [void](ConvertTo-AuraUiStudioNumber -Value $value.lineHeight -Minimum 0.9 -Maximum 1.5 -Label 'Greeting line height')
            [void](ConvertTo-AuraUiStudioNumber -Value $value.maxWidthRatio -Minimum 0.35 -Maximum 0.9 -Label 'Greeting maximum width')
            [void](ConvertTo-AuraUiStudioNumber -Value $value.xRatio -Minimum -0.45 -Maximum 0.45 -Label 'Greeting horizontal position')
            [void](ConvertTo-AuraUiStudioNumber -Value $value.yRatio -Minimum -0.4 -Maximum 0.45 -Label 'Greeting vertical position')
            [void](ConvertTo-AuraUiStudioNumber -Value $value.markScale -Minimum 0.5 -Maximum 1.5 -Label 'Greeting mark size')
            break
          }
          default { throw 'Aura Studio theme patch kind is not allowed.' }
        }
      }
      break
    }
    'set-greeting-phrases' {
      # WO-21 personal greeting words. Node's validateGreetingPreferences is
      # authoritative; these mirror its bounds so malformed page data never reaches it.
      if ($Message.enabled -isnot [bool]) {
        throw 'Aura Studio greeting enabled state must be a Boolean.'
      }
      if ($Message.source -isnot [string] -or $Message.source -cnotin @('claude', 'custom')) {
        throw 'Aura Studio greeting source is invalid.'
      }
      if ($Message.displayName -isnot [string]) {
        throw 'Aura Studio greeting name is invalid.'
      }
      $normalizedGreetingName = $Message.displayName.Normalize(
        [Text.NormalizationForm]::FormC).Trim()
      if ((Get-AuraUiUnicodeScalarLength -Value $normalizedGreetingName) -gt 40 -or
          $normalizedGreetingName -match '[\x00-\x1F\x7F-\x9F]') {
        throw 'Aura Studio greeting name is invalid.'
      }
      if ($Message.overrideMode -isnot [string] -or
          $Message.overrideMode -cnotin @('global', 'claude', 'custom')) {
        throw 'Aura Studio greeting theme override is invalid.'
      }
      foreach ($phraseListName in @('globalPhrases', 'overridePhrases')) {
        $phraseList = $Message.$phraseListName
        if ($phraseList -isnot [System.Array]) {
          throw 'Aura Studio greeting phrases must be arrays.'
        }
        $greetingPhrases = @($phraseList)
        if ($greetingPhrases.Count -gt 12) {
          throw 'Aura Studio accepts at most 12 greeting phrases per list.'
        }
        $seenPhrases = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
        foreach ($greetingPhrase in $greetingPhrases) {
          if ($greetingPhrase -isnot [string]) {
            throw 'Aura Studio greeting phrase is invalid.'
          }
          $normalizedGreetingPhrase = $greetingPhrase.Normalize(
            [Text.NormalizationForm]::FormC).Trim()
          # String.Replace is ordinal and case-sensitive. PowerShell's -replace
          # is case-insensitive by default and would otherwise accept `{NAME}`
          # here even though Node correctly permits only the exact `{name}` token.
          $withoutNameToken = $normalizedGreetingPhrase.Replace('{name}', '')
          if (-not $normalizedGreetingPhrase -or
              (Get-AuraUiUnicodeScalarLength -Value $normalizedGreetingPhrase) -gt 120 -or
              $normalizedGreetingPhrase -match '[\x00-\x1F\x7F-\x9F]' -or
              ([regex]::Matches($normalizedGreetingPhrase, '\{name\}')).Count -gt 1 -or
              $withoutNameToken -match '[{}]' -or
              -not $seenPhrases.Add($normalizedGreetingPhrase)) {
            throw 'Aura Studio greeting phrase is invalid.'
          }
        }
      }
      if ($Message.overrideMode -ceq 'custom' -and @($Message.overridePhrases).Count -eq 0) {
        throw 'Aura Studio custom greeting override requires a phrase.'
      }
      break
    }
    'pick-theme-layer-image' {
      [void](ConvertTo-AuraUiStudioInteger -Value $Message.index -Minimum -1 -Maximum 7 -Label 'Theme layer index')
      if ($Message.role -isnot [string] -or
          $Message.role -cnotin @('background', 'hero', 'corner', 'decoration')) {
        throw 'Aura Studio image layer role is invalid.'
      }
      if ($Message.appearance -isnot [string] -or $Message.appearance -cnotin @('all', 'light', 'dark')) {
        throw 'Aura Studio image layer appearance is invalid.'
      }
      if ($Message.context -isnot [string] -or $Message.context -cnotin @('all', 'new-chat', 'conversation')) {
        throw 'Aura Studio image layer context is invalid.'
      }
      break
    }
    'pick-theme-launcher-mark' { break }
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
  if ($Json.Length -gt 16384) { throw 'Studio message is too large.' }
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
    'set-locale' { 'type'; 'locale'; break }
    'set-enabled' { 'type'; 'enabled'; break }
    'set-image-framing' { 'type'; 'x'; 'y'; 'zoom'; break }
    'set-avatar-framing' { 'type'; 'x'; 'y'; 'zoom'; 'background'; break }
    'set-card-preview-crop' { 'type'; 'theme'; 'x'; 'y'; 'zoom'; break }
    'create-theme-copy' { 'type'; 'theme'; break }
    'begin-theme-edit' { 'type'; 'theme'; 'reset'; break }
    'set-theme-token' { 'type'; 'session'; 'revision'; 'mode'; 'token'; 'value'; break }
    'set-theme-layer' { 'type'; 'session'; 'revision'; 'index'; 'preset'; 'property'; 'value'; break }
    'apply-theme-patch' { 'type'; 'session'; 'revision'; 'changes'; break }
    'pick-theme-layer-image' { 'type'; 'session'; 'revision'; 'index'; 'role'; 'appearance'; 'context'; break }
    'pick-theme-launcher-mark' { 'type'; 'session'; 'revision'; break }
    'remove-theme-layer' { 'type'; 'session'; 'revision'; 'index'; break }
    'move-theme-layer' { 'type'; 'session'; 'revision'; 'index'; 'direction'; break }
    'undo-theme-edit' { 'type'; 'session'; 'revision'; break }
    'redo-theme-edit' { 'type'; 'session'; 'revision'; break }
    'save-theme-edit' { 'type'; 'session'; 'revision'; break }
    'discard-theme-edit' { 'type'; 'session'; 'revision'; break }
    'delete-user-theme' { 'type'; 'theme'; break }
    'set-greeting-phrases' {
      'type'; 'session'; 'revision'; 'enabled'; 'source'; 'displayName'
      'globalPhrases'; 'overrideMode'; 'overridePhrases'
      break
    }
    'reset-greeting' { 'type'; 'session'; 'revision'; break }
    'set-aura-preview' { 'type'; 'size'; 'request'; break }
    'set-aura-topmost' { 'type'; 'enabled'; break }
    default { 'type'; break }
  })
  $propertyNames = @($message.PSObject.Properties | ForEach-Object { $_.Name })
  if ($propertyNames.Count -ne $expectedProperties.Count) { throw 'Studio message has unexpected properties.' }
  foreach ($name in $expectedProperties) {
    if ($propertyNames -cnotcontains $name) { throw 'Studio message is missing a required property.' }
  }
  if ($type -in @(
      'create-theme-copy', 'begin-theme-edit', 'set-theme-token', 'set-theme-layer', 'apply-theme-patch',
      'pick-theme-layer-image', 'pick-theme-launcher-mark', 'remove-theme-layer', 'move-theme-layer', 'undo-theme-edit',
      'redo-theme-edit', 'save-theme-edit', 'discard-theme-edit', 'delete-user-theme',
      'set-greeting-phrases', 'reset-greeting')) {
    Assert-AuraUiStudioEditorMessage -Message $message
  }
  if ($type -ceq 'set-locale' -and
      ($message.locale -isnot [string] -or $message.locale -cnotin $StudioLocaleIds)) {
    throw 'Studio locale is invalid.'
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
    'set-locale' {
      Invoke-AuraUiSetLocale -Locale ([string]$message.locale)
      break
    }
    'complete-studio-introduction' {
      Invoke-AuraUiCompleteStudioIntroduction
      break
    }
    'set-image' { [void](Invoke-AuraUiChooseBackground -Owner $script:StudioForm); break }
    'clear-image' { Invoke-AuraUiClearBackground; break }
    'set-avatar' { [void](Invoke-AuraUiChooseAvatar -Owner $script:StudioForm); break }
    'clear-avatar' { Invoke-AuraUiClearAvatar; break }
    'set-avatar-framing' {
      Invoke-AuraUiSetAvatarFraming -X $message.x -Y $message.y -Zoom $message.zoom `
        -Background $message.background
      break
    }
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
      $previewRequest = ConvertTo-AuraUiStudioInteger -Value $message.request -Minimum 1 -Maximum 2147483647 -Label 'Aura preview request'
      Set-AuraUiPreviewSize -Size ([string]$message.size) -Request $previewRequest
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
    'apply-theme-patch' { [void](Invoke-AuraUiApplyThemePatch -Request $message); break }
    'pick-theme-layer-image' {
      [void](Invoke-AuraUiPickThemeLayerImage -Request $message -Owner $script:StudioForm)
      break
    }
    'pick-theme-launcher-mark' {
      [void](Invoke-AuraUiPickThemeLauncherMark -Request $message -Owner $script:StudioForm)
      break
    }
    'remove-theme-layer' { [void](Invoke-AuraUiRemoveThemeLayer -Request $message); break }
    'move-theme-layer' { [void](Invoke-AuraUiMoveThemeLayer -Request $message); break }
    'undo-theme-edit' { [void](Invoke-AuraUiUndoThemeEdit -Request $message); break }
    'redo-theme-edit' { [void](Invoke-AuraUiRedoThemeEdit -Request $message); break }
    'save-theme-edit' { [void](Invoke-AuraUiSaveThemeEdit -Request $message); break }
    'discard-theme-edit' { [void](Invoke-AuraUiDiscardThemeEdit -Request $message); break }
    'delete-user-theme' { [void](Invoke-AuraUiDeleteUserTheme -Request $message); break }
    'set-greeting-phrases' { [void](Invoke-AuraUiSetGreetingPhrases -Request $message); break }
    'reset-greeting' { [void](Invoke-AuraUiResetGreeting -Request $message); break }
  }
}

$script:Node = $null
$script:Config = $null
$script:Payload = ''
$script:ActiveLabel = ''
$script:ActiveThemeName = $null
$script:ActivePayloadDigest = $null
$script:Form = $null
$script:WebView = $null
$script:WebReady = $false
$script:PageReady = $false
$script:EnvironmentTask = $null
$script:EnsureTask = $null
$script:ScriptTask = $null
$script:ScriptAction = $null
$script:ScriptCovered = $false
$script:PendingApply = $false
$script:PendingRestore = $false
$script:ActiveNavigationId = $null
$script:ActiveNavigationUri = $null
$script:ReadyNavigationId = $null
$script:IsRescueSession = [bool]$RescueSession
$script:RescueActive = $false
$script:RescueReason = 'Challenge'
$script:RescueGeneration = [long]0
$script:RescueBreakerState = 'Closed'
$script:RescueAttemptCount = 0
$script:RescueChallengeCandidate = $null
$script:RescueVerificationPending = $false
$script:PendingNavigationCompletion = $null
$script:RescueLastNavigationId = $null
$script:RescueRestartRequested = $false
$script:RescueForm = $null
$script:RescueAccentPanel = $null
$script:RescueEyebrowLabel = $null
$script:RescueTitleLabel = $null
$script:RescueBodyLabel = $null
$script:RescueBrowserButton = $null
$script:RescueCleanButton = $null
$script:RescueRetryButton = $null
$script:HostExecutable = [System.Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
$script:CurrentScriptPath = [IO.Path]::GetFullPath($PSCommandPath)
$script:Themes = @()
$script:UiCopy = $null
$script:Locale = 'en'
$script:StudioPreferences = $null
$script:StudioMessageTypes = @(
  'get-state',
  'set-theme',
  'set-appearance',
  'set-locale',
  'complete-studio-introduction',
  'set-image',
  'clear-image',
  'set-avatar',
  'clear-avatar',
  'set-avatar-framing',
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
  'apply-theme-patch',
  'pick-theme-layer-image',
  'pick-theme-launcher-mark',
  'remove-theme-layer',
  'move-theme-layer',
  'undo-theme-edit',
  'redo-theme-edit',
  'save-theme-edit',
  'discard-theme-edit',
  'delete-user-theme',
  'set-greeting-phrases',
  'reset-greeting',
  'set-aura-preview',
  'set-aura-topmost',
  'refresh-aura-mirror'
)
$script:StudioEditorState = [ordered]@{ active = $false }
$script:StudioEditorTrackedSession = $null
$script:StudioEditorEntryAppearance = $null
$script:StudioForm = $null
$script:StudioWebView = $null
$script:StudioEnsureTask = $null
$script:StudioReady = $false
$script:StudioInitializationFailed = $false
$script:StudioIntroductionRequested = $false
$script:StudioBackgroundFingerprint = $null
$script:StudioBackgroundPreviewUrl = $null
$script:StudioBackgroundPreviewPath = $null
$script:MirrorCaptureTask = $null
$script:MirrorStream = $null
$script:MirrorCaptureSession = $null
$script:MirrorCaptureRevision = [long]-1
$script:MirrorCapturePreviewRequest = -1
$script:MirrorCaptureGeneration = [long]-1
$script:MirrorDue = $null
$script:MirrorProbeTask = $null
$script:MirrorProbeGeneration = [long]-1
$script:MirrorGeometry = $null
$script:MirrorGeneration = [long]0
$script:MirrorPreviewRequest = 0
$script:MirrorSemanticRetries = 0
$script:MirrorSemanticPreviousContext = $null
$script:GreetingProbeDue = $null
$script:GreetingProbeTask = $null
$script:GreetingProbeGeneration = [long]0
$script:GreetingProbeTaskGeneration = [long]-1
$script:GreetingProbeTaskDigest = $null
$script:GreetingProbeRetries = 0
$script:GreetingProbeLastSummary = $null
$script:GreetingProbeLastStatus = $null
$script:GreetingShuffleCheckpointSummary = $null
$script:WebViewEnvironment = $null
$script:TrayIcon = $null
$script:TrayMenu = $null
$script:TrayOpenStudioItem = $null
$script:TrayAppearanceItem = $null
$script:TrayOpenDesktopItem = $null
$script:TrayExitItem = $null
$script:LoadingPanel = $null
$script:LoadingMark = $null
$script:LoadingLabel = $null
$script:LoadingProgress = $null
$script:LoadingProgressIndicator = $null
$script:LoadingAnimationTimer = $null
$script:LoadingProfile = $null
$script:RetryButton = $null
$script:MainIcon = $null
$script:StudioIcon = $null
$script:NotificationIcon = $null
$script:MainWindowIconPair = $null
$script:StudioWindowIconPair = $null
$script:MainIconWindow = $null
$script:StudioIconWindow = $null
$script:ThemeIdentityAssetPath = $null
$script:ThemeIdentityDigest = $null
$script:ThemeIdentityLock = $null
$script:IdentityRollbackIncomplete = $false
$script:DeferredIdentityCandidates = [Collections.Generic.List[object]]::new()
$script:ShellIdentityIconPath = $null
$script:JumpListIdentityPath = $null
$script:EffectiveLauncherIdentity = $null
$script:MainOpenSignal = $null
$script:StudioOpenSignal = $null
$script:Launcher = $null
$script:LauncherButton = $null
$script:LauncherDpiWindow = $null
$script:LauncherDpi = 96
$script:LauncherMenu = $null
$script:LauncherStudioItem = $null
$script:LauncherAppearanceItem = $null
$script:LauncherDesktopItem = $null
$script:LauncherStyle = $null
$script:LauncherMark = $null
$script:LauncherDragging = $false
$script:LauncherDragged = $false
$script:LauncherDragStart = $null
$script:LauncherDragOrigin = $null
$script:LauncherHover = $false
$script:LauncherPressed = $false
$script:LauncherCompactSize = 48
$script:LauncherHaloSize = 10
$script:LauncherSafeGap = 16
$script:LauncherRightGap = 16
$script:LauncherBottomGap = 16
$script:LauncherLayeredActive = $false
$script:LauncherAnimTimer = $null
$script:LauncherAnimValue = 0.0
$script:LauncherTip = $null
$script:LauncherTipTimer = $null
$script:LauncherTipBitmap = $null
$script:LauncherTipVisible = $false
$script:LauncherTipAlpha = 0
$script:LauncherTipDisabled = $false
$script:LauncherHint = $null
$script:LauncherHintShown = $false
$script:JumpListRegistered = $false
$script:JumpListRegistrationDue = [DateTime]::MinValue
$script:Closing = $false
$script:ExitRequested = $false
$mutex = $null
$ownsMutex = $false
$startupOperationLock = $null

try {
  # Serialize the entire pre-mutex startup window with install/uninstall. Once
  # the UI mutex exists, installers can detect this host without racing a
  # launcher that is still loading files from the app tree.
  $startupOperationLock = Enter-AuraOperationLock
  if ([Threading.Thread]::CurrentThread.ApartmentState -ne [Threading.ApartmentState]::STA) {
    throw 'Claude Aura must run in a standard Windows desktop session.'
  }

  [void](Assert-AuraUiStudioEditorRoots -Create)
  New-Item -ItemType Directory -Force -Path $DataRoot, $WebDataRoot, $StudioBackgroundRoot, $AvatarRoot | Out-Null
  $script:Node = Get-AuraNodeRuntime
  $script:StudioPreferences = Get-AuraUiStudioPreferences
  $script:Locale = [string]$script:StudioPreferences.locale
  $script:UiCopy = Get-AuraUiCopy -Locale $script:Locale
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
  if ($Mode -eq 'Restore') { $initialOptions += @('--enabled', 'false', '--appearance', 'system') }
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
    Add-Type -ReferencedAssemblies System.Windows.Forms, System.Drawing @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Windows.Forms;
public static class AuraWindow {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr handle);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr handle, int command);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool DestroyIcon(IntPtr handle);
  [DllImport("user32.dll", SetLastError = true)] public static extern bool SetProcessDpiAwarenessContext(IntPtr value);
  [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr value);
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr handle);
  [DllImport("user32.dll")] public static extern uint GetDpiForSystem();
  [DllImport("user32.dll")] public static extern int GetSystemMetricsForDpi(int index, uint dpi);
  [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern IntPtr LoadImageW(IntPtr instance, string name, uint type, int width, int height, uint flags);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern IntPtr SendMessage(IntPtr handle, uint message, IntPtr wParam, IntPtr lParam);
  [DllImport("shell32.dll")] public static extern int SetCurrentProcessExplicitAppUserModelID([MarshalAs(UnmanagedType.LPWStr)] string appID);
  [DllImport("shell32.dll", CharSet = CharSet.Unicode)] public static extern void SHChangeNotify(uint eventId, uint flags, string item1, string item2);
}
public sealed class AuraDpiChangedEventArgs : EventArgs {
  public AuraDpiChangedEventArgs(int dpi) { Dpi = dpi; }
  public int Dpi { get; private set; }
}
public sealed class AuraIconWindow : NativeWindow, IDisposable {
  const int WM_DPICHANGED = 0x02E0;
  [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr handle, int attribute, ref int value, int size);

  bool darkChrome;
  int captionColor = -1;

  public event EventHandler<AuraDpiChangedEventArgs> DpiChanged;
  public void Attach(IntPtr handle) {
    if (Handle == handle) return;
    if (Handle != IntPtr.Zero) ReleaseHandle();
    AssignHandle(handle);
    ApplyChrome();
  }
  public void Detach() {
    if (Handle != IntPtr.Zero) ReleaseHandle();
  }
  void ApplyChrome() {
    if (Handle == IntPtr.Zero) return;
    int value = darkChrome ? 1 : 0;
    if (DwmSetWindowAttribute(Handle, 20, ref value, sizeof(int)) < 0) {
      DwmSetWindowAttribute(Handle, 19, ref value, sizeof(int));
    }
    if (captionColor >= 0) {
      int color = captionColor;
      DwmSetWindowAttribute(Handle, 35, ref color, sizeof(int));
      // DWMWA_TEXT_COLOR, painted in the caption's own color. The window keeps
      // real title text so screen recorders and the Chromium/Electron screen
      // pickers enumerate it (they drop windows whose GetWindowTextLength is
      // 0), while the caption bar still reads as untitled.
      int textColor = captionColor;
      DwmSetWindowAttribute(Handle, 36, ref textColor, sizeof(int));
    }
    int noBorder = unchecked((int)0xFFFFFFFE);
    DwmSetWindowAttribute(Handle, 34, ref noBorder, sizeof(int));
  }
  public void SetDarkMode(bool dark) {
    darkChrome = dark;
    ApplyChrome();
  }
  public void SetCaptionColor(byte red, byte green, byte blue) {
    captionColor = red | (green << 8) | (blue << 16);
    ApplyChrome();
  }
  protected override void WndProc(ref Message message) {
    base.WndProc(ref message);
    if (message.Msg == WM_DPICHANGED) {
      int dpi = unchecked((int)((long)message.WParam & 0xFFFF));
      EventHandler<AuraDpiChangedEventArgs> handler = DpiChanged;
      if (handler != null && dpi > 0) handler(this, new AuraDpiChangedEventArgs(dpi));
      ApplyChrome();
    }
  }
  public void Dispose() { Detach(); }
}
public static class AuraLayered {
  // Per-pixel alpha presentation for the floating launcher and its hover tip.
  // UpdateLayeredWindow composites a premultiplied 32-bit bitmap, so the circular
  // edge antialiases against whatever is behind it and fully transparent pixels
  // are click-through — neither is possible with a 1-bit window region.
  [StructLayout(LayoutKind.Sequential)] public struct AuraNativePoint { public int X; public int Y; }
  [StructLayout(LayoutKind.Sequential)] public struct AuraNativeSize { public int Width; public int Height; }
  [StructLayout(LayoutKind.Sequential, Pack = 1)] public struct AuraBlendFunction {
    public byte BlendOp; public byte BlendFlags; public byte SourceConstantAlpha; public byte AlphaFormat;
  }
  [DllImport("user32.dll", SetLastError = true)] static extern int GetWindowLong(IntPtr handle, int index);
  [DllImport("user32.dll", SetLastError = true)] static extern int SetWindowLong(IntPtr handle, int index, int value);
  [DllImport("user32.dll", SetLastError = true)] static extern bool UpdateLayeredWindow(IntPtr handle, IntPtr screenDc, IntPtr windowPosition, ref AuraNativeSize size, IntPtr sourceDc, ref AuraNativePoint sourceOrigin, int colorKey, ref AuraBlendFunction blend, int flags);
  [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr handle);
  [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr handle, IntPtr dc);
  [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleDC(IntPtr dc);
  [DllImport("gdi32.dll")] static extern bool DeleteDC(IntPtr dc);
  [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr dc, IntPtr handle);
  [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr handle);
  public static void ClearLayeredStyle(IntPtr handle) {
    // Required before falling back to SetLayeredWindowAttributes-based opacity:
    // Windows forbids mixing the two layering modes on one WS_EX_LAYERED window.
    int style = GetWindowLong(handle, -20);
    if ((style & 0x80000) != 0) SetWindowLong(handle, -20, style & ~0x80000);
  }
  public static void SetTipStyles(IntPtr handle) {
    // Layered + tool window + no-activate + transparent: a purely decorative
    // surface that never takes focus and never intercepts the mouse.
    int style = GetWindowLong(handle, -20);
    SetWindowLong(handle, -20, style | 0x80000 | 0x80 | 0x8000000 | 0x20);
  }
  public static bool Apply(IntPtr handle, System.Drawing.Bitmap bitmap, byte opacity) {
    // WinForms rewrites the extended style from CreateParams on visibility and
    // owner changes, so the layered bit must be re-asserted on every present.
    int style = GetWindowLong(handle, -20);
    if ((style & 0x80000) == 0) SetWindowLong(handle, -20, style | 0x80000);
    IntPtr screenDc = GetDC(IntPtr.Zero);
    if (screenDc == IntPtr.Zero) return false;
    IntPtr memoryDc = IntPtr.Zero;
    IntPtr gdiBitmap = IntPtr.Zero;
    IntPtr previous = IntPtr.Zero;
    try {
      memoryDc = CreateCompatibleDC(screenDc);
      if (memoryDc == IntPtr.Zero) return false;
      gdiBitmap = bitmap.GetHbitmap(System.Drawing.Color.FromArgb(0));
      previous = SelectObject(memoryDc, gdiBitmap);
      AuraNativeSize size = new AuraNativeSize(); size.Width = bitmap.Width; size.Height = bitmap.Height;
      AuraNativePoint origin = new AuraNativePoint();
      AuraBlendFunction blend = new AuraBlendFunction();
      blend.BlendOp = 0; blend.BlendFlags = 0; blend.SourceConstantAlpha = opacity; blend.AlphaFormat = 1;
      return UpdateLayeredWindow(handle, screenDc, IntPtr.Zero, ref size, memoryDc, ref origin, 0, ref blend, 2);
    } finally {
      if (previous != IntPtr.Zero) SelectObject(memoryDc, previous);
      if (gdiBitmap != IntPtr.Zero) DeleteObject(gdiBitmap);
      if (memoryDc != IntPtr.Zero) DeleteDC(memoryDc);
      ReleaseDC(IntPtr.Zero, screenDc);
    }
  }
}
'@
  }
  # Opt into per-monitor-v2 sizing before EnableVisualStyles or the first Aura
  # HWND. The thread override keeps the STA UI correct even if a host-created
  # hidden PowerShell window prevented the process-wide call.
  try {
    $perMonitorV2 = [IntPtr]::new(-4)
    [void][AuraWindow]::SetProcessDpiAwarenessContext($perMonitorV2)
    if ([AuraWindow]::SetThreadDpiAwarenessContext($perMonitorV2) -eq [IntPtr]::Zero) {
      Write-AuraUiLog -Message 'Per-monitor-v2 thread DPI awareness was unavailable; Windows will use its safe fallback scaling.'
    }
  } catch {
    Write-AuraUiLog -Message "Per-monitor-v2 DPI awareness was unavailable: $($_.Exception.Message)"
  }
  # Give the process a stable taskbar identity so it stops grouping under the
  # generic PowerShell host. This is also the prerequisite for attaching a
  # taskbar Jump List to the running window in a later pass.
  try { [void][AuraWindow]::SetCurrentProcessExplicitAppUserModelID('ClaudeAura') } catch {}
  $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $mainSignalCreatedNew = $false
  $script:MainOpenSignal = [System.Threading.EventWaitHandle]::new(
    $false,
    [System.Threading.EventResetMode]::AutoReset,
    "Local\ClaudeAura.$sid.OpenMain",
    [ref]$mainSignalCreatedNew)
  $studioSignalCreatedNew = $false
  $script:StudioOpenSignal = [System.Threading.EventWaitHandle]::new(
    $false,
    [System.Threading.EventResetMode]::AutoReset,
    "Local\ClaudeAura.$sid.OpenStudio",
    [ref]$studioSignalCreatedNew)
  $createdNew = $false
  $mutex = [System.Threading.Mutex]::new($true, "Local\ClaudeAura.$sid.Ui", [ref]$createdNew)
  $ownsMutex = $createdNew
  Exit-AuraOperationLock -Mutex $startupOperationLock
  $startupOperationLock = $null
  if (-not $createdNew) {
    if ($OpenStudio) {
      [void]$script:StudioOpenSignal.Set()
    } else {
      [void]$script:MainOpenSignal.Set()
    }
    return
  }
  if ($OpenStudio) { [void]$script:StudioOpenSignal.Set() }

  [System.Windows.Forms.Application]::EnableVisualStyles()
  [System.Windows.Forms.Application]::SetCompatibleTextRenderingDefault($false)

  $script:Form = [System.Windows.Forms.Form]::new()
  $script:MainIconWindow = [AuraIconWindow]::new()
  $script:MainIconWindow.add_DpiChanged({
    param($sender, $eventArgs)
    Update-AuraUiNativeIdentityForDpi -Target Main -Form $script:Form -Dpi ([int]$eventArgs.Dpi)
  })
  $script:Form.add_HandleCreated({
    $script:MainIconWindow.Attach($script:Form.Handle)
    Update-AuraUiWindowChrome
    $dpi = Get-AuraUiWindowDpi -Form $script:Form
    if ($script:ThemeIdentityAssetPath -and
        ($null -eq $script:MainWindowIconPair -or $script:MainWindowIconPair.Dpi -ne $dpi)) {
      Update-AuraUiNativeIdentityForDpi -Target Main -Form $script:Form -Dpi $dpi
    } elseif ($null -ne $script:MainWindowIconPair) {
      Set-AuraUiNativeFormIcons -Form $script:Form `
        -Small $script:MainWindowIconPair.Small -Large $script:MainWindowIconPair.Large
    }
  })
  $script:Form.add_HandleDestroyed({ $script:MainIconWindow.Detach() })
  # Real caption text, not just an accessible name: screen recorders and the
  # browser/Electron screen pickers enumerate windows with GetWindowTextLength
  # and skip anything that returns 0, so an untitled window is invisible to
  # OBS, Recordly, and getDisplayMedia. It also names us in Alt+Tab.
  $script:Form.Text = 'Claude Aura'
  $script:Form.AccessibleName = 'Claude Aura'
  $script:Form.StartPosition = 'Manual'
  $script:Form.ClientSize = [Drawing.Size]::new(1180, 640)
  $script:Form.MinimumSize = [Drawing.Size]::new(920, 620)
  $script:Form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::Sizable
  $script:Form.ShowIcon = $false
  $script:Form.ControlBox = $true
  $script:Form.MinimizeBox = $true
  $script:Form.MaximizeBox = $true
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
  $script:StudioIconWindow = [AuraIconWindow]::new()
  $script:StudioIconWindow.add_DpiChanged({
    param($sender, $eventArgs)
    Update-AuraUiNativeIdentityForDpi -Target Studio -Form $script:StudioForm -Dpi ([int]$eventArgs.Dpi)
  })
  $script:StudioForm.add_HandleCreated({
    $script:StudioIconWindow.Attach($script:StudioForm.Handle)
    Update-AuraUiWindowChrome
    $dpi = Get-AuraUiWindowDpi -Form $script:StudioForm
    if ($script:ThemeIdentityAssetPath -and
        ($null -eq $script:StudioWindowIconPair -or $script:StudioWindowIconPair.Dpi -ne $dpi)) {
      Update-AuraUiNativeIdentityForDpi -Target Studio -Form $script:StudioForm -Dpi $dpi
    } elseif ($null -ne $script:StudioWindowIconPair) {
      Set-AuraUiNativeFormIcons -Form $script:StudioForm `
        -Small $script:StudioWindowIconPair.Small -Large $script:StudioWindowIconPair.Large
    }
  })
  $script:StudioForm.add_HandleDestroyed({ $script:StudioIconWindow.Detach() })
  $script:StudioForm.Text = "$($script:UiCopy.studioTitle)"
  $script:StudioForm.AccessibleName = "$($script:UiCopy.studioTitle)"
  $script:StudioForm.StartPosition = 'Manual'
  $script:StudioForm.ClientSize = [Drawing.Size]::new(1080, 720)
  $script:StudioForm.MinimumSize = [Drawing.Size]::new(760, 560)
  $script:StudioForm.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::Sizable
  $script:StudioForm.ShowIcon = $false
  $script:StudioForm.ControlBox = $true
  $script:StudioForm.MinimizeBox = $true
  $script:StudioForm.MaximizeBox = $true
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
      Restore-AuraUiStudioPreviewState
      $sender.Hide()
      # Studio and the main Aura window are the app's two primary surfaces. If the
      # main window is no longer open, Studio was the last one on screen, so
      # closing it shuts the whole app down instead of leaving it idle in the tray.
      $mainVisible = $null -ne $script:Form -and -not $script:Form.IsDisposed -and $script:Form.Visible
      if (-not $mainVisible -and -not $script:ExitRequested) {
        [void]$sender.BeginInvoke([Action] { Request-AuraUiExit })
      }
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
  $script:TrayExitItem.add_Click({ Request-AuraUiExit })
  $script:TrayIcon = [System.Windows.Forms.NotifyIcon]::new()
  $script:TrayIcon.Text = 'Claude Aura'
  $script:TrayIcon.Icon = $script:NotificationIcon
  $script:TrayIcon.ContextMenuStrip = $script:TrayMenu
  $script:TrayIcon.add_DoubleClick({ Show-AuraUiStudio })
  $script:TrayIcon.Visible = $false
  Update-AuraUiTrayAppearance

  $script:LoadingPanel = [System.Windows.Forms.Panel]::new()
  $script:LoadingPanel.Dock = 'Fill'
  $script:LoadingPanel.BackColor = [Drawing.ColorTranslator]::FromHtml('#F1F2F9')
  $script:LoadingPanel.add_Paint({
    param($sender, $eventArgs)
    Paint-AuraUiLoadingPanel -Graphics $eventArgs.Graphics -Bounds $sender.ClientRectangle
  })
  $script:LoadingMark = [System.Windows.Forms.PictureBox]::new()
  $script:LoadingMark.Size = [Drawing.Size]::new(76, 76)
  $script:LoadingMark.SizeMode = [System.Windows.Forms.PictureBoxSizeMode]::Zoom
  $script:LoadingMark.BackColor = [Drawing.Color]::Transparent
  $script:LoadingMark.TabStop = $false
  $script:LoadingMark.AccessibleRole = [System.Windows.Forms.AccessibleRole]::None
  $script:LoadingLabel = [System.Windows.Forms.Label]::new()
  $script:LoadingLabel.Text = "$($script:UiCopy.openingClaude)"
  $script:LoadingLabel.TextAlign = 'MiddleCenter'
  $script:LoadingLabel.Font = [Drawing.Font]::new('Segoe UI Semibold', 15)
  $script:LoadingLabel.ForeColor = [Drawing.ColorTranslator]::FromHtml('#171A31')
  $script:LoadingLabel.BackColor = [Drawing.Color]::Transparent
  $script:LoadingLabel.Size = [Drawing.Size]::new(500, 44)
  $script:LoadingProgress = [System.Windows.Forms.Panel]::new()
  $script:LoadingProgress.Size = [Drawing.Size]::new(320, 6)
  $script:LoadingProgress.AccessibleRole = [System.Windows.Forms.AccessibleRole]::ProgressBar
  $script:LoadingProgress.AccessibleName = "$($script:UiCopy.openingClaude)"
  $script:LoadingProgress.TabStop = $false
  $script:LoadingProgressIndicator = [System.Windows.Forms.Panel]::new()
  $script:LoadingProgressIndicator.Size = [Drawing.Size]::new(90, 6)
  $script:LoadingProgressIndicator.TabStop = $false
  $script:LoadingProgress.Controls.Add($script:LoadingProgressIndicator)
  $script:LoadingAnimationTimer = [System.Windows.Forms.Timer]::new()
  $script:LoadingAnimationTimer.Interval = 30
  $script:LoadingAnimationTimer.add_Tick({
    if ($null -eq $script:LoadingPanel -or -not $script:LoadingPanel.Visible -or
        $null -eq $script:LoadingProgress -or -not $script:LoadingProgress.Visible) {
      $script:LoadingAnimationTimer.Stop()
      return
    }
    $dpi = if ($null -ne $script:Form -and -not $script:Form.IsDisposed) {
      [Math]::Max(96, [int]$script:Form.DeviceDpi)
    } else { 96 }
    $step = [Math]::Max(4, [int][Math]::Round(7 * ($dpi / 96.0)))
    $nextLeft = $script:LoadingProgressIndicator.Left + $step
    if ($nextLeft -gt $script:LoadingProgress.Width) {
      $nextLeft = -$script:LoadingProgressIndicator.Width
    }
    $script:LoadingProgressIndicator.Left = $nextLeft
  })
  $script:RetryButton = [System.Windows.Forms.Button]::new()
  $script:RetryButton.Text = "$($script:UiCopy.retry)"
  $script:RetryButton.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
  $script:RetryButton.FlatAppearance.BorderSize = 1
  $script:RetryButton.FlatAppearance.BorderColor = [Drawing.ColorTranslator]::FromHtml('#21243B')
  $script:RetryButton.BackColor = [Drawing.ColorTranslator]::FromHtml('#4721A1')
  $script:RetryButton.ForeColor = [Drawing.Color]::White
  $script:RetryButton.UseVisualStyleBackColor = $false
  $script:RetryButton.Cursor = [System.Windows.Forms.Cursors]::Hand
  $script:RetryButton.AccessibleName = "$($script:UiCopy.retry)"
  $script:RetryButton.AccessibleRole = [System.Windows.Forms.AccessibleRole]::PushButton
  $script:RetryButton.TabStop = $true
  $script:RetryButton.Size = [Drawing.Size]::new(96, 38)
  $script:RetryButton.Visible = $false
  $script:LoadingPanel.Controls.AddRange(@(
    $script:LoadingMark,
    $script:LoadingLabel,
    $script:LoadingProgress,
    $script:RetryButton
  ))
  $script:LoadingPanel.add_Resize({ Set-AuraUiLoadingLayout })
  Update-AuraUiLoadingTheme

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
  # The permanently circular button opens Studio on a click and becomes a drag
  # surface only after the DPI-scaled movement threshold; right-click exposes
  # appearance and Desktop actions. It never touches the claude.ai document.
  $script:LauncherMenu = [System.Windows.Forms.ContextMenuStrip]::new()
  $script:LauncherStudioItem = [System.Windows.Forms.ToolStripMenuItem]::new("$($script:UiCopy.openStudio)")
  $script:LauncherAppearanceItem = [System.Windows.Forms.ToolStripMenuItem]::new("$($script:UiCopy.originalLook)")
  $script:LauncherDesktopItem = [System.Windows.Forms.ToolStripMenuItem]::new("$($script:UiCopy.openDesktopApp)")
  [void]$script:LauncherMenu.Items.AddRange(@(
    $script:LauncherStudioItem,
    $script:LauncherAppearanceItem,
    $script:LauncherDesktopItem
  ))
  $script:LauncherMenu.add_Opening({
    Hide-AuraUiLauncherTip
    Update-AuraUiTrayAppearance
  })
  $script:LauncherStudioItem.add_Click({ Show-AuraUiStudio -OfferIntroduction })
  $script:LauncherAppearanceItem.add_Click({
    try {
      Invoke-AuraUiSetEnabled -Enabled (-not (Get-AuraUiEnabled))
    } catch {
      Write-AuraUiLog -Message $_.Exception.ToString()
      Show-AuraUiMessage -Title "$($script:UiCopy.appearanceNotChangedTitle)" -Icon Warning -Message "$($script:UiCopy.appearanceNotChangedMessage)"
    }
  })
  $script:LauncherDesktopItem.add_Click({
    try {
      Invoke-AuraUiOpenDesktopApp
    } catch {
      Write-AuraUiLog -Message $_.Exception.ToString()
      Show-AuraUiMessage -Title "$($script:UiCopy.desktopNotFoundTitle)" -Icon Information -Message "$($script:UiCopy.desktopNotFoundMessage)"
    }
  })

  $script:Launcher = [System.Windows.Forms.Form]::new()
  $script:LauncherDpiWindow = [AuraIconWindow]::new()
  $script:LauncherDpiWindow.add_DpiChanged({
    param($sender, $eventArgs)
    Update-AuraUiLauncherDpi -Dpi ([int]$eventArgs.Dpi)
  })
  $script:Launcher.add_HandleCreated({
    $script:LauncherDpiWindow.Attach($script:Launcher.Handle)
    $script:LauncherDpi = Get-AuraUiWindowDpi -Form $script:Launcher
  })
  $script:Launcher.add_HandleDestroyed({ $script:LauncherDpiWindow.Detach() })
  $script:Launcher.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
  $script:Launcher.ShowInTaskbar = $false
  $script:Launcher.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
  $script:Launcher.AutoScaleMode = [System.Windows.Forms.AutoScaleMode]::None
  $script:LauncherDpi = Get-AuraUiWindowDpi -Form $script:Launcher
  # Honor an explicit opt-out of layered rendering before any visual is built.
  if ($null -ne $script:Config -and $null -ne $script:Config.PSObject.Properties['launcherClassic'] -and
      [bool]$script:Config.launcherClassic) {
    $script:LauncherLayeredActive = $false
  }
  # The window carries a transparent halo around the circle for the layered
  # renderer's shadow and hover growth; only the inner circle takes input.
  $launcherMetrics = Get-AuraUiLauncherMetrics
  $script:Launcher.ClientSize = [Drawing.Size]::new($launcherMetrics.Client, $launcherMetrics.Client)
  $script:Launcher.BackColor = [Drawing.ColorTranslator]::FromHtml('#2F2937')
  if (-not $script:LauncherLayeredActive) { $script:Launcher.Opacity = 0.96 }
  $script:Launcher.Text = 'Claude Aura'

  $script:LauncherButton = [System.Windows.Forms.Button]::new()
  $script:LauncherButton.Bounds = [Drawing.Rectangle]::new(
    $launcherMetrics.Halo, $launcherMetrics.Halo, $launcherMetrics.Compact, $launcherMetrics.Compact)
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
    if ($sender.ClientSize.Width -le 0 -or $sender.ClientSize.Height -le 0) { return }
    $graphicsState = $graphics.Save()
    try {
    $launcherScale = Get-AuraUiLauncherScale
    $graphics.ScaleTransform([float]$launcherScale, [float]$launcherScale)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $width = [double]$sender.ClientSize.Width / $launcherScale
    $height = [double]$sender.ClientSize.Height / $launcherScale
    $style = if ($null -ne $script:LauncherStyle) { $script:LauncherStyle } else { Get-AuraUiLauncherDefaultStyle }
    $surface = if ($script:LauncherHover) { "$($style.surfaceHover)" } else { "$($style.surface)" }
    $fill = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml($surface))
    $borderWidth = [float]$style.borderWidth
    $bounds = [Drawing.RectangleF]::new($borderWidth / 2, $borderWidth / 2, $width - $borderWidth, $height - $borderWidth)
    # The launcher always paints as the collapsed circular button.
    $cornerRadius = [double]$height / 2
    $shape = New-AuraUiRoundedRectanglePath -Bounds $bounds -Radius $cornerRadius
    $graphics.FillPath($fill, $shape)
    $fill.Dispose()
    $rim = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml("$($style.border)"), $borderWidth)
    $graphics.DrawPath($rim, $shape)
    $rim.Dispose()
    $shape.Dispose()

    $iconX = [Math]::Floor(($width - 32) / 2)
    if ($null -ne $script:LauncherMark) {
      $previousInterpolation = $graphics.InterpolationMode
      $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.DrawImage($script:LauncherMark, [Drawing.Rectangle]::new($iconX, 8, 32, 32))
      $graphics.InterpolationMode = $previousInterpolation
      # Keep the bounded accent token visible even when the authored bitmap is
      # present; otherwise this editor control would affect only the fallback.
      $badge = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml("$($style.accent)"))
      $graphics.FillEllipse($badge, [float]($iconX + 25), 33, 5, 5)
      $badge.Dispose()
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

    } finally {
      $graphics.Restore($graphicsState)
    }
  })
  # Pointer handling is shared between the button and its window so the halo
  # ring behaves like part of the button and input keeps working even if a
  # layered window ever routes a message past the invisible child control.
  $launcherPointerInside = {
    if ($null -eq $script:Launcher -or $script:Launcher.IsDisposed -or -not $script:Launcher.Visible) { return $false }
    $cursor = [System.Windows.Forms.Cursor]::Position
    $bounds = $script:Launcher.Bounds
    $deltaX = $cursor.X - ($bounds.X + ($bounds.Width / 2.0))
    $deltaY = $cursor.Y - ($bounds.Y + ($bounds.Height / 2.0))
    $radius = $bounds.Width / 2.0
    return ((($deltaX * $deltaX) + ($deltaY * $deltaY)) -le ($radius * $radius))
  }
  $launcherPointerDown = {
    param($sender, $eventArgs)
    if ($eventArgs.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
      # The whole collapsed button is the drag surface: a press arms a potential
      # drag, and the DPI-scaled movement threshold below decides whether the
      # gesture was a drag or the Studio click.
      $script:LauncherDragging = $true
      $script:LauncherDragged = $false
      $script:LauncherDragStart = [System.Windows.Forms.Cursor]::Position
      $script:LauncherDragOrigin = $script:Launcher.Location
      $script:LauncherPressed = $true
      Hide-AuraUiLauncherTip
      Update-AuraUiLauncherSurface
    }
  }
  $launcherPointerMove = {
    param($sender, $eventArgs)
    if (-not $script:LauncherDragging) { return }
    $now = [System.Windows.Forms.Cursor]::Position
    $deltaX = $now.X - $script:LauncherDragStart.X
    $deltaY = $now.Y - $script:LauncherDragStart.Y
    $dragThreshold = ConvertTo-AuraUiLauncherPixels -Logical 6
    if (-not $script:LauncherDragged -and
        ([Math]::Abs($deltaX) -gt $dragThreshold -or [Math]::Abs($deltaY) -gt $dragThreshold)) {
      $script:LauncherDragged = $true
      $sender.Cursor = [System.Windows.Forms.Cursors]::SizeAll
      Hide-AuraUiLauncherTip
    }
    if ($script:LauncherDragged) {
      $target = [Drawing.Point]::new($script:LauncherDragOrigin.X + $deltaX, $script:LauncherDragOrigin.Y + $deltaY)
      $script:Launcher.Location = Get-AuraUiLauncherClampedLocation -Location $target
    }
  }
  $launcherPointerUp = {
    param($sender, $eventArgs)
    if ($eventArgs.Button -eq [System.Windows.Forms.MouseButtons]::Right) {
      $script:LauncherDragging = $false
      $script:LauncherDragged = $false
      Hide-AuraUiLauncherTip
      $script:LauncherMenu.Show([System.Windows.Forms.Cursor]::Position)
      return
    }
    if ($eventArgs.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
      $moved = $script:LauncherDragged
      $wasClickArmed = $script:LauncherDragging -and -not $moved
      $script:LauncherDragging = $false
      $script:LauncherDragged = $false
      $script:LauncherPressed = $false
      $sender.Cursor = [System.Windows.Forms.Cursors]::Hand
      Update-AuraUiLauncherSurface
      if ($moved) {
        Save-AuraUiLauncherPosition
      } elseif ($wasClickArmed) {
        Show-AuraUiStudio -OfferIntroduction
      }
    }
  }
  $launcherPointerEnter = {
    $script:LauncherHover = $true
    Start-AuraUiLauncherAnimation
    if (-not $script:LauncherTipDisabled -and -not $script:LauncherTipVisible -and
        -not $script:LauncherDragging -and $null -ne $script:LauncherTipTimer) {
      $script:LauncherTipTimer.Stop()
      $script:LauncherTipTimer.Start()
    }
  }
  $launcherPointerLeave = {
    # Moving between the button and its halo raises a leave event without the
    # pointer actually leaving the launcher; keep the hover state in that case.
    if (& $launcherPointerInside) { return }
    $script:LauncherHover = $false
    $script:LauncherPressed = $false
    Hide-AuraUiLauncherTip
    Start-AuraUiLauncherAnimation
  }
  $script:LauncherButton.add_MouseDown($launcherPointerDown)
  $script:LauncherButton.add_MouseMove($launcherPointerMove)
  $script:LauncherButton.add_MouseUp($launcherPointerUp)
  $script:LauncherButton.add_MouseEnter($launcherPointerEnter)
  $script:LauncherButton.add_MouseLeave($launcherPointerLeave)
  $script:Launcher.add_MouseDown($launcherPointerDown)
  $script:Launcher.add_MouseMove($launcherPointerMove)
  $script:Launcher.add_MouseUp($launcherPointerUp)
  $script:Launcher.add_MouseEnter($launcherPointerEnter)
  $script:Launcher.add_MouseLeave($launcherPointerLeave)
  $script:Launcher.Controls.Add($script:LauncherButton)

  # Hover microinteraction: one eased layered frame per tick, shared with the
  # tip's fade-in. The timer runs only while something is animating.
  $script:LauncherAnimTimer = [System.Windows.Forms.Timer]::new()
  $script:LauncherAnimTimer.Interval = 15
  $script:LauncherAnimTimer.add_Tick({
    if ($script:Closing -or -not $script:LauncherLayeredActive) {
      $script:LauncherAnimTimer.Stop()
      return
    }
    $target = if ($script:LauncherHover) { 1.0 } else { 0.0 }
    $step = if ($target -gt $script:LauncherAnimValue) { 0.18 } else { 0.11 }
    $script:LauncherAnimValue = if ($target -gt $script:LauncherAnimValue) {
      [Math]::Min($target, $script:LauncherAnimValue + $step)
    } else {
      [Math]::Max($target, $script:LauncherAnimValue - $step)
    }
    Update-AuraUiLauncherSurface
    $tipSettled = $true
    if ($script:LauncherTipVisible -and $null -ne $script:LauncherTipBitmap -and
        $null -ne $script:LauncherTip -and -not $script:LauncherTip.IsDisposed -and
        $script:LauncherTipAlpha -lt 255) {
      $script:LauncherTipAlpha = [Math]::Min(255, $script:LauncherTipAlpha + 34)
      try {
        [void][AuraLayered]::Apply($script:LauncherTip.Handle, $script:LauncherTipBitmap, [byte]$script:LauncherTipAlpha)
      } catch { $script:LauncherTipAlpha = 255 }
      $tipSettled = $script:LauncherTipAlpha -ge 255
    }
    if ($tipSettled -and [Math]::Abs($script:LauncherAnimValue - $target) -lt 0.0001) {
      $script:LauncherAnimTimer.Stop()
    }
  })
  # A short hover dwell before the "Aura Studio" caption appears.
  $script:LauncherTipTimer = [System.Windows.Forms.Timer]::new()
  $script:LauncherTipTimer.Interval = 450
  $script:LauncherTipTimer.add_Tick({
    $script:LauncherTipTimer.Stop()
    if ($script:LauncherHover -and -not $script:LauncherDragging) { Show-AuraUiLauncherTip }
  })
  # Resolve and commit the complete launcher/window/tray/shortcut identity before
  # any of those surfaces become visible.
  $initialIdentityReady = $false
  try { $initialIdentityReady = [bool](Update-AuraUiLauncherStyle) }
  catch { Write-AuraUiLog -Message "Initial Aura identity failed: $($_.Exception.Message)" }
  if (-not $initialIdentityReady) {
    throw 'Claude Aura could not establish a complete safe application identity.'
  }
  $script:TrayIcon.Visible = $true
  $script:Launcher.add_FormClosing({
    param($sender, $eventArgs)
    if (-not $script:Closing -and $eventArgs.CloseReason -eq [System.Windows.Forms.CloseReason]::UserClosing) {
      $eventArgs.Cancel = $true
      $sender.Hide()
    }
  })

  Read-AuraUiLauncherPosition
  $script:Launcher.add_LocationChanged({
    Update-AuraUiLauncherHintPosition
    Update-AuraUiLauncherTipPosition
  })
  $script:Form.add_LocationChanged({ Update-AuraUiLauncherPosition })
  $script:Form.add_SizeChanged({ Update-AuraUiLauncherPosition })
  $script:Form.add_Shown({ Update-AuraUiLauncherPosition })
  $script:Form.add_LocationChanged({ Update-AuraUiRescueWindowPosition })
  $script:Form.add_SizeChanged({ Update-AuraUiRescueWindowPosition })

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
    if (-not $script:JumpListRegistered -and [DateTime]::UtcNow -ge $script:JumpListRegistrationDue) {
      $script:JumpListRegistered = [bool](Register-AuraUiJumpList)
      if ($script:JumpListRegistered) {
        $script:JumpListRegistrationDue = [DateTime]::MinValue
        if ($script:ShellIdentityIconPath -and
            [string]::Equals($script:JumpListIdentityPath, $script:ShellIdentityIconPath,
              [StringComparison]::OrdinalIgnoreCase)) {
          Remove-AuraUiUnusedShortcutIcons -KeepPath $script:ShellIdentityIconPath
        }
      } else {
        $script:JumpListRegistrationDue = [DateTime]::UtcNow.AddSeconds(30)
      }
    }
    try {
      if ($null -ne $script:MainOpenSignal -and $script:MainOpenSignal.WaitOne(0)) {
        Show-AuraUiMain
      }
      if ($null -ne $script:StudioOpenSignal -and $script:StudioOpenSignal.WaitOne(0)) {
        Show-AuraUiStudio
      }
      Complete-AuraUiPendingNavigationVerification
      if ($null -ne $script:EnvironmentTask -and $script:EnvironmentTask.IsCompleted) {
        $task = $script:EnvironmentTask
        $script:EnvironmentTask = $null
        $environment = $task.GetAwaiter().GetResult()
        $script:WebViewEnvironment = $environment
        if ($script:IsRescueSession) {
          # A clean session uses WebView2's private controller mode. It starts
          # without the normal Aura cookies and discards its own session data
          # when the controller closes; the regular profile remains untouched.
          $controllerOptions = $environment.CreateCoreWebView2ControllerOptions()
          $controllerOptions.ProfileName = 'ClaudeAuraRescue'
          $controllerOptions.IsInPrivateModeEnabled = $true
          $script:EnsureTask = $script:WebView.EnsureCoreWebView2Async($environment, $controllerOptions)
        } else {
          $script:EnsureTask = $script:WebView.EnsureCoreWebView2Async($environment)
        }
        if (Test-Path -LiteralPath $StudioRoot -PathType Container) {
          if ($script:IsRescueSession) {
            # Studio must share the temporary private profile in a clean
            # session too; otherwise its local origin could still mutate the
            # normal persistent WebView2 profile.
            $studioControllerOptions = $environment.CreateCoreWebView2ControllerOptions()
            $studioControllerOptions.ProfileName = 'ClaudeAuraRescue'
            $studioControllerOptions.IsInPrivateModeEnabled = $true
            $script:StudioEnsureTask = $script:StudioWebView.EnsureCoreWebView2Async(
              $environment, $studioControllerOptions)
          } else {
            $script:StudioEnsureTask = $script:StudioWebView.EnsureCoreWebView2Async($environment)
          }
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
            'aura.avatar',
            $AvatarRoot,
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
            $rawMessage = $null
            try {
              $rawMessage = $eventArgs.WebMessageAsJson
              Invoke-AuraUiStudioMessage -Json $rawMessage -Source $eventArgs.Source
            } catch {
              Write-AuraUiLog -Message "Studio message rejected: $($_.Exception.Message)"
              $failedAction = ''
              try {
                if ($rawMessage -isnot [string] -or $rawMessage.Length -gt 16384) {
                  throw 'Rejected Studio message is not safe to inspect.'
                }
                $failedMessage = $rawMessage | ConvertFrom-Json
                if ($failedMessage.type -is [string] -and
                    $script:StudioMessageTypes -ccontains $failedMessage.type -and
                    $failedMessage.type -in @(
                      'set-locale', 'complete-studio-introduction',
                      'set-image-framing', 'set-avatar-framing', 'set-card-preview-crop',
                      'create-theme-copy', 'begin-theme-edit', 'set-theme-token', 'set-theme-layer', 'apply-theme-patch',
                      'pick-theme-layer-image', 'pick-theme-launcher-mark', 'remove-theme-layer', 'move-theme-layer',
                      'undo-theme-edit', 'redo-theme-edit', 'save-theme-edit', 'discard-theme-edit',
                      'delete-user-theme', 'set-greeting-phrases', 'reset-greeting')) {
                  $failedAction = [string]$failedMessage.type
                }
              } catch {}
              if ($failedAction) {
                if ($failedAction -ceq 'set-locale') {
                  Send-AuraUiStudioState -Status "$($script:UiCopy.localeNotChangedMessage)" -Tone error
                } elseif ($failedAction -ceq 'complete-studio-introduction') {
                  Send-AuraUiStudioState -Status "$($script:UiCopy.studioPreferencesNotSaved)" -Tone error
                } elseif ($failedAction -in @(
                    'create-theme-copy', 'begin-theme-edit', 'set-theme-token', 'set-theme-layer', 'apply-theme-patch',
                    'pick-theme-layer-image', 'pick-theme-launcher-mark', 'remove-theme-layer', 'move-theme-layer',
                    'undo-theme-edit', 'redo-theme-edit', 'save-theme-edit', 'discard-theme-edit',
                    'delete-user-theme', 'set-greeting-phrases', 'reset-greeting')) {
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
          $studioCore.Navigate((Get-AuraUiStudioUrl))
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

        $core.add_WebResourceResponseReceived({
          param($sender, $eventArgs)
          if ($null -eq $script:ActiveNavigationId -or -not $script:ActiveNavigationUri) { return }
          try {
            # cf-mitigated is Cloudflare's authoritative challenge marker. Read
            # only this one response header; never inspect request headers,
            # cookies, response bodies, challenge markup, or page text.
            $mitigatedHeader = $eventArgs.Response.Headers.GetHeader('cf-mitigated')
            if (Test-AuraUiCloudflareChallengeSignal `
                -NavigationId $script:ActiveNavigationId `
                -NavigationUri $script:ActiveNavigationUri `
                -RequestUri $eventArgs.Request.Uri `
                -StatusCode ([int]$eventArgs.Response.StatusCode) `
                -MitigatedHeader $mitigatedHeader) {
              $script:RescueChallengeCandidate = [PSCustomObject]@{
                NavigationId = [UInt64]$script:ActiveNavigationId
                RequestIdentity = Get-AuraUiNavigationRequestIdentity -Value $eventArgs.Request.Uri
                StatusCode = [int]$eventArgs.Response.StatusCode
              }
              $script:PendingApply = $false
              $script:PendingRestore = $false
              Stop-AuraUiMirrorForRescue
              # The marker is authoritative even if the document streams or
              # never reaches DOMContentLoaded. Reveal the genuine response now;
              # the recovery card still waits for top-level status correlation.
              Hide-AuraUiLoading
            }
          } catch {
            # Missing/unsupported headers are ordinary responses. Deliberately
            # avoid logging the exception because browser stacks may include a
            # sensitive request URL in their message.
          }
        })
        $core.add_NavigationStarting({
          param($sender, $eventArgs)
          $script:ActiveNavigationId = [UInt64]$eventArgs.NavigationId
          $script:ActiveNavigationUri = [string]$eventArgs.Uri
          $script:RescueChallengeCandidate = $null
          $script:PendingNavigationCompletion = $null
          $script:RescueVerificationPending = Test-AuraUiClaudeUri -Value $eventArgs.Uri
          $script:ReadyNavigationId = $null
          $script:PageReady = $false
          if ($script:RescueVerificationPending) {
            # Suspend capture and renderer intent at navigation start. They
            # resume only after the bounded response-header verification gate.
            $script:PendingApply = $false
            $script:PendingRestore = $false
            Stop-AuraUiMirrorForRescue
          }
          if ($script:RescueActive) {
            # A real challenge or an explicit retry must remain visible. Rescue
            # never places Aura's opaque loading surface over that document.
            Hide-AuraUiLoading
          } else {
            Show-AuraUiLoading -Message "$($script:UiCopy.openingClaude)"
          }
        })
        $core.add_DOMContentLoaded({
          param($sender, $eventArgs)
          if ($null -eq $script:ActiveNavigationId -or
              [UInt64]$script:ActiveNavigationId -ne [UInt64]$eventArgs.NavigationId -or
              -not (Test-AuraUiClaudeUri -Value $script:WebView.Source)) {
            return
          }
          # NavigationCompleted may report OperationCanceled or ConnectionAborted
          # after a usable post-auth document has already reached DOMContentLoaded.
          # Record that concrete readiness signal and reveal the page immediately;
          # theme injection remains independent and runs from NavigationCompleted.
          $script:ReadyNavigationId = [UInt64]$eventArgs.NavigationId
          $script:PageReady = $true
          Hide-AuraUiLoading
          if (Test-AuraUiRescueChallengeCandidate `
              -Candidate $script:RescueChallengeCandidate `
              -CompletedNavigationId ([UInt64]$eventArgs.NavigationId) `
              -CurrentSource $script:WebView.Source) {
            # DOMContentLoaded is still the fail-open signal, but a correlated
            # access check is not a usable Claude document and cannot authorize
            # theme or mirror work before NavigationCompleted enters Rescue.
            $script:ReadyNavigationId = $null
            $script:PageReady = $false
            return
          }
        })
        $core.add_NavigationCompleted({
          param($sender, $eventArgs)
          $navigationDisposition = Get-AuraUiNavigationCompletionDisposition `
            -CurrentNavigationId $script:ActiveNavigationId `
            -ReadyNavigationId $script:ReadyNavigationId `
            -CompletedNavigationId ([UInt64]$eventArgs.NavigationId) `
            -IsSuccess ([bool]$eventArgs.IsSuccess)
          if ($navigationDisposition -eq 'Ignore') {
            # OAuth redirects can finish an older navigation after its replacement
            # is already live. A superseded completion must never change the cover.
            return
          }
          $challengeCandidate = Test-AuraUiRescueChallengeCandidate `
              -Candidate $script:RescueChallengeCandidate `
              -CompletedNavigationId ([UInt64]$eventArgs.NavigationId) `
              -CurrentSource $script:WebView.Source `
              -CompletedStatusCode ([int]$eventArgs.HttpStatusCode)
          # WebView2 documents that its response observer is non-blocking and
          # may run after the engine has already processed a response. A current
          # top-level Claude 403 therefore gets the same fail-native treatment
          # even when cf-mitigated has not reached the host callback yet.
          $accessDeniedFallback = Test-AuraUiRescueNavigationFallback `
            -CurrentNavigationId $script:ActiveNavigationId `
            -CompletedNavigationId ([UInt64]$eventArgs.NavigationId) `
            -CurrentSource $script:WebView.Source `
            -HttpStatusCode ([int]$eventArgs.HttpStatusCode)
          if ($challengeCandidate -or $accessDeniedFallback) {
            $challengeNavigationId = [UInt64]$eventArgs.NavigationId
            $rescueReason = if ($challengeCandidate) { 'Challenge' } else { 'AccessDenied' }
            $script:PendingNavigationCompletion = $null
            $script:RescueVerificationPending = $false
            $script:ActiveNavigationId = $null
            $script:ActiveNavigationUri = $null
            Enter-AuraUiRescueMode -NavigationId $challengeNavigationId -Reason $rescueReason
            return
          }
          if ($navigationDisposition -eq 'Failure') {
            $script:PendingNavigationCompletion = $null
            $script:RescueVerificationPending = $false
            $script:ActiveNavigationId = $null
            $script:ActiveNavigationUri = $null
            $script:RescueChallengeCandidate = $null
            if ($script:RescueActive) {
              $script:RescueBreakerState = 'Open'
              $script:ReadyNavigationId = $null
              $script:PageReady = $false
              Hide-AuraUiLoading
              Show-AuraUiRescueWindow
              return
            }
            # A genuine navigation failure is the only case that keeps the cover.
            $script:ReadyNavigationId = $null
            $script:PageReady = $false
            Show-AuraUiLoading -Message "$($script:UiCopy.loadFailed)" -Retry $true
            return
          }
          if (Test-AuraUiClaudeUri -Value $script:WebView.Source) {
            $script:RescueVerificationPending = $true
            $script:PendingApply = $false
            $script:PendingRestore = $false
            Stop-AuraUiMirrorForRescue
            # Reveal the real Claude document immediately, including right after
            # first sign-in. Hold only renderer and mirror work for one bounded
            # response-observer grace period. Hiding the cover
            # on this real navigation signal — rather than waiting for the async theme
            # script to confirm — is what prevents an injection race from stranding an
            # opaque cover over a working, signed-in interface.
            $script:ReadyNavigationId = [UInt64]$eventArgs.NavigationId
            $script:PageReady = $true
            Hide-AuraUiLoading
            $script:PendingNavigationCompletion = [PSCustomObject]@{
              NavigationId = [UInt64]$eventArgs.NavigationId
              StatusCode = [int]$eventArgs.HttpStatusCode
              DueUtc = [DateTime]::UtcNow.AddMilliseconds(360)
            }
            return
          } else {
            $script:PendingNavigationCompletion = $null
            $script:RescueVerificationPending = $false
            $script:ActiveNavigationId = $null
            $script:ActiveNavigationUri = $null
            $script:RescueChallengeCandidate = $null
            $script:ReadyNavigationId = $null
            Hide-AuraUiLoading
          }
          Request-AuraUiContextMirror
        })
        # Claude uses client-side history navigation between new chat and
        # conversations. Refresh the private Studio mirror after either a
        # source or history transition; Request-AuraUiMirror coalesces bursts
        # and keeps its existing editor-session/generation guards.
        $core.add_SourceChanged({
          Request-AuraUiContextMirror
          Request-AuraUiGreetingProbe
        })
        $core.add_HistoryChanged({
          Request-AuraUiContextMirror
          Request-AuraUiGreetingProbe
        })
        $core.add_NewWindowRequested({
          param($sender, $eventArgs)
          try {
            $uri = [Uri]$eventArgs.Uri
            $newWindowDisposition = Get-AuraUiNewWindowDisposition -Value $uri
            if ($newWindowDisposition -eq 'Popup') {
              # Keep Handled false so WebView2 creates the real popup and preserves
              # window.opener. Replacing window.open with a main-view Navigate gives
              # the caller a closed dummy WindowProxy and breaks OAuth completion.
              return
            }
            $eventArgs.Handled = $true
            if ($newWindowDisposition -eq 'External') {
              Start-Process $uri.AbsoluteUri | Out-Null
            }
          } catch {
            $eventArgs.Handled = $true
            if ($script:RescueActive -or $script:RescueVerificationPending -or
                $null -ne $script:RescueChallengeCandidate) {
              Write-AuraUiLog -Message 'A popup request failed while Rescue mode was active.'
            } else {
              Write-AuraUiLog -Message $_.Exception.ToString()
            }
          }
        })
        $core.add_ProcessFailed({
          if ($script:RescueActive) {
            $script:PendingNavigationCompletion = $null
            $script:RescueVerificationPending = $false
            $script:ActiveNavigationId = $null
            $script:ActiveNavigationUri = $null
            $script:RescueBreakerState = 'Open'
            Hide-AuraUiLoading
            Show-AuraUiRescueWindow
          } elseif ($null -ne $script:RescueChallengeCandidate) {
            # NavigationCompleted may never arrive after a renderer failure.
            # The exact-URL response marker is already authoritative, so promote
            # it to full Rescue Mode and keep browser/clean actions available.
            $candidateNavigationId = [UInt64]$script:RescueChallengeCandidate.NavigationId
            $script:PendingNavigationCompletion = $null
            $script:RescueVerificationPending = $false
            $script:ActiveNavigationId = $null
            $script:ActiveNavigationUri = $null
            Enter-AuraUiRescueMode -NavigationId $candidateNavigationId -Reason Challenge
          } else {
            $script:PendingNavigationCompletion = $null
            $script:RescueVerificationPending = $false
            $script:ActiveNavigationId = $null
            $script:ActiveNavigationUri = $null
            Show-AuraUiLoading -Message "$($script:UiCopy.reloadRetry)" -Retry $true
          }
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
        if ($action -eq 'Apply') {
          # The injection return value is an immediate React snapshot. Probe the
          # renderer-owned bounded state after the page has had time to settle.
          Request-AuraUiGreetingProbe
        } else { Stop-AuraUiGreetingProbe }
        if ($covered) { Hide-AuraUiLoading }
        Send-AuraUiStudioState
        Request-AuraUiMirror
        if ($script:PendingRestore) {
          $script:PendingRestore = $false
          $script:PendingApply = $false
          Stop-AuraUiGreetingProbe
          $cleanup = '(() => { window.__CLAUDE_AURA_DISABLED__ = true; return window.__CLAUDE_AURA_STATE__?.cleanup?.() ?? true; })()'
          Start-AuraUiScript -Source $cleanup -Action Restore
        } elseif ($script:PendingApply) {
          $script:PendingApply = $false
          Stop-AuraUiGreetingProbe
          Apply-AuraUiTheme
        }
      }
      Update-AuraUiMirror
      Update-AuraUiGreetingProbe
    } catch {
      $script:EnvironmentTask = $null
      $script:EnsureTask = $null
      $script:ScriptTask = $null
      $script:PendingApply = $false
      $script:PendingRestore = $false
      if (-not $script:WebReady) {
        Fail-AuraUiStartup -Exception $_.Exception
      } elseif ($null -ne $script:RescueChallengeCandidate) {
        # A verified marker may arrive before NavigationCompleted. Keep its
        # document visible and avoid logging an exception that could contain
        # the private navigation URL.
        Write-AuraUiLog -Message 'Rescue candidate stayed visible after an internal failure.'
        Hide-AuraUiLoading
      } elseif ($script:RescueActive -or $script:RescueVerificationPending) {
        # Browser exception strings can include a private redirect or query URL.
        # Keep retry/challenge failures fixed-message while this gate is active.
        Write-AuraUiLog -Message 'Rescue mode kept the current document visible after an internal failure.'
        Hide-AuraUiLoading
        if ($script:RescueActive) { Show-AuraUiRescueWindow }
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
    $script:ActiveNavigationId = $null
    $script:ActiveNavigationUri = $null
    $script:ReadyNavigationId = $null
    $script:RescueChallengeCandidate = $null
    $script:RescueVerificationPending = $false
    $script:PendingNavigationCompletion = $null
    $script:PendingApply = $false
    $script:PendingRestore = $false
    Show-AuraUiLoading -Message $(if ($script:IsRescueSession) {
        "$($script:UiCopy.rescueStartingCleanSession)"
      } else {
        "$($script:UiCopy.openingClaude)"
      })
    try {
      $script:EnvironmentTask = [Microsoft.Web.WebView2.Core.CoreWebView2Environment]::CreateAsync($null, $WebDataRoot, $null)
      $timer.Start()
    } catch { Fail-AuraUiStartup -Exception $_.Exception }
  })
  $script:Form.add_FormClosing({
    param($sender, $eventArgs)
    if (-not $script:Closing -and -not $script:ExitRequested -and
        $eventArgs.CloseReason -eq [System.Windows.Forms.CloseReason]::UserClosing -and
        $null -ne $script:StudioForm -and -not $script:StudioForm.IsDisposed -and
        $script:StudioForm.Visible) {
      $eventArgs.Cancel = $true
      $sender.Hide()
      Update-AuraUiLauncherPosition
      return
    }
    Restore-AuraUiStudioPreviewState
    $script:Closing = $true
    $timer.Stop()
    if ($script:RescueForm -and -not $script:RescueForm.IsDisposed) {
      $script:RescueForm.Close()
      $script:RescueForm.Dispose()
      $script:RescueForm = $null
    }
    if ($script:LoadingAnimationTimer) {
      $script:LoadingAnimationTimer.Stop()
      $script:LoadingAnimationTimer.Dispose()
      $script:LoadingAnimationTimer = $null
    }
    if ($script:LoadingMark -and $script:LoadingMark.Image) {
      $script:LoadingMark.Image.Dispose()
      $script:LoadingMark.Image = $null
    }
    if ($script:TrayIcon) {
      $script:TrayIcon.Visible = $false
      $script:TrayIcon.Dispose()
      $script:TrayIcon = $null
    }
    if ($script:StudioForm -and -not $script:StudioForm.IsDisposed) { $script:StudioForm.Close() }
    if ($script:StudioWebView -and -not $script:StudioWebView.IsDisposed) { $script:StudioWebView.Dispose() }
    if ($script:LauncherAnimTimer) { $script:LauncherAnimTimer.Stop(); $script:LauncherAnimTimer.Dispose(); $script:LauncherAnimTimer = $null }
    if ($script:LauncherTipTimer) { $script:LauncherTipTimer.Stop(); $script:LauncherTipTimer.Dispose(); $script:LauncherTipTimer = $null }
    if ($script:LauncherHint -and -not $script:LauncherHint.IsDisposed) { $script:LauncherHint.Close() }
    if ($script:LauncherTip -and -not $script:LauncherTip.IsDisposed) { $script:LauncherTip.Dispose(); $script:LauncherTip = $null }
    if ($script:LauncherTipBitmap) { $script:LauncherTipBitmap.Dispose(); $script:LauncherTipBitmap = $null }
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
  if ($null -ne $startupOperationLock) {
    try { Exit-AuraOperationLock -Mutex $startupOperationLock } catch {}
    $startupOperationLock = $null
  }
  if ($null -ne $script:TrayIcon) {
    try {
      $script:TrayIcon.Visible = $false
      $script:TrayIcon.Dispose()
    } catch {}
    $script:TrayIcon = $null
  }
  if ($null -ne $script:RescueForm -and -not $script:RescueForm.IsDisposed) {
    try {
      $script:RescueForm.Close()
      $script:RescueForm.Dispose()
    } catch {}
    $script:RescueForm = $null
  }
  if ($null -ne $script:StudioOpenSignal) {
    try { $script:StudioOpenSignal.Dispose() } catch {}
    $script:StudioOpenSignal = $null
  }
  if ($null -ne $script:MainOpenSignal) {
    try { $script:MainOpenSignal.Dispose() } catch {}
    $script:MainOpenSignal = $null
  }
  if ($null -ne $script:LoadingAnimationTimer) {
    try {
      $script:LoadingAnimationTimer.Stop()
      $script:LoadingAnimationTimer.Dispose()
    } catch {}
    $script:LoadingAnimationTimer = $null
  }
  if ($null -ne $script:LoadingMark -and $null -ne $script:LoadingMark.Image) {
    try {
      $script:LoadingMark.Image.Dispose()
      $script:LoadingMark.Image = $null
    } catch {}
  }
  foreach ($tracker in @($script:MainIconWindow, $script:StudioIconWindow, $script:LauncherDpiWindow)) {
    if ($null -ne $tracker) { try { $tracker.Dispose() } catch {} }
  }
  $script:MainIconWindow = $null
  $script:StudioIconWindow = $null
  $script:LauncherDpiWindow = $null
  Dispose-AuraUiNativeFormIconPair -Pair $script:MainWindowIconPair
  Dispose-AuraUiNativeFormIconPair -Pair $script:StudioWindowIconPair
  $script:MainWindowIconPair = $null
  $script:StudioWindowIconPair = $null
  foreach ($ownedIcon in @($script:MainIcon, $script:StudioIcon, $script:NotificationIcon)) {
    if ($null -ne $ownedIcon) {
      try { $ownedIcon.Dispose() } catch {}
    }
  }
  $script:MainIcon = $null
  $script:StudioIcon = $null
  $script:NotificationIcon = $null
  $script:ThemeIdentityAssetPath = $null
  $script:ThemeIdentityDigest = $null
  if ($null -ne $script:ThemeIdentityLock) {
    try { $script:ThemeIdentityLock.Dispose() } catch {}
    $script:ThemeIdentityLock = $null
  }
  foreach ($candidate in @($script:DeferredIdentityCandidates)) {
    Dispose-AuraUiIdentityCandidate -Candidate $candidate
  }
  $script:DeferredIdentityCandidates.Clear()
  if ($ownsMutex -and $null -ne $mutex) {
    try { $mutex.ReleaseMutex() } catch {}
  }
  if ($null -ne $mutex) { $mutex.Dispose() }
  if ($script:RescueRestartRequested) {
    try {
      Start-AuraUiCleanSessionProcess
    } catch {
      Write-AuraUiLog -Message 'Clean Aura session restart failed.'
    }
  }
}
