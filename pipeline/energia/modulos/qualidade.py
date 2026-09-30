"""Módulo Qualidade do serviço de distribuição (painéis P051 a P054).

Gold: public/energia/gold/qualidade.json e CSVs em public/energia/series/qualidade_*.csv.

Fontes (detalhes, datas de consulta e evidências em
docs/observatorios/energia/modulos/qualidade.md):
- ANEEL, Indicadores Coletivos de Continuidade (DEC e FEC): valores mensais por conjunto
  (Parquet 2010-2019 e 2020-2029), limites anuais por conjunto (CSV) e compensações pagas
  por violação dos limites individuais (Parquet 2010-2019 e 2020-2029; o CSV de 2020-2029
  tem cerca de 1 GB e o Parquet oficial equivalente é o recurso usado);
- ANEEL, ranking da continuidade (páginas gov.br de 2021 em diante): DGC publicado, usado
  para reconciliar por caminho independente a agregação dos conjuntos;
- ANEEL, IASC (pesquisa anual de satisfação, com amostra por distribuidora);
- ANEEL, manifestações no 1º e 2º nível da distribuidora (tipologia da REN 1.000/2021,
  desde 2023) e Ouvidoria Setorial da ANEEL (desde 2023);
- ANEEL, atendimento às ocorrências emergenciais (TMP, TMD, TME, dias críticos);
- ANEEL, eventos em situação de emergência (2026) e IndQual Município (relação
  conjunto × município, para o mapa).

Por que a agregação é feita aqui e não lida pronta: a ANEEL publica DEC e FEC por
conjunto e por mês; o indicador da distribuidora e o do Brasil são a média ponderada pelo
número de unidades consumidoras de cada conjunto no mês, somada nos 12 meses. A regra é
conferida contra o DGC que a própria ANEEL publica no ranking (teste de reconciliação).
"""
import collections
import json
import math
import os
import re
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.common import http_get  # noqa: E402
from pipeline.energia import base, entidades  # noqa: E402
from pipeline.energia import evidencia as ev  # noqa: E402
from pipeline.energia.fontes import aneel_qualidade as fq  # noqa: E402
from pipeline.energia.fontes import ckan  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

GOLD = "qualidade.json"
ROTA = "/setor-eletrico/qualidade"
# Versão de cada importador: muda quando a regra de importação muda e força reprocessar
# só as vintages daquele tipo de arquivo (os Parquets grandes levam minutos).
VERSOES = {"continuidade": "3", "limites": "2", "compensacoes": "1", "iasc": "1", "manifestacoes": "2",
           "ouvidoria": "1", "atendimento": "1", "eventos": "2", "municipios": "1", "ranking": "1"}

DS_CONT = "aneel_continuidade"
DS_IASC = "aneel_iasc"
DS_MANIF = "aneel_manifestacoes"
DS_OUV = "aneel_ouvidoria"
DS_ATEND = "aneel_atendimento_emergencial"
DS_EVENTO = "aneel_eventos_emergencia"
DS_MUN = "aneel_indqual_municipio"
DS_RANK = "aneel_ranking_continuidade"

PAC_CONT = "indicadores-coletivos-de-continuidade-dec-e-fec"
PAC_IASC = "indice-aneel-de-satisfacao-do-consumidor-iasc"
PAC_MANIF = "manifestacoes-no-1o-e-2o-niveis-da-distribuidora"
PAC_OUV = "ouvidoria-setorial-aneel"
PAC_ATEND = "atendimento-ocorrencias-emergenciais"
PAC_EVENTO = "evento-situacao-de-emergencia"
PAC_MUN = "indqual-municipio"
URL_RANKING = "https://www.gov.br/aneel/pt-br/centrais-de-conteudos/relatorios-e-indicadores/distribuicao/ranking-de-continuidade"
LICENCA = ckan.LICENCA_ANEEL
LICENCA_GOVBR = ("Conteúdo público do portal gov.br da ANEEL; reprodução com citação da fonte "
                 "(política de uso do portal gov.br)")

ANO_INICIO_CONT = 2000       # primeiro ano do Parquet de continuidade por conjunto e mês
ANO_INICIO_PARCELAS = 2010   # parcelas desagregadas atuais (IP, IND, INE...) começam aqui
ANO_INICIO_TIPOLOGIA = 2023  # manifestações e Ouvidoria: tipologia da REN 1.000/2021
JANELA_CONJ_MES = 24          # meses por conjunto guardados no silver (grão mensal)
MESES_SERIE = 36              # meses nas séries mensais da gold
ANOS_SERIE_GOLD = 11          # anos por distribuidora na gold (o CSV tem desde 2010)

PAG = [{"rotulo": "Qualidade do serviço", "href": ROTA}]


def _url(pacote):
    return f"https://dadosabertos.aneel.gov.br/dataset/{pacote}"


REGISTRO = {
    "id": "qualidade", "gold": GOLD, "familia": "aneel_qualidade", "ordem": 41,
    "datasets": [
        {"orgao": "ANEEL", "nome": PAC_CONT, "slug": "aneel-continuidade-dec-fec", "dataset_silver": DS_CONT,
         "titulo": "Indicadores Coletivos de Continuidade (DEC e FEC)", "estado": "UTILIZADO EM INDICADOR",
         "url": _url(PAC_CONT), "licenca": LICENCA, "paginas": PAG,
         "downloads": ["/energia/series/qualidade_distribuidoras_anual.csv", "/energia/series/qualidade_distribuidoras_mensal.csv",
                       "/energia/series/qualidade_brasil.csv", "/energia/series/qualidade_conjuntos_anual.csv",
                       "/energia/series/qualidade_conjuntos_mensal.csv", "/energia/series/qualidade_compensacoes.csv"],
         "quebras": [
             {"data": "2010-01-01", "descricao": "O arquivo de 2000 a 2009 publica DEC e FEC por conjunto e mês com outra desagregação (DECi, DECx, Decr, Dec1 e equivalentes do FEC); as parcelas atuais (IP, IND, INE, INC, IPC, INO, XN, XP, XNC, XPC) começam em 2010. Os critérios de apuração e de expurgo mudaram entre os regimes: comparações de nível entre as duas décadas levam essa ressalva."},
             {"data": "2022-01-01", "descricao": "Revisão do Módulo 8 do PRODIST (REN 956/2021): desde 2022 o DEC e o FEC apurados correspondem exatamente às parcelas internas programada e não programada não expurgável; as parcelas externas em dia crítico deixaram de ser informadas pela maioria dos conjuntos; as compensações trimestrais e anuais passaram a ser publicadas com valor zero (verificado de 2022 a 2025)."},
             {"data": "2026-01-01", "descricao": "Compensações por violação do DISE (interrupção em situação de emergência) passam a ser publicadas."},
         ]},
        {"orgao": "ANEEL", "nome": "ranking-de-continuidade", "slug": "aneel-ranking-continuidade", "dataset_silver": DS_RANK,
         "titulo": "Ranking da continuidade do serviço (DGC publicado)", "estado": "UTILIZADO EM INDICADOR",
         "url": URL_RANKING, "licenca": LICENCA_GOVBR, "paginas": PAG,
         "downloads": ["/energia/series/qualidade_reconciliacao_dgc.csv"], "quebras": []},
        {"orgao": "ANEEL", "nome": PAC_IASC, "slug": "aneel-iasc", "dataset_silver": DS_IASC,
         "titulo": "Índice ANEEL de Satisfação do Consumidor (IASC)", "estado": "UTILIZADO EM INDICADOR",
         "url": _url(PAC_IASC), "licenca": LICENCA, "paginas": PAG,
         "downloads": ["/energia/series/qualidade_atendimento.csv"], "quebras": []},
        {"orgao": "ANEEL", "nome": PAC_MANIF, "slug": "aneel-manifestacoes-distribuidora", "dataset_silver": DS_MANIF,
         "titulo": "Manifestações no 1º e 2º nível da distribuidora", "estado": "UTILIZADO EM INDICADOR",
         "url": _url(PAC_MANIF), "licenca": LICENCA, "paginas": PAG,
         "downloads": ["/energia/series/qualidade_atendimento.csv"],
         "quebras": [{"data": "2023-01-01", "descricao": "Série integrada desde 2023, com granularidade municipal. O arquivo de 2023 ainda traz os códigos antigos em CodTipoManifestacao; a classificação usa o IdeTipoRCA, identificador estável da tipologia, traduzido para a tipologia da REN 1.000/2021 por tabela explícita extraída dos arquivos de 2024 a 2026. Os anos de 2010 a 2022 (outro arquivo e outra classificação) não são somados à série."},
                     {"data": "2024-01-01", "descricao": "Desde 2024 todas as quantidades vêm com o código da tipologia nova (hierárquico: 101 informação, 102 reclamação, 103 solicitação de serviço, 104 denúncia, 105 elogio, 106 sugestão, 107 cancelamento, 108 encerramento)."}]},
        {"orgao": "ANEEL", "nome": PAC_OUV, "slug": "aneel-ouvidoria-setorial", "dataset_silver": DS_OUV,
         "titulo": "Ouvidoria Setorial ANEEL", "estado": "UTILIZADO EM INDICADOR",
         "url": _url(PAC_OUV), "licenca": LICENCA, "paginas": PAG,
         "downloads": ["/energia/series/qualidade_atendimento.csv"], "quebras": []},
        {"orgao": "ANEEL", "nome": PAC_ATEND, "slug": "aneel-atendimento-emergencial", "dataset_silver": DS_ATEND,
         "titulo": "Atendimento às Ocorrências Emergenciais", "estado": "UTILIZADO EM INDICADOR",
         "url": _url(PAC_ATEND), "licenca": LICENCA, "paginas": PAG,
         "downloads": ["/energia/series/qualidade_atendimento.csv"], "quebras": []},
        {"orgao": "ANEEL", "nome": PAC_EVENTO, "slug": "aneel-eventos-situacao-emergencia", "dataset_silver": DS_EVENTO,
         "titulo": "Evento Situação de Emergência", "estado": "UTILIZADO EM INDICADOR",
         "url": _url(PAC_EVENTO), "licenca": LICENCA, "paginas": PAG,
         "downloads": ["/energia/series/qualidade_eventos_emergencia.csv"], "quebras": []},
        {"orgao": "ANEEL", "nome": PAC_MUN, "slug": "aneel-indqual-municipio", "dataset_silver": DS_MUN,
         "titulo": "IndQual Município (relação conjunto × município)", "estado": "UTILIZADO EM INDICADOR",
         "url": _url(PAC_MUN), "licenca": LICENCA, "paginas": PAG,
         "downloads": ["/energia/series/qualidade_municipios.csv", "/energia/series/qualidade_mapa.json"], "quebras": []},
    ],
    "arquivos": {
        "/energia/series/qualidade_distribuidoras_anual.csv": "cnpj; sigla; ano; meses (com DEC); dec_h e fec_interrupcoes (soma dos 12 meses; vazio se o ano não tem 12 meses); dec_limite_h e fec_limite_interrupcoes (média dos limites dos conjuntos ponderada pelas UCs médias); cobertura_limite (fração das UCs com limite); razao_dec e razao_fec (apurado ÷ limite); dgc_calculado (média das duas razões); dec_todas_parcelas_h e fec_todas_parcelas (soma de todas as parcelas publicadas, inclusive expurgadas); parcelas por grupo em horas e interrupções; ucs_media; conjuntos. Vazio = ausência.",
        "/energia/series/qualidade_distribuidoras_mensal.csv": "cnpj; sigla; mes (AAAA-MM); dec_h; fec_interrupcoes; ucs (UCs dos conjuntos com DEC no mês, denominador); ucs_total; conjuntos; cobertura (ucs ÷ ucs_total). DEC em horas e centésimos de hora, não minutos.",
        "/energia/series/qualidade_brasil.csv": "periodo (AAAA ou AAAA-MM); tipo (anual ou mensal); dec_h; fec_interrupcoes; dec_limite_h; fec_limite_interrupcoes; ucs; conjuntos; completo (1 = 12 meses ou mês com cobertura plena).",
        "/energia/series/qualidade_conjuntos_anual.csv": "conjunto (IdeConjUndConsumidoras); nome; cnpj; sigla; ano; meses; dec_h; fec_interrupcoes; dec_limite_h; fec_limite_interrupcoes; razao_dec; razao_fec; ucs_media. Soma dos meses publicados; o ano só é completo com 12 meses.",
        "/energia/series/qualidade_conjuntos_mensal.csv": "conjunto; cnpj; mes (AAAA-MM); dec_h; fec_interrupcoes; ucs. Últimos 24 meses publicados.",
        "/energia/series/qualidade_compensacoes.csv": "cnpj; sigla; competencia (AAAA-MM, AAAA-Tn ou AAAA); tipo (mensal, trimestral, anual, dicri, dise); unidade (uc = unidade consumidora, ug = unidade geradora); valor_rs (R$ nominais); quantidade (ocorrências de compensação, não UCs distintas).",
        "/energia/series/qualidade_atendimento.csv": "cnpj; sigla; ano; ucs_media; iasc (0 a 100); iasc_amostra (entrevistas); iasc_ordem; reclamacoes_distribuidora_n1 e _n2; reclamacoes_interrupcao_n1; por_mil_uc de cada uma; reclamacoes_ouvidoria_aneel; procedentes; por_100mil_uc; tmae_min; ocorrencias_emergenciais; meses de cada fonte no ano.",
        "/energia/series/qualidade_municipios.csv": "cod_ibge; municipio; uf; conjuntos (IDs separados por espaço); n_conjuntos; relacao (conjunto_exclusivo, conjunto_compartilhado, varios_conjuntos); dec_min_h e dec_max_h, fec_min e fec_max dos conjuntos que atendem o município no ano de referência. O valor é do conjunto inteiro, não medido no município.",
        "/energia/series/qualidade_mapa.json": "JSON compacto para o mapa: ano; colunas [cod_ibge, relacao (índice em relacoes), n_conjuntos, dec_min, dec_max, fec_min, fec_max]; valores dos conjuntos que atendem o município (intervalo), nunca medidos no município; null = sem conjunto com 12 meses no ano.",
        "/energia/series/qualidade_eventos_emergencia.csv": "cnpj; sigla; codigo; inicio e fim como publicados; duracao_h (vazio quando a data é implausível); duracao_ausente_motivo; chi_evento e chi_limite (consumidor × hora); razao_chi; plano_contingencia; nivel; origem.",
        "/energia/series/qualidade_reconciliacao_dgc.csv": "ano; porte; posicao; sigla_ranking; empresa (como publicada); cnpj (tabela explícita); dgc_publicado; dgc_calculado; diferenca.",
    },
}

# ---------------------------------------------------------------------------
# Coleta
# ---------------------------------------------------------------------------


def _tabela_importacoes(con):
    con.execute("""CREATE TABLE IF NOT EXISTS importacoes(
        vintage_id TEXT NOT NULL, versao TEXT NOT NULL, importado_em TEXT NOT NULL, detalhe TEXT,
        PRIMARY KEY(vintage_id, versao))""")


def _importado(con, vid, versao):
    _tabela_importacoes(con)
    return con.execute("SELECT 1 FROM importacoes WHERE vintage_id=? AND versao=?", (vid, versao)).fetchone() is not None


def _marca_importado(con, vid, versao, detalhe):
    _tabela_importacoes(con)
    con.execute("INSERT OR REPLACE INTO importacoes VALUES(?,?,?,?)",
                (vid, versao, base.agora_utc(), json.dumps(detalhe, ensure_ascii=False, default=str)[:2000]))


def _grava(con, ds, vid, linhas, lote_series=2000):
    """grava_observacoes em blocos de séries (a consulta de valores anteriores usa uma
    cláusula IN por série; blocos mantêm o número de parâmetros e a memória sob controle)."""
    por_serie = collections.defaultdict(list)
    for s, r, v in linhas:
        if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
            continue
        por_serie[s].append((s, r, v))
    series = sorted(por_serie)
    novas = revis = 0
    for i in range(0, len(series), lote_series):
        bloco = [x for s in series[i:i + lote_series] for x in por_serie[s]]
        n, rv = base.grava_observacoes(con, ds, vid, bloco)
        novas += n
        revis += rv
    return novas, revis


def _recursos_pacote(con, pacote, ds, escolha, status, max_idade_dias=20):
    """Baixa os recursos escolhidos de um pacote CKAN com nomes curtos de recurso (o nome
    entra no identificador de cada observação do silver). escolha(r) → (recurso, ext) ou
    None. Devolve {recurso: vintage vigente}."""
    try:
        pac = ckan.pacote("ANEEL", pacote)
    except Exception as e:
        base.registra_coleta(con, ds, "*", False, f"package_show: {e}")
        con.commit()
        status["falhas"].append(f"{pacote}: package_show: {str(e)[:200]}")
        return ckan.vintages_vigentes(con, ds)
    meta = ckan.metadados(pac, "ANEEL")
    base.escreve_gold(f"_meta_{ds}.json", meta, destino=os.path.join(base.DADOS, "meta"))
    vistos = set()
    for r in pac.get("resources", []):
        ch = escolha(r)
        if not ch:
            continue
        recurso, ext = ch
        vistos.add(recurso)
        res = ckan.baixar_recurso(con, orgao="ANEEL", dataset=ds, recurso=recurso, url=r.get("url"),
                                  publicado_em=r.get("last_modified") or r.get("metadata_modified"), ext=ext,
                                  max_idade_dias=max_idade_dias)
        status["recursos"][f"{ds}/{recurso}"] = res["status"]
        if res["status"] == "falha":
            status["falhas"].append(f"{ds}/{recurso}: {res['detalhe']}")
    out = ckan.vintages_vigentes(con, ds)
    return {k: v for k, v in out.items() if k in vistos or not vistos}


