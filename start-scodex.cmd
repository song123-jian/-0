@echo off
setlocal
cd /d "%~dp0"
if errorlevel 1 exit /b 1

if exist "D:\RJBC\node.exe" if exist "D:\RJBC\npm.cmd" set "PATH=D:\RJBC;%PATH%"
where node.exe >nul 2>nul
if errorlevel 1 goto missing_node
where npm.cmd >nul 2>nul
if errorlevel 1 goto missing_node
node.exe -e "process.exit(Number(process.versions.node.split('.')[0]) === 24 ? 0 : 1)"
if errorlevel 1 goto missing_node

if not exist "node_modules\.bin\vite.cmd" goto install
if not exist "node_modules\.bin\concurrently.cmd" goto install
if not exist "node_modules\.bin\wait-on.cmd" goto install
if not exist "node_modules\.bin\electron.cmd" goto install
if not exist "node_modules\electron\install.js" goto install
goto prepare_electron

:install
echo Preparing Scodex dependencies. Internet access is required.
call npm.cmd ci
if errorlevel 1 goto failed

:prepare_electron
if not defined ELECTRON_MIRROR set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"
if not exist "node_modules\electron\dist\electron.exe" goto install_electron
if not exist "node_modules\electron\dist\icudtl.dat" goto install_electron
if not exist "node_modules\electron\dist\resources\default_app.asar" goto install_electron
if not exist "node_modules\electron\path.txt" goto install_electron
goto launch

:install_electron
echo Preparing the Electron runtime. Internet access is required.
node.exe "node_modules\electron\install.js"
if errorlevel 1 goto failed

:launch
call npm.cmd run dev
if errorlevel 1 goto failed
exit /b 0

:missing_node
echo Node.js 24.x and npm are required. Install them, then run this file again.
pause
exit /b 1

:failed
echo Scodex could not start. Review the error above, then run this file again.
pause
exit /b 1
