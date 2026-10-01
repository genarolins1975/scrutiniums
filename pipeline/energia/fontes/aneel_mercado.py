"""Leitura das bases da ANEEL usadas pelo módulo Mercado (funções puras, sem rede e sem banco).

1. SAMP (dadosabertos.aneel.gov.br/dataset/samp, dicionário dd-samp.pdf versão 1.1 de
   21/07/2026): mercado faturado de cada distribuidora, por competência, com a opção de
   compra de energia (DscOpcaoEnergia: CATIVO, LIVRE, GERAÇÃO, DISTRIBUIÇÃO, SUPRIMENTO),
   o tipo de mercado (NomTipoMercado: Regular, Sistema Isolado, Sistema Individual,
   Sistema de Compensação GD I a III e as linhas de "Refaturamento", que o dicionário define
   como energia de meses anteriores apresentada no mês em curso) e a métrica
   (DscDetalheMercado: energia TE e TUSD em kWh, número de consumidores, receitas...).
   O módulo agrega por distribuidora (CNPJ da fonte) e mês só o que responde à pergunta do
   painel: energia TUSD e unidades consumidoras do mercado livre por característica do
   consumidor (DscDetalheConsumidor: "Fonte incentivada", "APE", "ERC", "Não se aplica"),
   energia faturada e unidades do mercado cativo. Refaturamento fica em medida própria:
   a fonte não diz a que mês ele se refere, então não é somado a nenhuma competência.
2. Bandeiras Tarifárias, recurso "Conta Bandeira" (dicionário dm-bandeira-tarifaria-conta-
   bandeira.pdf versão 1.0 de 01/03/2023): por distribuidora e competência, os custos que a
   CCEE apura e informa à ANEEL (resultado no mercado de curto prazo, risco hidrológico das
   cotas, das usinas repactuadas e de Itaipu, ESS e EER, ressarcimento da CONER) e os
   repasses da conta. É a única base aberta acessível com números da contabilização da CCEE
   por distribuidora, e cobre só o mercado regulado.
3. Agentes do Setor Elétrico (cadastro de agentes da ANEEL): CNPJ, razão social, situação e
   as atividades (comercialização, distribuição, geração, transmissão).
"""
import csv
import io
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import entidades  # noqa: E402


class EsquemaInesperado(ValueError):
    """Arquivo com colunas ou domínios diferentes dos verificados: nada é lido."""


# ---------------------------------------------------------------- SAMP

COLUNAS_SAMP = ["NumCNPJAgenteDistribuidora", "SigAgenteDistribuidora", "NomAgenteDistribuidora", "NomTipoMercado",
                "DscOpcaoEnergia", "DscDetalheConsumidor", "DscDetalheMercado", "DatCompetencia", "VlrMercado"]
# Tipos de mercado faturados na própria competência (o que entra no estoque e na energia do mês).
TIPOS_COMPETENCIA = {"Regular", "Sistema Isolado - Regular", "Sistema Individual - Regular",
                     "Sistema de Compensação GD I", "Sistema de Compensação GD II", "Sistema de Compensação GD III"}
# Característica do consumidor livre → rótulo do observatório. "Fonte incentivada" é o consumidor
# com desconto na TUSD por comprar energia de fonte incentivada (inclui os consumidores especiais,
# mas a fonte não separa os dois); "APE" é autoprodução; "ERC" é sigla da fonte sem definição
# no dicionário; "Não se aplica" é o livre sem nenhuma dessas marcas.
DETALHE_LIVRE = {"Fonte incentivada": "incentivada", "Não se aplica": "convencional", "APE": "autoproducao",
                 "ERC": "erc"}
ENERGIA_TUSD = "Energia TUSD (kWh)"
ENERGIA_TE = "Energia TE (kWh)"
# A fonte escreve "Número de consumidores" e "Número de Consumidores" (as duas grafias convivem
# no mesmo arquivo); a comparação é sem diferenciar maiúsculas.
NUM_CONSUMIDORES = "número de consumidores"

# Só as linhas do tipo de mercado "Regular" (sem sistemas isolados e sem compensação de GD),
# em medidas próprias: servem para detectar mês copiado do anterior (a mesma energia em kWh e o
# mesmo número de consumidores repetidos exatamente, como as linhas CATIVO Regular da ELEKTRO em
# junho e julho de 2026). Não entram em nenhuma soma publicada.
MEDIDAS_REGULAR = ("regular_cativo_mwh", "regular_cativo_uc", "regular_livre_mwh", "regular_livre_uc")

