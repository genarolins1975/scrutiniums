"""Compara o rastreamento das visões antes e depois do redesenho e gera a matriz visão anterior, nova localização, evidência de funcionamento.

Entrada: dois JSON de scripts/energia-visoes.mjs (antes e depois, mesmas rotas, mesma largura e níveis) e, opcionalmente, equivalencias.json
com as correspondências decididas à mão (renomeação, consolidação, mudança de rota), no formato:
  {"<rota>": [{"antes": "<tipo>|<título anterior em minúsculas>", "depois": "<tipo>|<título novo em minúsculas>" | null, "justificativa": "..."}]}
Quando "depois" é null, a visão foi retirada de propósito e a justificativa explica a equivalência (a regra do redesenho é preservar todas
as dimensões, filtros e comparações; consolidar só com equivalência registrada).

Como casa as visões, nesta ordem: (1) equivalência manual; (2) mesmo tipo e mesmo título; (3) mesmo tipo, mesmo painel (id) e título
semelhante (razão de similaridade igual ou superior a 0,6); (4) mesmo tipo e título semelhante em qualquer painel da rota. Visão sem par é
listada como "não localizada" e conta como perda a justificar. Também compara, por rota, os filtros (controles dentro de painel), os
arquivos para baixar e as fichas "Comprove este número": a contagem depois não pode ser menor que antes sem justificativa.

Uso:
  python3 scripts/energia_visoes_compara.py --antes docs/energia/redesign/dados/visoes_antes.json --depois <visoes_depois.json>
      [--equivalencias docs/energia/redesign/equivalencias.json] [--saida docs/energia/redesign/MATRIZ_PRESERVACAO.md]
"""
import argparse
import difflib
import json
import os
import re

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = "/setor-eletrico"
CONTA = ("painel", "grafico", "tabela", "tabela-recolhida", "tabela-sob-demanda", "visao-sob-demanda", "mapa", "diagrama")


def chave(v):
    return f"{v['tipo']}|{(v.get('titulo') or '').lower().strip()}"


def semelhanca(a, b):
    return difflib.SequenceMatcher(None, a, b).ratio()


def nivel(v):
    n = set(v.get("niveis", []))
    return "Entender" if "entender" in n else ("Analisar" if "analisar" in n else "Auditar")


