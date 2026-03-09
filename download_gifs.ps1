$visuals = @{
    "supino-reto" = "https://i.giphy.com/3o7TKvk8m9N0uT3lYs.gif"
    "supino-inclinado" = "https://i.giphy.com/l41lOflvX6l2zMhXO.gif"
    "flexao" = "https://i.giphy.com/3o7TKvk8m9N0uT3lYs.gif"
    "voador" = "https://i.giphy.com/3o7TKvk8m9N0uT3lYs.gif"
    "crucifixo" = "https://i.giphy.com/3o7TKvk8m9N0uT3lYs.gif"
    "mergulho-paralelas" = "https://i.giphy.com/3o7TKvk8m9N0uT3lYs.gif"
    "pike-push-up" = "https://i.giphy.com/3o7TKvk8m9N0uT3lYs.gif"
    "puxada-alta" = "https://i.giphy.com/3o7TKvk8m9N0uT3lYs.gif"
    "remada-baixa" = "https://i.giphy.com/3o7TKvk8m9N0uT3lYs.gif"
    "remada-curvada" = "https://i.giphy.com/3o7TKvk8m9N0uT3lYs.gif"
    "serrote" = "https://i.giphy.com/3o7TKvk8m9N0uT3lYs.gif"
    "barra-fixa" = "https://i.giphy.com/3o7TKvk8m9N0uT3lYs.gif"
    "superman" = "https://i.giphy.com/3o7TKvk8m9N0uT3lYs.gif"
    "agachamento" = "https://i.giphy.com/l41lOflvX6L2zMhXO.gif"
    "leg-press" = "https://i.giphy.com/l41lOflvX6L2zMhXO.gif"
    "stiff" = "https://i.giphy.com/l41lOflvX6L2zMhXO.gif"
    "extensora" = "https://i.giphy.com/l41lOflvX6L2zMhXO.gif"
    "flexor" = "https://i.giphy.com/l41lOflvX6L2zMhXO.gif"
    "afundo" = "https://i.giphy.com/l41lOflvX6L2zMhXO.gif"
    "passada" = "https://i.giphy.com/l41lOflvX6L2zMhXO.gif"
    "panturrilha" = "https://i.giphy.com/l41lOflvX6L2zMhXO.gif"
    "elevacao-pelvica" = "https://i.giphy.com/l41lOflvX6L2zMhXO.gif"
    "glute-bridge" = "https://i.giphy.com/l41lOflvX6L2zMhXO.gif"
    "rosca-direta" = "https://i.giphy.com/3o7TKvk8m9N0uT3lYs.gif"
    "rosca-martelo" = "https://i.giphy.com/3o7TKvk8m9N0uT3lYs.gif"
    "rosca-concentrada" = "https://i.giphy.com/3o7TKvk8m9N0uT3lYs.gif"
    "triceps-corda" = "https://i.giphy.com/3o7TKvk8m9N0uT3lYs.gif"
    "triceps-testa" = "https://i.giphy.com/3o7TKvk8m9N0uT3lYs.gif"
    "triceps-frances" = "https://i.giphy.com/3o7TKvk8m9N0uT3lYs.gif"
    "triceps-coice" = "https://i.giphy.com/3o7TKvk8m9N0uT3lYs.gif"
    "biceps" = "https://i.giphy.com/3o7TKvk8m9N0uT3lYs.gif"
    "desenvolvimento" = "https://i.giphy.com/3o7TKvk8m9N0uT3lYs.gif"
    "elevacao-lateral" = "https://i.giphy.com/3o7TKvk8m9N0uT3lYs.gif"
    "frontal" = "https://i.giphy.com/3o7TKvk8m9N0uT3lYs.gif"
    "abdominal" = "https://i.giphy.com/u6A76097A19rW.gif"
    "burpee" = "https://i.giphy.com/u6A76097A19rW.gif"
    "polichinelo" = "https://i.giphy.com/u6A76097A19rW.gif"
    "corrida" = "https://i.giphy.com/u6A76097A19rW.gif"
    "salto" = "https://i.giphy.com/u6A76097A19rW.gif"
    "prancha" = "https://i.giphy.com/u6A76097A19rW.gif"
}

$destDir = "c:\Users\thays\Desktop\FITPRO NATIVE MOBILE\assets\exercises"

if (-not (Test-Path -Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force
}

foreach ($key in $visuals.Keys) {
    $url = $visuals[$key]
    $output = Join-Path -Path $destDir -ChildPath "$key.gif"
    Write-Host "Downloading $key from $url..."
    try {
        Invoke-WebRequest -Uri $url -OutFile $output
    } catch {
        Write-Error "Failed to download $key"
    }
}
