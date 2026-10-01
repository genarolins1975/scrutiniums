"""Coletor dos conjuntos de mercado da CCEE (portal de dados abertos, CC-BY-4.0) para o módulo Mercado.

Situação de acesso: o portal (dadosabertos.ccee.org.br), o servidor de arquivos
(pda-download.ccee.org.br) e o site (www.ccee.org.br) respondem HTTP 403 com a página
"Acesso bloqueado" ao ambiente de construção (verificado em 28/09/2026 e de novo em
01/10/2026 00:11 UTC). O bloqueio é do firewall da origem e não é contornado: o coletor usa
o mesmo cliente HTTP do pipeline, sem trocar o User-Agent. O pipeline oficial roda no GitHub
Actions, de onde a coleta direta do PLD já funcionou (vintages "coleta_direta" de
ccee_pld_horario no silver principal); este coletor foi escrito para rodar lá.

Como o esquema dos conjuntos não pôde ser verificado deste ambiente, cada tema declara o
esquema esperado e o coletor falha fechado: arquivo cujo cabeçalho não traz exatamente as
colunas esperadas é guardado no bronze (com sha256, para conferência humana) e nenhum número
dele é publicado. Há dois tipos de tema:

* conjunto com esquema documentado pela própria CCEE nos metadados oficiais versionados em
  pipeline/energia/seed/ccee_documentos/ (package_show capturado em 28/09/2026):
  sumario_mensal_compra_venda_submercado, com as colunas MES_REFERENCIA, SUBMERCADO,
  BE_POSITIVO, BE_NEGATIVO (MWh), RESULTADO_MCP_VENDA e RESULTADO_MCP_COMPRA (R$). É a
  contabilização pública do mercado de curto prazo por submercado e mês (painel P035). Este
  tem leitor e é publicado quando o arquivo chega com o esquema documentado;
* temas sem esquema verificável daqui (consumo por classe e ambiente, agentes por categoria,
  MRE e GSF, encargos de serviços do sistema): o coletor procura os conjuntos pela busca do
  próprio portal (package_search, API CKAN pública), guarda os arquivos e registra o
  cabeçalho recebido, mas não publica número: o leitor de cada um só pode ser escrito depois
  que alguém confira as colunas reais contra o dicionário da CCEE. É a falha fechada.
"""
import csv
import io
import json
import os
import re
import sys
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.common import http_get  # noqa: E402
from pipeline.energia import base  # noqa: E402

PORTAL = "https://dadosabertos.ccee.org.br"
LICENCA = "Creative Commons Attribution 4.0 (CC-BY-4.0), conforme o portal de dados abertos da CCEE"
SEED_DOCS = os.path.join(base.SEED, "ccee_documentos")

# Esquema documentado (descrição dos recursos no package_show oficial versionado no seed).
COLUNAS_SUMARIO_MCP = ("MES_REFERENCIA", "SUBMERCADO", "BE_POSITIVO", "BE_NEGATIVO", "RESULTADO_MCP_VENDA",
                       "RESULTADO_MCP_COMPRA")
SUBMERCADOS = {"N": "N", "NE": "NE", "S": "S", "SE": "SE", "NORTE": "N", "NORDESTE": "NE", "SUL": "S",
               "SUDESTE": "SE", "SUDESTE/CENTRO-OESTE": "SE"}

TEMAS = [
    {"id": "contabilizacao_mcp", "painel": "P035", "dataset": "ccee_sumario_mcp_submercado",
     "titulo": "Balanço energético e resultado do MCP por submercado e mês",
     "conjunto": "sumario_mensal_compra_venda_submercado", "colunas": COLUNAS_SUMARIO_MCP,
     "esquema": "documentado nos metadados oficiais versionados (seed ccee_documentos, 28/09/2026)"},
    {"id": "consumo_classe_ambiente", "painel": "P032", "dataset": "ccee_consumo_ambiente",
     "titulo": "Consumo por classe e ambiente de contratação (ACL e ACR)", "busca": ["consumo"],
     "colunas": None, "esquema": "não verificável deste ambiente"},
    {"id": "agentes_categoria", "painel": "P033", "dataset": "ccee_agentes",
     "titulo": "Agentes e perfis por categoria (entradas e desligamentos)", "busca": ["agentes", "perfil"],
     "colunas": None, "esquema": "não verificável deste ambiente"},
    {"id": "mre_gsf", "painel": "P034", "dataset": "ccee_mre_gsf",
     "titulo": "MRE: garantia física, geração e fator de ajuste (GSF)", "busca": ["GSF", "MRE"],
     "colunas": None, "esquema": "não verificável deste ambiente"},
    {"id": "encargos_ess", "painel": "P035", "dataset": "ccee_encargos",
     "titulo": "Encargos de serviços do sistema (ESS) e de energia de reserva (EER)", "busca": ["encargo", "ESS"],
     "colunas": None, "esquema": "não verificável deste ambiente"},
]


