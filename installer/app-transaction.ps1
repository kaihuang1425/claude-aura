[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('prepare', 'commit', 'rollback', 'recover')]
  [string]$Mode,
  [string]$SourceRoot,
  [string]$TransactionId,
  [string]$TargetVersion
)

$ErrorActionPreference = 'Stop'
$productRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'ClaudeAura'))
$installRoot = [IO.Path]::GetFullPath((Join-Path $productRoot 'app'))
$journalPath = [IO.Path]::GetFullPath((Join-Path $productRoot '.native-install-transaction.json'))
$finalizedPath = [IO.Path]::GetFullPath((Join-Path $productRoot '.native-install-finalized'))
$separator = [IO.Path]::DirectorySeparatorChar
$uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{49DD4496-1ABF-5202-B127-3D7E919318C5}_is1'
$transactionRegistryValue = 'ClaudeAuraTransactionId'

function Get-AuraFullPath {
  param([Parameter(Mandatory = $true)][string]$Path)
  return [IO.Path]::GetFullPath($Path).TrimEnd(
    [IO.Path]::DirectorySeparatorChar,
    [IO.Path]::AltDirectorySeparatorChar)
}

function Test-AuraPathWithin {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$Path
  )
  $rootFull = Get-AuraFullPath -Path $Root
  $pathFull = Get-AuraFullPath -Path $Path
  return $pathFull.StartsWith("$rootFull$separator", [StringComparison]::OrdinalIgnoreCase)
}

function Assert-AuraItemIsNotReparsePoint {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$Path
  )
  $rootFull = Get-AuraFullPath -Path $Root
  $pathFull = Get-AuraFullPath -Path $Path
  if (-not [string]::Equals($rootFull, $pathFull, [StringComparison]::OrdinalIgnoreCase) -and
      -not (Test-AuraPathWithin -Root $rootFull -Path $pathFull)) {
    throw "Claude Aura transaction path escaped its validated root: $pathFull"
  }
  if (-not (Test-Path -LiteralPath $pathFull)) { return }
  $item = Get-Item -LiteralPath $pathFull -Force
  if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "Claude Aura transaction refused a reparse point: $pathFull"
  }
}

function Assert-AuraTreeHasNoReparsePoints {
  param([Parameter(Mandatory = $true)][string]$Root)
  $rootFull = Get-AuraFullPath -Path $Root
  if (-not (Test-Path -LiteralPath $rootFull -PathType Container)) {
    throw "Claude Aura transaction tree is missing: $rootFull"
  }
  Assert-AuraItemIsNotReparsePoint -Root $rootFull -Path $rootFull
  $pending = [Collections.Generic.Stack[string]]::new()
  $pending.Push($rootFull)
  while ($pending.Count -gt 0) {
    $directory = $pending.Pop()
    foreach ($entry in @(Get-ChildItem -LiteralPath $directory -Force)) {
      $entryPath = Get-AuraFullPath -Path $entry.FullName
      if (-not (Test-AuraPathWithin -Root $rootFull -Path $entryPath)) {
        throw "Claude Aura transaction entry escaped its tree: $entryPath"
      }
      if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Claude Aura transaction refused a reparse point: $entryPath"
      }
      if ($entry.PSIsContainer) { $pending.Push($entryPath) }
    }
  }
}

function Assert-AuraProductRoot {
  $expected = Get-AuraFullPath -Path (Join-Path $env:LOCALAPPDATA 'ClaudeAura')
  if (-not [string]::Equals($expected, $productRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Claude Aura product root did not resolve exactly: $productRoot"
  }
  if (Test-Path -LiteralPath $productRoot) {
    if (-not (Test-Path -LiteralPath $productRoot -PathType Container)) {
      throw "Claude Aura product root is not a directory: $productRoot"
    }
    Assert-AuraItemIsNotReparsePoint -Root $productRoot -Path $productRoot
  } else {
    New-Item -ItemType Directory -Path $productRoot | Out-Null
    Assert-AuraItemIsNotReparsePoint -Root $productRoot -Path $productRoot
  }
}

function Assert-AuraManagedAppPath {
  param([Parameter(Mandatory = $true)][string]$Path)
  $pathFull = Get-AuraFullPath -Path $Path
  if (-not (Test-AuraPathWithin -Root $productRoot -Path $pathFull) -or
      -not [string]::Equals((Split-Path $pathFull -Parent), $productRoot,
        [StringComparison]::OrdinalIgnoreCase)) {
    throw "Claude Aura transaction refused an app-tree path outside its product root: $pathFull"
  }
  $name = Split-Path $pathFull -Leaf
  if ($name -cne 'app' -and
      $name -cnotmatch '^\.app-native-(?:stage|backup|rollback)-[0-9a-f]{32}$') {
    throw "Claude Aura transaction refused an unmanaged app-tree path: $pathFull"
  }
}

function Remove-AuraManagedTree {
  param([Parameter(Mandatory = $true)][string]$Path)
  Assert-AuraManagedAppPath -Path $Path
  if (-not (Test-Path -LiteralPath $Path)) { return }
  Assert-AuraTreeHasNoReparsePoints -Root $Path
  Remove-Item -LiteralPath $Path -Recurse -Force
}

function Move-AuraManagedTree {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination
  )
  Assert-AuraManagedAppPath -Path $Source
  Assert-AuraManagedAppPath -Path $Destination
  if (Test-Path -LiteralPath $Destination) {
    throw "Claude Aura transaction destination already exists: $Destination"
  }
  Assert-AuraTreeHasNoReparsePoints -Root $Source
  Move-Item -LiteralPath $Source -Destination $Destination
}

