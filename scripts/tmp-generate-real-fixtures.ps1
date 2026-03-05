$soff = 'C:\Program Files\LibreOffice\program\soffice.exe'
New-Item -ItemType Directory -Force -Path 'scripts\fixtures' | Out-Null
Set-Content -Path 'scripts\fixtures\seed.txt' -Value 'TaxPal conversion seed document'
Set-Content -Path 'scripts\fixtures\seed.csv' -Value "name,amount`nvat,7500"

& $soff --headless --nologo --nolockcheck --nofirststartwizard --invisible --convert-to docx --outdir 'scripts\fixtures' 'scripts\fixtures\seed.txt'
& $soff --headless --nologo --nolockcheck --nofirststartwizard --invisible --convert-to pdf --outdir 'scripts\fixtures' 'scripts\fixtures\seed.txt'
& $soff --headless --nologo --nolockcheck --nofirststartwizard --invisible --convert-to xlsx --outdir 'scripts\fixtures' 'scripts\fixtures\seed.csv'
& $soff --headless --nologo --nolockcheck --nofirststartwizard --invisible --convert-to pptx --outdir 'scripts\fixtures' 'scripts\fixtures\seed.txt'

Get-ChildItem 'scripts\fixtures' | Select-Object Name,Length | Format-Table -AutoSize
