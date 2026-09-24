"""Casos sentinela: mede o validador com erros plantados (piloto, PR 2).

Cada caso aplica UMA alteração à nota limpa (ou ao pacote) e declara a decisão e as
checagens esperadas. Acerto = decisão igual à esperada e checagens esperadas presentes.

    recall por categoria    casos com erro detectado ÷ casos da categoria
    falso bloqueio          controles limpos que não foram aprovados

Uso: python3 -m pesquisa.sentinela [--dir pesquisa/sentinelas] [--saida resultado.json]
Código de saída 0 só com recall de 100% e zero falso bloqueio.
"""
import argparse
import copy
import json
import os
import re
import sys

from pesquisa import fatos_conjuntura as fc
from pesquisa import validador as vd

DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sentinelas")


def _cabecalho(texto, alteracoes):
    m = re.match(r"^---\n(.*?)\n---\n", texto, flags=re.S)
    linhas = m.group(1).splitlines()
    for k, v in alteracoes.items():
        linhas = [f"{k}: {v}" if l.split(":", 1)[0].strip() == k else l for l in linhas]
        if not any(l.split(":", 1)[0].strip() == k for l in linhas):
            linhas.append(f"{k}: {v}")
    return "---\n" + "\n".join(linhas) + "\n---\n" + texto[m.end():]


def aplicar(caso, texto, pacote):
    """Devolve (texto, pacote) com a alteração do caso. Caso cuja substituição não encontra
    o trecho é inválido: falha alto, para a bateria nunca medir um caso que não mudou nada."""
    texto, pacote = texto, copy.deepcopy(pacote)
    for antigo, novo in caso.get("substituir", []):
        if antigo not in texto:
            raise ValueError(f"caso {caso['id']}: trecho não encontrado na nota: {antigo!r}")
        texto = texto.replace(antigo, novo, 1)
    if caso.get("acrescentar"):
        texto = texto.rstrip("\n") + "\n\n" + caso["acrescentar"] + "\n"
    op = caso.get("pacote") or {}
    if "alterar_valor" in op:
        fid, v = op["alterar_valor"]
        next(f for f in pacote["fatos"] if f["id"] == fid)["valor"] = v
    if "acrescentar_lacuna" in op:
        pacote["lacunas"] = pacote.get("lacunas", []) + [op["acrescentar_lacuna"]]
    cab = dict(caso.get("cabecalho") or {})
    if op.get("recalcular_sha"):
        pacote["sha256_fatos"] = fc.sha256_fatos(pacote["fatos"])
        cab.setdefault("pacote_sha256", pacote["sha256_fatos"])
    if cab:
        texto = _cabecalho(texto, cab)
    return texto, pacote


def rodar(diretorio=DIR):
    with open(os.path.join(diretorio, "casos.json"), encoding="utf-8") as f:
        casos = json.load(f)
    with open(os.path.join(diretorio, "nota_limpa.md"), encoding="utf-8") as f:
        base = f.read()
    with open(os.path.join(diretorio, "pacote.json"), encoding="utf-8") as f:
        pacote = json.load(f)
    resultados = []
    for grupo in ("casos", "controles_limpos"):
        for caso in casos[grupo]:
            t, p = aplicar(caso, base, pacote)
            r = vd.validar(t, p)
            esp = caso["esperado"]
            acerto = r["decisao"] == esp["decisao"] and set(esp["codigos"]) <= set(r["falhas"])
            resultados.append({"id": caso["id"], "grupo": grupo, "categoria": caso.get("categoria", "controle"),
                               "esperado": esp, "obtido": {"decisao": r["decisao"], "codigos": r["falhas"]},
                               "acerto": acerto})
    por_cat = {}
    for x in resultados:
        if x["grupo"] != "casos":
            continue
        c = por_cat.setdefault(x["categoria"], {"n": 0, "detectados": 0})
        c["n"] += 1
        c["detectados"] += x["acerto"]
    for c in por_cat.values():
        c["recall"] = round(c["detectados"] / c["n"], 4)
    controles = [x for x in resultados if x["grupo"] == "controles_limpos"]
    n_casos = sum(c["n"] for c in por_cat.values())
    return {
        "versao_validador": vd.VERSAO,
        "n_casos": n_casos,
        "recall_total": round(sum(c["detectados"] for c in por_cat.values()) / n_casos, 4) if n_casos else None,
        "recall_por_categoria": por_cat,
        "n_controles": len(controles),
        "falso_bloqueio": sum(1 for x in controles if not x["acerto"]),
        "resultados": resultados,
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description="Bateria de casos sentinela do validador.")
    ap.add_argument("--dir", default=DIR)
    ap.add_argument("--saida")
    args = ap.parse_args(argv)
    r = rodar(args.dir)
    for x in r["resultados"]:
        if not x["acerto"]:
            print(f"ERRO {x['id']}: esperado {x['esperado']}, obtido {x['obtido']}")
    for cat, c in sorted(r["recall_por_categoria"].items()):
        print(f"{cat:16s} {c['detectados']}/{c['n']}")
    print(f"recall total {r['recall_total']:.2%} em {r['n_casos']} casos; falso bloqueio {r['falso_bloqueio']} de {r['n_controles']} controles")
    if args.saida:
        with open(args.saida, "w", encoding="utf-8") as f:
            json.dump(r, f, ensure_ascii=False, indent=1)
    return 0 if r["recall_total"] == 1 and r["falso_bloqueio"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
