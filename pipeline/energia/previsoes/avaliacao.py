"""Teste retrospectivo fora da amostra e métricas de desempenho da previsão do PLD.

Desenho (fixado antes da primeira avaliação; seção 12.3 da especificação):

* Origens diárias de 01/01/2022 em diante (antes disso falta o ano anterior da variável
  sazonal). Cada origem prevê as sete entregas (W1 a W4, M1 a M3) nos quatro submercados,
  com o dado como estava no instante de informação e só períodos elegíveis sob LATkD.
* Treino só no passado: os coeficientes do C2 de uma origem vêm do ajuste do último
  domingo, com pares cuja entrega já era informação naquele corte; os quantis vêm de
  resíduos de entregas que já eram informação no corte da própria origem.
* Separação entre seleção e teste final: DESENVOLVIMENTO = entregas que terminam até
  01/01/2025 00h; TESTE = entregas que começam em 01/01/2025 ou depois; entregas que
  atravessam a virada ficam fora dos dois (fronteira). A regra de seleção é aplicada só
  ao desenvolvimento e o teste final é relatado para todos os modelos, sem nova escolha.
  O período 2023 e 2024 já tinha sido examinado pela pesquisa antes da definição dos
  candidatos: o desenvolvimento é exploratório, e isso vai escrito na gold.
* Dependência: origens vizinhas preveem a mesma entrega e os horizontes se sobrepõem, então
  os erros não são independentes. Intervalos de confiança das diferenças de erro vêm de
  bootstrap por blocos de calendário das origens (28 dias para W, 91 dias para M), que
  mantêm juntas todas as células das mesmas origens; o tamanho efetivo é contado em
  entregas distintas, não em linhas.
* Hipótese de disponibilidade: nas origens antigas o sistema não tinha capturas (a primeira
  do PLD é de 27/09/2026); o teste retrospectivo é reconstrução sob LATkD sobre o snapshot,
  com sensibilidade a atrasos (LAT2D e LAT3D), e fica separado do prospectivo.
"""
import os
import random
import sys
from bisect import bisect_right
from collections import defaultdict
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia.previsoes import calendario as cal  # noqa: E402
from pipeline.energia.previsoes import modelos_pld as mp  # noqa: E402
from pipeline.energia.previsoes import variaveis as v  # noqa: E402

ORIGEM_INICIAL = date(2022, 1, 1)
DIVISA = date(2025, 1, 1)
BLOCO_DIAS = {"W": 28, "M": 91}
REPLICAS = 1000
SEMENTE = 20260930
AMOSTRA_MINIMA_REGIME = 10  # entregas distintas

# Tolerância das comparações entre realizado, quantis e limites de preço (R$/MWh). O
# realizado vem da diferença de somas acumuladas de dezenas de milhares de horas e o piso
# médio vem da média dos pisos diários: as duas contas arredondam de forma diferente e,
# numa semana inteira no piso de 2025, dão 58,59999999962747 e 58,60000000000001 para o
# mesmo R$ 58,60/MWh. Com comparação estrita, essa célula contava como abaixo do P10
# embora o realizado fosse igual ao limite inferior da faixa (a cobertura é inclusiva).
# 1e-6 fica mais de três ordens de grandeza acima desse ruído binário (maior diferença
# observada no recálculo independente do B0: 3,7e-10) e quatro abaixo da precisão publicada
# do PLD (R$ 0,01/MWh): nenhuma célula realmente fora da faixa passa a contar como dentro.
TOL_COMPARACAO = 1e-6
COMPARACAO = "realizado comparado aos quantis com tolerância de 1e-6 R$/MWh (faixa inclusiva)"


def abaixo(y, limite, tol=TOL_COMPARACAO):
    """y está abaixo do limite além do ruído de ponto flutuante?"""
    return y < limite - tol


def acima(y, limite, tol=TOL_COMPARACAO):
    """y está acima do limite além do ruído de ponto flutuante?"""
    return y > limite + tol


def dentro(y, lo, hi, tol=TOL_COMPARACAO):
    """lo ≤ y ≤ hi, inclusive, com a mesma tolerância das duas pontas."""
    return not abaixo(y, lo, tol) and not acima(y, hi, tol)


class Linha:
    """Uma célula do teste retrospectivo: origem × horizonte × submercado."""
    __slots__ = ("origem", "h", "sm", "freq", "eid", "inicio", "fim", "y", "b0", "saz", "lo", "hi", "provisoria",
                 "prev", "q", "bruta", "ear", "piso_b0", "motivo")

    def __init__(self, origem, h, sm, e):
        self.origem, self.h, self.sm, self.freq = origem, h, sm, e["frequencia"]
        self.eid, self.inicio, self.fim = e["id"], e["inicio"], e["fim"]
        self.y = self.b0 = self.saz = self.lo = self.hi = None
        self.provisoria = False
        self.prev, self.q, self.bruta, self.motivo = {}, {}, {}, {}
        self.ear = self.piso_b0 = None

    def periodo(self):
        if self.fim <= DIVISA:
            return "desenvolvimento"
        if self.inicio >= DIVISA:
            return "teste"
        return "fronteira"