function Write-AuraAtomicText {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text
  )
  $pathFull = Get-AuraFullPath -Path $Path
  if (-not [string]::Equals((Split-Path $pathFull -Parent), $productRoot,
      [StringComparison]::OrdinalIgnoreCase)) {
    throw "Claude Aura transaction refused an atomic write outside its product root: $pathFull"
  }
  $temporary = Join-Path $productRoot ".native-install-write-$([Guid]::NewGuid().ToString('N')).tmp"
  $displaced = Join-Path $productRoot ".native-install-displaced-$([Guid]::NewGuid().ToString('N')).tmp"
  try {
    [IO.File]::WriteAllText($temporary, $Text, [Text.UTF8Encoding]::new($false))
    Assert-AuraItemIsNotReparsePoint -Root $productRoot -Path $temporary
    if (Test-Path -LiteralPath $pathFull -PathType Leaf) {
      [IO.File]::Replace($temporary, $pathFull, $displaced, $true)
    } else {
      Move-Item -LiteralPath $temporary -Destination $pathFull
    }
  } finally {
    foreach ($candidate in @($temporary, $displaced)) {
      if (Test-Path -LiteralPath $candidate -PathType Leaf) {
        Assert-AuraItemIsNotReparsePoint -Root $productRoot -Path $candidate
        Remove-Item -LiteralPath $candidate -Force
      }
    }
  }
}

function Write-AuraJournal {
  param([Parameter(Mandatory = $true)][object]$Journal)
  $json = $Journal | ConvertTo-Json -Compress
  Write-AuraAtomicText -Path $journalPath -Text $json
}

