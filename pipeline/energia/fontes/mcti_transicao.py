"""MCTI: fatores de emissão de CO2 da geração de energia elétrica no SIN (planilhas oficiais).

Há três famílias de fator, com usos diferentes, publicadas em séries separadas:

1. Fator médio (inventários): "calcula a média das emissões da geração, levando em
   consideração todas as usinas que estão gerando energia e não somente aquelas que
   estejam funcionando na margem" (página do MCTI). Mensal e anual, tCO2/MWh.
2. Margem de operação pelo método da análise de despacho (MDL): reflete as usinas
   despachadas na margem; mensal, diária e horária. Uso exclusivo em projetos de MDL.
3. Margem de construção (MDL): intensidade das últimas usinas construídas; anual.
   E a margem de operação pelo método simples ajustado, anual, em página HTML.

Onde obter (verificado em 30/09/2026):
- www.gov.br/mcti/.../sirene/dados-e-ferramentas/fatores-de-emissao (página vigente): 23
  planilhas visíveis (inventário 2006 a ago/2026, uma planilha do MDL por ano de 2006 a
  2026 e o método simples ajustado de 2006 a 2025) e 13 âncoras sem texto, invisíveis ao
  leitor, que apontam para versões antigas e não são lidas (planilhas_publicadas). A
  página às vezes responde com um desafio de verificação humana ("This question is for
  testing whether you are a human visitor", com support ID), para a página e para os
  arquivos: não é contornado; a tentativa fica registrada em `coletas` com o support ID
  e vale a última captura válida. Em 30/09/2026 o coletor do pipeline, com a sua própria
  identificação, recebeu a página em três pedidos entre 22h28 e 22h48 UTC.
- antigo.mctic.gov.br/mctic/opencms/ciencia/SEPED/clima/textogeral/*.html (site
  institucional anterior do MCTI, servido pela origem): planilhas de 2006 a 2021 do
  fator médio e da margem de operação e construção, e a tabela do método simples
  ajustado. Serve de comparação com a página vigente.

As planilhas não seguem um leiaute fixo (a coluna do valor anual e da margem de
construção muda de ano para ano), então o parser procura rótulos e nomes de mês, e
confere domínio (0 < fator < 2 tCO2/MWh) e datas (dia 29/02 em ano não bissexto vem
preenchido com 0 e é descartado como data inexistente, nunca lido como fator zero).
Lemos XLSX com a biblioteca padrão (zip + XML) para não depender de openpyxl.
"""
import calendar
import html as html_mod
import io
import re
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from datetime import date
from urllib.parse import urljoin

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro",
         "outubro", "novembro", "dezembro"]
URL_PAGINA_ATUAL = "https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/sirene/dados-e-ferramentas/fatores-de-emissao"
BASE_ANTIGO = "https://antigo.mctic.gov.br"
URL_ANTIGO_INVENTARIO = f"{BASE_ANTIGO}/mctic/opencms/ciencia/SEPED/clima/textogeral/emissao_corporativos.html"
URL_ANTIGO_DESPACHO = f"{BASE_ANTIGO}/mctic/opencms/ciencia/SEPED/clima/textogeral/emissao_despacho.html"
URL_ANTIGO_AJUSTADO = f"{BASE_ANTIGO}/mctic/opencms/ciencia/SEPED/clima/textogeral/emissao_ajustado.html"
LIMITE_FATOR = 2.0  # tCO2/MWh: acima disso não é fator de rede (a térmica a carvão fica perto de 1)


def _sem_acento(s):
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower().strip()


