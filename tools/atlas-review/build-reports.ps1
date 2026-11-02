param([ValidateSet('Debug','Release')][string]$Configuration='Release')
$ErrorActionPreference='Stop'
$reportRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$reportOut=Join-Path $reportRoot ('build/atlas-review/'+$Configuration)
New-Item -ItemType Directory -Force $reportOut | Out-Null
$reportPython=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
& $reportPython (Join-Path $PSScriptRoot 'extract-reports.py')
if ($LASTEXITCODE -ne 0) { throw 'Report extraction failed' }
$reportVS=& 'C:/Program Files (x86)/Microsoft Visual Studio/Installer/vswhere.exe' -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $reportVS) { throw 'MSVC x86 tools required' }
$reportVcvars=Join-Path $reportVS 'VC/Auxiliary/Build/vcvarsall.bat'
$reportFlags=if($Configuration -eq 'Debug'){'/Od /Zi /RTC1 /MDd'}else{'/O2 /MD'}
$reportCommand='cl /nologo /std:c++17 /EHsc /W3 '+$reportFlags+' /D_CRT_SECURE_NO_WARNINGS /I"'+(Join-Path $reportRoot 'build/atlas-review/generated')+'" /I"'+(Join-Path $reportRoot 'src/include')+'" "'+(Join-Path $PSScriptRoot 'report-main.cpp')+'" /Fe:"'+(Join-Path $reportOut 'atlas-reports.exe')+'" /Fo:"'+(Join-Path $reportOut 'atlas-reports.obj')+'" /Fd:"'+(Join-Path $reportOut 'atlas-reports.pdb')+'" /link /MACHINE:X86'
$reportBatch=Join-Path $reportOut 'compile-reports.cmd'
[IO.File]::WriteAllText($reportBatch,'@echo off'+"`r`n"+'call "'+$reportVcvars+'" x86 >nul'+"`r`n"+$reportCommand+"`r`n"+'exit /b %errorlevel%'+"`r`n",[Text.UTF8Encoding]::new($false))
& cmd.exe /d /c $reportBatch
if ($LASTEXITCODE -ne 0) { throw 'Standalone report renderer build failed' }
