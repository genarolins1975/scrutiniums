"""Leitores mínimos de planilhas (XLSX e XLS binário) para o módulo Inclusão energética.

Por que existem: o pipeline roda só com a biblioteca padrão e pyarrow, e três fontes
oficiais do módulo só publicam planilha:
- IBGE, POF 2017-2018: tabelas de coeficientes de variação (XLSX) e o tradutor da
  tabela de despesa geral dos microdados (XLS binário do Excel 97, formato BIFF8);
- EPE, PASI: exportação das localidades dos sistemas isolados (XLSX).

O leitor XLSX lê o XML do pacote (sharedStrings e planilhas). O leitor XLS lê o
arquivo composto OLE2, o fluxo "Workbook" e os registros BIFF8 de célula (texto da
tabela de strings, número, RK, MULRK, rótulo e resultado numérico de fórmula). Não
interpreta formatação nem datas: devolve texto ou número como estão no arquivo, e a
conversão fica com quem lê (a fonte é a autoridade sobre o conteúdo).

A leitura é conferida nos testes contra a mesma planilha lida por outra biblioteca
(xlrd, fora do pipeline) em amostras reais recortadas.
"""
import io
import re
import struct
import zipfile
import xml.etree.ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}


# ---------------------------------------------------------------- XLSX

def _indice_coluna(ref):
    letras = re.match(r"[A-Z]+", ref).group(0)
    n = 0
    for ch in letras:
        n = n * 26 + ord(ch) - 64
    return n - 1


def ler_xlsx(origem):
    """{nome_da_planilha: [[valor|None, ...], ...]} de um XLSX (caminho ou bytes).
    Linhas vazias são omitidas; cada linha vai até a última célula preenchida."""
    z = zipfile.ZipFile(io.BytesIO(origem) if isinstance(origem, (bytes, bytearray)) else origem)
    comp = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS):
            comp.append("".join(t.text or "" for t in si.iter("{%s}t" % NS["m"])))
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    alvo = {r.get("Id"): r.get("Target") for r in rels}
    out = {}
    for s in wb.find("m:sheets", NS):
        caminho = alvo[s.get("{%s}id" % NS["r"])].lstrip("/")
        if not caminho.startswith("xl/"):
            caminho = "xl/" + caminho
        raiz = ET.fromstring(z.read(caminho))
        linhas = []
        for row in raiz.iter("{%s}row" % NS["m"]):
            vals = {}
            for cel in row.findall("m:c", NS):
                v = cel.find("m:v", NS)
                tipo = cel.get("t")
                if v is None:
                    inl = cel.find("m:is", NS)
                    val = "".join(x.text or "" for x in inl.iter("{%s}t" % NS["m"])) if inl is not None else None
                elif tipo == "s":
                    val = comp[int(v.text)]
                else:
                    val = v.text
                vals[_indice_coluna(cel.get("r"))] = val
            if vals:
                linhas.append([vals.get(i) for i in range(max(vals) + 1)])
        out[s.get("name")] = linhas
    return out


# ---------------------------------------------------------------- XLS (BIFF8)

_MAGICO_OLE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
_FIM_CADEIA = 0xFFFFFFFE


