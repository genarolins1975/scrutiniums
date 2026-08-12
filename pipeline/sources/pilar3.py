"""Pilar 3 via DASFN — KM1 (métricas-chave prudenciais) de ~75 instituições.

A fonte é o arranjo de DADOS ABERTOS do próprio BCB (Res. BCB 54/2020 +
API DASFN): o BCB mantém o REGISTRO central (Olinda/DASFN, api 'pilar3') e
cada instituição serve os próprios JSONs no padrão KM1 num endpoint
declarado no registro. Estrutura federada, medida empiricamente em 08/2026:

- 75 instituições publicam KM1; os grandes (BB, Itaú, Santander, BTG,
  Safra, XP, Votorantim, ABC, Inter...) atualizados ao trimestre corrente.
- O payload KM1 traz 5 trimestres por arquivo (colunas t..t_4) — um fetch
  por instituição cobre mais de um ano.
- HETEROGENEIDADE declarada e tratada: escalas divergem por banco (BB
  publica índices em % [11.59]; Itaú/Santander em fração [0.12]) — a
  normalização é por régua de plausibilidade POR MÉTRICA, documentada em
  `_norm`. Só publicamos as MÉTRICAS-RAZÃO (ICP, Nível 1, Basileia, ACP,
  margem, alavancagem, LCR, NSFR): as linhas monetárias têm unidade
  ambígua entre bancos (R$ mil × R$ milhões) e ficam fora até segunda
  rodada — omitido, nunca adivinhado.
- Bradesco NÃO registra Pilar 3 no DASFN (verificado: zero registros) —
  ausência declarada; a alternativa (PDF do RI, Fase 2) fica para a
  próxima rodada. Caixa parou de atualizar em 2022 — ausência declarada.

Silver: pilar3_km1(cnpj8, nome, periodo AAAA-T, metric, value_pct).
Backfill natural: cada execução refaz só instituições sem o trimestre mais
recente do registro (idempotente; INSERT OR REPLACE), capado por execução.
"""
import json
import re
import urllib.request

from pipeline import common

REGISTRO = ("https://olinda.bcb.gov.br/olinda/servico/DASFN/versao/v1/odata/Recursos?"
            "$filter=Api%20eq%20'pilar3'&$format=json&$top=5000&$skip={skip}")

# linha KM1 -> métrica publicada (todas RAZÕES, em % após normalização)
LINHAS = {
    "km1_5": ("icp_pct", "capitalRegulamentarRwa"),
    "km1_6": ("nivel1_pct", "capitalRegulamentarRwa"),
    "km1_7": ("basileia_pct", "capitalRegulamentarRwa"),
    "km1_11": ("acp_total_pct", "adicionalCapitalPrincipalRwa"),
    "km1_12": ("margem_capital_principal_pct", "adicionalCapitalPrincipalRwa"),
    "km1_14": ("alavancagem_pct", "razaoAlavancagem"),
    "km1_17": ("lcr_pct", "liquidezCurtoPrazo"),
    "km1_20": ("nsfr_pct", "liquidezLongoPrazo"),
}


def _fetch(url, timeout=90, tentativas=2):
    """Um retry para os resets transientes da federação; erro final sobe."""
    ultimo = None
    for _ in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Observatorio)",
                                                       "Accept": "application/json"})
            return urllib.request.urlopen(req, timeout=timeout).read()
        except Exception as e:
            ultimo = e
    raise ultimo


# Sistêmicos primeiro: o cap por execução nunca deixa os S1/S2 para depois
PRIORIDADE = ("00000000", "60701190", "90400888", "30306294", "58160789", "60498557",
              "59588111", "17184037", "00360305", "00416968", "92702067", "07237373")


def _norm(metric, v):
    """Normaliza a escala heterogênea da federação para % (pontos percentuais).

    Réguas de plausibilidade por família (fração < limiar => ×100):
    índices de capital/ACP/alavancagem vivem em 1–30%: valor < 1 é fração;
    LCR/NSFR vivem em 100–400%: valor < 10 é fração. Fora de qualquer
    régua plausível => None (omitido, nunca publicado)."""
    if v is None:
        return None
    v = float(v)
    if metric in ("lcr_pct", "nsfr_pct"):
        if v < 10:
            v *= 100
        return v if 20 <= v <= 2000 else None
    if v < 1:
        v *= 100
    return v if 0 <= v <= 60 else None


def _tri_anterior(ano, tri, k):
    """k trimestres antes de (ano, tri)."""
    idx = ano * 4 + (tri - 1) - k
    return f"{idx // 4}-{idx % 4 + 1}"


