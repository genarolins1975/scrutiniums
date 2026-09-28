"""Gold de hidrologia (ONS): EAR e ENA por subsistema, com comparação sazonal.

Regras publicadas:
- EAR do SIN (CALCULADO): soma das EAR verificadas (MWmês) dividida pela soma das
  EAR máximas dos quatro subsistemas;
- padrão histórico para a data: mediana, 10º e 90º percentis do valor do mesmo dia
  do calendário nos anos completos anteriores (desde 2001); 29/02 usa 28/02;
- fora da faixa usual: abaixo do 10º ou acima do 90º percentil para a data;
- ENA de 30 dias em % da MLT (CALCULADO): soma da ENA bruta dos 30 dias dividida pela
  soma da MLT implícita (ENA ÷ percentual informado), o que equivale a ponderar
  cada dia pela sua MLT.
"""
import os
import sys
from datetime import timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import base  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

EAR, ENA = "ear_subsistema_di", "ena_subsistema_di"
ANO_INICIAL_PADRAO = 2001
SMS = c.ORDEM_SM

REGRAS = {
    "ear_sin": "EAR do SIN = soma das EAR verificadas dos quatro subsistemas (MWmês) ÷ soma das EAR máximas.",
    "padrao_historico": "Mediana, 10º e 90º percentis do valor do mesmo dia do calendário nos anos completos anteriores, desde 2001. Para 29 de fevereiro usa-se 28 de fevereiro.",
    "faixa_usual": "Dentro da faixa usual: entre o 10º e o 90º percentil para a data. Abaixo ou acima disso, fora da faixa usual.",
    "ena_30d": "ENA de 30 dias em % da MLT = soma da ENA bruta dos 30 dias ÷ soma da MLT implícita de cada dia (ENA ÷ percentual da MLT informado pelo ONS).",
    "desvio_principal": "Desvio principal: subsistema com a maior distância, em pontos percentuais, entre a EAR do dia e a mediana histórica para a data.",
}


def _md(dia):
    md = dia[5:10]
    return "02-28" if md == "02-29" else md


def _entra_no_padrao(k, dia_ref):
    """O padrão da data usa um valor por ano: 29/02 fica fora da distribuição (senão o
    grupo de 28/02 contaria os anos bissextos duas vezes); um dia de referência 29/02
    é comparado com a distribuição de 28/02."""
    return k[5:10] != "02-29" and _md(k) == _md(dia_ref)


def _sazonal(serie, dia_ref, ano_ini=ANO_INICIAL_PADRAO):
    """{md: (p10, p50, p90, n)} usando anos completos de ano_ini até o ano anterior ao de referência."""
    ano_ref = int(dia_ref[:4])
    por_md = {}
    for k, v in serie.items():
        a = int(k[:4])
        if ano_ini <= a < ano_ref and k[5:10] != "02-29":
            por_md.setdefault(k[5:10], []).append(v)
    return {md: (c.quantil(vs, 0.1), c.quantil(vs, 0.5), c.quantil(vs, 0.9), len(vs)) for md, vs in por_md.items()}


def _faixa(v, p10, p90):
    if v is None or p10 is None:
        return None
    if v < p10:
        return "abaixo"
    if v > p90:
        return "acima"
    return "dentro"


