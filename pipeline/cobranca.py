"""Cobrança judicial de crédito — gold cobranca.json.

Uma fonte, uma régua: o DataJud do CNJ, por agregação (o coletor não baixa documentos).
Quatro classes que são a via judicial de cobrar crédito: execução de título
extrajudicial, busca e apreensão em alienação fiduciária, ação monitória e execução
hipotecária do SFH. Dois recortes: "todos" (qualquer credor: condomínio, locador,
fornecedor, banco) e "bancário" (assuntos TPU de contratos bancários, cédula de crédito
bancário, alienação e propriedade fiduciária, financiamento de produto, CDC, cartão,
mútuo e consignado). O painel lê o recorte bancário como o fluxo de cobrança judicial
de crédito e o total como contexto; nunca soma os dois.

Regras:
- Casos únicos (cardinalidade do número CNJ por mês), não registros (G1 e G2).
- Os três últimos meses são parciais (atraso de remessa dos tribunais ao DataJud) e
  ficam fora de KPI, janela de 12 meses e gráfico, como no painel de RJ.
- Cobertura declarada: quantos dos 27 tribunais estaduais estão no acervo e quais
  faltam; Brasil = soma dos tribunais coletados, nunca extrapolado.
- Por UF: casos bancários em 12 meses por mil habitantes (Censo 2022 via ufs.json) e por
  R$ bilhão de carteira do SCR (ufs.json), ao lado da inadimplência do SCR, sem somar
  réguas; posições entre as UFs coletadas.
"""
from datetime import date

from pipeline import common
from pipeline.sources.datajud_cobranca import ASSUNTOS_BANCARIOS, GRUPOS, TRIBUNAIS
from pipeline.ufs import NOMES, REGIOES

FONTE = {"nome": "CNJ — DataJud, API pública (agregação por classe, assunto e mês de ajuizamento nos 27 tribunais estaduais)",
         "url": "https://api-publica.datajud.cnj.jus.br/", "catalogo": "https://datajud-wiki.cnj.jus.br/api-publica/",
         "licenca": "dados abertos do CNJ (chave pública)", "nivel": "B — metadados processuais com cobertura desigual entre tribunais e atraso de remessa"}
MESES_PARCIAIS = 3
SERIE_INICIO = "2019-01"


def _r(v, d=2):
    return None if v is None else round(v, d)


def _share(v, tot):
    return _r(v / tot * 100) if v is not None and tot else None


def _var(v, v0):
    return _r((v / v0 - 1) * 100) if v is not None and v0 else None


def _mes_menos(mes, n):
    y, m = int(mes[:4]), int(mes[5:7])
    t = y * 12 + (m - 1) - n
    return f"{t // 12:04d}-{t % 12 + 1:02d}"


def _mil(v):
    return f"{v:,.0f}".replace(",", ".")


def _dec(v, d=1):
    return f"{v:.{d}f}".replace(".", ",")


