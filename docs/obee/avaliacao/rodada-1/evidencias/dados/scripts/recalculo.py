"""Recálculo independente do avaliador de dados (rodada 1). Lógica própria, a partir das sementes brutas (DCA, IBGE, IPCA, Censo, ATU, rendimento, Ideb)
e comparação com a gold e com as séries CSV. Não importa nada de pipeline.eficiencia. Uso: python3 -I recalculo.py"""
import csv, gzip, json, os, statistics, sys, math
R = "/home/user/scrutiniums"
SEED = f"{R}/pipeline/eficiencia/seed"
GOLD = json.load(open(f"{R}/public/eficiencia/gold/educacao_capitais.json", encoding="utf-8"))
caps = GOLD["universo"]["capitais"]
COD = {c["id"]: c["cod_ibge"] for c in caps}
NOME = {c["cod_ibge"]: c["nome"] for c in caps}
REG = {c["cod_ibge"]: c["regiao"] for c in caps}
ANOS = [2021, 2022, 2023, 2024, 2025]


def lj(p):
    with gzip.open(p, "rt", encoding="utf-8") as f:
        return json.load(f)


# ---------------- gold indexada
G = {}
for o in GOLD["observacoes"]:
    G[(o["indicador"], o["ente"], o["ano"], o["etapa"], o["componente"])] = o


def g(ind, cod, ano, etapa=None, comp=None):
    return G.get((ind, cod, ano, etapa, comp))


# ---------------- IPCA (média anual do número-índice, fator = média2025/média ano)
ip = lj(f"{SEED}/ibge_ipca/ipca_numero_indice_2021_2025.json.gz")
serie = ip[0]["resultados"][0]["series"][0]["serie"]
media = {a: sum(float(serie[f"{a}{m:02d}"]) for m in range(1, 13)) / 12 for a in ANOS}
fator = {a: media[a + 0] and media[2025] / media[a] for a in ANOS}

# ---------------- população
pop_raw = lj(f"{SEED}/ibge_populacao/populacao_capitais.json.gz")
pop = {(r["cod"], r["ano"]): r["valor"] for r in pop_raw}
try:
    rel23 = lj(f"{SEED}/ibge_populacao/relacao_2023_capitais.json.gz")
except Exception:
    rel23 = None
for r in (rel23 or []):
    pop[(r['cod'], r['ano'])] = r['valor']

# ---------------- DCA
def dca(cod, ano):
    rows = lj(f"{SEED}/siconfi/dca_anexo_i_e/{cod}_{ano}.json.gz")
    a = [r for r in rows if r["cod_conta"] == "TotalDespesas" and r["conta"] == "12 - Educação" and r["coluna"] == "Despesas Liquidadas"]
    assert len(a) == 1, (cod, ano, len(a))
    return a[0]["valor"]


def subf(cod, ano):
    rows = lj(f"{SEED}/siconfi/dca_anexo_i_e/{cod}_{ano}.json.gz")
    out = {}
    for r in rows:
        if r["cod_conta"] == "TotalDespesas" and r["coluna"] == "Despesas Liquidadas" and (r["conta"].startswith("12.") or r["conta"].startswith("FU12")):
            out[r["conta"].split(" - ")[0]] = r["valor"]
    return out


# ---------------- Censo
def censo(ano):
    with gzip.open(f"{SEED}/inep_censo/escolas_capitais_{ano}.csv.gz", "rt", encoding="utf-8") as f:
        return list(csv.DictReader(f))


CENSO = {a: censo(a) for a in ANOS}


def iv(x):
    return None if x in (None, "") else int(float(x))


def mat(cod, ano):
    rows = [r for r in CENSO[ano] if r["CO_MUNICIPIO"] == str(cod) and r["TP_DEPENDENCIA"] == "3"]
    tot = sum(iv(r["QT_MAT_BAS"]) or 0 for r in rows)
    et = {}
    cols = {"creche": "QT_MAT_INF_CRE", "pre_escola": "QT_MAT_INF_PRE", "anos_iniciais": "QT_MAT_FUND_AI", "anos_finais": "QT_MAT_FUND_AF", "ensino_medio": "QT_MAT_MED", "eja": "QT_MAT_EJA"}
    for k, c in cols.items():
        et[k] = sum(iv(r[c]) or 0 for r in rows)
    et["profissional"] = tot - sum(et.values())
    et["total"] = tot
    return et, len(rows)


