"""Coleta das três fontes do painel Segurança pública por UF. Cada função devolve o seed do grupo; não grava.

O seed guarda só o que a gold usa, em forma compacta, com o endereço, o tamanho e o sha256 de cada
original. As planilhas originais (cerca de 25 MB por ano no Sinesp VDE) não são versionadas: são baixadas a
cada coleta, conferidas (zip íntegro, cabeçalho esperado) e reduzidas a somas mensais por UF.

- Sinesp VDE: soma mensal por UF e evento, só das polícias estaduais (abrangência "Estadual"); mês sem
  linha ou com o campo vazio fica null. Zero da fonte fica zero aqui; a regra que separa zero de falta de
  envio é aplicada na gold (gold.situacao), com a regra escrita em fontes.LIMIAR_*.
- SIM: contagem por UF de residência e ano para agressões (X85-Y09, total e mulheres), intenção
  indeterminada (Y10-Y34) e todas as causas externas, com a situação de cada ano (final, preliminar,
  prévia) lida das notas do próprio TabNet.
- IBGE: população por UF, sexo e ano (soma dos 19 grupos quinquenais da Projeção, Revisão 2024).
"""
from __future__ import annotations

import hashlib
import html
import io
import json
import os
import re
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from . import fontes as F

USER_AGENT = "Scrutiniums/1.0 (observatorio de dados publicos; contato pelo site)"


def agora_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _info(corpo: bytes, status: int = 200) -> dict:
    return {"status": status, "bytes": len(corpo), "sha256": hashlib.sha256(corpo).hexdigest()}


def baixar(url: str, dados: bytes | None = None, tentativas: int = 6, timeout: int = 300) -> bytes:
    """GET (ou POST, com `dados`) com novas tentativas. Transferência cortada no meio (o gov.br corta
    arquivos grandes) é retomada do ponto em que parou, com Range, e conferida contra o Content-Length."""
    parcial = bytearray()
    total = None
    erro: Exception | None = None
    for t in range(tentativas):
        try:
            cab = {"User-Agent": USER_AGENT}
            if dados is not None:
                cab["Content-Type"] = "application/x-www-form-urlencoded"
            elif parcial:
                cab["Range"] = f"bytes={len(parcial)}-"
            req = urllib.request.Request(url, data=dados, headers=cab)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                if r.status == 206:
                    m = re.search(r"/(\d+)$", r.headers.get("Content-Range", ""))
                    total = int(m.group(1)) if m else total
                else:
                    parcial = bytearray()
                    cl = r.headers.get("Content-Length")
                    total = int(cl) if cl and cl.isdigit() else None
                while True:
                    bloco = r.read(1 << 20)
                    if not bloco:
                        break
                    parcial += bloco
            if total is not None and len(parcial) < total:
                raise OSError(f"transferência incompleta: {len(parcial)} de {total} bytes")
            return bytes(parcial)
        except urllib.error.HTTPError as e:
            erro = e
            if 400 <= e.code < 500 and e.code != 416:
                break
            if e.code == 416:
                parcial = bytearray()
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            erro = e
            if dados is not None:
                parcial = bytearray()
        time.sleep(min(60, 5 * (t + 1)))
    raise RuntimeError(f"falha ao coletar {url}: {erro}")


# ------------------------------------------------------------------ Sinesp VDE


def anos_publicados_vde() -> list[int]:
    """Anos com planilha na página do MJSP. A página é a fonte da lista: um ano novo entra sozinho."""
    pagina = baixar(F.URL_PAGINA_VDE, timeout=120).decode("utf-8", "replace")
    anos = sorted({int(a) for a in re.findall(r"bancovde-(\d{4})\.xlsx", pagina)})
    if not anos:
        raise ValueError("a página do Sinesp VDE não lista nenhuma planilha bancovde-AAAA.xlsx")
    return [a for a in anos if a >= F.PRIMEIRO_ANO]


def _numero(v):
    if v is None or v == "":
        return None
    if isinstance(v, bool):
        raise ValueError(f"valor inesperado: {v!r}")
    if isinstance(v, (int, float)):
        return int(v) if float(v).is_integer() else float(v)
    t = str(v).strip().replace(".", "").replace(",", ".")
    try:
        x = float(t)
    except ValueError as e:
        raise ValueError(f"valor inesperado: {v!r}") from e
    return int(x) if x.is_integer() else x


