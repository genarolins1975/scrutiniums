"""Módulo Empresas: cadastro e ativos, perfil da distribuidora, finanças e controle
(painéis P036 a P039, seção 9.8 da especificação).

O que o módulo publica:
- P036, cadastro e ativos: as pessoas jurídicas do Cadastro Institucional de Agentes da
  ANEEL (CNPJ, sigla, ramos) e as usinas do SIGA com o núcleo do CEG, a potência e os
  proprietários com CNPJ, participação e regime lidos do próprio SIGA; o percentual de
  cobertura dos vínculos (usinas e potência) e cada usina sem vínculo completo identificada
  pelo motivo. O vínculo é sempre o CNPJ publicado pela fonte; nenhum por nome. O conjunto
  Agentes de Geração da ANEEL (mesma relação, em colunas, com data mensal) serve de
  conferência independente, usina a usina.
- P037, perfil da distribuidora: índice das distribuidoras (CNPJ, sigla, nome, UFs,
  concessionária ou permissionária, slug estável para a URL) formado pelos CNPJ presentes
  nas bases reguladas já integradas pelos módulos Perdas (SAMP), Qualidade (continuidade) e
  Conta de luz (tarifas), com os números de cada módulo lidos da gold de origem pelo mesmo
  CNPJ (mesma consulta, sem recálculo), o controlador declarado à ANEEL e o registro na CVM.
- P038, finanças: demonstrações padronizadas da CVM (DFP anual e ITR trimestral) das
  companhias abertas do setor elétrico, com consolidado e individual em séries separadas,
  contas fixas do plano da CVM, maior versão de cada documento e reapresentações detectadas.
  Nada é somado entre companhias (controladora e controlada nunca na mesma soma); a cobertura
  é a das companhias abertas, não a do setor.
- P039, controle e concentração: capacidade proporcional à participação e capacidade sob
  controle como medidas distintas, por proprietário direto (SIGA) e por grupo (cadeia de
  controladores únicos declarada à ANEEL na Composição Societária, Polímero), com o índice
  Herfindahl-Hirschman e as razões de concentração sobre uma fronteira explícita (usinas em
  operação no SIGA com participações válidas, Brasil, data do SIGA).

O que o módulo não publica, e por quê (detalhe no documento do módulo): demonstrações
regulatórias da ANEEL (BMP e base de sustentabilidade econômico-financeira, servidas por
git.aneel.gov.br, que responde com desafio do Cloudflare, e por informacoesbmp.aneel.gov.br,
indisponível); EBITDA (decisão de método: a DFP/ITR não tem a conta e o módulo não lê a DVA, onde
está a depreciação; ver DECISOES_METODO); vínculo de ativos de transmissão
a CNPJ (o SIGET publica contratos sem CNPJ); participação econômica indireta (look-through)
dos grupos.
"""
import collections
import email.utils
import hashlib
import json
import os
import shutil
import sqlite3
import sys
import tempfile
import urllib.request
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.common import USER_AGENT  # noqa: E402
from pipeline.energia import base, entidades  # noqa: E402
from pipeline.energia import evidencia as evid  # noqa: E402
from pipeline.energia.fontes import aneel_empresas as ae  # noqa: E402
from pipeline.energia.fontes import ckan  # noqa: E402
from pipeline.energia.fontes import cvm_empresas as cv  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

GOLD = "empresas.json"
FAMILIA = "empresas"

DS_AGENTES = "aneel_agentes_setor"
DS_AGGER = "aneel_agentes_geracao"
DS_SIGA = "aneel_siga"
DS_POLIMERO = "aneel_polimero"
DS_CVM_CAD = "cvm_cad_cia_aberta"
DS_DFP = "cvm_dfp"
DS_ITR = "cvm_itr"

REC_SIGA = "siga-empreendimentos-geracao-diario.csv"
REC_AGENTES = "agentes-setor-eletrico"
REC_AGGER = "agentes-geracao-energia-eletrica"
REC_POLIMERO = "composicao-societaria-polimero.parquet"
REC_CVM_CAD = "cad_cia_aberta.csv"

LICENCA_ANEEL = "Open Data Commons Open Database License (ODbL)"
LICENCA_CVM = "Licença Aberta para Bases de Dados (ODbL) do Open Data Commons, conforme o portal de dados abertos da CVM"
URL_AGENTES = "https://dadosabertos.aneel.gov.br/dataset/agentes-do-setor-eletrico"
URL_AGGER = "https://dadosabertos.aneel.gov.br/dataset/agentes-de-geracao-de-energia-eletrica"
URL_SIGA = "https://dadosabertos.aneel.gov.br/dataset/siga-sistema-de-informacoes-de-geracao-da-aneel"
URL_POLIMERO = "https://dadosabertos.aneel.gov.br/dataset/composicao-societaria-polimero"
URL_CVM = "https://dados.cvm.gov.br"
URL_CVM_CAD = f"{URL_CVM}/dados/CIA_ABERTA/CAD/DADOS/cad_cia_aberta.csv"
URL_CVM_CAD_DS = f"{URL_CVM}/dataset/cia_aberta-cad"
URL_DFP_DS = f"{URL_CVM}/dataset/cia_aberta-doc-dfp"
URL_ITR_DS = f"{URL_CVM}/dataset/cia_aberta-doc-itr"
# Primeiro ano publicado pela CVM em cada formulário (listagem de
# https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/DFP/DADOS/ e .../ITR/DADOS/ em 30/09/2026). O
# ITR começa em 2011; o módulo integra os últimos seis anos, o mesmo recorte que o catálogo
# CKAN da CVM lista (a série anual vem do DFP desde 2010).
PRIMEIRO_ANO_DFP = 2010
ANOS_ITR = 6

PAGINAS = [{"rotulo": "Empresas", "href": "/setor-eletrico/empresas"}]
REPRODUCAO = "python3 pipeline/energia/executar_modulo.py empresas --sem-coleta"

CSV_AGENTES = "empresas_agentes.csv"
CSV_ATIVOS = "empresas_ativos.csv"
CSV_PROPRIETARIOS = "empresas_proprietarios.csv"
CSV_GRUPOS = "empresas_grupos.csv"
CSV_CADEIA = "empresas_cadeia_societaria.csv"
CSV_DISTRIBUIDORAS = "empresas_distribuidoras.csv"
CSV_FINANCAS = "empresas_financas_anual.csv"
CSV_FINANCAS_TRIM = "empresas_financas_trimestral.csv"
CSV_COMPANHIAS = "empresas_companhias_cvm.csv"
JSON_FINANCAS = "empresas_financas.json"
JSON_ATIVOS = "empresas_ativos.json"
JSON_CADEIA = "empresas_cadeia.json"
JSON_EVID = "empresas_evidencias.json"


def _url(nome):
    return f"/energia/series/{nome}"


REGISTRO = {
    "id": "empresas", "gold": GOLD, "familia": FAMILIA, "ordem": 60,
    "datasets": [
        {"orgao": "ANEEL", "nome": "agentes-do-setor-eletrico", "slug": "aneel-agentes-setor-eletrico",
         "dataset_silver": DS_AGENTES, "titulo": "Cadastro Institucional de Agentes do Setor Elétrico",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_AGENTES, "licenca": LICENCA_ANEEL, "paginas": PAGINAS,
         "downloads": [_url(CSV_AGENTES)], "quebras": []},
        {"orgao": "ANEEL", "nome": "siga-sistema-de-informacoes-de-geracao-da-aneel", "slug": "aneel-siga",
         "dataset_silver": DS_SIGA, "titulo": "SIGA: usinas, potência e proprietários com participação e regime",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_SIGA, "licenca": LICENCA_ANEEL, "paginas": PAGINAS,
         "downloads": [_url(CSV_ATIVOS), _url(CSV_PROPRIETARIOS), _url(JSON_ATIVOS)], "quebras": []},
        {"orgao": "ANEEL", "nome": "agentes-de-geracao-de-energia-eletrica", "slug": "aneel-agentes-geracao",
         "dataset_silver": DS_AGGER, "titulo": "Agentes de Geração: usina, CNPJ, participação e regime (conferência)",
         "estado": "UTILIZADO EM VALIDAÇÃO", "url": URL_AGGER, "licenca": LICENCA_ANEEL, "paginas": PAGINAS,
         "downloads": [_url(CSV_ATIVOS)], "quebras": []},
        {"orgao": "ANEEL", "nome": "composicao-societaria-polimero", "slug": "aneel-composicao-societaria",
         "dataset_silver": DS_POLIMERO, "titulo": "Composição Societária (Polímero): árvores de controle declaradas",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_POLIMERO, "licenca": LICENCA_ANEEL, "paginas": PAGINAS,
         "downloads": [_url(CSV_CADEIA), _url(CSV_GRUPOS), _url(JSON_CADEIA)], "quebras": [
             {"data": "2020-07-01", "descricao": "Salto no número de agentes declarantes distintos por trimestre na própria base: 14 no 2º trimestre de 2020, 162 no 3º e 1.117 no 4º (de 9 a 14 por trimestre entre 2018 e o 2º trimestre de 2020; cerca de 3 mil a partir de 2025). Antes do salto a base cobre poucos agentes e não serve para comparar a estrutura de controle do setor."}]},
        {"orgao": "CVM", "nome": "cia_aberta-cad", "slug": "cvm-cadastro-companhias-abertas",
         "dataset_silver": DS_CVM_CAD, "titulo": "CVM: cadastro de companhias abertas",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_CVM_CAD_DS, "licenca": LICENCA_CVM, "paginas": PAGINAS,
         "downloads": [_url(CSV_COMPANHIAS)], "quebras": []},
        {"orgao": "CVM", "nome": "cia_aberta-doc-dfp", "slug": "cvm-dfp",
         "dataset_silver": DS_DFP, "titulo": "CVM: Demonstrações Financeiras Padronizadas (DFP)",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_DFP_DS, "licenca": LICENCA_CVM, "paginas": PAGINAS,
         "downloads": [_url(CSV_FINANCAS), _url(JSON_FINANCAS)], "quebras": []},
        {"orgao": "CVM", "nome": "cia_aberta-doc-itr", "slug": "cvm-itr",
         "dataset_silver": DS_ITR, "titulo": "CVM: Informações Trimestrais (ITR)",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_ITR_DS, "licenca": LICENCA_CVM, "paginas": PAGINAS,
         "downloads": [_url(CSV_FINANCAS_TRIM), _url(JSON_FINANCAS)], "quebras": []},
    ],
    "arquivos": {
        _url(CSV_AGENTES): "cnpj (14 dígitos); sigla; razao_social; ativo (1 = situação A no cadastro); comercializacao; distribuicao; geracao; transmissao (1 = ramo declarado ativo no cadastro, autodeclarado: não define distribuidora); proprietario_siga (1 = aparece como proprietário de usina no SIGA); distribuidora_regulada (1 = está no índice de distribuidoras do módulo); cvm_cd (código CVM quando é companhia aberta). Um CNPJ por linha, data do cadastro na coluna data_cadastro.",
        _url(CSV_ATIVOS): "Uma linha por usina e proprietário do SIGA: nucleo_ceg; ceg; usina; tipo (SigTipoGeracao); fase; uf; kw_outorgado; kw_fiscalizado (vazio = não informado); estado_vinculo (vinculado, inclui_sem_documento, soma_divergente, sem_proprietario); soma_pct (soma das participações publicadas); proprietario_cnpj (vazio = proprietário sem CNPJ, pessoa física cujo nome não é republicado aqui); proprietario_nome (só para CNPJ); pct (participação publicada, %); regime (PIE, APE, SP ou REG); controle_majoritario (1 = participação acima de 50% numa usina com soma válida); grupo_cnpj (topo da cadeia de controladores únicos declarada no Polímero; igual ao proprietário quando não há controlador único); conferencia_agentes (igual, cnpj_diferente, percentual_diferente, ausente_em_agentes, sem_proprietario_no_siga). Potência em kW como publicada.",
        _url(CSV_PROPRIETARIOS): "Um CNPJ por linha (proprietário direto no SIGA): cnpj; nome; no_cadastro_agentes (1/0); usinas (todas as fases); usinas_operacao; mw_bruto_operacao (potência fiscalizada somada das usinas em operação em que tem qualquer participação; soma bruta, não usar em agregados); mw_proporcional (Σ potência fiscalizada × participação, só usinas em operação com soma válida); mw_controle_direto (Σ potência das usinas em operação em que tem mais de 50%); usinas_controle_direto (usinas em operação com potência fiscalizada em que tem mais de 50%: mesmo critério de mw_controle_direto); grupo_cnpj; grupo_nome; regimes. MW = kW ÷ 1.000.",
        _url(CSV_GRUPOS): "Um grupo por linha (topo de cadeia de controle): grupo_cnpj; nome; empresas_com_usinas (proprietários diretos no grupo); usinas_controle; mw_controle (Σ potência das usinas em operação cujo proprietário majoritário pertence ao grupo); mw_proporcional (Σ potência × participação detida por empresas do grupo; partição da potência sem dupla contagem); participacao_pct (mw_proporcional ÷ fronteira × 100); motivo_parada (por que a cadeia termina ali); acima (controlador sem CNPJ acima do topo, só quando é pessoa jurídica estrangeira declarada pela fonte ou rótulo coletivo; vazio nos demais casos, inclusive pessoa física); listada_cvm (1 = companhia aberta com registro ATIVO no cadastro da CVM, de qualquer setor de atividade; 0 = sem registro ativo).",
        _url(CSV_CADEIA): "Arestas do grafo societário vigente (Polímero, trimestre de referência): pai_cnpj; pai_nome; socio_cnpj (vazio = pessoa física, fundo ou ente sem CNPJ); socio_nome (nome só quando o sócio tem CNPJ, é pessoa jurídica estrangeira declarada pela fonte ou é rótulo coletivo de uma lista fechada, como ações em tesouraria ou pulverizadas; senão o marcador 'pessoa física' ou 'sócio sem documento': nenhum nome de pessoa é republicado); perfil (PJ, PF, DC = demais controladores); controlador (1/0); pct_direto (participação do sócio no pai, %; vazio quando a fonte só permite o percentual em relação ao agente declarante e o pai aparece em mais de um caminho); origem (propria = declarada pelo próprio pai; terceiros = lida nas árvores de outros agentes); declaracao (trimestre da declaração usada); concordancia (listas que concordam sobre o controlador ÷ listas); primeiro_trimestre; ultimo_trimestre (vigência da aresta em toda a base).",
        _url(CSV_DISTRIBUIDORAS): "cnpj; slug; sigla; nome; classificacao; grupo; ufs (separadas por |); ativa; fontes (samp, tarifas, continuidade presentes); perdas_ano; taxa_perdas_totais_pct; pnt_bt_pct; qualidade_ano; dec_h; fec; dec_limite_h; fec_limite; ucs; tarifa_b1_rs_mwh; tarifa_inicio; tarifa_fim; controlador_cnpj; controlador_nome; motivo_parada; cvm_cd. Valores copiados das golds perdas.json, qualidade.json e conta.json pelo CNPJ, sem recálculo. Vazio = a gold de origem não tem o dado.",
        _url(CSV_COMPANHIAS): "Universo financeiro, uma companhia por linha: cnpj; cd_cvm (registro vigente ou mais recente); codigos_cvm (todos os registros do CNPJ); companhia (denominação na CVM); situacao; setor (setor de atividade declarado à CVM); categoria; controle_acionario; distribuidora_slug (quando é distribuidora do índice); controladora_aberta_cnpj (primeira companhia aberta com registro ativo na CVM, de qualquer setor, na cadeia de controle declarada à ANEEL: ela consolida esta); controla_abertas_cnpj (separadas por |).",
        _url(CSV_FINANCAS): "DFP, formato longo, um valor por linha: cnpj; escopo (consolidado ou individual, nunca somados); conta (id); cd_conta (código do plano padronizado da CVM; divida_bruta = 2.01.04 + 2.02.01); periodo_inicio (vazio em saldo); periodo_fim; recorte (exercicio = exercício social de 12 meses, que entra nas séries; saldo; exercicio_irregular = período publicado com início depois de 1º de janeiro numa companhia sem balanço positivo no fim do ano anterior, como o exercício de constituição: fica só neste CSV, com as datas da fonte, fora das séries); valor_rs (R$ nominais, escala da fonte convertida); versao (maior versão do documento no arquivo); recebido_cvm_em (data de recebimento do documento na CVM); reapresentado_rs (valor do mesmo exercício como apresentado no comparativo da DFP seguinte, só quando difere em mais de R$ 1 mil); nota (inicio_inconsistente_na_fonte:AAAA-MM-DD = a companhia publicou DT_INI_EXERC diferente de 1º de janeiro num exercício encerrado em 31/12 tendo balanço positivo no fim do ano anterior no mesmo documento; o valor é tratado como o exercício de 12 meses e a data publicada fica na nota). Demonstração com ativo total igual a zero (a CVM preenche com zero o consolidado que a companhia deixou de apresentar) é tratada como não apresentada: os valores dela não aparecem (lista em financas.exclusoes da gold). Nome da companhia em empresas_companhias_cvm.csv. Vazio = conta não publicada.",
        _url(CSV_FINANCAS_TRIM): "ITR, formato longo: cnpj; escopo; conta; cd_conta; periodo_inicio; periodo_fim; recorte (trimestre = três meses da DRE; acumulado_no_ano = janeiro até o fim do trimestre, na DRE e sempre na DFC, que a CVM publica acumulada; no 1º trimestre a DRE aparece nos dois recortes com o mesmo valor, porque o trimestre e o acumulado coincidem; saldo = balanço no fim do trimestre; periodo_irregular = fluxo com início fora dessas regras, com as datas da fonte, fora das séries); valor_rs; versao; recebido_cvm_em. O 4º trimestre não tem ITR (vem na DFP anual); nada é deduzido por diferença. Demonstração com ativo total igual a zero é tratada como não apresentada, como no CSV anual.",
        _url(JSON_FINANCAS): "Séries por companhia para leitura sob demanda, em R$ milhões com 3 casas (exato para a escala MIL da fonte): {cnpj: {anual: {con|ind: {conta: [[ano, valor], ...]}}, trimestral: {con|ind: {'conta:recorte': [[AAAA-MM-DD, valor], ...]}}}}. Recorte trimestre (DRE, três meses), saldo (balanço) ou acumulado_no_ano (DFC, de janeiro ao fim do trimestre, inclusive o 1º trimestre). Mesmos valores dos CSV.",
        _url(JSON_ATIVOS): "Usinas do SIGA para o mapa, colunar: nucleo, nome, tipo, fase, uf, mw (fiscalizada; outorgada fora de operação), lat, lon, estado (índice em estados), grupo (índice em grupos ou -1). Coordenadas oficiais do SIGA; usina sem coordenada fica fora do mapa e dentro da tabela.",
        _url(JSON_CADEIA): "Grafo societário vigente para a árvore interativa: nos {cnpj: [nome, controlador_direto_cnpj|null, motivo_parada|null]} e arestas colunares (pai, socio, nome, controlador, pct_direto) dos nós que estão numa cadeia de usina ou distribuidora. Em nome, sócio sem CNPJ só aparece com o nome quando é pessoa jurídica estrangeira declarada pela fonte ou rótulo coletivo; senão 'pessoa física' ou 'sócio sem documento'.",
        _url(JSON_EVID): "Evidência 'Comprove este número' da receita do último exercício de cada companhia do universo CVM (CNPJ → objeto de pipeline/energia/evidencia.py), lida sob demanda.",
    },
}

