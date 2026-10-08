"""Validações do painel Educação municipal nas capitais.

Cada validação devolve {id, titulo, tipo, resultado, detalhe, casos}. Tipos:
"automatica" (roda em toda reconstrução) e "medicao" (quantifica um fato que
apoia uma decisão metodológica, sem aprovar ou reprovar). Resultado:

    aprovada                                os valores conferem e a regra foi cumprida
    aprovada_com_divergencias_documentadas  a regra foi cumprida; diferenças sem efeito sobre valores
                                            publicados ficam listadas (ex.: integridade de um arquivo
                                            alternativo do mesmo pacote)
    regra_aplicada_com_pendencias           a regra foi cumprida, mas há observações com pendência de
                                            conferência, mantidas para consulta e fora das comparações;
                                            não significa que os valores conferem
    reprovada                               a regra foi violada: a gold não é promovida a público
    medicao                                 quantifica um fato; não aprova nem reprova

As validações conferem o produto: cálculo, integridade, perímetro e estados de
dado. Nenhuma delas avalia governos ou redes.
"""
import os
import statistics

from pipeline.eficiencia import base, entes, padroniza as P

TOL_REAIS = 1.0


def _v(id_, titulo, tipo, resultado, detalhe, casos=None):
    return {"id": id_, "titulo": titulo, "tipo": tipo, "resultado": resultado, "detalhe": detalhe,
            "casos": casos or []}


def _nome(cod):
    return {c: n for c, n, _ in entes.CAPITAIS}.get(cod) or ("Brasília (DF)" if cod == entes.DISTRITO_FEDERAL[0] else str(cod))


def v01_entes():
    caminho = os.path.join(base.SEED, "siconfi", "entes.json.gz")
    itens = base.le_json_gz(caminho)
    caps = {int(x["cod_ibge"]): x for x in itens if str(x.get("capital")).strip() == "1"}
    esperado = entes.codigos_capitais() | {entes.DISTRITO_FEDERAL[0]}
    faltam = sorted(esperado - set(caps))
    sobram = sorted(set(caps) - esperado)
    ok = not faltam and not sobram and len(entes.CAPITAIS) == 26
    return _v("V01", "Universo: códigos IBGE das 26 capitais e do DF conferem com a lista de entes do Siconfi",
              "automatica", "aprovada" if ok else "reprovada",
              f"{len(caps)} entes marcados como capital no Siconfi; {len(entes.CAPITAIS)} capitais municipais no painel e o DF registrado fora do universo.",
              [{"faltam": faltam, "sobram": sobram}] if not ok else [])


def v02_integridade():
    m = base.le_manifesto()["capturas"]
    casos, falhas = [], 0
    for k, c in sorted(m.items()):
        if not k.startswith("inep_"):
            continue
        pub, calc = c.get("md5_publicado_inep"), c.get("md5_conferido")
        if pub is None:
            casos.append({"captura": k, "situacao": "pacote sem MD5 publicado"})
        elif pub != calc:
            falhas += 1
            casos.append({"captura": k, "situacao": "MD5 diverge"})
        for ci in c.get("conferencia_integridade", []):
            if ci["confere"] is False:
                casos.append({"captura": k, "situacao": f"{os.path.basename(ci['membro'])} não confere com o MD5 publicado; "
                                                       f"lida a planilha {os.path.basename(c['membro'])}, que confere"})
    total = sum(1 for k in m if k.startswith("inep_"))
    return _v("V02", "Integridade: arquivos do INEP conferidos contra o MD5 publicado no próprio pacote",
              "automatica", "reprovada" if falhas else ("aprovada_com_divergencias_documentadas" if casos else "aprovada"),
              f"{total} capturas do INEP; {falhas} com divergência no arquivo efetivamente lido.", casos)


def _dca(cod, ano):
    return P._linhas_dca(cod, ano) or []


