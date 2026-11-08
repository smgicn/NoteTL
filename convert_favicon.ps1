Add-Type -AssemblyName System.Drawing

$srcPath = 'C:\Users\jamali.jamali\.gemini\antigravity\brain\214d556f-e7cc-47af-969b-170c9bd5d813\.user_uploaded\media_1794142718013_29d7e9d5.jpg'
$srcImg = [System.Drawing.Image]::FromFile($srcPath)

# 1. Generate favicon.png (256x256 high quality PNG)
$destPng = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($destPng)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.DrawImage($srcImg, 0, 0, 256, 256)
$g.Dispose()

$destPng.Save('favicon.png', [System.Drawing.Imaging.ImageFormat]::Png)
$destPng.Dispose()

# 2. Generate favicon.ico (standard 64x64 multi/icon format)
$destIcoBmp = New-Object System.Drawing.Bitmap 64, 64
$g2 = [System.Drawing.Graphics]::FromImage($destIcoBmp)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g2.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g2.DrawImage($srcImg, 0, 0, 64, 64)
$g2.Dispose()

$hIcon = $destIcoBmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$fs = [System.IO.File]::Create('favicon.ico')
$icon.Save($fs)
$fs.Close()
$icon.Dispose()
$destIcoBmp.Dispose()

$srcImg.Dispose()

Write-Host "Favicons updated successfully!"
Get-Item favicon.png, favicon.ico | Select-Object Name, Length, LastWriteTime
