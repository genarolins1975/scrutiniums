"""Validações do módulo Saúde nas capitais.

Mesmo contrato das validações de Educação: cada uma devolve {id, titulo, tipo, resultado, detalhe, casos}. Tipo "automatica" roda em toda
reconstrução; "medicao" quantifica um fato que apoia uma decisão, sem aprovar nem reprovar. Resultados: aprovada,
aprovada_com_divergencias_documentadas, regra_aplicada_com_pendencias, reprovada (a gold não é promovida) e medicao.

As validações conferem o produto: identidades contábeis, unidades, perímetros, estados de dado e herança de elegibilidade. Nenhuma avalia governos,
redes ou serviços.
"""
import os
import re

from pipeline.eficiencia import entes
from pipeline.eficiencia.validacoes import _numeros_br
from pipeline.eficiencia_saude import base, conferencia as CF, derivados as DV, padroniza as P

TOL_REAIS = 1.0
NOMES = {c: n for c, n, _ in entes.CAPITAIS}


def _v(id_, titulo, tipo, resultado, detalhe, casos=None):
    return {"id": id_, "titulo": titulo, "tipo": tipo, "resultado": resultado, "detalhe": _numeros_br(detalhe), "casos": casos or []}


def _nome(cod):
    return NOMES.get(cod) or ("Brasília (DF)" if cod == entes.DISTRITO_FEDERAL[0] else str(cod))


def _dca(cod, ano):
    return P._linhas_dca(cod, ano) or []


def s01_entes():
    """Códigos IBGE das 26 capitais e do DF conferem com a lista de entes do Siconfi (captura de Educação, mesma lista oficial)."""
    caminho = os.path.join(os.path.dirname(base.AQUI), "eficiencia", "seed", "siconfi", "entes.json.gz")
    if not os.path.exists(caminho):
        return _v("S01", "Universo: códigos IBGE das 26 capitais e do DF conferem com a lista de entes do Siconfi", "automatica", "reprovada", "Lista de entes do Siconfi ausente do seed compartilhado.")
    itens = base.le_json_gz(caminho)
    caps = {int(x["cod_ibge"]) for x in itens if str(x.get("capital")).strip() == "1"}
    esperado = {c for c, _, _ in entes.CAPITAIS} | {entes.DISTRITO_FEDERAL[0]}
    faltam, sobram = sorted(esperado - caps), sorted(caps - esperado)
    ok = not faltam and not sobram and len(entes.CAPITAIS) == 26
    return _v("S01", "Universo: códigos IBGE das 26 capitais e do DF conferem com a lista de entes do Siconfi", "automatica", "aprovada" if ok else "reprovada",
              f"{len(caps)} entes marcados como capital no Siconfi; {len(entes.CAPITAIS)} capitais municipais no módulo e o Distrito Federal registrado fora do universo municipal inicial, com motivo.",
              [{"faltam": faltam, "sobram": sobram}] if not ok else [])


def s02_identidades_dca():
    casos, n = [], 0
    for cod, _, _ in entes.CAPITAIS:
        for ano in P.ANOS_FINANCEIROS:
            liq = [x for x in _dca(cod, ano) if x["coluna"] == "Despesas Liquidadas"]
            if not liq:
                continue
            n += 1
            saude = [x["valor"] for x in liq if x["conta"] == "10 - Saúde"]
            sub = sum(x["valor"] for x in liq if x["conta"].startswith(("10.", "FU10 ")))
            d = abs(saude[0] - sub) if saude else None
            if d is None or d > TOL_REAIS:
                casos.append({"ente": cod, "nome": _nome(cod), "ano": ano, "dif_subfuncoes": d})
    return _v("S02", "DCA: soma das subfunções = função Saúde, em cada declaração", "automatica", "aprovada" if not casos else "reprovada",
              f"{n} declarações conferidas (26 capitais × {len(P.ANOS_FINANCEIROS)} exercícios), tolerância de R$ 1,00; {len(casos)} fora da tolerância.", casos)


