"""População residente dos municípios (IBGE): denominador da despesa por habitante.

Três publicações oficiais, cada uma com sua data de referência:

* Estimativas da população (SIDRA, tabela 6579, variável 9324): referência em 1º de julho. Publicadas
  no Diário Oficial da União para os anos de 2021, 2024, 2025 e 2026. Não há estimativa municipal
  publicada para 2022 nem para 2023: o ano de 2022 é o do Censo e o de 2023 não tem publicação.
* Censo Demográfico 2022 (SIDRA, tabela 4714, variável 93): população residente, referência em 1º de
  agosto de 2022.
* Arquivos das estimativas no FTP do IBGE (estimativa_dou_AAAA.ods): a publicação original de cada
  ano. O pipeline os preserva (sha256) e compara com o SIDRA, que traz a versão vigente; diferenças
  são registradas, não corrigidas.

* Relação da população dos municípios para 2023 (rodada 6). O IBGE publicou no Diário Oficial da União, em
  31/08/2023, a relação das populações municipais "em substituição às estimativas de 2023", com a população
  do Censo 2022 (segunda apuração) de data de referência 31 de julho de 2022 e malha territorial de 30 de abril
  de 2023 (Nota Metodológica nº 1: "a população dos municípios referente ao ano 2023 será aquela oriunda do
  Censo Demográfico 2022 (segunda apuração), com a atualização da malha territorial dos municípios com
  referência em 30 de abril de 2023"). O arquivo da relação do DOU não pôde ser baixado (as páginas de
  produto do ibge.gov.br respondem 403 a acessos automatizados); usa-se a tabela municipal dos "Primeiros
  Resultados de População do Censo Demográfico 2022" (22/12/2023, mesmo total nacional de 203.080.756), que traz
  os mesmos valores do SIDRA 4714 nas 26 capitais. A igualdade município a município com o arquivo do DOU
  não foi verificada.

A estimativa de 2021 foi calculada a partir do Censo de 2010; as de 2024 em diante, a partir do Censo de
2022. Por isso a população de 2021 e a de 2022 em diante não formam uma série contínua (quebra de série
registrada na observação).
"""
import json
import os
import re
import time
import urllib.request

from pipeline.eficiencia import base, entes
from pipeline.eficiencia.fontes import ods

SIDRA = "https://apisidra.ibge.gov.br/values"
PAGINA_ESTIMATIVAS = "https://www.ibge.gov.br/estatisticas/sociais/populacao/9103-estimativas-de-populacao.html"
FTP = "https://ftp.ibge.gov.br/Estimativas_de_Populacao"
ANOS_ESTIMATIVA = (2021, 2024, 2025)
ANO_CENSO = 2022
ANO_RELACAO_DOU = 2023
FTP_CENSO = "https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022"
URL_PRIMEIROS_RESULTADOS = (FTP_CENSO + "/Populacao_e_domicilios_Primeiros_resultados/Resultados_da_2a_apuracao_20231027/"
                            "POP2022_Municipios_Primeiros_Resultados_20231222.pdf")
URL_NOTA_METODOLOGICA = "https://www.ibge.gov.br/biblioteca/visualizacao/livros/liv102024.pdf"
TOTAL_BRASIL_2A_APURACAO = 203080756


def _get(url, tentativas=4):
    espera, ultimo = 2, None
    for _ in range(tentativas):
        try:
            with urllib.request.urlopen(url, timeout=180) as r:
                return r.read()
        except Exception as e:  # rede instável: nova tentativa com espera crescente
            ultimo = e
            time.sleep(espera)
            espera *= 2
    raise RuntimeError(f"IBGE indisponível em {url}: {ultimo}")


def _sidra(tabela, variavel, ano):
    ids = ",".join(str(c) for c, _, _ in entes.CAPITAIS)
    url = f"{SIDRA}/t/{tabela}/n6/{ids}/v/{variavel}/p/{ano}"
    bruto = _get(url)
    linhas = json.loads(bruto.decode("utf-8"))[1:]
    return url, base.sha256_bytes(bruto), {int(x["D1C"]): int(x["V"]) for x in linhas}


