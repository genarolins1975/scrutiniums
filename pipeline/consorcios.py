"""Consórcios — gold consorcios.json.

Uma fonte, uma régua: o Panorama de Consórcios do BCB (dados agregados do segmento,
trimestral, 125 métricas por trimestre desde 2015-03). Consórcio é crédito adjacente:
não é operação de crédito do SCR nem entra no crédito ampliado; é poupança coletiva com
contemplação por sorteio ou lance, regulada pelo BCB (Lei 11.795/2008). O painel lê o
segmento como alternativa ao financiamento de veículos e imóveis: quantas cotas, quanto
de carteira, quem contempla, quem sai, quanto custa (taxa de administração) e onde.

Regras:
- Unidades vêm da fonte e três rótulos são corrigidos por conferência aritmética,
  declarados em `conferencias`: métrica 37 ("mi" → mil, porque é a soma de 38 e 39),
  68 ("R$ milhões" → R$ bilhões, porque é a soma de 69 a 72) e 77 ("R$ bilhões" →
  R$ milhões, porque o saldo total de RNP, métrica 73, está em milhões).
- Ausência é nulo: métrica sem valor no trimestre não vira zero.
- Variações: contra o mesmo trimestre do ano anterior e contra o trimestre anterior.
- Por UF: cotas ativas por estado (métricas 99 a 125), share e por mil habitantes com a
  população do Censo 2022 já embutida em ufs.json; posições entre as 27 UFs.
"""
from pipeline import common
from pipeline.ufs import NOMES, REGIOES
from pipeline.fmt import _r, _share, _mil, _dec

FONTE = {"nome": "BCB — Panorama de Consórcios (dados agregados do segmento, API Olinda PANORAMA_DE_CONSORCIOS)",
         "url": "https://olinda.bcb.gov.br/olinda/servico/PANORAMA_DE_CONSORCIOS/versao/v1/odata/",
         "catalogo": "https://dadosabertos.bcb.gov.br/dataset/dados-agregados-do-segmento-de-consorcios",
         "licenca": "dados abertos do BCB", "nivel": "A — estatística oficial do supervisor, trimestral desde 2015"}
UNIDADE_CORRIGIDA = {37: "mil", 68: "R$ bilhões", 77: "R$ milhões"}
FATOR = {"unidade": 1.0, "mil": 1e3, "mi": 1e3, "R$ mil": 1e3, "R$ milhões": 1e6, "R$ bilhões": 1e9, "%": 1.0, "meses": 1.0}
# segmentos: (id, nome, cotas, carteira, contempladas, sorteio, lance, exclusao, comercializadas, taxa_adm, valor_medio, prazo, coletados_12m, a_coletar)
SEGMENTOS = [
    ("imoveis", "Imóveis", 11, 23, 31, 32, 33, 50, [55], 79, 86, 93, 64, 69),
    ("automoveis", "Automóveis", 13, 24, 34, 35, 36, 51, [57], 81, 88, 95, 65, 70),
    ("motos", "Motocicletas", 14, 25, 37, 38, 39, 52, [58], 82, 89, 96, 66, 71),
    ("pesados", "Veículos pesados", 12, None, None, None, None, None, [56], 80, 87, 94, None, None),
    ("outros", "Outros bens e serviços", [15, 16], 27, 40, 41, 42, 53, [59, 60], 83, 90, 97, 67, 72),
]
SERIE_IDS = {"cotas": 10, "carteira": 22, "contempladas_12m": 28, "comercializadas_12m": 54, "inadimplencia": 61, "pre_inadimplencia": 62,
             "exclusao": 49, "coletados_12m": 63, "a_coletar": 68, "taxa_adm": 78, "valor_medio": 85, "prazo": 92, "grupos": 9, "administradoras": 2, "rnp": 73}
UF_IDS = {99: "SP", 100: "MG", 101: "PR", 102: "BA", 103: "RS", 104: "SC", 105: "GO", 106: "RJ", 107: "PA", 108: "MT", 109: "MA", 110: "PE", 111: "CE", 112: "ES",
          113: "MS", 114: "PI", 115: "PB", 116: "DF", 117: "AL", 118: "RO", 119: "TO", 120: "RN", 121: "SE", 122: "AM", 123: "AC", 124: "AP", 125: "RR"}


