$baseUrl = "http://localhost:8851/api"
$headers = @{}
$token = $null

function Test-Endpoint {
    param(
        [string]$method,
        [string]$url,
        [string]$body = $null,
        [bool]$requiresAuth = $false,
        [string]$description
    )
    
    $fullUrl = "$baseUrl$url"
    $params = @{
        Uri = $fullUrl
        Method = $method
        UseBasicParsing = $true
    }
    
    if ($requiresAuth -and $token) {
        $headers["Authorization"] = "Bearer $token"
        $params["Headers"] = $headers
    }
    
    if ($body) {
        $params["Body"] = $body
        $params["ContentType"] = "application/json"
    }
    
    try {
        $response = Invoke-WebRequest @params
        Write-Host "PASS: $description" -ForegroundColor Green
        Write-Host "URL: $fullUrl"
        Write-Host "Status: $($response.StatusCode)"
        Write-Host ""
        return $response
    }
    catch {
        $errorMessage = $_.Exception.Message
        if ($_.Exception.Response) {
            $statusCode = $_.Exception.Response.StatusCode.value__
            $errorMessage += " (Status: $statusCode)"
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $responseBody = $reader.ReadToEnd()
            if ($responseBody.Length -gt 0) {
                $errorMessage += "`nResponse: $responseBody"
            }
        }
        Write-Host "FAIL: $description" -ForegroundColor Red
        Write-Host "URL: $fullUrl"
        Write-Host "Error: $errorMessage"
        Write-Host ""
        return $null
    }
}

Write-Host "API Test Started"
Write-Host "================"

Write-Host "Phase 1: Public APIs"
Write-Host "-------------------"

Test-Endpoint -method "GET" -url "/actuator/health" -description "Health check"
Test-Endpoint -method "GET" -url "/health" -description "Simple health check"
Test-Endpoint -method "GET" -url "/b2b/modeler/status" -description "B2B modeler status"

Write-Host "Phase 2: Auth APIs"
Write-Host "-----------------"

$loginBody = '{"username":"kuangjun","password":"moje666"}'
$loginResponse = Test-Endpoint -method "POST" -url "/auth/login" -body $loginBody -description "Admin login"

if ($loginResponse) {
    $loginData = $loginResponse.Content | ConvertFrom-Json
    $token = $loginData.accessToken
    Write-Host "Token obtained" -ForegroundColor Green
    Write-Host ""
}

Write-Host "Phase 3: Authenticated APIs"
Write-Host "--------------------------"

if ($token) {
    Test-Endpoint -method "GET" -url "/auth/current-user" -requiresAuth $true -description "Get current user"
    Test-Endpoint -method "GET" -url "/users" -requiresAuth $true -description "Get users"
    Test-Endpoint -method "GET" -url "/orders" -requiresAuth $true -description "Get orders"
    Test-Endpoint -method "GET" -url "/orders/pending-counts" -requiresAuth $true -description "Pending counts"
    Test-Endpoint -method "GET" -url "/orders/system-config" -requiresAuth $true -description "System config"
    Test-Endpoint -method "GET" -url "/orders/material-config" -requiresAuth $true -description "Material config"
    Test-Endpoint -method "GET" -url "/orders/process-config" -requiresAuth $true -description "Process config"
    Test-Endpoint -method "GET" -url "/admin/dashboard" -requiresAuth $true -description "Admin overview"
    Test-Endpoint -method "GET" -url "/orders/generate-order-number" -requiresAuth $true -description "Generate order number"

    Write-Host "Phase 4: Order Creation"
    Write-Host "----------------------"

    $orderBody = '{"source":"C2C","depositAmount":500.0,"basicRequirements":"Test order requirements","orderTime":"2026-05-03 10:00:00","customerContact":"13800138000","customerName":"Test Customer"}'
    Test-Endpoint -method "POST" -url "/orders" -body $orderBody -requiresAuth $true -description "Create order"
}

Write-Host "Phase 5: B2B APIs"
Write-Host "-----------------"

$b2bRegisterBody = '{"companyName":"Test Company2","contactPerson":"Contact2","contact":"13812345678","email":"test2@example.com","password":"123456"}'
Test-Endpoint -method "POST" -url "/b2b/client/register" -body $b2bRegisterBody -description "B2B register"

$b2bLoginBody = '{"contact":"13812345678","password":"123456"}'
$b2bLoginResponse = Test-Endpoint -method "POST" -url "/b2b/client/login" -body $b2bLoginBody -description "B2B login"

if ($b2bLoginResponse) {
    $b2bData = $b2bLoginResponse.Content | ConvertFrom-Json
    $b2bToken = $b2bData.accessToken
    
    $b2bHeaders = @{ "Authorization" = "Bearer $b2bToken" }
    $b2bOrderBody = '{"contact":"13812345678","basicRequirements":"B2B Test Order","materialInfo":"Gold material","depositAmount":1000.0,"sourceDetail":"Test Source"}'

    try {
        $response = Invoke-WebRequest -Uri "$baseUrl/b2b/order/create" -Method "POST" -Body $b2bOrderBody -ContentType "application/json" -Headers $b2bHeaders -UseBasicParsing
        Write-Host "PASS: B2B create order" -ForegroundColor Green
        Write-Host "Status: $($response.StatusCode)"
        Write-Host "Response: $($response.Content)"
    }
    catch {
        $errorMessage = $_.Exception.Message
        if ($_.Exception.Response) {
            $statusCode = $_.Exception.Response.StatusCode.value__
            $errorMessage += " (Status: $statusCode)"
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $responseBody = $reader.ReadToEnd()
                $errorMessage += "`nResponse: $responseBody"
            } catch {}
        }
        Write-Host "FAIL: B2B create order" -ForegroundColor Red
        Write-Host "Error: $errorMessage"
    }
}

Write-Host "================"
Write-Host "Test Completed"