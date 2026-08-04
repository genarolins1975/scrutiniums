"""Estatísticas Municipais da Previdência Social (MPS/INSS) — benefícios por município.

Fonte: Ministério da Previdência Social, seção "Emitidos por Municípios".
https://www.gov.br/previdencia/pt-br/assuntos/previdencia-social/emitidos-municipios-2023

Dois arquivos por ano, ambos XLSX e legíveis com a biblioteca padrão:

* `ben_municipios_especie_{ano}.xlsx` — quantidade e valor por grupo de espécie, com
  quatro abas (quantidade de dezembro, valor de dezembro, valor médio, valor do ano).
* `ben_municipios_clientela_{ano}.xlsx` — quantidade e valor separando clientela urbana
  e rural, **apenas do RGPS** (sem assistenciais), numa aba só.

Três definições, todas verificadas na documentação oficial, que determinam como cada
número é nomeado na página. Ver docs/AUDITORIA_CONSIGNADO.md.

**1. O município é o do ÓRGÃO PAGADOR, não o de residência.** A página oficial diz
"classificados de acordo com o município do órgão pagador" e o rodapé da própria planilha
repete: "Não necessariamente refletem o município de residência do beneficiários". O
efeito é grande — há município com 78% de benefícios sobre a população e município com
0,23%, porque a agência de um polo regional paga os beneficiários das cidades vizinhas.
Nenhum indicador municipal daqui é lido como "renda previdenciária do município" sem o
selo de confiabilidade que mede exatamente esse desvio.

**2. O valor é LÍQUIDO de descontos.** "O Valor dos benefícios emitidos corresponde ao
valor líquido (diferença entre valor bruto e descontos)". Isso é decisivo para esta aba:
o empréstimo consignado é descontado na folha, então **o consignado já saiu deste
número**. Um município com mais consignado aparece aqui com valor menor, não maior. O
indicador é sempre chamado de "valor líquido de benefícios emitidos", jamais de renda
previdenciária, e nunca é usado como medida de exposição ao consignado.

**3. É EMITIDO, não pago.** São créditos encaminhados à rede bancária, não crédito
sacado. Não incluem os Pagamentos Alternativos de Benefícios. E a quantidade conta
**créditos**, não pessoas nem benefícios ativos: um benefício pode gerar mais de um
crédito na mesma competência. Contagem de beneficiários por município não existe em
nenhuma fonte pública — só por unidade da federação, no Anuário.

Periodicidade **anual**: cada arquivo traz a posição de dezembro e o acumulado do ano.
O abono anual entra nas competências de agosto e novembro, então dezembro não contém
décimo terceiro, mas o acumulado do ano sim.
"""
import re
import zipfile
import io
import xml.etree.ElementTree as ET

from pipeline import common

BASE = "https://www.gov.br/previdencia/pt-br/assuntos/previdencia-social/arquivos"
ANOS = (2022, 2023, 2024, 2025)

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
NS_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

# Rótulos de coluna, normalizados, e o campo a que correspondem. O cabeçalho muda de
# linha e de grafia entre as safras — "Nome " tem espaço à direita, "Munícipio" vem com
# erro de grafia no arquivo de clientela — então o casamento é por texto normalizado e
# não por posição.
COLUNAS_ESPECIE = {
    "codigo ibge": "cod", "cod ibge": "cod",
    "total de aposentadorias": "aposentadorias",
    "aposentadorias por idade": "apo_idade",
    "aposentadorias por invalidez": "apo_invalidez",
    "aposentadorias por tempo de contribuicao": "apo_tempo",
    "pensoes por morte": "pensoes",
    "auxilios": "auxilios",
    "outros beneficios previdenciarios": "outros_prev",
    "total de beneficios previdenciarios": "total_prev",
    "beneficios assistenciais e de legislacao especifica": "assistenciais",
    "total": "total",
    "populacao no municipio": "populacao",
}
COLUNAS_CLIENTELA = {
    "codigo ibge": "cod", "cod ibge": "cod",
    "total": "cli_total", "urbano": "cli_urbano", "rural": "cli_rural",
}


def _norm(s):
    s = (s or "").strip().lower()
    for a, b in (("á", "a"), ("à", "a"), ("ã", "a"), ("â", "a"), ("é", "e"), ("ê", "e"),
                 ("í", "i"), ("ó", "o"), ("ô", "o"), ("õ", "o"), ("ú", "u"), ("ç", "c")):
        s = s.replace(a, b)
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s)).strip()


def _col(ref):
    """'BC12' -> 'BC'."""
    return re.match(r"([A-Z]+)", ref).group(1)


