@echo off
setlocal
pushd "%~dp0.."
if errorlevel 1 exit /b %errorlevel%
call pnpm --dir web dev
set "pipyter_exit_code=%errorlevel%"
popd
exit /b %pipyter_exit_code%
