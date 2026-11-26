@echo off
setlocal
cd /d "%~dp0"
title Parcel Rack
if not exist "%~dp0runtime\node.exe" (
  echo runtime\node.exe is missing. Unzip the full Parcel Rack folder and try again.
  echo.
  pause
  exit /b 1
)
if not exist "%~dp0dist\server.cjs" (
  echo dist\server.cjs is missing. Unzip the full Parcel Rack folder and try again.
  echo.
  pause
  exit /b 1
)
echo Starting Parcel Rack. Leave this window open.
echo.
"%~dp0runtime\node.exe" --experimental-sqlite "%~dp0dist\server.cjs"
echo.
echo Parcel Rack stopped.
pause