MEDIDAS_SAMP = (
    "livre_mwh", "livre_uc", "livre_mwh_refat", "cativo_mwh", "cativo_uc", "cativo_mwh_refat", "cativo_mwh_tusd",
    *MEDIDAS_REGULAR,
    *(f"livre_mwh_{v}" for v in sorted(set(DETALHE_LIVRE.values()))),
    *(f"livre_uc_{v}" for v in sorted(set(DETALHE_LIVRE.values()))),
    "livre_mwh_outro", "livre_uc_outro",
)


def _texto(v):
    return "" if v is None else str(v).strip()


def classifica_samp(linha, contagem):
    """[(medida, valor)] de uma linha do SAMP, ou None quando a linha não entra no módulo.

    kWh viram MWh (÷ 1.000); número de consumidores fica como unidades. Linha de tipo de
    mercado desconhecido é contada (e fica de fora): sinal de mudança de leiaute. Linha do tipo
    "Regular" também alimenta as medidas de controle MEDIDAS_REGULAR."""
    res = _classifica_samp(linha, contagem)
    if res is None:
        return None
    res = res if isinstance(res, list) else [res]
    if _texto(linha.get("NomTipoMercado")) == "Regular":
        opcao = _texto(linha.get("DscOpcaoEnergia")).lower()
        extra = []
        for medida, v in res:
            if medida in ("cativo_mwh", "livre_mwh"):
                extra.append((f"regular_{opcao}_mwh", v))
            elif medida in ("cativo_uc", "livre_uc"):
                extra.append((f"regular_{opcao}_uc", v))
        res = res + extra
    return res


def _classifica_samp(linha, contagem):
    opcao = _texto(linha.get("DscOpcaoEnergia")).upper()
    if opcao not in ("CATIVO", "LIVRE"):
        return None
    det = _texto(linha.get("DscDetalheMercado"))
    eh_uc = det.lower() == NUM_CONSUMIDORES
    if not eh_uc and det not in (ENERGIA_TUSD, ENERGIA_TE):
        return None
    # o cativo paga TE e TUSD sobre a mesma energia; vale a TE (energia vendida pela
    # distribuidora) e a TUSD fica numa medida de conferência (cativo_mwh_tusd), que precisa
    # coincidir com ela. O livre paga só a TUSD.
    if opcao == "LIVRE" and det == ENERGIA_TE:
        contagem["livre_com_te"] = contagem.get("livre_com_te", 0) + 1
        return None
    tipo = _texto(linha.get("NomTipoMercado"))
    refat = "refaturamento" in tipo.lower()
    if not refat and tipo not in TIPOS_COMPETENCIA:
        contagem[f"tipo_mercado_ignorado|{tipo}"] = contagem.get(f"tipo_mercado_ignorado|{tipo}", 0) + 1
        return None
    v = linha.get("VlrMercado")
    if v is None:
        contagem["valor_vazio"] = contagem.get("valor_vazio", 0) + 1
        return None
    v = float(v)
    if eh_uc:
        if refat:
            return None  # contagem de consumidores refaturados não é estoque de nenhum mês
        if opcao == "CATIVO":
            return "cativo_uc", v
        sufixo = DETALHE_LIVRE.get(_texto(linha.get("DscDetalheConsumidor")), "outro")
        return [("livre_uc", v), (f"livre_uc_{sufixo}", v)]
    mwh = v / 1000.0
    if opcao == "CATIVO":
        if det == ENERGIA_TUSD:
            return None if refat else ("cativo_mwh_tusd", mwh)
        return ("cativo_mwh_refat" if refat else "cativo_mwh"), mwh
    if refat:
        return "livre_mwh_refat", mwh
    sufixo = DETALHE_LIVRE.get(_texto(linha.get("DscDetalheConsumidor")), "outro")
    return [("livre_mwh", mwh), (f"livre_mwh_{sufixo}", mwh)]


