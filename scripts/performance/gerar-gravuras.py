"""Variantes responsivas das gravuras existentes, sem mudar os originais.
Reprodução opcional: Python 3.12 + Pillow 12.3.0 (não é dependência de runtime).
Rodar na raiz: python3 scripts/performance/gerar-gravuras.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]

def salvar(imagem, destino, largura):
    altura = round(imagem.height * largura / imagem.width)
    imagem.resize((largura, altura), Image.Resampling.LANCZOS).save(
        ROOT / destino, format="WEBP", quality=82, method=6
    )

with Image.open(ROOT / "public/obs/arte/economia-gravura-v1.webp") as imagem:
    for largura in (480, 800, 1200):
        salvar(imagem, f"public/obs/arte/economia-gravura-{largura}-v1.webp", largura)

for pasta, colunas, nomes, larguras in (
    ("energia", 2, ("geracao", "transmissao", "distribuicao", "consumo"), (300, 600)),
    ("obs", 4, tuple(str(i) for i in range(8)), (240, 440)),
):
    with Image.open(ROOT / f"public/{pasta}/arte/etapas-gravura-v1.webp") as prancha:
        lado = prancha.width // colunas
        for i, nome in enumerate(nomes):
            x, y = i % colunas * lado, i // colunas * lado
            cena = prancha.crop((x, y, x + lado, y + lado))
            for largura in larguras:
                salvar(cena, f"public/{pasta}/arte/etapa-{nome}-{largura}-v1.webp", largura)
