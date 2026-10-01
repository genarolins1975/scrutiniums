"""Coletor genérico de portais CKAN (ANEEL, ONS) para os módulos do domínio Energia.

Cada download vira uma vintage no silver da família (sha256, capturado_em e o
last_modified do recurso como publicado_em) e uma cópia imutável no bronze. O arquivo
é baixado em fluxo para disco, sem carregar tudo na memória: há recursos da ANEEL
com centenas de megabytes.

Política de recoleta (fontes mensais e anuais não precisam de download diário):
- recurso cujo last_modified na API não mudou e cuja última captura bem-sucedida tem
  menos de `max_idade_dias` não é baixado de novo;
- download que chega idêntico (mesmo sha256) à última vintage do recurso não cria
  vintage nova: fica registrado em `coletas` como recaptura sem mudança.
Falha de fonte nunca vira número: é registrada e o chamador decide (a gold anterior
fica no ar pela sentinela do run.py).
"""
import csv
import io
import json
import os
import sys
import tempfile
import time
import zipfile
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.common import http_download, http_get  # noqa: E402
from pipeline.energia import base  # noqa: E402

PORTAIS = {
    "ANEEL": "https://dadosabertos.aneel.gov.br",
    "ONS": "https://dados.ons.org.br",
}

# Licença declarada pelos portais (o package_show traz license_title; este é o texto
# de reserva quando o campo vem vazio).
LICENCA_ANEEL = "Open Data Commons Open Database License (ODbL), conforme o portal de dados abertos da ANEEL"


def url_dataset(orgao, nome):
    return f"{PORTAIS[orgao]}/dataset/{nome}"


def pacote(orgao, nome, baixar=http_get):
    """Resultado do package_show (dict). Lança em falha: o chamador registra."""
    corpo, _ = baixar(f"{PORTAIS[orgao]}/api/3/action/package_show?id={nome}")
    dado = json.loads(corpo.decode("utf-8"))
    if not dado.get("success"):
        raise RuntimeError(f"package_show {orgao}/{nome}: success=false")
    return dado["result"]


def metadados(pac, orgao):
    """Metadados públicos do conjunto para proveniência e catálogo."""
    return {
        "titulo": pac.get("title"),
        "nome": pac.get("name"),
        "licenca": pac.get("license_title") or (LICENCA_ANEEL if orgao == "ANEEL" else None),
        "licenca_url": pac.get("license_url"),
        "modificado": pac.get("metadata_modified"),
        "frequencia": next((e.get("value") for e in pac.get("extras", []) if e.get("key") in ("frequency", "frequencia", "Periodicidade")), None),
        "notas": (pac.get("notes") or "").strip()[:4000],
        "url": url_dataset(orgao, pac.get("name")),
        "recursos": [{"id": r.get("id"), "nome": r.get("name"), "formato": r.get("format"), "url": r.get("url"),
                      "tamanho": r.get("size"), "last_modified": r.get("last_modified") or r.get("metadata_modified")}
                     for r in pac.get("resources", [])],
    }


def _normaliza_publicacao(v):
    """last_modified do CKAN vem sem fuso (UTC por convenção do CKAN): acrescenta Z."""
    if not v:
        return None
    v = str(v)
    if "T" in v and not (v.endswith("Z") or "+" in v[10:]):
        return v.split(".")[0] + "Z"
    return v


def _ultima_coleta_ok(con, dataset, recurso):
    row = con.execute(
        "SELECT MAX(tentado_em) FROM coletas WHERE dataset=? AND recurso=? AND ok=1", (dataset, recurso)
    ).fetchone()
    if not row or not row[0]:
        return None
    try:
        return datetime.fromisoformat(row[0].replace("Z", "+00:00"))
    except ValueError:
        return None


def baixar_recurso(con, *, orgao, dataset, recurso, url, publicado_em=None, ext="csv",
                   max_idade_dias=1, forcar=False, baixador=http_download, agora=None):
    """Baixa um recurso para o bronze e registra a vintage no silver `con`.

    Retorna dict {"status": "nova"|"identica"|"pulada"|"falha", "vintage": dict|None,
    "detalhe": str}. "pulada" = nada a fazer pela política de recoleta; nesse caso a
    vintage vigente é devolvida para o chamador reprocessar se quiser."""
    agora = agora or datetime.now(timezone.utc)
    publicado_em = _normaliza_publicacao(publicado_em)
    ultima = base.ultima_vintage(con, dataset, recurso)
    if ultima and not forcar:
        ok_em = _ultima_coleta_ok(con, dataset, recurso)
        mesma_publicacao = (publicado_em is None) or (ultima.get("publicado_em") == publicado_em)
        if ok_em and mesma_publicacao and agora - ok_em < timedelta(days=max_idade_dias):
            return {"status": "pulada", "vintage": ultima, "detalhe": "recurso inalterado e captura recente"}
    fd, tmp = tempfile.mkstemp(prefix="energia-", suffix="." + ext)
    os.close(fd)
    try:
        try:
            _, nbytes = baixador(url, tmp)
        except Exception as e:  # pane de rede ou da fonte: registrada, sem dado inventado
            base.registra_coleta(con, dataset, recurso, False, f"download: {e}")
            con.commit()
            return {"status": "falha", "vintage": ultima, "detalhe": str(e)[:300]}
        capturado = base.agora_utc()
        arquivo, sha, nbytes = base.salva_bronze_arquivo(orgao.lower(), dataset, recurso, tmp, ext, capturado)
        if ultima and ultima["sha256"] == sha:
            base.registra_coleta(con, dataset, recurso, True, f"{nbytes} bytes, idêntico à vintage {ultima['vintage_id']}")
            con.commit()
            return {"status": "identica", "vintage": ultima, "detalhe": "sem mudança"}
        vid, _ = base.registra_vintage(con, dataset, recurso, url, capturado, publicado_em, sha, nbytes,
                                       "coleta_direta", arquivo)
        base.registra_coleta(con, dataset, recurso, True, f"{nbytes} bytes, vintage nova")
        con.commit()
        return {"status": "nova", "vintage": base.ultima_vintage(con, dataset, recurso), "detalhe": f"{nbytes} bytes"}
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass


