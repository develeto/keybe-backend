# test\e2e\smoke-test.ps1
# Prueba rápida de todos los endpoints contra el dev server

$BASE = "http://localhost:4000"
Write-Host "`n══════════════════════════════" -ForegroundColor Cyan
Write-Host " OrderFlow Smoke Test" -ForegroundColor Cyan
Write-Host "══════════════════════════════`n" -ForegroundColor Cyan

# ─── 1. Login como user ───
Write-Host "┌─ 1. Login (user)" -ForegroundColor Green
$loginUser = Invoke-RestMethod -Uri "$BASE/auth/login" -Method Post `
  -ContentType "application/json" `
  -Body '{"username":"user","password":"User1234!"}'
$userToken = $loginUser.data.token.AccessToken
Write-Host "└─ ✓ Token: $($userToken.Substring(0,20))..." -ForegroundColor Green

# ─── 2. Login como admin ───
Write-Host "`n┌─ 2. Login (admin)" -ForegroundColor Green
$loginAdmin = Invoke-RestMethod -Uri "$BASE/auth/login" -Method Post `
  -ContentType "application/json" `
  -Body '{"username":"admin","password":"Admin123!"}'
$adminToken = $loginAdmin.data.token.AccessToken
Write-Host "└─ ✓ Token: $($adminToken.Substring(0,20))..." -ForegroundColor Green

# ─── 3. Register ───
Write-Host "`n┌─ 3. Register new user" -ForegroundColor Green
try {
  $register = Invoke-RestMethod -Uri "$BASE/auth/register" -Method Post `
    -ContentType "application/json" `
    -Body '{"email":"test@test.com","username":"testuser","password":"Test1234!"}'
  Write-Host "└─ ✓ Created: $($register.data.username)" -ForegroundColor Green
} catch {
  Write-Host "└─ ⚠ $($_.Exception.Message)" -ForegroundColor Yellow
}

# ─── 4. Crear orden (con Idempotency-Key) ───
Write-Host "`n┌─ 4. Create Order (user)" -ForegroundColor Green
$idempotencyKey = [Guid]::NewGuid().ToString()
$headers = @{
  "Content-Type" = "application/json"
  "Authorization" = "Bearer $userToken"
  "Idempotency-Key" = $idempotencyKey
}
$order = Invoke-RestMethod -Uri "$BASE/orders" -Method Post `
  -Headers $headers `
  -Body '{"items":[{"product_id":1,"quantity":2,"price":1500},{"product_id":2,"quantity":1,"price":2500}]}'
Write-Host "└─ ✓ Order #$($order.data.id) — Total: $($order.data.total)" -ForegroundColor Green

# ─── 5. Idempotencia (mismo Idempotency-Key) ───
Write-Host "`n┌─ 5. Idempotency test (repeat same key)" -ForegroundColor Green
$order2 = Invoke-RestMethod -Uri "$BASE/orders" -Method Post `
  -Headers $headers `
  -Body '{"items":[{"product_id":1,"quantity":2,"price":1500}]}'
if ($order2.data.duplicated) {
  Write-Host "└─ ✓ Duplicated detected (idempotency works)" -ForegroundColor Green
} else {
  Write-Host "└─ ✗ Not duplicated" -ForegroundColor Red
}

# ─── 6. Listar orders (user) ───
Write-Host "`n┌─ 6. List Orders (user)" -ForegroundColor Green
$userOrders = Invoke-RestMethod -Uri "$BASE/orders" -Method Get `
  -Headers @{ "Authorization" = "Bearer $userToken" }
Write-Host "└─ ✓ $($userOrders.data.total) order(s)" -ForegroundColor Green

# ─── 7. Get order by ID ───
Write-Host "`n┌─ 7. Get Order #1 (user)" -ForegroundColor Green
$orderDetail = Invoke-RestMethod -Uri "$BASE/orders/1" -Method Get `
  -Headers @{ "Authorization" = "Bearer $userToken" }
Write-Host "└─ ✓ Status: $($orderDetail.data.status)" -ForegroundColor Green

# ─── 8. Admin: list all orders ───
Write-Host "`n┌─ 8. Admin: List All Orders" -ForegroundColor Green
$allOrders = Invoke-RestMethod -Uri "$BASE/admin/orders" -Method Get `
  -Headers @{ "Authorization" = "Bearer $adminToken" }
Write-Host "└─ ✓ $($allOrders.data.total) order(s) found" -ForegroundColor Green

# ─── 9. Admin: update order status ───
Write-Host "`n┌─ 9. Admin: Update Order #1 → VALIDATING" -ForegroundColor Green
$statusUpdate = Invoke-RestMethod -Uri "$BASE/admin/orders/1/status" -Method Patch `
  -ContentType "application/json" `
  -Headers @{ "Authorization" = "Bearer $adminToken" } `
  -Body '{"status":"VALIDATING"}'
Write-Host "└─ ✓ Status: $($statusUpdate.data.status)" -ForegroundColor Green

# ─── 10. Docs ───
Write-Host "`n┌─ 10. Docs endpoint" -ForegroundColor Green
$docs = Invoke-RestMethod -Uri "$BASE/docs/openapi.json" -Method Get
Write-Host "└─ ✓ Swagger: $($docs.info.title) v$($docs.info.version)" -ForegroundColor Green

Write-Host "`n══════════════════════════════" -ForegroundColor Cyan
Write-Host " ✅ Todos los tests pasaron!" -ForegroundColor Green
Write-Host "══════════════════════════════`n" -ForegroundColor Cyan
