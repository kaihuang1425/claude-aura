# Claude Aura main-window WebView2 tabs.
#
# Metadata is private local state: conversation URLs can contain opaque IDs, so
# the complete tab document is DPAPI-protected and published atomically. Live
# WebView2 controls never enter the serialized document.

$script:AuraWebTabMaximum = 20
$script:AuraWebTabStoreRoot = Join-Path $DataRoot 'web-tabs'
$script:AuraWebTabStatePath = Join-Path $script:AuraWebTabStoreRoot 'tabs.bin'
$script:AuraWebTabStateMagic = [Text.Encoding]::ASCII.GetBytes("CLAUDE-AURA-WEB-TABS-1`n")
$script:AuraWebTabEntropy = [Text.Encoding]::UTF8.GetBytes('ClaudeAura.WebTabs.v1')
$script:AuraWebTabMaximumBytes = 128 * 1024
$script:AuraWebTabDocument = $null
$script:AuraWebTabRuntime = @{}
$script:AuraWebTabStandbyView = $null
$script:AuraWebTabContentPanel = $null
$script:AuraWebTabWorkHubControl = $null
$script:AuraWebTabWorkHubWebView = $null
$script:AuraWebTabWorkHubEnsureTask = $null
$script:AuraWebTabWorkHubReady = $false
$script:AuraWebTabWorkHubRoot = $null
$script:AuraWebTabWorkHubPresentation = $null
$script:AuraWebTabWorkHubPresentationRevision = [long]-1
$script:AuraWebTabStrip = $null
$script:AuraWebTabList = $null
$script:AuraWebTabNewButton = $null
$script:AuraWebChromeHost = $null
$script:AuraWebAppBar = $null
$script:AuraWebAppBarTitle = $null
$script:AuraWebAppIconImage = $null
$script:AuraWebAppMenuButtons = @()
$script:AuraWebWindowControlButtons = @()
$script:AuraWebWindowMaximizeButton = $null
$script:AuraWebFileMenu = $null
$script:AuraWebViewMenu = $null
$script:AuraWebThemesMenu = $null
$script:AuraWebHelpMenu = $null
$script:AuraWebFileNewItem = $null
$script:AuraWebFileCloseItem = $null
$script:AuraWebFileExitItem = $null
$script:AuraWebFileStudioItem = $null
$script:AuraWebViewWorkHubItem = $null
$script:AuraWebViewPetVisibilityItem = $null
$script:AuraWebViewPetSettingsItem = $null
$script:AuraWebThemesStudioItem = $null
$script:AuraWebThemesOriginalItem = $null
$script:AuraWebThemeItems = @()
$script:AuraWebHelpAuraItem = $null
$script:AuraWebHelpGuideItem = $null
$script:AuraWebChromePalette = $null

function Get-AuraWebContrastForeground {
  param([Parameter(Mandatory = $true)][string]$Color)
  try {
    $value = [Drawing.ColorTranslator]::FromHtml($Color)
    $brightness = (0.299 * $value.R) + (0.587 * $value.G) + (0.114 * $value.B)
    if ($brightness -ge 152) { return '#211923' }
  } catch {}
  return '#FFFFFF'
}

function Get-AuraWebMixedColor {
  param(
    [Parameter(Mandatory = $true)][string]$From,
    [Parameter(Mandatory = $true)][string]$To,
    [ValidateRange(0, 1)][double]$Amount
  )
  $fromColor = [Drawing.ColorTranslator]::FromHtml($From)
  $toColor = [Drawing.ColorTranslator]::FromHtml($To)
  return [Drawing.Color]::FromArgb(
    [Math]::Round($fromColor.R + (($toColor.R - $fromColor.R) * $Amount)),
    [Math]::Round($fromColor.G + (($toColor.G - $fromColor.G) * $Amount)),
    [Math]::Round($fromColor.B + (($toColor.B - $fromColor.B) * $Amount)))
}

function Update-AuraWebWindowControlState {
  if ($null -eq $script:AuraWebWindowMaximizeButton -or
      $script:AuraWebWindowMaximizeButton.IsDisposed -or
      $null -eq $script:Form -or $script:Form.IsDisposed) { return }
  $maximized = $script:Form.WindowState -eq [System.Windows.Forms.FormWindowState]::Maximized
  $script:AuraWebWindowMaximizeButton.Text = if ($maximized) { [char]0x2750 } else { [char]0x25A1 }
  $script:AuraWebWindowMaximizeButton.AccessibleName = if ($maximized) {
    Get-AuraWebUiText -Name restoreWindow -Fallback 'Restore window'
  } else {
    Get-AuraWebUiText -Name maximizeWindow -Fallback 'Maximize window'
  }
}

function Switch-AuraWebWindowMaximized {
  if ($null -eq $script:Form -or $script:Form.IsDisposed) { return }
  $script:Form.WindowState = if (
    $script:Form.WindowState -eq [System.Windows.Forms.FormWindowState]::Maximized) {
    [System.Windows.Forms.FormWindowState]::Normal
  } else { [System.Windows.Forms.FormWindowState]::Maximized }
  Update-AuraWebWindowControlState
}

function Register-AuraWebWindowDragSurface {
  param([AllowNull()][System.Windows.Forms.Control]$Control)
  if ($null -eq $Control -or $Control.IsDisposed) { return }
  $Control.add_MouseDoubleClick({
    param($sender, $eventArgs)
    if ($eventArgs.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
      Switch-AuraWebWindowMaximized
    }
  })
  $Control.add_MouseDown({
    param($sender, $eventArgs)
    if ($eventArgs.Button -ne [System.Windows.Forms.MouseButtons]::Left -or
        $eventArgs.Clicks -ne 1 -or $null -eq $script:Form -or
        $script:Form.IsDisposed) { return }
    $auraWindowType = 'AuraWindow' -as [type]
    if ($null -eq $auraWindowType) { return }
    [void]$auraWindowType.GetMethod('ReleaseCapture').Invoke($null, @())
    [void]$auraWindowType.GetMethod('SendMessage').Invoke($null, @(
      $script:Form.Handle, [uint32]0x00A1, [IntPtr]2, [IntPtr]::Zero))
  })
}

function New-AuraWebWindowControlButton {
  param(
    [Parameter(Mandatory = $true)][string]$Text,
    [Parameter(Mandatory = $true)][string]$AccessibleName,
    [Parameter(Mandatory = $true)][scriptblock]$Action,
    [switch]$Close
  )
  $button = [System.Windows.Forms.Button]::new()
  $button.Width = 46
  $button.Height = 30
  $button.Margin = [System.Windows.Forms.Padding]::new(0)
  $button.Padding = [System.Windows.Forms.Padding]::new(0)
  $button.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
  $button.FlatAppearance.BorderSize = 0
  $button.UseVisualStyleBackColor = $false
  $button.Font = [Drawing.Font]::new('Segoe UI Symbol', 8)
  $button.Text = $Text
  $button.AccessibleName = $AccessibleName
  $button.Tag = if ($Close) { 'close' } else { 'window-control' }
  $button.add_Click($Action)
  return $button
}

function Get-AuraWebUiText {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Fallback
  )
  $copyVariable = Get-Variable -Name UiCopy -Scope Script -ErrorAction SilentlyContinue
  if ($null -eq $copyVariable -or $null -eq $copyVariable.Value) { return $Fallback }
  $property = $copyVariable.Value.PSObject.Properties[$Name]
  if ($null -eq $property -or $property.Value -isnot [string] -or
      [string]::IsNullOrWhiteSpace([string]$property.Value)) { return $Fallback }
  return [string]$property.Value
}

function Get-AuraWebChromePalette {
  param(
    [bool]$Dark = $false,
    [AllowNull()][object]$Material
  )
  $fallback = if ($Dark) {
    [PSCustomObject]@{
      Surface = '#242229'; SurfaceHover = '#34313B'; Foreground = '#F5F2F8'
      Muted = '#C7C0CF'; Accent = '#8B6FD6'; Border = '#514A5C'
    }
  } else {
    [PSCustomObject]@{
      Surface = '#F4F1EA'; SurfaceHover = '#E7E1D7'; Foreground = '#28232D'
      Muted = '#6D6672'; Accent = '#6B4FB3'; Border = '#CFC6D4'
    }
  }
  $readColor = {
    param([string]$Name, [string]$Fallback)
    if ($null -eq $Material) { return $Fallback }
    $property = $Material.PSObject.Properties[$Name]
    if ($null -eq $property -or $property.Value -isnot [string] -or
        $property.Value -cnotmatch '^#[0-9A-Fa-f]{6}$') { return $Fallback }
    return [string]$property.Value
  }
  $surface = & $readColor 'surface' $fallback.Surface
  $surfaceHover = & $readColor 'surfaceHover' $fallback.SurfaceHover
  $foreground = & $readColor 'foreground' $fallback.Foreground
  $accent = & $readColor 'accent' $fallback.Accent
  return [PSCustomObject]@{
    Chrome = $accent
    ChromeForeground = Get-AuraWebContrastForeground -Color $accent
    Surface = $surface
    SurfaceHover = $surfaceHover
    Foreground = $foreground
    Muted = $fallback.Muted
    Accent = $accent
    Border = & $readColor 'border' $fallback.Border
  }
}

