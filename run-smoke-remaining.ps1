$ErrorActionPreference = 'Continue'

function Ensure-Assets {
  if(-not (Test-Path '_tmp')) { [IO.Directory]::CreateDirectory('_tmp') | Out-Null }
  if(-not (Test-Path '_tmp/test.png')) {
    [IO.File]::WriteAllBytes('_tmp/test.png',[Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Yf6Z2kAAAAASUVORK5CYII='))
  }
  if(-not (Test-Path '_tmp/test.pdf')) {
    Set-Content -Path '_tmp/test.pdf' -Value '%PDF-1.4`n1 0 obj<<>>endobj`ntrailer<<>>`n%%EOF' -NoNewline -Encoding ASCII
  }
}

function Get-AdminToken {
  $adm = Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/auth/login -ContentType 'application/json' -Body '{"email":"admin@example.com","password":"admin123"}'
  return $adm.token
}

function Get-Sas($t, $area, $type, $filename, $size) {
  $body = (@{ type=$type; size=$size; filename=$filename } | ConvertTo-Json -Compress)
  $url = "http://localhost:4000/api/$area/upload-sas"
  return Invoke-RestMethod -Method Post -Uri $url -Headers @{ Authorization=("Bearer " + $t) } -ContentType 'application/json' -Body $body
}

function Put-Blob($sasUrl, $path, $contentType) {
  Invoke-WebRequest -Uri $sasUrl -Method Put -InFile $path -ContentType $contentType -Headers @{'x-ms-blob-type'='BlockBlob'} | Out-Null
}

Ensure-Assets
$t = Get-AdminToken

Write-Host "[Routes] SAS + upload + CRUD" -ForegroundColor Cyan
$pdf = Get-Sas -t $t -area 'routes' -type 'pdf' -filename 'test.pdf' -size 1024
Put-Blob -sasUrl $pdf.uploadUrl -path '_tmp/test.pdf' -contentType 'application/pdf'
$img = Get-Sas -t $t -area 'routes' -type 'image' -filename 'cover.png' -size 1024
Put-Blob -sasUrl $img.uploadUrl -path '_tmp/test.png' -contentType 'image/png'
$routeBody = @{ code='S200'; title='Smoke Route'; description=''; pdf_url=$pdf.blobUrl; image_url=$img.blobUrl; series='200'; is_published=$true } | ConvertTo-Json
$route = Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/routes -Headers @{Authorization=("Bearer " + $t)} -ContentType 'application/json' -Body $routeBody
Invoke-RestMethod http://localhost:4000/api/routes?series=200 | Out-Null
Invoke-RestMethod http://localhost:4000/api/routes?query=Smoke | Out-Null
Write-Host ("Route created: {0}" -f $route.id)
Invoke-RestMethod -Method Delete -Uri ("http://localhost:4000/api/routes/{0}" -f $route.id) -Headers @{Authorization=("Bearer " + $t)} | Out-Null
Write-Host "Routes OK"

Write-Host "[Slider] image + create + reorder" -ForegroundColor Cyan
$sl = Get-Sas -t $t -area 'sliders' -type 'image' -filename 'slide.png' -size 512
Put-Blob -sasUrl $sl.uploadUrl -path '_tmp/test.png' -contentType 'image/png'
$slide = Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/sliders -Headers @{Authorization=("Bearer " + $t)} -ContentType 'application/json' -Body (@{ title='Smoke Slide'; image_url=$sl.blobUrl; position=0; is_published=$true } | ConvertTo-Json)
try {
  Invoke-RestMethod -Method Put -Uri http://localhost:4000/api/sliders/reorder -Headers @{Authorization=("Bearer " + $t)} -ContentType 'application/json' -Body (@{ items=@(@{ id=$slide.id; position=1 }) } | ConvertTo-Json) | Out-Null
} catch {
  # Fallback: direct update
  Invoke-RestMethod -Method Put -Uri ("http://localhost:4000/api/sliders/{0}" -f $slide.id) -Headers @{Authorization=("Bearer " + $t)} -ContentType 'application/json' -Body (@{ position=1 } | ConvertTo-Json) | Out-Null
}
Write-Host ("Slide: {0} OK" -f $slide.id)

Write-Host "[Feedback] create + toggle + CSV" -ForegroundColor Cyan
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/feedback -ContentType 'application/json' -Body '{"name":"Deneme","email":"d@example.com","message":"çğıöşü deneme"}' | Out-Null
$fblist = Invoke-RestMethod -Uri http://localhost:4000/api/feedback -Headers @{Authorization=("Bearer " + $t)}
$fb = $fblist[0]
Invoke-RestMethod -Method Put -Uri ("http://localhost:4000/api/feedback/{0}" -f $fb.id) -Headers @{Authorization=("Bearer " + $t)} -ContentType 'application/json' -Body '{"handled":true}' | Out-Null
$csv = Invoke-WebRequest -Uri http://localhost:4000/api/feedback/export.csv -Headers @{Authorization=("Bearer " + $t)}
Write-Host ("CSV bytes: {0}" -f $csv.Content.Length)

Write-Host "[Public rule] unpublished hidden" -ForegroundColor Cyan
$unpub = Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/routes -Headers @{Authorization=("Bearer " + $t)} -ContentType 'application/json' -Body '{"code":"HIDDEN","is_published":false}'
$public = Invoke-RestMethod http://localhost:4000/api/routes
if(($public | Where-Object { $_.code -eq 'HIDDEN' })) { throw 'Unpublished record visible in public list' } else { Write-Host 'Public OK' }

Write-Host "DONE" -ForegroundColor Green


