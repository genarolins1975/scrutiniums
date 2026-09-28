"""Infraestrutura do domínio Energia: caminhos, bronze, silver com vintages.

Silver (data/energia/silver/energia.db):

    vintages(vintage_id, dataset, recurso, url, capturado_em, publicado_em,
             sha256, bytes, origem, arquivo)
    observacoes(dataset, serie, ref, valor, vintage_id)   -- append only
    coletas(dataset, recurso, tentado_em, ok, detalhe)     -- log de tentativas

Uma observação ganha linha nova só quando o valor difere do último valor
conhecido para (dataset, serie, ref): revisão fica registrada, nunca
sobrescrita. Valor ausente não gera linha (ausência não é zero).
"""
import gzip
import hashlib
import json
import os
import sqlite3
import subprocess
from datetime import datetime, timezone

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DADOS = os.path.join(RAIZ, "data", "energia")
BRONZE = os.path.join(DADOS, "bronze")
SILVER = os.path.join(DADOS, "silver")
DB_PATH = os.path.join(SILVER, "energia.db")
# Gold escrita direto no diretório publicado; a sentinela (sanidade.py) compara
# com a versão do git antes do commit, como no Crédito.
GOLD = os.path.join(RAIZ, "public", "energia", "gold")
SERIES = os.path.join(RAIZ, "public", "energia", "series")
SEED = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed")

VERSAO_PIPELINE = "energia-0.1.0"
DOMINIO = "energia"


def agora_utc():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def instante_utc(valor):
    """Normaliza um instante para o formato canônico das vintages (AAAA-MM-DDTHH:MM:SSZ,
    UTC). Exige fuso explícito: um instante sem fuso ou só com a data é ambíguo e, numa
    consulta temporal, poderia antecipar dado (look-ahead). Frações de segundo são
    truncadas para baixo, o que nunca antecipa."""
    if not isinstance(valor, str) or len(valor) <= 10 or "T" not in valor:
        raise ValueError(f"instante sem hora ou sem fuso: {valor!r}")
    txt = valor[:-1] + "+00:00" if valor.endswith("Z") else valor
    dt = datetime.fromisoformat(txt)
    if dt.tzinfo is None:
        raise ValueError(f"instante sem fuso: {valor!r}")
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def versao_codigo():
    """Commit do código que gerou a gold (curto). None fora de um checkout git."""
    env = os.environ.get("GITHUB_SHA")
    if env:
        return env[:12]
    try:
        out = subprocess.run(["git", "-C", RAIZ, "rev-parse", "--short=12", "HEAD"],
                             capture_output=True, text=True, timeout=10)
        sha = out.stdout.strip() or None
        # código com alteração não commitada: a gold não corresponde exatamente ao commit
        # (as próprias saídas do pipeline não contam)
        suja = subprocess.run(
            ["git", "-C", RAIZ, "status", "--porcelain", "--", ".", ":(exclude)public/energia", ":(exclude)data"],
            capture_output=True, text=True, timeout=10).stdout.strip()
        return f"{sha}+alterado" if sha and suja else sha
    except Exception:
        return None


def sha256_bytes(b):
    return hashlib.sha256(b).hexdigest()


def salva_bronze(orgao, dataset, recurso, corpo, ext, capturado_em):
    """Cópia imutável do arquivo primário. Mesmo conteúdo, mesmo nome: não regrava."""
    sha = sha256_bytes(corpo)
    pasta = os.path.join(BRONZE, orgao, dataset, recurso)
    os.makedirs(pasta, exist_ok=True)
    carimbo = capturado_em.replace(":", "").replace("-", "")
    existentes = [n for n in os.listdir(pasta) if sha[:12] in n]
    if existentes:
        return os.path.relpath(os.path.join(pasta, existentes[0]), RAIZ), sha
    caminho = os.path.join(pasta, f"{carimbo}.{sha[:12]}.{ext}.gz")
    with gzip.open(caminho, "wb") as f:
        f.write(corpo)
    return os.path.relpath(caminho, RAIZ), sha


