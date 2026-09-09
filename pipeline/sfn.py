"""Entrantes e saídas do SFN — gold sfn.json.

Três réguas, declaradas e nunca somadas:
1. **Cadastro** (BCB/Unicad, Olinda): quem está autorizado e em funcionamento HOJE, por
   grupo, segmento, UF e, nas cooperativas, por sistema. O cadastro não tem data de
   início: a série de entradas e saídas nasce com a primeira coleta e cresce daí em
   diante (`sfn_hist`), com nomes.
2. **Lista do IF.data** (BCB, trimestral desde 2015): códigos presentes na relação do
   resumo em cada trimestre (`ifdata_universo`, com ou sem balanço entregue) e quem de
   fato entregou o Ativo Total (`institution_metrics`). Entrada = PRIMEIRO trimestre em
   que o código aparece em toda a série; saída = trimestre seguinte ao ÚLTIMO em que
   aparece, sem retorno. Faltar um trimestre e voltar é ausência temporária; constar da
   lista com saldo nulo (atraso, RAET, retardatário) é "na lista sem balanço". Nenhum
   dos dois é entrada ou saída. Comparar só dois trimestres vizinhos, como o painel
   fazia até 09/2026, transformava um atraso de entrega em "saída" seguida de
   "entrada" (ABN AMRO em 4T 2025, Neon em 2T 2025).
   A data de início de atividade do cadastro do IF.data separa entrada de instituição
   nova (até 12 meses) de instituição antiga com código novo; o cruzamento do CNPJ
   (próprio ou líder) com o Unicad diz se quem saiu segue autorizado hoje.
   Sem `ifdata_universo` para todos os trimestres, a régua cai para "resumo entregue",
   com as mesmas definições de primeira e última presença.
3. **Regimes de resolução** (BCB, Olinda): as saídas forçadas, com data e tipo.

Regras: ausência é nulo; o trimestre mais recente do IF.data pode estar incompleto
(retardatários) e uma "saída" nele é provisória, declarada como tal; posições e
contagens são do dia da coleta; nada é estimado.
"""
from pipeline import common
from pipeline.fmt import _r, _share

FONTES = {
    "cadastro": {"nome": "BCB — Relação de instituições em funcionamento (Unicad, API Olinda)", "url": "https://olinda.bcb.gov.br/olinda/servico/Instituicoes_em_funcionamento/versao/v1/odata/",
                 "catalogo": "https://dadosabertos.bcb.gov.br/dataset/relacao-de-instituicoes-em-funcionamento-no-pais", "licenca": "dados abertos do BCB", "nivel": "A — cadastro oficial, posição do dia"},
    "ifdata": {"nome": "BCB — IF.data (cadastro e resumo trimestral)", "url": "https://olinda.bcb.gov.br/olinda/servico/IFDATA/versao/v1/odata/",
               "catalogo": "https://dadosabertos.bcb.gov.br/dataset/ifdata---dados-selecionados-de-instituies-financeiras", "licenca": "dados abertos do BCB", "nivel": "A — relatório regulatório trimestral"},
    "regimes": {"nome": "BCB — Regimes de resolução (API Olinda)", "url": "https://olinda.bcb.gov.br/olinda/servico/regimes_especiais/versao/v1/odata/",
                "catalogo": "https://dadosabertos.bcb.gov.br/dataset/regimes-especiais", "licenca": "dados abertos do BCB", "nivel": "A — lista oficial vigente, diária"},
}
TCB = {"B1": "Banco comercial ou múltiplo com carteira comercial", "B2": "Banco múltiplo sem carteira comercial ou de investimento", "B3S": "Cooperativa singular",
       "B3C": "Cooperativa central ou confederação", "B4": "Banco de desenvolvimento", "N1": "Não bancário de crédito (SCFI, SCD, SAM, SCM...)",
       "N2": "Não bancário de mercado de capitais (corretoras, DTVM)", "N3": "Não bancário, outros", "N4": "Instituição de pagamento"}
GRUPO_ORDEM = ["Bancos", "Cooperativas de crédito", "Instituições de pagamento", "Fintechs de crédito", "Financeiras e crédito especializado",
               "Mercado de capitais e câmbio", "Fomento e desenvolvimento", "Consórcios", "Outros"]
