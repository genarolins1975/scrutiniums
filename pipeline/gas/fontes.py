"""Catálogo das fontes do Observatório de Gás Natural e coleta para o seed.

Cada fonte declara órgão, conjunto, página de origem, licença, frequência e como o
arquivo entra no seed: inteiro (comprimido) ou recortado. Recorte só existe quando o
original é grande e a gold usa uma parte dele; o manifesto guarda o sha256 e o
tamanho do original baixado, para que qualquer pessoa confira contra a fonte.

    python3 -m pipeline.gas.run --coleta        baixa tudo de novo (rede)
    python3 -m pipeline.gas.run --coleta anp_producao,ibge_ipca
"""
import csv
import io
import json
import os
import re
import tempfile
import time
import urllib.parse
import urllib.request
from collections import defaultdict

from pipeline.gas import base, xlsx

ANP = "https://www.gov.br/anp/pt-br"
ANP_DA = f"{ANP}/centrais-de-conteudo/dados-abertos"
ANP_PPG = f"{ANP}/assuntos/movimentacao-estocagem-e-comercializacao-de-gas-natural/acompanhamento-do-mercado-de-gas-natural/ppg"
ANP_SHLP = f"{ANP}/assuntos/precos-e-defesa-da-concorrencia/precos/precos-revenda-e-de-distribuicao-combustiveis/shlp/mensal"
LICENCA_ANP = "Dados abertos da ANP, uso livre com citação da fonte (Política de Dados Abertos do Poder Executivo federal, Decreto 8.777/2016)"
LICENCA_GOV = "Dados abertos do governo federal, uso livre com citação da fonte (Decreto 8.777/2016)"

