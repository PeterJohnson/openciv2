param([ValidateSet('Debug','Release')][string]$Configuration='Release')
$ErrorActionPreference='Stop'
$otherRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$otherGenerated=Join-Path $otherRoot 'build/atlas-review/generated/other'
$otherOut=Join-Path $otherRoot ('build/atlas-review/'+$Configuration)
New-Item -ItemType Directory -Force $otherOut | Out-Null
$otherPython=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
& $otherPython (Join-Path $PSScriptRoot 'extract-other.py')
if ($LASTEXITCODE -ne 0) { throw 'Other-window extraction failed' }
if (-not (Test-Path (Join-Path $otherGenerated 'inputs.inc'))) { throw 'Run prepare-native-other.py with the original installation and retained save first' }
$otherVS=& 'C:/Program Files (x86)/Microsoft Visual Studio/Installer/vswhere.exe' -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $otherVS) { throw 'MSVC x86 tools required' }
$otherFlags=if($Configuration -eq 'Debug'){'/Od /Zi /RTC1 /MDd'}else{'/O2 /MD'}
$otherIncludes=@($otherGenerated,(Join-Path $otherRoot 'build/atlas-review/generated'),(Join-Path $otherRoot 'src/include'),(Join-Path $otherRoot 'src/auto'),(Join-Path $otherRoot 'tools'),$PSScriptRoot)
$otherCommand='cl /nologo /std:c++17 /EHsc /W3 /Gy /Gw '+$otherFlags+' /D_CRT_SECURE_NO_WARNINGS '+(($otherIncludes | ForEach-Object {'/I"'+$_+'"'}) -join ' ')+' "'+(Join-Path $PSScriptRoot 'other-main.cpp')+'" /Fe:"'+(Join-Path $otherOut 'atlas-other.exe')+'" /Fo:"'+(Join-Path $otherOut 'atlas-other.obj')+'" /Fd:"'+(Join-Path $otherOut 'atlas-other.pdb')+'" /link /OPT:REF /MACHINE:X86'
$otherBatch=Join-Path $otherOut 'compile-other.cmd'
[IO.File]::WriteAllText($otherBatch,'@echo off'+"`r`n"+'call "'+$otherVS+'/VC/Auxiliary/Build/vcvarsall.bat" x86 >nul'+"`r`n"+$otherCommand+"`r`n"+'exit /b %errorlevel%'+"`r`n",[Text.UTF8Encoding]::new($false))
& cmd.exe /d /c $otherBatch
if ($LASTEXITCODE -ne 0) { throw 'Standalone other-window renderer build failed' }
