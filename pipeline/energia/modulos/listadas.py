"""Módulo Listadas: as companhias do Índice de Energia Elétrica (IEE) da B3 numa só leitura.

Universo: a carteira do dia do IEE publicada pela B3 (uma vintage por dia de coleta). Cada papel
da carteira é ligado à companhia pelo código CVM que a própria B3 publica no cadastro do emissor e
conferido no Formulário Cadastral (FCA) da CVM, em que a companhia declara o código de negociação.

O que o módulo publica, por companhia:
- atuação e ativos: usinas, linhas e distribuidoras sob controle da companhia, descendo a cadeia de
  controle declarada à ANEEL (Composição Societária, Polímero) a partir do CNPJ da companhia
  listada. Os ativos vêm do que o módulo Empresas já publica (SIGA, SIGET e índice de
  distribuidoras, pelo CNPJ); nada é recoletado da ANEEL além do Polímero, que só é baixado
  quando a captura do módulo Empresas não está disponível;
- quem controla: acionistas diretos declarados no Formulário de Referência (FRE) da CVM e a
  cadeia de controladores únicos acima da companhia no Polímero;
- finanças: as demonstrações consolidadas da CVM já publicadas pelo módulo Empresas, com razões
  derivadas definidas aqui;
- desempenho em bolsa: preço de fechamento da série histórica da B3 (COTAHIST), índice de preço
  ajustado por desdobramentos, grupamentos e bonificações e índice de retorno total com os
  proventos em dinheiro publicados pela B3;
- movimentos: fatos relevantes entregues à CVM (IPE) nos últimos 24 meses e mudanças de posição
  dos acionistas diretos entre dois Formulários de Referência.

Nada é somado entre companhias: uma companhia da carteira pode controlar ou ter participação em
outra (Cemig e Taesa, AXIA e ISA Energia), e as medidas de cada uma são da cadeia dela.
"""
import collections
import csv
import json
import os
import sqlite3
import sys
import tempfile
import shutil
import urllib.request
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.common import USER_AGENT, http_get  # noqa: E402
from pipeline.energia import base  # noqa: E402
from pipeline.energia import evidencia as evid  # noqa: E402
from pipeline.energia.fontes import aneel_empresas as ae  # noqa: E402
from pipeline.energia.fontes import b3_listadas as b3  # noqa: E402
from pipeline.energia.fontes import ckan  # noqa: E402
from pipeline.energia.fontes import cvm_listadas as cl  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

GOLD = "listadas.json"
FAMILIA = "listadas"

DS_IEE = "b3_iee"
DS_SUPLEMENTO = "b3_emissores"
DS_PROVENTOS = "b3_proventos"
DS_COTAHIST = "b3_cotahist"
DS_FCA = "cvm_fca"
DS_FRE = "cvm_fre"
DS_IPE = "cvm_ipe"
DS_POLIMERO = "aneel_polimero"
REC_IEE = "carteira_ieex.json"
REC_POLIMERO = "composicao-societaria-polimero.parquet"

LICENCA_CVM = "Licença Aberta para Bases de Dados (ODbL) do Open Data Commons, conforme o portal de dados abertos da CVM"
LICENCA_ANEEL = "Open Data Commons Open Database License (ODbL)"
LICENCA_B3 = ("Dados públicos divulgados pela B3 no portal www.b3.com.br, reproduzidos com citação da fonte; a B3 não declara "
              "licença aberta para estes arquivos")
URL_CVM = "https://dados.cvm.gov.br"
URL_FCA_DS = f"{URL_CVM}/dataset/cia_aberta-doc-fca"
URL_FRE_DS = f"{URL_CVM}/dataset/cia_aberta-doc-fre"
URL_IPE_DS = f"{URL_CVM}/dataset/cia_aberta-doc-ipe"
URL_POLIMERO = "https://dadosabertos.aneel.gov.br/dataset/composicao-societaria-polimero"

# Base das séries de bolsa: o fechamento do último pregão de 2020 (o retorno "desde 2021" parte dele).
ANO_BASE_COTACOES = 2020
ANO_INICIAL_FCA = 2020
ANOS_FRE = 3
ANOS_IPE = 3
MESES_MOVIMENTOS = 24
# Emissores anteriores (outro código de quatro letras) das companhias da carteira cujas cotações
# são lidas para emendar a série quando a companhia trocou de código. A emenda só acontece se o
# FCA da própria companhia publicar o código antigo (mesmo CNPJ, mesma classe): esta lista só diz
# quais linhas da COTAHIST guardar, não liga nada.
PREFIXOS_ANTERIORES = {"ELET", "TRPL"}

ROTA = "/setor-eletrico/empresas/listadas"
PAGINAS = [{"rotulo": "Empresas listadas", "href": ROTA}]
REPRODUCAO = "python3 pipeline/energia/executar_modulo.py listadas --sem-coleta"

CSV_COMPANHIAS = "listadas_companhias.csv"
CSV_USINAS = "listadas_usinas.csv"
CSV_TRANSMISSAO = "listadas_transmissao.csv"
CSV_ACIONISTAS = "listadas_acionistas.csv"
CSV_COTACOES = "listadas_cotacoes.csv"
CSV_EVENTOS = "listadas_eventos.csv"
CSV_FATOS = "listadas_fatos_relevantes.csv"
CSV_CARTEIRA = "listadas_carteira_iee.csv"
JSON_EVID = "listadas_evidencias.json"


def _url(nome):
    return f"/energia/series/{nome}"


REGISTRO = {
    "id": "listadas", "gold": GOLD, "familia": FAMILIA, "ordem": 65,
    "datasets": [
        {"orgao": "B3", "nome": "iee-carteira-do-dia", "slug": "b3-iee-carteira",
         "dataset_silver": DS_IEE, "titulo": "B3: carteira do dia do Índice de Energia Elétrica (IEE)",
         "estado": "UTILIZADO EM INDICADOR", "url": b3.URL_PAGINA_IEE, "licenca": LICENCA_B3, "paginas": PAGINAS,
         "downloads": [_url(CSV_CARTEIRA)], "quebras": []},
        {"orgao": "B3", "nome": "empresas-listadas-eventos", "slug": "b3-eventos-corporativos",
         "dataset_silver": DS_SUPLEMENTO, "titulo": "B3: emissores, quantidade de ações e eventos em ações (desdobramento, grupamento, bonificação)",
         "estado": "UTILIZADO EM INDICADOR", "url": b3.URL_PAGINA_EVENTOS, "licenca": LICENCA_B3, "paginas": PAGINAS,
         "downloads": [_url(CSV_EVENTOS)], "quebras": []},
        {"orgao": "B3", "nome": "empresas-listadas-proventos", "slug": "b3-proventos-em-dinheiro",
         "dataset_silver": DS_PROVENTOS, "titulo": "B3: proventos em dinheiro por classe (dividendos, juros sobre capital próprio, rendimentos)",
         "estado": "UTILIZADO EM INDICADOR", "url": b3.URL_PAGINA_EVENTOS, "licenca": LICENCA_B3, "paginas": PAGINAS,
         "downloads": [_url(CSV_EVENTOS)], "quebras": []},
        {"orgao": "B3", "nome": "cotahist", "slug": "b3-series-historicas-cotacoes",
         "dataset_silver": DS_COTAHIST, "titulo": "B3: séries históricas de cotações (COTAHIST), mercado à vista",
         "estado": "UTILIZADO EM INDICADOR", "url": b3.URL_PAGINA_COTAHIST, "licenca": LICENCA_B3, "paginas": PAGINAS,
         "downloads": [_url(CSV_COTACOES)], "quebras": []},
        {"orgao": "CVM", "nome": "cia_aberta-doc-fca", "slug": "cvm-formulario-cadastral",
         "dataset_silver": DS_FCA, "titulo": "CVM: Formulário Cadastral (atividade, controle acionário, valores mobiliários e códigos de negociação)",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_FCA_DS, "licenca": LICENCA_CVM, "paginas": PAGINAS,
         "downloads": [_url(CSV_COMPANHIAS)], "quebras": []},
        {"orgao": "CVM", "nome": "cia_aberta-doc-fre", "slug": "cvm-formulario-referencia",
         "dataset_silver": DS_FRE, "titulo": "CVM: Formulário de Referência, posição acionária",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_FRE_DS, "licenca": LICENCA_CVM, "paginas": PAGINAS,
         "downloads": [_url(CSV_ACIONISTAS)], "quebras": []},
        {"orgao": "CVM", "nome": "cia_aberta-doc-ipe", "slug": "cvm-documentos-periodicos-eventuais",
         "dataset_silver": DS_IPE, "titulo": "CVM: documentos periódicos e eventuais (IPE), fatos relevantes",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_IPE_DS, "licenca": LICENCA_CVM, "paginas": PAGINAS,
         "downloads": [_url(CSV_FATOS)], "quebras": []},
        {"orgao": "ANEEL", "nome": "composicao-societaria-polimero", "slug": "aneel-composicao-societaria-listadas",
         "dataset_silver": DS_POLIMERO, "titulo": "Composição Societária (Polímero): cadeias de controle a partir das companhias listadas",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_POLIMERO, "licenca": LICENCA_ANEEL, "paginas": PAGINAS,
         "downloads": [_url(CSV_USINAS), _url(CSV_TRANSMISSAO)], "quebras": []},
    ],
    "arquivos": {
        _url(CSV_CARTEIRA): "Carteira do dia do IEE, uma linha por papel e data de carteira: data_carteira (data do cabeçalho da B3); papel; nome_pregao; tipo (classe, marca e segmento como a B3 publica); peso_pct (participação no índice, %); qtd_teorica (quantidade teórica de ações no índice); capturado_em.",
        _url(CSV_COMPANHIAS): "Uma companhia da carteira por linha: papel; cnpj (holding listada, 14 dígitos); codigo_cvm; nome (FCA); nome_anterior (FCA); especie_controle (FCA, autodeclarada); peso_iee_pct; atua_geracao, atua_transmissao, atua_distribuicao (1 = tem o ativo sob controle na data da fonte; 0 = não tem); comercializacao_declarada (1 = alguma empresa sob controle declara o ramo comercialização no cadastro de agentes da ANEEL); empresas_sob_controle (CNPJ na cadeia abaixo da companhia, inclusive ela); usinas_controle; mw_controle (Σ potência fiscalizada das usinas em operação cujo dono majoritário está sob controle da companhia); mw_proporcional (Σ potência × participação direta das empresas sob controle); mw_em_implantacao (Σ potência outorgada das usinas em construção ou com construção não iniciada cujo dono majoritário está sob controle); concessionarias_transmissao; km_circuito_operacao; mva_transformacao_operacao; distribuidoras; unidades_consumidoras (Σ das distribuidoras sob controle, ano de referência da continuidade); exercicio; receita_rs_mi; ebit_rs_mi; lucro_liquido_rs_mi; divida_bruta_rs_mi; patrimonio_liquido_rs_mi; margem_ebit_pct; divida_bruta_sobre_pl; ultimo_pregao; fechamento_rs; retorno_preco_12m_pct; retorno_total_12m_pct; retorno_preco_desde_2020_pct; retorno_total_desde_2020_pct; volume_medio_diario_3m_rs_mi; fatos_relevantes_24m. Vazio = sem dado; zero = medido e igual a zero.",
        _url(CSV_USINAS): "Usinas sob controle de cada companhia (uma linha por companhia e usina): papel; holding_cnpj; nucleo_ceg; usina; tipo (SigTipoGeracao); fonte (SIGA, quando o módulo Expansão publica); fase; uf; mw (fiscalizada em operação; outorgada nas demais fases); dono_majoritario_cnpj; dono_majoritario_nome; pct_dono_majoritario; nivel (degraus de controle entre a holding e o dono direto; 0 = a própria holding). Usinas em que a companhia só tem participação minoritária ficam fora.",
        _url(CSV_TRANSMISSAO): "Concessionárias de transmissão sob controle de cada companhia: papel; holding_cnpj; cnpj; nome; km_circuito_operacao; km_circuito_implantacao; subestacoes; mva_transformacao_operacao; ufs (|); nivel. Copiado de empresas_transmissao.csv pelo CNPJ, sem recálculo.",
        _url(CSV_ACIONISTAS): "Acionistas diretos declarados no FRE: papel; holding_cnpj; fre_data_referencia; fre_versao; acionista (pessoa jurídica, fundo ou rótulo coletivo; pessoas físicas aparecem somadas, sem nome); tipo (PJ, coletivo ou pessoas_fisicas); acionista_cnpj; pct_on; pct_pn; pct_total (% como publicados); controlador (1/0); acordo_acionistas (1/0); nacionalidade; ultima_alteracao.",
        _url(CSV_COTACOES): "Pregões de cada papel da carteira: papel; codigo_negociado (código do dia; difere do papel antes de troca de código); isin; data; fechamento_rs (último preço do dia, R$ por ação ou unit, já dividido pelo fator de cotação); volume_rs (volume financeiro do dia); indice_preco (base 1 no primeiro pregão da série; ajustado por desdobramentos, grupamentos e bonificações); indice_retorno_total (o mesmo, com os proventos em dinheiro reinvestidos no fechamento da data ex).",
        _url(CSV_EVENTOS): "Eventos aplicados às séries de bolsa: papel; tipo (dinheiro ou acoes ou bonificacao_outra_classe); rotulo (como a B3 publica); data_com; data_ex (primeiro pregão depois da data com); valor_rs_por_acao (proventos; bonificação em outra classe = quantidade recebida × primeiro fechamento da classe recebida); multiplicador (eventos em ações); natureza (OBSERVADO ou ESTIMADO); nota.",
        _url(JSON_EVID): "Evidências 'Comprove este número' por papel (potência sob controle e retorno total em 12 meses), objeto de pipeline/energia/evidencia.py, lidas no build.",
        _url(CSV_FATOS): "Fatos relevantes entregues à CVM nos últimos 24 meses: papel; holding_cnpj; data_entrega; data_referencia; assunto (como escrito pela companhia); protocolo; versao; link (documento no sistema da CVM).",
    },
}

