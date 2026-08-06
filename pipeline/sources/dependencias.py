"""Cadastro de dependências das instituições supervisionadas (BCB/Unicad).

Três cadastros públicos, um por tipo de ponto de atendimento, servidos pelo
Olinda em CSV e atualizados pelo próprio BC a cada nova posição:

- **Agências** (`Informes_Agencias`): dependência com atendimento completo.
- **Postos de atendimento** (`Informes_PostosDeAtendimento`): PAB, PAC, PAA,
  posto de câmbio, de microcrédito, etc. — o tipo vem declarado na linha.
- **Postos de atendimento eletrônico** (`Informes_PostosDeAtendimentoEletronico`):
  PAE, o caixa eletrônico fora de agência.

Por que isto complementa o ESTBAN, sem substituí-lo: o ESTBAN conta **agências
processadas** (as que entregaram o balancete daquele mês) e tem série mensal
desde 2023; o Unicad é um **cadastro**, sem série histórica publicada, mas
alcança postos e PAEs, que o ESTBAN não vê. Os dois números de agência não são
iguais, não são reconciliados e nunca aparecem somados — a diferença é de
conceito e de data-base, e viaja declarada até a tela.

Como não há série publicada, cada coleta grava a posição corrente em
`dep_unidades` (detalhe por município) e acumula o agregado em `dep_hist`: a
série passa a existir daqui para a frente, construída pelo próprio pipeline, em
vez de ser reconstruída de memória.
"""
import csv
import io

from pipeline import common

BASE = "https://olinda.bcb.gov.br/olinda/servico/{servico}/versao/v1/odata/{recurso}?$format=text/csv"

# tipo interno, serviço Olinda, recurso, coluna do CNPJ-raiz
FONTES = [
    ("agencia", "Informes_Agencias", "Agencias", "CnpjBase"),
    ("posto", "Informes_PostosDeAtendimento", "PostosAtendimento", "Cnpj"),
    ("pae", "Informes_PostosDeAtendimentoEletronico", "PostosAtendimentoEletronico", "Cnpj"),
]

ROTULOS = {
    "agencia": "Agências",
    "posto": "Postos de atendimento",
    "pae": "Postos de atendimento eletrônico (PAE)",
}

PAGINA = "https://www.bcb.gov.br/fis/info/agencias.asp"


def _ensure(con):
    con.executescript("""
    CREATE TABLE IF NOT EXISTS dep_unidades(
        tipo TEXT, cnpj8 TEXT, nome_if TEXT, segmento TEXT, tipo_posto TEXT,
        municipio_ibge TEXT, uf TEXT, qtd INTEGER, posicao TEXT,
        PRIMARY KEY(tipo, cnpj8, municipio_ibge, tipo_posto));
    CREATE TABLE IF NOT EXISTS dep_hist(
        posicao TEXT, tipo TEXT, cnpj8 TEXT, qtd INTEGER, municipios INTEGER,
        PRIMARY KEY(posicao, tipo, cnpj8));
    CREATE TABLE IF NOT EXISTS dep_coleta(
        chave TEXT PRIMARY KEY, coletado_em TEXT, sha TEXT, detalhe TEXT);
    """)


def _cnpj8(v):
    v = "".join(ch for ch in str(v or "") if ch.isdigit())
    return v[:8].zfill(8) if v else ""


def _absorve(con, tipo, texto, col_cnpj):
    linhas = list(csv.DictReader(io.StringIO(texto)))
    if not linhas:
        raise RuntimeError(f"cadastro de {tipo} veio vazio")
    for obrig in (col_cnpj, "NomeIf", "MunicipioIbge", "UF", "Posicao"):
        if obrig not in linhas[0]:
            raise RuntimeError(f"coluna {obrig} ausente em {tipo} — esquema do BCB mudou")
    posicao = (linhas[0].get("Posicao") or "").strip()
    agreg = {}
    nomes = {}
    for l in linhas:
        c = _cnpj8(l.get(col_cnpj))
        if not c:
            continue
        mun = (l.get("MunicipioIbge") or "").strip()
        tp = (l.get("TipoPosto") or ROTULOS[tipo]).strip()
        chave = (c, mun, tp)
        agreg[chave] = agreg.get(chave, 0) + 1
        nomes[c] = ((l.get("NomeIf") or "").strip(), (l.get("Segmento") or "").strip(), (l.get("UF") or "").strip())
    con.execute("DELETE FROM dep_unidades WHERE tipo=?", (tipo,))
    for (c, mun, tp), qtd in agreg.items():
        nome, seg, uf = nomes[c]
        con.execute("INSERT OR REPLACE INTO dep_unidades VALUES(?,?,?,?,?,?,?,?,?)",
                    (tipo, c, nome, seg, tp, mun, uf, qtd, posicao))
    # agregado por instituição vira histórico: o BC não publica série, e o
    # painel passa a ter uma a partir da primeira coleta
    por_if = {}
    for (c, mun, _tp), qtd in agreg.items():
        d = por_if.setdefault(c, {"qtd": 0, "mun": set()})
        d["qtd"] += qtd
        if mun:
            d["mun"].add(mun)
    for c, d in por_if.items():
        con.execute("INSERT OR REPLACE INTO dep_hist VALUES(?,?,?,?,?)",
                    (posicao, tipo, c, d["qtd"], len(d["mun"])))
    return {"linhas": len(linhas), "instituicoes": len(por_if), "posicao": posicao}


def collect(con, cfg=None):
    _ensure(con)
    resultados = []
    for tipo, servico, recurso, col_cnpj in FONTES:
        url = BASE.format(servico=servico, recurso=recurso)
        try:
            body, meta = common.http_get(url, timeout=300, accept=None)
        except Exception as e:
            resultados.append({"key": f"dependencias:{tipo}", "ok": False, "error": str(e)[:200]})
            continue
        _, sha = common.save_bronze("dependencias", f"unicad_{tipo}", body, meta)
        anterior = con.execute("SELECT sha FROM dep_coleta WHERE chave=?", (tipo,)).fetchone()
        if anterior and anterior[0] == sha:
            resultados.append({"key": f"dependencias:{tipo}", "ok": True, "inalterado": True})
            continue
        try:
            r = _absorve(con, tipo, body.decode("utf-8-sig", errors="replace"), col_cnpj)
        except Exception as e:
            resultados.append({"key": f"dependencias:{tipo}", "ok": False, "error": str(e)[:200]})
            continue
        con.execute("INSERT OR REPLACE INTO dep_coleta VALUES(?,?,?,?)",
                    (tipo, common.now_utc(), sha, r["posicao"]))
        common.record_lineage(con, "operacional.json", f"unicad_{tipo}.csv", sha,
                              f"Unicad/{recurso} -> dep_unidades ({tipo}, agregado por município e tipo de posto)")
        resultados.append({"key": f"dependencias:{tipo}", "ok": True, **r})
    con.commit()
    return resultados