def _grupos_por_secao(payload):
    """O payload agrupa linhas em seções km1_<secao>; achata para {linha: {t..t_4}}."""
    flat = {}
    for k, sec in payload.items():
        if not isinstance(sec, dict):
            continue
        for linha, cols in sec.items():
            if isinstance(cols, dict) and re.match(r"km1_\d+[a-z0-9]*$", linha):
                flat[linha] = cols
    return flat


def collect(con, cfg):
    con.execute("""CREATE TABLE IF NOT EXISTS pilar3_km1(
        cnpj8 TEXT, nome TEXT, periodo TEXT, metric TEXT, value_pct REAL,
        source_url TEXT, coletado_em TEXT, PRIMARY KEY(cnpj8, periodo, metric))""")
    c = cfg.get("pilar3", {})
    cap = int(c.get("fetch_por_execucao", 25))
    # 1) registro central (paginado)
    todos, skip = [], 0
    try:
        while True:
            body = _fetch(REGISTRO.format(skip=skip), timeout=120)
            vals = json.loads(body).get("value", [])
            todos.extend(vals)
            if len(vals) < 5000:
                break
            skip += 5000
        common.save_bronze("pilar3", "registro_dasfn", json.dumps(
            [v for v in todos if "km1" in str(v.get("URLDados", "")).lower()]).encode(), {"url": "DASFN pilar3"})
    except Exception as e:
        return [{"key": "pilar3:registro", "ok": False, "error": str(e)[:200]}]
    km1 = [v for v in todos if "km1" in str(v.get("URLDados", "")).lower()
           and v.get("Situacao") == "Produção" and v.get("URLDados")]
    # 2) último endpoint por instituição (o payload traz 5 trimestres)
    por_inst = {}
    for v in km1:
        cnpj8 = str(v.get("CnpjInstituicao", ""))[:8]
        if len(cnpj8) == 8:
            por_inst.setdefault(cnpj8, []).append(v)
    results = [{"key": "pilar3:registro", "ok": True, "instituicoes": len(por_inst)}]
    feitos = 0
    ordem = sorted(por_inst.items(),
                   key=lambda kv: (PRIORIDADE.index(kv[0]) if kv[0] in PRIORIDADE else 99, kv[0]))
    for cnpj8, regs in ordem:
        if feitos >= cap:
            results.append({"key": "pilar3:cap", "ok": True,
                            "pulado": f"cap de {cap} por execução atingido — retomado na próxima"})
            break
        regs.sort(key=lambda v: str(v.get("URLDados")))
        alvo = regs[-1]
        url, nome = alvo["URLDados"], alvo.get("NomeInstituicao", "")
        try:
            payload = json.loads(_fetch(url))
            tri_ref = str(payload.get("km1_trimestreReferencia") or "")
            m = re.match(r"^(\d{4})-(\d)$", tri_ref)
            if not m:
                results.append({"key": f"pilar3:{cnpj8}", "ok": False,
                                "error": f"trimestreReferencia fora do padrão: {tri_ref!r}"})
                continue
            ano, tri = int(m.group(1)), int(m.group(2))
            ja = con.execute("SELECT 1 FROM pilar3_km1 WHERE cnpj8=? AND periodo=? LIMIT 1",
                             (cnpj8, tri_ref)).fetchone()
            if ja:
                continue  # trimestre mais recente já absorvido — não conta no cap
            flat = _grupos_por_secao(payload)
            n = 0
            for linha, (metric, _) in LINHAS.items():
                cols = flat.get(linha) or {}
                for k, colname in enumerate(("t", "t_1", "t_2", "t_3", "t_4")):
                    bruto = cols.get(colname)
                    if bruto in (None, "", "0.00") and metric != "margem_capital_principal_pct":
                        # zero literal em razão prudencial = não reportado no padrão federado
                        continue
                    val = _norm(metric, bruto)
                    if val is None:
                        continue
                    con.execute("INSERT OR REPLACE INTO pilar3_km1 VALUES(?,?,?,?,?,?,?)",
                                (cnpj8, nome, _tri_anterior(ano, tri, k), metric, round(val, 2),
                                 url, common.now_utc()))
                    n += 1
            con.commit()
            feitos += 1
            results.append({"key": f"pilar3:{cnpj8}", "ok": True, "nome": nome[:30],
                            "tri": tri_ref, "valores": n})
        except Exception as e:
            feitos += 1  # falha consome o cap: nunca prende a rodada num endpoint quebrado
            results.append({"key": f"pilar3:{cnpj8}", "ok": False, "nome": nome[:30],
                            "error": str(e)[:150]})
    return results
