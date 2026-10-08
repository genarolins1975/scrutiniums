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
