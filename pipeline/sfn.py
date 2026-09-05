"""Entrantes e saídas do SFN — gold sfn.json.

Duas réguas, declaradas e nunca somadas:
1. **Cadastro** (BCB/Unicad, Olinda): quem está autorizado e em funcionamento HOJE, por
   grupo, segmento, UF e, nas cooperativas, por sistema. O cadastro não tem data de
   início: a série de entradas e saídas nasce com a primeira coleta e cresce daí em
   diante (`sfn_hist`), com nomes.
2. **Quem entrega o IF.data** (BCB, trimestral desde 2015): instituições e conglomerados
   que reportam o resumo em cada trimestre, por tipo de consolidado (b1 a n4). Entrada =
   primeiro trimestre reportado; saída = último trimestre reportado antes do mais
   recente; mudança de tipo = conversão (SCD que vira banco, por exemplo). É a única
   história pública com nomes e datas; cobre o universo que reporta ao IF.data, não o
   cadastro inteiro (instituições de pagamento e corretoras pequenas ficam de fora).
3. **Regimes de resolução** (BCB, Olinda): as saídas forçadas, com data e tipo.

Regras: ausência é nulo; o trimestre mais recente do IF.data pode estar incompleto
(retardatários) e uma "saída" nele é provisória, declarada como tal; posições e
contagens são do dia da coleta; nada é estimado.
"""
from pipeline import common

FONTES = {
    "cadastro": {"nome": "BCB — Relação de instituições em funcionamento (Unicad, API Olinda)", "url": "https://olinda.bcb.gov.br/olinda/servico/Instituicoes_em_funcionamento/versao/v1/odata/",
                 "catalogo": "https://dadosabertos.bcb.gov.br/dataset/relacao-de-instituicoes-em-funcionamento-no-pais", "licenca": "dados abertos do BCB", "nivel": "A — cadastro oficial, posição do dia"},
    "ifdata": {"nome": "BCB — IF.data (cadastro e resumo trimestral)", "url": "https://olinda.bcb.gov.br/olinda/servico/IFDATA/versao/v1/odata/",
               "catalogo": "https://dadosabertos.bcb.gov.br/dataset/ifdata---dados-selecionados-de-instituies-financeiras", "licenca": "dados abertos do BCB", "nivel": "A — relatório regulatório trimestral"},
    "regimes": {"nome": "BCB — Regimes de resolução (API Olinda)", "url": "https://olinda.bcb.gov.br/olinda/servico/regimes_especiais/versao/v1/odata/",
                "catalogo": "https://dadosabertos.bcb.gov.br/dataset/regimes-especiais", "licenca": "dados abertos do BCB", "nivel": "A — lista oficial vigente, diária"},
}
TCB = {"B1": "Banco comercial ou múltiplo com carteira comercial", "B2": "Banco múltiplo sem carteira comercial ou de investimento", "B3S": "Cooperativa singular",
       "B3C": "Cooperativa central ou confederação", "B4": "Banco de desenvolvimento", "N1": "Não bancário de crédito (SCFI, SCD, SAM, SCM...)",
       "N2": "Não bancário de mercado de capitais (corretoras, DTVM)", "N3": "Não bancário, outros", "N4": "Instituição de pagamento"}
GRUPO_ORDEM = ["Bancos", "Cooperativas de crédito", "Instituições de pagamento", "Fintechs de crédito", "Financeiras e crédito especializado",
               "Mercado de capitais e câmbio", "Fomento e desenvolvimento", "Consórcios", "Outros"]
GRUPO_COR = {"Bancos": "#1d4e89", "Cooperativas de crédito": "#2f7d4f", "Instituições de pagamento": "#b45309", "Fintechs de crédito": "#6b46a3",
             "Financeiras e crédito especializado": "#0e7c7b", "Mercado de capitais e câmbio": "#8d5a2b", "Fomento e desenvolvimento": "#4b5563", "Consórcios": "#9a3412", "Outros": "#6b7280"}
REGIOES = {"AC": "Norte", "AP": "Norte", "AM": "Norte", "PA": "Norte", "RO": "Norte", "RR": "Norte", "TO": "Norte",
           "AL": "Nordeste", "BA": "Nordeste", "CE": "Nordeste", "MA": "Nordeste", "PB": "Nordeste", "PE": "Nordeste", "PI": "Nordeste", "RN": "Nordeste", "SE": "Nordeste",
           "ES": "Sudeste", "MG": "Sudeste", "RJ": "Sudeste", "SP": "Sudeste", "PR": "Sul", "RS": "Sul", "SC": "Sul", "DF": "Centro-Oeste", "GO": "Centro-Oeste", "MT": "Centro-Oeste", "MS": "Centro-Oeste"}
