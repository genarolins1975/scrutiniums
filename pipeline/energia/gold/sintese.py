"""Motor da síntese da Visão geral: frases (P004) e regras do "o que observar" (P007).

Funções puras, sem leitura de disco nem de rede: o módulo pipeline/energia/modulos/visao.py
lê as golds já construídas e as séries de origem e chama este motor. Por que separar: a
mesma regra precisa rodar sobre o dia de hoje (a frase publicada) e sobre todo o
histórico (quantas vezes teria disparado), e só uma função pura garante que as duas
leituras usam exatamente a mesma conta.

Frases. Nenhum texto livre: cada frase é a saída de um modelo fixo, MODELOS[id], aplicado
a um dicionário de valores lidos da gold de origem (caminho anotado em cada valor). O par
(modelo, valores) vai publicado junto com a frase, de modo que qualquer pessoa refaz o
texto a partir dos números exibidos e das versões das golds que os produziram. Frase cuja
condição de dado não é satisfeita não é emitida (ausência declarada pelo módulo).

Regras. Cada regra tem condição diária, limiar, duração mínima para virar alerta e regra
de retorno à normalidade. `episodios()` aplica a mesma máquina de estados a qualquer
série de condições, e `resumo_historico()` conta, no histórico, quantas vezes a regra
teria disparado, por quanto tempo e quantos acionamentos curtos a duração mínima
filtrou. Alerta descreve uma condição medida; não explica a causa.
"""
import math
import os
import statistics
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia.gold import comum as c  # noqa: E402

FAIXA_PLD = {"baixa": "na faixa baixa", "central": "na faixa central", "alta": "na faixa alta"}
SMS = ("SE", "S", "NE", "N")


def nbr(v, casas=1):
    if v is None:
        return "sem dado"
    s = f"{abs(v):,.{casas}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return ("−" if v < 0 else "") + s  # sinal de menos tipográfico, como na interface


def _t(texto, **kw):
    return {"texto": texto, **kw}


def texto_de(trechos):
    return "".join(t["texto"] for t in trechos)


def d(iso):
    return date.fromisoformat(iso[:10])


# ---------------------------------------------------------------- defasagem e datas

def defasagem_dias(ref, hoje):
    """Dias entre a data de referência do dado e a data de processamento em Brasília.
    Negativo quando a fonte publica o dado do dia seguinte na véspera (PLD da CCEE)."""
    if not ref:
        return None
    return (hoje - d(ref)).days


def texto_defasagem(ref, hoje):
    """Frase sobre a distância entre o dado e o processamento, sem o defeito do "0 dias
    antes": a data de processamento é a civil de Brasília (comum.hoje_brasilia), e o PLD
    publicado na véspera aparece como posterior ao processamento."""
    n = defasagem_dias(ref, hoje)
    if n is None:
        return "Data de referência ausente."
    proc = c.data_br(hoje.isoformat())
    if n < 0:
        k = -n
        return (f"Referência {c.data_br(ref)}, {k} {'dia' if k == 1 else 'dias'} depois da data de processamento "
                f"({proc}): a fonte publica o dado antes do dia a que ele se refere.")
    if n == 0:
        return f"Referência {c.data_br(ref)}, a própria data de processamento ({proc})."
    return f"Referência {c.data_br(ref)}, {n} {'dia' if n == 1 else 'dias'} antes da data de processamento ({proc})."


# ---------------------------------------------------------------- frases (P004)

def _sm(xs, sm, chave="sm"):
    return next((x for x in xs if x.get(chave) == sm), None)


