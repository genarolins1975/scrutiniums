"""Infraestrutura comum do pipeline: HTTP, bronze imutável, silver (SQLite), linhagem.

Somente biblioteca padrão (portabilidade do protótipo). Princípios:
- bronze é imutável: cada coleta gera arquivo novo com sha256 + metadados da requisição;
- silver nunca sobrescreve observação: divergência gera registro em `revisions` e novo vintage;
- ausência de dado não é zero: simplesmente não há linha.
"""
import gzip
import hashlib
import http.client
import json
import os
import sqlite3
import time
import traceback
import urllib.request
import urllib.error
from datetime import date, datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRONZE = os.path.join(ROOT, "data", "bronze")
SILVER = os.path.join(ROOT, "data", "silver")
GOLD = os.path.join(ROOT, "data", "gold")
DB_PATH = os.path.join(SILVER, "observatorio.db")
CONFIG_PATH = os.path.join(ROOT, "config", "config.json")

USER_AGENT = "ObservatorioBrasileiroDeCredito/0.1 (prototipo academico; dados abertos)"


def anomes_candidatos(n=5, hoje=None):
    """Os `n` fins de trimestre mais recentes até `hoje`, do mais novo ao mais antigo,
    no formato AAAAMM do IF.data (ex.: 202606, 202603, 202512...).

    Substitui a lista fixa que congelou o IF.data em 2026-03: com a lista escrita
    à mão, nenhum coletor jamais pedia o trimestre seguinte (auditoria de
    06/09/2026, achado D2). O trimestre corrente ainda não publicado devolve
    vazio na fonte e os coletores seguem para o anterior (ausência != zero)."""
    hoje = hoje or date.today()
    ano, mes = hoje.year, hoje.month
    fim = (mes - 1) // 3 * 3  # último mês do trimestre já encerrado (0 = ano anterior)
    if fim == 0:
        ano, fim = ano - 1, 12
    out = []
    for _ in range(n):
        out.append(f"{ano}{fim:02d}")
        fim -= 3
        if fim == 0:
            ano, fim = ano - 1, 12
    return out


def load_config():
    with open(CONFIG_PATH, encoding="utf-8") as f:
        cfg = json.load(f)
    ifd = cfg.get("ifdata") or {}
    cand = ifd.get("anomes_candidates")
    if isinstance(cand, str) and cand.startswith("auto"):
        n = int(cand.split(":")[1]) if ":" in cand else 5
        ifd["anomes_candidates"] = anomes_candidatos(n)
    return cfg


def now_utc():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def coletado_recentemente(iso, dias):
    """True se `iso` (carimbo de coleta) for mais novo que `dias`.

    Existe para as fontes cuja periodicidade REAL é semanal ou mensal e cujo
    arquivo é grande: baixar 32 MB todo dia para reprocessar a mesma posição
    consome o orçamento de tempo do pipeline diário sem produzir dado novo.
    A data da posição continua publicada no gold, então pular um dia não
    esconde nada do leitor.
    """
    if not iso:
        return False
    try:
        quando = datetime.fromisoformat(iso)
    except ValueError:
        return False
    if quando.tzinfo is None:
        quando = quando.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - quando).days < dias


def xml_escape(s):
    """Texto seguro dentro de elementos XML (títulos de RSS, sobretudo).
    Um '&' num nome de submodalidade quebra o feed inteiro no leitor."""
    return (str(s if s is not None else "")
            .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def http_get(url, timeout=45, retries=3, backoff=2.0, accept="application/json"):
    """GET com retry exponencial. Retorna (bytes, meta) ou lança após esgotar tentativas.

    `accept` existe porque o portal do Ministério da Previdência devolve **HTTP 401**
    quando um arquivo binário é pedido com `Accept: application/json` — o bloqueio é do
    cabeçalho, não do User-Agent, e foi medido em sete combinações. Passe `accept="*/*"`
    ou `accept=None` para baixar planilhas e ZIPs de fontes que se comportam assim.
    """
    last_err = None
    cabecalhos = {"User-Agent": USER_AGENT}
    if accept:
        cabecalhos["Accept"] = accept
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=cabecalhos)
            t0 = time.time()
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                body = resp.read()
                if body[:2] == b"\x1f\x8b":  # alguns servidores retornam gzip mesmo sem Accept-Encoding
                    body = gzip.decompress(body)
                meta = {
                    "url": url,
                    "status": resp.status,
                    "elapsed_s": round(time.time() - t0, 2),
                    "collected_at": now_utc(),
                    "attempt": attempt + 1,
                }
                return body, meta
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError,
                http.client.HTTPException) as e:
            # HTTPException cobre IncompleteRead: o download cortado do SCR.data
            # (05/09/2026) não era retentado porque não é OSError
            last_err = e
            time.sleep(backoff * (attempt + 1))
    raise RuntimeError(f"Falha ao coletar {url}: {last_err}")


