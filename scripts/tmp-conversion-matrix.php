<?php

$root = __DIR__ . '/fixtures';
if (!is_dir($root)) {
    mkdir($root, 0777, true);
}

$soffice = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';
$seedTxt = $root . '/seed.txt';
$seedCsv = $root . '/seed.csv';
file_put_contents($seedTxt, "TaxPal conversion seed document\n");
file_put_contents($seedCsv, "name,amount\nvat,7500\n");

function runCmd(string $cmd): array {
    $output = [];
    $code = 0;
    exec($cmd . ' 2>&1', $output, $code);
    return ['code' => $code, 'output' => implode("\n", $output)];
}

if (is_file($soffice)) {
    $common = ' --headless --nologo --nolockcheck --nofirststartwizard --invisible ';
    runCmd('"' . $soffice . '"' . $common . '--convert-to docx --outdir "' . $root . '" "' . $seedTxt . '"');
    runCmd('"' . $soffice . '"' . $common . '--convert-to pdf --outdir "' . $root . '" "' . $seedTxt . '"');
    runCmd('"' . $soffice . '"' . $common . '--convert-to xlsx --outdir "' . $root . '" "' . $seedCsv . '"');
    runCmd('"' . $soffice . '"' . $common . '--convert-to pptx --outdir "' . $root . '" "' . $seedTxt . '"');
}

$fixtures = [
    'pdf' => is_file($root . '/seed.pdf') ? $root . '/seed.pdf' : $root . '/sample.pdf',
    'docx' => is_file($root . '/seed.docx') ? $root . '/seed.docx' : $root . '/sample.docx',
    'xlsx' => is_file($root . '/seed.xlsx') ? $root . '/seed.xlsx' : $root . '/sample.xlsx',
    'pptx' => is_file($root . '/seed.pptx') ? $root . '/seed.pptx' : $root . '/sample.pptx',
];

$tests = [
    ['from' => 'pdf', 'to' => 'docx'],
    ['from' => 'pdf', 'to' => 'xlsx'],
    ['from' => 'pdf', 'to' => 'pptx'],
    ['from' => 'docx', 'to' => 'pdf'],
    ['from' => 'xlsx', 'to' => 'pdf'],
    ['from' => 'pptx', 'to' => 'pdf'],
];

$base = 'http://127.0.0.1:8106/api/convert?target=';

foreach ($tests as $test) {
    $from = $test['from'];
    $to = $test['to'];
    $in = $fixtures[$from] ?? '';
    if ($in === '' || !is_file($in)) {
        echo "FAIL {$from} -> {$to} msg=missing fixture\n";
        continue;
    }

    $ch = curl_init();
    $url = $base . rawurlencode($to);
    $post = ['file' => new CURLFile($in)];

    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $post,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 240,
    ]);

    $body = curl_exec($ch);
    $err = curl_error($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($body === false) {
        echo "FAIL {$from} -> {$to} msg={$err}\n";
        continue;
    }

    $outPath = $root . '/result_' . $from . '_to_' . $to . '.' . $to;
    file_put_contents($outPath, $body);

    if ($status >= 200 && $status < 300) {
        $size = filesize($outPath);
        echo "PASS {$from} -> {$to} size={$size} fixture=" . basename($in) . "\n";
    } else {
        $snippet = trim(substr($body, 0, 220));
        echo "FAIL {$from} -> {$to} HTTP={$status} fixture=" . basename($in) . " msg={$snippet}\n";
    }
}
