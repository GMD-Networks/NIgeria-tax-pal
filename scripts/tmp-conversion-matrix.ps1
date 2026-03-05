$base = 'http://127.0.0.1:8106/api/convert'
$root = 'scripts/fixtures'
$tests = @(
  @{in='sample.pdf';  target='docx'; out='out_pdf_to_docx.docx'},
  @{in='sample.pdf';  target='xlsx'; out='out_pdf_to_xlsx.xlsx'},
  @{in='sample.pdf';  target='pptx'; out='out_pdf_to_pptx.pptx'},
  @{in='sample.docx'; target='pdf';  out='out_docx_to_pdf.pdf'},
  @{in='sample.xlsx'; target='pdf';  out='out_xlsx_to_pdf.pdf'},
  @{in='sample.pptx'; target='pdf';  out='out_pptx_to_pdf.pdf'}
)

$handler = New-Object System.Net.Http.HttpClientHandler
$client = New-Object System.Net.Http.HttpClient($handler)
$client.Timeout = [TimeSpan]::FromSeconds(240)

foreach ($t in $tests) {
  $inPath = Join-Path $root $t.in
  $outPath = Join-Path $root $t.out

  try {
    $url = $base + '?target=' + $t.target
    $multi = New-Object System.Net.Http.MultipartFormDataContent
    $bytes = [System.IO.File]::ReadAllBytes($inPath)
    $fileContent = New-Object System.Net.Http.ByteArrayContent($bytes)
    $multi.Add($fileContent, 'file', [System.IO.Path]::GetFileName($inPath))

    $resp = $client.PostAsync($url, $multi).GetAwaiter().GetResult()
    $respBytes = $resp.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
    [System.IO.File]::WriteAllBytes($outPath, $respBytes)

    if ($resp.IsSuccessStatusCode) {
      $size = $respBytes.Length
      Write-Output ("PASS {0} -> {1} size={2}" -f $t.in, $t.target, $size)
    } else {
      $body = [System.Text.Encoding]::UTF8.GetString($respBytes)
      Write-Output ("FAIL {0} -> {1} HTTP={2} msg={3}" -f $t.in, $t.target, [int]$resp.StatusCode, $body)
    }
  }
  catch {
    $msg = $_.Exception.Message
    Write-Output ("FAIL {0} -> {1} msg={2}" -f $t.in, $t.target, $msg)
  }
}

$client.Dispose()
