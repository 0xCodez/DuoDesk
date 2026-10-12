@echo off
rem MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
rem Builds bin\macshare-winhelper.exe with the .NET Framework C# compiler (C# 5 only).
set CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe
if not exist "%~dp0bin" mkdir "%~dp0bin"
"%CSC%" /nologo /optimize+ /platform:x64 /target:exe /out:"%~dp0bin\macshare-winhelper.exe" ^
  /r:System.Web.Extensions.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll "%~dp0src\*.cs"
