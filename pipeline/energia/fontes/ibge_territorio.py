"""Malha municipal do IBGE para o índice territorial: nomes, pontos e correspondências.

Por que existe: o índice territorial (módulo territorio) liga ao município IBGE coisas
que a fonte publica de jeitos diferentes. Distribuidora e conjunto elétrico já chegam
com o código IBGE (relação da ANEEL processada pelos módulos Perdas e Qualidade); a usina
do SIGA chega com o NOME do município e a UF ("Nova Lima - MG") e com uma coordenada
aproximada; a localidade isolada do PASI (EPE) chega com nome de município, UF e
coordenada. Este arquivo concentra as regras dessas ligações:

1. nome → código: igualdade exata do nome normalizado (sem acento, maiúsculas, apóstrofo
   e hífen viram espaço) dentro da mesma UF, contra a lista de municípios do IBGE que
   acompanha a malha publicada (public/energia/geo/municipios.json, API de localidades
   v1). Nomes são únicos dentro de uma UF, então a igualdade é inequívoca. Não há
   aproximação por semelhança: o que não é igual fica sem vínculo e é listado;
2. grafias antigas: uma tabela explícita, versionada aqui, com a origem de cada linha numa
   Divisão Territorial Brasileira (DTB) do IBGE que trazia o mesmo código com a grafia
   que a fonte ainda usa (o código IBGE não muda quando o nome muda);
3. ponto → município: ponto em polígono contra a malha municipal do IBGE em qualidade
   MÁXIMA (API de malhas v4, uma consulta por UF, coordenadas em graus), sem
   simplificação. A malha publicada pelo observatório para desenhar o mapa parte da
   qualidade "mínima" do IBGE e ainda é simplificada a 400 m: numa amostra de 25 usinas
   que ela dava como fora do município declarado, 7 estavam dentro na malha máxima. Por
   isso a conferência usa a máxima e só recorre à publicada (marcando o resultado como
   aproximado) quando a máxima de alguma UF não foi capturada. Serve só para CONFERIR a
   declaração da fonte: a coordenada do SIGA é um centróide aproximado; nunca substitui o
   município declarado.
"""
import gzip
import json
import re
import unicodedata
from collections import defaultdict

from pipeline.energia import geo

# Grafias antigas que as fontes ainda usam (SIGA da ANEEL; arquivo do Luz para Todos do MME),
# com a prova de que o código IBGE é o mesmo: (uf, nome como a fonte escreve, código IBGE,
# origem). Em cada linha, a DTB citada traz exatamente esse nome com esse código (o código
# do município não muda quando o nome muda). Os arquivos da DTB foram baixados em
# 01/10/2026 de geoftp.ibge.gov.br (sha256 no documento do módulo) e conferidos linha a
# linha; o teste do módulo confere que cada código existe na malha atual, na mesma UF.
DTB_2010 = "IBGE, Divisão Territorial Brasileira 2010 (dtb_2010.zip, dtb_2010.xls, planilha Município)"
DTB_2005 = "IBGE, Divisão Territorial Brasileira 2005 (dtb_2005.zip, DTB 2005.xls, planilha NomeNormal)"
DTB_2000 = "IBGE, Divisão Territorial Brasileira 2000 (dtb_2000.zip, DTB - 2000.xls, nível 5 = município)"
TOPONIMOS = (
    # citadas pelo SIGA
    ("RN", "Açu", "2400208", DTB_2010),
    ("RN", "Arês", "2401206", DTB_2010),
    ("BA", "Muquém de São Francisco", "2922250", DTB_2010),
    ("SP", "Embu", "3515004", DTB_2010),
    ("SP", "Moji Mirim", "3530805", DTB_2010),
    ("MT", "Poxoréo", "5107008", DTB_2010),
    ("MT", "Santo Antônio do Leverger", "5107800", DTB_2010),
    ("PE", "Lagoa do Itaenga", "2608503", DTB_2005),
    ("RJ", "Trajano de Morais", "3305901", DTB_2005),
    ("RS", "Santana do Livramento", "4317103", DTB_2005),
    ("SP", "Moji das Cruzes", "3530607", DTB_2000),
    # citadas pelo arquivo do Luz para Todos sem código IBGE
    ("PA", "Eldorado dos Carajás", "1502954", DTB_2010),
    ("PA", "Santa Isabel do Pará", "1506500", DTB_2010),
    ("CE", "Itapagé", "2306306", DTB_2010),
    ("RJ", "Parati", "3303807", DTB_2005),
    ("BA", "Santa Teresinha", "2928505", DTB_2010),
    ("PE", "Belém de São Francisco", "2601607", DTB_2005),
    ("SP", "São Luís do Paraitinga", "3550001", DTB_2010),
    ("TO", "Couto de Magalhães", "1706001", DTB_2005),
    ("RN", "Augusto Severo", "2401305", DTB_2010),
    ("TO", "São Valério da Natividade", "1720499", DTB_2005),
    ("MG", "Brasópolis", "3108909", DTB_2010),
    ("PB", "Seridó", "2515401", DTB_2010),
    ("PE", "Iguaraci", "2606903", DTB_2010),
    ("PB", "São Domingos de Pombal", "2513968", DTB_2005),
    ("RN", "Presidente Juscelino", "2410306", DTB_2010),
    ("SP", "Florínia", "3516101", DTB_2010),
)


