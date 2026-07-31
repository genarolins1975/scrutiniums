"""Conector CNJ/DataJud — séries reais de recuperação judicial e falência.

API pública do CNJ (Elasticsearch): POST {base}/api_publica_{tribunal}/_search com a
chave PÚBLICA divulgada na wiki oficial do CNJ. Classes TPU: 129 = Recuperação Judicial,
108 = Falência de Empresários/Sociedades/ME/EPP.

Decisões metodológicas (validadas empiricamente em 2026-07):
- O date_histogram do servidor NÃO é confiável: processos migrados do SAJ guardam
  dataAjuizamento como 'yyyyMMddHHmmss', que o índice interpreta como epoch-millis
  (datas no ano ~2611). Por isso os documentos são baixados e as datas interpretadas
  LOCALMENTE (aceitos formatos de 14 dígitos e ISO-8601; anos fora de 1990–2030 descartados
  e contados).
- Sem filtro de grau: G1/G2 do mesmo caso compartilham numeroProcesso — deduplicação local
  por numeroProcesso, mantendo a menor data de ajuizamento.
- Paginação por search_after com pausas (API tem limite de taxa); truncamentos são
  LOGADOS, nunca silenciosos.
- Série mensal = contagem de ajuizamentos; meses sem casos são zeros LEGÍTIMOS (contagem
  de eventos). Cobertura do DataJud é menor em anos antigos — série publicada a partir
  de `serie_inicio` (2019) com nota de qualidade.
"""
import json
import time
import urllib.request

from pipeline import common


def _post(url, payload, api_key, timeout=90, retries=3):
    body = json.dumps(payload).encode()
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=body, method="POST", headers={
                "Authorization": f"APIKey {api_key}",
                "Content-Type": "application/json",
                "User-Agent": common.USER_AGENT,
            })
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read())
        except Exception as e:
            last = e
            time.sleep(5 * (attempt + 1))  # backoff educado (limite de taxa da API pública)
    raise RuntimeError(f"DataJud POST falhou: {last}")


def _parse_data_ajuizamento(raw):
    """'20180717010319' | '2018-07-17T01:03:19...' -> 'YYYY-MM' ou None."""
    if not raw:
        return None
    s = str(raw)
    if len(s) >= 8 and s[:8].isdigit():
        y, m = s[:4], s[4:6]
    elif len(s) >= 7 and s[4] == "-":
        y, m = s[:4], s[5:7]
    else:
        return None
    if not ("1990" <= y <= "2030" and "01" <= m <= "12"):
        return None
    return f"{y}-{m}"


def _fetch_class(base, trib, classe, api_key, page_size, max_pages, pausa):
    """Baixa (numeroProcesso, dataAjuizamento) de todos os docs da classe no tribunal."""
    url = f"{base}/api_publica_{trib}/_search"
    docs = []
    search_after = None
    truncated = False
    for page in range(max_pages):
        q = {
            "size": page_size,
            "_source": ["numeroProcesso", "dataAjuizamento"],
            "track_total_hits": True,
            "query": {"term": {"classe.codigo": int(classe)}},
            # @timestamp (ingestão, precisão de ms) é ordenável em todos os tribunais; o
            # tiebreak por dataHoraUltimaAtualizacao reduz risco de pulos em empates.
            # Pulos residuais são mitigados pela deduplicação e documentados como limitação.
            "sort": [{"@timestamp": {"order": "asc"}},
                     {"dataHoraUltimaAtualizacao": {"order": "asc", "unmapped_type": "date"}}],
        }
        if search_after:
            q["search_after"] = search_after
        d = _post(url, q, api_key)
        hits = d.get("hits", {}).get("hits", [])
        if not hits:
            break
        for h in hits:
            src = h.get("_source", {})
            docs.append((src.get("numeroProcesso"), src.get("dataAjuizamento")))
        search_after = hits[-1].get("sort")
        total = d.get("hits", {}).get("total", {}).get("value", 0)
        if len(hits) < page_size:
            break
        if page == max_pages - 1 and len(docs) < total:
            truncated = True
        time.sleep(pausa)
    return docs, truncated


