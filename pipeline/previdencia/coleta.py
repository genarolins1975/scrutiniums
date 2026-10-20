"""Coleta das três fontes do painel Previdência e INSS e leitura das planilhas.

Cada coletor devolve um seed (dicionário compacto, só com o que a gold usa) e não grava nada: quem chama valida e
decide. Cada seed registra o endereço, o sha256, o tamanho e a data da captura de cada arquivo original.

Leitura das planilhas:
- BEPS (.xls, Excel 97): biblioteca xlrd, importada só na coleta (o workflow a instala; a gold e os testes não usam).
- Arquivo municipal e RTN (.xlsx): openpyxl em modo somente leitura.

Ausência é nula, nunca zero: célula vazia, "-" ou texto de rodapé viram None, e a validação decide se isso reprova.
"""
from __future__ import annotations

import hashlib
import io
import json
import re
import time
import unicodedata
import urllib.error
import urllib.request
from datetime import date, datetime, timezone

from . import fontes as F

USER_AGENT = "Mozilla/5.0 (compatible; Scrutiniums/1.0; observatorio de dados publicos)"

MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]


def agora_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def normalizar(texto) -> str:
    """Minúsculas, sem acento, sem notas de rodapé "(1)" e sem pontuação: só letras, dígitos e espaços simples."""
    s = re.sub(r"\(\d\)", " ", str(texto or ""))
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", s)).strip()


def numero(v):
    """Número da planilha; None para vazio, '-', '...', '#N/A' ou texto."""
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    if not s or s in {"-", "...", "–"} or s.startswith("#"):
        return None
    try:
        return float(s.replace(".", "").replace(",", ".")) if "," in s else float(s)
    except ValueError:
        return None


def baixar(url: str, tentativas: int = 4, timeout: int = 300) -> tuple[bytes, dict]:
    """GET com novas tentativas. 404 não se repete: o arquivo não existe (ainda)."""
    erro = None
    for t in range(tentativas):
        try:
            # Accept */*: o gov.br responde 401 a binário pedido como JSON
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                corpo = r.read()
                return corpo, {"url": url, "status": r.status, "bytes": len(corpo), "sha256": hashlib.sha256(corpo).hexdigest()}
        except urllib.error.HTTPError as e:
            erro = e
            if 400 <= e.code < 500:
                break
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            erro = e
        time.sleep(min(60, 5 * (t + 1)))
    raise RuntimeError(f"falha ao coletar {url}: {erro}")


def existe(url: str) -> bool:
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
        with urllib.request.urlopen(req, timeout=60) as r:
            return 200 <= r.status < 300
    except urllib.error.HTTPError:
        return False
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


# ------------------------------------------------------------------------------------------------------- BEPS


def _mes_do_rotulo(rotulo) -> int | None:
    n = normalizar(rotulo)
    for i, m in enumerate(MESES):
        if n == m:
            return i + 1
    return None