# Códigos IBGE das UFs (os dois primeiros dígitos do código de município)
CODIGOS_UF = {
    "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
    "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA",
    "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS",
    "50": "MS", "51": "MT", "52": "GO", "53": "DF",
}
URL_MALHA_MAXIMA = ("https://servicodados.ibge.gov.br/api/v4/malhas/estados/{cod}"
                    "?formato=application/json&intrarregiao=municipio&qualidade=maxima")
DOC_MALHAS = "https://servicodados.ibge.gov.br/api/docs/malhas?versao=4"


def normaliza(texto):
    """Forma de comparação de nome de município: sem acento, maiúsculas, apóstrofo e
    hífen como espaço, espaços simples. "Sant'Ana do Livramento" e "SANT ANA DO
    LIVRAMENTO" são iguais; "Santana do Livramento" não (é outra grafia)."""
    s = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode()
    s = s.replace("'", " ").replace("`", " ").replace("´", " ").replace("-", " ")
    return re.sub(r"\s+", " ", s).strip().upper()


def le_malha(caminho):
    """Malha publicada (municipios.json): metadados e features {id, nome, uf, d}."""
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


class IndiceNomes:
    """Nome normalizado + UF → código IBGE, com a tabela de grafias antigas."""

    def __init__(self, features, toponimos=TOPONIMOS):
        self.por_nome = {}
        self.nome = {}
        self.uf = {}
        for f in features:
            chave = (f["uf"], normaliza(f["nome"]))
            if chave in self.por_nome:
                raise ValueError(f"nome repetido na mesma UF: {chave}")
            self.por_nome[chave] = f["id"]
            self.nome[f["id"]] = f["nome"]
            self.uf[f["id"]] = f["uf"]
        self.antigos = {}
        for uf, nome_fonte, codigo, origem in toponimos:
            if codigo not in self.nome or self.uf[codigo] != uf:
                raise ValueError(f"grafia antiga aponta para código fora da malha ou de outra UF: {uf} {nome_fonte} {codigo}")
            self.antigos[(uf, normaliza(nome_fonte))] = (codigo, origem)

    def codigo(self, nome, uf):
        """(código, via) com via 'nome_atual' ou 'grafia_antiga'; (None, None) sem vínculo."""
        chave = (uf, normaliza(nome))
        if chave in self.por_nome:
            return self.por_nome[chave], "nome_atual"
        if chave in self.antigos:
            return self.antigos[chave][0], "grafia_antiga"
        return None, None


_LISTA_SIGA = re.compile(r"^(.*?)\s*-\s*([A-Z]{2})$")


def municipios_siga(texto):
    """'Irineópolis - SC, Porto União - SC' → [('Irineópolis', 'SC'), ('Porto União', 'SC')].
    Parte sem ' - UF' no fim (ex.: 'Não Informado') volta como (texto, None)."""
    out = []
    for parte in (texto or "").split(","):
        parte = parte.strip()
        if not parte:
            continue
        m = _LISTA_SIGA.match(parte)
        out.append((m.group(1).strip(), m.group(2)) if m else (parte, None))
    return out


# ---------------------------------------------------------------- pontos e polígonos

def projeta(lon, lat, origem):
    """(lon, lat) em graus → (x, y) inteiros na grade da malha publicada (mesma projeção
    Albers, mesma origem e grade de 100 m de pipeline/energia/geo.py)."""
    return geo.quantiza(geo.albers(lon, lat), origem)


def _dentro(px, py, anel):
    """Paridade de cruzamentos (raio horizontal); anel sem repetir o primeiro vértice."""
    c = False
    n = len(anel)
    j = n - 1
    for i in range(n):
        xi, yi = anel[i]
        xj, yj = anel[j]
        if (yi > py) != (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi) + xi:
            c = not c
        j = i
    return c


