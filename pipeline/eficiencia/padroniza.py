"""Padronização: do seed às observações tipadas do painel.

Uma observação é um dicionário com:

    indicador   id estável do catálogo
    ente        código IBGE do município (7 dígitos)
    ano         exercício financeiro, ano do Censo ou edição do Ideb
    etapa       id da etapa (catalogo_indicadores.json) ou None
    componente  parte do indicador (ex.: "nominal", "real_2025", "365", "matematica")
    valor       número ou None
    status      chave de base.STATUS; só OBSERVADO tem valor
    nota        motivo do estado, código da fonte (ND, ND*, "--") ou observação
    fonte       chave da captura no manifesto do seed
    registro    onde o valor está na fonte

Nenhuma ausência vira zero. Zero só aparece quando a própria fonte informa zero
(por exemplo, uma etapa sem matrícula na rede no Censo Escolar).
"""
import functools
import os
import re

from pipeline.eficiencia import base, entes

ANOS_FINANCEIROS = list(range(2021, 2026))
ANOS_CENSO = list(range(2021, 2026))
EDICOES_IDEB = list(range(2005, 2026, 2))

ETAPAS_CENSO = [
    ("creche", "QT_MAT_INF_CRE"),
    ("pre_escola", "QT_MAT_INF_PRE"),
    ("anos_iniciais", "QT_MAT_FUND_AI"),
    ("anos_finais", "QT_MAT_FUND_AF"),
    ("ensino_medio", "QT_MAT_MED"),
    ("eja", "QT_MAT_EJA"),
]

SUBFUNCOES_ROTULO = {
    "361": "Ensino fundamental",
    "362": "Ensino médio",
    "363": "Ensino profissional",
    "364": "Ensino superior",
    "365": "Educação infantil",
    "366": "Educação de jovens e adultos",
    "367": "Educação especial",
    "368": "Educação básica",
    "122": "Administração geral",
    "FU12": "Demais subfunções (agregação da DCA)",
}


def _int(v):
    v = (v or "").strip()
    return int(v) if v else 0


def _num_inep(v):
    """Número publicado pelo INEP (ponto ou vírgula decimal) ou None com o código original."""
    s = (v or "").strip()
    if s == "":
        return None, "célula vazia"
    if re.fullmatch(r"-?\d+(\.\d+)?", s):
        return float(s), None
    if re.fullmatch(r"-?\d+,\d+", s):
        return float(s.replace(",", ".")), None
    return None, s


def _obs(indicador, ente, ano, valor, status, fonte, registro, etapa=None, componente=None, nota=None, **extra):
    o = {
        "indicador": indicador, "ente": ente, "ano": ano, "etapa": etapa, "componente": componente,
        "valor": valor if status == "OBSERVADO" else None, "status": status, "nota": nota,
        "fonte": fonte, "registro": registro,
    }
    o.update(extra)
    return o


# ------------------------------------------------------------------ IPCA

def fatores_ipca():
    """Fator para reais de 2025 por ano: média anual do índice de 2025 ÷ média do ano."""
    caminho = os.path.join(base.SEED, "ibge_ipca", "ipca_numero_indice_2021_2025.json.gz")
    serie = base.le_json_gz(caminho)[0]["resultados"][0]["series"][0]["serie"]
    por_ano = {}
    for per, v in serie.items():
        por_ano.setdefault(int(per[:4]), []).append(float(v))
    medias = {a: sum(v) / len(v) for a, v in por_ano.items() if len(v) == 12}
    # fator com 10 casas: o valor real publicado é reproduzível a partir do fator publicado
    return {a: round(medias[2025] / m, 10) for a, m in medias.items()}, medias


# ------------------------------------------------------------------ Siconfi

def _linhas_dca(cod, ano):
    caminho = os.path.join(base.SEED, "siconfi", "dca_anexo_i_e", f"{cod}_{ano}.json.gz")
    if not os.path.exists(caminho):
        return None
    return base.le_json_gz(caminho)