def ler_beps(corpo: bytes) -> dict:
    """Lê as tabelas 14, 15 e 19 do BEPS. Estrutura inesperada levanta ValueError (a coleta reprova)."""
    import xlrd  # só na coleta

    livro = xlrd.open_workbook(file_contents=corpo)
    nomes = livro.sheet_names()
    for t in ("14", "15", "19"):
        if t not in nomes:
            raise ValueError(f"BEPS sem a tabela {t}")

    def celulas(folha, linha):
        return {c: folha.cell_value(linha, c) for c in range(folha.ncols) if str(folha.cell_value(linha, c)).strip() != ""}

    def titulo(folha):
        for r in range(min(4, folha.nrows)):
            for v in celulas(folha, r).values():
                if isinstance(v, str) and len(v) > 30 and "Boletim" not in v:
                    return v
        return ""

    def referencia(folha):
        """Mês de referência do cabeçalho (data do Excel na primeira linha) e volume/número da edição."""
        cab = celulas(folha, 0)
        datas = [v for v in cab.values() if isinstance(v, float) and 30000 < v < 80000]
        edicao = next((v for v in cab.values() if isinstance(v, str) and "Boletim" in v), "")
        if not datas:
            raise ValueError(f"tabela {folha.name}: sem a data de referência no cabeçalho")
        a, m, *_ = xlrd.xldate_as_tuple(datas[0], livro.datemode)
        return f"{a}-{m:02d}", edicao

    t14, t15, t19 = (livro.sheet_by_name(n) for n in ("14", "15", "19"))
    refs = {referencia(f)[0] for f in (t14, t15, t19)}
    if len(refs) != 1:
        raise ValueError(f"tabelas do BEPS com meses de referência diferentes: {sorted(refs)}")
    ref, edicao = referencia(t15)

    # ---- tabela 14: série por grandes grupos
    if "EVOLUCAO DOS BENEFICIOS EMITIDOS" not in normalizar(titulo(t14)).upper():
        raise ValueError(f"tabela 14 com outro título: {titulo(t14)!r}")
    cab6 = celulas(t14, 6)
    pos = {}
    for c, v in sorted(cab6.items()):
        k = normalizar(v).replace(" ", "")
        pos.setdefault(k, []).append(c)
    if len(pos.get("rgps", [])) < 2 or len(pos.get("assistencial", [])) < 2 or len(pos.get("ble", [])) < 2:
        raise ValueError("tabela 14: colunas RGPS, Assistencial e BLE não encontradas")
    col = {"q": {"rgps": pos["rgps"][0], "assist": pos["assistencial"][0], "ble": pos["ble"][0]},
           "v": {"rgps": pos["rgps"][1], "assist": pos["assistencial"][1], "ble": pos["ble"][1]}}
    col["q"]["total"] = col["q"]["rgps"] - 1
    col["v"]["total"] = col["v"]["rgps"] - 1
    # A coluna do ano é preenchida de forma irregular: um dezembro por ano de 2000 a 2008; de 2008 a 2011, cada bloco
    # mensal começa por uma linha "ano Dezembro" que repete o dezembro do próprio bloco; desde 2012, por uma linha
    # "ano Total"; em 2025 e 2026, o ano vem no janeiro. Regra: linha com ano e "Dezembro" é o dezembro desse ano;
    # "Total" e janeiro com ano fixam o ano do bloco; janeiro sem ano pertence ao ano da última linha com ano. Dezembro
    # repetido precisa ter os mesmos números. A validação confere depois que os meses ficaram contínuos.
    por_mes: dict[str, dict] = {}
    ano_rotulado = None
    ano_bloco = None
    for r in range(7, t14.nrows):
        a, m = t14.cell_value(r, 0), t14.cell_value(r, 1)
        if normalizar(a).startswith(("fontes", "obs")) or normalizar(m).startswith(("fontes", "obs")):
            break
        ano_rotulo = int(float(a)) if re.fullmatch(r"\d{4}(\.0)?", str(a).strip()) else None
        rot = normalizar(m)
        if ano_rotulo is not None:
            ano_rotulado = ano_rotulo
        if rot in ("total", "subtotal"):
            if ano_rotulo is not None:
                ano_bloco = ano_rotulo
            continue  # somas do ano, com o abono
        mes = _mes_do_rotulo(re.sub(r"\(.*?\)", "", str(m)))
        if mes is None:
            continue
        if mes == 12 and ano_rotulo is not None:
            chave = f"{ano_rotulo}-12"
        elif mes == 1:
            if ano_rotulado is None:
                raise ValueError(f"tabela 14, linha {r + 1}: janeiro sem ano")
            ano_bloco = ano_rotulado
            chave = f"{ano_bloco}-01"
        else:
            if ano_bloco is None:
                raise ValueError(f"tabela 14, linha {r + 1}: mês fora de um bloco anual")
            chave = f"{ano_bloco}-{mes:02d}"
        linha = _linha14(t14, r, chave, m, col)
        anterior = por_mes.get(chave)
        if anterior and (anterior["q"] != linha["q"] or anterior["v"] != linha["v"]):
            raise ValueError(f"tabela 14: {chave} aparece duas vezes com números diferentes")
        if anterior:
            linha["abono"] = anterior["abono"] or linha["abono"]
        por_mes[chave] = linha
    serie = [por_mes[k] for k in sorted(por_mes)]

    # ---- tabela 15: por grupo e espécie no mês
    if "BENEFICIOS EMITIDOS PELO INSS POR CLIENTELA SEGUNDO OS GRUPOS DE ESPECIES" not in normalizar(titulo(t15)).upper():
        raise ValueError(f"tabela 15 com outro título: {titulo(t15)!r}")
    c15 = _colunas_clientela(celulas(t15, 4), celulas(t15, 5), celulas(t15, 6))
    linhas15 = []
    for r in range(7, t15.nrows):
        rot = t15.cell_value(r, 0)
        if isinstance(rot, str) and normalizar(rot).startswith("fontes"):
            break
        if not str(rot).strip():
            continue
        linhas15.append({"rotulo": str(rot).strip(), **_valores(t15, r, c15)})

    # ---- tabela 19: RGPS por UF no mês
    if "BENEFICIOS DO RGPS EMITIDOS POR CLIENTELA SEGUNDO AS UNIDADES DA FEDERACAO" not in normalizar(titulo(t19)).upper():
        raise ValueError(f"tabela 19 com outro título: {titulo(t19)!r}")
    c19 = _colunas_clientela(celulas(t19, 4), celulas(t19, 5), celulas(t19, 6))
    por_nome = {normalizar(n): s for s, n in F.NOME_UF.items()}
    regioes = {normalizar(x): x for x in F.REGIOES}
    ufs, regs, brasil, notas = {}, {}, None, []
    for r in range(7, t19.nrows):
        rot = t19.cell_value(r, 0)
        n = normalizar(rot)
        if n.startswith("fontes"):
            for rr in range(r + 1, min(r + 4, t19.nrows)):
                txt = str(t19.cell_value(rr, 0)).strip()
                if txt.lower().startswith("obs"):
                    notas.append(txt)
            break
        if not n:
            continue
        v = _valores(t19, r, c19)
        if n == "brasil":
            brasil = v
        elif n in por_nome:
            ufs[por_nome[n]] = v
        elif n in regioes:
            regs[regioes[n]] = v
        else:
            raise ValueError(f"tabela 19: linha inesperada {rot!r}")
    if brasil is None:
        raise ValueError("tabela 19 sem a linha BRASIL")

    return {
        "referencia": ref,
        "edicao": re.sub(r"\s+", " ", edicao).replace("Boletim Estatístico da Previdência Social - ", "").strip(),
        "tabela14": {"titulo": titulo(t14).strip(), "serie": serie},
        "tabela15": {"titulo": titulo(t15).strip(), "linhas": linhas15},
        "tabela19": {"titulo": titulo(t19).strip(), "brasil": brasil, "regioes": regs, "ufs": ufs, "notas": notas},
    }


