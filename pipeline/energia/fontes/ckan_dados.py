"""Catálogos dos portais e verificação de recursos para o módulo Dados (P067 e P068).

Por que existe: "catalogado" e "recurso verificado" são estados diferentes. Um conjunto
listado num portal só está catalogado; o recurso (o arquivo) está verificado quando o
pipeline o acessou de fato e leu o seu formato e cabeçalho. Este arquivo:

1. colhe a listagem completa de conjuntos dos portais CKAN do ONS e da ANEEL
   (package_search), guarda a resposta no bronze com sha256, registra a captura como
   vintage no silver da família `publicacao` e grava cada conjunto e cada recurso como
   registro com histórico: mudança de data de publicação, recurso que some do portal
   (descontinuado ou renomeado) e frequência declarada ficam rastreáveis por data;
2. tenta a listagem da CCEE com o mesmo agente identificado do projeto. O portal da
   CCEE responde 403 ("Acesso bloqueado") a este ambiente: a falha é registrada e o
   catálogo da CCEE usa os package_show versionados com sha256 em
   pipeline/energia/seed (PLD_HORARIO e os três conjuntos do mercado de curto prazo),
   recurso a recurso. Nada é contornado;
3. verifica um recurso de cada conjunto ainda não integrado: GET com Range dos
   primeiros 64 KB, status HTTP, tamanho, tipo, assinatura do formato e, em CSV, o
   cabeçalho real. Reverificação semanal ou quando a fonte muda o recurso;
4. lê a frequência declarada pelas fontes fora dos dois portais (metadados do SIDRA
   do IBGE, que também informam o último período publicado, e package_show dos portais
   CKAN da CVM e do MME), para o SLA de atualidade.

Falha de rede nunca vira dado: é registrada em `coletas` e o resultado anterior fica.
"""
import gzip
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.common import USER_AGENT, http_get  # noqa: E402
from pipeline.energia import base  # noqa: E402

CATALOGOS = {
    "ONS": {"url": "https://dados.ons.org.br/api/3/action/package_search?rows=1000",
            "portal": "https://dados.ons.org.br", "dataset": "catalogo_ckan_ons"},
    "ANEEL": {"url": "https://dadosabertos.aneel.gov.br/api/3/action/package_search?rows=1000",
              "portal": "https://dadosabertos.aneel.gov.br", "dataset": "catalogo_ckan_aneel"},
    "CCEE": {"url": "https://dadosabertos.ccee.org.br/api/3/action/package_search?rows=1000",
             "portal": "https://dadosabertos.ccee.org.br", "dataset": "catalogo_ckan_ccee"},
}
DS_RECURSOS = {o: f"{c['dataset']}_recursos" for o, c in CATALOGOS.items()}
DS_SEED_CCEE = "catalogo_ccee_seed"
DS_VERIFICACAO = "verificacao_recursos"
DS_METADADOS = "metadados_fontes"
META = os.path.join(base.DADOS, "meta")
SEEDS_CCEE = (
    ("ccee_pld_horario", "package_show.json"),
    ("ccee_documentos", "package_show_pld_horario_submercado.json"),
    ("ccee_documentos", "package_show_sumario_be_horario_submercado.json"),
    ("ccee_documentos", "package_show_sumario_mensal_compra_venda_submercado.json"),
)
# Reverificação de um recurso já verificado: semanal (catálogos mudam devagar; o
# portal não precisa de 160 requisições por dia), ou antes se a fonte mudou o recurso.
MAX_IDADE_VERIFICACAO_DIAS = 7
BYTES_VERIFICACAO = 65536
FORMATOS_TABULARES = ("CSV", "PARQUET", "XLSX", "XLS", "JSON", "ZIP", "TXT", "XML")
ASSINATURAS = ((b"PAR1", "PARQUET"), (b"PK\x03\x04", "ZIP/XLSX"), (b"%PDF", "PDF"), (b"\xd0\xcf\x11\xe0", "XLS"),
               (b"\x1f\x8b", "GZIP"))