# Marcos processuais (códigos TPU observados nos próprios dados; rótulos = nome oficial do movimento)
FUNIL_MOVIMENTOS = {
    12041: "Recuperação judicial (mov. 12041)",
    210: "Concessão",
    466: "Homologação de Transação",
    202: "Decretação de falência (convolação)",
    208: "Não-decretação de falência",
    454: "Indeferimento da petição inicial",
    456: "Extinção",
}


def collect_funil(con, cfg):
    """Funil processual REAL da classe 129 por tribunal: nº de processos que registram cada
    movimento-marco (agregação terms em movimentos.codigo — 1 requisição por tribunal).

    Nota metodológica: a contagem é por DOCUMENTO do índice (G1/G2 do mesmo caso contam
    separadamente quando ambos registram o movimento — em geral os marcos ficam no G1);
    denominar percentuais pelo nº de processos únicos da série coletada."""
    c = cfg["datajud"]
    con.execute("""CREATE TABLE IF NOT EXISTS datajud_funil(
        tribunal TEXT, codigo INTEGER, nome TEXT, docs INTEGER, total_classe INTEGER,
        collected_at TEXT, PRIMARY KEY(tribunal, codigo))""")
    results = []
    for trib in c["tribunais"]:
        try:
            q = {"size": 0, "track_total_hits": True,
                 "query": {"term": {"classe.codigo": 129}},
                 "aggs": {"movs": {"terms": {"field": "movimentos.codigo", "size": 500}}}}
            d = _post(f"{c['base_url']}/api_publica_{trib}/_search", q, c["api_key_publica"])
            total = d["hits"]["total"]["value"]
            buckets = {b["key"]: b["doc_count"] for b in d["aggregations"]["movs"]["buckets"]}
            raw = json.dumps({"tribunal": trib, "total": total, "buckets": buckets}).encode()
            common.save_bronze("datajud", f"funil_129_{trib}", raw,
                               {"url": f"{c['base_url']}/api_publica_{trib}/_search",
                                "collected_at": common.now_utc()})
            for cod, nome in FUNIL_MOVIMENTOS.items():
                con.execute("""INSERT OR REPLACE INTO datajud_funil(tribunal, codigo, nome, docs, total_classe, collected_at)
                               VALUES(?,?,?,?,?,?)""",
                            (trib, cod, nome, buckets.get(cod, 0), total, common.now_utc()))
            results.append({"key": f"funil_{trib}", "ok": True, "total_classe129": total})
            time.sleep(c["pausa_entre_requisicoes_s"])
        except Exception as e:
            results.append({"key": f"funil_{trib}", "ok": False, "error": str(e)})
    return results


MARCOS_SERIES = {202: "convolacao_falencia", 456: "extincao_rj"}


