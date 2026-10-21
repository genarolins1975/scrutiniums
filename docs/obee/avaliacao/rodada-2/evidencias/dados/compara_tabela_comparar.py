#!/usr/bin/env python3
"""Confere a tabela comparativa (rota /comparar, visão Tabela completa) célula a célula contra a gold.
Entrada: JSON do coletor (grade_cmp.mjs). Saída: comparacao_tabela_comparar.csv e resumo.
Uso: python3 -I compara_tabela_comparar.py <raiz> <grade_cmp.json> <saida>"""
import csv, json, math, re, statistics, sys, unicodedata
from pathlib import Path
from urllib.parse import urlparse, parse_qs
R = Path(sys.argv[1]); ENT = Path(sys.argv[2]); SAI = Path(sys.argv[3])
G = json.load(open(R / "public/eficiencia/gold/educacao_capitais.json"))
CAPS = {c["cod_ibge"]: c for c in G["universo"]["capitais"]}
POR_NOME = {f'{c["nome"]} ({c["uf"]})': cod for cod, c in CAPS.items()}
OBS = {(o["indicador"], o["ente"], o["ano"], o["etapa"], o["componente"]): o for o in G["observacoes"]}
IDEB = G["periodos"]["ideb"]
def num(s):
    s = s.replace("R$", "").replace("%", "").strip()
    m = re.match(r"^([\d\.]+(?:,\d+)?)\s*(mil|milhão|milhões|bilhão|bilhões)?$", s)
    if not m: return None
    t = m.group(1); casas = len(t.split(",")[1]) if "," in t else 0
    mult = {None: 1, "mil": 1e3, "milhão": 1e6, "milhões": 1e6, "bilhão": 1e9, "bilhões": 1e9}[m.group(2)]
    return float(t.replace(".", "").replace(",", ".")) * mult, 10 ** (-casas) * mult
def obs(ind, cod, ano, et, comp): return OBS.get((ind, cod, ano, et, comp))
linhas = []
def cmp(url, cap, col, exibido, esperado, res=None, obs_txt=""):
    if esperado is None:
        ok = exibido is None
        linhas.append([url, cap, col, exibido, esperado, "ok" if ok else "DIVERGE", obs_txt]); return
    if exibido is None:
        linhas.append([url, cap, col, exibido, esperado, "DIVERGE", obs_txt]); return
    ev, er = exibido
    ok = abs(ev - esperado) <= er / 2 + 1e-9 * max(1, abs(esperado))
    linhas.append([url, cap, col, ev, esperado, "ok" if ok else "DIVERGE", obs_txt])
