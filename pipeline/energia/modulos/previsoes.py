"""Módulo Previsões: desempenho, calibração, fichas e arquivo da previsão do PLD.

Gold: public/energia/gold/previsoes_desempenho.json (painéis P013 a P016, com a gold
previsoes.json e modelos.json montadas por pipeline/energia/gold/modelos.py) e CSVs em
public/energia/series/previsoes_*.csv.

O que este módulo faz, a cada execução:

1. Teste retrospectivo fora da amostra dos modelos implementados no repositório (B0, S0,
   C2-P, C2-H; o C1 não tem configuração publicável), com origens diárias desde 2022,
   treino só no passado e o dado sob a regra LAT1D (pipeline/energia/previsoes/avaliacao.py).
2. Métricas por horizonte e submercado (MAE e viés em R$/MWh, RMSE, perda quantílica,
   cobertura e largura das faixas, ganho sobre B0 com intervalo por bootstrap de blocos),
   separando desenvolvimento (seleção) de teste final, por regime de preço e de
   armazenamento e em extremos, com sensibilidade a atrasos (LAT2D, LAT3D).
3. Evidência das pendências da governança (G23-R1: coeficiente acima de 1 e previsões
   brutas fora da faixa de preço; G4: não concluível no repositório).
4. Prospectivo: rodadas registradas no arquivo imutável (horário real, atraso, falha,
   versão), apuração das entregas já encerradas, revisão entre rodadas para a mesma
   entrega e reexecução de cada previsão arquivada.
5. Previsão atual: a última rodada da referência experimental B0 (4 × 7), o PLD já
   publicado para as horas seguintes ao corte (dado, não previsão) e o estado dos C2.

Fontes: PLD horário da CCEE e EAR e ENA diários do ONS, lidos do silver principal
(data/energia/silver/energia.db, só leitura) com as vintages; limites do PLD dos atos da
ANEEL (módulo Regulação). A coleta própria (família `previsoes`) guarda os dicionários de
dados do ONS de EAR e ENA, para conferir que os campos usados pelo C2-H continuam lá.
"""
import csv
import io
import json
import math
import os
import subprocess
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.common import http_get  # noqa: E402
from pipeline.energia import base  # noqa: E402
from pipeline.energia import evidencia as ev  # noqa: E402
from pipeline.energia import governanca as g  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402
from pipeline.energia.previsoes import arquivo as arq  # noqa: E402
from pipeline.energia.previsoes import avaliacao as av  # noqa: E402
from pipeline.energia.previsoes import calendario as cal  # noqa: E402
from pipeline.energia.previsoes import emissao as em  # noqa: E402
from pipeline.energia.previsoes import modelos_pld as mp  # noqa: E402
from pipeline.energia.previsoes import variaveis as v  # noqa: E402

GOLD = "previsoes_desempenho.json"
FAMILIA = "previsoes"
DS_DIC = "previsoes_dicionarios_ons"
URL_CCEE = "https://dadosabertos.ccee.org.br/dataset/pld_horario"
URL_EAR = "https://dados.ons.org.br/dataset/ear-diario-por-subsistema"
URL_ENA = "https://dados.ons.org.br/dataset/ena-diario-por-subsistema"
DICIONARIOS = {
    "ear": {"url": "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/ear_subsistema_di/DicionarioDados_EarPorSubsistema.pdf",
            "campos": ["ear_data", "ear_verif_subsistema_percentual"]},
    "ena": {"url": "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/ena_subsistema_di/DicionarioDados_EnaPorSubsistema.pdf",
            "campos": ["ena_data", "ena_bruta_regiao_percentualmlt"]},
}
PAGINAS = [{"rotulo": "Previsões do PLD", "href": "/setor-eletrico/pld/previsoes"},
           {"rotulo": "Modelos de previsão do PLD", "href": "/setor-eletrico/pld/modelos"}]
CSV_SEMANAL = "/energia/series/previsoes_backtest_semanal.csv"
CSV_MENSAL = "/energia/series/previsoes_backtest_mensal.csv"
CSV_DESEMPENHO = "/energia/series/previsoes_desempenho.csv"
CSV_AJUSTES = "/energia/series/previsoes_ajustes_c2.csv"
CSV_EMISSOES = "/energia/series/previsoes_emissoes.csv"
LIMITE_APURACOES = 56  # duas rodadas de 28 células; o histórico completo vai no CSV de emissões
LIMITE_SEQUENCIA = 10
LIMITE_RODADAS = 30
TOL_REEXECUCAO = 0.005  # R$/MWh: a previsão é gravada com 4 casas; meio centavo cobre arredondamento
SITE = "https://scrutiniums.com/setor-eletrico/pld/previsoes"
WORKFLOW = ".github/workflows/previsao-pld.yml"
CRON_UTC = ["5 9 * * *", "35 9 * * *"]
MODELOS_TESTE = ("B0", "S0", "C2-P", "C2-H")
REGRA_SELECAO = ("Fixada antes do teste: no período de desenvolvimento, um candidato (C2-P ou C2-H) é selecionado quando o ganho de "
                 "MAE sobre o B0, com horizontes e submercados juntos, tem intervalo de 90% inteiro acima de zero; com dois, fica o de "
                 "maior ganho. O teste final é relatado para todos os modelos, sem nova escolha.")
CANDIDATOS = ("C2-P", "C2-H")

REGISTRO = {
    "id": "previsoes",
    "gold": GOLD,
    "familia": FAMILIA,
    "ordem": 90,
    "datasets": [
        {"orgao": "ONS", "nome": "dicionarios-ear-ena-subsistema", "slug": "ons-dicionarios-ear-ena", "dataset_silver": DS_DIC,
         "titulo": "Dicionários de dados de EAR e ENA diários por subsistema (PDF do ONS)", "estado": "INTEGRADO",
         "url": URL_EAR, "licenca": c.LICENCA_ONS, "tema": "hidrologia", "formatos": ["PDF"],
         "descricao": ("Dicionários oficiais dos conjuntos de EAR e ENA diários, guardados com sha256 para conferir, a cada "
                       "coleta, que os campos usados pelo modelo C2-H (EAR em % e ENA bruta em % da MLT) continuam definidos."),
         "paginas": PAGINAS, "downloads": [], "quebras": []},
    ],
    "arquivos": {
        CSV_SEMANAL: (
            "origem (dia da rodada, Brasília; corte às 07h00); horizonte (W1 a W4); submercado; entrega (sábado de início da "
            "semana, de sábado 00h a sábado 00h, fim excluído); periodo (desenvolvimento = entrega termina até 01/01/2025; teste = "
            "começa em 01/01/2025 ou depois; fronteira = atravessa a virada); realizado (média das 168 horas do PLD, vazio se a "
            "semana não está completa); b0, s0, c2p, c2h = previsões em R$/MWh nominais depois da restrição de preço (vazio = "
            "modelo sem previsão naquela célula); *_p10 e *_p90 = quantis empíricos (vazio sem 24 entregas de resíduos); piso e "
            "teto = faixa média [PLD mínimo, teto estrutural] dos atos publicados até a origem; faixa_provisoria = 1 quando o ato "
            "do ano da entrega ainda não tinha saído. Teste retrospectivo sob a hipótese LAT1D; não é previsão emitida."),
        CSV_MENSAL: "Mesmas colunas do arquivo semanal, para os horizontes M1 a M3 (entrega = AAAA-MM, mês civil).",
        CSV_DESEMPENHO: (
            "modelo; recorte (celula = horizonte e submercado; horizonte = submercados juntos; frequencia = horizontes juntos); "
            "horizonte; submercado; periodo; linhas (células avaliadas); entregas (entregas distintas); origens; mae, vies (média "
            "de previsão − realizado), rmse em R$/MWh; mae_b0_pareado e ganho_vs_b0 (MAE do B0 − MAE do modelo nas mesmas "
            "células; positivo = melhor que B0); ganho_ic90_inf e ganho_ic90_sup (bootstrap de blocos de origens); skill (1 − "
            "MAE/MAE do B0); perda_quantilica (média da perda nos níveis 5 a 95%); cobertura_p10_p90, cobertura_p05_p95 (fração "
            "0 a 1); largura_p10_p90 (R$/MWh); calibracao (estado pela regra da governança; n = entregas distintas)."),
        CSV_AJUSTES: (
            "origem_ajuste (domingo); modelo (C2-P, C2-H); horizonte; submercado; ok (1 = ajustado; 0 = treino insuficiente); "
            "lambda (ZERO = correção desligada); entregas_treino; linhas_treino; coef_* = coeficiente de cada variável na unidade "
            "original (R$/MWh por R$/MWh, ou por ponto percentual); escala_* = escala RMS no treino; ultimo_fim_treino = fim da "
            "última entrega usada no treino (sempre até o domingo menos 1 dia)."),
        CSV_EMISSOES: (
            "Uma linha por célula emitida pelo observatório (arquivo imutável, pipeline/energia/previsoes/): forecast_id; run_id; "
            "tipo (REFERENCIA_EXPERIMENTAL, RODADA_INTERNA, PUBLICACAO); modelo; versao_modelo; origem; cutoff, prazo e emitido_em "
            "(UTC); atraso_min; modo (agendada ou manual); horizonte; entrega; submercado; status; previsao (R$/MWh, vazio = sem "
            "número); motivo; realizado e erro quando a entrega já terminou; sha256."),
    },
}


