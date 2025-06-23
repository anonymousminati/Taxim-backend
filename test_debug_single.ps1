$body = @{
    prompt = "Create a simple red circle"
    sessionId = "test-session-debug"
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
}

Write-Host "Testing backend API directly..."
Write-Host "Request body: $body"

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/manim/generate" -Method POST -Body $body -Headers $headers -TimeoutSec 60
    
    Write-Host "`nResponse received:"
    Write-Host "Success: $($response.success)"
    Write-Host "Error: $($response.error)"
    Write-Host "Code length: $($response.code.Length)"
    Write-Host "Video path: $($response.videoPath)"
    
    if ($response.code) {
        Write-Host "Code preview: $($response.code.Substring(0, [Math]::Min(100, $response.code.Length)))..."
        
        if ($response.code -match "class\s+(\w+)\s*\(") {
            Write-Host "Class name: $($matches[1])"
        }
    } else {
        Write-Host "WARNING: No code in response!"
    }
    
    Write-Host "`nFull response structure:"
    $response | ConvertTo-Json -Depth 3
    
} catch {
    Write-Host "Error occurred:"
    Write-Host $_.Exception.Message
    Write-Host "Response status: $($_.Exception.Response.StatusCode)"
    Write-Host "Response content: $($_.Exception.Response.Content)"
}
