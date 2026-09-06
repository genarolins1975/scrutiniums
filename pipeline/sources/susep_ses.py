"""Conector SUSEP — Sistema de Estatísticas da SUSEP (SES), seguro prestamista.

Fonte: www2.susep.gov.br/download/estatisticas/BaseCompleta.zip (dados abertos da SUSEP,
zip de ~550 MB atualizado mensalmente). Só três tabelas interessam e juntas têm ~30 MB
comprimidos: Ses_seguros.csv (prêmios, sinistros e comissões por mês, empresa e ramo),
Ses_cias.csv e Ses_grupos_economicos.csv (nomes de empresas e grupos). O servidor aceita
`Range`, então o coletor lê o diretório central do zip e só os membros necessários, sem
baixar o arquivo inteiro (validado em 06/09/2026: 10 requisições e 28 MB para ler
Ses_seguros inteiro).

Prestamista é o seguro que quita ou amortiza a dívida em caso de morte, invalidez ou
desemprego do tomador. Três ramos da SUSEP: 0977 (prestamista, exceto habitacional e
rural), 1377 (idem, ramo novo do plano de contas) e 1061 (prestamista de apólice de mercado
habitacional). Guardam-se prêmio direto, prêmio retido, prêmio ganho, sinistro direto,
sinistro ocorrido e despesa de comercialização, por mês × empresa × ramo, desde 2015.

Idempotência: `Last-Modified` do zip fica em `susep_coleta`; mês só é rebaixado quando a
SUSEP republica a base. Nada é estimado: quem não reporta não aparece.
"""
import csv
import io
import urllib.request
import zipfile

from pipeline import common

URL = "https://www2.susep.gov.br/download/estatisticas/BaseCompleta.zip"
RAMOS = {"0977": "Prestamista (exceto habitacional e rural)", "1377": "Prestamista (exceto habitacional e rural), plano novo",
         "1061": "Prestamista habitacional (apólice de mercado)"}
MES_INICIAL = "201501"


class _HttpFile(io.RawIOBase):
    """Arquivo remoto lido por faixas (HTTP Range): o zip da SUSEP é grande demais para baixar todo mês."""

    def __init__(self, url, timeout=300):
        self.url, self.timeout, self.pos, self.requisicoes, self.bytes = url, timeout, 0, 0, 0
        r = urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=60)
        self.size = int(r.headers["Content-Length"])
        self.last_modified = r.headers.get("Last-Modified", "")
        if "bytes" not in (r.headers.get("Accept-Ranges") or ""):
            raise RuntimeError("servidor da SUSEP não aceita Range; leitura parcial impossível")

    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else (self.pos + off if whence == 1 else self.size + off)
        self.pos = max(0, min(self.pos, self.size))
        return self.pos

    def tell(self):
        return self.pos

    def readable(self):
        return True

    def seekable(self):
        return True

    def readinto(self, b):
        n = len(b)
        if self.pos + n > self.size:
            n = self.size - self.pos
        if n <= 0:
            return 0
        req = urllib.request.Request(self.url, headers={"Range": f"bytes={self.pos}-{self.pos + n - 1}"})
        data = urllib.request.urlopen(req, timeout=self.timeout).read()
        b[:len(data)] = data
        self.pos += len(data)
        self.requisicoes += 1
        self.bytes += len(data)
        return len(data)


def _ensure(con):
    con.executescript("""
    CREATE TABLE IF NOT EXISTS susep_prestamista(
        mes TEXT, coenti TEXT, ramo TEXT, cogrupo TEXT,
        premio_direto REAL, premio_retido REAL, premio_ganho REAL, sinistro_direto REAL, sinistro_ocorrido REAL, desp_com REAL,
        PRIMARY KEY(mes, coenti, ramo));
    CREATE TABLE IF NOT EXISTS susep_entidades(coenti TEXT PRIMARY KEY, noenti TEXT, cogrupo TEXT, nogrupo TEXT, mes_ref TEXT);
    CREATE TABLE IF NOT EXISTS susep_coleta(fonte TEXT PRIMARY KEY, last_modified TEXT, tamanho INTEGER, linhas INTEGER,
        meses INTEGER, mes_max TEXT, requisicoes INTEGER, bytes_lidos INTEGER, coletado_em TEXT);
    """)


def _num(s):
    return float((s or "0").replace(",", ".") or 0)


def _membro(zf, nome):
    n = next((x for x in zf.namelist() if x.lower() == nome.lower()), None)
    if not n:
        raise ValueError(f"{nome} ausente no zip da SUSEP")
    return n


