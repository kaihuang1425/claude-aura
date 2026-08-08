function Test-AuraUiStudioUuid {
  param([AllowEmptyString()][string]$Value)
  return $Value -cmatch (
    '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$')
}

function Test-AuraUiPersonalWordmarkChildPath {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$Candidate
  )
  try {
    $rootPath = [IO.Path]::GetFullPath($Root).TrimEnd(
      [IO.Path]::DirectorySeparatorChar,
      [IO.Path]::AltDirectorySeparatorChar)
    $candidatePath = [IO.Path]::GetFullPath($Candidate)
    return $candidatePath.StartsWith(
      "$rootPath$([IO.Path]::DirectorySeparatorChar)",
      [StringComparison]::OrdinalIgnoreCase)
  } catch {
    return $false
  }
}

function Assert-AuraUiPersonalWordmarkStorage {
  [IO.Directory]::CreateDirectory($PersonalWordmarkRoot) | Out-Null
  [IO.Directory]::CreateDirectory($PersonalWordmarkStagingRoot) | Out-Null
  [IO.Directory]::CreateDirectory($PersonalWordmarkGenerationsRoot) | Out-Null
  foreach ($path in @(
      $PersonalWordmarkRoot,
      $PersonalWordmarkStagingRoot,
      $PersonalWordmarkGenerationsRoot
    )) {
    $item = Get-Item -LiteralPath $path -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'Personal wordmark storage cannot use linked folders.'
    }
  }
}

function Remove-AuraUiPersonalWordmarkDirectory {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-AuraUiPersonalWordmarkChildPath -Root $PersonalWordmarkRoot -Candidate $Path)) {
    throw 'Personal wordmark cleanup refused an unsafe path.'
  }
  $resolved = [IO.Path]::GetFullPath($Path)
  if (Test-Path -LiteralPath $resolved -PathType Container) {
    [IO.Directory]::Delete($resolved, $true)
  }
}

function Get-AuraUiSha256 {
  param(
    [Parameter(ParameterSetName = 'Path', Mandatory = $true)][string]$Path,
    [Parameter(ParameterSetName = 'Text', Mandatory = $true)][string]$Text
  )
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    if ($PSCmdlet.ParameterSetName -ceq 'Text') {
      $bytes = [Text.Encoding]::UTF8.GetBytes($Text)
      return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    }
    $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    try {
      return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
    } finally {
      $stream.Dispose()
    }
  } finally {
    $sha.Dispose()
  }
}

function Test-AuraUiPersonalWordmarkSourceSignature {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Extension
  )
  try {
    $bytes = [byte[]]::new(12)
    $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    try {
      $read = $stream.Read($bytes, 0, $bytes.Length)
    } finally {
      $stream.Dispose()
    }
    if ($Extension -ceq '.png') {
      return $read -ge 8 -and
        $bytes[0] -eq 0x89 -and $bytes[1] -eq 0x50 -and
        $bytes[2] -eq 0x4E -and $bytes[3] -eq 0x47 -and
        $bytes[4] -eq 0x0D -and $bytes[5] -eq 0x0A -and
        $bytes[6] -eq 0x1A -and $bytes[7] -eq 0x0A
    }
    if ($Extension -in @('.jpg', '.jpeg')) {
      return $read -ge 3 -and $bytes[0] -eq 0xFF -and
        $bytes[1] -eq 0xD8 -and $bytes[2] -eq 0xFF
    }
  } catch {}
  return $false
}

function Get-AuraUiPersonalWordmarkImageInfo {
  param([Parameter(Mandatory = $true)][string]$Path)
  $stream = $null
  $image = $null
  try {
    $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    $image = [Drawing.Image]::FromStream($stream, $true, $true)
    return [ordered]@{
      width = [int]$image.Width
      height = [int]$image.Height
    }
  } finally {
    if ($null -ne $image) { $image.Dispose() }
    if ($null -ne $stream) { $stream.Dispose() }
  }
}

