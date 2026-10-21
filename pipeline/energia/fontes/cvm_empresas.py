"""Leitura dos dados abertos da CVM usados pelo módulo Empresas (P038).

Fontes (https://dados.cvm.gov.br/, licença ODbL declarada no portal):

* Cadastro de companhias abertas (CIA_ABERTA/CAD/DADOS/cad_cia_aberta.csv, Latin-1, ";"):
  CNPJ, denominação, código CVM, situação do registro, setor de atividade declarado,
  categoria, controle acionário. Um CNPJ pode ter mais de um registro (cancelado e novo).
* DFP (demonstrações anuais) e ITR (informações trimestrais), um zip por ano de referência
  com um CSV por demonstração e escopo: consolidado (_con) e individual (_ind). Cada linha
  traz CD_CONTA, VL_CONTA, ESCALA_MOEDA (MIL ou UNIDADE), ORDEM_EXERC (ÚLTIMO = exercício do
  documento; PENÚLTIMO = exercício anterior como reapresentado no documento), VERSAO do
  documento e ST_CONTA_FIXA (S = conta do plano padronizado da CVM, com o mesmo código e
  significado em todas as companhias do modelo comercial e industrial).

Regras de leitura:
* só contas fixas (ST_CONTA_FIXA = S) e só os códigos de CONTAS: contas livres (N) têm
  código e conteúdo escolhidos por cada companhia e não são comparáveis;
* valor em reais: MIL × 1.000, UNIDADE × 1; outra escala é contada e descartada;
* versão: para cada documento (CNPJ, data de referência) vale a maior VERSAO presente no
  arquivo; as versões anteriores são contadas (revisões do documento pela companhia);
* consolidado e individual NUNCA se misturam: são séries distintas do mesmo CNPJ.

A leitura é em fluxo, membro a membro do zip, e só analisa com csv as linhas cujo início é
o CNPJ de uma companhia do universo (os arquivos do ITR passam de 150 MB descomprimidos).
"""
import csv
import io
import re
import zipfile

from pipeline.energia import entidades

SETORES_ENERGIA = ("Energia Elétrica", "Emp. Adm. Part. - Energia Elétrica")