def lotes_parquet(caminho, colunas=COLUNAS_SAMP, lote=200_000, so_mercado=True):
    """Linhas do Parquet como dicts, lidas em lotes e só nas colunas pedidas. Coluna ausente
    interrompe (EsquemaInesperado): o leiaute mudou e precisa ser conferido.

    `so_mercado`: filtra no próprio lote (pyarrow.compute) as opções CATIVO e LIVRE e as
    métricas de energia e número de consumidores, antes de virar dict em Python; o resto do
    arquivo (receitas, tributos, demanda, geração) é contado mas não percorrido linha a linha."""
    import pyarrow as pa
    import pyarrow.compute as pc
    import pyarrow.parquet as pq
    pf = pq.ParquetFile(caminho)
    faltam = [c for c in colunas if c not in pf.schema_arrow.names]
    if faltam:
        raise EsquemaInesperado(f"SAMP: colunas ausentes {faltam}; recebidas {pf.schema_arrow.names}")
    metricas = [ENERGIA_TUSD, ENERGIA_TE, "Número de consumidores", "Número de Consumidores"]
    for b in pf.iter_batches(columns=list(colunas), batch_size=lote):
        if so_mercado:
            mascara = pc.and_(pc.is_in(b.column("DscOpcaoEnergia"), value_set=pa.array(["CATIVO", "LIVRE"])),
                              pc.is_in(b.column("DscDetalheMercado"), value_set=pa.array(metricas)))
            b = b.filter(mascara)
        d = b.to_pydict()
        n = len(d[colunas[0]])
        for i in range(n):
            yield {c: d[c][i] for c in colunas}


def agrega_samp(linhas, contagem=None):
    """Agrega linhas do SAMP em {(cnpj, AAAA-MM): {medida: valor}} e {cnpj: {sigla, nome}}.

    Mesma (distribuidora, mês, medida) com várias linhas (classe, subgrupo, modalidade, posto)
    é somada: é a abertura da fonte, não duplicidade. CNPJ ausente ou inválido não é atribuído
    a ninguém: fica contado."""
    contagem = contagem if contagem is not None else {}
    agg, cadastro = {}, {}
    for linha in linhas:
        contagem["linhas_lidas"] = contagem.get("linhas_lidas", 0) + 1
        res = classifica_samp(linha, contagem)
        if res is None:
            continue
        cn = entidades.cnpj(linha.get("NumCNPJAgenteDistribuidora"))
        comp = linha.get("DatCompetencia")
        mes = str(comp)[:7] if comp is not None else None
        if not cn or not mes or not re.fullmatch(r"\d{4}-\d{2}", mes):
            contagem["sem_cnpj_ou_competencia"] = contagem.get("sem_cnpj_ou_competencia", 0) + 1
            continue
        contagem["linhas_usadas"] = contagem.get("linhas_usadas", 0) + 1
        cadastro.setdefault(cn, {"sigla": _texto(linha.get("SigAgenteDistribuidora")),
                                 "nome": _texto(linha.get("NomAgenteDistribuidora"))})
        destino = agg.setdefault((cn, mes), {})
        for medida, v in (res if isinstance(res, list) else [res]):
            destino[medida] = destino.get(medida, 0.0) + v
    return agg, cadastro


# ---------------------------------------------------------------- Conta Bandeira

CAMPOS_CONTA_BANDEIRA = (
    "VlrReceitaFaturada", "VlrRepasseContaBandeira", "VlrResultadoMCP", "VlrCCEARD",
    "VlrRiscoHidrologicoCCGFRepactuadas", "VlrRiscoHidrologicoItaipu", "VlrRiscoHidrologicoRepactuadas",
    "VlrRiscoHidrologicoCCGF", "VlrPrevisaoRiscoHidrologico", "VlrPremioDeRisco", "VlrESSEER", "VlrRessarcimentoCONER",
)
# O dicionário (versão 1.0) chama a coluna de CNPJ de NumCPFCNPJ; o arquivo de 2026 traz
# NumCNPJDistribuidora. As duas são aceitas e a usada fica registrada.
COLUNAS_CNPJ_CB = ("NumCNPJDistribuidora", "NumCPFCNPJ")


