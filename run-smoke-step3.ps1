$ErrorActionPreference = 'Stop'

# 1) Admin token
$adm = Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/auth/login -ContentType 'application/json' -Body '{"email":"admin@example.com","password":"admin123"}'
$t = $adm.token

# 2) SAS üret
$body = '{"type":"image","size":1024,"filename":"cover.jpg"}'
$covSas = Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/explore/upload-sas -Headers @{Authorization=("Bearer " + $t)} -ContentType 'application/json' -Body $body
$covSas | ConvertTo-Json -Compress | Write-Host

# 3) PUT upload (x-ms-blob-type zorunlu)
Invoke-WebRequest -Uri $covSas.uploadUrl -Method Put -InFile "_tmp\test.png" -ContentType "image/png" -Headers @{'x-ms-blob-type'='BlockBlob'} | Out-Null

# 4) Explore kaydı
$place = Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/explore -Headers @{Authorization=("Bearer " + $t)} -ContentType 'application/json' -Body (@{ name="Mekan"; category="tarih"; cover_url=$covSas.blobUrl; is_published=$true } | ConvertTo-Json)
Write-Host ("OK: place={0}" -f $place.id)