VERSAO_PROCESSAMENTO = "1"
# Medidas do último exercício publicadas na gold por companhia; as demais contas ficam no CSV e
# no JSON de séries (a gold tem teto de tamanho).
CONTAS_DESTAQUE = ("receita", "ebit", "lucro_liquido", "divida_bruta", "patrimonio_liquido", "ativo_total", "caixa_investimento")
ESTADOS = ["vinculado", "inclui_sem_documento", "soma_divergente", "sem_proprietario", "nao_lido"]
ROTULO_ESTADO = {
    "vinculado": "Todos os proprietários com CNPJ e participações somando 100%",
    "inclui_sem_documento": "Participações somam 100%, com algum proprietário sem CNPJ (pessoa física)",
    "soma_divergente": "Participações publicadas não somam 100% (ex.: matriz e filial com 100% cada)",
    "sem_proprietario": "Proprietário não informado no SIGA",
    "nao_lido": "Campo de proprietários fora do formato publicado",
}
ROTULO_REGIME = {k: v for k, v in ae.REGIMES.items()}


# ======================================================================= utilitários
def _processados(con):
    con.execute("CREATE TABLE IF NOT EXISTS empresas_processados(dataset TEXT, marca TEXT, processado_em TEXT,"
                " PRIMARY KEY(dataset, marca))")


def _ja_processado(con, ds, marca):
    _processados(con)
    return con.execute("SELECT 1 FROM empresas_processados WHERE dataset=? AND marca=?", (ds, marca)).fetchone() is not None


def _marca(con, ds, marca):
    _processados(con)
    con.execute("INSERT OR REPLACE INTO empresas_processados VALUES(?,?,?)", (ds, marca, base.agora_utc()))


class _Temporario:
    """Descomprime um arquivo do bronze (.gz) em fluxo para um temporário e devolve o
    caminho: zip e Parquet precisam de arquivo com acesso aleatório, e o arquivo inteiro
    nunca passa pela memória."""

    def __init__(self, v, sufixo):
        self.v, self.sufixo, self.caminho = v, sufixo, None

    def __enter__(self):
        fd, self.caminho = tempfile.mkstemp(prefix="empresas-", suffix=self.sufixo)
        with os.fdopen(fd, "wb") as dst, base.abre_bronze(self.v["arquivo"]) as src:
            shutil.copyfileobj(src, dst, 1 << 20)
        return self.caminho

    def __exit__(self, *exc):
        try:
            os.remove(self.caminho)
        except OSError:
            pass
        return False


def _r(v, casas=2):
    return c.r(v, casas)


def _mw(kw):
    return None if kw is None else kw / 1000.0


def _nome_periodo(p):
    return ae.rotulo_periodo(tuple(p)) if p else None


def _fonte(orgao, dataset, recurso, url_dataset, url_primaria, licenca):
    return {"orgao": orgao, "dataset": dataset, "recurso": recurso, "url_dataset": url_dataset,
            "url_primaria": url_primaria, "licenca": licenca}


def _vigente(con, ds, recurso=None):
    vs = ckan.vintages_vigentes(con, ds)
    if recurso is not None:
        return vs.get(recurso)
    return vs


def _br_num(v, casas=1):
    if v is None:
        return None
    s = f"{v:,.{casas}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


# ======================================================================= coleta
def _coleta_ckan(con, status, nome, ds, filtro, idade):
    st, _meta, vints = ckan.coleta_pacote(con, orgao="ANEEL", nome=nome, dataset=ds, filtro_recurso=filtro,
                                          max_idade_dias=idade)
    status[ds] = {k: st.get(k) for k in ("ok", "novas", "identicas", "puladas", "falhas")}
    return vints


def _siga_da_familia_geracao():
    """Vintage mais recente do SIGA no silver da família aneel_geracao (módulo Expansão),
    aberto só para leitura. None se o banco, a vintage ou o arquivo do bronze não existem."""
    caminho = os.path.join(base.SILVER, "aneel_geracao.db")
    if not os.path.exists(caminho):
        return None
    try:
        src = sqlite3.connect(f"file:{caminho}?mode=ro", uri=True, timeout=60)
        try:
            row = src.execute(
                """SELECT vintage_id, recurso, url, capturado_em, publicado_em, sha256, bytes, origem, arquivo
                   FROM vintages WHERE dataset=? AND recurso=? ORDER BY capturado_em DESC LIMIT 1""",
                (DS_SIGA, REC_SIGA)).fetchone()
        finally:
            src.close()
    except sqlite3.Error:
        return None
    if not row:
        return None
    v = dict(zip(["vintage_id", "recurso", "url", "capturado_em", "publicado_em", "sha256", "bytes", "origem", "arquivo"], row))
    if not v["arquivo"] or not os.path.exists(os.path.join(base.RAIZ, v["arquivo"])):
        return None
    return v


def _coleta_siga(con, status, hoje):
    """SIGA: reaproveita a captura do módulo Expansão (família aneel_geracao) quando tem até
    7 dias; senão coleta na própria família. A vintage reaproveitada é registrada aqui com o
    mesmo sha256 e o mesmo arquivo do bronze (origem 'reuso:aneel_geracao')."""
    v = _siga_da_familia_geracao()
    if v:
        cap = datetime.fromisoformat(v["capturado_em"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) - cap <= timedelta(days=7):
            vid, nova = base.registra_vintage(con, DS_SIGA, v["recurso"], v["url"], v["capturado_em"], v["publicado_em"],
                                              v["sha256"], v["bytes"], "reuso:aneel_geracao", v["arquivo"])
            base.registra_coleta(con, DS_SIGA, v["recurso"], True, f"reuso da vintage {vid} da família aneel_geracao")
            con.commit()
            status[DS_SIGA] = {"ok": True, "reuso": vid, "nova": nova}
            return
    _coleta_ckan(con, status, "siga-sistema-de-informacoes-de-geracao-da-aneel", DS_SIGA,
                 lambda r: (r.get("name") or "") == REC_SIGA, 7)


def _last_modified(url):
    """Data de modificação informada pelo servidor (cabeçalho Last-Modified, em GMT), usada
    como data de publicação do arquivo pela fonte. None quando o servidor não informa."""
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=60) as resp:
            lm = resp.headers.get("Last-Modified")
        if not lm:
            return None
        return email.utils.parsedate_to_datetime(lm).astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    except Exception:
        return None


def _url_doc(doc, ano):
    return f"{URL_CVM}/dados/CIA_ABERTA/DOC/{doc}/DADOS/{doc.lower()}_cia_aberta_{ano}.zip"


def _coleta_cvm(con, status, hoje):
    st = {"ok": True, "novas": 0, "identicas": 0, "puladas": 0, "falhas": []}
    alvos = [(DS_CVM_CAD, REC_CVM_CAD, URL_CVM_CAD, "csv", 7)]
    for ano in range(PRIMEIRO_ANO_DFP, hoje.year + 1):
        # exercícios encerrados há mais de dois anos quase não mudam: recoleta trimestral
        alvos.append((DS_DFP, f"dfp_cia_aberta_{ano}.zip", _url_doc("DFP", ano), "zip", 7 if ano >= hoje.year - 2 else 90))
    for ano in range(hoje.year - ANOS_ITR + 1, hoje.year + 1):
        alvos.append((DS_ITR, f"itr_cia_aberta_{ano}.zip", _url_doc("ITR", ano), "zip", 7 if ano >= hoje.year - 1 else 90))
    for ds, rec, url, ext, idade in alvos:
        res = ckan.baixar_recurso(con, orgao="CVM", dataset=ds, recurso=rec, url=url, publicado_em=_last_modified(url),
                                  ext=ext, max_idade_dias=idade)
        chave = {"nova": "novas", "identica": "identicas", "pulada": "puladas"}.get(res["status"])
        if chave:
            st[chave] += 1
        else:
            st["falhas"].append(f"{rec}: {res['detalhe']}")
    st["ok"] = not st["falhas"]
    status["cvm"] = st


# ---------------------------------------------------------------- bronze → silver
def _processa_agentes(con, v):
    regs, oc = ae.le_cadastro_agentes(ckan.le_csv_bronze(v["arquivo"]))
    linhas = []
    for c14, r in regs.items():
        ramos = ",".join(k for k in ("comercializacao", "distribuicao", "geracao", "transmissao") if r[k])
        linhas += [(c14, "sigla", r["sigla"]), (c14, "razao_social", r["razao_social"]),
                   (c14, "ativo", "1" if r["ativo"] else "0"), (c14, "ramos", ramos)]
    linhas.append(("_arquivo", "data_geracao", oc["data_geracao"]))
    novas, rev = base.grava_registros(con, DS_AGENTES, v["vintage_id"], linhas)
    return {"agentes": len(regs), "novas": novas, "revisoes": rev, **{k: oc[k] for k in ("linhas", "cnpj_invalido", "repetidos")}}


def _processa_siga(con, v):
    """Vínculos usina × proprietário com CNPJ do SIGA em registros (histórico por captura).
    Proprietário sem CNPJ não gera registro (o nome de pessoa física não é republicado);
    fica contado no estado da usina."""
    usinas, oc = ae.le_siga(ckan.le_csv_bronze(v["arquivo"], encoding="utf-8-sig", separador=";"))
    linhas = []
    for k, u in usinas.items():
        props = u["proprietarios"]
        est = ae.estado_vinculo(props)
        soma = sum(p["pct"] for p in props) if props else None
        linhas += [(f"{k}|_", "estado", est), (f"{k}|_", "soma_pct", None if soma is None else f"{soma:.4f}"),
                   (f"{k}|_", "sem_documento", str(sum(1 for p in props or [] if not p["cnpj"])))]
        for cnpj14, pct, regime in _agrega_por_cnpj(props or []):
            linhas += [(f"{k}|{cnpj14}", "pct", f"{pct:.4f}"), (f"{k}|{cnpj14}", "regime", regime)]
    linhas.append(("_arquivo", "data_geracao", oc["data_geracao"]))
    novas, rev = base.grava_registros(con, DS_SIGA, v["vintage_id"], linhas)
    return {"usinas": len(usinas), "novas": novas, "revisoes": rev, "linhas": oc["linhas"]}


def _agrega_por_cnpj(props):
    """[(cnpj, pct somado, regimes)] das parcelas com CNPJ de uma usina (o mesmo CNPJ pode
    aparecer em duas parcelas, por exemplo com regimes diferentes)."""
    soma, regimes = collections.defaultdict(float), collections.defaultdict(set)
    for p in props:
        if p["cnpj"]:
            soma[p["cnpj"]] += p["pct"]
            regimes[p["cnpj"]].add(p["regime"])
    return [(k, soma[k], ",".join(sorted(regimes[k]))) for k in sorted(soma)]


def _processa_agger(con, v):
    ag, oc = ae.le_agentes_geracao(ckan.le_csv_bronze(v["arquivo"], encoding="utf-8-sig", separador=";"))
    linhas = []
    for k, lst in ag.items():
        for x in lst:
            if x["cnpj"]:
                linhas += [(f"{k}|{x['cnpj']}", "pct", None if x["pct"] is None else f"{x['pct']:.4f}"),
                           (f"{k}|{x['cnpj']}", "regime", x["regime"])]
    linhas.append(("_arquivo", "data_geracao", oc["data_geracao"]))
    novas, rev = base.grava_registros(con, DS_AGGER, v["vintage_id"], linhas)
    return {"usinas": len(ag), "novas": novas, "revisoes": rev, **{k: oc[k] for k in ("linhas", "cpf_mascarado", "sem_documento")}}


def _polimero(v):
    with _Temporario(v, ".parquet") as caminho:
        return ae.le_polimero(lambda: ae.linhas_polimero(caminho))


def _processa_polimero(con, v):
    """Arestas com CNPJ nos dois lados do grafo vigente em registros (para o histórico entre
    capturas); a vigência por trimestre vem da própria base (primeiro e último trimestre)."""
    pol = _polimero(v)
    ref = pol["referencia"]
    if ref is None:
        return {"erro": "nenhum trimestre com declarações suficientes"}
    g = ae.grafo_vigente(pol, ref)
    linhas = [("_referencia", "trimestre", ae.rotulo_periodo(ref))]
    for x, lst in g["socios"].items():
        for a in lst:
            if a["socio"]:
                ch = f"{x}|{a['socio']}"
                linhas += [(ch, "controlador", "1" if a["controlador"] else "0"),
                           (ch, "pct_direto", None if a["pct"] is None else f"{a['pct']:.4f}")]
    novas, rev = base.grava_registros(con, DS_POLIMERO, v["vintage_id"], linhas)
    return {"referencia": ae.rotulo_periodo(ref), "nos": len(g["origem"]), "novas": novas, "revisoes": rev,
            **{k: pol["ocorrencias"][k] for k in ("linhas", "arvores", "fora_de_ordem")}}


def _processa_cvm_cad(con, v, universo_distrib):
    cad, oc = cv.le_cadastro(ckan.le_csv_bronze(v["arquivo"], encoding="latin-1", separador=";"))
    linhas = []
    for c14, r in cad.items():
        if r["setor"] in cv.SETORES_ENERGIA or c14 in universo_distrib:
            for campo in ("denominacao", "nome_comercial", "cd_cvm", "situacao", "setor", "categoria", "controle", "mercado",
                          "data_registro", "data_cancelamento"):
                linhas.append((c14, campo, r[campo]))
            linhas.append((c14, "codigos_cvm", ",".join(x for x in r["codigos_cvm"] if x)))
    novas, rev = base.grava_registros(con, DS_CVM_CAD, v["vintage_id"], linhas)
    return {"companhias": len(cad), "novas": novas, "revisoes": rev, **oc}


def _universo_cvm(con, distribuidoras):
    """CNPJ do universo financeiro: setor de atividade de energia elétrica declarado à CVM
    (dois setores do cadastro) ou distribuidora do índice do módulo com registro na CVM."""
    cad = base.registros_como_estavam_em(con, DS_CVM_CAD)
    return sorted(k for k, r in cad.items() if r.get("setor") in cv.SETORES_ENERGIA or k in distribuidoras)


def _processa_doc(con, ds, doc, v, universo):
    ano = int(v["recurso"].split("_")[-1].split(".")[0])
    alvos = {cv.formatado(x) for x in universo}
    with _Temporario(v, ".zip") as caminho:
        z = cv.abre_zip(caminho)
        try:
            valores, oc = cv.le_valores(z, doc, ano, alvos)
            indice = cv.le_indice(z, doc, ano, alvos)
        finally:
            z.close()
    obs = collections.defaultdict(list)
    for x in valores:
        if doc == "ITR" and x["ordem"] != "U":
            continue  # comparativo do ano anterior no ITR: fica no arquivo, não é série
        tipo = next(ct["tipo"] for ct in cv.CONTAS if ct["id"] == x["conta"])
        ref = x["dt_fim"] if tipo == "saldo" else f"{x['dt_ini']}/{x['dt_fim']}"
        obs[x["cnpj"]].append((f"{x['escopo']}|{x['conta']}|{x['ordem']}|{x['cnpj']}", ref, x["valor"]))
    novas = rev = 0
    for cnpj14, lst in obs.items():  # por companhia: poucas séries por chamada
        n, r = base.grava_observacoes(con, ds, v["vintage_id"], lst)
        novas += n
        rev += r
    linhas = []
    for (c14, dt_refer), versoes in indice.items():
        ult = max(versoes, key=lambda d: d["versao"])
        ch = f"doc|{c14}|{dt_refer}"
        linhas += [(ch, "versao", str(ult["versao"])), (ch, "versoes", str(len(versoes))),
                   (ch, "dt_receb", ult["dt_receb"]), (ch, "id_doc", ult["id_doc"]), (ch, "link", ult["link"])]
    base.grava_registros(con, ds, v["vintage_id"], linhas)
    return {"valores": len(valores), "novas": novas, "revisoes": rev, "documentos": len(indice),
            **{k: oc[k] for k in ("escala_desconhecida", "moeda_desconhecida", "rotulo_3_01_inesperado")}}


def _distribuidoras_das_golds(golds):
    out = set()
    for d in (golds.get("perdas.json") or {}).get("distribuidoras") or []:
        out.add(d["cnpj"])
    for d in (golds.get("qualidade.json") or {}).get("distribuidoras") or []:
        out.add(d["cnpj"])
    t = ((golds.get("conta.json") or {}).get("tarifas") or {})
    for d in (t.get("vigentes") or []) + (t.get("sem_vigente") or []):
        out.add(d["cnpj"])
    return {entidades.cnpj(x) for x in out if entidades.cnpj(x)}