def _abas(z):
    """[(nome, caminho)] na ordem do workbook, resolvendo os rels."""
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = {r.get("Id"): r.get("Target")
            for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    out = []
    for sh in wb.find(f"{NS}sheets"):
        alvo = rels.get(sh.get(f"{NS_REL}id"), "")
        if alvo.startswith("/"):
            alvo = alvo[1:]
        elif not alvo.startswith("xl/"):
            alvo = "xl/" + alvo
        out.append((sh.get("name"), alvo))
    return out


def _linhas(z, caminho, shared):
    """Gera {coluna: valor} por linha. Células ausentes simplesmente não aparecem —
    as linhas do XLSX são esparsas, então indexar por posição corromperia o mapeamento."""
    for _, el in ET.iterparse(io.BytesIO(z.read(caminho)), events=("end",)):
        if el.tag != f"{NS}row":
            continue
        linha = {}
        for c in el.findall(f"{NS}c"):
            ref = c.get("r")
            if not ref:
                continue
            t, v = c.get("t"), c.find(f"{NS}v")
            if t == "s" and v is not None:
                val = shared[int(v.text)]
            elif t == "inlineStr":
                istr = c.find(f"{NS}is")
                val = "".join(x.text or "" for x in istr.iter(f"{NS}t")) if istr is not None else None
            else:
                val = v.text if v is not None else None
            if val is not None:
                linha[_col(ref)] = val
        el.clear()
        if linha:
            yield linha


def _shared(z):
    if "xl/sharedStrings.xml" not in z.namelist():
        return []
    raiz = ET.fromstring(z.read("xl/sharedStrings.xml"))
    return ["".join(t.text or "" for t in si.iter(f"{NS}t")) for si in raiz.findall(f"{NS}si")]


def _num(v):
    """Ausência é nulo, nunca zero. `#N/A` e texto de rodapé viram nulo."""
    if v is None:
        return None
    s = str(v).strip().replace(",", ".")
    if not s or s.startswith("#"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _coluna_do_codigo(linhas):
    """Descobre a coluna do código do IBGE pelo CONTEÚDO, não pelo rótulo.

    O arquivo de clientela de 2024 rotula a coluna A como "Código IBGE" e a B como
    "Município", mas os dados estão invertidos: o nome está em A e o código em B. Confiar
    no cabeçalho perderia o ano inteiro em silêncio. Contar quantos valores de sete
    dígitos cada coluna tem é imune a esse tipo de erro do publicador.
    """
    contagem = {}
    for linha in linhas:
        for cel, v in linha.items():
            if re.fullmatch(r"\d{7}", str(v).strip()):
                contagem[cel] = contagem.get(cel, 0) + 1
    if not contagem:
        return None
    cel, n = max(contagem.items(), key=lambda kv: kv[1])
    return cel if n >= 1000 else None


def _mapa_colunas(linhas, dicionario):
    """Devolve {coluna_excel: campo}, acumulando rótulos por todo o bloco de cabeçalho.

    O cabeçalho do arquivo de espécies ocupa **três linhas mescladas**: a primeira traz
    nome, código, UF e os totais das pontas; a segunda, os grupos de espécie
    (aposentadorias, pensões, auxílios, outros, total previdenciário); a terceira, os
    subtotais de aposentadoria por idade, invalidez e tempo de contribuição. Ler uma
    linha só devolveria quatro colunas de catorze — foi exatamente o que aconteceu na
    primeira versão, e o total previdenciário ficou nulo em todos os anos.

    O bloco de cabeçalho termina onde começam os dados, detectados pela primeira linha em
    que a coluna do código traz sete dígitos.
    """
    col_cod = _coluna_do_codigo(linhas)
    achou = {}
    for linha in linhas:
        if col_cod and re.fullmatch(r"\d{7}", str(linha.get(col_cod, "")).strip()):
            break
        for cel, txt in linha.items():
            campo = dicionario.get(_norm(txt))
            if campo and campo != "cod":
                achou[cel] = campo
    if col_cod:
        achou[col_cod] = "cod"
    return achou if len(achou) >= 3 else None


def _ensure(con):
    con.executescript("""
    CREATE TABLE IF NOT EXISTS prev_mun(
        ano INTEGER, cod_ibge TEXT,
        aposentadorias REAL, apo_idade REAL, apo_invalidez REAL, apo_tempo REAL,
        pensoes REAL, auxilios REAL, outros_prev REAL, total_prev REAL,
        assistenciais REAL, total REAL, populacao REAL,
        valor_dez REAL, valor_ano REAL, valor_medio REAL,
        PRIMARY KEY(ano, cod_ibge));
    CREATE TABLE IF NOT EXISTS prev_clientela(
        ano INTEGER, cod_ibge TEXT,
        qtd_total REAL, qtd_urbano REAL, qtd_rural REAL,
        vdez_total REAL, vdez_urbano REAL, vdez_rural REAL,
        vano_total REAL, vano_urbano REAL, vano_rural REAL,
        PRIMARY KEY(ano, cod_ibge));
    CREATE TABLE IF NOT EXISTS prev_coleta(
        ano INTEGER PRIMARY KEY, municipios INTEGER, total_beneficios REAL,
        valor_dez REAL, brasil_beneficios REAL, brasil_valor REAL, collected_at TEXT);
    """)


def _le_especie(body):
    """Devolve {cod_ibge: {campos}} do arquivo de espécies, e a linha BRASIL."""
    z = zipfile.ZipFile(io.BytesIO(body))
    shared = _shared(z)
    abas = _abas(z)
    dados, brasil = {}, {}

    # A ordem das abas é estável mesmo quando o nome está errado — em 2025 a aba de valor
    # médio se chama "Valor_Médio_R$_dez24" num arquivo de 2025. Por isso o papel de cada
    # aba vem da posição, e o nome só serve de conferência.
    papeis = ["quantidade", "valor_dez", "valor_medio", "valor_ano"]
    # Índice nome -> código, montado a partir das abas que trazem o código preenchido.
    # A aba de quantidade é lida por último justamente para poder usá-lo.
    por_nome = {}
    ordem = sorted(range(len(abas[:len(papeis)])), key=lambda i: papeis[i] == "quantidade")
    for i in ordem:
        nome_aba, caminho_pre = abas[i]
        linhas_pre = list(_linhas(z, caminho_pre, shared))
        mapa_pre = _mapa_colunas(linhas_pre, COLUNAS_ESPECIE)
        if not mapa_pre:
            continue
        cc = _coluna_do_codigo(linhas_pre) or next((c for c, f in mapa_pre.items() if f == "cod"), "")
        cn = "A" if cc != "A" else "B"
        for linha in linhas_pre:
            cod = str(linha.get(cc, "")).strip()
            if re.fullmatch(r"\d{7}", cod):
                por_nome.setdefault(_norm(linha.get(cn)), cod)

    for i, (nome, caminho) in enumerate(abas[:len(papeis)]):
        papel = papeis[i]
        linhas = list(_linhas(z, caminho, shared))
        mapa = _mapa_colunas(linhas, COLUNAS_ESPECIE)
        if not mapa:
            continue
        col_cod = _coluna_do_codigo(linhas) or next((c for c, f in mapa.items() if f == "cod"), "")
        col_nome = "A" if col_cod != "A" else "B"
        for linha in linhas:
            cod = str(linha.get(col_cod, "")).strip()
            if not re.fullmatch(r"\d{7}", cod):
                # Boa Esperança do Norte/MT vem com o código em branco na aba de
                # quantidade e preenchido nas de valor. Recupera pelo nome, que é único
                # nesse arquivo; sem isso a soma nacional erra por 346 benefícios.
                cod = por_nome.get(_norm(linha.get(col_nome)), "")
                if not re.fullmatch(r"\d{7}", cod):
                    continue
            alvo = dados.setdefault(cod, {})
            for cel, campo in mapa.items():
                if campo == "cod":
                    continue
                v = _num(linha.get(cel))
                if v is None:
                    continue
                if papel == "quantidade":
                    alvo[campo] = v
                elif campo == "total":
                    alvo[{"valor_dez": "valor_dez", "valor_medio": "valor_medio",
                          "valor_ano": "valor_ano"}[papel]] = v
        # a linha BRASIL não tem código de 7 dígitos (traz #N/A); serve de reconciliação
        for linha in linhas:
            nomes = [str(v).strip().upper() for v in linha.values()]
            if "BRASIL" in nomes:
                for cel, campo in mapa.items():
                    if campo == "total":
                        v = _num(linha.get(cel))
                        if v is not None:
                            brasil[papel] = v
                break
    return dados, brasil


def _le_clientela(body):
    """Lê o arquivo de clientela urbana e rural.

    O cabeçalho é mesclado em dois níveis e ocupa duas linhas: numa está "Código IBGE",
    na seguinte estão nove rótulos Total/Urbano/Rural, três para quantidade, três para o
    valor de dezembro e três para o valor do ano. Casar rótulo com campo dentro de uma
    linha só devolveria trios ambíguos, então o código encontra as duas linhas e toma as
    nove colunas na ordem das colunas do Excel.

    Cobre apenas o **RGPS**: a nota de rodapé do arquivo diz que "os dados refletem
    somente os benefícios que pertencem ao Regime Geral de Previdência Social", ou seja,
    sem assistenciais. Os totais daqui não batem com os do arquivo de espécies, e não
    devem bater.
    """
    z = zipfile.ZipFile(io.BytesIO(body))
    shared = _shared(z)
    linhas = list(_linhas(z, _abas(z)[0][1], shared))

    col_cod, trio = _coluna_do_codigo(linhas), []
    for linha in linhas:
        achados = [cel for cel, v in linha.items() if _norm(v) in ("total", "urbano", "rural")]
        if len(achados) >= 9:
            trio = sorted(achados, key=lambda c: (len(c), c))[:9]
            break
    if not col_cod or len(trio) < 9:
        return {}

    campos = ["qtd_total", "qtd_urbano", "qtd_rural",
              "vdez_total", "vdez_urbano", "vdez_rural",
              "vano_total", "vano_urbano", "vano_rural"]
    out = {}
    for linha in linhas:
        cod = str(linha.get(col_cod, "")).strip()
        if not re.fullmatch(r"\d{7}", cod):
            continue
        out[cod] = {c: _num(linha.get(cel)) for c, cel in zip(campos, trio)}
    return out


def collect(con, cfg=None):
    _ensure(con)
    results = []
    for ano in ANOS:
        ja = con.execute("SELECT municipios FROM prev_coleta WHERE ano=?", (ano,)).fetchone()
        if ja and ja[0] >= 5500:
            results.append({"key": f"previdencia:{ano}", "ok": True, "note": "já absorvido"})
            continue
        try:
            url = f"{BASE}/ben_municipios_especie_{ano}.xlsx"
            # Accept precisa ser */*: o gov.br devolve 401 para binário pedido como JSON.
            body, meta = common.http_get(url, timeout=600, accept="*/*")
            _, sha = common.save_bronze("previdencia", f"especie_{ano}", body, {**meta, "url": url})
            dados, brasil = _le_especie(body)
            if not dados:
                results.append({"key": f"previdencia:{ano}", "ok": False, "error": "layout não reconhecido"})
                continue
            for cod, e in dados.items():
                con.execute("""INSERT OR REPLACE INTO prev_mun VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                            (ano, cod, e.get("aposentadorias"), e.get("apo_idade"),
                             e.get("apo_invalidez"), e.get("apo_tempo"), e.get("pensoes"),
                             e.get("auxilios"), e.get("outros_prev"), e.get("total_prev"),
                             e.get("assistenciais"), e.get("total"), e.get("populacao"),
                             e.get("valor_dez"), e.get("valor_ano"), e.get("valor_medio")))
            common.record_lineage(con, "consignado.json", f"bronze/previdencia/especie_{ano}", sha,
                                  "MPS Estatísticas Municipais -> benefícios emitidos por grupo de "
                                  "espécie (valor LÍQUIDO, município do ÓRGÃO PAGADOR)")

            cli = {}
            try:
                url_c = f"{BASE}/ben_municipios_clientela_{ano}.xlsx"
                body_c, meta_c = common.http_get(url_c, timeout=600, accept="*/*")
                common.save_bronze("previdencia", f"clientela_{ano}", body_c, {**meta_c, "url": url_c})
                cli = _le_clientela(body_c)
                for cod, e in cli.items():
                    con.execute("INSERT OR REPLACE INTO prev_clientela VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                                (ano, cod, e.get("qtd_total"), e.get("qtd_urbano"), e.get("qtd_rural"),
                                 e.get("vdez_total"), e.get("vdez_urbano"), e.get("vdez_rural"),
                                 e.get("vano_total"), e.get("vano_urbano"), e.get("vano_rural")))
            except Exception as e:
                results.append({"key": f"previdencia:clientela:{ano}", "ok": False, "error": str(e)[:150]})

            soma_q = sum(e.get("total") or 0 for e in dados.values())
            soma_v = sum(e.get("valor_dez") or 0 for e in dados.values())
            con.execute("INSERT OR REPLACE INTO prev_coleta VALUES(?,?,?,?,?,?,?)",
                        (ano, len(dados), soma_q, soma_v,
                         brasil.get("quantidade"), brasil.get("valor_dez"), common.now_utc()))
            con.commit()
            results.append({"key": f"previdencia:{ano}", "ok": True, "municipios": len(dados),
                            "clientela": len(cli), "beneficios": int(soma_q),
                            "brasil_publicado": int(brasil.get("quantidade") or 0),
                            "diferenca": int(soma_q - (brasil.get("quantidade") or soma_q))})
        except Exception as e:
            results.append({"key": f"previdencia:{ano}", "ok": False, "error": str(e)[:250]})
    return results