# ---------------------------------------------------------------- coleta (dicionários do ONS)

def coletar(con, ctx, baixar=http_get):
    """Guarda os dicionários de EAR e ENA (PDF) com sha256 e confere os campos usados."""
    if ctx.get("sem_rede"):
        return {"ok": True, "detalhe": "sem rede: coleta pulada"}
    status = {"ok": True, "arquivos": 0, "falhas": []}
    for nome, d in DICIONARIOS.items():
        try:
            corpo, _ = baixar(d["url"], timeout=90, accept="*/*")
        except Exception as e:
            base.registra_coleta(con, DS_DIC, nome, False, str(e))
            status["falhas"].append(f"{nome}: {e}"[:200])
            continue
        cap = base.agora_utc()
        caminho, sha = base.salva_bronze("ons", DS_DIC, nome, corpo, "pdf", cap)
        vid, nova = base.registra_vintage(con, DS_DIC, nome, d["url"], cap, None, sha, len(corpo), "coleta_direta", caminho)
        texto = _pdf_texto(corpo)
        presentes = {campo: (campo in texto) if texto is not None else None for campo in d["campos"]}
        base.grava_registros(con, DS_DIC, vid, [(nome, f"campo:{k}", "presente" if p else ("ausente" if p is False else None))
                                                for k, p in presentes.items()])
        base.registra_coleta(con, DS_DIC, nome, True, f"{len(corpo)} bytes; campos {presentes}")
        status["arquivos"] += 1
    status["ok"] = not status["falhas"]
    return status


def _pdf_texto(corpo):
    """Texto do PDF pelo pdftotext (poppler), quando instalado; None se não houver extrator."""
    try:
        r = subprocess.run(["pdftotext", "-layout", "-", "-"], input=corpo, capture_output=True, timeout=60)
        return r.stdout.decode("utf-8", errors="replace") if r.returncode == 0 else None
    except Exception:
        return None


# ---------------------------------------------------------------- auxiliares

def _r(x, casas=2):
    return c.r(x, casas)


def _fonte_ccee(snap):
    arquivos = [{"recurso": x["recurso"], "arquivo": None, "sha256": x["sha256"], "capturado_em": x["capturado_em"],
                 "publicado_em": None} for x in snap.get("capturas", [])]
    return {"orgao": "CCEE", "conjunto": "PLD_HORARIO (PLD horário por submercado)",
            "recurso": "pld_horario_2021 a pld_horario_2026", "url": URL_CCEE, "arquivo": None,
            "sha256": snap.get("sha256"), "capturado_em": c.ultima_captura(snap), "publicado_em": None,
            "arquivos": arquivos or None}


def _freq(h):
    return "W" if h in cal.HORIZONTES_W else "M"


def _linha_metrica(mod, recorte, h, sm, per, res, calib=None):
    """Linha de métrica (o recorte vai para o CSV; na gold ele é implícito na lista)."""
    return {"modelo": mod, "recorte": recorte, "horizonte": h, "submercado": sm, "periodo": per,
            "linhas": res["linhas"], "entregas": res["entregas"], "origens": res["origens"],
            "mae": _r(res.get("mae")), "vies": _r(res.get("vies")), "rmse": _r(res.get("rmse")),
            "mae_b0_pareado": _r(res.get("mae_b0_pareado")), "ganho_vs_b0": _r(res.get("ganho_mae_vs_b0")),
            "ganho_ic90": [_r(x) for x in res["ganho_ic90"]] if res.get("ganho_ic90") else None,
            "skill": _r(res.get("skill_mae_vs_b0"), 4), "linhas_pareadas": res.get("linhas_pareadas"),
            "perda_quantilica": _r(res.get("perda_quantilica")),
            "cobertura_p10_p90": _r(res.get("cobertura_p10_p90"), 4), "cobertura_p05_p95": _r(res.get("cobertura_p05_p95"), 4),
            "largura_p10_p90": _r(res.get("largura_p10_p90")), "abaixo_p10": _r(res.get("abaixo_p10"), 4),
            "acima_p90": _r(res.get("acima_p90"), 4), "entregas_com_quantis": res.get("entregas_com_quantis"),
            "calibracao": calib}


def _enxuto(linhas):
    """Métricas na gold sem os campos que só servem ao CSV (recorte e contagem de origens)."""
    return [{k: x for k, x in l_.items() if k not in ("recorte", "origens", "linhas_pareadas")} for l_ in linhas]


def _pontos_dict(cp, sm, instante):
    return dict(base.como_estava_em(cp, v.DS_PLD, f"pld.{sm}", instante))


def _media_direta(pontos, ini, fim):
    refs = cal.horas(ini, fim)
    vals = [pontos.get(x) for x in refs]
    return None if any(x is None for x in vals) else sum(vals) / len(vals)


# ---------------------------------------------------------------- métricas

def _metricas(linhas):
    """Por célula (horizonte × submercado), por horizonte e por frequência, nos dois períodos."""
    celulas, horizontes, frequencias = [], [], []
    idx = defaultdict(list)
    for ln in linhas:
        idx[(ln.h, ln.sm, ln.periodo())].append(ln)
    for per in ("desenvolvimento", "teste"):
        for h in cal.HORIZONTES:
            fr = _freq(h)
            todas_h = [ln for sm in cal.SUBMERCADOS for ln in idx[(h, sm, per)]]
            for mod in MODELOS_TESTE:
                for sm in cal.SUBMERCADOS:
                    res = av.resumo(idx[(h, sm, per)], mod, fr)
                    celulas.append(_linha_metrica(mod, "celula", h, sm, per, res, av.calibracao(res, g.CALIBRACAO_N_MIN)))
                res = av.resumo(todas_h, mod, fr)
                horizontes.append(_linha_metrica(mod, "horizonte", h, None, per, res))
        for fr, hs in (("W", cal.HORIZONTES_W), ("M", cal.HORIZONTES_M)):
            todas = [ln for h in hs for sm in cal.SUBMERCADOS for ln in idx[(h, sm, per)]]
            for mod in MODELOS_TESTE:
                res = av.resumo(todas, mod, fr)
                frequencias.append(_linha_metrica(mod, "frequencia", fr, None, per, res))
    return celulas, horizontes, frequencias


def _selecao(frequencias):
    """Regra fixada antes do teste: no DESENVOLVIMENTO, candidato cujo ganho de MAE sobre o
    B0 (horizontes e submercados juntos) tem IC de 90% inteiro acima de zero; com dois,
    o de maior ganho. O teste final é relatado para todos, sem nova escolha."""
    out = {}
    for fr in ("W", "M"):
        cands = []
        for mod in CANDIDATOS:
            m = next(x for x in frequencias if x["modelo"] == mod and x["horizonte"] == fr and x["periodo"] == "desenvolvimento")
            ic = m.get("ganho_ic90")
            passa = bool(ic and ic[0] is not None and ic[0] > 0)
            cands.append({"modelo": mod, "ganho_vs_b0": m["ganho_vs_b0"], "ganho_ic90": ic, "entregas": m["entregas"],
                          "linhas_pareadas": m.get("linhas_pareadas"), "passa": passa})
        ok = [x for x in cands if x["passa"]]
        sel = max(ok, key=lambda x: x["ganho_vs_b0"])["modelo"] if ok else None
        teste = None
        if sel:
            t = next(x for x in frequencias if x["modelo"] == sel and x["horizonte"] == fr and x["periodo"] == "teste")
            teste = {k: t[k] for k in ("mae", "mae_b0_pareado", "ganho_vs_b0", "ganho_ic90", "entregas", "linhas_pareadas")}
            ic = t.get("ganho_ic90")
            teste["resultado"] = ("ganho confirmado no teste (IC de 90% acima de zero)" if ic and ic[0] is not None and ic[0] > 0 else
                                  "ganho não confirmado no teste (IC de 90% inclui zero ou fica abaixo)")
        out[fr] = {"candidatos": cands, "selecionado": sel, "teste_do_selecionado": teste,
                   "leitura": (f"{sel} passou na regra de seleção do desenvolvimento." if sel else
                               "Nenhum candidato superou o B0 com intervalo de confiança inteiro acima de zero no desenvolvimento.")}
    return out