def valores_frase(fid, golds):
    """Valores que a frase `fid` usa, cada um com o caminho na gold de origem; None quando
    a condição de dado não está satisfeita (a frase não é emitida)."""
    hid, carga, ger, pld, rede = (golds.get(k) for k in ("hidrologia.json", "carga.json", "geracao.json", "pld.json", "rede.json"))
    ok = lambda g: isinstance(g, dict) and g.get("disponivel") is True  # noqa: E731
    if fid == "reservatorios" and ok(hid):
        e = (_sm(hid["subsistemas"], "SIN") or {}).get("ear") or {}
        if e.get("valor") is None or e.get("desvio_mediana_pp") is None:
            return None
        return {"dia": {"valor": e["dia"], "caminho": "hidrologia.json#subsistemas[SIN].ear.dia"},
                "ear_pct": {"valor": e["valor"], "caminho": "hidrologia.json#subsistemas[SIN].ear.valor", "unidade": "% da EAR máxima"},
                "desvio_pp": {"valor": e["desvio_mediana_pp"], "caminho": "hidrologia.json#subsistemas[SIN].ear.desvio_mediana_pp", "unidade": "p.p."}}
    if fid == "afluencias" and ok(hid):
        n = (_sm(hid["subsistemas"], "SIN") or {}).get("ena") or {}
        if n.get("pct_mlt_30d") is None:
            return None
        return {"dia": {"valor": n["dia"], "caminho": "hidrologia.json#subsistemas[SIN].ena.dia"},
                "ena30_pct_mlt": {"valor": n["pct_mlt_30d"], "caminho": "hidrologia.json#subsistemas[SIN].ena.pct_mlt_30d", "unidade": "% da MLT"}}
    if fid == "carga" and ok(carga):
        u7 = (_sm(carga["subsistemas"], "SIN") or {}).get("ult7")
        if not u7 or u7.get("variacao_pct") is None:
            return None
        return {"fim": {"valor": u7["fim"], "caminho": "carga.json#subsistemas[SIN].ult7.fim"},
                "inicio": {"valor": u7["inicio"], "caminho": "carga.json#subsistemas[SIN].ult7.inicio"},
                "fim_anterior": {"valor": u7["fim_anterior"], "caminho": "carga.json#subsistemas[SIN].ult7.fim_anterior"},
                "variacao_pct": {"valor": u7["variacao_pct"], "caminho": "carga.json#subsistemas[SIN].ult7.variacao_pct", "unidade": "%"}}
    if fid == "termica" and ok(ger):
        t = ger.get("termica_contexto") or {}
        if t.get("participacao_7d") is None or t.get("mediana_365d") is None:
            return None
        return {"dia": {"valor": ger["dia_referencia"], "caminho": "geracao.json#dia_referencia"},
                "participacao_7d": {"valor": t["participacao_7d"], "caminho": "geracao.json#termica_contexto.participacao_7d", "unidade": "%"},
                "mediana_365d": {"valor": t["mediana_365d"], "caminho": "geracao.json#termica_contexto.mediana_365d", "unidade": "%"}}
    if fid == "pld" and ok(pld):
        se = _sm(pld["cartoes"], "SE")
        if not se or se.get("media_dia") is None or not (se.get("posicao") or {}).get("faixa"):
            return None
        # amplitude calculada no pipeline do PLD a partir das médias não arredondadas
        amp = pld.get("amplitude_dia")
        cam_amp = "pld.json#amplitude_dia"
        if amp is None:
            amp = max(x["media_dia"] for x in pld["cartoes"]) - min(x["media_dia"] for x in pld["cartoes"])
            cam_amp = "pld.json#cartoes[*].media_dia (maior menos menor)"
        return {"dia": {"valor": pld["dia_referencia"], "caminho": "pld.json#dia_referencia"},
                "media_se": {"valor": se["media_dia"], "caminho": "pld.json#cartoes[SE].media_dia", "unidade": "R$/MWh"},
                "faixa": {"valor": se["posicao"]["faixa"], "caminho": "pld.json#cartoes[SE].posicao.faixa"},
                "percentil": {"valor": se["posicao"]["percentil"], "caminho": "pld.json#cartoes[SE].posicao.percentil"},
                "amplitude": {"valor": c.r(amp, 2), "caminho": cam_amp, "unidade": "R$/MWh"}}
    if fid == "rede" and ok(rede):
        fr = [f for f in rede.get("fronteiras") or [] if f.get("fluxo_media_30d") is not None]
        if not fr:
            return None
        f = max(fr, key=lambda x: abs(x["fluxo_media_30d"]))
        de, para = (f["de"], f["para"]) if f["fluxo_media_30d"] >= 0 else (f["para"], f["de"])
        fim = rede["dia_referencia"]
        return {"fim": {"valor": fim, "caminho": "rede.json#dia_referencia"},
                "inicio": {"valor": (d(fim) - timedelta(days=29)).isoformat(), "caminho": "rede.json#regras.fluxo (30 dias até o dia de referência)"},
                "par": {"valor": f["par"], "caminho": f"rede.json#fronteiras[{f['par']}].par"},
                "de": {"valor": de, "caminho": f"rede.json#fronteiras[{f['par']}] (sentido pelo sinal da média)"},
                "para": {"valor": para, "caminho": f"rede.json#fronteiras[{f['par']}] (sentido pelo sinal da média)"},
                "fluxo_mwmed": {"valor": abs(f["fluxo_media_30d"]), "caminho": f"rede.json#fronteiras[{f['par']}].fluxo_media_30d (módulo)", "unidade": "MWmed"}}
    return None


def _v(vals, k):
    return vals[k]["valor"]


