"""Leitura do caderno de dados do Plano Decenal de Expansão de Energia (EPE).

O PDE publica, junto com o relatório, um .zip com uma planilha por capítulo e uma aba
por figura ou tabela. Este leitor usa só a biblioteca padrão (o .xlsx é um zip de XML,
como no coletor da EPAE) e extrai as figuras que o módulo Expansão publica.

Cada figura é conferida pelo título da aba e pelos rótulos das colunas: se a EPE
renomear uma coluna ou trocar a figura de lugar numa edição futura, a leitura falha
alto em vez de publicar números na coluna errada. O resultado é sempre CENÁRIO: o
PDE é um plano indicativo de uma edição específica, nunca realizado.
"""
import io
import re
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from datetime import date, timedelta

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
RNS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

# Figuras publicadas (edição 2035). "arquivo" é um trecho do nome da planilha dentro
# do zip; "colunas" são os rótulos esperados na linha de cabeçalho, na ordem.
FIGURAS_PDE2035 = {
    "fig_3_6": {
        "arquivo": "Capítulo 03", "aba": "Figura 3-6",
        "titulo": "Evolução da capacidade instalada existente e contratada do SIN",
        "unidade": "GW", "chave": "Ano",
        "colunas": ["BIOMASSA", "CARVAO", "DIESEL / ÓLEO", "EOLICA", "Solar", "GAS", "NUCLEAR", "PCH", "PCT", "UHE"],
        "pagina": 73,
        "nota": "Caso Base: oferta existente e contratada, sem expansão indicativa. A unidade (GW) está no título da aba. A coluna Solar inclui a micro e minigeração distribuída (MMGD), conforme o texto da página 73 do relatório.",
    },
    "fig_3_23": {
        "arquivo": "Capítulo 03", "aba": "Figura 3-23",
        "titulo": "Expansão indicativa acumulada no horizonte de 2026 a 2035",
        "unidade": "MW", "chave": "Ano",
        "colunas": ["Hidro (MW)", "Eólica (MW)", "Solar (MW)", "UTE Flex (MW)", "UTE Inflex (MW)", "UTE Bio (MW)",
                    "Nuclear (MW)", "Armazenamento (MW)", "RD (MW)", "Total (MW)"],
        "pagina": 94,
        "nota": "Expansão indicativa do Cenário de Referência, acumulada desde 2026, além do Caso Base. RD é resposta da demanda, não geração.",
    },
    "fig_3_25": {
        "arquivo": "Capítulo 03", "aba": "Figura 3-25",
        "titulo": "Participação das fontes na matriz elétrica nacional em 2025 e 2035",
        "unidade": "GW", "chave": "Mês",
        "colunas": ["UHE (GW)", "PCH (GW)", "Biomassa (GW)", "Eólica (GW)", "Solar fotovoltaica (GW)", "MMGD (GW)",
                    "UTE (GW)", "Baterias (GW)", "RD (GW)"],
        "pagina": 97,
        "nota": "Capacidade instalada em dezembro de 2025 (ponto de partida do plano) e em dezembro de 2035 (Cenário de Referência). O relatório rotula os totais como 249 GW e 359 GW.",
    },
    "fig_4_19": {
        "arquivo": "Capítulo 04", "aba": "Figura 4-19",
        "titulo": "Cenários de expansão do sistema de transmissão",
        "unidade": "R$ bilhões", "chave": "Ano",
        "colunas": ["Otimista (R$ bilhões)", "Referência (R$ bilhões)", "Pessimista (R$ bilhões)"],
        "pagina": None,
        "nota": "Investimento acumulado em transmissão por cenário, em reais bilhões conforme publicado pela EPE (sem correção pelo observatório).",
    },
    "fig_4_24": {
        "arquivo": "Capítulo 04", "aba": "Figura 4-24",
        "titulo": "Cenários de referência: Expansão física de LTs",
        "unidade": "km", "chave": "Ano",
        "colunas": ["230 kV (km)", "345 kV (km)", "440 kV (km)", "500 kV (km)", "800 kV (km)", "Total (km)"],
        "pagina": None,
        "nota": "Extensão acumulada de novas linhas de transmissão no cenário de referência, por nível de tensão.",
    },
    "fig_4_27": {
        "arquivo": "Capítulo 04", "aba": "Figura 4-27",
        "titulo": "Cenários de referência: expansão física de SEs",
        "unidade": "MVA", "chave": "Ano",
        "colunas": ["230 kV (MVA)", "345 kV (MVA)", "440 kV (MVA)", "500 kV (MVA)", "800 kV (MVA)", "Total (MVA)"],
        "pagina": None,
        "nota": "Capacidade acumulada de transformação em novas subestações no cenário de referência, por nível de tensão.",
    },
    "fig_12_4": {
        "arquivo": "Capítulo 12", "aba": "Figura 12-4",
        "titulo": "Geração total de eletricidade por fonte no horizonte decenal",
        "unidade": "TWh", "chave": "Ano",
        "colunas": None,  # 13 colunas com rótulos longos; conferidas pelo sufixo (TWh)
        "pagina": None,
        "nota": "Energia gerada (TWh), grandeza diferente da capacidade (GW). Hidráulica inclui a parcela importada de Itaipu; Outros inclui Sistemas Isolados e RSU (notas da aba).",
    },
}


def _sem_acento(s):
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()


