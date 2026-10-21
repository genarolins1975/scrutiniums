"""Leitura e coleta do Anuário Estatístico da Previdência Social (AEPS), quarta fonte do painel Previdência e INSS.

O AEPS publica cada tabela numa página HTML do portal gov.br (saída do SAS, tabela com a classe "table"). A leitura usa
só a biblioteca padrão (html.parser) e é estrita: cabeçalho com outros anos, outras clientelas ou outras colunas, linha
renomeada ou número em formato inesperado levantam ValueError, e a coleta reprova sem tocar no seed. O traço da fonte
("-") vira None: o Anuário não define se é zero ou dado ausente, e a ausência nunca vira zero aqui.

As tabelas 43.1 (rede) e 43.2 (atendimento) trazem um único ano por edição: a série vem das edições anteriores, guardadas
em "anteriores" no seed só com essas duas tabelas e os mesmos metadados (fontes.PRIMEIRA_EDICAO_ATENDIMENTO_AEPS).

Cada tabela guarda no seed o endereço, o sha256 e o tamanho da página capturada, o sha256 só da tabela (o da página muda
quando o portal troca menus e sugestões de busca, o da tabela só muda se um número ou rótulo mudar), as datas de
publicação e de atualização declaradas na página, a linha de fonte e as notas.

Base: o extrator do PR #142 (scripts/obee/previdencia-extrair.py, ramo codex/obee-previdencia-aeps-2024), refeito nas
convenções deste pipeline e conferido de novo contra o portal em 21/10/2026 (as doze tabelas que aquele PR guardou em
11/10/2026 têm conteúdo idêntico ao publicado hoje).
"""
from __future__ import annotations

import hashlib
import json
import re
from html.parser import HTMLParser

from . import fontes as F
from .coleta import agora_utc, baixar, normalizar

MESES_AEPS = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]