def _regimes(linhas):
    dev = [ln for ln in linhas if ln.periodo() == "desenvolvimento"]
    lim = av.regimes(dev)
    saida = []
    for per in ("desenvolvimento", "teste"):
        for fr in ("W", "M"):
            ls = [ln for ln in linhas if ln.periodo() == per and ln.freq == fr]
            grupos = defaultdict(list)
            for ln in ls:
                grupos[("preco", av.regime_preco(ln, lim))].append(ln)
                grupos[("armazenamento", av.regime_hidro(ln, lim))].append(ln)
                ex = av.extremo(ln, lim)
                if ex is not None:
                    grupos[("extremo", "acima_p90_do_desenvolvimento" if ex else "ate_p90_do_desenvolvimento")].append(ln)
            for (tipo, reg), gl in sorted(grupos.items(), key=lambda kv: (kv[0][0], str(kv[0][1]))):
                if reg is None:
                    continue
                for mod in ("B0",) + CANDIDATOS:
                    res = av.resumo(gl, mod, fr)
                    saida.append({"modelo": mod, "frequencia": fr, "periodo": per, "tipo": tipo, "regime": reg,
                                  "linhas": res["linhas"], "entregas": res["entregas"], "mae": _r(res.get("mae")),
                                  "mae_b0_pareado": _r(res.get("mae_b0_pareado")),
                                  "ganho_vs_b0": _r(res.get("ganho_mae_vs_b0")),
                                  "ganho_ic90": [_r(x) for x in res["ganho_ic90"]] if res.get("ganho_ic90") else None,
                                  "amostra_suficiente": res["entregas"] >= av.AMOSTRA_MINIMA_REGIME})
    limiares = [{"submercado": sm, "frequencia": fr, **{k: _r(x) for k, x in d.items()}} for (sm, fr), d in sorted(lim.items())]
    return limiares, saida


NOTA_REGIMES = ("Limiares fixados no período de desenvolvimento (2022 a 2024), por submercado e frequência, e aplicados sem mudança ao "
                "teste: preço no piso = B0 a até R$ 1/MWh do piso vigente no período do B0; preço alto = B0 acima do percentil 75 do B0 "
                "no desenvolvimento; armazenamento baixo, médio e alto = EAR do último dia elegível abaixo do percentil 33, entre 33 e "
                "67 ou acima do 67; extremo = realizado acima do percentil 90 do desenvolvimento. Como o nível de preço subiu depois de "
                "2024, a maior parte do teste cai em preço alto e acima do percentil 90: os regimes descrevem a mudança de nível, e "
                "grupos com menos de 10 entregas distintas são marcados como amostra insuficiente.")


def _sensibilidade(info, lim, origens):
    """MAE no período de teste sob LAT1D, LAT2D e LAT3D (dado disponível 1, 2 ou 3 dias
    depois do fim do período), por modelo e horizonte, submercados juntos."""
    out = []
    for k in (1, 2, 3):
        linhas = av.executa(info, lim, origens, k=k, modelos=("B0", "C2-P", "C2-H"))
        por_h = defaultdict(list)
        for ln in linhas:
            if ln.periodo() == "teste":
                por_h[ln.h].append(ln)
        for h in cal.HORIZONTES:
            for mod in ("B0", "C2-P", "C2-H"):
                res = av.resumo(por_h[h], mod, _freq(h))
                out.append({"k_dias": k, "modelo": mod, "horizonte": h, "linhas": res["linhas"], "entregas": res["entregas"],
                            "mae": _r(res.get("mae")), "vies": _r(res.get("vies"))})
        del linhas
    return out


def _g23(ajustes, linhas):
    """Evidência do achado G23-R1 na reimplementação: coeficiente da variável d7 − B0 acima
    de 1 (amplificação) e previsões brutas fora da faixa de preço antes da restrição."""
    seg = defaultdict(lambda: {"ajustes": 0, "ok": 0, "coef_d7_acima_1": 0, "lambda_zero": 0, "coef_d7_max": None})
    i_d7 = v.VARIAVEIS_P.index("d7_menos_b0")
    for a in ajustes:
        s = seg[(a["modelo"], a["horizonte"], a["sm"])]
        s["ajustes"] += 1
        if a.get("ok"):
            s["ok"] += 1
            cf = a["coef"][i_d7]
            s["coef_d7_acima_1"] += cf > 1
            s["lambda_zero"] += a["lambda"] == "ZERO"
            s["coef_d7_max"] = cf if s["coef_d7_max"] is None else max(s["coef_d7_max"], cf)
    por_segmento = [{"modelo": m, "horizonte": h, "submercado": sm, "ajustes": s["ajustes"], "ajustados": s["ok"],
                     "coef_d7_acima_de_1": s["coef_d7_acima_1"], "fracao_coef_d7_acima_de_1": _r(s["coef_d7_acima_1"] / s["ok"], 4) if s["ok"] else None,
                     "lambda_zero": s["lambda_zero"], "coef_d7_maximo": _r(s["coef_d7_max"], 4)}
                    for (m, h, sm), s in sorted(seg.items())]
    fora = defaultdict(lambda: {"previsoes": 0, "abaixo_do_piso": 0, "acima_do_teto": 0, "negativas": 0})
    for ln in linhas:
        for mod in CANDIDATOS:
            b = ln.bruta.get(mod)
            if b is None:
                continue
            f = fora[(mod, ln.freq)]
            f["previsoes"] += 1
            f["abaixo_do_piso"] += ln.lo is not None and b < ln.lo
            f["acima_do_teto"] += ln.hi is not None and b > ln.hi
            f["negativas"] += b < 0
    caso = []
    for ln in linhas:
        if ln.origem == date(2024, 11, 30) and ln.freq == "M":
            caso.append({"horizonte": ln.h, "submercado": ln.sm, "entrega": ln.eid, "realizado": _r(ln.y), "b0": _r(ln.b0),
                         **{f"{m.lower().replace('-', '')}_bruta": _r(ln.bruta.get(m)) for m in CANDIDATOS},
                         **{f"{m.lower().replace('-', '')}_final": _r(ln.prev.get(m)) for m in CANDIDATOS},
                         "piso": _r(ln.lo)})
    tot = sum(s["ok"] for s in seg.values())
    acima = sum(s["coef_d7_acima_1"] for s in seg.values())
    return {
        "achado": ("Revisão da pesquisa: o coeficiente da variável média dos 7 dias − B0 passou de 1 em parte das origens, o que "
                   "pode amplificar o sinal de preço; e houve previsões mensais negativas para dezembro de 2024 na origem 30/11/2024."),
        "coeficiente_d7": {"ajustes_ok": tot, "acima_de_1": acima, "fracao": _r(acima / tot, 4) if tot else None,
                           "por_segmento": por_segmento},
        "fora_da_faixa_antes_da_restricao": [{"modelo": m, "frequencia": fr, **d} for (m, fr), d in sorted(fora.items())],
        "origem_2024_11_30_mensal": caso,
        "tratamento": ("Toda previsão e todo quantil passam pela restrição à faixa [piso, teto estrutural] médios dos atos da "
                       "ANEEL publicados até a origem, então nenhuma previsão publicada fica negativa ou abaixo do piso. A "
                       "restrição não corrige a amplificação: ela é medida acima e fica para a decisão revisável."),
    }


# ---------------------------------------------------------------- prospectivo

def _rodadas(registros):
    por_run = defaultdict(list)
    for r in registros:
        por_run[r["run_id"]].append(r)
    out = []
    for run_id, rs in por_run.items():
        r0 = rs[0]
        prazo = r0.get("prazo")
        atraso = r0.get("atraso_min")
        if atraso is None and prazo and r0.get("emitido_em"):
            atraso = round(max(0.0, (cal.instante(r0["emitido_em"]) - cal.instante(prazo)).total_seconds() / 60), 1)
        modo = (r0.get("execucao") or {}).get("modo") or "manual (registro transcrito de artefato externo)"
        falha = any(x.get("motivo") == "FALHA_NA_EXECUCAO" for x in rs)
        com = sum(1 for x in rs if x.get("previsao") is not None)
        out.append({
            "run_id": run_id, "origem": r0["origem"], "cutoff": r0["cutoff"], "prazo": prazo, "emitido_em": r0["emitido_em"],
            "atraso_min": atraso, "no_prazo": atraso == 0 if atraso is not None else None, "modo": modo,
            "executor": (r0.get("execucao") or {}).get("executor"), "run_url": (r0.get("execucao") or {}).get("run_url"),
            "tipos": sorted({x["tipo"] for x in rs}), "modelos": sorted({x["modelo"] for x in rs}),
            "versao_codigo": r0.get("versao_codigo"), "celulas": len(rs), "com_numero": com, "falha": falha,
            "motivos": sorted({x["motivo"] for x in rs if x.get("motivo")}),
            "alertas": sorted({a for x in rs for a in (x.get("alertas") or [])}),
            "registrado_no_portal_em": r0.get("registrado_no_portal_em"),
        })
    return sorted(out, key=lambda x: x["emitido_em"], reverse=True)