def agregar_vde(caminho: str, ano: int) -> dict:
    """Soma mensal por evento e UF de uma planilha anual do Sinesp VDE (só abrangência estadual)."""
    import openpyxl  # dependência só da coleta; a gold e os testes não precisam dela

    with zipfile.ZipFile(caminho) as z:
        ruim = z.testzip()
        if ruim:
            raise ValueError(f"planilha {ano} corrompida em {ruim}")
    wb = openpyxl.load_workbook(caminho, read_only=True)
    try:
        ws = wb.worksheets[0]
        it = ws.iter_rows(values_only=True)
        cab = tuple(str(c).strip() if c is not None else "" for c in next(it))
        if cab[: len(F.COLUNAS_VDE)] != F.COLUNAS_VDE:
            raise ValueError(f"planilha {ano}: cabeçalho {cab} diferente do esperado {F.COLUNAS_VDE}")
        i = {c: k for k, c in enumerate(F.COLUNAS_VDE)}
        valores: dict[str, dict[str, list]] = {e: {uf: [None] * 12 for uf in F.SIGLAS} for e in F.IDS_EVENTOS}
        eventos: set[str] = set()
        meses: set[int] = set()
        ufs: set[str] = set()
        abrangencias: set[str] = set()
        linhas = 0
        for r in it:
            if r is None or all(c is None for c in r):
                continue
            linhas += 1
            uf, ev, data, abr = r[i["uf"]], r[i["evento"]], r[i["data_referencia"]], r[i["abrangencia"]]
            if not isinstance(data, datetime):
                raise ValueError(f"planilha {ano}: data_referencia inesperada {data!r}")
            if data.year != ano:
                raise ValueError(f"planilha {ano}: linha de {data.year}")
            eventos.add(ev)
            abrangencias.add(abr)
            meses.add(data.month)
            ufs.add(uf)
            if abr != F.ABRANGENCIA or ev not in F.EVENTO_DO_NOME:
                continue
            if uf not in F.SIGLAS:
                raise ValueError(f"planilha {ano}: UF inesperada {uf!r}")
            eid, _n, campo = F.EVENTO_DO_NOME[ev][:3]
            v = _numero(r[i[campo]])
            if v is None:
                continue
            if v < 0:
                raise ValueError(f"planilha {ano}: valor negativo em {ev} {uf} {data:%Y-%m}")
            arr = valores[eid][uf]
            arr[data.month - 1] = (arr[data.month - 1] or 0) + v
    finally:
        wb.close()
    n_meses = max(meses) if meses else 0
    if sorted(meses) != list(range(1, n_meses + 1)):
        raise ValueError(f"planilha {ano}: meses não contínuos {sorted(meses)}")
    return {
        "ano": ano,
        "linhas": linhas,
        "meses": n_meses,
        "ufs": sorted(ufs),
        "eventos": sorted(e for e in eventos if e),
        "abrangencias": sorted(a for a in abrangencias if a),
        "valores": {e: {uf: arr[:n_meses] for uf, arr in porf.items()} for e, porf in valores.items()},
    }


def coletar_vde(pasta: str | None = None, anos: list[int] | None = None) -> dict:
    capturado = agora_utc()
    anos = anos or anos_publicados_vde()
    tmp = None
    if pasta is None:
        tmp = tempfile.TemporaryDirectory(prefix="vde-")
        pasta = tmp.name
    try:
        originais = {}
        caminhos = {}
        for a in anos:
            url = F.URL_ARQUIVO_VDE.format(ano=a)
            destino = Path(pasta) / f"bancovde-{a}.xlsx"
            corpo = baixar(url)
            destino.write_bytes(corpo)
            originais[str(a)] = {"url": url, **_info(corpo)}
            caminhos[a] = str(destino)
            print(f"  Sinesp VDE {a}: {len(corpo) / 1e6:.1f} MB", flush=True)
        trabalhadores = max(1, min(4, os.cpu_count() or 1))
        with ProcessPoolExecutor(trabalhadores) as ex:
            resultados = list(ex.map(agregar_vde, [caminhos[a] for a in anos], anos))
    finally:
        if tmp is not None:
            tmp.cleanup()
    arquivos, valores = {}, {}
    for r in resultados:
        k = str(r["ano"])
        arquivos[k] = {**originais[k], "linhas": r["linhas"], "meses": r["meses"], "ufs": r["ufs"],
                       "eventos": r["eventos"], "abrangencias": r["abrangencias"]}
        valores[k] = r["valores"]
    return {
        "fonte": "Ministério da Justiça e Segurança Pública, Sinesp VDE (Validador de Dados Estatísticos)",
        "pagina": F.URL_PAGINA_VDE,
        "capturado_em": capturado,
        "abrangencia": F.ABRANGENCIA,
        "arquivos": arquivos,
        "valores": valores,
    }


