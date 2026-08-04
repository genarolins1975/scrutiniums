"""consumidor.gov.br — reclamações sobre consignado de beneficiários do INSS, por município.

Fonte: https://www.consumidor.gov.br/pages/publicacao/externo/ (publicações mensais
"Dados - Mês/Ano", ZIP com um CSV).

**Por que esta fonte existe neste módulo.** Não há carteira municipal pública de crédito
consignado — a verificação está em docs/AUDITORIA_CONSIGNADO.md. Esta base é a única
fonte pública com granularidade municipal ligada ao consignado do INSS, porque tem uma
categoria de assunto dedicada a esse público. Ela **não mede crédito**: mede reclamação.

**A ressalva que acompanha todo número daqui.** Contagem de reclamação mede propensão a
reclamar, não incidência de problema. Depende de acesso digital, de conhecimento do canal
e do tamanho da base de clientes de cada instituição. Contagem bruta não é ranking de
conduta, e a página normaliza pela população de 60 anos ou mais antes de comparar
municípios.

**Uma dependência externa, declarada.** O ZIP publicado usa compressão **deflate64**
(método 9), que o `zipfile` da biblioteca padrão não descomprime — ele levanta
`NotImplementedError`. O `unzip` do Info-ZIP descomprime, e está presente tanto no macOS
quanto na imagem Ubuntu usada na integração contínua. O coletor chama `unzip -p` e lê a
saída em fluxo, sem materializar os 141 MB do CSV em disco. É a única fonte do projeto que
depende de um binário externo, e a razão está aqui para quem for portar o pipeline.

O `robots.txt` do domínio bloqueia `/pages/usuario/`, `/ticket/`, `/administrativo/` e
`/reclamacao/`. O caminho usado aqui, `/pages/publicacao/`, não é bloqueado.

Nenhum dado pessoal: o CSV traz sexo, faixa etária e município, sem nome nem documento.
Ainda assim, sexo e faixa etária individuais são descartados linha a linha — o coletor só
persiste contagens agregadas por município, faixa etária e instituição.
"""
import csv
import io
import json
import os
import re
import subprocess
import tempfile

from pipeline import common

LISTA = ("https://www.consumidor.gov.br/pages/publicacao/externo/"
         "publicacoes.json?indicadorTipoPublicacao=2")
DOWNLOAD = "https://www.consumidor.gov.br/pages/publicacao/externo/{cod}/download"
MESES = 12  # janela coletada; a base tem 58 arquivos desde agosto de 2021

MES_NUM = {"janeiro": 1, "fevereiro": 2, "março": 3, "marco": 3, "abril": 4, "maio": 5,
           "junho": 6, "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10,
           "novembro": 11, "dezembro": 12}

# A categoria de assunto dedicada ao público do INSS. O casamento é por marcador textual
# e não por igualdade exata porque a grafia do rótulo varia entre as safras.
# Os marcadores são comparados contra o assunto JÁ NORMALIZADO — sem acento, sem
# pontuação. Escrevê-los acentuados faz o filtro nunca casar, e o coletor devolve zero
# linhas sem erro nenhum.
MARCA_INSS = "beneficiarios do inss"
MARCA_CONSIG = "consignado"


def _norm(s):
    s = (s or "").strip().lower()
    for a, b in (("á", "a"), ("à", "a"), ("ã", "a"), ("â", "a"), ("é", "e"), ("ê", "e"),
                 ("í", "i"), ("ó", "o"), ("ô", "o"), ("õ", "o"), ("ú", "u"), ("ç", "c")):
        s = s.replace(a, b)
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s)).strip()


def _ensure(con):
    con.executescript("""
    CREATE TABLE IF NOT EXISTS reclam_consig_mun(
        competencia TEXT, cod_ibge TEXT, uf TEXT, total INTEGER,
        idosos INTEGER, avaliadas INTEGER, resolvidas INTEGER,
        PRIMARY KEY(competencia, cod_ibge));
    CREATE TABLE IF NOT EXISTS reclam_consig_if(
        competencia TEXT, instituicao TEXT, total INTEGER,
        idosos INTEGER, avaliadas INTEGER, resolvidas INTEGER, nota REAL,
        PRIMARY KEY(competencia, instituicao));
    CREATE TABLE IF NOT EXISTS reclam_consig_coleta(
        competencia TEXT PRIMARY KEY, linhas INTEGER, consignado_inss INTEGER,
        municipios INTEGER, sem_casar INTEGER, collected_at TEXT);
    """)


def _publicacoes():
    body, meta = common.http_get(LISTA, timeout=300, accept="*/*")
    out = []
    for x in json.loads(body):
        m = re.match(r"Dados\s*-\s*(\w+)/(\d{4})", x.get("titulo") or "")
        if not m:
            continue
        mes = MES_NUM.get(_norm(m.group(1)))
        if mes:
            out.append((f"{m.group(2)}-{mes:02d}", x["codigo"]))
    out.sort(reverse=True)
    return out, meta


def _municipios(con):
    """Índice (UF, nome normalizado) -> código do IBGE. Mesma conciliação usada no ESTBAN:
    o CSV traz o nome da cidade, não o código."""
    return {(uf, _norm(nome)): cod
            for cod, nome, uf in con.execute("SELECT cod_ibge, nome, uf FROM ibge_municipios")}


def _idoso(faixa):
    f = _norm(faixa)
    return bool(re.search(r"\b(6[1-9]|7\d|8\d|9\d|mais de 70|entre 61|entre 71)\b", f)) \
        or "mais de 60" in f or "acima de 60" in f