def _nome(r):
    return (r.get("name") or "").strip()


def _escolha_cont(r):
    n = _nome(r)
    fixos = {
        "indicadores-continuidade-coletivos-2000-2009.parquet": ("cont-2000-2009", "parquet"),
        "indicadores-continuidade-coletivos-2010-2019.parquet": ("cont-2010-2019", "parquet"),
        "indicadores-continuidade-coletivos-2020-2029.parquet": ("cont-2020-2029", "parquet"),
        "indicadores-continuidade-coletivos-limite": ("limite", "csv"),
        "dominio-indicadores-indqual": ("dominio", "csv"),
        "indicadores-continuidade-coletivos-compensacao-2010-2019.parquet": ("comp-2010-2019", "parquet"),
        "indicadores-continuidade-coletivos-compensacao-2020-2029.parquet": ("comp-2020-2029", "parquet"),
        "Dicionário de dados - Continuidade": ("dic-continuidade", "pdf"),
        "Dicionário de dados - Compensação": ("dic-compensacao", "pdf"),
        "Dicionário de dados - Limite": ("dic-limite", "pdf"),
    }
    return fixos.get(n)


def _escolha_iasc(r):
    n = _nome(r)
    if n == "indice-aneel-satisfacao-consumidor":
        return ("iasc", "csv")
    if n.lower().startswith("dicion"):
        return ("dic-iasc", "pdf")
    return None


def _escolha_manif(r):
    n = _nome(r)
    m = re.match(r"^manifestacoes-1-2-niveis-distribuidora-(\d{4})\.parquet$", n)
    if m and int(m.group(1)) >= ANO_INICIO_TIPOLOGIA:
        return (f"manif-{m.group(1)}", "parquet")
    if n.lower().startswith("dicion"):
        return ("dic-manif", "pdf")
    return None


def _escolha_ouv_factory(pac_recursos):
    """Ouvidoria: um arquivo por ano; usa o Parquet oficial quando existe para o ano e o
    CSV quando só ele é publicado (anos 2024 em diante, em 30/09/2026)."""
    anos_parquet = set()
    for r in pac_recursos:
        m = re.match(r"^ouvidoria-aneel-(\d{4})\.parquet$", _nome(r))
        if m:
            anos_parquet.add(int(m.group(1)))

    def escolha(r):
        n = _nome(r)
        m = re.match(r"^ouvidoria-aneel-(\d{4})(\.parquet)?$", n)
        if m and int(m.group(1)) >= ANO_INICIO_TIPOLOGIA:
            ano = int(m.group(1))
            if m.group(2):
                return (f"ouv-{ano}", "parquet")
            if ano not in anos_parquet:
                return (f"ouv-{ano}", "csv")
            return None
        if n.lower().startswith("dicion"):
            return ("dic-ouvidoria", "pdf")
        return None
    return escolha


def _escolha_atend(r):
    n = _nome(r)
    if n == "indicador-atendimento-emergencial.parquet":
        return ("atend", "parquet")
    if n.lower().startswith("dicion"):
        return ("dic-atend", "pdf")
    return None


def _escolha_evento(r):
    n = _nome(r)
    m = re.match(r"^evento-situacao-emergencia-(\d{4})\.csv$", n)
    if m:
        return (f"eventos-{m.group(1)}", "csv")
    if n == "decretos-calamidade-publica-situacao-emergencia.csv":
        return ("decretos", "csv")
    return None


def _escolha_mun(r):
    n = _nome(r)
    if n == "indqual-municipio":
        return ("municipios", "csv")
    if n.lower().startswith("dicion"):
        return ("dic-municipios", "pdf")
    return None


COLS_CONT = ["IdeConjUndConsumidoras", "DscConjUndConsumidoras", "SigAgente", "NumCNPJ", "SigIndicador",
             "AnoIndice", "NumPeriodoIndice", "VlrIndiceEnviado"]
COLS_COMP = ["NumCNPJ", "SigIndicador", "AnoIndice", "NumPeriodoIndice", "VlrIndiceEnviado"]
COLS_ATEND = ["NumCNPJ", "IdeConjUndConsumidoras", "SigIndicador", "AnoIndice", "NumPeriodoIndice", "VlrIndiceEnviado"]
COLS_MANIF = ["NumCPFCNPJ", "SigAgente", "NomCanalManifestacao", "CodTipoManifestacao", "IdeTipoRCA",
              "QtdManifestacoesRecebidas", "QtdManifestacoesProcedentes", "AnoCompetencia", "MesCompetencia",
              "NomClassificacaoAgente"]
COLS_OUV = ["NumCPFCNPJAgente", "SigAgente", "NomCategoria", "NomSubCategoria", "NomDecisao", "DtCriacao",
            "NumQtdReclamacoesDia"]


def importa_continuidade(con, vint, recurso):
    """Parquet de continuidade → silver no grão publicado: distribuidora-mês e Brasil-mês
    (agregação ponderada), parcelas anuais, conjunto-ano, conjunto-mês (janela recente)."""
    dados, cadastro, conflitos = fq.conjuntos_mes(fq.ler_parquet_bronze(vint["arquivo"], COLS_CONT))
    if not dados:
        raise ValueError(f"{recurso}: nenhum registro de continuidade lido")
    vid = vint["vintage_id"]
    linhas = []
    campos_m = ("dec", "fec", "ucs", "ucs_fec", "ucs_total", "nconj", "nconj_total")
    for chave, prefixo in ((lambda c14, conj: c14, "d{g}"), (lambda c14, conj: "br", "br")):
        for (g, ref), a in fq.agrega_mensal(dados, chave).items():
            nome = prefixo.format(g=g)
            linhas += [(f"{nome}.m.{k}", ref, a[k]) for k in campos_m]
        for (g, ano), a in fq.agrega_parcelas_anual(dados, chave).items():
            nome = prefixo.format(g=g)
            for k, v in a.items():
                if k.startswith("meses."):
                    continue
                linhas.append((f"{nome}.a.{k}", f"{ano:04d}", v))
    for ano, a in fq.identidade_apurado(dados).items():
        linhas += [(f"br.ident.{k}", f"{ano:04d}", v) for k, v in a.items()]
    for (conj, ano), a in fq.conjuntos_anual(dados).items():
        for k in ("dec", "fec", "meses", "meses_fec", "ucs_media"):
            linhas.append((f"c{conj}.a.{k}", f"{ano:04d}", a[k]))
    refs = sorted({f"{a:04d}-{m:02d}" for (_, _, a, m) in dados})
    janela = set(refs[-JANELA_CONJ_MES:]) if recurso.endswith("2029") else set()
    for (c14, conj, ano, mes), s in dados.items():
        ref = f"{ano:04d}-{mes:02d}"
        if ref in janela:
            linhas += [(f"c{conj}.m.dec", ref, s.get("DEC")), (f"c{conj}.m.fec", ref, s.get("FEC")),
                       (f"c{conj}.m.ucs", ref, s.get("NumCon"))]
    novas, revis = _grava(con, DS_CONT, vid, linhas)
    # cadastro do conjunto: CNPJ, sigla e nome como no período mais recente em que aparece
    # NESTE arquivo, guardado por recurso com o mês de referência. Os três arquivos por
    # década entram em ordem de captura qualquer; a escolha do cadastro vigente é feita na
    # leitura pelo mês mais recente, não pela captura (senão o arquivo de 2000-2009,
    # capturado por último, trocaria o nome atual de um conjunto pelo da década passada).
    anos_cnpj = collections.defaultdict(lambda: collections.defaultdict(set))
    for (c14, conj, ano, mes) in dados:
        anos_cnpj[conj][c14].add(ano)
    regs = []
    for conj, cad in cadastro.items():
        ref_txt = f"{cad['_ref'][0]:04d}-{cad['_ref'][1]:02d}"
        regs += [(f"conj:{conj}", f"cad.{recurso}",
                  json.dumps({"cnpj": cad["cnpj"], "sigla": cad["sigla"], "nome": cad["nome"], "ref": ref_txt},
                             ensure_ascii=False, sort_keys=True)),
                 (f"conj:{conj}", f"cnpj_anos.{recurso}",
                  ";".join(f"{c14}:{min(a)}-{max(a)}" for c14, a in sorted(anos_cnpj[conj].items())))]
    siglas = {}
    for conj, cad in cadastro.items():
        ref = cad["_ref"]
        if cad["sigla"] and ref >= siglas.get(cad["cnpj"], ((0, 0), None))[0]:
            siglas[cad["cnpj"]] = (ref, cad["sigla"])
    regs += [(f"dist:{c14}", f"sigla.{recurso}", json.dumps({"sigla": s, "ref": f"{r[0]:04d}-{r[1]:02d}"}, ensure_ascii=False))
             for c14, (r, s) in siglas.items()]
    base.grava_registros(con, DS_CONT, vid, regs)
    return {"conjunto_mes": len(dados), "observacoes_novas": novas, "revisoes": revis, "conflitos": conflitos,
            "periodo": [refs[0], refs[-1]]}


def importa_limites(con, vint):
    lim, _ = fq.le_limites(ckan.le_csv_bronze(vint["arquivo"]))
    # limites desde 2000, o primeiro ano com DEC e FEC mensais por conjunto publicados; os
    # anos futuros (definidos na revisão tarifária) ficam guardados e só são usados quando
    # o apurado do mesmo ano existir
    linhas = [(f"c{conj}.lim.{sig.lower()}", f"{ano:04d}", v) for (conj, ano, sig), v in lim.items() if ano >= ANO_INICIO_CONT]
    novas, revis = _grava(con, DS_CONT, vint["vintage_id"], linhas)
    return {"limites": len(lim), "observacoes_novas": novas, "revisoes": revis}


def importa_compensacoes(con, vint):
    por_mes, por_tensao, nao = fq.agrega_compensacoes(fq.ler_parquet_bronze(vint["arquivo"], COLS_COMP))
    linhas = [(f"k{c14}.{medida}.{unid}.{tipo}", ref, v) for (c14, medida, unid, tipo, ref), v in por_mes.items()]
    linhas += [(f"k{c14}.{medida}.uc.tensao.{t}", f"{ano:04d}", v) for (c14, medida, _, t, ano), v in por_tensao.items()]
    novas, revis = _grava(con, DS_CONT, vint["vintage_id"], linhas)
    return {"linhas": len(linhas), "observacoes_novas": novas, "revisoes": revis, "siglas_fora_do_padrao": nao}


def importa_iasc(con, vint):
    linhas, regs = [], []
    for ano, c14, v in fq.le_iasc(ckan.le_csv_bronze(vint["arquivo"])):
        for k in ("iasc", "qualidade", "valor", "fidelidade", "confianca", "ordem", "amostra"):
            linhas.append((f"d{c14}.{k}", f"{ano:04d}", v[k]))
        regs += [(f"iasc:{ano}:{c14}", "sigla", v["_sigla"]), (f"iasc:{ano}:{c14}", "categoria", v["_categoria"]),
                 (f"iasc:{ano}:{c14}", "classificacao", v["_classificacao"])]
    novas, revis = _grava(con, DS_IASC, vint["vintage_id"], linhas)
    base.grava_registros(con, DS_IASC, vint["vintage_id"], regs)
    return {"linhas": len(linhas), "observacoes_novas": novas, "revisoes": revis}


def importa_manifestacoes(con, vint):
    classif = {}

    def com_classificacao(lotes_):
        # a classificação (concessionária ou permissionária) só é publicada neste conjunto
        for d in lotes_:
            for cnpj, sig, cl in zip(d["NumCPFCNPJ"], d["SigAgente"], d["NomClassificacaoAgente"]):
                c14 = entidades.cnpj(cnpj)
                if c14 and c14 not in classif:
                    classif[c14] = ((cl or "").strip(), (sig or "").strip())
            yield d
    agg = fq.agrega_manifestacoes(com_classificacao(fq.ler_parquet_bronze(vint["arquivo"], COLS_MANIF)))
    linhas = [(f"d{c14}.{k}", ref, v) for (c14, ref), a in agg.items() for k, v in a.items()]
    novas, revis = _grava(con, DS_MANIF, vint["vintage_id"], linhas)
    regs = [(f"dist:{c14}", "classificacao", cl) for c14, (cl, _) in classif.items() if cl]
    regs += [(f"dist:{c14}", "sigla", s) for c14, (_, s) in classif.items() if s]
    base.grava_registros(con, DS_MANIF, vint["vintage_id"], regs)
    return {"distribuidora_mes": len(agg), "observacoes_novas": novas, "revisoes": revis}


def importa_ouvidoria(con, vint):
    if vint["arquivo"].endswith(".parquet.gz") or ".parquet" in vint["arquivo"]:
        linhas_src = fq.linhas_parquet_como_dicts(fq.ler_parquet_bronze(vint["arquivo"], COLS_OUV))
    else:
        linhas_src = ckan.le_csv_bronze(vint["arquivo"])
    agg = fq.agrega_ouvidoria(linhas_src)
    linhas = [(f"d{c14}.{k}", ref, v) for (c14, ref), a in agg.items() for k, v in a.items()]
    novas, revis = _grava(con, DS_OUV, vint["vintage_id"], linhas)
    return {"distribuidora_mes": len(agg), "observacoes_novas": novas, "revisoes": revis}


def importa_atendimento(con, vint):
    mensal, anual = fq.agrega_atendimento(fq.ler_parquet_bronze(vint["arquivo"], COLS_ATEND))
    linhas = []
    for (c14, ref), m in mensal.items():
        w = m.get("ocorr_tempos") or 0
        linhas += [(f"d{c14}.m.ocorr", ref, m.get("ocorr")), (f"d{c14}.m.nie", ref, m.get("nie")),
                   (f"d{c14}.m.ocorr_nie", ref, m.get("ocorr_nie")), (f"d{c14}.m.ocorr_tempos", ref, w or None)]
        if w:
            for k in ("tmae", "tmp", "tmd", "tme"):
                linhas.append((f"d{c14}.m.{k}", ref, m[f"{k}_num"] / w))
    for (c14, ano), a in anual.items():
        for k, v in a.items():
            linhas.append((f"d{c14}.a.{k}", f"{ano:04d}", v))
    novas, revis = _grava(con, DS_ATEND, vint["vintage_id"], linhas)
    return {"distribuidora_mes": len(mensal), "observacoes_novas": novas, "revisoes": revis}


def importa_eventos(con, vint):
    evs = fq.le_eventos_emergencia(ckan.le_csv_bronze(vint["arquivo"]))
    regs = []
    for e in evs:
        for k, v in e.items():
            if k != "codigo":
                regs.append((f"evento:{e['codigo']}", k, v))
    novas, revis = base.grava_registros(con, DS_EVENTO, vint["vintage_id"], regs)
    return {"eventos": len(evs), "registros_novos": novas, "revisoes": revis}


def importa_municipios(con, vint):
    pares = fq.le_conjunto_municipio(ckan.le_csv_bronze(vint["arquivo"]))
    por_mun = collections.defaultdict(set)
    nome = {}
    for conj, cod, nm, uf in pares:
        por_mun[cod].add(conj)
        nome[cod] = (nm, uf)
    regs = []
    for cod, conjs in por_mun.items():
        regs += [(f"mun:{cod}", "conjuntos", " ".join(str(x) for x in sorted(conjs))),
                 (f"mun:{cod}", "nome", nome[cod][0]), (f"mun:{cod}", "uf", nome[cod][1])]
    novas, revis = base.grava_registros(con, DS_MUN, vint["vintage_id"], regs)
    return {"pares": len(pares), "municipios": len(por_mun), "registros_novos": novas, "revisoes": revis}


def coleta_ranking(con, hoje, status):
    """Páginas gov.br do ranking (uma por ano, de 2021 ao ano anterior ao corrente)."""
    vig = {}
    for ano in range(2021, hoje.year):
        recurso = f"ranking-{ano}"
        url = f"{URL_RANKING}/{ano}"
        ultima = base.ultima_vintage(con, DS_RANK, recurso)
        if ultima and ultima["capturado_em"][:10] >= (hoje.replace(day=1)).isoformat():
            vig[recurso] = ultima
            status["recursos"][f"{DS_RANK}/{recurso}"] = "pulada"
            continue
        try:
            corpo, _ = http_get(url, accept="text/html")
        except Exception as e:
            base.registra_coleta(con, DS_RANK, recurso, False, f"download: {e}")
            status["recursos"][f"{DS_RANK}/{recurso}"] = "falha"
            if ultima:
                vig[recurso] = ultima
            continue
        texto = corpo.decode("utf-8", errors="replace")
        if "parent-fieldname-text" not in texto or "<table" not in texto:
            base.registra_coleta(con, DS_RANK, recurso, False, "página sem a tabela do ranking")
            status["recursos"][f"{DS_RANK}/{recurso}"] = "sem_tabela"
            continue
        cap = base.agora_utc()
        arquivo, sha = base.salva_bronze("aneel", DS_RANK, recurso, corpo, "html", cap)
        vid, nova = base.registra_vintage(con, DS_RANK, recurso, url, cap, None, sha, len(corpo), "coleta_direta", arquivo)
        base.registra_coleta(con, DS_RANK, recurso, True, f"{len(corpo)} bytes, {'vintage nova' if nova else 'idêntico'}")
        status["recursos"][f"{DS_RANK}/{recurso}"] = "nova" if nova else "identica"
        vig[recurso] = base.ultima_vintage(con, DS_RANK, recurso)
    return vig


