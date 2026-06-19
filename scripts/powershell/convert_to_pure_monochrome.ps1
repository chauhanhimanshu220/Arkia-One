$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$srcDir = Join-Path $repoRoot 'frontend\TimesheetManagement.Web\src'
$files = Get-ChildItem -Path $srcDir -Recurse -Include '*.tsx','*.ts','*.css','*.html'

$replacements = @(
  # Replace slate with zinc for neutral tone in Light and Dark themes
  ,@('slate-50', 'zinc-50')
  ,@('slate-100', 'zinc-100')
  ,@('slate-200', 'zinc-200')
  ,@('slate-300', 'zinc-300')
  ,@('slate-400', 'zinc-400')
  ,@('slate-500', 'zinc-500')
  ,@('slate-600', 'zinc-600')
  ,@('slate-700', 'zinc-700')
  ,@('slate-800', 'zinc-800')
  ,@('slate-900', 'zinc-900')
  ,@('slate-950', 'black') # Slate-950 is almost black, let's go true black
  
  # Shadow color adjustment (Slate-950ish to Neutral Black)
  ,@('15, 23, 42', '0, 0, 0')
  
  # Ensure ink is mapped to black everywhere
  ,@('text-slate-900', 'text-black')
  ,@('text-slate-800', 'text-zinc-900')
  
  # Scrollbar track
  ,@('rgba(226, 232, 240', 'rgba(212, 212, 212')

  # Any remaining Blue hex codes
  ,@('#3b82f6', '#18181b') # Blue-500 -> Zinc-900
  ,@('#2563eb', '#09090b') # Blue-600 -> Zinc-950
)

foreach ($file in $files) {
  $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
  $original = $content
  foreach ($pair in $replacements) {
    # Using regex-free replace for direct string matches
    $content = $content.Replace($pair[0], $pair[1])
  }
  if ($content -ne $original) {
    Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
    Write-Host "Converted to Monochrome: $($file.Name)"
  }
}