# Contas do plano padronizado usadas. Códigos conferidos nos arquivos de 2024 e 2025 (CEMIG,
# consolidado e individual) e no modelo "empresas comerciais, industriais e outras" da CVM.
# Instituições financeiras e seguradoras usam outro plano (3.01 = receitas de intermediação):
# o universo do módulo não tem nenhuma, e a leitura confere o rótulo (DS_CONTA) de 3.01.
CONTAS = [
    {"id": "receita", "demonstracao": "DRE", "codigo": "3.01", "tipo": "fluxo",
     "rotulo": "Receita de venda de bens e/ou serviços",
     "definicao": "Receita líquida da DRE (conta 3.01). Nas distribuidoras inclui a receita de construção da infraestrutura da concessão (ICPC 01), que tem custo equivalente na conta 3.02."},
    {"id": "ebit", "demonstracao": "DRE", "codigo": "3.05", "tipo": "fluxo",
     "rotulo": "Resultado antes do resultado financeiro e dos tributos",
     "definicao": "Conta 3.05 da DRE (resultado operacional depois da equivalência patrimonial). Não é EBITDA: depreciação e amortização não são somadas de volta."},
    {"id": "lucro_liquido", "demonstracao": "DRE", "codigo": "3.11", "tipo": "fluxo",
     "rotulo": "Lucro ou prejuízo do período",
     "definicao": "Conta 3.11 da DRE. No consolidado inclui a parcela dos sócios não controladores (3.11.02)."},
    {"id": "lucro_controladores", "demonstracao": "DRE", "codigo": "3.11.01", "tipo": "fluxo",
     "rotulo": "Lucro atribuído aos sócios da controladora",
     "definicao": "Conta 3.11.01 da DRE consolidada. No individual a conta não existe (o lucro inteiro é da companhia)."},
    {"id": "ativo_total", "demonstracao": "BPA", "codigo": "1", "tipo": "saldo",
     "rotulo": "Ativo total", "definicao": "Conta 1 do balanço patrimonial ativo, no fim do período."},
    {"id": "caixa", "demonstracao": "BPA", "codigo": "1.01.01", "tipo": "saldo",
     "rotulo": "Caixa e equivalentes de caixa", "definicao": "Conta 1.01.01 do balanço, no fim do período."},
    {"id": "emprestimos_cp", "demonstracao": "BPP", "codigo": "2.01.04", "tipo": "saldo",
     "rotulo": "Empréstimos e financiamentos no passivo circulante",
     "definicao": "Conta 2.01.04 (inclui debêntures e, no modelo vigente, arrendamentos quando a companhia os classifica ali)."},
    {"id": "emprestimos_lp", "demonstracao": "BPP", "codigo": "2.02.01", "tipo": "saldo",
     "rotulo": "Empréstimos e financiamentos no passivo não circulante",
     "definicao": "Conta 2.02.01 (inclui debêntures)."},
    {"id": "patrimonio_liquido", "demonstracao": "BPP", "codigo": "2.03", "tipo": "saldo",
     "rotulo": "Patrimônio líquido",
     "definicao": "Conta 2.03. No consolidado inclui a participação dos não controladores (2.03.09)."},
    {"id": "caixa_operacional", "demonstracao": "DFC", "codigo": "6.01", "tipo": "fluxo",
     "rotulo": "Caixa líquido das atividades operacionais", "definicao": "Conta 6.01 da demonstração dos fluxos de caixa (método direto ou indireto)."},
    {"id": "caixa_investimento", "demonstracao": "DFC", "codigo": "6.02", "tipo": "fluxo",
     "rotulo": "Caixa líquido das atividades de investimento",
     "definicao": "Conta 6.02 da DFC. É a medida padronizada mais próxima de investimento: inclui imobilizado e intangível (ativo de concessão), mas também aquisições, aplicações financeiras e resgates; o investimento em ativos da concessão não tem conta fixa própria."},
]
# Contas auxiliares: lidas só para conferências internas, nunca publicadas como série. O saldo
# inicial de caixa da DFC de um exercício (6.05.01) é, por construção, o saldo final do exercício
# anterior (6.05.02 do comparativo no mesmo documento); quando a companhia não preenche a DFC do
# exercício, a CVM entrega o modelo com zero e a identidade quebra (CELGPAR, DFP 2025: saldo
# inicial 0 contra saldo final de 2024 de R$ 203.811 mil).
CONTAS_AUXILIARES = [
    {"id": "dfc_saldo_inicial", "demonstracao": "DFC", "codigo": "6.05.01", "tipo": "fluxo",
     "rotulo": "Saldo inicial de caixa e equivalentes (DFC)"},
    {"id": "dfc_saldo_final", "demonstracao": "DFC", "codigo": "6.05.02", "tipo": "fluxo",
     "rotulo": "Saldo final de caixa e equivalentes (DFC)"},
]
IDS_AUXILIARES = frozenset(c["id"] for c in CONTAS_AUXILIARES)
TIPO_CONTA = {c["id"]: c["tipo"] for c in CONTAS + CONTAS_AUXILIARES}
CODIGOS = {(c["demonstracao"], c["codigo"]): c["id"] for c in CONTAS + CONTAS_AUXILIARES}
# Medida calculada a partir de contas fixas (não é conta da CVM): soma, nunca mistura escopos.
DIVIDA_BRUTA = {"id": "divida_bruta", "rotulo": "Empréstimos, financiamentos e debêntures (circulante + não circulante)",
                "formula": "2.01.04 + 2.02.01, mesmo escopo, mesma data", "tipo": "saldo"}

# Membro do zip → demonstração. DFC pelo método direto (MD) ou indireto (MI): cada companhia
# publica um; a conta 6.0x tem o mesmo código nos dois.
MEMBROS = {"DRE": "DRE", "BPA": "BPA", "BPP": "BPP", "DFC_MI": "DFC", "DFC_MD": "DFC"}
ESCALAS = {"MIL": 1000.0, "UNIDADE": 1.0}
ROTULO_3_01 = re.compile(r"^Receita", re.IGNORECASE)