SISTEMAS = [("SICOOB", "Sicoob"), ("SICREDI", "Sicredi"), ("CRESOL", "Cresol"), ("UNICRED", "Unicred"), ("AILOS", "Ailos"), ("CREDISIS", "CrediSIS"), ("UNIPRIME", "Uniprime")]


def _r(v, d=2):
    return None if v is None else round(v, d)


def _share(v, tot):
    return _r(v / tot * 100) if tot else None


def _sistema(filiacao, nome):
    txt = f"{filiacao or ''} {nome or ''}".upper()
    for chave, rot in SISTEMAS:
        if chave in txt:
            return rot
    return "Independente ou outra central" if not filiacao else "Outras centrais"


# ---------------------------------------------------------------- cadastro (Unicad)
def _cadastro(con):
    try:
        n = con.execute("SELECT COUNT(*) FROM sfn_sedes").fetchone()[0]
    except Exception:
        n = 0
    if not n:
        return {"disponivel": False}
    data = con.execute("SELECT MAX(coletado_em) FROM sfn_sedes").fetchone()[0]
    grupos = {}
    for g, s, k in con.execute("SELECT grupo, segmento, COUNT(*) FROM sfn_sedes GROUP BY grupo, segmento ORDER BY 3 DESC"):
        grupos.setdefault(g, {"grupo": g, "cor": GRUPO_COR.get(g), "n": 0, "segmentos": []})
        grupos[g]["n"] += k
        grupos[g]["segmentos"].append({"segmento": s, "n": k})
    grupos = sorted(grupos.values(), key=lambda x: GRUPO_ORDEM.index(x["grupo"]) if x["grupo"] in GRUPO_ORDEM else 99)
    for g in grupos:
        g["share"] = _share(g["n"], n)
    ufs = [{"uf": u, "regiao": REGIOES.get(u), "n": k, "bancos": b, "cooperativas": c, "ips": i, "fintechs": f}
           for u, k, b, c, i, f in con.execute("""SELECT uf, COUNT(*), SUM(grupo='Bancos'), SUM(grupo='Cooperativas de crédito'), SUM(grupo='Instituições de pagamento'),
                                                    SUM(grupo='Fintechs de crédito') FROM sfn_sedes WHERE uf IS NOT NULL GROUP BY uf ORDER BY 2 DESC""")]
    regioes = {}
    for u in ufs:
        r = regioes.setdefault(u["regiao"], {"regiao": u["regiao"], "n": 0, "cooperativas": 0, "bancos": 0})
        r["n"] += u["n"]; r["cooperativas"] += u["cooperativas"]; r["bancos"] += u["bancos"]
    regioes = sorted([dict(x, share=_share(x["n"], n)) for x in regioes.values()], key=lambda x: -x["n"])
    # cooperativas por sistema, classe, categoria e critério de associação
    coops = con.execute("SELECT nome, classe, associacao, categoria, filiacao, uf FROM sfn_sedes WHERE grupo='Cooperativas de crédito'").fetchall()
    por_sistema, por_assoc, por_categ = {}, {}, {}
    for nome, classe, assoc, categ, fil, uf in coops:
        s = _sistema(fil, nome)
        por_sistema[s] = por_sistema.get(s, 0) + 1
        por_assoc[assoc or "não informado"] = por_assoc.get(assoc or "não informado", 0) + 1
        por_categ[categ or "não informada"] = por_categ.get(categ or "não informada", 0) + 1
    ncoop = len(coops)
    bancos = con.execute("SELECT carteira_comercial, COUNT(*) FROM sfn_sedes WHERE grupo='Bancos' GROUP BY carteira_comercial").fetchall()
    # entradas e saídas observadas pelo próprio pipeline (desde a primeira coleta)
    primeira = con.execute("SELECT MIN(primeiro_visto) FROM sfn_hist").fetchone()[0]
    entradas = [{"cnpj8": c, "nome": nm, "grupo": g, "segmento": s, "uf": u, "data": p}
                for c, nm, g, s, u, p in con.execute("SELECT cnpj8, nome, grupo, segmento, uf, primeiro_visto FROM sfn_hist WHERE primeiro_visto > ? ORDER BY primeiro_visto DESC LIMIT 60", (primeira,))]
    saidas = [{"cnpj8": c, "nome": nm, "grupo": g, "segmento": s, "uf": u, "data": p}
              for c, nm, g, s, u, p in con.execute("SELECT cnpj8, nome, grupo, segmento, uf, ultimo_visto FROM sfn_hist WHERE ultimo_visto < ? ORDER BY ultimo_visto DESC LIMIT 60", (data,))]
    conversoes = [{"cnpj8": c, "nome": nm, "de": a, "para": s, "data": m}
                  for c, nm, a, s, m in con.execute("SELECT cnpj8, nome, segmento_anterior, segmento, mudou_em FROM sfn_hist WHERE mudou_em IS NOT NULL ORDER BY mudou_em DESC LIMIT 60")]
    contagem = {}
    for d, g, k in con.execute("SELECT data, grupo, SUM(n) FROM sfn_contagem GROUP BY data, grupo ORDER BY data"):
        contagem.setdefault(d, {"data": d})[g] = k
    return {
        "disponivel": True, "data": data, "total": n, "grupos": grupos, "ufs": ufs, "regioes": regioes,
        "cooperativas": {"n": ncoop, "por_sistema": sorted([{"sistema": s, "n": k, "share": _share(k, ncoop)} for s, k in por_sistema.items()], key=lambda x: -x["n"]),
                         "por_associacao": sorted([{"criterio": s, "n": k, "share": _share(k, ncoop)} for s, k in por_assoc.items()], key=lambda x: -x["n"]),
                         "por_categoria": sorted([{"categoria": s, "n": k, "share": _share(k, ncoop)} for s, k in por_categ.items()], key=lambda x: -x["n"])},
        "bancos": {"n": sum(k for _c, k in bancos), "com_carteira_comercial": next((k for c, k in bancos if c == "Sim"), 0), "sem_carteira_comercial": next((k for c, k in bancos if c == "Não"), 0)},
        "historico_proprio": {"desde": primeira, "entradas": entradas, "saidas": saidas, "conversoes": conversoes, "contagem": list(contagem.values())[-60:]},
        "nota": ("Posição do dia no cadastro do BCB: bancos, cooperativas, sociedades (SCD, SEP, SCFI, IPs, corretoras, DTVM, agências de fomento, hipotecárias, SAM) e "
                 "administradoras de consórcio. Sem data de início: a série de entradas e saídas é construída pelo Observatório a partir da primeira coleta."),
    }