def despesa():
    fatores, _ = fatores_ipca()
    obs = []
    for cod, nome, uf in entes.CAPITAIS:
        for ano in ANOS_FINANCEIROS:
            linhas = _linhas_dca(cod, ano)
            reg = f"DCA {ano}, Anexo I-E, conta \"12 - Educação\", coluna \"Despesas Liquidadas\""
            if linhas is None:
                obs.append(_obs("edu.despesa.funcao_educacao", cod, ano, None, "AUSENTE_NA_COLETA",
                                "siconfi_dca_anexo_i_e", reg, componente="nominal",
                                nota="Resposta do Siconfi não encontrada no seed"))
                continue
            liq = [x for x in linhas if x["coluna"] == "Despesas Liquidadas"]
            e = [x["valor"] for x in liq if x["conta"] == "12 - Educação"]
            if not e:
                obs.append(_obs("edu.despesa.funcao_educacao", cod, ano, None, "AUSENTE_NA_COLETA",
                                "siconfi_dca_anexo_i_e", reg, componente="nominal",
                                nota="DCA sem a linha da função Educação"))
                continue
            v = round(float(e[0]), 2)
            conf = conferencia_rreo(cod, ano, v)
            extra = {"conferencia_rreo": conf}
            nota = conf.get("explicacao")
            obs.append(_obs("edu.despesa.funcao_educacao", cod, ano, v, "OBSERVADO",
                            "siconfi_dca_anexo_i_e", reg, componente="nominal", nota=nota, **extra))
            obs.append(_obs("edu.despesa.funcao_educacao", cod, ano, round(v * fatores[ano], 2), "OBSERVADO",
                            "siconfi_dca_anexo_i_e", reg + "; corrigido pelo IPCA (média anual) para reais de 2025",
                            componente="real_2025", nota=nota, fator_ipca=fatores[ano], **extra))
            # composição por subfunção
            subs = []
            for x in liq:
                m = re.match(r"^12\.(\d{3}) - ", x["conta"])
                if m:
                    subs.append((m.group(1), float(x["valor"]), x["conta"]))
                elif x["conta"].startswith("FU12 "):
                    subs.append(("FU12", float(x["valor"]), x["conta"]))
            soma = sum(s[1] for s in subs)
            reconcilia = abs(soma - v) <= 1.0
            for codigo, valor, conta in sorted(subs, key=lambda s: s[0]):
                registro = f"DCA {ano}, Anexo I-E, conta \"{conta}\", coluna \"Despesas Liquidadas\""
                if reconcilia:
                    obs.append(_obs("edu.despesa.subfuncao", cod, ano, round(valor, 2), "OBSERVADO",
                                    "siconfi_dca_anexo_i_e", registro, componente=codigo,
                                    participacao=round(100 * valor / v, 4) if v else None))
                else:
                    obs.append(_obs("edu.despesa.subfuncao", cod, ano, None, "INCONSISTENTE",
                                    "siconfi_dca_anexo_i_e", registro, componente=codigo,
                                    nota=f"Soma das subfunções (R$ {soma:,.2f}) difere do total da função (R$ {v:,.2f})"))
    return obs


def rreo_educacao(cod, ano):
    """Despesa liquidada até o 6º bimestre na função Educação, separada em exceto intra e intraorçamentária.
    Devolve None se a captura não existe; cada parte é None se a linha não existe."""
    caminho = os.path.join(base.SEED, "siconfi", "rreo_anexo_02_b6", f"{cod}_{ano}.json.gz")
    if not os.path.exists(caminho):
        return None
    out = {"exceto_intra": None, "intra": None}
    for x in base.le_json_gz(caminho):
        if x["conta"] == "Educação" and x["coluna"].startswith("DESPESAS LIQUIDADAS ATÉ O BIMESTRE"):
            out["exceto_intra" if "Exceto" in x["rotulo"] else "intra"] = float(x["valor"])
    return out


def rreo_educacao_liquidada(cod, ano):
    r = rreo_educacao(cod, ano)
    return r["exceto_intra"] if r else None


