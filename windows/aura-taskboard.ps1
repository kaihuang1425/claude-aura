# Claude Aura Taskboard (WO-32)
#
# One encrypted local task document backs the Studio page and the owned
# Claude Desktop panel. Provider state is never inferred here.

$script:AuraTaskboardStoreRoot = Join-Path $DataRoot 'taskboard'
$script:AuraTaskboardStatePath = Join-Path $script:AuraTaskboardStoreRoot 'tasks.bin'
$script:AuraTaskboardStateMagic = [Text.Encoding]::ASCII.GetBytes("CLAUDE-AURA-TASKBOARD-1`n")
$script:AuraTaskboardEntropy = [Text.Encoding]::UTF8.GetBytes('ClaudeAura.Taskboard.v1')
$script:AuraTaskboardMaximumFileBytes = 2 * 1024 * 1024
$script:AuraTaskboardMaximumTasks = 1000
$script:AuraTaskboardMaximumActivity = 2000
$script:AuraTaskboardMaximumQueueItems = 200
$script:AuraTaskboardMaximumQueueReceipts = 2000
$script:AuraTaskboardMaximumTabs = 20
$script:AuraTaskboardLegacyMaximumTabs = 32
$script:AuraTaskboardLegacyWorkHubTabId = '00000000-0000-4000-8000-000000000001'
$script:AuraTaskboardSession = ''
$script:AuraTaskboardCommandEpoch = [long]0
$script:AuraTaskboardStatuses = @('todo', 'in-progress', 'needs-input', 'review', 'blocked', 'done')
$script:AuraTaskboardPriorities = @('urgent', 'high', 'normal', 'low', 'none')
$script:AuraTaskboardActivityKinds = @(
  'created', 'updated', 'status-changed', 'session-state-changed',
  'commented', 'accepted', 'deleted', 'opened')
$script:AuraTaskboardEvidenceKinds = @(
  'local', 'provider-observed', 'user-reported', 'user-accepted')
$script:AuraTaskboardSessionStates = @('unlinked', 'linked', 'active', 'terminated')
$script:AuraTaskboardSessionTerminationReasons = @('usage-limit')
$script:AuraTaskboardSessionEvidenceKinds = @('local', 'provider-observed', 'user-reported')
$script:AuraTaskboardQueueStatuses = @(
  'queued', 'awaiting_dispatch', 'awaiting_user_action', 'dispatched', 'accepted',
  'active', 'sent', 'completed', 'failed', 'cancelled', 'uncertain')
$script:AuraTaskboardReceiptStages = @(
  'local_enqueued', 'transport_written', 'draft_inserted', 'provider_accepted',
  'run_started', 'user_reported_sent', 'user_cancelled', 'completed')
$script:AuraTaskboardReceiptCertainties = @('certain', 'uncertain')
$script:AuraTaskboardDrainModes = @('retained', 'automatic', 'user_mediated')
$script:AuraTaskboardStatusApplicationModes = @('automatic', 'user_mediated')
$script:AuraTaskboardQueueEvidenceKinds = @('local', 'transport', 'provider_event', 'user_reported')
$script:AuraTaskboardQueueForm = $null
$script:AuraTaskboardQueueList = $null
$script:AuraTaskboardQueueSummary = $null
$script:AuraTaskboardQueueStatus = $null
$script:AuraTaskboardQueuePrimaryButton = $null
$script:AuraTaskboardQueueRemoveButton = $null
$script:AuraTaskboardQueueVisibleItems = @()
$script:AuraTaskboardQueueCurrentTargetId = $null

function Write-AuraTaskboardEvent {
  param([Parameter(Mandatory = $true)][string]$Code)
  try { Write-AuraUiLog -Message "Taskboard event: $Code" } catch {}
}

function Get-AuraTaskboardCopy {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Fallback
  )
  if ($null -ne $script:UiCopy) {
    $property = $script:UiCopy.PSObject.Properties[$Name]
    if ($null -ne $property -and $property.Value -is [string] -and
        -not [string]::IsNullOrWhiteSpace([string]$property.Value)) {
      return [string]$property.Value
    }
  }
  return $Fallback
}

function Test-AuraTaskboardUuid {
  param([AllowEmptyString()][string]$Value)
  return $Value -cmatch '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
}

function Test-AuraTaskboardLocalTargetId {
  param([AllowEmptyString()][string]$Value)
  return $Value -cmatch '^[a-f0-9]{8}-[a-f0-9]{4}-[458][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
}

function New-AuraTaskboardUuid {
  return [Guid]::NewGuid().ToString('D').ToLowerInvariant()
}

function Test-AuraTaskboardDraftId {
  param([AllowEmptyString()][string]$Value)
  return $Value -cmatch '^[a-f0-9]{32}$'
}

