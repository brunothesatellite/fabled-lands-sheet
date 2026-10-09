# make-android-icons.ps1 - genere les icones launcher de l'APK Android
# ---------------------------------------------------------------------
# Meme dessin que favicon-sword-shield.svg : ecu #171717 liseré rouge
# #e23b2e, lame #f1eee8, accents or #f2bd3d.
#
# Produit, pour installeur/android (un seul projet, pas de variante
# contenu) :
#   app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher.png
#       -> repli legacy (48/72/96/144/192 px, plein cadre)
#   app/src/main/res/mipmap-{...}/ic_launcher_foreground.png
#       -> calque avant de l'icone adaptative (art seul, zone sure 66dp)
#   app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml
#       -> icone adaptative (API 26+ : minSdk de l'APK)
#   app/src/main/res/values/ic_launcher_colors.xml
#       -> fond plein #171717 (pleine etendue, exigence maskable)
#
# Usage : powershell -NoProfile -ExecutionPolicy Bypass -File make-android-icons.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Definition))

# Dessin de l'icone (echelle $s, origine ($ox,$oy), coordonnees en unites 32,
# miroir exact de favicon-sword-shield.svg).
#   $withBg    : fond inclus (PNG legacy) ou transparent (calque avant)
#   $fullBleed : fond carre plein cadre (mieux sous masque launcher)
function Draw-FlIcon([int]$canvas, [double]$s, [double]$ox, [double]$oy,
                     [bool]$withBg, [bool]$fullBleed) {
  $bmp = New-Object -TypeName System.Drawing.Bitmap -ArgumentList @($canvas, $canvas, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g   = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode     = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAlias'

  $bg     = [System.Drawing.Color]::FromArgb(255, 23, 23, 23)      # #171717
  $red    = [System.Drawing.Color]::FromArgb(255, 226, 59, 46)     # #e23b2e
  $paper  = [System.Drawing.Color]::FromArgb(255, 241, 238, 232)   # #f1eee8
  $gold   = [System.Drawing.Color]::FromArgb(255, 242, 189, 61)    # #f2bd3d
  $grip   = [System.Drawing.Color]::FromArgb(255, 184, 134, 11)    # #b8860b

  if ($withBg) {
    if ($fullBleed) {
      $g.FillRectangle((New-Object System.Drawing.SolidBrush $bg), 0, 0, $canvas, $canvas)
    } else {
      # fond arrondi (rx=6 en unites 32)
      $w = $canvas - 1
      $r = 6 * $s
      $path = New-Object System.Drawing.Drawing2D.GraphicsPath
      $path.AddArc(0, 0, 2 * $r, 2 * $r, 180, 90)
      $path.AddArc($w - 2 * $r, 0, 2 * $r, 2 * $r, 270, 90)
      $path.AddArc($w - 2 * $r, $w - 2 * $r, 2 * $r, 2 * $r, 0, 90)
      $path.AddArc(0, $w - 2 * $r, 2 * $r, 2 * $r, 90, 90)
      $path.CloseFigure()
      $g.FillPath((New-Object System.Drawing.SolidBrush $bg), $path)
    }
  }

  # --- ecu (SVG : M16 2 L29 7 L29 15 C29 22 22 28 16 30 C10 28 3 22 3 15 L3 7 Z)
  $shield = New-Object System.Drawing.Drawing2D.GraphicsPath
  $shield.StartFigure()
  $shield.AddLines(@(
    (New-Object System.Drawing.PointF ($ox + 16 * $s), ($oy + 2  * $s)),
    (New-Object System.Drawing.PointF ($ox + 29 * $s), ($oy + 7  * $s)),
    (New-Object System.Drawing.PointF ($ox + 29 * $s), ($oy + 15 * $s))
  ))
  $shield.AddBezier(
    (New-Object System.Drawing.PointF ($ox + 29 * $s), ($oy + 15 * $s)),
    (New-Object System.Drawing.PointF ($ox + 29 * $s), ($oy + 22 * $s)),
    (New-Object System.Drawing.PointF ($ox + 22 * $s), ($oy + 28 * $s)),
    (New-Object System.Drawing.PointF ($ox + 16 * $s), ($oy + 30 * $s)))
  $shield.AddBezier(
    (New-Object System.Drawing.PointF ($ox + 16 * $s), ($oy + 30 * $s)),
    (New-Object System.Drawing.PointF ($ox + 10 * $s), ($oy + 28 * $s)),
    (New-Object System.Drawing.PointF ($ox + 3  * $s), ($oy + 22 * $s)),
    (New-Object System.Drawing.PointF ($ox + 3  * $s), ($oy + 15 * $s)))
  $shield.AddLines(@(
    (New-Object System.Drawing.PointF ($ox + 3 * $s), ($oy + 15 * $s)),
    (New-Object System.Drawing.PointF ($ox + 3 * $s), ($oy + 7  * $s))
  ))
  $shield.CloseFigure()
  $g.FillPath((New-Object System.Drawing.SolidBrush $bg), $shield)
  $pRed = New-Object -TypeName System.Drawing.Pen -ArgumentList @($red, (1.5 * $s))
  $pRed.StartCap = $pRed.EndCap = 'Round'
  $g.DrawPath($pRed, $shield)

  # --- lame (SVG : M16 5 L18 5 L18 21 L17 22 L16 21 L15 22 L14 21 L14 5 Z)
  $blade = New-Object System.Drawing.Drawing2D.GraphicsPath
  $blade.AddPolygon(@(
    (New-Object System.Drawing.PointF ($ox + 16 * $s), ($oy + 5  * $s)),
    (New-Object System.Drawing.PointF ($ox + 18 * $s), ($oy + 5  * $s)),
    (New-Object System.Drawing.PointF ($ox + 18 * $s), ($oy + 21 * $s)),
    (New-Object System.Drawing.PointF ($ox + 17 * $s), ($oy + 22 * $s)),
    (New-Object System.Drawing.PointF ($ox + 16 * $s), ($oy + 21 * $s)),
    (New-Object System.Drawing.PointF ($ox + 15 * $s), ($oy + 22 * $s)),
    (New-Object System.Drawing.PointF ($ox + 14 * $s), ($oy + 21 * $s)),
    (New-Object System.Drawing.PointF ($ox + 14 * $s), ($oy + 5  * $s))
  ))
  $g.FillPath((New-Object System.Drawing.SolidBrush $paper), $blade)

  # --- pointe (SVG : M16 4 L17.5 6 L14.5 6 Z)
  $tip = New-Object System.Drawing.Drawing2D.GraphicsPath
  $tip.AddPolygon(@(
    (New-Object System.Drawing.PointF ($ox + 16   * $s), ($oy + 4   * $s)),
    (New-Object System.Drawing.PointF ($ox + 17.5 * $s), ($oy + 6   * $s)),
    (New-Object System.Drawing.PointF ($ox + 14.5 * $s), ($oy + 6   * $s))
  ))
  $g.FillPath((New-Object System.Drawing.SolidBrush $gold), $tip)

  # --- garde (rect x=11 y=21 w=10 h=1.5) + poignee (rect x=14.5 y=22.5 w=3 h=3.5)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush $gold),
    ($ox + 11 * $s), ($oy + 21 * $s), (10 * $s), (1.5 * $s))
  $g.FillRectangle((New-Object System.Drawing.SolidBrush $grip),
    ($ox + 14.5 * $s), ($oy + 22.5 * $s), (3 * $s), (3.5 * $s))
  # lignes de la poignee
  $pLine = New-Object -TypeName System.Drawing.Pen -ArgumentList @($bg, (0.3 * $s))
  foreach ($y in @(23.5, 24.5, 25.5)) {
    $g.DrawLine($pLine, ($ox + 14.5 * $s), ($oy + $y * $s), ($ox + 17.5 * $s), ($oy + $y * $s))
  }

  # --- pommeau (circle cx=16 cy=27 r=1.2)
  $g.FillEllipse((New-Object System.Drawing.SolidBrush $gold),
    ($ox + 16 * $s - 1.2 * $s), ($oy + 27 * $s - 1.2 * $s), (2.4 * $s), (2.4 * $s))

  $g.Dispose()
  return $bmp
}