def _linha14(folha, r, chave, rotulo_mes, col):
    v = {g: numero(folha.cell_value(r, c)) for g, c in col["v"].items()}
    q = {g: numero(folha.cell_value(r, c)) for g, c in col["q"].items()}
    # meses marcados "(1)" incluem a parcela do abono anual (13º) no valor
    return {"mes": chave, "abono": "(" in str(rotulo_mes), "q": q, "v": v}


def _colunas_clientela(cab4, cab5, cab6):
    """Colunas de total, urbana e rural da quantidade e do valor nas tabelas 15 e 19 (cabeçalho em três linhas)."""
    blocos = sorted((c, normalizar(v)) for c, v in cab4.items() if normalizar(v) in ("quantidade", "valor r", "valor medio r"))
    if [b for _c, b in blocos] != ["quantidade", "valor r", "valor medio r"]:
        raise ValueError(f"cabeçalho de quantidade, valor e valor médio não reconhecido: {cab4}")
    (cq, _), (cv, _), (cm, _) = blocos

    def dentro(ini, fim, rotulo):
        return [c for c, v in sorted(cab6.items()) if ini <= c < fim and normalizar(v) == rotulo]

    urb_q, rur_q = dentro(cq, cv, "urbana"), dentro(cq, cv, "rural")
    urb_v, rur_v = dentro(cv, cm, "urbana"), dentro(cv, cm, "rural")
    if not (urb_q and rur_q and urb_v and rur_v):
        raise ValueError("colunas da clientela urbana e rural não encontradas")
    tot_q = [c for c, v in cab5.items() if cq <= c < cv and normalizar(v) == "total"]
    tot_v = [c for c, v in cab5.items() if cv <= c < cm and normalizar(v) == "total"]
    if not tot_q or not tot_v:
        raise ValueError("colunas de total não encontradas")
    return {"q": tot_q[0], "q_urbana": urb_q[0], "q_rural": rur_q[0], "v": tot_v[0], "v_urbana": urb_v[0], "v_rural": rur_v[0]}


