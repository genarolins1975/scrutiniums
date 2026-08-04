"""Moradia e crédito habitacional — camada gold.

Combina três bases que medem coisas diferentes e **nunca** são somadas entre si:

* **Censo 2022 (IBGE), tabela 9930** — condição de ocupação de 72,5 milhões de domicílios
  particulares permanentes ocupados, em nível municipal. Diz quantos domicílios estão
  sendo pagos, mas não por quem nem com que instrumento, e **não coleta valor de aluguel
  nem valor de prestação** (verificado: a classificação 511, de classes de aluguel, não
  aparece em nenhum agregado de 2022).

* **ESTBAN (BCB), verbete 169** — único saldo de financiamento imobiliário com
  granularidade municipal, mas contabilizado na dependência bancária e composto por
  quatro rubricas COSIF heterogêneas, incluindo imóveis não residenciais e financiamentos
  de infraestrutura. Não é crédito habitacional residencial de pessoa física.

* **Informações do Mercado Imobiliário (BCB)** — tem exatamente os cortes que faltam ao
  169 (residencial, PF, segmento de funding, taxa, LTV, prestação, valor do imóvel), mas
  a granularidade máxima é a **unidade da federação**.

A auditoria completa que sustenta cada uma dessas afirmações está em
docs/AUDITORIA_MORADIA.md. As regras de nomenclatura seguidas aqui, que existem para
impedir leitura indevida:

* o verbete 169 é sempre "saldo de financiamentos imobiliários contabilizado no
  município", nunca "crédito habitacional";
* domicílios "ainda pagando" nunca são chamados de contratos bancários;
* saldo dividido por operação é "saldo médio por operação em aberto", nunca ticket médio;
* participação de uma instituição é "participação no saldo imobiliário contabilizado no
  município", nunca participação de clientes;
* lacuna estimada nunca é demanda comprovada.
"""
import math

from pipeline import common
from pipeline.penetracao import DATA_BASE_SUBCOLETADA, _faixa, _ols, _quantil, _rows

REGIAO = {
    "AC": "Norte", "AP": "Norte", "AM": "Norte", "PA": "Norte", "RO": "Norte",
    "RR": "Norte", "TO": "Norte",
    "AL": "Nordeste", "BA": "Nordeste", "CE": "Nordeste", "MA": "Nordeste",
    "PB": "Nordeste", "PE": "Nordeste", "PI": "Nordeste", "RN": "Nordeste",
    "SE": "Nordeste",
    "DF": "Centro-Oeste", "GO": "Centro-Oeste", "MT": "Centro-Oeste", "MS": "Centro-Oeste",
    "ES": "Sudeste", "MG": "Sudeste", "RJ": "Sudeste", "SP": "Sudeste",
    "PR": "Sul", "RS": "Sul", "SC": "Sul",
}
REGIOES = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"]

UF_NOME = {
    "AC": "Acre", "AL": "Alagoas", "AM": "Amazonas", "AP": "Amapá", "BA": "Bahia",
    "CE": "Ceará", "DF": "Distrito Federal", "ES": "Espírito Santo", "GO": "Goiás",
    "MA": "Maranhão", "MG": "Minas Gerais", "MS": "Mato Grosso do Sul",
    "MT": "Mato Grosso", "PA": "Pará", "PB": "Paraíba", "PE": "Pernambuco",
    "PI": "Piauí", "PR": "Paraná", "RJ": "Rio de Janeiro",
    "RN": "Rio Grande do Norte", "RO": "Rondônia", "RR": "Roraima",
    "RS": "Rio Grande do Sul", "SC": "Santa Catarina", "SE": "Sergipe",
    "SP": "São Paulo", "TO": "Tocantins",
}

# Segmentos do Mercado Imobiliário, na ordem em que a página os apresenta.
SEGMENTOS = [
    ("sfh", "SFH", "Sistema Financeiro da Habitação — recursos direcionados da poupança (SBPE), com teto de valor do imóvel e taxa limitada por norma."),
    ("fgts", "FGTS", "Recursos do Fundo de Garantia, com taxas subsidiadas e critérios de renda definidos pelo Conselho Curador."),
    ("livre", "Taxas de mercado", "Financiamento habitacional sem direcionamento obrigatório de recursos; taxa livremente pactuada."),
    ("home_equity", "Home equity", "Crédito com imóvel em garantia. **Não financia a compra do imóvel** — o imóvel já é do tomador e serve de garantia para outro fim."),
    ("comercial", "Imóvel comercial", "Financiamento de imóvel não residencial contratado por pessoa física."),
]
HABITACIONAIS = ["sfh", "fgts", "livre"]

# Composição contábil do verbete 169, conforme o elenco de contas do COSIF (coluna "E").
VERBETE_169 = {
    "nome": "VERBETE_169_FINANCIAMENTOS_IMOBILIARIOS",
    "contas": [
        {"conta": "1.6.4.30.00.00-2", "titulo": "Imóveis residenciais",
         "funcao": "Operações de crédito destinadas à aquisição, construção, reforma, ampliação e produção de unidades imobiliárias residenciais.",
         "habitacional": True},
        {"conta": "1.6.4.10.00.00-4", "titulo": "Imóveis não residenciais",
         "funcao": "Mesma redação, para unidades imobiliárias não residenciais.",
         "habitacional": False},
        {"conta": "1.6.4.40.00.00-1", "titulo": "Carteiras de ativos garantidoras de LIG",
         "funcao": "Operações cujos créditos integram carteiras garantidoras de Letra Imobiliária Garantida.",
         "habitacional": None},
        {"conta": "1.6.6.10.00.00-8", "titulo": "Financiamentos de infraestrutura e desenvolvimento",
         "funcao": "“Registrar as operações realizadas em condições especiais” — a função contábil oficial não menciona imóveis.",
         "habitacional": False},
    ],
    "nao_distingue": [
        "residencial de não residencial",
        "pessoa física de pessoa jurídica",
        "mutuário final de empreendimento em construção",
        "aquisição de construção ou reforma",
    ],
    "fonte": "COSIF, Capítulo 3, Documento nº 13 (Estatística Bancária Mensal), e elenco de contas com a coluna de verbete ESTBAN.",
    "alerta": ("A rubrica 1.6.6.10 não é crédito imobiliário. Por isso o verbete 169 não pode "
               "ser lido como medida de crédito habitacional residencial de pessoa física, e "
               "nesta página ele é sempre nomeado pelo que de fato é: saldo de financiamentos "
               "imobiliários contabilizado no município."),
    "invercao_cosif": ("Na Resolução CMN 4.966, vigente desde 2025, os códigos 1.6.4.10 e "
                       "1.6.4.30 trocaram de significado em relação ao plano de contas anterior: "
                       "1.6.4.10 passou a ser não residencial e 1.6.4.30, residencial. Documentação "
                       "antiga que reaproveite o mapeamento de 2020 troca residencial por comercial."),
}


