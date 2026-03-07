param(
    [Parameter(Mandatory = $true)]
    [string]$Host,

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

$sshArgs = @("-p", $Port)
$scpArgs = @("-P", $Port)

if ($KeyFile -ne "") {
    $sshArgs += @("-i", $KeyFile)
    $scpArgs += @("-i", $KeyFile)
}

$remote = "$User@$Host"

Write-Host "Creating remote folders..."
& ssh @sshArgs $remote "mkdir -p '$TargetPath' '$TargetPath/api'"

Write-Host "Uploading dist to $TargetPath ..."
& scp @scpArgs -r "dist/*" "$remote`:$TargetPath/"

Write-Host "Uploading php-api to $TargetPath/api ..."
& scp @scpArgs -r "php-api/*" "$remote`:$TargetPath/api/"

Write-Host "Done. Verify: https://$Host/api/health"
