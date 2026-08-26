param(
  [string]$FfmpegPath = (Get-ChildItem -Recurse -File ".video-tools" -Filter "ffmpeg*.exe" | Select-Object -First 1 -ExpandProperty FullName)
)

$ErrorActionPreference = "Stop"

if (-not $FfmpegPath) {
  throw "FFmpeg was not found. Install imageio-ffmpeg into .video-tools first."
}

$raw = Join-Path $PSScriptRoot "..\.video-tools\raw-human"
$videos = Join-Path $PSScriptRoot "..\public\videos"
$posters = Join-Path $PSScriptRoot "..\public\exercises"

New-Item -ItemType Directory -Force -Path $videos, $posters | Out-Null

function Convert-LandscapeClip {
  param(
    [string]$Source,
    [string]$Output,
    [double]$Duration,
    [double]$Start = 0,
    [string]$ExtraFilter = ""
  )

  $filter = "scale=720:540:force_original_aspect_ratio=increase,crop=720:540"
  if ($ExtraFilter) { $filter += ",$ExtraFilter" }
  $filter += ",fps=24,format=yuv420p"

  & $FfmpegPath -hide_banner -loglevel error -y -ss $Start -t $Duration -i $Source `
    -an -vf $filter -c:v libx264 -preset medium -crf 23 -movflags +faststart $Output
  if ($LASTEXITCODE -ne 0) { throw "Failed to build $Output" }
}

function Convert-PortraitClip {
  param(
    [string]$Source,
    [string]$Output,
    [double]$Duration,
    [double]$Start = 0
  )

  $filter = "[0:v]scale=720:540:force_original_aspect_ratio=increase,crop=720:540,gblur=sigma=24[bg];" +
    "[0:v]scale=720:540:force_original_aspect_ratio=decrease[fg];" +
    "[bg][fg]overlay=(W-w)/2:(H-h)/2,fps=24,format=yuv420p"

  & $FfmpegPath -hide_banner -loglevel error -y -ss $Start -t $Duration -i $Source `
    -an -filter_complex $filter -c:v libx264 -preset medium -crf 23 -movflags +faststart $Output
  if ($LASTEXITCODE -ne 0) { throw "Failed to build $Output" }
}

function Export-Poster {
  param([string]$Video, [string]$Poster)

  & $FfmpegPath -hide_banner -loglevel error -y -ss 1 -i $Video -frames:v 1 -q:v 2 $Poster
  if ($LASTEXITCODE -ne 0) { throw "Failed to export $Poster" }
}

$jobs = @(
  @{ Name = "squat"; Source = "squat-full-source.mp4"; Duration = 8; Portrait = $false },
  @{ Name = "reverse-lunge"; Source = "reverse-lunge-full-source.mp4"; Duration = 8; Portrait = $true },
  @{ Name = "incline-pushup"; Source = "incline-pushup-full-source.mp4"; Duration = 8; Portrait = $false },
  @{ Name = "glute-bridge"; Source = "glute-bridge-source.mp4"; Duration = 6; Portrait = $false },
  @{ Name = "plank-rotation"; Source = "bird-yoga-1.mp4"; Duration = 10; Portrait = $true },
  @{ Name = "forearm-plank"; Source = "plank-static-source.mp4"; Duration = 7; Portrait = $false; ExtraFilter = "eq=brightness=0.08:contrast=1.05" }
)

foreach ($job in $jobs) {
  $source = Join-Path $raw $job.Source
  $video = Join-Path $videos ($job.Name + ".mp4")
  $poster = Join-Path $posters ($job.Name + ".jpg")

  if ($job.Portrait) {
    Convert-PortraitClip -Source $source -Output $video -Duration $job.Duration
  } else {
    Convert-LandscapeClip -Source $source -Output $video -Duration $job.Duration -ExtraFilter $job.ExtraFilter
  }

  Export-Poster -Video $video -Poster $poster
}

Write-Output "Built six human movement videos and matching posters."
