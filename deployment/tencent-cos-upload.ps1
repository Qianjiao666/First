[CmdletBinding()]
param(
  [string]$SourceDir = '',
  [string]$EnvFile = '',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Import-EnvFile {
  param([string]$Path)

  if (-not $Path) { return }
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Environment file not found: $Path"
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
    $separator = $trimmed.IndexOf('=')
    if ($separator -lt 1) { throw "Invalid environment line in $Path" }
    $name = $trimmed.Substring(0, $separator).Trim()
    $value = $trimmed.Substring($separator + 1).Trim()
    if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    # Explicit process variables (for example CI-injected settings) win over the file.
    if (-not [Environment]::GetEnvironmentVariable($name, 'Process')) {
      [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
  }
}

function Require-Env {
  param([string]$Name)
  $value = [Environment]::GetEnvironmentVariable($Name, 'Process')
  if (-not $value) { throw "Missing required environment variable: $Name" }
  return $value.Trim()
}

$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $EnvFile) {
  $candidate = Join-Path $PSScriptRoot 'tencent-cos.env'
  if (Test-Path -LiteralPath $candidate -PathType Leaf) { $EnvFile = $candidate }
}
Import-EnvFile -Path $EnvFile

if (-not $SourceDir) { $SourceDir = Require-Env -Name 'COS_SOURCE_DIR' }
if (-not [IO.Path]::IsPathRooted($SourceDir)) { $SourceDir = Join-Path $repoRoot $SourceDir }
$SourceDir = [IO.Path]::GetFullPath($SourceDir)
if (-not (Test-Path -LiteralPath $SourceDir -PathType Container)) {
  throw "Static release directory not found: $SourceDir"
}

$bucket = Require-Env -Name 'COS_BUCKET'
$region = Require-Env -Name 'COS_REGION'
$prefix = [Environment]::GetEnvironmentVariable('COS_PREFIX', 'Process')
$prefix = if ($prefix) { $prefix.Trim('/') } else { '' }
$binaryName = [Environment]::GetEnvironmentVariable('COSCLI_BIN', 'Process')
if (-not $binaryName) { $binaryName = 'coscli' }

$target = "cos://$bucket/"
if ($prefix) { $target += "$prefix/" }
$target = $target.TrimEnd('/') + '/'
$arguments = @('cp', '-r', $SourceDir, $target)

Write-Output "Uploading static release: $SourceDir"
Write-Output "COS target: $target (region $region)"
if ($DryRun) {
  Write-Output "Dry run: $binaryName $($arguments -join ' ')"
  exit 0
}

$binary = Get-Command $binaryName -ErrorAction SilentlyContinue
if (-not $binary) { throw "coscli executable not found: $binaryName" }

# coscli reads credentials from its local profile or the CI credential helper.
# No secret is accepted as a command argument or written to the repository.
$env:COS_REGION = $region
& $binary.Source @arguments
if ($LASTEXITCODE -ne 0) { throw "coscli upload failed with exit code $LASTEXITCODE" }
Write-Output 'COS upload completed.'
