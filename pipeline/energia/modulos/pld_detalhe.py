"""Módulo PLD (detalhe): CMO e formação de preço, limites, histórico e diferenças regionais.

Gold: public/energia/gold/pld_detalhe.json (painéis P008 a P012 da especificação) e
CSVs em public/energia/series/pld_*.csv. Complementa, sem substituir, as golds de
operação pld.json (PLD realizado) e cmo.json (CMO semanal).

Fontes (seção "Fontes verificadas" em docs/observatorios/energia/modulos/pld.md):
- ONS, CMO Semi-Horário (DESSEM): coletado aqui, família de silver `ons_cmo`;
- ONS, CMO Semanal (DECOMP): lido do silver principal (cmo_se) e relido do arquivo
  original CSV e Parquet por outro código, para fechar o achado A02;
- ONS, dicionários de dados dos dois conjuntos: unidade do CMO (achado A03);
- CCEE, PLD_HORARIO: lido do silver principal (ccee_pld_horario), só leitura;
- ONS, Balanço de Energia nos Subsistemas (carga horária) e Intercâmbios entre
  Subsistemas (fluxo horário): silver principal, só leitura;
- IBGE, IPCA número-índice (SIDRA 1737): deflator opcional;
- ANEEL, atos anuais de limites do PLD: consumidos de pipeline.energia.regulatorio
  (módulo Regulação), nunca inferidos do menor valor observado (achado A04);
- Decreto nº 5.163/2004 (arts. 57 e 58, Câmara dos Deputados) e REN ANEEL nº 957/2021
  (Convenção de Comercialização): textos primários do painel P008, com cada passagem
  citada conferida no documento baixado (fontes/normas_pld.py).

Por que o CMO do ONS e o PLD da CCEE não são tratados como a mesma série: o CMO
semanal é saída do DECOMP para a semana operativa inteira, por patamar; o CMO
semi-horário é saída do DESSEM do ONS, média das barras de cada subsistema ponderada
pela carga; o PLD horário é calculado pela CCEE, a partir do CMO, com limites mínimo e
máximos. A comparação publicada é sempre entre o mesmo intervalo (a mesma hora, ou a
mesma semana operativa de sábado a sexta) e em diferença absoluta (R$/MWh), nunca em
razão ou multiplicador (achado A01).
"""
import calendar
import csv
import hashlib
import io
import json
import math
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.common import USER_AGENT  # noqa: E402
from pipeline.energia import base  # noqa: E402
from pipeline.energia import evidencia as ev  # noqa: E402
from pipeline.energia.fontes import ckan, ibge_pld, normas_pld, ons_pld  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

GOLD = "pld_detalhe.json"
FAMILIA = "ons_cmo"

DS_SH = "ons_cmo_semihorario"          # CMO semi-horário (DESSEM), meias horas
DS_A02 = "ons_cmo_semanal_a02"         # CMO semanal relido do original (CSV e Parquet)
DS_DIC = "ons_cmo_dicionarios"         # dicionários de dados (JSON e PDF)
DS_IPCA = "ibge_ipca_1737"             # IPCA número-índice
DS_CONTROLE = "ons_cmo_controle"       # marca de importação de cada vintage no silver
DS_NORMAS = "normas_pld"               # Decreto nº 5.163/2004, REN ANEEL nº 957/2021 e Procedimentos de Rede (P008)
DS_BAL_CONF = "ons_cmo_balanco_conferencia"  # balanço do ONS baixado de novo, só para reconciliar a ponderada

# silver principal (só leitura)
DS_PLD = "ccee_pld_horario"
DS_CMO_SEM = "cmo_se"
DS_BAL = "balanco_energia_subsistema_ho"
DS_INT = "intercambio_nacional_ho"

PACOTE_SH = "cmo-semi-horario"
PACOTE_SEM = "cmo-semanal"
PACOTE_BAL = "balanco-energia-subsistema"
URL_SH = "https://dados.ons.org.br/dataset/cmo-semi-horario"
URL_SEM = "https://dados.ons.org.br/dataset/cmo-semanal"
S3_ONS = "https://ons-aws-prod-opendata.s3.amazonaws.com/"
S3_SH = "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/cmo_tm/"
S3_SEM = "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/cmo_se/"
LICENCA_IBGE = ("Uso livre com citação da fonte (IBGE). A página de termos de uso do IBGE respondeu com desafio "
                "de navegador em 30/09/2026 e não foi relida nesta integração.")

SITE = "https://scrutiniums.com/setor-eletrico/pld"

# Tolerâncias monetárias. O PLD horário e os limites são publicados em centavos, então na
# hora "no limite" é igualdade ao centavo: |PLD − limite| ≤ R$ 0,005/MWh (o meio centavo
# só absorve a representação binária do número). Um preço um centavo acima do piso é outro
# preço e fica numa classe à parte ("a um centavo do limite"); a contagem que usaria
# R$ 0,01/MWh na hora é publicada como sensibilidade (TOL_SENS). O teto estrutural é
# conferido sobre a média das 24 horas, que tem erro de arredondamento de até R$ 0,005/MWh
# contra um limite também arredondado ao centavo: ali a tolerância é R$ 0,01/MWh (TOL).
# TOL também é o limiar de separação de preços entre submercados (mais de um centavo).
TOL_HORA = 0.005
TOL = 0.01
TOL_SENS = 0.01
MEIO_CENTAVO = 0.005
EPS = 1e-9
FLUXO_NULO = 1.0  # MWmed: fluxo de fronteira tratado como nulo nesta faixa
PARES = (("SE", "S"), ("SE", "NE"), ("SE", "N"), ("S", "NE"), ("S", "N"), ("NE", "N"))
FRONTEIRAS = (("N", "NE"), ("N", "SE"), ("NE", "SE"), ("S", "SE"))
INICIO = "2021-01-01"  # início do PLD horário

REGISTRO = {
    "id": "pld",
    "gold": GOLD,
    "familia": FAMILIA,
    "ordem": 12,
    "datasets": [
        {"orgao": "ONS", "nome": PACOTE_SH, "slug": "ons-cmo-semi-horario", "dataset_silver": DS_SH,
         "titulo": "CMO Semi-Horário (resultado do modelo DESSEM)", "estado": "UTILIZADO EM INDICADOR",
         "url": URL_SH, "licenca": c.LICENCA_ONS,
         "descricao": "CMO estimado pelo DESSEM para cada barra em base semi-horária; o CMO do subsistema é a média das barras ponderada pelas cargas.",
         "paginas": [{"rotulo": "PLD: CMO e formação de preço", "href": "/setor-eletrico/pld"}],
         "downloads": ["/energia/series/pld_cmo_horario.csv", "/energia/series/pld_cmo_semanal.csv"],
         "quebras": []},
        {"orgao": "ONS", "nome": PACOTE_SEM, "slug": "ons-cmo-semanal", "dataset_silver": DS_A02,
         "titulo": "CMO Semanal (resultado do modelo DECOMP): releitura do arquivo original", "estado": "UTILIZADO EM INDICADOR",
         "url": URL_SEM, "licenca": c.LICENCA_ONS,
         "paginas": [{"rotulo": "PLD: CMO e formação de preço", "href": "/setor-eletrico/pld"}],
         "downloads": ["/energia/series/pld_cmo_semanal.csv"], "quebras": []},
        {"orgao": "IBGE", "nome": "sidra-1737", "slug": "ibge-ipca-1737", "dataset_silver": DS_IPCA,
         "titulo": "IPCA: número-índice (base dezembro de 1993 = 100), tabela SIDRA 1737", "estado": "UTILIZADO EM INDICADOR",
         "url": ibge_pld.URL_TABELA, "licenca": LICENCA_IBGE, "tema": "precos",
         "descricao": "Número-índice mensal do IPCA, usado como deflator opcional das médias mensais do PLD.",
         "paginas": [{"rotulo": "PLD: histórico em moeda constante", "href": "/setor-eletrico/pld"}],
         "downloads": ["/energia/series/pld_mensal.csv"], "quebras": []},
        {"orgao": "Câmara dos Deputados", "nome": "decreto-5163-2004", "slug": "camara-decreto-5163-2004",
         "dataset_silver": DS_NORMAS, "titulo": "Decreto nº 5.163/2004, norma atualizada (arts. 57 e 58: PLD e mercado de curto prazo)",
         "estado": "INTEGRADO", "url": normas_pld.URL_DECRETO, "licenca": normas_pld.DOCUMENTOS["decreto_5163_2004"]["licenca"],
         "tema": "normas", "formatos": ["HTML"],
         "descricao": "Texto legal citado no painel Entenda o preço; cada passagem é conferida no documento baixado.",
         "paginas": [{"rotulo": "PLD: entenda o preço", "href": "/setor-eletrico/pld"}], "downloads": [], "quebras": []},
        {"orgao": "ANEEL", "nome": "ren-957-2021", "slug": "aneel-ren-957-2021", "dataset_silver": DS_NORMAS,
         "titulo": "Resolução Normativa nº 957/2021: Convenção de Comercialização (texto compilado)",
         "estado": "INTEGRADO", "url": normas_pld.URL_REN957_OFICIAL, "licenca": normas_pld.DOCUMENTOS["ren_aneel_957_2021"]["licenca"],
         "tema": "normas", "formatos": ["PDF"],
         "descricao": ("Definição do mercado de curto prazo e valoração das exposições ao PLD. Cópia do Internet Archive do endereço "
                       "oficial, que responde com desafio de navegador."),
         "paginas": [{"rotulo": "PLD: entenda o preço", "href": "/setor-eletrico/pld"}], "downloads": [], "quebras": []},
        {"orgao": "ONS", "nome": "procedimentos-de-rede", "slug": "ons-procedimentos-de-rede-pld", "dataset_silver": DS_NORMAS,
         "titulo": "Procedimentos de Rede: Submódulos 2.4, 4.3 e 4.5 (uso do DECOMP e do DESSEM no cálculo do CMO)",
         "estado": "INTEGRADO", "url": normas_pld.URL_PR_PAGINA, "licenca": normas_pld.LICENCA_PR, "tema": "normas", "formatos": ["PDF"],
         "descricao": ("Horizonte, discretização e momento de execução dos modelos de curto e curtíssimo prazo do ONS, citados no "
                       "painel CMO e formação de preço; cada passagem é conferida no PDF baixado."),
         "paginas": [{"rotulo": "PLD: CMO e formação de preço", "href": "/setor-eletrico/pld"}], "downloads": [], "quebras": []},
        {"orgao": "CEPEL", "nome": "dessem-manual-metodologia", "slug": "cepel-dessem-manual-metodologia", "dataset_silver": DS_NORMAS,
         "titulo": "Modelo DESSEM: Manual de Metodologia (novembro de 2022)", "estado": "INTEGRADO", "url": normas_pld.URL_DESSEM_MANUAL,
         "licenca": normas_pld.DOCUMENTOS["cepel_dessem_manual_metodologia"]["licenca"], "tema": "normas", "formatos": ["PDF"],
         "descricao": ("Uso do DESSEM pelo ONS e pela CCEE e cálculo do CMO do submercado (média dos custos marginais das barras "
                       "ponderada pelas cargas), citados no painel CMO e formação de preço; cada passagem é conferida no PDF baixado."),
         "paginas": [{"rotulo": "PLD: CMO e formação de preço", "href": "/setor-eletrico/pld"}], "downloads": [], "quebras": []},
        {"orgao": "ONS", "nome": PACOTE_BAL, "slug": "ons-balanco-subsistema-conferencia-pld", "dataset_silver": DS_BAL_CONF,
         "titulo": "Balanço de Energia nos Subsistemas: cópia própria para reconciliar o PLD ponderado pela carga",
         "estado": "INTEGRADO", "url": f"https://dados.ons.org.br/dataset/{PACOTE_BAL}", "licenca": c.LICENCA_ONS,
         "descricao": ("Arquivo anual baixado por este módulo e relido por leitor próprio para refazer a média ponderada pela carga "
                       "das fichas de evidência; o peso publicado vem do silver principal."),
         "paginas": [{"rotulo": "PLD: histórico e distribuição", "href": "/setor-eletrico/pld"}], "downloads": [], "quebras": []},
    ],
    "arquivos": {
        "/energia/series/pld_cmo_horario.csv": (
            "data_hora_local (início da hora, Brasília); CMO_SE, CMO_S, CMO_NE, CMO_N = CMO do DESSEM (ONS) na hora, média "
            "simples das duas meias horas que começam em HH:00 e HH:30, em R$/MWh (vazio quando alguma das duas meias horas "
            "não foi publicada); PLD_SE, PLD_S, PLD_NE, PLD_N = PLD horário da CCEE em R$/MWh nominais (vazio = ausência)."),
        "/energia/series/pld_cmo_semanal.csv": (
            "semana_inicio (sábado) e semana_fim (sexta) da semana operativa; sm; decomp_media_semanal e decomp_leve, "
            "decomp_media_patamar, decomp_pesada = CMO semanal do DECOMP (ONS) como publicado; dessem_media = média das meias "
            "horas do DESSEM na semana (vazio se faltar alguma), dessem_meias_horas = quantas havia (336 na semana completa); "
            "pld_media = média das horas do PLD na semana (vazio se faltar alguma), pld_horas = quantas havia (168). R$/MWh."),
        "/energia/series/pld_limites_diario.csv": (
            "data; sm; pld_media_dia (média das 24 horas, vazio se faltar hora); horas; horas_no_piso e horas_no_teto_horario "
            "(PLD igual ao limite ao centavo: |PLD − limite| ≤ R$ 0,005/MWh); horas_um_centavo_acima_do_piso (PLD exatamente "
            "um centavo acima do piso, classe à parte); media_no_teto_estrutural (1 = média diária a até R$ 0,01/MWh do teto "
            "estrutural, 0 = não, vazio sem limite ou sem média); pld_min, pld_max_horario, pld_max_estrutural vigentes no dia e o "
            "ato de cada um (vazios quando os atos não estão disponíveis). R$/MWh nominais."),
        "/energia/series/pld_mensal.csv": (
            "mes (AAAA-MM); sm; parcial (1 = mês sem todos os dias completos); horas; media_temporal (média simples das horas, "
            "R$/MWh nominais); horas_com_carga (horas com carga publicada e positiva); horas_carga_nao_positiva (horas com carga "
            "publicada menor ou igual a zero, retiradas do peso); media_ponderada_carga (Σ PLD × carga ÷ Σ carga do subsistema ONS "
            "nas horas com carga positiva, R$/MWh); mesmas_horas (1 = as duas médias usam as mesmas horas); ipca_indice (IBGE, "
            "dez/1993 = 100); media_temporal_real (R$/MWh em reais do mes_base_real pelo IPCA; vazio sem índice do mês); mes_base_real."),
        "/energia/series/pld_hora_dia.json": (
            "Mapa hora × dia do PLD dos últimos 90 dias até o dia de referência: dias (AAAA-MM-DD, datas corridas), e por "
            "submercado uma matriz [dia][hora 0 a 23] em R$/MWh nominais; null = hora sem PLD publicado (dia ausente fica todo null)."),
        "/energia/series/pld_evidencias.json": (
            "Fichas \"Comprove este número\" dos agregados do módulo (objeto de pipeline/energia/evidencia.py por chave), lidas sob "
            "demanda pela interface; a gold traz só o índice."),
        "/energia/series/pld_separacao_diaria.csv": (
            "data; par (A_B); horas (horas com PLD nos dois submercados); horas_separadas (|PLD_A − PLD_B| > R$ 0,01/MWh); "
            "dif_media (média de PLD_A − PLD_B, R$/MWh); dif_abs_max; fronteira (se o par tem fronteira monitorada pelo ONS, "
            "na orientação canônica); fluxo_medio_mwmed (média do fluxo verificado nas horas com fluxo, positivo da primeira "
            "para a segunda ponta da fronteira; vazio sem fronteira ou sem dado); horas_com_fluxo."),
        "/energia/series/pld_amplitude_diaria.csv": (
            "data; horas (horas com os quatro submercados); horas_com_separacao (maior − menor > R$ 0,01/MWh); amplitude_media "
            "e amplitude_max (maior menos menor PLD entre os quatro submercados na mesma hora, R$/MWh); hora_amplitude_max."),
        "/energia/series/pld_sazonal.csv": (
            "sm; mes (1 a 12); n_dias e anos (dias completos do mesmo mês em anos anteriores ao ano de referência); p10, p25, "
            "p50, p75, p90 da média diária do PLD nesses dias (R$/MWh nominais, quantil tipo 7)."),
    },
}

META_DIR = os.path.join(base.DADOS, "meta")


# ---------------------------------------------------------------------------
# Coleta
# ---------------------------------------------------------------------------

def _ano_do_arquivo(nome, prefixo):
    nucleo = nome[len(prefixo):].split(".")[0]
    return int(nucleo) if nucleo.isdigit() else None


def _recursos(pac, prefixo, formato):
    """{(ano, formato): recurso CKAN} dos arquivos anuais <prefixo><ano>.<ext>."""
    out = {}
    for r in pac.get("resources", []):
        url = r.get("url") or ""
        nome = url.rsplit("/", 1)[-1]
        if (r.get("format") or "").upper() != formato or not nome.startswith(prefixo):
            continue
        ano = _ano_do_arquivo(nome, prefixo)
        if ano:
            out[ano] = r
    return out


def _max_idade(ano, hoje):
    # ano corrente e anterior mudam (consistência recorrente do ONS e publicação diária);
    # anos fechados só são rebaixados se o last_modified mudar ou a cada 30 dias
    return 0.4 if ano >= hoje.year - 1 else 30


def _importado(con, chave):
    return bool(base.registros_como_estavam_em(con, DS_CONTROLE).get(chave, {}).get("importado"))


def _marca_importado(con, vid, relatorio, chave=None):
    """Marca a vintage `vid` como importada no silver (chave = vid, ou a combinação de
    vintages que foi lida junto). O registro fica atrelado à vintage real, para que a
    reconstituição por data em registros_como_estavam_em o encontre."""
    base.grava_registros(con, DS_CONTROLE, vid,
                         [(chave or vid, "importado", json.dumps(relatorio, ensure_ascii=False, sort_keys=True))])


# ---------------------------------------------------------------------------
# Data de publicação dos arquivos do S3 do ONS
# ---------------------------------------------------------------------------
# O last_modified do recurso no CKAN pode estar atrasado em relação ao arquivo: em
# 30/09/2026 a captura das 22h06 (UTC) registrou 15:01:21, mas o objeto baixado no S3
# tinha sido gravado às 22:00:52 (e o CKAN passou a dizer 22:01:09). A data que descreve
# os bytes capturados é o Last-Modified do próprio objeto no S3, desde que o objeto lido
# no cabeçalho seja o mesmo que foi baixado: isso se prova pelo ETag, que no S3 é o MD5
# do conteúdo quando o arquivo é gravado de uma vez (sem "-n" de upload em partes).

def instante_http(v):
    """'Wed, 30 Sep 2026 22:00:52 GMT' → '2026-09-30T22:00:52Z'; None se ilegível."""
    try:
        dt = parsedate_to_datetime(v) if v else None
    except (TypeError, ValueError):
        return None
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def publicacao_do_objeto(cabecalhos, md5_conteudo):
    """Last-Modified do objeto como publicação dos bytes capturados, só quando o ETag é o
    MD5 desses bytes. ETag de upload em partes, ausente ou diferente devolve None: o
    objeto lido no cabeçalho não é comprovadamente o arquivo capturado."""
    etag = str((cabecalhos or {}).get("etag") or "").strip().strip('"').lower()
    if not etag or "-" in etag or etag != str(md5_conteudo or "").lower():
        return None
    return instante_http((cabecalhos or {}).get("last_modified"))


def cabecalhos_s3(url, timeout=60):
    """HEAD do objeto (Last-Modified e ETag), com o mesmo User-Agent dos demais coletores."""
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return {"last_modified": resp.headers.get("Last-Modified"), "etag": resp.headers.get("ETag")}


def md5_do_bronze(arquivo):
    h = hashlib.md5()
    with base.abre_bronze(arquivo) as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def confere_publicacao_s3(con, vintage, cabecalhos=cabecalhos_s3, agora=None):
    """Confere e corrige a data de publicação de uma vintage de arquivo do S3 do ONS.

    Conferida (ETag = MD5 dos bytes do bronze): publicado_em da vintage passa a ser o
    Last-Modified do objeto, e o valor anterior (last_modified do CKAN lido na coleta) fica
    registrado em `registros` com a evidência. Não conferida (o objeto mudou depois da
    captura ou o ETag não é MD5): publicado_em fica vazio, porque nada comprova quando
    aqueles bytes foram publicados. Falha de rede não muda nada e é tentada de novo."""
    chave = f"publicacao_s3:{vintage['vintage_id']}"
    feito = base.registros_como_estavam_em(con, DS_CONTROLE).get(chave, {})
    if feito.get("resultado") in ("conferida", "nao_conferida"):
        return {"resultado": feito["resultado"], "publicado_em": feito.get("publicado_em") or None, "registrado": True}
    url = vintage.get("url") or ""
    if not url.startswith(S3_ONS) or not vintage.get("arquivo"):
        return {"resultado": "nao_se_aplica", "publicado_em": vintage.get("publicado_em")}
    try:
        cab = cabecalhos(url)
        md5 = md5_do_bronze(vintage["arquivo"])
    except Exception as e:  # sem rede ou sem arquivo: nada muda
        return {"resultado": "falha", "publicado_em": vintage.get("publicado_em"), "detalhe": str(e)[:200]}
    pub = publicacao_do_objeto(cab, md5)
    resultado = "conferida" if pub else "nao_conferida"
    anterior = vintage.get("publicado_em")
    if pub != anterior:
        con.execute("UPDATE vintages SET publicado_em=? WHERE vintage_id=?", (pub, vintage["vintage_id"]))
    base.grava_registros(con, DS_CONTROLE, vintage["vintage_id"], [
        (chave, "resultado", resultado), (chave, "publicado_em", pub or ""), (chave, "publicado_em_anterior", anterior or ""),
        (chave, "last_modified_s3", cab.get("last_modified") or ""), (chave, "etag", cab.get("etag") or ""), (chave, "md5", md5),
        (chave, "conferido_em", agora or base.agora_utc())])
    con.commit()
    return {"resultado": resultado, "publicado_em": pub, "anterior": anterior}


def _publicacao_antes_do_download(url, last_modified_ckan):
    """Data passada à política de recoleta: o Last-Modified do S3 (o mesmo que a vintage
    vai guardar depois de conferida); sem resposta do HEAD, o last_modified do CKAN."""
    if url.startswith(S3_ONS):
        try:
            return instante_http(cabecalhos_s3(url).get("last_modified")) or last_modified_ckan
        except Exception:
            return last_modified_ckan
    return last_modified_ckan


def _importa_semihorario(con, vintage):
    linhas = ckan.le_csv_bronze(vintage["arquivo"], encoding="utf-8-sig", separador=";")
    obs, rel = ons_pld.parse_cmo_semihorario(linhas)
    novas, revs = base.grava_observacoes(con, DS_SH, vintage["vintage_id"], obs)
    rel.update(novas=novas, revisoes=revs)
    _marca_importado(con, vintage["vintage_id"], rel)
    con.commit()
    return rel


def _texto_bronze(caminho_relativo):
    with base.abre_bronze(caminho_relativo) as f:
        return f.read().decode("utf-8-sig", errors="replace")


def _importa_semanal_original(con, v_csv, v_parquet):
    """Relê o CMO semanal original (CSV e, quando houver, o Parquet oficial equivalente) e
    grava: as observações do CSV (séries cmo_*_original.{SM}) e, em registros, as formas
    textuais dos zeros e a conferência célula a célula entre CSV e Parquet."""
    linhas = ons_pld.parse_cmo_semanal_original(_texto_bronze(v_csv["arquivo"]))
    obs, zeros_tok, todas_zero = [], set(), 0
    nomes = {"val_cmomediasemanal": "cmo_semanal_original", "val_cmoleve": "cmo_leve_original",
             "val_cmomedia": "cmo_media_original", "val_cmopesada": "cmo_pesada_original"}
    for sm, semana, campos in linhas:
        valores = []
        for campo, (tok, v) in campos.items():
            obs.append((f"{nomes[campo]}.{sm}", semana, v))
            valores.append(v)
            if v == 0:
                zeros_tok.add(tok)
        if valores and all(v == 0 for v in valores):
            todas_zero += 1
    novas, revs = base.grava_observacoes(con, DS_A02, v_csv["vintage_id"], obs)
    rel = {"linhas": len(linhas), "linhas_todas_zero": todas_zero, "formas_do_zero": sorted(zeros_tok),
           "novas": novas, "revisoes": revs}
    regs = [(v_csv["recurso"], "linhas", len(linhas)), (v_csv["recurso"], "linhas_todas_zero", todas_zero),
            (v_csv["recurso"], "formas_do_zero", json.dumps(sorted(zeros_tok), ensure_ascii=False)),
            (v_csv["recurso"], "sha256", v_csv["sha256"])]
    if v_parquet:
        try:
            with base.abre_bronze(v_parquet["arquivo"]) as f:
                pq = ons_pld.parse_cmo_semanal_parquet(io.BytesIO(f.read()))
            por_chave = {(sm, s): cp for sm, s, cp in pq}
            iguais = total = 0
            for sm, semana, campos in linhas:
                cp = por_chave.get((sm, semana), {})
                for campo, (_, v) in campos.items():
                    total += 1
                    w = (cp.get(campo) or ("", None))[1]
                    if (v is None and w is None) or (v is not None and w is not None and abs(v - w) <= 1e-9):
                        iguais += 1
            rel.update(parquet_linhas=len(pq), parquet_celulas_iguais=iguais, parquet_celulas=total)
            regs += [(v_csv["recurso"], "parquet_linhas", len(pq)), (v_csv["recurso"], "parquet_celulas_iguais", iguais),
                     (v_csv["recurso"], "parquet_celulas", total), (v_csv["recurso"], "parquet_sha256", v_parquet["sha256"])]
        except Exception as e:  # Parquet ilegível não invalida o CSV; fica registrado
            rel["parquet_erro"] = str(e)[:200]
            regs.append((v_csv["recurso"], "parquet_erro", str(e)[:200]))
    base.grava_registros(con, DS_A02, v_csv["vintage_id"], regs)
    chave = v_csv["vintage_id"] + ("|" + v_parquet["vintage_id"] if v_parquet else "")
    _marca_importado(con, v_csv["vintage_id"], rel, chave=chave)
    con.commit()
    return rel


def _versoes_pdf(caminho_relativo):
    """Versões declaradas no PDF do dicionário ("Versão 1.2 02-05-2023 ..."), lidas com o
    pdftotext quando instalado. Sem a ferramenta, devolve None e a gold diz isso."""
    exe = shutil.which("pdftotext")
    if not exe:
        return None
    import re
    fd, tmp = tempfile.mkstemp(suffix=".pdf")
    os.close(fd)
    try:
        with base.abre_bronze(caminho_relativo) as f, open(tmp, "wb") as g:
            g.write(f.read())
        txt = subprocess.run([exe, "-layout", tmp, "-"], capture_output=True, text=True, timeout=60).stdout
    finally:
        os.remove(tmp)
    versoes = [{"versao": v, "data": d, "descricao": " ".join(t.split())[:300]}
               for v, d, t in re.findall(r"Versão\s+(\d+\.\d+)\s+(\d{2}-\d{2}-\d{4})\s+(.*?)(?=\n\s*Versão\s|\Z)", txt, flags=re.S)]
    datas = re.findall(r"Data:\s*(\d{2}-\d{2}-\d{4})", txt)
    return {"versoes": versoes, "data_documento": datas[0] if datas else None, "permissoes": permissoes_do_dicionario(txt)}


def permissoes_do_dicionario(txt):
    """Colunas "Permite valor nulo / zerado / negativo" da tabela do dicionário em PDF do
    ONS (texto do pdftotext -layout), por campo numérico: {codigo: {nulo, zerado, negativo}}.
    Relevante para o achado A02: o dicionário declara se zero é valor admitido."""
    import re
    out = {}
    for cod, nulo, zero, neg in re.findall(r"\b(val_\w+)\s+FLOAT\s+(?:\S+\s+)?(Sim|Não)\s+(Sim|Não)\s+(Sim|Não)", txt or ""):
        out[cod] = {"nulo": nulo == "Sim", "zerado": zero == "Sim", "negativo": neg == "Sim"}
    return out


