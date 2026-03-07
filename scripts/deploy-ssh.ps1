param(
    [Parameter(Mandatory = $true)]
    [string]$SshHost,

    [Parameter(Mandatory = $true)]
    [string]$User,

    [string]$TargetPath = "/home/$User/taxpal",

    [string]$Port = "22",

    [string]$KeyFile = ""
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path "dist")) {
    throw "dist folder not found. Run npm run build first."
}

if (-not (Test-Path "php-api")) {
    throw "php-api folder not found."
}

$sshArgs = @("-p", $Port, "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null")
$scpArgs = @("-P", $Port, "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null")

if ($KeyFile -ne "") {
    $sshArgs += @("-i", $KeyFile)
    $scpArgs += @("-i", $KeyFile)
}

$remote = "$User@$SshHost"

Write-Host "Creating remote folders..."
& ssh @sshArgs $remote "mkdir -p '$TargetPath' '$TargetPath/api'"
if ($LASTEXITCODE -ne 0) {
    throw "SSH connection failed while creating remote directories."
}

Write-Host "Uploading dist to $TargetPath ..."
& scp @scpArgs -r "dist/." "$remote`:$TargetPath/"
if ($LASTEXITCODE -ne 0) {
    throw "SCP upload failed for dist/."
}

Write-Host "Uploading php-api to $TargetPath/api ..."
& scp @scpArgs -r "php-api/." "$remote`:$TargetPath/api/"
if ($LASTEXITCODE -ne 0) {
    throw "SCP upload failed for php-api/."
}

Write-Host "Done. Verify: https://$SshHost/api/health"