def _rotina(rodadas, hoje):
    agendadas = [r for r in rodadas if r["modo"] == "agendada"]
    inicio = min((r["origem"] for r in agendadas), default=None)
    faltantes = []
    if inicio:
        d = date.fromisoformat(inicio)
        feitas = {r["origem"] for r in agendadas if not r["falha"]}
        while d <= hoje:
            if d.isoformat() not in feitas:
                faltantes.append(d.isoformat())
            d += timedelta(days=1)
    no_prazo = [r for r in agendadas if r["no_prazo"] and not r["falha"]]
    return {
        "workflow": WORKFLOW, "cron_utc": CRON_UTC,
        "horarios": ("Verificação e retentativa de coleta a partir de 06h05 de Brasília (09h05 UTC), segunda tentativa às 06h35; "
                     "espera até o corte das 07h00; emissão com o dado como estava no corte; commit do arquivo de emissões até 08h00. "
                     "Pré-carga: coleta noturna das 20h40 (atualizar-energia.yml)."),
        "fuso": "America/Sao_Paulo; o cron do GitHub é em UTC e supõe UTC−3 (sem horário de verão desde 2019). Se o horário de "
                "verão voltar, o cron precisa mudar; a emissão calcula o corte pelo fuso e marca o atraso de qualquer forma.",
        "inicio_operacao_agendada": inicio,
        "execucoes_agendadas": len(agendadas), "no_prazo": len(no_prazo),
        "atrasadas": sum(1 for r in agendadas if r["no_prazo"] is False and not r["falha"]),
        "falhas": sum(1 for r in agendadas if r["falha"]), "dias_sem_rodada": faltantes[-60:],
        "dias_sem_rodada_total": len(faltantes),
        "comprovada": bool(agendadas) and len(no_prazo) >= 7 and not faltantes,
        "leitura": ("Nenhuma execução agendada registrada até agora: a rotina está escrita no código, mas ainda não foi comprovada "
                    "por execução real." if not agendadas else
                    f"{len(agendadas)} execuções agendadas registradas desde {c.data_br(inicio)}, {len(no_prazo)} no prazo; "
                    + ("rotina comprovada no período." if (len(no_prazo) >= 7 and not faltantes) else
                       "ainda não há sete rodadas no prazo sem dia faltante; a rotina não é declarada comprovada.")),
        "criterio_comprovacao": "Pelo menos sete rodadas agendadas consecutivas no prazo, sem dia faltante desde o início da operação agendada.",
    }


def _apuracoes(registros, info, cp):
    """Realizado e erro das previsões arquivadas cuja entrega já terminou; reexecução de
    cada previsão B0 arquivada com o dado como estava no corte dela."""
    ap, reex = [], {"conferidas": 0, "divergentes": [], "tolerancia": f"{TOL_REEXECUCAO} R$/MWh"}
    cache = {}
    for r in registros:
        if r.get("previsao") is None:
            continue
        e = cal.entrega_por_id(r["entrega"]["id"])
        y = v.realizado(info, e, r["submercado"])
        emitida_antes = cal.instante(r["emitido_em"]) < cal.local(e["inicio"])
        ap.append({"forecast_id": r["forecast_id"], "modelo": r["modelo"], "tipo": r["tipo"], "origem": r["origem"],
                   "horizonte": r["horizonte"], "submercado": r["submercado"], "entrega": e["id"],
                   "previsao": r["previsao"], "realizado": _r(y, 4), "erro": _r(r["previsao"] - y, 4) if y is not None else None,
                   "emitida_antes_da_entrega": emitida_antes, "no_prazo": not (r.get("atraso_min") or 0) > 0})
        if r["modelo"] == "B0" and r.get("features_usadas"):
            f = r["features_usadas"][0]
            chave = (r["submercado"], r["cutoff"])
            if chave not in cache:
                cache[chave] = _pontos_dict(cp, r["submercado"], r["cutoff"])
            refeito = _media_direta(cache[chave], date.fromisoformat(f["inicio"]), date.fromisoformat(f["fim"]))
            refeito_restr = None
            if refeito is not None:
                lims = r.get("limites") or {}
                refeito_restr, _ = mp.restringe(refeito, lims.get("piso_medio"), lims.get("teto_estrutural_medio"))
            reex["conferidas"] += 1
            if refeito_restr is None or abs(refeito_restr - r["previsao"]) > TOL_REEXECUCAO:
                reex["divergentes"].append({"forecast_id": r["forecast_id"], "arquivada": r["previsao"], "refeita": _r(refeito_restr, 4)})
    return ap, reex


def _revisoes(registros, run_atual=None, limite=None):
    """Sequência de previsões para a mesma entrega (modelo × entrega × submercado) entre
    rodadas: cada rodada nova aparece com a mudança em relação à anterior. Na gold vão só
    as entregas da rodada atual, com as últimas rodadas; o histórico completo está na
    coluna `mudanca` de previsoes_emissoes.csv."""
    grupos = defaultdict(list)
    for r in registros:
        if r.get("previsao") is not None:
            grupos[(r["modelo"], r["entrega"]["id"], r["submercado"])].append(r)
    alvo = {(r["modelo"], r["entrega"]["id"], r["submercado"]) for r in registros if r["run_id"] == run_atual}
    out = []
    for (mod, eid, sm), rs in sorted(grupos.items()):
        if run_atual is not None and (mod, eid, sm) not in alvo:
            continue
        rs = sorted(rs, key=lambda x: x["emitido_em"])
        seq, ant = [], None
        for x in rs:
            seq.append({"run_id": x["run_id"], "origem": x["origem"], "horizonte": x["horizonte"], "previsao": x["previsao"],
                        "mudanca": _r(x["previsao"] - ant, 4) if ant is not None else None})
            ant = x["previsao"]
        out.append({"modelo": mod, "entrega": eid, "submercado": sm, "rodadas": len(seq), "sequencia": seq[-limite:] if limite else seq})
    return out


def _ja_publicado(cp, run):
    """PLD já publicado pela CCEE para as horas depois do corte (dado, não previsão)."""
    if not run:
        return None
    corte = run["cutoff"]
    origem = date.fromisoformat(run["origem"])
    ini = f"{origem.isoformat()}T{cal.HORA_CORTE.hour:02d}:00"
    out = {"cutoff": corte, "origem": run["origem"], "natureza": "OBSERVADO",
           "nota": ("PLD publicado pela CCEE e capturado pelo observatório até o corte. É dado, não previsão, e não entra em "
                    "nenhuma entrega prevista (todas começam depois do dia de origem)."), "submercados": {}}
    for sm in cal.SUBMERCADOS:
        pts = [(r_, x) for r_, x in base.como_estava_em(cp, v.DS_PLD, f"pld.{sm}", corte) if r_ >= ini]
        cap = v.capturas_usadas(cp, v.DS_PLD, f"pld.{sm}", origem, origem + timedelta(days=3), corte)
        out["submercados"][sm] = {"horas": len(pts), "primeira": pts[0][0] if pts else None, "ultima": pts[-1][0] if pts else None,
                                  "media": _r(sum(x for _, x in pts) / len(pts)) if pts else None,
                                  "minimo": _r(min(x for _, x in pts)) if pts else None, "maximo": _r(max(x for _, x in pts)) if pts else None,
                                  "valores": [[r_, _r(x)] for r_, x in pts], "capturado_em": cap["capturado_em"]}
    return out


def _previsao_atual(registros, registro, rodadas):
    ref = [r for r in rodadas if "REFERENCIA_EXPERIMENTAL" in r["tipos"]]
    if not ref:
        return {"disponivel": False, "motivo": "Nenhuma rodada da referência experimental B0 registrada no arquivo."}
    run = ref[0]
    regs = [r for r in registros if r["run_id"] == run["run_id"] and r["modelo"] == "B0"]
    celulas = []
    for r in regs:
        celulas.append({"horizonte": r["horizonte"], "submercado": r["submercado"], "entrega": r["entrega"],
                        "previsao": r["previsao"], "status": r["status"], "motivo": r.get("motivo"), "quantis": r.get("quantis"),
                        "calibracao": (r.get("calibracao") or {}).get("status"), "limites": r.get("limites"),
                        "ajustada_ao_limite": r.get("ajustada_ao_limite"), "fracao_conhecida": r.get("fracao_conhecida"),
                        "periodo_usado": ({k: r["features_usadas"][0][k] for k in ("inicio", "fim", "capturado_em")}
                                          if r.get("features_usadas") else None),
                        "forecast_id": r["forecast_id"]})
    liberada = (registro.get("publicacao_resultados") or {}).get("liberada") is True
    return {
        "disponivel": any(x["previsao"] is not None for x in celulas), "rotulo": em.ROTULO_REF,
        "run_id": run["run_id"], "origem": run["origem"], "cutoff": run["cutoff"], "prazo": run["prazo"],
        "emitido_em": run["emitido_em"], "atraso_min": run["atraso_min"], "modo": run["modo"], "alertas": run["alertas"],
        "versao_codigo": run["versao_codigo"], "celulas": celulas,
        "bandas": ("Sem faixa: nenhum segmento do B0 está CALIBRADO no período de teste (ver calibração em P016)."
                   if not any(x["quantis"] for x in celulas) else "Faixa de 80% só nos segmentos CALIBRADO."),
        "candidatos": {"emitidos": liberada,
                       "motivo": (None if liberada else
                                  "C2-P e C2-H não são emitidos: a governança retém número de rodada interna dos candidatos até a "
                                  "liberação formal registrada no registro de modelos. O período prospectivo deles ainda não começou.")},
    }


