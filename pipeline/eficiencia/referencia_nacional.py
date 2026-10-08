"""Referência nacional da despesa municipal em Educação por habitante, calculada pelo OBEE.

Rótulo público: "Cálculo do OBEE com dados do Siconfi/STN e do IBGE". Não é indicador do IBGE nem da STN.

Conceito idêntico ao do indicador das capitais (`edu.despesa.por_habitante`):

* despesa liquidada na função 12, Educação, da DCA, Anexo I-E (estágio liquidado, exceto intraorçamentárias);
* população residente estimada do IBGE (SIDRA, tabela 6579) do mesmo exercício;
* mesma política de conferência (`conferencia.py`): só entra o município cuja DCA confere com o RREO do 6º
  bimestre (diferença de até R$ 1,00 ou de até 0,1% da DCA). Em escala, os pares com diferença material não são
  reconciliados pela MSC (a MSC não foi coletada para os 5.570 municípios): ficam fora e contados como tal.

O conjunto é, portanto, o dos "municípios com dados elegíveis", nunca o total nacional. A razão agregada é a soma das
despesas dividida pela soma das populações dos MESMOS municípios elegíveis (não pela população do Brasil). Média
simples e mediana são as das razões municipais. Cobertura: número de municípios, população e despesa.
"""
from pipeline.eficiencia import base, conferencia as CF, entes
from pipeline.eficiencia import referencias as R

ROTULO_ORIGEM = "Cálculo do OBEE com dados do Siconfi/STN e do IBGE"
LIMITE_PORTE_GRANDE = 500_000   # habitantes: recorte de contexto, definido antes de ver os valores

MOTIVOS = {
    "ERRO_COLETA": "erro na coleta da resposta do Siconfi",
    "DCA_AUSENTE": "DCA do exercício não encontrada no Siconfi",
    "SEM_LINHA_EDUCACAO": "DCA sem a linha da função Educação (ou com mais de uma)",
    "DESPESA_NAO_POSITIVA": "despesa liquidada na função Educação nula ou negativa",
    "RREO_AUSENTE": "RREO do 6º bimestre sem a linha da Educação: DCA não conferida",
    "DIFERENCA_MATERIAL_COM_RREO": "DCA diverge do RREO acima de 0,1% e de R$ 1,00 (sem reconciliação pela MSC em escala)",
    "POPULACAO_AUSENTE": "população estimada do IBGE ausente ou nula",
}


def classifica_municipio(reg, pop):
    """(estado, valor, conferencia). estado: 'ELEGIVEL' ou um dos MOTIVOS. Nunca imputa."""
    dca, rreo = reg.get("dca", {}), reg.get("rreo", {})
    if "erro" in dca or "erro" in rreo:
        return "ERRO_COLETA", None, None
    if not dca.get("linhas"):
        return "DCA_AUSENTE", None, None
    v = dca.get("funcao12")
    if v is None or dca.get("linhas_funcao12") != 1:
        return "SEM_LINHA_EDUCACAO", None, None
    if v <= 0:
        return "DESPESA_NAO_POSITIVA", v, None
    if not pop or pop <= 0:
        return "POPULACAO_AUSENTE", v, None
    conf = CF.classifica(round(v, 2), {"exceto_intra": rreo.get("exceto_intra"), "intra": rreo.get("intra")} if rreo.get("exceto_intra") is not None else None, None)
    if conf["situacao"] == "NAO_CONFERIDO":
        return "RREO_AUSENTE", v, conf
    if conf["situacao"] in ("CONFERE", "DIFERENCA_MENOR"):
        return "ELEGIVEL", v, conf
    return "DIFERENCA_MATERIAL_COM_RREO", v, conf


def _estatisticas(itens):
    """itens: [(cod, nome, uf, despesa, populacao)] -> estatísticas pelo mesmo contrato das capitais (`referencias.estatisticas`)."""
    pares = [(cod, den_razao(d, p), d, p) for cod, _, _, d, p in itens]
    return R.estatisticas(pares)


def den_razao(d, p):
    return d / p


