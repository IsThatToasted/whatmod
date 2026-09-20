$repo = Split-Path -Parent $PSScriptRoot
$target = Join-Path $repo ".github\workflows"
New-Item -ItemType Directory -Force -Path $target | Out-Null
Copy-Item "$PSScriptRoot\.github\workflows\justglance-web-build.yml" "$target\justglance-web-build.yml" -Force
Copy-Item "$PSScriptRoot\.github\workflows\justglance-ios-unsigned.yml" "$target\justglance-ios-unsigned.yml" -Force
Write-Host "Installed JustGlance build workflows at repository root. Existing Pages workflow was not replaced."