# ---------------------------------------------------------------- IF.data (trimestral)
def _ifdata(con):
    try:
        tri = [r[0] for r in con.execute("SELECT DISTINCT anomes FROM institution_metrics WHERE metric='ativo_total' ORDER BY anomes")]
    except Exception:
        tri = []
    if len(tri) < 2:
        return {"disponivel": False, "motivo": "menos de dois trimestres do IF.data na silver"}
    pres = {}
    for cod, am in con.execute("SELECT DISTINCT cod_inst, anomes FROM institution_metrics WHERE metric='ativo_total'"):
        pres.setdefault(cod, set()).add(am)
    cad = {c: (nm, t, u, sr) for c, nm, t, u, sr in con.execute("SELECT cod_inst, name, tcb, uf, sr FROM institutions")}
    ativo = {}
    for cod, am, v in con.execute("SELECT cod_inst, anomes, value FROM institution_metrics WHERE metric='ativo_total'"):
        ativo[(cod, am)] = v
    ult, pen = tri[-1], tri[-2]
    primeiro = tri[0]
    serie = []
    for i, am in enumerate(tri):
        atuais = {c for c, s in pres.items() if am in s}
        por_tcb = {}
        for c in atuais:
            t = (cad.get(c) or (None, "?", None, None))[1] or "?"
            por_tcb[t] = por_tcb.get(t, 0) + 1
        ent = sai = 0
        if i > 0:
            ant = {c for c, s in pres.items() if tri[i - 1] in s}
            ent = len(atuais - ant)
            sai = len(ant - atuais)
        serie.append({"anomes": am, "n": len(atuais), "entradas": ent if i else None, "saidas": sai if i else None, "por_tcb": por_tcb, "provisorio": am == ult})
    # listas nominais dos últimos 8 trimestres
    def lista(tipo, am_i):
        am, ant = tri[am_i], tri[am_i - 1]
        atuais = {c for c, s in pres.items() if am in s}; antes = {c for c, s in pres.items() if ant in s}
        cods = (atuais - antes) if tipo == "entrada" else (antes - atuais)
        out = []
        for c in cods:
            nm, t, u, sr = cad.get(c) or (c, None, None, None)
            out.append({"cod": c, "nome": nm, "tcb": t, "tcb_nome": TCB.get(t), "uf": u, "sr": sr, "anomes": am,
                        "ativo": ativo.get((c, am if tipo == "entrada" else ant)), "provisorio": am == ult and tipo == "saida"})
        return sorted(out, key=lambda x: -(x["ativo"] or 0))
    janela = list(range(max(1, len(tri) - 8), len(tri)))
    entradas = [x for i in reversed(janela) for x in lista("entrada", i)]
    saidas = [x for i in reversed(janela) for x in lista("saida", i)]
    # conversões: mudança de tcb entre o cadastro atual e a primeira presença? o cadastro guarda só o tipo atual;
    # conversão observável = instituição que aparece com tipo novo enquanto o código antigo sai (mesmo nome)
    # aqui: instituições cujo tipo atual difere do tipo dominante do nome em saídas — mantido simples: por nome igual
    nomes_saida = {(x["nome"] or "").strip().upper(): x for x in saidas if x["nome"]}
    conversoes = []
    for x in entradas:
        k = (x["nome"] or "").strip().upper()
        if k in nomes_saida and nomes_saida[k]["tcb"] != x["tcb"]:
            conversoes.append({"nome": x["nome"], "de": nomes_saida[k]["tcb"], "para": x["tcb"], "anomes": x["anomes"]})
    # saldo líquido por tipo nos últimos 4 trimestres fechados (exclui o provisório)
    fechados = [s for s in serie if not s["provisorio"]][-4:]
    ult_fechado = fechados[-1] if fechados else None
    por_tcb_ult = [{"tcb": t, "nome": TCB.get(t, t), "n": k, "share": _share(k, ult_fechado["n"])} for t, k in sorted((ult_fechado or {"por_tcb": {}})["por_tcb"].items(), key=lambda x: -x[1])]
    var_4t = {t: (ult_fechado["por_tcb"].get(t, 0) - (fechados[0]["por_tcb"].get(t, 0) if len(fechados) > 1 else 0)) for t in (ult_fechado or {"por_tcb": {}})["por_tcb"]} if ult_fechado else {}
    return {
        "disponivel": True, "trimestres": len(tri), "primeiro": primeiro, "ultimo": ult, "ultimo_fechado": ult_fechado["anomes"] if ult_fechado else None,
        "kpis": {"reportantes": ult_fechado["n"] if ult_fechado else None, "entradas_4t": sum(s["entradas"] or 0 for s in fechados), "saidas_4t": sum(s["saidas"] or 0 for s in fechados),
                 "provisorio_entradas": serie[-1]["entradas"], "provisorio_saidas": serie[-1]["saidas"]},
        "serie": serie, "por_tcb": por_tcb_ult, "var_4t_por_tcb": var_4t, "entradas": entradas[:80], "saidas": saidas[:80], "conversoes": conversoes[:40], "tcb": TCB,
        "nota": ("Quem entrega o resumo do IF.data em cada trimestre, por tipo de consolidado. Entrada = primeiro trimestre reportado no acervo; saída = deixou de reportar. "
                 "O trimestre mais recente ainda recebe retardatários: as saídas nele são provisórias. Cobre o universo que reporta ao IF.data, não o cadastro inteiro."),
    }


