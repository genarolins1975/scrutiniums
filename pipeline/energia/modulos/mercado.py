"""Módulo Mercado: livre e regulado, agentes e migração, MRE e GSF, encargos (painéis P032 a P035,
seção 9.7 da especificação).

O que o módulo publica, com a fonte oficial que de fato responde deste ambiente:

* P032, consumo por ambiente de contratação: a série mensal da EPE (consumo de energia
  elétrica na rede informado pelos agentes ao SAM, cativo e livre, por região, subsistema,
  classe e UF, desde 2004), conferida mês a mês contra o total nacional que a própria EPE
  publica na planilha formatada e contra o Boletim Mensal de Monitoramento do MME; e, por
  distribuidora (CNPJ da fonte), a energia e as unidades consumidoras do mercado livre e do
  cativo faturadas na rede de cada uma (SAMP da ANEEL, 2019 em diante). O universo é o da
  EPE: ACL + ACR fecha com o total da EPE e não é igualado à carga do ONS (o MME publica a
  diferença como "Perdas e Diferenças").
* P033, agentes e migração: estoque mensal de unidades consumidoras livres (EPE) e sua
  variação líquida; por distribuidora, as unidades livres por característica (fonte
  incentivada, autoprodução, ERC, convencional) do SAMP; e o cadastro de agentes da ANEEL
  (CNPJ e atividades). Agente (pessoa jurídica, CNPJ), perfil (registro de um agente na
  CCEE) e unidade consumidora (ponto de entrega medido) são coisas distintas: as bases
  abertas acessíveis têm o primeiro e o terceiro; perfil só existe na CCEE.
* P034, MRE e GSF: o custo do risco hidrológico alocado às distribuidoras (cotas, usinas
  repactuadas e Itaipu), apurado pela CCEE e publicado pela ANEEL na base Conta Bandeira,
  por distribuidora e competência. O fator GSF em si só é publicado pela CCEE: bloqueio
  externo documentado.
* P035, encargos e contabilização: encargos de serviços do sistema por tipo, por mês de
  competência, extraídos do Boletim Mensal do MME (fonte declarada: CCEE), com o
  reprocessamento entre edições; ESS e encargo de energia de reserva das distribuidoras
  (Conta Bandeira, ANEEL). A contabilização pública do mercado de curto prazo por
  submercado (CCEE) tem coletor pronto para o Actions, com esquema documentado e falha
  fechada.

Fora de escopo, por não haver fonte pública adequada: contratos individuais, preços de PPA e
curvas a termo. O PLD não é preço contratual do mercado livre e não é usado aqui como tal.
"""
import gzip
import json
import os
import shutil
import sys
import tempfile
import urllib.request
from contextlib import contextmanager
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.common import USER_AGENT, http_download, http_get  # noqa: E402
from pipeline.energia import base  # noqa: E402
from pipeline.energia import evidencia as evid  # noqa: E402
from pipeline.energia.fontes import aneel_mercado as am  # noqa: E402
from pipeline.energia.fontes import ccee_mercado as cm  # noqa: E402
from pipeline.energia.fontes import ckan  # noqa: E402
from pipeline.energia.fontes import epe_mercado as em  # noqa: E402
from pipeline.energia.fontes import mme_mercado as mm  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

GOLD = "mercado.json"
FAMILIA = "mercado"
VERSAO_PARSER = "mercado-1"

DS_EPE = "epe_consumo_mensal"
DS_EPE_PLAN = "epe_consumo_classe"
DS_SAMP = "aneel_samp_mercado"
DS_CB = "aneel_conta_bandeira"
DS_AGENTES = "aneel_agentes_mercado"
DS_MME = "mme_boletim_monitoramento"

URL_EPE_PAGINA = "https://www.epe.gov.br/pt/publicacoes-dados-abertos/dados-abertos/dados-do-consumo-mensal-de-energia-eletrica"
URL_EPE_DA = "https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/dados-abertos/Documents/Dados_abertos_Consumo_Mensal.xlsx"
URL_EPE_DIC = "https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/dados-abertos/Documents/Consumo-Mensal-Dicionario-de-Dados.pdf"
URL_EPE_PLAN_PAGINA = "https://www.epe.gov.br/pt/publicacoes-dados-abertos/publicacoes/consumo-de-energia-eletrica"
URL_EPE_PLAN = ("https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/publicacoes/Documents/"
                "CONSUMO%20MENSAL%20DE%20ENERGIA%20EL%C3%89TRICA%20POR%20CLASSE.xlsx")
RECURSO_EPE_DA = "Dados_abertos_Consumo_Mensal.xlsx"
RECURSO_EPE_DIC = "Consumo-Mensal-Dicionario-de-Dados.pdf"
RECURSO_EPE_PLAN = "CONSUMO_MENSAL_DE_ENERGIA_ELETRICA_POR_CLASSE.xlsx"
LICENCA_EPE = "Creative Commons Atribuição 4.0 Internacional (CC BY 4.0), conforme o rodapé do portal da EPE"

URL_SAMP = "https://dadosabertos.aneel.gov.br/dataset/samp"
URL_BAND = "https://dadosabertos.aneel.gov.br/dataset/bandeiras-tarifarias"
URL_AGENTES = "https://dadosabertos.aneel.gov.br/dataset/agentes-do-setor-eletrico"
LICENCA_ANEEL = "Open Data Commons Open Database License (ODbL)"
RECURSO_CB = "Bandeira Tarifária - Conta Bandeira"
RECURSO_AGENTES = "agentes-setor-eletrico"
ANO_INICIAL_SAMP = 2019

URL_MME = ("https://www.gov.br/mme/pt-br/assuntos/secretarias/secretaria-nacional-energia-eletrica/publicacoes/"
           "boletim-de-monitoramento-do-sistema-eletrico")
LICENCA_MME = ("Creative Commons Atribuição-SemDerivações 3.0 Não Adaptada (CC BY-ND 3.0), conforme o rodapé do portal "
               "gov.br; os números são reproduzidos com atribuição, sem versão alterada do documento")

PAGINA = [{"rotulo": "Mercado", "href": "/setor-eletrico/mercado"}]
CSV_CONSUMO = "mercado_consumo_mensal.csv"
CSV_CONSUMO_UF = "mercado_consumo_uf.csv"
CSV_NACIONAL = "mercado_nacional_mensal.csv"
CSV_DISTRIB = "mercado_distribuidoras_mensal.csv"
CSV_CB = "mercado_conta_bandeira.csv"
CSV_ESS = "mercado_encargos_mme.csv"
CSV_AGENTES = "mercado_agentes_aneel.csv"
CSV_CCEE = "mercado_ccee_mensal.csv"
CSV_DESLIG = "mercado_ccee_desligamentos.csv"
CSV_DISTRIB_ANO = "mercado_distribuidoras_ano.csv"


def _url(nome):
    return f"/energia/series/{nome}"


REGISTRO = {
    "id": "mercado", "gold": GOLD, "familia": FAMILIA, "ordem": 35,
    "datasets": [
        {"orgao": "EPE", "nome": "dados-do-consumo-mensal-de-energia-eletrica", "slug": "epe-consumo-mensal",
         "dataset_silver": DS_EPE, "titulo": "Consumo mensal de energia elétrica: dados abertos (SAM), cativo e livre",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_EPE_PAGINA, "licenca": LICENCA_EPE, "paginas": PAGINA,
         "downloads": [_url(CSV_CONSUMO), _url(CSV_CONSUMO_UF), _url(CSV_NACIONAL)], "quebras": []},
        {"orgao": "EPE", "nome": "consumo-de-energia-eletrica", "slug": "epe-consumo-classe-planilha",
         "dataset_silver": DS_EPE_PLAN, "titulo": "Consumo mensal de energia elétrica por classe (planilha formatada; conferência)",
         "estado": "VALIDADO", "url": URL_EPE_PLAN_PAGINA, "licenca": LICENCA_EPE, "paginas": PAGINA,
         "downloads": [_url(CSV_NACIONAL)], "quebras": []},
        {"orgao": "ANEEL", "nome": "samp", "slug": "aneel-samp-mercado", "dataset_silver": DS_SAMP,
         "titulo": "SAMP: mercado faturado das distribuidoras (cativo e livre, energia e unidades consumidoras)",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_SAMP, "licenca": LICENCA_ANEEL, "paginas": PAGINA,
         "downloads": [_url(CSV_DISTRIB), _url(CSV_DISTRIB_ANO)], "quebras": []},
        {"orgao": "ANEEL", "nome": "bandeiras-tarifarias", "slug": "aneel-conta-bandeira", "dataset_silver": DS_CB,
         "titulo": "Bandeiras tarifárias: Conta Bandeira (custos apurados pela CCEE por distribuidora)",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_BAND, "licenca": LICENCA_ANEEL, "paginas": PAGINA,
         "downloads": [_url(CSV_CB)], "quebras": []},
        {"orgao": "ANEEL", "nome": "agentes-do-setor-eletrico", "slug": "aneel-agentes-setor-eletrico",
         "dataset_silver": DS_AGENTES, "titulo": "Cadastro de agentes do setor elétrico (atividades por CNPJ)",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_AGENTES, "licenca": LICENCA_ANEEL, "paginas": PAGINA,
         "downloads": [_url(CSV_AGENTES)], "quebras": []},
        {"orgao": "MME", "nome": "boletim-de-monitoramento-do-sistema-eletrico", "slug": "mme-boletim-monitoramento",
         "dataset_silver": DS_MME, "titulo": "Boletim Mensal de Monitoramento do Sistema Elétrico (encargos de serviços do sistema e consumo por ambiente)",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_MME, "licenca": LICENCA_MME, "paginas": PAGINA,
         "downloads": [_url(CSV_ESS)], "quebras": [
             {"data": "2026-03-01", "descricao": "A edição de março de 2026 publicou o suporte de reativo de março com uma parcela 'vinculada a resposta da demanda' (280 mil R$); as edições de abril a junho retiraram a parcela e o total de março passou de 344.773 para 344.493 mil R$."}]},
        *[{"orgao": "CCEE", "nome": nome, "slug": f"ccee-{nome.replace('_', '-')}", "dataset_silver": cm.dataset(nome),
           "titulo": spec["titulo"], "estado": "UTILIZADO EM INDICADOR", "url": f"{cm.PORTAL}/dataset/{nome}",
           "licenca": cm.LICENCA, "paginas": PAGINA, "downloads": [_url(CSV_CCEE)], "quebras": spec.get("quebras", [])}
          for nome, spec in cm.CONJUNTOS.items()],
        {"orgao": "CCEE", "nome": "infomercado-mensal", "slug": "ccee-infomercado-mensal", "dataset_silver": cm.DS_INFOMERCADO,
         "titulo": "InfoMercado mensal (PDF): sumário executivo e composição dos encargos, usados para conferir os números calculados",
         "estado": "VALIDADO", "url": cm.URL_MERCADO_MENSAL,
         "licenca": "Publicação da CCEE; números reproduzidos com atribuição, apenas para conferência", "paginas": PAGINA,
         "downloads": [], "quebras": [
             {"data": "2026-07-01", "descricao": "O parágrafo de composição dos encargos mudou de rótulos entre 2024 e 2026 (restrição de operação, suporte de reativo, deslocamento hidráulico por perfis de geração e de consumo, suporte de reativo vinculado ao sandbox); o extrator mapeia os rótulos conhecidos e registra os desconhecidos."}]},
    ],
    "arquivos": {
        _url(CSV_CONSUMO): "mes (AAAA-MM); regiao (geográfica); subsistema (SE, S, NE, N ou ISOL = sistemas isolados); classe (Residencial, Industrial, Comercial, Rural, Outros); tipo (cativo ou livre); consumo_mwh (consumo de energia elétrica na rede, MWh, como publicado pela EPE); unidades_consumidoras (número de UCs no mês). Fonte: EPE, dados abertos do consumo mensal (tabela CONSUMO E NUMCONS SAM). Vazio = a fonte não publicou o valor; zero é zero.",
        _url(CSV_CONSUMO_UF): "mes; uf; subsistema; classe; tipo; consumo_mwh; unidades_consumidoras. Fonte: EPE, tabela CONSUMO E NUMCONS SAM UF (até o penúltimo mês publicado). Vazio = ausência.",
        _url(CSV_NACIONAL): "mes; cativo_mwh; livre_mwh; total_mwh (soma das linhas da EPE); livre_pct (100 × livre ÷ total); cativo_uc; livre_uc; total_planilha_mwh e livre_planilha_mwh (total nacional da planilha formatada da EPE, para conferência); diferenca_total_mwh (tabela longa − planilha); preliminar (1 = ano marcado como preliminar pela EPE); samp_livre_uc e samp_livre_mwh (soma das distribuidoras no SAMP da ANEEL: só consumidores livres faturados por distribuidora); samp_distribuidoras (quantas distribuidoras publicaram o mês). Vazio = ausência.",
        _url(CSV_DISTRIB): "cnpj (14 dígitos, da fonte); sigla; mes; livre_mwh (energia TUSD faturada a consumidores livres, MWh, tipos de mercado da competência); livre_mwh_incentivada, livre_mwh_autoproducao, livre_mwh_erc, livre_mwh_convencional, livre_mwh_outro (abertura pela característica do consumidor no SAMP); livre_uc e as mesmas aberturas em unidades consumidoras; livre_mwh_refat (refaturamento de meses anteriores apresentado neste mês, sem atribuição de competência); cativo_mwh (energia TE faturada ao cativo, inclui consumidores com micro e minigeração após a compensação); cativo_uc; cativo_mwh_refat. Fonte: ANEEL, SAMP, arquivos anuais em Parquet. Vazio = a distribuidora não publicou a linha no mês.",
        _url(CSV_DISTRIB_ANO): "ano (último ano civil com os 12 meses publicados por quase todas as distribuidoras); cnpj; sigla; nome; meses (meses do ano com linha no SAMP); completo (1 = 12 meses); livre_mwh e cativo_mwh (soma do ano, MWh); livre_pct_faturada (100 × livre ÷ (livre + cativo), só com 12 meses); livre_uc_dez e livre_uc_dez_anterior (unidades consumidoras livres em dezembro do ano e do ano anterior); variacao_livre_uc; livre_uc_incentivada_dez, livre_uc_convencional_dez, livre_uc_autoproducao_dez; cativo_uc_dez. Fonte: ANEEL, SAMP. Vazio = ausência.",
        _url(CSV_CB): "cnpj (vazio quando a fonte não identifica a distribuidora); sigla; mes (competência); campos em R$ como publicados: receita_faturada, repasse_conta_bandeira, resultado_mcp, ccear_d, rh_ccgf_repactuadas_liquido, rh_itaipu, rh_repactuadas, rh_ccgf, previsao_rh, premio_risco, ess_eer, ressarcimento_coner; linhas (quantas linhas da fonte foram somadas na mesma distribuidora e competência). Fonte: ANEEL, Bandeiras Tarifárias, recurso Conta Bandeira; os custos são os apurados e informados pela CCEE. Vazio = ausência.",
        _url(CSV_ESS): "edicao (mês de referência do boletim, AAAA-MM); mes (competência, AAAA-MM); tipo (id do encargo); rotulo; nivel (tipo, parcela ou total); valor_mil_rs (mil R$ como publicados); traco (1 = a tabela publicou '-', lido como zero porque a soma do mês fecha); vigente (1 = edição mais recente para o mês). Fonte: MME, Boletim Mensal de Monitoramento do Sistema Elétrico (dados da CCEE).",
        _url(CSV_CCEE): "conjunto (nome do conjunto no portal de dados abertos da CCEE); serie (dimensões e coluna de origem separadas por '|', por exemplo 'SE|GERACAO_MRE' ou 'CONSUMO_TOTAL_ACL'); mes (AAAA-MM de referência); valor (como publicado: MWmed nos conjuntos de consumo, geração e garantia física, R$ nos de encargos e liquidação, MWh no balanço do MCP e nas parcelas de carga, contagem nos de agentes e parcelas); unidade. Fonte: CCEE, dados abertos (CC-BY-4.0). Vazio = a fonte não publicou o valor.",
        _url(CSV_DESLIG): "data (dia do desligamento); tipo (voluntario ou compulsorio); cnpj (do agente desligado, 14 dígitos; vazio quando a fonte não traz); agente (nome); classe; sucessao (tipo de sucessão informado pela CCEE); cnpj_sucessor; classe_sucessor; reuniao_cad (reunião do Conselho de Administração que aprovou). Fonte: CCEE, conjuntos DESLIGAMENTO_VOLUNTARIO e DESLIGAMENTO_COMPULSORIO.",
        _url(CSV_AGENTES): "cnpj; nome (razão social); ativo (1 ativo, 0 inativo, vazio sem informação); comercializacao; distribuicao; geracao; transmissao (1 = o cadastro marca a atividade); gerado_em (data de geração do arquivo pela ANEEL). Fonte: ANEEL, cadastro de agentes do setor elétrico. CNPJ é agente (pessoa jurídica), não perfil da CCEE nem unidade consumidora.",
    },
}


# ======================================================================= coleta

@contextmanager
def _descomprimido(arquivo, sufixo):
    """Arquivo do bronze (.gz) descomprimido em fluxo para um temporário: zip e Parquet
    precisam de acesso aleatório, e o arquivo inteiro não precisa ficar na memória."""
    fd, tmp = tempfile.mkstemp(prefix="mercado-", suffix=sufixo)
    os.close(fd)
    try:
        with base.abre_bronze(arquivo) as src, open(tmp, "wb") as dst:
            shutil.copyfileobj(src, dst, 1 << 20)
        yield tmp
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass


def _ja_processada(con, ds, vid):
    return con.execute("SELECT 1 FROM registros WHERE dataset=? AND chave=? LIMIT 1",
                       (ds, f"__processada__|{vid}|{VERSAO_PARSER}")).fetchone() is not None


def _marca_processada(con, ds, vid, contagem):
    linhas = [(f"__processada__|{vid}|{VERSAO_PARSER}", "ok", "1")]
    linhas += [(f"__universo__|{vid}", k, str(v)) for k, v in sorted(contagem.items())]
    base.grava_registros(con, ds, vid, linhas)


def _last_modified(url):
    """Data de modificação que o servidor da fonte informa (cabeçalho Last-Modified), em UTC;
    None quando não informa. Não substitui a data do dado (a versão declarada na planilha)."""
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            lm = resp.headers.get("Last-Modified")
        if not lm:
            return None
        return parsedate_to_datetime(lm).astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    except Exception:
        return None


def _utc(iso_com_fuso):
    if not iso_com_fuso:
        return None
    return datetime.fromisoformat(iso_com_fuso).astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _processa_epe(con, v):
    if _ja_processada(con, DS_EPE, v["vintage_id"]):
        return {"reprocessada": False}
    contagem, obs, versoes = {}, [], set()
    with _descomprimido(v["arquivo"], ".xlsx") as tmp:
        for por_uf in (False, True):
            vistos = set()
            for l in em.linhas_consumo_sam(tmp, por_uf=por_uf, contagem=contagem):
                chave = (em.chave_serie(l, "consumo"), l["mes"])
                if chave in vistos:
                    contagem["duplicatas"] = contagem.get("duplicatas", 0) + 1
                vistos.add(chave)
                obs.append((em.chave_serie(l, "consumo"), l["mes"], l["consumo_mwh"]))
                obs.append((em.chave_serie(l, "ucs"), l["mes"], l["ucs"]))
                versoes.add(l["versao"])
    novas, rev = base.grava_observacoes(con, DS_EPE, v["vintage_id"], obs)
    base.grava_registros(con, DS_EPE, v["vintage_id"], [("__arquivo__", "versao_dados", ";".join(sorted(x for x in versoes if x)))])
    _marca_processada(con, DS_EPE, v["vintage_id"], contagem)
    con.commit()
    return {"reprocessada": True, "novas": novas, "revisoes": rev, "universo": contagem}


def _processa_epe_planilha(con, v):
    if _ja_processada(con, DS_EPE_PLAN, v["vintage_id"]):
        return {"reprocessada": False}
    with _descomprimido(v["arquivo"], ".xlsx") as tmp:
        pl = em.totais_planilha(tmp)
    obs = [(f"plan|{medida}", mes, val) for medida, serie in pl["series"].items() for mes, val in serie.items()]
    novas, rev = base.grava_observacoes(con, DS_EPE_PLAN, v["vintage_id"], obs)
    base.grava_registros(con, DS_EPE_PLAN, v["vintage_id"], [
        ("__arquivo__", "anos_preliminares", ";".join(pl["anos_preliminares"])),
        ("__arquivo__", "atualizacao", pl["atualizacao"])])
    _marca_processada(con, DS_EPE_PLAN, v["vintage_id"], {"observacoes": len(obs)})
    con.commit()
    return {"reprocessada": True, "novas": novas, "revisoes": rev}


def _processa_samp(con, v):
    if not v["recurso"].endswith(".parquet") or _ja_processada(con, DS_SAMP, v["vintage_id"]):
        return {"reprocessada": False}
    contagem = {}
    with _descomprimido(v["arquivo"], ".parquet") as tmp:
        agg, cadastro = am.agrega_samp(am.lotes_parquet(tmp), contagem)
    obs = [(f"{cn}|{medida}", mes, val) for (cn, mes), medidas in agg.items() for medida, val in medidas.items()]
    regs = [(f"agente|{cn}", campo, valor) for cn, d in cadastro.items() for campo, valor in d.items() if valor]
    novas, rev = base.grava_observacoes(con, DS_SAMP, v["vintage_id"], obs)
    base.grava_registros(con, DS_SAMP, v["vintage_id"], regs)
    contagem["meses"] = len({m for _, m in agg})
    _marca_processada(con, DS_SAMP, v["vintage_id"], contagem)
    con.commit()
    return {"reprocessada": True, "novas": novas, "revisoes": rev, "universo": contagem}


CAMPOS_CB_CURTOS = {
    "VlrReceitaFaturada": "receita_faturada", "VlrRepasseContaBandeira": "repasse_conta_bandeira",
    "VlrResultadoMCP": "resultado_mcp", "VlrCCEARD": "ccear_d", "VlrRiscoHidrologicoCCGFRepactuadas": "rh_ccgf_repactuadas_liquido",
    "VlrRiscoHidrologicoItaipu": "rh_itaipu", "VlrRiscoHidrologicoRepactuadas": "rh_repactuadas",
    "VlrRiscoHidrologicoCCGF": "rh_ccgf", "VlrPrevisaoRiscoHidrologico": "previsao_rh", "VlrPremioDeRisco": "premio_risco",
    "VlrESSEER": "ess_eer", "VlrRessarcimentoCONER": "ressarcimento_coner",
}


def _processa_conta_bandeira(con, v):
    if "conta bandeira" not in v["recurso"].lower() or (v.get("arquivo") or "").endswith(".pdf.gz"):
        return {"reprocessada": False, "ignorado": v["recurso"]}
    if _ja_processada(con, DS_CB, v["vintage_id"]):
        return {"reprocessada": False}
    with base.abre_bronze(v["arquivo"]) as f:
        bruto = f.read()
    texto = bruto.decode("utf-8-sig") if not _latin(bruto) else bruto.decode("latin-1")
    contagem, soma, linhas, siglas = {}, {}, {}, {}
    viol = 0
    for l in am.linhas_conta_bandeira(texto, contagem):
        chave = l["cnpj"] or "sem_cnpj"
        k = (chave, l["mes"])
        linhas[k] = linhas.get(k, 0) + 1
        if l["cnpj"] and l["sigla"]:
            siglas[l["cnpj"]] = l["sigla"]
        d = am.confere_risco_hidrologico(l["campos"])
        if d is not None and abs(d) > 1.0:
            viol += 1
        destino = soma.setdefault(k, {})
        for campo, val in l["campos"].items():
            if val is None:
                continue
            curto = CAMPOS_CB_CURTOS[campo]
            destino[curto] = destino.get(curto, 0.0) + val
    contagem["identidade_risco_hidrologico_violada"] = viol
    contagem["chaves_com_mais_de_uma_linha"] = sum(1 for n in linhas.values() if n > 1)
    obs = [(f"{cn}|{campo}", mes, val) for (cn, mes), d in soma.items() for campo, val in d.items()]
    obs += [(f"{cn}|linhas", mes, float(n)) for (cn, mes), n in linhas.items()]
    regs = [(f"agente|{cn}", "sigla", s) for cn, s in siglas.items()]
    novas, rev = base.grava_observacoes(con, DS_CB, v["vintage_id"], obs)
    base.grava_registros(con, DS_CB, v["vintage_id"], regs)
    _marca_processada(con, DS_CB, v["vintage_id"], contagem)
    con.commit()
    return {"reprocessada": True, "novas": novas, "revisoes": rev, "universo": contagem}


