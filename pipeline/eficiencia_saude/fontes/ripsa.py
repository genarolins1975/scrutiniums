"""RIPSA (Rede Interagencial de Informações para a Saúde), pelo Portal de Dados Abertos do SUS.

Três indicadores municipais, em arquivos CSV do Ministério da Saúde (bucket `demas-dados-abertos`, sem autenticação):

* MRB.4.02, taxa de internação hospitalar SUS por condições sensíveis à atenção primária (ICSAP): `mgdi_ms_qu3.csv.zip`. Número de
  internações, total e nos 19 grupos da Lista Brasileira (Portaria SAS/MS nº 221/2008), por município de RESIDÊNCIA, ano, sexo e faixa
  etária, com a população estimada do denominador. Regra do indicador, verificada pelo OBEE por recálculo dos microdados do SIH/RD:
  ano de processamento da AIH, município de residência, AIH tipo 1 (sem longa permanência), sem hospital dia, diagnóstico principal
  na lista da Portaria. Só internações pagas pelo SUS.
* COB.2.01, internações hospitalares SUS por município de residência: `ripsa002cb.csv.zip`. Mesma regra; denominador do conjunto de
  internações do qual a ICSAP é parte.
* COB.5.01, cobertura de planos de saúde privados (ANS): `ripsa001cb.csv.zip`. Percentual da população com plano, em dezembro.

Cada arquivo é preservado com sha256 e data de captura; o OBEE guarda só o recorte agregado das 26 capitais (nenhuma linha de AIH).
Os arquivos não têm ficha de qualificação publicada no portal nem histórico de versões: a data do arquivo (Last-Modified) e o sha256 são
a referência. A licença do conjunto está em branco no metadado do portal.
"""
import csv
import hashlib
import io
import os
import urllib.request
import zipfile

from pipeline.eficiencia import entes
from pipeline.eficiencia_saude import base

BUCKET = "https://demas-dados-abertos.s3.amazonaws.com/csv"
PAGINA_MORBIDADE = "https://dadosabertos.saude.gov.br/dataset/ripsa-morbidade-dimensao-4-morbidade-hospitalar"
PAGINA_INTERNACOES = "https://dadosabertos.saude.gov.br/dataset/ripsa-cobertura-dimensao-2-internacoes-hospitalares"
PAGINA_PLANOS = "https://dadosabertos.saude.gov.br/dataset/ripsa-cobertura-dimensao-5-cobertura-por-planos-de-saude"
ANOS = (2021, 2022, 2023, 2024)
CAPITAIS6 = {str(c)[:6]: c for c, _, _ in entes.CAPITAIS}
BRONZE = os.path.join(base.DADOS, "bronze")

ARQUIVOS = {
    "icsap": ("mgdi_ms_qu3.csv.zip", "mgdi_ms_qu3.csv", PAGINA_MORBIDADE),
    "internacoes": ("ripsa002cb.csv.zip", "ripsa002cb.csv", PAGINA_INTERNACOES),
    "planos": ("ripsa001cb.csv.zip", "ripsa001cb.csv", PAGINA_PLANOS),
}


def baixa(chave):
    """Baixa o zip (se ainda não está na pasta de trabalho) e devolve (caminho, sha256, last_modified, etag)."""
    nome, _, _ = ARQUIVOS[chave]
    destino = os.path.join(BRONZE, nome)
    meta = {"last_modified": None, "etag": None}
    if not os.path.exists(destino):
        os.makedirs(BRONZE, exist_ok=True)
        req = urllib.request.Request(f"{BUCKET}/{nome}", headers={"User-Agent": "Mozilla/5.0 (OBEE; coleta de dados abertos)"})
        with urllib.request.urlopen(req, timeout=600) as r, open(destino, "wb") as f:
            meta = {"last_modified": r.headers.get("Last-Modified"), "etag": r.headers.get("ETag")}
            while True:
                b = r.read(1 << 20)
                if not b:
                    break
                f.write(b)
    return destino, base.sha256_arquivo(destino), meta["last_modified"], meta["etag"]


