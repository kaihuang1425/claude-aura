# Claude Aura Prompt Shelf (WO-30)
#
# This module owns only local draft storage and a native WinForms panel.
# Composer insertion stays a separate, explicit one-shot WebView operation.
# Nothing in this file submits a form, presses Enter, or observes Claude
# response state.

$script:PromptShelfStoreRoot = Join-Path $DataRoot 'prompt-shelf'
$script:PromptShelfStatePath = Join-Path $script:PromptShelfStoreRoot 'drafts.bin'
$script:PromptShelfTargetKeyPath = Join-Path $script:PromptShelfStoreRoot 'target-key.bin'
$script:PromptShelfLegacyStatePath = Join-Path $DataRoot 'prompt-shelf.json'
$script:PromptShelfStateMagic = [Text.Encoding]::ASCII.GetBytes("CLAUDE-AURA-PROMPT-SHELF-1`n")
$script:PromptShelfEntropy = [Text.Encoding]::UTF8.GetBytes('ClaudeAura.PromptShelf.v1')
$script:PromptShelfTargetKeyMagic = [Text.Encoding]::ASCII.GetBytes("CLAUDE-AURA-TARGET-KEY-1`n")
$script:PromptShelfTargetKeyEntropy = [Text.Encoding]::UTF8.GetBytes('ClaudeAura.PromptShelf.TargetKey.v1')
$script:PromptShelfTargetKey = $null
$script:PromptShelfMaxItems = 50
$script:PromptShelfMaxTextLength = 8000
$script:PromptShelfMaxFileBytes = 512 * 1024
$script:PromptShelfInsertDelayMilliseconds = 3000
$script:PromptShelfInsertUncertainMilliseconds = 12000
$script:PromptShelfItems = @()
$script:PromptShelfItemsLoaded = $false
$script:PromptShelfPersistenceAvailable = $true
$script:PromptShelfEditingId = $null
$script:PromptShelfPageEpoch = [long]0
$script:PromptShelfInsertOperation = $null
$script:PromptShelfInsertTimeout = $null
$script:PromptShelfInsertUncertainTimeout = $null
$script:PromptShelfStatusCopyName = $null
$script:PromptShelfStatusFallback = ''
$script:PromptShelfForm = $null
$script:PromptShelfIconWindow = $null
$script:PromptShelfToolTip = $null
$script:PromptShelfProfile = $null
$script:PromptShelfDisposing = $false
$script:PromptShelfPreferredSize = $null
$script:PromptShelfPreferredMinimumSize = $null
$script:PromptShelfPreferredDpi = 96
$script:PromptShelfStudioSession = ''
$script:PromptShelfStudioRevision = [long]0
$script:PromptShelfStudioCommandEpoch = [long]0
$script:PromptShelfStudioReceiptLimit = 64
$script:PromptShelfStudioReceipts = @{}
$script:PromptShelfStudioReceiptOrder = [Collections.Generic.Queue[string]]::new()

function Write-AuraPromptShelfEvent {
  param([Parameter(Mandatory = $true)][string]$Code)
  try { Write-AuraUiLog -Message "Prompt Shelf event: $Code" } catch {}
}

function ConvertTo-AuraPromptShelfTargetId {
  param(
    [Parameter(Mandatory = $true)][ValidateLength(1, 2048)][string]$RouteKey,
    [Parameter(Mandatory = $true)][ValidateCount(32, 32)][byte[]]$Key
  )
  $hmac = [Security.Cryptography.HMACSHA256]::new($Key)
  try {
    $hash = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($RouteKey))
  } finally {
    $hmac.Dispose()
  }
  $hex = ([BitConverter]::ToString($hash, 0, 16)).Replace('-', '').ToLowerInvariant()
  return '{0}-{1}-8{2}-8{3}-{4}' -f (
    $hex.Substring(0, 8)), ($hex.Substring(8, 4)), ($hex.Substring(13, 3)),
    ($hex.Substring(17, 3)), ($hex.Substring(20, 12))
}

function ConvertTo-AuraPromptShelfDraftFingerprint {
  param(
    [Parameter(Mandatory = $true)][ValidatePattern('^[a-f0-9]{32}$')][string]$Id,
    [Parameter(Mandatory = $true)][ValidateLength(1, 8000)][string]$Text,
    [Parameter(Mandatory = $true)][ValidateCount(32, 32)][byte[]]$Key
  )
  $payload = [Text.Encoding]::UTF8.GetBytes("ClaudeAura.NextMessage.v1`0$Id`0$Text")
  $hmac = [Security.Cryptography.HMACSHA256]::new($Key)
  $hash = $null
  try {
    $hash = $hmac.ComputeHash($payload)
    return ([BitConverter]::ToString($hash)).Replace('-', '').ToLowerInvariant()
  } finally {
    $hmac.Dispose()
    if ($null -ne $hash) { [Array]::Clear($hash, 0, $hash.Length) }
    [Array]::Clear($payload, 0, $payload.Length)
  }
}

function Get-AuraPromptShelfCopy {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Fallback
  )
  if ($null -ne $script:UiCopy) {
    $property = $script:UiCopy.PSObject.Properties[$Name]
    if ($null -ne $property -and $property.Value -is [string] -and $property.Value.Trim()) {
      return [string]$property.Value
    }
  }
  return $Fallback
}

function Get-AuraPromptShelfBlendedColor {
  param(
    [Parameter(Mandatory = $true)][Drawing.Color]$Foreground,
    [Parameter(Mandatory = $true)][Drawing.Color]$Background,
    [ValidateRange(0.0, 1.0)][double]$Weight
  )
  $inverse = 1.0 - $Weight
  return [Drawing.Color]::FromArgb(
    [int][Math]::Round(($Foreground.R * $Weight) + ($Background.R * $inverse)),
    [int][Math]::Round(($Foreground.G * $Weight) + ($Background.G * $inverse)),
    [int][Math]::Round(($Foreground.B * $Weight) + ($Background.B * $inverse)))
}

function Update-AuraPromptShelfCharacterCount {
  if ($null -eq $script:PromptShelfCharacterCountLabel -or
      $script:PromptShelfCharacterCountLabel.IsDisposed) { return }
  $count = if ($null -ne $script:PromptShelfDraftBox) {
    [int]$script:PromptShelfDraftBox.TextLength
  } else { 0 }
  $culture = [Globalization.CultureInfo]::CurrentCulture
  $script:PromptShelfCharacterCountLabel.Text = '{0} / {1}' -f (
    $count.ToString('N0', $culture)), ($script:PromptShelfMaxTextLength.ToString('N0', $culture))
  $format = Get-AuraPromptShelfCopy -Name 'promptShelfCharacterCount' -Fallback (
    '{0} of {1} characters')
  try {
    $script:PromptShelfCharacterCountLabel.AccessibleName = $format -f (
      $count.ToString('N0', $culture)), ($script:PromptShelfMaxTextLength.ToString('N0', $culture))
  } catch {
    $script:PromptShelfCharacterCountLabel.AccessibleName = $script:PromptShelfCharacterCountLabel.Text
  }
}

function Update-AuraPromptShelfResponsiveLayout {
  if ($null -eq $script:PromptShelfRoot -or $script:PromptShelfRoot.IsDisposed) { return }
  $contentWidth = [Math]::Max(
    220,
    $script:PromptShelfRoot.ClientSize.Width - $script:PromptShelfRoot.Padding.Horizontal)
  if ($null -ne $script:PromptShelfHelperLabel) {
    $script:PromptShelfHelperLabel.MaximumSize = [Drawing.Size]::new(
      [Math]::Max(200, $contentWidth - 18), 0)
  }
  if ($null -ne $script:PromptShelfStatusLabel) {
    $script:PromptShelfStatusLabel.MaximumSize = [Drawing.Size]::new($contentWidth, 0)
  }
  if ($null -ne $script:PromptShelfEmptyHelperLabel) {
    $script:PromptShelfEmptyHelperLabel.MaximumSize = [Drawing.Size]::new(
      [Math]::Max(180, $contentWidth - 64), 0)
  }
  $minimumContentHeight = [int][Math]::Round(
    512 * [Math]::Max(1.0, $script:PromptShelfForm.DeviceDpi / 96.0))
  $script:PromptShelfRoot.AutoScrollMinSize = [Drawing.Size]::new(0, $minimumContentHeight)
}

function Get-AuraPromptShelfAnchorContext {
  param([AllowNull()][System.Windows.Forms.Form]$HostForm)
  $launcherUsable = $null -ne $script:Launcher -and -not $script:Launcher.IsDisposed
  $workingArea = if ($launcherUsable) {
    [Windows.Forms.Screen]::FromControl($script:Launcher).WorkingArea
  } elseif ($null -ne $HostForm -and -not $HostForm.IsDisposed) {
    [Windows.Forms.Screen]::FromControl($HostForm).WorkingArea
  } else {
    [Windows.Forms.Screen]::PrimaryScreen.WorkingArea
  }
  $anchorX = if ($launcherUsable) {
    $script:Launcher.Left + $script:Launcher.Width
  } elseif ($null -ne $HostForm -and -not $HostForm.IsDisposed) {
    $HostForm.Right - 12
  } else {
    $workingArea.Right - 12
  }
  $anchorY = if ($launcherUsable) {
    $script:Launcher.Top
  } elseif ($null -ne $HostForm -and -not $HostForm.IsDisposed) {
    $HostForm.Bottom - 12
  } else {
    $workingArea.Bottom - 12
  }
  return [PSCustomObject]@{
    WorkingArea = $workingArea
    AnchorX = [int]$anchorX
    AnchorY = [int]$anchorY
  }
}

function Get-AuraPromptShelfFollowBounds {
  param(
    [Parameter(Mandatory = $true)][Drawing.Size]$CurrentSize,
    [Parameter(Mandatory = $true)][Drawing.Size]$PreferredSize,
    [Parameter(Mandatory = $true)][Drawing.Size]$PreferredMinimumSize,
    [Parameter(Mandatory = $true)][Drawing.Rectangle]$WorkingArea,
    [Parameter(Mandatory = $true)][int]$AnchorX,
    [Parameter(Mandatory = $true)][int]$AnchorY,
    [int]$HostHeight = 0,
    [int]$HostDpi = 96,
    [int]$ShelfDpi = 96,
    [int]$Margin = 12
  )
  $maximumWidth = [Math]::Max(1, $WorkingArea.Width - ($Margin * 2))
  $maximumHeight = [Math]::Max(1, $WorkingArea.Height - ($Margin * 2))
  $minimumWidth = [Math]::Min($maximumWidth, [Math]::Max(1, $PreferredMinimumSize.Width))
  $minimumHeight = [Math]::Min($maximumHeight, [Math]::Max(1, $PreferredMinimumSize.Height))
  $width = [Math]::Min(
    $maximumWidth,
    [Math]::Max($minimumWidth, [Math]::Max($PreferredSize.Width, $CurrentSize.Width)))
  $height = [Math]::Min(
    $maximumHeight,
    [Math]::Max($minimumHeight, [Math]::Max($PreferredSize.Height, $CurrentSize.Height)))
  if ($HostHeight -gt 0) {
    if ($HostDpi -lt 96 -or $HostDpi -gt 768) { $HostDpi = 96 }
    if ($ShelfDpi -lt 96 -or $ShelfDpi -gt 768) { $ShelfDpi = 96 }
    $hostHeightAtShelfDpi = [int][Math]::Round($HostHeight * $ShelfDpi / [double]$HostDpi)
    $logicalMarginAtShelfDpi = [int][Math]::Round(($Margin * 2) * $ShelfDpi / 96.0)
    $height = [Math]::Min(
      $maximumHeight,
      [Math]::Max($minimumHeight, $hostHeightAtShelfDpi - $logicalMarginAtShelfDpi))
  }
  $left = [Math]::Min(
    $WorkingArea.Right - $Margin - $width,
    [Math]::Max($WorkingArea.Left + $Margin, $AnchorX - $width))
  $top = $AnchorY - $height - 8
  if ($top -lt ($WorkingArea.Top + $Margin)) {
    $top = [Math]::Min(
      $WorkingArea.Bottom - $Margin - $height,
      $AnchorY + 8)
  }
  $top = [Math]::Max($WorkingArea.Top + $Margin, $top)
  return [PSCustomObject]@{
    Bounds = [Drawing.Rectangle]::new($left, $top, $width, $height)
    MinimumSize = [Drawing.Size]::new($minimumWidth, $minimumHeight)
  }
}

function Set-AuraPromptShelfBounds {
  param([AllowNull()][System.Windows.Forms.Form]$HostForm)
  if ($null -eq $script:PromptShelfForm -or
      $script:PromptShelfForm.IsDisposed -or
      -not $script:PromptShelfForm.IsHandleCreated) { return }
  $context = Get-AuraPromptShelfAnchorContext -HostForm $HostForm
  $shelfDpi = [int]$script:PromptShelfForm.DeviceDpi
  if ($shelfDpi -lt 96 -or $shelfDpi -gt 768) { $shelfDpi = 96 }
  $preferredDpi = [Math]::Max(96, [int]$script:PromptShelfPreferredDpi)
  $scale = $shelfDpi / [double]$preferredDpi
  $preferredSize = [Drawing.Size]::new(
    [int][Math]::Round($script:PromptShelfPreferredSize.Width * $scale),
    [int][Math]::Round($script:PromptShelfPreferredSize.Height * $scale))
  $preferredMinimumSize = [Drawing.Size]::new(
    [int][Math]::Round($script:PromptShelfPreferredMinimumSize.Width * $scale),
    [int][Math]::Round($script:PromptShelfPreferredMinimumSize.Height * $scale))
  $hostHeight = 0
  $hostDpi = 96
  if ($null -ne $HostForm -and -not $HostForm.IsDisposed -and
      $HostForm.Visible -and
      $HostForm.WindowState -ne [Windows.Forms.FormWindowState]::Minimized) {
    $hostHeight = [int]$HostForm.Height
    $hostDpi = [int]$HostForm.DeviceDpi
  }
  $layout = Get-AuraPromptShelfFollowBounds `
    -CurrentSize $script:PromptShelfForm.Size `
    -PreferredSize $preferredSize `
    -PreferredMinimumSize $preferredMinimumSize `
    -WorkingArea $context.WorkingArea `
    -AnchorX $context.AnchorX `
    -AnchorY $context.AnchorY `
    -HostHeight $hostHeight `
    -HostDpi $hostDpi `
    -ShelfDpi $shelfDpi
  # A small working area may temporarily require a lower native minimum. Always
  # restore the authored DPI-scaled minimum before growing on a larger screen.
  $script:PromptShelfForm.MinimumSize = $layout.MinimumSize
  $script:PromptShelfForm.Bounds = $layout.Bounds
  Update-AuraPromptShelfResponsiveLayout
}

function Update-AuraPromptShelfVisibleBounds {
  param([AllowNull()][System.Windows.Forms.Form]$HostForm)
  if ($null -eq $script:PromptShelfForm -or
      $script:PromptShelfForm.IsDisposed -or
      -not $script:PromptShelfForm.Visible) { return }
  if ($null -eq $HostForm -or $HostForm.IsDisposed -or -not $HostForm.Visible -or
      $HostForm.WindowState -eq [Windows.Forms.FormWindowState]::Minimized) { return }
  if ($null -ne $script:Form -and
      (-not $script:Form.Visible -or
        $script:Form.WindowState -eq [Windows.Forms.FormWindowState]::Minimized)) {
    return
  }
  Set-AuraPromptShelfBounds -HostForm $HostForm
}

function Test-AuraPromptShelfText {
  param([AllowEmptyString()][string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text) -or $Text.Length -gt $script:PromptShelfMaxTextLength) {
    return $false
  }
  return -not [regex]::IsMatch($Text, '[\x00-\x08\x0B\x0C\x0E-\x1F]')
}

function ConvertTo-AuraPromptShelfPersistedItems {
  param([AllowNull()][object[]]$Items)
  $source = @($Items)
  if ($source.Count -gt $script:PromptShelfMaxItems) {
    throw 'Prompt Shelf item count is outside the allowed range.'
  }
  $ids = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  $normalized = @()
  foreach ($item in $source) {
    if ($null -eq $item) { throw 'Prompt Shelf contains an empty item.' }
    $id = if ($item -is [Collections.IDictionary]) { $item['id'] } else { $item.id }
    $text = if ($item -is [Collections.IDictionary]) { $item['text'] } else { $item.text }
    if ($id -isnot [string] -or $id -cnotmatch '^[a-f0-9]{32}$' -or -not $ids.Add($id)) {
      throw 'Prompt Shelf contains an invalid or duplicate item id.'
    }
    if ($text -isnot [string] -or -not (Test-AuraPromptShelfText -Text $text)) {
      throw 'Prompt Shelf contains invalid draft text.'
    }
    $normalized += [PSCustomObject][ordered]@{ id = $id; text = $text }
  }
  return $normalized
}

function Assert-AuraPromptShelfNotReparsePoint {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return }
  $item = Get-Item -LiteralPath $Path -Force
  if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "Prompt Shelf storage cannot use a redirected path."
  }
}

function Set-AuraPromptShelfSecureAcl {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [switch]$Directory
  )
  Assert-AuraPromptShelfNotReparsePoint -Path $Path
  $userSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  if ($null -eq $userSid) { throw 'Prompt Shelf could not resolve the current Windows user.' }
  $systemSid = [Security.Principal.SecurityIdentifier]::new(
    [Security.Principal.WellKnownSidType]::LocalSystemSid, $null)
  $inheritance = if ($Directory) {
    [Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
      [Security.AccessControl.InheritanceFlags]::ObjectInherit
  } else {
    [Security.AccessControl.InheritanceFlags]::None
  }
  $security = if ($Directory) {
    [Security.AccessControl.DirectorySecurity]::new()
  } else {
    [Security.AccessControl.FileSecurity]::new()
  }
  $security.SetAccessRuleProtection($true, $false)
  $security.SetOwner($userSid)
  foreach ($sid in @($userSid, $systemSid)) {
    $rule = [Security.AccessControl.FileSystemAccessRule]::new(
      $sid,
      [Security.AccessControl.FileSystemRights]::FullControl,
      $inheritance,
      [Security.AccessControl.PropagationFlags]::None,
      [Security.AccessControl.AccessControlType]::Allow)
    [void]$security.AddAccessRule($rule)
  }
  if ($Directory) {
    [IO.Directory]::SetAccessControl($Path, $security)
    $applied = [IO.Directory]::GetAccessControl($Path)
  } else {
    [IO.File]::SetAccessControl($Path, $security)
    $applied = [IO.File]::GetAccessControl($Path)
  }
  if (-not $applied.AreAccessRulesProtected) {
    throw 'Prompt Shelf storage retained inherited access.'
  }
  $allowed = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  [void]$allowed.Add($userSid.Value)
  [void]$allowed.Add($systemSid.Value)
  $rules = @($applied.GetAccessRules(
      $true, $false, [Security.Principal.SecurityIdentifier]))
  if ($rules.Count -ne 2) { throw 'Prompt Shelf storage has an unexpected access rule count.' }
  foreach ($rule in $rules) {
    if ($rule.IsInherited -or
        $rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or
        -not $allowed.Contains($rule.IdentityReference.Value) -or
        ($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -ne
          [Security.AccessControl.FileSystemRights]::FullControl) {
      throw 'Prompt Shelf storage has an unexpected access rule.'
    }
  }
}

function Initialize-AuraPromptShelfStorage {
  param([string]$Path = $script:PromptShelfStatePath)
  Add-Type -AssemblyName System.Security -ErrorAction Stop
  $fullPath = [IO.Path]::GetFullPath($Path)
  $directory = [IO.Path]::GetFullPath((Split-Path -Parent $fullPath))
  if ([string]::Equals(
      $fullPath,
      [IO.Path]::GetFullPath($script:PromptShelfStatePath),
      [StringComparison]::OrdinalIgnoreCase)) {
    $dataRootFull = [IO.Path]::GetFullPath($DataRoot).TrimEnd(
      [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    $storeRootFull = [IO.Path]::GetFullPath($script:PromptShelfStoreRoot).TrimEnd(
      [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    if (-not $storeRootFull.StartsWith(
        $dataRootFull + [IO.Path]::DirectorySeparatorChar,
        [StringComparison]::OrdinalIgnoreCase) -or
        -not [string]::Equals($directory, $storeRootFull, [StringComparison]::OrdinalIgnoreCase)) {
      throw 'Prompt Shelf storage escaped the Aura data directory.'
    }
    Assert-AuraPromptShelfNotReparsePoint -Path $DataRoot
  }
  [void][IO.Directory]::CreateDirectory($directory)
  Set-AuraPromptShelfSecureAcl -Path $directory -Directory
  return $fullPath
}

function Read-AuraPromptShelfTargetKey {
  param([string]$Path = $script:PromptShelfTargetKeyPath)
  Assert-AuraPromptShelfNotReparsePoint -Path $Path
  Set-AuraPromptShelfSecureAcl -Path $Path
  $envelope = [IO.File]::ReadAllBytes($Path)
  $cipher = $null
  $plain = $null
  $result = $null
  try {
    if ($envelope.Length -le $script:PromptShelfTargetKeyMagic.Length -or
        $envelope.Length -gt 4096) {
      throw 'Prompt Shelf target key has an invalid size.'
    }
    for ($index = 0; $index -lt $script:PromptShelfTargetKeyMagic.Length; $index += 1) {
      if ($envelope[$index] -ne $script:PromptShelfTargetKeyMagic[$index]) {
        throw 'Prompt Shelf target key has an invalid header.'
      }
    }
    $cipherLength = $envelope.Length - $script:PromptShelfTargetKeyMagic.Length
    $cipher = [byte[]]::new($cipherLength)
    [Array]::Copy(
      $envelope, $script:PromptShelfTargetKeyMagic.Length, $cipher, 0, $cipherLength)
    $plain = [Security.Cryptography.ProtectedData]::Unprotect(
      $cipher,
      $script:PromptShelfTargetKeyEntropy,
      [Security.Cryptography.DataProtectionScope]::CurrentUser)
    if ($plain.Length -ne 32) { throw 'Prompt Shelf target key is invalid.' }
    $result = [byte[]]::new(32)
    [Array]::Copy($plain, $result, 32)
    Write-Output -NoEnumerate $result
  } finally {
    if ($null -ne $plain) { [Array]::Clear($plain, 0, $plain.Length) }
    if ($null -ne $cipher) { [Array]::Clear($cipher, 0, $cipher.Length) }
    [Array]::Clear($envelope, 0, $envelope.Length)
  }
}

function New-AuraPromptShelfTargetKey {
  param([string]$Path = $script:PromptShelfTargetKeyPath)
  $key = [byte[]]::new(32)
  $random = [Security.Cryptography.RandomNumberGenerator]::Create()
  $cipher = $null
  $envelope = $null
  $temporary = $null
  try {
    $random.GetBytes($key)
    $cipher = [Security.Cryptography.ProtectedData]::Protect(
      $key,
      $script:PromptShelfTargetKeyEntropy,
      [Security.Cryptography.DataProtectionScope]::CurrentUser)
    $envelope = [byte[]]::new($script:PromptShelfTargetKeyMagic.Length + $cipher.Length)
    [Array]::Copy(
      $script:PromptShelfTargetKeyMagic, 0, $envelope, 0,
      $script:PromptShelfTargetKeyMagic.Length)
    [Array]::Copy(
      $cipher, 0, $envelope, $script:PromptShelfTargetKeyMagic.Length, $cipher.Length)
    $temporary = Join-Path (Split-Path -Parent $Path) `
      ('.target-key-{0}.tmp' -f [Guid]::NewGuid().ToString('N'))
    [IO.File]::WriteAllBytes($temporary, $envelope)
    Set-AuraPromptShelfSecureAcl -Path $temporary
    if (Test-Path -LiteralPath $Path) {
      throw 'Prompt Shelf target key already exists.'
    }
    [IO.File]::Move($temporary, $Path)
    $temporary = $null
    Set-AuraPromptShelfSecureAcl -Path $Path
    $verified = [byte[]](Read-AuraPromptShelfTargetKey -Path $Path)
    if (-not [Linq.Enumerable]::SequenceEqual([byte[]]$key, [byte[]]$verified)) {
      throw 'Prompt Shelf target key did not verify.'
    }
    Write-Output -NoEnumerate $verified
  } finally {
    $random.Dispose()
    if ($temporary -and (Test-Path -LiteralPath $temporary -PathType Leaf)) {
      try { Remove-Item -LiteralPath $temporary -Force } catch {}
    }
    if ($null -ne $envelope) { [Array]::Clear($envelope, 0, $envelope.Length) }
    if ($null -ne $cipher) { [Array]::Clear($cipher, 0, $cipher.Length) }
    [Array]::Clear($key, 0, $key.Length)
  }
}

