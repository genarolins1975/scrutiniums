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
import csv
import gzip
import hashlib
import io
import json
import os
import sqlite3
import subprocess
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

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


def arredonda_meio_para_cima(v, casas=2):
    """Arredonda em decimal, com o meio para cima (longe do zero), que é a regra do que a interface exibe.

    O `round()` do Python arredonda o valor binário exato e, no empate, para o par: 70,175 (guardado como
    70,17499999999999999) virava 70,17, e 0,125 virava 0,12, enquanto a página e a conta feita à mão dão 70,18 e 0,13.
    Aqui o arredondamento age sobre a menor cadeia decimal que reproduz o número (`repr`), como quem lê o valor impresso.
    """
    x = float(v)
    try:
        return float(Decimal(repr(x)).quantize(Decimal(1).scaleb(-casas), rounding=ROUND_HALF_UP))
    except InvalidOperation:  # valor grande demais para a precisão do Decimal: o `round()` já não perde casas ali
        return round(x, casas)


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
    con = sqlite3.connect(caminho, timeout=60)
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
        CREATE TABLE IF NOT EXISTS registros(
            dataset TEXT NOT NULL, chave TEXT NOT NULL, campo TEXT NOT NULL,
            valor TEXT, vintage_id TEXT NOT NULL,
            PRIMARY KEY(dataset, chave, campo, vintage_id)
        );
        CREATE INDEX IF NOT EXISTS idx_reg ON registros(dataset, chave, campo);
        """
    )
    return con


def conecta_familia(familia):
    """Silver de uma família de fontes (data/energia/silver/<familia>.db), com o mesmo
    esquema do silver principal. Separar por família evita disputa de escrita entre
    coletores e mantém cada banco num tamanho que o cache do Actions e a cópia durável
    comportam. O silver principal (energia.db) continua com ONS e CCEE originais."""
    if not familia or not all(ch.isalnum() or ch == "_" for ch in familia):
        raise ValueError(f"família inválida: {familia!r}")
    return conecta(os.path.join(SILVER, f"{familia}.db"))


def salva_bronze_arquivo(orgao, dataset, recurso, caminho_origem, ext, capturado_em, sha=None):
    """Versão em fluxo de salva_bronze para arquivos grandes já baixados em disco:
    comprime em blocos, sem carregar o arquivo inteiro na memória. Mesmo conteúdo,
    mesmo nome: não regrava. Retorna (caminho relativo, sha256, bytes)."""
    if sha is None:
        h = hashlib.sha256()
        with open(caminho_origem, "rb") as f:
            for bloco in iter(lambda: f.read(1 << 20), b""):
                h.update(bloco)
        sha = h.hexdigest()
    nbytes = os.path.getsize(caminho_origem)
    pasta = os.path.join(BRONZE, orgao, dataset, recurso)
    os.makedirs(pasta, exist_ok=True)
    existentes = [n for n in os.listdir(pasta) if sha[:12] in n]
    if existentes:
        return os.path.relpath(os.path.join(pasta, existentes[0]), RAIZ), sha, nbytes
    carimbo = capturado_em.replace(":", "").replace("-", "")
    destino = os.path.join(pasta, f"{carimbo}.{sha[:12]}.{ext}.gz")
    tmp = destino + ".part"
    with open(caminho_origem, "rb") as src, gzip.open(tmp, "wb", compresslevel=6) as dst:
        for bloco in iter(lambda: src.read(1 << 20), b""):
            dst.write(bloco)
    os.replace(tmp, destino)
    return os.path.relpath(destino, RAIZ), sha, nbytes


def abre_bronze(caminho_relativo):
    """Abre (binário) um arquivo do bronze, gzip ou não, pelo caminho relativo à raiz.

    Se o arquivo registrado na vintage não existe (silver restaurado da cópia durável sem o
    bronze, e o recurso recapturado com o mesmo conteúdo noutro instante), abre a cópia da
    mesma pasta com o mesmo sha256 no nome: o conteúdo é idêntico por construção."""
    caminho = caminho_relativo if os.path.isabs(caminho_relativo) else os.path.join(RAIZ, caminho_relativo)
    if not os.path.exists(caminho):
        caminho = _bronze_mesmo_conteudo(caminho) or caminho
    return gzip.open(caminho, "rb") if caminho.endswith(".gz") else open(caminho, "rb")


def _bronze_mesmo_conteudo(caminho):
    """Outro arquivo da mesma pasta do bronze com o mesmo prefixo de sha256 no nome
    (<carimbo>.<sha12>.<ext>[.gz]), ou None."""
    pasta, nome = os.path.split(caminho)
    partes = nome.split(".")
    if len(partes) < 3 or len(partes[1]) != 12 or not os.path.isdir(pasta):
        return None
    marca = f".{partes[1]}."
    iguais = sorted(n for n in os.listdir(pasta) if marca in n and n.endswith(nome[nome.index(marca) + len(marca):]))
    return os.path.join(pasta, iguais[0]) if iguais else None


def ultima_vintage(con, dataset, recurso):
    """Vintage mais recente (por captura) de um recurso, ou None."""
    row = con.execute(
        """SELECT vintage_id, recurso, url, capturado_em, publicado_em, sha256, bytes, origem, arquivo
           FROM vintages WHERE dataset=? AND recurso=? ORDER BY capturado_em DESC LIMIT 1""",
        (dataset, recurso),
    ).fetchone()
    if not row:
        return None
    cols = ["vintage_id", "recurso", "url", "capturado_em", "publicado_em", "sha256", "bytes", "origem", "arquivo"]
    return dict(zip(cols, row))


def grava_registros(con, dataset, vintage_id, linhas):
    """Registros textuais (cadastros, cronogramas, atos) com a mesma semântica de revisão
    das observações: linhas (chave, campo, valor_texto); só grava valor novo ou alterado
    em relação ao conhecido na captura desta vintage. Valor None não gera linha, mas um
    campo que deixa de vir preenchido após ter valor é registrado como '' (apagado pela
    fonte), para que o histórico mostre a remoção. Retorna (novas, revisoes)."""
    unicas = {}
    for ch, campo, v in linhas:
        unicas[(str(ch), str(campo))] = None if v is None else str(v)
    cap = con.execute("SELECT capturado_em FROM vintages WHERE vintage_id=?", (vintage_id,)).fetchone()
    ate = cap[0] if cap else None
    filtro, extra = ("AND v.capturado_em <= ?", (ate,)) if ate else ("", ())
    conhecidos = {}
    for ch, campo, valor in con.execute(
        f"""SELECT r.chave, r.campo, r.valor FROM registros r JOIN vintages v ON v.vintage_id=r.vintage_id
            WHERE r.dataset=? {filtro} ORDER BY v.capturado_em, r.rowid""",
        (dataset, *extra),
    ):
        conhecidos[(ch, campo)] = valor
    novas, revisoes, lote = 0, 0, []
    for (ch, campo), v in unicas.items():
        ant = conhecidos.get((ch, campo))
        if v is None:
            if ant not in (None, ""):
                lote.append((dataset, ch, campo, "", vintage_id))
                revisoes += 1
            continue
        if ant is None:
            novas += 1
        elif ant == v:
            continue
        else:
            revisoes += 1
        lote.append((dataset, ch, campo, v, vintage_id))
    con.executemany("INSERT OR IGNORE INTO registros VALUES(?,?,?,?,?)", lote)
    return novas, revisoes


def registros_como_estavam_em(con, dataset, instante=None):
    """{chave: {campo: valor}} como estava no instante (UTC ISO); None = vigente.
    Campo apagado pela fonte ('') não aparece."""
    filtro, extra = "", ()
    if instante is not None:
        filtro, extra = "AND v.capturado_em <= ?", (instante_utc(instante),)
    out = {}
    for ch, campo, valor in con.execute(
        f"""SELECT r.chave, r.campo, r.valor FROM registros r JOIN vintages v ON v.vintage_id=r.vintage_id
            WHERE r.dataset=? {filtro} ORDER BY v.capturado_em, r.rowid""",
        (dataset, *extra),
    ):
        out.setdefault(ch, {})[campo] = valor
    return {ch: {k: v for k, v in campos.items() if v != ""} for ch, campos in out.items()}


def historico_registro(con, dataset, chave, campo):
    """[(capturado_em, valor)] de um campo de um registro, em ordem de captura."""
    return con.execute(
        """SELECT v.capturado_em, r.valor FROM registros r JOIN vintages v ON v.vintage_id=r.vintage_id
           WHERE r.dataset=? AND r.chave=? AND r.campo=? ORDER BY v.capturado_em""",
        (dataset, chave, campo),
    ).fetchall()


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
    """CSV com ';' e ponto decimal; ausência = campo vazio (nunca zero). Campo com ';', aspas ou quebra de
    linha vai entre aspas (RFC 4180), como em regulacao._escreve_csv: sem isso, um texto com ponto e vírgula
    vira coluna a mais e o arquivo baixado deixa de ter o número de colunas do cabeçalho."""
    base = destino or SERIES
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";", quoting=csv.QUOTE_MINIMAL, lineterminator="\n")
    w.writerow(cabecalho)
    for linha in linhas:
        w.writerow(["" if v is None else (repr(arredonda_meio_para_cima(v, 4)) if isinstance(v, float) else str(v)) for v in linha])
    return _escreve_atomico(os.path.join(base, nome), buf.getvalue())


def le_gold(nome, destino=None):
    caminho = os.path.join(destino or GOLD, nome)
    if not os.path.exists(caminho):
        return None
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)
