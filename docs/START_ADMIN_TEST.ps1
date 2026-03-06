# ============================================================================
# ADMIN SYSTEM MULTI-INSTANCE TESTING SCRIPT
# Purpose: Set up and test all three admin dashboards simultaneously
# ============================================================================

Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "  NURTURE-GLOW ADMIN SYSTEM - MULTI-INSTANCE TEST SETUP" -ForegroundColor Cyan
Write-Host "================================================================`n" -ForegroundColor Cyan

# Configuration
$MYSQL_USER = "root"
$MYSQL_PASSWORD = ""
$DB_NAME = "nurture_glow"
$BACKEND_PORT = 5000
$FRONTEND_PORT = 5173

# Step 1: Database Setup
Write-Host "STEP 1: Setting Up Database..." -ForegroundColor Yellow
Write-Host "----------------------------------------------------------------" -ForegroundColor Gray

Write-Host "Creating admin system tables..." -ForegroundColor Cyan
$adminSchemaPath = "d:\Nurture-Glow\Nurture-Glow\backend\admin_tables_schema.sql"
if (Test-Path $adminSchemaPath) {
    Get-Content $adminSchemaPath | mysql -u $MYSQL_USER $DB_NAME 2>&1 | Out-Null
    Write-Host "Admin tables created" -ForegroundColor Green
} else {
    Write-Host "Admin schema file not found!" -ForegroundColor Red
}

Write-Host "Inserting test data..." -ForegroundColor Cyan
$testDataPath = "d:\Nurture-Glow\Nurture-Glow\backend\admin_test_data.sql"
if (Test-Path $testDataPath) {
    Get-Content $testDataPath | mysql -u $MYSQL_USER $DB_NAME 2>&1 | Out-Null
    Write-Host "Test data inserted" -ForegroundColor Green
} else {
    Write-Host "Test data file not found!" -ForegroundColor Red
}

Write-Host ""

# Step 2: Backend Server
Write-Host "STEP 2: Starting Backend Server..." -ForegroundColor Yellow
Write-Host "----------------------------------------------------------------" -ForegroundColor Gray

$backendRunning = Get-NetTCPConnection -LocalPort $BACKEND_PORT -ErrorAction SilentlyContinue
if ($backendRunning) {
    Write-Host "Backend already running on port $BACKEND_PORT" -ForegroundColor Yellow
} else {
    Write-Host "Starting backend server..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'd:\Nurture-Glow\Nurture-Glow\backend'; npm start" -WindowStyle Normal
    Write-Host "Backend server started in new window" -ForegroundColor Green
    Start-Sleep -Seconds 3
}

Write-Host ""

# Step 3: Frontend Server
Write-Host "STEP 3: Starting Frontend Server..." -ForegroundColor Yellow
Write-Host "----------------------------------------------------------------" -ForegroundColor Gray

$frontendRunning = Get-NetTCPConnection -LocalPort $FRONTEND_PORT -ErrorAction SilentlyContinue
if ($frontendRunning) {
    Write-Host "Frontend already running on port $FRONTEND_PORT" -ForegroundColor Yellow
} else {
    Write-Host "Starting frontend dev server..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'd:\Nurture-Glow\Nurture-Glow\Nurture-Glow'; npm run dev" -WindowStyle Normal
    Write-Host "Frontend server started in new window" -ForegroundColor Green
    Start-Sleep -Seconds 5
}

Write-Host ""

# Step 4: Launch Admin Dashboards
Write-Host "STEP 4: Launching Admin Dashboards..." -ForegroundColor Yellow
Write-Host "----------------------------------------------------------------" -ForegroundColor Gray

$baseUrl = "http://localhost:$FRONTEND_PORT"

Write-Host "Opening Admin Login pages..." -ForegroundColor Cyan
Start-Sleep -Seconds 2

Write-Host "  System Admin Dashboard" -ForegroundColor Magenta
Start-Process "msedge" -ArgumentList "--new-window", "$baseUrl/#/admin/login"
Start-Sleep -Seconds 1

Write-Host "  Operations Admin Dashboard" -ForegroundColor Magenta
Start-Process "msedge" -ArgumentList "--new-window", "$baseUrl/#/admin/login"
Start-Sleep -Seconds 1

Write-Host "  Medical Admin Dashboard" -ForegroundColor Magenta
Start-Process "msedge" -ArgumentList "--new-window", "$baseUrl/#/admin/login"

