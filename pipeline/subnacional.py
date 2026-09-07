"""Crédito a estados e municípios — gold subnacional.json.

Uma fonte: os pedidos de verificação de limites e condições (PVL) do Sadipem, Tesouro Nacional
(pipeline/sources/sadipem.py). Antes de contratar crédito, estado, DF ou município passa pela
verificação da LRF e das Resoluções 40 e 43 do Senado, feita pela STN ou pelo banco credor
(rito PVL-IF). O painel lê esse fluxo: quem pediu, para quê, com quem, quanto, e o que a
verificação decidiu.

Regras:
- Data de referência é a data do status: o mês em que a análise chegou ao estado atual. Um
  pleito muda de status (em tramitação vira deferido ou arquivado), e a base é substituída
  inteira a cada coleta; por isso os números de meses recentes podem mudar.
- Operação liberada: "Deferido", "Deferido (PVL-IF)", "Deferido (decisão judicial)" e "Encaminhado à
  PGFN com manifestação técnica favorável". O último é o desfecho da STN nas operações com garantia
  da União (quase todas de estados): a verificação termina favorável e o processo segue para a PGFN
  formalizar a garantia; sem ele, os estados sumiriam do painel (R$ 72 bilhões em 24 meses, contra
  R$ 2 bilhões em "Deferido" puro, sondagem de 07/09/2026). Não é contratação: o Sadipem não diz
  se o contrato foi assinado.
- Crédito de mercado é o que este painel mede: credor diferente da União e finalidade diferente
  de renegociação de dívidas. A renegociação com a União (R$ 223 bilhões de São Paulo em
  2017, R$ 69 bilhões do Rio Grande do Sul em 2020) entra numa linha própria; somada ao resto,
  esconderia tudo.
- Valores em reais são somados; operações em moeda estrangeira (dólar, euro, iene, SDR) são
  contadas e listadas, nunca convertidas.
- Por UF com população do IBGE (geo_uf, SIDRA 6579) para o valor por habitante; posições entre
  as 27 UFs dentro do mesmo bloco.
"""
from pipeline import common
from pipeline.fmt import _r, _share, _dec, _mil, _mes_menos
from pipeline.ufs import NOMES, REGIOES

FONTE = {"nome": "Tesouro Nacional — Sadipem, análises de operações de crédito de estados e municípios (API Tesouro Transparente)",
         "url": "https://www.tesourotransparente.gov.br/ckan/dataset/analises-de-operacoes-de-credito-de-estados-e-municipios",
         "api": "https://apidatalake.tesouro.gov.br/ords/sadipem/tt/pvl",
         "licenca": "dados abertos do Tesouro Nacional", "nivel": "A — registro administrativo da STN, atualizado continuamente"}
DEFERIDO = ("Deferido", "Deferido (PVL-IF)", "Deferido (decisão judicial)")
PGFN_FAVORAVEL = "Encaminhado à PGFN com manifestação técnica favorável"
ARQUIVADO_PREFIXOS = ("Arquivado", "Indeferido", "Devolvido", "Cancelado")
LIBERADO = ("deferido", "pgfn")
GRUPOS_STATUS = [("deferido", "Deferido: limites verificados, operação liberada"),
                 ("pgfn", "Manifestação técnica favorável, encaminhado à PGFN (garantia da União)"),
                 ("arquivado", "Arquivado, indeferido ou cancelado"),
                 ("regularizado", "Regularizado (operação contratada sem PVL prévio, depois regularizada)"),
                 ("tramitacao", "Em análise ou em retificação")]
TRAMITACAO_MESES = 36  # pleito parado há mais de 3 anos sem decisão não entra no estoque em tramitação


def _grupo_status(s):
    s = s or ""
    if s in DEFERIDO:
        return "deferido"
    if s == PGFN_FAVORAVEL:
        return "pgfn"
    if s.startswith(ARQUIVADO_PREFIXOS):
        return "arquivado"
    if s.startswith(("Regularizado", "Regular por")):
        return "regularizado"
    return "tramitacao"


def _mercado(r):
    return (r["credor"] or "") != "União" and not (r["finalidade"] or "").lower().startswith("renegocia")


