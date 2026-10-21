"""Leitura das planilhas de consumo de energia elétrica da EPE para o módulo Mercado.

Duas publicações oficiais da EPE, lidas por caminhos independentes:

1. Dados abertos do consumo mensal (Dados_abertos_Consumo_Mensal.xlsx, dicionário
   Consumo-Mensal-Dicionario-de-Dados.pdf): tabelas longas "CONSUMO E NUMCONS SAM"
   (região × subsistema × classe × tipo de consumidor, jan/2004 até o último mês) e
   "CONSUMO E NUMCONS SAM UF" (o mesmo por UF, até o penúltimo mês). Tipo de consumidor
   é "Cativo" ou "Livre"; consumo em MWh; consumidores = número de unidades consumidoras
   (UC: instalações com um só ponto de entrega e medição individualizada, correspondentes
   a um único consumidor, na definição da Resolução ANEEL 83/2004 citada pelo dicionário).
2. Planilha formatada "CONSUMO MENSAL DE ENERGIA ELÉTRICA POR CLASSE.xlsx": blocos por
   ano com a linha nacional (TOTAL BRASIL, TOTAL CATIVO, TOTAL LIVRE e o número de
   consumidores) e o asterisco que a EPE usa para marcar dado preliminar.

A segunda serve para conferir a primeira: a soma das linhas da tabela longa tem de dar o
total nacional que a EPE publica na planilha formatada, mês a mês.

O arquivo de dados abertos tem 14 MB compactados e planilhas de dezenas de MB em XML; o
leitor percorre o XML em fluxo (iterparse) e libera cada linha depois de lida, para não
carregar a planilha inteira na memória. Não interpreta formatação: devolve o texto ou o
número como está na célula, e a conversão fica com quem lê.
"""
import io
import re
import zipfile
import xml.etree.ElementTree as ET
from datetime import date, timedelta

M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

ABA_SAM = "CONSUMO E NUMCONS SAM"
ABA_SAM_UF = "CONSUMO E NUMCONS SAM UF"
COLUNAS_SAM = ("Data", "Regiao", "Sistema", "Classe", "TipoConsumidor", "Consumo", "Consumidores", "DataVersao")
COLUNAS_SAM_UF = COLUNAS_SAM + ("UF",)

# Nome do subsistema na fonte → código do observatório (o mesmo do PLD e do ONS).
SISTEMAS = {"SUDESTE / CENTRO - OESTE": "SE", "SUL": "S", "NORDESTE": "NE", "NORTE INTERLIGADO": "N",
            "SISTEMAS ISOLADOS": "ISOL"}
REGIOES = ("Norte", "Nordeste", "Sudeste", "Sul", "Centro-Oeste")
CLASSES = ("Residencial", "Industrial", "Comercial", "Rural", "Outros")
TIPOS = {"Cativo": "cativo", "Livre": "livre"}
UFS = ("AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR",
       "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO")

# Planilha formatada: aba → rótulo do total nacional na primeira linha do bloco anual. As abas
# de consumidores livres não têm rótulo na linha nacional (célula vazia), por isso a linha
# nacional é sempre a primeira depois do cabeçalho de meses, e o rótulo só é conferido quando
# a EPE o publica.
ABAS_PLANILHA = {
    "TOTAL": ("total_mwh", "TOTAL BRASIL"),
    "CATIVO": ("cativo_mwh", "TOTAL CATIVO"),
    "LIVRE": ("livre_mwh", "TOTAL LIVRE"),
    "CONSUMIDORES TOTAIS": ("total_uc", "NC TOTAIS"),
    "CONSUMIDORES CATIVOS": ("cativo_uc", "TOTAL CATIVO"),
    "CONSUMIDORES LIVRES": ("livre_uc", ""),
}
MESES_ABREV = ("JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ")


class EsquemaInesperado(ValueError):
    """A planilha chegou com colunas, abas ou rótulos diferentes dos verificados: nada é lido."""


# ---------------------------------------------------------------- leitor XLSX em fluxo

def _indice_coluna(ref):
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group(0):
        n = n * 26 + ord(ch) - 64
    return n - 1


def _zip(origem):
    if isinstance(origem, (bytes, bytearray)):
        return zipfile.ZipFile(io.BytesIO(origem))
    return zipfile.ZipFile(origem)


