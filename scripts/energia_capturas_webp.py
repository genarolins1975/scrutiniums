"""Converte as capturas limpas da primeira dobra (1440 e 390 px) em WebP para a pasta versionada da avaliação.

A de 1440 px é reduzida a 50%. Escreve em docs/observatorios/energia/avaliacao/capturas/ um arquivo por página e largura.

Uso:
  python3 scripts/energia_capturas_webp.py <pasta da rodada com capturas/>
"""
import glob
import os
import sys

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESTINO = os.path.join(RAIZ, "docs", "observatorios", "energia", "avaliacao", "capturas")


def main():
    origem = os.path.join(sys.argv[1], "capturas")
    n = 0
    for f in sorted(glob.glob(os.path.join(origem, "*__*_dobra.png"))):
        base = os.path.basename(f)[:-4]
        w = int(base.split("__")[1].split("_")[0])
        im = Image.open(f).convert("RGB")
        if w == 1440:
            im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
        im.save(os.path.join(DESTINO, base + ".webp"), "WEBP", quality=75, method=6)
        n += 1
    print(n, "arquivos")


if __name__ == "__main__":
    main()
