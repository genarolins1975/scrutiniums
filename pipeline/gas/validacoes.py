"""Validações determinísticas da gold do gás. Falha de identidade interrompe a publicação; problema de cobertura da
fonte vira marca publicada junto do dado (o valor sai como ausente, nunca é corrigido)."""
from statistics import median


def cobertura_movimentacao(meses, transportadoras, entrega, fator=10.0, relevancia=0.05):
    """Marca (mês, transportadora) sem volume entregue, com volume abaixo de um décimo ou acima de `fator` vezes a
    mediana da própria série (lacuna ou erro de escala da fonte). O par sai sem valor. O mês inteiro só é marcado como
    de cobertura incompleta quando a transportadora é relevante: mediana de pelo menos `relevancia` da mediana do
    total entregue. Retorna {mes: [motivos], "_pares": {(mes, t)}}."""
    flags = {"_pares": set()}
    totais = [sum(entrega.get((m, t), 0.0) for t in transportadoras) for m in meses]
    med_total = median([v for v in totais if v > 0]) if any(v > 0 for v in totais) else 0
    for t in transportadoras:
        valores = [entrega.get((m, t), 0.0) for m in meses]
        positivos = [v for v in valores if v > 0]
        if not positivos:
            continue
        med = median(positivos)
        relevante = med >= relevancia * med_total
        for m, v in zip(meses, valores):
            motivo = None
            if relevante and v <= 0:
                motivo = f"{t}: sem volume entregue no arquivo do mês"
            elif relevante and v < med / fator:
                motivo = f"{t}: volume entregue abaixo de um décimo da mediana da própria série"
            elif v > med * fator:
                motivo = f"{t}: volume entregue acima de dez vezes a mediana da própria série"
            if motivo:
                flags["_pares"].add((m, t))
                if relevante:
                    flags.setdefault(m, []).append(motivo)
    return flags


def quebras_de_patamar(meses, transportadoras, entrega, sigla, limite=0.5):
    """Meses em que o volume entregue por uma transportadora fica abaixo de `limite` ou acima de 1/`limite` da mediana
    dos 12 meses anteriores. Não altera o dado: vira anotação, porque a fonte não explica a mudança nos metadados."""
    out = []
    for t in transportadoras:
        valores = [entrega.get((m, t), 0.0) for m in meses]
        for i in range(12, len(meses)):
            janela = [v for v in valores[i - 12:i] if v > 0]
            if len(janela) < 9:
                continue
            med = median(janela)
            v = valores[i]
            if med > 0 and v > 0 and (v < limite * med or v > med / limite):
                out.append({"mes": meses[i], "transportadora": sigla[t], "razao": round(v / med, 2)})
    return out


class ErroValidacao(Exception):
    pass


def _exige(cond, msg):
    if not cond:
        raise ErroValidacao(msg)


def conferir(s):
    g = s.golds
    for nome in ("producao", "aproveitamento", "importacao", "precos", "gas-de-cozinha", "gnv-e-gas-encanado", "mercado", "infraestrutura", "meta"):
        _exige(nome in g, f"gold ausente: {nome}")
    prod = g["producao"]
    _exige(prod["indicadores"]["producao_mes"]["valor"] > 0, "produção do último mês não positiva")
    soma_uf = sum(x["participacao_pct"] for x in prod["por_uf"])
    _exige(abs(soma_uf - 100) < 0.2, f"participações por UF somam {soma_uf}")
    for x in prod["serie"]:
        if x["total"] is not None and x["mar"] is not None and x["terra"] is not None:
            _exige(abs(x["mar"] + x["terra"] - x["total"]) < 0.01, f"mar + terra ≠ total em {x['mes']}")
    ap = g["aproveitamento"]
    for x in ap["serie"]:
        if abs(x["diferenca_pct"]) >= 2.0:
            _exige(x["situacao"] == "inconsistente" and x["disponivel"] is None, f"mês com balanço aberto publicado como válido: {x['mes']}")
    _exige(len(ap["meses_inconsistentes"]) <= 3, f"meses inconsistentes demais no balanço: {len(ap['meses_inconsistentes'])}")
    for x in g["gas-de-cozinha"]["serie"]:
        if x["medio"] is not None and x["minimo"] is not None and x["maximo"] is not None:
            _exige(x["minimo"] <= x["medio"] <= x["maximo"], f"GLP: média fora do intervalo em {x['mes']}")
    for x in g["gnv-e-gas-encanado"]["serie"]:
        if x["medio"] is not None and x["minimo"] is not None and x["maximo"] is not None:
            _exige(x["minimo"] <= x["medio"] <= x["maximo"], f"GNV: média fora do intervalo em {x['mes']}")
    for x in g["precos"]["serie"]:
        for k in ("nao_termico", "termico"):
            if x[k] is not None:
                _exige(0 < x[k] < 1000, f"preço {k} fora de faixa em {x['mes']}: {x[k]}")
    for x in g["importacao"]["serie"]:
        if x["participacao_pct"] is not None:
            _exige(0 <= x["participacao_pct"] <= 100, f"participação da importação fora de 0 a 100 em {x['mes']}")
    for x in g["mercado"]["carregadores"]:
        if x["ativos"] is not None:
            _exige(x["ativos"] >= max(v for k, v in x.items() if k.startswith("n:")), f"total de carregadores menor que o de uma transportadora em {x['mes']}")
    # nenhum indicador publicado sem fonte, unidade e natureza
    for nome, gold in g.items():
        for chave, ind in (gold.get("indicadores") or {}).items():
            _exige(ind.get("fontes") and ind.get("unidade") and ind.get("natureza") in ("OBSERVADO", "CALCULADO"),
                   f"{nome}.{chave}: indicador sem fonte, unidade ou natureza")
            if ind["natureza"] == "CALCULADO":
                _exige(bool(ind.get("formula")), f"{nome}.{chave}: indicador calculado sem fórmula")