def _latin(bruto):
    try:
        bruto[:200000].decode("utf-8")
        return False
    except UnicodeDecodeError as e:
        return e.start < min(len(bruto), 200000) - 3


def _processa_agentes(con, v):
    if (v.get("arquivo") or "").endswith(".pdf.gz") or _ja_processada(con, DS_AGENTES, v["vintage_id"]):
        return {"reprocessada": False}
    with base.abre_bronze(v["arquivo"]) as f:
        bruto = f.read()
    texto = bruto.decode("latin-1") if _latin(bruto) else bruto.decode("utf-8-sig")
    contagem, regs = {}, []
    for a in am.linhas_agentes(texto, contagem):
        ch = f"cnpj|{a['cnpj']}"
        regs.append((ch, "nome", a["nome"]))
        regs.append((ch, "ativo", {True: "1", False: "0"}.get(a["ativo"])))
        for at, val in a["atividades"].items():
            regs.append((ch, at, "1" if val else "0"))
        if a["gerado_em"]:
            regs.append(("__arquivo__", "gerado_em", a["gerado_em"]))
    novas, rev = base.grava_registros(con, DS_AGENTES, v["vintage_id"], regs)
    _marca_processada(con, DS_AGENTES, v["vintage_id"], contagem)
    con.commit()
    return {"reprocessada": True, "novas": novas, "revisoes": rev, "universo": contagem}


def _pagina_do_trecho(texto, marcador):
    """Página (1 = primeira) do PDF em que aparece o marcador, pelas quebras de página (\\f)
    que o pdftotext preserva."""
    i = texto.find(marcador)
    return None if i < 0 else texto.count("\f", 0, i) + 1


def _processa_mme(con, v):
    if not v["recurso"].endswith(".pdf") or _ja_processada(con, DS_MME, v["vintage_id"]):
        return {"reprocessada": False}
    with _descomprimido(v["arquivo"], ".pdf") as tmp:
        texto = mm.texto_pdf(tmp)
    if texto is None:
        return {"reprocessada": False, "erro": "pdftotext ausente: extração adiada para um ambiente com poppler"}
    ed = mm.edicao(texto)
    obs, regs, contagem = [], [], {}
    try:
        ess = mm.tabela_ess(texto, ed)
        for ident, serie in ess["valores"].items():
            for mes, val in serie.items():
                obs.append((f"ess|{ident}|ed{ed}", mes, val))
        regs.append((f"edicao|{ed}", "ess_tracos", json.dumps(sorted(f"{i}|{m}" for i, m in ess["tracos"]))))
        regs.append((f"edicao|{ed}", "ess_descartados", json.dumps(ess["descartados"])))
        regs.append((f"edicao|{ed}", "ess_pagina", str(_pagina_do_trecho(texto, "Encargos de Serviços de Sistema –"))))
        contagem["ess_meses"] = len(ess["meses"])
    except mm.TabelaNaoReconhecida as e:
        regs.append((f"edicao|{ed}", "ess_erro", str(e)))
    try:
        ca = mm.tabela_consumo_ambiente(texto)
        if ca["ok"]:
            for amb, d in ca["linhas"].items():
                obs.append((f"consumo|{amb}|mes|ed{ed}", ca["mes"], d["mes"]))
                obs.append((f"consumo|{amb}|mes_ano_anterior|ed{ed}", ca["mes_ano_anterior"], d["mes_anterior"]))
                obs.append((f"consumo|{amb}|acum12|ed{ed}", ca["mes"], d["acum"]))
            regs.append((f"edicao|{ed}", "consumo_mes", ca["mes"]))
            regs.append((f"edicao|{ed}", "consumo_pagina", str(_pagina_do_trecho(texto, "estratificação por ambiente de contratação"))))
        pdif = mm.perdas_e_diferencas(texto)
        obs.append((f"carga|perdas_diferencas|ed{ed}", ca["mes"], pdif["perdas_diferencas"]["mes"]))
        obs.append((f"carga|total|ed{ed}", ca["mes"], pdif["total"]["mes"]))
    except mm.TabelaNaoReconhecida as e:
        regs.append((f"edicao|{ed}", "consumo_erro", str(e)))
    regs.append((f"edicao|{ed}", "recurso", v["recurso"]))
    regs.append((f"edicao|{ed}", "vintage", v["vintage_id"]))
    novas, rev = base.grava_observacoes(con, DS_MME, v["vintage_id"], obs)
    base.grava_registros(con, DS_MME, v["vintage_id"], regs)
    contagem["observacoes"] = len(obs)
    _marca_processada(con, DS_MME, v["vintage_id"], contagem)
    con.commit()
    return {"reprocessada": True, "edicao": ed, "novas": novas, "revisoes": rev, "universo": contagem}


def coletar(con, ctx):
    """Coleta todas as fontes do módulo. Falha de uma fonte fica registrada e não interrompe as
    outras; a gold é construída com o que o silver tiver."""
    status = {"fontes": {}}

    def registra(nome, fn):
        try:
            status["fontes"][nome] = fn()
        except Exception as e:  # fonte fora do ar ou esquema novo: registrado, sem número inventado
            base.registra_coleta(con, nome, "*", False, f"{type(e).__name__}: {e}")
            con.commit()
            status["fontes"][nome] = {"ok": False, "erro": f"{type(e).__name__}: {e}"[:400]}

    def arquivo(ds, recurso, url, ext, processa, max_idade=7):
        pub = _last_modified(url)
        res = ckan.baixar_recurso(con, orgao="EPE", dataset=ds, recurso=recurso, url=url, publicado_em=pub, ext=ext,
                                  max_idade_dias=max_idade, baixador=http_download)
        out = {"status": res["status"], "detalhe": res["detalhe"], "publicado_em": pub}
        if res["vintage"] and processa:
            out["processamento"] = processa(con, res["vintage"])
        out["ok"] = res["status"] != "falha"
        return out

    registra(DS_EPE, lambda: {"dados": arquivo(DS_EPE, RECURSO_EPE_DA, URL_EPE_DA, "xlsx", _processa_epe),
                              "dicionario": arquivo(DS_EPE, RECURSO_EPE_DIC, URL_EPE_DIC, "pdf", None, 30)})
    registra(DS_EPE_PLAN, lambda: arquivo(DS_EPE_PLAN, RECURSO_EPE_PLAN, URL_EPE_PLAN, "xlsx", _processa_epe_planilha))

    def pacote(nome_ckan, ds, filtro, processa, max_idade=7):
        st, _, vint = ckan.coleta_pacote(con, orgao="ANEEL", nome=nome_ckan, dataset=ds, filtro_recurso=filtro,
                                         max_idade_dias=max_idade)
        st["processamento"] = {}
        for recurso, v in sorted(vint.items()):
            if (v.get("arquivo") or "").endswith(".pdf.gz"):
                continue  # dicionário de dados: guardado no bronze como evidência, não é lido
            st["processamento"][recurso] = processa(con, v)
        return st

    nome = lambda r: (r.get("name") or "").strip()  # noqa: E731
    anos = {f"samp-{a}.parquet" for a in range(ANO_INICIAL_SAMP, ctx["hoje"].year + 1)}
    registra(DS_SAMP, lambda: pacote("samp", DS_SAMP,
                                     lambda r: nome(r) in anos or (r.get("format") or "").upper() == "PDF", _processa_samp))
    registra(DS_CB, lambda: pacote("bandeiras-tarifarias", DS_CB,
                                   lambda r: "conta bandeira" in nome(r).lower(), _processa_conta_bandeira))
    registra(DS_AGENTES, lambda: pacote("agentes-do-setor-eletrico", DS_AGENTES,
                                        lambda r: (r.get("format") or "").upper() in ("CSV", "PDF"), _processa_agentes, 30))

    def mme():
        out = {"edicoes": {}}
        for ano in (ctx["hoje"].year, ctx["hoje"].year - 1):
            url_pasta = f"{URL_MME}/{ano}"
            corpo, _ = http_get(url_pasta, timeout=60, accept="text/html")
            capturado = base.agora_utc()
            caminho, sha = base.salva_bronze("mme", DS_MME, f"pasta-{ano}", corpo, "html", capturado)
            base.registra_vintage(con, DS_MME, f"pasta-{ano}", url_pasta, capturado, None, sha, len(corpo), "coleta_direta", caminho)
            links = mm.links_boletins(corpo.decode("utf-8", errors="replace"), url_pasta)
            out[f"pasta_{ano}"] = len(links)
            for nome_pdf, url_pdf, quando in links:
                res = ckan.baixar_recurso(con, orgao="MME", dataset=DS_MME, recurso=nome_pdf, url=url_pdf,
                                          publicado_em=_utc(quando), ext="pdf", max_idade_dias=30, baixador=http_download)
                item = {"status": res["status"], "detalhe": res["detalhe"]}
                if res["vintage"]:
                    item["processamento"] = _processa_mme(con, res["vintage"])
                out["edicoes"][nome_pdf] = item
        con.commit()
        out["ok"] = all(x["status"] != "falha" for x in out["edicoes"].values())
        return out
    registra(DS_MME, mme)
    registra("ccee_mercado", lambda: cm.coleta(con))
    registra(cm.DS_INFOMERCADO, lambda: cm.coleta_infomercado(con))
    status["ok"] = all(v.get("ok", True) for v in status["fontes"].values() if isinstance(v, dict))
    return status


# ======================================================================= leitura do silver

def _vigentes(con, ds):
    """{(série, ref): valor} com o valor da captura mais recente de cada observação."""
    out = {}
    for s, r, v in con.execute(
            """SELECT o.serie, o.ref, o.valor FROM observacoes o JOIN vintages v ON v.vintage_id=o.vintage_id
               WHERE o.dataset=? ORDER BY v.capturado_em, o.rowid""", (ds,)):
        out[(s, r)] = v
    return out


def _vintage(con, ds, recurso_contendo=None):
    """Vintage mais recente do dataset (opcionalmente só recursos cujo nome contém o texto)."""
    vs = [v for v in base.vintages_do_dataset(con, ds) if recurso_contendo is None or recurso_contendo in v["recurso"]]
    return max(vs, key=lambda v: v["capturado_em"]) if vs else None


def _soma(*xs):
    xs = [x for x in xs if x is not None]
    return sum(xs) if xs else None


def _pct(num, den):
    if num is None or den in (None, 0):
        return None
    return 100.0 * num / den


def _mes_mais(mes, n):
    a, m = int(mes[:4]), int(mes[5:7]) - 1 + n
    return f"{a + m // 12}-{m % 12 + 1:02d}"


def _janela(mes_fim, n=12):
    return [_mes_mais(mes_fim, -i) for i in range(n - 1, -1, -1)]


def _br(v, casas=1):
    if v is None:
        return None
    s = f"{v:,.{casas}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def _fonte(orgao, dataset, recurso, url_dataset, url_primaria, licenca):
    return {"orgao": orgao, "dataset": dataset, "recurso": recurso, "url_dataset": url_dataset,
            "url_primaria": url_primaria, "licenca": licenca}


def _universo(con, ds, vid):
    """Contagens gravadas no processamento de uma vintage (linhas, duplicatas, violações)."""
    return {k: v for k, v in (base.registros_como_estavam_em(con, ds).get(f"__universo__|{vid}") or {}).items()}


# ======================================================================= P032: consumo por ambiente

def consumo_epe(obs):
    """Agregados da tabela longa da EPE a partir das observações vigentes.

    Retorna dicts {chave: {mes: valor}}: nacional por tipo; por classe, região, subsistema e UF
    por tipo; e unidades consumidoras nas mesmas aberturas. Soma só o que a fonte publicou:
    linha ausente não vira zero, e o mês sem nenhuma linha de um tipo fica sem valor."""
    out = {"nac": {}, "classe": {}, "regiao": {}, "sistema": {}, "uf": {}}
    for (serie, mes), val in obs.items():
        dec = em.decompoe_serie(serie)
        if dec is None or val is None:
            continue
        medida, d = dec
        sufixo = "mwh" if medida == "consumo" else "uc"
        alvos = [("uf", (d["uf"], d["tipo"]))] if "uf" in d else [
            ("nac", d["tipo"]), ("classe", (d["classe"], d["tipo"])), ("regiao", (d["regiao"], d["tipo"])),
            ("sistema", (d["sistema"], d["tipo"]))]
        for grupo, chave in alvos:
            serie_alvo = out[grupo].setdefault((chave, sufixo), {})
            serie_alvo[mes] = serie_alvo.get(mes, 0.0) + val
    return out


def nacional_mensal(agg, preliminares):
    meses = sorted({m for (k, suf), s in agg["nac"].items() for m in s})
    linhas = []
    for mes in meses:
        g = lambda tipo, suf: agg["nac"].get((tipo, suf), {}).get(mes)  # noqa: E731
        cat, liv = g("cativo", "mwh"), g("livre", "mwh")
        tot = cat + liv if cat is not None and liv is not None else None
        linhas.append({"mes": mes, "cativo_mwh": cat, "livre_mwh": liv, "total_mwh": tot, "livre_pct": _pct(liv, tot),
                       "cativo_uc": g("cativo", "uc"), "livre_uc": g("livre", "uc"),
                       "preliminar": mes[:4] in preliminares})
    return linhas


def anual(series_por_tipo, meses_validos=None):
    """{ano: {cativo, livre, total, livre_pct, meses}} a partir de {tipo: {mes: mwh}}; só meses em que
    os dois tipos existem entram (um mês só com cativo não é ano comparável)."""
    cat, liv = series_por_tipo.get("cativo", {}), series_por_tipo.get("livre", {})
    out = {}
    for mes in sorted(set(cat) & set(liv)):
        if meses_validos is not None and mes not in meses_validos:
            continue
        a = out.setdefault(mes[:4], {"cativo_mwh": 0.0, "livre_mwh": 0.0, "meses": 0})
        a["cativo_mwh"] += cat[mes]
        a["livre_mwh"] += liv[mes]
        a["meses"] += 1
    for a in out.values():
        a["total_mwh"] = a["cativo_mwh"] + a["livre_mwh"]
        a["livre_pct"] = _pct(a["livre_mwh"], a["total_mwh"])
        a["completo"] = a["meses"] == 12
    return out


def janela_12m(series_por_tipo, mes_fim):
    """Soma dos 12 meses até mes_fim por tipo; None se faltar algum mês (sem preencher lacuna)."""
    meses = _janela(mes_fim)
    cat, liv = series_por_tipo.get("cativo", {}), series_por_tipo.get("livre", {})
    if any(m not in cat or m not in liv for m in meses):
        return None
    c_, l_ = sum(cat[m] for m in meses), sum(liv[m] for m in meses)
    return {"inicio": meses[0], "fim": meses[-1], "cativo_mwh": c_, "livre_mwh": l_, "total_mwh": c_ + l_,
            "livre_pct": _pct(l_, c_ + l_)}


def reconcilia_planilha(nac_linhas, plan):
    """Tabela longa × planilha formatada da EPE, mês a mês. Tolerância: o maior entre 1 MWh e
    10⁻⁶ do valor nacional (as duas publicações são arredondadas de forma independente; a maior
    diferença observada em 2026 foi 3,2 MWh num total de 50 TWh) e 1 unidade consumidora."""
    pl = {}
    for (serie, mes), v in plan.items():
        pl.setdefault(serie.split("|", 1)[1], {})[mes] = v
    pares = {"total_mwh": "total_mwh", "cativo_mwh": "cativo_mwh", "livre_mwh": "livre_mwh",
             "cativo_uc": "cativo_uc", "livre_uc": "livre_uc"}
    res, falhas, n, maximo = {}, [], 0, {}
    por_mes = {l["mes"]: l for l in nac_linhas}
    for campo, med in pares.items():
        for mes, vp in sorted(pl.get(med, {}).items()):
            vl = (por_mes.get(mes) or {}).get(campo)
            if vl is None:
                falhas.append({"campo": campo, "mes": mes, "planilha": vp, "tabela_longa": None, "diferenca": None})
                continue
            n += 1
            dif = vl - vp
            tol = 1.0 if campo.endswith("_uc") else max(1.0, 1e-6 * abs(vp))
            maximo[campo] = max(maximo.get(campo, 0.0), abs(dif))
            if abs(dif) > tol:
                falhas.append({"campo": campo, "mes": mes, "planilha": vp, "tabela_longa": vl, "diferenca": dif})
    ident = 0
    for mes, tot in pl.get("total_mwh", {}).items():
        cat, liv = pl.get("cativo_mwh", {}).get(mes), pl.get("livre_mwh", {}).get(mes)
        if cat is not None and liv is not None and abs(cat + liv - tot) > max(1.0, 1e-6 * tot):
            ident += 1
    res.update(comparacoes=n, falhas=len(falhas), exemplos_falha=falhas[:10],
               maior_diferenca={k: c.r(v, 3) for k, v in maximo.items()}, identidade_planilha_violada=ident,
               tolerancia="maior entre 1 MWh e 10⁻⁶ do total nacional do mês; 1 unidade consumidora",
               resultado="aprovado" if not falhas and not ident and n else ("reprovado" if n else "ressalva"))
    return res


def reconcilia_mme(obs_mme, agg):
    """Consumo por ambiente publicado no Boletim do MME (GWh inteiros) × EPE, por edição.
    Tolerância: 1 GWh (arredondamento a GWh inteiro da tabela do boletim). Diferença maior é
    ressalva, não falha: o boletim usa a consolidação da EPE da data da edição, e a EPE revisa."""
    edicoes = sorted({s.rsplit("|ed", 1)[1] for (s, _) in obs_mme if s.startswith("consumo|")})
    linhas = []
    mapa = {"ACR": "cativo", "ACL": "livre"}
    for ed in edicoes:
        for (s, mes), v in obs_mme.items():
            if not s.startswith("consumo|") or not s.endswith(f"|ed{ed}"):
                continue
            _, amb, medida, _ = s.split("|")
            if medida == "mes_ano_anterior":
                continue
            if medida == "mes":
                vals = [agg["nac"].get((t, "mwh"), {}).get(mes) for t in (["cativo", "livre"] if amb == "Total" else [mapa[amb]])]
            else:
                vals = [sum(agg["nac"].get((t, "mwh"), {}).get(m) or 0.0 for m in _janela(mes))
                        if all(agg["nac"].get((t, "mwh"), {}).get(m) is not None for m in _janela(mes)) else None
                        for t in (["cativo", "livre"] if amb == "Total" else [mapa[amb]])]
            epe = None if any(x is None for x in vals) else sum(vals) / 1000.0
            dif = None if epe is None else epe - v
            linhas.append({"edicao": ed, "mes": mes, "ambiente": amb, "medida": "mes" if medida == "mes" else "acumulado_12_meses",
                           "mme_gwh": v, "epe_gwh": c.r(epe, 1), "diferenca_gwh": c.r(dif, 1),
                           "resultado": None if dif is None else ("aprovado" if abs(dif) <= 1.0 else "ressalva")})
    linhas.sort(key=lambda x: (x["edicao"], x["medida"], x["ambiente"]))
    return linhas


def carga_contexto(obs_mme, agg):
    """Por edição do boletim: carga verificada no SEB e 'Perdas e Diferenças' (GWh, MME), e o
    consumo da EPE no mesmo mês. Mostra que ACL + ACR é parte da carga, não a carga."""
    out = []
    eds = sorted({s.rsplit("|ed", 1)[1] for (s, _) in obs_mme if s.startswith("carga|total|")})
    for ed in eds:
        for (s, mes), v in obs_mme.items():
            if s != f"carga|total|ed{ed}":
                continue
            pdif = obs_mme.get((f"carga|perdas_diferencas|ed{ed}", mes))
            cat = agg["nac"].get(("cativo", "mwh"), {}).get(mes)
            liv = agg["nac"].get(("livre", "mwh"), {}).get(mes)
            cons = None if cat is None or liv is None else (cat + liv) / 1000.0
            out.append({"edicao": ed, "mes": mes, "carga_gwh": v, "perdas_diferencas_gwh": pdif,
                        "consumo_epe_gwh": c.r(cons, 1), "consumo_sobre_carga_pct": c.r(_pct(cons, v), 2)})
    return out


def horas_no_mes(mes):
    """Horas do mês civil. MWmed × horas = MWh; sem horário de verão desde 2019, o mês tem dias × 24 h
    (o período da CCEE usado aqui começa em 2023)."""
    import calendar
    a, m = int(mes[:4]), int(mes[5:7])
    return calendar.monthrange(a, m)[1] * 24


def _ccee(con, nome):
    return _vigentes(con, cm.dataset(nome))


def _serie(obs, serie):
    return {r: v for (s, r), v in obs.items() if s == serie}


def _vintages_ccee(con, nome):
    vs = base.vintages_do_dataset(con, cm.dataset(nome))
    ultimo = {}
    for v in vs:
        if v["recurso"] not in ultimo or v["capturado_em"] > ultimo[v["recurso"]]["capturado_em"]:
            ultimo[v["recurso"]] = v
    return [ultimo[k] for k in sorted(ultimo)]


def _fonte_ev(orgao, conjunto, url, vintages):
    """Bloco `fonte` da evidência a partir das vintages usadas (a mais recente no topo)."""
    vs = [v for v in vintages if v]
    topo = max(vs, key=lambda v: v["capturado_em"]) if vs else None
    f = evid.fonte_de_vintage(orgao, conjunto, url, topo)
    if len(vs) > 1:
        f["arquivos"] = [evid.arquivo_de_vintage(v) for v in sorted(vs, key=lambda v: v["recurso"])]
    return f


def _snap(con, *datasets):
    """Snapshot composto de vários datasets: sha256 dos snapshots, captura mais recente."""
    import hashlib
    snaps = [c.snapshot_de(con, d) for d in datasets]
    validos = [s for s in snaps if s.get("sha256")]
    if not validos:
        return {"id": None, "sha256": None, "capturas": []}
    h = hashlib.sha256("".join(s["sha256"] for s in validos).encode()).hexdigest()
    caps = [cp for s in validos for cp in s.get("capturas", [])]
    rev_total = sum((s.get("revisoes") or {}).get("total", 0) for s in validos)
    exemplos = [e for s in validos for e in ((s.get("revisoes") or {}).get("exemplos") or [])][:20]
    return {"id": f"{'+'.join(datasets)}@{max(cp['capturado_em'] for cp in caps)}", "sha256": h, "capturas": caps,
            "revisoes": {"detectado_em": base.agora_utc(), "total": rev_total, "exemplos": exemplos},
            "publicacao_confiavel": True}


CLASSE_ACR = "Distribuidor"
CLASSE_VAREJISTA = "Varejista"
# Resíduo da identidade Σ classes = ACR + ACL (+ Varejista a partir de fevereiro de 2026): as
# duas tabelas são publicadas pela CCEE com três casas e o resíduo observado de 2023 a 2026
# ficou entre 0 e 3,97 MW médios (até 0,006% do consumo do mês), sem explicação da fonte.
# Acima de 5 MW médios a identidade vira ressalva e o mês é conferido no arquivo.
TOL_IDENTIDADE_CLASSES_MWMED = 5.0