def build(con, cfg=None):
    rows = con.execute("SELECT tribunal, uf, grupo, recorte, mes, registros, casos FROM cobranca_mensal").fetchall()
    if not rows:
        return {"disponivel": False, "motivo": "silver cobranca_mensal vazia — rode o coletor datajud_cobranca"}
    trib_rows = con.execute("SELECT tribunal, uf, grupo, recorte, total, casos, datados, collected_at FROM cobranca_tribunal").fetchall()
    coletados = sorted({r[0] for r in trib_rows})
    faltam = sorted(set(TRIBUNAIS) - set(coletados))
    hoje = date.today()
    mes_atual = f"{hoje.year:04d}-{hoje.month:02d}"
    parciais = [_mes_menos(mes_atual, i) for i in range(MESES_PARCIAIS - 1, -1, -1)]
    fim = _mes_menos(mes_atual, MESES_PARCIAIS)
    ini12, ini12a, fim12a = _mes_menos(fim, 11), _mes_menos(fim, 23), _mes_menos(fim, 12)
    # acumuladores: por (grupo, recorte, mes) Brasil; por (uf, grupo, recorte) 12m e 12m anteriores
    br = {}
    uf_acc = {}
    for trib, uf, grupo, recorte, mes, reg, casos in rows:
        k = (grupo, recorte)
        br.setdefault(k, {}).setdefault(mes, [0, 0])
        br[k][mes][0] += reg; br[k][mes][1] += casos
        if ini12 <= mes <= fim:
            a = uf_acc.setdefault((uf, grupo, recorte), [0, 0]); a[0] += casos
        elif ini12a <= mes <= fim12a:
            a = uf_acc.setdefault((uf, grupo, recorte), [0, 0]); a[1] += casos
    meses = sorted({m for k in br for m in br[k]})
    meses = [m for m in meses if m >= SERIE_INICIO and m <= mes_atual]

    def soma(grupo, recorte, a, b):
        return sum(br.get((grupo, recorte), {}).get(m, [0, 0])[1] for m in meses if a <= m <= b)
    grupos = []
    for gid, (nome, codigos) in GRUPOS.items():
        g = {"id": gid, "nome": nome, "classes_tpu": codigos}
        for rec in ("todos", "bancario"):
            c12, c12a = soma(gid, rec, ini12, fim), soma(gid, rec, ini12a, fim12a)
            g[rec] = {"casos_12m": c12, "casos_12m_anterior": c12a, "var_12m_pct": _var(c12, c12a),
                      "registros_12m": sum(br.get((gid, rec), {}).get(m, [0, 0])[0] for m in meses if ini12 <= m <= fim)}
        g["bancario_share"] = _share(g["bancario"]["casos_12m"], g["todos"]["casos_12m"])
        g["serie"] = [{"mes": m, "todos": br.get((gid, "todos"), {}).get(m, [0, 0])[1], "bancario": br.get((gid, "bancario"), {}).get(m, [0, 0])[1], "parcial": m in parciais} for m in meses]
        grupos.append(g)
    serie = []
    for m in meses:
        p = {"mes": m, "parcial": m in parciais,
             "todos": sum(br.get((gid, "todos"), {}).get(m, [0, 0])[1] for gid in GRUPOS),
             "bancario": sum(br.get((gid, "bancario"), {}).get(m, [0, 0])[1] for gid in GRUPOS)}
        for gid in GRUPOS:
            p[gid] = br.get((gid, "bancario"), {}).get(m, [0, 0])[1]
        serie.append(p)
    tot12 = {rec: sum(g[rec]["casos_12m"] for g in grupos) for rec in ("todos", "bancario")}
    tot12a = {rec: sum(g[rec]["casos_12m_anterior"] for g in grupos) for rec in ("todos", "bancario")}
    # UFs
    ufs_gold = {u["uf"]: u for u in ((common.ler_gold_opcional("ufs.json") or {}).get("ufs") or [])}
    ufs = []
    for trib in coletados:
        uf = TRIBUNAIS[trib]
        ug = ufs_gold.get(uf, {})
        pop = ug.get("pop")
        scr = ug.get("scr") or {}
        banc = sum(uf_acc.get((uf, gid, "bancario"), [0, 0])[0] for gid in GRUPOS)
        banc_a = sum(uf_acc.get((uf, gid, "bancario"), [0, 0])[1] for gid in GRUPOS)
        todos = sum(uf_acc.get((uf, gid, "todos"), [0, 0])[0] for gid in GRUPOS)
        ufs.append({"uf": uf, "nome": NOMES.get(uf, uf), "regiao": REGIOES.get(uf), "tribunal": trib.upper(),
                    "casos_12m": banc, "casos_12m_anterior": banc_a, "var_12m_pct": _var(banc, banc_a), "casos_12m_todos": todos,
                    "bancario_share": _share(banc, todos),
                    "por_mil_hab": _r(banc / pop * 1e3, 2) if pop else None,
                    "por_bi_carteira": _r(banc / (scr.get("saldo") / 1e9), 1) if scr.get("saldo") else None,
                    "inad_scr": scr.get("inad"), "carteira_scr": scr.get("saldo"), "data_scr": scr.get("data_base"),
                    "grupos": {gid: uf_acc.get((uf, gid, "bancario"), [0, 0])[0] for gid in GRUPOS}})
    for chave in ("casos_12m", "por_mil_hab", "por_bi_carteira"):
        ordem = sorted([u for u in ufs if u[chave] is not None], key=lambda u: -u[chave])
        for k, u in enumerate(ordem):
            u.setdefault("posicoes", {})[chave] = k + 1
    ufs.sort(key=lambda u: -(u["casos_12m"] or 0))
    pop_cob = sum((ufs_gold.get(TRIBUNAIS[t], {}).get("pop") or 0) for t in coletados)
    cart_cob = sum(((ufs_gold.get(TRIBUNAIS[t], {}).get("scr") or {}).get("saldo") or 0) for t in coletados)
    brasil = {"casos_12m": tot12["bancario"], "casos_12m_anterior": tot12a["bancario"], "var_12m_pct": _var(tot12["bancario"], tot12a["bancario"]),
              "casos_12m_todos": tot12["todos"], "var_12m_todos_pct": _var(tot12["todos"], tot12a["todos"]), "bancario_share": _share(tot12["bancario"], tot12["todos"]),
              "por_mil_hab": _r(tot12["bancario"] / pop_cob * 1e3, 2) if pop_cob else None,
              "por_bi_carteira": _r(tot12["bancario"] / (cart_cob / 1e9), 1) if cart_cob else None}
    g_top = max(grupos, key=lambda g: g["bancario"]["casos_12m"])
    u_top = max(ufs, key=lambda u: u["por_mil_hab"] or -1) if ufs else None
    sintese = (f"Nos 12 meses até {fim}, {_mil(tot12['bancario'])} ações de cobrança de crédito bancário foram ajuizadas nos {len(coletados)} tribunais estaduais cobertos "
               f"({'+' if (brasil['var_12m_pct'] or 0) >= 0 else ''}{_dec(brasil['var_12m_pct'] or 0)}% contra os 12 meses anteriores), {_dec(brasil['bancario_share'] or 0, 0)}% das {_mil(tot12['todos'])} ações das mesmas classes com qualquer credor. "
               f"A via mais usada é {g_top['nome'].lower()} ({_mil(g_top['bancario']['casos_12m'])} casos, {_dec(_share(g_top['bancario']['casos_12m'], tot12['bancario']) or 0, 0)}% do total)"
               + (f"; a maior intensidade por habitante está em {u_top['nome']} ({_dec(u_top['por_mil_hab'])} por mil)." if u_top and u_top["por_mil_hab"] else "."))
    return {
        "disponivel": True, "tipo": "DADO OBSERVADO (contagens do DataJud) + CALCULADO (janelas, variações, por habitante e por carteira)",
        "fonte": FONTE, "mes": fim, "meses_parciais": parciais, "janela_12m": {"inicio": ini12, "fim": fim},
        # cobertura_n: contrato lido pela sentinela (scripts/sanidade_gold.py). Build com
        # menos tribunais que a publicação anterior é regressão, não atualização.
        "cobertura_n": len(coletados),
        "cobertura": {"tribunais": len(coletados), "ufs": [TRIBUNAIS[t] for t in coletados], "faltam": [TRIBUNAIS[t] for t in faltam],
                      "coletado_em": max(r[7] for r in trib_rows), "populacao_coberta_pct": _share(pop_cob, sum((u.get("pop") or 0) for u in ufs_gold.values())) if ufs_gold else None},
        "brasil": brasil, "grupos": grupos, "serie": serie, "ufs": ufs,
        "assuntos_bancarios": [{"codigo": k, "nome": v} for k, v in ASSUNTOS_BANCARIOS.items()],
        "sintese": sintese,
        "metodo": ("Contagem de casos únicos (cardinalidade do número CNJ) por mês de ajuizamento, por classe TPU e tribunal, via agregação na API pública do DataJud; "
                   "o mês é lido em dois espaços de data (documentos migrados em 'yyyyMMddHHmmss' e documentos em ISO-8601) e somado. Recorte bancário = assuntos TPU "
                   "listados; total = qualquer credor. Os três últimos meses são parciais e ficam fora. Janela de 12 meses até o último mês fechado, comparada com os "
                   "12 meses anteriores. Por UF: casos bancários ÷ população (Censo 2022) e ÷ carteira de crédito do SCR em R$ bilhões; posições entre as UFs cobertas."),
        "limitacoes": ("Cobertura do DataJud varia entre tribunais e ao longo do tempo (remessa atrasada e migrações de sistema); a série é mais fraca antes de 2020. "
                       "Cardinalidade é estimativa (HyperLogLog++, erro típico abaixo de 1%). Execução e monitória cobram qualquer título: o recorte bancário depende do "
                       "assunto cadastrado pelo tribunal, que nem sempre existe. Não há valor da causa nem identificação do credor na API pública."),
        "cautelas": [
            "Volume de ações não é inadimplência: é a decisão do credor de cobrar em juízo, que depende de custo, garantia e estratégia de cada instituição.",
            "Mais ações por habitante em uma UF pode refletir cobertura melhor do tribunal no DataJud, não mais cobrança.",
            "Nenhuma ação é atribuída a instituição: a API pública não identifica partes.",
        ],
        "catalogo": [
            {"nome": "Casos de cobrança bancária (12 m)", "definicao": "ajuizamentos únicos das quatro classes com assunto bancário na janela", "unidade": "casos", "fonte": "CNJ/DataJud", "limitacoes": "assunto cadastrado pelo tribunal"},
            {"nome": "Casos de cobrança, qualquer credor (12 m)", "definicao": "ajuizamentos únicos das quatro classes, sem filtro de assunto", "unidade": "casos", "fonte": "CNJ/DataJud", "limitacoes": "inclui condomínio, locação, fornecedores"},
            {"nome": "Por mil habitantes", "definicao": "casos bancários em 12 meses ÷ população ÷ 1.000", "unidade": "casos por mil", "fonte": "calculado (Censo 2022)", "limitacoes": "cobertura do tribunal"},
            {"nome": "Por R$ bilhão de carteira", "definicao": "casos bancários em 12 meses ÷ carteira de crédito do SCR na UF", "unidade": "casos por R$ bi", "fonte": "calculado (SCR.data)", "limitacoes": "datas diferentes; carteira PF + PJ"},
        ],
    }
