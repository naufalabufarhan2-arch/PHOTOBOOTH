# start_server.ps1
# Pure Windows PowerShell TCP Socket Web Server (Zero dependencies, bypasses Access Denied issues!)
$port = 8080
$ip = "10.172.193.86"

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $port)
try {
    $listener.Start()
    Write-Host "`n======================================================" -ForegroundColor Green
    Write-Host "🚀 SUCCESS: PHOTOBOOTH SERVER IS NOW ACTIVE!" -ForegroundColor Green
    Write-Host "======================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "👉 ON THIS LAPTOP (HOST), OPEN:" -ForegroundColor White
    Write-Host "   http://localhost:$port" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "👉 ON OTHER DEVICES (TABLET, PHONE, OR OTHER LAPTOPS):" -ForegroundColor White
    Write-Host "   http://$($ip):$port" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   * Make sure both devices are connected to Wi-Fi: polibatam.ac.id" -ForegroundColor Gray
    Write-Host "======================================================" -ForegroundColor Green
    Write-Host "Keep this PowerShell window OPEN to let others connect."
    Write-Host "Press Ctrl + C in this terminal to stop the server.`n"
} catch {
    Write-Host "`nError starting server: $_" -ForegroundColor Red
    Write-Host "Please close other apps using port $port and try again.`n"
    Exit
}

while ($true) {
    try {
        $client = $listener.AcceptTcpClient()
        $stream = $client.GetStream()
        
        # Read incoming request
        $buffer = New-Object System.Byte[] 2048
        $readCount = $stream.Read($buffer, 0, $buffer.Length)
        $requestText = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $readCount)
        
        # Parse HTTP method and url path
        $lines = $requestText -split "`r?`n"
        if ($lines.Length -gt 0) {
            $parts = $lines[0] -split " "
            if ($parts.Length -ge 2) {
                $urlPath = [uri]::UnescapeDataString($parts[1])
                # Remove query string parameters if present
                $urlPath = ($urlPath -split "\?")[0]
                if ($urlPath -eq "/") { $urlPath = "/index.html" }
                
                $localPath = Join-Path $PSScriptRoot $urlPath.TrimStart('/')
                
                if (Test-Path $localPath -PathType Leaf) {
                    $bytes = [System.IO.File]::ReadAllBytes($localPath)
                    
                    # Map Content MIME Types
                    $ext = [System.IO.Path]::GetExtension($localPath).ToLower()
                    $mime = "text/plain"
                    if ($ext -eq ".html") { $mime = "text/html; charset=utf-8" }
                    elseif ($ext -eq ".css") { $mime = "text/css" }
                    elseif ($ext -eq ".js") { $mime = "application/javascript" }
                    elseif ($ext -eq ".png") { $mime = "image/png" }
                    elseif ($ext -eq ".jpg" -or $ext -eq ".jpeg") { $mime = "image/jpeg" }
                    
                    $headers = "HTTP/1.1 200 OK`r`n" +
                               "Content-Type: $mime`r`n" +
                               "Content-Length: $($bytes.Length)`r`n" +
                               "Access-Control-Allow-Origin: *`r`n" +
                               "Connection: close`r`n`r`n"
                    $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($headers)
                    
                    $stream.Write($headerBytes, 0, $headerBytes.Length)
                    $stream.Write($bytes, 0, $bytes.Length)
                } else {
                    $html = "<h1>404 File Not Found</h1><p>Requested file does not exist in photobooth folder.</p>"
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes($html)
                    $headers = "HTTP/1.1 404 Not Found`r`n" +
                               "Content-Type: text/html`r`n" +
                               "Content-Length: $($bytes.Length)`r`n" +
                               "Connection: close`r`n`r`n"
                    $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($headers)
                    $stream.Write($headerBytes, 0, $headerBytes.Length)
                    $stream.Write($bytes, 0, $bytes.Length)
                }
            }
        }
        $stream.Close()
        $client.Close()
    } catch {
        # Silently catch socket connection dropouts
    }
}