def _texto(v):
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def le_cadastro(linhas):
    """Linhas do cad_cia_aberta.csv → ({cnpj: registro}, ocorrências). Com mais de um registro
    para o mesmo CNPJ fica o ATIVO; entre iguais, o de registro mais recente. Os demais
    códigos CVM do CNPJ ficam em codigos_cvm (histórico de registros)."""
    por_cnpj, ocorr = {}, {"linhas": 0, "cnpj_invalido": 0, "cnpj_com_mais_de_um_registro": 0}
    for r in linhas:
        ocorr["linhas"] += 1
        c14 = entidades.cnpj(r.get("CNPJ_CIA"))
        if not c14:
            ocorr["cnpj_invalido"] += 1
            continue
        reg = {
            "denominacao": _texto(r.get("DENOM_SOCIAL")), "nome_comercial": _texto(r.get("DENOM_COMERC")),
            "cd_cvm": _texto(r.get("CD_CVM")), "situacao": _texto(r.get("SIT")),
            "setor": _texto(r.get("SETOR_ATIV")), "categoria": _texto(r.get("CATEG_REG")),
            "controle": _texto(r.get("CONTROLE_ACIONARIO")), "mercado": _texto(r.get("TP_MERC")),
            "data_registro": _texto(r.get("DT_REG")), "data_cancelamento": _texto(r.get("DT_CANCEL")),
            "uf": _texto(r.get("UF")),
        }
        ant = por_cnpj.get(c14)
        if ant is None:
            por_cnpj[c14] = {**reg, "codigos_cvm": [reg["cd_cvm"]]}
            continue
        ocorr["cnpj_com_mais_de_um_registro"] += 1
        codigos = sorted(set(ant["codigos_cvm"] + [reg["cd_cvm"]]), key=lambda x: int(x or 0))
        melhor = ant
        if (reg["situacao"] == "ATIVO") > (ant["situacao"] == "ATIVO") or (
                (reg["situacao"] == "ATIVO") == (ant["situacao"] == "ATIVO") and (reg["data_registro"] or "") > (ant["data_registro"] or "")):
            melhor = reg
        por_cnpj[c14] = {**melhor, "codigos_cvm": codigos}
    return por_cnpj, ocorr


def formatado(c14):
    return entidades.cnpj_formatado(c14)


def _linhas_filtradas(fluxo, alvos_fmt):
    """Linhas do CSV (bytes, Latin-1) cujo início é um CNPJ do universo, como dicts. O
    cabeçalho é lido da primeira linha; o filtro por prefixo evita analisar as linhas das
    outras 2.600 companhias."""
    texto = io.TextIOWrapper(fluxo, encoding="latin-1", newline="")
    cab = next(csv.reader([texto.readline()], delimiter=";"))
    cab = [c.strip().lstrip("﻿") for c in cab]
    for linha in texto:
        if linha[:18] in alvos_fmt:
            valores = next(csv.reader([linha], delimiter=";"))
            yield dict(zip(cab, valores))


def membros_do_zip(z, doc, ano):
    """[(nome do membro, demonstração, escopo)] presentes no zip do ano."""
    pref = f"{doc.lower()}_cia_aberta_"
    out = []
    for nome in z.namelist():
        for dem_arq, dem in MEMBROS.items():
            for esc in ("con", "ind"):
                if nome == f"{pref}{dem_arq}_{esc}_{ano}.csv":
                    out.append((nome, dem, esc))
    return out