def _var(v, v0):
    return _r((v / v0 - 1) * 100) if v is not None and v0 else None


def _tri(db):
    return f"{db[:4]}-T{(int(db[4:6]) - 1) // 3 + 1}"


def _tri_menos(db, n):
    y, m = int(db[:4]), int(db[4:6])
    t = y * 12 + (m - 1) - 3 * n
    return f"{t // 12:04d}{t % 12 + 1:02d}"


def _carrega(con):
    por = {}
    for db, i, grupo, metrica, valor, unidade in con.execute("SELECT database, id_metrica, grupo, metrica, valor, unidade FROM consorcios").fetchall():
        u = UNIDADE_CORRIGIDA.get(i, unidade)
        por.setdefault(db, {})[i] = (valor * FATOR.get(u, 1.0) if valor is not None else None, u, metrica)
    return por


def _v(d, i):
    if i is None:
        return None
    if isinstance(i, list):
        vals = [_v(d, k) for k in i]
        return sum(x for x in vals if x is not None) if any(x is not None for x in vals) else None
    x = d.get(i)
    return x[0] if x else None


def build(con, cfg=None):
    por = _carrega(con)
    if not por:
        return {"disponivel": False, "motivo": "silver consorcios vazia — rode o coletor bcb_consorcios"}
    dbs = sorted(por)
    db = dbs[-1]
    d, d4, d1 = por[db], por.get(_tri_menos(db, 4), {}), por.get(_tri_menos(db, 1), {})
    tot = _v(d, 10)
    cart = _v(d, 22)
    # conferências aritméticas das unidades corrigidas (publicadas, nunca escondidas)
    conferencias = [
        {"regra": "cotas ativas: soma das seções (11 a 16) = total (10)", "esquerda": _v(d, [11, 12, 13, 14, 15, 16]), "direita": tot},
        {"regra": "cotas ativas: soma das 27 UFs (99 a 125) = total (10)", "esquerda": _v(d, list(UF_IDS)), "direita": tot},
        {"regra": "carteira: imóveis (23) + veículos automotores (26) + outros (27) = total (22)", "esquerda": _v(d, [23, 26, 27]), "direita": cart},
        {"regra": "contempladas motos: sorteio (38) + lance (39) = total (37, rótulo 'mi' lido como mil)", "esquerda": _v(d, [38, 39]), "direita": _v(d, 37)},
        {"regra": "recursos a coletar: soma das seções (69 a 72) = total (68, rótulo 'R$ milhões' lido como R$ bilhões)", "esquerda": _v(d, [69, 70, 71, 72]), "direita": _v(d, 68)},
    ]
    for c in conferencias:
        c["diferenca_pct"] = _share((c["esquerda"] or 0) - (c["direita"] or 0), c["direita"])
    segmentos = []
    for sid, nome, c_cotas, c_cart, c_cont, c_sort, c_lance, c_excl, c_com, c_taxa, c_vm, c_prazo, c_col, c_acol in SEGMENTOS:
        cotas = _v(d, c_cotas)
        cont = _v(d, c_cont)
        segmentos.append({
            "id": sid, "nome": nome,
            "cotas": cotas, "share_cotas": _share(cotas, tot), "var_12m_cotas_pct": _var(cotas, _v(d4, c_cotas)),
            "carteira": _v(d, c_cart), "share_carteira": _share(_v(d, c_cart), cart), "var_12m_carteira_pct": _var(_v(d, c_cart), _v(d4, c_cart)),
            "contempladas_12m": cont, "sorteio_share": _share(_v(d, c_sort), cont), "lance_share": _share(_v(d, c_lance), cont),
            "contemplacao_12m_pct": _share(cont, cotas),
            "exclusao_pct": _v(d, c_excl), "comercializadas_12m": _v(d, c_com), "var_12m_comercializadas_pct": _var(_v(d, c_com), _v(d4, c_com)),
            "taxa_adm_pct": _v(d, c_taxa), "valor_medio": _v(d, c_vm), "prazo_meses": _v(d, c_prazo),
            "coletados_12m": _v(d, c_col), "a_coletar": _v(d, c_acol),
        })
    # veículos pesados: carteira e recursos não são publicados em separado; a diferença (26 − 24 − 25) é
    # "veículos pesados e comerciais leves" e fica declarada como tal, não atribuída ao segmento
    pesados_cl = None
    if _v(d, 26) is not None and _v(d, 24) is not None and _v(d, 25) is not None:
        pesados_cl = _v(d, 26) - _v(d, 24) - _v(d, 25)
    serie = []
    for x in dbs:
        p = {"ref": _tri(x), "database": x}
        for k, i in SERIE_IDS.items():
            p[k] = _v(por[x], i)
        p["cotas_imoveis"] = _v(por[x], 11); p["cotas_automoveis"] = _v(por[x], 13); p["cotas_motos"] = _v(por[x], 14)
        p["carteira_imoveis"] = _v(por[x], 23); p["carteira_automoveis"] = _v(por[x], 24)
        serie.append(p)
    # UFs
    pop = {u["uf"]: u.get("pop") for u in ((common.ler_gold_opcional("ufs.json") or {}).get("ufs") or [])}
    ufs = []
    for i, uf in UF_IDS.items():
        c = _v(d, i)
        ufs.append({"uf": uf, "nome": NOMES.get(uf, uf), "regiao": REGIOES.get(uf), "cotas": c, "share": _share(c, tot),
                    "var_12m_pct": _var(c, _v(d4, i)), "por_mil_hab": _r(c / pop[uf] * 1e3, 1) if c is not None and pop.get(uf) else None})
    for chave in ("cotas", "por_mil_hab"):
        ordem = sorted([u for u in ufs if u[chave] is not None], key=lambda u: -u[chave])
        for k, u in enumerate(ordem):
            u.setdefault("posicoes", {})[chave] = k + 1
    ufs.sort(key=lambda u: -(u["cotas"] or 0))
    br_pop = sum(v for v in pop.values() if v)
    # síntese
    seg_im = next(s for s in segmentos if s["id"] == "imoveis"); seg_au = next(s for s in segmentos if s["id"] == "automoveis")
    top_uf = ufs[0] if ufs else None
    sintese = (f"O sistema de consórcios tinha {_mil(tot)} cotas ativas em {_tri(db)} ({'+' if _var(tot, _v(d4, 10)) >= 0 else ''}{_dec(_var(tot, _v(d4, 10)))}% em 12 meses), "
               f"em {_mil(_v(d, 9))} grupos de {_mil(_v(d, 2))} administradoras, com carteira de R$ {_dec(cart / 1e9)} bilhões e R$ {_dec(_v(d, 68) / 1e9, 0)} bilhões a coletar. "
               f"Imóveis são {_dec(seg_im['share_cotas'], 0)}% das cotas e {_dec(seg_im['share_carteira'], 0)}% da carteira; automóveis, {_dec(seg_au['share_cotas'], 0)}% e {_dec(seg_au['share_carteira'], 0)}%. "
               f"Em 12 meses foram contempladas {_mil(_v(d, 28))} cotas ({_dec(_share(_v(d, 30), _v(d, 28)), 0)}% por lance) e comercializadas {_mil(_v(d, 54))}; "
               f"inadimplência de {_dec(_v(d, 61))}% e índice de exclusão de {_dec(_v(d, 49))}%; taxa média de administração dos grupos novos de {_dec(_v(d, 78))}%."
               + (f" {top_uf['nome']} concentra {_dec(top_uf['share'], 0)}% das cotas." if top_uf else ""))
    return {
        "disponivel": True, "tipo": "DADO OBSERVADO (Panorama do BCB) + CALCULADO (shares, variações, por habitante, posições)",
        "trimestre": _tri(db), "database": db, "fonte": FONTE,
        "panorama": {
            "administradoras_autorizadas": _v(d, 1), "administradoras_ativas": _v(d, 2), "pla": _v(d, 3), "disponibilidade_total": _v(d, 4), "grupos": _v(d, 9),
            "cotas": tot, "var_12m_cotas_pct": _var(tot, _v(d4, 10)), "var_tri_cotas_pct": _var(tot, _v(d1, 10)),
            "carteira": cart, "var_12m_carteira_pct": _var(cart, _v(d4, 22)),
            "contempladas_12m": _v(d, 28), "sorteio_share": _share(_v(d, 29), _v(d, 28)), "lance_share": _share(_v(d, 30), _v(d, 28)), "contemplacao_12m_pct": _share(_v(d, 28), tot),
            "excluidas": _v(d, 43), "exclusao_pct": _v(d, 49), "comercializadas_12m": _v(d, 54), "var_12m_comercializadas_pct": _var(_v(d, 54), _v(d4, 54)),
            "inadimplencia_pct": _v(d, 61), "pre_inadimplencia_pct": _v(d, 62), "inadimplencia_12m_atras_pct": _v(d4, 61),
            "coletados_12m": _v(d, 63), "a_coletar": _v(d, 68), "rnp_saldo": _v(d, 73), "rnp_taxa_permanencia_pct": _v(d, 75), "rnp_devolvido_svr": _v(d, 77),
            "taxa_adm_pct": _v(d, 78), "valor_medio": _v(d, 85), "prazo_meses": _v(d, 92),
            "carteira_pesados_e_comerciais_leves": pesados_cl,
        },
        "segmentos": segmentos, "serie": serie, "ufs": ufs, "cotas_por_mil_hab_br": _r(tot / br_pop * 1e3, 1) if br_pop else None,
        "conferencias": conferencias, "unidades_corrigidas": {str(k): v for k, v in UNIDADE_CORRIGIDA.items()},
        "sintese": sintese,
        "metodo": ("Panorama de Consórcios do BCB, trimestral: 125 métricas por trimestre lidas com a unidade publicada, convertidas para unidades "
                   "e R$. Três rótulos de unidade são corrigidos por conferência aritmética e as conferências são publicadas. Shares sobre o total do "
                   "trimestre; variações contra o mesmo trimestre do ano anterior; contemplação em 12 meses ÷ cotas ativas; por UF, cotas ativas ÷ "
                   "população do Censo 2022 (via ufs.json). 'Grupos constituídos nos últimos 12 meses' é a base de taxa de administração, valor médio "
                   "e prazo médio: descrevem o produto novo, não o estoque."),
        "limitacoes": ("Não há corte por administradora nem por município; a carteira de veículos pesados não é publicada em separado (fica em "
                       "'veículos automotores' junto com comerciais leves e motos). Índice de exclusão e inadimplência são definições do BCB para o "
                       "segmento e não se comparam com a inadimplência do SCR. As séries anuais do SGS sobre consórcios (27452 a 27499) pararam em "
                       "2022 e ficaram fora."),
        "cautelas": [
            "Consórcio não é crédito: não há juros nem desembolso antes da contemplação; comparar taxa de administração com taxa de juros compara coisas diferentes.",
            "Cota ativa não é cota contemplada: a carteira mede o que já foi contemplado e ainda é devido; recursos a coletar medem o compromisso total.",
            "Exclusão alta (quase metade das cotas ao longo da vida do grupo) é característica do produto, não sinal de crise.",
        ],
        "catalogo": [
            {"nome": "Cotas ativas", "definicao": "cotas de grupos em andamento, contempladas ou não, no fim do trimestre", "unidade": "cotas", "fonte": "BCB Panorama (10 a 21, 99 a 125)", "limitacoes": "sem corte por administradora"},
            {"nome": "Carteira", "definicao": "créditos já contemplados e ainda devidos ao grupo", "unidade": "R$", "fonte": "BCB Panorama (22 a 27)", "limitacoes": "pesados não separados"},
            {"nome": "Recursos a coletar", "definicao": "parcelas futuras de todas as cotas ativas", "unidade": "R$", "fonte": "BCB Panorama (68 a 72)", "limitacoes": "rótulo do total corrigido"},
            {"nome": "Contempladas em 12 meses", "definicao": "cotas contempladas por sorteio ou lance nos 12 meses", "unidade": "cotas", "fonte": "BCB Panorama (28 a 42)", "limitacoes": "motos com rótulo corrigido"},
            {"nome": "Índice de exclusão", "definicao": "cotas excluídas ÷ cotas comercializadas, definição do BCB", "unidade": "%", "fonte": "BCB Panorama (49 a 53)", "limitacoes": "não é inadimplência do SCR"},
            {"nome": "Taxa de administração, valor médio e prazo", "definicao": "médias dos grupos constituídos nos últimos 12 meses", "unidade": "% · R$ · meses", "fonte": "BCB Panorama (78 a 98)", "limitacoes": "produto novo, não estoque"},
        ],
    }
