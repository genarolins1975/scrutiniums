"""Coletor ONS: portal de dados abertos (CKAN) e arquivos CSV anuais no S3 do ONS.

Cada arquivo baixado vira uma vintage (sha256, capturado_em, last_modified do
recurso CKAN como publicado_em) e suas linhas entram no silver por vintage.
Horários do ONS são locais (Brasília); desde 2019 não há horário de verão,
então a hora local equivale a UTC-3 em todo o período integrado.
"""
import csv
import io
import json
import sys
import os
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.common import http_get  # noqa: E402
from pipeline.energia import base  # noqa: E402

CKAN = "https://dados.ons.org.br/api/3/action/package_show?id="

# Canonização dos submercados: o ONS usa SE para Sudeste/Centro-Oeste.
SUBMERCADOS = ("SE", "S", "NE", "N")

# Fronteiras monitoradas no conjunto "Intercâmbios entre subsistemas", na
# orientação canônica (valor positivo = fluxo da primeira para a segunda ponta).
FRONTEIRAS = (("N", "NE"), ("N", "SE"), ("NE", "SE"), ("S", "SE"))


def _num(s):
    s = (s or "").strip()
    if not s:
        return None
    try:
        return float(s.replace(",", "."))
    except ValueError:
        return None


def _sm(s):
    return (s or "").strip().upper()


def _linhas(texto):
    leitor = csv.reader(io.StringIO(texto), delimiter=";")
    cab = [c.strip().lstrip("﻿") for c in next(leitor)]
    for row in leitor:
        if row:
            yield dict(zip(cab, row))


def parse_ear(texto):
    for r in _linhas(texto):
        sm, ref = _sm(r["id_subsistema"]), r["ear_data"].strip()[:10]
        yield f"ear_pct.{sm}", ref, _num(r.get("ear_verif_subsistema_percentual"))
        yield f"ear_mwmes.{sm}", ref, _num(r.get("ear_verif_subsistema_mwmes"))
        yield f"ear_max_mwmes.{sm}", ref, _num(r.get("ear_max_subsistema"))


def parse_ena(texto):
    for r in _linhas(texto):
        sm, ref = _sm(r["id_subsistema"]), r["ena_data"].strip()[:10]
        yield f"ena_bruta_mwmed.{sm}", ref, _num(r.get("ena_bruta_regiao_mwmed"))
        yield f"ena_bruta_pct_mlt.{sm}", ref, _num(r.get("ena_bruta_regiao_percentualmlt"))
        yield f"ena_arm_mwmed.{sm}", ref, _num(r.get("ena_armazenavel_regiao_mwmed"))
        yield f"ena_arm_pct_mlt.{sm}", ref, _num(r.get("ena_armazenavel_regiao_percentualmlt"))


def parse_carga(texto):
    for r in _linhas(texto):
        sm, ref = _sm(r["id_subsistema"]), r["din_instante"].strip()[:10]
        yield f"carga_mwmed.{sm}", ref, _num(r.get("val_cargaenergiamwmed"))


def _hora(s):
    s = s.strip()
    return s[:10] + "T" + s[11:13] + ":00"


def parse_balanco(texto):
    campos = (("hidraulica", "val_gerhidraulica"), ("termica", "val_gertermica"),
              ("eolica", "val_gereolica"), ("solar", "val_gersolar"),
              ("carga", "val_carga"), ("intercambio", "val_intercambio"))
    for r in _linhas(texto):
        sm, ref = _sm(r["id_subsistema"]), _hora(r["din_instante"])
        for serie, col in campos:
            yield f"{serie}.{sm}", ref, _num(r.get(col))


def parse_intercambio(texto):
    """Soma com sinal por fronteira canônica e hora: o arquivo traz uma linha por
    par no sentido verificado do fluxo daquela hora."""
    acum = {}
    for r in _linhas(texto):
        a, b = _sm(r["id_subsistema_origem"]), _sm(r["id_subsistema_destino"])
        ref = _hora(r["din_instante"])
        if (a, b) in FRONTEIRAS:
            par, sinal = f"{a}_{b}", 1.0
        elif (b, a) in FRONTEIRAS:
            par, sinal = f"{b}_{a}", -1.0
        else:
            continue
        for serie, col in (("fluxo", "val_intercambiomwmed"), ("fluxo_prog", "val_intercambioprogmwmed")):
            v = _num(r.get(col))
            if v is None:
                continue
            k = (f"{serie}.{par}", ref)
            acum[k] = acum.get(k, 0.0) + sinal * v
    for (serie, ref), v in acum.items():
        yield serie, ref, v