def _m_reservatorios(v):
    dp = _v(v, "desvio_pp")
    lado = "acima" if dp >= 0 else "abaixo"
    return [
        _t("Os reservatórios do SIN guardam "),
        _t(f"{nbr(_v(v, 'ear_pct'))}% da energia armazenável máxima", evidencia="hidrologia.json#SIN.ear.valor",
           href="/setor-eletrico/agua-e-clima#ear"),
        _t(", "),
        _t(f"{nbr(abs(dp))} p.p. {lado} da mediana histórica para {c.data_br(_v(v, 'dia'))}",
           evidencia="hidrologia.json#SIN.ear.desvio_mediana_pp", href="/setor-eletrico/agua-e-clima#padrao"),
        _t("."),
    ]


def _m_afluencias(v):
    return [
        _t("Nos 30 dias até " + c.data_br(_v(v, "dia")) + ", a energia natural afluente (vazões naturais aos reservatórios, em energia) equivaleu a "),
        _t(f"{nbr(_v(v, 'ena30_pct_mlt'), 1)}% da média de longo termo", evidencia="hidrologia.json#SIN.ena.pct_mlt_30d",
           href="/setor-eletrico/agua-e-clima#ena"),
        _t("."),
    ]


def _m_carga(v):
    var = _v(v, "variacao_pct")
    lado = "acima" if var >= 0 else "abaixo"
    return [
        _t("A carga do SIN nos 7 dias até " + c.data_br(_v(v, "fim")) + " ficou "),
        _t(f"{nbr(abs(var))}% {lado} dos mesmos dias de {_v(v, 'fim_anterior')[:4]}",
           evidencia="carga.json#SIN.ult7.variacao_pct", href="/setor-eletrico/carga#comparacao"),
        _t("."),
    ]


def _m_termica(v):
    return [
        _t("As térmicas responderam por "),
        _t(f"{nbr(_v(v, 'participacao_7d'))}% da geração verificada nos 7 dias até {c.data_br(_v(v, 'dia'))}",
           evidencia="geracao.json#termica_contexto.participacao_7d", href="/setor-eletrico/geracao#termica"),
        _t("; nos 12 meses anteriores, a mediana dessa participação foi "),
        _t(f"{nbr(_v(v, 'mediana_365d'))}%", evidencia="geracao.json#termica_contexto.mediana_365d",
           href="/setor-eletrico/geracao#termica"),
        _t("."),
    ]


def _m_pld(v):
    amp = _v(v, "amplitude")
    trechos = [
        _t(f"Em {c.data_br(_v(v, 'dia'))}, o PLD médio do Sudeste/Centro-Oeste foi "),
        _t(f"R$ {nbr(_v(v, 'media_se'), 2)}/MWh", evidencia="pld.json#cartoes.SE.media_dia", href="/setor-eletrico/pld#hoje"),
        _t(", "),
        _t(f"{FAIXA_PLD[_v(v, 'faixa')]} da distribuição desde 2021 (percentil {nbr(_v(v, 'percentil'), 1)})",
           evidencia="pld.json#cartoes.SE.posicao", href="/setor-eletrico/pld#regras"),
    ]
    if amp <= 1.0:
        trechos.append(_t(", praticamente igual nos quatro submercados."))
    else:
        trechos += [_t(", com diferença de "),
                    _t(f"R$ {nbr(amp, 2)}/MWh entre o maior e o menor submercado",
                       evidencia="pld.json#amplitude_dia", href="/setor-eletrico/pld#submercados"), _t(".")]
    return trechos


def _m_rede(v):
    return [
        _t("Nos 30 dias até " + c.data_br(_v(v, "fim")) + ", o maior fluxo médio entre subsistemas foi "),
        _t(f"{c.NOME_SUBMERCADO[_v(v, 'de')]} → {c.NOME_SUBMERCADO[_v(v, 'para')]}, com {nbr(_v(v, 'fluxo_mwmed'), 0)} MWmed",
           evidencia=f"rede.json#fronteiras.{_v(v, 'par')}.fluxo_media_30d", href="/setor-eletrico/rede"),
        _t("."),
    ]


MODELOS = {"reservatorios": _m_reservatorios, "afluencias": _m_afluencias, "carga": _m_carga,
           "termica": _m_termica, "pld": _m_pld, "rede": _m_rede}

# frase → (gold, chave da proveniência, dataset do silver, regra publicada na gold de origem,
# janela da frase em dias até a referência, href)
ORIGEM_FRASE = {
    "reservatorios": ("hidrologia.json", "ear_sin", "ear_subsistema_di", ("ear_sin", "padrao_historico"), 1, "/setor-eletrico/agua-e-clima"),
    "afluencias": ("hidrologia.json", "ena30", "ena_subsistema_di", ("ena_30d",), 30, "/setor-eletrico/agua-e-clima"),
    "carga": ("carga.json", "sin", "carga_energia_di", ("comparacao_anual",), 7, "/setor-eletrico/carga"),
    "termica": ("geracao.json", "termica_7d", "balanco_energia_subsistema_ho", ("termica_contexto",), 7, "/setor-eletrico/geracao"),
    "pld": ("pld.json", "diario", "ccee_pld_horario", ("media_diaria", "posicao_historica"), 1, "/setor-eletrico/pld"),
    "rede": ("rede.json", "fluxo", "intercambio_nacional_ho", ("fluxo",), 30, "/setor-eletrico/rede"),
}
ORDEM_FRASES = ("reservatorios", "afluencias", "carga", "termica", "pld", "rede")


