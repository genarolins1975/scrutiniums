"""Leitor mínimo de planilhas .xlsx com a biblioteca padrão (zip + XML).

As planilhas da ANP e do Banco Mundial são lidas como texto: o valor de cada célula
vem como a fonte gravou (número em ponto decimal, data como número serial do Excel
ou texto). Não há interpretação de estilos; conversões ficam com quem chama.
"""
import re
import zipfile
from datetime import date, timedelta
from xml.etree import ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
_COL = re.compile(r"^([A-Z]+)")


def _indice_coluna(ref):
    letras = _COL.match(ref).group(1)
    n = 0
    for ch in letras:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def _texto(no):
    return "".join(t.text or "" for t in no.iter(f"{{{NS['m']}}}t"))


def abas(caminho):
    """Nomes das abas, na ordem do arquivo."""
    with zipfile.ZipFile(caminho) as z:
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        return [s.get("name") for s in wb.find("m:sheets", NS)]


def linhas(caminho, aba=None):
    """Itera as linhas de uma aba (por nome; a primeira se omitida) como listas de texto."""
    with zipfile.ZipFile(caminho) as z:
        nomes = z.namelist()
        compart = []
        if "xl/sharedStrings.xml" in nomes:
            raiz = ET.fromstring(z.read("xl/sharedStrings.xml"))
            compart = [_texto(si) for si in raiz.findall("m:si", NS)]
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        alvo = {r.get("Id"): r.get("Target") for r in rels}
        folhas = wb.find("m:sheets", NS)
        escolhida = None
        for s in folhas:
            if aba is None or s.get("name") == aba:
                escolhida = s
                break
        if escolhida is None:
            raise KeyError(f"aba não encontrada: {aba}")
        destino = alvo[escolhida.get(f"{{{NS['r']}}}id")].lstrip("/")
        destino = destino if destino.startswith("xl/") else "xl/" + destino
        with z.open(destino) as f:
            for _, el in ET.iterparse(f):
                if el.tag != f"{{{NS['m']}}}row":
                    continue
                valores = {}
                for c in el.findall("m:c", NS):
                    tipo = c.get("t")
                    v = c.find("m:v", NS)
                    if tipo == "s" and v is not None:
                        val = compart[int(v.text)]
                    elif tipo == "inlineStr":
                        val = _texto(c)
                    else:
                        val = v.text if v is not None else ""
                    valores[_indice_coluna(c.get("r"))] = val
                el.clear()
                if not valores:
                    yield []
                    continue
                yield [valores.get(i, "") for i in range(max(valores) + 1)]


def data_serial(v):
    """Número serial do Excel (sistema 1900) para date."""
    return date(1899, 12, 30) + timedelta(days=int(float(v)))
