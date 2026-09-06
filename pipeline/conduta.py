"""Conduta e enforcement — gold conduta.json.

Três réguas, declaradas e nunca somadas:
1. **PAS do BCB** (Gepad): decisões de 1ª e 2ª instância por apenado, com tipo de
   penalidade, multa, recurso e situação da cobrança; inabilitados e proibidos vigentes.
2. **PAS da CVM**: processos por ano de abertura, área instrutora, fase atual, acusados
   por processo e tempo até a última movimentação. A base traz a fase, não o resultado.
3. **Reclamações** (BCB, ranking trimestral): índice mediano entre as instituições,
   já coletado pelo pipeline.

Regra editorial, herdada da avaliação de 05/09: nunca ranking por instituição. Volume
de processos não é irregularidade; decisão não é conduta; multa aplicada não é multa
paga. As listas nominais são cronológicas (decisões e processos mais recentes), nunca
ordenadas por valor ou por quantidade por nome.
"""
import statistics
from datetime import date

from pipeline import common
from pipeline.fmt import _r, _share

FONTES = {
    "bcb": {"nome": "BCB — Processos administrativos sancionadores (Gepad, API Olinda)", "url": "https://olinda.bcb.gov.br/olinda/servico/Gepad_QuadroPenalidades/versao/v1/odata/",
            "catalogo": "https://dadosabertos.bcb.gov.br/dataset/processo-administrativo-sancionador---penalidades-aplicadas", "licenca": "dados abertos do BCB", "nivel": "A — quadro oficial de decisões, atualizado continuamente"},
    "cvm": {"nome": "CVM — Processos administrativos sancionadores (dados abertos)", "url": "https://dados.cvm.gov.br/dados/PROCESSO/SANCIONADOR/DADOS/processo_sancionador.zip",
            "catalogo": "https://dados.cvm.gov.br/dataset/processo-sancionador", "licenca": "dados abertos da CVM", "nivel": "A — registro administrativo, processo a processo"},
    "reclamacoes": {"nome": "BCB — Ranking de reclamações (trimestral)", "url": "https://www.bcb.gov.br/estabilidadefinanceira/rankingreclamacoes",
                    "catalogo": "https://dadosabertos.bcb.gov.br/dataset/ranking-de-reclamacoes", "licenca": "dados abertos do BCB", "nivel": "A — divulgação oficial trimestral"},
}
PENAS = ["MULTA", "INABILITAÇÃO", "ADVERTÊNCIA", "PROIBIÇÃO PARA ATUAR", "PROIBIÇÃO DE ATIV/OP", "ADMOESTAÇÃO", "DEVOLVER SUBVENÇÃO", "NÃO HOUVE PENALIDADE"]


def _menos_meses(n):
    hoje = date.today()
    y, m = hoje.year, hoje.month - n
    while m <= 0:
        y, m = y - 1, m + 12
    return f"{y}-{m:02d}-{hoje.day:02d}"


def _pena_final(p1, p2):
    """Penalidade que vale: a de 2ª instância quando houve decisão nela, senão a de 1ª."""
    return p2 or p1