class IndicePoligonos:
    """Ponto em polígono contra a malha publicada, com grade de caixas para não testar
    os 5.571 municípios a cada ponto. Anéis internos (buracos) contam pela paridade."""

    CELULA = 500  # unidades da malha (100 m): células de 50 km

    def __init__(self, features):
        self.feats = []
        self.grade = {}
        for f in features:
            aneis = geo.le_caminho_svg(f["d"])
            xs = [p[0] for a in aneis for p in a]
            ys = [p[1] for a in aneis for p in a]
            caixa = (min(xs), min(ys), max(xs), max(ys))
            i = len(self.feats)
            self.feats.append((f["id"], aneis, caixa))
            for cx in range(caixa[0] // self.CELULA, caixa[2] // self.CELULA + 1):
                for cy in range(caixa[1] // self.CELULA, caixa[3] // self.CELULA + 1):
                    self.grade.setdefault((cx, cy), []).append(i)

    def localiza(self, x, y):
        """Códigos IBGE cujos polígonos contêm (x, y) na grade da malha (0 ou 1, raramente 2)."""
        out = []
        for i in self.grade.get((x // self.CELULA, y // self.CELULA), ()):
            fid, aneis, cx = self.feats[i]
            if cx[0] <= x <= cx[2] and cx[1] <= y <= cx[3]:
                if sum(1 for a in aneis if _dentro(x, y, a)) % 2 == 1:
                    out.append(fid)
        return out


# ---------------------------------------------------------------- malha de qualidade máxima (graus)

def corpo_sem_gzip(corpo):
    """A API do IBGE responde com gzip mesmo quando não pedido, e o bronze ainda comprime:
    abre as camadas gzip sobrepostas (assinatura 1f 8b) até o JSON."""
    while corpo[:2] == b"\x1f\x8b":
        corpo = gzip.decompress(corpo)
    return corpo


class PoligonosMaxima:
    """Ponto em polígono em graus (lon, lat) contra a malha de qualidade máxima de uma UF
    (TopoJSON da API de malhas v4). Cada município guarda as suas arestas repartidas em
    faixas horizontais: o teste da paridade só percorre as arestas da faixa do ponto, o
    que mantém o custo baixo mesmo com dezenas de milhares de vértices por município. Em
    graus, a reta entre dois vértices consecutivos (poucos metros) é a mesma da projeção."""

    FAIXAS = 64
    CELULA = 0.25  # graus: grade de caixas para achar os municípios candidatos

    def __init__(self, topo):
        dec = geo.decodifica_topologia(topo)
        arcos = dec["arcos"]
        self.mun = {}
        self.grade = defaultdict(list)
        for itens in dec["objetos"].values():
            for g in itens:
                aneis = [geo.monta_anel(anel, arcos) for pol in g["poligonos"] for anel in pol]
                xs = [p[0] for a in aneis for p in a]
                ys = [p[1] for a in aneis for p in a]
                if not xs:
                    continue
                cx = (min(xs), min(ys), max(xs), max(ys))
                altura = (cx[3] - cx[1]) / self.FAIXAS or 1e-9
                faixas = [[] for _ in range(self.FAIXAS)]
                for anel in aneis:
                    n = len(anel)
                    for i in range(n):
                        x1, y1 = anel[i - 1]
                        x2, y2 = anel[i]
                        if y1 == y2:
                            continue  # aresta horizontal nunca cruza o raio
                        b0 = min(self.FAIXAS - 1, int((min(y1, y2) - cx[1]) / altura))
                        b1 = min(self.FAIXAS - 1, int((max(y1, y2) - cx[1]) / altura))
                        for b in range(b0, b1 + 1):
                            faixas[b].append((x1, y1, x2, y2))
                self.mun[g["id"]] = (cx, altura, faixas)
                for gx in range(int(cx[0] // self.CELULA), int(cx[2] // self.CELULA) + 1):
                    for gy in range(int(cx[1] // self.CELULA), int(cx[3] // self.CELULA) + 1):
                        self.grade[(gx, gy)].append(g["id"])

    def contem(self, cod, lon, lat):
        """True/False quando o município está nesta UF; None quando não está."""
        x = self.mun.get(cod)
        if x is None:
            return None
        cx, altura, faixas = x
        if not (cx[0] <= lon <= cx[2] and cx[1] <= lat <= cx[3]):
            return False
        b = min(self.FAIXAS - 1, int((lat - cx[1]) / altura))
        dentro = False
        for x1, y1, x2, y2 in faixas[b]:
            if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
                dentro = not dentro
        return dentro

    def localiza(self, lon, lat):
        """Códigos dos municípios desta UF que contêm o ponto (0 ou 1; 2 só em sobreposição da malha)."""
        cand = self.grade.get((int(lon // self.CELULA), int(lat // self.CELULA)), ())
        return [cod for cod in cand if self.contem(cod, lon, lat)]