def _dou(ano):
    """Valores das capitais na publicação original (arquivo .ods do FTP) e sha256 do arquivo."""
    url = f"{FTP}/Estimativas_{ano}/estimativa_dou_{ano}.ods"
    bruto = _get(url)
    tmp = os.path.join(base.DADOS, "tmp_pop", f"estimativa_dou_{ano}.ods")
    os.makedirs(os.path.dirname(tmp), exist_ok=True)
    with open(tmp, "wb") as f:
        f.write(bruto)
    capitais = {c for c, _, _ in entes.CAPITAIS}
    out = {}
    try:
        for r in ods.linhas(tmp, aba=1):
            if len(r) < 5 or not r[3]:
                continue
            try:
                cm = r[2] if isinstance(r[2], str) else f"{int(r[2]):05d}"
                cod = int(f"{int(r[1])}{cm}")
            except (TypeError, ValueError):
                continue
            if cod not in capitais:
                continue
            v = r[4]
            nota = None
            if isinstance(v, str):
                m = re.match(r"^\s*([\d\.]+)\s*(?:\((\d+)\))?\s*$", v)
                if not m:
                    continue
                v, nota = int(m.group(1).replace(".", "")), m.group(2)
            out[cod] = {"valor": int(v), "nota_rodape": nota}
    finally:
        os.remove(tmp)
    return url, base.sha256_bytes(bruto), out


def coleta():
    """Captura as 26 capitais nas três publicações e grava um único recorte com sha256 de cada resposta."""
    capturado_em = base.agora_utc()
    registros, fontes = [], {}
    for ano in ANOS_ESTIMATIVA:
        url, sha, vals = _sidra(6579, 9324, ano)
        fontes[f"sidra_6579_{ano}"] = {"url": url, "sha256_resposta": sha}
        durl, dsha, dou = _dou(ano)
        fontes[f"ftp_estimativa_dou_{ano}"] = {"url": durl, "sha256_arquivo": dsha}
        for cod, v in vals.items():
            registros.append({"ano": ano, "cod": cod, "tipo": "estimativa", "valor": v, "tabela": "6579",
                              "publicacao_original": dou.get(cod, {}).get("valor"),
                              "nota_rodape_original": dou.get(cod, {}).get("nota_rodape")})
    url, sha, vals = _sidra(4714, 93, ANO_CENSO)
    fontes[f"sidra_4714_{ANO_CENSO}"] = {"url": url, "sha256_resposta": sha}
    for cod, v in vals.items():
        registros.append({"ano": ANO_CENSO, "cod": cod, "tipo": "censo", "valor": v, "tabela": "4714",
                          "publicacao_original": None, "nota_rodape_original": None})
    registros.sort(key=lambda r: (r["ano"], r["cod"]))
    destino = os.path.join(base.SEED, "ibge_populacao", "populacao_capitais.json.gz")
    sha = base.grava_json_gz(destino, registros)
    base.registra_captura("ibge_populacao", {
        "instituicao": "Instituto Brasileiro de Geografia e Estatística (IBGE)",
        "conjunto": "População residente: estimativas (SIDRA 6579, referência 1º de julho) e Censo Demográfico 2022 (SIDRA 4714, referência 1º de agosto de 2022)",
        "pagina": PAGINA_ESTIMATIVAS,
        "url": fontes[f"sidra_6579_{ANOS_ESTIMATIVA[0]}"]["url"],
        "capturado_em": capturado_em,
        "parametros": "26 capitais; estimativas de 2021, 2024 e 2025; Censo 2022; sem estimativa municipal publicada para 2022 e 2023",
        "fontes": fontes,
        "recorte": os.path.relpath(destino, base.RAIZ),
        "sha256_recorte": sha,
        "linhas_recorte": len(registros),
    })
    return len(registros)


# ---------------------------------------------------------------- população oficial de 2023 (Censo 2022, relação do DOU)

