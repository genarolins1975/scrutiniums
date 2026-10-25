"""Desenrola Brasil — dados agregados do SCR publicados pelo Banco Central.

Fonte: https://dadosabertos.bcb.gov.br/dataset/desenrola-brasil
Arquivo: https://www.bcb.gov.br/pda/desig/desenrola/dados_desenrola.csv
Licença: Open Data Commons ODbL.

Decisões e evidências: docs/AUDITORIA_DESENROLA.md. O que precisa estar na cabeça de
quem mexer aqui:

1. **Sete colunas, e só.** DATA_BASE, TIPO_DESENROLA, UNIDADE_FEDERACAO, código e nome
   do conglomerado, número de operações e volume. Não há pessoa, não há dívida original,
   não há desconto, prazo, taxa, parcela, renda, sexo ou idade. A maior parte dos
   indicadores que se esperaria de um painel do Desenrola **não é calculável** desta base
   — e o painel diz isso, em vez de estimar.

2. **O volume é APÓS o desconto.** É o valor da operação renegociada, não o valor
   original da dívida. Sem o valor original, desconto médio é indeterminável aqui.

3. **Tipo 3 é outro programa.** Tipos 1 e 2 são as faixas do Desenrola Brasil (pessoas
   físicas, Lei 14.690/2023). Tipo 3 é o Desenrola Pequenos Negócios (MP 1.213/2024,
   pessoas jurídicas). Não se somam: público, porte e ticket são de outra ordem.

4. **Setembro de 2023 é um acumulado.** A própria fonte avisa: só nessa data-base as
   informações contemplam operações renegociadas no mês *ou em meses anteriores*. Tratar
   como fluxo mensal criaria um pico falso; a marcação viaja com o dado.

5. **Um código de conglomerado pode ter mais de um nome** ao longo da série (mudanças de
   marca). A identidade é o código; o nome exibido é o mais recente.

O CSV tem ~500 KB e é atualizado no último dia útil de cada mês. Coleta barata: baixa
sempre, compara o sha256 com o último bronze e só reprocessa quando muda.
"""
import csv
import io
import json
import math
from datetime import datetime

from pipeline import common

URL = "https://www.bcb.gov.br/pda/desig/desenrola/dados_desenrola.csv"
DATASET = "https://dadosabertos.bcb.gov.br/dataset/desenrola-brasil"

# A data-base em que a fonte declara acumular meses anteriores (ver docstring).
DATA_BASE_ACUMULADA = "2023-09"

TIPOS = {
    "1": ("faixa1", "Faixa 1", "Desenrola Brasil — pessoas físicas"),
    "2": ("faixa2", "Faixa 2", "Desenrola Brasil — pessoas físicas"),
    "3": ("pequenos_negocios", "Pequenos Negócios", "Desenrola Pequenos Negócios — pessoas jurídicas"),
}

UFS = set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split())


def _ensure(con):
    con.executescript("""
    CREATE TABLE IF NOT EXISTS desenrola_op(
        data_base TEXT, tipo TEXT, uf TEXT, cod_congl TEXT, nome_congl TEXT,
        n_operacoes INTEGER, volume REAL, bronze_sha TEXT,
        PRIMARY KEY(data_base, tipo, uf, cod_congl));
    CREATE TABLE IF NOT EXISTS desenrola_coleta(
        coletado_em TEXT, bronze_sha TEXT, linhas INTEGER, meses INTEGER,
        data_base_min TEXT, data_base_max TEXT, PRIMARY KEY(bronze_sha));
    CREATE TABLE IF NOT EXISTS desenrola_historico(
        data_base TEXT, tipo TEXT, uf TEXT, cod_congl TEXT, nome_congl TEXT,
        n_operacoes INTEGER, volume REAL, bronze_sha TEXT,
        PRIMARY KEY(bronze_sha, data_base, tipo, uf, cod_congl));
    CREATE TABLE IF NOT EXISTS desenrola_contrato(
        bronze_sha TEXT PRIMARY KEY, aceito INTEGER, motivo TEXT, avaliado_em TEXT);
    CREATE TABLE IF NOT EXISTS desenrola_recorte(
        bronze_sha TEXT PRIMARY KEY, resumo TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS desenrola_tipos_nao_documentados(
        bronze_sha TEXT, linha INTEGER, tipo TEXT, data_base TEXT, registro TEXT NOT NULL,
        PRIMARY KEY(bronze_sha, linha));
    """)


