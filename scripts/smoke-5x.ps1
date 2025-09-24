$ErrorActionPreference = 'Stop'
$BASE_URL = $env:BASE_URL
if (-not $BASE_URL) { $BASE_URL = 'http://localhost:3000' }
function Ok($m){ Write-Host "`u2713 $m" }
function Die($m){ Write-Host "`u2717 $m"; exit 1 }

# restaurants
$r = (Invoke-WebRequest -UseBasicParsing "$BASE_URL/api/restaurants?published=true").Content
if (-not $r) { Die "restaurants empty" }
if (-not ($r | ConvertFrom-Json)) { Die "restaurants json değil" }
Ok "restaurants (published only)"

# routes list + detail
$routes = (Invoke-WebRequest -UseBasicParsing "$BASE_URL/api/routes?published=true").Content | ConvertFrom-Json
if (-not $routes) { Die "route listesi boş" }
$code = $routes[0].code
$detail = (Invoke-WebRequest -UseBasicParsing "$BASE_URL/api/routes/$code").Content | ConvertFrom-Json
if ($detail.code -ne $code) { Die "route detail eşleşmedi" }
Ok "routes list + detail"

# explore list + detail
$explores = (Invoke-WebRequest -UseBasicParsing "$BASE_URL/api/explore?category=&q=").Content | ConvertFrom-Json
if (-not $explores) { Die "explore listesi boş" }
$id = $explores[0].id
$exp = (Invoke-WebRequest -UseBasicParsing "$BASE_URL/api/explore/$id").Content | ConvertFrom-Json
if ($exp.id -ne $id) { Die "explore detail eşleşmedi" }
Ok "explore list + detail"

# sliders
$sl = (Invoke-WebRequest -UseBasicParsing "$BASE_URL/api/sliders?published=true").Content | ConvertFrom-Json
if (-not $sl -or $sl.Count -lt 1) { Die "sliders boş" }
Ok "sliders (published only)"

# feedback invalid payload -> 400 (Invoke-WebRequest hata fırlatabilir, status'u yakala)
$code = -1
try {
  $r = Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$BASE_URL/api/feedback" -ContentType 'application/json' -Body '{"email":"not-an-email"}' -ErrorAction Stop
  $code = $r.StatusCode
} catch {
  try { $code = $_.Exception.Response.StatusCode.value__ } catch { $code = -1 }
}
if ($code -ne 400) { Die "feedback invalid 400 dönmedi (code=$code)" }
Ok "feedback 400 contract"

Write-Host "=== Smoke tamam. (API 5.x sağlıklı görünüyor) ==="