def _linhas_do_zip(body):
    """Gera as linhas do CSV de dentro do ZIP, via `unzip -p`.

    O arquivo temporário existe porque `unzip` não lê ZIP de stdin — ele precisa de
    acesso aleatório ao diretório central. O CSV descomprimido, esse sim, nunca toca o
    disco: sai pelo stdout do processo e é consumido em fluxo.
    """
    tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    try:
        tmp.write(body)
        tmp.close()
        proc = subprocess.Popen(["unzip", "-p", tmp.name], stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL)
        fluxo = io.TextIOWrapper(proc.stdout, encoding="utf-8", errors="replace", newline="")
        # Ao menos uma competência publicada traz bytes nulos no meio do CSV, e o leitor
        # da biblioteca padrão aborta com "line contains NUL". Removê-los é seguro: NUL
        # não é caractere válido em nenhum dos campos.
        limpo = (l.replace("\x00", "") for l in fluxo)
        try:
            for linha in csv.DictReader(limpo, delimiter=";"):
                yield linha
        finally:
            proc.stdout.close()
            proc.wait()
    finally:
        os.unlink(tmp.name)


def collect(con, cfg=None):
    _ensure(con)
    try:
        pubs, _meta = _publicacoes()
    except Exception as e:
        return [{"key": "reclamacoes_consig", "ok": False, "error": str(e)[:200]}]

    idx = _municipios(con)
    results = []
    for comp, cod in pubs[:MESES]:
        if con.execute("SELECT 1 FROM reclam_consig_coleta WHERE competencia=?", (comp,)).fetchone():
            continue
        try:
            body, meta = common.http_get(DOWNLOAD.format(cod=cod), timeout=900, accept="*/*")
            _, sha = common.save_bronze("reclamacoes_consig", comp,
                                        json.dumps({"bytes": len(body)}).encode("utf-8"),
                                        {**meta, "competencia": comp})
            por_mun, por_if = {}, {}
            n, alvo, sem_casar = 0, 0, set()
            for linha in _linhas_do_zip(body):
                n += 1
                assunto = _norm(linha.get("Assunto"))
                if MARCA_CONSIG not in assunto or MARCA_INSS not in assunto:
                    continue
                alvo += 1
                uf = (linha.get("UF") or "").strip().upper()
                cidade = _norm(linha.get("Cidade"))
                idoso = _idoso(linha.get("Faixa Etária"))
                resp = _norm(linha.get("Respondida")).startswith("s")
                # "Situação" só distingue finalizada avaliada de não avaliada. Quem diz se
                # o problema foi resolvido é "Avaliação Reclamação", e ela só existe nas
                # reclamações que o consumidor avaliou — a taxa é calculada sobre essas.
                av = _norm(linha.get("Avaliação Reclamação") or linha.get("Avaliacao Reclamacao"))
                avaliada = av.startswith("resolvida") or av.startswith("nao resolvida")
                resolvida = av.startswith("resolvida")

                ci = idx.get((uf, cidade))
                if ci:
                    a = por_mun.setdefault(ci, {"uf": uf, "t": 0, "i": 0, "r": 0, "s": 0})
                    a["t"] += 1
                    a["i"] += 1 if idoso else 0
                    a["r"] += 1 if avaliada else 0
                    a["s"] += 1 if resolvida else 0
                elif uf and cidade:
                    sem_casar.add((uf, cidade))

                inst = (linha.get("Nome Fantasia") or "").strip()
                if inst:
                    b = por_if.setdefault(inst, {"t": 0, "i": 0, "r": 0, "s": 0,
                                                 "notas": 0.0, "nn": 0})
                    b["t"] += 1
                    b["i"] += 1 if idoso else 0
                    b["r"] += 1 if avaliada else 0
                    b["s"] += 1 if resolvida else 0
                    try:
                        b["notas"] += float((linha.get("Nota do Consumidor") or "").replace(",", "."))
                        b["nn"] += 1
                    except ValueError:
                        pass

            for ci, a in por_mun.items():
                con.execute("INSERT OR REPLACE INTO reclam_consig_mun VALUES(?,?,?,?,?,?,?)",
                            (comp, ci, a["uf"], a["t"], a["i"], a["r"], a["s"]))
            for inst, b in por_if.items():
                con.execute("INSERT OR REPLACE INTO reclam_consig_if VALUES(?,?,?,?,?,?,?)",
                            (comp, inst, b["t"], b["i"], b["r"], b["s"],
                             round(b["notas"] / b["nn"], 2) if b["nn"] else None))
            con.execute("INSERT OR REPLACE INTO reclam_consig_coleta VALUES(?,?,?,?,?,?)",
                        (comp, n, alvo, len(por_mun), len(sem_casar), common.now_utc()))
            con.commit()
            common.record_lineage(con, "consignado.json", f"bronze/reclamacoes_consig/{comp}", sha,
                                  "consumidor.gov.br -> reclamações sobre consignado de "
                                  "beneficiários do INSS, agregadas por município e instituição")
            results.append({"key": f"reclamacoes_consig:{comp}", "ok": True, "linhas": n,
                            "consignado_inss": alvo, "municipios": len(por_mun),
                            "sem_casar": len(sem_casar)})
        except Exception as e:
            results.append({"key": f"reclamacoes_consig:{comp}", "ok": False, "error": str(e)[:200]})
    return results or [{"key": "reclamacoes_consig", "ok": True, "note": "competências já absorvidas"}]
