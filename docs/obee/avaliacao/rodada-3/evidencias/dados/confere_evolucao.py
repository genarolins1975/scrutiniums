#!/usr/bin/env python3
"""Confere a visão Evolução de Gastos (frase, tabela da série e CSV da série) contra o recálculo próprio.
Uso: python3 -I confere_evolucao.py <jsonl> <prefixo>"""
import csv, io, json, sys, collections, re, statistics
sys.path.insert(0, "/home/user/scrutiniums/docs/obee/avaliacao/rodada-3/evidencias/dados")
import esperado as E

ent, prefixo = sys.argv[1], sys.argv[2]
res = []
SUJ = {"despesa": "a despesa total em Educação", "despesa_hab": "a despesa em Educação por habitante", "despesa_mat": "a razão da despesa de aplicação direta por matrícula"}


def reg(i, campo, exib, esp, ok=None):
    ok = (exib == esp) if ok is None else ok
    res.append((i, campo, exib, esp, "ok" if ok else "DIVERGE"))


def qb(o):
    return bool(o.get("quebra_serie") or ((o.get("conferencia") or {}).get("quebra_serie")))


for linha in open(ent):
    r = json.loads(linha)
    i = r["id"]
    _, m, moeda, cap_id = i.split("|")
    cap = E.CAP_POR_ID.get(cap_id)
    if r.get("erro"): reg(i, "carregamento", r["erro"], "ok", False); continue
    if r["console"]: reg(i, "console", "; ".join(r["console"])[:120], "sem erros", False)
    comp = "real_2025" if moeda == "real" else "nominal"
    ind = E.MEDIDA[m][0]
    pts = []  # (ano, valor, elegivel, quebra)
    for ano in E.ANOS[m]:
        if cap:
            o = E.IDX.get((ind, cap["cod_ibge"], ano, None, comp))
            ok = o and o["status"] == "OBSERVADO" and o["valor"] is not None
            pts.append((ano, o["valor"] if ok else None, bool(ok and o["elegivel_comparacao"]), qb(o) if ok else False, o["status"] if o else "AUSENTE"))
        else:
            c = E.comparacao(m, ano, None, moeda if moeda == "real" else "nominal", "matematica", None)
            st = c["st"]
            marc = sum(1 for cc in E.CAPS if (E.IDX.get((ind, cc["cod_ibge"], ano, None, comp)) or {}).get("quebra_serie") or ((E.IDX.get((ind, cc["cod_ibge"], ano, None, comp)) or {}).get("conferencia") or {}).get("quebra_serie"))
            pts.append((ano, st["mediana"] if st else None, bool(st), marc > len(E.CAPS) / 2, "OBSERVADO" if st else "AUSENTE"))
    val = [p for p in pts if p[1] is not None and p[2]]
    h = next((x["t"] for x in r["h"] if x["id"] == "visao-titulo"), "")
    onde = f"Em {cap['nome']} ({cap['uf']})" if cap else "Na mediana das capitais"
    if not val: esp = "Não há dado comparável para mostrar a evolução neste recorte."
    elif len(val) == 1: esp = f"Há dado comparável em um só período ({val[0][0]}: {E.fmt(m, val[0][1])})."
    else:
        a, b2 = val[0], val[-1]
        if a[3] != b2[3]:
            esp = f"Entre {a[0]} e {b2[0]} a população de referência muda de base (estimativa, Censo ou relação do DOU): os valores de {a[0]} e de {b2[0]} não são diretamente comparáveis, e o gráfico marca onde a base muda." if m == "despesa_hab" else f"Entre {a[0]} e {b2[0]} a base do dado mudou: os valores de {a[0]} e de {b2[0]} não são diretamente comparáveis, e o gráfico marca onde a base muda."
        else:
            f = f"{onde}, {SUJ[m]} passou de {E.fmt(m, a[1])} em {a[0]} para {E.fmt(m, b2[1])} em {b2[0]}."
            depois = [p for p in pts if p[0] > b2[0]]
            lac = "" if not depois else (f" Sem valor comparável em {depois[0][0]}." if len(depois) == 1 else f" Sem valor comparável de {depois[0][0]} a {depois[-1][0]}.")
            esp = f + lac
    reg(i, "frase_evolucao", h, esp)
    # tabela da série (em <details>)
    t = next((x for x in r["tabelas"] if x["cab"][:1] == ["Ano"]), None)
    if t:
        for p, lin in zip(pts, t["linhas"]):
            exp_v = E.fmt(m, p[1]) if p[1] is not None else ""
            reg(i, f"tabela_serie_{p[0]}", lin[1], exp_v)
    else:
        reg(i, "tabela_serie", "(ausente)", "tabela", False)
    # CSV da série
    cs = r.get("csvs") or {}
    c0 = next(iter(cs.values()), None)
    if not c0: reg(i, "csv_serie", "(não baixado)", "arquivo", False); continue
    rows = list(csv.DictReader(io.StringIO(c0["conteudo"].lstrip("﻿")), delimiter=";"))
    reg(i, "csv_linhas", len(rows), len(E.ANOS[m]))
    for p, row in zip(pts, rows):
        reg(i, f"csv_ano_{p[0]}", row["ano"], str(p[0]))
        vc = float(row["valor_numerico"]) if row["valor_numerico"] != "" else None
        ok = (vc is None and p[1] is None) or (vc is not None and p[1] is not None and abs(vc - p[1]) <= 1e-9 * max(1, abs(p[1])) + (1e-6 * abs(p[1]) if abs(p[1]) > 1e9 else 0))
        reg(i, f"csv_valor_{p[0]}", vc, p[1], ok)
        if cap:
            reg(i, f"csv_mudanca_base_{p[0]}", row["mudanca_de_base"], "sim" if p[3] else "nao")
            if p[1] is not None:
                reg(i, f"csv_elegivel_{p[0]}", row["elegivel_comparacao"], "sim" if p[2] else "nao")
        # mediana ao lado da série
        if cap:
            c = E.comparacao(m, p[0], None, moeda if moeda == "real" else "nominal", "matematica", None)
            md = c["st"]["mediana"] if c["st"] else None
            vm = float(row["mediana_das_capitais"]) if row["mediana_das_capitais"] != "" else None
            reg(i, f"csv_mediana_{p[0]}", vm, md, (vm is None and md is None) or (vm is not None and md is not None and abs(vm - md) <= 1e-6 * max(1, abs(md))))
            reg(i, f"csv_n_mediana_{p[0]}", row["capitais_na_mediana"], str(c["st"]["n"]) if c["st"] else "0")
with open(f"{prefixo}_resultado.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["id", "campo", "exibido", "esperado", "resultado"]); w.writerows(res)
c = collections.Counter(x[-1] for x in res)
print("checagens:", len(res), dict(c))
for x in [x for x in res if x[-1] != "ok"][:25]: print(x)