def _importa_dicionario(con, vintage, conjunto):
    regs = []
    if vintage["recurso"].endswith("_json"):
        dic = ons_pld.parse_dicionario_json(_texto_bronze(vintage["arquivo"]))
        for campo in dic["campos"]:
            chave = f"{conjunto}:{campo['codigo']}"
            regs += [(chave, "descricao", campo["descricao"]), (chave, "unidade", campo["unidade"])]
        rel = {"campos": len(dic["campos"])}
    else:
        info = _versoes_pdf(vintage["arquivo"])
        chave = f"{conjunto}:pdf"
        regs += [(chave, "sha256", vintage["sha256"]),
                 (chave, "versoes", json.dumps(info["versoes"], ensure_ascii=False) if info else None),
                 (chave, "data_documento", info["data_documento"] if info else None),
                 (chave, "permissoes", json.dumps(info["permissoes"], ensure_ascii=False) if info else None)]
        rel = {"versoes": len(info["versoes"]) if info else None}
    base.grava_registros(con, DS_DIC, vintage["vintage_id"], regs)
    _marca_importado(con, vintage["vintage_id"], rel)
    con.commit()
    return rel


def _importa_norma(con, vintage, doc_id):
    """Extrai o texto do ato baixado e confere cada passagem citada (fontes/normas_pld.py).
    Grava em `registros` a passagem, o dispositivo e o resultado da conferência, atrelados
    à vintage do documento: a gold só cita o que conferiu nesta versão do arquivo."""
    with base.abre_bronze(vintage["arquivo"]) as f:
        bruto = f.read()
    ext = normas_pld.DOCUMENTOS[doc_id]["ext"]
    texto = normas_pld.texto_html(bruto) if ext == "html" else normas_pld.texto_pdf(bruto)
    trechos = normas_pld.confere_trechos(doc_id, texto)
    regs = [(doc_id, "sha256", vintage["sha256"]), (doc_id, "caracteres_extraidos", len(texto) if texto else 0),
            (doc_id, "extracao", "html" if ext == "html" else ("pdftotext" if texto is not None else "pdftotext ausente"))]
    for tid, disp, passagem, ok in trechos:
        regs += [(tid, "documento", doc_id), (tid, "dispositivo", disp), (tid, "texto", passagem), (tid, "confere", int(ok))]
    base.grava_registros(con, DS_NORMAS, vintage["vintage_id"], regs)
    rel = {"trechos": len(trechos), "conferidos": sum(1 for *_, ok in trechos if ok)}
    _marca_importado(con, vintage["vintage_id"], rel)
    con.commit()
    return rel


def coletar(con, ctx):
    """Coleta do módulo. Nunca lança por falha de fonte: cada falha vira registro em
    `coletas` e item em `falhas`; a gold anterior fica no ar pela sentinela."""
    hoje = ctx.get("hoje") or date.today()
    status = {"ok": True, "falhas": [], "semihorario": {}, "semanal_original": {}, "dicionarios": {}, "ipca": None}

    def falha(msg):
        status["falhas"].append(str(msg)[:300])

    # 1. CMO semi-horário (DESSEM): CSV anual oficial. O Parquet equivalente existe, mas o CSV
    # é o formato de referência do ONS e o mesmo lido pelos demais coletores do projeto.
    pac_sh = pac_sem = None
    try:
        pac_sh = ckan.pacote("ONS", PACOTE_SH)
        base.escreve_gold(f"_meta_{DS_SH}.json", ckan.metadados(pac_sh, "ONS"), destino=META_DIR)
    except Exception as e:
        base.registra_coleta(con, DS_SH, "*", False, f"package_show: {e}")
        falha(f"{PACOTE_SH} package_show: {e}")
    if pac_sh:
        for ano, r in sorted(_recursos(pac_sh, "CMO_SEMIHORARIO_", "CSV").items()):
            recurso = f"CMO_SEMIHORARIO_{ano}"
            res = ckan.baixar_recurso(con, orgao="ONS", dataset=DS_SH, recurso=recurso, url=r["url"],
                                      publicado_em=_publicacao_antes_do_download(r["url"], r.get("last_modified")), ext="csv",
                                      max_idade_dias=_max_idade(ano, hoje))
            status["semihorario"][recurso] = res["status"]
            if res["status"] == "falha":
                falha(f"{recurso}: {res['detalhe']}")
    for rec, v in ckan.vintages_vigentes(con, DS_SH).items():
        if not _importado(con, v["vintage_id"]):
            try:
                status["semihorario"][rec + ":importacao"] = _importa_semihorario(con, v)
            except Exception as e:  # arquivo do bronze ausente ou formato novo: registrado
                base.registra_coleta(con, DS_SH, rec, False, f"importação: {e}")
                falha(f"{rec} importação: {e}")

    # 2. CMO semanal original (DECOMP), CSV e Parquet de todos os anos: releitura independente
    try:
        pac_sem = ckan.pacote("ONS", PACOTE_SEM)
        base.escreve_gold(f"_meta_{DS_A02}.json", ckan.metadados(pac_sem, "ONS"), destino=META_DIR)
    except Exception as e:
        base.registra_coleta(con, DS_A02, "*", False, f"package_show: {e}")
        falha(f"{PACOTE_SEM} package_show: {e}")
    if pac_sem:
        csvs = _recursos(pac_sem, "CMO_SEMANAL_", "CSV")
        pqs = _recursos(pac_sem, "CMO_SEMANAL_", "PARQUET")
        for ano in sorted(csvs):
            for fmt, recs, ext in (("csv", csvs, "csv"), ("parquet", pqs, "parquet")):
                r = recs.get(ano)
                if not r:
                    continue
                recurso = f"CMO_SEMANAL_{ano}" + ("" if fmt == "csv" else "_parquet")
                res = ckan.baixar_recurso(con, orgao="ONS", dataset=DS_A02, recurso=recurso, url=r["url"],
                                          publicado_em=_publicacao_antes_do_download(
                                              r["url"], r.get("last_modified") or r.get("metadata_modified")),
                                          ext=ext, max_idade_dias=_max_idade(ano, hoje))
                status["semanal_original"][recurso] = res["status"]
                if res["status"] == "falha":
                    falha(f"{recurso}: {res['detalhe']}")
    vig = ckan.vintages_vigentes(con, DS_A02)
    for rec, v in vig.items():
        if rec.endswith("_parquet"):
            continue
        vp = vig.get(rec + "_parquet")
        chave = v["vintage_id"] + ("|" + vp["vintage_id"] if vp else "")
        if not _importado(con, chave):
            try:
                status["semanal_original"][rec + ":importacao"] = _importa_semanal_original(con, v, vp)
            except Exception as e:
                base.registra_coleta(con, DS_A02, rec, False, f"importação: {e}")
                falha(f"{rec} importação: {e}")

    # 3. Dicionários de dados (JSON e PDF) dos dois conjuntos
    for pac, conjunto, prefixo in ((pac_sh, "cmo_semi_horario", "DicionarioDados_Cmo_Semi_Horario"),
                                   (pac_sem, "cmo_semanal", "DicionarioDados_Cmo_Semanal")):
        if not pac:
            continue
        for r in pac.get("resources", []):
            nome = (r.get("url") or "").rsplit("/", 1)[-1]
            fmt = (r.get("format") or "").upper()
            if not nome.startswith(prefixo) or fmt not in ("JSON", "PDF"):
                continue
            recurso = f"{prefixo}_{fmt.lower()}"
            res = ckan.baixar_recurso(con, orgao="ONS", dataset=DS_DIC, recurso=recurso, url=r["url"],
                                      publicado_em=_publicacao_antes_do_download(r["url"], r.get("last_modified")),
                                      ext=fmt.lower(), max_idade_dias=7)
            status["dicionarios"][recurso] = res["status"]
            if res["status"] == "falha":
                falha(f"{recurso}: {res['detalhe']}")
    regs_dic = base.registros_como_estavam_em(con, DS_DIC)
    for rec, v in ckan.vintages_vigentes(con, DS_DIC).items():
        conj = "cmo_semi_horario" if "Semi_Horario" in rec else "cmo_semanal"
        # PDF importado antes da leitura das permissões (zero, nulo, negativo): relê do bronze
        sem_permissoes = rec.endswith("_pdf") and "permissoes" not in regs_dic.get(f"{conj}:pdf", {})
        if not _importado(con, v["vintage_id"]) or sem_permissoes:
            conjunto = "cmo_semi_horario" if "Semi_Horario" in rec else "cmo_semanal"
            try:
                status["dicionarios"][rec + ":importacao"] = _importa_dicionario(con, v, conjunto)
            except Exception as e:
                base.registra_coleta(con, DS_DIC, rec, False, f"importação: {e}")
                falha(f"{rec} importação: {e}")

    # 4. IPCA (IBGE, SIDRA): fonte fora do CKAN; mesmo padrão de bronze e vintage
    res = ckan.baixar_recurso(con, orgao="IBGE", dataset=DS_IPCA, recurso="ipca_numero_indice", url=ibge_pld.URL_SIDRA,
                              publicado_em=None, ext="json", max_idade_dias=1)
    status["ipca"] = res["status"]
    if res["status"] == "falha":
        falha(f"IPCA: {res['detalhe']}")
    v = ckan.vintages_vigentes(con, DS_IPCA).get("ipca_numero_indice")
    if v and not _importado(con, v["vintage_id"]):
        try:
            obs = ibge_pld.parse_ipca_sidra(_texto_bronze(v["arquivo"]))
            novas, revs = base.grava_observacoes(con, DS_IPCA, v["vintage_id"], obs)
            _marca_importado(con, v["vintage_id"], {"observacoes": len(obs), "novas": novas, "revisoes": revs})
            con.commit()
        except Exception as e:
            base.registra_coleta(con, DS_IPCA, "ipca_numero_indice", False, f"importação: {e}")
            falha(f"IPCA importação: {e}")
    # 5. Textos normativos do P008 (fora do CKAN): bronze com sha256, vintage e conferência
    status["normas"] = {}
    for doc_id, doc in normas_pld.DOCUMENTOS.items():
        orgao = {"ONS": "ONS", "ANEEL": "ANEEL", "CEPEL": "CEPEL"}.get(doc["orgao"], "camara-dos-deputados")
        res = ckan.baixar_recurso(con, orgao=orgao, dataset=DS_NORMAS, recurso=doc_id, url=doc["url"], publicado_em=None,
                                  ext=doc["ext"], max_idade_dias=30)
        status["normas"][doc_id] = res["status"]
        if res["status"] == "falha":
            falha(f"{doc_id}: {res['detalhe']}")
    for rec, v in ckan.vintages_vigentes(con, DS_NORMAS).items():
        if rec in normas_pld.DOCUMENTOS and not _importado(con, v["vintage_id"]):
            try:
                status["normas"][rec + ":importacao"] = _importa_norma(con, v, rec)
            except Exception as e:
                base.registra_coleta(con, DS_NORMAS, rec, False, f"importação: {e}")
                falha(f"{rec} importação: {e}")
    # 6. Manuais dos modelos (CEPEL): o do DESSEM entra com as normas (passo 5); os do DECOMP
    # e do NEWAVE são procurados na lista pública de arquivos do site a cada coleta, e o
    # resultado fica em `coletas` (evidência citada na gold)
    status["cepel"] = busca_manuais_cepel(con)

    # 7. Balanço de energia do ONS (carga horária): cópia própria do arquivo anual, relida por
    # leitor independente só para reconciliar a média ponderada das fichas de evidência
    status["balanco_conferencia"] = {}
    try:
        pac_bal = ckan.pacote("ONS", PACOTE_BAL)
    except Exception as e:
        pac_bal = None
        base.registra_coleta(con, DS_BAL_CONF, "*", False, f"package_show: {e}")
        falha(f"{PACOTE_BAL} package_show: {e}")
    if pac_bal:
        for ano, r in sorted(_recursos(pac_bal, "BALANCO_ENERGIA_SUBSISTEMA_", "CSV").items()):
            if ano < hoje.year - 1:
                continue
            recurso = f"BALANCO_ENERGIA_SUBSISTEMA_{ano}"
            res = ckan.baixar_recurso(con, orgao="ONS", dataset=DS_BAL_CONF, recurso=recurso, url=r["url"],
                                      publicado_em=_publicacao_antes_do_download(r["url"], r.get("last_modified")), ext="csv",
                                      max_idade_dias=_max_idade(ano, hoje))
            status["balanco_conferencia"][recurso] = res["status"]
            if res["status"] == "falha":
                falha(f"{recurso}: {res['detalhe']}")

    # 8. Data de publicação de cada arquivo vigente do S3 do ONS conferida pelo ETag
    status["publicacao_s3"] = {}
    for ds in (DS_SH, DS_A02, DS_DIC, DS_BAL_CONF):
        for rec, v in ckan.vintages_vigentes(con, ds).items():
            r_ = confere_publicacao_s3(con, v)
            status["publicacao_s3"][f"{ds}:{rec}"] = r_["resultado"]
    con.commit()
    status["ok"] = not status["falhas"]
    return status


MODELOS_SEM_MANUAL = ("DECOMP", "NEWAVE")


def busca_manuais_cepel(con, termos=MODELOS_SEM_MANUAL):
    """Procura PDFs com o nome do modelo na lista pública de arquivos do site do CEPEL
    (API do WordPress do próprio site, a mesma que a busca do site usa). O resultado vai
    para `coletas` (recurso 'cepel_<modelo>'): quantos PDFs e quais. Nada é contornado."""
    out = {}
    for termo in termos:
        url = normas_pld.URL_CEPEL_MIDIA.format(termo=termo)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                itens = json.loads(resp.read().decode("utf-8"))
            pdfs = [x.get("source_url") for x in itens if str(x.get("source_url") or "").lower().endswith(".pdf")]
            detalhe, ok = f"{len(pdfs)} PDFs com '{termo}' na lista pública de arquivos" + (f": {'; '.join(pdfs[:5])}" if pdfs else ""), True
        except urllib.error.HTTPError as e:
            detalhe, ok = f"HTTP {e.code} na lista pública de arquivos", False
        except Exception as e:  # sem rede: registrado como falha de acesso
            detalhe, ok = f"{type(e).__name__}: {str(e)[:150]}", False
        base.registra_coleta(con, DS_NORMAS, f"cepel_{termo.lower()}", ok, f"{url} {detalhe}")
        out[termo] = detalhe
    con.commit()
    return out



# ---------------------------------------------------------------------------
# Cálculos (funções puras; testes em pipeline/tests/test_energia_pld.py)
# ---------------------------------------------------------------------------

def cmo_horario(meias):
    """{'AAAA-MM-DDTHH:MM': CMO da meia hora} → {'AAAA-MM-DDTHH:00': CMO da hora}.

    O instante do ONS marca o início da meia hora. A hora h recebe a média das meias horas
    que começam em h:00 e h:30; como as duas duram 30 minutos, a média simples é a média
    ponderada pela duração. Hora com uma só meia hora publicada fica sem valor: ausência
    não é completada nem repetida."""
    out = {}
    for ref, v in meias.items():
        if ref.endswith(":00"):
            outra = meias.get(ref[:14] + "30")
            if outra is not None:
                out[ref] = (v + outra) / 2
    return out


def fim_da_semana_operativa(dia):
    """Sexta-feira que encerra a semana operativa (sábado a sexta) que contém `dia`.
    O ONS data o CMO semanal pela sexta-feira final (conferido contra o DESSEM)."""
    return dia + timedelta(days=(4 - dia.weekday()) % 7)


CAMPOS_LIMITE = ("pld_min", "pld_max_horario", "pld_max_estrutural")


def _data_iso(v):
    try:
        return date.fromisoformat(str(v)[:10]).isoformat() if v else None
    except ValueError:
        return None


def _valor_limite(v):
    if v is None or v == "":
        return None, True
    if isinstance(v, bool):
        return None, False
    if isinstance(v, (int, float)):
        return float(v), math.isfinite(float(v))
    x, ok = ons_pld.numero_ons(v)
    return x, ok


def normaliza_atos(dado):
    """Atos anuais de limites do PLD no esquema do módulo Regulação ({conferido_em,
    atos: [...]}) → (atos válidos, rejeitados com motivo). Ato sem vigência, sem
    identificação, com unidade que não seja R$/MWh ou com mínimo acima de máximo é
    rejeitado e listado: nada de adivinhar o que o ato quis dizer."""
    atos = dado.get("atos") if isinstance(dado, dict) else dado
    validos, rejeitados = [], []
    for a in atos or []:
        if not isinstance(a, dict):
            rejeitados.append({"ato": None, "motivo": "registro não é objeto"})
            continue
        motivo = None
        ini, fim = _data_iso(a.get("vigencia_inicio")), _data_iso(a.get("vigencia_fim"))
        vals = {}
        for campo in CAMPOS_LIMITE:
            x, ok = _valor_limite(a.get(campo))
            if not ok:
                motivo = f"{campo} não numérico"
            vals[campo] = x
        if not ini:
            motivo = "vigencia_inicio ausente ou inválida"
        elif a.get("vigencia_fim") not in (None, "") and not fim:
            motivo = "vigencia_fim inválida"
        elif fim and fim < ini:
            motivo = "vigencia_fim anterior ao início"
        elif not a.get("ato") or not a.get("url"):
            motivo = "ato sem identificação ou sem URL"
        elif "MWh" not in str(a.get("unidade") or ""):
            motivo = f"unidade {a.get('unidade')!r} diferente de R$/MWh"
        elif all(v is None for v in vals.values()):
            motivo = "nenhum limite informado"
        elif any(v is not None and v < 0 for v in vals.values()):
            motivo = "limite negativo"
        elif vals["pld_min"] is not None and any(vals[k] is not None and vals[k] < vals["pld_min"]
                                                  for k in ("pld_max_horario", "pld_max_estrutural")):
            motivo = "limite mínimo acima de um máximo"
        if motivo:
            rejeitados.append({"ato": a.get("ato"), "motivo": motivo})
            continue
        validos.append({**{k: a.get(k) for k in ("ano", "ato", "data_publicacao", "dispositivo", "url", "trecho",
                                                  "altera_ou_revoga", "unidade")},
                        "vigencia_inicio": ini, "vigencia_fim": fim, **vals})
    return validos, rejeitados


def limites_vigentes(atos, dia):
    """Limites vigentes em `dia` (ISO), campo a campo: vale o ato em vigor no dia que
    informa aquele campo e tem a publicação mais recente. Assim um ato posterior que
    altera só o teto prevalece no teto e o mínimo continua o do ato anterior, com o ato
    de origem de cada campo registrado. Dois atos com a mesma data e valores diferentes
    para o mesmo campo são conflito: o campo fica sem valor e o conflito é declarado."""
    out = {}
    for campo in CAMPOS_LIMITE:
        cands = [a for a in atos if a[campo] is not None and a["vigencia_inicio"] <= dia <= (a["vigencia_fim"] or "9999-12-31")]
        if not cands:
            out[campo], out[f"ato_{campo}"] = None, None
            continue
        chave = lambda a: (a.get("data_publicacao") or "", a["vigencia_inicio"])  # noqa: E731
        topo = max(cands, key=chave)
        rivais = {a[campo] for a in cands if chave(a) == chave(topo)}
        if len(rivais) > 1:
            out[campo], out[f"ato_{campo}"] = None, "conflito: " + "; ".join(sorted(a["ato"] for a in cands if chave(a) == chave(topo)))
        else:
            out[campo], out[f"ato_{campo}"] = topo[campo], topo["ato"]
    return out


def situacao_hora(valor, lim, tol=TOL_HORA):
    """Posição do PLD da hora em relação aos limites vigentes: 'piso', 'teto_horario',
    'entre', 'abaixo_do_piso' ou 'acima_do_teto' (controles: não deveriam ocorrer) ou
    'sem_limite' quando algum limite do dia não está disponível. Na hora, "no limite" é
    igualdade ao centavo (TOL_HORA); `tol=TOL_SENS` dá a contagem de sensibilidade."""
    if valor is None:
        return None
    mn, mh = lim.get("pld_min"), lim.get("pld_max_horario")
    if mn is not None and abs(valor - mn) <= tol + EPS:
        return "piso"
    if mh is not None and abs(valor - mh) <= tol + EPS:
        return "teto_horario"
    if mn is not None and valor < mn:
        return "abaixo_do_piso"
    if mh is not None and valor > mh:
        return "acima_do_teto"
    if mn is None or mh is None:
        return "sem_limite"
    return "entre"


def a_um_centavo(valor, lim):
    """'piso' ou 'teto_horario' quando o PLD da hora está exatamente um centavo do limite
    (acima do piso ou abaixo do teto): preço diferente do limite, contado à parte."""
    if valor is None:
        return None
    for campo, nome in (("pld_min", "piso"), ("pld_max_horario", "teto_horario")):
        x = lim.get(campo)
        if x is not None and MEIO_CENTAVO + EPS < abs(valor - x) <= TOL + EPS:
            return nome
    return None


def situacao_dia_estrutural(media_dia, lim, tol=TOL):
    """'no_teto', 'abaixo' ou 'acima' (controle) para a média diária frente ao teto
    estrutural; None sem média ou sem teto vigente."""
    me = lim.get("pld_max_estrutural")
    if media_dia is None or me is None:
        return None
    if abs(media_dia - me) <= tol + EPS:
        return "no_teto"
    return "acima" if media_dia > me else "abaixo"


QUANTIS = (("p10", 0.10), ("p25", 0.25), ("p50", 0.50), ("p75", 0.75), ("p90", 0.90))


def resumo_quantis(xs, casas=2):
    xs = [x for x in xs if x is not None]
    return {"n": len(xs), **{k: c.r(c.quantil(xs, q), casas) if xs else None for k, q in QUANTIS}}


def separado(a, b, tol=TOL):
    return abs(a - b) > tol + EPS


def sentido_fluxo(pld_a, pld_b, fluxo_ab, tol=TOL, nulo=FLUXO_NULO):
    """Leitura descritiva da hora numa fronteira (a, b) em orientação canônica (fluxo
    positivo = de a para b): 'sem_separacao', 'nulo', 'do_menor_para_o_maior' ou
    'do_maior_para_o_menor' preço. Não é diagnóstico de congestionamento: os limites de
    intercâmbio não estão integrados."""
    if not separado(pld_a, pld_b, tol):
        return "sem_separacao"
    if abs(fluxo_ab) <= nulo:
        return "nulo"
    return "do_menor_para_o_maior" if (pld_a < pld_b) == (fluxo_ab > 0) else "do_maior_para_o_menor"


def sequencias_zero(pontos, minimo=4, passo_dias=7):
    """[(data ISO, valor)] ordenado → sequências de valor exatamente 0 com pelo menos
    `minimo` registros consecutivos no passo esperado (semana a semana). Semana ausente
    interrompe a sequência: ausência não é zero."""
    out, atual, ant = [], [], None
    for ref, v in pontos:
        dia = date.fromisoformat(ref[:10])
        continua = ant is not None and (dia - ant).days == passo_dias
        if v == 0 and (continua or not atual):
            atual.append(ref)
        elif v == 0:
            if len(atual) >= minimo:
                out.append({"inicio": atual[0], "fim": atual[-1], "semanas": len(atual)})
            atual = [ref]
        else:
            if len(atual) >= minimo:
                out.append({"inicio": atual[0], "fim": atual[-1], "semanas": len(atual)})
            atual = []
        ant = dia
    if len(atual) >= minimo:
        out.append({"inicio": atual[0], "fim": atual[-1], "semanas": len(atual)})
    return out


def media_ponderada(pares):
    """[(preço, peso)] → Σ preço × peso ÷ Σ peso; None sem peso positivo. Quem chama passa
    só pesos fisicamente válidos (pesos_validos): aqui não se descarta nada em silêncio."""
    pares = [(p, w) for p, w in pares if p is not None and w is not None]
    soma_w = sum(w for _, w in pares)
    if not pares or soma_w <= 0:
        return None
    return sum(p * w for p, w in pares) / soma_w


def pesos_validos(itens):
    """Controle físico do peso da média ponderada: [(chave, preço, carga)] → (válidos,
    retirados). A carga de um subsistema numa hora é energia consumida e não pode ser zero
    nem negativa; o ONS já publicou carga negativa (Nordeste, 26/09/2026, captura de
    29/09/2026, revista no dia seguinte). Hora com carga ≤ 0 sai do peso e é listada:
    vira ressalva visível, nunca correção silenciosa. Carga ausente (None) não entra em
    nenhuma das listas: é ausência, contada à parte por quem chama."""
    validos, retirados = [], []
    for k, p, w in itens:
        if p is None or w is None:
            continue
        (validos if w > 0 else retirados).append((k, p, w))
    return validos, retirados


def magnitude_revisoes(historicos):
    """{ref: [(capturado_em, valor), ...]} (ordem de captura) → magnitude e alcance das
    revisões: horas revisadas, maior e média variação absoluta entre o primeiro e o último
    valor, maior variação relativa (sobre o módulo do primeiro valor, quando não é zero) e
    horas em que o sinal mudou. Só entram refs com mais de um valor distinto."""
    difs, rels, troca_sinal, caps = [], [], 0, set()
    for ref, hist in historicos.items():
        valores = [v for _, v in hist]
        if len(set(valores)) < 2:
            continue
        a, b = valores[0], valores[-1]
        difs.append((ref, b - a))
        if a != 0:
            rels.append(abs(b - a) / abs(a))
        troca_sinal += (a > 0) != (b > 0)
        caps.update(cap for cap, _ in hist)
    if not difs:
        return {"horas_revisadas": 0}
    maior = max(difs, key=lambda x: abs(x[1]))
    return {"horas_revisadas": len(difs), "max_abs": abs(maior[1]), "quando_max": maior[0],
            "media_abs": sum(abs(x) for _, x in difs) / len(difs), "max_rel": max(rels) if rels else None,
            "horas_com_troca_de_sinal": troca_sinal, "capturas": sorted(caps)}


# Leitores independentes dos arquivos originais (fichas de evidência). Não usam os parsers
# que alimentam o silver (fontes/ccee.py, fontes/ons.py, fontes/ons_pld.py): servem para
# refazer o número a partir do arquivo publicado pela fonte, por outro código.

SUBMERCADO_CCEE = {"SUDESTE": "SE", "SUL": "S", "NORDESTE": "NE", "NORTE": "N"}


def _linhas_csv(texto_ou_linhas):
    if isinstance(texto_ou_linhas, str):
        return csv.reader(io.StringIO(texto_ou_linhas), delimiter=";")
    return texto_ou_linhas


def releitura_pld(linhas):
    """Linhas do CSV PLD_HORARIO da CCEE (cabeçalho na primeira) → {sm: {hora: valor}}."""
    it = iter(_linhas_csv(linhas))
    cab = [x.strip().strip('"').lstrip("\ufeff").upper() for x in next(it)]
    i = {k: cab.index(k) for k in ("MES_REFERENCIA", "SUBMERCADO", "DIA", "HORA", "PLD_HORA")}
    out = defaultdict(dict)
    for row in it:
        if len(row) < len(cab):
            continue
        g = [x.strip().strip('"') for x in row]
        sm = SUBMERCADO_CCEE.get(g[i["SUBMERCADO"]].upper())
        if not sm or not g[i["PLD_HORA"]]:
            continue
        mes = g[i["MES_REFERENCIA"]]
        out[sm][f"{mes[:4]}-{mes[4:6]}-{int(g[i['DIA']]):02d}T{int(g[i['HORA']]):02d}:00"] = float(g[i["PLD_HORA"]])
    return dict(out)


def releitura_ons(linhas, campo, sm, inicio, fim):
    """Linhas de um CSV do ONS com id_subsistema;...;din_instante;...;<campo> → {instante
    'AAAA-MM-DDTHH:MM': valor} do subsistema `sm` entre `inicio` e `fim` (inclusive)."""
    it = iter(_linhas_csv(linhas))
    cab = [x.strip().lstrip("\ufeff") for x in next(it)]
    i_sm, i_t, i_v = cab.index("id_subsistema"), cab.index("din_instante"), cab.index(campo)
    out = {}
    for row in it:
        if len(row) <= max(i_sm, i_t, i_v) or row[i_sm].strip() != sm:
            continue
        t = row[i_t].strip()[:16].replace(" ", "T")
        if inicio <= t <= fim and row[i_v].strip():
            out[t] = float(row[i_v])
    return out