def agora():
    return base.agora_utc()


# ---------------------------------------------------------------- extras declarados


_CHAVES_FREQ = re.compile(r"(frequ|schedule|periodicidade)", re.I)


def extras(pkg):
    """Extras do CKAN normalizados: frequência declarada (texto da fonte e o nome do
    campo onde está), referência de publicação, situação, cobertura e granularidade."""
    out = {"frequencia_declarada": None, "campo_frequencia": None, "referencia_publicacao": None,
           "situacao": None, "cobertura_temporal": None, "granularidade_temporal": None}
    for e in pkg.get("extras") or []:
        k, v = (e.get("key") or "").strip(), (e.get("value") or "").strip()
        kl = k.lower()
        if _CHAVES_FREQ.search(k) and out["frequencia_declarada"] is None:
            out["frequencia_declarada"], out["campo_frequencia"] = v, k
        elif "referência de publica" in kl or "referencia de publica" in kl:
            out["referencia_publicacao"] = v
        elif kl.startswith("situa"):
            out["situacao"] = v
        elif kl.startswith("cobertura temporal"):
            out["cobertura_temporal"] = v
        elif kl.startswith("granularidade temporal"):
            out["granularidade_temporal"] = v
    return out


_CANON = (("diaria", re.compile(r"di[aá]ri|todos os dias|15 em 15 min|hor[aá]ri", re.I)),
          ("semanal", re.compile(r"semana", re.I)),
          ("quinzenal", re.compile(r"quinzena", re.I)),
          ("mensal", re.compile(r"mensal|ms\+", re.I)),
          ("trimestral", re.compile(r"trimestr", re.I)),
          ("anual", re.compile(r"anual", re.I)))
_SEM_SLA = re.compile(r"sob demanda|conforme|sem atualiza|eventual|irregular|[úu]nica|n[ãa]o aplic", re.I)


def frequencias_canonicas(*textos):
    """Cadências declaradas em texto livre ('Diariamento, as 12h e 19h', 'Mensal e
    diária', 'MS+22du'), na ordem diária → anual. Lista vazia + `sem_sla` quando a
    fonte declara atualização sem cadência (sob demanda, conforme processo)."""
    achadas, sem_sla = [], False
    for t in textos:
        if not t:
            continue
        if _SEM_SLA.search(t):
            sem_sla = True
        for nome, rx in _CANON:
            if rx.search(t) and nome not in achadas:
                achadas.append(nome)
    ordem = [n for n, _ in _CANON]
    return sorted(achadas, key=ordem.index), sem_sla


def descontinuacao(pkg, ex=None):
    """Motivo e evidência de descontinuação declarada pela fonte, ou None."""
    ex = ex or extras(pkg)
    titulo = pkg.get("title") or ""
    nome = pkg.get("name") or ""
    if (ex.get("situacao") or "").lower().startswith("descontinuad"):
        return {"motivo": "situação declarada pela fonte", "evidencia": f"campo 'Situação' = {ex['situacao']!r}"}
    if "descontinuad" in titulo.lower() or "descontinuad" in nome.lower():
        return {"motivo": "título ou nome do conjunto", "evidencia": f"título {titulo!r}, nome {nome!r}"}
    if re.search(r"sem atualiza", ex.get("frequencia_declarada") or "", re.I):
        return {"motivo": "frequência declarada", "evidencia": f"{ex['campo_frequencia']} = {ex['frequencia_declarada']!r}"}
    return None


# ---------------------------------------------------------------- catálogo CKAN


def _baixa_listagem(orgao, baixar):
    corpo, _ = baixar(CATALOGOS[orgao]["url"], timeout=120, retries=2)
    dado = json.loads(corpo.decode("utf-8"))
    if not dado.get("success"):
        raise RuntimeError("package_search: success=false")
    return corpo, dado["result"]["results"]