def abas_xlsx(origem):
    """Nomes das planilhas, na ordem do arquivo."""
    z = _zip(origem)
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    return [s.get("name") for s in wb.find(M + "sheets")]


def linhas_xlsx(origem, aba):
    """Itera as linhas de uma planilha como listas (texto, número em texto ou None), em fluxo.
    Linhas vazias são omitidas; cada linha vai até a última célula preenchida."""
    z = _zip(origem)
    compartilhadas = []
    if "xl/sharedStrings.xml" in z.namelist():
        with z.open("xl/sharedStrings.xml") as f:
            for _, el in ET.iterparse(f):
                if el.tag == M + "si":
                    compartilhadas.append("".join(t.text or "" for t in el.iter(M + "t")))
                    el.clear()
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    alvo = {r.get("Id"): r.get("Target") for r in rels}
    caminho = None
    for s in wb.find(M + "sheets"):
        if s.get("name") == aba:
            caminho = alvo[s.get(R + "id")].lstrip("/")
            caminho = caminho if caminho.startswith("xl/") else "xl/" + caminho
            break
    if caminho is None:
        raise EsquemaInesperado(f"aba ausente: {aba!r}")
    with z.open(caminho) as f:
        for _, el in ET.iterparse(f):
            if el.tag != M + "row":
                continue
            vals = {}
            for cel in el.findall(M + "c"):
                tipo = cel.get("t")
                if tipo == "inlineStr":
                    x = "".join(t.text or "" for t in cel.iter(M + "t"))
                else:
                    v = cel.find(M + "v")
                    if v is None:
                        continue
                    x = compartilhadas[int(v.text)] if tipo == "s" else v.text
                vals[_indice_coluna(cel.get("r"))] = x
            if vals:
                yield [vals.get(i) for i in range(max(vals) + 1)]
            el.clear()


# ---------------------------------------------------------------- conversões

def numero(txt):
    """Número da célula ('49156745.605999999') → float; vazio é ausência (None), nunca zero."""
    if txt is None:
        return None
    s = str(txt).strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def data_excel(serial):
    """Número de série do Excel (1 = 1900-01-01, com o falso 29/02/1900) → 'AAAA-MM-DD'."""
    n = numero(serial)
    if n is None:
        return None
    return (date(1899, 12, 30) + timedelta(days=int(n))).isoformat()


def mes_de(aaaammdd):
    s = str(aaaammdd or "").strip()
    if not re.fullmatch(r"\d{8}", s):
        return None
    return f"{s[:4]}-{s[4:6]}"


# ---------------------------------------------------------------- dados abertos (tabela longa)

def linhas_consumo_sam(origem, por_uf=False, contagem=None):
    """Linhas da tabela longa como dicts normalizados:
    {mes, regiao, sistema, classe, tipo, consumo_mwh, ucs, versao[, uf]}.

    Esquema conferido na chegada: coluna, região, subsistema, classe, tipo e UF fora do
    domínio do dicionário interrompem a leitura (EsquemaInesperado) em vez de virar uma
    categoria nova em silêncio. Consumo e consumidores vazios ficam None."""
    contagem = contagem if contagem is not None else {}
    aba = ABA_SAM_UF if por_uf else ABA_SAM
    exigidas = COLUNAS_SAM_UF if por_uf else COLUNAS_SAM
    cab = None
    for linha in linhas_xlsx(origem, aba):
        if cab is None:
            cab = [str(x or "").strip() for x in linha]
            faltam = [c for c in exigidas if c not in cab]
            if faltam:
                raise EsquemaInesperado(f"{aba}: colunas ausentes {faltam}; recebidas {cab}")
            continue
        r = dict(zip(cab, linha))
        mes = mes_de(r.get("Data"))
        regiao, sistema = (r.get("Regiao") or "").strip(), (r.get("Sistema") or "").strip()
        classe, tipo = (r.get("Classe") or "").strip(), (r.get("TipoConsumidor") or "").strip()
        if mes is None:
            raise EsquemaInesperado(f"{aba}: data fora do formato AAAAMMDD: {r.get('Data')!r}")
        if regiao not in REGIOES or sistema not in SISTEMAS or classe not in CLASSES or tipo not in TIPOS:
            raise EsquemaInesperado(f"{aba}: categoria fora do dicionário: {regiao!r} {sistema!r} {classe!r} {tipo!r}")
        out = {"mes": mes, "regiao": regiao, "sistema": SISTEMAS[sistema], "classe": classe, "tipo": TIPOS[tipo],
               "consumo_mwh": numero(r.get("Consumo")), "ucs": numero(r.get("Consumidores")),
               "versao": data_excel(r.get("DataVersao"))}
        if por_uf:
            uf = (r.get("UF") or "").strip()
            if uf not in UFS:
                raise EsquemaInesperado(f"{aba}: UF fora do domínio: {uf!r}")
            out["uf"] = uf
        contagem["linhas"] = contagem.get("linhas", 0) + 1
        if out["consumo_mwh"] is None:
            contagem["consumo_vazio"] = contagem.get("consumo_vazio", 0) + 1
        if out["ucs"] is None:
            contagem["consumidores_vazio"] = contagem.get("consumidores_vazio", 0) + 1
        yield out
    if cab is None:
        raise EsquemaInesperado(f"{aba}: planilha vazia")