# ---------------------------------------------------------------- fichas (P014)

def _fichas(registro, ajustes, reex):
    ult = defaultdict(dict)
    for a in ajustes:
        if a.get("k") != 1:
            continue
        chave = (a["modelo"], a["horizonte"], a["sm"])
        if not ult[a["modelo"]].get(chave) or a["origem_ajuste"] >= ult[a["modelo"]][chave]["origem_ajuste"]:
            ult[a["modelo"]][chave] = a
    fichas = []
    for m in registro["modelos"]:
        cod = m["codigo"]
        ficha = {
            "codigo": cod, "nome": m["nome"], "versao": m["versao"], "estado": m["estado"], "papel": m.get("papel"),
            "implementado_no_repositorio": bool(m.get("implementacao")),
            "motivo_sem_implementacao": m.get("motivo_sem_implementacao"),
            "entradas": m.get("features"), "formula": m.get("formula"),
            "transformacoes": None, "configuracao": None, "coeficientes_ultimo_ajuste": None,
            "corte": "07h00 de Brasília do dia de origem; dado como estava no corte; períodos elegíveis sob LAT1D",
            "hipoteses": ["LAT1D: dado elegível se o período terminou até 1 dia antes do corte (hipótese para o passado, sem data de "
                          "publicação histórica conhecida; na operação, conferida pela captura)."],
            "aprovacao": {"estado": m["estado"], "promovido_em": m.get("promovido_em"),
                          "referencia_experimental": bool((m.get("referencia_experimental") or {}).get("autorizada")),
                          "leitura": ("Em pesquisa: não alimenta a previsão principal. " +
                                      ("Autorizado como referência experimental identificada (seção 12.4), sem aprovação."
                                       if (m.get("referencia_experimental") or {}).get("autorizada") else ""))},
            "limitacoes": m.get("limitacoes"), "falhas_conhecidas": m.get("falhas_conhecidas"),
            "implementacao": m.get("implementacao"),
            "reproducao": None,
        }
        if cod in MODELOS_TESTE:
            ficha["configuracao"] = {"sha256": mp.sha_configuracao(), **{k: x for k, x in mp.configuracao().items()
                                                                        if k in ("grade_lambda", "min_treino_entregas",
                                                                                 "janela_residuos_entregas", "min_residuos_entregas",
                                                                                 "niveis_quantis", "k_media_movel", "dias_d7",
                                                                                 "dias_ear", "dias_ena", "serie_ear", "serie_ena",
                                                                                 "origem_de_ajuste", "criterio_lambda")}}
            ficha["transformacoes"] = {
                "B0": ["média das horas do último período completo elegível (semana ou mês)", "restrição à faixa de preço"],
                "S0": ["média das horas do mesmo período um ano antes da entrega", "restrição à faixa de preço"],
                "C2-P": ["variáveis de preço menos B0", "padronização pela escala RMS do treino", "regressão penalizada sobre y − B0",
                         "soma ao B0", "restrição à faixa de preço"],
                "C2-H": ["variáveis de preço menos B0, variação da EAR em 28 dias e ENA de 7 dias − 100",
                         "padronização pela escala RMS do treino", "regressão penalizada sobre y − B0", "soma ao B0",
                         "restrição à faixa de preço"],
            }[cod]
            ficha["reproducao"] = {
                "comando": "python3 pipeline/energia/executar_modulo.py previsoes --sem-coleta",
                "teste": "python3 -m unittest pipeline.tests.test_energia_previsoes",
                "tolerancia": f"{TOL_REEXECUCAO} R$/MWh (previsão gravada com 4 casas decimais)",
                "reexecucao_do_arquivo": reex if cod == "B0" else None,
            }
        if cod in CANDIDATOS:
            nomes = list(v.VARIAVEIS_H if cod == "C2-H" else v.VARIAVEIS_P)
            coefs = []
            for (mod, h, sm), a in sorted(ult[cod].items()):
                coefs.append({"horizonte": h, "submercado": sm, "origem_ajuste": a["origem_ajuste"].isoformat(), "ok": a.get("ok"),
                              "motivo": a.get("motivo"), "lambda": a.get("lambda"), "entregas_treino": a.get("entregas_treino"),
                              "coeficientes": {n: _r(x, 4) for n, x in zip(nomes, a.get("coef") or [])} if a.get("ok") else None})
            ficha["coeficientes_ultimo_ajuste"] = {"variaveis": [{"id": n, "rotulo": v.ROTULOS[n]} for n in nomes], "segmentos": coefs,
                                                   "leitura": "Coeficiente na unidade original: R$/MWh de correção por R$/MWh (ou por ponto percentual) da variável."}
        if cod == "C1":
            ficha["pesos_c1"] = None
            ficha["pesos_c1_motivo"] = m.get("motivo_sem_implementacao")
        fichas.append(ficha)
    return fichas


# ---------------------------------------------------------------- CSV

def _escreve_backtest(linhas, freq, nome):
    cab = ["origem", "horizonte", "submercado", "entrega", "periodo", "realizado", "b0", "s0", "c2p", "c2h",
           "b0_p10", "b0_p90", "s0_p10", "s0_p90", "c2p_p10", "c2p_p90", "c2h_p10", "c2h_p90", "piso", "teto", "faixa_provisoria"]
    rows = []
    for ln in sorted((x for x in linhas if x.freq == freq), key=lambda x: (x.origem, x.h, cal.SUBMERCADOS.index(x.sm))):
        q = ln.q
        rows.append([ln.origem.isoformat(), ln.h, ln.sm, ln.eid[1:], ln.periodo(), _r(ln.y), _r(ln.prev.get("B0")),
                     _r(ln.prev.get("S0")), _r(ln.prev.get("C2-P")), _r(ln.prev.get("C2-H"))]
                    + [_r((q.get(m) or {}).get(r)) for m in MODELOS_TESTE for r in ("p10", "p90")]
                    + [_r(ln.lo), _r(ln.hi), 1 if ln.provisoria else 0])
    base.escreve_csv(os.path.basename(nome), cab, rows)
    return len(rows)


def _escreve_desempenho(celulas, horizontes, frequencias):
    cab = ["modelo", "recorte", "horizonte", "submercado", "periodo", "linhas", "entregas", "origens", "mae", "vies", "rmse",
           "mae_b0_pareado", "ganho_vs_b0", "ganho_ic90_inf", "ganho_ic90_sup", "skill", "perda_quantilica", "cobertura_p10_p90",
           "cobertura_p05_p95", "largura_p10_p90", "calibracao"]
    rows = []
    for x in celulas + horizontes + frequencias:
        ic = x.get("ganho_ic90") or [None, None]
        rows.append([x["modelo"], x["recorte"], x["horizonte"], x["submercado"] or "", x["periodo"], x["linhas"], x["entregas"],
                     x["origens"], x["mae"], x["vies"], x["rmse"], x["mae_b0_pareado"], x["ganho_vs_b0"], ic[0], ic[1], x["skill"],
                     x["perda_quantilica"], x["cobertura_p10_p90"], x["cobertura_p05_p95"], x["largura_p10_p90"], x.get("calibracao") or ""])
    base.escreve_csv(os.path.basename(CSV_DESEMPENHO), cab, rows)


def _escreve_ajustes(ajustes):
    nomes = list(v.VARIAVEIS_H)
    cab = ["origem_ajuste", "modelo", "horizonte", "submercado", "ok", "motivo", "lambda", "entregas_treino", "linhas_treino"] \
        + [f"coef_{n}" for n in nomes] + [f"escala_{n}" for n in nomes] + ["ultimo_fim_treino"]
    rows = []
    for a in sorted((x for x in ajustes if x.get("k") == 1), key=lambda x: (x["origem_ajuste"], x["modelo"], x["horizonte"], x["sm"])):
        co = (a.get("coef") or []) + [None] * (len(nomes) - len(a.get("coef") or []))
        es = (a.get("escala_rms") or []) + [None] * (len(nomes) - len(a.get("escala_rms") or []))
        rows.append([a["origem_ajuste"].isoformat(), a["modelo"], a["horizonte"], a["sm"], 1 if a.get("ok") else 0,
                     a.get("motivo") or "", a.get("lambda") if a.get("ok") else "", a.get("entregas_treino"), a.get("linhas_treino")]
                    + [None if x is None else round(x, 6) for x in co] + [None if x is None else round(x, 6) for x in es]
                    + [a["ultimo_fim_treino"].isoformat() if a.get("ultimo_fim_treino") else ""])
    base.escreve_csv(os.path.basename(CSV_AJUSTES), cab, rows)


