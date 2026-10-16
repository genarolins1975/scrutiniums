"""Leitura dos dados públicos da B3 usados pelo módulo Listadas.

Três fontes, todas publicadas pela B3 sem autenticação:

* Carteira do dia do Índice de Energia Elétrica (IEE, código IEEX), pela API do portal de
  índices (sistemaswebb3-listados.b3.com.br/indexProxy/indexCall/GetPortfolioDay/<base64>):
  papel, nome de pregão, tipo e segmento de listagem, participação (%) e quantidade teórica.
  É o universo do painel: as companhias de energia elétrica que a própria B3 reúne no índice
  setorial, na data da carteira.
* Eventos corporativos por emissor, pelo portal de empresas listadas
  (listedCompaniesProxy/CompanyCall/GetListedSupplementCompany: quantidade de ações por classe,
  desdobramentos, grupamentos e bonificações com o fator e a data com; e
  GetListedCashDividends: dividendos, juros sobre capital próprio e rendimentos por classe, com
  o valor por ação, a data com e o fechamento anterior à data ex).
* Série histórica de cotações (COTAHIST_AAAA.ZIP em bvmf.bmfbovespa.com.br/InstDados/SerHist/):
  arquivo de largura fixa, um pregão por linha e papel, layout publicado pela B3
  ("SeriesHistoricas_Layout.pdf"). Só o mercado à vista (TPMERC 010) entra.

Regras de leitura:
* preço = valor do campo ÷ 100 (duas casas implícitas) ÷ fator de cotação (FATCOT, 1 ou 1.000);
* a continuidade de um papel é o ISIN; uma troca de código com ISIN novo (ELET3 para AXIA3,
  TRPL4 para ISAE4) só é emendada quando a mesma companhia (CNPJ na CVM) publica os dois códigos
  na mesma classe e o último pregão do antigo é o pregão anterior ao primeiro do novo;
* fatores de eventos em ações: DESDOBRAMENTO e BONIFICACAO vêm em percentual de ações novas por
  ação existente (30 = mais 30%), GRUPAMENTO vem como multiplicador (0,002 = 500 para 1). A
  bonificação paga em outra classe (ISIN emitido diferente do ISIN da classe) não multiplica as
  ações da classe e é registrada como evento sem ajuste.
"""
import base64
import collections
import io
import json
import os
import re
import time
import urllib.request
import zipfile
from datetime import date, datetime, timedelta

URL_INDICE = "https://sistemaswebb3-listados.b3.com.br/indexProxy/indexCall/GetPortfolioDay/"
URL_EMPRESA = "https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall/"
URL_COTAHIST = "https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_A{ano}.ZIP"
URL_PAGINA_IEE = "https://www.b3.com.br/pt_br/market-data-e-indices/indices/indices-de-segmentos-e-setoriais/indice-de-energia-eletrica-iee.htm"
URL_PAGINA_COTAHIST = "https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/historico/mercado-a-vista/series-historicas/"
URL_PAGINA_EVENTOS = "https://www.b3.com.br/pt_br/produtos-e-servicos/negociacao/renda-variavel/empresas-listadas.htm"

ROTULOS_DINHEIRO = {"DIVIDENDO", "JRS CAP PROPRIO", "RENDIMENTO"}
# rótulos de eventos em ações que mudam a quantidade de ações da própria classe
ROTULOS_ACOES = {"DESDOBRAMENTO", "BONIFICACAO", "GRUPAMENTO"}

SEGMENTOS = {
    "NM": "Novo Mercado",
    "N1": "Nível 1",
    "N2": "Nível 2",
    "MA": "Bovespa Mais",
    "M2": "Bovespa Mais Nível 2",
}


def carrega_json(corpo):
    """A API da B3 devolve o JSON serializado duas vezes (uma string JSON que contém o JSON)
    quando o pedido traz Accept: application/json; sem o cabeçalho, devolve o JSON direto. As
    duas formas são aceitas."""
    d = json.loads(corpo)
    if isinstance(d, str):
        d = json.loads(d)
    return d


def b64(obj):
    return base64.b64encode(json.dumps(obj, separators=(",", ":")).encode()).decode()


