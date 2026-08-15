[CmdletBinding()]
param(
  [string[]]$Paths = @(),
  [string]$EnvFile = '',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Import-EnvFile {
  param([string]$Path)
  if (-not $Path) { return }
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Environment file not found: $Path" }
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

$domain = Require-Env -Name 'CDN_DOMAIN'
$configuredPaths = [Environment]::GetEnvironmentVariable('CDN_PATHS', 'Process')
if (-not $Paths -or $Paths.Count -eq 0) {
  if (-not $configuredPaths) { $configuredPaths = '/*' }
  $Paths = $configuredPaths -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
}
$flushType = [Environment]::GetEnvironmentVariable('CDN_FLUSH_TYPE', 'Process')
if (-not $flushType) { $flushType = 'flush' }
if ($flushType -notin @('flush', 'delete')) { throw 'CDN_FLUSH_TYPE must be flush or delete' }

$urls = @($Paths | ForEach-Object {
  $path = $_
  if (-not $path.StartsWith('/')) { $path = "/$path" }
  "https://$domain$path"
})
if ($urls.Count -eq 0) { throw 'At least one CDN path is required.' }

$binaryName = [Environment]::GetEnvironmentVariable('TENCENTCLOUD_CLI_BIN', 'Process')
if (-not $binaryName) { $binaryName = 'tccli' }
$region = [Environment]::GetEnvironmentVariable('TENCENTCLOUD_REGION', 'Process')
if ($region) { $env:TENCENTCLOUD_REGION = $region }

$payload = @{ Paths = $urls; FlushType = $flushType } | ConvertTo-Json -Compress
$tempPath = Join-Path ([IO.Path]::GetTempPath()) ("mkj-cdn-purge-{0}.json" -f [guid]::NewGuid())
[IO.File]::WriteAllText($tempPath, $payload, [Text.UTF8Encoding]::new($false))
try {
  Write-Output "Purging CDN paths for ${domain}: $($urls -join ', ')"
  if ($DryRun) {
    Write-Output "Dry run payload: $payload"
    exit 0
  }
  $binary = Get-Command $binaryName -ErrorAction SilentlyContinue
  if (-not $binary) { throw "Tencent Cloud CLI executable not found: $binaryName" }
  & $binary.Source cdn PurgePathCache --cli-input-json "file://$tempPath"
  if ($LASTEXITCODE -ne 0) { throw "CDN purge failed with exit code $LASTEXITCODE" }
  Write-Output 'CDN purge request completed.'
} finally {
  Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
}
