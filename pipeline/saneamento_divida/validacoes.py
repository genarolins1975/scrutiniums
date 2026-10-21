"""Validações que retêm a publicação do capítulo 7.1.

Cada função devolve a lista de problemas (vazia quando está tudo certo). A gold só é gravada com a lista vazia; o motor
de atualização mantém no ar a publicação anterior e abre a issue. Os testes do pipeline rodam as mesmas funções sobre
o seed versionado e sobre casos sintéticos.

O que reprova:
- seed: arquivo com sha256 diferente do manifesto;
- universo: menos companhias que o mínimo, companhia esperada fora do universo ou sem a DFP mais recente da base, ou
  universo diferente do que os seeds do SINISA, do FRE e do cadastro produzem hoje;
- em cada demonstração usada como ponto da série (consolidada, ou individual quando não há consolidada):
  - balanço que não fecha: ativo total diferente do passivo total, ou passivo total diferente da soma de circulante,
    não circulante e patrimônio líquido;
  - dívida que não soma: linha de empréstimos e financiamentos (2.01.04 ou 2.02.01) diferente da soma das subcontas
    publicadas (empréstimos, debêntures e arrendamento), quando a companhia abre a linha;
  - conta obrigatória ausente, ativo, caixa, aplicações ou dívida bruta negativos;
  - depreciação com sinal trocado na demonstração do valor adicionado (retenção positiva);
  - resultado que termina em data diferente da data de referência do balanço;
  salvo as inconsistências da própria companhia já conferidas e listadas em fontes.INCONSISTENCIAS_CONHECIDAS, que
  tiram o ponto da série com o motivo;
- indicadores: dívida líquida que não é dívida bruta menos caixa, parcela de curto prazo fora de 0 a 100%, indicador
  ausente sem motivo.
"""
from __future__ import annotations

from . import fontes as F

Problema = tuple[str, str]  # (tipo, mensagem)


def _tol(r: dict, total: float) -> float:
    unid = 1.0 if r["escala"] == "MIL" else 0.001
    return max(F.TOLERANCIA_ESCALA * unid, abs(total) * F.TOLERANCIA_RELATIVA)


def mil(v: float) -> str:
    """Milhares de reais em R$ milhões com uma casa, no padrão brasileiro (para mensagens e motivos)."""
    s = f"{v / 1000:,.1f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {s} milhões"


def validar_bloco(chave: tuple, r: dict) -> list[Problema]:
    """Conferências contábeis de uma demonstração (balanço e resultado de uma companhia numa data, num escopo)."""
    _cnpj, fonte, data, _esc = chave
    p: list[Problema] = []
    b = r["bal"]
    for c in ("1", "1.01", "1.01.01", "1.01.02", "1.02", "2", "2.01", "2.02", "2.03", "2.01.04", "2.02.01"):
        if b.get(c) is None:
            p.append(("conta_ausente", f"conta {c} ausente no balanço publicado"))
    if p:
        return p
    tol = _tol(r, b["1"])
    if abs(b["1"] - b["2"]) > tol:
        p.append(("ativo_passivo", f"ativo total ({mil(b['1'])}) diferente do passivo total ({mil(b['2'])})"))
    grupos = b["2.01"] + b["2.02"] + b["2.03"]
    if abs(b["2"] - grupos) > tol:
        p.append(("passivo", f"passivo total ({mil(b['2'])}) diferente da soma de circulante, não circulante e patrimônio líquido ({mil(grupos)})"))
    for pai, prazo in (("2.01.04", "circulante"), ("2.02.01", "não circulante")):
        filhos = [b.get(f"{pai}.0{i}") for i in (1, 2, 3)]
        if all(not f for f in filhos):
            continue  # a companhia não abriu a linha nas subcontas: vale a linha total, marcada
        soma = sum(f or 0.0 for f in filhos)
        if abs(b[pai] - soma) > _tol(r, b[pai]):
            p.append(("divida_subcontas", f"empréstimos e financiamentos do {prazo} ({mil(b[pai])}) diferentes da soma das subcontas publicadas ({mil(soma)})"))
    for c, rot in (("1", "ativo total"), ("1.01.01", "caixa e equivalentes"), ("1.01.02", "aplicações financeiras")):
        if b[c] < -tol:
            p.append(("negativo", f"{rot} negativo ({mil(b[c])})"))
    if b["2.01.04"] + b["2.02.01"] < -tol:
        p.append(("negativo", "dívida bruta negativa"))
    if 0 <= b["1"] < F.ATIVO_MINIMO_MIL:  # agrupar() já converteu para milhares de reais
        p.append(("escala", f"ativo total de {mil(b['1'])}, abaixo do mínimo plausível para uma prestadora com demonstrações na CVM ({mil(F.ATIVO_MINIMO_MIL)}); a escala declarada ({'milhares de reais' if r['escala'] == 'MIL' else 'unidade de real'}) pode estar trocada"))
    for (ordem, ini), res in r["res"].items():
        da = res.get("7.04.01")
        if da is not None and da > _tol(r, da):
            p.append(("depreciacao_sinal", f"depreciação da DVA com sinal positivo ({ordem}, desde {ini})"))
    for k, fim in r["fim"].items():
        if k != "bal" and k[0] == "ÚLTIMO" and fim != data:
            p.append(("exercicio", f"resultado terminado em {fim}, diferente da data de referência {data}"))
    return p