def coletar(con, ctx):
    hoje = ctx.get("hoje") or date.today()
    if ctx.get("sem_rede"):
        return {"ok": True, "detalhe": "execução sem rede: nada coletado"}
    status = {}
    csv_ou_pdf = lambda r: (r.get("format") or "").upper() in ("CSV", "PDF")  # noqa: E731
    v = _coleta_ckan(con, status, "agentes-do-setor-eletrico", DS_AGENTES, csv_ou_pdf, 7)
    vt = v.get(REC_AGENTES)
    if vt and not _ja_processado(con, DS_AGENTES, vt["vintage_id"] + "#v" + VERSAO_PROCESSAMENTO):
        status[f"{DS_AGENTES}:processamento"] = _processa_agentes(con, vt)
        _marca(con, DS_AGENTES, vt["vintage_id"] + "#v" + VERSAO_PROCESSAMENTO)
        con.commit()
    v = _coleta_ckan(con, status, "agentes-de-geracao-de-energia-eletrica", DS_AGGER, csv_ou_pdf, 7)
    vt = v.get(REC_AGGER)
    if vt and not _ja_processado(con, DS_AGGER, vt["vintage_id"] + "#v" + VERSAO_PROCESSAMENTO):
        status[f"{DS_AGGER}:processamento"] = _processa_agger(con, vt)
        _marca(con, DS_AGGER, vt["vintage_id"] + "#v" + VERSAO_PROCESSAMENTO)
        con.commit()
    _coleta_siga(con, status, hoje)
    vt = _vigente(con, DS_SIGA, REC_SIGA)
    if vt and not _ja_processado(con, DS_SIGA, vt["vintage_id"] + "#v" + VERSAO_PROCESSAMENTO):
        status[f"{DS_SIGA}:processamento"] = _processa_siga(con, vt)
        _marca(con, DS_SIGA, vt["vintage_id"] + "#v" + VERSAO_PROCESSAMENTO)
        con.commit()
    v = _coleta_ckan(con, status, "composicao-societaria-polimero", DS_POLIMERO,
                     lambda r: (r.get("format") or "").upper() in ("PARQUET", "PDF"), 30)
    vt = v.get(REC_POLIMERO)
    if vt and not _ja_processado(con, DS_POLIMERO, vt["vintage_id"] + "#v" + VERSAO_PROCESSAMENTO):
        status[f"{DS_POLIMERO}:processamento"] = _processa_polimero(con, vt)
        _marca(con, DS_POLIMERO, vt["vintage_id"] + "#v" + VERSAO_PROCESSAMENTO)
        con.commit()
    _coleta_cvm(con, status, hoje)
    distrib = _distribuidoras_das_golds(ctx.get("golds") or {})
    vt = _vigente(con, DS_CVM_CAD, REC_CVM_CAD)
    marca_cad = hashlib.sha256((",".join(sorted(distrib)) + VERSAO_PROCESSAMENTO).encode()).hexdigest()[:12]
    if vt and not _ja_processado(con, DS_CVM_CAD, f"{vt['vintage_id']}#{marca_cad}"):
        status[f"{DS_CVM_CAD}:processamento"] = _processa_cvm_cad(con, vt, distrib)
        _marca(con, DS_CVM_CAD, f"{vt['vintage_id']}#{marca_cad}")
        con.commit()
    status["cvm:processamento"] = processa_cvm(con, distrib)
    ok = all((s.get("ok", True) if isinstance(s, dict) else True) for s in status.values())
    return {"ok": ok, "detalhe": status}


def processa_cvm(con, distrib):
    """Extrai as contas de cada zip DFP/ITR vigente ainda não processado para o universo
    atual (a marca inclui o hash do universo: companhia nova no universo reprocessa tudo)."""
    universo = _universo_cvm(con, distrib)
    marca_u = hashlib.sha256((",".join(universo) + VERSAO_PROCESSAMENTO).encode()).hexdigest()[:12]
    out = {"universo": len(universo), "processados": {}}
    for ds, doc in ((DS_DFP, "DFP"), (DS_ITR, "ITR")):
        for rec, vt in sorted(_vigente(con, ds).items()):
            marca = f"{vt['vintage_id']}#{marca_u}"
            if _ja_processado(con, ds, marca):
                continue
            out["processados"][rec] = _processa_doc(con, ds, doc, vt, universo)
            _marca(con, ds, marca)
            con.commit()
    return out


# ======================================================================= leitura para a gold
def _obs_vigentes(con, ds):
    """{(serie, ref): valor} vigente e o número de (serie, ref) com mais de um valor entre as
    vintages (revisões da fonte), numa só consulta."""
    atual, valores = {}, collections.defaultdict(set)
    for serie, ref, valor in con.execute(
            """SELECT o.serie, o.ref, o.valor FROM observacoes o JOIN vintages v ON v.vintage_id=o.vintage_id
               WHERE o.dataset=? ORDER BY v.capturado_em, o.rowid""", (ds,)):
        atual[(serie, ref)] = valor
        valores[(serie, ref)].add(valor)
    return atual, sum(1 for s in valores.values() if len(s) > 1)


def _golds(ctx):
    g = ctx.get("golds") or {}
    out = {}
    for nome in ("perdas.json", "qualidade.json", "conta.json"):
        x = g.get(nome)
        out[nome] = x if isinstance(x, dict) and x.get("disponivel") is True else None
    return out


# ======================================================================= P036 e P039: ativos e controle
def _nomes(agentes, cvm_cad, usinas, grafo):
    """Nome de exibição por CNPJ, na ordem: cadastro de agentes da ANEEL, CVM, nome do sócio no
    Polímero, nome do proprietário no SIGA. Nome é só rótulo: nenhum vínculo depende dele."""
    nomes = {}
    for u in usinas.values():
        for p in u["proprietarios"] or []:
            if p["cnpj"] and p["nome"]:
                nomes.setdefault(p["cnpj"], p["nome"])
    for lst in grafo["socios"].values():
        for a in lst:
            if a["socio"] and a["nome"]:
                nomes[a["socio"]] = a["nome"]
    for k, r in cvm_cad.items():
        if r.get("denominacao"):
            nomes[k] = r["denominacao"]
    for k, r in agentes.items():
        if r.get("razao_social"):
            nomes[k] = r["razao_social"]
    return nomes


def _ativos(usinas, grafo, conf_agentes):
    """Métricas por usina, proprietário direto e grupo. Retorna dict com proprietarios,
    grupos, fronteira, estados e linhas do CSV de ativos."""
    cache_cadeia = {}

    def cadeia(x):
        if x not in cache_cadeia:
            cache_cadeia[x] = ae.cadeia_de_controle(grafo, x) if grafo else {
                "topo": x, "cadeia": [x], "motivo_parada": "sem_declaracao", "pcts": [], "acima": None}
        return cache_cadeia[x]

    donos = collections.defaultdict(lambda: {"usinas": 0, "usinas_operacao": 0, "kw_bruto": 0.0, "kw_prop": 0.0,
                                             "kw_controle": 0.0, "usinas_controle": 0, "regimes": collections.Counter()})
    grupos = collections.defaultdict(lambda: {"kw_prop": 0.0, "kw_controle": 0.0, "usinas_controle": 0, "empresas": set(),
                                              "por_tipo": collections.defaultdict(float)})
    estados = {e: {"usinas": 0, "usinas_operacao": 0, "kw_operacao": 0.0, "kw_outorgado": 0.0} for e in ESTADOS}
    fronteira = {"kw_total_operacao": 0.0, "kw_valido": 0.0, "kw_sem_documento": 0.0, "kw_sem_majoritario": 0.0,
                 "usinas_validas": 0, "usinas_sem_majoritario": 0, "kw_sem_potencia": 0, "por_tipo": collections.defaultdict(float)}
    linhas = []
    for k, u in usinas.items():
        props = u["proprietarios"]
        est = ae.estado_vinculo(props)
        u["estado"] = est
        op = u["fase"] == "Operação"
        kw = u["kw_fiscalizado"] if op else None
        e = estados[est]
        e["usinas"] += 1
        e["kw_outorgado"] += u["kw_outorgado"] or 0.0
        if op:
            e["usinas_operacao"] += 1
            e["kw_operacao"] += kw or 0.0
            fronteira["kw_total_operacao"] += kw or 0.0
            if kw is None:
                fronteira["kw_sem_potencia"] += 1
        valido = est in ("vinculado", "inclui_sem_documento")
        por_cnpj = _agrega_por_cnpj(props or [])
        # soma aceita dentro da tolerância de arredondamento (ex.: 100,0001% em Machadinho): as
        # parcelas são normalizadas pela soma publicada para que a partição feche exatamente
        soma_pct = sum(p["pct"] for p in props) if valido else None
        majoritario = next((c14 for c14, pct, _ in por_cnpj if pct > 50.0), None) if valido else None
        u["grupo_majoritario"] = cadeia(majoritario)["topo"] if majoritario else None
        if op and valido and kw:
            fronteira["kw_valido"] += kw
            fronteira["usinas_validas"] += 1
            fronteira["por_tipo"][u["tipo"]] += kw
            fronteira["kw_sem_documento"] += kw * sum(p["pct"] for p in props if not p["cnpj"]) / soma_pct
            if majoritario is None:
                fronteira["kw_sem_majoritario"] += kw
                fronteira["usinas_sem_majoritario"] += 1
        for c14, pct, regimes in por_cnpj:
            d = donos[c14]
            d["usinas"] += 1
            for rg in regimes.split(","):
                d["regimes"][rg] += 1
            topo = cadeia(c14)["topo"]
            if op:
                d["usinas_operacao"] += 1
                d["kw_bruto"] += kw or 0.0
            if op and valido and kw:
                parcela = kw * pct / soma_pct
                d["kw_prop"] += parcela
                grupos[topo]["kw_prop"] += parcela
                grupos[topo]["por_tipo"][u["tipo"]] += parcela
                grupos[topo]["empresas"].add(c14)
            # contagem e potência sob controle com o mesmo critério: usina em operação com
            # potência fiscalizada (uma usina em construção não entra em nenhuma das duas)
            if c14 == majoritario and op and kw:
                d["usinas_controle"] += 1
                d["kw_controle"] += kw
                grupos[topo]["kw_controle"] += kw
                grupos[topo]["usinas_controle"] += 1
        conf = conf_agentes.get(k, "ausente_em_agentes")
        base_linha = [k, u["ceg"], u["nome"], u["tipo"], u["fase"], u["uf"], u["kw_outorgado"], u["kw_fiscalizado"], est,
                      None if props is None else round(sum(p["pct"] for p in props), 4)]
        if not props:
            linhas.append(base_linha + [None, None, None, None, None, None, conf])
            continue
        for p in props:
            topo = cadeia(p["cnpj"])["topo"] if p["cnpj"] else None
            linhas.append(base_linha + [p["cnpj"], p["nome"] if p["cnpj"] else None, p["pct"], p["regime"],
                                        1 if (p["cnpj"] and p["cnpj"] == majoritario) else 0, topo, conf])
    return {"donos": donos, "grupos": grupos, "estados": estados, "fronteira": fronteira, "linhas": linhas,
            "cadeia": cadeia}


def _inicio_trimestre(p):
    """(ano, trimestre) → primeiro dia do trimestre (AAAA-MM-DD)."""
    return f"{p[0]}-{3 * (p[1] - 1) + 1:02d}-01"


def _listadas_cvm(v_cad, cvm_cad):
    """(CNPJ com registro ATIVO no cadastro inteiro da CVM, origem). Sem o arquivo no bronze,
    cai para o subconjunto do setor elétrico guardado no silver e diz isso."""
    if v_cad and v_cad.get("arquivo") and os.path.exists(os.path.join(base.RAIZ, v_cad["arquivo"])):
        cad, _ = cv.le_cadastro(ckan.le_csv_bronze(v_cad["arquivo"], encoding="latin-1", separador=";"))
        return {k for k, r in cad.items() if r.get("situacao") == "ATIVO"}, "cadastro_completo"
    return {k for k, r in cvm_cad.items() if r.get("situacao") == "ATIVO"}, "silver_setor_eletrico"


def _concentracao(partes, total):
    """HHI (0 a 10.000) e razões CR4 e CR10 (%) de uma partição {participante: kW} sobre o
    total da fronteira. A parcela sem participante identificável (pessoas físicas) fica no
    denominador e fora do numerador: o HHI resultante é um limite inferior do que seria com
    todos os participantes identificados, e a parcela fica publicada."""
    if not total:
        return None
    cotas = sorted(((k, 100.0 * v / total) for k, v in partes.items() if v > 0), key=lambda kv: -kv[1])
    hhi = sum(s * s for _, s in cotas)
    return {"hhi": _r(hhi, 1), "cr4": _r(sum(s for _, s in cotas[:4]), 2), "cr10": _r(sum(s for _, s in cotas[:10]), 2),
            "participantes": len(cotas), "cota_maior": _r(cotas[0][1], 2) if cotas else None,
            "_cotas": cotas}


def _faixa_hhi(h):
    """Faixas do Guia para Análise de Atos de Concentração Horizontal do CADE (2016, seção do
    HHI; arquivo conferido em 01/10/2026): abaixo de 1.500 pontos, mercado não concentrado; de
    1.500 a 2.500, moderadamente concentrado; acima de 2.500, altamente concentrado. As
    diretrizes americanas de 2010, que usavam os mesmos limiares, foram substituídas em 2023
    por outras com limiares diferentes e não são usadas aqui. Classificação descritiva de uma
    fronteira de capacidade, não juízo sobre mercado relevante."""
    if h is None:
        return None
    return "nao_concentrado" if h < 1500 else ("moderado" if h <= 2500 else "alto")


# ======================================================================= P038: finanças
CONTAS_DFC = {ct["id"] for ct in cv.CONTAS if ct["demonstracao"] == "DFC"}


def _colunas_zeradas(obs):
    """{(cnpj, escopo, ordem, fim): motivo} das colunas de demonstração com ativo total ≤ 0.

    Quando a companhia deixa de apresentar um escopo (o consolidado de quem deixou de ter
    controladas, por exemplo), a CVM continua publicando as tabelas desse escopo com todas as
    contas iguais a zero. Ativo total zero é impossível para uma companhia registrada; a coluna
    inteira (mesmo CNPJ, escopo, ordem do exercício e data de fim) vira ausência, nunca zero. O
    motivo diz se o outro escopo da mesma data tem ativo positivo ('escopo_nao_apresentado', o
    caso do consolidado que deixou de existir) ou não ('demonstracao_zerada')."""
    ativo = {}
    for (serie, ref), v in obs.items():
        esc, conta, ordem, c14 = serie.split("|")
        if conta == "ativo_total" and v is not None:
            ativo[(c14, esc, ordem, ref)] = v
    out = {}
    for (c14, esc, ordem, fim), v in ativo.items():
        if v > 0:
            continue
        outro = ativo.get((c14, "ind" if esc == "con" else "con", ordem, fim))
        out[(c14, esc, ordem, fim)] = "escopo_nao_apresentado" if outro is not None and outro > 0 else "demonstracao_zerada"
    return out