# ---------------------------------------------------------------- BCB
def _bcb(con):
    try:
        n = con.execute("SELECT COUNT(*) FROM bcb_pas_decisao").fetchone()[0]
    except Exception:
        n = 0
    if not n:
        return {"disponivel": False}
    rows = con.execute("SELECT pas, nome, pessoa, citacao, decisao1_data, pena1, multa1, recurso, decisao2_data, pena2, multa2, situacao, duracao1, duracao2 FROM bcb_pas_decisao").fetchall()
    ult = max(r[4] for r in rows if r[4])
    ini12 = _menos_meses(12)
    ini12_ant = _menos_meses(24)
    anual = {}
    for pas, nome, pessoa, cit, d1, p1, m1, rec, d2, p2, m2, sit, du1, du2 in rows:
        if not d1:
            continue
        a = anual.setdefault(d1[:4], {"ano": d1[:4], "decisoes": 0, "processos": set(), "multas_n": 0, "multas_valor": 0.0, "inabilitacoes": 0, "sem_penalidade": 0, "recursos": 0, "pf": 0, "pj": 0})
        a["decisoes"] += 1; a["processos"].add(pas)
        pf = _pena_final(p1, p2)
        if pf == "MULTA":
            a["multas_n"] += 1; a["multas_valor"] += (m2 if (p2 == "MULTA" and m2 is not None) else (m1 or 0))
        if pf == "INABILITAÇÃO":
            a["inabilitacoes"] += 1
        if pf == "NÃO HOUVE PENALIDADE":
            a["sem_penalidade"] += 1
        if rec == "SIM":
            a["recursos"] += 1
        if pessoa == "PF":
            a["pf"] += 1
        elif pessoa == "PJ":
            a["pj"] += 1
    anual = [dict(a, processos=len(a["processos"]), incompleto=a["ano"] == ult[:4], recurso_share=_share(a["recursos"], a["decisoes"]), sem_penalidade_share=_share(a["sem_penalidade"], a["decisoes"]))
             for a in sorted(anual.values(), key=lambda x: x["ano"])]
    def janela(ini, fim=None):
        sel = [r for r in rows if r[4] and r[4] >= ini and (fim is None or r[4] < fim)]
        multas = [((r[10] if (r[9] == "MULTA" and r[10] is not None) else r[6]) or 0) for r in sel if _pena_final(r[5], r[9]) == "MULTA"]
        return {"decisoes": len(sel), "processos": len({r[0] for r in sel}), "multas_n": len(multas), "multas_valor": sum(multas),
                "multa_mediana": _r(statistics.median(multas)) if multas else None, "multa_p90": _r(sorted(multas)[int(len(multas) * 0.9)]) if len(multas) >= 10 else None,
                "inabilitacoes": sum(1 for r in sel if _pena_final(r[5], r[9]) == "INABILITAÇÃO"), "sem_penalidade": sum(1 for r in sel if _pena_final(r[5], r[9]) == "NÃO HOUVE PENALIDADE"),
                "recursos": sum(1 for r in sel if r[7] == "SIM"), "pj": sum(1 for r in sel if r[2] == "PJ"), "pf": sum(1 for r in sel if r[2] == "PF")}
    j12, j12_ant = janela(ini12), janela(ini12_ant, ini12)
    penas = {}
    sit = {}
    for r in rows:
        if r[4] and r[4] >= ini12:
            penas[_pena_final(r[5], r[9]) or "não informada"] = penas.get(_pena_final(r[5], r[9]) or "não informada", 0) + 1
            sit[r[11] or "não informada"] = sit.get(r[11] or "não informada", 0) + 1
    # cobrança das multas (acervo inteiro): paga, em cobrança, vencida e não paga, parcelada
    cob = {}
    for r in rows:
        if _pena_final(r[5], r[9]) == "MULTA":
            cob[r[11] or "não informada"] = cob.get(r[11] or "não informada", 0) + 1
    tot_cob = sum(cob.values())
    # tempo citação → decisão de 1ª instância (meses), últimos 3 anos
    tempos = []
    for r in rows:
        if r[3] and r[4] and r[4] >= _menos_meses(36):
            try:
                y1, m1_, d1_ = map(int, r[3][:10].split("-")); y2, m2_, d2_ = map(int, r[4][:10].split("-"))
                tempos.append((y2 - y1) * 12 + (m2_ - m1_) + (d2_ - d1_) / 30)
            except ValueError:
                pass
    recentes = [{"pas": r[0], "nome": r[1], "pessoa": r[2], "decisao": r[4], "pena": _pena_final(r[5], r[9]), "multa": (r[10] if (r[9] == "MULTA" and r[10] is not None) else r[6]), "recurso": r[7], "situacao": r[11]}
                for r in sorted([x for x in rows if x[4]], key=lambda x: x[4], reverse=True)[:40]]
    inab = con.execute("SELECT prazo_anos, COUNT(*), SUM(fim BETWEEN ? AND ?) FROM bcb_pas_inabilitado GROUP BY prazo_anos ORDER BY prazo_anos", (date.today().isoformat(), _menos_meses(-12))).fetchall()
    n_inab = sum(k for _p, k, _e in inab)
    proib = con.execute("SELECT COUNT(*) FROM bcb_pas_proibido").fetchone()[0]
    return {
        "disponivel": True, "ultima_decisao": ult, "primeira_decisao": min(r[4] for r in rows if r[4]), "acervo": {"decisoes": n, "processos": len({r[0] for r in rows}), "apenados_distintos": len({r[1] for r in rows})},
        "janela_12m": {"ini": ini12, **j12}, "janela_12m_anterior": j12_ant,
        "penas_12m": sorted([{"pena": p, "n": k, "share": _share(k, j12["decisoes"])} for p, k in penas.items()], key=lambda x: -x["n"]),
        "situacao_12m": sorted([{"situacao": p, "n": k, "share": _share(k, j12["decisoes"])} for p, k in sit.items()], key=lambda x: -x["n"]),
        "cobranca_multas": sorted([{"situacao": p, "n": k, "share": _share(k, tot_cob)} for p, k in cob.items()], key=lambda x: -x["n"]),
        "tempo_citacao_decisao_meses": {"mediana": _r(statistics.median(tempos), 1) if tempos else None, "p90": _r(sorted(tempos)[int(len(tempos) * 0.9)], 1) if len(tempos) >= 10 else None, "n": len(tempos)},
        "anual": anual[-14:], "recentes": recentes,
        "inabilitados": {"vigentes": n_inab, "por_prazo": [{"prazo_anos": p, "n": k, "encerram_12m": e or 0} for p, k, e in inab], "encerram_12m": sum(e or 0 for _p, _k, e in inab)},
        "proibidos_vigentes": proib,
        "nota": ("Uma linha por apenado e decisão. A penalidade que vale é a de 2ª instância quando existe; multa aplicada não é multa paga (a situação da cobrança está à parte). "
                 "Pessoa física é o CPF mascarado; pessoa jurídica é o CNPJ. Sem ranking por nome: a lista é cronológica."),
    }