def conv(cod, ano):
    rows = [r for r in CENSO[ano] if r["CO_MUNICIPIO"] == str(cod) and r["TP_DEPENDENCIA"] == "4" and r["IN_PODER_PUBLICO_PARCERIA"] == "1" and r["TP_PODER_PUBLICO_PARCERIA"] == "1"]
    return sum(iv(r["QT_MAT_BAS"]) or 0 for r in rows)


def q7(vs, p):
    s = sorted(vs)
    pos = (len(s) - 1) * p
    lo = math.floor(pos)
    hi = math.ceil(pos)
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)


linhas = []   # (rotulo, recalculado, gold, tol)
div = 0


def cmp(rot, a, b, tol=1e-6):
    global div
    if a is None and b is None:
        st = "ambos sem valor"
    elif a is None or b is None:
        st = "DIVERGE (um lado sem valor)"
        div += 1
    elif abs(a - b) <= tol:
        st = "confere"
    else:
        st = "DIVERGE"
        div += 1
    linhas.append((rot, a, b, None if a is None or b is None else a - b, st))


# ===== 1. despesa total, por habitante, real: 26 x 5
dcaV = {}
for c in caps:
    cod = c["cod_ibge"]
    for a in ANOS:
        d = dca(cod, a)
        dcaV[(cod, a)] = d
        cmp(f"despesa nominal {c['nome']} {a}", d, g("edu.despesa.funcao_educacao", cod, a, None, "nominal")["valor"], 0.005)
        cmp(f"despesa real2025 {c['nome']} {a}", d * fator[a], g("edu.despesa.funcao_educacao", cod, a, None, "real_2025")["valor"], 0.02)
        p = pop[(cod, a)]
        cmp(f"populacao {c['nome']} {a}", p, g("ctx.populacao.residente", cod, a)["valor"], 0.5)
        cmp(f"desp/hab nominal {c['nome']} {a}", d / p, g("edu.despesa.por_habitante", cod, a, None, "nominal")["valor"], 1e-5)
        cmp(f"desp/hab real {c['nome']} {a}", d * fator[a] / p, g("edu.despesa.por_habitante", cod, a, None, "real_2025")["valor"], 1e-4)
# ===== 2. matrículas totais e por etapa
for c in caps:
    cod = c["cod_ibge"]
    for a in ANOS:
        et, n = mat(cod, a)
        for k, v in et.items():
            cmp(f"matriculas {k} {c['nome']} {a}", v, g("edu.matriculas.rede_municipal", cod, a, k)["valor"], 0.5)
        cmp(f"conveniadas total {c['nome']} {a}", conv(cod, a), g("edu.matriculas.conveniadas_municipais", cod, a, "total")["valor"], 0.5)

# ===== 3. subfunções soma = total
for c in caps:
    cod = c["cod_ibge"]
    for a in ANOS:
        s = subf(cod, a)
        soma = sum(s.values())
        t = dcaV[(cod, a)]
        cmp(f"subfuncoes soma-total {c['nome']} {a}", soma - t, 0.0, 1.0)

