"""Gold do PLD realizado (CCEE): pld.json e CSVs horário e diário.

Regras publicadas (repetidas no JSON em `regras`, exibidas na página):
- dia de referência: último dia com as 24 horas dos quatro submercados;
- média diária: média aritmética simples das 24 horas (CALCULADO);
- posição histórica: percentil (rank médio) da média diária do dia de referência na
  distribuição das médias diárias do mesmo submercado desde 01/01/2021 até o dia de
  referência, em valores nominais; faixa baixa abaixo de P25, central de P25 a P75,
  alta acima de P75;
- volatilidade: desvio padrão amostral dos valores horários do período;
- permanência: fração de horas do período abaixo do P25, entre P25 e P75 e acima do
  P75 da distribuição HORÁRIA do submercado desde 01/01/2021;
- menor valor observado no ano: menor valor horário do ano civil até o dia de
  referência. NÃO é o piso regulatório (limite oficial não auditado nesta fase);
- diferença entre submercados: por hora, maior menos menor valor entre os quatro;
  contam-se as horas com diferença acima de R$ 1/MWh.
"""
import os
import sys
import calendar
from datetime import timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import base  # noqa: E402
from pipeline.energia.fontes import ccee  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

LIMIAR_DIFERENCA = 1.0  # R$/MWh
INICIO_DISTRIBUICAO = "2021-01-01"

REGRAS = {
    "dia_referencia": "Último dia com as 24 horas publicadas para os quatro submercados.",
    "media_diaria": "Média aritmética simples das 24 horas do dia (horário local de Brasília).",
    "posicao_historica": "Percentil da média diária do dia de referência na distribuição das médias diárias do mesmo submercado desde 01/01/2021, em valores nominais. Faixa baixa: abaixo do 25º percentil. Central: do 25º ao 75º. Alta: acima do 75º.",
    "volatilidade": "Desvio padrão amostral dos valores horários do período.",
    "permanencia": "Fração das horas do período abaixo do 25º percentil, entre o 25º e o 75º e acima do 75º percentil da distribuição horária do submercado desde 01/01/2021.",
    "menor_valor_ano": "Menor valor horário observado no ano civil até o dia de referência. Não é o piso regulatório: o limite oficial vigente não foi auditado nesta fase.",
    "diferenca_submercados": "Para cada hora, maior valor menos menor valor entre os quatro submercados. Contam-se as horas com diferença acima de R$ 1/MWh; diferenças menores são tratadas como coincidência nesta contagem.",
}

LIMITACOES_BASE = [
    "Valores nominais em R$/MWh. Os limites regulatórios (mínimo, máximo horário e máximo estrutural) mudam a cada ano e não foram auditados nesta fase; comparações entre anos misturam regimes de limites diferentes.",
    "A CCEE não informa a data de publicação de cada hora no arquivo; o campo last_modified do recurso no portal não acompanha as atualizações diárias.",
]


def _hora_local(ref):
    return ref[11:16]


def _capturas_por_ano(snap):
    """"de 27/09/2026 (arquivos 2021 a 2025, seed) e de 28/09/2026 (arquivo 2026, coleta direta)": cada data com seus arquivos."""
    grupos = {}
    for cp in snap.get("capturas", []):
        grupos.setdefault((cp["capturado_em"], cp.get("origem")), []).append(cp["recurso"].rsplit("_", 1)[-1])
    partes = []
    for (cap, origem), anos in sorted(grupos.items()):
        anos = sorted(anos)
        faixa = anos[0] if len(anos) == 1 else f"{anos[0]} a {anos[-1]}"
        rotulo = "arquivo" if len(anos) == 1 else "arquivos"
        via = {"seed": "captura versionada", "coleta_direta": "coleta direta"}.get(origem, origem or "origem não informada")
        partes.append(f"de {c.data_br(cap)} ({rotulo} {faixa}, {via})")
    return " e ".join(partes) if partes else "(nenhuma captura registrada)"