def colhe_catalogo(con, orgao, *, baixar=http_get):
    """Baixa a listagem do portal, guarda no bronze, registra a vintage e grava os
    registros de conjuntos e recursos. Retorna (status, pacotes|None)."""
    cfg = CATALOGOS[orgao]
    ds = cfg["dataset"]
    try:
        corpo, pacotes = _baixa_listagem(orgao, baixar)
    except Exception as e:  # 403 da CCEE, pane do portal: registrado, sem dado inventado
        base.registra_coleta(con, ds, "package_search", False, _descreve_erro(e))
        con.commit()
        return {"orgao": orgao, "ok": False, "erro": _descreve_erro(e)}, None
    cap = agora()
    arquivo, sha = base.salva_bronze(orgao.lower(), ds, "package_search", corpo, "json", cap)
    vid, nova = base.registra_vintage(con, ds, "package_search", cfg["url"], cap, None, sha, len(corpo),
                                      "coleta_direta", arquivo)
    base.registra_coleta(con, ds, "package_search", True,
                         f"{len(corpo)} bytes, {len(pacotes)} conjuntos, {'vintage nova' if nova else 'idêntico à vintage vigente'}")
    reg = registra_pacotes(con, orgao, vid, pacotes) if nova else {"conjuntos": len(pacotes)}
    base.escreve_gold(f"_ckan_{orgao}.json", {"colhido_em": cap, "resultado": pacotes, "sha256": sha, "vintage": vid},
                      destino=META)
    con.commit()
    return {"orgao": orgao, "ok": True, "conjuntos": len(pacotes), "vintage_nova": nova, **reg}, pacotes


def _descreve_erro(e):
    if isinstance(e, urllib.error.HTTPError):
        corpo = b""
        try:
            corpo = e.read()[:4000]
        except Exception:
            pass
        titulo = re.search(rb"<title>(.*?)</title>", corpo or b"", re.I | re.S)
        t = titulo.group(1).decode("utf-8", "replace").strip() if titulo else ""
        return f"HTTP {e.code}{': ' + t if t else ''}"
    return f"{type(e).__name__}: {e}"[:300]


def registra_pacotes(con, orgao, vintage_id, pacotes, listagem_completa=True):
    """Conjuntos e recursos como registros com histórico. Recurso que deixa de aparecer
    na listagem ganha presente=0 (descontinuado ou renomeado pela fonte). Com
    `listagem_completa=False` (package_show avulso, como os da CCEE no seed), só os
    recursos dos conjuntos presentes na chamada são comparados, e nenhum conjunto é
    dado como sumido."""
    ds = CATALOGOS[orgao]["dataset"] if orgao in CATALOGOS else DS_SEED_CCEE
    ds_rec = DS_RECURSOS.get(orgao, DS_SEED_CCEE + "_recursos")
    linhas, linhas_rec = [], []
    vistos = set()
    for p in pacotes:
        ex = extras(p)
        nome = p.get("name")
        desc = descontinuacao(p, ex)
        for campo, valor in (("titulo", p.get("title")), ("modificado", p.get("metadata_modified")),
                             ("n_recursos", p.get("num_resources") or len(p.get("resources") or [])),
                             ("licenca", p.get("license_title") or p.get("license_id")), ("estado_ckan", p.get("state")),
                             ("frequencia_declarada", ex["frequencia_declarada"]), ("campo_frequencia", ex["campo_frequencia"]),
                             ("referencia_publicacao", ex["referencia_publicacao"]), ("situacao", ex["situacao"]),
                             ("cobertura_temporal", ex["cobertura_temporal"]),
                             ("descontinuado", "1" if desc else "0"), ("presente", "1")):
            linhas.append((nome, campo, valor))
        for r in p.get("resources") or []:
            ch = f"{nome}/{r.get('id')}"
            vistos.add(ch)
            for campo, valor in (("nome", r.get("name")), ("formato", (r.get("format") or "").upper() or None),
                                 ("url", r.get("url")), ("last_modified", r.get("last_modified") or r.get("metadata_modified")),
                                 ("tamanho", r.get("size")), ("presente", "1")):
                linhas_rec.append((ch, campo, valor))
    # recursos e conjuntos que sumiram da listagem desde a captura anterior
    nomes = {p.get("name") for p in pacotes}
    antes_rec = base.registros_como_estavam_em(con, ds_rec)
    for ch, campos in antes_rec.items():
        if ch in vistos or campos.get("presente") != "1":
            continue
        if listagem_completa or ch.split("/", 1)[0] in nomes:
            linhas_rec.append((ch, "presente", "0"))
    sumidos = 0
    if listagem_completa:
        antes = base.registros_como_estavam_em(con, ds)
        for nome, campos in antes.items():
            if nome not in nomes and campos.get("presente") == "1":
                linhas.append((nome, "presente", "0"))
                sumidos += 1
    n1, r1 = base.grava_registros(con, ds, vintage_id, linhas)
    n2, r2 = base.grava_registros(con, ds_rec, vintage_id, linhas_rec)
    return {"registros_novos": n1 + n2, "revisoes": r1 + r2, "conjuntos_sumidos": sumidos}