def collect(con, cfg):
    _ensure(con)
    key = "susep_ses:prestamista"
    try:
        f = _HttpFile(URL)
        antes = con.execute("SELECT last_modified FROM susep_coleta WHERE fonte='BaseCompleta.zip'").fetchone()
        if antes and antes[0] == f.last_modified and f.last_modified:
            return [{"key": key, "ok": True, "pulado": f"base inalterada desde {f.last_modified}"}]
        zf = zipfile.ZipFile(io.BufferedReader(f, buffer_size=4 << 20))
        # nomes: grupo econômico vigente por empresa (último mês da tabela de grupos) e cadastro de empresas
        grupos = {}
        with zf.open(_membro(zf, "Ses_grupos_economicos.csv")) as fh:
            for r in csv.DictReader(io.TextIOWrapper(fh, encoding="latin-1"), delimiter=";"):
                ce = (r.get("coenti") or "").strip()
                if not ce:
                    continue
                m = (r.get("damesano") or "").strip()
                if ce not in grupos or m > grupos[ce][0]:
                    grupos[ce] = (m, (r.get("noenti") or "").strip(), (r.get("cogrupo") or "").strip(), (r.get("nogrupo") or "").strip())
        with zf.open(_membro(zf, "Ses_cias.csv")) as fh:
            for r in csv.DictReader(io.TextIOWrapper(fh, encoding="latin-1"), delimiter=";"):
                ce = (r.get("Coenti") or "").strip()
                if ce and ce not in grupos:
                    grupos[ce] = ("", (r.get("Noenti") or "").strip(), (r.get("Cogrupo") or "").strip(), (r.get("Nogrupo") or "").strip())
        linhas, meses = [], set()
        n_total = 0
        with zf.open(_membro(zf, "Ses_seguros.csv")) as fh:
            for r in csv.DictReader(io.TextIOWrapper(fh, encoding="latin-1"), delimiter=";"):
                n_total += 1
                ramo = (r.get("coramo") or "").strip()
                if ramo not in RAMOS:
                    continue
                mes = (r.get("damesano") or "").strip()
                if mes < MES_INICIAL:
                    continue
                meses.add(mes)
                linhas.append((mes, (r.get("coenti") or "").strip(), ramo, (r.get("cogrupo") or "").strip(),
                               _num(r.get("premio_direto")), _num(r.get("premio_retido")), _num(r.get("premio_ganho")),
                               _num(r.get("sinistro_direto")), _num(r.get("sinistro_ocorrido")), _num(r.get("desp_com"))))
        if not linhas:
            return [{"key": key, "ok": False, "error": "nenhuma linha dos ramos prestamista em Ses_seguros.csv"}]
        con.execute("DELETE FROM susep_prestamista")
        con.executemany("INSERT OR REPLACE INTO susep_prestamista VALUES(?,?,?,?,?,?,?,?,?,?)", linhas)
        con.execute("DELETE FROM susep_entidades")
        con.executemany("INSERT INTO susep_entidades VALUES(?,?,?,?,?)", [(ce, v[1], v[2], v[3], v[0]) for ce, v in grupos.items()])
        mes_max = max(meses)
        extrato = "\n".join(";".join(str(x) for x in l) for l in linhas[-2000:])
        bronze_file, sha = common.save_bronze("susep_ses", f"prestamista_{mes_max}", extrato.encode(),
                                              {"url": URL, "last_modified": f.last_modified, "nota": "últimas 2000 linhas dos ramos 0977, 1377 e 1061 de Ses_seguros.csv, lidas por HTTP Range"})
        con.execute("INSERT OR REPLACE INTO susep_coleta VALUES('BaseCompleta.zip',?,?,?,?,?,?,?,?)",
                    (f.last_modified, f.size, n_total, len(meses), mes_max, f.requisicoes, f.bytes, common.now_utc()))
        common.record_lineage(con, f"susep_prestamista:{mes_max}", bronze_file, sha,
                              "SUSEP SES BaseCompleta.zip: Ses_seguros.csv (ramos prestamista 0977, 1377, 1061), Ses_grupos_economicos.csv e Ses_cias.csv, lidos por HTTP Range")
        return [{"key": key, "ok": True, "linhas": len(linhas), "meses": len(meses), "mes_max": mes_max,
                 "requisicoes": f.requisicoes, "mb_lidos": round(f.bytes / 1e6, 1), "last_modified": f.last_modified}]
    except Exception as e:
        return [{"key": key, "ok": False, "error": str(e)[:160]}]