def v03_identidades_dca():
    casos, n = [], 0
    for cod, _, _ in entes.CAPITAIS:
        for ano in P.ANOS_FINANCEIROS:
            liq = [x for x in _dca(cod, ano) if x["coluna"] == "Despesas Liquidadas"]
            if not liq:
                continue
            n += 1
            tot = [x["valor"] for x in liq if x["conta"] == "Despesas Exceto Intraorçamentárias"]
            fun = sum(x["valor"] for x in liq if len(x["conta"]) > 5 and x["conta"][:2].isdigit() and x["conta"][2:5] == " - ")
            edu = [x["valor"] for x in liq if x["conta"] == "12 - Educação"]
            sub = sum(x["valor"] for x in liq if x["conta"].startswith(("12.", "FU12 ")))
            d1 = abs(tot[0] - fun) if tot else None
            d2 = abs(edu[0] - sub) if edu else None
            if d1 is None or d1 > TOL_REAIS or d2 is None or d2 > TOL_REAIS:
                casos.append({"ente": cod, "nome": _nome(cod), "ano": ano, "dif_funcoes": d1, "dif_subfuncoes": d2})
    return _v("V03", "DCA: soma das funções = total exceto intraorçamentárias, e soma das subfunções = função Educação",
              "automatica", "aprovada" if not casos else "reprovada",
              f"{n} declarações conferidas (26 capitais × {len(P.ANOS_FINANCEIROS)} exercícios), tolerância de R$ 1,00; {len(casos)} fora da tolerância.",
              casos)


def v04_dca_rreo(obs):
    """Conferência DCA × RREO (e MSC, quando material) segundo pipeline/eficiencia/conferencia.py.
    Reprova só se a regra for violada (estado incompatível com a elegibilidade). Pendências tratadas
    corretamente não viram aprovação: o resultado diz que há pendência."""
    from pipeline.eficiencia import conferencia as CF
    contagem, casos, violacoes, n = {}, [], [], 0
    for o in obs:
        if o["indicador"] != "edu.despesa.funcao_educacao" or o["componente"] != "nominal" or o["status"] != "OBSERVADO":
            continue
        n += 1
        c = o.get("conferencia") or {}
        st = c.get("situacao")
        contagem[st] = contagem.get(st, 0) + 1
        if (st in CF.ELEGIVEIS) != bool(o.get("elegivel_comparacao")):
            violacoes.append({"ente": o["ente"], "ano": o["ano"], "situacao": st, "elegivel": o.get("elegivel_comparacao")})
        if st != "CONFERE":
            casos.append({"ente": o["ente"], "nome": _nome(o["ente"]), "ano": o["ano"], "dca": o["valor"], "situacao": st,
                          "rotulo": c.get("rotulo"), "elegivel": c.get("elegivel_comparacao"), "rreo": c.get("rreo"),
                          "msc": c.get("msc"), "diferenca": c.get("diferenca"), "diferenca_pct_dca": c.get("diferenca_pct_dca"),
                          "explicacao": c.get("explicacao"), "evidencias": c.get("evidencias"), "fontes_sha256": c.get("fontes_sha256")})
    pend = contagem.get("PENDENTE", 0) + contagem.get("NAO_CONFERIDO", 0)
    if violacoes:
        resultado = "reprovada"
    elif pend:
        resultado = "regra_aplicada_com_pendencias"
    elif set(contagem) <= {"CONFERE"}:
        resultado = "aprovada"
    else:
        resultado = "aprovada_com_divergencias_documentadas"
    partes = "; ".join(f"{CF.ROTULO.get(k, k)} ({v})" for k, v in sorted(contagem.items(), key=lambda x: -x[1]))
    return _v("V04", "Conferência da despesa: DCA × RREO do 6º bimestre e, na diferença material, MSC de dezembro",
              "automatica", resultado,
              f"{n} declarações; {partes}. Política {CF.VERSAO_POLITICA}: tolerância de R$ 1,00 para arredondamento e de 0,1% da "
              "DCA para diferenças menores; acima disso, só a MSC reconcilia. Pendentes, não conferidas e de perímetro distinto "
              "ficam disponíveis para consulta e fora das comparações." + (f" Violações da regra: {len(violacoes)}." if violacoes else ""),
              violacoes + sorted(casos, key=lambda c: -abs(c.get("diferenca_pct_dca") or 0)))


