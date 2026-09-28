"""Catálogo de datasets do setor elétrico (catalogado ≠ integrado).

Colhe os metadados oficiais pela API CKAN dos portais (ONS e ANEEL; CCEE a partir
do package_show versionado no seed, enquanto o portal estiver bloqueado) e
acrescenta as entradas manuais de catalogo_manual.json (metadados_verificados=false).
O estado de integração vem de INTEGRADOS: nenhum dataset só catalogado alimenta
número publicado.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.common import http_get  # noqa: E402
from pipeline.energia import base  # noqa: E402

PORTAIS = {
    "ONS": "https://dados.ons.org.br/api/3/action/package_search?rows=1000",
    "ANEEL": "https://dadosabertos.aneel.gov.br/api/3/action/package_search?rows=1000",
}
URL_DATASET = {"ONS": "https://dados.ons.org.br/dataset/", "ANEEL": "https://dadosabertos.aneel.gov.br/dataset/",
               "CCEE": "https://dadosabertos.ccee.org.br/dataset/"}
AQUI = os.path.dirname(os.path.abspath(__file__))

# (órgão, nome CKAN) → estado e golds que consomem
INTEGRADOS = {
    ("CCEE", "pld_horario"): {"estado": "UTILIZADO EM MODELO", "golds": ["pld.json", "rede.json", "sintese.json"],
                              "modelos": ["B0", "C1", "C2-P", "C2-H"], "slug": "ccee-pld-horario"},
    ("ONS", "ear-diario-por-subsistema"): {"estado": "UTILIZADO EM INDICADOR", "golds": ["hidrologia.json", "sintese.json"],
                                           "slug": "ons-ear-subsistema"},
    ("ONS", "ena-diario-por-subsistema"): {"estado": "UTILIZADO EM INDICADOR", "golds": ["hidrologia.json", "sintese.json"],
                                           "slug": "ons-ena-subsistema"},
    ("ONS", "carga-energia"): {"estado": "UTILIZADO EM INDICADOR", "golds": ["carga.json", "sintese.json"],
                               "slug": "ons-carga-diaria"},
    ("ONS", "balanco-energia-subsistema"): {"estado": "UTILIZADO EM INDICADOR", "golds": ["geracao.json", "rede.json", "sintese.json"],
                                            "slug": "ons-balanco-energia"},
    ("ONS", "intercambio-nacional"): {"estado": "UTILIZADO EM INDICADOR", "golds": ["rede.json"],
                                      "slug": "ons-intercambio"},
    ("ONS", "cmo-semanal"): {"estado": "UTILIZADO EM INDICADOR", "golds": ["cmo.json", "sintese.json"],
                             "slug": "ons-cmo-semanal"},
}
QUEBRAS = {
    ("ONS", "carga-energia"): [
        {"data": "2021-03-01", "descricao": "Passa a incluir a previsão de geração de usinas não despachadas pelo ONS."},
        {"data": "2023-04-29", "descricao": "Passa a incorporar o valor estimado da micro e minigeração distribuída (MMGD)."},
    ],
}
TEMAS = [
    ("preco", ["pld", "cmo", "preco", "preço", "cvu", "tarifa", "bandeira", "componentes-tarif"]),
    ("hidrologia", ["ear", "ena", "hidrolog", "reservat", "vazao", "vazão", "fluviom", "precipita", "bacia", "volume"]),
    ("geracao", ["geracao", "geração", "usina", "capacidade", "eolica", "eólica", "fotovolt", "termic", "térmic", "coff", "constrained", "disponibilidade", "fator-capacidade", "modalidade", "uge"]),
    ("carga", ["carga", "demanda", "curva"]),
    ("rede", ["intercambio", "intercâmbio", "linha", "transmiss", "subestac", "equipamento", "confiab", "fluxo", "reativo"]),
    ("distribuicao", ["distribu", "dec", "fec", "mmgd", "consumidor", "indqual", "atendimento", "interrup", "bdgd"]),
    ("expansao", ["leilo", "leilõ", "ralie", "outorga", "expans", "empreendimento", "acrescimo"]),
    ("regulacao", ["infra", "intima", "notifica", "audienc", "consulta", "reunio", "pauta", "fiscaliza", "tfsee"]),
    ("empresas", ["agentes", "societ", "cde", "subsid", "beneficiar"]),
]


def tema(nome, titulo):
    s = f"{nome} {titulo}".lower()
    for t, chaves in TEMAS:
        if any(k in s for k in chaves):
            return t
    return "outros"


def _entrada(orgao, pkg, verificado=True):
    nome = pkg.get("name")
    integ = INTEGRADOS.get((orgao, nome))
    formatos = sorted({(r.get("format") or "").upper() for r in pkg.get("resources", []) if r.get("format")})
    notas = (pkg.get("notes") or "").split("-----")[0].strip()
    return {
        "id": f"{orgao.lower()}:{nome}",
        "slug": integ["slug"] if integ else None,
        "orgao": orgao,
        "nome": nome,
        "titulo": pkg.get("title"),
        "url": URL_DATASET[orgao] + nome,
        "licenca": pkg.get("license_title") or pkg.get("license_id"),
        "modificado_na_fonte": pkg.get("metadata_modified"),
        "descricao": notas[:600],
        "n_recursos": pkg.get("num_resources") or len(pkg.get("resources", [])),
        "formatos": formatos,
        "tema": tema(nome or "", pkg.get("title") or ""),
        "estado": integ["estado"] if integ else "CATALOGADO",
        "usado_em": integ["golds"] if integ else [],
        "modelos": integ.get("modelos", []) if integ else [],
        "quebras": QUEBRAS.get((orgao, nome), []),
        "metadados_verificados": verificado,
        "descontinuado": "descontinuad" in (pkg.get("title") or "").lower() or "descontinuad" in (nome or ""),
    }


def colhe(baixar=http_get):
    """Colhe os portais; guarda o bruto em data/energia/meta para execuções sem rede."""
    brutos = {}
    pasta = os.path.join(base.DADOS, "meta")
    for orgao, url in PORTAIS.items():
        caminho = os.path.join(pasta, f"_ckan_{orgao}.json")
        try:
            corpo, _ = baixar(url, timeout=120)
            brutos[orgao] = {"colhido_em": base.agora_utc(), "resultado": json.loads(corpo)["result"]["results"]}
            base.escreve_gold(f"_ckan_{orgao}.json", brutos[orgao], destino=pasta)
        except Exception as e:
            anterior = base.le_gold(f"_ckan_{orgao}.json", destino=pasta)
            brutos[orgao] = anterior or {"colhido_em": None, "resultado": [], "erro": str(e)[:200]}
    return brutos


def construir(brutos):
    entradas = []
    status = {}
    for orgao, b in brutos.items():
        for pkg in b.get("resultado", []):
            entradas.append(_entrada(orgao, pkg))
        status[orgao] = {"colhido_em": b.get("colhido_em"), "conjuntos": len(b.get("resultado", [])), "erro": b.get("erro")}
    seed_pkg = os.path.join(base.SEED, "ccee_pld_horario", "v20260927T154402Z", "package_show.json")
    with open(seed_pkg, encoding="utf-8") as f:
        entradas.append(_entrada("CCEE", json.load(f)["result"]))
    status["CCEE"] = {"colhido_em": "2026-09-27T15:44:02Z", "conjuntos": 1,
                      "erro": "Catálogo da CCEE não colhido automaticamente nesta fase; os metadados do PLD_HORARIO vêm da captura versionada de 27/09/2026 (o portal recusou a coleta automatizada com HTTP 403 na manhã de 28/09/2026)."}
    with open(os.path.join(AQUI, "catalogo_manual.json"), encoding="utf-8") as f:
        for m in json.load(f)["entradas"]:
            entradas.append({**m, "estado": "CATALOGADO", "usado_em": [], "modelos": [], "quebras": [],
                             "metadados_verificados": False, "descontinuado": False, "slug": None})
    ordem = ["UTILIZADO EM MODELO", "UTILIZADO EM INDICADOR", "VALIDADO", "INTEGRADO", "EM INTEGRAÇÃO", "CATALOGADO"]
    entradas.sort(key=lambda e: (ordem.index(e["estado"]), e["orgao"], e["titulo"] or ""))
    contagem = {}
    for e in entradas:
        contagem[e["estado"]] = contagem.get(e["estado"], 0) + 1
    return {
        "dominio": base.DOMINIO, "gold": "catalogo.json", "gerado_em": base.agora_utc(),
        "versao_pipeline": base.VERSAO_PIPELINE, "disponivel": True,
        "estados": ordem[::-1],
        "definicoes_estado": {
            "CATALOGADO": "Existência e metadados registrados.",
            "EM INTEGRAÇÃO": "Coletor em desenvolvimento ou bloqueado por acesso.",
            "INTEGRADO": "Coletado pelo pipeline com bronze, sha256 e silver.",
            "VALIDADO": "Integrado e com validações automáticas passando.",
            "UTILIZADO EM INDICADOR": "Alimenta indicador publicado no portal.",
            "UTILIZADO EM MODELO": "Alimenta modelo registrado (em qualquer estado).",
        },
        "portais": status, "contagem": contagem, "total": len(entradas), "entradas": entradas,
    }
