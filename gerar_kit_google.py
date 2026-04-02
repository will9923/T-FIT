from PIL import Image
import os

def resize_image(input_name, output_name, size):
    try:
        with Image.open(input_name) as img:
            # Convert to RGB if it's RGBA (transparency) to avoid JPEG issues
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            
            # Resize with Lanczos for high quality
            img = img.resize(size, Image.Resampling.LANCZOS)
            img.save(output_name, "PNG", quality=95)
            print(f"✅ Criado: {output_name} ({size[0]}x{size[1]})")
    except Exception as e:
        print(f"❌ Erro ao processar {input_name}: {e}")

# Configurações do Google Play
sizes = {
    "google_play_icon.png": (512, 512),
    "google_play_feature.png": (1024, 500),
    "google_play_print1.png": (1080, 1920),
    "google_play_print2.png": (1080, 1920),
    "google_play_print3.png": (1080, 1920),
}

# Mapeamento de arquivos do usuário
mapping = {
    "google_play_icon.png": "logo.png",
    "google_play_feature.png": "logo.png", # Usaremos o logo centralizado na capa
    "google_play_print1.png": "print1.png",
    "google_play_print2.png": "print2.png",
    "google_play_print3.png": "print3.png",
}

print("🚀 Iniciando processamento de imagens do T-FIT...")

for output, input_f in mapping.items():
    if os.path.exists(input_f):
        resize_image(input_f, output, sizes[output])
    else:
        print(f"⚠️ Aviso: Arquivo '{input_f}' não encontrado na pasta.")

print("\n✨ FIM! Suba os arquivos que começam com 'google_play_' no seu Console da Google Play! 🏆🚀")
