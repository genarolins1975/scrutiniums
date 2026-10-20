"""Validações que retêm a publicação do painel Segurança pública por UF.

Cada função devolve a lista de problemas (vazia quando está tudo certo). A coleta de uma fonte que reprova
não substitui o seed anterior; a construção da gold para na primeira lista não vazia (o motor de atualização
registra "reconstrução falhou" e mantém no ar a publicação anterior). Os testes do pipeline rodam as mesmas
funções sobre os seeds versionados.

O que reprova:
- Sinesp VDE: ano faltando na sequência desde 2015; ano completo com menos de 12 meses (só o último pode
  ser parcial); UF a mais ou a menos que as 27; evento do painel ausente ou renomeado na planilha; valor
  negativo ou não numérico; total nacional de homicídio doloso fora da faixa plausível; revisão de um ano
  completo que mude o total nacional de homicídio doloso em mais de 10% em relação ao seed publicado; coleta
  que volta no tempo (menos anos completos que o seed publicado).
- SIM: ano faltando; ano sem situação (final ou preliminar); consulta, UF ou ano faltando; total da
  tabela diferente da soma das UFs e do "Ignorado/exterior"; agressões fora da faixa plausível; agressões
  contra mulheres acima das agressões, ou agressões e indeterminadas acima de todas as causas externas;
  último ano final recuando; revisão de ano final acima de 10%.
- IBGE: UF ou ano faltando; soma das UFs diferente do Brasil; homens e mulheres que não somam o total;
  população do Brasil fora da faixa plausível.
- Conjunto: população sem algum ano usado pelo Sinesp ou pelo SIM.
"""
from __future__ import annotations

from . import fontes as F


def _num(x) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def anos_completos_vde(seed: dict) -> list[int]:
    return sorted(int(a) for a, f in seed.get("arquivos", {}).items() if f.get("meses") == 12)


def total_nacional(seed: dict, evento: str, ano: int) -> float:
    return sum(sum(x for x in arr if _num(x)) for arr in seed["valores"][str(ano)][evento].values())


def validar_vde(seed: dict, anterior: dict | None = None) -> list[str]:
    p: list[str] = []
    arquivos = seed.get("arquivos") or {}
    if not arquivos:
        return ["seed do Sinesp VDE sem arquivos"]
    anos = sorted(int(a) for a in arquivos)
    if anos[0] != F.PRIMEIRO_ANO:
        p.append(f"Sinesp VDE começa em {anos[0]}, esperado {F.PRIMEIRO_ANO}")
    for a, b in zip(anos, anos[1:]):
        if b != a + 1:
            p.append(f"Sinesp VDE sem o ano {a + 1}")
    for a in anos:
        f = arquivos[str(a)]
        if f.get("status") != 200 or not f.get("sha256") or not f.get("bytes"):
            p.append(f"planilha {a} sem status 200, sha256 ou tamanho")
        if a != anos[-1] and f.get("meses") != 12:
            p.append(f"planilha {a} com {f.get('meses')} meses; só o último ano pode ser parcial")
        if not 1 <= (f.get("meses") or 0) <= 12:
            p.append(f"planilha {a} sem meses")
        if sorted(f.get("ufs", [])) != sorted(F.SIGLAS):
            faltam = sorted(set(F.SIGLAS) - set(f.get("ufs", [])))
            sobram = sorted(set(f.get("ufs", [])) - set(F.SIGLAS))
            p.append(f"planilha {a}: UFs diferentes das 27 (faltam {faltam}, sobram {sobram})")
        if F.ABRANGENCIA not in f.get("abrangencias", []):
            p.append(f"planilha {a} sem a abrangência {F.ABRANGENCIA}")
        for e in F.EVENTOS:
            if e[1] not in f.get("eventos", []):
                p.append(f"planilha {a}: evento '{e[1]}' ausente ou renomeado")
        vals = seed.get("valores", {}).get(str(a))
        if not vals:
            p.append(f"planilha {a} sem valores")
            continue
        for eid in F.IDS_EVENTOS:
            porf = vals.get(eid)
            if porf is None:
                p.append(f"{a}: evento {eid} sem valores")
                continue
            for uf in F.SIGLAS:
                arr = porf.get(uf)
                if arr is None or len(arr) != f.get("meses"):
                    p.append(f"{a}, {eid}, {uf}: série mensal com tamanho diferente de {f.get('meses')}")
                    continue
                for m, x in enumerate(arr, 1):
                    if x is not None and (not _num(x) or x < 0):
                        p.append(f"{a}, {eid}, {uf}, mês {m}: valor {x!r}")
    if p:
        return p
    lo, hi = F.FAIXA_HOMICIDIO_BRASIL
    for a in anos_completos_vde(seed):
        t = total_nacional(seed, "homicidio", a)
        if not lo <= t <= hi:
            p.append(f"{a}: homicídio doloso no Brasil soma {t:.0f}, fora da faixa plausível [{lo}; {hi}]")
    if anterior:
        completos_ant = anos_completos_vde(anterior)
        completos = anos_completos_vde(seed)
        if len(completos) < len(completos_ant):
            p.append(f"a coleta tem {len(completos)} anos completos e o seed publicado {len(completos_ant)}: a fonte voltou no tempo")
        for a in set(completos) & set(completos_ant):
            novo, ant = total_nacional(seed, "homicidio", a), total_nacional(anterior, "homicidio", a)
            if ant and abs(novo - ant) / ant > F.REVISAO_MAXIMA:
                p.append(f"{a}: homicídio doloso no Brasil passou de {ant:.0f} para {novo:.0f}, revisão acima de {F.REVISAO_MAXIMA:.0%}")
    return p


