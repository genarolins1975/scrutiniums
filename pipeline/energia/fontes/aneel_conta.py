"""Leitura das bases da ANEEL usadas no módulo Conta de luz.

Conjuntos (portal de dados abertos da ANEEL, licença ODbL):
- tarifas-distribuidoras-energia-eletrica: TE e TUSD homologadas por distribuidora
  (CNPJ), subgrupo, modalidade, classe, subclasse, detalhe, posto, base tarifária,
  unidade e vigência. O dicionário (versão 1.0, 15/03/2022) usa nomes de campo que
  não batem com o cabeçalho real do CSV (DscResolucaoHomologatoria no dicionário é
  DscREH no arquivo; DscUnidade é DscUnidadeTerciaria; VlrTusd é VlrTUSD): o parser
  segue o cabeçalho real e falha alto se ele mudar.
- componentes-tarifarias: as parcelas que somam a TE e a TUSD (Parquet anual; o
  Parquet é o mesmo conteúdo do CSV em formato colunar, 50 vezes menor, e publica o
  CNPJ como inteiro, sem zeros à esquerda: entidades.cnpj recompõe os 14 dígitos).
- bandeiras-tarifarias: adicional por patamar (por resolução) e bandeira acionada
  por mês de competência.
- subsidios-tarifarios: repasse mensal da CDE a cada distribuidora por categoria de
  desconto tarifário.
- conta-desenvolvimento-energetico-cde-custeio-dos-beneficios-tarifarios: valores anuais
  da CDE por rubrica de despesa (Tarifa Social, descontos, CCC...) e de receita (quotas
  cobradas nas tarifas, UBP, multas...).

Só números: nenhum valor é corrigido, arredondado ou completado aqui. Vazio vira
None (ausência); ",00" publicado pela fonte vira 0.0 (zero publicado), e quem
consome decide o que um zero significa em cada contexto.
"""
import os
import re
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import entidades  # noqa: E402
from pipeline.energia.fontes import ckan  # noqa: E402

NA = "Não se aplica"

# Cabeçalho real do CSV de tarifas em 30/09/2026 (difere do dicionário em cinco nomes).
CAMPOS_TARIFAS = ("DatGeracaoConjuntoDados", "DscREH", "SigAgente", "NumCNPJDistribuidora", "DatInicioVigencia",
                  "DatFimVigencia", "DscBaseTarifaria", "DscSubGrupo", "DscModalidadeTarifaria", "DscClasse",
                  "DscSubClasse", "DscDetalhe", "NomPostoTarifario", "DscUnidadeTerciaria", "SigAgenteAcessante",
                  "VlrTUSD", "VlrTE")
CAMPOS_COMPONENTES = ("DscResolucaoHomologatoria", "SigNomeAgente", "NumCPFCNPJ", "DatInicioVigencia", "DatFimVigencia",
                      "DscBaseTarifaria", "DscSubGrupoTarifario", "DscModalidadeTarifaria", "DscClasseConsumidor",
                      "DscSubClasseConsumidor", "DscDetalheConsumidor", "DscPostoTarifario", "DscUnidade",
                      "SigNomeAgenteAcessante", "DscComponenteTarifario", "VlrComponenteTarifario")
CAMPOS_SUBSIDIOS = ("DatSubsidio", "NumCNPJDistribuidora", "SigAgente", "NomAgente", "DscTipoMontante",
                    "DscTipoSubsidio", "VlrSubsidio", "DscAtoNormativo", "NumAto", "DatInicioVigenciaAto",
                    "DthPublicacaoAto")

# Recorte de baixa tensão que o módulo usa (comparação por perfil e simulador):
# convencional, sem detalhe (SCEE e APE são tarifas de nichos), sem posto, sem tarifa
# nominal de acessante específico. Base econômica entra para a distinção com a tarifa
# de aplicação; a CVA (só no conjunto de componentes) não entra.
SUBGRUPOS_BT = ("B1", "B2", "B3")
BASES = {"Tarifa de Aplicação": "TA", "Base Econômica": "BE"}

MESES = {"JANEIRO": 1, "FEVEREIRO": 2, "MARCO": 3, "MARÇO": 3, "ABRIL": 4, "MAIO": 5, "JUNHO": 6, "JULHO": 7,
         "AGOSTO": 8, "SETEMBRO": 9, "OUTUBRO": 10, "NOVEMBRO": 11, "DEZEMBRO": 12}