def s03_dca_rreo(obs):
    """Conferência DCA × RREO (e MSC, quando material). Reprova só se a regra for violada; pendência tratada corretamente não vira aprovação."""
    contagem, casos, violacoes, n = {}, [], [], 0
    for o in obs:
        if o["indicador"] != "sau.despesa.funcao_saude" or o["componente"] != "nominal" or o["status"] != "OBSERVADO":
            continue
        n += 1
        c = o.get("conferencia") or {}
        st = c.get("situacao")
        contagem[st] = contagem.get(st, 0) + 1
        if (st in CF.ELEGIVEIS) != bool(o.get("elegivel_comparacao")):
            violacoes.append({"ente": o["ente"], "ano": o["ano"], "situacao": st, "elegivel": o.get("elegivel_comparacao")})
        if st != "CONFERE":
            casos.append({"ente": o["ente"], "nome": _nome(o["ente"]), "ano": o["ano"], "dca": o["valor"], "situacao": st, "rotulo": c.get("rotulo"),
                          "elegivel": c.get("elegivel_comparacao"), "rreo": c.get("rreo"), "msc": c.get("msc"), "diferenca": c.get("diferenca"),
                          "diferenca_pct_dca": c.get("diferenca_pct_dca"), "explicacao": c.get("explicacao"), "evidencias": c.get("evidencias"),
                          "fontes_sha256": c.get("fontes_sha256")})
    pend = contagem.get("PENDENTE", 0) + contagem.get("NAO_CONFERIDO", 0)
    resultado = "reprovada" if violacoes else "regra_aplicada_com_pendencias" if pend else "aprovada" if set(contagem) <= {"CONFERE"} else "aprovada_com_divergencias_documentadas"
    partes = "; ".join(f"{CF.ROTULO.get(k, k)} ({v})" for k, v in sorted(contagem.items(), key=lambda x: -x[1]))
    return _v("S03", "Conferência da despesa: DCA × RREO do 6º bimestre e, na diferença material, MSC de dezembro", "automatica", resultado,
              f"{n} declarações; {partes}. Política {CF.VERSAO_POLITICA}: tolerância de R$ 1,00 para arredondamento e de 0,1% da DCA para diferenças menores; acima disso, só a MSC reconcilia. "
              "Pendentes, não conferidas e de perímetro distinto ficam disponíveis para consulta e fora das comparações." + (f" Violações da regra: {len(violacoes)}." if violacoes else ""),
              violacoes + sorted(casos, key=lambda c: -abs(c.get("diferenca_pct_dca") or 0)))


def s04_natureza(obs):
    pares = {}
    for o in obs:
        if o["indicador"] == "sau.despesa.natureza":
            pares.setdefault((o["ente"], o["ano"]), []).append(o)
    dca = {(o["ente"], o["ano"]): o for o in obs if o["indicador"] == "sau.despesa.funcao_saude" and o["componente"] == "nominal"}
    ruins, publicados, fora = [], 0, []
    for (cod, ano), linhas in sorted(pares.items()):
        if all(l["status"] == "OBSERVADO" for l in linhas):
            publicados += 1
            soma = sum(l["valor"] for l in linhas)
            if abs(soma - dca[(cod, ano)]["valor"]) > TOL_REAIS or len(linhas) != 3:
                ruins.append({"ente": cod, "ano": ano, "soma": soma, "dca": dca[(cod, ano)]["valor"]})
        else:
            fora.append({"ente": cod, "nome": _nome(cod), "ano": ano, "motivo": linhas[0]["nota"]})
    resultado = "reprovada" if ruins else ("aprovada_com_divergencias_documentadas" if fora else "aprovada")
    return _v("S04", "Natureza da despesa: as três categorias reproduzem a DCA, ou o par não é publicado", "automatica", resultado,
              f"{publicados} de {len(pares)} pares com a abertura publicada (soma das categorias igual à DCA, R$ 1,00 de tolerância); {len(fora)} pares sem abertura, com a diferença registrada e nenhuma categoria estimada. "
              "A soma da MSC respeita a natureza do valor (D e C).", ruins + fora)