def momento_do_calculo(ids_conferidos):
    """Momento de cálculo e versão dos produtos do ONS, montados só com passagens dos
    Procedimentos de Rede conferidas no documento baixado (ids de normas_pld.TRECHOS).
    Sem as passagens, o campo fica None e o motivo é publicado."""
    ids = set(ids_conferidos)
    dec = dessem = versao = None
    if {"pr43_cmo_semanal", "pr43_prazo_sexta", "pr24_cmo_semanal"} <= ids:
        dec = ("Calculado pelo ONS na elaboração do PMO e de cada revisão semanal: o modelo de curto prazo (DECOMP) calcula o "
               "CMO médio semanal por subsistema e patamar de carga para cada semana operativa; os resultados são esperados até "
               "as 12h00 de sexta-feira e, sem eles, valem os resultados válidos mais recentes (Procedimentos de Rede, Submódulo "
               "2.4, item 2.4.3.1; Submódulo 4.3, itens 1.4.1 e 1.5.2).")
    if {"pr24_execucao_d1", "pr24_48_intervalos", "pr24_cmo_semi_horario"} <= ids:
        dessem = ("Calculado pelo ONS na véspera (D-1) para o dia D: o modelo de curtíssimo prazo é executado diariamente em D-1, "
                  "com horizonte até o fim da semana operativa, e o dia D é detalhado em 48 intervalos semi-horários (Procedimentos "
                  "de Rede, Submódulo 2.4, itens 2.5.1.1 a 2.5.1.3)")
        if {"pr45_prazo_16h", "pr45_envio_ccee"} <= ids:
            dessem += ("; os resultados devem estar prontos até as 16h00 de D-1 e o deck e os resultados são encaminhados à CCEE "
                       "(Submódulo 4.5, itens 2.3.3 e 2.4.1)")
        if "dessem_uso_ons_ccee" in ids:
            dessem += ("; o mesmo modelo é usado oficialmente pelo ONS desde janeiro de 2020 e pela CCEE desde janeiro de 2021 para o "
                       "preço horário do dia seguinte (Manual de Metodologia do DESSEM, CEPEL, seção 1)")
        dessem += "."
    if "pr43_versoes_modelos" in ids:
        versao = ("As versões dos modelos usados pelo ONS são as validadas com os agentes e homologadas pela ANEEL por ato "
                  "específico (Procedimentos de Rede, Submódulo 4.3, item 1.7.1.3); o conjunto de dados não identifica a versão "
                  "nem o deck de cada valor.")
    return {"decomp_semanal": dec, "dessem_semi_horario": dessem, "versao": versao}


def pagina_do_trecho(texto_paginas, trecho):
    """Número da página (1 em diante) do texto extraído por página onde todas as partes do
    trecho aparecem; None quando nenhuma página contém o trecho inteiro."""
    for i, pag in enumerate(texto_paginas, start=1):
        if normas_pld.confere(trecho, normas_pld.normaliza(pag)):
            return i
    return None


def deflaciona(valor, indice_mes, indice_base):
    """Valor nominal do mês → reais do mês-base: valor × I(base) ÷ I(mês)."""
    if valor is None or not indice_mes or not indice_base:
        return None
    return valor * indice_base / indice_mes


def mes_parcial(mes, dias_completos):
    import calendar
    return dias_completos < calendar.monthrange(int(mes[:4]), int(mes[5:7]))[1]


# ---------------------------------------------------------------------------
# Limites regulatórios (módulo Regulação)
# ---------------------------------------------------------------------------

ARQUIVO_LIMITES = os.path.join(base.RAIZ, "pipeline", "energia", "regulatorio", "limites_pld.json")


def carrega_limites(ctx=None):
    """(dado, origem, motivo). Consome pipeline.energia.regulatorio.limites_pld(), escrita
    pelo módulo Regulação a partir dos atos anuais da ANEEL. Se o pacote existir sem a
    função, lê o arquivo que ela leria (mesmo esquema). Ausência nunca é suprida pelo
    menor valor observado do PLD."""
    if ctx and "limites_pld" in ctx:  # injeção nos testes (None simula a ausência do arquivo)
        if ctx["limites_pld"]:
            return ctx["limites_pld"], "injetado", None
        return None, None, "limites não fornecidos (injeção de teste)"
    try:
        from pipeline.energia import regulatorio  # noqa: F401
        fn = getattr(regulatorio, "limites_pld", None)
    except Exception as e:
        fn, erro = None, f"{type(e).__name__}: {e}"
    else:
        erro = "pacote pipeline.energia.regulatorio sem a função limites_pld()"
    if callable(fn):
        try:
            dado = fn()
            if dado:
                return dado, "pipeline.energia.regulatorio.limites_pld()", None
            return None, None, "limites_pld() não devolveu atos"
        except Exception as e:
            return None, None, f"limites_pld() falhou: {type(e).__name__}: {str(e)[:200]}"
    if os.path.exists(ARQUIVO_LIMITES):
        try:
            with open(ARQUIVO_LIMITES, encoding="utf-8") as f:
                return json.load(f), "pipeline/energia/regulatorio/limites_pld.json (leitura direta)", None
        except Exception as e:
            return None, None, f"limites_pld.json ilegível: {e}"
    return None, None, f"arquivo de limites do módulo Regulação ainda não publicado ({erro})"


NIVEIS_CONFERENCIA = {
    "texto_do_ato": "valores lidos no texto do próprio ato",
    "documento_oficial_do_processo": ("texto integral do ato não acessado; valores lidos em voto ou nota técnica da ANEEL do "
                                      "mesmo processo"),
}


def enriquece_atos(atos, conferencia=None, documentos=None):
    """Acrescenta a cada ato o nível de conferência registrado pelo módulo Regulação
    (limites_pld_conferencia.json) e o documento em que os valores foram lidos
    (documentos.json): sem isso a gold não distingue o ato lido no texto do ato de um
    valor tirado do voto ou da nota técnica. Ato sem registro de conferência fica com
    nível None (não conferido por este caminho)."""
    if conferencia is None or documentos is None:
        try:
            from pipeline.energia import regulatorio
            conferencia = regulatorio.conferencia_limites() if conferencia is None else conferencia
            documentos = regulatorio.documentos() if documentos is None else documentos
        except Exception:  # módulo Regulação sem os arquivos de conferência: declarado por ato
            conferencia, documentos = conferencia or {}, documentos or {}
    por_ato = {(x.get("ano"), x.get("ato")): x for x in (conferencia or {}).get("atos", [])}
    out = []
    for a in atos:
        cf = por_ato.get((a.get("ano"), a.get("ato")), {})
        doc = (documentos or {}).get(cf.get("documento_valores")) or {}
        nivel = cf.get("nivel")
        out.append({**a, "nivel_conferencia": nivel, "nivel_descricao": NIVEIS_CONFERENCIA.get(nivel),
                    "documento_valores": cf.get("documento_valores"), "documento_titulo": doc.get("titulo"),
                    "documento_url": doc.get("url_oficial"), "documento_copia": doc.get("copia_publica"),
                    "documento_sha256": doc.get("sha256"), "dou": cf.get("dou")})
    return out


# ---------------------------------------------------------------------------
# Construção da gold
# ---------------------------------------------------------------------------

SM = c.ORDEM_SM


def _serie(con, ds, serie):
    return dict(base.serie_vigente(con, ds, serie))


def _snap_resumo(snap):
    """Resumo do snapshot. A data de publicação só aparece quando a fonte a informa de modo
    confiável (a do PLD na CCEE não acompanha o conteúdo: achado A09)."""
    caps = snap.get("capturas", [])
    confiavel = snap.get("publicacao_confiavel", True)
    return {"id": snap.get("id"), "sha256": snap.get("sha256"), "arquivos": len(caps),
            "ultima_captura": max((x["capturado_em"] for x in caps), default=None),
            "publicacao_mais_recente": (max((x["publicado_em"] or "" for x in caps), default="") or None) if confiavel else None,
            "publicacao_confiavel": confiavel,
            "revisoes_detectadas": (snap.get("revisoes") or {}).get("total")}


def _fonte(orgao, dataset, recurso, url_dataset, url_primaria, licenca):
    return {"orgao": orgao, "dataset": dataset, "recurso": recurso, "url_dataset": url_dataset,
            "url_primaria": url_primaria, "licenca": licenca}


FONTE_SH = _fonte("ONS", "CMO Semi-Horário (DESSEM)", "CMO_SEMIHORARIO_<ano>.csv (arquivos anuais 2020 em diante)",
                  URL_SH, S3_SH, c.LICENCA_ONS)
FONTE_SEM = _fonte("ONS", "CMO Semanal (DECOMP)", "CMO_SEMANAL_<ano>.csv e .parquet", URL_SEM, S3_SEM, c.LICENCA_ONS)
FONTE_IPCA = _fonte("IBGE", "IPCA: número-índice (tabela 1737, variável 2266)", "API SIDRA, formato JSON",
                    ibge_pld.URL_TABELA, ibge_pld.URL_SIDRA, LICENCA_IBGE)
FONTE_BAL = c.fonte_ons("balanco-energia-subsistema", DS_BAL, "Balanço de Energia nos Subsistemas")
FONTE_INT = c.fonte_ons("intercambio-nacional", DS_INT, "Intercâmbios entre Subsistemas")


def _fonte_composta(*fontes):
    """Fonte de um número que combina conjuntos de órgãos diferentes. `url_dataset` e
    `url_primaria` seguem o esquema da proveniência (os da primeira fonte); `urls` lista o
    endereço de CADA fonte, para que nenhuma (a ANEEL dos atos, por exemplo) desapareça."""
    return {"orgao": "; ".join(dict.fromkeys(f["orgao"] for f in fontes)),
            "dataset": "; ".join(f["dataset"] for f in fontes),
            "recurso": "; ".join(f["recurso"] for f in fontes),
            "url_dataset": fontes[0]["url_dataset"], "url_primaria": fontes[0]["url_primaria"],
            "licenca": "; ".join(dict.fromkeys(f["licenca"] for f in fontes if f.get("licenca"))),
            "urls": [{"orgao": f["orgao"], "dataset": f["dataset"], "url_dataset": f["url_dataset"], "url_primaria": f["url_primaria"]}
                     for f in fontes] + [u for f in fontes for u in f.get("urls_extras", [])]}


def _fonte_atos(atos, recurso=None):
    """Fonte ANEEL dos limites: endereço oficial do ato vigente mais recente e, em
    `urls_extras`, o de cada ato usado (cada um com o nível de conferência)."""
    ultimo = max(atos, key=lambda a: (a.get("vigencia_inicio") or "", a.get("data_publicacao") or ""))
    return {"orgao": "ANEEL", "dataset": "Atos anuais de limites do PLD (via módulo Regulação)",
            "recurso": recurso or "pipeline/energia/regulatorio/limites_pld.json",
            "url_dataset": ultimo["url"], "url_primaria": ultimo["url"], "licenca": "Ato normativo público da ANEEL",
            "urls_extras": [{"orgao": "ANEEL", "dataset": a["ato"], "url_dataset": a["url"], "url_primaria": a["url"],
                             "nivel_conferencia": a.get("nivel_conferencia")} for a in atos]}


def _corr(xs, ys):
    n = len(xs)
    if n < 3:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    sx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    sy = math.sqrt(sum((y - my) ** 2 for y in ys))
    if sx == 0 or sy == 0:
        return None
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / (sx * sy)


def _meias_da_semana(fim):
    ini = datetime.combine(fim - timedelta(days=6), datetime.min.time())
    return [(ini + timedelta(minutes=30 * i)).strftime("%Y-%m-%dT%H:%M") for i in range(336)]


def _horas_da_semana(fim):
    ini = datetime.combine(fim - timedelta(days=6), datetime.min.time())
    return [(ini + timedelta(hours=i)).strftime("%Y-%m-%dT%H:00") for i in range(168)]


def _media_completa(serie, chaves):
    vals = [serie.get(k) for k in chaves]
    presentes = [v for v in vals if v is not None]
    return (sum(presentes) / len(presentes) if len(presentes) == len(chaves) else None), len(presentes)


def _dmais(iso, n):
    return (date.fromisoformat(iso[:10]) + timedelta(days=n)).isoformat()


def _num_br(v, casas=2):
    s = f"{abs(v):,.{casas}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return ("\u2212" if v < 0 else "") + s


def _br(v, casas=2):
    """Valor monetário no padrão brasileiro; negativo com sinal de menos antes do símbolo."""
    if v is None:
        return "sem valor"
    return ("\u2212" if v < 0 else "") + "R$ " + _num_br(abs(v), casas)


def _pct(frac, casas=1):
    return "sem valor" if frac is None else _num_br(100 * frac, casas) + "%"


def _texto_revisoes(rev):
    """Revisões de uma ou mais fontes em texto (evidencia.texto_revisoes por fonte)."""
    if isinstance(rev, dict) and "total" not in rev:
        return "; ".join(f"{k}: {ev.texto_revisoes(v)}" for k, v in rev.items())
    return rev


def _evidencia(*, indicador, valor_exibido, valor, unidade, periodo, entidade, universo, filtros, fonte, arquivos, consulta,
               formula, numerador=None, denominador=None, pesos=None, exclusoes=(), cobertura, tratamento_ausencia,
               revisoes, testes, reconciliacao, download, reproducao, extracao_pdf=None):
    """Objeto "Comprove este número" (seção 11.5) pelo construtor compartilhado
    pipeline/energia/evidencia.py, que valida o contrato (arquivo com sha256 e captura,
    teste executado, reconciliação com tolerância e unidade) e recusa o que não comprova."""
    f = {"orgao": fonte["orgao"], "conjunto": fonte["dataset"], "recurso": fonte["recurso"], "url": fonte["url_dataset"],
         "arquivo": None, "sha256": None, "capturado_em": None, "publicado_em": None}
    if len(arquivos) == 1:
        f.update({k: arquivos[0].get(k) for k in ("recurso", "arquivo", "sha256", "capturado_em", "publicado_em")})
    else:
        f["arquivos"] = arquivos
    return ev.construir(indicador=indicador, valor_exibido=valor_exibido, valor_calculo=valor, unidade=unidade, periodo=periodo,
                        entidade=entidade, universo=universo, filtros=filtros, fonte=f, consulta=consulta, formula=formula,
                        numerador=numerador, denominador=denominador, pesos=pesos, exclusoes=exclusoes, cobertura=cobertura,
                        tratamento_ausencia=tratamento_ausencia, revisoes=_texto_revisoes(revisoes), testes=testes,
                        reconciliacao=reconciliacao, download=download, reproducao=reproducao, extracao_pdf=extracao_pdf)


def _escreve_csv(d, nome, cabecalho, linhas):
    """CSV de download; ctx["destino_csv"] desvia a escrita (testes e ensaios), para que
    nenhuma execução de conferência sobrescreva os arquivos publicados."""
    return base.escreve_csv(nome, cabecalho, linhas, destino=d.get("destino_csv"))


def _arquivos_snap(snap, recursos=None, con=None, dataset=None):
    """Arquivos vigentes do snapshot (um por recurso), com o caminho no bronze quando a
    vintage o registra. A data de publicação só entra quando a fonte a informa de modo
    confiável (a da CCEE não: achado A09)."""
    confiavel = snap.get("publicacao_confiavel", True)
    out = []
    for x in snap.get("capturas", []):
        if recursos is not None and x["recurso"] not in recursos:
            continue
        v = base.ultima_vintage(con, dataset, x["recurso"]) if con is not None and dataset else None
        out.append({"recurso": x["recurso"], "arquivo": (v or {}).get("arquivo"), "sha256": x["sha256"],
                    "capturado_em": x["capturado_em"], "publicado_em": x["publicado_em"] if confiavel else None})
    return out


SEMANAS_GOLD = 156  # três anos de semanas operativas na gold; o resto no CSV


def _recorte_semanal(col):
    return {k: (v[-SEMANAS_GOLD:] if isinstance(v, list) else {kk: vv[-SEMANAS_GOLD:] for kk, vv in v.items()})
            for k, v in col.items()}


def _confere_csv_semanal(caminho, sem):
    """Relê o CSV semanal publicado e confere, semana a semana e submercado a submercado,
    as médias do DESSEM e do PLD e o valor do DECOMP contra a gold (arredondada a 2 casas):
    o gráfico e o download têm de mostrar os mesmos números, e ausência nos dois."""
    import csv as _csv
    with open(caminho, encoding="utf-8") as f:
        linhas = {(r["semana_fim"], r["sm"]): r for r in _csv.DictReader(f, delimiter=";")}
    conferidas = divergentes = 0
    exemplos = []
    for i, fim in enumerate(sem["fim"]):
        for sm in SM:
            r = linhas.get((fim, sm))
            for campo_g, campo_c in (("decomp", "decomp_media_semanal"), ("dessem", "dessem_media"), ("pld", "pld_media")):
                g_ = sem[sm][campo_g][i]
                v_ = None if r is None or r[campo_c] == "" else float(r[campo_c])
                conferidas += 1
                if (g_ is None) != (v_ is None) or (g_ is not None and abs(g_ - v_) > 0.005 + EPS):
                    divergentes += 1
                    if len(exemplos) < 5:
                        exemplos.append({"semana_fim": fim, "sm": sm, "campo": campo_g, "gold": g_, "csv": v_})
    return {"celulas": conferidas, "divergentes": divergentes, "exemplos": exemplos, "tolerancia": "R$ 0,005/MWh (arredondamento da gold)"}