FONTES = {
    "anp_producao": {
        "orgao": "ANP", "conjunto": "Produção de gás natural por estado e localização",
        "pagina": f"{ANP_DA}/producao-de-petroleo-e-gas-natural-por-estado-e-localizacao",
        "url": f"{ANP_DA}/arquivos/ppgn-el/producao-gas-natural-1000m3.csv",
        "seed": "anp/producao-gas-natural-1000m3.csv.gz", "unidade": "mil m³ por mês", "frequencia": "mensal",
        "licenca": LICENCA_ANP,
        "nota": "Boletim Mensal de Produção (Decreto 2.705/1998). Atualizado até o último dia do mês seguinte ao de referência.",
    },
    "anp_reinjecao": {
        "orgao": "ANP", "conjunto": "Reinjeção de gás natural por estado e localização",
        "pagina": f"{ANP_DA}/producao-de-petroleo-e-gas-natural-por-estado-e-localizacao",
        "url": f"{ANP_DA}/arquivos/ppgn-el/reinjecao-gn-1000m3",
        "seed": "anp/reinjecao-gn-1000m3.csv.gz", "unidade": "mil m³ por mês", "frequencia": "mensal",
        "licenca": LICENCA_ANP, "nota": "Boletim Mensal de Produção.",
    },
    "anp_queima": {
        "orgao": "ANP", "conjunto": "Queima e perda de gás natural por estado e localização",
        "pagina": f"{ANP_DA}/producao-de-petroleo-e-gas-natural-por-estado-e-localizacao",
        "url": f"{ANP_DA}/arquivos/ppgn-el/queima-e-perda-gn-1000m3.csv",
        "seed": "anp/queima-e-perda-gn-1000m3.csv.gz", "unidade": "mil m³ por mês", "frequencia": "mensal",
        "licenca": LICENCA_ANP, "nota": "Boletim Mensal de Produção.",
    },
    "anp_consumo_proprio": {
        "orgao": "ANP", "conjunto": "Consumo próprio de gás natural na exploração e produção",
        "pagina": f"{ANP_DA}/producao-de-petroleo-e-gas-natural-por-estado-e-localizacao",
        "url": f"{ANP_DA}/arquivos/ppgn-el/consumo-proprio-gn1000m3.csv",
        "seed": "anp/consumo-proprio-gn1000m3.csv.gz", "unidade": "mil m³ por mês", "frequencia": "mensal",
        "licenca": LICENCA_ANP, "nota": "Boletim Mensal de Produção.",
    },
    "anp_disponivel": {
        "orgao": "ANP", "conjunto": "Gás natural disponível por estado e localização",
        "pagina": f"{ANP_DA}/producao-de-petroleo-e-gas-natural-por-estado-e-localizacao",
        "url": f"{ANP_DA}/arquivos/ppgn-el/gn-disponivel-1000m3.csv",
        "seed": "anp/gn-disponivel-1000m3.csv.gz", "unidade": "mil m³ por mês", "frequencia": "mensal",
        "licenca": LICENCA_ANP, "nota": "Boletim Mensal de Produção.",
    },
    "anp_importacao": {
        "orgao": "ANP", "conjunto": "Importações de gás natural",
        "pagina": f"{ANP_DA}/importacoes-e-exportacoes",
        "url": f"{ANP_DA}/arquivos/ie/gn/importacao-gas-natural-2000-2025.csv",
        "seed": "anp/importacao-gas-natural.csv.gz", "unidade": "mil m³ por mês e US$ FOB", "frequencia": "mensal",
        "licenca": LICENCA_ANP, "nota": "O nome do arquivo na ANP termina em 2025, mas o conteúdo segue o ano corrente.",
    },
    "anp_vendas_distribuidoras": {
        "orgao": "ANP", "conjunto": "Vendas de gás natural às distribuidoras ou consumidores livres",
        "pagina": f"{ANP_DA}/comercializacao-de-gas-natural",
        "url": f"{ANP_PPG}/distribuidoras-consumidores-livres.csv",
        "seed": "anp/vendas-distribuidoras-consumidores-livres.csv.gz", "unidade": "R$/MMBtu e mil m³/dia",
        "frequencia": "mensal", "licenca": LICENCA_ANP,
        "nota": "Preço médio de venda com impostos, ponderado pelo volume, agregado por região para preservar sigilo comercial. Dado declaratório das empresas (Resolução ANP 52/2011, art. 12).",
    },
    "anp_vendas_produtores": {
        "orgao": "ANP", "conjunto": "Vendas entre produtores e comercializadores de gás rico",
        "pagina": f"{ANP_DA}/comercializacao-de-gas-natural",
        "url": f"{ANP_PPG}/vendas-entre-produtores.csv",
        "seed": "anp/vendas-entre-produtores.csv.gz", "unidade": "R$/MMBtu e mil m³/dia", "frequencia": "mensal",
        "licenca": LICENCA_ANP, "nota": "Gás não processado; preço com impostos, agregado por bacia sedimentar (Santos, Campos e demais) para preservar sigilo comercial. Dado declaratório.",
    },
    "anp_vendas_comercializadores": {
        "orgao": "ANP", "conjunto": "Vendas entre comercializadores de gás processado",
        "pagina": f"{ANP_DA}/comercializacao-de-gas-natural",
        "url": f"{ANP_PPG}/vendas-aos-comercializadores.csv",
        "seed": "anp/vendas-aos-comercializadores.csv.gz", "unidade": "R$/MMBtu e mil m³/dia", "frequencia": "mensal",
        "licenca": LICENCA_ANP,
        "nota": "Vendas na saída das unidades de processamento, terminais de GNL ou pontos do sistema de transporte, exceto a distribuidoras e consumidores livres. Preço com impostos; dado declaratório.",
    },
    "anp_glp_vasilhame": {
        "orgao": "ANP", "conjunto": "Vendas de GLP por tipo de vasilhame",
        "pagina": f"{ANP_DA}/vendas-de-derivados-de-petroleo-e-biocombustiveis",
        "url": f"{ANP_DA}/arquivos/vdpb/vct/vendas-glp-tipo-vasilhame-m3-2007-2025.csv",
        "seed": "anp/vendas-glp-tipo-vasilhame-m3.csv.gz", "unidade": "m³ por mês", "frequencia": "mensal",
        "licenca": LICENCA_ANP,
        "nota": "Vendas das distribuidoras de GLP por UF e vasilhame (até P13 e outros). Volume em m³ de GLP, como publicado.",
    },
    "anp_precos_estados": {
        "orgao": "ANP", "conjunto": "Levantamento de Preços de Combustíveis: série mensal por estado (recorte GLP P13 e GNV)",
        "pagina": f"{ANP}/assuntos/precos-e-defesa-da-concorrencia/precos/precos-revenda-e-de-distribuicao-combustiveis/serie-historica-do-levantamento-de-precos",
        "url": f"{ANP_SHLP}/mensal-estados-desde-jan2013.xlsx",
        "seed": "anp/precos-mensais-estados-glp-gnv.csv.gz", "unidade": "R$/13 kg (GLP) e R$/m³ (GNV)",
        "frequencia": "mensal", "licenca": LICENCA_ANP, "recorte": "linhas dos produtos GLP e GNV, todas as colunas",
        "nota": "Pesquisa por amostra de revendas. Não houve pesquisa entre 18/8/2020 e 17/10/2020; a abrangência mudou em 2017 e em 2018 (notas da própria planilha).",
    },
    "anp_precos_brasil": {
        "orgao": "ANP", "conjunto": "Levantamento de Preços de Combustíveis: série mensal Brasil (recorte GLP P13 e GNV)",
        "pagina": f"{ANP}/assuntos/precos-e-defesa-da-concorrencia/precos/precos-revenda-e-de-distribuicao-combustiveis/serie-historica-do-levantamento-de-precos",
        "url": f"{ANP_SHLP}/mensal-brasil-desde-jan2013.xlsx",
        "seed": "anp/precos-mensais-brasil-glp-gnv.csv.gz", "unidade": "R$/13 kg (GLP) e R$/m³ (GNV)",
        "frequencia": "mensal", "licenca": LICENCA_ANP, "recorte": "linhas dos produtos GLP e GNV, todas as colunas",
        "nota": "Média nacional calculada pela ANP sobre a amostra pesquisada.",
    },
    "anp_autorizacoes": {
        "orgao": "ANP", "conjunto": "Autorizações para construção e operação de instalações de gás natural",
        "pagina": f"{ANP_DA}/dados-abertos-autorizacoes-gas-natural",
        "url": f"{ANP_DA}/arquivos/autorizacoes-gas-natural/autorizacoes-construcao-operacao-gas-natural.csv",
        "seed": "anp/autorizacoes-gas-natural.csv.gz", "unidade": "atos", "frequencia": "irregular",
        "licenca": LICENCA_ANP,
        "nota": "Registro de atos de autorização (construção, operação, renovação, transferência). Um ativo pode ter vários atos; o conjunto não é inventário de instalações.",
    },
    "anp_movimentacao": {
        "orgao": "ANP", "conjunto": "Movimentação de gás natural em gasodutos de transporte (recorte mensal)",
        "pagina": f"{ANP_DA}/dados-consolidados-movimentacao-de-gas-natural-em-gasodutos-de-transporte",
        "url": None, "seed": "anp/movimentacao-gasodutos-mensal.csv.gz", "unidade": "mil m³ por mês",
        "frequencia": "mensal", "licenca": LICENCA_ANP,
        "recorte": "soma no mês do 'Volume Realizado (mil m³)' por transportadora, tipo de ponto, UF e carregador (código e nome); um arquivo diário por mês na origem",
        "nota": "Volumes informados pelas transportadoras. Nomes de carregadores variam entre arquivos; a contagem usa o código do carregador.",
    },
    "comex_gas": {
        "orgao": "MDIC", "conjunto": "Comex Stat: importações de gás natural por país de origem (NCM 2711.21.00 e 2711.11.00)",
        "pagina": "https://comexstat.mdic.gov.br/", "url": "https://api-comexstat.mdic.gov.br/general",
        "seed": "mdic/comex-gas-natural.json.gz", "unidade": "kg líquido e US$ FOB", "frequencia": "mensal",
        "licenca": LICENCA_GOV,
        "nota": "Registro aduaneiro: massa e valor declarados na importação. 2711.21.00 é gás natural no estado gasoso; 2711.11.00, gás natural liquefeito.",
    },
    "ibge_ipca": {
        "orgao": "IBGE", "conjunto": "IPCA: gás de botijão, gás encanado, gás veicular e índice geral (tabelas 1419 e 7060 do SIDRA)",
        "pagina": "https://sidra.ibge.gov.br/tabela/7060", "url": "https://servicodados.ibge.gov.br/api/v3/agregados",
        "seed": "ibge/ipca-gas.json.gz", "unidade": "% ao mês e % em 12 meses", "frequencia": "mensal",
        "licenca": LICENCA_GOV, "nota": "Tabela 1419 cobre jan/2012 a dez/2019; tabela 7060, de jan/2020 em diante. Mesmos subitens nas duas.",
    },
    "bcb_ptax": {
        "orgao": "BCB", "conjunto": "Taxa de câmbio livre, dólar americano (venda), média mensal (SGS 3698)",
        "pagina": "https://www3.bcb.gov.br/sgspub/", "url": "https://api.bcb.gov.br/dados/serie/bcdata.sgs.3698/dados?formato=json",
        "seed": "bcb/sgs-3698.json.gz", "unidade": "R$/US$", "frequencia": "mensal", "licenca": LICENCA_GOV,
        "nota": "Usada só para expressar em dólar o preço da ANP em reais, com a média do mesmo mês.",
    },
    "wb_pinksheet": {
        "orgao": "Banco Mundial", "conjunto": "Commodity Price Data (Pink Sheet), preços mensais de gás natural (recorte)",
        "pagina": "https://www.worldbank.org/en/research/commodity-markets", "url": None,
        "seed": "bancomundial/pinksheet-gas.csv.gz", "unidade": "US$/MMBtu", "frequencia": "mensal",
        "licenca": "Creative Commons Attribution 4.0 (CC BY 4.0), Banco Mundial",
        "recorte": "colunas Natural gas, US; Natural gas, Europe; Liquefied natural gas, Japan e Crude oil, Brent da aba Monthly Prices",
        "nota": "Natural gas, US é o Henry Hub; Europe é o TTF dos Países Baixos; Japan é o GNL importado pelo Japão. Preços nominais.",
    },
}


