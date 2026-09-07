"""Conector Tesouro Nacional — garantias da União em operações de crédito (contratos internos e externos).

Fonte: Tesouro Transparente (CKAN), datasets "Garantias Concedidas em Operações de Crédito Internas" e
"... Externas": um CSV cada, com todos os contratos garantidos pela União desde 2010 (935 internos e 426
externos na posição de 30/04/2026), com ano, número do contrato, credor, mutuário, data de assinatura,
moeda de origem, valor e descrição. A STN republica o arquivo a cada quadrimestre.

O que não existe em dado aberto estruturado (sondagem de 07/09/2026): garantias honradas (o que a União
pagou por inadimplência do ente) e o saldo devedor por contrato. Só a concessão é publicada; o painel diz
isso.

Mutuário vem como texto livre em dois padrões ("Estado de Sergipe", "Município de Santos" até 2024;
"Est. Bahia", "Mun. Belo Horizonte/MG" de 2025 em diante). O coletor classifica em Estado, Município, DF e
Outros (estatais, bancos públicos) e resolve a UF pelo nome do estado (com tolerância a erro de grafia da
fonte, como "Segipe"), pelo sufixo "/UF" ou, para município sem sufixo, pelo cadastro do IBGE quando o
nome é único no país (5.290 de 5.571 nomes); homônimos ficam com uf nula, nunca adivinhada.
"""
import csv
import difflib
import io
import re
import unicodedata

from pipeline import common
from pipeline.ufs import NOMES

URLS = {
    "interna": "https://www.tesourotransparente.gov.br/ckan/dataset/f8dfe745-4500-4b57-81d2-ba49307ae908/resource/282d64c5-7ab0-4f57-a88f-b79068c6b765/download",
    "externa": "https://www.tesourotransparente.gov.br/ckan/dataset/548288ed-0215-4509-af74-36c8256de31e/resource/f460a427-ad1a-4073-b7e1-90306c05277d/download",
}
PAGINA = "https://www.tesourotransparente.gov.br/ckan/dataset/garantias-concedidas-em-operacoes-de-credito-internas"


def _norm(s):
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower().strip()


_UF_POR_NOME = {_norm(n): uf for uf, n in NOMES.items()}


def classifica(mutuario, mun_uf=None):
    """-> (tipo, uf). tipo em Estado, Município, DF, Outros. `mun_uf`: nome normalizado -> UF só para municípios de nome único no IBGE."""
    m = (mutuario or "").strip()
    n = _norm(m)
    if "distrito federal" in n or n in ("df", "governo do df", "gdf"):
        return "DF", "DF"
    for pref in ("estado do ", "estado da ", "estado de ", "est. ", "governo do estado do ", "governo do estado da ", "governo do estado de "):
        if n.startswith(pref):
            resto = re.sub(r"[/\-].*$", "", n[len(pref):]).strip()
            uf = _UF_POR_NOME.get(resto)
            if uf is None:  # grafia com erro na fonte ("Segipe"): só aceita casamento quase exato
                cand = difflib.get_close_matches(resto, list(_UF_POR_NOME), n=1, cutoff=0.85)
                uf = _UF_POR_NOME.get(cand[0]) if cand else None
            return "Estado", uf
    for pref in ("municipio do ", "municipio da ", "municipio de ", "mun. ", "prefeitura municipal de ", "prefeitura de "):
        if n.startswith(pref):
            mm = re.search(r"/\s*([a-z]{2})\s*$", n)
            uf = mm.group(1).upper() if mm and mm.group(1).upper() in NOMES else None
            if uf is None and mun_uf:
                uf = mun_uf.get(re.sub(r"\s*[/(].*$", "", n[len(pref):]).strip())
            return "Município", uf
    return "Outros", None


def _num(s):
    s = (s or "").strip().replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def _iso(d):
    d = (d or "").strip()
    return f"{d[6:10]}-{d[3:5]}-{d[0:2]}" if len(d) >= 10 and d[2] == "/" else None


