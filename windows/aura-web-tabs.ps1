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
    foreach ($item in @(Get-AuraWebTabStripModel -Document $script:AuraWebTabDocument)) {
      $container = [System.Windows.Forms.Panel]::new()
      $container.Width = 190
      $container.Height = 32
      $container.Margin = [System.Windows.Forms.Padding]::new(0, 3, 4, 3)
      $container.BackColor = if ($item.Selected) {
        [Drawing.ColorTranslator]::FromHtml('#FFFFFF')
      } else { [Drawing.ColorTranslator]::FromHtml('#E6E8EF') }
      Register-AuraWebTabDropTarget -Control $container
      $select = [System.Windows.Forms.Button]::new()
      $select.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
      $select.FlatAppearance.BorderSize = 0
      $select.BackColor = $container.BackColor
      $select.ForeColor = [Drawing.ColorTranslator]::FromHtml('#202124')
      $select.TextAlign = [Drawing.ContentAlignment]::MiddleLeft
      $select.Text = Get-AuraWebTabDisplayTitle -Title ([string]$item.Title)
      $select.AccessibleName = [string]$item.Title
      $select.Tag = [string]$item.Id
      $select.Location = [Drawing.Point]::new(2, 2)
      $select.Size = if ($item.Closable) {
        [Drawing.Size]::new(156, 28)
      } else { [Drawing.Size]::new(186, 28) }
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
        $close.ForeColor = [Drawing.ColorTranslator]::FromHtml('#5F6368')
        $close.Font = [Drawing.Font]::new('Segoe UI', 10)
        $close.Text = [char]0x00D7
        $close.AccessibleName = "$($script:UiCopy.closeTab): $([string]$item.Title)"
        $close.Tag = [string]$item.Id
        $close.Location = [Drawing.Point]::new(160, 2)
        $close.Size = [Drawing.Size]::new(28, 28)
        $close.add_Click({ param($sender, $eventArgs) Request-AuraUiCloseWebTab -Id ([string]$sender.Tag) })
        Register-AuraWebTabDropTarget -Control $close
        $container.Controls.Add($close)
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

  $script:AuraWebTabStrip = [System.Windows.Forms.Panel]::new()
  $script:AuraWebTabStrip.Dock = [System.Windows.Forms.DockStyle]::Top
  $script:AuraWebTabStrip.Height = 40
  $script:AuraWebTabStrip.Padding = [System.Windows.Forms.Padding]::new(8, 1, 8, 1)
  $script:AuraWebTabStrip.BackColor = [Drawing.ColorTranslator]::FromHtml('#F1F2F7')
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
  $script:Form.Controls.Add($script:AuraWebTabStrip)
  $script:AuraWebTabStrip.BringToFront()
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
  if ($null -ne $script:AuraWebTabStrip -and -not $script:AuraWebTabStrip.IsDisposed) {
    $script:AuraWebTabStrip.Dispose()
  }
  $script:AuraWebTabStrip = $null
  $script:AuraWebTabList = $null
  $script:AuraWebTabNewButton = $null
}