def url_carteira(indice="IEEX"):
    return URL_INDICE + b64({"language": "pt-br", "pageNumber": 1, "pageSize": 120, "index": indice, "segment": "1"})


def url_suplemento(emissor):
    return URL_EMPRESA + "GetListedSupplementCompany/" + b64({"issuingCompany": emissor, "language": "pt-br"})


def url_proventos(nome_pregao, pagina):
    return URL_EMPRESA + "GetListedCashDividends/" + b64(
        {"language": "pt-br", "pageNumber": pagina, "pageSize": 120, "tradingName": nome_pregao})


def numero_br(s):
    """'1.234,56' → 1234.56; vazio ou traço → None."""
    if s is None:
        return None
    t = str(s).strip()
    if not t or t in ("-", "—"):
        return None
    return float(t.replace(".", "").replace(",", "."))


def data_br(s):
    """'29/04/2024' → '2024-04-29'; vazio → None."""
    t = (s or "").strip()
    if not t:
        return None
    return datetime.strptime(t, "%d/%m/%Y").date().isoformat()


# ------------------------------------------------------------------------ carteira do IEE
def le_carteira(corpo):
    """JSON da GetPortfolioDay → {"data": AAAA-MM-DD, "papeis": [...], "total_registros": n}.
    A data da carteira vem no cabeçalho (dd/mm/aa)."""
    d = carrega_json(corpo)
    cab = d.get("header") or {}
    dia = None
    if cab.get("date"):
        dia = datetime.strptime(cab["date"].strip(), "%d/%m/%y").date().isoformat()
    papeis = []
    for r in d.get("results") or []:
        tipo = re.sub(r"\s+", " ", (r.get("type") or "").strip())
        partes = tipo.split(" ")
        papeis.append({
            "papel": (r.get("cod") or "").strip(),
            "nome_pregao": (r.get("asset") or "").strip(),
            "tipo": tipo,
            "classe": partes[0] if partes else None,
            "segmento": partes[-1] if len(partes) > 1 and partes[-1] in SEGMENTOS else None,
            "peso_pct": numero_br(r.get("part")),
            "qtd_teorica": numero_br(r.get("theoricalQty")),
        })
    total = (d.get("page") or {}).get("totalRecords")
    return {"data": dia, "papeis": papeis, "total_registros": total,
            "redutor": numero_br(cab.get("reductor")), "qtd_teorica_total": numero_br(cab.get("theoricalQty"))}


# ------------------------------------------------------------------------ eventos corporativos
def fator_acoes(rotulo, fator):
    """Multiplicador da quantidade de ações de um evento em ações (desdobramento, bonificação ou
    grupamento) ou None para rótulos que não mudam a quantidade da classe."""
    if fator is None:
        return None
    if rotulo in ("DESDOBRAMENTO", "BONIFICACAO"):
        return 1.0 + fator / 100.0
    if rotulo == "GRUPAMENTO":
        return fator
    return None


def le_suplemento(corpo):
    """JSON da GetListedSupplementCompany → dict com quantidades de ações e eventos em ações."""
    lst = carrega_json(corpo)
    if not lst:
        return None
    d = lst[0]
    eventos = []
    for s in d.get("stockDividends") or []:
        rot = (s.get("label") or "").strip()
        f = numero_br(s.get("factor"))
        eventos.append({
            "isin": (s.get("isinCode") or "").strip(),
            "isin_emitido": (s.get("assetIssued") or "").strip() or None,
            "rotulo": rot,
            "fator_fonte": f,
            "multiplicador": fator_acoes(rot, f),
            "data_com": data_br(s.get("lastDatePrior")),
            "aprovado_em": data_br(s.get("approvedOn")),
        })
    return {
        "codigo": (d.get("code") or "").strip(),
        "codigo_cvm": (d.get("codeCVM") or "").strip(),
        "nome_pregao": (d.get("tradingName") or "").strip(),
        "segmento": (d.get("segment") or "").strip(),
        "acoes_on": numero_br(d.get("numberCommonShares")),
        "acoes_pn": numero_br(d.get("numberPreferredShares")),
        "acoes_total": numero_br(d.get("totalNumberShares")),
        "eventos_acoes": eventos,
    }


