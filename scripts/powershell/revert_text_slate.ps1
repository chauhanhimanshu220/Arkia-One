$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$srcDir = Join-Path $repoRoot 'frontend\TimesheetManagement.Web\src'
$files = Get-ChildItem -Path $srcDir -Recurse -Include '*.tsx','*.ts','*.css'
foreach ($file in $files) {
  $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
  $updated = $content.Replace('text-slate-950', 'text-slate-900')
  if ($content -ne $updated) {
    Set-Content -Path $file.FullName -Value $updated -Encoding UTF8 -NoNewline
    Write-Host "Reverted text-slate-950 in $($file.Name)"
  }
}