function Read-AuraJournal {
  if (-not (Test-Path -LiteralPath $journalPath -PathType Leaf)) { return $null }
  Assert-AuraItemIsNotReparsePoint -Root $productRoot -Path $journalPath
  $journal = [IO.File]::ReadAllText($journalPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
  $properties = @($journal.PSObject.Properties.Name | Sort-Object)
  $expected = @(
    'backupName',
    'hadPreviousApp',
    'schemaVersion',
    'stageName',
    'state',
    'targetVersion',
    'transactionId'
  ) | Sort-Object
  if (($properties -join "`n") -cne ($expected -join "`n") -or
      $journal.schemaVersion -ne 1 -or
      $journal.transactionId -isnot [string] -or
      $journal.transactionId -cnotmatch '^[0-9a-f]{32}$' -or
      $journal.state -notin @(
        'preparing',
        'prepared',
        'rollingBack',
        'rolledBack',
        'committed'
      ) -or
      $journal.hadPreviousApp -isnot [bool] -or
      $journal.targetVersion -isnot [string] -or
      $journal.targetVersion -cnotmatch '^\d+\.\d+\.\d+(?:\.\d+)?$' -or
      $journal.stageName -cne ".app-native-stage-$($journal.transactionId)" -or
      $journal.backupName -cne ".app-native-backup-$($journal.transactionId)") {
    throw 'Claude Aura found an invalid native installer transaction journal.'
  }
  return $journal
}

function Remove-AuraJournalFile {
  if (Test-Path -LiteralPath $journalPath) {
    Assert-AuraItemIsNotReparsePoint -Root $productRoot -Path $journalPath
    Remove-Item -LiteralPath $journalPath -Force
  }
  if (Test-Path -LiteralPath $finalizedPath) {
    Assert-AuraItemIsNotReparsePoint -Root $productRoot -Path $finalizedPath
    Remove-Item -LiteralPath $finalizedPath -Force
  }
}

function Test-AuraTransactionFinalized {
  param([Parameter(Mandatory = $true)][object]$Journal)
  if (Test-Path -LiteralPath $finalizedPath -PathType Leaf) {
    Assert-AuraItemIsNotReparsePoint -Root $productRoot -Path $finalizedPath
    $marker = [IO.File]::ReadAllText($finalizedPath, [Text.Encoding]::UTF8).Trim()
    if ($marker -ceq $Journal.transactionId) { return $true }
  }
  try {
    $registration = Get-ItemProperty -LiteralPath $uninstallKey -ErrorAction Stop
    $uninstallMatch = [regex]::Match(
      [string]$registration.UninstallString,
      '^\s*"(?<path>[^"]+)"\s*$')
    if (-not $uninstallMatch.Success) { return $false }
    $registeredUninstaller = [IO.Path]::GetFullPath(
      $uninstallMatch.Groups['path'].Value)
    $expectedUninstallRoot = [IO.Path]::GetFullPath(
      (Join-Path $productRoot 'installer'))
    $transactionProperty = $registration.PSObject.Properties[$transactionRegistryValue]
    return [string]::Equals(
        (Split-Path $registeredUninstaller -Parent),
        $expectedUninstallRoot,
        [StringComparison]::OrdinalIgnoreCase) -and
      $null -ne $transactionProperty -and
      $transactionProperty.Value -is [string] -and
      [string]::Equals(
        [string]$transactionProperty.Value,
        [string]$Journal.transactionId,
        [StringComparison]::Ordinal)
  } catch {
    return $false
  }
}

function Complete-AuraCommit {
  param([Parameter(Mandatory = $true)][object]$Journal)
  if ($Journal.state -cne 'committed') {
    $Journal.state = 'committed'
    Write-AuraJournal -Journal $Journal
  }
  $backupRoot = Join-Path $productRoot $Journal.backupName
  $stageRoot = Join-Path $productRoot $Journal.stageName
  $cleanupSucceeded = $true
  foreach ($candidate in @($backupRoot, $stageRoot)) {
    try {
      Remove-AuraManagedTree -Path $candidate
    } catch {
      $cleanupSucceeded = $false
      Write-Warning "Claude Aura committed the new app, but cleanup is pending for ${candidate}: $($_.Exception.Message)"
    }
  }
  if ($cleanupSucceeded) { Remove-AuraJournalFile }
}

function Restore-AuraTransaction {
  param([Parameter(Mandatory = $true)][object]$Journal)
  if ($Journal.state -ceq 'committed' -or
      ($Journal.state -in @('preparing', 'prepared') -and
        (Test-AuraTransactionFinalized -Journal $Journal))) {
    Complete-AuraCommit -Journal $Journal
    return
  }

  $backupRoot = Join-Path $productRoot $Journal.backupName
  $stageRoot = Join-Path $productRoot $Journal.stageName
  $rollbackRoot = Join-Path $productRoot ".app-native-rollback-$($Journal.transactionId)"
  if ($Journal.state -notin @('rollingBack', 'rolledBack')) {
    $Journal.state = 'rollingBack'
    Write-AuraJournal -Journal $Journal
  }

  if ([bool]$Journal.hadPreviousApp) {
    if ($Journal.state -cne 'rolledBack') {
      $backupExists = Test-Path -LiteralPath $backupRoot -PathType Container
      $appExists = Test-Path -LiteralPath $installRoot -PathType Container
      $rollbackExists = Test-Path -LiteralPath $rollbackRoot -PathType Container
      if ($backupExists) {
        if ($appExists -and $rollbackExists) {
          throw 'Claude Aura found both the active and displaced app during rollback.'
        }
        if ($appExists) {
          Move-AuraManagedTree -Source $installRoot -Destination $rollbackRoot
          $rollbackExists = $true
          $appExists = $false
        }
        if (-not $appExists) {
          Move-AuraManagedTree -Source $backupRoot -Destination $installRoot
          $appExists = $true
          $backupExists = $false
        }
      } elseif (-not $appExists) {
        throw 'Claude Aura could not find the prior app backup required for rollback.'
      }
      if (-not $appExists) {
        throw 'Claude Aura could not restore the prior app during rollback.'
      }
      $Journal.state = 'rolledBack'
      Write-AuraJournal -Journal $Journal
    }
    if (-not (Test-Path -LiteralPath $installRoot -PathType Container)) {
      throw 'Claude Aura could not verify the restored prior app.'
    }
  } else {
    if ($Journal.state -cne 'rolledBack') {
      Remove-AuraManagedTree -Path $installRoot
      $Journal.state = 'rolledBack'
      Write-AuraJournal -Journal $Journal
    }
    if (Test-Path -LiteralPath $installRoot) {
      throw 'Claude Aura could not verify rollback of the first install.'
    }
  }
  if (Test-Path -LiteralPath $backupRoot) {
    throw 'Claude Aura kept the prior app backup because rollback could not be proven complete.'
  }
  Remove-AuraManagedTree -Path $stageRoot
  Remove-AuraManagedTree -Path $rollbackRoot
  Remove-AuraJournalFile
}

function Copy-AuraVerifiedTree {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination
  )
  $sourceFull = Get-AuraFullPath -Path $Source
  Assert-AuraTreeHasNoReparsePoints -Root $sourceFull
  Assert-AuraManagedAppPath -Path $Destination
  if (Test-Path -LiteralPath $Destination) {
    throw "Claude Aura staging destination already exists: $Destination"
  }
  New-Item -ItemType Directory -Path $Destination | Out-Null
  $sourcePrefix = "$sourceFull$separator"
  $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  $sourceFiles = @(Get-ChildItem -LiteralPath $sourceFull -Recurse -Force -File | Sort-Object FullName)
  if ($sourceFiles.Count -eq 0) { throw 'Claude Aura installer payload is empty.' }
  foreach ($sourceFile in $sourceFiles) {
    Assert-AuraItemIsNotReparsePoint -Root $sourceFull -Path $sourceFile.FullName
    $relative = (Get-AuraFullPath -Path $sourceFile.FullName).Substring($sourcePrefix.Length)
    if (-not $relative -or $relative -match '(^|[\\/])\.\.?([\\/]|$)' -or
        -not $seen.Add($relative)) {
      throw "Claude Aura installer payload contains an unsafe path: $relative"
    }
    $destinationPath = Get-AuraFullPath -Path (Join-Path $Destination $relative)
    if (-not (Test-AuraPathWithin -Root $Destination -Path $destinationPath)) {
      throw "Claude Aura staged file escaped its destination: $relative"
    }
    $destinationDirectory = Split-Path $destinationPath -Parent
    New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
    Assert-AuraItemIsNotReparsePoint -Root $Destination -Path $destinationDirectory
    Copy-Item -LiteralPath $sourceFile.FullName -Destination $destinationPath
    $sourceHash = (Get-FileHash -LiteralPath $sourceFile.FullName -Algorithm SHA256).Hash
    $destinationHash = (Get-FileHash -LiteralPath $destinationPath -Algorithm SHA256).Hash
    if ($sourceFile.Length -ne (Get-Item -LiteralPath $destinationPath).Length -or
        $sourceHash -cne $destinationHash) {
      throw "Claude Aura staged file verification failed: $relative"
    }
  }
  Assert-AuraTreeHasNoReparsePoints -Root $Destination
  $stagedFiles = @(Get-ChildItem -LiteralPath $Destination -Recurse -Force -File)
  if ($stagedFiles.Count -ne $sourceFiles.Count) {
    throw 'Claude Aura staged app tree is incomplete.'
  }
}