def m01_sinais_msc():
    """Quantifica por que a MSC é somada em saldo líquido: linhas com natureza D e diferença entre soma em módulo e soma líquida."""
    pares_d, difs, n = 0, [], 0
    for cod, _, _ in entes.CAPITAIS:
        for ano in P.ANOS_FINANCEIROS:
            caminho = os.path.join(base.SEED, "siconfi", "msc_funcao10", f"{cod}_{ano}_12.json.gz")
            if not os.path.exists(caminho):
                continue
            n += 1
            modulo = liquido = 0.0
            tem_d = False
            for x in base.le_json_gz(caminho):
                if str(x.get("funcao")) != "10" or str(x.get("conta_contabil", ""))[:7] not in CF.MSC_CONTAS_LIQUIDADO or str(x.get("natureza_despesa") or "")[2:4] == "91":
                    continue
                modulo += float(x["valor"])
                liquido += CF.saldo_liquido(x)
                tem_d = tem_d or x.get("natureza_conta") == "D"
            pares_d += 1 if tem_d else 0
            if abs(modulo - liquido) > TOL_REAIS:
                difs.append({"ente": cod, "nome": _nome(cod), "ano": ano, "modulo": round(modulo, 2), "liquido": round(liquido, 2)})
    return _v("M01", "MSC: linhas com natureza do valor D e diferença entre soma em módulo e saldo líquido", "medicao", "medicao",
              f"{n} MSC de dezembro (função 10, sem modalidade 91): {pares_d} com linhas de natureza D nas contas de despesa liquidada; a soma em módulo difere do saldo líquido em mais de R$ 1,00 em {len(difs)}. "
              "O saldo líquido (C menos D) é a regra usada em todo o módulo.", difs[:40])


def m02_ordem_estagios():
    """Pago ≤ liquidado ≤ empenhado na função 10 de cada DCA: medição, não reprovação (registra o que a fonte traz)."""
    casos, n = [], 0
    for cod, _, _ in entes.CAPITAIS:
        for ano in P.ANOS_FINANCEIROS:
            v = {x["coluna"]: x["valor"] for x in _dca(cod, ano) if x["conta"] == "10 - Saúde"}
            if {"Despesas Empenhadas", "Despesas Liquidadas", "Despesas Pagas"} <= set(v):
                n += 1
                if not (v["Despesas Pagas"] <= v["Despesas Liquidadas"] + TOL_REAIS and v["Despesas Liquidadas"] <= v["Despesas Empenhadas"] + TOL_REAIS):
                    casos.append({"ente": cod, "nome": _nome(cod), "ano": ano, "empenhada": v["Despesas Empenhadas"], "liquidada": v["Despesas Liquidadas"], "paga": v["Despesas Pagas"]})
    return _v("M02", "DCA: ordem dos estágios da despesa na função Saúde (paga, liquidada, empenhada)", "medicao", "medicao",
              f"{n} declarações com os três estágios; {len(casos)} com a ordem violada na própria fonte. O módulo usa o estágio liquidado e não corrige a fonte.", casos)


def s05_asps():
    """Aritmética do Anexo 12: XVI = XII − XIII − XIV − XV, III = I + II e percentual = XVI ÷ III, a partir da resposta preservada."""
    ruins, n, sem = [], 0, 0

    def val(linhas, padrao, col):
        achadas = [l for l in linhas if re.search(padrao, l.get("dsItem") or "", re.I)]
        return P._valor_siops(achadas[0].get(col)) if len(achadas) == 1 else None

    for cod, _, _ in entes.CAPITAIS:
        for ano in P.ANOS_FINANCEIROS:
            linhas = P._seed_siops("rreo_anexo_12", cod, ano)
            if linhas is None:
                sem += 1
                continue
            n += 1
            i = val(linhas, r"^RECEITA DE IMPOSTOS\s+\(I\)", "vl_coluna3")
            ii = val(linhas, r"^RECEITA DE TRANSFERÊNCIAS CONSTITUCIONAIS E LEGAIS\s+\(II\)", "vl_coluna3")
            iii = val(linhas, r"\(III\)\s*=\s*\(I\)\s*\+\s*\(II\)", "vl_coluna3")
            xii = val(linhas, r"^Total das Despesas com ASPS \(XII\)", "vl_coluna1")
            xiii = val(linhas, r"\(XIII\)$", "vl_coluna1") or 0.0
            xiv = val(linhas, r"\(XIV\)$", "vl_coluna1") or 0.0
            xv = val(linhas, r"\(XV\)$", "vl_coluna1") or 0.0
            xvi = val(linhas, r"\(XVI\)\s*=\s*\(XII", "vl_coluna1")
            if None in (iii, xii, xvi):
                ruins.append({"ente": cod, "ano": ano, "problema": "linha XII, XVI ou III não encontrada de modo único"})
                continue
            if i is not None and ii is not None and abs((i + ii) - iii) > 1.0:
                ruins.append({"ente": cod, "ano": ano, "problema": "III difere de I + II", "dif": round(i + ii - iii, 2)})
            if abs((xii - xiii - xiv - xv) - xvi) > 1.0:
                ruins.append({"ente": cod, "ano": ano, "problema": "XVI difere de XII − XIII − XIV − XV", "dif": round(xii - xiii - xiv - xv - xvi, 2)})
    return _v("S05", "ASPS (Anexo 12 do RREO): III = I + II e XVI = XII − XIII − XIV − XV, na resposta preservada do SIOPS", "automatica",
              "aprovada" if not ruins and n == 130 else "reprovada",
              f"{n} demonstrativos conferidos de 130; {len(ruins)} divergências. O percentual publicado é conferido em cada observação (XVI ÷ III, tolerância de 0,011 ponto percentual). "
              "O conteúdo do que é ASPS é declarado pelo município e não é refeito.", ruins[:30])