def _mi(con, info, data=None):
    """Último valor de uma série do Mercado Imobiliário, ou o valor numa data."""
    if data:
        r = con.execute("SELECT valor FROM mi_serie WHERE info=? AND data=?", (info, data)).fetchone()
    else:
        r = con.execute("SELECT valor FROM mi_serie WHERE info=? ORDER BY data DESC LIMIT 1",
                        (info,)).fetchone()
    return r[0] if r else None


def _mi_serie(con, info):
    return {r[0]: r[1] for r in con.execute(
        "SELECT data, valor FROM mi_serie WHERE info=? ORDER BY data", (info,))}


def _br(v, casas=2):
    """Número no formato brasileiro. Os textos de achado são renderizados como estão, sem
    passar pelo formatador do front-end, então a vírgula decimal tem de vir daqui."""
    if v is None:
        return "–"
    txt = f"{v:,.{casas}f}".replace(",", "\x00").replace(".", ",").replace("\x00", ".")
    return txt


def _r(v, casas=2):
    return None if v is None else round(v, casas)


def _pct(a, b, casas=2):
    return None if (a is None or not b) else round(100.0 * a / b, casas)


def _hhi(partes):
    """Índice de Herfindahl-Hirschman em pontos (0 a 10.000)."""
    tot = sum(partes)
    if not tot:
        return None
    return round(sum((100.0 * p / tot) ** 2 for p in partes), 1)


def _simulador(taxa_aa, valor_imovel, ltv_pct):
    """Parâmetros de partida do simulador, todos vindos de valores observados.

    Devolve só os insumos e as fórmulas — o cálculo em si é feito no navegador, para que
    o usuário veja o resultado mudar ao mexer nos controles. Nada aqui é uma previsão:
    é aritmética de tabela Price e SAC sobre parâmetros que o próprio usuário escolhe.
    """
    return {
        "selo": "cenario",
        "partida": {
            "valor_imovel": _r(valor_imovel, 0),
            "ltv_pct": _r(ltv_pct),
            "taxa_aa_pct": _r(taxa_aa),
            "prazo_meses": 360,
        },
        "formulas": {
            "taxa_mensal": "i = (1 + taxa_aa/100)^(1/12) − 1",
            "price": "prestação = PV · i / (1 − (1 + i)^(−n)), constante ao longo do contrato",
            "sac": "amortização = PV/n; prestação_k = PV/n + saldo_devedor_{k−1} · i, decrescente",
            "comprometimento": "prestação ÷ renda mensal informada",
        },
        "avisos": [
            "O resultado é um cenário aritmético, não uma proposta de crédito nem uma previsão.",
            "A taxa de partida é a média das contratações do segmento na fonte oficial, não a taxa que uma pessoa específica obteria.",
            "Não estão incluídos seguros obrigatórios (MIP e DFI), taxa de administração, custos de avaliação e cartório, nem correção monetária do saldo devedor por TR ou IPCA.",
            "Contratos indexados a TR ou a índice de preços têm prestação variável; a simulação prefixada não representa esses contratos.",
        ],
    }


