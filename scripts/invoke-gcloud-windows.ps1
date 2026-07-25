param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $GcloudArguments
)

$ErrorActionPreference = 'Stop'
$gcloud = Join-Path $env:LOCALAPPDATA 'Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'

if (-not (Test-Path -LiteralPath $gcloud)) {
  Write-Error "Google Cloud CLI was not found at the expected Windows user-local path."
  exit 127
}

& $gcloud @GcloudArguments
exit $LASTEXITCODE