def _ensure(con):
    con.executescript("""
    CREATE TABLE IF NOT EXISTS tesouro_garantias(tipo TEXT, contrato TEXT, ano INTEGER, credor TEXT, mutuario TEXT, mutuario_tipo TEXT, uf TEXT,
        data_assinatura TEXT, moeda TEXT, valor REAL, descricao TEXT, PRIMARY KEY(tipo, contrato, mutuario, data_assinatura));
    CREATE TABLE IF NOT EXISTS tesouro_garantias_coleta(tipo TEXT PRIMARY KEY, posicao TEXT, linhas INTEGER, bytes INTEGER, coletado_em TEXT);
    """)


def _municipios_unicos(con):
    """Nome normalizado -> UF para os municípios de nome único no cadastro do IBGE (5.290 nomes, 240 repetidos ficam fora)."""
    try:
        rows = con.execute("SELECT nome, uf FROM ibge_municipios").fetchall()
    except Exception:
        return {}
    cont, uf_de = {}, {}
    for nome, uf in rows:
        k = _norm(nome)
        cont[k] = cont.get(k, 0) + 1
        uf_de[k] = uf
    return {k: uf_de[k] for k, c in cont.items() if c == 1}


def _parse(raw, mun_uf=None):
    for enc in ("utf-8", "cp1252", "latin-1"):
        try:
            txt = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    linhas = txt.splitlines()
    hi = next((i for i, l in enumerate(linhas) if l.startswith("ANO;")), None)
    if hi is None:
        raise ValueError("cabeçalho ANO; não encontrado no CSV de garantias")
    pos = next((l for l in linhas[:hi] if "Posição em" in l), "")
    posicao = _iso(pos.split("Posição em")[-1].strip()) if pos else None
    rows = [r for r in csv.DictReader(io.StringIO("\n".join(linhas[hi:])), delimiter=";") if (r.get("ANO") or "").strip().isdigit()]
    vk = next(k for k in rows[0] if k.startswith("VALOR"))
    out = []
    for r in rows:
        t, uf = classifica(r.get("MUTUÁRIO"), mun_uf)
        out.append((int(r["ANO"].strip()), (r.get("CONTRATO") or "").strip(), (r.get("CREDOR") or "").strip(), (r.get("MUTUÁRIO") or "").strip(), t, uf,
                    _iso(r.get("DATA DE ASSINATURA")), (r.get("MOEDA DE ORIGEM") or "").strip().upper(), _num(r.get(vk)), (r.get("DESCRIÇÃO") or "").strip()[:300]))
    return posicao, out


def collect(con, cfg):
    _ensure(con)
    key = "tesouro_garantias:contratos"
    try:
        res = {}
        mun_uf = _municipios_unicos(con)
        for tipo, url in URLS.items():
            body, _ = common.http_get(url, timeout=120)
            posicao, linhas = _parse(body, mun_uf)
            if len(linhas) < 200:
                return [{"key": key, "ok": False, "error": f"{tipo}: {len(linhas)} contratos, abaixo do piso de 200; nada gravado"}]
            antes = con.execute("SELECT posicao FROM tesouro_garantias_coleta WHERE tipo=?", (tipo,)).fetchone()
            con.execute("DELETE FROM tesouro_garantias WHERE tipo=?", (tipo,))
            con.executemany("INSERT OR REPLACE INTO tesouro_garantias VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                            [(tipo, l[1], l[0], l[2], l[3], l[4], l[5], l[6], l[7], l[8], l[9]) for l in linhas])
            con.execute("INSERT OR REPLACE INTO tesouro_garantias_coleta VALUES(?,?,?,?,?)", (tipo, posicao, len(linhas), len(body), common.now_utc()))
            bronze_file, sha = common.save_bronze("tesouro_garantias", f"{tipo}_{(posicao or '').replace('-', '')}", body, {"url": url, "posicao": posicao})
            common.record_lineage(con, f"tesouro_garantias_{tipo}:{posicao}", bronze_file, sha,
                                  f"Tesouro Transparente: contratos {tipo}s com garantia da União, posição {posicao}")
            res[tipo] = {"linhas": len(linhas), "posicao": posicao, "inalterado": bool(antes and antes[0] == posicao),
                         "sem_uf": sum(1 for l in linhas if l[4] in ("Estado", "Município") and not l[5])}
        con.commit()
        return [{"key": key, "ok": True, **{f"{t}_{k}": v for t, d in res.items() for k, v in d.items()}}]
    except Exception as e:
        return [{"key": key, "ok": False, "error": str(e)[:160]}]
