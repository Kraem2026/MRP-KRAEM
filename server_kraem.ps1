$http = New-Object System.Net.HttpListener
$http.Prefixes.Add("http://localhost:8088/")
$http.Start()
$baseDir = "c:\Users\PC1\Downloads\repositorio github04112026"
Write-Output "Servidor KRAEM ERP activo en http://localhost:8088/"

while ($http.IsListening) {
    $context = $null
    $res = $null
    try {
        $context = $http.GetContext()
        $req = $context.Request
        $res = $context.Response
        $res.Headers.Add("Access-Control-Allow-Origin", "*")
        $res.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")
        
        $urlPath = $req.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($urlPath)) { $urlPath = "dashboard.html" }
        $filePath = Join-Path $baseDir $urlPath
        
        if (Test-Path $filePath) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            switch ($ext) {
                ".html" { $res.ContentType = "text/html; charset=utf-8" }
                ".json" { $res.ContentType = "application/json; charset=utf-8" }
                ".js"   { $res.ContentType = "application/javascript; charset=utf-8" }
                ".css"  { $res.ContentType = "text/css; charset=utf-8" }
                ".png"  { $res.ContentType = "image/png" }
                ".jpg"  { $res.ContentType = "image/jpeg" }
                ".jpeg" { $res.ContentType = "image/jpeg" }
                ".svg"  { $res.ContentType = "image/svg+xml" }
                default { $res.ContentType = "application/octet-stream" }
            }
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $res.ContentLength64 = $bytes.Length
            if ($req.HttpMethod -ne "HEAD") {
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            }
        } else {
            $res.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $res.ContentLength64 = $msg.Length
            if ($req.HttpMethod -ne "HEAD") {
                $res.OutputStream.Write($msg, 0, $msg.Length)
            }
        }
    } catch {
        # ignore error and continue
    } finally {
        if ($res -ne $null) {
            try { $res.Close() } catch {}
        }
    }
}