def _avaliar(con, sha, aceito, motivo=None):
    """Registra o veredito do contrato para o arquivo. O build só publica silver de
    arquivo aceito: em 24/10/2026 o código anterior ao contrato gravou o CSV de
    08/2026 descartando em silêncio 2.396 linhas do tipo 4 (1,9 milhão de operações),
    e o atalho de arquivo inalterado repetiria esse silver todos os dias."""
    con.execute("INSERT OR REPLACE INTO desenrola_contrato VALUES(?,?,?,?)",
                (sha, 1 if aceito else 0, motivo, common.now_utc()))


def _rejeitar(con, sha, motivo):
    _avaliar(con, sha, False, motivo)
    return [{"key": "desenrola", "ok": False, "error": motivo, "bronze_sha": sha}]


def _num(s):
    """Volume vem com milhar por ponto e decimal por vírgula (padrão brasileiro)."""
    s = (s or "").strip()
    if not s:
        raise ValueError("volume ausente; ausência não é zero")
    value = float(s.replace(".", "").replace(",", "."))
    if not math.isfinite(value) or value < 0:
        raise ValueError("volume inválido no Desenrola")
    return value


def recorte_publicado(con, sha):
    """Metadados do mesmo bronze aceito; o atalho não pode perder a ressalva."""
    try:
        row = con.execute("SELECT resumo FROM desenrola_recorte WHERE bronze_sha=?", (sha,)).fetchone()
    except Exception:
        return None
    return json.loads(row[0]) if row else None