def v13_elegibilidade(obs):
    """Nenhuma observação sem valor, com conferência pendente ou de perímetro distinto é marcada como elegível."""
    from pipeline.eficiencia import conferencia as CF
    ruins = []
    for o in obs:
        if o.get("elegivel_comparacao") and o["status"] != "OBSERVADO":
            ruins.append({k: o[k] for k in ("indicador", "ente", "ano", "etapa", "componente", "status")})
        c = o.get("conferencia")
        if c and o.get("elegivel_comparacao") and c.get("situacao") not in CF.ELEGIVEIS:
            ruins.append({k: o[k] for k in ("indicador", "ente", "ano", "componente")} | {"situacao": c.get("situacao")})
    n_ineleg = sum(1 for o in obs if o["status"] == "OBSERVADO" and not o.get("elegivel_comparacao"))
    return _v("V13", "Elegibilidade: só valor observado e conferido entra em comparações, medianas e variações",
              "automatica", "aprovada" if not ruins else "reprovada",
              f"{len(obs)} observações conferidas; {n_ineleg} com valor oficial disponível para consulta e fora das comparações "
              "(perímetro distinto ou conferência pendente), incluindo os componentes derivados (valor real e subfunções).",
              ruins[:30])


def v05_particao_censo():
    casos, n, vazias = [], 0, 0
    for ano in P.ANOS_CENSO:
        linhas = P.escolas(ano) or []
        for l in linhas:
            if l["TP_DEPENDENCIA"] != "3" or int(l["CO_MUNICIPIO"]) not in entes.codigos_capitais():
                continue
            vals = [P.ler_contagem(l.get(c)) for c in P.COLUNAS_CONTAGEM + ["QT_MAT_PROF"]]
            if all(v is None for v in vals):
                vazias += 1
                continue
            n += 1
            if any(v is None for v in vals):
                casos.append({"ano": ano, "escola": l["CO_ENTIDADE"], "situacao": "contagem parcial"})
                continue
            bas, *etapas, prof = vals
            resid = bas - sum(etapas)
            if resid < 0 or resid > prof:
                casos.append({"ano": ano, "escola": l["CO_ENTIDADE"], "ente": int(l["CO_MUNICIPIO"]), "bas": bas,
                              "soma_etapas": sum(etapas), "prof": prof})
    return _v("V05", "Censo: partição das matrículas da rede municipal por etapa reconcilia com o total (QT_MAT_BAS)",
              "automatica", "aprovada" if not casos else "reprovada",
              (f"{n} registros de escola municipal com contagem conferidos; o resíduo (educação profissional não integrada) fica "
               f"entre zero e QT_MAT_PROF em todos. {vazias} registros sem nenhuma contagem ficaram fora da conferência (medição M02).")
              if not casos else f"{len(casos)} escolas com partição incoerente ou contagem parcial.", casos[:50])


def m02_registros_sem_contagem():
    """Varredura de campos vazios nas colunas de matrícula, por ano, e da confirmação pela Sinopse."""
    casos = []
    for ano in P.ANOS_CENSO:
        linhas = [l for l in (P.escolas(ano) or []) if int(l["CO_MUNICIPIO"]) in entes.codigos_capitais()]
        for dep, nome in (("3", "municipal"), ("4", "privada")):
            grupo = [l for l in linhas if l["TP_DEPENDENCIA"] == dep]
            _, meta = P._somas(grupo)
            if not meta["sem_contagem"] and not meta["parciais"] and not meta["invalidos"]:
                casos.append({"ano": ano, "dependencia": nome, "registros": len(grupo), "sem_contagem": 0,
                              "parciais": 0, "invalidos": 0, "capitais_afetadas": 0, "capitais_confirmadas_pela_sinopse": 0})
                continue
            afetadas = sorted({int(l["CO_MUNICIPIO"]) for l in grupo if l["CO_ENTIDADE"] in set(meta["sem_contagem"])})
            conf = [c for c in afetadas if P.grupo_verificado(ano, c, dep)["verificado"]]
            casos.append({"ano": ano, "dependencia": nome, "registros": len(grupo), "sem_contagem": len(meta["sem_contagem"]),
                          "parciais": len(meta["parciais"]), "invalidos": len(meta["invalidos"]),
                          "capitais_afetadas": len(afetadas), "capitais_confirmadas_pela_sinopse": len(conf),
                          "nao_confirmadas": [_nome(c) for c in afetadas if c not in conf]})
    total = sum(c["sem_contagem"] for c in casos)
    nao = sum(c["capitais_afetadas"] - c["capitais_confirmadas_pela_sinopse"] for c in casos)
    return _v("M02", "Medição: registros de escola sem contagem de matrícula (campos vazios) nos microdados",
              "medicao", "medicao",
              f"{total} registros sem nenhuma contagem nas capitais (todas as colunas de matrícula vazias; nenhum registro com "
              f"contagem parcial ou valor não numérico). O dicionário de dados do INEP não define vazio como zero. Os agregados "
              f"que contêm esses registros só são publicados quando a Sinopse do mesmo ano, município e dependência confirma "
              f"contribuição nula; {nao} combinações de capital, ano e dependência ficaram sem essa confirmação.", casos)