def _fluxo_ole(dados, nomes=("Workbook", "Book")):
    """Conteúdo do fluxo `nomes` de um arquivo composto OLE2 (bytes)."""
    if dados[:8] != _MAGICO_OLE:
        raise ValueError("não é um arquivo composto OLE2 (XLS)")
    tam_setor = 1 << struct.unpack_from("<H", dados, 0x1E)[0]
    tam_mini = 1 << struct.unpack_from("<H", dados, 0x20)[0]
    n_fat, dir1 = struct.unpack_from("<II", dados, 0x2C)
    corte, mfat1, n_mfat, difat1, n_difat = struct.unpack_from("<IIIII", dados, 0x38)

    def setor(i):
        ini = (i + 1) * tam_setor
        return dados[ini:ini + tam_setor]

    # DIFAT: 109 entradas no cabeçalho + setores DIFAT encadeados
    difat = list(struct.unpack_from("<109I", dados, 0x4C))
    s = difat1
    for _ in range(n_difat):
        if s >= _FIM_CADEIA:
            break
        bloco = setor(s)
        n = tam_setor // 4
        vals = struct.unpack("<%dI" % n, bloco)
        difat.extend(vals[:-1])
        s = vals[-1]
    fat = []
    for s in difat[:n_fat]:
        if s >= _FIM_CADEIA:
            continue
        fat.extend(struct.unpack("<%dI" % (tam_setor // 4), setor(s)))

    def cadeia(inicio):
        out, s, vistos = [], inicio, set()
        while s < _FIM_CADEIA and s not in vistos:
            vistos.add(s)
            out.append(setor(s))
            s = fat[s]
        return b"".join(out)

    diretorio = cadeia(dir1)
    entradas = []
    for off in range(0, len(diretorio), 128):
        e = diretorio[off:off + 128]
        n = struct.unpack_from("<H", e, 64)[0]
        nome = e[:max(0, n - 2)].decode("utf-16-le", errors="replace")
        tipo = e[66]
        inicio, tamanho = struct.unpack_from("<II", e, 116)
        entradas.append((nome, tipo, inicio, tamanho))
    raiz = next((x for x in entradas if x[1] == 5), None)
    for nome, tipo, inicio, tamanho in entradas:
        if tipo == 2 and nome in nomes:
            if tamanho >= corte or raiz is None:
                return cadeia(inicio)[:tamanho]
            # fluxo pequeno: está no mini fluxo da entrada raiz
            mini = cadeia(raiz[2])
            mfat = []
            if n_mfat:
                bruto = cadeia(mfat1)
                mfat = list(struct.unpack("<%dI" % (len(bruto) // 4), bruto))
            out, s = [], inicio
            while s < _FIM_CADEIA and len(out) * tam_mini < tamanho:
                out.append(mini[s * tam_mini:(s + 1) * tam_mini])
                s = mfat[s]
            return b"".join(out)[:tamanho]
    raise ValueError("fluxo Workbook ausente no XLS")


def _registros_biff(fluxo):
    i, n = 0, len(fluxo)
    while i + 4 <= n:
        tipo, tam = struct.unpack_from("<HH", fluxo, i)
        yield i, tipo, fluxo[i + 4:i + 4 + tam]
        i += 4 + tam


def _rk(v):
    if v & 0x02:
        x = v >> 2
        if x & 0x20000000:  # inteiro de 30 bits com sinal
            x -= 0x40000000
        x = float(x)
    else:
        x = struct.unpack("<d", struct.pack("<Q", (v & 0xFFFFFFFC) << 32))[0]
    return x / 100.0 if v & 0x01 else x


def _sst(partes):
    """Tabela de strings compartilhadas (registro SST e seus CONTINUE). Uma string pode
    atravessar a fronteira de um CONTINUE; ali recomeça com um byte de opções que diz se
    o restante dos caracteres está em 8 ou 16 bits."""
    strings = []
    total_unicos = struct.unpack_from("<I", partes[0], 4)[0]
    idx_parte, pos = 0, 8
    dados = partes[0]

    def garantir(nbytes):
        nonlocal idx_parte, pos, dados
        if pos + nbytes <= len(dados):
            return
        if pos == len(dados) and idx_parte + 1 < len(partes):
            idx_parte += 1
            dados, pos = partes[idx_parte], 0

    def ler(nbytes):
        nonlocal pos
        garantir(nbytes)
        b = dados[pos:pos + nbytes]
        pos += nbytes
        return b

    while len(strings) < total_unicos:
        garantir(3)
        if pos >= len(dados):
            break
        nchar = struct.unpack("<H", ler(2))[0]
        opcoes = ler(1)[0]
        largo = opcoes & 0x01
        n_rt = struct.unpack("<H", ler(2))[0] if opcoes & 0x08 else 0
        n_ext = struct.unpack("<I", ler(4))[0] if opcoes & 0x04 else 0
        chars, falta = [], nchar
        while falta > 0:
            disp = len(dados) - pos
            if disp <= 0:
                idx_parte += 1
                dados, pos = partes[idx_parte], 0
                largo = dados[0] & 0x01  # opções do trecho continuado
                pos = 1
                continue
            por_char = 2 if largo else 1
            k = min(falta, disp // por_char)
            b = dados[pos:pos + k * por_char]
            pos += k * por_char
            chars.append(b.decode("utf-16-le") if largo else b.decode("latin-1"))
            falta -= k
        strings.append("".join(chars))
        pulo = 4 * n_rt + n_ext
        while pulo > 0:
            disp = len(dados) - pos
            if disp <= 0:
                idx_parte += 1
                dados, pos = partes[idx_parte], 0
                continue
            k = min(pulo, disp)
            pos += k
            pulo -= k
    return strings


def _texto_curto(b, off, tam_len=2):
    n = struct.unpack_from("<H" if tam_len == 2 else "<B", b, off)[0]
    off += tam_len
    opcoes = b[off]
    off += 1
    if opcoes & 0x01:
        return b[off:off + 2 * n].decode("utf-16-le")
    return b[off:off + n].decode("latin-1")


def ler_xls(origem):
    """{nome_da_planilha: [[valor|None, ...], ...]} de um XLS BIFF8 (caminho ou bytes).
    Números vêm como float; textos como str; células vazias como None."""
    if isinstance(origem, (bytes, bytearray)):
        dados = bytes(origem)
    else:
        with open(origem, "rb") as f:
            dados = f.read()
    fluxo = _fluxo_ole(dados)
    folhas, sst_partes, em_sst = [], [], False
    for off, tipo, corpo in _registros_biff(fluxo):
        if tipo == 0x85:  # BOUNDSHEET
            pos_bof = struct.unpack_from("<I", corpo, 0)[0]
            folhas.append((_texto_curto(corpo, 6, tam_len=1), pos_bof, corpo[5]))
        elif tipo == 0xFC:
            sst_partes, em_sst = [corpo], True
        elif tipo == 0x3C and em_sst:
            sst_partes.append(corpo)
        else:
            em_sst = False
        if tipo == 0x0A and folhas:  # EOF do bloco global
            break
    sst = _sst(sst_partes) if sst_partes else []
    out = {}
    for nome, pos_bof, tipo_folha in folhas:
        if tipo_folha != 0:  # só planilhas de dados
            continue
        celulas = {}
        pendente = None
        for off, tipo, corpo in _registros_biff(fluxo[pos_bof:]):
            if tipo == 0x0A:
                break
            if tipo == 0xFD:
                r, c, _, i = struct.unpack_from("<HHHI", corpo, 0)
                celulas[(r, c)] = sst[i] if i < len(sst) else None
            elif tipo == 0x203:
                r, c, _, v = struct.unpack_from("<HHHd", corpo, 0)
                celulas[(r, c)] = v
            elif tipo == 0x27E:
                r, c, _, v = struct.unpack_from("<HHHI", corpo, 0)
                celulas[(r, c)] = _rk(v)
            elif tipo == 0xBD:
                r, c0 = struct.unpack_from("<HH", corpo, 0)
                n = (len(corpo) - 6) // 6
                for k in range(n):
                    _, v = struct.unpack_from("<HI", corpo, 4 + 6 * k)
                    celulas[(r, c0 + k)] = _rk(v)
            elif tipo == 0x204:
                r, c, _ = struct.unpack_from("<HHH", corpo, 0)
                celulas[(r, c)] = _texto_curto(corpo, 6)
            elif tipo == 0x06:
                r, c, _ = struct.unpack_from("<HHH", corpo, 0)
                res = corpo[6:14]
                if res[6:8] == b"\xff\xff":
                    if res[0] == 0:  # resultado texto: vem no registro STRING seguinte
                        pendente = (r, c)
                    elif res[0] == 1:
                        celulas[(r, c)] = float(res[2])
                else:
                    celulas[(r, c)] = struct.unpack("<d", res)[0]
            elif tipo == 0x207 and pendente is not None:
                celulas[pendente] = _texto_curto(corpo, 0)
                pendente = None
        por_linha = {}
        for (r, c), v in celulas.items():
            por_linha.setdefault(r, {})[c] = v
        linhas = []
        for r in sorted(por_linha):
            cols = por_linha[r]
            linhas.append([cols.get(c) for c in range(max(cols) + 1)])
        out[nome] = linhas
    return out