def le_proventos(resultados):
    """Lista de 'results' da GetListedCashDividends (todas as páginas) → eventos em dinheiro.
    Linhas iguais são mantidas: a B3 lista cada parcela aprovada (ex.: juros sobre capital
    próprio pagos em duas datas com o mesmo valor por ação)."""
    out = []
    for r in resultados:
        out.append({
            "classe": (r.get("typeStock") or "").strip(),
            "rotulo": (r.get("corporateAction") or "").strip(),
            "valor": numero_br(r.get("valueCash")),
            "data_com": data_br(r.get("lastDatePriorEx")),
            "aprovado_em": data_br(r.get("dateApproval")),
            "fechamento_anterior": numero_br(r.get("closingPricePriorExDate")),
            "data_fechamento_anterior": data_br(r.get("dateClosingPricePriorExDate")),
            "cotacao_por": numero_br(r.get("quotedPerShares")) or 1.0,
        })
    return out


# ------------------------------------------------------------------------ COTAHIST
def _int(s):
    s = s.strip()
    return int(s) if s else 0


def le_cotahist(linhas, prefixos=None, mercados=("010",)):
    """Itera os registros de cotação (TIPREG 01) do mercado à vista. `prefixos`: conjunto das
    quatro primeiras letras dos códigos de interesse (None = todos). Posições do layout da B3
    (1-based): DATA 3-10, CODBDI 11-12, CODNEG 13-24, TPMERC 25-27, NOMRES 28-39, ESPECI 40-49,
    PREABE 57-69, PREMAX 70-82, PREMIN 83-95, PREMED 96-108, PREULT 109-121, TOTNEG 148-152,
    QUATOT 153-170, VOLTOT 171-188, FATCOT 211-217, CODISI 231-242."""
    for raw in linhas:
        if raw[:2] != "01":
            continue
        cod = raw[12:24].strip()
        if prefixos is not None and cod[:4] not in prefixos:
            continue
        mercado = raw[24:27]
        if mercado not in mercados:
            continue
        fat = _int(raw[210:217]) or 1
        d = raw[2:10]
        yield {
            "data": f"{d[:4]}-{d[4:6]}-{d[6:8]}",
            "codigo": cod,
            "bdi": raw[10:12],
            "mercado": mercado,
            "nome": raw[27:39].strip(),
            "especificacao": re.sub(r"\s+", " ", raw[39:49].strip()),
            "abertura": _int(raw[56:69]) / 100.0 / fat,
            "maxima": _int(raw[69:82]) / 100.0 / fat,
            "minima": _int(raw[82:95]) / 100.0 / fat,
            "fechamento": _int(raw[108:121]) / 100.0 / fat,
            "negocios": _int(raw[147:152]),
            "quantidade": _int(raw[152:170]),
            "volume": _int(raw[170:188]) / 100.0,
            "fator_cotacao": fat,
            "isin": raw[230:242].strip(),
        }


def linhas_do_zip(caminho_ou_fluxo):
    """Linhas de texto (Latin-1) do único membro do zip COTAHIST."""
    z = zipfile.ZipFile(caminho_ou_fluxo)
    nome = z.namelist()[0]
    with z.open(nome) as f:
        for raw in io.TextIOWrapper(f, encoding="latin-1"):
            yield raw


def baixa_retomando(url, destino, user_agent, tentativas=30, timeout=120, bloco=1 << 20, pausa=3.0):
    """Download com retomada por Range (o servidor da B3 aceita): conexões longas são cortadas no
    caminho e o arquivo anual tem de 60 a 90 MB. Só renomeia o arquivo quando o tamanho confere
    com o total informado. Retorna (destino, bytes)."""
    parte = destino + ".part"
    total = None
    ultimo_erro = None
    for _ in range(tentativas):
        ja = os.path.getsize(parte) if os.path.exists(parte) else 0
        cab = {"User-Agent": user_agent, "Accept": "*/*"}
        if ja:
            cab["Range"] = f"bytes={ja}-"
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=cab), timeout=timeout) as r:
                if r.status == 206:
                    total = int(r.headers["Content-Range"].split("/")[-1])
                    modo = "ab"
                else:
                    total = int(r.headers.get("Content-Length") or 0) or None
                    modo = "wb"
                with open(parte, modo) as f:
                    while True:
                        ch = r.read(bloco)
                        if not ch:
                            break
                        f.write(ch)
        except Exception as e:  # corte no meio: retoma do ponto em que parou
            ultimo_erro = e
            time.sleep(pausa)
            continue
        n = os.path.getsize(parte)
        if total is None or n >= total:
            os.replace(parte, destino)
            return destino, n
    raise RuntimeError(f"download incompleto de {url}: {ultimo_erro}")