_ATO = re.compile(
    r"^(?P<tipo>RESOLUÇÃO HOMOLOGATÓRIA|DESPACHO|DSP RETIFICAÇÃO)\s*(?:N[º°]\s*(?P<num>[\d\.]+))?,?\s*"
    r"DE\s+(?P<dia>\d{1,2})º?\s+DE\s+(?P<mes>[A-ZÇ]+)\s+DE\s+(?P<ano>\d{4})\s*$")
SIGLA_ATO = {"RESOLUÇÃO HOMOLOGATÓRIA": "REH", "DESPACHO": "DSP", "DSP RETIFICAÇÃO": "DSP-RET"}


class EsquemaInesperado(RuntimeError):
    """O arquivo da fonte mudou de estrutura: melhor parar do que ler errado."""


def ato(texto):
    """'RESOLUÇÃO HOMOLOGATÓRIA Nº 3.589, DE 26 DE MAIO DE 2026' → ('REH 3.589/2026', '2026-05-26').
    Texto fora do padrão vira (texto aparado ou 'sem ato informado', None): a data do
    ato nunca é inventada."""
    t = (texto or "").strip()
    m = _ATO.match(t.upper())
    if not m:
        return (t or "sem ato informado"), None
    mes = MESES.get(m.group("mes"))
    data = f"{m.group('ano')}-{mes:02d}-{int(m.group('dia')):02d}" if mes else None
    sig = SIGLA_ATO[m.group("tipo")]
    ident = f"{sig} {m.group('num')}/{m.group('ano')}" if m.group("num") else f"{sig} {data}"
    return ident, data


def _confere_cabecalho(linha, campos, nome):
    faltam = [c for c in campos if c not in linha]
    if faltam:
        raise EsquemaInesperado(f"{nome}: cabeçalho sem {faltam}")


def normaliza_texto(s):
    """Espaços aparados; o texto da fonte é mantido (acentos inclusive)."""
    return re.sub(r"\s+", " ", (s or "").strip())


def linhas_tarifas(caminho_bronze, contagem=None):
    """Itera o CSV de tarifas e devolve só as linhas do recorte de baixa tensão, como
    dicts normalizados. `contagem` (dict) recebe os motivos de exclusão, para que o
    universo publicado diga quanto ficou de fora e por quê."""
    contagem = contagem if contagem is not None else {}
    primeira = True
    for row in ckan.le_csv_bronze(caminho_bronze):
        if primeira:
            _confere_cabecalho(row, CAMPOS_TARIFAS, "tarifas")
            primeira = False
        contagem["linhas_lidas"] = contagem.get("linhas_lidas", 0) + 1
        sub = normaliza_texto(row["DscSubGrupo"])
        motivo = None
        if sub not in SUBGRUPOS_BT:
            motivo = "fora_baixa_tensao_b1_b2_b3"
        elif normaliza_texto(row["DscModalidadeTarifaria"]) != "Convencional":
            motivo = "modalidade_nao_convencional"
        elif normaliza_texto(row["DscDetalhe"]) != NA:
            motivo = "detalhe_especifico"
        elif normaliza_texto(row["NomPostoTarifario"]) != NA:
            motivo = "posto_tarifario"
        elif normaliza_texto(row["SigAgenteAcessante"]) != NA:
            motivo = "tarifa_nominal_de_acessante"
        elif normaliza_texto(row["DscBaseTarifaria"]) not in BASES:
            motivo = "base_tarifaria_desconhecida"
        elif normaliza_texto(row["DscUnidadeTerciaria"]) != "MWh":
            # a TE é sempre R$/MWh; a TUSD pode ser R$/kW (demanda). No recorte
            # convencional de baixa tensão só se espera MWh: outra unidade não é
            # convertida em silêncio, fica de fora e contada
            motivo = "unidade_diferente_de_mwh"
        if motivo:
            contagem[motivo] = contagem.get(motivo, 0) + 1
            continue
        cnpj = entidades.cnpj(row["NumCNPJDistribuidora"])
        if not cnpj:
            contagem["sem_cnpj"] = contagem.get("sem_cnpj", 0) + 1
            continue
        ident, data_ato = ato(row["DscREH"])
        contagem["no_recorte"] = contagem.get("no_recorte", 0) + 1
        yield {
            "cnpj": cnpj,
            "sigla": normaliza_texto(row["SigAgente"]),
            "inicio": row["DatInicioVigencia"].strip()[:10],
            "fim": row["DatFimVigencia"].strip()[:10],
            "ato": ident, "ato_texto": normaliza_texto(row["DscREH"]), "ato_data": data_ato,
            "base": BASES[normaliza_texto(row["DscBaseTarifaria"])],
            "subgrupo": sub,
            "classe": normaliza_texto(row["DscClasse"]),
            "subclasse": normaliza_texto(row["DscSubClasse"]),
            "tusd": ckan.numero_br(row["VlrTUSD"]),
            "te": ckan.numero_br(row["VlrTE"]),
            "gerado_em": row["DatGeracaoConjuntoDados"].strip()[:10],
        }