function Get-AuraPromptShelfTargetKey {
  if ($null -ne $script:PromptShelfTargetKey -and
      $script:PromptShelfTargetKey -is [byte[]] -and
      $script:PromptShelfTargetKey.Length -eq 32) {
    Write-Output -NoEnumerate $script:PromptShelfTargetKey
    return
  }
  try {
    [void](Initialize-AuraPromptShelfStorage)
    $key = if (Test-Path -LiteralPath $script:PromptShelfTargetKeyPath -PathType Leaf) {
      [byte[]](Read-AuraPromptShelfTargetKey)
    } else {
      [byte[]](New-AuraPromptShelfTargetKey)
    }
    if ($key.Length -ne 32) { throw 'Prompt Shelf target key is unavailable.' }
    $script:PromptShelfTargetKey = $key
    Write-Output -NoEnumerate $script:PromptShelfTargetKey
  } catch {
    Write-AuraPromptShelfEvent -Code 'target-key-unavailable'
    return $null
  }
}

function ConvertFrom-AuraPromptShelfJsonBytes {
  param([Parameter(Mandatory = $true)][byte[]]$Bytes)
  if ($Bytes.Length -le 0 -or $Bytes.Length -gt $script:PromptShelfMaxFileBytes) {
    throw 'Prompt Shelf state has an invalid size.'
  }
  if ($Bytes.Length -ge 3 -and
      $Bytes[0] -eq 0xEF -and $Bytes[1] -eq 0xBB -and $Bytes[2] -eq 0xBF) {
    throw 'Prompt Shelf state must be UTF-8 without a byte-order mark.'
  }
  $source = [Text.UTF8Encoding]::new($false, $true).GetString($Bytes)
  $value = $source | ConvertFrom-Json
  if ($value -isnot [Management.Automation.PSCustomObject]) {
    throw 'Prompt Shelf state must be an object.'
  }
  $rootNames = @($value.PSObject.Properties | ForEach-Object { $_.Name })
  if ($rootNames.Count -ne 2 -or
      $rootNames -cnotcontains 'schemaVersion' -or $rootNames -cnotcontains 'items' -or
      ($value.schemaVersion -isnot [int] -and $value.schemaVersion -isnot [long]) -or
      [int]$value.schemaVersion -ne 1 -or $null -eq $value.items) {
    throw 'Prompt Shelf state has an invalid schema.'
  }
  $rawItems = @($value.items)
  foreach ($item in $rawItems) {
    if ($item -isnot [Management.Automation.PSCustomObject]) {
      throw 'Prompt Shelf items must be objects.'
    }
    $itemNames = @($item.PSObject.Properties | ForEach-Object { $_.Name })
    if ($itemNames.Count -ne 2 -or $itemNames -cnotcontains 'id' -or $itemNames -cnotcontains 'text') {
      throw 'Prompt Shelf item shape is invalid.'
    }
  }
  return @(ConvertTo-AuraPromptShelfPersistedItems -Items $rawItems)
}

function Test-AuraPromptShelfItemsEqual {
  param(
    [AllowNull()][object[]]$Expected,
    [AllowNull()][object[]]$Actual
  )
  $left = @($Expected)
  $right = @($Actual)
  if ($left.Count -ne $right.Count) { return $false }
  for ($index = 0; $index -lt $left.Count; $index += 1) {
    if (-not [string]::Equals(
        [string]$left[$index].id,
        [string]$right[$index].id,
        [StringComparison]::Ordinal) -or
        -not [string]::Equals(
          [string]$left[$index].text,
          [string]$right[$index].text,
          [StringComparison]::Ordinal)) {
      return $false
    }
  }
  return $true
}

function Read-AuraPromptShelfEncryptedItems {
  param([Parameter(Mandatory = $true)][string]$Path)
  Assert-AuraPromptShelfNotReparsePoint -Path $Path
  Set-AuraPromptShelfSecureAcl -Path $Path
  $envelope = [IO.File]::ReadAllBytes($Path)
  $cipher = $null
  $plain = $null
  try {
    if ($envelope.Length -le $script:PromptShelfStateMagic.Length -or
        $envelope.Length -gt ($script:PromptShelfMaxFileBytes + 4096)) {
      throw 'Prompt Shelf encrypted state has an invalid size.'
    }
    for ($index = 0; $index -lt $script:PromptShelfStateMagic.Length; $index += 1) {
      if ($envelope[$index] -ne $script:PromptShelfStateMagic[$index]) {
        throw 'Prompt Shelf encrypted state has an invalid header.'
      }
    }
    $cipherLength = $envelope.Length - $script:PromptShelfStateMagic.Length
    $cipher = [byte[]]::new($cipherLength)
    [Array]::Copy(
      $envelope, $script:PromptShelfStateMagic.Length, $cipher, 0, $cipherLength)
    $plain = [Security.Cryptography.ProtectedData]::Unprotect(
      $cipher,
      $script:PromptShelfEntropy,
      [Security.Cryptography.DataProtectionScope]::CurrentUser)
    return @(ConvertFrom-AuraPromptShelfJsonBytes -Bytes $plain)
  } finally {
    if ($null -ne $plain) { [Array]::Clear($plain, 0, $plain.Length) }
    if ($null -ne $cipher) { [Array]::Clear($cipher, 0, $cipher.Length) }
    [Array]::Clear($envelope, 0, $envelope.Length)
  }
}

function Invoke-AuraPromptShelfLegacyMigration {
  param(
    [Parameter(Mandatory = $true)][string]$LegacyPath,
    [Parameter(Mandatory = $true)][string]$Path
  )
  $legacyBytes = $null
  $createdReplacement = $false
  $migrationCommitted = $false
  try {
    Assert-AuraPromptShelfNotReparsePoint -Path $LegacyPath
    Set-AuraPromptShelfSecureAcl -Path $LegacyPath
    $legacyBytes = [IO.File]::ReadAllBytes($LegacyPath)
    $legacyItems = @(ConvertFrom-AuraPromptShelfJsonBytes -Bytes $legacyBytes)
    [Array]::Clear($legacyBytes, 0, $legacyBytes.Length)
    $legacyBytes = $null

    if (Test-Path -LiteralPath $Path) {
      if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw 'Prompt Shelf encrypted replacement path is invalid.'
      }
    } else {
      $createdReplacement = $true
      Write-AuraPromptShelfItems -Items $legacyItems -Path $Path
    }

    $verifiedItems = @(Read-AuraPromptShelfEncryptedItems -Path $Path)
    if (-not (Test-AuraPromptShelfItemsEqual -Expected $legacyItems -Actual $verifiedItems)) {
      throw 'Prompt Shelf encrypted replacement did not verify.'
    }

    Assert-AuraPromptShelfNotReparsePoint -Path $LegacyPath
    Set-AuraPromptShelfSecureAcl -Path $LegacyPath
    Remove-Item -LiteralPath $LegacyPath -Force
    if (Test-Path -LiteralPath $LegacyPath) {
      throw 'Prompt Shelf legacy state could not be removed.'
    }
    $migrationCommitted = $true
    Write-AuraPromptShelfEvent -Code 'state-migrated'
  } catch {
    if ($null -ne $legacyBytes) {
      [Array]::Clear($legacyBytes, 0, $legacyBytes.Length)
      $legacyBytes = $null
    }
    if (-not $migrationCommitted -and $createdReplacement -and
        (Test-Path -LiteralPath $Path -PathType Leaf)) {
      try {
        Set-AuraPromptShelfSecureAcl -Path $Path
        Remove-Item -LiteralPath $Path -Force
      } catch {
        try { Set-AuraPromptShelfSecureAcl -Path $Path } catch {}
      }
    }
    if (Test-Path -LiteralPath $LegacyPath -PathType Leaf) {
      try { Set-AuraPromptShelfSecureAcl -Path $LegacyPath } catch {}
    }
    throw 'Prompt Shelf legacy migration was rejected.'
  } finally {
    if ($null -ne $legacyBytes) { [Array]::Clear($legacyBytes, 0, $legacyBytes.Length) }
  }
}