GRUPO_COR = {"Bancos": "#1d4e89", "Cooperativas de crédito": "#2f7d4f", "Instituições de pagamento": "#b45309", "Fintechs de crédito": "#6b46a3",
             "Financeiras e crédito especializado": "#0e7c7b", "Mercado de capitais e câmbio": "#8d5a2b", "Fomento e desenvolvimento": "#4b5563", "Consórcios": "#9a3412", "Outros": "#6b7280"}
REGIOES = {"AC": "Norte", "AP": "Norte", "AM": "Norte", "PA": "Norte", "RO": "Norte", "RR": "Norte", "TO": "Norte",
           "AL": "Nordeste", "BA": "Nordeste", "CE": "Nordeste", "MA": "Nordeste", "PB": "Nordeste", "PE": "Nordeste", "PI": "Nordeste", "RN": "Nordeste", "SE": "Nordeste",
           "ES": "Sudeste", "MG": "Sudeste", "RJ": "Sudeste", "SP": "Sudeste", "PR": "Sul", "RS": "Sul", "SC": "Sul", "DF": "Centro-Oeste", "GO": "Centro-Oeste", "MT": "Centro-Oeste", "MS": "Centro-Oeste"}
SISTEMAS = [("SICOOB", "Sicoob"), ("SICREDI", "Sicredi"), ("CRESOL", "Cresol"), ("UNICRED", "Unicred"), ("AILOS", "Ailos"), ("CREDISIS", "CrediSIS"), ("UNIPRIME", "Uniprime")]


def _sistema(filiacao, nome):
    txt = f"{filiacao or ''} {nome or ''}".upper()
    for chave, rot in SISTEMAS:
        if chave in txt:
            return rot
    return "Independente ou outra central" if not filiacao else "Outras centrais"