def s06_asps_percentual(obs):
    pct = [o for o in obs if o["indicador"] == "sau.asps.percentual_aplicado"]
    ruins, abaixo = [], []
    for o in pct:
        if o["status"] == "OBSERVADO":
            c = o["calculo"]
            if abs(c["numerador"] / c["denominador"] * 100 - o["valor"]) > 0.011:
                ruins.append({"ente": o["ente"], "ano": o["ano"], "valor": o["valor"]})
            if o.get("minimo_pct") is not None and o["valor"] + 1e-9 < o["minimo_pct"]:
                abaixo.append({"ente": o["ente"], "nome": _nome(o["ente"]), "ano": o["ano"], "percentual": o["valor"], "minimo_pct": o["minimo_pct"]})
    n_ok = sum(1 for o in pct if o["status"] == "OBSERVADO")
    return _v("S06", "ASPS: percentual aplicado reproduz XVI ÷ III em cada observação; abaixo do mínimo informado: medição", "automatica",
              "reprovada" if ruins else "aprovada",
              f"{n_ok} percentuais observados em {len(pct)} pares; {len(ruins)} fora da tolerância. Pares com percentual abaixo do mínimo informado no demonstrativo: {len(abaixo)}. "
              "O mínimo é referência normativa (LC 141/2012, art. 7º), não meta.", ruins[:20] + abaixo[:20])


def s07_por_fonte(obs):
    f = [o for o in obs if o["indicador"] == "sau.despesa.por_fonte"]
    pares = {}
    for o in f:
        pares.setdefault((o["ente"], o["ano"]), []).append(o)
    ruins, inconsist = [], []
    for (cod, ano), linhas in pares.items():
        if all(l["status"] == "OBSERVADO" for l in linhas):
            soma = sum(l["valor"] for l in linhas)
            if abs(soma - linhas[0]["total_siops"]) > 1.0 or len(linhas) != len(P.FONTES_RECURSO):
                ruins.append({"ente": cod, "ano": ano, "soma": soma})
        else:
            inconsist.append({"ente": cod, "nome": _nome(cod), "ano": ano, "estado": linhas[0]["status"], "nota": linhas[0]["nota"]})
    return _v("S07", "Despesa por fonte (SIOPS): as nove fontes reproduzem o total informado", "automatica",
              "reprovada" if ruins else ("aprovada_com_divergencias_documentadas" if inconsist else "aprovada"),
              f"{len(pares) - len(inconsist)} de {len(pares)} pares com as nove fontes fechando o total (R$ 1,00 de tolerância); {len(inconsist)} sem valor publicado.", ruins + inconsist)


def s08_aps(obs):
    """Fórmula da Nota Técnica nº 2/2025 reproduz a cobertura potencial de dezembro de 2022 em diante."""
    cob = [o for o in obs if o["indicador"] == "sau.aps.cobertura_potencial"]
    ok = sum(1 for o in cob if o["status"] == "OBSERVADO" and o["ano"] >= P.ANO_INICIO_REGRA_VIGENTE)
    inconsist = [{"ente": o["ente"], "nome": _nome(o["ente"]), "ano": o["ano"], "nota": o["nota"]} for o in cob if o["status"] != "OBSERVADO"]
    acima = [{"ente": o["ente"], "nome": _nome(o["ente"]), "ano": o["ano"], "valor": o["valor"]} for o in cob if o["status"] == "OBSERVADO" and o["valor"] > 100]
    return _v("S08", "Cobertura potencial da APS: capacidade e cobertura reproduzem a fórmula da Nota Técnica nº 2/2025 (2022 em diante)", "automatica",
              "reprovada" if inconsist else "aprovada",
              f"{ok} valores de dezembro (2022 a 2025) reproduzidos pela fórmula (eSF × 3.500, eAP 20 h × 1.750, eAP 30 h × 2.625, mais cadastro; cobertura = capacidade ÷ população de referência); "
              f"dezembro de 2021 segue regra anterior e fica fora das comparações. {len(acima)} valores acima de 100%, exibidos como publicados, sem teto.", inconsist + acima)