# ---------------------------------------------------------------- regimes
def _regimes(con):
    g = common.ler_gold_opcional("regimes.json") or {}
    if not g.get("disponivel"):
        return {"disponivel": False}
    vig = g.get("vigentes") or []
    por_tipo = {}
    for v in vig:
        por_tipo[v.get("tipo")] = por_tipo.get(v.get("tipo"), 0) + 1
    ult12 = [v for v in vig if (v.get("inicio_iso") or "") >= _menos_meses(12)]
    return {"disponivel": True, "vigentes": len(vig), "por_tipo": sorted([{"tipo": t, "n": k} for t, k in por_tipo.items()], key=lambda x: -x["n"]),
            "decretados_12m": len(ult12), "recentes": sorted(vig, key=lambda v: v.get("inicio_iso") or "", reverse=True)[:12], "gerado_em": g.get("gerado_em")}


def _menos_meses(n):
    from datetime import date
    hoje = date.today()
    y, m = hoje.year, hoje.month - n
    while m <= 0:
        y, m = y - 1, m + 12
    return f"{y}-{m:02d}-{hoje.day:02d}"


# ---------------------------------------------------------------- build
def build(con, cfg=None):
    cad = _cadastro(con)
    ifd = _ifdata(con)
    reg = _regimes(con)
    if not cad.get("disponivel") and not ifd.get("disponivel"):
        return {"disponivel": False, "motivo": "silver sem cadastro do Unicad nem trimestres do IF.data — coleta ainda não rodou"}
    frases = []
    if cad.get("disponivel"):
        g = {x["grupo"]: x for x in cad["grupos"]}
        frases.append(f"Em {cad['data']}, {cad['total']} sedes estavam autorizadas e em funcionamento: {g.get('Bancos', {}).get('n', 0)} bancos, "
                      f"{g.get('Cooperativas de crédito', {}).get('n', 0)} cooperativas de crédito, {g.get('Instituições de pagamento', {}).get('n', 0)} instituições de pagamento "
                      f"e {g.get('Fintechs de crédito', {}).get('n', 0)} fintechs de crédito (SCD e SEP).")
    if ifd.get("disponivel") and ifd["kpis"]["reportantes"]:
        k = ifd["kpis"]
        frases.append(f"No IF.data, {k['reportantes']} instituições e conglomerados reportaram em {ifd['ultimo_fechado']}; nos quatro trimestres fechados houve "
                      f"{k['entradas_4t']} entradas e {k['saidas_4t']} saídas.")
    if reg.get("disponivel"):
        frases.append(f"{reg['vigentes']} instituições estão sob regime de resolução, {reg['decretados_12m']} decretados nos últimos 12 meses.")
    return {
        "disponivel": True, "gerado_em": common.now_utc(), "fontes": FONTES, "sintese": " ".join(frases),
        "cadastro": cad, "ifdata": ifd, "regimes": reg,
        "catalogo": [
            {"id": "sedes", "nome": "Sedes em funcionamento", "definicao": "instituições autorizadas pelo BCB com sede em funcionamento na data da coleta, por grupo e segmento", "unidade": "instituições", "fonte": "BCB/Unicad", "limitacoes": "posição do dia; sem data de início; conglomerados não consolidados"},
            {"id": "entradas_saidas_cadastro", "nome": "Entradas e saídas no cadastro", "definicao": "CNPJ que aparece (ou some) entre duas coletas do cadastro", "unidade": "instituições", "fonte": "calculado", "limitacoes": "série nasce na primeira coleta do Observatório; uma relação fora do ar não vira saída (a coleta é descartada)"},
            {"id": "reportantes", "nome": "Reportantes do IF.data", "definicao": "instituições e conglomerados com resumo publicado no trimestre, por tipo de consolidado", "unidade": "instituições", "fonte": "BCB/IF.data", "limitacoes": "universo do IF.data (tipo de instituição 2); último trimestre recebe retardatários"},
            {"id": "entradas_saidas_ifdata", "nome": "Entradas e saídas no IF.data", "definicao": "primeiro trimestre reportado (entrada) e trimestre seguinte ao último reportado (saída)", "unidade": "instituições", "fonte": "calculado", "limitacoes": "saída pode ser fusão, incorporação, mudança de código ou cancelamento; o painel não distingue sem o ato do BCB"},
        ],
        "cautelas": [
            "Cadastro (posição do dia), reportantes do IF.data (trimestral) e regimes (lista vigente) são três réguas; não se somam.",
            "Saída do IF.data não é falência: fusões, incorporações e trocas de código de conglomerado também tiram uma instituição da lista. A leitura nominal está na tabela para cada caso.",
            "O trimestre mais recente do IF.data recebe retardatários por semanas; as saídas nele são provisórias e ficam marcadas.",
            "O cadastro do Unicad não publica data de início: a história das entradas e saídas com nomes começa na primeira coleta do Observatório e cresce daí em diante.",
            "Instituição de pagamento e fintech de crédito são segmentos regulatórios: uma mesma empresa pode ter mais de uma licença, cada uma com um CNPJ.",
        ],
        "metodo": ("Cadastro pelas quatro relações da API Olinda, espelhado a cada coleta com histórico próprio por CNPJ; IF.data pela presença de cada código no relatório resumo trimestral "
                   "já coletado pelo pipeline; regimes pelo gold já publicado. Agregação em Python (stdlib), sem estimativa."),
    }
