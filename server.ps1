# server.ps1 - Lightweight PowerShell Web Server
# Hosts the Noise Effect Demonstrator locally without requiring Node or Python.

$port = 8000
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host "=============================================" -ForegroundColor Cyan
    Write-Host "  Noise Effect Demonstrator Web Server Started" -ForegroundColor Green
    Write-Host "  Open your browser and navigate to:" -ForegroundColor Cyan
    Write-Host "  http://localhost:$port/" -ForegroundColor Yellow -NoNewline
    Write-Host " (Click to open)" -ForegroundColor DarkGray
    Write-Host "  Press Ctrl+C in this terminal to stop server." -ForegroundColor Red
    Write-Host "=============================================" -ForegroundColor Cyan

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $url = $request.RawUrl
        # Strip query string params
        if ($url.Contains("?")) {
            $url = $url.Substring(0, $url.IndexOf("?"))
        }

        # Route default page
        $routePath = $url
        if ($routePath -eq "/" -or $routePath -eq "") {
            $routePath = "/index.html"
        }

        # Prevent directory traversal
        $routePath = $routePath.Replace("../", "").Replace("..\", "")
        $filePath = Join-Path (Get-Location) $routePath.TrimStart('/')

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".png"  { "image/png" }
                ".jpg"  { "image/jpeg" }
                ".ico"  { "image/x-icon" }
                default { "application/octet-stream" }
            }

            $response.ContentType = $contentType
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host "[200 OK] Served: $routePath" -ForegroundColor Green
        } else {
            $response.StatusCode = 404
            $msg = "404 Not Found: The requested file could not be found on the server."
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($msg)
            $response.ContentType = "text/plain"
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host "[404 Not Found] Requested: $routePath" -ForegroundColor Red
        }
        $response.Close()
    }
} catch {
    Write-Host "Server error occurred: $_" -ForegroundColor Red
} finally {
    if ($listener.IsListening) {
        $listener.Stop()
        Write-Host "Server listener stopped." -ForegroundColor Yellow
    }
}
