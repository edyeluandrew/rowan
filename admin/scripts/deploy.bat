@echo off
REM Admin Panel Build & Deployment Script (Windows)

setlocal enabledelayedexpansion

echo.
echo ========================================
echo Starting Admin Panel Build
echo ========================================
echo.

REM Check Node version
echo Checking Node.js installation...
node -v || (
  echo ERROR: Node.js is not installed
  exit /b 1
)

REM Install dependencies
echo.
echo Installing dependencies...
call npm ci || exit /b 1
echo Dependencies installed successfully

REM Run linting
echo.
echo Running ESLint...
call npm run lint || echo WARNING: Lint issues found

REM Run tests
echo.
echo Running tests...
call npm test -- --coverage || exit /b 1
echo Tests passed successfully

REM Build
echo.
echo Building Admin Panel...
call npm run build || exit /b 1
echo Build completed successfully

REM Display size
echo.
echo Bundle size:
for /f %%A in ('powershell Get-ChildItem -Path "dist" -Recurse ^| Measure-Object -Property Length -Sum ^| Select-Object @{Name="SizeInMB";Expression={[math]::Round(($_.Sum / 1MB), 2)}} -ExpandProperty SizeInMB') do (
  echo %%A MB
)

echo.
echo ========================================
echo Build completed successfully!
echo Output directory: dist/
echo ========================================
echo.

endlocal