def metadados_seed(conjunto):
    """package_show versionado no seed (o mais recente), ou None. Serve de documentação do
    esquema e da lista de recursos quando o portal não responde."""
    if not os.path.isdir(SEED_DOCS):
        return None
    for versao in sorted(os.listdir(SEED_DOCS), reverse=True):
        caminho = os.path.join(SEED_DOCS, versao, f"package_show_{conjunto}.json")
        if os.path.isfile(caminho):
            with open(caminho, encoding="utf-8") as f:
                return {"versao": versao, "result": json.load(f)["result"]}
    return None


def cabecalho_csv(corpo):
    """Colunas da primeira linha de um CSV da CCEE (';', aspas opcionais, BOM opcional)."""
    texto = corpo[:65536].decode("utf-8-sig", errors="replace")
    primeira = texto.splitlines()[0] if texto else ""
    return [c.strip().strip('"') for c in next(csv.reader([primeira], delimiter=";"))] if primeira else []


def esquema_confere(colunas_recebidas, esperadas):
    """True quando o cabeçalho traz exatamente as colunas esperadas (ordem livre)."""
    return esperadas is not None and sorted(colunas_recebidas) == sorted(esperadas)


def parse_sumario_mcp(texto):
    """Linhas (série, AAAA-MM, valor) do sumário mensal: 'mcp|<SM>|<campo>'. Valor vazio é
    ausência. MES_REFERENCIA vem como AAAAMM (padrão dos arquivos da CCEE)."""
    leitor = csv.reader(io.StringIO(texto), delimiter=";")
    cab = [c.strip().strip('"').lstrip("﻿") for c in next(leitor)]
    if not esquema_confere(cab, COLUNAS_SUMARIO_MCP):
        raise ValueError(f"esquema divergente: {cab}")
    idx = {c: i for i, c in enumerate(cab)}
    for row in leitor:
        if not row:
            continue
        g = lambda c: row[idx[c]].strip().strip('"')  # noqa: E731
        mes = re.sub(r"\D", "", g("MES_REFERENCIA"))
        sm = SUBMERCADOS.get(g("SUBMERCADO").upper())
        if len(mes) < 6 or sm is None:
            raise ValueError(f"linha fora do domínio: {row}")
        ref = f"{mes[:4]}-{mes[4:6]}"
        for campo in COLUNAS_SUMARIO_MCP[2:]:
            v = g(campo).replace(",", ".")
            if v:
                yield f"mcp|{sm}|{campo.lower()}", ref, float(v)


def _registra_falha(con, dataset, recurso, detalhe):
    base.registra_coleta(con, dataset, recurso, False, detalhe)
    con.commit()


def _baixa_recurso(con, tema, conjunto, r, baixar):
    """Baixa um recurso CSV, guarda no bronze com vintage e confere o esquema. Retorna o status."""
    nome = (r.get("name") or "").strip()
    if not re.fullmatch(r"[a-z0-9_\-]{3,80}", nome):
        return {"recurso": nome, "ok": False, "erro": "nome de recurso fora do padrão (não vira caminho no bronze)"}
    try:
        corpo, _ = baixar(r["url"], timeout=180, accept="*/*")
    except Exception as e:  # bloqueio ou pane: registrada, sem número
        _registra_falha(con, tema["dataset"], nome, f"download: {e}")
        return {"recurso": nome, "ok": False, "erro": f"download: {e}"[:300]}
    capturado = base.agora_utc()
    caminho, sha = base.salva_bronze("ccee", tema["dataset"], nome, corpo, "csv", capturado)
    vid, nova = base.registra_vintage(con, tema["dataset"], nome, r["url"], capturado, r.get("last_modified"), sha,
                                      len(corpo), "coleta_direta", caminho)
    colunas = cabecalho_csv(corpo)
    base.grava_registros(con, tema["dataset"], vid, [(f"recurso|{nome}", "colunas", json.dumps(colunas, ensure_ascii=False)),
                                                     (f"recurso|{nome}", "conjunto", conjunto)])
    out = {"recurso": nome, "ok": True, "bytes": len(corpo), "colunas": colunas, "vintage": vid}
    if tema.get("colunas") is None:
        out["publicavel"] = False
        out["motivo"] = "esquema não verificado: arquivo guardado para conferência, nenhum número publicado"
        base.registra_coleta(con, tema["dataset"], nome, True, f"{len(corpo)} bytes; esquema não verificado; colunas {colunas}"[:500])
    elif not esquema_confere(colunas, tema["colunas"]):
        out["publicavel"] = False
        out["motivo"] = f"esquema divergente do documentado: {colunas}"
        base.registra_coleta(con, tema["dataset"], nome, False, f"esquema divergente: {colunas}"[:500])
    else:
        out["publicavel"] = True
        if nova:
            n, rv = base.grava_observacoes(con, tema["dataset"], vid, parse_sumario_mcp(corpo.decode("utf-8-sig")))
            out.update(novas=n, revisoes=rv)
        base.registra_coleta(con, tema["dataset"], nome, True, f"{len(corpo)} bytes; esquema documentado conferido")
    con.commit()
    return out