function Read-AuraPromptShelfItems {
  param([string]$Path = $script:PromptShelfStatePath)
  $isDefaultPath = [string]::Equals(
    [IO.Path]::GetFullPath($Path),
    [IO.Path]::GetFullPath($script:PromptShelfStatePath),
    [StringComparison]::OrdinalIgnoreCase)
  try {
    $Path = Initialize-AuraPromptShelfStorage -Path $Path
    if ($isDefaultPath -and
        (Test-Path -LiteralPath $script:PromptShelfLegacyStatePath -PathType Leaf)) {
      Invoke-AuraPromptShelfLegacyMigration `
        -LegacyPath $script:PromptShelfLegacyStatePath -Path $Path
    }
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return @() }
    return @(Read-AuraPromptShelfEncryptedItems -Path $Path)
  } catch {
    if ($isDefaultPath) { $script:PromptShelfPersistenceAvailable = $false }
    Write-AuraPromptShelfEvent -Code 'state-read-rejected'
    throw
  }
}

function Write-AuraPromptShelfItems {
  param(
    [AllowNull()][object[]]$Items,
    [string]$Path = $script:PromptShelfStatePath
  )
  $isDefaultPath = [string]::Equals(
    [IO.Path]::GetFullPath($Path),
    [IO.Path]::GetFullPath($script:PromptShelfStatePath),
    [StringComparison]::OrdinalIgnoreCase)
  $normalized = @(ConvertTo-AuraPromptShelfPersistedItems -Items $Items)
  $value = [ordered]@{
    schemaVersion = 1
    items = @($normalized)
  }
  $json = ($value | ConvertTo-Json -Depth 4 -Compress) + [Environment]::NewLine
  $plain = [Text.UTF8Encoding]::new($false).GetBytes($json)
  if ($plain.Length -gt $script:PromptShelfMaxFileBytes) {
    [Array]::Clear($plain, 0, $plain.Length)
    throw 'Prompt Shelf state exceeds its byte limit.'
  }

  $directory = $null
  $temporary = $null
  $backup = $null
  $rollback = $null
  $cipher = $null
  $priorEnvelope = $null
  $restoredEnvelope = $null
  $published = $false
  $committed = $false
  $rollbackCompleted = $false
  $hadExisting = $false
  try {
    $Path = Initialize-AuraPromptShelfStorage -Path $Path
    $directory = Split-Path -Parent $Path
    $temporary = Join-Path $directory ('.prompt-shelf-{0}.tmp' -f [Guid]::NewGuid().ToString('N'))
    $backup = Join-Path $directory ('.prompt-shelf-{0}.bak' -f [Guid]::NewGuid().ToString('N'))
    $rollback = Join-Path $directory ('.prompt-shelf-{0}.rollback' -f [Guid]::NewGuid().ToString('N'))
    $hadExisting = Test-Path -LiteralPath $Path -PathType Leaf
    if ($hadExisting) {
      Assert-AuraPromptShelfNotReparsePoint -Path $Path
      $existingInfo = Get-Item -LiteralPath $Path -Force
      if ($existingInfo.Length -gt ($script:PromptShelfMaxFileBytes + 4096)) {
        throw 'Prompt Shelf existing state exceeds its byte limit.'
      }
      $priorEnvelope = [IO.File]::ReadAllBytes($Path)
    } elseif (Test-Path -LiteralPath $Path) {
      throw 'Prompt Shelf state path is not a regular file.'
    }
    $cipher = [Security.Cryptography.ProtectedData]::Protect(
      $plain,
      $script:PromptShelfEntropy,
      [Security.Cryptography.DataProtectionScope]::CurrentUser)
    $envelope = [byte[]]::new($script:PromptShelfStateMagic.Length + $cipher.Length)
    [Array]::Copy(
      $script:PromptShelfStateMagic, 0, $envelope, 0, $script:PromptShelfStateMagic.Length)
    [Array]::Copy(
      $cipher, 0, $envelope, $script:PromptShelfStateMagic.Length, $cipher.Length)
    [IO.File]::WriteAllBytes($temporary, $envelope)
    Set-AuraPromptShelfSecureAcl -Path $temporary
    if ($hadExisting) {
      [IO.File]::Replace($temporary, $Path, $backup)
      $published = $true
      if (-not (Test-Path -LiteralPath $backup -PathType Leaf)) {
        throw 'Prompt Shelf replacement backup is unavailable.'
      }
      $backupEnvelope = [IO.File]::ReadAllBytes($backup)
      try {
        if (-not [Linq.Enumerable]::SequenceEqual(
            [byte[]]$priorEnvelope, [byte[]]$backupEnvelope)) {
          throw 'Prompt Shelf backup did not preserve the previous state.'
        }
      } finally {
        [Array]::Clear($backupEnvelope, 0, $backupEnvelope.Length)
      }
      Set-AuraPromptShelfSecureAcl -Path $backup
    } else {
      [IO.File]::Move($temporary, $Path)
      $published = $true
    }
    Set-AuraPromptShelfSecureAcl -Path $Path
    $verified = @(Read-AuraPromptShelfEncryptedItems -Path $Path)
    if (-not (Test-AuraPromptShelfItemsEqual -Expected $normalized -Actual $verified)) {
      throw 'Prompt Shelf replacement did not verify.'
    }
    $committed = $true
  } catch {
    $failure = $_
    if ($published) {
      try {
        if ($hadExisting) {
          if (-not (Test-Path -LiteralPath $backup -PathType Leaf)) {
            throw 'Prompt Shelf rollback backup is unavailable.'
          }
          [IO.File]::Replace($backup, $Path, $rollback)
          Assert-AuraPromptShelfNotReparsePoint -Path $Path
          Set-AuraPromptShelfSecureAcl -Path $Path
          $restoredEnvelope = [IO.File]::ReadAllBytes($Path)
          if (-not (Test-Path -LiteralPath $Path -PathType Leaf) -or
              -not [Linq.Enumerable]::SequenceEqual(
                [byte[]]$priorEnvelope, [byte[]]$restoredEnvelope)) {
            throw 'Prompt Shelf rollback did not restore the previous state.'
          }
        } else {
          [IO.File]::Move($Path, $rollback)
          if (Test-Path -LiteralPath $Path) {
            throw 'Prompt Shelf rollback did not restore the empty state.'
          }
        }
        $rollbackCompleted = $true
      } catch {
        Write-AuraPromptShelfEvent -Code 'state-write-rollback-failed'
      }
    }
    if ($isDefaultPath -and (-not $published -or -not $rollbackCompleted)) {
      $script:PromptShelfPersistenceAvailable = $false
    }
    if ($published -and -not $rollbackCompleted) {
      throw 'Prompt Shelf state write failed and rollback could not be verified.'
    }
    throw $failure
  } finally {
    [Array]::Clear($plain, 0, $plain.Length)
    if ($null -ne $cipher) { [Array]::Clear($cipher, 0, $cipher.Length) }
    if ($null -ne $priorEnvelope) {
      [Array]::Clear($priorEnvelope, 0, $priorEnvelope.Length)
    }
    if ($null -ne $restoredEnvelope) {
      [Array]::Clear($restoredEnvelope, 0, $restoredEnvelope.Length)
    }
    if ($temporary -and (Test-Path -LiteralPath $temporary -PathType Leaf)) {
      try { Remove-Item -LiteralPath $temporary -Force } catch {}
    }
    if ($committed -or $rollbackCompleted) {
      if ($backup -and (Test-Path -LiteralPath $backup -PathType Leaf)) {
        try { Remove-Item -LiteralPath $backup -Force } catch {}
      }
      if ($rollback -and (Test-Path -LiteralPath $rollback -PathType Leaf)) {
        try { Remove-Item -LiteralPath $rollback -Force } catch {}
      }
    }
  }
}

function Set-AuraPromptShelfStatus {
  param([AllowEmptyString()][string]$Text)
  $script:PromptShelfStatusCopyName = $null
  $script:PromptShelfStatusFallback = ''
  if ($null -ne $script:PromptShelfStatusLabel -and -not $script:PromptShelfStatusLabel.IsDisposed) {
    $script:PromptShelfStatusLabel.Text = $Text
    if ($script:PromptShelfStatusLabel.IsHandleCreated) {
      try { $script:PromptShelfStatusLabel.AccessibilityObject.RaiseLiveRegionChanged() } catch {}
    }
  }
}

function Set-AuraPromptShelfStatusCopy {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Fallback
  )
  $script:PromptShelfStatusCopyName = $Name
  $script:PromptShelfStatusFallback = $Fallback
  if ($null -ne $script:PromptShelfStatusLabel -and -not $script:PromptShelfStatusLabel.IsDisposed) {
    $script:PromptShelfStatusLabel.Text = Get-AuraPromptShelfCopy -Name $Name -Fallback $Fallback
    if ($script:PromptShelfStatusLabel.IsHandleCreated) {
      try { $script:PromptShelfStatusLabel.AccessibilityObject.RaiseLiveRegionChanged() } catch {}
    }
  }
}

function Update-AuraPromptShelfStatusCopy {
  if ($null -eq $script:PromptShelfStatusLabel -or $script:PromptShelfStatusLabel.IsDisposed) { return }
  if ($script:PromptShelfStatusCopyName) {
    $script:PromptShelfStatusLabel.Text = Get-AuraPromptShelfCopy `
      -Name $script:PromptShelfStatusCopyName `
      -Fallback $script:PromptShelfStatusFallback
  } else {
    $script:PromptShelfStatusLabel.Text = ''
  }
}

function Initialize-AuraPromptShelfPersistence {
  if ($script:PromptShelfItemsLoaded) { return }
  try {
    $script:PromptShelfItems = @(Read-AuraPromptShelfItems)
    $script:PromptShelfPersistenceAvailable = $true
  } catch {
    $script:PromptShelfItems = @()
    $script:PromptShelfPersistenceAvailable = $false
    Set-AuraPromptShelfStatusCopy `
      -Name 'promptShelfStorageUnavailable' `
      -Fallback (
        "Saved drafts are unavailable because Aura couldn't secure local storage. Insert without saving still works.")
  }
  $script:PromptShelfItemsLoaded = $true
}

function Test-AuraPromptShelfStudioUuid {
  param([AllowEmptyString()][string]$Value)
  return $Value -cmatch (
    '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$')
}

function New-AuraPromptShelfStudioSession {
  if ((Test-AuraPromptShelfStudioUuid -Value $script:PromptShelfStudioSession) -and
      $null -ne $script:PromptShelfInsertOperation -and
      [string]$script:PromptShelfInsertOperation.StudioSession -ceq
        $script:PromptShelfStudioSession -and
      [string]$script:PromptShelfInsertOperation.State -cin @('dispatching', 'delayed')) {
    Set-AuraPromptShelfOperationUncertain -EventCode 'studio-session-changed'
  }
  $script:PromptShelfStudioSession = [Guid]::NewGuid().ToString('D').ToLowerInvariant()
  $script:PromptShelfStudioCommandEpoch = [long]0
  $script:PromptShelfStudioReceipts = @{}
  $script:PromptShelfStudioReceiptOrder = [Collections.Generic.Queue[string]]::new()
  return $script:PromptShelfStudioSession
}

function Get-AuraPromptShelfStudioAction {
  param([Parameter(Mandatory = $true)][string]$Type)
  switch -CaseSensitive ($Type) {
    'prompt-shelf-create' { return 'create' }
    'prompt-shelf-update' { return 'update' }
    'prompt-shelf-move' { return 'move' }
    'prompt-shelf-delete' { return 'delete' }
    'prompt-shelf-insert' { return 'insert' }
    'prompt-shelf-confirm-checked' { return 'confirm' }
  }
  return ''
}

function Get-AuraPromptShelfSha256 {
  param([Parameter(Mandatory = $true)][string]$Value)
  $algorithm = [Security.Cryptography.SHA256]::Create()
  try {
    $bytes = $algorithm.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value))
    return (($bytes | ForEach-Object { $_.ToString('x2') }) -join '')
  } finally {
    $algorithm.Dispose()
  }
}

function Get-AuraPromptShelfStudioRequestFingerprint {
  param([Parameter(Mandatory = $true)][object]$Message)
  $canonical = [ordered]@{
    type = [string]$Message.type
    requestId = [string]$Message.requestId
    session = [string]$Message.session
  }
  foreach ($name in @(
      'version', 'revision', 'commandEpoch', 'id', 'direction',
      'queueCommandId', 'draftFingerprint')) {
    $property = $Message.PSObject.Properties[$name]
    if ($null -ne $property) { $canonical[$name] = $property.Value }
  }
  $textProperty = $Message.PSObject.Properties['text']
  if ($null -ne $textProperty) {
    # Receipts keep only this digest, never the prompt body.
    $canonical['textDigest'] = Get-AuraPromptShelfSha256 -Value ([string]$textProperty.Value)
  }
  return Get-AuraPromptShelfSha256 -Value (
    $canonical | ConvertTo-Json -Compress -Depth 3)
}

function Advance-AuraPromptShelfStudioCommandEpoch {
  if ($script:PromptShelfStudioCommandEpoch -eq [long]::MaxValue) {
    throw 'Prompt Shelf Studio command epoch is exhausted.'
  }
  $script:PromptShelfStudioCommandEpoch += 1
  Send-AuraPromptShelfStudioChanged
}

function Send-AuraPromptShelfStudioMessage {
  param([Parameter(Mandatory = $true)][Collections.IDictionary]$Message)
  # A page can post its first Shelf read just before NavigationCompleted.
  # The originating document is already able to receive a reply at that point,
  # so do not strand that request behind StudioReady.
  if ($null -eq $script:StudioWebView -or $null -eq $script:StudioWebView.CoreWebView2) {
    return $false
  }
  try {
    $json = $Message | ConvertTo-Json -Depth 6 -Compress
    $script:StudioWebView.CoreWebView2.PostWebMessageAsJson($json)
    return $true
  } catch {
    Write-AuraPromptShelfEvent -Code 'studio-message-send-failed'
    return $false
  }
}

function Get-AuraPromptShelfInsertState {
  if ($null -eq $script:PromptShelfInsertOperation) { return 'idle' }
  if ([string]$script:PromptShelfInsertOperation.State -ceq 'uncertain') { return 'uncertain' }
  return 'busy'
}

function Test-AuraPromptShelfInsertionAvailable {
  if (-not (Get-AuraUiEnabled) -or -not $script:WebReady -or
      $null -eq $script:WebView -or $null -eq $script:WebView.CoreWebView2 -or
      $null -ne $script:PromptShelfInsertOperation) {
    return $false
  }
  return [bool](Get-AuraPromptShelfRouteKey -Value $script:WebView.Source)
}

function Send-AuraPromptShelfStudioState {
  param(
    [Parameter(Mandatory = $true)]
    [ValidateScript({ Test-AuraPromptShelfStudioUuid -Value $_ })][string]$RequestId
  )
  Initialize-AuraPromptShelfPersistence
  if (-not (Test-AuraPromptShelfStudioUuid -Value $script:PromptShelfStudioSession)) {
    [void](New-AuraPromptShelfStudioSession)
  }
  $insertionAvailable = [bool](Test-AuraPromptShelfInsertionAvailable)
  $localTargetId = if ($insertionAvailable) {
    Get-AuraPromptShelfCurrentTargetId
  } else { $null }
  $fingerprintKey = if ($script:PromptShelfItems.Count -gt 0) {
    [byte[]](Get-AuraPromptShelfTargetKey)
  } else { $null }
  $snapshot = [ordered]@{
    type = 'prompt-shelf-state'
    version = 1
    requestId = $RequestId
    session = $script:PromptShelfStudioSession
    revision = [long]$script:PromptShelfStudioRevision
    commandEpoch = [long]$script:PromptShelfStudioCommandEpoch
    persistenceAvailable = [bool]$script:PromptShelfPersistenceAvailable
    insertionAvailable = $insertionAvailable
    localTargetId = $localTargetId
    insertState = Get-AuraPromptShelfInsertState
    items = @(
      foreach ($item in $script:PromptShelfItems) {
        [ordered]@{
          id = [string]$item.id
          text = [string]$item.text
          fingerprint = if ($null -ne $fingerprintKey -and $fingerprintKey.Length -eq 32) {
            ConvertTo-AuraPromptShelfDraftFingerprint `
              -Id ([string]$item.id) -Text ([string]$item.text) -Key $fingerprintKey
          } else { $null }
        }
      }
    )
  }
  [void](Send-AuraPromptShelfStudioMessage -Message $snapshot)
}

function Send-AuraPromptShelfStudioChanged {
  if (-not (Test-AuraPromptShelfStudioUuid -Value $script:PromptShelfStudioSession)) { return }
  $message = [ordered]@{
    type = 'prompt-shelf-changed'
    version = 1
    session = $script:PromptShelfStudioSession
    revision = [long]$script:PromptShelfStudioRevision
    commandEpoch = [long]$script:PromptShelfStudioCommandEpoch
  }
  [void](Send-AuraPromptShelfStudioMessage -Message $message)
}

function Add-AuraPromptShelfStudioReceipt {
  param(
    [Parameter(Mandatory = $true)][string]$RequestId,
    [Parameter(Mandatory = $true)][string]$Type,
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-f0-9]{64}$')][string]$Fingerprint,
    [Parameter(Mandatory = $true)][Collections.IDictionary]$Message
  )
  if ($script:PromptShelfStudioReceipts.ContainsKey($RequestId)) { return }
  $script:PromptShelfStudioReceipts[$RequestId] = [PSCustomObject][ordered]@{
    Type = $Type
    Fingerprint = $Fingerprint
    Message = $Message
  }
  $script:PromptShelfStudioReceiptOrder.Enqueue($RequestId)
  while ($script:PromptShelfStudioReceiptOrder.Count -gt $script:PromptShelfStudioReceiptLimit) {
    $expired = $script:PromptShelfStudioReceiptOrder.Dequeue()
    [void]$script:PromptShelfStudioReceipts.Remove($expired)
  }
}

function Send-AuraPromptShelfStudioResult {
  param(
    [Parameter(Mandatory = $true)][string]$RequestId,
    [Parameter(Mandatory = $true)]
    [ValidateSet('create', 'update', 'move', 'delete', 'insert', 'confirm')][string]$Action,
    [Parameter(Mandatory = $true)][bool]$Ok,
    [Parameter(Mandatory = $true)]
    [ValidateSet(
      'ok', 'stale', 'request-conflict', 'not-found', 'invalid-text', 'capacity',
      'storage-unavailable', 'write-failed', 'runtime-unavailable', 'busy',
      'inserted', 'not-inserted', 'delayed', 'uncertain')][string]$Code,
    [AllowEmptyString()][string]$ItemId = '',
    [AllowEmptyString()][string]$RequestType = '',
    [AllowEmptyString()]
    [ValidatePattern('^$|^[a-f0-9]{64}$')][string]$RequestFingerprint = '',
    [switch]$Cache
  )
  $message = [ordered]@{
    type = 'prompt-shelf-result'
    version = 1
    requestId = $RequestId
    session = $script:PromptShelfStudioSession
    action = $Action
    ok = $Ok
    code = $Code
    revision = [long]$script:PromptShelfStudioRevision
    commandEpoch = [long]$script:PromptShelfStudioCommandEpoch
    itemId = $ItemId
  }
  if ($Cache) {
    if (-not $RequestType -or -not $RequestFingerprint) {
      throw 'Prompt Shelf receipt identity is incomplete.'
    }
    Add-AuraPromptShelfStudioReceipt `
      -RequestId $RequestId -Type $RequestType `
      -Fingerprint $RequestFingerprint -Message $message
  }
  [void](Send-AuraPromptShelfStudioMessage -Message $message)
}

function Assert-AuraPromptShelfStudioRequest {
  param([Parameter(Mandatory = $true)][object]$Message)
  if (($Message.version -isnot [int] -and $Message.version -isnot [long]) -or
      [long]$Message.version -ne 1) {
    throw 'Prompt Shelf bridge version is unsupported.'
  }
  if (-not (Test-AuraPromptShelfStudioUuid -Value ([string]$Message.requestId))) {
    throw 'Prompt Shelf request id is invalid.'
  }
  $type = [string]$Message.type
  if ($type -ceq 'prompt-shelf-read') { return }
  if (-not (Test-AuraPromptShelfStudioUuid -Value ([string]$Message.session))) {
    throw 'Prompt Shelf session is invalid.'
  }
  if (($Message.commandEpoch -isnot [int] -and $Message.commandEpoch -isnot [long]) -or
      [long]$Message.commandEpoch -lt 0) {
    throw 'Prompt Shelf command epoch is invalid.'
  }
  if (($Message.revision -isnot [int] -and $Message.revision -isnot [long]) -or
      [long]$Message.revision -lt 0) {
    throw 'Prompt Shelf revision is invalid.'
  }
  if ($type -in @(
      'prompt-shelf-update', 'prompt-shelf-move',
      'prompt-shelf-delete', 'prompt-shelf-insert')) {
    if ($Message.id -isnot [string] -or $Message.id -cnotmatch '^[a-f0-9]{32}$') {
      throw 'Prompt Shelf item id is invalid.'
    }
  }
  if ($type -ceq 'prompt-shelf-insert' -and
      ($Message.queueCommandId -isnot [string] -or
        -not (Test-AuraPromptShelfStudioUuid -Value $Message.queueCommandId) -or
        $Message.draftFingerprint -isnot [string] -or
        $Message.draftFingerprint -cnotmatch '^[a-f0-9]{64}$')) {
    throw 'Prompt Shelf queue placement identity is invalid.'
  }
  if ($type -in @('prompt-shelf-create', 'prompt-shelf-update')) {
    if ($Message.text -isnot [string] -or $Message.text.Length -gt $script:PromptShelfMaxTextLength) {
      throw 'Prompt Shelf text is invalid.'
    }
  }
  if ($type -ceq 'prompt-shelf-move' -and
      ($Message.direction -isnot [string] -or $Message.direction -cnotin @('up', 'down'))) {
    throw 'Prompt Shelf move direction is invalid.'
  }
}

function Get-AuraPromptShelfIndexById {
  param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-f0-9]{32}$')][string]$Id
  )
  for ($index = 0; $index -lt $script:PromptShelfItems.Count; $index += 1) {
    if ([string]$script:PromptShelfItems[$index].id -ceq $Id) { return $index }
  }
  return -1
}

function Get-AuraPromptShelfSelectedIndex {
  if ($null -eq $script:PromptShelfList -or $script:PromptShelfList.IsDisposed) { return -1 }
  $index = [int]$script:PromptShelfList.SelectedIndex
  if ($index -lt 0 -or $index -ge $script:PromptShelfItems.Count) { return -1 }
  return $index
}

function Get-AuraPromptShelfDisplayText {
  param(
    [Parameter(Mandatory = $true)][string]$Text,
    [Parameter(Mandatory = $true)][int]$Index
  )
  $firstLine = ($Text -split '\r?\n', 2)[0].Trim()
  if (-not $firstLine) { $firstLine = $Text.Trim() }
  if ($firstLine.Length -gt 86) { $firstLine = $firstLine.Substring(0, 83) + '...' }
  return '{0}. {1}' -f ($Index + 1), $firstLine
}

function Update-AuraPromptShelfActions {
  $selected = Get-AuraPromptShelfSelectedIndex
  $pending = $null -ne $script:PromptShelfInsertOperation
  $draftHandoff = (Get-Command Test-AuraDraftHandoffTransientActive -ErrorAction SilentlyContinue) -and
    (Test-AuraDraftHandoffTransientActive)
  $uncertain = $pending -and
    [string]$script:PromptShelfInsertOperation.State -ceq 'uncertain'
  $draftValid = $null -ne $script:PromptShelfDraftBox -and
    (Test-AuraPromptShelfText -Text $script:PromptShelfDraftBox.Text)
  $editing = -not [string]::IsNullOrWhiteSpace($script:PromptShelfEditingId)

  if ($null -ne $script:PromptShelfAddButton) {
    $hasCapacity = $editing -or $script:PromptShelfItems.Count -lt $script:PromptShelfMaxItems
    $script:PromptShelfAddButton.Enabled = $script:PromptShelfPersistenceAvailable -and
      $draftValid -and $hasCapacity -and -not $draftHandoff
  }
  if ($null -ne $script:PromptShelfCancelButton) {
    $script:PromptShelfCancelButton.Visible = $editing -or $draftHandoff
    $script:PromptShelfCancelButton.Enabled = $editing -or $draftHandoff
  }
  if ($null -ne $script:PromptShelfInsertNowButton) {
    $script:PromptShelfInsertNowButton.Enabled = $draftValid -and -not $pending
  }
  if ($null -ne $script:PromptShelfEditButton) {
    $script:PromptShelfEditButton.Enabled = $script:PromptShelfPersistenceAvailable -and
      $selected -ge 0 -and -not $draftHandoff
  }
  if ($null -ne $script:PromptShelfMoveUpButton) {
    $script:PromptShelfMoveUpButton.Enabled = $script:PromptShelfPersistenceAvailable -and
      $selected -gt 0 -and -not $draftHandoff
  }
  if ($null -ne $script:PromptShelfMoveDownButton) {
    $script:PromptShelfMoveDownButton.Enabled = $script:PromptShelfPersistenceAvailable -and
      $selected -ge 0 -and $selected -lt ($script:PromptShelfItems.Count - 1) -and
      -not $draftHandoff
  }
  if ($null -ne $script:PromptShelfDeleteButton) {
    $script:PromptShelfDeleteButton.Enabled = $script:PromptShelfPersistenceAvailable -and
      $selected -ge 0 -and -not $draftHandoff
  }
  if ($null -ne $script:PromptShelfInsertButton) {
    $script:PromptShelfInsertButton.Enabled = $selected -ge 0 -and -not $pending -and
      -not $draftHandoff
  }
  if ($null -ne $script:PromptShelfResolveButton) {
    $script:PromptShelfResolveButton.Visible = $uncertain
    $script:PromptShelfResolveButton.Enabled = $uncertain
  }
  Update-AuraPromptShelfCharacterCount
  if ($null -ne $script:PromptShelfProfile) {
    Update-AuraPromptShelfButtonThemes -Profile $script:PromptShelfProfile
  }
}

