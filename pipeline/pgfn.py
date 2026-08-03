"""Gold da Dívida Ativa da União: agrega os fatos de pgfn_* num único pgfn.json.

O que este módulo protege, além de somar direito (ver docs/AUDITORIA_PGFN.md):

* **Universo separado.** Dívida ativa é crédito tributário da União. Não é carteira do
  SFN, não entra em nenhuma conta com SCR.data nem com as séries do SGS, e o painel diz
  isso antes do primeiro número.
* **Safra ≠ fluxo.** A série por data de inscrição é o que *sobrou* de cada safra na
  fotografia atual, não quantas inscrições houve no período. Cada objeto que carrega
  essa série carrega também o aviso.
* **Nada de pessoa.** Só chegam aqui contagens e somas; nenhum nome, documento ou número
  de inscrição existe nas tabelas de origem.
"""
from pipeline import common

CONJUNTOS = [
    ("nao_previdenciario", "Não previdenciário", "tributos federais administrados pela RFB, exceto contribuições previdenciárias"),
    ("previdenciario", "Previdenciário", "contribuições previdenciárias inscritas em dívida ativa"),
    ("fgts", "FGTS", "contribuições de FGTS não recolhidas, cobradas pela PGFN"),
]

AVISO_SAFRA = ("Estoque remanescente por safra, não fluxo de novas inscrições. Cada arquivo é uma "
               "fotografia do que ainda estava em cobrança na data-base: inscrições quitadas, "
               "canceladas ou extintas desaparecem. Safras antigas aparecem menores do que foram, "
               "porque o que sobrou delas é justamente o que ninguém pagou.")

AVISO_UNIVERSO = ("Dívida ativa da União é crédito tributário, não carteira do Sistema Financeiro "
                  "Nacional. Não some estes valores ao saldo de crédito do SCR.data nem às séries do "
                  "SGS: são universos, devedores e conceitos diferentes.")


