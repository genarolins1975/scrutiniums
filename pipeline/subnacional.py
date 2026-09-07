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


# ---------------------------------------------------------------------------------------------
# Segunda camada (07/09/2026): dívida consolidada dos estados (Siconfi, RGF Anexo 02) e garantias
# da União em operações de crédito (Tesouro Transparente, contratos internos e externos).
# ---------------------------------------------------------------------------------------------
FONTE_SICONFI = {"nome": "Tesouro Nacional — Siconfi, Relatório de Gestão Fiscal, Anexo 02 (dívida consolidada líquida), poder Executivo estadual",
                 "url": "https://www.tesourotransparente.gov.br/ckan/dataset/api-rgf-entes", "api": "https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rgf",
                 "licenca": "dados abertos do Tesouro Nacional", "nivel": "A — declaratório do ente, homologado no Siconfi"}
FONTE_GARANTIAS = {"nome": "Tesouro Nacional — garantias concedidas pela União em operações de crédito internas e externas (contratos desde 2010)",
                   "url": "https://www.tesourotransparente.gov.br/ckan/dataset/garantias-concedidas-em-operacoes-de-credito-internas",
                   "url_externas": "https://www.tesourotransparente.gov.br/ckan/dataset/garantias-concedidas-em-operacoes-de-credito",
                   "licenca": "dados abertos do Tesouro Nacional", "nivel": "A — registro administrativo da STN (CODIV)"}
ROTULO_Q = {0: "saldo do exercício anterior", 1: "1º quadrimestre", 2: "2º quadrimestre", 3: "3º quadrimestre"}