def _valores(folha, r, col):
    return {k: numero(folha.cell_value(r, c)) for k, c in col.items()}


def localizar_beps(hoje: date | None = None) -> tuple[str, int, int]:
    """O BEPS mais recente: o maior mês listado na página dos boletins; sem a página, tenta os últimos seis meses."""
    hoje = hoje or date.today()
    candidatos: list[tuple[int, int, str]] = []
    try:
        pagina, _ = baixar(F.PAGINA_BEPS, tentativas=2, timeout=120)
        for m, a in re.findall(r"beps(\d{2})(\d{4})_final\.xls\b", pagina.decode("utf-8", "replace")):
            url = F.URL_BEPS.format(ano=int(a), mes=int(m))
            candidatos.append((int(a), int(m), url))
    except RuntimeError:
        pass
    if candidatos:
        a, m, url = max(candidatos)
        return url, a, m
    a, m = hoje.year, hoje.month
    for _ in range(6):
        url = F.URL_BEPS.format(ano=a, mes=m)
        if existe(url):
            return url, a, m
        a, m = (a - 1, 12) if m == 1 else (a, m - 1)
    raise RuntimeError("nenhum BEPS encontrado na página nem nos últimos seis meses")


def coletar_beps() -> dict:
    url, a, m = localizar_beps()
    corpo, info = baixar(url)
    dados = ler_beps(corpo)
    if dados["referencia"] != f"{a}-{m:02d}":
        raise ValueError(f"arquivo {url} traz o mês {dados['referencia']}, não {a}-{m:02d}")
    return {"fonte": "beps", "capturado_em": agora_utc(), "arquivo": info, "pagina": F.PAGINA_BEPS, **dados}


# ------------------------------------------------------------------------------------------- municípios


def _papel_da_aba(nome: str, titulo: str) -> str | None:
    n, t = normalizar(nome), normalizar(titulo)
    if n.startswith(("qtd", "quantidade")) or t.startswith("quantidade"):
        return "q"
    if "medio" in n or "medio" in t:
        return "medio"
    if "dez" in n.split() or re.search(r"\bdez\d{2,4}\b", n) or n.endswith("v dez"):
        return "v"
    return "ano"