function Update-AuraPromptShelfList {
  param([AllowEmptyString()][string]$SelectId)
  if ($null -eq $script:PromptShelfList -or $script:PromptShelfList.IsDisposed) { return }
  if (-not $SelectId) {
    $selectedIndex = Get-AuraPromptShelfSelectedIndex
    if ($selectedIndex -ge 0) { $SelectId = [string]$script:PromptShelfItems[$selectedIndex].id }
  }
  $script:PromptShelfList.BeginUpdate()
  try {
    $script:PromptShelfList.Items.Clear()
    $nextIndex = -1
    for ($index = 0; $index -lt $script:PromptShelfItems.Count; $index += 1) {
      $item = $script:PromptShelfItems[$index]
      [void]$script:PromptShelfList.Items.Add(
        (Get-AuraPromptShelfDisplayText -Text ([string]$item.text) -Index $index))
      if ($SelectId -and [string]$item.id -ceq $SelectId) { $nextIndex = $index }
    }
    $script:PromptShelfList.SelectedIndex = $nextIndex
  } finally {
    $script:PromptShelfList.EndUpdate()
  }
  if ($null -ne $script:PromptShelfEmptyPanel) {
    $script:PromptShelfEmptyPanel.Visible = $script:PromptShelfItems.Count -eq 0
    if ($script:PromptShelfEmptyPanel.Visible) { $script:PromptShelfEmptyPanel.BringToFront() }
  }
  if ($null -ne $script:PromptShelfSavedLabel) {
    $count = [int]$script:PromptShelfItems.Count
    $script:PromptShelfSavedCountLabel.Text = $count.ToString(
      'N0', [Globalization.CultureInfo]::CurrentCulture)
    $format = Get-AuraPromptShelfCopy -Name 'promptShelfSavedCount' -Fallback '{0} saved drafts'
    try {
      $script:PromptShelfSavedCountLabel.AccessibleName = $format -f $count
    } catch {
      $script:PromptShelfSavedCountLabel.AccessibleName = $script:PromptShelfSavedCountLabel.Text
    }
  }
  if ($null -ne $script:PromptShelfList) { $script:PromptShelfList.Invalidate() }
  Update-AuraPromptShelfActions
}

function Save-AuraPromptShelfCandidate {
  param(
    [Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$Items,
    [AllowEmptyString()][string]$SelectId
  )
  if (-not $script:PromptShelfPersistenceAvailable) {
    throw 'Prompt Shelf persistence is unavailable.'
  }
  Write-AuraPromptShelfItems -Items $Items
  $script:PromptShelfItems = @(ConvertTo-AuraPromptShelfPersistedItems -Items $Items)
  if ($script:PromptShelfStudioRevision -eq [long]::MaxValue) {
    $script:PromptShelfStudioRevision = [long]1
  } else {
    $script:PromptShelfStudioRevision += 1
  }
  Update-AuraPromptShelfList -SelectId $SelectId
  Send-AuraPromptShelfStudioChanged
}

function Reset-AuraPromptShelfEditor {
  if ((Get-Command Test-AuraDraftHandoffTransientActive -ErrorAction SilentlyContinue) -and
      (Test-AuraDraftHandoffTransientActive)) {
    Cancel-AuraDraftHandoffTransient -Reason 'user-cancelled'
    return
  }
  $script:PromptShelfEditingId = $null
  if ($null -ne $script:PromptShelfDraftBox) { $script:PromptShelfDraftBox.Clear() }
  Update-AuraPromptShelfCopy
  Update-AuraPromptShelfActions
}

function Invoke-AuraPromptShelfAddOrSave {
  if ((Get-Command Test-AuraDraftHandoffTransientActive -ErrorAction SilentlyContinue) -and
      (Test-AuraDraftHandoffTransientActive)) {
    return
  }
  $text = if ($null -ne $script:PromptShelfDraftBox) { [string]$script:PromptShelfDraftBox.Text } else { '' }
  if ([string]::IsNullOrWhiteSpace($text)) {
    Set-AuraPromptShelfStatus -Text (
      Get-AuraPromptShelfCopy -Name 'promptShelfBlank' -Fallback 'Write a prompt first.')
    return
  }
  if ($text.Length -gt $script:PromptShelfMaxTextLength -or -not (Test-AuraPromptShelfText -Text $text)) {
    Set-AuraPromptShelfStatus -Text (
      Get-AuraPromptShelfCopy -Name 'promptShelfTooLong' -Fallback 'Keep each draft under 8,000 characters.')
    return
  }

  try {
    if ($script:PromptShelfEditingId) {
      $candidate = @()
      $found = $false
      foreach ($item in $script:PromptShelfItems) {
        if ([string]$item.id -ceq $script:PromptShelfEditingId) {
          $candidate += [PSCustomObject][ordered]@{ id = [string]$item.id; text = $text }
          $found = $true
        } else {
          $candidate += [PSCustomObject][ordered]@{ id = [string]$item.id; text = [string]$item.text }
        }
      }
      if (-not $found) { throw 'The edited Prompt Shelf item no longer exists.' }
      $selectedId = [string]$script:PromptShelfEditingId
      Save-AuraPromptShelfCandidate -Items $candidate -SelectId $selectedId
      Reset-AuraPromptShelfEditor
      Set-AuraPromptShelfStatus -Text (
        Get-AuraPromptShelfCopy -Name 'promptShelfSaved' -Fallback 'Draft changes saved.')
    } else {
      if ($script:PromptShelfItems.Count -ge $script:PromptShelfMaxItems) {
        Set-AuraPromptShelfStatus -Text (
          Get-AuraPromptShelfCopy -Name 'promptShelfFull' -Fallback 'The Shelf can hold up to 50 drafts.')
        return
      }
      $id = [Guid]::NewGuid().ToString('N')
      $candidate = @($script:PromptShelfItems) + @(
        [PSCustomObject][ordered]@{ id = $id; text = $text })
      Save-AuraPromptShelfCandidate -Items $candidate -SelectId $id
      Reset-AuraPromptShelfEditor
      Set-AuraPromptShelfStatus -Text (
        Get-AuraPromptShelfCopy -Name 'promptShelfAdded' -Fallback 'Draft added to the Shelf.')
    }
  } catch {
    Write-AuraPromptShelfEvent -Code 'state-write-failed'
    Set-AuraPromptShelfStatus -Text (
      Get-AuraPromptShelfCopy -Name 'promptShelfStorageFailed' -Fallback "Drafts couldn't be saved. Nothing changed.")
  }
}

function Invoke-AuraPromptShelfEdit {
  $index = Get-AuraPromptShelfSelectedIndex
  if ($index -lt 0) {
    Set-AuraPromptShelfStatus -Text (
      Get-AuraPromptShelfCopy -Name 'promptShelfSelectDraft' -Fallback 'Select a saved draft first.')
    return
  }
  $item = $script:PromptShelfItems[$index]
  $script:PromptShelfEditingId = [string]$item.id
  $script:PromptShelfDraftBox.Text = [string]$item.text
  $script:PromptShelfDraftBox.Select($script:PromptShelfDraftBox.TextLength, 0)
  [void]$script:PromptShelfDraftBox.Focus()
  Update-AuraPromptShelfCopy
  Update-AuraPromptShelfActions
}

function Invoke-AuraPromptShelfMove {
  param([ValidateSet(-1, 1)][int]$Delta)
  $index = Get-AuraPromptShelfSelectedIndex
  $target = $index + $Delta
  if ($index -lt 0 -or $target -lt 0 -or $target -ge $script:PromptShelfItems.Count) { return }
  try {
    $candidate = @($script:PromptShelfItems)
    $moving = $candidate[$index]
    $candidate[$index] = $candidate[$target]
    $candidate[$target] = $moving
    Save-AuraPromptShelfCandidate -Items $candidate -SelectId ([string]$moving.id)
  } catch {
    Write-AuraPromptShelfEvent -Code 'state-reorder-failed'
    Set-AuraPromptShelfStatus -Text (
      Get-AuraPromptShelfCopy -Name 'promptShelfStorageFailed' -Fallback "Drafts couldn't be saved. Nothing changed.")
  }
}

function Remove-AuraPromptShelfItemById {
  param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-f0-9]{32}$')][string]$Id
  )
  $candidate = @()
  $removedIndex = -1
  for ($index = 0; $index -lt $script:PromptShelfItems.Count; $index += 1) {
    $item = $script:PromptShelfItems[$index]
    if ([string]$item.id -ceq $Id) {
      if ($removedIndex -ge 0) { throw 'Prompt Shelf contains a duplicate draft id.' }
      $removedIndex = $index
      continue
    }
    $candidate += [PSCustomObject][ordered]@{
      id = [string]$item.id
      text = [string]$item.text
    }
  }
  if ($removedIndex -lt 0 -or $candidate.Count -ne ($script:PromptShelfItems.Count - 1)) {
    throw 'The selected Prompt Shelf item no longer exists.'
  }
  $selectId = if ($candidate.Count -gt 0) {
    [string]$candidate[[Math]::Min($removedIndex, $candidate.Count - 1)].id
  } else { '' }
  Save-AuraPromptShelfCandidate -Items $candidate -SelectId $selectId
  if ($script:PromptShelfEditingId -ceq $Id) { Reset-AuraPromptShelfEditor }
}

function Invoke-AuraPromptShelfDelete {
  $index = Get-AuraPromptShelfSelectedIndex
  if ($index -lt 0) {
    Set-AuraPromptShelfStatus -Text (
      Get-AuraPromptShelfCopy -Name 'promptShelfSelectDraft' -Fallback 'Select a saved draft first.')
    return
  }
  $deletedId = [string]$script:PromptShelfItems[$index].id
  $result = [Windows.Forms.MessageBox]::Show(
    $script:PromptShelfForm,
    (Get-AuraPromptShelfCopy -Name 'promptShelfDeleteMessage' -Fallback (
      "This removes the draft from this device and can't be undone. Text already inserted into Claude won't change.")),
    (Get-AuraPromptShelfCopy -Name 'promptShelfDeleteTitle' -Fallback 'Delete this draft?'),
    [Windows.Forms.MessageBoxButtons]::YesNo,
    [Windows.Forms.MessageBoxIcon]::Warning,
    [Windows.Forms.MessageBoxDefaultButton]::Button2)
  if ($result -ne [Windows.Forms.DialogResult]::Yes) { return }

  try {
    Remove-AuraPromptShelfItemById -Id $deletedId
    Set-AuraPromptShelfStatus -Text (
      Get-AuraPromptShelfCopy -Name 'promptShelfDeleted' -Fallback 'Draft deleted from this device.')
  } catch {
    Write-AuraPromptShelfEvent -Code 'state-delete-failed'
    Set-AuraPromptShelfStatus -Text (
      Get-AuraPromptShelfCopy -Name 'promptShelfStorageFailed' -Fallback "Drafts couldn't be saved. Nothing changed.")
  }
}