function Update-AuraWebAppBarCopy {
  if ($null -eq $script:AuraWebAppMenuButtons -or $script:AuraWebAppMenuButtons.Count -ne 4) {
    return
  }
  $script:AuraWebAppMenuButtons[0].Text = Get-AuraWebUiText -Name menuFile -Fallback 'File'
  $script:AuraWebAppMenuButtons[1].Text = Get-AuraWebUiText -Name menuView -Fallback 'View'
  $script:AuraWebAppMenuButtons[2].Text = Get-AuraWebUiText -Name menuThemes -Fallback 'Themes'
  $script:AuraWebAppMenuButtons[3].Text = Get-AuraWebUiText -Name menuHelp -Fallback 'Help'
  if ($null -ne $script:AuraWebFileNewItem) {
    $script:AuraWebFileNewItem.Text = Get-AuraWebUiText -Name newTab -Fallback 'New tab'
  }
  if ($null -ne $script:AuraWebFileCloseItem) {
    $script:AuraWebFileCloseItem.Text = Get-AuraWebUiText -Name closeTab -Fallback 'Close tab'
  }
  if ($null -ne $script:AuraWebFileExitItem) {
    $script:AuraWebFileExitItem.Text = Get-AuraWebUiText -Name exitApp -Fallback 'Exit Claude Aura'
  }
  if ($null -ne $script:AuraWebFileStudioItem) {
    $script:AuraWebFileStudioItem.Text = Get-AuraWebUiText -Name openStudio -Fallback 'Open Studio'
  }
  if ($null -ne $script:AuraWebViewWorkHubItem) {
    $script:AuraWebViewWorkHubItem.Text = Get-AuraWebUiText -Name workHubTitle -Fallback 'Work Hub'
  }
  if ($null -ne $script:AuraWebViewPetVisibilityItem) {
    $trayPetVariable = Get-Variable -Name TrayPetVisibilityItem -Scope Script -ErrorAction SilentlyContinue
    $script:AuraWebViewPetVisibilityItem.Text = if (
      $null -ne $trayPetVariable -and $null -ne $trayPetVariable.Value -and
      -not $trayPetVariable.Value.IsDisposed) {
      [string]$trayPetVariable.Value.Text
    } else { Get-AuraWebUiText -Name showPet -Fallback 'Show pet' }
  }
  if ($null -ne $script:AuraWebViewPetSettingsItem) {
    $script:AuraWebViewPetSettingsItem.Text = Get-AuraWebUiText -Name petSettings -Fallback 'Pet settings'
  }
  if ($null -ne $script:AuraWebThemesStudioItem) {
    $script:AuraWebThemesStudioItem.Text = Get-AuraWebUiText -Name customizeThemes -Fallback 'Customize themes'
  }
  if ($null -ne $script:AuraWebThemesOriginalItem) {
    $script:AuraWebThemesOriginalItem.Text = Get-AuraWebUiText -Name originalLook -Fallback 'Original look'
  }
  if ($null -ne $script:AuraWebHelpAuraItem) {
    $script:AuraWebHelpAuraItem.Text = Get-AuraWebUiText -Name launcherHintTitle -Fallback 'Meet the Aura button'
  }
  if ($null -ne $script:AuraWebHelpGuideItem) {
    $script:AuraWebHelpGuideItem.Text = Get-AuraWebUiText `
      -Name openDesktopWorkspaceGuidance -Fallback 'Review full-workspace guidance'
  }
  if ($script:AuraWebWindowControlButtons.Count -eq 3) {
    $script:AuraWebWindowControlButtons[0].AccessibleName = Get-AuraWebUiText `
      -Name minimizeWindow -Fallback 'Minimize window'
    $script:AuraWebWindowControlButtons[2].AccessibleName = Get-AuraWebUiText `
      -Name closeWindow -Fallback 'Close window'
    Update-AuraWebWindowControlState
  }
}

function Update-AuraWebMenuAppearance {
  param(
    [AllowNull()][System.Windows.Forms.ContextMenuStrip]$Menu,
    [Parameter(Mandatory = $true)][object]$Palette
  )
  if ($null -eq $Menu -or $Menu.IsDisposed) { return }
  $Menu.BackColor = [Drawing.ColorTranslator]::FromHtml($Palette.Surface)
  $Menu.ForeColor = [Drawing.ColorTranslator]::FromHtml($Palette.Foreground)
  foreach ($item in @($Menu.Items)) {
    $item.BackColor = $Menu.BackColor
    $item.ForeColor = $Menu.ForeColor
  }
}

function Update-AuraWebChromeAppearance {
  param(
    [bool]$Dark = $false,
    [AllowNull()][object]$Material
  )
  $script:AuraWebChromePalette = Get-AuraWebChromePalette -Dark $Dark -Material $Material
  $palette = $script:AuraWebChromePalette
  $chrome = [Drawing.ColorTranslator]::FromHtml($palette.Chrome)
  $chromeForeground = [Drawing.ColorTranslator]::FromHtml($palette.ChromeForeground)
  foreach ($control in @($script:AuraWebChromeHost, $script:AuraWebAppBar, $script:AuraWebTabStrip)) {
    if ($null -ne $control -and -not $control.IsDisposed) { $control.BackColor = $chrome }
  }
  if ($null -ne $script:AuraWebAppBarTitle -and -not $script:AuraWebAppBarTitle.IsDisposed) {
    $script:AuraWebAppBarTitle.BackColor = $chrome
    $script:AuraWebAppBarTitle.ForeColor = $chromeForeground
  }
  foreach ($button in @($script:AuraWebAppMenuButtons)) {
    if ($null -eq $button -or $button.IsDisposed) { continue }
    $button.BackColor = $chrome
    $button.ForeColor = $chromeForeground
    $button.FlatAppearance.MouseOverBackColor = [Drawing.ColorTranslator]::FromHtml($palette.SurfaceHover)
  }
  foreach ($button in @($script:AuraWebWindowControlButtons)) {
    if ($null -eq $button -or $button.IsDisposed) { continue }
    $button.BackColor = $chrome
    $button.ForeColor = $chromeForeground
    $button.FlatAppearance.MouseOverBackColor = if ([string]$button.Tag -ceq 'close') {
      [Drawing.ColorTranslator]::FromHtml('#E81123')
    } else { [Drawing.ColorTranslator]::FromHtml($palette.SurfaceHover) }
    $button.FlatAppearance.MouseDownBackColor = $button.FlatAppearance.MouseOverBackColor
  }
  foreach ($menu in @(
    $script:AuraWebFileMenu,
    $script:AuraWebViewMenu,
    $script:AuraWebThemesMenu,
    $script:AuraWebHelpMenu
  )) {
    Update-AuraWebMenuAppearance -Menu $menu -Palette $palette
  }
  if ($null -ne $script:AuraWebTabStrip -and -not $script:AuraWebTabStrip.IsDisposed) {
    $script:AuraWebTabNewButton.BackColor = $chrome
    $script:AuraWebTabNewButton.ForeColor = $chromeForeground
  }
  if ($null -ne $script:Form -and -not $script:Form.IsDisposed) {
    $script:Form.BackColor = $chrome
  }
  if (Get-Command Update-AuraUiWindowChrome -ErrorAction SilentlyContinue) {
    $mainDark = ((0.299 * $chrome.R) + (0.587 * $chrome.G) + (0.114 * $chrome.B)) -lt 152
    Update-AuraUiWindowChrome -Dark $Dark -MainColor $chrome -MainDark $mainDark
  }
  Refresh-AuraWebTabStrip
}

function Test-AuraWebTabUuid {
  param([AllowEmptyString()][string]$Value)
  return $Value -cmatch '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
}

function Test-AuraWebTabText {
  param(
    [AllowEmptyString()][string]$Value,
    [Parameter(Mandatory = $true)][int]$Maximum,
    [switch]$Required
  )
  if ($null -eq $Value -or $Value.Length -gt $Maximum) { return $false }
  if ($Required -and [string]::IsNullOrWhiteSpace($Value)) { return $false }
  return -not [regex]::IsMatch($Value, '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
}

function ConvertTo-AuraWebTabUrl {
  param([Parameter(Mandatory = $true)][string]$Value)
  if (-not (Test-AuraWebTabText -Value $Value -Maximum 2048 -Required)) {
    throw 'Aura web tab address is invalid.'
  }
  $uri = $null
  if (-not [Uri]::TryCreate($Value, [UriKind]::Absolute, [ref]$uri) -or
      $uri.Scheme -cne [Uri]::UriSchemeHttps -or
      $uri.Host -cne 'claude.ai' -or
      -not $uri.IsDefaultPort -or
      $uri.UserInfo.Length -ne 0) {
    throw 'Aura web tabs are limited to claude.ai.'
  }
  return $uri.AbsoluteUri
}

function ConvertTo-AuraWebTabSessionUrl {
  param([AllowNull()][object]$Value)
  $candidate = if ($Value -is [Uri]) {
    [string]$Value.AbsoluteUri
  } elseif ($Value -is [string]) {
    [string]$Value
  } else {
    ''
  }
  if ([string]::IsNullOrWhiteSpace($candidate) -or $candidate.Length -gt 2048 -or
      $candidate -cne $candidate.Trim()) {
    throw 'Aura session address is invalid.'
  }
  $uri = $null
  if (-not [Uri]::TryCreate($candidate, [UriKind]::Absolute, [ref]$uri) -or
      $uri.Scheme -cne [Uri]::UriSchemeHttps -or $uri.Host -cne 'claude.ai' -or
      -not $uri.IsDefaultPort -or $uri.UserInfo.Length -ne 0) {
    throw 'Aura session address is invalid.'
  }
  $match = [regex]::Match(
    $uri.AbsolutePath,
    '^/(?<kind>chat|code)/(?<key>[A-Za-z0-9_-]{1,512})$',
    [Text.RegularExpressions.RegexOptions]::CultureInvariant)
  if (-not $match.Success) { throw 'Aura session address is invalid.' }
  return 'https://claude.ai/{0}/{1}' -f
    $match.Groups['kind'].Value, $match.Groups['key'].Value
}

function ConvertTo-AuraWebTabDocument {
  param([Parameter(Mandatory = $true)][object]$Value)
  $names = @($Value.PSObject.Properties | ForEach-Object { $_.Name })
  if ($null -eq $Value -or $Value -is [string] -or $Value -is [Array] -or
      $names.Count -ne 4 -or
      $names -cnotcontains 'schemaVersion' -or
      $names -cnotcontains 'revision' -or
      $names -cnotcontains 'activeTabId' -or
      $names -cnotcontains 'tabs' -or
      $Value.schemaVersion -notin @(1, 2) -or
      ($Value.revision -isnot [int] -and $Value.revision -isnot [long]) -or
      [long]$Value.revision -lt 0 -or
      $Value.tabs -is [string]) {
    throw 'Aura web tab state has an invalid shape.'
  }
  $rawTabs = @($Value.tabs)
  if ($rawTabs.Count -gt $script:AuraWebTabMaximum) {
    throw 'Aura web tab count is invalid.'
  }
  $ids = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  $tabs = @()
  foreach ($rawTab in $rawTabs) {
    $tabNames = @($rawTab.PSObject.Properties | ForEach-Object { $_.Name })
    if ($null -eq $rawTab -or $rawTab -is [string] -or $rawTab -is [Array] -or
        $tabNames.Count -ne 4 -or
        $tabNames -cnotcontains 'id' -or
        $tabNames -cnotcontains 'title' -or
        $tabNames -cnotcontains 'url' -or
        $tabNames -cnotcontains 'createdAt' -or
        $rawTab.id -isnot [string] -or
        -not (Test-AuraWebTabUuid -Value ([string]$rawTab.id)) -or
        -not $ids.Add([string]$rawTab.id) -or
        $rawTab.title -isnot [string] -or
        -not (Test-AuraWebTabText -Value ([string]$rawTab.title) -Maximum 160 -Required) -or
        ($rawTab.createdAt -isnot [int] -and $rawTab.createdAt -isnot [long]) -or
        [long]$rawTab.createdAt -lt 0) {
      throw 'Aura web tab is invalid.'
    }
    $tabs += [PSCustomObject][ordered]@{
      id = [string]$rawTab.id
      title = [string]$rawTab.title
      url = ConvertTo-AuraWebTabUrl -Value ([string]$rawTab.url)
      createdAt = [long]$rawTab.createdAt
    }
  }
  $legacy = [int]$Value.schemaVersion -eq 1
  if (($legacy -and ($Value.activeTabId -isnot [string] -or
        -not $ids.Contains([string]$Value.activeTabId))) -or
      (-not $legacy -and $null -ne $Value.activeTabId -and
        ($Value.activeTabId -isnot [string] -or
          -not $ids.Contains([string]$Value.activeTabId)))) {
    throw 'Aura web tab selection is invalid.'
  }
  return [PSCustomObject][ordered]@{
    schemaVersion = 2
    revision = [long]$Value.revision
    activeTabId = if ($null -eq $Value.activeTabId) { $null } else { [string]$Value.activeTabId }
    tabs = @($tabs)
  }
}

function New-AuraWebTabDocument {
  param([string]$InitialUrl)
  $tabs = @()
  $activeTabId = $null
  if ($PSBoundParameters.ContainsKey('InitialUrl')) {
    $id = [Guid]::NewGuid().ToString('D').ToLowerInvariant()
    $activeTabId = $id
    $tabs = @([PSCustomObject][ordered]@{
      id = $id
      title = 'Claude'
      url = ConvertTo-AuraWebTabUrl -Value $InitialUrl
      createdAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    })
  }
  return [PSCustomObject][ordered]@{
    schemaVersion = 2
    revision = [long]0
    activeTabId = $activeTabId
    tabs = @($tabs)
  }
}

function Add-AuraWebTabDocument {
  param(
    [Parameter(Mandatory = $true)][object]$Document,
    [string]$Url = 'https://claude.ai/'
  )
  [void](ConvertTo-AuraWebTabDocument -Value $Document)
  if (@($Document.tabs).Count -ge $script:AuraWebTabMaximum) {
    return [PSCustomObject]@{ Ok = $false; Code = 'tab-limit'; Id = $null }
  }
  $id = [Guid]::NewGuid().ToString('D').ToLowerInvariant()
  $Document.tabs = @($Document.tabs) + [PSCustomObject][ordered]@{
    id = $id
    title = 'Claude'
    url = ConvertTo-AuraWebTabUrl -Value $Url
    createdAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  }
  $Document.activeTabId = $id
  $Document.revision = [long]$Document.revision + 1
  return [PSCustomObject]@{ Ok = $true; Code = 'tab-added'; Id = $id }
}

function Remove-AuraWebTabDocument {
  param(
    [Parameter(Mandatory = $true)][object]$Document,
    [Parameter(Mandatory = $true)][string]$Id
  )
  [void](ConvertTo-AuraWebTabDocument -Value $Document)
  $index = -1
  for ($candidate = 0; $candidate -lt $Document.tabs.Count; $candidate += 1) {
    if ([string]$Document.tabs[$candidate].id -ceq $Id) { $index = $candidate; break }
  }
  if ($index -lt 0) { return [PSCustomObject]@{ Ok = $false; Code = 'tab-missing' } }
  $wasActive = [string]$Document.activeTabId -ceq $Id
  $Document.tabs = @($Document.tabs | Where-Object { [string]$_.id -cne $Id })
  if ($wasActive) {
    if ($Document.tabs.Count -eq 0) {
      $Document.activeTabId = $null
    } else {
      $replacement = [Math]::Min($index, $Document.tabs.Count - 1)
      $Document.activeTabId = [string]$Document.tabs[$replacement].id
    }
  }
  $Document.revision = [long]$Document.revision + 1
  return [PSCustomObject]@{
    Ok = $true
    Code = 'tab-closed'
    ActiveTabId = if ($null -eq $Document.activeTabId) { $null } else { [string]$Document.activeTabId }
  }
}

function Update-AuraWebTabDocument {
  param(
    [Parameter(Mandatory = $true)][object]$Document,
    [Parameter(Mandatory = $true)][string]$Id,
    [Parameter(Mandatory = $true)][string]$Title,
    [Parameter(Mandatory = $true)][string]$Url
  )
  if (-not (Test-AuraWebTabText -Value $Title -Maximum 160 -Required)) {
    throw 'Aura web tab title is invalid.'
  }
  $normalizedUrl = ConvertTo-AuraWebTabUrl -Value $Url
  $tab = @($Document.tabs | Where-Object { [string]$_.id -ceq $Id })[0]
  if ($null -eq $tab) { return [PSCustomObject]@{ Ok = $false; Code = 'tab-missing' } }
  if ([string]$tab.title -ceq $Title -and [string]$tab.url -ceq $normalizedUrl) {
    return [PSCustomObject]@{ Ok = $true; Code = 'unchanged' }
  }
  $tab.title = $Title
  $tab.url = $normalizedUrl
  $Document.revision = [long]$Document.revision + 1
  return [PSCustomObject]@{ Ok = $true; Code = 'tab-updated' }
}

function Initialize-AuraWebTabStorage {
  param([string]$Path = $script:AuraWebTabStatePath)
  Add-Type -AssemblyName System.Security -ErrorAction Stop
  $pathFull = [IO.Path]::GetFullPath($Path)
  $rootFull = [IO.Path]::GetFullPath($script:AuraWebTabStoreRoot)
  if (-not [string]::Equals(
      [IO.Path]::GetFullPath((Split-Path -Parent $pathFull)),
      $rootFull,
      [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Aura web tab storage escaped its data directory.'
  }
  Assert-AuraTaskboardNotReparsePoint -Path $DataRoot
  [void][IO.Directory]::CreateDirectory($rootFull)
  Set-AuraTaskboardSecureAcl -Path $rootFull -Directory
  return $pathFull
}

function Read-AuraWebTabDocument {
  param([string]$Path = $script:AuraWebTabStatePath)
  $Path = Initialize-AuraWebTabStorage -Path $Path
  if (-not (Test-Path -LiteralPath $Path)) { return New-AuraWebTabDocument }
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw 'Aura web tab state path is invalid.'
  }
  Assert-AuraTaskboardNotReparsePoint -Path $Path
  Set-AuraTaskboardSecureAcl -Path $Path
  $envelope = [IO.File]::ReadAllBytes($Path)
  $cipher = $null
  $plain = $null
  try {
    if ($envelope.Length -le $script:AuraWebTabStateMagic.Length -or
        $envelope.Length -gt ($script:AuraWebTabMaximumBytes + 4096)) {
      throw 'Aura web tab state has an invalid size.'
    }
    for ($index = 0; $index -lt $script:AuraWebTabStateMagic.Length; $index += 1) {
      if ($envelope[$index] -ne $script:AuraWebTabStateMagic[$index]) {
        throw 'Aura web tab state has an invalid header.'
      }
    }
    $cipher = [byte[]]::new($envelope.Length - $script:AuraWebTabStateMagic.Length)
    [Array]::Copy($envelope, $script:AuraWebTabStateMagic.Length, $cipher, 0, $cipher.Length)
    $plain = [Security.Cryptography.ProtectedData]::Unprotect(
      $cipher, $script:AuraWebTabEntropy,
      [Security.Cryptography.DataProtectionScope]::CurrentUser)
    $json = [Text.UTF8Encoding]::new($false, $true).GetString($plain)
    return ConvertTo-AuraWebTabDocument -Value ($json | ConvertFrom-Json)
  } finally {
    if ($null -ne $plain) { [Array]::Clear($plain, 0, $plain.Length) }
    if ($null -ne $cipher) { [Array]::Clear($cipher, 0, $cipher.Length) }
    if ($null -ne $envelope) { [Array]::Clear($envelope, 0, $envelope.Length) }
  }
}

function Write-AuraWebTabDocument {
  param(
    [Parameter(Mandatory = $true)][object]$Document,
    [string]$Path = $script:AuraWebTabStatePath
  )
  $normalized = ConvertTo-AuraWebTabDocument -Value $Document
  $plain = [Text.UTF8Encoding]::new($false).GetBytes(
    (($normalized | ConvertTo-Json -Depth 6 -Compress) + [Environment]::NewLine))
  if ($plain.Length -gt $script:AuraWebTabMaximumBytes) {
    [Array]::Clear($plain, 0, $plain.Length)
    throw 'Aura web tab state exceeds its byte limit.'
  }
  $Path = Initialize-AuraWebTabStorage -Path $Path
  $directory = Split-Path -Parent $Path
  $temporary = Join-Path $directory ('.tabs-{0}.tmp' -f [Guid]::NewGuid().ToString('N'))
  $backup = Join-Path $directory ('.tabs-{0}.bak' -f [Guid]::NewGuid().ToString('N'))
  $cipher = $null
  $envelope = $null
  $hadExisting = Test-Path -LiteralPath $Path -PathType Leaf
  try {
    $cipher = [Security.Cryptography.ProtectedData]::Protect(
      $plain, $script:AuraWebTabEntropy,
      [Security.Cryptography.DataProtectionScope]::CurrentUser)
    $envelope = [byte[]]::new($script:AuraWebTabStateMagic.Length + $cipher.Length)
    [Array]::Copy($script:AuraWebTabStateMagic, 0, $envelope, 0, $script:AuraWebTabStateMagic.Length)
    [Array]::Copy($cipher, 0, $envelope, $script:AuraWebTabStateMagic.Length, $cipher.Length)
    [IO.File]::WriteAllBytes($temporary, $envelope)
    Set-AuraTaskboardSecureAcl -Path $temporary
    if ($hadExisting) { [IO.File]::Replace($temporary, $Path, $backup, $true) }
    else { [IO.File]::Move($temporary, $Path) }
    Set-AuraTaskboardSecureAcl -Path $Path
    $verified = Read-AuraWebTabDocument -Path $Path
    if (Test-Path -LiteralPath $backup -PathType Leaf) { Remove-Item -LiteralPath $backup -Force }
    return $verified
  } finally {
    [Array]::Clear($plain, 0, $plain.Length)
    if ($null -ne $cipher) { [Array]::Clear($cipher, 0, $cipher.Length) }
    if ($null -ne $envelope) { [Array]::Clear($envelope, 0, $envelope.Length) }
    foreach ($candidate in @($temporary, $backup)) {
      if (Test-Path -LiteralPath $candidate -PathType Leaf) {
        try { Remove-Item -LiteralPath $candidate -Force } catch {}
      }
    }
  }
}

function Get-AuraWebTabRecord {
  param([Parameter(Mandatory = $true)][string]$Id)
  if ($null -eq $script:AuraWebTabDocument) { return $null }
  return @($script:AuraWebTabDocument.tabs | Where-Object { [string]$_.id -ceq $Id })[0]
}

function Get-AuraWebTabRuntime {
  param([Parameter(Mandatory = $true)][string]$Id)
  return $script:AuraWebTabRuntime[$Id]
}

function Get-AuraWebTabInitialUrl {
  param([Parameter(Mandatory = $true)][string]$Fallback)
  if ($null -eq $script:AuraWebTabDocument) { return $Fallback }
  $tab = Get-AuraWebTabRecord -Id ([string]$script:AuraWebTabDocument.activeTabId)
  if ($null -eq $tab) { return $Fallback }
  try { return ConvertTo-AuraWebTabUrl -Value ([string]$tab.url) } catch { return $Fallback }
}

function Test-AuraWebTabProviderActivationRequired {
  return $null -ne $script:AuraWebTabDocument -and
    -not [string]::IsNullOrWhiteSpace([string]$script:AuraWebTabDocument.activeTabId)
}

function Test-AuraWebTabUnicodeExtend {
  param(
    [Parameter(Mandatory = $true)][int]$Value,
    [Parameter(Mandatory = $true)][Globalization.UnicodeCategory]$Category
  )
  return $Category -in @(
      [Globalization.UnicodeCategory]::NonSpacingMark,
      [Globalization.UnicodeCategory]::SpacingCombiningMark,
      [Globalization.UnicodeCategory]::EnclosingMark) -or
    ($Value -ge 0xFE00 -and $Value -le 0xFE0F) -or
    ($Value -ge 0xE0100 -and $Value -le 0xE01EF) -or
    ($Value -ge 0x1F3FB -and $Value -le 0x1F3FF) -or
    ($Value -ge 0xE0020 -and $Value -le 0xE007F)
}

function Get-AuraWebTabExtendedTextElements {
  param([Parameter(Mandatory = $true)][string]$Value)
  $elements = [Collections.Generic.List[string]]::new()
  $current = ''
  $currentRegionalCount = 0
  $joinNext = $false
  for ($index = 0; $index -lt $Value.Length; $index += 1) {
    $first = $Value[$index]
    if ([char]::IsHighSurrogate($first)) {
      if ($index + 1 -ge $Value.Length -or -not [char]::IsLowSurrogate($Value[$index + 1])) {
        break
      }
      $text = $Value.Substring($index, 2)
      $scalar = [char]::ConvertToUtf32($first, $Value[$index + 1])
      $index += 1
    } elseif ([char]::IsLowSurrogate($first)) {
      break
    } else {
      $text = [string]$first
      $scalar = [int]$first
    }
    if ($scalar -eq 0xFFFD) { break }
    $category = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($text, 0)
    $isExtend = Test-AuraWebTabUnicodeExtend -Value $scalar -Category $category
    $isJoiner = $scalar -eq 0x200D
    $isRegional = $scalar -ge 0x1F1E6 -and $scalar -le 0x1F1FF
    if ($current.Length -eq 0) {
      $current = $text
      $currentRegionalCount = if ($isRegional) { 1 } else { 0 }
      $joinNext = $isJoiner
      continue
    }
    if ($joinNext -or $isExtend) {
      $current += $text
      $joinNext = $isJoiner
      continue
    }
    if ($isJoiner) {
      $current += $text
      $joinNext = $true
      continue
    }
    if ($isRegional -and $currentRegionalCount -eq 1) {
      $current += $text
      $currentRegionalCount = 2
      continue
    }
    [void]$elements.Add($current)
    $current = $text
    $currentRegionalCount = if ($isRegional) { 1 } else { 0 }
    $joinNext = $isJoiner
  }
  if ($current.Length -gt 0 -and -not $joinNext) {
    [void]$elements.Add($current)
  }
  return @($elements.ToArray())
}

function Get-AuraWebTabDisplayTitle {
  param([Parameter(Mandatory = $true)][string]$Title)
  $trimmed = $Title.Trim()
  $elements = @(Get-AuraWebTabExtendedTextElements -Value $trimmed)
  if ($elements.Count -eq 0) { return '' }
  if ($elements.Count -le 24) { return [string]::Concat([string[]]$elements) }
  return [string]::Concat([string[]]$elements[0..22]) + [char]0x2026
}

function Get-AuraWebTabWorkHubTitle {
  $localized = [string]$script:UiCopy.workHubTitle
  if ([string]::IsNullOrWhiteSpace($localized)) { return 'Work Hub' }
  return $localized.Trim()
}

function Get-AuraWebTabStripModel {
  param([Parameter(Mandatory = $true)][object]$Document)
  $normalized = ConvertTo-AuraWebTabDocument -Value $Document
  $items = @([PSCustomObject][ordered]@{
    Id = 'work-hub'
    Kind = 'work-hub'
    Title = Get-AuraWebTabWorkHubTitle
    Closable = $false
    Selected = $null -eq $normalized.activeTabId
  })
  foreach ($tab in @($normalized.tabs)) {
    $items += [PSCustomObject][ordered]@{
      Id = [string]$tab.id
      Kind = 'user'
      Title = [string]$tab.title
      Closable = $true
      Selected = [string]$tab.id -ceq [string]$normalized.activeTabId
    }
  }
  return @($items)
}

function Test-AuraWebTabWorkHubPresentation {
  param([AllowNull()][object]$Value)
  if ($Value -isnot [Management.Automation.PSCustomObject]) { return $false }
  $fields = @('type', 'version', 'revision', 'locale', 'themeId', 'appearance', 'enabled')
  $names = @($Value.PSObject.Properties | ForEach-Object { $_.Name })
  if ($names.Count -ne $fields.Count -or
      @($names | Where-Object { $fields -cnotcontains $_ }).Count -ne 0 -or
      $Value.type -isnot [string] -or [string]$Value.type -cne 'session-board-presentation' -or
      ($Value.version -isnot [int] -and $Value.version -isnot [long]) -or
      [long]$Value.version -ne 1 -or
      ($Value.revision -isnot [int] -and $Value.revision -isnot [long]) -or
      [long]$Value.revision -lt 0 -or [long]$Value.revision -gt 9007199254740991 -or
      $Value.locale -isnot [string] -or [string]$Value.locale -cnotin @(
        'en', 'hi', 'es', 'fr', 'id', 'ja', 'ko', 'pt-BR', 'de', 'it',
        'vi', 'pl', 'tr', 'zh-CN', 'zh-HKTW') -or
      $Value.themeId -isnot [string] -or [string]$Value.themeId -cnotin @(
        'default', 'japanese-film-editorial', 'korean-prestige', 'cartoon-studio',
        'anime-twilight', 'study-library', 'japanese-idol', 'korean-idol') -or
      $Value.appearance -isnot [string] -or
      [string]$Value.appearance -cnotin @('system', 'light', 'dark') -or
      $Value.enabled -isnot [bool]) {
    return $false
  }
  return $true
}

function Update-AuraWebTabWorkHubPresentation {
  param(
    [Parameter(Mandatory = $true)][object]$Presentation,
    [switch]$Force
  )
  if (-not (Test-AuraWebTabWorkHubPresentation -Value $Presentation)) { return $false }
  $revision = [long]$Presentation.revision
  if (-not $Force -and $revision -le [long]$script:AuraWebTabWorkHubPresentationRevision) {
    return $false
  }
  if ($Force -and $revision -lt [long]$script:AuraWebTabWorkHubPresentationRevision) {
    return $false
  }
  $script:AuraWebTabWorkHubPresentation = $Presentation
  if (-not $script:AuraWebTabWorkHubReady -or
      $null -eq $script:AuraWebTabWorkHubWebView -or
      $script:AuraWebTabWorkHubWebView.IsDisposed -or
      $null -eq $script:AuraWebTabWorkHubWebView.CoreWebView2) {
    return $false
  }
  $json = $Presentation | ConvertTo-Json -Depth 3 -Compress
  $script:AuraWebTabWorkHubWebView.CoreWebView2.PostWebMessageAsJson($json)
  $script:AuraWebTabWorkHubPresentationRevision = $revision
  return $true
}

function Select-AuraWebTabWorkHubDocument {
  param([Parameter(Mandatory = $true)][object]$Document)
  [void](ConvertTo-AuraWebTabDocument -Value $Document)
  if ($null -eq $Document.activeTabId) {
    return [PSCustomObject]@{ Ok = $true; Code = 'unchanged'; ActiveTabId = $null }
  }
  $Document.schemaVersion = 2
  $Document.activeTabId = $null
  $Document.revision = [long]$Document.revision + 1
  return [PSCustomObject]@{ Ok = $true; Code = 'work-hub-selected'; ActiveTabId = $null }
}

function Set-AuraWebTabWorkHubActive {
  if ($null -eq $script:AuraWebTabDocument) { return $false }
  foreach ($runtimeId in @($script:AuraWebTabRuntime.Keys)) {
    $runtime = Get-AuraWebTabRuntime -Id ([string]$runtimeId)
    if ($null -ne $runtime -and $null -ne $runtime.View -and -not $runtime.View.IsDisposed) {
      $runtime.View.Hide()
    }
  }
  if ($null -ne $script:AuraWebTabStandbyView -and -not $script:AuraWebTabStandbyView.IsDisposed) {
    if ($script:AuraWebTabStandbyView.PSObject.Methods.Name -contains 'Hide') {
      $script:AuraWebTabStandbyView.Hide()
    }
  }
  if ($null -ne $script:AuraWebTabWorkHubControl -and
      -not $script:AuraWebTabWorkHubControl.IsDisposed) {
    $script:AuraWebTabWorkHubControl.Show()
    $script:AuraWebTabWorkHubControl.BringToFront()
  }
  if (Get-Command Hide-AuraUiLoading -ErrorAction SilentlyContinue) {
    Hide-AuraUiLoading
  }
  $result = Select-AuraWebTabWorkHubDocument -Document $script:AuraWebTabDocument
  if ([string]$result.Code -cne 'unchanged') { Save-AuraWebTabs }
  Refresh-AuraWebTabStrip
  return $true
}

function New-AuraWebTabWorkHubWebView {
  try {
    $view = [Microsoft.Web.WebView2.WinForms.WebView2]::new()
    $view.Dock = [System.Windows.Forms.DockStyle]::Fill
    $view.Tag = 'work-hub-local'
    $view.BackColor = [Drawing.ColorTranslator]::FromHtml('#F4F1EA')
    return $view
  } catch {
    # Unit harnesses and unsupported runtimes can load this module without the
    # WebView2 WinForms assembly. The owned panel remains a safe empty surface.
    return $null
  }
}

function Start-AuraWebTabWorkHubWebView {
  param(
    [Parameter(Mandatory = $true)][object]$Environment,
    [Parameter(Mandatory = $true)][string]$StudioRoot
  )
  if ($null -eq $script:AuraWebTabWorkHubWebView -or
      $script:AuraWebTabWorkHubWebView.IsDisposed -or
      $script:AuraWebTabWorkHubReady -or
      $null -ne $script:AuraWebTabWorkHubEnsureTask -or
      -not (Test-Path -LiteralPath $StudioRoot -PathType Container)) {
    return $false
  }
  $script:AuraWebTabWorkHubRoot = [IO.Path]::GetFullPath($StudioRoot)
  $script:AuraWebTabWorkHubEnsureTask =
    $script:AuraWebTabWorkHubWebView.EnsureCoreWebView2Async($Environment)
  return $true
}

function Complete-AuraWebTabWorkHubWebView {
  if ($script:AuraWebTabWorkHubReady) { return $true }
  if ($null -eq $script:AuraWebTabWorkHubEnsureTask -or
      -not $script:AuraWebTabWorkHubEnsureTask.IsCompleted) {
    return $false
  }
  try {
    $task = $script:AuraWebTabWorkHubEnsureTask
    $script:AuraWebTabWorkHubEnsureTask = $null
    [void]$task.GetAwaiter().GetResult()
    $core = $script:AuraWebTabWorkHubWebView.CoreWebView2
    if ($null -eq $core) { throw 'Work Hub WebView2 core is unavailable.' }
    $core.Settings.AreDevToolsEnabled = $false
    $core.Settings.IsStatusBarEnabled = $false
    $core.Settings.AreDefaultContextMenusEnabled = $false
    $core.Settings.AreBrowserAcceleratorKeysEnabled = $true
    $core.Settings.IsZoomControlEnabled = $true
    $core.Settings.IsWebMessageEnabled = $true
    $core.SetVirtualHostNameToFolderMapping(
      'aura.studio',
      $script:AuraWebTabWorkHubRoot,
      [Microsoft.Web.WebView2.Core.CoreWebView2HostResourceAccessKind]::Allow)
    $core.add_NavigationStarting({
      param($sender, $eventArgs)
      try {
        $uri = [Uri]$eventArgs.Uri
        if (-not (Test-AuraSessionBoardDocumentUri -Uri $uri -Surface 'compact')) {
          $eventArgs.Cancel = $true
        }
      } catch {
        $eventArgs.Cancel = $true
      }
    })
    $core.add_WebMessageReceived({
      param($sender, $eventArgs)
      try {
        $response = Invoke-AuraSessionBoardHostRequest `
          -Json $eventArgs.WebMessageAsJson -Source $eventArgs.Source -Surface 'compact'
        $sender.PostWebMessageAsJson(($response | ConvertTo-Json -Depth 9 -Compress))
      } catch {
        if (Get-Command Write-AuraUiLog -ErrorAction SilentlyContinue) {
          Write-AuraUiLog -Message 'Compact Work Hub message was rejected.'
        }
      }
    })
    $core.add_NewWindowRequested({
      param($sender, $eventArgs)
      $eventArgs.Handled = $true
    })
    $core.add_NavigationCompleted({
      param($sender, $eventArgs)
      if ($eventArgs.PSObject.Properties.Name -contains 'IsSuccess' -and -not $eventArgs.IsSuccess) {
        return
      }
      if ($null -ne $script:AuraWebTabWorkHubPresentation) {
        [void](Update-AuraWebTabWorkHubPresentation `
          -Presentation $script:AuraWebTabWorkHubPresentation -Force)
      }
    })
    $script:AuraWebTabWorkHubReady = $true
    $core.Navigate('https://aura.studio/work-hub.html')
    return $true
  } catch {
    $script:AuraWebTabWorkHubEnsureTask = $null
    $script:AuraWebTabWorkHubReady = $false
    if (Get-Command Write-AuraUiLog -ErrorAction SilentlyContinue) {
      Write-AuraUiLog -Message 'Compact Work Hub initialization failed.'
    }
    return $false
  }
}

function ConvertFrom-AuraWebTabDropData {
  param(
    [AllowNull()][object]$Data,
    [Parameter(Mandatory = $true)][string]$Format
  )
  if ($Data -is [string]) {
    $text = [string]$Data
  } else {
    $bytes = $null
    if ($Data -is [byte[]]) {
      $bytes = [byte[]]$Data
    } elseif ($Data -is [IO.Stream]) {
      $originalPosition = $null
      try {
        if ($Data.CanSeek) {
          if ($Data.Length -gt 16384) { return $null }
          $originalPosition = [long]$Data.Position
          $Data.Position = 0
        }
        $memory = [IO.MemoryStream]::new()
        try {
          $buffer = [byte[]]::new(4096)
          while (($read = $Data.Read($buffer, 0, $buffer.Length)) -gt 0) {
            if ($memory.Length + $read -gt 16384) { return $null }
            $memory.Write($buffer, 0, $read)
          }
          $bytes = $memory.ToArray()
        } finally {
          $memory.Dispose()
        }
      } catch {
        return $null
      } finally {
        if ($null -ne $originalPosition) {
          try { $Data.Position = $originalPosition } catch {}
        }
      }
    } else {
      return $null
    }
    if ($null -eq $bytes -or $bytes.Length -gt 16384) { return $null }
    try {
      $encoding = if ($Format -ceq 'UniformResourceLocatorW' -or
          $Format -ceq [System.Windows.Forms.DataFormats]::UnicodeText) {
        [Text.UnicodeEncoding]::new($false, $false, $true)
      } else {
        [Text.UTF8Encoding]::new($false, $true)
      }
      $text = $encoding.GetString($bytes)
    } catch {
      return $null
    }
  }
  if ($null -eq $text -or $text.Length -gt 8192) { return $null }
  if ($text.Length -gt 0 -and $text[0] -eq [char]0xFEFF) {
    $text = $text.Substring(1)
  }
  if ($text.EndsWith([string][char]0)) {
    $text = $text.Substring(0, $text.Length - 1)
  }
  if ($text.Contains([string][char]0)) { return $null }
  return $text
}

function Get-AuraWebTabDroppedSessionUrl {
  param([AllowNull()][object]$DataObject)
  if ($null -eq $DataObject -or
      $DataObject.PSObject.Methods.Name -cnotcontains 'GetDataPresent' -or
      $DataObject.PSObject.Methods.Name -cnotcontains 'GetData') {
    return $null
  }
  $formats = @(
    'UniformResourceLocatorW',
    'UniformResourceLocator',
    'text/uri-list',
    'text/plain',
    [System.Windows.Forms.DataFormats]::UnicodeText,
    [System.Windows.Forms.DataFormats]::Text,
    [System.Windows.Forms.DataFormats]::StringFormat
  ) | Select-Object -Unique
  $routes = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  $recognized = $false
  foreach ($format in $formats) {
    try {
      if (-not $DataObject.GetDataPresent([string]$format, $false)) { continue }
      $recognized = $true
      $data = $DataObject.GetData([string]$format, $false)
    } catch {
      return $null
    }
    $text = ConvertFrom-AuraWebTabDropData -Data $data -Format ([string]$format)
    if ($null -eq $text) { return $null }
    $candidates = @()
    foreach ($line in @([regex]::Split($text, '\r\n|\n|\r'))) {
      $candidate = $line.Trim()
      if (-not $candidate -or $candidate.StartsWith('#', [StringComparison]::Ordinal)) { continue }
      $candidates += $candidate
    }
    if ($candidates.Count -ne 1) { return $null }
    try {
      $route = ConvertTo-AuraWebTabSessionUrl -Value ([string]$candidates[0])
    } catch {
      return $null
    }
    [void]$routes.Add($route)
  }
  if (-not $recognized -or $routes.Count -ne 1) { return $null }
  return @($routes)[0]
}

function Request-AuraUiOpenDroppedSession {
  param([AllowNull()][object]$DataObject)
  $route = Get-AuraWebTabDroppedSessionUrl -DataObject $DataObject
  if ($null -eq $route) { return $false }
  return [bool](Request-AuraUiNewWebTab -Url $route)
}

function Register-AuraWebTabDropTarget {
  param([AllowNull()][object]$Control)
  if ($null -eq $Control -or $Control.IsDisposed) { return }
  $Control.AllowDrop = $true
  $Control.add_DragEnter({
    param($sender, $eventArgs)
    $copyAllowed = ($eventArgs.AllowedEffect -band
      [System.Windows.Forms.DragDropEffects]::Copy) -ne 0
    if ($copyAllowed -and $null -ne (Get-AuraWebTabDroppedSessionUrl -DataObject $eventArgs.Data)) {
      $eventArgs.Effect = [System.Windows.Forms.DragDropEffects]::Copy
    } else {
      $eventArgs.Effect = [System.Windows.Forms.DragDropEffects]::None
    }
  })
  $Control.add_DragLeave({ param($sender, $eventArgs) })
  $Control.add_DragDrop({
    param($sender, $eventArgs)
    $eventArgs.Effect = [System.Windows.Forms.DragDropEffects]::None
    if (($eventArgs.AllowedEffect -band [System.Windows.Forms.DragDropEffects]::Copy) -ne 0 -and
        (Request-AuraUiOpenDroppedSession -DataObject $eventArgs.Data)) {
      $eventArgs.Effect = [System.Windows.Forms.DragDropEffects]::Copy
    }
  })
}

function Refresh-AuraWebTabStrip {
  if ($null -eq $script:AuraWebTabList -or $script:AuraWebTabList.IsDisposed -or
      $null -eq $script:AuraWebTabDocument) { return }
  $script:AuraWebTabList.SuspendLayout()
  try {
    $script:AuraWebTabList.Controls.Clear()
    $palette = if ($null -ne $script:AuraWebChromePalette) {
      $script:AuraWebChromePalette
    } else { Get-AuraWebChromePalette }
    foreach ($item in @(Get-AuraWebTabStripModel -Document $script:AuraWebTabDocument)) {
      $container = [System.Windows.Forms.Panel]::new()
      $container.Width = 132
      $container.Height = 34
      $container.Margin = [System.Windows.Forms.Padding]::new(0)
      $selectedBack = Get-AuraWebMixedColor `
        -From $palette.Chrome -To $palette.Surface -Amount 0.16
      $hoverBack = Get-AuraWebMixedColor `
        -From $palette.Chrome -To $palette.Surface -Amount 0.1
      $container.BackColor = if ($item.Selected) { $selectedBack } else {
        [Drawing.ColorTranslator]::FromHtml($palette.Chrome)
      }
      Register-AuraWebTabDropTarget -Control $container
      $select = [System.Windows.Forms.Button]::new()
      $select.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
      $select.FlatAppearance.BorderSize = 0
      $select.BackColor = $container.BackColor
      $select.FlatAppearance.MouseOverBackColor = $hoverBack
      $select.FlatAppearance.MouseDownBackColor = $selectedBack
      $tabForeground = if ($item.Selected) {
        Get-AuraWebContrastForeground -Color ([Drawing.ColorTranslator]::ToHtml($selectedBack))
      } else { $palette.ChromeForeground }
      $select.ForeColor = [Drawing.ColorTranslator]::FromHtml($tabForeground)
      $select.Font = [Drawing.Font]::new('Segoe UI Semibold', 9)
      $select.TextAlign = [Drawing.ContentAlignment]::MiddleLeft
      $select.Text = Get-AuraWebTabDisplayTitle -Title ([string]$item.Title)
      $select.AccessibleName = [string]$item.Title
      $select.Tag = [string]$item.Id
      $select.Location = [Drawing.Point]::new(0, 0)
      $select.Size = if ($item.Closable) {
        [Drawing.Size]::new(108, 32)
      } else { [Drawing.Size]::new(131, 32) }
      if ([string]$item.Kind -ceq 'work-hub') {
        $select.add_Click({ [void](Set-AuraWebTabWorkHubActive) })
      } else {
        $select.add_Click({ param($sender, $eventArgs) Request-AuraUiSelectWebTab -Id ([string]$sender.Tag) })
        $select.add_MouseUp({
          param($sender, $eventArgs)
          if ($eventArgs.Button -eq [System.Windows.Forms.MouseButtons]::Middle) {
            Request-AuraUiCloseWebTab -Id ([string]$sender.Tag)
          }
        })
      }
      Register-AuraWebTabDropTarget -Control $select
      $container.Controls.Add($select)
      if ($item.Closable) {
        $close = [System.Windows.Forms.Button]::new()
        $close.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
        $close.FlatAppearance.BorderSize = 0
        $close.BackColor = $container.BackColor
        $closeForeground = if ($item.Selected) { $palette.Muted } else { $palette.ChromeForeground }
        $close.ForeColor = [Drawing.ColorTranslator]::FromHtml($closeForeground)
        $close.FlatAppearance.MouseOverBackColor = $hoverBack
        $close.FlatAppearance.MouseDownBackColor = $selectedBack
        $close.Font = [Drawing.Font]::new('Segoe UI', 9)
        $close.Text = [char]0x00D7
        $close.AccessibleName = "$($script:UiCopy.closeTab): $([string]$item.Title)"
        $close.Tag = [string]$item.Id
        $close.Location = [Drawing.Point]::new(108, 0)
        $close.Size = [Drawing.Size]::new(23, 32)
        $close.add_Click({ param($sender, $eventArgs) Request-AuraUiCloseWebTab -Id ([string]$sender.Tag) })
        Register-AuraWebTabDropTarget -Control $close
        $container.Controls.Add($close)
      }
      $divider = [System.Windows.Forms.Panel]::new()
      $divider.Dock = [System.Windows.Forms.DockStyle]::Right
      $divider.Width = 1
      $divider.BackColor = Get-AuraWebMixedColor `
        -From $palette.Chrome -To $palette.ChromeForeground -Amount 0.28
      Register-AuraWebTabDropTarget -Control $divider
      $container.Controls.Add($divider)
      if ($item.Selected) {
        $activeLine = [System.Windows.Forms.Panel]::new()
        $activeLine.Dock = [System.Windows.Forms.DockStyle]::Bottom
        $activeLine.Height = 2
        $activeLine.BackColor = [Drawing.ColorTranslator]::FromHtml($palette.ChromeForeground)
        Register-AuraWebTabDropTarget -Control $activeLine
        $container.Controls.Add($activeLine)
        $activeLine.BringToFront()
      }
      $script:AuraWebTabList.Controls.Add($container)
    }
  } finally {
    $script:AuraWebTabList.ResumeLayout()
  }
  if ($null -ne $script:AuraWebTabNewButton) {
    $atLimit = @($script:AuraWebTabDocument.tabs).Count -ge $script:AuraWebTabMaximum
    $script:AuraWebTabNewButton.Enabled = -not $atLimit
  }
}

function Save-AuraWebTabs {
  if ($null -eq $script:AuraWebTabDocument) { return }
  foreach ($tab in @($script:AuraWebTabDocument.tabs)) {
    $runtime = Get-AuraWebTabRuntime -Id ([string]$tab.id)
    if ($null -eq $runtime -or $null -eq $runtime.View -or $runtime.View.IsDisposed) { continue }
    try {
      if ($null -ne $runtime.View.Source) {
        $tab.url = ConvertTo-AuraWebTabUrl -Value ([string]$runtime.View.Source.AbsoluteUri)
      }
      if ($null -ne $runtime.View.CoreWebView2) {
        $title = [string]$runtime.View.CoreWebView2.DocumentTitle
        if (Test-AuraWebTabText -Value $title -Maximum 160 -Required) { $tab.title = $title }
      }
    } catch {}
  }
  try { $script:AuraWebTabDocument = Write-AuraWebTabDocument -Document $script:AuraWebTabDocument }
  catch { Write-AuraUiLog -Message "Web tab state could not be saved: $($_.Exception.Message)" }
  if (Get-Command Request-AuraUiHostWork -ErrorAction SilentlyContinue) {
    try { Request-AuraUiHostWork } catch {}
  }
}

function Set-AuraWebTabActiveDocument {
  param([Parameter(Mandatory = $true)][string]$Id)
  $tab = Get-AuraWebTabRecord -Id $Id
  if ($null -eq $tab) { return $null }
  if ([string]$script:AuraWebTabDocument.activeTabId -cne $Id) {
    $script:AuraWebTabDocument.activeTabId = $Id
    $script:AuraWebTabDocument.revision = [long]$script:AuraWebTabDocument.revision + 1
    Save-AuraWebTabs
  }
  if (Get-Command Register-AuraSessionObservation -ErrorAction SilentlyContinue) {
    [void](Register-AuraSessionObservation -Url ([string]$tab.url) `
      -Title ([string]$tab.title) -Opened)
  }
  Refresh-AuraWebTabStrip
  return $tab
}

function New-AuraWebTabRuntimeRecord {
  param(
    [Parameter(Mandatory = $true)][string]$Id,
    [AllowNull()][object]$View = $null
  )
  $runtime = [PSCustomObject]@{
    View = $View
    Initialized = $false
    WebReady = $false
    PageReady = $false
    PrepaintScriptId = $null
    PrepaintRegisteredGeneration = [long]-1
  }
  $script:AuraWebTabRuntime[$Id] = $runtime
  return $runtime
}

function Add-AuraWebTabRuntime {
  param([string]$Url = 'https://claude.ai/')
  $result = Add-AuraWebTabDocument -Document $script:AuraWebTabDocument -Url $Url
  if (-not $result.Ok) { return $result }
  [void](New-AuraWebTabRuntimeRecord -Id ([string]$result.Id))
  Save-AuraWebTabs
  Refresh-AuraWebTabStrip
  return $result
}

function Remove-AuraWebTabRuntime {
  param([Parameter(Mandatory = $true)][string]$Id)
  $runtime = Get-AuraWebTabRuntime -Id $Id
  $result = Remove-AuraWebTabDocument -Document $script:AuraWebTabDocument -Id $Id
  if (-not $result.Ok) { return $result }
  if (Get-Command Unregister-AuraSessionResponseObserver -ErrorAction SilentlyContinue) {
    Unregister-AuraSessionResponseObserver -TabId $Id
  }
  [void]$script:AuraWebTabRuntime.Remove($Id)
  if ($null -ne $runtime -and $null -ne $runtime.View -and -not $runtime.View.IsDisposed) {
    $runtime.View.Hide()
    $runtime.View.Dispose()
  }
  Save-AuraWebTabs
  if ($null -eq $result.ActiveTabId) {
    [void](Set-AuraWebTabWorkHubActive)
  } else {
    Refresh-AuraWebTabStrip
  }
  return $result
}

function Ensure-AuraWebTabView {
  param([Parameter(Mandatory = $true)][string]$Id)
  $runtime = Get-AuraWebTabRuntime -Id $Id
  if ($null -eq $runtime) { return $null }
  if ($null -eq $runtime.View -or $runtime.View.IsDisposed) {
    if ($null -ne $script:AuraWebTabStandbyView -and
        -not $script:AuraWebTabStandbyView.IsDisposed) {
      $runtime.View = $script:AuraWebTabStandbyView
      $script:AuraWebTabStandbyView = $null
    } else {
      $runtime.View = [Microsoft.Web.WebView2.WinForms.WebView2]::new()
      $runtime.View.Dock = [System.Windows.Forms.DockStyle]::Fill
      $runtime.View.BackColor = [Drawing.ColorTranslator]::FromHtml('#F4F1EA')
      Initialize-AuraUiWebViewControl -Control $runtime.View
      $script:AuraWebTabContentPanel.Controls.Add($runtime.View)
    }
  }
  return $runtime.View
}

function Register-AuraWebTabInitialized {
  param([Parameter(Mandatory = $true)][object]$WebView)
  foreach ($id in @($script:AuraWebTabRuntime.Keys)) {
    $runtime = $script:AuraWebTabRuntime[$id]
    if ($runtime.View -eq $WebView) {
      $runtime.Initialized = $true
      $runtime.WebReady = $true
      $runtime.PageReady = $false
      return
    }
  }
}

function Save-AuraWebTabRuntimeState {
  if ($null -eq $script:AuraWebTabDocument) { return }
  $id = [string]$script:AuraWebTabDocument.activeTabId
  if ([string]::IsNullOrWhiteSpace($id)) { return }
  $runtime = Get-AuraWebTabRuntime -Id $id
  if ($null -eq $runtime) { return }
  $runtime.WebReady = [bool]$script:WebReady
  $runtime.PageReady = [bool]$script:PageReady
  $runtime.PrepaintScriptId = $script:PrepaintScriptId
  $runtime.PrepaintRegisteredGeneration = [long]$script:PrepaintRegisteredGeneration
}

function Restore-AuraWebTabRuntimeState {
  param([Parameter(Mandatory = $true)][string]$Id)
  $runtime = Get-AuraWebTabRuntime -Id $Id
  if ($null -eq $runtime) { return }
  $script:WebReady = [bool]$runtime.WebReady
  $script:PageReady = [bool]$runtime.PageReady
  $script:PrepaintScriptId = $runtime.PrepaintScriptId
  $script:PrepaintRegisteredGeneration = [long]$runtime.PrepaintRegisteredGeneration
  $script:ActiveNavigationId = $null
  $script:ActiveNavigationUri = $null
  $script:ReadyNavigationId = $null
  $script:PendingNavigationCompletion = $null
  $script:RescueChallengeCandidate = $null
  $script:RescueVerificationPending = $false
  $script:NavigationRecoverySurface = 'None'
  $script:PendingApply = $false
  $script:PendingRestore = $false
  $script:InitialNavigationPending = $false
}

function Test-AuraWebTabCoreActive {
  param([AllowNull()][object]$Core)
  return $null -ne $Core -and $null -ne $script:WebView -and
    $null -ne $script:WebView.CoreWebView2 -and $script:WebView.CoreWebView2 -eq $Core
}

function Sync-AuraWebTabMetadata {
  param([AllowNull()][object]$Core)
  if ($null -eq $Core -or $null -eq $script:AuraWebTabDocument) { return }
  foreach ($tab in @($script:AuraWebTabDocument.tabs)) {
    $runtime = Get-AuraWebTabRuntime -Id ([string]$tab.id)
    if ($null -eq $runtime -or $null -eq $runtime.View -or
        $null -eq $runtime.View.CoreWebView2 -or $runtime.View.CoreWebView2 -ne $Core) { continue }
    if ($null -eq $runtime.View.Source) { return }
    $url = try {
      ConvertTo-AuraWebTabUrl -Value ([string]$runtime.View.Source.AbsoluteUri)
    } catch {
      # WebView2 reports transient internal addresses such as about:blank while
      # a new controller starts. They are ordinary runtime state, never tab data.
      return
    }
    try {
      $title = [string]$Core.DocumentTitle
      if (-not (Test-AuraWebTabText -Value $title -Maximum 160 -Required)) { $title = [string]$tab.title }
      [void](Update-AuraWebTabDocument -Document $script:AuraWebTabDocument `
        -Id ([string]$tab.id) -Title $title -Url $url)
      if (Get-Command Register-AuraSessionObservation -ErrorAction SilentlyContinue) {
        [void](Register-AuraSessionObservation -Url $url -Title $title `
          -Opened:([string]$tab.id -ceq [string]$script:AuraWebTabDocument.activeTabId))
      }
      Refresh-AuraWebTabStrip
    } catch {
      Write-AuraUiLog -Message 'A web tab metadata update was rejected.'
    }
    return
  }
}

function New-AuraWebAppMenuButton {
  param(
    [Parameter(Mandatory = $true)][string]$Text,
    [Parameter(Mandatory = $true)][System.Windows.Forms.ContextMenuStrip]$Menu
  )
  $button = [System.Windows.Forms.Button]::new()
  $button.AutoSize = $true
  $button.AutoSizeMode = [System.Windows.Forms.AutoSizeMode]::GrowAndShrink
  $button.MinimumSize = [Drawing.Size]::new(0, 30)
  $button.Margin = [System.Windows.Forms.Padding]::new(0)
  $button.Padding = [System.Windows.Forms.Padding]::new(8, 0, 8, 0)
  $button.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
  $button.FlatAppearance.BorderSize = 0
  $button.UseVisualStyleBackColor = $false
  $button.Font = [Drawing.Font]::new('Segoe UI', 9)
  $button.Text = $Text
  $button.TextAlign = [Drawing.ContentAlignment]::MiddleCenter
  $button.AccessibleRole = [System.Windows.Forms.AccessibleRole]::MenuItem
  $button.Tag = $Menu
  $button.add_MouseEnter({
    param($sender, $eventArgs)
    if ($null -eq $script:AuraWebChromePalette) { return }
    $sender.BackColor = [Drawing.ColorTranslator]::FromHtml(
      $script:AuraWebChromePalette.SurfaceHover)
    $sender.ForeColor = [Drawing.ColorTranslator]::FromHtml(
      $script:AuraWebChromePalette.Foreground)
  })
  $button.add_MouseLeave({
    param($sender, $eventArgs)
    if ($null -eq $script:AuraWebChromePalette) { return }
    $sender.BackColor = [Drawing.ColorTranslator]::FromHtml(
      $script:AuraWebChromePalette.Chrome)
    $sender.ForeColor = [Drawing.ColorTranslator]::FromHtml(
      $script:AuraWebChromePalette.ChromeForeground)
  })
  $button.add_Click({
    param($sender, $eventArgs)
    $menu = $sender.Tag
    if ($null -eq $menu -or $menu.IsDisposed) { return }
    if ($null -ne $script:AuraWebChromePalette) {
      Update-AuraWebMenuAppearance -Menu $menu -Palette $script:AuraWebChromePalette
    }
    $menu.Show($sender, [Drawing.Point]::new(0, $sender.Height))
  })
  return $button
}

function New-AuraWebAppMenu {
  param([switch]$ShowChecks)
  $menu = [System.Windows.Forms.ContextMenuStrip]::new()
  $menu.ShowImageMargin = $false
  $menu.ShowCheckMargin = [bool]$ShowChecks
  $menu.AutoSize = $true
  $menu.MinimumSize = [Drawing.Size]::new(220, 0)
  $menu.Padding = [System.Windows.Forms.Padding]::new(0, 4, 0, 4)
  $menu.Font = [Drawing.Font]::new('Segoe UI', 9.75)
  return $menu
}

function Initialize-AuraWebAppBar {
  $script:AuraWebFileMenu = New-AuraWebAppMenu
  $script:AuraWebViewMenu = New-AuraWebAppMenu
  $script:AuraWebThemesMenu = New-AuraWebAppMenu -ShowChecks
  $script:AuraWebHelpMenu = New-AuraWebAppMenu

  $script:AuraWebFileNewItem = [System.Windows.Forms.ToolStripMenuItem]::new()
  $script:AuraWebFileNewItem.ShortcutKeyDisplayString = 'Ctrl+T'
  $script:AuraWebFileNewItem.add_Click({ [void](Request-AuraUiNewWebTab) })
  $script:AuraWebFileCloseItem = [System.Windows.Forms.ToolStripMenuItem]::new()
  $script:AuraWebFileCloseItem.ShortcutKeyDisplayString = 'Ctrl+W'
  $script:AuraWebFileCloseItem.add_Click({ Request-AuraUiCloseWebTab })
  $script:AuraWebFileStudioItem = [System.Windows.Forms.ToolStripMenuItem]::new()
  $script:AuraWebFileStudioItem.add_Click({ Show-AuraUiStudio })
  $script:AuraWebFileExitItem = [System.Windows.Forms.ToolStripMenuItem]::new()
  $script:AuraWebFileExitItem.add_Click({
    if ($null -ne $script:TrayExitItem -and -not $script:TrayExitItem.IsDisposed) {
      $script:TrayExitItem.PerformClick()
    } else { Request-AuraUiExit }
  })
  [void]$script:AuraWebFileMenu.Items.AddRange(@(
    $script:AuraWebFileNewItem,
    $script:AuraWebFileCloseItem,
    [System.Windows.Forms.ToolStripSeparator]::new(),
    $script:AuraWebFileStudioItem,
    [System.Windows.Forms.ToolStripSeparator]::new(),
    $script:AuraWebFileExitItem
  ))

  $script:AuraWebViewWorkHubItem = [System.Windows.Forms.ToolStripMenuItem]::new()
  $script:AuraWebViewWorkHubItem.ShortcutKeyDisplayString = 'Ctrl+1'
  $script:AuraWebViewWorkHubItem.add_Click({ [void](Set-AuraWebTabWorkHubActive) })
  $script:AuraWebViewPetVisibilityItem = [System.Windows.Forms.ToolStripMenuItem]::new()
  $script:AuraWebViewPetVisibilityItem.add_Click({
    $trayPetVariable = Get-Variable -Name TrayPetVisibilityItem -Scope Script -ErrorAction SilentlyContinue
    if ($null -ne $trayPetVariable -and $null -ne $trayPetVariable.Value -and
        -not $trayPetVariable.Value.IsDisposed) { $trayPetVariable.Value.PerformClick() }
  })
  $script:AuraWebViewPetSettingsItem = [System.Windows.Forms.ToolStripMenuItem]::new()
  $script:AuraWebViewPetSettingsItem.add_Click({
    $trayPetSettingsVariable = Get-Variable -Name TrayPetSettingsItem -Scope Script -ErrorAction SilentlyContinue
    if ($null -ne $trayPetSettingsVariable -and $null -ne $trayPetSettingsVariable.Value -and
        -not $trayPetSettingsVariable.Value.IsDisposed) { $trayPetSettingsVariable.Value.PerformClick() }
  })
  [void]$script:AuraWebViewMenu.Items.AddRange(@(
    $script:AuraWebViewWorkHubItem,
    [System.Windows.Forms.ToolStripSeparator]::new(),
    $script:AuraWebViewPetVisibilityItem,
    $script:AuraWebViewPetSettingsItem
  ))
  $script:AuraWebViewMenu.add_Opening({
    if (Get-Command Update-AuraUiPetMainActions -ErrorAction SilentlyContinue) {
      Update-AuraUiPetMainActions
    }
    Update-AuraWebAppBarCopy
  })

  $script:AuraWebThemesStudioItem = [System.Windows.Forms.ToolStripMenuItem]::new()
  $script:AuraWebThemesStudioItem.add_Click({
    Show-AuraUiStudio
    if ($script:StudioReady -and $null -ne $script:StudioWebView -and
        $null -ne $script:StudioWebView.CoreWebView2) {
      [void]$script:StudioWebView.CoreWebView2.ExecuteScriptAsync('location.hash="#themes"')
    }
  })
  $script:AuraWebThemesOriginalItem = [System.Windows.Forms.ToolStripMenuItem]::new()
  $script:AuraWebThemesOriginalItem.add_Click({
    if ($null -ne $script:TrayAppearanceItem -and -not $script:TrayAppearanceItem.IsDisposed) {
      $script:TrayAppearanceItem.PerformClick()
    }
  })
  $script:AuraWebThemeItems = @()
  $permanentThemeIds = if (
    (Get-Command Get-AuraUiPermanentThemeIds -ErrorAction SilentlyContinue) -and
    (Get-Command Get-AuraUiThemeByName -ErrorAction SilentlyContinue)) {
    @(Get-AuraUiPermanentThemeIds)
  } else { @() }
  foreach ($themeId in $permanentThemeIds) {
    $theme = Get-AuraUiThemeByName -Name $themeId
    if ($null -eq $theme) { continue }
    $themeItem = [System.Windows.Forms.ToolStripMenuItem]::new([string]$theme.label)
    $themeItem.Tag = $themeId
    $themeItem.add_Click({
      param($sender, $eventArgs)
      Invoke-AuraUiSelectTheme -Theme ([string]$sender.Tag)
    })
    $script:AuraWebThemeItems += $themeItem
    [void]$script:AuraWebThemesMenu.Items.Add($themeItem)
  }
  [void]$script:AuraWebThemesMenu.Items.Add([System.Windows.Forms.ToolStripSeparator]::new())
  [void]$script:AuraWebThemesMenu.Items.Add($script:AuraWebThemesStudioItem)
  [void]$script:AuraWebThemesMenu.Items.Add($script:AuraWebThemesOriginalItem)
  $script:AuraWebThemesMenu.add_Opening({
    $selectedTheme = [string](Get-AuraUiSelectedThemeName)
    foreach ($themeItem in @($script:AuraWebThemeItems)) {
      $themeItem.Checked = [string]::Equals(
        [string]$themeItem.Tag, $selectedTheme, [StringComparison]::OrdinalIgnoreCase)
    }
  })

  $script:AuraWebHelpAuraItem = [System.Windows.Forms.ToolStripMenuItem]::new()
  $script:AuraWebHelpAuraItem.add_Click({
    Show-AuraUiMessage `
      -Title (Get-AuraWebUiText -Name launcherHintTitle -Fallback 'Meet the Aura button') `
      -Message (Get-AuraWebUiText -Name launcherHintBody `
        -Fallback 'Click the Aura button for quick actions, or drag it to move it.')
  })
  $script:AuraWebHelpGuideItem = [System.Windows.Forms.ToolStripMenuItem]::new()
  $script:AuraWebHelpGuideItem.add_Click({
    if ($null -ne $script:TrayDesktopWorkspaceGuidanceItem -and
        -not $script:TrayDesktopWorkspaceGuidanceItem.IsDisposed) {
      $script:TrayDesktopWorkspaceGuidanceItem.PerformClick()
    } else { [void](Request-AuraUiDesktopWorkspaceGuidance) }
  })
  [void]$script:AuraWebHelpMenu.Items.AddRange(@(
    $script:AuraWebHelpAuraItem,
    $script:AuraWebHelpGuideItem
  ))

  $menuHost = [System.Windows.Forms.FlowLayoutPanel]::new()
  $menuHost.Dock = [System.Windows.Forms.DockStyle]::Fill
  $menuHost.FlowDirection = [System.Windows.Forms.FlowDirection]::LeftToRight
  $menuHost.WrapContents = $false
  $menuHost.AutoScroll = $false
  $menuHost.Margin = [System.Windows.Forms.Padding]::new(0)
  $menuHost.Padding = [System.Windows.Forms.Padding]::new(8, 0, 0, 0)

  $appIcon = [System.Windows.Forms.PictureBox]::new()
  $appIcon.Width = 24
  $appIcon.Height = 30
  $appIcon.Margin = [System.Windows.Forms.Padding]::new(0)
  $appIcon.SizeMode = [System.Windows.Forms.PictureBoxSizeMode]::CenterImage
  $appIcon.AccessibleName = 'Claude Aura'
  $mainIconVariable = Get-Variable -Name MainIcon -Scope Script -ErrorAction SilentlyContinue
  if ($null -ne $mainIconVariable -and $null -ne $mainIconVariable.Value) {
    $sourceIconBitmap = $mainIconVariable.Value.ToBitmap()
    try {
      $script:AuraWebAppIconImage = [Drawing.Bitmap]::new(
        $sourceIconBitmap, [Drawing.Size]::new(16, 16))
      $appIcon.Image = $script:AuraWebAppIconImage
    } finally { $sourceIconBitmap.Dispose() }
  }
  $menuHost.Controls.Add($appIcon)

  $script:AuraWebAppMenuButtons = @(
    (New-AuraWebAppMenuButton -Text (Get-AuraWebUiText -Name menuFile -Fallback 'File') -Menu $script:AuraWebFileMenu),
    (New-AuraWebAppMenuButton -Text (Get-AuraWebUiText -Name menuView -Fallback 'View') -Menu $script:AuraWebViewMenu),
    (New-AuraWebAppMenuButton -Text (Get-AuraWebUiText -Name menuThemes -Fallback 'Themes') -Menu $script:AuraWebThemesMenu),
    (New-AuraWebAppMenuButton -Text (Get-AuraWebUiText -Name menuHelp -Fallback 'Help') -Menu $script:AuraWebHelpMenu)
  )
  $menuHost.Controls.AddRange($script:AuraWebAppMenuButtons)

  $script:AuraWebAppBarTitle = [System.Windows.Forms.Label]::new()
  $script:AuraWebAppBarTitle.Dock = [System.Windows.Forms.DockStyle]::Fill
  $script:AuraWebAppBarTitle.Text = 'Claude Aura'
  $script:AuraWebAppBarTitle.TextAlign = [Drawing.ContentAlignment]::MiddleCenter
  $script:AuraWebAppBarTitle.Font = [Drawing.Font]::new('Segoe UI Semibold', 9)
  $script:AuraWebAppBarTitle.AccessibleRole = [System.Windows.Forms.AccessibleRole]::TitleBar

  $balance = [System.Windows.Forms.Panel]::new()
  $balance.Dock = [System.Windows.Forms.DockStyle]::Fill
  $windowControls = [System.Windows.Forms.FlowLayoutPanel]::new()
  $windowControls.Dock = [System.Windows.Forms.DockStyle]::Right
  $windowControls.Width = 138
  $windowControls.Height = 30
  $windowControls.FlowDirection = [System.Windows.Forms.FlowDirection]::LeftToRight
  $windowControls.WrapContents = $false
  $windowControls.Margin = [System.Windows.Forms.Padding]::new(0)
  $windowControls.Padding = [System.Windows.Forms.Padding]::new(0)
  $minimize = New-AuraWebWindowControlButton -Text ([char]0x2014) `
    -AccessibleName (Get-AuraWebUiText -Name minimizeWindow -Fallback 'Minimize window') `
    -Action { $script:Form.WindowState = [System.Windows.Forms.FormWindowState]::Minimized }
  $maximize = New-AuraWebWindowControlButton -Text ([char]0x25A1) `
    -AccessibleName (Get-AuraWebUiText -Name maximizeWindow -Fallback 'Maximize window') `
    -Action { Switch-AuraWebWindowMaximized }
  $close = New-AuraWebWindowControlButton -Text ([char]0x00D7) `
    -AccessibleName (Get-AuraWebUiText -Name closeWindow -Fallback 'Close window') `
    -Action { $script:Form.Close() } -Close
  $script:AuraWebWindowControlButtons = @($minimize, $maximize, $close)
  $script:AuraWebWindowMaximizeButton = $maximize
  $windowControls.Controls.AddRange($script:AuraWebWindowControlButtons)
  $balance.Controls.Add($windowControls)
  $layout = [System.Windows.Forms.TableLayoutPanel]::new()
  $layout.Dock = [System.Windows.Forms.DockStyle]::Fill
  $layout.Margin = [System.Windows.Forms.Padding]::new(0)
  $layout.Padding = [System.Windows.Forms.Padding]::new(0)
  $layout.ColumnCount = 3
  $layout.RowCount = 1
  [void]$layout.ColumnStyles.Add([System.Windows.Forms.ColumnStyle]::new(
    [System.Windows.Forms.SizeType]::Percent, 42))
  [void]$layout.ColumnStyles.Add([System.Windows.Forms.ColumnStyle]::new(
    [System.Windows.Forms.SizeType]::Percent, 16))
  [void]$layout.ColumnStyles.Add([System.Windows.Forms.ColumnStyle]::new(
    [System.Windows.Forms.SizeType]::Percent, 42))
  [void]$layout.RowStyles.Add([System.Windows.Forms.RowStyle]::new(
    [System.Windows.Forms.SizeType]::Percent, 100))
  $layout.Controls.Add($menuHost, 0, 0)
  $layout.Controls.Add($script:AuraWebAppBarTitle, 1, 0)
  $layout.Controls.Add($balance, 2, 0)

  foreach ($surface in @($menuHost, $script:AuraWebAppBarTitle, $balance, $layout)) {
    Register-AuraWebWindowDragSurface -Control $surface
  }

  $script:AuraWebAppBar = [System.Windows.Forms.Panel]::new()
  $script:AuraWebAppBar.Dock = [System.Windows.Forms.DockStyle]::Top
  $script:AuraWebAppBar.Height = 30
  $script:AuraWebAppBar.Margin = [System.Windows.Forms.Padding]::new(0)
  $script:AuraWebAppBar.Controls.Add($layout)
  $script:Form.add_SizeChanged({ Update-AuraWebWindowControlState })
  Update-AuraWebAppBarCopy
}

function Initialize-AuraWebTabs {
  param(
    [Parameter(Mandatory = $true)][object]$ContentPanel,
    [Parameter(Mandatory = $true)][object]$InitialWebView,
    [Parameter(Mandatory = $true)][string]$InitialUrl
  )
  $script:AuraWebTabContentPanel = $ContentPanel
  try { $script:AuraWebTabDocument = Read-AuraWebTabDocument }
  catch {
    Write-AuraUiLog -Message "Web tab state could not be loaded: $($_.Exception.Message)"
    $script:AuraWebTabDocument = New-AuraWebTabDocument -InitialUrl $InitialUrl
  }
  $script:AuraWebTabRuntime = @{}
  $script:AuraWebTabStandbyView = $InitialWebView
  foreach ($tab in @($script:AuraWebTabDocument.tabs)) {
    [void](New-AuraWebTabRuntimeRecord -Id ([string]$tab.id))
    if (Get-Command Register-AuraSessionObservation -ErrorAction SilentlyContinue) {
      [void](Register-AuraSessionObservation -Url ([string]$tab.url) `
        -Title ([string]$tab.title) `
      -Opened:([string]$tab.id -ceq [string]$script:AuraWebTabDocument.activeTabId))
    }
  }
  if ($null -ne $script:AuraWebTabDocument.activeTabId) {
    $activeRuntime = Get-AuraWebTabRuntime -Id ([string]$script:AuraWebTabDocument.activeTabId)
    if ($null -ne $activeRuntime) {
      $activeRuntime.View = $InitialWebView
      $script:AuraWebTabStandbyView = $null
    }
  }

  $script:AuraWebTabWorkHubControl = [System.Windows.Forms.Panel]::new()
  $script:AuraWebTabWorkHubControl.Tag = 'work-hub'
  $script:AuraWebTabWorkHubControl.Dock = [System.Windows.Forms.DockStyle]::Fill
  $script:AuraWebTabWorkHubControl.BackColor = [Drawing.ColorTranslator]::FromHtml('#F4F1EA')
  $script:AuraWebTabWorkHubEnsureTask = $null
  $script:AuraWebTabWorkHubReady = $false
  $script:AuraWebTabWorkHubRoot = $null
  $script:AuraWebTabWorkHubPresentation = $null
  $script:AuraWebTabWorkHubPresentationRevision = [long]-1
  $script:AuraWebTabWorkHubWebView = New-AuraWebTabWorkHubWebView
  if ($null -ne $script:AuraWebTabWorkHubWebView) {
    $script:AuraWebTabWorkHubControl.Controls.Add($script:AuraWebTabWorkHubWebView)
  }
  $script:AuraWebTabContentPanel.Controls.Add($script:AuraWebTabWorkHubControl)
  if ($null -eq $script:AuraWebTabDocument.activeTabId) {
    if ($null -ne $script:AuraWebTabStandbyView -and -not $script:AuraWebTabStandbyView.IsDisposed) {
      if ($script:AuraWebTabStandbyView.PSObject.Methods.Name -contains 'Hide') {
        $script:AuraWebTabStandbyView.Hide()
      }
    }
    $script:AuraWebTabWorkHubControl.Show()
    $script:AuraWebTabWorkHubControl.BringToFront()
    if (Get-Command Hide-AuraUiLoading -ErrorAction SilentlyContinue) {
      Hide-AuraUiLoading
    }
  } else {
    $script:AuraWebTabWorkHubControl.Hide()
  }

  Initialize-AuraWebAppBar
  $script:AuraWebTabStrip = [System.Windows.Forms.Panel]::new()
  $script:AuraWebTabStrip.Dock = [System.Windows.Forms.DockStyle]::Fill
  $script:AuraWebTabStrip.Padding = [System.Windows.Forms.Padding]::new(0)
  $script:AuraWebTabStrip.BackColor = [Drawing.ColorTranslator]::FromHtml('#6B4FB3')
  $script:AuraWebTabNewButton = [System.Windows.Forms.Button]::new()
  $script:AuraWebTabNewButton.Dock = [System.Windows.Forms.DockStyle]::Right
  $script:AuraWebTabNewButton.Width = 38
  $script:AuraWebTabNewButton.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
  $script:AuraWebTabNewButton.FlatAppearance.BorderSize = 0
  $script:AuraWebTabNewButton.Text = '+'
  $script:AuraWebTabNewButton.Font = [Drawing.Font]::new('Segoe UI Semibold', 12)
  $script:AuraWebTabNewButton.AccessibleName = "$($script:UiCopy.newTab)"
  $script:AuraWebTabNewButton.add_Click({ [void](Request-AuraUiNewWebTab) })
  $script:AuraWebTabList = [System.Windows.Forms.FlowLayoutPanel]::new()
  $script:AuraWebTabList.Dock = [System.Windows.Forms.DockStyle]::Fill
  $script:AuraWebTabList.FlowDirection = [System.Windows.Forms.FlowDirection]::LeftToRight
  $script:AuraWebTabList.WrapContents = $false
  $script:AuraWebTabList.AutoScroll = $true
  $script:AuraWebTabList.Margin = [System.Windows.Forms.Padding]::new(0)
  Register-AuraWebTabDropTarget -Control $script:AuraWebTabStrip
  Register-AuraWebTabDropTarget -Control $script:AuraWebTabList
  Register-AuraWebTabDropTarget -Control $script:AuraWebTabNewButton
  $script:AuraWebTabStrip.Controls.Add($script:AuraWebTabList)
  $script:AuraWebTabStrip.Controls.Add($script:AuraWebTabNewButton)
  $script:AuraWebChromeHost = [System.Windows.Forms.Panel]::new()
  $script:AuraWebChromeHost.Dock = [System.Windows.Forms.DockStyle]::Top
  $script:AuraWebChromeHost.Height = 64
  $script:AuraWebChromeHost.Margin = [System.Windows.Forms.Padding]::new(0)
  $script:AuraWebChromeHost.Controls.Add($script:AuraWebTabStrip)
  $script:AuraWebChromeHost.Controls.Add($script:AuraWebAppBar)
  $script:Form.Controls.Add($script:AuraWebChromeHost)
  # Web/Desktop is explained once through the Aura launcher guide. Keep the
  # everyday window focused: one application menu and one tab row, both drawn
  # from the active theme instead of a permanent destination switcher.
  $initialDark = if (Get-Command Test-AuraUiDarkChrome -ErrorAction SilentlyContinue) {
    [bool](Test-AuraUiDarkChrome)
  } else { $false }
  $launcherStyleVariable = Get-Variable -Name LauncherStyle -Scope Script -ErrorAction SilentlyContinue
  $initialMaterial = if ($null -ne $launcherStyleVariable) { $launcherStyleVariable.Value } else { $null }
  Update-AuraWebChromeAppearance -Dark $initialDark -Material $initialMaterial
  Refresh-AuraWebTabStrip
}

function Request-AuraUiSelectWebTabByOrdinal {
  param([Parameter(Mandatory = $true)][ValidateRange(1, 9)][int]$Ordinal)
  if (Get-Command Test-AuraUiWebTabTransitionAllowed -ErrorAction SilentlyContinue) {
    if (-not (Test-AuraUiWebTabTransitionAllowed)) { return $false }
  }
  if ($null -eq $script:AuraWebTabDocument) { return $false }
  $items = @(Get-AuraWebTabStripModel -Document $script:AuraWebTabDocument)
  if ($items.Count -eq 0) { return $false }
  $target = if ($Ordinal -eq 9) {
    $items[$items.Count - 1]
  } else {
    $index = $Ordinal - 1
    if ($index -ge $items.Count) { return $false }
    $items[$index]
  }
  if ([string]$target.Kind -ceq 'work-hub') {
    return [bool](Set-AuraWebTabWorkHubActive)
  }
  return [bool](Request-AuraUiSelectWebTab -Id ([string]$target.Id))
}

function Dispose-AuraWebTabs {
  Save-AuraWebTabs
  foreach ($id in @($script:AuraWebTabRuntime.Keys)) {
    $runtime = $script:AuraWebTabRuntime[$id]
    if ($null -ne $runtime.View -and -not $runtime.View.IsDisposed) {
      try { $runtime.View.Dispose() } catch {}
    }
  }
  $script:AuraWebTabRuntime = @{}
  if ($null -ne $script:AuraWebTabStandbyView -and -not $script:AuraWebTabStandbyView.IsDisposed) {
    try { $script:AuraWebTabStandbyView.Dispose() } catch {}
  }
  $script:AuraWebTabStandbyView = $null
  $script:AuraWebTabWorkHubEnsureTask = $null
  $script:AuraWebTabWorkHubReady = $false
  $script:AuraWebTabWorkHubRoot = $null
  $script:AuraWebTabWorkHubPresentation = $null
  $script:AuraWebTabWorkHubPresentationRevision = [long]-1
  if ($null -ne $script:AuraWebTabWorkHubWebView -and
      -not $script:AuraWebTabWorkHubWebView.IsDisposed) {
    try { $script:AuraWebTabWorkHubWebView.Dispose() } catch {}
  }
  $script:AuraWebTabWorkHubWebView = $null
  if ($null -ne $script:AuraWebTabWorkHubControl -and
      -not $script:AuraWebTabWorkHubControl.IsDisposed) {
    $script:AuraWebTabWorkHubControl.Dispose()
  }
  $script:AuraWebTabWorkHubControl = $null
  foreach ($menu in @(
    $script:AuraWebFileMenu,
    $script:AuraWebViewMenu,
    $script:AuraWebThemesMenu,
    $script:AuraWebHelpMenu
  )) {
    if ($null -ne $menu -and -not $menu.IsDisposed) { try { $menu.Dispose() } catch {} }
  }
  if ($null -ne $script:AuraWebChromeHost -and -not $script:AuraWebChromeHost.IsDisposed) {
    $script:AuraWebChromeHost.Dispose()
  }
  if ($null -ne $script:AuraWebAppIconImage) {
    try { $script:AuraWebAppIconImage.Dispose() } catch {}
  }
  $script:AuraWebChromeHost = $null
  $script:AuraWebAppBar = $null
  $script:AuraWebAppBarTitle = $null
  $script:AuraWebAppIconImage = $null
  $script:AuraWebAppMenuButtons = @()
  $script:AuraWebWindowControlButtons = @()
  $script:AuraWebWindowMaximizeButton = $null
  $script:AuraWebFileMenu = $null
  $script:AuraWebViewMenu = $null
  $script:AuraWebThemesMenu = $null
  $script:AuraWebHelpMenu = $null
  $script:AuraWebFileNewItem = $null
  $script:AuraWebFileCloseItem = $null
  $script:AuraWebFileExitItem = $null
  $script:AuraWebFileStudioItem = $null
  $script:AuraWebViewWorkHubItem = $null
  $script:AuraWebViewPetVisibilityItem = $null
  $script:AuraWebViewPetSettingsItem = $null
  $script:AuraWebThemesStudioItem = $null
  $script:AuraWebThemesOriginalItem = $null
  $script:AuraWebThemeItems = @()
  $script:AuraWebHelpAuraItem = $null
  $script:AuraWebHelpGuideItem = $null
  $script:AuraWebTabStrip = $null
  $script:AuraWebTabList = $null
  $script:AuraWebTabNewButton = $null
  $script:AuraWebChromePalette = $null
}
