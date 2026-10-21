"""Coleta das fontes do painel Educação nos municípios (rede: só aqui).

Cada função baixa os arquivos oficiais, confere a integridade (MD5 publicado pelo INEP dentro do pacote, sha256 de cada
original guardado no seed), lê só o que o painel usa e devolve o seed. Nenhum número é transformado além da leitura:
o texto "-" vira ausência (null), as marcas do Saeb (ND, ND*, ND***, valor* e valor**) são guardadas à parte, e a vírgula
decimal que o INEP deixa como texto em algumas células vira número. O seed só é gravado depois das validações
(validacoes.py), em run.py.

As planilhas são lidas com o leitor mínimo da biblioteca padrão já usado pelo OBEE (pipeline/eficiencia/fontes/xlsx.py).
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import date, datetime, timezone
from email.utils import parsedate_to_datetime

from pipeline.contas_estaduais.capturar_educacao import contexto_tls
from pipeline.eficiencia.fontes import xlsx

from . import fontes as F

AGENTE = "Scrutiniums/educacao-municipal"
ESPERAS = (10, 30, 60)


def agora() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _abrir(url: str, cabecalhos: dict | None = None, timeout: int = 180):
    host = urllib.parse.urlsplit(url).hostname or ""
    req = urllib.request.Request(url, headers={"User-Agent": AGENTE, **(cabecalhos or {})})
    contexto = contexto_tls(host)
    return urllib.request.urlopen(req, timeout=timeout, context=contexto)


def _transitorio(erro: Exception) -> bool:
    if isinstance(erro, urllib.error.HTTPError):
        return erro.code == 429 or erro.code >= 500
    return isinstance(erro, (urllib.error.URLError, TimeoutError, ConnectionError))


def existe(url: str) -> bool:
    """O arquivo está publicado? 404 é resposta (não existe); outro erro sobe."""
    try:
        with _abrir(url, {"Range": "bytes=0-0"}, timeout=60) as r:
            return r.status in (200, 206)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return False
        raise


def baixar(url: str, destino: str) -> dict:
    """Baixa em fluxo para um arquivo; devolve sha256, bytes e a data de modificação informada pelo servidor."""
    for tentativa in range(len(ESPERAS) + 1):
        try:
            h = hashlib.sha256()
            n = 0
            with _abrir(url) as r, open(destino, "wb") as f:
                modificado = r.headers.get("Last-Modified")
                while True:
                    bloco = r.read(1 << 20)
                    if not bloco:
                        break
                    h.update(bloco)
                    f.write(bloco)
                    n += len(bloco)
            publicado = parsedate_to_datetime(modificado).date().isoformat() if modificado else None
            return {"url": url, "sha256": h.hexdigest(), "bytes": n, "modificado_em": publicado}
        except Exception as erro:  # noqa: BLE001 - só o transporte é repetido
            if tentativa == len(ESPERAS) or not _transitorio(erro):
                raise
            time.sleep(ESPERAS[tentativa])
    raise RuntimeError("inalcançável")


def _md5_membro(zf: zipfile.ZipFile, membro: str) -> str:
    h = hashlib.md5()  # noqa: S324 - conferência com o MD5 que o INEP publica, não segurança
    with zf.open(membro) as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def planilha_do_pacote(caminho_zip: str, tmp: str) -> tuple[str, dict]:
    """Extrai o .xlsx do pacote, conferido contra o MD5 publicado no próprio pacote (quando há)."""
    with zipfile.ZipFile(caminho_zip) as zf:
        if zf.testzip() is not None:
            raise ValueError(f"{os.path.basename(caminho_zip)}: CRC inválido no pacote")
        membros = [n for n in zf.namelist() if n.lower().endswith(".xlsx") and not os.path.basename(n).startswith("~$")]
        if len(membros) != 1:
            raise ValueError(f"{os.path.basename(caminho_zip)}: esperado um .xlsx, achados {len(membros)}")
        membro = membros[0]
        texto_md5 = "".join(zf.read(n).decode("latin1") for n in zf.namelist() if "md5" in n.lower() and n.lower().endswith(".txt"))
        m = re.search(r"([0-9a-fA-F]{32})\s+\*?" + re.escape(os.path.basename(membro)), texto_md5)
        publicado = m.group(1).lower() if m else None
        calculado = _md5_membro(zf, membro)
        if publicado and publicado != calculado:
            raise ValueError(f"{membro}: MD5 {calculado} difere do publicado pelo INEP ({publicado})")
        info = {
            "membro": membro,
            "md5_publicado_inep": publicado,
            "md5_conferido": calculado,
            "gravado_em": "%04d-%02d-%02d" % zf.getinfo(membro).date_time[:3],
        }
        return zf.extract(membro, tmp), info


# ------------------------------------------------------------------------------------------------- leitura


_NUMERO = re.compile(r"^(-?\d+(?:[.,]\d+)?)(\*{1,3})?$")


def valor(celula) -> tuple[float | None, str | None]:
    """Uma célula do INEP vira (número ou None, marca ou None). "-" é ausência; "ND" e companhia são marcas."""
    if celula is None:
        return None, None
    if isinstance(celula, bool):
        raise ValueError(f"célula booleana inesperada: {celula!r}")
    if isinstance(celula, (int, float)):
        return float(celula), None
    t = str(celula).strip()
    if t in ("", "-", "--"):
        return None, None
    if t in ("ND", "ND*", "ND***"):
        return None, t
    m = _NUMERO.match(t)
    if m:
        return float(m.group(1).replace(",", ".")), m.group(2)
    raise ValueError(f"célula fora do formato do INEP: {t!r}")


def _cabecalho(linhas: list[list], marcador: str) -> int:
    for i, r in enumerate(linhas):
        if r and any(isinstance(c, str) and c.strip() == marcador for c in r):
            return i
    raise ValueError(f"cabeçalho com {marcador} não encontrado")


def _ano(texto: str) -> int:
    """'Taxa de Aprovação - 20212' é 2021 com a nota 2: o ano são os quatro primeiros dígitos."""
    m = re.search(r"(\d{4})", texto)
    if not m:
        raise ValueError(f"rótulo sem ano: {texto!r}")
    return int(m.group(1))


def _indices(linhas: list[list], i_cod: int) -> tuple[list[int], list[int], dict, list[dict]]:
    """Posição de cada medida e ano, lida dos rótulos por extenso do INEP (não dos códigos).

    As planilhas de 2025 trazem códigos trocados (a UF, nos anos iniciais, rotula o indicador de rendimento de 2025 como
    VL_INDICADOR_REND_2023; o Brasil, nos anos finais, não tem o código do Ideb de 2023). Os rótulos por extenso estão
    certos, e a conta Ideb = N × P, conferida nas validações, prova a posição de N e de P. Cada código que diverge da
    posição fica registrado no seed, para a auditoria.
    """
    i_desc = next(k for k in range(i_cod, -1, -1) if any(isinstance(c, str) and c.startswith("Taxa de Aprova") for c in linhas[k]))
    desc = linhas[i_desc]
    sub = linhas[i_desc + 1: i_cod]
    cab = linhas[i_cod]
    rotulo = lambda r, j: (r[j].strip() if j < len(r) and isinstance(r[j], str) else "")
    blocos_aprov = [(j, _ano(c)) for j, c in enumerate(desc) if isinstance(c, str) and c.startswith("Taxa de Aprova")]
    blocos_saeb = [(j, _ano(c)) for j, c in enumerate(desc) if isinstance(c, str) and c.startswith("Nota SAEB")]
    blocos_ideb = [(j, _ano(c)) for j, c in enumerate(desc) if isinstance(c, str) and re.match(r"IDEB\s*\d{4}", c)]
    j_metas = next((j for j, c in enumerate(desc) if isinstance(c, str) and c.startswith("Metas")), None)
    anos = [a for _j, a in blocos_ideb]
    if not anos or [a for _j, a in blocos_aprov] != anos or [a for _j, a in blocos_saeb] != anos:
        raise ValueError("os blocos de aprovação, Saeb e Ideb não trazem os mesmos anos")
    fim_aprov = [j for j, _a in blocos_aprov[1:]] + [blocos_saeb[0][0]]
    idx: dict[str, list[int]] = {c: [] for c in F.CAMPOS}
    for (j, _a), fim in zip(blocos_aprov, fim_aprov):
        p = [k for k in range(j, fim) if any(rotulo(r, k).startswith("Indicador de Rendimento") for r in sub)]
        if len(p) != 1:
            raise ValueError(f"bloco de aprovação na coluna {j} sem um indicador de rendimento")
        idx["aprov"].append(j)
        idx["p"].append(p[0])
    for j, _a in blocos_saeb:
        esperado = ("Matemática", "Língua Portuguesa", "Nota Média Padronizada")
        if not all(any(rotulo(r, j + d).startswith(e) for r in sub) for d, e in enumerate(esperado)):
            raise ValueError(f"bloco do Saeb na coluna {j} fora do desenho")
        idx["mat"].append(j)
        idx["port"].append(j + 1)
        idx["n"].append(j + 2)
    idx["ideb"] = [j for j, _a in blocos_ideb]
    metas: list[int] = []
    idx["meta"] = []
    if j_metas is not None:
        for k in range(j_metas, len(cab)):
            ano_meta = next((r[k] for r in sub if k < len(r) and isinstance(r[k], float)), None)
            if ano_meta is None:
                break
            metas.append(int(ano_meta))
            idx["meta"].append(k)
    divergencias = []
    for campo, modelo in [*F.COLUNAS_ANO.items()]:
        for j, a in zip(idx[campo], anos):
            esperado = modelo.format(a=a)
            achado = cab[j] if j < len(cab) else None
            if achado != esperado:
                divergencias.append({"coluna": j, "esperado": esperado, "codigo_na_fonte": achado})
    for j, a in zip(idx["meta"], metas):
        if cab[j] != F.COLUNA_META.format(a=a):
            divergencias.append({"coluna": j, "esperado": F.COLUNA_META.format(a=a), "codigo_na_fonte": cab[j]})
    return anos, metas, idx, divergencias


def _linha_rede(r: list, idx: dict) -> dict:
    """Uma linha (município ou agregado e rede) no formato do seed: listas alinhadas aos anos."""
    out: dict[str, list] = {c: [] for c in F.CAMPOS}
    marcas: list = []
    for k in range(len(idx["ideb"])):
        marca_ano = None
        for campo in F.CAMPOS:
            j = idx[campo][k]
            v, marca = valor(r[j] if j < len(r) else None)
            if marca and campo in ("mat", "port", "n"):
                marca_ano = marca_ano or marca  # a marca é da nota do Saeb (matemática e português trazem a mesma)
            elif marca:
                raise ValueError(f"marca {marca} inesperada em {campo}")
            # N e P com as seis casas publicadas; as demais medidas na precisão da fonte
            out[campo].append(None if v is None else round(v, 6 if campo in ("n", "p") else F.CASAS[campo]))
        marcas.append(marca_ano)
    metas = []
    for j in idx["meta"]:
        v, marca = valor(r[j] if j < len(r) else None)
        if marca:
            raise ValueError(f"marca {marca} inesperada na meta")
        metas.append(None if v is None else round(v, 1))
    out["marca_saeb"] = marcas
    out["meta"] = metas
    return out


def _notas(linhas: list[list], depois: int) -> list[str]:
    notas = []
    for r in linhas[depois:]:
        if r and isinstance(r[0], str) and r[0].strip() and (len(r) < 2 or r[1] is None or isinstance(r[1], str) and not r[1].strip()):
            notas.append(" ".join(r[0].split()))
    return notas


def ler_ideb_municipios(caminho: str) -> dict:
    linhas = list(xlsx.linhas(caminho))
    i = _cabecalho(linhas, "CO_MUNICIPIO")
    cab = linhas[i]
    anos, metas, idx, divergencias = _indices(linhas, i)
    pos = {str(c).strip(): j for j, c in enumerate(cab) if isinstance(c, str)}
    j_uf, j_cod, j_nome, j_rede = pos["SG_UF"], pos["CO_MUNICIPIO"], pos["NO_MUNICIPIO"], pos["REDE"]
    municipios: dict[str, dict] = {}
    ultima = i
    redes_vistas = set()
    for k, r in enumerate(linhas[i + 1:], start=i + 1):
        if len(r) <= j_rede or not isinstance(r[j_cod], (int, float)):
            continue
        ultima = k
        cod = str(int(r[j_cod]))
        rede = str(r[j_rede]).strip()
        redes_vistas.add(rede)
        m = municipios.setdefault(cod, {"nome": str(r[j_nome]).strip(), "uf": str(r[j_uf]).strip(), "redes": {}})
        chave = F.REDES_MUNICIPIO.get(rede)
        if chave is None:
            continue
        if chave in m["redes"]:
            raise ValueError(f"município {cod}: rede {rede} repetida")
        m["redes"][chave] = _linha_rede(r, idx)
    return {
        "anos": anos, "anos_meta": metas, "redes_na_fonte": sorted(redes_vistas), "municipios": municipios,
        "notas_da_fonte": _notas(linhas, ultima + 1), "codigos_divergentes": divergencias,
    }


def ler_ideb_agregado(caminho: str, aba: str, redes: dict[str, str], so_brasil: bool) -> dict:
    linhas = list(xlsx.linhas(caminho, aba))
    i = next(k for k, r in enumerate(linhas) if r and any(isinstance(c, str) and c.startswith("VL_OBSERVADO_") for c in r))
    anos, metas, idx, divergencias = _indices(linhas, i)
    out: dict[str, dict] = {}
    ultima = i
    for k, r in enumerate(linhas[i + 1:], start=i + 1):
        if len(r) < 3 or not isinstance(r[0], str) or not isinstance(r[1], str):
            continue
        nome = r[0].strip()
        rotulo = r[1].strip()
        rede = re.sub(r"\s*(\(\d+\))+\s*$", "", rotulo).strip()
        nota = rotulo[len(rede):].strip() or None
        if so_brasil:
            if nome.lower() != "brasil":
                continue
            chave_ent = "BR"
        else:
            if nome in F.REGIOES:
                ultima = k
                continue
            chave_ent = F.SIGLA_DO_NOME.get(nome)
            if chave_ent is None:
                raise ValueError(f"UF desconhecida na planilha do Ideb: {nome!r}")
        ultima = k
        chave = redes.get(rede)
        if chave is None:
            continue
        ent = out.setdefault(chave_ent, {})
        if chave in ent:
            raise ValueError(f"{nome}: rede {rede} repetida")
        ent[chave] = {**_linha_rede(r, idx), "nota_fonte": nota}
    return {"anos": anos, "anos_meta": metas, "entidades": out, "notas_da_fonte": _notas(linhas, ultima + 1), "codigos_divergentes": divergencias}


def _aba(caminho: str, padroes: tuple[str, ...]) -> str:
    for a in xlsx.nomes_abas(caminho):
        if any(p in a for p in padroes):
            return a
    raise ValueError(f"aba {padroes} não encontrada em {os.path.basename(caminho)}")


def ano_ideb_mais_recente(hoje: date | None = None) -> int:
    """O Ideb sai em anos ímpares (ano do Saeb) e é divulgado no ano seguinte: procura do mais novo para o mais velho."""
    hoje = hoje or date.today()
    a = hoje.year if hoje.year % 2 else hoje.year - 1
    for ano in (a, a - 2, a - 4):
        if existe(F.URL_IDEB_MUNICIPIOS.format(etapa=F.ETAPAS["ai"], ano=ano)):
            return ano
    raise ValueError("nenhuma edição recente do Ideb por município encontrada")


def coletar_ideb(ano: int | None = None) -> dict:
    ano = ano or ano_ideb_mais_recente()
    seed: dict = {
        "ano": ano, "capturado_em": agora(), "pagina": F.PAGINA_IDEB, "nota_informativa": F.URL_NOTA_IDEB.format(ano=ano),
        "arquivos": {}, "notas_da_fonte": {}, "codigos_divergentes": {}, "etapas": {},
    }
    with tempfile.TemporaryDirectory() as tmp:
        anos_ref = None
        for etapa, nome_etapa in F.ETAPAS.items():
            url = F.URL_IDEB_MUNICIPIOS.format(etapa=nome_etapa, ano=ano)
            zp = os.path.join(tmp, f"mun_{etapa}.zip")
            info = baixar(url, zp)
            caminho, integridade = planilha_do_pacote(zp, os.path.join(tmp, f"x_{etapa}"))
            lido = ler_ideb_municipios(caminho)
            os.remove(caminho)
            anos_ref = anos_ref or (lido["anos"], lido["anos_meta"])
            if (lido["anos"], lido["anos_meta"]) != anos_ref:
                raise ValueError("as planilhas das etapas trazem anos diferentes")
            seed["arquivos"][etapa] = {**info, **integridade}
            seed["notas_da_fonte"][etapa] = lido["notas_da_fonte"]
            seed["codigos_divergentes"][etapa] = lido["codigos_divergentes"]
            seed["etapas"][etapa] = {"municipios": lido["municipios"], "redes_na_fonte": lido["redes_na_fonte"]}
        seed["anos"], seed["anos_meta"] = anos_ref
        for chave, url, so_brasil, redes in (
            ("ufs", F.URL_IDEB_UFS.format(ano=ano), False, F.REDES_UF),
            ("brasil", F.URL_IDEB_BRASIL.format(ano=ano), True, F.REDES_BRASIL),
        ):
            zp = os.path.join(tmp, f"{chave}.zip")
            info = baixar(url, zp)
            caminho, integridade = planilha_do_pacote(zp, os.path.join(tmp, f"x_{chave}"))
            seed["arquivos"][chave] = {**info, **integridade}
            for etapa, padroes in (("ai", ("(AI)", "Anos Iniciais")), ("af", ("(AF)", "Anos Finais"))):
                lido = ler_ideb_agregado(caminho, _aba(caminho, padroes), redes, so_brasil)
                if (lido["anos"], lido["anos_meta"]) != anos_ref:
                    raise ValueError(f"{chave}: anos diferentes dos da planilha municipal")
                if so_brasil:
                    seed["etapas"][etapa]["brasil"] = lido["entidades"].get("BR", {})
                else:
                    seed["etapas"][etapa]["ufs"] = lido["entidades"]
                seed["notas_da_fonte"][f"{chave}_{etapa}"] = lido["notas_da_fonte"]
                seed["codigos_divergentes"][f"{chave}_{etapa}"] = lido["codigos_divergentes"]
            os.remove(caminho)
    return seed


# ------------------------------------------------------------------------------------------- Censo Escolar


def _titulo_aba(caminho: str, aba: str) -> str:
    for k, r in enumerate(xlsx.linhas(caminho, aba)):
        if k > 8:
            return ""
        for c in r:
            if isinstance(c, str) and re.match(r"\s*\d+\.\d+\s*[–-]", c):
                return " ".join(c.split())
    return ""


def _inteiro(c) -> int | None:
    if isinstance(c, (int, float)) and not isinstance(c, bool):
        if float(c) != int(c) or c < 0:
            raise ValueError(f"contagem fora do formato: {c!r}")
        return int(c)
    if c is None or (isinstance(c, str) and c.strip() in ("", "-")):
        return None
    raise ValueError(f"contagem fora do formato: {c!r}")


def ler_tabela_censo(caminho: str, aba: str, cfg: dict) -> dict:
    linhas = list(xlsx.linhas(caminho, aba))
    i = next(k for k, r in enumerate(linhas) if r and len(r) > 3 and isinstance(r[3], str) and "Código do Município" in r[3])
    cabecalho = linhas[i: i + 6]
    for j, rotulo in cfg["rotulos"].items():
        if not any(len(r) > j and isinstance(r[j], str) and r[j].strip().startswith(rotulo) for r in cabecalho):
            raise ValueError(f"{aba}: coluna {j} não é '{rotulo}' (desenho da tabela mudou)")
    municipios, ufs, brasil = {}, {}, None
    texto = lambda r, j: r[j].strip() if j < len(r) and isinstance(r[j], str) else ""
    for r in linhas[i + 1:]:
        # só as linhas de dado: Brasil, UF e município (região e cabeçalho ficam de fora)
        if len(r) <= max(cfg["colunas"].values()) or not isinstance(r[4], (int, float)):
            continue
        valores = {campo: _inteiro(r[j]) for campo, j in cfg["colunas"].items()}
        cod = r[3]
        if isinstance(cod, (int, float)):
            municipios[str(int(cod))] = {"nome": texto(r, 2), "uf_nome": texto(r, 1), **valores}
        elif texto(r, 0) == "Brasil":
            brasil = valores
        elif texto(r, 1) and not texto(r, 2):
            sigla = F.SIGLA_DO_NOME.get(texto(r, 1))
            if sigla is None:
                raise ValueError(f"{aba}: UF desconhecida {r[1]!r}")
            ufs[sigla] = valores
        elif texto(r, 0) not in F.REGIOES:
            raise ValueError(f"{aba}: linha de dado sem lugar conhecido: {r[:4]!r}")
    return {"municipios": municipios, "ufs": ufs, "brasil": brasil}


def ano_sinopse_mais_recente(hoje: date | None = None) -> int:
    hoje = hoje or date.today()
    for ano in (hoje.year, hoje.year - 1, hoje.year - 2):
        if existe(F.URL_SINOPSE.format(ano=ano)):
            return ano
    raise ValueError("nenhuma Sinopse Estatística recente encontrada")


def coletar_censo(ano: int | None = None) -> dict:
    ano = ano or ano_sinopse_mais_recente()
    url = F.URL_SINOPSE.format(ano=ano)
    with tempfile.TemporaryDirectory() as tmp:
        zp = os.path.join(tmp, "sinopse.zip")
        info = baixar(url, zp)
        caminho, integridade = planilha_do_pacote(zp, os.path.join(tmp, "x"))
        os.remove(zp)
        titulos = {a: _titulo_aba(caminho, a) for a in xlsx.nomes_abas(caminho) if re.search(r"(^|\s)\d+\.\d+$", a)}
        tabelas, lidas = {}, {}
        for chave, cfg in F.TABELAS_CENSO.items():
            achadas = [(a, t) for a, t in titulos.items() if re.search(cfg["titulo"], t)]
            if len(achadas) != 1:
                raise ValueError(f"Sinopse {ano}: tabela '{chave}' achada {len(achadas)} vezes")
            aba, titulo = achadas[0]
            tabelas[chave] = {"aba": aba, "titulo": titulo}
            lidas[chave] = ler_tabela_censo(caminho, aba, cfg)
    municipios: dict[str, list] = {}
    nomes: dict[str, str] = {}
    codigos = set().union(*(set(t["municipios"]) for t in lidas.values()))
    for cod in sorted(codigos):
        linha = []
        for chave, cfg in F.TABELAS_CENSO.items():
            m = lidas[chave]["municipios"].get(cod)
            linha.extend(None if m is None else m[c] for c in cfg["colunas"])
            if m:
                nomes[cod] = m["nome"]
        municipios[cod] = [nomes.get(cod, "")] + linha
    def agregado(sigla: str | None) -> list:
        linha = []
        for chave, cfg in F.TABELAS_CENSO.items():
            d = lidas[chave]["brasil"] if sigla is None else lidas[chave]["ufs"].get(sigla)
            linha.extend(None if d is None else d[c] for c in cfg["colunas"])
        return linha

    return {
        "ano": ano, "capturado_em": agora(), "pagina": F.PAGINA_SINOPSE,
        "arquivo": {**info, **integridade}, "tabelas": tabelas, "campos": F.CAMPOS_CENSO,
        "municipios": municipios,
        "ufs": {s: agregado(s) for s in F.SIGLAS},
        "brasil": agregado(None),
    }


# ------------------------------------------------------------------------------------------------ população


def _sidra(url: str) -> list[dict]:
    for tentativa in range(len(ESPERAS) + 1):
        try:
            with _abrir(url, timeout=180) as r:
                dados = json.loads(r.read().decode("utf-8"))
            if not isinstance(dados, list) or len(dados) < 2:
                raise ValueError(f"SIDRA sem dados: {url}")
            return dados[1:]
        except Exception as erro:  # noqa: BLE001
            if tentativa == len(ESPERAS) or not _transitorio(erro):
                raise
            time.sleep(ESPERAS[tentativa])
    raise RuntimeError("inalcançável")


def coletar_populacao(ano: int) -> dict:
    url = F.URL_SIDRA_MUNICIPIOS.format(ano=ano)
    linhas = _sidra(url)
    brasil = _sidra(F.URL_SIDRA_BRASIL.format(ano=ano))
    municipios, nomes = {}, {}
    for x in linhas:
        if x.get("D3C") != str(ano):
            raise ValueError(f"SIDRA devolveu o ano {x.get('D3C')}, pedido {ano}")
        if not str(x.get("V", "")).isdigit():
            raise ValueError(f"população não numérica em {x.get('D1C')}: {x.get('V')!r}")
        municipios[str(x["D1C"])] = int(x["V"])
        # "Alta Floresta D'Oeste - RO": o nome oficial do IBGE, o mesmo da busca de municípios da plataforma
        nomes[str(x["D1C"])] = re.sub(r"\s+-\s+[A-Z]{2}$", "", str(x["D1N"])).strip()
    return {
        "ano": ano, "capturado_em": agora(), "pagina": F.PAGINA_SIDRA, "url": url, "tabela": "6579", "variavel": "9324",
        "municipios": municipios, "nomes": nomes, "brasil": int(brasil[0]["V"]),
    }