def cache_catalogo(orgao):
    """Última listagem guardada em data/energia/meta (para construir sem rede)."""
    return base.le_gold(f"_ckan_{orgao}.json", destino=META)


def importa_seed_ccee(con):
    """package_show da CCEE versionados no repositório (sha256 conferido com o
    MANIFESTO). Registra cada arquivo como vintage de origem `seed` e os conjuntos e
    recursos como registros. Retorna (status, pacotes)."""
    pacotes, status = [], []
    for pasta, arquivo in SEEDS_CCEE:
        raiz = os.path.join(base.SEED, pasta)
        if not os.path.isdir(raiz):
            continue
        for versao in sorted(os.listdir(raiz)):
            caminho = os.path.join(raiz, versao, arquivo)
            if not os.path.exists(caminho):
                continue
            manifesto = json.load(open(os.path.join(raiz, versao, "MANIFESTO.json"), encoding="utf-8"))
            corpo = open(caminho, "rb").read()
            sha = base.sha256_bytes(corpo)
            declarado = _sha_no_manifesto(manifesto, arquivo)
            if declarado and declarado != sha:
                base.registra_coleta(con, DS_SEED_CCEE, arquivo, False, "seed com sha256 divergente do MANIFESTO")
                status.append({"arquivo": arquivo, "ok": False})
                continue
            pkg = json.loads(corpo.decode("utf-8"))["result"]
            cap = manifesto.get("capturado_em") or versao[1:].replace("T", "")
            cap = _instante_da_versao(versao) if not str(cap).endswith("Z") else cap
            rel = os.path.relpath(caminho, base.RAIZ)
            vid, nova = base.registra_vintage(con, DS_SEED_CCEE, arquivo, _url_do_seed(manifesto, arquivo, pkg), cap, None,
                                              sha, len(corpo), "seed", rel)
            if nova:
                registra_pacotes(con, "CCEE_SEED", vid, [pkg], listagem_completa=False)
            pacotes.append({**pkg, "_seed": {"arquivo": rel, "sha256": sha, "capturado_em": cap, "sha256_no_manifesto": declarado}})
            status.append({"arquivo": arquivo, "ok": True, "vintage_nova": nova})
    con.commit()
    return status, pacotes


def _sha_no_manifesto(manifesto, arquivo):
    for a in manifesto.get("arquivos") or []:
        if a.get("arquivo") == arquivo:
            return a.get("sha256")
    if arquivo == "package_show.json":
        return manifesto.get("package_show_sha256") or (manifesto.get("package_show") or {}).get("sha256")
    return None


