[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet('sync', 'list')]
  [string]$Operation = 'sync',
  [string]$Title = '',
  [string]$Description = '',
  [ValidateSet('todo', 'in-progress', 'needs-input', 'review', 'blocked')]
  [string]$Status = 'in-progress',
  [ValidateSet('urgent', 'high', 'normal', 'low', 'none')]
  [string]$Priority = 'normal',
  [string]$ThreadId = $env:CODEX_THREAD_ID,
  [string]$Worktree = '',
  [string]$Branch = '',
  [string]$DataRoot = '',
  [switch]$Json
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3.0

if ([string]::IsNullOrWhiteSpace($DataRoot)) {
  if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    throw 'LOCALAPPDATA is required to locate the Claude Aura taskboard.'
  }
  $DataRoot = Join-Path $env:LOCALAPPDATA 'ClaudeAura\data'
}
$DataRoot = [IO.Path]::GetFullPath($DataRoot)

# The taskboard module is shared with the GUI host. These no-op boundaries keep
# the command-line client independent from WinForms while preserving the same
# encrypted store, schema validation, mutex, and atomic writer.
function Write-AuraUiLog { param([string]$Message) }
function Send-AuraTaskboardChanged { param([long]$Revision) }
function Refresh-AuraTaskboardQueue {}
. (Join-Path $PSScriptRoot 'aura-taskboard.ps1')

function Write-AuraTaskctlResult {
  param([Parameter(Mandatory = $true)][object]$Value)
  if ($Json) {
    $Value | ConvertTo-Json -Depth 8 -Compress
    return
  }
  if ($Value.PSObject.Properties['message']) {
    Write-Output ([string]$Value.message)
  } else {
    $Value | Format-List | Out-String | Write-Output
  }
}

function Get-AuraTaskctlTaskSummary {
  param([Parameter(Mandatory = $true)][object]$Task)
  return [PSCustomObject][ordered]@{
    id = [string]$Task.id
    key = "AURA-$([int]$Task.number)"
    title = [string]$Task.title
    status = [string]$Task.status
    threadId = [string]$Task.providerThreadId
    sessionState = [string]$Task.sessionState
    branch = [string]$Task.branch
    worktree = [string]$Task.worktree
    updatedAt = [long]$Task.updatedAt
  }
}

$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$mutex = [Threading.Mutex]::new($false, "Local\ClaudeAura.Taskboard.Store.$sid")
$ownsMutex = $false
try {
  try { $ownsMutex = $mutex.WaitOne(3000) } catch [Threading.AbandonedMutexException] {
    $ownsMutex = $true
  }
  if (-not $ownsMutex) { throw 'Claude Aura Work Hub is busy. Try again.' }

  $document = Read-AuraTaskboardDocument
  if ($Operation -ceq 'list') {
    Write-AuraTaskctlResult ([PSCustomObject][ordered]@{
      schemaVersion = 1
      outcome = 'listed'
      revision = [long]$document.revision
      tasks = @($document.tasks | ForEach-Object { Get-AuraTaskctlTaskSummary -Task $_ })
    })
    return
  }

  if ([string]::IsNullOrWhiteSpace($ThreadId) -or
      -not (Test-AuraTaskboardText -Value $ThreadId -Maximum 160 -Required)) {
    throw 'CODEX_THREAD_ID is missing or invalid. Run taskctl from an active Codex task or pass -ThreadId.'
  }
  $matches = @($document.tasks | Where-Object {
    [string]$_.providerThreadId -ceq $ThreadId
  })
  if ($matches.Count -gt 1) {
    throw 'Work Hub contains duplicate links for this Codex thread.'
  }

  $working = ConvertTo-AuraTaskboardDocument -Value $document
  $task = if ($matches.Count -eq 1) {
    @($working.tasks | Where-Object { [string]$_.providerThreadId -ceq $ThreadId })[0]
  } else { $null }

  if ($null -eq $task) {
    if ([string]::IsNullOrWhiteSpace($Title)) {
      throw 'A title is required the first time a Codex task is linked to Work Hub.'
    }
    $create = [PSCustomObject][ordered]@{
      title = $Title
      description = $Description
      status = $Status
      priority = $Priority
      labels = @('codex-session')
      assignee = ''
      startDate = $null
      dueDate = $null
      relationIds = @()
      branch = $Branch
      worktree = $Worktree
      providerThreadId = $ThreadId
    }
    Assert-AuraTaskboardTaskFields -Value $create
    $created = Apply-AuraTaskboardMutation -Document $working -Operation 'create-task' -Payload $create
    if (-not $created.Ok) { throw "Work Hub could not create the task: $($created.Code)" }
    $task = @($working.tasks | Where-Object { [string]$_.providerThreadId -ceq $ThreadId })[0]
    $outcome = 'created'
  } else {
    if ([string]$task.status -ceq 'done') {
      throw 'The Work Hub task linked to this Codex thread is already accepted.'
    }
    $patch = [ordered]@{}
    if (-not [string]::IsNullOrWhiteSpace($Title) -and [string]$task.title -cne $Title) {
      $patch.title = $Title
    }
    if ([string]$task.description -cne $Description -and -not [string]::IsNullOrWhiteSpace($Description)) {
      $patch.description = $Description
    }
    if ([string]$task.status -cne $Status) { $patch.status = $Status }
    if ([string]$task.priority -cne $Priority) { $patch.priority = $Priority }
    if (-not [string]::IsNullOrWhiteSpace($Branch) -and [string]$task.branch -cne $Branch) {
      $patch.branch = $Branch
    }
    if (-not [string]::IsNullOrWhiteSpace($Worktree) -and [string]$task.worktree -cne $Worktree) {
      $patch.worktree = $Worktree
    }
    if ($patch.Count -gt 0) {
      $updated = Apply-AuraTaskboardMutation -Document $working -Operation 'update-task' -Payload ([PSCustomObject]@{
        id = [string]$task.id
        taskVersion = [int]$task.version
        patch = [PSCustomObject]$patch
      })
      if (-not $updated.Ok) { throw "Work Hub could not update the task: $($updated.Code)" }
      $task = @($working.tasks | Where-Object { [string]$_.providerThreadId -ceq $ThreadId })[0]
    }
    $outcome = 'updated'
  }

  $touched = Apply-AuraTaskboardMutation -Document $working -Operation 'touch-current-session' -Payload ([PSCustomObject]@{
    id = [string]$task.id
    taskVersion = [int]$task.version
    providerThreadId = $ThreadId
  })
  if (-not $touched.Ok) { throw "Work Hub could not mark the session active: $($touched.Code)" }
  $written = Write-AuraTaskboardDocument -Document $working
  $task = @($written.tasks | Where-Object { [string]$_.providerThreadId -ceq $ThreadId })[0]
  Write-AuraTaskctlResult ([PSCustomObject][ordered]@{
    schemaVersion = 1
    outcome = $outcome
    revision = [long]$written.revision
    task = Get-AuraTaskctlTaskSummary -Task $task
    message = "$([string]$task.title) is linked to the active Codex session."
  })
} finally {
  if ($ownsMutex) { try { $mutex.ReleaseMutex() } catch {} }
  $mutex.Dispose()
}