def parse_cmo(texto):
    for r in _linhas(texto):
        sm, ref = _sm(r["id_subsistema"]), r["din_instante"].strip()[:10]
        yield f"cmo_semanal.{sm}", ref, _num(r.get("val_cmomediasemanal"))
        yield f"cmo_leve.{sm}", ref, _num(r.get("val_cmoleve"))
        yield f"cmo_media.{sm}", ref, _num(r.get("val_cmomedia"))
        yield f"cmo_pesada.{sm}", ref, _num(r.get("val_cmopesada"))


# dataset (diretório no S3 do ONS) → pacote CKAN, prefixo dos arquivos, ano inicial, parser
DATASETS = {
    "ear_subsistema_di": {"pacote": "ear-diario-por-subsistema", "prefixo": "EAR_DIARIO_SUBSISTEMA_",
                          "ano_inicial": 2000, "parser": parse_ear},
    "ena_subsistema_di": {"pacote": "ena-diario-por-subsistema", "prefixo": "ENA_DIARIO_SUBSISTEMA_",
                          "ano_inicial": 2000, "parser": parse_ena},
    "carga_energia_di": {"pacote": "carga-energia", "prefixo": "CARGA_ENERGIA_",
                         "ano_inicial": 2000, "parser": parse_carga},
    "balanco_energia_subsistema_ho": {"pacote": "balanco-energia-subsistema",
                                      "prefixo": "BALANCO_ENERGIA_SUBSISTEMA_",
                                      "ano_inicial": 2021, "parser": parse_balanco},
    "intercambio_nacional_ho": {"pacote": "intercambio-nacional", "prefixo": "INTERCAMBIO_NACIONAL_",
                                "ano_inicial": 2021, "parser": parse_intercambio},
    "cmo_se": {"pacote": "cmo-semanal", "prefixo": "CMO_SEMANAL_", "ano_inicial": 2005,
               "parser": parse_cmo},
}


def recursos_csv(pacote_json, prefixo):
    """{ano: {url, last_modified, id}} dos CSV anuais do pacote CKAN."""
    out = {}
    for r in pacote_json.get("resources", []):
        url = r.get("url") or ""
        if (r.get("format") or "").upper() != "CSV":
            continue
        nome = url.rsplit("/", 1)[-1]
        if not nome.startswith(prefixo) or not nome.endswith(".csv"):
            continue
        ano = nome[len(prefixo):-4]
        if ano.isdigit():
            out[int(ano)] = {"url": url, "last_modified": r.get("last_modified"), "id": r.get("id")}
    return out


def _precisa_recoletar(con, dataset, recurso, ano, hoje, dias=30, publicado_em=None):
    if ano >= hoje.year - 1:
        return True
    vintage = base.ultima_vintage(con, dataset, recurso)
    if not vintage or base.vintage_orfa(vintage):
        return True
    # Conteúdo idêntico conserva a vintage original. A janela de recoleta conta
    # desde a última tentativa bem-sucedida, não desde a primeira captura.
    row = con.execute(
        "SELECT tentado_em, detalhe FROM coletas WHERE dataset=? AND recurso=? AND ok=1 ORDER BY rowid DESC LIMIT 1",
        (dataset, recurso),
    ).fetchone()
    # O portal também pode alterar só o metadado, sem alterar os bytes. Guardar
    # a publicação conferida no log evita baixar diariamente sem redatar a vintage.
    publicacao_conferida = vintage.get("publicado_em")
    if row:
        try:
            detalhe = json.loads(row[1])
            if isinstance(detalhe, dict) and "publicado_em" in detalhe:
                publicacao_conferida = detalhe["publicado_em"]
        except (ValueError, TypeError):
            pass  # logs antigos eram texto livre
    if publicado_em and publicacao_conferida != publicado_em:
        return True
    try:
        ultima = datetime.fromisoformat((row[0] if row else vintage["capturado_em"]).replace("Z", "+00:00"))
    except ValueError:
        return True
    return hoje - ultima.date() >= timedelta(days=dias)