def importa_ranking(con, vint, ano):
    with base.abre_bronze(vint["arquivo"]) as f:
        texto = f.read().decode("utf-8", errors="replace")
    linhas = fq.le_ranking_continuidade(texto, ano)
    regs = []
    for x in linhas:
        ch = f"rank:{ano}:{x['porte']}:{x['empresa']}"
        for k in ("posicao", "dgc_texto", "sigla", "regiao", "cnpj", "porte"):
            regs.append((ch, k, x[k]))
    base.grava_registros(con, DS_RANK, vint["vintage_id"], regs)
    return {"linhas": len(linhas), "sem_cnpj": [x["empresa"] for x in linhas if not x["cnpj"]]}


def importa_vintage(con, status, ds, recurso, vint, tipo, funcao, *args):
    """Importa uma vintage do bronze para o silver com a versão atual do importador `tipo`.
    Já importada nesta versão: nada a fazer. Importada com regra anterior: as linhas
    derivadas daquele arquivo são refeitas do zero (ver comentário abaixo)."""
    if not vint:
        return
    versao = f"{tipo}-{VERSOES[tipo]}"
    if _importado(con, vint["vintage_id"], versao):
        status["importacoes"][f"{ds}/{recurso}"] = "já importado"
        return
    try:
        # regra de importação nova para um arquivo já importado: as linhas derivadas
        # daquele arquivo são refeitas do zero. Sem isso, a chave (série, referência,
        # vintage) já existente faria o INSERT OR IGNORE manter o valor da regra antiga
        # e a mudança de método passaria por "revisão da fonte", o que ela não é.
        _tabela_importacoes(con)
        if con.execute("SELECT 1 FROM importacoes WHERE vintage_id=?", (vint["vintage_id"],)).fetchone():
            con.execute("DELETE FROM observacoes WHERE vintage_id=?", (vint["vintage_id"],))
            con.execute("DELETE FROM registros WHERE vintage_id=?", (vint["vintage_id"],))
        det = funcao(con, vint, *args)
        _marca_importado(con, vint["vintage_id"], versao, det)
        con.commit()
        status["importacoes"][f"{ds}/{recurso}"] = det
    except Exception as e:  # arquivo defeituoso ou esquema novo: registrado, sem número
        con.rollback()
        base.registra_coleta(con, ds, recurso, False, f"importação: {e}")
        con.commit()
        status["falhas"].append(f"{ds}/{recurso}: importação: {str(e)[:300]}")


def coletar(con, ctx):
    status = {"ok": True, "recursos": {}, "importacoes": {}, "falhas": []}
    hoje = ctx.get("hoje") or date.today()

    def importa(ds, recurso, vint, tipo, funcao, *args):
        importa_vintage(con, status, ds, recurso, vint, tipo, funcao, *args)

    vs = _recursos_pacote(con, PAC_CONT, DS_CONT, _escolha_cont, status)
    for rec in ("cont-2000-2009", "cont-2010-2019", "cont-2020-2029"):
        importa(DS_CONT, rec, vs.get(rec), "continuidade", importa_continuidade, rec)
    importa(DS_CONT, "limite", vs.get("limite"), "limites", importa_limites)
    for rec in ("comp-2010-2019", "comp-2020-2029"):
        importa(DS_CONT, rec, vs.get(rec), "compensacoes", importa_compensacoes)

    vs = _recursos_pacote(con, PAC_IASC, DS_IASC, _escolha_iasc, status)
    importa(DS_IASC, "iasc", vs.get("iasc"), "iasc", importa_iasc)

    vs = _recursos_pacote(con, PAC_MANIF, DS_MANIF, _escolha_manif, status)
    for rec in sorted(k for k in vs if k.startswith("manif-")):
        importa(DS_MANIF, rec, vs[rec], "manifestacoes", importa_manifestacoes)

    try:
        pac_ouv = ckan.pacote("ANEEL", PAC_OUV).get("resources", [])
    except Exception:
        pac_ouv = []
    vs = _recursos_pacote(con, PAC_OUV, DS_OUV, _escolha_ouv_factory(pac_ouv), status)
    for rec in sorted(k for k in vs if k.startswith("ouv-")):
        importa(DS_OUV, rec, vs[rec], "ouvidoria", importa_ouvidoria)

    vs = _recursos_pacote(con, PAC_ATEND, DS_ATEND, _escolha_atend, status)
    importa(DS_ATEND, "atend", vs.get("atend"), "atendimento", importa_atendimento)

    vs = _recursos_pacote(con, PAC_EVENTO, DS_EVENTO, _escolha_evento, status, max_idade_dias=7)
    for rec in sorted(k for k in vs if k.startswith("eventos-")):
        importa(DS_EVENTO, rec, vs[rec], "eventos", importa_eventos)

    vs = _recursos_pacote(con, PAC_MUN, DS_MUN, _escolha_mun, status)
    importa(DS_MUN, "municipios", vs.get("municipios"), "municipios", importa_municipios)

    for rec, vint in coleta_ranking(con, hoje, status).items():
        importa(DS_RANK, rec, vint, "ranking", importa_ranking, int(rec.split("-")[1]))
    con.commit()
    status["ok"] = not status["falhas"]
    return status


# ---------------------------------------------------------------------------
# Leitura do silver
# ---------------------------------------------------------------------------


def vigentes(con, ds, prefixo):
    """{(serie, ref): valor} vigente para as séries que começam com `prefixo` (mesma
    semântica de base.serie_vigente: vale a vintage de captura mais recente)."""
    out = {}
    cur = con.execute(
        """SELECT o.serie, o.ref, o.valor FROM observacoes o JOIN vintages v ON v.vintage_id=o.vintage_id
           WHERE o.dataset=? AND o.serie >= ? AND o.serie < ? ORDER BY v.capturado_em, o.rowid""",
        (ds, prefixo, prefixo + "￿"))
    for s, r, v in cur:
        out[(s, r)] = v
    return out


def arvore(obs, n_partes_chave=1):
    """{chave: {campo: {ref: valor}}} a partir de séries 'chave.campo...'."""
    out = collections.defaultdict(lambda: collections.defaultdict(dict))
    for (s, r), v in obs.items():
        partes = s.split(".")
        chave = ".".join(partes[:n_partes_chave])
        campo = ".".join(partes[n_partes_chave:])
        out[chave][campo][r] = v
    return out


# ---------------------------------------------------------------------------
# Regras de cálculo usadas na gold (testadas em pipeline/tests/test_energia_qualidade.py)
# ---------------------------------------------------------------------------


def meses_do_ano(ano):
    return [f"{ano:04d}-{m:02d}" for m in range(1, 13)]


def anual_de_mensal(mensal, ano, ate_mes=12, validos=None):
    """Soma dos meses 1..ate_mes de DEC e de FEC. Completo só se todos os meses têm valor;
    se falta algum, o total fica None (nunca soma parcial rotulada como ano). `validos`
    restringe os meses considerados (ex.: só meses nacionais completos)."""
    refs = [r for r in meses_do_ano(ano)[:ate_mes] if validos is None or r in validos]
    decs = [mensal.get("dec", {}).get(r) for r in refs]
    fecs = [mensal.get("fec", {}).get(r) for r in refs]
    completo = len(refs) == ate_mes
    ucs = [mensal.get("ucs_total", {}).get(r) for r in refs]
    ucs_ok = [u for u in ucs if u]
    cob = []
    for r in refs:
        u, ut = mensal.get("ucs", {}).get(r), mensal.get("ucs_total", {}).get(r)
        if u is not None and ut:
            cob.append(u / ut)
    meses = sum(1 for x in decs if x is not None)
    return {
        "dec": sum(decs) if completo and meses == len(refs) else None,
        "fec": sum(fecs) if completo and all(x is not None for x in fecs) else None,
        "meses": meses,
        "ucs_media": sum(ucs_ok) / len(ucs_ok) if ucs_ok else None,
        "cobertura_min": min(cob) if cob else None,
    }


def razao(apurado, limite):
    if apurado is None or not limite:
        return None
    return apurado / limite


def dgc(dec, fec, lim_dec, lim_fec):
    """DGC da ANEEL: média aritmética simples das razões apurado ÷ limite de DEC e FEC."""
    rd, rf = razao(dec, lim_dec), razao(fec, lim_fec)
    if rd is None or rf is None:
        return None
    return (rd + rf) / 2


def mes_completo(n, n_ref, tolerancia=0.99):
    """Mês completo: universo com dado (UCs no Brasil; distribuidoras nas compensações)
    ≥ 99% do máximo dos 12 meses anteriores. A fonte publica um mês novo antes de todas as
    distribuidoras enviarem; o mês parcial não entra em ano nem em comparação."""
    if not n or not n_ref:
        return False
    return n >= tolerancia * n_ref


def grupos_parcelas(anual_parc, ind):
    """{grupo: valor} somando as parcelas de cada grupo (parcela ausente não entra; grupo
    sem nenhuma parcela informada fica None)."""
    out = {}
    for g, ps in fq.GRUPOS_PARCELAS.items():
        vals = [anual_parc.get(f"{ind}{p}") for p in ps]
        vals = [v for v in vals if v is not None]
        out[g] = sum(vals) if vals else None
    return out


def classe_relacao(conjs_do_mun, municipios_do_conj):
    """conjunto_exclusivo: o município é atendido por um único conjunto que só cobre ele;
    conjunto_compartilhado: um conjunto, que cobre também outros municípios;
    varios_conjuntos: dois ou mais conjuntos (de uma ou mais distribuidoras)."""
    if len(conjs_do_mun) == 1:
        (cj,) = tuple(conjs_do_mun)
        return "conjunto_exclusivo" if len(municipios_do_conj.get(cj, ())) == 1 else "conjunto_compartilhado"
    return "varios_conjuntos"


def por_mil(num, den, fator=1000.0):
    if num is None or not den:
        return None
    return fator * num / den


# ---------------------------------------------------------------------------
# Evidência ("Comprove este número")
# ---------------------------------------------------------------------------


def _fonte_ev(con, ds, recursos, conjunto, url):
    """Bloco `fonte` da evidência com cada arquivo vigente usado no número (recurso, arquivo
    no bronze, sha256, captura e publicação informada pela fonte)."""
    vs = ckan.vintages_vigentes(con, ds)
    arqs = [ev.arquivo_de_vintage(vs[r]) for r in recursos if r in vs]
    caps = [a["capturado_em"] for a in arqs if a.get("capturado_em")]
    pubs = [a["publicado_em"] for a in arqs if a.get("publicado_em")]
    return {"orgao": "ANEEL", "conjunto": conjunto, "recurso": ", ".join(r for r in recursos if r in vs) or None,
            "url": url, "arquivo": None, "sha256": None, "capturado_em": max(caps) if caps else None,
            "publicado_em": max(pubs) if pubs else None, "arquivos": arqs or None}


def fmt_br(v, casas=2, sufixo=""):
    """Número no formato brasileiro (milhar com ponto, decimal com vírgula); None = sem dado."""
    if v is None:
        return None
    txt = f"{v:,.{casas}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return txt + sufixo


def evidencia(**kw):
    """Evidência validada pelo construtor comum (pipeline/energia/evidencia.py). Uma
    evidência que não comprova o número (sem arquivo, sem teste, ausência exibida como
    número) derruba a construção da gold em vez de ser publicada."""
    kw.setdefault("reproducao", REPRODUCAO)
    return ev.construir(**kw)


REPRODUCAO = ("python3 pipeline/energia/executar_modulo.py qualidade --sem-coleta (a partir do silver "
              "data/energia/silver/aneel_qualidade.db); os CSV em /energia/series/qualidade_*.csv permitem refazer "
              "cada soma e cada média ponderada sem o pipeline.")


# ---------------------------------------------------------------------------
# Construção da gold
# ---------------------------------------------------------------------------


def _r(v, casas=2):
    return c.r(v, casas)


def _mais_recente(campos, prefixo):
    """Entre os campos `prefixo.<recurso>` (JSON com "ref"), o de mês de referência mais recente."""
    melhor = None
    for k, v in campos.items():
        if not k.startswith(prefixo + "."):
            continue
        try:
            d = json.loads(v)
        except ValueError:
            continue
        if melhor is None or (d.get("ref") or "") > (melhor.get("ref") or ""):
            melhor = d
    return melhor or {}


def _cadastro(con):
    """Cadastro vigente de conjuntos e siglas das distribuidoras: o do mês mais recente em
    que aparecem, entre todos os arquivos por década. `cnpj_ano` guarda o CNPJ de cada ano
    (um conjunto pode mudar de distribuidora; o valor de um ano fica com quem o publicou)."""
    regs = base.registros_como_estavam_em(con, DS_CONT)
    conj = {}
    siglas = {}
    for ch, campos in regs.items():
        if ch.startswith("conj:"):
            cj = int(ch.split(":")[1])
            anos = {}
            for k, v in sorted(campos.items()):
                if k.startswith("cnpj_anos."):
                    for parte in v.split(";"):
                        if ":" in parte:
                            c14, faixa = parte.split(":")
                            a0, a1 = faixa.split("-")
                            for a in range(int(a0), int(a1) + 1):
                                anos[a] = c14
            cad = _mais_recente(campos, "cad")
            conj[cj] = {"cnpj": cad.get("cnpj"), "sigla": cad.get("sigla"), "nome": cad.get("nome"),
                        "ref": cad.get("ref"), "cnpj_ano": anos}
        elif ch.startswith("dist:"):
            siglas[ch.split(":")[1]] = _mais_recente(campos, "sigla").get("sigla")
    return conj, siglas


def _nomes_distribuidoras(con_iasc_regs, siglas_cont, manif_regs):
    """Sigla da continuidade (SigAgente atual da ANEEL) e nome comercial do IASC mais
    recente, quando a distribuidora está na pesquisa. Nada de vínculo por nome: tudo por CNPJ."""
    nomes = {}
    for ch, campos in sorted(con_iasc_regs.items()):
        if ch.startswith("iasc:"):
            _, ano, c14 = ch.split(":")
            nomes[c14] = campos.get("sigla") or nomes.get(c14)
    classif = {}
    for ch, campos in manif_regs.items():
        if ch.startswith("dist:") and campos.get("classificacao"):
            classif[ch.split(":")[1]] = campos["classificacao"]
    return nomes, classif


