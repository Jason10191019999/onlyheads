# Creates a desktop shortcut that opens ONLYheads in a chromeless, fullscreen
# app window (Chrome or Edge). Run it through make-desktop-icon.bat.
$ErrorActionPreference = 'Stop'

$url = 'https://jason10191019999.github.io/onlyheads/'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$icon = Join-Path $root 'assets\icon.ico'

$candidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)
$browser = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $browser) {
  Write-Host ''
  Write-Host '  [!] Chrome or Edge was not found.' -ForegroundColor Yellow
  Write-Host '      Install one of them, or drag the site to your desktop manually.'
  Read-Host '  Press Enter to close'
  exit 1
}

$desktop = [Environment]::GetFolderPath('Desktop')
$target = Join-Path $desktop 'ONLYheads.lnk'

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($target)
$shortcut.TargetPath = $browser
$shortcut.Arguments = "--app=$url --start-fullscreen"
$shortcut.WorkingDirectory = Split-Path -Parent $browser
$shortcut.Description = 'ONLYheads - headshot-only aim trainer'
if (Test-Path $icon) { $shortcut.IconLocation = $icon }
$shortcut.Save()

Write-Host ''
Write-Host '  Done. A shortcut named "ONLYheads" is on your desktop.' -ForegroundColor Green
Write-Host "  Browser: $browser"
Write-Host '  It opens without address bar and starts fullscreen.'
Write-Host ''
Read-Host '  Press Enter to close'