def filtro_componentes_b1(tabela):
    """Recorte do Parquet de componentes: B1 residencial convencional, sem detalhe,
    sem posto, sem acessante nominal, tarifa de aplicação, em R$/MWh."""
    import pyarrow.compute as pc
    faltam = [c for c in CAMPOS_COMPONENTES if c not in tabela.schema.names]
    if faltam:
        raise EsquemaInesperado(f"componentes: colunas ausentes {faltam}")
    m = pc.and_(pc.equal(tabela["DscSubGrupoTarifario"], "B1"),
                pc.equal(tabela["DscModalidadeTarifaria"], "Convencional"))
    m = pc.and_(m, pc.equal(tabela["DscSubClasseConsumidor"], "Residencial"))
    m = pc.and_(m, pc.equal(tabela["DscDetalheConsumidor"], NA))
    m = pc.and_(m, pc.equal(tabela["DscPostoTarifario"], NA))
    m = pc.and_(m, pc.equal(tabela["SigNomeAgenteAcessante"], NA))
    m = pc.and_(m, pc.equal(tabela["DscBaseTarifaria"], "Tarifa de Aplicação"))
    return tabela.filter(m)


def linhas_componentes(caminho_bronze, contagem=None, lote=200000):
    """Linhas do recorte B1 de um Parquet anual de componentes (do bronze, gzip).

    O arquivo de 2025 tem mais de 3 milhões de linhas e só uma fração é B1 residencial:
    o Parquet é descomprimido em fluxo para um arquivo temporário (o leitor precisa de
    acesso aleatório) e lido em lotes, só com as colunas usadas, filtrando lote a lote.
    Assim a memória fica no tamanho de um lote, não no do arquivo."""
    import shutil
    import tempfile
    import pyarrow as pa
    import pyarrow.parquet as pq
    from pipeline.energia import base
    contagem = contagem if contagem is not None else {}
    fd, tmp = tempfile.mkstemp(prefix="conta-componentes-", suffix=".parquet")
    os.close(fd)
    try:
        with base.abre_bronze(caminho_bronze) as src, open(tmp, "wb") as dst:
            shutil.copyfileobj(src, dst, 1 << 20)
        arq = pq.ParquetFile(tmp)
        faltam = [c for c in CAMPOS_COMPONENTES if c not in arq.schema_arrow.names]
        if faltam:
            raise EsquemaInesperado(f"componentes: colunas ausentes {faltam}")
        contagem["linhas_lidas"] = contagem.get("linhas_lidas", 0) + arq.metadata.num_rows
        for bloco in arq.iter_batches(columns=list(CAMPOS_COMPONENTES), batch_size=lote):
            rec = filtro_componentes_b1(pa.Table.from_batches([bloco]))
            for row in rec.to_pylist():
                unidade = (row["DscUnidade"] or "").strip()
                if unidade != "R$/MWh":
                    contagem["unidade_diferente_de_mwh"] = contagem.get("unidade_diferente_de_mwh", 0) + 1
                    continue
                cnpj = entidades.cnpj(row["NumCPFCNPJ"])
                if not cnpj:
                    contagem["sem_cnpj"] = contagem.get("sem_cnpj", 0) + 1
                    continue
                ident, data_ato = ato(row["DscResolucaoHomologatoria"])
                contagem["no_recorte"] = contagem.get("no_recorte", 0) + 1
                v = row["VlrComponenteTarifario"]
                yield {
                    "cnpj": cnpj, "sigla": normaliza_texto(row["SigNomeAgente"]),
                    "inicio": str(row["DatInicioVigencia"])[:10], "fim": str(row["DatFimVigencia"])[:10],
                    "ato": ident, "ato_texto": normaliza_texto(row["DscResolucaoHomologatoria"]), "ato_data": data_ato,
                    "componente": normaliza_texto(row["DscComponenteTarifario"]),
                    "valor": None if v is None else float(v),
                }
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass


def data_br_iso(s):
    """'01/08/2023' → '2023-08-01'; vazio → None."""
    s = (s or "").strip()
    if not s:
        return None
    if re.match(r"^\d{4}-\d{2}-\d{2}", s):
        return s[:10]
    m = re.match(r"^(\d{2})/(\d{2})/(\d{4})", s)
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else None