def validar_sim(seed: dict, anterior: dict | None = None) -> list[str]:
    p: list[str] = []
    anos = seed.get("anos") or []
    if not anos:
        return ["seed do SIM sem anos"]
    if anos[0] != F.PRIMEIRO_ANO or anos != list(range(anos[0], anos[-1] + 1)):
        p.append(f"anos do SIM não contínuos desde {F.PRIMEIRO_ANO}: {anos}")
    sit = seed.get("situacao", {})
    for a in anos:
        if sit.get(str(a)) not in ("final", "preliminar"):
            p.append(f"SIM {a} sem situação final ou preliminar")
    final_ate = seed.get("notas", {}).get("final_ate")
    if not isinstance(final_ate, int) or final_ate < F.PRIMEIRO_ANO:
        p.append("SIM sem o último ano de dados finais")
    cons = seed.get("consultas", {})
    for cid, *_ in F.CONSULTAS_SIM:
        c = cons.get(cid)
        if not c:
            p.append(f"SIM sem a consulta {cid}")
            continue
        if sorted(c.get("ufs", {})) != sorted(F.SIGLAS):
            p.append(f"SIM {cid}: UFs diferentes das 27")
            continue
        for a in map(str, anos):
            soma = 0
            for uf in F.SIGLAS:
                x = c["ufs"][uf].get(a)
                if not isinstance(x, int) or x < 0:
                    p.append(f"SIM {cid}, {uf}, {a}: valor {x!r}")
                else:
                    soma += x
            soma += sum(v.get(a, 0) for v in c.get("outras", {}).values())
            if c.get("total") is None or c["total"].get(a) != soma:
                p.append(f"SIM {cid}, {a}: total da tabela {c.get('total', {}).get(a) if c.get('total') else None} diferente da soma {soma}")
    if p:
        return p
    lo, hi = F.FAIXA_AGRESSOES_BRASIL
    for a in map(str, anos):
        t = cons["agressoes"]["total"][a]
        if not lo <= t <= hi:
            p.append(f"SIM {a}: {t} óbitos por agressão no Brasil, fora da faixa plausível [{lo}; {hi}]")
        for uf in F.SIGLAS:
            ag, mu = cons["agressoes"]["ufs"][uf][a], cons["agressoes_mulheres"]["ufs"][uf][a]
            ind, ext = cons["indeterminadas"]["ufs"][uf][a], cons["externas"]["ufs"][uf][a]
            if mu > ag:
                p.append(f"SIM {uf} {a}: agressões contra mulheres ({mu}) acima do total de agressões ({ag})")
            if ag + ind > ext:
                p.append(f"SIM {uf} {a}: agressões e indeterminadas ({ag + ind}) acima das causas externas ({ext})")
    if anterior:
        fa = anterior.get("notas", {}).get("final_ate")
        if isinstance(fa, int) and isinstance(final_ate, int) and final_ate < fa:
            p.append(f"o último ano final do SIM recuou de {fa} para {final_ate}")
        for a, s in anterior.get("situacao", {}).items():
            if s == "final" and seed.get("situacao", {}).get(a) == "final":
                ant = anterior["consultas"]["agressoes"]["total"].get(a)
                novo = cons["agressoes"]["total"].get(a)
                if ant and novo is not None and abs(novo - ant) / ant > F.REVISAO_MAXIMA:
                    p.append(f"SIM {a} (final): óbitos por agressão passaram de {ant} para {novo}")
    return p


