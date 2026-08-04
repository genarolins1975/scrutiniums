"""Censo Demográfico 2022 (IBGE) — estrutura demográfica e de renda por município.

Fonte: API de agregados do IBGE (servicodados.ibge.gov.br/api/v3/agregados).

O que é baixado, e por que cada tabela:

* **9514** — População residente por sexo e idade. Nível municipal. É de onde sai a
  população de 18 anos ou mais, calculada por subtração exata: total menos os grupos
  0–4, 5–9, 10–14 e as idades individuais 15, 16 e 17. Todas são categorias publicadas
  pelo IBGE; nada é interpolado.

* **10295** — Moradores em domicílios particulares permanentes ocupados e valor do
  rendimento nominal médio mensal domiciliar per capita. Nível municipal. O produto das
  duas variáveis é a **massa de renda domiciliar mensal** do município — não é
  estimativa: é a definição da média multiplicada pelo seu denominador.

* **9923** — População por situação do domicílio (urbana/rural). Nível municipal. Dá o
  grau de urbanização, que entra como controle no benchmark e no modelo.

* **Malha municipal** em SVG com qualidade mínima: 1,3 MB, com os códigos IBGE de sete
  dígitos como id de cada caminho. É o que permite o mapa coroplético sem depender de
  biblioteca de mapas.

Tudo aqui é de 2022 e não muda: a coleta é idempotente e roda uma vez só.
"""
import json
import re

from pipeline import common

API = "https://servicodados.ibge.gov.br/api/v3/agregados"
MALHA = ("https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR"
         "?formato=image/svg+xml&intrarregiao=municipio&qualidade=minima")

# Categorias da classificação 287 (Idade) usadas para chegar a 18 anos ou mais.
IDADE_TOTAL = "100362"
IDADE_MENORES = ["93070", "93084", "93085", "6572", "6573", "6574"]  # 0-4, 5-9, 10-14, 15, 16, 17

# --- Condição de ocupação do domicílio: tabela 9930, variável 381 ---
#
# A tabela cruza condição de ocupação (classificação 63) com número de cômodos (65) e
# tipo de domicílio (125). As duas últimas são neutralizadas pela categoria Total.
#
# Nomenclatura de 2022, que mudou em relação a 2010: não existe "Próprio - já pago" e sim
# "Próprio de algum morador - já pago, herdado ou ganho"; e "Cedido" ganhou três
# subcategorias. Ver docs/AUDITORIA_MORADIA.md.
#
# Limite empírico da API: com N6[all], no máximo 8 categorias da classificação 63 por
# requisição — com 9 ou mais o servidor devolve HTTP 500 por estouro de payload.
OCUPACAO = {
    "total":            "95826",
    "proprio":          "73554",
    "proprio_pago":     "73126",  # já pago, herdado ou ganho
    "proprio_pagando":  "4343",   # ainda pagando
    "alugado":          "1055",
    "cedido":           "73553",
    "outra":            "1058",
}
COMODOS_TOTAL = "95810"
TIPO_TOTAL = "2932"

# --- Estrutura etária: tabela 9514, variável 93, classificação 287 ---
#
# Os 21 grupos quinquenais de nível 1 da classificação. Somá-los reproduz o total da
# categoria 100362, o que serve de validação a cada coleta. Grupos, e não idades
# simples, porque a idade simples só vai até 100 e a API estoura de qualquer forma.
#
# Limite empírico: com N6[all], a API aceita no máximo 8 categorias por requisição —
# com 11 devolve HTTP 500. Os 21 grupos vêm em três lotes.
IDADE_GRUPOS = [
    ("93070", "0 a 4"), ("93084", "5 a 9"), ("93085", "10 a 14"),
    ("93086", "15 a 19"), ("93087", "20 a 24"), ("93088", "25 a 29"),
    ("93089", "30 a 34"), ("93090", "35 a 39"), ("93091", "40 a 44"),
    ("93092", "45 a 49"), ("93093", "50 a 54"), ("93094", "55 a 59"),
    ("93095", "60 a 64"), ("93096", "65 a 69"), ("93097", "70 a 74"),
    ("93098", "75 a 79"), ("49108", "80 a 84"), ("49109", "85 a 89"),
    ("60040", "90 a 94"), ("60041", "95 a 99"), ("6653", "100 ou mais"),
]
IDADE_LOTE = 7  # abaixo do teto de 8, com margem