def _baixar(url, dados=None, cabecalhos=None, tentativas=4):
    ultimo = None
    for i in range(tentativas):
        try:
            req = urllib.request.Request(url, data=dados, headers={"User-Agent": "Scrutiniums/observatorio-gas", **(cabecalhos or {})})
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read()
        except Exception as e:  # rede instável da origem: nova tentativa com espera crescente
            ultimo = e
            time.sleep(2 ** (i + 1))
    raise RuntimeError(f"falha ao baixar {url}: {ultimo}")


def _registrar(manifesto, fid, url, original, recorte=None, extra=None):
    sha = base.sha256_bytes(original) if isinstance(original, bytes) else original
    anterior = manifesto.get(fid)
    if anterior and anterior.get("sha256_original") == sha and anterior.get("url") == url:
        # arquivo idêntico ao já integrado: o manifesto e a gold não mudam, e o pipeline automático não gera commit vazio
        return
    manifesto[fid] = {
        "url": url,
        "sha256_original": sha,
        "bytes_original": len(original) if isinstance(original, bytes) else None,
        "capturado_em": base.agora_utc(),
        "seed": FONTES[fid]["seed"],
        "recorte": recorte,
        **(extra or {}),
    }


def _coleta_inteiro(fid, manifesto):
    f = FONTES[fid]
    b = _baixar(f["url"])
    base.gravar_seed(f["seed"], b)
    _registrar(manifesto, fid, f["url"], b)


