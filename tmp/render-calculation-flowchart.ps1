Add-Type -AssemblyName System.Drawing

$outputPath = "D:\oil\tmp\calculation-flowchart.png"

$width = 1800
$height = 2200
$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$graphics.Clear([System.Drawing.Color]::FromArgb(248, 250, 252))

$titleFont = New-Object System.Drawing.Font("Microsoft YaHei", 28, [System.Drawing.FontStyle]::Bold)
$boxFont = New-Object System.Drawing.Font("Microsoft YaHei", 20, [System.Drawing.FontStyle]::Regular)
$smallFont = New-Object System.Drawing.Font("Microsoft YaHei", 18, [System.Drawing.FontStyle]::Regular)

$titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, 23, 42))
$textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, 23, 42))
$subtleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(71, 85, 105))

$linePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(51, 65, 85), 4)
$linePen.CustomEndCap = New-Object System.Drawing.Drawing2D.AdjustableArrowCap(8, 8)
$borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(100, 116, 139), 3)

$inputFill = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(219, 234, 254))
$errorFill = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(254, 226, 226))
$calcFill = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220, 252, 231))
$resultFill = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(254, 249, 195))
$neutralFill = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(241, 245, 249))
$labelFill = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(248, 250, 252))

function U {
    param([int[]]$Codes)
    return -join ($Codes | ForEach-Object { [char]$_ })
}

function Draw-CenteredText {
    param(
        [System.Drawing.Graphics]$G,
        [string]$Text,
        [System.Drawing.Font]$Font,
        [System.Drawing.Brush]$Brush,
        [float]$X,
        [float]$Y,
        [float]$W,
        [float]$H
    )

    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rect = New-Object System.Drawing.RectangleF($X, $Y, $W, $H)
    $G.DrawString($Text, $Font, $Brush, $rect, $format)
    $format.Dispose()
}

function Draw-Box {
    param(
        [System.Drawing.Graphics]$G,
        [float]$X,
        [float]$Y,
        [float]$W,
        [float]$H,
        [System.Drawing.Brush]$FillBrush,
        [string]$Text,
        [System.Drawing.Font]$Font = $boxFont
    )

    $G.FillRectangle($FillBrush, $X, $Y, $W, $H)
    $G.DrawRectangle($borderPen, $X, $Y, $W, $H)
    Draw-CenteredText -G $G -Text $Text -Font $Font -Brush $textBrush -X $X -Y $Y -W $W -H $H
}

function Draw-Diamond {
    param(
        [System.Drawing.Graphics]$G,
        [float]$CenterX,
        [float]$CenterY,
        [float]$W,
        [float]$H,
        [System.Drawing.Brush]$FillBrush,
        [string]$Text
    )

    [System.Drawing.PointF[]]$points = @(
        (New-Object System.Drawing.PointF([float]$CenterX, [float]($CenterY - ($H / 2)))),
        (New-Object System.Drawing.PointF([float]($CenterX + ($W / 2)), [float]$CenterY)),
        (New-Object System.Drawing.PointF([float]$CenterX, [float]($CenterY + ($H / 2)))),
        (New-Object System.Drawing.PointF([float]($CenterX - ($W / 2)), [float]$CenterY))
    )
    $G.FillPolygon($FillBrush, $points)
    $G.DrawPolygon($borderPen, $points)
    Draw-CenteredText -G $G -Text $Text -Font $boxFont -Brush $textBrush -X ([float]($CenterX - ($W / 2) + 25)) -Y ([float]($CenterY - ($H / 2) + 15)) -W ([float]($W - 50)) -H ([float]($H - 30))
}

function Draw-Arrow {
    param(
        [System.Drawing.Graphics]$G,
        [float]$X1,
        [float]$Y1,
        [float]$X2,
        [float]$Y2
    )

    $G.DrawLine($linePen, $X1, $Y1, $X2, $Y2)
}

function Draw-PolylineArrow {
    param(
        [System.Drawing.Graphics]$G,
        [System.Drawing.PointF[]]$Points
    )

    if ($Points.Length -lt 2) { return }
    for ($i = 0; $i -lt $Points.Length - 2; $i++) {
        $G.DrawLine($borderPen, $Points[$i], $Points[$i + 1])
    }
    $G.DrawLine($linePen, $Points[$Points.Length - 2], $Points[$Points.Length - 1])
}

function Draw-Label {
    param(
        [System.Drawing.Graphics]$G,
        [string]$Text,
        [float]$X,
        [float]$Y,
        [float]$W = 90,
        [float]$H = 34
    )

    $G.FillRectangle($labelFill, $X, $Y, $W, $H)
    Draw-CenteredText -G $G -Text $Text -Font $smallFont -Brush $subtleBrush -X $X -Y $Y -W $W -H $H
}