VERSAO_PROCESSAMENTO = "2"
# Marcas de evento em ações na especificação do papel na COTAHIST (EB, EDB, EG...): ex-bonificação ou
# ex-grupamento. A B3 também usa EB no desdobramento (Copel e Eneva em 12/03/2021).
LETRAS_EVENTO_ACOES = ("B", "G")


# ======================================================================= utilitários
def _processados(con):
    con.execute("CREATE TABLE IF NOT EXISTS listadas_processados(dataset TEXT, marca TEXT, processado_em TEXT,"
                " PRIMARY KEY(dataset, marca))")


def _ja_processado(con, ds, marca):
    _processados(con)
    return con.execute("SELECT 1 FROM listadas_processados WHERE dataset=? AND marca=?", (ds, marca)).fetchone() is not None


def _marca(con, ds, marca):
    _processados(con)
    con.execute("INSERT OR REPLACE INTO listadas_processados VALUES(?,?,?)", (ds, marca, base.agora_utc()))


class _Temporario:
    """Descomprime um arquivo do bronze (.gz) para um temporário (zip e Parquet precisam de acesso
    aleatório)."""

    def __init__(self, v, sufixo):
        self.v, self.sufixo, self.caminho = v, sufixo, None

    def __enter__(self):
        fd, self.caminho = tempfile.mkstemp(prefix="listadas-", suffix=self.sufixo)
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


def _br(v, casas=1):
    if v is None:
        return "sem dado"
    s = f"{v:,.{casas}f}"
    return s.replace(",", "§").replace(".", ",").replace("§", ".")


def _vigente(con, ds, recurso=None):
    """Vintage vigente com bronze no disco: se a última é órfã (recaptura adiada), a anterior
    mais recente com bronze, que já foi processada ou é processada pela própria vintage_id."""
    vs = ckan.vintages_vigentes(con, ds)
    if any(base.vintage_orfa(v) for v in vs.values()):
        legiveis = base.vintages_com_bronze(con, ds)
        vs = {r: (v if not base.vintage_orfa(v) else legiveis.get(r)) for r, v in vs.items()}
        vs = {r: v for r, v in vs.items() if v}
    return vs.get(recurso) if recurso is not None else vs


def _le_json_bronze(v):
    with base.abre_bronze(v["arquivo"]) as f:
        return f.read()


def _baixador_api(url, destino):
    """GET simples (respostas JSON pequenas da B3) gravado em disco."""
    corpo, _ = http_get(url)
    with open(destino, "wb") as f:
        f.write(corpo)
    return destino, len(corpo)


def _baixador_proventos(nome_pregao):
    """Todas as páginas de proventos de um emissor num só JSON (lista de 'results')."""
    def baixar(_url, destino):
        todos, pagina = [], 1
        while True:
            corpo, _ = http_get(b3.url_proventos(nome_pregao, pagina))
            d = b3.carrega_json(corpo)
            todos += d.get("results") or []
            total = (d.get("page") or {}).get("totalPages") or 1
            if pagina >= total:
                break
            pagina += 1
        corpo = json.dumps(todos, ensure_ascii=False, sort_keys=True).encode()
        with open(destino, "wb") as f:
            f.write(corpo)
        return destino, len(corpo)
    return baixar


def _baixador_cotahist(url, destino):
    return b3.baixa_retomando(url, destino, USER_AGENT)


def _last_modified(url):
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=60) as resp:
            lm = resp.headers.get("Last-Modified")
        if not lm:
            return None
        import email.utils
        return email.utils.parsedate_to_datetime(lm).astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    except Exception:
        return None


def _url_cvm(doc, ano):
    return f"{URL_CVM}/dados/CIA_ABERTA/DOC/{doc}/DADOS/{doc.lower()}_cia_aberta_{ano}.zip"


def _registra(status, chave, res):
    st = status.setdefault(chave, {"ok": True, "novas": 0, "identicas": 0, "puladas": 0, "falhas": []})
    k = {"nova": "novas", "identica": "identicas", "pulada": "puladas"}.get(res["status"])
    if k:
        st[k] += 1
    else:
        st["falhas"].append(res["detalhe"])
        st["ok"] = False


def _poda_bronze(con, ds, recurso, manter):
    """Apaga do bronze as cópias anteriores de um recurso que muda todo dia (COTAHIST do ano
    corrente, 80 MB por cópia): a vintage continua registrada no silver com o sha256, e as
    cotações extraídas dela ficam nas observações."""
    apagados = 0
    for (arq,) in con.execute("SELECT arquivo FROM vintages WHERE dataset=? AND recurso=? AND arquivo IS NOT NULL",
                              (ds, recurso)).fetchall():
        if arq == manter:
            continue
        caminho = os.path.join(base.RAIZ, arq)
        if os.path.exists(caminho):
            os.remove(caminho)
            apagados += 1
    return apagados


# ======================================================================= coleta
def coletar(con, ctx):
    hoje = ctx.get("hoje") or date.today()
    if ctx.get("sem_rede"):
        return {"ok": True, "detalhe": "execução sem rede: nada coletado"}
    status = {}
    # 1. carteira do IEE (muda todo dia: pesos e quantidade teórica)
    res = ckan.baixar_recurso(con, orgao="B3", dataset=DS_IEE, recurso=REC_IEE, url=b3.url_carteira(), ext="json",
                              max_idade_dias=1, baixador=_baixador_api)
    _registra(status, DS_IEE, res)
    v = _vigente(con, DS_IEE, REC_IEE)
    if v and not _ja_processado(con, DS_IEE, v["vintage_id"]):
        cart = b3.le_carteira(_le_json_bronze(v))
        if cart["data"]:
            linhas = [(f"peso:{p['papel']}", cart["data"], p["peso_pct"]) for p in cart["papeis"]]
            linhas += [(f"qtd:{p['papel']}", cart["data"], p["qtd_teorica"]) for p in cart["papeis"]]
            base.grava_observacoes(con, DS_IEE, v["vintage_id"], linhas)
        _marca(con, DS_IEE, v["vintage_id"])
        con.commit()
    if not v:
        return {"ok": False, "detalhe": status}
    cart = b3.le_carteira(_le_json_bronze(v))
    emissores = sorted({p["papel"][:4] for p in cart["papeis"]})
    # 2. emissores: quantidade de ações, eventos em ações e proventos
    for em in emissores:
        res = ckan.baixar_recurso(con, orgao="B3", dataset=DS_SUPLEMENTO, recurso=f"suplemento_{em}.json",
                                  url=b3.url_suplemento(em), ext="json", max_idade_dias=7, baixador=_baixador_api)
        _registra(status, DS_SUPLEMENTO, res)
        vs = _vigente(con, DS_SUPLEMENTO, f"suplemento_{em}.json")
        sup = b3.le_suplemento(_le_json_bronze(vs)) if vs else None
        if not sup or not sup["nome_pregao"]:
            continue
        res = ckan.baixar_recurso(con, orgao="B3", dataset=DS_PROVENTOS, recurso=f"proventos_{em}.json",
                                  url=b3.url_proventos(sup["nome_pregao"], 1), ext="json", max_idade_dias=7,
                                  baixador=_baixador_proventos(sup["nome_pregao"]))
        _registra(status, DS_PROVENTOS, res)
    # 3. CVM: FCA (códigos de negociação desde 2020), FRE (três anos) e IPE (três anos)
    alvos = [(DS_FCA, "FCA", ano, 7 if ano >= hoje.year - 1 else 90) for ano in range(ANO_INICIAL_FCA, hoje.year + 1)]
    alvos += [(DS_FRE, "FRE", ano, 7 if ano >= hoje.year - 1 else 90) for ano in range(hoje.year - ANOS_FRE + 1, hoje.year + 1)]
    alvos += [(DS_IPE, "IPE", ano, 1 if ano == hoje.year else 7) for ano in range(hoje.year - ANOS_IPE + 1, hoje.year + 1)]
    for ds, doc, ano, idade in alvos:
        url = _url_cvm(doc, ano)
        res = ckan.baixar_recurso(con, orgao="CVM", dataset=ds, recurso=f"{doc.lower()}_cia_aberta_{ano}.zip", url=url,
                                  publicado_em=_last_modified(url), ext="zip", max_idade_dias=idade)
        _registra(status, ds, res)
    # 4. cotações: um arquivo por ano; o do ano corrente muda todo dia útil (recoleta a cada 3 dias)
    prefixos = set(emissores) | PREFIXOS_ANTERIORES
    marca_pref = ",".join(sorted(prefixos)) + "#v" + VERSAO_PROCESSAMENTO
    for ano in range(ANO_BASE_COTACOES, hoje.year + 1):
        rec = f"COTAHIST_A{ano}.ZIP"
        corrente = ano == hoje.year
        res = ckan.baixar_recurso(con, orgao="B3", dataset=DS_COTAHIST, recurso=rec, url=b3.URL_COTAHIST.format(ano=ano),
                                  ext="zip", max_idade_dias=3 if corrente else 180, baixador=_baixador_cotahist)
        _registra(status, DS_COTAHIST, res)
        vc = _vigente(con, DS_COTAHIST, rec)
        if vc and not _ja_processado(con, DS_COTAHIST, f"{vc['vintage_id']}#{marca_pref}"):
            status.setdefault("cotahist:processamento", {})[rec] = _processa_cotahist(con, vc, prefixos)
            _marca(con, DS_COTAHIST, f"{vc['vintage_id']}#{marca_pref}")
            con.commit()
        if vc and corrente:
            status.setdefault("cotahist:poda", {})[rec] = _poda_bronze(con, DS_COTAHIST, rec, vc["arquivo"])
    # 5. Polímero: reaproveita a captura do módulo Empresas (mesmo arquivo) quando existe
    status[DS_POLIMERO] = _coleta_polimero(con)
    ok = all((s.get("ok", True) if isinstance(s, dict) else True) for s in status.values())
    return {"ok": ok, "detalhe": status}