def le_xlsx(corpo):
    """{aba: [(linha, {coluna: texto})]} de um XLSX (bytes). Valores numéricos ficam como
    texto exatamente como gravados (ex.: '3.2300000000000002E-2')."""
    z = zipfile.ZipFile(io.BytesIO(corpo))
    compart = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS):
            compart.append("".join(t.text or "" for t in si.iter(f"{{{NS['m']}}}t")))
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    alvos = {r.get("Id"): r.get("Target") for r in rels}
    out = {}
    for aba in wb.find("m:sheets", NS):
        alvo = alvos[aba.get(f"{{{NS['r']}}}id")].lstrip("/")
        alvo = alvo if alvo.startswith("xl/") else "xl/" + alvo
        folha = ET.fromstring(z.read(alvo))
        linhas = []
        for row in folha.iter(f"{{{NS['m']}}}row"):
            celulas = {}
            for c in row.findall("m:c", NS):
                col = re.match(r"[A-Z]+", c.get("r")).group(0)
                t, v = c.get("t"), c.find("m:v", NS)
                if t == "s" and v is not None:
                    val = compart[int(v.text)]
                elif t == "inlineStr":
                    val = "".join(x.text or "" for x in c.iter(f"{{{NS['m']}}}t"))
                else:
                    val = v.text if v is not None else None
                if val is not None and str(val).strip() != "":
                    celulas[col] = str(val)
            linhas.append((int(row.get("r")), celulas))
        out[aba.get("name")] = linhas
    return out


def numero(v):
    """float de uma célula numérica; None para texto, vazio ou não numérico."""
    if v is None:
        return None
    s = str(v).strip().replace("\xa0", "")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _ordem_col(col):
    n = 0
    for ch in col:
        n = n * 26 + (ord(ch) - 64)
    return n


def _colunas_de_mes(celulas):
    """[(coluna, mês 1..12)] na ordem das colunas, se a linha tem nomes de mês."""
    achados = []
    for col in sorted(celulas, key=_ordem_col):
        nome = _sem_acento(celulas[col])
        if nome in MESES:
            achados.append((col, MESES.index(nome) + 1))
    return achados


def _meses_posicionais(cols, contexto, problemas):
    """[(coluna, mês)] para as 12 primeiras colunas com nome de mês. Quando as 12 colunas
    são contíguas, o mês vale pela posição (janeiro na primeira) e um rótulo divergente
    vira registro de problema: nas planilhas de 2015 e 2016 a coluna de julho do bloco
    diário está rotulada "Maio", e ler pelo rótulo apagaria maio com os dados de julho.
    Colunas não contíguas: só o rótulo vale, e rótulo repetido anula o bloco."""
    doze = cols[:12]
    if len(doze) < 12:
        return []
    ordens = [_ordem_col(c) for c, _ in doze]
    if ordens == list(range(ordens[0], ordens[0] + 12)):
        for pos, (col, mes) in enumerate(doze, start=1):
            if mes != pos:
                problemas.append(f"{contexto}: coluna {col} rotulada {MESES[mes - 1]} na posição de {MESES[pos - 1]}; lida pela posição")
        return [(col, pos) for pos, (col, _) in enumerate(doze, start=1)]
    if len({m for _, m in doze}) != 12:
        problemas.append(f"{contexto}: meses repetidos em colunas não contíguas; bloco ignorado")
        return []
    return doze


def _ano_da_linha(celulas):
    v = celulas.get("A")
    m = re.fullmatch(r"\s*(\d{4})\s*", v or "")
    return int(m.group(1)) if m else None


def _valida(v):
    return v is not None and 0 <= v < LIMITE_FATOR