def aceito(chave: tuple, problemas: list[Problema]) -> bool:
    """Problemas da própria companhia já conferidos (fontes.INCONSISTENCIAS_CONHECIDAS)."""
    conhecidos = F.INCONSISTENCIAS_CONHECIDAS.get(chave[:3], set())
    return bool(problemas) and all(t in conhecidos for t, _m in problemas)


def validar_universo(universo: list[dict], recalculado: list[dict], g: dict) -> list[str]:
    p: list[str] = []
    cnpjs = {u["cnpj"] for u in universo}
    if len(cnpjs) < F.UNIVERSO_MINIMO:
        p.append(f"universo com {len(cnpjs)} companhias, abaixo do mínimo de {F.UNIVERSO_MINIMO}")
    if universo != recalculado:
        p.append("universo do manifesto diferente do que os seeds do SINISA, do FRE e do cadastro produzem: recolete")
    ultima = ultima_dfp(g, cnpjs)
    if ultima is None:
        return p + ["nenhuma DFP com ao menos metade do universo"]
    com_ultima = {k[0] for k in g if k[1] == "DFP" and k[2] == ultima}
    for c in F.ESPERADAS:
        if c not in cnpjs:
            p.append(f"companhia esperada fora do universo: {F.NOME_CURTO.get(c, c)} ({c})")
        elif c not in com_ultima:
            p.append(f"companhia esperada sem a DFP de {ultima[:4]}: {F.NOME_CURTO.get(c, c)} ({c})")
    return p


def ultima_dfp(g: dict, cnpjs: set[str]) -> str | None:
    """DFP mais recente da base: a data de 31 de dezembro mais nova em que ao menos metade do universo publicou."""
    datas = sorted({k[2] for k in g if k[1] == "DFP" and k[2].endswith("-12-31")})
    ok = [d for d in datas if len({k[0] for k in g if k[1] == "DFP" and k[2] == d}) * 2 >= len(cnpjs)]
    return ok[-1] if ok else None


def validar_pontos(companhias: list[dict]) -> list[str]:
    """Conferências sobre os indicadores calculados (consistência interna)."""
    p: list[str] = []
    for c in companhias:
        for serie in ("anual", "trimestral"):
            for x in c[serie]:
                if x.get("retido"):
                    continue
                nome = f"{c['nome']} {x['periodo']}"
                if x["divida_bruta"] is not None and x["divida_bruta"] < 0:
                    p.append(f"{nome}: dívida bruta negativa")
                if None not in (x["divida_bruta"], x["caixa"], x["divida_liquida"]) and abs(x["divida_bruta"] - x["caixa"] - x["divida_liquida"]) > 0.01:
                    p.append(f"{nome}: dívida líquida não confere")
                if x["parcela_cp"] is not None and not (0 <= x["parcela_cp"] <= 100.0001):
                    p.append(f"{nome}: parcela de curto prazo fora de 0 a 100%")
                for campo in ("ebitda", "dl_ebitda", "dl_pl", "parcela_cp", "cobertura"):
                    if x[campo] is None and campo not in x["motivos"]:
                        p.append(f"{nome}: {campo} ausente sem motivo")
    return p