def _divida(con, pop):
    """Dívida consolidada dos 26 estados e do DF: último período publicado por UF e série anual."""
    try:
        rows = con.execute("SELECT cod_ibge, uf, exercicio, quadrimestre, conta, valor FROM siconfi_rgf2").fetchall()
    except Exception as e:
        return {"disponivel": False, "motivo": f"silver do Siconfi indisponível: {e}"}
    if not rows:
        return {"disponivel": False, "motivo": "siconfi_rgf2 vazia: RGF ainda não coletado"}
    d = {}
    for cod, uf, ex, q, conta, v in rows:
        d.setdefault(uf, {}).setdefault((ex, q), {})[conta] = v
    ufs = []
    for uf in sorted(NOMES):
        per = d.get(uf) or {}
        chaves = sorted(k for k in per if k[1] > 0 and per[k].get("dcl") is not None)
        if not chaves:
            ufs.append({"uf": uf, "nome": NOMES[uf], "regiao": REGIOES.get(uf), "disponivel": False})
            continue
        ex, q = chaves[-1]
        c = per[(ex, q)]
        rcl = c.get("rcl_ajustada") or c.get("rcl")
        dcl_rcl = c.get("dcl_rcl_pct") if c.get("dcl_rcl_pct") is not None else (_share(c.get("dcl"), rcl) if rcl else None)
        ant = per.get((ex - 1, 3)) or {}
        dcl_ant = ant.get("dcl")
        p = pop.get(uf)
        ufs.append({
            "uf": uf, "nome": NOMES[uf], "regiao": REGIOES.get(uf), "disponivel": True, "exercicio": ex, "quadrimestre": q, "periodo": f"{ex} · {ROTULO_Q[q]}",
            "dc": c.get("dc"), "dcl": c.get("dcl"), "rcl": rcl, "dcl_rcl_pct": _r(dcl_rcl, 1) if dcl_rcl is not None else None,
            "dc_rcl_pct": c.get("dc_rcl_pct"), "reestruturacao_uniao": c.get("reestruturacao_uniao"),
            "uniao_share_pct": _share(c.get("reestruturacao_uniao"), c.get("dc")) if c.get("dc") else None,
            "emprestimos_internos": c.get("emprestimos_internos"), "emprestimos_externos": c.get("emprestimos_externos"),
            "precatorios_vencidos": c.get("precatorios_vencidos"), "disponibilidade_caixa": c.get("disponibilidade_caixa"),
            "limite_senado": c.get("limite_senado"), "limite_alerta": c.get("limite_alerta"),
            "uso_limite_pct": _share(c.get("dcl"), c.get("limite_senado")) if c.get("limite_senado") else None,
            "acima_alerta": bool(c.get("limite_alerta") and c.get("dcl") is not None and c["dcl"] > c["limite_alerta"]),
            "acima_limite": bool(c.get("limite_senado") and c.get("dcl") is not None and c["dcl"] > c["limite_senado"]),
            "dcl_hab": _r(c["dcl"] / p) if p and c.get("dcl") is not None else None,
            "var_dcl_12m_pct": _r((c["dcl"] / dcl_ant - 1) * 100) if dcl_ant and c.get("dcl") is not None and dcl_ant > 0 else None,
            "serie": [{"ano": e, "dcl_rcl_pct": _r(per[(e, 3)].get("dcl_rcl_pct") if per[(e, 3)].get("dcl_rcl_pct") is not None else _share(per[(e, 3)].get("dcl"), per[(e, 3)].get("rcl_ajustada") or per[(e, 3)].get("rcl")), 1)}
                      for e in sorted({k[0] for k in per}) if (e, 3) in per and per[(e, 3)].get("dcl") is not None],
        })
    disp = [u for u in ufs if u["disponivel"]]
    for k in ("dcl_rcl_pct", "dcl_hab", "dcl"):
        for i, u in enumerate(sorted(disp, key=lambda x: -(x[k] if x[k] is not None else -1e18)), start=1):
            u.setdefault("posicoes", {})[k] = i
    # série anual do agregado: 3º quadrimestre de cada exercício; exercício corrente com o último quadrimestre comum
    anos = sorted({k[0] for per in d.values() for k in per})
    serie = []
    for ex in anos:
        qs = [q for q in (3, 2, 1) if sum(1 for uf in d if (ex, q) in d[uf] and d[uf][(ex, q)].get("dcl") is not None) >= 20]
        if not qs:
            continue
        q = qs[0]
        cs = [d[uf][(ex, q)] for uf in d if (ex, q) in d[uf] and d[uf][(ex, q)].get("dcl") is not None]
        dcl = sum(c["dcl"] for c in cs)
        rcl = sum((c.get("rcl_ajustada") or c.get("rcl") or 0) for c in cs)
        serie.append({"ano": ex, "quadrimestre": q, "n_ufs": len(cs), "dc": sum(c.get("dc") or 0 for c in cs), "dcl": dcl, "rcl": rcl,
                      "dcl_rcl_pct": _share(dcl, rcl) if rcl else None, "reestruturacao_uniao": sum(c.get("reestruturacao_uniao") or 0 for c in cs),
                      "emprestimos_externos": sum(c.get("emprestimos_externos") or 0 for c in cs), "precatorios_vencidos": sum(c.get("precatorios_vencidos") or 0 for c in cs),
                      "parcial": q < 3})
    ult = serie[-1] if serie else {}
    kpis = {"periodo": f"{ult.get('ano')} · {ROTULO_Q.get(ult.get('quadrimestre'), '')}" if ult else None, "n_ufs": ult.get("n_ufs"),
            "dc": ult.get("dc"), "dcl": ult.get("dcl"), "rcl": ult.get("rcl"), "dcl_rcl_pct": ult.get("dcl_rcl_pct"),
            "reestruturacao_uniao": ult.get("reestruturacao_uniao"), "uniao_share_pct": _share(ult.get("reestruturacao_uniao"), ult.get("dc")) if ult.get("dc") else None,
            "ufs_acima_limite": sum(1 for u in disp if u["acima_limite"]), "ufs_acima_alerta": sum(1 for u in disp if u["acima_alerta"]),
            "ufs_acima_limite_lista": [u["uf"] for u in disp if u["acima_limite"]],
            "maior_dcl_rcl": max(disp, key=lambda u: u["dcl_rcl_pct"] or -1e9)["uf"] if disp else None,
            "menor_dcl_rcl": min(disp, key=lambda u: u["dcl_rcl_pct"] if u["dcl_rcl_pct"] is not None else 1e9)["uf"] if disp else None}
    return {"disponivel": True, "fonte": FONTE_SICONFI, "kpis": kpis, "serie_anual": serie, "ufs": ufs,
            "nota": "Poder Executivo de cada estado e do DF, RGF Anexo 02. DCL = dívida consolidada menos deduções (caixa e haveres). O limite do Senado "
                    "(Resolução 40/2001) é 200% da RCL para estados e DF; o limite de alerta é 90% dele. Percentuais são os declarados pelo ente. A linha "
                    "'reestruturação da dívida de estados e municípios' (dívida com a União) existe no plano de contas desde 2017; antes aparece zerada."}


