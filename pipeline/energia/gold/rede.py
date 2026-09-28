"""Gold de rede: intercâmbios entre subsistemas (ONS) e descolamento de preços (CCEE).

Regras publicadas:
- fluxo diário por fronteira (CALCULADO): média das 24 horas do intercâmbio
  verificado, com sinal na orientação canônica (positivo = da primeira para a
  segunda ponta: N→NE, N→SE/CO, NE→SE/CO, S→SE/CO);
- intercâmbio líquido do subsistema: valor verificado do balanço de energia (positivo
  = exporta), média diária;
- diferença de preço na fronteira: média diária do PLD da segunda ponta menos o da
  primeira, no mesmo dia;
- limites de intercâmbio NÃO estão integrados: o módulo não afirma que a rede
  "limitou" um fluxo; mostra fluxos e preços lado a lado.
"""
import os
import sys
from datetime import timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import base  # noqa: E402
from pipeline.energia.fontes import ccee, ons  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

DS_INT, DS_BAL = "intercambio_nacional_ho", "balanco_energia_subsistema_ho"
REGRAS = {
    "fluxo": "Fluxo diário = média das 24 horas do intercâmbio verificado entre subsistemas, com sinal: positivo da primeira para a segunda ponta (N→NE, N→SE/CO, NE→SE/CO, S→SE/CO).",
    "liquido": "Intercâmbio líquido do subsistema = média diária do intercâmbio verificado no balanço de energia do ONS; positivo significa exportação.",
    "diferenca_preco": "Diferença de preço = PLD médio diário da segunda ponta menos o da primeira.",
    "limites": "Limites de intercâmbio não estão integrados; nenhuma afirmação de congestionamento é feita a partir destes dados.",
}


def _milhar(n):
    return f"{n:,}".replace(",", ".")


def _texto_balanco_sin(b):
    """Frase por regra: compara a soma dos saldos com o intercâmbio do SIN do mesmo balanço."""
    if not b:
        return "Soma dos saldos não comparada ao intercâmbio do SIN nesta publicação."
    div = b["dias_divergentes"]
    excecao = ("em todas as horas" if not div else
               f"em todas as horas, exceto {'no dia' if len(div) == 1 else 'nos dias'} {', '.join(c.data_br(x) for x in div)}")
    return (f"A soma dos quatro saldos é igual ao intercâmbio do SIN publicado no mesmo balanço {excecao} (tolerância de 1 MWmed). "
            f"Esse intercâmbio do SIN é nulo (até 1 MWmed em módulo) em {_milhar(b['horas_sin_nulo_total'])} de "
            f"{_milhar(b['horas_total'])} horas desde o início da série e diferente de zero nas demais; por isso os saldos às vezes somam zero e às vezes não.")


