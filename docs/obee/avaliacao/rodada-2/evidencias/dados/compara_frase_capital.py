#!/usr/bin/env python3
"""Confere a frase da capital escolhida ("X (UF) registra V; a mediana das N capitais é M (D acima/abaixo)") em 260 páginas contra a gold.
A diferença escrita deve ser a dos valores como aparecem na tela (arredondados), exceto o total da despesa, que usa a diferença exata.
Uso: python3 -I compara_frase_capital.py <raiz> <grade_cap.json> <saida>"""
import csv, json, re, statistics, sys
from pathlib import Path
from urllib.parse import urlparse, parse_qs
R = Path(sys.argv[1]); ENT = Path(sys.argv[2]); SAI = Path(sys.argv[3])
G = json.load(open(R / "public/eficiencia/gold/educacao_capitais.json"))
CAPS = {c["id"]: c for c in G["universo"]["capitais"]}
OBS = {(o["indicador"], o["ente"], o["ano"], o["etapa"], o["componente"]): o for o in G["observacoes"]}
IND = {"despesa": ("edu.despesa.funcao_educacao", 0), "despesa_hab": ("edu.despesa.por_habitante", 0), "despesa_mat": ("edu.despesa.aplicacao_direta_por_matricula", 0), "atu": ("edu.atu.rede_municipal", 1), "matriculas": ("edu.matriculas.rede_municipal", 0),
       "conveniadas": ("edu.matriculas.conveniadas_municipais", 0), "aprovacao": ("edu.aprovacao.rede_municipal", 1), "ideb": ("edu.ideb.rede_municipal", 1), "saeb": ("edu.saeb.rede_municipal", 2)}
def num(s):
    s = s.replace("R$", "").replace("%", "").replace("matrículas", "").replace("alunos", "").replace("aluno", "").replace("por turma", "").replace("pontos percentuais", "").replace("ponto percentual", "").replace("pontos", "").replace("ponto", "").strip()
    m = re.match(r"^([\d\.]+(?:,\d+)?)\s*(mil|milhão|milhões|bilhão|bilhões)?$", s)
    t = m.group(1); mult = {None: 1, "mil": 1e3, "milhão": 1e6, "milhões": 1e6, "bilhão": 1e9, "bilhões": 1e9}[m.group(2)]
    return float(t.replace(".", "").replace(",", ".")) * mult, (10 ** -(len(t.split(",")[1])) if "," in t else 1) * mult
def arred(v, c): return round(v * 10 ** c + (1e-9 if v >= 0 else -1e-9)) / 10 ** c
linhas = []; div = 0
for pg in json.load(open(ENT)):
    q = {k: v[0] for k, v in parse_qs(urlparse(pg["u"]).query).items()}
    med = q["med"]; ind, casas = IND[med]; ano = int(q["ano"]); et = q.get("etapa") if med in ("matriculas", "conveniadas", "atu", "aprovacao", "ideb", "saeb") else None
    comp = "nominal" if med.startswith("despesa") else ("ideb" if med == "ideb" else q.get("disc", "matematica") if med == "saeb" else None)
    cap = CAPS[pg["cap"]]; o = OBS[(ind, cap["cod_ibge"], ano, et, comp)]
    v = [OBS[(ind, c["cod_ibge"], ano, et, comp)]["valor"] for c in CAPS.values() if OBS[(ind, c["cod_ibge"], ano, et, comp)]["status"] == "OBSERVADO" and OBS[(ind, c["cod_ibge"], ano, et, comp)]["elegivel_comparacao"]]
    mediana = statistics.median(v); n = len(v)
    f = " ".join(pg["frase"]); ok = True; detalhe = ""
    if o["valor"] is None or o["status"] != "OBSERVADO":
        ok = "não tem valor observado" in f; detalhe = o["status"]
    elif not o["elegivel_comparacao"]:
        ok = "fora da comparação entre capitais" in f; detalhe = "valor oficial fora da comparação"
    else:
        m = re.search(r"registra (.+?); a mediana das (\d+) capitais é (.+?)(?: \((.+?) (acima|abaixo)\)| \(igual à mediana\))?\.$", f)
        if not m: ok = False; detalhe = "frase não reconhecida: " + f[:120]
        else:
            vv, nn, mm = num(m.group(1)), int(m.group(2)), num(m.group(3))
            if abs(vv[0] - o["valor"]) > vv[1] / 2 + 1e-9 * abs(o["valor"]): ok = False; detalhe += " valor;"
            if abs(mm[0] - mediana) > mm[1] / 2 + 1e-9 * abs(mediana): ok = False; detalhe += " mediana;"
            if nn != n: ok = False; detalhe += " n;"
            if m.group(4):
                d = num(m.group(4))
                esperado_abs = abs(o["valor"] - mediana) if med == "despesa" else abs(arred(o["valor"], casas) - arred(mediana, casas))
                sentido = "acima" if o["valor"] > mediana else "abaixo"
                if sentido != m.group(5) and esperado_abs > 0: ok = False; detalhe += " sentido;"
                if abs(d[0] - esperado_abs) > d[1] / 2 + 1e-6: ok = False; detalhe += f" diferença({d[0]} x {esperado_abs});"
            else:
                if arred(o["valor"], casas) != arred(mediana, casas) and med != "despesa": ok = False; detalhe += " igual?;"
    if not ok: div += 1
    linhas.append([pg["u"], "ok" if ok else "DIVERGE", detalhe, f[:200]])
with open(SAI / "comparacao_frase_capital.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh); w.writerow(["url", "resultado", "detalhe", "frase"]); w.writerows(linhas)
print("páginas:", len(linhas), "divergências:", div)
for l in linhas:
    if l[1] != "ok": print(l)