$titleText = U @(0x8ba1,0x7b97,0x6d41,0x7a0b,0x56fe)
$subtitleText = "$(U @(0x8f93,0x5165)) -> $(U @(0x6821,0x9a8c)) -> $(U @(0x8ba1,0x7b97)) -> $(U @(0x5224,0x65ad)) -> $(U @(0x8f93,0x51fa))"
$startText = U @(0x5f00,0x59cb)
$inputText = "$(U @(0x8f93,0x5165,0x53c2,0x6570))`nA: $(U @(0x57fa,0x7840,0x503c))`nB: $(U @(0x57fa,0x7840,0x503c))`nC: $(U @(0x7cfb,0x6570))`nD: $(U @(0x6761,0x4ef6)) / $(U @(0x9608,0x503c))"
$validateText = U @(0x6570,0x636e,0x6821,0x9a8c)
$invalidText = "$(U @(0x8f93,0x5165,0x65e0,0x6548)) / $(U @(0x9519,0x8bef,0x63d0,0x793a))"
$formulaText = U @(0x6267,0x884c,0x516c,0x5f0f)
$intermediateText = "$(U @(0x4e2d,0x95f4,0x7ed3,0x679c)) = (A + B) x C"
$decisionText = "$(U @(0x4e2d,0x95f4,0x7ed3,0x679c,0x662f,0x5426,0x6ee1,0x8db3,0x6761,0x4ef6)) D$([char]0xFF1F)"
$yesRuleText = "$(U @(0x662f))$([char]0xFF1A)$(U @(0x6309,0x89c4,0x5219))1$(U @(0x4fee,0x6b63))"
$noRuleText = "$(U @(0x5426))$([char]0xFF1A)$(U @(0x6309,0x89c4,0x5219))2$(U @(0x4fee,0x6b63))"
$outputText = U @(0x8f93,0x51fa,0x6700,0x7ec8,0x7ed3,0x679c)
$reportText = "$(U @(0x5c55,0x793a,0x7ed3,0x679c)) / $(U @(0x751f,0x6210,0x62a5,0x8868))"
$endText = U @(0x7ed3,0x675f)
$summaryText = "$(U @(0x8f93,0x5165))$([char]0xFF1A)A$([char]0x3001)B$([char]0x3001)C$([char]0x3001)D`n$(U @(0x516c,0x5f0f))$([char]0xFF1A)(A + B) x C$(U @(0xFF0C,0x518d,0x6839,0x636e,0x6761,0x4ef6)) D $(U @(0x8c03,0x6574,0x7ed3,0x679c))`n$(U @(0x8f93,0x51fa))$([char]0xFF1A)$(U @(0x6700,0x7ec8,0x503c))$([char]0x3001)$(U @(0x5224,0x65ad,0x72b6,0x6001))$([char]0x3001)$(U @(0x7ed3,0x679c,0x5c55,0x793a))$(U @(0x6216,0x62a5,0x8868))"
$invalidLabel = U @(0x975e,0x6cd5)
$validLabel = U @(0x5408,0x6cd5)
$yesLabel = U @(0x662f)
$noLabel = U @(0x5426)

Draw-CenteredText -G $graphics -Text $titleText -Font $titleFont -Brush $titleBrush -X 0 -Y 35 -W $width -H 60
Draw-CenteredText -G $graphics -Text $subtitleText -Font $smallFont -Brush $subtleBrush -X 0 -Y 95 -W $width -H 40

$centerX = 900

$start = @{ X = 720; Y = 150; W = 360; H = 76 }
$input = @{ X = 530; Y = 270; W = 740; H = 130 }
$validate = @{ X = 580; Y = 470; W = 640; H = 90 }
$invalid = @{ X = 110; Y = 595; W = 420; H = 90 }
$formula = @{ X = 580; Y = 630; W = 640; H = 90 }
$intermediate = @{ X = 580; Y = 790; W = 640; H = 90 }
$decision = @{ X = 900; Y = 1030; W = 720; H = 220 }
$yes = @{ X = 210; Y = 1195; W = 470; H = 90 }
$no = @{ X = 1120; Y = 1195; W = 470; H = 90 }
$output = @{ X = 580; Y = 1360; W = 640; H = 90 }
$report = @{ X = 580; Y = 1520; W = 640; H = 90 }
$end = @{ X = 720; Y = 1675; W = 360; H = 76 }
$summary = @{ X = 100; Y = 1840; W = 1600; H = 220 }