def ultimo_domingo(d):
    return d - timedelta(days=(d.weekday() - 6) % 7)


def origens_ate(fim, inicio=ORIGEM_INICIAL):
    out, d = [], inicio
    while d <= fim:
        out.append(d)
        d += timedelta(days=1)
    return out


def executa(info, limites, origens, k=1, modelos=mp.MODELOS, ajustes=None):
    """Roda o teste retrospectivo e devolve as linhas (todas as origens, com ou sem
    realizado). `ajustes`, se lista, recebe os coeficientes de cada origem de ajuste."""
    linhas = []
    hidro = "C2-H" in modelos
    for sm in cal.SUBMERCADOS:
        bas_cache = {}
        for h in cal.HORIZONTES:
            freq = "W" if h in cal.HORIZONTES_W else "M"
            seg = []
            for o in origens:
                e = cal.entrega(o, h)
                ln = Linha(o, h, sm, e)
                chave = (o, freq)
                if chave not in bas_cache:
                    bas_cache[chave] = v.basicas(info, o, freq, sm, k, hidrologia=hidro)
                bas = bas_cache[chave]
                saz = v.sazonal(info, e, sm)
                ln.b0, ln.saz = bas["b0"]["valor"], saz["valor"]
                ln.y = v.realizado(info, e, sm)
                ln.lo, ln.hi, ln.provisoria, _ = limites.faixa(e, o) if limites else (None, None, False, [])
                ult = cal.ultimo_dia_elegivel(o, k)
                ln.ear = info.ear.get(sm, {}).get(ult) if info.ear else None
                b0ini, b0fim = date.fromisoformat(bas["b0"]["inicio"]), date.fromisoformat(bas["b0"]["fim"])
                ln.piso_b0 = limites.faixa({"id": f"B0:{b0ini}", "inicio": b0ini, "fim": b0fim}, o)[0] if limites else None
                xp, _ = v.vetor(bas, saz, False)
                xh, _ = v.vetor(bas, saz, True) if hidro else (None, None)
                seg.append((ln, xp, xh))
                if "B0" in modelos:
                    _grava(ln, "B0", ln.b0, "SEM_B0_ELEGIVEL" if ln.b0 is None else None)
                if "S0" in modelos:
                    _grava(ln, "S0", ln.saz, "SEM_PERIODO_DO_ANO_ANTERIOR" if ln.saz is None else None)
            for mod, idx in (("C2-P", 1), ("C2-H", 2)):
                if mod in modelos:
                    _c2(seg, mod, idx, freq, k, ajustes)
            for mod in modelos:
                _quantis(seg, mod, freq, k)
            linhas.extend(ln for ln, _, _ in seg)
    return linhas


def _grava(ln, mod, valor, motivo):
    if valor is None:
        ln.prev[mod], ln.motivo[mod] = None, motivo
        return
    ln.bruta[mod] = valor
    ln.prev[mod], _ = mp.restringe(valor, ln.lo, ln.hi)


def _c2(seg, mod, idx, freq, k, ajustes):
    treino = [(ln, x) for ln, *xs in seg for x in [xs[idx - 1]] if x is not None and ln.y is not None and ln.b0 is not None]
    fins = [ln.fim for ln, _ in treino]
    origs = [ln.origem for ln, _ in treino]
    acum = mp.Acumulados([x for _, x in treino], [ln.y - ln.b0 for ln, _ in treino]) if treino else None
    cache = {}
    for ln, *xs in seg:
        x = xs[idx - 1]
        f = ultimo_domingo(ln.origem)
        if f not in cache:
            if acum is None:
                cache[f] = {"ok": False, "motivo": "TREINO_INSUFICIENTE", "entregas_treino": 0}
            else:
                i_fim = bisect_right(fins, f - timedelta(days=k))
                cache[f] = mp.ajusta_c2(acum, fins, origs, i_fim, k, freq)
                # fim da última entrega realmente usada no treino (auditoria de look-ahead)
                cache[f]["ultimo_fim_treino"] = fins[i_fim - 1] if (i_fim and cache[f].get("ok")) else None
            if ajustes is not None:
                ajustes.append({"origem_ajuste": f, "modelo": mod, "horizonte": ln.h, "sm": ln.sm, "k": k, **cache[f]})
        aj = cache[f]
        if ln.b0 is None:
            _grava(ln, mod, None, "SEM_B0_ELEGIVEL")
        elif x is None:
            _grava(ln, mod, None, "VARIAVEL_AUSENTE")
        elif not aj["ok"]:
            _grava(ln, mod, None, aj["motivo"])
        else:
            _grava(ln, mod, mp.preve_c2(ln.b0, x, aj), None)


