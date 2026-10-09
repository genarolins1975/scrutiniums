"""Junta os JSON dos nove revisores em docs/observatorios/energia/avaliacao/revisao_visual.json.

Cada página leva os arquivos que o revisor abriu com o sha256 de cada um (o pacote de capturas da rodada), a nota e as observações de
didatismo e de qualidade visual, e o revisor. Hífen e travessão como separador são trocados por vírgula ou ponto e vírgula; a nota nunca
é alterada.

Uso:
  python3 scripts/energia_revisao_junta.py --rodada AAAA-MM-DD-rN --grupos <pasta com grupo_R*.json e saida/>
"""
import argparse
import hashlib
import json
import os
import re

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AV = os.path.join(RAIZ, "docs", "observatorios", "energia", "avaliacao")
DESTINO = os.path.join(AV, "revisao_visual.json")


def limpa(t):
    if not isinstance(t, str):
        return t
    t = t.replace("—", ", ").replace("–", ", ")
    t = re.sub(r"\s+[-]\s+", ", ", t)
    return re.sub(r"\s{2,}", " ", t).strip()


def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rodada", required=True)
    ap.add_argument("--grupos", required=True)
    a = ap.parse_args()
    escopos = {k: v["escopo"] for k, v in json.load(open(os.path.join(AV, "grupos_revisao.json"), encoding="utf-8"))["grupos"].items()}
    paginas, problemas, revisores = {}, {}, []
    for k in range(1, 10):
        rid = f"R{k}"
        g = json.load(open(os.path.join(a.grupos, f"grupo_{rid}.json")))
        r = json.load(open(os.path.join(a.grupos, "saida", f"{rid}.json")))
        n = 0
        for p in g["paginas"]:
            d = r["paginas"].get(p["rota"])
            if not d:
                print("SEM AVALIAÇÃO", rid, p["rota"])
                continue
            arqs = {os.path.basename(x): sha(x) for x in p["arquivos"] if os.path.exists(x)}
            item = {"abriu": d.get("abriu", []), "nao_abriu": d.get("nao_abriu", []), "arquivos_revisados_sha256": arqs}
            for dim in ("didatismo", "visual"):
                x = d.get(dim) or {}
                item[dim] = {"nota": x.get("nota"), "observacoes": [limpa(o) for o in x.get("observacoes", [])],
                             "defeitos": [limpa(o) for o in x.get("defeitos", x.get("defects", []))], "revisor": rid}
            paginas[p["rota"]] = item
            n += 1
        problemas[rid] = [limpa(t) for t in r.get("problemas_entre_paginas", [])]
        revisores.append({"id": rid, "escopo": escopos.get(rid, ""), "paginas": n})
    metodo = ("Cada revisor, em contexto limpo e sem acesso ao código, abriu o texto da página e as capturas de tela em 1440 e 390 px "
              "(primeira dobra e trechos da página inteira) e deu nota de didatismo e de qualidade visual com observações e defeitos. "
              "É revisão por agente de IA sobre a captura publicada na rodada; não é teste com pessoas.")
    saida = {"versao": "1.0", "rodada": a.rodada, "metodo": metodo, "revisores": revisores, "problemas_entre_paginas": problemas, "paginas": paginas}
    with open(DESTINO, "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(len(paginas), "páginas;", sum(len(v) for v in problemas.values()), "problemas entre páginas")


if __name__ == "__main__":
    main()