def _recorte_precos(fid, manifesto):
    f = FONTES[fid]
    b = _baixar(f["url"])
    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as t:
        t.write(b)
        tmp = t.name
    try:
        saida = io.StringIO()
        w = csv.writer(saida, delimiter=";", lineterminator="\n")
        cabecalho = None
        for linha in xlsx.linhas(tmp):
            if cabecalho is None:
                if linha and linha[0].strip().upper() == "MÊS":
                    cabecalho = [c.strip() for c in linha]
                    w.writerow(cabecalho)
                continue
            if len(linha) > 1 and linha[1].strip().upper() in ("GLP", "GNV"):
                linha = list(linha)
                linha[0] = xlsx.data_serial(linha[0]).isoformat()[:7]
                w.writerow(linha[: len(cabecalho)])
        if cabecalho is None:
            raise RuntimeError("cabeçalho MÊS/PRODUTO não encontrado na planilha de preços")
    finally:
        os.unlink(tmp)
    base.gravar_seed(f["seed"], saida.getvalue().encode("utf-8"))
    _registrar(manifesto, fid, f["url"], b, recorte=f["recorte"])


def _coleta_wb(manifesto):
    f = FONTES["wb_pinksheet"]
    pagina = _baixar(f["pagina"]).decode("utf-8", "ignore")
    links = re.findall(r'https://thedocs\.worldbank\.org[^"]*CMO-Historical-Data-Monthly\.xlsx', pagina)
    if not links:
        raise RuntimeError("link da Pink Sheet mensal não encontrado na página do Banco Mundial")
    url = links[0]
    b = _baixar(url)
    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as t:
        t.write(b)
        tmp = t.name
    try:
        linhas = list(xlsx.linhas(tmp, "Monthly Prices"))
    finally:
        os.unlink(tmp)
    atualizado = next((l[0] for l in linhas[:6] if l and l[0].startswith("Updated")), None)
    i_cab = next(i for i, l in enumerate(linhas) if "Natural gas, US" in l)
    cab = linhas[i_cab]
    alvo = {"Natural gas, US": "henry_hub", "Natural gas, Europe": "ttf", "Liquefied natural gas, Japan": "gnl_japao", "Crude oil, Brent": "brent"}
    col = {alvo[n]: cab.index(n) for n in alvo}
    saida = io.StringIO()
    w = csv.writer(saida, delimiter=";", lineterminator="\n")
    w.writerow(["mes", "henry_hub", "ttf", "gnl_japao", "brent"])
    for l in linhas[i_cab + 2:]:
        if not l or not re.match(r"^\d{4}M\d{2}$", l[0]):
            continue
        mes = f"{l[0][:4]}-{l[0][5:]}"
        if mes < "2010-01":
            continue
        w.writerow([mes] + [l[col[k]] if col[k] < len(l) else "" for k in ("henry_hub", "ttf", "gnl_japao", "brent")])
    base.gravar_seed(f["seed"], saida.getvalue().encode("utf-8"))
    _registrar(manifesto, "wb_pinksheet", url, b, recorte=f["recorte"], extra={"atualizado_na_fonte": atualizado})