def _processa_cotahist(con, v, prefixos):
    """Fechamento e volume de cada código (mercado à vista, lote padrão) em observações:
    séries 'fech:<código>:<ISIN>' e 'vol:<código>:<ISIN>' com a data do pregão como referência."""
    linhas, n = [], 0
    with _Temporario(v, ".zip") as caminho:
        for r in b3.le_cotahist(b3.linhas_do_zip(caminho), prefixos):
            if r["bdi"] != "02":
                continue
            chave = f"{r['codigo']}:{r['isin']}"
            linhas.append((f"fech:{chave}", r["data"], r["fechamento"]))
            linhas.append((f"vol:{chave}", r["data"], r["volume"]))
            if _marca_evento_acoes(r["especificacao"]):
                linhas.append((f"evb:{chave}", r["data"], 1.0))
            n += 1
    novas, rev = base.grava_observacoes(con, DS_COTAHIST, v["vintage_id"], linhas)
    return {"pregoes": n, "novas": novas, "revisoes": rev}


def _marca_evento_acoes(especificacao):
    """True quando a especificação traz a marca de ex-evento em ações (token que começa com E e tem B ou G)."""
    return any(t.startswith("E") and len(t) <= 4 and any(x in t[1:] for x in LETRAS_EVENTO_ACOES)
               for t in (especificacao or "").split())


def _vintage_polimero_empresas():
    """Vintage do Polímero no silver da família empresas (aberto só para leitura), se o arquivo
    do bronze existe."""
    caminho = os.path.join(base.SILVER, "empresas.db")
    if not os.path.exists(caminho):
        return None
    try:
        src = sqlite3.connect(f"file:{caminho}?mode=ro", uri=True, timeout=60)
        try:
            row = src.execute(
                """SELECT vintage_id, recurso, url, capturado_em, publicado_em, sha256, bytes, origem, arquivo
                   FROM vintages WHERE dataset=? AND recurso=? ORDER BY capturado_em DESC LIMIT 1""",
                (DS_POLIMERO, REC_POLIMERO)).fetchone()
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


def _coleta_polimero(con):
    v = _vintage_polimero_empresas()
    if v:
        vid, nova = base.registra_vintage(con, DS_POLIMERO, v["recurso"], v["url"], v["capturado_em"], v["publicado_em"],
                                          v["sha256"], v["bytes"], "reuso:empresas", v["arquivo"])
        base.registra_coleta(con, DS_POLIMERO, v["recurso"], True, f"reuso da vintage {vid} da família empresas")
        con.commit()
        return {"ok": True, "reuso": vid, "nova": nova}
    st, _meta, _v = ckan.coleta_pacote(con, orgao="ANEEL", nome="composicao-societaria-polimero", dataset=DS_POLIMERO,
                                       filtro_recurso=lambda r: (r.get("format") or "").upper() == "PARQUET",
                                       max_idade_dias=30)
    return {k: st.get(k) for k in ("ok", "novas", "identicas", "puladas", "falhas")}


# ======================================================================= leitura das saídas do módulo Empresas
def _le_csv_series(nome):
    caminho = os.path.join(base.SERIES, nome)
    if not os.path.exists(caminho):
        return None
    with open(caminho, encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter=";"))


def _f(v):
    t = (v or "").strip()
    return float(t) if t else None


def _usinas_de_empresas(linhas):
    """empresas_ativos.csv (uma linha por usina e proprietário) → {núcleo: usina} com os donos
    agregados por CNPJ, como no módulo Empresas (_agrega_por_cnpj): participação somada por CNPJ,
    majoritário = CNPJ com mais de 50% numa usina de participações válidas."""
    us = {}
    for r in linhas:
        k = r["nucleo_ceg"]
        u = us.get(k)
        if u is None:
            u = us[k] = {"nucleo": k, "nome": r["usina"], "tipo": r["tipo"], "fase": r["fase"], "uf": r["uf"],
                         "kw_outorgado": _f(r["kw_outorgado"]), "kw_fiscalizado": _f(r["kw_fiscalizado"]),
                         "estado": r["estado_vinculo"], "soma_pct": _f(r["soma_pct"]), "donos": collections.OrderedDict(),
                         "nomes": {}}
        cn = (r.get("proprietario_cnpj") or "").strip()
        if cn:
            u["donos"][cn] = u["donos"].get(cn, 0.0) + (_f(r["pct"]) or 0.0)
            if r.get("proprietario_nome"):
                u["nomes"].setdefault(cn, r["proprietario_nome"])
    for u in us.values():
        valido = u["estado"] in ("vinculado", "inclui_sem_documento")
        u["valido"] = valido
        u["majoritario"] = next((cn for cn, p in u["donos"].items() if p > 50.0), None) if valido else None
    return us


# ======================================================================= construção
def _cadeias(grafo, candidatos):
    cache = {}
    for x in candidatos:
        if x and x not in cache:
            cache[x] = ae.cadeia_de_controle(grafo, x) if grafo else {"topo": x, "cadeia": [x], "motivo_parada": "sem_declaracao", "pcts": [], "acima": None}
    return cache


def _sob_controle(cadeias, holding):
    """{cnpj: nível} das empresas cuja cadeia de controladores únicos passa pela holding
    (nível 0 = a própria holding)."""
    out = {holding: 0}
    for x, cad in cadeias.items():
        if holding in cad["cadeia"]:
            out[x] = cad["cadeia"].index(holding)
    return out


def _serie_obs(con, ds, prefixo):
    """{série: [(ref, valor)]} vigentes das observações cujo nome começa por `prefixo`."""
    atual = {}
    for serie, ref, valor in con.execute(
            """SELECT o.serie, o.ref, o.valor FROM observacoes o JOIN vintages v ON v.vintage_id=o.vintage_id
               WHERE o.dataset=? AND o.serie LIKE ? ORDER BY v.capturado_em, o.rowid""", (ds, prefixo + "%")):
        atual[(serie, ref)] = valor
    out = collections.defaultdict(list)
    for (serie, ref), valor in atual.items():
        out[serie].append((ref, valor))
    for s in out.values():
        s.sort()
    return out


def _codigos_por_cnpj(fca_valores):
    """{cnpj: {código: {classe, segmento, inicio, fim, anos}}} a partir dos FCA de todos os anos."""
    out = collections.defaultdict(dict)
    for ano, lst in sorted(fca_valores.items()):
        for x in lst:
            classe = cl.classe_do_valor(x["valor_mobiliario"], x["classe_preferencial"])
            if classe is None:
                continue
            d = out[x["cnpj"]].setdefault(x["codigo"], {"classe": classe, "segmento": x["segmento"], "anos": []})
            d["segmento"] = x["segmento"] or d["segmento"]
            d["anos"].append(ano)
            d["fim_negociacao"] = x["fim_negociacao"]
    return out


def _monta_serie_papel(papel, classe_iee, cnpj, codigos_cnpj, fech, vol):
    """Série de pregões do papel, emendada a códigos anteriores da mesma companhia e classe
    quando o último pregão do código anterior é o pregão imediatamente anterior ao primeiro do
    código atual (dez dias corridos no máximo) e o FCA da companhia publica o código anterior.
    Retorna (pregões [(data, código, isin, fechamento, volume)], emendas, isin_atual)."""
    def pregões_de(cod):
        out = []
        for serie, pts in fech.items():
            _, c_, isin = serie.split(":")
            if c_ == cod:
                vs = dict(vol.get(f"vol:{c_}:{isin}", []))
                out += [(d, c_, isin, p, vs.get(d)) for d, p in pts]
        return sorted(out)
    atual = pregões_de(papel)
    if not atual:
        return [], [], None
    isin_atual = atual[-1][2]
    classe = (codigos_cnpj.get(papel) or {}).get("classe") or classe_iee
    emendas = []
    serie = atual
    vistos = {papel}
    while True:
        inicio = serie[0][0]
        cand = []
        for cod, info in codigos_cnpj.items():
            if cod in vistos or info["classe"] != classe:
                continue
            p = pregões_de(cod)
            if p and p[-1][0] < inicio and (date.fromisoformat(inicio) - date.fromisoformat(p[-1][0])).days <= 10:
                cand.append((p[-1][0], cod, p))
        if len(cand) != 1:
            break
        ult, cod, p = cand[0]
        razao = serie[0][3] / p[-1][3] if p[-1][3] else None
        emendas.append({"codigo_anterior": cod, "isin_anterior": p[-1][2], "ultimo_pregao_anterior": ult,
                        "primeiro_pregao": inicio, "codigo": serie[0][1], "isin": serie[0][2],
                        "razao_preco": _r(razao, 4)})
        vistos.add(cod)
        serie = p + serie
    return serie, emendas, isin_atual


def _mensal(serie):
    """Último pregão de cada mês: [(AAAA-MM, preço, índice de preço, índice total)]."""
    out = collections.OrderedDict()
    for d, p, ip, it in serie:
        out[d[:7]] = (d[:7], p, ip, it)
    return list(out.values())