def conecta(caminho=None):
    caminho = caminho or DB_PATH
    if caminho != ":memory:":
        os.makedirs(os.path.dirname(caminho), exist_ok=True)
    con = sqlite3.connect(caminho)
    con.execute("PRAGMA journal_mode=WAL") if caminho != ":memory:" else None
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS vintages(
            vintage_id TEXT PRIMARY KEY, dataset TEXT NOT NULL, recurso TEXT NOT NULL,
            url TEXT, capturado_em TEXT NOT NULL, publicado_em TEXT, sha256 TEXT NOT NULL,
            bytes INTEGER, origem TEXT NOT NULL, arquivo TEXT
        );
        CREATE TABLE IF NOT EXISTS observacoes(
            dataset TEXT NOT NULL, serie TEXT NOT NULL, ref TEXT NOT NULL,
            valor REAL NOT NULL, vintage_id TEXT NOT NULL,
            PRIMARY KEY(dataset, serie, ref, vintage_id)
        );
        CREATE INDEX IF NOT EXISTS idx_obs_serie ON observacoes(dataset, serie, ref);
        CREATE TABLE IF NOT EXISTS coletas(
            dataset TEXT, recurso TEXT, tentado_em TEXT, ok INTEGER, detalhe TEXT
        );
        """
    )
    return con


def registra_vintage(con, dataset, recurso, url, capturado_em, publicado_em, sha256, nbytes,
                     origem, arquivo):
    """Registra a captura. Mesmo sha256 do mesmo recurso = mesma vintage (idempotente).
    Retorna (vintage_id, nova)."""
    vid = f"{dataset}:{recurso}:{sha256[:16]}"
    capturado_em = instante_utc(capturado_em)
    row = con.execute("SELECT 1 FROM vintages WHERE vintage_id=?", (vid,)).fetchone()
    if row:
        return vid, False
    con.execute(
        "INSERT INTO vintages VALUES(?,?,?,?,?,?,?,?,?,?)",
        (vid, dataset, recurso, url, capturado_em, publicado_em, sha256, nbytes, origem, arquivo),
    )
    return vid, True


def registra_coleta(con, dataset, recurso, ok, detalhe=""):
    con.execute("INSERT INTO coletas VALUES(?,?,?,?,?)",
                (dataset, recurso, agora_utc(), 1 if ok else 0, str(detalhe)[:500]))


def _ultimos_valores(con, dataset, series, ate=None):
    """{(serie, ref): valor} do último valor conhecido até a captura `ate` (inclusive)
    pela ordem de captura, não de importação."""
    out = {}
    if not series:
        return out
    marcas = ",".join("?" * len(series))
    filtro, extra = ("AND v.capturado_em <= ?", (ate,)) if ate else ("", ())
    cur = con.execute(
        f"""SELECT o.serie, o.ref, o.valor FROM observacoes o
            JOIN vintages v ON v.vintage_id = o.vintage_id
            WHERE o.dataset=? AND o.serie IN ({marcas}) {filtro}
            ORDER BY v.capturado_em, o.rowid""",
        (dataset, *series, *extra),
    )
    for serie, ref, valor in cur:
        out[(serie, ref)] = valor
    return out


def grava_observacoes(con, dataset, vintage_id, linhas):
    """linhas: iterável de (serie, ref, valor). Retorna (novas, revisoes).
    Valor None é ignorado: ausência não vira linha nem zero.

    A comparação é com o valor conhecido na data de captura desta vintage (ordem de
    captura, não de importação): importar uma vintage antiga depois de uma nova não
    apaga o valor antigo da reconstituição temporal. Uma mesma (série, referência)
    repetida dentro do arquivo fica com a última ocorrência e não conta como revisão."""
    unicas = {}
    for s_, r_, v_ in linhas:
        if v_ is not None:
            unicas[(s_, r_)] = v_
    linhas = [(s_, r_, v_) for (s_, r_), v_ in unicas.items()]
    series = sorted({s for s, _, _ in linhas})
    cap = con.execute("SELECT capturado_em, recurso FROM vintages WHERE vintage_id=?", (vintage_id,)).fetchone()
    anteriores = _ultimos_valores(con, dataset, series, ate=cap[0] if cap else None)
    # vintage importada fora de ordem: a captura seguinte do mesmo arquivo pode não ter
    # linha para uma (série, referência) porque, quando entrou, o valor era igual ao da
    # anterior. Guardamos o valor que ela representava para restaurá-lo depois.
    seguinte = None
    if cap:
        seguinte = con.execute(
            """SELECT vintage_id, capturado_em FROM vintages WHERE dataset=? AND recurso=? AND capturado_em > ?
               ORDER BY capturado_em LIMIT 1""",
            (dataset, cap[1], cap[0]),
        ).fetchone()
    na_seguinte = _ultimos_valores(con, dataset, series, ate=seguinte[1]) if seguinte else {}
    novas, revisoes, lote = 0, 0, []
    for serie, ref, valor in linhas:
        ant = anteriores.get((serie, ref))
        if ant is None:
            novas += 1
        elif abs(ant - valor) <= 1e-9:
            continue
        else:
            revisoes += 1
        lote.append((dataset, serie, ref, float(valor), vintage_id))
        anteriores[(serie, ref)] = valor
    con.executemany("INSERT OR IGNORE INTO observacoes VALUES(?,?,?,?,?)", lote)
    if seguinte:
        restaurar = []
        for _, serie, ref, valor, _ in lote:
            antes = na_seguinte.get((serie, ref))
            if antes is None or abs(antes - valor) <= 1e-9:
                continue
            tem = con.execute(
                "SELECT 1 FROM observacoes WHERE dataset=? AND serie=? AND ref=? AND vintage_id=?",
                (dataset, serie, ref, seguinte[0]),
            ).fetchone()
            if not tem:
                restaurar.append((dataset, serie, ref, float(antes), seguinte[0]))
        con.executemany("INSERT OR IGNORE INTO observacoes VALUES(?,?,?,?,?)", restaurar)
    return novas, revisoes


def serie_vigente(con, dataset, serie):
    """[(ref, valor)] ordenado por ref, com o valor da vintage mais recente."""
    return como_estava_em(con, dataset, serie, None)


def como_estava_em(con, dataset, serie, instante):
    """Valores de `serie` como estavam no `instante` (ISO, UTC): para cada ref, a
    vintage mais recente com capturado_em <= instante. `instante=None` = vigente.
    É a ÚNICA consulta que features e backtests podem usar (sem look-ahead)."""
    params = [dataset, serie]
    filtro = ""
    if instante is not None:
        filtro = "AND v.capturado_em <= ?"
        params.append(instante_utc(instante))
    cur = con.execute(
        f"""SELECT o.ref, o.valor FROM observacoes o
            JOIN vintages v ON v.vintage_id = o.vintage_id
            WHERE o.dataset=? AND o.serie=? {filtro}
            ORDER BY v.capturado_em, o.rowid""",
        params,
    )
    atual = {}
    for ref, valor in cur:
        atual[ref] = valor
    return sorted(atual.items())


def revisoes_da_serie(con, dataset, serie):
    """Refs com mais de uma vintage de valor: [(ref, [(capturado_em, valor), ...])]."""
    cur = con.execute(
        """SELECT o.ref, v.capturado_em, o.valor FROM observacoes o
           JOIN vintages v ON v.vintage_id=o.vintage_id
           WHERE o.dataset=? AND o.serie=? AND o.ref IN (
               SELECT ref FROM observacoes WHERE dataset=? AND serie=?
               GROUP BY ref HAVING COUNT(*) > 1)
           ORDER BY o.ref, v.capturado_em""",
        (dataset, serie, dataset, serie),
    )
    out = {}
    for ref, cap, val in cur:
        out.setdefault(ref, []).append((cap, val))
    return sorted(out.items())


def vintages_do_dataset(con, dataset):
    cur = con.execute(
        """SELECT vintage_id, recurso, url, capturado_em, publicado_em, sha256, bytes, origem, arquivo
           FROM vintages WHERE dataset=? ORDER BY recurso, capturado_em""",
        (dataset,),
    )
    cols = ["vintage_id", "recurso", "url", "capturado_em", "publicado_em", "sha256", "bytes",
            "origem", "arquivo"]
    return [dict(zip(cols, r)) for r in cur]


def ultima_coleta(con, dataset):
    row = con.execute(
        "SELECT tentado_em, ok, detalhe FROM coletas WHERE dataset=? ORDER BY rowid DESC LIMIT 1",
        (dataset,),
    ).fetchone()
    if not row:
        return None
    return {"tentado_em": row[0], "ok": bool(row[1]), "detalhe": row[2]}


def _escreve_atomico(caminho, texto):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    tmp = f"{caminho}.{os.getpid()}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(texto)
    os.replace(tmp, caminho)
    return caminho


def escreve_gold(nome, payload, destino=None):
    base = destino or GOLD
    return _escreve_atomico(os.path.join(base, nome),
                            json.dumps(payload, ensure_ascii=False, indent=1, allow_nan=False))


def escreve_csv(nome, cabecalho, linhas, destino=None):
    """CSV com ';' e ponto decimal; ausência = campo vazio (nunca zero)."""
    base = destino or SERIES
    partes = [";".join(cabecalho)]
    for linha in linhas:
        partes.append(";".join("" if v is None else (repr(round(v, 4)) if isinstance(v, float) else str(v))
                               for v in linha))
    return _escreve_atomico(os.path.join(base, nome), "\n".join(partes) + "\n")


def le_gold(nome, destino=None):
    caminho = os.path.join(destino or GOLD, nome)
    if not os.path.exists(caminho):
        return None
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)
