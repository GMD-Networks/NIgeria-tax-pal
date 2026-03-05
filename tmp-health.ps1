$conn = Get-NetTCPConnection -LocalPort 8101 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
  $conn | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
}
$phpExe = (Get-Command php).Source
$job = Start-Job -ScriptBlock {
  param($exe)
  Set-Location 'd:\project\nigeria-tax-pal'
  & $exe -S 127.0.0.1:8101 -t php-api
} -ArgumentList $phpExe
Start-Sleep -Seconds 2
try {
  $h = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8101/api/health' -Method GET -TimeoutSec 15
  Write-Output ('HEALTH: ' + $h.Content)
} catch {
  $resp = $_.Exception.Response
  if ($resp) {
    $r = New-Object System.IO.StreamReader($resp.GetResponseStream())
    Write-Output ('HEALTH_ERR: ' + $r.ReadToEnd())
  } else {
    Write-Output ('HEALTH_ERR: ' + $_.Exception.Message)
  }
}
Stop-Job $job -ErrorAction SilentlyContinue
Remove-Job $job -Force -ErrorAction SilentlyContinue
