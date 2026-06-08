# Auto commit and push when agent session ends (if there are changes)
$ErrorActionPreference = "SilentlyContinue"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $projectRoot

$status = git status --porcelain 2>$null
if (-not $status) {
    exit 0
}

git add .
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
git commit -m "Автосохранение: обновление проекта ($timestamp)"
git push

exit 0