def ler_municipios(corpo: bytes, ano: int) -> dict:
    """Quantidade e valor líquido de dezembro por município e grupo de espécie. Devolve {cod: {campo: valor}}."""
    from openpyxl import load_workbook

    livro = load_workbook(io.BytesIO(corpo), read_only=True, data_only=True)
    abas = {}
    for folha in livro.worksheets:
        linhas = [list(r) for r in folha.iter_rows(values_only=True)]
        titulo = next((str(c) for r in linhas[:3] for c in r if isinstance(c, str) and len(c) > 30), "")
        papel = _papel_da_aba(folha.title, titulo)
        if papel in ("q", "v"):
            if papel in abas:
                raise ValueError(f"{ano}: duas abas de papel {papel}")
            abas[papel] = (folha.title, titulo, linhas)
    if set(abas) != {"q", "v"}:
        raise ValueError(f"{ano}: abas de quantidade e de valor de dezembro não encontradas")
    _, titulo_q, linhas_q = abas["q"]
    cabeca_q = " ".join(normalizar(c) for r in linhas_q[:3] for c in r if isinstance(c, str))
    if f"dezembro de {ano}" not in cabeca_q:
        raise ValueError(f"{ano}: a aba de quantidade não diz 'dezembro de {ano}'")
    _, titulo_v, _ = abas["v"]
    if "liquido" not in normalizar(titulo_v):
        raise ValueError(f"{ano}: a aba de valor não declara valor líquido ({titulo_v!r})")

    def tabela(linhas):
        # coluna do código pelo conteúdo: a que mais tem códigos de sete dígitos
        contagem: dict[int, int] = {}
        for r in linhas:
            for i, v in enumerate(r):
                if v is not None and re.fullmatch(r"\d{7}", str(v).strip().split(".")[0]) and (not isinstance(v, float) or v.is_integer()):
                    contagem[i] = contagem.get(i, 0) + 1
        if not contagem:
            raise ValueError(f"{ano}: coluna do código IBGE não encontrada")
        col_cod = max(contagem, key=contagem.get)
        inicio = next(i for i, r in enumerate(linhas) if col_cod < len(r) and r[col_cod] is not None and re.fullmatch(r"\d{7}", str(r[col_cod]).split(".")[0]))
        mapa: dict[int, str] = {}
        for r in linhas[:inicio]:
            for i, v in enumerate(r):
                campo = F.COLUNAS_MUNICIPIOS.get(normalizar(v)) if isinstance(v, str) else None
                if campo:
                    mapa.setdefault(i, campo)
        mapa[col_cod] = "cod"
        col_nome = next((i for i, c in mapa.items() if c == "nome"), None)
        col_uf = next((i for i, c in mapa.items() if c == "uf"), None)
        saida, sem_codigo = {}, {}
        for r in linhas[inicio:]:
            if all(v is None for v in r):
                continue
            bruto = r[col_cod] if col_cod < len(r) else None
            cod = str(bruto).split(".")[0].strip() if bruto is not None else ""
            valores = {campo: numero(r[i]) for i, campo in mapa.items() if campo not in ("cod", "nome", "uf") and i < len(r)}
            nome = str(r[col_nome]).strip() if col_nome is not None and col_nome < len(r) and r[col_nome] else ""
            uf = str(r[col_uf]).strip() if col_uf is not None and col_uf < len(r) and r[col_uf] else ""
            if re.fullmatch(r"\d{7}", cod):
                saida[cod] = {"nome": nome, "uf": uf, **valores}
            elif nome and normalizar(nome) not in ("brasil",) and valores.get("total") is not None and not normalizar(nome).startswith(("regiao", "fonte", "nota", "obs")):
                sem_codigo[(normalizar(nome), normalizar(uf))] = {"nome": nome, "uf": uf, **valores}
            elif normalizar(nome) == "brasil" or normalizar(r[0] if r else "") == "brasil":
                saida["brasil"] = valores
        return saida, sem_codigo, set(mapa.values())

    q, q_sem, campos_q = tabela(linhas_q)
    v, v_sem, campos_v = tabela(abas["v"][2])
    faltam = {"apo_idade", "apo_invalidez", "apo_tempo", "pensoes", "auxilios", "outros_prev", "total_prev", "assistenciais", "total"} - campos_q
    if faltam:
        raise ValueError(f"{ano}: colunas de quantidade não reconhecidas: {sorted(faltam)}")
    faltam = {"aposentadorias", "pensoes", "auxilios", "outros_prev", "assistenciais", "total"} - campos_v
    if faltam:
        raise ValueError(f"{ano}: colunas de valor não reconhecidas: {sorted(faltam)}")
    # linha sem código numa aba e com código na outra (Boa Esperança do Norte/MT em 2025): recupera pelo nome e UF
    for (nome, uf), linha in q_sem.items():
        cods = [c for c, x in v.items() if c != "brasil" and normalizar(x.get("nome")) == nome and normalizar(x.get("uf")) == uf]
        if len(cods) == 1 and cods[0] not in q:
            q[cods[0]] = linha
    for (nome, uf), linha in v_sem.items():
        cods = [c for c, x in q.items() if c != "brasil" and normalizar(x.get("nome")) == nome and normalizar(x.get("uf")) == uf]
        if len(cods) == 1 and cods[0] not in v:
            v[cods[0]] = linha
    brasil = {"q": (q.pop("brasil", None) or {}).get("total"), "v": (v.pop("brasil", None) or {}).get("total")}
    municipios = {}
    for cod in sorted(set(q) | set(v)):
        a, b = q.get(cod, {}), v.get(cod, {})
        municipios[cod] = {
            "nome": a.get("nome") or b.get("nome") or "",
            "q": {k: a.get(k) for k in ("apo_idade", "apo_invalidez", "apo_tempo", "aposentadorias", "pensoes", "auxilios", "outros_prev", "total_prev", "assistenciais", "total")},
            "v": {k: b.get(k) for k in ("aposentadorias", "pensoes", "auxilios", "outros_prev", "assistenciais", "total")},
        }
    return {"municipios": municipios, "brasil_publicado": brasil, "titulo_quantidade": titulo_q.strip(), "titulo_valor": titulo_v.strip()}