def _coleta_ipca(manifesto):
    f = FONTES["ibge_ipca"]
    respostas = {}
    for tabela, periodos in (("1419", "201201-201912"), ("7060", "202001-209912")):
        url = (f"{f['url']}/{tabela}/periodos/{periodos}/variaveis/63|2265"
               f"?localidades=N1[all]&classificacao=315[7169,7482,7483,107657]")
        respostas[tabela] = json.loads(_baixar(url).decode("utf-8"))
    b = json.dumps(respostas, ensure_ascii=False, sort_keys=True).encode("utf-8")
    base.gravar_seed(f["seed"], b)
    _registrar(manifesto, "ibge_ipca", f["url"] + "/{1419,7060}", b)


def _coleta_comex(manifesto):
    f = FONTES["comex_gas"]
    import datetime
    ano_atual = datetime.date.today().year
    lista = []
    for ano in range(2019, ano_atual + 1):
        corpo = {
            "flow": "import", "monthDetail": True, "period": {"from": f"{ano}-01", "to": f"{ano}-12"},
            "filters": [{"filter": "ncm", "values": ["27112100", "27111100"]}],
            "details": ["country", "ncm"], "metrics": ["metricFOB", "metricKG"],
        }
        r = json.loads(_baixar(f["url"], json.dumps(corpo).encode("utf-8"), {"Content-Type": "application/json"}).decode("utf-8"))
        lista.extend(r["data"]["list"])
        time.sleep(1)
    b = json.dumps({"list": lista}, ensure_ascii=False, sort_keys=True).encode("utf-8")
    base.gravar_seed(f["seed"], b)
    _registrar(manifesto, "comex_gas", f["url"], b)