def parse_inventario(planilha):
    """Fator médio mensal e anual (tCO2/MWh) da planilha de inventários.

    Retorna {"mensal": {"AAAA-MM": v}, "anual": {"AAAA": v}, "problemas": [...]}.
    Blocos por ano: linha com o ano na coluna A, linha com os nomes dos meses (e o fator
    anual na coluna à direita dos meses) e linha com os fatores mensais."""
    out = {"mensal": {}, "anual": {}, "problemas": []}
    for _, linhas in planilha.items():
        ano = None
        for i, (_, cel) in enumerate(linhas):
            a = _ano_da_linha(cel)
            if a:
                ano = a
                continue
            cols = _colunas_de_mes(cel)
            if len(cols) < 12 or ano is None:
                continue
            meses = _meses_posicionais(cols, f"inventário {ano}", out["problemas"])
            if not meses:
                continue
            prox = linhas[i + 1][1] if i + 1 < len(linhas) else {}
            for col, mes in meses:
                v = numero(prox.get(col))
                if v is None:
                    continue
                if not _valida(v):
                    out["problemas"].append(f"{ano}-{mes:02d}: fator fora do domínio ({v})")
                    continue
                out["mensal"][f"{ano}-{mes:02d}"] = v
            ultima = max(_ordem_col(c) for c, _ in meses)
            anual = None
            for fonte in (cel, prox):
                cand = [numero(fonte[c]) for c in sorted(fonte, key=_ordem_col) if _ordem_col(c) > ultima]
                cand = [x for x in cand if x is not None]
                if cand:
                    anual = cand[0]
                    break
            if anual is not None:
                if _valida(anual):
                    out["anual"][str(ano)] = anual
                else:
                    out["problemas"].append(f"{ano}: fator anual fora do domínio ({anual})")
            ano = None
    return out


def parse_despacho(planilha):
    """Margem de construção anual e margem de operação (análise de despacho) mensal e
    diária, de uma planilha anual do MDL.

    Retorna {"ano", "bm": v|None, "bm_nota": texto|None, "om_mensal": {"AAAA-MM": v},
    "om_diario": {"AAAA-MM-DD": v}, "revisoes": [{mes, anterior, atual}], "notas": [...],
    "descartes": [...]}."""
    nome_aba, linhas = next(iter(planilha.items()))
    out = {"ano": None, "bm": None, "bm_nota": None, "om_mensal": {}, "om_diario": {}, "revisoes": [],
           "notas": [], "descartes": [], "problemas": [], "aba": nome_aba}
    textos = [(i, " ".join(cel.values())) for i, (_, cel) in enumerate(linhas)]
    i_bm = next((i for i, t in textos if "MARGEM DE CONSTRU" in t.upper()), None)
    i_om = next((i for i, t in textos if "MARGEM DE OPERA" in t.upper()), None)
    anos = [a for _, cel in linhas[:20] for a in [_ano_da_linha(cel)] if a]
    out["ano"] = anos[0] if anos else None
    ano = out["ano"]
    # rótulos de publicação anterior variam: "Publicação anterior (com erros)", "Valor
    # anteriormente publicado", "Valores anteriormente publicados (com erros)"
    tem_anterior = any("anterior" in _sem_acento(t) for _, t in textos[:15])
    for _, cel in linhas[:12]:
        for col, v in cel.items():
            if _ordem_col(col) >= _ordem_col("P") and numero(v) is None and len(v) > 20:
                out["notas"].append(v.strip())
    if i_bm is not None and i_om is not None and ano:
        bm_anterior = None
        for _, cel in linhas[i_bm + 1:i_om]:
            for col in sorted(cel, key=_ordem_col):
                v = numero(cel[col])
                if _ordem_col(col) >= _ordem_col("P"):
                    # à direita ficam notas e, quando há, o valor publicado antes da correção
                    if v is not None and tem_anterior and bm_anterior is None and _valida(v):
                        bm_anterior = v
                    continue
                if v is None:
                    if len(cel[col]) > 15 and not _sem_acento(cel[col]).startswith("fator de emiss"):
                        out["bm_nota"] = cel[col].strip()
                    continue
                if col == "A" and v == ano:
                    continue
                if out["bm"] is None and _valida(v):
                    out["bm"] = v
        if bm_anterior is not None:
            out["revisoes"].append({"serie": "margem_construcao", "periodo": str(ano), "anterior": bm_anterior, "atual": out["bm"]})
    if i_om is None or not ano:
        return out
    # bloco mensal: primeiro cabeçalho de meses depois do título da margem de operação
    j = i_om
    while j < len(linhas):
        cols = _colunas_de_mes(linhas[j][1])
        if len(cols) >= 12:
            break
        j += 1
    if j >= len(linhas):
        return out
    cols = _colunas_de_mes(linhas[j][1])
    principais, extras = _meses_posicionais(cols, f"margem de operação mensal {ano}", out["problemas"]), cols[12:]
    vals = linhas[j + 1][1] if j + 1 < len(linhas) else {}
    for col, mes in principais:
        v = numero(vals.get(col))
        if _valida(v):
            out["om_mensal"][f"{ano}-{mes:02d}"] = v
    if tem_anterior:
        for col, mes in extras:
            v = numero(vals.get(col))
            atual = out["om_mensal"].get(f"{ano}-{mes:02d}")
            if v is not None:
                out["revisoes"].append({"serie": "margem_operacao_mensal", "periodo": f"{ano}-{mes:02d}", "anterior": v, "atual": atual})
    # bloco diário: cabeçalho com "Dia" (sem "Hora") e nomes de mês
    k = j + 2
    while k < len(linhas):
        cel = linhas[k][1]
        rotulos = {_sem_acento(v) for v in cel.values()}
        if "dia" in rotulos and "hora" not in rotulos and len(_colunas_de_mes(cel)) >= 12:
            break
        if "hora" in rotulos:
            k = len(linhas)
            break
        k += 1
    if k >= len(linhas):
        return out
    cab = linhas[k][1]
    col_dia = next(c for c, v in cab.items() if _sem_acento(v) == "dia")
    cols_d = _colunas_de_mes(cab)
    dmeses = _meses_posicionais(cols_d, f"margem de operação diária {ano}", out["problemas"])
    # colunas de mês à direita das 12 principais: valores diários de outra publicação
    # (só os dias que mudaram), lidos pelo rótulo do mês
    dextras = cols_d[12:] if tem_anterior else []
    anteriores_d = {}
    for _, cel in linhas[k + 1:]:
        d = numero(cel.get(col_dia))
        if d is None or not float(d).is_integer() or not 1 <= d <= 31:
            if any(_sem_acento(v) in ("dia", "hora") for v in cel.values()):
                break
            continue
        dia = int(d)
        for col, mes in dmeses:
            v = numero(cel.get(col))
            if v is None:
                continue
            if dia > calendar.monthrange(ano, mes)[1]:
                out["descartes"].append({"data": f"{ano}-{mes:02d}-{dia:02d}", "valor": v,
                                         "motivo": "data inexistente no calendário"})
                continue
            if not _valida(v):
                out["descartes"].append({"data": f"{ano}-{mes:02d}-{dia:02d}", "valor": v, "motivo": "fora do domínio"})
                continue
            out["om_diario"][date(ano, mes, dia).isoformat()] = v
        for col, mes in dextras:
            v = numero(cel.get(col))
            if v is not None:
                anteriores_d[(mes, dia)] = v
    if anteriores_d:
        _revisoes_diarias(out, linhas, j, k, dmeses, anteriores_d)
    return out


