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
    for nome in ("producao", "aproveitamento", "importacao", "precos", "gas-de-cozinha", "gnv-e-gas-encanado", "combustiveis", "mercado", "infraestrutura", "meta"):
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
        if x["situacao"] == "incompleto":
            _exige(x["diferenca_pct"] is None and x["diferenca"] is None, f"diferença sem cobertura em {x['mes']}")
        if x["diferenca_pct"] is not None and abs(x["diferenca_pct"]) > 2.0:
            _exige(x["situacao"] == "inconsistente" and x["disponivel"] is None, f"mês com balanço aberto publicado como válido: {x['mes']}")
    _exige(len(ap["meses_inconsistentes"]) <= 3, f"meses inconsistentes demais no balanço: {len(ap['meses_inconsistentes'])}")
    for x in g["gas-de-cozinha"]["serie"]:
        if x["medio"] is not None and x["minimo"] is not None and x["maximo"] is not None:
            _exige(x["minimo"] <= x["medio"] <= x["maximo"], f"GLP: média fora do intervalo em {x['mes']}")
    for x in g["gnv-e-gas-encanado"]["serie"]:
        if x["medio"] is not None and x["minimo"] is not None and x["maximo"] is not None:
            _exige(x["minimo"] <= x["medio"] <= x["maximo"], f"GNV: média fora do intervalo em {x['mes']}")
    conferir_combustiveis(g["combustiveis"], g["gas-de-cozinha"]["ultimo_mes"])
    for x in g["precos"]["serie"]:
        for k in ("nao_termico", "termico"):
            if x[k] is not None:
                _exige(0 < x[k] < 1000, f"preço {k} fora de faixa em {x['mes']}: {x[k]}")
    for x in g["importacao"]["serie"]:
        if x["participacao_pct"] is not None:
            _exige(0 <= x["participacao_pct"] <= 100, f"participação da importação fora de 0 a 100 em {x['mes']}")
    for x in g["mercado"]["carregadores"]:
        if x["ativos"] is not None:
            _exige(x["ativos"] >= max(v for k, v in x.items() if k.startswith("n:") and v is not None), f"total de carregadores menor que o de uma transportadora em {x['mes']}")
    # nenhum indicador publicado sem fonte, unidade e natureza
    for nome, gold in g.items():
        for chave, ind in (gold.get("indicadores") or {}).items():
            _exige(ind.get("fontes") and ind.get("unidade") and ind.get("natureza") in ("OBSERVADO", "CALCULADO"),
                   f"{nome}.{chave}: indicador sem fonte, unidade ou natureza")
            if ind["natureza"] == "CALCULADO":
                _exige(bool(ind.get("formula")), f"{nome}.{chave}: indicador calculado sem fórmula")


# Faixa de plausibilidade do preço por litro na revenda (R$/l). Fora dela, é erro de escala ou de unidade na origem.
FAIXA_LITRO = (0.5, 30.0)