class _Pagina(HTMLParser):
    """Recolhe a tabela de dados (cabeçalho com colspan e rowspan, corpo), o título, o rodapé e as datas da página."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.na_tabela = False
        self.tabelas = 0
        self.secao = None  # "thead" ou "tbody"
        self.cab: list[list[tuple[str, int, int]]] = []
        self.corpo: list[list[str]] = []
        self.linha = None
        self.celula = None
        self.span = (1, 1)
        self.td_classe = None
        self.td_texto = None
        self.titulo = ""
        self.rodape: list[str] = []
        self.span_classe = None
        self.valor_data = None
        self.datas: dict[str, str] = {}
        self._data_de = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        classe = a.get("class") or ""
        if tag == "table" and classe == "table":
            self.na_tabela = True
            self.tabelas += 1
        if tag == "span" and classe in ("documentPublished", "documentModified"):
            self._data_de = classe
        if tag == "span" and classe == "value" and self._data_de:
            self.valor_data = ""
        if self.na_tabela:
            if tag in ("thead", "tbody"):
                self.secao = tag
            elif tag == "tr":
                self.linha = []
            elif tag in ("td", "th"):
                self.celula = ""
                self.span = (int(a.get("colspan") or 1), int(a.get("rowspan") or 1))
        elif tag == "td" and ("systemtitle2" in classe or "systemfooter" in classe):
            self.td_classe = classe
            self.td_texto = ""

    def handle_data(self, d):
        if self.celula is not None:
            self.celula += d
        if self.td_texto is not None:
            self.td_texto += d
        if self.valor_data is not None:
            self.valor_data += d

    def handle_endtag(self, tag):
        if self.na_tabela and tag in ("td", "th") and self.celula is not None:
            texto = " ".join(self.celula.split())
            self.linha.append((texto, *self.span) if self.secao == "thead" else texto)
            self.celula = None
        elif self.na_tabela and tag == "tr" and self.linha is not None:
            if self.linha:
                (self.cab if self.secao == "thead" else self.corpo).append(self.linha)
            self.linha = None
        elif tag == "table" and self.na_tabela:
            self.na_tabela = False
        elif tag == "td" and self.td_texto is not None:
            texto = " ".join(self.td_texto.split())
            if "systemtitle2" in (self.td_classe or ""):
                self.titulo = texto
            elif texto:
                self.rodape.append(texto)
            self.td_texto = None
            self.td_classe = None
        elif tag == "span" and self.valor_data is not None:
            self.datas[self._data_de] = " ".join(self.valor_data.split())
            self.valor_data = None
            self._data_de = None


def _grade(cab: list[list[tuple[str, int, int]]]) -> list[list[str]]:
    """Expande o cabeçalho com colspan e rowspan numa grade: cada coluna recebe o rótulo de cada linha que a cobre."""
    grade: list[list[str | None]] = []
    largura = sum(c for _t, c, _r in cab[0]) if cab else 0
    for i in range(len(cab)):
        grade.append([None] * largura)
    for i, linha in enumerate(cab):
        col = 0
        for texto, cs, rs in linha:
            while col < largura and grade[i][col] is not None:
                col += 1
            for r in range(i, min(len(cab), i + rs)):
                for c in range(col, min(largura, col + cs)):
                    grade[r][c] = texto
            col += cs
    return [[x or "" for x in linha] for linha in grade]


def numero_aeps(texto: str):
    """Número da página do AEPS (milhar com ponto, decimal com vírgula); o traço e as reticências viram None."""
    s = texto.strip()
    if s in ("-", "–", "...", "..", ""):
        return None
    if re.fullmatch(r"\d{1,3}(\.\d{3})*", s):
        return int(s.replace(".", ""))
    if re.fullmatch(r"\d{1,3}(\.\d{3})*,\d+", s):
        return float(s.replace(".", "").replace(",", "."))
    raise ValueError(f"número em formato inesperado: {texto!r}")


def _data_br(texto: str | None) -> str | None:
    """'22/10/2025 15h14' → '2025-10-22'."""
    m = re.match(r"(\d{2})/(\d{2})/(\d{4})", texto or "")
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else None


def _sigla(rotulo: str) -> str | None:
    n = normalizar(rotulo)
    for s, nome in F.NOME_UF.items():
        if normalizar(nome) == n:
            return s
    return None


def _ordem_territorios() -> list[str]:
    """BRASIL, cada região seguida das suas UFs, na ordem do IBGE: a ordem exata das linhas das tabelas por UF."""
    ordem = ["brasil"]
    for r in F.REGIOES:
        ordem.append(normalizar(r))
        ordem += [s for s in F.SIGLAS if F.REGIAO_UF[s] == r]
    return ordem


def ler_tabela(html: str, tid: str, edicao: int) -> dict:
    """Lê uma página do AEPS. Devolve título, rodapé, datas, o sha256 da tabela e as linhas na forma da tabela."""
    caminho, forma, unidade = F.TABELAS_AEPS[tid]
    p = _Pagina()
    p.feed(html)
    if p.tabelas != 1:
        raise ValueError(f"{tid}: {p.tabelas} tabelas de dados na página (esperada uma)")
    codigo = tid.upper() if tid[0].isalpha() else tid
    if not p.titulo.startswith(f"{codigo} - "):
        raise ValueError(f"{tid}: título inesperado {p.titulo!r}")
    grade = _grade(p.cab)
    anos = [edicao - 2, edicao - 1, edicao]
    ano_titulo = f"{edicao - 2}/{edicao}" if forma in ("especies", "uf_clientela") else str(edicao)
    if not p.titulo.rstrip().endswith(ano_titulo):
        raise ValueError(f"{tid}: o título não termina no período esperado ({ano_titulo}): {p.titulo!r}")
    folhas = [normalizar(x) for x in grade[-1]]
    if forma in ("especies", "uf_clientela"):
        clientela = [normalizar(x) for x in grade[-2][1:]]
        if folhas[1:] != [str(a) for a in anos] * 3 or clientela != ["total"] * 3 + ["urbana"] * 3 + ["rural"] * 3:
            raise ValueError(f"{tid}: cabeçalho com outros anos ou outras clientelas: {grade}")
        largura = 10
    elif forma == "meses":
        if folhas[1:] != MESES_AEPS:
            raise ValueError(f"{tid}: cabeçalho sem os doze meses: {folhas}")
        largura = 13
    else:  # rede
        if folhas[1:] != [r for _i, r in F.REDE_AEPS]:
            raise ValueError(f"{tid}: colunas de unidades diferentes das esperadas: {folhas}")
        largura = 13
    if any(len(l) != largura for l in p.corpo):
        raise ValueError(f"{tid}: linha com {sorted({len(l) for l in p.corpo})} colunas (esperadas {largura})")
    rotulos = [normalizar(l[0]) for l in p.corpo]
    if forma == "especies":
        esperados = [r for _i, r, _p in F.ESPECIES_AEPS]
        if rotulos != esperados:
            raise ValueError(f"{tid}: linhas diferentes das esperadas: {rotulos}")
        linhas = [{"id": i, "rotulo": l[0], "v": [numero_aeps(x) for x in l[1:]]} for (i, _r, _p), l in zip(F.ESPECIES_AEPS, p.corpo)]
    else:
        ordem = _ordem_territorios()
        achados = [("brasil" if r == "brasil" else _sigla(l[0]) or r) for r, l in zip(rotulos, p.corpo)]
        if achados != ordem:
            raise ValueError(f"{tid}: territórios fora da ordem esperada: {achados}")
        linhas = [{"id": t, "rotulo": l[0], "v": [numero_aeps(x) for x in l[1:]]} for t, l in zip(achados, p.corpo)]
    conteudo = json.dumps({"cabecalho": grade, "corpo": p.corpo}, ensure_ascii=False, separators=(",", ":"))
    fonte = p.rodape[0] if p.rodape else ""
    if not fonte.upper().startswith("FONTE"):
        raise ValueError(f"{tid}: rodapé sem a linha de fonte")
    return {
        "titulo": p.titulo,
        "unidade": unidade,
        "forma": forma,
        "anos": anos if forma in ("especies", "uf_clientela") else [edicao],
        "publicado_em": _data_br(p.datas.get("documentPublished")),
        "atualizado_em": _data_br(p.datas.get("documentModified")),
        "fonte": fonte,
        "notas": " ".join(p.rodape[1:]),
        "sha256_tabela": hashlib.sha256(conteudo.encode("utf-8")).hexdigest(),
        "linhas": linhas,
    }


def url_tabela(tid: str, edicao: int) -> str:
    return F.raiz_aeps(edicao) + "/" + F.TABELAS_AEPS[tid][0]


def _coletar_tabelas(edicao: int, tids) -> dict:
    tabelas = {}
    for tid in tids:
        url = url_tabela(tid, edicao)
        corpo, meta = baixar(url)
        t = ler_tabela(corpo.decode("utf-8"), tid, edicao)
        t.update({"url": url, "sha256": meta["sha256"], "bytes": meta["bytes"], "capturado_em": agora_utc()})
        tabelas[tid] = t
    return tabelas


def coletar_edicao(edicao: int) -> dict:
    """Baixa e lê as tabelas de uma edição. Falta de qualquer tabela levanta RuntimeError (a edição não está completa)."""
    tabelas = _coletar_tabelas(edicao, F.TABELAS_AEPS)
    return {
        "edicao": edicao,
        "anos": [edicao - 2, edicao - 1, edicao],
        "pagina": F.PAGINA_AEPS,
        "raiz": F.raiz_aeps(edicao),
        "capturado_em": agora_utc(),
        "tabelas": tabelas,
    }


def coletar_atendimento(edicao: int) -> dict:
    """Só as tabelas de atendimento e rede (43.1 e 43.2) de uma edição anterior: cada edição traz um único ano delas. A
    tabela declarada fora da série naquela edição (fontes.FORA_DA_SERIE_AEPS) não é coletada."""
    return {
        "edicao": edicao,
        "anos": [edicao],
        "pagina": F.PAGINA_AEPS,
        "raiz": F.raiz_aeps(edicao),
        "capturado_em": agora_utc(),
        "tabelas": _coletar_tabelas(edicao, F.tabelas_atendimento_aeps(edicao)),
    }


def _anteriores(edicao: int, anterior: dict | None) -> list[dict]:
    """Atendimento e rede das edições anteriores à principal, da primeira integrada até a véspera, recoletados. Se uma
    edição já publicada não responder, a captura anterior dela fica (com a data de captura original); se nunca foi
    capturada, fica de fora e a validação reprova a lacuna."""
    guardadas = {a["edicao"]: a for a in (anterior or {}).get("anteriores") or []}
    if anterior and isinstance(anterior.get("edicao"), int) and anterior["edicao"] < edicao:
        guardadas[anterior["edicao"]] = {  # a edição principal de antes passa a anterior, com as duas tabelas
            "edicao": anterior["edicao"], "anos": [anterior["edicao"]], "pagina": anterior.get("pagina", F.PAGINA_AEPS),
            "raiz": anterior.get("raiz"), "capturado_em": anterior.get("capturado_em"),
            "tabelas": {tid: anterior["tabelas"][tid] for tid in F.tabelas_atendimento_aeps(anterior["edicao"]) if tid in (anterior.get("tabelas") or {})},
        }
    out = []
    for e in range(F.PRIMEIRA_EDICAO_ATENDIMENTO_AEPS, edicao):
        try:
            out.append(coletar_atendimento(e))
        except RuntimeError as erro:
            print(f"AEPS {e} (atendimento) indisponível ({erro})", flush=True)
            if e in guardadas:
                out.append(guardadas[e])
    return out


def coletar_aeps(anterior: dict | None = None) -> dict:
    """Procura a edição seguinte à publicada; se ela ainda não existe no mesmo desenho, recoleta a publicada. Junta o
    atendimento e a rede das edições anteriores (43.1 e 43.2), que formam a série desses dois quadros."""
    atual = (anterior or {}).get("edicao") or F.PRIMEIRA_EDICAO_AEPS
    try:
        novo = coletar_edicao(atual + 1)
    except RuntimeError as e:  # 404 ou rede: a edição seguinte não está no ar nesse endereço
        print(f"AEPS {atual + 1} indisponível ({e}); recoletando a edição {atual}", flush=True)
        novo = coletar_edicao(atual)
    novo["anteriores"] = _anteriores(novo["edicao"], anterior)
    return novo