class Planilha:
    """Leitor mínimo de .xlsx (valores e textos compartilhados; sem fórmulas)."""

    def __init__(self, dados):
        self.z = zipfile.ZipFile(io.BytesIO(dados))
        try:
            raiz = ET.fromstring(self.z.read("xl/sharedStrings.xml"))
            self.ss = ["".join(t.text or "" for t in si.iter(f"{NS}t")) for si in raiz]
        except KeyError:
            self.ss = []
        wb = ET.fromstring(self.z.read("xl/workbook.xml"))
        rels = ET.fromstring(self.z.read("xl/_rels/workbook.xml.rels"))
        alvo = {r.get("Id"): r.get("Target") for r in rels}
        self.abas = {}
        for s in wb.iter(f"{NS}sheet"):
            t = alvo[s.get(f"{RNS}id")].lstrip("/")
            self.abas[s.get("name")] = t if t.startswith("xl/") else "xl/" + t

    def linhas(self, aba):
        """[(número da linha, {coluna: valor texto})] da aba, na ordem."""
        raiz = ET.fromstring(self.z.read(self.abas[aba]))
        out = []
        for row in raiz.iter(f"{NS}row"):
            cel = {}
            for c in row.iter(f"{NS}c"):
                col = "".join(ch for ch in (c.get("r") or "") if ch.isalpha())
                v = c.find(f"{NS}v")
                val = v.text if v is not None else None
                if c.get("t") == "s" and val is not None:
                    val = self.ss[int(val)]
                elif c.get("t") == "inlineStr":
                    val = "".join(x.text or "" for x in c.iter(f"{NS}t"))
                if val not in (None, ""):
                    cel[col] = val
            out.append((int(row.get("r")), cel))
        return out


def data_excel(serial):
    """Número de série do Excel (sistema 1900) → date."""
    return date(1899, 12, 30) + timedelta(days=int(float(serial)))


def _colunas_ordenadas(cel):
    def chave(c):
        n = 0
        for ch in c:
            n = n * 26 + (ord(ch) - 64)
        return n
    return sorted(cel, key=chave)


def extrai_figura(planilha, spec):
    """Lê uma aba de figura do PDE: título na linha 3, cabeçalho na primeira linha cuja
    coluna A é o rótulo da chave, dados até a primeira linha vazia, notas depois."""
    if spec["aba"] not in planilha.abas:
        raise RuntimeError(f"aba {spec['aba']!r} ausente: o caderno de dados mudou")
    linhas = planilha.linhas(spec["aba"])
    titulo = next((c.get("B") for _, c in linhas if c.get("A") == spec["aba"]), None)
    # a aba pode acrescentar a unidade ao título do índice, ex.: "... do SIN (GW)"
    if not _sem_acento(titulo or "").strip().lower().startswith(_sem_acento(spec["titulo"]).strip().lower()):
        raise RuntimeError(f"{spec['aba']}: título {titulo!r} difere do esperado {spec['titulo']!r}")
    i_cab = next((i for i, (_, c) in enumerate(linhas) if c.get("A") == spec["chave"]), None)
    if i_cab is None:
        raise RuntimeError(f"{spec['aba']}: cabeçalho com {spec['chave']!r} não encontrado")
    cab = linhas[i_cab][1]
    cols = [c for c in _colunas_ordenadas(cab) if c != "A"]
    rotulos = [cab[c].strip() for c in cols]
    if spec["colunas"] is not None and rotulos != spec["colunas"]:
        raise RuntimeError(f"{spec['aba']}: colunas {rotulos} diferem das esperadas {spec['colunas']}")
    if spec["colunas"] is None and not all(r.endswith(f"({spec['unidade']})") for r in rotulos):
        raise RuntimeError(f"{spec['aba']}: colunas sem a unidade {spec['unidade']}: {rotulos}")
    dados, notas = [], []
    for _, c in linhas[i_cab + 1:]:
        if not c:
            if dados:
                break
            continue
        chave = c.get("A")
        if chave is None:
            continue
        if spec["chave"] == "Mês":
            ref = data_excel(chave).isoformat()[:7]
        else:
            if not re.fullmatch(r"\d{4}", str(chave).strip()):
                break
            ref = str(chave).strip()
        valores = {}
        for col, rot in zip(cols, rotulos):
            v = c.get(col)
            valores[rot] = float(v) if v is not None else None
        dados.append({"ref": ref, "valores": valores})
    for _, c in linhas:
        a = c.get("A") or ""
        if re.match(r"\(\d+\)|Nota", a):
            notas.append(a.strip())
    if not dados:
        raise RuntimeError(f"{spec['aba']}: nenhuma linha de dados")
    return {"titulo": titulo, "colunas": rotulos, "linhas": dados, "notas": notas}


def data_atualizacao(planilha):
    """Data 'Atualizado em' da aba Índice (número de série do Excel) → ISO."""
    for _, c in planilha.linhas("Índice"):
        if (c.get("A") or "").startswith("Atualizado em") and c.get("B"):
            try:
                return data_excel(c["B"]).isoformat()
            except ValueError:
                return None
    return None


def extrai_pde2035(dados_zip):
    """Zip 'PDE 2035_Dados_Relatório Final' → {figura: dados, '_atualizacao': {...}}."""
    z = zipfile.ZipFile(io.BytesIO(dados_zip))
    planilhas = {}
    out = {"_atualizacao": {}, "_arquivos": {}}
    for chave, spec in FIGURAS_PDE2035.items():
        nome = next((n for n in z.namelist() if spec["arquivo"] in n and n.lower().endswith(".xlsx")), None)
        if nome is None:
            raise RuntimeError(f"planilha do {spec['arquivo']} ausente no zip do PDE")
        if nome not in planilhas:
            planilhas[nome] = Planilha(z.read(nome))
            out["_atualizacao"][spec["arquivo"]] = data_atualizacao(planilhas[nome])
        out["_arquivos"][chave] = nome
        out[chave] = {**extrai_figura(planilhas[nome], spec), "unidade": spec["unidade"], "aba": spec["aba"],
                      "pagina": spec["pagina"], "nota": spec["nota"], "arquivo": nome}
    return out