def construir(con, ctx):
    hoje = ctx.get("hoje") or date.today()
    golds = ctx.get("golds") or {}
    emp = golds.get("empresas.json") or base.le_gold("empresas.json")
    if not (isinstance(emp, dict) and emp.get("disponivel") is True):
        return c.stub(GOLD, "a gold do módulo Empresas não está disponível nesta publicação")
    v_iee = _vigente(con, DS_IEE, REC_IEE)
    if not v_iee:
        return c.stub(GOLD, "carteira do IEE ausente no silver da família listadas")
    cart = b3.le_carteira(_le_json_bronze(v_iee))
    criticas, ressalvas = [], []
    if not cart["papeis"] or not cart["data"]:
        return c.stub(GOLD, "carteira do IEE sem papéis ou sem data")
    soma_pesos = sum(p["peso_pct"] or 0 for p in cart["papeis"])
    if abs(soma_pesos - 100.0) > 0.05:
        criticas.append(f"pesos da carteira somam {soma_pesos:.3f}%")
    if cart["total_registros"] is not None and cart["total_registros"] != len(cart["papeis"]):
        criticas.append(f"carteira com {cart['total_registros']} registros e {len(cart['papeis'])} papéis lidos")

    # ---------------------------------------------------------------- B3: emissores e proventos
    sups, provs, v_sups, v_provs = {}, {}, {}, {}
    for p in cart["papeis"]:
        em = p["papel"][:4]
        vs = _vigente(con, DS_SUPLEMENTO, f"suplemento_{em}.json")
        vp = _vigente(con, DS_PROVENTOS, f"proventos_{em}.json")
        if vs:
            sups[em], v_sups[em] = b3.le_suplemento(_le_json_bronze(vs)), vs
        if vp:
            provs[em], v_provs[em] = b3.le_proventos(json.loads(_le_json_bronze(vp))), vp

    # ---------------------------------------------------------------- CVM: FCA, FRE, IPE
    fca_geral_linhas, fca_valores, v_fca = [], {}, {}
    for rec, v in sorted(_vigente(con, DS_FCA).items()):
        ano = int(rec.split("_")[-1].split(".")[0])
        v_fca[ano] = v
        with _Temporario(v, ".zip") as caminho:
            fca_geral_linhas += cl.linhas_zip(caminho, "fca_cia_aberta_geral_")
            fca_valores[ano] = cl.le_fca_valores(cl.linhas_zip(caminho, "fca_cia_aberta_valor_mobiliario_"))
    por_codigo_cvm = {}
    for r in fca_geral_linhas:
        cod = (r.get("Codigo_CVM") or "").lstrip("0")
        cn = cl._c14(r.get("CNPJ_Companhia"))
        if cod and cn:
            por_codigo_cvm[cod] = cn
    codigos = _codigos_por_cnpj(fca_valores)
    papel_cnpj, conferencia = {}, {}
    for p in cart["papeis"]:
        em = p["papel"][:4]
        sup = sups.get(em)
        cn_b3 = por_codigo_cvm.get((sup or {}).get("codigo_cvm") or "")
        cn_fca = sorted(cn for cn, cods in codigos.items() if p["papel"] in cods)
        papel_cnpj[p["papel"]] = cn_b3 or (cn_fca[0] if len(cn_fca) == 1 else None)
        conferencia[p["papel"]] = {"codigo_cvm_b3": (sup or {}).get("codigo_cvm"), "cnpj_pelo_codigo_cvm": cn_b3,
                                   "cnpjs_que_declaram_o_codigo": cn_fca,
                                   "resultado": "igual" if cn_b3 and cn_fca == [cn_b3] else ("divergente" if cn_b3 and cn_fca else "parcial")}
        if conferencia[p["papel"]]["resultado"] == "divergente":
            criticas.append(f"{p['papel']}: CNPJ pelo código CVM da B3 ({cn_b3}) difere do FCA ({cn_fca})")
    holdings = {cn for cn in papel_cnpj.values() if cn}
    if len(holdings) != len(cart["papeis"]):
        ressalvas.append("papel sem CNPJ conferido ou duas classes da mesma companhia na carteira")
    geral = cl.le_fca_geral(fca_geral_linhas, holdings)

    fre_por_ano, v_fre = {}, {}
    for rec, v in sorted(_vigente(con, DS_FRE).items()):
        ano = int(rec.split("_")[-1].split(".")[0])
        v_fre[ano] = v
        with _Temporario(v, ".zip") as caminho:
            fre_por_ano[ano] = cl.le_posicao_acionaria(cl.linhas_zip(caminho, "fre_cia_aberta_posicao_acionaria_"), holdings)
    desde_ipe = (hoje - timedelta(days=round(MESES_MOVIMENTOS * 30.4375))).isoformat()
    fatos, v_ipe = [], {}
    for rec, v in sorted(_vigente(con, DS_IPE).items()):
        ano = int(rec.split("_")[-1].split(".")[0])
        v_ipe[ano] = v
        with _Temporario(v, ".zip") as caminho:
            fatos += cl.le_ipe(cl.linhas_zip(caminho, "ipe_cia_aberta_"), holdings, desde=desde_ipe)
    fatos.sort(key=lambda x: (x["data_entrega"], x["protocolo"] or ""), reverse=True)

    # ---------------------------------------------------------------- ANEEL: cadeia de controle
    v_pol = _vigente(con, DS_POLIMERO, REC_POLIMERO)
    pol = grafo = None
    if v_pol:
        with _Temporario(v_pol, ".parquet") as caminho:
            pol = ae.le_polimero(lambda: ae.linhas_polimero(caminho))
        if pol["referencia"]:
            grafo = ae.grafo_vigente(pol, pol["referencia"])
    if grafo is None:
        criticas.append("Composição Societária (Polímero) indisponível: sem cadeia de controle")
    nomes_pol = ae.nomes_polimero(pol) if pol else {}
    ref_emp = ((emp.get("controle") or {}).get("polimero") or {}).get("trimestre_referencia")
    ref_pol = ae.rotulo_periodo(pol["referencia"]) if pol and pol["referencia"] else None
    if ref_emp and ref_pol and ref_emp != ref_pol:
        ressalvas.append(f"trimestre de referência do Polímero ({ref_pol}) difere do usado pelo módulo Empresas ({ref_emp})")

    ativos_csv = _le_csv_series("empresas_ativos.csv")
    trans_csv = _le_csv_series("empresas_transmissao.csv") or []
    agentes_csv = _le_csv_series("empresas_agentes.csv") or []
    grupos_csv = {r["grupo_cnpj"]: r for r in (_le_csv_series("empresas_grupos.csv") or [])}
    fontes_siga = {r["nucleo_ceg"]: r["fonte"] for r in (_le_csv_series("expansao_usinas_siga.csv") or [])}
    if ativos_csv is None:
        return c.stub(GOLD, "empresas_ativos.csv ausente: o módulo Empresas não publicou as usinas")
    usinas = _usinas_de_empresas(ativos_csv)
    distribs = (emp.get("distribuidoras") or {}).get("indice") or []
    candidatos = set()
    for u in usinas.values():
        candidatos.update(u["donos"])
    candidatos.update(r["cnpj"] for r in trans_csv)
    candidatos.update(d["cnpj"] for d in distribs)
    candidatos.update(r["cnpj"] for r in agentes_csv)
    if grafo:
        candidatos.update(grafo["origem"])
    candidatos.update(holdings)
    cadeias = _cadeias(grafo, candidatos)
    agentes_com = {r["cnpj"] for r in agentes_csv if r.get("comercializacao") == "1" and r.get("ativo") == "1"}
    nomes = {}
    for r in agentes_csv:
        if r.get("razao_social"):
            nomes[r["cnpj"]] = r["razao_social"]
    for k, n in nomes_pol.items():
        nomes.setdefault(k, n)
    for u in usinas.values():
        for cn, n in u["nomes"].items():
            nomes.setdefault(cn, n)
    for cn, gx in geral.items():
        nomes[cn] = gx["nome"] or nomes.get(cn)

    # ---------------------------------------------------------------- cotações
    fech = _serie_obs(con, DS_COTAHIST, "fech:")
    evb = _serie_obs(con, DS_COTAHIST, "evb:")
    vol = _serie_obs(con, DS_COTAHIST, "vol:")
    v_cot = _vigente(con, DS_COTAHIST)
    ultimo_pregao_geral = max((pts[-1][0] for pts in fech.values() if pts), default=None)

    data_siga = (emp.get("datas") or {}).get("siga")
    data_siget = ((emp.get("cadastro") or {}).get("transmissao") or {}).get("data")
    fin_series = {}
    caminho_fin = os.path.join(base.SERIES, "empresas_financas.json")
    if os.path.exists(caminho_fin):
        with open(caminho_fin, encoding="utf-8") as f:
            fin_series = (json.load(f).get("series") or {})
    companhias_fin = {x["cnpj"]: x for x in ((emp.get("financas") or {}).get("companhias") or [])}

    companhias, linhas_us, linhas_tr, linhas_ac, linhas_cot, linhas_ev, linhas_fa = [], [], [], [], [], [], []
    evidencias = {}
    for p in sorted(cart["papeis"], key=lambda x: -(x["peso_pct"] or 0)):
        papel, em = p["papel"], p["papel"][:4]
        cn = papel_cnpj.get(papel)
        gx = geral.get(cn) or {}
        sup = sups.get(em) or {}
        sob = _sob_controle(cadeias, cn) if cn else {}
        cad_h = cadeias.get(cn) or {"cadeia": [cn], "topo": cn, "motivo_parada": "sem_declaracao", "pcts": [], "acima": None}

        # geração
        g_tipo = collections.defaultdict(lambda: {"mw_controle": 0.0, "usinas": 0, "mw_proporcional": 0.0})
        g_uf = collections.defaultdict(float)
        g_nivel = collections.defaultdict(lambda: [0.0, 0])
        mw_ctrl = mw_prop = mw_impl = 0.0
        n_ctrl = n_impl = 0
        lista = []
        for u in usinas.values():
            op = u["fase"] == "Operação"
            kw = u["kw_fiscalizado"] if op else u["kw_outorgado"]
            if u["valido"] and op and u["kw_fiscalizado"]:
                parcela = sum(pct for d_, pct in u["donos"].items() if d_ in sob)
                if parcela and u["soma_pct"]:
                    x = u["kw_fiscalizado"] / 1000.0 * parcela / u["soma_pct"]
                    mw_prop += x
                    g_tipo[u["tipo"]]["mw_proporcional"] += x
            maj = u["majoritario"]
            if maj and maj in sob and kw:
                mw = kw / 1000.0
                if op:
                    mw_ctrl += mw
                    n_ctrl += 1
                    g_tipo[u["tipo"]]["mw_controle"] += mw
                    g_tipo[u["tipo"]]["usinas"] += 1
                    g_uf[u["uf"]] += mw
                    g_nivel[sob[maj]][0] += mw
                    g_nivel[sob[maj]][1] += 1
                else:
                    mw_impl += mw
                    n_impl += 1
                lista.append({"nucleo": u["nucleo"], "nome": u["nome"], "tipo": u["tipo"], "fonte": fontes_siga.get(u["nucleo"]),
                              "fase": u["fase"], "uf": u["uf"], "mw": _r(mw, 3), "dono_cnpj": maj,
                              "dono_nome": u["nomes"].get(maj) or nomes.get(maj), "pct_dono": _r(u["donos"][maj], 2),
                              "nivel": sob[maj]})
        lista.sort(key=lambda x: (x["fase"] != "Operação", -(x["mw"] or 0), x["nucleo"]))
        for x in lista:
            linhas_us.append([papel, cn, x["nucleo"], x["nome"], x["tipo"], x["fonte"], x["fase"], x["uf"], x["mw"],
                              x["dono_cnpj"], x["dono_nome"], x["pct_dono"], x["nivel"]])
        # reconciliação: holding que é topo de grupo tem a mesma potência sob controle do módulo Empresas
        rec_grupo = None
        if cn in grupos_csv and cad_h["topo"] == cn:
            gc = grupos_csv[cn]
            rec_grupo = {"mw_controle_empresas": _f(gc["mw_controle"]), "mw_proporcional_empresas": _f(gc["mw_proporcional"]),
                         "dif_controle": _r(mw_ctrl - (_f(gc["mw_controle"]) or 0), 3),
                         "dif_proporcional": _r(mw_prop - (_f(gc["mw_proporcional"]) or 0), 3)}
            if abs(rec_grupo["dif_controle"] or 0) > 0.01 or abs(rec_grupo["dif_proporcional"] or 0) > 0.01:
                ressalvas.append(f"{papel}: potência difere da do grupo no módulo Empresas ({rec_grupo})")

        # transmissão
        trs = [r for r in trans_csv if r["cnpj"] in sob]
        tr = None
        if trs:
            ufs = sorted({u for r in trs for u in (r["ufs"] or "").split("|") if u})
            tr = {"concessionarias": len(trs),
                  "km_circuito_operacao": _r(sum(_f(r["km_circuito_operacao"]) or 0 for r in trs), 2),
                  "km_circuito_implantacao": _r(sum(_f(r["km_circuito_implantacao"]) or 0 for r in trs), 2),
                  "subestacoes_soma": int(sum(_f(r["subestacoes"]) or 0 for r in trs)),
                  "mva_transformacao_operacao": _r(sum(_f(r["mva_transformacao_operacao"]) or 0 for r in trs), 1),
                  "ufs": ufs,
                  "maiores": [{"cnpj": r["cnpj"], "nome": r["nome"], "km": _f(r["km_circuito_operacao"]),
                               "mva": _f(r["mva_transformacao_operacao"]), "nivel": sob[r["cnpj"]]}
                              for r in sorted(trs, key=lambda r: -(_f(r["km_circuito_operacao"]) or 0))[:10]]}
            for r in trs:
                linhas_tr.append([papel, cn, r["cnpj"], r["nome"], r["km_circuito_operacao"], r["km_circuito_implantacao"],
                                  r["subestacoes"], r["mva_transformacao_operacao"], r["ufs"], sob[r["cnpj"]]])
        # distribuição
        ds = [d for d in distribs if d["ativa"] and cn in ((d.get("controle") or {}).get("cadeia") or [])]
        dist = [{"slug": d["slug"], "sigla": d["sigla"], "nome": d["nome"], "ufs": d["ufs"],
                 "ucs": (d.get("qualidade") or {}).get("ucs"), "ano": (d.get("qualidade") or {}).get("ano"),
                 "nivel": (d["controle"]["cadeia"]).index(cn)} for d in ds]
        dist.sort(key=lambda x: -(x["ucs"] or 0))
        ucs_tot = sum(x["ucs"] or 0 for x in dist) if dist else None
        anos_ucs = sorted({x["ano"] for x in dist if x["ano"]})
        comerc = sorted(x for x in sob if x in agentes_com)

        geracao = {"usinas_controle": n_ctrl, "mw_controle": _r(mw_ctrl, 1), "mw_proporcional": _r(mw_prop, 1),
                   "usinas_em_implantacao": n_impl, "mw_em_implantacao": _r(mw_impl, 1),
                   "por_tipo": sorted([{"tipo": t, "mw_controle": _r(v["mw_controle"], 1), "usinas": v["usinas"],
                                        "mw_proporcional": _r(v["mw_proporcional"], 1)} for t, v in g_tipo.items()],
                                      key=lambda x: -(x["mw_controle"] or 0)),
                   "por_uf": sorted([{"uf": k, "mw_controle": _r(v, 1)} for k, v in g_uf.items()], key=lambda x: -x["mw_controle"]),
                   "por_nivel": [{"nivel": k, "mw_controle": _r(v[0], 1), "usinas": v[1]} for k, v in sorted(g_nivel.items())],
                   "maiores": [x for x in lista if x["fase"] == "Operação"][:10],
                   "em_implantacao": [x for x in lista if x["fase"] != "Operação"][:6],
                   "reconciliacao_grupo": rec_grupo}
        atuacao = {"geracao": n_ctrl > 0 or mw_prop > 0, "transmissao": bool(tr and (tr["km_circuito_operacao"] or tr["mva_transformacao_operacao"])),
                   "distribuicao": bool(dist), "comercializacao_declarada": bool(comerc),
                   "empresas_comercializacao": len(comerc)}

        # controle para cima
        acima = []
        for i, x in enumerate(cad_h["cadeia"][1:]):
            acima.append({"cnpj": x, "nome": nomes.get(x), "pct": _r(cad_h["pcts"][i], 2) if i < len(cad_h["pcts"]) else None})
        fre_anos = sorted(a for a in fre_por_ano if cn in fre_por_ano[a])
        fre_atual = fre_por_ano[fre_anos[-1]][cn] if fre_anos else None
        fre_ant = fre_por_ano[fre_anos[-2]][cn] if len(fre_anos) > 1 else None
        mudancas = _mudancas_acionarias(fre_ant, fre_atual) if fre_atual and fre_ant else []
        if fre_atual:
            for a in fre_atual["acionistas"]:
                linhas_ac.append([papel, cn, fre_atual["data_referencia"], fre_atual["versao"], a["nome"], a["tipo"], a["cnpj"],
                                  a["pct_on"], a["pct_pn"], a["pct_total"], 1 if a["controlador"] else 0, 1 if a["acordo"] else 0,
                                  a["nacionalidade"], a["ultima_alteracao"]])
            pf = fre_atual["pessoas_fisicas"]
            if pf:
                linhas_ac.append([papel, cn, fre_atual["data_referencia"], fre_atual["versao"], f"{pf['quantidade']} pessoas físicas",
                                  "pessoas_fisicas", None, pf["pct_on"], pf["pct_pn"], pf["pct_total"],
                                  1 if pf["controladores"] else 0, None, None, None])
        controle = {
            "especie_fca": gx.get("especie_controle"),
            "cadeia_acima": acima, "topo_cnpj": cad_h["topo"], "topo_nome": nomes.get(cad_h["topo"]),
            "motivo_parada": cad_h["motivo_parada"], "acima_sem_cnpj": cad_h["acima"],
            "empresas_sob_controle": len(sob),
            "fre": ({"data_referencia": fre_atual["data_referencia"], "versao": fre_atual["versao"], "ano_formulario": fre_anos[-1],
                     "acionistas": fre_atual["acionistas"], "pessoas_fisicas": fre_atual["pessoas_fisicas"]} if fre_atual else None),
            "mudancas": mudancas,
            "mudancas_desde": ({"ano_formulario": fre_anos[-2], "data_referencia": fre_ant["data_referencia"], "versao": fre_ant["versao"]}
                               if fre_ant else None),
        }
        # finanças
        financas = _financas(fin_series.get(cn), companhias_fin.get(cn))
        # bolsa
        bolsa, cot, evs = _bolsa(papel, p["classe"], cn, codigos.get(cn) or {}, fech, vol, sup, provs.get(em) or [], evb)
        linhas_cot += cot
        linhas_ev += evs
        # movimentos
        meus = [f for f in fatos if f["cnpj"] == cn]
        for f_ in meus:
            linhas_fa.append([papel, cn, f_["data_entrega"], f_["data_referencia"], f_["assunto"], f_["protocolo"], f_["versao"], f_["link"]])
        movimentos = {"fatos_relevantes_24m": len(meus), "desde": desde_ipe,
                      "por_ano": dict(sorted(collections.Counter(f_["data_entrega"][:4] for f_ in meus).items())),
                      "recentes": [{k: f_[k] for k in ("data_entrega", "assunto", "link", "protocolo")} for f_ in meus[:10]]}

        comp = {
            "papel": papel, "slug": papel.lower(), "emissor": em, "cnpj": cn,
            "codigo_cvm": sup.get("codigo_cvm") or gx.get("codigo_cvm"),
            "nome": gx.get("nome") or nomes.get(cn), "nome_pregao": p["nome_pregao"], "nome_anterior": gx.get("nome_anterior"),
            "data_nome": gx.get("data_nome"),
            "descricao_atividade": gx.get("descricao_atividade"), "setor_cvm": gx.get("setor"), "pagina_web": gx.get("pagina_web"),
            "fca": {"data_referencia": gx.get("data_referencia"), "versao": gx.get("versao")},
            "iee": {"peso_pct": p["peso_pct"], "tipo": p["tipo"], "classe": p["classe"], "segmento": p["segmento"],
                    "segmento_nome": b3.SEGMENTOS.get(p["segmento"]), "qtd_teorica": p["qtd_teorica"]},
            "conferencia_cnpj": conferencia[papel],
            "atuacao": atuacao, "geracao": geracao, "transmissao": tr,
            "distribuicao": {"distribuidoras": dist, "unidades_consumidoras": ucs_tot, "anos": anos_ucs} if dist else None,
            "controle": controle, "financas": financas, "bolsa": bolsa, "movimentos": movimentos,
        }
        companhias.append(comp)
        soma_lista = sum(x["mw"] or 0 for x in lista if x["fase"] == "Operação")
        evidencias[papel] = _evidencias(comp, cart, v_iee, v_pol, data_siga, emp, v_cot, ref_pol, soma_lista)

    # validações de domínio
    for x in companhias:
        g = x["geracao"]
        if (g["mw_controle"] or 0) < 0 or (g["mw_proporcional"] or 0) < 0:
            criticas.append(f"{x['papel']}: potência negativa")
        b = x["bolsa"]
        if b and b.get("fechamento") is not None and b["fechamento"] <= 0:
            criticas.append(f"{x['papel']}: fechamento não positivo")
        for e in (b or {}).get("saltos", []):
            ressalvas.append(f"{x['papel']}: variação diária ajustada de {e['variacao_pct']}% em {e['data']}")
    if criticas:
        return c.stub(GOLD, "; ".join(criticas)[:300])

    _escreve_csvs(cart, v_iee, companhias, linhas_us, linhas_tr, linhas_ac, linhas_cot, linhas_ev, linhas_fa)
    base.escreve_gold(JSON_EVID, {"gerado_em": base.agora_utc(), "evidencias": evidencias}, destino=base.SERIES)
    # o FRE tem como data de referência o fim do exercício a que se refere (31/12 do ano do formulário);
    # a data da posição é a última alteração declarada em cada acionista
    fre_datas = sorted({a["ultima_alteracao"] for x in companhias for a in ((x["controle"]["fre"] or {}).get("acionistas") or [])
                        if a.get("ultima_alteracao")})
    prov = _proveniencias(cart, v_iee, v_sups, v_provs, v_cot, v_fca, v_fre, v_ipe, v_pol, emp, data_siga, data_siget,
                          ultimo_pregao_geral, ref_pol, con, fre_datas, desde_ipe, hoje)
    g = c.cabecalho(GOLD)
    g.update({
        "datas": {"carteira_iee": cart["data"], "carteira_capturada_em": v_iee["capturado_em"], "siga": data_siga,
                  "siget": data_siget, "polimero_trimestre": ref_pol, "ultimo_pregao": ultimo_pregao_geral,
                  "fre_anos": sorted(v_fre), "ipe_desde": desde_ipe,
                  "financas_ultimo_exercicio": ((emp.get("financas") or {}).get("periodos") or {}).get("ultimo_exercicio")},
        "universo": {"regra": "Papéis da carteira do dia do Índice de Energia Elétrica (IEE) da B3, ligados à companhia pelo código CVM publicado pela B3 e conferido no código de negociação declarado no FCA da CVM.",
                     "papeis": len(cart["papeis"]), "companhias": len(holdings), "soma_pesos_pct": _r(soma_pesos, 3),
                     "nota": "O IEE é uma carteira teórica da B3 revista a cada quatro meses: entra e sai papel. Companhias de energia listadas fora do índice (por liquidez ou critério da B3) não estão neste painel."},
        "definicoes": DEFINICOES,
        "companhias": companhias,
        "ressalvas": ressalvas,
        "series": {"evidencias": _url(JSON_EVID)},
        "proveniencia": prov,
        "downloads": [{"rotulo": r, "url": _url(n)} for r, n in (
            ("Companhias, comparação (CSV)", CSV_COMPANHIAS), ("Usinas sob controle (CSV)", CSV_USINAS),
            ("Transmissão sob controle (CSV)", CSV_TRANSMISSAO), ("Acionistas diretos (CSV)", CSV_ACIONISTAS),
            ("Cotações e índices diários (CSV)", CSV_COTACOES), ("Eventos aplicados às séries (CSV)", CSV_EVENTOS),
            ("Fatos relevantes, 24 meses (CSV)", CSV_FATOS), ("Carteira do IEE (CSV)", CSV_CARTEIRA))],
    })
    return g


