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

from pipeline.eficiencia import base, conferencia as CF, entes

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
            material = conf["situacao"] in ("PENDENTE", "PERIMETRO_INTRA_MSC", "NAO_CONFERIDO")
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


def todas():
    return despesa() + matriculas() + atu() + aprovacao() + ideb_saeb()