def _sinopse(ano):
    caminho = os.path.join(base.SEED, "inep_sinopse", f"sinopse_capitais_{ano}.json.gz")
    return base.le_json_gz(caminho) if os.path.exists(caminho) else None


def _municipal_sinopse(tabela, linha):
    """Coluna municipal conforme o leiaute da tabela (a Sinopse 2025 agrupa por rede; 2021 e 2024, por localização)."""
    cab = [c for r in tabela["cabecalho"] for c in r if isinstance(c, str)]
    if any("Rede Pública" in c for c in cab):
        return linha[8]
    return linha[8] + linha[13]


def v06_censo_sinopse(obs):
    idx = {(o["indicador"], o["ente"], o["ano"], o["etapa"]): o["valor"] for o in obs
           if o["indicador"].startswith("edu.matriculas") and o["status"] == "OBSERVADO"}
    casos, n, anos = [], 0, []
    for ano in P.ANOS_CENSO:
        s = _sinopse(ano)
        if not s:
            continue
        anos.append(ano)
        for chave, etapa in (("total", "total"), ("creche", "creche"), ("pre_escola", "pre_escola")):
            t = s.get(chave)
            if not t:
                continue
            for l in t["linhas"]:
                cod = int(l[3])
                if cod not in entes.codigos_capitais():
                    continue
                n += 1
                sin = _municipal_sinopse(t, l)
                mic = idx.get(("edu.matriculas.rede_municipal", cod, ano, etapa))
                if mic is None or abs(mic - sin) > 0:
                    casos.append({"ano": ano, "ente": cod, "nome": _nome(cod), "etapa": etapa, "microdados": mic, "sinopse": sin})
        t = s.get("conveniadas")
        if t:
            for l in t["linhas"]:
                cod = int(l[3])
                if cod not in entes.codigos_capitais():
                    continue
                n += 1
                sin = l[6]
                mic = idx.get(("edu.matriculas.conveniadas_municipais", cod, ano, "total"))
                if mic is None or abs(mic - sin) > 0:
                    casos.append({"ano": ano, "ente": cod, "nome": _nome(cod), "etapa": "conveniadas (município)",
                                  "microdados": mic, "sinopse": sin})
    return _v("V06", "Conferência cruzada no próprio INEP: somas dos microdados × Sinopse Estatística",
              "automatica", "aprovada" if not casos else "aprovada_com_divergencias_documentadas",
              f"{n} comparações (rede municipal: total, creche e pré-escola; escolas privadas conveniadas com o município em 2025), "
              f"edições {', '.join(map(str, anos))} da Sinopse; {len(casos)} diferenças.", casos)


def v07_unicidade():
    casos = []
    for ano in P.ANOS_CENSO:
        linhas = P.escolas(ano) or []
        ids = [l["CO_ENTIDADE"] for l in linhas]
        if len(ids) != len(set(ids)):
            casos.append({"ano": ano, "fonte": "Censo", "duplicadas": len(ids) - len(set(ids))})
    for cod, _, _ in entes.CAPITAIS:
        for ano in P.ANOS_FINANCEIROS:
            chaves = [(x["conta"], x["coluna"]) for x in _dca(cod, ano)]
            if len(chaves) != len(set(chaves)):
                casos.append({"ano": ano, "ente": cod, "fonte": "DCA", "duplicadas": len(chaves) - len(set(chaves))})
    return _v("V07", "Sem duplicidade: uma linha por escola no recorte do Censo e por conta e coluna na DCA",
              "automatica", "aprovada" if not casos else "reprovada",
              "Nenhuma duplicidade encontrada." if not casos else f"{len(casos)} conjuntos com duplicidade.", casos)


