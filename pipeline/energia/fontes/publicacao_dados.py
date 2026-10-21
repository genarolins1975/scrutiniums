"""Manifesto da publicação e exportação colunar (Parquet) para o módulo Dados (P069).

Por que existe: "consigo reproduzir este gráfico?" só tem resposta se cada arquivo
publicado tiver identidade verificável e se a versão exata puder ser recuperada sem
depender de link temporário. Este arquivo:

* gera, ao lado de cada CSV grande de public/energia/series, um Parquet com o mesmo
  conteúdo (pyarrow, zstd, grupos de 16.384 linhas), lido e escrito em fluxo. O mesmo
  conteúdo é verificado relendo o Parquet e comparando célula a célula com o CSV:
  texto igual, número igual ao número escrito no CSV, vazio igual a nulo. O sha256 do
  CSV de origem fica nos metadados do Parquet; CSV inalterado não regrava o Parquet.
  Grupos de linhas de tamanho fixo fazem uma série que só cresce no fim mudar só o
  último grupo, e o git guarda a diferença em vez do arquivo inteiro;
* monta o manifesto (public/energia/gold/manifesto.json): caminho, tamanho e sha256 de
  cada gold, série e geometria publicada, colunas e linhas dos CSV, versão do código e
  um id de publicação que é o sha256 da lista (caminho, bytes, sha256) em ordem. O
  mesmo conjunto de bytes tem sempre o mesmo id; qualquer byte diferente muda o id.
"""
import csv
import hashlib
import json
import os
import re
import sys
from decimal import Decimal, InvalidOperation

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import base  # noqa: E402

PUBLICO = os.path.join(base.RAIZ, "public")
LIMIAR_PARQUET_BYTES = 1024 * 1024  # "séries grandes": CSV a partir de 1 MiB
GRUPO_LINHAS = 16384
LOTE = 20000
CHAVE_META = b"scrutiniums"
REPOSITORIO = "https://github.com/genarolins1975/scrutiniums"
# Colunas de código (CNPJ, IBGE, CEG): texto sempre, para não perder zero à esquerda
# nem transformar identificador em número.
_CODIGO = re.compile(r"^(cnpj|cpf|cod|codigo|ceg|nucleo_ceg|cd_|id_|cep)|(_ibge\w*|_cnpj|_ceg|_id|^id)$", re.I)
_INT = re.compile(r"^-?(0|[1-9]\d{0,17})$")
_FLOAT = re.compile(r"^-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$")


