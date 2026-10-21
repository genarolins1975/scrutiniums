#!/usr/bin/env python3
"""Recálculo independente (avaliador de dados e método, rodada 2).

Lê a gold (public/eficiencia/gold/educacao_capitais.json) e os arquivos do seed
(pipeline/eficiencia/seed), sem importar nada de pipeline/eficiencia, e recalcula com lógica própria:
  R1 despesa liquidada função 12 (nominal) a partir da DCA gravada no seed
  R2 população (seed IBGE)
  R3 despesa por habitante nominal e real (2025) a partir da gold e do IPCA do seed
  R4 fatores IPCA a partir do número-índice do seed
  R5 matrículas (Censo Escolar do seed), total e por etapa, rede municipal e conveniadas
  R6 despesa de aplicação direta por matrícula (numerador da gold / matrículas recalculadas)
  R7 ATU, aprovação, Ideb, Saeb a partir dos CSV do INEP no seed
  R8 estatísticas de grupo (média, mediana, mín., máx., quartis tipo 7, razão agregada) refeitas das observações elegíveis
Saída: CSV em evidencias/dados/recalculo_gold.csv e resumo no stdout.
Uso: python3 -I recalculo_gold.py <raiz do repositório> <pasta de saída>
"""
import csv, gzip, io, json, math, statistics, sys
from collections import defaultdict
from pathlib import Path

RAIZ = Path(sys.argv[1]); SAIDA = Path(sys.argv[2])
G = json.load(open(RAIZ / "public/eficiencia/gold/educacao_capitais.json"))
SEED = RAIZ / "pipeline/eficiencia/seed"
CAPS = {c["cod_ibge"]: c for c in G["universo"]["capitais"]}
OBS = G["observacoes"]
ix = {}
for o in OBS:
    ix[(o["indicador"], o["ente"], o["ano"], o["etapa"], o["componente"])] = o

linhas = []  # (bloco, indicador, capital, ano, etapa, componente, gold, recalculado, fonte)

def reg(bloco, ind, cod, ano, etapa, comp, gold, rec, fonte):
    linhas.append([bloco, ind, CAPS[cod]["nome"] if cod in CAPS else cod, ano, etapa or "", comp or "", gold, rec, fonte])

def jgz(p): return json.load(gzip.open(p, "rt", encoding="utf-8"))
def cgz(p): return list(csv.DictReader(io.StringIO(gzip.open(p, "rt", encoding="utf-8").read())))

# ---- R1 DCA
for cod in CAPS:
    for ano in range(2021, 2026):
        d = jgz(SEED / f"siconfi/dca_anexo_i_e/{cod}_{ano}.json.gz")
        v = [r["valor"] for r in d if r["conta"] == "12 - Educação" and r["coluna"] == "Despesas Liquidadas" and r["rotulo"] == "Total Geral da Despesa por Função"]
        rec = v[0] if len(v) == 1 else None
        o = ix.get(("edu.despesa.funcao_educacao", cod, ano, None, "nominal"))
        reg("R1", "edu.despesa.funcao_educacao", cod, ano, None, "nominal", o["valor"], rec, "seed DCA Anexo I-E, 12 - Educação, Despesas Liquidadas")

# ---- R2 população
pop = {}
for r in jgz(SEED / "ibge_populacao/populacao_capitais.json.gz"):
    pop[(r["cod"], r["ano"])] = r["valor"]
for r in jgz(SEED / "ibge_populacao/relacao_2023_capitais.json.gz"):
    pop[(r["cod"], 2023)] = r["valor"]
for cod in CAPS:
    for ano in range(2021, 2026):
        o = ix[("ctx.populacao.residente", cod, ano, None, None)]
        reg("R2", "ctx.populacao.residente", cod, ano, None, None, o["valor"], pop.get((cod, ano)), "seed IBGE (SIDRA 6579/4714; relação 2023)")

# ---- R4 IPCA
ip = jgz(SEED / "ibge_ipca/ipca_numero_indice_2021_2025.json.gz")
serie = ip[0]["resultados"][0]["series"][0]["serie"]
media = {a: statistics.mean(float(v) for k, v in serie.items() if k.startswith(str(a))) for a in range(2021, 2026)}
fator = {a: media[2025] / media[a] for a in media}
for a in range(2021, 2026):
    reg("R4", "ipca.fator_para_2025", 0, a, None, None, G["ipca"]["fatores_para_2025"][str(a)], fator[a], "seed IBGE IPCA tabela 1737 v.2266 (média 12 meses)")
    # os nomes de capital não se aplicam
