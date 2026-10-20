"""Validações que retêm a publicação do IPCA por área.

Cada função devolve a lista de problemas encontrados (vazia quando está tudo certo). A construção da gold
para na primeira lista não vazia (o motor de atualização registra "reconstrução falhou" e mantém no ar a
publicação anterior), e os testes do pipeline rodam as mesmas funções sobre o seed versionado.

O que reprova:
- área a mais ou a menos que as 16 de abrangência e o Brasil, ou categoria (índice geral e nove grupos)
  faltando numa área;
- mês faltando: a lista de meses tem de ser contínua desde janeiro de 2020 e terminar no último período
  da tabela; nenhum valor pode faltar fora da ausência conhecida (12 meses de jan a nov de 2020);
- pesos que não somam 100 por área e mês (nove grupos; e subitens no último mês);
- variação fora da faixa plausível (fontes.FAIXA);
- variação em 12 meses publicada que não confere com o encadeamento das 12 variações mensais;
- contribuições dos grupos que não somam a variação em 12 meses do índice geral.
"""
from __future__ import annotations

from . import fontes as F


def _num(x) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def mes_seguinte(m: str) -> str:
    a, mm = int(m[:4]), int(m[4:])
    return f"{a + (mm == 12)}{1 if mm == 12 else mm + 1:02d}"


def validar_estrutura(seed: dict) -> list[str]:
    p: list[str] = []
    meses = seed.get("meses") or []
    if not meses:
        return ["seed sem meses"]
    if meses[0] != F.PRIMEIRO_MES:
        p.append(f"série começa em {meses[0]}, esperado {F.PRIMEIRO_MES}")
    for a, b in zip(meses, meses[1:]):
        if b != mes_seguinte(a):
            p.append(f"mês faltando entre {a} e {b}")
    periodos = [x["id"] for x in seed.get("periodos", [])]
    if periodos and periodos[-1] != meses[-1]:
        p.append(f"último período da tabela ({periodos[-1]}) diferente do último mês com valores ({meses[-1]})")
    if set(periodos) != set(meses):
        p.append("períodos da tabela e meses com valores não coincidem")
    areas = set(seed.get("grupos", {}))
    if areas != set(F.IDS_AREAS):
        faltam, sobram = sorted(set(F.IDS_AREAS) - areas), sorted(areas - set(F.IDS_AREAS))
        p.append(f"áreas diferentes das 16 e do Brasil (faltam {faltam}, sobram {sobram})")
    nomes = seed.get("areas_fonte", {})
    for cod, curto, _uf, _tipo, _rot in F.AREAS:
        n = nomes.get(cod)
        if n is not None and not n.startswith(curto):
            p.append(f"área {cod} chamada '{n}' na fonte, esperado '{curto}'")
    cats = seed.get("categorias", {})
    for gid, _n, nome in F.GRUPOS:
        if gid not in cats or cats[gid].get("nivel") != 1 or not cats[gid]["nome"].endswith(nome):
            p.append(f"grupo {gid} ({nome}) ausente ou renomeado na classificação 315")
    if F.GERAL not in cats or cats[F.GERAL].get("nivel") != 0:
        p.append("índice geral ausente na classificação 315")
    esperadas = [F.GERAL, *F.IDS_GRUPOS]
    for a, pora in seed.get("grupos", {}).items():
        for c in esperadas:
            if c not in pora:
                p.append(f"área {a}: categoria {c} ausente")
                continue
            for v in F.VARIAVEIS:
                serie = pora[c].get(v)
                if serie is None or len(serie) != len(meses):
                    p.append(f"área {a}, categoria {c}, variável {v}: série incompleta")
                    continue
                for m, x in zip(meses, serie):
                    if x == "ausente":
                        p.append(f"área {a}, categoria {c}, variável {v}: mês {m} faltando")
                    elif x is None and not (v == F.V_DOZE and m in F.SEM_DOZE_MESES):
                        p.append(f"área {a}, categoria {c}, variável {v}: mês {m} sem valor ('...')")
                    elif x == "-" or (x is not None and not _num(x)):
                        p.append(f"área {a}, categoria {c}, variável {v}: valor {x!r} em {m}")
    return p


def validar_pesos(seed: dict) -> list[str]:
    p: list[str] = []
    meses = seed["meses"]
    for a, pora in seed["grupos"].items():
        geral = pora[F.GERAL][F.V_PESO]
        for i, m in enumerate(meses):
            soma = sum(pora[g][F.V_PESO][i] for g in F.IDS_GRUPOS if _num(pora[g][F.V_PESO][i]))
            if abs(soma - 100) > F.TOL_PESOS:
                p.append(f"área {a}, {m}: pesos dos nove grupos somam {soma:.4f}, não 100")
            if _num(geral[i]) and abs(geral[i] - 100) > F.TOL_PESOS:
                p.append(f"área {a}, {m}: peso do índice geral {geral[i]}, não 100")
    sub = seed["subitens"]
    for a, porc in sub["valores"].items():
        for k, nome in ((1, "início da janela"), (2, "último mês")):
            soma = sum(x[k] for x in porc.values() if _num(x[k]))
            # 377 pesos publicados com 4 casas: o arredondamento acumula até cerca de 0,02
            if abs(soma - 100) > 5 * F.TOL_PESOS:
                p.append(f"área {a}: pesos dos subitens no {nome} somam {soma:.4f}, não 100")
    return p