def collect_marcos(con, cfg):
    """Séries mensais REAIS por marco processual (ex.: convolações em falência/mês).

    O campo movimentos não é nested no índice (agregações aninhadas retornam vazio),
    mas o filtro por movimentos.codigo funciona a nível de DOCUMENTO: baixamos apenas os
    processos que contêm o marco (poucas centenas) e extraímos localmente a data do
    movimento correspondente. Dedupe por processo; datas parseadas localmente."""
    c = cfg["datajud"]
    inicio = c.get("serie_inicio", "2019-01")
    results = []
    for marco, slug in MARCOS_SERIES.items():
        agg_counts = {}
        for trib in c["tribunais"]:
            try:
                url = f"{c['base_url']}/api_publica_{trib}/_search"
                counts = {}
                search_after = None
                best = {}
                for _page in range(4):
                    q = {"size": 200,
                         "_source": ["numeroProcesso", "movimentos.codigo", "movimentos.dataHora"],
                         "query": {"bool": {"filter": [{"term": {"classe.codigo": 129}},
                                                       {"term": {"movimentos.codigo": marco}}]}},
                         "sort": [{"@timestamp": {"order": "asc"}}]}
                    if search_after:
                        q["search_after"] = search_after
                    d = _post(url, q, c["api_key_publica"])
                    hits = d.get("hits", {}).get("hits", [])
                    if not hits:
                        break
                    for h in hits:
                        src = h["_source"]
                        num = src.get("numeroProcesso")
                        for m in src.get("movimentos", []):
                            if m.get("codigo") == marco:
                                ym = _parse_data_ajuizamento(m.get("dataHora"))
                                if ym and (num not in best or ym < best[num]):
                                    best[num] = ym  # primeira ocorrência do marco no processo
                    search_after = hits[-1].get("sort")
                    if len(hits) < 200:
                        break
                    time.sleep(c["pausa_entre_requisicoes_s"])
                for ym in best.values():
                    counts[ym] = counts.get(ym, 0) + 1
                    if ym >= inicio:
                        agg_counts[ym] = agg_counts.get(ym, 0) + 1
                raw = json.dumps({"tribunal": trib, "marco": marco,
                                  "processos": sorted(best.items())}).encode()
                common.save_bronze("datajud", f"marco_{marco}_{trib}", raw,
                                   {"url": url, "collected_at": common.now_utc(),
                                    "processos": len(best)})
                results.append({"key": f"{slug}_{trib}", "ok": True, "processos": len(best)})
                time.sleep(c["pausa_entre_requisicoes_s"])
            except Exception as e:
                results.append({"key": f"{slug}_{trib}", "ok": False, "error": str(e)})
        if agg_counts:
            key = f"{slug}_agregado"
            nome = ("Convolações de RJ em falência (mov. 202)" if marco == 202
                    else "Extinções de processos de RJ (mov. 456)")
            tribs = ",".join(t.upper() for t in c["tribunais"])
            common.upsert_meta(con, "CNJ/DataJud", f"classe 129 + mov {marco} ({tribs})", key,
                               f"{nome} — agregado {tribs}", "processos/mês", "mensal",
                               "Data do primeiro movimento-marco em cada processo; parse local; "
                               "dedupe por processo; meses parciais omitidos",
                               c["base_url"], "pj", "recuperacao_judicial")
            common.insert_obs(con, key, _monthly_rows(agg_counts, inicio), "marcos")
            common.record_lineage(con, f"series:{key}", f"datajud/marco_{marco}_*", "-",
                                  "filtro doc-level movimentos.codigo + extração local de dataHora")
    return results


def _monthly_rows(counts, inicio):
    """Série mensal de `inicio` até o mês M-2 (últimos 2 meses omitidos por serem parciais)."""
    today = common.now_utc()[:7]
    y, m = int(today[:4]), int(today[5:7]) - 2
    if m <= 0:
        m, y = m + 12, y - 1
    cutoff = f"{y:04d}-{m:02d}"
    rows = []
    y, m = int(inicio[:4]), int(inicio[5:7])
    while f"{y:04d}-{m:02d}" <= cutoff:
        ym = f"{y:04d}-{m:02d}"
        rows.append((f"{ym}-01", float(counts.get(ym, 0))))
        m += 1
        if m > 12:
            m, y = 1, y + 1
    return rows


