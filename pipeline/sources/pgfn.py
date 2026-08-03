"""Dívida Ativa da União — dados abertos da PGFN (https://dadosabertos.pgfn.gov.br/).

Decisões e evidências: docs/AUDITORIA_PGFN.md. As quatro que mais importam aqui:

1. **Nada de dados pessoais.** O arquivo publica nome completo do devedor — inclusive
   de pessoa física —, CPF mascarado e CNPJ inteiro. Nenhuma dessas colunas entra em
   estrutura de dados, cache ou banco: são lidas e descartadas na mesma linha. Também
   não retemos NUMERO_INSCRICAO, que identifica um caso concreto. O que persiste são
   contagens e somas por UF, mês, situação e faixa de valor.

2. **Só linhas PRINCIPAL somam valor.** Cada inscrição repete o VALOR_CONSOLIDADO
   integral para cada corresponsável e devedor solidário. Medido no trimestre inteiro:
   R$ 3.512,8 bi corretos contra R$ 7.385,5 bi se todas as linhas fossem somadas —
   2,1× a dívida real. O coletor registra o valor repetido em vez de apenas ignorá-lo,
   para que o painel possa mostrar o tamanho da armadilha.

3. **A caixa de TIPO_DEVEDOR muda entre conjuntos** — 'PRINCIPAL' no não previdenciário,
   'Principal' no previdenciário e no FGTS. Comparação sem normalizar zera dois dos três
   conjuntos sem levantar erro nenhum.

4. **Nada de materializar 9 GB.** HTTP → inflate em fluxo → agrega → esquece. O ZIP
   nunca vai para o disco e o CSV nunca existe inteiro em lugar algum.

O conjunto é trimestral e o pipeline roda todo dia: o coletor compara o índice remoto
com o que já absorveu e sai na hora se não houver trimestre novo.
"""
import re
import urllib.request
import zlib

from pipeline import common

BASE = "https://dadosabertos.pgfn.gov.br/"
CONJUNTOS = {
    "nao_previdenciario": "Dados_abertos_Nao_Previdenciario.zip",
    "previdenciario": "Dados_abertos_Previdenciario.zip",
    "fgts": "Dados_abertos_FGTS.zip",
}
UFS = set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split())

# Lidas do CSV e descartadas na mesma linha — nunca acumuladas. A lista existe para
# que o teste de privacidade possa afirmar que nenhuma delas alimenta agregado.
COLUNAS_PESSOAIS = ("CPF_CNPJ", "NOME_DEVEDOR", "NUMERO_INSCRICAO")

FAIXAS = [(0, 1e3, "até R$ 1 mil"), (1e3, 1e4, "R$ 1 mil a 10 mil"), (1e4, 1e5, "R$ 10 mil a 100 mil"),
          (1e5, 1e6, "R$ 100 mil a 1 mi"), (1e6, 1e7, "R$ 1 mi a 10 mi"), (1e7, 1e8, "R$ 10 mi a 100 mi"),
          (1e8, float("inf"), "acima de R$ 100 mi")]


def _faixa(v):
    for lo, hi, rot in FAIXAS:
        if lo <= v < hi:
            return rot
    return FAIXAS[0][2]


def trimestres_disponiveis(timeout=60):
    """Lê o índice HTTP. Sem API e sem catálogo: a listagem do servidor é a fonte."""
    with urllib.request.urlopen(BASE, timeout=timeout) as r:
        html = r.read().decode("latin1", "replace")
    tri = sorted(set(re.findall(r'href="(\d{4}_trimestre_\d{2})/?"', html)))
    return tri


def _data_base(trimestre):
    """'2026_trimestre_02' -> '2026-06' (último mês do trimestre, que é a data-base)."""
    ano, _, n = trimestre.partition("_trimestre_")
    return f"{ano}-{int(n) * 3:02d}"


def _membros(url, timeout=120):
    """Lista os membros do ZIP lendo só o diretório central, via Range.
    Devolve [(nome, offset_do_cabecalho_local, tamanho_comprimido)]."""
    req = urllib.request.Request(url, method="HEAD")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        total = int(r.headers["Content-Length"])
    cauda = _range(url, max(0, total - 65536), total - 1, timeout)
    i = cauda.rfind(b"PK\x05\x06")
    if i < 0:
        raise RuntimeError("EOCD não encontrado nos últimos 64 KB do ZIP")
    n_entradas = int.from_bytes(cauda[i + 10:i + 12], "little")
    cd_tam = int.from_bytes(cauda[i + 12:i + 16], "little")
    cd_off = int.from_bytes(cauda[i + 16:i + 20], "little")
    cd = _range(url, cd_off, cd_off + cd_tam - 1, timeout)
    out, p = [], 0
    for _ in range(n_entradas):
        if cd[p:p + 4] != b"PK\x01\x02":
            break
        comp = int.from_bytes(cd[p + 20:p + 24], "little")
        nlen = int.from_bytes(cd[p + 28:p + 30], "little")
        elen = int.from_bytes(cd[p + 30:p + 32], "little")
        clen = int.from_bytes(cd[p + 32:p + 34], "little")
        off = int.from_bytes(cd[p + 42:p + 46], "little")
        nome = cd[p + 46:p + 46 + nlen].decode("latin1")
        out.append((nome, off, comp))
        p += 46 + nlen + elen + clen
    return out


