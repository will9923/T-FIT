$exercises = @{
    "supino-reto"        = "3o7TKVUn7iM8FMEU24"
    "supino-inclinado"   = "3o7TKvk8m9N0uT3lYs"
    "flexao"             = "3o7TKv6CEp8Eup2Cyc"
    "voador"             = "3o7TKwbW8p0i3jS3n2"
    "crucifixo"          = "3o7TKvWk8iUpY7S4G4"
    "mergulho-paralelas" = "3o7TKv8p5U9iS7G5G0"
    "pike-push-up"       = "3o7TKvXk8iUpY7S4G4"
    "puxada-alta"        = "3o7TKv5p5U9iS7G5G0"
    "remada-baixa"       = "3o7TKv9p5U9iS7G5G0"
    "remada-curvada"     = "3o7TKv7p5U9iS7G5G0"
    "serrote"            = "3o7TKvAp5U9iS7G5G0"
    "barra-fixa"         = "3o7TKvBp5U9iS7G5G0"
    "superman"           = "3o7TKvjp5U9iS7G5G0"
    "agachamento"        = "3o7TKv4p5U9iS7G5G0"
    "leg-press"          = "3o7TKvLp5U9iS7G5G0"
    "stiff"              = "3o7TKvMp5U9iS7G5G0"
    "extensora"          = "3o7TKvNp5U9iS7G5G0"
    "flexor"             = "3o7TKv1p5U9iS7G5G0"
    "afundo"             = "3o7TKv2p5U9iS7G5G0"
    "passada"            = "3o7TKv3p5U9iS7G5G0"
    "panturrilha"        = "3o7TKvDp5U9iS7G5G0"
    "elevacao-pelvica"   = "3o7TKvHp5U9iS7G5G0"
    "glute-bridge"       = "3o7TKvGp5U9iS7G5G0"
    "rosca-direta"       = "3o7TKvGp5U9iS7G5G0"
    "rosca-martelo"      = "3o7TKvHp5U9iS7G5G0"
    "rosca-concentrada"  = "3o7TKvIp5U9iS7G5G0"
    "triceps-corda"      = "3o7TKvRp5U9iS7G5G0"
    "triceps-testa"      = "3o7TKvOp5U9iS7G5G0"
    "triceps-frances"    = "3o7TKvUP5U9iS7G5G0"
    "triceps-coice"      = "3o7TKvVP5U9iS7G5G0"
    "biceps"             = "3o7TKvPP5U9iS7G5G0"
    "desenvolvimento"    = "3o7TKvSP5U9iS7G5G0"
    "elevacao-lateral"   = "3o7TKvTP5U9iS7G5G0"
    "frontal"            = "3o7TKvFP5U9iS7G5G0"
    "abdominal"          = "3o7TKvAb5U9iS7G5G0"
    "burpee"             = "3o7TKvBu5U9iS7G5G0"
    "polichinelo"        = "3o7TKvPo5U9iS7G5G0"
    "corrida"            = "3o7TKvCo5U9iS7G5G0"
    "salto"              = "3o7TKvSa5U9iS7G5G0"
    "prancha"            = "3o7TKvPr5U9iS7G5G0"
}

$destPath = "assets/exercises"
if (!(Test-Path $destPath)) {
    New-Item -ItemType Directory -Path $destPath
}

foreach ($name in $exercises.Keys) {
    $id = $exercises[$name]
    $url = "https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3hpeXNjNXN4NXN4NXN4NXN4NXN4NXN4NXN4NXN4NXN4NXN4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/$id/giphy.gif"
    $file = "$destPath/$name.gif"
    Write-Host "Baixando $name..."
    try {
        Invoke-WebRequest -Uri $url -OutFile $file
    }
    catch {
        Write-Warning "Falha ao baixar $name"
    }
}
Write-Host "Download concluído!"
