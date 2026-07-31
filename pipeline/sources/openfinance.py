"""Conector Open Finance Brasil — dados REAIS (Fase 5).

Duas fontes públicas:
1. Dashboard do Cidadão (dashboard.openfinancebrasil.org.br) — a própria página consome
   rotas POST /api/consents e /api/api-requests, com validação autodescritiva (descoberto
   empiricamente em 2026-07; endpoints não documentados formalmente — risco de quebra
   documentado no mapa de fontes). Métricas semanais: consentimentos ativos (transmissor/
   receptor), chamadas de API por fase/família/organização e status (taxa de sucesso).
2. Diretório oficial de participantes (data.directory.openbankingbrasil.org.br/participants)
   — JSON público documentado com organizações, papéis e famílias de API.
"""
import json
import time
import urllib.request

from pipeline import common

DASH = "https://dashboard.openfinancebrasil.org.br/api"
DIRECTORY = "https://data.directory.openbankingbrasil.org.br/participants"
PHASES = {"transactional-data": "dados_transacionais", "open-data": "dados_abertos",
          "payment-initiation": "iniciacao_pagamento"}


def _post(path, payload, timeout=60, retries=3):
    body = json.dumps(payload).encode()
    last = None
    for att in range(retries):
        try:
            req = urllib.request.Request(f"{DASH}{path}", data=body, method="POST", headers={
                "Content-Type": "application/json", "User-Agent": common.USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read()
                return json.loads(raw), raw
        except Exception as e:
            last = e
            time.sleep(3 * (att + 1))
    raise RuntimeError(f"Dashboard OF POST {path} falhou: {last}")


def _weekly_series(rows, value_key="value"):
    return sorted((r["date"][:10], float(r.get(value_key, r.get("total", 0)))) for r in rows)


def collect(con, cfg):
    results = []
    con.execute("""CREATE TABLE IF NOT EXISTS of_ranking(
        organisation TEXT, phase TEXT, chamadas REAL, collected_at TEXT,
        PRIMARY KEY(organisation, phase))""")
    con.execute("""CREATE TABLE IF NOT EXISTS of_participants(
        org_id TEXT PRIMARY KEY, nome TEXT, status TEXT, n_auth_servers INTEGER,
        familias_api TEXT, papeis TEXT, collected_at TEXT)""")

    # 1) consentimentos ativos (semanal) — transmissor (server) e receptor (client)
    for role, key, nome in (("server", "of_consentimentos_transmitidos", "Consentimentos ativos — transmissores (server)"),
                            ("client", "of_consentimentos_recebidos", "Consentimentos ativos — receptores (client)")):
        try:
            data, raw = _post("/consents", {"role": role})
            bronze, sha = common.save_bronze("openfinance", f"consents_{role}", raw,
                                             {"url": f"{DASH}/consents", "collected_at": common.now_utc()})
            rows = _weekly_series(data)
            common.upsert_meta(con, "Open Finance Brasil (Dashboard do Cidadão)", f"consents:{role}",
                               key, nome, "consentimentos ativos", "semanal",
                               "Rota pública consumida pelo próprio Dashboard do Cidadão (não documentada formalmente)",
                               f"{DASH}/consents", "of", "openfinance")
            common.insert_obs(con, key, rows, sha)
            common.record_lineage(con, f"series:{key}", bronze, sha, "POST /api/consents; série semanal")
            results.append({"key": key, "ok": True, "obs": len(rows)})
        except Exception as e:
            results.append({"key": key, "ok": False, "error": str(e)})

    # 2) chamadas de API por fase (semanal) + taxa de sucesso
    for phase, slug in PHASES.items():
        try:
            data, raw = _post("/api-requests", {"axis": "date", "phase": phase})
            bronze, sha = common.save_bronze("openfinance", f"requests_{slug}", raw,
                                             {"url": f"{DASH}/api-requests", "collected_at": common.now_utc()})
            key = f"of_chamadas_{slug}"
            common.upsert_meta(con, "Open Finance Brasil (Dashboard do Cidadão)", f"api-requests:{phase}",
                               key, f"Chamadas de API — {slug.replace('_', ' ')}", "chamadas/semana", "semanal",
                               "Rota pública do Dashboard do Cidadão", f"{DASH}/api-requests", "of", "openfinance")
            common.insert_obs(con, key, _weekly_series(data), sha)
            results.append({"key": key, "ok": True, "obs": len(data)})
            time.sleep(1)

            st, raw2 = _post("/api-requests", {"axis": "status", "phase": phase})
            bronze2, sha2 = common.save_bronze("openfinance", f"status_{slug}", raw2,
                                               {"url": f"{DASH}/api-requests", "collected_at": common.now_utc()})
            rows = []
            for wk in st:
                total = wk.get("total") or 0
                ok2xx = sum(s["count"] for s in wk.get("status", []) if 200 <= s.get("code", 0) < 400)
                if total > 0:
                    rows.append((wk["date"][:10], ok2xx / total * 100))
            key2 = f"of_sucesso_{slug}"
            common.upsert_meta(con, "Open Finance Brasil (Dashboard do Cidadão)", f"api-requests:status:{phase}",
                               key2, f"Taxa de sucesso das chamadas (códigos 2xx/3xx) — {slug.replace('_', ' ')}",
                               "%", "semanal", "Calculado: respostas 2xx-3xx ÷ total, por semana",
                               f"{DASH}/api-requests", "of", "openfinance")
            common.insert_obs(con, key2, sorted(rows), sha2)
            results.append({"key": key2, "ok": True, "obs": len(rows)})
            time.sleep(1)
        except Exception as e:
            results.append({"key": f"of_{slug}", "ok": False, "error": str(e)})

    # 3) ranking nominal de chamadas por organização — TODAS as fases (mobilidade preservada
    #    em of_ranking_hist; ausência de org no ranking divulgado ≠ zero de atividade)
    con.execute("""CREATE TABLE IF NOT EXISTS of_ranking_hist(
        coletado_em TEXT, organisation TEXT, phase TEXT, chamadas REAL,
        PRIMARY KEY(coletado_em, organisation, phase))""")
    con.execute("DELETE FROM of_ranking")
    hoje = common.now_utc()[:10]
    for phase in PHASES:
        try:
            data, raw = _post("/api-requests", {"axis": "organisation", "phase": phase})
            bronze, sha = common.save_bronze("openfinance", f"ranking_org_{PHASES[phase]}", raw,
                                             {"url": f"{DASH}/api-requests", "collected_at": common.now_utc()})
            for r in data:
                org = r.get("organisation") or r.get("_id")
                con.execute("INSERT OR REPLACE INTO of_ranking VALUES(?,?,?,?)",
                            (org, phase, float(r.get("total", 0)), common.now_utc()))
                con.execute("INSERT OR REPLACE INTO of_ranking_hist VALUES(?,?,?,?)",
                            (hoje, org, phase, float(r.get("total", 0))))
            common.record_lineage(con, f"of_ranking:{phase}", bronze, sha, "POST axis=organisation")
            results.append({"key": f"of_ranking_{PHASES[phase]}", "ok": True, "orgs": len(data)})
            time.sleep(1)
        except Exception as e:
            results.append({"key": f"of_ranking_{PHASES[phase]}", "ok": False, "error": str(e)})

    # 3b) chamadas por endpoint e por família de API, por fase (snapshot)
    con.execute("""CREATE TABLE IF NOT EXISTS of_endpoints(
        phase TEXT, tipo TEXT, nome TEXT, chamadas REAL, coletado_em TEXT,
        PRIMARY KEY(phase, tipo, nome))""")
    con.execute("DELETE FROM of_endpoints")
    for phase in PHASES:
        for axis, tipo in (("endpoint", "endpoint"), ("api", "familia")):
            try:
                data, raw = _post("/api-requests", {"axis": axis, "phase": phase})
                common.save_bronze("openfinance", f"{tipo}_{PHASES[phase]}", raw,
                                   {"url": f"{DASH}/api-requests", "collected_at": common.now_utc()})
                for r in data:
                    nome = r.get("endpoint") or r.get("name") or r.get("api") or str(r.get("_id"))
                    con.execute("INSERT OR REPLACE INTO of_endpoints VALUES(?,?,?,?,?)",
                                (phase, tipo, nome, float(r.get("total", 0)), common.now_utc()))
                results.append({"key": f"of_{tipo}_{PHASES[phase]}", "ok": True, "itens": len(data)})
                time.sleep(1)
            except Exception as e:
                results.append({"key": f"of_{tipo}_{PHASES[phase]}", "ok": False, "error": str(e)})

    # 4) diretório oficial de participantes
    try:
        body, meta = common.http_get(DIRECTORY, timeout=90)
        d = json.loads(body)
        bronze, sha = common.save_bronze("openfinance", "directory_participants", body, meta)
        con.execute("DELETE FROM of_participants")
        for org in d:
            fams = set()
            for asr in org.get("AuthorisationServers", []):
                for res in asr.get("ApiResources", []):
                    if res.get("ApiFamilyType"):
                        fams.add(res["ApiFamilyType"])
            papeis = sorted({c.get("Role") for c in org.get("OrgDomainRoleClaims", []) if c.get("Role")})
            con.execute("INSERT OR REPLACE INTO of_participants VALUES(?,?,?,?,?,?,?)",
                        (org["OrganisationId"], org.get("OrganisationName"), org.get("Status"),
                         len(org.get("AuthorisationServers", [])),
                         json.dumps(sorted(fams), ensure_ascii=False),
                         json.dumps(papeis, ensure_ascii=False), common.now_utc()))
        common.record_lineage(con, "of_participants", bronze, sha,
                              "diretório oficial: papéis e famílias de API por organização")
        results.append({"key": "of_participants", "ok": True, "orgs": len(d)})
    except Exception as e:
        results.append({"key": "of_participants", "ok": False, "error": str(e)})
    return results