def _quantis(seg, mod, freq, k):
    """Quantis empíricos por origem a partir de resíduos maturados no corte (LATkD)."""
    pares = [ln for ln, _, _ in seg if ln.prev.get(mod) is not None and ln.y is not None]
    fins = [ln.fim for ln in pares]
    distintas = sorted(set(fins))
    cache = {}
    for ln, _, _ in seg:
        if ln.prev.get(mod) is None:
            continue
        i_fim = bisect_right(fins, ln.origem - timedelta(days=k))
        if i_fim not in cache:
            maturadas = distintas[:bisect_right(distintas, ln.origem - timedelta(days=k))]
            if len(maturadas) < mp.MIN_RESIDUOS:
                cache[i_fim] = None
            else:
                janela = maturadas[-mp.JANELA_RESIDUOS[freq]:]
                a = bisect_right(fins, janela[0] - timedelta(days=1))
                cache[i_fim] = mp.quantis_residuos([pares[i].y - pares[i].prev[mod] for i in range(a, i_fim)])
        qres = cache[i_fim]
        if qres is not None:
            ln.q[mod] = mp.quantis_finais(ln.prev[mod], qres, ln.lo, ln.hi)


# ---------------------------------------------------------------- métricas

def _blocos(linhas, freq):
    if not linhas:
        return {}
    ini = min(ln.origem for ln in linhas)
    return {ln: (ln.origem - ini).days // BLOCO_DIAS[freq] for ln in linhas}


def bootstrap_media(valores_por_bloco, replicas=REPLICAS, semente=SEMENTE):
    """IC de 90% (percentis 5 e 95) da média por bootstrap de blocos (soma e contagem por
    bloco). Menos de 5 blocos: sem intervalo (amostra curta demais para reamostrar)."""
    blocos = [(s, n) for s, n in valores_por_bloco.values() if n]
    if len(blocos) < 5:
        return None, None
    rng = random.Random(semente)
    medias = []
    m = len(blocos)
    for _ in range(replicas):
        s = n = 0
        for _ in range(m):
            bs, bn = blocos[rng.randrange(m)]
            s += bs
            n += bn
        medias.append(s / n)
    medias.sort()
    return mp.quantil(medias, 0.05), mp.quantil(medias, 0.95)


def resumo(linhas, mod, freq, calibrar=True):
    """Métricas de um conjunto de linhas para um modelo, pareadas com B0 onde cabe.
    Erro = previsão − realizado (R$/MWh); viés = média do erro (positivo = superestima)."""
    usa = [ln for ln in linhas if ln.y is not None and ln.prev.get(mod) is not None]
    out = {"linhas": len(usa), "entregas": len({ln.eid for ln in usa}), "origens": len({ln.origem for ln in usa})}
    if not usa:
        return {**out, "mae": None, "vies": None, "rmse": None}
    erros = [ln.prev[mod] - ln.y for ln in usa]
    out["soma_erro_abs"] = sum(abs(e) for e in erros)  # numerador do MAE (evidência)
    out["mae"] = out["soma_erro_abs"] / len(erros)
    out["vies"] = sum(erros) / len(erros)
    out["rmse"] = (sum(e * e for e in erros) / len(erros)) ** 0.5
    if mod != "B0":
        par = [ln for ln in usa if ln.prev.get("B0") is not None]
        out["linhas_pareadas"] = len(par)
        if par:
            mae_m = sum(abs(ln.prev[mod] - ln.y) for ln in par) / len(par)
            mae_b = sum(abs(ln.prev["B0"] - ln.y) for ln in par) / len(par)
            out["mae_pareado"], out["mae_b0_pareado"] = mae_m, mae_b
            out["ganho_mae_vs_b0"] = mae_b - mae_m
            out["skill_mae_vs_b0"] = 1 - mae_m / mae_b if mae_b > 0 else None
            blocos = _blocos(par, freq)
            por_bloco = defaultdict(lambda: [0.0, 0])
            for ln in par:
                d = abs(ln.prev["B0"] - ln.y) - abs(ln.prev[mod] - ln.y)
                por_bloco[blocos[ln]][0] += d
                por_bloco[blocos[ln]][1] += 1
            lo, hi = bootstrap_media({b: tuple(x) for b, x in por_bloco.items()})
            out["ganho_ic90"] = [lo, hi] if lo is not None else None
            out["blocos"] = len(por_bloco)
    comq = [ln for ln in usa if mod in ln.q]
    out["linhas_com_quantis"] = len(comq)
    out["entregas_com_quantis"] = len({ln.eid for ln in comq})
    if comq:
        pin = []
        for ln in comq:
            pin.append(sum(mp.pinball(ln.y, ln.q[mod][r], nv) for r, nv in zip(mp.ROTULOS_NIVEIS, mp.NIVEIS)) / len(mp.NIVEIS))
        out["perda_quantilica"] = sum(pin) / len(pin)
        # faixa inclusiva com tolerância (ver TOL_COMPARACAO): realizado igual ao piso que
        # limitou o P10 conta como coberto, não como abaixo
        dentro80 = [1 if dentro(ln.y, ln.q[mod]["p10"], ln.q[mod]["p90"]) else 0 for ln in comq]
        dentro90 = [1 if dentro(ln.y, ln.q[mod]["p05"], ln.q[mod]["p95"]) else 0 for ln in comq]
        out["cobertura_p10_p90"] = sum(dentro80) / len(dentro80)
        out["cobertura_p05_p95"] = sum(dentro90) / len(dentro90)
        out["largura_p10_p90"] = sum(ln.q[mod]["p90"] - ln.q[mod]["p10"] for ln in comq) / len(comq)
        out["abaixo_p10"] = sum(1 for ln in comq if abaixo(ln.y, ln.q[mod]["p10"])) / len(comq)
        out["acima_p90"] = sum(1 for ln in comq if acima(ln.y, ln.q[mod]["p90"])) / len(comq)
        # cobertura por entrega distinta: média, entre entregas, da fração de origens
        # cujo intervalo conteve o realizado (cada entrega pesa igual)
        por_ent = defaultdict(list)
        for ln, d80 in zip(comq, dentro80):
            por_ent[ln.eid].append(d80)
        out["cobertura_p10_p90_por_entrega"] = sum(sum(x) / len(x) for x in por_ent.values()) / len(por_ent)
    return out


def calibracao(res, n_min, faixa=(0.75, 0.85)):
    """Estado de calibração da faixa P10 a P90 (regra de docs/observatorios/PLD_GOVERNANCA_PREVISAO.md):
    n = entregas distintas com quantis (origens vizinhas da mesma entrega não são casos
    independentes). Devolve o código de governanca.status_calibracao."""
    cob = res.get("cobertura_p10_p90")
    n = res.get("entregas_com_quantis")
    if cob is None or not n:
        return "SEM_AVALIACAO"
    if n < n_min:
        return "AMOSTRA_INSUFICIENTE"
    return "CALIBRADO" if faixa[0] <= cob <= faixa[1] else "DESCALIBRADO"


def limiar_percentil(valores, q):
    xs = sorted(x for x in valores if x is not None)
    return mp.quantil(xs, q) if xs else None


def regimes(linhas_dev):
    """Limiares de regime fixados no DESENVOLVIMENTO e aplicados a todos os períodos:
    preço alto = B0 acima do percentil 75 do B0 no desenvolvimento (por submercado e
    frequência); armazenamento baixo/alto = EAR abaixo do percentil 33 / acima do 67 (por
    submercado); extremo = realizado acima do percentil 90 do realizado no desenvolvimento.
    Preço no piso = B0 a até R$ 1/MWh do piso vigente no período do B0."""
    lim = {}
    for sm in cal.SUBMERCADOS:
        for freq in ("W", "M"):
            ls = [ln for ln in linhas_dev if ln.sm == sm and ln.freq == freq]
            lim[(sm, freq)] = {
                "b0_p75": limiar_percentil([ln.b0 for ln in ls], 0.75),
                "y_p90": limiar_percentil([ln.y for ln in ls], 0.90),
                "ear_p33": limiar_percentil([ln.ear for ln in ls], 1 / 3),
                "ear_p67": limiar_percentil([ln.ear for ln in ls], 2 / 3),
            }
    return lim


def regime_preco(ln, lim):
    if ln.b0 is None:
        return None
    if ln.piso_b0 is not None and ln.b0 - ln.piso_b0 <= 1.0:
        return "piso"
    t = lim[(ln.sm, ln.freq)]["b0_p75"]
    return "alto" if t is not None and ln.b0 > t else "intermediario"


def regime_hidro(ln, lim):
    if ln.ear is None:
        return None
    t = lim[(ln.sm, ln.freq)]
    if ln.ear < t["ear_p33"]:
        return "armazenamento_baixo"
    if ln.ear > t["ear_p67"]:
        return "armazenamento_alto"
    return "armazenamento_medio"


def extremo(ln, lim):
    t = lim[(ln.sm, ln.freq)]["y_p90"]
    return None if ln.y is None or t is None else ln.y > t
