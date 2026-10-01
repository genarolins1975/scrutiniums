"""Extração das tabelas do Boletim Mensal de Monitoramento do Sistema Elétrico (MME, SNEE/DDOS).

O boletim é publicado em PDF em gov.br/mme, numa pasta por ano. Dele o módulo Mercado lê
duas tabelas, ambas com fonte declarada no próprio boletim:

* "Encargos de Serviços de Sistema – AAAA" (fonte: CCEE), em mil R$ por mês de competência
  e por tipo de encargo: restrição de operação (com as parcelas constrained-on,
  constrained-off e unit commitment), suporte de reativo, deslocamento hidráulico, resposta
  da demanda, segurança energética, outros serviços ancilares, importação de energia,
  reserva operativa e o total. Cada edição traz os meses do ano até o mês da edição, e as
  edições seguintes repetem os meses anteriores: a comparação entre edições mostra o
  reprocessamento (a edição de março de 2026 publicou o suporte de reativo de março com uma
  parcela "vinculada a resposta da demanda" que as edições seguintes retiraram).
* "Consumo de energia elétrica: estratificação por ambiente de contratação" (fonte: EPE e
  ONS), em GWh: ACR, ACL e total do mês da edição e do mesmo mês do ano anterior, e as somas
  de 12 meses; e a tabela por classe com a linha "Perdas e Diferenças" (carga verificada
  menos consumo), que mostra por que ACL + ACR não é a carga do ONS.

O texto vem do pdftotext (poppler) com -layout, que preserva as colunas. Nenhum número é
aceito sem conferência: cada mês da tabela de encargos tem de fechar (soma dos tipos = total
e soma das parcelas = tipo), e a tabela de consumo tem de fechar (ACR + ACL = total), com a
tolerância do arredondamento da própria tabela. O traço ("-") é lido como zero só porque a
identidade da soma o confirma em cada mês; mês que não fecha é descartado inteiro.
"""
import re
import shutil
import subprocess