def compactar_municipios(lido: dict) -> dict:
    """Forma do seed: por município, [nome, [quantidades em CAMPOS_Q], [valores em CAMPOS_V], total q, total v]."""
    out = {}
    for cod, m in lido["municipios"].items():
        q, v = m["q"], m["v"]
        out[cod] = [
            m["nome"],
            [None if q.get(k) is None else int(round(q[k])) for k in F.CAMPOS_Q],
            [None if v.get(k) is None else round(v[k], 2) for k in F.CAMPOS_V],
            None if q.get("total") is None else int(round(q["total"])),
            None if v.get("total") is None else round(v["total"], 2),
            None if q.get("aposentadorias") is None else int(round(q["aposentadorias"])),
            None if q.get("total_prev") is None else int(round(q["total_prev"])),
        ]
    return out


def coletar_municipios(hoje: date | None = None) -> dict:
    hoje = hoje or date.today()
    anos = []
    for ano in range(F.PRIMEIRO_ANO_MUNICIPIOS, hoje.year + 1):
        url = F.URL_MUNICIPIOS.format(ano=ano)
        try:
            corpo, info = baixar(url)
        except RuntimeError:
            if ano >= hoje.year - 1:
                continue  # o arquivo do ano anterior sai no meio do ano; o do ano corrente, no ano seguinte
            raise
        lido = ler_municipios(corpo, ano)
        anos.append({
            "ano": ano,
            "referencia": f"{ano}-12",
            "arquivo": info,
            "titulo_quantidade": lido["titulo_quantidade"],
            "titulo_valor": lido["titulo_valor"],
            "brasil_publicado": lido["brasil_publicado"],
            "municipios": compactar_municipios(lido),
        })
    return {
        "fonte": "municipios",
        "capturado_em": agora_utc(),
        "pagina": F.PAGINA_MUNICIPIOS,
        "campos": {"q": F.CAMPOS_Q, "v": F.CAMPOS_V, "linha": ["nome", "q", "v", "total_q", "total_v", "aposentadorias_q", "previdenciarios_q"]},
        "anos": anos,
    }


# ---------------------------------------------------------------------------------------------------- RTN


def _codigo(rotulo: str) -> str | None:
    m = re.match(r"\s*(\d+(?:\.\d+)*)\.?\s", str(rotulo or "") + " ")
    return m.group(1) if m else None