# ---------------------------------------------------------------- cadastro (Unicad)
def _cadastro(con):
    try:
        n = con.execute("SELECT COUNT(*) FROM sfn_sedes").fetchone()[0]
    except Exception:
        n = 0
    if not n:
        return {"disponivel": False}
    data = con.execute("SELECT MAX(coletado_em) FROM sfn_sedes").fetchone()[0]
    grupos = {}
    for g, s, k in con.execute("SELECT grupo, segmento, COUNT(*) FROM sfn_sedes GROUP BY grupo, segmento ORDER BY 3 DESC"):
        grupos.setdefault(g, {"grupo": g, "cor": GRUPO_COR.get(g), "n": 0, "segmentos": []})
        grupos[g]["n"] += k
        grupos[g]["segmentos"].append({"segmento": s, "n": k})
    grupos = sorted(grupos.values(), key=lambda x: GRUPO_ORDEM.index(x["grupo"]) if x["grupo"] in GRUPO_ORDEM else 99)
    for g in grupos:
        g["share"] = _share(g["n"], n)
    ufs = [{"uf": u, "regiao": REGIOES.get(u), "n": k, "bancos": b, "cooperativas": c, "ips": i, "fintechs": f}
           for u, k, b, c, i, f in con.execute("""SELECT uf, COUNT(*), SUM(grupo='Bancos'), SUM(grupo='Cooperativas de crédito'), SUM(grupo='Instituições de pagamento'),
                                                    SUM(grupo='Fintechs de crédito') FROM sfn_sedes WHERE uf IS NOT NULL GROUP BY uf ORDER BY 2 DESC""")]
    regioes = {}
    for u in ufs:
        r = regioes.setdefault(u["regiao"], {"regiao": u["regiao"], "n": 0, "cooperativas": 0, "bancos": 0})
        r["n"] += u["n"]; r["cooperativas"] += u["cooperativas"]; r["bancos"] += u["bancos"]
    regioes = sorted([dict(x, share=_share(x["n"], n)) for x in regioes.values()], key=lambda x: -x["n"])
    # cooperativas por sistema, classe, categoria e critério de associação
    coops = con.execute("SELECT nome, classe, associacao, categoria, filiacao, uf FROM sfn_sedes WHERE grupo='Cooperativas de crédito'").fetchall()
    por_sistema, por_assoc, por_categ = {}, {}, {}
    for nome, classe, assoc, categ, fil, uf in coops:
        s = _sistema(fil, nome)
        por_sistema[s] = por_sistema.get(s, 0) + 1
        por_assoc[assoc or "não informado"] = por_assoc.get(assoc or "não informado", 0) + 1
        por_categ[categ or "não informada"] = por_categ.get(categ or "não informada", 0) + 1
    ncoop = len(coops)
    bancos = con.execute("SELECT carteira_comercial, COUNT(*) FROM sfn_sedes WHERE grupo='Bancos' GROUP BY carteira_comercial").fetchall()
    # entradas e saídas observadas pelo próprio pipeline (desde a primeira coleta)
    primeira = con.execute("SELECT MIN(primeiro_visto) FROM sfn_hist").fetchone()[0]
    entradas = [{"cnpj8": c, "nome": nm, "grupo": g, "segmento": s, "uf": u, "data": p}
                for c, nm, g, s, u, p in con.execute("SELECT cnpj8, nome, grupo, segmento, uf, primeiro_visto FROM sfn_hist WHERE primeiro_visto > ? ORDER BY primeiro_visto DESC LIMIT 60", (primeira,))]
    saidas = [{"cnpj8": c, "nome": nm, "grupo": g, "segmento": s, "uf": u, "data": p}
              for c, nm, g, s, u, p in con.execute("SELECT cnpj8, nome, grupo, segmento, uf, ultimo_visto FROM sfn_hist WHERE ultimo_visto < ? ORDER BY ultimo_visto DESC LIMIT 60", (data,))]
    conversoes = [{"cnpj8": c, "nome": nm, "de": a, "para": s, "data": m}
                  for c, nm, a, s, m in con.execute("SELECT cnpj8, nome, segmento_anterior, segmento, mudou_em FROM sfn_hist WHERE mudou_em IS NOT NULL ORDER BY mudou_em DESC LIMIT 60")]
    contagem = {}
    for d, g, k in con.execute("SELECT data, grupo, SUM(n) FROM sfn_contagem GROUP BY data, grupo ORDER BY data"):
        contagem.setdefault(d, {"data": d})[g] = k
    return {
        "disponivel": True, "data": data, "total": n, "grupos": grupos, "ufs": ufs, "regioes": regioes,
        "cooperativas": {"n": ncoop, "por_sistema": sorted([{"sistema": s, "n": k, "share": _share(k, ncoop)} for s, k in por_sistema.items()], key=lambda x: -x["n"]),
                         "por_associacao": sorted([{"criterio": s, "n": k, "share": _share(k, ncoop)} for s, k in por_assoc.items()], key=lambda x: -x["n"]),
                         "por_categoria": sorted([{"categoria": s, "n": k, "share": _share(k, ncoop)} for s, k in por_categ.items()], key=lambda x: -x["n"])},
        "bancos": {"n": sum(k for _c, k in bancos), "com_carteira_comercial": next((k for c, k in bancos if c == "Sim"), 0), "sem_carteira_comercial": next((k for c, k in bancos if c == "Não"), 0)},
        "historico_proprio": {"desde": primeira, "entradas": entradas, "saidas": saidas, "conversoes": conversoes, "contagem": list(contagem.values())[-60:]},
        "nota": ("Posição do dia no cadastro do BCB: bancos, cooperativas, sociedades (SCD, SEP, SCFI, IPs, corretoras, DTVM, agências de fomento, hipotecárias, SAM) e "
                 "administradoras de consórcio. Sem data de início: a série de entradas e saídas é construída pelo Observatório a partir da primeira coleta."),
    }


# ---------------------------------------------------------------- IF.data (trimestral)
JANELA_NOMINAL = 8      # trimestres com lista nome a nome
MESES_NOVA = 12         # início de atividade até 12 meses antes do trimestre de entrada = instituição nova


def _meses_entre(ini, am):
    """Meses entre dois AAAAMM (positivo se `am` é posterior)."""
    return (int(am[:4]) - int(ini[:4])) * 12 + (int(am[4:6]) - int(ini[4:6]))


def _fmt_am(am):
    return f"{am[4:6]}/{am[:4]}" if am and len(am) == 6 else (am or "")