DEFINICOES = {
    "sob_controle": "Empresa sob controle da companhia listada: a cadeia de controladores únicos declarada à ANEEL (Composição Societária, Polímero) que sobe a partir dela passa pela companhia. Inclui a própria companhia. Controle compartilhado interrompe a cadeia: a SPE em que a companhia divide o controle com outro sócio não entra.",
    "mw_controle": "Potência fiscalizada das usinas em operação no SIGA cujo dono majoritário (mais de 50%, em usina de participações válidas) está sob controle da companhia. Mede comando sobre a usina inteira, não propriedade.",
    "mw_proporcional": "Soma da potência fiscalizada × participação direta de cada empresa sob controle, nas usinas em operação de participações válidas. Exclui participações detidas por coligadas e por SPE de controle compartilhado (não há look-through).",
    "mw_em_implantacao": "Potência outorgada das usinas em construção ou com construção não iniciada no SIGA cujo dono majoritário está sob controle da companhia.",
    "km_circuito": "Quilômetros de circuito em operação das concessionárias de transmissão sob controle (SIGET, pelo CNPJ do contrato); linha de circuito duplo conta duas vezes.",
    "unidades_consumidoras": "Soma das unidades consumidoras das distribuidoras ativas sob controle, no ano de referência da continuidade publicado pelo módulo Qualidade.",
    "margem_ebit": "Resultado antes do resultado financeiro e dos tributos (conta 3.05) ÷ receita (conta 3.01), consolidado, × 100. Nas distribuidoras a receita inclui a receita de construção, que reduz a margem sem mudar o resultado.",
    "divida_bruta_sobre_pl": "Empréstimos, financiamentos e debêntures (2.01.04 + 2.02.01) ÷ patrimônio líquido (2.03), consolidado, no fim do exercício. O patrimônio inclui não controladores.",
    "lucro_sobre_pl": "Lucro atribuído aos sócios da controladora (3.11.01) ÷ patrimônio líquido no fim do exercício (2.03) × 100. Não é o ROE médio que as companhias divulgam.",
    "retorno_preco": "Variação do preço de fechamento do papel ajustada por desdobramentos, grupamentos e bonificações, sem proventos em dinheiro.",
    "retorno_total": "Variação com os proventos em dinheiro (dividendos, juros sobre capital próprio e rendimentos, valores brutos por ação publicados pela B3) reinvestidos no fechamento da data ex, e com os eventos em ações. Não desconta imposto nem custos de negociação.",
    "volume_medio": "Média do volume financeiro diário negociado no papel, lote padrão do mercado à vista, nos pregões dos últimos 3 meses.",
}