def _rotulo_bloco_direita(linhas, ini, fim, coluna_minima):
    """(célula, texto) do rótulo de publicação acima do bloco diário da direita, se houver:
    texto com "anterior" ou "atual" nas linhas entre o fator mensal e o cabeçalho diário."""
    for r, cel in linhas[ini:fim]:
        for col in sorted(cel, key=_ordem_col):
            t = _sem_acento(cel[col])
            if _ordem_col(col) >= coluna_minima and numero(cel[col]) is None and ("anterior" in t or "atual" in t):
                return f"{col}{r}", cel[col].strip()
    return None, None


MESES_TEXTO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro",
               "novembro", "dezembro"]


def _dia_mes(mes, dia):
    return f"{dia:02d}/{mes:02d}"


def _sinal(x, casas):
    """Número com sinal e vírgula decimal, para texto exibido (ex.: −0,00269)."""
    return f"{x:+.{casas}f}".replace("-", "\u2212").replace(".", ",")


def _revisoes_diarias(out, linhas, j, k, dmeses, anteriores):
    """Valores diários de outra publicação, à direita do bloco diário principal.

    A planilha declara uma publicação anterior (rótulo "anterior" no topo) e, nas de 2023 e
    2024, não rotula o bloco diário da direita: ele é lido como a publicação anterior, como o
    bloco mensal da direita. Nas de 2020 e 2022 a célula acima dele diz "Publicação atual
    (com correção)", o que contradiz o rótulo do topo e o mensal (o principal é o corrigido).
    Nesse caso o rótulo não decide sozinho: o bloco só é lido como publicação anterior se,
    em todo mês com valor mensal anterior declarado, trocar os diários principais pelos da
    direita move a média do mês no mesmo sentido em que o mensal anterior difere do mensal
    corrigido. Se não, nada é lido como revisão e o bloco fica registrado como problema.
    Dia inexistente no calendário no bloco anterior é descartado, nunca lido como revisão."""
    ano = out["ano"]
    # rótulo à direita da última coluna de mês do bloco principal (o da direita pode começar
    # na coluna seguinte, como em 2020, ou deixar colunas vazias, como em 2022)
    depois = max(_ordem_col(c) for c, _ in dmeses) + 1
    celula, rotulo = _rotulo_bloco_direita(linhas, j + 2, k, depois)
    datas = sorted((m, d) for m, d in anteriores)
    n = len(anteriores)
    resumo = (f"{n} {'valor diário' if n == 1 else 'valores diários'} à direita do bloco principal "
              f"({_dia_mes(*datas[0])}" + (f" a {_dia_mes(*datas[-1])})" if n > 1 else ")"))
    if rotulo and "atual" in _sem_acento(rotulo):
        mensal_ant = {int(r["periodo"][5:7]): r["anterior"] for r in out["revisoes"] if r["serie"] == "margem_operacao_mensal"}
        sentidos = []
        for mes in sorted({m for m, _ in anteriores}):
            atual_m = out["om_mensal"].get(f"{ano}-{mes:02d}")
            if mes not in mensal_ant or atual_m is None:
                continue
            princ = {int(x[8:]): v for x, v in out["om_diario"].items() if x[5:7] == f"{mes:02d}"}
            if not princ:
                continue
            troca = {**princ, **{d: v for (m, d), v in anteriores.items() if m == mes and d in princ}}
            delta_d = sum(troca.values()) / len(troca) - sum(princ.values()) / len(princ)
            delta_m = mensal_ant[mes] - atual_m
            sentidos.append((mes, delta_d, delta_m, delta_d * delta_m > 0))
        comparacao = "; ".join(f"{MESES_TEXTO[m - 1]}: média diária {_sinal(dd, 5)}, mensal {_sinal(dm, 4)}"
                               for m, dd, dm, _ in sentidos) or "nenhum mês comparável"
        if not sentidos or not all(ok for *_, ok in sentidos):
            out["problemas"].append(
                f"margem de operação diária {ano}: {resumo}, sob o rótulo \"{rotulo}\" (célula {celula}); trocar os diários "
                "principais por eles não move a média do mês no sentido da correção declarada no mensal "
                f"({comparacao}); não lidos como revisão nem como fator diário")
            return
        out["problemas"].append(
            f"margem de operação diária {ano}: o rótulo \"{rotulo}\" (célula {celula}) chama de atual o bloco diário da direita, "
            "mas o topo da planilha declara a publicação anterior (com erros) e o mensal principal é o corrigido; lidos como "
            f"publicação anterior os {resumo}, porque trocar os diários principais por eles move a média de cada mês no "
            f"sentido da correção do mensal ({comparacao})")
    for (mes, dia), v in sorted(anteriores.items()):
        data_txt = f"{ano}-{mes:02d}-{dia:02d}"
        if dia > calendar.monthrange(ano, mes)[1]:
            out["descartes"].append({"data": data_txt, "valor": v,
                                     "motivo": "data inexistente no calendário (valor da publicação anterior)"})
            continue
        out["revisoes"].append({"serie": "margem_operacao_diaria", "periodo": data_txt, "anterior": v,
                                "atual": out["om_diario"].get(data_txt)})