def ccee_consumo(amb, cls):
    """Consumo contabilizado da CCEE por ambiente, mês a mês.

    ACR = classe Distribuidor e ACL = soma das demais classes do conjunto CONSUMO_CLASSE_AGENTE
    (centro de gravidade). É a definição que fecha com CONSUMO_MENSAL_AMBIENTE_COMERCIALIZACAO
    até janeiro de 2026; em fevereiro de 2026 a CCEE trocou a classe Comercializador pela
    Varejista e o conjunto de ambiente deixou de contar o consumo da Varejista no ACL (a
    diferença entre os dois conjuntos passou a ser, mês a mês, o consumo dessa classe). Contar
    pelas classes mantém a série comparável; o valor publicado no conjunto de ambiente segue
    ao lado. Mês sem classes cai no conjunto de ambiente (origem registrada).

    Retorna (linhas, identidade, classes_mes)."""
    acr_p, acl_p = _serie(amb, "CONSUMO_TOTAL_ACR"), _serie(amb, "CONSUMO_TOTAL_ACL")
    classes_mes = {}
    for (s_, mes), v in cls.items():
        classe, col = s_.split("|")
        classes_mes.setdefault(mes, {}).setdefault(classe, {})[col] = v
    linhas, ident = [], []
    for mes in sorted(set(classes_mes) | (set(acr_p) & set(acl_p))):
        cons = {k: d.get("CONSUMO") for k, d in (classes_mes.get(mes) or {}).items()}
        tem_pub = mes in acr_p and mes in acl_p
        if cons and CLASSE_ACR in cons and all(v is not None for v in cons.values()):
            acr = cons[CLASSE_ACR]
            acl = sum(v for k, v in cons.items() if k != CLASSE_ACR)
            origem = "classes"
        elif tem_pub:
            acr, acl, origem = acr_p[mes], acl_p[mes], "ambiente"
        else:
            continue
        var = cons.get(CLASSE_VAREJISTA)
        h = horas_no_mes(mes)
        linhas.append({"mes": mes, "acr_mwmed": c.r(acr, 1), "acl_mwmed": c.r(acl, 1), "total_mwmed": c.r(acr + acl, 1),
                       "acl_pct": c.r(_pct(acl, acr + acl), 2), "origem": origem,
                       "acr_publicado_mwmed": c.r(acr_p.get(mes), 1), "acl_publicado_mwmed": c.r(acl_p.get(mes), 1),
                       "varejista_mwmed": c.r(var, 1), "horas": h, "acr_mwh": c.r(acr * h, 0), "acl_mwh": c.r(acl * h, 0),
                       "_acr": acr, "_acl": acl})
        if cons and tem_pub and all(v is not None for v in cons.values()):
            soma = sum(cons.values())
            dif = soma - acr_p[mes] - acl_p[mes]
            resid = dif - (var or 0.0)
            ident.append({"mes": mes, "soma_classes_mwmed": c.r(soma, 3), "acr_mais_acl_mwmed": c.r(acr_p[mes] + acl_p[mes], 3),
                          "diferenca_mwmed": c.r(dif, 3), "varejista_mwmed": c.r(var, 3), "residuo_mwmed": c.r(resid, 3),
                          "ok": abs(resid) <= TOL_IDENTIDADE_CLASSES_MWMED})
    return linhas, ident, classes_mes


def secao_livre_regulado(con, hoje, ev):
    obs = _vigentes(con, DS_EPE)
    plan = _vigentes(con, DS_EPE_PLAN)
    regs_plan = base.registros_como_estavam_em(con, DS_EPE_PLAN).get("__arquivo__", {})
    prelim = set((regs_plan.get("anos_preliminares") or "").split(";")) - {""}
    versao_epe = (base.registros_como_estavam_em(con, DS_EPE).get("__arquivo__", {}) or {}).get("versao_dados")
    agg = consumo_epe(obs)
    nac = nacional_mensal(agg, prelim)
    if not nac:
        raise RuntimeError("EPE sem observações no silver")
    ultimo = nac[-1]["mes"]
    tipos = {t: agg["nac"].get((t, "mwh"), {}) for t in ("cativo", "livre")}
    anos = anual(tipos)
    j12 = janela_12m(tipos, ultimo)
    j12_ant = janela_12m(tipos, _mes_mais(ultimo, -12))

    def anual_por(grupo, dims_validas):
        out = []
        for dim in dims_validas:
            series = {t: agg[grupo].get(((dim, t), "mwh"), {}) for t in ("cativo", "livre")}
            for ano, a in sorted(anual(series).items()):
                out.append({"ano": ano, "chave": dim, "cativo_mwh": c.r(a["cativo_mwh"], 1), "livre_mwh": c.r(a["livre_mwh"], 1),
                            "livre_pct": c.r(a["livre_pct"], 2), "meses": a["meses"], "completo": a["completo"]})
        return out

    def janela_por(grupo, dims_validas, mes_fim):
        out = []
        for dim in dims_validas:
            series = {t: agg[grupo].get(((dim, t), "mwh"), {}) for t in ("cativo", "livre")}
            j = janela_12m(series, mes_fim)
            ucs = agg[grupo].get(((dim, "livre"), "uc"), {}).get(mes_fim)
            out.append({"chave": dim, "cativo_mwh": c.r(j and j["cativo_mwh"], 1), "livre_mwh": c.r(j and j["livre_mwh"], 1),
                        "livre_pct": c.r(j and j["livre_pct"], 2), "livre_uc": ucs})
        return out

    meses_uf = sorted({m for (_, s) in agg["uf"].items() for m in s})
    ultimo_uf = meses_uf[-1] if meses_uf else None
    ufs_anual = []
    for uf in em.UFS:
        series = {t: agg["uf"].get(((uf, t), "mwh"), {}) for t in ("cativo", "livre")}
        for ano, a in sorted(anual(series).items()):
            if a["completo"]:
                ufs_anual.append({"uf": uf, "ano": ano, "livre_pct": c.r(a["livre_pct"], 2), "total_mwh": c.r(a["total_mwh"], 0)})

    # ---------------- CCEE (universo da contabilização do MCP)
    amb = _ccee(con, "consumo_mensal_ambiente_comercializacao")
    cls = _ccee(con, "consumo_classe_agente")
    ccee_mensal, ident_classes, classes_mes = ccee_consumo(amb, cls)
    ult_ccee = ccee_mensal[-1]["mes"] if ccee_mensal else None
    ccee_classes = []
    if ult_ccee:
        for classe, d in sorted(classes_mes.get(ult_ccee, {}).items()):
            ccee_classes.append({"classe": classe, "consumo_cg_mwmed": c.r(d.get("CONSUMO"), 1),
                                 "ponto_conexao_acr_mwmed": c.r(d.get("CONSUMO_PONTO_CONEXAO_CLASSE_ACR"), 1),
                                 "ponto_conexao_acl_mwmed": c.r(d.get("CONSUMO_PONTO_CONEXAO_CLASSE_ACL"), 1)})
    por_ccee = {x["mes"]: x for x in ccee_mensal}
    j12_ccee = None
    if ult_ccee and all(m in por_ccee for m in _janela(ult_ccee)):
        meses = _janela(ult_ccee)
        acl_mwh = sum(por_ccee[m]["_acl"] * horas_no_mes(m) for m in meses)
        tot_mwh = sum((por_ccee[m]["_acl"] + por_ccee[m]["_acr"]) * horas_no_mes(m) for m in meses)
        j12_ccee = {"inicio": meses[0], "fim": meses[-1], "acl_mwh": acl_mwh, "total_mwh": tot_mwh, "acl_pct": _pct(acl_mwh, tot_mwh),
                    "meses_classes": sum(1 for m in meses if por_ccee[m]["origem"] == "classes")}
    for x in ccee_mensal:
        x.pop("_acl"), x.pop("_acr")

    # ---------------- SAMP (distribuidoras)
    samp = secao_samp(con, agg)

    # ---------------- reconciliações
    rec_plan = reconcilia_planilha(nac, plan)
    obs_mme = _vigentes(con, DS_MME)
    rec_mme = reconcilia_mme(obs_mme, agg)
    carga = carga_contexto(obs_mme, agg)
    comparacao = []
    epe_por_mes = {l["mes"]: l for l in nac}
    samp_por_mes = {l["mes"]: l for l in samp["nacional_mensal"]}
    for l in ccee_mensal:
        e = epe_por_mes.get(l["mes"], {})
        s_ = samp_por_mes.get(l["mes"], {})
        comparacao.append({"mes": l["mes"], "ccee_acl_mwh": l["acl_mwh"], "ccee_acl_pct": l["acl_pct"],
                           "epe_livre_mwh": c.r(e.get("livre_mwh"), 0), "epe_livre_pct": c.r(e.get("livre_pct"), 2),
                           "samp_livre_mwh": c.r(s_.get("livre_mwh"), 0),
                           "epe_sobre_ccee_pct": c.r(_pct(e.get("livre_mwh"), l["acl_mwh"]), 2)})

    # ---------------- números de destaque com evidência
    v_epe = _vintage(con, DS_EPE, RECURSO_EPE_DA)
    v_plan = _vintage(con, DS_EPE_PLAN, RECURSO_EPE_PLAN)
    kpis = {}
    if j12:
        teste_plan = evid.teste("Tabela longa da EPE = total nacional da planilha formatada da EPE, mês a mês", rec_plan["resultado"],
                                f"{rec_plan['comparacoes']} comparações, {rec_plan['falhas']} acima da tolerância; maior diferença {rec_plan['maior_diferenca']}")
        mme_12 = [x for x in rec_mme if x["ambiente"] == "ACL" and x["medida"] == "acumulado_12_meses"]
        rec = None
        if mme_12:
            x = mme_12[-1]
            rec = evid.reconciliacao(
                f"Soma de 12 meses do ACL até {x['mes']} no Boletim Mensal do MME (edição {x['edicao']}): {_br(x['mme_gwh'], 0)} GWh; EPE: {_br(x['epe_gwh'], 1)} GWh",
                x["resultado"] or "ressalva", "1 GWh (o boletim publica GWh inteiros)")
        kpis["participacao_livre_12m"] = {
            "valor_pct": c.r(j12["livre_pct"], 2), "anterior_pct": c.r(j12_ant and j12_ant["livre_pct"], 2),
            "periodo": {"inicio": j12["inicio"], "fim": j12["fim"]},
            "evidencia": ev(
                indicador="Participação do mercado livre no consumo de energia elétrica na rede (12 meses)",
                valor_exibido=f"{_br(j12['livre_pct'], 1)}%", valor_calculo=j12["livre_pct"], unidade="%",
                periodo={"inicio": j12["inicio"], "fim": j12["fim"]}, entidade="Brasil (SIN e sistemas isolados)",
                universo="consumo de energia elétrica na rede informado pelos agentes ao SAM e consolidado pela EPE (cativo + livre)",
                fonte=_fonte_ev("EPE", "Consumo mensal de energia elétrica (dados abertos)", URL_EPE_PAGINA, [v_epe]),
                consulta=f"séries c|<região>|<subsistema>|<classe>|livre e |cativo de {DS_EPE}, meses {j12['inicio']} a {j12['fim']}",
                formula="100 × Σ consumo livre ÷ Σ (consumo cativo + consumo livre) dos 12 meses",
                numerador={"descricao": "consumo livre em 12 meses (MWh)", "valor": c.r(j12["livre_mwh"], 3)},
                denominador={"descricao": "consumo total em 12 meses (MWh)", "valor": c.r(j12["total_mwh"], 3)},
                cobertura="todas as regiões, subsistemas e classes publicadas pela EPE; 12 meses completos",
                tratamento_ausencia="mês sem cativo ou sem livre interrompe a janela (sem preenchimento)",
                testes=[teste_plan], reconciliacao=rec,
                download=[{"rotulo": "Série nacional mensal (CSV)", "url": _url(CSV_NACIONAL)},
                          {"rotulo": "Consumo por região, subsistema e classe (CSV)", "url": _url(CSV_CONSUMO)}],
                revisoes=c.revisoes_do_dataset(con, DS_EPE))}
        kpis["consumo_livre_12m"] = {"valor_mwh": c.r(j12["livre_mwh"], 1), "total_mwh": c.r(j12["total_mwh"], 1),
                                    "periodo": {"inicio": j12["inicio"], "fim": j12["fim"]}}
    if j12_ccee:
        vs_amb = _vintages_ccee(con, "consumo_classe_agente") + _vintages_ccee(con, "consumo_mensal_ambiente_comercializacao")
        im = [x for x in reconcilia_infomercado(con) if x["medida"] == "consumo_mwmed"]
        partes = []
        pre = [x for x in ident_classes if not x["varejista_mwmed"]]
        pos = [x for x in ident_classes if x["varejista_mwmed"]]
        if pre:
            partes.append(f"Até {pre[-1]['mes']}, Σ das classes = ACR + ACL do conjunto CONSUMO_MENSAL_AMBIENTE_COMERCIALIZACAO "
                          f"(maior resíduo {_br(max(abs(x['residuo_mwmed']) for x in pre), 2)} MW médio)")
        if pos:
            partes.append(f"de {pos[0]['mes']} em diante o conjunto de ambiente deixou de contar a classe Varejista no ACL e a diferença "
                          f"entre os conjuntos é o consumo dessa classe (maior resíduo {_br(max(abs(x['residuo_mwmed']) for x in pos), 2)} MW médio)")
        for x in im:
            partes.append(f"InfoMercado Nº {x['numero']} ({x['mes']}): 'Consumo/Geração' {_br(x['publicado'], 0)} MW médios; soma das classes: {_br(x['calculado'], 0)} MW médios (definição do InfoMercado não detalhada)")
        rec = evid.reconciliacao("; ".join(partes), "aprovado" if ident_classes and all(x["ok"] for x in ident_classes) else "ressalva",
                                 f"{_br(TOL_IDENTIDADE_CLASSES_MWMED, 0)} MW médios por mês na identidade entre os conjuntos; 0,5 MW médio no InfoMercado") if partes else None
        kpis["participacao_acl_ccee_12m"] = {
            "valor_pct": c.r(j12_ccee["acl_pct"], 2), "periodo": {"inicio": j12_ccee["inicio"], "fim": j12_ccee["fim"]},
            "evidencia": ev(
                indicador="Participação do ACL no consumo contabilizado pela CCEE (12 meses)",
                valor_exibido=f"{_br(j12_ccee['acl_pct'], 1)}%", valor_calculo=j12_ccee["acl_pct"], unidade="%",
                periodo={"inicio": j12_ccee["inicio"], "fim": j12_ccee["fim"]}, entidade="SIN",
                universo="consumo dos perfis de agente usado na contabilização do mercado de curto prazo (centro de gravidade), ACR + ACL",
                fonte=_fonte_ev("CCEE", "CONSUMO_CLASSE_AGENTE (conferido com CONSUMO_MENSAL_AMBIENTE_COMERCIALIZACAO)",
                                f"{cm.PORTAL}/dataset/consumo_classe_agente", vs_amb),
                consulta="CONSUMO por CLASSE_AGENTE (MWmed) dos 12 meses: ACR = Distribuidor; ACL = demais classes",
                formula="100 × Σ(ACL_m × horas_m) ÷ Σ((ACR_m + ACL_m) × horas_m), com ACR = classe Distribuidor e ACL = soma das demais classes",
                numerador={"descricao": "consumo ACL em 12 meses (MWh)", "valor": c.r(j12_ccee["acl_mwh"], 3)},
                denominador={"descricao": "consumo ACR + ACL em 12 meses (MWh)", "valor": c.r(j12_ccee["total_mwh"], 3)},
                pesos="horas de cada mês (MWmed × horas = MWh)",
                cobertura=f"SIN; {j12_ccee['meses_classes']} dos 12 meses pelas classes de agente",
                tratamento_ausencia="janela só é calculada com os 12 meses publicados; mês sem classes usa o conjunto de ambiente",
                testes=[evid.teste("Σ das classes = ACR + ACL publicado (+ Varejista a partir de fevereiro de 2026)",
                                   "aprovado" if ident_classes and all(x["ok"] for x in ident_classes) else "ressalva",
                                   f"{len(ident_classes)} meses; maior resíduo {_br(max((abs(x['residuo_mwmed']) for x in ident_classes), default=0.0), 2)} MW médio")],
                reconciliacao=rec,
                download=[{"rotulo": "Séries mensais da CCEE (CSV)", "url": _url(CSV_CCEE)}],
                revisoes=c.revisoes_do_dataset(con, cm.dataset("consumo_classe_agente")))}
    return {
        "universos": [
            {"id": "epe", "titulo": "Consumo na rede (EPE)", "descricao": "Energia consumida pelas unidades consumidoras e faturada ou medida na rede, informada mensalmente pelos agentes ao SAM e consolidada pela EPE; separa cativo (compra da distribuidora) e livre (compra no ACL). Não inclui autoprodução sem uso da rede nem perdas.", "unidade": "MWh", "desde": nac[0]["mes"], "ate": ultimo},
            {"id": "ccee", "titulo": "Consumo contabilizado (CCEE)", "descricao": "Consumo dos perfis de agente usado na contabilização do mercado de curto prazo, referido ao centro de gravidade do submercado (com as perdas da rede básica rateadas), separado em ACR e ACL.", "unidade": "MWmed", "desde": ccee_mensal[0]["mes"] if ccee_mensal else None, "ate": ult_ccee},
            {"id": "samp", "titulo": "Mercado faturado pelas distribuidoras (ANEEL, SAMP)", "descricao": "Energia faturada por cada distribuidora na sua área: TE do cativo e TUSD do livre ligado à rede de distribuição. Consumidor livre ligado diretamente à rede básica não é faturado por distribuidora e fica fora.", "unidade": "MWh", "desde": samp["nacional_mensal"][0]["mes"] if samp["nacional_mensal"] else None, "ate": samp["nacional_mensal"][-1]["mes"] if samp["nacional_mensal"] else None},
        ],
        "kpis": kpis,
        "epe_versao_dados": versao_epe, "epe_anos_preliminares": sorted(prelim), "epe_ultimo_mes": ultimo, "epe_ultimo_mes_uf": ultimo_uf,
        "epe_mensal": [{**l, "cativo_mwh": c.r(l["cativo_mwh"], 1), "livre_mwh": c.r(l["livre_mwh"], 1), "total_mwh": c.r(l["total_mwh"], 1),
                        "livre_pct": c.r(l["livre_pct"], 2)} for l in nac],
        "epe_anual": [{"ano": a, "cativo_mwh": c.r(d["cativo_mwh"], 1), "livre_mwh": c.r(d["livre_mwh"], 1), "total_mwh": c.r(d["total_mwh"], 1),
                       "livre_pct": c.r(d["livre_pct"], 2), "meses": d["meses"], "completo": d["completo"], "preliminar": a in prelim}
                      for a, d in sorted(anos.items())],
        "epe_classe_anual": anual_por("classe", em.CLASSES),
        "epe_subsistema_12m": janela_por("sistema", ("SE", "S", "NE", "N", "ISOL"), ultimo),
        "epe_regiao_12m": janela_por("regiao", em.REGIOES, ultimo),
        "epe_uf_12m": janela_por("uf", em.UFS, ultimo_uf) if ultimo_uf else [],
        "epe_uf_anual": ufs_anual,
        "ccee_mensal": ccee_mensal, "ccee_classes_ultimo_mes": {"mes": ult_ccee, "linhas": ccee_classes},
        "ccee_identidade_classes": [{k: x[k] for k in ("mes", "diferenca_mwmed", "varejista_mwmed", "residuo_mwmed", "ok")} for x in ident_classes],
        "comparacao_universos": comparacao,
        "carga_contexto": carga,
        "reconciliacao": {"epe_planilha": rec_plan, "mme": rec_mme},
        "samp": samp,
        "_agg": agg, "_nac": nac,
    }


# Componente do total de encargos do InfoMercado → colunas do conjunto ENCARGO_ESS_ANCILAR.
COMPONENTE_PARA_CCEE = {
    "restricao_operacao": ("ENCARGO_CONST_ON", "ENCARGO_CONST_OFF", "ENCARGO_REST_OP_UNIT_COMT"),
    "servicos_ancilares": ("ENCARGO_CS", "OUTROS_SERVICOS_ANCILARES"), "suporte_reativo": ("ENCARGO_CS",),
    "importacao": ("ENCARGO_IMPORTACAO",), "deslocamento_hidraulico": ("RECEBIMENTO_ENCARGO_DH",),
    "seguranca_energetica": ("ENCARGO_SEG_ENER",), "reserva_operativa": ("RECEBIMENTO_ENCARGO_RESERVA_OP",),
}