for l in linhas:
    if l[0] == "R4": l[2] = "Brasil"

# ---- R3 por habitante e real
for cod in CAPS:
    for ano in range(2021, 2026):
        n = ix[("edu.despesa.funcao_educacao", cod, ano, None, "nominal")]["valor"]
        nr = ix[("edu.despesa.funcao_educacao", cod, ano, None, "real_2025")]["valor"]
        p = ix[("ctx.populacao.residente", cod, ano, None, None)]["valor"]
        ph = ix[("edu.despesa.por_habitante", cod, ano, None, "nominal")]["valor"]
        phr = ix[("edu.despesa.por_habitante", cod, ano, None, "real_2025")]["valor"]
        reg("R3", "edu.despesa.funcao_educacao", cod, ano, None, "real_2025", nr, n * fator[ano], "gold nominal × fator IPCA recalculado")
        reg("R3", "edu.despesa.por_habitante", cod, ano, None, "nominal", ph, n / p, "DCA liquidada ÷ população (gold)")
        reg("R3", "edu.despesa.por_habitante", cod, ano, None, "real_2025", phr, n * fator[ano] / p, "DCA liquidada × fator ÷ população (gold)")

# ---- R5 matrículas
ETAPAS = {"creche": "QT_MAT_INF_CRE", "pre_escola": "QT_MAT_INF_PRE", "anos_iniciais": "QT_MAT_FUND_AI", "anos_finais": "QT_MAT_FUND_AF", "ensino_medio": "QT_MAT_MED", "eja": "QT_MAT_EJA"}
mat = {}
conv = {}
for ano in range(2021, 2026):
    rows = cgz(SEED / f"inep_censo/escolas_capitais_{ano}.csv.gz")
    for cod in CAPS:
        rs = [r for r in rows if int(r["CO_MUNICIPIO"]) == cod]
        def soma(filtro, col):
            return sum(int(r[col] or 0) for r in rs if filtro(r))
        mun = lambda r: r["TP_DEPENDENCIA"] == "3"
        cv = lambda r: r["TP_DEPENDENCIA"] == "4" and r["IN_PODER_PUBLICO_PARCERIA"] == "1" and r["TP_PODER_PUBLICO_PARCERIA"] == "1"
        for nome, f, destino, ind in (("mun", mun, mat, "edu.matriculas.rede_municipal"), ("conv", cv, conv, "edu.matriculas.conveniadas_municipais")):
            tot = soma(f, "QT_MAT_BAS")
            destino[(cod, ano)] = tot
            reg("R5", ind, cod, ano, "total", None, ix[(ind, cod, ano, "total", None)]["valor"], tot, "seed Censo Escolar, ΣQT_MAT_BAS")
            acum = 0
            for e, col in ETAPAS.items():
                v = soma(f, col); acum += v
                reg("R5", ind, cod, ano, e, None, ix[(ind, cod, ano, e, None)]["valor"], v, f"seed Censo Escolar, Σ{col}")
            reg("R5", ind, cod, ano, "profissional", None, ix[(ind, cod, ano, "profissional", None)]["valor"], tot - acum, "seed Censo Escolar, QT_MAT_BAS − Σ etapas")

# ---- R6 despesa por matrícula
for cod in CAPS:
    for ano in range(2021, 2026):
        for comp in ("nominal", "real_2025"):
            o = ix[("edu.despesa.aplicacao_direta_por_matricula", cod, ano, None, comp)]
            c = o.get("calculo") or {}
            num, den = c.get("numerador"), c.get("denominador")
            rec = (num / mat[(cod, ano)]) if (num is not None and mat[(cod, ano)]) else None
            reg("R6", "edu.despesa.aplicacao_direta_por_matricula", cod, ano, None, comp, o["valor"], rec, "numerador da gold ÷ matrículas recalculadas do Censo (denominador da gold=%s)" % den)

# ---- R7 INEP
def f(x):
    x = (x or "").strip()
    if x in ("", "--", "-", "ND", "*", "ND*", "ND**"): return None
    return float(x.replace(",", "."))
