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
    """)


def _num(s):
    """Volume vem com milhar por ponto e decimal por vírgula (padrão brasileiro)."""
    s = (s or "").strip()
    return float(s.replace(".", "").replace(",", ".")) if s else 0.0


def collect(con, cfg=None):
    _ensure(con)
    try:
        body, meta = common.http_get(URL, timeout=180)
    except Exception as e:
        return [{"key": "desenrola", "ok": False, "error": str(e)[:200]}]
    caminho, sha = common.save_bronze("desenrola", "dados_desenrola.csv", body, {**meta, "dataset": DATASET})

    ja = con.execute("SELECT linhas FROM desenrola_coleta WHERE bronze_sha=?", (sha,)).fetchone()
    if ja:
        return [{"key": "desenrola", "ok": True, "note": "arquivo inalterado desde a última coleta",
                 "linhas": ja[0]}]

    rdr = csv.DictReader(io.StringIO(body.decode("utf-8-sig")), delimiter=";")
    obrigatorias = {"DATA_BASE", "TIPO_DESENROLA", "UNIDADE_FEDERACAO", "COD_CONGLOMERADO_FINANCEIRO",
                    "NOME_CONGLOMERADO_FINANCEIRO", "NUMERO_OPERACOES", "VOLUME_OPERACOES"}
    faltando = obrigatorias - set(rdr.fieldnames or [])
    if faltando:
        # o esquema mudou: falhar alto é melhor do que gravar número errado em silêncio
        return [{"key": "desenrola", "ok": False,
                 "error": f"colunas ausentes no CSV: {sorted(faltando)} (esquema da fonte mudou)"}]

    linhas, meses, fora = 0, set(), 0
    con.execute("DELETE FROM desenrola_op")  # a fonte republica a série inteira a cada mês
    for r in rdr:
        db = (r["DATA_BASE"] or "").strip()
        if len(db) != 6 or not db.isdigit():
            fora += 1
            continue
        tipo = (r["TIPO_DESENROLA"] or "").strip()
        if tipo not in TIPOS:
            fora += 1
            continue
        uf = (r["UNIDADE_FEDERACAO"] or "").strip().upper()
        if uf not in UFS:
            fora += 1
            continue
        data_base = f"{db[:4]}-{db[4:]}"
        meses.add(data_base)
        con.execute("INSERT OR REPLACE INTO desenrola_op VALUES(?,?,?,?,?,?,?,?)",
                    (data_base, TIPOS[tipo][0], uf,
                     (r["COD_CONGLOMERADO_FINANCEIRO"] or "").strip(),
                     (r["NOME_CONGLOMERADO_FINANCEIRO"] or "").strip(),
                     int(r["NUMERO_OPERACOES"] or 0), _num(r["VOLUME_OPERACOES"]), sha))
        linhas += 1

    con.execute("INSERT OR REPLACE INTO desenrola_coleta VALUES(?,?,?,?,?,?)",
                (common.now_utc(), sha, linhas, len(meses), min(meses) if meses else None,
                 max(meses) if meses else None))
    common.record_lineage(con, "desenrola.json", caminho, sha,
                          "CSV agregado do SCR -> desenrola_op (uma linha por data-base × tipo × UF × conglomerado)")
    con.commit()
    return [{"key": "desenrola", "ok": True, "linhas": linhas, "meses": len(meses),
             "descartadas": fora, "periodo": f"{min(meses)}→{max(meses)}" if meses else None}]
