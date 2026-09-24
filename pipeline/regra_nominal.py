"""Regra editorial das instituições nomeadas (docs/CONSTITUICAO.md, art. 5; avaliação de 24/09/2026, seção 3b).

Nenhuma página, texto, relatório ou arquivo gold associa instituição NOMEADA a faixa verbal
de risco, score composto, variação ou histórico de score, nem ao componente "risco" de cada
dimensão. O motivo é de método e de governança: as faixas nunca foram calibradas contra
desfechos conhecidos, e um rótulo de risco ao lado de um nome é lido como juízo, qualquer
que seja o aviso de rodapé.

O que continua publicado por instituição: métricas OBSERVADAS com percentil, mediana e
quartis do grupo de pares, data base e fonte. O score continua calculado internamente
(insumo da calibração futura) e é publicado apenas como distribuição anônima por grupo.

Esta é a única porta de saída do score por instituição para a gold: os builders que
escrevem `institutions.json`, `inst/*.json` e o relatório passam por aqui.
"""
import copy

VERSAO = "regra_nominal_v1"

# campos da instituição que nunca saem com o nome
CAMPOS_RETIRADOS = ("score", "score_anterior", "score_delta", "faixa", "historico_score")
# chave do componente de risco dentro de cada dimensão (percentil orientado a risco)
CAMPO_DIMENSAO_RETIRADO = "risco"

NOTA = ("Score composto e faixa verbal de risco não são publicados por instituição nomeada: "
        "as faixas não foram calibradas contra desfechos conhecidos (regra editorial de 24/09/2026, "
        "docs/CONSTITUICAO.md, art. 5). Cada métrica segue publicada como valor observado, com "
        "percentil, mediana e quartis do grupo de pares, data base e fonte.")


def dimensoes_publicaveis(dims):
    """Dimensões sem o componente de risco: valor, percentil e quartis dos pares."""
    return {k: {c: v for c, v in (d or {}).items() if c != CAMPO_DIMENSAO_RETIRADO}
            for k, d in (dims or {}).items()}


def instituicao_publicavel(i):
    out = {k: v for k, v in i.items() if k not in CAMPOS_RETIRADOS}
    if "dimensoes" in out:
        out["dimensoes"] = dimensoes_publicaveis(out["dimensoes"])
    return out


def _quartis(vals):
    v = sorted(vals)
    n = len(v)

    def q(p):
        # interpolação linear (mesma convenção de statistics.quantiles, método inclusive)
        pos = (n - 1) * p
        lo = int(pos)
        hi = min(lo + 1, n - 1)
        return round(v[lo] + (v[hi] - v[lo]) * (pos - lo), 1)
    return {"n": n, "min": round(v[0], 1), "q1": q(0.25), "mediana": q(0.5), "q3": q(0.75), "max": round(v[-1], 1)}


def distribuicao_anonima(instituicoes, minimo=5):
    """Distribuição do score por grupo de pares, SEM nomes nem códigos. Grupo com menos de
    `minimo` membros não é publicado: com poucos membros, o quartil identifica a instituição."""
    por_grupo = {}
    for i in instituicoes:
        if i.get("score") is None:
            continue
        por_grupo.setdefault(i.get("grupo_pares"), []).append(i["score"])
    out = {g: _quartis(v) for g, v in por_grupo.items() if len(v) >= minimo}
    omitidos = sorted(g for g, v in por_grupo.items() if len(v) < minimo)
    return {"grupos": out, "grupos_omitidos_por_tamanho": omitidos, "minimo_membros": minimo}


def institutions_publicavel(inst):
    """Payload de institutions.json pronto para a gold, sem campos nominais de score."""
    if not inst or not inst.get("ok"):
        return inst
    out = copy.deepcopy({k: v for k, v in inst.items() if k != "instituicoes"})
    out["instituicoes"] = [instituicao_publicavel(i) for i in inst.get("instituicoes", [])]
    out["score_distribuicao_anonima"] = distribuicao_anonima(inst.get("instituicoes", []))
    out["regra_editorial"] = VERSAO
    out["nota_regra_editorial"] = NOTA
    return out


def verificar(payload_institutions):
    """Lista de violações da regra num payload já publicado (vazio = conforme)."""
    viol = []
    for i in (payload_institutions or {}).get("instituicoes", []):
        for c in CAMPOS_RETIRADOS:
            if c in i:
                viol.append(f"{i.get('cod_inst')}: campo {c}")
        for k, d in (i.get("dimensoes") or {}).items():
            if CAMPO_DIMENSAO_RETIRADO in (d or {}):
                viol.append(f"{i.get('cod_inst')}: dimensão {k} com {CAMPO_DIMENSAO_RETIRADO}")
    return viol