function Get-AuraTaskboardNow {
  return [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
}

function Test-AuraTaskboardText {
  param(
    [AllowEmptyString()][string]$Value,
    [Parameter(Mandatory = $true)][int]$Maximum,
    [switch]$Required
  )
  if ($null -eq $Value -or $Value.Length -gt $Maximum) { return $false }
  if ($Required -and [string]::IsNullOrWhiteSpace($Value)) { return $false }
  return -not [regex]::IsMatch($Value, '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
}

function Test-AuraTaskboardInteger {
  param(
    [AllowNull()][object]$Value,
    [long]$Minimum = 0,
    [long]$Maximum = [long]::MaxValue
  )
  return ($Value -is [int] -or $Value -is [long]) -and
    [long]$Value -ge $Minimum -and [long]$Value -le $Maximum
}

function Get-AuraTaskboardPropertyNames {
  param([AllowNull()][object]$Value)
  if ($Value -is [Collections.IDictionary]) { return @($Value.Keys | ForEach-Object { "$_" }) }
  if ($null -eq $Value) { return @() }
  return @($Value.PSObject.Properties | ForEach-Object { $_.Name })
}

function Get-AuraTaskboardProperty {
  param(
    [AllowNull()][object]$Value,
    [Parameter(Mandatory = $true)][string]$Name
  )
  if ($Value -is [Collections.IDictionary]) {
    Write-Output -NoEnumerate $Value[$Name]
    return
  }
  if ($null -eq $Value) { return $null }
  $property = $Value.PSObject.Properties[$Name]
  if ($null -eq $property) { return $null }
  Write-Output -NoEnumerate $property.Value
}

function Test-AuraTaskboardDestinationId {
  param(
    [AllowEmptyString()][string]$Value,
    [Parameter(Mandatory = $true)][string]$Type
  )
  switch -CaseSensitive ($Type) {
    'work-hub' { return $Value -ceq 'work-hub' }
    'action-queue' { return $Value -ceq 'action-queue' }
    'attention' { return $Value -ceq 'attention' }
    'recent' { return $Value -ceq 'recent' }
    'projects' { return $Value -ceq 'projects' }
    'project' { return $Value -cmatch '^project:[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' }
    'task' { return $Value -cmatch '^task:[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' }
    'studio-page' { return $Value -cmatch '^studio:(tasks|themes|background|create|settings)$' }
    default { return $false }
  }
}

function New-AuraTaskboardNavigation {
  return [PSCustomObject][ordered]@{
    tabs = @()
    activeTabId = $null
  }
}

function ConvertTo-AuraTaskboardNavigation {
  param([Parameter(Mandatory = $true)][object]$Value)
  Assert-AuraTaskboardExactShape -Value $Value `
    -Names @('tabs', 'activeTabId') -Label 'Taskboard navigation'
  $rawTabs = Get-AuraTaskboardProperty -Value $Value -Name 'tabs'
  $activeTabId = Get-AuraTaskboardProperty -Value $Value -Name 'activeTabId'
  if ($null -eq $rawTabs -or $rawTabs -is [string]) {
    throw 'Taskboard navigation tabs must be an array.'
  }
  $rawTabItems = @($rawTabs)
  if ($rawTabItems.Count -gt $script:AuraTaskboardLegacyMaximumTabs) {
    throw 'Taskboard navigation tab count is invalid.'
  }
  $ids = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  $workHubIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  $tabs = @()
  foreach ($rawTab in $rawTabItems) {
    Assert-AuraTaskboardExactShape -Value $rawTab `
      -Names @('id', 'destinationId', 'destinationType', 'safeTitle') `
      -Label 'Taskboard navigation tab'
    $id = Get-AuraTaskboardProperty -Value $rawTab -Name 'id'
    $destinationId = Get-AuraTaskboardProperty -Value $rawTab -Name 'destinationId'
    $destinationType = Get-AuraTaskboardProperty -Value $rawTab -Name 'destinationType'
    $safeTitle = Get-AuraTaskboardProperty -Value $rawTab -Name 'safeTitle'
    if ($destinationId -is [string] -and $destinationId -ceq 'studio:prompt-shelf' -and
        $destinationType -is [string] -and $destinationType -ceq 'studio-page') {
      $destinationId = 'studio:tasks'
      $safeTitle = 'Tasks'
    }
    if ($id -isnot [string] -or -not (Test-AuraTaskboardUuid -Value $id) -or
        -not $ids.Add($id) -or $destinationId -isnot [string] -or
        $destinationType -isnot [string] -or
        -not (Test-AuraTaskboardDestinationId -Value $destinationId -Type $destinationType) -or
        $safeTitle -isnot [string] -or
        -not (Test-AuraTaskboardText -Value $safeTitle -Maximum 160 -Required)) {
      throw 'Taskboard navigation tab is invalid.'
    }
    $tabs += [PSCustomObject][ordered]@{
      id = $id
      destinationId = $destinationId
      destinationType = $destinationType
      safeTitle = $safeTitle
    }
    if ($destinationId -ceq 'work-hub' -and $destinationType -ceq 'work-hub') {
      [void]$workHubIds.Add($id)
    }
  }
  $tabs = @($tabs | Where-Object {
    -not ([string]$_.destinationId -ceq 'work-hub' -and
      [string]$_.destinationType -ceq 'work-hub')
  })
  if ($tabs.Count -gt $script:AuraTaskboardMaximumTabs) {
    throw 'Taskboard navigation tab count exceeds its limit.'
  }
  $activeIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  foreach ($tab in $tabs) { [void]$activeIds.Add([string]$tab.id) }
  $normalizedActiveTabId = $activeTabId
  $workHubWasActive = $activeTabId -is [string] -and $workHubIds.Contains($activeTabId)
  if ($tabs.Count -eq 0) {
    if ($null -ne $activeTabId -and -not $workHubWasActive) {
      throw 'Taskboard active tab is invalid.'
    }
    $normalizedActiveTabId = $null
  } elseif ($workHubWasActive) {
    $normalizedActiveTabId = $null
  } elseif ($null -eq $activeTabId) {
    $normalizedActiveTabId = $null
  } elseif ($activeTabId -isnot [string] -or -not $activeIds.Contains($activeTabId)) {
    throw 'Taskboard active tab is invalid.'
  }
  return [PSCustomObject][ordered]@{
    tabs = @($tabs)
    activeTabId = $normalizedActiveTabId
  }
}

function Assert-AuraTaskboardExactShape {
  param(
    [AllowNull()][object]$Value,
    [Parameter(Mandatory = $true)][string[]]$Names,
    [Parameter(Mandatory = $true)][string]$Label
  )
  if ($null -eq $Value -or $Value -is [string] -or $Value -is [Array]) {
    throw "$Label must be an object."
  }
  $actual = @(Get-AuraTaskboardPropertyNames -Value $Value)
  if ($actual.Count -ne $Names.Count) { throw "$Label has an invalid shape." }
  foreach ($name in $Names) {
    if ($actual -cnotcontains $name) { throw "$Label is missing $name." }
  }
}

function Test-AuraTaskboardDate {
  param([AllowNull()][object]$Value)
  if ($null -eq $Value) { return $true }
  if ($Value -isnot [string] -or $Value -cnotmatch '^\d{4}-\d{2}-\d{2}$') { return $false }
  $parsed = [DateTime]::MinValue
  return [DateTime]::TryParseExact(
    $Value,
    'yyyy-MM-dd',
    [Globalization.CultureInfo]::InvariantCulture,
    [Globalization.DateTimeStyles]::None,
    [ref]$parsed)
}

function ConvertTo-AuraTaskboardStringArray {
  param(
    [AllowNull()][object]$Value,
    [Parameter(Mandatory = $true)][int]$MaximumCount,
    [Parameter(Mandatory = $true)][int]$MaximumLength,
    [Parameter(Mandatory = $true)][string]$Label,
    [switch]$Uuid
  )
  if ($null -eq $Value -or $Value -is [string]) { throw "$Label must be an array." }
  $items = @($Value)
  if ($items.Count -gt $MaximumCount) { throw "$Label has too many entries." }
  $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  $normalized = @()
  foreach ($item in $items) {
    if ($item -isnot [string] -or
        ($Uuid -and -not (Test-AuraTaskboardUuid -Value $item)) -or
        (-not $Uuid -and -not (Test-AuraTaskboardText -Value $item -Maximum $MaximumLength -Required)) -or
        -not $seen.Add($item)) {
      throw "$Label contains an invalid or duplicate entry."
    }
    $normalized += $item
  }
  return @($normalized)
}

function ConvertTo-AuraTaskboardComments {
  param(
    [AllowNull()][object]$Value,
    [Parameter(Mandatory = $true)][long]$TaskCreatedAt
  )
  if ($null -eq $Value -or $Value -is [string]) { throw 'Task comments must be an array.' }
  $comments = @($Value)
  if ($comments.Count -gt 100) { throw 'Task has too many comments.' }
  $ids = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  $normalized = @()
  foreach ($comment in $comments) {
    Assert-AuraTaskboardExactShape -Value $comment `
      -Names @('id', 'body', 'createdAt') -Label 'Task comment'
    $id = Get-AuraTaskboardProperty -Value $comment -Name 'id'
    $body = Get-AuraTaskboardProperty -Value $comment -Name 'body'
    $createdAt = Get-AuraTaskboardProperty -Value $comment -Name 'createdAt'
    if ($id -isnot [string] -or -not (Test-AuraTaskboardUuid -Value $id) -or
        -not $ids.Add($id) -or $body -isnot [string] -or
        -not (Test-AuraTaskboardText -Value $body -Maximum 2000 -Required) -or
        -not (Test-AuraTaskboardInteger -Value $createdAt -Minimum $TaskCreatedAt)) {
      throw 'Task comment is invalid.'
    }
    $normalized += [PSCustomObject][ordered]@{
      id = $id
      body = $body
      createdAt = [long]$createdAt
    }
  }
  return @($normalized)
}

function ConvertTo-AuraTaskboardTask {
  param(
    [Parameter(Mandatory = $true)][object]$Value,
    [switch]$LegacySessionFields
  )
  $legacyNames = @(
    'id', 'number', 'version', 'title', 'description', 'status', 'priority',
    'labels', 'assignee', 'startDate', 'dueDate', 'relationIds', 'comments',
    'branch', 'worktree', 'providerThreadId', 'createdAt', 'updatedAt', 'acceptedAt')
  $names = @($legacyNames)
  if (-not $LegacySessionFields) {
    $names = @(
      'id', 'number', 'version', 'title', 'description', 'status', 'priority',
      'labels', 'assignee', 'startDate', 'dueDate', 'relationIds', 'comments',
      'branch', 'worktree', 'providerThreadId', 'sessionState',
      'sessionTerminationReason', 'sessionEvidence', 'sessionUpdatedAt',
      'createdAt', 'updatedAt', 'acceptedAt')
  }
  Assert-AuraTaskboardExactShape -Value $Value -Names $names -Label 'Task'
  $id = Get-AuraTaskboardProperty -Value $Value -Name 'id'
  $number = Get-AuraTaskboardProperty -Value $Value -Name 'number'
  $version = Get-AuraTaskboardProperty -Value $Value -Name 'version'
  $title = Get-AuraTaskboardProperty -Value $Value -Name 'title'
  $description = Get-AuraTaskboardProperty -Value $Value -Name 'description'
  $status = Get-AuraTaskboardProperty -Value $Value -Name 'status'
  $priority = Get-AuraTaskboardProperty -Value $Value -Name 'priority'
  $assignee = Get-AuraTaskboardProperty -Value $Value -Name 'assignee'
  $startDate = Get-AuraTaskboardProperty -Value $Value -Name 'startDate'
  $dueDate = Get-AuraTaskboardProperty -Value $Value -Name 'dueDate'
  $branch = Get-AuraTaskboardProperty -Value $Value -Name 'branch'
  $worktree = Get-AuraTaskboardProperty -Value $Value -Name 'worktree'
  $providerThreadId = Get-AuraTaskboardProperty -Value $Value -Name 'providerThreadId'
  $createdAt = Get-AuraTaskboardProperty -Value $Value -Name 'createdAt'
  $updatedAt = Get-AuraTaskboardProperty -Value $Value -Name 'updatedAt'
  $acceptedAt = Get-AuraTaskboardProperty -Value $Value -Name 'acceptedAt'
  if ($LegacySessionFields) {
    $sessionState = if ([string]::IsNullOrWhiteSpace([string]$providerThreadId)) {
      'unlinked'
    } else {
      'linked'
    }
    $sessionTerminationReason = $null
    $sessionEvidence = if ($sessionState -ceq 'linked') { 'local' } else { $null }
    $sessionUpdatedAt = if ($sessionState -ceq 'linked') { $updatedAt } else { $null }
  } else {
    $sessionState = Get-AuraTaskboardProperty -Value $Value -Name 'sessionState'
    $sessionTerminationReason = Get-AuraTaskboardProperty -Value $Value -Name 'sessionTerminationReason'
    $sessionEvidence = Get-AuraTaskboardProperty -Value $Value -Name 'sessionEvidence'
    $sessionUpdatedAt = Get-AuraTaskboardProperty -Value $Value -Name 'sessionUpdatedAt'
  }
  $hasLinkedSession = -not [string]::IsNullOrWhiteSpace([string]$providerThreadId)
  $createdAtValid = Test-AuraTaskboardInteger -Value $createdAt
  $createdAtMinimum = if ($createdAtValid) { [long]$createdAt } else { [long]0 }
  if ($id -isnot [string] -or -not (Test-AuraTaskboardUuid -Value $id) -or
      -not (Test-AuraTaskboardInteger -Value $number -Minimum 1 -Maximum 2147483647) -or
      -not (Test-AuraTaskboardInteger -Value $version -Minimum 1 -Maximum 2147483647) -or
      $title -isnot [string] -or -not (Test-AuraTaskboardText -Value $title -Maximum 160 -Required) -or
      $description -isnot [string] -or -not (Test-AuraTaskboardText -Value $description -Maximum 4000) -or
      $status -isnot [string] -or $status -cnotin $script:AuraTaskboardStatuses -or
      $priority -isnot [string] -or $priority -cnotin $script:AuraTaskboardPriorities -or
      $assignee -isnot [string] -or -not (Test-AuraTaskboardText -Value $assignee -Maximum 80) -or
      -not (Test-AuraTaskboardDate -Value $startDate) -or
      -not (Test-AuraTaskboardDate -Value $dueDate) -or
      $branch -isnot [string] -or -not (Test-AuraTaskboardText -Value $branch -Maximum 160) -or
      $worktree -isnot [string] -or -not (Test-AuraTaskboardText -Value $worktree -Maximum 520) -or
      $providerThreadId -isnot [string] -or
        -not (Test-AuraTaskboardText -Value $providerThreadId -Maximum 160) -or
      $sessionState -isnot [string] -or $sessionState -cnotin $script:AuraTaskboardSessionStates -or
      ($hasLinkedSession -and $sessionState -ceq 'unlinked') -or
      (-not $hasLinkedSession -and ($sessionState -cne 'unlinked' -or
        $null -ne $sessionTerminationReason -or $null -ne $sessionEvidence -or
        $null -ne $sessionUpdatedAt)) -or
      ($sessionState -ceq 'terminated' -and
        ($sessionTerminationReason -isnot [string] -or
          $sessionTerminationReason -cnotin $script:AuraTaskboardSessionTerminationReasons)) -or
      ($sessionState -cne 'terminated' -and $null -ne $sessionTerminationReason) -or
      ($hasLinkedSession -and ($sessionEvidence -isnot [string] -or
        $sessionEvidence -cnotin $script:AuraTaskboardSessionEvidenceKinds -or
        -not (Test-AuraTaskboardInteger -Value $sessionUpdatedAt -Minimum $createdAtMinimum))) -or
      -not $createdAtValid -or
      -not (Test-AuraTaskboardInteger -Value $updatedAt -Minimum $createdAtMinimum) -or
      ($null -ne $acceptedAt -and
        -not (Test-AuraTaskboardInteger -Value $acceptedAt -Minimum $createdAtMinimum)) -or
      ($status -ceq 'done' -and $null -eq $acceptedAt) -or
      ($status -cne 'done' -and $null -ne $acceptedAt)) {
    throw 'Task contains an invalid value.'
  }
  $labels = @(ConvertTo-AuraTaskboardStringArray `
    -Value (Get-AuraTaskboardProperty -Value $Value -Name 'labels') `
    -MaximumCount 8 -MaximumLength 32 -Label 'Task labels')
  $relationIds = @(ConvertTo-AuraTaskboardStringArray `
    -Value (Get-AuraTaskboardProperty -Value $Value -Name 'relationIds') `
    -MaximumCount 16 -MaximumLength 36 -Label 'Task relations' -Uuid)
  if ($relationIds -ccontains $id) { throw 'Task cannot relate to itself.' }
  $comments = @(ConvertTo-AuraTaskboardComments `
    -Value (Get-AuraTaskboardProperty -Value $Value -Name 'comments') `
    -TaskCreatedAt ([long]$createdAt))
  return [PSCustomObject][ordered]@{
    id = $id
    number = [int]$number
    version = [int]$version
    title = $title
    description = $description
    status = $status
    priority = $priority
    labels = @($labels)
    assignee = $assignee
    startDate = $startDate
    dueDate = $dueDate
    relationIds = @($relationIds)
    comments = @($comments)
    branch = $branch
    worktree = $worktree
    providerThreadId = $providerThreadId
    sessionState = $sessionState
    sessionTerminationReason = $sessionTerminationReason
    sessionEvidence = $sessionEvidence
    sessionUpdatedAt = if ($null -eq $sessionUpdatedAt) { $null } else { [long]$sessionUpdatedAt }
    createdAt = [long]$createdAt
    updatedAt = [long]$updatedAt
    acceptedAt = if ($null -eq $acceptedAt) { $null } else { [long]$acceptedAt }
  }
}

function ConvertTo-AuraTaskboardActivity {
  param([AllowNull()][object]$Value)
  if ($null -eq $Value -or $Value -is [string]) { throw 'Task activity must be an array.' }
  $items = @($Value)
  if ($items.Count -gt $script:AuraTaskboardMaximumActivity) {
    throw 'Task activity exceeds its limit.'
  }
  $ids = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  $normalized = @()
  foreach ($item in $items) {
    Assert-AuraTaskboardExactShape -Value $item `
      -Names @('id', 'taskId', 'kind', 'at', 'from', 'to', 'evidence') `
      -Label 'Task activity'
    $id = Get-AuraTaskboardProperty -Value $item -Name 'id'
    $taskId = Get-AuraTaskboardProperty -Value $item -Name 'taskId'
    $kind = Get-AuraTaskboardProperty -Value $item -Name 'kind'
    $at = Get-AuraTaskboardProperty -Value $item -Name 'at'
    $from = Get-AuraTaskboardProperty -Value $item -Name 'from'
    $to = Get-AuraTaskboardProperty -Value $item -Name 'to'
    $evidence = Get-AuraTaskboardProperty -Value $item -Name 'evidence'
    $transitionValues = if ($kind -ceq 'session-state-changed') {
      $script:AuraTaskboardSessionStates
    } else {
      $script:AuraTaskboardStatuses
    }
    if ($id -isnot [string] -or -not (Test-AuraTaskboardUuid -Value $id) -or
        -not $ids.Add($id) -or
        ($null -ne $taskId -and ($taskId -isnot [string] -or
          -not (Test-AuraTaskboardUuid -Value $taskId))) -or
        $kind -isnot [string] -or $kind -cnotin $script:AuraTaskboardActivityKinds -or
        -not (Test-AuraTaskboardInteger -Value $at) -or
        ($null -ne $from -and ($from -isnot [string] -or
          $from -cnotin $transitionValues)) -or
        ($null -ne $to -and ($to -isnot [string] -or
          $to -cnotin $transitionValues)) -or
        $evidence -isnot [string] -or $evidence -cnotin $script:AuraTaskboardEvidenceKinds) {
      throw 'Task activity contains an invalid value.'
    }
    $normalized += [PSCustomObject][ordered]@{
      id = $id
      taskId = $taskId
      kind = $kind
      at = [long]$at
      from = $from
      to = $to
      evidence = $evidence
    }
  }
  return @($normalized)
}

function ConvertTo-AuraTaskboardQueue {
  param([AllowNull()][object]$Value)
  if ($null -eq $Value -or $Value -is [string]) {
    throw 'Action Queue must be an array.'
  }
  $items = @($Value)
  if ($items.Count -gt $script:AuraTaskboardMaximumQueueItems) {
    throw 'Action Queue exceeds its limit.'
  }
  $commandIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  $activeDraftIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  $activePositions = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  $sequences = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  $terminalStatuses = @('sent', 'completed', 'failed', 'cancelled')
  $normalized = @()
  foreach ($item in $items) {
    Assert-AuraTaskboardExactShape -Value $item -Names @(
      'commandId', 'draftId', 'draftFingerprint', 'taskId', 'localTargetId', 'adapterKind',
      'adapterEpoch', 'sequence', 'causationCommandId', 'status', 'position',
      'priority', 'receiptStage', 'receiptCertainty', 'drainMode',
      'statusApplicationMode', 'statusEvidenceClass', 'createdAt', 'updatedAt') `
      -Label 'Action Queue item'
    $commandId = Get-AuraTaskboardProperty -Value $item -Name 'commandId'
    $draftId = Get-AuraTaskboardProperty -Value $item -Name 'draftId'
    $draftFingerprint = Get-AuraTaskboardProperty -Value $item -Name 'draftFingerprint'
    $taskId = Get-AuraTaskboardProperty -Value $item -Name 'taskId'
    $localTargetId = Get-AuraTaskboardProperty -Value $item -Name 'localTargetId'
    $adapterKind = Get-AuraTaskboardProperty -Value $item -Name 'adapterKind'
    $adapterEpoch = Get-AuraTaskboardProperty -Value $item -Name 'adapterEpoch'
    $sequence = Get-AuraTaskboardProperty -Value $item -Name 'sequence'
    $causationCommandId = Get-AuraTaskboardProperty -Value $item -Name 'causationCommandId'
    $status = Get-AuraTaskboardProperty -Value $item -Name 'status'
    $position = Get-AuraTaskboardProperty -Value $item -Name 'position'
    $priority = Get-AuraTaskboardProperty -Value $item -Name 'priority'
    $receiptStage = Get-AuraTaskboardProperty -Value $item -Name 'receiptStage'
    $receiptCertainty = Get-AuraTaskboardProperty -Value $item -Name 'receiptCertainty'
    $drainMode = Get-AuraTaskboardProperty -Value $item -Name 'drainMode'
    $statusApplicationMode = Get-AuraTaskboardProperty -Value $item -Name 'statusApplicationMode'
    $statusEvidenceClass = Get-AuraTaskboardProperty -Value $item -Name 'statusEvidenceClass'
    $createdAt = Get-AuraTaskboardProperty -Value $item -Name 'createdAt'
    $updatedAt = Get-AuraTaskboardProperty -Value $item -Name 'updatedAt'
    if ($commandId -isnot [string] -or -not (Test-AuraTaskboardUuid -Value $commandId) -or
        -not $commandIds.Add($commandId) -or
        $draftId -isnot [string] -or -not (Test-AuraTaskboardDraftId -Value $draftId) -or
        $draftFingerprint -isnot [string] -or $draftFingerprint -cnotmatch '^[a-f0-9]{64}$' -or
        $taskId -isnot [string] -or -not (Test-AuraTaskboardUuid -Value $taskId) -or
        $localTargetId -isnot [string] -or
          -not (Test-AuraTaskboardLocalTargetId -Value $localTargetId) -or
        $adapterKind -isnot [string] -or $adapterKind -cnotmatch '^[a-z][a-z0-9._-]{0,63}$' -or
        -not (Test-AuraTaskboardInteger -Value $adapterEpoch) -or
        -not (Test-AuraTaskboardInteger -Value $sequence) -or
        ($null -ne $causationCommandId -and ($causationCommandId -isnot [string] -or
          -not (Test-AuraTaskboardUuid -Value $causationCommandId))) -or
        $status -isnot [string] -or $status -cnotin $script:AuraTaskboardQueueStatuses -or
        -not (Test-AuraTaskboardInteger -Value $position -Maximum 10000) -or
        -not (Test-AuraTaskboardInteger -Value $priority -Minimum -100 -Maximum 100) -or
        $receiptStage -isnot [string] -or $receiptStage -cnotin $script:AuraTaskboardReceiptStages -or
        $receiptCertainty -isnot [string] -or
          $receiptCertainty -cnotin $script:AuraTaskboardReceiptCertainties -or
        $drainMode -isnot [string] -or $drainMode -cnotin $script:AuraTaskboardDrainModes -or
        $statusApplicationMode -isnot [string] -or
          $statusApplicationMode -cnotin $script:AuraTaskboardStatusApplicationModes -or
        $statusEvidenceClass -isnot [string] -or
          $statusEvidenceClass -cnotin $script:AuraTaskboardQueueEvidenceKinds -or
        -not (Test-AuraTaskboardInteger -Value $createdAt) -or
        -not (Test-AuraTaskboardInteger -Value $updatedAt -Minimum ([long]$createdAt))) {
      throw 'Action Queue item contains an invalid value.'
    }
    if ($receiptCertainty -ceq 'uncertain' -and
        ($status -cne 'uncertain' -or $drainMode -cne 'retained')) {
      throw 'Uncertain Action Queue evidence must remain retained.'
    }
    if ($drainMode -ceq 'automatic' -and $statusEvidenceClass -cne 'provider_event') {
      throw 'Automatic Action Queue drain requires provider evidence.'
    }
    if ($statusApplicationMode -ceq 'automatic' -and
        $status -in @('accepted', 'active', 'completed', 'failed') -and
        $statusEvidenceClass -cne 'provider_event') {
      throw 'Automatic provider lifecycle requires provider evidence.'
    }
    $sequenceKey = '{0}|{1}|{2}' -f $localTargetId, $adapterEpoch, $sequence
    if (-not $sequences.Add($sequenceKey)) {
      throw 'Action Queue contains a duplicate target sequence.'
    }
    if ($status -notin $terminalStatuses) {
      if (-not $activeDraftIds.Add([string]$draftId)) {
        throw 'Action Queue contains a duplicate active draft.'
      }
      $positionKey = '{0}|{1}' -f $localTargetId, $position
      if (-not $activePositions.Add($positionKey)) {
        throw 'Action Queue contains a duplicate active position.'
      }
    }
    $normalized += [PSCustomObject][ordered]@{
      commandId = $commandId
      draftId = $draftId
      draftFingerprint = $draftFingerprint
      taskId = $taskId
      localTargetId = $localTargetId
      adapterKind = $adapterKind
      adapterEpoch = [long]$adapterEpoch
      sequence = [long]$sequence
      causationCommandId = $causationCommandId
      status = $status
      position = [int]$position
      priority = [int]$priority
      receiptStage = $receiptStage
      receiptCertainty = $receiptCertainty
      drainMode = $drainMode
      statusApplicationMode = $statusApplicationMode
      statusEvidenceClass = $statusEvidenceClass
      createdAt = [long]$createdAt
      updatedAt = [long]$updatedAt
    }
  }
  return @($normalized)
}

function ConvertTo-AuraTaskboardQueueReceipts {
  param([AllowNull()][object]$Value)
  if ($null -eq $Value -or $Value -is [string]) {
    throw 'Action Queue receipts must be an array.'
  }
  $items = @($Value)
  if ($items.Count -gt $script:AuraTaskboardMaximumQueueReceipts) {
    throw 'Action Queue receipts exceed their limit.'
  }
  $ids = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  $normalized = @()
  foreach ($item in $items) {
    Assert-AuraTaskboardExactShape -Value $item -Names @(
      'id', 'commandId', 'stage', 'certainty', 'drainMode',
      'statusApplicationMode', 'evidenceClass', 'at') -Label 'Action Queue receipt'
    $id = Get-AuraTaskboardProperty -Value $item -Name 'id'
    $commandId = Get-AuraTaskboardProperty -Value $item -Name 'commandId'
    $stage = Get-AuraTaskboardProperty -Value $item -Name 'stage'
    $certainty = Get-AuraTaskboardProperty -Value $item -Name 'certainty'
    $drainMode = Get-AuraTaskboardProperty -Value $item -Name 'drainMode'
    $statusApplicationMode = Get-AuraTaskboardProperty -Value $item -Name 'statusApplicationMode'
    $evidenceClass = Get-AuraTaskboardProperty -Value $item -Name 'evidenceClass'
    $at = Get-AuraTaskboardProperty -Value $item -Name 'at'
    if ($id -isnot [string] -or -not (Test-AuraTaskboardUuid -Value $id) -or
        -not $ids.Add($id) -or
        $commandId -isnot [string] -or -not (Test-AuraTaskboardUuid -Value $commandId) -or
        $stage -isnot [string] -or $stage -cnotin $script:AuraTaskboardReceiptStages -or
        $certainty -isnot [string] -or
          $certainty -cnotin $script:AuraTaskboardReceiptCertainties -or
        $drainMode -isnot [string] -or $drainMode -cnotin $script:AuraTaskboardDrainModes -or
        $statusApplicationMode -isnot [string] -or
          $statusApplicationMode -cnotin $script:AuraTaskboardStatusApplicationModes -or
        $evidenceClass -isnot [string] -or
          $evidenceClass -cnotin $script:AuraTaskboardQueueEvidenceKinds -or
        -not (Test-AuraTaskboardInteger -Value $at)) {
      throw 'Action Queue receipt contains an invalid value.'
    }
    if ($drainMode -ceq 'automatic' -and $evidenceClass -cne 'provider_event') {
      throw 'Automatic Action Queue drain requires provider evidence.'
    }
    $normalized += [PSCustomObject][ordered]@{
      id = $id
      commandId = $commandId
      stage = $stage
      certainty = $certainty
      drainMode = $drainMode
      statusApplicationMode = $statusApplicationMode
      evidenceClass = $evidenceClass
      at = [long]$at
    }
  }
  return @($normalized)
}

function ConvertTo-AuraTaskboardDocument {
  param([Parameter(Mandatory = $true)][object]$Value)
  $schemaVersion = Get-AuraTaskboardProperty -Value $Value -Name 'schemaVersion'
  if (Test-AuraTaskboardInteger -Value $schemaVersion -Minimum 1 -Maximum 1) {
    Assert-AuraTaskboardExactShape -Value $Value `
      -Names @('schemaVersion', 'revision', 'nextTaskNumber', 'project', 'tasks', 'activity') `
      -Label 'Taskboard document'
    $navigation = New-AuraTaskboardNavigation
    $queue = @()
    $receipts = @()
  } elseif (Test-AuraTaskboardInteger -Value $schemaVersion -Minimum 2 -Maximum 3) {
    Assert-AuraTaskboardExactShape -Value $Value `
      -Names @('schemaVersion', 'revision', 'nextTaskNumber', 'project', 'tasks', 'activity', 'navigation') `
      -Label 'Taskboard document'
    $navigation = ConvertTo-AuraTaskboardNavigation `
      -Value (Get-AuraTaskboardProperty -Value $Value -Name 'navigation')
    $queue = @()
    $receipts = @()
  } elseif (Test-AuraTaskboardInteger -Value $schemaVersion -Minimum 4 -Maximum 4) {
    Assert-AuraTaskboardExactShape -Value $Value `
      -Names @(
        'schemaVersion', 'revision', 'nextTaskNumber', 'project', 'tasks',
        'activity', 'navigation', 'queue') `
      -Label 'Taskboard document'
    $navigation = ConvertTo-AuraTaskboardNavigation `
      -Value (Get-AuraTaskboardProperty -Value $Value -Name 'navigation')
    $queue = @(ConvertTo-AuraTaskboardQueue `
      -Value (Get-AuraTaskboardProperty -Value $Value -Name 'queue'))
    $receipts = @()
  } elseif (Test-AuraTaskboardInteger -Value $schemaVersion -Minimum 5 -Maximum 5) {
    Assert-AuraTaskboardExactShape -Value $Value `
      -Names @(
        'schemaVersion', 'revision', 'nextTaskNumber', 'project', 'tasks',
        'activity', 'navigation', 'queue', 'receipts') `
      -Label 'Taskboard document'
    $navigation = ConvertTo-AuraTaskboardNavigation `
      -Value (Get-AuraTaskboardProperty -Value $Value -Name 'navigation')
    $queue = @(ConvertTo-AuraTaskboardQueue `
      -Value (Get-AuraTaskboardProperty -Value $Value -Name 'queue'))
    $receipts = @(ConvertTo-AuraTaskboardQueueReceipts `
      -Value (Get-AuraTaskboardProperty -Value $Value -Name 'receipts'))
  } elseif (Test-AuraTaskboardInteger -Value $schemaVersion -Minimum 6 -Maximum 6) {
    Assert-AuraTaskboardExactShape -Value $Value `
      -Names @(
        'schemaVersion', 'revision', 'nextTaskNumber', 'project', 'tasks',
        'activity', 'navigation', 'queue', 'receipts') `
      -Label 'Taskboard document'
    $navigation = ConvertTo-AuraTaskboardNavigation `
      -Value (Get-AuraTaskboardProperty -Value $Value -Name 'navigation')
    $queue = @(ConvertTo-AuraTaskboardQueue `
      -Value (Get-AuraTaskboardProperty -Value $Value -Name 'queue'))
    $receipts = @(ConvertTo-AuraTaskboardQueueReceipts `
      -Value (Get-AuraTaskboardProperty -Value $Value -Name 'receipts'))
  } else {
    throw 'Taskboard document version is invalid.'
  }
  $revision = Get-AuraTaskboardProperty -Value $Value -Name 'revision'
  $nextTaskNumber = Get-AuraTaskboardProperty -Value $Value -Name 'nextTaskNumber'
  $project = Get-AuraTaskboardProperty -Value $Value -Name 'project'
  if (-not (Test-AuraTaskboardInteger -Value $revision -Maximum 2147483647) -or
      -not (Test-AuraTaskboardInteger -Value $nextTaskNumber -Minimum 1 -Maximum 2147483647)) {
    throw 'Taskboard document version is invalid.'
  }
  Assert-AuraTaskboardExactShape -Value $project `
    -Names @('id', 'name', 'keyPrefix', 'createdAt', 'updatedAt') -Label 'Taskboard project'
  $projectId = Get-AuraTaskboardProperty -Value $project -Name 'id'
  $projectName = Get-AuraTaskboardProperty -Value $project -Name 'name'
  $keyPrefix = Get-AuraTaskboardProperty -Value $project -Name 'keyPrefix'
  $projectCreatedAt = Get-AuraTaskboardProperty -Value $project -Name 'createdAt'
  $projectUpdatedAt = Get-AuraTaskboardProperty -Value $project -Name 'updatedAt'
  if ($projectId -isnot [string] -or -not (Test-AuraTaskboardUuid -Value $projectId) -or
      $projectName -isnot [string] -or
        -not (Test-AuraTaskboardText -Value $projectName -Maximum 80 -Required) -or
      $keyPrefix -isnot [string] -or $keyPrefix -cnotmatch '^[A-Z][A-Z0-9]{1,7}$' -or
      -not (Test-AuraTaskboardInteger -Value $projectCreatedAt) -or
      -not (Test-AuraTaskboardInteger -Value $projectUpdatedAt -Minimum ([long]$projectCreatedAt))) {
    throw 'Taskboard project is invalid.'
  }
  $rawTasks = Get-AuraTaskboardProperty -Value $Value -Name 'tasks'
  if ($null -eq $rawTasks -or $rawTasks -is [string]) { throw 'Tasks must be an array.' }
  $rawTaskItems = @($rawTasks)
  if ($rawTaskItems.Count -gt $script:AuraTaskboardMaximumTasks) {
    throw 'Taskboard task count exceeds its limit.'
  }
  $ids = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  $numbers = [Collections.Generic.HashSet[int]]::new()
  $tasks = @()
  $legacySessionFields = [int]$schemaVersion -le 5
  foreach ($rawTask in $rawTaskItems) {
    $task = ConvertTo-AuraTaskboardTask `
      -Value $rawTask -LegacySessionFields:$legacySessionFields
    if (-not $ids.Add([string]$task.id) -or -not $numbers.Add([int]$task.number)) {
      throw 'Taskboard contains duplicate task identity.'
    }
    $tasks += $task
  }
  if ($tasks.Count -gt 0 -and [int]$nextTaskNumber -le
      [int](($tasks | Measure-Object -Property number -Maximum).Maximum)) {
    throw 'Taskboard next task number is invalid.'
  }
  foreach ($task in $tasks) {
    foreach ($relationId in @($task.relationIds)) {
      if (-not $ids.Contains($relationId)) { throw 'Task relation does not exist.' }
    }
  }
  $activity = @(ConvertTo-AuraTaskboardActivity `
    -Value (Get-AuraTaskboardProperty -Value $Value -Name 'activity'))
  $queueCommandIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  foreach ($queueItem in @($queue)) { [void]$queueCommandIds.Add([string]$queueItem.commandId) }
  foreach ($receipt in @($receipts)) {
    if (-not $queueCommandIds.Contains([string]$receipt.commandId)) {
      throw 'Action Queue receipt references a missing queue item.'
    }
  }
  return [PSCustomObject][ordered]@{
    schemaVersion = 6
    revision = [long]$revision
    nextTaskNumber = [int]$nextTaskNumber
    project = [PSCustomObject][ordered]@{
      id = $projectId
      name = $projectName
      keyPrefix = $keyPrefix
      createdAt = [long]$projectCreatedAt
      updatedAt = [long]$projectUpdatedAt
    }
    tasks = @($tasks)
    activity = @($activity)
    navigation = $navigation
    queue = @($queue)
    receipts = @($receipts)
  }
}

function New-AuraTaskboardDocument {
  $now = Get-AuraTaskboardNow
  return [PSCustomObject][ordered]@{
    schemaVersion = 6
    revision = [long]0
    nextTaskNumber = 1
    project = [PSCustomObject][ordered]@{
      id = New-AuraTaskboardUuid
      name = 'Aura'
      keyPrefix = 'AURA'
      createdAt = [long]$now
      updatedAt = [long]$now
    }
    tasks = @()
    activity = @()
    navigation = New-AuraTaskboardNavigation
    queue = @()
    receipts = @()
  }
}

function Assert-AuraTaskboardNotReparsePoint {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return }
  $item = Get-Item -LiteralPath $Path -Force
  if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'Taskboard storage cannot use a redirected path.'
  }
}

function Set-AuraTaskboardSecureAcl {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [switch]$Directory
  )
  Assert-AuraTaskboardNotReparsePoint -Path $Path
  $userSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  if ($null -eq $userSid) { throw 'Taskboard could not resolve the current Windows user.' }
  $systemSid = [Security.Principal.SecurityIdentifier]::new(
    [Security.Principal.WellKnownSidType]::LocalSystemSid, $null)
  $inheritance = if ($Directory) {
    [Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
      [Security.AccessControl.InheritanceFlags]::ObjectInherit
  } else { [Security.AccessControl.InheritanceFlags]::None }
  $security = if ($Directory) {
    [Security.AccessControl.DirectorySecurity]::new()
  } else { [Security.AccessControl.FileSecurity]::new() }
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
  if ($Directory) { [IO.Directory]::SetAccessControl($Path, $security) }
  else { [IO.File]::SetAccessControl($Path, $security) }
}

function Initialize-AuraTaskboardStorage {
  param([string]$Path = $script:AuraTaskboardStatePath)
  Add-Type -AssemblyName System.Security -ErrorAction Stop
  $fullPath = [IO.Path]::GetFullPath($Path)
  $directory = [IO.Path]::GetFullPath((Split-Path -Parent $fullPath))
  $dataRootFull = [IO.Path]::GetFullPath($DataRoot).TrimEnd(
    [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  $storeRootFull = [IO.Path]::GetFullPath($script:AuraTaskboardStoreRoot).TrimEnd(
    [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  if (-not $storeRootFull.StartsWith(
      $dataRootFull + [IO.Path]::DirectorySeparatorChar,
      [StringComparison]::OrdinalIgnoreCase) -or
      -not [string]::Equals($directory, $storeRootFull, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Taskboard storage escaped the Aura data directory.'
  }
  Assert-AuraTaskboardNotReparsePoint -Path $DataRoot
  [void][IO.Directory]::CreateDirectory($directory)
  Set-AuraTaskboardSecureAcl -Path $directory -Directory
  return $fullPath
}

function ConvertFrom-AuraTaskboardJsonBytes {
  param([Parameter(Mandatory = $true)][byte[]]$Bytes)
  if ($Bytes.Length -le 0 -or $Bytes.Length -gt $script:AuraTaskboardMaximumFileBytes) {
    throw 'Taskboard state has an invalid size.'
  }
  if ($Bytes.Length -ge 3 -and
      $Bytes[0] -eq 0xEF -and $Bytes[1] -eq 0xBB -and $Bytes[2] -eq 0xBF) {
    throw 'Taskboard state must be UTF-8 without a byte-order mark.'
  }
  $json = [Text.UTF8Encoding]::new($false, $true).GetString($Bytes)
  $value = $json | ConvertFrom-Json
  return ConvertTo-AuraTaskboardDocument -Value $value
}

function Read-AuraTaskboardDocument {
  param([string]$Path = $script:AuraTaskboardStatePath)
  $Path = Initialize-AuraTaskboardStorage -Path $Path
  if (-not (Test-Path -LiteralPath $Path)) { return New-AuraTaskboardDocument }
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw 'Taskboard state path is not a regular file.'
  }
  Assert-AuraTaskboardNotReparsePoint -Path $Path
  Set-AuraTaskboardSecureAcl -Path $Path
  $envelope = [IO.File]::ReadAllBytes($Path)
  $cipher = $null
  $plain = $null
  try {
    if ($envelope.Length -le $script:AuraTaskboardStateMagic.Length -or
        $envelope.Length -gt ($script:AuraTaskboardMaximumFileBytes + 4096)) {
      throw 'Taskboard encrypted state has an invalid size.'
    }
    for ($index = 0; $index -lt $script:AuraTaskboardStateMagic.Length; $index += 1) {
      if ($envelope[$index] -ne $script:AuraTaskboardStateMagic[$index]) {
        throw 'Taskboard encrypted state has an invalid header.'
      }
    }
    $cipher = [byte[]]::new($envelope.Length - $script:AuraTaskboardStateMagic.Length)
    [Array]::Copy(
      $envelope, $script:AuraTaskboardStateMagic.Length,
      $cipher, 0, $cipher.Length)
    $plain = [Security.Cryptography.ProtectedData]::Unprotect(
      $cipher,
      $script:AuraTaskboardEntropy,
      [Security.Cryptography.DataProtectionScope]::CurrentUser)
    return ConvertFrom-AuraTaskboardJsonBytes -Bytes $plain
  } finally {
    if ($null -ne $plain) { [Array]::Clear($plain, 0, $plain.Length) }
    if ($null -ne $cipher) { [Array]::Clear($cipher, 0, $cipher.Length) }
    [Array]::Clear($envelope, 0, $envelope.Length)
  }
}

function Write-AuraTaskboardDocument {
  param(
    [Parameter(Mandatory = $true)][object]$Document,
    [string]$Path = $script:AuraTaskboardStatePath
  )
  $normalized = ConvertTo-AuraTaskboardDocument -Value $Document
  $json = ($normalized | ConvertTo-Json -Depth 12 -Compress) + [Environment]::NewLine
  $plain = [Text.UTF8Encoding]::new($false).GetBytes($json)
  if ($plain.Length -gt $script:AuraTaskboardMaximumFileBytes) {
    [Array]::Clear($plain, 0, $plain.Length)
    throw 'Taskboard state exceeds its byte limit.'
  }
  $Path = Initialize-AuraTaskboardStorage -Path $Path
  $directory = Split-Path -Parent $Path
  $temporary = Join-Path $directory ('.taskboard-{0}.tmp' -f [Guid]::NewGuid().ToString('N'))
  $backup = Join-Path $directory ('.taskboard-{0}.bak' -f [Guid]::NewGuid().ToString('N'))
  $cipher = $null
  $envelope = $null
  $published = $false
  $hadExisting = Test-Path -LiteralPath $Path -PathType Leaf
  try {
    if ((Test-Path -LiteralPath $Path) -and -not $hadExisting) {
      throw 'Taskboard state path is not a regular file.'
    }
    if ($hadExisting) { Assert-AuraTaskboardNotReparsePoint -Path $Path }
    $cipher = [Security.Cryptography.ProtectedData]::Protect(
      $plain,
      $script:AuraTaskboardEntropy,
      [Security.Cryptography.DataProtectionScope]::CurrentUser)
    $envelope = [byte[]]::new($script:AuraTaskboardStateMagic.Length + $cipher.Length)
    [Array]::Copy(
      $script:AuraTaskboardStateMagic, 0, $envelope, 0,
      $script:AuraTaskboardStateMagic.Length)
    [Array]::Copy(
      $cipher, 0, $envelope, $script:AuraTaskboardStateMagic.Length, $cipher.Length)
    [IO.File]::WriteAllBytes($temporary, $envelope)
    Set-AuraTaskboardSecureAcl -Path $temporary
    if ($hadExisting) {
      [IO.File]::Replace($temporary, $Path, $backup, $true)
    } else {
      [IO.File]::Move($temporary, $Path)
    }
    $published = $true
    Set-AuraTaskboardSecureAcl -Path $Path
    $verified = Read-AuraTaskboardDocument -Path $Path
    if ([long]$verified.revision -ne [long]$normalized.revision -or
        [int]$verified.tasks.Count -ne [int]$normalized.tasks.Count) {
      throw 'Taskboard replacement did not verify.'
    }
    if (Test-Path -LiteralPath $backup -PathType Leaf) {
      Remove-Item -LiteralPath $backup -Force
    }
    return $verified
  } catch {
    if ($published -and $hadExisting -and (Test-Path -LiteralPath $backup -PathType Leaf)) {
      try { [IO.File]::Replace($backup, $Path, $null, $true) } catch {}
    } elseif ($published -and -not $hadExisting -and (Test-Path -LiteralPath $Path -PathType Leaf)) {
      try { Remove-Item -LiteralPath $Path -Force } catch {}
    }
    throw
  } finally {
    foreach ($bytes in @($plain, $cipher, $envelope)) {
      if ($null -ne $bytes) { [Array]::Clear($bytes, 0, $bytes.Length) }
    }
    foreach ($candidate in @($temporary, $backup)) {
      if (Test-Path -LiteralPath $candidate -PathType Leaf) {
        try { Remove-Item -LiteralPath $candidate -Force } catch {}
      }
    }
  }
}

function New-AuraTaskboardStudioSession {
  $script:AuraTaskboardSession = New-AuraTaskboardUuid
  $script:AuraTaskboardCommandEpoch = [long]0
  return $script:AuraTaskboardSession
}

function Assert-AuraTaskboardTaskFields {
  param(
    [Parameter(Mandatory = $true)][object]$Value,
    [switch]$Patch
  )
  $names = @(
    'title', 'description', 'status', 'priority', 'labels', 'assignee',
    'startDate', 'dueDate', 'relationIds', 'branch', 'worktree', 'providerThreadId')
  $actual = @(Get-AuraTaskboardPropertyNames -Value $Value)
  $unknownNames = @($actual | Where-Object { $_ -cnotin $names })
  if ($null -eq $Value -or $Value -is [string] -or $Value -is [Array] -or
      $actual.Count -eq 0 -or $unknownNames.Count -gt 0) {
    throw 'Task fields have an invalid shape.'
  }
  if (-not $Patch -and $actual.Count -ne $names.Count) {
    throw 'Task fields are incomplete.'
  }
  foreach ($name in $actual) {
    $field = Get-AuraTaskboardProperty -Value $Value -Name $name
    switch -CaseSensitive ($name) {
      'title' {
        if ($field -isnot [string] -or
            -not (Test-AuraTaskboardText -Value $field -Maximum 160 -Required)) {
          throw 'Task title is invalid.'
        }
        break
      }
      'description' {
        if ($field -isnot [string] -or
            -not (Test-AuraTaskboardText -Value $field -Maximum 4000)) {
          throw 'Task description is invalid.'
        }
        break
      }
      'status' {
        if ($field -isnot [string] -or
            $field -cnotin @('todo', 'in-progress', 'needs-input', 'review', 'blocked')) {
          throw 'Task status is invalid.'
        }
        break
      }
      'priority' {
        if ($field -isnot [string] -or $field -cnotin $script:AuraTaskboardPriorities) {
          throw 'Task priority is invalid.'
        }
        break
      }
      'labels' {
        [void](ConvertTo-AuraTaskboardStringArray `
          -Value $field -MaximumCount 8 -MaximumLength 32 -Label 'Task labels')
        break
      }
      'relationIds' {
        [void](ConvertTo-AuraTaskboardStringArray `
          -Value $field -MaximumCount 16 -MaximumLength 36 -Label 'Task relations' -Uuid)
        break
      }
      'startDate' { if (-not (Test-AuraTaskboardDate -Value $field)) { throw 'Task start date is invalid.' }; break }
      'dueDate' { if (-not (Test-AuraTaskboardDate -Value $field)) { throw 'Task due date is invalid.' }; break }
      'assignee' {
        if ($field -isnot [string] -or -not (Test-AuraTaskboardText -Value $field -Maximum 80)) {
          throw 'Task assignee is invalid.'
        }
        break
      }
      'branch' {
        if ($field -isnot [string] -or -not (Test-AuraTaskboardText -Value $field -Maximum 160)) {
          throw 'Task branch is invalid.'
        }
        break
      }
      'worktree' {
        if ($field -isnot [string] -or -not (Test-AuraTaskboardText -Value $field -Maximum 520)) {
          throw 'Task worktree is invalid.'
        }
        break
      }
      'providerThreadId' {
        if ($field -isnot [string] -or -not (Test-AuraTaskboardText -Value $field -Maximum 160)) {
          throw 'Task provider thread is invalid.'
        }
        break
      }
    }
  }
}

function Assert-AuraTaskboardSessionMutation {
  param(
    [Parameter(Mandatory = $true)][object]$Value,
    [switch]$ProviderObservation,
    [switch]$Reset
  )
  $names = if ($Reset) {
    @('id', 'taskVersion', 'providerThreadId')
  } elseif ($ProviderObservation) {
    @('id', 'taskVersion', 'providerThreadId', 'state', 'reason')
  } else {
    @('id', 'taskVersion', 'providerThreadId', 'reason')
  }
  Assert-AuraTaskboardExactShape -Value $Value -Names $names -Label 'Task session mutation'
  $id = Get-AuraTaskboardProperty -Value $Value -Name 'id'
  $taskVersion = Get-AuraTaskboardProperty -Value $Value -Name 'taskVersion'
  $providerThreadId = Get-AuraTaskboardProperty -Value $Value -Name 'providerThreadId'
  $reason = if ($Reset) { $null } else { Get-AuraTaskboardProperty -Value $Value -Name 'reason' }
  if ($id -isnot [string] -or -not (Test-AuraTaskboardUuid -Value $id) -or
      -not (Test-AuraTaskboardInteger -Value $taskVersion -Minimum 1 -Maximum 2147483647) -or
      $providerThreadId -isnot [string] -or
        -not (Test-AuraTaskboardText -Value $providerThreadId -Maximum 160 -Required)) {
    throw 'Task session mutation identity is invalid.'
  }
  if ($Reset) { return }
  if ($ProviderObservation) {
    $state = Get-AuraTaskboardProperty -Value $Value -Name 'state'
    if ($state -isnot [string] -or $state -cnotin @('active', 'terminated') -or
        ($state -ceq 'active' -and $null -ne $reason) -or
        ($state -ceq 'terminated' -and ($reason -isnot [string] -or
          $reason -cnotin $script:AuraTaskboardSessionTerminationReasons))) {
      throw 'Observed task session state is invalid.'
    }
  } elseif ($reason -isnot [string] -or
      $reason -cnotin $script:AuraTaskboardSessionTerminationReasons) {
    throw 'Reported task session reason is invalid.'
  }
}

function Assert-AuraTaskboardStudioRequest {
  param([Parameter(Mandatory = $true)][object]$Message)
  $type = Get-AuraTaskboardProperty -Value $Message -Name 'type'
  if ($type -ceq 'taskboard-read') {
    Assert-AuraTaskboardExactShape -Value $Message `
      -Names @('type', 'version', 'requestId') -Label 'Taskboard read request'
  } elseif ($type -ceq 'taskboard-mutate') {
    Assert-AuraTaskboardExactShape -Value $Message `
      -Names @('type', 'version', 'requestId', 'session', 'revision',
        'commandEpoch', 'operation', 'payload') `
      -Label 'Taskboard mutation request'
  } else {
    throw 'Taskboard request type is invalid.'
  }
  $version = Get-AuraTaskboardProperty -Value $Message -Name 'version'
  $requestId = Get-AuraTaskboardProperty -Value $Message -Name 'requestId'
  if (-not (Test-AuraTaskboardInteger -Value $version -Minimum 1 -Maximum 1) -or
      $requestId -isnot [string] -or -not (Test-AuraTaskboardUuid -Value $requestId)) {
    throw 'Taskboard request identity is invalid.'
  }
  if ($type -ceq 'taskboard-read') { return }
  $session = Get-AuraTaskboardProperty -Value $Message -Name 'session'
  $revision = Get-AuraTaskboardProperty -Value $Message -Name 'revision'
  $commandEpoch = Get-AuraTaskboardProperty -Value $Message -Name 'commandEpoch'
  $operation = Get-AuraTaskboardProperty -Value $Message -Name 'operation'
  $payload = Get-AuraTaskboardProperty -Value $Message -Name 'payload'
  if ($session -isnot [string] -or -not (Test-AuraTaskboardUuid -Value $session) -or
      -not (Test-AuraTaskboardInteger -Value $revision -Maximum 2147483647) -or
      -not (Test-AuraTaskboardInteger -Value $commandEpoch -Minimum 1 -Maximum 2147483647) -or
      $operation -isnot [string] -or $operation -cnotin @(
        'create-task', 'update-task', 'add-comment', 'accept-task',
        'delete-task', 'update-project', 'open-task', 'open-destination',
        'activate-tab', 'close-tab', 'reorder-tab', 'queue-draft', 'queue-placement',
        'queue-resolve', 'report-session-termination', 'reset-session-state')) {
    throw 'Taskboard mutation metadata is invalid.'
  }
  switch -CaseSensitive ($operation) {
    'create-task' { Assert-AuraTaskboardTaskFields -Value $payload; break }
    'update-task' {
      Assert-AuraTaskboardExactShape -Value $payload `
        -Names @('id', 'taskVersion', 'patch') -Label 'Task update'
      Assert-AuraTaskboardTaskFields `
        -Value (Get-AuraTaskboardProperty -Value $payload -Name 'patch') -Patch
      break
    }
    'add-comment' {
      Assert-AuraTaskboardExactShape -Value $payload `
        -Names @('id', 'taskVersion', 'body') -Label 'Task comment mutation'
      $body = Get-AuraTaskboardProperty -Value $payload -Name 'body'
      if ($body -isnot [string] -or
          -not (Test-AuraTaskboardText -Value $body -Maximum 2000 -Required)) {
        throw 'Task comment body is invalid.'
      }
      break
    }
    'accept-task' {
      Assert-AuraTaskboardExactShape -Value $payload `
        -Names @('id', 'taskVersion') -Label 'Task acceptance'
      break
    }
    'report-session-termination' {
      Assert-AuraTaskboardSessionMutation -Value $payload
      break
    }
    'reset-session-state' {
      Assert-AuraTaskboardSessionMutation -Value $payload -Reset
      break
    }
    'delete-task' {
      Assert-AuraTaskboardExactShape -Value $payload `
        -Names @('id', 'taskVersion') -Label 'Task deletion'
      break
    }
    'open-task' {
      Assert-AuraTaskboardExactShape -Value $payload `
        -Names @('id', 'newTab') -Label 'Task open'
      $newTab = Get-AuraTaskboardProperty -Value $payload -Name 'newTab'
      if ($newTab -isnot [bool]) { throw 'Task open mode is invalid.' }
      break
    }
    'open-destination' {
      Assert-AuraTaskboardExactShape -Value $payload `
        -Names @('destinationId', 'newTab') -Label 'Destination open'
      $destinationId = Get-AuraTaskboardProperty -Value $payload -Name 'destinationId'
      $newTab = Get-AuraTaskboardProperty -Value $payload -Name 'newTab'
      if ($destinationId -isnot [string] -or
          -not (Test-AuraTaskboardText -Value $destinationId -Maximum 220 -Required) -or
          $newTab -isnot [bool]) {
        throw 'Destination open is invalid.'
      }
      break
    }
    { $_ -ceq 'activate-tab' -or $_ -ceq 'close-tab' } {
      Assert-AuraTaskboardExactShape -Value $payload `
        -Names @('tabId') -Label 'Tab action'
      $tabId = Get-AuraTaskboardProperty -Value $payload -Name 'tabId'
      if ($tabId -isnot [string] -or -not (Test-AuraTaskboardUuid -Value $tabId)) {
        throw 'Tab action identity is invalid.'
      }
      break
    }
    'reorder-tab' {
      Assert-AuraTaskboardExactShape -Value $payload `
        -Names @('tabId', 'index') -Label 'Tab reorder'
      $tabId = Get-AuraTaskboardProperty -Value $payload -Name 'tabId'
      $index = Get-AuraTaskboardProperty -Value $payload -Name 'index'
      if ($tabId -isnot [string] -or -not (Test-AuraTaskboardUuid -Value $tabId) -or
          -not (Test-AuraTaskboardInteger -Value $index -Maximum ($script:AuraTaskboardMaximumTabs - 1))) {
        throw 'Tab reorder is invalid.'
      }
      break
    }
    'update-project' {
      Assert-AuraTaskboardExactShape -Value $payload `
        -Names @('name') -Label 'Project update'
      $name = Get-AuraTaskboardProperty -Value $payload -Name 'name'
      if ($name -isnot [string] -or
          -not (Test-AuraTaskboardText -Value $name -Maximum 80 -Required)) {
        throw 'Project name is invalid.'
      }
      break
    }
    'queue-draft' {
      Assert-AuraTaskboardExactShape -Value $payload `
        -Names @('taskId', 'taskVersion', 'draftId', 'draftFingerprint', 'localTargetId', 'priority') `
        -Label 'Action Queue mutation'
      $taskId = Get-AuraTaskboardProperty -Value $payload -Name 'taskId'
      $taskVersion = Get-AuraTaskboardProperty -Value $payload -Name 'taskVersion'
      $draftId = Get-AuraTaskboardProperty -Value $payload -Name 'draftId'
      $draftFingerprint = Get-AuraTaskboardProperty -Value $payload -Name 'draftFingerprint'
      $localTargetId = Get-AuraTaskboardProperty -Value $payload -Name 'localTargetId'
      $priority = Get-AuraTaskboardProperty -Value $payload -Name 'priority'
      if ($taskId -isnot [string] -or -not (Test-AuraTaskboardUuid -Value $taskId) -or
          -not (Test-AuraTaskboardInteger -Value $taskVersion -Minimum 1 -Maximum 2147483647) -or
          $draftId -isnot [string] -or -not (Test-AuraTaskboardDraftId -Value $draftId) -or
          $draftFingerprint -isnot [string] -or $draftFingerprint -cnotmatch '^[a-f0-9]{64}$' -or
          $localTargetId -isnot [string] -or
            -not (Test-AuraTaskboardLocalTargetId -Value $localTargetId) -or
          -not (Test-AuraTaskboardInteger -Value $priority -Minimum -100 -Maximum 100)) {
        throw 'Action Queue mutation is invalid.'
      }
      break
    }
    'queue-placement' {
      Assert-AuraTaskboardExactShape -Value $payload `
        -Names @('commandId', 'draftFingerprint', 'outcome') -Label 'Action Queue placement'
      $commandId = Get-AuraTaskboardProperty -Value $payload -Name 'commandId'
      $draftFingerprint = Get-AuraTaskboardProperty -Value $payload -Name 'draftFingerprint'
      $outcome = Get-AuraTaskboardProperty -Value $payload -Name 'outcome'
      if ($commandId -isnot [string] -or -not (Test-AuraTaskboardUuid -Value $commandId) -or
          $draftFingerprint -isnot [string] -or $draftFingerprint -cnotmatch '^[a-f0-9]{64}$' -or
          $outcome -isnot [string] -or $outcome -cnotin @('inserted', 'uncertain')) {
        throw 'Action Queue placement is invalid.'
      }
      break
    }
    'queue-resolve' {
      Assert-AuraTaskboardExactShape -Value $payload `
        -Names @('commandId', 'outcome') -Label 'Action Queue resolution'
      $commandId = Get-AuraTaskboardProperty -Value $payload -Name 'commandId'
      $outcome = Get-AuraTaskboardProperty -Value $payload -Name 'outcome'
      if ($commandId -isnot [string] -or -not (Test-AuraTaskboardUuid -Value $commandId) -or
          $outcome -isnot [string] -or $outcome -cnotin @('sent', 'cancelled')) {
        throw 'Action Queue resolution is invalid.'
      }
      break
    }
  }
  if ($operation -in @('update-task', 'add-comment', 'accept-task', 'delete-task', 'open-task')) {
    $id = Get-AuraTaskboardProperty -Value $payload -Name 'id'
    if ($id -isnot [string] -or -not (Test-AuraTaskboardUuid -Value $id)) {
      throw 'Task mutation identity is invalid.'
    }
    if ($operation -cne 'open-task') {
      $taskVersion = Get-AuraTaskboardProperty -Value $payload -Name 'taskVersion'
      if (-not (Test-AuraTaskboardInteger -Value $taskVersion -Minimum 1 -Maximum 2147483647)) {
        throw 'Task mutation identity is invalid.'
      }
    }
  }
}