def brl(v):
    """R$ no padrão brasileiro: 1.234.567,89."""
    txt = f"{abs(v):,.2f}".replace(",", "§").replace(".", ",").replace("§", ".")
    return ("−R$ " if v < 0 else "R$ ") + txt


def pct_br(v, casas=1):
    return f"{v:+.{casas}f}".replace(".", ",").replace("-", "−") + "%"


def conferencia_rreo(cod, ano, dca):
    """Compara a DCA com o RREO do 6º bimestre e explica a diferença quando possível.
    comparavel = False quando a DCA reúne despesas que o RREO separa como intraorçamentárias."""
    r = rreo_educacao(cod, ano)
    if not r or r["exceto_intra"] is None:
        return {"situacao": "sem_rreo", "comparavel": True}
    rreo = r["exceto_intra"]
    dif = dca - rreo
    if abs(dif) <= 1.0:
        return {"situacao": "confere", "comparavel": True, "rreo": round(rreo, 2)}
    pct = round(100 * dif / rreo, 3) if rreo else None
    base_c = {"rreo": round(rreo, 2), "diferenca": round(dif, 2), "diferenca_pct": pct}
    if r["intra"] is not None and abs(dif - r["intra"]) <= 1.0:
        return {"situacao": "inclui_intra", "comparavel": False, "rreo_intra": round(r["intra"], 2), **base_c,
                "explicacao": (f"O valor da DCA é igual à soma das despesas liquidadas exceto intraorçamentárias "
                               f"({brl(rreo)}) e intraorçamentárias ({brl(r['intra'])}) do RREO do 6º bimestre. A declaração "
                               "incluiu na função Educação despesas que as demais capitais apresentam em linha separada; "
                               "por isso o valor fica fora da comparação entre capitais.")}
    if abs(pct) < 1:
        return {"situacao": "diferenca_menor", "comparavel": True, **base_c,
                "explicacao": (f"O RREO do 6º bimestre informa {brl(rreo)}. A DCA, usada pelo painel, informa {brl(dca)}: "
                               f"diferença de {brl(dif)} ({pct_br(pct, 3)} sobre o valor do RREO).")}
    return {"situacao": "diverge", "comparavel": True, **base_c,
            "explicacao": (f"O RREO do 6º bimestre informa {brl(rreo)} liquidados na função Educação; a DCA, declaração "
                           f"anual de contas usada pelo painel, informa {brl(dca)} ({pct_br(pct)} sobre o valor do RREO). "
                           "A diferença não foi explicada por conceito, período ou perímetro e está registrada na validação V04.")}


# ------------------------------------------------------------------ Censo Escolar

@functools.lru_cache(maxsize=None)
def escolas(ano):
    caminho = os.path.join(base.SEED, "inep_censo", f"escolas_capitais_{ano}.csv.gz")
    return base.le_csv_gz(caminho) if os.path.exists(caminho) else None


def _somas(linhas):
    tot = {"total": 0, "profissional": 0}
    for e, _ in ETAPAS_CENSO:
        tot[e] = 0
    for l in linhas:
        bas = _int(l["QT_MAT_BAS"])
        tot["total"] += bas
        parcial = 0
        for e, col in ETAPAS_CENSO:
            n = _int(l[col])
            tot[e] += n
            parcial += n
        tot["profissional"] += bas - parcial
    return tot


def _rede_municipal(linhas, cod):
    return [l for l in linhas if l["CO_MUNICIPIO"] == str(cod) and l["TP_DEPENDENCIA"] == "3"]


def _conveniadas(linhas, cod, tipo="1"):
    return [l for l in linhas if l["CO_MUNICIPIO"] == str(cod) and l["TP_DEPENDENCIA"] == "4"
            and l["IN_PODER_PUBLICO_PARCERIA"] == "1" and l["TP_PODER_PUBLICO_PARCERIA"] == tipo]


