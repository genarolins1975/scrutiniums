"""OCDE, Education at a Glance (EAG): contexto internacional para tamanho de turma e despesa por estudante.

API SDMX pública da OCDE (https://sdmx.oecd.org/public/rest). Dois conjuntos, ambos lidos com todos os
países que têm valor, sem escolha de países:

* tamanho médio das turmas (OECD.EDU.IMEP, DSD_EAG_UOE_NON_FIN_PERS@DF_UOE_NF_PERS_CLS, versão 1.1),
  ISCED 1 e 2, instituições públicas e todas, 2023 e 2024;
* despesa por estudante em equivalente em tempo integral (OECD.EDU.IMEP, DSD_EAG_UOE_FIN@DF_UOE_INDIC_FIN_PERSTUD,
  versão 3.2), ISCED 1, 2 e 1 a 8, fonte governamental (S13), instituições educacionais públicas e todas, USD de
  paridade de poder de compra (PPC), preços correntes, 2023.

A média da OCDE é a publicada pela própria fonte (média simples dos países da OCDE com dado); o pipeline
a reproduz a partir dos países lidos e registra a diferença, se houver. Nenhum valor é convertido pelo
câmbio, e nenhum país é excluído por critério do pipeline.
"""
import csv
import io
import os
import time
import urllib.request

from pipeline.eficiencia import base

API = "https://sdmx.oecd.org/public/rest/data"
PAGINA = "https://www.oecd.org/en/publications/serials/education-at-a-glance_g1g1b0a6.html"
ACCEPT = "application/vnd.sdmx.data+csv; charset=utf-8; labels=both; timeFormat=original"

CLASSE = {
    "id": "ocde_tamanho_turma",
    "dataflow": "OECD.EDU.IMEP,DSD_EAG_UOE_NON_FIN_PERS@DF_UOE_NF_PERS_CLS,1.1",
    "chave": ".ISCED11_1+ISCED11_2.CLS..............",
    "periodos": (2023, 2024),
    "conjunto": "OCDE, Education at a Glance: tamanho médio das turmas (Average class size), ISCED 1 e 2",
}
DESPESA = {
    "id": "ocde_despesa_por_estudante",
    "dataflow": "OECD.EDU.IMEP,DSD_EAG_UOE_FIN@DF_UOE_INDIC_FIN_PERSTUD,3.2",
    "chave": ".FIN_PERSTUD.ISCED11_1+ISCED11_2+ISCED11_1T8.S13.INST_EDU+INST_EDU_PUB.DIR_EXP.V.USD_PPP_ST.",
    "periodos": (2023, 2023),
    "conjunto": "OCDE, Education at a Glance: despesa em instituições educacionais por estudante em tempo integral, fonte governamental, USD PPC",
}


def _baixa(url, tentativas=4):
    espera, ultimo = 2, None
    for _ in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={"Accept": ACCEPT, "User-Agent": "scrutiniums-obee/1.2 (+https://github.com/genarolins1975/scrutiniums)"})
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read()
        except Exception as e:
            ultimo = e
            time.sleep(espera)
            espera *= 2
    raise RuntimeError(f"OCDE indisponível em {url}: {ultimo}")


def _codigo(v):
    """'BRA: Brazil' -> ('BRA', 'Brazil'); sem rótulo -> (valor, valor)."""
    if v is None:
        return None, None
    c, _, nome = v.partition(": ")
    return c.strip(), (nome or c).strip()


def _linhas(bruto):
    leitor = csv.DictReader(io.StringIO(bruto.decode("utf-8-sig")))
    cab = {k: k.split(":")[0].strip() for k in leitor.fieldnames}
    for r in leitor:
        yield {cab[k]: v for k, v in r.items()}


def coleta():
    capturado_em = base.agora_utc()
    registros, fontes = [], {}
    for cfg in (CLASSE, DESPESA):
        url = f"{API}/{cfg['dataflow']}/{cfg['chave']}?startPeriod={cfg['periodos'][0]}&endPeriod={cfg['periodos'][1]}&dimensionAtObservation=AllDimensions"
        bruto = _baixa(url)
        fontes[cfg["id"]] = {"url": url, "sha256_resposta": base.sha256_bytes(bruto), "bytes": len(bruto)}
        for r in _linhas(bruto):
            if r.get("OBS_VALUE", "") == "":
                continue
            area, pais = _codigo(r["REF_AREA"])
            nivel, nivel_nome = _codigo(r["EDUCATION_LEV"])
            if cfg is CLASSE:
                inst, _ = _codigo(r["INST_TYPE_EDU"])
                if inst not in ("INST_EDU", "INST_EDU_PUB"):
                    continue
                extra = {"instituicoes": "publicas" if inst == "INST_EDU_PUB" else "todas", "unidade": "alunos por turma"}
            else:
                # EXP_DESTINATION: INST_EDU = despesa em instituições educacionais (públicas e privadas);
                # INST_EDU_PUB = só instituições públicas. Para o Brasil, INST_EDU soma o gasto governamental em
                # instituições públicas e divide pela matrícula de públicas e privadas; INST_EDU_PUB usa as públicas nos dois lados.
                dest, _ = _codigo(r["EXP_DESTINATION"])
                if dest not in ("INST_EDU", "INST_EDU_PUB"):
                    continue
                extra = {"instituicoes": "publicas" if dest == "INST_EDU_PUB" else "todas", "unidade": "USD PPC por estudante em tempo integral"}
            registros.append({"conjunto": cfg["id"], "pais": area, "nome": pais, "nivel": nivel, "ano": int(r["TIME_PERIOD"]),
                              "valor": float(r["OBS_VALUE"]), "status": _codigo(r.get("OBS_STATUS"))[0], **extra})
    registros.sort(key=lambda x: (x["conjunto"], x["nivel"], x["instituicoes"], x["ano"], x["pais"]))
    destino = os.path.join(base.SEED, "ocde", "education_at_a_glance.json.gz")
    sha = base.grava_json_gz(destino, registros)
    base.registra_captura("ocde_eag", {
        "instituicao": "Organização para a Cooperação e Desenvolvimento Econômico (OCDE)",
        "conjunto": "Education at a Glance: tamanho de turma (2023 e 2024) e despesa por estudante (2023), todos os países com dado",
        "pagina": PAGINA, "url": fontes["ocde_tamanho_turma"]["url"], "capturado_em": capturado_em,
        "parametros": "API SDMX; ISCED 1, 2 e 1 a 8; só observações com valor; tamanho de turma: instituições públicas e todas; despesa: fonte governamental, USD PPC, preços correntes",
        "fontes": fontes, "recorte": os.path.relpath(destino, base.RAIZ), "sha256_recorte": sha, "linhas_recorte": len(registros),
        "notas_da_fonte": [
            "O dataflow de tamanho de turma informa que os dados do último ano disponível são preliminares; os finais seriam divulgados em 29 de setembro de 2026.",
            "A média da OCDE é a média simples, sem ponderação, dos países membros com dado (composição fixa de 38 membros), como no Reader's Guide do Education at a Glance 2025.",
            "Despesa por estudante: para o Brasil, o recorte de todas as instituições (INST_EDU) divide o gasto em instituições públicas pela matrícula de públicas e privadas; o recorte de instituições públicas (INST_EDU_PUB) é o coerente com uma rede pública e é o exibido.",
            "Tamanho de turma: o dado de 2024 é preliminar (dataflow marcado como não produtivo na consulta de 08/10/2026).",
        ],
    })
    return len(registros)