def _mudancas_acionarias(ant, atual, limiar_pp=0.5):
    """Entradas, saídas e variações de pelo menos `limiar_pp` pontos percentuais no total de
    ações dos acionistas diretos identificados por CNPJ (ou por nome quando a pessoa jurídica
    não tem CNPJ brasileiro), entre dois Formulários de Referência."""
    def chave(a):
        return a["cnpj"] or ("nome:" + a["nome"].upper())

    def idx(doc):
        return {chave(a): a for a in doc["acionistas"] if a["tipo"] != "coletivo"}
    A, B = idx(ant), idx(atual)
    out = []
    for k in sorted(set(A) | set(B)):
        a, b = A.get(k), B.get(k)
        pa = (a or {}).get("pct_total")
        pb = (b or {}).get("pct_total")
        if a is None:
            if (pb or 0) >= limiar_pp or b.get("controlador"):
                out.append({"acionista": b["nome"], "cnpj": b["cnpj"], "tipo": "entrada", "antes": None, "depois": pb})
        elif b is None:
            if (pa or 0) >= limiar_pp or a.get("controlador"):
                out.append({"acionista": a["nome"], "cnpj": a["cnpj"], "tipo": "saida", "antes": pa, "depois": None})
        elif pa is not None and pb is not None and abs(pb - pa) >= limiar_pp:
            out.append({"acionista": b["nome"], "cnpj": b["cnpj"], "tipo": "variacao", "antes": pa, "depois": pb})
    pfa, pfb = (ant.get("pessoas_fisicas") or {}).get("pct_total"), (atual.get("pessoas_fisicas") or {}).get("pct_total")
    if (pfa or 0) != (pfb or 0) and abs((pfb or 0) - (pfa or 0)) >= limiar_pp:
        out.append({"acionista": "Pessoas físicas", "cnpj": None, "tipo": "variacao", "antes": pfa, "depois": pfb})
    return out


def _financas(serie, comp):
    if not serie:
        return None
    anual = ((serie.get("anual") or {}).get("con")) or {}
    if not anual:
        return None
    anos = sorted({a for pts in anual.values() for a, _ in pts})[-6:]
    tab = []
    for ano in anos:
        lin = {"exercicio": ano}
        for conta in ("receita", "ebit", "lucro_liquido", "lucro_controladores", "divida_bruta", "patrimonio_liquido",
                      "ativo_total", "caixa", "caixa_operacional", "caixa_investimento"):
            lin[conta] = dict(anual.get(conta) or []).get(ano)
        rec, ebit, pl, dv, lc = lin["receita"], lin["ebit"], lin["patrimonio_liquido"], lin["divida_bruta"], lin["lucro_controladores"]
        lin["margem_ebit_pct"] = _r(100.0 * ebit / rec, 2) if rec and ebit is not None and rec > 0 else None
        lin["divida_bruta_sobre_pl"] = _r(dv / pl, 3) if dv is not None and pl and pl > 0 else None
        lin["lucro_sobre_pl_pct"] = _r(100.0 * lc / pl, 2) if lc is not None and pl and pl > 0 else None
        tab.append(lin)
    return {"escopo": "consolidado", "unidade": "R$ milhões nominais", "serie": tab,
            "ultimo_exercicio": anos[-1] if anos else None,
            "alertas": (comp or {}).get("alertas") or [], "valores_reapresentados": (comp or {}).get("valores_reapresentados")}


