@echo off
echo ========================================================
echo   Cleaning Next.js Cache & Starting Development Server
echo ========================================================

echo 1. Stopping any stray Node.js processes...
taskkill /F /IM node.exe >nul 2>&1

echo 2. Deleting .next cache folder completely...
rmdir /S /Q .next

echo 3. Regenerating Prisma database client...
call npx prisma generate

echo 4. Starting development server...
call npm run dev
