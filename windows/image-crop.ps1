function Get-AuraUiCoverCropRectangle {
  param(
    [Parameter(Mandatory = $true)][double]$SourceWidth,
    [Parameter(Mandatory = $true)][double]$SourceHeight,
    [Parameter(Mandatory = $true)][double]$OutputWidth,
    [Parameter(Mandatory = $true)][double]$OutputHeight,
    [Parameter(Mandatory = $true)][double]$X,
    [Parameter(Mandatory = $true)][double]$Y,
    [Parameter(Mandatory = $true)][double]$Zoom
  )
  foreach ($dimension in @($SourceWidth, $SourceHeight, $OutputWidth, $OutputHeight)) {
    if ([double]::IsNaN($dimension) -or [double]::IsInfinity($dimension) -or $dimension -le 0) {
      throw 'Crop dimensions must be positive finite numbers.'
    }
  }
  if ([double]::IsNaN($X) -or [double]::IsInfinity($X) -or $X -lt 0 -or $X -gt 100 -or
      [double]::IsNaN($Y) -or [double]::IsInfinity($Y) -or $Y -lt 0 -or $Y -gt 100 -or
      [double]::IsNaN($Zoom) -or [double]::IsInfinity($Zoom) -or $Zoom -lt 1 -or $Zoom -gt 2) {
    throw 'Crop coordinates are outside the supported range.'
  }
  $scale = [Math]::Max($OutputWidth / $SourceWidth, $OutputHeight / $SourceHeight) * $Zoom
  $cropWidth = $OutputWidth / $scale
  $cropHeight = $OutputHeight / $scale
  $round = [MidpointRounding]::AwayFromZero
  return [ordered]@{
    left = [Math]::Round([Math]::Max(0.0, $SourceWidth - $cropWidth) * $X / 100.0, 6, $round)
    top = [Math]::Round([Math]::Max(0.0, $SourceHeight - $cropHeight) * $Y / 100.0, 6, $round)
    width = [Math]::Round($cropWidth, 6, $round)
    height = [Math]::Round($cropHeight, 6, $round)
  }
}

function Invoke-AuraUiBakeWidePng {
  param(
    [Parameter(Mandatory = $true)][string]$SourcePath,
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [Parameter(Mandatory = $true)][double]$X,
    [Parameter(Mandatory = $true)][double]$Y,
    [Parameter(Mandatory = $true)][double]$Zoom,
    [ValidateRange(1, 4096)][int]$WorkingWidth = 688,
    [ValidateRange(1, 4096)][int]$WorkingHeight = 248,
    [ValidateRange(1, 2048)][int]$OutputWidth = 344,
    [ValidateRange(1, 2048)][int]$OutputHeight = 124
  )
  Add-Type -AssemblyName System.Drawing
  $stream = $null
  $source = $null
  $working = $null
  $workingGraphics = $null
  $output = $null
  $outputGraphics = $null
  $temporary = "$OutputPath.tmp-$([Guid]::NewGuid().ToString('N'))"
  try {
    $stream = [IO.File]::Open(
      $SourcePath,
      [IO.FileMode]::Open,
      [IO.FileAccess]::Read,
      [IO.FileShare]::Read)
    $source = [Drawing.Image]::FromStream($stream, $true, $true)
    $sourceWidth = [double]$source.Width
    $sourceHeight = [double]$source.Height
    $crop = Get-AuraUiCoverCropRectangle `
      -SourceWidth $sourceWidth -SourceHeight $sourceHeight `
      -OutputWidth $WorkingWidth -OutputHeight $WorkingHeight `
      -X $X -Y $Y -Zoom $Zoom

    $working = [Drawing.Bitmap]::new(
      $WorkingWidth,
      $WorkingHeight,
      [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $working.SetResolution(96, 96)
    $workingGraphics = [Drawing.Graphics]::FromImage($working)
    $workingGraphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
    $workingGraphics.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
    $workingGraphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $workingGraphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $workingGraphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::HighQuality
    $workingGraphics.Clear([Drawing.Color]::Transparent)
    $workingGraphics.DrawImage(
      $source,
      [Drawing.Rectangle]::new(0, 0, $WorkingWidth, $WorkingHeight),
      [single]$crop.left,
      [single]$crop.top,
      [single]$crop.width,
      [single]$crop.height,
      [Drawing.GraphicsUnit]::Pixel)
    $workingGraphics.Dispose()
    $workingGraphics = $null

    $output = [Drawing.Bitmap]::new(
      $OutputWidth,
      $OutputHeight,
      [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $output.SetResolution(96, 96)
    $outputGraphics = [Drawing.Graphics]::FromImage($output)
    $outputGraphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
    $outputGraphics.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
    $outputGraphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $outputGraphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $outputGraphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::HighQuality
    $outputGraphics.Clear([Drawing.Color]::Transparent)
    $outputGraphics.DrawImage(
      $working,
      [Drawing.Rectangle]::new(0, 0, $OutputWidth, $OutputHeight),
      0,
      0,
      $WorkingWidth,
      $WorkingHeight,
      [Drawing.GraphicsUnit]::Pixel)
    $outputGraphics.Dispose()
    $outputGraphics = $null

    $directory = Split-Path -Parent $OutputPath
    if (-not $directory) { throw 'A crop output directory is required.' }
    [IO.Directory]::CreateDirectory([IO.Path]::GetFullPath($directory)) | Out-Null
    $output.Save($temporary, [Drawing.Imaging.ImageFormat]::Png)
    $output.Dispose()
    $output = $null
    [IO.File]::Copy($temporary, $OutputPath, $true)
    return [ordered]@{
      sourceWidth = [int]$sourceWidth
      sourceHeight = [int]$sourceHeight
      outputWidth = $OutputWidth
      outputHeight = $OutputHeight
      bytes = ([IO.FileInfo]::new($OutputPath)).Length
    }
  } finally {
    if ($null -ne $outputGraphics) { try { $outputGraphics.Dispose() } catch {} }
    if ($null -ne $output) { try { $output.Dispose() } catch {} }
    if ($null -ne $workingGraphics) { try { $workingGraphics.Dispose() } catch {} }
    if ($null -ne $working) { try { $working.Dispose() } catch {} }
    if ($null -ne $source) { try { $source.Dispose() } catch {} }
    if ($null -ne $stream) { try { $stream.Dispose() } catch {} }
    try {
      if (Test-Path -LiteralPath $temporary -PathType Leaf) {
        [IO.File]::Delete($temporary)
      }
    } catch {}
  }
}