def http_download(url, path, timeout=600, retries=3, backoff=5.0, bloco=1 << 20):
    """GET de arquivo grande direto para disco, em blocos, com retry. Grava num
    temporário e só renomeia quando o corpo veio inteiro (Content-Length
    conferido quando o servidor o informa): nunca deixa um zip pela metade
    com o nome final. Retorna (path, bytes)."""
    last_err = None
    tmp = path + ".part"
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=timeout) as resp, open(tmp, "wb") as f:
                esperado = resp.headers.get("Content-Length")
                total = 0
                while True:
                    chunk = resp.read(bloco)
                    if not chunk:
                        break
                    f.write(chunk)
                    total += len(chunk)
            if esperado and int(esperado) != total:
                raise http.client.IncompleteRead(b"", int(esperado) - total)
            os.replace(tmp, path)
            return path, total
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError,
                http.client.HTTPException) as e:
            last_err = e
            try:
                os.remove(tmp)
            except OSError:
                pass
            time.sleep(backoff * (attempt + 1))
    raise RuntimeError(f"Falha ao baixar {url}: {last_err}")


def save_bronze(source, name, body, meta):
    """Grava cópia imutável do payload bruto + metadados. Retorna (path, sha256)."""
    day = datetime.now(timezone.utc).strftime("%Y%m%d")
    dirpath = os.path.join(BRONZE, source, day)
    os.makedirs(dirpath, exist_ok=True)
    sha = hashlib.sha256(body).hexdigest()
    fname = f"{name}.{sha[:12]}.json"
    fpath = os.path.join(dirpath, fname)
    if not os.path.exists(fpath):  # imutável: mesmo conteúdo => mesmo hash => não regrava
        with open(fpath, "wb") as f:
            f.write(body)
        with open(fpath + ".meta.json", "w", encoding="utf-8") as f:
            json.dump({**meta, "sha256": sha, "bytes": len(body)}, f, ensure_ascii=False, indent=2)
    return os.path.relpath(fpath, ROOT), sha