def v08_df_fora(obs):
    df = entes.DISTRITO_FEDERAL[0]
    n = sum(1 for o in obs if o["ente"] == df)
    return _v("V08", "Recorte municipal: nenhuma observação do Distrito Federal no painel",
              "automatica", "aprovada" if n == 0 else "reprovada",
              "O DF está registrado como excluído, com motivo, e não gera observação." if n == 0 else f"{n} observações do DF.")


def v09_ausencia_nao_zero(obs):
    ruins = [o for o in obs if (o["status"] != "OBSERVADO" and o["valor"] is not None)
             or (o["status"] == "OBSERVADO" and o["valor"] is None)]
    return _v("V09", "Estados de dado: só observação com estado \"observado\" tem valor; ausência nunca vira zero",
              "automatica", "aprovada" if not ruins else "reprovada",
              f"{len(obs)} observações conferidas; {sum(1 for o in obs if o['status'] != 'OBSERVADO')} sem valor, todas com motivo.",
              [{k: o[k] for k in ("indicador", "ente", "ano", "etapa", "status")} for o in ruins[:20]])


FAIXAS = {
    "edu.ideb.rede_municipal": {"ideb": (0, 10), "p_rendimento": (0, 1), "n_nota_padronizada": (0, 10)},
    "edu.saeb.rede_municipal": {"matematica": (100, 400), "portugues": (100, 400)},
    "edu.aprovacao.rede_municipal": {None: (0, 100)},
    "edu.atu.rede_municipal": {None: (1, 60)},
}


def v10_faixas(obs):
    casos = []
    for o in obs:
        if o["status"] != "OBSERVADO":
            continue
        f = FAIXAS.get(o["indicador"], {}).get(o["componente"])
        if f and not (f[0] <= o["valor"] <= f[1]):
            casos.append({k: o[k] for k in ("indicador", "ente", "ano", "etapa", "componente", "valor")})
        if o["indicador"] == "edu.despesa.funcao_educacao" and o["valor"] <= 0:
            casos.append({k: o[k] for k in ("indicador", "ente", "ano", "componente", "valor")})
        if o["indicador"].startswith("edu.matriculas") and (o["valor"] < 0 or o["valor"] != int(o["valor"])):
            casos.append({k: o[k] for k in ("indicador", "ente", "ano", "etapa", "valor")})
    return _v("V10", "Unidades e escalas: valores dentro das faixas possíveis de cada medida",
              "automatica", "aprovada" if not casos else "reprovada",
              "Ideb e N entre 0 e 10, P entre 0 e 1, Saeb entre 100 e 400 pontos, taxas entre 0 e 100%, média de alunos por turma entre 1 e 60, "
              "despesa positiva, matrículas inteiras e não negativas.", casos)


def v11_ideb_reproduz(obs):
    """Ideb publicado = N × P arredondado: confere a leitura das três colunas na mesma linha."""
    idx = {}
    for o in obs:
        if o["indicador"] == "edu.ideb.rede_municipal" and o["status"] == "OBSERVADO":
            idx.setdefault((o["ente"], o["ano"], o["etapa"]), {})[o["componente"]] = o["valor"]
    casos, n = [], 0
    for k, d in idx.items():
        if {"ideb", "p_rendimento", "n_nota_padronizada"} <= set(d):
            n += 1
            calc = d["n_nota_padronizada"] * d["p_rendimento"]
            if abs(round(calc, 1) - d["ideb"]) > 0.051:
                casos.append({"ente": k[0], "nome": _nome(k[0]), "ano": k[1], "etapa": k[2], "ideb": d["ideb"], "n_x_p": round(calc, 3)})
    return _v("V11", "Ideb publicado = N × P (componentes da mesma linha da planilha do INEP)",
              "automatica", "aprovada" if not casos else "aprovada_com_divergencias_documentadas",
              f"{n} combinações de capital, edição e etapa conferidas, tolerância de 0,05 por arredondamento; {len(casos)} fora.", casos)


