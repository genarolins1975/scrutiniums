"""Módulos temáticos do domínio Energia descobertos automaticamente.

Cada arquivo deste pacote que define REGISTRO é um módulo com coleta própria e uma
gold publicada. O run.py os executa depois das golds de operação (PLD, hidrologia,
carga, geração, rede, CMO), na ordem de REGISTRO["ordem"]. Adicionar um módulo não
exige editar arquivo compartilhado.

Contrato de um módulo (ver docs/observatorios/energia/REGRAS_METODOLOGICAS.md):

    REGISTRO = {
        "id": "perdas",                    # identificador estável
        "gold": "perdas.json",             # publicado em public/energia/gold/
        "familia": "aneel_distribuicao",   # silver em data/energia/silver/<familia>.db
        "ordem": 50,                       # módulos que reutilizam outras golds vêm depois
        "datasets": [                      # conjuntos integrados (catálogo e página Dados)
            {"orgao": "ANEEL", "nome": "samp-balanco", "slug": "aneel-samp-balanco",
             "dataset_silver": "aneel_samp_balanco",   # dataset nas tabelas do silver
             "titulo": "...", "estado": "UTILIZADO EM INDICADOR",
             "url": "https://dadosabertos.aneel.gov.br/dataset/samp-balanco",  # obrigatória fora do CKAN
             "licenca": "...",
             "paginas": [{"rotulo": "Perdas", "href": "/setor-eletrico/perdas"}],
             "downloads": ["/energia/series/perdas_distribuidoras.csv"],
             "quebras": []},
        ],
        "arquivos": {"/energia/series/perdas_distribuidoras.csv": "colunas e unidades"},
    }
    def coletar(con, ctx) -> dict          # status; nunca lança por falha de fonte
    def construir(con, ctx) -> dict        # gold com cabecalho/disponivel (comum.cabecalho)

`ctx` é um dict com: hoje (date), golds (golds já construídas nesta execução, por
nome), con_principal (silver energia.db, só leitura por convenção) e sem_rede (bool).
"""
import importlib
import os
import pkgutil

AQUI = os.path.dirname(os.path.abspath(__file__))
CAMPOS_OBRIGATORIOS = ("id", "gold", "familia", "ordem", "datasets")


def descobrir():
    """Lista de módulos (objetos module) com REGISTRO válido, ordenados por ordem e id."""
    mods = []
    for info in pkgutil.iter_modules([AQUI]):
        if info.name.startswith("_"):
            continue
        m = importlib.import_module(f"pipeline.energia.modulos.{info.name}")
        reg = getattr(m, "REGISTRO", None)
        if reg is None:
            continue
        faltam = [c for c in CAMPOS_OBRIGATORIOS if c not in reg]
        if faltam:
            raise ValueError(f"módulo {info.name}: REGISTRO sem {faltam}")
        if not callable(getattr(m, "construir", None)):
            raise ValueError(f"módulo {info.name}: sem construir(con, ctx)")
        mods.append(m)
    ids = [m.REGISTRO["id"] for m in mods]
    golds = [m.REGISTRO["gold"] for m in mods]
    if len(set(ids)) != len(ids) or len(set(golds)) != len(golds):
        raise ValueError(f"módulos com id ou gold repetido: {ids} {golds}")
    return sorted(mods, key=lambda m: (m.REGISTRO["ordem"], m.REGISTRO["id"]))


def datasets_integrados():
    """{(orgao, nome): entrada} de todos os módulos, para o catálogo."""
    out = {}
    for m in descobrir():
        for d in m.REGISTRO["datasets"]:
            chave = (d["orgao"], d["nome"])
            atual = out.get(chave)
            golds = sorted(set((atual or {}).get("golds", []) + [m.REGISTRO["gold"]]))
            paginas = (atual or {}).get("paginas", []) + [p for p in d.get("paginas", []) if p not in (atual or {}).get("paginas", [])]
            out[chave] = {**d, "golds": golds, "paginas": paginas, "familia": m.REGISTRO["familia"]}
    return out