function Send-AuraTaskboardStudioMessage {
  param([Parameter(Mandatory = $true)][object]$Message)
  if ($null -eq $script:StudioWebView -or $script:StudioWebView.IsDisposed -or
      $null -eq $script:StudioWebView.CoreWebView2) { return $false }
  try {
    $json = $Message | ConvertTo-Json -Depth 14 -Compress
    if ($json.Length -gt 4 * 1024 * 1024) { throw 'Taskboard response exceeds its limit.' }
    $script:StudioWebView.CoreWebView2.PostWebMessageAsJson($json)
    return $true
  } catch {
    Write-AuraTaskboardEvent -Code 'studio-response-failed'
    return $false
  }
}

function Get-AuraTaskboardLocalSessions {
  $fallback = [PSCustomObject][ordered]@{
    schemaVersion = 1
    available = $false
    sessions = @()
  }
  try {
    $helper = Join-Path $Root 'scripts\codex-session-index.mjs'
    if (-not (Test-Path -LiteralPath $helper -PathType Leaf)) { return $fallback }
    $raw = Invoke-AuraUiNode -PrivateDiagnostics -CommandArguments @($helper, '--limit', '12')
    if ($raw -isnot [string] -or $raw.Length -lt 2 -or $raw.Length -gt 64 * 1024) {
      throw 'Codex session projection has an invalid size.'
    }
    $value = $raw | ConvertFrom-Json
    $names = @(Get-AuraTaskboardPropertyNames -Value $value)
    if ($names.Count -ne 3 -or $names -cnotcontains 'schemaVersion' -or
        $names -cnotcontains 'available' -or $names -cnotcontains 'sessions' -or
        $value.schemaVersion -ne 1 -or $value.available -isnot [bool] -or
        $value.sessions -is [string] -or @($value.sessions).Count -gt 20) {
      throw 'Codex session projection is invalid.'
    }
    $ids = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    $sessions = @()
    foreach ($item in @($value.sessions)) {
      $itemNames = @(Get-AuraTaskboardPropertyNames -Value $item)
      if ($itemNames.Count -ne 6 -or $itemNames -cnotcontains 'id' -or
          $itemNames -cnotcontains 'title' -or $itemNames -cnotcontains 'updatedAt' -or
          $itemNames -cnotcontains 'workspace' -or $itemNames -cnotcontains 'branch' -or
          $itemNames -cnotcontains 'pinned' -or $item.id -isnot [string] -or
          [string]$item.id -cnotmatch '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' -or
          -not $ids.Add([string]$item.id) -or $item.title -isnot [string] -or
          -not (Test-AuraTaskboardText -Value ([string]$item.title) -Maximum 160 -Required) -or
          -not (Test-AuraTaskboardInteger -Value $item.updatedAt -Minimum 0) -or
          $item.workspace -isnot [string] -or
          -not (Test-AuraTaskboardText -Value ([string]$item.workspace) -Maximum 120) -or
          $item.branch -isnot [string] -or
          -not (Test-AuraTaskboardText -Value ([string]$item.branch) -Maximum 160) -or
          $item.pinned -isnot [bool]) {
        throw 'Codex session projection row is invalid.'
      }
      $sessions += [PSCustomObject][ordered]@{
        id = [string]$item.id
        title = [string]$item.title
        updatedAt = [long]$item.updatedAt
        workspace = [string]$item.workspace
        branch = [string]$item.branch
        pinned = [bool]$item.pinned
      }
    }
    return [PSCustomObject][ordered]@{
      schemaVersion = 1
      available = [bool]$value.available
      sessions = @($sessions)
    }
  } catch {
    Write-AuraTaskboardEvent -Code 'codex-session-index-unavailable'
    return $fallback
  }
}