function Invoke-AuraPromptShelfStudioRequest {
  param([Parameter(Mandatory = $true)][object]$Message)
  Initialize-AuraPromptShelfPersistence
  $type = [string]$Message.type
  $requestId = [string]$Message.requestId
  if ($type -ceq 'prompt-shelf-read') {
    Send-AuraPromptShelfStudioState -RequestId $requestId
    return
  }

  $action = Get-AuraPromptShelfStudioAction -Type $type
  if (-not $action) { throw 'Prompt Shelf Studio action is invalid.' }
  $requestFingerprint = Get-AuraPromptShelfStudioRequestFingerprint -Message $Message
  if ($script:PromptShelfStudioReceipts.ContainsKey($requestId)) {
    $cached = $script:PromptShelfStudioReceipts[$requestId]
    if ([string]$cached.Type -ceq $type -and
        [string]$cached.Fingerprint -ceq $requestFingerprint) {
      [void](Send-AuraPromptShelfStudioMessage -Message $cached.Message)
    } else {
      Send-AuraPromptShelfStudioResult `
        -RequestId $requestId -Action $action -Ok $false -Code 'request-conflict'
    }
    return
  }

  if ($null -ne $script:PromptShelfInsertOperation -and
      [string]$script:PromptShelfInsertOperation.StudioRequestId -ceq $requestId) {
    if ($type -cne 'prompt-shelf-insert' -or
        [string]$script:PromptShelfInsertOperation.StudioRequestFingerprint -cne
          $requestFingerprint) {
      Send-AuraPromptShelfStudioResult `
        -RequestId $requestId -Action $action -Ok $false -Code 'request-conflict'
    } elseif ([string]$script:PromptShelfInsertOperation.State -ceq 'delayed') {
      Send-AuraPromptShelfStudioResult `
        -RequestId $requestId -Action 'insert' -Ok $false -Code 'delayed'
    }
    return
  }

  if ([string]$Message.session -cne $script:PromptShelfStudioSession) {
    Send-AuraPromptShelfStudioResult `
      -RequestId $requestId -Action $action -Ok $false -Code 'stale'
    return
  }

  if ([long]$Message.revision -ne [long]$script:PromptShelfStudioRevision -or
      [long]$Message.commandEpoch -ne [long]$script:PromptShelfStudioCommandEpoch) {
    Send-AuraPromptShelfStudioResult `
      -RequestId $requestId -Action $action -Ok $false -Code 'stale' `
      -RequestType $type -RequestFingerprint $requestFingerprint -Cache
    return
  }

  Advance-AuraPromptShelfStudioCommandEpoch

  if ($type -ceq 'prompt-shelf-confirm-checked') {
    Confirm-AuraPromptShelfComposerChecked
    Send-AuraPromptShelfStudioResult `
      -RequestId $requestId -Action 'confirm' -Ok $true -Code 'ok' `
      -RequestType $type -RequestFingerprint $requestFingerprint -Cache
    Send-AuraPromptShelfStudioChanged
    return
  }

  if ($type -cne 'prompt-shelf-insert' -and
      -not $script:PromptShelfPersistenceAvailable) {
    Send-AuraPromptShelfStudioResult `
      -RequestId $requestId -Action $action -Ok $false -Code 'storage-unavailable' `
      -RequestType $type -RequestFingerprint $requestFingerprint -Cache
    return
  }

  $itemId = ''
  try {
    switch -CaseSensitive ($type) {
      'prompt-shelf-create' {
        $text = [string]$Message.text
        if (-not (Test-AuraPromptShelfText -Text $text)) {
          Send-AuraPromptShelfStudioResult `
            -RequestId $requestId -Action $action -Ok $false -Code 'invalid-text' `
            -RequestType $type -RequestFingerprint $requestFingerprint -Cache
          return
        }
        if ($script:PromptShelfItems.Count -ge $script:PromptShelfMaxItems) {
          Send-AuraPromptShelfStudioResult `
            -RequestId $requestId -Action $action -Ok $false -Code 'capacity' `
            -RequestType $type -RequestFingerprint $requestFingerprint -Cache
          return
        }
        $itemId = [Guid]::NewGuid().ToString('N')
        $candidate = @($script:PromptShelfItems) + @(
          [PSCustomObject][ordered]@{ id = $itemId; text = $text })
        Save-AuraPromptShelfCandidate -Items $candidate -SelectId $itemId
        break
      }
      'prompt-shelf-update' {
        $itemId = [string]$Message.id
        $text = [string]$Message.text
        if (-not (Test-AuraPromptShelfText -Text $text)) {
          Send-AuraPromptShelfStudioResult `
            -RequestId $requestId -Action $action -Ok $false -Code 'invalid-text' `
            -ItemId $itemId -RequestType $type `
            -RequestFingerprint $requestFingerprint -Cache
          return
        }
        $itemIndex = Get-AuraPromptShelfIndexById -Id $itemId
        if ($itemIndex -lt 0) {
          Send-AuraPromptShelfStudioResult `
            -RequestId $requestId -Action $action -Ok $false -Code 'not-found' `
            -ItemId $itemId -RequestType $type `
            -RequestFingerprint $requestFingerprint -Cache
          return
        }
        $candidate = @()
        foreach ($item in $script:PromptShelfItems) {
          $candidate += if ([string]$item.id -ceq $itemId) {
            [PSCustomObject][ordered]@{ id = $itemId; text = $text }
          } else {
            [PSCustomObject][ordered]@{
              id = [string]$item.id
              text = [string]$item.text
            }
          }
        }
        Save-AuraPromptShelfCandidate -Items $candidate -SelectId $itemId
        break
      }
      'prompt-shelf-move' {
        $itemId = [string]$Message.id
        $itemIndex = Get-AuraPromptShelfIndexById -Id $itemId
        if ($itemIndex -lt 0) {
          Send-AuraPromptShelfStudioResult `
            -RequestId $requestId -Action $action -Ok $false -Code 'not-found' `
            -ItemId $itemId -RequestType $type `
            -RequestFingerprint $requestFingerprint -Cache
          return
        }
        $delta = if ([string]$Message.direction -ceq 'up') { -1 } else { 1 }
        $targetIndex = $itemIndex + $delta
        if ($targetIndex -ge 0 -and $targetIndex -lt $script:PromptShelfItems.Count) {
          $candidate = @($script:PromptShelfItems)
          $moving = $candidate[$itemIndex]
          $candidate[$itemIndex] = $candidate[$targetIndex]
          $candidate[$targetIndex] = $moving
          Save-AuraPromptShelfCandidate -Items $candidate -SelectId $itemId
        }
        break
      }
      'prompt-shelf-delete' {
        $itemId = [string]$Message.id
        if ((Get-AuraPromptShelfIndexById -Id $itemId) -lt 0) {
          Send-AuraPromptShelfStudioResult `
            -RequestId $requestId -Action $action -Ok $false -Code 'not-found' `
            -ItemId $itemId -RequestType $type `
            -RequestFingerprint $requestFingerprint -Cache
          return
        }
        Remove-AuraPromptShelfItemById -Id $itemId
        break
      }
      'prompt-shelf-insert' {
        $itemId = [string]$Message.id
        $itemIndex = Get-AuraPromptShelfIndexById -Id $itemId
        if ($itemIndex -lt 0) {
          Send-AuraPromptShelfStudioResult `
            -RequestId $requestId -Action $action -Ok $false -Code 'not-found' `
            -ItemId $itemId -RequestType $type `
            -RequestFingerprint $requestFingerprint -Cache
          return
        }
        $draftFingerprint = ConvertTo-AuraPromptShelfDraftFingerprint `
          -Id $itemId -Text ([string]$script:PromptShelfItems[$itemIndex].text) `
          -Key ([byte[]](Get-AuraPromptShelfTargetKey))
        if ($draftFingerprint -cne [string]$Message.draftFingerprint -or
            -not (Get-Command Test-AuraTaskboardQueuePlacementReady -ErrorAction SilentlyContinue) -or
            -not (Test-AuraTaskboardQueuePlacementReady `
              -CommandId ([string]$Message.queueCommandId) -DraftId $itemId `
              -DraftFingerprint $draftFingerprint)) {
          Send-AuraPromptShelfStudioResult `
            -RequestId $requestId -Action $action -Ok $false -Code 'not-inserted' `
            -ItemId $itemId -RequestType $type `
            -RequestFingerprint $requestFingerprint -Cache
          return
        }
        if ($null -ne $script:PromptShelfInsertOperation) {
          Send-AuraPromptShelfStudioResult `
            -RequestId $requestId -Action $action -Ok $false -Code 'busy' `
            -ItemId $itemId -RequestType $type `
            -RequestFingerprint $requestFingerprint -Cache
          return
        }
        if (-not (Test-AuraPromptShelfInsertionAvailable)) {
          Send-AuraPromptShelfStudioResult `
            -RequestId $requestId -Action $action -Ok $false -Code 'runtime-unavailable' `
            -ItemId $itemId -RequestType $type `
            -RequestFingerprint $requestFingerprint -Cache
          return
        }
        Show-AuraUiMain
        Invoke-AuraPromptShelfInsert `
          -Text ([string]$script:PromptShelfItems[$itemIndex].text) `
          -StudioRequestId $requestId `
          -StudioSession ([string]$Message.session) `
          -StudioItemId $itemId `
          -StudioRequestFingerprint $requestFingerprint `
          -QueueCommandId ([string]$Message.queueCommandId) `
          -QueueDraftFingerprint $draftFingerprint
        if ($null -eq $script:PromptShelfInsertOperation -or
            [string]$script:PromptShelfInsertOperation.StudioRequestId -cne $requestId) {
          Send-AuraPromptShelfStudioResult `
            -RequestId $requestId -Action $action -Ok $false -Code 'not-inserted' `
            -ItemId $itemId -RequestType $type `
            -RequestFingerprint $requestFingerprint -Cache
        }
        return
      }
    }
  } catch {
    Write-AuraPromptShelfEvent -Code ('studio-{0}-failed' -f $action)
    Send-AuraPromptShelfStudioResult `
      -RequestId $requestId -Action $action -Ok $false -Code 'write-failed' `
      -ItemId $itemId -RequestType $type `
      -RequestFingerprint $requestFingerprint -Cache
    return
  }

  Send-AuraPromptShelfStudioResult `
    -RequestId $requestId -Action $action -Ok $true -Code 'ok' `
    -ItemId $itemId -RequestType $type `
    -RequestFingerprint $requestFingerprint -Cache
}

function Get-AuraPromptShelfRouteKey {
  param([AllowNull()][object]$Value)
  try {
    $uri = if ($Value -is [Uri]) { $Value } else { [Uri]([string]$Value) }
    if (-not (Test-AuraUiClaudeUri -Value $uri)) { return '' }
    return $uri.GetLeftPart([UriPartial]::Path) + $uri.Query
  } catch {
    return ''
  }
}

function Get-AuraPromptShelfTargetRouteKey {
  param([AllowNull()][object]$Value)
  try {
    $uri = if ($Value -is [Uri]) { $Value } else { [Uri]([string]$Value) }
    if (-not (Test-AuraUiClaudeUri -Value $uri)) { return '' }
    $path = $uri.AbsolutePath.TrimEnd('/')
    if ($path -cnotmatch '^/chat/[A-Za-z0-9_-]+$') { return '' }
    return $uri.GetLeftPart([UriPartial]::Authority) + $path
  } catch {
    return ''
  }
}

function Get-AuraPromptShelfCurrentTargetId {
  if ($null -eq $script:WebView) { return $null }
  $routeKey = Get-AuraPromptShelfTargetRouteKey -Value $script:WebView.Source
  if (-not $routeKey) { return $null }
  $key = [byte[]](Get-AuraPromptShelfTargetKey)
  if ($key.Length -ne 32) { return $null }
  return ConvertTo-AuraPromptShelfTargetId -RouteKey $routeKey -Key $key
}

function Stop-AuraPromptShelfInsertTimeouts {
  foreach ($timer in @(
      $script:PromptShelfInsertTimeout,
      $script:PromptShelfInsertUncertainTimeout
    )) {
    if ($null -ne $timer -and -not $timer.IsDisposed) {
      try { $timer.Stop() } catch {}
    }
  }
}

function Set-AuraPromptShelfOperationUncertain {
  param([Parameter(Mandatory = $true)][string]$EventCode)
  if ($null -eq $script:PromptShelfInsertOperation) { return }
  $operation = $script:PromptShelfInsertOperation
  Stop-AuraPromptShelfInsertTimeouts
  $operation.State = 'uncertain'
  $operation.Task = $null
  if ([string]$operation.DraftHandoffAttemptId -and
      (Get-Command Complete-AuraDraftHandoffInsert -ErrorAction SilentlyContinue)) {
    Complete-AuraDraftHandoffInsert `
      -AttemptId ([string]$operation.DraftHandoffAttemptId) -Outcome uncertain
  }
  if ([string]$operation.QueueCommandId -and
      (Get-Command Complete-AuraTaskboardQueuePlacement -ErrorAction SilentlyContinue)) {
    Complete-AuraTaskboardQueuePlacement `
      -QueueCommandId ([string]$operation.QueueCommandId) `
      -DraftFingerprint ([string]$operation.QueueDraftFingerprint) -Outcome uncertain
  }
  Write-AuraPromptShelfEvent -Code $EventCode
  Set-AuraPromptShelfStatusCopy `
    -Name 'promptShelfInsertUncertain' `
    -Fallback "Aura couldn't confirm the result. Check the composer before enabling Insert again."
  Update-AuraPromptShelfActions
  if ((Test-AuraPromptShelfStudioUuid -Value ([string]$operation.StudioRequestId)) -and
      [string]$operation.StudioSession -ceq $script:PromptShelfStudioSession) {
    Send-AuraPromptShelfStudioResult `
      -RequestId ([string]$operation.StudioRequestId) -Action 'insert' `
      -Ok $false -Code 'uncertain' -ItemId ([string]$operation.StudioItemId) `
      -RequestType 'prompt-shelf-insert' `
      -RequestFingerprint ([string]$operation.StudioRequestFingerprint) -Cache
  }
  Send-AuraPromptShelfStudioChanged
}

function Confirm-AuraPromptShelfComposerChecked {
  if ($null -eq $script:PromptShelfInsertOperation -or
      [string]$script:PromptShelfInsertOperation.State -cne 'uncertain') { return }
  $operation = $script:PromptShelfInsertOperation
  $script:PromptShelfInsertOperation = $null
  if ([string]$operation.QueueCommandId -and
      (Get-Command Refresh-AuraTaskboardQueue -ErrorAction SilentlyContinue)) {
    Refresh-AuraTaskboardQueue
  }
  Set-AuraPromptShelfStatusCopy `
    -Name 'promptShelfChecked' `
    -Fallback 'Composer checked. Insert is available again.'
  Update-AuraPromptShelfActions
  Send-AuraPromptShelfStudioChanged
}

function Advance-AuraPromptShelfPageEpoch {
  if ($script:PromptShelfPageEpoch -eq [long]::MaxValue) {
    $script:PromptShelfPageEpoch = [long]1
  } else {
    $script:PromptShelfPageEpoch += 1
  }
  if ($null -ne $script:PromptShelfInsertOperation -and
      [string]$script:PromptShelfInsertOperation.State -cin @('dispatching', 'delayed')) {
    Set-AuraPromptShelfOperationUncertain -EventCode 'insert-target-changed'
  }
  if (Get-Command Invalidate-AuraDraftHandoffTarget -ErrorAction SilentlyContinue) {
    Invalidate-AuraDraftHandoffTarget -Reason 'navigation-changed'
  }
}

function Ensure-AuraPromptShelfInsertTimeout {
  if ($null -eq $script:PromptShelfInsertTimeout -or $script:PromptShelfInsertTimeout.IsDisposed) {
    $script:PromptShelfInsertTimeout = [Windows.Forms.Timer]::new()
    $script:PromptShelfInsertTimeout.Interval = $script:PromptShelfInsertDelayMilliseconds
    $script:PromptShelfInsertTimeout.add_Tick({
      $script:PromptShelfInsertTimeout.Stop()
      if ($null -eq $script:PromptShelfInsertOperation -or
          [string]$script:PromptShelfInsertOperation.State -cne 'dispatching') { return }
      $script:PromptShelfInsertOperation.State = 'delayed'
      Write-AuraPromptShelfEvent -Code 'insert-delayed'
      Set-AuraPromptShelfStatusCopy `
        -Name 'promptShelfInsertDelayed' `
        -Fallback "Still waiting for Claude. Don't retry yet; the text may still be inserted."
      Update-AuraPromptShelfActions
      $operation = $script:PromptShelfInsertOperation
      if ((Test-AuraPromptShelfStudioUuid -Value ([string]$operation.StudioRequestId)) -and
          [string]$operation.StudioSession -ceq $script:PromptShelfStudioSession) {
        Send-AuraPromptShelfStudioResult `
          -RequestId ([string]$operation.StudioRequestId) -Action 'insert' `
          -Ok $false -Code 'delayed' -ItemId ([string]$operation.StudioItemId)
      }
      Send-AuraPromptShelfStudioChanged
      try {
        $script:PromptShelfInsertUncertainTimeout.Start()
      } catch {
        Set-AuraPromptShelfOperationUncertain `
          -EventCode 'insert-acknowledgement-timeout-unavailable'
      }
    })
  }
  if ($null -eq $script:PromptShelfInsertUncertainTimeout -or
      $script:PromptShelfInsertUncertainTimeout.IsDisposed) {
    $script:PromptShelfInsertUncertainTimeout = [Windows.Forms.Timer]::new()
    $script:PromptShelfInsertUncertainTimeout.Interval =
      $script:PromptShelfInsertUncertainMilliseconds
    $script:PromptShelfInsertUncertainTimeout.add_Tick({
      $script:PromptShelfInsertUncertainTimeout.Stop()
      if ($null -eq $script:PromptShelfInsertOperation -or
          [string]$script:PromptShelfInsertOperation.State -cne 'delayed') { return }
      Set-AuraPromptShelfOperationUncertain `
        -EventCode 'insert-acknowledgement-timeout'
    })
  }
}

function Complete-AuraPromptShelfInsert {
  param(
    [Parameter(Mandatory = $true)][string]$OperationId,
    [Parameter(Mandatory = $true)]
    [ValidateSet('inserted', 'not-inserted', 'uncertain')][string]$Outcome
  )
  if ($null -eq $script:PromptShelfInsertOperation -or
      [string]$script:PromptShelfInsertOperation.OperationId -cne $OperationId) { return }
  if ($Outcome -ceq 'uncertain') {
    Set-AuraPromptShelfOperationUncertain -EventCode 'insert-result-uncertain'
    return
  }
  $operation = $script:PromptShelfInsertOperation
  Stop-AuraPromptShelfInsertTimeouts
  $script:PromptShelfInsertOperation = $null
  if ([string]$operation.DraftHandoffAttemptId -and
      (Get-Command Complete-AuraDraftHandoffInsert -ErrorAction SilentlyContinue)) {
    Complete-AuraDraftHandoffInsert `
      -AttemptId ([string]$operation.DraftHandoffAttemptId) -Outcome $Outcome
  }
  if ([string]$operation.QueueCommandId -and
      (Get-Command Complete-AuraTaskboardQueuePlacement -ErrorAction SilentlyContinue)) {
    Complete-AuraTaskboardQueuePlacement `
      -QueueCommandId ([string]$operation.QueueCommandId) `
      -DraftFingerprint ([string]$operation.QueueDraftFingerprint) -Outcome $Outcome
  }
  if ($Outcome -ceq 'inserted') {
    Set-AuraPromptShelfStatusCopy `
      -Name 'promptShelfInserted' `
      -Fallback "Inserted at the Claude composer caret. Press Enter when you're ready."
  } else {
    Set-AuraPromptShelfStatusCopy `
      -Name 'promptShelfInsertFailed' `
      -Fallback 'Place the caret in the Claude composer, then try again.'
  }
  Update-AuraPromptShelfActions
  if ((Test-AuraPromptShelfStudioUuid -Value ([string]$operation.StudioRequestId)) -and
      [string]$operation.StudioSession -ceq $script:PromptShelfStudioSession) {
    $inserted = $Outcome -ceq 'inserted'
    Send-AuraPromptShelfStudioResult `
      -RequestId ([string]$operation.StudioRequestId) -Action 'insert' `
      -Ok $inserted -Code $(if ($inserted) { 'inserted' } else { 'not-inserted' }) `
      -ItemId ([string]$operation.StudioItemId) `
      -RequestType 'prompt-shelf-insert' `
      -RequestFingerprint ([string]$operation.StudioRequestFingerprint) -Cache
  }
  Send-AuraPromptShelfStudioChanged
}

function New-AuraPromptShelfInsertionScript {
  param(
    [Parameter(Mandatory = $true)][string]$Text,
    [Parameter(Mandatory = $true)][string]$OperationId,
    [Parameter(Mandatory = $true)][long]$PageEpoch,
    [Parameter(Mandatory = $true)][string]$Target
  )
  $textJson = $Text | ConvertTo-Json -Compress
  $operationJson = $OperationId | ConvertTo-Json -Compress
  $targetJson = $Target | ConvertTo-Json -Compress
  $source = @'
((text, operationId, pageEpoch, expectedTarget) => {
  let context = "other";
  const target = `${location.origin}${location.pathname}${location.search}`;
  const result = (inserted, reason, certainty = "certain") => ({
    operationId, pageEpoch, target, inserted, context, reason, certainty,
  });
  if (target !== expectedTarget) return result(false, "stale-target");
  const found = window.__CLAUDE_AURA_STATE__?.discoverComposer?.();
  context = found && (found.context === "new-chat" || found.context === "conversation")
    ? found.context : "other";
  const editor = found?.editor;
  if (!editor || context === "other") return result(false, "composer-unavailable");
  if (editor.matches("[readonly],[disabled],[aria-disabled=true]")) {
    return result(false, "editor-readonly");
  }
  if (typeof text !== "string" || !text.trim() || text.length > 8000
      || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) {
    return result(false, "invalid-text");
  }
  let mutationStarted = false;
  try {
    if (editor.tagName === "TEXTAREA") {
      if (document.activeElement !== editor) return result(false, "composer-unavailable");
      const input = new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: text,
      });
      editor.setRangeText(text, editor.selectionStart, editor.selectionEnd, "end");
      mutationStarted = true;
      editor.dispatchEvent(input);
    } else {
      const selection = document.getSelection();
      if (!selection || !editor.contains(selection.anchorNode)
          || !editor.contains(selection.focusNode)) {
        return result(false, "composer-unavailable");
      }
      mutationStarted = true;
      if (!document.execCommand("insertText", false, text)) {
        return result(false, "insertion-uncertain", "uncertain");
      }
    }
    return result(true, "inserted");
  } catch {
    return mutationStarted
      ? result(false, "insertion-uncertain", "uncertain")
      : result(false, "insertion-failed");
  }
})
'@
  return $source + '(' + $textJson + ', ' + $operationJson + ', ' +
    [string]$PageEpoch + ', ' + $targetJson + ')'
}

function Complete-AuraPromptShelfInsertTask {
  $operation = $script:PromptShelfInsertOperation
  if ($null -eq $operation -or $null -eq $operation.Task -or
      -not $operation.Task.IsCompleted) { return }
  $task = $operation.Task
  $operation.Task = $null
  try {
    $raw = $task.GetAwaiter().GetResult()
    if ($raw -isnot [string] -or $raw.Length -gt 4096) {
      throw 'Prompt Shelf insertion returned an invalid result size.'
    }
    $message = $raw | ConvertFrom-Json
    if ($message -isnot [Management.Automation.PSCustomObject]) {
      throw 'Prompt Shelf insertion returned a non-object result.'
    }
    $names = @($message.PSObject.Properties | ForEach-Object { $_.Name })
    if ($names.Count -ne 7 -or
        $names -cnotcontains 'operationId' -or $names -cnotcontains 'pageEpoch' -or
        $names -cnotcontains 'target' -or $names -cnotcontains 'inserted' -or
        $names -cnotcontains 'context' -or $names -cnotcontains 'reason' -or
        $names -cnotcontains 'certainty' -or
        $message.operationId -isnot [string] -or
        $message.operationId -cnotmatch '^[a-f0-9]{32}$' -or
        ($message.pageEpoch -isnot [int] -and $message.pageEpoch -isnot [long]) -or
        $message.target -isnot [string] -or $message.target.Length -gt 2048 -or
        $message.inserted -isnot [bool] -or
        $message.context -isnot [string] -or
        $message.context -cnotin @('new-chat', 'conversation', 'other') -or
        $message.reason -isnot [string] -or
        $message.reason -cnotin @(
          'inserted', 'invalid-text', 'composer-unavailable', 'editor-readonly',
          'stale-target', 'insertion-failed', 'insertion-uncertain') -or
        $message.certainty -isnot [string] -or
        $message.certainty -cnotin @('certain', 'uncertain')) {
      throw 'Prompt Shelf insertion returned an invalid result shape.'
    }
    if ($message.operationId -cne [string]$operation.OperationId -or
        [long]$message.pageEpoch -ne [long]$operation.PageEpoch) {
      throw 'Prompt Shelf insertion returned mismatched correlation.'
    }
    if ([string]$message.certainty -ceq 'uncertain') {
      Complete-AuraPromptShelfInsert -OperationId $operation.OperationId -Outcome uncertain
      return
    }
    if ([string]$message.reason -ceq 'stale-target') {
      Complete-AuraPromptShelfInsert -OperationId $operation.OperationId -Outcome not-inserted
      return
    }
    $currentTarget = Get-AuraPromptShelfRouteKey -Value $script:WebView.Source
    if ([long]$script:PromptShelfPageEpoch -ne [long]$operation.PageEpoch -or
        [string]$message.target -cne [string]$operation.Target -or
        $currentTarget -cne [string]$operation.Target) {
      throw 'Prompt Shelf insertion target changed before acknowledgement.'
    }
    if ([bool]$message.inserted -and [string]$message.reason -ceq 'inserted') {
      Complete-AuraPromptShelfInsert -OperationId $operation.OperationId -Outcome inserted
    } elseif (-not [bool]$message.inserted -and
        [string]$message.reason -cin @(
          'invalid-text', 'composer-unavailable', 'editor-readonly', 'insertion-failed')) {
      Complete-AuraPromptShelfInsert -OperationId $operation.OperationId -Outcome not-inserted
    } else {
      throw 'Prompt Shelf insertion result contradicted itself.'
    }
  } catch {
    Set-AuraPromptShelfOperationUncertain -EventCode 'result-rejected'
  }
}

function Invoke-AuraPromptShelfInsert {
  param(
    [AllowEmptyString()][string]$Text,
    [AllowEmptyString()][string]$StudioRequestId = '',
    [AllowEmptyString()][string]$StudioSession = '',
    [AllowEmptyString()][string]$StudioItemId = '',
    [AllowEmptyString()]
    [ValidatePattern('^$|^[a-f0-9]{64}$')][string]$StudioRequestFingerprint = '',
    [AllowEmptyString()]
    [ValidatePattern('^$|^[a-f0-9]{32}$')][string]$DraftHandoffAttemptId = '',
    [long]$DraftHandoffPageEpoch = -1,
    [AllowEmptyString()][string]$DraftHandoffTarget = '',
    [AllowEmptyString()]
    [ValidatePattern('^$|^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$')]
    [string]$QueueCommandId = '',
    [AllowEmptyString()]
    [ValidatePattern('^$|^[a-f0-9]{64}$')][string]$QueueDraftFingerprint = ''
  )
  if ([string]::IsNullOrWhiteSpace($Text)) {
    Set-AuraPromptShelfStatus -Text (
      Get-AuraPromptShelfCopy -Name 'promptShelfBlank' -Fallback 'Write a prompt first.')
    return
  }
  if (-not (Test-AuraPromptShelfText -Text $Text)) {
    Set-AuraPromptShelfStatus -Text (
      Get-AuraPromptShelfCopy -Name 'promptShelfTooLong' -Fallback 'Keep each draft under 8,000 characters.')
    return
  }
  if ([bool]$QueueCommandId -ne [bool]$QueueDraftFingerprint) {
    Set-AuraPromptShelfStatusCopy `
      -Name 'promptShelfInsertFailed' `
      -Fallback 'Place the caret in the Claude composer, then try again.'
    return
  }
  if ($null -ne $script:PromptShelfInsertOperation) {
    Update-AuraPromptShelfStatusCopy
    return
  }
  $currentTarget = if ($null -ne $script:WebView) {
    Get-AuraPromptShelfRouteKey -Value $script:WebView.Source
  } else { '' }
  $target = if ($DraftHandoffAttemptId) { $DraftHandoffTarget } else { $currentTarget }
  $pageEpoch = if ($DraftHandoffAttemptId) {
    [long]$DraftHandoffPageEpoch
  } else {
    [long]$script:PromptShelfPageEpoch
  }
  if (-not (Get-AuraUiEnabled) -or -not $script:WebReady -or
      $null -eq $script:WebView.CoreWebView2 -or -not $target -or
      ($DraftHandoffAttemptId -and
        ($currentTarget -cne $target -or [long]$script:PromptShelfPageEpoch -ne $pageEpoch))) {
    Set-AuraPromptShelfStatusCopy `
      -Name 'promptShelfInsertFailed' `
      -Fallback 'Place the caret in the Claude composer, then try again.'
    return
  }
  try {
    Ensure-AuraPromptShelfInsertTimeout
    $operationId = [Guid]::NewGuid().ToString('N')
    $source = New-AuraPromptShelfInsertionScript `
      -Text $Text -OperationId $operationId -PageEpoch $pageEpoch -Target $target
    $script:PromptShelfInsertOperation = [PSCustomObject][ordered]@{
      OperationId = $operationId
      PageEpoch = $pageEpoch
      Target = $target
      State = 'dispatching'
      Task = $null
      StudioRequestId = $StudioRequestId
      StudioSession = $StudioSession
      StudioItemId = $StudioItemId
      StudioRequestFingerprint = $StudioRequestFingerprint
      DraftHandoffAttemptId = $DraftHandoffAttemptId
      QueueCommandId = $QueueCommandId
      QueueDraftFingerprint = $QueueDraftFingerprint
    }
    Update-AuraPromptShelfActions
    Send-AuraPromptShelfStudioChanged
    Set-AuraPromptShelfStatusCopy -Name 'promptShelfInserting' -Fallback 'Inserting...'
    $script:PromptShelfInsertOperation.Task = (
      $script:WebView.CoreWebView2.ExecuteScriptAsync($source))
    $script:PromptShelfInsertTimeout.Start()
  } catch {
    Stop-AuraPromptShelfInsertTimeouts
    if ($null -ne $script:PromptShelfInsertOperation -and
        $null -ne $script:PromptShelfInsertOperation.Task) {
      Set-AuraPromptShelfOperationUncertain -EventCode 'insert-dispatch-uncertain'
      return
    }
    $script:PromptShelfInsertOperation = $null
    if ($DraftHandoffAttemptId -and
        (Get-Command Complete-AuraDraftHandoffInsert -ErrorAction SilentlyContinue)) {
      Complete-AuraDraftHandoffInsert -AttemptId $DraftHandoffAttemptId -Outcome not-inserted
    }
    if ($QueueCommandId -and
        (Get-Command Complete-AuraTaskboardQueuePlacement -ErrorAction SilentlyContinue)) {
      Complete-AuraTaskboardQueuePlacement `
        -QueueCommandId $QueueCommandId -Outcome not-inserted
    }
    Write-AuraPromptShelfEvent -Code 'insert-dispatch-failed'
    Set-AuraPromptShelfStatusCopy `
      -Name 'promptShelfInsertFailed' `
      -Fallback 'Place the caret in the Claude composer, then try again.'
    Update-AuraPromptShelfActions
  }
}

function Invoke-AuraPromptShelfInsertSelected {
  $index = Get-AuraPromptShelfSelectedIndex
  if ($index -lt 0) {
    Set-AuraPromptShelfStatus -Text (
      Get-AuraPromptShelfCopy -Name 'promptShelfSelectDraft' -Fallback 'Select a saved draft first.')
    return
  }
  Invoke-AuraPromptShelfInsert -Text ([string]$script:PromptShelfItems[$index].text)
}

function Draw-AuraPromptShelfButton {
  param(
    [Parameter(Mandatory = $true)][Windows.Forms.Button]$Button,
    [Parameter(Mandatory = $true)][Windows.Forms.PaintEventArgs]$EventArgs
  )
  # WinForms replaces ForeColor with the operating system's disabled-text
  # color, which can be nearly black even when Aura is using a dark palette.
  # Paint only the disabled state ourselves; enabled hover, pressed, focus,
  # and accessibility behavior remain native.
  if ($Button.Enabled -or [Windows.Forms.SystemInformation]::HighContrast -or
      ($null -ne $script:PromptShelfProfile -and $script:PromptShelfProfile.HighContrast)) {
    return
  }
  $bounds = $Button.ClientRectangle
  if ($bounds.Width -le 0 -or $bounds.Height -le 0) { return }
  $backgroundBrush = [Drawing.SolidBrush]::new($Button.BackColor)
  $borderPen = [Drawing.Pen]::new($Button.FlatAppearance.BorderColor)
  try {
    $EventArgs.Graphics.FillRectangle($backgroundBrush, $bounds)
    $EventArgs.Graphics.DrawRectangle(
      $borderPen,
      0,
      0,
      [Math]::Max(0, $bounds.Width - 1),
      [Math]::Max(0, $bounds.Height - 1))
    $textBounds = [Drawing.Rectangle]::Inflate($bounds, -3, -2)
    $flags = [Windows.Forms.TextFormatFlags]::HorizontalCenter -bor
      [Windows.Forms.TextFormatFlags]::VerticalCenter -bor
      [Windows.Forms.TextFormatFlags]::SingleLine -bor
      [Windows.Forms.TextFormatFlags]::EndEllipsis -bor
      [Windows.Forms.TextFormatFlags]::NoPrefix -bor
      [Windows.Forms.TextFormatFlags]::NoPadding
    [Windows.Forms.TextRenderer]::DrawText(
      $EventArgs.Graphics,
      $Button.Text,
      $Button.Font,
      $textBounds,
      $Button.ForeColor,
      $Button.BackColor,
      $flags)
  } finally {
    $borderPen.Dispose()
    $backgroundBrush.Dispose()
  }
}

function New-AuraPromptShelfButton {
  param(
    [Parameter(Mandatory = $true)][int]$TabIndex,
    [switch]$Compact
  )
  $button = [Windows.Forms.Button]::new()
  $button.AutoSize = $true
  $button.AutoSizeMode = [Windows.Forms.AutoSizeMode]::GrowAndShrink
  $button.MinimumSize = if ($Compact) {
    [Drawing.Size]::new(38, 36)
  } else {
    [Drawing.Size]::new(84, 36)
  }
  $button.Margin = [Windows.Forms.Padding]::new(0, 0, 8, 0)
  $button.Padding = if ($Compact) {
    [Windows.Forms.Padding]::new(0, 2, 0, 2)
  } else {
    [Windows.Forms.Padding]::new(10, 2, 10, 2)
  }
  $button.TabIndex = $TabIndex
  $button.TabStop = $true
  $button.FlatStyle = [Windows.Forms.FlatStyle]::Flat
  $button.UseMnemonic = $false
  $button.add_Paint({
    param($sender, $eventArgs)
    Draw-AuraPromptShelfButton -Button $sender -EventArgs $eventArgs
  })
  return $button
}

function Draw-AuraPromptShelfListItem {
  param(
    [Parameter(Mandatory = $true)][Windows.Forms.ListBox]$Sender,
    [Parameter(Mandatory = $true)][Windows.Forms.DrawItemEventArgs]$EventArgs
  )
  if ($EventArgs.Index -lt 0 -or $EventArgs.Index -ge $script:PromptShelfItems.Count) { return }
  $profile = if ($null -ne $script:PromptShelfProfile) {
    $script:PromptShelfProfile
  } else {
    Get-AuraUiLoadingProfile
  }
  $selected = (($EventArgs.State -band [Windows.Forms.DrawItemState]::Selected) -ne 0)
  $focused = (($EventArgs.State -band [Windows.Forms.DrawItemState]::Focus) -ne 0)
  $background = if ($selected) {
    if ($profile.HighContrast) {
      $profile.Accent
    } else {
      Get-AuraPromptShelfBlendedColor `
        -Foreground $profile.Accent -Background $profile.Surface -Weight 0.14
    }
  } else {
    $profile.Surface
  }
  $foreground = if ($selected -and $profile.HighContrast) {
    $profile.AccentText
  } else {
    $profile.Text
  }
  $muted = if ($selected -and $profile.HighContrast) {
    $profile.AccentText
  } else {
    $profile.Muted
  }

  $backgroundBrush = [Drawing.SolidBrush]::new($background)
  $railBrush = [Drawing.SolidBrush]::new(
    $(if ($profile.HighContrast) { $profile.AccentText } else { $profile.Accent }))
  $separatorPen = [Drawing.Pen]::new(
    $(if ($profile.HighContrast) {
        $profile.Border
      } else {
        Get-AuraPromptShelfBlendedColor `
          -Foreground $profile.Border -Background $profile.Surface -Weight 0.28
      }))
  try {
    $EventArgs.Graphics.FillRectangle($backgroundBrush, $EventArgs.Bounds)
    $railWidth = if ($selected) { 4 } else { 0 }
    if ($selected) {
      $EventArgs.Graphics.FillRectangle(
        $railBrush,
        [Drawing.Rectangle]::new(
          $EventArgs.Bounds.X, $EventArgs.Bounds.Y, $railWidth, $EventArgs.Bounds.Height))
    }

    $item = $script:PromptShelfItems[$EventArgs.Index]
    $text = [string]$item.text
    $lines = @($text -split '\r?\n')
    $title = if ($lines.Count -gt 0) { $lines[0].Trim() } else { '' }
    if (-not $title) { $title = ([regex]::Replace($text.Trim(), '\s+', ' ')) }
    $detail = if ($lines.Count -gt 1) {
      [regex]::Replace((($lines[1..($lines.Count - 1)] -join ' ').Trim()), '\s+', ' ')
    } else { '' }

    $flags = [Windows.Forms.TextFormatFlags]::EndEllipsis -bor
      [Windows.Forms.TextFormatFlags]::NoPadding -bor
      [Windows.Forms.TextFormatFlags]::SingleLine -bor
      [Windows.Forms.TextFormatFlags]::VerticalCenter
    $ordinalRect = [Drawing.Rectangle]::new(
      $EventArgs.Bounds.X + $railWidth + 10,
      $EventArgs.Bounds.Y,
      30,
      $EventArgs.Bounds.Height)
    [Windows.Forms.TextRenderer]::DrawText(
      $EventArgs.Graphics,
      ($EventArgs.Index + 1).ToString('00'),
      $script:PromptShelfForm.Font,
      $ordinalRect,
      $muted,
      $flags)

    $textX = $EventArgs.Bounds.X + $railWidth + 46
    $textWidth = [Math]::Max(1, $EventArgs.Bounds.Right - $textX - 12)
    if ($detail) {
      $titleRect = [Drawing.Rectangle]::new(
        $textX, $EventArgs.Bounds.Y + 7, $textWidth, 22)
      $detailRect = [Drawing.Rectangle]::new(
        $textX, $EventArgs.Bounds.Y + 29, $textWidth, 20)
      [Windows.Forms.TextRenderer]::DrawText(
        $EventArgs.Graphics, $title, $Sender.Font, $titleRect, $foreground, $flags)
      [Windows.Forms.TextRenderer]::DrawText(
        $EventArgs.Graphics,
        $detail,
        $script:PromptShelfForm.Font,
        $detailRect,
        $muted,
        $flags)
    } else {
      $titleRect = [Drawing.Rectangle]::new(
        $textX, $EventArgs.Bounds.Y, $textWidth, $EventArgs.Bounds.Height)
      [Windows.Forms.TextRenderer]::DrawText(
        $EventArgs.Graphics, $title, $Sender.Font, $titleRect, $foreground, $flags)
    }
    $EventArgs.Graphics.DrawLine(
      $separatorPen,
      $EventArgs.Bounds.X + 10,
      $EventArgs.Bounds.Bottom - 1,
      $EventArgs.Bounds.Right - 10,
      $EventArgs.Bounds.Bottom - 1)
    if ($focused) {
      [Windows.Forms.ControlPaint]::DrawFocusRectangle(
        $EventArgs.Graphics,
        [Drawing.Rectangle]::Inflate($EventArgs.Bounds, -4, -4),
        $foreground,
        $background)
    }
  } finally {
    $separatorPen.Dispose()
    $railBrush.Dispose()
    $backgroundBrush.Dispose()
  }
}

function Update-AuraPromptShelfCopy {
  if ($null -ne $script:LauncherActionQueueItem -and -not $script:LauncherActionQueueItem.IsDisposed) {
    $script:LauncherActionQueueItem.Text = Get-AuraPromptShelfCopy -Name 'openActionQueue' -Fallback 'Open Action Queue'
  }
  if ($null -eq $script:PromptShelfForm -or $script:PromptShelfForm.IsDisposed) { return }
  $title = Get-AuraPromptShelfCopy -Name 'promptShelf' -Fallback 'Prompt Shelf'
  $script:PromptShelfForm.Text = $title
  $script:PromptShelfForm.AccessibleName = $title
  $script:PromptShelfTitleLabel.Text = $title
  $helper = Get-AuraPromptShelfCopy -Name 'promptShelfHelper' -Fallback (
    'Saved on this device. Inserting never sends.')
  $script:PromptShelfForm.AccessibleDescription = $helper
  $script:PromptShelfHelperLabel.Text = $helper
  $script:PromptShelfDraftLabel.Text = Get-AuraPromptShelfCopy -Name 'promptShelfDraft' -Fallback 'New draft'
  $script:PromptShelfSavedLabel.Text = Get-AuraPromptShelfCopy `
    -Name 'promptShelfSavedDrafts' -Fallback 'Saved drafts'
  $script:PromptShelfEmptyLabel.Text = Get-AuraPromptShelfCopy `
    -Name 'promptShelfEmpty' -Fallback 'No saved drafts'
  $script:PromptShelfEmptyHelperLabel.Text = Get-AuraPromptShelfCopy `
    -Name 'promptShelfEmptyHelper' -Fallback 'Save one above to keep it here.'
  $script:PromptShelfAddButton.Text = if ($script:PromptShelfEditingId) {
    Get-AuraPromptShelfCopy -Name 'promptShelfSave' -Fallback 'Save changes'
  } else {
    Get-AuraPromptShelfCopy -Name 'promptShelfAdd' -Fallback 'Save draft'
  }
  $script:PromptShelfCancelButton.Text = Get-AuraPromptShelfCopy -Name 'promptShelfCancelEdit' -Fallback 'Cancel edit'
  $script:PromptShelfInsertNowButton.Text = Get-AuraPromptShelfCopy `
    -Name 'promptShelfInsertNow' -Fallback 'Insert without saving'
  $script:PromptShelfEditButton.Text = Get-AuraPromptShelfCopy -Name 'promptShelfEdit' -Fallback 'Edit'
  $moveUp = Get-AuraPromptShelfCopy -Name 'promptShelfMoveUp' -Fallback 'Move up'
  $moveDown = Get-AuraPromptShelfCopy -Name 'promptShelfMoveDown' -Fallback 'Move down'
  $script:PromptShelfMoveUpButton.Text = [char]0x2191
  $script:PromptShelfMoveDownButton.Text = [char]0x2193
  $script:PromptShelfDeleteButton.Text = Get-AuraPromptShelfCopy -Name 'promptShelfDelete' -Fallback 'Delete'
  $script:PromptShelfInsertButton.Text = Get-AuraPromptShelfCopy -Name 'promptShelfInsert' -Fallback 'Insert'
  $script:PromptShelfResolveButton.Text = Get-AuraPromptShelfCopy `
    -Name 'promptShelfConfirmChecked' -Fallback "I've checked the composer"
  $script:PromptShelfMoveUpButton.AccessibleName = $moveUp
  $script:PromptShelfMoveDownButton.AccessibleName = $moveDown
  foreach ($button in @(
      $script:PromptShelfAddButton, $script:PromptShelfCancelButton, $script:PromptShelfInsertNowButton,
      $script:PromptShelfEditButton, $script:PromptShelfDeleteButton, $script:PromptShelfInsertButton,
      $script:PromptShelfResolveButton
    )) {
    if ($null -ne $button) { $button.AccessibleName = $button.Text }
  }
  $script:PromptShelfDraftBox.AccessibleName = $script:PromptShelfDraftLabel.Text
  $script:PromptShelfDraftBox.AccessibleDescription = $helper
  $script:PromptShelfList.AccessibleName = $script:PromptShelfSavedLabel.Text
  $script:PromptShelfList.AccessibleDescription = $script:PromptShelfEmptyHelperLabel.Text
  $script:PromptShelfDraftCard.AccessibleName = $script:PromptShelfDraftLabel.Text
  $script:PromptShelfSavedCard.AccessibleName = $script:PromptShelfSavedLabel.Text
  $script:PromptShelfInsertNowButton.AccessibleDescription = $helper
  $script:PromptShelfInsertButton.AccessibleDescription = $helper
  if ($null -ne $script:PromptShelfToolTip) {
    $script:PromptShelfToolTip.SetToolTip($script:PromptShelfMoveUpButton, $moveUp)
    $script:PromptShelfToolTip.SetToolTip($script:PromptShelfMoveDownButton, $moveDown)
  }
  Update-AuraPromptShelfStatusCopy
  Update-AuraPromptShelfCharacterCount
  Update-AuraPromptShelfList
  Update-AuraPromptShelfResponsiveLayout
}

function Set-AuraPromptShelfButtonTheme {
  param(
    [Parameter(Mandatory = $true)][Windows.Forms.Button]$Button,
    [Parameter(Mandatory = $true)][object]$Profile,
    [switch]$Primary
  )
  if ($Profile.HighContrast) {
    $Button.FlatStyle = [Windows.Forms.FlatStyle]::System
    $Button.UseVisualStyleBackColor = $true
    $Button.Invalidate()
    return
  }
  $Button.FlatStyle = [Windows.Forms.FlatStyle]::Flat
  $Button.UseVisualStyleBackColor = $false
  $Button.FlatAppearance.BorderSize = 1
  if (-not $Button.Enabled) {
    $Button.BackColor = $Profile.Surface
    $Button.ForeColor = $Profile.Muted
    $Button.FlatAppearance.BorderColor = Get-AuraPromptShelfBlendedColor `
      -Foreground $Profile.Border -Background $Profile.Surface -Weight 0.32
    $Button.FlatAppearance.MouseOverBackColor = $Profile.Surface
    $Button.FlatAppearance.MouseDownBackColor = $Profile.Surface
  } elseif ($Primary) {
    $Button.BackColor = $Profile.Accent
    $Button.ForeColor = $Profile.AccentText
    $Button.FlatAppearance.BorderColor = $Profile.Accent
    $Button.FlatAppearance.MouseOverBackColor = Get-AuraPromptShelfBlendedColor `
      -Foreground $Profile.Accent -Background $Profile.Surface -Weight 0.92
    $Button.FlatAppearance.MouseDownBackColor = Get-AuraPromptShelfBlendedColor `
      -Foreground $Profile.Accent -Background $Profile.Text -Weight 0.82
  } else {
    $Button.BackColor = $Profile.Surface
    $Button.ForeColor = $Profile.Text
    $Button.FlatAppearance.BorderColor = $Profile.Border
    $Button.FlatAppearance.MouseOverBackColor = Get-AuraPromptShelfBlendedColor `
      -Foreground $Profile.Accent -Background $Profile.Surface -Weight 0.10
    $Button.FlatAppearance.MouseDownBackColor = Get-AuraPromptShelfBlendedColor `
      -Foreground $Profile.Accent -Background $Profile.Surface -Weight 0.18
  }
  $Button.Invalidate()
}

function Update-AuraPromptShelfButtonThemes {
  param([Parameter(Mandatory = $true)][object]$Profile)
  Set-AuraPromptShelfButtonTheme -Button $script:PromptShelfAddButton -Profile $Profile -Primary
  Set-AuraPromptShelfButtonTheme -Button $script:PromptShelfInsertNowButton -Profile $Profile
  Set-AuraPromptShelfButtonTheme -Button $script:PromptShelfInsertButton -Profile $Profile -Primary
  foreach ($button in @(
      $script:PromptShelfCancelButton, $script:PromptShelfEditButton,
      $script:PromptShelfMoveUpButton, $script:PromptShelfMoveDownButton,
      $script:PromptShelfDeleteButton, $script:PromptShelfResolveButton
    )) {
    Set-AuraPromptShelfButtonTheme -Button $button -Profile $Profile
  }
}

function Update-AuraPromptShelfTheme {
  if ($null -eq $script:PromptShelfForm -or $script:PromptShelfForm.IsDisposed) { return }
  $profile = Get-AuraUiLoadingProfile
  $script:PromptShelfProfile = $profile
  $script:PromptShelfForm.BackColor = $profile.Background
  $script:PromptShelfRoot.BackColor = $profile.Background
  $script:PromptShelfHeader.BackColor = $profile.Background
  $script:PromptShelfHeaderAccent.BackColor = if ($profile.HighContrast) {
    $profile.Accent
  } else {
    $profile.AccentSecondary
  }
  $script:PromptShelfTitleLabel.ForeColor = $profile.Text
  $script:PromptShelfHelperLabel.ForeColor = $profile.Muted
  $script:PromptShelfDraftLabel.ForeColor = $profile.Text
  $script:PromptShelfSavedLabel.ForeColor = $profile.Text
  $script:PromptShelfCharacterCountLabel.ForeColor = $profile.Muted
  $script:PromptShelfSavedCountLabel.ForeColor = $profile.Text
  $script:PromptShelfSavedCountLabel.BackColor = if ($profile.HighContrast) {
    $profile.Surface
  } else {
    Get-AuraPromptShelfBlendedColor `
      -Foreground $profile.Accent -Background $profile.Surface -Weight 0.12
  }
  $script:PromptShelfStatusPanel.BackColor = $profile.Background
  $script:PromptShelfStatusLabel.ForeColor = $profile.Muted
  $script:PromptShelfStatusLabel.BackColor = $profile.Background
  $script:PromptShelfEmptyLabel.ForeColor = $profile.Text
  $script:PromptShelfEmptyHelperLabel.ForeColor = $profile.Muted
  foreach ($frame in @($script:PromptShelfDraftCard, $script:PromptShelfSavedCard,
      $script:PromptShelfDraftBoxFrame, $script:PromptShelfListFrame)) {
    $frame.BackColor = $profile.Border
  }
  if ($script:PromptShelfDraftBox.Focused) {
    $script:PromptShelfDraftBoxFrame.BackColor = $profile.Accent
  }
  foreach ($surface in @(
      $script:PromptShelfDraftCardContent, $script:PromptShelfSavedCardContent,
      $script:PromptShelfDraftBoxSurface, $script:PromptShelfEmptyPanel,
      $script:PromptShelfEmptyContent
    )) {
    $surface.BackColor = $profile.Surface
  }
  foreach ($control in @($script:PromptShelfDraftBox, $script:PromptShelfList)) {
    $control.BackColor = $profile.Surface
    $control.ForeColor = $profile.Text
  }
  Update-AuraPromptShelfButtonThemes -Profile $profile
  $script:PromptShelfList.Invalidate()
  if ($null -ne $script:PromptShelfIconWindow) {
    try {
      $script:PromptShelfIconWindow.SetDarkMode($profile.Appearance -ceq 'dark')
      $script:PromptShelfIconWindow.SetCaptionColor(
        [byte]$profile.Background.R,
        [byte]$profile.Background.G,
        [byte]$profile.Background.B)
    } catch {}
  }
}

function New-AuraPromptShelfForm {
  if ($null -ne $script:PromptShelfForm -and -not $script:PromptShelfForm.IsDisposed) { return }
  Initialize-AuraPromptShelfPersistence

  $script:PromptShelfForm = [Windows.Forms.Form]::new()
  $script:PromptShelfForm.Name = 'PromptShelfForm'
  $script:PromptShelfForm.StartPosition = [Windows.Forms.FormStartPosition]::Manual
  $script:PromptShelfForm.ClientSize = [Drawing.Size]::new(500, 590)
  $script:PromptShelfForm.MinimumSize = [Drawing.Size]::new(440, 580)
  $script:PromptShelfForm.FormBorderStyle = [Windows.Forms.FormBorderStyle]::Sizable
  $script:PromptShelfForm.MaximizeBox = $false
  $script:PromptShelfForm.MinimizeBox = $false
  $script:PromptShelfForm.ShowInTaskbar = $false
  $script:PromptShelfForm.AutoScaleMode = [Windows.Forms.AutoScaleMode]::Dpi
  $script:PromptShelfForm.KeyPreview = $true
  $script:PromptShelfForm.Font = [Drawing.Font]::new('Segoe UI', 9)
  $script:PromptShelfForm.AccessibleRole = [Windows.Forms.AccessibleRole]::Dialog
  if ($null -ne $script:StudioIcon) { $script:PromptShelfForm.Icon = $script:StudioIcon }

  $script:PromptShelfIconWindow = [AuraIconWindow]::new()
  $script:PromptShelfForm.add_HandleCreated({
    $script:PromptShelfIconWindow.Attach($script:PromptShelfForm.Handle)
    if ($null -eq $script:PromptShelfPreferredSize) {
      $script:PromptShelfPreferredSize = $script:PromptShelfForm.Size
      $script:PromptShelfPreferredMinimumSize = $script:PromptShelfForm.MinimumSize
      $script:PromptShelfPreferredDpi = [int]$script:PromptShelfForm.DeviceDpi
    }
    Update-AuraPromptShelfTheme
    Update-AuraPromptShelfResponsiveLayout
  })
  $script:PromptShelfForm.add_DpiChanged({
    Update-AuraPromptShelfResponsiveLayout
    Update-AuraPromptShelfVisibleBounds -HostForm $script:Form
  })
  $script:PromptShelfForm.add_HandleDestroyed({
    if ($null -ne $script:PromptShelfIconWindow) { $script:PromptShelfIconWindow.Detach() }
  })
  $script:PromptShelfForm.add_KeyDown({
    param($sender, $eventArgs)
    if ($eventArgs.KeyCode -eq [Windows.Forms.Keys]::Escape) {
      $eventArgs.Handled = $true
      $sender.Hide()
      if ((Get-Command Test-AuraDraftHandoffTransientActive -ErrorAction SilentlyContinue) -and
          (Test-AuraDraftHandoffTransientActive)) {
        Cancel-AuraDraftHandoffTransient -Reason 'user-cancelled'
      }
    }
  })
  $script:PromptShelfForm.add_FormClosing({
    param($sender, $eventArgs)
    if (-not $script:PromptShelfDisposing -and
        $eventArgs.CloseReason -eq [Windows.Forms.CloseReason]::UserClosing) {
      $eventArgs.Cancel = $true
      if ((Get-Command Test-AuraDraftHandoffTransientActive -ErrorAction SilentlyContinue) -and
          (Test-AuraDraftHandoffTransientActive)) {
        Cancel-AuraDraftHandoffTransient -Reason 'user-cancelled'
      }
      $sender.Hide()
    }
  })

  $script:PromptShelfRoot = [Windows.Forms.TableLayoutPanel]::new()
  $script:PromptShelfRoot.Name = 'PromptShelfRoot'
  $script:PromptShelfRoot.Dock = [Windows.Forms.DockStyle]::Fill
  $script:PromptShelfRoot.Padding = [Windows.Forms.Padding]::new(18)
  $script:PromptShelfRoot.AutoScroll = $true
  $script:PromptShelfRoot.ColumnCount = 1
  $script:PromptShelfRoot.RowCount = 4
  [void]$script:PromptShelfRoot.ColumnStyles.Add(
    [Windows.Forms.ColumnStyle]::new([Windows.Forms.SizeType]::Percent, 100))
  foreach ($rowStyle in @(
      [Windows.Forms.RowStyle]::new([Windows.Forms.SizeType]::Absolute, 78),
      [Windows.Forms.RowStyle]::new([Windows.Forms.SizeType]::Absolute, 190),
      [Windows.Forms.RowStyle]::new([Windows.Forms.SizeType]::Percent, 100),
      [Windows.Forms.RowStyle]::new([Windows.Forms.SizeType]::AutoSize)
    )) {
    [void]$script:PromptShelfRoot.RowStyles.Add($rowStyle)
  }
  $script:PromptShelfRoot.add_SizeChanged({ Update-AuraPromptShelfResponsiveLayout })

  $script:PromptShelfHeader = [Windows.Forms.TableLayoutPanel]::new()
  $script:PromptShelfHeader.Name = 'PromptShelfHeader'
  $script:PromptShelfHeader.AutoSize = $false
  $script:PromptShelfHeader.MinimumSize = [Drawing.Size]::new(0, 64)
  $script:PromptShelfHeader.Dock = [Windows.Forms.DockStyle]::Fill
  $script:PromptShelfHeader.ColumnCount = 2
  $script:PromptShelfHeader.RowCount = 2
  $script:PromptShelfHeader.Margin = [Windows.Forms.Padding]::new(0, 0, 0, 14)
  [void]$script:PromptShelfHeader.ColumnStyles.Add(
    [Windows.Forms.ColumnStyle]::new([Windows.Forms.SizeType]::Absolute, 4))
  [void]$script:PromptShelfHeader.ColumnStyles.Add(
    [Windows.Forms.ColumnStyle]::new([Windows.Forms.SizeType]::Percent, 100))
  [void]$script:PromptShelfHeader.RowStyles.Add(
    [Windows.Forms.RowStyle]::new([Windows.Forms.SizeType]::AutoSize))
  [void]$script:PromptShelfHeader.RowStyles.Add(
    [Windows.Forms.RowStyle]::new([Windows.Forms.SizeType]::AutoSize))
  $script:PromptShelfHeaderAccent = [Windows.Forms.Panel]::new()
  $script:PromptShelfHeaderAccent.Name = 'PromptShelfHeaderAccent'
  $script:PromptShelfHeaderAccent.Dock = [Windows.Forms.DockStyle]::Fill
  $script:PromptShelfHeaderAccent.Margin = [Windows.Forms.Padding]::new(0, 2, 0, 2)
  $script:PromptShelfTitleLabel = [Windows.Forms.Label]::new()
  $script:PromptShelfTitleLabel.Name = 'PromptShelfTitleLabel'
  $script:PromptShelfTitleLabel.AutoSize = $true
  $script:PromptShelfTitleLabel.Font = [Drawing.Font]::new('Segoe UI Semibold', 17)
  $script:PromptShelfTitleLabel.Margin = [Windows.Forms.Padding]::new(14, 0, 0, 2)

  $script:PromptShelfHelperLabel = [Windows.Forms.Label]::new()
  $script:PromptShelfHelperLabel.Name = 'PromptShelfHelperLabel'
  $script:PromptShelfHelperLabel.AutoSize = $true
  $script:PromptShelfHelperLabel.Margin = [Windows.Forms.Padding]::new(14, 0, 0, 0)
  [void]$script:PromptShelfHeader.Controls.Add($script:PromptShelfHeaderAccent, 0, 0)
  $script:PromptShelfHeader.SetRowSpan($script:PromptShelfHeaderAccent, 2)
  [void]$script:PromptShelfHeader.Controls.Add($script:PromptShelfTitleLabel, 1, 0)
  [void]$script:PromptShelfHeader.Controls.Add($script:PromptShelfHelperLabel, 1, 1)

  $script:PromptShelfDraftCard = [Windows.Forms.Panel]::new()
  $script:PromptShelfDraftCard.Name = 'PromptShelfDraftCard'
  $script:PromptShelfDraftCard.Dock = [Windows.Forms.DockStyle]::Fill
  $script:PromptShelfDraftCard.Padding = [Windows.Forms.Padding]::new(1)
  $script:PromptShelfDraftCard.Margin = [Windows.Forms.Padding]::new(0, 0, 0, 14)
  $script:PromptShelfDraftCard.AccessibleRole = [Windows.Forms.AccessibleRole]::Grouping
  $script:PromptShelfDraftCardContent = [Windows.Forms.TableLayoutPanel]::new()
  $script:PromptShelfDraftCardContent.Name = 'PromptShelfDraftCardContent'
  $script:PromptShelfDraftCardContent.Dock = [Windows.Forms.DockStyle]::Fill
  $script:PromptShelfDraftCardContent.Padding = [Windows.Forms.Padding]::new(12)
  $script:PromptShelfDraftCardContent.ColumnCount = 1
  $script:PromptShelfDraftCardContent.RowCount = 3
  [void]$script:PromptShelfDraftCardContent.ColumnStyles.Add(
    [Windows.Forms.ColumnStyle]::new([Windows.Forms.SizeType]::Percent, 100))
  [void]$script:PromptShelfDraftCardContent.RowStyles.Add(
    [Windows.Forms.RowStyle]::new([Windows.Forms.SizeType]::AutoSize))
  [void]$script:PromptShelfDraftCardContent.RowStyles.Add(
    [Windows.Forms.RowStyle]::new([Windows.Forms.SizeType]::Percent, 100))
  [void]$script:PromptShelfDraftCardContent.RowStyles.Add(
    [Windows.Forms.RowStyle]::new([Windows.Forms.SizeType]::AutoSize))
  [void]$script:PromptShelfDraftCard.Controls.Add($script:PromptShelfDraftCardContent)

  $draftHeader = [Windows.Forms.TableLayoutPanel]::new()
  $draftHeader.Name = 'PromptShelfDraftHeader'
  $draftHeader.AutoSize = $true
  $draftHeader.Dock = [Windows.Forms.DockStyle]::Fill
  $draftHeader.ColumnCount = 2
  $draftHeader.RowCount = 1
  $draftHeader.Margin = [Windows.Forms.Padding]::new(0)
  [void]$draftHeader.ColumnStyles.Add(
    [Windows.Forms.ColumnStyle]::new([Windows.Forms.SizeType]::Percent, 100))
  [void]$draftHeader.ColumnStyles.Add(
    [Windows.Forms.ColumnStyle]::new([Windows.Forms.SizeType]::AutoSize))
  $script:PromptShelfDraftLabel = [Windows.Forms.Label]::new()
  $script:PromptShelfDraftLabel.Name = 'PromptShelfDraftLabel'
  $script:PromptShelfDraftLabel.AutoSize = $true
  $script:PromptShelfDraftLabel.Font = [Drawing.Font]::new('Segoe UI Semibold', 9)
  $script:PromptShelfDraftLabel.Anchor = [Windows.Forms.AnchorStyles]::Left
  $script:PromptShelfDraftLabel.Margin = [Windows.Forms.Padding]::new(0)
  $script:PromptShelfCharacterCountLabel = [Windows.Forms.Label]::new()
  $script:PromptShelfCharacterCountLabel.Name = 'PromptShelfCharacterCountLabel'
  $script:PromptShelfCharacterCountLabel.AutoSize = $true
  $script:PromptShelfCharacterCountLabel.Anchor = [Windows.Forms.AnchorStyles]::Right
  $script:PromptShelfCharacterCountLabel.Margin = [Windows.Forms.Padding]::new(8, 0, 0, 0)
  [void]$draftHeader.Controls.Add($script:PromptShelfDraftLabel, 0, 0)
  [void]$draftHeader.Controls.Add($script:PromptShelfCharacterCountLabel, 1, 0)

  $script:PromptShelfDraftBoxFrame = [Windows.Forms.Panel]::new()
  $script:PromptShelfDraftBoxFrame.Name = 'PromptShelfDraftBoxFrame'
  $script:PromptShelfDraftBoxFrame.Dock = [Windows.Forms.DockStyle]::Fill
  $script:PromptShelfDraftBoxFrame.MinimumSize = [Drawing.Size]::new(0, 48)
  $script:PromptShelfDraftBoxFrame.Padding = [Windows.Forms.Padding]::new(1)
  $script:PromptShelfDraftBoxFrame.Margin = [Windows.Forms.Padding]::new(0, 8, 0, 0)
  $script:PromptShelfDraftBoxSurface = [Windows.Forms.Panel]::new()
  $script:PromptShelfDraftBoxSurface.Name = 'PromptShelfDraftBoxSurface'
  $script:PromptShelfDraftBoxSurface.Dock = [Windows.Forms.DockStyle]::Fill
  $script:PromptShelfDraftBoxSurface.Padding = [Windows.Forms.Padding]::new(9, 7, 9, 7)
  $script:PromptShelfDraftBox = [Windows.Forms.TextBox]::new()
  $script:PromptShelfDraftBox.Name = 'PromptShelfDraftBox'
  $script:PromptShelfDraftBox.Multiline = $true
  $script:PromptShelfDraftBox.AcceptsReturn = $true
  $script:PromptShelfDraftBox.AcceptsTab = $false
  $script:PromptShelfDraftBox.ScrollBars = [Windows.Forms.ScrollBars]::Vertical
  $script:PromptShelfDraftBox.Dock = [Windows.Forms.DockStyle]::Fill
  $script:PromptShelfDraftBox.BorderStyle = [Windows.Forms.BorderStyle]::None
  $script:PromptShelfDraftBox.MaxLength = $script:PromptShelfMaxTextLength
  $script:PromptShelfDraftBox.TabIndex = 0
  $script:PromptShelfDraftBox.add_TextChanged({ Update-AuraPromptShelfActions })
  $script:PromptShelfDraftBox.add_Enter({ Update-AuraPromptShelfTheme })
  $script:PromptShelfDraftBox.add_Leave({ Update-AuraPromptShelfTheme })
  [void]$script:PromptShelfDraftBoxSurface.Controls.Add($script:PromptShelfDraftBox)
  [void]$script:PromptShelfDraftBoxFrame.Controls.Add($script:PromptShelfDraftBoxSurface)

  $draftActions = [Windows.Forms.FlowLayoutPanel]::new()
  $draftActions.Name = 'PromptShelfDraftActions'
  $draftActions.AutoSize = $true
  $draftActions.WrapContents = $true
  $draftActions.Dock = [Windows.Forms.DockStyle]::Fill
  $draftActions.FlowDirection = [Windows.Forms.FlowDirection]::RightToLeft
  $draftActions.Margin = [Windows.Forms.Padding]::new(0, 10, 0, 0)
  $script:PromptShelfCancelButton = New-AuraPromptShelfButton -TabIndex 1
  $script:PromptShelfInsertNowButton = New-AuraPromptShelfButton -TabIndex 2
  $script:PromptShelfAddButton = New-AuraPromptShelfButton -TabIndex 3
  $script:PromptShelfCancelButton.Name = 'PromptShelfCancelButton'
  $script:PromptShelfInsertNowButton.Name = 'PromptShelfInsertNowButton'
  $script:PromptShelfAddButton.Name = 'PromptShelfAddButton'
  $script:PromptShelfCancelButton.MinimumSize = [Drawing.Size]::new(68, 36)
  $script:PromptShelfCancelButton.Padding = [Windows.Forms.Padding]::new(8, 2, 8, 2)
  $script:PromptShelfAddButton.add_Click({ Invoke-AuraPromptShelfAddOrSave })
  $script:PromptShelfCancelButton.add_Click({ Reset-AuraPromptShelfEditor })
  $script:PromptShelfInsertNowButton.add_Click({
    if ((Get-Command Test-AuraDraftHandoffTransientActive -ErrorAction SilentlyContinue) -and
        (Test-AuraDraftHandoffTransientActive)) {
      Invoke-AuraDraftHandoffInsertTransient
    } else {
      Invoke-AuraPromptShelfInsert -Text ([string]$script:PromptShelfDraftBox.Text)
    }
  })
  [void]$draftActions.Controls.AddRange(@(
    $script:PromptShelfAddButton,
    $script:PromptShelfInsertNowButton,
    $script:PromptShelfCancelButton
  ))
  [void]$script:PromptShelfDraftCardContent.Controls.Add($draftHeader, 0, 0)
  [void]$script:PromptShelfDraftCardContent.Controls.Add($script:PromptShelfDraftBoxFrame, 0, 1)
  [void]$script:PromptShelfDraftCardContent.Controls.Add($draftActions, 0, 2)

  $script:PromptShelfSavedCard = [Windows.Forms.Panel]::new()
  $script:PromptShelfSavedCard.Name = 'PromptShelfSavedCard'
  $script:PromptShelfSavedCard.Dock = [Windows.Forms.DockStyle]::Fill
  $script:PromptShelfSavedCard.MinimumSize = [Drawing.Size]::new(0, 165)
  $script:PromptShelfSavedCard.Padding = [Windows.Forms.Padding]::new(1)
  $script:PromptShelfSavedCard.Margin = [Windows.Forms.Padding]::new(0, 0, 0, 10)
  $script:PromptShelfSavedCard.AccessibleRole = [Windows.Forms.AccessibleRole]::Grouping
  $script:PromptShelfSavedCardContent = [Windows.Forms.TableLayoutPanel]::new()
  $script:PromptShelfSavedCardContent.Name = 'PromptShelfSavedCardContent'
  $script:PromptShelfSavedCardContent.Dock = [Windows.Forms.DockStyle]::Fill
  $script:PromptShelfSavedCardContent.Padding = [Windows.Forms.Padding]::new(12)
  $script:PromptShelfSavedCardContent.ColumnCount = 1
  $script:PromptShelfSavedCardContent.RowCount = 3
  [void]$script:PromptShelfSavedCardContent.ColumnStyles.Add(
    [Windows.Forms.ColumnStyle]::new([Windows.Forms.SizeType]::Percent, 100))
  [void]$script:PromptShelfSavedCardContent.RowStyles.Add(
    [Windows.Forms.RowStyle]::new([Windows.Forms.SizeType]::AutoSize))
  [void]$script:PromptShelfSavedCardContent.RowStyles.Add(
    [Windows.Forms.RowStyle]::new([Windows.Forms.SizeType]::Percent, 100))
  [void]$script:PromptShelfSavedCardContent.RowStyles.Add(
    [Windows.Forms.RowStyle]::new([Windows.Forms.SizeType]::Absolute, 36))
  [void]$script:PromptShelfSavedCard.Controls.Add($script:PromptShelfSavedCardContent)

  $savedHeader = [Windows.Forms.TableLayoutPanel]::new()
  $savedHeader.Name = 'PromptShelfSavedHeader'
  $savedHeader.AutoSize = $true
  $savedHeader.Dock = [Windows.Forms.DockStyle]::Fill
  $savedHeader.ColumnCount = 2
  $savedHeader.RowCount = 1
  $savedHeader.Margin = [Windows.Forms.Padding]::new(0, 0, 0, 10)
  [void]$savedHeader.ColumnStyles.Add(
    [Windows.Forms.ColumnStyle]::new([Windows.Forms.SizeType]::Percent, 100))
  [void]$savedHeader.ColumnStyles.Add(
    [Windows.Forms.ColumnStyle]::new([Windows.Forms.SizeType]::AutoSize))
  $script:PromptShelfSavedLabel = [Windows.Forms.Label]::new()
  $script:PromptShelfSavedLabel.Name = 'PromptShelfSavedLabel'
  $script:PromptShelfSavedLabel.AutoSize = $true
  $script:PromptShelfSavedLabel.Font = [Drawing.Font]::new('Segoe UI Semibold', 9)
  $script:PromptShelfSavedLabel.Anchor = [Windows.Forms.AnchorStyles]::Left
  $script:PromptShelfSavedLabel.Margin = [Windows.Forms.Padding]::new(0)
  $script:PromptShelfSavedCountLabel = [Windows.Forms.Label]::new()
  $script:PromptShelfSavedCountLabel.Name = 'PromptShelfSavedCountLabel'
  $script:PromptShelfSavedCountLabel.AutoSize = $true
  $script:PromptShelfSavedCountLabel.Anchor = [Windows.Forms.AnchorStyles]::Right
  $script:PromptShelfSavedCountLabel.Padding = [Windows.Forms.Padding]::new(8, 3, 8, 3)
  $script:PromptShelfSavedCountLabel.Margin = [Windows.Forms.Padding]::new(8, 0, 0, 0)
  [void]$savedHeader.Controls.Add($script:PromptShelfSavedLabel, 0, 0)
  [void]$savedHeader.Controls.Add($script:PromptShelfSavedCountLabel, 1, 0)

  $script:PromptShelfListFrame = [Windows.Forms.Panel]::new()
  $script:PromptShelfListFrame.Name = 'PromptShelfListFrame'
  $script:PromptShelfListFrame.Dock = [Windows.Forms.DockStyle]::Fill
  $script:PromptShelfListFrame.MinimumSize = [Drawing.Size]::new(0, 58)
  $script:PromptShelfListFrame.Padding = [Windows.Forms.Padding]::new(1)
  $script:PromptShelfListFrame.Margin = [Windows.Forms.Padding]::new(0)
  $script:PromptShelfList = [Windows.Forms.ListBox]::new()
  $script:PromptShelfList.Name = 'PromptShelfList'
  $script:PromptShelfList.Dock = [Windows.Forms.DockStyle]::Fill
  $script:PromptShelfList.BorderStyle = [Windows.Forms.BorderStyle]::None
  $script:PromptShelfList.DrawMode = [Windows.Forms.DrawMode]::OwnerDrawFixed
  $script:PromptShelfList.ItemHeight = 56
  $script:PromptShelfList.Font = [Drawing.Font]::new('Segoe UI Semibold', 9)
  $script:PromptShelfList.HorizontalScrollbar = $false
  $script:PromptShelfList.IntegralHeight = $false
  $script:PromptShelfList.SelectionMode = [Windows.Forms.SelectionMode]::One
  $script:PromptShelfList.AccessibleRole = [Windows.Forms.AccessibleRole]::List
  $script:PromptShelfList.TabIndex = 4
  $script:PromptShelfList.add_SelectedIndexChanged({ Update-AuraPromptShelfActions })
  $script:PromptShelfList.add_DoubleClick({ Invoke-AuraPromptShelfEdit })
  $script:PromptShelfList.add_DrawItem({
    param($sender, $eventArgs)
    Draw-AuraPromptShelfListItem -Sender $sender -EventArgs $eventArgs
  })
  $script:PromptShelfEmptyPanel = [Windows.Forms.Panel]::new()
  $script:PromptShelfEmptyPanel.Name = 'PromptShelfEmptyPanel'
  $script:PromptShelfEmptyPanel.Dock = [Windows.Forms.DockStyle]::Fill
  $script:PromptShelfEmptyPanel.TabStop = $false
  $script:PromptShelfEmptyContent = [Windows.Forms.TableLayoutPanel]::new()
  $script:PromptShelfEmptyContent.Name = 'PromptShelfEmptyContent'
  $script:PromptShelfEmptyContent.Dock = [Windows.Forms.DockStyle]::Fill
  $script:PromptShelfEmptyContent.ColumnCount = 1
  $script:PromptShelfEmptyContent.RowCount = 4
  [void]$script:PromptShelfEmptyContent.ColumnStyles.Add(
    [Windows.Forms.ColumnStyle]::new([Windows.Forms.SizeType]::Percent, 100))
  [void]$script:PromptShelfEmptyContent.RowStyles.Add(
    [Windows.Forms.RowStyle]::new([Windows.Forms.SizeType]::Percent, 50))
  [void]$script:PromptShelfEmptyContent.RowStyles.Add(
    [Windows.Forms.RowStyle]::new([Windows.Forms.SizeType]::AutoSize))
  [void]$script:PromptShelfEmptyContent.RowStyles.Add(
    [Windows.Forms.RowStyle]::new([Windows.Forms.SizeType]::AutoSize))
  [void]$script:PromptShelfEmptyContent.RowStyles.Add(
    [Windows.Forms.RowStyle]::new([Windows.Forms.SizeType]::Percent, 50))
  $script:PromptShelfEmptyLabel = [Windows.Forms.Label]::new()
  $script:PromptShelfEmptyLabel.Name = 'PromptShelfEmptyLabel'
  $script:PromptShelfEmptyLabel.Dock = [Windows.Forms.DockStyle]::Fill
  $script:PromptShelfEmptyLabel.AutoSize = $true
  $script:PromptShelfEmptyLabel.Font = [Drawing.Font]::new('Segoe UI Semibold', 10)
  $script:PromptShelfEmptyLabel.TextAlign = [Drawing.ContentAlignment]::MiddleCenter
  $script:PromptShelfEmptyLabel.Margin = [Windows.Forms.Padding]::new(0, 0, 0, 4)
  $script:PromptShelfEmptyLabel.TabStop = $false
  $script:PromptShelfEmptyHelperLabel = [Windows.Forms.Label]::new()
  $script:PromptShelfEmptyHelperLabel.Name = 'PromptShelfEmptyHelperLabel'
  $script:PromptShelfEmptyHelperLabel.Dock = [Windows.Forms.DockStyle]::Fill
  $script:PromptShelfEmptyHelperLabel.AutoSize = $true
  $script:PromptShelfEmptyHelperLabel.TextAlign = [Drawing.ContentAlignment]::MiddleCenter
  $script:PromptShelfEmptyHelperLabel.Margin = [Windows.Forms.Padding]::new(16, 0, 16, 0)
  $script:PromptShelfEmptyHelperLabel.TabStop = $false
  [void]$script:PromptShelfEmptyContent.Controls.Add($script:PromptShelfEmptyLabel, 0, 1)
  [void]$script:PromptShelfEmptyContent.Controls.Add($script:PromptShelfEmptyHelperLabel, 0, 2)
  [void]$script:PromptShelfEmptyPanel.Controls.Add($script:PromptShelfEmptyContent)
  [void]$script:PromptShelfListFrame.Controls.Add($script:PromptShelfList)
  [void]$script:PromptShelfListFrame.Controls.Add($script:PromptShelfEmptyPanel)

  $itemActions = [Windows.Forms.TableLayoutPanel]::new()
  $itemActions.Name = 'PromptShelfItemActions'
  $itemActions.AutoSize = $false
  $itemActions.MinimumSize = [Drawing.Size]::new(0, 36)
  $itemActions.Dock = [Windows.Forms.DockStyle]::Fill
  $itemActions.ColumnCount = 2
  $itemActions.RowCount = 1
  $itemActions.Margin = [Windows.Forms.Padding]::new(0, 10, 0, 0)
  [void]$itemActions.ColumnStyles.Add(
    [Windows.Forms.ColumnStyle]::new([Windows.Forms.SizeType]::Percent, 100))
  [void]$itemActions.ColumnStyles.Add(
    [Windows.Forms.ColumnStyle]::new([Windows.Forms.SizeType]::AutoSize))
  $itemUtilities = [Windows.Forms.FlowLayoutPanel]::new()
  $itemUtilities.Name = 'PromptShelfItemUtilities'
  $itemUtilities.AutoSize = $true
  $itemUtilities.WrapContents = $true
  $itemUtilities.Dock = [Windows.Forms.DockStyle]::Fill
  $itemUtilities.Margin = [Windows.Forms.Padding]::new(0)
  $script:PromptShelfEditButton = New-AuraPromptShelfButton -TabIndex 5
  $script:PromptShelfMoveUpButton = New-AuraPromptShelfButton -TabIndex 6 -Compact
  $script:PromptShelfMoveDownButton = New-AuraPromptShelfButton -TabIndex 7 -Compact
  $script:PromptShelfDeleteButton = New-AuraPromptShelfButton -TabIndex 8
  $script:PromptShelfInsertButton = New-AuraPromptShelfButton -TabIndex 9
  foreach ($utilityButton in @($script:PromptShelfEditButton, $script:PromptShelfDeleteButton)) {
    $utilityButton.MinimumSize = [Drawing.Size]::new(68, 36)
    $utilityButton.Padding = [Windows.Forms.Padding]::new(8, 2, 8, 2)
  }
  $script:PromptShelfEditButton.Name = 'PromptShelfEditButton'
  $script:PromptShelfMoveUpButton.Name = 'PromptShelfMoveUpButton'
  $script:PromptShelfMoveDownButton.Name = 'PromptShelfMoveDownButton'
  $script:PromptShelfDeleteButton.Name = 'PromptShelfDeleteButton'
  $script:PromptShelfInsertButton.Name = 'PromptShelfInsertButton'
  $script:PromptShelfInsertButton.Margin = [Windows.Forms.Padding]::new(12, 0, 0, 0)
  $script:PromptShelfEditButton.add_Click({ Invoke-AuraPromptShelfEdit })
  $script:PromptShelfMoveUpButton.add_Click({ Invoke-AuraPromptShelfMove -Delta -1 })
  $script:PromptShelfMoveDownButton.add_Click({ Invoke-AuraPromptShelfMove -Delta 1 })
  $script:PromptShelfDeleteButton.add_Click({ Invoke-AuraPromptShelfDelete })
  $script:PromptShelfInsertButton.add_Click({ Invoke-AuraPromptShelfInsertSelected })
  [void]$itemUtilities.Controls.AddRange(@(
    $script:PromptShelfEditButton,
    $script:PromptShelfMoveUpButton,
    $script:PromptShelfMoveDownButton,
    $script:PromptShelfDeleteButton
  ))
  [void]$itemActions.Controls.Add($itemUtilities, 0, 0)
  [void]$itemActions.Controls.Add($script:PromptShelfInsertButton, 1, 0)
  [void]$script:PromptShelfSavedCardContent.Controls.Add($savedHeader, 0, 0)
  [void]$script:PromptShelfSavedCardContent.Controls.Add($script:PromptShelfListFrame, 0, 1)
  [void]$script:PromptShelfSavedCardContent.Controls.Add($itemActions, 0, 2)

  $script:PromptShelfStatusPanel = [Windows.Forms.TableLayoutPanel]::new()
  $script:PromptShelfStatusPanel.Name = 'PromptShelfStatusPanel'
  $script:PromptShelfStatusPanel.AutoSize = $true
  $script:PromptShelfStatusPanel.Dock = [Windows.Forms.DockStyle]::Fill
  $script:PromptShelfStatusPanel.ColumnCount = 2
  $script:PromptShelfStatusPanel.RowCount = 1
  $script:PromptShelfStatusPanel.Margin = [Windows.Forms.Padding]::new(0)
  [void]$script:PromptShelfStatusPanel.ColumnStyles.Add(
    [Windows.Forms.ColumnStyle]::new([Windows.Forms.SizeType]::Percent, 100))
  [void]$script:PromptShelfStatusPanel.ColumnStyles.Add(
    [Windows.Forms.ColumnStyle]::new([Windows.Forms.SizeType]::AutoSize))

  $script:PromptShelfStatusLabel = [Windows.Forms.Label]::new()
  $script:PromptShelfStatusLabel.Name = 'PromptShelfStatusLabel'
  $script:PromptShelfStatusLabel.AutoSize = $true
  $script:PromptShelfStatusLabel.Dock = [Windows.Forms.DockStyle]::Fill
  $script:PromptShelfStatusLabel.Margin = [Windows.Forms.Padding]::new(0)
  $script:PromptShelfStatusLabel.AccessibleRole = [Windows.Forms.AccessibleRole]::StaticText
  if ($null -ne $script:PromptShelfStatusLabel.PSObject.Properties['LiveSetting']) {
    $script:PromptShelfStatusLabel.LiveSetting = (
      [Windows.Forms.Automation.AutomationLiveSetting]::Polite)
  }
  $script:PromptShelfResolveButton = New-AuraPromptShelfButton -TabIndex 10 -Compact
  $script:PromptShelfResolveButton.Name = 'PromptShelfResolveButton'
  $script:PromptShelfResolveButton.Margin = [Windows.Forms.Padding]::new(12, 0, 0, 0)
  $script:PromptShelfResolveButton.Visible = $false
  $script:PromptShelfResolveButton.add_Click({ Confirm-AuraPromptShelfComposerChecked })
  [void]$script:PromptShelfStatusPanel.Controls.Add($script:PromptShelfStatusLabel, 0, 0)
  [void]$script:PromptShelfStatusPanel.Controls.Add($script:PromptShelfResolveButton, 1, 0)

  [void]$script:PromptShelfRoot.Controls.Add($script:PromptShelfHeader, 0, 0)
  [void]$script:PromptShelfRoot.Controls.Add($script:PromptShelfDraftCard, 0, 1)
  [void]$script:PromptShelfRoot.Controls.Add($script:PromptShelfSavedCard, 0, 2)
  [void]$script:PromptShelfRoot.Controls.Add($script:PromptShelfStatusPanel, 0, 3)
  [void]$script:PromptShelfForm.Controls.Add($script:PromptShelfRoot)

  $script:PromptShelfToolTip = [Windows.Forms.ToolTip]::new()
  $script:PromptShelfToolTip.AutoPopDelay = 7000
  $script:PromptShelfToolTip.InitialDelay = 450
  $script:PromptShelfToolTip.ReshowDelay = 100
  Update-AuraPromptShelfCopy
  Update-AuraPromptShelfTheme
  Update-AuraPromptShelfList
  Update-AuraPromptShelfResponsiveLayout
}

function Show-AuraPromptShelf {
  if (-not (Get-AuraUiEnabled)) { return }
  New-AuraPromptShelfForm
  Update-AuraPromptShelfCopy
  Update-AuraPromptShelfTheme

  $context = Get-AuraPromptShelfAnchorContext -HostForm $script:Form
  if (-not $script:PromptShelfForm.IsHandleCreated) {
    # Create the native window on the launcher's monitor before measuring it.
    # Per-monitor DPI scaling happens during handle creation, so clamping the
    # pre-handle logical size would still allow a scaled form off screen.
    $script:PromptShelfForm.Location = [Drawing.Point]::new(
      [Math]::Max($context.WorkingArea.Left, $context.AnchorX - $script:PromptShelfForm.Width),
      $context.WorkingArea.Top + 12)
    [void]$script:PromptShelfForm.Handle
    Update-AuraPromptShelfResponsiveLayout
  }
  Set-AuraPromptShelfBounds -HostForm $script:Form
  if (-not $script:PromptShelfForm.Visible) {
    $script:PromptShelfForm.Show($script:Form)
  } else {
    $script:PromptShelfForm.BringToFront()
  }
  [void]$script:PromptShelfForm.Activate()
  [void]$script:PromptShelfDraftBox.Focus()
}

function Dispose-AuraPromptShelf {
  param([switch]$Final)
  if ($Final -and (Get-Command Dispose-AuraDraftHandoffTransient -ErrorAction SilentlyContinue)) {
    Dispose-AuraDraftHandoffTransient -Reason 'host-stopped'
  }
  if ($Final) {
    $script:PromptShelfInsertOperation = $null
  }
  if ($Final) {
    Stop-AuraPromptShelfInsertTimeouts
    foreach ($timer in @(
        $script:PromptShelfInsertTimeout,
        $script:PromptShelfInsertUncertainTimeout
      )) {
      if ($null -ne $timer) {
        try { $timer.Dispose() } catch {}
      }
    }
    $script:PromptShelfInsertTimeout = $null
    $script:PromptShelfInsertUncertainTimeout = $null
  }
  if ($null -ne $script:PromptShelfForm -and -not $script:PromptShelfForm.IsDisposed) {
    $script:PromptShelfDisposing = $true
    try {
      $script:PromptShelfForm.Close()
      $script:PromptShelfForm.Dispose()
    } catch {}
    $script:PromptShelfDisposing = $false
  }
  if ($null -ne $script:PromptShelfToolTip) {
    try { $script:PromptShelfToolTip.Dispose() } catch {}
  }
  if ($null -ne $script:PromptShelfIconWindow) {
    try { $script:PromptShelfIconWindow.Dispose() } catch {}
  }
  $script:PromptShelfIconWindow = $null
  $script:PromptShelfToolTip = $null
  $script:PromptShelfProfile = $null
  $script:PromptShelfForm = $null
  $script:PromptShelfEditingId = $null
  foreach ($name in @(
      'PromptShelfRoot', 'PromptShelfStatusPanel', 'PromptShelfStatusLabel',
      'PromptShelfResolveButton', 'PromptShelfDraftBox', 'PromptShelfList',
      'PromptShelfAddButton', 'PromptShelfCancelButton', 'PromptShelfInsertNowButton',
      'PromptShelfEditButton', 'PromptShelfMoveUpButton', 'PromptShelfMoveDownButton',
      'PromptShelfDeleteButton', 'PromptShelfInsertButton'
    )) {
    Set-Variable -Scope Script -Name $name -Value $null
  }
}

function Set-AuraPromptShelfAvailability {
  param([Parameter(Mandatory = $true)][bool]$Enabled)
  if ($null -ne $script:LauncherActionQueueItem -and -not $script:LauncherActionQueueItem.IsDisposed) {
    $script:LauncherActionQueueItem.Visible = $Enabled
    $script:LauncherActionQueueItem.Enabled = $Enabled
  }
  if (-not $Enabled) { Dispose-AuraPromptShelf }
  Send-AuraPromptShelfStudioChanged
}

# Secure or migrate saved drafts as soon as Aura starts. A previous plaintext
# store must not remain broadly inherited until the user happens to open Shelf.
Initialize-AuraPromptShelfPersistence