def matriculas():
    obs = []
    etapas = ["total"] + [e for e, _ in ETAPAS_CENSO] + ["profissional"]
    for ano in ANOS_CENSO:
        linhas = escolas(ano)
        for cod, nome, uf in entes.CAPITAIS:
            for ind, filtro, desc in (
                ("edu.matriculas.rede_municipal", _rede_municipal, "TP_DEPENDENCIA = 3"),
                ("edu.matriculas.conveniadas_municipais", _conveniadas,
                 "TP_DEPENDENCIA = 4, IN_PODER_PUBLICO_PARCERIA = 1, TP_PODER_PUBLICO_PARCERIA = 1"),
            ):
                reg = f"Censo Escolar {ano}, escolas com CO_MUNICIPIO = {cod} e {desc}"
                if linhas is None:
                    for e in etapas:
                        obs.append(_obs(ind, cod, ano, None, "AUSENTE_NA_COLETA", f"inep_censo_{ano}", reg, etapa=e,
                                        nota="Microdados do ano não integrados"))
                    continue
                sel = filtro(linhas, cod)
                s = _somas(sel)
                for e in etapas:
                    obs.append(_obs(ind, cod, ano, s[e], "OBSERVADO", f"inep_censo_{ano}", reg, etapa=e,
                                    escolas=len(sel)))
    return obs


@functools.lru_cache(maxsize=None)
def matriculas_rede(ano, cod):
    """Somas da rede municipal (para decidir 'não aplicável' nos indicadores do INEP)."""
    linhas = escolas(ano)
    if linhas is None:
        return None
    return _somas(_rede_municipal(linhas, cod))


# ------------------------------------------------------------------ INEP: ATU e rendimento

ATU_COLUNAS = {"creche": "CRE_CAT_0", "pre_escola": "PRE_CAT_0", "anos_iniciais": "FUN_AI_CAT_0", "anos_finais": "FUN_AF_CAT_0"}
REND_COLUNAS = {"anos_iniciais": "1_CAT_FUN_AI", "anos_finais": "1_CAT_FUN_AF"}


def _status_codigo_inep(codigo, ano, cod, etapa):
    """'--' e células vazias: não aplicável se a rede não tem matrícula na etapa; senão, não divulgado."""
    somas = matriculas_rede(ano, cod)
    if somas is not None and somas.get(etapa, None) == 0:
        return "NAO_APLICAVEL", f"Código \"{codigo}\" na planilha do INEP; a rede municipal não tem matrícula na etapa no Censo {ano}"
    return "NAO_DIVULGADO", f"Código \"{codigo}\" na planilha do INEP"


def _indicador_inep(ind, tipo, colunas, unidade_reg):
    obs = []
    for ano in ANOS_CENSO:
        caminho = os.path.join(base.SEED, f"inep_{tipo}", f"{tipo}_capitais_{ano}.csv.gz")
        linhas = base.le_csv_gz(caminho) if os.path.exists(caminho) else None
        for cod, nome, uf in entes.CAPITAIS:
            for etapa, col in colunas.items():
                reg = f"{unidade_reg} {ano}, CO_MUNICIPIO = {cod}, NO_CATEGORIA = Total, NO_DEPENDENCIA = Municipal, coluna {col}"
                if linhas is None:
                    obs.append(_obs(ind, cod, ano, None, "AUSENTE_NA_COLETA", f"inep_{tipo}_{ano}", reg, etapa=etapa,
                                    nota="Planilha do ano não integrada"))
                    continue
                l = [x for x in linhas if x["CO_MUNICIPIO"] == str(cod) and x["NO_CATEGORIA"].strip() == "Total"
                     and x["NO_DEPENDENCIA"].strip() == "Municipal"]
                if not l:
                    st, nota = _status_codigo_inep("linha ausente", ano, cod, etapa)
                    obs.append(_obs(ind, cod, ano, None, st, f"inep_{tipo}_{ano}", reg, etapa=etapa, nota=nota))
                    continue
                v, codigo = _num_inep(l[0][col])
                if v is None:
                    st, nota = _status_codigo_inep(codigo, ano, cod, etapa)
                    obs.append(_obs(ind, cod, ano, None, st, f"inep_{tipo}_{ano}", reg, etapa=etapa, nota=nota))
                else:
                    obs.append(_obs(ind, cod, ano, v, "OBSERVADO", f"inep_{tipo}_{ano}", reg, etapa=etapa))
    return obs