def reconcilia_infomercado(con):
    """Números do InfoMercado mensal da CCEE (publicação oficial, PDF) × os mesmos números
    calculados a partir dos conjuntos abertos, por outro caminho (outro arquivo, outro código).
    Tolerâncias pela precisão publicada no PDF.

    Encargos: o total do InfoMercado inclui parcelas que não são colunas do conjunto
    ENCARGO_ESS_ANCILAR (resposta da demanda; em 2026, suporte de reativo do sandbox); por isso
    a conferência é por componente e do total sem essas parcelas. O pagamento (total menos o
    alívio) é conferido com o conjunto ENCARGO_PGTO_MENSAL."""
    im = _vigentes(con, cm.DS_INFOMERCADO)
    regs = base.registros_como_estavam_em(con, cm.DS_INFOMERCADO)
    ger = _ccee(con, "geracao_submercado")
    mre = _ccee(con, "mre_mensal")
    qtd = _ccee(con, "agente_qtd_contabilizacao")
    cls = _ccee(con, "consumo_classe_agente")
    ess = _ccee(con, "encargo_ess_ancilar")
    liq = _ccee(con, "sumario_mensal_liquidacao")
    pgt = _ccee(con, "encargo_pgto_mensal")
    pub_de = {}
    for (s, mes), v in im.items():
        _, numero, medida = s.split("|")
        pub_de[(numero, medida)] = (mes, v)

    def ess_m(mes, cols):
        vals = [ess.get((col, mes)) for col in cols]
        return None if any(v is None for v in vals) else sum(vals) / 1e6

    out = []
    for numero in sorted({n for n, _ in pub_de}):
        ed = regs.get(f"edicao|{numero}") or {}
        g = lambda medida: pub_de.get((numero, medida), (None, None))[1]  # noqa: E731
        mes = next(m for (n, _), (m, _v) in pub_de.items() if n == numero)
        linhas = []
        ger_mre = [v for (ss, r), v in ger.items() if r == mes and ss.endswith("|GERACAO_MRE")]
        g_soma = sum(ger_mre) if len(ger_mre) == 4 else None
        gf2 = mre.get(("GARANTIA_FISICA_MODULADA_FDISP", mes))
        linhas.append(("gsf_pct", g("gsf_pct"), _pct(g_soma, gf2) if g_soma is not None and gf2 else None,
                       0.006, "0,006 p.p. (o InfoMercado publica duas casas decimais)", None))
        linhas.append(("geracao_mre_mwmed", g("geracao_mre_mwmed"), g_soma, 0.5,
                       "0,5 MW médio (o InfoMercado publica MW médios inteiros)", None))
        n_ag = [v for (ss, r), v in qtd.items() if r == mes]
        linhas.append(("agentes_contabilizados", g("agentes_contabilizados"), sum(n_ag) if n_ag else None, 0.0, "0 agente",
                       "O conjunto aberto é a versão vigente da contabilização; o InfoMercado é a publicação do mês e pode não refletir recontabilizações posteriores."))
        cons = [v for (ss, r), v in cls.items() if r == mes and ss.endswith("|CONSUMO")]
        linhas.append(("consumo_mwmed", g("consumo_mwmed"), sum(cons) if cons else None, 0.5,
                       "0,5 MW médio (MW médios inteiros)",
                       "O InfoMercado chama o número de 'Consumo/Geração' (referido ao centro de gravidade); calculado = soma das classes de agente de CONSUMO_CLASSE_AGENTE (ACR + ACL). A diferença, de cerca de 0,1% a 0,2%, não é explicada pela fonte."))
        for comp, cols in COMPONENTE_PARA_CCEE.items():
            medida = f"encargos_{comp}_milhoes_rs"
            n = int(ed.get(f"parcelas|{medida}") or 1)
            linhas.append((medida, g(medida), ess_m(mes, cols), 0.005 * n,
                           f"R$ {_br(0.005 * n, 3)} milhão ({n} {'parcela publicada' if n == 1 else 'parcelas publicadas'} com duas casas decimais em milhões)",
                           None if n == 1 else f"Soma de {n} parcelas do texto do InfoMercado (por exemplo, deslocamento hidráulico de perfis de geração e de consumo)."))
        rd_c = rd_mensal_de(_ccee(con, "rd_encargos_contab_mensal")).get(mes)
        linhas.append(("encargos_resposta_demanda_milhoes_rs", g("encargos_resposta_demanda_milhoes_rs"),
                       None if rd_c is None else rd_c[0] / 1e6, 0.005, "R$ 0,005 milhão (duas casas decimais em milhões)",
                       "Calculado = soma dos submercados com valor no conjunto RD_ENCARGOS_CONTAB_MENSAL; mês ausente do arquivo fica sem valor."))
        tot = g("encargos_total_detalhe_milhoes_rs")
        fora = [g(f"encargos_{k}_milhoes_rs") for k in cm.COMPONENTES_FORA_DO_CONJUNTO if g(f"encargos_{k}_milhoes_rs") is not None]
        desconhecidos = json.loads(ed.get("rotulos_desconhecidos") or "[]")
        linhas.append(("encargos_do_conjunto_milhoes_rs", None if tot is None or desconhecidos else tot - sum(fora),
                       ess_m(mes, TIPOS_ESS), 0.06,
                       "R$ 0,06 milhão (diferença de números publicados com uma ou duas casas decimais em milhões)",
                       "Publicado = total de encargos menos as parcelas que não são colunas do conjunto ENCARGO_ESS_ANCILAR (resposta da demanda, suporte de reativo do sandbox), todas do próprio InfoMercado; calculado = soma dos nove tipos do conjunto (sem as colunas de ressarcimento, que detalham os outros serviços ancilares)."))
        alv = g("alivio_ess_milhoes_rs")
        p_ess, p_se = pgt.get(("PAGAMENTO_ENCARGO_ESS", mes)), pgt.get(("PAGAMENTO_ENCARGO_SE", mes))
        linhas.append(("pagamento_ess_milhoes_rs", None if tot is None or alv is None else tot - alv,
                       None if p_ess is None or p_se is None else (p_ess + p_se) / 1e6, 0.06,
                       "R$ 0,06 milhão (diferença de dois números publicados com uma ou duas casas decimais em milhões)",
                       "Publicado = total de encargos menos o alívio, ambos do InfoMercado; calculado = PAGAMENTO_ENCARGO_ESS + PAGAMENTO_ENCARGO_SE do conjunto ENCARGO_PGTO_MENSAL (pagamento, não competência)."))
        v = liq.get(("VALOR_TOTAL_LIQ_PRE", mes))
        linhas.append(("liquidar_bilhoes_rs", g("liquidar_bilhoes_rs"), v / 1e9 if v is not None else None, 0.005,
                       "R$ 0,005 bilhão (duas casas decimais em bilhões)", None))
        for medida, pub, calc, tol, txt_tol, nota in linhas:
            if pub is None:
                continue
            dif = None if calc is None else calc - pub
            out.append({"numero": numero, "mes": mes, "medida": medida, "publicado": c.r(pub, 4), "calculado": c.r(calc, 4),
                        "diferenca": c.r(dif, 4), "tolerancia": txt_tol, "nota": nota,
                        "recurso": ed.get("recurso"), "url": ed.get("url"),
                        "pagina": ed.get(f"pagina|{medida}") or ed.get("pagina|encargos_total_detalhe_milhoes_rs"),
                        "resultado": "ressalva" if dif is None else ("aprovado" if abs(dif) <= tol + 1e-9 else "ressalva")})
    return out