# Massa de rendimento do trabalho: tabela 10289, variável 13424, em reais por mês.
# É o denominador correto para comparar com a massa de benefícios — rendimento do
# trabalho, não renda domiciliar total, que já inclui os próprios benefícios.
MASSA_TRABALHO = ("10289", "13424")

# Composição do rendimento domiciliar: tabela 10297, variável 13504, classificação 11308.
#
# Esta tabela é a evidência documental da limitação central desta aba. Ela tem
# exatamente três categorias — rendimento de todas as fontes (79450), de todos os
# trabalhos (79451) e de outras fontes (79452). **Não existe categoria de aposentadoria
# ou pensão.** "Outras fontes" reúne aposentadoria, pensão, BPC, transferências,
# aluguel, aplicações financeiras, seguro-desemprego e demais origens num único número.
#
# Por isso a participação de outras fontes é publicada como **teto** do peso dos
# benefícios previdenciários, nunca como o peso deles. O peso específico vem dos
# registros administrativos da Previdência, não daqui.
COMPOSICAO = ("10297", "13504", {
    "79450": "todas_fontes", "79451": "trabalho", "79452": "outras_fontes",
})


def _ensure(con):
    con.executescript("""
    CREATE TABLE IF NOT EXISTS censo_mun(
        cod_ibge TEXT PRIMARY KEY,
        pop_total REAL, pop_18mais REAL,
        moradores_dpp REAL, renda_pc_mensal REAL, renda_dom_mensal REAL,
        pop_urbana REAL, urbanizacao REAL);
    CREATE TABLE IF NOT EXISTS censo_moradia(
        cod_ibge TEXT PRIMARY KEY,
        dom_total REAL, dom_proprio REAL, dom_proprio_pago REAL, dom_proprio_pagando REAL,
        dom_alugado REAL, dom_cedido REAL, dom_outra REAL);
    CREATE TABLE IF NOT EXISTS censo_idade(
        cod_ibge TEXT, grupo TEXT, pop REAL, ord INTEGER,
        PRIMARY KEY(cod_ibge, grupo));
    CREATE TABLE IF NOT EXISTS censo_trabalho(
        cod_ibge TEXT PRIMARY KEY, massa_trabalho REAL);
    CREATE TABLE IF NOT EXISTS censo_composicao(
        cod_ibge TEXT PRIMARY KEY, pct_trabalho REAL, pct_outras_fontes REAL);
    CREATE TABLE IF NOT EXISTS censo_malha(cod_ibge TEXT PRIMARY KEY, svg_d TEXT);
    CREATE TABLE IF NOT EXISTS censo_meta(chave TEXT PRIMARY KEY, valor TEXT);
    """)


def _num(v):
    """Valores do IBGE vêm como texto; '-', '..' e 'X' significam ausência, não zero."""
    s = str(v).strip()
    if not s or not re.match(r"^-?\d+(\.\d+)?$", s):
        return None
    return float(s)


def _serie(tabela, variaveis, classificacao=None, periodo="2022", timeout=300):
    url = f"{API}/{tabela}/periodos/{periodo}/variaveis/{variaveis}?localidades=N6%5Ball%5D"
    if classificacao:
        url += "&classificacao=" + classificacao
    body, meta = common.http_get(url, timeout=timeout)
    return json.loads(body.decode("utf-8")), meta, url