def build(con, cfg=None):
    # ---------- data-bases ----------
    datas_estban = [r["data_base"] for r in _rows(
        con, "SELECT DISTINCT data_base FROM estban_imob ORDER BY data_base DESC")]
    datas_estban = [d for d in datas_estban if d != DATA_BASE_SUBCOLETADA]
    if not datas_estban:
        return {"ok": False, "motivo": "sem coleta do ESTBAN"}
    db_estban = datas_estban[0]

    db_mi_cred = con.execute(
        "SELECT MAX(data) FROM mi_serie WHERE info LIKE 'credito_%'").fetchone()[0]
    db_mi_imov = con.execute(
        "SELECT MAX(data) FROM mi_serie WHERE info LIKE 'imoveis_%'").fetchone()[0]
    db_scr = con.execute("SELECT MAX(data) FROM scr_uf_produto").fetchone()[0]

    # ---------- Censo 2022: como o Brasil mora ----------
    cen = _rows(con, """SELECT m.cod_ibge, m.dom_total, m.dom_proprio, m.dom_proprio_pago,
                               m.dom_proprio_pagando, m.dom_alugado, m.dom_cedido, m.dom_outra,
                               c.pop_total, c.pop_18mais, c.renda_pc_mensal, c.urbanizacao,
                               i.nome, i.uf
                        FROM censo_moradia m
                        LEFT JOIN censo_mun c ON c.cod_ibge = m.cod_ibge
                        LEFT JOIN ibge_municipios i ON i.cod_ibge = m.cod_ibge""")

    tot = {k: 0.0 for k in ("dom_total", "dom_proprio", "dom_proprio_pago",
                            "dom_proprio_pagando", "dom_alugado", "dom_cedido", "dom_outra")}
    for m in cen:
        for k in tot:
            if m[k] is not None:
                tot[k] += m[k]

    censo = {
        "ano": 2022,
        "selo": "observado",
        "total": int(tot["dom_total"]),
        "categorias": [
            {"k": "proprio_pago", "rot": "Próprio já pago, herdado ou ganho",
             "n": int(tot["dom_proprio_pago"]), "pct": _pct(tot["dom_proprio_pago"], tot["dom_total"])},
            {"k": "proprio_pagando", "rot": "Próprio ainda sendo pago",
             "n": int(tot["dom_proprio_pagando"]), "pct": _pct(tot["dom_proprio_pagando"], tot["dom_total"])},
            {"k": "alugado", "rot": "Alugado",
             "n": int(tot["dom_alugado"]), "pct": _pct(tot["dom_alugado"], tot["dom_total"])},
            {"k": "cedido", "rot": "Cedido ou emprestado",
             "n": int(tot["dom_cedido"]), "pct": _pct(tot["dom_cedido"], tot["dom_total"])},
            {"k": "outra", "rot": "Outra condição",
             "n": int(tot["dom_outra"]), "pct": _pct(tot["dom_outra"], tot["dom_total"])},
        ],
        "tabela": "IBGE, Censo Demográfico 2022, tabela 9930, variável 381 (classificação 63).",
        "nao_coletado": [
            "valor mensal do aluguel",
            "valor da prestação do financiamento",
            "instituição credora ou natureza do contrato",
            "saldo devedor ou prazo restante",
        ],
        "verificacao_ausencia": ("Consulta à API de agregados do IBGE filtrando pela classificação 511 "
                                 "(classes de aluguel nominal mensal) no período 2022 devolve lista vazia. "
                                 "Essa classificação só aparece no Censo 2010, tabelas 3511 e 3524, e ainda "
                                 "assim em faixas, não em valor contínuo."),
        "arredondamento": ("O Censo 2022 aplica arredondamento aleatório como controle de divulgação. "
                           "A soma das categorias difere do total em até duas unidades em 1.955 municípios; "
                           "isso é da fonte, não do processamento."),
    }

    # ---------- Mercado Imobiliário: nacional ----------
    def bloco_nacional():
        carteira = {s: _mi(con, f"credito_estoque_carteira_credito_pf_{s}_br", db_mi_cred)
                    for s, _, _ in SEGMENTOS}
        carteira_pj = {s: _mi(con, f"credito_estoque_carteira_credito_pj_{s}_br", db_mi_cred)
                       for s in ("sfh", "fgts", "livre", "comercial")}
        total_pf = sum(v for v in carteira.values() if v is not None)
        hab = sum(carteira[s] for s in HABITACIONAIS if carteira.get(s) is not None)
        return {
            "selo": "observado",
            "carteira_pf": {k: _r(v, 0) for k, v in carteira.items()},
            "carteira_pf_total": _r(total_pf, 0),
            "carteira_pf_habitacional": _r(hab, 0),
            "carteira_pj": {k: _r(v, 0) for k, v in carteira_pj.items()},
            "taxa": {s: _mi(con, f"credito_contratacao_taxa_pf_{s}_br", db_mi_cred) for s, _, _ in SEGMENTOS},
            "ltv": {s: _mi(con, f"credito_contratacao_ltv_pf_{s}_br", db_mi_cred) for s, _, _ in SEGMENTOS},
            "parcela": {s: _mi(con, f"credito_estoque_parcela_pf_{s}_br", db_mi_cred) for s, _, _ in SEGMENTOS},
            "inad": {s: _mi(con, f"credito_estoque_inadimplencia_pf_{s}_br", db_mi_cred) for s, _, _ in SEGMENTOS},
            "ativo_problematico": {s: _mi(con, f"credito_estoque_ativo_problematico_pf_{s}_br", db_mi_cred)
                                   for s, _, _ in SEGMENTOS},
            "contratado_mes": {s: _r(_mi(con, f"credito_contratacao_contratado_pf_{s}_br", db_mi_cred), 0)
                               for s, _, _ in SEGMENTOS},
            "indexador": {i: _mi(con, f"credito_estoque_indexador_pf_{i}_br", db_mi_cred)
                          for i in ("tr", "ipca", "prefixado", "outros")},
            "imoveis": {
                "data_base": db_mi_imov,
                "valor_avaliacao": _r(_mi(con, "imoveis_valor_avaliacao_br", db_mi_imov), 0),
                "valor_compra": _r(_mi(con, "imoveis_valor_compra_br", db_mi_imov), 0),
                "area_privativa": _mi(con, "imoveis_area_privativa_br", db_mi_imov),
                "casa": _mi(con, "imoveis_tipo_casa_br", db_mi_imov),
                "apartamento": _mi(con, "imoveis_tipo_apartamento_br", db_mi_imov),
                "dormitorios": {d: _mi(con, f"imoveis_dormitorio_{d}_br", db_mi_imov)
                                for d in ("1", "2", "3", "4_mais")},
                "garantia": {g: _mi(con, f"imoveis_garantia_{g}_br", db_mi_imov)
                             for g in ("alienacao_fiduciaria", "hipoteca")},
            },
            "direcionamento": {d: _r(_mi(con, f"direcionamento_{d}_residencial_br"), 0)
                               for d in ("aquisicao", "construcao", "reforma_ampliacao", "aplicacao")},
        }

    brasil = bloco_nacional()

    # séries mensais para os gráficos
    def serie_multi(padrao, chaves, casas=2, escala=1.0):
        base = {}
        for k in chaves:
            for data, v in _mi_serie(con, padrao.format(k=k)).items():
                base.setdefault(data, {})[k] = None if v is None else round(v / escala, casas)
        return [{"d": d, **base[d]} for d in sorted(base)]

    brasil["series"] = {
        "carteira": serie_multi("credito_estoque_carteira_credito_pf_{k}_br",
                                [s for s, _, _ in SEGMENTOS], casas=2, escala=1e9),
        "taxa": serie_multi("credito_contratacao_taxa_pf_{k}_br", HABITACIONAIS),
        "parcela": serie_multi("credito_estoque_parcela_pf_{k}_br", HABITACIONAIS, casas=0),
        "inad": serie_multi("credito_estoque_inadimplencia_pf_{k}_br", HABITACIONAIS),
        "ltv": serie_multi("credito_contratacao_ltv_pf_{k}_br", HABITACIONAIS),
        "imovel": [{"d": d, "compra": round(v / 1000.0, 1)}
                   for d, v in sorted(_mi_serie(con, "imoveis_valor_compra_br").items())],
        "contratado": serie_multi("credito_contratacao_contratado_pf_{k}_br",
                                  HABITACIONAIS, casas=2, escala=1e9),
    }

    # ---------- ESTBAN 169 por município ----------
    est = {r["cod_ibge"]: r for r in _rows(
        con, "SELECT cod_ibge, uf, imobiliario, poupanca, instituicoes FROM estban_imob WHERE data_base=?",
        (db_estban,))}

    # instabilidade da série: maior variação mensal absoluta do saldo 169
    serie_mun = {}
    for r in _rows(con, """SELECT cod_ibge, data_base, imobiliario FROM estban_imob
                           WHERE data_base != ? ORDER BY cod_ibge, data_base""",
                   (DATA_BASE_SUBCOLETADA,)):
        serie_mun.setdefault(r["cod_ibge"], []).append((r["data_base"], r["imobiliario"]))
    instavel = set()
    for cod, pares in serie_mun.items():
        vals = [v for _, v in pares if v]
        for a, b in zip(vals, vals[1:]):
            if a > 1e6 and abs(b - a) / a > 0.5:
                instavel.add(cod)
                break

    # instituições no verbete 169
    inst_mun = {}
    inst_nac = {}
    for r in _rows(con, """SELECT cod_ibge, cnpj, instituicao, imobiliario
                           FROM estban_imob_inst WHERE data_base=? AND imobiliario > 0""",
                   (db_estban,)):
        inst_mun.setdefault(r["cod_ibge"], []).append(r)
        e = inst_nac.setdefault(r["cnpj"], {"nome": r["instituicao"], "saldo": 0.0, "muns": 0})
        e["saldo"] += r["imobiliario"]
        e["muns"] += 1

    total_169 = sum(v["imobiliario"] or 0 for v in est.values())
    inst_lista = sorted(inst_nac.items(), key=lambda kv: -kv[1]["saldo"])
    nomes_inst = [v["nome"] for _, v in inst_lista]
    idx_inst = {cnpj: i for i, (cnpj, _) in enumerate(inst_lista)}

    instituicoes = []
    for i, (cnpj, v) in enumerate(inst_lista):
        instituicoes.append({
            "i": i, "nome": v["nome"], "cnpj8": cnpj[:8],
            "saldo": _r(v["saldo"], 0),
            "part_nacional": _pct(v["saldo"], total_169),
            "municipios": v["muns"],
        })

    # ---------- municípios ----------
    muns, por_uf = [], {}
    mediana_base = _quantil([
        (est[m["cod_ibge"]]["imobiliario"] / m["dom_total"])
        for m in cen
        if m["dom_total"] and est.get(m["cod_ibge"]) and est[m["cod_ibge"]]["imobiliario"]
    ], 0.5) or 1.0

    for m in cen:
        cod = m["cod_ibge"]
        e = est.get(cod)
        saldo = (e["imobiliario"] if e else None) or None
        uf = m["uf"] or (e["uf"] if e else None)
        dt = m["dom_total"] or 0

        por_dom = (saldo / dt) if (saldo and dt) else None
        razao = (por_dom / mediana_base) if por_dom else None
        lista = sorted(inst_mun.get(cod, []), key=lambda r: -r["imobiliario"])
        ni = len(lista)
        top = lista[0] if lista else None
        soma_inst = sum(r["imobiliario"] for r in lista)

        if saldo is None:
            selo = "sem_dependencia"
        elif cod in instavel or (razao and razao > 10):
            selo = "baixa"
        elif (razao and razao > 3) or ni <= 1:
            selo = "media"
        else:
            selo = "alta"

        reg = REGIAO.get(uf)
        item = {
            "c": cod, "n": m["nome"], "uf": uf, "reg": reg,
            "dt": int(dt) if dt else None,
            "dpg": int(m["dom_proprio_pago"]) if m["dom_proprio_pago"] is not None else None,
            "dpp": int(m["dom_proprio_pagando"]) if m["dom_proprio_pagando"] is not None else None,
            "da": int(m["dom_alugado"]) if m["dom_alugado"] is not None else None,
            "dc": int(m["dom_cedido"]) if m["dom_cedido"] is not None else None,
            "do": int(m["dom_outra"]) if m["dom_outra"] is not None else None,
            "pgp": _pct(m["dom_proprio_pagando"], dt),
            "alp": _pct(m["dom_alugado"], dt),
            "s": _r(saldo, 0),
            "pp": _r((e["poupanca"] if e else None) or None, 0),
            "ni": ni or None,
            "i1": idx_inst.get(top["cnpj"]) if top else None,
            "i1p": _pct(top["imobiliario"], soma_inst) if top else None,
            "hhi": _hhi([r["imobiliario"] for r in lista]) if lista else None,
            "p18": int(m["pop_18mais"]) if m["pop_18mais"] else None,
            "rpc": _r(m["renda_pc_mensal"]),
            "urb": _r(m["urbanizacao"]),
            "sel": selo,
            "sdom": _r(por_dom, 0),
        }
        muns.append(item)

        if uf:
            u = por_uf.setdefault(uf, {k: 0.0 for k in
                                       ("dt", "dpg", "dpp", "da", "dc", "do", "s", "pp", "pop", "renda")})
            for a, b in (("dt", "dom_total"), ("dpg", "dom_proprio_pago"),
                         ("dpp", "dom_proprio_pagando"), ("da", "dom_alugado"),
                         ("dc", "dom_cedido"), ("do", "dom_outra")):
                if m[b]:
                    u[a] += m[b]
            if saldo:
                u["s"] += saldo
            if e and e["poupanca"]:
                u["pp"] += e["poupanca"]
            if m["pop_total"]:
                u["pop"] += m["pop_total"]
            if m["renda_pc_mensal"] and m["pop_total"]:
                u["renda"] += m["renda_pc_mensal"] * m["pop_total"]

    # ---------- quociente locacional por instituição ----------
    # QL(b,i) = (saldo da instituição i no município b / saldo total do município b)
    #           ÷ (saldo nacional da instituição i / saldo nacional)
    # Mede se a instituição está mais presente naquele município do que no país. Não diz
    # nada sobre clientes: o ESTBAN não publica número de clientes por instituição.
    # Só faz sentido para instituição com distribuição territorial ampla: um banco que
    # contabiliza em um único município tem, ali, quociente locacional altíssimo por
    # definição aritmética, e isso não informa nada.
    QL_MIN_MUNICIPIOS = 25
    qls = {}
    for cod, lista in inst_mun.items():
        tot_mun = sum(r["imobiliario"] for r in lista)
        if not tot_mun:
            continue
        for r in lista:
            cnpj = r["cnpj"]
            nac = inst_nac[cnpj]["saldo"] / total_169 if total_169 else None
            if not nac:
                continue
            qls.setdefault(cnpj, []).append((r["imobiliario"] / tot_mun) / nac)
    for it in instituicoes:
        cnpj = inst_lista[it["i"]][0]
        v = qls.get(cnpj)
        if v and it["municipios"] >= QL_MIN_MUNICIPIOS:
            it["ql_mediano"] = _r(_quantil(v, 0.5))
            it["ql_p90"] = _r(_quantil(v, 0.9))
        else:
            it["ql_na"] = f"contabiliza em {it['municipios']} município(s)"

    # A concentração contábil, medida. É o fato que mais limita a leitura municipal desta
    # página, e por isso é publicado como número, não como advertência genérica.
    poucos = [i for i in instituicoes if i["municipios"] <= 2]
    concentracao_contabil = {
        "selo": "calculado",
        "instituicoes_total": len(instituicoes),
        "instituicoes_ate_2_municipios": len(poucos),
        "saldo_dessas": _r(sum(i["saldo"] for i in poucos), 0),
        "part_dessas": _pct(sum(i["saldo"] for i in poucos), total_169),
        "leitura": ("Um terço do saldo imobiliário do país está contabilizado em um ou dois "
                    "municípios por instituições que operam em todo o território. O mapa do "
                    "verbete 169 mostra onde o saldo é escriturado, não onde moram as pessoas "
                    "que tomaram o crédito."),
    }

    # ---------- estados: as três medidas, lado a lado ----------
    scr_uf = {r["uf"]: r for r in _rows(con, """
        SELECT uf, SUM(saldo) saldo, SUM(n_op) n_op, SUM(inad) inad, SUM(ap) ap
        FROM scr_uf_produto WHERE produto LIKE '%mobili%' AND cliente='PF' AND data=?
        GROUP BY uf""", (db_scr,))}

    estados = []
    for uf, u in sorted(por_uf.items()):
        mi_pf = sum(v for v in (_mi(con, f"credito_estoque_carteira_credito_pf_{s}_{uf.lower()}", db_mi_cred)
                                for s, _, _ in SEGMENTOS) if v is not None)
        s = scr_uf.get(uf)
        estados.append({
            "uf": uf, "nome": UF_NOME.get(uf, uf), "reg": REGIAO.get(uf),
            "dom_total": int(u["dt"]), "dom_pagando": int(u["dpp"]), "dom_alugado": int(u["da"]),
            "pgp": _pct(u["dpp"], u["dt"]), "alp": _pct(u["da"], u["dt"]),
            "renda_pc": _r(u["renda"] / u["pop"]) if u["pop"] else None,
            "estban169": _r(u["s"], 0),
            "poupanca": _r(u["pp"], 0),
            "mi_carteira_pf": _r(mi_pf, 0) or None,
            "scr_imob_pf": _r(s["saldo"], 0) if s else None,
            "scr_operacoes": int(s["n_op"]) if s and s["n_op"] else None,
            "scr_inad_pct": _pct(s["inad"], s["saldo"]) if s else None,
            "taxa_sfh": _mi(con, f"credito_contratacao_taxa_pf_sfh_{uf.lower()}", db_mi_cred),
            "ltv_sfh": _mi(con, f"credito_contratacao_ltv_pf_sfh_{uf.lower()}", db_mi_cred),
            "parcela_sfh": _r(_mi(con, f"credito_estoque_parcela_pf_sfh_{uf.lower()}", db_mi_cred), 0),
            "inad_sfh": _mi(con, f"credito_estoque_inadimplencia_pf_sfh_{uf.lower()}", db_mi_cred),
            "valor_compra": _r(_mi(con, f"imoveis_valor_compra_{uf.lower()}", db_mi_imov), 0),
            "area_privativa": _mi(con, f"imoveis_area_privativa_{uf.lower()}", db_mi_imov),
        })
    for e in estados:
        if e["mi_carteira_pf"] and e["estban169"]:
            e["razao_estban_mi"] = _r(e["estban169"] / e["mi_carteira_pf"])
        if e["scr_imob_pf"] and e["mi_carteira_pf"]:
            e["razao_mi_scr"] = _r(e["mi_carteira_pf"] / e["scr_imob_pf"])

    # ---------- modelo 1: lacuna de penetração habitacional ----------
    # Compara a proporção de domicílios ainda sendo pagos com a mediana de municípios
    # comparáveis. É um contraste transversal do Censo 2022 consigo mesmo — não usa
    # crédito, não usa preço, e não prova que exista demanda insatisfeita.
    grupos = {}
    for m in muns:
        if not (m["reg"] and m["dt"] and m["rpc"] is not None and m["urb"] is not None):
            continue
        grupos.setdefault(m["reg"], []).append(m["rpc"])
    cortes_renda = {r: [_quantil(v, 1 / 3), _quantil(v, 2 / 3)] for r, v in grupos.items()}

    pares = {}
    for m in muns:
        if not (m["reg"] and m["dt"] and m["rpc"] is not None and m["urb"] is not None
                and m["pgp"] is not None):
            continue
        chave = (m["reg"], _faixa(m["rpc"], cortes_renda[m["reg"]]), m["urb"] >= 75)
        m["_grp"] = chave
        pares.setdefault(chave, []).append(m["pgp"])

    MIN_GRUPO = 8
    esperado_grupo = {k: _quantil(v, 0.5) for k, v in pares.items() if len(v) >= MIN_GRUPO}
    lac_dom_total, n_abaixo = 0.0, 0
    for m in muns:
        k = m.pop("_grp", None)
        esp = esperado_grupo.get(k)
        if esp is None or m["pgp"] is None or not m["dt"]:
            continue
        m["pesp"] = _r(esp)
        if esp > m["pgp"]:
            m["gd"] = int(round((esp - m["pgp"]) / 100.0 * m["dt"]))
            lac_dom_total += m["gd"]
            n_abaixo += 1

    # ---------- modelo 2: lacuna de saldo ----------
    # ln(saldo 169) explicado por escala domiciliar, prosperidade e urbanização, com
    # efeitos fixos de região. A referência é a MEDIANA condicional, exp(ajustado), e não
    # a média: retransformar pela média com a correção de Duan colocaria a maioria dos
    # municípios abaixo do esperado por construção, e a lacuna mediria a assimetria da
    # distribuição em vez de falta de crédito. Mesmo critério adotado na aba de penetração.
    #
    # A amostra exige **duas ou mais instituições contabilizando** no município. A
    # restrição foi medida, não arbitrada: sem ela σ = 1,45 e a lacuna somada dá R$ 2,5
    # trilhões, mais que o saldo nacional inteiro — resultado sem sentido. Com ela,
    # σ = 0,66, R² sobe de 0,71 para 0,81 e a lacuna cai para 13% do observado. A razão é
    # substantiva: município com uma única instituição no verbete 169 é, quase sempre,
    # o ponto onde um banco centraliza a contabilização de uma carteira nacional, e o
    # saldo ali não descreve mercado local nenhum.
    amostra = [m for m in muns
               if m["s"] and m["dt"] and m["rpc"] and m["urb"] is not None
               and m["sel"] in ("alta", "media") and (m["ni"] or 0) >= 2]
    modelo = {"ok": False}
    if len(amostra) > 200:
        X, y = [], []
        for m in amostra:
            fe = [1.0 if m["reg"] == r else 0.0 for r in REGIOES[1:]]
            X.append([1.0, math.log(m["dt"]), math.log(m["rpc"]), m["urb"] / 100.0] + fe)
            y.append(math.log(m["s"]))
        aj = _ols(X, y)
        if aj:
            lac_saldo_total, n_abaixo_s = 0.0, 0
            for m, xi in zip(amostra, X):
                pred = sum(b * v for b, v in zip(aj["beta"], xi))
                ref = math.exp(pred)
                m["sesp"] = _r(ref, 0)
                m["sfx"] = [_r(math.exp(pred - aj["sigma"]), 0), _r(math.exp(pred + aj["sigma"]), 0)]
                if ref > m["s"]:
                    m["gs"] = _r(ref - m["s"], 0)
                    lac_saldo_total += ref - m["s"]
                    n_abaixo_s += 1
            modelo = {
                "ok": True, "n": aj["n"], "r2": _r(aj["r2"], 4), "r2_aj": _r(aj["r2_aj"], 4),
                "sigma": _r(aj["sigma"], 4), "duan": _r(aj["duan"], 4),
                "especificacao": ("ln(saldo 169) = β₀ + β₁·ln(domicílios) + β₂·ln(renda domiciliar "
                                  "per capita) + β₃·urbanização + efeitos fixos de região"),
                "coeficientes": {
                    "intercepto": _r(aj["beta"][0], 4),
                    "ln_domicilios": _r(aj["beta"][1], 4),
                    "ln_renda_pc": _r(aj["beta"][2], 4),
                    "urbanizacao": _r(aj["beta"][3], 4),
                    **{f"regiao_{r}": _r(b, 4) for r, b in zip(REGIOES[1:], aj["beta"][4:])},
                },
                "referencia": "mediana condicional, exp(valor ajustado)",
                "lacuna_total": _r(lac_saldo_total, 0),
                "municipios_abaixo": n_abaixo_s,
                "faixa": ("Com σ ≈ %.2f em logaritmo, a faixa de um desvio vai de cerca de %.0f%% "
                          "a %.1f vezes o valor central. A lacuna de um município isolado é "
                          "indicativa; a soma de muitos é mais informativa que qualquer linha do "
                          "ranking." % (aj["sigma"], 100 * math.exp(-aj["sigma"]), math.exp(aj["sigma"]))),
            }

    modelos = {
        "penetracao": {
            "selo": "estimado",
            "criterio": ("região × tercil de renda domiciliar per capita × urbanização de 75% ou "
                         f"mais, com mínimo de {MIN_GRUPO} municípios por grupo"),
            "referencia": "mediana do grupo de comparáveis",
            "grupos": len(esperado_grupo),
            "municipios_cobertos": sum(1 for m in muns if m.get("pesp") is not None),
            "municipios_abaixo": n_abaixo,
            "lacuna_domicilios": int(lac_dom_total),
            "aviso": ("A lacuna é a diferença em relação a municípios comparáveis, não demanda "
                      "comprovada. Ela pode refletir preferência por aluguel, herança, "
                      "autoconstrução, programas não financiados, informalidade fundiária ou "
                      "simplesmente um parque domiciliar mais antigo — nada disso é observável aqui."),
        },
        "saldo": {**modelo, "selo": "estimado",
                  "aviso": ("Referência contrafactual sobre um saldo contabilizado na dependência "
                            "bancária. Não mede crédito tomado por moradores do município, e a "
                            "lacuna não é demanda comprovada nem restrição de oferta demonstrada.")},
    }

    # ---------- rankings ----------
    def rk(chave, n=25, filtro=None, reverso=True):
        v = [m for m in muns if m.get(chave) is not None and (filtro is None or filtro(m))]
        v.sort(key=lambda m: m[chave], reverse=reverso)
        return [{"c": m["c"], "n": m["n"], "uf": m["uf"], "v": m[chave], "sel": m["sel"]}
                for m in v[:n]]

    porte = lambda m: (m["dt"] or 0) >= 5000
    confiavel = lambda m: m["sel"] in ("alta", "media")

    rankings = {
        "mais_pagando": rk("pgp", filtro=porte),
        "menos_pagando": rk("pgp", filtro=porte, reverso=False),
        "mais_alugado": rk("alp", filtro=porte),
        "maior_saldo": rk("s"),
        "maior_saldo_por_domicilio": rk("sdom", filtro=lambda m: porte(m) and confiavel(m)),
        "maior_lacuna_domicilios": rk("gd", filtro=porte),
        "maior_lacuna_saldo": rk("gs", filtro=lambda m: porte(m) and confiavel(m)),
        "mais_concentrado": rk("hhi", filtro=lambda m: (m["ni"] or 0) >= 2 and m["s"]),
    }

    # ---------- matriz de viabilidade, dicionário e limitações ----------
    matriz = [
        {"pergunta": "Quantos domicílios estão sendo pagos, por município",
         "status": "viavel", "selo": "observado",
         "fonte": "Censo 2022, tabela 9930", "obs": "5.570 municípios, sem faltantes."},
        {"pergunta": "Quantos domicílios são alugados, por município",
         "status": "viavel", "selo": "observado",
         "fonte": "Censo 2022, tabela 9930", "obs": "Mesma tabela e mesma cobertura."},
        {"pergunta": "Valor do aluguel pago",
         "status": "indisponivel", "selo": "indisponivel",
         "fonte": "—",
         "obs": "O Censo 2022 não coletou. A classificação 511, de classes de aluguel, não aparece em nenhum agregado de 2022; só existe no Censo 2010 e em faixas."},
        {"pergunta": "Valor da prestação paga pelos domicílios que ainda pagam",
         "status": "indisponivel", "selo": "indisponivel",
         "fonte": "—",
         "obs": "Não coletado pelo Censo 2022. A prestação média publicada pelo BCB é do estoque de contratos, por UF, e não se aplica a este universo."},
        {"pergunta": "Comprometimento de renda observado com moradia",
         "status": "indisponivel", "selo": "indisponivel",
         "fonte": "—",
         "obs": "Exigiria numerador e denominador do mesmo domicílio. Nenhuma base pública oferece isso. A página só apresenta comprometimento como cenário construído pelo usuário."},
        {"pergunta": "Saldo de financiamento imobiliário por município",
         "status": "parcial", "selo": "observado",
         "fonte": "ESTBAN, verbete 169",
         "obs": "Observado, mas contabilizado na dependência bancária e misturando residencial, não residencial, LIG e infraestrutura."},
        {"pergunta": "Saldo residencial de pessoa física",
         "status": "parcial", "selo": "observado",
         "fonte": "Informações do Mercado Imobiliário",
         "obs": "Disponível por UF e por segmento de funding. Não existe em nível municipal."},
        {"pergunta": "Taxa de juros, LTV e prestação média",
         "status": "parcial", "selo": "observado",
         "fonte": "Informações do Mercado Imobiliário",
         "obs": "Observados, mensais, por UF. São médias de contratações ou de estoque, não valores individuais."},
        {"pergunta": "Valor e área do imóvel financiado",
         "status": "parcial", "selo": "observado",
         "fonte": "Informações do Mercado Imobiliário, seção Imóveis",
         "obs": f"Por UF, com defasagem maior que a seção de crédito (data-base {db_mi_imov} contra {db_mi_cred})."},
        {"pergunta": "Número de clientes por instituição",
         "status": "indisponivel", "selo": "indisponivel",
         "fonte": "—",
         "obs": "O ESTBAN publica saldo, não clientes. O SCR publica número de operações por UF, e operação não é cliente."},
        {"pergunta": "Preço de imóveis anunciados",
         "status": "indisponivel", "selo": "indisponivel",
         "fonte": "—",
         "obs": "Bases privadas de anúncios não representam o universo do mercado e não têm licença de uso compatível. Não são utilizadas."},
        {"pergunta": "Déficit habitacional",
         "status": "indisponivel", "selo": "indisponivel",
         "fonte": "—",
         "obs": "É um conceito com metodologia própria (Fundação João Pinheiro), que não se deduz das bases aqui reunidas. A página não o estima."},
    ]

    dicionario = [
        {"t": "Domicílios próprios ainda sendo pagos", "selo": "observado",
         "d": "Domicílios particulares permanentes ocupados cujo morador declarou, no Censo 2022, que o imóvel é próprio de algum morador e ainda está sendo pago.",
         "f": "Censo 2022, tabela 9930, categoria 4343.",
         "l": "Não são contratos bancários. A declaração abrange consórcio, financiamento com construtora ou incorporadora, programas habitacionais, compra parcelada entre particulares e qualquer outra forma de pagamento em curso. O Censo não pergunta quem é o credor."},
        {"t": "Saldo de financiamentos imobiliários contabilizado no município", "selo": "observado",
         "d": "Verbete 169 do ESTBAN, somado sobre todas as dependências bancárias localizadas no município.",
         "f": f"BCB, Estatística Bancária Mensal por Município, data-base {db_estban}.",
         "l": "Não é crédito habitacional: soma imóveis residenciais, não residenciais, carteiras de LIG e financiamentos de infraestrutura, sem separar pessoa física de jurídica. E é o município da agência que escritura, não o do tomador."},
        {"t": "Carteira imobiliária de pessoa física por segmento", "selo": "observado",
         "d": "Saldo da carteira de crédito imobiliário de pessoas físicas, separado por origem dos recursos: SFH, FGTS, taxas de mercado, home equity e imóvel comercial.",
         "f": f"BCB, Informações do Mercado Imobiliário, data-base {db_mi_cred}.",
         "l": "Granularidade máxima é a unidade da federação. Não existe versão municipal."},
        {"t": "Prestação média", "selo": "observado",
         "d": "Valor médio da prestação mensal dos contratos em estoque no segmento e na unidade da federação.",
         "f": f"BCB, Informações do Mercado Imobiliário, data-base {db_mi_cred}.",
         "l": "É média do estoque de contratos ativos, com prazos e datas de contratação distintos. Não é a prestação de um contrato novo, nem se aplica aos domicílios que o Censo registra como ainda sendo pagos."},
        {"t": "LTV de contratação", "selo": "observado",
         "d": "Razão média entre o valor financiado e o valor de avaliação do imóvel, nas operações contratadas no mês.",
         "f": f"BCB, Informações do Mercado Imobiliário, data-base {db_mi_cred}.",
         "l": "Refere-se a novas contratações, não ao estoque."},
        {"t": "Saldo médio por operação em aberto", "selo": "calculado",
         "d": "Saldo da carteira imobiliária de pessoa física dividido pelo número de operações reportadas ao SCR na mesma unidade da federação.",
         "f": "Cálculo sobre SCR.data.",
         "l": "Não é ticket médio nem valor de contrato: operações em aberto têm anos distintos de amortização, e uma pessoa pode ter mais de uma operação."},
        {"t": "Participação no saldo imobiliário contabilizado no município", "selo": "calculado",
         "d": "Saldo do verbete 169 de uma instituição no município, dividido pelo saldo total do verbete 169 naquele município.",
         "f": "Cálculo sobre ESTBAN.",
         "l": "Não é participação de clientes nem de contratos. Mede escrituração contábil."},
        {"t": "Quociente locacional (QL)", "selo": "calculado",
         "d": "QL(b,i) = (saldo da instituição i no município b ÷ saldo total do município b) ÷ (saldo nacional da instituição i ÷ saldo nacional). Igual a 1 significa presença local proporcional à nacional.",
         "f": "Cálculo sobre ESTBAN.",
         "l": f"Publicado apenas para instituições presentes em ao menos {QL_MIN_MUNICIPIOS} municípios — abaixo disso o quociente é alto por aritmética, não por concentração real. O denominador nacional é afetado pela centralização contábil medida nesta página."},
        {"t": "Lacuna de penetração habitacional", "selo": "estimado",
         "d": "Diferença entre a proporção de domicílios ainda sendo pagos observada no município e a mediana dessa proporção em municípios comparáveis, multiplicada pelo total de domicílios.",
         "f": "Modelo de pares sobre o Censo 2022.",
         "l": "Não é demanda comprovada. Pode refletir preferência por aluguel, herança, autoconstrução, informalidade fundiária ou um parque domiciliar mais antigo."},
        {"t": "Lacuna de saldo", "selo": "estimado",
         "d": "Diferença entre a mediana condicional estimada pelo modelo e o saldo do verbete 169 efetivamente contabilizado no município.",
         "f": "Regressão log-log sobre ESTBAN e Censo 2022.",
         "l": "Contrafactual sobre um saldo contábil. Não é demanda comprovada nem prova de restrição de oferta."},
        {"t": "Simulação de prestação", "selo": "cenario",
         "d": "Prestação calculada pelas fórmulas da tabela Price e do sistema SAC sobre parâmetros escolhidos pelo usuário.",
         "f": "Aritmética; parâmetros de partida vindos de valores observados do BCB.",
         "l": "Não é proposta de crédito, não inclui seguros e encargos, e não representa contratos indexados a TR ou a índice de preços."},
    ]

    r_sem_dep = sum(1 for m in muns if m["sel"] == "sem_dependencia")
    limitacoes = [
        "O verbete 169 do ESTBAN não é crédito habitacional residencial de pessoa física: soma quatro rubricas COSIF, incluindo imóveis não residenciais e financiamentos de infraestrutura.",
        f"{_br(concentracao_contabil['part_dessas'])}% do saldo imobiliário nacional está contabilizado em um ou dois municípios, por {concentracao_contabil['instituicoes_ate_2_municipios']} das {concentracao_contabil['instituicoes_total']} instituições com saldo no verbete. O mapa municipal mostra escrituração, não moradia.",
        f"{r_sem_dep} municípios não têm nenhuma dependência bancária reportando saldo imobiliário. Ausência de saldo não é ausência de crédito: é ausência de agência que o contabilize.",
        "As Informações do Mercado Imobiliário do BCB não têm detalhamento municipal. Nenhuma série dessa publicação é apresentada aqui em nível de município.",
        "O Censo 2022 é de julho de 2022; os dados de crédito são das data-bases correntes. A comparação entre os dois é estrutural, não temporal.",
        "O Censo não coletou valor de aluguel nem de prestação. Nenhum comprometimento de renda observado é publicado nesta página.",
        "Domicílios ainda sendo pagos e operações de crédito imobiliário são universos distintos e não devem ser subtraídos um do outro.",
        "As lacunas estimadas são contrafactuais estatísticos, não demanda comprovada.",
    ]

    achados = [
        {"t": "O Brasil é um país de casa própria já paga",
         "d": f"{_br(censo['categorias'][0]['pct'], 1)}% dos domicílios são próprios e já quitados, herdados ou ganhos, e apenas {_br(censo['categorias'][1]['pct'], 1)}% ainda estão sendo pagos. Financiamento habitacional em curso alcança {_br(censo['categorias'][1]['n'] / 1e6, 1)} milhões de domicílios, contra {_br(censo['categorias'][2]['n'] / 1e6, 1)} milhões de alugados.",
         "selo": "observado"},
        {"t": "O crédito imobiliário financia compra, quase nunca construção ou reforma",
         "d": f"Dos recursos direcionados da poupança aplicados em habitação, R$ {_br(brasil['direcionamento']['aquisicao'] / 1e9, 0)} bilhões estão em aquisição, R$ {_br(brasil['direcionamento']['construcao'] / 1e9, 0)} bilhões em construção e R$ {_br(brasil['direcionamento']['reforma_ampliacao'] / 1e9, 1)} bilhão em reforma e ampliação.",
         "selo": "observado"},
        {"t": "É o crédito com menor inadimplência do país",
         "d": f"A inadimplência do SFH é de {_br(brasil['inad'].get('sfh'))}% e a das taxas de mercado, {_br(brasil['inad'].get('livre'))}%. A alienação fiduciária responde pela maior parte das garantias.",
         "selo": "observado"},
        {"t": "Um terço do saldo está escriturado em um ou dois municípios",
         "d": concentracao_contabil["leitura"],
         "selo": "calculado"},
    ]

    resultado = {
        "ok": True,
        "gerado_em": common.now_utc(),
        "modelos": modelos,
        "rankings": rankings,
        "matriz_viabilidade": matriz,
        "dicionario": dicionario,
        "limitacoes": limitacoes,
        "achados": achados,
        "datas": {"censo": 2022, "estban": db_estban, "mi_credito": db_mi_cred,
                  "mi_imoveis": db_mi_imov, "scr": db_scr,
                  "estban_series": list(reversed(datas_estban)),
                  "excluida": {"data_base": DATA_BASE_SUBCOLETADA,
                               "motivo": "data-base subcoletada do ESTBAN, já identificada na auditoria de penetração"}},
        "verbete169": VERBETE_169,
        "censo": censo,
        "brasil": brasil,
        "estados": estados,
        "instituicoes": instituicoes,
        "concentracao_contabil": concentracao_contabil,
        "nomes_instituicoes": nomes_inst,
        "municipios": muns,
        "simulador": _simulador(
            brasil["taxa"].get("sfh"),
            brasil["imoveis"]["valor_compra"],
            brasil["ltv"].get("sfh")),
    }
    resultado["totais"] = {
        "estban169": _r(total_169, 0),
        "municipios_com_saldo": sum(1 for m in muns if m["s"]),
        "municipios_sem_dependencia": sum(1 for m in muns if m["sel"] == "sem_dependencia"),
        "instituicoes_no_169": len(instituicoes),
        "mediana_saldo_por_domicilio": _r(mediana_base, 0),
        "selos": {s: sum(1 for m in muns if m["sel"] == s)
                  for s in ("alta", "media", "baixa", "sem_dependencia")},
    }
    return resultado