def linhas_bandeira_adicional(caminho_bronze):
    """Adicional por patamar e resolução: [{resolucao, vigencia, bandeira, rs_mwh}].
    O campo chama VlrAdicionalBandeiraRSMWh e o dicionário o descreve como reais por
    kWh; os valores (18,85 para a amarela desde 2024) são R$/MWh, o que confere com a
    página oficial da ANEEL (R$ 0,01885 por kWh). Ver a reconciliação no teste."""
    out = []
    for row in ckan.le_csv_bronze(caminho_bronze):
        _confere_cabecalho(row, ("DscResolucao", "DatVigencia", "NomBandeiraAcionada", "VlrAdicionalBandeiraRSMWh"),
                           "bandeira adicional")
        out.append({"resolucao": normaliza_texto(row["DscResolucao"]), "vigencia": data_br_iso(row["DatVigencia"]),
                    "bandeira": normaliza_texto(row["NomBandeiraAcionada"]),
                    "rs_mwh": ckan.numero_br(row["VlrAdicionalBandeiraRSMWh"])})
    return out


def linhas_bandeira_acionamento(caminho_bronze):
    """Bandeira acionada por mês de competência: [{mes 'AAAA-MM', bandeira, rs_mwh}]."""
    out = []
    for row in ckan.le_csv_bronze(caminho_bronze):
        _confere_cabecalho(row, ("DatCompetencia", "NomBandeiraAcionada", "VlrAdicionalBandeira"), "bandeira acionamento")
        d = data_br_iso(row["DatCompetencia"])
        out.append({"mes": d[:7] if d else None, "bandeira": normaliza_texto(row["NomBandeiraAcionada"]),
                    "rs_mwh": ckan.numero_br(row["VlrAdicionalBandeira"])})
    return out


def linhas_subsidios(caminho_bronze, contagem=None):
    """Repasses de subsídio tarifário por distribuidora, mês de competência, tipo de
    montante (Previsão, Ajuste, Total) e categoria (inclui a linha 'Total' publicada)."""
    contagem = contagem if contagem is not None else {}
    primeira = True
    for row in ckan.le_csv_bronze(caminho_bronze):
        if primeira:
            _confere_cabecalho(row, CAMPOS_SUBSIDIOS, "subsídios")
            primeira = False
        contagem["linhas_lidas"] = contagem.get("linhas_lidas", 0) + 1
        cnpj = entidades.cnpj(row["NumCNPJDistribuidora"])
        mes = data_br_iso(row["DatSubsidio"])
        if not cnpj or not mes:
            contagem["sem_cnpj_ou_mes"] = contagem.get("sem_cnpj_ou_mes", 0) + 1
            continue
        yield {
            "cnpj": cnpj, "sigla": normaliza_texto(row["SigAgente"]), "nome": normaliza_texto(row["NomAgente"]),
            "mes": mes[:7], "montante": normaliza_texto(row["DscTipoMontante"]),
            "categoria": normaliza_texto(row["DscTipoSubsidio"]), "valor": ckan.numero_br(row["VlrSubsidio"]),
            "ato": f"{normaliza_texto(row['DscAtoNormativo'])} nº {normaliza_texto(row['NumAto'])}".strip(),
            "ato_inicio": data_br_iso(row["DatInicioVigenciaAto"]),
            "ato_publicacao": data_br_iso(row["DthPublicacaoAto"]),
        }


CAMPOS_CDE = ("DatGeracaoConjuntoDados", "AnoReferencia", "DscTipoFonte", "DscFonte", "VlrCusteio")


def linhas_cde_custeio(caminho_bronze, contagem=None):
    """Custeio anual da CDE por fonte de despesa e de receita: [{ano, tipo, fonte, valor,
    gerado_em}]. O nome da fonte é aparado ('RGR ' e 'RGR' aparecem em anos diferentes
    como a mesma rubrica); vazio vira None (a fonte não publicou valor para a rubrica no
    ano), '0' vira 0.0 (zero publicado). Rubrica repetida no mesmo ano e tipo depois de
    aparada, com valor diferente, é contada e fica a primeira: não se soma nada às cegas."""
    contagem = contagem if contagem is not None else {}
    vistos, out = {}, []
    primeira = True
    for row in ckan.le_csv_bronze(caminho_bronze):
        if primeira:
            _confere_cabecalho(row, CAMPOS_CDE, "cde custeio")
            primeira = False
        contagem["linhas_lidas"] = contagem.get("linhas_lidas", 0) + 1
        ano = (row["AnoReferencia"] or "").strip()
        if not re.match(r"^\d{4}$", ano):
            contagem["sem_ano"] = contagem.get("sem_ano", 0) + 1
            continue
        tipo, fonte = normaliza_texto(row["DscTipoFonte"]), normaliza_texto(row["DscFonte"])
        valor = ckan.numero_br(row["VlrCusteio"])
        chave = (ano, tipo, fonte)
        if chave in vistos:
            if vistos[chave] != valor:
                contagem["rubrica_repetida_com_valor_diferente"] = contagem.get("rubrica_repetida_com_valor_diferente", 0) + 1
            continue
        vistos[chave] = valor
        if valor is None:
            contagem["valor_vazio"] = contagem.get("valor_vazio", 0) + 1
        out.append({"ano": ano, "tipo": tipo, "fonte": fonte, "valor": valor,
                    "gerado_em": (row["DatGeracaoConjuntoDados"] or "").strip()[:10] or None})
    return out