def _range(url, ini, fim, timeout=120):
    req = urllib.request.Request(url, headers={"Range": f"bytes={ini}-{fim}"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def _linhas_do_membro(url, off, comp, timeout=1800, bloco=1 << 20):
    """Descomprime um membro do ZIP em fluxo e entrega linha a linha.
    Nunca guarda o membro inteiro: o pico de memória é um bloco mais o resto da linha."""
    # cabeçalho local para saber onde começam os dados comprimidos
    cab = _range(url, off, off + 29, timeout)
    nlen = int.from_bytes(cab[26:28], "little")
    elen = int.from_bytes(cab[28:30], "little")
    ini = off + 30 + nlen + elen
    req = urllib.request.Request(url, headers={"Range": f"bytes={ini}-{ini + comp - 1}"})
    d = zlib.decompressobj(-15)
    resto = b""
    with urllib.request.urlopen(req, timeout=timeout) as r:
        while True:
            pedaco = r.read(bloco)
            if not pedaco:
                break
            dados = d.decompress(pedaco)
            if not dados:
                continue
            dados = resto + dados
            *linhas, resto = dados.split(b"\n")
            for l in linhas:
                yield l
    rabo = d.flush()
    if rabo:
        resto += rabo
    if resto.strip():
        yield resto


class Agregado:
    """Contadores por chave. Memória O(nº de grupos) — poucos milhares —, nunca O(linhas)."""

    def __init__(self):
        self.uf = {}
        self.safra = {}
        self.situacao = {}
        self.ajuizado = {}
        self.receita = {}
        self.faixa = {}
        self.lidas = 0
        self.principais = 0
        self.descartadas = 0
        self.uf_indefinida = 0
        self.valor_repetido = 0.0

    def _soma(self, d, chave, valor):
        a = d.get(chave)
        if a is None:
            a = d[chave] = [0, 0.0]
        a[0] += 1
        a[1] += valor

    def linha(self, col, campos):
        self.lidas += 1
        # a caixa varia entre conjuntos: 'PRINCIPAL' vs 'Principal'
        if campos[col["TIPO_DEVEDOR"]].strip().upper() != "PRINCIPAL":
            # corresponsável/solidário repete o valor integral da inscrição: não soma,
            # mas registra quanto seria somado a mais por quem esquecesse o filtro
            try:
                self.valor_repetido += float(campos[col["VALOR_CONSOLIDADO"]] or 0)
            except (ValueError, IndexError):
                pass
            return
        try:
            valor = float(campos[col["VALOR_CONSOLIDADO"]] or 0)
        except ValueError:
            self.descartadas += 1
            return
        self.principais += 1
        pessoa = "pj" if "jur" in campos[col["TIPO_PESSOA"]].lower() else "pf"
        uf = campos[col["UF_DEVEDOR"]].strip().upper()
        if uf not in UFS:
            self.uf_indefinida += 1
            uf = "indefinida"          # 'Si' aparece na fonte; não vira estado nenhum
        self._soma(self.uf, (uf, pessoa), valor)
        data = campos[col["DATA_INSCRICAO"]].strip()
        if len(data) == 10 and data[2] == "/":
            self._soma(self.safra, (f"{data[6:]}-{data[3:5]}", pessoa), valor)
        self._soma(self.situacao, campos[col["TIPO_SITUACAO_INSCRICAO"]].strip() or "não informada", valor)
        self._soma(self.ajuizado, campos[col["INDICADOR_AJUIZADO"]].strip().upper() or "NAO INFORMADO", valor)
        cred = col.get("RECEITA_PRINCIPAL", col.get("TIPO_CREDITO"))
        if cred is not None and cred < len(campos):
            self._soma(self.receita, campos[cred].strip()[:80] or "não informada", valor)
        self._soma(self.faixa, _faixa(valor), valor)

def _ensure(con):
    """Fatos longos, um por dimensão. Os agregados nunca se somam entre si — cada
    tabela é uma contagem completa do mesmo universo por um corte diferente."""
    con.executescript("""
    CREATE TABLE IF NOT EXISTS pgfn_uf(trimestre TEXT, conjunto TEXT, uf TEXT, pessoa TEXT,
        n INTEGER, valor REAL, PRIMARY KEY(trimestre, conjunto, uf, pessoa));
    CREATE TABLE IF NOT EXISTS pgfn_safra(trimestre TEXT, conjunto TEXT, mes TEXT, pessoa TEXT,
        n INTEGER, valor REAL, PRIMARY KEY(trimestre, conjunto, mes, pessoa));
    CREATE TABLE IF NOT EXISTS pgfn_corte(trimestre TEXT, conjunto TEXT, dimensao TEXT, categoria TEXT,
        n INTEGER, valor REAL, PRIMARY KEY(trimestre, conjunto, dimensao, categoria));
    CREATE TABLE IF NOT EXISTS pgfn_execucao(trimestre TEXT, conjunto TEXT, data_base TEXT,
        linhas_lidas INTEGER, inscricoes INTEGER, descartadas INTEGER, uf_indefinida INTEGER,
        membros INTEGER, valor_total REAL, valor_repetido REAL, coletado_em TEXT,
        PRIMARY KEY(trimestre, conjunto));
    """)


def _grava(con, trimestre, chave, ag, membros):
    agora = common.now_utc()
    for (uf, pessoa), (n, v) in ag.uf.items():
        con.execute("INSERT OR REPLACE INTO pgfn_uf VALUES(?,?,?,?,?,?)", (trimestre, chave, uf, pessoa, n, v))
    for (mes, pessoa), (n, v) in ag.safra.items():
        con.execute("INSERT OR REPLACE INTO pgfn_safra VALUES(?,?,?,?,?,?)", (trimestre, chave, mes, pessoa, n, v))
    top = sorted(ag.receita.items(), key=lambda kv: -kv[1][1])[:25]
    for dim, d in (("situacao", ag.situacao), ("ajuizado", ag.ajuizado), ("faixa", ag.faixa), ("receita", dict(top))):
        for cat, (n, v) in d.items():
            con.execute("INSERT OR REPLACE INTO pgfn_corte VALUES(?,?,?,?,?,?)", (trimestre, chave, dim, cat, n, v))
    con.execute("INSERT OR REPLACE INTO pgfn_execucao VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                (trimestre, chave, _data_base(trimestre), ag.lidas, ag.principais, ag.descartadas,
                 ag.uf_indefinida, membros, round(sum(v[1] for v in ag.uf.values()), 2),
                 round(ag.valor_repetido, 2), agora))
    con.commit()


def _absorve(con, trimestre, chave, arquivo, limite_membros=None):
    url = f"{BASE}{trimestre}/{arquivo}"
    ag = Agregado()
    membros = _membros(url)
    for nome, off, comp in (membros[:limite_membros] if limite_membros else membros):
        col = None
        for bruto in _linhas_do_membro(url, off, comp):
            linha = bruto.decode("latin1", "replace").rstrip("\r")
            if col is None:
                col = {c.strip(): i for i, c in enumerate(linha.split(";"))}
                continue
            campos = linha.split(";")
            if len(campos) < len(col):
                ag.descartadas += 1
                continue
            ag.linha(col, campos)
            # campos e linha saem de escopo a cada iteração: nome e documento do
            # devedor nunca chegam a nenhum acumulador
    _grava(con, trimestre, chave, ag, len(membros))
    return ag


def collect(con, cfg, trimestre=None, conjuntos=None, limite_membros=None):
    """Absorve o trimestre mais recente ainda não processado. Idempotente por
    (trimestre, conjunto): tendo o par no armazém, não baixa nada."""
    _ensure(con)
    results = []
    try:
        disponiveis = trimestres_disponiveis()
    except Exception as e:
        return [{"key": "pgfn", "ok": False, "error": f"índice indisponível: {e}"}]
    if not disponiveis:
        return [{"key": "pgfn", "ok": False, "error": "índice vazio"}]
    alvo = trimestre or disponiveis[-1]
    for chave, arquivo in (conjuntos or CONJUNTOS).items():
        ident = f"pgfn:{alvo}:{chave}"
        ja = con.execute("SELECT 1 FROM pgfn_execucao WHERE trimestre=? AND conjunto=?", (alvo, chave)).fetchone()
        if ja:
            results.append({"key": ident, "ok": True, "note": "já absorvido"})
            continue
        try:
            ag = _absorve(con, alvo, chave, arquivo, limite_membros)
            results.append({"key": ident, "ok": True, "inscricoes": ag.principais,
                            "valor_bi": round(sum(v[1] for v in ag.uf.values()) / 1e9, 2)})
        except Exception as e:
            results.append({"key": ident, "ok": False, "error": str(e)[:200]})
    return results