def filtros_por_painel(visoes):
    out = {}
    for v in visoes:
        if v["tipo"] == "controle" and not (v.get("titulo") or "").lower().startswith("nível de profundidade"):
            out.setdefault(v.get("painel"), set()).add((v.get("titulo") or "").lower())
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--antes", required=True)
    ap.add_argument("--depois", required=True)
    ap.add_argument("--equivalencias")
    ap.add_argument("--saida", default=os.path.join(RAIZ, "docs", "energia", "redesign", "MATRIZ_PRESERVACAO.md"))
    ap.add_argument("--capturas-depois", default="docs/energia/redesign/capturas/depois")
    a = ap.parse_args()
    antes = {r["rota"]: r for r in json.load(open(a.antes, encoding="utf-8"))["rotas"]}
    depois = {r["rota"]: r for r in json.load(open(a.depois, encoding="utf-8"))["rotas"]}
    equiv = json.load(open(a.equivalencias, encoding="utf-8")) if a.equivalencias and os.path.exists(a.equivalencias) else {}
    L = ["# Matriz de preservação: visão anterior, nova localização, evidência de funcionamento\n"]
    perdas, total, casadas = [], 0, 0
    linhas_rotas = []
    for rota, ra in antes.items():
        rd = depois.get(rota)
        bloco = [f"\n## {rota.replace(P, '') or '/'}\n"]
        if not rd:
            bloco.append("Rota ausente no rastreamento depois.\n")
            perdas.append((rota, "rota inteira", ""))
            linhas_rotas.append("\n".join(bloco))
            continue
        va = [v for v in ra["visoes"] if v["tipo"] in CONTA]
        vd = [v for v in rd["visoes"] if v["tipo"] in CONTA]
        usados = set()
        manual = {e["antes"]: e for e in equiv.get(rota, [])}
        bloco.append("| Visão anterior | Nível antes | Nova localização | Nível depois | Como foi casada | Evidência de funcionamento |")
        bloco.append("| --- | --- | --- | --- | --- | --- |")
        for v in va:
            total += 1
            k = chave(v)
            par, como = None, ""
            if k in manual:
                e = manual[k]
                if e["depois"] is None:
                    bloco.append(f"| {v['tipo']}: {v.get('titulo', '')[:90]} | {nivel(v)} | retirada de propósito | | equivalência registrada | {e['justificativa']} |")
                    casadas += 1
                    continue
                for i, w in enumerate(vd):
                    if i not in usados and chave(w) == e["depois"]:
                        par, como = i, "equivalência manual: " + e["justificativa"]
                        break
            if par is None:
                for i, w in enumerate(vd):
                    if i not in usados and chave(w) == k:
                        par, como = i, "mesmo tipo e mesmo título"
                        break
            if par is None:
                melhor = (0.0, None)
                for i, w in enumerate(vd):
                    if i in usados or w["tipo"] != v["tipo"]:
                        continue
                    s = semelhanca((v.get("titulo") or "").lower(), (w.get("titulo") or "").lower())
                    bonus = 0.15 if v.get("painel") and v.get("painel") == w.get("painel") else 0.0
                    if s + bonus > melhor[0]:
                        melhor = (s + bonus, i)
                if melhor[1] is not None and melhor[0] >= 0.6:
                    par, como = melhor[1], f"título semelhante ({melhor[0]:.2f})"
            if par is None:
                perdas.append((rota, v["tipo"], v.get("titulo", "")))
                bloco.append(f"| {v['tipo']}: {v.get('titulo', '')[:90]} | {nivel(v)} | **não localizada** | | sem par | a justificar |")
                continue
            usados.add(par)
            w = vd[par]
            casadas += 1
            mudou = "" if nivel(v) == nivel(w) else f" (nível mudou de {nivel(v)} para {nivel(w)})"
            bloco.append(
                f"| {v['tipo']}: {v.get('titulo', '')[:90]} | {nivel(v)} | {w['tipo']}: {w.get('titulo', '')[:90]}{' em ' + w['painel'] if w.get('painel') else ''} | {nivel(w)}{mudou} | {como} | presente no HTML renderizado em 1440 px; captura em `{a.capturas_depois}/{re.sub(r'[^a-z0-9]+', '_', rota.replace(P, '').strip('/')) or 'raiz'}__1440_*.webp` |"
            )
        novas = len(vd) - len(usados)
        if novas > 0:
            bloco.append(f"\n{novas} visões novas ou desmembradas depois do redesenho (não contam como perda).")
        # filtros, arquivos e fichas por rota
        fa, fd = filtros_por_painel(ra["visoes"]), filtros_por_painel(rd["visoes"])
        sa = sum(len(s) for s in fa.values())
        sd = sum(len(s) for s in fd.values())
        ar_a = len({(v.get("href") or "").split("/")[-1] for v in ra["visoes"] if v["tipo"] == "arquivo"})
        ar_d = len({(v.get("href") or "").split("/")[-1] for v in rd["visoes"] if v["tipo"] == "arquivo"})
        co_a = sum(v.get("n", 0) for v in ra["visoes"] if v["tipo"] == "comprove")
        co_d = sum(v.get("n", 0) for v in rd["visoes"] if v["tipo"] == "comprove")
        bloco.append(f"\nFiltros distintos (controles em painel): antes {sa}, depois {sd}. Arquivos para baixar: antes {ar_a}, depois {ar_d}. Fichas Comprove este número: antes {co_a}, depois {co_d}.")
        for nome, x, y in (("filtros", sa, sd), ("arquivos", ar_a, ar_d), ("fichas Comprove", co_a, co_d)):
            if y < x:
                perdas.append((rota, nome, f"{x} antes, {y} depois"))
        linhas_rotas.append("\n".join(bloco))
    L.append(f"{casadas} de {total} visões anteriores têm correspondente ou equivalência registrada. **{len(perdas)} ocorrências a justificar** (visão sem par ou contagem menor de filtros, arquivos ou fichas).\n")
    if perdas:
        L.append("## A justificar\n")
        for rota, t, titulo in perdas:
            L.append(f"- `{rota.replace(P, '') or '/'}`: {t}. {titulo}")
    L.extend(linhas_rotas)
    open(a.saida, "w", encoding="utf-8").write("\n".join(L) + "\n")
    print(f"{casadas} de {total} casadas; {len(perdas)} a justificar → {os.path.relpath(a.saida, RAIZ)}")


if __name__ == "__main__":
    main()
