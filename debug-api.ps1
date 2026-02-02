$response = Invoke-WebRequest -Uri 'http://localhost:3000/api/debug-financial-data' -UseBasicParsing
$content = $response.Content
$json = $content | ConvertFrom-Json
Write-Host "Datos completos:"
Write-Host $json.data.data