def _texto_html(corpo):
    t = corpo.decode("utf-8", errors="replace") if isinstance(corpo, bytes) else corpo
    t = re.sub(r"<script.*?</script>", "", t, flags=re.S)
    t = re.sub(r"<style.*?</style>", "", t, flags=re.S)
    t = re.sub(r"<[^>]+>", "\n", t)
    t = html_mod.unescape(t)
    return [x.strip() for x in t.split("\n") if x.strip()]


def parse_simples_ajustado(corpo):
    """Tabela do método simples ajustado (página HTML do MCTI).

    Retorna {"om": {"AAAA": v}, "energia_mwh": {"AAAA": v}, "notas": [...]}. Números
    no formato brasileiro ("0,3355" e "415.708.597"). O asterisco no ano remete a nota
    de recálculo, guardada em `notas`."""
    linhas = _texto_html(corpo)
    out = {"om": {}, "energia_mwh": {}, "notas": [], "anos_com_nota": {}}
    try:
        i0 = next(i for i, x in enumerate(linhas) if "simples ajustado" in x.lower() and "fatores" in x.lower())
    except StopIteration:
        return out
    i_en = next((i for i, x in enumerate(linhas) if x.lower().startswith("energia total despachada")), len(linhas))
    for secao, ini, fim in (("om", i0, i_en), ("energia_mwh", i_en, len(linhas))):
        i = ini
        while i < fim:
            m = re.fullmatch(r"(\d{4})(\**)", linhas[i])
            if m and i + 1 < fim:
                bruto = linhas[i + 1].replace(" ", "")
                if secao == "om" and re.fullmatch(r"\d+,\d+", bruto):
                    out["om"][m.group(1)] = float(bruto.replace(",", "."))
                    if m.group(2):
                        out["anos_com_nota"][m.group(1)] = m.group(2)
                    i += 2
                    continue
                if secao == "energia_mwh" and re.fullmatch(r"\d{1,3}(\.\d{3})+", bruto):
                    out["energia_mwh"][m.group(1)] = float(bruto.replace(".", ""))
                    i += 2
                    continue
            if secao == "om" and linhas[i].startswith("*"):
                out["notas"].append(linhas[i])
            i += 1
    return out