function Enter-AuraTransactionLock {
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $mutex = [Threading.Mutex]::new($false, "Local\ClaudeAura.$sid.Operation")
  $acquired = $false
  try {
    $acquired = $mutex.WaitOne(0)
  } catch [Threading.AbandonedMutexException] {
    $acquired = $true
  }
  if (-not $acquired) {
    $mutex.Dispose()
    throw 'Another Claude Aura install or check is already running.'
  }
  return $mutex
}

function Exit-AuraTransactionLock {
  param([Parameter(Mandatory = $true)][Threading.Mutex]$Mutex)
  try { $Mutex.ReleaseMutex() } finally { $Mutex.Dispose() }
}

function Test-AuraUiHostRunning {
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $probe = $null
  try {
    $probe = [Threading.Mutex]::OpenExisting("Local\ClaudeAura.$sid.Ui")
    return $true
  } catch [Threading.WaitHandleCannotBeOpenedException] {
    return $false
  } finally {
    if ($null -ne $probe) { $probe.Dispose() }
  }
}

function Invoke-AuraTransaction {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('prepare', 'commit', 'rollback', 'recover')]
    [string]$Mode,
    [string]$SourceRoot,
    [string]$TransactionId,
    [string]$TargetVersion
  )

if ($Mode -eq 'prepare') {
  if (-not $SourceRoot -or -not $TargetVersion -or
      $TargetVersion -cnotmatch '^\d+\.\d+\.\d+(?:\.\d+)?$' -or $TransactionId) {
    throw 'Native prepare requires SourceRoot and TargetVersion only.'
  }
} elseif ($Mode -in @('commit', 'rollback')) {
  if ($SourceRoot -or $TargetVersion -or
      $TransactionId -cnotmatch '^[0-9a-f]{32}$') {
    throw "Native $Mode requires one 32-character transaction id."
  }
} elseif ($SourceRoot -or $TargetVersion -or $TransactionId) {
  throw 'Native recovery does not accept additional arguments.'
}