Draw-Box -G $graphics -X $start.X -Y $start.Y -W $start.W -H $start.H -FillBrush $neutralFill -Text $startText
Draw-Box -G $graphics -X $input.X -Y $input.Y -W $input.W -H $input.H -FillBrush $inputFill -Text $inputText -Font $smallFont
Draw-Box -G $graphics -X $validate.X -Y $validate.Y -W $validate.W -H $validate.H -FillBrush $inputFill -Text $validateText
Draw-Box -G $graphics -X $invalid.X -Y $invalid.Y -W $invalid.W -H $invalid.H -FillBrush $errorFill -Text $invalidText
Draw-Box -G $graphics -X $formula.X -Y $formula.Y -W $formula.W -H $formula.H -FillBrush $calcFill -Text $formulaText
Draw-Box -G $graphics -X $intermediate.X -Y $intermediate.Y -W $intermediate.W -H $intermediate.H -FillBrush $calcFill -Text $intermediateText
Draw-Diamond -G $graphics -CenterX $decision.X -CenterY $decision.Y -W $decision.W -H $decision.H -FillBrush $resultFill -Text $decisionText
Draw-Box -G $graphics -X $yes.X -Y $yes.Y -W $yes.W -H $yes.H -FillBrush $calcFill -Text $yesRuleText
Draw-Box -G $graphics -X $no.X -Y $no.Y -W $no.W -H $no.H -FillBrush $calcFill -Text $noRuleText
Draw-Box -G $graphics -X $output.X -Y $output.Y -W $output.W -H $output.H -FillBrush $resultFill -Text $outputText
Draw-Box -G $graphics -X $report.X -Y $report.Y -W $report.W -H $report.H -FillBrush $resultFill -Text $reportText
Draw-Box -G $graphics -X $end.X -Y $end.Y -W $end.W -H $end.H -FillBrush $neutralFill -Text $endText
Draw-Box -G $graphics -X $summary.X -Y $summary.Y -W $summary.W -H $summary.H -FillBrush $neutralFill -Text $summaryText -Font $smallFont

Draw-Arrow -G $graphics -X1 900 -Y1 ($start.Y + $start.H) -X2 900 -Y2 $input.Y
Draw-Arrow -G $graphics -X1 900 -Y1 ($input.Y + $input.H) -X2 900 -Y2 $validate.Y
Draw-Arrow -G $graphics -X1 900 -Y1 ($validate.Y + $validate.H) -X2 900 -Y2 $formula.Y
Draw-Arrow -G $graphics -X1 900 -Y1 ($formula.Y + $formula.H) -X2 900 -Y2 $intermediate.Y
Draw-Arrow -G $graphics -X1 900 -Y1 ($intermediate.Y + $intermediate.H) -X2 900 -Y2 920

[System.Drawing.PointF[]]$invalidRoute = @(
    (New-Object System.Drawing.PointF([float]$validate.X, [float]($validate.Y + ($validate.H / 2)))),
    (New-Object System.Drawing.PointF(430.0, [float]($validate.Y + ($validate.H / 2)))),
    (New-Object System.Drawing.PointF(430.0, [float]($invalid.Y + ($invalid.H / 2)))),
    (New-Object System.Drawing.PointF([float]($invalid.X + $invalid.W), [float]($invalid.Y + ($invalid.H / 2))))
)
Draw-PolylineArrow -G $graphics -Points $invalidRoute
Draw-Label -G $graphics -Text $invalidLabel -X 455 -Y 495
Draw-Label -G $graphics -Text $validLabel -X 940 -Y 575

Draw-Arrow -G $graphics -X1 900 -Y1 920 -X2 900 -Y2 920
Draw-Arrow -G $graphics -X1 900 -Y1 920 -X2 900 -Y2 ($decision.Y - ($decision.H / 2))

[System.Drawing.PointF[]]$yesRoute = @(
    (New-Object System.Drawing.PointF(720.0, 1030.0)),
    (New-Object System.Drawing.PointF(445.0, [float]$yes.Y)),
    (New-Object System.Drawing.PointF(445.0, [float]$yes.Y))
)
[System.Drawing.PointF[]]$noRoute = @(
    (New-Object System.Drawing.PointF(1080.0, 1030.0)),
    (New-Object System.Drawing.PointF(1355.0, [float]$no.Y)),
    (New-Object System.Drawing.PointF(1355.0, [float]$no.Y))
)
Draw-PolylineArrow -G $graphics -Points $yesRoute
Draw-PolylineArrow -G $graphics -Points $noRoute
Draw-Label -G $graphics -Text $yesLabel -X 560 -Y 1080
Draw-Label -G $graphics -Text $noLabel -X 1150 -Y 1080

Draw-Arrow -G $graphics -X1 445 -Y1 ($yes.Y + $yes.H) -X2 760 -Y2 $output.Y
Draw-Arrow -G $graphics -X1 1355 -Y1 ($no.Y + $no.H) -X2 1040 -Y2 $output.Y
Draw-Arrow -G $graphics -X1 900 -Y1 ($output.Y + $output.H) -X2 900 -Y2 $report.Y
Draw-Arrow -G $graphics -X1 900 -Y1 ($report.Y + $report.H) -X2 900 -Y2 $end.Y

[System.Drawing.PointF[]]$errorToReport = @(
    (New-Object System.Drawing.PointF(320.0, [float]($invalid.Y + $invalid.H))),
    (New-Object System.Drawing.PointF(320.0, 1565.0)),
    (New-Object System.Drawing.PointF([float]$report.X, 1565.0))
)
Draw-PolylineArrow -G $graphics -Points $errorToReport

$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$titleFont.Dispose()
$boxFont.Dispose()
$smallFont.Dispose()
$titleBrush.Dispose()
$textBrush.Dispose()
$subtleBrush.Dispose()
$linePen.Dispose()
$borderPen.Dispose()
$inputFill.Dispose()
$errorFill.Dispose()
$calcFill.Dispose()
$resultFill.Dispose()
$neutralFill.Dispose()
$labelFill.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

Write-Output "PNG created: $outputPath"