def _bolsa(papel, classe_iee, cnpj, codigos_cnpj, fech, vol, sup, provs, evb=None):
    """Série do papel, retornos e eventos. Retorna (bloco da gold, linhas do CSV de cotações,
    linhas do CSV de eventos)."""
    serie, emendas, isin = _monta_serie_papel(papel, classe_iee, cnpj, codigos_cnpj, fech, vol)
    if not serie:
        return {"papel": papel, "motivo": "sem pregões do papel na série histórica da B3 lida"}, [], []
    isins = {x[2] for x in serie}
    classe_prov = {"UNT": "UNT"}.get(classe_iee, classe_iee)
    # proventos em dinheiro da classe (UNT para units)
    dinheiro = [(x["data_com"], x["valor"] / (x["cotacao_por"] or 1.0)) for x in provs
                if x["classe"] == classe_prov and x["rotulo"] in b3.ROTULOS_DINHEIRO and x["data_com"] and x["valor"]]
    acoes, extras, notas = [], [], []
    for e in sup.get("eventos_acoes") or []:
        if e["isin"] not in isins or not e["data_com"]:
            continue
        if e["rotulo"] in b3.ROTULOS_ACOES and e["isin_emitido"] in (None, e["isin"]) and e["multiplicador"]:
            acoes.append((e["data_com"], e["multiplicador"]))
        elif e["rotulo"] == "BONIFICACAO" and e["isin_emitido"] and e["isin_emitido"] != e["isin"]:
            extras.append(e)
    datas = [d for d, *_ in serie]
    # bonificação paga em outra classe: valor = quantidade recebida × primeiro fechamento da classe recebida
    estimados = []
    for e in extras:
        ex = b3.proximo_pregao(datas, e["data_com"])
        pts = [pt for k, v in fech.items() if k.endswith(":" + e["isin_emitido"]) for pt in v if ex and pt[0] >= ex]
        pts.sort()
        if ex and pts and e["fator_fonte"]:
            valor = e["fator_fonte"] / 100.0 * pts[0][1]
            dinheiro.append((e["data_com"], valor))
            estimados.append({"data_com": e["data_com"], "valor": valor, "isin_emitido": e["isin_emitido"],
                              "fechamento_usado": pts[0][1], "data_fechamento": pts[0][0], "fator": e["fator_fonte"]})
        else:
            notas.append(f"Bonificação em outra classe com data com {e['data_com']} sem cotação da classe recebida: não incluída.")
    # evento em ações marcado na cotação (EB, EDB, EG) sem fator publicado pela B3 na base usada: a série
    # anterior não é comparável com a posterior; ela recomeça no primeiro pregão com a marca
    marcados = {(c_, i_, d_) for k, pts in (evb or {}).items() for c_, i_ in [k.split(":", 2)[1:]] for d_, _v in pts}
    inicios, ant_m = [], False
    for d, cod, isn, _p, _v in serie:
        m = (cod, isn, d) in marcados
        if m and not ant_m:
            inicios.append(d)
        ant_m = m
    ex_conhecidos = {b3.proximo_pregao(datas, dc) for dc, _m in acoes} | {b3.proximo_pregao(datas, e["data_com"]) for e in extras}
    sem_fator = [d for d in inicios if d not in ex_conhecidos and d > datas[0]]
    truncada_em = None
    if sem_fator:
        truncada_em = sem_fator[-1]
        datas_txt = ", ".join(sem_fator[:-1]) + (" e " if len(sem_fator) > 1 else "") + sem_fator[-1]
        notas.append(f"Em {datas_txt} a cotação traz a marca de ex-bonificação ou ex-grupamento (EB ou EDB), mas a B3 não publica o fator "
                     f"desses eventos na base de eventos usada: a série não é comparável antes e depois deles e começa em {truncada_em}.")
        serie = [x for x in serie if x[0] >= truncada_em]
        datas = [d for d, *_ in serie]
    fech_serie = [(d, p) for d, _c, _i, p, _v in serie]
    s, aplicados = b3.serie_retorno(fech_serie, dinheiro, acoes)
    est_por = {(x["data_com"], round(x["valor"], 6)) for x in estimados}
    ultimo = s[-1][0]
    r12 = b3.retorno_entre(s, b3.menos_um_ano(ultimo))
    r20 = b3.retorno_entre(s, f"{ANO_BASE_COTACOES}-12-31")
    rano = b3.retorno_entre(s, f"{int(ultimo[:4]) - 1}-12-31")
    rini = {"de": s[0][0], "ate": s[-1][0], "preco": s[-1][2] / s[0][2] - 1.0, "total": s[-1][3] / s[0][3] - 1.0} if len(s) > 1 else None
    tres = (date.fromisoformat(ultimo) - timedelta(days=91)).isoformat()
    vols = [v for d, _c, _i, _p, v in serie if d > tres and v is not None]
    # variações diárias ajustadas fora do comum (conferência: evento não ajustado vira salto)
    saltos = []
    for i in range(1, len(s)):
        var = s[i][3] / s[i - 1][3] - 1.0
        if abs(var) >= 0.2:
            saltos.append({"data": s[i][0], "variacao_pct": _r(100 * var, 1)})
    mensal = _mensal(s)
    cot = [[papel, cod, isn, d, p, v, _r(ip, 6), _r(it, 6)] for (d, cod, isn, p, v), (_d, _p, ip, it) in zip(serie, s)]
    evs = []
    for a in aplicados:
        if a["tipo"] == "dinheiro":
            est = (a["data_com"], round(a["valor"], 6)) in est_por
            evs.append([papel, "bonificacao_outra_classe" if est else "dinheiro", "BONIFICACAO" if est else None, a["data_com"],
                        a["data_ex"], _r(a["valor"], 8), None, "ESTIMADO" if est else "OBSERVADO",
                        "quantidade recebida × primeiro fechamento da classe recebida" if est else None])
        else:
            evs.append([papel, "acoes", None, a["data_com"], a["data_ex"], None, _r(a["multiplicador"], 8), "OBSERVADO", None])
    # rótulo dos proventos (dividendo, JCP) no CSV
    rot = collections.defaultdict(list)
    for x in provs:
        if x["classe"] == classe_prov and x["rotulo"] in b3.ROTULOS_DINHEIRO:
            rot[x["data_com"]].append(x["rotulo"])
    for e in evs:
        if e[1] == "dinheiro":
            e[2] = "+".join(sorted(set(rot.get(e[3]) or [])) ) or None
    for e in sup.get("eventos_acoes") or []:
        if e["isin"] in isins and e["rotulo"] == "RESG TOTAL RV" and e["data_com"] and e["data_com"] >= datas[0]:
            notas.append(f"Resgate total de ações de outra classe ({e['isin']}) com data com {e['data_com']}: a B3 não publica o valor na base de proventos usada, e ele não entra no retorno total.")
    for e in sup.get("eventos_acoes") or []:
        if e["rotulo"] == "RESG TOTAL RV" and e["isin"] not in isins and e["data_com"] and e["data_com"] >= datas[0] \
                and any(x["data_com"] == e["data_com"] for x in estimados):
            notas.append(f"Na mesma data com ({e['data_com']}) a B3 registra resgate total de outra classe ({e['isin']}) sem valor na base de proventos usada: se houve pagamento em dinheiro, ele não entra no retorno total.")
    ult_cod = serie[-1][1]
    return ({
        "papel": papel, "isin": isin, "primeiro_pregao": datas[0], "ultimo_pregao": ultimo, "pregoes": len(serie),
        "codigo_ultimo_pregao": ult_cod,
        "fechamento": serie[-1][3],
        "retorno_12m": _ret(r12), "retorno_desde_2020": _ret(r20), "retorno_no_ano": _ret(rano),
        "retorno_desde_inicio": _ret(rini), "serie_reiniciada_em": truncada_em,
        "volume_medio_diario_3m": _r(sum(vols) / len(vols), 0) if vols else None, "pregoes_3m": len(vols),
        "mensal": [[m, _r(p, 2), _r(ip, 5), _r(it, 5)] for m, p, ip, it in mensal],
        "emendas": emendas, "eventos_acoes": [{"data_com": a["data_com"], "data_ex": a["data_ex"], "multiplicador": a["multiplicador"]}
                                               for a in aplicados if a["tipo"] == "acoes"],
        "proventos_12m": _r(sum(a["valor"] for a in aplicados if a["tipo"] == "dinheiro" and a["data_ex"] > b3.menos_um_ano(ultimo)
                               and (a["data_com"], round(a["valor"], 6)) not in est_por), 6),
        "proventos_eventos": sum(1 for a in aplicados if a["tipo"] == "dinheiro"),
        "bonificacoes_outra_classe": [{**x, "valor": _r(x["valor"], 4)} for x in estimados],
        "notas": notas, "saltos": saltos,
    }, cot, evs)


def _ret(r):
    if not r:
        return None
    return {"de": r["de"], "ate": r["ate"], "preco_pct": _r(100 * r["preco"], 2), "total_pct": _r(100 * r["total"], 2)}


def _evidencias(comp, cart, v_iee, v_pol, data_siga, emp, v_cot, ref_pol, soma_lista):
    out = {}
    g = comp["geracao"]
    papel = comp["papel"]
    rec = g.get("reconciliacao_grupo")
    if comp["cnpj"]:
        out["mw_controle"] = evid.construir(
            indicador=f"Potência em operação sob controle: {comp['nome']}",
            valor_exibido=f"{_br(g['mw_controle'], 1)} MW", valor_calculo=g["mw_controle"], unidade="MW (potência fiscalizada)",
            periodo={"inicio": data_siga, "fim": data_siga}, entidade=f"{comp['nome']} (CNPJ {comp['cnpj']}) e empresas sob seu controle",
            universo=f"{g['usinas_controle']} usinas em operação no SIGA cujo dono majoritário está entre as {comp['controle']['empresas_sob_controle']} empresas sob controle",
            fonte={**evid.fonte_de_vintage("ANEEL", "Composição Societária (Polímero)", URL_POLIMERO, v_pol),
                   "arquivos": [evid.arquivo_de_vintage(v_pol)] if v_pol else []},
            consulta=f"Cadeias de controladores únicos do Polímero (trimestre {ref_pol}) que passam pelo CNPJ {comp['cnpj']} × usinas do SIGA publicadas pelo módulo Empresas (empresas_ativos.csv, SIGA de {data_siga})",
            formula="Σ potência fiscalizada das usinas em operação de participações válidas cujo CNPJ com mais de 50% está sob controle da companhia",
            cobertura="Usinas em operação no SIGA com participações publicadas somando 100%; micro e minigeração distribuída fora",
            tratamento_ausencia="Usina sem dono majoritário (nenhum CNPJ acima de 50%) ou de participações inválidas fica fora; controle compartilhado interrompe a cadeia.",
            testes=[evid.teste("Lista de usinas fecha com o total", "aprovado" if abs(soma_lista - (g["mw_controle"] or 0)) <= 0.1 else "reprovado",
                               f"Σ das usinas em operação no CSV de usinas sob controle = {_br(soma_lista, 1)} MW")]
            + ([evid.teste("Mesma potência do grupo no módulo Empresas", "aprovado" if abs(rec["dif_controle"] or 0) <= 0.01 else "ressalva",
                           f"companhia no topo da cadeia: {_br(rec['mw_controle_empresas'], 3)} MW no grupo do módulo Empresas, diferença {_br(rec['dif_controle'], 3)} MW")]
               if rec else []),
            download=[{"rotulo": "Usinas sob controle (CSV)", "url": _url(CSV_USINAS)}], reproducao=REPRODUCAO)
    b = comp["bolsa"]
    if b and b.get("retorno_12m"):
        r = b["retorno_12m"]
        out["retorno_total_12m"] = evid.construir(
            indicador=f"Retorno total em 12 meses: {papel}",
            valor_exibido=f"{_br(r['total_pct'], 1)}%", valor_calculo=r["total_pct"], unidade="% no período",
            periodo={"inicio": r["de"], "fim": r["ate"]}, entidade=f"{papel} ({comp['nome']})",
            universo="Pregões do papel no mercado à vista, lote padrão",
            fonte={**evid.fonte_de_vintage("B3", "Séries históricas de cotações (COTAHIST)", b3.URL_PAGINA_COTAHIST,
                                           (v_cot or {}).get(f"COTAHIST_A{r['ate'][:4]}.ZIP")),
                   "arquivos": [evid.arquivo_de_vintage(v) for k, v in sorted((v_cot or {}).items()) if k[10:14] >= r["de"][:4]]},
            consulta=f"COTAHIST, TPMERC 010, CODBDI 02, código {papel} (e códigos anteriores emendados pelo ISIN e pelo FCA); proventos da B3 (GetListedCashDividends) da classe; eventos em ações (GetListedSupplementCompany)",
            formula="Π (P_t × m_t + D_t) ÷ P_{t−1} − 1 entre o último pregão até a data inicial e o último pregão; m = multiplicador de ações, D = provento bruto por ação com data ex em t",
            cobertura=f"{b['pregoes']} pregões de {b['primeiro_pregao']} a {b['ultimo_pregao']}",
            tratamento_ausencia="Dia sem pregão do papel não entra; provento sem valor publicado não entra (ver notas).",
            testes=[evid.teste("Sem salto diário ajustado acima de 20%", "aprovado" if not b["saltos"] else "ressalva",
                               "nenhum salto" if not b["saltos"] else "; ".join(f"{x['data']}: {x['variacao_pct']}%" for x in b["saltos"]))],
            download=[{"rotulo": "Cotações e índices diários (CSV)", "url": _url(CSV_COTACOES)},
                      {"rotulo": "Eventos aplicados (CSV)", "url": _url(CSV_EVENTOS)}],
            reproducao=REPRODUCAO)
    return out