def chave_serie(linha, medida):
    """Série do silver: 'c|<regiao>|<sistema>|<classe>|<tipo>' (consumo, MWh) e 'n|...'
    (unidades consumidoras); por UF, 'uc|<uf>|<sistema>|<classe>|<tipo>' e 'un|...'."""
    if "uf" in linha:
        prefixo = "uc" if medida == "consumo" else "un"
        return f"{prefixo}|{linha['uf']}|{linha['sistema']}|{linha['classe']}|{linha['tipo']}"
    prefixo = "c" if medida == "consumo" else "n"
    return f"{prefixo}|{linha['regiao']}|{linha['sistema']}|{linha['classe']}|{linha['tipo']}"


def decompoe_serie(serie):
    """Inverso de chave_serie: (medida, dict de dimensões) ou None para série desconhecida."""
    partes = serie.split("|")
    if len(partes) != 5 or partes[0] not in ("c", "n", "uc", "un"):
        return None
    medida = "consumo" if partes[0] in ("c", "uc") else "ucs"
    chave = "uf" if partes[0] in ("uc", "un") else "regiao"
    return medida, {chave: partes[1], "sistema": partes[2], "classe": partes[3], "tipo": partes[4]}


# ---------------------------------------------------------------- planilha formatada (conferência)

def totais_planilha(origem):
    """Linha nacional de cada aba da planilha formatada.

    Retorna {"series": {medida: {AAAA-MM: valor}}, "anos_preliminares": [AAAA], "atualizacao":
    'AAAA-MM-DD'|None}. O ano marcado com asterisco no cabeçalho é preliminar pela EPE."""
    series, preliminares, atualizacao = {}, set(), None
    for aba, (medida, rotulo) in ABAS_PLANILHA.items():
        serie = series.setdefault(medida, {})
        ano, aguardando_total = None, False
        for linha in linhas_xlsx(origem, aba):
            primeira = (linha[0] or "").strip() if linha and isinstance(linha[0], str) else ""
            if primeira.startswith("*Dados preliminares"):
                m = re.search(r"(\d{4}-\d{2}-\d{2})", primeira)
                if m:
                    atualizacao = m.group(1)
                continue
            anos = [str(x).strip() for x in linha[1:13] if x not in (None, "")]
            if anos and all(re.fullmatch(r"\d{4}\*?", a) for a in anos):
                ano = anos[0].rstrip("*")
                if any(a.endswith("*") for a in anos):
                    preliminares.add(ano)
                continue
            if [str(x or "").strip().upper() for x in linha[1:4]] == list(MESES_ABREV[:3]):
                aguardando_total = ano is not None
                continue
            if aguardando_total:
                aguardando_total = False
                if rotulo and primeira != rotulo:
                    raise EsquemaInesperado(f"{aba} {ano}: linha nacional com rótulo {primeira!r}, esperado {rotulo!r}")
                for i in range(12):
                    v = numero(linha[i + 1]) if i + 1 < len(linha) else None
                    if v is not None:
                        serie[f"{ano}-{i + 1:02d}"] = v
        if not serie:
            raise EsquemaInesperado(f"{aba}: nenhuma linha nacional reconhecida")
    return {"series": series, "anos_preliminares": sorted(preliminares), "atualizacao": atualizacao}
