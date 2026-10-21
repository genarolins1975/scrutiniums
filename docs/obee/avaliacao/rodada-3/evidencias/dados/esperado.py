"""Lógica própria (avaliador de dados, rodada 3) para recalcular o que o painel deve exibir, a partir só da gold.
Não importa nada de pipeline/ nem de src/. Formatação pt-BR reimplementada com Decimal (meio para cima)."""
import json, math, statistics
from decimal import Decimal, ROUND_HALF_UP

RAIZ = "/home/user/scrutiniums"
G = json.load(open(f"{RAIZ}/public/eficiencia/gold/educacao_capitais.json"))
CAPS = G["universo"]["capitais"]
CAP_POR_ID = {c["id"]: c for c in CAPS}
CAP_POR_COD = {c["cod_ibge"]: c for c in CAPS}
REGIAO_NOME = G["universo"]["regioes"]
ETAPAS = {e["id"]: e["nome"] for e in G["etapas"]}
IDX = {(o["indicador"], o["ente"], o["ano"], o["etapa"], o["componente"]): o for o in G["observacoes"]}
FAT = {int(k): v for k, v in G["ipca"]["fatores_para_2025"].items()}

MEDIDA = {
    "despesa": ("edu.despesa.funcao_educacao", False),
    "despesa_hab": ("edu.despesa.por_habitante", False),
    "despesa_mat": ("edu.despesa.aplicacao_direta_por_matricula", False),
    "matriculas": ("edu.matriculas.rede_municipal", True),
    "conveniadas": ("edu.matriculas.conveniadas_municipais", True),
    "atu": ("edu.atu.rede_municipal", True),
    "aprovacao": ("edu.aprovacao.rede_municipal", True),
    "ideb": ("edu.ideb.rede_municipal", True),
    "saeb": ("edu.saeb.rede_municipal", True),
}
ANOS = {"despesa": G["periodos"]["financeiros"], "despesa_hab": G["periodos"]["financeiros"], "despesa_mat": G["periodos"]["financeiros"],
        "matriculas": G["periodos"]["censo"], "conveniadas": G["periodos"]["censo"], "atu": G["periodos"]["censo"], "aprovacao": G["periodos"]["censo"],
        "ideb": G["periodos"]["ideb"], "saeb": G["periodos"]["ideb"]}
ETAPAS_MEDIDA = {"matriculas": list(ETAPAS), "conveniadas": list(ETAPAS), "atu": ["creche", "pre_escola", "anos_iniciais", "anos_finais"],
                 "aprovacao": ["anos_iniciais", "anos_finais"], "ideb": ["anos_iniciais", "anos_finais"], "saeb": ["anos_iniciais", "anos_finais"]}


def arred(v, casas):
    q = Decimal(1).scaleb(-casas)
    # o painel entrega 12 algarismos significativos ao cliente; a mediana de dois valores com uma casa (20,9 e 21,2) é 21,05, não 21,0499...
    return Decimal(repr(float(f"{float(v):.12g}"))).quantize(q, rounding=ROUND_HALF_UP)


def pt(dec, casas):
    d = arred(dec, casas)
    s = f"{abs(d):,.{casas}f}"
    s = s.replace(",", "X").replace(".", ",").replace("X", ".")
    return ("-" if d < 0 else "") + s


def inteiro(v): return pt(v, 0)
def reais_int(v): return "R$ " + pt(v, 0)
def reais_ext(v):
    a = abs(v)
    if a >= 1e9: return f"R$ {pt(v/1e9, 2)} {'bilhão' if a < 2e9 else 'bilhões'}"
    if a >= 1e6: return f"R$ {pt(v/1e6, 1)} {'milhão' if a < 2e6 else 'milhões'}"
    if a >= 1e3: return f"R$ {pt(v/1e3, 1)} mil"
    return "R$ " + pt(v, 2)


def fmt(m, v):
    if m == "despesa": return reais_ext(v)
    if m in ("despesa_hab", "despesa_mat"): return reais_int(v)
    if m in ("matriculas", "conveniadas"): return inteiro(v)
    if m == "atu": return pt(v, 1)
    if m == "aprovacao": return pt(v, 1) + "%"
    if m == "ideb": return pt(v, 1)
    if m == "saeb": return pt(v, 2)