def construir(con, ctx):
    snap = c.snapshot_de(con, DS_CONT)
    if not snap.get("capturas"):
        return c.stub(GOLD, "continuidade ANEEL ausente no silver (coleta ainda não executada)")
    d_obs = arvore(vigentes(con, DS_CONT, "d"))
    br = arvore(vigentes(con, DS_CONT, "br")).get("br", {})
    c_obs = arvore(vigentes(con, DS_CONT, "c"))
    k_obs = arvore(vigentes(con, DS_CONT, "k"))
    if not br.get("m.dec"):
        return c.stub(GOLD, "série nacional de DEC ausente no silver")
    cadastro, siglas = _cadastro(con)
    iasc_regs = base.registros_como_estavam_em(con, DS_IASC)
    manif_regs = base.registros_como_estavam_em(con, DS_MANIF)
    nome_comercial, classificacao = _nomes_distribuidoras(iasc_regs, siglas, manif_regs)
    for ch, campos in manif_regs.items():
        if ch.startswith("dist:") and campos.get("sigla"):
            siglas.setdefault(ch.split(":")[1], campos["sigla"])

    def sigla(c14):
        return siglas.get(c14) or nome_comercial.get(c14) or None

    # ---------------- Brasil: meses completos, ano de referência, parcial ----------------
    br_m = {k[2:]: v for k, v in br.items() if k.startswith("m.")}
    refs = sorted(br_m["dec"])
    completos = {}
    for i, r in enumerate(refs):
        # UCs e não número de conjuntos: redefinições de conjuntos (como a de 2011) mudam a
        # contagem de conjuntos sem mudar o universo de consumidores
        anteriores = [br_m["ucs_total"].get(x) or 0 for x in refs[max(0, i - 12):i + 1]]
        completos[r] = mes_completo(br_m["ucs"].get(r), max(anteriores))
    anos = sorted({int(r[:4]) for r in refs})
    anos_completos = [a for a in anos if all(completos.get(r) for r in meses_do_ano(a))]
    ano_ref = max(anos_completos)
    ultimo_mes = max(r for r in refs if completos[r])
    ano_parcial = int(ultimo_mes[:4]) if int(ultimo_mes[:4]) > ano_ref else None
    ate_mes_parcial = int(ultimo_mes[5:7]) if ano_parcial else None

    # ---------------- conjuntos por ano e limites ----------------
    conj_ano = {}   # (conj, ano) → dict
    limites = {}    # (conj, ano, 'DEC'|'FEC') → valor
    for chave, campos in c_obs.items():
        cj = int(chave[1:])
        for ref, v in campos.get("lim.dec", {}).items():
            limites[(cj, int(ref), "DEC")] = v
        for ref, v in campos.get("lim.fec", {}).items():
            limites[(cj, int(ref), "FEC")] = v
        for ref in campos.get("a.meses", {}):
            a = int(ref)
            cad = cadastro.get(cj, {})
            conj_ano[(cj, a)] = {"cnpj": cad.get("cnpj_ano", {}).get(a) or cad.get("cnpj"),
                                 "dec": campos.get("a.dec", {}).get(ref), "fec": campos.get("a.fec", {}).get(ref),
                                 "meses": int(campos["a.meses"][ref]),
                                 "meses_fec": int(campos.get("a.meses_fec", {}).get(ref) or 0),
                                 "ucs_media": campos.get("a.ucs_media", {}).get(ref)}

    def limites_ano(ano, grupo):
        return fq.limite_agregado({k: v for k, v in conj_ano.items() if k[1] == ano}, limites, grupo, ano)

    lim_dist = {a: limites_ano(a, lambda cj, c14: c14) for a in anos}
    lim_br = {a: limites_ano(a, lambda cj, c14: "br").get("br", {}) for a in anos}

    # ---------------- Brasil anual ----------------
    br_parc = {k[2:]: v for k, v in br.items() if k.startswith("a.")}
    brasil_anual = []
    validos_br = {r for r, ok in completos.items() if ok}
    for a in anos:
        an = anual_de_mensal(br_m, a, validos=validos_br)
        completo = a in anos_completos
        lim = lim_br.get(a, {})
        parc = {k: v.get(f"{a:04d}") for k, v in br_parc.items()}
        brasil_anual.append({
            "ano": a, "completo": completo, "meses": an["meses"],
            "dec": _r(an["dec"]) if completo else None, "fec": _r(an["fec"]) if completo else None,
            "dec_limite": _r(lim.get("dec")), "fec_limite": _r(lim.get("fec")),
            "cobertura_limite": _r(lim.get("cob_dec"), 4),
            "razao_dec": _r(razao(an["dec"], lim.get("dec")), 3) if completo else None,
            "razao_fec": _r(razao(an["fec"], lim.get("fec")), 3) if completo else None,
            "dec_todas_parcelas": _r(parc.get("DECTOT")) if completo else None,
            "fec_todas_parcelas": _r(parc.get("FECTOT")) if completo else None,
            # antes de 2010 a fonte publica outra desagregação (DECi, DECx...): sem parcelas atuais
            "parcelas_dec": ({g: _r(v) for g, v in grupos_parcelas(parc, "DEC").items()}
                             if completo and a >= ANO_INICIO_PARCELAS else None),
            "parcelas_fec": ({g: _r(v) for g, v in grupos_parcelas(parc, "FEC").items()}
                             if completo and a >= ANO_INICIO_PARCELAS else None),
            "ucs_media": _r(an["ucs_media"], 0),
            "conjuntos": sum(1 for (cj, aa), v in conj_ano.items() if aa == a and v["meses"] > 0),
        })
    ult = refs[-MESES_SERIE:]
    brasil_mensal = [{"m": r, "dec": _r(br_m["dec"].get(r)), "fec": _r(br_m["fec"].get(r)),
                      "ucs": _r(br_m["ucs"].get(r), 0), "conjuntos": int(br_m["nconj"].get(r) or 0),
                      "completo": completos[r]} for r in ult]
    parcial = None
    if ano_parcial:
        atual = anual_de_mensal(br_m, ano_parcial, ate_mes_parcial)
        anterior = anual_de_mensal(br_m, ano_parcial - 1, ate_mes_parcial)
        parcial = {"ano": ano_parcial, "ate_mes": f"{ano_parcial:04d}-{ate_mes_parcial:02d}", "meses": ate_mes_parcial,
                   "dec": _r(atual["dec"]), "fec": _r(atual["fec"]),
                   "dec_mesmos_meses_ano_anterior": _r(anterior["dec"]), "fec_mesmos_meses_ano_anterior": _r(anterior["fec"]),
                   "aviso": f"Acumulado de janeiro a {c.MESES[ate_mes_parcial - 1]}/{ano_parcial}: não é comparável a um ano completo; a comparação publicada é com os mesmos meses de {ano_parcial - 1}."}

    # ---------------- distribuidoras ----------------
    dist = {}
    serie_csv_anual, serie_csv_mensal = [], []
    for chave, campos in d_obs.items():
        c14 = chave[1:]
        mensal = {k[2:]: v for k, v in campos.items() if k.startswith("m.")}
        parc_a = {k[2:]: v for k, v in campos.items() if k.startswith("a.")}
        if not mensal.get("dec"):
            continue
        serie = []
        for a in anos:
            an = anual_de_mensal(mensal, a)
            if an["meses"] == 0:
                continue
            lim = lim_dist.get(a, {}).get(c14, {})
            parc = {k: v.get(f"{a:04d}") for k, v in parc_a.items()}
            gd, gf = grupos_parcelas(parc, "DEC"), grupos_parcelas(parc, "FEC")
            nconj = sum(1 for (cj, aa), v in conj_ano.items() if aa == a and v["cnpj"] == c14 and v["meses"] > 0)
            linha = {"ano": a, "meses": an["meses"], "dec": an["dec"], "fec": an["fec"],
                     "dec_limite": lim.get("dec"), "fec_limite": lim.get("fec"), "cobertura_limite": lim.get("cob_dec"),
                     "razao_dec": razao(an["dec"], lim.get("dec")), "razao_fec": razao(an["fec"], lim.get("fec")),
                     "dgc": dgc(an["dec"], an["fec"], lim.get("dec"), lim.get("fec")),
                     "dec_todas_parcelas": parc.get("DECTOT") if an["dec"] is not None else None,
                     "fec_todas_parcelas": parc.get("FECTOT") if an["fec"] is not None else None,
                     "parcelas_dec": gd, "parcelas_fec": gf, "ucs_media": an["ucs_media"],
                     "cobertura_min": an["cobertura_min"], "conjuntos": nconj}
            serie.append(linha)
            serie_csv_anual.append([c14, sigla(c14), a, an["meses"], linha["dec"], linha["fec"], linha["dec_limite"],
                                    linha["fec_limite"], linha["cobertura_limite"], linha["razao_dec"], linha["razao_fec"],
                                    linha["dgc"], linha["dec_todas_parcelas"], linha["fec_todas_parcelas"],
                                    gd["emergencia"], gd["dia_critico"], gd["externa"], gd["ons"],
                                    gf["emergencia"], gf["dia_critico"], gf["externa"], gf["ons"],
                                    an["ucs_media"], nconj])
        for r in sorted(mensal["dec"]):
            u, ut = mensal.get("ucs", {}).get(r), mensal.get("ucs_total", {}).get(r)
            serie_csv_mensal.append([c14, sigla(c14), r, mensal["dec"].get(r), mensal.get("fec", {}).get(r), u, ut,
                                     int(mensal.get("nconj", {}).get(r) or 0), (u / ut) if u is not None and ut else None])
        dist[c14] = {"serie": serie, "mensal": mensal}

    # ---------------- conjuntos no ano de referência (P052) ----------------
    linhas_conj = []
    for (cj, a), v in conj_ano.items():
        if a != ano_ref or v["meses"] != 12 or v["dec"] is None:
            continue
        ld, lf = limites.get((cj, a, "DEC")), limites.get((cj, a, "FEC"))
        cad = cadastro.get(cj, {})
        linhas_conj.append({"conjunto": cj, "nome": cad.get("nome"), "cnpj": v["cnpj"], "sigla": sigla(v["cnpj"]),
                            "dec": v["dec"], "fec": v["fec"] if v["meses_fec"] == 12 else None,
                            "dec_limite": ld, "fec_limite": lf, "razao_dec": razao(v["dec"], ld),
                            "razao_fec": razao(v["fec"], lf) if v["meses_fec"] == 12 else None,
                            "ucs": v["ucs_media"]})
    conj_hist = []
    for a in anos_completos:
        rs, ucs_acima, ucs_tot, acima, com_lim, decs = [], 0.0, 0.0, 0, 0, []
        for (cj, aa), v in conj_ano.items():
            if aa != a or v["meses"] != 12 or v["dec"] is None:
                continue
            decs.append(v["dec"])
            ld = limites.get((cj, a, "DEC"))
            if ld:
                com_lim += 1
                rz = v["dec"] / ld
                rs.append(rz)
                ucs_tot += v["ucs_media"] or 0
                if v["dec"] > ld:
                    acima += 1
                    ucs_acima += v["ucs_media"] or 0
        conj_hist.append({"ano": a, "conjuntos": len(decs), "com_limite": com_lim, "acima_limite_dec": acima,
                          "pct_acima_limite_dec": _r(100 * acima / com_lim, 1) if com_lim else None,
                          "pct_ucs_acima_limite_dec": _r(100 * ucs_acima / ucs_tot, 1) if ucs_tot else None,
                          "dec_p50": _r(c.quantil(decs, 0.5)), "dec_p90": _r(c.quantil(decs, 0.9)),
                          "razao_p50": _r(c.quantil(rs, 0.5), 3), "razao_p90": _r(c.quantil(rs, 0.9), 3)})
    decs = [x["dec"] for x in linhas_conj]
    fecs = [x["fec"] for x in linhas_conj if x["fec"] is not None]
    rz = [x["razao_dec"] for x in linhas_conj if x["razao_dec"] is not None]
    rzf = [x["razao_fec"] for x in linhas_conj if x["razao_fec"] is not None]
    acima_dec = [x for x in linhas_conj if x["razao_dec"] is not None and x["dec"] > x["dec_limite"]]
    acima_fec = [x for x in linhas_conj if x["razao_fec"] is not None and x["fec"] > x["fec_limite"]]
    acima_algum = {x["conjunto"] for x in acima_dec} | {x["conjunto"] for x in acima_fec}
    ucs_lim = sum(x["ucs"] or 0 for x in linhas_conj if x["razao_dec"] is not None)
    ucs_acima = sum(x["ucs"] or 0 for x in acima_dec)
    faixas = [(0, 0.5), (0.5, 0.75), (0.75, 1.0), (1.0, 1.25), (1.25, 1.5), (1.5, 2.0), (2.0, 3.0), (3.0, None)]

    def hist(vals):
        out = []
        for lo, hi in faixas:
            n = sum(1 for v in vals if v > lo and (hi is None or v <= hi)) if lo > 0 else sum(1 for v in vals if v <= hi)
            out.append({"de": lo, "ate": hi, "conjuntos": n})
        return out

    def quantis(vals, casas=2):
        return {f"p{int(q * 100)}": _r(c.quantil(vals, q), casas) for q in (0.1, 0.25, 0.5, 0.75, 0.9, 0.99)} | \
            {"min": _r(min(vals), casas) if vals else None, "max": _r(max(vals), casas) if vals else None}

    def conj_publico(x):
        return {"conjunto": x["conjunto"], "nome": x["nome"], "cnpj": x["cnpj"], "sigla": x["sigla"],
                "dec": _r(x["dec"]), "fec": _r(x["fec"]), "dec_limite": _r(x["dec_limite"]), "fec_limite": _r(x["fec_limite"]),
                "razao_dec": _r(x["razao_dec"], 3), "razao_fec": _r(x["razao_fec"], 3), "ucs": _r(x["ucs"], 0)}

    cauda_razao = sorted((x for x in linhas_conj if x["razao_dec"] is not None), key=lambda x: -x["razao_dec"])[:25]
    cauda_dec = sorted(linhas_conj, key=lambda x: -x["dec"])[:25]

    # ---------------- compensações (P053) ----------------
    comp_anual = collections.defaultdict(lambda: collections.defaultdict(float))  # ano → chave → soma
    comp_mensal = collections.defaultdict(lambda: collections.defaultdict(float))
    comp_dist = collections.defaultdict(lambda: collections.defaultdict(lambda: collections.defaultdict(float)))
    comp_meses = collections.defaultdict(set)
    comp_csv = []
    for chave, campos in k_obs.items():
        c14 = chave[1:]
        for campo, refs_ in campos.items():
            partes = campo.split(".")
            if partes[2] == "tensao":
                continue
            medida, unid, tipo = partes
            for ref, v in refs_.items():
                ano = int(ref[:4])
                comp_anual[ano][f"{medida}.{unid}.{tipo}"] += v
                comp_anual[ano][medida] += v
                comp_dist[c14][ano][medida] += v
                comp_dist[c14][ano][f"{medida}.{tipo}"] += v
                if len(ref) == 7 and ref[4] == "-" and ref[5:].isdigit():   # AAAA-MM (não AAAA-Tn)
                    comp_mensal[ref][medida] += v
                    comp_meses[c14].add(ref)
                comp_csv.append((c14, ref, tipo, unid, medida, v))
    comp_mensal_meses = sorted(comp_mensal)
    # mês de compensação "completo": as distribuidoras que informaram no mês somam ≥ 99% das
    # que informaram no mês anterior (mesma lógica da continuidade)
    n_dist_mes = {r: sum(1 for c14 in comp_meses if r in comp_meses[c14]) for r in comp_mensal_meses}
    comp_ultimo_completo = None
    for i, r in enumerate(comp_mensal_meses):
        ref_n = max(n_dist_mes[x] for x in comp_mensal_meses[max(0, i - 12):i + 1])
        if mes_completo(n_dist_mes[r], ref_n):
            comp_ultimo_completo = r
    comp_anos = sorted(comp_anual)
    comp_ano_ref = ano_ref if ano_ref in comp_anual else max(comp_anos)
    tipos = ("mensal", "trimestral", "anual", "dicri", "dise")

    # ---------------- P054: IASC, reclamações, ouvidoria, atendimento, eventos ----------------
    iasc = arvore(vigentes(con, DS_IASC, "d"))
    manif = arvore(vigentes(con, DS_MANIF, "d"))
    ouv = arvore(vigentes(con, DS_OUV, "d"))
    atend = arvore(vigentes(con, DS_ATEND, "d"))
    ucs_ano = {}
    for c14, dd in dist.items():
        for x in dd["serie"]:
            ucs_ano[(c14, x["ano"])] = x["ucs_media"]
    anos_manif = sorted({int(r[:4]) for ch in manif.values() for refs_ in ch.values() for r in refs_})
    anos_ouv = sorted({int(r[:4]) for ch in ouv.values() for refs_ in ch.values() for r in refs_})

    def soma_ano(campos, campo, ano, ate_mes=12):
        refs_ = [r for r in campos.get(campo, {}) if r[:4] == f"{ano:04d}" and int(r[5:7]) <= ate_mes]
        return (sum(campos[campo][r] for r in refs_) if refs_ else None), len(refs_)

    def meses_fonte(campos, ano):
        return len({r for refs_ in campos.values() for r in refs_ if r[:4] == f"{ano:04d}"})

    atendimento_csv = []
    meses_ouv_ano = collections.defaultdict(set)   # meses cobertos pelo arquivo da Ouvidoria em cada ano
    for ch in ouv.values():
        for refs_ in ch.values():
            for r in refs_:
                meses_ouv_ano[int(r[:4])].add(r)
    tmae_br = collections.defaultdict(lambda: [0.0, 0.0, 0])   # ano → [Σ TMAE × peso, Σ peso, distribuidoras]
    iasc_anos = sorted({int(r) for ch in iasc.values() for r in ch.get("iasc", {})})
    todos_cnpj = sorted(set(dist) | {k[1:] for k in iasc} | {k[1:] for k in manif} | {k[1:] for k in ouv} | {k[1:] for k in atend})
    anos_p054 = sorted(set(iasc_anos[-3:]) | set(anos_manif) | set(anos_ouv) | {ano_ref})
    for c14 in todos_cnpj:
        ci, cm, co, ca = iasc.get("d" + c14, {}), manif.get("d" + c14, {}), ouv.get("d" + c14, {}), atend.get("d" + c14, {})
        for a in anos_p054:
            ucs = ucs_ano.get((c14, a))
            r1, m1 = soma_ano(cm, "n1.recl", a)
            r1i, _ = soma_ano(cm, "n1.recl_interrupcao", a)
            r2, _ = soma_ano(cm, "n2.recl", a)
            ro, mo = soma_ano(co, "recl", a)
            rop, _ = soma_ano(co, "recl_proc", a)
            oc, ma = soma_ano(ca, "m.ocorr", a)
            w, _ = soma_ano(ca, "m.ocorr_tempos", a)
            tm_num = sum(ca.get("m.tmae", {}).get(r, 0) * ca.get("m.ocorr_tempos", {}).get(r, 0)
                         for r in ca.get("m.tmae", {}) if r[:4] == f"{a:04d}")
            tmae = tm_num / w if w else None
            if w:
                tmae_br[a][0] += tm_num
                tmae_br[a][1] += w
                tmae_br[a][2] += 1
            ia = ci.get("iasc", {}).get(f"{a:04d}")
            if all(x is None for x in (ia, r1, ro, oc)):
                continue
            # taxas só com o ano inteiro: manifestações exigem os 12 meses enviados pela
            # própria distribuidora (mês não enviado é ausência, não zero); a Ouvidoria da
            # ANEEL é um registro de solicitações, então basta o arquivo cobrir os 12 meses
            # (mês sem solicitação da distribuidora é zero registrado)
            ok_m = m1 == 12 and a <= ano_ref
            ok_o = len(meses_ouv_ano.get(a, ())) == 12 and a <= ano_ref
            atendimento_csv.append([c14, sigla(c14), a, ucs, ia, ci.get("amostra", {}).get(f"{a:04d}"),
                                    ci.get("ordem", {}).get(f"{a:04d}"), r1, r2, r1i,
                                    por_mil(r1, ucs) if ok_m else None, por_mil(r2, ucs) if ok_m else None,
                                    por_mil(r1i, ucs) if ok_m else None, m1, ro, rop,
                                    por_mil(ro, ucs, 1e5) if ok_o else None, por_mil(rop, ucs, 1e5) if ok_o else None, mo,
                                    tmae, oc, ma])

    # ---------------- eventos em situação de emergência ----------------
    evs = []
    for ch, campos in base.registros_como_estavam_em(con, DS_EVENTO).items():
        if not ch.startswith("evento:"):
            continue
        ini, fim = campos.get("inicio"), campos.get("fim")
        dur, motivo_dur = fq.duracao_evento_h(ini, fim, campos.get("gerado_em"))
        chi_e, chi_l = fq._num(campos.get("chi_evento")), fq._num(campos.get("chi_limite"))
        evs.append({"codigo": ch.split(":", 1)[1], "cnpj": campos.get("cnpj"), "sigla": sigla(campos.get("cnpj")),
                    "inicio": ini, "fim": fim, "duracao_h": dur, "duracao_ausente_motivo": motivo_dur,
                    "chi_evento": chi_e, "chi_limite": chi_l,
                    "razao_chi": (chi_e / chi_l) if chi_e is not None and chi_l else None,
                    "plano_contingencia": campos.get("plano_contingencia"),
                    "nivel_contingencia": fq._int(campos.get("nivel_contingencia")), "origem": campos.get("origem"),
                    "ano": fq._int(campos.get("ano")), "mes": fq._int(campos.get("mes"))})
    evs.sort(key=lambda e: (e["inicio"] or "", e["codigo"]))

    # ---------------- mapa: conjunto × município ----------------
    mun_regs = base.registros_como_estavam_em(con, DS_MUN)
    mun_conj = {}
    conj_mun = collections.defaultdict(set)
    mun_nome = {}
    for ch, campos in mun_regs.items():
        if ch.startswith("mun:") and campos.get("conjuntos"):
            cod = ch.split(":")[1]
            cs = {int(x) for x in campos["conjuntos"].split()}
            mun_conj[cod] = cs
            mun_nome[cod] = (campos.get("nome"), campos.get("uf"))
            for cj in cs:
                conj_mun[cj].add(cod)
    # A base IndQual Município não tem vigência: acumula a relação de todos os conjuntos que
    # já existiram (IDs desde a década de 2000, redefinidos ao longo do tempo). Para o mapa
    # do ano de referência valem só os conjuntos com DEC publicado naquele ano; a relação
    # (exclusivo, compartilhado, vários) é classificada com esses conjuntos ativos.
    ativos = {cj for (cj, a), vv in conj_ano.items() if a == ano_ref and vv["meses"] > 0}
    conj_mun_ativos = {cj: ms for cj, ms in conj_mun.items() if cj in ativos}
    val_conj = {x["conjunto"]: x for x in linhas_conj}
    mun_csv = []
    contagem_classe = collections.Counter()
    mun_com_valor = 0
    for cod in sorted(mun_conj):
        cs_hist = mun_conj[cod]
        cs = cs_hist & ativos
        classe = classe_relacao(cs, conj_mun_ativos) if cs else "sem_conjunto_ativo"
        contagem_classe[classe] += 1
        vs_ = [val_conj[cj] for cj in cs if cj in val_conj]
        dmin = min((x["dec"] for x in vs_), default=None)
        dmax = max((x["dec"] for x in vs_), default=None)
        fmin = min((x["fec"] for x in vs_ if x["fec"] is not None), default=None)
        fmax = max((x["fec"] for x in vs_ if x["fec"] is not None), default=None)
        if vs_:
            mun_com_valor += 1
        mun_csv.append([cod, mun_nome[cod][0], mun_nome[cod][1], " ".join(str(x) for x in sorted(cs)), len(cs), classe,
                        len(vs_), dmin, dmax, fmin, fmax,
                        " ".join(sorted({x["cnpj"] for x in vs_ if x["cnpj"]})), len(cs_hist)])

    # ---------------- reconciliação com o DGC publicado ----------------
    rank_regs = base.registros_como_estavam_em(con, DS_RANK)
    recon = []
    serie_dist = {c14: {x["ano"]: x for x in dd["serie"]} for c14, dd in dist.items()}
    for ch, campos in rank_regs.items():
        if not ch.startswith("rank:"):
            continue
        _, ano, porte, empresa = ch.split(":", 3)
        ano = int(ano)
        pub = fq._num(campos.get("dgc_texto")) if re.match(r"^\d", campos.get("dgc_texto") or "") else None
        c14 = campos.get("cnpj")
        calc = serie_dist.get(c14, {}).get(ano, {}).get("dgc") if c14 else None
        recon.append({"ano": ano, "porte": porte, "posicao": fq._int(campos.get("posicao")),
                      "sigla_ranking": campos.get("sigla"), "empresa": empresa, "cnpj": c14,
                      "dgc_publicado": pub, "dgc_calculado": calc,
                      "diferenca": (round(calc, 2) - pub) if (calc is not None and pub is not None) else None})
    recon.sort(key=lambda x: (x["ano"], x["porte"], x["posicao"] or 999))

    # ---------------- CSVs ----------------
    base.escreve_csv("qualidade_distribuidoras_anual.csv",
                     ["cnpj", "sigla", "ano", "meses", "dec_h", "fec_interrupcoes", "dec_limite_h", "fec_limite_interrupcoes",
                      "cobertura_limite", "razao_dec", "razao_fec", "dgc_calculado", "dec_todas_parcelas_h",
                      "fec_todas_parcelas", "dec_emergencia_h", "dec_dia_critico_h", "dec_externa_h", "dec_ons_h",
                      "fec_emergencia", "fec_dia_critico", "fec_externa", "fec_ons", "ucs_media", "conjuntos"],
                     sorted(serie_csv_anual, key=lambda x: (x[0], x[2])))
    base.escreve_csv("qualidade_distribuidoras_mensal.csv",
                     ["cnpj", "sigla", "mes", "dec_h", "fec_interrupcoes", "ucs", "ucs_total", "conjuntos", "cobertura"],
                     sorted(serie_csv_mensal, key=lambda x: (x[0], x[2])))
    br_csv = [[x["ano"], "anual", x["dec"], x["fec"], x["dec_limite"], x["fec_limite"], x["ucs_media"], x["conjuntos"],
               1 if x["completo"] else 0] for x in brasil_anual]
    br_csv += [[r, "mensal", br_m["dec"].get(r), br_m["fec"].get(r), None, None, br_m["ucs"].get(r),
                int(br_m["nconj"].get(r) or 0), 1 if completos[r] else 0] for r in refs]
    base.escreve_csv("qualidade_brasil.csv", ["periodo", "tipo", "dec_h", "fec_interrupcoes", "dec_limite_h",
                                              "fec_limite_interrupcoes", "ucs", "conjuntos", "completo"], br_csv)
    conj_csv = []
    for (cj, a), v in sorted(conj_ano.items(), key=lambda kv: (kv[0][0], kv[0][1])):
        ld, lf = limites.get((cj, a, "DEC")), limites.get((cj, a, "FEC"))
        completo = v["meses"] == 12
        conj_csv.append([cj, cadastro.get(cj, {}).get("nome"), v["cnpj"], sigla(v["cnpj"]), a, v["meses"], v["dec"],
                         v["fec"], ld, lf, razao(v["dec"], ld) if completo else None,
                         razao(v["fec"], lf) if v["meses_fec"] == 12 else None, v["ucs_media"]])
    base.escreve_csv("qualidade_conjuntos_anual.csv",
                     ["conjunto", "nome", "cnpj", "sigla", "ano", "meses", "dec_h", "fec_interrupcoes", "dec_limite_h",
                      "fec_limite_interrupcoes", "razao_dec", "razao_fec", "ucs_media"], conj_csv)
    conj_m_csv = []
    for chave, campos in c_obs.items():
        cj = int(chave[1:])
        for r in sorted(campos.get("m.dec", {})):
            conj_m_csv.append([cj, cadastro.get(cj, {}).get("cnpj"), r, campos["m.dec"].get(r),
                               campos.get("m.fec", {}).get(r), campos.get("m.ucs", {}).get(r)])
    conj_m_csv.sort(key=lambda x: (x[0], x[2]))
    base.escreve_csv("qualidade_conjuntos_mensal.csv", ["conjunto", "cnpj", "mes", "dec_h", "fec_interrupcoes", "ucs"], conj_m_csv)
    comp_rows = collections.defaultdict(lambda: [None, None])
    for c14, ref, tipo, unid, medida, v in comp_csv:
        comp_rows[(c14, ref, tipo, unid)][0 if medida == "valor" else 1] = v
    base.escreve_csv("qualidade_compensacoes.csv", ["cnpj", "sigla", "competencia", "tipo", "unidade", "valor_rs", "quantidade"],
                     [[k[0], sigla(k[0]), k[1], k[2], k[3], v[0], v[1]] for k, v in sorted(comp_rows.items())])
    base.escreve_csv("qualidade_atendimento.csv",
                     ["cnpj", "sigla", "ano", "ucs_media", "iasc", "iasc_amostra", "iasc_ordem",
                      "reclamacoes_distribuidora_n1", "reclamacoes_distribuidora_n2", "reclamacoes_interrupcao_n1",
                      "reclamacoes_n1_por_mil_uc", "reclamacoes_n2_por_mil_uc", "reclamacoes_interrupcao_n1_por_mil_uc",
                      "meses_manifestacoes", "reclamacoes_ouvidoria_aneel", "reclamacoes_ouvidoria_aneel_procedentes",
                      "ouvidoria_aneel_por_100mil_uc", "ouvidoria_aneel_procedentes_por_100mil_uc", "meses_ouvidoria",
                      "tmae_min", "ocorrencias_emergenciais", "meses_atendimento"], atendimento_csv)
    base.escreve_csv("qualidade_municipios.csv",
                     ["cod_ibge", "municipio", "uf", "conjuntos", "n_conjuntos", "relacao", "conjuntos_com_valor",
                      "dec_min_h", "dec_max_h", "fec_min", "fec_max", "cnpjs", "conjuntos_historicos"], mun_csv)
    base.escreve_csv("qualidade_eventos_emergencia.csv",
                     ["cnpj", "sigla", "codigo", "inicio", "fim", "duracao_h", "duracao_ausente_motivo", "chi_evento",
                      "chi_limite", "razao_chi", "plano_contingencia", "nivel", "origem"],
                     [[e["cnpj"], e["sigla"], e["codigo"], e["inicio"], e["fim"], e["duracao_h"], e["duracao_ausente_motivo"],
                       e["chi_evento"], e["chi_limite"], e["razao_chi"], e["plano_contingencia"], e["nivel_contingencia"],
                       e["origem"]] for e in evs])
    base.escreve_csv("qualidade_reconciliacao_dgc.csv",
                     ["ano", "porte", "posicao", "sigla_ranking", "empresa", "cnpj", "dgc_publicado", "dgc_calculado", "diferenca"],
                     [[x["ano"], x["porte"], x["posicao"], x["sigla_ranking"], x["empresa"], x["cnpj"], x["dgc_publicado"],
                       x["dgc_calculado"], x["diferenca"]] for x in recon])

    calc = {
        "snap": snap, "ano_ref": ano_ref, "anos": anos, "anos_completos": anos_completos, "ultimo_mes": ultimo_mes,
        "completos": completos,
        "parcial": parcial, "brasil_anual": brasil_anual, "brasil_mensal": brasil_mensal, "br": br,
        "dist": dist, "sigla": sigla, "nome_comercial": nome_comercial, "classificacao": classificacao,
        "linhas_conj": linhas_conj, "conj_hist": conj_hist, "cauda_razao": cauda_razao, "cauda_dec": cauda_dec,
        "hist": hist, "quantis": quantis, "conj_publico": conj_publico, "acima_dec": acima_dec, "acima_fec": acima_fec,
        "acima_algum": acima_algum, "ucs_lim": ucs_lim, "ucs_acima": ucs_acima, "decs": decs, "fecs": fecs, "rz": rz,
        "rzf": rzf, "comp_anual": comp_anual, "comp_mensal": comp_mensal, "comp_dist": comp_dist,
        "comp_ultimo_completo": comp_ultimo_completo, "comp_ano_ref": comp_ano_ref, "tipos": tipos,
        "atendimento_csv": atendimento_csv, "anos_manif": anos_manif, "anos_ouv": anos_ouv, "iasc": iasc,
        "iasc_anos": iasc_anos, "evs": evs, "contagem_classe": contagem_classe, "mun_conj": mun_conj,
        "mun_com_valor": mun_com_valor, "conj_mun": conj_mun, "recon": recon, "ucs_ano": ucs_ano,
        "atend": atend, "mun_csv": mun_csv, "tmae_br": tmae_br, "meses_ouv_ano": meses_ouv_ano,
    }
    gold = montar_gold(con, ctx, calc)
    # o mapa municipal vai para public/energia/series/ (lido no cliente sob demanda, seção
    # 5.1 do contrato): a gold principal fica leve e a página só baixa o mapa ao abri-lo
    mapa_mun = gold.pop("_mapa_municipal")
    base._escreve_atomico(os.path.join(base.SERIES, "qualidade_mapa.json"),
                          json.dumps({**c.cabecalho("qualidade_mapa.json"), **mapa_mun}, ensure_ascii=False,
                                     separators=(",", ":"), allow_nan=False))
    return gold