def parse_simples_ajustado_xlsx(planilha):
    """Mesma tabela do método simples ajustado, na planilha que substituiu a página HTML
    (FE_simplesajustado_<ano>_web.xlsx): ano na coluna B (com * ou ** quando há nota), fator
    na C, ano na G e energia despachada (MWh) na H; notas na coluna A abaixo da tabela."""
    out = {"om": {}, "energia_mwh": {}, "notas": [], "anos_com_nota": {}}
    for _, linhas in planilha.items():
        for _, cel in linhas:
            m = re.fullmatch(r"(\**)\s*(\d{4})", (cel.get("B") or "").strip())
            v = numero(cel.get("C"))
            if m and v is not None and _valida(v):
                out["om"][m.group(2)] = v
                if m.group(1):
                    out["anos_com_nota"][m.group(2)] = m.group(1)
            m2 = re.fullmatch(r"\s*(\d{4})\s*", cel.get("G") or "")
            e = numero(cel.get("H"))
            if m2 and e is not None and e > 0:
                out["energia_mwh"][m2.group(1)] = e
            nota = (cel.get("A") or "").strip()
            if nota.startswith("*"):
                out["notas"].append(nota)
    return out


def tipo_planilha(planilha):
    """Classifica pelo conteúdo, não pelo nome: na página vigente do MCTI as planilhas do
    MDL de 2022 e 2023 se chamam "Margemdeconstruo_<ano>corrigido.xlsx" e contêm margem de
    construção e de operação (mensal, diária e horária), como as de despacho."""
    textos = " ".join(v for linhas in planilha.values() for _, cel in linhas[:30] for v in cel.values())
    t = _sem_acento(textos)
    if "margem de opera" in t and "simples ajustado" not in t:
        return "despacho"
    if "simples ajustado" in t:
        return "simples_ajustado"
    if "fator medio mensal" in t:
        return "inventario"
    return "outro"