Assert-AuraProductRoot
$operationLock = Enter-AuraTransactionLock
try {
  if ($Mode -in @('prepare', 'recover') -and (Test-AuraUiHostRunning)) {
    throw 'Exit Claude Aura from its window or tray before installing or repairing it.'
  }
  $existing = Read-AuraJournal
  if ($Mode -eq 'recover') {
    if ($null -ne $existing) { Restore-AuraTransaction -Journal $existing }
    return
  }
  if ($Mode -eq 'commit') {
    if ($null -eq $existing) { return }
    if ($existing.transactionId -cne $TransactionId) {
      throw 'Claude Aura refused to commit a different installer transaction.'
    }
    Complete-AuraCommit -Journal $existing
    return
  }
  if ($Mode -eq 'rollback') {
    if ($null -eq $existing) { return }
    if ($existing.transactionId -cne $TransactionId) {
      throw 'Claude Aura refused to roll back a different installer transaction.'
    }
    Restore-AuraTransaction -Journal $existing
    return
  }

  if ($null -ne $existing) { Restore-AuraTransaction -Journal $existing }
  $sourceFull = Get-AuraFullPath -Path $SourceRoot
  if ([string]::Equals($sourceFull, $installRoot, [StringComparison]::OrdinalIgnoreCase) -or
      [string]::Equals($sourceFull, $productRoot, [StringComparison]::OrdinalIgnoreCase) -or
      (Test-AuraPathWithin -Root $productRoot -Path $sourceFull)) {
    throw 'Claude Aura refused an installer payload inside its managed product root.'
  }
  $id = [Guid]::NewGuid().ToString('N')
  $stageRoot = Join-Path $productRoot ".app-native-stage-$id"
  $backupRoot = Join-Path $productRoot ".app-native-backup-$id"
  $hadPreviousApp = Test-Path -LiteralPath $installRoot -PathType Container
  if ((Test-Path -LiteralPath $installRoot) -and -not $hadPreviousApp) {
    throw "Claude Aura app path is not a directory: $installRoot"
  }
  if ($hadPreviousApp) { Assert-AuraTreeHasNoReparsePoints -Root $installRoot }

  $journal = [PSCustomObject][ordered]@{
    schemaVersion = 1
    transactionId = $id
    state = 'preparing'
    targetVersion = $TargetVersion
    hadPreviousApp = [bool]$hadPreviousApp
    stageName = (Split-Path $stageRoot -Leaf)
    backupName = (Split-Path $backupRoot -Leaf)
  }
  try {
    Write-AuraJournal -Journal $journal
    Copy-AuraVerifiedTree -Source $sourceFull -Destination $stageRoot
    if ($hadPreviousApp) {
      Move-AuraManagedTree -Source $installRoot -Destination $backupRoot
    }
    Move-AuraManagedTree -Source $stageRoot -Destination $installRoot
    $journal.state = 'prepared'
    Write-AuraJournal -Journal $journal
    Write-Output "AURA_INSTALL_TRANSACTION=$id"
  } catch {
    $pending = Read-AuraJournal
    if ($null -ne $pending -and $pending.transactionId -ceq $id) {
      Restore-AuraTransaction -Journal $pending
    } else {
      Remove-AuraManagedTree -Path $stageRoot
    }
    throw
  }
} finally {
  Exit-AuraTransactionLock -Mutex $operationLock
}
}

if ($MyInvocation.InvocationName -eq '.') { return }

Invoke-AuraTransaction -Mode $Mode -SourceRoot $SourceRoot `
  -TransactionId $TransactionId -TargetVersion $TargetVersion