Write-Host "`nAll admin dashboards launched!" -ForegroundColor Green
Write-Host ""

# Step 5: Display Test Credentials
Write-Host "STEP 5: Test Credentials" -ForegroundColor Yellow
Write-Host "----------------------------------------------------------------" -ForegroundColor Gray

Write-Host "`nLogin Credentials:" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. SYSTEM ADMIN" -ForegroundColor Red
Write-Host "   Email:    system.admin@nurture.com" -ForegroundColor White
Write-Host "   Password: Test@123" -ForegroundColor White
Write-Host "   Role:     system_admin" -ForegroundColor Gray
Write-Host ""

Write-Host "2. OPERATIONS ADMIN" -ForegroundColor Magenta
Write-Host "   Email:    ops.admin@nurture.com" -ForegroundColor White
Write-Host "   Password: Test@123" -ForegroundColor White
Write-Host "   Role:     ops_admin" -ForegroundColor Gray
Write-Host ""

Write-Host "3. MEDICAL ADMIN" -ForegroundColor Cyan
Write-Host "   Email:    medical.admin@nurture.com" -ForegroundColor White
Write-Host "   Password: Test@123" -ForegroundColor White
Write-Host "   Role:     medical_admin" -ForegroundColor Gray
Write-Host ""

# Step 6: Testing Guide
Write-Host "STEP 6: Testing Workflow" -ForegroundColor Yellow
Write-Host "----------------------------------------------------------------" -ForegroundColor Gray

Write-Host "`nRecommended Testing Flow:" -ForegroundColor Cyan
Write-Host ""

Write-Host "Window 1 - System Admin:" -ForegroundColor Red
Write-Host "  1. View total users and system metrics" -ForegroundColor White
Write-Host "  2. Check security events" -ForegroundColor White
Write-Host "  3. Review system health status" -ForegroundColor White
Write-Host "  4. View admin action logs" -ForegroundColor White
Write-Host ""

Write-Host "Window 2 - Operations Admin:" -ForegroundColor Magenta
Write-Host "  1. Create a new card batch" -ForegroundColor White
Write-Host "  2. Review pending hospital onboarding" -ForegroundColor White
Write-Host "  3. Check support tickets" -ForegroundColor White
Write-Host "  4. Monitor CSR programs" -ForegroundColor White
Write-Host ""

Write-Host "Window 3 - Medical Admin:" -ForegroundColor Cyan
Write-Host "  1. Review pending doctor verifications" -ForegroundColor White
Write-Host "  2. Check high-risk pregnancy cases" -ForegroundColor White
Write-Host "  3. View consultation reviews" -ForegroundColor White
Write-Host "  4. Monitor emergency access logs" -ForegroundColor White
Write-Host ""

Write-Host "Test Admin-to-Admin Interactions:" -ForegroundColor Yellow
Write-Host "  - Ops Admin creates hospital -> Medical Admin gets notification" -ForegroundColor White
Write-Host "  - Medical Admin flags high-risk case -> System Admin sees alert" -ForegroundColor White
Write-Host "  - Check notifications bell icon in each dashboard" -ForegroundColor White
Write-Host ""

# Final Summary
Write-Host "`n================================================================" -ForegroundColor Green
Write-Host "                  SETUP COMPLETE!" -ForegroundColor Green
Write-Host "================================================================`n" -ForegroundColor Green

Write-Host "Database tables created" -ForegroundColor Green
Write-Host "Test data inserted" -ForegroundColor Green
Write-Host "Backend server running" -ForegroundColor Green
Write-Host "Frontend server running" -ForegroundColor Green
Write-Host "Admin dashboards launched" -ForegroundColor Green

Write-Host "`nURLs:" -ForegroundColor Cyan
Write-Host "   Backend API:  http://localhost:$BACKEND_PORT" -ForegroundColor White
Write-Host "   Frontend:     http://localhost:$FRONTEND_PORT" -ForegroundColor White
Write-Host "   Admin Login:  http://localhost:$FRONTEND_PORT/#/admin/login" -ForegroundColor White

Write-Host "`nNOTE: If registration is required, use invite code: NURTURE_ADMIN_2026" -ForegroundColor Yellow

Write-Host "`nPress any key to exit (servers will continue running)..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
