"""Validações que retêm a publicação do painel Educação nos municípios.

Cada função devolve a lista de problemas (vazia quando está tudo certo). A coleta não grava o seed se a lista não vier
vazia; a construção da gold roda as mesmas funções e a conferência cruzada, e não grava nada se reprovar (o motor de
atualização mantém no ar a publicação anterior). Os testes do pipeline rodam as mesmas funções sobre os seeds
versionados.

O que reprova:
- Ideb: anos fora da sequência bienal desde 2005, metas fora de 2007 a 2021, município com código que não é de UF ou
  com UF trocada, número de municípios fora da faixa, medida fora da faixa plausível, Ideb publicado sem N ou sem P, Ideb
  diferente de N × P (a conta que prova a posição de cada coluna), marca do Saeb desconhecida, contagem de municípios com
  Ideb diferente do Quadro 1 da nota informativa da edição, UF faltando, Brasil sem a rede municipal ou a pública, mais
  de dois códigos de coluna divergentes num arquivo (desenho trocado), edição mais velha que a publicada e, na recoleta da
  mesma edição, Ideb revisto acima do limite ou publicado que desaparece;
- Censo Escolar: campos fora do contrato, contagem ausente ou negativa, municípios que não somam a UF, UFs que não somam o
  Brasil, total diferente de pública mais privada, pública diferente de federal, estadual e municipal, parte maior que o
  todo (rede municipal maior que a pública, escola rural maior que o total), edição mais velha que a publicada;
- população: municípios fora da faixa, valor não positivo, soma diferente do Brasil;
- cruzada: município do Ideb ou do Censo sem população (sem porte), município do Ideb fora do Censo, rede com Ideb na etapa
  e nenhuma matrícula nela no Censo da mesma edição.
"""
from __future__ import annotations

from . import fontes as F


def _num(x) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def _linha(nome: str, r: dict, anos: list[int], anos_meta: list[int]) -> list[str]:
    p: list[str] = []
    for campo in F.CAMPOS:
        v = r.get(campo)
        if not isinstance(v, list) or len(v) != len(anos):
            return [f"{nome}: {campo} sem um valor por ano"]
        lo, hi = F.FAIXA[campo]
        for a, x in zip(anos, v):
            if x is not None and (not _num(x) or not lo <= x <= hi):
                p.append(f"{nome}, {a}: {campo} fora da faixa ({x})")
    if len(r.get("marca_saeb") or []) != len(anos) or any(m is not None and m not in F.MARCAS_SAEB for m in r["marca_saeb"]):
        p.append(f"{nome}: marca do Saeb fora da lista")
    if len(r.get("meta") or []) != len(anos_meta):
        p.append(f"{nome}: meta sem um valor por ano do primeiro ciclo")
    for k, a in enumerate(anos):
        i, n, pp = r["ideb"][k], r["n"][k], r["p"][k]
        if i is None:
            continue
        if n is None or pp is None:
            p.append(f"{nome}, {a}: Ideb publicado sem N ou sem P")
        elif abs(i - n * pp) > F.TOLERANCIA_IDEB:
            p.append(f"{nome}, {a}: Ideb {i} difere de N × P ({n * pp:.3f})")
    return p


