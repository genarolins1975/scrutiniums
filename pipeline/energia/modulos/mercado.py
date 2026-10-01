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
         "downloads": [_url(CSV_DISTRIB)], "quebras": []},
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
        *[{"orgao": "CCEE", "nome": t.get("conjunto") or f"busca:{'+'.join(t['busca'])}", "slug": f"ccee-{t['id'].replace('_', '-')}",
           "dataset_silver": t["dataset"], "titulo": t["titulo"], "estado": "EM INTEGRAÇÃO",
           "url": f"{cm.PORTAL}/dataset/{t['conjunto']}" if t.get("conjunto") else cm.PORTAL, "licenca": cm.LICENCA,
           "paginas": PAGINA, "downloads": [], "quebras": []} for t in cm.TEMAS],
    ],
    "arquivos": {
        _url(CSV_CONSUMO): "mes (AAAA-MM); regiao (geográfica); subsistema (SE, S, NE, N ou ISOL = sistemas isolados); classe (Residencial, Industrial, Comercial, Rural, Outros); tipo (cativo ou livre); consumo_mwh (consumo de energia elétrica na rede, MWh, como publicado pela EPE); unidades_consumidoras (número de UCs no mês). Fonte: EPE, dados abertos do consumo mensal (tabela CONSUMO E NUMCONS SAM). Vazio = a fonte não publicou o valor; zero é zero.",
        _url(CSV_CONSUMO_UF): "mes; uf; subsistema; classe; tipo; consumo_mwh; unidades_consumidoras. Fonte: EPE, tabela CONSUMO E NUMCONS SAM UF (até o penúltimo mês publicado). Vazio = ausência.",
        _url(CSV_NACIONAL): "mes; cativo_mwh; livre_mwh; total_mwh (soma das linhas da EPE); livre_pct (100 × livre ÷ total); cativo_uc; livre_uc; total_planilha_mwh e livre_planilha_mwh (total nacional da planilha formatada da EPE, para conferência); diferenca_total_mwh (tabela longa − planilha); preliminar (1 = ano marcado como preliminar pela EPE); samp_livre_uc e samp_livre_mwh (soma das distribuidoras no SAMP da ANEEL: só consumidores livres faturados por distribuidora); samp_distribuidoras (quantas distribuidoras publicaram o mês). Vazio = ausência.",
        _url(CSV_DISTRIB): "cnpj (14 dígitos, da fonte); sigla; mes; livre_mwh (energia TUSD faturada a consumidores livres, MWh, tipos de mercado da competência); livre_mwh_incentivada, livre_mwh_autoproducao, livre_mwh_erc, livre_mwh_convencional, livre_mwh_outro (abertura pela característica do consumidor no SAMP); livre_uc e as mesmas aberturas em unidades consumidoras; livre_mwh_refat (refaturamento de meses anteriores apresentado neste mês, sem atribuição de competência); cativo_mwh (energia TE faturada ao cativo, inclui consumidores com micro e minigeração após a compensação); cativo_uc; cativo_mwh_refat. Fonte: ANEEL, SAMP, arquivos anuais em Parquet. Vazio = a distribuidora não publicou a linha no mês.",
        _url(CSV_CB): "cnpj (vazio quando a fonte não identifica a distribuidora); sigla; mes (competência); campos em R$ como publicados: receita_faturada, repasse_conta_bandeira, resultado_mcp, ccear_d, rh_ccgf_repactuadas_liquido, rh_itaipu, rh_repactuadas, rh_ccgf, previsao_rh, premio_risco, ess_eer, ressarcimento_coner; linhas (quantas linhas da fonte foram somadas na mesma distribuidora e competência). Fonte: ANEEL, Bandeiras Tarifárias, recurso Conta Bandeira; os custos são os apurados e informados pela CCEE. Vazio = ausência.",
        _url(CSV_ESS): "edicao (mês de referência do boletim, AAAA-MM); mes (competência, AAAA-MM); tipo (id do encargo); rotulo; nivel (tipo, parcela ou total); valor_mil_rs (mil R$ como publicados); traco (1 = a tabela publicou '-', lido como zero porque a soma do mês fecha); vigente (1 = edição mais recente para o mês). Fonte: MME, Boletim Mensal de Monitoramento do Sistema Elétrico (dados da CCEE).",
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