# ------------------------------------------------------------------ SIM (TabNet)


def notas_sim(formulario: str) -> dict:
    """Situação de cada ano, lida das notas do formulário do TabNet."""
    t = html.unescape(re.sub(r"<[^>]+>", " ", formulario))
    t = re.sub(r"\s+", " ", t)
    m = re.search(r"Dados finais dispon\w+ até (\d{4}) - data de extra\w+ (\d{2}/\d{2}/\d{4})", t)
    if not m:
        raise ValueError("notas do TabNet sem o último ano de dados finais")
    notas = {"final_ate": int(m.group(1)), "extracao_final": m.group(2), "preliminares": {}, "previas": {}}
    for ano, data in re.findall(r"Dados de (\d{4}) - Preliminares - data de extra\w+ (\d{2}/\d{2}/\d{4})", t):
        notas["preliminares"][ano] = data
    for ano, ed, data in re.findall(r"Dados de (\d{4}) - (\d+)a pr\w+via - data de extra\w+ (\d{2}/\d{2}/\d{4})", t):
        notas["previas"][ano] = {"edicao": int(ed), "extracao": data}
    return notas


def campos_sim(formulario: str) -> tuple[list[str], dict[str, str], dict[str, str]]:
    """Campos de seleção do formulário, arquivos por ano e rótulos do grande grupo da CID-10."""
    selecoes = re.findall(r'<SELECT[^>]*NAME="(S[^"]+)"', formulario)
    arquivos = {a: f for f, a in re.findall(r'<OPTION VALUE="(extuf\d{2}\.dbf)"[^>]*>\s*(\d{4})', formulario)}
    bloco = formulario.split('NAME="SGrande_Grupo_CID10"', 1)[-1].split("</SELECT>", 1)[0]
    grupos = {v: html.unescape(r).strip() for v, r in re.findall(r'<OPTION VALUE="([^"]+)"[^>]*>([^<\n]+)', bloco)}
    return selecoes, arquivos, grupos


def tabela_prn(resposta: str) -> dict:
    """Linhas da tabela do TabNet em colunas separadas por ';'. "-" é zero na convenção do TabNet."""
    m = re.search(r"<PRE>(.*?)</PRE>", resposta, re.S | re.I)
    if not m:
        raise ValueError("resposta do TabNet sem tabela")
    linhas = [l.strip() for l in html.unescape(m.group(1)).splitlines() if l.strip() and ";" in l]
    cab = [c.strip('"') for c in linhas[0].split(";")]
    if not cab[0].startswith("Unidade da Federa"):
        raise ValueError(f"tabela do TabNet com linha inesperada: {cab[0]!r}")
    anos = [int(c) for c in cab[1:] if c.isdigit()]
    out = {"anos": anos, "ufs": {}, "outras": {}, "total": None}
    for l in linhas[1:]:
        partes = [c.strip('"') for c in l.split(";")]
        nome, vals = partes[0], partes[1 : 1 + len(anos)]
        nums = [0 if v in ("-", "") else int(v) for v in vals]
        mm = re.match(r"^(\d{2}) ", nome)
        if nome.startswith("Total"):
            out["total"] = nums
        elif mm and int(mm.group(1)) in F.SIGLA_DO_CODIGO:
            out["ufs"][F.SIGLA_DO_CODIGO[int(mm.group(1))]] = nums
        else:
            out["outras"][nome] = nums
    return out