function Test-AuraUiPersonalWordmarkRuntimePath {
  param([AllowEmptyString()][string]$Path)
  if (-not $Path -or -not [IO.Path]::IsPathRooted($Path)) { return $false }
  try {
    $resolved = [IO.Path]::GetFullPath($Path)
    if (-not (Test-AuraUiPersonalWordmarkChildPath -Root $PersonalWordmarkGenerationsRoot -Candidate $resolved) -or
        -not [string]::Equals(
          [IO.Path]::GetFileName($resolved),
          'wordmark.png',
          [StringComparison]::Ordinal)) {
      return $false
    }
    $generationDirectory = Split-Path -Parent $resolved
    if ([IO.Path]::GetFileName($generationDirectory) -cnotmatch '^[a-f0-9]{64}$' -or
        -not [string]::Equals(
          [IO.Path]::GetFullPath((Split-Path -Parent $generationDirectory)),
          [IO.Path]::GetFullPath($PersonalWordmarkGenerationsRoot),
          [StringComparison]::OrdinalIgnoreCase)) {
      return $false
    }
    foreach ($itemPath in @($generationDirectory, $resolved)) {
      $item = Get-Item -LiteralPath $itemPath -Force -ErrorAction Stop
      if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { return $false }
    }
    $file = [IO.FileInfo]::new($resolved)
    if (-not $file.Exists -or $file.Length -le 0 -or
        $file.Length -gt $PersonalWordmarkOutputMaxBytes -or
        -not (Test-AuraUiPersonalWordmarkSourceSignature -Path $resolved -Extension '.png')) {
      return $false
    }
    $header = [byte[]]::new(26)
    $stream = [IO.File]::Open($resolved, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    try {
      if ($stream.Read($header, 0, $header.Length) -ne $header.Length) { return $false }
    } finally {
      $stream.Dispose()
    }
    $width = [Net.IPAddress]::NetworkToHostOrder([BitConverter]::ToInt32($header, 16))
    $height = [Net.IPAddress]::NetworkToHostOrder([BitConverter]::ToInt32($header, 20))
    return $width -eq 344 -and $height -eq 124 -and
      $header[24] -eq 8 -and $header[25] -in @(4, 6)
  } catch {
    return $false
  }
}

function Get-AuraUiConfiguredPersonalWordmarkPath {
  if ($null -eq $script:Config) { return $null }
  $value = Get-AuraUiPropertyValue -InputObject $script:Config -Names @('personalWordmark')
  if ($value -isnot [string] -or -not $value.Trim()) { return $null }
  return [string]$value
}

function Read-AuraUiPersonalWordmarkState {
  $runtimePath = Get-AuraUiConfiguredPersonalWordmarkPath
  if (-not (Test-AuraUiPersonalWordmarkRuntimePath -Path $runtimePath)) { return $null }
  $generationDirectory = Split-Path -Parent $runtimePath
  $statePath = Join-Path $generationDirectory 'state.json'
  try {
    $state = [IO.File]::ReadAllText($statePath, [Text.Encoding]::UTF8) | ConvertFrom-Json
    $generation = [IO.Path]::GetFileName($generationDirectory)
    if ($state -isnot [PSCustomObject] -or [int]$state.schemaVersion -ne 1 -or
        $state.generation -isnot [string] -or $state.generation -cne $generation -or
        $state.source -isnot [string] -or
        $state.source -cnotmatch '^source\.(png|jpg|jpeg)$' -or
        $state.sourceSha256 -isnot [string] -or
        $state.sourceSha256 -cnotmatch '^[a-f0-9]{64}$' -or
        $state.output -isnot [PSCustomObject] -or
        [int]$state.output.width -ne 344 -or [int]$state.output.height -ne 124 -or
        $state.output.sha256 -isnot [string] -or
        $state.output.sha256 -cnotmatch '^[a-f0-9]{64}$') {
      return $null
    }
    return $state
  } catch {
    return $null
  }
}

function Test-AuraUiPersonalWordmarkPublishedGeneration {
  param([Parameter(Mandatory = $true)][string]$GenerationDirectory)
  try {
    $generation = [IO.Path]::GetFileName($GenerationDirectory)
    $runtimePath = Join-Path $GenerationDirectory 'wordmark.png'
    $statePath = Join-Path $GenerationDirectory 'state.json'
    if ($generation -cnotmatch '^[a-f0-9]{64}$' -or
        -not (Test-AuraUiPersonalWordmarkRuntimePath -Path $runtimePath) -or
        -not (Test-Path -LiteralPath $statePath -PathType Leaf) -or
        ((Get-Item -LiteralPath $statePath -Force).Attributes -band
          [IO.FileAttributes]::ReparsePoint) -ne 0) {
      return $false
    }
    $state = [IO.File]::ReadAllText($statePath, [Text.Encoding]::UTF8) | ConvertFrom-Json
    if ($state -isnot [PSCustomObject] -or [int]$state.schemaVersion -ne 1 -or
        $state.generation -isnot [string] -or $state.generation -cne $generation -or
        $state.source -isnot [string] -or $state.source -cnotmatch '^source\.(png|jpg|jpeg)$' -or
        $state.sourceSha256 -isnot [string] -or
        $state.sourceSha256 -cnotmatch '^[a-f0-9]{64}$' -or
        $state.crop -isnot [PSCustomObject] -or
        $state.output -isnot [PSCustomObject] -or
        [int]$state.output.width -ne 344 -or [int]$state.output.height -ne 124 -or
        $state.output.sha256 -isnot [string] -or
        $state.output.sha256 -cnotmatch '^[a-f0-9]{64}$') {
      return $false
    }
    [void](ConvertTo-AuraUiStudioNumber -Value $state.crop.x -Minimum 0 -Maximum 100 -Label 'Wordmark x')
    [void](ConvertTo-AuraUiStudioNumber -Value $state.crop.y -Minimum 0 -Maximum 100 -Label 'Wordmark y')
    [void](ConvertTo-AuraUiStudioNumber -Value $state.crop.zoom -Minimum 1 -Maximum 2 -Label 'Wordmark zoom')
    $sourcePath = Join-Path $GenerationDirectory ([string]$state.source)
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf) -or
        ((Get-Item -LiteralPath $sourcePath -Force).Attributes -band
          [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        (Get-AuraUiSha256 -Path $sourcePath) -cne [string]$state.sourceSha256 -or
        (Get-AuraUiSha256 -Path $runtimePath) -cne [string]$state.output.sha256) {
      return $false
    }
    return $true
  } catch {
    return $false
  }
}

function Get-AuraUiPersonalWordmarkCrop {
  $crop = if ($null -ne $script:PersonalWordmarkDraft) {
    $script:PersonalWordmarkDraft.Crop
  } else {
    $state = Read-AuraUiPersonalWordmarkState
    if ($null -ne $state) { $state.crop } else { $null }
  }
  $x = 50.0
  $y = 50.0
  $zoom = 1.0
  if ($null -ne $crop) {
    try { $x = ConvertTo-AuraUiStudioNumber -Value $crop.x -Minimum 0 -Maximum 100 -Label 'Wordmark x' } catch {}
    try { $y = ConvertTo-AuraUiStudioNumber -Value $crop.y -Minimum 0 -Maximum 100 -Label 'Wordmark y' } catch {}
    try { $zoom = ConvertTo-AuraUiStudioNumber -Value $crop.zoom -Minimum 1 -Maximum 2 -Label 'Wordmark zoom' } catch {}
  }
  return [ordered]@{ x = $x; y = $y; zoom = $zoom }
}

function Get-AuraUiPersonalWordmarkSource {
  if ($null -ne $script:PersonalWordmarkDraft) {
    $draftPath = [string]$script:PersonalWordmarkDraft.SourcePath
    if ((Test-AuraUiPersonalWordmarkChildPath -Root $PersonalWordmarkStagingRoot -Candidate $draftPath) -and
        (Test-Path -LiteralPath $draftPath -PathType Leaf)) {
      return [ordered]@{
        path = $draftPath
        hash = [string]$script:PersonalWordmarkDraft.Hash
      }
    }
    return $null
  }
  $state = Read-AuraUiPersonalWordmarkState
  $runtimePath = Get-AuraUiConfiguredPersonalWordmarkPath
  if ($null -eq $state -or -not $runtimePath) { return $null }
  $sourcePath = Join-Path (Split-Path -Parent $runtimePath) ([string]$state.source)
  try {
    if (-not (Test-AuraUiPersonalWordmarkChildPath -Root $PersonalWordmarkGenerationsRoot -Candidate $sourcePath) -or
        -not (Test-Path -LiteralPath $sourcePath -PathType Leaf) -or
        ((Get-Item -LiteralPath $sourcePath -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        (Get-AuraUiSha256 -Path $sourcePath) -cne [string]$state.sourceSha256) {
      return $null
    }
    return [ordered]@{
      path = $sourcePath
      hash = [string]$state.sourceSha256
    }
  } catch {
    return $null
  }
}

function Get-AuraUiPersonalWordmarkPreviewUrl {
  $source = Get-AuraUiPersonalWordmarkSource
  if ($null -eq $source -or $source.hash -cnotmatch '^[a-f0-9]{64}$') { return $null }
  try {
    $root = [IO.Path]::GetFullPath($PersonalWordmarkRoot).TrimEnd('\')
    $path = [IO.Path]::GetFullPath([string]$source.path)
    if (-not (Test-AuraUiPersonalWordmarkChildPath -Root $root -Candidate $path)) { return $null }
    $relative = $path.Substring($root.Length + 1).Replace('\', '/')
    if ($relative -cnotmatch '^(staging/[a-f0-9]{32}|generations/[a-f0-9]{64})/source\.(png|jpg|jpeg)$') {
      return $null
    }
    return "https://aura.wordmark/${relative}?v=$($source.hash)"
  } catch {
    return $null
  }
}

function Test-AuraUiPersonalWordmarkUnavailable {
  $configured = Get-AuraUiConfiguredPersonalWordmarkPath
  return [bool]($configured -and -not (Test-AuraUiPersonalWordmarkRuntimePath -Path $configured))
}

function Clear-AuraUiPersonalWordmarkDraft {
  $draft = $script:PersonalWordmarkDraft
  $script:PersonalWordmarkDraft = $null
  if ($null -eq $draft) { return }
  try {
    Remove-AuraUiPersonalWordmarkDirectory -Path ([string]$draft.Directory)
  } catch {}
}

function Initialize-AuraUiPersonalWordmarkStorage {
  Assert-AuraUiPersonalWordmarkStorage
  $cutoff = [DateTime]::UtcNow.AddHours(-24)
  foreach ($directory in @(Get-ChildItem -LiteralPath $PersonalWordmarkStagingRoot -Directory -Force -ErrorAction SilentlyContinue)) {
    if ($directory.Name -cmatch '^[a-f0-9]{32}$' -and $directory.LastWriteTimeUtc -lt $cutoff) {
      try { Remove-AuraUiPersonalWordmarkDirectory -Path $directory.FullName } catch {}
    }
  }
}

function Remove-AuraUiOldPersonalWordmarkGenerations {
  $configured = Get-AuraUiConfiguredPersonalWordmarkPath
  $current = if (Test-AuraUiPersonalWordmarkRuntimePath -Path $configured) {
    [IO.Path]::GetFileName((Split-Path -Parent $configured))
  } else { $null }
  $directories = @(Get-ChildItem -LiteralPath $PersonalWordmarkGenerationsRoot -Directory -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -cmatch '^[a-f0-9]{64}$' } |
    Sort-Object LastWriteTimeUtc -Descending)
  $keep = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  if ($current) { [void]$keep.Add($current) }
  foreach ($directory in $directories) {
    if ($keep.Count -lt 2) {
      [void]$keep.Add($directory.Name)
      continue
    }
    if (-not $keep.Contains($directory.Name)) {
      try { Remove-AuraUiPersonalWordmarkDirectory -Path $directory.FullName } catch {}
    }
  }
}

function Assert-AuraUiPersonalWordmarkRequest {
  param([Parameter(Mandatory = $true)][object]$Message)
  if ($Message.requestId -isnot [string] -or
      -not (Test-AuraUiStudioUuid -Value ([string]$Message.requestId)) -or
      $Message.session -isnot [string] -or
      -not [string]::Equals(
        [string]$Message.session,
        [string]$script:PersonalWordmarkSession,
        [StringComparison]::Ordinal) -or
      ($Message.revision -isnot [int] -and $Message.revision -isnot [long]) -or
      [long]$Message.revision -ne [long]$script:PersonalWordmarkRevision) {
    throw 'Personal wordmark request state is stale or invalid.'
  }
  if ($Message.type -ceq 'set-personal-wordmark' -and
      ($Message.operation -isnot [string] -or
        $Message.operation -cnotin @('choose', 'cancel'))) {
    throw 'Personal wordmark operation is invalid.'
  }
}

function Invoke-AuraUiChoosePersonalWordmark {
  param(
    [AllowNull()][System.Windows.Forms.IWin32Window]$Owner,
    [Parameter(Mandatory = $true)][string]$RequestId
  )
  $dialog = [System.Windows.Forms.OpenFileDialog]::new()
  $newDraftDirectory = $null
  try {
    $dialog.Title = "$($script:UiCopy.chooseWordmarkTitle)"
    $dialog.Filter = "$($script:UiCopy.imagesFilter)|*.png;*.jpg;*.jpeg"
    $dialog.CheckFileExists = $true
    if ($dialog.ShowDialog($Owner) -ne [System.Windows.Forms.DialogResult]::OK) {
      Send-AuraUiStudioState -Action 'set-personal-wordmark' -ActionSucceeded $false -RequestId $RequestId
      return $false
    }
    Assert-AuraUiPersonalWordmarkStorage
    $chosen = [IO.Path]::GetFullPath($dialog.FileName)
    $extension = [IO.Path]::GetExtension($chosen).ToLowerInvariant()
    $sourceFile = [IO.FileInfo]::new($chosen)
    if ($extension -cnotin @('.png', '.jpg', '.jpeg') -or
        -not $sourceFile.Exists -or $sourceFile.Length -le 0 -or
        $sourceFile.Length -gt $PersonalWordmarkSourceMaxBytes -or
        -not (Test-AuraUiPersonalWordmarkSourceSignature -Path $chosen -Extension $extension)) {
      throw 'The selected personal wordmark is invalid.'
    }
    $dimensions = Get-AuraUiPersonalWordmarkImageInfo -Path $chosen
    if ($dimensions.width -lt 344 -or $dimensions.height -lt 124 -or
        $dimensions.width -gt 8192 -or $dimensions.height -gt 8192) {
      throw 'The selected personal wordmark dimensions are invalid.'
    }

    $draftId = [Guid]::NewGuid().ToString('N')
    $newDraftDirectory = Join-Path $PersonalWordmarkStagingRoot $draftId
    [IO.Directory]::CreateDirectory($newDraftDirectory) | Out-Null
    $sourceName = "source$extension"
    $sourcePath = Join-Path $newDraftDirectory $sourceName
    [IO.File]::Copy($chosen, $sourcePath, $false)
    if (([IO.FileInfo]::new($sourcePath)).Length -gt $PersonalWordmarkSourceMaxBytes -or
        -not (Test-AuraUiPersonalWordmarkSourceSignature -Path $sourcePath -Extension $extension)) {
      throw 'The selected personal wordmark could not be staged.'
    }
    $hash = Get-AuraUiSha256 -Path $sourcePath
    $previousDraft = $script:PersonalWordmarkDraft
    $script:PersonalWordmarkDraft = [PSCustomObject]@{
      Directory = $newDraftDirectory
      SourceName = $sourceName
      SourcePath = $sourcePath
      Hash = $hash
      Crop = [ordered]@{ x = 50.0; y = 50.0; zoom = 1.0 }
    }
    $newDraftDirectory = $null
    if ($null -ne $previousDraft) {
      try { Remove-AuraUiPersonalWordmarkDirectory -Path ([string]$previousDraft.Directory) } catch {}
    }
    Send-AuraUiStudioState -Action 'set-personal-wordmark' -RequestId $RequestId
    return $true
  } catch {
    if ($newDraftDirectory) {
      try { Remove-AuraUiPersonalWordmarkDirectory -Path $newDraftDirectory } catch {}
    }
    Show-AuraUiMessage -Title "$($script:UiCopy.wordmarkNotChangedTitle)" -Icon Warning `
      -Message "$($script:UiCopy.invalidWordmarkMessage)"
    Send-AuraUiStudioState -Status "$($script:UiCopy.invalidWordmarkMessage)" -Tone error `
      -Action 'set-personal-wordmark' -ActionSucceeded $false -RequestId $RequestId
    return $false
  } finally {
    $dialog.Dispose()
  }
}

function Invoke-AuraUiCancelPersonalWordmark {
  param([Parameter(Mandatory = $true)][string]$RequestId)
  Clear-AuraUiPersonalWordmarkDraft
  Send-AuraUiStudioState -Action 'set-personal-wordmark' -RequestId $RequestId
}

function Restore-AuraUiPersonalWordmarkConfig {
  param(
    [AllowNull()][object]$PreviousValue,
    [bool]$WasEnabled
  )
  $enabledValue = $WasEnabled.ToString().ToLowerInvariant()
  if ($PreviousValue -is [string] -and $PreviousValue.Trim()) {
    Set-AuraUiConfig -Options @(
      '--personal-wordmark', [string]$PreviousValue,
      '--enabled', $enabledValue)
  } else {
    Set-AuraUiConfig -Options @('--clear-personal-wordmark', '--enabled', $enabledValue)
  }
  if ($WasEnabled) { Apply-AuraUiTheme }
}

function Invoke-AuraUiSetPersonalWordmarkFraming {
  param(
    [Parameter(Mandatory = $true)][object]$X,
    [Parameter(Mandatory = $true)][object]$Y,
    [Parameter(Mandatory = $true)][object]$Zoom,
    [Parameter(Mandatory = $true)][string]$RequestId
  )
  Assert-AuraUiPersonalWordmarkStorage
  $source = Get-AuraUiPersonalWordmarkSource
  if ($null -eq $source) { throw 'No personal wordmark source is available.' }
  $xValue = ConvertTo-AuraUiStudioNumber -Value $X -Minimum 0 -Maximum 100 -Label 'Wordmark x'
  $yValue = ConvertTo-AuraUiStudioNumber -Value $Y -Minimum 0 -Maximum 100 -Label 'Wordmark y'
  $zoomValue = ConvertTo-AuraUiStudioNumber -Value $Zoom -Minimum 1 -Maximum 2 -Label 'Wordmark zoom'
  $transactionId = [Guid]::NewGuid().ToString('N')
  $transactionDirectory = Join-Path $PersonalWordmarkStagingRoot $transactionId
  $publishedDirectory = $null
  $publishedByTransaction = $false
  $previousValue = Get-AuraUiConfiguredPersonalWordmarkPath
  $wasEnabled = Get-AuraUiEnabled
  try {
    [IO.Directory]::CreateDirectory($transactionDirectory) | Out-Null
    $extension = [IO.Path]::GetExtension([string]$source.path).ToLowerInvariant()
    if ($extension -cnotin @('.png', '.jpg', '.jpeg')) {
      throw 'The personal wordmark source type is invalid.'
    }
    $sourceName = "source$extension"
    $transactionSource = Join-Path $transactionDirectory $sourceName
    [IO.File]::Copy([string]$source.path, $transactionSource, $false)
    $sourceHash = Get-AuraUiSha256 -Path $transactionSource
    if ($sourceHash -cne [string]$source.hash) {
      throw 'The personal wordmark source changed during save.'
    }

    $outputPath = Join-Path $transactionDirectory 'wordmark.png'
    [void](Invoke-AuraUiBakeWidePng `
      -SourcePath $transactionSource -OutputPath $outputPath `
      -X $xValue -Y $yValue -Zoom $zoomValue)
    if (-not (Test-AuraUiPersonalWordmarkSourceSignature -Path $outputPath -Extension '.png') -or
        ([IO.FileInfo]::new($outputPath)).Length -le 0 -or
        ([IO.FileInfo]::new($outputPath)).Length -gt $PersonalWordmarkOutputMaxBytes) {
      throw 'The personal wordmark output is invalid.'
    }
    $outputInfo = Get-AuraUiPersonalWordmarkImageInfo -Path $outputPath
    if ($outputInfo.width -ne 344 -or $outputInfo.height -ne 124) {
      throw 'The personal wordmark output dimensions are invalid.'
    }
    $outputHash = Get-AuraUiSha256 -Path $outputPath
    $invariant = [Globalization.CultureInfo]::InvariantCulture
    $descriptor = '{0}|{1}|{2}|{3}|{4}' -f @(
      $sourceHash,
      $xValue.ToString('0.######', $invariant),
      $yValue.ToString('0.######', $invariant),
      $zoomValue.ToString('0.######', $invariant),
      $outputHash)
    $generation = Get-AuraUiSha256 -Text $descriptor
    $state = [ordered]@{
      schemaVersion = 1
      generation = $generation
      source = $sourceName
      sourceSha256 = $sourceHash
      crop = [ordered]@{ x = $xValue; y = $yValue; zoom = $zoomValue }
      output = [ordered]@{
        width = 344
        height = 124
        sha256 = $outputHash
      }
    }
    $statePath = Join-Path $transactionDirectory 'state.json'
    [IO.File]::WriteAllText(
      $statePath,
      ($state | ConvertTo-Json -Depth 5 -Compress),
      [Text.UTF8Encoding]::new($false))

    $publishedDirectory = Join-Path $PersonalWordmarkGenerationsRoot $generation
    $publishedPath = Join-Path $publishedDirectory 'wordmark.png'
    if (Test-Path -LiteralPath $publishedDirectory -PathType Container) {
      if (Test-AuraUiPersonalWordmarkPublishedGeneration -GenerationDirectory $publishedDirectory) {
        Remove-AuraUiPersonalWordmarkDirectory -Path $transactionDirectory
      } else {
        $backupDirectory = Join-Path $PersonalWordmarkStagingRoot ([Guid]::NewGuid().ToString('N'))
        [IO.Directory]::Move($publishedDirectory, $backupDirectory)
        try {
          [IO.Directory]::Move($transactionDirectory, $publishedDirectory)
          $publishedByTransaction = $true
          $transactionDirectory = $null
          Remove-AuraUiPersonalWordmarkDirectory -Path $backupDirectory
        } catch {
          if (-not (Test-Path -LiteralPath $publishedDirectory) -and
              (Test-Path -LiteralPath $backupDirectory -PathType Container)) {
            [IO.Directory]::Move($backupDirectory, $publishedDirectory)
          }
          throw
        }
      }
    } else {
      [IO.Directory]::Move($transactionDirectory, $publishedDirectory)
      $publishedByTransaction = $true
    }
    $transactionDirectory = $null
    $enabledValue = $wasEnabled.ToString().ToLowerInvariant()
    try {
      Set-AuraUiConfig -Options @(
        '--personal-wordmark', $publishedPath,
        '--enabled', $enabledValue)
      if ($wasEnabled) { Apply-AuraUiTheme }
    } catch {
      try {
        Restore-AuraUiPersonalWordmarkConfig -PreviousValue $previousValue -WasEnabled $wasEnabled
      } catch {
        Write-AuraUiLog -Message 'Personal wordmark configuration rollback failed.'
      }
      $previousMatchesPublished = $false
      if ($previousValue -is [string] -and $previousValue.Trim()) {
        try {
          $previousMatchesPublished = [string]::Equals(
            [IO.Path]::GetFullPath([string]$previousValue),
            [IO.Path]::GetFullPath($publishedPath),
            [StringComparison]::OrdinalIgnoreCase)
        } catch {}
      }
      if ($publishedByTransaction -and -not $previousMatchesPublished) {
        try { Remove-AuraUiPersonalWordmarkDirectory -Path $publishedDirectory } catch {}
      }
      throw 'Personal wordmark configuration could not be committed.'
    }
    Clear-AuraUiPersonalWordmarkDraft
    $script:PersonalWordmarkRevision = [long]$script:PersonalWordmarkRevision + 1
    Remove-AuraUiOldPersonalWordmarkGenerations
    Send-AuraUiStudioState -Status "$($script:UiCopy.wordmarkPositionSaved)" `
      -Action 'set-personal-wordmark-framing' -RequestId $RequestId
  } catch {
    if ($transactionDirectory) {
      try { Remove-AuraUiPersonalWordmarkDirectory -Path $transactionDirectory } catch {}
    }
    throw 'The personal wordmark could not be saved.'
  }
}

function Invoke-AuraUiClearPersonalWordmark {
  param([Parameter(Mandatory = $true)][string]$RequestId)
  $previousValue = Get-AuraUiConfiguredPersonalWordmarkPath
  $wasEnabled = Get-AuraUiEnabled
  try {
    Set-AuraUiConfig -Options @(
      '--clear-personal-wordmark',
      '--enabled', $wasEnabled.ToString().ToLowerInvariant())
    if ($wasEnabled) { Apply-AuraUiTheme }
  } catch {
    try {
      Restore-AuraUiPersonalWordmarkConfig -PreviousValue $previousValue -WasEnabled $wasEnabled
    } catch {
      Write-AuraUiLog -Message 'Personal wordmark removal rollback failed.'
    }
    throw 'The personal wordmark could not be removed.'
  }
  Clear-AuraUiPersonalWordmarkDraft
  $script:PersonalWordmarkRevision = [long]$script:PersonalWordmarkRevision + 1
  foreach ($directory in @(
      Get-ChildItem -LiteralPath $PersonalWordmarkGenerationsRoot -Directory -Force -ErrorAction SilentlyContinue
    )) {
    if ($directory.Name -cmatch '^[a-f0-9]{64}$') {
      try { Remove-AuraUiPersonalWordmarkDirectory -Path $directory.FullName } catch {}
    }
  }
  Send-AuraUiStudioState -Status "$($script:UiCopy.removingWordmark)" `
    -Action 'clear-personal-wordmark' -RequestId $RequestId
}
