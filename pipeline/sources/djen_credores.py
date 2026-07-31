"""Fase 4d — credores financeiros e passivo em publicações de RJ/falência (DJEN) +
enriquecimento cadastral via BrasilAPI (dados públicos da Receita Federal).

Estratégia:
- busca DJEN por "relação de credores" (frase que marca as publicações do art. 7º §2º e
  art. 52 §1º da Lei 11.101) por tribunal, com filtro de classe no cliente;
- instituições financeiras identificadas por dicionário/regex no texto oficial; valor
  associado apenas quando aparece a até 100 caracteres do nome (nível "observada");
  banco citado sem valor = "parcialmente observada"; demais casos = "não identificada";
- passivo total por regex ("total de créditos/passivo ... R$ X") — nível "declarado no ato";
- CNPJs do texto enriquecidos na BrasilAPI (CNAE, porte, UF); a associação CNPJ↔recuperanda
  é validada por sobreposição de tokens da razão social — sem correspondência, o dado é
  marcado como não associado (pode ser de terceiro citado no ato).
"""
import json
import re
import time

from pipeline import common
from pipeline.sources.djen import TAG_RE, CNPJ_RE

BANCOS_RE = re.compile(
    r"\b(BANCO(?:\s+[A-ZÀ-Ú&.]{2,18}){1,3}|ITA[ÚU] UNIBANCO|BRADESCO|SANTANDER|"
    r"CAIXA ECON[ÔO]MICA FEDERAL|BTG PACTUAL|SICOOB[A-Z/]*|SICREDI|BANRISUL|"
    r"[A-ZÀ-Ú]{3,25} FIDC|FIDC [A-ZÀ-Ú]{3,25}|[A-ZÀ-Ú]{3,30} SECURITIZADORA)\b",
    re.IGNORECASE)
BANCOS_BLACKLIST = ("BANCO CENTRAL", "BANCO DE DADOS", "BANCO DO CONHECIMENTO")
_STOP_FINAL = {"DE", "DA", "DO", "DOS", "DAS", "E", "EM", "COM", "PARA", "QUE",
               "SA", "S.A", "S.A.", "LTDA", "LTDA."}
VALOR_PROX_RE = r"[\s\S]{0,100}?R\$\s*([\d.]{4,}(?:,\d{2})?)"
PASSIVO_RE = re.compile(r"(?:total (?:de |dos )?cr[eé]ditos|passivo(?: total)?)[\s\S]{0,60}?R\$\s*([\d.]{4,}(?:,\d{2})?)",
                        re.IGNORECASE)
# classes do quadro de credores (art. 41 da Lei 11.101) com subtotal adjacente
CLASSES_QGC = [
    ("trabalhista", r"classe\s+I\b|trabalhistas?"),
    ("garantia_real", r"classe\s+II\b|garantia\s+real"),
    ("quirografario", r"classe\s+III\b|quirograf[aá]ri"),
    ("me_epp", r"classe\s+IV\b|\bME\s*/?\s*EPP\b"),
]


def extrai_classes_qgc(texto):
    """{classe: valor} quando um subtotal R$ aparece até 120 chars após o marcador da classe."""
    out = {}
    for slug, pat in CLASSES_QGC:
        for m in re.finditer(pat, texto, re.IGNORECASE):
            trecho = texto[m.end():m.end() + 140]
            vm = re.search(r"R\$\s*([\d.]{4,}(?:,\d{2})?)", trecho)
            if vm:
                out[slug] = vm.group(1)
                break
    return out


def _norm_banco(nome):
    n = re.sub(r"\s+", " ", nome.upper().strip())
    toks = n.split(" ")
    while len(toks) > 1 and toks[-1] in _STOP_FINAL:
        toks.pop()
    return " ".join(toks)[:48]


def extrai_credores(texto):
    """[(banco_normalizado, valor|None)] — valor só quando adjacente (<=100 chars)."""
    out = {}
    for m in BANCOS_RE.finditer(texto):
        nome = _norm_banco(m.group(0))
        if any(b in nome for b in BANCOS_BLACKLIST) or len(nome) < 5:
            continue
        trecho = texto[m.end():m.end() + 120]
        vm = re.match(VALOR_PROX_RE, trecho)
        valor = vm.group(1) if vm else None
        if nome not in out or (valor and not out[nome]):
            out[nome] = valor
    return sorted(out.items())