def conferir_combustiveis(c, ultimo_glp):
    """Painel de combustíveis: a mesma planilha do botijão, sem mês faltando, ausência como null, médias dentro do
    intervalo da pesquisa e a identidade da própria ANP (postos do Brasil = soma dos postos das UFs)."""
    ids = [p["id"] for p in c["produtos"]]
    _exige(c["ultimo_mes"] == ultimo_glp, f"combustíveis e botijão com último mês diferente: {c['ultimo_mes']} e {ultimo_glp}")
    meses = [x["mes"] for x in c["serie"]]
    _exige(meses == c["serie_uf"]["meses"], "combustíveis: meses da série Brasil e da série por UF diferentes")
    _exige(meses[0] == c["primeiro_mes"] and meses[-1] == c["ultimo_mes"], "combustíveis: série sem o primeiro ou o último mês")
    for a, b in zip(meses, meses[1:]):
        ano, mes = (int(v) for v in a.split("-"))
        _exige(b == (f"{ano + 1:04d}-01" if mes == 12 else f"{ano:04d}-{mes + 1:02d}"), f"combustíveis: mês faltando depois de {a}")
    for x in c["serie"]:
        valores = [x[f"{pid}{suf}"] for pid in ids for suf in ("", "_minimo", "_maximo", "_postos", "_real")]
        if x["situacao"] in ("sem_pesquisa", "sem_dado"):
            _exige(all(v is None for v in valores), f"combustíveis: mês sem pesquisa com valor em {x['mes']}")
        else:
            _exige(all(x[pid] is not None for pid in ids), f"combustíveis: produto sem preço Brasil em {x['mes']}")
        for pid in ids:
            v, mn, mx = x[pid], x[f"{pid}_minimo"], x[f"{pid}_maximo"]
            if v is None:
                continue
            _exige(FAIXA_LITRO[0] < v < FAIXA_LITRO[1], f"combustíveis: {pid} fora da faixa em {x['mes']}: {v}")
            if mn is not None and mx is not None:
                _exige(mn <= v <= mx, f"combustíveis: {pid} com média fora do intervalo em {x['mes']}")
            _exige(x[f"{pid}_postos"] is None or x[f"{pid}_postos"] > 0, f"combustíveis: {pid} com zero postos em {x['mes']}")
    _exige(c["ultimo_mes"] not in c["pesquisa"]["meses_sem_pesquisa"], "combustíveis: último mês sem pesquisa")
    # a lacuna que a planilha anuncia aparece como lacuna: nenhum mês dela inteiro com valor
    for e in c["pesquisa"]["eventos"]:
        if e["tipo"] == "sem_pesquisa":
            for m in e["meses"][1:-1]:
                _exige(m in c["pesquisa"]["meses_sem_pesquisa"], f"combustíveis: {m} dentro da lacuna da pesquisa com valor publicado")
    _exige(len(c["por_uf"]) == 27, "combustíveis: tabela por UF sem as 27 UFs")
    ultimo = c["serie"][-1]
    for pid in ids:
        com = [l[pid] for l in c["por_uf"] if l[pid]]
        _exige(len(com) >= 20, f"combustíveis: {pid} com preço em só {len(com)} UFs no último mês")
        for u in com:
            _exige(FAIXA_LITRO[0] < u["medio"] < FAIXA_LITRO[1], f"combustíveis: {pid} fora da faixa numa UF")
            if u["minimo"] is not None and u["maximo"] is not None:
                _exige(u["minimo"] <= u["medio"] <= u["maximo"], f"combustíveis: {pid} com média fora do intervalo numa UF")
            _exige(abs(u["dif_brasil"] - (u["medio"] - ultimo[pid])) < 0.002, f"combustíveis: diferença para o Brasil não confere ({pid})")
        conf = next(x for x in c["pesquisa"]["conferencia_ultimo_mes"] if x["produto"] == pid)
        _exige(conf["postos_brasil"] == conf["soma_postos_ufs"], f"combustíveis: postos do Brasil diferem da soma das UFs ({pid})")
        _exige(c["indicadores"][f"{pid}_ufs_mes"]["valor"] == len(com), f"combustíveis: contagem de UFs não confere ({pid})")
    # a identidade "soma dos postos das UFs = total do Brasil", afirmada na página para toda a série, vale em todos os meses
    cp = c["pesquisa"]["conferencia_postos"]
    _exige(cp["meses_produtos_conferidos"] > 0, "combustíveis: nenhuma conferência de postos")
    _exige(not cp["divergencias"], f"combustíveis: postos do Brasil diferem da soma das UFs em {cp['divergencias'][:3]}")
    for l in c["por_uf"]:
        if l["etanol_gasolina_pct"] is not None:
            _exige(0 < l["etanol_gasolina_pct"] < 200, f"combustíveis: razão etanol/gasolina fora de faixa em {l['uf']}")
        else:
            _exige(not (l["etanol"] and l["gasolina"]), f"combustíveis: razão ausente com os dois preços em {l['uf']}")