def sem_acento(s):
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()


# SAMP (Sistema de Acompanhamento de Informações de Mercado para Regulação Econômica):
# avaliado como alternativa para a tarifa média de fornecimento e a carga tributária
# observada, e não usado (valores declarados com erro de ordem de grandeza em meses
# isolados; ver docs/observatorios/energia/modulos/conta.md, seção 5.3). O arquivo
# fica no bronze com sha256 e a conferência abaixo é refeita a cada gold, para que a
# justificativa da exclusão seja reproduzível e não uma lembrança.
CAMPOS_SAMP = ("NumCNPJAgenteDistribuidora", "SigAgenteDistribuidora", "NomTipoMercado", "DscModalidadeTarifaria",
               "DscSubGrupoTarifario", "DscClasseConsumoMercado", "DscSubClasseConsumidor", "DscDetalheConsumidor",
               "DscPostoTarifario", "DscOpcaoEnergia", "DscDetalheMercado", "DatCompetencia", "VlrMercado")
DETALHES_SAMP = ("Receita Energia (R$)", "ICMS (R$)", "Energia TE (kWh)")


def samp_residencial_mensal(caminho_bronze, lote=200000):
    """Soma mensal por distribuidora do recorte residencial comum do SAMP: subgrupo B1,
    modalidade convencional, classe e subclasse residencial, sem detalhe, mercado
    'Regular' cativo, para as linhas de receita de energia, ICMS e energia faturada.
    Devolve ({(cnpj, sigla, detalhe): {mes: valor}}, linhas lidas). Leitura em lotes e
    só com as colunas usadas (o arquivo de 2025 tem 1,4 milhão de linhas)."""
    import shutil
    import tempfile
    import pyarrow as pa
    import pyarrow.compute as pc
    import pyarrow.parquet as pq
    from pipeline.energia import base
    fd, tmp = tempfile.mkstemp(prefix="conta-samp-", suffix=".parquet")
    os.close(fd)
    out = {}
    try:
        with base.abre_bronze(caminho_bronze) as src, open(tmp, "wb") as dst:
            shutil.copyfileobj(src, dst, 1 << 20)
        arq = pq.ParquetFile(tmp)
        faltam = [c for c in CAMPOS_SAMP if c not in arq.schema_arrow.names]
        if faltam:
            raise EsquemaInesperado(f"samp: colunas ausentes {faltam}")
        for bloco in arq.iter_batches(columns=list(CAMPOS_SAMP), batch_size=lote):
            t = pa.Table.from_batches([bloco])
            m = pc.and_(pc.equal(t["DscSubGrupoTarifario"], "B1"), pc.equal(t["DscModalidadeTarifaria"], "Convencional"))
            m = pc.and_(m, pc.equal(t["DscClasseConsumoMercado"], "Residencial"))
            m = pc.and_(m, pc.equal(t["DscSubClasseConsumidor"], "Residencial"))
            m = pc.and_(m, pc.equal(t["DscDetalheConsumidor"], NA))
            m = pc.and_(m, pc.equal(t["NomTipoMercado"], "Regular"))
            m = pc.and_(m, pc.equal(t["DscOpcaoEnergia"], "CATIVO"))
            m = pc.and_(m, pc.is_in(t["DscDetalheMercado"], value_set=pa.array(DETALHES_SAMP)))
            for row in t.filter(m).to_pylist():
                cnpj = entidades.cnpj(row["NumCNPJAgenteDistribuidora"])
                if not cnpj or row["VlrMercado"] is None or row["DatCompetencia"] is None:
                    continue
                k = (cnpj, normaliza_texto(row["SigAgenteDistribuidora"]), row["DscDetalheMercado"])
                mes = str(row["DatCompetencia"])[:7]
                out.setdefault(k, {})
                out[k][mes] = out[k].get(mes, 0.0) + float(row["VlrMercado"])
        return out, arq.metadata.num_rows
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass
