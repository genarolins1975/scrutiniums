"""Conector DJEN / Comunica PJe (CNJ) — fichas nominais REAIS de recuperação judicial.

API pública (sem autenticação) com o texto integral das comunicações processuais publicadas
no Diário de Justiça Eletrônico Nacional. Estratégia validada empiricamente (2026-07):
- filtros de classe do servidor são ignorados => busca por texto ("recuperação judicial")
  por tribunal + janela de datas, com filtro de classe NO CLIENTE (nomeClasse);
- fichas montadas por processo, exibindo SOMENTE pessoas jurídicas (forma societária
  identificada por heurística) — pessoas físicas não são exibidas;
- CNPJ e valores extraídos por regex do texto oficial, sempre com marcação de confiança
  ("extraído por regex — conferir no processo"); valor mencionado NÃO é o passivo total.
"""
import json
import re
import time
import urllib.parse
from datetime import date, timedelta

from pipeline import common

CNPJ_RE = re.compile(r"\b\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}\b")
VALOR_RE = re.compile(r"(?:passivo|d[ií]vida|cr[eé]ditos?)[\s\S]{0,80}?R\$\s*([\d.]{4,}(?:,\d{2})?)",
                      re.IGNORECASE)
PJ_RE = re.compile(r"LTDA|S[./]A\b|S\.A\.?|SOCIEDADE AN[ÔO]NIMA|EIRELI|\bEPP\b|\bS/S\b|"
                   r"COOPERATIVA|IND[ÚU]STRIA|COM[ÉE]RCIO|AGRO|TRANSPORTES|CONSTRUTORA|"
                   r"INCORPORADORA|PARTICIPA[ÇC][ÕO]ES|ENGENHARIA|ALIMENTOS|T[ÊE]XTIL",
                   re.IGNORECASE)
TAG_RE = re.compile(r"<[^>]+>")


def _eh_pj(nome):
    return bool(nome and PJ_RE.search(nome))


def _limpa_nome(nome):
    return re.sub(r"\s*[-(]?\s*EM RECUPERA[ÇC][ÃA]O JUDICIAL\s*[)]?\s*$", "", nome.strip(),
                  flags=re.IGNORECASE)


def collect(con, cfg):
    c = cfg.get("djen")
    if not c:
        return [{"key": "djen", "ok": False, "error": "sem configuração"}]
    con.execute("""CREATE TABLE IF NOT EXISTS rj_fichas(
        numero_processo TEXT PRIMARY KEY, tribunal TEXT, orgao TEXT, classe TEXT,
        empresas TEXT, cnpjs TEXT, valor_mencionado TEXT, tipos_documento TEXT,
        ultima_publicacao TEXT, n_publicacoes INTEGER, link TEXT, collected_at TEXT)""")
    con.execute("DELETE FROM rj_fichas")  # janela móvel: recarrega a cada execução
    fim = date.today()
    ini = fim - timedelta(days=c["janela_dias"])
    results = []
    for trib in c["tribunais"]:
        fichas = {}
        paginas_ok = 0
        try:
            for pagina in range(1, c["max_paginas_por_tribunal"] + 1):
                params = {
                    "pagina": pagina, "itensPorPagina": c["itens_por_pagina"],
                    "texto": "recuperação judicial", "siglaTribunal": trib,
                    "dataDisponibilizacaoInicio": ini.isoformat(),
                    "dataDisponibilizacaoFim": fim.isoformat(),
                }
                url = c["base_url"] + "?" + urllib.parse.urlencode(params)
                body, meta = common.http_get(url, timeout=90)
                d = json.loads(body)
                items = d.get("items", [])
                if pagina == 1:
                    common.save_bronze("djen", f"rj_{trib}_p1", body, meta)
                paginas_ok += 1
                for it in items:
                    classe = (it.get("nomeClasse") or "").upper()
                    if not ("RECUPERA" in classe or "FALÊNCIA" in classe or "FALENCIA" in classe):
                        continue
                    num = it.get("numeroprocessocommascara") or it.get("numero_processo")
                    if not num:
                        continue
                    texto = TAG_RE.sub(" ", it.get("texto") or "")
                    dest = [x.get("nome", "") for x in (it.get("destinatarios") or [])]
                    empresas = sorted({_limpa_nome(n) for n in dest if _eh_pj(n)})
                    cnpjs = sorted(set(CNPJ_RE.findall(texto)))[:3]
                    valor = VALOR_RE.search(texto)
                    f = fichas.setdefault(num, {
                        "numero_processo": num, "tribunal": trib,
                        "orgao": it.get("nomeOrgao"), "classe": it.get("nomeClasse"),
                        "empresas": set(), "cnpjs": set(), "valor_mencionado": None,
                        "tipos": set(), "ultima": "", "n": 0, "link": it.get("link"),
                    })
                    f["empresas"].update(empresas)
                    f["cnpjs"].update(cnpjs)
                    if valor and not f["valor_mencionado"]:
                        f["valor_mencionado"] = valor.group(1)
                    if it.get("tipoDocumento"):
                        f["tipos"].add(it["tipoDocumento"])
                    dt = it.get("data_disponibilizacao") or ""
                    f["ultima"] = max(f["ultima"], dt)
                    f["n"] += 1
                    if not f["link"] and it.get("link"):
                        f["link"] = it["link"]
                if len(items) < c["itens_por_pagina"]:
                    break
                time.sleep(c["pausa_s"])
            n_pj = 0
            for num, f in fichas.items():
                if not f["empresas"]:
                    continue  # só exibimos fichas com PJ identificada
                con.execute("""INSERT OR REPLACE INTO rj_fichas VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
                            (num, f["tribunal"], f["orgao"], f["classe"],
                             json.dumps(sorted(f["empresas"]), ensure_ascii=False),
                             json.dumps(sorted(f["cnpjs"]), ensure_ascii=False),
                             f["valor_mencionado"], json.dumps(sorted(f["tipos"]), ensure_ascii=False),
                             f["ultima"], f["n"], f["link"], common.now_utc()))
                n_pj += 1
            common.record_lineage(con, f"rj_fichas:{trib}", f"djen/rj_{trib}_p1", "-",
                                  "Comunica PJe: busca textual + filtro de classe no cliente; "
                                  "PJ por heurística de forma societária; CNPJ/valor por regex")
            results.append({"key": f"djen_{trib}", "ok": True, "fichas_pj": n_pj,
                            "processos_vistos": len(fichas), "paginas": paginas_ok})
        except Exception as e:
            results.append({"key": f"djen_{trib}", "ok": False, "error": str(e),
                            "fichas_parciais": len(fichas)})
    return results
