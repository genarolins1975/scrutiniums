"""Catálogo de métricas do domínio Energia: fonte única de definição.

Cada arquivo deste pacote define METRICAS (lista de dicts). O catálogo é publicado
em public/energia/gold/metricas.json e alimenta a página de Metodologia, as fichas
"Comprove este número" e docs/observatorios/energia/CATALOGO_METRICAS.md. A fórmula
é executada no pipeline, nunca reescrita em componente: a interface lê o valor
calculado e a definição daqui.

Campos (seção 11.2 da especificação do observatório):
    id, titulo, pergunta, definicao, unidade, grao_geografico, grao_temporal,
    fontes (ids de dataset), numerador?, denominador?, regra_agregacao,
    versao_formula, natureza_fonte, natureza_transformacao (OBSERVADO, CALCULADO,
    ESTIMADO, PREVISTO, CENARIO), dimensoes, regras_comparabilidade,
    regra_cobertura, politica_ausencia, validacoes, limitacoes, gold, paginas.
"""
import importlib
import os
import pkgutil

AQUI = os.path.dirname(os.path.abspath(__file__))
NATUREZAS = ("OBSERVADO", "CALCULADO", "ESTIMADO", "PREVISTO", "CENARIO")
OBRIGATORIOS = ("id", "titulo", "pergunta", "definicao", "unidade", "grao_geografico", "grao_temporal",
                "fontes", "regra_agregacao", "versao_formula", "natureza_fonte", "natureza_transformacao",
                "dimensoes", "regras_comparabilidade", "regra_cobertura", "politica_ausencia",
                "validacoes", "limitacoes", "gold", "paginas")


def validar(m):
    faltam = [c for c in OBRIGATORIOS if c not in m or m[c] in (None, "", [])]
    erros = [f"{m.get('id', '?')}: falta {c}" for c in faltam]
    if m.get("natureza_transformacao") not in NATUREZAS:
        erros.append(f"{m.get('id', '?')}: natureza_transformacao inválida {m.get('natureza_transformacao')!r}")
    if m.get("natureza_transformacao") == "CALCULADO" and not (m.get("formula") or m.get("numerador")):
        erros.append(f"{m.get('id', '?')}: CALCULADO exige formula ou numerador/denominador")
    if m.get("denominador") and not m.get("numerador"):
        erros.append(f"{m.get('id', '?')}: denominador sem numerador")
    return erros


def todas():
    metricas = []
    for info in pkgutil.iter_modules([AQUI]):
        if info.name.startswith("_"):
            continue
        mod = importlib.import_module(f"pipeline.energia.metricas.{info.name}")
        for m in getattr(mod, "METRICAS", []):
            metricas.append({**m, "arquivo": f"pipeline/energia/metricas/{info.name}.py"})
    erros = [e for m in metricas for e in validar(m)]
    ids = [m["id"] for m in metricas]
    repetidos = sorted({i for i in ids if ids.count(i) > 1})
    if repetidos:
        erros.append(f"ids repetidos: {repetidos}")
    if erros:
        raise ValueError("catálogo de métricas inválido: " + "; ".join(erros))
    return sorted(metricas, key=lambda m: m["id"])


def por_id(mid):
    for m in todas():
        if m["id"] == mid:
            return m
    raise KeyError(mid)