def _escreve_emissoes(registros, apur):
    por_id = {a["forecast_id"]: a for a in apur}
    mudanca = {}
    for grupo in _revisoes(registros):
        for x in grupo["sequencia"]:
            mudanca[(grupo["modelo"], grupo["entrega"], grupo["submercado"], x["run_id"])] = x["mudanca"]
    cab = ["forecast_id", "run_id", "tipo", "modelo", "versao_modelo", "origem", "cutoff", "prazo", "emitido_em", "atraso_min", "modo",
           "horizonte", "entrega", "submercado", "status", "previsao", "mudanca", "motivo", "realizado", "erro", "sha256"]
    rows = []
    for r in registros:
        a = por_id.get(r["forecast_id"]) or {}
        mud = mudanca.get((r["modelo"], r["entrega"]["id"], r["submercado"], r["run_id"]))
        rows.append([r["forecast_id"], r["run_id"], r["tipo"], r["modelo"], r.get("versao_modelo"), r["origem"], r["cutoff"],
                     r.get("prazo"), r["emitido_em"], r.get("atraso_min"), (r.get("execucao") or {}).get("modo") or "manual",
                     r["horizonte"], r["entrega"]["id"], r["submercado"], r["status"], r.get("previsao"), mud, r.get("motivo") or "",
                     a.get("realizado"), a.get("erro"), r["sha256"]])
    base.escreve_csv(os.path.basename(CSV_EMISSOES), cab, rows)


# ---------------------------------------------------------------- validações

def _valida(linhas, ajustes, info, cp, lim_final):
    """Controles antes de publicar (seção 5.2 do contrato). Devolve (críticas, testes)."""
    criticas, testes = [], []
    # contagem esperada: 28 células por origem
    por_origem = defaultdict(int)
    for ln in linhas:
        por_origem[ln.origem] += 1
    ruins = [o for o, n in por_origem.items() if n != 28]
    testes.append(ev.teste("28 células por origem (7 horizontes × 4 submercados)", "aprovado" if not ruins else "reprovado",
                           f"{len(por_origem)} origens; {len(ruins)} fora do esperado"))
    if ruins:
        criticas.append(f"origens com contagem inesperada: {ruins[:3]}")
    # sem olhar para o futuro no treino
    viol = [a for a in ajustes if a.get("ok") and a["ultimo_fim_treino"] > a["origem_ajuste"] - timedelta(days=a["k"])]
    testes.append(ev.teste("Treino do C2 só com entregas encerradas até o domingo de ajuste menos k dias",
                           "aprovado" if not viol else "reprovado", f"{sum(1 for a in ajustes if a.get('ok'))} ajustes; {len(viol)} violações"))
    if viol:
        criticas.append("ajuste com entrega posterior ao corte")
    # finitude, faixa e quantis ordenados
    fora, naofin, cruz = 0, 0, 0
    for ln in linhas:
        for mod, p in ln.prev.items():
            if p is None:
                continue
            if not math.isfinite(p):
                naofin += 1
            if (ln.lo is not None and p < ln.lo - 1e-9) or (ln.hi is not None and p > ln.hi + 1e-9):
                fora += 1
            q = ln.q.get(mod)
            if q:
                vals = [q[r] for r in mp.ROTULOS_NIVEIS]
                cruz += any(vals[i] > vals[i + 1] + 1e-9 for i in range(len(vals) - 1))
    testes.append(ev.teste("Previsões finitas, dentro da faixa de preço e quantis não cruzados",
                           "aprovado" if not (fora or naofin or cruz) else "reprovado",
                           f"fora da faixa: {fora}; não finitas: {naofin}; quantis cruzados: {cruz}"))
    if fora or naofin or cruz:
        criticas.append("previsão fora da faixa, não finita ou quantil cruzado")
    # realizado dentro dos limites vigentes (atos todos conhecidos)
    fora_r, n_r = 0, 0
    vistos = set()
    for ln in linhas:
        if ln.y is None or (ln.eid, ln.sm) in vistos:
            continue
        vistos.add((ln.eid, ln.sm))
        lo, hi, _, _ = lim_final.faixa({"id": ln.eid, "inicio": ln.inicio, "fim": ln.fim}, date(2100, 1, 1))
        n_r += 1
        if (lo is not None and ln.y < lo - 0.01) or (hi is not None and ln.y > hi + 0.01):
            fora_r += 1
    testes.append(ev.teste("Realizado de cada entrega dentro de [piso, teto estrutural] vigentes (tolerância R$ 0,01/MWh)",
                           "aprovado" if not fora_r else "ressalva", f"{n_r} entregas × submercado; {fora_r} fora"))
    # B0 recalculado por outro caminho (dicionário hora a hora, sem somas acumuladas)
    pontos = {sm: _pontos_dict(cp, sm, info.instante) for sm in cal.SUBMERCADOS}
    maxdif, n = 0.0, 0
    feitos = set()
    for ln in linhas:
        if ln.b0 is None or ln.h not in ("W1", "M1"):
            continue
        chave = (ln.origem, ln.freq, ln.sm)
        if chave in feitos:
            continue
        feitos.add(chave)
        if ln.freq == "W":
            ini = cal.ultima_semana_elegivel(ln.origem)
            fim = ini + timedelta(days=7)
        else:
            ini = cal.ultimo_mes_elegivel(ln.origem)
            fim = cal.soma_meses(ini, 1)
        d = _media_direta(pontos[ln.sm], ini, fim)
        n += 1
        maxdif = max(maxdif, abs(d - ln.b0) if d is not None else float("inf"))
    ok = maxdif <= 1e-6
    testes.append(ev.teste("B0 refeito hora a hora por outro caminho (sem somas acumuladas)", "aprovado" if ok else "reprovado",
                           f"{n} valores de B0; maior diferença {maxdif:.2e} R$/MWh (tolerância 1e-6)"))
    if not ok:
        criticas.append("B0 não confere com o recálculo independente")
    return criticas, testes, {"b0_conferidos": n, "b0_maior_diferenca": maxdif}


def _revisoes_hidro(cp):
    """Magnitude das revisões do ONS nas séries usadas pelo C2-H (risco de olhar o futuro no
    teste retrospectivo, que usa o snapshot)."""
    out = {}
    for ds, serie in ((v.DS_EAR, v.SERIE_EAR), (v.DS_ENA, v.SERIE_ENA)):
        rows = cp.execute(
            """SELECT o.serie, o.ref, MIN(o.valor), MAX(o.valor), COUNT(*) FROM observacoes o WHERE o.dataset=? AND o.serie LIKE ?
               GROUP BY o.serie, o.ref HAVING COUNT(DISTINCT o.valor) > 1""", (ds, f"{serie}.%")).fetchall()
        out[f"{ds}:{serie}"] = {"observacoes_revisadas": len(rows),
                               "maior_revisao": _r(max((b - a for _, _, a, b, _ in rows), default=None), 4),
                               "exemplos": [{"serie": s_, "ref": r_, "de": _r(a, 4), "para": _r(b, 4)} for s_, r_, a, b, _ in rows[:5]]}
    return out


# ---------------------------------------------------------------- evidência

def _evidencia_mae(met, snap, periodo, h, mod, info):
    if met is None or met.get("mae") is None:
        return None
    return ev.construir(
        indicador=f"Erro médio absoluto do {mod} no horizonte {h} ({periodo})",
        valor_exibido=f"R$ {met['mae']:.2f}/MWh".replace(".", ","),
        valor_calculo=met["mae"], unidade="R$/MWh",
        periodo={"inicio": "2025-01-01" if periodo == "teste" else "2022-01-01",
                 "fim": (info.ultima_hora.get("SE") or "")[:10] if periodo == "teste" else "2024-12-31"},
        entidade="quatro submercados (SE, S, NE, N)", universo=f"{met['linhas']} células, {met['entregas']} entregas distintas",
        fonte=_fonte_ccee(snap), chaves_origem=[f"pld.{sm}" for sm in cal.SUBMERCADOS],
        consulta=("previsoes_backtest_semanal.csv (ou _mensal): linhas com horizonte = "
                  f"{h}, periodo = {periodo}, coluna {mod.lower().replace('-', '')} e realizado preenchidos"),
        formula="MAE = média de |previsão − realizado| sobre as células (origem × submercado) do horizonte",
        numerador={"descricao": "soma de |previsão − realizado| (R$/MWh)", "valor": _r(met["mae"] * met["linhas"], 2)},
        denominador={"descricao": "células avaliadas", "valor": met["linhas"]},
        cobertura=f"origens diárias; {met['entregas']} entregas distintas com realizado completo",
        tratamento_ausencia="célula sem previsão ou sem realizado completo fica fora (nunca vira zero)",
        revisoes=snap.get("revisoes"),
        testes=[ev.teste("Treino e quantis só com entregas encerradas antes do corte (LAT1D)", "aprovado",
                         "conferido em cada ajuste (ultimo_fim_treino)")],
        reconciliacao=ev.reconciliacao("B0 refeito hora a hora por outro caminho e, no teste Python, por awk sobre o arquivo original "
                                       "da CCEE", "aprovado", "1e-6 R$/MWh no recálculo; 0,0001 R$/MWh contra o awk"),
        download=[{"rotulo": "Teste retrospectivo semanal (CSV)", "url": CSV_SEMANAL},
                  {"rotulo": "Teste retrospectivo mensal (CSV)", "url": CSV_MENSAL},
                  {"rotulo": "Métricas (CSV)", "url": CSV_DESEMPENHO}],
        reproducao="python3 pipeline/energia/executar_modulo.py previsoes --sem-coleta",
    )


