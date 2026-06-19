$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$srcDir = Join-Path $repoRoot 'frontend\TimesheetManagement.Web\src'
$files = Get-ChildItem -Path $srcDir -Recurse -Include '*.tsx','*.ts','*.css'

$replacements = @(
  # Replace blue glow effects in gradients with grey/white glows for dark mode
  ,@('rgba(37,99,235,0.16)','rgba(255,255,255,0.08)')
  ,@('rgba(37,99,235,0.18)','rgba(255,255,255,0.10)')
  ,@('rgba(59,130,246,0.18)','rgba(255,255,255,0.10)')
  ,@('rgba(59,130,246,0.2)','rgba(255,255,255,0.12)')
  # Also any remaining slate-900 markers
  ,@('bg-slate-900','bg-zinc-950')
  ,@('text-slate-900','text-slate-950')
)

$count = 0
foreach ($file in $files) {
  $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
  $original = $content
  foreach ($pair in $replacements) {
    $content = $content.Replace($pair[0], $pair[1])
  }
  if ($content -ne $original) {
    Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
    $count++
    Write-Host "Updated: $($file.Name)"
  }
}
Write-Host "Done. $count files updated."