# ------------------------------------------------------------------------ retorno
def proximo_pregao(datas_ordenadas, dia):
    """Primeiro pregão estritamente depois de `dia` (data ex de um evento com data com `dia`)."""
    import bisect
    i = bisect.bisect_right(datas_ordenadas, dia)
    return datas_ordenadas[i] if i < len(datas_ordenadas) else None


def serie_retorno(fechamentos, dinheiro, acoes):
    """Índices diários de preço ajustado e de retorno total de um papel.

    fechamentos: [(data ISO, preço de fechamento)] em ordem, pregões do papel;
    dinheiro: [(data com, valor por ação)] proventos em dinheiro da classe;
    acoes: [(data com, multiplicador)] eventos que mudam a quantidade de ações da classe.

    Em cada pregão t, com o pregão anterior t−1 (data ex = primeiro pregão depois da data com):
        retorno de preço  = P_t × m_t ÷ P_{t−1} − 1
        retorno total     = (P_t × m_t + D_t) ÷ P_{t−1} − 1
    m_t = produto dos multiplicadores com data ex em t (1 sem evento); D_t = soma dos proventos
    por ação antiga com data ex em t (valor bruto, antes de imposto). É o reinvestimento do
    provento no fechamento do dia ex. Retorna [(data, preço, índice de preço, índice total)],
    com índices em base 1 no primeiro pregão, e a lista de eventos aplicados."""
    datas = [d for d, _ in fechamentos]
    if not datas:
        return [], []
    m_por = collections.defaultdict(lambda: 1.0)
    d_por = collections.defaultdict(float)
    aplicados = []
    for dc, mult in acoes:
        ex = proximo_pregao(datas, dc)
        if ex is None or ex <= datas[0]:
            continue
        m_por[ex] *= mult
        aplicados.append({"tipo": "acoes", "data_com": dc, "data_ex": ex, "multiplicador": mult})
    for dc, v in dinheiro:
        ex = proximo_pregao(datas, dc)
        if ex is None or ex <= datas[0]:
            continue
        d_por[ex] += v
        aplicados.append({"tipo": "dinheiro", "data_com": dc, "data_ex": ex, "valor": v})
    out = []
    ip = it = 1.0
    ant = None
    for d, p in fechamentos:
        if ant is not None:
            m = m_por.get(d, 1.0)
            ip *= p * m / ant
            it *= (p * m + d_por.get(d, 0.0)) / ant
        out.append((d, p, ip, it))
        ant = p
    return out, sorted(aplicados, key=lambda x: (x["data_ex"], x["tipo"]))


def retorno_entre(serie, inicio_exclusivo, fim=None):
    """Retorno (preço, total) entre o último pregão até `inicio_exclusivo` (inclusive) e o último
    pregão até `fim`. None quando o papel não tem pregão até o início."""
    base_ = None
    final = None
    for d, _p, ip, it in serie:
        if d <= inicio_exclusivo:
            base_ = (d, ip, it)
        if fim is None or d <= fim:
            final = (d, ip, it)
    if base_ is None or final is None or final[0] <= base_[0]:
        return None
    return {"de": base_[0], "ate": final[0], "preco": final[1] / base_[1] - 1.0, "total": final[2] / base_[2] - 1.0}


def menos_um_ano(iso):
    d = date.fromisoformat(iso)
    try:
        return d.replace(year=d.year - 1).isoformat()
    except ValueError:  # 29 de fevereiro
        return (d - timedelta(days=1)).replace(year=d.year - 1).isoformat()