def validar_ibge(seed: dict, anterior: dict | None = None) -> list[str]:
    p: list[str] = []
    anos = [str(a) for a in seed.get("anos") or []]
    if not anos or int(anos[0]) != F.PRIMEIRO_ANO:
        return [f"população sem os anos desde {F.PRIMEIRO_ANO}"]
    pop = seed.get("populacao", {})
    if sorted(pop) != sorted([F.BRASIL, *F.SIGLAS]):
        return ["população sem as 27 UFs e o Brasil"]
    for a in anos:
        for chave in ("total", "mulheres", "homens"):
            vals = [pop[uf][chave].get(a) for uf in F.SIGLAS]
            if any(not isinstance(v, int) or v <= 0 for v in vals):
                p.append(f"população {chave} {a}: valor ausente ou não positivo")
                continue
            if sum(vals) != pop[F.BRASIL][chave].get(a):
                p.append(f"população {chave} {a}: soma das UFs {sum(vals)} diferente do Brasil {pop[F.BRASIL][chave].get(a)}")
        for uf in [F.BRASIL, *F.SIGLAS]:
            if pop[uf]["mulheres"].get(a, 0) + pop[uf]["homens"].get(a, 0) != pop[uf]["total"].get(a):
                p.append(f"população {uf} {a}: homens e mulheres não somam o total")
        lo, hi = F.FAIXA_POP_BRASIL
        if not lo <= (pop[F.BRASIL]["total"].get(a) or 0) <= hi:
            p.append(f"população do Brasil em {a} fora da faixa plausível")
    return p


def validar_siconfi(seed: dict, anterior: dict | None = None) -> list[str]:
    p: list[str] = []
    anos = seed.get("anos") or []
    if not anos or anos[0] != F.PRIMEIRO_ANO or anos != list(range(anos[0], anos[-1] + 1)):
        return [f"Siconfi sem anos contínuos desde {F.PRIMEIRO_ANO}"]
    vals = seed.get("valores", {})
    if sorted(vals) != sorted(F.SIGLAS):
        return ["Siconfi sem as 27 UFs"]
    lo, hi = F.FAIXA_PARTICIPACAO
    for a in map(str, anos):
        com = 0
        for uf in F.SIGLAS:
            d = vals[uf].get(a)
            if d is None:
                p.append(f"Siconfi {uf} {a}: ano ausente do seed")
                continue
            s, t = d.get("seguranca"), d.get("total")
            if s is None:
                continue
            com += 1
            if not _num(s) or not _num(t) or s <= 0 or t <= 0:
                p.append(f"Siconfi {uf} {a}: despesa {s!r} ou total {t!r} inválidos")
            elif not lo <= s / t * 100 <= hi:
                p.append(f"Siconfi {uf} {a}: segurança pública é {s / t * 100:.1f}% da despesa, fora da faixa plausível [{lo}; {hi}]")
        if com < 20:
            p.append(f"Siconfi {a}: só {com} UFs com a função 06 na DCA")
    if anterior and not p:
        for a in map(str, anos):
            comuns = [uf for uf in F.SIGLAS if (anterior.get("valores", {}).get(uf, {}).get(a) or {}).get("seguranca") and vals[uf][a]["seguranca"]]
            ant = sum(anterior["valores"][uf][a]["seguranca"] for uf in comuns)
            novo = sum(vals[uf][a]["seguranca"] for uf in comuns)
            if ant and abs(novo - ant) / ant > F.REVISAO_MAXIMA:
                p.append(f"Siconfi {a}: a despesa das UFs em comum passou de {ant:,.0f} para {novo:,.0f}, revisão acima de {F.REVISAO_MAXIMA:.0%}")
    return p


def validar_seeds(seeds: dict) -> list[str]:
    p = validar_vde(seeds["sinesp"]) + validar_sim(seeds["sim"]) + validar_ibge(seeds["ibge"]) + validar_siconfi(seeds["siconfi"])
    if p:
        return p
    anos_pop = set(seeds["ibge"]["anos"])
    usados = set(anos_completos_vde(seeds["sinesp"])) | set(seeds["sim"]["anos"]) | set(seeds["siconfi"]["anos"])
    faltam = sorted(usados - anos_pop)
    if faltam:
        p.append(f"população sem os anos {faltam}, usados pelo Sinesp, pelo SIM ou pelo Siconfi")
        return p
    lo, hi = F.FAIXA_POR_HABITANTE
    for uf in F.SIGLAS:
        for a in map(str, seeds["siconfi"]["anos"]):
            s = seeds["siconfi"]["valores"][uf][a]["seguranca"]
            if s is not None and not lo <= s / seeds["ibge"]["populacao"][uf]["total"][a] <= hi:
                p.append(f"Siconfi {uf} {a}: R$ {s / seeds['ibge']['populacao'][uf]['total'][a]:.2f} por habitante, fora da faixa plausível [{lo}; {hi}]")
    return p