def collect(con, cfg=None):
    _ensure(con)
    try:
        body, meta = common.http_get(URL, timeout=180)
    except Exception as e:
        return [{"key": "desenrola", "ok": False, "error": str(e)[:200]}]
    caminho, sha = common.save_bronze("desenrola", "dados_desenrola.csv", body, {**meta, "dataset": DATASET})

    ja = con.execute("SELECT linhas FROM desenrola_coleta WHERE bronze_sha=?", (sha,)).fetchone()
    vigente = {r[0] for r in con.execute("SELECT DISTINCT bronze_sha FROM desenrola_op")}
    aceito = con.execute("SELECT aceito FROM desenrola_contrato WHERE bronze_sha=?", (sha,)).fetchone()
    # arquivo gravado antes do contrato (sem veredito) passa de novo pela validação inteira
    recorte = recorte_publicado(con, sha)
    if ja and vigente == {sha} and aceito == (1,) and recorte is not None:
        return [{"key": "desenrola", "ok": True, "note": "arquivo inalterado desde a última coleta",
                 "linhas": ja[0], "fora_do_recorte": recorte}]

    inicio = body[:400].lstrip()
    if inicio[:1] == b"<" or b"<html" in inicio.lower():
        # o portal devolveu uma página (bloqueio, manutenção ou captcha), não o CSV:
        # nomear a causa evita o diagnóstico errado "esquema mudou" (runner de 05 e 06/09/2026)
        return _rejeitar(con, sha, f"resposta HTML no lugar do CSV (bloqueio ou manutenção do portal): {inicio[:120]!r}")
    try:
        texto = body.decode("utf-8-sig")
    except UnicodeDecodeError:
        texto = body.decode("latin-1")
    rdr = csv.DictReader(io.StringIO(texto), delimiter=";")
    obrigatorias = {"DATA_BASE", "TIPO_DESENROLA", "UNIDADE_FEDERACAO", "COD_CONGLOMERADO_FINANCEIRO",
                    "NOME_CONGLOMERADO_FINANCEIRO", "NUMERO_OPERACOES", "VOLUME_OPERACOES"}
    campos = [c.strip().upper() for c in (rdr.fieldnames or [])]
    rdr.fieldnames = campos  # tolera espaço e caixa no cabeçalho; a ordem não importa
    faltando = obrigatorias - set(campos)
    if faltando:
        # o esquema mudou: falhar alto é melhor do que gravar número errado em silêncio,
        # e o cabeçalho recebido vai junto para o diagnóstico ser possível sem o bronze
        return _rejeitar(con, sha, f"colunas ausentes no CSV: {sorted(faltando)} (esquema da fonte mudou); "
                                   f"cabeçalho recebido: {campos[:10]}; início: {inicio[:80]!r}")

    # Parse completo antes da troca: o orquestrador dá commit mesmo após falha de coleta.
    rows, meses, chaves, separadas = [], set(), set(), []
    try:
        for numero_linha, r in enumerate(rdr, start=2):
            if None in r or any(r.get(k) is None for k in obrigatorias):
                raise ValueError("linha incompleta ou com colunas excedentes")
            db = r["DATA_BASE"].strip()
            if len(db) != 6 or not db.isdigit():
                raise ValueError("data-base inválida")
            datetime.strptime(db, "%Y%m")
            tipo = r["TIPO_DESENROLA"].strip()
            uf = r["UNIDADE_FEDERACAO"].strip().upper()
            cod = r["COD_CONGLOMERADO_FINANCEIRO"].strip()
            nome = r["NOME_CONGLOMERADO_FINANCEIRO"].strip()
            if not tipo:
                raise ValueError("TIPO_DESENROLA ausente")
            if uf not in UFS or not cod or not nome:
                raise ValueError("UF ou identificação fora do contrato")
            n = int(r["NUMERO_OPERACOES"])
            if n < 0:
                raise ValueError("número de operações negativo")
            data_base = f"{db[:4]}-{db[4:]}"
            volume = _num(r["VOLUME_OPERACOES"])
            chave = (data_base, tipo, uf, cod)
            if chave in chaves:
                raise ValueError("chave duplicada no CSV Desenrola")
            chaves.add(chave)
            # Pacote C, 25/10/2026, recomendação D2 (merge pendente do dono):
            # valida os demais campos inclusive no tipo desconhecido; não deixa
            # essa separação encobrir outra falha que exige reter o arquivo inteiro.
            if tipo not in TIPOS:
                separadas.append((sha, numero_linha, tipo, data_base, json.dumps(r, ensure_ascii=False)))
                continue
            meses.add(data_base)
            rows.append((data_base, TIPOS[tipo][0], uf, cod, nome, n, volume, sha))
        if not rows:
            raise ValueError("CSV sem observações; versão anterior preservada")
        anteriores = {r[0] for r in con.execute("SELECT DISTINCT data_base FROM desenrola_op")}
        if anteriores - meses:
            raise ValueError("meses da série anterior ausentes na republicação; requer revisão")
    except (ValueError, TypeError, KeyError, csv.Error) as e:
        return _rejeitar(con, sha, str(e))

    con.execute("SAVEPOINT desenrola_versao")
    try:
        recorte = {"linhas": len(separadas), "tipos": sorted({r[2] for r in separadas}),
                   "periodo_inicio": min((r[3] for r in separadas), default=None),
                   "periodo_fim": max((r[3] for r in separadas), default=None)}
        quantidade = f"{len(separadas):,}".replace(",", ".")
        linhas = "linha" if len(separadas) == 1 else "linhas"
        tipos = "um tipo não descrito" if len(recorte["tipos"]) == 1 else "tipos não descritos"
        verbo = "ficou" if len(separadas) == 1 else "ficaram"
        recorte["ressalva"] = (
            f"{quantidade} {linhas} de {tipos} na documentação do BCB "
            f"({recorte['periodo_inicio']} a {recorte['periodo_fim']}) {verbo} de fora"
        ) if separadas else None
        con.execute("INSERT OR REPLACE INTO desenrola_recorte VALUES(?,?)", (sha, json.dumps(recorte, ensure_ascii=False)))
        con.execute("DELETE FROM desenrola_tipos_nao_documentados WHERE bronze_sha=?", (sha,))
        con.executemany("INSERT INTO desenrola_tipos_nao_documentados VALUES(?,?,?,?,?)", separadas)
        con.execute("INSERT OR IGNORE INTO desenrola_historico SELECT * FROM desenrola_op")
        # A fonte republica a série inteira; substituir somente após validá-la por completo.
        con.execute("DELETE FROM desenrola_op")
        con.executemany("INSERT INTO desenrola_op VALUES(?,?,?,?,?,?,?,?)", rows)
        con.execute("INSERT OR IGNORE INTO desenrola_historico SELECT * FROM desenrola_op")
        con.execute("INSERT OR REPLACE INTO desenrola_coleta VALUES(?,?,?,?,?,?)",
                    (common.now_utc(), sha, len(rows), len(meses), min(meses), max(meses)))
        _avaliar(con, sha, True)
        common.record_lineage(con, "desenrola.json", caminho, sha,
                              "CSV validado; tipos documentados publicados; demais tipos preservados no bronze e separados com ressalva; troca atômica")
        con.execute("RELEASE desenrola_versao")
    except Exception as e:
        con.execute("ROLLBACK TO desenrola_versao")
        con.execute("RELEASE desenrola_versao")
        return [{"key": "desenrola", "ok": False, "error": str(e)}]
    con.commit()
    return [{"key": "desenrola", "ok": True, "linhas": len(rows), "meses": len(meses),
             "descartadas": 0, "fora_do_recorte": recorte, "periodo": f"{min(meses)}→{max(meses)}"}]