def get_db():
    os.makedirs(SILVER, exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.execute("PRAGMA journal_mode=WAL")
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS series_meta(
            source TEXT, series_code TEXT, key TEXT PRIMARY KEY, name TEXT, unit TEXT,
            freq TEXT, methodology TEXT, url TEXT, segment TEXT, category TEXT,
            last_collected_at TEXT, quality_json TEXT
        );
        CREATE TABLE IF NOT EXISTS series_obs(
            key TEXT, ref_date TEXT, value REAL, collected_at TEXT, bronze_sha TEXT,
            PRIMARY KEY(key, ref_date)
        );
        CREATE TABLE IF NOT EXISTS revisions(
            key TEXT, ref_date TEXT, old_value REAL, new_value REAL, detected_at TEXT
        );
        CREATE TABLE IF NOT EXISTS institutions(
            cod_inst TEXT PRIMARY KEY, name TEXT, tcb TEXT, uf TEXT, municipio TEXT,
            sr TEXT, cod_congl_prud TEXT, collected_at TEXT
        );
        CREATE TABLE IF NOT EXISTS institution_metrics(
            cod_inst TEXT, anomes TEXT, metric TEXT, value REAL, source_report TEXT,
            bronze_sha TEXT, PRIMARY KEY(cod_inst, anomes, metric)
        );
        CREATE TABLE IF NOT EXISTS lineage(
            gold_object TEXT, bronze_file TEXT, sha256 TEXT, transform TEXT, created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS pipeline_runs(
            started_at TEXT, finished_at TEXT, status TEXT, detail TEXT
        );
        """
    )
    return con


def upsert_meta(con, source, series_code, key, name, unit, freq, methodology, url, segment="", category=""):
    con.execute(
        """INSERT INTO series_meta(source, series_code, key, name, unit, freq, methodology, url, segment, category, last_collected_at)
           VALUES(?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(key) DO UPDATE SET last_collected_at=excluded.last_collected_at, name=excluded.name""",
        (source, str(series_code), key, name, unit, freq, methodology, url, segment, category, now_utc()),
    )


def insert_obs(con, key, rows, bronze_sha):
    """rows: list[(ref_date_iso, value)]. Detecta revisões sem sobrescrever silenciosamente."""
    n_new, n_rev = 0, 0
    for ref_date, value in rows:
        if value is None:
            continue  # ausência não é zero
        cur = con.execute("SELECT value FROM series_obs WHERE key=? AND ref_date=?", (key, ref_date))
        row = cur.fetchone()
        if row is None:
            con.execute(
                "INSERT INTO series_obs(key, ref_date, value, collected_at, bronze_sha) VALUES(?,?,?,?,?)",
                (key, ref_date, value, now_utc(), bronze_sha),
            )
            n_new += 1
        elif abs(row[0] - value) > 1e-9:
            con.execute(
                "INSERT INTO revisions(key, ref_date, old_value, new_value, detected_at) VALUES(?,?,?,?,?)",
                (key, ref_date, row[0], value, now_utc()),
            )
            con.execute(
                "UPDATE series_obs SET value=?, collected_at=?, bronze_sha=? WHERE key=? AND ref_date=?",
                (value, now_utc(), bronze_sha, key, ref_date),
            )
            n_rev += 1
    return n_new, n_rev


def record_lineage(con, gold_object, bronze_file, sha256, transform):
    con.execute(
        "INSERT INTO lineage(gold_object, bronze_file, sha256, transform, created_at) VALUES(?,?,?,?,?)",
        (gold_object, bronze_file, sha256, transform, now_utc()),
    )


def get_series(con, key):
    """Retorna [(ref_date, value)] ordenado por data."""
    cur = con.execute("SELECT ref_date, value FROM series_obs WHERE key=? ORDER BY ref_date", (key,))
    return cur.fetchall()


def get_meta(con, key):
    cur = con.execute(
        "SELECT source, series_code, key, name, unit, freq, methodology, url, segment, category, last_collected_at FROM series_meta WHERE key=?",
        (key,),
    )
    row = cur.fetchone()
    if not row:
        return None
    cols = ["source", "series_code", "key", "name", "unit", "freq", "methodology", "url", "segment", "category", "last_collected_at"]
    return dict(zip(cols, row))


def ler_gold_opcional(name):
    """Lê um gold já escrito, ou None. Serve para módulos que reaproveitam algo de
    outro (a malha do IBGE, por exemplo) sem tornar a dependência obrigatória."""
    path = os.path.join(GOLD, name)
    if not os.path.exists(path):
        return None
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _escreve_atomico(path, texto):
    """Grava em temporário no mesmo diretório e renomeia: o leitor (e o rsync
    de publicação) nunca vê um gold pela metade se o processo morrer no meio
    da escrita (auditoria de 06/09/2026, achado T3)."""
    os.makedirs(os.path.dirname(path) or GOLD, exist_ok=True)
    tmp = f"{path}.{os.getpid()}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(texto)
    os.replace(tmp, path)
    return path


def write_gold_text(name, text):
    return _escreve_atomico(os.path.join(GOLD, name), text)


def write_gold(name, payload):
    return _escreve_atomico(os.path.join(GOLD, name),
                            json.dumps(payload, ensure_ascii=False, indent=1))


# Falhas de builder da execução corrente: cada uma vira um stub de erro no
# gold correspondente E uma linha em meta.json (`builders_falhos`), para que a
# vigília acuse builder quebrado mesmo quando a sentinela mantém a publicação
# anterior no ar (Comparar e Consignado ficaram semanas assim, achado D3).
FALHAS_BUILD = []


def falha_build(gold, exc):
    tb = traceback.format_exc(limit=6)
    FALHAS_BUILD.append({"gold": gold, "erro": str(exc)[:300], "traceback": tb[-1500:],
                         "em": now_utc()})
    print(f"  [FALHA] {gold}: {exc}")
    print(tb)


def stub(gold, exc, **extra):
    """Registra a falha e grava o stub de erro com os DOIS marcadores que a UI
    reconhece (`disponivel` e `ok`), unificando o contrato dos stubs."""
    falha_build(gold, exc)
    payload = {"disponivel": False, "ok": False, "error": str(exc)[:300], **extra}
    write_gold(gold, payload)
    return payload
