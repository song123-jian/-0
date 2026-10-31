$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function New-RoundedRectangle($graphics, $brush, $x, $y, $width, $height, $radius) {
    $shape = [Drawing.Drawing2D.GraphicsPath]::new()
    $diameter = $radius * 2
    $shape.AddArc($x, $y, $diameter, $diameter, 180, 90)
    $shape.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
    $shape.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
    $shape.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
    $shape.CloseFigure()
    $graphics.FillPath($brush, $shape)
    $shape.Dispose()
}

$bitmap = [Drawing.Bitmap]::new(256, 256)
$graphics = [Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.ScaleTransform(2, 2)
$dark = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#176c5b'))
$light = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#f1f7f3'))
$sage = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#cee5d8'))
$dot = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#75ad94'))
$pale = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#b8d6c3'))
$pen = [Drawing.Pen]::new($dark, 4)
$pen.StartCap = $pen.EndCap = [Drawing.Drawing2D.LineCap]::Round
$stand = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml('#d8ece0'), 5)
$stand.StartCap = $stand.EndCap = [Drawing.Drawing2D.LineCap]::Round
try {
    New-RoundedRectangle $graphics $dark 0 0 128 128 28
    New-RoundedRectangle $graphics $light 22 24 84 68 9
    $graphics.FillRectangle($dark, 22, 43.5, 84, 3)
    $graphics.FillEllipse($dot, 30, 32, 6, 6)
    $graphics.FillEllipse($pale, 40, 32, 6, 6)
    New-RoundedRectangle $graphics $sage 32 54 22 27 4
    $graphics.DrawLines($pen, [Drawing.PointF[]]@([Drawing.PointF]::new(67,57), [Drawing.PointF]::new(60,64), [Drawing.PointF]::new(67,71)))
    $graphics.DrawLines($pen, [Drawing.PointF[]]@([Drawing.PointF]::new(82,57), [Drawing.PointF]::new(89,64), [Drawing.PointF]::new(82,71)))
    $graphics.DrawLine($stand, 64, 93, 64, 103)
    $graphics.DrawLine($stand, 45, 105, 83, 105)
    $iconPng = Join-Path $PSScriptRoot 'icon.png'
    $bitmap.Save($iconPng, [Drawing.Imaging.ImageFormat]::Png)
    $pngBytes = [IO.File]::ReadAllBytes($iconPng)
    $stream = [IO.File]::Create((Join-Path $PSScriptRoot 'icon.ico'))
    $writer = [IO.BinaryWriter]::new($stream)
    try {
        $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]1)
        $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0)
        $writer.Write([uint16]1); $writer.Write([uint16]32)
        $writer.Write([uint32]$pngBytes.Length); $writer.Write([uint32]22)
        $writer.Write($pngBytes)
    } finally { $writer.Dispose() }
} finally {
    $graphics.Dispose(); $bitmap.Dispose()
    $dark.Dispose(); $light.Dispose(); $sage.Dispose(); $dot.Dispose(); $pale.Dispose()
    $pen.Dispose(); $stand.Dispose()
}