def ref_da_frase(fid, vals):
    return vals["dia"]["valor"] if "dia" in vals else vals["fim"]["valor"]


def janela_da_frase(fid, vals):
    """(início, fim) das referências que a frase usa; a carga usa também os mesmos dias do
    ano anterior, que entram como segunda janela."""
    ref = ref_da_frase(fid, vals)
    n = ORIGEM_FRASE[fid][4]
    janelas = [((d(ref) - timedelta(days=n - 1)).isoformat(), ref)]
    if fid == "carga":
        fa = vals["fim_anterior"]["valor"]
        janelas.append(((d(fa) - timedelta(days=6)).isoformat(), fa))
    return janelas


def qualidade_frase(fid, vals, gold, prov, conjunto, revisoes_ds, hoje):
    """Natureza, defasagem e revisão da frase (P004: qualidade do dado por frase).

    `conjunto` é a linha do conjunto em publicacao.json (atualidade pela frequência
    declarada); `revisoes_ds` é {ref: [variações relativas]} das referências revisadas
    entre capturas no silver, lido pelo módulo."""
    ref = ref_da_frase(fid, vals)
    janelas = janela_da_frase(fid, vals)
    revisadas = sorted({k for k in (revisoes_ds or {}) for a, b in janelas if a <= k[:10] <= b})
    rk = (prov or {}).get("revisoes_conhecidas") or {}
    at = (conjunto or {}).get("atualidade") or {}
    n_rev = len(revisadas)
    if revisoes_ds is None:
        txt_rev = "Revisões entre capturas não verificadas nesta execução (silver de origem indisponível)."
    elif n_rev == 0:
        txt_rev = (f"Nenhuma referência usada nesta frase foi revisada entre as capturas integradas; o conjunto tem "
                   f"{rk.get('total', 0)} observações revisadas no total.")
    else:
        maior = max(abs(x) for k in revisadas for x in revisoes_ds[k] if x is not None) if any(
            x is not None for k in revisadas for x in revisoes_ds[k]) else None
        txt_rev = (f"{n_rev} {'referência usada nesta frase foi revisada' if n_rev == 1 else 'referências usadas nesta frase foram revisadas'} "
                   f"pela fonte entre capturas" + (f" (maior variação de {nbr(maior, 2)}%)" if maior is not None else "") +
                   "; o valor exibido é o da captura mais recente.")
    return {
        "natureza": (prov or {}).get("natureza"),
        "frequencia": (prov or {}).get("frequencia"),
        "referencia": ref,
        "janelas": [{"inicio": a, "fim": b} for a, b in janelas],
        "defasagem_dias": defasagem_dias(ref, hoje),
        "texto_defasagem": texto_defasagem(ref, hoje),
        "atualidade": {"situacao": at.get("situacao"), "cadencia": at.get("cadencia"), "tolerancia_dias": at.get("tolerancia_dias"),
                       "dias_atraso": at.get("dias_atraso"), "fonte": "publicacao.json#conjuntos (frequência declarada pela fonte)"}
        if conjunto else None,
        "publicado_pela_fonte_em": (prov or {}).get("publicado_pela_fonte_em"),
        "capturado_em": (prov or {}).get("capturado_em"),
        "revisoes": {"referencias_revisadas_na_janela": n_rev, "revisadas": revisadas[:20],
                     "total_no_conjunto": rk.get("total"), "texto": txt_rev},
    }


def frase(fid, golds, contexto, hoje):
    """Frase completa: texto (trechos), valores com caminho, regra, qualidade e versões."""
    vals = valores_frase(fid, golds)
    if vals is None:
        return None
    nome_gold, chave_prov, ds, chaves_regra, _, href = ORIGEM_FRASE[fid]
    g = golds[nome_gold]
    prov = (g.get("proveniencia") or {}).get(chave_prov)
    regras = g.get("regras") or {}
    regra = " ".join(regras[k] for k in chaves_regra if regras.get(k)) or None
    trechos = MODELOS[fid](vals)
    conj = (contexto.get("conjuntos") or {}).get(ds)
    rev = (contexto.get("revisoes_refs") or {}).get(ds)
    snap = (prov or {}).get("snapshot") or {}
    return {
        "id": fid, "tipo": "fato", "modelo": fid, "ref": ref_da_frase(fid, vals),
        "natureza": (prov or {}).get("natureza") or "CALCULADO",
        "regra": regra, "trechos": trechos, "texto": texto_de(trechos), "valores": vals, "href": href,
        "qualidade": qualidade_frase(fid, vals, g, prov, conj, rev, hoje),
        "versoes": {"gold": nome_gold, "gerado_em": g.get("gerado_em"), "versao_codigo": g.get("versao_codigo"),
                    "versao_pipeline": g.get("versao_pipeline"), "dataset": ds,
                    "snapshot_id": snap.get("id"), "snapshot_sha256": snap.get("sha256")},
    }