def _url_do_seed(manifesto, arquivo, pkg):
    for a in manifesto.get("arquivos") or []:
        if a.get("arquivo") == arquivo and a.get("url"):
            return a["url"]
    return f"https://dadosabertos.ccee.org.br/api/3/action/package_show?id={pkg.get('name')}"


def _instante_da_versao(versao):
    """'v20260927T154402Z' → '2026-09-27T15:44:02Z'."""
    m = re.match(r"v(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z", versao)
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}T{m.group(4)}:{m.group(5)}:{m.group(6)}Z" if m else None


# ---------------------------------------------------------------- verificação de recursos


def escolhe_recurso(pkg):
    """Recurso a verificar: o tabular publicado mais recentemente (CSV antes dos demais,
    porque o cabeçalho é legível nos primeiros bytes)."""
    cand = []
    for r in pkg.get("resources") or []:
        fmt = (r.get("format") or "").upper()
        if fmt not in FORMATOS_TABULARES or not r.get("url"):
            continue
        cand.append(((r.get("last_modified") or r.get("metadata_modified") or ""), fmt == "CSV", r))
    if not cand:
        return None
    # mesmo dia de publicação: o CSV primeiro (o ONS publica CSV, XLSX e Parquet do mesmo
    # ano com segundos de diferença)
    cand.sort(key=lambda x: (x[0][:10], x[1], x[0]), reverse=True)
    return cand[0][2]


