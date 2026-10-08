"""Empacota o texto e as capturas de cada página da rodada para os revisores em contexto limpo e monta o grupo de cada revisor.

Entrada: a pasta das capturas limpas da rodada (saída de energia-avaliacao.mjs com --limpas 1 --capturas 1, com a subpasta capturas/).
Saída: <destino>/<página>/ com texto.txt, a primeira dobra e trechos da página inteira em 1440 px (reduzidos a 50%) e em 390 px (tamanho real),
mais <destino>/manifesto.json e um grupo_R<k>.json por revisor, a partir de grupos_revisao.json (as mesmas páginas por revisor em toda rodada).

Uso:
  python3 scripts/energia_revisao_pacote.py --origem <pasta da rodada> --destino <pacote> --grupos-saida <pasta> [--max-390 3] [--max-1440 5]

O número de trechos de 390 px por página foi 3 na r7 e na r8, e vários revisores declararam não ter visto gráficos e mapas em celular: para a
rodada seguinte use --max-390 maior (6, por exemplo). Requer Pillow.
"""
import argparse
import json
import os
import re

from PIL import Image

Image.MAX_IMAGE_PIXELS = None
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AV = os.path.join(RAIZ, "docs", "observatorios", "energia", "avaliacao")


def slug(rota):
    return re.sub(r"[^a-z0-9]+", "_", re.sub(r"^/setor-eletrico/?", "", rota, flags=re.I)).strip("_") or "raiz"


def escolhe(n, maximo):
    if n <= maximo:
        return list(range(n))
    return sorted(set(round(i * (n - 1) / (maximo - 1)) for i in range(maximo)))


def empacota(origem, destino, rotas, max390, max1440):
    manifesto = {}
    for rota in rotas:
        sl = slug(rota)
        pasta = os.path.join(destino, sl)
        os.makedirs(pasta, exist_ok=True)
        item = {"texto": None, "imagens": []}
        t = os.path.join(origem, "capturas", f"{sl}__texto.txt")
        if os.path.exists(t):
            txt = open(t, encoding="utf-8").read()
            open(os.path.join(pasta, "texto.txt"), "w", encoding="utf-8").write(txt)
            item["texto"] = os.path.join(pasta, "texto.txt")
        for w, escala, altura, maxt in ((1440, 0.5, 1500, max1440), (390, 1.0, 1500, max390)):
            d = os.path.join(origem, "capturas", f"{sl}__{w}_dobra.png")
            if os.path.exists(d):
                im = Image.open(d).convert("RGB")
                if escala != 1.0:
                    im = im.resize((int(im.width * escala), int(im.height * escala)))
                dest = os.path.join(pasta, f"{w}_dobra.png")
                im.save(dest)
                item["imagens"].append({"arquivo": dest, "largura_px": w, "tipo": "primeira dobra", "escala": escala})
            i = os.path.join(origem, "capturas", f"{sl}__{w}_inteira.png")
            if os.path.exists(i):
                im = Image.open(i).convert("RGB")
                altura_total = im.height
                if escala != 1.0:
                    im = im.resize((int(im.width * escala), int(im.height * escala)))
                n = (im.height + altura - 1) // altura
                for k in escolhe(n, maxt):
                    c = im.crop((0, k * altura, im.width, min(im.height, (k + 1) * altura)))
                    dest = os.path.join(pasta, f"{w}_inteira_{k + 1:02d}de{n:02d}.png")
                    c.save(dest)
                    item["imagens"].append({"arquivo": dest, "largura_px": w, "tipo": f"página inteira, trecho {k + 1} de {n}", "escala": escala})
                item[f"altura_{w}_px"] = altura_total
        manifesto[rota] = item
    json.dump(manifesto, open(os.path.join(destino, "manifesto.json"), "w"), ensure_ascii=False, indent=1)
    return manifesto


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--origem", required=True)
    ap.add_argument("--destino", required=True)
    ap.add_argument("--grupos-saida", required=True, help="pasta onde ficam grupo_R1.json a grupo_R9.json e a subpasta saida/")
    ap.add_argument("--max-390", type=int, default=3)
    ap.add_argument("--max-1440", type=int, default=5)
    a = ap.parse_args()
    grupos = json.load(open(os.path.join(AV, "grupos_revisao.json"), encoding="utf-8"))["grupos"]
    rotas = [r for g in grupos.values() for r in g["rotas"]]
    man = empacota(a.origem, a.destino, rotas, a.max_390, a.max_1440)
    os.makedirs(os.path.join(a.grupos_saida, "saida"), exist_ok=True)
    for rid, g in grupos.items():
        paginas = []
        for rota in g["rotas"]:
            m = man[rota]
            paginas.append({"rota": rota, "pasta": os.path.dirname(m["texto"]), "arquivos": [m["texto"]] + [i["arquivo"] for i in m["imagens"]],
                            "altura_1440_px": m.get("altura_1440_px"), "altura_390_px": m.get("altura_390_px")})
        json.dump({"revisor": rid, "saida": os.path.join(a.grupos_saida, "saida", f"{rid}.json"), "paginas": paginas},
                  open(os.path.join(a.grupos_saida, f"grupo_{rid}.json"), "w"), ensure_ascii=False, indent=1)
    import shutil
    shutil.copy(os.path.join(AV, "INSTRUCOES_REVISORES.md"), os.path.join(a.grupos_saida, "INSTRUCOES.md"))
    print(len(man), "páginas empacotadas;", sum(len(v["imagens"]) for v in man.values()), "imagens;", len(grupos), "grupos")


if __name__ == "__main__":
    main()