def coletar_sim() -> dict:
    capturado = agora_utc()
    originais = {}
    form_b = baixar(F.URL_TABNET_FORM, timeout=120)
    originais[F.URL_TABNET_FORM] = _info(form_b)
    form = form_b.decode("latin-1")
    notas = notas_sim(form)
    selecoes, arquivos, grupos = campos_sim(form)
    ultimo = max([notas["final_ate"], *map(int, notas["preliminares"])])
    anos = [a for a in range(F.PRIMEIRO_ANO, ultimo + 1)]
    faltam = [a for a in anos if str(a) not in arquivos]
    if faltam:
        raise ValueError(f"TabNet sem os anos {faltam}")
    consultas = {}
    for cid, grupo, rotulo, sexo in F.CONSULTAS_SIM:
        if rotulo and not grupos.get(grupo, "").startswith(rotulo):
            raise ValueError(f"grande grupo {grupo} do TabNet é {grupos.get(grupo)!r}, esperado {rotulo!r}")
        campos = [("Linha", "Unidade_da_Federação"), ("Coluna", "Ano_do_Óbito"), ("Incremento", "Óbitos_p/Residênc")]
        campos += [("Arquivos", arquivos[str(a)]) for a in anos]
        for s in selecoes:
            v = "TODAS_AS_CATEGORIAS__"
            if s == "SGrande_Grupo_CID10":
                v = grupo
            elif s == "SSexo" and sexo:
                v = sexo
            campos.append((s, v))
        campos += [("zeradas", "exibirlz"), ("formato", "prn"), ("mostre", "Mostra")]
        corpo = urllib.parse.urlencode(campos, encoding="latin-1").encode("ascii")
        resp = baixar(F.URL_TABNET, dados=corpo, timeout=240)
        originais[f"{F.URL_TABNET}#{cid}"] = _info(resp)
        t = tabela_prn(resp.decode("latin-1"))
        if t["anos"] != anos:
            raise ValueError(f"consulta {cid}: anos {t['anos']} diferentes dos pedidos {anos}")
        consultas[cid] = {
            "grupo_cid10": grupos.get(grupo) if rotulo else "Todas as causas externas (V01-Y98)",
            "sexo": "Feminino" if sexo == "2" else "Todos",
            "ufs": {uf: dict(zip(map(str, anos), v)) for uf, v in t["ufs"].items()},
            "outras": {k: dict(zip(map(str, anos), v)) for k, v in t["outras"].items()},
            "total": dict(zip(map(str, anos), t["total"])) if t["total"] else None,
        }
        time.sleep(2)
    situacao = {}
    for a in anos:
        if a <= notas["final_ate"]:
            situacao[str(a)] = "final"
        elif str(a) in notas["preliminares"]:
            situacao[str(a)] = "preliminar"
    return {
        "fonte": "Ministério da Saúde, SIM (Sistema de Informações sobre Mortalidade), pelo TabNet do DATASUS",
        "formulario": F.URL_TABNET_FORM,
        "capturado_em": capturado,
        "notas": notas,
        "anos": anos,
        "situacao": situacao,
        "consultas": consultas,
        "originais": originais,
    }


# ------------------------------------------------------------------ IBGE


def populacao_projecao(corpo: bytes) -> dict:
    """População por local, sexo e ano: soma dos 19 grupos quinquenais."""
    import openpyxl

    wb = openpyxl.load_workbook(io.BytesIO(corpo), read_only=True)
    try:
        ws = wb.worksheets[0]
        anos: list[int] | None = None
        soma: dict[tuple[str, str], list[int]] = {}
        grupos: dict[tuple[str, str], int] = {}
        for r in ws.iter_rows(values_only=True):
            if r and r[0] == "GRUPO ETÁRIO":
                primeiro = int(r[5])
                anos = [primeiro + k for k in range(len(r) - 5)]
                continue
            if anos is None or r[0] is None or r[3] is None:
                continue
            sigla, sexo = str(r[3]).strip(), str(r[1]).strip()
            vals = [int(v) for v in r[5 : 5 + len(anos)]]
            k = (sigla, sexo)
            if k not in soma:
                soma[k] = [0] * len(anos)
            soma[k] = [a + b for a, b in zip(soma[k], vals)]
            grupos[k] = grupos.get(k, 0) + 1
    finally:
        wb.close()
    if anos is None:
        raise ValueError("planilha da projeção sem a linha de cabeçalho")
    return {"anos": anos, "soma": soma, "grupos": grupos}


