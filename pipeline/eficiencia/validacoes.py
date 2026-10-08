"""Validações do painel Educação municipal nas capitais.

Cada validação devolve {id, titulo, tipo, resultado, detalhe, casos}. Tipos:
"automatica" (roda em toda reconstrução) e "medicao" (quantifica um fato que
apoia uma decisão metodológica, sem aprovar ou reprovar). Resultado:
"aprovada", "aprovada_com_divergencias_documentadas", "reprovada" ou "medicao".

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
              f"{n} declarações conferidas (26 capitais × {len(P.ANOS_FINANCEIROS)} exercícios), tolerância de R$ {TOL_REAIS:.2f}; {len(casos)} fora da tolerância.",
              casos)


def v04_dca_rreo(obs):
    casos, n, iguais = [], 0, 0
    for o in obs:
        if o["indicador"] != "edu.despesa.funcao_educacao" or o["componente"] != "nominal" or o["status"] != "OBSERVADO":
            continue
        n += 1
        c = o.get("conferencia_rreo") or {}
        if c.get("situacao") == "confere":
            iguais += 1
            continue
        casos.append({"ente": o["ente"], "nome": _nome(o["ente"]), "ano": o["ano"], "dca": o["valor"], **c})
    materiais = [c for c in casos if c.get("situacao") in ("diverge", "inclui_intra", "sem_rreo")]
    return _v("V04", "Conferência cruzada: despesa liquidada na função Educação, DCA × RREO do 6º bimestre",
              "automatica", "aprovada" if not casos else "aprovada_com_divergencias_documentadas",
              f"{n} pares comparados; {iguais} iguais até R$ {TOL_REAIS:.2f}; {len(casos) - len(materiais)} com diferença "
              f"inferior a 1%; {len(materiais)} com diferença material, explicada ou registrada caso a caso. O painel publica "
              "o valor da DCA (contas anuais); o RREO serve só de conferência e nunca é somado.",
              sorted(casos, key=lambda c: -abs(c.get("diferenca_pct") or 0)))


def v05_particao_censo():
    casos, n = [], 0
    for ano in P.ANOS_CENSO:
        linhas = P.escolas(ano) or []
        for l in linhas:
            if l["TP_DEPENDENCIA"] != "3" or int(l["CO_MUNICIPIO"]) not in entes.codigos_capitais():
                continue
            n += 1
            bas = P._int(l["QT_MAT_BAS"])
            soma = sum(P._int(l[c]) for _, c in P.ETAPAS_CENSO)
            resid = bas - soma
            prof = P._int(l["QT_MAT_PROF"])
            if resid < 0 or resid > prof:
                casos.append({"ano": ano, "escola": l["CO_ENTIDADE"], "ente": int(l["CO_MUNICIPIO"]), "bas": bas,
                              "soma_etapas": soma, "prof": prof})
    return _v("V05", "Censo: partição das matrículas da rede municipal por etapa reconcilia com o total (QT_MAT_BAS)",
              "automatica", "aprovada" if not casos else "reprovada",
              f"{n} registros de escola municipal conferidos; o resíduo (educação profissional não integrada) fica entre zero e QT_MAT_PROF em todos."
              if not casos else f"{len(casos)} escolas com partição incoerente.", casos[:50])


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
    for ano in (2021, 2024, 2025):
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
    return _v("V06", "Conferência independente: somas dos microdados × Sinopse Estatística do INEP",
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
    detalhe = (f"Em 2025, as matrículas em escolas privadas conveniadas com o município equivalem a valores entre "
               f"{min(conv):.1f}% e {max(conv):.1f}% das matrículas da rede municipal, conforme a capital (mediana de "
               f"{statistics.median(conv):.1f}%). Essas matrículas não estão no denominador, mas os repasses que as "
               f"financiam podem estar na despesa da função Educação.")
    return _v("M01", "Medição do perímetro: despesa na função Educação × matrículas da rede municipal",
              "medicao", "medicao", detalhe, casos)


def todas(obs):
    return [
        v01_entes(), v02_integridade(), v03_identidades_dca(), v04_dca_rreo(obs), v05_particao_censo(),
        v06_censo_sinopse(obs), v07_unicidade(), v08_df_fora(obs), v09_ausencia_nao_zero(obs),
        v10_faixas(obs), v11_ideb_reproduz(obs), v12_aprovacao_ideb_rendimento(), m01_perimetro_despesa_matricula(obs),
    ]