def validar_ideb(seed: dict, anterior: dict | None = None) -> list[str]:
    p: list[str] = []
    ano = seed.get("ano")
    anos = seed.get("anos") or []
    if not isinstance(ano, int) or not anos or anos[-1] != ano:
        return ["Ideb sem edição ou com anos que não terminam nela"]
    if anos != list(range(2005, ano + 1, 2)):
        p.append(f"anos do Ideb fora da sequência bienal desde 2005: {anos}")
    if seed.get("anos_meta") != list(range(2007, 2022, 2)):
        p.append(f"metas fora do primeiro ciclo (2007 a 2021): {seed.get('anos_meta')}")
    for arquivo, div in (seed.get("codigos_divergentes") or {}).items():
        if len(div) > 2:
            p.append(f"{arquivo}: {len(div)} códigos de coluna divergentes (o desenho da planilha mudou)")
    k = len(anos) - 1
    for etapa in F.ETAPAS:
        e = (seed.get("etapas") or {}).get(etapa)
        if not e:
            p.append(f"Ideb sem a etapa {etapa}")
            continue
        mun = e.get("municipios") or {}
        if not F.MUNICIPIOS_MIN - 10 <= len(mun) <= F.MUNICIPIOS_MAX:
            p.append(f"{etapa}: {len(mun)} municípios, fora da faixa")
        com = {"municipal": 0, "publica": 0}
        for cod, m in mun.items():
            if len(cod) != 7 or cod[:2] not in F.UF_DO_PREFIXO:
                p.append(f"{etapa}: código {cod} não é de município")
                continue
            if F.UF_DO_PREFIXO[cod[:2]] != m.get("uf"):
                p.append(f"{etapa}, {cod}: UF {m.get('uf')} não confere com o código")
            for rede, r in (m.get("redes") or {}).items():
                if rede not in com:
                    p.append(f"{etapa}, {cod}: rede {rede} fora do contrato")
                    continue
                p.extend(_linha(f"{etapa}, {cod}, {rede}", r, anos, seed["anos_meta"]))
                if r["ideb"][k] is not None:
                    com[rede] += 1
        esperado = F.QUADRO_1.get(ano, {}).get(etapa)
        if esperado and esperado != com:
            p.append(f"{etapa}: municípios com Ideb {ano} {com}, a nota informativa diz {esperado}")
        ufs = e.get("ufs") or {}
        if sorted(ufs) != sorted(F.SIGLAS):
            p.append(f"{etapa}: UFs do Ideb {sorted(set(F.SIGLAS) - set(ufs))} faltando")
        for uf, redes in ufs.items():
            if "publica" not in redes:
                p.append(f"{etapa}, {uf}: sem a rede pública")
            for rede, r in redes.items():
                p.extend(_linha(f"{etapa}, {uf}, {rede}", r, anos, seed["anos_meta"]))
        br = e.get("brasil") or {}
        for rede in ("municipal", "publica"):
            if rede not in br:
                p.append(f"{etapa}: Brasil sem a rede {rede}")
        for rede, r in br.items():
            p.extend(_linha(f"{etapa}, Brasil, {rede}", r, anos, seed["anos_meta"]))
    if anterior:
        if anterior.get("ano", 0) > ano:
            p.append(f"edição {ano} mais velha que a publicada ({anterior['ano']})")
        elif anterior.get("ano") == ano:
            p.extend(_revisao_ideb(seed, anterior))
    return p


def _revisao_ideb(seed: dict, anterior: dict) -> list[str]:
    p: list[str] = []
    for etapa in F.ETAPAS:
        novo = seed["etapas"][etapa]["municipios"]
        for cod, m in anterior["etapas"][etapa]["municipios"].items():
            for rede, r in m["redes"].items():
                rn = (novo.get(cod) or {}).get("redes", {}).get(rede)
                for k, a in enumerate(anterior["anos"]):
                    v0 = r["ideb"][k]
                    if v0 is None:
                        continue
                    v1 = rn["ideb"][k] if rn and k < len(rn["ideb"]) else None
                    if v1 is None:
                        p.append(f"{etapa}, {cod}, {rede}, {a}: Ideb publicado ({v0}) sumiu na recoleta")
                    elif abs(v1 - v0) > F.REVISAO_MAXIMA_IDEB:
                        p.append(f"{etapa}, {cod}, {rede}, {a}: Ideb revisto de {v0} para {v1}")
    return p