# ---------------------------------------------------------------- CVM
def _cvm(con):
    try:
        n = con.execute("SELECT COUNT(*) FROM cvm_pas_processo").fetchone()[0]
    except Exception:
        n = 0
    if not n:
        return {"disponivel": False}
    rows = con.execute("SELECT nup, objeto, abertura, area, fase, subfase, local, ultima_mov FROM cvm_pas_processo").fetchall()
    acus = {}
    for nup, k in con.execute("SELECT nup, COUNT(DISTINCT nome) FROM cvm_pas_acusado GROUP BY nup"):
        acus[nup] = k
    ult = max(r[2] for r in rows if r[2])
    anual = {}
    for nup, obj, ab, area, fase, sub, loc, um in rows:
        if not ab:
            continue
        a = anual.setdefault(ab[:4], {"ano": ab[:4], "processos": 0, "finalizados": 0, "acusados": 0})
        a["processos"] += 1; a["acusados"] += acus.get(nup, 0)
        if fase == "Finalizado":
            a["finalizados"] += 1
    anual = [dict(a, incompleto=a["ano"] == ult[:4], finalizados_share=_share(a["finalizados"], a["processos"])) for a in sorted(anual.values(), key=lambda x: x["ano"])]
    fases, areas = {}, {}
    for r in rows:
        fases[r[4] or "não informada"] = fases.get(r[4] or "não informada", 0) + 1
        areas[r[3] or "não informada"] = areas.get(r[3] or "não informada", 0) + 1
    # duração: abertura → última movimentação dos finalizados (meses)
    dur = []
    for r in rows:
        if r[4] == "Finalizado" and r[2] and r[7]:
            y1, m1, d1 = map(int, r[2][:10].split("-")); y2, m2, d2 = map(int, r[7][:10].split("-"))
            dur.append((y2 - y1) * 12 + (m2 - m1) + (d2 - d1) / 30)
    em_curso = [r for r in rows if r[4] != "Finalizado"]
    idade = []
    hoje = date.today()
    for r in em_curso:
        if r[2]:
            y1, m1, _d = map(int, r[2][:10].split("-")); idade.append((hoje.year - y1) * 12 + (hoje.month - m1))
    ini12 = _menos_meses(12)
    abertos_12m = [r for r in rows if r[2] and r[2] >= ini12]
    recentes = [{"nup": r[0], "abertura": r[2], "area": r[3], "fase": r[4], "local": r[6], "ultima_mov": r[7], "acusados": acus.get(r[0], 0), "objeto": (r[1] or "")[:220]}
                for r in sorted([x for x in rows if x[2]], key=lambda x: x[2], reverse=True)[:30]]
    return {
        "disponivel": True, "ultima_abertura": ult, "ultima_movimentacao": max(r[7] for r in rows if r[7]), "acervo": {"processos": n, "acusados": sum(acus.values()), "em_curso": len(em_curso), "finalizados": n - len(em_curso)},
        "abertos_12m": {"ini": ini12, "processos": len(abertos_12m), "acusados": sum(acus.get(r[0], 0) for r in abertos_12m)},
        "fases": sorted([{"fase": f, "n": k, "share": _share(k, n)} for f, k in fases.items()], key=lambda x: -x["n"]),
        "areas": sorted([{"area": f, "n": k, "share": _share(k, n)} for f, k in areas.items()], key=lambda x: -x["n"]),
        "duracao_finalizados_meses": {"mediana": _r(statistics.median(dur), 1) if dur else None, "p90": _r(sorted(dur)[int(len(dur) * 0.9)], 1) if len(dur) >= 10 else None, "n": len(dur)},
        "idade_em_curso_meses": {"mediana": _r(statistics.median(idade), 1) if idade else None, "acima_36": sum(1 for x in idade if x > 36), "n": len(idade)},
        "acusados_por_processo": _r(sum(acus.values()) / n, 1) if n else None,
        "anual": anual[-14:], "recentes": recentes,
        "nota": ("Processo a processo, com a fase atual e os acusados. A base não traz o resultado (absolvição, multa, termo de compromisso): 'finalizado' é o fim do rito. "
                 "Objeto reproduzido como publicado pela CVM, truncado. Sem ranking por nome."),
    }