def frases(golds, contexto, hoje):
    return [f for f in (frase(fid, golds, contexto, hoje) for fid in ORDEM_FRASES) if f]


# ---------------------------------------------------------------- máquina de estados (P007)

def episodios(serie, dur_min, dur_ret):
    """Aplica a regra de duração e de retorno a uma série diária de condições.

    `serie`: lista ordenada de (dia ISO, condição) com condição True, False ou None (dia
    sem dado ou não avaliável). Entrada: `dur_min` dias consecutivos com a condição; o
    episódio começa no primeiro desses dias. Saída: `dur_ret` dias consecutivos sem a
    condição; o episódio termina no último dia com a condição. Dia sem dado interrompe a
    contagem de entrada e não conta para o retorno (nem confirma, nem normaliza).

    Devolve episódios, sequências brutas da condição (sem filtro de duração), as curtas
    (que a duração mínima descartou) e o estado no último dia."""
    eps, seqs = [], []
    run_ini, run_len, ultimo_dia = None, 0, None
    atual, falsos = None, 0
    for dia, cond in serie:
        if cond is True:
            if run_ini is None:
                run_ini, run_len = dia, 0
            run_len += 1
        elif run_ini is not None:
            seqs.append({"inicio": run_ini, "fim": ultimo_dia, "dias": run_len})
            run_ini, run_len = None, 0
        if atual is None:
            if cond is True and run_len >= dur_min:
                atual = {"inicio": run_ini, "confirmado_em": dia, "ultimo_com_condicao": dia, "dias_condicao": run_len}
                falsos = 0
        else:
            if cond is True:
                atual["ultimo_com_condicao"] = dia
                atual["dias_condicao"] += 1
                falsos = 0
            elif cond is False:
                falsos += 1
                if falsos >= dur_ret:
                    atual["fim"] = atual.pop("ultimo_com_condicao")
                    atual["normalizado_em"] = dia
                    atual["em_curso"] = False
                    eps.append(atual)
                    atual, falsos = None, 0
        ultimo_dia = dia
    seq_aberta = None
    if run_ini is not None:
        seq_aberta = {"inicio": run_ini, "fim": ultimo_dia, "dias": run_len}
        seqs.append(seq_aberta)
    ultima = serie[-1][1] if serie else None
    if atual is not None:
        atual["fim"] = atual.pop("ultimo_com_condicao")
        atual["normalizado_em"] = None
        atual["em_curso"] = True
        eps.append(atual)
        estado = "em_retorno" if ultima is False else "ativo"
    elif ultima is None:
        estado = "sem_dado"
    elif ultima is True:
        estado = "em_observacao"
    else:
        estado = "normal"
    return {"episodios": eps, "sequencias": seqs, "estado": estado,
            "dias_sem_condicao_no_retorno": falsos if atual is not None else 0,
            "sequencia_atual": seq_aberta if ultima is True else None}


def _duracao(e, ultimo_dia):
    fim = e["fim"] if e["fim"] else ultimo_dia
    return (d(fim) - d(e["inicio"])).days + 1


def _dias_exibido(e, ultimo_dia):
    """Dias em que o alerta ficaria exibido: da confirmação (duração mínima atingida) até o
    dia em que o retorno à normalidade foi confirmado (exclusive) ou até o último dia."""
    fim = d(e["normalizado_em"]) - timedelta(days=1) if e.get("normalizado_em") else d(ultimo_dia)
    return max(0, (fim - d(e["confirmado_em"])).days + 1)