def _financas(con, cvm_cad, universo, nomes):
    dfp, rev_dfp = _obs_vigentes(con, DS_DFP)
    itr, rev_itr = _obs_vigentes(con, DS_ITR)
    docs_dfp = {k: r for k, r in base.registros_como_estavam_em(con, DS_DFP).items() if k.startswith("doc|")}
    docs_itr = {k: r for k, r in base.registros_como_estavam_em(con, DS_ITR).items() if k.startswith("doc|")}
    tipo_conta = {ct["id"]: ct["tipo"] for ct in cv.CONTAS}
    anual = collections.defaultdict(lambda: collections.defaultdict(dict))       # cnpj -> (esc, conta) -> {ano: v}
    anterior = collections.defaultdict(lambda: collections.defaultdict(dict))    # reapresentado no doc seguinte
    trimestral = collections.defaultdict(lambda: collections.defaultdict(dict))  # cnpj -> (esc, conta, recorte) -> {fim: v}
    zer_dfp, zer_itr = _colunas_zeradas(dfp), _colunas_zeradas(itr)
    # Companhia que já existia no início do exercício: o comparativo (PENÚLTIMO) do próprio
    # documento traz balanço positivo no fim do ano anterior. É o que distingue a data de
    # início mal preenchida (Ferreira Gomes publica 1º de dezembro em exercícios inteiros; a
    # Light SESA, 1º de dezembro de 2019) do exercício de constituição, que é curto de fato.
    existia = set()
    for (serie, ref), v in dfp.items():
        esc, conta, ordem, c14 = serie.split("|")
        if conta == "ativo_total" and ordem == "P" and ref[5:] == "12-31" and v is not None and v > 0:
            existia.add((c14, int(ref[:4]) + 1))
    nota_inicio = {}          # (cnpj, escopo, conta, ano) -> DT_INI publicada, valores aceitos como exercício
    irregulares_dfp = []      # fluxos do exercício (ÚLTIMO) fora da série: [(cnpj, esc, conta, ini, fim, valor)]
    irregulares_itr = []
    nao_apresentados = {"dfp": 0, "itr": 0}
    for (serie, ref), valor in dfp.items():
        esc, conta, ordem, c14 = serie.split("|")
        fim = ref.split("/")[-1]
        ini = ref.split("/")[0] if "/" in ref else None
        if (c14, esc, ordem, fim) in zer_dfp:
            nao_apresentados["dfp"] += 1
            continue
        ano = int(fim[:4])
        if ini is None:
            if fim[5:] != "12-31":
                if ordem == "U":
                    irregulares_dfp.append((c14, esc, conta, None, fim, valor))
                continue
        elif not (ini[5:] == "01-01" and fim[5:] == "12-31" and ini[:4] == fim[:4]):
            if fim[5:] == "12-31" and ini[:4] == fim[:4] and (c14, ano) in existia:
                if ordem == "U":
                    nota_inicio[(c14, esc, conta, ano)] = ini
            else:
                # exercício curto de fato (constituição, por exemplo): fora da série anual, no
                # CSV com as datas da fonte e recorte próprio
                if ordem == "U":
                    irregulares_dfp.append((c14, esc, conta, ini, fim, valor))
                continue
        (anual if ordem == "U" else anterior)[c14][(esc, conta)][ano] = valor
    for (serie, ref), valor in itr.items():
        esc, conta, ordem, c14 = serie.split("|")
        fim = ref.split("/")[-1]
        ini = ref.split("/")[0] if "/" in ref else None
        if (c14, esc, ordem, fim) in zer_itr:
            nao_apresentados["itr"] += 1
            continue
        if tipo_conta[conta] == "saldo":
            trimestral[c14][(esc, conta, "saldo")][fim] = valor
            continue
        meses = (int(fim[:4]) - int(ini[:4])) * 12 + int(fim[5:7]) - int(ini[5:7]) + 1
        desde_janeiro = ini[5:] == "01-01" and ini[:4] == fim[:4]
        if conta in CONTAS_DFC:
            # a DFC do ITR é sempre acumulada desde janeiro (no 1º trimestre, três meses que
            # também são o acumulado): rótulo único, para a série acumulada não perder o 1º trimestre
            recortes = ["acumulado_no_ano"] if desde_janeiro else []
        else:
            # DRE: trimestre e acumulado; no 1º trimestre os dois coincidem e o mesmo valor é
            # publicado nos dois recortes
            recortes = (["trimestre"] if meses == 3 else []) + (["acumulado_no_ano"] if desde_janeiro else [])
        if not recortes:
            irregulares_itr.append((c14, esc, conta, ini, fim, valor))
            continue
        for recorte in recortes:
            trimestral[c14][(esc, conta, recorte)][fim] = valor
    # dívida bruta = 2.01.04 + 2.02.01, só quando as duas contas existem no mesmo escopo e data
    for serie_dict, chaves in ((anual, None), (trimestral, "saldo")):
        for c14, d in serie_dict.items():
            for esc in ("con", "ind"):
                if chaves:
                    cp, lp = d.get((esc, "emprestimos_cp", "saldo"), {}), d.get((esc, "emprestimos_lp", "saldo"), {})
                    alvo = (esc, "divida_bruta", "saldo")
                else:
                    cp, lp = d.get((esc, "emprestimos_cp"), {}), d.get((esc, "emprestimos_lp"), {})
                    alvo = (esc, "divida_bruta")
                for k in set(cp) & set(lp):
                    d[alvo][k] = cp[k] + lp[k]
    # validação de domínio: depois de tirar as colunas zeradas, nenhum ativo total publicado
    # pode ser ≤ 0 (violação é crítica: vira stub)
    ativo_invalido = [(c14, esc, a) for c14, d in anual.items() for (esc, conta), s_ in d.items() if conta == "ativo_total"
                      for a, v in s_.items() if v is None or v <= 0]
    ativo_invalido += [(c14, esc, f) for c14, d in trimestral.items() for (esc, conta, _r_), s_ in d.items()
                       if conta == "ativo_total" for f, v in s_.items() if v is None or v <= 0]
    return {"anual": anual, "anterior": anterior, "trimestral": trimestral, "docs_dfp": docs_dfp, "docs_itr": docs_itr,
            "revisoes": {"dfp": rev_dfp, "itr": rev_itr}, "zeradas": {"DFP": zer_dfp, "ITR": zer_itr},
            "nao_apresentados": nao_apresentados, "nota_inicio": nota_inicio, "irregulares_dfp": irregulares_dfp,
            "irregulares_itr": irregulares_itr, "ativo_invalido": ativo_invalido}


