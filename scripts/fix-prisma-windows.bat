@echo off
echo 🔧 Fixing Prisma Windows Permission Issue
echo ========================================

echo 1. Stopping any running Node processes...
taskkill /f /im node.exe 2>nul
taskkill /f /im npm.exe 2>nul

echo 2. Waiting for file locks to release...
timeout /t 3 /nobreak >nul

echo 3. Cleaning Prisma generated files...
if exist "src\generated\prisma" (
    rmdir /s /q "src\generated\prisma" 2>nul
)

echo 4. Regenerating Prisma client...
npx prisma generate

echo 5. Done! You can now run npm install or npm run dev
pause