def _bloco_cmo_pld(d):
    """P009: CMO (DECOMP semanal e DESSEM semi-horário) e PLD em painéis alinhados."""
    pld, cmo_h, sh, dec, lim_dia = d["pld"], d["cmo_h"], d["sh"], d["dec"], d["lim_dia"]
    ultima_hora = d["ultima_hora"]
    # dias em que a média diária ficou no teto estrutural: nesses dias o PLD de uma hora
    # "entre" os limites horários também está condicionado pelo limite (a média do dia foi
    # contida), então essas horas não entram na comparação livre com o CMO
    dia_estrutural = {sm: {dia for dia, v in d["diario"][sm].items()
                           if lim_dia and situacao_dia_estrutural(v, lim_dia.get(dia, {})) == "no_teto"} for sm in SM}

    def situacao(sm, h, p):
        if not lim_dia:
            return "sem_limite"
        s_ = situacao_hora(p, lim_dia.get(h[:10], {}))
        if s_ == "entre" and h[:10] in dia_estrutural[sm]:
            return "teto_estrutural_no_dia"
        return s_

    # relação hora a hora por ano e submercado
    acc = {}
    for sm in SM:
        for h, p in pld[sm].items():
            if h > ultima_hora:
                continue
            ano = h[:4]
            a = acc.setdefault((ano, sm), {"n_pld": 0, "n": 0, "sit": defaultdict(int), "dif_entre": [], "dif_todas": [],
                                           "piso_cmo_ate": 0, "piso_cmo_acima1": 0, "n_piso": 0})
            a["n_pld"] += 1
            cm = cmo_h[sm].get(h)
            if cm is None:
                continue
            a["n"] += 1
            a["dif_todas"].append(p - cm)
            s = situacao(sm, h, p)
            a["sit"][s] += 1
            if s == "entre":
                a["dif_entre"].append(p - cm)
            elif s == "piso":
                a["n_piso"] += 1
                mn = lim_dia[h[:10]]["pld_min"]
                a["piso_cmo_ate"] += cm <= mn + TOL_HORA + EPS
                a["piso_cmo_acima1"] += cm > mn + 1.0
    relacao = []
    for (ano, sm), a in sorted(acc.items()):
        de, dt_ = a["dif_entre"], a["dif_todas"]
        abs_e = [abs(x) for x in de]
        relacao.append({
            "ano": int(ano), "sm": sm, "parcial": ano == d["dia_ref"][:4] and d["dia_ref"][5:] != "12-31",
            "horas_pld": a["n_pld"], "horas_com_cmo": a["n"], "horas_sem_cmo": a["n_pld"] - a["n"],
            "por_situacao": {k: a["sit"].get(k, 0) for k in ("piso", "teto_horario", "teto_estrutural_no_dia", "entre", "sem_limite",
                                                             "abaixo_do_piso", "acima_do_teto")},
            "todas": {"media_dif": c.r(c.media(dt_)), "media_abs_dif": c.r(c.media([abs(x) for x in dt_]))},
            "entre": ({"n": len(de), "media_dif": c.r(c.media(de)), "media_abs_dif": c.r(c.media(abs_e)),
                       "mediana_abs_dif": c.r(c.quantil(abs_e, 0.5)),
                       "frac_abs_ate_1": c.r(sum(1 for x in abs_e if x <= 1.0 + EPS) / len(de), 4),
                       "frac_abs_ate_0_01": c.r(sum(1 for x in abs_e if x <= TOL + EPS) / len(de), 4)} if de else None),
            "piso": ({"n": a["n_piso"], "frac_cmo_no_piso_ou_abaixo": c.r(a["piso_cmo_ate"] / a["n_piso"], 4),
                      "frac_cmo_acima_do_piso_mais_1": c.r(a["piso_cmo_acima1"] / a["n_piso"], 4)} if a["n_piso"] else None),
        })

    # semanas operativas (sábado a sexta) desde a primeira semana completa do PLD horário
    semanas = sorted(set.intersection(*(set(dec[sm]["media"]) for sm in SM)))
    semanas = [s for s in semanas if s >= _dmais(INICIO, 7) and _dmais(s, -6) <= d["dia_ref"]]
    col = {"fim": [], "inicio": [], **{sm: {"decomp": [], "dessem": [], "pld": []} for sm in SM}}
    linhas_csv, completas = [], []
    for s in semanas:
        fim = date.fromisoformat(s)
        meias, horas = _meias_da_semana(fim), _horas_da_semana(fim)
        col["fim"].append(s)
        col["inicio"].append(_dmais(s, -6))
        todas = True
        for sm in SM:
            dm, nm = _media_completa(sh[sm], meias)
            pm, nh = _media_completa(pld[sm], horas)
            dv = dec[sm]["media"].get(s)
            col[sm]["decomp"].append(c.r(dv))
            col[sm]["dessem"].append(c.r(dm))
            col[sm]["pld"].append(c.r(pm))
            todas = todas and dm is not None and pm is not None and dv is not None
            linhas_csv.append([_dmais(s, -6), s, sm, dv, dec[sm]["leve"].get(s), dec[sm]["media_pat"].get(s),
                               dec[sm]["pesada"].get(s), dm, nm, pm, nh])
        if todas:
            completas.append(s)
    caminho_csv = _escreve_csv(d, "pld_cmo_semanal.csv", ["semana_inicio", "semana_fim", "sm", "decomp_media_semanal", "decomp_leve",
                                                            "decomp_media_patamar", "decomp_pesada", "dessem_media", "dessem_meias_horas",
                                                            "pld_media", "pld_horas"], linhas_csv)

    # evidência da convenção de datas: a sexta do ONS encerra a semana operativa?
    conv = {}
    for sm in SM:
        xs, a_fim, a_seg = [], [], []
        for s in sorted(dec[sm]["media"]):
            fim = date.fromisoformat(s)
            m1, _ = _media_completa(sh[sm], _meias_da_semana(fim))
            m2, _ = _media_completa(sh[sm], _meias_da_semana(fim + timedelta(days=7)))
            if m1 is None or m2 is None:
                continue
            xs.append(dec[sm]["media"][s])
            a_fim.append(m1)
            a_seg.append(m2)
        conv[sm] = {"semanas": len(xs), "corr_semana_que_termina_na_data": c.r(_corr(xs, a_fim), 3),
                    "corr_semana_seguinte": c.r(_corr(xs, a_seg), 3),
                    "erro_abs_medio_semana_que_termina_na_data": c.r(c.media([abs(x - y) for x, y in zip(xs, a_fim)])),
                    "erro_abs_medio_semana_seguinte": c.r(c.media([abs(x - y) for x, y in zip(xs, a_seg)]))}
    # evidência da convenção da meia hora: início (h:00 e h:30) ou fim (h:30 e h+1:00)?
    meia = {}
    for sm in SM:
        e_ini, e_fim = [], []
        for h, p in pld[sm].items():
            if h > ultima_hora:
                continue
            if lim_dia and situacao(sm, h, p) != "entre":
                continue
            a1 = cmo_h[sm].get(h)
            t = datetime.fromisoformat(h)
            k1, k2 = (t + timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M"), (t + timedelta(minutes=60)).strftime("%Y-%m-%dT%H:%M")
            b1, b2 = sh[sm].get(k1), sh[sm].get(k2)
            if a1 is None or b1 is None or b2 is None:
                continue
            e_ini.append(abs(p - a1))
            e_fim.append(abs(p - (b1 + b2) / 2))
        meia[sm] = {"horas": len(e_ini), "erro_abs_medio_inicio": c.r(c.media(e_ini)), "erro_abs_medio_fim": c.r(c.media(e_fim)),
                    "filtro": ("horas com PLD entre os limites vigentes, fora de dias no teto estrutural" if lim_dia
                               else "todas as horas (limites indisponíveis)")}

    ref_sem = completas[-1] if completas else None
    semana_ref = None
    if ref_sem:
        i = col["fim"].index(ref_sem)
        por_sm = []
        for sm in SM:
            dv, dm, pm = col[sm]["decomp"][i], col[sm]["dessem"][i], col[sm]["pld"][i]
            por_sm.append({"sm": sm, "nome": c.NOME_SUBMERCADO[sm], "decomp": dv, "dessem": dm, "pld": pm,
                           "pld_menos_decomp": c.r(pm - dv), "pld_menos_dessem": c.r(pm - dm), "dessem_menos_decomp": c.r(dm - dv)})
        maior = max(por_sm, key=lambda x: abs(x["pld_menos_decomp"]))
        dif = maior["pld_menos_decomp"]
        texto = (f"Semana operativa de {c.data_br(col['inicio'][i])} a {c.data_br(ref_sem)}, {maior['nome']}: CMO semanal do DECOMP "
                 f"{_br(maior['decomp'])}/MWh; média das meias horas do CMO do DESSEM {_br(maior['dessem'])}/MWh; média das "
                 f"168 horas do PLD {_br(maior['pld'])}/MWh. "
                 + (f"O PLD médio ficou {_br(abs(dif))}/MWh {'abaixo' if dif < 0 else 'acima'} do CMO semanal. " if abs(dif) > TOL else
                    "O PLD médio e o CMO semanal coincidiram. ")
                 + "São três produtos diferentes (modelo, resolução e regras de cálculo); a diferença não é explicada por estes dados.")
        semana_ref = {"inicio": col["inicio"][i], "fim": ref_sem, "por_sm": por_sm, "texto": texto}

    mom = d.get("momento") or momento_do_calculo(())
    sem_pr = ("Não informado: as passagens dos Procedimentos de Rede do ONS que descrevem o momento de execução do modelo não "
              "foram conferidas nesta construção (documento não coletado ou passagem não encontrada).")
    versao_ons = mom["versao"] or "não identificados por valor no conjunto do ONS"
    return {
        "produtos": [
            {"id": "decomp_semanal", "rotulo": "CMO semanal (DECOMP)", "orgao": "ONS", "modelo": "DECOMP",
             "resolucao": "semana operativa de sábado a sexta, com valores por patamar de carga (leve, médio, pesado) e média semanal",
             "grao_geografico": "subsistema", "data_publicada": "sexta-feira que encerra a semana operativa (convenção conferida: ver alinhamento)",
             "unidade_no_dicionario": d["dicionario"].get("cmo_semanal:val_cmomediasemanal", {}).get("unidade"),
             "unidade_patamares_no_dicionario": d["dicionario"].get("cmo_semanal:val_cmoleve", {}).get("unidade"),
             "descricao_fonte": d["notas"].get("semanal"), "url": URL_SEM,
             "entrega": "semana operativa de sábado a sexta", "momento_do_calculo": mom["decomp_semanal"],
             "momento_do_calculo_motivo": None if mom["decomp_semanal"] else sem_pr,
             "fontes_normativas": ["pr24_cmo_semanal", "pr43_cmo_semanal", "pr43_prazo_sexta", "pr43_horizonte", "pr45_decomp",
                                   "dessem_acoplamento"],
             "deck_versao": versao_ons},
            {"id": "dessem_semi_horario", "rotulo": "CMO semi-horário (DESSEM)", "orgao": "ONS", "modelo": "DESSEM",
             "resolucao": "meia hora; o instante publicado marca o início da meia hora",
             "grao_geografico": "subsistema: média dos CMOs das barras do subsistema ponderada pelas cargas (descrição do ONS; Manual de Metodologia do DESSEM, CEPEL, seção 22.6)",
             "unidade_no_dicionario": d["dicionario"].get("cmo_semi_horario:val_cmo", {}).get("unidade"),
             "descricao_fonte": d["notas"].get("semi_horario"), "url": URL_SH,
             "entrega": "meia hora", "momento_do_calculo": mom["dessem_semi_horario"],
             "momento_do_calculo_motivo": None if mom["dessem_semi_horario"] else sem_pr,
             "fontes_normativas": ["pr24_cmo_semi_horario", "pr24_execucao_d1", "pr24_48_intervalos", "pr45_cmo_semi_horario",
                                   "pr45_prazo_16h", "pr45_dia_d1", "pr45_envio_ccee", "pr45_dessem", "dessem_uso_ons_ccee",
                                   "dessem_resultado_cmo", "dessem_cmo_duais", "dessem_cmo_submercado", "dessem_acoplamento"],
             "deck_versao": versao_ons},
            {"id": "pld_horario", "rotulo": "PLD horário", "orgao": "CCEE", "modelo": "NEWAVE, DECOMP e DESSEM, segundo a CCEE",
             "resolucao": "hora (HORA 0 a 23, horário de Brasília)", "grao_geografico": "submercado",
             "unidade_no_dicionario": "R$/MWh", "descricao_fonte": d["notas"].get("ccee_pld"), "url": c.FONTE_CCEE_PLD["url_dataset"],
             "entrega": "hora", "momento_do_calculo": "diariamente, para cada hora do dia seguinte (descrição oficial da CCEE)",
             "momento_do_calculo_motivo": None, "fontes_normativas": ["ccee_pld", "d5163_art57_p1", "ren957_art78"],
             "deck_versao": "não identificados por valor no conjunto da CCEE"},
        ],
        "nao_equivalencia": [
            "O CMO semanal do DECOMP é um valor para a semana operativa inteira, por patamar de carga e em média semanal (descrição do ONS); não é uma média de valores horários.",
            "O CMO semi-horário do DESSEM publicado pelo ONS é o do subsistema, média das barras ponderada pelas cargas; os conjuntos do ONS não identificam deck, versão ou revisão do modelo por valor.",
            "O PLD é calculado pela CCEE para cada hora do dia seguinte, com base no CMO e com a aplicação dos limites mínimo e máximos vigentes; a descrição pública integrada não detalha as diferenças de configuração entre a execução da CCEE e a do ONS.",
            "Agregar as duas meias horas por duração alinha a resolução, mas não torna as séries iguais: mesmo nas horas com o PLD entre os limites, o PLD e o CMO do ONS diferem (ver relação por ano).",
        ],
        "alinhamento": {
            "hora": "Hora h = média simples das meias horas do DESSEM que começam em h:00 e h:30 (mesma duração, logo média por duração). Hora com meia hora ausente fica sem valor.",
            "semana": "Semana operativa = sábado a sexta. O valor semanal do DECOMP é comparado com a média das 336 meias horas do DESSEM e das 168 horas do PLD da mesma semana; semana incompleta fica sem média.",
            "convencao_semana": conv, "convencao_meia_hora": meia,
        },
        # recorte das últimas SEMANAS_GOLD semanas (peso da página, contrato 5.1); o histórico
        # inteiro desde 2021 está no CSV pld_cmo_semanal.csv
        "semanal": _recorte_semanal(col),
        "semanal_recorte": {"semanas_na_gold": min(SEMANAS_GOLD, len(col["fim"])), "semanas_no_csv": len(col["fim"]),
                            "historico_completo": "/energia/series/pld_cmo_semanal.csv"},
        "equivalencia_csv": _confere_csv_semanal(caminho_csv, _recorte_semanal(col)),
        "semanas_completas": len(completas),
        "semana_referencia": semana_ref,
        "relacao_anual": relacao,
    }


def _bloco_limites(d):
    """P010 e A04: permanência no piso e nos tetos por submercado e ano, com os atos."""
    if not d["atos"]:
        # o CSV diário sai do mesmo jeito, com as colunas de limite vazias (ausência declarada)
        _escreve_csv(d, "pld_limites_diario.csv", ["data", "sm", "pld_media_dia", "horas", "horas_no_piso", "horas_no_teto_horario",
                                                    "horas_um_centavo_acima_do_piso", "media_no_teto_estrutural", "pld_min",
                                                    "pld_max_horario", "pld_max_estrutural", "ato_pld_min", "ato_pld_max_horario",
                                                    "ato_pld_max_estrutural"],
                         [[dia, sm, sum(d["pld"][sm][f"{dia}T{i:02d}:00"] for i in range(24)) / 24, 24] + [None] * 10
                          for dia in sorted(d["dias_completos_set"]) for sm in SM])
        return {"disponivel": False, "motivo": d["limites_motivo"], "origem": None,
                "dependencia": ("Arquivo pipeline/energia/regulatorio/limites_pld.json e função limites_pld() do módulo "
                                "Regulação, com os atos anuais da ANEEL (mínimo, máximo horário e máximo estrutural, vigência)."),
                "rejeitados": d["atos_rejeitados"]}
    pld, lim_dia, dias = d["pld"], d["lim_dia"], d["dias_completos_set"]
    ultima_hora = d["ultima_hora"]
    # regimes: trechos de dias consecutivos com os mesmos limites
    regimes, atual = [], None
    for dia in sorted(lim_dia):
        l_ = lim_dia[dia]
        chave = tuple(l_.get(k) for k in CAMPOS_LIMITE) + tuple(l_.get(f"ato_{k}") for k in CAMPOS_LIMITE)
        if atual and atual["_chave"] == chave and _dmais(atual["fim"], 1) == dia:
            atual["fim"] = dia
        else:
            atual = {"_chave": chave, "inicio": dia, "fim": dia, **{k: l_.get(k) for k in CAMPOS_LIMITE},
                     **{f"ato_{k}": l_.get(f"ato_{k}") for k in CAMPOS_LIMITE}}
            regimes.append(atual)
    for rg in regimes:
        rg.pop("_chave")
    perm, empates, conferencias = [], [], []
    anos = sorted({h[:4] for h in pld["SE"] if h <= ultima_hora})
    diario_csv = []
    for ano in anos:
        horas_ano = sorted(h for h in pld["SE"] if h[:4] == ano and h <= ultima_hora and all(h in pld[s] for s in SM))
        k_no_piso = defaultdict(int)
        for h in horas_ano:
            l_ = lim_dia.get(h[:10], {})
            k = sum(1 for s in SM if situacao_hora(pld[s][h], l_) == "piso")
            k_no_piso[k] += 1
        empates.append({"ano": int(ano), "horas": len(horas_ano), "por_quantidade_no_piso": {str(k): k_no_piso.get(k, 0) for k in range(5)},
                        "horas_quatro_no_piso": k_no_piso.get(4, 0), "frac_quatro_no_piso": c.r(k_no_piso.get(4, 0) / len(horas_ano), 4) if horas_ano else None})
        for sm in SM:
            hs = [h for h in pld[sm] if h[:4] == ano and h <= ultima_hora]
            cont, sens, viz = defaultdict(int), defaultdict(int), defaultdict(int)
            for h in hs:
                l_ = lim_dia.get(h[:10], {})
                cont[situacao_hora(pld[sm][h], l_)] += 1
                sens[situacao_hora(pld[sm][h], l_, tol=TOL_SENS)] += 1
                viz[a_um_centavo(pld[sm][h], l_)] += 1
            dias_ano = sorted(x for x in dias if x[:4] == ano)
            est = defaultdict(int)
            for dia in dias_ano:
                vals = [pld[sm][f"{dia}T{i:02d}:00"] for i in range(24)]
                media = sum(vals) / 24
                l_ = lim_dia.get(dia, {})
                e = situacao_dia_estrutural(media, l_)
                est[e] += 1
                if e == "no_teto" and max(vals) > l_["pld_max_estrutural"] + TOL + EPS:
                    est["no_teto_com_hora_acima"] += 1
                diario_csv.append([dia, sm, media, 24, sum(1 for v in vals if situacao_hora(v, l_) == "piso"),
                                   sum(1 for v in vals if situacao_hora(v, l_) == "teto_horario"),
                                   sum(1 for v in vals if a_um_centavo(v, l_) == "piso"),
                                   None if e is None else int(e == "no_teto"), l_.get("pld_min"), l_.get("pld_max_horario"),
                                   l_.get("pld_max_estrutural"), l_.get("ato_pld_min"), l_.get("ato_pld_max_horario"),
                                   l_.get("ato_pld_max_estrutural")])
            n = len(hs)
            n_lim = n - cont["sem_limite"]  # a fração só usa horas com os dois limites horários vigentes
            perm.append({
                "ano": int(ano), "sm": sm, "parcial": ano == d["dia_ref"][:4] and d["dia_ref"][5:] != "12-31",
                "horas": n, "horas_com_limite": n_lim,
                "horas_piso": cont["piso"], "frac_piso": c.r(cont["piso"] / n_lim, 4) if n_lim else None,
                "horas_teto_horario": cont["teto_horario"], "frac_teto_horario": c.r(cont["teto_horario"] / n_lim, 4) if n_lim else None,
                "horas_entre": cont["entre"], "horas_sem_limite": cont["sem_limite"],
                "controle_abaixo_do_piso": cont["abaixo_do_piso"], "controle_acima_do_teto": cont["acima_do_teto"],
                "horas_um_centavo_acima_do_piso": viz["piso"], "horas_um_centavo_abaixo_do_teto_horario": viz["teto_horario"],
                "sensibilidade_um_centavo": {"horas_piso": sens["piso"], "horas_teto_horario": sens["teto_horario"]},
                "dias": len(dias_ano), "dias_teto_estrutural": est["no_teto"],
                "dias_teto_estrutural_com_hora_acima": est["no_teto_com_hora_acima"], "controle_dias_acima_estrutural": est["acima"],
                "dias_sem_teto_estrutural": est[None],
            })
            vals_ano = [pld[sm][h] for h in hs]
            if vals_ano:
                lims_ano = [lim_dia.get(f"{ano}-{m:02d}-01", {}) for m in range(1, 13)]
                mins = {x.get("pld_min") for x in lims_ano if x.get("pld_min") is not None}
                maxs = {x.get("pld_max_horario") for x in lims_ano if x.get("pld_max_horario") is not None}
                menor, maior = min(vals_ano), max(vals_ano)
                conferencias.append({
                    "ano": int(ano), "sm": sm, "menor_observado": c.r(menor), "maior_observado": c.r(maior),
                    "pld_min_atos": sorted(mins), "pld_max_horario_atos": sorted(maxs),
                    "menor_igual_ao_piso": any(abs(menor - m) <= TOL_HORA + EPS for m in mins) if mins else None,
                    "maior_igual_ao_teto_horario": any(abs(maior - m) <= TOL_HORA + EPS for m in maxs) if maxs else None,
                })
    _escreve_csv(d, "pld_limites_diario.csv", ["data", "sm", "pld_media_dia", "horas", "horas_no_piso", "horas_no_teto_horario",
                                                "horas_um_centavo_acima_do_piso", "media_no_teto_estrutural", "pld_min",
                                                "pld_max_horario", "pld_max_estrutural", "ato_pld_min", "ato_pld_max_horario",
                                                "ato_pld_max_estrutural"], diario_csv)
    # calendário dos últimos 366 dias completos (o histórico inteiro está no CSV)
    ult = sorted(dias)[-366:]
    cal = {"dias": ult}
    for sm in SM:
        piso, teto, est, sem_est = [], [], [], []
        for dia in ult:
            l_ = lim_dia.get(dia, {})
            vals = [pld[sm][f"{dia}T{i:02d}:00"] for i in range(24)]
            piso.append(sum(1 for v in vals if situacao_hora(v, l_) == "piso"))
            teto.append(sum(1 for v in vals if situacao_hora(v, l_) == "teto_horario"))
            e = situacao_dia_estrutural(sum(vals) / 24, l_)
            if e == "no_teto":
                est.append(dia)
            elif e is None:
                sem_est.append(dia)
        # dias no teto estrutural são raros: lista de datas em vez de uma marca por dia
        cal[sm] = {"horas_piso": piso, "horas_teto_horario": teto, "dias_teto_estrutural": est,
                   "dias_sem_teto_estrutural_vigente": sem_est}
    return {
        "disponivel": True, "origem": d["limites_origem"], "conferido_em": d["limites_conferido_em"],
        "tolerancia": {"hora": TOL_HORA, "media_diaria": TOL, "sensibilidade_hora": TOL_SENS, "unidade": "R$/MWh",
                       "regra": ("Hora no piso: PLD igual ao mínimo vigente ao centavo (|PLD − mínimo| ≤ R$ 0,005/MWh). Hora no teto "
                                 "horário: PLD igual ao máximo horário ao centavo. Dia no teto estrutural: |média das 24 horas − máximo "
                                 "estrutural| ≤ R$ 0,01/MWh. Hora exatamente um centavo acima do piso (ou abaixo do teto horário) é preço "
                                 "diferente do limite e fica numa classe à parte."),
                       "justificativa": ("PLD horário e limites são publicados em centavos: na hora, a igualdade é exata ao centavo e o "
                                         "meio centavo só absorve a representação binária do número. A média diária de 24 valores "
                                         "arredondados ao centavo erra até R$ 0,005/MWh e é comparada a um limite também arredondado; "
                                         "por isso o teto estrutural usa R$ 0,01/MWh. A contagem horária com R$ 0,01/MWh (que juntaria "
                                         "o centavo vizinho ao limite) é publicada como sensibilidade.")},
        "atos": d["atos"], "rejeitados": d["atos_rejeitados"], "regimes": regimes,
        "conferencia_atos": _resumo_conferencia(d["atos"], d.get("pendencias_limites")),
        "permanencia_anual": perm, "empates_piso": empates, "conferencias": conferencias, "calendario": cal,
        "regra_menor_observado": "O menor valor observado aparece só como conferência do ato; nunca substitui o piso regulatório.",
        "nota_teto_estrutural": _nota_estrutural(perm),
    }


def _resumo_conferencia(atos, pendencias=None):
    """Quantos atos foram conferidos no texto do próprio ato e quais só em documento do
    processo (voto ou nota técnica), com as pendências registradas pelo módulo Regulação."""
    por_nivel = defaultdict(list)
    for a in atos:
        por_nivel[a.get("nivel_conferencia") or "sem_registro"].append(a["ato"])
    sec = por_nivel.get("documento_oficial_do_processo", [])
    return {
        "por_nivel": {k: len(v) for k, v in sorted(por_nivel.items())},
        "atos_lidos_em_documento_do_processo": sec,
        "atos_sem_registro_de_conferencia": por_nivel.get("sem_registro", []),
        "pendencias": [{"ano": p_.get("ano"), "item": p_.get("item"), "situacao": p_.get("situacao")} for p_ in (pendencias or [])],
        "leitura": (f"{len(atos) - len(sec) - len(por_nivel.get('sem_registro', []))} de {len(atos)} atos com os valores lidos no texto do "
                    f"próprio ato; {len(sec)} com o texto integral inacessível e os valores lidos em voto ou nota técnica da ANEEL do "
                    "mesmo processo" + (f" ({'; '.join(sec)})" if sec else "") + "."),
    }


def _nota_estrutural(perm):
    """Texto determinístico: o teto estrutural é verificado sobre a média diária por
    conferência empírica, porque a regra de aplicação não está nos trechos dos atos."""
    no_teto = sum(x["dias_teto_estrutural"] for x in perm)
    com_acima = sum(x["dias_teto_estrutural_com_hora_acima"] for x in perm)
    acima = sum(x["controle_dias_acima_estrutural"] for x in perm)
    anos = sorted({x["ano"] for x in perm if x["dias_teto_estrutural"]})
    return (f"O teto estrutural é conferido sobre a média diária das 24 horas. Em {no_teto} dias-submercado do histórico "
            f"({', '.join(str(a) for a in anos) if anos else 'nenhum ano'}) a média diária ficou no teto; em {com_acima} deles houve horas "
            f"acima do teto no mesmo dia; em {acima} a média passou do teto. O padrão é compatível com um limite aplicado à média diária. A regra de aplicação "
            "não está nos trechos dos atos integrados e as regras de comercialização da CCEE estão inacessíveis (HTTP 403); a leitura é "
            "conferência empírica, não citação da regra.")


def _bloco_historico(d):
    """P011: médias mensais temporal e ponderada pela carga, moeda constante, percentis
    sazonais, distribuição por regime de limites e perfil hora × mês."""
    pld, carga, ipca, lim_dia = d["pld"], d["carga"], d["ipca"], d["lim_dia"]
    ultima_hora, dia_ref = d["ultima_hora"], d["dia_ref"]
    diario = d["diario"]
    meses = sorted({h[:7] for h in pld["SE"] if h <= ultima_hora})
    dias_por_mes = defaultdict(int)
    for dia in d["dias_completos_set"]:
        dias_por_mes[dia[:7]] += 1
    base_real = max((m for m in ipca if m <= dia_ref[:7]), default=None)
    i_base = ipca.get(base_real) if base_real else None
    horas_mes = {sm: defaultdict(list) for sm in SM}
    for sm in SM:
        for h in pld[sm]:
            if h <= ultima_hora:
                horas_mes[sm][h[:7]].append(h)
    mensal = {"meses": meses, "dias_completos": [dias_por_mes.get(m, 0) for m in meses],
              "parcial": [mes_parcial(m, dias_por_mes.get(m, 0)) for m in meses],
              **{sm: {"horas": [], "temporal": [], "horas_com_carga": [], "ponderada_carga": [], "mesmas_horas": [], "real": []} for sm in SM}}
    csv_m, retiradas = [], []
    pond_mes = {}
    for i, mes in enumerate(meses):
        for sm in SM:
            hs = horas_mes[sm][mes]
            vals = [pld[sm][h] for h in hs]
            temporal = sum(vals) / len(vals) if vals else None
            # peso: só carga publicada e positiva (controle físico); a carga ≤ 0 sai e é listada
            validos, fora = pesos_validos([(h, pld[sm][h], carga[sm].get(h)) for h in hs])
            pond = media_ponderada([(p_, w_) for _, p_, w_ in validos])
            pond_mes[(sm, mes)] = pond
            if fora:
                retiradas.append({"sm": sm, "mes": mes, "horas": len(fora),
                                  "exemplos": [{"hora": k, "carga_mwmed": c.r(w_, 3)} for k, _, w_ in fora[:5]]})
            real = deflaciona(temporal, ipca.get(mes), i_base)
            col = mensal[sm]
            col["horas"].append(len(vals))
            col["temporal"].append(c.r(temporal))
            col["horas_com_carga"].append(len(validos))
            col["ponderada_carga"].append(c.r(pond))
            col["mesmas_horas"].append(len(validos) == len(vals))
            col["real"].append(c.r(real))
            csv_m.append([mes, sm, int(mensal["parcial"][i]), len(vals), temporal, len(validos), len(fora), pond,
                          int(len(validos) == len(vals)), ipca.get(mes), real, base_real])
    _escreve_csv(d, "pld_mensal.csv", ["mes", "sm", "parcial", "horas", "media_temporal", "horas_com_carga", "horas_carga_nao_positiva",
                                        "media_ponderada_carga", "mesmas_horas", "ipca_indice", "media_temporal_real", "mes_base_real"], csv_m)
    revisoes_carga = _revisoes_carga(d, pond_mes)

    ano_ref = int(dia_ref[:4])
    sazonal, csv_s = [], []
    for sm in SM:
        for m in range(1, 13):
            xs = [(k, v) for k, v in diario[sm].items() if int(k[5:7]) == m and int(k[:4]) < ano_ref]
            q = resumo_quantis([v for _, v in xs])
            anos = sorted({int(k[:4]) for k, _ in xs})
            sazonal.append({"sm": sm, "mes": m, "anos": anos, **q})
            csv_s.append([sm, m, q["n"], " ".join(str(a) for a in anos), q["p10"], q["p25"], q["p50"], q["p75"], q["p90"]])
    _escreve_csv(d, "pld_sazonal.csv", ["sm", "mes", "n_dias", "anos", "p10", "p25", "p50", "p75", "p90"], csv_s)

    dref = date.fromisoformat(dia_ref)
    semana_iso = dref.isocalendar()[1]
    posicao = []
    for sm in SM:
        v = diario[sm][dia_ref]
        mes_xs = [x for k, x in diario[sm].items() if int(k[5:7]) == dref.month and int(k[:4]) < ano_ref]
        sem_xs = [(k, x) for k, x in diario[sm].items() if date.fromisoformat(k).isocalendar()[1] == semana_iso and int(k[:4]) < ano_ref]
        posicao.append({
            "sm": sm, "dia": dia_ref, "media_dia": c.r(v),
            "mesmo_mes": {"mes": dref.month, "percentil": c.r(c.percentil_de(v, mes_xs), 1), "n_dias": len(mes_xs),
                          "empates": sum(1 for x in mes_xs if abs(x - v) <= EPS), **{k: c.r(c.quantil(mes_xs, q)) for k, q in QUANTIS}},
            "mesma_semana_iso": {"semana": semana_iso, "percentil": c.r(c.percentil_de(v, [x for _, x in sem_xs]), 1),
                                 "n_dias": len(sem_xs), "anos": sorted({int(k[:4]) for k, _ in sem_xs})},
        })
    mes_corrente = []
    mc = dia_ref[:7]
    for sm in SM:
        ks = sorted(k for k in diario[sm] if k[:7] == mc)
        anteriores = []
        for ano in range(int(INICIO[:4]), ano_ref):
            m_ = f"{ano}-{mc[5:]}"
            kk = [k for k in diario[sm] if k[:7] == m_]
            if kk and not mes_parcial(m_, len(kk)):
                anteriores.append({"ano": ano, "media": c.r(sum(diario[sm][k] for k in kk) / len(kk)), "dias": len(kk)})
        mes_corrente.append({"sm": sm, "mes": mc, "dias": len(ks), "parcial": mes_parcial(mc, len(ks)),
                             "media_dias_completos": c.r(sum(diario[sm][k] for k in ks) / len(ks)) if ks else None,
                             "mesmo_mes_anos_anteriores": anteriores})

    regimes = []
    for ano in sorted({h[:4] for h in pld["SE"] if h <= ultima_hora}):
        for sm in SM:
            hs = [h for h in pld[sm] if h[:4] == ano and h <= ultima_hora]
            vals = [pld[sm][h] for h in hs]
            sit = defaultdict(int)
            if lim_dia:
                for h in hs:
                    sit[situacao_hora(pld[sm][h], lim_dia.get(h[:10], {}))] += 1
            lims = sorted({tuple(lim_dia.get(h[:10], {}).get(k) for k in CAMPOS_LIMITE) for h in hs}) if lim_dia else []
            n_lim = len(vals) - sit["sem_limite"] if lim_dia else 0
            regimes.append({"ano": int(ano), "sm": sm, "parcial": ano == dia_ref[:4] and dia_ref[5:] != "12-31",
                            "limites": [dict(zip(CAMPOS_LIMITE, x)) for x in lims], **resumo_quantis(vals),
                            "media": c.r(c.media(vals)), "horas_com_limite": n_lim,
                            "frac_piso": c.r(sit["piso"] / n_lim, 4) if n_lim else None,
                            "frac_teto_horario": c.r(sit["teto_horario"] / n_lim, 4) if n_lim else None})

    ult12 = meses[-12:]
    perfil = {"meses": ult12, "parcial": [mes_parcial(m, dias_por_mes.get(m, 0)) for m in ult12]}
    for sm in SM:
        mat = []
        for mes in ult12:
            por_hora = defaultdict(list)
            for h in horas_mes[sm][mes]:
                por_hora[int(h[11:13])].append(pld[sm][h])
            mat.append([c.r(sum(por_hora[hh]) / len(por_hora[hh])) if por_hora[hh] else None for hh in range(24)])
        perfil[sm] = mat

    ult_carga = max((max(carga[sm]) for sm in SM if carga[sm]), default=None)
    return {
        "mensal": mensal,
        "hora_dia": _hora_dia(d),
        "deflator": {"indice": "IPCA, número-índice (base dezembro de 1993 = 100), IBGE tabela 1737", "mes_base": base_real,
                     "indice_base": i_base, "ultimo_mes_do_indice": max(ipca) if ipca else None,
                     "regra": "valor em reais do mês-base = valor nominal do mês × índice do mês-base ÷ índice do mês. Mês sem índice publicado fica sem valor real."},
        "ponderacao": {"peso": "carga verificada do subsistema na mesma hora (ONS, Balanço de Energia nos Subsistemas, MWmed; numa hora, MWmed equivale a MWh)",
                       "ressalva": ("A carga é publicada por subsistema do ONS e o PLD por submercado da CCEE; os quatro se correspondem pelo nome "
                                    "(Sudeste/Centro-Oeste, Sul, Nordeste, Norte), mas a correspondência de perímetro não é conferida por estes dados. "
                                    "A carga do balanço é a carga do sistema, não o consumo contabilizado na CCEE."),
                       "ultima_hora_com_carga": ult_carga,
                       "controle_fisico": ("Carga ≤ 0 numa hora não é peso válido (a carga é energia consumida): a hora sai da média "
                                           "ponderada, o mês fica com mesmas_horas = false e a hora é listada em horas_retiradas."),
                       "horas_retiradas": retiradas,
                       "revisoes_carga": revisoes_carga},
        "sazonal_mes": sazonal,
        "posicao_referencia": posicao,
        "mes_corrente": mes_corrente,
        "regimes": regimes,
        "perfil_hora_mes": perfil,
    }


def _revisoes_carga(d, pond_mes):
    """Magnitude e alcance das revisões da carga do ONS por submercado e mês (seção 11.6):
    horas revisadas, maior e média variação, troca de sinal e o efeito na média ponderada
    publicada (ponderada com os valores vigentes menos a ponderada com o primeiro valor
    capturado de cada hora revista, com o mesmo controle físico nas duas)."""
    pld, carga = d["pld"], d["carga"]
    out = []
    for sm in SM:
        por_mes = defaultdict(dict)
        for ref, hist in (d.get("historico_carga") or {}).get(sm, []):
            por_mes[ref[:7]][ref] = hist
        for mes in sorted(por_mes):
            mag = magnitude_revisoes(por_mes[mes])
            if not mag["horas_revisadas"]:
                continue
            primeira = dict(carga[sm])
            for ref, hist in por_mes[mes].items():
                primeira[ref] = hist[0][1]
            hs = [h for h in pld[sm] if h[:7] == mes and h <= d["ultima_hora"]]
            ok_, _ = pesos_validos([(h, pld[sm][h], primeira.get(h)) for h in hs])
            p_primeira = media_ponderada([(p_, w_) for _, p_, w_ in ok_])
            p_vig = pond_mes.get((sm, mes))
            out.append({"sm": sm, "mes": mes, "horas_revisadas": mag["horas_revisadas"],
                        "max_abs_mwmed": c.r(mag["max_abs"], 3), "quando_max": mag["quando_max"],
                        "media_abs_mwmed": c.r(mag["media_abs"], 3), "max_rel": c.r(mag["max_rel"], 4),
                        "horas_com_troca_de_sinal": mag["horas_com_troca_de_sinal"], "capturas": mag["capturas"],
                        "ponderada_primeira_captura": c.r(p_primeira), "ponderada_vigente": c.r(p_vig),
                        "efeito_na_ponderada": c.r(p_vig - p_primeira) if p_vig is not None and p_primeira is not None else None})
    return out


DIAS_HORA_DIA = 90


def _hora_dia(d):
    """Mapa hora × dia (P011) dos últimos DIAS_HORA_DIA dias corridos até o dia de
    referência, em JSON sob demanda (contrato 5.1): a gold só aponta o arquivo."""
    fim = date.fromisoformat(d["dia_ref"])
    dias_ = [(fim - timedelta(days=DIAS_HORA_DIA - 1 - i)).isoformat() for i in range(DIAS_HORA_DIA)]
    dado = {"gerado_em": base.agora_utc(), "unidade": "R$/MWh nominais", "fuso": "horário de Brasília", "dias": dias_,
            **{sm: [[c.r(d["pld"][sm].get(f"{dia}T{h:02d}:00")) for h in range(24)] for dia in dias_] for sm in SM}}
    base.escreve_gold("pld_hora_dia.json", dado, destino=d.get("destino_csv") or base.SERIES)
    presentes = sum(1 for dia in dias_ if all(f"{dia}T{h:02d}:00" in d["pld"]["SE"] for h in range(24)))
    return {"url": "/energia/series/pld_hora_dia.json", "inicio": dias_[0], "fim": dias_[-1], "dias": DIAS_HORA_DIA,
            "dias_completos_no_recorte": presentes,
            "nota": "Recorte hora × dia dos últimos 90 dias, lido sob demanda; o histórico horário inteiro está em pld_cmo_horario.csv."}


def _periodos(d):
    """Períodos de comparação sobre as horas comuns aos quatro submercados: cada ano civil,
    os últimos 12 meses (365 dias) e os últimos 30 dias até o dia de referência."""
    hc = d["horas_comuns"]
    dref = date.fromisoformat(d["dia_ref"])
    out = []
    for ano in sorted({h[:4] for h in hc}):
        hs = [h for h in hc if h[:4] == ano]
        out.append({"id": ano, "rotulo": ano + (" (parcial)" if ano == d["dia_ref"][:4] and d["dia_ref"][5:] != "12-31" else ""),
                    "horas": hs})
    for dias_, id_, rot in ((365, "12m", "Últimos 12 meses"), (30, "30d", "Últimos 30 dias")):
        ini = (dref - timedelta(days=dias_ - 1)).isoformat()
        out.append({"id": id_, "rotulo": rot, "horas": [h for h in hc if ini <= h[:10]]})
    return out


def _bloco_regional(d):
    """P012: amplitude horária, frequência de separação por par, matriz de diferenças e
    sincronia com o fluxo de intercâmbio verificado na mesma hora (sem diagnóstico causal)."""
    pld, fluxo = d["pld"], d["fluxo"]
    periodos = _periodos(d)
    separacao, amplitude, fluxos = [], [], []
    for per in periodos:
        hs = per["horas"]
        if not hs:
            continue
        amps = [(h, max(pld[s][h] for s in SM) - min(pld[s][h] for s in SM)) for h in hs]
        hmax, amax = max(amps, key=lambda x: x[1])
        av = [a for _, a in amps]
        amplitude.append({"periodo": per["id"], "rotulo": per["rotulo"], "inicio": hs[0], "fim": hs[-1], "horas": len(hs),
                          "horas_com_separacao": sum(1 for a in av if a > TOL + EPS),
                          "frac_com_separacao": c.r(sum(1 for a in av if a > TOL + EPS) / len(hs), 4),
                          "media": c.r(c.media(av)), "p50": c.r(c.quantil(av, 0.5)), "p95": c.r(c.quantil(av, 0.95)),
                          "max": c.r(amax), "quando_max": hmax})
        for a, b in PARES:
            difs = [(h, pld[a][h] - pld[b][h]) for h in hs]
            ab = [abs(x) for _, x in difs]
            hm, dm = max(difs, key=lambda x: abs(x[1]))
            sep = sum(1 for x in ab if x > TOL + EPS)
            separacao.append({"periodo": per["id"], "par": f"{a}_{b}", "horas": len(hs), "horas_separadas": sep,
                              "frac_separadas": c.r(sep / len(hs), 4), "dif_media": c.r(c.media([x for _, x in difs])),
                              "dif_abs_media": c.r(c.media(ab)), "dif_abs_p95": c.r(c.quantil(ab, 0.95)),
                              "dif_max": c.r(dm), "quando_max": hm,
                              "horas_diferenca_de_um_centavo": sum(1 for x in ab if MEIO_CENTAVO < x <= TOL + EPS),
                              "horas_acima_1": sum(1 for x in ab if x > 1.0 + EPS), "horas_acima_10": sum(1 for x in ab if x > 10.0 + EPS)})
        for a, b in FRONTEIRAS:
            f = fluxo.get(f"{a}_{b}", {})
            cont, fl_sep, fl_nsep, n = defaultdict(int), [], [], 0
            for h in hs:
                v = f.get(h)
                if v is None:
                    continue
                n += 1
                s_ = sentido_fluxo(pld[a][h], pld[b][h], v)
                cont[s_] += 1
                (fl_nsep if s_ == "sem_separacao" else fl_sep).append(v)
            n_sep = n - cont["sem_separacao"]
            fluxos.append({
                "periodo": per["id"], "fronteira": f"{a}_{b}", "horas_com_fluxo": n, "horas_separadas": n_sep,
                "do_menor_para_o_maior": cont["do_menor_para_o_maior"], "do_maior_para_o_menor": cont["do_maior_para_o_menor"],
                "fluxo_nulo": cont["nulo"],
                "frac_do_menor_para_o_maior": c.r(cont["do_menor_para_o_maior"] / n_sep, 4) if n_sep else None,
                "fluxo_medio_separadas": c.r(c.media(fl_sep)), "fluxo_medio_nao_separadas": c.r(c.media(fl_nsep)),
                "ultima_hora_fluxo": max(f) if f else None,
            })
    h12 = next(p["horas"] for p in periodos if p["id"] == "12m")
    matriz = {"periodo": "12m", "ordem": list(SM), "dif_media": [], "frac_separadas": []}
    for a in SM:
        matriz["dif_media"].append([None if a == b else c.r(c.media([pld[a][h] - pld[b][h] for h in h12])) for b in SM])
        matriz["frac_separadas"].append([None if a == b else c.r(sum(1 for h in h12 if separado(pld[a][h], pld[b][h])) / len(h12), 4)
                                         for b in SM])
    perfil = {}
    for a, b in PARES:
        por_h = defaultdict(lambda: [0, 0])
        for h in h12:
            x = por_h[int(h[11:13])]
            x[0] += 1
            x[1] += separado(pld[a][h], pld[b][h])
        perfil[f"{a}_{b}"] = [c.r(por_h[hh][1] / por_h[hh][0], 4) if por_h[hh][0] else None for hh in range(24)]
    # CSVs diários
    por_dia = defaultdict(list)
    for h in d["horas_comuns"]:
        por_dia[h[:10]].append(h)
    csv_sep, csv_amp = [], []
    for dia in sorted(por_dia):
        hs = por_dia[dia]
        amps = [(h, max(pld[s][h] for s in SM) - min(pld[s][h] for s in SM)) for h in hs]
        hm, am = max(amps, key=lambda x: x[1])
        csv_amp.append([dia, len(hs), sum(1 for _, a_ in amps if a_ > TOL + EPS), sum(a_ for _, a_ in amps) / len(hs), am, hm[11:16]])
        for a, b in PARES:
            difs = [pld[a][h] - pld[b][h] for h in hs]
            fr = (a, b) if (a, b) in FRONTEIRAS else ((b, a) if (b, a) in FRONTEIRAS else None)
            fl = [fluxo[f"{fr[0]}_{fr[1]}"].get(h) for h in hs] if fr else []
            fl = [x for x in fl if x is not None]
            csv_sep.append([dia, f"{a}_{b}", len(hs), sum(1 for x in difs if abs(x) > TOL + EPS), sum(difs) / len(difs),
                            max(abs(x) for x in difs), f"{fr[0]}_{fr[1]}" if fr else None,
                            (sum(fl) / len(fl)) if fl else None, len(fl) if fr else None])
    _escreve_csv(d, "pld_separacao_diaria.csv", ["data", "par", "horas", "horas_separadas", "dif_media", "dif_abs_max",
                                                  "fronteira", "fluxo_medio_mwmed", "horas_com_fluxo"], csv_sep)
    _escreve_csv(d, "pld_amplitude_diaria.csv", ["data", "horas", "horas_com_separacao", "amplitude_media", "amplitude_max",
                                                  "hora_amplitude_max"], csv_amp)
    return {
        "pares": [f"{a}_{b}" for a, b in PARES],
        "fronteiras": [f"{a}_{b}" for a, b in FRONTEIRAS],
        "regra_separacao": ("Dois submercados estão separados numa hora quando |PLD_A − PLD_B| > R$ 0,01/MWh (mais de um centavo), sempre na mesma "
                            "hora e na mesma publicação da CCEE. Diferenças de exatamente um centavo são frequentes e ficam contadas à parte "
                            "(horas_diferenca_de_um_centavo), sem entrar na separação."),
        "regra_fluxo": ("Fluxo verificado pelo ONS na fronteira, na mesma hora, com sinal positivo da primeira para a segunda ponta. "
                        f"Fluxo de até {FLUXO_NULO:.0f} MWmed em módulo é tratado como nulo. A contagem é descritiva: os limites de "
                        "intercâmbio não estão integrados e nenhuma hora é classificada como congestionada."),
        "periodos": [{"id": p["id"], "rotulo": p["rotulo"], "inicio": p["horas"][0] if p["horas"] else None,
                      "fim": p["horas"][-1] if p["horas"] else None, "horas": len(p["horas"])} for p in periodos],
        "amplitude": amplitude, "separacao": separacao, "matriz": matriz, "perfil_horario_separacao_12m": perfil,
        "fluxos": fluxos,
    }


def _horario_recente(d, horas=168):
    """Janela horária comum aos painéis alinhados (P009 e P012): últimas 168 horas até o
    fim do dia de referência, com PLD, CMO do DESSEM na hora e fluxo nas fronteiras."""
    fim = datetime.fromisoformat(d["dia_ref"] + "T23:00")
    ts = [(fim - timedelta(hours=horas - 1 - i)).strftime("%Y-%m-%dT%H:00") for i in range(horas)]
    out = {"t": ts, "pld": {}, "cmo_dessem": {}, "fluxo": {}, "amplitude": []}
    for sm in SM:
        out["pld"][sm] = [c.r(d["pld"][sm].get(t)) for t in ts]
        out["cmo_dessem"][sm] = [c.r(d["cmo_h"][sm].get(t)) for t in ts]
    for a, b in FRONTEIRAS:
        f = d["fluxo"].get(f"{a}_{b}", {})
        out["fluxo"][f"{a}_{b}"] = [c.r(f.get(t), 1) for t in ts]
    for t in ts:
        vs = [d["pld"][sm].get(t) for sm in SM]
        out["amplitude"].append(c.r(max(vs) - min(vs)) if None not in vs else None)
    return out


def _achado_a02(d, con):
    """A02: sequências de CMO semanal igual a zero, conferidas no arquivo original."""
    dec, sh = d["dec"], d["sh"]
    seq = {sm: sequencias_zero(sorted(dec[sm]["media"].items())) for sm in SM}
    comuns = []
    for s0 in seq["SE"]:
        if all(any(x["inicio"] == s0["inicio"] and x["fim"] == s0["fim"] for x in seq[sm]) for sm in SM):
            comuns.append(s0)
    principal = max(comuns or [x for sm in SM for x in seq[sm]], key=lambda x: x["semanas"], default=None)
    regs = base.registros_como_estavam_em(con, DS_A02)
    orig = {sm: _serie(con, DS_A02, f"cmo_semanal_original.{sm}") for sm in SM}
    pat_orig = {(p, sm): _serie(con, DS_A02, f"cmo_{p}_original.{sm}") for p in ("leve", "media", "pesada") for sm in SM}
    # reconciliação do silver principal (fontes/ons.py) com a releitura do original (este módulo)
    iguais = difere = so_principal = so_original = 0
    exemplos = []
    for sm in SM:
        for s, v in dec[sm]["media"].items():
            w = orig[sm].get(s)
            if w is None:
                so_principal += 1
            elif abs(v - w) <= 1e-9:
                iguais += 1
            else:
                difere += 1
                if len(exemplos) < 10:
                    exemplos.append({"sm": sm, "semana": s, "silver_principal": v, "original_relido": w})
        so_original += sum(1 for s in orig[sm] if s not in dec[sm]["media"])
    out = {"sequencias_por_sm": seq, "sequencia_comum_mais_longa": principal,
           "reconciliacao_silver_principal": {"iguais": iguais, "diferentes": difere, "so_no_silver_principal": so_principal,
                                              "so_na_releitura": so_original, "exemplos_diferenca": exemplos,
                                              "nota": "Diferenças e ausências vêm de capturas em datas distintas do mesmo arquivo anual (o ONS atualiza o arquivo do ano corrente)."}}
    if not principal:
        out.update(status="sem sequência longa de zeros", arquivos=[])
        return out
    ini, fim = principal["inicio"], principal["fim"]
    anos = range(int(ini[:4]), int(fim[:4]) + 1)
    arquivos = []
    for ano in anos:
        r = regs.get(f"CMO_SEMANAL_{ano}", {})
        semanas_no_trecho = sum(1 for s in orig["SE"] if s[:4] == str(ano) and ini <= s <= fim)
        todas_zero_trecho = 0
        for sm in SM:
            for s, v in orig[sm].items():
                if s[:4] == str(ano) and ini <= s <= fim and v == 0 and all(pat_orig[(p, sm)].get(s) == 0 for p in ("leve", "media", "pesada")):
                    todas_zero_trecho += 1
        arquivos.append({"recurso": f"CMO_SEMANAL_{ano}.csv", "url": f"{S3_SEM}CMO_SEMANAL_{ano}.csv", "sha256": r.get("sha256"),
                         "linhas": int(r["linhas"]) if r.get("linhas") else None,
                         "linhas_todas_zero": int(r["linhas_todas_zero"]) if r.get("linhas_todas_zero") else None,
                         "formas_do_zero": json.loads(r["formas_do_zero"]) if r.get("formas_do_zero") else [],
                         "semanas_no_trecho": semanas_no_trecho, "linhas_zeradas_no_trecho": todas_zero_trecho,
                         "linhas_esperadas_no_trecho": semanas_no_trecho * len(SM),
                         "parquet": {"recurso": f"CMO_SEMANAL_{ano}.parquet", "sha256": r.get("parquet_sha256"),
                                     "celulas_iguais": int(r["parquet_celulas_iguais"]) if r.get("parquet_celulas_iguais") else None,
                                     "celulas": int(r["parquet_celulas"]) if r.get("parquet_celulas") else None,
                                     "erro": r.get("parquet_erro")}})
    confirmado = all(a["linhas_zeradas_no_trecho"] == a["linhas_esperadas_no_trecho"] and a["linhas_esperadas_no_trecho"] > 0
                     and a["parquet"]["celulas"] and a["parquet"]["celulas_iguais"] == a["parquet"]["celulas"] for a in arquivos)
    ini_meia, fim_meia = _dmais(ini, -6) + "T00:00", fim + "T23:30"
    dessem = []
    for sm in SM:
        vs = [v for k, v in sh[sm].items() if ini_meia <= k <= fim_meia]
        dessem.append({"sm": sm, "meias_horas": len(vs), "meias_horas_zero": sum(1 for v in vs if v == 0),
                       "frac_zero": c.r(sum(1 for v in vs if v == 0) / len(vs), 4) if vs else None,
                       "media": c.r(c.media(vs)), "max": c.r(max(vs)) if vs else None})
    pld_p = []
    for sm in SM:
        hs = [h for h in d["pld"][sm] if _dmais(ini, -6) <= h[:10] <= fim]
        sit = defaultdict(int)
        if d["lim_dia"]:
            for h in hs:
                sit[situacao_hora(d["pld"][sm][h], d["lim_dia"].get(h[:10], {}))] += 1
        n_lim = len(hs) - sit["sem_limite"] if d["lim_dia"] else 0
        pld_p.append({"sm": sm, "horas": len(hs), "media": c.r(c.media([d["pld"][sm][h] for h in hs])), "horas_com_limite": n_lim,
                      "frac_piso": c.r(sit["piso"] / n_lim, 4) if n_lim else None})
    se_d = next(x for x in dessem if x["sm"] == "SE")
    se_p = next(x for x in pld_p if x["sm"] == "SE")
    texto = (f"Nas {principal['semanas']} semanas operativas datadas pelo ONS de {c.data_br(ini)} a {c.data_br(fim)} (sextas-feiras que encerram "
             f"as semanas; o período vai de {c.data_br(_dmais(ini, -6))} a {c.data_br(fim)}), o CMO semanal do DECOMP publicado pelo ONS "
             "é zero nos quatro subsistemas, na média semanal e nos três patamares. "
             + ("Os zeros estão no arquivo original: CSV e Parquet oficiais conferem célula a célula. " if confirmado else
                "A conferência no arquivo original não fechou em todos os arquivos (ver detalhes). ")
             + f"No mesmo período, o CMO semi-horário do DESSEM foi zero em {_pct(se_d['frac_zero'])} das meias horas do Sudeste/Centro-Oeste"
             + (f" e o PLD do Sudeste/Centro-Oeste ficou no piso em {_pct(se_p['frac_piso'])} das horas"
                + ("." if se_p["horas_com_limite"] == se_p["horas"] else f" com limite vigente conhecido ({se_p['horas_com_limite']} de {se_p['horas']}).")
                if se_p["frac_piso"] is not None else
                "; a permanência do PLD no piso depende dos atos de limites, ainda não disponíveis.")
             + " O conjunto do ONS não informa a razão dos zeros; nenhuma causa é atribuída aqui.")
    perm = (d["dicionario"].get("cmo_semanal:pdf") or {}).get("permissoes") or {}
    zero_admitido = perm.get("val_cmomediasemanal", {}).get("zerado")
    if zero_admitido is not None:
        texto = texto.replace(" O conjunto do ONS não informa", " O dicionário de dados do ONS (PDF, versão de "
                              + str((d["dicionario"].get("cmo_semanal:pdf") or {}).get("data_documento") or "data não lida").replace("-", "/")
                              + (") declara que o campo admite valor zerado." if zero_admitido else ") declara que o campo não admite valor zerado.")
                              + " O conjunto do ONS não informa")
    out.update(status="confirmado no arquivo original" if confirmado else "conferência incompleta",
               dicionario_permite=perm or None,
               periodo={"primeira_semana_inicio": _dmais(ini, -6), "ultima_semana_fim": fim, "semanas": principal["semanas"]},
               arquivos=arquivos, dessem_mesmo_periodo=dessem, pld_mesmo_periodo=pld_p,
               observacao_formato=("O mesmo zero aparece escrito de formas diferentes conforme o arquivo anual (0E-8 em 2022; 0.0 em 2023 e "
                                   "2024). A forma textual muda entre arquivos; o valor numérico é o mesmo e o CSV confere com o Parquet oficial."),
               texto=texto)
    return out


def _achado_a03(d):
    """A03: unidade do CMO semanal no dicionário do ONS e conferência empírica."""
    dic = d["dicionario"]
    dec = d["dec"]
    n = dentro = 0
    fora = []
    for sm in SM:
        for s, v in dec[sm]["media"].items():
            pats = [dec[sm][p].get(s) for p in ("leve", "media_pat", "pesada")]
            if None in pats:
                continue
            n += 1
            if min(pats) - TOL - EPS <= v <= max(pats) + TOL + EPS:
                dentro += 1
            elif len(fora) < 10:
                fora.append({"sm": sm, "semana": s, "media_semanal": v, "leve": pats[0], "media": pats[1], "pesada": pats[2]})
    u_sem = dic.get("cmo_semanal:val_cmomediasemanal", {}).get("unidade")
    u_pat = dic.get("cmo_semanal:val_cmoleve", {}).get("unidade")
    u_sh = dic.get("cmo_semi_horario:val_cmo", {}).get("unidade")
    return {
        "status": "documentado" if u_sem else "dicionário não integrado",
        "dicionario_semanal": {k.split(":", 1)[1]: v for k, v in dic.items() if k.startswith("cmo_semanal:") and not k.endswith(":pdf")},
        "dicionario_semi_horario": {k.split(":", 1)[1]: v for k, v in dic.items() if k.startswith("cmo_semi_horario:") and not k.endswith(":pdf")},
        "pdf": {"cmo_semanal": dic.get("cmo_semanal:pdf"), "cmo_semi_horario": dic.get("cmo_semi_horario:pdf")},
        "unidade_media_semanal_no_dicionario": u_sem, "unidade_patamares_no_dicionario": u_pat, "unidade_semi_horario_no_dicionario": u_sh,
        "verificacao": {"semanas_subsistema": n, "media_entre_min_e_max_dos_patamares": dentro, "fora": fora,
                        "tolerancia": TOL,
                        "leitura": ("Em todas as semanas conferidas a média semanal fica entre o menor e o maior patamar, como uma média "
                                    "ponderada no tempo de valores em R$/MWh." if n and dentro == n else
                                    "Há semanas em que a média semanal fica fora do intervalo dos patamares (ver exemplos).")},
        "decisao": ("A média semanal é exibida em R$/MWh, a mesma unidade dos patamares no dicionário, com a divergência do "
                    f"dicionário ({u_sem or 'não lida'}) declarada ao lado. R$/MW (custo por potência) não é equivalente a R$/MWh "
                    "(custo por energia); a leitura como R$/MWh é inferência apoiada na conferência acima, não correção da fonte."),
    }


def _achado_a09(cp):
    """A09: primeira captura observada de cada dia do PLD versus publicação pela fonte."""
    rows = cp.execute(
        """SELECT o.ref, MIN(v.capturado_em) FROM observacoes o JOIN vintages v ON v.vintage_id=o.vintage_id
           WHERE o.dataset=? AND o.serie='pld.SE' GROUP BY o.ref""", (DS_PLD,)).fetchall()
    origem = dict(cp.execute("SELECT capturado_em, origem FROM vintages WHERE dataset=?", (DS_PLD,)).fetchall())
    por_dia = defaultdict(list)
    for ref, cap in rows:
        por_dia[ref[:10]].append(cap)
    diretas, seed_ate, seed_cap = [], None, None
    for dia in sorted(por_dia):
        cap = max(por_dia[dia])  # o dia só fica completo quando a última hora aparece
        if origem.get(cap) == "coleta_direta":
            ini_dia = datetime.fromisoformat(dia + "T00:00:00-03:00")
            capt = datetime.fromisoformat(cap.replace("Z", "+00:00"))
            elegivel = ini_dia + timedelta(days=2)  # LAT1D: fim do dia (D+1 00h) mais 1 dia
            diretas.append({"dia": dia, "primeira_captura_completa": cap, "horas": len(por_dia[dia]),
                            "antecedencia_ao_inicio_do_dia_h": c.r((ini_dia - capt).total_seconds() / 3600, 2),
                            "elegivel_sob_lat1d_em": elegivel.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
                            "folga_lat1d_h": c.r((elegivel - capt).total_seconds() / 3600, 2)})
        else:
            seed_ate, seed_cap = dia, cap
    rev = cp.execute("""SELECT COUNT(*) FROM (SELECT serie, ref FROM observacoes WHERE dataset=? GROUP BY serie, ref
                        HAVING COUNT(DISTINCT valor) > 1)""", (DS_PLD,)).fetchone()[0]
    vint = cp.execute("SELECT COUNT(*) FROM vintages WHERE dataset=?", (DS_PLD,)).fetchone()[0]
    antes = [x for x in diretas if x["antecedencia_ao_inicio_do_dia_h"] is not None and x["antecedencia_ao_inicio_do_dia_h"] > 0]
    # mesmo last_modified com conteúdo diferente: prova de que a data do portal não acompanha o conteúdo
    mesmo_lm = cp.execute("""SELECT recurso, publicado_em, COUNT(DISTINCT sha256) FROM vintages WHERE dataset=? AND publicado_em IS NOT NULL
                             GROUP BY recurso, publicado_em HAVING COUNT(DISTINCT sha256) > 1""", (DS_PLD,)).fetchall()
    return {
        "status": "distinção mantida; hipótese documentada",
        "publicado_pela_fonte_em": None,
        "motivo_sem_publicacao": "A CCEE não informa a data de publicação de cada hora no arquivo.",
        "last_modified_sem_mudanca": [{"recurso": r_, "last_modified": lm, "conteudos_distintos": n_} for r_, lm, n_ in mesmo_lm],
        "leitura_last_modified": ("O last_modified do recurso no portal da CCEE não acompanha o conteúdo: há arquivos com o mesmo last_modified "
                                  "e conteúdos diferentes entre capturas (ver lista)." if mesmo_lm else
                                  "Nenhum caso de mesmo last_modified com conteúdo diferente entre as capturas integradas."),
        "descricao_fonte": "O PLD é calculado pela CCEE diariamente para cada hora do dia seguinte (descrição oficial no portal de dados abertos da CCEE).",
        "captura_versionada": {"capturado_em": seed_cap, "ultimo_dia": seed_ate,
                               "nota": "Horas até este dia entraram por uma captura versionada única e não informam quando foram publicadas."},
        "dias_com_captura_direta": diretas,
        "dias_capturados_antes_de_comecar": len(antes),
        "vintages_comparadas": vint, "valores_revisados": rev,
        "hipotese_lat1d": ("LAT1D (regra dos backtests de previsão): um dado só é informação se o seu período terminou até 1 dia antes do "
                           "horário de corte. Para o PLD do dia D, isso significa usar o dia só a partir de D+2 às 00h."),
        "folga_minima_lat1d_h": min((x["folga_lat1d_h"] for x in diretas), default=None),
        "impacto": _impacto_lat1d(diretas, antes),
    }


def _impacto_lat1d(diretas, antes):
    """Texto determinístico sobre a hipótese LAT1D a partir das capturas diretas observadas."""
    if not diretas:
        return "Sem dias com captura direta; o backtest sob LAT1D segue como reconstrução por hipótese, sem conferência."
    folga = min(x["folga_lat1d_h"] for x in diretas)
    if folga <= 0:
        return (f"Em pelo menos um dia a primeira captura completa veio depois do instante em que LAT1D permitiria usar o dado "
                f"(folga mínima {_num_br(folga)} h): nesses dias um backtest sob LAT1D usaria informação que o sistema ainda não tinha visto.")
    return (f"Nos {len(diretas)} dias com captura direta, o dia inteiro já estava capturado antes do instante em que LAT1D permite usá-lo "
            f"(folga mínima de {_num_br(folga)} h); em {len(antes)} deles a captura ocorreu antes de o próprio dia começar, compatível com o "
            "cálculo na véspera descrito pela CCEE. Nesses dias LAT1D não antecipa informação. A amostra é curta e não prova o "
            "comportamento da série histórica, cuja publicação original não é conhecida: o backtest continua sendo reconstrução por hipótese.")


# Exemplo de liquidação do P008: quantidades HIPOTÉTICAS, escolhidas só para mostrar o
# mecanismo (as duas diferenças se compensam para o exemplo não sugerir sobra no sistema).
# Não são dados de nenhum agente; o único número real do exemplo é o PLD da hora.
EXEMPLO_AGENTES = (
    {"id": "consumidor", "rotulo": "Consumidor hipotético", "compras_contratadas_mwh": 100.0, "vendas_contratadas_mwh": 0.0,
     "geracao_verificada_mwh": 0.0, "consumo_verificado_mwh": 120.0},
    {"id": "gerador", "rotulo": "Gerador hipotético", "compras_contratadas_mwh": 0.0, "vendas_contratadas_mwh": 100.0,
     "geracao_verificada_mwh": 120.0, "consumo_verificado_mwh": 0.0},
)
BASE_EXEMPLO = ("ren957_art2_xiii", "ren957_art5_p4", "d5163_art57_caput", "ren957_art82", "d5163_art57_p5")


def exemplo_liquidacao(pld_hora, agentes=EXEMPLO_AGENTES):
    """Diferença de cada agente na hora e seu valor ao PLD (exemplo sintético).

    diferença = geração verificada + compras contratadas − consumo verificado − vendas
    contratadas (MWh); valor = diferença × PLD (R$). Diferença positiva é crédito e
    negativa é débito, convenção do exemplo para a leitura de "exposições valoradas ao
    PLD" (REN ANEEL nº 957/2021, art. 5º, § 4º)."""
    out = []
    for a in agentes:
        dif = (a["geracao_verificada_mwh"] + a["compras_contratadas_mwh"]
               - a["consumo_verificado_mwh"] - a["vendas_contratadas_mwh"])
        out.append({**a, "diferenca_mwh": dif, "valor_rs": c.r(dif * pld_hora, 2),
                    "resultado": "crédito" if dif > 0 else ("débito" if dif < 0 else "sem diferença")})
    return out


def _normas(con):
    """Passagens normativas do P008 como estão no silver: citadas só se conferidas no
    documento da vintage vigente."""
    regs = base.registros_como_estavam_em(con, DS_NORMAS)
    vig = ckan.vintages_vigentes(con, DS_NORMAS)
    citadas, nao_conferidas = [], []
    for tid, doc_id, disp, _ in normas_pld.TRECHOS:
        r, doc, v = regs.get(tid, {}), normas_pld.DOCUMENTOS[doc_id], vig.get(doc_id)
        if not v or not r:
            nao_conferidas.append({"id": tid, "documento": doc_id, "dispositivo": disp, "motivo": "documento não coletado"})
            continue
        if str(r.get("confere")) != "1":
            motivo = regs.get(doc_id, {}).get("extracao")
            nao_conferidas.append({"id": tid, "documento": doc_id, "dispositivo": disp,
                                   "motivo": "passagem não encontrada no texto baixado" + (f" (extração: {motivo})" if motivo else "")})
            continue
        citadas.append({"id": tid, "orgao": doc["orgao"], "texto": r.get("texto"), "documento": doc_id, "dispositivo": disp,
                        "origem": f"{doc['titulo']}, {disp}", "url": doc["url_oficial"]})
    documentos = {}
    for doc_id, doc in normas_pld.DOCUMENTOS.items():
        v = vig.get(doc_id)
        documentos[doc_id] = {"orgao": doc["orgao"], "titulo": doc["titulo"], "url": doc["url_oficial"],
                              "url_copia": doc["url"] if doc["url"] != doc["url_oficial"] else None, "licenca": doc["licenca"],
                              "nota": doc["nota"], "capturado_em": v["capturado_em"] if v else None,
                              "sha256": v["sha256"] if v else None, "arquivo": v["arquivo"] if v else None}
    return citadas, nao_conferidas, documentos


def _exemplo(d, citadas):
    pld_se = d["pld"]["SE"]
    hs = [f"{d['dia_ref']}T{i:02d}:00" for i in range(24)]
    h = max(hs, key=lambda x: (pld_se[x], -int(x[11:13])))  # maior PLD; empate fica com a hora mais cedo
    ids = {x["id"] for x in citadas}
    return {
        "natureza": "EXEMPLO_SINTETICO",
        "aviso": ("Exemplo sintético para explicar o mecanismo. As quantidades são hipotéticas e não representam a contabilização "
                  "de nenhum agente nem de nenhum mês; o único número real é o PLD da hora indicada, publicado pela CCEE."),
        "pld": {"valor": c.r(pld_se[h]), "sm": "SE", "nome": c.NOME_SUBMERCADO["SE"], "hora": h, "unidade": "R$/MWh",
                "fonte": "CCEE, PLD_HORARIO", "regra_escolha": "hora de maior PLD do Sudeste/Centro-Oeste no dia de referência"},
        "formula": ("diferença (MWh) = geração verificada + compras contratadas − consumo verificado − vendas contratadas; "
                    "valor no mercado de curto prazo (R$) = diferença × PLD da hora"),
        "agentes": exemplo_liquidacao(pld_se[h]),
        "leitura": ("O preço de cada contrato é acertado entre as partes e não entra na conta: só a diferença entre o que foi contratado "
                    "e o que foi verificado é valorada ao PLD. Neste exemplo as duas diferenças se compensam."),
        "simplificacoes": [
            "Uma hora e um submercado. A contabilização real soma todas as horas do mês e a liquidação financeira é multilateral, com periodicidade máxima mensal (REN ANEEL nº 957/2021, art. 82).",
            "Sem perdas de transmissão: o cálculo real ajusta as quantidades pelo fator de perdas (Decreto nº 5.163/2004, art. 57, § 5º).",
            "Sem encargos, penalidades, garantias financeiras, sazonalização e modulação de contratos, nem mecanismos de compartilhamento de risco.",
            "Contratos, geração e consumo no mesmo submercado: o exemplo não trata diferenças de preço entre submercados.",
            "Crédito para diferença positiva e débito para negativa é a convenção deste exemplo; as regras algébricas da CCEE não estão acessíveis (HTTP 403).",
        ],
        "base_normativa": [t for t in BASE_EXEMPLO if t in ids],
    }


def _conceito(d, con=None):
    """P008: textos primários acessíveis sobre o que o PLD remunera e como é formado.
    A CCEE bloqueia o acesso (HTTP 403) às regras de comercialização; ficam as normas que
    a Convenção de Comercialização cita como base (Decreto nº 5.163/2004 e REN nº 957/2021),
    as descrições oficiais já versionadas da CCEE e as dos conjuntos do ONS, e os atos de
    limites. O exemplo de liquidação é sintético e rotulado como tal."""
    seed_dir = os.path.join(base.SEED, "ccee_pld_horario", "v20260927T154402Z")
    fontes = []
    try:
        with open(os.path.join(seed_dir, "package_show.json"), encoding="utf-8") as f:
            pac = json.load(f)["result"]
        with open(os.path.join(seed_dir, "MANIFESTO.json"), encoding="utf-8") as f:
            man = json.load(f)
        cap, sha = man["capturado_em"], man["package_show"]["sha256"]
        fontes.append({"id": "ccee_pld", "orgao": "CCEE", "texto": (pac.get("organization") or {}).get("description"),
                       "origem": "Descrição da organização Preço de Liquidação das Diferenças no portal de dados abertos da CCEE (package_show de PLD_HORARIO)",
                       "url": "https://dadosabertos.ccee.org.br/dataset/pld_horario", "capturado_em": cap, "sha256": sha,
                       "arquivo": "pipeline/energia/seed/ccee_pld_horario/v20260927T154402Z/package_show.json"})
        for r in pac.get("resources", []):
            if r.get("name") == "pld_historico_semanal_2001_2020":
                fontes.append({"id": "ccee_pld_semanal_ate_2020", "orgao": "CCEE", "texto": r.get("description"),
                               "origem": "Descrição do recurso pld_historico_semanal_2001_2020 no conjunto PLD_HORARIO da CCEE",
                               "url": "https://dadosabertos.ccee.org.br/dataset/pld_horario", "capturado_em": cap, "sha256": sha,
                               "arquivo": "pipeline/energia/seed/ccee_pld_horario/v20260927T154402Z/package_show.json"})
    except Exception as e:  # seed ausente: declarado
        fontes.append({"id": "ccee_pld", "orgao": "CCEE", "texto": None, "origem": f"captura versionada indisponível: {e}"})
    for id_, chave, url in (("ons_cmo_semanal", "semanal", URL_SEM), ("ons_cmo_semi_horario", "semi_horario", URL_SH)):
        fontes.append({"id": id_, "orgao": "ONS", "texto": d["notas"].get(chave), "origem": "Descrição do conjunto no portal de dados abertos do ONS",
                       "url": url, "capturado_em": d["notas"].get(chave + "_capturado_em"), "sha256": None, "arquivo": None})
    # os atos anuais de limites (trecho literal, dispositivo e URL de cada um) ficam em limites.atos
    citadas, nao_conferidas, documentos = _normas(con) if con is not None else ([], [], {})
    return {
        "fontes_textuais": citadas + fontes,
        "documentos_normativos": documentos,
        "normas_nao_conferidas": nao_conferidas,
        "atos_de_limites": "limites.atos",
        "exemplo_liquidacao": _exemplo(d, citadas),
        "bloqueios": [_bloqueio_cepel(con)] + [{"fonte": "CCEE: regras de comercialização (módulo Preço de Liquidação das Diferenças) e painéis de preços",
                       "url": "https://www.ccee.org.br/precos/painel-precos",
                       "evidencia": "HTTP 403 com página \"Acesso bloqueado\" do firewall da origem em 30/09/2026, também para o portal de dados abertos e para o servidor de download",
                       "consequencia": ("A regra algébrica de cálculo e de contabilização não é citada. Os textos usam o Decreto nº 5.163/2004, "
                                        "a Convenção de Comercialização (REN ANEEL nº 957/2021), as descrições oficiais já versionadas e os atos da ANEEL.")},
                      {"fonte": "ANEEL: biblioteca de atos (www2.aneel.gov.br/cedoc)", "url": normas_pld.URL_REN957_OFICIAL,
                       "evidencia": "HTTP 403 com desafio de navegador (Cloudflare) em 30/09/2026",
                       "consequencia": ("A REN nº 957/2021 é lida da cópia do Internet Archive do mesmo endereço oficial, de "
                                        + normas_pld.COPIA_REN957_EM[:10] + ", com sha256 registrado; nenhuma alteração posterior à cópia está coberta.")}],
    }


def _bloqueio_cepel(con):
    """Manuais de metodologia do DECOMP e do NEWAVE: busca registrada na coleta. O manual
    do DESSEM está integrado (normas); os dois outros não foram localizados publicamente."""
    linhas = []
    if con is not None:
        for termo in MODELOS_SEM_MANUAL:
            row = con.execute("SELECT tentado_em, ok, detalhe FROM coletas WHERE dataset=? AND recurso=? ORDER BY rowid DESC LIMIT 1",
                              (DS_NORMAS, f"cepel_{termo.lower()}")).fetchone()
            linhas.append(f"{termo}: " + (f"busca de {row[0]}, {row[2].split(' ', 1)[-1]}" if row else "nenhuma busca registrada"))
    return {"fonte": "CEPEL: manuais de metodologia do DECOMP e do NEWAVE", "url": normas_pld.URL_CEPEL,
            "evidencia": ("; ".join(linhas) or "nenhuma busca registrada nesta base") + ". O manual de metodologia do DESSEM está "
                         "publicado no mesmo site e foi integrado.",
            "consequencia": ("A formulação do DECOMP e do NEWAVE não é citada de documento do desenvolvedor. O uso dos dois modelos pelo "
                             "ONS (horizonte, discretização, prazos, acoplamento pela função de custo futuro) vem dos Procedimentos de Rede "
                             "do ONS (Submódulos 2.4, 4.3 e 4.5) e do manual do DESSEM, com cada passagem conferida no PDF baixado; o "
                             "painel Entenda o preço fica com limitação declarada.")}


def _cobertura_dessem(sh):
    """Meias horas esperadas e presentes por ano (SE como referência: os quatro subsistemas
    vêm na mesma linha do tempo) e dias sem nenhuma meia hora publicada."""
    out = []
    todas = sorted(set().union(*(set(sh[sm]) for sm in SM)))
    if not todas:
        return out
    ult = todas[-1]
    for ano in range(int(todas[0][:4]), int(ult[:4]) + 1):
        ini = date(ano, 1, 1)
        fim = min(date(ano, 12, 31), date.fromisoformat(ult[:10]))
        dias_esp = (fim - ini).days + 1
        por_dia = defaultdict(int)
        for k in sh["SE"]:
            if k[:4] == str(ano):
                por_dia[k[:10]] += 1
        ausentes = [(ini + timedelta(days=i)).isoformat() for i in range(dias_esp) if por_dia.get((ini + timedelta(days=i)).isoformat(), 0) == 0]
        incompletos = [k for k, n in por_dia.items() if 0 < n < 48]
        out.append({"ano": ano, "meias_horas_esperadas": dias_esp * 48, "meias_horas_presentes": sum(por_dia.values()),
                    "dias_ausentes": ausentes, "dias_incompletos": sorted(incompletos),
                    "presentes_por_sm": {sm: sum(1 for k in sh[sm] if k[:4] == str(ano)) for sm in SM}})
    return out


def _relatorios_importacao(con):
    regs = base.registros_como_estavam_em(con, DS_CONTROLE)
    vig = ckan.vintages_vigentes(con, DS_SH)
    out = {}
    for rec, v in sorted(vig.items()):
        try:
            out[rec] = json.loads(regs.get(v["vintage_id"], {}).get("importado") or "null")
        except ValueError:
            out[rec] = None
    return out


def construir(con, ctx):
    cp = ctx.get("con_principal") or base.conecta()
    pld = {sm: _serie(cp, DS_PLD, f"pld.{sm}") for sm in SM}
    if not all(pld.values()):
        return c.stub(GOLD, "PLD horário ausente no silver principal para algum submercado")
    sh = {sm: _serie(con, DS_SH, f"cmo_sh.{sm}") for sm in SM}
    if not all(sh.values()):
        return c.stub(GOLD, "CMO semi-horário (DESSEM) ausente no silver da família ons_cmo")
    dec = {sm: {"media": _serie(cp, DS_CMO_SEM, f"cmo_semanal.{sm}"), "leve": _serie(cp, DS_CMO_SEM, f"cmo_leve.{sm}"),
                "media_pat": _serie(cp, DS_CMO_SEM, f"cmo_media.{sm}"), "pesada": _serie(cp, DS_CMO_SEM, f"cmo_pesada.{sm}")}
           for sm in SM}
    if not all(dec[sm]["media"] for sm in SM):
        return c.stub(GOLD, "CMO semanal (DECOMP) ausente no silver principal")
    carga = {sm: _serie(cp, DS_BAL, f"carga.{sm}") for sm in SM}
    fluxo = {f"{a}_{b}": _serie(cp, DS_INT, f"fluxo.{a}_{b}") for a, b in FRONTEIRAS}
    ipca = _serie(con, DS_IPCA, "ipca.indice")

    horas_comuns = sorted(set.intersection(*(set(pld[sm]) for sm in SM)))
    por_dia = defaultdict(list)
    for h in horas_comuns:
        por_dia[h[:10]].append(h)
    dias_completos = sorted(k for k, v in por_dia.items() if len(v) == 24)
    if not dias_completos:
        return c.stub(GOLD, "nenhum dia completo do PLD com os quatro submercados")
    dia_ref = dias_completos[-1]
    ultima_hora = dia_ref + "T23:00"
    horas_comuns = [h for h in horas_comuns if h <= ultima_hora]
    diario = {sm: {k: sum(pld[sm][h] for h in por_dia[k]) / 24 for k in dias_completos} for sm in SM}

    dado, origem, motivo = carrega_limites(ctx)
    atos, rejeitados = normaliza_atos(dado) if dado else ([], [])
    if dado and not atos:
        motivo = "nenhum ato válido no arquivo de limites"
    pendencias_limites = []
    if atos:
        # nível de conferência de cada ato (texto do ato ou documento do processo): sem ele a
        # gold não distingue o ato lido do valor tirado do voto ou da nota técnica
        atos = enriquece_atos(atos, ctx.get("conferencia_limites"), ctx.get("documentos_regulacao"))
        try:
            from pipeline.energia import regulatorio
            pendencias_limites = (ctx.get("conferencia_limites") or regulatorio.conferencia_limites()).get("pendencias") or []
        except Exception:
            pendencias_limites = []
    todos_dias = [(date.fromisoformat(INICIO) + timedelta(days=i)).isoformat()
                  for i in range((date.fromisoformat(dia_ref) - date.fromisoformat(INICIO)).days + 1)]
    lim_dia = {dia: limites_vigentes(atos, dia) for dia in todos_dias} if atos else {}
    # conferência entre módulos: a regra de vigência do módulo Regulação (limites_em) aplicada
    # aos mesmos atos tem de dar os mesmos limites e atos em cada dia. É a MESMA regra escrita
    # em outro arquivo (mesmo filtro, mesmo desempate): prova que os dois módulos leem os atos
    # do mesmo jeito, não que a regra está certa. A conferência dos valores contra o texto do
    # ato vigente é feita à parte (_confere_ato_vigente).
    rec_lim = None
    if atos and origem and origem.startswith("pipeline.energia.regulatorio"):
        try:
            from pipeline.energia import regulatorio
            difs = [dia for dia in todos_dias if any(regulatorio.limites_em(dia, dado["atos"]).get(k) != lim_dia[dia].get(k)
                                                     for k in CAMPOS_LIMITE + tuple(f"ato_{x}" for x in CAMPOS_LIMITE))]
            rec_lim = {"dias": len(todos_dias), "divergentes": len(difs), "exemplos": difs[:5]}
        except Exception as e:  # função ausente ou atos em outro formato: registrado como ressalva
            rec_lim = {"dias": len(todos_dias), "divergentes": None, "erro": f"{type(e).__name__}: {str(e)[:200]}"}

    dic_regs = base.registros_como_estavam_em(con, DS_DIC)
    dicionario = {}
    for k, v in dic_regs.items():
        if k.endswith(":pdf"):
            dicionario[k] = {"sha256": v.get("sha256"), "data_documento": v.get("data_documento"),
                             "versoes": json.loads(v["versoes"]) if v.get("versoes") else None,
                             "permissoes": json.loads(v["permissoes"]) if v.get("permissoes") else None}
        else:
            dicionario[k] = v
    meta_sh, meta_sem = ckan.meta_local(DS_SH), ckan.meta_local(DS_A02)
    snap_sh, snap_a02, snap_dic, snap_ipca, snap_normas = (c.snapshot_de(con, x) for x in (DS_SH, DS_A02, DS_DIC, DS_IPCA, DS_NORMAS))
    snap_pld, snap_sem, snap_bal, snap_int = (c.snapshot_de(cp, x) for x in (DS_PLD, DS_CMO_SEM, DS_BAL, DS_INT))
    notas = {"semanal": (meta_sem.get("notas") or "").split("-----")[0].strip() or None,
             "semanal_capturado_em": c.ultima_captura(snap_a02),
             "semi_horario": (meta_sh.get("notas") or "").split("-----")[0].strip() or None,
             "semi_horario_capturado_em": c.ultima_captura(snap_sh),
             "ccee_pld": None}
    try:
        with open(os.path.join(base.SEED, "ccee_pld_horario", "v20260927T154402Z", "package_show.json"), encoding="utf-8") as f:
            notas["ccee_pld"] = (json.load(f)["result"].get("organization") or {}).get("description")
    except Exception:
        pass

    cmo_h = {sm: cmo_horario(sh[sm]) for sm in SM}
    citadas_ids = {x["id"] for x in _normas(con)[0]}
    d = {"pld": pld, "sh": sh, "cmo_h": cmo_h, "dec": dec, "carga": carga, "fluxo": fluxo, "ipca": ipca,
         "horas_comuns": horas_comuns, "dias_completos_set": set(dias_completos), "dia_ref": dia_ref, "ultima_hora": ultima_hora,
         "diario": diario, "atos": atos, "atos_rejeitados": rejeitados, "lim_dia": lim_dia, "limites_motivo": motivo,
         "limites_origem": origem, "limites_conferido_em": dado.get("conferido_em") if isinstance(dado, dict) else None,
         "pendencias_limites": pendencias_limites, "momento": momento_do_calculo(citadas_ids),
         "historico_carga": {sm: base.revisoes_da_serie(cp, DS_BAL, f"carga.{sm}") for sm in SM},
         "dicionario": dicionario, "notas": notas, "destino_csv": ctx.get("destino_csv")}

    # CSV horário alinhado (CMO do DESSEM na hora e PLD)
    horas_csv = sorted(set().union(*(set(pld[sm]) for sm in SM)))
    _escreve_csv(d, "pld_cmo_horario.csv", ["data_hora_local"] + [f"CMO_{sm}" for sm in SM] + [f"PLD_{sm}" for sm in SM],
                     [[h] + [cmo_h[sm].get(h) for sm in SM] + [pld[sm].get(h) for sm in SM] for h in horas_csv if h <= ultima_hora])

    bloco_cmo = _bloco_cmo_pld(d)
    bloco_lim = _bloco_limites(d)
    bloco_hist = _bloco_historico(d)
    bloco_reg = _bloco_regional(d)
    recente = _horario_recente(d)
    a02 = _achado_a02(d, con)
    a03 = _achado_a03(d)
    a09 = _achado_a09(cp)
    conceito = _conceito(d, con)
    cobertura_sh = _cobertura_dessem(sh)
    rel_imp = _relatorios_importacao(con)

    # controles automáticos (seção 11.7): resultado calculado nesta execução
    controles = []

    def controle(nome, ok, detalhe, ressalva=False):
        controles.append({"nome": nome, "resultado": "aprovado" if ok else ("ressalva" if ressalva else "reprovado"), "detalhe": detalhe})

    inval = sum((r or {}).get("invalidos", 0) for r in rel_imp.values())
    dup = sum((r or {}).get("duplicados", 0) for r in rel_imp.values())
    fora = sum((r or {}).get("fora_da_grade", 0) + (r or {}).get("subsistema_desconhecido", 0) for r in rel_imp.values())
    controle("CMO semi-horário: esquema e domínio", inval == 0 and dup == 0 and fora == 0,
             f"{inval} valores inválidos, {dup} meias horas duplicadas, {fora} linhas fora da grade ou de subsistema desconhecido nos arquivos vigentes")
    aus = [(x["ano"], len(x["dias_ausentes"])) for x in cobertura_sh if x["dias_ausentes"]]
    controle("CMO semi-horário: registros esperados por dia", not aus,
             "dias sem nenhuma meia hora publicada: " + ("; ".join(f"{a}: {n}" for a, n in aus) if aus else "nenhum"), ressalva=True)
    cs = bloco_cmo["alinhamento"]["convencao_semana"]["SE"]
    controle("Convenção de data do CMO semanal (sexta que encerra a semana)",
             (cs["corr_semana_que_termina_na_data"] or 0) > (cs["corr_semana_seguinte"] or 0),
             f"correlação com o DESSEM da semana que termina na data {_num_br(cs['corr_semana_que_termina_na_data'] or 0, 3)} contra "
             f"{_num_br(cs['corr_semana_seguinte'] or 0, 3)} da semana seguinte (SE, {cs['semanas']} semanas)")
    cm = bloco_cmo["alinhamento"]["convencao_meia_hora"]["SE"]
    controle("Convenção da meia hora do DESSEM (instante = início)", (cm["erro_abs_medio_inicio"] or 0) < (cm["erro_abs_medio_fim"] or 0),
             f"erro absoluto médio contra o PLD: {_num_br(cm['erro_abs_medio_inicio'] or 0)} (início) contra {_num_br(cm['erro_abs_medio_fim'] or 0)} "
             f"(fim) R$/MWh, {cm['horas']} horas, {cm['filtro']}")
    rec = a02["reconciliacao_silver_principal"]
    controle("CMO semanal: silver principal contra releitura do arquivo original", rec["diferentes"] == 0,
             f"{rec['iguais']} semanas-subsistema iguais, {rec['diferentes']} diferentes, {rec['so_no_silver_principal']} só no silver principal, {rec['so_na_releitura']} só na releitura",
             ressalva=True)
    if bloco_lim.get("disponivel"):
        ab = sum(x["controle_abaixo_do_piso"] for x in bloco_lim["permanencia_anual"])
        ac = sum(x["controle_acima_do_teto"] for x in bloco_lim["permanencia_anual"])
        ae = sum(x["controle_dias_acima_estrutural"] for x in bloco_lim["permanencia_anual"])
        controle("PLD dentro dos limites dos atos", ab == 0 and ac == 0 and ae == 0,
                 f"{ab} horas abaixo do piso, {ac} horas acima do teto horário, {ae} dias com média acima do teto estrutural")
    else:
        controle("PLD dentro dos limites dos atos", False, f"não executado: {motivo}", ressalva=True)
    if rec_lim is not None:
        controle("Limites vigentes por dia: mesma leitura do módulo Regulação (limites_em)", rec_lim.get("divergentes") == 0,
                 (f"{rec_lim['dias']} dias conferidos, {rec_lim['divergentes']} divergentes; é a mesma regra de vigência escrita no módulo "
                  "Regulação: confere que os dois módulos leem os atos do mesmo jeito, não é conferência independente da regra (o valor "
                  "do ato vigente é conferido no PDF do ato em outro controle)" if rec_lim.get("divergentes") is not None
                  else f"não executado: {rec_lim.get('erro')}"), ressalva=rec_lim.get("divergentes") is None)
    eq = bloco_cmo["equivalencia_csv"]
    controle("Equivalência gold e CSV semanal", eq["divergentes"] == 0 and eq["celulas"] > 0,
             f"{eq['celulas']} células (semana, submercado e produto) relidas do CSV pld_cmo_semanal.csv, {eq['divergentes']} divergentes")
    ret = bloco_hist["ponderacao"]["horas_retiradas"]
    controle("Carga do ONS usada como peso: valores positivos", not ret,
             ("nenhuma hora com carga menor ou igual a zero nos meses publicados" if not ret else
              "horas com carga menor ou igual a zero retiradas da média ponderada: "
              + "; ".join(f"{x['sm']} {x['mes']}: {x['horas']}" for x in ret)), ressalva=True)
    pubs = _publicacoes_conferidas(con, DS_SH)
    controle("Data de publicação do CMO semi-horário conferida no S3 (ETag igual ao MD5 do arquivo capturado)",
             pubs["conferida"] == pubs["arquivos"] and pubs["arquivos"] > 0,
             f"{pubs['conferida']} de {pubs['arquivos']} arquivos vigentes conferidos; {pubs['nao_conferida']} não conferidos "
             f"(publicação desconhecida); {pubs['sem_registro']} sem conferência registrada", ressalva=True)
    ato_ref = _confere_ato_vigente(d, ctx)
    if ato_ref is not None:
        controle("Ato vigente do piso no dia de referência: trecho e valor conferidos no PDF do ato", ato_ref["confere"],
                 ato_ref["detalhe"], ressalva=not ato_ref.get("arquivo"))

    # proveniências
    cap_pld = c.ultima_captura(snap_pld)
    comum_lim = ["Valores nominais em R$/MWh, salvo a série em moeda constante."]
    lim_ccee = ["A CCEE não informa a data de publicação de cada hora; ver achado A09.",
                "O portal da CCEE respondeu HTTP 403 (Acesso bloqueado) ao ambiente de construção; o PLD vem das capturas integradas pelo pipeline de operação."]
    periodo_sh = {"inicio": min(sh["SE"]), "fim": max(sh["SE"])}
    lim_dessem = ["Valor estimado pelo modelo DESSEM e publicado pelo ONS (\"Este CMO é estimado pelo modelo DESSEM\", descrição do "
                  "conjunto): é resultado de modelo da fonte, não medição.",
                  "O ONS avisa que os dados passam por consistência recorrente e podem mudar depois de publicados; revisões são detectadas entre capturas.",
                  "O conjunto não identifica deck, versão nem revisão do modelo de cada valor.",
                  "Há dias sem nenhuma meia hora publicada (ver cobertura)."]
    if d["momento"]["dessem_semi_horario"]:
        lim_dessem.append("O CMO de um dia é calculado na véspera (D-1) para a programação do dia D (Procedimentos de Rede, Submódulo 2.4, "
                          "item 2.5.1.2): por isso o arquivo já traz o dia seguinte, que é valor programado, não realizado.")
    lim_pond = [bloco_hist["ponderacao"]["ressalva"],
                "Mês parcial marcado; a ponderada usa só as horas com carga publicada e positiva (campo mesmas_horas).",
                "Moeda constante é perspectiva adicional; o IPCA mede preços ao consumidor, não custos de energia."]
    if ret:
        lim_pond.append("Ressalva: o ONS publicou carga menor ou igual a zero em algumas horas; elas saíram da média ponderada ("
                        + "; ".join(f"{x['sm']} {x['mes']}: {x['horas']} horas" for x in ret) + ").")
    rc = bloco_hist["ponderacao"]["revisoes_carga"]
    if rc:
        lim_pond.append("A carga do ONS foi revista entre capturas em " + "; ".join(
            f"{x['sm']} {x['mes']} ({x['horas_revisadas']} horas, até {_num_br(x['max_abs_mwmed'], 1)} MWmed"
            + (f", efeito de {_br(x['efeito_na_ponderada'])}/MWh na ponderada" if x["efeito_na_ponderada"] is not None else "") + ")"
            for x in rc) + "; ver ponderacao.revisoes_carga.")
    fonte_rel = _fonte_composta(c.FONTE_CCEE_PLD, FONTE_SH, *([_fonte_atos(atos)] if atos else []))
    prov = {
        "cmo_semi_horario": c.proveniencia(
            indicador="CMO semi-horário por subsistema (DESSEM)", natureza="ESTIMADO", fonte=FONTE_SH, unidade="R$/MWh",
            frequencia="semi-horária", periodo=periodo_sh, cobertura=periodo_sh, capturado_em=c.ultima_captura(snap_sh), snapshot=snap_sh,
            transformacoes=["leitura do CSV anual do ONS", "instante local (início da meia hora) em AAAA-MM-DDTHH:MM", "vazio mantido como ausência e zero como zero",
                            "data de publicação = Last-Modified do objeto no S3 do ONS, conferido pelo ETag igual ao MD5 do arquivo capturado"],
            limitacoes=lim_dessem, download="/energia/series/pld_cmo_horario.csv", notas_fonte=notas["semi_horario"]),
        "cmo_horario": c.proveniencia(
            indicador="CMO do DESSEM na hora (média das duas meias horas)", natureza="CALCULADO", fonte=FONTE_SH, unidade="R$/MWh",
            frequencia="horária", periodo=periodo_sh, cobertura=periodo_sh, capturado_em=c.ultima_captura(snap_sh), snapshot=snap_sh,
            transformacoes=["média simples das meias horas que começam em h:00 e h:30"], formula="CMO_h = (CMO_{h:00} + CMO_{h:30}) ÷ 2",
            limitacoes=["Calculado sobre valores estimados pelo modelo DESSEM (natureza da fonte: estimado).",
                        "Hora com uma meia hora ausente fica sem valor.",
                        "A média alinha a resolução com o PLD horário, mas não torna o CMO do ONS igual à base de cálculo da CCEE."],
            download="/energia/series/pld_cmo_horario.csv"),
        "comparacao_semanal": c.proveniencia(
            indicador="CMO semanal (DECOMP), média semanal do DESSEM e média semanal do PLD na mesma semana operativa",
            natureza="CALCULADO", fonte=_fonte_composta(FONTE_SEM, FONTE_SH, c.FONTE_CCEE_PLD), unidade="R$/MWh",
            frequencia="semana operativa (sábado a sexta)", periodo={"inicio": bloco_cmo["semanal"]["inicio"][0], "fim": bloco_cmo["semanal"]["fim"][-1]},
            cobertura={"inicio": bloco_cmo["semanal"]["inicio"][0], "fim": bloco_cmo["semanal"]["fim"][-1]}, capturado_em=cap_pld,
            snapshot=snap_sem, publicacao_informada=False,
            transformacoes=["DECOMP: valor semanal como publicado", "DESSEM: média das 336 meias horas da semana", "PLD: média das 168 horas da semana"],
            formula="DESSEM_sem = Σ CMO_meia ÷ 336; PLD_sem = Σ PLD_h ÷ 168; diferenças em R$/MWh (nunca razão)",
            limitacoes=comum_lim + lim_ccee + ["Os dois CMO são estimados por modelo pelo ONS (DECOMP e DESSEM); o PLD é o preço publicado pela CCEE.",
                                               "Os três valores são produtos diferentes (modelo, resolução e regras de cálculo); a diferença entre eles não é explicada por estes dados.",
                                               "Semana com meia hora ou hora ausente fica sem média."],
            download="/energia/series/pld_cmo_semanal.csv", notas_fonte=notas["semanal"]),
        "relacao_pld_cmo": c.proveniencia(
            indicador="Diferença entre o PLD e o CMO do DESSEM na mesma hora, por ano, submercado e situação frente aos limites",
            natureza="CALCULADO", fonte=fonte_rel, unidade="R$/MWh", frequencia="horária; resumo anual",
            periodo={"inicio": INICIO + "T00:00", "fim": ultima_hora}, cobertura={"inicio": INICIO + "T00:00", "fim": ultima_hora},
            capturado_em=cap_pld, snapshot=snap_pld, publicacao_informada=False,
            transformacoes=["CMO do DESSEM na hora (média das duas meias horas)", "situação do PLD na hora pelos limites vigentes (igualdade ao centavo)",
                            "horas entre os limites em dia com a média no teto estrutural ficam numa classe à parte"],
            formula="Δ_h = PLD_h − CMO_h; média, média do módulo e mediana do módulo por ano e submercado",
            limitacoes=comum_lim + lim_ccee + ["O CMO é estimado por modelo do ONS; o PLD é o preço publicado pela CCEE com limites: as séries não são equivalentes.",
                                               "Estatística descritiva: a diferença não é explicada por estes dados."],
            download="/energia/series/pld_cmo_horario.csv"),
        "historico_mensal": c.proveniencia(
            indicador="PLD médio mensal: média temporal, média ponderada pela carga e média temporal em moeda constante",
            natureza="CALCULADO", fonte=_fonte_composta(c.FONTE_CCEE_PLD, FONTE_BAL, FONTE_IPCA), unidade="R$/MWh",
            frequencia="mensal", periodo={"inicio": INICIO[:7], "fim": dia_ref[:7]}, cobertura={"inicio": INICIO, "fim": dia_ref},
            capturado_em=cap_pld, snapshot=snap_pld, publicacao_informada=False,
            transformacoes=["média simples das horas do mês", "média ponderada pela carga verificada do subsistema na mesma hora (só carga positiva)",
                            "deflação pelo IPCA para reais do mês-base"],
            formula="temporal = Σ PLD_h ÷ n; ponderada = Σ PLD_h × carga_h ÷ Σ carga_h nas horas com carga_h > 0; real = temporal × IPCA(base) ÷ IPCA(mês)",
            limitacoes=comum_lim + lim_ccee + lim_pond, download="/energia/series/pld_mensal.csv"),
        "sazonal": c.proveniencia(
            indicador="Percentis sazonais da média diária do PLD (mesmo mês e mesma semana ISO de anos anteriores)",
            natureza="CALCULADO", fonte=c.FONTE_CCEE_PLD, unidade="R$/MWh", frequencia="diária",
            periodo={"inicio": INICIO, "fim": dia_ref}, cobertura={"inicio": INICIO, "fim": dia_ref}, capturado_em=cap_pld,
            snapshot=snap_pld, publicacao_informada=False,
            transformacoes=["médias diárias dos dias completos", "distribuição dos anos anteriores ao ano de referência", "quantis tipo 7; percentil por rank médio"],
            formula="percentil = 100 × (nº de dias com média menor + 0,5 × nº de dias iguais) ÷ n",
            limitacoes=comum_lim + lim_ccee + ["Poucos anos de PLD horário (desde 2021): cada mês de referência tem no máximo cinco anos anteriores.",
                                               "Anos diferentes têm limites regulatórios diferentes; ver distribuição por regime."],
            download="/energia/series/pld_sazonal.csv"),
        "distribuicao": c.proveniencia(
            indicador="Distribuição do PLD horário por regime anual de limites e perfil hora × mês (com o mapa hora × dia sob demanda)",
            natureza="CALCULADO", fonte=_fonte_composta(c.FONTE_CCEE_PLD, *([_fonte_atos(atos)] if atos else [])),
            unidade="R$/MWh", frequencia="horária; resumo anual e mensal",
            periodo={"inicio": INICIO, "fim": dia_ref}, cobertura={"inicio": INICIO, "fim": dia_ref}, capturado_em=cap_pld,
            snapshot=snap_pld, publicacao_informada=False,
            transformacoes=["quantis tipo 7 dos valores horários de cada ano", "média por hora do dia em cada um dos últimos 12 meses",
                            "mapa hora × dia dos últimos 90 dias em arquivo próprio"],
            formula="quantis tipo 7 de PLD_h no ano; perfil(m, k) = média de PLD_h com hora do dia = k no mês m",
            limitacoes=comum_lim + lim_ccee + ["Ano e mês parciais marcados.", "Estatística descritiva: não identifica causa."],
            download="/energia/series/pld_hora_dia.json"),
        "regional": c.proveniencia(
            indicador="Diferenças de PLD entre submercados na mesma hora (amplitude, separação por par, matriz)",
            natureza="CALCULADO", fonte=c.FONTE_CCEE_PLD, unidade="R$/MWh; frequência em fração das horas", frequencia="horária",
            periodo={"inicio": horas_comuns[0], "fim": ultima_hora}, cobertura={"inicio": horas_comuns[0], "fim": ultima_hora},
            capturado_em=cap_pld, snapshot=snap_pld, publicacao_informada=False,
            transformacoes=["só horas com os quatro submercados publicados", "separação quando |PLD_A − PLD_B| > R$ 0,01/MWh"],
            formula="amplitude_h = max_s PLD_h(s) − min_s PLD_h(s); separação(A,B) = % das horas com |PLD_A − PLD_B| > 0,01",
            limitacoes=comum_lim + lim_ccee + ["Estatística descritiva: não identifica a causa de uma separação."],
            download="/energia/series/pld_separacao_diaria.csv"),
        "fluxos": c.proveniencia(
            indicador="Sentido do fluxo verificado de intercâmbio nas horas de preços separados", natureza="CALCULADO",
            fonte=_fonte_composta(c.FONTE_CCEE_PLD, FONTE_INT), unidade="horas; MWmed", frequencia="horária",
            periodo={"inicio": horas_comuns[0], "fim": ultima_hora}, cobertura={"inicio": min(fluxo["S_SE"]), "fim": max(fluxo["S_SE"])},
            capturado_em=c.ultima_captura(snap_int), snapshot=snap_int, publicacao_informada=False,
            transformacoes=["fluxo por fronteira na orientação canônica do ONS", "mesma hora do PLD"],
            formula="para cada hora separada: sentido = do submercado de menor para o de maior PLD quando o sinal do fluxo coincide",
            limitacoes=comum_lim + ["Os limites de intercâmbio não estão integrados: a contagem não diz se a fronteira estava no limite.",
                                    "O intercâmbio é publicado até " + (max(fluxo["S_SE"]) if fluxo["S_SE"] else "data não disponível") + "; horas depois disso ficam fora."],
            download="/energia/series/pld_separacao_diaria.csv"),
        "a02": c.proveniencia(
            indicador="Sequências de CMO semanal igual a zero e conferência no arquivo original", natureza="CALCULADO",
            fonte=FONTE_SEM, unidade="semanas; R$/MWh", frequencia="semana operativa",
            periodo={"inicio": min(dec["SE"]["media"]), "fim": max(dec["SE"]["media"])},
            cobertura={"inicio": min(dec["SE"]["media"]), "fim": max(dec["SE"]["media"])}, capturado_em=c.ultima_captura(snap_a02),
            snapshot=snap_a02,
            transformacoes=["releitura do CSV original por leitor independente", "conferência célula a célula com o Parquet oficial",
                            "sequências de zeros exatos com semanas consecutivas"],
            formula="sequência = semanas consecutivas (passo de 7 dias) com média semanal = 0; mínimo de 4",
            limitacoes=["O CMO semanal é estimado pelo modelo DECOMP e publicado pelo ONS (natureza da fonte: estimado).",
                        "Zero é valor publicado pelo ONS; o conjunto não informa a razão.", "Semana ausente interrompe a sequência."],
            download="/energia/series/pld_cmo_semanal.csv"),
        "a09": c.proveniencia(
            indicador="Primeira captura completa de cada dia do PLD e folga da hipótese LAT1D", natureza="CALCULADO",
            fonte=c.FONTE_CCEE_PLD, unidade="horas", frequencia="diária",
            periodo={"inicio": (a09["dias_com_captura_direta"][0]["dia"] if a09["dias_com_captura_direta"] else dia_ref), "fim": dia_ref},
            cobertura={"inicio": INICIO, "fim": dia_ref}, capturado_em=cap_pld, snapshot=snap_pld, publicacao_informada=False,
            transformacoes=["primeira vintage que contém cada hora do dia", "instante em que LAT1D permite usar o dia (D+2 às 00h de Brasília)"],
            formula="folga = (início do dia D + 2 dias) − primeira captura completa do dia",
            limitacoes=["Primeira captura observada não é publicação; a CCEE não informa a data de publicação de cada hora.",
                        "Só os dias com captura direta entram; a amostra é curta."],
            download=None),
    }
    if bloco_lim.get("disponivel"):
        conf_txt = bloco_lim["conferencia_atos"]["leitura"]
        prov["limites"] = c.proveniencia(
            indicador="Permanência do PLD no piso e nos tetos por submercado e ano", natureza="CALCULADO",
            fonte=_fonte_composta(c.FONTE_CCEE_PLD, _fonte_atos(atos)), unidade="horas, dias e fração", frequencia="horária e diária",
            periodo={"inicio": INICIO, "fim": dia_ref}, cobertura={"inicio": INICIO, "fim": dia_ref}, capturado_em=cap_pld,
            snapshot=snap_pld, publicacao_informada=False,
            transformacoes=["limites vigentes em cada dia pelos atos (campo a campo, ato mais recente)",
                            "hora no limite: igualdade ao centavo (R$ 0,005/MWh); média diária no teto estrutural: R$ 0,01/MWh",
                            "hora um centavo acima do piso contada à parte"],
            formula=("frac_piso = horas com |PLD − mínimo| ≤ 0,005 ÷ horas com limites; dia no teto estrutural: "
                     "|média diária − máximo estrutural| ≤ 0,01"),
            limitacoes=comum_lim + lim_ccee + [f"Atos do módulo Regulação, com o nível de conferência de cada um em limites.atos: {conf_txt}",
                                               "O menor valor observado não é usado como piso."],
            download="/energia/series/pld_limites_diario.csv")

    evid = _evidencias(d, bloco_cmo, bloco_lim, bloco_hist, bloco_reg, a02, snap_pld, snap_sh, snap_sem, snap_bal, snap_a02, controles,
                       cp=cp, con=con, ato_ref=ato_ref)
    base.escreve_gold("pld_evidencias.json", {"gerado_em": base.agora_utc(), "gold": GOLD, "evidencias": evid},
                      destino=d.get("destino_csv") or base.SERIES)

    g = {
        **c.cabecalho(GOLD),
        "unidade": "R$/MWh nominais, salvo onde indicado",
        "fuso": "Horário de Brasília (UTC−3, sem horário de verão no período integrado)",
        "referencia": {"dia": dia_ref, "ultima_hora_pld": ultima_hora, "ultima_meia_hora_cmo": periodo_sh["fim"],
                       "ultima_semana_decomp": max(dec["SE"]["media"]), "ultima_hora_carga": bloco_hist["ponderacao"]["ultima_hora_com_carga"],
                       "ultima_hora_fluxo": max(fluxo["S_SE"]) if fluxo["S_SE"] else None,
                       "ultimo_mes_ipca": max(ipca) if ipca else None},
        "tolerancias": {"hora_no_limite": TOL_HORA, "media_diaria_teto_estrutural": TOL, "separacao": TOL, "sensibilidade_hora": TOL_SENS,
                        "fluxo_nulo_mwmed": FLUXO_NULO, "unidade": "R$/MWh"},
        "conceito": conceito,
        "cmo_pld": bloco_cmo,
        "limites": bloco_lim,
        "historico": bloco_hist,
        "regional": bloco_reg,
        "horario_recente": recente,
        "achados": {
            "A01": {"status": "corrigido",
                    "regra": ("Toda comparação entre CMO e PLD usa o mesmo intervalo: a mesma hora (CMO do DESSEM na hora contra PLD da hora) "
                              "ou a mesma semana operativa de sábado a sexta (CMO semanal do DECOMP contra as médias do DESSEM e do PLD naquela "
                              "semana). Diferenças em R$/MWh; nenhuma razão ou multiplicador é calculado."),
                    "semana_referencia": bloco_cmo["semana_referencia"]},
            "A02": a02, "A03": a03,
            "A04": {"status": "integrado" if bloco_lim.get("disponivel") else "bloqueado: dependência do módulo Regulação",
                    "origem": origem, "motivo": None if bloco_lim.get("disponivel") else motivo, "atos": len(atos),
                    "rejeitados": rejeitados, "regra": "O menor valor observado nunca substitui o piso regulatório; limites mínimo, máximo horário e máximo estrutural ficam em campos separados, com ato e vigência."},
            "A09": a09,
        },
        "cobertura": {"cmo_semi_horario": cobertura_sh, "importacao_cmo_semi_horario": rel_imp},
        # medidas publicadas por bloco: definição em pipeline/energia/metricas/pld.py (metricas.json)
        "metricas": {
            "cmo_pld": ["pld_cmo_dessem_hora", "pld_cmo_dessem_semana", "pld_pld_semana", "pld_diferenca_pld_cmo"],
            "limites": ["pld_horas_piso", "pld_horas_teto_horario", "pld_dias_teto_estrutural", "pld_empates_piso"],
            "historico": ["pld_media_mensal_temporal", "pld_media_mensal_ponderada_carga", "pld_media_mensal_real",
                          "pld_percentil_sazonal", "pld_quantis_regime", "pld_perfil_hora_mes"],
            "regional": ["pld_amplitude_horaria", "pld_separacao_par", "pld_diferenca_media_par", "pld_sentido_fluxo_separacao"],
            "achados": ["pld_sequencia_zero_cmo_semanal", "pld_folga_lat1d"],
        },
        # proveniência de cada métrica: `calculo` descreve o número publicado (natureza da
        # transformação) e `fonte`, quando a gold tem a proveniência do dado de origem, a
        # natureza da fonte; as duas têm de coincidir com o catálogo (teste)
        "metricas_proveniencia": {k: {"calculo": v[0], "fonte": v[1]} for k, v in METRICA_PROVENIENCIA.items()
                                  if v[0] in prov},
        "controles": controles,
        "proveniencia": prov,
        "evidencias": {"arquivo": "/energia/series/pld_evidencias.json",
                       "indice": {k: {"indicador": e["indicador"], "valor_exibido": e["valor_exibido"], "entidade": e["entidade"]}
                                  for k, e in evid.items()}},
        "snapshots": {k: _snap_resumo(v) for k, v in (("cmo_semi_horario", snap_sh), ("cmo_semanal_original", snap_a02),
                                                      ("dicionarios", snap_dic), ("ipca", snap_ipca), ("normas", snap_normas), ("pld", snap_pld),
                                                      ("cmo_semanal", snap_sem), ("balanco", snap_bal), ("intercambio", snap_int))},
        "downloads": [{"rotulo": r_, "url": u_} for u_, r_ in (
            ("/energia/series/pld_cmo_horario.csv", "CMO do DESSEM na hora e PLD horário, quatro submercados (CSV)"),
            ("/energia/series/pld_cmo_semanal.csv", "CMO semanal, média do DESSEM e média do PLD por semana operativa (CSV)"),
            ("/energia/series/pld_limites_diario.csv", "PLD diário com horas no piso e nos tetos e limites vigentes (CSV)"),
            ("/energia/series/pld_mensal.csv", "PLD mensal: temporal, ponderado pela carga e em moeda constante (CSV)"),
            ("/energia/series/pld_sazonal.csv", "Percentis sazonais da média diária por mês (CSV)"),
            ("/energia/series/pld_hora_dia.json", "Mapa hora × dia do PLD, últimos 90 dias (JSON)"),
            ("/energia/series/pld_separacao_diaria.csv", "Separação diária por par de submercados e fluxo na fronteira (CSV)"),
            ("/energia/series/pld_amplitude_diaria.csv", "Amplitude diária entre submercados (CSV)"))],
    }
    return g


# Métrica → (proveniência do cálculo publicado, proveniência do dado de origem quando a
# gold a publica). A natureza_transformacao do catálogo tem de ser a natureza da primeira
# e a natureza_fonte, a da segunda (teste test_metricas_e_naturezas_coincidem).
METRICA_PROVENIENCIA = {
    "pld_cmo_dessem_hora": ("cmo_horario", "cmo_semi_horario"),
    "pld_cmo_dessem_semana": ("comparacao_semanal", "cmo_semi_horario"),
    "pld_pld_semana": ("comparacao_semanal", None),
    "pld_diferenca_pld_cmo": ("relacao_pld_cmo", "cmo_semi_horario"),
    "pld_horas_piso": ("limites", None),
    "pld_horas_teto_horario": ("limites", None),
    "pld_dias_teto_estrutural": ("limites", None),
    "pld_empates_piso": ("limites", None),
    "pld_media_mensal_temporal": ("historico_mensal", None),
    "pld_media_mensal_ponderada_carga": ("historico_mensal", None),
    "pld_media_mensal_real": ("historico_mensal", None),
    "pld_percentil_sazonal": ("sazonal", None),
    "pld_quantis_regime": ("distribuicao", None),
    "pld_perfil_hora_mes": ("distribuicao", None),
    "pld_amplitude_horaria": ("regional", None),
    "pld_separacao_par": ("regional", None),
    "pld_diferenca_media_par": ("regional", None),
    "pld_sentido_fluxo_separacao": ("fluxos", None),
    "pld_sequencia_zero_cmo_semanal": ("a02", None),
    "pld_folga_lat1d": ("a09", None),
}


def paginas_pdf(bruto):
    """Texto de cada página de um PDF (pdftotext em fluxo de leitura, páginas separadas
    pelo caractere de quebra de página). Sem a ferramenta: None."""
    exe = shutil.which("pdftotext")
    if not exe:
        return None
    fd, tmp = tempfile.mkstemp(suffix=".pdf")
    os.close(fd)
    try:
        with open(tmp, "wb") as f:
            f.write(bruto)
        saida = subprocess.run([exe, tmp, "-"], capture_output=True, timeout=120).stdout.decode("utf-8", errors="replace")
    finally:
        os.remove(tmp)
    return saida.split("\f")


def confere_ato_no_texto(ato, paginas):
    """(confere, página, detalhe): o trecho literal do ato (partes separadas por " […] ") e o
    valor do piso escrito como no ato (R$ 57,31/MWh) aparecem no texto extraído do PDF;
    a página é a que contém a parte do trecho com o valor do piso."""
    if not paginas:
        return False, None, "texto do PDF não extraído (pdftotext ausente ou arquivo ilegível)"
    texto = normas_pld.normaliza(" ".join(paginas))
    trecho = ato.get("trecho") or ""
    partes = normas_pld.partes(trecho)
    faltam = [p_ for p_ in partes if normas_pld.normaliza(p_) not in texto]
    valor = "R$ " + _num_br(ato["pld_min"]) + "/MWh" if ato.get("pld_min") is not None else None
    tem_valor = bool(valor) and valor in texto
    com_valor = next((p_ for p_ in partes if valor and valor in p_), None)
    pagina = pagina_do_trecho(paginas, com_valor) if com_valor else None
    ok = bool(partes) and not faltam and tem_valor
    detalhe = (f"{len(partes) - len(faltam)} de {len(partes)} partes do trecho literal encontradas no texto extraído; piso "
               f"{valor or 'sem valor'} {'presente' if tem_valor else 'ausente'} no texto" + (f" (página {pagina})" if pagina else ""))
    return ok, pagina, detalhe


def _vintage_regulacao(doc_id, ctx):
    """Vintage do documento no silver do módulo Regulação (só leitura): arquivo no bronze,
    sha256 e captura. None quando o silver ou o arquivo não estão neste ambiente."""
    caminho = ctx.get("regulacao_db") if "regulacao_db" in ctx else os.path.join(base.SILVER, "regulacao.db")
    if not doc_id or not caminho or not os.path.exists(caminho):
        return None
    try:
        con = sqlite3.connect(f"file:{caminho}?mode=ro", uri=True, timeout=30)
        try:
            row = con.execute("""SELECT arquivo, sha256, capturado_em FROM vintages WHERE dataset='regulacao_documentos' AND recurso=?
                                 ORDER BY capturado_em DESC LIMIT 1""", (doc_id,)).fetchone()
        finally:
            con.close()
    except sqlite3.Error:
        return None
    if not row or not row[0] or not os.path.exists(os.path.join(base.RAIZ, row[0])):
        return None
    return {"arquivo": row[0], "sha256": row[1], "capturado_em": row[2]}


def _confere_ato_vigente(d, ctx):
    """Ato que fixa o piso no dia de referência, conferido no PDF do próprio ato (cópia
    baixada pelo módulo Regulação, sha256 igual ao registrado em documentos.json): é o
    segundo arquivo das fichas de horas no piso. None quando não há limites."""
    if not d["atos"]:
        return None
    nome = d["lim_dia"].get(d["dia_ref"], {}).get("ato_pld_min")
    ato = next((a for a in d["atos"] if a["ato"] == nome), None)
    if not ato:
        return {"confere": False, "detalhe": "nenhum ato vigente informa o piso no dia de referência", "arquivo": None, "ato": None}
    base_ = {"ato": ato["ato"], "url": ato["url"], "documento": ato.get("documento_valores"), "nivel_conferencia": ato.get("nivel_conferencia"),
             "publicado_em": ato.get("data_publicacao"), "edicao": ato.get("dou") or (f"publicado em {ato['data_publicacao']}"
                                                                                     if ato.get("data_publicacao") else None),
             "titulo": ato.get("documento_titulo") or ato["ato"], "arquivo": None, "sha256": None, "capturado_em": None, "pagina": None}
    vint = _vintage_regulacao(ato.get("documento_valores"), ctx)
    if not vint:
        return {**base_, "confere": False,
                "detalhe": (f"PDF de {ato['ato']} ({ato.get('documento_valores') or 'documento não identificado'}) não disponível neste "
                            "ambiente: conferência no ato não executada nesta construção")}
    with base.abre_bronze(vint["arquivo"]) as f:
        bruto = f.read()
    sha = hashlib.sha256(bruto).hexdigest()
    paginas = (ctx.get("ler_pdf") or paginas_pdf)(bruto)
    ok, pagina, detalhe = confere_ato_no_texto(ato, paginas)
    sha_ok = sha == (ato.get("documento_sha256") or sha)
    if not sha_ok:
        detalhe += f"; sha256 do arquivo ({sha[:12]}…) diferente do registrado em documentos.json"
    return {**base_, **vint, "sha256": sha, "pagina": pagina, "confere": ok and sha_ok, "detalhe": detalhe}


def _publicacoes_conferidas(con, dataset):
    """Contagem das vintages vigentes do dataset com a data de publicação conferida no S3."""
    regs = base.registros_como_estavam_em(con, DS_CONTROLE)
    out = {"arquivos": 0, "conferida": 0, "nao_conferida": 0, "sem_registro": 0}
    for v in ckan.vintages_vigentes(con, dataset).values():
        out["arquivos"] += 1
        r_ = regs.get(f"publicacao_s3:{v['vintage_id']}", {}).get("resultado")
        out[r_ if r_ in ("conferida", "nao_conferida") else "sem_registro"] += 1
    return out


def _arquivo_local_pld(cp, ano):
    """Arquivo original do PLD do ano mais recente disponível neste ambiente (bronze do
    pipeline de operação ou captura versionada no repositório), para a releitura."""
    vs = cp.execute("""SELECT recurso, capturado_em, sha256, origem, arquivo FROM vintages WHERE dataset=? AND recurso=?
                       ORDER BY capturado_em DESC""", (DS_PLD, f"pld_horario_{ano}")).fetchall()
    for i, (rec, cap, sha, origem, arq) in enumerate(vs):
        if arq and os.path.exists(arq if os.path.isabs(arq) else os.path.join(base.RAIZ, arq)):
            return {"recurso": rec, "capturado_em": cap, "sha256": sha, "origem": origem, "arquivo": arq, "vigente": i == 0}
    return None


def _le_original(arquivo):
    """Linhas de um CSV original (gzip ou não) por csv.reader, sem os parsers do silver."""
    with base.abre_bronze(arquivo) as f:
        return list(csv.reader(io.TextIOWrapper(f, encoding="utf-8-sig", newline=""), delimiter=";"))


def _pld_relido(cache, cp, sm, horas):
    """{hora: PLD} relido dos arquivos originais dos anos das horas, e os arquivos usados."""
    vals, arquivos = {}, []
    for ano in sorted({h[:4] for h in horas}):
        if ("pld", ano) not in cache:
            loc = _arquivo_local_pld(cp, ano)
            cache[("pld", ano)] = (loc, releitura_pld(_le_original(loc["arquivo"])) if loc else None)
        loc, dado = cache[("pld", ano)]
        if loc:
            arquivos.append(loc)
            serie = (dado or {}).get(sm, {})
            vals.update({h: serie[h] for h in horas if h[:4] == ano and h in serie})
    return vals, arquivos


def _ons_relido(con, dataset, recurso, campo, sm, inicio, fim):
    """Valores de um CSV original do ONS (vintage mais recente do recurso) relidos por
    leitor próprio; (valores, vintage) ou ({}, None) sem o arquivo neste ambiente."""
    v = base.ultima_vintage(con, dataset, recurso)
    if not v or not v.get("arquivo") or not os.path.exists(os.path.join(base.RAIZ, v["arquivo"])):
        return {}, None
    return releitura_ons(_le_original(v["arquivo"]), campo, sm, inicio, fim), v


def _origem_txt(arquivos):
    return "; ".join(f"{a['recurso']} capturado em {a['capturado_em']}" + ("" if a.get("vigente", True) else " (não é a captura vigente)")
                     for a in arquivos)


def _reconcilia(rotulo, horas, relidos, arquivos, calc, valor, silver, tolerancia, tol_txt, fmt):
    """Reconciliação por releitura do arquivo original: refaz `calc` com os valores relidos.
    Arquivo ausente: None (o motivo vira teste com ressalva). Horas faltando no arquivo
    (captura mais antiga que a vigente): refeito nas horas presentes contra o silver nas
    mesmas horas, com ressalva. Todas presentes: compara com o número publicado."""
    if not arquivos:
        return None, ev.teste("releitura do arquivo original", "ressalva",
                              f"{rotulo}: nenhum arquivo original disponível neste ambiente; reconciliação por releitura não executada")
    faltam = [h for h in horas if h not in relidos]
    if faltam:
        presentes = [h for h in horas if h in relidos]
        if not presentes:
            return ev.reconciliacao(f"releitura de {_origem_txt(arquivos)}: nenhuma das {len(horas)} horas do número está no arquivo",
                                    "ressalva", tol_txt), None
        x, y = calc({h: relidos[h] for h in presentes}), calc({h: silver[h] for h in presentes})
        return ev.reconciliacao(
            f"releitura de {_origem_txt(arquivos)} por leitor independente: {len(faltam)} de {len(horas)} horas não estão no arquivo "
            f"(capturadas depois); nas {len(presentes)} horas presentes o arquivo dá {fmt(x)} e o silver dá {fmt(y)}",
            "ressalva" if abs(x - y) <= tolerancia else "reprovado", tol_txt), None
    x = calc(relidos)
    return ev.reconciliacao(f"releitura de {_origem_txt(arquivos)} por leitor independente (sem o parser que alimenta o silver): {fmt(x)}",
                            "aprovado" if abs(x - valor) <= tolerancia else "reprovado", tol_txt), None


def _revisoes_recorte(con, dataset, series, filtro, unidade):
    """Revisões só das séries e referências que entram no número (não do conjunto inteiro):
    quantas observações mudaram entre capturas e a magnitude da maior mudança."""
    hist = {}
    for serie in series:
        for ref, h in base.revisoes_da_serie(con, dataset, serie):
            if filtro(ref) and len({v for _, v in h}) > 1:
                hist[f"{serie} em {ref}"] = h
    vint = con.execute("SELECT COUNT(*) FROM vintages WHERE dataset=?", (dataset,)).fetchone()[0]
    mag = magnitude_revisoes(hist)
    alvo = ", ".join(series)
    if not mag["horas_revisadas"]:
        return f"Nenhuma revisão de {alvo} no período do número entre as {vint} capturas integradas do conjunto."
    return (f"{mag['horas_revisadas']} observações de {alvo} no período do número foram revistas pela fonte entre as {vint} capturas "
            f"integradas; maior alteração de {_num_br(mag['max_abs'], 3)} {unidade} ({mag['quando_max']}), média de "
            f"{_num_br(mag['media_abs'], 3)} {unidade}" + (f"; {mag['horas_com_troca_de_sinal']} com troca de sinal" if mag["horas_com_troca_de_sinal"] else "") + ".")


def _evidencias(d, bloco_cmo, bloco_lim, bloco_hist, bloco_reg, a02, snap_pld, snap_sh, snap_sem, snap_bal, snap_a02, controles,
                cp=None, con=None, ato_ref=None):
    """Fichas "Comprove este número" dos agregados principais de cada painel, no contrato
    de pipeline/energia/evidencia.py. Os testes são verificações executadas nesta construção
    (nenhum resultado escrito à mão). A reconciliação refaz o número a partir do arquivo
    original publicado pela fonte, relido por leitor próprio (não pelo parser que alimenta o
    silver); sem o arquivo neste ambiente, a reconciliação fica None e o motivo vira teste
    com ressalva. A ficha da sequência A02 reconcilia CSV contra Parquet oficial."""
    pld, dia_ref = d["pld"], d["dia_ref"]
    ctrl = lambda nome: [ev.teste(x["nome"], x["resultado"], x["detalhe"]) for x in controles if x["nome"].startswith(nome)]  # noqa: E731
    veredito = lambda ok: "aprovado" if ok else "reprovado"  # noqa: E731
    cache = {}
    out = {}
    ano = dia_ref[:4]
    arq_pld = _arquivos_snap(snap_pld, {f"pld_horario_{ano}"}, cp, DS_PLD)
    reproduzir = "python3 pipeline/energia/executar_modulo.py pld --sem-coleta"
    media = lambda vs: sum(vs.values()) / len(vs)  # noqa: E731
    # P009: médias da semana de referência
    sr = bloco_cmo.get("semana_referencia")
    if sr:
        fim = date.fromisoformat(sr["fim"])
        horas = _horas_da_semana(fim)
        meias = _meias_da_semana(fim)
        arq_sem = _arquivos_snap(snap_pld, {f"pld_horario_{a_}" for a_ in {sr["inicio"][:4], sr["fim"][:4]}}, cp, DS_PLD)
        for x in sr["por_sm"]:
            sm = x["sm"]
            soma = sum(pld[sm][h] for h in horas)
            v = soma / 168
            presentes = sum(1 for h in horas if h in pld[sm])
            grade = (datetime.fromisoformat(horas[0]).weekday() == 5 and datetime.fromisoformat(horas[-1]).weekday() == 4
                     and horas[-1].endswith("T23:00") and len(set(horas)) == 168)
            fora_lim = [h for h in horas if situacao_hora(pld[sm][h], d["lim_dia"].get(h[:10], {})) in ("abaixo_do_piso", "acima_do_teto")]
            relidos, arqs = _pld_relido(cache, cp, sm, horas)
            rec, falta = _reconcilia("PLD da semana", horas, relidos, arqs, media, v, pld[sm], 1e-6, "R$ 0,000001/MWh",
                                     lambda z: f"{_num_br(z, 6)} R$/MWh")
            out[f"pld_semana_{sm}"] = _evidencia(
                indicador=f"PLD médio da semana operativa de {c.data_br(sr['inicio'])} a {c.data_br(sr['fim'])}",
                valor_exibido=_br(v) + "/MWh", valor=v, unidade="R$/MWh", periodo={"inicio": horas[0], "fim": horas[-1]},
                entidade=c.NOME_SUBMERCADO[sm], universo="168 horas da semana operativa (sábado a sexta)",
                filtros=[f"submercado {c.NOME_SUBMERCADO[sm]}", f"semana operativa que termina em {c.data_br(sr['fim'])}"],
                fonte=c.FONTE_CCEE_PLD, arquivos=arq_sem,
                consulta=f"PLD_HORARIO, SUBMERCADO={c.NOME_SUBMERCADO[sm].split('/')[0].upper()}, horas de {horas[0]} a {horas[-1]} (horário de Brasília)",
                formula="PLD_semana = Σ PLD_h ÷ 168",
                numerador={"descricao": "soma do PLD das 168 horas (R$/MWh × h)", "valor": c.r(soma, 4)},
                denominador={"descricao": "horas", "valor": 168}, cobertura=f"{presentes} de 168 horas",
                tratamento_ausencia="semana com hora ausente não recebe média",
                revisoes=_revisoes_recorte(cp, DS_PLD, [f"pld.{sm}"], lambda r_: horas[0] <= r_ <= horas[-1], "R$/MWh"),
                testes=[ev.teste("168 horas presentes, de sábado 00h a sexta 23h", veredito(presentes == 168 and grade),
                                 f"{presentes} horas com PLD; primeira {horas[0]}, última {horas[-1]}"),
                        ev.teste("PLD dentro dos limites vigentes em todas as horas", veredito(not fora_lim) if d["lim_dia"] else "ressalva",
                                 (f"{len(fora_lim)} horas abaixo do piso ou acima do teto horário" if d["lim_dia"] else "limites indisponíveis"))]
                       + ([falta] if falta else []),
                reconciliacao=rec,
                download=[{"rotulo": "CSV semanal (DECOMP, DESSEM e PLD)", "url": "/energia/series/pld_cmo_semanal.csv"},
                          {"rotulo": "CSV horário (CMO e PLD)", "url": "/energia/series/pld_cmo_horario.csv"}],
                reproducao=reproduzir + "\nFiltrar pld_cmo_horario.csv pelas horas da semana e tirar a média da coluna PLD_" + sm + ".")
            soma_m = sum(d["sh"][sm][k] for k in meias)
            vm = soma_m / 336
            na_grade = sum(1 for k in meias if k in d["sh"][sm])
            rec_sh = ([f"CMO_SEMIHORARIO_{a_}" for a_ in sorted({meias[0][:4], meias[-1][:4]})])
            relidos_m, vints = {}, []
            for recurso in rec_sh:
                vals_, v_ = _ons_relido(con, DS_SH, recurso, "val_cmo", sm, meias[0], meias[-1])
                relidos_m.update(vals_)
                if v_:
                    vints.append({**v_, "vigente": True})
            rec_m, falta_m = _reconcilia("CMO do DESSEM da semana", meias, relidos_m, vints, media, vm, d["sh"][sm], 1e-6,
                                         "R$ 0,000001/MWh", lambda z: f"{_num_br(z, 6)} R$/MWh")
            out[f"dessem_semana_{sm}"] = _evidencia(
                indicador=f"CMO médio do DESSEM na semana operativa de {c.data_br(sr['inicio'])} a {c.data_br(sr['fim'])}",
                valor_exibido=_br(vm) + "/MWh", valor=vm, unidade="R$/MWh", periodo={"inicio": meias[0], "fim": meias[-1]},
                entidade=c.NOME_SUBMERCADO[sm], universo="336 meias horas da semana operativa",
                filtros=[f"subsistema {sm}", f"semana operativa que termina em {c.data_br(sr['fim'])}"], fonte=FONTE_SH,
                arquivos=_arquivos_snap(snap_sh, set(rec_sh), con, DS_SH),
                consulta=f"CMO_SEMIHORARIO, id_subsistema={sm}, din_instante de {meias[0]} a {meias[-1]}",
                formula="DESSEM_semana = Σ CMO_meia ÷ 336",
                numerador={"descricao": "soma do CMO das 336 meias horas", "valor": c.r(soma_m, 4)},
                denominador={"descricao": "meias horas", "valor": 336}, cobertura=f"{na_grade} de 336 meias horas",
                tratamento_ausencia="semana com meia hora ausente não recebe média",
                revisoes=_revisoes_recorte(con, DS_SH, [f"cmo_sh.{sm}"], lambda r_: meias[0] <= r_ <= meias[-1], "R$/MWh"),
                testes=ctrl("CMO semi-horário: esquema") + [ev.teste(
                    "336 meias horas na grade de 30 minutos", veredito(na_grade == 336),
                    f"{na_grade} instantes da grade de {meias[0]} a {meias[-1]} com valor publicado")] + ([falta_m] if falta_m else []),
                reconciliacao=rec_m,
                download=[{"rotulo": "CSV semanal (DECOMP, DESSEM e PLD)", "url": "/energia/series/pld_cmo_semanal.csv"}],
                reproducao=reproduzir + "\nSomar as meias horas da semana no arquivo CMO_SEMIHORARIO do ano e dividir por 336.")
    # P010: permanência no piso no ano de referência
    if bloco_lim.get("disponivel"):
        atos_ano = ", ".join(sorted({a["ato"] for a in d["atos"] if str(a.get("ano")) == ano}))
        item_ato, extracao = None, None
        if ato_ref and ato_ref.get("arquivo"):
            item_ato = {"recurso": f"{ato_ref['ato']} ({ato_ref['documento']}.pdf)", "arquivo": ato_ref["arquivo"], "sha256": ato_ref["sha256"],
                        "capturado_em": ato_ref["capturado_em"], "publicado_em": ato_ref["publicado_em"], "url": ato_ref["url"],
                        "nivel_conferencia": ato_ref["nivel_conferencia"]}
            extracao = {"documento": ato_ref["titulo"], "edicao": ato_ref["edicao"] or "edição não registrada",
                        "pagina": f"página {ato_ref['pagina']} do PDF" if ato_ref.get("pagina") else "página não identificada",
                        "conferencia": f"{ato_ref['detalhe']}; nível de conferência do módulo Regulação: {ato_ref['nivel_conferencia']}"}
        for x in bloco_lim["permanencia_anual"]:
            if str(x["ano"]) != ano or not x["horas_com_limite"]:
                continue
            sm = x["sm"]
            v = 100 * x["horas_piso"] / x["horas_com_limite"]
            hs = [h for h in pld[sm] if h[:4] == ano and h <= d["ultima_hora"]]
            relidos, arqs = _pld_relido(cache, cp, sm, hs)

            def conta_piso(vals_):
                return sum(1 for h, p_ in vals_.items() if situacao_hora(p_, d["lim_dia"].get(h[:10], {})) == "piso")
            rec, falta = _reconcilia("Horas no piso", hs, relidos, arqs, conta_piso, x["horas_piso"], pld[sm], 0, "0 hora (contagem exata)",
                                     lambda z: f"{z} horas no piso")
            testes = ctrl("PLD dentro dos limites") + ctrl("Limites vigentes por dia")
            if ato_ref is not None:
                testes.append(ev.teste("ato vigente conferido no PDF", veredito(ato_ref["confere"]) if ato_ref.get("arquivo") else "ressalva",
                                       f"{ato_ref.get('ato') or 'sem ato'}: {ato_ref['detalhe']}"))
            out[f"piso_{ano}_{sm}"] = _evidencia(
                indicador=f"Horas de {ano} com o PLD no piso", valor_exibido=_num_br(v, 2) + "%", valor=v, unidade="% das horas",
                periodo={"inicio": f"{ano}-01-01T00:00", "fim": d["ultima_hora"]}, entidade=c.NOME_SUBMERCADO[sm],
                universo=f"horas de {ano} com PLD publicado e limites vigentes até o dia de referência",
                filtros=[f"ano {ano}" + (" (parcial)" if x["parcial"] else ""), f"submercado {c.NOME_SUBMERCADO[sm]}"],
                fonte=_fonte_composta(c.FONTE_CCEE_PLD, _fonte_atos([a for a in d["atos"] if str(a.get("ano")) == ano] or d["atos"], atos_ano)),
                arquivos=arq_pld + ([item_ato] if item_ato else []), extracao_pdf=extracao,
                consulta=(f"PLD_HORARIO, submercado {c.NOME_SUBMERCADO[sm]}, ano {ano}; mínimo vigente por dia segundo {atos_ano}"
                          + (f" ({ato_ref['url']})" if ato_ref and ato_ref.get("url") else "")),
                formula="100 × nº de horas com PLD igual ao mínimo vigente ao centavo (|PLD − mínimo| ≤ R$ 0,005/MWh) ÷ nº de horas com limites vigentes",
                numerador={"descricao": "horas no piso", "valor": x["horas_piso"]},
                denominador={"descricao": "horas com limites vigentes", "valor": x["horas_com_limite"]},
                exclusoes=[f"{x['horas_um_centavo_acima_do_piso']} horas exatamente um centavo acima do piso, contadas à parte",
                           f"sensibilidade com R$ 0,01/MWh na hora: {x['sensibilidade_um_centavo']['horas_piso']} horas"],
                cobertura=f"{x['horas']} horas; {x['horas_sem_limite']} sem limite vigente",
                tratamento_ausencia="hora sem PLD não entra; dia sem ato vigente conta como sem limite e fica fora do denominador",
                revisoes=_revisoes_recorte(cp, DS_PLD, [f"pld.{sm}"], lambda r_: r_[:4] == ano, "R$/MWh"),
                testes=testes + ([falta] if falta else []), reconciliacao=rec,
                download=[{"rotulo": "CSV diário de limites", "url": "/energia/series/pld_limites_diario.csv"}],
                reproducao=reproduzir + "\nSomar horas_no_piso de pld_limites_diario.csv no ano e submercado e dividir pelas horas.")
    # P011: média mensal ponderada pela carga do último mês completo com carga em todas as horas
    mh = bloco_hist["mensal"]
    for sm in SM:
        cand = [i for i, _ in enumerate(mh["meses"]) if not mh["parcial"][i] and mh[sm]["mesmas_horas"][i]
                and mh[sm]["ponderada_carga"][i] is not None]
        if not cand:
            continue
        mes = mh["meses"][cand[-1]]
        hs = sorted(h for h in pld[sm] if h[:7] == mes)
        num = sum(pld[sm][h] * d["carga"][sm][h] for h in hs)
        den = sum(d["carga"][sm][h] for h in hs)
        v = num / den
        cargas = [d["carga"][sm][h] for h in hs]
        horas_mes = calendar.monthrange(int(mes[:4]), int(mes[5:7]))[1] * 24
        # releitura: PLD do arquivo da CCEE e carga do arquivo do ONS baixado por este módulo
        relidos, arqs = _pld_relido(cache, cp, sm, hs)
        carga_rel, v_bal = _ons_relido(con, DS_BAL_CONF, f"BALANCO_ENERGIA_SUBSISTEMA_{mes[:4]}", "val_carga", sm, hs[0], hs[-1])
        dif_carga = [h for h in hs if h in carga_rel and abs(carga_rel[h] - d["carga"][sm][h]) > 1e-6]
        testes = [ev.teste("todas as horas do mês com PLD e carga", veredito(len(hs) == horas_mes),
                           f"{len(hs)} de {horas_mes} horas do mês com PLD e carga publicada"),
                  ev.teste("carga positiva em todas as horas usadas como peso", veredito(min(cargas) > 0),
                           f"menor carga horária do mês: {_num_br(min(cargas), 1)} MWmed")] + ctrl("Carga do ONS usada como peso")
        if not arqs or not v_bal:
            rec = None
            testes.append(ev.teste("releitura dos arquivos originais", "ressalva",
                                   ("arquivo da CCEE" if not arqs else "arquivo do balanço do ONS") + " não disponível neste ambiente; "
                                   "reconciliação por releitura não executada"))
        else:
            faltam = [h for h in hs if h not in relidos or h not in carga_rel]
            pares_ = [(relidos[h], carga_rel[h]) for h in hs if h in relidos and h in carga_rel and carga_rel[h] > 0]
            x_ = media_ponderada(pares_)
            origem = _origem_txt(arqs + [{**v_bal, "vigente": True}])
            if faltam or dif_carga:
                rec = ev.reconciliacao(
                    f"releitura de {origem} por leitor independente: {_num_br(x_, 6) if x_ is not None else 'sem valor'} R$/MWh; "
                    f"{len(faltam)} horas ausentes nos arquivos relidos e {len(dif_carga)} horas com carga diferente da usada (captura "
                    "posterior com revisão do ONS)", "ressalva", "R$ 0,000001/MWh (mesmos números somados em outra ordem)")
            else:
                rec = ev.reconciliacao(f"releitura de {origem} por leitor independente (sem os parsers que alimentam o silver): "
                                       f"{_num_br(x_, 6)} R$/MWh", veredito(x_ is not None and abs(x_ - v) <= 1e-6),
                                       "R$ 0,000001/MWh (mesmos números somados em outra ordem)")
        rv_carga = _revisoes_recorte(cp, DS_BAL, [f"carga.{sm}"], lambda r_: r_[:7] == mes, "MWmed")
        rv_pld = _revisoes_recorte(cp, DS_PLD, [f"pld.{sm}"], lambda r_: r_[:7] == mes, "R$/MWh")
        out[f"ponderada_{mes}_{sm}"] = _evidencia(
            indicador=f"PLD médio de {c.mes_br(mes)} ponderado pela carga", valor_exibido=_br(v) + "/MWh", valor=v, unidade="R$/MWh",
            periodo={"inicio": hs[0], "fim": hs[-1]}, entidade=c.NOME_SUBMERCADO[sm], universo="horas do mês com PLD e carga positiva",
            filtros=[f"mês {mes}", f"submercado {c.NOME_SUBMERCADO[sm]} e subsistema {sm} do ONS"],
            fonte=_fonte_composta(c.FONTE_CCEE_PLD, FONTE_BAL),
            arquivos=_arquivos_snap(snap_pld, {f"pld_horario_{mes[:4]}"}, cp, DS_PLD)
                     + _arquivos_snap(snap_bal, {f"BALANCO_ENERGIA_SUBSISTEMA_{mes[:4]}"}, cp, DS_BAL),
            consulta=f"PLD_HORARIO submercado {c.NOME_SUBMERCADO[sm]} e BALANCO_ENERGIA_SUBSISTEMA id_subsistema={sm} (val_carga), horas de {mes}",
            formula="Σ PLD_h × carga_h ÷ Σ carga_h (carga_h > 0)", numerador={"descricao": "Σ PLD × carga (R$)", "valor": c.r(num, 2)},
            denominador={"descricao": "Σ carga (MWh)", "valor": c.r(den, 3)},
            pesos="carga verificada do subsistema na hora (MWmed; numa hora, MWmed equivale a MWh); hora com carga ≤ 0 sai do peso",
            cobertura=f"{len(hs)} horas, todas com carga positiva",
            tratamento_ausencia="hora sem carga ou com carga ≤ 0 fica fora da ponderada (campo mesmas_horas no CSV mensal)",
            revisoes=f"PLD: {rv_pld} Carga: {rv_carga}", testes=testes, reconciliacao=rec,
            download=[{"rotulo": "CSV mensal", "url": "/energia/series/pld_mensal.csv"}],
            reproducao=reproduzir + "\nCruzar pld_cmo_horario.csv (PLD) com a carga horária do balanço do ONS na mesma hora e aplicar a fórmula.")
    # P012: separação nos últimos 12 meses por par
    per = next(p for p in bloco_reg["periodos"] if p["id"] == "12m")
    h12 = [h for h in d["horas_comuns"] if per["inicio"] <= h <= per["fim"]]
    for x in bloco_reg["separacao"]:
        if x["periodo"] != "12m":
            continue
        a, b = x["par"].split("_")
        v = 100 * x["horas_separadas"] / x["horas"]
        mt = bloco_reg["matriz"]["frac_separadas"][SM.index(a)][SM.index(b)]
        ra, arqs = _pld_relido(cache, cp, a, h12)
        rb, _ = _pld_relido(cache, cp, b, h12)
        juntos = {h: (ra[h], rb[h]) for h in h12 if h in ra and h in rb}
        silver_ab = {h: (pld[a][h], pld[b][h]) for h in h12}

        def conta_sep(vals_):
            return sum(1 for pa, pb in vals_.values() if separado(pa, pb))
        rec, falta = _reconcilia("Separação 12 meses", h12, juntos, arqs, conta_sep, x["horas_separadas"], silver_ab, 0,
                                 "0 hora (contagem exata)", lambda z: f"{z} horas separadas")
        comuns_ok = len(h12) == x["horas"] and all(h in pld[s_] for s_ in SM for h in h12)
        out[f"separacao_12m_{x['par']}"] = _evidencia(
            indicador="Frequência de separação de preços nos últimos 12 meses", valor_exibido=_num_br(v, 2) + "%", valor=v,
            unidade="% das horas", periodo={"inicio": per["inicio"], "fim": per["fim"]},
            entidade=f"{c.NOME_SUBMERCADO[a]} e {c.NOME_SUBMERCADO[b]}", universo="horas com os quatro submercados publicados",
            filtros=["últimos 365 dias até o dia de referência", f"par {c.NOME_SUBMERCADO[a]} e {c.NOME_SUBMERCADO[b]}"],
            fonte=c.FONTE_CCEE_PLD,
            arquivos=_arquivos_snap(snap_pld, {f"pld_horario_{a_}" for a_ in range(int(per["inicio"][:4]), int(per["fim"][:4]) + 1)}, cp, DS_PLD),
            consulta=f"PLD_HORARIO submercados {c.NOME_SUBMERCADO[a]} e {c.NOME_SUBMERCADO[b]}, mesmas horas, de {per['inicio']} a {per['fim']}",
            formula="100 × horas com |PLD_A − PLD_B| > R$ 0,01/MWh ÷ horas",
            numerador={"descricao": "horas separadas", "valor": x["horas_separadas"]},
            denominador={"descricao": "horas", "valor": x["horas"]}, cobertura=f"{x['horas']} horas",
            exclusoes=[f"{x['horas_diferenca_de_um_centavo']} horas com diferença de exatamente um centavo, fora da separação"],
            tratamento_ausencia="hora sem um dos submercados não entra",
            revisoes=_revisoes_recorte(cp, DS_PLD, [f"pld.{a}", f"pld.{b}"], lambda r_: per["inicio"] <= r_ <= per["fim"], "R$/MWh"),
            testes=[ev.teste("horas com os quatro submercados", veredito(comuns_ok),
                             f"{len(h12)} horas no período, {x['horas']} na contagem publicada, todas com PLD nos quatro submercados"),
                    ev.teste("matriz de separação", veredito(mt is not None and abs(mt - x["frac_separadas"]) < 1e-12),
                             f"a matriz 12m publica {_pct(mt, 2)} para o par")] + ([falta] if falta else []),
            reconciliacao=rec,
            download=[{"rotulo": "CSV diário de separação", "url": "/energia/series/pld_separacao_diaria.csv"}],
            reproducao=reproduzir + "\nSomar horas_separadas do par nos últimos 365 dias de pld_separacao_diaria.csv e dividir pelas horas.")
    # A02
    seq = a02.get("sequencia_comum_mais_longa")
    if seq and a02.get("arquivos"):
        arqs = []
        for x in a02["arquivos"]:
            for rec_, sha in ((x["recurso"], x["sha256"]), (x["parquet"]["recurso"], x["parquet"]["sha256"])):
                nome = rec_.rsplit(".", 1)[0] + ("_parquet" if rec_.endswith(".parquet") else "")
                v_ = base.ultima_vintage(con, DS_A02, nome) if con is not None else None
                arqs.append({"recurso": rec_, "arquivo": (v_ or {}).get("arquivo"), "sha256": sha,
                             "capturado_em": (v_ or {}).get("capturado_em"), "publicado_em": (v_ or {}).get("publicado_em")})
        out["a02_zeros"] = _evidencia(
            indicador="Sequência de CMO semanal igual a zero", valor_exibido=f"{seq['semanas']} semanas", valor=seq["semanas"],
            unidade="semanas operativas", periodo=a02["periodo"] and {"inicio": a02["periodo"]["primeira_semana_inicio"],
                                                                        "fim": a02["periodo"]["ultima_semana_fim"]},
            entidade="quatro subsistemas", universo="CMO semanal do DECOMP publicado pelo ONS",
            filtros=["média semanal e três patamares iguais a zero"], fonte=FONTE_SEM, arquivos=arqs,
            consulta=f"CMO_SEMANAL, din_instante de {seq['inicio']} a {seq['fim']}, todos os subsistemas e campos",
            formula="nº de semanas consecutivas (passo de 7 dias) com média semanal = 0",
            cobertura=f"{len(a02['arquivos'])} arquivos anuais relidos em CSV e Parquet",
            tratamento_ausencia="semana ausente interrompe a sequência", revisoes=(snap_a02.get("revisoes") or {}).get("total"),
            testes=ctrl("CMO semanal: silver principal"),
            reconciliacao=ev.reconciliacao("CSV contra Parquet oficial, célula a célula",
                                           "aprovado" if a02["status"] == "confirmado no arquivo original" else "reprovado",
                                           "0,00000001 R$/MWh por célula"),
            download=[{"rotulo": "CSV semanal", "url": "/energia/series/pld_cmo_semanal.csv"}],
            reproducao=reproduzir + "\nBaixar CMO_SEMANAL_<ano>.csv do ONS e filtrar as semanas do período.")
    return out