def coleta(con, baixar=http_get, max_recursos=6):
    """Tenta cada tema. Nunca lança: falha vira registro em `coletas` e status no retorno."""
    status = {}
    for tema in TEMAS:
        st = {"tema": tema["id"], "ok": False, "conjuntos": [], "recursos": []}
        status[tema["id"]] = st
        if tema.get("conjunto"):
            nomes = [tema["conjunto"]]
        else:
            nomes = []
            for termo in tema["busca"]:
                url = f"{PORTAL}/api/3/action/package_search?rows=20&q={urllib.parse.quote(termo)}"
                try:
                    corpo, _ = baixar(url, timeout=60)
                    res = json.loads(corpo.decode("utf-8"))["result"]["results"]
                    nomes += [p["name"] for p in res if p.get("name") and p["name"] not in nomes]
                except Exception as e:
                    _registra_falha(con, tema["dataset"], "*", f"package_search {termo}: {e}")
                    st["erro"] = f"package_search: {e}"[:300]
                    st["url_tentada"] = url
            if not nomes:
                continue
        for nome in nomes[:5]:
            url = f"{PORTAL}/api/3/action/package_show?id={urllib.parse.quote(nome)}"
            try:
                corpo, _ = baixar(url, timeout=60)
                pac = json.loads(corpo.decode("utf-8"))["result"]
            except Exception as e:
                _registra_falha(con, tema["dataset"], "*", f"package_show {nome}: {e}")
                st["erro"] = f"package_show {nome}: {e}"[:300]
                st["url_tentada"] = url
                continue
            st["conjuntos"].append(nome)
            csvs = [r for r in pac.get("resources", []) if (r.get("format") or "").upper() == "CSV"]
            for r in sorted(csvs, key=lambda r: r.get("name") or "")[-max_recursos:]:
                st["recursos"].append(_baixa_recurso(con, tema, nome, r, baixar))
        st["ok"] = bool(st["recursos"]) and all(x.get("ok") for x in st["recursos"])
    return status


def situacao(con):
    """Estado de cada tema a partir do silver (sem rede): última tentativa, último sucesso,
    vintages guardadas e se há número publicável."""
    out = []
    for tema in TEMAS:
        ds = tema["dataset"]
        ultima = con.execute("SELECT tentado_em, ok, detalhe FROM coletas WHERE dataset=? ORDER BY rowid DESC LIMIT 1",
                             (ds,)).fetchone()
        primeira_falha = con.execute("SELECT MIN(tentado_em) FROM coletas WHERE dataset=? AND ok=0", (ds,)).fetchone()[0]
        n_falhas = con.execute("SELECT COUNT(*) FROM coletas WHERE dataset=? AND ok=0", (ds,)).fetchone()[0]
        vint = base.vintages_do_dataset(con, ds)
        obs = con.execute("SELECT COUNT(*) FROM observacoes WHERE dataset=?", (ds,)).fetchone()[0]
        seed = metadados_seed(tema["conjunto"]) if tema.get("conjunto") else None
        out.append({
            "tema": tema["id"], "painel": tema["painel"], "titulo": tema["titulo"], "dataset": ds,
            "conjunto": tema.get("conjunto"), "busca": tema.get("busca"), "esquema": tema["esquema"],
            "colunas_esperadas": list(tema["colunas"]) if tema.get("colunas") else None,
            "ultima_tentativa": ultima[0] if ultima else None, "ultima_ok": bool(ultima[1]) if ultima else None,
            "ultimo_detalhe": (ultima[2] or "")[:300] if ultima else None,
            "primeira_falha": primeira_falha, "falhas": n_falhas, "arquivos_guardados": len(vint),
            "observacoes_publicaveis": obs,
            "metadados_seed": ({"versao": seed["versao"], "recursos": [r.get("name") for r in seed["result"].get("resources", [])],
                                "modificado": seed["result"].get("metadata_modified")} if seed else None),
        })
    return out