# ===== 4. ATU, aprovação
def atu(ano):
    with gzip.open(f"{SEED}/inep_atu/atu_capitais_{ano}.csv.gz", "rt", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def rend(ano):
    with gzip.open(f"{SEED}/inep_rendimento/rendimento_capitais_{ano}.csv.gz", "rt", encoding="utf-8") as f:
        return list(csv.DictReader(f))


colatu = {"creche": "CRE_CAT_0", "pre_escola": "PRE_CAT_0", "anos_iniciais": "FUN_AI_CAT_0", "anos_finais": "FUN_AF_CAT_0"}
colap = {"anos_iniciais": "1_CAT_FUN_AI", "anos_finais": "1_CAT_FUN_AF"}
for a in ANOS:
    A = atu(a)
    Rr = rend(a)
    for c in caps:
        cod = c["cod_ibge"]
        ra = [r for r in A if r["CO_MUNICIPIO"] == str(cod) and r["NO_CATEGORIA"] == "Total" and r["NO_DEPENDENCIA"] == "Municipal"]
        assert len(ra) == 1, (cod, a, len(ra))
        for e, col in colatu.items():
            v = ra[0][col]
            go = g("edu.atu.rede_municipal", cod, a, e)
            if v in ("--", ""):
                linhas.append((f"atu {e} {c['nome']} {a} (fonte '{v}')", None, go["valor"], None, f"gold status={go['status']}"))
                if go["valor"] is not None:
                    div += 1
            else:
                cmp(f"atu {e} {c['nome']} {a}", float(v), go["valor"], 1e-9)
        rr = [r for r in Rr if r["CO_MUNICIPIO"] == str(cod) and r["NO_CATEGORIA"] == "Total" and r["NO_DEPENDENCIA"] == "Municipal"]
        assert len(rr) == 1, (cod, a, len(rr))
        for e, col in colap.items():
            v = rr[0][col]
            go = g("edu.aprovacao.rede_municipal", cod, a, e)
            if v in ("--", ""):
                linhas.append((f"aprov {e} {c['nome']} {a} (fonte '{v}')", None, go["valor"], None, f"gold status={go['status']}"))
                if go["valor"] is not None:
                    div += 1
            else:
                cmp(f"aprov {e} {c['nome']} {a}", float(v), go["valor"], 1e-9)

# ===== 5. Ideb e componentes
def ideb(et):
    p = f"{SEED}/inep_ideb_{'ai' if et == 'anos_iniciais' else 'af'}/ideb_{'ai' if et == 'anos_iniciais' else 'af'}_capitais_2025.csv.gz"
    with gzip.open(p, "rt", encoding="utf-8") as f:
        return list(csv.DictReader(f))


IDEBA = [2005, 2007, 2009, 2011, 2013, 2015, 2017, 2019, 2021, 2023, 2025]
for et in ["anos_iniciais", "anos_finais"]:
    rows = ideb(et)
    for c in caps:
        cod = c["cod_ibge"]
        rr = [r for r in rows if r["CO_MUNICIPIO"] == str(cod) and r["REDE"] == "Municipal"]
        if len(rr) != 1:
            linhas.append((f"ideb {et} {c['nome']}: {len(rr)} linhas municipais na fonte", None, None, None, "sem linha"))
            continue
        for a in IDEBA:
            v = rr[0].get(f"VL_OBSERVADO_{a}")
            go = g("edu.ideb.rede_municipal", cod, a, et, "ideb")
            if v is None:
                linhas.append((f"ideb {et} {c['nome']} {a}: coluna ausente", None, go and go["valor"], None, "?"))
                continue
            if v in ("-", "ND", "ND*", "ND***", "--", ""):
                if go and go["valor"] is not None:
                    div += 1
                    linhas.append((f"ideb {et} {c['nome']} {a} (fonte '{v}')", None, go["valor"], None, "DIVERGE (gold com valor)"))
                else:
                    linhas.append((f"ideb {et} {c['nome']} {a} (fonte '{v}')", None, None, None, f"ambos sem valor; gold {go and go['status']}"))
            else:
                cmp(f"ideb {et} {c['nome']} {a}", float(v), go and go["valor"], 1e-9)

# ===== 6. medianas, quartis, médias, razão agregada para a referência do grupo
def refs_check():
    out = []
    for ind, comp in [("edu.despesa.por_habitante", "nominal"), ("edu.despesa.por_habitante", "real_2025"),
                      ("edu.despesa.funcao_educacao", "nominal"), ("edu.despesa.aplicacao_direta_por_matricula", "nominal"), ("edu.despesa.aplicacao_direta_por_matricula", "real_2025")]:
        for a in ANOS:
            vs = []
            nums = []
            dens = []
            for c in caps:
                o = g(ind, c["cod_ibge"], a, None, comp)
                if o and o["status"] == "OBSERVADO" and o["valor"] is not None and o["elegivel_comparacao"]:
                    vs.append((c["nome"], o["valor"]))
                    if "calculo" in o:
                        nums.append(o["calculo"]["numerador"])
                        dens.append(o["calculo"]["denominador"])
            vals = [v for _, v in vs]
            out.append((ind, comp, a, len(vals), statistics.median(vals), sum(vals) / len(vals), min(vals), max(vals), q7(vals, .25), q7(vals, .75),
                        (sum(nums) / sum(dens)) if nums else None))
    return out


REFS = refs_check()

json.dump({"refs": REFS}, open(os.path.join(os.path.dirname(__file__), "refs_recalculadas.json"), "w"), ensure_ascii=False)
tot = len(linhas)
print(f"comparações: {tot}; divergências: {div}")
for l in linhas:
    if l[4].startswith("DIVERGE") and "real2025" not in l[0]:
        print(l)
with open(os.path.join(os.path.dirname(__file__), "recalculo_saida.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["rotulo", "recalculado", "gold", "diferenca", "resultado"])
    w.writerows(linhas)