function Send-AuraTaskboardStudioDocument {
  param(
    [Parameter(Mandatory = $true)][string]$Type,
    [Parameter(Mandatory = $true)][string]$RequestId,
    [Parameter(Mandatory = $true)][bool]$Ok,
    [Parameter(Mandatory = $true)][string]$Code,
    [Parameter(Mandatory = $true)][object]$Document
  )
  [void](Send-AuraTaskboardStudioMessage -Message ([ordered]@{
    type = $Type
    version = 1
    requestId = $RequestId
    session = $script:AuraTaskboardSession
    revision = [long]$Document.revision
    commandEpoch = [long]$script:AuraTaskboardCommandEpoch
    ok = $Ok
    code = $Code
    document = $Document
    localSessions = Get-AuraTaskboardLocalSessions
  }))
}

function Send-AuraTaskboardStudioFailure {
  param([AllowEmptyString()][string]$RequestId = '')
  if (-not (Test-AuraTaskboardUuid -Value $RequestId)) {
    $RequestId = New-AuraTaskboardUuid
  }
  [void](Send-AuraTaskboardStudioMessage -Message ([ordered]@{
    type = 'taskboard-result'
    version = 1
    requestId = $RequestId
    session = $script:AuraTaskboardSession
    revision = [long]-1
    commandEpoch = [long]$script:AuraTaskboardCommandEpoch
    ok = $false
    code = 'state-unavailable'
    document = $null
    localSessions = [PSCustomObject][ordered]@{
      schemaVersion = 1
      available = $false
      sessions = @()
    }
  }))
}