# ======================================================================= construir
def construir(con, ctx):
    hoje = ctx.get("hoje") or date.today()
    agentes_regs = base.registros_como_estavam_em(con, DS_AGENTES)
    v_siga = _vigente(con, DS_SIGA, REC_SIGA)
    v_agger = _vigente(con, DS_AGGER, REC_AGGER)
    v_pol = _vigente(con, DS_POLIMERO, REC_POLIMERO)
    v_cad = _vigente(con, DS_CVM_CAD, REC_CVM_CAD)
    v_agentes = _vigente(con, DS_AGENTES, REC_AGENTES)
    if not (v_siga and agentes_regs and v_agentes):
        return c.stub(GOLD, "SIGA ou cadastro de agentes ausente no silver da família empresas")
    golds = _golds(ctx)
    criticas, ressalvas = [], []

    # ---------------------------------------------------------------- leitura
    usinas, oc_siga = ae.le_siga(ckan.le_csv_bronze(v_siga["arquivo"], encoding="utf-8-sig", separador=";"))
    agger, oc_agger = ({}, {})
    if v_agger:
        agger, oc_agger = ae.le_agentes_geracao(ckan.le_csv_bronze(v_agger["arquivo"], encoding="utf-8-sig", separador=";"))
    pol, grafo = None, None
    if v_pol:
        pol = _polimero(v_pol)
        if pol["referencia"]:
            grafo = ae.grafo_vigente(pol, pol["referencia"])
    cvm_cad = base.registros_como_estavam_em(con, DS_CVM_CAD)
    agentes = {k: {"sigla": r.get("sigla"), "razao_social": r.get("razao_social"), "ativo": r.get("ativo") == "1",
                   "ramos": [x for x in (r.get("ramos") or "").split(",") if x]}
               for k, r in agentes_regs.items() if k != "_arquivo"}
    data_cadastro = agentes_regs.get("_arquivo", {}).get("data_geracao")
    data_siga = oc_siga["data_geracao"]
    data_agger = oc_agger.get("data_geracao") if oc_agger else None

    # ---------------------------------------------------------------- validação de esquema e domínio
    if oc_siga["proprietarios_nao_lidos"]:
        criticas.append(f"{len(oc_siga['proprietarios_nao_lidos'])} usinas com o campo de proprietários fora do formato do SIGA")
    if oc_siga["duplicadas_divergentes"]:
        ressalvas.append(f"{len(oc_siga['duplicadas_divergentes'])} núcleos de CEG repetidos com conteúdo diferente no SIGA; vale a primeira linha")
    negativos = [k for k, u in usinas.items() if (u["kw_fiscalizado"] or 0) < 0 or (u["kw_outorgado"] or 0) < 0]
    if negativos:
        criticas.append(f"potência negativa em {len(negativos)} usinas")
    pct_fora = [k for k, u in usinas.items() for p in (u["proprietarios"] or []) if not (0 <= p["pct"] <= 100)]
    if pct_fora:
        criticas.append(f"participação fora de 0 a 100% em {len(pct_fora)} parcelas")
    if data_siga and data_siga > (hoje + timedelta(days=1)).isoformat():
        criticas.append(f"data do SIGA {data_siga} posterior a hoje")
    if len(usinas) < 20000:
        criticas.append(f"SIGA com {len(usinas)} usinas: abaixo do esperado (mais de 25 mil em 2026)")
    if criticas:
        return c.stub(GOLD, "validação crítica: " + "; ".join(criticas))

    # ---------------------------------------------------------------- conferência SIGA × Agentes de Geração
    comp = ae.compara_vinculos(usinas, agger) if agger else None
    conf_por_usina = {}
    for k, u in usinas.items():
        props = u["proprietarios"]
        if not props:
            conf_por_usina[k] = "sem_proprietario_no_siga"
            continue
        ag = agger.get(k)
        if ag is None:
            conf_por_usina[k] = "ausente_em_agentes"
            continue
        a = {c14: pct for c14, pct, _ in _agrega_por_cnpj(props)}
        b = collections.defaultdict(float)
        for x in ag:
            if x["cnpj"] and x["pct"] is not None:
                b[x["cnpj"]] += x["pct"]
        if set(a) != set(b):
            conf_por_usina[k] = "cnpj_diferente"
        elif any(abs(a[x] - b[x]) > 0.0100001 for x in a):
            conf_por_usina[k] = "percentual_diferente"
        else:
            conf_por_usina[k] = "igual"

    at = _ativos(usinas, grafo, conf_por_usina)
    nomes = _nomes(agentes, cvm_cad, usinas, grafo or {"socios": {}})
    cadeia = at["cadeia"]
    fr = at["fronteira"]
    if fr["kw_valido"] <= 0:
        return c.stub(GOLD, "nenhuma usina em operação com participações válidas")
    soma_grupos = sum(g["kw_prop"] for g in at["grupos"].values())
    soma_donos = sum(d["kw_prop"] for d in at["donos"].values())
    # tolerância de ponto flutuante (10⁻⁹ relativo, cerca de 0,2 kW em 220 GW): a partição é exata
    identidade_ok = abs(soma_grupos - soma_donos) <= 1e-9 * max(1.0, soma_donos)
    identidade_total = abs(soma_donos + fr["kw_sem_documento"] - fr["kw_valido"]) <= 1e-9 * fr["kw_valido"]
    if not (identidade_ok and identidade_total):
        return c.stub(GOLD, "identidade de partição violada: Σ grupos, Σ proprietários e fronteira não fecham")

    # ---------------------------------------------------------------- snapshots e proveniência
    snap_siga, snap_agger, snap_pol = c.snapshot_de(con, DS_SIGA), c.snapshot_de(con, DS_AGGER), c.snapshot_de(con, DS_POLIMERO)
    snap_ag, snap_cad = c.snapshot_de(con, DS_AGENTES), c.snapshot_de(con, DS_CVM_CAD)
    snap_dfp, snap_itr = c.snapshot_de(con, DS_DFP), c.snapshot_de(con, DS_ITR)
    fonte_siga = _fonte("ANEEL", "SIGA: Sistema de Informações de Geração da ANEEL", REC_SIGA, URL_SIGA, v_siga["url"], LICENCA_ANEEL)
    fonte_agentes = _fonte("ANEEL", "Agentes do Setor Elétrico (Cadastro Institucional)", "agentes-setor-eletrico.csv",
                           URL_AGENTES, v_agentes["url"], LICENCA_ANEEL)
    fonte_pol = _fonte("ANEEL", "Composição Societária (Polímero)", REC_POLIMERO, URL_POLIMERO,
                       v_pol["url"] if v_pol else URL_POLIMERO, LICENCA_ANEEL)

    # ---------------------------------------------------------------- P036: estados e cobertura
    total_usinas = len(usinas)
    total_kw_op = fr["kw_total_operacao"]
    estados_pub = []
    for e in ESTADOS:
        x = at["estados"][e]
        if e == "nao_lido" and x["usinas"] == 0:
            continue
        estados_pub.append({"estado": e, "rotulo": ROTULO_ESTADO[e], "usinas": x["usinas"],
                            "usinas_operacao": x["usinas_operacao"], "mw_operacao": _r(_mw(x["kw_operacao"]), 1),
                            "pct_usinas": _r(100.0 * x["usinas"] / total_usinas, 2),
                            "pct_mw_operacao": _r(100.0 * x["kw_operacao"] / total_kw_op, 2) if total_kw_op else None})
    vinc = at["estados"]["vinculado"]
    pct_mw_vinc = 100.0 * vinc["kw_operacao"] / total_kw_op if total_kw_op else None
    proprietarios_cnpj = sorted(at["donos"])
    no_cadastro = [x for x in proprietarios_cnpj if x in agentes]
    fora_cadastro = [x for x in proprietarios_cnpj if x not in agentes]
    por_fase = collections.defaultdict(lambda: {"usinas": 0, "kw_outorgado": 0.0, "kw_fiscalizado": 0.0})
    por_regime = collections.defaultdict(lambda: {"parcelas": 0, "kw_prop": 0.0})
    for u in usinas.values():
        f = por_fase[u["fase"]]
        f["usinas"] += 1
        f["kw_outorgado"] += u["kw_outorgado"] or 0.0
        f["kw_fiscalizado"] += u["kw_fiscalizado"] or 0.0
        if u["estado"] in ("vinculado", "inclui_sem_documento") and u["fase"] == "Operação" and u["kw_fiscalizado"]:
            for p in u["proprietarios"]:
                r_ = por_regime[p["regime"]]
                r_["parcelas"] += 1
                r_["kw_prop"] += u["kw_fiscalizado"] * p["pct"] / sum(x["pct"] for x in u["proprietarios"])
    sem_vinculo = sorted((k for k, u in usinas.items() if u["estado"] not in ("vinculado",) and u["fase"] == "Operação"),
                         key=lambda k: -(usinas[k]["kw_fiscalizado"] or 0))
    sem_vinculo_pub = [{"nucleo": k, "ceg": usinas[k]["ceg"], "nome": usinas[k]["nome"], "tipo": usinas[k]["tipo"],
                        "uf": usinas[k]["uf"], "mw": _r(_mw(usinas[k]["kw_fiscalizado"]), 3), "estado": usinas[k]["estado"],
                        "soma_pct": _r(sum(p["pct"] for p in usinas[k]["proprietarios"]), 4) if usinas[k]["proprietarios"] else None,
                        "proprietarios_cnpj": [p["cnpj"] for p in usinas[k]["proprietarios"] or [] if p["cnpj"]],
                        # soma de 200% com matriz e filial: mesma pessoa jurídica (raiz do CNPJ), dito sem consolidar
                        "mesma_raiz": len({entidades.raiz_cnpj(p["cnpj"]) for p in usinas[k]["proprietarios"] or [] if p["cnpj"]}) == 1
                        and len([p for p in usinas[k]["proprietarios"] or [] if p["cnpj"]]) > 1}
                       for k in sem_vinculo[:20]]

    # ---------------------------------------------------------------- P039: grupos e concentração
    total_valido = fr["kw_valido"]
    conc_dir = _concentracao({k: d["kw_prop"] for k, d in at["donos"].items()}, total_valido)
    conc_grp = _concentracao({k: g["kw_prop"] for k, g in at["grupos"].items()}, total_valido)
    conc_ctl = _concentracao({k: g["kw_controle"] for k, g in at["grupos"].items()}, total_valido)
    por_tipo = []
    for tipo, kw_t in sorted(fr["por_tipo"].items(), key=lambda kv: -kv[1]):
        partes = {k: g["por_tipo"].get(tipo, 0.0) for k, g in at["grupos"].items()}
        ct = _concentracao(partes, kw_t)
        maior = ct["_cotas"][0] if ct and ct["_cotas"] else None
        por_tipo.append({"tipo": tipo, "mw": _r(_mw(kw_t), 1), "hhi_grupo": ct["hhi"], "faixa": _faixa_hhi(ct["hhi"]),
                         "cr4_grupo": ct["cr4"], "participantes": ct["participantes"],
                         "maior": {"cnpj": maior[0], "nome": nomes.get(maior[0]), "pct": _r(maior[1], 2)} if maior else None})
    # companhias abertas com registro ativo na CVM, de QUALQUER setor: o silver guarda só o
    # universo do setor elétrico, mas 'listada_cvm' e a controladora aberta valem para qualquer
    # companhia (Suzano, Sabesp, CSN e Raízen controlam usinas e são abertas). Lido do arquivo
    # do cadastro no bronze (2,7 mil linhas), só CNPJ e situação.
    listadas, fonte_listadas = _listadas_cvm(v_cad, cvm_cad)
    if fonte_listadas != "cadastro_completo":
        ressalvas.append("cadastro completo da CVM indisponível no bronze: 'listada_cvm' considera só as companhias do setor elétrico")

    def pub_grupo(k, g):
        cad_ = cadeia(k)
        return {"cnpj": k, "nome": nomes.get(k), "mw_proporcional": _r(_mw(g["kw_prop"]), 1),
                "participacao_pct": _r(100.0 * g["kw_prop"] / total_valido, 2),
                "mw_controle": _r(_mw(g["kw_controle"]), 1), "usinas_controle": g["usinas_controle"],
                "empresas_com_usinas": len(g["empresas"]), "motivo_parada": cad_["motivo_parada"],
                "acima": cad_["acima"], "listada_cvm": k in listadas}

    grupos_ord = sorted(at["grupos"].items(), key=lambda kv: -kv[1]["kw_prop"])
    grupos_pub = [pub_grupo(k, g) for k, g in grupos_ord[:40]]
    donos_ord = sorted(at["donos"].items(), key=lambda kv: -kv[1]["kw_prop"])
    donos_pub = []
    for k, d in donos_ord[:40]:
        cad_ = cadeia(k)
        donos_pub.append({"cnpj": k, "nome": nomes.get(k), "sigla": (agentes.get(k) or {}).get("sigla"),
                          "usinas": d["usinas"], "usinas_operacao": d["usinas_operacao"],
                          "mw_proporcional": _r(_mw(d["kw_prop"]), 1), "mw_controle_direto": _r(_mw(d["kw_controle"]), 1),
                          "usinas_controle_direto": d["usinas_controle"], "no_cadastro_agentes": k in agentes,
                          "regimes": sorted(d["regimes"]), "grupo": cad_["topo"] if cad_["topo"] != k else None,
                          "grupo_nome": nomes.get(cad_["topo"]) if cad_["topo"] != k else None})
    motivos = collections.Counter(cadeia(k)["motivo_parada"] for k in at["donos"])
    com_grupo_acima = [k for k in at["donos"] if cadeia(k)["topo"] != k]
    kw_consolidado = sum(at["donos"][k]["kw_prop"] for k in com_grupo_acima)

    # ---------------------------------------------------------------- P037: distribuidoras
    distrib = _indice_distribuidoras(golds, agentes, cvm_cad, cadeia, nomes, at["donos"])
    # ---------------------------------------------------------------- P038: finanças
    universo_cvm = sorted(k for k, r in cvm_cad.items() if r.get("setor") in cv.SETORES_ENERGIA or k in distrib["cnpjs"])
    fin = _financas(con, cvm_cad, universo_cvm, nomes)
    if fin["ativo_invalido"]:
        return c.stub(GOLD, f"validação crítica: ativo total ≤ 0 em {len(fin['ativo_invalido'])} valores publicáveis da CVM, ex.: {fin['ativo_invalido'][:3]}")
    financas = _bloco_financas(fin, cvm_cad, universo_cvm, distrib, cadeia, listadas, nomes, snap_dfp, snap_itr, con)

    # controle e concentração por grupo cruzam duas datas: a fotografia do SIGA e as
    # declarações ao Polímero da janela de quatro trimestres até o de referência
    janela_pol = (grafo or {}).get("janela") or []
    periodo_controle = {"inicio": _inicio_trimestre(janela_pol[0]) if janela_pol else data_siga, "fim": data_siga}
    nota_periodos = (f"Período composto: SIGA em {evid._data_br(data_siga)} e declarações ao Polímero de "
                     f"{ae.rotulo_periodo(janela_pol[0])} a {ae.rotulo_periodo(janela_pol[-1])} (a última de cada agente na janela)"
                     if janela_pol else f"SIGA em {evid._data_br(data_siga)}; Polímero indisponível")
    # ---------------------------------------------------------------- evidências
    ev_cob = evid.construir(
        indicador="Potência em operação com todos os proprietários identificados por CNPJ",
        valor_exibido=f"{_br_num(pct_mw_vinc, 1)}%", valor_calculo=pct_mw_vinc, unidade="% da potência fiscalizada em operação",
        periodo={"inicio": data_siga, "fim": data_siga}, entidade="Usinas em operação no SIGA (Brasil)",
        universo=f"{_br_num(sum(at['estados'][e]['usinas_operacao'] for e in ESTADOS), 0)} usinas em fase Operação",
        fonte=evid.fonte_de_vintage("ANEEL", "SIGA: Sistema de Informações de Geração da ANEEL", URL_SIGA, v_siga),
        consulta="SIGA diário, DscFaseUsina = 'Operação'; DscPropriRegimePariticipacao lido por inteiro; vinculado = todas as parcelas com CNPJ e soma das participações a 100% ± 0,005 p.p. por parcela",
        formula="100 × Σ potência fiscalizada das usinas vinculadas ÷ Σ potência fiscalizada das usinas em operação",
        numerador={"descricao": "Σ potência fiscalizada das usinas em operação vinculadas (kW)", "valor": _r(vinc["kw_operacao"], 1)},
        denominador={"descricao": "Σ potência fiscalizada das usinas em operação (kW)", "valor": _r(total_kw_op, 1)},
        cobertura=f"{_br_num(total_usinas, 0)} usinas no SIGA de {evid._data_br(data_siga)}, todas as fases; a razão usa só as em operação",
        tratamento_ausencia="Usina com proprietário 'Não Informado' entra no denominador e fora do numerador; potência fiscalizada vazia conta como ausente (nunca zero) e fica fora das duas somas.",
        revisoes=snap_siga.get("revisoes"),
        testes=[evid.teste("Campo de proprietários lido por inteiro", "aprovado",
                           f"{_br_num(total_usinas - oc_siga['proprietarios_nao_informados'], 0)} de {_br_num(total_usinas - oc_siga['proprietarios_nao_informados'], 0)} campos preenchidos lidos sem sobra; {oc_siga['proprietarios_nao_informados']} 'Não Informado'"),
                evid.teste("Partição sem dupla contagem", "aprovado",
                           "Σ potência proporcional por proprietário + parcela sem CNPJ = potência válida da fronteira (diferença relativa < 10⁻⁹)")],
        reconciliacao=evid.reconciliacao(
            f"Conferência usina a usina com o conjunto Agentes de Geração ({evid._data_br(data_agger)}): {_br_num(comp['iguais'], 0)} de {_br_num(comp['comparadas'], 0)} usinas com a mesma lista de CNPJ e os mesmos percentuais" if comp else "Agentes de Geração indisponível",
            ("aprovado" if comp and comp["iguais"] >= 0.98 * comp["comparadas"] else "ressalva"),
            "0,01 p.p. por parcela (precisão de 2 casas do conjunto Agentes de Geração); 98% das usinas iguais: os arquivos têm datas diferentes (01/09 e 30/09) e a causa de cada CNPJ diferente (troca de proprietário ou divergência de cadastro) não é verificada"),
        download=[{"rotulo": "Usinas e proprietários (CSV)", "url": _url(CSV_ATIVOS)}], reproducao=REPRODUCAO)
    ev_hhi = evid.construir(
        indicador="Índice Herfindahl-Hirschman da potência em operação por grupo de controle",
        valor_exibido=_br_num(conc_grp["hhi"], 0), valor_calculo=conc_grp["hhi"], unidade="pontos (0 a 10.000)",
        periodo=periodo_controle,
        entidade="Grupos (topo da cadeia de controladores únicos declarada à ANEEL)",
        universo=f"{_br_num(conc_grp['participantes'], 0)} grupos; fronteira de {_br_num(_mw(total_valido), 0)} MW fiscalizados em {_br_num(fr['usinas_validas'], 0)} usinas em operação com participações válidas",
        fonte={**evid.fonte_de_vintage("ANEEL", "SIGA e Composição Societária (Polímero)", URL_SIGA, v_siga),
               "arquivos": [evid.arquivo_de_vintage(v_siga)] + ([evid.arquivo_de_vintage(v_pol)] if v_pol else [])},
        consulta=f"SIGA de {data_siga} (fase Operação, participações válidas) × grafo de controle do Polímero, trimestre de referência {ae.rotulo_periodo(pol['referencia']) if pol and pol['referencia'] else 'indisponível'}. {nota_periodos}.",
        formula="Σ_g (100 × P_g ÷ T)², P_g = Σ potência × participação detida por empresas cujo topo de cadeia é g; T = potência da fronteira",
        pesos="Potência fiscalizada (kW) de cada usina × participação publicada no SIGA",
        exclusoes=["Usinas fora de operação", "Usinas sem proprietário informado ou com participações que não somam 100%",
                   "Micro e minigeração distribuída (não está no SIGA)"],
        cobertura=f"{_br_num(100.0 * total_valido / total_kw_op, 1)}% da potência fiscalizada em operação no SIGA",
        tratamento_ausencia=f"Parcela sem CNPJ (pessoas físicas, {_br_num(_mw(fr['kw_sem_documento']), 1)} MW) fica no denominador e fora dos participantes: o índice é um limite inferior.",
        revisoes=snap_siga.get("revisoes"),
        testes=[evid.teste("Soma das cotas", "aprovado", f"cotas dos grupos somam {_br_num(sum(s for _, s in conc_grp['_cotas']), 3)}% da fronteira; o restante é a parcela sem CNPJ"),
                evid.teste("Partição por grupo igual à partição por proprietário direto", "aprovado",
                           "Σ potência proporcional dos grupos = Σ potência proporcional dos proprietários diretos (diferença relativa < 10⁻⁹)")],
        download=[{"rotulo": "Grupos (CSV)", "url": _url(CSV_GRUPOS)}, {"rotulo": "Proprietários (CSV)", "url": _url(CSV_PROPRIETARIOS)}],
        reproducao=REPRODUCAO)

    # ---------------------------------------------------------------- CSVs e arquivos sob demanda
    _escreve_csvs(at, usinas, agentes, nomes, cadeia, grafo, pol, distrib, fin, financas, cvm_cad, universo_cvm,
                  data_cadastro, listadas, total_valido)

    periodo_siga = {"inicio": data_siga, "fim": data_siga}
    lim_siga = [
        "O SIGA registra a propriedade direta (a empresa titular da outorga, em geral uma sociedade de propósito específico); o grupo econômico vem da Composição Societária declarada à ANEEL, com as regras de controle publicadas neste módulo.",
        "Potência fiscalizada é a capacidade instalada em operação conforme a fiscalização da ANEEL; usina fora de operação não tem potência fiscalizada e entra pela outorgada só nas contagens de carteira.",
        "Micro e minigeração distribuída não está no SIGA e fica fora de todas as medidas de capacidade deste módulo.",
    ]
    prov = {
        "cadastro_agentes": c.proveniencia(
            indicador="Cadastro de agentes do setor elétrico (pessoas jurídicas e ramos)", natureza="OBSERVADO",
            fonte=fonte_agentes, unidade="pessoas jurídicas", frequencia="mensal (fonte)",
            periodo={"inicio": data_cadastro, "fim": data_cadastro}, cobertura={"inicio": data_cadastro, "fim": data_cadastro},
            capturado_em=v_agentes["capturado_em"], snapshot=snap_ag,
            limitacoes=["Os indicadores de ramo são autodeclarados: há parques solares e agências reguladoras marcados como 'distribuição'. Distribuidora é definida pela presença nas bases reguladas (SAMP, tarifas, continuidade), não por esse indicador.",
                        "O cadastro é uma fotografia mensal; um CNPJ inativo continua listado com situação I."],
            download=_url(CSV_AGENTES)),
        "ativos": c.proveniencia(
            indicador="Usinas, potência e vínculos de propriedade", natureza="OBSERVADO", fonte=fonte_siga, unidade="MW",
            frequencia="diária (fonte)", periodo=periodo_siga, cobertura=periodo_siga,
            capturado_em=v_siga["capturado_em"], snapshot=snap_siga, limitacoes=lim_siga,
            transformacoes=["kW → MW (÷ 1.000)", "texto de proprietários lido por expressão regular ancorada (campo inteiro ou nada)",
                            "CNPJ canônico de 14 dígitos"],
            download=_url(CSV_ATIVOS)),
        "controle": c.proveniencia(
            indicador="Capacidade proporcional e sob controle por proprietário e por grupo", natureza="CALCULADO",
            fonte=fonte_pol, unidade="MW", frequencia="trimestral (Polímero); diária (SIGA)", periodo=periodo_controle,
            notas_fonte=nota_periodos,
            cobertura={"inicio": ae.rotulo_periodo(min(pol["periodos"])) if pol else None,
                       "fim": ae.rotulo_periodo(pol["referencia"]) if pol and pol["referencia"] else None},
            capturado_em=(v_pol or v_siga)["capturado_em"], snapshot=snap_pol,
            formula="proporcional = Σ potência fiscalizada × participação; controle = Σ potência das usinas cujo proprietário majoritário (> 50%) pertence ao grupo",
            limitacoes=[
                "Grupo = topo da cadeia de controladores ÚNICOS declarados; controle compartilhado, controlador pessoa física, controlador sem CNPJ, declarações discordantes ou ausentes encerram a cadeia no último CNPJ provado (motivo publicado).",
                "O percentual do Polímero é relativo ao agente declarante; o percentual direto entre dois nós só é publicado quando o pai aparece uma vez na árvore.",
                "Capacidade sob controle usa o critério de maioria (> 50%) da participação no ativo; acordos de acionistas que dão controle a minoritários não estão na fonte.",
                "Não há participação econômica indireta (look-through) dos grupos: a capacidade proporcional do grupo soma as participações diretas das empresas que ele controla, sem multiplicar pela fração do grupo nelas.",
                "O grafo vigente usa a última declaração de cada agente nos quatro trimestres até o de referência; agentes sem declaração nesse intervalo ficam sem controlador atribuído."],
            download=_url(CSV_GRUPOS)),
        "concentracao": c.proveniencia(
            indicador="Concentração da potência em operação (HHI, CR4, CR10)", natureza="CALCULADO", fonte=fonte_siga,
            unidade="pontos (HHI) e %", frequencia="diária (SIGA) e trimestral (Polímero)", periodo=periodo_controle,
            cobertura=periodo_siga, capturado_em=v_siga["capturado_em"], snapshot=snap_siga,
            notas_fonte=nota_periodos + ". O HHI por proprietário direto usa só o SIGA; por grupo usa as duas fontes.",
            formula="HHI = Σ (cota em %)²; CR4 e CR10 = soma das 4 e 10 maiores cotas",
            limitacoes=[
                "Fronteira: potência fiscalizada das usinas em operação no SIGA com participações válidas, Brasil. Não é o mercado relevante de um caso concorrencial (que considera energia vendida, submercado e contratos).",
                "A parcela de pessoas físicas fica fora dos participantes; o índice é um limite inferior.",
                "Por proprietário direto o índice subestima a concentração (cada sociedade de propósito específico conta como participante); por grupo depende da cobertura da Composição Societária."],
            download=_url(CSV_GRUPOS)),
    }

    gold = {
        **c.cabecalho(GOLD),
        "datas": {"siga": data_siga, "agentes_geracao": data_agger, "cadastro_agentes": data_cadastro,
                  "polimero_referencia": ae.rotulo_periodo(pol["referencia"]) if pol and pol["referencia"] else None,
                  "polimero_janela": [ae.rotulo_periodo(p_) for p_ in janela_pol],
                  "cvm_cadastro_capturado_em": v_cad["capturado_em"] if v_cad else None},
        "definicoes": {
            "vinculo": "Vínculo provado = CNPJ publicado pela fonte oficial no mesmo registro do ativo. Nenhum vínculo por semelhança de nome.",
            "capacidade_proporcional": "Potência fiscalizada da usina × participação do proprietário ÷ soma das participações publicadas (100% dentro da tolerância de arredondamento), somada sobre as usinas em operação com participações válidas.",
            "capacidade_controle_direto": "Potência fiscalizada das usinas em operação em que o proprietário tem mais de 50% (maioria da propriedade do ativo).",
            "grupo": "Topo da cadeia de controladores únicos declarada à ANEEL (Composição Societária): sobe-se de sócio controlador em sócio controlador enquanto há um único controlador com CNPJ.",
            "capacidade_controle_grupo": "Potência das usinas em operação cujo proprietário majoritário pertence ao grupo (está na cadeia de controle que termina nele).",
            "capacidade_proporcional_grupo": "Soma das participações diretas detidas pelas empresas do grupo (potência × participação); cada parcela pertence a um só grupo, por isso as parcelas somam a fronteira sem dupla contagem.",
            "hhi": "Índice Herfindahl-Hirschman: soma dos quadrados das cotas em % (0 a 10.000).",
        },
        "cadastro": {
            "agentes": {"data": data_cadastro, "total": len(agentes), "ativos": sum(1 for a in agentes.values() if a["ativo"]),
                        "ramos": {r: sum(1 for a in agentes.values() if a["ativo"] and r in a["ramos"])
                                  for r in ("geracao", "distribuicao", "transmissao", "comercializacao")}},
            "ativos": {
                "data": data_siga, "usinas": total_usinas,
                "por_fase": [{"fase": f, "usinas": x["usinas"], "mw_outorgado": _r(_mw(x["kw_outorgado"]), 1),
                              "mw_fiscalizado": _r(_mw(x["kw_fiscalizado"]), 1)}
                             for f, x in sorted(por_fase.items(), key=lambda kv: -kv[1]["usinas"])],
                "operacao": {"usinas": sum(at["estados"][e]["usinas_operacao"] for e in ESTADOS),
                             "mw_fiscalizado": _r(_mw(total_kw_op), 1)},
                "estados": estados_pub,
                "pct_mw_operacao_vinculado": _r(pct_mw_vinc, 2),
                "pct_usinas_vinculadas": _r(100.0 * vinc["usinas"] / total_usinas, 2),
                "proprietarios_cnpj": len(proprietarios_cnpj), "proprietarios_no_cadastro": len(no_cadastro),
                "proprietarios_fora_do_cadastro": len(fora_cadastro),
                "por_regime": [{"regime": k, "rotulo": ROTULO_REGIME.get(k, k), "parcelas": x["parcelas"],
                                "mw_proporcional": _r(_mw(x["kw_prop"]), 1)}
                               for k, x in sorted(por_regime.items(), key=lambda kv: -kv[1]["kw_prop"])],
                "sem_vinculo": sem_vinculo_pub, "sem_vinculo_total": len(sem_vinculo),
                "conferencia_agentes_geracao": comp and {**{k: comp[k] for k in ("comparadas", "iguais", "cnpj_diferentes", "percentual_diferente", "so_no_siga", "so_em_agentes")},
                                                         "data": data_agger, "exemplos": comp["exemplos"][:8],
                                                         "nota": "CNPJ diferente nas duas fontes; causa não verificada (troca de proprietário entre as datas dos arquivos ou divergência de cadastro): cada fonte tem uma única captura."},
                "evidencia": ev_cob,
            },
            "proprietarios": donos_pub,
        },
        "distribuidoras": distrib["bloco"],
        "financas": financas["bloco"],
        "controle": {
            "polimero": _bloco_polimero(pol, grafo),
            "fronteira": {
                "descricao": "Potência fiscalizada das usinas em fase Operação no SIGA cujas participações publicadas somam 100%, Brasil, na data do SIGA. Exclui micro e minigeração distribuída.",
                "data": data_siga, "mw": _r(_mw(total_valido), 1), "usinas": fr["usinas_validas"],
                "mw_operacao_total": _r(_mw(total_kw_op), 1),
                "mw_fora": _r(_mw(total_kw_op - total_valido), 1),
                "mw_sem_documento": _r(_mw(fr["kw_sem_documento"]), 1),
                "mw_sem_controlador_majoritario": _r(_mw(fr["kw_sem_majoritario"]), 1),  # nenhum CNPJ acima de 50%
                "usinas_sem_controlador_majoritario": fr["usinas_sem_majoritario"],
            },
            "concentracao": {
                "proprietario_direto": _pub_conc(conc_dir, nomes),
                "grupo_proporcional": _pub_conc(conc_grp, nomes),
                "grupo_controle": _pub_conc(conc_ctl, nomes),
                "por_tipo": por_tipo,
                "evidencia": ev_hhi,
            },
            "cobertura": {
                "proprietarios": len(at["donos"]), "proprietarios_com_grupo_acima": len(com_grupo_acima),
                "mw_consolidado_em_grupo": _r(_mw(kw_consolidado), 1),
                "pct_mw_consolidado_em_grupo": _r(100.0 * kw_consolidado / total_valido, 2),
                "motivos_parada": [{"motivo": m, "rotulo": ae.MOTIVOS_TOPO.get(m, m), "proprietarios": n}
                                   for m, n in motivos.most_common()],
            },
            "grupos": grupos_pub,
        },
        "validacao": {"criticas": criticas, "ressalvas": ressalvas + financas["ressalvas"],
                      "identidades": {"particao_grupos": identidade_ok, "particao_fronteira": identidade_total}},
        "bloqueios": BLOQUEIOS,
        "decisoes_metodo": DECISOES_METODO,
        "proveniencia": {**prov, **distrib["proveniencia"], **financas["proveniencia"]},
        "downloads": [
            {"rotulo": "Usinas e proprietários (CSV)", "url": _url(CSV_ATIVOS)},
            {"rotulo": "Proprietários diretos (CSV)", "url": _url(CSV_PROPRIETARIOS)},
            {"rotulo": "Grupos de controle (CSV)", "url": _url(CSV_GRUPOS)},
            {"rotulo": "Cadeia societária vigente (CSV)", "url": _url(CSV_CADEIA)},
            {"rotulo": "Cadastro de agentes (CSV)", "url": _url(CSV_AGENTES)},
            {"rotulo": "Distribuidoras (CSV)", "url": _url(CSV_DISTRIBUIDORAS)},
            {"rotulo": "Companhias abertas do universo (CSV)", "url": _url(CSV_COMPANHIAS)},
            {"rotulo": "Demonstrações anuais, DFP (CSV)", "url": _url(CSV_FINANCAS)},
            {"rotulo": "Informações trimestrais, ITR (CSV)", "url": _url(CSV_FINANCAS_TRIM)},
        ],
        "series": {"ativos": _url(JSON_ATIVOS), "cadeia": _url(JSON_CADEIA), "financas": _url(JSON_FINANCAS),
                   "evidencias": _url(JSON_EVID)},
    }
    return gold


