"""Gold de carga (ONS, Carga de Energia Diária).

Regras publicadas:
- carga do SIN (CALCULADO): soma das cargas dos quatro subsistemas no dia;
- comparação anual: média dos últimos 7 (ou 30) dias contra os mesmos dias do ano
  anterior, SÓ quando os dois períodos estão no mesmo regime metodológico do ONS;
- regimes metodológicos (declarados pelo ONS): até 28/02/2021; de 01/03/2021 a
  28/04/2023 (inclui previsão de usinas não despachadas); desde 29/04/2023 (inclui
  estimativa da micro e minigeração distribuída, MMGD).
"""
import os
import sys
from datetime import timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import base  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

DS = "carga_energia_di"
SMS = c.ORDEM_SM
REGIMES = [
    {"inicio": "2000-01-01", "fim": "2021-02-28",
     "descricao": "Carga atendida por usinas despachadas ou programadas pelo ONS."},
    {"inicio": "2021-03-01", "fim": "2023-04-28",
     "descricao": "Inclui a previsão de geração de usinas não despachadas pelo ONS."},
    {"inicio": "2023-04-29", "fim": None,
     "descricao": "Inclui também a estimativa da micro e minigeração distribuída (MMGD), com base em dados meteorológicos previstos."},
]
REGRAS = {
    "carga_sin": "Carga do SIN = soma das cargas diárias dos quatro subsistemas.",
    "comparacao_anual": "Média dos últimos 7 ou 30 dias contra os mesmos dias do ano anterior, apenas quando os dois períodos estão no mesmo regime metodológico declarado pelo ONS.",
    "extremo_12m": "Maior carga diária dos últimos 365 dias.",
}


def regime_de(dia):
    for i, rg in enumerate(REGIMES):
        if rg["inicio"] <= dia and (rg["fim"] is None or dia <= rg["fim"]):
            return i
    return None


def construir(con):
    carga = {sm: dict(base.serie_vigente(con, DS, f"carga_mwmed.{sm}")) for sm in SMS}
    if not all(carga.values()):
        return c.stub("carga.json", "carga ausente no silver para algum subsistema")
    snap = c.snapshot_de(con, DS)
    dias = sorted(set.intersection(*(set(s) for s in carga.values())))
    carga["SIN"] = {k: sum(carga[sm][k] for sm in SMS) for k in dias}
    dia_ref = dias[-1]
    fim = c.d(dia_ref)
    todos = SMS + ("SIN",)

    def janela(n, ano_desloc=0):
        ks = []
        for i in range(n):
            x = fim - timedelta(days=i)
            if ano_desloc:
                try:
                    x = x.replace(year=x.year - ano_desloc)
                except ValueError:
                    return None
            ks.append(x.isoformat())
        return ks

    def comparacao(sm, n):
        atual, ant = janela(n), janela(n, 1)
        if ant is None or not all(k in carga[sm] for k in atual + ant):
            return None
        mesmo = regime_de(min(ant)) == regime_de(max(atual)) and regime_de(min(atual)) == regime_de(max(ant))
        ma, mb = c.media([carga[sm][k] for k in atual]), c.media([carga[sm][k] for k in ant])
        return {
            "media": c.r(ma, 0), "media_ano_anterior": c.r(mb, 0),
            "variacao_pct": c.r(100 * (ma / mb - 1), 1) if mesmo and mb else None,
            "mesmo_regime": mesmo,
            "inicio": min(atual), "fim": max(atual), "inicio_anterior": min(ant), "fim_anterior": max(ant),
        }

    subs = []
    for sm in todos:
        ult365 = [(k, carga[sm][k]) for k in janela(365) if k in carga[sm]]
        kmax, vmax = max(ult365, key=lambda x: x[1])
        subs.append({
            "sm": sm, "nome": c.NOME_SUBMERCADO[sm],
            "natureza": "CALCULADO" if sm == "SIN" else "OBSERVADO",
            "dia": c.r(carga[sm][dia_ref], 0),
            "ult7": comparacao(sm, 7),
            "ult30": comparacao(sm, 30),
            "max_12m": {"valor": c.r(vmax, 0), "dia": kmax},
        })
    ini = (fim - timedelta(days=3 * 365)).isoformat()
    serie = [{"d": k, **{sm: c.r(carga[sm][k], 0) for sm in todos}} for k in dias if k >= ini]
    mensal = {}
    for k in dias:
        mensal.setdefault(k[:7], []).append(k)
    serie_mensal = [{"m": m, "dias": len(ks), **{sm: c.r(c.media([carga[sm][k] for k in ks]), 0) for sm in todos}}
                    for m, ks in sorted(mensal.items())]
    base.escreve_csv("carga_diaria.csv", ["data", "SE", "S", "NE", "N", "SIN_calculado"],
                     [[k] + [carga[sm][k] for sm in todos] for k in dias])
    meta = c.meta_ons(DS)
    lim = [
        "O ONS mudou o conteúdo da série em 01/03/2021 e em 29/04/2023 (inclusão da estimativa de MMGD); comparações que atravessam essas datas não são homogêneas e não são exibidas como variação.",
        "Dados em processo de consistência recorrente do ONS, sujeitos a revisão após a publicação.",
    ]
    prov = c.proveniencia(
        indicador="Carga de energia diária por subsistema", natureza="OBSERVADO",
        fonte=c.fonte_ons("carga-energia", DS, "Carga de Energia Diária"),
        unidade="MWmed", frequencia="diária", periodo={"inicio": dias[0], "fim": dia_ref},
        cobertura={"inicio": dias[0], "fim": dia_ref}, capturado_em=c.ultima_captura(snap), snapshot=snap,
        publicado_em=max((x["publicado_em"] or "" for x in snap["capturas"]), default=None) or None,
        limitacoes=lim, download="/energia/series/carga_diaria.csv", notas_fonte=meta.get("notas"),
    )
    prov_sin = c.proveniencia(
        indicador="Carga do SIN e variação anual", natureza="CALCULADO",
        fonte=c.fonte_ons("carga-energia", DS, "Carga de Energia Diária"),
        unidade="MWmed e %", frequencia="diária", periodo={"inicio": dias[0], "fim": dia_ref},
        cobertura={"inicio": dias[0], "fim": dia_ref}, capturado_em=c.ultima_captura(snap), snapshot=snap,
        transformacoes=["soma dos quatro subsistemas", "médias móveis de 7 e 30 dias", "comparação com os mesmos dias do ano anterior"],
        formula="variação = média(últimos n dias) ÷ média(mesmos n dias do ano anterior) − 1",
        limitacoes=lim + ["Temperatura, dias úteis e feriados afetam a carga e não são ajustados."],
    )
    return {
        **c.cabecalho("carga.json"),
        "dia_referencia": dia_ref, "unidade": "MWmed",
        "regras": REGRAS, "regimes": REGIMES,
        "subsistemas": subs, "serie": serie, "mensal": serie_mensal,
        "proveniencia": {"carga": prov, "sin": prov_sin},
        "fonte_notas": meta.get("notas"),
        "downloads": [{"rotulo": "Carga diária por subsistema e SIN (CSV)", "url": "/energia/series/carga_diaria.csv"}],
    }