def _rows(con, sql, args=()):
    cur = con.execute(sql, args)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def build(con, cfg=None):
    exec_ = _rows(con, "SELECT * FROM pgfn_execucao ORDER BY trimestre DESC, conjunto")
    if not exec_:
        common.write_gold("pgfn.json", {"disponivel": False,
                                        "motivo": "nenhum trimestre absorvido — rode a coleta pgfn"})
        return {"ok": False, "motivo": "sem dados"}

    trimestre = exec_[0]["trimestre"]
    data_base = exec_[0]["data_base"]
    atuais = [e for e in exec_ if e["trimestre"] == trimestre]
    nomes = {c[0]: c[1] for c in CONJUNTOS}

    try:
        geo = {r["uf"]: r for r in _rows(con, "SELECT cod, uf, nome, regiao, populacao, pop_ano, svg_d FROM geo_uf")}
    except Exception:
        geo = {}  # sem a malha do IBGE o painel perde nome, região e per capita — nunca os inventa

    # ---- totais por conjunto (nunca somados a outro universo) ----
    conjuntos = []
    for cid, cnome, cdesc in CONJUNTOS:
        e = next((x for x in atuais if x["conjunto"] == cid), None)
        if not e:
            conjuntos.append({"id": cid, "nome": cnome, "descricao": cdesc, "disponivel": False,
                              "motivo": "conjunto não absorvido nesta data-base"})
            continue
        pf = _rows(con, "SELECT SUM(n) n, SUM(valor) v FROM pgfn_uf WHERE trimestre=? AND conjunto=? AND pessoa='pf'", (trimestre, cid))[0]
        pj = _rows(con, "SELECT SUM(n) n, SUM(valor) v FROM pgfn_uf WHERE trimestre=? AND conjunto=? AND pessoa='pj'", (trimestre, cid))[0]
        conjuntos.append({
            "id": cid, "nome": cnome, "descricao": cdesc, "disponivel": True,
            "inscricoes": e["inscricoes"], "valor": round(e["valor_total"], 2),
            "pf": {"inscricoes": pf["n"] or 0, "valor": round(pf["v"] or 0, 2)},
            "pj": {"inscricoes": pj["n"] or 0, "valor": round(pj["v"] or 0, 2)},
            "linhas_lidas": e["linhas_lidas"],
            "linhas_de_corresponsavel": e["linhas_lidas"] - e["inscricoes"],
            "valor_repetido_por_corresponsavel": round(e["valor_repetido"] or 0, 2),
            "arquivos": e["membros"],
            "uf_fora_do_dominio": e["uf_indefinida"],
        })

    disponiveis = [c for c in conjuntos if c.get("disponivel")]
    total_valor = sum(c["valor"] for c in disponiveis)
    total_insc = sum(c["inscricoes"] for c in disponiveis)
    total_linhas = sum(c["linhas_lidas"] for c in disponiveis)
    total_repetido = sum(c["valor_repetido_por_corresponsavel"] for c in disponiveis)

    # ---- mapa por UF, somando os três conjuntos (mesmo universo: dívida ativa) ----
    por_uf = {}
    for r in _rows(con, """SELECT uf, pessoa, SUM(n) n, SUM(valor) v FROM pgfn_uf
                           WHERE trimestre=? GROUP BY uf, pessoa""", (trimestre,)):
        d = por_uf.setdefault(r["uf"], {"pf": {"n": 0, "valor": 0.0}, "pj": {"n": 0, "valor": 0.0}})
        d[r["pessoa"]] = {"n": r["n"], "valor": round(r["v"], 2)}
    mapa = []
    for uf, d in sorted(por_uf.items()):
        g = geo.get(uf)
        n = d["pf"]["n"] + d["pj"]["n"]
        v = d["pf"]["valor"] + d["pj"]["valor"]
        pop = (g or {}).get("populacao")
        mapa.append({
            "uf": uf,
            "nome": (g or {}).get("nome") or ("Não informada na fonte" if uf == "indefinida" else uf),
            "regiao": (g or {}).get("regiao"),
            "cod": (g or {}).get("cod"),
            "inscricoes": n, "valor": round(v, 2),
            "pf": d["pf"], "pj": d["pj"],
            "part_br": round(100 * v / total_valor, 3) if total_valor else None,
            "valor_medio": round(v / n) if n else None,
            # per capita só faz sentido para pessoa física; PJ não se divide por habitante
            "insc_pf_por_mil_hab": round(1000 * d["pf"]["n"] / pop, 2) if pop else None,
            "populacao": pop,
        })
    mapa.sort(key=lambda x: -x["valor"])

    # ---- safras (estoque remanescente por mês de inscrição) ----
    safra_mes = _rows(con, """SELECT mes, pessoa, SUM(n) n, SUM(valor) v FROM pgfn_safra
                              WHERE trimestre=? GROUP BY mes, pessoa ORDER BY mes""", (trimestre,))
    por_ano = {}
    for r in safra_mes:
        ano = r["mes"][:4]
        a = por_ano.setdefault(ano, {"ano": ano, "pf": 0, "pj": 0, "valor": 0.0})
        a[r["pessoa"]] += r["n"]
        a["valor"] += r["v"]
    safras = [{**a, "valor": round(a["valor"], 2), "inscricoes": a["pf"] + a["pj"]}
              for a in sorted(por_ano.values(), key=lambda x: x["ano"]) if a["ano"] >= "1990"]

    serie_mensal = {}
    for r in safra_mes:
        m = serie_mensal.setdefault(r["mes"], {"mes": r["mes"], "pf": 0, "pj": 0, "valor": 0.0})
        m[r["pessoa"]] += r["n"]
        m["valor"] += r["v"]
    recentes = [{**m, "valor": round(m["valor"], 2), "inscricoes": m["pf"] + m["pj"]}
                for m in sorted(serie_mensal.values(), key=lambda x: x["mes"]) if m["mes"] >= "2020-01"]

    # ---- cortes transversais ----
    def corte(dim):
        rs = _rows(con, """SELECT categoria, SUM(n) n, SUM(valor) v FROM pgfn_corte
                           WHERE trimestre=? AND dimensao=? GROUP BY categoria ORDER BY SUM(valor) DESC""",
                   (trimestre, dim))
        return [{"categoria": r["categoria"], "inscricoes": r["n"], "valor": round(r["v"], 2),
                 "part_valor": round(100 * r["v"] / total_valor, 2) if total_valor else None} for r in rs]

    situacao, ajuizado, receita = corte("situacao"), corte("ajuizado"), corte("receita")
    ordem_faixa = ["até R$ 1 mil", "R$ 1 mil a 10 mil", "R$ 10 mil a 100 mil", "R$ 100 mil a 1 mi",
                   "R$ 1 mi a 10 mi", "R$ 10 mi a 100 mi", "acima de R$ 100 mi"]
    faixa = sorted(corte("faixa"), key=lambda x: ordem_faixa.index(x["categoria"]) if x["categoria"] in ordem_faixa else 99)

    aj_sim = next((a for a in ajuizado if a["categoria"] == "SIM"), None)
    grandes = [f for f in faixa if f["categoria"] in ("R$ 10 mi a 100 mi", "acima de R$ 100 mi")]
    part_grandes = round(sum(g["part_valor"] or 0 for g in grandes), 1)
    n_grandes = sum(g["inscricoes"] for g in grandes)

    def ptbr(x, casas=1):
        """Número no padrão brasileiro: milhar com ponto, decimal com vírgula."""
        return f"{x:,.{casas}f}".translate(str.maketrans({",": ".", ".": ","}))

    sintese = (f"São {ptbr(total_insc / 1e6)} milhões de inscrições em dívida ativa da União, "
               f"R$ {ptbr(total_valor / 1e12, 2)} trilhões na data-base {data_base}. "
               f"{ptbr(part_grandes)}% do valor está em {ptbr(n_grandes, 0)} inscrições acima de "
               f"R$ 10 milhões" +
               (f", e {ptbr(aj_sim['part_valor'])}% do valor já foi ajuizado." if aj_sim else "."))

    payload = {
        "disponivel": True,
        "gerado_em": common.now_utc(),
        "trimestre": trimestre,
        "data_base": data_base,
        "fonte": "PGFN — dados abertos da Dívida Ativa da União (dadosabertos.pgfn.gov.br)",
        "licenca": "dados abertos publicados sob a Lei de Acesso à Informação",
        "trimestres_absorvidos": sorted({e["trimestre"] for e in exec_}, reverse=True),
        "sintese": sintese,
        "aviso_universo": AVISO_UNIVERSO,
        "aviso_safra": AVISO_SAFRA,
        "privacidade": ("A fonte publica nome, CPF mascarado e CNPJ do devedor. Nada disso é lido para "
                        "dentro do Observatório: as colunas são descartadas na própria linha e o que "
                        "persiste são apenas contagens e somas. Número de inscrição também não é retido."),
        "totais": {
            "inscricoes": total_insc,
            "valor": round(total_valor, 2),
            "linhas_no_arquivo": total_linhas,
            "linhas_de_corresponsavel": total_linhas - total_insc,
            # a armadilha central da fonte, medida na população inteira e não numa amostra
            "valor_repetido_por_corresponsavel": round(total_repetido, 2),
            "valor_se_somasse_todas_as_linhas": round(total_valor + total_repetido, 2),
            "fator_de_inflacao": round((total_valor + total_repetido) / total_valor, 2) if total_valor else None,
        },
        "conjuntos": conjuntos,
        "mapa": mapa,
        "geo": {"viewBox": None, "transform": None},
        "safras": safras,
        "safras_recentes": recentes,
        "situacao": situacao,
        "ajuizado": ajuizado,
        "faixas": faixa,
        "receitas": receita[:15],
        "catalogo": [
            {"id": "insc_total", "nome": "Inscrições em dívida ativa", "definicao":
             "Contagem de inscrições com uma linha de devedor principal na data-base.",
             "formula": "COUNT(linhas com TIPO_DEVEDOR normalizado = PRINCIPAL)", "unidade": "inscrições",
             "fonte": "PGFN dados abertos", "nivel": "UF, mês de inscrição, situação, faixa",
             "cobertura": "os três conjuntos publicados (não previdenciário, previdenciário, FGTS)",
             "limitacoes": "Corresponsáveis e devedores solidários repetem a inscrição e são excluídos da contagem.",
             "versao": "v1.0"},
            {"id": "valor_consolidado", "nome": "Valor consolidado", "definicao":
             "Soma do VALOR_CONSOLIDADO das inscrições, contado uma vez por inscrição.",
             "formula": "SUM(VALOR_CONSOLIDADO) sobre linhas PRINCIPAL", "unidade": "R$",
             "fonte": "PGFN dados abertos", "nivel": "UF, mês de inscrição, situação, faixa",
             "cobertura": "data-base do trimestre",
             "limitacoes": ("Sem o filtro de devedor principal a soma infla 196% — o mesmo valor aparece "
                            "repetido para cada corresponsável. Valor nominal, sem deflação."),
             "versao": "v1.0"},
            {"id": "safra", "nome": "Estoque remanescente por safra", "definicao":
             "Inscrições ainda em cobrança na data-base, agrupadas pelo mês em que foram inscritas.",
             "formula": "COUNT/SUM por DATA_INSCRICAO", "unidade": "inscrições e R$",
             "fonte": "PGFN dados abertos", "nivel": "mês", "cobertura": "1982 em diante na fonte",
             "limitacoes": AVISO_SAFRA, "versao": "v1.0"},
            {"id": "insc_pf_mil_hab", "nome": "Inscrições de PF por mil habitantes", "definicao":
             "Inscrições de pessoa física da UF divididas pela população estimada.",
             "formula": "1000 × inscrições_pf ÷ população", "unidade": "inscrições por mil habitantes",
             "fonte": "PGFN dados abertos ÷ IBGE SIDRA 6579", "nivel": "UF",
             "cobertura": "27 UFs; a categoria 'não informada' fica de fora do indicador",
             "limitacoes": ("Só se aplica a pessoa física: dívida de pessoa jurídica não se divide por "
                            "habitante. UF é a do devedor, não a da unidade da PGFN."),
             "versao": "v1.0"},
        ],
        "limitacoes": [
            AVISO_UNIVERSO,
            AVISO_SAFRA,
            ("Número de devedores distintos não é publicado aqui: apurá-lo exigiria reter identificadores "
             "de pessoas, o que o Observatório não faz. Indisponível, não estimado."),
            "A fonte não traz CNAE, porte da empresa nem município — só UF do devedor.",
            "Valores nominais, sem deflação: safras antigas não são comparáveis a preços de hoje.",
            "A série da PGFN começa em 2020_trimestre_01; não há histórico anterior nos dados abertos.",
        ],
        "fontes_ausentes": [c for c in conjuntos if not c.get("disponivel")],
    }
    if geo:
        primeiro = next(iter(geo.values()))
        payload["geo"] = {
            # mesma malha do Panorama; replicada aqui para a página não ter de carregar
            # o panorama.json inteiro só para desenhar 27 caminhos
            "viewBox": cfg.get("geo_viewbox") if isinstance(cfg, dict) else None,
            "paths": {g["cod"]: g["svg_d"] for g in geo.values() if g.get("svg_d") and g.get("cod")},
            "populacao_fonte": f"IBGE SIDRA 6579 ({primeiro.get('pop_ano')})",
        }
        pan = common.ler_gold_opcional("panorama.json")
        if pan and pan.get("geo"):
            payload["geo"]["viewBox"] = pan["geo"].get("viewBox")
            payload["geo"]["transform"] = pan["geo"].get("transform")
    common.write_gold("pgfn.json", payload)
    return {"ok": True, "trimestre": trimestre, "inscricoes": total_insc,
            "valor_tri": round(total_valor / 1e12, 3), "ufs": len(mapa)}