def le_indice(z, doc, ano, alvos_fmt):
    """Documentos entregues (índice do zip): {(cnpj, dt_refer): [ {versao, dt_receb, id_doc,
    categoria, link} ]}, uma entrada por linha do índice. O índice pode repetir a mesma versão
    (no ITR de 2021, o documento da 02.291.077/0001-93 de 30/06/2021 aparece duas vezes com
    VERSAO 1): quem conta versões conta as versões distintas (versoes_distintas)."""
    nome = f"{doc.lower()}_cia_aberta_{ano}.csv"
    out = {}
    if nome not in z.namelist():
        return out
    with z.open(nome) as f:
        for r in _linhas_filtradas(f, alvos_fmt):
            c14 = entidades.cnpj(r.get("CNPJ_CIA"))
            out.setdefault((c14, r.get("DT_REFER")), []).append({
                "versao": int(r.get("VERSAO") or 0), "dt_receb": _texto(r.get("DT_RECEB")),
                "id_doc": _texto(r.get("ID_DOC")), "categoria": _texto(r.get("CATEG_DOC")),
                "link": _texto(r.get("LINK_DOC"))})
    return out


def le_valores(z, doc, ano, alvos_fmt):
    """Valores das CONTAS no zip de um ano, na maior versão de cada documento.

    Retorna (valores, ocorrências), com valores = [{cnpj, escopo, demonstracao, conta (id),
    codigo, ordem ('U' último exercício, 'P' exercício anterior reapresentado), dt_ini
    (None em saldo), dt_fim, dt_refer, versao, valor (R$), escala (MIL ou UNIDADE, como a
    fonte marcou: a marca pode estar errada, e a conferência entre documentos fica com o
    módulo)}]."""
    brutos = []
    ocorr = {"linhas": 0, "escala_desconhecida": 0, "moeda_desconhecida": 0, "rotulo_3_01_inesperado": 0,
             "versoes_descartadas": 0}
    for nome, dem, esc in membros_do_zip(z, doc, ano):
        with z.open(nome) as f:
            for r in _linhas_filtradas(f, alvos_fmt):
                ocorr["linhas"] += 1
                if (r.get("ST_CONTA_FIXA") or "").strip() != "S":
                    continue
                cod = (r.get("CD_CONTA") or "").strip()
                cid = CODIGOS.get((dem, cod))
                if cid is None:
                    continue
                if cod == "3.01" and not ROTULO_3_01.match((r.get("DS_CONTA") or "").strip()):
                    ocorr["rotulo_3_01_inesperado"] += 1
                    continue
                if (r.get("MOEDA") or "").strip() != "REAL":
                    ocorr["moeda_desconhecida"] += 1
                    continue
                escala = (r.get("ESCALA_MOEDA") or "").strip()
                esc_m = ESCALAS.get(escala)
                if esc_m is None:
                    ocorr["escala_desconhecida"] += 1
                    continue
                try:
                    v = float(r.get("VL_CONTA")) * esc_m
                except (TypeError, ValueError):
                    continue
                ordem = (r.get("ORDEM_EXERC") or "").strip().upper()
                brutos.append({
                    "cnpj": entidades.cnpj(r.get("CNPJ_CIA")), "escopo": esc, "demonstracao": dem, "conta": cid,
                    "codigo": cod, "ordem": "U" if ordem.startswith("ÚLT") or ordem.startswith("ULT") else "P",
                    "dt_ini": _texto(r.get("DT_INI_EXERC")), "dt_fim": _texto(r.get("DT_FIM_EXERC")),
                    "dt_refer": _texto(r.get("DT_REFER")), "versao": int(r.get("VERSAO") or 0), "valor": v,
                    "escala": escala,
                })
    maior = {}
    for b in brutos:
        k = (b["cnpj"], b["dt_refer"])
        maior[k] = max(maior.get(k, 0), b["versao"])
    valores = []
    vistos = set()
    for b in brutos:
        if b["versao"] != maior[(b["cnpj"], b["dt_refer"])]:
            ocorr["versoes_descartadas"] += 1
            continue
        chave = (b["cnpj"], b["escopo"], b["conta"], b["ordem"], b["dt_ini"], b["dt_fim"], b["dt_refer"])
        if chave in vistos:
            continue
        vistos.add(chave)
        valores.append(b)
    return valores, ocorr


def versoes_distintas(entradas):
    """Número de versões distintas de um documento a partir das entradas do índice."""
    return len({e["versao"] for e in entradas})


def abre_zip(caminho):
    return zipfile.ZipFile(caminho)