def _garantias(con, ult_mes):
    """Contratos com garantia da União: série anual, por tipo de mutuário, credores, UFs, últimos 12 meses."""
    try:
        rows = [dict(zip(("tipo", "contrato", "ano", "credor", "mutuario", "mutuario_tipo", "uf", "data", "moeda", "valor", "descricao"), r)) for r in
                con.execute("SELECT tipo, contrato, ano, credor, mutuario, mutuario_tipo, uf, data_assinatura, moeda, valor, descricao FROM tesouro_garantias").fetchall()]
        col = dict(con.execute("SELECT tipo, posicao FROM tesouro_garantias_coleta").fetchall())
    except Exception as e:
        return {"disponivel": False, "motivo": f"silver de garantias indisponível: {e}"}
    if not rows:
        return {"disponivel": False, "motivo": "tesouro_garantias vazia: CSVs do Tesouro ainda não coletados"}
    posicao = max(col.values()) if col else None
    intern = [r for r in rows if r["tipo"] == "interna" and r["valor"] is not None]
    extern = [r for r in rows if r["tipo"] == "externa"]
    usd = [r for r in extern if r["moeda"] == "USD" and r["valor"] is not None]
    ENTES = ("Estado", "DF", "Município")
    intern_ent = [r for r in intern if r["mutuario_tipo"] in ENTES]

    def agg(rs, chave, top=None, ordena="valor"):
        a = {}
        for r in rs:
            k = r[chave] or "(não informado)"
            x = a.setdefault(k, {"nome": k, "n": 0, "valor": 0.0})
            x["n"] += 1
            x["valor"] += r["valor"] if r["tipo"] == "interna" and r["valor"] else 0.0
        out = sorted(a.values(), key=lambda x: -x[ordena])
        return out[:top] if top else out

    anos = sorted({r["ano"] for r in rows})
    serie = [{"ano": a, "internas_n": sum(1 for r in intern if r["ano"] == a), "internas_valor": sum(r["valor"] for r in intern if r["ano"] == a),
              "externas_n": sum(1 for r in extern if r["ano"] == a), "externas_usd": sum(r["valor"] for r in usd if r["ano"] == a),
              "estados_valor": sum(r["valor"] for r in intern if r["ano"] == a and r["mutuario_tipo"] in ("Estado", "DF")),
              "municipios_valor": sum(r["valor"] for r in intern if r["ano"] == a and r["mutuario_tipo"] == "Município"),
              "parcial": a == int(posicao[:4]) if posicao else False} for a in anos]
    ini12 = _mes_menos(ult_mes, 11)
    em12 = [r for r in rows if r["data"] and ini12 <= r["data"][:7] <= ult_mes]
    tipos = []
    for t in ("Estado", "DF", "Município", "Outros"):
        rs = [r for r in rows if r["mutuario_tipo"] == t]
        tipos.append({"tipo": t, "n": len(rs), "internas_valor": sum(r["valor"] for r in rs if r["tipo"] == "interna" and r["valor"]),
                      "externas_n": sum(1 for r in rs if r["tipo"] == "externa"), "externas_usd": sum(r["valor"] for r in rs if r["tipo"] == "externa" and r["moeda"] == "USD" and r["valor"])})
    ufs = []
    for uf in sorted(NOMES):
        rs = [r for r in rows if r["uf"] == uf]
        ufs.append({"uf": uf, "nome": NOMES[uf], "n": len(rs), "internas_valor": sum(r["valor"] for r in rs if r["tipo"] == "interna" and r["valor"]),
                    "externas_n": sum(1 for r in rs if r["tipo"] == "externa"), "externas_usd": sum(r["valor"] for r in rs if r["tipo"] == "externa" and r["moeda"] == "USD" and r["valor"]),
                    "estado_n": sum(1 for r in rs if r["mutuario_tipo"] in ("Estado", "DF")), "municipios_n": sum(1 for r in rs if r["mutuario_tipo"] == "Município")})
    for i, u in enumerate(sorted(ufs, key=lambda x: -x["internas_valor"]), start=1):
        u["posicao_internas_valor"] = i
    sem_uf = sum(1 for r in rows if r["mutuario_tipo"] == "Município" and not r["uf"])
    maiores = sorted(intern_ent, key=lambda r: -r["valor"])[:10]
    kpis = {"posicao": posicao, "contratos": len(rows), "internas_n": len(intern), "internas_valor": sum(r["valor"] for r in intern),
            "externas_n": len(extern), "externas_usd": sum(r["valor"] for r in usd), "externas_outras_moedas_n": len(extern) - len(usd),
            "entes_n": sum(1 for r in rows if r["mutuario_tipo"] in ENTES), "entes_internas_valor": sum(r["valor"] for r in intern_ent),
            "outros_internas_valor": sum(r["valor"] for r in intern if r["mutuario_tipo"] == "Outros"),
            "contratos_12m": len(em12), "internas_valor_12m": sum(r["valor"] for r in em12 if r["tipo"] == "interna" and r["valor"]),
            "entes_internas_valor_12m": sum(r["valor"] for r in em12 if r["tipo"] == "interna" and r["valor"] and r["mutuario_tipo"] in ENTES),
            "externas_12m_n": sum(1 for r in em12 if r["tipo"] == "externa"), "municipios_sem_uf": sem_uf,
            "estados_share_valor_pct": _share(sum(r["valor"] for r in intern if r["mutuario_tipo"] in ("Estado", "DF")), sum(r["valor"] for r in intern))}
    return {"disponivel": True, "fonte": FONTE_GARANTIAS, "posicao": posicao, "janela_12m": {"ini": ini12, "fim": ult_mes}, "kpis": kpis, "serie_anual": serie,
            "tipos": tipos, "credores_internas": agg(intern_ent, "credor", 8), "credores_externas": agg([r for r in extern if r["mutuario_tipo"] in ENTES], "credor", 8, "n"), "ufs": ufs,
            "maiores_internas": [{"contrato": r["contrato"], "ano": r["ano"], "credor": r["credor"], "mutuario": r["mutuario"], "uf": r["uf"], "valor": r["valor"], "data": r["data"], "descricao": r["descricao"][:140]} for r in maiores],
            "moedas_externas": [{"moeda": m, "n": sum(1 for r in extern if r["moeda"] == m)} for m in sorted({r["moeda"] for r in extern})],
            "nota": "Credores e maiores contratos consideram só estados, DF e municípios; estatais e bancos públicos garantidos pela União (Correios, BNDES, Caixa, Sabesp) entram nos totais como 'outros'. Só a concessão é publicada em dado aberto: o Tesouro não publica em formato estruturado as garantias honradas (o que a União pagou por "
                    "inadimplência do ente) nem o saldo devedor por contrato. Valores externos ficam na moeda de origem; a soma em dólar cobre só os contratos em dólar."}


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

    divida = _divida(con, pop)
    garantias = _garantias(con, ult_mes)
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
               + (f" A dívida consolidada líquida dos estados somava R$ {_dec(divida['kpis']['dcl'] / 1e9, 0)} bilhões ({_dec(divida['kpis']['dcl_rcl_pct'], 0)}% da receita corrente líquida) em {divida['kpis']['periodo']}; {_dec(divida['kpis']['uniao_share_pct'], 0)}% da dívida bruta é a renegociada com a União e {divida['kpis']['ufs_acima_limite']} UF{'s estão' if divida['kpis']['ufs_acima_limite'] != 1 else ' está'} acima do limite do Senado." if divida.get("disponivel") and divida["kpis"].get("dcl") else "")
               + (f" A União garante {_mil(garantias['kpis']['entes_n'])} contratos de estados e municípios desde 2010, R$ {_dec(garantias['kpis']['entes_internas_valor'] / 1e9, 0)} bilhões nos internos; honras de garantia não são publicadas em dado aberto." if garantias.get("disponivel") else "")
               + (f" Fora da conta, renegociações com a União somaram R$ {_dec(kpis['renegociacao_uniao_12m_valor'] / 1e9)} bilhões no período." if kpis["renegociacao_uniao_12m_valor"] else ""))
    return {
        "disponivel": True, "tipo": "DADO OBSERVADO (Sadipem, STN) + CALCULADO (agregações, shares, posições)",
        "mes": ult_mes, "mes_parcial": mes_max if mes_max > ult_mes else None, "janela_12m": {"ini": ini12, "fim": ult_mes}, "fonte": FONTE, "gerado_em": common.now_utc(),
        "coleta": {"linhas": col[0] if col else len(rows), "paginas": col[1] if col else None, "mb": round(col[2] / 1e6, 1) if col and col[2] else None,
                   "data_status_max": col[3] if col else None, "coletado_em": col[4] if col else None},
        "kpis": kpis, "serie_anual": serie_anual, "serie_mensal": meses,
        "credores_12m": credores_12m, "credores_60m": credores_60m, "finalidades_12m": finalidades_12m, "tipos_credor_12m": tipos_credor_12m,
        "status_12m": status_12m, "moedas_12m": moedas_12m, "ufs": ufs, "maiores_12m": maiores,
        "divida": divida, "garantias": garantias,
        "sintese": sintese,
        "metodo": ("Base inteira de PVLs do Sadipem lida pela API do Tesouro Transparente e substituída a cada coleta. Data de referência é a data do status. "
                   "Mês de referência é o último mês fechado; o mês corrente aparece como parcial. "
                   "Operação liberada = status Deferido, Deferido (PVL-IF), Deferido (decisão judicial) ou Encaminhado à PGFN com manifestação técnica favorável "
                   "(rito das operações com garantia da União: a STN conclui a verificação e a PGFN formaliza a garantia). Arquivado, indeferido e cancelado "
                   "formam 'arquivado'; regularizado à parte; o restante é tramitação, contada só nos últimos 36 meses. "
                   "Crédito de mercado exclui credor União e finalidade de renegociação de dívidas, que ficam numa linha própria. Valores em reais somados; "
                   "moeda estrangeira contada e listada, nunca convertida. Taxa de deferimento = deferidos ÷ (deferidos + arquivados) concluídos na janela. "
                   "Por UF, valor por habitante com a população do IBGE (SIDRA 6579); posições entre as 27 UFs. "
                   "Dívida: RGF Anexo 02 do poder Executivo de cada estado e do DF, último período publicado por UF (API Siconfi); a série anual usa o 3º "
                   "quadrimestre de cada exercício e, no corrente, o último quadrimestre comum a pelo menos 20 UFs. Garantias: contratos internos e externos "
                   "com garantia da União desde 2010 (Tesouro Transparente); mutuário classificado em estado, DF, município e outros; UF pelo nome do estado, "
                   "pelo sufixo do município ou pelo cadastro do IBGE quando o nome é único."),
        "limitacoes": ("Deferimento não é contratação nem desembolso: o Sadipem registra a verificação de limites, não o contrato. Um pleito pode ser "
                       "protocolado, deferido e arquivado em datas diferentes; só a data do status atual é publicada. Operações em moeda estrangeira "
                       "não entram nas somas. Antes de 2017 a base é menos completa (o rito PVL-IF começou depois). Dívida e garantias não se somam ao fluxo de PVLs: são "
                       "estoque declarado pelo ente (RGF) e contratos assinados com garantia da União (CODIV), cada um com a própria data. Garantias honradas e saldo "
                       "devedor por contrato não existem em dado aberto estruturado; municípios homônimos ficam sem UF nos contratos garantidos."),
        "cautelas": [
            "O valor liberado num ano é dominado por poucas operações grandes de estados; compare municípios e estados separadamente.",
            "Renegociação com a União não é crédito novo: é reperfilamento de dívida antiga e fica fora da série de mercado.",
            "Meses recentes mudam: pleitos em tramitação viram deferidos ou arquivados nas coletas seguintes.",
            "DCL sobre RCL é o número declarado pelo ente no RGF; DCL negativa (caixa maior que a dívida) existe e não é erro.",
            "Contrato com garantia da União não é dívida nova no ano da assinatura: o desembolso pode levar anos e o saldo devedor não é publicado.",
        ],
        "catalogo": [
            {"nome": "Operações liberadas", "definicao": "PVLs deferidos ou com manifestação técnica favorável encaminhada à PGFN, crédito de mercado", "unidade": "n e R$", "fonte": "Sadipem (API tt/pvl)", "limitacoes": "não é contratação"},
            {"nome": "Taxa de deferimento", "definicao": "liberados ÷ (liberados + arquivados) concluídos em 12 meses", "unidade": "%", "fonte": "calculado", "limitacoes": "tramitação fora"},
            {"nome": "Em tramitação", "definicao": "pleitos de mercado sem decisão, com status nos últimos 36 meses", "unidade": "n e R$", "fonte": "Sadipem", "limitacoes": "pleitos parados há mais de 3 anos ficam fora"},
            {"nome": "Garantia da União", "definicao": "operações internas ou externas com garantia da União", "unidade": "n e R$", "fonte": "Sadipem (tipo de operação)", "limitacoes": "só deferidas"},
            {"nome": "Renegociação com a União", "definicao": "credor União ou finalidade de renegociação", "unidade": "R$", "fonte": "Sadipem", "limitacoes": "fora da série de mercado"},
            {"nome": "Valor por habitante", "definicao": "valor deferido em 12 meses ÷ população da UF", "unidade": "R$", "fonte": "Sadipem e IBGE SIDRA 6579", "limitacoes": "domicílio do ente"},
            {"nome": "Dívida consolidada líquida (DCL)", "definicao": "dívida consolidada menos deduções (caixa e haveres), poder Executivo estadual", "unidade": "R$ e % da RCL", "fonte": "Siconfi, RGF Anexo 02", "limitacoes": "declarado pelo ente; municípios fora"},
            {"nome": "Dívida com a União", "definicao": "linha 'reestruturação da dívida de estados e municípios' do RGF Anexo 02", "unidade": "R$ e % da DC", "fonte": "Siconfi", "limitacoes": "não inclui garantias honradas"},
            {"nome": "Garantias da União", "definicao": "contratos internos (R$) e externos (moeda de origem) com garantia da União assinados desde 2010", "unidade": "n, R$ e US$", "fonte": "Tesouro Transparente (CODIV)", "limitacoes": "só concessão; honras e saldo devedor não publicados"},
        ],
    }