def _fonte(meta, pacote, titulo, recursos_nomes):
    urls = {r.get("nome"): r.get("url") for r in (meta.get("recursos") or [])}
    primaria = next((urls[n] for n in recursos_nomes if urls.get(n)), _url(pacote))
    return {"orgao": "ANEEL", "dataset": titulo, "recurso": "; ".join(recursos_nomes), "url_dataset": _url(pacote),
            "url_primaria": primaria, "licenca": meta.get("licenca") or LICENCA}


R_CONT = ["indicadores-continuidade-coletivos-2010-2019.parquet", "indicadores-continuidade-coletivos-2020-2029.parquet"]
R_LIM = ["indicadores-continuidade-coletivos-limite"]
R_COMP = ["indicadores-continuidade-coletivos-compensacao-2010-2019.parquet",
          "indicadores-continuidade-coletivos-compensacao-2020-2029.parquet"]


def _controles(con):
    """Resultado da importação de cada arquivo vigente (linhas lidas, conflitos de chave,
    siglas fora do padrão, observações novas e revisões), para o modo Auditar."""
    _tabela_importacoes(con)
    out = []
    for ds in (DS_CONT, DS_IASC, DS_MANIF, DS_OUV, DS_ATEND, DS_EVENTO, DS_MUN, DS_RANK):
        for rec, vint in sorted(ckan.vintages_vigentes(con, ds).items()):
            row = con.execute("SELECT versao, importado_em, detalhe FROM importacoes WHERE vintage_id=? ORDER BY importado_em DESC LIMIT 1",
                              (vint["vintage_id"],)).fetchone()
            if rec.startswith("dic-") or rec in ("dominio", "decretos"):
                continue
            det = None
            if row:
                try:
                    det = json.loads(row[2])
                except ValueError:
                    det = {"texto": row[2]}
            out.append({"dataset": ds, "recurso": rec, "sha256": vint["sha256"], "capturado_em": vint["capturado_em"],
                        "publicado_em": vint["publicado_em"], "importado_em": row[1] if row else None,
                        "versao_importacao": row[0] if row else None, "detalhe": det})
    return out