function Add-AuraTaskboardActivity {
  param(
    [Parameter(Mandatory = $true)][object]$Document,
    [AllowNull()][object]$TaskId,
    [Parameter(Mandatory = $true)][string]$Kind,
    [Parameter(Mandatory = $true)][long]$At,
    [AllowNull()][object]$From,
    [AllowNull()][object]$To,
    [Parameter(Mandatory = $true)][string]$Evidence
  )
  $items = @($Document.activity) + [PSCustomObject][ordered]@{
    id = New-AuraTaskboardUuid
    taskId = $TaskId
    kind = $Kind
    at = $At
    from = $From
    to = $To
    evidence = $Evidence
  }
  if ($items.Count -gt $script:AuraTaskboardMaximumActivity) {
    $items = @($items | Select-Object -Last $script:AuraTaskboardMaximumActivity)
  }
  $Document.activity = @($items)
}

function Add-AuraTaskboardQueueReceipt {
  param(
    [Parameter(Mandatory = $true)][object]$Document,
    [Parameter(Mandatory = $true)][string]$CommandId,
    [Parameter(Mandatory = $true)][string]$Stage,
    [Parameter(Mandatory = $true)][string]$Certainty,
    [Parameter(Mandatory = $true)][string]$DrainMode,
    [Parameter(Mandatory = $true)][string]$StatusApplicationMode,
    [Parameter(Mandatory = $true)][string]$EvidenceClass,
    [Parameter(Mandatory = $true)][long]$At
  )
  if (@($Document.receipts).Count -ge $script:AuraTaskboardMaximumQueueReceipts) {
    throw 'Action Queue receipt limit is reached.'
  }
  $receipt = [PSCustomObject][ordered]@{
    id = New-AuraTaskboardUuid
    commandId = $CommandId
    stage = $Stage
    certainty = $Certainty
    drainMode = $DrainMode
    statusApplicationMode = $StatusApplicationMode
    evidenceClass = $EvidenceClass
    at = [long]$At
  }
  $candidate = @($Document.receipts) + $receipt
  [void](ConvertTo-AuraTaskboardQueueReceipts -Value $candidate)
  $Document.receipts = @($candidate)
}

function Find-AuraTaskboardTaskIndex {
  param(
    [Parameter(Mandatory = $true)][object]$Document,
    [Parameter(Mandatory = $true)][string]$Id
  )
  for ($index = 0; $index -lt $Document.tasks.Count; $index += 1) {
    if ([string]$Document.tasks[$index].id -ceq $Id) { return $index }
  }
  return -1
}

function Resolve-AuraTaskboardDestination {
  param(
    [Parameter(Mandatory = $true)][object]$Document,
    [Parameter(Mandatory = $true)][string]$DestinationId
  )
  if ($DestinationId -ceq 'work-hub') {
    return [PSCustomObject]@{
      Id = 'work-hub'; Type = 'work-hub'; SafeTitle = 'Work Hub'; TaskId = $null
    }
  }
  $workRoutes = @{
    'action-queue' = 'Action Queue'
    attention = 'Needs Attention'
    recent = 'Recent'
    projects = 'Projects'
  }
  if ($workRoutes.ContainsKey($DestinationId)) {
    return [PSCustomObject]@{
      Id = $DestinationId; Type = $DestinationId
      SafeTitle = $workRoutes[$DestinationId]; TaskId = $null
    }
  }
  if ($DestinationId -cmatch '^task:(?<id>[a-f0-9-]{36})$' -and
      (Test-AuraTaskboardUuid -Value $Matches.id)) {
    $index = Find-AuraTaskboardTaskIndex -Document $Document -Id $Matches.id
    if ($index -lt 0) { return $null }
    $task = $Document.tasks[$index]
    return [PSCustomObject]@{
      Id = $DestinationId; Type = 'task'; SafeTitle = [string]$task.title; TaskId = [string]$task.id
    }
  }
  if ($DestinationId -ceq "project:$($Document.project.id)") {
    return [PSCustomObject]@{
      Id = $DestinationId; Type = 'project'; SafeTitle = [string]$Document.project.name; TaskId = $null
    }
  }
  $studioTitles = @{
    'studio:tasks' = 'Tasks'
    'studio:themes' = 'Themes'
    'studio:background' = 'Personal wallpaper'
    'studio:create' = 'Create a theme'
    'studio:settings' = 'Settings'
  }
  if ($studioTitles.ContainsKey($DestinationId)) {
    return [PSCustomObject]@{
      Id = $DestinationId; Type = 'studio-page'; SafeTitle = $studioTitles[$DestinationId]; TaskId = $null
    }
  }
  return $null
}