def collect(con, cfg=None):
    _ensure(con)
    ja = con.execute("SELECT COUNT(*) FROM censo_mun").fetchone()[0]
    tem_malha = con.execute("SELECT COUNT(*) FROM censo_malha").fetchone()[0]
    if ja >= 5500 and tem_malha >= 5500:
        return [{"key": "censo2022", "ok": True, "note": "Censo 2022 já absorvido (dado fixo)"}]

    dados = {}
    results = []

    # ---- população total e 18+ (tabela 9514) ----
    try:
        cats = ",".join([IDADE_TOTAL] + IDADE_MENORES)
        d, meta, url = _serie("9514", "93", f"2%5B6794%5D%7C287%5B{cats}%5D%7C286%5B113635%5D")
        _, sha = common.save_bronze("censo2022", "9514_pop_idade",
                                    json.dumps(d).encode("utf-8"), {**meta, "url": url})
        por_cat = {}
        for r in d[0]["resultados"]:
            cat = list(r["classificacoes"][1]["categoria"].keys())[0]
            por_cat[cat] = {s["localidade"]["id"]: _num(s["serie"]["2022"]) for s in r["series"]}
        for cod, tot in por_cat[IDADE_TOTAL].items():
            if tot is None:
                continue
            menores = sum(por_cat[c].get(cod) or 0 for c in IDADE_MENORES)
            dados.setdefault(cod, {})["pop_total"] = tot
            dados[cod]["pop_18mais"] = tot - menores
        common.record_lineage(con, "penetracao.json", "bronze/censo2022/9514_pop_idade", sha,
                              "Censo 2022 tabela 9514 -> população total e 18+ (total menos 0-17 por subtração exata)")
        results.append({"key": "censo2022:9514", "ok": True, "municipios": len(por_cat[IDADE_TOTAL])})
    except Exception as e:
        results.append({"key": "censo2022:9514", "ok": False, "error": str(e)[:200]})

    # ---- moradores e renda domiciliar per capita (tabela 10295) ----
    try:
        d, meta, url = _serie("10295", "13604%7C13431")
        _, sha = common.save_bronze("censo2022", "10295_renda",
                                    json.dumps(d).encode("utf-8"), {**meta, "url": url})
        por_var = {}
        for x in d:
            por_var[x["id"]] = {s["localidade"]["id"]: _num(s["serie"]["2022"])
                                for s in x["resultados"][0]["series"]}
        for cod, mor in por_var.get("13604", {}).items():
            rpc = por_var.get("13431", {}).get(cod)
            e = dados.setdefault(cod, {})
            e["moradores_dpp"] = mor
            e["renda_pc_mensal"] = rpc
            # massa de renda domiciliar = moradores × rendimento per capita médio.
            # Não é estimativa: é a média multiplicada pelo próprio denominador.
            e["renda_dom_mensal"] = (mor * rpc) if (mor is not None and rpc is not None) else None
        common.record_lineage(con, "penetracao.json", "bronze/censo2022/10295_renda", sha,
                              "Censo 2022 tabela 10295 -> massa de renda domiciliar mensal (moradores × renda per capita)")
        results.append({"key": "censo2022:10295", "ok": True, "municipios": len(por_var.get("13604", {}))})
    except Exception as e:
        results.append({"key": "censo2022:10295", "ok": False, "error": str(e)[:200]})

    # ---- urbanização (tabela 9923) ----
    try:
        d, meta, url = _serie("9923", "93", "1%5B1,2%5D")
        por_sit = {}
        for r in d[0]["resultados"]:
            cat = list(r["classificacoes"][0]["categoria"].values())[0]
            por_sit[cat] = {s["localidade"]["id"]: _num(s["serie"]["2022"]) for s in r["series"]}
        urb = next((v for k, v in por_sit.items() if "rbana" in k), {})
        for cod, u in urb.items():
            e = dados.setdefault(cod, {})
            e["pop_urbana"] = u
            tot = e.get("pop_total")
            e["urbanizacao"] = round(100 * u / tot, 2) if (u is not None and tot) else None
        results.append({"key": "censo2022:9923", "ok": True, "municipios": len(urb)})
    except Exception as e:
        results.append({"key": "censo2022:9923", "ok": False, "error": str(e)[:200]})

    for cod, e in dados.items():
        con.execute("INSERT OR REPLACE INTO censo_mun VALUES(?,?,?,?,?,?,?,?)",
                    (cod, e.get("pop_total"), e.get("pop_18mais"), e.get("moradores_dpp"),
                     e.get("renda_pc_mensal"), e.get("renda_dom_mensal"),
                     e.get("pop_urbana"), e.get("urbanizacao")))

    # ---- condição de ocupação do domicílio (tabela 9930) ----
    try:
        cats = ",".join(OCUPACAO.values())
        clas = f"63%5B{cats}%5D%7C65%5B{COMODOS_TOTAL}%5D%7C125%5B{TIPO_TOTAL}%5D"
        d, meta, url = _serie("9930", "381", clas)
        _, sha = common.save_bronze("censo2022", "9930_ocupacao",
                                    json.dumps(d).encode("utf-8"), {**meta, "url": url})
        por_cat = {}
        for r in d[0]["resultados"]:
            cat = list(r["classificacoes"][0]["categoria"].keys())[0]
            por_cat[cat] = {s["localidade"]["id"]: _num(s["serie"]["2022"]) for s in r["series"]}
        inv = {v: k for k, v in OCUPACAO.items()}
        mor = {}
        for cid, serie in por_cat.items():
            nome = inv.get(cid)
            if not nome:
                continue
            for cod, v in serie.items():
                mor.setdefault(cod, {})[nome] = v
        for cod, e in mor.items():
            con.execute("INSERT OR REPLACE INTO censo_moradia VALUES(?,?,?,?,?,?,?,?)",
                        (cod, e.get("total"), e.get("proprio"), e.get("proprio_pago"),
                         e.get("proprio_pagando"), e.get("alugado"), e.get("cedido"),
                         e.get("outra")))
        common.record_lineage(con, "moradia.json", "bronze/censo2022/9930_ocupacao", sha,
                              "Censo 2022 tabela 9930 variável 381 -> domicílios por condição de ocupação")
        results.append({"key": "censo2022:9930", "ok": True, "municipios": len(mor)})
    except Exception as e:
        results.append({"key": "censo2022:9930", "ok": False, "error": str(e)[:200]})

    # ---- estrutura etária por grupo quinquenal (tabela 9514) ----
    try:
        total_lotes, guardadas = 0, 0
        for i in range(0, len(IDADE_GRUPOS), IDADE_LOTE):
            lote = IDADE_GRUPOS[i:i + IDADE_LOTE]
            cats = ",".join(c for c, _ in lote)
            d, meta, url = _serie("9514", "93", f"2%5B6794%5D%7C287%5B{cats}%5D%7C286%5B113635%5D")
            _, sha = common.save_bronze("censo2022", f"9514_idade_{i}",
                                        json.dumps(d).encode("utf-8"), {**meta, "url": url})
            rot = {c: r for c, r in lote}
            ordem = {c: IDADE_GRUPOS.index((c, r)) for c, r in lote}
            for r in d[0]["resultados"]:
                cid = list(r["classificacoes"][1]["categoria"].keys())[0]
                if cid not in rot:
                    continue
                for srie in r["series"]:
                    v = _num(srie["serie"]["2022"])
                    if v is None:
                        continue
                    con.execute("INSERT OR REPLACE INTO censo_idade VALUES(?,?,?,?)",
                                (srie["localidade"]["id"], rot[cid], v, ordem[cid]))
                    guardadas += 1
            total_lotes += 1
        common.record_lineage(con, "consignado.json", "bronze/censo2022/9514_idade_0", sha,
                              "Censo 2022 tabela 9514 -> população por grupo quinquenal de idade")
        results.append({"key": "censo2022:9514_idade", "ok": True,
                        "lotes": total_lotes, "celulas": guardadas})
    except Exception as e:
        results.append({"key": "censo2022:9514_idade", "ok": False, "error": str(e)[:200]})

    # ---- massa de rendimento do trabalho (tabela 10289) ----
    try:
        tab, var = MASSA_TRABALHO
        d, meta, url = _serie(tab, var)
        _, sha = common.save_bronze("censo2022", "10289_massa_trabalho",
                                    json.dumps(d).encode("utf-8"), {**meta, "url": url})
        n = 0
        for srie in d[0]["resultados"][0]["series"]:
            v = _num(srie["serie"]["2022"])
            if v is None:
                continue
            con.execute("INSERT OR REPLACE INTO censo_trabalho VALUES(?,?)",
                        (srie["localidade"]["id"], v))
            n += 1
        common.record_lineage(con, "consignado.json", "bronze/censo2022/10289_massa_trabalho", sha,
                              "Censo 2022 tabela 10289 -> massa de rendimento mensal de todos os trabalhos")
        results.append({"key": "censo2022:10289", "ok": True, "municipios": n})
    except Exception as e:
        results.append({"key": "censo2022:10289", "ok": False, "error": str(e)[:200]})

    # ---- composição do rendimento domiciliar (tabela 10297) ----
    try:
        tab, var, cats = COMPOSICAO
        chaves = "%2C".join(cats)
        d, meta, url = _serie(tab, var, f"11308%5B{chaves}%5D")
        _, sha = common.save_bronze("censo2022", "10297_composicao",
                                    json.dumps(d).encode("utf-8"), {**meta, "url": url})
        por = {}
        for r in d[0]["resultados"]:
            cid = list(r["classificacoes"][0]["categoria"].keys())[0]
            nome = cats.get(cid)
            if not nome:
                continue
            for srie in r["series"]:
                por.setdefault(srie["localidade"]["id"], {})[nome] = _num(srie["serie"]["2022"])
        for cod, e in por.items():
            con.execute("INSERT OR REPLACE INTO censo_composicao VALUES(?,?,?)",
                        (cod, e.get("trabalho"), e.get("outras_fontes")))
        common.record_lineage(con, "consignado.json", "bronze/censo2022/10297_composicao", sha,
                              "Censo 2022 tabela 10297 -> participação de trabalho e de outras "
                              "fontes no rendimento domiciliar (outras fontes NÃO é renda previdenciária)")
        results.append({"key": "censo2022:10297", "ok": True, "municipios": len(por)})
    except Exception as e:
        results.append({"key": "censo2022:10297", "ok": False, "error": str(e)[:200]})

    # ---- malha municipal ----
    if tem_malha < 5500:
        try:
            body, meta = common.http_get(MALHA, timeout=600)
            svg = body.decode("utf-8", "replace")
            n = 0
            for m in re.finditer(r'<path id="(\d{7})" d="([^"]+)"', svg):
                con.execute("INSERT OR REPLACE INTO censo_malha VALUES(?,?)", (m.group(1), m.group(2)))
                n += 1
            vb = re.search(r'viewBox="([^"]+)"', svg)
            tr = re.search(r'<g id="BRMU" transform="([^"]+)"', svg)
            con.execute("INSERT OR REPLACE INTO censo_meta VALUES('malha_viewbox', ?)", (vb.group(1) if vb else "",))
            con.execute("INSERT OR REPLACE INTO censo_meta VALUES('malha_transform', ?)", (tr.group(1) if tr else "",))
            results.append({"key": "censo2022:malha", "ok": True, "municipios": n})
        except Exception as e:
            results.append({"key": "censo2022:malha", "ok": False, "error": str(e)[:200]})

    con.commit()
    return results