def atu():
    return _indicador_inep("edu.atu.rede_municipal", "atu", ATU_COLUNAS, "INEP, Média de Alunos por Turma")


def aprovacao():
    return _indicador_inep("edu.aprovacao.rede_municipal", "rendimento", REND_COLUNAS, "INEP, Taxas de Rendimento")


# ------------------------------------------------------------------ Ideb e Saeb

NOTAS_IDEB = {
    "-": "Sem resultado para a rede municipal nesta edição (código \"-\" na planilha do INEP)",
    "ND": "Número de participantes no Saeb insuficiente para divulgação (código \"ND\" do INEP)",
    "ND*": "Não divulgação solicitada, Portarias INEP nº 410/2011 ou nº 304/2013 (código \"ND*\")",
    "ND***": "Município com pelo menos 20% do material extraviado, participação insuficiente (código \"ND***\")",
}


def _nota_ideb(codigo):
    return NOTAS_IDEB.get(codigo, f"Código \"{codigo}\" na planilha do INEP")


def ideb_saeb():
    obs = []
    for etapa, tipo in (("anos_iniciais", "ideb_ai"), ("anos_finais", "ideb_af")):
        caminho = os.path.join(base.SEED, f"inep_{tipo}", f"{tipo}_capitais_2025.csv.gz")
        linhas = base.le_csv_gz(caminho)
        for cod, nome, uf in entes.CAPITAIS:
            l = [x for x in linhas if x["CO_MUNICIPIO"] == str(cod) and x["REDE"].strip() == "Municipal"]
            for ano in EDICOES_IDEB:
                base_reg = f"INEP, Ideb 2025 ({'anos iniciais' if etapa == 'anos_iniciais' else 'anos finais'}), CO_MUNICIPIO = {cod}, REDE = Municipal"
                campos = [
                    ("edu.ideb.rede_municipal", "ideb", f"VL_OBSERVADO_{ano}"),
                    ("edu.ideb.rede_municipal", "p_rendimento", f"VL_INDICADOR_REND_{ano}"),
                    ("edu.ideb.rede_municipal", "n_nota_padronizada", f"VL_NOTA_MEDIA_{ano}"),
                    ("edu.saeb.rede_municipal", "matematica", f"VL_NOTA_MATEMATICA_{ano}"),
                    ("edu.saeb.rede_municipal", "portugues", f"VL_NOTA_PORTUGUES_{ano}"),
                ]
                for ind, comp, col in campos:
                    reg = f"{base_reg}, coluna {col}"
                    if not l:
                        obs.append(_obs(ind, cod, ano, None, "NAO_DIVULGADO", f"inep_{tipo}_2025", reg, etapa=etapa,
                                        componente=comp, nota="A planilha do INEP não traz linha para a rede municipal"))
                        continue
                    v, codigo = _num_inep(l[0].get(col, ""))
                    if v is None:
                        st, nota = "NAO_DIVULGADO", _nota_ideb(codigo)
                        somas = matriculas_rede(ano, cod) if ano in ANOS_CENSO else None
                        if codigo == "-" and somas is not None and somas.get(etapa) == 0:
                            st = "NAO_APLICAVEL"
                            nota += f"; a rede municipal não tem matrícula na etapa no Censo {ano}"
                        obs.append(_obs(ind, cod, ano, None, st, f"inep_{tipo}_2025", reg, etapa=etapa,
                                        componente=comp, nota=nota))
                    else:
                        obs.append(_obs(ind, cod, ano, v, "OBSERVADO", f"inep_{tipo}_2025", reg, etapa=etapa,
                                        componente=comp))
    return obs


def todas():
    return despesa() + matriculas() + atu() + aprovacao() + ideb_saeb()