def ler_rtn(corpo: bytes) -> dict:
    from openpyxl import load_workbook

    livro = load_workbook(io.BytesIO(corpo), read_only=True, data_only=True)
    for t in ("2.2", "2.1-A"):
        if t not in livro.sheetnames:
            raise ValueError(f"RTN sem a tabela {t}")

    def anos_e_linhas(folha):
        linhas = [list(r) for r in folha.iter_rows(values_only=True)]
        cab = next((r for r in linhas if r and isinstance(r[0], str) and normalizar(r[0]).startswith("discriminacao")), None)
        if not cab:
            raise ValueError(f"RTN {folha.title}: cabeçalho 'Discriminação' não encontrado")
        cols = {i: int(v) for i, v in enumerate(cab) if isinstance(v, (int, float)) and 1990 <= v <= 2100}
        return cols, linhas

    cols, linhas = anos_e_linhas(livro["2.2"])
    titulo = next((str(r[0]) for r in linhas[:4] if r and isinstance(r[0], str) and r[0].startswith("Tabela")), "")
    unidade = next((str(r[0]) for r in linhas[:5] if r and isinstance(r[0], str) and "R$" in r[0]), "")
    if "milh" not in normalizar(unidade) or "correntes" not in normalizar(unidade):
        raise ValueError(f"RTN 2.2: unidade inesperada {unidade!r}")
    valores: dict[str, dict[int, float | None]] = {}
    for chave, (codigo, palavra) in F.LINHAS_RTN.items():
        achadas = [r for r in linhas if r and isinstance(r[0], str) and _codigo(r[0]) == codigo.rstrip(".") and palavra in normalizar(r[0])]
        if len(achadas) != 1:
            raise ValueError(f"RTN 2.2: linha {codigo} ({palavra}) encontrada {len(achadas)} vezes")
        valores[chave] = {ano: numero(achadas[0][i]) for i, ano in cols.items()}

    cols_a, linhas_a = anos_e_linhas(livro["2.1-A"])
    pib_l = [r for r in linhas_a if r and isinstance(r[0], str) and "pib nominal" in normalizar(r[0])]
    if len(pib_l) != 1:
        raise ValueError("RTN 2.1-A: linha do PIB nominal não encontrada")
    # o memorando do PIB tem cabeçalho de anos próprio, logo acima dele
    i_pib = linhas_a.index(pib_l[0])
    cab_memo = next((r for r in reversed(linhas_a[:i_pib]) if r and any(isinstance(v, (int, float)) and 1990 <= v <= 2100 for v in r[1:])), None)
    cols_memo = {i: int(v) for i, v in enumerate(cab_memo or []) if isinstance(v, (int, float)) and 1990 <= v <= 2100} or cols_a
    pib = {ano: numero(pib_l[0][i]) for i, ano in cols_memo.items()}
    pct = {}
    for chave, (codigo, palavra) in (("arrecadacao", F.LINHAS_RTN["arrecadacao"]), ("beneficios", F.LINHAS_RTN["beneficios"])):
        achadas = [r for r in linhas_a if r and isinstance(r[0], str) and _codigo(r[0]) == codigo and palavra in normalizar(r[0])]
        if len(achadas) != 1:
            raise ValueError(f"RTN 2.1-A: linha {codigo} não encontrada")
        pct[chave] = {ano: (None if numero(achadas[0][i]) is None else numero(achadas[0][i]) * 100) for i, ano in cols_a.items()}
    anos = sorted(cols.values())
    return {
        "titulo": titulo.strip(),
        "unidade": unidade.strip(),
        "anos": anos,
        "linhas": {k: [v.get(a) for a in anos] for k, v in valores.items()},
        "pib": [pib.get(a) for a in anos],
        "pct_pib_publicado": {k: [v.get(a) for a in anos] for k, v in pct.items()},
    }


def coletar_rtn() -> dict:
    pacote, info_pacote = baixar(F.CKAN_RTN, timeout=120)
    recursos = json.loads(pacote)["result"]["resources"]
    serie = [r for r in recursos if "serie historica" in normalizar(r.get("name")) and normalizar(r.get("format")) == "xlsx"]
    if len(serie) != 1:
        raise ValueError(f"CKAN do Tesouro: {len(serie)} recursos de série histórica em XLSX")
    rec = serie[0]
    corpo, info = baixar(rec["url"])
    edicao = re.search(r"([a-z]{3})(\d{2})\.xlsx$", rec["url"].lower())
    abrev = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
    if not edicao or edicao.group(1) not in abrev:
        raise ValueError(f"RTN: edição não reconhecida no nome do arquivo {rec['url']}")
    ref = f"20{edicao.group(2)}-{abrev.index(edicao.group(1)) + 1:02d}"
    return {
        "fonte": "rtn",
        "capturado_em": agora_utc(),
        "edicao": ref,
        "publicado_em": (rec.get("last_modified") or rec.get("created") or "")[:10] or None,
        "recurso": rec.get("name"),
        "arquivo": info,
        "pacote": {"url": F.CKAN_RTN, "sha256": info_pacote["sha256"]},
        **ler_rtn(corpo),
    }