def _coleta_movimentacao(manifesto, pasta_local=None):
    """Baixa cada arquivo mensal (um por mês desde jan/2021) e soma o volume realizado do mês por ponto e carregador."""
    f = FONTES["anp_movimentacao"]
    pagina = _baixar(f["pagina"]).decode("utf-8", "ignore")
    urls = [u for u in re.findall(r'href="([^"]+\.csv)"', pagina) if "movimentacao-de-gas-natural" in u]
    soma = defaultdict(float)
    arquivos = []
    for url in urls:
        # basenames se repetem entre anos (gn-fevereiro.csv em 2024 e 2025): a cópia local leva o ano da pasta
        ano_pasta = (re.search(r"/(20\d\d)/", url) or [None, "sem-ano"])[1]
        nome_local = os.path.join(pasta_local, f"{ano_pasta}_{os.path.basename(url)}") if pasta_local else None
        if nome_local and os.path.exists(nome_local):
            with open(nome_local, "rb") as fh:
                b = fh.read()
        else:
            b = _baixar(url)
        texto = b.decode("utf-8-sig") if b.startswith(b"\xef\xbb\xbf") else b.decode("latin-1")
        leitor = csv.reader(io.StringIO(texto), delimiter=";")
        cab = next(leitor)
        # os rótulos das 13 colunas de identificação mudam de grafia entre anos (2021 usa "Tipo da Instalação do
        # Gasoduto" e "Nome da variável"); a ordem é a mesma em todos os arquivos, e é ela que se usa
        if not cab[12].strip().lower().startswith("nome da vari"):
            raise RuntimeError(f"layout inesperado (coluna 13 = {cab[12]!r}): {url}")
        datas = [c for c in cab[13:] if re.match(r"\d{2}/\d{2}/\d{4}", c.strip())]
        if not datas:
            raise RuntimeError(f"arquivo sem colunas diárias: {url}")
        d, m, a = datas[0].strip().split("/")
        mes = f"{a}-{m}"
        for linha in leitor:
            if len(linha) < 14 or linha[12].strip().lower().replace("volume ", "", 1)[:9] != "realizado":
                continue
            tipo = linha[4].strip()
            if tipo not in ("Ponto de Entrega", "Ponto de Recebimento"):
                continue
            total = 0.0
            for v in linha[13:13 + len(datas)]:
                n = base.numero_br(v)
                if n is not None:
                    total += n
            chave = (mes, linha[7].strip(), tipo, linha[6].strip(), linha[10].strip(), linha[9].strip())
            soma[chave] += total
        arquivos.append({"mes": mes, "url": url, "sha256": base.sha256_bytes(b), "bytes": len(b)})
    saida = io.StringIO()
    w = csv.writer(saida, delimiter=";", lineterminator="\n")
    w.writerow(["mes", "transportadora", "tipo_ponto", "uf", "carregador_codigo", "carregador_nome", "volume_realizado_mil_m3"])
    for chave in sorted(soma):
        w.writerow(list(chave) + [f"{soma[chave]:.3f}"])
    b = saida.getvalue().encode("utf-8")
    base.gravar_seed(f["seed"], b)
    _registrar(manifesto, "anp_movimentacao", f["pagina"], base.sha256_bytes(b), recorte=f["recorte"],
               extra={"arquivos_origem": sorted(arquivos, key=lambda x: x["mes"])})


def coletar(ids=None, pasta_movimentacao=None):
    manifesto = base.ler_manifesto()
    ids = ids or list(FONTES)
    falhas = {}
    for fid in ids:
        try:
            if fid in ("anp_precos_estados", "anp_precos_brasil"):
                _recorte_precos(fid, manifesto)
            elif fid == "wb_pinksheet":
                _coleta_wb(manifesto)
            elif fid == "ibge_ipca":
                _coleta_ipca(manifesto)
            elif fid == "comex_gas":
                _coleta_comex(manifesto)
            elif fid == "anp_movimentacao":
                _coleta_movimentacao(manifesto, pasta_movimentacao)
            else:
                _coleta_inteiro(fid, manifesto)
            print(f"coletado: {fid}", flush=True)
        except Exception as e:
            falhas[fid] = str(e)
            print(f"FALHA {fid}: {e}", flush=True)
        base.gravar_manifesto(manifesto)
    return falhas