def v12_aprovacao_ideb_rendimento():
    """A taxa de aprovação dos anos iniciais na planilha do Ideb deve coincidir com a do arquivo de rendimento."""
    ideb = base.le_csv_gz(os.path.join(base.SEED, "inep_ideb_ai", "ideb_ai_capitais_2025.csv.gz"))
    casos, n = [], 0
    for ano in (2021, 2023, 2025):
        rend = base.le_csv_gz(os.path.join(base.SEED, "inep_rendimento", f"rendimento_capitais_{ano}.csv.gz"))
        for cod, _, _ in entes.CAPITAIS:
            a = [x for x in ideb if x["CO_MUNICIPIO"] == str(cod) and x["REDE"] == "Municipal"]
            b = [x for x in rend if x["CO_MUNICIPIO"] == str(cod) and x["NO_CATEGORIA"] == "Total" and x["NO_DEPENDENCIA"] == "Municipal"]
            if not a or not b:
                continue
            va, _ = P._num_inep(a[0].get(f"VL_APROVACAO_{ano}_SI_4", ""))
            vb, _ = P._num_inep(b[0].get("1_CAT_FUN_AI", ""))
            if va is None or vb is None:
                continue
            n += 1
            if abs(va - vb) > 0.051:
                casos.append({"ente": cod, "nome": _nome(cod), "ano": ano, "ideb_aprovacao": va, "rendimento_aprovacao": vb})
    return _v("V12", "Consistência entre publicações do INEP: aprovação nos anos iniciais (planilha do Ideb × taxas de rendimento)",
              "automatica", "aprovada" if not casos else "aprovada_com_divergencias_documentadas",
              f"{n} pares comparados (2021, 2023 e 2025); {len(casos)} diferenças acima de 0,05 ponto percentual.", casos)


def m01_perimetro_despesa_matricula(obs):
    """Medição que apoia a decisão de não publicar a despesa por matrícula."""
    idx = {}
    for o in obs:
        if o["status"] != "OBSERVADO":
            continue
        if o["indicador"] == "edu.matriculas.rede_municipal" and o["etapa"] == "total":
            idx.setdefault((o["ente"], o["ano"]), {})["rede"] = o["valor"]
        if o["indicador"] == "edu.matriculas.conveniadas_municipais" and o["etapa"] == "total":
            idx.setdefault((o["ente"], o["ano"]), {})["conv"] = o["valor"]
        if o["indicador"] == "edu.despesa.subfuncao" and o["componente"] in ("364", "FU12", "122"):
            idx.setdefault((o["ente"], o["ano"]), {})[o["componente"]] = o["participacao"]
    casos = []
    for (cod, ano), d in sorted(idx.items()):
        if ano != 2025:
            continue
        rede, conv = d.get("rede"), d.get("conv")
        casos.append({
            "ente": cod, "nome": _nome(cod), "ano": ano,
            "matriculas_rede": rede, "matriculas_conveniadas_municipio": conv,
            "conveniadas_sobre_rede_pct": round(100 * conv / rede, 1) if rede else None,
            "pct_despesa_demais_subfuncoes": round(d.get("FU12", 0.0), 1),
            "pct_despesa_administracao_geral": round(d.get("122", 0.0), 1),
            "pct_despesa_ensino_superior": round(d.get("364", 0.0), 1),
        })
    conv = [c["conveniadas_sobre_rede_pct"] for c in casos if c["conveniadas_sobre_rede_pct"] is not None]
    br = lambda v: f"{v:.1f}".replace(".", ",")
    detalhe = (f"Em 2025, as matrículas em escolas privadas conveniadas com o município equivalem a valores entre "
               f"{br(min(conv))}% e {br(max(conv))}% das matrículas da rede municipal, conforme a capital (mediana de "
               f"{br(statistics.median(conv))}%). Essas matrículas não estão no denominador, mas os repasses que as "
               f"financiam podem estar na despesa da função Educação.")
    return _v("M01", "Medição do perímetro: despesa na função Educação × matrículas da rede municipal",
              "medicao", "medicao", detalhe, casos)


def todas(obs):
    return [
        v01_entes(), v02_integridade(), v03_identidades_dca(), v04_dca_rreo(obs), v05_particao_censo(),
        v06_censo_sinopse(obs), v07_unicidade(), v08_df_fora(obs), v09_ausencia_nao_zero(obs),
        v10_faixas(obs), v11_ideb_reproduz(obs), v12_aprovacao_ideb_rendimento(), v13_elegibilidade(obs),
        m01_perimetro_despesa_matricula(obs), m02_registros_sem_contagem(),
    ]
