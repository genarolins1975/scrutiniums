"""Síntese determinística da Visão geral: "o sistema em 60 segundos" e "o que observar".

Nenhum texto livre: cada frase é montada por regra a partir de valores da gold, e
cada trecho numérico carrega a evidência (arquivo, caminho, página). Frase cuja
condição de dado não é satisfeita simplesmente não é emitida.
"""
import os
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia.gold import comum as c  # noqa: E402

FAIXA_PLD = {"baixa": "na faixa baixa", "central": "na faixa central", "alta": "na faixa alta"}


def nbr(v, casas=1):
    if v is None:
        return "–"
    s = f"{abs(v):,.{casas}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return ("-" if v < 0 else "") + s


def _t(texto, **kw):
    return {"texto": texto, **kw}


def frases(hid, carga, ger, pld):
    out = []
    if hid and hid.get("disponivel"):
        sin = next(s for s in hid["subsistemas"] if s["sm"] == "SIN")
        e = sin["ear"]
        if e["valor"] is not None and e["desvio_mediana_pp"] is not None:
            lado = "acima" if e["desvio_mediana_pp"] >= 0 else "abaixo"
            out.append({
                "id": "reservatorios", "ref": e["dia"], "natureza": "CALCULADO",
                "regra": hid["regras"]["ear_sin"] + " " + hid["regras"]["padrao_historico"],
                "trechos": [
                    _t("Os reservatórios do SIN guardam "),
                    _t(f"{nbr(e['valor'])}% da energia armazenável máxima", evidencia="hidrologia.json#SIN.ear.valor",
                       href="/setor-eletrico/agua-e-clima#ear"),
                    _t(", "),
                    _t(f"{nbr(abs(e['desvio_mediana_pp']))} p.p. {lado} da mediana histórica para {c.data_br(e['dia'])}",
                       evidencia="hidrologia.json#SIN.ear.desvio_mediana_pp", href="/setor-eletrico/agua-e-clima#padrao"),
                    _t("."),
                ],
            })
        n = sin["ena"]
        if n["pct_mlt_30d"] is not None:
            out.append({
                "id": "afluencias", "ref": n["dia"], "natureza": "CALCULADO", "regra": hid["regras"]["ena_30d"],
                "trechos": [
                    _t("Nos 30 dias até " + c.data_br(n["dia"]) + ", a energia natural afluente (vazões naturais aos reservatórios, em energia) equivaleu a "),
                    _t(f"{nbr(n['pct_mlt_30d'], 0)}% da média de longo termo", evidencia="hidrologia.json#SIN.ena.pct_mlt_30d",
                       href="/setor-eletrico/agua-e-clima#ena"),
                    _t(" para a época."),
                ],
            })
    if carga and carga.get("disponivel"):
        sin = next(s for s in carga["subsistemas"] if s["sm"] == "SIN")
        u7 = sin["ult7"]
        if u7 and u7["variacao_pct"] is not None:
            lado = "acima" if u7["variacao_pct"] >= 0 else "abaixo"
            out.append({
                "id": "carga", "ref": u7["fim"], "natureza": "CALCULADO", "regra": carga["regras"]["comparacao_anual"],
                "trechos": [
                    _t("A carga do SIN nos 7 dias até " + c.data_br(u7["fim"]) + " ficou "),
                    _t(f"{nbr(abs(u7['variacao_pct']))}% {lado} dos mesmos dias de {u7['fim_anterior'][:4]}",
                       evidencia="carga.json#SIN.ult7.variacao_pct", href="/setor-eletrico/carga#comparacao"),
                    _t("."),
                ],
            })
    if ger and ger.get("disponivel"):
        t = ger["termica_contexto"]
        if t["participacao_7d"] is not None and t["mediana_365d"] is not None:
            out.append({
                "id": "termica", "ref": ger["dia_referencia"], "natureza": "CALCULADO",
                "regra": ger["regras"]["termica_contexto"],
                "trechos": [
                    _t("As térmicas responderam por "),
                    _t(f"{nbr(t['participacao_7d'])}% da geração verificada nos 7 dias até {c.data_br(ger['dia_referencia'])}",
                       evidencia="geracao.json#termica_contexto.participacao_7d", href="/setor-eletrico/geracao#termica"),
                    _t("; nos 12 meses anteriores, a mediana dessa participação foi "),
                    _t(f"{nbr(t['mediana_365d'])}%", evidencia="geracao.json#termica_contexto.mediana_365d",
                       href="/setor-eletrico/geracao#termica"),
                    _t("."),
                ],
            })
    if pld and pld.get("disponivel"):
        se = next(x for x in pld["cartoes"] if x["sm"] == "SE")
        amp = max(x["media_dia"] for x in pld["cartoes"]) - min(x["media_dia"] for x in pld["cartoes"])
        pos = se["posicao"]
        trechos = [
            _t(f"Em {c.data_br(pld['dia_referencia'])}, o PLD médio do Sudeste/Centro-Oeste foi "),
            _t(f"R$ {nbr(se['media_dia'], 2)}/MWh", evidencia="pld.json#cartoes.SE.media_dia", href="/setor-eletrico/pld#hoje"),
            _t(", "),
            _t(f"{FAIXA_PLD[pos['faixa']]} da distribuição desde 2021 (percentil {nbr(pos['percentil'], 0)})",
               evidencia="pld.json#cartoes.SE.posicao", href="/setor-eletrico/pld#regras"),
        ]
        if amp <= 1.0:
            trechos.append(_t(", praticamente igual nos quatro submercados."))
        else:
            trechos += [_t(", com diferença de "),
                        _t(f"R$ {nbr(amp, 2)}/MWh entre o maior e o menor submercado",
                           evidencia="pld.json#cartoes", href="/setor-eletrico/pld#submercados"), _t(".")]
        out.append({"id": "pld", "ref": pld["dia_referencia"], "natureza": "CALCULADO",
                    "regra": pld["regras"]["posicao_historica"], "trechos": trechos})
    return out