def resumo_historico(serie, dur_min, dur_ret, sensibilidade=(1, 3, 7, 14)):
    """Frequência de disparo no histórico: o que a regra teria mostrado se rodasse todos
    os dias com os dados de hoje (dados já revisados: não reproduz o que se via na época)."""
    avaliados = [x for x in serie if x[1] is not None]
    if not avaliados:
        return None
    ultimo = serie[-1][0]
    r = episodios(serie, dur_min, dur_ret)
    eps, seqs = r["episodios"], r["sequencias"]
    dur = [_duracao(e, ultimo) for e in eps]
    exib = [_dias_exibido(e, ultimo) for e in eps]
    n_av = len(avaliados)
    anos = n_av / 365.25
    curtas = [s for s in seqs if s["dias"] < dur_min]
    sens = []
    for k in sensibilidade:
        rk = episodios(serie, k, dur_ret)
        ex = sum(_dias_exibido(e, ultimo) for e in rk["episodios"])
        sens.append({"duracao_minima_dias": k, "episodios": len(rk["episodios"]),
                     "dias_exibidos": ex, "pct_dias_exibidos": c.r(100.0 * ex / n_av, 1),
                     "por_ano": c.r(len(rk["episodios"]) / anos, 1) if anos > 0 else None})
    return {
        "inicio": serie[0][0], "fim": ultimo,
        "dias_avaliados": n_av, "dias_sem_avaliacao": len(serie) - n_av,
        "dias_com_condicao": sum(1 for x in avaliados if x[1]),
        "pct_dias_com_condicao": c.r(100.0 * sum(1 for x in avaliados if x[1]) / n_av, 1),
        "acionamentos_brutos": len(seqs),
        "acionamentos_curtos_descartados": len(curtas),
        "pct_acionamentos_descartados": c.r(100.0 * len(curtas) / len(seqs), 1) if seqs else None,
        "episodios": len(eps),
        "episodios_por_ano": c.r(len(eps) / anos, 1) if anos > 0 else None,
        "duracao_mediana_dias": c.r(statistics.median(dur), 1) if dur else None,
        "duracao_maxima_dias": max(dur) if dur else None,
        "dias_exibidos": sum(exib),
        "pct_dias_exibidos": c.r(100.0 * sum(exib) / n_av, 1),
        "sensibilidade_duracao": sens,
        "ultimos_episodios": [{**e, "duracao_dias": _duracao(e, ultimo)} for e in eps[-5:]],
    }


def estado_compacto(serie, r, n=365):
    """Cadeia de um caractere por dia nos últimos `n` dias: A alerta exibido, o condição
    sem duração mínima, . normal, - sem dado. Leve para a interface (linha de estado)."""
    exibido = set()
    ultimo = serie[-1][0] if serie else None
    for e in r["episodios"]:
        fim = d(e["normalizado_em"]) - timedelta(days=1) if e.get("normalizado_em") else d(ultimo)
        x = d(e["confirmado_em"])
        while x <= fim:
            exibido.add(x.isoformat())
            x += timedelta(days=1)
    out = []
    for dia, cond in serie[-n:]:
        out.append("A" if dia in exibido else ("-" if cond is None else ("o" if cond else ".")))
    return {"inicio": serie[-n:][0][0] if serie else None, "estados": "".join(out),
            "legenda": {"A": "alerta exibido", "o": "condição sem a duração mínima", ".": "normal", "-": "sem dado"}}


# ---------------------------------------------------------------- avaliadores das condições

def calendario(inicio, fim):
    x, out = d(inicio), []
    while x <= d(fim):
        out.append(x.isoformat())
        x += timedelta(days=1)
    return out


def faixa(v, p10, p90):
    """Mesma regra de hidrologia.json: abaixo do 10º, acima do 90º percentil, ou dentro."""
    if v is None or p10 is None or p90 is None:
        return None
    if v < p10:
        return "abaixo"
    if v > p90:
        return "acima"
    return "dentro"


def _md(dia):
    md = dia[5:10]
    return "02-28" if md == "02-29" else md


def bandas_por_ano(serie, anos, ano_ini=2001):
    """{ano: {md: (p10, p50, p90, n)}} com os anos completos de ano_ini até o anterior a
    cada ano (29/02 fora da distribuição), como em gold/hidrologia.py."""
    out = {}
    for a in anos:
        por_md = {}
        for k, v in serie.items():
            if ano_ini <= int(k[:4]) < a and k[5:10] != "02-29":
                por_md.setdefault(k[5:10], []).append(v)
        out[a] = {md: (c.quantil(vs, 0.1), c.quantil(vs, 0.5), c.quantil(vs, 0.9), len(vs)) for md, vs in por_md.items()}
    return out


def condicoes_ear(ear_pct, inicio, fim):
    """Condição diária da regra ear_faixa: algum subsistema fora da faixa usual da data.
    `ear_pct` = {sm: {dia: % da EAR máxima}} (silver, valor publicado pelo ONS)."""
    anos = range(int(inicio[:4]), int(fim[:4]) + 1)
    bandas = {sm: bandas_por_ano(ear_pct[sm], anos) for sm in SMS}
    out = []
    for dia in calendario(inicio, fim):
        fora, valores, falta = [], {}, False
        for sm in SMS:
            v = ear_pct[sm].get(dia)
            p10, _, p90, _ = bandas[sm][int(dia[:4])].get(_md(dia), (None, None, None, 0))
            fx = faixa(v, p10, p90)
            if fx is None:
                falta = True
                continue
            valores[sm] = {"valor": v, "p10": p10, "p90": p90, "faixa": fx}
            if fx != "dentro":
                fora.append(sm)
        cond = None if falta else bool(fora)
        out.append((dia, cond, {"fora": fora, "valores": valores}))
    return out


