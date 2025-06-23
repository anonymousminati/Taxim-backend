$body = @{
    prompt = "Create a red circle"
    sessionId = "test1"
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/manim/generate" -Method POST -Body $body -Headers $headers
    Write-Host "Success: $($response.success)"
    if ($response.code) {
        Write-Host "Code length: $($response.code.Length)"
        Write-Host "Code preview: $($response.code.Substring(0, [Math]::Min(100, $response.code.Length)))..."
        
        # Extract class name
        if ($response.code -match "class\s+(\w+)\s*\(") {
            Write-Host "Class name: $($matches[1])"
        }
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