def numero_br(s):
    """'1023666,0508' → 1023666.0508; vazio → None (ausência, nunca zero)."""
    if s is None:
        return None
    s = str(s).strip().strip('"')
    if not s:
        return None
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    else:
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def linhas_conta_bandeira(texto, contagem=None):
    """Linhas do CSV Conta Bandeira como dicts {cnpj|None, sigla, mes, campos{...}}.

    Esquema conferido na chegada: falta de qualquer campo usado interrompe a leitura."""
    contagem = contagem if contagem is not None else {}
    leitor = csv.reader(io.StringIO(texto), delimiter=";")
    cab = [c.strip().strip('"').lstrip("﻿") for c in next(leitor)]
    col_cnpj = next((c for c in COLUNAS_CNPJ_CB if c in cab), None)
    faltam = [c for c in ("SigAgente", "DatCompetencia", *CAMPOS_CONTA_BANDEIRA) if c not in cab]
    if col_cnpj is None or faltam:
        raise EsquemaInesperado(f"Conta Bandeira: colunas ausentes {faltam or list(COLUNAS_CNPJ_CB)}; recebidas {cab}")
    contagem["coluna_cnpj"] = col_cnpj
    idx = {c: i for i, c in enumerate(cab)}
    for row in leitor:
        if not row:
            continue
        g = lambda c: row[idx[c]] if idx[c] < len(row) else ""  # noqa: E731
        comp = g("DatCompetencia").strip()
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", comp):
            contagem["competencia_invalida"] = contagem.get("competencia_invalida", 0) + 1
            continue
        cn = entidades.cnpj(g(col_cnpj)) if g(col_cnpj).strip() else None
        if cn is None:
            contagem["sem_cnpj"] = contagem.get("sem_cnpj", 0) + 1
        contagem["linhas"] = contagem.get("linhas", 0) + 1
        yield {"cnpj": cn, "sigla": g("SigAgente").strip(), "mes": comp[:7],
               "gerado_em": g("DatGeracaoConjuntoDados").strip() if "DatGeracaoConjuntoDados" in idx else None,
               "campos": {c: numero_br(g(c)) for c in CAMPOS_CONTA_BANDEIRA}}


def confere_risco_hidrologico(campos, tolerancia=1.0):
    """Identidade do dicionário: risco das cotas (CCGF) e repactuadas líquido = repactuadas +
    CCGF + previsão concedida na tarifa + prêmio de risco (os dois últimos já com sinal
    negativo no arquivo). Retorna a diferença em R$, ou None quando falta parcela."""
    partes = [campos.get(c) for c in ("VlrRiscoHidrologicoRepactuadas", "VlrRiscoHidrologicoCCGF",
                                       "VlrPrevisaoRiscoHidrologico", "VlrPremioDeRisco")]
    total = campos.get("VlrRiscoHidrologicoCCGFRepactuadas")
    if total is None or any(p is None for p in partes):
        return None
    return total - sum(partes)


# ---------------------------------------------------------------- cadastro de agentes

COLUNAS_AGENTES = ("NumCnpj", "NomRazaoSocial", "IdcAtivo", "IdcComercializacao", "IdcDistribuicao", "IdcGeracao",
                   "IdcTransmissao")
ATIVIDADES = {"IdcComercializacao": "comercializacao", "IdcDistribuicao": "distribuicao", "IdcGeracao": "geracao",
              "IdcTransmissao": "transmissao"}


def linhas_agentes(texto, contagem=None):
    """Agentes do cadastro da ANEEL: {cnpj, nome, sigla, ativo(bool|None), atividades{...}, gerado_em}.

    Indicador de atividade diferente de 0 conta como exercício da atividade (o arquivo traz
    1 e, numa linha, 2 em geração; o dicionário não define o 2, que fica contado)."""
    contagem = contagem if contagem is not None else {}
    leitor = csv.reader(io.StringIO(texto), delimiter=";")
    cab = [c.strip().strip('"').lstrip("﻿") for c in next(leitor)]
    faltam = [c for c in COLUNAS_AGENTES if c not in cab]
    if faltam:
        raise EsquemaInesperado(f"Agentes: colunas ausentes {faltam}; recebidas {cab}")
    idx = {c: i for i, c in enumerate(cab)}
    for row in leitor:
        if not row:
            continue
        g = lambda c: (row[idx[c]] if idx[c] < len(row) else "").strip()  # noqa: E731
        cn = entidades.cnpj(g("NumCnpj"))
        if cn is None:
            contagem["sem_cnpj"] = contagem.get("sem_cnpj", 0) + 1
            continue
        ativ = {}
        for col, nome in ATIVIDADES.items():
            v = g(col)
            if v not in ("0", "1"):
                contagem[f"indicador_{nome}_{v or 'vazio'}"] = contagem.get(f"indicador_{nome}_{v or 'vazio'}", 0) + 1
            ativ[nome] = v not in ("", "0")
        sit = g("IdcAtivo")
        contagem["linhas"] = contagem.get("linhas", 0) + 1
        yield {"cnpj": cn, "nome": g("NomRazaoSocial").strip("' ").strip(), "sigla": g("SigPessoa") if "SigPessoa" in idx else "",
               "ativo": True if sit == "A" else (False if sit == "I" else None), "atividades": ativ,
               "gerado_em": g("DatGeracaoConjuntoDados") if "DatGeracaoConjuntoDados" in idx else None}