# ---------------------------------------------------------------- construção da gold

def construir(con, ctx):
    cp = ctx.get("con_principal") or base.conecta()
    registro = em.le_registro()
    snap_pld = c.snapshot_de(cp, v.DS_PLD)
    snap_ear = c.snapshot_de(cp, v.DS_EAR)
    snap_ena = c.snapshot_de(cp, v.DS_ENA)
    caps = [x for x in (c.ultima_captura(snap_pld), c.ultima_captura(snap_ear), c.ultima_captura(snap_ena)) if x]
    if not caps or not snap_pld.get("capturas"):
        return c.stub(GOLD, "PLD horário ausente no silver principal")
    instante = max(caps)
    info = v.Informacao(cp, instante)
    ultimo = min((info.ultima_hora[sm] or "")[:10] for sm in cal.SUBMERCADOS)
    if not ultimo:
        return c.stub(GOLD, "PLD horário sem horas no silver")
    ultimo_dia = date.fromisoformat(ultimo)
    lim = em.limites()
    origens = av.origens_ate(ultimo_dia)
    ajustes = []
    linhas = av.executa(info, lim, origens, k=1, ajustes=ajustes)
    lim_final = em.limites()
    criticas, testes, conf = _valida(linhas, ajustes, info, cp, lim_final)
    if criticas:
        return c.stub(GOLD, "validação crítica: " + "; ".join(criticas))
    celulas, horizontes, frequencias = _metricas(linhas)
    selecao = _selecao(frequencias)
    limiares, regimes = _regimes(linhas)
    g23 = _g23([a for a in ajustes if a["k"] == 1], linhas)
    n_sem = _escreve_backtest(linhas, "W", CSV_SEMANAL)
    n_men = _escreve_backtest(linhas, "M", CSV_MENSAL)
    _escreve_desempenho(celulas, horizontes, frequencias)
    _escreve_ajustes(ajustes)
    ultima_entrega = max((ln.fim for ln in linhas if ln.y is not None and ln.periodo() == "teste"), default=None)
    del linhas
    sensib = _sensibilidade(info, lim, origens)

    # prospectivo: arquivo imutável
    registros_legado = arq.le_legado()
    registros_novos = [r for _, rs in sorted(arq.le_particoes().items()) for r in rs]
    registros = registros_legado + registros_novos
    viol_arq = arq.valida_particoes() + g.valida_arquivo(registros, {m["codigo"]: m for m in registro["modelos"]},
                                                         resultados_liberados=registro["publicacao_resultados"]["liberada"])
    if viol_arq:
        return c.stub(GOLD, "arquivo de emissões viola a governança: " + "; ".join(viol_arq[:5]))
    rodadas = _rodadas(registros)
    apur, reex = _apuracoes(registros, info, cp)
    if reex["divergentes"]:
        testes.append(ev.teste("Reexecução das previsões B0 arquivadas", "reprovado", json.dumps(reex["divergentes"][:3], ensure_ascii=False)))
    else:
        testes.append(ev.teste("Reexecução das previsões B0 arquivadas", "aprovado",
                               f"{reex['conferidas']} previsões refeitas com o dado como estava no corte; tolerância {TOL_REEXECUCAO} R$/MWh"))
    _escreve_emissoes(registros, apur)
    maturadas = [a for a in apur if a["realizado"] is not None and a["emitida_antes_da_entrega"]]
    prosp_met = None
    if maturadas:
        err = [a["erro"] for a in maturadas]
        prosp_met = {"entregas_apuradas": len({(a["entrega"], a["submercado"]) for a in maturadas}), "celulas": len(maturadas),
                     "mae": _r(sum(abs(e) for e in err) / len(err)), "vies": _r(sum(err) / len(err))}
    rotina = _rotina(rodadas, ctx.get("hoje") or date.today())
    atual = _previsao_atual(registros, registro, rodadas)
    atual["ja_publicado_no_corte"] = _ja_publicado(cp, next((r for r in rodadas if r["run_id"] == atual.get("run_id")), None))
    fichas = _fichas(registro, ajustes, reex)

    publicar = (registro.get("validacao_observatorio") or {}).get("publicar", True)
    kpis = {}
    if publicar:
        for per in ("teste",):
            for h in ("W1", "M1"):
                for mod in ("B0", "C2-P"):
                    met = next((x for x in horizontes if x["modelo"] == mod and x["horizonte"] == h and x["periodo"] == per), None)
                    e_ = _evidencia_mae(met, snap_pld, per, h, mod, info)
                    if e_:
                        kpis[f"mae_{mod.lower().replace('-', '')}_{h.lower()}_{per}"] = e_
    fonte_ccee = {"orgao": "CCEE", "dataset": "PLD_HORARIO", "recurso": "pld_horario_2021 a pld_horario_2026", "url_dataset": URL_CCEE,
                  "url_primaria": URL_CCEE, "licenca": c.LICENCA_CCEE}
    prov = c.proveniencia(
        indicador="Desempenho da previsão do PLD (teste retrospectivo e prospectivo)", natureza="CALCULADO", fonte=fonte_ccee,
        unidade="R$/MWh (erros); fração de 0 a 1 (coberturas)", frequencia="diária (origens); semanal e mensal (entregas)",
        periodo={"inicio": av.ORIGEM_INICIAL.isoformat(), "fim": ultimo_dia.isoformat()},
        cobertura={"inicio": cal.INICIO_PLD_HORARIO.isoformat(), "fim": ultimo_dia.isoformat()},
        capturado_em=c.ultima_captura(snap_pld), snapshot=snap_pld, publicacao_informada=False,
        transformacoes=["PLD horário → média por entrega (semana de sábado a sábado; mês civil)",
                        "variáveis sob LAT1D a partir do dado como estava no instante de informação",
                        "modelos B0, S0, C2-P, C2-H com treino só no passado", "restrição à faixa [piso, teto estrutural]",
                        "métricas por horizonte, submercado, período e regime"],
        formula="MAE = média |previsão − realizado|; viés = média (previsão − realizado); ganho = MAE(B0) − MAE(modelo) nas mesmas células",
        limitacoes=[
            "Teste retrospectivo é reconstrução sob a hipótese LAT1D: o sistema não tinha capturas nas origens antigas (primeira "
            "captura do PLD em 27/09/2026) e a CCEE não informa quando publicou cada hora (achado A09).",
            "EAR e ENA do ONS passam por consistência recorrente; o teste do C2-H usa o valor revisado, com risco de olhar o futuro.",
            "O período de desenvolvimento (2022 a 2024) já tinha sido examinado pela pesquisa antes da definição dos candidatos.",
            "Origens diárias vizinhas preveem a mesma entrega: o tamanho efetivo é o número de entregas distintas.",
            "Prospectivo ainda sem entrega apurada: nenhuma conclusão sobre desempenho em operação real.",
        ],
        download=CSV_DESEMPENHO)
    gold = {
        **c.cabecalho(GOLD),
        "paineis": ["P013", "P014", "P015", "P016"],
        "proveniencia": prov,
        "definicoes": {
            **{k: registro["definicoes"][k] for k in ("alvo", "realizado", "entregas", "conhecido_no_corte", "corte_operacional",
                                                      "cenario_de_elegibilidade", "quantis")},
            "erro": "Erro = previsão − realizado, em R$/MWh nominais. Viés positivo = o modelo superestimou o PLD em média.",
            "ganho": ("Ganho sobre o B0 = MAE do B0 − MAE do modelo nas mesmas células; positivo = melhor que a persistência. "
                      "Intervalo de 90% por bootstrap de blocos de 28 dias (semanal) ou 91 dias (mensal) de origens, com 1.000 réplicas."),
            "perda_quantilica": "Média, nos níveis 5, 10, 25, 50, 75, 90 e 95%, da perda de cada quantil (pinball), em R$/MWh.",
            "cobertura": ("Fração das células em que o realizado ficou entre P10 e P90 (nominal 80%) ou entre P5 e P95 (nominal 90%)."),
            "calibracao": (f"CALIBRADO quando a cobertura P10 a P90 fica entre {int(g.CALIBRACAO_MIN * 100)}% e {int(g.CALIBRACAO_MAX * 100)}% "
                           f"com pelo menos {g.CALIBRACAO_N_MIN} entregas distintas fora do ajuste (regra proposta na governança, a "
                           "ratificar). Contar entregas, e não origens, evita tratar como independentes as origens que preveem a mesma entrega."),
            "periodos": {"desenvolvimento": "entregas que terminam até 01/01/2025 00h (seleção de modelos)",
                         "teste": "entregas que começam em 01/01/2025 ou depois (teste final)",
                         "fronteira": "entregas que atravessam a virada ficam fora dos dois"},
        },
        "dados": {
            "instante_informacao": instante, "ultimo_dia_pld": ultimo, "origens": {"inicio": origens[0].isoformat(), "fim": origens[-1].isoformat(), "n": len(origens)},
            "snapshots": {ds: {"id": s.get("id"), "sha256": s.get("sha256"), "ultima_captura": c.ultima_captura(s),
                               "revisoes": (s.get("revisoes") or {}).get("total")} for ds, s in
                          ((v.DS_PLD, snap_pld), (v.DS_EAR, snap_ear), (v.DS_ENA, snap_ena))},
            "revisoes_hidrologia": _revisoes_hidro(cp),
            "ultima_entrega_apurada_teste": ultima_entrega.isoformat() if ultima_entrega else None,
            "linhas_csv": {"semanal": n_sem, "mensal": n_men},
            "configuracao_sha256": mp.sha_configuracao(),
            "configuracao_registrada_sha256": (registro.get("validacao_observatorio") or {}).get("configuracao_sha256"),
        },
        "modelos": [{"codigo": m["codigo"], "versao": m["versao"], "estado": m["estado"], "papel": m.get("papel"),
                     "avaliado": m["codigo"] in MODELOS_TESTE,
                     "motivo_sem_avaliacao": None if m["codigo"] in MODELOS_TESTE else m.get("motivo_sem_implementacao")}
                    for m in registro["modelos"]],
        "desempenho": ({"publicado": True, "por_horizonte": _enxuto(horizontes), "por_frequencia": _enxuto(frequencias),
                        "por_celula": _enxuto([x for x in celulas if x["periodo"] == "teste"]),
                        "por_celula_nota": ("Na gold, só o período de teste por célula; o desenvolvimento por célula está em "
                                            "previsoes_desempenho.csv.")}
                       if publicar else {"publicado": False, "motivo": "Publicação suspensa pelo responsável (validacao_observatorio.publicar = false)."}),
        "selecao": ({"regra": REGRA_SELECAO,
                     "por_frequencia": selecao,
                     "contaminacao": ("O desenvolvimento é exploratório: a pesquisa examinou 2023 e 2024 antes de definir os candidatos. O teste "
                                      "final (entregas desde 01/01/2025) não foi usado em nenhuma escolha de configuração, mas o mesmo autor "
                                      "escreveu o código e viu os resultados ao depurá-lo.")} if publicar else None),
        "regimes": {"nota": NOTA_REGIMES, "limiares": limiares, "resultados": regimes} if publicar else None,
        "sensibilidade_latencia": ({"descricao": ("MAE no período de teste com o dado disponível 1, 2 ou 3 dias depois do fim do período "
                                                  "(LAT1D é a regra; LAT2D e LAT3D simulam atraso de publicação)."), "resultados": sensib}
                                   if publicar else None),
        "g23_r1": g23 if publicar else None,
        "prospectivo": {
            "rodadas": rodadas[:LIMITE_RODADAS], "total_rodadas": len(rodadas), "registros": len(registros),
            "registros_por_tipo": {t: sum(1 for r in registros if r["tipo"] == t) for t in g.TIPOS_REGISTRO},
            "apuracoes": apur[-LIMITE_APURACOES:], "apuracoes_total": len(apur), "metricas": prosp_met,
            "leitura": ("Nenhuma entrega prevista pelo arquivo terminou ainda: não há desempenho prospectivo, e nada pode ser concluído "
                        "sobre a operação real." if not maturadas else
                        f"{prosp_met['celulas']} células apuradas; amostra prospectiva curta, sem inferência de ganho."),
            "revisoes_entre_rodadas": _revisoes(registros, atual.get("run_id"), LIMITE_SEQUENCIA),
            "reexecucao": reex,
        },
        "rotina": rotina,
        "previsao_atual": atual,
        "fichas": fichas,
        "governanca": _governanca(registro, g23, rotina, atual, conf),
        "evidencias": kpis,
        "validacoes": testes,
        "downloads": [{"rotulo": "Teste retrospectivo semanal (CSV)", "url": CSV_SEMANAL},
                      {"rotulo": "Teste retrospectivo mensal (CSV)", "url": CSV_MENSAL},
                      {"rotulo": "Métricas de desempenho (CSV)", "url": CSV_DESEMPENHO},
                      {"rotulo": "Coeficientes do C2 por origem de ajuste (CSV)", "url": CSV_AJUSTES},
                      {"rotulo": "Emissões registradas (CSV)", "url": CSV_EMISSOES}],
    }
    return gold