def ena30_serie(ena_mw, ena_pct):
    """{dia: ENA de 30 dias em % da MLT} de um subsistema por somas acumuladas: razão das
    somas de ENA bruta e de MLT implícita (ENA ÷ percentual), só janelas com 30 dias."""
    dias = sorted(k for k in ena_mw if ena_pct.get(k))
    if not dias:
        return {}
    mlt = {k: ena_mw[k] / (ena_pct[k] / 100.0) for k in dias}
    out = {}
    todos = calendario(dias[0], dias[-1])
    acum_e, acum_m, presentes = [0.0], [0.0], [0]
    for k in todos:
        ok = k in mlt
        acum_e.append(acum_e[-1] + (ena_mw[k] if ok else 0.0))
        acum_m.append(acum_m[-1] + (mlt[k] if ok else 0.0))
        presentes.append(presentes[-1] + (1 if ok else 0))
    for i in range(30, len(todos) + 1):
        if presentes[i] - presentes[i - 30] == 30:
            den = acum_m[i] - acum_m[i - 30]
            if den > 0:
                out[todos[i - 1]] = 100.0 * (acum_e[i] - acum_e[i - 30]) / den
    return out


def condicoes_ena(e30, inicio, fim, ano_ini=2001):
    """Condição diária da regra ena_faixa: ENA de 30 dias de algum subsistema fora do 10º
    a 90º percentil da mesma janela nos anos anteriores (desde 2001), como em hidrologia."""
    out = []
    for dia in calendario(inicio, fim):
        fora, valores, falta = [], {}, False
        x = d(dia)
        for sm in SMS:
            v = e30[sm].get(dia)
            hist = []
            for a in range(ano_ini, x.year):
                try:
                    fa = x.replace(year=a)
                except ValueError:
                    fa = x.replace(year=a, day=28)
                h = e30[sm].get(fa.isoformat())
                if h is not None:
                    hist.append(h)
            p10, p90 = c.quantil(hist, 0.1), c.quantil(hist, 0.9)
            fx = faixa(v, p10, p90)
            if fx is None:
                falta = True
                continue
            valores[sm] = {"valor": v, "p10": p10, "p90": p90, "faixa": fx}
            if fx != "dentro":
                fora.append(sm)
        out.append((dia, None if falta else bool(fora), {"fora": fora, "valores": valores}))
    return out


def _janela(fim, n):
    f = d(fim)
    return [(f - timedelta(days=i)).isoformat() for i in range(n)]


def razao_janela(num, den, fim, n=7):
    """Σ num ÷ Σ den numa janela de n dias terminada em `fim`; None se faltar dia."""
    ks = _janela(fim, n)
    if not all(k in num and k in den for k in ks):
        return None
    s_den = sum(den[k] for k in ks)
    return 100.0 * sum(num[k] for k in ks) / s_den if s_den > 0 else None


def condicoes_janela_movel(num, den, inicio, fim, regime_inicio=None, lados=("acima", "abaixo"), janelas_min=365):
    """Condição de regras de janela móvel de 7 dias contra as janelas terminadas de 7 a
    371 dias antes (as dos 365 dias anteriores sem sobreposição com a atual), como a
    participação térmica de geracao.json. Fora do regime, ou com menos de `janelas_min`
    janelas inteiras no mesmo regime, o dia não é avaliado."""
    cache = {}

    def r7(k):
        if k not in cache:
            ok = regime_inicio is None or min(_janela(k, 7)) >= regime_inicio
            cache[k] = razao_janela(num, den, k, 7) if ok else None
        return cache[k]

    out = []
    for dia in calendario(inicio, fim):
        v = r7(dia)
        x = d(dia)
        hist = [r7((x - timedelta(days=i)).isoformat()) for i in range(7, 372)]
        hist = [h for h in hist if h is not None]
        if v is None or len(hist) < janelas_min:
            out.append((dia, None, {"valor": v, "janelas": len(hist)}))
            continue
        p10, p50, p90 = c.quantil(hist, 0.1), c.quantil(hist, 0.5), c.quantil(hist, 0.9)
        fx = faixa(v, p10, p90)
        cond = fx in lados
        out.append((dia, cond, {"valor": v, "p10": p10, "p50": p50, "p90": p90, "faixa": fx, "janelas": len(hist)}))
    return out