def sha256_arquivo(caminho):
    h = hashlib.sha256()
    with open(caminho, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def _linhas_csv(caminho):
    with open(caminho, encoding="utf-8", newline="") as fh:
        leitor = csv.reader(fh, delimiter=";")
        cab = next(leitor)
        yield cab
        for row in leitor:
            if row:
                yield row


def float_preserva(texto):
    """True quando o float64 mais próximo do número escrito no CSV representa exatamente
    esse número decimal (comparação em Decimal da representação mais curta do float com
    o texto). '13984.69575', '1.50' e '1e3' preservam; '12345678901234567891.5' (mais de
    17 dígitos significativos) não: o float guarda 12345678901234567000."""
    try:
        return Decimal(repr(float(texto))) == Decimal(texto)
    except (InvalidOperation, ValueError, OverflowError):
        return False


def tipos_colunas(caminho):
    """Tipo de cada coluna pelo conteúdo inteiro do CSV (uma passada em fluxo):
    int64 quando todo valor é inteiro sem zero à esquerda, float64 quando todo valor é
    número que o float64 representa sem perda (float_preserva), texto nos demais e nas
    colunas de código. Uma coluna com um só número que o float64 não guarda exatamente
    fica como texto: o Parquet não pode arredondar em silêncio o que o CSV publica.
    Vazio não decide o tipo."""
    it = _linhas_csv(caminho)
    cab = next(it)
    tipo = ["int" if not _CODIGO.search(c) else "str" for c in cab]
    n = 0
    for row in it:
        n += 1
        for i, v in enumerate(row[:len(cab)]):
            if v == "" or tipo[i] == "str":
                continue
            if tipo[i] == "int" and not _INT.match(v):
                tipo[i] = "float" if (_FLOAT.match(v) and float_preserva(v)) else "str"
            elif tipo[i] == "float" and not (_FLOAT.match(v) and float_preserva(v)):
                tipo[i] = "str"
    return cab, tipo, n


def _arrow_tipo(pa, t):
    return {"int": pa.int64(), "float": pa.float64(), "str": pa.string()}[t]


def _converte(v, t):
    if v == "":
        return None
    if t == "int":
        return int(v)
    if t == "float":
        return float(v)
    return v


def csv_para_parquet(caminho_csv, caminho_parquet, url_csv):
    """Escreve o Parquet equivalente em lotes; devolve o resumo. Não regrava quando o
    Parquet existente já foi gerado do mesmo CSV (sha256 nos metadados)."""
    import pyarrow as pa
    import pyarrow.parquet as pq
    sha_csv = sha256_arquivo(caminho_csv)
    meta_atual = metadados_parquet(caminho_parquet)
    if meta_atual and meta_atual.get("csv_sha256") == sha_csv:
        return {"status": "inalterado", "csv_sha256": sha_csv, **{k: meta_atual.get(k) for k in ("linhas", "tipos")}}
    cab, tipos, n = tipos_colunas(caminho_csv)
    meta = {"fonte_csv": url_csv, "csv_sha256": sha_csv, "linhas": n, "tipos": dict(zip(cab, tipos)),
            "gerado_por": "pipeline/energia/fontes/publicacao_dados.py",
            "regra": ("Mesmo conteúdo do CSV: colunas na mesma ordem; vazio = nulo; int64 quando todos os valores são "
                      "inteiros sem zero à esquerda; float64 quando todos são números; texto nos demais e em colunas de código.")}
    schema = pa.schema([pa.field(c, _arrow_tipo(pa, t)) for c, t in zip(cab, tipos)],
                       metadata={CHAVE_META: json.dumps(meta, ensure_ascii=False, sort_keys=True).encode("utf-8")})
    tmp = caminho_parquet + f".{os.getpid()}.tmp"
    escritor = pq.ParquetWriter(tmp, schema, compression="zstd", use_dictionary=True, write_statistics=True)
    try:
        it = _linhas_csv(caminho_csv)
        next(it)
        lote = [[] for _ in cab]
        for row in it:
            for i, t in enumerate(tipos):
                lote[i].append(_converte(row[i] if i < len(row) else "", t))
            if len(lote[0]) >= GRUPO_LINHAS:
                escritor.write_table(pa.table([pa.array(col, type=_arrow_tipo(pa, t)) for col, t in zip(lote, tipos)],
                                              schema=schema), row_group_size=GRUPO_LINHAS)
                lote = [[] for _ in cab]
        if lote[0] or n == 0:
            escritor.write_table(pa.table([pa.array(col, type=_arrow_tipo(pa, t)) for col, t in zip(lote, tipos)],
                                          schema=schema), row_group_size=GRUPO_LINHAS)
    finally:
        escritor.close()
    os.replace(tmp, caminho_parquet)
    return {"status": "gerado", "csv_sha256": sha_csv, "linhas": n, "tipos": dict(zip(cab, tipos))}


def metadados_parquet(caminho):
    if not os.path.exists(caminho):
        return None
    try:
        import pyarrow.parquet as pq
        md = pq.read_schema(caminho).metadata or {}
        bruto = md.get(CHAVE_META)
        return json.loads(bruto.decode("utf-8")) if bruto else None
    except Exception:
        return None


def _texto_equivalente(valor, t):
    """Valor do Parquet como seria escrito no CSV (para comparar com o texto original)."""
    if valor is None:
        return ""
    if t == "int":
        return str(valor)
    return valor


def _decimal_igual(v, orig):
    try:
        return Decimal(repr(float(v))) == Decimal(orig)
    except (InvalidOperation, ValueError):
        return False


def confere_parquet(caminho_csv, caminho_parquet):
    """Relê o Parquet em lotes e compara com o CSV linha a linha. Devolve (ok, detalhe,
    linhas, divergencias, exemplos). Inteiros e texto são comparados como texto. Números
    do tipo float são comparados como DECIMAL: o valor gravado no Parquet, escrito na sua
    representação mais curta (repr), tem de ser o mesmo número decimal escrito no CSV.
    Comparar float(texto) com o float gravado seria tautológico (o gravado veio do mesmo
    float(texto)) e nunca acusaria perda de precisão acima de 17 dígitos significativos."""
    import pyarrow.parquet as pq
    pf = pq.ParquetFile(caminho_parquet)
    cab_pq = pf.schema_arrow.names
    tipos = {f.name: ("int" if str(f.type) == "int64" else "float" if str(f.type) == "double" else "str")
             for f in pf.schema_arrow}
    it = _linhas_csv(caminho_csv)
    cab = next(it)
    if cab != cab_pq:
        return False, f"colunas diferentes: CSV {cab[:5]}..., Parquet {cab_pq[:5]}...", 0, 1, []
    linhas, diverg, exemplos = 0, 0, []
    for lote in pf.iter_batches(batch_size=LOTE, columns=cab):
        cols = [lote.column(i).to_pylist() for i in range(len(cab))]
        for j in range(lote.num_rows):
            try:
                row = next(it)
            except StopIteration:
                return False, "Parquet com mais linhas que o CSV", linhas, diverg + 1, exemplos
            linhas += 1
            for i, c in enumerate(cab):
                v = cols[i][j]
                orig = row[i] if i < len(row) else ""
                t = tipos[c]
                if t == "float":
                    igual = (v is None and orig == "") or (v is not None and orig != "" and _decimal_igual(v, orig))
                else:
                    igual = _texto_equivalente(v, t) == orig
                if not igual:
                    diverg += 1
                    if len(exemplos) < 5:
                        exemplos.append({"linha": linhas + 1, "coluna": c, "csv": orig, "parquet": v})
    resto = sum(1 for _ in it)
    if resto:
        return False, f"CSV com {resto} linhas a mais que o Parquet", linhas, diverg + resto, exemplos
    ok = diverg == 0
    return ok, (f"{linhas} linhas idênticas ao CSV" if ok else f"{diverg} células divergentes em {linhas} linhas"), linhas, diverg, exemplos


def exporta_parquet(dir_series=None, limiar=LIMIAR_PARQUET_BYTES):
    """Gera/atualiza o Parquet de todo CSV com pelo menos `limiar` bytes e remove o
    Parquet gerado por este código cujo CSV sumiu ou encolheu abaixo do limiar.
    Devolve [{csv, parquet, status, ...}]."""
    d = dir_series or base.SERIES
    out = []
    nomes = sorted(os.listdir(d))
    for nome in nomes:
        if not nome.endswith(".csv"):
            continue
        c = os.path.join(d, nome)
        p = c[:-4] + ".parquet"
        url = "/energia/series/" + nome
        if os.path.getsize(c) < limiar:
            if os.path.exists(p) and metadados_parquet(p):
                os.remove(p)
                out.append({"csv": url, "parquet": url[:-4] + ".parquet", "status": "removido (CSV abaixo do limiar)"})
            continue
        r = csv_para_parquet(c, p, url)
        out.append({"csv": url, "parquet": url[:-4] + ".parquet", "bytes_csv": os.path.getsize(c),
                    "bytes_parquet": os.path.getsize(p), **r})
    for nome in nomes:
        if nome.endswith(".parquet") and not os.path.exists(os.path.join(d, nome[:-8] + ".csv")):
            p = os.path.join(d, nome)
            if metadados_parquet(p):
                os.remove(p)
                out.append({"csv": None, "parquet": "/energia/series/" + nome, "status": "removido (CSV não existe)"})
    return out


# ---------------------------------------------------------------- manifesto


def _tipo_arquivo(rel):
    if rel.startswith("energia/gold/"):
        return "gold"
    if rel.startswith("energia/geo/"):
        return "geometria"
    if rel.endswith(".parquet"):
        return "parquet"
    return "serie"


def _cabecalho_csv(caminho):
    with open(caminho, encoding="utf-8", newline="") as fh:
        cab = next(csv.reader(fh, delimiter=";"), [])
        n = sum(1 for linha in fh if linha.strip())
    return cab, n


def lista_publicados(excluir=()):
    """Arquivos publicados de energia (gold, séries, geometria), em ordem de caminho."""
    out = []
    for sub in ("gold", "series", "geo"):
        pasta = os.path.join(PUBLICO, "energia", sub)
        if not os.path.isdir(pasta):
            continue
        for raiz, _, arquivos in os.walk(pasta):
            for nome in arquivos:
                if nome.endswith(".tmp") or ".tmp" in nome:
                    continue
                rel = os.path.relpath(os.path.join(raiz, nome), PUBLICO).replace(os.sep, "/")
                if "/" + rel in excluir or nome in excluir:
                    continue
                out.append(rel)
    return sorted(out)


def item_manifesto(rel, conteudo=None, dicionario=None, parquets=None):
    """Entrada do manifesto de um arquivo. `conteudo`: bytes já serializados (a gold que
    o orquestrador ainda vai gravar, idêntica ao que este código serializa)."""
    url = "/" + rel
    tipo = _tipo_arquivo(rel)
    if conteudo is not None:
        sha, tam = hashlib.sha256(conteudo).hexdigest(), len(conteudo)
    else:
        caminho = os.path.join(PUBLICO, rel)
        sha, tam = sha256_arquivo(caminho), os.path.getsize(caminho)
    it = {"caminho": url, "tipo": tipo, "bytes": tam, "sha256": sha}
    if tipo == "serie" and rel.endswith(".csv"):
        cab, n = _cabecalho_csv(os.path.join(PUBLICO, rel))
        it.update({"colunas": cab, "linhas": n, "dicionario": url in (dicionario or {}),
                   "parquet": (parquets or {}).get(url)})
    if tipo == "gold" and conteudo is None and rel.endswith(".json"):
        try:
            with open(os.path.join(PUBLICO, rel), encoding="utf-8") as f:
                g = json.load(f)
            if isinstance(g, dict):
                it.update({"gerado_em": g.get("gerado_em"), "disponivel": g.get("disponivel")})
        except Exception:
            it["legivel"] = False
    return it


def serializa_gold(payload):
    """Mesma serialização de base.escreve_gold (o sha256 do manifesto bate com o arquivo)."""
    return json.dumps(payload, ensure_ascii=False, indent=1, allow_nan=False).encode("utf-8")


def id_publicacao(itens):
    canon = [[i["caminho"], i["bytes"], i["sha256"]] for i in sorted(itens, key=lambda x: x["caminho"])]
    return hashlib.sha256(json.dumps(canon, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).hexdigest()