function Save-Png([System.Drawing.Bitmap]$bmp, [string]$path) {
  $dir = Split-Path -Parent $path
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

# densite -> multiplicateur (dp -> px)
$densities = [ordered]@{ 'mdpi' = 1.0; 'hdpi' = 1.5; 'xhdpi' = 2.0; 'xxhdpi' = 3.0; 'xxxhdpi' = 4.0 }
$res = Join-Path $root 'installeur\android\app\src\main\res'
$nb = 0

foreach ($d in $densities.Keys) {
  $m = $densities[$d]
  # legacy plein cadre (mieux sous masque launcher)
  $legacy = [int][math]::Round(48 * $m)
  $s = $legacy / 32.0
  Save-Png (Draw-FlIcon $legacy $s 0 0 $true $true) (Join-Path $res "mipmap-$d\ic_launcher.png")
  $nb++

  # calque avant adaptatif : art seul, boite de 66dp centree sur 108dp
  $fg = [int][math]::Round(108 * $m)
  $box = 66.0 / 108.0
  $s2 = ($fg * $box) / 32.0
  $off = ($fg - 66.0 * $m) / 2.0
  Save-Png (Draw-FlIcon $fg $s2 $off $off $false $false) (Join-Path $res "mipmap-$d\ic_launcher_foreground.png")
  $nb++
}

# icone adaptative (API 26+)
$xml = @"
<?xml version="1.0" encoding="utf-8"?>
<!-- Icone adaptative : meme art que favicon-sword-shield.svg (make-android-icons.ps1) -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
"@
$anydpi = Join-Path $res 'mipmap-anydpi-v26'
if (-not (Test-Path $anydpi)) { New-Item -ItemType Directory -Force -Path $anydpi | Out-Null }
[System.IO.File]::WriteAllText((Join-Path $anydpi 'ic_launcher.xml'), $xml)
$nb++

$colors = @"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Fond de l'icone adaptative (couleur du favicon) -->
    <color name="ic_launcher_background">#171717</color>
</resources>
"@
$values = Join-Path $res 'values'
if (-not (Test-Path $values)) { New-Item -ItemType Directory -Force -Path $values | Out-Null }
[System.IO.File]::WriteAllText((Join-Path $values 'ic_launcher_colors.xml'), $colors)
$nb++

Write-Host ("android : res generee ({0} densites)" -f $densities.Count)
Write-Host ("{0} fichiers d'icone ecrits" -f $nb)