def secao_samp(con, agg_epe):
    """Mercado livre e cativo faturado por distribuidora (SAMP)."""
    obs = _vigentes(con, DS_SAMP)
    cad = {k.split("|", 1)[1]: v for k, v in base.registros_como_estavam_em(con, DS_SAMP).items() if k.startswith("agente|")}
    por = {}
    for (serie, mes), val in obs.items():
        cn, medida = serie.split("|", 1)
        por.setdefault((cn, mes), {})[medida] = val
    meses = sorted({m for (_, m) in por})
    nacional = []
    for mes in meses:
        linhas = [d for (cn, m), d in por.items() if m == mes]
        soma = lambda k: _soma(*[d.get(k) for d in linhas])  # noqa: E731
        nacional.append({"mes": mes, "distribuidoras": len(linhas), "livre_mwh": soma("livre_mwh"), "livre_uc": soma("livre_uc"),
                         "livre_uc_incentivada": soma("livre_uc_incentivada"), "livre_uc_convencional": soma("livre_uc_convencional"),
                         "livre_uc_autoproducao": soma("livre_uc_autoproducao"), "livre_uc_erc": soma("livre_uc_erc"),
                         "livre_uc_outro": soma("livre_uc_outro"), "livre_mwh_incentivada": soma("livre_mwh_incentivada"),
                         "livre_mwh_convencional": soma("livre_mwh_convencional"), "livre_mwh_autoproducao": soma("livre_mwh_autoproducao"),
                         "cativo_mwh": soma("cativo_mwh"), "cativo_uc": soma("cativo_uc"), "livre_mwh_refat": soma("livre_mwh_refat")})
    # mês publicado por quase todas: só ele entra em comparação com a EPE e no destaque
    ref_n = sorted(x["distribuidoras"] for x in nacional[-13:-1]) if len(nacional) > 1 else []
    mediana = ref_n[len(ref_n) // 2] if ref_n else None
    for x in nacional:
        x["completo"] = mediana is not None and x["distribuidoras"] >= 0.95 * mediana
        e_uc = agg_epe["nac"].get(("livre", "uc"), {}).get(x["mes"])
        x["epe_livre_uc"] = e_uc
        x["samp_sobre_epe_uc_pct"] = c.r(_pct(x["livre_uc"], e_uc), 2)
    # ano de referência: último ano civil com os 12 meses completos
    anos_completos = sorted({x["mes"][:4] for x in nacional if x["completo"]})
    ano_ref = next((a for a in reversed(anos_completos)
                    if sum(1 for x in nacional if x["mes"][:4] == a and x["completo"]) == 12), None)
    distrib = []
    if ano_ref:
        meses_ano = [f"{ano_ref}-{i:02d}" for i in range(1, 13)]
        dez, dez_ant = f"{ano_ref}-12", f"{int(ano_ref) - 1}-12"
        for cn in sorted({cn for (cn, m) in por if m.startswith(ano_ref)}):
            ds = [por.get((cn, m)) for m in meses_ano]
            n = sum(1 for d in ds if d)
            liv = _soma(*[d.get("livre_mwh") for d in ds if d])
            cat = _soma(*[d.get("cativo_mwh") for d in ds if d])
            fim, ini = por.get((cn, dez)) or {}, por.get((cn, dez_ant)) or {}
            distrib.append({
                "cnpj": cn, "sigla": (cad.get(cn) or {}).get("sigla"), "nome": (cad.get(cn) or {}).get("nome"),
                "meses": n, "livre_mwh": c.r(liv, 1), "cativo_mwh": c.r(cat, 1),
                "livre_pct_faturada": c.r(_pct(liv, _soma(liv, cat)) if n == 12 else None, 2),
                "livre_uc_dez": fim.get("livre_uc"), "livre_uc_dez_anterior": ini.get("livre_uc"),
                "variacao_livre_uc": (fim["livre_uc"] - ini["livre_uc"]) if fim.get("livre_uc") is not None and ini.get("livre_uc") is not None else None,
                "livre_uc_incentivada_dez": fim.get("livre_uc_incentivada"), "livre_uc_convencional_dez": fim.get("livre_uc_convencional"),
                "livre_uc_autoproducao_dez": fim.get("livre_uc_autoproducao"), "cativo_uc_dez": fim.get("cativo_uc"),
                "completo": n == 12})
        distrib.sort(key=lambda x: -(x["livre_mwh"] or 0))
    return {"nacional_mensal": nacional, "ano_referencia": ano_ref, "distribuidoras": distrib, "_por": por, "_cad": cad}


# ======================================================================= P033: agentes e migração

def fluxos_cnpj(meses_por_cnpj, classe_por_cnpj=None):
    """Entradas e saídas mês a mês a partir dos meses em que cada CNPJ aparece na lista de
    associados. Entrada no mês m: presente em m e ausente em m−1; saída: presente em m−1 e ausente
    em m. O primeiro mês da série não tem fluxo (não há mês anterior para comparar)."""
    meses = sorted({m for ms in meses_por_cnpj.values() for m in ms})
    presentes = {m: set() for m in meses}
    for cn, ms in meses_por_cnpj.items():
        for m in ms:
            presentes[m].add(cn)
    out = []
    for i, m in enumerate(meses):
        linha = {"mes": m, "estoque": len(presentes[m]), "entradas": None, "saidas": None, "por_classe": {}}
        if i > 0 and meses[i - 1] == _mes_mais(m, -1):
            ant = presentes[meses[i - 1]]
            ent, sai = presentes[m] - ant, ant - presentes[m]
            linha["entradas"], linha["saidas"] = len(ent), len(sai)
            if classe_por_cnpj:
                for grupo, nome in ((ent, "entradas"), (sai, "saidas")):
                    for cn in grupo:
                        k = classe_por_cnpj.get(cn) or "nao_informada"
                        linha["por_classe"].setdefault(k, {"entradas": 0, "saidas": 0})[nome] += 1
        out.append(linha)
    return out


def secao_agentes(con, livre, ev):
    agg = livre["_agg"]
    qtd = _ccee(con, "agente_qtd_contabilizacao")
    por_mes = {}
    for (s, mes), v in qtd.items():
        por_mes.setdefault(mes, {})[s.split("|")[0]] = v
    agentes_mensal = [{"mes": m, "total": sum(d.values()), "por_classe": {k: d[k] for k in sorted(d)}} for m, d in sorted(por_mes.items())]

    regs = base.registros_como_estavam_em(con, cm.dataset("lista_agente_associado"))
    meses_cnpj, classe_cnpj = {}, {}
    for ch, campos in regs.items():
        if not ch.startswith("cnpj|"):
            continue
        cn = ch.split("|", 1)[1]
        ms = set()
        for campo, val in campos.items():
            if campo.startswith("meses|") and val:
                ms |= set(val.split(";"))
        if ms:
            meses_cnpj[cn] = ms
            classe_cnpj[cn] = campos.get("classe")
    fluxos = fluxos_cnpj(meses_cnpj, classe_cnpj)

    perf = _ccee(con, "lista_perfil_v1")
    pos = max((r for (_, r) in perf), default=None)
    perfis = {"posicao": pos, "por_classe": [], "perfis_por_agente_ativo": {}, "agentes_ativos": None, "perfis_ativos": None}
    if pos:
        cl = {}
        for (s, r), v in perf.items():
            if r != pos:
                continue
            partes = s.split("|")
            if partes[0] in ("perfis", "agentes"):
                cl.setdefault(partes[1], {})[f"{partes[0]}_{partes[2].lower().replace(' ', '_')}"] = v
            elif partes[0] == "perfis_por_agente_ativo":
                perfis["perfis_por_agente_ativo"][partes[1]] = v
            elif s == "agentes_ativos_total":
                perfis["agentes_ativos"] = v
            elif s == "perfis_ativos_total":
                perfis["perfis_ativos"] = v
        perfis["por_classe"] = [{"classe": k, **d} for k, d in sorted(cl.items())]

    parc = _ccee(con, "parcela_carga_consumo")
    pm = {}
    for (s, mes), v in parc.items():
        pm.setdefault(mes, {})[s] = v
    parcelas_mensal = [{"mes": m, "parcelas": d.get("parcelas"), "perfis_com_parcela": d.get("perfis_com_parcela"),
                        "cnpj_carga": d.get("cnpj_carga"), "migracoes_no_mes": d.get("migracoes_no_mes"),
                        "consumo_acl_mwh": c.r(d.get("consumo_acl_mwh"), 1), "consumo_total_mwh": c.r(d.get("consumo_total_mwh"), 1),
                        "por_submercado": {k.split("|")[1]: v for k, v in d.items() if k.startswith("parcelas_sm|")}}
                       for m, d in sorted(pm.items())]
    ult_parc = parcelas_mensal[-1]["mes"] if parcelas_mensal else None
    parcelas_uf = sorted(({"uf": k.split("|")[1], "parcelas": v} for k, v in pm.get(ult_parc, {}).items() if k.startswith("parcelas_uf|")),
                         key=lambda x: -x["parcelas"])

    deslig = {}
    for nome in ("desligamento_voluntario", "desligamento_compulsorio"):
        for (s, mes), v in _ccee(con, nome).items():
            partes = s.split("|")
            if partes[0] == "desligamentos":
                k = (mes[:4], partes[1], partes[2])
                deslig[k] = deslig.get(k, 0) + v
    desl_anual = [{"ano": a, "tipo": t, "classe": cl, "desligamentos": n} for (a, t, cl), n in sorted(deslig.items())]

    ucs = agg["nac"].get(("livre", "uc"), {})
    ucs_cat = agg["nac"].get(("cativo", "uc"), {})
    ucs_mensal = []
    for m in sorted(ucs):
        ant = ucs.get(_mes_mais(m, -1))
        ucs_mensal.append({"mes": m, "livre_uc": ucs[m], "cativo_uc": ucs_cat.get(m),
                           "variacao_liquida": (ucs[m] - ant) if ant is not None else None})
    ult_uc = ucs_mensal[-1]["mes"] if ucs_mensal else None
    ucs_classe = [{"classe": cl, "livre_uc": agg["classe"].get(((cl, "livre"), "uc"), {}).get(ult_uc)} for cl in em.CLASSES]

    ag = base.registros_como_estavam_em(con, DS_AGENTES)
    gerado = (ag.get("__arquivo__") or {}).get("gerado_em")
    linhas_ag = [(ch.split("|", 1)[1], d) for ch, d in ag.items() if ch.startswith("cnpj|")]
    ativos = [d for _, d in linhas_ag if d.get("ativo") == "1"]
    agentes_aneel = {"gerado_em": gerado, "cadastrados": len(linhas_ag), "ativos": len(ativos),
                     "ativos_por_atividade": {at: sum(1 for d in ativos if d.get(at) == "1") for at in am.ATIVIDADES.values()},
                     "ativos_so_comercializacao": sum(1 for d in ativos if d.get("comercializacao") == "1"
                                                      and not any(d.get(o) == "1" for o in ("distribuicao", "geracao", "transmissao")))}

    kpis = {}
    if agentes_mensal:
        u = agentes_mensal[-1]
        vs = _vintages_ccee(con, "agente_qtd_contabilizacao")
        rec_im = [x for x in reconcilia_infomercado(con) if x["medida"] == "agentes_contabilizados"]
        rec = None
        if rec_im:
            x = rec_im[-1]
            rec = evid.reconciliacao(f"InfoMercado mensal Nº {x['numero']} ({x['mes']}): {_br(x['publicado'], 0)} agentes; conjunto aberto: {_br(x['calculado'], 0)}",
                                     x["resultado"], x["tolerancia"])
        kpis["agentes_contabilizados"] = {"valor": u["total"], "mes": u["mes"], "evidencia": ev(
            indicador="Agentes que participaram da contabilização da CCEE", valor_exibido=_br(u["total"], 0), valor_calculo=u["total"],
            unidade="agentes", periodo={"inicio": u["mes"], "fim": u["mes"]}, entidade="CCEE (SIN)",
            universo="agentes (pessoas jurídicas) com perfil contabilizado no mês, todas as classes",
            fonte=_fonte_ev("CCEE", "AGENTE_QTD_CONTABILIZACAO", f"{cm.PORTAL}/dataset/agente_qtd_contabilizacao", vs),
            chaves_origem=[f"{k}|QUANTIDADE_AGENTE_CONTABILIZACAO@{u['mes']}" for k in u["por_classe"]],
            formula="Σ QUANTIDADE_AGENTE_CONTABILIZACAO das classes no mês", cobertura=f"{len(u['por_classe'])} classes publicadas no mês",
            tratamento_ausencia="classe sem linha no mês não é somada (não vira zero)",
            testes=[evid.teste("Classes dentro do domínio do dicionário (com as não documentadas declaradas)", "aprovado",
                               ", ".join(sorted(u["por_classe"])))],
            reconciliacao=rec, download=[{"rotulo": "Séries mensais da CCEE (CSV)", "url": _url(CSV_CCEE)}],
            revisoes=c.revisoes_do_dataset(con, cm.dataset("agente_qtd_contabilizacao")))}
    if ult_uc:
        v_epe = _vintage(con, DS_EPE, RECURSO_EPE_DA)
        # último mês publicado por quase todas as distribuidoras no SAMP e presente na EPE
        sm = next((x for x in reversed(livre["samp"]["nacional_mensal"])
                   if x["completo"] and x["livre_uc"] is not None and ucs.get(x["mes"]) is not None), None)
        rec = None
        if sm:
            d = _pct(sm["livre_uc"], ucs[sm["mes"]])
            rec = evid.reconciliacao(
                f"Unidades livres faturadas pelas distribuidoras no SAMP (ANEEL) em {sm['mes']}, último mês publicado por quase todas: "
                f"{_br(sm['livre_uc'], 0)}, {_br(d, 1)}% das {_br(ucs[sm['mes']], 0)} da EPE no mesmo mês. Universos diferentes: o SAMP não tem o consumidor livre ligado direto à rede básica.",
                "aprovado" if abs(d - 100) <= 3 else "ressalva", "3% do número da EPE (universos diferentes, publicações independentes)")
        plan_uc = _vigentes(con, DS_EPE_PLAN).get(("plan|livre_uc", ult_uc))
        kpis["ucs_livres"] = {"valor": ucs[ult_uc], "mes": ult_uc,
                              "variacao_12m": (ucs[ult_uc] - ucs[_mes_mais(ult_uc, -12)]) if ucs.get(_mes_mais(ult_uc, -12)) is not None else None,
                              "evidencia": ev(
            indicador="Unidades consumidoras no mercado livre", valor_exibido=_br(ucs[ult_uc], 0), valor_calculo=ucs[ult_uc],
            unidade="unidades consumidoras", periodo={"inicio": ult_uc, "fim": ult_uc}, entidade="Brasil",
            universo="unidades consumidoras com consumo livre informado ao SAM (EPE); UC não é agente nem perfil",
            fonte=_fonte_ev("EPE", "Consumo mensal de energia elétrica (dados abertos)", URL_EPE_PAGINA, [v_epe]),
            consulta=f"séries n|<região>|<subsistema>|<classe>|livre de {DS_EPE}, mês {ult_uc}",
            formula="Σ Consumidores (TipoConsumidor = Livre) das regiões, subsistemas e classes", cobertura="todas as linhas publicadas no mês",
            tratamento_ausencia="linha sem número de consumidores não entra na soma",
            testes=[evid.teste("Soma = número de consumidores livres da planilha formatada da EPE", "aprovado" if plan_uc is not None and abs(plan_uc - ucs[ult_uc]) <= 1 else "ressalva",
                               f"planilha: {plan_uc}; soma: {ucs[ult_uc]}")],
            reconciliacao=rec, download=[{"rotulo": "Série nacional mensal (CSV)", "url": _url(CSV_NACIONAL)}],
            revisoes=c.revisoes_do_dataset(con, DS_EPE))}
    if parcelas_mensal:
        u = parcelas_mensal[-1]
        vs = _vintages_ccee(con, "parcela_carga_consumo")
        kpis["parcelas_carga"] = {"valor": u["parcelas"], "mes": u["mes"], "migracoes_no_mes": u["migracoes_no_mes"], "evidencia": ev(
            indicador="Parcelas de carga no ACL contabilizadas pela CCEE", valor_exibido=_br(u["parcelas"], 0), valor_calculo=u["parcelas"],
            unidade="parcelas de carga", periodo={"inicio": u["mes"], "fim": u["mes"]}, entidade="CCEE (SIN)",
            universo="parcelas de carga com consumo no mês (unidade de consumo modelada na CCEE, ligada a um perfil de agente)",
            fonte=_fonte_ev("CCEE", "PARCELA_CARGA_CONSUMO", f"{cm.PORTAL}/dataset/parcela_carga_consumo", vs),
            consulta=f"COD_PARCELA_CARGA distintos com MES_REFERENCIA = {u['mes'].replace('-', '')}",
            formula="contagem de COD_PARCELA_CARGA distintos no mês", cobertura="todas as linhas do mês no arquivo anual",
            tratamento_ausencia="linha sem código de parcela é contada à parte e não entra",
            testes=[evid.teste("Parcelas por submercado somam o total", "aprovado" if abs(sum(u["por_submercado"].values()) - u["parcelas"]) <= 0 else "ressalva",
                               f"{sum(u['por_submercado'].values())} na soma por submercado, {u['parcelas']} no total")],
            download=[{"rotulo": "Séries mensais da CCEE (CSV)", "url": _url(CSV_CCEE)}],
            revisoes=c.revisoes_do_dataset(con, cm.dataset("parcela_carga_consumo")))}
    return {"kpis": kpis, "agentes_por_classe_mensal": agentes_mensal, "associados_fluxos": fluxos,
            "perfis": perfis, "parcelas_mensal": parcelas_mensal, "parcelas_uf_ultimo_mes": {"mes": ult_parc, "linhas": parcelas_uf},
            "desligamentos_anual": desl_anual, "ucs_epe_mensal": ucs_mensal,
            "ucs_livres_por_classe_ultimo_mes": {"mes": ult_uc, "linhas": ucs_classe},
            "samp_ucs_livres_mensal": [{k: x[k] for k in ("mes", "distribuidoras", "completo", "livre_uc", "livre_uc_incentivada",
                                                            "livre_uc_convencional", "livre_uc_autoproducao", "livre_uc_erc",
                                                            "livre_uc_outro", "epe_livre_uc", "samp_sobre_epe_uc_pct")}
                                       for x in livre["samp"]["nacional_mensal"]],
            "agentes_aneel": agentes_aneel}


# ======================================================================= P034: MRE e GSF

def gsf_mensal(ger_obs, mre_obs, gf_sm_obs):
    """GSF (fator de ajuste do MRE) por mês = geração das usinas do MRE no centro de gravidade
    (soma dos submercados) ÷ garantia física modulada ajustada pelo fator de disponibilidade
    (GFIS_2, a garantia física depois do mecanismo de redução). É a razão que reproduz o fator
    publicado pela CCEE no InfoMercado (79,37% em agosto e 73,49% em outubro de 2024, 76,83% em
    julho de 2026)."""
    meses = sorted({r for (_, r) in ger_obs})
    out = []
    for m in meses:
        ger = [v for (s, r), v in ger_obs.items() if r == m and s.endswith("|GERACAO_MRE")]
        cota = [v for (s, r), v in ger_obs.items() if r == m and s.endswith("|GERACAO_MRE_COTA_GF")]
        g = sum(ger) if len(ger) == 4 else None
        gfis2 = mre_obs.get(("GARANTIA_FISICA_MODULADA_FDISP", m))
        gfsazo = mre_obs.get(("GARANTIA_FISICA_SAZONALIZADA_MRE", m))
        gf_sm = [v for (s, r), v in gf_sm_obs.items() if r == m]
        out.append({"mes": m, "submercados_geracao": len(ger), "geracao_mre_mwmed": c.r(g, 3),
                    "geracao_mre_cotas_mwmed": c.r(sum(cota), 3) if len(cota) == 4 else None,
                    "gf_sazonalizada_mwmed": c.r(gfsazo, 3), "gf_modulada_fdisp_mwmed": c.r(gfis2, 3),
                    "gf_sazonalizada_soma_submercados_mwmed": c.r(sum(gf_sm), 3) if len(gf_sm) == 4 else None,
                    "fator_disponibilidade_pct": c.r(mre_obs.get(("FATOR_DISPONIBILIDADE", m)), 4),
                    "fator_reducao_acumulado_pct": c.r(mre_obs.get(("FATOR_REDUCAO_ACUMULADO", m)), 4),
                    "teo_rs_mwh": c.r(mre_obs.get(("CUSTO_MRE", m)), 4), "valor_alocado_mre_rs": c.r(mre_obs.get(("VALOR_ALOCADO_MRE", m)), 2),
                    "gsf_pct": c.r(_pct(g, gfis2), 3) if g is not None and gfis2 else None, "horas": horas_no_mes(m)})
    return out


def gsf_agregado(linhas, meses):
    """GSF de um período = Σ(geração × horas) ÷ Σ(GFIS_2 × horas): energia sobre energia, nunca média de
    percentuais. None se faltar algum mês."""
    por = {x["mes"]: x for x in linhas}
    if any(m not in por or por[m]["geracao_mre_mwmed"] is None or por[m]["gf_modulada_fdisp_mwmed"] is None for m in meses):
        return None
    num = sum(por[m]["geracao_mre_mwmed"] * por[m]["horas"] for m in meses)
    den = sum(por[m]["gf_modulada_fdisp_mwmed"] * por[m]["horas"] for m in meses)
    return {"gsf_pct": _pct(num, den), "geracao_mwh": num, "gf_mwh": den, "inicio": meses[0], "fim": meses[-1]}


def conta_bandeira_nacional(obs):
    """Soma nacional por competência dos campos da Conta Bandeira (todas as linhas, inclusive sem CNPJ)."""
    por = {}
    dist = {}
    for (serie, mes), v in obs.items():
        cn, campo = serie.split("|", 1)
        if campo == "linhas":
            if cn != "sem_cnpj":
                dist.setdefault(mes, set()).add(cn)
            continue
        por.setdefault(mes, {})[campo] = por.get(mes, {}).get(campo, 0.0) + v
    return [{"mes": m, "distribuidoras": len(dist.get(m, ())), **{k: c.r(v, 2) for k, v in sorted(d.items())}}
            for m, d in sorted(por.items())]


def secao_mre(con, ev):
    ger, mre, gfsm = _ccee(con, "geracao_submercado"), _ccee(con, "mre_mensal"), _ccee(con, "garantia_fisica_sazo_mre_submercado")
    mensal = gsf_mensal(ger, mre, gfsm)
    validos = [x for x in mensal if x["gsf_pct"] is not None]
    anual = []
    for ano in sorted({x["mes"][:4] for x in validos}):
        ms = [x["mes"] for x in validos if x["mes"][:4] == ano]
        a = gsf_agregado(mensal, ms)
        anual.append({"ano": ano, "meses": len(ms), "completo": len(ms) == 12, "gsf_pct": c.r(a and a["gsf_pct"], 3),
                      "inicio": ms[0], "fim": ms[-1]})
    ult = validos[-1]["mes"] if validos else None
    j12 = gsf_agregado(mensal, _janela(ult)) if ult else None
    ident = [{"mes": x["mes"], "diferenca_mwmed": c.r(x["gf_sazonalizada_soma_submercados_mwmed"] - x["gf_sazonalizada_mwmed"], 3)}
             for x in mensal if x["gf_sazonalizada_soma_submercados_mwmed"] is not None and x["gf_sazonalizada_mwmed"] is not None]
    sub = []
    if ult:
        for sm in ("SE", "S", "NE", "N"):
            sub.append({"submercado": sm, "geracao_mre_mwmed": c.r(ger.get((f"{sm}|GERACAO_MRE", ult)), 3),
                        "gf_sazonalizada_mwmed": c.r(gfsm.get((f"{sm}|GARANTIA_FISICA_SAZO_MRE_OPCOM", ult)), 3)})
    rec_im = [x for x in reconcilia_infomercado(con) if x["medida"] in ("gsf_pct", "geracao_mre_mwmed")]
    cb = conta_bandeira_nacional(_vigentes(con, DS_CB))
    rh = [{"mes": x["mes"], "distribuidoras": x["distribuidoras"], **{k: x.get(k) for k in (
        "rh_itaipu", "rh_repactuadas", "rh_ccgf", "previsao_rh", "premio_risco", "rh_ccgf_repactuadas_liquido")}} for x in cb]
    for x in rh:
        partes = [x.get(k) for k in ("rh_itaipu", "rh_repactuadas", "rh_ccgf")]
        x["rh_bruto"] = c.r(sum(partes), 2) if all(p is not None for p in partes) else None
    rh_anual = []
    for ano in sorted({x["mes"][:4] for x in rh}):
        xs = [x for x in rh if x["mes"][:4] == ano]
        rh_anual.append({"ano": ano, "meses": len(xs), **{k: c.r(_soma(*[x.get(k) for x in xs]), 2) for k in (
            "rh_itaipu", "rh_repactuadas", "rh_ccgf", "previsao_rh", "premio_risco", "rh_ccgf_repactuadas_liquido", "rh_bruto")}})
    kpis = {}
    vs = _vintages_ccee(con, "geracao_submercado") + _vintages_ccee(con, "mre_mensal")
    if ult:
        u = next(x for x in mensal if x["mes"] == ult)
        teste_id = evid.teste("Σ garantia física sazonalizada dos submercados = garantia física sazonalizada do MRE",
                              "aprovado" if all(abs(x["diferenca_mwmed"]) <= 0.01 for x in ident) else "ressalva",
                              f"{len(ident)} meses; maior diferença {max((abs(x['diferenca_mwmed']) for x in ident), default=None)} MWmed")
        g_im = [x for x in rec_im if x["medida"] == "gsf_pct"]
        rec = None
        if g_im:
            rec = evid.reconciliacao("; ".join(f"InfoMercado Nº {x['numero']} ({x['mes']}): {_br(x['publicado'], 2)}% publicado, {_br(x['calculado'], 2)}% calculado"
                                               for x in g_im), "aprovado" if all(x["resultado"] == "aprovado" for x in g_im) else "ressalva",
                                     g_im[0]["tolerancia"])
        kpis["gsf_ultimo_mes"] = {"valor_pct": u["gsf_pct"], "mes": ult, "evidencia": ev(
            indicador="Fator de ajuste do MRE (GSF)", valor_exibido=f"{_br(u['gsf_pct'], 1)}%", valor_calculo=u["gsf_pct"], unidade="%",
            periodo={"inicio": ult, "fim": ult}, entidade="Mecanismo de Realocação de Energia (SIN)",
            universo="usinas hidrelétricas participantes do MRE",
            fonte=_fonte_ev("CCEE", "GERACAO_SUBMERCADO e MRE_MENSAL", f"{cm.PORTAL}/dataset/mre_mensal", vs),
            chaves_origem=[f"{sm}|GERACAO_MRE@{ult}" for sm in ("SE", "S", "NE", "N")] + [f"GARANTIA_FISICA_MODULADA_FDISP@{ult}"],
            formula="GSF = 100 × Σ GERACAO_MRE dos quatro submercados ÷ GARANTIA_FISICA_MODULADA_FDISP (GFIS_2)",
            numerador={"descricao": "geração das usinas do MRE no centro de gravidade (MWmed)", "valor": u["geracao_mre_mwmed"]},
            denominador={"descricao": "garantia física modulada ajustada pelo fator de disponibilidade (MWmed)", "valor": u["gf_modulada_fdisp_mwmed"]},
            cobertura="quatro submercados publicados no mês", tratamento_ausencia="mês sem os quatro submercados fica sem GSF",
            testes=[teste_id], reconciliacao=rec, download=[{"rotulo": "Séries mensais da CCEE (CSV)", "url": _url(CSV_CCEE)}],
            revisoes=c.revisoes_do_dataset(con, cm.dataset("geracao_submercado")))}
    if j12:
        kpis["gsf_12m"] = {"valor_pct": c.r(j12["gsf_pct"], 3), "periodo": {"inicio": j12["inicio"], "fim": j12["fim"]}, "evidencia": ev(
            indicador="Fator de ajuste do MRE (GSF) em 12 meses", valor_exibido=f"{_br(j12['gsf_pct'], 1)}%", valor_calculo=j12["gsf_pct"],
            unidade="%", periodo={"inicio": j12["inicio"], "fim": j12["fim"]}, entidade="Mecanismo de Realocação de Energia (SIN)",
            universo="usinas hidrelétricas participantes do MRE",
            fonte=_fonte_ev("CCEE", "GERACAO_SUBMERCADO e MRE_MENSAL", f"{cm.PORTAL}/dataset/mre_mensal", vs),
            consulta=f"GERACAO_MRE e GARANTIA_FISICA_MODULADA_FDISP de {j12['inicio']} a {j12['fim']}",
            formula="100 × Σ(geração MRE × horas do mês) ÷ Σ(GFIS_2 × horas do mês)", pesos="horas de cada mês",
            numerador={"descricao": "geração do MRE em 12 meses (MWh)", "valor": c.r(j12["geracao_mwh"], 3)},
            denominador={"descricao": "garantia física modulada ajustada em 12 meses (MWh)", "valor": c.r(j12["gf_mwh"], 3)},
            cobertura="12 meses com os quatro submercados", tratamento_ausencia="janela incompleta não é calculada",
            testes=[evid.teste("Agregação ponderada por energia, não média de percentuais", "aprovado",
                               "razão das somas em MWh de geração e de garantia física")],
            download=[{"rotulo": "Séries mensais da CCEE (CSV)", "url": _url(CSV_CCEE)}],
            revisoes=c.revisoes_do_dataset(con, cm.dataset("mre_mensal")))}
    v_cb = _vintage(con, DS_CB, "Conta Bandeira")
    ult_cb = rh[-1]["mes"] if rh else None
    if ult_cb:
        meses = _janela(ult_cb)
        por = {x["mes"]: x for x in rh}
        if all(m in por and por[m]["rh_bruto"] is not None for m in meses):
            total = sum(por[m]["rh_bruto"] for m in meses)
            univ = _universo(con, DS_CB, v_cb["vintage_id"]) if v_cb else {}
            kpis["risco_hidrologico_acr_12m"] = {"valor_rs": c.r(total, 2), "periodo": {"inicio": meses[0], "fim": meses[-1]}, "evidencia": ev(
                indicador="Custo do risco hidrológico alocado às distribuidoras (cotas, repactuadas e Itaipu)",
                valor_exibido=_bilhoes(total), valor_calculo=total, unidade="R$",
                periodo={"inicio": meses[0], "fim": meses[-1]}, entidade="distribuidoras (mercado regulado)",
                universo="distribuidoras na Conta Bandeira; custos apurados pela CCEE e informados à ANEEL",
                fonte=_fonte_ev("ANEEL", "Bandeiras Tarifárias: Conta Bandeira", URL_BAND, [v_cb]),
                consulta=f"VlrRiscoHidrologicoItaipu + VlrRiscoHidrologicoRepactuadas + VlrRiscoHidrologicoCCGF, competências {meses[0]} a {meses[-1]}",
                formula="Σ (risco hidrológico de Itaipu + das usinas repactuadas + das cotas de garantia física) nas 12 competências, antes da previsão tarifária e do prêmio de risco",
                cobertura="todas as linhas da base, inclusive as sem CNPJ", tratamento_ausencia="campo vazio não entra na soma",
                testes=[evid.teste("Identidade do dicionário: CCGF e repactuadas líquido = repactuadas + CCGF + previsão + prêmio",
                                   "aprovado" if str(univ.get("identidade_risco_hidrologico_violada", "1")) == "0" else "reprovado",
                                   f"{univ.get('identidade_risco_hidrologico_violada')} linhas fora da tolerância de R$ 1 em {univ.get('linhas')}")],
                download=[{"rotulo": "Conta Bandeira por distribuidora (CSV)", "url": _url(CSV_CB)}],
                revisoes=c.revisoes_do_dataset(con, DS_CB))}
    return {"kpis": kpis, "mensal": mensal, "anual": anual, "submercados_ultimo_mes": {"mes": ult, "linhas": sub},
            "identidade_gf": ident[-12:], "reconciliacao_infomercado": rec_im,
            "risco_hidrologico_acr": {"mensal": rh, "anual": rh_anual}}


# ======================================================================= P035: encargos e contabilização

COLUNAS_ESS = {
    "ENCARGO_CONST_ON": "ro_constrained_on", "ENCARGO_CONST_OFF": "ro_constrained_off",
    "ENCARGO_REST_OP_UNIT_COMT": "ro_unit_commitment", "ENCARGO_CS": "suporte_reativo",
    "RECEBIMENTO_ENCARGO_DH": "deslocamento_hidraulico", "ENCARGO_SEG_ENER": "seguranca_energetica",
    "ENCARGO_IMPORTACAO": "importacao", "RECEBIMENTO_ENCARGO_RESERVA_OP": "reserva_operativa",
    "OUTROS_SERVICOS_ANCILARES": "outros_ancilares", "RESSARCIMENTO_SERVICOS_ANCILARES": "ressarc_investimento_ancilares",
    "RESSARCIMENTO_CUSTO_OP_MNT_EQUIP": "ressarc_autorrestabelecimento", "RESSARCIMENTO_CUSTO_OP_MNT_EQUIP_CAG": "ressarc_cag",
    "RESSARCIMENTO_CUSTO_IMPL_OP_MNT_SEP": "ressarc_sep", "RESSARCIMENTO_CUSTO_EMERGENCIAL": "ressarc_emergencial",
    "RESSARCIMENTO_DIST_IMPL_OP_MNT": "ressarc_distribuidora",
}
# Tipos de encargo que somam o total do mês. As seis colunas de ressarcimento NÃO entram: o
# dicionário define OUTROS_SERVICOS_ANCILARES como a soma do encargo por outros serviços
# ancilares (que remunera esses ressarcimentos) e do ressarcimento de SEP da distribuidora, e o
# arquivo confirma, em todos os meses de 2023 a 2026, OUTROS = Σ ressarcimentos ao centavo.
# Somar as duas coisas contava a mesma despesa duas vezes (o InfoMercado de agosto e de
# outubro de 2024 confere com a soma sem os ressarcimentos).
TIPOS_ESS = ("ENCARGO_CONST_ON", "ENCARGO_CONST_OFF", "ENCARGO_REST_OP_UNIT_COMT", "ENCARGO_CS",
             "OUTROS_SERVICOS_ANCILARES", "ENCARGO_SEG_ENER", "RECEBIMENTO_ENCARGO_DH", "ENCARGO_IMPORTACAO",
             "RECEBIMENTO_ENCARGO_RESERVA_OP")
DETALHE_OSA = ("RESSARCIMENTO_SERVICOS_ANCILARES", "RESSARCIMENTO_CUSTO_OP_MNT_EQUIP", "RESSARCIMENTO_CUSTO_OP_MNT_EQUIP_CAG",
               "RESSARCIMENTO_CUSTO_IMPL_OP_MNT_SEP", "RESSARCIMENTO_CUSTO_EMERGENCIAL", "RESSARCIMENTO_DIST_IMPL_OP_MNT")


def rd_mensal_de(rd):
    """{mês: (soma em R$, submercados com valor)} do encargo de resposta da demanda. Célula
    vazia é ausência (a CCEE deixa vazio o submercado sem valor e às vezes publica 0): o mês
    em que os quatro submercados vêm vazios não tem valor, e não vira zero."""
    out = {}
    for (s_, mes), v in rd.items():
        if s_.endswith("|RECEBIMENTO_ENCARGO_RD") and v is not None:
            soma, n = out.get(mes, (0.0, 0))
            out[mes] = (soma + v, n + 1)
    return out


def ess_mensal_de(ess, rd=None):
    """Linhas mensais de ESS a partir das observações do conjunto ENCARGO_ESS_ANCILAR.

    total = Σ dos nove tipos (sem os ressarcimentos, que são detalhe dos outros serviços
    ancilares); mês com algum tipo vazio fica sem total (ausência não vira zero). Cada linha
    leva a conferência OUTROS_SERVICOS_ANCILARES = Σ ressarcimentos (diferença em R$)."""
    meses = sorted({r for (_, r) in ess})
    out = []
    for m in meses:
        d = {COLUNAS_ESS[s]: v for (s, r), v in ess.items() if r == m and s in COLUNAS_ESS}
        tipos = [ess.get((col, m)) for col in TIPOS_ESS]
        det = [ess.get((col, m)) for col in DETALHE_OSA]
        total = None if any(v is None for v in tipos) else sum(tipos)
        osa = ess.get(("OUTROS_SERVICOS_ANCILARES", m))
        dif_osa = None if osa is None or any(v is None for v in det) else osa - sum(det)
        rd_v, rd_n = (rd or {}).get(m, (None, 0))
        out.append({"mes": m, **{k: c.r(v, 2) for k, v in sorted(d.items())}, "total": c.r(total, 2),
                    "restricao_operacao": c.r(_soma(d.get("ro_constrained_on"), d.get("ro_constrained_off"), d.get("ro_unit_commitment")), 2),
                    "servicos_ancilares": c.r(_soma(d.get("suporte_reativo"), d.get("outros_ancilares")), 2),
                    "diferenca_outros_ressarcimentos": c.r(dif_osa, 2),
                    "resposta_demanda": c.r(rd_v, 2), "resposta_demanda_submercados": rd_n})
    return out


def mme_vigente(obs_mme):
    """Encargos do boletim do MME: para cada (tipo, mês), o valor da edição mais recente que o traz,
    e as revisões entre edições (mesmo tipo e mês com valor diferente em edições diferentes)."""
    por = {}
    for (s, mes), v in obs_mme.items():
        if not s.startswith("ess|"):
            continue
        _, ident, ed = s.split("|")
        por.setdefault((ident, mes), {})[ed[2:]] = v
    vig, revisoes = {}, []
    for (ident, mes), eds in sorted(por.items()):
        ords = sorted(eds)
        vig[(ident, mes)] = (eds[ords[-1]], ords[-1])
        for a, b in zip(ords, ords[1:]):
            if abs(eds[a] - eds[b]) > 1e-9:
                revisoes.append({"tipo": ident, "mes": mes, "edicao_anterior": a, "valor_anterior_mil_rs": eds[a],
                                 "edicao_posterior": b, "valor_posterior_mil_rs": eds[b], "diferenca_mil_rs": eds[b] - eds[a]})
    # linhas que deixaram de ser publicadas numa edição posterior (parcela retirada)
    eds_todas = sorted({ed for d in por.values() for ed in d})
    for (ident, mes), eds in sorted(por.items()):
        posteriores = [e for e in eds_todas if e > max(eds) and any((k[1] == mes) and e in d for k, d in por.items())]
        if posteriores:
            revisoes.append({"tipo": ident, "mes": mes, "edicao_anterior": max(eds), "valor_anterior_mil_rs": eds[max(eds)],
                             "edicao_posterior": posteriores[0], "valor_posterior_mil_rs": None, "diferenca_mil_rs": None,
                             "nota": "linha publicada na edição anterior e retirada na seguinte"})
            vig.pop((ident, mes), None)
    return vig, revisoes


def linha_liquidacao(mes, pre, pos, ina):
    """Liquidação do MCP de um mês. A identidade da fonte é a liquidar = liquidado +
    inadimplência (tolerância de R$ 1). Quando a CCEE publica 0 em liquidado e em inadimplência
    para um valor a liquidar positivo (março e abril de 2026), a identidade não fecha: o zero não
    é liquidação nula, é liquidação ainda não informada, e a taxa de inadimplência não é
    calculada (fica a situação, o número publicado continua no CSV)."""
    fecha = None if None in (pre, pos, ina) else abs(pre - pos - ina) <= 1.0
    if None in (pre, pos, ina):
        situacao = "sem_valor"
    elif fecha:
        situacao = "liquidada"
    elif pos == 0 and ina == 0 and pre > 0:
        situacao = "liquidacao_nao_informada"
    else:
        situacao = "identidade_nao_fecha"
    return {"mes": mes, "a_liquidar": c.r(pre, 2), "liquidado": c.r(pos, 2), "inadimplencia": c.r(ina, 2),
            "inadimplencia_pct": c.r(_pct(ina, pre), 2) if situacao == "liquidada" else None,
            "fecha": fecha, "situacao": situacao}


# Linha do boletim do MME → colunas do conjunto da CCEE que a compõem (mil R$ × 1.000 = R$).
MME_PARA_CCEE = {
    "ro_constrained_on": ("ENCARGO_CONST_ON",), "ro_constrained_off": ("ENCARGO_CONST_OFF",),
    "ro_unit_commitment": ("ENCARGO_REST_OP_UNIT_COMT",),
    "restricao_operacao": ("ENCARGO_CONST_ON", "ENCARGO_CONST_OFF", "ENCARGO_REST_OP_UNIT_COMT"),
    "suporte_reativo": ("ENCARGO_CS",), "deslocamento_hidraulico": ("RECEBIMENTO_ENCARGO_DH",),
    "seguranca_energetica": ("ENCARGO_SEG_ENER",), "outros_ancilares": ("OUTROS_SERVICOS_ANCILARES",),
    "importacao": ("ENCARGO_IMPORTACAO",), "reserva_operativa": ("RECEBIMENTO_ENCARGO_RESERVA_OP",),
}


def reconcilia_mme_ccee(vig_mme, ess_mensal):
    """Encargos por tipo no boletim do MME (mil R$, edição vigente) × conjunto ENCARGO_ESS_ANCILAR.
    O total do boletim inclui a resposta da demanda, que o conjunto não tem: a conferência do
    total é do total menos a resposta da demanda. Tolerância: 0,5 mil R$ por tipo (o boletim
    publica mil R$ inteiros) e 6 mil R$ no total (até 12 parcelas arredondadas)."""
    por_ess = {x["mes"]: x for x in ess_mensal}
    out = []
    for (ident, mes), (val, ed) in sorted(vig_mme.items()):
        if mes not in por_ess:
            continue
        linha = por_ess[mes]
        if ident in MME_PARA_CCEE:
            vals = [linha.get(COLUNAS_ESS[col]) for col in MME_PARA_CCEE[ident]]
            ccee = None if any(v is None for v in vals) else sum(vals) / 1000.0
            pub, tol, tipo = val, 0.5, ident
        elif ident == "resposta_demanda":
            ccee = None if linha.get("resposta_demanda") is None else linha["resposta_demanda"] / 1000.0
            pub, tol, tipo = val, 0.5, ident
        elif ident == "total":
            rd = vig_mme.get(("resposta_demanda", mes), (None, None))[0]
            ccee = None if linha.get("total") is None else linha["total"] / 1000.0
            pub = None if rd is None else val - rd
            tol, tipo = 6.0, "total_sem_resposta_demanda"
            if pub is None:
                continue
        else:
            continue
        dif = None if ccee is None else ccee - pub
        out.append({"tipo": tipo, "mes": mes, "edicao": ed, "mme_mil_rs": c.r(pub, 3), "ccee_mil_rs": c.r(ccee, 3),
                    "diferenca_mil_rs": c.r(dif, 3), "tolerancia_mil_rs": tol,
                    "resultado": None if dif is None else ("aprovado" if abs(dif) <= tol else "ressalva")})
    return out


def secao_encargos(con, ev):
    ess = _ccee(con, "encargo_ess_ancilar")
    ess_mensal = ess_mensal_de(ess, rd_mensal_de(_ccee(con, "rd_encargos_contab_mensal")))
    eer = _ccee(con, "reserva_encargo")
    eer_mensal = [{"mes": m, "encargo_energia_reserva": c.r(eer.get(("ENCARGO_ENERGIA_RESERVA", m)), 2),
                   "saldo_efetivo_coner": c.r(eer.get(("SALDO_EFETIVO_CONER", m)), 2),
                   "pagamento_liquido_er": c.r(eer.get(("TOTAL_PAGAMENTO_LIQ_ER", m)), 2)} for m in sorted({r for (_, r) in eer})]
    pg = _ccee(con, "encargo_pgto_mensal")
    pgto_mensal = [{"mes": m, "pagamento_ess": c.r(pg.get(("PAGAMENTO_ENCARGO_ESS", m)), 2),
                    "pagamento_seguranca_energetica": c.r(pg.get(("PAGAMENTO_ENCARGO_SE", m)), 2),
                    "recursos_alivio_ess": c.r(pg.get(("RESERVA_ALIVIO_ESS", m)), 2),
                    "penalidades_alivio_ess": c.r(pg.get(("TOTAL_PENALIDADES_ESS", m)), 2)} for m in sorted({r for (_, r) in pg})]
    lq = _ccee(con, "sumario_mensal_liquidacao")
    liq_mensal = []
    for m in sorted({r for (_, r) in lq}):
        liq_mensal.append(linha_liquidacao(m, *(lq.get((k, m)) for k in ("VALOR_TOTAL_LIQ_PRE", "VALOR_TOTAL_LIQ_POS", "VALOR_INAD"))))
    mcp = _ccee(con, "sumario_mensal_compra_venda_submercado")
    mcp_mensal = []
    for m in sorted({r for (_, r) in mcp}):
        for sm in ("SE", "S", "NE", "N"):
            g = lambda col: mcp.get((f"{sm}|{col}", m))  # noqa: E731
            if g("BE_POSITIVO") is None:
                continue
            mcp_mensal.append({"mes": m, "submercado": sm, "be_positivo_mwh": c.r(g("BE_POSITIVO"), 3), "be_negativo_mwh": c.r(g("BE_NEGATIVO"), 3),
                               "resultado_venda_rs": c.r(g("RESULTADO_MCP_VENDA"), 2), "resultado_compra_rs": c.r(g("RESULTADO_MCP_COMPRA"), 2)})
    obs_mme = _vigentes(con, DS_MME)
    vig_mme, rev_mme = mme_vigente(obs_mme)
    regs_mme = base.registros_como_estavam_em(con, DS_MME)
    edicoes = []
    for ch, d in sorted(regs_mme.items()):
        if ch.startswith("edicao|"):
            v = next((x for x in base.vintages_do_dataset(con, DS_MME) if x["vintage_id"] == d.get("vintage")), {})
            edicoes.append({"edicao": ch.split("|")[1], "recurso": d.get("recurso"), "pagina_encargos": d.get("ess_pagina"),
                            "publicado_em": v.get("publicado_em"), "capturado_em": v.get("capturado_em"), "sha256": v.get("sha256")})
    mme_linhas = [{"tipo": k[0], "mes": k[1], "valor_mil_rs": val, "edicao": ed} for k, (val, ed) in sorted(vig_mme.items())]
    rec_mme = reconcilia_mme_ccee(vig_mme, ess_mensal)
    por_ess = {x["mes"]: x for x in ess_mensal}
    cb = conta_bandeira_nacional(_vigentes(con, DS_CB))
    acr = [{"mes": x["mes"], "distribuidoras": x["distribuidoras"], "ess_eer": x.get("ess_eer"), "ressarcimento_coner": x.get("ressarcimento_coner"),
            "resultado_mcp": x.get("resultado_mcp"), "ccear_d": x.get("ccear_d"), "receita_faturada_bandeiras": x.get("receita_faturada"),
            "repasse_conta_bandeira": x.get("repasse_conta_bandeira")} for x in cb]
    kpis = {}
    if ess_mensal:
        ult = ess_mensal[-1]["mes"]
        jan = _janela(ult)
        if all(m in por_ess and por_ess[m]["total"] is not None for m in jan):
            tot = sum(por_ess[m]["total"] for m in jan)
            vs = _vintages_ccee(con, "encargo_ess_ancilar")
            ok_mme = [x for x in rec_mme if x["resultado"] is not None]
            rec = None
            im = [x for x in reconcilia_infomercado(con) if x["medida"] == "encargos_do_conjunto_milhoes_rs"]
            partes = []
            if ok_mme:
                n_ok = sum(1 for x in ok_mme if x["resultado"] == "aprovado")
                partes.append(f"Boletim Mensal do MME (edições de 2026, fonte declarada CCEE): {n_ok} de {len(ok_mme)} valores por tipo e mês coincidem com o conjunto aberto (tolerância de 0,5 mil R$)")
            for x in im:
                partes.append(f"InfoMercado Nº {x['numero']} ({x['mes']}): R$ {_br(x['publicado'], 2)} milhões sem as parcelas fora do conjunto; conjunto aberto: R$ {_br(x['calculado'], 2)} milhões")
            if partes:
                aprov = all(x["resultado"] == "aprovado" for x in ok_mme) and all(x["resultado"] == "aprovado" for x in im)
                rec = evid.reconciliacao("; ".join(partes), "aprovado" if aprov else "ressalva",
                                         "0,5 mil R$ por tipo e mês no boletim do MME; R$ 0,06 milhão por mês no InfoMercado")
            dif_osa = [abs(por_ess[m]["diferenca_outros_ressarcimentos"]) for m in jan if por_ess[m]["diferenca_outros_ressarcimentos"] is not None]
            kpis["ess_12m"] = {"valor_rs": c.r(tot, 2), "periodo": {"inicio": jan[0], "fim": jan[-1]}, "evidencia": ev(
                indicador="Encargos de serviços do sistema (ESS) em 12 meses", valor_exibido=_bilhoes(tot),
                valor_calculo=tot, unidade="R$", periodo={"inicio": jan[0], "fim": jan[-1]}, entidade="SIN",
                universo="encargos de serviços do sistema apurados na contabilização (competência do mês de referência), conjunto ENCARGO_ESS_ANCILAR; não inclui a resposta da demanda nem o encargo de energia de reserva",
                fonte=_fonte_ev("CCEE", "ENCARGO_ESS_ANCILAR", f"{cm.PORTAL}/dataset/encargo_ess_ancilar", vs),
                consulta=f"colunas {', '.join(TIPOS_ESS)} de ENCARGO_ESS_ANCILAR, {jan[0]} a {jan[-1]}",
                formula="Σ dos nove tipos de encargo nos 12 meses de competência (as colunas RESSARCIMENTO_* detalham OUTROS_SERVICOS_ANCILARES e não são somadas de novo)",
                cobertura="12 meses publicados", tratamento_ausencia="mês com tipo vazio fica sem total e interrompe a janela",
                exclusoes=[f"{col} (detalhe de OUTROS_SERVICOS_ANCILARES)" for col in DETALHE_OSA],
                testes=[evid.teste("Esquema conferido na chegada (16 colunas documentadas)", "aprovado", "cabeçalho igual ao esperado; falha fechada se divergir"),
                        evid.teste("OUTROS_SERVICOS_ANCILARES = Σ ressarcimentos, em cada mês", "aprovado" if dif_osa and max(dif_osa) <= 1.0 else "ressalva",
                                   f"{len(dif_osa)} meses; maior diferença R$ {_br(max(dif_osa, default=0.0), 2)}")],
                reconciliacao=rec, download=[{"rotulo": "Séries mensais da CCEE (CSV)", "url": _url(CSV_CCEE)},
                                             {"rotulo": "Encargos do boletim do MME (CSV)", "url": _url(CSV_ESS)}],
                revisoes=c.revisoes_do_dataset(con, cm.dataset("encargo_ess_ancilar")))}
    if eer_mensal:
        por_eer = {x["mes"]: x for x in eer_mensal}
        ult = eer_mensal[-1]["mes"]
        jan = _janela(ult)
        if all(m in por_eer and por_eer[m]["encargo_energia_reserva"] is not None for m in jan):
            tot = sum(por_eer[m]["encargo_energia_reserva"] for m in jan)
            kpis["eer_12m"] = {"valor_rs": c.r(tot, 2), "periodo": {"inicio": jan[0], "fim": jan[-1]}, "evidencia": ev(
                indicador="Encargo de energia de reserva (EER) em 12 meses", valor_exibido=_bilhoes(tot),
                valor_calculo=tot, unidade="R$", periodo={"inicio": jan[0], "fim": jan[-1]}, entidade="SIN",
                universo="encargo de energia de reserva cobrado dos usuários (ENCARGO_ENERGIA_RESERVA)",
                fonte=_fonte_ev("CCEE", "RESERVA_ENCARGO", f"{cm.PORTAL}/dataset/reserva_encargo", _vintages_ccee(con, "reserva_encargo")),
                consulta=f"ENCARGO_ENERGIA_RESERVA, {jan[0]} a {jan[-1]}", formula="Σ ENCARGO_ENERGIA_RESERVA dos 12 meses",
                cobertura="12 meses publicados", tratamento_ausencia="mês ausente interrompe a janela",
                testes=[evid.teste("Esquema conferido na chegada (7 colunas documentadas)", "aprovado", "cabeçalho igual ao documentado")],
                download=[{"rotulo": "Séries mensais da CCEE (CSV)", "url": _url(CSV_CCEE)}],
                revisoes=c.revisoes_do_dataset(con, cm.dataset("reserva_encargo")))}
    liquidados = [x for x in liq_mensal if x["situacao"] == "liquidada"]
    if liquidados:
        u = liquidados[-1]
        rec_im = [x for x in reconcilia_infomercado(con) if x["medida"] == "liquidar_bilhoes_rs"]
        rec = None
        if rec_im:
            rec = evid.reconciliacao("; ".join(f"InfoMercado Nº {x['numero']} ({x['mes']}): R$ {_br(x['publicado'], 2)} bilhões a liquidar; conjunto aberto: R$ {_br(x['calculado'], 3)} bilhões" for x in rec_im),
                                     "aprovado" if all(x["resultado"] == "aprovado" for x in rec_im) else "ressalva", rec_im[0]["tolerancia"])
        kpis["inadimplencia_ultimo_mes"] = {"valor_pct": u["inadimplencia_pct"], "mes": u["mes"], "evidencia": ev(
            indicador="Inadimplência na liquidação financeira do mercado de curto prazo", valor_exibido=f"{_br(u['inadimplencia_pct'], 1)}%",
            valor_calculo=u["inadimplencia_pct"], unidade="%", periodo={"inicio": u["mes"], "fim": u["mes"]}, entidade="MCP (SIN)",
            universo="valor total a liquidar no mês de apuração",
            fonte=_fonte_ev("CCEE", "SUMARIO_MENSAL_LIQUIDACAO", f"{cm.PORTAL}/dataset/sumario_mensal_liquidacao", _vintages_ccee(con, "sumario_mensal_liquidacao")),
            chaves_origem=[f"VALOR_INAD@{u['mes']}", f"VALOR_TOTAL_LIQ_PRE@{u['mes']}"],
            formula="100 × VALOR_INAD ÷ VALOR_TOTAL_LIQ_PRE",
            numerador={"descricao": "inadimplência (R$)", "valor": u["inadimplencia"]},
            denominador={"descricao": "valor total a liquidar (R$)", "valor": u["a_liquidar"]},
            cobertura="mês de apuração publicado", tratamento_ausencia="mês sem os dois valores fica sem taxa",
            testes=[evid.teste("A liquidar = liquidado + inadimplência", "aprovado" if u["fecha"] else "ressalva",
                               f"diferença {c.r((u['a_liquidar'] or 0) - (u['liquidado'] or 0) - (u['inadimplencia'] or 0), 2)} R$")],
            reconciliacao=rec, download=[{"rotulo": "Séries mensais da CCEE (CSV)", "url": _url(CSV_CCEE)}],
            revisoes=c.revisoes_do_dataset(con, cm.dataset("sumario_mensal_liquidacao")))}
    if mme_linhas:
        ed_ult = max(e["edicao"] for e in edicoes) if edicoes else None
        tot_ano = [x for x in mme_linhas if x["tipo"] == "total"]
        if tot_ano and ed_ult:
            soma = sum(x["valor_mil_rs"] for x in tot_ano)
            ed = next(e for e in edicoes if e["edicao"] == ed_ult)
            v_ed = next((v for v in base.vintages_do_dataset(con, DS_MME) if v["recurso"] == ed["recurso"]), None)
            kpis["ess_mme_ano"] = {"valor_mil_rs": soma, "periodo": {"inicio": tot_ano[0]["mes"], "fim": tot_ano[-1]["mes"]}, "edicao": ed_ult,
                                   "evidencia": ev(
                indicador="Encargos de serviços do sistema no ano, Boletim Mensal do MME", valor_exibido=f"R$ {_br(soma / 1000, 1)} milhões",
                valor_calculo=soma * 1000, unidade="R$", periodo={"inicio": tot_ano[0]["mes"], "fim": tot_ano[-1]["mes"]}, entidade="SIN",
                universo="tabela 'Encargos de Serviços de Sistema' do boletim (dados da CCEE)",
                fonte=_fonte_ev("MME", "Boletim Mensal de Monitoramento do Sistema Elétrico", URL_MME, [v_ed]),
                extracao_pdf={"documento": ed["recurso"], "edicao": ed_ult, "pagina": str(ed.get("pagina_encargos")),
                              "conferencia": "pdftotext -layout; em cada mês, Σ tipos = linha Total e Σ parcelas = tipo, tolerância 2 mil R$; valores por tipo conferidos contra o conjunto ENCARGO_ESS_ANCILAR da CCEE"},
                chaves_origem=[f"ess|total|ed{x['edicao']}@{x['mes']}" for x in tot_ano],
                formula="Σ da linha Total da tabela de encargos nos meses publicados (vale a edição mais recente de cada mês)",
                cobertura="meses do ano até o mês da edição", tratamento_ausencia="meses posteriores à edição (publicados como 0) não entram",
                testes=[evid.teste("Soma dos tipos = Total em cada mês", "aprovado", "conferido na extração")],
                download=[{"rotulo": "Encargos do boletim do MME (CSV)", "url": _url(CSV_ESS)}],
                revisoes=f"{len(rev_mme)} revisões entre edições do boletim (ver lista de revisões)")}
    return {"kpis": kpis, "ess_mensal": ess_mensal, "eer_mensal": eer_mensal, "pagamento_mensal": pgto_mensal,
            "liquidacao_mensal": liq_mensal, "mcp_submercado_mensal": mcp_mensal,
            "mme": {"edicoes": edicoes, "vigente": mme_linhas, "revisoes": rev_mme, "reconciliacao_ccee": rec_mme},
            "acr_conta_bandeira_mensal": acr,
            "reconciliacao_infomercado": [x for x in reconcilia_infomercado(con)
                                          if x["medida"].startswith("encargos_") or x["medida"] in ("pagamento_ess_milhoes_rs", "liquidar_bilhoes_rs")]}


# ======================================================================= gold

REPRODUCAO = "python3 pipeline/energia/executar_modulo.py mercado --sem-coleta"

DEFINICOES = {
    "acl": "Ambiente de Contratação Livre: o consumidor (livre ou especial) compra energia de gerador ou comercializador em contrato bilateral negociado livremente.",
    "acr": "Ambiente de Contratação Regulada: a distribuidora compra em leilões e revende ao consumidor cativo pela tarifa regulada.",
    "agente": "Pessoa jurídica associada à CCEE ou cadastrada na ANEEL, identificada pelo CNPJ. Um agente pode ter vários perfis.",
    "perfil": "Registro contábil de um agente na CCEE (código COD_PERF_AGENTE), com classe e, no caso de geração, tipo de energia. Novo perfil não é empresa nova.",
    "parcela_de_carga": "Unidade de consumo modelada na CCEE (COD_PARCELA_CARGA), ligada a um perfil de agente; pode reunir uma ou mais unidades consumidoras.",
    "unidade_consumidora": "Instalação com um só ponto de entrega e medição individualizada, correspondente a um único consumidor (Resolução ANEEL 83/2004, citada pela EPE). É o que a EPE e o SAMP contam.",
    "migracao": "Entrada de uma parcela de carga no ACL: a CCEE publica a data de migração de cada parcela; aqui conta-se a parcela cuja data de migração cai no próprio mês de referência.",
    "entrada_saida_agente": "Entrada: CNPJ presente na lista de associados da CCEE no mês e ausente no mês anterior; saída: o inverso. Saída não é necessariamente desligamento (pode ser sucessão).",
    "desligamento": "Cancelamento da participação de um agente na CCEE, voluntário (a pedido, com ou sem sucessão) ou compulsório (por outorga revogada ou descumprimento), aprovado pelo Conselho de Administração.",
    "variacao_liquida": "Diferença entre o estoque de um mês e o do mês anterior: não separa quem entrou de quem saiu.",
    "mre": "Mecanismo de Realocação de Energia: compartilha entre as hidrelétricas participantes o risco hidrológico do despacho centralizado; quem gera acima da garantia física cede energia a quem gera abaixo, ao preço da TEO.",
    "gsf": "Fator de ajuste do MRE (generation scaling factor): geração das usinas do MRE dividida pela garantia física delas (modulada e ajustada pelo fator de disponibilidade). Abaixo de 100%, as usinas do MRE geraram menos que a garantia física e ficam expostas ao mercado de curto prazo.",
    "risco_hidrologico_acr": "Parte do risco hidrológico que recai sobre o consumidor cativo: usinas em regime de cotas (Lei 12.783/2013), usinas que repactuaram o risco com a ANEEL (Lei 13.203/2015) e Itaipu. O custo é apurado pela CCEE por distribuidora e publicado pela ANEEL na Conta Bandeira.",
    "ess": "Encargos de serviços do sistema: remuneram geração fora da ordem de mérito por restrição elétrica (constrained-on, constrained-off, unit commitment), segurança energética, serviços ancilares, deslocamento hidráulico, importação e reserva operativa; pagos pelos consumidores na proporção do consumo.",
    "eer": "Encargo de energia de reserva: cobre a contratação da energia de reserva, pago pelos usuários via CONER (Conta de Energia de Reserva) na CCEE.",
    "competencia_pagamento_reprocessamento": "Competência é o mês de referência da contabilização; pagamento é a liquidação financeira (valor a liquidar, liquidado e inadimplência); reprocessamento é a mudança de um valor já publicado (aqui detectada entre capturas do silver e entre edições do boletim do MME).",
    "pld": "O PLD é o preço do mercado de curto prazo, usado para liquidar diferenças entre contratos e medição. Não é o preço dos contratos do mercado livre, que são bilaterais e privados: o observatório não publica preço de contrato, de PPA nem curva a termo.",
}


def _valida(g):
    """Validação física e de domínio antes de publicar (seção 5.2 do contrato). Devolve
    (críticas, ressalvas)."""
    crit, ress = [], []
    for l in g["livre_regulado"]["epe_mensal"]:
        for k in ("cativo_mwh", "livre_mwh"):
            if l[k] is not None and l[k] < 0:
                crit.append(f"EPE {l['mes']}: {k} negativo")
        if l["livre_pct"] is not None and not 0 <= l["livre_pct"] <= 100:
            crit.append(f"EPE {l['mes']}: participação fora de 0 a 100")
    for l in g["livre_regulado"]["ccee_mensal"]:
        if l["acr_mwmed"] < 0 or l["acl_mwmed"] < 0:
            crit.append(f"CCEE {l['mes']}: consumo negativo")
    for l in g["mre_gsf"]["mensal"]:
        if l["gsf_pct"] is not None and not 20 <= l["gsf_pct"] <= 150:
            ress.append(f"GSF {l['mes']} fora da faixa histórica plausível (20% a 150%): {l['gsf_pct']}; conferir no arquivo original")
    hoje = g["referencias"]["hoje"][:7]
    for nome, linhas in (("EPE", g["livre_regulado"]["epe_mensal"]), ("CCEE consumo", g["livre_regulado"]["ccee_mensal"]),
                         ("CCEE GSF", g["mre_gsf"]["mensal"]), ("CCEE ESS", g["encargos"]["ess_mensal"])):
        futuros = [l["mes"] for l in linhas if l["mes"] > hoje]
        if futuros:
            crit.append(f"{nome}: meses no futuro {futuros[:3]}")
        meses = [l["mes"] for l in linhas]
        if len(meses) != len(set(meses)):
            crit.append(f"{nome}: mês repetido")
    if g["livre_regulado"]["reconciliacao"]["epe_planilha"]["resultado"] == "reprovado":
        ress.append("EPE: tabela longa diverge da planilha formatada em algum mês (ver reconciliação)")
    return crit, ress


def _csvs(livre, agentes, mre, enc, con):
    agg = livre["_agg"]
    linhas = []
    obs = _vigentes(con, DS_EPE)
    uf_linhas = []
    for (serie, mes), v in obs.items():
        dec = em.decompoe_serie(serie)
        if dec is None:
            continue
        medida, d = dec
        if medida != "consumo":
            continue
        chave_uc = serie.replace("c|", "n|", 1) if serie.startswith("c|") else serie.replace("uc|", "un|", 1)
        ucs = obs.get((chave_uc, mes))
        if "uf" in d:
            uf_linhas.append([mes, d["uf"], d["sistema"], d["classe"], d["tipo"], c.r(v, 3), ucs])
        else:
            linhas.append([mes, d["regiao"], d["sistema"], d["classe"], d["tipo"], c.r(v, 3), ucs])
    base.escreve_csv(CSV_CONSUMO, ["mes", "regiao", "subsistema", "classe", "tipo", "consumo_mwh", "unidades_consumidoras"], sorted(linhas))
    base.escreve_csv(CSV_CONSUMO_UF, ["mes", "uf", "subsistema", "classe", "tipo", "consumo_mwh", "unidades_consumidoras"], sorted(uf_linhas))
    plan = _vigentes(con, DS_EPE_PLAN)
    samp = {x["mes"]: x for x in livre["samp"]["nacional_mensal"]}
    nac = []
    for l in livre["_nac"]:
        tp, lp = plan.get(("plan|total_mwh", l["mes"])), plan.get(("plan|livre_mwh", l["mes"]))
        s_ = samp.get(l["mes"], {})
        nac.append([l["mes"], c.r(l["cativo_mwh"], 3), c.r(l["livre_mwh"], 3), c.r(l["total_mwh"], 3), c.r(l["livre_pct"], 4),
                    l["cativo_uc"], l["livre_uc"], c.r(tp, 3), c.r(lp, 3),
                    c.r(l["total_mwh"] - tp, 3) if tp is not None and l["total_mwh"] is not None else None, 1 if l["preliminar"] else 0,
                    s_.get("livre_uc"), c.r(s_.get("livre_mwh"), 3), s_.get("distribuidoras")])
    base.escreve_csv(CSV_NACIONAL, ["mes", "cativo_mwh", "livre_mwh", "total_mwh", "livre_pct", "cativo_uc", "livre_uc", "total_planilha_mwh",
                                    "livre_planilha_mwh", "diferenca_total_mwh", "preliminar", "samp_livre_uc", "samp_livre_mwh",
                                    "samp_distribuidoras"], nac)
    por, cad = livre["samp"]["_por"], livre["samp"]["_cad"]
    meds = ["livre_mwh", "livre_mwh_incentivada", "livre_mwh_autoproducao", "livre_mwh_erc", "livre_mwh_convencional", "livre_mwh_outro",
            "livre_uc", "livre_uc_incentivada", "livre_uc_autoproducao", "livre_uc_erc", "livre_uc_convencional", "livre_uc_outro",
            "livre_mwh_refat", "cativo_mwh", "cativo_uc", "cativo_mwh_refat"]
    base.escreve_csv(CSV_DISTRIB, ["cnpj", "sigla", "mes"] + meds,
                     [[cn, (cad.get(cn) or {}).get("sigla"), mes] + [c.r(d.get(k), 3) if isinstance(d.get(k), float) and k.endswith("mwh") else d.get(k)
                                                                     for k in meds] for (cn, mes), d in sorted(por.items())])
    cbo = _vigentes(con, DS_CB)
    sig = {k.split("|", 1)[1]: v.get("sigla") for k, v in base.registros_como_estavam_em(con, DS_CB).items() if k.startswith("agente|")}
    campos = list(CAMPOS_CB_CURTOS.values())
    cbp = {}
    for (s, mes), v in cbo.items():
        cn, campo = s.split("|", 1)
        cbp.setdefault((cn, mes), {})[campo] = v
    base.escreve_csv(CSV_CB, ["cnpj", "sigla", "mes"] + campos + ["linhas"],
                     [[cn if cn != "sem_cnpj" else None, sig.get(cn), mes] + [c.r(d.get(k), 4) for k in campos] + [int(d["linhas"]) if d.get("linhas") else None]
                      for (cn, mes), d in sorted(cbp.items())])
    obs_mme = _vigentes(con, DS_MME)
    vig, _ = mme_vigente(obs_mme)
    regs = base.registros_como_estavam_em(con, DS_MME)
    tracos = set()
    for ch, d in regs.items():
        if ch.startswith("edicao|") and d.get("ess_tracos"):
            ed = ch.split("|")[1]
            tracos |= {(ed, *t.split("|")) for t in json.loads(d["ess_tracos"])}
    ess_l = []
    for (s, mes), v in obs_mme.items():
        if s.startswith("ess|"):
            _, ident, ed = s.split("|")
            ed = ed[2:]
            nivel = next((n for _, (i, n, _p) in mm.LINHAS_ESS.items() if i == ident), None)
            ess_l.append([ed, mes, ident, mm.ROTULOS_ESS.get(ident), nivel, v, 1 if (ed, ident, mes) in tracos else 0,
                          1 if vig.get((ident, mes), (None, None))[1] == ed else 0])
    base.escreve_csv(CSV_ESS, ["edicao", "mes", "tipo", "rotulo", "nivel", "valor_mil_rs", "traco", "vigente"], sorted(ess_l))
    ag = base.registros_como_estavam_em(con, DS_AGENTES)
    gerado = (ag.get("__arquivo__") or {}).get("gerado_em")
    base.escreve_csv(CSV_AGENTES, ["cnpj", "nome", "ativo", "comercializacao", "distribuicao", "geracao", "transmissao", "gerado_em"],
                     [[ch.split("|", 1)[1], d.get("nome"), d.get("ativo"), d.get("comercializacao"), d.get("distribuicao"), d.get("geracao"),
                       d.get("transmissao"), gerado] for ch, d in sorted(ag.items()) if ch.startswith("cnpj|")])
    cc = []
    for nome, spec in cm.CONJUNTOS.items():
        if spec["leitor"] != "mensal":
            continue
        for (s, mes), v in sorted(_ccee(con, nome).items()):
            cc.append([nome, s, mes, c.r(v, 6), spec.get("unidade")])
    for nome in ("parcela_carga_consumo", "lista_agente_associado"):
        for (s, mes), v in sorted(_ccee(con, nome).items()):
            cc.append([nome, s, mes, c.r(v, 6), "MWh" if "mwh" in s else "contagem"])
    base.escreve_csv(CSV_CCEE, ["conjunto", "serie", "mes", "valor", "unidade"], cc)
    dl = []
    for nome in ("desligamento_voluntario", "desligamento_compulsorio"):
        for ch, d in sorted(base.registros_como_estavam_em(con, cm.dataset(nome)).items()):
            if ch.startswith("desligamento|"):
                _, cn, dia, tipo = ch.split("|")
                dl.append([dia, tipo, None if cn == "sem_cnpj" else cn, d.get("agente"), d.get("classe"), d.get("sucessao"),
                           d.get("cnpj_sucessor"), d.get("classe_sucessor"), d.get("reuniao_cad")])
    base.escreve_csv(CSV_DESLIG, ["data", "tipo", "cnpj", "agente", "classe", "sucessao", "cnpj_sucessor", "classe_sucessor", "reuniao_cad"], sorted(dl))


# ======================================================================= painéis e bloqueios

def _sentido(atual, anterior, casas=1):
    """'maior que', 'menor que' ou 'igual a', comparando os valores no arredondamento exibido."""
    a, b = round(atual, casas), round(anterior, casas)
    return "maior que" if a > b else ("menor que" if a < b else "igual a")


def _bilhoes(v_rs):
    """'R$ 1,60 bilhão' / 'R$ 8,41 bilhões' (singular abaixo de 2, como se lê em português)."""
    b = v_rs / 1e9
    return f"R$ {_br(b, 2)} {'bilhão' if abs(round(b, 2)) < 2 else 'bilhões'}"


def _mes_br(mes):
    nomes = ("janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro",
             "novembro", "dezembro")
    return f"{nomes[int(mes[5:7]) - 1]} de {mes[:4]}" if mes else None


def resposta_p032(lr):
    """Resposta curta e datada do P032, por regra fixa (sem causalidade)."""
    k = lr["kpis"].get("participacao_livre_12m")
    if not k:
        return None
    p = k["periodo"]
    txt = (f"De {_mes_br(p['inicio'])} a {_mes_br(p['fim'])}, o mercado livre respondeu por {_br(k['valor_pct'], 1)}% do "
           f"consumo de energia elétrica na rede apurado pela EPE")
    if k.get("anterior_pct") is not None:
        txt += f", participação {_sentido(k['valor_pct'], k['anterior_pct'])} a dos 12 meses anteriores ({_br(k['anterior_pct'], 1)}%)"
    txt += "."
    kc = lr["kpis"].get("participacao_acl_ccee_12m")
    if kc:
        txt += (f" Na contabilização da CCEE, que mede o consumo no centro de gravidade, o ACL teve {_br(kc['valor_pct'], 1)}% "
                f"de {_mes_br(kc['periodo']['inicio'])} a {_mes_br(kc['periodo']['fim'])}.")
    return txt


def resposta_p033(am_):
    k, u = am_["kpis"].get("agentes_contabilizados"), am_["kpis"].get("ucs_livres")
    partes = []
    if k:
        partes.append(f"Em {_mes_br(k['mes'])}, {_br(k['valor'], 0)} agentes participaram da contabilização da CCEE.")
    if u:
        t = f"A EPE contou {_br(u['valor'], 0)} unidades consumidoras no mercado livre em {_mes_br(u['mes'])}"
        if u.get("variacao_12m") is not None:
            v = u["variacao_12m"]
            t += f", {_br(abs(v), 0)} {'a mais' if v > 0 else 'a menos'} que 12 meses antes" if v else ", o mesmo número de 12 meses antes"
        partes.append(t + ".")
    pf = am_.get("perfis") or {}
    if pf.get("perfis_ativos") is not None and pf.get("agentes_ativos") is not None:
        partes.append(f"No cadastro da CCEE publicado em {pf['posicao']}, {_br(pf['perfis_ativos'], 0)} perfis ativos pertenciam a "
                      f"{_br(pf['agentes_ativos'], 0)} agentes: agente, perfil e unidade consumidora são contagens diferentes.")
    return " ".join(partes) or None


def resposta_p034(mg):
    k, k12 = mg["kpis"].get("gsf_ultimo_mes"), mg["kpis"].get("gsf_12m")
    if not k:
        return None
    txt = f"O fator de ajuste do MRE (GSF) foi de {_br(k['valor_pct'], 1)}% em {_mes_br(k['mes'])}"
    if k12:
        txt += f" e de {_br(k12['valor_pct'], 1)}% nos 12 meses até {_mes_br(k12['periodo']['fim'])}"
        ref = k12["valor_pct"]
    else:
        ref = k["valor_pct"]
    rel = "menos que" if round(ref, 1) < 100 else ("mais que" if round(ref, 1) > 100 else "o mesmo que")
    return txt + f": no período, as hidrelétricas do MRE geraram {rel} a garantia física ajustada."


def resposta_p035(en):
    k, e, i = en["kpis"].get("ess_12m"), en["kpis"].get("eer_12m"), en["kpis"].get("inadimplencia_ultimo_mes")
    partes = []
    if k:
        partes.append(f"Nos 12 meses de competência até {_mes_br(k['periodo']['fim'])}, os encargos de serviços do sistema somaram "
                      f"{_bilhoes(k['valor_rs'])}.")
    if e:
        partes.append(f"O encargo de energia de reserva somou {_bilhoes(e['valor_rs'])} nos 12 meses até {_mes_br(e['periodo']['fim'])}.")
    if i and i.get("valor_pct") is not None:
        partes.append(f"Na liquidação de {_mes_br(i['mes'])}, a inadimplência foi de {_br(i['valor_pct'], 1)}% do valor a liquidar.")
    return " ".join(partes) or None


def _txt_rd(x):
    """Texto de uma divergência da resposta da demanda, com a unidade de cada publicação."""
    if "mme_mil_rs" in x:
        ccee = "sem valor no conjunto" if x["ccee_mil_rs"] is None else f"{_br(x['ccee_mil_rs'], 1)} mil R$ no conjunto"
        return f"{x['mes']}: {_br(x['mme_mil_rs'], 0)} mil R$ no boletim do MME, {ccee}"
    ccee = "sem valor no conjunto" if x["calculado"] is None else f"R$ {_br(x['calculado'], 2)} milhões no conjunto"
    return f"{x['mes']}: R$ {_br(x['publicado'], 2)} milhões no InfoMercado, {ccee}"


def paineis(g):
    """Estado de cada painel com a verificação do critério de aceite do Anexo A, calculado a
    partir da própria gold (sem estado escrito à mão)."""
    lr, am_, mg, en = g["livre_regulado"], g["agentes_migracao"], g["mre_gsf"], g["encargos"]
    rec_plan = lr["reconciliacao"]["epe_planilha"]
    ident = lr.get("ccee_identidade_classes") or []
    ident_ok = bool(ident) and all(x["ok"] for x in ident)
    carga = lr.get("carga_contexto") or []
    c032 = {"criterio": "ACL+ACR reconcilia com o universo escolhido, sem igualar automaticamente à carga do ONS.",
            "verificacoes": [
                {"nome": "EPE: soma das linhas da tabela longa = total nacional da planilha formatada, mês a mês",
                 "resultado": rec_plan["resultado"], "detalhe": f"{rec_plan['comparacoes']} comparações, {rec_plan['falhas']} acima da tolerância"},
                {"nome": "CCEE: soma das classes de agente = ACR + ACL do conjunto de ambiente (+ classe Varejista a partir de fevereiro de 2026)",
                 "resultado": "aprovado" if ident_ok else "ressalva",
                 "detalhe": f"{len(ident)} meses conferidos (tolerância de {_br(TOL_IDENTIDADE_CLASSES_MWMED, 0)} MW médios)"},
                {"nome": "Consumo na rede não é a carga: o MME publica a diferença como 'Perdas e Diferenças'",
                 "resultado": "aprovado" if carga else "ressalva",
                 "detalhe": "; ".join(f"{x['mes']}: consumo {_br(x['consumo_sobre_carga_pct'], 1)}% da carga" for x in carga[-3:]) or "sem edição do boletim"}]}
    agentes_ok = bool(am_["agentes_por_classe_mensal"]) and bool(lr["epe_mensal"]) and bool((am_.get("perfis") or {}).get("posicao"))
    c033 = {"criterio": "Sem chamar novos perfis de novas empresas; cancelamentos e migrações definidos.",
            "verificacoes": [
                {"nome": "Agente (CNPJ), perfil (código do perfil na CCEE) e unidade consumidora contados em séries separadas",
                 "resultado": "aprovado" if agentes_ok else "ressalva", "detalhe": "agentes por classe, perfis por classe e status, parcelas de carga e unidades consumidoras (EPE e SAMP)"},
                {"nome": "Entrada e saída de agente pelo CNPJ; desligamento pela lista oficial da CCEE (voluntário ou compulsório, com sucessão)",
                 "resultado": "aprovado" if am_["associados_fluxos"] and am_["desligamentos_anual"] else "ressalva",
                 "detalhe": f"{len(am_['associados_fluxos'])} meses de lista de associados; {len(am_['desligamentos_anual'])} combinações de ano, tipo e classe de desligamento"},
                {"nome": "Migração definida como parcela de carga com data de migração no mês de referência",
                 "resultado": "aprovado" if am_["parcelas_mensal"] else "ressalva", "detalhe": f"{len(am_['parcelas_mensal'])} meses"}]}
    g_im = [x for x in mg["reconciliacao_infomercado"] if x["medida"] == "gsf_pct"]
    c034 = {"criterio": "GSF reconciliado à publicação oficial; garantia física e geração não misturadas.",
            "verificacoes": [
                {"nome": "GSF calculado × fator publicado no InfoMercado mensal da CCEE",
                 "resultado": "aprovado" if g_im and all(x["resultado"] == "aprovado" for x in g_im) else "ressalva",
                 "detalhe": "; ".join(f"{x['mes']}: {_br(x['publicado'], 2)}% publicado, {_br(x['calculado'], 2)}% calculado" for x in g_im) or "sem edição conferida"},
                {"nome": "Garantia física (MWmed, CCEE) e geração (MWmed, CCEE) em colunas separadas; o GSF é razão de energias do mesmo perímetro",
                 "resultado": "aprovado", "detalhe": "geracao_mre_mwmed e gf_modulada_fdisp_mwmed publicados lado a lado"}]}
    im_enc = [x for x in en["reconciliacao_infomercado"]
              if x["medida"].startswith("encargos_") and x["medida"] != "encargos_resposta_demanda_milhoes_rs"]
    im_pag = [x for x in en["reconciliacao_infomercado"] if x["medida"] == "pagamento_ess_milhoes_rs"]
    rec_mme = [x for x in en["mme"]["reconciliacao_ccee"] if x["tipo"] != "resposta_demanda"]
    rd_div = [x for x in en["mme"]["reconciliacao_ccee"] if x["tipo"] == "resposta_demanda"] + \
             [x for x in en["reconciliacao_infomercado"] if x["medida"] == "encargos_resposta_demanda_milhoes_rs"]
    c035 = {"criterio": "Nenhuma série inventada de PPA ou curva a termo; preços privados permanecem fora do escopo aberto.",
            "verificacoes": [
                {"nome": "Nenhum preço de contrato, PPA ou curva a termo publicado; o PLD não é usado como preço contratual",
                 "resultado": "aprovado", "detalhe": "a gold só tem encargos, liquidação e resultado agregado do MCP publicados pela CCEE"},
                {"nome": "ESS do conjunto aberto × InfoMercado (por componente) e × boletim do MME (por tipo e mês)",
                 "resultado": "aprovado" if im_enc and all(x["resultado"] == "aprovado" for x in im_enc)
                 and all(x["resultado"] == "aprovado" for x in rec_mme if x["resultado"]) else "ressalva",
                 "detalhe": f"{sum(1 for x in im_enc if x['resultado'] == 'aprovado')} de {len(im_enc)} no InfoMercado; "
                            f"{sum(1 for x in rec_mme if x['resultado'] == 'aprovado')} de {sum(1 for x in rec_mme if x['resultado'])} no boletim do MME"},
                {"nome": "Competência, pagamento e reprocessamento separados",
                 "resultado": "aprovado", "detalhe": "encargos por mês de competência; pagamento e alívio em série própria; revisões entre edições do boletim e entre capturas"},
                {"nome": "Pagamento (total menos alívio, InfoMercado) × PAGAMENTO_ENCARGO_ESS + PAGAMENTO_ENCARGO_SE (divergência entre fontes, documentada)",
                 "resultado": "aprovado" if im_pag and all(x["resultado"] == "aprovado" for x in im_pag) else "ressalva", "essencial": False,
                 "detalhe": "; ".join(f"{x['mes']}: InfoMercado R$ {_br(x['publicado'], 2)} milhões, conjunto R$ {_br(x['calculado'], 2) if x['calculado'] is not None else 'sem valor'} milhões"
                                      for x in im_pag) or "sem edição conferida"},
                {"nome": "Resposta da demanda: conjunto RD_ENCARGOS_CONTAB_MENSAL × boletim do MME e InfoMercado (divergência entre fontes, documentada)",
                 "resultado": "aprovado" if rd_div and all(x["resultado"] == "aprovado" for x in rd_div) else "ressalva", "essencial": False,
                 "detalhe": "; ".join(_txt_rd(x) for x in rd_div if x["resultado"] != "aprovado") or "todas as conferências dentro da tolerância"}]}

    def estado(cr, resposta):
        """Concluído com limitação quando as verificações essenciais do critério de aceite
        passam; divergência documentada entre fontes (essencial=False) fica visível e não muda
        o estado."""
        if resposta is None:
            return "bloqueado"
        essenciais = [v for v in cr["verificacoes"] if v.setdefault("essencial", True)]
        return "concluido_com_limitacao" if all(v["resultado"] == "aprovado" for v in essenciais) else "parcial"

    defs = [
        ("P032", "Livre e regulado", "Como se distribui o consumo entre o mercado livre e o regulado?", resposta_p032(lr), c032,
         ["consumo_epe", "consumo_ccee", "distribuidoras_samp"],
         ["Três universos com perímetros diferentes (consumo na rede da EPE, consumo contabilizado da CCEE no centro de gravidade, mercado faturado das distribuidoras no SAMP): nenhum é igualado à carga do ONS.",
          "Os conjuntos abertos da CCEE começam em 2023; antes disso, só a EPE (desde 2004)."]),
        ("P033", "Agentes e migração", "Quem participa do mercado e como a composição mudou?", resposta_p033(am_), c033,
         ["agentes_ccee", "consumo_epe", "distribuidoras_samp"],
         ["O cadastro de perfis da CCEE é uma posição (sem histórico mensal); a lista de associados mês a mês começa em 2025.",
          "Saída da lista de associados não é sinônimo de desligamento (sucessão e mudança de CNPJ também tiram um CNPJ da lista)."]),
        ("P034", "MRE e GSF", "Como foi o ajuste da garantia física das hidrelétricas do MRE?", resposta_p034(mg), c034,
         ["gsf", "risco_hidrologico_acr"],
         ["O GSF é calculado com a razão que reproduz o fator publicado pela CCEE; a CCEE não o publica como coluna dos dados abertos.",
          "A série aberta começa em 2023; o painel não infere exposição financeira de nenhuma usina ou agente."]),
        ("P035", "Encargos e contabilização", "Quais custos públicos aparecem na liquidação do mercado de curto prazo?", resposta_p035(en), c035,
         ["encargos_ccee", "encargos_mme", "risco_hidrologico_acr"],
         ["Os encargos são valores de competência; o pagamento sai depois do alívio com recursos do mercado e aparece em série própria.",
          "A resposta da demanda entra no total do InfoMercado e do boletim do MME, mas não é coluna do conjunto aberto de encargos."]),
    ]
    out = []
    for pid, titulo, pergunta, resp, cr, prov, lim in defs:
        out.append({"id": pid, "titulo": titulo, "pergunta": pergunta, "resposta": resp, "estado": estado(cr, resp),
                    "criterio_aceite": cr["criterio"], "verificacoes": cr["verificacoes"], "proveniencia": prov, "limitacoes": lim})
    return out


def acesso_ccee(con):
    """Condição de acesso ao portal da CCEE registrada nas coletas: a última tentativa de cada
    conjunto e o cliente usado. O curl recebe HTTP 403 ('Acesso bloqueado') do firewall da
    origem; o cliente HTTP do pipeline (urllib, User-Agent do projeto, o mesmo da coleta do PLD
    no GitHub Actions) recebe as respostas. Nada é alterado para contornar bloqueio: se o portal
    recusar o cliente do pipeline, a falha fica registrada e a última captura válida segue."""
    linhas = con.execute("""SELECT dataset, MAX(tentado_em), SUM(ok), COUNT(*) FROM coletas
                            WHERE dataset LIKE 'ccee_%' GROUP BY dataset ORDER BY dataset""").fetchall()
    return {"cliente": "pipeline.common.http_get e http_download (urllib da biblioteca padrão, User-Agent do projeto)",
            "observacao": "Em 01/10/2026 (05h45 UTC), o curl recebeu HTTP 403 ('Acesso bloqueado') em dadosabertos.ccee.org.br; o cliente do pipeline recebeu HTTP 200 na mesma API (package_show). Nenhum cabeçalho foi trocado para se passar por navegador.",
            "conjuntos": [{"dataset": d, "ultima_tentativa": t, "tentativas_ok": int(ok or 0), "tentativas": n} for d, t, ok, n in linhas]}


def pendencias(con):
    """Fontes públicas acessíveis que responderiam a perguntas além das publicadas e ainda não
    foram integradas (trabalho a fazer, não bloqueio)."""
    pag = base.ultima_vintage(con, cm.DS_INFOMERCADO, "pagina-mercado-mensal")
    return [
        {"id": "infomercado_dados_gerais", "paineis": ["P032", "P034", "P035"],
         "descricao": "Planilhas 'InfoMercado Dados Gerais' da CCEE (uma por ano, de 2013 a maio de 2024), que estenderiam antes de 2023 as séries de consumo por ambiente, GSF e encargos.",
         "evidencia": {"url": cm.URL_MERCADO_MENSAL, "capturado_em": pag and pag["capturado_em"], "sha256": pag and pag["sha256"],
                       "observacao": "A página Mercado Mensal lista as planilhas (Dados Gerais e Dados Individuais) e a edição corrente do InfoMercado em PDF; os conjuntos abertos usados aqui começam em 2023."},
         "efeito": "GSF, consumo contabilizado por ambiente e encargos da CCEE não têm série anterior a 2023 neste observatório; o consumo cativo e livre da EPE cobre desde 2004 e o risco hidrológico do ACR (Conta Bandeira) desde 2015."},
        {"id": "historico_perfis", "paineis": ["P033"],
         "descricao": "Fluxo mensal de perfis (entradas e encerramentos): o cadastro LISTA_PERFIL_V1 é uma posição; o conjunto LISTA_PERFIL (2024 e 2025) traz o status no mês de referência e não foi integrado.",
         "evidencia": {"url": f"{cm.PORTAL}/dataset/lista_perfil", "observacao": "Metadados versionados em pipeline/energia/seed/ccee_mercado/."},
         "efeito": "O painel publica o estoque de perfis por classe e status, sem série mensal de entradas e saídas de perfis."},
    ]


def bloqueios(con, hoje):
    """Partes que dependem de fonte inacessível ou não publicada, com a evidência registrada no
    silver (captura, sha256) e as alternativas tentadas."""
    out = []
    ano_ant = hoje.year - 1
    v = base.ultima_vintage(con, DS_MME, f"pasta-{ano_ant}")
    links = None
    if v:
        with base.abre_bronze(v["arquivo"]) as f:
            links = len(mm.links_boletins(f.read().decode("utf-8", errors="replace"), v["url"]))
    out.append({
        "id": "boletim_mme_anos_anteriores", "paineis": ["P032", "P035"],
        "descricao": f"Edições do Boletim Mensal de Monitoramento do MME anteriores a {hoje.year} no formato atual (tabela de encargos por tipo e consumo por ambiente).",
        "evidencia": {"url": f"{URL_MME}/{ano_ant}", "capturado_em": v and v["capturado_em"], "sha256": v and v["sha256"],
                      "pdfs_encontrados": links,
                      "observacao": "A página índice do boletim lista as pastas de 2011 a 2022 e a de 2026; o endereço da pasta do ano anterior devolve uma página genérica do portal, sem nenhum PDF de boletim."},
        "alternativas": ["Conjunto ENCARGO_ESS_ANCILAR da CCEE (integrado: cobre de 2023 em diante)",
                         "Dados abertos de consumo mensal da EPE (integrados: cobrem de 2004 em diante)"],
        "efeito": "A série de encargos extraída do boletim cobre só as edições do ano corrente; a série principal de encargos vem da CCEE.",
    })
    return out


# ======================================================================= compactação da gold

ANOS_UF_NA_GOLD = 10
DISTRIBUIDORAS_NA_GOLD = 30
EPE_MENSAL_DESDE = "2015-01"   # antes disso, a gold traz a série anual; o CSV nacional tem todos os meses desde 2004
MESES_CONTA_BANDEIRA_NA_GOLD = 60


def _inteiro(v):
    return None if v is None else int(round(v))


def _arredonda_lista(linhas, campos_inteiros=(), sufixos_inteiros=()):
    for l in linhas:
        for k, v in list(l.items()):
            if isinstance(v, float) and (k in campos_inteiros or k.endswith(tuple(sufixos_inteiros))):
                l[k] = _inteiro(v)


def _compacta(g):
    """Mantém a gold perto de 400 KB (contrato, seção 1): energia em MWh e dinheiro em R$ inteiros
    nas séries de gráfico (o cálculo e a evidência usam o valor completo; os CSV têm as casas
    da fonte), sem duplicar a mesma série em duas seções, e com as tabelas longas recortadas no
    que a página mostra, apontando para o CSV completo."""
    lr, am_, mg, en = g["livre_regulado"], g["agentes_migracao"], g["mre_gsf"], g["encargos"]
    ucs = {x["mes"]: x["variacao_liquida"] for x in am_.pop("ucs_epe_mensal")}
    for l in lr["epe_mensal"]:
        l["variacao_livre_uc"] = ucs.get(l["mes"])
    lr["epe_mensal_desde"] = EPE_MENSAL_DESDE
    lr["epe_mensal"] = [l for l in lr["epe_mensal"] if l["mes"] >= EPE_MENSAL_DESDE]
    _arredonda_lista(lr["epe_mensal"], sufixos_inteiros=("_mwh", "_uc"))
    _arredonda_lista(lr["epe_anual"], sufixos_inteiros=("_mwh",))
    _arredonda_lista(lr["epe_classe_anual"], sufixos_inteiros=("_mwh",))
    for k in ("epe_subsistema_12m", "epe_regiao_12m", "epe_uf_12m"):
        _arredonda_lista(lr[k], sufixos_inteiros=("_mwh",))
    anos = sorted({x["ano"] for x in lr["epe_uf_anual"]})[-ANOS_UF_NA_GOLD:]
    lr["epe_uf_anual"] = [x for x in lr["epe_uf_anual"] if x["ano"] in anos]
    _arredonda_lista(lr["epe_uf_anual"], sufixos_inteiros=("_mwh",))
    lr["samp_nacional_mensal"] = [{k: x.get(k) for k in ("mes", "distribuidoras", "completo", "livre_mwh", "livre_uc", "cativo_mwh",
                                                       "cativo_uc", "livre_mwh_refat", "epe_livre_uc", "samp_sobre_epe_uc_pct")}
                                  for x in lr["samp_nacional_mensal"]]
    _arredonda_lista(lr["samp_nacional_mensal"], sufixos_inteiros=("_mwh", "_uc"))
    linhas = lr["distribuidoras"]["linhas"]
    lr["distribuidoras"] = {"ano": lr["distribuidoras"]["ano"], "total": len(linhas), "na_gold": min(len(linhas), DISTRIBUIDORAS_NA_GOLD),
                            "criterio": f"as {DISTRIBUIDORAS_NA_GOLD} maiores em energia livre faturada no ano; a tabela completa está no CSV",
                            "csv": _url(CSV_DISTRIB_ANO),
                            "linhas": [{k: v for k, v in x.items() if k != "nome"} for x in linhas[:DISTRIBUIDORAS_NA_GOLD]]}
    _arredonda_lista(lr["distribuidoras"]["linhas"], sufixos_inteiros=("_mwh",))
    _arredonda_lista(lr["comparacao_universos"], sufixos_inteiros=("_mwh",))
    _arredonda_lista(lr["ccee_mensal"], sufixos_inteiros=("_mwh",))
    am_["samp_ucs_livres_mensal"] = [{k: x.get(k) for k in ("mes", "completo", "livre_uc_incentivada", "livre_uc_convencional",
                                                         "livre_uc_autoproducao", "livre_uc_erc", "livre_uc_outro")}
                                     for x in am_["samp_ucs_livres_mensal"]]
    _arredonda_lista(am_["samp_ucs_livres_mensal"], sufixos_inteiros=("_incentivada", "_convencional", "_autoproducao", "_erc", "_outro"))
    _arredonda_lista(am_["parcelas_mensal"], sufixos_inteiros=("_mwh",))
    rh = mg["risco_hidrologico_acr"]
    rh["mensal_na_gold"] = f"últimos {MESES_CONTA_BANDEIRA_NA_GOLD} meses; a série anual cobre desde 2015 e o CSV tem todas as competências"
    rh["mensal"] = rh["mensal"][-MESES_CONTA_BANDEIRA_NA_GOLD:]
    _arredonda_lista(rh["mensal"], sufixos_inteiros=("rh_itaipu", "rh_repactuadas", "rh_ccgf", "previsao_rh", "premio_risco",
                                                     "rh_ccgf_repactuadas_liquido", "rh_bruto"))
    _arredonda_lista(rh["anual"], sufixos_inteiros=("rh_itaipu", "rh_repactuadas", "rh_ccgf", "previsao_rh", "premio_risco",
                                                    "rh_ccgf_repactuadas_liquido", "rh_bruto"))
    _arredonda_lista(mg["mensal"], campos_inteiros=("valor_alocado_mre_rs",))
    _arredonda_lista(en["ess_mensal"], sufixos_inteiros=tuple(COLUNAS_ESS.values()) + ("total", "restricao_operacao", "servicos_ancilares",
                                                                                      "resposta_demanda"))
    for k in ("eer_mensal", "pagamento_mensal", "liquidacao_mensal"):
        _arredonda_lista(en[k], sufixos_inteiros=("energia_reserva", "_coner", "_er", "_ess", "_energetica", "a_liquidar", "liquidado", "inadimplencia"))
    _arredonda_lista(en["mcp_submercado_mensal"], sufixos_inteiros=("_mwh", "_rs"))
    campos_cb = ("ess_eer", "ressarcimento_coner", "resultado_mcp", "ccear_d", "receita_faturada_bandeiras", "repasse_conta_bandeira")
    cb = en["acr_conta_bandeira_mensal"]
    anual = {}
    for x in cb:
        a = anual.setdefault(x["mes"][:4], {"ano": x["mes"][:4], "meses": 0, **{k: None for k in campos_cb}})
        a["meses"] += 1
        for k in campos_cb:
            if x.get(k) is not None:
                a[k] = (a[k] or 0.0) + x[k]
    en["acr_conta_bandeira_anual"] = [anual[a] for a in sorted(anual)]
    _arredonda_lista(en["acr_conta_bandeira_anual"], sufixos_inteiros=campos_cb)
    en["acr_conta_bandeira_mensal"] = cb[-MESES_CONTA_BANDEIRA_NA_GOLD:]
    _arredonda_lista(en["acr_conta_bandeira_mensal"], sufixos_inteiros=campos_cb)
    for l in en["ess_mensal"]:
        for col in DETALHE_OSA:
            l.pop(COLUNAS_ESS[col], None)
    for x in g["ccee_conjuntos"]:
        x.pop("colunas_esperadas", None)


def construir(con, ctx):
    hoje = ctx["hoje"]
    g = c.cabecalho(GOLD)
    ev = lambda **kw: evid.construir(reproducao=REPRODUCAO, **kw)  # noqa: E731
    try:
        livre = secao_livre_regulado(con, hoje, ev)
    except RuntimeError as e:
        return c.stub(GOLD, str(e))
    agentes = secao_agentes(con, livre, ev)
    mre = secao_mre(con, ev)
    enc = secao_encargos(con, ev)
    situacao = cm.situacao(con)
    g["referencias"] = {"hoje": hoje.isoformat(), "epe_ultimo_mes": livre["epe_ultimo_mes"],
                        "ccee_ultimo_mes_consumo": (livre["ccee_mensal"] or [{}])[-1].get("mes"),
                        "ccee_ultimo_mes_gsf": mre["submercados_ultimo_mes"]["mes"],
                        "samp_ano_referencia": livre["samp"]["ano_referencia"]}
    g["definicoes"] = DEFINICOES
    g["livre_regulado"] = {k: v for k, v in livre.items() if not k.startswith("_") and k != "samp"}
    g["livre_regulado"]["distribuidoras"] = {"ano": livre["samp"]["ano_referencia"], "linhas": livre["samp"]["distribuidoras"]}
    g["livre_regulado"]["samp_nacional_mensal"] = [{k: (c.r(v, 1) if isinstance(v, float) and k.endswith("mwh") else v) for k, v in x.items()}
                                                   for x in livre["samp"]["nacional_mensal"]]
    g["agentes_migracao"] = agentes
    g["mre_gsf"] = mre
    g["encargos"] = enc
    g["ccee_conjuntos"] = situacao
    crit, ress = _valida(g)
    if crit:
        return c.stub(GOLD, "validação física falhou: " + "; ".join(crit[:5]))
    g["ressalvas_validacao"] = ress
    _compacta(g)

    # ---------------- proveniência
    snap_epe = _snap(con, DS_EPE, DS_EPE_PLAN)
    snap_samp = c.snapshot_de(con, DS_SAMP)
    snap_cb = c.snapshot_de(con, DS_CB)
    snap_mme = c.snapshot_de(con, DS_MME)
    snap_ccee_cons = _snap(con, *(cm.dataset(n) for n in ("consumo_mensal_ambiente_comercializacao", "consumo_classe_agente")))
    snap_ccee_ag = _snap(con, *(cm.dataset(n) for n in ("agente_qtd_contabilizacao", "lista_agente_associado", "lista_perfil_v1",
                                                        "desligamento_voluntario", "desligamento_compulsorio", "parcela_carga_consumo")))
    snap_ccee_mre = _snap(con, *(cm.dataset(n) for n in ("geracao_submercado", "garantia_fisica_sazo_mre_submercado", "mre_mensal")))
    snap_ccee_enc = _snap(con, *(cm.dataset(n) for n in ("encargo_ess_ancilar", "rd_encargos_contab_mensal", "reserva_encargo", "encargo_pgto_mensal",
                                                         "sumario_mensal_compra_venda_submercado", "sumario_mensal_liquidacao")))
    epe_mes = livre["epe_mensal"]
    per_epe = {"inicio": epe_mes[0]["mes"], "fim": epe_mes[-1]["mes"]}
    ccee_cons = livre["ccee_mensal"]
    per_ccee = {"inicio": ccee_cons[0]["mes"], "fim": ccee_cons[-1]["mes"]} if ccee_cons else per_epe
    fonte_ccee = lambda conj, rec: _fonte("CCEE", conj, rec, f"{cm.PORTAL}/dataset/{conj.split(' ')[0].lower()}", f"{cm.PORTAL}/dataset/{conj.split(' ')[0].lower()}", cm.LICENCA)  # noqa: E731
    lim_ccee = ["Os conjuntos abertos da CCEE começam em 2023 (a maioria em maio de 2023); antes disso a série não existe neste formato.",
                "O portal da CCEE respondeu HTTP 403 ('Acesso bloqueado') ao curl e respondeu ao cliente HTTP do pipeline em 01/10/2026; se recusar numa execução, a última captura válida continua publicada e a falha fica registrada.",
                "Dados da contabilização podem ser recontabilizados pela CCEE; revisões entre capturas ficam registradas."]
    g["proveniencia"] = {
        "consumo_epe": c.proveniencia(
            indicador="Consumo de energia elétrica na rede por ambiente (cativo e livre)", natureza="OBSERVADO",
            fonte=_fonte("EPE", "Consumo mensal de energia elétrica (dados abertos)", f"{RECURSO_EPE_DA}, tabelas CONSUMO E NUMCONS SAM e SAM UF",
                         URL_EPE_PAGINA, URL_EPE_DA, LICENCA_EPE),
            unidade="MWh e unidades consumidoras", frequencia="mensal", periodo=per_epe, cobertura=per_epe,
            capturado_em=c.ultima_captura(snap_epe), snapshot=snap_epe, download=_url(CSV_NACIONAL),
            transformacoes=["soma das linhas por região, subsistema, classe e tipo de consumidor", "participação do livre = 100 × Σ livre ÷ Σ (cativo + livre) de cada período"],
            formula="livre_pct = 100 × consumo livre ÷ (consumo cativo + consumo livre)",
            limitacoes=["É o consumo na rede: não inclui autoprodução sem uso da rede nem perdas; não é a carga do ONS (o MME publica a diferença como 'Perdas e Diferenças').",
                        "Dados do ano corrente são preliminares pela EPE e podem ser revisados; a tabela por UF vai só até o penúltimo mês.",
                        "Livre inclui consumidores livres e especiais e autoprodutores que compram no ACL; a fonte não separa as categorias."]),
        "consumo_ccee": c.proveniencia(
            indicador="Consumo contabilizado no mercado de curto prazo por ambiente (ACR e ACL)", natureza="OBSERVADO",
            fonte=fonte_ccee("consumo_classe_agente", "consumo_classe_agente_AAAA e consumo_mensal_ambiente_comercializacao_AAAA (CSV anuais)"),
            unidade="MWmed (MWh = MWmed × horas do mês)", frequencia="mensal (publicação no mês seguinte + 22 dias úteis)", periodo=per_ccee, cobertura=per_ccee,
            capturado_em=c.ultima_captura(snap_ccee_cons), snapshot=snap_ccee_cons, download=_url(CSV_CCEE),
            transformacoes=["ACR = consumo da classe Distribuidor; ACL = soma das demais classes de CONSUMO_CLASSE_AGENTE",
                            "MWmed × horas do mês civil = MWh", "participação do ACL = razão das somas em MWh",
                            "conferido mês a mês com CONSUMO_MENSAL_AMBIENTE_COMERCIALIZACAO (Σ classes = ACR + ACL publicado, mais a classe Varejista a partir de fevereiro de 2026)"],
            formula="acl_pct = 100 × Σ(ACL × horas) ÷ Σ((ACR + ACL) × horas)",
            limitacoes=lim_ccee + ["Consumo referido ao centro de gravidade (com perdas da rede básica rateadas): é maior que o consumo medido no ponto de conexão e não é comparável ao da EPE sem esse ajuste.",
                                   "Quebra na fonte em fevereiro de 2026: a classe Comercializador deu lugar à Varejista e o conjunto de ambiente deixou de contar a Varejista no ACL; a série do observatório soma o ACL pelas classes e publica o valor do conjunto de ambiente ao lado."]),
        "distribuidoras_samp": c.proveniencia(
            indicador="Mercado livre e cativo faturado por distribuidora", natureza="OBSERVADO",
            fonte=_fonte("ANEEL", "SAMP: Sistema de Acompanhamento de Informações de Mercado para Regulação Econômica",
                         f"samp-{ANO_INICIAL_SAMP}.parquet a samp-{hoje.year}.parquet (Parquet oficial equivalente ao CSV)", URL_SAMP, URL_SAMP, LICENCA_ANEEL),
            unidade="MWh e unidades consumidoras", frequencia="mensal", periodo={"inicio": f"{ANO_INICIAL_SAMP}-01", "fim": livre["samp"]["nacional_mensal"][-1]["mes"]},
            cobertura={"inicio": f"{ANO_INICIAL_SAMP}-01", "fim": livre["samp"]["nacional_mensal"][-1]["mes"]}, capturado_em=c.ultima_captura(snap_samp),
            snapshot=snap_samp, download=_url(CSV_DISTRIB),
            transformacoes=["kWh ÷ 1.000 = MWh", "livre: Energia TUSD; cativo: Energia TE; unidades: Número de consumidores; só tipos de mercado da competência (refaturamento à parte)"],
            formula="livre_pct_faturada = 100 × energia livre ÷ (energia livre + energia cativa faturada) do ano",
            limitacoes=["Só o que cada distribuidora fatura na sua rede: consumidor livre ligado direto à rede básica não aparece.",
                        "A energia cativa faturada de quem tem micro ou minigeração é a líquida da compensação.",
                        "Refaturamento (correção de meses anteriores) não tem a competência original na fonte e fica em coluna própria.",
                        "'Fonte incentivada' inclui os consumidores especiais, mas a fonte não separa especial de livre com desconto; 'ERC' não é definido no dicionário."]),
        "agentes_ccee": c.proveniencia(
            indicador="Agentes, perfis, parcelas de carga, entradas, saídas e desligamentos na CCEE", natureza="OBSERVADO",
            fonte=fonte_ccee("agente_qtd_contabilizacao", "agente_qtd_contabilizacao, lista_agente_associado, lista_perfil_v1, desligamento_voluntario, desligamento_compulsorio, parcela_carga_consumo"),
            unidade="agentes, perfis, parcelas de carga", frequencia="mensal", periodo=per_ccee, cobertura=per_ccee,
            capturado_em=c.ultima_captura(snap_ccee_ag), snapshot=snap_ccee_ag, download=_url(CSV_CCEE),
            transformacoes=["contagens de códigos distintos por mês", "entradas e saídas de CNPJ entre meses consecutivos da lista de associados",
                            "migrações = parcelas com data de migração no próprio mês de referência"],
            formula="entradas_m = |CNPJ_m − CNPJ_{m−1}|; saídas_m = |CNPJ_{m−1} − CNPJ_m|",
            limitacoes=lim_ccee + ["A lista de associados mês a mês só existe a partir de outubro de 2025; o cadastro de perfis é uma posição (sem histórico mensal).",
                                   "Saída da lista de associados não é sinônimo de desligamento: sucessão e mudança de CNPJ também tiram um CNPJ da lista.",
                                   "Parcela de carga não é unidade consumidora: uma parcela pode reunir várias UCs."]),
        "gsf": c.proveniencia(
            indicador="Fator de ajuste do MRE (GSF)", natureza="CALCULADO",
            fonte=fonte_ccee("mre_mensal", "geracao_submercado_AAAA, mre_mensal_AAAA e garantia_fisica_sazo_mre_submercado_AAAA"),
            unidade="%", frequencia="mensal", periodo={"inicio": mre["mensal"][0]["mes"], "fim": mre["mensal"][-1]["mes"]} if mre["mensal"] else per_ccee,
            cobertura={"inicio": mre["mensal"][0]["mes"], "fim": mre["mensal"][-1]["mes"]} if mre["mensal"] else per_ccee,
            capturado_em=c.ultima_captura(snap_ccee_mre), snapshot=snap_ccee_mre, download=_url(CSV_CCEE),
            formula="GSF = 100 × Σ GERACAO_MRE (4 submercados) ÷ GARANTIA_FISICA_MODULADA_FDISP; período = razão das somas em MWh",
            transformacoes=["conferido contra o fator publicado no InfoMercado mensal da CCEE em cada edição capturada (ver reconciliacao_infomercado)"],
            limitacoes=lim_ccee + ["A CCEE não publica o GSF como coluna nos dados abertos; o observatório calcula com a mesma razão que reproduz o valor publicado no InfoMercado.",
                                   "O GSF é do MRE inteiro; a razão por submercado não é publicada e não é calculada.",
                                   "O painel não infere exposição financeira de nenhuma usina ou agente."]),
        "risco_hidrologico_acr": c.proveniencia(
            indicador="Custo do risco hidrológico alocado às distribuidoras", natureza="OBSERVADO",
            fonte=_fonte("ANEEL", "Bandeiras Tarifárias", "Bandeira Tarifária - Conta Bandeira (CSV)", URL_BAND, URL_BAND, LICENCA_ANEEL),
            unidade="R$ nominais", frequencia="mensal (competência)", periodo={"inicio": mre["risco_hidrologico_acr"]["mensal"][0]["mes"], "fim": mre["risco_hidrologico_acr"]["mensal"][-1]["mes"]} if mre["risco_hidrologico_acr"]["mensal"] else per_epe,
            cobertura={"inicio": "2015-01", "fim": mre["risco_hidrologico_acr"]["mensal"][-1]["mes"]} if mre["risco_hidrologico_acr"]["mensal"] else per_epe,
            capturado_em=c.ultima_captura(snap_cb), snapshot=snap_cb, download=_url(CSV_CB),
            transformacoes=["soma nacional por competência de todas as linhas (inclusive sem CNPJ)", "linhas repetidas da mesma distribuidora e competência são somadas e contadas"],
            limitacoes=["Valores apurados pela CCEE e publicados pela ANEEL; a ANEEL não informa a data de cada atualização.",
                        "É o risco que cabe ao mercado regulado (cotas, repactuadas, Itaipu), não o resultado das usinas.",
                        "Valores nominais; previsão de risco na tarifa e prêmio de risco têm sinal negativo no arquivo e são publicados em separado."]),
        "encargos_ccee": c.proveniencia(
            indicador="Encargos de serviços do sistema, energia de reserva, liquidação e resultado do MCP", natureza="OBSERVADO",
            fonte=fonte_ccee("encargo_ess_ancilar", "encargo_ess_ancilar, reserva_encargo, encargo_pgto_mensal, sumario_mensal_compra_venda_submercado, sumario_mensal_liquidacao"),
            unidade="R$ nominais e MWh", frequencia="mensal", periodo=per_ccee, cobertura=per_ccee,
            capturado_em=c.ultima_captura(snap_ccee_enc), snapshot=snap_ccee_enc, download=_url(CSV_CCEE),
            transformacoes=["somas mensais por tipo de encargo; agregados anuais e de 12 meses = soma dos meses"],
            limitacoes=lim_ccee + ["Competência (mês de referência), pagamento (liquidação) e alívio do ESS são grandezas diferentes e são publicadas separadas."]),
        "encargos_mme": c.proveniencia(
            indicador="Encargos de serviços do sistema por tipo, Boletim Mensal do MME", natureza="OBSERVADO",
            fonte=_fonte("MME", "Boletim Mensal de Monitoramento do Sistema Elétrico", "PDF de cada edição de 2026 (tabela 'Encargos de Serviços de Sistema')", URL_MME, f"{URL_MME}/{hoje.year}", LICENCA_MME),
            unidade="mil R$ nominais", frequencia="mensal (edição)", periodo={"inicio": f"{hoje.year}-01", "fim": max((x["mes"] for x in enc["mme"]["vigente"]), default=f"{hoje.year}-01")},
            cobertura={"inicio": f"{hoje.year}-01", "fim": max((x["mes"] for x in enc["mme"]["vigente"]), default=f"{hoje.year}-01")},
            capturado_em=c.ultima_captura(snap_mme), snapshot=snap_mme, download=_url(CSV_ESS),
            transformacoes=["extração do texto do PDF (pdftotext -layout) e conferência das somas de cada mês", "vale a edição mais recente de cada mês; revisões entre edições publicadas"],
            limitacoes=["As edições de 2025 e anteriores do novo formato não estão acessíveis no portal (o endereço devolve página HTML em vez do PDF em 01/10/2026); só as de 2026 foram integradas.",
                        "Traço na tabela é lido como zero só porque a soma do mês fecha com ele."]),
    }
    g["fontes"] = [{"orgao": d["orgao"], "conjunto": d["nome"], "titulo": d["titulo"], "url": d["url"], "licenca": d["licenca"],
                    "dataset_silver": d["dataset_silver"]} for d in REGISTRO["datasets"]]
    g["paineis"] = paineis(g)
    g["bloqueios"] = bloqueios(con, hoje)
    g["pendencias"] = pendencias(con)
    g["acesso_ccee"] = acesso_ccee(con)
    _csvs(livre, agentes, mre, enc, con)
    base.escreve_csv(CSV_DISTRIB_ANO, ["ano", "cnpj", "sigla", "nome", "meses", "completo", "livre_mwh", "cativo_mwh", "livre_pct_faturada",
                                       "livre_uc_dez", "livre_uc_dez_anterior", "variacao_livre_uc", "livre_uc_incentivada_dez",
                                       "livre_uc_convencional_dez", "livre_uc_autoproducao_dez", "cativo_uc_dez"],
                     [[livre["samp"]["ano_referencia"], x["cnpj"], x["sigla"], x["nome"], x["meses"], 1 if x["completo"] else 0, x["livre_mwh"],
                       x["cativo_mwh"], x["livre_pct_faturada"], x["livre_uc_dez"], x["livre_uc_dez_anterior"], x["variacao_livre_uc"],
                       x["livre_uc_incentivada_dez"], x["livre_uc_convencional_dez"], x["livre_uc_autoproducao_dez"], x["cativo_uc_dez"]]
                      for x in livre["samp"]["distribuidoras"]])
    return g