def montar_gold(con, ctx, v):
    ano_ref, sigla, snap = v["ano_ref"], v["sigla"], v["snap"]
    meta = ckan.meta_local(DS_CONT)
    cap = c.ultima_captura(snap)
    fonte_cont = _fonte(meta, PAC_CONT, "Indicadores Coletivos de Continuidade (DEC e FEC)", R_CONT)
    fonte_lim = _fonte(meta, PAC_CONT, "Indicadores Coletivos de Continuidade (DEC e FEC)", R_LIM)
    fonte_comp = _fonte(meta, PAC_CONT, "Indicadores Coletivos de Continuidade (DEC e FEC): compensações", R_COMP)
    br_anual = v["brasil_anual"]
    br_ref = next(x for x in br_anual if x["ano"] == ano_ref)
    anos_ok = [x["ano"] for x in br_anual if x["completo"]]
    periodo_hist = {"inicio": f"{min(anos_ok)}-01", "fim": v["ultimo_mes"]}

    # ---------- atendimento por distribuidora e ano (linhas do CSV) ----------
    at = {}
    for row in v["atendimento_csv"]:
        at[(row[0], row[2])] = row
    eventos_por_dist = collections.Counter(e["cnpj"] for e in v["evs"])
    iasc_regs = base.registros_como_estavam_em(con, DS_IASC)

    # ---------- distribuidoras ----------
    distribuidoras = []
    for c14, dd in v["dist"].items():
        s = {x["ano"]: x for x in dd["serie"]}
        x = s.get(ano_ref)
        if not x or x["meses"] == 0:
            continue
        cd = v["comp_dist"].get(c14, {}).get(v["comp_ano_ref"], {})
        ucs = x["ucs_media"]
        ia = v["iasc"].get("d" + c14, {})
        ia_ano = max((int(r) for r in ia.get("iasc", {})), default=None)
        rk = next((r for r in v["recon"] if r["cnpj"] == c14 and r["ano"] == ano_ref), None)
        a_ref = at.get((c14, ano_ref))
        pd, pf = x["parcelas_dec"], x["parcelas_fec"]
        tot_d = x["dec_todas_parcelas"]
        serie_ok = [y for y in dd["serie"] if y["dec"] is not None and y["ano"] > ano_ref - ANOS_SERIE_GOLD]
        distribuidoras.append({
            "cnpj": c14, "sigla": sigla(c14), "nome_comercial": v["nome_comercial"].get(c14),
            "classificacao": v["classificacao"].get(c14) or None, "ano": ano_ref, "meses": x["meses"],
            "ucs": _r(ucs, 0), "conjuntos": x["conjuntos"],
            "dec": _r(x["dec"]), "fec": _r(x["fec"]), "dec_limite": _r(x["dec_limite"]), "fec_limite": _r(x["fec_limite"]),
            "cobertura_limite": _r(x["cobertura_limite"], 4), "razao_dec": _r(x["razao_dec"], 3),
            "razao_fec": _r(x["razao_fec"], 3), "dgc_calculado": _r(x["dgc"], 3),
            "dgc_publicado": rk["dgc_publicado"] if rk else None, "posicao_ranking": rk["posicao"] if rk else None,
            "porte_ranking": rk["porte"] if rk else None,
            "dec_todas_parcelas": _r(tot_d), "fec_todas_parcelas": _r(x["fec_todas_parcelas"]),
            "pct_dec_expurgado": _r(100 * (tot_d - x["dec"]) / tot_d, 1) if tot_d and x["dec"] is not None else None,
            "parcelas_dec": {g: _r(val) for g, val in pd.items()}, "parcelas_fec": {g: _r(val) for g, val in pf.items()},
            "cobertura_min": _r(x["cobertura_min"], 4),
            "compensacao": ({"ano": v["comp_ano_ref"], "valor": _r(cd.get("valor"), 2), "quantidade": _r(cd.get("quantidade"), 0),
                             "valor_por_uc": _r(por_mil(cd.get("valor"), ucs, 1.0), 2),
                             "valor_por_tipo": {t: _r(cd.get(f"valor.{t}"), 2) for t in v["tipos"] if cd.get(f"valor.{t}") is not None}}
                            if cd else None),
            "iasc": ({"ano": ia_ano, "valor": _r(ia.get("iasc", {}).get(f"{ia_ano:04d}"), 2),
                      "amostra": _r(ia.get("amostra", {}).get(f"{ia_ano:04d}"), 0),
                      "ordem": _r(ia.get("ordem", {}).get(f"{ia_ano:04d}"), 0),
                      "categoria": (iasc_regs.get(f"iasc:{ia_ano}:{c14}") or {}).get("categoria")} if ia_ano else None),
            "reclamacoes": ({"ano": ano_ref, "n1": _r(a_ref[7], 0), "n2": _r(a_ref[8], 0), "interrupcao_n1": _r(a_ref[9], 0),
                             "n1_por_mil_uc": _r(a_ref[10], 2), "n2_por_mil_uc": _r(a_ref[11], 3),
                             "interrupcao_n1_por_mil_uc": _r(a_ref[12], 2), "meses": a_ref[13],
                             "ouvidoria_aneel": _r(a_ref[14], 0), "ouvidoria_aneel_procedentes": _r(a_ref[15], 0),
                             "ouvidoria_aneel_por_100mil_uc": _r(a_ref[16], 2), "meses_ouvidoria": a_ref[18]}
                            if a_ref and (a_ref[7] is not None or a_ref[14] is not None) else None),
            "tmae_min": _r(a_ref[19], 1) if a_ref else None,
            "eventos_emergencia_2026": eventos_por_dist.get(c14, 0) if v["evs"] else None,
            # série publicada na gold: últimos ANOS_SERIE_GOLD anos completos (a história inteira,
            # desde 2010, está em qualidade_distribuidoras_anual.csv)
            "serie": {"anos": [y["ano"] for y in serie_ok], "dec": [_r(y["dec"]) for y in serie_ok],
                      "fec": [_r(y["fec"]) for y in serie_ok], "dec_limite": [_r(y["dec_limite"]) for y in serie_ok],
                      "fec_limite": [_r(y["fec_limite"]) for y in serie_ok]},
        })
    distribuidoras.sort(key=lambda d: -(d["ucs"] or 0))

    # ---------- conjuntos (P052) ----------
    lc = v["linhas_conj"]
    faixas_lim = [(0, 5), (5, 10), (10, 15), (15, 20), (20, 30), (30, 50), (50, None)]
    faixas_rz = [(0, 0.5), (0.5, 1.0), (1.0, 1.5), (1.5, None)]
    matriz = []
    for lo, hi in faixas_lim:
        linha = {"limite_de": lo, "limite_ate": hi}
        for rlo, rhi in faixas_rz:
            linha[f"razao_{rlo}_{rhi if rhi is not None else 'mais'}"] = sum(
                1 for x in lc if x["dec_limite"] is not None and x["razao_dec"] is not None
                and x["dec_limite"] > lo and (hi is None or x["dec_limite"] <= hi)
                and x["razao_dec"] > rlo and (rhi is None or x["razao_dec"] <= rhi))
        matriz.append(linha)
    conjuntos = {
        "ano": ano_ref, "total": len(lc), "com_limite": len(v["rz"]),
        "acima_limite_dec": len(v["acima_dec"]), "acima_limite_fec": len(v["acima_fec"]),
        "acima_algum_limite": len(v["acima_algum"]),
        "pct_acima_limite_dec": _r(100 * len(v["acima_dec"]) / len(v["rz"]), 1) if v["rz"] else None,
        "ucs_com_limite": _r(v["ucs_lim"], 0), "ucs_acima_limite_dec": _r(v["ucs_acima"], 0),
        "pct_ucs_acima_limite_dec": _r(100 * v["ucs_acima"] / v["ucs_lim"], 1) if v["ucs_lim"] else None,
        "quantis_dec": v["quantis"](v["decs"]), "quantis_fec": v["quantis"](v["fecs"]),
        "quantis_razao_dec": v["quantis"](v["rz"], 3), "quantis_razao_fec": v["quantis"](v["rzf"], 3),
        "histograma_razao_dec": v["hist"](v["rz"]), "histograma_razao_fec": v["hist"](v["rzf"]),
        "matriz_limite_razao_dec": matriz,
        "cauda_razao_dec": [v["conj_publico"](x) for x in v["cauda_razao"]],
        "cauda_dec": [v["conj_publico"](x) for x in v["cauda_dec"]],
        "historico": v["conj_hist"],
    }

    # ---------- compensações (P053) ----------
    ca, cm = v["comp_anual"], v["comp_mensal"]
    ult_c = v["comp_ultimo_completo"]
    comp_anual = []
    for a in sorted(ca):
        s_ = ca[a]
        completo = bool(ult_c) and f"{a:04d}-12" <= ult_c
        por_tipo = {}
        for t in v["tipos"]:
            vv = s_.get(f"valor.uc.{t}", 0) + s_.get(f"valor.ug.{t}", 0)
            qq = s_.get(f"quantidade.uc.{t}", 0) + s_.get(f"quantidade.ug.{t}", 0)
            if any(f"{m}.{u}.{t}" in s_ for m in ("valor", "quantidade") for u in ("uc", "ug")):
                por_tipo[t] = {"valor": _r(vv, 2), "quantidade": _r(qq, 0)}
        ucs_br = next((x["ucs_media"] for x in br_anual if x["ano"] == a), None)
        comp_anual.append({"ano": a, "completo": completo, "valor": _r(s_.get("valor"), 2),
                           "quantidade": _r(s_.get("quantidade"), 0),
                           # unidades geradoras só aparecem na fonte a partir de certo ano: sem linha, ausência
                           "valor_ug": (_r(sum(s_.get(f"valor.ug.{t}", 0) for t in v["tipos"]), 2)
                                        if any(f"valor.ug.{t}" in s_ for t in v["tipos"]) else None),
                           "valor_por_uc": _r(por_mil(s_.get("valor"), ucs_br, 1.0), 2) if completo else None,
                           "por_tipo": por_tipo})
    comp_meses = sorted(cm)[-MESES_SERIE:]
    comp_mensal = [{"m": r, "valor": _r(cm[r].get("valor"), 2), "quantidade": _r(cm[r].get("quantidade"), 0),
                    "completo": bool(ult_c) and r <= ult_c} for r in comp_meses]
    ref_comp = next((x for x in comp_anual if x["ano"] == v["comp_ano_ref"]), None)
    tops = sorted(((d["compensacao"]["valor"] or 0, d["cnpj"]) for d in distribuidoras if d["compensacao"]), reverse=True)
    tot_ref = (ref_comp or {}).get("valor") or 0
    compensacoes = {
        "ano_referencia": v["comp_ano_ref"], "ultimo_mes_completo": ult_c, "anual": comp_anual, "mensal": comp_mensal,
        "concentracao_5_maiores_pct": _r(100 * sum(x[0] for x in tops[:5]) / tot_ref, 1) if tot_ref else None,
        "rotulos_tipo": fq.ROTULO_TIPO_COMP,
    }

    # ---------- atendimento e resiliência (P054) ----------
    ucs_todas = collections.defaultdict(float)   # UCs médias de todas as distribuidoras com continuidade no ano
    for (c14, a), u in v["ucs_ano"].items():
        if u:
            ucs_todas[a] += u

    def nacional_bruto(ano, i_num, i_meses, registro=False):
        """Numerador e denominador do mesmo conjunto de distribuidoras: só entra quem tem a
        contagem E as UCs médias do ano (taxa agregada = Σ numeradores ÷ Σ denominadores).
        Manifestações (registro=False): só distribuidoras com os 12 meses enviados; mês não
        enviado é ausência. Ouvidoria ANEEL (registro=True): o arquivo precisa cobrir os 12
        meses; distribuidora sem nenhuma solicitação no ano fica fora (pode ser zero ou CNPJ
        não vinculado, e ausência não vira zero), com a cobertura em UCs publicada."""
        completo_ano = ano <= ano_ref and (len(v["meses_ouv_ano"].get(ano, ())) == 12 if registro else True)
        rows, fora = [], []
        for (c14, a), r in at.items():
            if a != ano or r[i_num] is None or not r[3]:
                continue
            (rows if (registro or r[i_meses] == 12) else fora).append((c14, r))
        den = sum(r[3] for _, r in rows)
        return {"num": sum(r[i_num] for _, r in rows), "den": den, "n": len(rows),
                "cnpjs": sorted(c14 for c14, _ in rows), "completo": completo_ano and bool(rows),
                # em ano corrente todas estão incompletas: a lista só informa algo em ano fechado
                "fora_meses_incompletos": ([{"cnpj": c14, "sigla": sigla(c14), "meses": r[i_meses]} for c14, r in sorted(fora)]
                                           if ano <= ano_ref else []),
                "n_fora": len(fora),
                "cobertura_ucs": den / ucs_todas[ano] if ucs_todas.get(ano) else None,
                "meses_min": min((r[i_meses] for _, r in rows), default=None),
                "meses_max": max((r[i_meses] for _, r in rows), default=None)}

    def nacional(ano, i_num, fator, i_meses, registro=False):
        b = nacional_bruto(ano, i_num, i_meses, registro)
        return {"ano": ano, "completo": b["completo"], "distribuidoras": b["n"], "total": _r(b["num"], 0),
                "ucs": _r(b["den"], 0), "cobertura_ucs": _r(b["cobertura_ucs"], 4),
                # taxa só em ano completo: ano corrente parcial não é comparado com ano cheio
                "por_ucs": _r(fator * b["num"] / b["den"], 3) if b["den"] and b["completo"] else None,
                "meses_min": b["meses_min"], "meses_max": b["meses_max"],
                "distribuidoras_sem_12_meses": b["n_fora"], "fora_meses_incompletos": b["fora_meses_incompletos"]}
    ano_ultimo_iasc = max(v["iasc_anos"]) if v["iasc_anos"] else None
    iasc_lista = []
    for (c14, a), r in at.items():
        if a == ano_ultimo_iasc and r[4] is not None:
            reg = iasc_regs.get(f"iasc:{a}:{c14}") or {}
            iasc_lista.append({"cnpj": c14, "sigla": sigla(c14) or reg.get("sigla"), "nome_iasc": reg.get("sigla"),
                               "iasc": _r(r[4], 2), "amostra": _r(r[5], 0), "ordem": _r(r[6], 0),
                               "categoria": reg.get("categoria"), "classificacao": reg.get("classificacao")})
    iasc_lista.sort(key=lambda x: -(x["iasc"] or 0))
    # TMAE nacional: mesma ponderação da distribuidora (ocorrências com os três tempos)
    tmae_anos = [{"ano": a, "distribuidoras": n, "ocorrencias": _r(w, 0), "tmae_min": _r(num / w, 1) if w else None}
                 for a, (num, w, n) in sorted(v["tmae_br"].items())]
    evs = v["evs"]
    duracoes = [e["duracao_h"] for e in evs if e["duracao_h"] is not None]
    atendimento = {
        # o IASC de cada distribuidora está em distribuidoras[].iasc (e no CSV de atendimento);
        # aqui ficam o resumo nacional e as pesquisadas sem indicadores de continuidade no ano
        "iasc": {"ano": ano_ultimo_iasc, "distribuidoras": len(iasc_lista),
                 "entrevistas": _r(sum(x["amostra"] or 0 for x in iasc_lista), 0),
                 "quantis": v["quantis"]([x["iasc"] for x in iasc_lista]),
                 "sem_continuidade_no_ano": [x for x in iasc_lista if x["cnpj"] not in {d["cnpj"] for d in distribuidoras}],
                 "anos_disponiveis": v["iasc_anos"]},
        "reclamacoes_distribuidora": [nacional(a, 7, 1000, 13) | {"interrupcao": nacional(a, 9, 1000, 13)["total"],
                                                                  "interrupcao_por_mil_uc": nacional(a, 9, 1000, 13)["por_ucs"],
                                                                  "n2": nacional(a, 8, 1000, 13)["total"],
                                                                  "n2_por_mil_uc": nacional(a, 8, 1000, 13)["por_ucs"]}
                                      for a in v["anos_manif"]],
        "ouvidoria_aneel": [nacional(a, 14, 1e5, 18, True) | {"procedentes": nacional(a, 15, 1e5, 18, True)["total"],
                                                               "procedentes_por_100mil_uc": nacional(a, 15, 1e5, 18, True)["por_ucs"]}
                            for a in v["anos_ouv"]],
        "tmae": tmae_anos,
        "eventos_emergencia": {
            "total": len(evs), "distribuidoras": len({e["cnpj"] for e in evs}),
            "inicio_min": min((e["inicio"] for e in evs if e["inicio"]), default=None),
            "inicio_max": max((e["inicio"] for e in evs if e["inicio"]), default=None),
            "duracao_mediana_h": _r(c.quantil(duracoes, 0.5), 1), "duracao_max_h": _r(max(duracoes), 1) if duracoes else None,
            # datas implausíveis publicadas pela fonte: duração ausente, evento mantido e listado
            "datas_invalidas": [{"codigo": e["codigo"], "sigla": e["sigla"], "inicio": e["inicio"], "fim": e["fim"],
                                 "motivo": e["duracao_ausente_motivo"]} for e in evs if e["duracao_ausente_motivo"]],
            "maiores_chi": [{"codigo": e["codigo"], "cnpj": e["cnpj"], "sigla": e["sigla"], "inicio": e["inicio"],
                             "fim": e["fim"], "duracao_h": _r(e["duracao_h"], 1), "chi_evento": _r(e["chi_evento"], 0),
                             "chi_limite": _r(e["chi_limite"], 0), "razao_chi": _r(e["razao_chi"], 2), "origem": e["origem"]}
                            for e in sorted(evs, key=lambda e: -(e["chi_evento"] or 0))[:15]],
        },
        "resiliencia_parcelas": [{"ano": x["ano"], "dec_emergencia": (x["parcelas_dec"] or {}).get("emergencia"),
                                  "dec_dia_critico": (x["parcelas_dec"] or {}).get("dia_critico"),
                                  "dec_todas_parcelas": x["dec_todas_parcelas"], "dec_apurado": x["dec"]}
                                 for x in br_anual if x["completo"]],
    }

    # ---------- mapa (resumo; detalhe em /energia/series/qualidade_mapa.json e CSV) ----------
    mapa = {"ano": ano_ref, "municipios_com_relacao": len(v["mun_conj"]), "municipios_com_valor": v["mun_com_valor"],
            "por_relacao": dict(v["contagem_classe"]), "arquivo": "/energia/series/qualidade_mapa.json",
            "regra": ("Cada município recebe os valores anuais dos conjuntos que o atendem segundo a base IndQual Município. "
                      "O valor é do conjunto inteiro: quando o conjunto cobre vários municípios ou o município é atendido por "
                      "vários conjuntos, o mapa mostra o intervalo dos conjuntos, nunca um DEC medido no município.")}

    # ---------- reconciliação com o DGC publicado ----------
    rec_anos = []
    for a in sorted({x["ano"] for x in v["recon"]}):
        rs = [x for x in v["recon"] if x["ano"] == a]
        comp = [x for x in rs if x["diferenca"] is not None]
        iguais = [x for x in comp if abs(x["diferenca"]) <= 0.0100001]
        rec_anos.append({"ano": a, "publicados": len(rs), "com_dgc": sum(1 for x in rs if x["dgc_publicado"] is not None),
                         "sem_cnpj": [x["empresa"] for x in rs if not x["cnpj"]], "comparados": len(comp),
                         "ate_1_centesimo": len(iguais), "exatos_2_casas": sum(1 for x in comp if abs(x["diferenca"]) < 1e-9),
                         "maior_diferenca": _r(max((abs(x["diferenca"]) for x in comp), default=None), 2),
                         "divergentes": [{k: x[k] for k in ("empresa", "sigla_ranking", "cnpj", "dgc_publicado")} |
                                         {"dgc_calculado": _r(x["dgc_calculado"], 3), "diferenca": _r(x["diferenca"], 2)}
                                         for x in comp if abs(x["diferenca"]) > 0.0100001]})
    ident = []
    br_ident = {k[6:]: vv for k, vv in v["br"].items() if k.startswith("ident.")}
    for a in sorted(br_ident.get("dec_n", {}), key=int):
        dn, do_ = br_ident["dec_n"][a], br_ident.get("dec_ok", {}).get(a, 0)
        fn, fo = br_ident.get("fec_n", {}).get(a), br_ident.get("fec_ok", {}).get(a, 0)
        ident.append({"ano": int(a), "conjunto_meses": int(dn), "pct_dec_igual_ip_mais_ind": _r(100 * do_ / dn, 2) if dn else None,
                      "pct_fec_igual_ip_mais_ind": _r(100 * fo / fn, 2) if fn else None})

    # ---------- proveniência ----------
    lim_comum = [
        "DEC em horas e centésimos de hora; FEC em número de interrupções e centésimos. 1,50 h é uma hora e meia.",
        "O DEC é uma média por unidade consumidora: não descreve o tempo sem energia de cada pessoa; parte das UCs fica muito acima e parte muito abaixo da média.",
        "Interrupções de até 3 minutos não entram no DEC e no FEC; as expurgadas (situação de emergência, dia crítico, origem externa, ONS) ficam fora do apurado e aparecem nas parcelas.",
        "Os valores são apurados e enviados pelas próprias distribuidoras à ANEEL; a fonte pode revisar meses já publicados.",
    ]
    snap_iasc, snap_manif, snap_ouv = c.snapshot_de(con, DS_IASC), c.snapshot_de(con, DS_MANIF), c.snapshot_de(con, DS_OUV)
    snap_atend, snap_ev, snap_mun, snap_rank = (c.snapshot_de(con, DS_ATEND), c.snapshot_de(con, DS_EVENTO),
                                                c.snapshot_de(con, DS_MUN), c.snapshot_de(con, DS_RANK))
    meta_iasc, meta_manif, meta_ouv = ckan.meta_local(DS_IASC), ckan.meta_local(DS_MANIF), ckan.meta_local(DS_OUV)
    meta_atend, meta_ev, meta_mun = ckan.meta_local(DS_ATEND), ckan.meta_local(DS_EVENTO), ckan.meta_local(DS_MUN)
    meses_atend = sorted({r for ch in v["atend"].values() for r in ch.get("m.ocorr", {})})
    per_atend = {"inicio": meses_atend[0] if meses_atend else "", "fim": meses_atend[-1] if meses_atend else ""}
    prov = {
        "conjuntos": c.proveniencia(
            indicador="DEC e FEC mensais por conjunto de unidades consumidoras", natureza="OBSERVADO", fonte=fonte_cont,
            unidade="horas (DEC); interrupções (FEC)", frequencia="mensal", periodo=periodo_hist,
            cobertura={"inicio": f"{min(v['anos'])}-01", "fim": v["ultimo_mes"]}, capturado_em=cap, snapshot=snap,
            transformacoes=["soma dos 12 meses para o valor anual do conjunto (ano completo só com 12 meses)"],
            limitacoes=lim_comum, download="/energia/series/qualidade_conjuntos_anual.csv", notas_fonte=meta.get("notas")),
        "distribuidoras": c.proveniencia(
            indicador="DEC e FEC da distribuidora e do Brasil", natureza="CALCULADO", fonte=fonte_cont,
            unidade="horas (DEC); interrupções (FEC)", frequencia="mensal e anual", periodo=periodo_hist,
            cobertura={"inicio": f"{min(v['anos'])}-01", "fim": v["ultimo_mes"]}, capturado_em=cap, snapshot=snap,
            transformacoes=["média mensal dos conjuntos ponderada pelo número de unidades consumidoras do conjunto no mês",
                            "soma dos 12 meses para o valor anual", "chave da distribuidora: CNPJ de 14 dígitos publicado pela ANEEL"],
            formula="DEC(g, m) = Σ_c DEC(c, m) × UC(c, m) ÷ Σ_c UC(c, m); DEC(g, ano) = Σ_m DEC(g, m) (idem FEC)",
            limitacoes=lim_comum + ["Mês nacional publicado antes de todas as distribuidoras enviarem fica marcado como incompleto e não entra no ano."],
            download="/energia/series/qualidade_distribuidoras_anual.csv", notas_fonte=meta.get("notas")),
        "limites": c.proveniencia(
            indicador="Limites anuais de DEC e FEC e distância ao limite", natureza="CALCULADO", fonte=fonte_lim,
            unidade="horas, interrupções e razão apurado ÷ limite", frequencia="anual", periodo=periodo_hist,
            cobertura={"inicio": str(min(v['anos'])), "fim": str(ano_ref)}, capturado_em=cap, snapshot=snap,
            transformacoes=["limite do conjunto no mesmo ano de apuração (mesma vigência)",
                            "limite da distribuidora: média dos limites dos conjuntos ponderada pelas UCs médias do ano",
                            "DGC = média simples das razões DEC ÷ limite e FEC ÷ limite, como no ranking da ANEEL"],
            formula="L(g, ano) = Σ_c L(c, ano) × UCmédia(c, ano) ÷ Σ_c UCmédia(c, ano); razão = apurado ÷ L; DGC = (razão DEC + razão FEC) ÷ 2",
            limitacoes=["O limite vale para o ano civil e para o conjunto; comparar um mês com o limite anual não é possível.",
                        "Distribuidora sem limite definido para o ano (período de carência de contrato novo) fica sem razão e sem DGC.",
                        "A regra de ponderação do limite da distribuidora foi conferida contra o DGC publicado; as divergências estão listadas na reconciliação."],
            download="/energia/series/qualidade_reconciliacao_dgc.csv"),
        "compensacoes": c.proveniencia(
            indicador="Compensações pagas por violação dos limites individuais de continuidade", natureza="CALCULADO",
            fonte=fonte_comp, unidade="R$ nominais e ocorrências de compensação", frequencia="mensal (competência)",
            periodo={"inicio": f"{min(ca)}", "fim": ult_c or ""}, cobertura={"inicio": f"{min(ca)}", "fim": ult_c or ""},
            capturado_em=cap, snapshot=snap,
            transformacoes=["soma por distribuidora e competência dos valores publicados por conjunto",
                            "tipos separados: mensal, trimestral, anual, DICRI e DISE; unidades consumidoras e unidades geradoras"],
            formula="valor(g, competência) = Σ_c Σ_tensão valor pago(c, tensão, tipo, competência)",
            limitacoes=["A fonte informa a competência (período da violação), não a data do crédito na fatura.",
                        "Quantidade é número de ocorrências de compensação: a mesma unidade pode ser compensada em vários meses e tipos.",
                        "O crédito de cada consumidor depende do DIC, FIC, DMIC individual e do encargo de uso; não pode ser estimado a partir do DEC ou do FEC do conjunto.",
                        "Valores em reais correntes de cada competência, sem correção pela inflação."],
            download="/energia/series/qualidade_compensacoes.csv"),
        "iasc": c.proveniencia(
            indicador="Índice ANEEL de Satisfação do Consumidor (IASC)", natureza="ESTIMADO",
            fonte=_fonte(meta_iasc, PAC_IASC, "Índice ANEEL de Satisfação do Consumidor (IASC)", ["indice-aneel-satisfacao-consumidor"]),
            unidade="índice de 0 a 100", frequencia="anual", periodo={"inicio": str(min(v["iasc_anos"])), "fim": str(max(v["iasc_anos"]))},
            cobertura={"inicio": str(min(v["iasc_anos"])), "fim": str(max(v["iasc_anos"]))},
            capturado_em=c.ultima_captura(snap_iasc), snapshot=snap_iasc,
            transformacoes=["amostra por distribuidora = soma das contagens de entrevistados por sexo publicadas"],
            limitacoes=["Pesquisa amostral com consumidores residenciais: estimativa sujeita a erro amostral; a fonte não publica intervalo de confiança por distribuidora.",
                        "Distribuidoras são comparadas pela ANEEL dentro de categorias de porte e região."],
            download="/energia/series/qualidade_atendimento.csv", notas_fonte=meta_iasc.get("notas")),
        "reclamacoes": c.proveniencia(
            indicador="Reclamações no 1º e 2º nível da distribuidora por mil unidades consumidoras", natureza="CALCULADO",
            fonte=_fonte(meta_manif, PAC_MANIF, "Manifestações no 1° e 2° nível da Distribuidora",
                         [f"manifestacoes-1-2-niveis-distribuidora-{a}.parquet" for a in v["anos_manif"]]),
            unidade="reclamações por mil UCs no ano", frequencia="mensal, publicada por ano",
            periodo={"inicio": str(min(v["anos_manif"])) if v["anos_manif"] else "", "fim": str(max(v["anos_manif"])) if v["anos_manif"] else ""},
            cobertura={"inicio": str(ANO_INICIO_TIPOLOGIA), "fim": str(max(v["anos_manif"])) if v["anos_manif"] else ""},
            capturado_em=c.ultima_captura(snap_manif), snapshot=snap_manif,
            transformacoes=["reclamação = código de tipologia iniciado por 102 (REN 1.000/2021)",
                            "interrupção = códigos 1020901, 1020902 e 1020903",
                            "denominador = UCs médias da mesma distribuidora (CNPJ) no mesmo ano, dos indicadores de continuidade"],
            formula="taxa(g, ano) = 1.000 × Σ_meses reclamações recebidas(g) ÷ UCs médias(g, ano)",
            limitacoes=["O registro de manifestações depende dos canais e da prática de cada distribuidora; taxas diferentes podem refletir registro, não só serviço.",
                        "Ano corrente é parcial e não é comparado com anos completos.",
                        "A tipologia de 2010 a 2022 é diferente e não é somada a esta série."],
            download="/energia/series/qualidade_atendimento.csv", notas_fonte=meta_manif.get("notas")),
        "ouvidoria_aneel": c.proveniencia(
            indicador="Reclamações registradas na Ouvidoria Setorial da ANEEL por 100 mil UCs", natureza="CALCULADO",
            fonte=_fonte(meta_ouv, PAC_OUV, "Ouvidoria Setorial ANEEL", [f"ouvidoria-aneel-{a}" for a in v["anos_ouv"]]),
            unidade="reclamações por 100 mil UCs no ano", frequencia="diária, publicada por ano",
            periodo={"inicio": str(min(v["anos_ouv"])) if v["anos_ouv"] else "", "fim": str(max(v["anos_ouv"])) if v["anos_ouv"] else ""},
            cobertura={"inicio": str(ANO_INICIO_TIPOLOGIA), "fim": str(max(v["anos_ouv"])) if v["anos_ouv"] else ""},
            capturado_em=c.ultima_captura(snap_ouv), snapshot=snap_ouv,
            transformacoes=["categoria Reclamações; mês pela data de criação da solicitação; decisão procedente, improcedente ou sem decisão"],
            formula="taxa(g, ano) = 100.000 × Σ reclamações(g) ÷ UCs médias(g, ano)",
            limitacoes=["Solicitações recentes podem estar sem decisão; a proporção procedente muda com o tempo."],
            download="/energia/series/qualidade_atendimento.csv", notas_fonte=meta_ouv.get("notas")),
        "atendimento_emergencial": c.proveniencia(
            indicador="Tempo médio de atendimento a emergências (TMAE)", natureza="CALCULADO",
            fonte=_fonte(meta_atend, PAC_ATEND, "Atendimento às Ocorrências Emergenciais", ["indicador-atendimento-emergencial.parquet"]),
            unidade="minutos", frequencia="mensal", periodo=per_atend, cobertura=per_atend,
            capturado_em=c.ultima_captura(snap_atend), snapshot=snap_atend,
            transformacoes=["TMAE do conjunto = TMP + TMD + TME", "agregação ponderada pelo número de ocorrências emergenciais"],
            formula="TMAE(g, período) = Σ_c,m (TMP + TMD + TME)(c, m) × ocorrências(c, m) ÷ Σ ocorrências",
            limitacoes=["Tempo médio: eventos longos e raros pesam pouco; não mede o tempo total sem energia."],
            download="/energia/series/qualidade_atendimento.csv", notas_fonte=meta_atend.get("notas")),
        "eventos": c.proveniencia(
            indicador="Eventos em situação de emergência declarados pelas distribuidoras", natureza="OBSERVADO",
            fonte=_fonte(meta_ev, PAC_EVENTO, "Evento Situação de Emergência", ["evento-situacao-emergencia-2026.csv"]),
            unidade="eventos, horas e CHI (consumidor × hora interrompido)", frequencia="por evento",
            periodo={"inicio": (atendimento["eventos_emergencia"]["inicio_min"] or "")[:10], "fim": (atendimento["eventos_emergencia"]["inicio_max"] or "")[:10]},
            cobertura={"inicio": "2026-01", "fim": (atendimento["eventos_emergencia"]["inicio_max"] or "")[:7]},
            capturado_em=c.ultima_captura(snap_ev), snapshot=snap_ev,
            transformacoes=["duração = fim menos início do evento, em horas", "razão CHI = CHI do evento ÷ CHI limite da distribuidora"],
            limitacoes=["A ANEEL publica esta base a partir de 2026; não há série anterior no mesmo formato.",
                        "Evento declarado pela distribuidora; a classificação como situação de emergência é verificada pela ANEEL."],
            download="/energia/series/qualidade_eventos_emergencia.csv", notas_fonte=meta_ev.get("notas")),
        "mapa": c.proveniencia(
            indicador="Relação conjunto × município e intervalo de DEC e FEC dos conjuntos por município", natureza="CALCULADO",
            fonte=_fonte(meta_mun, PAC_MUN, "IndQual Município", ["indqual-municipio"]),
            unidade="horas e interrupções (valores do conjunto)", frequencia="anual", periodo={"inicio": str(ano_ref), "fim": str(ano_ref)},
            cobertura={"inicio": str(ano_ref), "fim": str(ano_ref)}, capturado_em=c.ultima_captura(snap_mun), snapshot=snap_mun,
            transformacoes=["associação pelo identificador do conjunto (IdeConjUndConsumidoras)"],
            formula="dec_min(município) = min dos DEC anuais dos conjuntos que atendem o município; dec_max = máximo",
            limitacoes=["A base não informa quantas UCs de cada conjunto estão em cada município nem a vigência da relação; nenhuma média municipal é calculada.",
                        "O valor exibido é do conjunto inteiro, que pode cobrir vários municípios."],
            download="/energia/series/qualidade_municipios.csv", notas_fonte=meta_mun.get("notas")),
        "ranking": c.proveniencia(
            indicador="DGC publicado no ranking da continuidade", natureza="OBSERVADO",
            fonte={"orgao": "ANEEL", "dataset": "Ranking da continuidade do serviço", "recurso": "páginas anuais (HTML)",
                   "url_dataset": URL_RANKING, "url_primaria": f"{URL_RANKING}/{ano_ref}", "licenca": LICENCA_GOVBR},
            unidade="razão (adimensional)", frequencia="anual", periodo={"inicio": "2021", "fim": str(ano_ref)},
            cobertura={"inicio": "2021", "fim": str(ano_ref)}, capturado_em=c.ultima_captura(snap_rank), snapshot=snap_rank,
            transformacoes=["empresa do ranking → CNPJ por tabela explícita de nomes publicados (sem semelhança de nome)"],
            limitacoes=["O ranking não traz CNPJ; nome que não está na tabela fica não vinculado.",
                        "A ANEEL apura o ranking com os dados disponíveis na data da nota técnica; revisões posteriores dos indicadores explicam parte das divergências."],
            download="/energia/series/qualidade_reconciliacao_dgc.csv"),
    }

    # ---------- evidências dos números de destaque ----------
    # Controles executados nesta construção (não o teste unitário, que roda à parte): cada
    # veredito sai de uma conferência sobre os próprios dados publicados.
    controles = _controles(con)
    conflitos = sum(int((x.get("detalhe") or {}).get("conflitos") or 0) for x in controles
                    if x["dataset"] == DS_CONT and x["recurso"].startswith("cont-"))
    fora_padrao = {k: n for x in controles if x["recurso"].startswith("comp-")
                   for k, n in ((x.get("detalhe") or {}).get("siglas_fora_do_padrao") or {}).items()}
    t_chaves = ev.teste("Chave única (CNPJ, conjunto, ano, mês, sigla) nos Parquets de continuidade",
                        "aprovado" if conflitos == 0 else "reprovado",
                        f"{conflitos} chaves repetidas com valor diferente")
    ident_ref = [x for x in ident if x["ano"] >= 2022]
    ident_ok = bool(ident_ref) and all(x["pct_dec_igual_ip_mais_ind"] == 100 and x["pct_fec_igual_ip_mais_ind"] == 100
                                       for x in ident_ref)
    t_ident = ev.teste("Identidade DEC = DECIP + DECIND e FEC = FECIP + FECIND (tolerância 0,01 de arredondamento), 2022 em diante",
                       "aprovado" if ident_ok else "ressalva",
                       "; ".join(f"{x['ano']}: {fmt_br(x['pct_dec_igual_ip_mais_ind'], 2)}% dos {x['conjunto_meses']} conjunto-meses (DEC)"
                                 for x in ident_ref) or "sem parcelas publicadas")
    meses_ok = [r for r in meses_do_ano(ano_ref) if v["completos"].get(r)]
    t_meses = ev.teste(f"Os 12 meses de {ano_ref} completos (UCs com DEC ≥ 99% do máximo dos 12 meses anteriores)",
                       "aprovado" if len(meses_ok) == 12 else "reprovado", f"{len(meses_ok)} de 12 meses completos")
    cob_min = min((v["br"]["m.ucs"][r] / v["br"]["m.ucs_total"][r] for r in meses_do_ano(ano_ref)
                   if v["br"]["m.ucs_total"].get(r)), default=None)
    rec_ref = next((x for x in rec_anos if x["ano"] == ano_ref), None)
    if rec_ref and rec_ref["comparados"]:
        frac = rec_ref["ate_1_centesimo"] / rec_ref["comparados"]
        rec_res = "aprovado" if frac == 1 else ("ressalva" if frac >= 0.9 else "reprovado")
        rec_desc = (f"DGC de cada distribuidora recalculado com esta agregação (DEC e FEC ponderados por UC, limite ponderado "
                    f"pelas UCs médias) contra o DGC publicado pela ANEEL no ranking da continuidade de {ano_ref}: "
                    f"{rec_ref['ate_1_centesimo']} de {rec_ref['comparados']} distribuidoras iguais até 0,01; maior diferença "
                    f"{fmt_br(rec_ref['maior_diferenca'], 2)}")
    else:
        rec_res, rec_desc = "ressalva", f"ranking de {ano_ref} ainda não integrado: sem reconciliação externa neste ano"
    reconc_dgc = ev.reconciliacao(rec_desc, rec_res, "0,01 no DGC (o publicado tem duas casas decimais)")
    rec_cont = [r for r in ("cont-2000-2009", "cont-2010-2019", "cont-2020-2029")
                if (ano_ref < 2010 and r == "cont-2000-2009") or (2010 <= ano_ref < 2020 and r == "cont-2010-2019")
                or (ano_ref >= 2020 and r == "cont-2020-2029")]
    fonte_ev_cont = _fonte_ev(con, DS_CONT, rec_cont, "Indicadores Coletivos de Continuidade (DEC e FEC)", _url(PAC_CONT))
    fonte_ev_lim = _fonte_ev(con, DS_CONT, rec_cont + ["limite"], "Indicadores Coletivos de Continuidade (DEC e FEC): valores e limites", _url(PAC_CONT))
    per_ref = {"inicio": f"{ano_ref:04d}-01", "fim": f"{ano_ref:04d}-12"}
    dl_br = [{"rotulo": "Brasil mensal e anual (CSV)", "url": "/energia/series/qualidade_brasil.csv"},
             {"rotulo": "Distribuidoras por mês (CSV)", "url": "/energia/series/qualidade_distribuidoras_mensal.csv"}]
    consulta_br = (f"Parquet {R_CONT[-1] if ano_ref >= 2020 else R_CONT[0]}: linhas com SigIndicador em (DEC, FEC, NumCon) e "
                   f"AnoIndice = {ano_ref}; por mês, Σ(valor × NumCon) ÷ Σ NumCon dos conjuntos com os dois campos; soma dos 12 meses")
    evidencias = {}
    for ind, nome, uni, sufixo in (("dec", "DEC do Brasil", "horas por unidade consumidora", " h"),
                                   ("fec", "FEC do Brasil", "interrupções por unidade consumidora", "")):
        valor = sum(v["br"][f"m.{ind}"][r] for r in meses_do_ano(ano_ref))
        evidencias[f"{ind}_brasil"] = evidencia(
            indicador=f"{nome} (apurado, ponderado por unidades consumidoras)", valor_exibido=fmt_br(valor, 2, sufixo),
            valor_calculo=valor, unidade=uni, periodo=per_ref, entidade="Brasil",
            universo=f"{br_ref['conjuntos']} conjuntos de todas as distribuidoras que enviaram {ind.upper()} em {ano_ref}",
            filtros=[f"ano {ano_ref}", "12 meses completos", f"SigIndicador {ind.upper()} e NumCon"],
            fonte=fonte_ev_cont, chaves_origem=[f"{DS_CONT}: br.m.{ind} {r}" for r in meses_do_ano(ano_ref)],
            consulta=consulta_br.replace("(DEC, FEC, NumCon)", f"({ind.upper()}, NumCon)"),
            formula=f"{ind.upper()}(Brasil, ano) = Σ_m [Σ_c {ind.upper()}(c, m) × UC(c, m) ÷ Σ_c UC(c, m)]",
            pesos="número de unidades consumidoras de cada conjunto no mês (NumCon)",
            exclusoes=[f"conjunto sem {ind.upper()} ou sem NumCon no mês fica fora do numerador e do denominador daquele mês"],
            cobertura=(f"12 de 12 meses; em cada mês, ao menos {fmt_br(100 * cob_min, 2)}% das UCs com NumCon têm {ind.upper()}"
                       if cob_min is not None else "12 de 12 meses"),
            tratamento_ausencia="Mês incompleto não fecha o ano; nulo nunca vira zero nem é interpolado.",
            revisoes=snap.get("revisoes"), testes=[t_meses, t_ident, t_chaves], reconciliacao=reconc_dgc, download=dl_br)
    acima, com_lim = len(v["acima_dec"]), len(v["rz"])
    if com_lim:
        pct = 100 * acima / com_lim
        evidencias["conjuntos_acima_limite"] = evidencia(
            indicador="Conjuntos com DEC anual acima do limite", valor_exibido=fmt_br(pct, 1, "%"), valor_calculo=pct,
            unidade="% dos conjuntos com 12 meses e limite de DEC", periodo=per_ref, entidade="Brasil",
            universo=f"{com_lim} conjuntos com 12 meses de DEC e limite de DEC publicado para {ano_ref}",
            filtros=[f"ano {ano_ref}", "conjunto com 12 meses", "limite do mesmo ano (mesma vigência)"],
            fonte=fonte_ev_lim, chaves_origem=[str(x["conjunto"]) for x in sorted(v["acima_dec"], key=lambda x: x["conjunto"])],
            consulta=(f"qualidade_conjuntos_anual.csv com ano = {ano_ref}, meses = 12 e dec_limite_h preenchido; "
                      "conta as linhas com dec_h > dec_limite_h"),
            manifesto={"rotulo": "Conjuntos por ano (CSV)", "url": "/energia/series/qualidade_conjuntos_anual.csv"},
            formula="100 × #(DEC anual > limite anual) ÷ #(conjuntos com limite)",
            numerador={"descricao": "conjuntos com DEC anual acima do limite", "valor": acima},
            denominador={"descricao": "conjuntos com 12 meses e limite publicado", "valor": com_lim},
            pesos="nenhum: contagem de conjuntos (a fração ponderada por UCs é publicada ao lado)",
            exclusoes=["conjunto com menos de 12 meses no ano", "conjunto sem limite publicado para o ano"],
            cobertura=f"{com_lim} de {len(lc)} conjuntos com 12 meses têm limite de DEC para {ano_ref}",
            tratamento_ausencia="Sem limite para o ano: fora do denominador (não conta como dentro nem como acima).",
            revisoes=snap.get("revisoes"),
            testes=[t_meses, t_chaves, ev.teste("Comparação estrita DEC > limite com os valores publicados em centésimos", "aprovado",
                                                f"{acima} acima, {com_lim - acima} iguais ou abaixo")],
            download=[{"rotulo": "Conjuntos por ano (CSV)", "url": "/energia/series/qualidade_conjuntos_anual.csv"}])
    if ref_comp and ref_comp.get("valor") is not None:
        a_c = v["comp_ano_ref"]
        rec_comp = ["comp-2000-2009", "comp-2010-2019", "comp-2020-2029"][2 if a_c >= 2020 else (1 if a_c >= 2010 else 0)]
        soma_tipos = sum((x or {}).get("valor") or 0 for x in ref_comp["por_tipo"].values())
        evidencias["compensacoes_ano"] = evidencia(
            indicador="Compensações pagas por violação dos limites individuais de continuidade",
            valor_exibido="R$ " + fmt_br(ref_comp["valor"], 0), valor_calculo=ref_comp["valor"],
            unidade="R$ nominais da competência", periodo={"inicio": f"{a_c:04d}-01", "fim": f"{a_c:04d}-12"}, entidade="Brasil",
            universo="todas as distribuidoras com compensação publicada, unidades consumidoras e unidades geradoras",
            filtros=[f"competência em {a_c}", "tipos mensal, trimestral, anual, DICRI e DISE"],
            fonte=_fonte_ev(con, DS_CONT, [rec_comp], "Indicadores Coletivos de Continuidade (DEC e FEC): compensações", _url(PAC_CONT)),
            chaves_origem=[f"{DS_CONT}: k<CNPJ>.valor.<uc|ug>.<tipo> em {a_c}"],
            consulta=(f"Parquet {R_COMP[-1] if a_c >= 2020 else R_COMP[0]}: SigIndicador PGUC* e PGUG* (valor pago) com "
                      f"AnoIndice = {a_c}; soma de VlrIndiceEnviado"),
            formula="Σ dos valores pagos publicados (PG*), todos os tipos e tensões, competência no ano",
            pesos=None, exclusoes=["siglas fora do padrão PG/QT de continuidade (nenhuma encontrada)" if not fora_padrao
                                   else f"siglas fora do padrão: {', '.join(sorted(fora_padrao))}"],
            cobertura=(f"ano completo (último mês completo {ult_c})" if ref_comp["completo"]
                       else f"ano parcial: último mês completo {ult_c}"),
            tratamento_ausencia="Distribuidora sem linha no mês não soma nada (não é tratada como zero pago).",
            revisoes=snap.get("revisoes"),
            testes=[ev.teste("Soma por tipo igual ao total", "aprovado" if abs(soma_tipos - ref_comp["valor"]) <= 0.05 else "reprovado",
                             f"Σ tipos {fmt_br(soma_tipos, 2)} × total {fmt_br(ref_comp['valor'], 2)}"),
                    ev.teste("Siglas de compensação no padrão PG/QT + UC/UG + tensão + tipo", "aprovado" if not fora_padrao else "ressalva",
                             f"{sum(fora_padrao.values())} linhas fora do padrão")],
            download=[{"rotulo": "Compensações por distribuidora e competência (CSV)", "url": "/energia/series/qualidade_compensacoes.csv"}])
    for chave, i_num, fator, i_meses, rot, uni, ds, recs, conj_nome in (
            ("reclamacoes_distribuidora", 7, 1000, 13, "Reclamações no 1º nível (atendimento da distribuidora)", "reclamações por mil UCs no ano",
             DS_MANIF, [f"manif-{ano_ref}"], "Manifestações no 1° e 2° nível da Distribuidora"),
            ("ouvidoria_aneel", 14, 1e5, 18, "Reclamações na Ouvidoria Setorial da ANEEL", "reclamações por 100 mil UCs no ano",
             DS_OUV, [f"ouv-{ano_ref}"], "Ouvidoria Setorial ANEEL")):
        b = nacional_bruto(ano_ref, i_num, i_meses, registro=(ds == DS_OUV))
        if not b["den"] or not b["completo"]:
            continue
        taxa = fator * b["num"] / b["den"]
        evidencias[chave] = evidencia(
            indicador=rot + ", taxa nacional", valor_exibido=fmt_br(taxa, 1), valor_calculo=taxa, unidade=uni,
            periodo=per_ref, entidade="Brasil (distribuidoras com contagem e UCs no ano)",
            universo=f"{b['n']} distribuidoras com as duas informações em {ano_ref}",
            filtros=[f"ano {ano_ref}", "reclamações (categoria da fonte)", "12 meses publicados"],
            fonte=_fonte_ev(con, ds, recs, conj_nome, _url(PAC_MANIF if ds == DS_MANIF else PAC_OUV)),
            chaves_origem=b["cnpjs"], manifesto={"rotulo": "Atendimento por distribuidora e ano (CSV)", "url": "/energia/series/qualidade_atendimento.csv"},
            formula=f"{fmt_br(fator, 0)} × Σ reclamações ÷ Σ UCs médias do ano (mesmas distribuidoras no numerador e no denominador)",
            numerador={"descricao": "reclamações no ano", "valor": b["num"]},
            denominador={"descricao": "UCs médias do ano (indicadores de continuidade, mesmo CNPJ)", "valor": b["den"]},
            pesos="implícito: a taxa agregada é Σ numeradores ÷ Σ denominadores, não a média das taxas",
            exclusoes=["distribuidora sem UCs médias no ano (fora dos indicadores de continuidade) fica fora do numerador e do denominador"],
            cobertura=(f"{b['n']} distribuidoras com {fmt_br(100 * b['cobertura_ucs'], 1)}% das UCs do país"
                       + (f"; {len(b['fora_meses_incompletos'])} fora por não terem os 12 meses enviados" if b["fora_meses_incompletos"] else "")),
            tratamento_ausencia=("Distribuidora sem os 12 meses enviados fica fora do numerador e do denominador; ausência não é zero reclamação."
                                 if ds == DS_MANIF else
                                 "Distribuidora sem nenhuma solicitação registrada no ano fica fora (zero ou CNPJ não vinculado não se distinguem); a cobertura em UCs é publicada."),
            testes=[ev.teste("Meses no ano", "aprovado",
                             (f"todas as {b['n']} distribuidoras com 12 meses enviados" if ds == DS_MANIF else
                              f"arquivo cobre os 12 meses de {ano_ref}; distribuidoras com solicitações em {b['meses_min']} a {b['meses_max']} meses")),
                    ev.teste("Numerador e denominador do mesmo universo de CNPJs", "aprovado", f"{b['n']} CNPJs nos dois termos")],
            download=[{"rotulo": "Atendimento por distribuidora e ano (CSV)", "url": "/energia/series/qualidade_atendimento.csv"}])

    gold = {
        **c.cabecalho(GOLD),
        "ano_referencia": ano_ref, "ultimo_mes_completo": v["ultimo_mes"], "parcial": v["parcial"],
        "unidades": {"dec": "horas e centésimos de hora por unidade consumidora", "fec": "interrupções e centésimos por unidade consumidora",
                     "tmae": "minutos", "compensacao": "R$ nominais", "iasc": "índice de 0 a 100"},
        "regras": {
            "agregacao": "DEC e FEC de distribuidora e Brasil: média mensal dos conjuntos ponderada pelas UCs de cada conjunto no mês; anual = soma dos 12 meses.",
            "limite": "Limite anual da distribuidora: média dos limites anuais dos conjuntos ponderada pelas UCs médias do ano; comparado só com o apurado do mesmo ano.",
            "apurado": "DEC e FEC apurados (comparados ao limite): desde 2022, exatamente as parcelas internas programada e não programada não expurgável (IP + IND); de 2010 a 2021 o apurado de parte dos conjuntos incluía também as externas não críticas (XN + XP). As demais parcelas aparecem separadas.",
            "centesimos": "DEC em horas e centésimos: 10,50 h são 10 horas e 30 minutos.",
            "compensacao": "Compensação é crédito na fatura por violação de limite individual (DIC, FIC, DMIC, DICRI, DISE); não se calcula a partir do DEC do conjunto.",
            "parcial": "Ano corrente só é comparado com os mesmos meses do ano anterior.",
        },
        "parcelas": {"rotulos": fq.ROTULO_GRUPO, "definicao": fq.PARCELAS, "grupos": {k: list(vv) for k, vv in fq.GRUPOS_PARCELAS.items()}},
        "brasil": {"anual": br_anual, "mensal": v["brasil_mensal"], "identidade_apurado": ident},
        "distribuidoras": distribuidoras,
        "conjuntos": conjuntos,
        "compensacoes": compensacoes,
        "atendimento": atendimento,
        "mapa": mapa,
        "reconciliacao": {"dgc": rec_anos},
        "controles": controles,
        "evidencias": evidencias,
        "proveniencia": prov,
        "downloads": [{"rotulo": d.split("/")[-1], "url": d} for d in REGISTRO["arquivos"]],
    }
    # mapa municipal compacto num arquivo à parte (sem indentação): a gold principal fica
    # abaixo de 400 KB e a página do mapa lê só o que precisa
    mapa_mun = {"ano": ano_ref, "colunas": ["cod_ibge", "relacao", "n_conjuntos", "dec_min", "dec_max", "fec_min", "fec_max"],
                "relacoes": ["conjunto_exclusivo", "conjunto_compartilhado", "varios_conjuntos", "sem_conjunto_ativo"],
                "linhas": []}
    idx = {k: i for i, k in enumerate(mapa_mun["relacoes"])}
    for row in v["mun_csv"]:
        mapa_mun["linhas"].append([row[0], idx[row[5]], row[4], _r(row[7]), _r(row[8]), _r(row[9]), _r(row[10])])
    gold["_mapa_municipal"] = mapa_mun
    return gold
