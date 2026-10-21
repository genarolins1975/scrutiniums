"""Leitor mínimo de planilhas .xlsx com a biblioteca padrão.

O INEP publica Ideb, média de alunos por turma e taxas de rendimento em .xlsx.
O leitor percorre a planilha em fluxo (iterparse), resolve strings
compartilhadas e devolve cada linha como lista posicional (célula vazia = None),
sem interpretar formatos: números saem como float e o texto como está.
"""
import re
import zipfile
import xml.etree.ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
NS_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
_COL = re.compile(r"([A-Z]+)")


def _indice_coluna(ref):
    letras = _COL.match(ref).group(1)
    n = 0
    for ch in letras:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def _strings(zf):
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    out = []
    with zf.open("xl/sharedStrings.xml") as f:
        for _, el in ET.iterparse(f):
            if el.tag == NS + "si":
                out.append("".join(t.text or "" for t in el.iter(NS + "t")))
                el.clear()
    return out


def _caminho_planilha(zf, nome=None):
    wb = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    alvo = {r.get("Id"): r.get("Target") for r in rels}
    folhas = [(s.get("name"), s.get(NS_REL + "id")) for s in wb.iter(NS + "sheet")]
    if not folhas:
        raise ValueError("planilha sem abas")
    escolhida = folhas[0] if nome is None else next(f for f in folhas if f[0] == nome)
    t = alvo[escolhida[1]].lstrip("/")
    return t if t.startswith("xl/") else "xl/" + t


def nomes_abas(caminho):
    with zipfile.ZipFile(caminho) as zf:
        wb = ET.fromstring(zf.read("xl/workbook.xml"))
        return [s.get("name") for s in wb.iter(NS + "sheet")]


def linhas(caminho, aba=None):
    """Itera as linhas da aba (a primeira, por padrão) como listas posicionais."""
    with zipfile.ZipFile(caminho) as zf:
        sst = _strings(zf)
        with zf.open(_caminho_planilha(zf, aba)) as f:
            for _, el in ET.iterparse(f):
                if el.tag != NS + "row":
                    continue
                valores = {}
                for c in el.iter(NS + "c"):
                    ref = c.get("r")
                    tipo = c.get("t")
                    v = c.find(NS + "v")
                    if tipo == "inlineStr":
                        txt = "".join(t.text or "" for t in c.iter(NS + "t"))
                        valores[_indice_coluna(ref)] = txt
                        continue
                    if v is None or v.text is None:
                        continue
                    if tipo == "s":
                        valores[_indice_coluna(ref)] = sst[int(v.text)]
                    elif tipo in ("str", "e"):
                        valores[_indice_coluna(ref)] = v.text
                    elif tipo == "b":
                        valores[_indice_coluna(ref)] = v.text == "1"
                    else:
                        valores[_indice_coluna(ref)] = float(v.text)
                el.clear()
                if not valores:
                    yield []
                    continue
                largura = max(valores) + 1
                yield [valores.get(i) for i in range(largura)]