def _texto_pdf(bruto):
    """Texto de um PDF: pdftotext (poppler) ou, na falta dele, pypdf. Só na coleta; o pipeline lê o seed."""
    import shutil
    import subprocess
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        arq = os.path.join(d, "x.pdf")
        with open(arq, "wb") as f:
            f.write(bruto)
        if shutil.which("pdftotext"):
            return subprocess.run(["pdftotext", "-layout", arq, "-"], check=True, capture_output=True, text=True).stdout
        try:
            import pypdf
        except ImportError as e:
            raise RuntimeError("a coleta da relação de 2023 exige pdftotext (poppler) ou pypdf") from e
        return "\n".join((p.extract_text() or "") for p in pypdf.PdfReader(arq).pages)


def coleta_relacao_2023():
    """População do Censo 2022 (segunda apuração) das 26 capitais, população oficial do exercício de 2023.

    Lê a tabela municipal dos Primeiros Resultados de População (22/12/2023), confere o total nacional e cada
    capital contra o SIDRA 4714 e guarda o resultado no seed com o sha256 dos dois PDFs (tabela e nota)."""
    capturado_em = base.agora_utc()
    tabela = _get(URL_PRIMEIROS_RESULTADOS)
    nota = _get(URL_NOTA_METODOLOGICA)
    texto = _texto_pdf(tabela)
    total = re.search(r"^Brasil\s+([\d\.]+)\s*$", texto, re.M)
    total_brasil = int(total.group(1).replace(".", "")) if total else None
    if total_brasil != TOTAL_BRASIL_2A_APURACAO:
        raise RuntimeError(f"total nacional da tabela do IBGE ({total_brasil}) difere do esperado ({TOTAL_BRASIL_2A_APURACAO})")
    por_nome = {}
    for m in re.finditer(r"^([A-Z]{2})\s+(\d{2})\s+(\d{5})\s+(.+?)\s+([\d\.]+)(?:\((\d+)\))?\s*$", texto, re.M):
        uf, cu, cm, nome, pop, rodape = m.groups()
        por_nome[(uf, nome.strip())] = {"cod_parcial": int(cu + cm), "valor": int(pop.replace(".", "")), "nota_rodape": rodape}
    url_s, sha_s, sidra = _sidra(4714, 93, ANO_CENSO)
    registros = []
    for cod, nome, uf in entes.CAPITAIS:
        r = por_nome.get((uf, nome))
        if r is None:
            raise RuntimeError(f"capital não encontrada na tabela do IBGE: {nome} ({uf})")
        registros.append({"ano": ANO_RELACAO_DOU, "cod": cod, "tipo": "censo_relacao_dou_2023", "valor": r["valor"],
                          "nota_rodape_original": r["nota_rodape"], "igual_ao_sidra_4714": r["valor"] == sidra.get(cod)})
    destino = os.path.join(base.SEED, "ibge_populacao", "relacao_2023_capitais.json.gz")
    sha = base.grava_json_gz(destino, registros)
    base.registra_captura("ibge_populacao_relacao_2023", {
        "instituicao": "Instituto Brasileiro de Geografia e Estatística (IBGE)",
        "conjunto": "População dos municípios para o exercício de 2023: Censo Demográfico 2022 (segunda apuração), relação do DOU de 31/08/2023",
        "pagina": "https://www.ibge.gov.br/estatisticas/sociais/populacao/37734-relacao-da-populacao-dos-municipios-para-publicacao-no-tcu.html",
        "url": URL_PRIMEIROS_RESULTADOS, "capturado_em": capturado_em,
        "parametros": ("26 capitais; tabela municipal dos Primeiros Resultados de População do Censo 2022 (22/12/2023); "
                       f"total nacional conferido ({total_brasil}); valores conferidos contra o SIDRA 4714; "
                       "o arquivo da relação do DOU não foi baixado (ibge.gov.br responde 403)"),
        "sha256_tabela_pdf": base.sha256_bytes(tabela), "url_nota_metodologica": URL_NOTA_METODOLOGICA,
        "sha256_nota_metodologica_pdf": base.sha256_bytes(nota), "sidra_4714": {"url": url_s, "sha256_resposta": sha_s},
        "total_brasil": total_brasil, "capitais_iguais_ao_sidra_4714": sum(1 for r in registros if r["igual_ao_sidra_4714"]),
        "recorte": os.path.relpath(destino, base.RAIZ), "sha256_recorte": sha, "linhas_recorte": len(registros),
    })
    return registros