BLOQUEIOS = [
    {"id": "demonstracoes_regulatorias", "painel": "P038",
     "descricao": "Demonstrações regulatórias das distribuidoras (Balancete Mensal Padronizado e base de dados da sustentabilidade econômico-financeira) não integradas.",
     "evidencia": "Em 30/09/2026, git.aneel.gov.br respondeu HTTP 403 com cf-mitigated: challenge (desafio do Cloudflare) para os arquivos da base de sustentabilidade (2026_1T_base_dados_sustentabilidade.zip) e para a listagem da pasta; http://informacoesbmp.aneel.gov.br/ respondeu HTTP 503. Nenhum conjunto equivalente no portal de dados abertos da ANEEL (buscas: balancete, econômico-financeiro, demonstrações). O acesso não foi contornado.",
     "alternativa": "Demonstrações societárias da CVM (DFP e ITR), rotuladas como societárias; as regulatórias ficam como pendência."},
    {"id": "transmissao", "painel": "P036",
     "descricao": "Ativos de transmissão não vinculados a CNPJ.",
     "evidencia": "O SIGET (dados abertos da ANEEL) identifica contratos de concessão por código interno (IdeCcd), sem CNPJ da concessionária; nenhum outro conjunto aberto liga o contrato ao CNPJ.",
     "alternativa": "Transmissoras aparecem no cadastro de agentes (ramo transmissão) e, quando abertas, nas finanças da CVM."},
    {"id": "look_through", "painel": "P039",
     "descricao": "Participação econômica indireta dos grupos (look-through) não calculada.",
     "evidencia": "O Polímero publica o percentual em relação ao agente declarante e há caminhos múltiplos; o módulo publica a capacidade sob controle e a capacidade proporcional das participações diretas das controladas, métricas sem dupla contagem.",
     "alternativa": "Árvore societária com percentuais diretos quando definidos (CSV da cadeia)."},
]


# Escolhas de método que não são bloqueio de fonte (seção 2.3 da especificação): o insumo
# existe, e o observatório decidiu não publicar a medida nesta fase, dizendo por quê.
DECISOES_METODO = [
    {"id": "ebitda", "painel": "P038",
     "decisao": "EBITDA não é publicado nesta fase; publica-se a conta 3.05 (resultado antes do resultado financeiro e dos tributos), rotulada como tal.",
     "insumo_disponivel": "A DFP e o ITR não têm conta de EBITDA, mas a depreciação, amortização e exaustão é conta fixa da Demonstração do Valor Adicionado (7.04.01; na DVA consolidada da CEMIG de 2025, R$ -1.533.416 mil). 3.05 menos 7.04.01 daria um EBITDA calculado pelo observatório.",
     "motivo": "O módulo não lê a DVA nesta fase, e um EBITDA calculado assim pode diferir do divulgado pela companhia (ajustes e itens não recorrentes nos releases); publicá-lo exige rótulo de medida calculada pelo observatório e conferência com os valores divulgados.",
     "como_mudar": "Ler a conta 7.04.01 da DVA no mesmo processamento da DFP e do ITR e publicar 'resultado antes do resultado financeiro, dos tributos e da depreciação (calculado)' com natureza CALCULADO."},
]


def _texto_versoes(doc):
    """Texto de revisões de um documento da CVM a partir do índice do zip."""
    v, n = doc.get("versao"), int(doc.get("versoes") or 0)
    if not v:
        return "Versão do documento não identificada no índice do arquivo."
    if n <= 1:
        return f"Versão {v} do documento; nenhuma outra versão entregue."
    return f"Versão {v} do documento, a mais recente de {n} versões entregues à CVM."


def _pub_conc(conc, nomes):
    if conc is None:
        return None
    return {"hhi": conc["hhi"], "faixa": _faixa_hhi(conc["hhi"]), "cr4": conc["cr4"], "cr10": conc["cr10"],
            "participantes": conc["participantes"],
            "maiores": [{"cnpj": k, "nome": nomes.get(k), "pct": _r(s, 3)} for k, s in conc["_cotas"][:10]]}


def _bloco_polimero(pol, grafo):
    if not pol:
        return None
    return {
        "trimestre_referencia": ae.rotulo_periodo(pol["referencia"]) if pol["referencia"] else None,
        "janela": [ae.rotulo_periodo(p) for p in (grafo or {}).get("janela", [])],
        "declarantes": (grafo or {}).get("declarantes"), "fora_janela": (grafo or {}).get("fora_janela"),
        "nos": len((grafo or {}).get("origem", {})),
        "nos_ambiguos": len((grafo or {}).get("ambiguos", [])),
        "limiar_concordancia": ae.LIMIAR_CONCORDANCIA,
        "periodos": [{"trimestre": ae.rotulo_periodo(p), "declarantes": n} for p, n in sorted(pol["periodos"].items())],
        "linhas": pol["ocorrencias"]["linhas"], "arvores": pol["ocorrencias"]["arvores"],
        "percentual_ausente": pol["ocorrencias"]["pct_ausente"],
        "agentes_com_mudanca_relevante_declarada": len(pol["eventos"]),
    }


# ======================================================================= P037
def _slugs_unicos(itens):
    """Slug principal pela sigla de exibição. Quando duas distribuidoras têm a mesma sigla (a
    incorporada e a incorporadora, como RGE e RGE Sul), a única ativa do grupo fica com o
    slug simples e as demais recebem a raiz do CNPJ; sem uma única ativa, todas recebem.
    Aliases (slugs das outras siglas publicadas pelas fontes) só entram quando não colidem."""
    grupos = collections.defaultdict(list)
    for i in itens:
        grupos[entidades.slug(i["sigla"]) or i["cnpj"]].append(i)
    for s, membros in grupos.items():
        ativos = [i for i in membros if i["ativa"]]
        for i in membros:
            simples = len(membros) == 1 or (len(ativos) == 1 and i is ativos[0])
            i["slug"] = s if simples else f"{s}-{i['cnpj'][:8]}"
    principais = {i["slug"] for i in itens}
    contagem_alias = collections.Counter(a for i in itens for a in {entidades.slug(x["sigla"]) for x in i["siglas"]} - {i["slug"]})
    for i in itens:
        i["slugs_alternativos"] = sorted(a for a in {entidades.slug(x["sigla"]) for x in i["siglas"]}
                                         if a and a != i["slug"] and a not in principais and contagem_alias[a] == 1)


def _sigla_valida(s):
    s = (s or "").strip()
    return s if s and s.lower() not in ("não informado", "nao informado") else None


def _indice_distribuidoras(golds, agentes, cvm_cad, cadeia, nomes, donos):
    P = {d["cnpj"]: d for d in ((golds.get("perdas.json") or {}).get("distribuidoras") or [])}
    Q = {d["cnpj"]: d for d in ((golds.get("qualidade.json") or {}).get("distribuidoras") or [])}
    t = ((golds.get("conta.json") or {}).get("tarifas") or {})
    CV = {d["cnpj"]: d for d in (t.get("vigentes") or [])}
    CS = {d["cnpj"]: d for d in (t.get("sem_vigente") or [])}
    cnpjs = sorted(set(P) | set(Q) | set(CV) | set(CS))
    itens = []
    for x in cnpjs:
        p, q, cvg, cs = P.get(x), Q.get(x), CV.get(x), CS.get(x)
        siglas = []
        for fonte, s in (("tarifas", (cvg or cs or {}).get("sigla")), ("continuidade", (q or {}).get("sigla")),
                         ("samp", (p or {}).get("sigla")), ("cadastro_agentes", (agentes.get(x) or {}).get("sigla"))):
            s = _sigla_valida(s)
            if s and s not in [y["sigla"] for y in siglas]:
                siglas.append({"sigla": s, "fonte": fonte})
        sigla = siglas[0]["sigla"] if siglas else x
        nome = (agentes.get(x) or {}).get("razao_social") or (p or {}).get("nome") or (cvg or cs or {}).get("nome")
        classificacao = (p or {}).get("classificacao") or (q or {}).get("classificacao")
        grupo = (p or {}).get("grupo") or ({"Concessionária": "concessionaria", "Permissionária": "permissionaria"}.get((q or {}).get("classificacao")))
        conflito_classe = bool(p and q and p.get("grupo") and q.get("classificacao") and
                               {"concessionaria": "Concessionária", "permissionaria": "Permissionária"}.get(p["grupo"]) != q["classificacao"])
        terr = (p or {}).get("territorio") or {}
        ref = (p or {}).get("referencia") or {}
        cad_ = cadeia(x)
        cvm = cvm_cad.get(x)
        dono = donos.get(x)
        itens.append({
            "cnpj": x, "sigla": sigla, "siglas": siglas,
            "nome": nome, "classificacao": classificacao, "grupo": grupo,
            "conflito_classificacao": conflito_classe, "ufs": terr.get("ufs") or [],
            "ativa": bool((p or {}).get("ativa") or cvg or q),
            "perdas": ({"ano": ref.get("ano"), "taxa_total_pct": ref.get("taxa_total_pct"), "pnt_bt_pct": ref.get("pnt_bt_pct"),
                        "perdas_totais_mwh": ref.get("perdas_totais_mwh"), "completo": ref.get("completo"),
                        "ultima_competencia": p.get("ultima_competencia")} if p else None),
            "qualidade": ({"ano": q.get("ano"), "dec": q.get("dec"), "fec": q.get("fec"), "dec_limite": q.get("dec_limite"),
                           "fec_limite": q.get("fec_limite"), "ucs": q.get("ucs"), "posicao_ranking": q.get("posicao_ranking"),
                           "porte": q.get("porte_ranking")} if q else None),
            "tarifa": ({"total": cvg.get("total"), "te": cvg.get("te"), "tusd": cvg.get("tusd"), "inicio": cvg.get("inicio"),
                        "fim": cvg.get("fim"), "ato": cvg.get("ato"), "posicao": cvg.get("posicao"), "vigente": True}
                       if cvg else ({"vigente": False, "motivo": cs.get("motivo"), "ultima_vigencia": cs.get("ultima_vigencia")} if cs else None)),
            "controle": {"topo": cad_["topo"] if cad_["topo"] != x else None,
                         "topo_nome": nomes.get(cad_["topo"]) if cad_["topo"] != x else None,
                         # nomes dos nós da cadeia em empresas_cadeia.json (nos[cnpj][0]); a gold tem teto de tamanho
                         "cadeia": cad_["cadeia"],
                         "motivo_parada": cad_["motivo_parada"], "acima": cad_["acima"]},
            "cvm": ({"cd_cvm": cvm.get("cd_cvm"), "situacao": cvm.get("situacao"), "setor": cvm.get("setor")} if cvm else None),
            "geracao": ({"usinas": dono["usinas"], "mw_proporcional": _r(_mw(dono["kw_prop"]), 3)} if dono else None),
        })
    _slugs_unicos(itens)
    geradas = {n: (golds.get(n) or {}).get("gerado_em") for n in ("perdas.json", "qualidade.json", "conta.json")}
    # evolução própria: as golds de origem publicam a série histórica de cada distribuidora em
    # arquivos sob demanda indexados pelo mesmo CNPJ; o índice diz onde ler e que anos há
    series_evol = _series_evolucao(golds)
    for i in itens:
        # "primeiro/último" (ano, ou data de vigência na tarifa); módulo sem série para o CNPJ fica de fora
        i["evolucao"] = {k: "/".join("" if x is None else str(x) for x in v["cobertura"][i["cnpj"]])
                         for k, v in series_evol.items() if v and i["cnpj"] in v["cobertura"]}
    bloco = {
        "regra_universo": "CNPJ presente em ao menos uma base regulada de distribuição já integrada: SAMP Balanço (módulo Perdas), indicadores de continuidade (módulo Qualidade) ou tarifas de aplicação (módulo Conta de luz). O indicador de ramo 'distribuição' do cadastro de agentes não define o universo (é autodeclarado e inclui parques solares).",
        "golds_origem": {n: {"gerado_em": g, "disponivel": golds.get(n) is not None} for n, g in geradas.items()},
        "series_evolucao": {k: ({x: v[x] for x in ("url", "chave", "campos", "unidade")} if v else None) for k, v in series_evol.items()},
        "pares": "Comparar com distribuidoras do mesmo grupo (concessionária ou permissionária) e, na continuidade, do mesmo porte do ranking da ANEEL (campo qualidade.porte); anos de referência diferentes entre módulos não se comparam.",
        "resumo": {
            "distribuidoras": len(itens), "ativas": sum(1 for i in itens if i["ativa"]),
            "concessionarias": sum(1 for i in itens if i["grupo"] == "concessionaria"),
            "permissionarias": sum(1 for i in itens if i["grupo"] == "permissionaria"),
            "com_perdas": sum(1 for i in itens if i["perdas"]), "com_qualidade": sum(1 for i in itens if i["qualidade"]),
            "com_tarifa_vigente": sum(1 for i in itens if i["tarifa"] and i["tarifa"].get("vigente")),
            "com_controlador_acima": sum(1 for i in itens if i["controle"]["topo"]),
            "companhias_abertas": sum(1 for i in itens if i["cvm"] and i["cvm"]["situacao"] == "ATIVO"),
            "conflitos_classificacao": sum(1 for i in itens if i["conflito_classificacao"]),
            "sem_uf": sum(1 for i in itens if not i["ufs"]),
            "com_evolucao": {k: sum(1 for i in itens if i["evolucao"].get(k)) for k in series_evol},
        },
        "indice": itens,
    }
    anos_p = sorted({i["perdas"]["ano"] for i in itens if i["perdas"] and i["perdas"].get("ano")})
    anos_q = sorted({i["qualidade"]["ano"] for i in itens if i["qualidade"] and i["qualidade"].get("ano")})
    data_tarifa = (golds.get("conta.json") or {}).get("data_referencia")
    inicio_idx = min([f"{a}-01-01" for a in anos_p[:1] + anos_q[:1]] + ([data_tarifa] if data_tarifa else []), default=None)
    fim_idx = max([f"{a}-12-31" for a in anos_p[-1:] + anos_q[-1:]] + ([data_tarifa] if data_tarifa else []), default=None)
    snap_golds = {"id": "golds:" + ",".join(f"{n}@{g}" for n, g in geradas.items() if g), "sha256": None}
    lim_copia = "Valor copiado da gold de origem pelo CNPJ, sem recálculo; valem a definição e as limitações do módulo de origem (proveniência completa na gold de origem)."
    prov = {"distribuidoras": c.proveniencia(
        indicador="Índice de distribuidoras: identidade, sigla, classificação, UFs e controle", natureza="OBSERVADO",
        fonte=_fonte("ANEEL", "SAMP Balanço, indicadores de continuidade e tarifas de aplicação (via golds dos módulos)",
                     "perdas.json, qualidade.json, conta.json", "https://dadosabertos.aneel.gov.br/dataset/samp-balanco",
                     "https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica", LICENCA_ANEEL),
        unidade="distribuidoras", frequencia="a de cada módulo de origem",
        # período do dado: anos de referência de perdas e continuidade e data das tarifas vigentes
        # (a data de geração de cada gold fica só em golds_origem)
        periodo={"inicio": inicio_idx or "", "fim": fim_idx or ""},
        cobertura={"inicio": inicio_idx or "", "fim": fim_idx or ""}, capturado_em=None,
        snapshot=snap_golds,
        notas_fonte="Sem captura própria: CNPJ, siglas e classificação vêm das golds perdas.json, qualidade.json e conta.json na geração indicada em golds_origem; os números de perdas, continuidade e tarifa têm proveniência própria (distribuidoras_perdas, distribuidoras_pnt, distribuidoras_qualidade, distribuidoras_tarifa), com a natureza herdada da gold de origem.",
        limitacoes=["UFs vêm da relação conjunto elétrico × município da ANEEL (módulo Perdas); distribuidoras sem conjuntos vigentes ficam sem UF.",
                    "A sigla de exibição segue a prioridade tarifas, continuidade, SAMP, cadastro de agentes; todas as siglas publicadas ficam em 'siglas'."],
        download=_url(CSV_DISTRIBUIDORAS))}
    origem = [
        ("distribuidoras_perdas", "perdas.json", [("proveniencia", "taxas")], "Taxa de perdas totais da distribuidora (cópia da gold de Perdas)", anos_p, None),
        ("distribuidoras_pnt", "perdas.json", [("proveniencia", "separacao"), ("proveniencia", "taxas")], "Perdas não técnicas sobre o mercado de baixa tensão (cópia da gold de Perdas)", anos_p, None),
        ("distribuidoras_qualidade", "qualidade.json", [("proveniencia", "distribuidoras"), ("proveniencia", "limites")], "DEC, FEC e limites anuais da distribuidora (cópia da gold de Qualidade)", anos_q, None),
        ("distribuidoras_tarifa", "conta.json", [("tarifas", "proveniencia")], "Tarifa B1 residencial convencional vigente (cópia da gold de Conta de luz)", None, data_tarifa),
    ]
    for chave, nome_gold, caminhos, indicador, anos, data_ref in origem:
        provs = [((golds.get(nome_gold) or {}).get(a) or {}).get(b) for a, b in caminhos]
        provs = [x for x in provs if isinstance(x, dict) and x.get("natureza")]
        if not provs:
            prov[chave] = None
            continue
        # natureza herdada: a mais fraca entre os blocos de origem usados (PNT: separação
        # ESTIMADA pela fonte, dividida pelo mercado de baixa tensão medido)
        nat = max((x["natureza"] for x in provs), key=c.NATUREZAS.index)
        p0 = provs[0]
        periodo = ({"inicio": str(anos[0]), "fim": str(anos[-1])} if anos else
                   ({"inicio": data_ref, "fim": data_ref} if data_ref else p0.get("periodo_referencia") or {"inicio": "", "fim": ""}))
        formula = " ; ".join(x["formula"] for x in provs if x.get("formula")) or None
        prov[chave] = c.proveniencia(
            indicador=indicador, natureza=nat, fonte=p0["fonte"], unidade=p0.get("unidade") or "",
            frequencia=p0.get("frequencia") or "", periodo=periodo,
            cobertura=p0.get("cobertura_historica") or periodo, capturado_em=p0.get("capturado_em"),
            snapshot=p0.get("snapshot") or {"id": None, "sha256": None},
            publicado_em=p0.get("publicado_pela_fonte_em"),
            formula=formula or (f"cópia do valor publicado em {nome_gold}" if nat != "OBSERVADO" else None),
            transformacoes=[f"cópia pelo CNPJ de {nome_gold} (gerada em {geradas.get(nome_gold)}), sem recálculo"],
            limitacoes=[lim_copia],
            download=p0.get("download"))
    return {"bloco": bloco, "itens": itens, "cnpjs": set(cnpjs), "proveniencia": prov}


