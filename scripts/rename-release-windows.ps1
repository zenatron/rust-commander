$metadata = cargo metadata --no-deps --format-version 1 | ConvertFrom-Json
$version = $metadata.packages[0].version

# Define paths using Join-Path
$src = Join-Path "target\x86_64-pc-windows-msvc\release" "rust-commander.exe"
$dest = Join-Path "target\x86_64-pc-windows-msvc\release" ("rust-commander-win-$version.exe")

# Check if the source file exists and rename it
if (Test-Path $src) {
    Rename-Item -Path $src -NewName $dest -Force
    Write-Host "Renamed to: $dest"
} else {
    Write-Host "File not found: $src"
    exit 1
}