# ---------------------------------------------------------------- reclamações
def _reclamacoes(con):
    try:
        rows = con.execute("SELECT ano, trimestre, indice FROM reclamacoes WHERE indice IS NOT NULL ORDER BY ano, trimestre").fetchall()
    except Exception:
        rows = []
    if not rows:
        return {"disponivel": False}
    por = {}
    for a, t, i in rows:
        por.setdefault(f"{a}-{t}", []).append(i)
    serie = [{"periodo": k, "mediana": _r(statistics.median(v)), "p90": _r(sorted(v)[int(len(v) * 0.9)]) if len(v) >= 10 else None, "n_instituicoes": len(v)} for k, v in sorted(por.items())]
    return {"disponivel": True, "serie": serie[-24:], "ultimo": serie[-1],
            "nota": "índice de reclamações (reclamações procedentes por milhão de clientes) do ranking trimestral do BCB; mediana e p90 entre as instituições do ranking, sem nome."}


# ---------------------------------------------------------------- build
def build(con, cfg=None):
    bcb = _bcb(con)
    cvm = _cvm(con)
    rec = _reclamacoes(con)
    if not bcb.get("disponivel") and not cvm.get("disponivel"):
        return {"disponivel": False, "motivo": "silver sem PAS do BCB nem da CVM — coleta ainda não rodou"}
    frases = []
    if bcb.get("disponivel"):
        j = bcb["janela_12m"]
        frases.append(f"Nos últimos 12 meses o BCB decidiu {j['processos']} processos sancionadores em 1ª instância, com {j['decisoes']} decisões por apenado: "
                      f"{j['multas_n']} multas somando R$ {j['multas_valor'] / 1e6:.1f} milhões (mediana R$ {j['multa_mediana'] / 1e3:.0f} mil), {j['inabilitacoes']} inabilitações e "
                      f"{j['sem_penalidade']} decisões sem penalidade; {j['recursos']} apenados recorreram. {bcb['inabilitados']['vigentes']} pessoas seguem inabilitadas.")
    if cvm.get("disponivel"):
        a = cvm["abertos_12m"]
        frases.append(f"A CVM abriu {a['processos']} processos sancionadores em 12 meses ({a['acusados']} acusados); {cvm['acervo']['em_curso']} seguem em curso, "
                      f"com idade mediana de {cvm['idade_em_curso_meses']['mediana']:.0f} meses, e os finalizados levaram {cvm['duracao_finalizados_meses']['mediana']:.0f} meses em mediana.")
    if rec.get("disponivel"):
        frases.append(f"Índice mediano de reclamações no ranking do BCB: {rec['ultimo']['mediana']} em {rec['ultimo']['periodo']}.")
    return {
        "disponivel": True, "gerado_em": common.now_utc(), "fontes": FONTES, "sintese": " ".join(frases),
        "bcb": bcb, "cvm": cvm, "reclamacoes": rec,
        "catalogo": [
            {"id": "decisoes", "nome": "Decisões de PAS (BCB)", "definicao": "decisões de 1ª instância por apenado, pela data da decisão; penalidade final = 2ª instância quando existe", "unidade": "decisões", "fonte": "BCB/Gepad", "limitacoes": "uma pessoa pode ter várias decisões; decisão não é conduta"},
            {"id": "multas", "nome": "Multas aplicadas", "definicao": "soma e mediana das multas nas decisões com penalidade final de multa", "unidade": "R$", "fonte": "BCB/Gepad", "limitacoes": "aplicada, não paga; a cobrança tem situação própria"},
            {"id": "tempo", "nome": "Tempo citação → decisão", "definicao": "meses entre a citação e a decisão de 1ª instância, decisões dos últimos 36 meses", "unidade": "meses", "fonte": "calculado", "limitacoes": "só processos já decididos: censura à direita"},
            {"id": "processos_cvm", "nome": "Processos sancionadores (CVM)", "definicao": "processos por ano de abertura, fase atual e acusados", "unidade": "processos", "fonte": "CVM", "limitacoes": "sem resultado estruturado; 'finalizado' é o fim do rito"},
            {"id": "reclamacoes", "nome": "Índice de reclamações", "definicao": "mediana e p90 do índice entre as instituições do ranking trimestral", "unidade": "por milhão de clientes", "fonte": "BCB", "limitacoes": "só instituições com mais de 4 milhões de clientes entram no ranking"},
        ],
        "cautelas": [
            "Volume de processos não é irregularidade e decisão não é conduta: o painel lê o enforcement como fluxo do sistema, e por regra editorial não ordena instituições por multa, processo ou reclamação.",
            "PAS do BCB, PAS da CVM e reclamações são três réguas; não se somam. As listas nominais são cronológicas.",
            "Multa aplicada não é multa paga: a situação da cobrança (paga, transferida, vencida, parcelada) está declarada à parte.",
            "O tempo entre citação e decisão só conta processos já decididos; processos longos ainda abertos ficam fora (censura à direita).",
            "A base da CVM traz a fase do rito, não o resultado; absolvições, multas e termos de compromisso estão nos julgamentos em texto, fora da Fase 0.",
        ],
        "metodo": ("Quadros do BCB pela API Olinda (acervo inteiro a cada coleta); zip da CVM (processo e acusados); ranking de reclamações já coletado. "
                   "Agregação em Python (stdlib) por ano e por janela de 12 meses fechada na data da coleta; sem estimativa."),
    }