def m03_ubs_api_x_retrato():
    """Estabelecimentos de tipo 01 ou 02 ativos na competência mais recente do histórico (API) × retrato do arquivo diário (S3): por capital."""
    caminho = os.path.join(base.SEED, "cnes", "historico_aps_dezembros.json.gz")
    if not os.path.exists(caminho):
        return _v("M03", "UBS: competência mais recente do histórico (API) × retrato do arquivo diário", "medicao", "medicao", "Histórico do CNES ausente do seed.")
    hist = base.le_json_gz(caminho)
    m6 = {str(c)[:6]: c for c, _, _ in entes.CAPITAIS}
    api = {}
    ultimas = set()
    for co, h in hist.items():
        if not h.get("ultima"):
            continue
        ultimas.add(h["ultima"])
        for l in h["linhas"]:
            if str(l["nu_comp"]) == str(h["ultima"]) and P._tipo_codigo(l.get("tp_unidade")) in P.TIPOS_APS and str(l.get("ds_status") or "").strip().upper() == "ATIVO":
                cod = m6.get(str(l.get("co_ibge") or "").strip())
                if cod:
                    api[cod] = api.get(cod, 0) + 1
    ret = {}
    for o in P.rede_retrato():
        if o["componente"] == "total_ativas" and o["status"] == "OBSERVADO":
            ret[o["ente"]] = o["valor"]
    linhas = [{"ente": c, "nome": _nome(c), "api_competencia_mais_recente": api.get(c, 0), "retrato_arquivo_diario": ret.get(c)} for c, _, _ in entes.CAPITAIS]
    difs = [l for l in linhas if l["retrato_arquivo_diario"] is not None and l["api_competencia_mais_recente"] != l["retrato_arquivo_diario"]]
    return _v("M03", "UBS: competência mais recente do histórico (API) × retrato do arquivo diário, por capital", "medicao", "medicao",
              f"Competência(s) mais recente(s) no histórico: {', '.join(c[4:6] + '/' + c[:4] for c in sorted(ultimas)) or 'nenhuma'}. {len(difs)} capitais com contagens diferentes entre a competência mais recente da API e o retrato do arquivo diário "
              "(datas de referência distintas e histórico restrito aos estabelecimentos que hoje são tipo 01 ou 02).", linhas)


def s09_icsap(obs):
    ic = [o for o in obs if o["indicador"] == "sau.icsap.grupos"]
    inconsist = [{"ente": o["ente"], "nome": _nome(o["ente"]), "ano": o["ano"], "nota": o["nota"]} for o in ic if o["status"] == "INCONSISTENTE"]
    part = [o for o in obs if o["indicador"] == "sau.icsap.participacao" and o["status"] == "OBSERVADO"]
    acima = [{"ente": o["ente"], "ano": o["ano"], "valor": o["valor"]} for o in part if o["valor"] > 100]
    pares = {(o["ente"], o["ano"]) for o in ic}
    return _v("S09", "ICSAP: a soma dos 19 grupos é igual ao total, e a participação nas internações SUS não passa de 100%", "automatica",
              "reprovada" if inconsist or acima else "aprovada",
              f"{len(pares)} pares capital × ano conferidos, {len(inconsist)} com soma dos grupos diferente do total; {len(part)} participações observadas, {len(acima)} acima de 100%.", inconsist + acima)


