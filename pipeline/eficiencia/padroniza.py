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

Campos adicionais: elegivel_comparacao (pode entrar em comparações, medianas e
variações), nota_material (a nota é uma restrição que o leitor precisa ver junto
do dado) e, na despesa, conferencia (pipeline/eficiencia/conferencia.py).

Nenhuma ausência vira zero. Zero só aparece quando a própria fonte informa zero
(por exemplo, uma etapa sem matrícula na rede no Censo Escolar). Célula vazia nos
microdados é ausência; ver ler_contagem e _somas.
"""
import functools
import os
import re

from pipeline.eficiencia import base, conferencia as CF, derivados as DV, diagnostico_pares as DG, entes

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


class ValorInvalido(ValueError):
    pass


def ler_contagem(v):
    """Contagem do Censo: dígitos -> int; vazio ou campo inexistente (None) -> None (ausente).
    Qualquer outro conteúdo é inválido. O dicionário de dados do INEP (2021 a 2025) não define
    equivalência entre célula vazia e zero, por isso o vazio nunca é lido como zero."""
    if v is None:
        return None
    t = str(v).strip()
    if t == "":
        return None
    if not t.isdigit():
        raise ValorInvalido(t)
    return int(t)


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


def _obs(indicador, ente, ano, valor, status, fonte, registro, etapa=None, componente=None, nota=None,
         elegivel_comparacao=None, nota_material=False, **extra):
    o = {
        "indicador": indicador, "ente": ente, "ano": ano, "etapa": etapa, "componente": componente,
        "valor": valor if status == "OBSERVADO" else None, "status": status, "nota": nota,
        "nota_material": bool(nota_material and nota),
        "elegivel_comparacao": (status == "OBSERVADO") if elegivel_comparacao is None else bool(elegivel_comparacao and status == "OBSERVADO"),
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
            conf = CF.conferencia(cod, ano, v)
            eleg = conf["elegivel_comparacao"]
            # reconciliada: valor elegível, mas o RREO publicado diverge de forma material; o leitor precisa ver
            material = conf["situacao"] in ("RECONCILIADA_MSC", "PENDENTE", "PERIMETRO_INTRA_MSC", "NAO_CONFERIDO")
            nota = None if conf["situacao"] == "CONFERE" else conf["explicacao"]
            comuns = dict(conferencia=conf, elegivel_comparacao=eleg, nota_material=material)
            obs.append(_obs("edu.despesa.funcao_educacao", cod, ano, v, "OBSERVADO",
                            "siconfi_dca_anexo_i_e", reg, componente="nominal", nota=nota, **comuns))
            obs.append(_obs("edu.despesa.funcao_educacao", cod, ano, round(v * fatores[ano], 2), "OBSERVADO",
                            "siconfi_dca_anexo_i_e", reg + "; corrigido pelo IPCA (média anual) para reais de 2025",
                            componente="real_2025", nota=nota, fator_ipca=fatores[ano], **comuns))
            # composição por subfunção: a reconciliação aritmética não remove a ressalva do total
            nota_sub = None
            if material:
                nota_sub = ("Participação calculada sobre o total da função Educação deste exercício, que tem ressalva: "
                            + conf["explicacao"])
            subs = []
            for x in liq:
                m = re.match(r"^12\.(\d{3}) - ", x["conta"])
                if m:
                    subs.append((m.group(1), float(x["valor"]), x["conta"]))
                elif x["conta"].startswith("FU12 "):
                    subs.append(("FU12", float(x["valor"]), x["conta"]))
            soma = sum(s_[1] for s_ in subs)
            reconcilia = abs(soma - v) <= 1.0
            for codigo, valor, conta in sorted(subs, key=lambda s_: s_[0]):
                registro = f"DCA {ano}, Anexo I-E, conta \"{conta}\", coluna \"Despesas Liquidadas\""
                if reconcilia:
                    obs.append(_obs("edu.despesa.subfuncao", cod, ano, round(valor, 2), "OBSERVADO",
                                    "siconfi_dca_anexo_i_e", registro, componente=codigo, nota=nota_sub,
                                    elegivel_comparacao=eleg, nota_material=material,
                                    participacao=round(100 * valor / v, 4) if v else None))
                else:
                    obs.append(_obs("edu.despesa.subfuncao", cod, ano, None, "INCONSISTENTE",
                                    "siconfi_dca_anexo_i_e", registro, componente=codigo, nota_material=True,
                                    nota=f"Soma das subfunções ({CF.brl(soma)}) difere do total da função ({CF.brl(v)})"))
    return obs


def brl(v):
    return CF.brl(v)


# ------------------------------------------------------------------ Censo Escolar

@functools.lru_cache(maxsize=None)
def escolas(ano):
    caminho = os.path.join(base.SEED, "inep_censo", f"escolas_capitais_{ano}.csv.gz")
    return base.le_csv_gz(caminho) if os.path.exists(caminho) else None


COLUNAS_CONTAGEM = ["QT_MAT_BAS"] + [c for _, c in ETAPAS_CENSO]


def _somas(linhas):
    """Somas por etapa sem converter ausência em zero.

    Devolve (totais, meta). totais[etapa] é int, ou None quando alguma escola do recorte não
    tem contagem para aquela etapa. A etapa "profissional" (resíduo) só é calculada quando todas
    as escolas têm o total e as seis etapas. meta separa escolas sem nenhuma contagem (todas as
    colunas vazias) de escolas com contagem parcial e de valores inválidos."""
    tot = {"total": 0, "profissional": 0}
    for e, _ in ETAPAS_CENSO:
        tot[e] = 0
    meta = {"escolas": len(linhas), "sem_contagem": [], "parciais": [], "invalidos": []}
    for l in linhas:
        try:
            vals = {c: ler_contagem(l.get(c)) for c in COLUNAS_CONTAGEM}
        except ValorInvalido as e:
            meta["invalidos"].append((l.get("CO_ENTIDADE"), str(e)))
            for k in tot:
                tot[k] = None
            continue
        if all(v is None for v in vals.values()):
            meta["sem_contagem"].append(l.get("CO_ENTIDADE"))
            continue
        if any(v is None for v in vals.values()):
            meta["parciais"].append(l.get("CO_ENTIDADE"))
        bas = vals["QT_MAT_BAS"]
        tot["total"] = None if (tot["total"] is None or bas is None) else tot["total"] + bas
        componentes = []
        for e, col in ETAPAS_CENSO:
            n = vals[col]
            componentes.append(n)
            tot[e] = None if (tot[e] is None or n is None) else tot[e] + n
        if tot["profissional"] is None or bas is None or any(n is None for n in componentes):
            tot["profissional"] = None
        else:
            tot["profissional"] += bas - sum(componentes)
    return tot, meta


def _rede_municipal(linhas, cod):
    return [l for l in linhas if l["CO_MUNICIPIO"] == str(cod) and l["TP_DEPENDENCIA"] == "3"]


def _conveniadas(linhas, cod, tipo="1"):
    return [l for l in linhas if l["CO_MUNICIPIO"] == str(cod) and l["TP_DEPENDENCIA"] == "4"
            and l["IN_PODER_PUBLICO_PARCERIA"] == "1" and l["TP_PODER_PUBLICO_PARCERIA"] == tipo]


@functools.lru_cache(maxsize=None)
def sinopse_totais(ano):
    """{código IBGE: {"3": matrículas municipais, "4": matrículas privadas}} da tabela de matrículas da
    educação básica por dependência da Sinopse Estatística do INEP; {} se a edição não foi capturada.
    Leiaute de 2025 (agrupado por rede): municipal na coluna 8 e privada na 9. Leiaute por localização
    (até 2024): urbana e rural somadas (8 + 13 e 9 + 14)."""
    caminho = os.path.join(base.SEED, "inep_sinopse", f"sinopse_capitais_{ano}.json.gz")
    if not os.path.exists(caminho):
        return {}
    t = base.le_json_gz(caminho).get("total")
    if not t:
        return {}
    cab = [c for r in t["cabecalho"] for c in r if isinstance(c, str)]
    por_rede = any("Rede Pública" in c for c in cab)
    out = {}
    for l in t["linhas"]:
        if por_rede:
            out[int(l[3])] = {"3": int(l[8]), "4": int(l[9])}
        else:
            out[int(l[3])] = {"3": int(l[8] + l[13]), "4": int(l[9] + l[14])}
    return out


@functools.lru_cache(maxsize=None)
def grupo_verificado(ano, cod, dependencia):
    """Escolas sem contagem de uma dependência e município têm contribuição nula na tabulação
    oficial? Sim quando o total da Sinopse é igual à soma das demais escolas do grupo."""
    linhas = escolas(ano) or []
    grupo = [l for l in linhas if l["CO_MUNICIPIO"] == str(cod) and l["TP_DEPENDENCIA"] == dependencia]
    tot, meta = _somas(grupo)
    sin = sinopse_totais(ano).get(cod, {}).get(dependencia)
    return {
        "sinopse": sin, "soma_com_contagem": tot["total"], "sem_contagem": len(meta["sem_contagem"]),
        "verificado": sin is not None and tot["total"] is not None and sin == tot["total"],
    }


NOME_DEPENDENCIA = {"3": "municipal", "4": "privada"}


def agrega_matriculas(sel, ano, cod, dependencia):
    """Totais por etapa do recorte, com estado. Escolas sem contagem só são tratadas como contribuição
    nula quando a Sinopse do mesmo ano, município e dependência confirma (grupo_verificado)."""
    tot, meta = _somas(sel)
    n_vazias = len(meta["sem_contagem"])
    res = {"totais": tot, "meta": meta, "nota": None, "status": {}}
    verif = grupo_verificado(ano, cod, dependencia) if n_vazias else None
    for e, v in tot.items():
        if meta["invalidos"]:
            res["status"][e] = ("INCONSISTENTE", "Valor não numérico em coluna de matrícula: " +
                                ", ".join(f"escola {i} ({t})" for i, t in meta["invalidos"][:5]))
        elif v is None:
            res["status"][e] = ("INCOMPLETO", f"{len(meta['parciais'])} escola(s) do recorte sem contagem para esta etapa; "
                                "a soma parcial não é publicada como total.")
        elif n_vazias and not verif["verificado"]:
            motivo = ("a Sinopse Estatística desta edição não foi integrada" if verif["sinopse"] is None else
                      f"o total da Sinopse ({verif['sinopse']:,}) difere da soma das escolas com contagem ({verif['soma_com_contagem']:,})".replace(",", "."))
            res["status"][e] = ("INCOMPLETO", f"{n_vazias} escola(s) do recorte sem nenhuma contagem de matrícula no arquivo de "
                                f"microdados e {motivo}; a soma parcial não é publicada como total.")
        else:
            res["status"][e] = ("OBSERVADO", None)
    if n_vazias and verif["verificado"]:
        res["nota"] = (f"{n_vazias} escola(s) do recorte aparecem no arquivo de microdados sem nenhuma contagem de matrícula "
                       f"(campos vazios). O total da Sinopse Estatística do INEP para a rede {NOME_DEPENDENCIA[dependencia]} do "
                       f"município ({verif['sinopse']:,}) é igual à soma das escolas com contagem, o que mostra contribuição nula "
                       "dessas escolas na tabulação oficial.").replace(",", ".")
    return res


def matriculas():
    obs = []
    etapas = ["total"] + [e for e, _ in ETAPAS_CENSO] + ["profissional"]
    for ano in ANOS_CENSO:
        linhas = escolas(ano)
        for cod, nome, uf in entes.CAPITAIS:
            for ind, filtro, desc, dep in (
                ("edu.matriculas.rede_municipal", _rede_municipal, "TP_DEPENDENCIA = 3", "3"),
                ("edu.matriculas.conveniadas_municipais", _conveniadas,
                 "TP_DEPENDENCIA = 4, IN_PODER_PUBLICO_PARCERIA = 1, TP_PODER_PUBLICO_PARCERIA = 1", "4"),
            ):
                reg = f"Censo Escolar {ano}, escolas com CO_MUNICIPIO = {cod} e {desc}"
                if linhas is None:
                    for e in etapas:
                        obs.append(_obs(ind, cod, ano, None, "AUSENTE_NA_COLETA", f"inep_censo_{ano}", reg, etapa=e,
                                        nota="Microdados do ano não integrados", nota_material=True))
                    continue
                sel = filtro(linhas, cod)
                ag = agrega_matriculas(sel, ano, cod, dep)
                for e in etapas:
                    st, motivo = ag["status"][e]
                    obs.append(_obs(ind, cod, ano, ag["totais"][e], st, f"inep_censo_{ano}", reg, etapa=e,
                                    nota=motivo or ag["nota"], nota_material=st != "OBSERVADO",
                                    escolas=len(sel), escolas_sem_contagem=len(ag["meta"]["sem_contagem"])))
    return obs


@functools.lru_cache(maxsize=None)
def matriculas_rede(ano, cod):
    """Totais da rede municipal (para decidir 'não aplicável' nos indicadores do INEP). Etapa
    incompleta vale None: nunca vira zero e, portanto, nunca gera 'não aplicável'."""
    linhas = escolas(ano)
    if linhas is None:
        return None
    ag = agrega_matriculas(_rede_municipal(linhas, cod), ano, cod, "3")
    return {e: (v if ag["status"][e][0] == "OBSERVADO" else None) for e, v in ag["totais"].items()}


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


# ------------------------------------------------------------------ População (IBGE) e indicadores derivados

DATA_REF_ESTIMATIVA = "1º de julho"
DATA_REF_CENSO = "31 de julho de 2022"          # Nota Metodológica nº 1 do IBGE (relação do DOU de 2023)
DATA_REF_RELACAO_2023 = "31 de julho de 2022 (malha territorial de 30 de abril de 2023)"
ANO_RELACAO_DOU = 2023                          # exercício em que a população oficial é a do Censo 2022, não uma estimativa


def _seed_populacao():
    caminho = os.path.join(base.SEED, "ibge_populacao", "populacao_capitais.json.gz")
    if not os.path.exists(caminho):
        return {}
    out = {(r["ano"], r["cod"]): r for r in base.le_json_gz(caminho)}
    c23 = os.path.join(base.SEED, "ibge_populacao", "relacao_2023_capitais.json.gz")
    if os.path.exists(c23):
        for r in base.le_json_gz(c23):
            out[(r["ano"], r["cod"])] = dict(r, tabela="Primeiros Resultados 2ª apuração (22/12/2023)")
    return out


def populacao():
    """População residente por capital e exercício (denominador da despesa por habitante).

    2021: estimativa de 1º de julho calculada a partir do Censo de 2010. 2022: Censo Demográfico (referência em
    31 de julho de 2022). 2023: população oficial do exercício, a relação publicada no DOU em 31/08/2023 com a
    população do Censo 2022 (segunda apuração), em substituição às estimativas de 2023; é identificada como
    censitária e nunca como estimativa de julho de 2023. 2024 e 2025: estimativas de 1º de julho calculadas a
    partir do Censo de 2022. O valor vigente vem do SIDRA; quando difere da publicação original, a observação
    registra os dois."""
    seed = _seed_populacao()
    obs = []
    for cod, nome, uf in entes.CAPITAIS:
        for ano in ANOS_FINANCEIROS:
            r = seed.get((ano, cod))
            if r is not None and r["tipo"] == "censo_relacao_dou_2023":
                nota = ("População oficial do exercício de 2023: o IBGE publicou, em 31/08/2023, a relação das populações municipais "
                        "em substituição às estimativas de 2023, com a população do Censo 2022 (segunda apuração), referência em "
                        "31 de julho de 2022. Não é estimativa de população em julho de 2023: é a mesma população de 2022. "
                        "A despesa por habitante de 2023 não acompanha o crescimento populacional posterior ao Censo e a variação "
                        "entre 2022 e 2023 vem só da despesa; a variação entre 2023 e 2024 mistura dois anos de crescimento populacional.")
                if r.get("nota_rodape_original"):
                    nota += (" A publicação do IBGE traz, para este município, uma população judicial (nota de rodapé), que não é a usada aqui.")
                obs.append(_obs("ctx.populacao.residente", cod, ano, int(r["valor"]), "OBSERVADO", "ibge_populacao_relacao_2023",
                                f"IBGE, relação da população dos municípios de 2023 (Censo 2022, 2ª apuração), município {cod}, referência {DATA_REF_RELACAO_2023}",
                                nota=nota, nota_material=True, quebra_serie=True, tipo_populacao="censo_relacao_dou_2023",
                                data_referencia=DATA_REF_RELACAO_2023, publicacao_original=None))
                continue
            if r is None and ano == ANO_RELACAO_DOU:
                obs.append(_obs("ctx.populacao.residente", cod, ano, None, "AUSENTE_NA_COLETA", "ibge_populacao_relacao_2023",
                                "IBGE, relação da população dos municípios de 2023 (Censo 2022, 2ª apuração)",
                                nota="População oficial de 2023 não encontrada no seed (relação do Censo 2022 publicada em 31/08/2023). Não foi preenchida com outro ano.",
                                nota_material=True, tipo_populacao=None, data_referencia=None))
                continue
            if r is None:
                obs.append(_obs("ctx.populacao.residente", cod, ano, None, "AUSENTE_NA_COLETA", "ibge_populacao",
                                f"IBGE, população residente de {ano}", nota="Registro não encontrado no seed da população"))
                continue
            censo = r["tipo"] == "censo"
            pre = ano < 2022
            tipo = "censo" if censo else ("estimativa_pre_censo_2022" if pre else "estimativa_pos_censo_2022")
            ref = DATA_REF_CENSO if censo else f"{DATA_REF_ESTIMATIVA} de {ano}"
            tabela = f"SIDRA, tabela {r['tabela']}, variável {'93' if censo else '9324'}"
            reg = f"IBGE, {tabela}, município {cod}, {ano} (população residente{' no Censo 2022' if censo else ' estimada'}, referência {ref})"

            nota, material = None, False
            if censo:
                nota = ("Censo Demográfico 2022 (segunda apuração), população residente com data de referência em 31 de julho de 2022, "
                        "conforme a Nota Metodológica nº 1 do IBGE. É a mesma população que o IBGE adotou como oficial para 2023.")
            if pre:
                nota = ("Estimativa de 1º de julho de 2021, calculada a partir do Censo de 2010, anterior ao Censo de 2022. "
                        "A população de 2022 em diante tem outra base; variações por habitante entre 2021 e os anos seguintes "
                        "misturam a mudança da base populacional.")
                material = True
            orig = r.get("publicacao_original")
            if orig is not None and orig != r["valor"]:
                nota = (nota + " " if nota else "") + (f"Valor vigente no SIDRA; a publicação original da estimativa de {ano} informava "
                                                       f"{orig:,}.".replace(",", "."))
            if r.get("nota_rodape_original"):
                nota = (nota + " " if nota else "") + ("A publicação original traz, para este município, uma população judicial "
                                                       "(nota de rodapé do arquivo do IBGE), que não é a estimativa usada aqui.")
            obs.append(_obs("ctx.populacao.residente", cod, ano, int(r["valor"]), "OBSERVADO", "ibge_populacao", reg, nota=nota,
                            nota_material=material, quebra_serie=pre, tipo_populacao=tipo, data_referencia=ref,
                            publicacao_original=orig))
    return obs


def _conf_resumo(conf):
    """Conferência reduzida que acompanha as razões derivadas (a completa fica na observação da despesa)."""
    return {k: conf.get(k) for k in ("versao_politica", "situacao", "rotulo", "elegivel_comparacao", "quebra_serie",
                                      "motivo_inelegibilidade", "explicacao")}


def despesa_por_habitante(despesa_obs, pop_obs):
    """Despesa liquidada na função Educação ÷ população residente do mesmo exercício (nominal e real de 2025)."""
    pop = {(o["ente"], o["ano"]): o for o in pop_obs}
    obs = []
    for d in despesa_obs:
        if d["indicador"] != "edu.despesa.funcao_educacao":
            continue
        p = pop[(d["ente"], d["ano"])]
        reg = (f"Despesa: DCA {d['ano']}, Anexo I-E, função 12, liquidada{'; em reais de 2025' if d['componente'] == 'real_2025' else ''}. "
               f"População: {p['registro']}")
        extra = {}
        if d["status"] != "OBSERVADO" or p["status"] != "OBSERVADO" or d["valor"] is None or p["valor"] is None:
            if p["status"] != "OBSERVADO":
                st, nota = p["status"], p["nota"]
            else:
                st, nota = d["status"], d["nota"] or "Despesa sem valor observado"
            obs.append(_obs("edu.despesa.por_habitante", d["ente"], d["ano"], None, st, "ibge_populacao+siconfi_dca_anexo_i_e", reg,
                            componente=d["componente"], nota=nota, nota_material=True))
            continue
        v = DV.razao(d["valor"], p["valor"])
        if v is None:
            obs.append(_obs("edu.despesa.por_habitante", d["ente"], d["ano"], None, "INCONSISTENTE",
                            "ibge_populacao+siconfi_dca_anexo_i_e", reg, componente=d["componente"], nota_material=True,
                            nota="Denominador nulo ou numerador negativo: a razão não é calculada."))
            continue
        notas = [x for x in (d.get("nota"), p.get("nota")) if x]
        conf = d["conferencia"]
        eleg = bool(d["elegivel_comparacao"] and p["elegivel_comparacao"])
        extra = dict(conferencia=_conf_resumo(conf), quebra_serie=bool(p.get("quebra_serie")),
                     calculo={"numerador": d["valor"], "numerador_ref": "edu.despesa.funcao_educacao", "numerador_componente": d["componente"],
                              "denominador": p["valor"], "denominador_ref": "ctx.populacao.residente"})
        obs.append(_obs("edu.despesa.por_habitante", d["ente"], d["ano"], round(v, 6), "OBSERVADO",
                        "ibge_populacao+siconfi_dca_anexo_i_e", reg, componente=d["componente"], nota=" ".join(notas) or None,
                        elegivel_comparacao=eleg, nota_material=bool(d.get("nota_material") or p.get("nota_material")), **extra))
    return obs


def despesa_por_matricula(despesa_obs, matricula_obs):
    """Despesa de aplicação direta na rede municipal própria ÷ matrículas da rede municipal (Censo Escolar).

    Também devolve a ponte do total da DCA ao numerador (observações `edu.despesa.ponte_matricula`)."""
    fatores, _ = fatores_ipca()
    mat = {(o["ente"], o["ano"]): o for o in matricula_obs
           if o["indicador"] == "edu.matriculas.rede_municipal" and o["etapa"] == "total"}
    dca = {(o["ente"], o["ano"]): o for o in despesa_obs
           if o["indicador"] == "edu.despesa.funcao_educacao" and o["componente"] == "nominal"}
    razoes, pontes = [], []
    for cod, nome, uf in entes.CAPITAIS:
        for ano in ANOS_FINANCEIROS:
            d, m = dca[(cod, ano)], mat[(cod, ano)]
            reg_base = f"MSC de dezembro de {ano}, função 12, contas 6.2.2.1.3.03, .04 e .07; Censo Escolar {ano}, rede municipal, QT_MAT_BAS"
            ind = "edu.despesa.por_matricula_rede_propria"
            fonte = "siconfi_msc_funcao12+inep_censo+siconfi_dca_anexo_i_e"

            def sem(status, nota, material=True, ind=ind):
                return [_obs(ind, cod, ano, None, status, fonte, reg_base, componente=c, nota=nota, nota_material=material)
                        for c in ("nominal", "real_2025")]

            if d["status"] != "OBSERVADO":
                razoes += sem(d["status"], d["nota"] or "Despesa da DCA sem valor observado")
                continue
            pt = DV.ponte(cod, ano, d["valor"])
            if pt is None:
                razoes += sem("AUSENTE_NA_COLETA", "Matriz de Saldos Contábeis de dezembro não encontrada no seed: a despesa de aplicação direta não pode ser separada.")
                continue
            residuo = round(d["valor"] - pt["total_sem_intra"], 2)
            for k, v in list(pt["baldes"].items()) + [("diferenca_dca_msc", residuo), ("dca_total", d["valor"])]:
                rotulo = {"dca_total": "Total da função Educação na DCA", "diferenca_dca_msc": "Diferença entre a DCA e a soma das linhas da MSC (sem intraorçamentárias)"}.get(k, DV.ROTULO_BALDE.get(k))
                pontes.append(_obs("edu.despesa.ponte_matricula", cod, ano, v, "OBSERVADO", "siconfi_msc_funcao12+siconfi_dca_anexo_i_e",
                                   f"MSC de dezembro de {ano}, função 12: {rotulo}", componente=k, elegivel_comparacao=pt["reconcilia"],
                                   nota=None, reconcilia=pt["reconcilia"], situacao_msc=pt["situacao"], diferenca_dca=pt["diferenca_dca"]))
            if not pt["reconcilia"]:
                dg = DG.par(cod, ano, nome, d["valor"])
                nota_causa = DG.nota_para_par(dg, pt["total_sem_intra"], pt["diferenca_pct_dca"]) if d["conferencia"]["situacao"] != "PERIMETRO_INTRA_MSC" else None
                if nota_causa is not None:
                    nota = nota_causa
                elif pt["situacao"] == "SEM_LINHAS":
                    nota = ("A Matriz de Saldos Contábeis de dezembro não traz linhas de despesa liquidada na função Educação para este ente e exercício "
                            "(não entregue ou entregue sem a função): a despesa de aplicação direta não pode ser separada. A DCA segue válida para a despesa total.")
                else:
                    nota = (f"A MSC de dezembro, sem intraorçamentárias, soma {CF.brl(pt['total_sem_intra'])} e a DCA informa "
                            f"{CF.brl(d['valor'])}: a ponte não fecha (diferença de {CF.brl(pt['diferenca_dca'])}, {('%.2f' % pt['diferenca_pct_dca']).replace('.', ',')}% da DCA, "
                            "acima do limiar de 0,1% da política de conferência). "
                            + ("A DCA deste exercício inclui despesas intraorçamentárias na função Educação (perímetro distinto, "
                               "política de conferência 1.1). " if d["conferencia"]["situacao"] == "PERIMETRO_INTRA_MSC" else "")
                            + "Sem reconciliação, o numerador por matrícula não é publicado.")
                razoes += sem("NAO_COMPARAVEL", nota)
                continue
            if not pt["classificavel"]:
                razoes += sem("NAO_COMPARAVEL", f"A MSC de dezembro traz {CF.brl(pt['baldes']['sem_natureza'])} liquidados na função Educação em linhas "
                                                "sem natureza da despesa (sem modalidade nem elemento): o total fecha com a DCA, mas essas linhas não podem ser "
                                                "atribuídas à aplicação direta nem às transferências. O numerador por matrícula não é publicado.")
                continue
            if m["status"] != "OBSERVADO" or m["valor"] is None:
                razoes += sem(m["status"], m["nota"] or "Matrículas da rede municipal sem valor observado")
                continue
            num = pt["baldes"]["rede_propria"]
            v = DV.razao(num, m["valor"])
            if v is None:
                razoes += sem("INCONSISTENTE", "Denominador nulo ou numerador negativo: a razão não é calculada.")
                continue
            eleg = bool(d["elegivel_comparacao"] and m["elegivel_comparacao"])
            notas = [x for x in (d.get("nota"), m.get("nota")) if x]
            if pt["situacao"] == "DIFERENCA_MENOR":
                notas.append(f"A soma das linhas da MSC difere da DCA em {CF.brl(pt['diferenca_dca'])} ({('%.3f' % pt['diferenca_pct_dca']).replace('.', ',')}% da DCA, "
                             "abaixo do limiar de 0,1%); a diferença não é atribuída ao numerador nem a outra parcela.")
            for comp, fator in (("nominal", 1.0), ("real_2025", fatores[ano])):
                calc = {"numerador": round(num * fator, 2), "numerador_ref": "edu.despesa.ponte_matricula", "numerador_componente": "rede_propria",
                        "denominador": m["valor"], "denominador_ref": "edu.matriculas.rede_municipal",
                        "dca_total": round(d["valor"] * fator, 2)}
                razoes.append(_obs(ind, cod, ano, round(v * fator, 6), "OBSERVADO", fonte,
                                   reg_base + ("; corrigido pelo IPCA (média anual) para reais de 2025" if comp == "real_2025" else ""),
                                   componente=comp, nota=" ".join(notas) or None, elegivel_comparacao=eleg,
                                   nota_material=bool(d.get("nota_material") or m.get("nota_material")),
                                   conferencia=_conf_resumo(d["conferencia"]), calculo=calc,
                                   **({"fator_ipca": fator} if comp == "real_2025" else {})))
    return razoes, pontes


def todas():
    desp, mat, pop = despesa(), matriculas(), populacao()
    hab = despesa_por_habitante(desp, pop)
    por_mat, ponte = despesa_por_matricula(desp, mat)
    return desp + mat + atu() + aprovacao() + ideb_saeb() + pop + hab + por_mat + ponte