def regime_de(dia, regimes):
    for i, rg in enumerate(regimes):
        if rg["inicio"] <= dia and (rg["fim"] is None or dia <= rg["fim"]):
            return i
    return None


def condicoes_carga(serie, regimes, inicio, fim, q=0.95, min_dias=330):
    """Condição da regra carga_extrema: carga do SIN no dia acima do 95º percentil dos 364
    dias anteriores, só com os 364 dias no mesmo regime metodológico do ONS e ao menos
    `min_dias` deles publicados (carga.json só publica dia aceito pela validação física)."""
    out = []
    for dia in calendario(inicio, fim):
        v = serie.get(dia)
        ks = [(d(dia) - timedelta(days=i)).isoformat() for i in range(1, 365)]
        rg = regime_de(dia, regimes)
        if v is None or rg is None or any(regime_de(k, regimes) != rg for k in (ks[0], ks[-1])):
            out.append((dia, None, {"valor": v}))
            continue
        prev = [serie[k] for k in ks if k in serie]
        if len(prev) < min_dias:
            out.append((dia, None, {"valor": v, "dias_base": len(prev)}))
            continue
        p95 = c.quantil(prev, q)
        out.append((dia, v > p95, {"valor": v, "p95": p95, "dias_base": len(prev)}))
    return out


def condicoes_descolamento(diario, inicio, fim, rel=0.10, absoluto=5.0):
    """Condição da regra descolamento: amplitude entre o maior e o menor PLD médio diário
    dos quatro submercados de pelo menos 10% da média dos quatro e de pelo menos
    R$ 5,00/MWh (as duas condições: a relativa acompanha o nível de preço, a absoluta
    impede que centavos perto do piso contem como separação)."""
    por_dia = {r["d"]: r for r in diario}
    out = []
    for dia in calendario(inicio, fim):
        r = por_dia.get(dia)
        vs = [r.get(s) for s in SMS] if r else []
        if not r or any(v is None for v in vs):
            out.append((dia, None, {}))
            continue
        amp = max(vs) - min(vs)
        media = sum(vs) / 4
        lim = max(absoluto, rel * media)
        out.append((dia, amp >= lim, {"amplitude": amp, "limiar": lim, "media": media,
                                       "maior": max(SMS, key=lambda s: r[s]), "menor": min(SMS, key=lambda s: r[s])}))
    return out


def condicoes_limites(linhas, inicio, fim, tipo):
    """Condições das regras de limite do PLD a partir de pld_limites_diario.csv (módulo PLD):
    `tipo`="piso": algum submercado com as 24 horas no piso; "teto": alguma hora no teto
    horário ou média diária no teto estrutural em algum submercado."""
    por_dia = {}
    for ln in linhas:
        por_dia.setdefault(ln["data"], {})[ln["sm"]] = ln
    out = []
    for dia in calendario(inicio, fim):
        r = por_dia.get(dia)
        if not r or any(s not in r for s in SMS):
            out.append((dia, None, {}))
            continue
        if tipo == "piso":
            quais = [s for s in SMS if r[s]["horas"] and r[s]["horas_no_piso"] == r[s]["horas"]]
            det = {"submercados": quais, "horas_no_piso": {s: r[s]["horas_no_piso"] for s in SMS}, "pld_min": r["SE"]["pld_min"]}
        else:
            quais = [s for s in SMS if (r[s]["horas_no_teto_horario"] or 0) > 0 or r[s]["media_no_teto_estrutural"] == 1]
            det = {"submercados": quais, "horas_no_teto_horario": {s: r[s]["horas_no_teto_horario"] for s in SMS},
                   "media_no_teto_estrutural": {s: r[s]["media_no_teto_estrutural"] for s in SMS},
                   "pld_max_horario": r["SE"]["pld_max_horario"], "pld_max_estrutural": r["SE"]["pld_max_estrutural"]}
        out.append((dia, bool(quais), det))
    return out


def condicoes_revisao(eventos, inicio, fim, janela=7):
    """Condição diária da regra revisao_material: houve, nos últimos `janela` dias, captura
    que trouxe revisão material de série usada na Visão geral. `eventos` = {dia da captura
    (Brasília): número de revisões materiais}. Dias antes da primeira captura comparável
    não são avaliados (não há com o que comparar)."""
    if not eventos:
        return [(dia, None, {}) for dia in calendario(inicio, fim)]
    primeira = min(eventos)
    out = []
    for dia in calendario(inicio, fim):
        if dia < primeira:
            out.append((dia, None, {}))
            continue
        recentes = {k: n for k, n in eventos.items() if (d(dia) - d(k)).days in range(0, janela)}
        out.append((dia, any(n > 0 for n in recentes.values()), {"capturas": recentes}))
    return out
