# Run from PowerShell. The private code is read securely, never stored in a file.
[CmdletBinding()]
param(
    [string]$ProjectId = 'planner-project-7ab9e',
    [string]$CredentialFile = '',
    [string]$NodePath = 'node',
    [ValidateRange(1024, 65535)][int]$Port = 8787,
    [switch]$UseApplicationDefaultCredentials,
    [switch]$EnableActivityCleanup
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $repo 'functions\start-private.js'
$names = @('PRIVATE_ADMIN_CODE', 'PRIVATE_SERVER_MODE', 'PRIVATE_HOST', 'PRIVATE_PORT',
    'PRIVATE_ORIGIN', 'PRIVATE_ENABLE_ACTIVITY', 'PRIVATE_ENABLE_ACTIVITY_CLEANUP',
    'GOOGLE_CLOUD_PROJECT', 'GCLOUD_PROJECT', 'GOOGLE_APPLICATION_CREDENTIALS')
$saved = @{}
foreach ($name in $names) { $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$secret = $null
$pointer = [IntPtr]::Zero

try {
    $version = & $NodePath --version
    if ($LASTEXITCODE -ne 0 -or $version -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 22) {
        throw 'Install/select Node.js 22 or newer, or pass -NodePath pointing to its node.exe.'
    }
    if (-not (Test-Path (Join-Path $repo 'functions\node_modules\firebase-admin\package.json'))) {
        throw 'Install the backend dependencies first with npm ci inside the functions directory.'
    }
    if (-not $CredentialFile -and -not $env:GOOGLE_APPLICATION_CREDENTIALS -and -not $UseApplicationDefaultCredentials) {
        $CredentialFile = Read-Host 'Path to your authorized service-account JSON outside this project (Enter for existing Application Default Credentials)'
    }
    if ($CredentialFile) {
        $env:GOOGLE_APPLICATION_CREDENTIALS = (Resolve-Path -LiteralPath $CredentialFile).Path
    }
    $env:GOOGLE_CLOUD_PROJECT = $ProjectId
    $env:PRIVATE_SERVER_MODE = 'local'
    $env:PRIVATE_HOST = '127.0.0.1'
    $env:PRIVATE_PORT = [string]$Port
    $env:PRIVATE_ORIGIN = "http://127.0.0.1:$Port"
    $env:PRIVATE_ENABLE_ACTIVITY = 'false'
    $env:PRIVATE_ENABLE_ACTIVITY_CLEANUP = if ($EnableActivityCleanup) { 'true' } else { 'false' }

    Write-Host 'This dashboard listens only on this PC. It reads real Firebase accounts using your authorized server credentials.'
    Write-Host 'The next code becomes this server process''s login code. Nothing is sent to Firebase Secret Manager.'
    $secret = Read-Host 'Choose the private access code (prefer a new long random code)' -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    $env:PRIVATE_ADMIN_CODE = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    $pointer = [IntPtr]::Zero
    if ($env:PRIVATE_ADMIN_CODE.Trim().Length -lt 8 -or $env:PRIVATE_ADMIN_CODE.Length -gt 256) {
        throw 'The code must contain 8 to 256 characters. It was not saved.'
    }
    & $NodePath $launcher
    if ($LASTEXITCODE -ne 0) { throw 'Private server did not start successfully. Resolve the setup error above and retry.' }
} finally {
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    if ($null -ne $secret) { $secret.Dispose() }
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process') }
}