ATU = {"creche": "CRE_CAT_0", "pre_escola": "PRE_CAT_0", "anos_iniciais": "FUN_AI_CAT_0", "anos_finais": "FUN_AF_CAT_0"}
for ano in range(2021, 2026):
    rows = cgz(SEED / f"inep_atu/atu_capitais_{ano}.csv.gz")
    for cod in CAPS:
        rs = [r for r in rows if int(r["CO_MUNICIPIO"]) == cod and r["NO_CATEGORIA"] == "Total" and r["NO_DEPENDENCIA"] == "Municipal"]
        for e, col in ATU.items():
            o = ix[("edu.atu.rede_municipal", cod, ano, e, None)]
            rec = f(rs[0][col]) if len(rs) == 1 else None
            reg("R7", "edu.atu.rede_municipal", cod, ano, e, None, o["valor"], rec, f"seed INEP ATU {ano}, {col}")
    rows = cgz(SEED / f"inep_rendimento/rendimento_capitais_{ano}.csv.gz")
    for cod in CAPS:
        rs = [r for r in rows if int(r["CO_MUNICIPIO"]) == cod and r["NO_CATEGORIA"] == "Total" and r["NO_DEPENDENCIA"] == "Municipal"]
        for e, col in (("anos_iniciais", "1_CAT_FUN_AI"), ("anos_finais", "1_CAT_FUN_AF")):
            o = ix[("edu.aprovacao.rede_municipal", cod, ano, e, None)]
            rec = f(rs[0][col]) if len(rs) == 1 else None
            reg("R7", "edu.aprovacao.rede_municipal", cod, ano, e, None, o["valor"], rec, f"seed INEP rendimento {ano}, {col}")
for etapa, arq in (("anos_iniciais", "inep_ideb_ai/ideb_ai_capitais_2025.csv.gz"), ("anos_finais", "inep_ideb_af/ideb_af_capitais_2025.csv.gz")):
    rows = cgz(SEED / arq)
    for cod in CAPS:
        rs = [r for r in rows if int(r["CO_MUNICIPIO"]) == cod and r["REDE"] == "Municipal"]
        for ano in G["periodos"]["ideb"]:
            for comp, col in (("ideb", f"VL_OBSERVADO_{ano}"), ("p_rendimento", f"VL_INDICADOR_REND_{ano}"), ("n_nota_padronizada", f"VL_NOTA_MEDIA_{ano}")):
                o = ix.get(("edu.ideb.rede_municipal", cod, ano, etapa, comp))
                if o is None: continue
                rec = f(rs[0].get(col)) if len(rs) == 1 else None
                reg("R7", "edu.ideb.rede_municipal", cod, ano, etapa, comp, o["valor"], rec, f"seed INEP Ideb 2025, {col}")
            for comp, col in (("matematica", f"VL_NOTA_MATEMATICA_{ano}"), ("portugues", f"VL_NOTA_PORTUGUES_{ano}")):
                o = ix.get(("edu.saeb.rede_municipal", cod, ano, etapa, comp))
                if o is None: continue
                rec = f(rs[0].get(col)) if len(rs) == 1 else None
                reg("R7", "edu.saeb.rede_municipal", cod, ano, etapa, comp, o["valor"], rec, f"seed INEP Ideb 2025, {col}")

# ---- gravação
def dif(g, r):
    if g is None and r is None: return "ambos vazios"
    if g is None or r is None: return "VAZIO DE UM LADO"
    return abs(g - r)
saida = []
for l in linhas:
    d = dif(l[6], l[7])
    saida.append(l + [d])