dados = json.load(open(ENT))
for pg in dados:
    url = pg["url"]; q = {k: v[0] for k, v in parse_qs(urlparse(url).query).items()}
    ano = int(q["ano"]); et = q.get("etapa", "anos_iniciais"); moeda = "real_2025" if q.get("moeda") == "real" else "nominal"; disc = q.get("disc", "matematica")
    ideb_ok = ano in IDEB
    tab = pg["tabelas"][0]; cab = tab[0]
    idx = {}
    for j, h in enumerate(cab):
        for nome in ("Despesa total na função Educação", "População residente", "Despesa por habitante", "Parcela intraorçamentária", "Matrículas na rede municipal", "Despesa por matrícula", "Conveniadas", "Alunos por turma", "Taxa de aprovação", "Ideb", "Saeb"):
            if nome in h and "Diferença" not in h.split(" | ")[0]: idx.setdefault(nome, j)
    corpo = [r for r in tab[1:] if r[0].split(" | ")[0] in POR_NOME]
    resumo = {r[0]: r for r in tab[1:] if r[0] in ("Mediana do grupo", "Média simples das capitais")}
    if len(corpo) != 26: linhas.append([url, "", "linhas", len(corpo), 26, "DIVERGE", ""])
    colvals = {k: [] for k in idx}
    for r in corpo:
        nome = r[0].split(" | ")[0]; cod = POR_NOME[nome]
        def cel(k): return r[idx[k]].split(" | ")[0]
        o = obs("edu.despesa.funcao_educacao", cod, ano, None, moeda); cmp(url, nome, "despesa", num(cel("Despesa total na função Educação")), o["valor"] if o["valor"] is not None else None)
        o = obs("ctx.populacao.residente", cod, ano, None, None); cmp(url, nome, "população", num(cel("População residente")), o["valor"])
        o = obs("edu.despesa.por_habitante", cod, ano, None, moeda); cmp(url, nome, "despesa por habitante", num(cel("Despesa por habitante")), o["valor"])
        ex = (obs("edu.despesa.funcao_educacao", cod, ano, None, "nominal").get("conferencia") or {}).get("rreo") or {}
        pct = 100 * ex["intra"] / (ex["intra"] + ex["exceto_intra"]) if ex.get("intra") is not None else None
        cmp(url, nome, "intraorçamentária %", num(cel("Parcela intraorçamentária")), pct)
        o = obs("edu.matriculas.rede_municipal", cod, ano, "total", None); cmp(url, nome, "matrículas", num(cel("Matrículas na rede municipal")), o["valor"])
        o = obs("edu.despesa.aplicacao_direta_por_matricula", cod, ano, None, moeda)
        txt = cel("Despesa por matrícula")
        if o["valor"] is None or o["status"] != "OBSERVADO":
            linhas.append([url, nome, "despesa por matrícula (sem valor)", txt, "sem valor", "ok" if txt.startswith("Sem valor") or txt.startswith("—") or "ressalva" in txt.lower() else "DIVERGE", o["status"]])
            if txt.strip() in ("R$ 0", "0"): linhas.append([url, nome, "AUSÊNCIA COMO ZERO", txt, "", "DIVERGE", ""])
        elif not o["elegivel_comparacao"]:
            linhas.append([url, nome, "despesa por matrícula (fora da comparação)", txt, o["valor"], "ok" if "Sem valor" in txt or num(txt) else "DIVERGE", ""])
        else: cmp(url, nome, "despesa por matrícula", num(txt), o["valor"])
        cv = obs("edu.matriculas.conveniadas_municipais", cod, ano, "total", None); mt = obs("edu.matriculas.rede_municipal", cod, ano, "total", None)
        cmp(url, nome, "conveniadas ÷ rede %", num(cel("Conveniadas")), 100 * cv["valor"] / mt["valor"] if cv["valor"] is not None and mt["valor"] else None)
        for col, ind, comp, ets in (("Alunos por turma", "edu.atu.rede_municipal", None, ("creche", "pre_escola", "anos_iniciais", "anos_finais")), ("Taxa de aprovação", "edu.aprovacao.rede_municipal", None, ("anos_iniciais", "anos_finais"))):
            if et not in ets: continue
            o = obs(ind, cod, ano, et, comp); txt = cel(col)
            if o["valor"] is None: linhas.append([url, nome, col, txt, "sem valor", "ok" if num(txt) is None else "DIVERGE", o["status"]])
            else: cmp(url, nome, col, num(txt), o["valor"])
        for col, ind, comp in (("Ideb", "edu.ideb.rede_municipal", "ideb"), ("Saeb", "edu.saeb.rede_municipal", disc)):
            if et not in ("anos_iniciais", "anos_finais"): continue
            txt = cel(col)
            if not ideb_ok:
                linhas.append([url, nome, col + " (ano sem edição)", txt, "sem valor", "ok" if num(txt) is None else "DIVERGE", ""])
            else:
                o = obs(ind, cod, ano, et, comp)
                if o["valor"] is None: linhas.append([url, nome, col, txt, "sem valor", "ok" if num(txt) is None else "DIVERGE", o["status"]])
                else: cmp(url, nome, col, num(txt), o["valor"])
    # linhas de resumo: mediana/média das elegíveis
    def elegiveis(ind, comp, et_, filt=None):
        v = []
        for cod in CAPS:
            o = obs(ind, cod, ano, et_, comp)
            if o and o["status"] == "OBSERVADO" and o["valor"] is not None and o["elegivel_comparacao"]: v.append(o["valor"])
        return v
    for col, args in (("Despesa total na função Educação", ("edu.despesa.funcao_educacao", moeda, None)), ("População residente", ("ctx.populacao.residente", None, None)),
                      ("Despesa por habitante", ("edu.despesa.por_habitante", moeda, None)), ("Matrículas na rede municipal", ("edu.matriculas.rede_municipal", None, "total")),
                      ("Despesa por matrícula", ("edu.despesa.aplicacao_direta_por_matricula", moeda, None))):
        v = elegiveis(args[0], args[1], args[2])
        cmp(url, "Mediana do grupo", col, num(resumo["Mediana do grupo"][idx[col]]), statistics.median(v))
        cmp(url, "Média simples das capitais", col, num(resumo["Média simples das capitais"][idx[col]]), statistics.mean(v))
    if et in ("creche", "pre_escola", "anos_iniciais", "anos_finais"):
        v = elegiveis("edu.atu.rede_municipal", None, et)
        exib = num(resumo["Mediana do grupo"][idx["Alunos por turma"]])
        if exib is None and et in ("creche", "pre_escola"):
            linhas.append([url, "Mediana do grupo", "Alunos por turma", resumo["Mediana do grupo"][idx["Alunos por turma"]], statistics.median(v), "DEFEITO: resumo ausente embora as 26 linhas tenham valor", "TabelaComparativa.tsx: sem = porEtapa && resultadoSemEscopo"])
        else: cmp(url, "Mediana do grupo", "Alunos por turma", exib, statistics.median(v))
    if et in ("anos_iniciais", "anos_finais"):
        v = elegiveis("edu.aprovacao.rede_municipal", None, et); cmp(url, "Mediana do grupo", "Taxa de aprovação", num(resumo["Mediana do grupo"][idx["Taxa de aprovação"]]), statistics.median(v))
        if ideb_ok:
            v = elegiveis("edu.ideb.rede_municipal", "ideb", et); cmp(url, "Mediana do grupo", "Ideb", num(resumo["Mediana do grupo"][idx["Ideb"]]), statistics.median(v))
            v = elegiveis("edu.saeb.rede_municipal", disc, et); cmp(url, "Mediana do grupo", "Saeb", num(resumo["Mediana do grupo"][idx["Saeb"]]), statistics.median(v))
with open(SAI / "comparacao_tabela_comparar.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh); w.writerow(["url", "linha", "coluna", "exibido", "recalculado", "resultado", "observacao"]); w.writerows(linhas)
div = [l for l in linhas if l[5] != "ok"]
print("células conferidas:", len(linhas), "páginas:", len(dados), "divergências:", len(div))
for l in div[:40]: print(l)