MESES_PT = {"janeiro": 1, "fevereiro": 2, "março": 3, "marco": 3, "abril": 4, "maio": 5, "junho": 6, "julho": 7,
            "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12}
MESES_ABREV = {"jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6, "jul": 7, "ago": 8, "set": 9, "out": 10,
               "nov": 11, "dez": 12}

# Rótulo da linha na fonte → (id, nível, pai). A grafia "Restriçao" sem til é a da fonte.
LINHAS_ESS = {
    "restricao de operacao": ("restricao_operacao", "tipo", None),
    "ro - constrained-on": ("ro_constrained_on", "parcela", "restricao_operacao"),
    "ro - constrained-off": ("ro_constrained_off", "parcela", "restricao_operacao"),
    "ro - unit commitment": ("ro_unit_commitment", "parcela", "restricao_operacao"),
    "suporte de reativo": ("suporte_reativo", "tipo", None),
    "sr nao vinculado a rd": ("sr_nao_vinculado_rd", "parcela", "suporte_reativo"),
    "sr vinculado a rd": ("sr_vinculado_rd", "parcela", "suporte_reativo"),
    "deslocamento hidraulico": ("deslocamento_hidraulico", "tipo", None),
    "resposta da demanda": ("resposta_demanda", "tipo", None),
    "seguranca energetica": ("seguranca_energetica", "tipo", None),
    "outros servicos ancilares": ("outros_ancilares", "tipo", None),
    "importacao de energia": ("importacao", "tipo", None),
    "reserva operativa": ("reserva_operativa", "tipo", None),
    "total": ("total", "total", None),
}
ROTULOS_ESS = {
    "restricao_operacao": "Restrição de operação", "ro_constrained_on": "Restrição de operação: constrained-on",
    "ro_constrained_off": "Restrição de operação: constrained-off", "ro_unit_commitment": "Restrição de operação: unit commitment",
    "suporte_reativo": "Suporte de reativo", "sr_nao_vinculado_rd": "Suporte de reativo não vinculado a resposta da demanda",
    "sr_vinculado_rd": "Suporte de reativo vinculado a resposta da demanda", "deslocamento_hidraulico": "Deslocamento hidráulico",
    "resposta_demanda": "Resposta da demanda", "seguranca_energetica": "Segurança energética",
    "outros_ancilares": "Outros serviços ancilares", "importacao": "Importação de energia",
    "reserva_operativa": "Reserva operativa", "total": "Total",
}


class TabelaNaoReconhecida(ValueError):
    """O PDF não tem a tabela no formato verificado: nada é extraído."""


def texto_pdf(caminho):
    """Texto do PDF pelo pdftotext -layout; None quando a ferramenta não está instalada."""
    exe = shutil.which("pdftotext")
    if not exe:
        return None
    r = subprocess.run([exe, "-layout", caminho, "-"], capture_output=True, timeout=120)
    if r.returncode != 0:
        raise TabelaNaoReconhecida(f"pdftotext falhou: {r.stderr[:200]!r}")
    return r.stdout.decode("utf-8", errors="replace")


def _sem_acento(s):
    import unicodedata
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()


def edicao(texto):
    """Mês de referência da edição ('AAAA-MM'), lido do cabeçalho de página do boletim."""
    m = re.search(r"Boletim Mensal de Monitoramento do Sistema El[ée]trico Brasileiro\s*[–-]\s*([A-Za-zçÇ]+) de (\d{4})", texto)
    if not m:
        raise TabelaNaoReconhecida("cabeçalho da edição não encontrado")
    mes = MESES_PT.get(m.group(1).lower())
    if not mes:
        raise TabelaNaoReconhecida(f"mês da edição não reconhecido: {m.group(1)!r}")
    return f"{m.group(2)}-{mes:02d}"


def numero_tabela(tok):
    """'63.245' → 63245.0; '-' → 0.0 (confirmado depois pela identidade); '4,02' → 4.02."""
    tok = tok.strip()
    if tok in ("-", "–"):
        return 0.0
    if re.fullmatch(r"-?\d{1,3}(\.\d{3})+", tok) or re.fullmatch(r"-?\d+", tok):
        return float(tok.replace(".", ""))
    if re.fullmatch(r"-?\d{1,3}(\.\d{3})*,\d+", tok) or re.fullmatch(r"-?\d+,\d+", tok):
        return float(tok.replace(".", "").replace(",", "."))
    raise ValueError(tok)


def _campos(linha):
    """Divide uma linha do -layout em campos separados por dois ou mais espaços."""
    return [c for c in re.split(r"\s{2,}", linha.strip()) if c]


def tabela_ess(texto, mes_edicao=None, tolerancia_mil_rs=2.0):
    """Tabela de encargos de serviços do sistema da edição.

    Retorna {"ano", "meses": [AAAA-MM], "valores": {id: {AAAA-MM: mil R$}}, "tracos": [(id,
    mês)], "conferencia": {mês: {"total_publicado", "soma_tipos", "diferenca", "ok"}},
    "descartados": [mês]}. Só entram os meses até o mês da edição: os meses seguintes vêm
    com zero na linha Total e não são dado. Tolerância: 2 mil R$ por mês, o arredondamento
    de até 11 parcelas publicadas em mil R$ inteiros."""
    linhas = texto.splitlines()
    ini = next((i for i, l in enumerate(linhas) if re.match(r"\s*Encargos\S*\s+jan/\d{2}", l)), None)
    if ini is None:
        raise TabelaNaoReconhecida("cabeçalho 'Encargos jan/AA ...' não encontrado")
    cab = re.findall(r"(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/(\d{2})", linhas[ini])
    if len(cab) != 12:
        raise TabelaNaoReconhecida(f"cabeçalho com {len(cab)} meses")
    meses = [f"20{a}-{MESES_ABREV[m]:02d}" for m, a in cab]
    limite = mes_edicao or meses[-1]
    valores, tracos, vistos = {}, [], set()
    for l in linhas[ini + 1: ini + 40]:
        cs = _campos(l)
        if not cs:
            continue
        rot = _sem_acento(cs[0]).lower().rstrip("¹²³ ").strip()
        rot = re.sub(r"\s+", " ", rot)
        if rot not in LINHAS_ESS:
            if vistos and rot.startswith(("ro –", "ro -", "sr ")):
                raise TabelaNaoReconhecida(f"parcela não reconhecida: {cs[0]!r}")
            if "total" in vistos:
                break
            continue
        ident = LINHAS_ESS[rot][0]
        if ident in vistos:
            raise TabelaNaoReconhecida(f"linha repetida: {cs[0]!r}")
        vistos.add(ident)
        toks = cs[1:]
        serie = {}
        for i, tok in enumerate(toks[:12]):
            if meses[i] > limite:
                break
            serie[meses[i]] = numero_tabela(tok)
            if tok.strip() in ("-", "–"):
                tracos.append((ident, meses[i]))
        valores[ident] = serie
        if ident == "total":
            break
    if "total" not in valores:
        raise TabelaNaoReconhecida("linha Total não encontrada")
    tipos = [k for k, (_, nivel, _) in LINHAS_ESS.items() if nivel == "tipo"]
    ids_tipo = [LINHAS_ESS[k][0] for k in tipos]
    conferencia, descartados = {}, []
    for mes in [m for m in meses if m <= limite]:
        tot = valores["total"].get(mes)
        faltam = [t for t in ids_tipo if t in valores and mes not in valores[t]]
        soma = sum(valores[t].get(mes, 0.0) for t in ids_tipo if t in valores)
        ok = tot is not None and not faltam and abs(soma - tot) <= tolerancia_mil_rs
        # parcelas de cada tipo: só conferidas quando a edição as publica
        for pai in ("restricao_operacao", "suporte_reativo"):
            filhos = [LINHAS_ESS[k][0] for k, (_, nv, p) in LINHAS_ESS.items() if p == pai and LINHAS_ESS[k][0] in valores]
            if filhos and pai in valores and mes in valores[pai]:
                sp = sum(valores[f].get(mes, 0.0) for f in filhos)
                ok = ok and abs(sp - valores[pai][mes]) <= tolerancia_mil_rs
        conferencia[mes] = {"total_publicado": tot, "soma_tipos": soma,
                            "diferenca": None if tot is None else soma - tot, "ok": ok}
        if not ok:
            descartados.append(mes)
    for ident in valores:
        for mes in descartados:
            valores[ident].pop(mes, None)
    return {"ano": meses[0][:4], "meses": [m for m in meses if m <= limite and m not in descartados],
            "valores": valores, "tracos": tracos, "conferencia": conferencia, "descartados": descartados}


def tabela_consumo_ambiente(texto, tolerancia_gwh=1.0):
    """Tabela "estratificação por ambiente de contratação" (GWh).

    Retorna {"mes": AAAA-MM, "mes_ano_anterior", "linhas": {ACR|ACL|Total: {"mes_anterior",
    "mes", "acum_anterior", "acum", "participacao_pct"}}, "acum_periodo": (início, fim),
    "ok"}. Confere ACR + ACL = Total com tolerância de 1 GWh (duas parcelas arredondadas a
    GWh inteiro)."""
    linhas = texto.splitlines()
    ini = next((i for i, l in enumerate(linhas) if "estratificação por ambiente de contratação" in l
                and "Consumo" in l), None)
    if ini is None:
        raise TabelaNaoReconhecida("tabela por ambiente de contratação não encontrada")
    trecho = "\n".join(linhas[ini: ini + 25])
    meses = re.findall(r"\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/(\d{2})\b", trecho)
    if len(meses) < 6:
        raise TabelaNaoReconhecida("cabeçalho de meses incompleto")
    # ordem no cabeçalho: mês ano anterior, mês atual, início e fim do acumulado anterior,
    # início e fim do acumulado atual
    conv = [f"20{a}-{MESES_ABREV[m]:02d}" for m, a in meses[:6]]
    out = {"mes_ano_anterior": conv[0], "mes": conv[1], "acum_periodo_anterior": (conv[2], conv[3]),
           "acum_periodo": (conv[4], conv[5]), "linhas": {}}
    for l in linhas[ini: ini + 25]:
        cs = _campos(l)
        if len(cs) >= 8 and cs[0] in ("ACR", "ACL", "Total"):
            try:
                v = [numero_tabela(x) for x in cs[1:8]]
            except ValueError:
                continue
            out["linhas"][cs[0]] = {"mes_anterior": v[0], "mes": v[1], "acum_anterior": v[3], "acum": v[4],
                                    "participacao_pct": v[6]}
    if set(out["linhas"]) != {"ACR", "ACL", "Total"}:
        raise TabelaNaoReconhecida(f"linhas encontradas: {sorted(out['linhas'])}")
    L = out["linhas"]
    out["ok"] = all(abs(L["ACR"][k] + L["ACL"][k] - L["Total"][k]) <= tolerancia_gwh
                    for k in ("mes_anterior", "mes", "acum_anterior", "acum"))
    return out


def perdas_e_diferencas(texto):
    """Linhas 'Perdas e Diferenças' e 'Total' da tabela de consumo por classe (GWh): a carga
    verificada do mês e a parte dela que não é consumo apurado pela EPE."""
    linhas = texto.splitlines()
    ini = next((i for i, l in enumerate(linhas) if "estratificação por classe" in l and "Consumo" in l), None)
    if ini is None:
        raise TabelaNaoReconhecida("tabela por classe não encontrada")
    out = {}
    for l in linhas[ini: ini + 30]:
        cs = _campos(l)
        if len(cs) >= 6 and (cs[0].startswith("Perdas e Diferen") or cs[0] == "Total"):
            chave = "perdas_diferencas" if cs[0].startswith("Perdas") else "total"
            try:
                v = [numero_tabela(x) for x in cs[1:7]]
            except ValueError:
                continue
            out[chave] = {"mes_anterior": v[0], "mes": v[1], "acum_anterior": v[3], "acum": v[4]}
        if len(out) == 2:
            break
    if set(out) != {"perdas_diferencas", "total"}:
        raise TabelaNaoReconhecida("linhas Perdas e Diferenças e Total não encontradas")
    return out


def links_boletins(html, base_url):
    """Arquivos PDF de boletim listados na página da pasta do ano: [(nome_arquivo, url_download,
    data_modificacao 'AAAA-MM-DDTHH:MM:00-03:00' | None)]. A data de modificação é a que a
    própria página exibe ao lado do arquivo (horário de Brasília)."""
    vistos, out = set(), []
    for m in re.finditer(r'href="([^"]*/(boletim-mensal-[^"/]+\.pdf))(?:/view)?"', html):
        url, nome = m.group(1), m.group(2)
        if nome in vistos:
            continue
        vistos.add(nome)
        if url.startswith("/"):
            url = "https://www.gov.br" + url
        # a data aparece na mesma linha da tabela, depois do link
        trecho = html[m.end(): m.end() + 1500]
        d = re.search(r"(\d{2})/(\d{2})/(\d{4})\s+(\d{2})h(\d{2})", trecho)
        quando = f"{d.group(3)}-{d.group(2)}-{d.group(1)}T{d.group(4)}:{d.group(5)}:00-03:00" if d else None
        out.append((nome, url.rstrip("/") + "/@@download/file", quando))
    return out
