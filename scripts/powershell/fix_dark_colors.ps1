$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$srcDir = Join-Path $repoRoot 'frontend\TimesheetManagement.Web\src'
$files = Get-ChildItem -Path $srcDir -Recurse -Include '*.tsx','*.ts','*.css'

$replacements = @(
  # dark bg slate -> black/zinc
  ,@('dark:bg-slate-950/70','dark:bg-black/70')
  ,@('dark:bg-slate-950/60','dark:bg-black/60')
  ,@('dark:bg-slate-950/50','dark:bg-black/50')
  ,@('dark:bg-slate-950/40','dark:bg-black/40')
  ,@('dark:bg-slate-950','dark:bg-black')
  ,@('dark:bg-slate-900/85','dark:bg-black/85')
  ,@('dark:bg-slate-900/80','dark:bg-black/80')
  ,@('dark:bg-slate-900','dark:bg-black')
  ,@('dark:bg-slate-800','dark:bg-zinc-900')
  # dark border slate -> zinc
  ,@('dark:border-slate-800','dark:border-zinc-800')
  ,@('dark:border-slate-700','dark:border-zinc-700')
  # dark hover slate
  ,@('dark:hover:bg-slate-950/70','dark:hover:bg-black/70')
  ,@('dark:hover:bg-slate-950/50','dark:hover:bg-black/50')
  ,@('dark:hover:bg-slate-950','dark:hover:bg-black')
  ,@('dark:hover:bg-slate-800','dark:hover:bg-zinc-900')
  # inline rgba navy blue (15,23,42) -> pure black (0,0,0)
  ,@('rgba(15,23,42,0.98)','rgba(0,0,0,0.98)')
  ,@('rgba(15,23,42,0.96)','rgba(0,0,0,0.96)')
  ,@('rgba(15,23,42,0.92)','rgba(0,0,0,0.92)')
  ,@('rgba(15,23,42,0.90)','rgba(0,0,0,0.90)')
  ,@('rgba(15,23,42,0.85)','rgba(0,0,0,0.85)')
  ,@('rgba(15,23,42,0.82)','rgba(0,0,0,0.82)')
  ,@('rgba(15,23,42,0.80)','rgba(0,0,0,0.80)')
  ,@('rgba(15,23,42,0.72)','rgba(0,0,0,0.72)')
  ,@('rgba(15,23,42,','rgba(0,0,0,')
  # inline rgba dark navy (2,6,23)
  ,@('rgba(2,6,23,0.98)','rgba(0,0,0,0.98)')
  ,@('rgba(2,6,23,0.96)','rgba(0,0,0,0.96)')
  ,@('rgba(2,6,23,0.92)','rgba(0,0,0,0.92)')
  ,@('rgba(2,6,23,','rgba(0,0,0,')
  # dark text
  ,@('dark:text-slate-950','dark:text-black')
  ,@('dark:hover:bg-slate-200','dark:hover:bg-zinc-200')
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