def _proveniencias(cart, v_iee, v_sups, v_provs, v_cot, v_fca, v_fre, v_ipe, v_pol, emp, data_siga, data_siget,
                   ultimo_pregao, ref_pol, con, fre_datas, desde_ipe, hoje):
    def fonte(orgao, ds, recurso, url, licenca):
        return {"orgao": orgao, "dataset": ds, "recurso": recurso, "url_dataset": url, "url_primaria": url, "licenca": licenca}
    cap_cot = max((v["capturado_em"] for v in (v_cot or {}).values()), default=None)
    dia = {"inicio": cart["data"], "fim": cart["data"]}
    siga = {"inicio": data_siga, "fim": data_siga}
    fre_per = {"inicio": min(fre_datas) if fre_datas else None, "fim": max(fre_datas) if fre_datas else None}
    ipe_per = {"inicio": desde_ipe, "fim": hoje.isoformat()}
    cot_per = {"inicio": f"{ANO_BASE_COTACOES}-01-01", "fim": ultimo_pregao}
    return {
        "carteira": c.proveniencia(
            indicador="Carteira do dia do IEE", natureza="OBSERVADO",
            fonte=fonte("B3", "Índice de Energia Elétrica (IEE)", REC_IEE, b3.URL_PAGINA_IEE, LICENCA_B3),
            unidade="% de participação no índice", frequencia="diária (carteira teórica revista a cada quatro meses)",
            periodo=dia, cobertura=dia, capturado_em=v_iee["capturado_em"], snapshot=c.snapshot_de(con, DS_IEE),
            limitacoes=["A B3 não publica a carteira histórica em arquivo aberto: o histórico de pesos começa na primeira captura deste módulo.",
                        "O IEE reúne companhias de energia elétrica escolhidas por critério de liquidez da B3; listadas fora do índice não aparecem."],
            download=_url(CSV_CARTEIRA)),
        "ativos": c.proveniencia(
            indicador="Ativos sob controle de cada companhia", natureza="CALCULADO",
            fonte=fonte("ANEEL", "SIGA, SIGET e Composição Societária (Polímero)", REC_POLIMERO, URL_POLIMERO, LICENCA_ANEEL),
            unidade="MW (potência fiscalizada), km de circuito, MVA, unidades consumidoras",
            frequencia="diária (SIGA e SIGET), trimestral (Polímero)", periodo=siga, cobertura=siga,
            notas_fonte=f"SIGA de {data_siga}; SIGET de {data_siget}; Polímero, trimestre de referência {ref_pol}.",
            capturado_em=(v_pol or {}).get("capturado_em"), snapshot=c.snapshot_de(con, DS_POLIMERO),
            formula="ativo sob controle = ativo cujo dono (usina: dono majoritário; transmissão e distribuição: a concessionária) está numa cadeia de controladores únicos que passa pela companhia",
            limitacoes=["Controle compartilhado interrompe a cadeia: SPE com dois controladores não entra em nenhuma das companhias.",
                        "Participação minoritária e participação indireta proporcional (look-through) não são calculadas.",
                        "A cadeia é a declarada à ANEEL; empresa que não declara na janela de quatro trimestres interrompe a cadeia.",
                        "Usinas, linhas e distribuidoras são as publicadas pelo módulo Empresas nesta mesma publicação, pelo CNPJ."],
            download=_url(CSV_USINAS)),
        "controle": c.proveniencia(
            indicador="Acionistas diretos declarados no Formulário de Referência", natureza="OBSERVADO",
            fonte=fonte("CVM", "Formulário de Referência, posição acionária", "fre_cia_aberta_posicao_acionaria", URL_FRE_DS, LICENCA_CVM),
            unidade="% das ações ordinárias, preferenciais e do total", frequencia="anual, com reapresentações a cada mudança",
            periodo=fre_per, cobertura=fre_per,
            capturado_em=max((v["capturado_em"] for v in v_fre.values()), default=None), snapshot=c.snapshot_de(con, DS_FRE),
            limitacoes=["O FRE lista acionistas com 5% ou mais de uma classe, controladores e participantes de acordo; os demais estão em 'Outros'.",
                        "Pessoas físicas não têm nome publicado aqui: aparecem somadas.",
                        "A data de cada posição é a declarada pela companhia (última alteração); a versão do formulário pode ser anterior a mudanças recentes."],
            download=_url(CSV_ACIONISTAS)),
        "financas": (emp.get("proveniencia") or {}).get("financas"),
        "bolsa": c.proveniencia(
            indicador="Preço, retorno de preço e retorno total", natureza="CALCULADO",
            fonte=fonte("B3", "Séries históricas de cotações (COTAHIST) e eventos corporativos", "COTAHIST_AAAA.ZIP", b3.URL_PAGINA_COTAHIST, LICENCA_B3),
            unidade="R$ por ação ou unit; % no período", frequencia="diária (pregão)", periodo=cot_per, cobertura=cot_per,
            capturado_em=cap_cot, snapshot=c.snapshot_de(con, DS_COTAHIST),
            formula="retorno total = Π (P_t × m_t + D_t) ÷ P_{t−1} − 1",
            transformacoes=["preço = campo ÷ 100 ÷ fator de cotação", "data ex = primeiro pregão depois da data com",
                            "códigos trocados emendados pelo FCA e pela contiguidade dos pregões"],
            limitacoes=["Proventos brutos, sem imposto de renda sobre juros sobre capital próprio e sem custos de negociação.",
                        "Reinvestimento no fechamento da data ex; não é o retorno de um investidor específico.",
                        "Bonificação paga em outra classe é valorizada pelo primeiro fechamento da classe recebida (natureza ESTIMADO).",
                        "Resgates e reduções de capital que a B3 não publica com valor na base de proventos não entram."],
            download=_url(CSV_COTACOES)),
        "movimentos": c.proveniencia(
            indicador="Fatos relevantes entregues à CVM", natureza="OBSERVADO",
            fonte=fonte("CVM", "Documentos periódicos e eventuais (IPE)", "ipe_cia_aberta_AAAA.zip", URL_IPE_DS, LICENCA_CVM),
            unidade="documentos", frequencia="diária", periodo=ipe_per, cobertura=ipe_per,
            capturado_em=max((v["capturado_em"] for v in v_ipe.values()), default=None), snapshot=c.snapshot_de(con, DS_IPE),
            limitacoes=["O assunto é o texto escrito pela companhia; o observatório não resume nem classifica o conteúdo do documento.",
                        "O documento fica no sistema da CVM: o link pode ficar indisponível quando a CVM está fora do ar."],
            download=_url(CSV_FATOS)),
    }


def _escreve_csvs(cart, v_iee, companhias, linhas_us, linhas_tr, linhas_ac, linhas_cot, linhas_ev, linhas_fa):
    base.escreve_csv(CSV_CARTEIRA, ["data_carteira", "papel", "nome_pregao", "tipo", "peso_pct", "qtd_teorica", "capturado_em"],
                     [[cart["data"], p["papel"], p["nome_pregao"], p["tipo"], p["peso_pct"], p["qtd_teorica"], v_iee["capturado_em"]]
                      for p in cart["papeis"]])
    lin = []
    for x in companhias:
        g, t, d, f, b, a = x["geracao"], x["transmissao"] or {}, x["distribuicao"] or {}, x["financas"] or {}, x["bolsa"] or {}, x["atuacao"]
        ult = (f.get("serie") or [{}])[-1] if f else {}
        lin.append([x["papel"], x["cnpj"], x["codigo_cvm"], x["nome"], x["nome_anterior"], x["controle"]["especie_fca"],
                    x["iee"]["peso_pct"], int(a["geracao"]), int(a["transmissao"]), int(a["distribuicao"]), int(a["comercializacao_declarada"]),
                    x["controle"]["empresas_sob_controle"], g["usinas_controle"], g["mw_controle"], g["mw_proporcional"], g["mw_em_implantacao"],
                    t.get("concessionarias", 0), t.get("km_circuito_operacao", 0), t.get("mva_transformacao_operacao", 0),
                    len(d.get("distribuidoras") or []), d.get("unidades_consumidoras"),
                    ult.get("exercicio"), ult.get("receita"), ult.get("ebit"), ult.get("lucro_liquido"), ult.get("divida_bruta"),
                    ult.get("patrimonio_liquido"), ult.get("margem_ebit_pct"), ult.get("divida_bruta_sobre_pl"),
                    b.get("ultimo_pregao"), b.get("fechamento"),
                    (b.get("retorno_12m") or {}).get("preco_pct"), (b.get("retorno_12m") or {}).get("total_pct"),
                    (b.get("retorno_desde_2020") or {}).get("preco_pct"), (b.get("retorno_desde_2020") or {}).get("total_pct"),
                    _r((b.get("volume_medio_diario_3m") or 0) / 1e6, 2) if b.get("volume_medio_diario_3m") is not None else None,
                    x["movimentos"]["fatos_relevantes_24m"]])
    base.escreve_csv(CSV_COMPANHIAS, ["papel", "cnpj", "codigo_cvm", "nome", "nome_anterior", "especie_controle", "peso_iee_pct",
                                      "atua_geracao", "atua_transmissao", "atua_distribuicao", "comercializacao_declarada",
                                      "empresas_sob_controle", "usinas_controle", "mw_controle", "mw_proporcional", "mw_em_implantacao",
                                      "concessionarias_transmissao", "km_circuito_operacao", "mva_transformacao_operacao",
                                      "distribuidoras", "unidades_consumidoras", "exercicio", "receita_rs_mi", "ebit_rs_mi",
                                      "lucro_liquido_rs_mi", "divida_bruta_rs_mi", "patrimonio_liquido_rs_mi", "margem_ebit_pct",
                                      "divida_bruta_sobre_pl", "ultimo_pregao", "fechamento_rs", "retorno_preco_12m_pct",
                                      "retorno_total_12m_pct", "retorno_preco_desde_2020_pct", "retorno_total_desde_2020_pct",
                                      "volume_medio_diario_3m_rs_mi", "fatos_relevantes_24m"], lin)
    base.escreve_csv(CSV_USINAS, ["papel", "holding_cnpj", "nucleo_ceg", "usina", "tipo", "fonte", "fase", "uf", "mw",
                                  "dono_majoritario_cnpj", "dono_majoritario_nome", "pct_dono_majoritario", "nivel"], linhas_us)
    base.escreve_csv(CSV_TRANSMISSAO, ["papel", "holding_cnpj", "cnpj", "nome", "km_circuito_operacao", "km_circuito_implantacao",
                                       "subestacoes", "mva_transformacao_operacao", "ufs", "nivel"], linhas_tr)
    base.escreve_csv(CSV_ACIONISTAS, ["papel", "holding_cnpj", "fre_data_referencia", "fre_versao", "acionista", "tipo", "acionista_cnpj",
                                      "pct_on", "pct_pn", "pct_total", "controlador", "acordo_acionistas", "nacionalidade", "ultima_alteracao"], linhas_ac)
    base.escreve_csv(CSV_COTACOES, ["papel", "codigo_negociado", "isin", "data", "fechamento_rs", "volume_rs", "indice_preco",
                                    "indice_retorno_total"], linhas_cot)
    base.escreve_csv(CSV_EVENTOS, ["papel", "tipo", "rotulo", "data_com", "data_ex", "valor_rs_por_acao", "multiplicador", "natureza", "nota"], linhas_ev)
    base.escreve_csv(CSV_FATOS, ["papel", "holding_cnpj", "data_entrega", "data_referencia", "assunto", "protocolo", "versao", "link"], linhas_fa)
