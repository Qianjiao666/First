[CmdletBinding()]
param(
  [string]$ProjectRef = 'hzxvmrbztbyapqnwttjq'
)

$ErrorActionPreference = 'Stop'
$npxCommand = Get-Command npx.cmd -ErrorAction SilentlyContinue
if (-not $npxCommand) { throw 'npx.cmd was not found.' }
$npx = $npxCommand.Source

$secureToken = Read-Host 'Paste Supabase access token (input is masked)' -AsSecureString
$tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try {
  $env:SUPABASE_ACCESS_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
}

$functions = @(
  'admin-redeem-codes',
  'admin-sensitive-words',
  'admin-transfer-account',
  'admin-users',
  'announcements',
  'forum-comment',
  'forum-moderation',
  'forum-post',
  'forum-vote',
  'notifications',
  'redeem',
  'shop',
  'task-admin',
  'task-attachments',
  'task-complete',
  'task-review'
)

try {
  foreach ($functionName in $functions) {
    Write-Host "Deploying $functionName ..."
    & $npx --yes supabase functions deploy $functionName --project-ref $ProjectRef --output-format text
    if ($LASTEXITCODE -ne 0) {
      throw "Deployment failed: $functionName"
    }
  }
  Write-Host 'All Edge Functions deployed successfully.' -ForegroundColor Green
} finally {
  $env:SUPABASE_ACCESS_TOKEN = $null
  $secureToken = $null
}

Read-Host 'Press Enter to close'