def _governanca(registro, g23, rotina, atual, conf):
    pend = {p["id"]: p for p in registro.get("pendencias", [])}
    ref = next(m for m in registro["modelos"] if m["codigo"] == "B0")["referencia_experimental"]
    itens = [
        {"item": "B0 como referência experimental identificada (seção 12.4)",
         "estado": "atendido" if atual.get("disponivel") else "aguardando rodada com dado",
         "evidencia": f"Recálculo independente de {conf['b0_conferidos']} valores de B0 (maior diferença {conf['b0_maior_diferenca']:.1e} R$/MWh); "
                      "cada registro guarda capturado_em ≤ corte.",
         "responsavel": "regra da especificação (sem aprovação adicional)"},
        {"item": "Faixas de incerteza publicáveis", "estado": "não atendido",
         "evidencia": "Nenhum segmento CALIBRADO no período de teste (ver por_celula.calibracao).",
         "responsavel": "método (aguarda amostra e calibração)"},
        {"item": "Gate V dos candidatos (pesquisa → validação)", "estado": "decisão pendente",
         "evidencia": ("Teste retrospectivo fora da amostra, comparação pareada com bootstrap por blocos, calibração medida e limitações "
                       "publicadas nesta gold; falta revisão independente ACEITO sem bloqueante."),
         "responsavel": "revisor independente"},
        {"item": "Liberação de número em rodada interna dos C2 (início do prospectivo)", "estado": "decisão pendente",
         "evidencia": "publicacao_resultados.liberada = false no registro de modelos.", "responsavel": "responsável pela plataforma"},
        {"item": "G4", "estado": pend.get("G4", {}).get("estado"), "evidencia": pend.get("G4", {}).get("descricao"),
         "responsavel": pend.get("G4", {}).get("responsavel")},
        {"item": "G23-R1", "estado": pend.get("G23-R1", {}).get("estado"),
         "evidencia": (f"Coeficiente de d7 − B0 acima de 1 em {g23['coeficiente_d7']['acima_de_1']} de {g23['coeficiente_d7']['ajustes_ok']} "
                       "ajustes; previsões brutas fora da faixa contadas por modelo e frequência.") if g23 else pend.get("G23-R1", {}).get("descricao"),
         "responsavel": pend.get("G23-R1", {}).get("responsavel")},
        {"item": "Gate P (validação → produção)", "estado": "não aplicável ainda",
         "evidencia": "Exige período prospectivo com rodadas registradas antes do realizado (proposta: 12 origens semanais) e aprovação do dono.",
         "responsavel": "responsável pela plataforma"},
        {"item": "Rotina diária comprovada", "estado": "comprovada" if rotina["comprovada"] else "não comprovada",
         "evidencia": rotina["leitura"], "responsavel": "execuções agendadas registradas"},
    ]
    return {
        "estados": "PESQUISA e VALIDAÇÃO nunca alimentam a previsão principal; só PRODUÇÃO. Nenhum modelo está em PRODUÇÃO.",
        "referencia_experimental": ref,
        "pendencias": registro.get("pendencias", []),
        "decisao_revisavel": itens,
        "achados": {
            "A08": {"estado": ("corrigido no código; aguarda rodada agendada real no prazo" if not rotina["execucoes_agendadas"] else
                               "em verificação pelas rodadas agendadas"),
                    "diagnostico": ("A rodada interna de 27/09/2026 teve 28 células sem número porque, no corte das 07h, o sistema ainda não "
                                    "tinha nenhuma captura do PLD (a primeira é das 15h44 UTC daquele dia); e foi emitida às 19h10 UTC, "
                                    "depois do prazo. Reproduzido: como_estava_em no corte de 27/09 não devolve nenhuma hora."),
                    "correcao": ("Emissão a partir do dado como estava no corte, com verificação e retentativa de coleta antes das 07h, "
                                 "espera até o corte, registro do atraso e da falha, e workflow agendado (previsao-pld.yml)."),
                    "confirmacao": rotina["leitura"]},
            "A09": {"estado": "distinção mantida; hipótese LAT1D documentada e com sensibilidade",
                    "leitura": ("A data de publicação de cada hora do PLD continua desconhecida; a primeira captura observada não é "
                                "publicação. O teste retrospectivo é reconstrução sob LAT1D, separado do prospectivo; a sensibilidade a "
                                "LAT2D e LAT3D está em sensibilidade_latencia. Na operação, a emissão só usa o que foi capturado até o corte."),
                    "detalhe": "public/energia/gold/pld_detalhe.json, achado A09 (capturas diretas e folga sob LAT1D)"},
        },
    }
