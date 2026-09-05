"""Processos administrativos sancionadores da CVM (dados abertos).

Um zip com dois CSV: o processo (número único, objeto, data de abertura, área
instrutora, fase, subfase e local atuais, última movimentação) e os acusados (nome e
situação atual). O acervo inteiro é republicado; cada coleta substitui as tabelas e o
hash evita regravar. A base traz a fase, não o resultado: absolvição, multa ou termo
de compromisso não estão estruturados aqui (ficam nos julgamentos em texto).
"""
import csv
import io
import zipfile

csv.field_size_limit(10_000_000)

from pipeline import common

URL = "https://dados.cvm.gov.br/dados/PROCESSO/SANCIONADOR/DADOS/processo_sancionador.zip"


def _ensure(con):
    con.execute("""CREATE TABLE IF NOT EXISTS cvm_pas_processo(nup TEXT PRIMARY KEY, objeto TEXT, ementa TEXT, abertura TEXT, area TEXT,
        fase TEXT, subfase TEXT, local TEXT, ultima_mov TEXT)""")
    con.execute("CREATE TABLE IF NOT EXISTS cvm_pas_acusado(nup TEXT, nome TEXT, situacao TEXT, data TEXT, PRIMARY KEY(nup, nome, situacao, data))")
    con.execute("CREATE TABLE IF NOT EXISTS cvm_pas_coleta(sha TEXT PRIMARY KEY, collected_at TEXT, n_proc INTEGER, n_acus INTEGER)")


def collect(con, cfg=None):
    _ensure(con)
    try:
        body, meta = common.http_get(URL, timeout=180, accept="*/*")
    except Exception as e:
        return [{"key": "cvm_pas", "ok": False, "error": str(e)[:160]}]
    bronze_file, sha = common.save_bronze("cvm_pas", "processo_sancionador", body, meta)
    if con.execute("SELECT 1 FROM cvm_pas_coleta WHERE sha=?", (sha,)).fetchone():
        return [{"key": "cvm_pas", "ok": True, "nota": "zip inalterado (hash)"}]
    try:
        zf = zipfile.ZipFile(io.BytesIO(body))
        g = lambda r, k: ((r.get(k) or "").strip() or None)
        proc = [(g(r, "NUP"), g(r, "Objeto"), g(r, "Ementa"), g(r, "Data_Abertura"), g(r, "Componente_Organizacional_Instrucao"), g(r, "Fase_Atual"), g(r, "Subfase_Atual"), g(r, "Local_Atual"), g(r, "Data_Ultima_Movimentacao"))
                for r in csv.DictReader(io.StringIO(zf.read("processo_sancionador.csv").decode("latin-1")), delimiter=";") if g(r, "NUP")]
        acus = [(g(r, "NUP"), g(r, "Nome_Acusado"), g(r, "Situacao"), g(r, "Data_Situacao"))
                for r in csv.DictReader(io.StringIO(zf.read("processo_sancionador_acusado.csv").decode("latin-1")), delimiter=";") if g(r, "NUP")]
    except Exception as e:
        return [{"key": "cvm_pas", "ok": False, "error": f"parse: {str(e)[:140]}"}]
    con.execute("DELETE FROM cvm_pas_processo"); con.execute("DELETE FROM cvm_pas_acusado")
    con.executemany("INSERT OR REPLACE INTO cvm_pas_processo VALUES(?,?,?,?,?,?,?,?,?)", proc)
    con.executemany("INSERT OR REPLACE INTO cvm_pas_acusado VALUES(?,?,?,?)", acus)
    con.execute("INSERT OR REPLACE INTO cvm_pas_coleta VALUES(?,?,?,?)", (sha, common.now_utc(), len(proc), len(acus)))
    common.record_lineage(con, "conduta.json", bronze_file, sha, "CVM processos sancionadores: processo e acusados, acervo inteiro substituído a cada coleta")
    con.commit()
    return [{"key": "cvm_pas", "ok": True, "processos": len(proc), "acusados": len(acus)}]