def _range_get(url, nbytes=BYTES_VERIFICACAO, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*",
                                               "Range": f"bytes=0-{nbytes - 1}"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        corpo = resp.read(nbytes)
        return resp.status, dict(resp.headers.items()), corpo


def verifica_url(url, abrir=_range_get):
    """Acesso real a um recurso: status, tamanho total, tipo, assinatura e cabeçalho."""
    t0 = time.time()
    try:
        status, cab, corpo = abrir(url)
    except Exception as e:
        return {"resultado": "falha", "detalhe": _descreve_erro(e), "url": url, "verificado_em": agora()}
    total = None
    cr = cab.get("Content-Range") or cab.get("content-range")
    if cr and "/" in cr:
        try:
            total = int(cr.rsplit("/", 1)[1])
        except ValueError:
            total = None
    if total is None:
        cl = cab.get("Content-Length") or cab.get("content-length")
        total = int(cl) if cl and cl.isdigit() and status == 200 else None
    formato, colunas = detecta_formato(corpo)
    return {"resultado": "ok", "url": url, "http_status": status, "bytes_total": total,
            "tipo_conteudo": cab.get("Content-Type") or cab.get("content-type"),
            "last_modified_http": cab.get("Last-Modified") or cab.get("last-modified"),
            "formato_detectado": formato, "cabecalho": colunas, "bytes_lidos": len(corpo),
            "duracao_s": round(time.time() - t0, 2), "verificado_em": agora()}


def detecta_formato(corpo):
    """Formato pela assinatura dos primeiros bytes; em texto, o cabeçalho CSV."""
    if corpo[:2] == b"\x1f\x8b":
        try:
            corpo = gzip.decompress(corpo)
        except Exception:
            return "GZIP", None
    for sig, nome in ASSINATURAS:
        if corpo.startswith(sig):
            return nome, None
    try:
        texto = corpo.decode("utf-8")
    except UnicodeDecodeError:
        texto = corpo.decode("latin-1")
    t = texto.lstrip("﻿").lstrip()
    if t.startswith("{") or t.startswith("["):
        return "JSON", None
    if t.startswith("<"):
        return "XML/HTML", None
    linhas = t.splitlines()
    if not linhas:
        return "VAZIO", None
    sep = max((";", ",", "\t", "|"), key=linhas[0].count)
    if linhas[0].count(sep) == 0:
        return "TEXTO", None
    return "CSV", [c.strip().strip('"').strip() for c in linhas[0].split(sep)]


# Requisições de verificação por portal (host) numa execução: a primeira rodada cobre o
# catálogo em poucos dias, sem rajada de centenas de pedidos ao mesmo servidor.
LIMITE_POR_HOST = 80


def verifica_recursos(con, alvos, *, abrir=_range_get, max_idade_dias=MAX_IDADE_VERIFICACAO_DIAS, pausa_s=0.3,
                      limite=None, limite_por_host=LIMITE_POR_HOST):
    """Verifica os recursos de `alvos` = [(chave, recurso_dict_ou_url, contexto)] pela
    política de reverificação e grava o resultado como registros (histórico por chave).
    O conjunto de resultados da rodada vira uma vintage (JSON no bronze, com sha256)."""
    vigentes = base.registros_como_estavam_em(con, DS_VERIFICACAO)
    agora_dt = datetime.now(timezone.utc)
    resultados = []
    feitos = 0
    por_host = {}
    # nunca verificados primeiro, depois os de verificação mais antiga
    alvos = sorted(alvos, key=lambda a: (vigentes.get(a[0]) or {}).get("verificado_em") or "")
    for chave, rec, ctx in alvos:
        url = rec.get("url") if isinstance(rec, dict) else rec
        lm = (rec.get("last_modified") or rec.get("metadata_modified")) if isinstance(rec, dict) else None
        ant = vigentes.get(chave) or {}
        quando = ant.get("verificado_em")
        recente = False
        if quando:
            try:
                recente = agora_dt - datetime.fromisoformat(quando.replace("Z", "+00:00")) < timedelta(days=max_idade_dias)
            except ValueError:
                recente = False
        mesmo = ant.get("url") == url and (lm is None or ant.get("last_modified_fonte") == lm)
        if recente and mesmo and ant.get("resultado") == "ok":
            continue
        if limite is not None and feitos >= limite:
            break
        host = re.sub(r"^https?://([^/]+).*$", r"\1", url or "")
        if por_host.get(host, 0) >= limite_por_host:
            continue
        por_host[host] = por_host.get(host, 0) + 1
        r = verifica_url(url, abrir=abrir)
        feitos += 1
        r.update({"chave": chave, "recurso": (rec.get("name") if isinstance(rec, dict) else None),
                  "recurso_id": (rec.get("id") if isinstance(rec, dict) else None),
                  "formato_declarado": ((rec.get("format") or "").upper() if isinstance(rec, dict) else None),
                  "last_modified_fonte": lm, **(ctx or {})})
        resultados.append(r)
        if pausa_s:
            time.sleep(pausa_s)
    if not resultados:
        return {"verificados": 0, "falhas": 0, "pulados_por_politica": len(alvos)}
    corpo = json.dumps(resultados, ensure_ascii=False, sort_keys=True).encode("utf-8")
    cap = agora()
    arquivo, sha = base.salva_bronze("publicacao", DS_VERIFICACAO, "rodada", corpo, "json", cap)
    vid, _ = base.registra_vintage(con, DS_VERIFICACAO, "rodada", None, cap, None, sha, len(corpo), "coleta_direta", arquivo)
    linhas = []
    for r in resultados:
        cab = r.get("cabecalho")
        for campo in ("url", "recurso", "recurso_id", "formato_declarado", "formato_detectado", "http_status", "bytes_total",
                      "tipo_conteudo", "last_modified_http", "last_modified_fonte", "resultado", "detalhe", "verificado_em",
                      "orgao", "conjunto", "tipo"):
            linhas.append((r["chave"], campo, r.get(campo)))
        linhas.append((r["chave"], "cabecalho", " | ".join(cab) if cab else None))
    base.grava_registros(con, DS_VERIFICACAO, vid, linhas)
    falhas = sum(1 for r in resultados if r["resultado"] != "ok")
    base.registra_coleta(con, DS_VERIFICACAO, "rodada", True, f"{len(resultados)} recursos verificados, {falhas} com falha")
    con.commit()
    return {"verificados": len(resultados), "falhas": falhas, "pulados_por_politica": len(alvos) - len(resultados)}


# ---------------------------------------------------------------- frequência fora dos portais


_SIDRA = re.compile(r"(?:sidra-|/tabela/|/t/)(\d{3,5})")


def url_metadados(orgao, nome, url):
    """Endereço de metadados que declara a frequência de uma fonte fora dos portais do
    ONS e da ANEEL, ou None quando a fonte não publica essa declaração."""
    m = _SIDRA.search(f"{nome or ''} {url or ''}")
    if orgao == "IBGE" and m:
        return "sidra", f"https://servicodados.ibge.gov.br/api/v3/agregados/{m.group(1)}/metadados"
    mm = re.match(r"(https://[^/]+)/dataset/([^/?#]+)", url or "")
    if mm and orgao in ("CVM", "MME"):
        return "ckan", f"{mm.group(1)}/api/3/action/package_show?id={mm.group(2)}"
    return None, None


def colhe_metadados_fontes(con, integracoes, *, baixar=http_get, pausa_s=0.3):
    """Metadados de frequência das fontes externas integradas: registros por
    `orgao:nome` com frequência declarada, campo de origem, último período (SIDRA) e
    data de modificação (CKAN). Uma vintage por rodada com o conjunto de respostas."""
    feitos, falhas, resultados = 0, 0, []
    vistos = set()
    for it in integracoes:
        chave = f"{it['orgao']}:{it['nome']}"
        if chave in vistos:
            continue
        vistos.add(chave)
        tipo, url = url_metadados(it["orgao"], it["nome"], it.get("url"))
        if not url:
            continue
        try:
            corpo, _ = baixar(url, timeout=60, retries=2)
            dado = json.loads(corpo.decode("utf-8"))
        except Exception as e:
            base.registra_coleta(con, DS_METADADOS, chave, False, _descreve_erro(e))
            falhas += 1
            continue
        feitos += 1
        r = {"chave": chave, "url_metadados": url, "tipo": tipo, "verificado_em": agora()}
        if tipo == "sidra":
            per = dado.get("periodicidade") or {}
            r.update({"frequencia_declarada": per.get("frequencia"), "campo_frequencia": "periodicidade.frequencia",
                      "ultimo_periodo_fonte": str(per.get("fim")) if per.get("fim") else None,
                      "primeiro_periodo_fonte": str(per.get("inicio")) if per.get("inicio") else None,
                      "titulo_fonte": dado.get("nome")})
        else:
            pkg = dado.get("result") or {}
            ex = extras(pkg)
            r.update({"frequencia_declarada": ex["frequencia_declarada"], "campo_frequencia": ex["campo_frequencia"],
                      "modificado_fonte": pkg.get("metadata_modified"), "licenca_fonte": pkg.get("license_title"),
                      "titulo_fonte": pkg.get("title")})
        resultados.append(r)
        if pausa_s:
            time.sleep(pausa_s)
    if resultados:
        corpo = json.dumps(resultados, ensure_ascii=False, sort_keys=True).encode("utf-8")
        cap = agora()
        arquivo, sha = base.salva_bronze("publicacao", DS_METADADOS, "rodada", corpo, "json", cap)
        vid, _ = base.registra_vintage(con, DS_METADADOS, "rodada", None, cap, None, sha, len(corpo), "coleta_direta", arquivo)
        linhas = [(r["chave"], k, v) for r in resultados for k, v in r.items() if k != "chave"]
        base.grava_registros(con, DS_METADADOS, vid, linhas)
        base.registra_coleta(con, DS_METADADOS, "rodada", True, f"{feitos} fontes, {falhas} falhas")
    con.commit()
    return {"consultadas": feitos, "falhas": falhas}