def calcula(ano, registros, populacao, municipios, capitais=None):
    """registros: lista do seed (por município); populacao: {cod: int|None}; municipios: lista de entes (esfera M).
    Devolve a referência do exercício com os grupos, a cobertura e as exclusões por motivo."""
    capitais = capitais if capitais is not None else {c for c, _, _ in entes.CAPITAIS}
    por_cod = {r["cod"]: r for r in registros}
    nomes = {m["cod_ibge"]: (m["ente"], m["uf"]) for m in municipios}
    est = {}
    elegiveis, exclusoes = [], {}
    despesa_declarada = 0.0
    pop_total = 0
    for m in municipios:
        cod = m["cod_ibge"]
        pop = populacao.get(cod)
        pop_total += pop or 0
        reg = por_cod.get(cod)
        if reg is None:
            est[cod] = "DCA_AUSENTE"
            exclusoes.setdefault("DCA_AUSENTE", []).append(cod)
            continue
        estado, v, conf = classifica_municipio(reg, pop)
        est[cod] = estado
        if v is not None and v > 0:
            despesa_declarada += v
        if estado == "ELEGIVEL":
            elegiveis.append((cod, nomes[cod][0], nomes[cod][1], v, pop))
        else:
            exclusoes.setdefault(estado, []).append(cod)
    grupos = []

    def grupo(gid, rotulo, itens, nota):
        if not itens:
            return
        e = _estatisticas(itens)
        pop_el = sum(i[4] for i in itens)
        desp_el = sum(i[3] for i in itens)
        g = {"id": gid, "rotulo": rotulo, "nota": nota, "n_municipios": len(itens), "populacao_dos_municipios": pop_el, "despesa_dos_municipios": round(desp_el, 2)}
        g.update({k: e[k] for k in ("media", "mediana", "minimo", "maximo", "q1", "q3", "razao_agregada", "quartis_exibicao")})
        g["capitais_minimo"] = [nomes[c][0] for c in e["capitais_minimo"]] if e.get("capitais_minimo") else []
        g["capitais_maximo"] = [nomes[c][0] for c in e["capitais_maximo"]] if e.get("capitais_maximo") else []
        grupos.append(g)

    grupo("elegiveis", "Municípios com dados elegíveis", elegiveis,
          "Todos os portes e responsabilidades; não é um grupo homogêneo de pares das capitais.")
    grupo("elegiveis_500mil_ou_mais", f"Municípios elegíveis com {LIMITE_PORTE_GRANDE:,} habitantes ou mais".replace(",", "."),
          [i for i in elegiveis if i[4] >= LIMITE_PORTE_GRANDE],
          "Recorte de porte, definido antes de ver os valores, para aproximar o grupo das capitais; continua sem equivaler a um grupo de pares.")
    grupo("elegiveis_exceto_capitais", "Municípios elegíveis, exceto capitais", [i for i in elegiveis if i[0] not in capitais],
          "Exclui as 26 capitais estaduais do conjunto nacional.")
    n_total = len(municipios)
    return {
        "ano": ano, "rotulo_origem": ROTULO_ORIGEM, "n_municipios_total": n_total, "n_elegiveis": len(elegiveis),
        "populacao_total_municipios": pop_total,
        "despesa_declarada_total": round(despesa_declarada, 2),
        "cobertura": {
            "municipios_pct": round(100 * len(elegiveis) / n_total, 2) if n_total else None,
            "populacao_pct": round(100 * sum(i[4] for i in elegiveis) / pop_total, 2) if pop_total else None,
            "despesa_pct": round(100 * sum(i[3] for i in elegiveis) / despesa_declarada, 2) if despesa_declarada else None,
        },
        "grupos": grupos,
        "exclusoes": {k: {"motivo": MOTIVOS[k], "n": len(v)} for k, v in sorted(exclusoes.items())},
        "exclusoes_codigos": {k: sorted(v) for k, v in sorted(exclusoes.items())},
        "capitais_elegiveis": sorted(i[0] for i in elegiveis if i[0] in capitais),
    }


def referencia(ano):
    """Lê o seed do exercício e calcula; None se o exercício não foi coletado."""
    import os
    c = os.path.join(base.SEED, "siconfi", "nacional_educacao", f"{ano}.json.gz")
    p = os.path.join(base.SEED, "ibge_populacao", f"populacao_municipios_{ano}.json.gz")
    e = os.path.join(base.SEED, "siconfi", "entes.json.gz")
    if not (os.path.exists(c) and os.path.exists(p) and os.path.exists(e)):
        return None
    regs = base.le_json_gz(c)
    if len(regs) < 100:   # coleta de teste ou parcial: não publica referência nacional
        return None
    pop = {r["cod"]: r["valor"] for r in base.le_json_gz(p)}
    mun = [x for x in base.le_json_gz(e) if x["esfera"] == "M"]
    return calcula(ano, regs, pop, mun)


def linhas_municipios(ano):
    """Uma linha por município para auditoria: dados usados, estado de elegibilidade e razão. None sem seed completo."""
    import os
    c = os.path.join(base.SEED, "siconfi", "nacional_educacao", f"{ano}.json.gz")
    p = os.path.join(base.SEED, "ibge_populacao", f"populacao_municipios_{ano}.json.gz")
    e = os.path.join(base.SEED, "siconfi", "entes.json.gz")
    if not (os.path.exists(c) and os.path.exists(p) and os.path.exists(e)):
        return None
    regs = base.le_json_gz(c)
    if len(regs) < 100:
        return None
    por_cod = {r["cod"]: r for r in regs}
    pop = {r["cod"]: r["valor"] for r in base.le_json_gz(p)}
    capitais = {c for c, _, _ in entes.CAPITAIS}
    out = []
    for m in sorted((x for x in base.le_json_gz(e) if x["esfera"] == "M"), key=lambda x: x["cod_ibge"]):
        cod = m["cod_ibge"]
        reg = por_cod.get(cod, {})
        estado, v, conf = classifica_municipio(reg, pop.get(cod)) if reg else ("DCA_AUSENTE", None, None)
        dca, rreo = reg.get("dca", {}), reg.get("rreo", {})
        out.append({"cod": cod, "nome": m["ente"], "uf": m["uf"], "capital": cod in capitais, "populacao": pop.get(cod),
                    "dca_funcao12_liquidada": dca.get("funcao12"), "rreo_educacao_liquidada_exceto_intra": rreo.get("exceto_intra"),
                    "conferencia": (conf or {}).get("situacao"), "estado": estado, "motivo": MOTIVOS.get(estado, "elegível"),
                    "razao": (v / pop[cod]) if estado == "ELEGIVEL" else None,
                    "sha256_dca": dca.get("sha256"), "sha256_rreo": rreo.get("sha256")})
    return out
