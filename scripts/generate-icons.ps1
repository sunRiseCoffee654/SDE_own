$src = "C:/Users/hp/.gemini/antigravity/brain/27360077-d237-4cba-b7f7-3c1e6fd186d4/.user_uploaded/media_1793375510104_78b81d26.png"
if (-not (Test-Path "public")) {
    New-Item -ItemType Directory -Path "public" -Force | Out-Null
}
Copy-Item $src "public/logo.png" -Force
Copy-Item $src "public/favicon.png" -Force

Add-Type -AssemblyName System.Drawing

$orig = [System.Drawing.Image]::FromFile($src)

$configs = @(
    [PSCustomObject]@{ Dpi = "mdpi";    Icon = 48;  Fg = 108 },
    [PSCustomObject]@{ Dpi = "hdpi";    Icon = 72;  Fg = 162 },
    [PSCustomObject]@{ Dpi = "xhdpi";   Icon = 96;  Fg = 216 },
    [PSCustomObject]@{ Dpi = "xxhdpi";  Icon = 144; Fg = 324 },
    [PSCustomObject]@{ Dpi = "xxxhdpi"; Icon = 192; Fg = 432 }
)

$bgColor = [System.Drawing.ColorTranslator]::FromHtml("#FFFFFF")

foreach ($cfg in $configs) {
    $folder = "android/app/src/main/res/mipmap-$($cfg.Dpi)"
    if (-not (Test-Path $folder)) {
        New-Item -ItemType Directory -Path $folder -Force | Out-Null
    }

    # 1. Foreground
    $fgSize = $cfg.Fg
    $fgBmp = New-Object System.Drawing.Bitmap($fgSize, $fgSize)
    $g = [System.Drawing.Graphics]::FromImage($fgBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $drawSize = [int]($fgSize * 0.72)
    $offset = [int](($fgSize - $drawSize) / 2)
    $g.DrawImage($orig, $offset, $offset, $drawSize, $drawSize)
    $g.Dispose()
    $fgBmp.Save("$folder/ic_launcher_foreground.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $fgBmp.Dispose()

    # 2. Standard Icon
    $iconSize = $cfg.Icon
    $sqBmp = New-Object System.Drawing.Bitmap($iconSize, $iconSize)
    $g = [System.Drawing.Graphics]::FromImage($sqBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.Clear($bgColor)
    $drawSize = [int]($iconSize * 0.88)
    $offset = [int](($iconSize - $drawSize) / 2)
    $g.DrawImage($orig, $offset, $offset, $drawSize, $drawSize)
    $g.Dispose()
    $sqBmp.Save("$folder/ic_launcher.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $sqBmp.Dispose()

    # 3. Round Icon
    $rndBmp = New-Object System.Drawing.Bitmap($iconSize, $iconSize)
    $g = [System.Drawing.Graphics]::FromImage($rndBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse(0, 0, $iconSize, $iconSize)
    $g.SetClip($path)
    $brush = New-Object System.Drawing.SolidBrush($bgColor)
    $g.FillEllipse($brush, 0, 0, $iconSize, $iconSize)
    $brush.Dispose()
    $drawSize = [int]($iconSize * 0.85)
    $offset = [int](($iconSize - $drawSize) / 2)
    $g.DrawImage($orig, $offset, $offset, $drawSize, $drawSize)
    $path.Dispose()
    $g.Dispose()
    $rndBmp.Save("$folder/ic_launcher_round.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $rndBmp.Dispose()

    Write-Output "Successfully generated launcher icons for mipmap-$($cfg.Dpi)"
}

$orig.Dispose()

