"""Seguro prestamista — gold prestamista.json (camada da aba Juros por instituição).

Uma fonte: o SES da SUSEP (pipeline/sources/susep_ses.py), ramos 0977, 1377 e 1061, por mês ×
empresa × ramo. O prestamista é o seguro vendido junto com o crédito, que quita ou amortiza a
dívida em morte, invalidez ou desemprego. A taxa do txjuros não o inclui (não é CET); este gold
mostra o tamanho da camada que fica fora da taxa: quanto se paga de prêmio, quanto volta em
sinistro, quanto fica de comissão (a remuneração de quem vende, em geral o próprio banco) e
quem concentra o mercado.

Regras:
- Prêmio direto é a régua de tamanho; sinistro ocorrido ÷ prêmio ganho é a sinistralidade;
  despesa de comercialização ÷ prêmio direto é a comissão. Sinistro direto ficou zerado nos
  ramos novos desde a mudança do plano de contas; por isso a sinistralidade usa sinistro
  ocorrido, e o gold declara isso.
- Razão sobre as concessões PF do SGS (série 20633, R$ milhões, mensal): prêmio de 12 meses ÷
  concessões PF de 12 meses. É ordem de grandeza, não custo por contrato: o prêmio cobre
  contratos novos e renovações, e nem toda concessão leva prestamista.
- Grupos e empresas: nomes do cadastro da SUSEP; código de grupo 99999 ou vazio e o grupo nominal
  "INDEPENDENTE" viram uma só linha "sem grupo econômico", declarada, nunca atribuída. Shares
  sobre o total dos 12 meses.
- Mês parcial: o último mês costuma chegar incompleto; o gold marca como parcial o mês cujo
  prêmio total é menor que 70% da mediana dos 12 anteriores e o exclui dos KPIs.
"""
from pipeline import common
from pipeline.fmt import _r, _share, _dec, _mes_menos
from pipeline.sources.susep_ses import RAMOS

FONTE = {"nome": "SUSEP — Sistema de Estatísticas da SUSEP (SES), base completa",
         "url": "https://www2.susep.gov.br/menuestatistica/SES/principal.aspx",
         "licenca": "dados abertos da SUSEP", "nivel": "A — estatística oficial do supervisor de seguros, mensal"}
PISO_MES_PARCIAL = 0.70
CODIGOS_SEM_GRUPO = {"", "99999", "0", "00000"}


def _mes(am):
    return f"{am[:4]}-{am[4:6]}"