with open(SAIDA / "recalculo_gold.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(["bloco", "indicador", "capital", "ano", "etapa", "componente", "valor_gold", "valor_recalculado", "fonte_do_recalculo", "diferenca_absoluta"])
    w.writerows(saida)

# resumo por bloco
resumo = defaultdict(lambda: [0, 0, 0.0, 0, 0])  # n, n com diferença > tol, max dif, vazio de um lado, ambos vazios
for l in saida:
    b = l[0]; d = l[-1]
    r = resumo[b]; r[0] += 1
    if d == "ambos vazios": r[4] += 1
    elif d == "VAZIO DE UM LADO": r[3] += 1
    else:
        tol = 0.011 if b in ("R1", "R5") else 0.0011 if b in ("R7",) else 1e-6 * max(1.0, abs(l[6]))
        if d > tol: r[1] += 1
        r[2] = max(r[2], d)
print("bloco n fora_da_tolerancia maior_diferenca vazio_de_um_lado ambos_vazios")
for b, r in sorted(resumo.items()): print(b, *r)
bad = [l for l in saida if l[-1] == "VAZIO DE UM LADO" or (isinstance(l[-1], float) and l[-1] > (0.011 if l[0] in ("R1", "R5") else 0.0011 if l[0] == "R7" else 1e-6 * max(1.0, abs(l[6]))))]
print("divergências listadas:", len(bad))
for l in bad[:60]: print(l)

# ---- R8 estatísticas de grupo
def quartil(v, p):
    s = sorted(v); pos = (len(s) - 1) * p; lo = math.floor(pos); hi = math.ceil(pos)
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)
REG = {"N": "N", "NE": "NE", "SE": "SE", "S": "S", "CO": "CO"}
n_ref = 0; n_dif = 0; difs = []
for r in G["referencias"]:
    ind, comp, et, ano, grp = r["indicador"], r["componente"], r["etapa"], r["ano"], r["grupo"]
    vs = []; pares = []
    for cod, c in CAPS.items():
        if grp != "todas" and c["regiao"] != grp: continue
        o = ix.get((ind, cod, ano, et, comp))
        if o and o["status"] == "OBSERVADO" and o["valor"] is not None and o["elegivel_comparacao"]:
            vs.append(o["valor"]); pares.append(cod)
    n_ref += 1
    if not vs:
        if r["n"] != 0 and r["capitais_com_valor"] != 0:
            difs.append((ind, comp, et, ano, grp, "gold tem n>0, recalculo sem pares")); n_dif += 1
        continue
    exp = {"n": len(vs), "media": statistics.mean(vs), "mediana": statistics.median(vs), "minimo": min(vs), "maximo": max(vs)}
    if len(vs) >= G["politica_referencias"]["limiar_quartis"]:
        exp["q1"] = quartil(vs, .25); exp["q3"] = quartil(vs, .75)
    ruim = []
    for k, v in exp.items():
        gv = r.get(k)
        if gv is None or abs(gv - v) > 1e-6 * max(1, abs(v)): ruim.append((k, gv, v))
    if sorted(r["pares"]) != sorted(pares): ruim.append(("pares", len(r["pares"]), len(pares)))
    mn = sorted(c for c, o in ((c, ix[(ind, c, ano, et, comp)]["valor"]) for c in pares) if o == min(vs))
    mx = sorted(c for c, o in ((c, ix[(ind, c, ano, et, comp)]["valor"]) for c in pares) if o == max(vs))
    if sorted(r["capitais_minimo"]) != mn: ruim.append(("capitais_minimo", r["capitais_minimo"], mn))
    if sorted(r["capitais_maximo"]) != mx: ruim.append(("capitais_maximo", r["capitais_maximo"], mx))
    # razão agregada
    if r.get("razao_agregada") is not None:
        sn = sd = 0.0
        for cod in pares:
            o = ix[(ind, cod, ano, et, comp)]; c = o.get("calculo") or {}
            sn += c["numerador"]; sd += c["denominador"]
        ra = sn / sd
        if abs(ra - r["razao_agregada"]) > 1e-6 * ra: ruim.append(("razao_agregada", r["razao_agregada"], ra))
    if ruim:
        n_dif += 1; difs.append((ind, comp, et, ano, grp, ruim))
print("R8 referências conferidas:", n_ref, "com divergência:", n_dif)
for d in difs[:40]: print(d)
json.dump({"R8_total": n_ref, "R8_divergentes": n_dif, "R8_lista": [str(x) for x in difs]}, open(SAIDA / "recalculo_referencias_resumo.json", "w"), ensure_ascii=False, indent=1)

# ---- R9 conferência cruzada com a Sinopse Estatística (INEP), aba 1.2 (total), coluna Municipal
sin_dif = 0; sin_n = 0
for ano in range(2021, 2026):
    d = jgz(SEED / f"inep_sinopse/sinopse_capitais_{ano}.json.gz")["total"]["linhas"]
    por_cod = {int(l[3]): l for l in d if l[3] not in (None, "") and str(l[3]).strip() not in ("", " ")}
    for cod in CAPS:
        sin = por_cod.get(cod)
        if sin is None: print("R9 sem linha na Sinopse:", cod, ano); continue
        sin_n += 1
        # 2025: coluna "Municipal" da rede pública (índice 8); 2021 a 2024: o total municipal é urbana (8) + rural (13)
        sm = int(sin[8]) if ano == 2025 else int(sin[8]) + int(sin[13])
        if sm != mat[(cod, ano)]: sin_dif += 1; print("R9 DIVERGE", CAPS[cod]["nome"], ano, sm, mat[(cod, ano)])
print("R9 Sinopse × soma dos microdados (rede municipal, total):", sin_n, "pares; divergentes:", sin_dif)
