"""IBGE — malha das UFs (SVG oficial) e população estimada por UF.

Fontes (dados abertos):
- Malhas v3: servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=image/svg+xml
  &intrarregiao=UF&qualidade=minima → SVG ~47 KB com 27 <path id="{cod_ibge}">.
- SIDRA tabela 6579 (população estimada), última referência disponível, por UF.

Silver: geo_uf(cod, uf, nome, regiao, populacao, pop_ano, svg_d) + geo_meta(viewBox).
"""
import json
import re

from pipeline import common

MALHA = ("https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR"
         "?formato=image/svg+xml&intrarregiao=UF&qualidade=minima")
SIDRA = "https://apisidra.ibge.gov.br/values/t/6579/n3/all/v/9324/p/last?formato=json"

COD_UF = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
          "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL",
          "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
          "41": "PR", "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF"}
NOME_UF = {"RO": "Rondônia", "AC": "Acre", "AM": "Amazonas", "RR": "Roraima", "PA": "Pará", "AP": "Amapá",
           "TO": "Tocantins", "MA": "Maranhão", "PI": "Piauí", "CE": "Ceará", "RN": "Rio Grande do Norte",
           "PB": "Paraíba", "PE": "Pernambuco", "AL": "Alagoas", "SE": "Sergipe", "BA": "Bahia",
           "MG": "Minas Gerais", "ES": "Espírito Santo", "RJ": "Rio de Janeiro", "SP": "São Paulo",
           "PR": "Paraná", "SC": "Santa Catarina", "RS": "Rio Grande do Sul", "MS": "Mato Grosso do Sul",
           "MT": "Mato Grosso", "GO": "Goiás", "DF": "Distrito Federal"}


def _ensure(con):
    con.executescript("""
    CREATE TABLE IF NOT EXISTS geo_uf(cod TEXT PRIMARY KEY, uf TEXT, nome TEXT, regiao TEXT,
        populacao INTEGER, pop_ano TEXT, svg_d TEXT);
    CREATE TABLE IF NOT EXISTS geo_meta(k TEXT PRIMARY KEY, v TEXT);
    """)


def collect(con, cfg):
    from pipeline.sources.scr_data import UF_REGIAO
    _ensure(con)
    out = []
    if con.execute("SELECT COUNT(*) FROM geo_uf WHERE svg_d IS NOT NULL").fetchone()[0] == 27 and \
       con.execute("SELECT COUNT(*) FROM geo_uf WHERE populacao IS NOT NULL").fetchone()[0] == 27:
        return [{"key": "geo_ibge", "ok": True, "note": "malha e população já coletadas"}]
    try:
        svg, meta = common.http_get(MALHA, timeout=120)
        common.save_bronze("geo_ibge", "br_uf.svg", svg, {"fonte": "IBGE Malhas v3", "url": MALHA})
        txt = svg.decode("utf-8")
        viewbox = re.search(r'viewBox="([^"]+)"', txt).group(1)
        transform = (re.search(r'<g[^>]*transform="([^"]+)"', txt) or [None, ""])[1]
        con.execute("INSERT OR REPLACE INTO geo_meta VALUES('viewBox', ?)", (viewbox,))
        con.execute("INSERT OR REPLACE INTO geo_meta VALUES('transform', ?)", (transform,))
        for cod, d in re.findall(r'<path id="(\d+)" d="([^"]+)"', txt):
            uf = COD_UF.get(cod)
            if not uf:
                continue
            con.execute("""INSERT INTO geo_uf(cod, uf, nome, regiao, svg_d) VALUES(?,?,?,?,?)
                           ON CONFLICT(cod) DO UPDATE SET svg_d=excluded.svg_d""",
                        (cod, uf, NOME_UF[uf], UF_REGIAO[uf], d))
        out.append({"key": "geo_ibge:malha", "ok": True, "ufs": 27})
    except Exception as e:
        out.append({"key": "geo_ibge:malha", "ok": False, "error": str(e)[:200]})
    try:
        body, meta = common.http_get(SIDRA, timeout=120)
        common.save_bronze("geo_ibge", "sidra_6579_uf.json", body, {"fonte": "IBGE SIDRA 6579", "url": SIDRA})
        rows = json.loads(body)
        nome2uf = {v: k for k, v in NOME_UF.items()}
        for r in rows[1:]:
            uf = nome2uf.get(r["D1N"])
            if uf:
                con.execute("UPDATE geo_uf SET populacao=?, pop_ano=? WHERE uf=?",
                            (int(r["V"]), r["D3N"], uf))
        out.append({"key": "geo_ibge:populacao", "ok": True})
    except Exception as e:
        out.append({"key": "geo_ibge:populacao", "ok": False, "error": str(e)[:200]})
    con.commit()
    return out