def componente(m, moeda, disc):
    if m.startswith("despesa"): return "real_2025" if moeda == "real" else "nominal"
    if m == "ideb": return "ideb"
    if m == "saeb": return disc
    return None


def etapa_efetiva(m, et):
    return et if MEDIDA[m][1] else None


def ano_valido(m, ano):
    anos = ANOS[m]
    if ano in anos: return ano
    antes = [a for a in anos if a <= ano]
    return antes[-1] if antes else anos[0]


def q7(v, p):
    s = sorted(v); pos = (len(s) - 1) * p
    lo, hi = math.floor(pos), math.ceil(pos)
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)


def ponto(m, cod, ano, et, moeda="nominal", disc="matematica"):
    ind = MEDIDA[m][0]
    return IDX.get((ind, cod, ano, etapa_efetiva(m, et), componente(m, moeda, disc)))


def universo(grupo_regiao):
    return [c for c in CAPS if grupo_regiao is None or c["regiao"] == grupo_regiao]


def comparacao(m, ano, et, moeda="nominal", disc="matematica", regiao=None):
    """Devolve dict com incluídas, excluídas e estatísticas calculadas aqui (não lidas de gold.referencias)."""
    inc, exc = [], []
    for c in universo(regiao):
        o = ponto(m, c["cod_ibge"], ano, et, moeda, disc)
        if o is not None and o["status"] == "OBSERVADO" and o["valor"] is not None:
            if o["elegivel_comparacao"]:
                inc.append((c, o))
            else:
                exc.append((c, o, "fora"))
        else:
            exc.append((c, o, "sem"))
    vs = [o["valor"] for c, o in inc]
    st = None
    if vs:
        st = {"n": len(vs), "media": sum(vs) / len(vs), "mediana": statistics.median(vs), "min": min(vs), "max": max(vs),
              "q1": q7(vs, .25), "q3": q7(vs, .75)}
        st["capmin"] = sorted(f"{c['nome']} ({c['uf']})" for c, o in inc if o["valor"] == st["min"])
        st["capmax"] = sorted(f"{c['nome']} ({c['uf']})" for c, o in inc if o["valor"] == st["max"])
        # razão agregada
        if m in ("despesa_hab", "despesa_mat"):
            num = den = 0.0
            for c, o in inc:
                cod = c["cod_ibge"]
                if m == "despesa_hab":
                    d = IDX[("edu.despesa.funcao_educacao", cod, ano, None, componente(m, moeda, disc))]["valor"]
                    num += d; den += IDX[("ctx.populacao.residente", cod, ano, None, None)]["valor"]
                else:
                    k = FAT[ano] if moeda == "real" else 1.0
                    a = IDX[("edu.despesa.ponte_matricula", cod, ano, None, "ad_demais_elementos")]["valor"]
                    b = IDX[("edu.despesa.ponte_matricula", cod, ano, None, "ad_beneficiario_indeterminado")]["valor"]
                    num += (a + b) * k; den += IDX[("edu.matriculas.rede_municipal", cod, ano, "total", None)]["valor"]
            st["razao"] = num / den; st["den"] = den
    return {"inc": inc, "exc": exc, "st": st, "universo": len(universo(regiao)),
            "com_valor": len(inc) + sum(1 for x in exc if x[2] == "fora")}


def frase_amplitude(m, ano, et, disc, comp):
    """Valores que a frase deve conter: (min, caps_min, max, caps_max, n)."""
    st = comp["st"]
    if not st: return None
    return {"min": fmt(m, st["min"]), "max": fmt(m, st["max"]), "capmin": st["capmin"], "capmax": st["capmax"], "n": st["n"]}


def intra_pct(cod, ano):
    o = IDX.get(("edu.despesa.funcao_educacao", cod, ano, None, "nominal"))
    if not o or not o.get("conferencia") or not o["conferencia"].get("rreo"): return None
    r = o["conferencia"]["rreo"]
    if r.get("intra") is None: return None
    tot = r["exceto_intra"] + r["intra"]
    return 100 * r["intra"] / tot if tot > 0 else None