def coletar_ibge() -> dict:
    capturado = agora_utc()
    corpo = baixar(F.URL_PROJECAO)
    p = populacao_projecao(corpo)
    ate = datetime.now(timezone.utc).year
    idx = [k for k, a in enumerate(p["anos"]) if F.PRIMEIRO_ANO <= a <= ate]
    anos = [p["anos"][k] for k in idx]
    pop = {}
    for sigla in [F.BRASIL, *F.SIGLAS]:
        pop[sigla] = {}
        for sexo, chave in (("Ambos", "total"), ("Mulheres", "mulheres"), ("Homens", "homens")):
            if (sigla, sexo) not in p["soma"]:
                raise ValueError(f"projeção sem {sigla} {sexo}")
            if p["grupos"][(sigla, sexo)] != F.GRUPOS_IDADE:
                raise ValueError(f"projeção {sigla} {sexo}: {p['grupos'][(sigla, sexo)]} grupos de idade, esperado {F.GRUPOS_IDADE}")
            pop[sigla][chave] = {str(p["anos"][k]): p["soma"][(sigla, sexo)][k] for k in idx}
    return {
        "fonte": "IBGE, Projeções da População, Revisão 2024 (3ª edição): população em 1º de julho por sexo e grupo quinquenal de idade",
        "url": F.URL_PROJECAO,
        "metodo": F.URL_PROJECAO_METODO,
        "capturado_em": capturado,
        "anos": anos,
        "populacao": pop,
        "original": {"url": F.URL_PROJECAO, **_info(corpo)},
    }


# ------------------------------------------------------------------ Siconfi


def despesa_dca(itens: list[dict]) -> dict:
    """Despesa liquidada na função 06 e total do ente (exceto intraorçamentárias) numa resposta da DCA I-E."""
    def um(contas: tuple[str, ...]):
        linhas = [i for i in itens if i.get("conta") in contas and i.get("coluna") == F.COLUNA_DESPESA
                  and i.get("cod_conta") in (F.COD_CONTA_DESPESA, None)]
        if len(linhas) > 1:
            raise ValueError(f"DCA com {len(linhas)} linhas para {contas}")
        return float(linhas[0]["valor"]) if linhas else None
    return {"seguranca": um((F.CONTA_SEGURANCA,)), "total": um(F.CONTAS_TOTAL)}


def coletar_siconfi(anos: list[int] | None = None, pausa: float = 0.4) -> dict:
    from pipeline.eficiencia.fontes import siconfi as S

    capturado = agora_utc()
    ultimo = datetime.now(timezone.utc).year - 1
    anos = anos or list(range(F.PRIMEIRO_ANO, ultimo + 1))
    valores: dict = {uf: {} for uf in F.SIGLAS}
    originais: dict = {}
    for a in anos:
        for cod, sigla, _n, _r in F.UFS:
            urls, itens = S._todas_paginas("dca", {"an_exercicio": a, "no_anexo": F.ANEXO_DCA, "id_ente": cod})
            corpo = json.dumps(itens, ensure_ascii=False, sort_keys=True).encode("utf-8")
            valores[sigla][str(a)] = despesa_dca(itens) if itens else {"seguranca": None, "total": None}
            originais[f"{sigla}_{a}"] = {"url": urls[0], "linhas": len(itens), **_info(corpo)}
            time.sleep(pausa)
        com = sum(1 for uf in F.SIGLAS if valores[uf][str(a)]["seguranca"] is not None)
        print(f"  Siconfi DCA {a}: {com} de 27 com a função 06", flush=True)
    return {
        "fonte": "Secretaria do Tesouro Nacional, Siconfi: Declaração de Contas Anuais (DCA), Anexo I-E, despesa por função",
        "pagina": F.DOC_SICONFI,
        "url": f"{F.API_SICONFI}/dca?an_exercicio=<ano>&no_anexo=DCA-Anexo%20I-E&id_ente=<código IBGE da UF>",
        "capturado_em": capturado,
        "anos": anos,
        "conta": F.CONTA_SEGURANCA,
        "coluna": F.COLUNA_DESPESA,
        "valores": valores,
        "originais": originais,
    }
