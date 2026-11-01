$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function New-ScodexIconBitmap([int]$size) {
    $bitmap = [Drawing.Bitmap]::new($size, $size, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([Drawing.Color]::Transparent)
    $graphics.ScaleTransform($size / 256.0, $size / 256.0)
    $gradient = [Drawing.Drawing2D.LinearGradientBrush]::new(
        [Drawing.Rectangle]::new(16, 8, 224, 240),
        [Drawing.ColorTranslator]::FromHtml('#6D28D9'),
        [Drawing.ColorTranslator]::FromHtml('#0284C7'), 45.0)
    $command = [Drawing.Pen]::new([Drawing.Color]::White, 17)
    $command.StartCap = $command.EndCap = [Drawing.Drawing2D.LineCap]::Round
    $command.LineJoin = [Drawing.Drawing2D.LineJoin]::Round
    $cursor = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml('#A5F3FC'), 15)
    $cursor.StartCap = $cursor.EndCap = [Drawing.Drawing2D.LineCap]::Round
    try {
        $hexagon = [Drawing.PointF[]]@(
            [Drawing.PointF]::new(128, 8), [Drawing.PointF]::new(232, 68),
            [Drawing.PointF]::new(232, 188), [Drawing.PointF]::new(128, 248),
            [Drawing.PointF]::new(24, 188), [Drawing.PointF]::new(24, 68))
        $graphics.FillPolygon($gradient, $hexagon)
        $graphics.DrawLines($command, [Drawing.PointF[]]@(
            [Drawing.PointF]::new(77, 87), [Drawing.PointF]::new(117, 127),
            [Drawing.PointF]::new(77, 167)))
        $graphics.DrawLine($cursor, 137, 167, 181, 167)
        return ,$bitmap
    } catch {
        $bitmap.Dispose()
        throw
    } finally {
        $graphics.Dispose(); $gradient.Dispose(); $command.Dispose(); $cursor.Dispose()
    }
}

$png = New-ScodexIconBitmap 512
try { $png.Save((Join-Path $PSScriptRoot 'icon.png'), [Drawing.Imaging.ImageFormat]::Png) }
finally { $png.Dispose() }

$sizes = @(16, 20, 24, 32, 40, 48, 64, 128, 256)
$frames = [Collections.Generic.List[object]]::new()
foreach ($size in $sizes) {
    $bitmap = New-ScodexIconBitmap $size
    $memory = [IO.MemoryStream]::new()
    try {
        $bitmap.Save($memory, [Drawing.Imaging.ImageFormat]::Png)
        $frames.Add([pscustomobject]@{ Size = $size; Bytes = $memory.ToArray() })
    } finally { $memory.Dispose(); $bitmap.Dispose() }
}
$stream = [IO.File]::Create((Join-Path $PSScriptRoot 'icon.ico'))
$writer = [IO.BinaryWriter]::new($stream)
try {
    $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$frames.Count)
    $offset = 6 + 16 * $frames.Count
    foreach ($frame in $frames) {
        $dimension = if ($frame.Size -eq 256) { 0 } else { $frame.Size }
        $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
        $writer.Write([byte]0); $writer.Write([byte]0)
        $writer.Write([uint16]1); $writer.Write([uint16]32)
        $writer.Write([uint32]$frame.Bytes.Length); $writer.Write([uint32]$offset)
        $offset += $frame.Bytes.Length
    }
    foreach ($frame in $frames) { $writer.Write([byte[]]$frame.Bytes) }
} finally { $writer.Dispose() }

$svg = @"
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs><linearGradient id="brand" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#6D28D9"/><stop offset="1" stop-color="#0284C7"/></linearGradient></defs>
  <path d="M128 8 232 68 232 188 128 248 24 188 24 68Z" fill="url(#brand)"/>
  <path d="m77 87 40 40-40 40" fill="none" stroke="white" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M137 167h44" fill="none" stroke="#A5F3FC" stroke-width="15" stroke-linecap="round"/>
</svg>
"@
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'icon.svg'), $svg + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
Write-Output ('Created hexagonal terminal icon: PNG 512px; ICO sizes ' + ($sizes -join ', '))