def _universo(con, tri):
    """Régua de universo: lista do Resumo por trimestre (`ifdata_universo`), se cobrir todos os
    trimestres com métricas; senão, None (o builder cai na régua 'resumo entregue')."""
    try:
        cobertos = {r[0] for r in con.execute("SELECT DISTINCT anomes FROM ifdata_universo")}
    except Exception:
        return None, {}
    if any(t not in cobertos for t in tri):
        return None, {}
    pres, info = {}, {}
    tri_set = set(tri)
    for cod, am, e, nome, tcb, uf, sr, td, sit, ini, lider, ini_l in con.execute(
            "SELECT cod_inst, anomes, entregou, nome, tcb, uf, sr, td, situacao, inicio_atividade, cnpj_lider, inicio_lider FROM ifdata_universo ORDER BY anomes"):
        if am not in tri_set:
            continue
        pres.setdefault(cod, set()).add(am)
        # o registro mais recente prevalece (ORDER BY anomes): nome, tipo e situação de hoje
        info[cod] = {"nome": nome, "tcb": tcb, "uf": uf, "sr": sr, "td": td, "situacao": sit,
                     "inicio_atividade": ini, "cnpj_lider": lider, "inicio_lider": ini_l}
    return pres, info


def _ifdata(con):
    try:
        tri = [r[0] for r in con.execute("SELECT DISTINCT anomes FROM institution_metrics WHERE metric='ativo_total' ORDER BY anomes")]
    except Exception:
        tri = []
    if len(tri) < 2:
        return {"disponivel": False, "motivo": "menos de dois trimestres do IF.data na silver"}
    entregou = {}
    for cod, am in con.execute("SELECT DISTINCT cod_inst, anomes FROM institution_metrics WHERE metric='ativo_total'"):
        entregou.setdefault(cod, set()).add(am)
    cad = {c: (nm, t, u, sr) for c, nm, t, u, sr in con.execute("SELECT cod_inst, name, tcb, uf, sr FROM institutions")}
    ativo = {}
    for cod, am, v in con.execute("SELECT cod_inst, anomes, value FROM institution_metrics WHERE metric='ativo_total'"):
        ativo[(cod, am)] = v
    pres, info = _universo(con, tri)
    regua_universo = pres is not None
    if not regua_universo:
        pres = entregou
    try:
        sedes = {r[0] for r in con.execute("SELECT cnpj8 FROM sfn_sedes")}
    except Exception:
        sedes = set()
    ult = tri[-1]
    primeiro = tri[0]
    first = {c: min(s) for c, s in pres.items()}
    last = {c: max(s) for c, s in pres.items()}
    por_tri = {am: {c for c, s in pres.items() if am in s} for am in tri}

    def dados(c):
        nm, t, u, sr = cad.get(c) or (None, None, None, None)
        i = info.get(c) or {}
        return {"cod": c, "nome": i.get("nome") or nm or c, "tcb": i.get("tcb") or t, "tcb_nome": TCB.get(i.get("tcb") or t),
                "uf": i.get("uf") or u, "sr": i.get("sr") or sr}

    def cnpj8(c):
        if len(c) == 8 and c.isdigit():
            return c
        return (info.get(c) or {}).get("cnpj_lider")

    serie, eventos = [], {}
    for i, am in enumerate(tri):
        U = por_tri[am]
        D = {c for c in U if am in entregou.get(c, ())} if regua_universo else U
        por_tcb = {}
        for c in D:
            t = (info.get(c) or {}).get("tcb") or (cad.get(c) or (None, "?", None, None))[1] or "?"
            por_tcb[t] = por_tcb.get(t, 0) + 1
        ent = sai = ret = aus = None
        if i > 0:
            ant = por_tri[tri[i - 1]]
            novos, sumidos = U - ant, ant - U
            e_set = {c for c in novos if first[c] == am}          # primeira presença de sempre
            s_set = {c for c in sumidos if last[c] == tri[i - 1]}  # última presença de sempre
            eventos[am] = {"entradas": e_set, "saidas": s_set, "retornos": novos - e_set, "ausencias": sumidos - s_set, "sem_resumo": U - D}
            ent, sai, ret, aus = len(e_set), len(s_set), len(novos - e_set), len(sumidos - s_set)
        else:
            eventos[am] = {"entradas": set(), "saidas": set(), "retornos": set(), "ausencias": set(), "sem_resumo": U - D}
        serie.append({"anomes": am, "n": len(D), "universo": len(U), "sem_resumo": len(U - D) if regua_universo else None,
                      "entradas": ent, "saidas": sai, "retornos": ret, "ausencias": aus, "por_tcb": por_tcb, "provisorio": am == ult})

    # ---- listas nominais dos últimos oito trimestres
    janela = tri[max(1, len(tri) - JANELA_NOMINAL):]

    def ultimo_entregue(c, ate):
        ams = sorted(a for a in entregou.get(c, ()) if a <= ate)
        return ams[-1] if ams else None

    entradas, saidas, sem_resumo, retornos, ausencias = [], [], [], [], []
    for am in reversed(janela):
        ev = eventos[am]
        i = tri.index(am)
        ant = tri[i - 1]
        for c in ev["entradas"]:
            x = dados(c)
            inf = info.get(c) or {}
            inicios = [v for v in (inf.get("inicio_atividade"), inf.get("inicio_lider")) if v]
            ini = min(inicios) if inicios else None
            x.update({"anomes": am, "ativo": ativo.get((c, am)), "provisorio": False, "inicio_atividade": ini, "cnpj8": cnpj8(c), "entregou": am in entregou.get(c, ())})
            if ini is None:
                x["classe"], x["leitura"] = "sem_data", "início de atividade não informado no cadastro"
            elif _meses_entre(ini, am) <= MESES_NOVA:
                x["classe"], x["leitura"] = "nova", f"instituição nova: início de atividade em {_fmt_am(ini)}"
            else:
                x["classe"], x["leitura"] = "antiga", f"já existia (atividade desde {_fmt_am(ini)}): passou a reportar ou ganhou novo código"
            entradas.append(x)
        for c in ev["saidas"]:
            x = dados(c)
            ue = ultimo_entregue(c, ant)
            k8 = cnpj8(c)
            x.update({"anomes": am, "ativo": ativo.get((c, ue)) if ue else None, "ultimo_entregue": ue, "provisorio": am == ult, "cnpj8": k8,
                      "situacao": (info.get(c) or {}).get("situacao")})
            if not sedes or not k8:
                x["classe"], x["leitura"], x["no_cadastro_hoje"] = "sem_cruzamento", "sem cruzamento com o cadastro do Unicad", None
            elif k8 in sedes:
                x["classe"], x["leitura"], x["no_cadastro_hoje"] = "autorizada_hoje", "ainda autorizada hoje (Unicad): deixou de reportar, mudou de código ou foi consolidada", True
            else:
                x["classe"], x["leitura"], x["no_cadastro_hoje"] = "fora_cadastro", "fora do cadastro do Unicad hoje: saiu do sistema", False
            saidas.append(x)
        for c in ev["retornos"]:
            x = dados(c)
            antes = max(a for a in pres[c] if a < am)
            x.update({"anomes": am, "ausente_desde": tri[tri.index(antes) + 1], "ativo": ativo.get((c, am))})
            retornos.append(x)
        for c in ev["ausencias"]:
            x = dados(c); volta = min(a for a in pres[c] if a > am)
            x.update({"anomes": am, "voltou_em": volta, "ativo": ativo.get((c, ultimo_entregue(c, ant))) if ultimo_entregue(c, ant) else None})
            ausencias.append(x)
    if regua_universo:
        # uma linha por sequência contínua de trimestres sem balanço (BRB em 4T 2025 e 1T 2026 é
        # uma linha "desde 4T 2025", não duas), só para sequências que tocam a janela nominal
        janela_set = set(janela)
        for c, s in pres.items():
            falta = sorted(a for a in s if a not in entregou.get(c, ()))
            if not falta:
                continue
            seqs, atual = [], [falta[0]]
            for a in falta[1:]:
                if tri.index(a) == tri.index(atual[-1]) + 1:
                    atual.append(a)
                else:
                    seqs.append(atual); atual = [a]
            seqs.append(atual)
            for seq in seqs:
                if not any(a in janela_set for a in seq):
                    continue
                x = dados(c)
                ue = ultimo_entregue(c, seq[0])
                depois = sorted(a for a in entregou.get(c, ()) if a > seq[-1])
                x.update({"anomes": seq[-1], "desde": seq[0], "trimestres": len(seq), "ultimo_entregue": ue, "ativo": ativo.get((c, ue)) if ue else None,
                          "voltou_em": depois[0] if depois else None, "nunca_entregou": ue is None, "situacao": (info.get(c) or {}).get("situacao"),
                          "saiu_da_lista": seq[-1] != ult and not depois and max(s) == seq[-1]})
                sem_resumo.append(x)
    ordem = lambda xs: sorted(xs, key=lambda x: (-int(x["anomes"]), -(x.get("ativo") or 0)))
    entradas, saidas, sem_resumo = ordem(entradas), ordem(saidas), ordem(sem_resumo)

    # ---- trocas de código: mesmo CNPJ líder (ou mesmo nome) sai com um código e entra com outro
    chave = lambda x: x.get("cnpj8") or (x["nome"] or "").strip().upper()
    por_chave_saida = {}
    for x in saidas:
        por_chave_saida.setdefault(chave(x), []).append(x)
    conversoes = []
    for x in entradas:
        k = chave(x)
        cands = [y for y in por_chave_saida.get(k, []) if y["cod"] != x["cod"]] if k else []
        if not cands:
            nomes = [y for y in saidas if y["cod"] != x["cod"] and (y["nome"] or "").strip().upper() == (x["nome"] or "").strip().upper() and x["nome"]]
            cands = nomes
        if cands:
            y = cands[0]
            x["classe"], x["leitura"] = "troca_codigo", f"mesma instituição: antes reportava como {y['nome']} ({y['cod']})"
            y["classe"], y["leitura"] = "troca_codigo", f"mesma instituição: passou a reportar como {x['nome']} ({x['cod']})"
            conversoes.append({"nome": x["nome"], "de": y["tcb"], "para": x["tcb"], "de_cod": y["cod"], "para_cod": x["cod"], "anomes": x["anomes"],
                               "tipo": "conversão de tipo" if y["tcb"] != x["tcb"] else "novo código, mesmo tipo"})

    # ---- KPIs dos últimos 4 trimestres fechados (exclui o provisório)
    fechados = [s for s in serie if not s["provisorio"]][-4:]
    ult_fechado = fechados[-1] if fechados else None
    por_tcb_ult = [{"tcb": t, "nome": TCB.get(t, t), "n": k, "share": _share(k, ult_fechado["n"])} for t, k in sorted((ult_fechado or {"por_tcb": {}})["por_tcb"].items(), key=lambda x: -x[1])]
    var_4t = {t: (ult_fechado["por_tcb"].get(t, 0) - (fechados[0]["por_tcb"].get(t, 0) if len(fechados) > 1 else 0)) for t in (ult_fechado or {"por_tcb": {}})["por_tcb"]} if ult_fechado else {}
    am_fechados = {s["anomes"] for s in fechados}
    classes = lambda xs, cls: sum(1 for x in xs if x["anomes"] in am_fechados and x["classe"] == cls)
    regua_txt = ("lista do Resumo (presença na relação do trimestre, com ou sem balanço entregue)" if regua_universo
                 else "resumo entregue (presença com Ativo Total no trimestre)")
    return {
        "disponivel": True, "trimestres": len(tri), "primeiro": primeiro, "ultimo": ult, "ultimo_fechado": ult_fechado["anomes"] if ult_fechado else None,
        "regua": "lista" if regua_universo else "entregue", "regua_texto": regua_txt, "janela_nominal": JANELA_NOMINAL, "meses_nova": MESES_NOVA,
        "kpis": {"reportantes": ult_fechado["n"] if ult_fechado else None, "universo": ult_fechado["universo"] if ult_fechado else None,
                 "sem_resumo": ult_fechado["sem_resumo"] if ult_fechado else None,
                 "entradas_4t": sum(s["entradas"] or 0 for s in fechados), "saidas_4t": sum(s["saidas"] or 0 for s in fechados),
                 "entradas_4t_novas": classes(entradas, "nova"), "entradas_4t_antigas": classes(entradas, "antiga"), "entradas_4t_troca": classes(entradas, "troca_codigo"),
                 "saidas_4t_fora_cadastro": classes(saidas, "fora_cadastro"), "saidas_4t_autorizadas": classes(saidas, "autorizada_hoje"), "saidas_4t_troca": classes(saidas, "troca_codigo"),
                 "ausencias_4t": sum(s["ausencias"] or 0 for s in fechados), "retornos_4t": sum(s["retornos"] or 0 for s in fechados),
                 "provisorio_entradas": serie[-1]["entradas"], "provisorio_saidas": serie[-1]["saidas"]},
        "serie": serie, "por_tcb": por_tcb_ult, "var_4t_por_tcb": var_4t,
        "entradas": entradas[:120], "saidas": saidas[:120], "ausencias": ordem(ausencias)[:80], "retornos": ordem(retornos)[:80], "sem_resumo": sem_resumo[:200] if regua_universo else None,
        "conversoes": conversoes[:40], "tcb": TCB,
        "nota": (f"Régua: {regua_txt}. Entrada = primeiro trimestre em que o código aparece em toda a série (desde {_fmt_am(primeiro)}); "
                 "saída = trimestre seguinte ao último em que aparece, sem retorno depois. Quem falta um trimestre e volta é ausência temporária, não entrada nem saída. "
                 "O trimestre mais recente ainda recebe retardatários: as saídas nele são provisórias."),
    }