def _series_evolucao(golds):
    """Arquivos de série histórica por distribuidora publicados pelas golds de origem, com a
    cobertura de cada CNPJ: {modulo: {url, chave, campos, unidade, cobertura {cnpj: [primeiro,
    último]}} | None}. Lidos de public/energia/series (saída dos módulos Perdas, Qualidade e
    Conta de luz na mesma execução); arquivo ausente = None, nunca série inventada."""
    def le(url):
        if not url:
            return None
        caminho = os.path.join(base.SERIES, os.path.basename(url))
        if not os.path.exists(caminho):
            return None
        with open(caminho, encoding="utf-8") as f:
            return json.load(f)
    out = {}
    g = golds.get("perdas.json") or {}
    url = (g.get("series") or {}).get("anual")
    d = le(url)
    out["perdas"] = None if not d else {
        "url": url, "chave": "distribuidoras[cnpj]: linhas [ano, meses, completo, ...] na ordem de 'campos'",
        "campos": d.get("campos") or [], "unidade": d.get("unidades") or "",
        "cobertura": {k: [v[0][0], v[-1][0]] for k, v in (d.get("distribuidoras") or {}).items() if v}}
    g = golds.get("qualidade.json") or {}
    url = next((x["url"] for x in g.get("downloads") or [] if x.get("url", "").endswith("qualidade_distribuidoras_serie.json")), None)
    d = le(url)
    out["qualidade"] = None if not d else {
        "url": url, "chave": "distribuidoras[cnpj]: listas anos, dec, fec, dec_limite, fec_limite alinhadas",
        "campos": ["anos", "dec", "fec", "dec_limite", "fec_limite"], "unidade": "DEC em horas; FEC em interrupções",
        "cobertura": {k: [v["anos"][0], v["anos"][-1]] for k, v in (d.get("distribuidoras") or {}).items() if v.get("anos")}}
    g = golds.get("conta.json") or {}
    url = (g.get("tarifas") or {}).get("historico_url")
    d = le(url)
    out["tarifa"] = None if not d else {
        "url": url, "chave": "distribuidoras[cnpj].vigencias: [início, fim, ato, TE, TUSD, total]",
        "campos": ["inicio", "fim", "ato", "te", "tusd", "total"], "unidade": d.get("unidade") or "R$/MWh",
        "cobertura": {k: [v["vigencias"][0][0], v["vigencias"][-1][1]] for k, v in (d.get("distribuidoras") or {}).items()
                      if v.get("vigencias")}}
    return out



# ======================================================================= P038
def _exibicao(x, d, fin):
    """(último exercício, escopo exibido, valores do exercício, alertas) de uma companhia.

    Primeiro o exercício mais recente entre os dois escopos; depois, nesse exercício, o
    consolidado quando ele foi apresentado (as colunas zeradas pela fonte já saíram em
    _financas), senão o individual. Escolher o escopo antes do exercício deixava o último
    exercício anos defasado quando o consolidado parou antes do individual."""
    anos_esc = {e: {a for (esc, conta), s_ in d.items() if esc == e for a in s_} for e in ("con", "ind")}
    ult = max(anos_esc["con"] | anos_esc["ind"], default=None)
    if ult is None:
        return None, None, {}, []
    esc_pub = "con" if ult in anos_esc["con"] else "ind"
    valores, alertas = {}, []
    for ct in CONTAS_DESTAQUE:
        v = d.get((esc_pub, ct), {}).get(ult)
        valores[ct] = None if v is None else int(round(v))   # R$ inteiros (escala MIL ou UNIDADE)
    if esc_pub == "ind" and (x, "con", "U", f"{ult}-12-31") in fin["zeradas"]["DFP"]:
        alertas.append("consolidado_nao_apresentado")
    if any((x, esc_pub, ct, ult) in fin["nota_inicio"] for ct in CONTAS_DESTAQUE):
        alertas.append("inicio_inconsistente_na_fonte")
    dre = [valores.get(k) for k in ("receita", "ebit", "lucro_liquido")]
    if all(v is not None and v == 0 for v in dre) and (valores.get("ativo_total") or 0) > 0:
        # receita, resultado e lucro exatamente zero com balanço positivo: publicado como a
        # fonte entregou, com alerta (não há como provar que a demonstração não foi
        # apresentada, como no ativo zerado)
        alertas.append("dre_zerada_na_fonte")
    return ult, esc_pub, valores, alertas


def _bloco_financas(fin, cvm_cad, universo, distrib, cadeia, listadas, nomes, snap_dfp, snap_itr, con):
    slugs = {i["cnpj"]: i["slug"] for i in distrib["itens"]}
    anual, anterior, trim = fin["anual"], fin["anterior"], fin["trimestral"]
    ressalvas = []
    companhias = []
    for x in universo:
        r = cvm_cad.get(x) or {}
        d = anual.get(x, {})
        anos = sorted({a for (esc, conta), s in d.items() for a in s})
        ult, esc_pub, valores, alertas = _exibicao(x, d, fin)
        # cadeia de controle: primeira companhia aberta ativa acima (consolida esta)
        cad_ = cadeia(x)
        acima = next((y for y in cad_["cadeia"][1:] if y in listadas), None)
        reap = 0
        for (esc, conta), s in anterior.get(x, {}).items():
            for a, v in s.items():
                u = d.get((esc, conta), {}).get(a)
                if u is not None and abs(u - v) > 1000.0:
                    reap += 1
        trims = sorted({f for k, s in trim.get(x, {}).items() for f in s})
        companhias.append({
            "cnpj": x, "cd_cvm": r.get("cd_cvm"), "nome": r.get("denominacao") or nomes.get(x), "situacao": r.get("situacao"),
            "setor": r.get("setor"), "categoria": r.get("categoria"), "controle_acionario": r.get("controle"),
            "distribuidora_slug": slugs.get(x), "anos": [anos[0], anos[-1]] if anos else None,
            "ultimo_exercicio": ult, "escopo_exibido": esc_pub, "valores": valores or None, "alertas": alertas,
            "ultimo_trimestre": trims[-1] if trims else None,
            "controladora_aberta": ({"cnpj": acima, "nome": nomes.get(acima)} if acima else None),
            "valores_reapresentados": reap,
        })
    controla = collections.defaultdict(list)
    for co in companhias:
        if co["controladora_aberta"]:
            controla[co["controladora_aberta"]["cnpj"]].append(co["cnpj"])
    for co in companhias:
        co["controla_abertas"] = sorted(controla.get(co["cnpj"], []))
    anos_dfp = sorted({a for d in anual.values() for s in d.values() for a in s})
    fins_itr = sorted({f for d in trim.values() for s in d.values() for f in s})
    docs_multi = sum(1 for r in fin["docs_dfp"].values() if int(r.get("versoes") or 1) > 1) + \
        sum(1 for r in fin["docs_itr"].values() if int(r.get("versoes") or 1) > 1)
    com_dfp = [co for co in companhias if co["ultimo_exercicio"]]
    ativos = [co for co in companhias if co["situacao"] == "ATIVO"]
    # evidências por companhia (receita do último exercício), lidas sob demanda
    evids = {}
    vint_dfp = ckan.vintages_vigentes(con, DS_DFP)
    for co in com_dfp:
        esc, ano = co["escopo_exibido"], co["ultimo_exercicio"]
        v = (co["valores"] or {}).get("receita")
        if v is None:
            continue
        vt = vint_dfp.get(f"dfp_cia_aberta_{ano}.zip")
        doc = fin["docs_dfp"].get(f"doc|{co['cnpj']}|{ano}-12-31") or {}
        reap = anterior.get(co["cnpj"], {}).get((esc, "receita"), {}).get(ano)
        rec = None
        if reap is not None:
            dif = reap - anual[co["cnpj"]][(esc, "receita")][ano]
            rec = evid.reconciliacao(
                f"Mesmo exercício como apresentado na DFP de {ano + 1} (comparativo): R$ {_br_num(reap / 1e6, 1)} milhões; diferença de R$ {_br_num(dif / 1e6, 3)} milhões",
                "aprovado" if abs(dif) <= 1000.0 else "ressalva", "R$ 1 mil (escala MIL da fonte)")
        testes_ev = [evid.teste("Conta fixa do plano padronizado", "aprovado", "ST_CONTA_FIXA = S e rótulo iniciado por 'Receita'"),
                     evid.teste("Maior versão do documento", "aprovado", "linhas de versões anteriores descartadas"),
                     evid.teste("Ativo total positivo na mesma coluna", "aprovado",
                                "demonstração com ativo total zero é tratada como não apresentada; esta tem ativo positivo")]
        exclusoes_ev = []
        if "consolidado_nao_apresentado" in co["alertas"]:
            exclusoes_ev.append(f"Consolidado de {ano} publicado pela CVM com ativo total zero (consolidado não apresentado pela companhia): exibido o individual")
        ini_pub = fin["nota_inicio"].get((co["cnpj"], esc, "receita", ano))
        if ini_pub:
            testes_ev.append(evid.teste("Data de início do exercício", "ressalva",
                                        f"a companhia publicou DT_INI_EXERC = {ini_pub} num exercício encerrado em {ano}-12-31; o comparativo do mesmo documento tem balanço positivo em {ano - 1}-12-31, então o valor é tratado como o exercício de 12 meses"))
        if "dre_zerada_na_fonte" in co["alertas"]:
            testes_ev.append(evid.teste("Demonstração de resultado zerada", "ressalva",
                                        "receita, resultado antes do resultado financeiro e lucro iguais a zero no documento, com balanço positivo: publicado como a fonte entregou"))
        try:
            evids[co["cnpj"]] = evid.construir(
                indicador=f"Receita de venda de bens e serviços ({'consolidada' if esc == 'con' else 'individual'})",
                valor_exibido=f"R$ {_br_num(v / 1e6, 1)} milhões", valor_calculo=v, unidade="R$",
                periodo={"inicio": f"{ano}-01-01", "fim": f"{ano}-12-31"}, entidade=co["nome"] or co["cnpj"],
                universo="Uma companhia aberta; valor não somado a nenhuma outra",
                fonte=evid.fonte_de_vintage("CVM", "DFP: Demonstrações Financeiras Padronizadas", URL_DFP_DS, vt),
                chaves_origem=[f"CNPJ_CIA={cv.formatado(co['cnpj'])}; DT_REFER={ano}-12-31; VERSAO={doc.get('versao')}; "
                               f"dfp_cia_aberta_DRE_{esc}_{ano}.csv; CD_CONTA=3.01; ORDEM_EXERC=ÚLTIMO"],
                formula="VL_CONTA × escala (MIL = 1.000; UNIDADE = 1)",
                cobertura=f"Documento {doc.get('id_doc') or 'sem identificador'} recebido pela CVM em {doc.get('dt_receb') or 'data não informada'}",
                tratamento_ausencia="Conta ausente no documento fica ausente; nunca zero. Coluna com ativo total zero (escopo que a companhia não apresentou e a CVM preenche com zero) também é ausência.",
                exclusoes=exclusoes_ev,
                revisoes=_texto_versoes(doc),
                testes=testes_ev,
                reconciliacao=rec, download=[{"rotulo": "Demonstrações (CSV)", "url": _url(CSV_FINANCAS)}],
                reproducao=REPRODUCAO)
        except evid.EvidenciaInvalida as e:
            ressalvas.append(f"evidência não gerada para {co['cnpj']}: {e}")
    base.escreve_gold(JSON_EVID, {"gerado_em": base.agora_utc(), "evidencias": evids}, destino=base.SERIES)
    cad_capt = (snap_dfp.get("capturas") or [{}])
    fonte_dfp = _fonte("CVM", "Demonstrações Financeiras Padronizadas (DFP) e Informações Trimestrais (ITR)",
                       "dfp_cia_aberta_AAAA.zip e itr_cia_aberta_AAAA.zip", URL_DFP_DS,
                       f"{URL_CVM}/dados/CIA_ABERTA/DOC/DFP/DADOS/", LICENCA_CVM)
    prov = c.proveniencia(
        indicador="Demonstrações financeiras padronizadas das companhias abertas do setor elétrico", natureza="OBSERVADO",
        fonte=fonte_dfp, unidade="R$ nominais", frequencia="anual (DFP) e trimestral (ITR)",
        periodo={"inicio": str(anos_dfp[0]) if anos_dfp else "", "fim": fins_itr[-1] if fins_itr else (str(anos_dfp[-1]) if anos_dfp else "")},
        cobertura={"inicio": str(anos_dfp[0]) if anos_dfp else "", "fim": str(anos_dfp[-1]) if anos_dfp else ""},
        capturado_em=max((x.get("capturado_em") for x in cad_capt if x.get("capturado_em")), default=None),
        snapshot=snap_dfp,
        transformacoes=["escala MIL → R$ (× 1.000)", "maior versão de cada documento", "só contas fixas (ST_CONTA_FIXA = S)",
                        "dívida bruta = 2.01.04 + 2.02.01 no mesmo escopo e data",
                        "coluna de demonstração com ativo total ≤ 0 (escopo não apresentado, que a CVM preenche com zero) tratada como ausência",
                        "exercício com DT_INI_EXERC diferente de 1º de janeiro aceito como exercício de 12 meses só quando o comparativo do mesmo documento tem balanço positivo no fim do ano anterior (data publicada na nota do CSV)",
                        "último exercício escolhido entre os dois escopos antes do escopo; consolidado quando apresentado nesse exercício"],
        limitacoes=["Cobertura: companhias abertas registradas na CVM com setor de energia elétrica ou distribuidoras do índice com registro; a maior parte das empresas do setor (sociedades de propósito específico, cooperativas, fechadas) não publica DFP/ITR. Não representa o setor inteiro.",
                    "Consolidado e individual são séries separadas; nenhum valor é somado entre companhias (a controladora consolida as controladas, e somar dobraria valores).",
                    "Demonstrações societárias, não regulatórias: a contabilidade regulatória da ANEEL (BMP) usa outro plano de contas e não está integrada (bloqueio documentado).",
                    "EBITDA não é publicado (decisão de método registrada em decisoes_metodo): o resultado antes do resultado financeiro e dos tributos (3.05) não soma depreciação e amortização.",
                    "Caixa das atividades de investimento (6.02) inclui aquisições, aplicações e resgates, não só investimento em ativos."],
        download=_url(CSV_FINANCAS))
    bloco = {
        "universo": {
            "regra": "Companhias do cadastro da CVM com setor de atividade 'Energia Elétrica' ou 'Emp. Adm. Part. - Energia Elétrica', mais distribuidoras do índice que têm registro na CVM.",
            "companhias": len(companhias), "ativas": len(ativos),
            "canceladas": sum(1 for co in companhias if (co["situacao"] or "").startswith("CANCEL")),
            "com_dfp": len(com_dfp), "com_itr": sum(1 for co in companhias if co["ultimo_trimestre"]),
            "por_setor": dict(collections.Counter(co["setor"] for co in companhias)),
            "distribuidoras_abertas": sum(1 for co in companhias if co["distribuidora_slug"]),
            "nota_cobertura": "Cobertura das companhias abertas; não é o setor inteiro.",
        },
        "contas": [{k: ct[k] for k in ("id", "demonstracao", "codigo", "tipo", "rotulo", "definicao")} for ct in cv.CONTAS] +
                  [{"id": cv.DIVIDA_BRUTA["id"], "demonstracao": "BPP", "codigo": "2.01.04 + 2.02.01", "tipo": "saldo",
                    "rotulo": cv.DIVIDA_BRUTA["rotulo"], "definicao": "Soma das contas 2.01.04 e 2.02.01 do mesmo escopo e da mesma data; calculada pelo observatório."}],
        "periodos": {"exercicios": anos_dfp, "trimestres": fins_itr[-24:],
                     "ultimo_exercicio": anos_dfp[-1] if anos_dfp else None, "ultimo_trimestre": fins_itr[-1] if fins_itr else None},
        "revisoes": {"documentos_com_mais_de_uma_versao": docs_multi,
                     "valores_reapresentados": sum(co["valores_reapresentados"] for co in companhias),
                     "observacoes_revisadas_entre_capturas": fin["revisoes"]["dfp"] + fin["revisoes"]["itr"],
                     "regra": "Reapresentação = valor do exercício como publicado no comparativo da DFP seguinte diferente do valor original em mais de R$ 1 mil."},
        "exclusoes": _exclusoes_financas(fin),
        "companhias": sorted(companhias, key=lambda co: (co["situacao"] != "ATIVO", -(((co["valores"] or {}).get("receita")) or 0))),
    }
    ex = bloco["exclusoes"]
    if ex["colunas_nao_apresentadas"]["documentos"]:
        ressalvas.append(f"{ex['colunas_nao_apresentadas']['documentos']} colunas de demonstração da CVM com ativo total zero tratadas como não apresentadas ({ex['colunas_nao_apresentadas']['valores']} valores fora das séries)")
    if ex["inicio_inconsistente"]:
        ressalvas.append(f"{len(ex['inicio_inconsistente'])} exercícios com data de início inconsistente na fonte aceitos como exercício de 12 meses (nota no CSV anual)")
    if ex["exercicios_irregulares"]["valores"] or ex["periodos_irregulares_itr"]["valores"]:
        ressalvas.append(f"{ex['exercicios_irregulares']['valores']} valores de exercícios curtos (DFP) e {ex['periodos_irregulares_itr']['valores']} de períodos irregulares (ITR) fora das séries, publicados nos CSV com recorte próprio")
    alertas_dre = sum(1 for co in companhias if "dre_zerada_na_fonte" in co["alertas"])
    if alertas_dre:
        ressalvas.append(f"{alertas_dre} companhias com DRE do último exercício zerada na fonte e balanço positivo (alerta dre_zerada_na_fonte)")
    return {"bloco": bloco, "ressalvas": ressalvas, "proveniencia": {"financas": prov}, "companhias": companhias}