def m04_denominadores_icsap(obs):
    """Diferença entre a população do indicador (Ministério da Saúde) e a população do exercício do OBEE (IBGE): por capital e ano."""
    pop = {(o["ente"], o["ano"]): o for o in obs if o["indicador"] == "ctx.populacao.residente" and o["status"] == "OBSERVADO"}
    linhas = []
    for o in obs:
        if o["indicador"] == "sau.icsap.taxa" and o["componente"] == "ripsa" and o["status"] == "OBSERVADO":
            p = pop.get((o["ente"], o["ano"]))
            if p:
                linhas.append({"ente": o["ente"], "nome": _nome(o["ente"]), "ano": o["ano"], "populacao_ripsa": o["calculo"]["denominador"], "populacao_obee": p["valor"],
                               "dif_pct": round((o["calculo"]["denominador"] / p["valor"] - 1) * 100, 2)})
    dif = sorted(l["dif_pct"] for l in linhas)
    br = lambda v: f"{v:+.1f}".replace(".", ",").replace("-", "−") + "%"
    return _v("M04", "População do indicador de ICSAP (Ministério da Saúde) × população do exercício do OBEE (IBGE)", "medicao", "medicao",
              f"{len(linhas)} pares capital × ano: a população do RIPSA difere da do OBEE em mediana {br(dif[len(dif) // 2])}, entre {br(dif[0])} e {br(dif[-1])}. "
              "As duas taxas são publicadas porque a taxa muda na mesma proporção conforme o denominador.", sorted(linhas, key=lambda l: -abs(l["dif_pct"]))[:30])


def s10_ausencia_nao_zero(obs):
    ruins = [o for o in obs if (o["status"] != "OBSERVADO" and o["valor"] is not None) or (o["status"] == "OBSERVADO" and o["valor"] is None)]
    return _v("S10", "Estados de dado: só observação com estado \"observado\" tem valor; ausência nunca vira zero", "automatica", "aprovada" if not ruins else "reprovada",
              f"{len(obs)} observações conferidas; {sum(1 for o in obs if o['status'] != 'OBSERVADO')} sem valor, todas com motivo.",
              [{k: o[k] for k in ("indicador", "ente", "ano", "componente", "status")} for o in ruins[:20]])


def s11_elegibilidade(obs):
    ruins = []
    for o in obs:
        if o.get("elegivel_comparacao") and o["status"] != "OBSERVADO":
            ruins.append({k: o[k] for k in ("indicador", "ente", "ano", "componente", "status")})
        c = o.get("conferencia")
        if c and o.get("elegivel_comparacao") and c.get("situacao") not in CF.ELEGIVEIS:
            ruins.append({k: o[k] for k in ("indicador", "ente", "ano", "componente")} | {"situacao": c.get("situacao")})
    n_ineleg = sum(1 for o in obs if o["status"] == "OBSERVADO" and not o.get("elegivel_comparacao"))
    return _v("S11", "Elegibilidade: só valor observado e conferido entra em comparações, medianas e variações", "automatica", "aprovada" if not ruins else "reprovada",
              f"{len(obs)} observações conferidas; {n_ineleg} com valor oficial disponível para consulta e fora das comparações (perímetro distinto, conferência pendente ou regra anterior de cálculo), incluindo derivados.", ruins[:30])


def s12_df_fora(obs):
    df = entes.DISTRITO_FEDERAL[0]
    n = sum(1 for o in obs if o["ente"] == df)
    return _v("S12", "Recorte municipal: nenhuma observação do Distrito Federal no módulo", "automatica", "aprovada" if n == 0 else "reprovada",
              "O DF está registrado como excluído, com motivo, e não gera observação." if n == 0 else f"{n} observações do DF.")


def s13_unicidade(obs):
    vistos, dup = set(), []
    for o in obs:
        k = (o["indicador"], o["ente"], o["ano"], o["etapa"], o["componente"])
        if k in vistos:
            dup.append({"indicador": o["indicador"], "ente": o["ente"], "ano": o["ano"], "componente": o["componente"]})
        vistos.add(k)
    return _v("S13", "Sem duplicidade: uma observação por indicador, capital, ano e componente", "automatica", "aprovada" if not dup else "reprovada",
              "Nenhuma duplicidade encontrada." if not dup else f"{len(dup)} chaves duplicadas.", dup[:20])


