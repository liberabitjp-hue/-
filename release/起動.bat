@echo off
rem 月案・時間割作成支援アプリの起動用ファイルです。ダブルクリックしてください。
rem インストールや管理者権限は不要です。

setlocal
set "HTMLFILE=%~dp0index.html"
set "CHROME1=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set "CHROME2=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
set "CHROME3=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if exist "%CHROME1%" (
  start "" "%CHROME1%" "%HTMLFILE%"
) else if exist "%CHROME2%" (
  start "" "%CHROME2%" "%HTMLFILE%"
) else if exist "%CHROME3%" (
  start "" "%CHROME3%" "%HTMLFILE%"
) else (
  rem Chromeが見つからない場合は、既定のブラウザで開きます。
  start "" "%HTMLFILE%"
)
endlocal