# ---------------------------------------------------------------- regimes
def _regimes(con):
    g = common.ler_gold_opcional("regimes.json") or {}
    if not g.get("disponivel"):
        return {"disponivel": False}
    vig = g.get("vigentes") or []
    por_tipo = {}
    for v in vig:
        por_tipo[v.get("tipo")] = por_tipo.get(v.get("tipo"), 0) + 1
    ult12 = [v for v in vig if (v.get("inicio_iso") or "") >= _menos_meses(12)]
    return {"disponivel": True, "vigentes": len(vig), "por_tipo": sorted([{"tipo": t, "n": k} for t, k in por_tipo.items()], key=lambda x: -x["n"]),
            "decretados_12m": len(ult12), "recentes": sorted(vig, key=lambda v: v.get("inicio_iso") or "", reverse=True)[:12], "gerado_em": g.get("gerado_em")}


def _menos_meses(n):
    from datetime import date
    hoje = date.today()
    y, m = hoje.year, hoje.month - n
    while m <= 0:
        y, m = y - 1, m + 12
    return f"{y}-{m:02d}-{hoje.day:02d}"


# ---------------------------------------------------------------- build
def build(con, cfg=None):
    return _montar(_cadastro(con), _ifdata(con), _regimes(con))


def _montar(cad, ifd, reg):
    """Monta o gold a partir das três seções já calculadas (separado de `build` para que
    uma seção possa ser reconstruída sozinha, preservando as outras)."""
    if not cad.get("disponivel") and not ifd.get("disponivel"):
        return {"disponivel": False, "motivo": "silver sem cadastro do Unicad nem trimestres do IF.data — coleta ainda não rodou"}
    frases = []
    if cad.get("disponivel"):
        g = {x["grupo"]: x for x in cad["grupos"]}
        frases.append(f"Em {cad['data']}, {cad['total']} sedes estavam autorizadas e em funcionamento: {g.get('Bancos', {}).get('n', 0)} bancos, "
                      f"{g.get('Cooperativas de crédito', {}).get('n', 0)} cooperativas de crédito, {g.get('Instituições de pagamento', {}).get('n', 0)} instituições de pagamento "
                      f"e {g.get('Fintechs de crédito', {}).get('n', 0)} fintechs de crédito (SCD e SEP).")
    if ifd.get("disponivel") and ifd["kpis"]["reportantes"]:
        k = ifd["kpis"]
        uf = ifd["ultimo_fechado"]
        tri_txt = f"{ {'03': '1T', '06': '2T', '09': '3T', '12': '4T'}.get(uf[4:6], uf[4:6])} {uf[:4]}"
        frases.append(f"No IF.data, {k['reportantes']} instituições e conglomerados entregaram o resumo de {tri_txt}"
                      + (f" ({k['sem_resumo']} constavam da lista sem balanço entregue)" if k.get("sem_resumo") else "")
                      + f"; nos quatro trimestres fechados, {k['entradas_4t']} códigos apareceram pela primeira vez na lista"
                      + (f" ({k['entradas_4t_novas']} instituições novas, {k['entradas_4t_antigas']} já existentes que passaram a reportar ou mudaram de código)" if ifd.get("regua") == "lista" else "")
                      + f" e {k['saidas_4t']} deixaram a lista"
                      + (f" ({k['saidas_4t_fora_cadastro']} fora do cadastro do BCB hoje, {k['saidas_4t_autorizadas']} ainda autorizadas)" if ifd.get("regua") == "lista" else "") + ".")
    if reg.get("disponivel"):
        frases.append(f"{reg['vigentes']} instituições estão sob regime de resolução, {reg['decretados_12m']} decretados nos últimos 12 meses.")
    regua_lista = ifd.get("regua") == "lista"
    return {
        "disponivel": True, "gerado_em": common.now_utc(), "fontes": FONTES, "sintese": " ".join(frases),
        "cadastro": cad, "ifdata": ifd, "regimes": reg,
        "catalogo": [
            {"id": "sedes", "nome": "Sedes em funcionamento", "definicao": "instituições autorizadas pelo BCB com sede em funcionamento na data da coleta, por grupo e segmento", "unidade": "instituições", "fonte": "BCB/Unicad", "limitacoes": "posição do dia; sem data de início; conglomerados não consolidados"},
            {"id": "entradas_saidas_cadastro", "nome": "Entradas e saídas no cadastro", "definicao": "CNPJ que aparece (ou some) entre duas coletas do cadastro", "unidade": "instituições", "fonte": "calculado", "limitacoes": "série nasce na primeira coleta do Observatório; uma relação fora do ar não vira saída (a coleta é descartada)"},
            {"id": "reportantes", "nome": "Reportantes do IF.data", "definicao": "instituições e conglomerados com Ativo Total publicado no resumo do trimestre, por tipo de consolidado", "unidade": "instituições", "fonte": "BCB/IF.data", "limitacoes": "universo do IF.data (tipo de instituição 2); último trimestre recebe retardatários"},
            {"id": "universo", "nome": "Na lista do IF.data", "definicao": "códigos presentes na relação do resumo do trimestre, com ou sem balanço entregue (saldo nulo = listada sem resumo)", "unidade": "instituições", "fonte": "BCB/IF.data", "limitacoes": "régua disponível só com a tabela de universo coletada para todos os trimestres; até lá o painel usa o resumo entregue"},
            {"id": "entradas_saidas_ifdata", "nome": "Entradas e saídas no IF.data", "definicao": "entrada = primeiro trimestre em que o código aparece em toda a série; saída = trimestre seguinte ao último em que aparece, sem retorno; falta de um trimestre com retorno é ausência temporária", "unidade": "instituições", "fonte": "calculado", "limitacoes": "entrada pode ser instituição antiga com código novo (a data de início de atividade do cadastro separa os casos); saída pode ser fusão, incorporação, troca de código ou cancelamento; o cruzamento com o Unicad diz se o CNPJ segue autorizado hoje"},
        ],
        "cautelas": [
            "Cadastro (posição do dia), reportantes do IF.data (trimestral) e regimes (lista vigente) são três réguas; não se somam.",
            "Entrada no IF.data não é instituição nova: um banco antigo que passa a reportar sob novo código de conglomerado aparece como entrada. A data de início de atividade do cadastro, publicada na tabela, separa 'instituição nova' de 'já existia'.",
            "Saída do IF.data não é falência: fusões, incorporações e trocas de código de conglomerado também tiram uma instituição da lista. O cruzamento com o Unicad diz se o CNPJ segue autorizado hoje; a lista de regimes diz se houve intervenção.",
            "Uma instituição que consta da lista mas não entregou o balanço (saldo nulo na fonte: atraso, RAET, retardatário) não é saída. Ela fica na coluna 'sem resumo' do trimestre e some dela quando entrega." if regua_lista else
            "Uma instituição que falta um trimestre e volta no seguinte não é saída nem entrada: é ausência temporária e fica em lista própria.",
            "O trimestre mais recente do IF.data recebe retardatários por semanas; as saídas nele são provisórias e ficam marcadas.",
            "O cadastro do Unicad não publica data de início: a história das entradas e saídas com nomes começa na primeira coleta do Observatório e cresce daí em diante.",
            "Instituição de pagamento e fintech de crédito são segmentos regulatórios: uma mesma empresa pode ter mais de uma licença, cada uma com um CNPJ.",
        ],
        "metodo": ("Cadastro pelas quatro relações da API Olinda, espelhado a cada coleta com histórico próprio por CNPJ; IF.data pela presença de cada código na relação do resumo trimestral "
                   "(com o cadastro do trimestre: data de início de atividade, CNPJ líder e situação) e pelo Ativo Total entregue; entradas e saídas pela primeira e pela última presença "
                   "em toda a série, nunca por comparação de dois trimestres vizinhos apenas; regimes pelo gold já publicado. Agregação em Python (stdlib), sem estimativa."),
    }
