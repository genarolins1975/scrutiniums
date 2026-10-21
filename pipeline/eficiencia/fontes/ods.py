"""Leitor mínimo de planilhas OpenDocument (.ods) com a biblioteca padrão.

Usado quando, no pacote do INEP, só a versão .ods confere com o MD5 publicado
(caso do ATU 2022: o .xlsx foi regravado depois do arquivo de MD5). Mesma
interface de xlsx.linhas: listas posicionais, número como float, vazio = None.
"""
import zipfile
import xml.etree.ElementTree as ET

T = "{urn:oasis:names:tc:opendocument:xmlns:table:1.0}"
O = "{urn:oasis:names:tc:opendocument:xmlns:office:1.0}"
X = "{urn:oasis:names:tc:opendocument:xmlns:text:1.0}"

# repetições enormes marcam o fim da planilha (células vazias até a coluna 1024 etc.)
_LIMITE_REPETICAO = 200


def _texto_celula(c):
    partes = []
    for p in c.iter(X + "p"):
        partes.append("".join(p.itertext()))
    return "\n".join(partes)


def linhas(caminho, aba=0):
    with zipfile.ZipFile(caminho) as zf:
        with zf.open("content.xml") as f:
            indice_aba = -1
            dentro = False
            for ev, el in ET.iterparse(f, events=("start", "end")):
                if ev == "start" and el.tag == T + "table":
                    indice_aba += 1
                    dentro = indice_aba == aba
                    continue
                if ev == "end" and el.tag == T + "table":
                    if dentro:
                        return
                    el.clear()
                    continue
                if not dentro or ev != "end" or el.tag != T + "table-row":
                    continue
                valores = []
                for c in el:
                    if c.tag not in (T + "table-cell", T + "covered-table-cell"):
                        continue
                    rep = int(c.get(T + "number-columns-repeated", "1"))
                    tipo = c.get(O + "value-type")
                    if tipo in ("float", "percentage", "currency"):
                        v = float(c.get(O + "value"))
                    elif tipo is None:
                        v = None
                    else:
                        v = _texto_celula(c)
                    if v is None and rep > _LIMITE_REPETICAO:
                        continue
                    valores.extend([v] * min(rep, _LIMITE_REPETICAO))
                while valores and valores[-1] is None:
                    valores.pop()
                rep_l = int(el.get(T + "number-rows-repeated", "1"))
                el.clear()
                if not valores:
                    if rep_l <= _LIMITE_REPETICAO:
                        for _ in range(rep_l):
                            yield []
                    continue
                for _ in range(min(rep_l, _LIMITE_REPETICAO)):
                    yield list(valores)