def construir(con):
    ear_pct = {sm: dict(base.serie_vigente(con, EAR, f"ear_pct.{sm}")) for sm in SMS}
    ear_mw = {sm: dict(base.serie_vigente(con, EAR, f"ear_mwmes.{sm}")) for sm in SMS}
    ear_max = {sm: dict(base.serie_vigente(con, EAR, f"ear_max_mwmes.{sm}")) for sm in SMS}
    ena_pct = {sm: dict(base.serie_vigente(con, ENA, f"ena_bruta_pct_mlt.{sm}")) for sm in SMS}
    ena_mw = {sm: dict(base.serie_vigente(con, ENA, f"ena_bruta_mwmed.{sm}")) for sm in SMS}
    if not all(ear_pct.values()) or not all(ena_pct.values()):
        return c.stub("hidrologia.json", "EAR ou ENA ausente no silver")
    snap_ear, snap_ena = c.snapshot_de(con, EAR), c.snapshot_de(con, ENA)

    dias_ear = sorted(set.intersection(*(set(s) for s in ear_pct.values())))
    dias_ena = sorted(set.intersection(*(set(s) for s in ena_pct.values())))
    # SIN calculado apenas onde há os quatro subsistemas com MWmês e máxima
    ear_pct["SIN"] = {}
    for k in dias_ear:
        try:
            num = sum(ear_mw[sm][k] for sm in SMS)
            den = sum(ear_max[sm][k] for sm in SMS)
        except KeyError:
            continue
        if den > 0:
            ear_pct["SIN"][k] = 100.0 * num / den
    mlt = {sm: {k: ena_mw[sm][k] / (ena_pct[sm][k] / 100.0)
                for k in dias_ena if k in ena_mw[sm] and ena_pct[sm].get(k)} for sm in SMS}
    ena_mw["SIN"] = {k: sum(ena_mw[sm][k] for sm in SMS) for k in dias_ena if all(k in ena_mw[sm] for sm in SMS)}
    mlt["SIN"] = {k: sum(mlt[sm][k] for sm in SMS) for k in dias_ena if all(k in mlt[sm] for sm in SMS)}
    ena_pct["SIN"] = {k: 100.0 * ena_mw["SIN"][k] / mlt["SIN"][k] for k in ena_mw["SIN"] if mlt["SIN"].get(k)}

    dia_ear = max(ear_pct["SIN"])
    dia_ena = max(ena_pct["SIN"])
    todos = SMS + ("SIN",)

    def ena30(sm, fim):
        f = c.d(fim)
        ks = [(f - timedelta(days=i)).isoformat() for i in range(30)]
        if not all(k in ena_mw[sm] and k in mlt[sm] for k in ks):
            return None
        return 100.0 * sum(ena_mw[sm][k] for k in ks) / sum(mlt[sm][k] for k in ks)

    subsistemas = []
    bandas = {}
    for sm in todos:
        saz = _sazonal(ear_pct[sm], dia_ear)
        bandas[sm] = saz
        v = ear_pct[sm].get(dia_ear)
        p10, p50, p90, n = saz.get(_md(dia_ear), (None, None, None, 0))
        d7 = (c.d(dia_ear) - timedelta(days=7)).isoformat()
        d30 = (c.d(dia_ear) - timedelta(days=30)).isoformat()
        e30 = ena30(sm, dia_ena)
        # ENA 30 dias na mesma janela dos anos anteriores (percentil)
        hist_e30 = []
        for a in range(ANO_INICIAL_PADRAO, int(dia_ena[:4])):
            try:
                fim_a = c.d(dia_ena).replace(year=a)
            except ValueError:
                fim_a = c.d(dia_ena).replace(year=a, day=28)
            x = ena30(sm, fim_a.isoformat())
            if x is not None:
                hist_e30.append(x)
        subsistemas.append({
            "sm": sm, "nome": c.NOME_SUBMERCADO[sm],
            "ear": {
                "valor": c.r(v, 1), "dia": dia_ear,
                "natureza": "CALCULADO" if sm == "SIN" else "OBSERVADO",
                "variacao_7d_pp": c.r(v - ear_pct[sm][d7], 1) if d7 in ear_pct[sm] else None,
                "variacao_30d_pp": c.r(v - ear_pct[sm][d30], 1) if d30 in ear_pct[sm] else None,
                "mediana_historica": c.r(p50, 1), "p10": c.r(p10, 1), "p90": c.r(p90, 1), "anos_na_base": n,
                "desvio_mediana_pp": c.r(v - p50, 1) if p50 is not None else None,
                "percentil_na_data": c.r(c.percentil_de(v, [x for k, x in ear_pct[sm].items()
                                                            if _entra_no_padrao(k, dia_ear) and ANO_INICIAL_PADRAO <= int(k[:4]) < int(dia_ear[:4])]), 1),
                "faixa": _faixa(v, p10, p90),
            },
            "ena": {
                "dia": dia_ena,
                "pct_mlt_dia": c.r(ena_pct[sm].get(dia_ena), 1),
                "natureza_dia": "CALCULADO" if sm == "SIN" else "OBSERVADO",
                "pct_mlt_30d": c.r(e30, 1),
                "percentil_30d_mesma_janela": c.r(c.percentil_de(e30, hist_e30), 1),
                "p10_30d": c.r(c.quantil(hist_e30, 0.1), 1), "p90_30d": c.r(c.quantil(hist_e30, 0.9), 1),
                "anos_na_base_30d": len(hist_e30),
                "faixa_30d": _faixa(e30, c.quantil(hist_e30, 0.1), c.quantil(hist_e30, 0.9)),
            },
        })

    principal = max((s for s in subsistemas if s["sm"] != "SIN" and s["ear"]["desvio_mediana_pp"] is not None),
                    key=lambda s: abs(s["ear"]["desvio_mediana_pp"]), default=None)

    # séries para gráficos: últimos 3 anos de EAR e 18 meses de ENA; bandas sazonais
    ini_ear = (c.d(dia_ear) - timedelta(days=3 * 365)).isoformat()
    serie_ear = [{"d": k, **{sm: c.r(ear_pct[sm].get(k), 2) for sm in todos}}
                 for k in dias_ear if k >= ini_ear]
    ini_ena = (c.d(dia_ena) - timedelta(days=548)).isoformat()
    serie_ena = [{"d": k, **{sm: c.r(ena_pct[sm].get(k), 1) for sm in todos}}
                 for k in dias_ena if k >= ini_ena]
    mds = sorted(bandas["SIN"])
    serie_bandas = [{"md": md, **{f"{sm}_{q}": c.r(bandas[sm].get(md, (None,) * 4)[i], 2)
                                  for sm in todos for i, q in ((0, "p10"), (1, "p50"), (2, "p90"))}}
                    for md in mds]
    mensal = {}
    for k in dias_ear:
        mensal.setdefault(k[:7], []).append(k)
    serie_mensal = [{"m": m, **{sm: c.r(c.media([ear_pct[sm].get(k) for k in ks]), 1) for sm in todos}}
                    for m, ks in sorted(mensal.items())]

    base.escreve_csv("ear_diario.csv", ["data", "SE", "S", "NE", "N", "SIN_calculado"],
                     [[k] + [ear_pct[sm].get(k) for sm in todos] for k in dias_ear])
    base.escreve_csv("ena_diario.csv", ["data"] + [f"{sm}_pct_mlt" for sm in todos] + [f"{sm}_mwmed" for sm in todos],
                     [[k] + [ena_pct[sm].get(k) for sm in todos] + [ena_mw[sm].get(k) for sm in todos] for k in dias_ena])

    meta_ear, meta_ena = c.meta_ons(EAR), c.meta_ons(ENA)
    lim_comum = ["O ONS informa que os dados fazem parte de um processo de consistência recorrente e podem ser atualizados após a publicação; revisões entram como novas vintages."]
    prov_ear = c.proveniencia(
        indicador="Energia armazenada (EAR) por subsistema, % da EAR máxima", natureza="OBSERVADO",
        fonte=c.fonte_ons("ear-diario-por-subsistema", EAR, "EAR Diário por Subsistema"),
        unidade="% da EAR máxima", frequencia="diária", periodo={"inicio": dias_ear[0], "fim": dia_ear},
        cobertura={"inicio": dias_ear[0], "fim": dia_ear}, capturado_em=c.ultima_captura(snap_ear), snapshot=snap_ear,
        transformacoes=[], download="/energia/series/ear_diario.csv",
        limitacoes=lim_comum + ["A EAR máxima muda com a entrada e saída de reservatórios; comparações longas em percentual misturam capacidades diferentes."],
        notas_fonte=meta_ear.get("notas"),
    )
    prov_ear_sin = c.proveniencia(
        indicador="EAR do SIN, % da EAR máxima", natureza="CALCULADO",
        fonte=c.fonte_ons("ear-diario-por-subsistema", EAR, "EAR Diário por Subsistema"),
        unidade="% da EAR máxima", frequencia="diária", periodo={"inicio": dias_ear[0], "fim": dia_ear},
        cobertura={"inicio": dias_ear[0], "fim": dia_ear}, capturado_em=c.ultima_captura(snap_ear), snapshot=snap_ear,
        transformacoes=["soma das EAR verificadas e das EAR máximas dos quatro subsistemas"],
        formula="EAR_SIN = Σ EAR_verificada(s) ÷ Σ EAR_máxima(s) × 100, s ∈ {SE, S, NE, N}",
        limitacoes=lim_comum + ["O Sudeste/Centro-Oeste concentra a maior parte da capacidade de armazenamento e domina o agregado."],
    )
    prov_saz = c.proveniencia(
        indicador="Padrão histórico da EAR para a data", natureza="CALCULADO",
        fonte=c.fonte_ons("ear-diario-por-subsistema", EAR, "EAR Diário por Subsistema"),
        unidade="% da EAR máxima", frequencia="diária", periodo={"inicio": f"{ANO_INICIAL_PADRAO}-01-01", "fim": f"{int(dia_ear[:4]) - 1}-12-31"},
        cobertura={"inicio": dias_ear[0], "fim": dia_ear}, capturado_em=c.ultima_captura(snap_ear), snapshot=snap_ear,
        transformacoes=["valores do mesmo dia do calendário em cada ano completo anterior", "quantis com interpolação linear"],
        formula="mediana e percentis 10 e 90 de {EAR(ano, dia) : ano = 2001..ano_ref − 1}; percentil na data = rank médio do valor do dia nessa distribuição; 29/02 fica fora da distribuição e, como dia de referência, usa a de 28/02",
        limitacoes=lim_comum + ["Anos com capacidade de armazenamento diferente da atual entram com o mesmo peso."],
    )
    prov_ear_mensal = c.proveniencia(
        indicador="EAR média mensal por subsistema e SIN, % da EAR máxima", natureza="CALCULADO",
        fonte=c.fonte_ons("ear-diario-por-subsistema", EAR, "EAR Diário por Subsistema"),
        unidade="% da EAR máxima", frequencia="mensal", periodo={"inicio": dias_ear[0][:7], "fim": dia_ear[:7]},
        cobertura={"inicio": dias_ear[0], "fim": dia_ear}, capturado_em=c.ultima_captura(snap_ear), snapshot=snap_ear,
        transformacoes=["média aritmética dos valores diários do mês", "SIN: média dos valores diários do SIN calculado"],
        formula="EAR_mensal(s, m) = média de EAR%(s, d) para os dias d do mês m com dado; o mês corrente é parcial",
        download="/energia/series/ear_diario.csv",
        limitacoes=lim_comum + ["O mês corrente entra com os dias disponíveis e não é comparável a um mês completo."],
    )
    prov_ena = c.proveniencia(
        indicador="Energia natural afluente (ENA) bruta, % da MLT", natureza="OBSERVADO",
        fonte=c.fonte_ons("ena-diario-por-subsistema", ENA, "ENA Diário por Subsistema"),
        unidade="% da média de longo termo (MLT)", frequencia="diária", periodo={"inicio": dias_ena[0], "fim": dia_ena},
        cobertura={"inicio": dias_ena[0], "fim": dia_ena}, capturado_em=c.ultima_captura(snap_ena), snapshot=snap_ena,
        transformacoes=[], download="/energia/series/ena_diario.csv",
        limitacoes=lim_comum + [
            "O conjunto não informa o período de referência da MLT.",
            "O dicionário de dados do ONS descreve a unidade das colunas terminadas em _mwmed como MWmês; a Scrutiniums trata o valor como MWmed, conforme o nome da coluna, e privilegia o percentual da MLT.",
        ],
        notas_fonte=meta_ena.get("notas"),
    )
    prov_ena30 = c.proveniencia(
        indicador="ENA bruta acumulada em 30 dias, % da MLT", natureza="CALCULADO",
        fonte=c.fonte_ons("ena-diario-por-subsistema", ENA, "ENA Diário por Subsistema"),
        unidade="% da MLT", frequencia="diária (janela móvel de 30 dias)",
        periodo={"inicio": (c.d(dia_ena) - timedelta(days=29)).isoformat(), "fim": dia_ena},
        cobertura={"inicio": dias_ena[0], "fim": dia_ena}, capturado_em=c.ultima_captura(snap_ena), snapshot=snap_ena,
        transformacoes=["MLT implícita diária = ENA ÷ (percentual da MLT ÷ 100)", "soma de 30 dias do numerador e do denominador"],
        formula="ENA30 = Σ ENA(d) ÷ Σ MLT(d) × 100, d nos últimos 30 dias",
        limitacoes=lim_comum + ["Janela de 30 dias suaviza eventos curtos de chuva."],
    )
    return {
        **c.cabecalho("hidrologia.json"),
        "dia_referencia_ear": dia_ear,
        "dia_referencia_ena": dia_ena,
        "regras": REGRAS,
        "subsistemas": subsistemas,
        "desvio_principal": None if not principal else {"sm": principal["sm"], "nome": principal["nome"],
                                                         "desvio_pp": principal["ear"]["desvio_mediana_pp"]},
        "serie_ear": serie_ear,
        "serie_ena": serie_ena,
        "bandas_ear": serie_bandas,
        "mensal_ear": serie_mensal,
        "proveniencia": {"ear": prov_ear, "ear_sin": prov_ear_sin, "padrao": prov_saz, "ear_mensal": prov_ear_mensal,
                         "ena": prov_ena, "ena30": prov_ena30},
        "fonte_notas": {"ear": meta_ear.get("notas"), "ena": meta_ena.get("notas")},
        "downloads": [
            {"rotulo": "EAR diária por subsistema e SIN (CSV)", "url": "/energia/series/ear_diario.csv"},
            {"rotulo": "ENA diária por subsistema e SIN (CSV)", "url": "/energia/series/ena_diario.csv"},
        ],
    }