def links_documentos(corpo, base_url):
    """PDFs de nota técnica sobre os fatores (ex.: NT_FE_jun25.pdf) citados na página."""
    t = corpo.decode("utf-8", errors="replace") if isinstance(corpo, bytes) else corpo
    vistos = []
    for href in re.findall(r'href="([^"]*NT_FE[^"]*\.pdf)"', t, flags=re.I):
        u = urljoin(base_url, html_mod.unescape(href))
        if u not in vistos:
            vistos.append(u)
    return vistos


def desafio_waf(corpo):
    """support ID (texto) se o corpo é a página de verificação humana do gov.br; senão None."""
    t = corpo.decode("utf-8", errors="replace") if isinstance(corpo, bytes) else (corpo or "")
    if "testing whether you are a human" in t or "What code is in the image" in t:
        m = re.search(r"support ID is:\s*(\d+)", t)
        return m.group(1) if m else "sem support ID"
    return None


def links_xlsx(corpo, base_url):
    """URLs absolutas de planilhas .xlsx citadas numa página (visíveis ou não)."""
    t = corpo.decode("utf-8", errors="replace") if isinstance(corpo, bytes) else corpo
    vistos = []
    for href in re.findall(r'href="([^"]+\.xlsx)"', t, flags=re.I):
        u = urljoin(base_url, html_mod.unescape(href))
        if u not in vistos:
            vistos.append(u)
    return vistos


def _sem_tags(trecho):
    return re.sub(r"\s+", " ", html_mod.unescape(re.sub(r"<[^>]+>", " ", trecho))).strip()


def planilhas_publicadas(corpo, base_url):
    """(publicadas, ocultas) a partir das âncoras de planilha .xlsx de uma página.

    publicadas: [{"titulo", "url", "arquivo"}] das âncoras com texto visível ("Clique
    Aqui", "Aqui", "Download"), na ordem da página, com o título da linha da tabela em
    que estão (o MCTI anota ali as correções: "Ano Base 2024 – com correções nos meses
    de janeiro e março a setembro").

    ocultas: URLs de âncoras sem texto. Em 30/09/2026 a página vigente do MCTI tinha 36
    links de planilha, dos quais 13 em âncoras vazias, invisíveis para o leitor e
    apontando para versões antigas (por exemplo, Despacho_2021_jan-a-jun.xlsx, o primeiro
    semestre de 2021, superado pelo ano completo). Ler essas âncoras como publicação
    vigente deixaria uma versão parcial sobrescrever a completa, então elas só ficam
    registradas. Comentários HTML também são ignorados."""
    t = corpo.decode("utf-8", errors="replace") if isinstance(corpo, bytes) else corpo
    t = re.sub(r"<!--.*?-->", "", t, flags=re.S)
    publicadas, ocultas, vistos = [], [], set()
    for m in re.finditer(r'<a\b[^>]*?href="([^"]+\.xlsx)"[^>]*>(.*?)</a>', t, flags=re.S | re.I):
        u = urljoin(base_url, html_mod.unescape(m.group(1)))
        if not _sem_tags(m.group(2)):
            if u not in ocultas:
                ocultas.append(u)
            continue
        if u in vistos:
            continue
        vistos.add(u)
        ini = t.rfind("<tr", 0, m.start())
        fim_ant = t.rfind("</tr>", 0, m.start())
        titulo = None
        if ini != -1 and ini > fim_ant:
            fim = t.find("</tr>", m.end())
            linha = _sem_tags(t[ini:fim if fim != -1 else m.end()])
            titulo = re.split(r"\s+XLSX\b", linha, maxsplit=1)[0].strip() or None
        publicadas.append({"titulo": titulo, "url": u, "arquivo": u.rsplit("/", 1)[-1]})
    ocultas = [u for u in ocultas if u not in vistos]
    return publicadas, ocultas


def tipo_arquivo(nome):
    """Classifica uma planilha pelo nome publicado: inventario, despacho ou outro."""
    n = _sem_acento(nome)
    if "inventario" in n or "inventrio" in n:
        return "inventario"
    if "despacho" in n:
        return "despacho"
    return "outro"