def observar(hid, carga, ger, pld, cmo, hoje=None):
    """Regras explícitas avaliadas sobre a gold. Todas são listadas, ativas ou não."""
    hoje = hoje or date.today()
    regras = []

    def add(rid, titulo, condicao, ativo, evidencia, href, tipo="regra"):
        regras.append({"id": rid, "titulo": titulo, "condicao": condicao, "ativo": bool(ativo),
                       "evidencia": evidencia, "href": href, "tipo": tipo})

    if hid and hid.get("disponivel"):
        fora = [s for s in hid["subsistemas"] if s["sm"] != "SIN" and s["ear"]["faixa"] in ("abaixo", "acima")]
        add("ear_faixa", "Armazenamento fora da faixa usual para a data",
            "EAR de algum subsistema abaixo do 10º ou acima do 90º percentil do mesmo dia nos anos anteriores (desde 2001).",
            fora, "; ".join(f"{s['nome']}: {nbr(s['ear']['valor'])}% ({s['ear']['faixa']} da faixa {nbr(s['ear']['p10'])}% a {nbr(s['ear']['p90'])}%)" for s in fora)
            or "Todos os subsistemas dentro da faixa usual.", "/setor-eletrico/agua-e-clima#padrao")
        fora_e = [s for s in hid["subsistemas"] if s["sm"] != "SIN" and s["ena"]["faixa_30d"] in ("abaixo", "acima")]
        add("ena_faixa", "Afluência de 30 dias fora da faixa usual",
            "ENA acumulada em 30 dias (% da MLT) abaixo do 10º ou acima do 90º percentil da mesma janela nos anos anteriores.",
            fora_e, "; ".join(f"{s['nome']}: {nbr(s['ena']['pct_mlt_30d'], 0)}% da MLT ({s['ena']['faixa_30d']} da faixa)" for s in fora_e)
            or "Todos os subsistemas dentro da faixa usual.", "/setor-eletrico/agua-e-clima#ena")
    if pld and pld.get("disponivel"):
        dif = pld["periodos"]["30d"]["diferenca"]
        add("descolamento", "Diferença de preço entre submercados",
            "Ao menos uma hora com diferença acima de R$ 1/MWh entre submercados nos últimos 30 dias da série de PLD.",
            dif["horas_acima_limiar"] > 0,
            f"{dif['horas_acima_limiar']} de {pld['periodos']['30d']['n_horas']} horas ({nbr(100 * dif['frac_horas_acima_limiar'])}%); maior diferença R$ {nbr(dif['maior'], 2)}/MWh em {c.data_br(dif['quando_maior'])} às {dif['quando_maior'][11:16]}.",
            "/setor-eletrico/rede")
        atraso = (hoje - c.d(pld["dia_referencia"])).days
        add("pld_defasagem", "Série de PLD sem atualização recente",
            "Último dia de PLD integrado mais de 2 dias antes da data de processamento da gold.",
            atraso > 2,
            f"Último dia integrado: {c.data_br(pld['dia_referencia'])}, {atraso} {'dia' if atraso == 1 else 'dias'} antes do processamento de {c.data_br(hoje.isoformat())}. {'A última coleta direta na CCEE foi bem-sucedida.' if (pld.get('coleta_direta') or {}).get('ok') else 'A última tentativa de coleta direta na CCEE falhou ou não foi feita.'}",
            "/setor-eletrico/dados/ccee-pld-horario", tipo="dados")
    if ger and ger.get("disponivel"):
        t = ger["termica_contexto"]
        fora_t = t["percentil"] is not None and (t["percentil"] > 90 or t["percentil"] < 10)
        add("termica", "Participação térmica incomum",
            "Participação térmica dos últimos 7 dias acima do 90º ou abaixo do 10º percentil das janelas de 7 dias dos 365 dias anteriores.",
            fora_t, f"{nbr(t['participacao_7d'])}% nos últimos 7 dias; faixa usual de {nbr(t['p10_365d'])}% a {nbr(t['p90_365d'])}% (percentil {nbr(t['percentil'], 0)}).",
            "/setor-eletrico/geracao#termica")
    if carga and carga.get("disponivel"):
        serie = [x["SIN"] for x in carga["serie"]][-365:]
        v = serie[-1] if serie else None
        p = c.percentil_de(v, serie[:-1]) if v is not None else None
        add("carga_extrema", "Carga diária entre as mais altas do ano",
            "Carga do SIN no dia de referência acima do 95º percentil dos 364 dias anteriores.",
            p is not None and p > 95, f"{nbr(v, 0)} MWmed em {c.data_br(carga['dia_referencia'])} (percentil {nbr(p, 0)}).",
            "/setor-eletrico/carga")
    if cmo and cmo.get("disponivel"):
        se = next(x for x in cmo["ultima_semana"] if x["sm"] == "SE")
        add("cmo_semana", "CMO publicado pelo ONS para a semana operativa mais recente",
            "Evento conhecido: publicação semanal do CMO (modelo DECOMP). Não é previsão da Scrutiniums.",
            True, f"Semana de referência {c.data_br(cmo['semana_referencia'])}: Sudeste/Centro-Oeste R$ {nbr(se['semanal'], 2)}/MWh; "
                  + "; ".join(f"{x['nome']} R$ {nbr(x['semanal'], 2)}" for x in cmo["ultima_semana"] if x["sm"] != "SE") + ".",
            "/setor-eletrico/pld#formacao", tipo="evento")
    return regras


def construir(hid, carga, ger, pld, cmo, hoje=None):
    return {
        **c.cabecalho("sintese.json"),
        "frases": frases(hid, carga, ger, pld),
        "observar": observar(hid, carga, ger, pld, cmo, hoje=hoje),
        "nota": "Frases e alertas montados por regras fixas a partir da gold; nenhum texto é redigido livremente. Cada número leva à evidência.",
    }
