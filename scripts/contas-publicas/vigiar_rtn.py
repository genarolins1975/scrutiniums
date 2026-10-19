"""Vigia de edição nova do Resultado do Tesouro Nacional (RTN), sem rede no build.

    python3 scripts/contas-publicas/vigiar_rtn.py

O painel federal integra o RTN por edição (src/lib/contas-publicas/snapshots/dados.json,
referenciaRTN). Edição nova muda a base de preços do IPCA (data/contas-publicas/ipca-*), o aviso
editorial de atualidade e os testes que fixam a edição; por isso a integração é manual. O que se
automatiza é a detecção, em dois sinais públicos e sem credenciais:

1. a página do boletim do mês seguinte ao integrado no Tesouro Transparente
   (publicacoes/boletim-resultado-do-tesouro-nacional-rtn/<ano>/<mês>) responde 200;
2. o recurso da série histórica no CKAN do Tesouro Transparente passou a apontar para outro arquivo.

Contrato: saída 0 = nada novo; 3 = o stdout é o corpo da issue (com uma linha "Assinatura:" para
não repetir comentário igual); outra saída = o vigia quebrou. Fonte que não responde vira linha
"não verificado".
"""
import datetime as dt
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
DADOS = RAIZ / "src/lib/contas-publicas/snapshots/dados.json"
BOLETIM = "https://www.tesourotransparente.gov.br/publicacoes/boletim-resultado-do-tesouro-nacional-rtn/{ano}/{mes}"
CKAN = "https://www.tesourotransparente.gov.br/ckan/api/3/action/package_show?id={pacote}"
UA = "Scrutiniums/1.0 (contas publicas; vigia de edicao do RTN)"
MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro",
         "novembro", "dezembro"]


def http(url, timeout=45):
    """Devolve (código, corpo). 404 é resposta, não falha."""
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, b""


def meses_seguintes(referencia, hoje):
    """Meses depois da referência integrada, até o mês anterior ao corrente (o RTN sai no mês seguinte)."""
    ano, mes = map(int, referencia.split("-"))
    saida = []
    while True:
        mes += 1
        if mes == 13:
            ano, mes = ano + 1, 1
        if (ano, mes) >= (hoje.year, hoje.month):
            return saida
        saida.append((ano, mes))


def verificar(dados, buscar=http, hoje=None):
    hoje = hoje or dt.date.today()
    publicados, nao_verificado = [], []
    for ano, mes in meses_seguintes(dados["referenciaRTN"], hoje):
        url = BOLETIM.format(ano=ano, mes=mes)
        try:
            codigo, _ = buscar(url)
        except Exception as e:  # noqa: BLE001
            nao_verificado.append(f"boletim de {MESES[mes - 1]} de {ano}: {str(e)[:120]}")
            continue
        if codigo == 200:
            publicados.append((ano, mes, url))
        elif codigo != 404:
            nao_verificado.append(f"boletim de {MESES[mes - 1]} de {ano}: HTTP {codigo}")
    planilha = None
    m = re.search(r"/dataset/([0-9a-f-]+)/resource/([0-9a-f-]+)/", dados["fonteRTN"])
    if m:
        try:
            codigo, corpo = buscar(CKAN.format(pacote=m.group(1)))
            if codigo != 200:
                raise ValueError(f"HTTP {codigo}")
            recursos = json.loads(corpo)["result"]["resources"]
            atual = next((r["url"] for r in recursos if r["id"] == m.group(2)), None)
            if atual is None:
                nao_verificado.append("CKAN: o recurso da série histórica sumiu do pacote")
            elif atual != dados["fonteRTN"]:
                planilha = atual
        except Exception as e:  # noqa: BLE001
            nao_verificado.append(f"CKAN do Tesouro Transparente: {str(e)[:120]}")
    return publicados, planilha, nao_verificado


def corpo(dados, publicados, planilha, nao_verificado):
    if not (publicados or planilha or nao_verificado):
        return None
    ano, mes = map(int, dados["referenciaRTN"].split("-"))
    linhas = ["## Contas Públicas Federais: edição nova do RTN", "",
              f"O painel integra o RTN até {MESES[mes - 1]} de {ano} (`referenciaRTN` {dados['referenciaRTN']}).", ""]
    if publicados:
        linhas.append("Boletins publicados depois da edição integrada:")
        linhas += [f"- {MESES[m - 1]} de {a}: {u}" for a, m, u in publicados]
        linhas.append("")
    if planilha:
        linhas += [f"A série histórica no CKAN aponta para outro arquivo: {planilha}", ""]
    if publicados or planilha:
        linhas += ["Integração manual, por decisão (OPERACOES.md): trocar a URL em `scripts/contas-publicas/importar.py`, "
                   "rodar a captura completa, homologar o IPCA da nova base (`scripts/contas-publicas/importar-ipca.py`), "
                   "atualizar o aviso de atualidade e os testes que fixam a edição. Até lá, a página mostra a edição "
                   "integrada com o aviso de que há edição mais recente na fonte.", ""]
    if nao_verificado:
        linhas.append("Não verificado:")
        linhas += [f"- {x}" for x in nao_verificado]
        linhas.append("")
    assinatura = ",".join(f"{a}-{m:02d}" for a, m, _ in publicados) + (f"|{planilha}" if planilha else "")
    linhas.append(f"Assinatura: {assinatura or 'nao-verificado'}")
    return "\n".join(linhas) + "\n"


def main(buscar=http, hoje=None, caminho=DADOS):
    dados = json.loads(Path(caminho).read_text())
    publicados, planilha, nao_verificado = verificar(dados, buscar, hoje)
    texto = corpo(dados, publicados, planilha, nao_verificado)
    if texto is None:
        print(f"Nenhuma edição do RTN depois de {dados['referenciaRTN']}.")
        return 0
    print(texto)
    return 3


if __name__ == "__main__":
    sys.exit(main())