def collect(con, cfg):
    c = cfg.get("djen")
    if not c:
        return [{"key": "djen_credores", "ok": False, "error": "sem configuração"}]
    import urllib.parse
    from datetime import date, timedelta
    con.execute("""CREATE TABLE IF NOT EXISTS rj_credores(
        numero_processo TEXT PRIMARY KEY, tribunal TEXT, classe TEXT, bancos TEXT,
        passivo_total TEXT, cnpjs TEXT, ultima_publicacao TEXT, n_atos INTEGER, collected_at TEXT)""")
    try:
        con.execute("ALTER TABLE rj_credores ADD COLUMN passivo_classes TEXT")
    except Exception:
        pass  # coluna já existe
    con.execute("DELETE FROM rj_credores")
    fim = date.today()
    ini = fim - timedelta(days=60)
    results = []
    for trib in c["tribunais"]:
        casos = {}
        try:
            for pagina in range(1, 9):
                params = {"pagina": pagina, "itensPorPagina": 100,
                          "texto": "relação de credores", "siglaTribunal": trib,
                          "dataDisponibilizacaoInicio": ini.isoformat(),
                          "dataDisponibilizacaoFim": fim.isoformat()}
                url = c["base_url"] + "?" + urllib.parse.urlencode(params)
                body, meta = common.http_get(url, timeout=90)
                d = json.loads(body)
                items = d.get("items", [])
                if pagina == 1:
                    common.save_bronze("djen", f"credores_{trib}_p1", body, meta)
                for it in items:
                    classe = (it.get("nomeClasse") or "").upper()
                    if not ("RECUPERA" in classe or "FALÊNCIA" in classe or "FALENCIA" in classe):
                        continue
                    num = it.get("numeroprocessocommascara") or it.get("numero_processo")
                    if not num:
                        continue
                    texto = TAG_RE.sub(" ", it.get("texto") or "")
                    f = casos.setdefault(num, {"tribunal": trib, "classe": it.get("nomeClasse"),
                                               "bancos": {}, "passivo": None, "cnpjs": set(),
                                               "ultima": "", "n": 0, "classes_qgc": {}})
                    for nome, valor in extrai_credores(texto):
                        if nome not in f["bancos"] or (valor and not f["bancos"][nome]):
                            f["bancos"][nome] = valor
                    pm = PASSIVO_RE.search(texto)
                    if pm and not f["passivo"]:
                        f["passivo"] = pm.group(1)
                    for cl, v in extrai_classes_qgc(texto).items():
                        f["classes_qgc"].setdefault(cl, v)
                    f["cnpjs"].update(CNPJ_RE.findall(texto)[:5])
                    f["ultima"] = max(f["ultima"], it.get("data_disponibilizacao") or "")
                    f["n"] += 1
                if len(items) < 100:
                    break
                time.sleep(c["pausa_s"])
            n_com_banco = 0
            for num, f in casos.items():
                if not f["bancos"] and not f["passivo"] and not f["classes_qgc"]:
                    continue
                bancos = [{"nome": n, "valor": v,
                           "classificacao": "observada" if v else "parcialmente observada"}
                          for n, v in sorted(f["bancos"].items())]
                con.execute("""INSERT OR REPLACE INTO rj_credores
                               (numero_processo, tribunal, classe, bancos, passivo_total, cnpjs,
                                ultima_publicacao, n_atos, collected_at, passivo_classes)
                               VALUES(?,?,?,?,?,?,?,?,?,?)""",
                            (num, f["tribunal"], f["classe"],
                             json.dumps(bancos, ensure_ascii=False), f["passivo"],
                             json.dumps(sorted(f["cnpjs"]), ensure_ascii=False),
                             f["ultima"], f["n"], common.now_utc(),
                             json.dumps(f["classes_qgc"], ensure_ascii=False)))
                n_com_banco += 1
            results.append({"key": f"credores_{trib}", "ok": True, "casos": n_com_banco})
        except Exception as e:
            results.append({"key": f"credores_{trib}", "ok": False, "error": str(e)})
    results.extend(enrich_cnpjs(con, cfg))
    return results


def enrich_cnpjs(con, cfg, max_lookups=40):
    """Enriquece CNPJs das fichas na BrasilAPI (cache local; pausas educadas)."""
    con.execute("""CREATE TABLE IF NOT EXISTS cnpj_cache(
        cnpj TEXT PRIMARY KEY, razao TEXT, cnae TEXT, cnae_desc TEXT, porte TEXT,
        uf TEXT, municipio TEXT, situacao TEXT, fetched_at TEXT)""")
    cnpjs = set()
    for tbl in ("rj_fichas", "rj_credores"):
        try:
            for (js,) in con.execute(f"SELECT cnpjs FROM {tbl}").fetchall():
                for c in json.loads(js or "[]"):
                    digits = re.sub(r"\D", "", c)
                    if len(digits) == 14:
                        cnpjs.add(digits)
        except Exception:
            pass
    cached = {r[0] for r in con.execute("SELECT cnpj FROM cnpj_cache").fetchall()}
    pend = sorted(cnpjs - cached)[:max_lookups]
    ok = 0
    for cnpj in pend:
        try:
            body, meta = common.http_get(f"https://brasilapi.com.br/api/cnpj/v1/{cnpj}", timeout=30)
            d = json.loads(body)
            con.execute("INSERT OR REPLACE INTO cnpj_cache VALUES(?,?,?,?,?,?,?,?,?)",
                        (cnpj, d.get("razao_social"), str(d.get("cnae_fiscal") or ""),
                         d.get("cnae_fiscal_descricao"), d.get("porte"), d.get("uf"),
                         d.get("municipio"), d.get("descricao_situacao_cadastral"), common.now_utc()))
            ok += 1
            time.sleep(1.0)
        except Exception:
            continue  # CNPJ inválido/limite: segue sem enriquecer (nunca inventa)
    return [{"key": "cnpj_enrich", "ok": True, "novos": ok, "pendentes": len(pend) - ok,
             "cache_total": len(cached) + ok}]