def detecta_encoding(amostra):
    """UTF-8 (com ou sem BOM) ou Latin-1 (comum na ANEEL)."""
    try:
        amostra.decode("utf-8")
        return "utf-8-sig"
    except UnicodeDecodeError as e:
        # corte no meio de um caractere multibyte no fim da amostra não é Latin-1
        if e.start >= len(amostra) - 3:
            return "utf-8-sig"
        return "latin-1"


def detecta_separador(linha):
    contagens = {s: linha.count(s) for s in (";", ",", "\t", "|")}
    return max(contagens, key=contagens.get)


def le_csv_bronze(caminho_relativo, encoding=None, separador=None, membro_zip=None):
    """Itera as linhas de um CSV do bronze como dicts (cabeçalho sem BOM e aparado).
    Aceita CSV puro, gzip ou zip (membro_zip: nome ou None para o primeiro .csv)."""
    bruto = base.abre_bronze(caminho_relativo)
    if membro_zip is not None or caminho_relativo.endswith(".zip.gz") or caminho_relativo.endswith(".zip"):
        dados = bruto.read()
        bruto.close()
        z = zipfile.ZipFile(io.BytesIO(dados))
        nome = membro_zip or next(n for n in z.namelist() if n.lower().endswith(".csv"))
        bruto = z.open(nome)
    amostra = bruto.peek(65536) if hasattr(bruto, "peek") else b""
    enc = encoding or detecta_encoding(amostra[:65536])
    texto = io.TextIOWrapper(bruto, encoding=enc, errors="replace", newline="")
    primeira = texto.readline()
    sep = separador or detecta_separador(primeira)
    cab = [c.strip().lstrip("﻿").strip('"') for c in next(csv.reader([primeira], delimiter=sep))]
    for row in csv.reader(texto, delimiter=sep):
        if row:
            yield dict(zip(cab, row))
    texto.close()


def numero_br(s):
    """'1.234,56' ou '1234.56' ou '' → float|None (vazio é ausência, nunca zero)."""
    if s is None:
        return None
    s = str(s).strip().strip('"')
    if not s or s.upper() in ("NA", "N/A", "NULL", "-", "NAN"):
        return None
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".") if s.rfind(",") > s.rfind(".") else s.replace(",", "")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def coleta_pacote(con, *, orgao, nome, dataset, filtro_recurso, ext_de=None, max_idade_dias=1,
                  baixar_meta=http_get, baixador=http_download, pausa_s=0.5):
    """Coleta todos os recursos de um conjunto CKAN que passam em `filtro_recurso(r)`.

    Retorna (status, metadados, vintages) em que vintages = {recurso: vintage vigente}
    inclui os recursos pulados pela política de recoleta (o chamador reprocessa a vintage
    vigente quando precisa reconstruir o silver derivado)."""
    status = {"dataset": dataset, "orgao": orgao, "conjunto": nome, "ok": True, "novas": 0,
              "identicas": 0, "puladas": 0, "falhas": []}
    try:
        pac = pacote(orgao, nome, baixar=baixar_meta)
    except Exception as e:
        base.registra_coleta(con, dataset, "*", False, f"package_show: {e}")
        con.commit()
        status.update(ok=False, falhas=[f"package_show: {e}"])
        return status, None, {}
    meta = metadados(pac, orgao)
    base.escreve_gold(f"_meta_{dataset}.json", meta, destino=os.path.join(base.DADOS, "meta"))
    vintages = {}
    for r in pac.get("resources", []):
        if not filtro_recurso(r):
            continue
        url = r.get("url") or ""
        recurso = (r.get("name") or url.rsplit("/", 1)[-1] or r.get("id")).strip()
        ext = (ext_de(r) if ext_de else (r.get("format") or url.rsplit(".", 1)[-1] or "bin")).lower()
        res = baixar_recurso(con, orgao=orgao, dataset=dataset, recurso=recurso, url=url,
                             publicado_em=r.get("last_modified") or r.get("metadata_modified"), ext=ext,
                             max_idade_dias=max_idade_dias, baixador=baixador)
        chave = {"nova": "novas", "identica": "identicas", "pulada": "puladas"}.get(res["status"])
        if chave:
            status[chave] += 1
        else:
            status["falhas"].append(f"{recurso}: {res['detalhe']}")
        if res["vintage"]:
            vintages[recurso] = res["vintage"]
        if res["status"] in ("nova", "identica") and pausa_s:
            time.sleep(pausa_s)  # respeito ao portal entre downloads
    status["ok"] = not status["falhas"]
    return status, meta, vintages


def vintages_vigentes(con, dataset):
    """{recurso: vintage mais recente} a partir do silver (sem rede)."""
    out = {}
    for v in base.vintages_do_dataset(con, dataset):
        out[v["recurso"]] = v
    return out


def meta_local(dataset):
    """Metadados CKAN guardados na última coleta (para reconstruir a gold sem rede)."""
    return base.le_gold(f"_meta_{dataset}.json", destino=os.path.join(base.DADOS, "meta")) or {}
