"""Gold do CMO semanal (ONS, estimado pelo modelo DECOMP).

O CMO é publicado pelo ONS por semana operativa, subsistema e patamar de carga. A
natureza é ESTIMADO (estimado pela fonte, seção 11.3 da especificação): é resultado do
modelo DECOMP, calculado na elaboração do PMO e de suas revisões semanais, e semanas
futuras já aparecem publicadas. Valor oficial não é o mesmo que valor observado. CMO não
é PLD: o PLD aplica limites regulatórios e é calculado pela CCEE em base horária; a
comparação exibida é descritiva. A mesma natureza está no catálogo de métricas
(pipeline/energia/metricas/pld.py) e na gold pld_detalhe.json.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import base  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

DS = "cmo_se"


def _limitacao_unidade(series, patamares):
    """Achado A03: o dicionário do ONS diz R$/MW para a média semanal e R$/MWh para os
    patamares. A exibição em R$/MWh se apoia na conferência de que a média fica entre o
    menor e o maior patamar da mesma semana; o texto sai da conferência, não é fixo."""
    n = dentro = 0
    for sm in c.ORDEM_SM:
        for k, v in series[sm].items():
            pats = [patamares[(p, sm)].get(k) for p in ("leve", "media", "pesada")]
            if None in pats:
                continue
            n += 1
            dentro += min(pats) - 0.01 <= v <= max(pats) + 0.01
    base_txt = "O dicionário de dados do ONS indica a unidade da média semanal como R$/MW e a dos patamares como R$/MWh. "
    if n and dentro == n:
        return base_txt + (f"A média semanal é exibida em R$/MWh porque fica entre o menor e o maior patamar em todas as {n} semanas-subsistema "
                           "conferidas (achado A03); R$/MW seria custo por potência e não é equivalente.")
    return base_txt + (f"A média semanal fica fora do intervalo dos patamares em {n - dentro} de {n} semanas-subsistema; a leitura em R$/MWh "
                       "não está confirmada para essas semanas.")


def construir(con):
    series = {sm: dict(base.serie_vigente(con, DS, f"cmo_semanal.{sm}")) for sm in c.ORDEM_SM}
    if not all(series.values()):
        return c.stub("cmo.json", "CMO semanal ausente no silver")
    patamares = {(p, sm): dict(base.serie_vigente(con, DS, f"cmo_{p}.{sm}"))
                 for p in ("leve", "media", "pesada") for sm in c.ORDEM_SM}
    snap = c.snapshot_de(con, DS)
    semanas = sorted(set.intersection(*(set(s) for s in series.values())))
    ultima = semanas[-1]
    serie = [{"s": k, **{sm: c.r(series[sm][k]) for sm in c.ORDEM_SM}} for k in semanas[-156:]]
    ult = [{"sm": sm, "nome": c.NOME_SUBMERCADO[sm], "semanal": c.r(series[sm][ultima]),
            "leve": c.r(patamares[("leve", sm)].get(ultima)), "media": c.r(patamares[("media", sm)].get(ultima)),
            "pesada": c.r(patamares[("pesada", sm)].get(ultima)),
            "semana_anterior": c.r(series[sm].get(semanas[-2])) if len(semanas) > 1 else None}
           for sm in c.ORDEM_SM]
    base.escreve_csv("cmo_semanal.csv", ["semana_operativa"] + [f"{sm}_{p}" for sm in c.ORDEM_SM for p in ("semanal", "leve", "media", "pesada")],
                     [[k] + [v for sm in c.ORDEM_SM for v in (series[sm].get(k), patamares[("leve", sm)].get(k),
                                                            patamares[("media", sm)].get(k), patamares[("pesada", sm)].get(k))]
                      for k in semanas])
    meta = c.meta_ons(DS)
    prov = c.proveniencia(
        indicador="Custo Marginal de Operação semanal por subsistema", natureza="ESTIMADO",
        fonte=c.fonte_ons("cmo-semanal", DS, "CMO Semanal"),
        unidade="R$/MWh", frequencia="semana operativa", periodo={"inicio": semanas[0], "fim": ultima},
        cobertura={"inicio": semanas[0], "fim": ultima}, capturado_em=c.ultima_captura(snap), snapshot=snap,
        publicado_em=max((x["publicado_em"] or "" for x in snap["capturas"]), default=None) or None,
        limitacoes=[
            "Valor estimado pelo modelo DECOMP e publicado pelo ONS: é resultado de modelo da fonte, não medição.",
            "CMO não é PLD: o PLD é calculado pela CCEE em base horária e aplica limites regulatórios.",
            _limitacao_unidade(series, patamares),
            "A data de referência é a da semana operativa informada pelo ONS; semanas futuras podem já estar publicadas.",
        ],
        download="/energia/series/cmo_semanal.csv", notas_fonte=meta.get("notas"),
    )
    return {
        **c.cabecalho("cmo.json"),
        "semana_referencia": ultima, "unidade": "R$/MWh",
        "ultima_semana": ult, "serie": serie,
        "proveniencia": {"cmo": prov}, "fonte_notas": meta.get("notas"),
        "downloads": [{"rotulo": "CMO semanal por subsistema e patamar (CSV)", "url": "/energia/series/cmo_semanal.csv"}],
    }
