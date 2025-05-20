$metadata = cargo metadata --no-deps --format-version 1 | ConvertFrom-Json
$version = $metadata.packages[0].version

# Define paths
$srcDir = "target\\x86_64-pc-windows-msvc\\release"
$srcFile = "rust-commander.exe"
$src = Join-Path $srcDir $srcFile

$newFileName = "rust-commander-win-$version.exe"
# Construct the full destination path for logging purposes
$dest = Join-Path $srcDir $newFileName

# Check if the source file exists and rename it
if (Test-Path $src) {
    Rename-Item -Path $src -NewName $newFileName -Force
    Write-Host "Renamed to: $dest"
} else {
    Write-Host "File not found: $src"
    exit 1
}