def validar_censo(seed: dict, anterior: dict | None = None) -> list[str]:
    p: list[str] = []
    if seed.get("campos") != F.CAMPOS_CENSO:
        return [f"campos do Censo fora do contrato: {seed.get('campos')}"]
    campos = F.CAMPOS_CENSO
    mun = seed.get("municipios") or {}  # cada linha: o nome e as contagens na ordem de campos
    if not F.MUNICIPIOS_MIN <= len(mun) <= F.MUNICIPIOS_MAX:
        p.append(f"Censo com {len(mun)} municípios, fora da faixa")

    def coerente(nome: str, v: list) -> list[str]:
        q: list[str] = []
        if any(not isinstance(x, int) or isinstance(x, bool) or x < 0 for x in v):
            return [f"{nome}: contagem ausente ou negativa"]
        g = lambda c: v[campos.index(c)]
        if g("mat_total") != g("mat_publica") + g("mat_privada"):
            q.append(f"{nome}: matrículas totais não fecham com pública e privada")
        if g("mat_publica") != g("mat_federal") + g("mat_estadual") + g("mat_municipal"):
            q.append(f"{nome}: matrículas públicas não fecham com as três redes")
        if g("esc_total") != g("esc_publica") + g("esc_privada"):
            q.append(f"{nome}: escolas totais não fecham com públicas e privadas")
        for parte, todo in (
            ("mat_mun_rural", "mat_municipal"), ("creche_mun", "creche_total"), ("pre_mun", "pre_total"),
            ("ai_mun", "ai_publica"), ("ai_publica", "ai_total"), ("af_mun", "af_publica"), ("af_publica", "af_total"),
            ("esc_municipal", "esc_publica"), ("esc_mun_rural", "esc_municipal"),
            ("creche_mun", "mat_municipal"), ("pre_mun", "mat_municipal"), ("ai_mun", "mat_municipal"), ("af_mun", "mat_municipal"),
        ):
            if g(parte) > g(todo):
                q.append(f"{nome}: {parte} maior que {todo}")
        return q

    soma_uf = {s: [0] * len(campos) for s in F.SIGLAS}
    for cod, linha in mun.items():
        if len(cod) != 7 or cod[:2] not in F.UF_DO_PREFIXO or len(linha) != len(campos) + 1:
            p.append(f"Censo: linha {cod} fora do contrato")
            continue
        p.extend(coerente(f"Censo, {cod}", linha[1:]))
        if all(isinstance(x, int) for x in linha[1:]):
            for i, x in enumerate(linha[1:]):
                soma_uf[F.UF_DO_PREFIXO[cod[:2]]][i] += x
    ufs = seed.get("ufs") or {}
    soma_br = [0] * len(campos)
    for s in F.SIGLAS:
        u = ufs.get(s)
        if not u or len(u) != len(campos):
            p.append(f"Censo sem a UF {s}")
            continue
        p.extend(coerente(f"Censo, {s}", u))
        if u != soma_uf[s]:
            p.append(f"Censo: os municípios de {s} não somam a linha da UF")
        soma_br = [a + b for a, b in zip(soma_br, u)]
    br = seed.get("brasil")
    if not br or br != soma_br:
        p.append("Censo: as UFs não somam o Brasil")
    else:
        p.extend(coerente("Censo, Brasil", br))
    if anterior and anterior.get("ano", 0) > seed.get("ano", 0):
        p.append(f"Censo {seed.get('ano')} mais velho que o publicado ({anterior['ano']})")
    return p


def validar_populacao(seed: dict, anterior: dict | None = None) -> list[str]:
    p: list[str] = []
    mun = seed.get("municipios") or {}
    if not F.MUNICIPIOS_MIN <= len(mun) <= F.MUNICIPIOS_MAX:
        p.append(f"população com {len(mun)} municípios, fora da faixa")
    if any(not isinstance(v, int) or v <= 0 for v in mun.values()):
        p.append("população ausente ou não positiva")
    elif sum(mun.values()) != seed.get("brasil"):
        p.append("a população dos municípios não soma a do Brasil")
    if any(len(c) != 7 or c[:2] not in F.UF_DO_PREFIXO for c in mun):
        p.append("população com código que não é de município")
    if anterior and anterior.get("ano", 0) > seed.get("ano", 0):
        p.append(f"população de {seed.get('ano')} mais velha que a publicada ({anterior['ano']})")
    return p


def validar_cruzado(ideb: dict, censo: dict, pop: dict) -> list[str]:
    p: list[str] = []
    populacao = pop.get("municipios") or {}
    censo_mun = censo.get("municipios") or {}
    for cod in censo_mun:
        if cod not in populacao:
            p.append(f"município {cod} do Censo sem população (sem porte)")
    campos = censo.get("campos") or []
    mesma_edicao = censo.get("ano") == ideb.get("ano")
    for etapa in F.ETAPAS:
        for cod, m in ideb["etapas"][etapa]["municipios"].items():
            if cod not in censo_mun:
                p.append(f"{etapa}: município {cod} do Ideb fora do Censo")
                continue
            if cod not in populacao:
                p.append(f"{etapa}: município {cod} do Ideb sem população")
            if not mesma_edicao:
                continue
            linha = censo_mun[cod]
            for rede, campo in (("municipal", f"{etapa}_mun"), ("publica", f"{etapa}_publica")):
                r = m["redes"].get(rede)
                if r and r["ideb"][-1] is not None and linha[campos.index(campo) + 1] == 0:
                    p.append(f"{etapa}, {cod}: rede {rede} com Ideb {ideb['ano']} e nenhuma matrícula no Censo {censo['ano']}")
    return p
