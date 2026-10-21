#!/usr/bin/env python3
"""Confere a frase de evolução ("passou de A em Y1 para B em Y2") de 286 páginas (26 capitais × 11 recortes, visão Evolução)
contra os pontos elegíveis da gold; verifica também o bloqueio por quebra de série. Uso: python3 -I compara_evolucao.py <raiz> <grade_evo.json> <saida>"""
import csv, json, re, sys
from pathlib import Path
R = Path(sys.argv[1]); ENT = Path(sys.argv[2]); SAI = Path(sys.argv[3])
G = json.load(open(R / "public/eficiencia/gold/educacao_capitais.json"))
CAPS = {c["id"]: c for c in G["universo"]["capitais"]}
OBS = {(o["indicador"], o["ente"], o["ano"], o["etapa"], o["componente"]): o for o in G["observacoes"]}
IND = {"despesa": "edu.despesa.funcao_educacao", "despesa_hab": "edu.despesa.por_habitante", "despesa_mat": "edu.despesa.aplicacao_direta_por_matricula", "atu": "edu.atu.rede_municipal",
       "matriculas": "edu.matriculas.rede_municipal", "aprovacao": "edu.aprovacao.rede_municipal", "ideb": "edu.ideb.rede_municipal", "saeb": "edu.saeb.rede_municipal"}
ANOS = {"despesa": range(2021, 2026), "despesa_hab": range(2021, 2026), "despesa_mat": range(2021, 2026), "atu": range(2021, 2026), "matriculas": range(2021, 2026), "aprovacao": range(2021, 2026), "ideb": G["periodos"]["ideb"], "saeb": G["periodos"]["ideb"]}
def num(s):
    m = re.match(r"^R?\$?\s*([\d\.]+(?:,\d+)?)\s*(mil|milhão|milhões|bilhão|bilhões)?%?$", s.strip())
    t = m.group(1); casas = len(t.split(",")[1]) if "," in t else 0
    mult = {None: 1, "mil": 1e3, "milhão": 1e6, "milhões": 1e6, "bilhão": 1e9, "bilhões": 1e9}[m.group(2)]
    return float(t.replace(".", "").replace(",", ".")) * mult, 10 ** (-casas) * mult
linhas = []; div = 0
for x in json.load(open(ENT)):
    cap = CAPS[x["cap"]]; med = x["med"]; ind = IND[med]
    comp = "real_2025" if x["moeda"] == "real" else "nominal" if med in ("despesa", "despesa_hab", "despesa_mat") else ("portugues" if med == "saeb" else "ideb" if med == "ideb" else None)
    et = None
    if med in ("atu", "aprovacao"): et = "anos_iniciais"
    if med == "matriculas": et = "total"
    if med == "ideb": et = "anos_finais"
    if med == "saeb": et = "anos_iniciais"
    pts = []
    for a in ANOS[med]:
        o = OBS.get((ind, cap["cod_ibge"], a, et, comp))
        if o and o["status"] == "OBSERVADO" and o["valor"] is not None and o["elegivel_comparacao"]:
            pts.append((a, o["valor"], bool(o.get("quebra_serie") or (o.get("conferencia") or {}).get("quebra_serie"))))
    frase = " ".join(x["frase"])
    esperado = None
    if not pts: esperado = "sem dado"
    elif len(pts) == 1: esperado = "um período"
    elif pts[0][2] != pts[-1][2]: esperado = "bloqueada"
    else: esperado = "passou"
    obtido = "passou" if "passou de" in frase else "bloqueada" if "não são diretamente comparáveis" in frase else "um período" if "um só período" in frase else "sem dado" if "Não há dado" in frase else "?"
    ok = esperado == obtido; detalhe = ""
    if ok and esperado == "passou":
        m = re.search(r"passou de (.+?) em (\d{4}) para (.+?) em (\d{4})\.", frase)
        a, y1, b, y2 = num(m.group(1)), int(m.group(2)), num(m.group(3)), int(m.group(4))
        ok = (y1 == pts[0][0] and y2 == pts[-1][0] and abs(a[0] - pts[0][1]) <= a[1] / 2 + 1e-9 and abs(b[0] - pts[-1][1]) <= b[1] / 2 + 1e-9)
        detalhe = f"{pts[0][0]}={pts[0][1]} → {pts[-1][0]}={pts[-1][1]}"
    if not ok: div += 1
    linhas.append([x["u"], esperado, obtido, "ok" if ok else "DIVERGE", detalhe])
with open(SAI / "comparacao_evolucao.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh); w.writerow(["url", "esperado", "obtido", "resultado", "detalhe"]); w.writerows(linhas)
print("páginas:", len(linhas), "divergências:", div)
for l in linhas:
    if l[3] != "ok": print(l)