def build(con, cfg=None):
    try:
        cols = ["id_pleito", "tipo_interessado", "interessado", "cod_ibge", "uf", "num_pvl", "status", "data_protocolo", "tipo_operacao",
                "finalidade", "tipo_credor", "credor", "moeda", "valor", "data_status"]
        rows = [dict(zip(cols, r)) for r in con.execute(f"SELECT {', '.join(cols)} FROM sadipem_pvl WHERE data_status IS NOT NULL").fetchall()]
        col = con.execute("SELECT linhas, paginas, bytes, data_status_max, coletado_em FROM sadipem_coleta WHERE fonte='pvl'").fetchone()
    except Exception as e:
        return {"disponivel": False, "motivo": f"silver do Sadipem indisponível: {e}"}
    if not rows:
        return {"disponivel": False, "motivo": "sadipem_pvl vazia: API do Tesouro ainda não coletada"}
    pop = {}
    try:
        pop = {u: p for u, p in con.execute("SELECT uf, populacao FROM geo_uf").fetchall() if p}
    except Exception:
        pass
    for r in rows:
        r["mes"] = r["data_status"][:7]
        r["ano"] = r["data_status"][:4]
        r["grupo"] = _grupo_status(r["status"])
        r["mercado"] = _mercado(r)
        r["real"] = r["moeda"] == "Real" and isinstance(r["valor"], (int, float))
        r["garantia_uniao"] = "garantia da União" in (r["tipo_operacao"] or "")
        r["externa"] = "externa" in (r["tipo_operacao"] or "") or (r["tipo_credor"] or "") == "Instituição Financeira Internacional"
    mes_max = max(r["mes"] for r in rows)
    ult_mes = _mes_menos(mes_max, 1)  # último mês fechado: a base é contínua e o mês corrente está sempre parcial
    ini12 = _mes_menos(ult_mes, 11)
    ini12_ant = _mes_menos(ult_mes, 23)
    em12 = [r for r in rows if ini12 <= r["mes"] <= ult_mes]
    em12_ant = [r for r in rows if ini12_ant <= r["mes"] < ini12]
    ini60 = _mes_menos(ult_mes, 59)
    em60 = [r for r in rows if ini60 <= r["mes"] <= ult_mes]

    def soma(rs):
        return sum(r["valor"] for r in rs if r["real"])

    def_m = [r for r in em12 if r["grupo"] in LIBERADO and r["mercado"]]
    def_m_ant = [r for r in em12_ant if r["grupo"] in LIBERADO and r["mercado"]]
    concl = [r for r in em12 if r["grupo"] in ("deferido", "pgfn", "arquivado")]
    reneg = [r for r in em12 if r["grupo"] in LIBERADO and not r["mercado"]]
    ini_tram = _mes_menos(ult_mes, TRAMITACAO_MESES - 1)
    tram = [r for r in rows if r["grupo"] == "tramitacao" and r["mercado"] and r["mes"] >= ini_tram]
    pgfn = [r for r in def_m if r["grupo"] == "pgfn"]
    kpis = {
        "mes": ult_mes, "deferidos_12m_n": len(def_m), "deferidos_12m_valor": soma(def_m),
        "pgfn_12m_n": len(pgfn), "pgfn_12m_valor": soma(pgfn),
        "var_12m_valor_pct": _r((soma(def_m) / soma(def_m_ant) - 1) * 100) if soma(def_m_ant) else None,
        "var_12m_n_pct": _r((len(def_m) / len(def_m_ant) - 1) * 100) if def_m_ant else None,
        "municipios_12m_valor": soma([r for r in def_m if r["tipo_interessado"] == "Município"]),
        "estados_12m_valor": soma([r for r in def_m if r["tipo_interessado"] != "Município"]),
        "municipios_12m_n": sum(1 for r in def_m if r["tipo_interessado"] == "Município"),
        "estados_12m_n": sum(1 for r in def_m if r["tipo_interessado"] != "Município"),
        "garantia_uniao_12m_n": sum(1 for r in def_m if r["garantia_uniao"]), "garantia_uniao_12m_valor": soma([r for r in def_m if r["garantia_uniao"]]),
        "externas_12m_n": sum(1 for r in def_m if r["externa"]), "moeda_estrangeira_12m_n": sum(1 for r in def_m if not r["real"]),
        "taxa_deferimento_12m_pct": _share(sum(1 for r in concl if r["grupo"] in LIBERADO), len(concl)) if concl else None,
        "concluidos_12m_n": len(concl),
        "em_tramitacao_n": len(tram), "em_tramitacao_valor": soma(tram), "em_tramitacao_desde": ini_tram,
        "renegociacao_uniao_12m_n": len(reneg), "renegociacao_uniao_12m_valor": soma(reneg),
        "entes_12m": len({(r["cod_ibge"], r["interessado"]) for r in def_m}),
    }

    # série anual: mercado deferido (n, valor), por tipo de interessado; renegociação com a União; externas
    anos = sorted({r["ano"] for r in rows if r["ano"] >= "2008"})
    serie_anual = []
    for a in anos:
        ra = [r for r in rows if r["ano"] == a]
        dm = [r for r in ra if r["grupo"] in LIBERADO and r["mercado"]]
        serie_anual.append({"ano": a, "deferidos_n": len(dm), "deferidos_valor": soma(dm),
                            "municipios_valor": soma([r for r in dm if r["tipo_interessado"] == "Município"]),
                            "estados_valor": soma([r for r in dm if r["tipo_interessado"] != "Município"]),
                            "garantia_uniao_valor": soma([r for r in dm if r["garantia_uniao"]]),
                            "externas_n": sum(1 for r in dm if r["externa"]),
                            "pgfn_valor": soma([r for r in dm if r["grupo"] == "pgfn"]),
                            "renegociacao_uniao_valor": soma([r for r in ra if r["grupo"] in LIBERADO and not r["mercado"]]),
                            "arquivados_n": sum(1 for r in ra if r["grupo"] == "arquivado"), "parcial": a == mes_max[:4]})
    # série mensal, 36 meses fechados mais o mês corrente parcial, mercado liberado
    meses = []
    m = _mes_menos(ult_mes, 35)
    while m <= mes_max:
        rm = [r for r in rows if r["mes"] == m and r["grupo"] in LIBERADO and r["mercado"]]
        meses.append({"mes": m, "n": len(rm), "valor": soma(rm), "municipios_valor": soma([r for r in rm if r["tipo_interessado"] == "Município"]),
                      "parcial": m > ult_mes})
        m = _mes_menos(m, -1)

    def ranking(rs, chave, top, base):
        agg = {}
        for r in rs:
            k = r[chave] or "(não informado)"
            a = agg.setdefault(k, {"nome": k, "n": 0, "valor": 0.0, "estados_n": 0, "municipios_n": 0})
            a["n"] += 1
            a["valor"] += r["valor"] if r["real"] else 0.0
            a["estados_n" if r["tipo_interessado"] != "Município" else "municipios_n"] += 1
        out = sorted(agg.values(), key=lambda x: -x["valor"])[:top]
        for x in out:
            x["share_valor_pct"] = _share(x["valor"], base)
            x["share_n_pct"] = _share(x["n"], len(rs))
        return out

    lib60 = [r for r in em60 if r["grupo"] in LIBERADO and r["mercado"]]
    base12, base60 = soma(def_m), soma(lib60)
    credores_12m = ranking(def_m, "credor", 12, base12)
    credores_60m = ranking(lib60, "credor", 12, base60)
    finalidades_12m = ranking(def_m, "finalidade", 12, base12)
    tipos_credor_12m = ranking(def_m, "tipo_credor", 8, base12)
    status_12m = []
    for gid, nome in GRUPOS_STATUS:
        rs = [r for r in em12 if r["grupo"] == gid and r["mercado"]]
        status_12m.append({"id": gid, "nome": nome, "n": len(rs), "valor": soma(rs), "share_n_pct": _share(len(rs), sum(1 for r in em12 if r["mercado"]))})
    moedas_12m = []
    for md in sorted({r["moeda"] for r in def_m if not r["real"]}):
        rs = [r for r in def_m if r["moeda"] == md]
        moedas_12m.append({"moeda": md, "n": len(rs), "valor_na_moeda": sum(r["valor"] for r in rs if isinstance(r["valor"], (int, float)))})

    ufs = []
    for uf in sorted(NOMES):
        rs = [r for r in def_m if r["uf"] == uf]
        v = soma(rs)
        p = pop.get(uf)
        ufs.append({"uf": uf, "nome": NOMES[uf], "regiao": REGIOES.get(uf), "n": len(rs), "valor": v, "share_valor_pct": _share(v, base12),
                    "municipios_n": sum(1 for r in rs if r["tipo_interessado"] == "Município"), "estado_n": sum(1 for r in rs if r["tipo_interessado"] != "Município"),
                    "estado_valor": soma([r for r in rs if r["tipo_interessado"] != "Município"]),
                    "valor_hab": _r(v / p, 2) if p else None, "entes": len({r["cod_ibge"] for r in rs}),
                    "credor_principal": (ranking(rs, "credor", 1, v)[0]["nome"] if rs else None)})
    for k in ("valor", "valor_hab", "n"):
        for i, u in enumerate(sorted(ufs, key=lambda x: -(x[k] if x[k] is not None else -1)), start=1):
            u.setdefault("posicoes", {})[k] = i
    maiores = sorted([r for r in def_m if r["real"]], key=lambda r: -r["valor"])[:12]
    maiores = [{"interessado": r["interessado"], "uf": r["uf"], "tipo_interessado": r["tipo_interessado"], "credor": r["credor"], "finalidade": r["finalidade"],
                "tipo_operacao": r["tipo_operacao"], "valor": r["valor"], "data_status": r["data_status"], "num_pvl": r["num_pvl"]} for r in maiores]

    top_cred = credores_12m[0] if credores_12m else None
    top_fin = finalidades_12m[0] if finalidades_12m else None
    top_uf = max(ufs, key=lambda u: u["valor"]) if ufs else None
    sintese = (f"Em 12 meses até {ult_mes}, a verificação de limites liberou {_mil(kpis['deferidos_12m_n'])} operações de crédito de mercado para "
               f"{_mil(kpis['entes_12m'])} estados e municípios, R$ {_dec(kpis['deferidos_12m_valor'] / 1e9)} bilhões"
               + (f" ({'+' if kpis['var_12m_valor_pct'] >= 0 else ''}{_dec(kpis['var_12m_valor_pct'], 0)}% sobre os 12 meses anteriores)" if kpis["var_12m_valor_pct"] is not None else "") + "."
               + (f" Municípios são {_dec(_share(kpis['municipios_12m_valor'], kpis['deferidos_12m_valor']), 0)}% do valor e {_dec(_share(kpis['municipios_12m_n'], kpis['deferidos_12m_n']), 0)}% das operações." if kpis["deferidos_12m_valor"] else "")
               + (f" O maior credor é {top_cred['nome']} ({_dec(top_cred['share_valor_pct'], 0)}% do valor) e a maior finalidade, {top_fin['nome'].lower()} ({_dec(top_fin['share_valor_pct'], 0)}%)." if top_cred and top_fin else "")
               + (f" {top_uf['nome']} concentra {_dec(top_uf['share_valor_pct'], 0)}% do valor liberado." if top_uf and top_uf["valor"] else "")
               + (f" A taxa de deferimento entre os pleitos concluídos foi de {_dec(kpis['taxa_deferimento_12m_pct'], 0)}%." if kpis["taxa_deferimento_12m_pct"] is not None else "")
               + (f" Operações com garantia da União, de estados na maior parte, respondem por R$ {_dec(kpis['pgfn_12m_valor'] / 1e9)} bilhões ({_dec(_share(kpis['pgfn_12m_valor'], kpis['deferidos_12m_valor']), 0)}% do valor)." if kpis["pgfn_12m_valor"] and kpis["deferidos_12m_valor"] else "")
               + (f" Fora da conta, renegociações com a União somaram R$ {_dec(kpis['renegociacao_uniao_12m_valor'] / 1e9)} bilhões no período." if kpis["renegociacao_uniao_12m_valor"] else ""))
    return {
        "disponivel": True, "tipo": "DADO OBSERVADO (Sadipem, STN) + CALCULADO (agregações, shares, posições)",
        "mes": ult_mes, "mes_parcial": mes_max if mes_max > ult_mes else None, "janela_12m": {"ini": ini12, "fim": ult_mes}, "fonte": FONTE, "gerado_em": common.now_utc(),
        "coleta": {"linhas": col[0] if col else len(rows), "paginas": col[1] if col else None, "mb": round(col[2] / 1e6, 1) if col and col[2] else None,
                   "data_status_max": col[3] if col else None, "coletado_em": col[4] if col else None},
        "kpis": kpis, "serie_anual": serie_anual, "serie_mensal": meses,
        "credores_12m": credores_12m, "credores_60m": credores_60m, "finalidades_12m": finalidades_12m, "tipos_credor_12m": tipos_credor_12m,
        "status_12m": status_12m, "moedas_12m": moedas_12m, "ufs": ufs, "maiores_12m": maiores,
        "sintese": sintese,
        "metodo": ("Base inteira de PVLs do Sadipem lida pela API do Tesouro Transparente e substituída a cada coleta. Data de referência é a data do status. "
                   "Mês de referência é o último mês fechado; o mês corrente aparece como parcial. "
                   "Operação liberada = status Deferido, Deferido (PVL-IF), Deferido (decisão judicial) ou Encaminhado à PGFN com manifestação técnica favorável "
                   "(rito das operações com garantia da União: a STN conclui a verificação e a PGFN formaliza a garantia). Arquivado, indeferido e cancelado "
                   "formam 'arquivado'; regularizado à parte; o restante é tramitação, contada só nos últimos 36 meses. "
                   "Crédito de mercado exclui credor União e finalidade de renegociação de dívidas, que ficam numa linha própria. Valores em reais somados; "
                   "moeda estrangeira contada e listada, nunca convertida. Taxa de deferimento = deferidos ÷ (deferidos + arquivados) concluídos na janela. "
                   "Por UF, valor por habitante com a população do IBGE (SIDRA 6579); posições entre as 27 UFs."),
        "limitacoes": ("Deferimento não é contratação nem desembolso: o Sadipem registra a verificação de limites, não o contrato. Um pleito pode ser "
                       "protocolado, deferido e arquivado em datas diferentes; só a data do status atual é publicada. Operações em moeda estrangeira "
                       "não entram nas somas. Antes de 2017 a base é menos completa (o rito PVL-IF começou depois)."),
        "cautelas": [
            "O valor liberado num ano é dominado por poucas operações grandes de estados; compare municípios e estados separadamente.",
            "Renegociação com a União não é crédito novo: é reperfilamento de dívida antiga e fica fora da série de mercado.",
            "Meses recentes mudam: pleitos em tramitação viram deferidos ou arquivados nas coletas seguintes.",
        ],
        "catalogo": [
            {"nome": "Operações liberadas", "definicao": "PVLs deferidos ou com manifestação técnica favorável encaminhada à PGFN, crédito de mercado", "unidade": "n e R$", "fonte": "Sadipem (API tt/pvl)", "limitacoes": "não é contratação"},
            {"nome": "Taxa de deferimento", "definicao": "liberados ÷ (liberados + arquivados) concluídos em 12 meses", "unidade": "%", "fonte": "calculado", "limitacoes": "tramitação fora"},
            {"nome": "Em tramitação", "definicao": "pleitos de mercado sem decisão, com status nos últimos 36 meses", "unidade": "n e R$", "fonte": "Sadipem", "limitacoes": "pleitos parados há mais de 3 anos ficam fora"},
            {"nome": "Garantia da União", "definicao": "operações internas ou externas com garantia da União", "unidade": "n e R$", "fonte": "Sadipem (tipo de operação)", "limitacoes": "só deferidas"},
            {"nome": "Renegociação com a União", "definicao": "credor União ou finalidade de renegociação", "unidade": "R$", "fonte": "Sadipem", "limitacoes": "fora da série de mercado"},
            {"nome": "Valor por habitante", "definicao": "valor deferido em 12 meses ÷ população da UF", "unidade": "R$", "fonte": "Sadipem e IBGE SIDRA 6579", "limitacoes": "domicílio do ente"},
        ],
    }
