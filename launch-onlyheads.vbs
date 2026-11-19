' Launches ONLYheads in an Edge/Chrome app window, fullscreen.
' The timestamp in the URL makes every launch fetch a fresh page, so a new
' deploy shows up immediately instead of waiting for the browser cache.

Dim shell, browser, url, stamp
Set shell = CreateObject("WScript.Shell")

stamp = DateDiff("s", "1/1/2020 00:00:00", Now)
url = "https://jason10191019999.github.io/onlyheads/?t=" & stamp

browser = ""
If CreateObject("Scripting.FileSystemObject").FileExists("C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe") Then
  browser = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
ElseIf CreateObject("Scripting.FileSystemObject").FileExists("C:\Program Files\Microsoft\Edge\Application\msedge.exe") Then
  browser = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
ElseIf CreateObject("Scripting.FileSystemObject").FileExists("C:\Program Files\Google\Chrome\Application\chrome.exe") Then
  browser = "C:\Program Files\Google\Chrome\Application\chrome.exe"
ElseIf CreateObject("Scripting.FileSystemObject").FileExists("C:\Program Files (x86)\Google\Chrome\Application\chrome.exe") Then
  browser = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
End If

If browser = "" Then
  MsgBox "Chrome or Edge was not found." & vbCrLf & "Install one of them, or open the site in any browser.", 48, "ONLYheads"
  WScript.Quit 1
End If

shell.Run """" & browser & """ --app=""" & url & """ --start-fullscreen", 1, False