def construir(con):
    pares = [f"{a}_{b}" for a, b in ons.FRONTEIRAS]
    fluxo = {p: c.agrega_diario(base.serie_vigente(con, DS_INT, f"fluxo.{p}")) for p in pares}
    prog = {p: c.agrega_diario(base.serie_vigente(con, DS_INT, f"fluxo_prog.{p}")) for p in pares}
    liquido = {sm: c.agrega_diario(base.serie_vigente(con, DS_BAL, f"intercambio.{sm}")) for sm in c.ORDEM_SM}
    if not all(fluxo.values()):
        return c.stub("rede.json", "intercâmbios ausentes no silver")
    pld_h = {sm: base.serie_vigente(con, ccee.DATASET, f"pld.{sm}") for sm in c.ORDEM_SM}
    pld_d = {sm: c.agrega_diario(pts) for sm, pts in pld_h.items()}
    snap_int, snap_bal, snap_pld = c.snapshot_de(con, DS_INT), c.snapshot_de(con, DS_BAL), c.snapshot_de(con, ccee.DATASET)

    dias = sorted(set.intersection(*(set(v) for v in fluxo.values())))
    dia_ref = dias[-1]
    fim = c.d(dia_ref)
    ult30 = [(fim - timedelta(days=i)).isoformat() for i in range(30)]

    fronteiras = []
    for (a, b), p in zip(ons.FRONTEIRAS, pares):
        f30 = [fluxo[p][k] for k in ult30 if k in fluxo[p]]
        dif = {k: pld_d[b][k] - pld_d[a][k] for k in dias if k in pld_d[a] and k in pld_d[b]}
        dif30 = [dif[k] for k in ult30 if k in dif]
        fronteiras.append({
            "par": p, "de": a, "para": b,
            "nome": f"{c.NOME_SUBMERCADO[a]} → {c.NOME_SUBMERCADO[b]}",
            "fluxo_dia": c.r(fluxo[p].get(dia_ref), 0),
            "programado_dia": c.r(prog[p].get(dia_ref), 0),
            "fluxo_media_30d": c.r(c.media(f30), 0) if len(f30) == 30 else None,
            "dias_sentido_canonico_30d": sum(1 for x in f30 if x > 0),
            "diferenca_preco_ultimo_dia_comum": None if not dif else {"dia": max(dif), "valor": c.r(dif[max(dif)])},
            "dias_com_diferenca_30d": sum(1 for x in dif30 if abs(x) > 1.0),
            "n_dias_pld_30d": len(dif30),
        })

    dias_liq = sorted(set.intersection(*(set(v) for v in liquido.values()))) if all(liquido.values()) else []
    dia_liq = dias_liq[-1] if dias_liq else None
    ult30_liq = [(c.d(dia_liq) - timedelta(days=i)).isoformat() for i in range(30)] if dia_liq else []
    liq = [{"sm": sm, "nome": c.NOME_SUBMERCADO[sm], "dia": c.r(liquido[sm].get(dia_liq), 0) if dia_liq else None,
            "media_30d": c.r(c.media([liquido[sm][k] for k in ult30_liq if k in liquido[sm]]), 0)}
           for sm in c.ORDEM_SM]

    # soma dos saldos contra o intercâmbio do SIN do mesmo balanço: descrita por regra,
    # a partir do dado, sem afirmação fixa (a soma é zero em parte das horas e não em outras)
    balanco_sin = None
    sin_h = dict(base.serie_vigente(con, DS_BAL, "intercambio.SIN"))
    if dia_liq and sin_h:
        horas_sm = {sm: dict(base.serie_vigente(con, DS_BAL, f"intercambio.{sm}")) for sm in c.ORDEM_SM}
        comuns = [h for h in sin_h if all(h in horas_sm[sm] for sm in c.ORDEM_SM)]
        divergentes = sorted({h[:10] for h in comuns if abs(sum(horas_sm[sm][h] for sm in c.ORDEM_SM) - sin_h[h]) > 1.0})
        sin_d = c.agrega_diario(sorted(sin_h.items()))
        ult365 = [(c.d(dia_liq) - timedelta(days=i)).isoformat() for i in range(365)]
        com_dado = [k for k in ult365 if k in sin_d]
        soma_dia = sum(liquido[sm][dia_liq] for sm in c.ORDEM_SM if dia_liq in liquido[sm])
        balanco_sin = {
            "dia": dia_liq,
            "soma_saldos": c.r(soma_dia, 0),
            "intercambio_sin": c.r(sin_d.get(dia_liq), 0),
            "dias_365": len(com_dado),
            "dias_sin_nao_nulo_365": sum(1 for k in com_dado if abs(sin_d[k]) > 1.0),
            "horas_sin_nulo_total": sum(1 for h in comuns if abs(sin_h[h]) <= 1.0),
            "horas_total": len(comuns),
            "dias_divergentes": divergentes,
        }

    ini = (fim - timedelta(days=365)).isoformat()
    serie = [{"d": k, **{p: c.r(fluxo[p].get(k), 0) for p in pares}} for k in dias if k >= ini]
    dias_pld = sorted(set.intersection(*(set(v) for v in pld_d.values())))
    spread = []
    for k in dias_pld:
        if k < ini:
            continue
        vals = [pld_d[sm][k] for sm in c.ORDEM_SM]
        spread.append({"d": k, "amplitude": c.r(max(vals) - min(vals))})
    base.escreve_csv("intercambio_diario.csv", ["data"] + [f"fluxo_{p}" for p in pares] + [f"programado_{p}" for p in pares],
                     [[k] + [fluxo[p].get(k) for p in pares] + [prog[p].get(k) for p in pares] for k in dias])
    meta = c.meta_ons(DS_INT)
    lim = [
        "Limites de intercâmbio e restrições elétricas não estão integrados: fluxos altos não significam, por si, rede no limite.",
        "O fluxo por fronteira soma as linhas de transmissão entre os subsistemas; não identifica qual linha ou equipamento restringiu a transferência.",
        "Dados em processo de consistência recorrente do ONS, sujeitos a revisão.",
    ]
    prov = c.proveniencia(
        indicador="Intercâmbio verificado entre subsistemas", natureza="CALCULADO",
        fonte=c.fonte_ons("intercambio-nacional", DS_INT, "Intercâmbios Entre Subsistemas"),
        unidade="MWmed", frequencia="horária, agregada por dia", periodo={"inicio": dias[0], "fim": dia_ref},
        cobertura={"inicio": dias[0], "fim": dia_ref}, capturado_em=c.ultima_captura(snap_int), snapshot=snap_int,
        transformacoes=["orientação canônica por fronteira com sinal", "média das 24 horas do dia"],
        formula="fluxo_dia(par) = (1/24) × Σ sinal × intercâmbio_verificado(h)",
        limitacoes=lim, download="/energia/series/intercambio_diario.csv", notas_fonte=meta.get("notas"),
    )
    prov_spread = c.proveniencia(
        indicador="Diferença diária de PLD entre as pontas de cada fronteira", natureza="CALCULADO",
        fonte=c.FONTE_CCEE_PLD, unidade="R$/MWh (nominal)", frequencia="diária",
        periodo={"inicio": dias_pld[0], "fim": dias_pld[-1]}, cobertura={"inicio": dias_pld[0], "fim": dias_pld[-1]},
        capturado_em=c.ultima_captura(snap_pld), snapshot=snap_pld,
        transformacoes=["PLD médio diário de cada submercado", "diferença entre as pontas"],
        formula="diferença(par) = PLD_dia(para) − PLD_dia(de)",
        limitacoes=["A série de PLD termina na última captura da CCEE; dias posteriores ficam sem diferença calculada."] + lim[:1],
    )
    prov_saldos = None
    if dia_liq:
        meta_bal = c.meta_ons(DS_BAL)
        prov_saldos = c.proveniencia(
            indicador="Saldo de intercâmbio por subsistema (balanço de energia)", natureza="CALCULADO",
            fonte=c.fonte_ons("balanco-energia-subsistema", DS_BAL, "Balanço de Energia nos Subsistemas"),
            unidade="MWmed", frequencia="horária, agregada por dia", periodo={"inicio": dias_liq[0], "fim": dia_liq},
            cobertura={"inicio": dias_liq[0], "fim": dia_liq}, capturado_em=c.ultima_captura(snap_bal), snapshot=snap_bal,
            transformacoes=["média das 24 horas do dia do valor de intercâmbio do balanço de cada subsistema",
                            "média de 30 dias das médias diárias"],
            formula="saldo_dia(s) = (1/24) × Σ intercâmbio_balanço(s, h); positivo = subsistema exportador, negativo = importador, conforme o sinal do ONS",
            limitacoes=[
                _texto_balanco_sin(balanco_sin),
                "O Balanço de Energia e os Intercâmbios Entre Subsistemas são conjuntos distintos, com datas de referência que podem diferir.",
                "Dados em processo de consistência recorrente do ONS, sujeitos a revisão.",
            ],
            notas_fonte=meta_bal.get("notas"),
        )
    return {
        **c.cabecalho("rede.json"),
        "dia_referencia": dia_ref, "dia_referencia_liquido": dia_liq, "ultimo_dia_pld": dias_pld[-1] if dias_pld else None,
        "regras": REGRAS, "fronteiras": fronteiras, "liquido_subsistemas": liq, "balanco_sin": balanco_sin,
        "serie_fluxos": serie, "serie_amplitude_pld": spread,
        "limites_integrados": False,
        "proveniencia": {"fluxo": prov, "diferenca": prov_spread, **({"saldos": prov_saldos} if prov_saldos else {})}, "fonte_notas": meta.get("notas"),
        "downloads": [{"rotulo": "Intercâmbio diário por fronteira (CSV)", "url": "/energia/series/intercambio_diario.csv"}],
    }
