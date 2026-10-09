"""Compara o rastreamento das visões antes e depois do redesenho e gera a matriz visão anterior, nova localização, evidência de funcionamento.

Entrada: dois JSON de scripts/energia-visoes.mjs (antes e depois, mesmas rotas, mesma largura e níveis) e, opcionalmente, equivalencias.json
com as correspondências decididas à mão (renomeação, consolidação, mudança de rota), no formato:
  {"<rota>": [{"antes": "<tipo>|<título anterior em minúsculas>", "depois": "<tipo>|<título novo em minúsculas>" | null, "justificativa": "..."}]}
Quando "depois" é null, a visão foi retirada de propósito e a justificativa explica a equivalência (a regra do redesenho é preservar todas
as dimensões, filtros e comparações; consolidar só com equivalência registrada).

Como casa as visões, nesta ordem: (1) equivalência manual; (2) mesmo tipo e mesmo título; (3) mesmo tipo, mesmo painel (id) e título
semelhante (razão de similaridade igual ou superior a 0,6); (4) mesmo tipo e título semelhante em qualquer painel da rota. Visão sem par é
listada como "não localizada" e conta como perda a justificar. Também compara, por rota, os filtros (cada controle fora a barra de
profundidade, pelo título e pelas opções sem a contagem de linhas), os arquivos para baixar (pelo nome do arquivo) e as fichas "Comprove
este número" (soma por nível de profundidade): o que existia antes tem de existir depois, e o que falta entra em "A justificar". Os ids
de painel não entram na comparação, porque o redesenho reparte um painel em vários.

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


def sem_contagem(opcao):
    return re.sub(r"\s*\d+ linhas?$", "", opcao or "").strip().lower()


def titulo_controle(v):
    t = re.sub(r"^(início|fim):.*$", r"\1", (v.get("titulo") or "").lower().strip())
    if v.get("campo", "").startswith("select") and not v.get("opcoes") and len(t) > 55:
        # coletas antigas gravaram o rótulo junto com as opções da seleção: o começo identifica o controle
        t = t[:6]
    return re.sub(r"\s*\((sin|[a-z ]+):[^)]*\)$", "", t)


def controles(visoes):
    """lista de controles (a barra de profundidade fica fora): título normalizado, tipo de campo e opções sem a contagem de linhas."""
    out = []
    for v in visoes:
        if v["tipo"] != "controle" or (v.get("titulo") or "").lower().startswith("nível de profundidade"):
            continue
        out.append({"t": titulo_controle(v), "campo": v.get("campo", "").split(":")[0], "op": {sem_contagem(o) for o in v.get("opcoes", [])}})
    return out


def controles_sem_par(antes, depois):
    """(controles que existiam e não têm correspondente, opções que sumiram de controle com o mesmo título).

    Um controle anterior tem correspondente se existe depois um de mesmo título, ou com as mesmas opções (renomeado), ou, sem opções
    (campo de texto, seleção, deslizador), de título parecido (razão de similaridade igual ou superior a 0,6) e mesmo tipo de campo.
    """
    ops_antes, campo_antes = {}, {}
    for c in antes:
        ops_antes.setdefault(c["t"], set()).update(c["op"])
        campo_antes[c["t"]] = c["campo"]
    ops_depois = {}
    for c in depois:
        ops_depois.setdefault(c["t"], set()).update(c["op"])
    todas = set().union(*[c["op"] for c in depois]) if depois else set()
    faltam, faltam_op = [], []
    for t, ops in sorted(ops_antes.items()):
        if t in ops_depois:
            sumiram = (ops - ops_depois[t]) - todas
            if sumiram:
                faltam_op.append((t, sorted(sumiram)))
            continue
        if ops and any(ops <= c["op"] for c in depois):
            continue
        if not ops and any(c["campo"] == campo_antes[t] and not c["op"] and (c["t"].startswith(t) or semelhanca(t, c["t"]) >= 0.6) for c in depois):
            continue
        faltam.append(t)
    return faltam, faltam_op


def arquivos(visoes):
    return {(v.get("href") or "").split("/")[-1] for v in visoes if v["tipo"] == "arquivo"}


def fichas_por_nivel(visoes):
    out = {"entender": 0, "analisar": 0, "auditar": 0}
    for v in visoes:
        if v["tipo"] == "comprove":
            for n in v.get("niveis", []):
                if n in out:
                    out[n] += v.get("n", 0)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--antes", required=True)
    ap.add_argument("--depois", required=True)
    ap.add_argument("--equivalencias")
    ap.add_argument("--saida", default=os.path.join(RAIZ, "docs", "energia", "redesign", "MATRIZ_PRESERVACAO.md"))
    ap.add_argument("--capturas-depois", default="docs/energia/redesign/capturas/depois")
    ap.add_argument("--ignorar-ausentes", action="store_true", help="rodada parcial: rotas que ainda não foram coletadas depois não entram")
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
        if not rd and a.ignorar_ausentes:
            continue
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
                    # consolidação: duas visões anteriores com a mesma visão depois (a segunda não consome a visão nova)
                    for i, w in enumerate(vd):
                        if chave(w) == e["depois"]:
                            usados.add(i)
                            par, como = i, "equivalência manual (consolidada em visão já casada): " + e["justificativa"]
                            break
            if par is None:
                for i, w in enumerate(vd):
                    if i not in usados and chave(w) == k:
                        par, como = i, "mesmo tipo e mesmo título"
                        break
            if par is None and v["tipo"] == "painel":
                # o redesenho põe a pergunta no título da página e dá ao painel o título da primeira figura: o id do painel segue o mesmo
                h1 = ((rd.get("modos", {}).get("entender") or {}).get("h1") or "").lower().strip()
                for i, w in enumerate(vd):
                    if i in usados or w["tipo"] != "painel":
                        continue
                    if v.get("id") and v.get("id") == w.get("id"):
                        par, como = i, "mesmo painel (id " + str(w.get("id")) + "), título renomeado" + (" e a pergunta passou a ser o título da página" if (v.get("titulo") or "").lower().strip() == h1 else "")
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
        ca, cd = controles(ra["visoes"]), controles(rd["visoes"])
        faltam_ctrl, faltam_opc_l = controles_sem_par(ca, cd)
        faltam_opc = [f"{t}: {', '.join(o)}" for t, o in faltam_opc_l]
        fa_arq, fd_arq = arquivos(ra["visoes"]), arquivos(rd["visoes"])
        faltam_arq = sorted(fa_arq - fd_arq)
        co_a, co_d = fichas_por_nivel(ra["visoes"]), fichas_por_nivel(rd["visoes"])
        bloco.append(
            f"\nControles: antes {len(ca)}, depois {len(cd)}. Arquivos para baixar: antes {len(fa_arq)}, depois {len(fd_arq)}. "
            f"Fichas Comprove este número por nível (Entender, Analisar, Auditar): antes {co_a['entender']}, {co_a['analisar']}, {co_a['auditar']}; "
            f"depois {co_d['entender']}, {co_d['analisar']}, {co_d['auditar']}."
        )
        just = {e["antes"]: e["justificativa"] for e in equiv.get(rota, []) if e["antes"].startswith(("controle|", "arquivo|", "comprove|"))}
        for t in faltam_ctrl:
            if f"controle|{t}" in just:
                bloco.append(f"- Controle `{t}` retirado de propósito: {just['controle|' + t]}")
            else:
                perdas.append((rota, "controle ausente depois", t))
        for t in faltam_opc:
            nome = t.split(":")[0]
            if f"controle|{nome}" in just:
                bloco.append(f"- Opções de `{nome}` mudaram de propósito: {just['controle|' + nome]}")
            else:
                perdas.append((rota, "opção de controle ausente depois", t))
        for f in faltam_arq:
            if f"arquivo|{f}" in just:
                bloco.append(f"- Arquivo `{f}` retirado de propósito: {just['arquivo|' + f]}")
            else:
                perdas.append((rota, "arquivo para baixar ausente depois", f))
        for n in ("entender", "analisar", "auditar"):
            if co_d[n] < co_a[n]:
                if f"comprove|{n}" in just:
                    bloco.append(f"- Fichas Comprove em {n.capitalize()}: {co_a[n]} antes, {co_d[n]} depois. {just['comprove|' + n]}")
                else:
                    perdas.append((rota, f"fichas Comprove em {n.capitalize()}", f"{co_a[n]} antes, {co_d[n]} depois"))
        linhas_rotas.append("\n".join(bloco))
    L.append(f"{casadas} de {total} visões anteriores têm correspondente ou equivalência registrada. **{len(perdas)} ocorrências a justificar** (visão sem par, controle, opção, arquivo ou ficha que existia antes e não existe depois).\n")
    if perdas:
        L.append("## A justificar\n")
        for rota, t, titulo in perdas:
            L.append(f"- `{rota.replace(P, '') or '/'}`: {t}. {titulo}")
    L.extend(linhas_rotas)
    open(a.saida, "w", encoding="utf-8").write("\n".join(L) + "\n")
    print(f"{casadas} de {total} casadas; {len(perdas)} a justificar → {os.path.relpath(a.saida, RAIZ)}")


if __name__ == "__main__":
    main()