def mes_parcial(mes, dias_com_media):
    """Mês parcial: menos dias completos do que os dias do calendário daquele mês."""
    return dias_com_media < calendar.monthrange(int(mes[:4]), int(mes[5:7]))[1]


def construir(con):
    series = {sm: base.serie_vigente(con, ccee.DATASET, f"pld.{sm}") for sm in c.ORDEM_SM}
    if not all(series.values()):
        return c.stub("pld.json", "PLD horário ausente no silver para algum submercado")
    snap = c.snapshot_de(con, ccee.DATASET)
    captura = c.ultima_captura(snap)
    coleta = base.ultima_coleta(con, ccee.DATASET)

    horario = {sm: dict(pts) for sm, pts in series.items()}
    # horas presentes nos quatro submercados
    horas_comuns = sorted(set.intersection(*(set(h) for h in horario.values())))
    por_dia = {}
    for ref in horas_comuns:
        por_dia.setdefault(ref[:10], []).append(ref)
    dias_completos = sorted(k for k, v in por_dia.items() if len(v) == 24)
    if not dias_completos:
        return c.stub("pld.json", "nenhum dia completo com os quatro submercados")
    dia_ref = dias_completos[-1]
    primeira, ultima = horas_comuns[0], horas_comuns[-1]

    diario = {sm: {} for sm in c.ORDEM_SM}
    for dia in dias_completos:
        for sm in c.ORDEM_SM:
            diario[sm][dia] = c.media([horario[sm][h] for h in por_dia[dia]])

    def dist_diaria(sm):
        return [v for k, v in diario[sm].items() if INICIO_DISTRIBUICAO <= k <= dia_ref]

    def dist_horaria(sm):
        return [horario[sm][h] for h in horas_comuns if INICIO_DISTRIBUICAO <= h[:10] <= dia_ref]

    quartis_h = {sm: (c.quantil(dist_horaria(sm), 0.25), c.quantil(dist_horaria(sm), 0.75)) for sm in c.ORDEM_SM}
    quartis_d = {sm: {"p25": c.r(c.quantil(dist_diaria(sm), 0.25)), "p50": c.r(c.quantil(dist_diaria(sm), 0.5)),
                      "p75": c.r(c.quantil(dist_diaria(sm), 0.75))} for sm in c.ORDEM_SM}

    # menor valor horário por ano civil (até o dia de referência)
    menor_ano = {}
    for sm in c.ORDEM_SM:
        for h in horas_comuns:
            if h[:10] > dia_ref:
                continue
            ano = h[:4]
            v = horario[sm][h]
            if (sm, ano) not in menor_ano or v < menor_ano[(sm, ano)]:
                menor_ano[(sm, ano)] = v

    d_ref = c.d(dia_ref)

    def janela(n_dias):
        ini = (d_ref - timedelta(days=n_dias - 1)).isoformat()
        return [h for h in horas_comuns if ini <= h[:10] <= dia_ref]

    periodos_def = {
        "hoje": ("Dia de referência", [h for h in por_dia[dia_ref]]),
        "7d": ("Últimos 7 dias", janela(7)),
        "30d": ("Últimos 30 dias", janela(30)),
        "12m": ("Últimos 12 meses", janela(365)),
        "historico": ("Desde 01/01/2021", [h for h in horas_comuns if INICIO_DISTRIBUICAO <= h[:10] <= dia_ref]),
    }
    periodos = {}
    for chave, (rotulo, hs) in periodos_def.items():
        por_sm = {}
        for sm in c.ORDEM_SM:
            vals = [horario[sm][h] for h in hs]
            p25, p75 = quartis_h[sm]
            imax = max(range(len(hs)), key=lambda i: vals[i])
            imin = min(range(len(hs)), key=lambda i: vals[i])
            no_menor = sum(1 for h, v in zip(hs, vals) if abs(v - menor_ano[(sm, h[:4])]) < 1e-9)
            por_sm[sm] = {
                "media": c.r(c.media(vals)),
                "min": c.r(vals[imin]), "quando_min": hs[imin],
                "max": c.r(vals[imax]), "quando_max": hs[imax],
                "desvio_padrao": c.r(c.desvio_padrao(vals)),
                "permanencia": {
                    "baixa": c.r(sum(1 for v in vals if v < p25) / len(vals), 4),
                    "central": c.r(sum(1 for v in vals if p25 <= v <= p75) / len(vals), 4),
                    "alta": c.r(sum(1 for v in vals if v > p75) / len(vals), 4),
                },
                "frac_menor_valor_ano": c.r(no_menor / len(vals), 4),
            }
        difs = [(h, max(horario[sm][h] for sm in c.ORDEM_SM) - min(horario[sm][h] for sm in c.ORDEM_SM)) for h in hs]
        acima = [(h, dv) for h, dv in difs if dv > LIMIAR_DIFERENCA]
        hmax, dmax = max(difs, key=lambda x: x[1])
        periodos[chave] = {
            "rotulo": rotulo, "inicio": hs[0], "fim": hs[-1], "n_horas": len(hs),
            "por_submercado": por_sm,
            "diferenca": {
                "horas_acima_limiar": len(acima),
                "frac_horas_acima_limiar": c.r(len(acima) / len(hs), 4),
                "maior": c.r(dmax), "quando_maior": hmax,
            },
        }

    # cartões do dia de referência
    dia_ant = (d_ref - timedelta(days=1)).isoformat()
    cartoes = []
    for sm in c.ORDEM_SM:
        hs = por_dia[dia_ref]
        vals = [horario[sm][h] for h in hs]
        media_dia = diario[sm][dia_ref]
        ant = diario[sm].get(dia_ant)
        ult7 = [diario[sm][k] for k in dias_completos if (d_ref - timedelta(days=7)).isoformat() <= k < dia_ref]
        m7 = c.media(ult7) if len(ult7) == 7 else None
        pct = c.percentil_de(media_dia, dist_diaria(sm))
        cartoes.append({
            "sm": sm, "nome": c.NOME_SUBMERCADO[sm],
            "media_dia": c.r(media_dia),
            "min_hora": c.r(min(vals)), "quando_min": hs[vals.index(min(vals))],
            "max_hora": c.r(max(vals)), "quando_max": hs[vals.index(max(vals))],
            "variacao_dia_anterior": None if ant is None else {"abs": c.r(media_dia - ant), "pct": c.r(100 * (media_dia / ant - 1), 1) if ant else None},
            "media_7d_anteriores": c.r(m7),
            "variacao_vs_7d": None if m7 is None else {"abs": c.r(media_dia - m7), "pct": c.r(100 * (media_dia / m7 - 1), 1) if m7 else None},
            "posicao": {"percentil": c.r(pct, 1), "faixa": c.faixa_por_quartis(pct),
                        "n_dias": len(dist_diaria(sm)), "quartis": quartis_d[sm]},
            "menor_valor_ano": c.r(menor_ano[(sm, dia_ref[:4])]),
            "horas_no_menor_valor_ano": sum(1 for v in vals if abs(v - menor_ano[(sm, dia_ref[:4])]) < 1e-9),
        })

    curva = [{"h": _hora_local(h), **{sm: c.r(horario[sm][h]) for sm in c.ORDEM_SM}} for h in por_dia[dia_ref]]
    h30 = janela(30)
    horario_30d = [{"t": h, **{sm: c.r(horario[sm][h]) for sm in c.ORDEM_SM}} for h in h30]
    serie_diaria = [{"d": k, **{sm: c.r(diario[sm][k]) for sm in c.ORDEM_SM}} for k in dias_completos]
    mensal = {}
    for k in dias_completos:
        mensal.setdefault(k[:7], []).append(k)
    serie_mensal = []
    for mes in sorted(mensal):
        ks = mensal[mes]
        serie_mensal.append({"m": mes, "dias": len(ks), "parcial": mes_parcial(mes, len(ks)),
                             **{sm: c.r(c.media([diario[sm][k] for k in ks])) for sm in c.ORDEM_SM}})
    anos = sorted({a for (_, a) in menor_ano})
    menores = [{"ano": a, "ate": dia_ref if a == dia_ref[:4] else f"{a}-12-31",
                **{sm: c.r(menor_ano.get((sm, a))) for sm in c.ORDEM_SM}} for a in anos]

    # downloads
    base.escreve_csv("pld_horario.csv", ["data_hora_local", "SE", "S", "NE", "N"],
                     [[h] + [horario[sm][h] for sm in c.ORDEM_SM] for h in horas_comuns])
    base.escreve_csv("pld_diario.csv", ["data", "SE", "S", "NE", "N"],
                     [[k] + [diario[sm][k] for sm in c.ORDEM_SM] for k in dias_completos])

    # o texto sobre a coleta vem do registro da última tentativa, nunca fixo
    if coleta and coleta.get("ok"):
        situacao = f"A última tentativa de coleta direta no portal da CCEE em {c.carimbo_br(coleta['tentado_em'])} foi bem-sucedida."
    elif coleta:
        situacao = (f"A última tentativa de coleta direta no portal da CCEE em {c.carimbo_br(coleta['tentado_em'])} falhou "
                    f"({(coleta.get('detalhe') or 'sem detalhe')[:80]}); a série usa a última captura bem-sucedida.")
    else:
        situacao = "A coleta direta no portal da CCEE não foi tentada nesta execução; a série usa a última captura bem-sucedida."
    limitacoes = LIMITACOES_BASE + [
        f"Série integrada a partir das capturas primárias {_capturas_por_ano(snap)}; horas publicadas depois da última captura ainda não estão integradas. {situacao}",
    ]
    periodo_total = {"inicio": primeira, "fim": ultima}
    prov_horario = c.proveniencia(
        indicador="PLD horário por submercado", natureza="OBSERVADO", fonte=c.FONTE_CCEE_PLD,
        unidade="R$/MWh (nominal)", frequencia="horária", periodo=periodo_total, cobertura=periodo_total,
        capturado_em=captura, snapshot=snap, publicacao_informada=False,
        transformacoes=["leitura do CSV da CCEE; HORA local (0 a 23) convertida em AAAA-MM-DDTHH:00, horário de Brasília"],
        limitacoes=limitacoes, download="/energia/series/pld_horario.csv",
        notas_fonte="O PLD é calculado pela CCEE diariamente para cada hora do dia seguinte, considerando a aplicação dos limites máximos (horário e estrutural) e mínimo vigentes para cada período de apuração e para cada submercado. Este cálculo é realizado por modelos computacionais (Newave, Decomp e Dessem) e tem como base o Custo Marginal de Operação (CMO). (Descrição da organização Preço de Liquidação das Diferenças no portal de dados abertos da CCEE, capturada em 27/09/2026.)",
    )
    prov_diario = c.proveniencia(
        indicador="PLD médio diário por submercado", natureza="CALCULADO", fonte=c.FONTE_CCEE_PLD,
        unidade="R$/MWh (nominal)", frequencia="diária", periodo={"inicio": dias_completos[0], "fim": dia_ref},
        cobertura={"inicio": dias_completos[0], "fim": dia_ref}, capturado_em=captura, snapshot=snap,
        transformacoes=["média aritmética simples das 24 horas de cada dia; dias sem as 24 horas não recebem média"],
        formula="PLD_dia(s) = (1/24) × Σ PLD_h(s), h = 0..23",
        limitacoes=limitacoes + ["Média simples calculada pela Scrutiniums; pode diferir de médias publicadas por outras fontes com outra ponderação."],
        download="/energia/series/pld_diario.csv",
    )
    prov_posicao = c.proveniencia(
        indicador="Posição do PLD médio diário na distribuição histórica", natureza="CALCULADO",
        fonte=c.FONTE_CCEE_PLD, unidade="percentil (0 a 100)", frequencia="diária",
        periodo={"inicio": dia_ref, "fim": dia_ref}, cobertura={"inicio": INICIO_DISTRIBUICAO, "fim": dia_ref},
        capturado_em=captura, snapshot=snap,
        transformacoes=["distribuição das médias diárias do submercado de 01/01/2021 ao dia de referência", "rank médio para empates"],
        formula="percentil = 100 × (nº de dias com média menor + 0,5 × nº de dias com média igual) ÷ nº de dias",
        limitacoes=limitacoes + ["A distribuição de referência cobre só o período do PLD horário (desde 2021); anos de hidrologia muito diferente pesam na classificação."],
    )
    prov_mensal = c.proveniencia(
        indicador="PLD médio mensal por submercado", natureza="CALCULADO", fonte=c.FONTE_CCEE_PLD,
        unidade="R$/MWh (nominal)", frequencia="mensal", periodo={"inicio": dias_completos[0][:7], "fim": dia_ref[:7]},
        cobertura={"inicio": dias_completos[0], "fim": dia_ref}, capturado_em=captura, snapshot=snap,
        transformacoes=["média simples das médias diárias completas do mês", "mês corrente marcado como parcial pelo calendário"],
        formula="PLD_mês(s) = média de PLD_dia(s, d) para os dias d completos do mês",
        limitacoes=limitacoes + ["Média de médias diárias: igual à média horária do mês só quando todos os dias têm 24 horas."],
        download="/energia/series/pld_diario.csv",
    )
    prov_estatisticas = c.proveniencia(
        indicador="Estatísticas do PLD por período (média, mediana, quartis, extremos, desvio padrão, permanência, diferenças entre submercados)",
        natureza="CALCULADO", fonte=c.FONTE_CCEE_PLD, unidade="R$/MWh (nominal); permanência em % das horas",
        frequencia="por período (hoje, 7 dias, 30 dias, 12 meses, histórico)", periodo=periodo_total, cobertura=periodo_total,
        capturado_em=captura, snapshot=snap,
        transformacoes=["seleção das horas do período", "estatísticas descritivas sobre os valores horários", "quartis com interpolação linear (tipo 7)"],
        formula=("média = Σ PLD_h ÷ n; mediana e quartis tipo 7 dos valores horários; desvio padrão amostral; "
                 "permanência = % das horas abaixo de P25, entre P25 e P75 e acima de P75 da distribuição horária desde 01/01/2021; "
                 f"diferença entre submercados = % das horas com |PLD_a − PLD_b| > R$ {LIMIAR_DIFERENCA:.2f}/MWh".replace(".", ",")),
        limitacoes=limitacoes + ["Estatísticas descritivas do período; não indicam tendência nem causa."],
        download="/energia/series/pld_horario.csv",
    )
    return {
        **c.cabecalho("pld.json"),
        "unidade": "R$/MWh (nominal)",
        "fuso": "Horário de Brasília (UTC-3, sem horário de verão no período)",
        "dia_referencia": dia_ref,
        "primeira_hora": primeira, "ultima_hora": ultima,
        "coleta_direta": coleta,
        "regras": REGRAS,
        "limiar_diferenca": LIMIAR_DIFERENCA,
        "cartoes": cartoes,
        "amplitude_dia": c.r(max(diario[sm][dia_ref] for sm in c.ORDEM_SM) - min(diario[sm][dia_ref] for sm in c.ORDEM_SM)),
        "periodos": periodos,
        "curva_horaria": {"dia": dia_ref, "horas": curva},
        "horario_30d": horario_30d,
        "diario": serie_diaria,
        "mensal": serie_mensal,
        "menor_valor_ano": menores,
        "quartis_horarios": {sm: {"p25": c.r(quartis_h[sm][0]), "p75": c.r(quartis_h[sm][1])} for sm in c.ORDEM_SM},
        "snapshot": snap,
        "proveniencia": {"horario": prov_horario, "diario": prov_diario, "posicao": prov_posicao,
                         "estatisticas": prov_estatisticas, "mensal": prov_mensal},
        "downloads": [
            {"rotulo": "PLD horário, quatro submercados (CSV)", "url": "/energia/series/pld_horario.csv"},
            {"rotulo": "PLD médio diário, quatro submercados (CSV)", "url": "/energia/series/pld_diario.csv"},
        ],
    }