def coleta_dataset(con, dataset, hoje=None, baixar=http_get):
    """Coleta um dataset ONS. Retorna dict de status (nunca lança por falha de fonte)."""
    cfg = DATASETS[dataset]
    hoje = hoje or date.today()
    status = {"dataset": dataset, "ok": True, "arquivos": 0, "novas": 0, "revisoes": 0, "falhas": []}
    try:
        corpo, _ = baixar(CKAN + cfg["pacote"])
        resposta = json.loads(corpo.decode("utf-8"))
        if not resposta.get("success") or not isinstance(resposta.get("result"), dict):
            raise ValueError("package_show sem resultado válido")
        pacote = resposta["result"]
    except Exception as e:  # pane da API: registrada, sem dado inventado
        base.registra_coleta(con, dataset, "*", False, f"package_show: {e}")
        status.update(ok=False, falhas=[f"package_show: {e}"])
        return status
    recursos = recursos_csv(pacote, cfg["prefixo"])
    anos = sorted(a for a in recursos if a >= cfg["ano_inicial"])
    if not anos:
        motivo = "package_show sem CSV anual compatível"
        base.registra_coleta(con, dataset, "*", False, motivo)
        con.commit()
        status.update(ok=False, falhas=[motivo])
        return status
    for ano in anos:
        recurso = f"{cfg['prefixo']}{ano}"
        info = recursos[ano]
        if not _precisa_recoletar(con, dataset, recurso, ano, hoje, publicado_em=info.get("last_modified")):
            continue
        try:
            corpo, meta = baixar(info["url"], timeout=180, accept="*/*")
        except Exception as e:
            base.registra_coleta(con, dataset, recurso, False, str(e))
            status["falhas"].append(f"{recurso}: {e}")
            continue
        capturado = base.agora_utc()
        arquivo, sha = base.salva_bronze("ons", dataset, recurso, corpo, "csv", capturado)
        # Uma resposta HTTP 200 pode ser HTML, um CSV vazio ou um esquema alterado.
        # Falha de parsing não deixa vintage parcial nem interrompe outros recursos.
        con.execute("SAVEPOINT recurso_ons")
        try:
            texto = corpo.decode("utf-8-sig")
            linhas = list(cfg["parser"](texto))
            if not any(v is not None for _, _, v in linhas):
                raise ValueError("CSV sem observações numéricas")
            vid, _nova = base.registra_vintage(con, dataset, recurso, info["url"], capturado,
                                               info.get("last_modified"), sha, len(corpo), "coleta_direta", arquivo)
            novas, revs = base.grava_observacoes(con, dataset, vid, linhas)
        except Exception as e:
            con.execute("ROLLBACK TO SAVEPOINT recurso_ons")
            con.execute("RELEASE SAVEPOINT recurso_ons")
            base.registra_coleta(con, dataset, recurso, False, f"importação: {e}")
            con.commit()
            status["falhas"].append(f"{recurso}: importação: {e}")
            continue
        con.execute("RELEASE SAVEPOINT recurso_ons")
        base.registra_coleta(con, dataset, recurso, True, json.dumps({
            "bytes": len(corpo), "novas": novas, "revisoes": revs,
            "publicado_em": info.get("last_modified"),
        }))
        status["arquivos"] += 1
        status["novas"] += novas
        status["revisoes"] += revs
        con.commit()
    status["ok"] = not status["falhas"]
    status["metadados"] = {
        "titulo": pacote.get("title"),
        "licenca": pacote.get("license_title"),
        "licenca_url": pacote.get("license_url"),
        "modificado": pacote.get("metadata_modified"),
        "notas": (pacote.get("notes") or "").split("-----")[0].strip(),
        "url": f"https://dados.ons.org.br/dataset/{cfg['pacote']}",
    }
    base.escreve_gold(f"_meta_{dataset}.json", status["metadados"], destino=os.path.join(base.DADOS, "meta"))
    return status


def coleta(con, hoje=None):
    return [coleta_dataset(con, d, hoje=hoje) for d in DATASETS]
