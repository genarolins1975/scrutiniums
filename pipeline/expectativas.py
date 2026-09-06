"""Expectativas de mercado (Focus) para a aba Cenários.

O que entra em scenario.json:
- `expectativas`: a última divulgação do Focus (mediana, média, desvio-padrão, mínimo,
  máximo e número de respondentes) para Selic, IPCA, PIB, câmbio e desocupação, no ano
  corrente e nos dois seguintes; a trajetória esperada da Selic por reunião do Copom; e o
  histórico semanal da expectativa para o ano corrente e o seguinte (revisões).
- presets `focus_{ano}`: os choques dos controles deslizantes calculados como a distância
  entre a mediana do Focus para o fim do ano e o último dado observado: Selic meta (SGS
  432), desocupação da PNAD (24369), atividade pelo IBC-Br (24363, variação de 12 meses
  como proxy do PIB) e câmbio PTAX de venda (3698, média mensal). Arredondados ao passo
  de cada controle e limitados à sua faixa. É o consenso do mercado aplicado ao mesmo
  modelo de elasticidades, não uma previsão do Observatório.

A Pesquisa Trimestral de Condições de Crédito (PTC), a outra metade do painel nº 4 da
avaliação de 05/09, só é publicada em PDF e fica fora da Fase 0 por regra editorial.
"""
from datetime import date

from pipeline import common
from pipeline.fmt import _r

INDICADORES = {"Selic": "Selic (fim do ano, % a.a.)", "IPCA": "IPCA (acumulado no ano, %)", "PIB Total": "PIB (crescimento real, %)",
               "Câmbio": "Câmbio (fim do ano, R$/US$)", "Taxa de desocupação": "Desocupação (média do 4º trimestre, %)"}
CONTROLES = {"selic_pp": (-4, 8, 0.25), "desemprego_pp": (-3, 6, 0.25), "pib_pp": (-6, 4, 0.25), "cambio_pct10": (-3, 6, 0.5)}


def _passo(v, k):
    lo, hi, st = CONTROLES[k]
    if v is None:
        return None
    v = round(v / st) * st
    return max(lo, min(hi, round(v, 2)))


def _ult(con, key):
    rows = common.get_series(con, key)
    return (rows[-1][0][:10], rows[-1][1]) if rows else (None, None)


def _ibc_yoy(con):
    rows = common.get_series(con, "ibc_br")
    if len(rows) < 24:
        return None, None
    v = [x[1] for x in rows]
    return rows[-1][0][:7], _r((sum(v[-12:]) / sum(v[-24:-12]) - 1) * 100)


def build(con):
    try:
        ult = con.execute("SELECT MAX(data) FROM focus_anual").fetchone()[0]
    except Exception:
        ult = None
    if not ult:
        return {"disponivel": False, "motivo": "Focus ainda não coletado"}
    ano = int(ult[:4])
    anos = [str(ano), str(ano + 1), str(ano + 2)]
    tabela = {}
    for ind, mediana, media, dp, mn, mx, n, ref in con.execute(
            "SELECT indicador, mediana, media, dp, minimo, maximo, n, ref FROM focus_anual WHERE data=? ORDER BY indicador, ref", (ult,)):
        if ref in anos:
            tabela.setdefault(ind, {})[ref] = {"mediana": mediana, "media": _r(media), "dp": _r(dp), "minimo": mn, "maximo": mx, "n": n}
    # histórico semanal (revisões) da expectativa para o ano corrente e o seguinte
    historico = {}
    for ind in INDICADORES:
        rows = con.execute("SELECT data, ref, mediana FROM focus_anual WHERE indicador=? AND ref IN (?,?) ORDER BY data", (ind, anos[0], anos[1])).fetchall()
        por = {}
        for d, ref, m in rows:
            por.setdefault(d, {})[ref] = m
        historico[ind] = [{"data": d, "atual": x.get(anos[0]), "proximo": x.get(anos[1])} for d, x in sorted(por.items())]
    selic_reunioes = [{"reuniao": r, "mediana": m, "n": n} for r, m, n in con.execute(
        "SELECT reuniao, mediana, n FROM focus_selic WHERE data=(SELECT MAX(data) FROM focus_selic) ORDER BY SUBSTR(reuniao, 4, 4), SUBSTR(reuniao, 2, 1)")]
    # observado hoje
    d_selic, selic = _ult(con, "selic_meta")
    d_des, des = _ult(con, "desemprego")
    d_ibc, ibc = _ibc_yoy(con)
    d_cam, cam = _ult(con, "cambio_ptax")
    atual = {"selic_meta": {"v": selic, "ref": d_selic}, "desemprego": {"v": des, "ref": d_des}, "ibc_yoy": {"v": ibc, "ref": d_ibc}, "cambio": {"v": cam, "ref": d_cam}}
    presets, derivacao = {}, {}
    g = lambda ind, a: (tabela.get(ind, {}).get(a) or {}).get("mediana")
    for a in anos[:2]:
        bruto = {"selic_pp": (g("Selic", a) - selic) if g("Selic", a) is not None and selic is not None else None,
                 "desemprego_pp": (g("Taxa de desocupação", a) - des) if g("Taxa de desocupação", a) is not None and des is not None else None,
                 "pib_pp": (g("PIB Total", a) - ibc) if g("PIB Total", a) is not None and ibc is not None else None,
                 "cambio_pct10": ((g("Câmbio", a) / cam - 1) * 100 / 10) if g("Câmbio", a) and cam else None}
        if all(v is not None for v in bruto.values()):
            presets[f"focus_{a}"] = {k: _passo(v, k) for k, v in bruto.items()}
            derivacao[f"focus_{a}"] = {"ano": a, "bruto": {k: _r(v) for k, v in bruto.items()},
                                       "esperado": {"selic": g("Selic", a), "desemprego": g("Taxa de desocupação", a), "pib": g("PIB Total", a), "cambio": g("Câmbio", a)}}
    return {
        "disponivel": True, "data": ult, "anos": anos, "rotulos": INDICADORES, "tabela": tabela, "historico": historico,
        "selic_reunioes": selic_reunioes, "atual": atual, "presets": presets, "derivacao": derivacao,
        "fonte": {"nome": "BCB — Expectativas de mercado (Focus), API Olinda", "url": "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/",
                  "licenca": "dados abertos do BCB", "nivel": "A — pesquisa oficial semanal com instituições credenciadas"},
        "metodo": ("Mediana da base 0 (todos os respondentes dos últimos 30 dias) na última divulgação. Preset = mediana para o fim do ano menos o último "
                   "dado observado (Selic meta, desocupação PNAD, IBC-Br em 12 meses como proxy do PIB, PTAX de venda média mensal), arredondado ao passo "
                   "de cada controle e limitado à sua faixa."),
        "cautelas": [
            "Expectativa não é previsão do Observatório nem do BCB: é o consenso dos respondentes do Focus na data, revisado toda semana.",
            "O IBC-Br em 12 meses é proxy do PIB: as duas medidas divergem em nível e em calendário; o choque de PIB do preset carrega essa aproximação.",
            "Os presets aplicam o consenso ao mesmo modelo de elasticidades da aba, com as mesmas limitações declaradas abaixo.",
            "A Pesquisa Trimestral de Condições de Crédito (PTC) do BCB é publicada só em PDF e fica fora da Fase 0; a ótica do ofertante entra quando houver dado estruturado.",
        ],
    }
