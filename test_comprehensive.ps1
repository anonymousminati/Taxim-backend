$prompts = @(
    "Create a red circle",
    "Make a blue square",
    "Animate green text",
    "Show purple triangle", 
    "Draw yellow star"
)

$sessionIds = @(
    "session1",
    "session2", 
    "session3",
    "session4",
    "session5"
)

$results = @()

Write-Host "Testing unique code generation for different prompts..."

for ($i = 0; $i -lt $prompts.Length; $i++) {
    $prompt = $prompts[$i]
    $sessionId = $sessionIds[$i]
    
    Write-Host "`n--- Test $($i + 1): '$prompt' (Session: $sessionId) ---"
    
    $body = @{
        prompt = $prompt
        sessionId = $sessionId
    } | ConvertTo-Json
    
    $headers = @{
        "Content-Type" = "application/json"
    }
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/manim/generate" -Method POST -Body $body -Headers $headers
        
        if ($response.success -and $response.code) {
            $code = $response.code
            $className = "Unknown"
            
            if ($code -match "class\s+(\w+)\s*\(") {
                $className = $matches[1]
            }
            
            $results += @{
                Prompt = $prompt
                SessionId = $sessionId
                Code = $code
                CodeLength = $code.Length
                ClassName = $className
                CodePreview = $code.Substring(0, [Math]::Min(100, $code.Length))
            }
              Write-Host "Success: Generated class: $className ($($code.Length) chars)"
            Write-Host "Preview: $($code.Substring(0, [Math]::Min(80, $code.Length)))..."        } else {
            Write-Host "Failed: $($response.error)"
        }
    } catch {
        Write-Host "Error: $($_.Exception.Message)"
    }
    
    Start-Sleep -Seconds 2
}

Write-Host "`n=== UNIQUENESS ANALYSIS ==="
Write-Host "Total tests: $($prompts.Length)"
Write-Host "Successful generations: $($results.Length)"

$uniqueCodes = $results | ForEach-Object { $_.Code } | Sort-Object | Get-Unique
Write-Host "Unique codes: $($uniqueCodes.Length)"

if ($uniqueCodes.Length -eq $results.Length) {
    Write-Host "SUCCESS: ALL CODES ARE UNIQUE!"
} else {
    Write-Host "WARNING: DUPLICATE CODES DETECTED!"
    
    # Find duplicates
    $codeGroups = $results | Group-Object -Property Code
    foreach ($group in $codeGroups) {
        if ($group.Count -gt 1) {
            Write-Host "Duplicate found in tests: $($group.Group.Prompt -join ', ')"
        }
    }
}

Write-Host "`n=== CLASS NAMES ==="
for ($i = 0; $i -lt $results.Length; $i++) {
    $result = $results[$i]
    Write-Host "Test $($i + 1) ($($result.SessionId)): $($result.ClassName)"
}

# Test same session with different prompts
Write-Host "`n=== TESTING SAME SESSION WITH DIFFERENT PROMPTS ==="

$sameSessionPrompts = @(
    "Create an orange triangle that spins",
    "Make a green circle bounce up and down"
)

$sameSessionResults = @()
$sameSessionId = "same-session-test"

for ($i = 0; $i -lt $sameSessionPrompts.Length; $i++) {
    $prompt = $sameSessionPrompts[$i]
    Write-Host "`n--- Same Session Test $($i + 1): '$prompt' ---"
    
    $body = @{
        prompt = $prompt
        sessionId = $sameSessionId
    } | ConvertTo-Json
    
    $headers = @{
        "Content-Type" = "application/json"
    }
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/manim/generate" -Method POST -Body $body -Headers $headers
        
        if ($response.success -and $response.code) {
            $code = $response.code
            $className = "Unknown"
            
            if ($code -match "class\s+(\w+)\s*\(") {
                $className = $matches[1]
            }
            
            $sameSessionResults += @{
                Code = $code
                ClassName = $className
            }
              Write-Host "Success: Generated class: $className"
            Write-Host "Preview: $($code.Substring(0, [Math]::Min(80, $code.Length)))..."
        }    } catch {
        Write-Host "Error: $($_.Exception.Message)"
    }
    
    Start-Sleep -Seconds 2
}

if ($sameSessionResults.Length -eq 2) {
    $areDifferent = $sameSessionResults[0].Code -ne $sameSessionResults[1].Code
    Write-Host "`nSame session different prompts: $(if ($areDifferent) { 'SUCCESS: DIFFERENT' } else { 'WARNING: SAME' })"
}
