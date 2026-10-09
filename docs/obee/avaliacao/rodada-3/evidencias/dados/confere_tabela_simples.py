#!/usr/bin/env python3
"""Confere a visão Tabela dos exploradores (Capital, valor, situação) contra o recálculo e contra o CSV baixado do mesmo recorte.
Uso: python3 -I confere_tabela_simples.py <jsonl>"""
import csv, io, json, sys, collections
sys.path.insert(0, "/home/user/scrutiniums/docs/obee/avaliacao/rodada-3/evidencias/dados")
import esperado as E
ROT = {"NAO_APLICAVEL": "Não aplicável", "NAO_DIVULGADO": "Não divulgado pela fonte", "AUSENTE_NA_COLETA": "Ausente na coleta", "NAO_COMPARAVEL": "Fora da comparação", "INCOMPLETO": "Incompleto", "INCONSISTENTE": "Inconsistente"}
res = []
for l in open(sys.argv[1]):
    r = json.loads(l); i = r["id"]
    _, tema, m, ano, et_ = i.split("|")[:5]
    ano = int(ano)
    ent = r["url"]
    disc = "portugues" if "disc=portugues" in ent else "matematica"
    cap = ""
    et = None if tema == "G" else (et_ or None)
    t = r["tabelas"][0]
    exp = []
    c = E.comparacao(m, ano, et, "nominal", disc)
    for cc in E.CAPS:
        o = E.ponto(m, cc["cod_ibge"], ano, et, "nominal", disc)
        nome = f"{cc['nome']} ({cc['uf']})"
        if o and o["status"] == "OBSERVADO" and o["valor"] is not None and o["elegivel_comparacao"]:
            exp.append((nome, E.fmt(m, o["valor"]), "Incluída, com nota" if o["nota"] else "Incluída"))
        elif o and o["status"] == "OBSERVADO" and o["valor"] is not None:
            exp.append((nome, E.fmt(m, o["valor"]), "Fora da comparação"))
        else:
            exp.append((nome, "", ROT.get(o["status"], o["status"]) if o else "Ausente na coleta"))
    got = [tuple(x) for x in t["linhas"]]
    ok_set = sorted(got) == sorted(exp)
    res.append((i, "tabela_linhas", len(got), len(exp), "ok" if ok_set else "DIVERGE"))
    if not ok_set:
        for a, b in zip(sorted(got), sorted(exp)):
            if a != b: res.append((i, "linha", a, b, "DIVERGE")); break
    # CSV
    cs = r.get("csvs") or {}
    c0 = next((v for v in cs.values() if v), None)
    if c0:
        rows = list(csv.DictReader(io.StringIO(c0["conteudo"].lstrip("﻿")), delimiter=";"))
        porcap = {f"{x['capital']} ({x['uf']})": x for x in rows}
        bad = 0
        for nome, v, sit in got:
            x = porcap.get(nome)
            if x is None: bad += 1; continue
            if v != x["valor_exibido"]: bad += 1
            if (sit.startswith("Incluída")) != (x["incluida_na_comparacao"] == "sim"): bad += 1
        res.append((i, "tabela_x_csv", bad, 0, "ok" if bad == 0 else "DIVERGE"))
cn = collections.Counter(x[-1] for x in res)
print("tabelas:", len({x[0] for x in res}), "checagens:", len(res), dict(cn))
for x in res:
    if x[-1] != "ok": print(x)
w = csv.writer(open("/home/user/scrutiniums/docs/obee/avaliacao/rodada-3/evidencias/dados/resultado_tabela_simples.csv", "w", newline="")); w.writerow(["id", "campo", "exibido", "esperado", "resultado"]); w.writerows(res)