def build(con, cfg=None):
    try:
        rows = con.execute("SELECT mes, coenti, ramo, cogrupo, premio_direto, premio_retido, premio_ganho, sinistro_direto, sinistro_ocorrido, desp_com "
                           "FROM susep_prestamista ORDER BY mes").fetchall()
        ent = {r[0]: r[1:] for r in con.execute("SELECT coenti, noenti, cogrupo, nogrupo FROM susep_entidades").fetchall()}
        col = con.execute("SELECT last_modified, coletado_em, requisicoes, bytes_lidos FROM susep_coleta WHERE fonte='BaseCompleta.zip'").fetchone()
    except Exception as e:
        return {"disponivel": False, "motivo": f"silver da SUSEP indisponível: {e}"}
    if not rows:
        return {"disponivel": False, "motivo": "susep_prestamista vazia: base da SUSEP ainda não coletada"}
    por_mes = {}
    for mes, ce, ramo, cg, pd, pr, pg, sd, so, dc in rows:
        a = por_mes.setdefault(mes, {"premio": 0.0, "retido": 0.0, "ganho": 0.0, "sin_direto": 0.0, "sin_ocorrido": 0.0, "comissao": 0.0, "n_empresas": set()})
        a["premio"] += pd; a["retido"] += pr; a["ganho"] += pg; a["sin_direto"] += sd; a["sin_ocorrido"] += so; a["comissao"] += dc
        if pd > 0:
            a["n_empresas"].add(ce)
    meses = sorted(por_mes)
    # mês parcial: prêmio abaixo de 70% da mediana dos 12 anteriores
    parciais = set()
    for i, m in enumerate(meses):
        ant = sorted(por_mes[x]["premio"] for x in meses[max(0, i - 12):i])
        if len(ant) >= 6 and por_mes[m]["premio"] < PISO_MES_PARCIAL * ant[len(ant) // 2]:
            parciais.add(m)
    fechados = [m for m in meses if m not in parciais]
    ult = fechados[-1]
    ult12 = [m for m in fechados if m > _mes_menos(_mes(ult), 12).replace("-", "")][-12:]
    ant12 = [m for m in fechados if m <= _mes_menos(_mes(ult), 12).replace("-", "")][-12:]
    soma = lambda ms, k: sum(por_mes[m][k] for m in ms)
    premio12, premio12_ant = soma(ult12, "premio"), soma(ant12, "premio") if len(ant12) == 12 else None
    ganho12, sin12, com12 = soma(ult12, "ganho"), soma(ult12, "sin_ocorrido"), soma(ult12, "comissao")

    # concessões PF do SGS nos mesmos 12 meses
    conc = {}
    try:
        for ref, v in con.execute("SELECT ref_date, value FROM series_obs WHERE key='concessoes_pf' ORDER BY ref_date").fetchall():
            conc[ref[:7].replace("-", "")] = v * 1e6
    except Exception:
        pass
    conc12 = sum(conc.get(m, 0.0) for m in ult12) if all(m in conc for m in ult12) else None

    # por ramo, grupo e empresa nos 12 meses
    por_ramo, por_grupo, por_emp = {}, {}, {}
    for mes, ce, ramo, cg, pd, pr, pg, sd, so, dc in rows:
        if mes not in ult12:
            continue
        por_ramo[ramo] = por_ramo.get(ramo, 0.0) + pd
        e = ent.get(ce, ("", cg, ""))
        cg_ef = (e[1] or cg or "").strip()
        # a SUSEP usa dois rótulos para "sem grupo": código 99999/vazio e o grupo nominal "INDEPENDENTE"
        sem_grupo = cg_ef in CODIGOS_SEM_GRUPO or (e[2] or "").strip().upper().startswith("INDEPENDEN")
        gnome = "Sem grupo econômico (empresas independentes)" if sem_grupo else (e[2] or "").strip()
        gk = "sem_grupo" if sem_grupo else cg_ef
        g = por_grupo.setdefault(gk, {"cogrupo": gk, "nome": gnome or gk, "premio": 0.0, "sinistro": 0.0, "comissao": 0.0, "empresas": set()})
        g["premio"] += pd; g["sinistro"] += so; g["comissao"] += dc; g["empresas"].add(ce)
        emp = por_emp.setdefault(ce, {"coenti": ce, "nome": (e[0] or ce).strip(), "grupo": gnome or None, "premio": 0.0, "sinistro": 0.0, "comissao": 0.0})
        emp["premio"] += pd; emp["sinistro"] += so; emp["comissao"] += dc
    grupos = sorted(por_grupo.values(), key=lambda g: -g["premio"])
    for g in grupos:
        g["n_empresas"] = len(g.pop("empresas"))
        g["share_pct"] = _share(g["premio"], premio12)
        g["comissao_pct"] = _share(g["comissao"], g["premio"])
    empresas = sorted(por_emp.values(), key=lambda x: -x["premio"])
    for x in empresas:
        x["share_pct"] = _share(x["premio"], premio12)
        x["comissao_pct"] = _share(x["comissao"], x["premio"])
    top5 = sum(g["share_pct"] or 0 for g in [x for x in grupos if x["cogrupo"] != "sem_grupo"][:5])

    serie = [{"mes": _mes(m), "premio": por_mes[m]["premio"], "premio_ganho": por_mes[m]["ganho"], "sinistro_ocorrido": por_mes[m]["sin_ocorrido"], "comissao": por_mes[m]["comissao"],
              "sinistralidade_pct": _share(por_mes[m]["sin_ocorrido"], por_mes[m]["ganho"]), "comissao_pct": _share(por_mes[m]["comissao"], por_mes[m]["premio"]),
              "n_empresas": len(por_mes[m]["n_empresas"]), "concessoes_pf": conc.get(m), "premio_sobre_concessoes_pct": _share(por_mes[m]["premio"], conc.get(m)) if conc.get(m) else None,
              "parcial": m in parciais} for m in meses[-60:]]
    kpis = {"mes": _mes(ult), "premio_12m": premio12, "var_12m_pct": _r((premio12 / premio12_ant - 1) * 100) if premio12_ant else None,
            "premio_mes": por_mes[ult]["premio"], "sinistralidade_12m_pct": _share(sin12, ganho12), "comissao_12m_pct": _share(com12, premio12),
            "n_empresas": len(por_mes[ult]["n_empresas"]), "concessoes_pf_12m": conc12, "premio_sobre_concessoes_pct": _share(premio12, conc12) if conc12 else None,
            "top5_grupos_share_pct": _r(top5)}
    sintese = (f"Em 12 meses até {_mes(ult)}, o seguro prestamista movimentou R$ {_dec(premio12 / 1e9)} bilhões em prêmios"
               + (f", {'+' if kpis['var_12m_pct'] >= 0 else ''}{_dec(kpis['var_12m_pct'])}% sobre os 12 meses anteriores" if kpis["var_12m_pct"] is not None else "") + "."
               + (f" Isso equivale a {_dec(kpis['premio_sobre_concessoes_pct'], 2)}% das concessões de crédito a pessoas físicas no período." if kpis["premio_sobre_concessoes_pct"] is not None else "")
               + f" De cada R$ 100 de prêmio, R$ {_dec(kpis['comissao_12m_pct'], 0)} ficam como comissão de quem vende e a sinistralidade é de {_dec(kpis['sinistralidade_12m_pct'], 0)}% do prêmio ganho."
               + (f" Os cinco maiores grupos concentram {_dec(top5, 0)}% do prêmio." if top5 else ""))
    return {
        "disponivel": True, "tipo": "DADO OBSERVADO (SUSEP SES) + CALCULADO (agregação, razões, shares)",
        "mes": _mes(ult), "meses_parciais": [_mes(m) for m in sorted(parciais) if m > ult], "fonte": FONTE, "gerado_em": common.now_utc(),
        "coleta": {"last_modified": col[0] if col else None, "coletado_em": col[1] if col else None, "requisicoes": col[2] if col else None, "mb_lidos": round(col[3] / 1e6, 1) if col and col[3] else None},
        "ramos": [{"id": r, "nome": RAMOS.get(r, r), "premio_12m": v, "share_pct": _share(v, premio12)} for r, v in sorted(por_ramo.items(), key=lambda x: -x[1])],
        "kpis": kpis, "grupos": grupos[:12], "empresas": empresas[:15], "serie": serie,
        "sintese": sintese,
        "metodo": ("SES da SUSEP, ramos 0977, 1377 e 1061, agregados por mês, empresa e grupo econômico. Prêmio direto mede tamanho; "
                   "sinistralidade = sinistro ocorrido ÷ prêmio ganho; comissão = despesa de comercialização ÷ prêmio direto. Razão sobre as "
                   "concessões PF do SGS (série 20633) com 12 meses de cada lado. Mês com prêmio abaixo de 70% da mediana dos 12 anteriores é "
                   "parcial e fica fora dos KPIs. Nomes de grupo e empresa vêm do cadastro da SUSEP; código sem grupo fica declarado."),
        "limitacoes": ("A SUSEP não publica o prêmio por operação de crédito nem por instituição financeira: a seguradora do grupo vende "
                       "para o banco do grupo, para outros bancos e para varejistas, e o SES não separa o canal. A razão sobre concessões "
                       "é ordem de grandeza do sistema, não custo por contrato. Sinistro direto está zerado nos ramos novos e não é usado."),
        "cautelas": [
            "Prestamista não entra na taxa do txjuros nem na taxa média do BCB: é custo do crédito fora do juro, que só aparece no CET de cada contrato.",
            "Comissão alta é característica do canal bancário (bancassurance), não irregularidade; a Res. CNSP 382 exige oferta separada e não condicionada.",
            "Sinistralidade baixa reflete cobertura estreita (morte, invalidez e, às vezes, desemprego) e público jovem; não se compara com seguros de dano.",
        ],
        "catalogo": [
            {"nome": "Prêmio direto", "definicao": "prêmios emitidos pelas seguradoras nos ramos prestamista", "unidade": "R$", "fonte": "SUSEP SES (Ses_seguros)", "limitacoes": "sem canal nem operação"},
            {"nome": "Sinistralidade", "definicao": "sinistro ocorrido ÷ prêmio ganho", "unidade": "%", "fonte": "calculado", "limitacoes": "cobertura estreita"},
            {"nome": "Comissão", "definicao": "despesa de comercialização ÷ prêmio direto", "unidade": "%", "fonte": "calculado", "limitacoes": "inclui todos os canais"},
            {"nome": "Prêmio sobre concessões PF", "definicao": "prêmio de 12 meses ÷ concessões PF do SGS em 12 meses", "unidade": "%", "fonte": "calculado (SUSEP e BCB/SGS 20633)", "limitacoes": "ordem de grandeza"},
        ],
    }
