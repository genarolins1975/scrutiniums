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


def _ensure(con):
    con.executescript("""
    CREATE TABLE IF NOT EXISTS censo_mun(
        cod_ibge TEXT PRIMARY KEY,
        pop_total REAL, pop_18mais REAL,
        moradores_dpp REAL, renda_pc_mensal REAL, renda_dom_mensal REAL,
        pop_urbana REAL, urbanizacao REAL);
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