def _exclusoes_financas(fin):
    """Resumo publicado do que saiu das séries financeiras e por quê (as listas detalhadas
    ficam nos CSV; aqui só as colunas do exercício ou do trimestre, que são poucas)."""
    zer = fin["zeradas"]
    docs_u = sorted({(c14, esc, fim, doc, mot) for doc, z in zer.items() for (c14, esc, ordem, fim), mot in z.items()
                     if ordem == "U"})
    inicio = sorted({(c14, ano, ini) for (c14, esc, conta, ano), ini in fin["nota_inicio"].items()})
    return {
        "regra_nao_apresentada": "Coluna de demonstração (CNPJ, escopo, exercício corrente ou comparativo, data) com ativo total igual a zero: a CVM preenche com zero as tabelas do escopo que a companhia não apresentou (em geral o consolidado de quem deixou de ter controladas). Todos os valores da coluna viram ausência, nunca zero.",
        "colunas_nao_apresentadas": {"documentos": sum(len(z) for z in zer.values()),
                                     "valores": fin["nao_apresentados"]["dfp"] + fin["nao_apresentados"]["itr"],
                                     "exercicio_ou_trimestre": [{"cnpj": c14, "escopo": esc, "data": fim, "documento": doc, "motivo": mot}
                                                                for c14, esc, fim, doc, mot in docs_u]},
        "regra_inicio": "DT_INI_EXERC diferente de 1º de janeiro num exercício encerrado em 31/12 é aceito como exercício de 12 meses quando o comparativo do mesmo documento tem balanço positivo no fim do ano anterior (a companhia já existia); senão é exercício curto de fato e fica fora da série.",
        "inicio_inconsistente": [{"cnpj": c14, "ano": ano, "dt_ini_publicada": ini} for c14, ano, ini in inicio],
        "exercicios_irregulares": {"valores": len(fin["irregulares_dfp"]), "companhias": len({x[0] for x in fin["irregulares_dfp"]}),
                                   "recorte_csv": "exercicio_irregular"},
        "periodos_irregulares_itr": {"valores": len(fin["irregulares_itr"]), "companhias": len({x[0] for x in fin["irregulares_itr"]}),
                                     "recorte_csv": "periodo_irregular"},
    }


# ======================================================================= arquivos
def _escreve_csvs(at, usinas, agentes, nomes, cadeia, grafo, pol, distrib, fin, financas, cvm_cad, universo_cvm,
                  data_cadastro, listadas, total_valido):
    base.escreve_csv(CSV_ATIVOS, ["nucleo_ceg", "ceg", "usina", "tipo", "fase", "uf", "kw_outorgado", "kw_fiscalizado",
                                  "estado_vinculo", "soma_pct", "proprietario_cnpj", "proprietario_nome", "pct", "regime",
                                  "controle_majoritario", "grupo_cnpj", "conferencia_agentes"],
                     sorted(at["linhas"], key=lambda l: (int(l[0]), l[10] or "")))
    donos = at["donos"]
    linhas = []
    for k, d in sorted(donos.items(), key=lambda kv: -kv[1]["kw_prop"]):
        cad_ = cadeia(k)
        linhas.append([k, nomes.get(k), 1 if k in agentes else 0, d["usinas"], d["usinas_operacao"],
                       _r(_mw(d["kw_bruto"]), 4), _r(_mw(d["kw_prop"]), 4), _r(_mw(d["kw_controle"]), 4), d["usinas_controle"],
                       cad_["topo"], nomes.get(cad_["topo"]), cad_["motivo_parada"], "|".join(sorted(d["regimes"]))])
    base.escreve_csv(CSV_PROPRIETARIOS, ["cnpj", "nome", "no_cadastro_agentes", "usinas", "usinas_operacao", "mw_bruto_operacao",
                                         "mw_proporcional", "mw_controle_direto", "usinas_controle_direto", "grupo_cnpj",
                                         "grupo_nome", "motivo_parada", "regimes"], linhas)
    linhas = []
    for k, g in sorted(at["grupos"].items(), key=lambda kv: -kv[1]["kw_prop"]):
        cad_ = cadeia(k)
        linhas.append([k, nomes.get(k), len(g["empresas"]), g["usinas_controle"], _r(_mw(g["kw_controle"]), 4),
                       _r(_mw(g["kw_prop"]), 4), _r(100.0 * g["kw_prop"] / total_valido, 4), cad_["motivo_parada"],
                       cad_["acima"], 1 if k in listadas else 0])
    base.escreve_csv(CSV_GRUPOS, ["grupo_cnpj", "nome", "empresas_com_usinas", "usinas_controle", "mw_controle", "mw_proporcional",
                                  "participacao_pct", "motivo_parada", "acima", "listada_cvm"], linhas)
    # cadastro de agentes
    distrib_cnpjs = distrib["cnpjs"]
    linhas = []
    for k in sorted(agentes):
        a = agentes[k]
        linhas.append([k, a["sigla"], a["razao_social"], 1 if a["ativo"] else 0,
                       *[1 if r in a["ramos"] else 0 for r in ("comercializacao", "distribuicao", "geracao", "transmissao")],
                       1 if k in donos else 0, 1 if k in distrib_cnpjs else 0, (cvm_cad.get(k) or {}).get("cd_cvm"), data_cadastro])
    base.escreve_csv(CSV_AGENTES, ["cnpj", "sigla", "razao_social", "ativo", "comercializacao", "distribuicao", "geracao",
                                   "transmissao", "proprietario_siga", "distribuidora_regulada", "cvm_cd", "data_cadastro"], linhas)
    # cadeia societária: nós que importam (cadeias de proprietários, distribuidoras e universo CVM)
    nos_rel = set()
    for k in list(donos) + list(distrib_cnpjs) + list(universo_cvm):
        nos_rel.update(cadeia(k)["cadeia"])
    linhas, arestas = [], {"pai": [], "socio": [], "nome": [], "controlador": [], "pct_direto": []}
    if grafo:
        vig = pol["vigencia"]
        for x in sorted(nos_rel):
            for a in grafo["socios"].get(x, []):
                chave_v = (x, a["socio"] or f"#{a['nome']}")
                v = vig.get(chave_v)
                conc = grafo["concordancia"].get(x)
                # nome de sócio sem CNPJ só quando publicável (ae.nome_publicavel); senão marcador
                linhas.append([x, nomes.get(x), a["socio"], ae.rotulo_socio(a), a["perfil"],
                               1 if a["controlador"] else 0, _r(a["pct"], 4), grafo["origem"].get(x),
                               ae.rotulo_periodo(grafo["declaracao"][x]) if x in grafo["declaracao"] else None,
                               f"{conc[0]}/{conc[1]}" if conc else None,
                               ae.rotulo_periodo(v[0]) if v else None, ae.rotulo_periodo(v[1]) if v else None])
                arestas["pai"].append(x)
                arestas["socio"].append(a["socio"])
                arestas["nome"].append(ae.rotulo_socio(a))
                arestas["controlador"].append(1 if a["controlador"] else 0)
                arestas["pct_direto"].append(_r(a["pct"], 2))
    base.escreve_csv(CSV_CADEIA, ["pai_cnpj", "pai_nome", "socio_cnpj", "socio_nome", "perfil", "controlador", "pct_direto",
                                  "origem", "declaracao", "concordancia", "primeiro_trimestre", "ultimo_trimestre"], linhas)
    nos_json = {}
    for x in sorted(nos_rel):
        prox, motivo, _ = ae.controlador_direto(grafo, x) if grafo else (None, "sem_declaracao", None)
        nos_json[x] = [nomes.get(x), prox, motivo]
    base.escreve_gold(JSON_CADEIA, {"gerado_em": base.agora_utc(), "nos": nos_json, "arestas": arestas}, destino=base.SERIES)
    # usinas para o mapa
    grupos_idx = [k for k, _ in sorted(at["grupos"].items(), key=lambda kv: -kv[1]["kw_prop"])[:200]]
    pos = {k: i for i, k in enumerate(grupos_idx)}
    col = {k: [] for k in ("nucleo", "nome", "tipo", "fase", "uf", "mw", "lat", "lon", "estado", "grupo")}
    for k, u in sorted(usinas.items(), key=lambda kv: int(kv[0])):
        if u["lat"] is None:
            continue
        kw = u["kw_fiscalizado"] if u["fase"] == "Operação" else u["kw_outorgado"]
        col["nucleo"].append(k)
        col["nome"].append(u["nome"])
        col["tipo"].append(u["tipo"])
        col["fase"].append(u["fase"])
        col["uf"].append(u["uf"])
        col["mw"].append(_r(_mw(kw), 3))
        col["lat"].append(round(u["lat"], 4))
        col["lon"].append(round(u["lon"], 4))
        col["estado"].append(ESTADOS.index(u["estado"]))
        col["grupo"].append(pos.get(u.get("grupo_majoritario"), -1))
    base.escreve_gold(JSON_ATIVOS, {"gerado_em": base.agora_utc(), "estados": ESTADOS,
                                    "grupos": [[k, nomes.get(k)] for k in grupos_idx], **col}, destino=base.SERIES)
    # distribuidoras
    linhas = []
    for i in distrib["itens"]:
        pe, qu, ta = i["perdas"] or {}, i["qualidade"] or {}, i["tarifa"] or {}
        linhas.append([i["cnpj"], i["slug"], i["sigla"], i["nome"], i["classificacao"], i["grupo"], "|".join(i["ufs"]),
                       1 if i["ativa"] else 0, "|".join(k for k, v in (("samp", i["perdas"]), ("tarifas", i["tarifa"]), ("continuidade", i["qualidade"])) if v),
                       pe.get("ano"), pe.get("taxa_total_pct"), pe.get("pnt_bt_pct"), qu.get("ano"), qu.get("dec"), qu.get("fec"),
                       qu.get("dec_limite"), qu.get("fec_limite"), qu.get("ucs"), ta.get("total"), ta.get("inicio"), ta.get("fim"),
                       i["controle"]["topo"], i["controle"]["topo_nome"], i["controle"]["motivo_parada"], (i["cvm"] or {}).get("cd_cvm")])
    base.escreve_csv(CSV_DISTRIBUIDORAS, ["cnpj", "slug", "sigla", "nome", "classificacao", "grupo", "ufs", "ativa", "fontes",
                                          "perdas_ano", "taxa_perdas_totais_pct", "pnt_bt_pct", "qualidade_ano", "dec_h", "fec",
                                          "dec_limite_h", "fec_limite", "ucs", "tarifa_b1_rs_mwh", "tarifa_inicio", "tarifa_fim",
                                          "controlador_cnpj", "controlador_nome", "motivo_parada", "cvm_cd"], linhas)
    # finanças: CSV anual (DFP), CSV trimestral (ITR) e cadastro das companhias; valores em R$
    tipo = {ct["id"]: ct["tipo"] for ct in cv.CONTAS}
    tipo["divida_bruta"] = "saldo"
    codigo = {ct["id"]: ct["codigo"] for ct in cv.CONTAS}
    codigo["divida_bruta"] = "2.01.04+2.02.01"
    anual_l, trim_l, cias, series = [], [], [], {}
    por_cnpj = {co["cnpj"]: co for co in financas["companhias"]}
    for x in universo_cvm:
        r = cvm_cad.get(x) or {}
        co = por_cnpj.get(x) or {}
        cias.append([x, r.get("cd_cvm"), r.get("codigos_cvm"), r.get("denominacao") or nomes.get(x), r.get("situacao"), r.get("setor"),
                     r.get("categoria"), r.get("controle"), co.get("distribuidora_slug"),
                     (co.get("controladora_aberta") or {}).get("cnpj"), "|".join(co.get("controla_abertas") or [])])
        s_x = {"anual": {}, "trimestral": {}}
        for (esc, conta), s_ in sorted(fin["anual"].get(x, {}).items()):
            for ano, v in sorted(s_.items()):
                doc = fin["docs_dfp"].get(f"doc|{x}|{ano}-12-31") or {}
                reap = fin["anterior"].get(x, {}).get((esc, conta), {}).get(ano)
                ini_pub = fin["nota_inicio"].get((x, esc, conta, ano))
                anual_l.append([x, "consolidado" if esc == "con" else "individual", conta, codigo[conta],
                                f"{ano}-01-01" if tipo[conta] == "fluxo" else None, f"{ano}-12-31",
                                "exercicio" if tipo[conta] == "fluxo" else "saldo", _r(v, 2), doc.get("versao"), doc.get("dt_receb"),
                                _r(reap, 2) if reap is not None and abs(reap - v) > 1000.0 else None,
                                f"inicio_inconsistente_na_fonte:{ini_pub}" if ini_pub else None])
                s_x["anual"].setdefault(esc, {}).setdefault(conta, []).append([ano, _r(v / 1e6, 3)])
        for (esc, conta, recorte), s_ in sorted(fin["trimestral"].get(x, {}).items()):
            for fim, v in sorted(s_.items()):
                doc = fin["docs_itr"].get(f"doc|{x}|{fim}") or {}
                ini = None
                if recorte == "trimestre":
                    ini = f"{fim[:4]}-{int(fim[5:7]) - 2:02d}-01"
                elif recorte == "acumulado_no_ano":
                    ini = f"{fim[:4]}-01-01"
                trim_l.append([x, "consolidado" if esc == "con" else "individual", conta, codigo[conta], ini, fim, recorte,
                               _r(v, 2), doc.get("versao"), doc.get("dt_receb")])
                if recorte in ("trimestre", "saldo") or (recorte == "acumulado_no_ano" and conta.startswith("caixa_")):
                    s_x["trimestral"].setdefault(esc, {}).setdefault(f"{conta}:{recorte}", []).append([fim, _r(v / 1e6, 3)])
        # exercícios curtos de fato e períodos irregulares: só no CSV, com as datas da fonte
        for c14, esc, conta, ini, fim, v in fin["irregulares_dfp"]:
            if c14 == x:
                doc = fin["docs_dfp"].get(f"doc|{x}|{fim}") or {}
                anual_l.append([x, "consolidado" if esc == "con" else "individual", conta, codigo[conta], ini, fim,
                                "exercicio_irregular", _r(v, 2), doc.get("versao"), doc.get("dt_receb"), None, None])
        for c14, esc, conta, ini, fim, v in fin["irregulares_itr"]:
            if c14 == x:
                doc = fin["docs_itr"].get(f"doc|{x}|{fim}") or {}
                trim_l.append([x, "consolidado" if esc == "con" else "individual", conta, codigo[conta], ini, fim,
                               "periodo_irregular", _r(v, 2), doc.get("versao"), doc.get("dt_receb")])
        if s_x["anual"] or s_x["trimestral"]:
            series[x] = s_x
    base.escreve_csv(CSV_COMPANHIAS, ["cnpj", "cd_cvm", "codigos_cvm", "companhia", "situacao", "setor", "categoria",
                                      "controle_acionario", "distribuidora_slug", "controladora_aberta_cnpj",
                                      "controla_abertas_cnpj"], cias)
    base.escreve_csv(CSV_FINANCAS, ["cnpj", "escopo", "conta", "cd_conta", "periodo_inicio", "periodo_fim", "recorte", "valor_rs",
                                    "versao", "recebido_cvm_em", "reapresentado_rs", "nota"], anual_l)
    base.escreve_csv(CSV_FINANCAS_TRIM, ["cnpj", "escopo", "conta", "cd_conta", "periodo_inicio", "periodo_fim", "recorte",
                                         "valor_rs", "versao", "recebido_cvm_em"], trim_l)
    base.escreve_gold(JSON_FINANCAS, {"gerado_em": base.agora_utc(), "unidade": "R$ milhões", "series": series}, destino=base.SERIES)
