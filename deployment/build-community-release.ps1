[CmdletBinding()]
param(
  [string]$Root = '',
  [string]$ReleaseDate = '20260812',
  [string]$Revision = 'v1.1'
)

$ErrorActionPreference = 'Stop'

if (-not $Root) {
  $Root = Split-Path -Parent $PSScriptRoot
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Copy-RelativeFile {
  param([string]$SourceRoot, [string]$RelativePath, [string]$DestinationRoot)

  $source = Join-Path $SourceRoot $RelativePath
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
    throw "Missing release source: $RelativePath"
  }

  $destination = Join-Path $DestinationRoot $RelativePath
  $destinationDirectory = Split-Path -Parent $destination
  New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination -Force
}

function Copy-RelativeTree {
  param([string]$SourceRoot, [string]$RelativePath, [string]$DestinationRoot)

  $sourceDirectory = Join-Path $SourceRoot $RelativePath
  if (-not (Test-Path -LiteralPath $sourceDirectory -PathType Container)) {
    throw "Missing release directory: $RelativePath"
  }

  Get-ChildItem -LiteralPath $sourceDirectory -Recurse -File |
    Where-Object { $_.FullName -notmatch '[\\/](tests|docs)([\\/]|$)' } |
    ForEach-Object {
      $relative = $_.FullName.Substring($SourceRoot.Length).TrimStart('\', '/')
      Copy-RelativeFile -SourceRoot $SourceRoot -RelativePath $relative -DestinationRoot $DestinationRoot
    }
}

function Remove-GeneratedPath {
  param([string]$Path, [string]$RootPath)

  $resolvedRoot = [IO.Path]::GetFullPath($RootPath)
  $resolvedPath = [IO.Path]::GetFullPath($Path)
  if (-not $resolvedPath.StartsWith($resolvedRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove a path outside the workspace: $resolvedPath"
  }
  if (Test-Path -LiteralPath $resolvedPath) {
    Remove-Item -LiteralPath $resolvedPath -Recurse -Force
  }
}

function Write-ReleaseManifest {
  param([string]$StageRoot, [string]$ManifestName, [string]$Description)

  $manifest = Join-Path $StageRoot $ManifestName
  $entries = Get-ChildItem -LiteralPath $StageRoot -Recurse -File |
    Where-Object { $_.Name -ne $ManifestName } |
    Sort-Object FullName |
    ForEach-Object {
      $relative = $_.FullName.Substring($StageRoot.Length).TrimStart('\', '/') -replace '\\', '/'
      $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash
      "$hash  $relative"
    }

  $manifestLines = @(
    '# MKJ community release manifest'
    "Release: $ReleaseDate"
    "Revision: $Revision"
    $Description
    "Files: $($entries.Count)"
    ''
    $entries
  )
  $manifestContent = ($manifestLines -join "`n") + "`n"
  $manifestEncoding = [Text.UTF8Encoding]::new($false)
  [IO.File]::WriteAllBytes($manifest, $manifestEncoding.GetBytes($manifestContent))
}

function Write-LinuxZip {
  param([string]$StageRoot, [string]$DestinationZip, [DateTimeOffset]$Timestamp)

  $archive = [IO.Compression.ZipFile]::Open(
    $DestinationZip,
    [IO.Compression.ZipArchiveMode]::Create
  )

  try {
    Get-ChildItem -LiteralPath $StageRoot -Recurse -File |
      Sort-Object FullName |
      ForEach-Object {
        $entryName = $_.FullName.Substring($StageRoot.Length).TrimStart([char]92, [char]47).Replace([char]92, [char]47)
        $entry = $archive.CreateEntry($entryName, [IO.Compression.CompressionLevel]::Optimal)
        $entry.LastWriteTime = $Timestamp
        $inputStream = [IO.File]::OpenRead($_.FullName)
        $outputStream = $entry.Open()

        try {
          $inputStream.CopyTo($outputStream)
        } finally {
          $outputStream.Dispose()
          $inputStream.Dispose()
        }
      }
  } finally {
    $archive.Dispose()
  }
}

$deploymentRoot = Join-Path $Root 'deployment'
$staticStage = Join-Path $deploymentRoot "MKJ-community-forum-tasks-$ReleaseDate-static-$Revision"
$backendStage = Join-Path $deploymentRoot "MKJ-community-forum-tasks-$ReleaseDate-backend-$Revision"
$staticZip = Join-Path $deploymentRoot "MKJ-community-forum-tasks-$ReleaseDate-static-$Revision.zip"
$backendZip = Join-Path $deploymentRoot "MKJ-community-forum-tasks-$ReleaseDate-backend-$Revision.zip"
$staticChecksum = "$staticZip.sha256"
$backendChecksum = "$backendZip.sha256"
$releaseTimestamp = [DateTimeOffset]::new(
  [DateTime]::SpecifyKind(
    [DateTime]::ParseExact($ReleaseDate, 'yyyyMMdd', [Globalization.CultureInfo]::InvariantCulture),
    [DateTimeKind]::Utc
  )
)

Remove-GeneratedPath -Path $staticStage -RootPath $deploymentRoot
Remove-GeneratedPath -Path $backendStage -RootPath $deploymentRoot
Remove-GeneratedPath -Path $staticZip -RootPath $deploymentRoot
Remove-GeneratedPath -Path $backendZip -RootPath $deploymentRoot
Remove-GeneratedPath -Path $staticChecksum -RootPath $deploymentRoot
Remove-GeneratedPath -Path $backendChecksum -RootPath $deploymentRoot
New-Item -ItemType Directory -Force -Path $staticStage, $backendStage | Out-Null

foreach ($file in @('index.html', 'styles.css', 'script.js', 'supabase-config.js')) {
  Copy-RelativeFile -SourceRoot $Root -RelativePath $file -DestinationRoot $staticStage
}
foreach ($directory in @('assets', 'admin', 'community', 'forum', 'tasks', 'shop', 'announcements', 'shared')) {
  Copy-RelativeTree -SourceRoot $Root -RelativePath $directory -DestinationRoot $staticStage
}

Copy-RelativeFile -SourceRoot $Root -RelativePath 'supabase/schema.sql' -DestinationRoot $backendStage
Copy-RelativeFile -SourceRoot $Root -RelativePath 'supabase/modules/tasks.sql' -DestinationRoot $backendStage
Copy-RelativeTree -SourceRoot $Root -RelativePath 'supabase/migrations' -DestinationRoot $backendStage
Copy-RelativeTree -SourceRoot $Root -RelativePath 'supabase/functions' -DestinationRoot $backendStage
Copy-RelativeFile -SourceRoot $Root -RelativePath 'docs/COMMUNITY_RELEASE_RUNBOOK.md' -DestinationRoot $backendStage

Write-ReleaseManifest -StageRoot $staticStage -ManifestName 'RELEASE-MANIFEST.txt' -Description 'Static browser release only; no database, function, test, or documentation source.'
Write-ReleaseManifest -StageRoot $backendStage -ManifestName 'RELEASE-MANIFEST.txt' -Description 'Supabase migrations, canonical schema, and Edge Function release; never copy into the static web root.'

Write-LinuxZip -StageRoot $staticStage -DestinationZip $staticZip -Timestamp $releaseTimestamp
Write-LinuxZip -StageRoot $backendStage -DestinationZip $backendZip -Timestamp $releaseTimestamp

$staticHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $staticZip).Hash
$backendHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $backendZip).Hash
[IO.File]::WriteAllBytes($staticChecksum, [Text.Encoding]::ASCII.GetBytes("$staticHash  $(Split-Path -Leaf $staticZip)`n"))
[IO.File]::WriteAllBytes($backendChecksum, [Text.Encoding]::ASCII.GetBytes("$backendHash  $(Split-Path -Leaf $backendZip)`n"))

$forbiddenStatic = Get-ChildItem -LiteralPath $staticStage -Recurse -File |
  Where-Object { $_.FullName -match '[\\/](supabase|tests|docs|output)([\\/]|$)' }
if ($forbiddenStatic) {
  throw 'Static release contains a forbidden deployment-only path.'
}

Write-Output "Static package: $staticZip"
Write-Output "Backend package: $backendZip"
Write-Output "Static SHA256: $staticHash"
Write-Output "Backend SHA256: $backendHash"