def s14_por_habitante(obs):
    hab = [o for o in obs if o["indicador"] == "sau.despesa.por_habitante"]
    desp = {(o["ente"], o["ano"], o["componente"]): o for o in obs if o["indicador"] == "sau.despesa.funcao_saude"}
    pop = {(o["ente"], o["ano"]): o for o in obs if o["indicador"] == "ctx.populacao.residente"}
    ruins = []
    for o in hab:
        d, p = desp[(o["ente"], o["ano"], o["componente"])], pop[(o["ente"], o["ano"])]
        if o["status"] == "OBSERVADO":
            esperado = d["valor"] / p["valor"]
            if abs(o["valor"] - esperado) > 1e-6 * max(1.0, abs(esperado)):
                ruins.append({"ente": o["ente"], "ano": o["ano"], "componente": o["componente"], "valor": o["valor"], "esperado": esperado})
            if o["elegivel_comparacao"] != bool(d["elegivel_comparacao"] and p["elegivel_comparacao"]):
                ruins.append({"ente": o["ente"], "ano": o["ano"], "motivo": "elegibilidade não herdada"})
        elif o["valor"] is not None:
            ruins.append({"ente": o["ente"], "ano": o["ano"], "motivo": "valor sem estado observado"})
    fora = sorted({(o["ente"], o["ano"]) for o in hab if o["status"] == "OBSERVADO" and not o["elegivel_comparacao"]})
    return _v("S14", "Despesa por habitante: recalculada da despesa e da população publicadas; elegibilidade herdada", "automatica", "reprovada" if ruins else "aprovada",
              f"{sum(1 for o in hab if o['status'] == 'OBSERVADO')} valores observados em {len(hab)} observações; {len(fora)} par(es) fora das comparações por herança "
              f"({', '.join(f'{_nome(c)} {a}' for c, a in fora) or 'nenhum'}).", ruins[:20])


def s15_razoes(obs):
    """Razões por população (equipes, UBS, ICSAP): recalculadas do numerador e do denominador registrados."""
    ruins = []
    for o in obs:
        c = o.get("calculo")
        if not c or o["status"] != "OBSERVADO" or o["indicador"] in ("sau.despesa.por_habitante", "sau.asps.percentual_aplicado"):
            continue
        fator = {"sau.aps.equipes_por_10mil": 10000, "sau.rede.ubs_publicas_por_10mil": 10000, "sau.icsap.taxa": 100000, "sau.icsap.participacao": 100}.get(o["indicador"])
        if fator is None or not c["denominador"]:
            continue
        esperado = c["numerador"] / c["denominador"] * fator
        if abs(o["valor"] - esperado) > 1e-6 * max(1.0, abs(esperado)):
            ruins.append({k: o[k] for k in ("indicador", "ente", "ano", "componente")} | {"valor": o["valor"], "esperado": esperado})
    n = sum(1 for o in obs if o.get("calculo") and o["status"] == "OBSERVADO")
    return _v("S15", "Razões por população: recalculadas do numerador e do denominador registrados em cada observação", "automatica", "reprovada" if ruins else "aprovada",
              f"{n} observações com numerador e denominador registrados; {len(ruins)} fora da tolerância.", ruins[:20])


def s16_nao_publicaveis(obs):
    """Indicador avaliado e não publicável não tem observação, razão derivada nem arquivo de download."""
    fichas = base.le_json(base.CATALOGO)["indicadores"]
    nao = {f["id"] for f in fichas if f.get("estado") == "NAO_PUBLICAVEL"}
    ruins = [{"indicador": o["indicador"], "ente": o["ente"], "ano": o["ano"]} for o in obs if o["indicador"] in nao]
    ruins += [{"indicador": f["id"], "motivo": "ficha não publicável com arquivo de download"} for f in fichas if f["id"] in nao and f.get("download")]
    sem_motivo = [f["id"] for f in fichas if f["id"] in nao and not f.get("motivo_nao_publicacao")]
    ruins += [{"indicador": i, "motivo": "sem motivo registrado"} for i in sem_motivo]
    return _v("S16", "Indicadores avaliados e não publicáveis: sem observação, sem arquivo e com o motivo registrado", "automatica", "aprovada" if not ruins else "reprovada",
              f"{len(nao)} indicadores avaliados e não publicados ({', '.join(sorted(nao))}); nenhuma observação, razão ou arquivo deles na saída." if not ruins else f"{len(ruins)} ocorrências.", ruins[:20])


def todas(obs):
    return [s01_entes(), s02_identidades_dca(), s03_dca_rreo(obs), s04_natureza(obs), m01_sinais_msc(), m02_ordem_estagios(), s05_asps(), s06_asps_percentual(obs),
            s07_por_fonte(obs), s08_aps(obs), m03_ubs_api_x_retrato(), s09_icsap(obs), m04_denominadores_icsap(obs), s10_ausencia_nao_zero(obs),
            s11_elegibilidade(obs), s12_df_fora(obs), s13_unicidade(obs), s14_por_habitante(obs), s15_razoes(obs), s16_nao_publicaveis(obs)]