function Apply-AuraTaskboardNavigation {
  param(
    [Parameter(Mandatory = $true)][object]$Document,
    [Parameter(Mandatory = $true)][ValidateSet('open', 'activate', 'close', 'reorder')][string]$Action,
    [Parameter(Mandatory = $true)][object]$Payload
  )
  if ($Action -ceq 'open') {
    $destinationId = [string](Get-AuraTaskboardProperty -Value $Payload -Name 'destinationId')
    $newTab = [bool](Get-AuraTaskboardProperty -Value $Payload -Name 'newTab')
    $destination = Resolve-AuraTaskboardDestination -Document $Document -DestinationId $destinationId
    if ($null -eq $destination) {
      return [PSCustomObject]@{ Ok = $false; Code = 'destination-unavailable' }
    }
    if ([string]$destination.Type -ceq 'work-hub') {
      $Document.navigation.activeTabId = $null
      $Document.revision = [long]$Document.revision + 1
      return [PSCustomObject]@{
        Ok = $true; Code = 'work-hub-pinned'; DestinationId = 'work-hub'; TaskId = $null
      }
    }
    $matchingTabs = @($Document.navigation.tabs | Where-Object {
      [string]$_.destinationId -ceq $destinationId
    })
    if (-not $newTab -and $matchingTabs.Count -gt 0) {
      $target = @($matchingTabs | Where-Object {
        [string]$_.id -ceq [string]$Document.navigation.activeTabId
      } | Select-Object -First 1)
      if ($target.Count -eq 0) { $target = @($matchingTabs[0]) }
      $Document.navigation.activeTabId = [string]$target[0].id
      $Document.revision = [long]$Document.revision + 1
      return [PSCustomObject]@{
        Ok = $true; Code = 'tab-focused'; DestinationId = $destinationId; TaskId = $destination.TaskId
      }
    }
    if ($Document.navigation.tabs.Count -ge $script:AuraTaskboardMaximumTabs) {
      return [PSCustomObject]@{ Ok = $false; Code = 'tab-limit' }
    }
    $tabId = New-AuraTaskboardUuid
    $Document.navigation.tabs = @($Document.navigation.tabs) + [PSCustomObject][ordered]@{
      id = $tabId
      destinationId = [string]$destination.Id
      destinationType = [string]$destination.Type
      safeTitle = [string]$destination.SafeTitle
    }
    $Document.navigation.activeTabId = $tabId
    $Document.revision = [long]$Document.revision + 1
    return [PSCustomObject]@{
      Ok = $true
      Code = if ($matchingTabs.Count -gt 0) { 'tab-duplicated' } else { 'tab-opened' }
      DestinationId = $destinationId
      TaskId = $destination.TaskId
    }
  }

  $tabId = [string](Get-AuraTaskboardProperty -Value $Payload -Name 'tabId')
  $tabIndex = -1
  for ($index = 0; $index -lt $Document.navigation.tabs.Count; $index += 1) {
    if ([string]$Document.navigation.tabs[$index].id -ceq $tabId) {
      $tabIndex = $index
      break
    }
  }
  if ($tabIndex -lt 0) { return [PSCustomObject]@{ Ok = $false; Code = 'tab-missing' } }
  $tab = $Document.navigation.tabs[$tabIndex]
  if ($Action -ceq 'reorder') {
    $targetIndex = [int](Get-AuraTaskboardProperty -Value $Payload -Name 'index')
    if ($targetIndex -lt 0 -or $targetIndex -ge $Document.navigation.tabs.Count) {
      return [PSCustomObject]@{ Ok = $false; Code = 'tab-index-invalid' }
    }
    $ordered = [Collections.Generic.List[object]]::new()
    foreach ($item in @($Document.navigation.tabs)) { $ordered.Add($item) }
    $ordered.RemoveAt($tabIndex)
    $ordered.Insert($targetIndex, $tab)
    $Document.navigation.tabs = @($ordered)
    $Document.revision = [long]$Document.revision + 1
    return [PSCustomObject]@{
      Ok = $true; Code = 'tab-reordered'; DestinationId = [string]$tab.destinationId; TaskId = $null
    }
  }
  if ($Action -ceq 'activate') {
    $Document.navigation.activeTabId = $tabId
    $Document.revision = [long]$Document.revision + 1
    $resolved = Resolve-AuraTaskboardDestination `
      -Document $Document -DestinationId ([string]$tab.destinationId)
    return [PSCustomObject]@{
      Ok = $true
      Code = 'tab-activated'
      DestinationId = [string]$tab.destinationId
      TaskId = if ($null -eq $resolved) { $null } else { $resolved.TaskId }
    }
  }
  $Document.navigation.tabs = @(
    for ($index = 0; $index -lt $Document.navigation.tabs.Count; $index += 1) {
      if ($index -ne $tabIndex) { $Document.navigation.tabs[$index] }
    })
  if ($Document.navigation.tabs.Count -eq 0) {
    $Document.navigation.activeTabId = $null
  } elseif ([string]$Document.navigation.activeTabId -ceq $tabId) {
    $nextIndex = [Math]::Min($tabIndex, $Document.navigation.tabs.Count - 1)
    $Document.navigation.activeTabId = [string]$Document.navigation.tabs[$nextIndex].id
  }
  $Document.revision = [long]$Document.revision + 1
  return [PSCustomObject]@{
    Ok = $true; Code = 'tab-closed'; DestinationId = [string]$tab.destinationId; TaskId = $null
  }
}

function Apply-AuraTaskboardMutation {
  param(
    [Parameter(Mandatory = $true)][object]$Document,
    [Parameter(Mandatory = $true)][string]$Operation,
    [Parameter(Mandatory = $true)][object]$Payload
  )
  $now = Get-AuraTaskboardNow
  if ($Operation -ceq 'report-session-termination') {
    Assert-AuraTaskboardSessionMutation -Value $Payload
  } elseif ($Operation -ceq 'reset-session-state') {
    Assert-AuraTaskboardSessionMutation -Value $Payload -Reset
  } elseif ($Operation -ceq 'touch-current-session') {
    # taskctl is invoked by the running Codex task itself. This is local
    # runtime evidence that the exact linked thread is active; it is not a
    # provider lifecycle observation.
    Assert-AuraTaskboardSessionMutation -Value $Payload -Reset
  } elseif ($Operation -ceq 'observe-session-state') {
    Assert-AuraTaskboardSessionMutation -Value $Payload -ProviderObservation
  }
  if ($Operation -ceq 'update-project') {
    $Document.project.name = [string](Get-AuraTaskboardProperty -Value $Payload -Name 'name')
    foreach ($tab in @($Document.navigation.tabs)) {
      if ([string]$tab.destinationId -ceq "project:$($Document.project.id)") {
        $tab.safeTitle = [string]$Document.project.name
      }
    }
    $Document.project.updatedAt = [long]$now
    $Document.revision = [long]$Document.revision + 1
    return [PSCustomObject]@{ Ok = $true; Code = 'updated' }
  }
  if ($Operation -ceq 'create-task') {
    if ($Document.tasks.Count -ge $script:AuraTaskboardMaximumTasks) {
      return [PSCustomObject]@{ Ok = $false; Code = 'task-limit' }
    }
    $id = New-AuraTaskboardUuid
    $providerThreadId = [string](Get-AuraTaskboardProperty -Value $Payload -Name 'providerThreadId')
    $hasLinkedSession = -not [string]::IsNullOrWhiteSpace($providerThreadId)
    $task = [PSCustomObject][ordered]@{
      id = $id
      number = [int]$Document.nextTaskNumber
      version = 1
      title = [string](Get-AuraTaskboardProperty -Value $Payload -Name 'title')
      description = [string](Get-AuraTaskboardProperty -Value $Payload -Name 'description')
      status = [string](Get-AuraTaskboardProperty -Value $Payload -Name 'status')
      priority = [string](Get-AuraTaskboardProperty -Value $Payload -Name 'priority')
      labels = Get-AuraTaskboardProperty -Value $Payload -Name 'labels'
      assignee = [string](Get-AuraTaskboardProperty -Value $Payload -Name 'assignee')
      startDate = Get-AuraTaskboardProperty -Value $Payload -Name 'startDate'
      dueDate = Get-AuraTaskboardProperty -Value $Payload -Name 'dueDate'
      relationIds = Get-AuraTaskboardProperty -Value $Payload -Name 'relationIds'
      comments = @()
      branch = [string](Get-AuraTaskboardProperty -Value $Payload -Name 'branch')
      worktree = [string](Get-AuraTaskboardProperty -Value $Payload -Name 'worktree')
      providerThreadId = $providerThreadId
      sessionState = if ($hasLinkedSession) { 'linked' } else { 'unlinked' }
      sessionTerminationReason = $null
      sessionEvidence = if ($hasLinkedSession) { 'local' } else { $null }
      sessionUpdatedAt = if ($hasLinkedSession) { [long]$now } else { $null }
      createdAt = [long]$now
      updatedAt = [long]$now
      acceptedAt = $null
    }
    [void](ConvertTo-AuraTaskboardTask -Value $task)
    $Document.tasks = @($Document.tasks) + $task
    $Document.nextTaskNumber = [int]$Document.nextTaskNumber + 1
    $Document.project.updatedAt = [long]$now
    $Document.revision = [long]$Document.revision + 1
    Add-AuraTaskboardActivity -Document $Document -TaskId $id `
      -Kind 'created' -At $now -From $null -To $task.status -Evidence 'local'
    return [PSCustomObject]@{ Ok = $true; Code = 'created' }
  }

  if ($Operation -ceq 'queue-draft') {
    if ($Document.queue.Count -ge $script:AuraTaskboardMaximumQueueItems) {
      return [PSCustomObject]@{ Ok = $false; Code = 'queue-limit' }
    }
    if (@($Document.receipts).Count -ge $script:AuraTaskboardMaximumQueueReceipts) {
      return [PSCustomObject]@{ Ok = $false; Code = 'queue-receipt-limit' }
    }
    $taskId = [string](Get-AuraTaskboardProperty -Value $Payload -Name 'taskId')
    $taskIndex = Find-AuraTaskboardTaskIndex -Document $Document -Id $taskId
    if ($taskIndex -lt 0) {
      return [PSCustomObject]@{ Ok = $false; Code = 'task-missing' }
    }
    $task = $Document.tasks[$taskIndex]
    $taskVersion = [int](Get-AuraTaskboardProperty -Value $Payload -Name 'taskVersion')
    if ([int]$task.version -ne $taskVersion) {
      return [PSCustomObject]@{ Ok = $false; Code = 'task-version-conflict' }
    }
    if ([string]$task.status -ceq 'done') {
      return [PSCustomObject]@{ Ok = $false; Code = 'accepted-task-locked' }
    }
    $draftId = [string](Get-AuraTaskboardProperty -Value $Payload -Name 'draftId')
    $terminalStatuses = @('sent', 'completed', 'failed', 'cancelled')
    if (@($Document.queue | Where-Object {
      [string]$_.draftId -ceq $draftId -and [string]$_.status -notin $terminalStatuses
    }).Count -gt 0) {
      return [PSCustomObject]@{ Ok = $false; Code = 'draft-already-queued' }
    }
    $localTargetId = [string](Get-AuraTaskboardProperty -Value $Payload -Name 'localTargetId')
    $targetItems = @($Document.queue | Where-Object {
      [string]$_.localTargetId -ceq $localTargetId -and [long]$_.adapterEpoch -eq 0
    })
    $sequence = [long]0
    if ($targetItems.Count -gt 0) {
      $sequence = [long](($targetItems | Measure-Object -Property sequence -Maximum).Maximum) + 1
    }
    $activeTargetItems = @($targetItems | Where-Object {
      [string]$_.status -notin $terminalStatuses
    })
    $queueItem = [PSCustomObject][ordered]@{
      commandId = New-AuraTaskboardUuid
      draftId = $draftId
      draftFingerprint = [string](Get-AuraTaskboardProperty -Value $Payload -Name 'draftFingerprint')
      taskId = $taskId
      localTargetId = $localTargetId
      adapterKind = 'claude-ai-assisted'
      adapterEpoch = [long]0
      sequence = $sequence
      causationCommandId = $null
      status = 'queued'
      position = [int]$activeTargetItems.Count
      priority = [int](Get-AuraTaskboardProperty -Value $Payload -Name 'priority')
      receiptStage = 'local_enqueued'
      receiptCertainty = 'certain'
      drainMode = 'user_mediated'
      statusApplicationMode = 'automatic'
      statusEvidenceClass = 'local'
      createdAt = [long]$now
      updatedAt = [long]$now
    }
    [void](ConvertTo-AuraTaskboardQueue -Value @($queueItem))
    $Document.queue = @($Document.queue) + $queueItem
    Add-AuraTaskboardQueueReceipt -Document $Document -CommandId $queueItem.commandId `
      -Stage 'local_enqueued' -Certainty 'certain' -DrainMode 'user_mediated' `
      -StatusApplicationMode 'automatic' -EvidenceClass 'local' -At $now
    $Document.project.updatedAt = [long]$now
    $Document.revision = [long]$Document.revision + 1
    return [PSCustomObject]@{ Ok = $true; Code = 'draft-queued' }
  }

  if ($Operation -ceq 'queue-placement') {
    if (@($Document.receipts).Count -ge $script:AuraTaskboardMaximumQueueReceipts) {
      return [PSCustomObject]@{ Ok = $false; Code = 'queue-receipt-limit' }
    }
    $commandId = [string](Get-AuraTaskboardProperty -Value $Payload -Name 'commandId')
    $queueIndex = -1
    for ($index = 0; $index -lt $Document.queue.Count; $index += 1) {
      if ([string]$Document.queue[$index].commandId -ceq $commandId) {
        $queueIndex = $index
        break
      }
    }
    if ($queueIndex -lt 0) {
      return [PSCustomObject]@{ Ok = $false; Code = 'queue-item-missing' }
    }
    $queueItem = $Document.queue[$queueIndex]
    if ([string]$queueItem.status -notin @('queued', 'uncertain')) {
      return [PSCustomObject]@{ Ok = $false; Code = 'queue-item-not-placeable' }
    }
    $draftFingerprint = [string](
      Get-AuraTaskboardProperty -Value $Payload -Name 'draftFingerprint')
    if ($draftFingerprint -cne [string]$queueItem.draftFingerprint) {
      return [PSCustomObject]@{ Ok = $false; Code = 'queue-draft-changed' }
    }
    $outcome = [string](Get-AuraTaskboardProperty -Value $Payload -Name 'outcome')
    if ($outcome -ceq 'inserted') {
      $queueItem.status = 'awaiting_user_action'
      $queueItem.receiptStage = 'draft_inserted'
      $queueItem.receiptCertainty = 'certain'
      $queueItem.drainMode = 'user_mediated'
      $queueItem.statusApplicationMode = 'user_mediated'
      $queueItem.statusEvidenceClass = 'transport'
    } else {
      $queueItem.status = 'uncertain'
      $queueItem.receiptStage = 'draft_inserted'
      $queueItem.receiptCertainty = 'uncertain'
      $queueItem.drainMode = 'retained'
      $queueItem.statusApplicationMode = 'user_mediated'
      $queueItem.statusEvidenceClass = 'transport'
    }
    $queueItem.updatedAt = [long]$now
    Add-AuraTaskboardQueueReceipt -Document $Document -CommandId $queueItem.commandId `
      -Stage 'draft_inserted' -Certainty $queueItem.receiptCertainty `
      -DrainMode $queueItem.drainMode `
      -StatusApplicationMode $queueItem.statusApplicationMode `
      -EvidenceClass $queueItem.statusEvidenceClass -At $now
    [void](ConvertTo-AuraTaskboardQueue -Value @($Document.queue))
    $Document.project.updatedAt = [long]$now
    $Document.revision = [long]$Document.revision + 1
    return [PSCustomObject]@{
      Ok = $true
      Code = if ($outcome -ceq 'inserted') { 'draft-inserted' } else { 'draft-placement-uncertain' }
    }
  }

  if ($Operation -ceq 'queue-resolve') {
    if (@($Document.receipts).Count -ge $script:AuraTaskboardMaximumQueueReceipts) {
      return [PSCustomObject]@{ Ok = $false; Code = 'queue-receipt-limit' }
    }
    $commandId = [string](Get-AuraTaskboardProperty -Value $Payload -Name 'commandId')
    $queueIndex = -1
    for ($index = 0; $index -lt $Document.queue.Count; $index += 1) {
      if ([string]$Document.queue[$index].commandId -ceq $commandId) {
        $queueIndex = $index
        break
      }
    }
    if ($queueIndex -lt 0) {
      return [PSCustomObject]@{ Ok = $false; Code = 'queue-item-missing' }
    }
    $queueItem = $Document.queue[$queueIndex]
    $outcome = [string](Get-AuraTaskboardProperty -Value $Payload -Name 'outcome')
    if ($outcome -ceq 'sent' -and [string]$queueItem.status -cne 'awaiting_user_action') {
      return [PSCustomObject]@{ Ok = $false; Code = 'queue-item-not-in-composer' }
    }
    if ($outcome -ceq 'cancelled' -and
        [string]$queueItem.status -in @('sent', 'completed', 'failed', 'cancelled')) {
      return [PSCustomObject]@{ Ok = $false; Code = 'queue-item-already-resolved' }
    }
    $queueItem.status = if ($outcome -ceq 'sent') { 'sent' } else { 'cancelled' }
    $queueItem.receiptStage = if ($outcome -ceq 'sent') {
      'user_reported_sent'
    } else { 'user_cancelled' }
    $queueItem.receiptCertainty = 'certain'
    $queueItem.drainMode = 'retained'
    $queueItem.statusApplicationMode = 'user_mediated'
    $queueItem.statusEvidenceClass = 'user_reported'
    $queueItem.updatedAt = [long]$now
    Add-AuraTaskboardQueueReceipt -Document $Document -CommandId $queueItem.commandId `
      -Stage $queueItem.receiptStage -Certainty 'certain' -DrainMode 'retained' `
      -StatusApplicationMode 'user_mediated' -EvidenceClass 'user_reported' -At $now
    $localTargetId = [string]$queueItem.localTargetId
    $activeTargetItems = @($Document.queue | Where-Object {
      [string]$_.localTargetId -ceq $localTargetId -and
        [string]$_.status -notin @('sent', 'completed', 'failed', 'cancelled')
    } | Sort-Object -Property position, sequence)
    for ($position = 0; $position -lt $activeTargetItems.Count; $position += 1) {
      $activeTargetItems[$position].position = [int]$position
    }
    [void](ConvertTo-AuraTaskboardQueue -Value @($Document.queue))
    $Document.project.updatedAt = [long]$now
    $Document.revision = [long]$Document.revision + 1
    return [PSCustomObject]@{
      Ok = $true
      Code = if ($outcome -ceq 'sent') { 'queue-item-sent' } else { 'queue-item-cancelled' }
    }
  }

  if ($Operation -ceq 'open-destination') {
    return Apply-AuraTaskboardNavigation `
      -Document $Document -Action 'open' -Payload $Payload
  }
  if ($Operation -in @('activate-tab', 'close-tab', 'reorder-tab')) {
    $action = switch -CaseSensitive ($Operation) {
      'activate-tab' { 'activate'; break }
      'close-tab' { 'close'; break }
      'reorder-tab' { 'reorder'; break }
    }
    $result = Apply-AuraTaskboardNavigation `
      -Document $Document -Action $action -Payload $Payload
    if ($result.Ok -and $Operation -ceq 'activate-tab' -and $null -ne $result.TaskId) {
      Add-AuraTaskboardActivity -Document $Document -TaskId ([string]$result.TaskId) `
        -Kind 'opened' -At $now -From $null -To $null -Evidence 'local'
    }
    return $result
  }

  $id = [string](Get-AuraTaskboardProperty -Value $Payload -Name 'id')
  $index = Find-AuraTaskboardTaskIndex -Document $Document -Id $id
  if ($index -lt 0) { return [PSCustomObject]@{ Ok = $false; Code = 'task-missing' } }
  $task = $Document.tasks[$index]
  if ($Operation -ceq 'open-task') {
    $navigationResult = Apply-AuraTaskboardNavigation `
      -Document $Document -Action 'open' -Payload ([PSCustomObject]@{
        destinationId = "task:$id"
        newTab = [bool](Get-AuraTaskboardProperty -Value $Payload -Name 'newTab')
      })
    if (-not $navigationResult.Ok) { return $navigationResult }
    Add-AuraTaskboardActivity -Document $Document -TaskId $id `
      -Kind 'opened' -At $now -From $null -To $null -Evidence 'local'
    return $navigationResult
  }
  $taskVersion = [int](Get-AuraTaskboardProperty -Value $Payload -Name 'taskVersion')
  if ([int]$task.version -ne $taskVersion) {
    return [PSCustomObject]@{ Ok = $false; Code = 'task-version-conflict' }
  }
  if ($Operation -in @(
      'report-session-termination', 'reset-session-state',
      'touch-current-session', 'observe-session-state')) {
    $providerThreadId = [string](Get-AuraTaskboardProperty -Value $Payload -Name 'providerThreadId')
    if ([string]::IsNullOrWhiteSpace([string]$task.providerThreadId) -or
        [string]$task.providerThreadId -cne $providerThreadId) {
      return [PSCustomObject]@{ Ok = $false; Code = 'session-link-mismatch' }
    }
    $priorState = [string]$task.sessionState
    if ($Operation -ceq 'touch-current-session') {
      $nextState = 'active'
      $reason = $null
      $evidence = 'local'
    } elseif ($Operation -ceq 'reset-session-state') {
      $nextState = 'linked'
      $reason = $null
      $evidence = 'local'
    } elseif ($Operation -ceq 'report-session-termination') {
      $nextState = 'terminated'
      $reason = [string](Get-AuraTaskboardProperty -Value $Payload -Name 'reason')
      $evidence = 'user-reported'
    } else {
      $nextState = [string](Get-AuraTaskboardProperty -Value $Payload -Name 'state')
      $reasonValue = Get-AuraTaskboardProperty -Value $Payload -Name 'reason'
      $reason = if ($null -eq $reasonValue) { $null } else { [string]$reasonValue }
      $evidence = 'provider-observed'
    }
    $task.sessionState = $nextState
    $task.sessionTerminationReason = $reason
    $task.sessionEvidence = $evidence
    $task.sessionUpdatedAt = [long]$now
    $task.updatedAt = [long]$now
    $task.version = [int]$task.version + 1
    $Document.project.updatedAt = [long]$now
    $Document.revision = [long]$Document.revision + 1
    Add-AuraTaskboardActivity -Document $Document -TaskId $id `
      -Kind 'session-state-changed' -At $now -From $priorState -To $nextState -Evidence $evidence
    $resultCode = if ($Operation -ceq 'reset-session-state') {
      'session-reset'
    } elseif ($nextState -ceq 'active') {
      'session-active'
    } else {
      'session-terminated'
    }
    return [PSCustomObject]@{
      Ok = $true
      Code = $resultCode
    }
  }
  if ($Operation -ceq 'delete-task') {
    $Document.tasks = @($Document.tasks | Where-Object { [string]$_.id -cne $id })
    foreach ($relatedTask in @($Document.tasks)) {
      $relatedTask.relationIds = @($relatedTask.relationIds | Where-Object { $_ -cne $id })
    }
    $Document.project.updatedAt = [long]$now
    $Document.revision = [long]$Document.revision + 1
    Add-AuraTaskboardActivity -Document $Document -TaskId $id `
      -Kind 'deleted' -At $now -From $task.status -To $null -Evidence 'local'
    return [PSCustomObject]@{ Ok = $true; Code = 'deleted' }
  }
  if ($task.status -ceq 'done') {
    return [PSCustomObject]@{ Ok = $false; Code = 'accepted-task-locked' }
  }
  if ($Operation -ceq 'accept-task') {
    if ($task.status -cne 'review') {
      return [PSCustomObject]@{ Ok = $false; Code = 'review-required' }
    }
    $priorStatus = [string]$task.status
    $task.status = 'done'
    $task.acceptedAt = [long]$now
    $task.updatedAt = [long]$now
    $task.version = [int]$task.version + 1
    foreach ($tab in @($Document.navigation.tabs)) {
      if ([string]$tab.destinationId -ceq "task:$id") {
        $tab.safeTitle = [string]$task.title
      }
    }
    $Document.project.updatedAt = [long]$now
    $Document.revision = [long]$Document.revision + 1
    Add-AuraTaskboardActivity -Document $Document -TaskId $id `
      -Kind 'accepted' -At $now -From $priorStatus -To 'done' -Evidence 'user-accepted'
    return [PSCustomObject]@{ Ok = $true; Code = 'accepted' }
  }
  if ($Operation -ceq 'add-comment') {
    if ($task.comments.Count -ge 100) {
      return [PSCustomObject]@{ Ok = $false; Code = 'comment-limit' }
    }
    $body = [string](Get-AuraTaskboardProperty -Value $Payload -Name 'body')
    $task.comments = @($task.comments) + [PSCustomObject][ordered]@{
      id = New-AuraTaskboardUuid
      body = $body
      createdAt = [long]$now
    }
    $task.updatedAt = [long]$now
    $task.version = [int]$task.version + 1
    $Document.project.updatedAt = [long]$now
    $Document.revision = [long]$Document.revision + 1
    Add-AuraTaskboardActivity -Document $Document -TaskId $id `
      -Kind 'commented' -At $now -From $null -To $null -Evidence 'local'
    return [PSCustomObject]@{ Ok = $true; Code = 'commented' }
  }
  if ($Operation -ceq 'update-task') {
    $patch = Get-AuraTaskboardProperty -Value $Payload -Name 'patch'
    $priorStatus = [string]$task.status
    $priorProviderThreadId = [string]$task.providerThreadId
    foreach ($name in @(Get-AuraTaskboardPropertyNames -Value $patch)) {
      $value = Get-AuraTaskboardProperty -Value $patch -Name $name
      if ($name -in @('labels', 'relationIds')) { $task.$name = @($value) }
      else { $task.$name = $value }
    }
    if ([string]$task.providerThreadId -cne $priorProviderThreadId) {
      $hasLinkedSession = -not [string]::IsNullOrWhiteSpace([string]$task.providerThreadId)
      $task.sessionState = if ($hasLinkedSession) { 'linked' } else { 'unlinked' }
      $task.sessionTerminationReason = $null
      $task.sessionEvidence = if ($hasLinkedSession) { 'local' } else { $null }
      $task.sessionUpdatedAt = if ($hasLinkedSession) { [long]$now } else { $null }
    }
    if (@($task.relationIds) -ccontains $id) {
      return [PSCustomObject]@{ Ok = $false; Code = 'relation-invalid' }
    }
    $knownIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($knownTask in @($Document.tasks)) { [void]$knownIds.Add([string]$knownTask.id) }
    foreach ($relationId in @($task.relationIds)) {
      if (-not $knownIds.Contains($relationId)) {
        return [PSCustomObject]@{ Ok = $false; Code = 'relation-invalid' }
      }
    }
    $task.updatedAt = [long]$now
    $task.version = [int]$task.version + 1
    $Document.project.updatedAt = [long]$now
    $Document.revision = [long]$Document.revision + 1
    $kind = if ($priorStatus -cne [string]$task.status) { 'status-changed' } else { 'updated' }
    $activityFrom = $null
    $activityTo = $null
    if ($kind -ceq 'status-changed') {
      $activityFrom = $priorStatus
      $activityTo = [string]$task.status
    }
    Add-AuraTaskboardActivity -Document $Document -TaskId $id `
      -Kind $kind -At $now `
      -From $activityFrom -To $activityTo `
      -Evidence 'local'
    return [PSCustomObject]@{ Ok = $true; Code = 'updated' }
  }
  return [PSCustomObject]@{ Ok = $false; Code = 'operation-unsupported' }
}

function Invoke-AuraTaskboardStudioRequest {
  param([Parameter(Mandatory = $true)][object]$Message)
  Assert-AuraTaskboardStudioRequest -Message $Message
  if (-not (Test-AuraTaskboardUuid -Value $script:AuraTaskboardSession)) {
    [void](New-AuraTaskboardStudioSession)
  }
  $type = [string](Get-AuraTaskboardProperty -Value $Message -Name 'type')
  $requestId = [string](Get-AuraTaskboardProperty -Value $Message -Name 'requestId')
  if ($type -ceq 'taskboard-read') {
    $document = Read-AuraTaskboardDocument
    Send-AuraTaskboardStudioDocument -Type 'taskboard-state' -RequestId $requestId `
      -Ok $true -Code 'ready' -Document $document
    return
  }

  $requestSession = [string](Get-AuraTaskboardProperty -Value $Message -Name 'session')
  $requestRevision = [long](Get-AuraTaskboardProperty -Value $Message -Name 'revision')
  $requestCommandEpoch = [long](Get-AuraTaskboardProperty -Value $Message -Name 'commandEpoch')
  $operation = [string](Get-AuraTaskboardProperty -Value $Message -Name 'operation')
  $payload = Get-AuraTaskboardProperty -Value $Message -Name 'payload'
  if ($requestSession -cne $script:AuraTaskboardSession -or
      $requestCommandEpoch -ne $script:AuraTaskboardCommandEpoch + 1) {
    throw 'Taskboard mutation session is invalid.'
  }
  $script:AuraTaskboardCommandEpoch = $requestCommandEpoch
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $mutex = [Threading.Mutex]::new($false, "Local\ClaudeAura.Taskboard.Store.$sid")
  $ownsMutex = $false
  try {
    try { $ownsMutex = $mutex.WaitOne(3000) } catch [Threading.AbandonedMutexException] {
      $ownsMutex = $true
    }
    if (-not $ownsMutex) { throw 'Taskboard store is busy.' }
    $document = Read-AuraTaskboardDocument
    if ([long]$document.revision -ne $requestRevision) {
      Send-AuraTaskboardStudioDocument -Type 'taskboard-result' -RequestId $requestId `
        -Ok $false -Code 'revision-conflict' -Document $document
      return
    }
    $working = ConvertTo-AuraTaskboardDocument -Value $document
    $result = Apply-AuraTaskboardMutation `
      -Document $working -Operation $operation -Payload $payload
    if (-not $result.Ok) {
      Send-AuraTaskboardStudioDocument -Type 'taskboard-result' -RequestId $requestId `
        -Ok $false -Code ([string]$result.Code) -Document $document
      return
    }
    $written = Write-AuraTaskboardDocument -Document $working
    Refresh-AuraTaskboardQueue
    Send-AuraTaskboardStudioDocument -Type 'taskboard-result' -RequestId $requestId `
      -Ok $true -Code ([string]$result.Code) -Document $written
  } finally {
    if ($ownsMutex) { try { $mutex.ReleaseMutex() } catch {} }
    $mutex.Dispose()
  }
}

function Get-AuraTaskboardSavedPrompt {
  param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-f0-9]{32}$')][string]$DraftId
  )
  if (-not (Get-Command Initialize-AuraPromptShelfPersistence -ErrorAction SilentlyContinue)) {
    return $null
  }
  Initialize-AuraPromptShelfPersistence
  foreach ($item in @($script:PromptShelfItems)) {
    if ([string]$item.id -ceq $DraftId) { return $item }
  }
  return $null
}

function Get-AuraTaskboardCurrentTargetQueue {
  $document = Read-AuraTaskboardDocument
  $targetId = $null
  try {
    if (Get-Command Get-AuraPromptShelfCurrentTargetId -ErrorAction SilentlyContinue) {
      $targetId = Get-AuraPromptShelfCurrentTargetId
    }
  } catch { $targetId = $null }
  $items = @()
  if ($targetId) {
    $items = @($document.queue | Where-Object {
      [string]$_.localTargetId -ceq [string]$targetId -and
        [string]$_.status -notin @('sent', 'completed', 'failed', 'cancelled')
    } | Sort-Object -Property position, sequence)
  }
  $insertionAvailable = $false
  try {
    if (Get-Command Test-AuraPromptShelfInsertionAvailable -ErrorAction SilentlyContinue) {
      $insertionAvailable = [bool](Test-AuraPromptShelfInsertionAvailable)
    }
  } catch { $insertionAvailable = $false }
  return [PSCustomObject][ordered]@{
    Document = $document
    TargetId = $targetId
    InsertionAvailable = $insertionAvailable
    Items = @($items)
  }
}

function Test-AuraTaskboardQueuePlacementReady {
  param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$')]
    [string]$CommandId,
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-f0-9]{32}$')][string]$DraftId,
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-f0-9]{64}$')][string]$DraftFingerprint
  )
  try {
    $snapshot = Get-AuraTaskboardCurrentTargetQueue
    if (-not $snapshot.TargetId -or -not $snapshot.InsertionAvailable -or
        $snapshot.Items.Count -eq 0) { return $false }
    $head = $snapshot.Items[0]
    return [bool]([string]$head.commandId -ceq $CommandId -and
      [string]$head.draftId -ceq $DraftId -and
      [string]$head.draftFingerprint -ceq $DraftFingerprint -and
      [string]$head.status -in @('queued', 'uncertain') -and
      (Test-AuraTaskboardQueueFingerprint -Item $head))
  } catch {
    return $false
  }
}

function Get-AuraTaskboardCompanionProjection {
  $snapshot = Get-AuraTaskboardCurrentTargetQueue
  $head = if ($snapshot.Items.Count -gt 0) { $snapshot.Items[0] } else { $null }
  $fingerprintMatches = $false
  if ($null -ne $head) {
    try { $fingerprintMatches = [bool](Test-AuraTaskboardQueueFingerprint -Item $head) } catch {}
  }
  return [PSCustomObject][ordered]@{
    schemaVersion = 1
    revision = [long]$snapshot.Document.revision
    targetAvailable = [bool]$snapshot.TargetId
    queueCount = [Math]::Min(999, [int]$snapshot.Items.Count)
    headStatus = if ($null -eq $head) { 'none' } else { [string]$head.status }
    canPlace = [bool]($null -ne $head -and
      [string]$head.status -in @('queued', 'uncertain') -and
      $snapshot.InsertionAvailable -and $fingerprintMatches)
    uncertain = [bool]($null -ne $head -and [string]$head.status -ceq 'uncertain')
    changedAt = if ($null -eq $head) {
      [long]$snapshot.Document.project.updatedAt
    } else { [long]$head.updatedAt }
  }
}

function Send-AuraTaskboardChanged {
  param([Parameter(Mandatory = $true)][long]$Revision)
  if (-not (Test-AuraTaskboardUuid -Value $script:AuraTaskboardSession)) { return }
  [void](Send-AuraTaskboardStudioMessage -Message ([ordered]@{
    type = 'taskboard-changed'
    version = 1
    session = $script:AuraTaskboardSession
    revision = $Revision
  }))
}

function Invoke-AuraTaskboardHostMutation {
  param(
    [Parameter(Mandatory = $true)][string]$Operation,
    [Parameter(Mandatory = $true)][object]$Payload
  )
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $mutex = [Threading.Mutex]::new($false, "Local\ClaudeAura.Taskboard.Store.$sid")
  $ownsMutex = $false
  try {
    try { $ownsMutex = $mutex.WaitOne(3000) } catch [Threading.AbandonedMutexException] {
      $ownsMutex = $true
    }
    if (-not $ownsMutex) { throw 'Taskboard store is busy.' }
    $document = Read-AuraTaskboardDocument
    $working = ConvertTo-AuraTaskboardDocument -Value $document
    $result = Apply-AuraTaskboardMutation `
      -Document $working -Operation $Operation -Payload $Payload
    if (-not $result.Ok) { return $result }
    $written = Write-AuraTaskboardDocument -Document $working
    Send-AuraTaskboardChanged -Revision ([long]$written.revision)
    return $result
  } finally {
    if ($ownsMutex) { try { $mutex.ReleaseMutex() } catch {} }
    $mutex.Dispose()
    Refresh-AuraTaskboardQueue
  }
}