def _leitor(caminho, membro):
    z = zipfile.ZipFile(caminho)
    f = z.open(membro)
    return f, csv.DictReader(io.TextIOWrapper(f, encoding="utf-8", newline=""))


def _num(v):
    v = (v or "").strip()
    return float(v) if v else 0.0


def extrai_icsap():
    """Recorte agregado por capital e ano: total de ICSAP, 19 grupos e população do denominador (soma das células de sexo e faixa)."""
    caminho, sha, lm, etag = baixa("icsap")
    acc = {}
    nac = {}
    linhas = 0
    f, r = _leitor(caminho, ARQUIVOS["icsap"][1])
    with f:
        for l in r:
            linhas += 1
            mun, ano = l["Municipio"], l["ano"]
            if int(ano) in ANOS:
                n = nac.setdefault(int(ano), {"total": 0.0, "pop": 0.0, "municipios": set(), "cap_total": 0.0, "cap_pop": 0.0})
                n["total"] += _num(l["Numerador - Número internaçoes CSAP"])
                n["pop"] += _num(l["Denominador - Populaçao estimada"])
                n["municipios"].add(mun)
                if mun in CAPITAIS6:
                    n["cap_total"] += _num(l["Numerador - Número internaçoes CSAP"])
                    n["cap_pop"] += _num(l["Denominador - Populaçao estimada"])
            if mun not in CAPITAIS6 or int(ano) not in ANOS:
                continue
            a = acc.setdefault((mun, int(ano)), {"total": 0.0, "pop": 0.0, **{f"g{i}": 0.0 for i in range(1, 20)}, "celulas": 0})
            a["total"] += _num(l["Numerador - Número internaçoes CSAP"])
            a["pop"] += _num(l["Denominador - Populaçao estimada"])
            for i in range(1, 20):
                a[f"g{i}"] += _num(l[f"Numerador - Número internaçoes CSAP - Grupo {i}"])
            a["celulas"] += 1
    campos = ["ano", "codigo_ibge_6", "icsap_total", "populacao_denominador", "celulas_sexo_faixa"] + [f"grupo_{i}" for i in range(1, 20)]
    saida = []
    for (mun, ano), a in sorted(acc.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        saida.append({"ano": ano, "codigo_ibge_6": mun, "icsap_total": int(a["total"]), "populacao_denominador": int(a["pop"]),
                      "celulas_sexo_faixa": a["celulas"], **{f"grupo_{i}": int(a[f"g{i}"]) for i in range(1, 20)}})
    destino = os.path.join(base.SEED, "ripsa", "mrb402_icsap_capitais_2021_2024.csv.gz")
    sha_r = base.grava_csv_gz(destino, campos, saida)
    # referência nacional: soma de todos os municípios do próprio arquivo (nada a mais é coletado); o "exceto capitais" é a diferença
    nacional = [{"ano": a, "municipios": len(n["municipios"]), "icsap_total": int(n["total"]), "populacao_denominador": int(n["pop"]),
                 "icsap_26_capitais": int(n["cap_total"]), "populacao_26_capitais": int(n["cap_pop"])} for a, n in sorted(nac.items())]
    destino_nac = os.path.join(base.SEED, "ripsa", "mrb402_icsap_nacional_2021_2024.csv.gz")
    sha_nac = base.grava_csv_gz(destino_nac, ["ano", "municipios", "icsap_total", "populacao_denominador", "icsap_26_capitais", "populacao_26_capitais"], nacional)
    base.registra_captura("ripsa_mrb402_icsap", {
        "instituicao": "Ministério da Saúde (RIPSA, indicador MRB.4.02)",
        "conjunto": "Taxa de internação hospitalar SUS por condições sensíveis à atenção primária (ICSAP), por município de residência",
        "pagina": PAGINA_MORBIDADE, "url": f"{BUCKET}/{ARQUIVOS['icsap'][0]}", "capturado_em": base.agora_utc(), "publicado_em": lm,
        "etag": etag, "sha256_original": sha, "linhas_arquivo_original": linhas, "recorte": os.path.relpath(destino, base.RAIZ),
        "sha256_recorte": sha_r, "linhas_recorte": len(saida),
        "recorte_nacional": os.path.relpath(destino_nac, base.RAIZ), "sha256_recorte_nacional": sha_nac,
        "parametros": ("26 capitais; anos 2021 a 2024; somados os 3 sexos e as 13 faixas etárias (o arquivo traz uma linha por sexo e faixa); "
                       "total e 19 grupos da Lista Brasileira (Portaria SAS/MS 221/2008); população do denominador do próprio arquivo. "
                       "Referência nacional: soma de todos os municípios do mesmo arquivo, por ano."),
    })
    return len(saida)


def extrai_internacoes():
    caminho, sha, lm, etag = baixa("internacoes")
    saida = []
    linhas = 0
    f, r = _leitor(caminho, ARQUIVOS["internacoes"][1])
    with f:
        for l in r:
            linhas += 1
            mun, ano = l["Municipio"], l["Ano"]
            if mun in CAPITAIS6 and int(ano) in ANOS:
                saida.append({"ano": int(ano), "codigo_ibge_6": mun, "internacoes_sus": int(_num(l["Numerador - internaçoes"])),
                              "populacao_denominador": int(_num(l["Denominador - populacao_estimada"]))})
    saida.sort(key=lambda x: (x["ano"], x["codigo_ibge_6"]))
    destino = os.path.join(base.SEED, "ripsa", "cob201_internacoes_capitais_2021_2024.csv.gz")
    sha_r = base.grava_csv_gz(destino, ["ano", "codigo_ibge_6", "internacoes_sus", "populacao_denominador"], saida)
    base.registra_captura("ripsa_cob201_internacoes", {
        "instituicao": "Ministério da Saúde (RIPSA, indicador COB.2.01)",
        "conjunto": "Internações hospitalares SUS, por município de residência",
        "pagina": PAGINA_INTERNACOES, "url": f"{BUCKET}/{ARQUIVOS['internacoes'][0]}", "capturado_em": base.agora_utc(), "publicado_em": lm,
        "etag": etag, "sha256_original": sha, "linhas_arquivo_original": linhas, "recorte": os.path.relpath(destino, base.RAIZ),
        "sha256_recorte": sha_r, "linhas_recorte": len(saida), "parametros": "26 capitais; anos 2021 a 2024; total de internações",
    })
    return len(saida)


def extrai_planos():
    caminho, sha, lm, etag = baixa("planos")
    saida = []
    linhas = 0
    f, r = _leitor(caminho, ARQUIVOS["planos"][1])
    with f:
        for l in r:
            linhas += 1
            if l["co_ibge"] in CAPITAIS6 and l["sg_categoria"] == "TC" and l["co_anomes"] in {f"{a}12" for a in ANOS}:
                saida.append({"competencia": l["co_anomes"], "codigo_ibge_6": l["co_ibge"], "percentual": l["vl_indicador_calculado_mun"],
                              "atualizado_em": l["dt_atualizacao"]})
    saida.sort(key=lambda x: (x["competencia"], x["codigo_ibge_6"]))
    destino = os.path.join(base.SEED, "ripsa", "cob501_planos_capitais_dezembro_2021_2024.csv.gz")
    sha_r = base.grava_csv_gz(destino, ["competencia", "codigo_ibge_6", "percentual", "atualizado_em"], saida)
    base.registra_captura("ripsa_cob501_planos", {
        "instituicao": "Ministério da Saúde (RIPSA, indicador COB.5.01, base da ANS)",
        "conjunto": "Cobertura de planos de saúde privados (percentual da população), total das categorias",
        "pagina": PAGINA_PLANOS, "url": f"{BUCKET}/{ARQUIVOS['planos'][0]}", "capturado_em": base.agora_utc(), "publicado_em": lm,
        "etag": etag, "sha256_original": sha, "linhas_arquivo_original": linhas, "recorte": os.path.relpath(destino, base.RAIZ),
        "sha256_recorte": sha_r, "linhas_recorte": len(saida), "parametros": "26 capitais; dezembro de 2021 a 2024; categoria TC (todas as categorias)",
    })
    return len(saida)
