"""Converte as capturas do redesenho (antes ou depois) em WebP versionados, com nomes por rota.

Dois tipos de origem, que podem ser dadas juntas:
  --coleta <pasta com capturas/>   coleta limpa de energia-avaliacao.mjs (todas as rotas; nomes <rota>__<largura>_dobra.png e _inteira.png)
  --aberturas <pasta com png/>     capturas de energia-capturas-redesenho.mjs (22 aberturas; 320, 390, 768 e 1440 px; nomes por abertura)

Destino (--destino): um arquivo por rota, largura e tipo, nomeado <rota>__<largura>_<tipo>.webp.
  Primeira dobra: todas as rotas, 1440 e 390 px, em tamanho real.
  Página inteira: só as 22 aberturas, em 1440 px (reduzida a 50%) e 390 px (reduzida a 60%). Dobras de 320 e 768 px: só as 22 aberturas.
Uso:
  python3 scripts/energia_capturas_redesenho_webp.py --destino docs/energia/redesign/capturas/antes --coleta <rd> --aberturas <rd_antes>
Requer Pillow.
"""
import argparse
import glob
import json
import os
import re

from PIL import Image

Image.MAX_IMAGE_PIXELS = None
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def slug(rota):
    return re.sub(r"[^a-z0-9]+", "_", re.sub(r"^/setor-eletrico/?", "", rota, flags=re.I)).strip("_") or "raiz"


def salva(origem, destino, escala=1.0, qualidade=72):
    im = Image.open(origem).convert("RGB")
    if escala != 1.0:
        im = im.resize((max(1, int(im.width * escala)), max(1, int(im.height * escala))), Image.LANCZOS)
    # WebP limita a 16383 px em cada lado: páginas longas em tamanho real são cortadas em partes
    if im.height <= 16000:
        im.save(destino, "WEBP", quality=qualidade, method=6)
        return [destino]
    partes = []
    n = (im.height + 15999) // 16000
    base, ext = os.path.splitext(destino)
    for k in range(n):
        p = f"{base}_parte{k + 1}de{n}{ext}"
        im.crop((0, k * 16000, im.width, min(im.height, (k + 1) * 16000))).save(p, "WEBP", quality=qualidade, method=6)
        partes.append(p)
    return partes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--destino", required=True)
    ap.add_argument("--coleta")
    ap.add_argument("--aberturas")
    a = ap.parse_args()
    os.makedirs(a.destino, exist_ok=True)
    n = 0
    if a.coleta:
        for f in sorted(glob.glob(os.path.join(a.coleta, "capturas", "*__*_dobra.png"))):
            base = os.path.basename(f)[:-4]
            w = int(base.split("__")[1].split("_")[0])
            salva(f, os.path.join(a.destino, base + ".webp"), 0.5 if w == 1440 else 1.0)
            n += 1
    if a.aberturas:
        mapa = {x["slug"]: slug(x["rota"]) for x in json.load(open(os.path.join(RAIZ, "docs", "energia", "redesign", "aberturas.json"), encoding="utf-8"))}
        for f in sorted(glob.glob(os.path.join(a.aberturas, "png", "*__*_*.png"))):
            base = os.path.basename(f)[:-4]
            s, resto = base.split("__")
            w, tipo = resto.split("_")[0], resto.split("_", 1)[1]
            rota_slug = mapa.get(s, s)
            if tipo == "dobra" and w in ("1440", "390") and a.coleta:
                continue  # já veio da coleta limpa
            if tipo == "inteira" and w in ("320", "768"):
                continue  # 320 e 768 px são verificação de medidas e de rolagem; o arquivo guarda 1440 e 390 px
            escala = 0.5 if (w == "1440" and tipo == "inteira") else (0.6 if tipo == "inteira" else 1.0)
            salva(f, os.path.join(a.destino, f"{rota_slug}__{w}_{tipo}.webp"), escala, 62 if tipo == "inteira" else 72)
            n += 1
    tot = sum(os.path.getsize(p) for p in glob.glob(os.path.join(a.destino, "*.webp")))
    print(n, "capturas convertidas;", round(tot / 1e6, 1), "MB em", a.destino)


if __name__ == "__main__":
    main()