function Get-AuraTaskboardQueueItemLabel {
  param(
    [Parameter(Mandatory = $true)][object]$Item,
    [Parameter(Mandatory = $true)][int]$Index
  )
  $prompt = Get-AuraTaskboardSavedPrompt -DraftId ([string]$Item.draftId)
  $title = Get-AuraTaskboardCopy -Name 'actionQueueDraftMissing' -Fallback 'Saved prompt unavailable'
  if ($null -ne $prompt) {
    $title = (([string]$prompt.text -split '\r?\n', 2)[0]).Trim()
    if (-not $title) { $title = Get-AuraTaskboardCopy -Name 'actionQueueUntitledDraft' -Fallback 'Untitled message' }
    if ($title.Length -gt 58) { $title = $title.Substring(0, 55) + '...' }
  }
  $state = switch -CaseSensitive ([string]$Item.status) {
    'awaiting_user_action' {
      Get-AuraTaskboardCopy -Name 'actionQueueAwaitingSend' -Fallback 'In composer'; break
    }
    'uncertain' {
      Get-AuraTaskboardCopy -Name 'actionQueueUncertain' -Fallback 'Check composer'; break
    }
    default { Get-AuraTaskboardCopy -Name 'actionQueueQueued' -Fallback 'Ready' }
  }
  return '{0:00}  {1}  [{2}]' -f ($Index + 1), $title, $state
}

function Set-AuraTaskboardQueueStatus {
  param([AllowEmptyString()][string]$Text)
  if ($null -ne $script:AuraTaskboardQueueStatus -and
      -not $script:AuraTaskboardQueueStatus.IsDisposed) {
    $script:AuraTaskboardQueueStatus.Text = $Text
  }
}

function Get-AuraTaskboardSelectedQueueItem {
  if ($null -eq $script:AuraTaskboardQueueList -or $script:AuraTaskboardQueueList.IsDisposed) {
    return $null
  }
  $index = [int]$script:AuraTaskboardQueueList.SelectedIndex
  if ($index -lt 0 -or $index -ge $script:AuraTaskboardQueueVisibleItems.Count) { return $null }
  return $script:AuraTaskboardQueueVisibleItems[$index]
}