def validar_faixas(seed: dict) -> list[str]:
    p: list[str] = []
    meses = seed["meses"]
    for a, pora in seed["grupos"].items():
        for c, porv in pora.items():
            tipo = "geral" if c == F.GERAL else "grupo"
            for v, chave in ((F.V_MENSAL, "mensal"), (F.V_DOZE, "doze")):
                lo, hi = F.FAIXA[f"{tipo}_{chave}"]
                for m, x in zip(meses, porv[v]):
                    if _num(x) and not lo <= x <= hi:
                        p.append(f"área {a}, categoria {c}, {m}: variação {chave} de {x}% fora da faixa plausível [{lo}; {hi}]")
    lo, hi = F.FAIXA["subitem_doze"]
    for a, porc in seed["subitens"]["valores"].items():
        for c, x in porc.items():
            if _num(x[0]) and not lo <= x[0] <= hi:
                p.append(f"área {a}, subitem {c}: variação em 12 meses de {x[0]}% fora da faixa plausível [{lo}; {hi}]")
    return p


def validar_subitens(seed: dict) -> list[str]:
    p: list[str] = []
    sub = seed["subitens"]
    meses = seed["meses"]
    if sub.get("ultimo") != meses[-1]:
        p.append(f"subitens do mês {sub.get('ultimo')}, mas o último mês é {meses[-1]}")
    if len(meses) >= 12 and sub.get("inicio") != meses[-12]:
        p.append(f"janela dos subitens começa em {sub.get('inicio')}, esperado {meses[-12]}")
    if set(sub["valores"]) != set(F.IDS_AREAS):
        p.append("subitens sem as 16 áreas e o Brasil")
    nivel4 = {k for k, c in seed["categorias"].items() if c["nivel"] == 4}
    for a, porc in sub["valores"].items():
        if set(porc) != nivel4:
            p.append(f"área {a}: subitens diferentes dos da classificação ({len(porc)} de {len(nivel4)})")
        for c, x in porc.items():
            if "ausente" in x:
                p.append(f"área {a}, subitem {c}: valor faltando")
            elif any(v == "-" for v in x) and not all(v == "-" for v in x):
                # fora da cesta é "-" no peso e na variação; misturado indica outra coisa
                p.append(f"área {a}, subitem {c}: '-' só em parte dos campos {x}")
            elif any(v is None for v in x):
                p.append(f"área {a}, subitem {c}: valor não disponível ('...')")
    return p


def validar_encadeamento(seed: dict) -> list[str]:
    """A variação em 12 meses publicada confere com o produto das 12 variações mensais publicadas."""
    p: list[str] = []
    meses = seed["meses"]
    for a, pora in seed["grupos"].items():
        for c, porv in pora.items():
            mensal, doze = porv[F.V_MENSAL], porv[F.V_DOZE]
            for i in range(11, len(meses)):
                if not _num(doze[i]) or not all(_num(x) for x in mensal[i - 11 : i + 1]):
                    continue
                prod = 1.0
                for x in mensal[i - 11 : i + 1]:
                    prod *= 1 + x / 100
                if abs((prod - 1) * 100 - doze[i]) > F.TOL_ENCADEAMENTO:
                    p.append(f"área {a}, categoria {c}, {meses[i]}: 12 meses publicado {doze[i]}% e encadeado {(prod - 1) * 100:.2f}%")
    return p


def contribuicoes(seed: dict, area: str) -> tuple[dict[str, float], float]:
    """Contribuição de cada grupo para a variação em 12 meses do índice geral, em pontos percentuais.

    peso do grupo no primeiro mês da janela × variação do grupo em 12 meses ÷ 100. O IPCA é um índice de
    Laspeyres cujos pesos acompanham os preços relativos; por isso a soma reproduz o índice geral, com a
    diferença do arredondamento das variações (2 casas) e dos pesos (4 casas).
    """
    pora = seed["grupos"][area]
    i, i0 = len(seed["meses"]) - 1, len(seed["meses"]) - 12
    c = {g: pora[g][F.V_PESO][i0] * pora[g][F.V_DOZE][i] / 100 for g in F.IDS_GRUPOS}
    return c, sum(c.values())


def validar_contribuicoes(seed: dict) -> list[str]:
    p: list[str] = []
    if len(seed["meses"]) < 12:
        return ["menos de 12 meses na série"]
    i = len(seed["meses"]) - 1
    for a in seed["grupos"]:
        try:
            _, soma = contribuicoes(seed, a)
        except TypeError:
            p.append(f"área {a}: peso ou variação ausente para a contribuição")
            continue
        geral = seed["grupos"][a][F.GERAL][F.V_DOZE][i]
        if abs(soma - geral) > F.TOL_CONTRIBUICOES:
            p.append(f"área {a}: contribuições dos grupos somam {soma:.3f} p.p., índice geral {geral}%")
        sub = [x for x in seed["subitens"]["valores"][a].values() if _num(x[0]) and _num(x[1])]
        soma_sub = sum(x[1] * x[0] / 100 for x in sub)
        if abs(soma_sub - geral) > 2 * F.TOL_CONTRIBUICOES:
            p.append(f"área {a}: contribuições dos subitens somam {soma_sub:.3f} p.p., índice geral {geral}%")
    return p


def validar_seed(seed: dict) -> list[str]:
    estrutura = validar_estrutura(seed)
    if estrutura:
        return estrutura
    subitens = validar_subitens(seed)
    if subitens:
        return subitens
    return validar_pesos(seed) + validar_faixas(seed) + validar_encadeamento(seed) + validar_contribuicoes(seed)