def collect(con, cfg):
    c = cfg.get("datajud")
    if not c:
        return [{"key": "datajud", "ok": False, "error": "sem configuração"}]
    results = []
    inicio = c.get("serie_inicio", "2019-01")
    agg_by_class = {}  # classe_slug -> {ym: count} agregado dos tribunais
    for trib in c["tribunais"]:
        for classe, slug in c["classes"].items():
            try:
                docs, truncated = _fetch_class(c["base_url"], trib, classe, c["api_key_publica"],
                                               c["page_size"], c["max_pages_por_consulta"],
                                               c["pausa_entre_requisicoes_s"])
                # dedupe por numeroProcesso (G1/G2), menor data válida
                best = {}
                descartadas = 0
                for num, raw in docs:
                    ym = _parse_data_ajuizamento(raw)
                    if ym is None:
                        descartadas += 1
                        continue
                    if num not in best or ym < best[num]:
                        best[num] = ym
                counts = {}
                for ym in best.values():
                    counts[ym] = counts.get(ym, 0) + 1
                # bronze: subconjunto essencial do payload original (nº processo + data), auditável
                raw_payload = json.dumps({"tribunal": trib, "classe": classe,
                                          "docs": sorted(best.items())}, ensure_ascii=False).encode()
                bronze_file, sha = common.save_bronze(
                    "datajud", f"{slug}_{trib}", raw_payload,
                    {"url": f"{c['base_url']}/api_publica_{trib}/_search", "collected_at": common.now_utc(),
                     "docs_baixados": len(docs), "processos_unicos": len(best),
                     "datas_invalidas_descartadas": descartadas, "truncado": truncated})
                key = f"{slug}_{trib}"
                # série mensal de `inicio` até M-2: os 2 meses mais recentes são PARCIAIS
                # (atraso de remessa dos tribunais ao DataJud) e não são publicados
                rows = _monthly_rows(counts, inicio)
                nome_classe = "Recuperações judiciais" if classe == "129" else "Falências"
                common.upsert_meta(con, "CNJ/DataJud", f"classe {classe}", key,
                                   f"{nome_classe} ajuizadas — {trib.upper()} (novos processos/mês)",
                                   "processos/mês", "mensal",
                                   "Contagem de ajuizamentos (classe TPU) na API pública do DataJud; "
                                   "dedupe por nº de processo; datas interpretadas localmente",
                                   f"{c['base_url']}/api_publica_{trib}/_search", "pj", "recuperacao_judicial")
                common.insert_obs(con, key, rows, sha)
                common.record_lineage(con, f"series:{key}", bronze_file, sha,
                                      "DataJud _search paginado; dedupe numeroProcesso; parse local de datas; contagem mensal")
                agg = agg_by_class.setdefault(slug, {})
                for ym, n in counts.items():
                    if ym >= inicio:
                        agg[ym] = agg.get(ym, 0) + n
                results.append({"key": key, "ok": True, "processos": len(best),
                                "descartadas": descartadas, "truncado": truncated})
            except Exception as e:
                results.append({"key": f"{slug}_{trib}", "ok": False, "error": str(e)})
    rebuild_agregados(con, cfg)
    results.extend(collect_funil(con, cfg))
    return results


def rebuild_agregados(con, cfg):
    """Reconstrói as séries agregadas a partir das séries POR TRIBUNAL já no silver —
    imune a coletas parciais (subconjuntos de tribunais) que enviesariam a soma."""
    c = cfg["datajud"]
    inicio = c.get("serie_inicio", "2019-01")
    tribs = ",".join(t.upper() for t in c["tribunais"])
    for classe, slug in c["classes"].items():
        sums = {}
        cobertos = []
        for t in c["tribunais"]:
            s = common.get_series(con, f"{slug}_{t}")
            if not s:
                continue
            cobertos.append(t.upper())
            for d, v in s:
                sums[d] = sums.get(d, 0.0) + v
        if not sums:
            continue
        nome_classe = "Recuperações judiciais" if classe == "129" else "Falências"
        key = f"{slug}_agregado"
        rows = sorted(sums.items())
        common.upsert_meta(con, "CNJ/DataJud", f"classe {classe} ({','.join(cobertos)})", key,
                           f"{nome_classe} ajuizadas — agregado {','.join(cobertos)}",
                           "processos/mês", "mensal",
                           "Soma das séries por tribunal no silver; cobertura do DataJud varia por tribunal/período",
                           c["base_url"], "pj", "recuperacao_judicial")
        common.insert_obs(con, key, rows, "agregado")