function Test-AuraTaskboardQueueFingerprint {
  param([Parameter(Mandatory = $true)][object]$Item)
  $prompt = Get-AuraTaskboardSavedPrompt -DraftId ([string]$Item.draftId)
  if ($null -eq $prompt) { return $false }
  try {
    $key = [byte[]](Get-AuraPromptShelfTargetKey)
    if ($key.Length -ne 32) { return $false }
    $actual = ConvertTo-AuraPromptShelfDraftFingerprint `
      -Id ([string]$prompt.id) -Text ([string]$prompt.text) -Key $key
    return [string]$actual -ceq [string]$Item.draftFingerprint
  } catch { return $false }
}

function Update-AuraTaskboardQueueActions {
  if ($null -eq $script:AuraTaskboardQueuePrimaryButton -or
      $script:AuraTaskboardQueuePrimaryButton.IsDisposed) { return }
  $item = Get-AuraTaskboardSelectedQueueItem
  $isHead = $null -ne $item -and $script:AuraTaskboardQueueVisibleItems.Count -gt 0 -and
    [string]$item.commandId -ceq [string]$script:AuraTaskboardQueueVisibleItems[0].commandId
  $targetMatches = $null -ne $item -and $script:AuraTaskboardQueueCurrentTargetId -and
    [string]$item.localTargetId -ceq [string]$script:AuraTaskboardQueueCurrentTargetId
  $fingerprintMatches = $null -ne $item -and (Test-AuraTaskboardQueueFingerprint -Item $item)
  $insertionAvailable = $false
  try { $insertionAvailable = [bool](Test-AuraPromptShelfInsertionAvailable) } catch {}
  $pendingForItem = $null -ne $item -and $null -ne $script:PromptShelfInsertOperation -and
    [string]$script:PromptShelfInsertOperation.QueueCommandId -ceq [string]$item.commandId

  $script:AuraTaskboardQueuePrimaryButton.Enabled = $false
  $script:AuraTaskboardQueueRemoveButton.Enabled = $false
  if ($null -eq $item) { return }
  if ([string]$item.status -ceq 'awaiting_user_action') {
    $script:AuraTaskboardQueuePrimaryButton.Text = Get-AuraTaskboardCopy `
      -Name 'actionQueueSentNext' -Fallback 'Sent - next'
    $script:AuraTaskboardQueuePrimaryButton.Enabled = $isHead
    return
  }
  $script:AuraTaskboardQueueRemoveButton.Enabled = -not $pendingForItem
  if ([string]$item.status -ceq 'uncertain' -and $pendingForItem -and
      [string]$script:PromptShelfInsertOperation.State -ceq 'uncertain') {
    $script:AuraTaskboardQueuePrimaryButton.Text = Get-AuraTaskboardCopy `
      -Name 'actionQueueCheckedComposer' -Fallback "I've checked the composer"
    $script:AuraTaskboardQueuePrimaryButton.Enabled = $true
    return
  }
  $script:AuraTaskboardQueuePrimaryButton.Text = if ([string]$item.status -ceq 'uncertain') {
    Get-AuraTaskboardCopy -Name 'actionQueuePlaceAgain' -Fallback 'Place again'
  } else {
    Get-AuraTaskboardCopy -Name 'actionQueuePlace' -Fallback 'Place in composer'
  }
  $script:AuraTaskboardQueuePrimaryButton.Enabled = $isHead -and $targetMatches -and
    $fingerprintMatches -and $insertionAvailable -and $null -eq $script:PromptShelfInsertOperation
}

function Refresh-AuraTaskboardQueue {
  if ($null -eq $script:AuraTaskboardQueueForm -or $script:AuraTaskboardQueueForm.IsDisposed) {
    return
  }
  $selectedId = $null
  $selected = Get-AuraTaskboardSelectedQueueItem
  if ($null -ne $selected) { $selectedId = [string]$selected.commandId }
  try {
    $snapshot = Get-AuraTaskboardCurrentTargetQueue
    $script:AuraTaskboardQueueCurrentTargetId = $snapshot.TargetId
    $script:AuraTaskboardQueueVisibleItems = @($snapshot.Items)
    $script:AuraTaskboardQueueList.BeginUpdate()
    try {
      $script:AuraTaskboardQueueList.Items.Clear()
      $nextIndex = -1
      for ($index = 0; $index -lt $script:AuraTaskboardQueueVisibleItems.Count; $index += 1) {
        $item = $script:AuraTaskboardQueueVisibleItems[$index]
        [void]$script:AuraTaskboardQueueList.Items.Add(
          (Get-AuraTaskboardQueueItemLabel -Item $item -Index $index))
        if ($selectedId -and [string]$item.commandId -ceq $selectedId) { $nextIndex = $index }
      }
      if ($nextIndex -lt 0 -and $script:AuraTaskboardQueueVisibleItems.Count -gt 0) { $nextIndex = 0 }
      $script:AuraTaskboardQueueList.SelectedIndex = $nextIndex
    } finally { $script:AuraTaskboardQueueList.EndUpdate() }
    $summaryFormat = if ($snapshot.TargetId) {
      Get-AuraTaskboardCopy -Name 'actionQueueCount' -Fallback '{0} next actions for this chat'
    } else {
      Get-AuraTaskboardCopy -Name 'actionQueueTargetUnavailable' `
        -Fallback 'Open a Claude chat to use its queue.'
    }
    $script:AuraTaskboardQueueSummary.Text = if ($snapshot.TargetId) {
      $summaryFormat -f $script:AuraTaskboardQueueVisibleItems.Count
    } else { $summaryFormat }
    if ($script:AuraTaskboardQueueVisibleItems.Count -eq 0) {
      Set-AuraTaskboardQueueStatus -Text (
        Get-AuraTaskboardCopy -Name 'actionQueueEmpty' -Fallback 'Nothing is queued for this chat.')
    } else { Set-AuraTaskboardQueueStatus -Text '' }
    Update-AuraTaskboardQueueActions
  } catch {
    $script:AuraTaskboardQueueVisibleItems = @()
    $script:AuraTaskboardQueueList.Items.Clear()
    Set-AuraTaskboardQueueStatus -Text (
      Get-AuraTaskboardCopy -Name 'actionQueueUnavailable' -Fallback 'Action Queue is unavailable. Try again.')
    Update-AuraTaskboardQueueActions
  }
}

function Complete-AuraTaskboardQueuePlacement {
  param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$')]
    [string]$QueueCommandId,
    [AllowEmptyString()]
    [ValidatePattern('^$|^[a-f0-9]{64}$')][string]$DraftFingerprint = '',
    [Parameter(Mandatory = $true)]
    [ValidateSet('inserted', 'not-inserted', 'uncertain')][string]$Outcome
  )
  if ($Outcome -ceq 'not-inserted') {
    Refresh-AuraTaskboardQueue
    Set-AuraTaskboardQueueStatus -Text (
      Get-AuraTaskboardCopy -Name 'actionQueuePlaceFailed' `
        -Fallback 'Place the caret in the Claude composer, then try again.')
    return
  }
  $result = Invoke-AuraTaskboardHostMutation -Operation 'queue-placement' -Payload (
    [PSCustomObject][ordered]@{
      commandId = $QueueCommandId
      draftFingerprint = $DraftFingerprint
      outcome = $Outcome
    })
  if (-not $result.Ok -and [string]$result.Code -ceq 'queue-draft-changed') {
    Set-AuraTaskboardQueueStatus -Text (
      Get-AuraTaskboardCopy -Name 'actionQueueDraftChanged' `
        -Fallback 'This saved prompt or chat changed. Remove it and queue it again.')
  } elseif (-not $result.Ok) {
    Set-AuraTaskboardQueueStatus -Text (
      Get-AuraTaskboardCopy -Name 'actionQueueUnavailable' -Fallback 'Action Queue is unavailable. Try again.')
  } elseif ($Outcome -ceq 'inserted') {
    Set-AuraTaskboardQueueStatus -Text (
      Get-AuraTaskboardCopy -Name 'actionQueueInserted' `
        -Fallback 'Placed in the composer. Review it, then press Send yourself.')
  } else {
    Set-AuraTaskboardQueueStatus -Text (
      Get-AuraTaskboardCopy -Name 'actionQueueUncertainHelp' `
        -Fallback "Aura couldn't confirm placement. Check the composer before continuing.")
  }
}

function Invoke-AuraTaskboardQueuePrimaryAction {
  $item = Get-AuraTaskboardSelectedQueueItem
  if ($null -eq $item) { return }
  if ([string]$item.status -ceq 'awaiting_user_action') {
    $result = Invoke-AuraTaskboardHostMutation -Operation 'queue-resolve' -Payload (
      [PSCustomObject][ordered]@{ commandId = [string]$item.commandId; outcome = 'sent' })
    if ($result.Ok) {
      Set-AuraTaskboardQueueStatus -Text (
        Get-AuraTaskboardCopy -Name 'actionQueueAdvanced' -Fallback 'Recorded as sent. The next item is ready.')
    }
    return
  }
  if ([string]$item.status -ceq 'uncertain' -and
      $null -ne $script:PromptShelfInsertOperation -and
      [string]$script:PromptShelfInsertOperation.QueueCommandId -ceq [string]$item.commandId -and
      [string]$script:PromptShelfInsertOperation.State -ceq 'uncertain') {
    Confirm-AuraPromptShelfComposerChecked
    Refresh-AuraTaskboardQueue
    return
  }
  if ($script:AuraTaskboardQueueVisibleItems.Count -eq 0 -or
      [string]$item.commandId -cne [string]$script:AuraTaskboardQueueVisibleItems[0].commandId -or
      [string]$item.localTargetId -cne [string](Get-AuraPromptShelfCurrentTargetId) -or
      -not (Test-AuraTaskboardQueueFingerprint -Item $item)) {
    Refresh-AuraTaskboardQueue
    Set-AuraTaskboardQueueStatus -Text (
      Get-AuraTaskboardCopy -Name 'actionQueueDraftChanged' `
        -Fallback 'This saved prompt or chat changed. Remove it and queue it again.')
    return
  }
  $prompt = Get-AuraTaskboardSavedPrompt -DraftId ([string]$item.draftId)
  if ($null -eq $prompt) { Refresh-AuraTaskboardQueue; return }
  Show-AuraUiMain
  Invoke-AuraPromptShelfInsert `
    -Text ([string]$prompt.text) -QueueCommandId ([string]$item.commandId) `
    -QueueDraftFingerprint ([string]$item.draftFingerprint)
  if ($null -ne $script:PromptShelfInsertOperation -and
      [string]$script:PromptShelfInsertOperation.QueueCommandId -ceq [string]$item.commandId) {
    Set-AuraTaskboardQueueStatus -Text (
      Get-AuraTaskboardCopy -Name 'actionQueuePlacing' -Fallback 'Placing in the composer...')
  } else {
    Set-AuraTaskboardQueueStatus -Text (
      Get-AuraTaskboardCopy -Name 'actionQueuePlaceFailed' `
        -Fallback 'Place the caret in the Claude composer, then try again.')
  }
  Update-AuraTaskboardQueueActions
}

function Invoke-AuraTaskboardQueueRemove {
  $item = Get-AuraTaskboardSelectedQueueItem
  if ($null -eq $item -or [string]$item.status -notin @('queued', 'uncertain')) { return }
  $result = Invoke-AuraTaskboardHostMutation -Operation 'queue-resolve' -Payload (
    [PSCustomObject][ordered]@{ commandId = [string]$item.commandId; outcome = 'cancelled' })
  if ($result.Ok) {
    Set-AuraTaskboardQueueStatus -Text (
      Get-AuraTaskboardCopy -Name 'actionQueueRemoved' -Fallback 'Removed from this chat queue.')
  }
}

function Update-AuraTaskboardQueueBounds {
  if ($null -eq $script:AuraTaskboardQueueForm -or $script:AuraTaskboardQueueForm.IsDisposed -or
      -not $script:AuraTaskboardQueueForm.Visible -or $null -eq $script:Form -or
      $script:Form.IsDisposed -or -not $script:Form.Visible -or
      $script:Form.WindowState -eq [Windows.Forms.FormWindowState]::Minimized) { return }
  $origin = $script:Form.PointToScreen([Drawing.Point]::Empty)
  $margin = [Math]::Max(12, [int][Math]::Round(18 * $script:Form.DeviceDpi / 96.0))
  $x = $origin.X + $script:Form.ClientSize.Width - $script:AuraTaskboardQueueForm.Width - $margin
  $y = $origin.Y + $script:Form.ClientSize.Height - $script:AuraTaskboardQueueForm.Height - $margin
  $script:AuraTaskboardQueueForm.Location = [Drawing.Point]::new(
    [Math]::Max($origin.X + $margin, $x),
    [Math]::Max($origin.Y + $margin, $y))
}

function New-AuraTaskboardQueueForm {
  if ($null -ne $script:AuraTaskboardQueueForm -and -not $script:AuraTaskboardQueueForm.IsDisposed) {
    return $script:AuraTaskboardQueueForm
  }
  $form = [Windows.Forms.Form]::new()
  $form.Text = Get-AuraTaskboardCopy -Name 'actionQueueTitle' -Fallback 'Action Queue'
  $form.AccessibleName = $form.Text
  $form.ShowInTaskbar = $false
  $form.ShowIcon = $false
  $form.StartPosition = [Windows.Forms.FormStartPosition]::Manual
  $form.FormBorderStyle = [Windows.Forms.FormBorderStyle]::FixedToolWindow
  $form.AutoScaleMode = [Windows.Forms.AutoScaleMode]::Dpi
  $form.ClientSize = [Drawing.Size]::new(460, 332)
  $form.MinimumSize = [Drawing.Size]::new(420, 300)
  $form.BackColor = [Drawing.SystemColors]::Control

  $root = [Windows.Forms.TableLayoutPanel]::new()
  $root.Dock = [Windows.Forms.DockStyle]::Fill
  $root.Padding = [Windows.Forms.Padding]::new(14)
  $root.ColumnCount = 1
  $root.RowCount = 5
  [void]$root.RowStyles.Add([Windows.Forms.RowStyle]::new([Windows.Forms.SizeType]::AutoSize))
  [void]$root.RowStyles.Add([Windows.Forms.RowStyle]::new([Windows.Forms.SizeType]::AutoSize))
  [void]$root.RowStyles.Add([Windows.Forms.RowStyle]::new([Windows.Forms.SizeType]::Percent, 100))
  [void]$root.RowStyles.Add([Windows.Forms.RowStyle]::new([Windows.Forms.SizeType]::AutoSize))
  [void]$root.RowStyles.Add([Windows.Forms.RowStyle]::new([Windows.Forms.SizeType]::AutoSize))

  $title = [Windows.Forms.Label]::new()
  $title.AutoSize = $true
  $title.Font = [Drawing.Font]::new($form.Font.FontFamily, 14, [Drawing.FontStyle]::Bold)
  $title.Text = Get-AuraTaskboardCopy -Name 'actionQueueTitle' -Fallback 'Action Queue'
  $summary = [Windows.Forms.Label]::new()
  $summary.AutoSize = $true
  $summary.Margin = [Windows.Forms.Padding]::new(0, 3, 0, 10)

  $list = [Windows.Forms.ListBox]::new()
  $list.Dock = [Windows.Forms.DockStyle]::Fill
  $list.IntegralHeight = $false
  $list.HorizontalScrollbar = $false
  $list.Font = [Drawing.Font]::new('Segoe UI', 10)
  $list.AccessibleName = Get-AuraTaskboardCopy -Name 'actionQueueList' -Fallback 'Queued next actions'

  $status = [Windows.Forms.Label]::new()
  $status.AutoSize = $true
  $status.MaximumSize = [Drawing.Size]::new(420, 0)
  $status.Margin = [Windows.Forms.Padding]::new(0, 9, 0, 4)

  $actions = [Windows.Forms.FlowLayoutPanel]::new()
  $actions.AutoSize = $true
  $actions.Dock = [Windows.Forms.DockStyle]::Fill
  $actions.FlowDirection = [Windows.Forms.FlowDirection]::RightToLeft
  $actions.WrapContents = $false
  $primary = [Windows.Forms.Button]::new()
  $primary.AutoSize = $true
  $primary.MinimumSize = [Drawing.Size]::new(116, 34)
  $remove = [Windows.Forms.Button]::new()
  $remove.AutoSize = $true
  $remove.MinimumSize = [Drawing.Size]::new(74, 34)
  $remove.Text = Get-AuraTaskboardCopy -Name 'actionQueueRemove' -Fallback 'Remove'
  $studio = [Windows.Forms.Button]::new()
  $studio.AutoSize = $true
  $studio.MinimumSize = [Drawing.Size]::new(96, 34)
  $studio.Text = Get-AuraTaskboardCopy -Name 'actionQueueOpenWorkHub' -Fallback 'Open Work Hub'
  $close = [Windows.Forms.Button]::new()
  $close.AutoSize = $true
  $close.MinimumSize = [Drawing.Size]::new(70, 34)
  $close.Text = Get-AuraTaskboardCopy -Name 'actionQueueClose' -Fallback 'Close'
  [void]$actions.Controls.AddRange(@($primary, $remove, $studio, $close))

  [void]$root.Controls.Add($title, 0, 0)
  [void]$root.Controls.Add($summary, 0, 1)
  [void]$root.Controls.Add($list, 0, 2)
  [void]$root.Controls.Add($status, 0, 3)
  [void]$root.Controls.Add($actions, 0, 4)
  $form.Controls.Add($root)

  $script:AuraTaskboardQueueForm = $form
  $script:AuraTaskboardQueueList = $list
  $script:AuraTaskboardQueueSummary = $summary
  $script:AuraTaskboardQueueStatus = $status
  $script:AuraTaskboardQueuePrimaryButton = $primary
  $script:AuraTaskboardQueueRemoveButton = $remove
  $list.add_SelectedIndexChanged({ Update-AuraTaskboardQueueActions })
  $primary.add_Click({ Invoke-AuraTaskboardQueuePrimaryAction })
  $remove.add_Click({ Invoke-AuraTaskboardQueueRemove })
  $studio.add_Click({
    Show-AuraUiStudio
    if ($script:StudioReady -and $null -ne $script:StudioWebView.CoreWebView2) {
      [void]$script:StudioWebView.CoreWebView2.ExecuteScriptAsync('location.hash="#tasks"')
    }
  })
  $close.add_Click({ $script:AuraTaskboardQueueForm.Hide() })
  $form.add_FormClosing({
    param($sender, $eventArgs)
    if ($eventArgs.CloseReason -eq [Windows.Forms.CloseReason]::UserClosing) {
      $eventArgs.Cancel = $true
      $sender.Hide()
    }
  })
  return $form
}

function Show-AuraTaskboardQueue {
  Show-AuraUiMain
  $form = New-AuraTaskboardQueueForm
  Refresh-AuraTaskboardQueue
  if (-not $form.Visible) { $form.Show($script:Form) }
  Update-AuraTaskboardQueueBounds
  $form.Activate()
  $form.BringToFront()
  if ($script:AuraTaskboardQueueVisibleItems.Count -gt 0) { [void]$script:AuraTaskboardQueueList.Focus() }
}

function Dispose-AuraTaskboardQueue {
  if ($null -ne $script:AuraTaskboardQueueForm -and -not $script:AuraTaskboardQueueForm.IsDisposed) {
    try { $script:AuraTaskboardQueueForm.Dispose() } catch {}
  }
  $script:AuraTaskboardQueueForm = $null
  $script:AuraTaskboardQueueList = $null
  $script:AuraTaskboardQueueVisibleItems = @()
}
