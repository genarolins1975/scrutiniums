"""Leitura e classificação dos resultados dos leilões de geração do ACR (ANEEL) e dos
insumos que o módulo Leilões cruza com eles.

Fonte principal: conjunto "Resultado de Leilões" do portal de dados abertos da ANEEL,
recurso `resultado-leiloes-geracao.csv` (uma linha por empreendimento vencedor em cada
leilão), descrito no "Dicionário de Metadados do Conjunto de Dados: Resultados dos
Leilões de Geração", versão 1.0 de 30/03/2023. O arquivo vem em Windows-1252 (o travessão
de "CHESF – Companhia..." é o byte 0x96, que o Latin-1 não decodifica como caractere
imprimível), com ';' e vírgula decimal sem zero à esquerda (",72").

Unidades conferidas contra resultados conhecidos dos leilões estruturantes (linhas do
próprio arquivo): VlrEnergiaVendida em MWmédio (Belo Monte 3.199, Jirau 1.382, Santo
Antônio 1.552); VlrDesagio em percentual (Costa Pinto, 1º LEN: teto 140,00, preço 138,99,
deságio ",72" = 0,72%); MdaGarantiaFisicaSEL em MWmédio; MdaPotenciaInstaladaMW em MW;
VlrInvestimentoPrevisto em reais nominais da data do leilão.

Zeros que são marcador de campo não preenchido (conferidos linha a linha no arquivo de
01/10/2026), e por isso viram ausência, nunca zero:
- VlrPrecoLeilao 0,00 com VlrDesagio 100,00 (Paraúna, 7º LEN): não houve venda de graça;
- MdaGarantiaFisicaSEL 0,00 com energia vendida positiva (Pecém II e Camaçari Muricy II,
  2º LEN): não se vende energia sem garantia física;
- VlrInvestimentoPrevisto 0,00 (80 linhas, sobretudo ampliações e usinas existentes).
"""
import re
import unicodedata

from pipeline.energia.fontes.ckan import numero_br

RECURSO = "resultado-leiloes-geracao.csv"
RECURSO_DICIONARIO = "Dicionário de dados - Leilões de geração"
ENCODING = "cp1252"

# Categoria de fonte publicada pelo observatório: a DscFonteEnergia da ANEEL, com a fonte
# hídrica separada pelo tipo de geração (UHE de um lado; PCH e CGH do outro), porque preço,
# escala e prazo de grandes e pequenas hidrelétricas não se comparam.
CATEGORIAS = [
    ("uhe", "Hidrelétrica (UHE)"),
    ("pch", "Pequena hidrelétrica (PCH e CGH)"),
    ("eolica", "Eólica"),
    ("solar", "Solar fotovoltaica"),
    ("biomassa", "Biomassa e resíduos"),
    ("gas", "Gás natural"),
    ("oleo", "Óleo combustível e diesel"),
    ("carvao", "Carvão mineral"),
]
NOME_CATEGORIA = dict(CATEGORIAS)

# Tipos de leilão como publicados em DscTipoLeilao (o dicionário cita energia nova A-3 a
# A-7, reserva, estruturante e fontes alternativas). Ordem de exibição.
TIPOS = [
    ("A-3", "Energia nova A-3"),
    ("A-4", "Energia nova A-4"),
    ("A-5", "Energia nova A-5"),
    ("A-6", "Energia nova A-6"),
    ("A-7", "Energia nova A-7"),
    ("LER", "Energia de reserva"),
    ("FA", "Fontes alternativas"),
    ("Estruturante", "Projeto estruturante"),
]
NOME_TIPO = dict(TIPOS)


def _sem_acento(s):
    return "".join(ch for ch in unicodedata.normalize("NFD", s or "") if unicodedata.category(ch) != "Mn")


def antecedencia(tipo):
    """x de um produto A-x (anos entre o leilão e o ano A de início do suprimento); None nos demais."""
    m = re.fullmatch(r"A-(\d)", (tipo or "").strip())
    return int(m.group(1)) if m else None


def categoria(fonte, tipo_geracao):
    """Categoria publicada a partir de DscFonteEnergia e SigTipoGeracao; None quando a fonte
    não é conhecida (a linha fica fora das quebras por fonte e é contada à parte)."""
    f = _sem_acento(fonte).strip().lower()
    t = (tipo_geracao or "").strip().upper()
    if f == "hidro":
        return "uhe" if t == "UHE" else ("pch" if t in ("PCH", "CGH") else None)
    return {
        "eolica": "eolica", "solar": "solar", "biomassa": "biomassa", "residuos solidos urbanos": "biomassa",
        "gas": "gas", "oleo": "oleo", "carvao": "carvao",
    }.get(f)


def nome_leilao(ccee, tipo):
    """Nome de exibição a partir de DscNumeroLeilaoCCEE: o campo tem 10 posições e corta
    "Estruturante" em "Estrutu"; o indicador ordinal vem como "°" ou "º". Só a grafia muda."""
    s = (ccee or "").strip().replace("°", "º")
    s = re.sub(r"\s+", " ", s)
    if tipo == "Estruturante" and s.endswith("Estrutu"):
        s = s[: -len("Estrutu")] + "Estruturante"
    return s or None


def _positivo_ou_none(v):
    return v if (v is not None and v > 0) else None


def le_linhas(linhas):
    """Linhas do CSV (dicts com os nomes da fonte) → lista de registros normalizados.

    Mantém a ordem do arquivo. Cada registro leva `linha` (posição no arquivo, a partir de
    1) e `chave` estável: leilão, núcleo do CEG, nome do empreendimento e vencedora (o
    par leilão × núcleo se repete em 4 casos na fonte, ver `repetidos_no_leilao`)."""
    out = []
    vistos = {}
    for i, r in enumerate(linhas, start=1):
        def t(c):
            return (r.get(c) or "").strip()
        nucleo_txt = t("IdeNucleoCEG")
        nucleo = int(nucleo_txt) if nucleo_txt.isdigit() else None
        tipo = t("DscTipoLeilao")
        preco_bruto = numero_br(t("VlrPrecoLeilao"))
        preco = _positivo_ou_none(preco_bruto)
        teto = _positivo_ou_none(numero_br(t("VlrPrecoTeto")))
        desagio = numero_br(t("VlrDesagio")) if preco is not None else None
        reg = {
            "linha": i,
            "ano": t("AnoLeilao"),
            "data": t("DatLeilao")[:10],
            "leilao": t("NumLeilao"),
            "ccee": t("DscNumeroLeilaoCCEE"),
            "nome_leilao": nome_leilao(t("DscNumeroLeilaoCCEE"), tipo),
            "tipo": tipo,
            "antecedencia": antecedencia(tipo),
            "empreendimento": t("NomEmpreendimento"),
            "ceg": t("CodCEG") or None,
            "nucleo": nucleo,
            "tipo_geracao": t("SigTipoGeracao").upper(),
            "fonte": t("DscFonteEnergia"),
            "detalhe_fonte": t("DscDetalhamentoFonteEnergia"),
            "categoria": categoria(t("DscFonteEnergia"), t("SigTipoGeracao")),
            "mw": _positivo_ou_none(numero_br(t("MdaPotenciaInstaladaMW"))),
            "gf_mwmed": _positivo_ou_none(numero_br(t("MdaGarantiaFisicaSEL"))),
            "energia_mwmed": numero_br(t("VlrEnergiaVendida")),
            "preco_teto": teto,
            "preco": preco,
            "preco_zero_na_fonte": preco_bruto == 0,
            "desagio_pct": desagio,
            "investimento_rs": _positivo_ou_none(numero_br(t("VlrInvestimentoPrevisto"))),
            "duracao_anos": numero_br(t("MdaDuracaoContrato")),
            "uf": t("SigUFPrincipal").upper() or None,
            "dolar": _positivo_ou_none(numero_br(t("VlrCotacaoDolar"))),
            "preco_usd": _positivo_ou_none(numero_br(t("VlrPrecoDolar"))) if preco is not None else None,
            "vencedora": re.sub(r"\s+", " ", t("DscEmpresaVencedora")) or None,
            "data_geracao": t("DatGeracaoConjuntoDados")[:10] or None,
        }
        base_chave = f"{reg['leilao']}|{nucleo if nucleo is not None else ''}|{reg['empreendimento']}|{reg['vencedora'] or ''}"
        n = vistos.get(base_chave, 0)
        vistos[base_chave] = n + 1
        reg["chave"] = base_chave if n == 0 else f"{base_chave}|{n + 1}"
        out.append(reg)
    return out


def repetidos_no_leilao(regs):
    """Pares (leilão, núcleo) com mais de uma linha: [{leilao, nucleo, empreendimentos, vencedoras, linhas}]."""
    grupos = {}
    for r in regs:
        if r["nucleo"] is None:
            continue
        grupos.setdefault((r["leilao"], r["nucleo"]), []).append(r)
    out = []
    for (lei, nuc), rs in sorted(grupos.items()):
        if len(rs) > 1:
            out.append({"leilao": lei, "nucleo": nuc, "empreendimentos": sorted({r["empreendimento"] for r in rs}),
                        "vencedoras": sorted({r["vencedora"] or "" for r in rs}), "linhas": [r["linha"] for r in rs]})
    return out


def validar(regs):
    """(críticos, ressalvas). Crítico derruba a gold (a sentinela mantém a anterior)."""
    criticos, ressalvas = [], []
    if not regs:
        return ["arquivo de leilões de geração sem linhas"], []
    for r in regs:
        if r["energia_mwmed"] is None or r["energia_mwmed"] <= 0:
            criticos.append(f"linha {r['linha']}: energia vendida ausente ou não positiva")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", r["data"] or ""):
            criticos.append(f"linha {r['linha']}: data do leilão inválida ({r['data']!r})")
        if r["preco"] is not None and r["preco_teto"] is not None and r["preco"] > r["preco_teto"] + 0.005:
            criticos.append(f"linha {r['linha']}: preço acima do teto")
        if r["desagio_pct"] is not None and not (0 <= r["desagio_pct"] <= 100):
            criticos.append(f"linha {r['linha']}: deságio fora de 0 a 100%")
        if r["categoria"] is None:
            ressalvas.append(f"linha {r['linha']}: fonte sem categoria ({r['fonte']!r}, {r['tipo_geracao']!r})")
    return criticos[:20], ressalvas


def desagio_confere(r, tolerancia_pp=0.05):
    """O deságio publicado confere com 100 × (1 − preço ÷ teto), na precisão da fonte (2 casas)?"""
    if r["preco"] is None or r["preco_teto"] is None or r["desagio_pct"] is None:
        return None
    return abs(100 * (1 - r["preco"] / r["preco_teto"]) - r["desagio_pct"]) <= tolerancia_pp


# ------------------------------------------------------------------- situação atual

SITUACOES = [
    ("operacao", "Em operação", "Usina com fase Operação no SIGA."),
    ("construcao", "Em construção", "Usina com fase Construção no SIGA."),
    ("nao_iniciada", "Construção não iniciada", "Usina outorgada com fase Construção não iniciada no SIGA."),
    ("encerrada", "Outorga revogada ou extinta", "Fora do arquivo aberto do SIGA, com ato de revogação ou extinção da outorga publicado desde 2015."),
    ("sem_registro", "Sem situação identificada", "Fora do arquivo aberto do SIGA e sem ato de encerramento desde 2015 vinculado ao núcleo do CEG."),
    ("sem_ceg", "Sem código da usina", "Linha do leilão sem núcleo do CEG: não há como cruzar com o cadastro."),
]


def situacao(nucleo, siga, encerramentos):
    """Situação atual de um empreendimento contratado, pelo núcleo do CEG.

    siga: {núcleo: fase}; encerramentos: conjunto de núcleos com ato de revogação ou
    extinção publicado. A fase do SIGA prevalece (há 9 usinas em operação no SIGA com ato
    de encerramento: conversão de regime ou encerramento parcial)."""
    if nucleo is None:
        return "sem_ceg"
    fase = siga.get(nucleo)
    if fase == "Operação":
        return "operacao"
    if fase == "Construção":
        return "construcao"
    if fase == "Construção não iniciada":
        return "nao_iniciada"
    if nucleo in encerramentos:
        return "encerrada"
    return "sem_registro"


def entrada_vs_produto(data_leilao, ano_a, entrada):
    """Posição da entrada em operação registrada no SIGA diante do ano A do produto A-x.

    'antes_do_leilao': a usina já operava antes do leilão (ampliação ou usina existente);
    'ate_ano_a': entrou entre o leilão e 31/12 do ano A; 'depois_ano_a': entrou depois;
    'sem_data': sem data no SIGA. None quando não há ano A (reserva, fontes alternativas,
    estruturante)."""
    if ano_a is None:
        return None
    if not entrada:
        return "sem_data"
    if entrada < data_leilao:
        return "antes_do_leilao"
    return "ate_ano_a" if int(entrada[:4]) <= ano_a else "depois_ano_a"


# ------------------------------------------------------------------- controle atual

def cadeia_de_controle(cnpj, nos, limite=30):
    """CNPJs da cadeia de controladores únicos a partir de `cnpj` (inclusive), subindo por
    nos[cnpj][1] (controlador direto) até o topo. Para em ciclo ou no limite de passos."""
    out = []
    atual = cnpj
    while atual and atual not in out and len(out) < limite:
        out.append(atual)
        no = nos.get(atual)
        atual = no[1] if no and len(no) > 1 else None
    return out


def controle_atual(linhas_ativos):
    """{núcleo: {"estado", "proprietario_cnpj", "proprietario_nome", "pct", "grupo_cnpj"}}
    a partir de empresas_ativos.csv (uma linha por usina × proprietário do SIGA).

    estado 'controlada': há proprietário com mais de 50% (controle_majoritario = 1); o grupo
    é o grupo de controle desse proprietário (mesma regra da capacidade sob controle do
    módulo Empresas). 'sem_majoritario': participações publicadas sem quem passe de 50%.
    'sem_proprietario': usina sem proprietário com CNPJ no SIGA."""
    por = {}
    for r in linhas_ativos:
        try:
            n = int(r["nucleo_ceg"])
        except (KeyError, ValueError):
            continue
        por.setdefault(n, []).append(r)
    out = {}
    for n, rs in por.items():
        maj = [r for r in rs if (r.get("controle_majoritario") or "") == "1" and (r.get("proprietario_cnpj") or "")]
        if maj:
            m = max(maj, key=lambda r: float(r.get("pct") or 0))
            out[n] = {"estado": "controlada", "proprietario_cnpj": m["proprietario_cnpj"],
                      "proprietario_nome": m.get("proprietario_nome") or None,
                      "pct": float(m["pct"]) if m.get("pct") else None, "grupo_cnpj": m.get("grupo_cnpj") or m["proprietario_cnpj"]}
        elif any((r.get("proprietario_cnpj") or "") for r in rs):
            out[n] = {"estado": "sem_majoritario", "proprietario_cnpj": None, "proprietario_nome": None, "pct": None, "grupo_cnpj": None}
        else:
            out[n] = {"estado": "sem_proprietario", "proprietario_cnpj": None, "proprietario_nome": None, "pct": None, "grupo_cnpj": None}
    return out


# ------------------------------------------------------------------- IPCA

def fator_ipca(indice, mes_origem, mes_destino):
    """Fator de correção I(destino) ÷ I(origem) do número-índice do IPCA; None sem os dois meses."""
    a, b = indice.get(mes_origem), indice.get(mes_destino)
    if not a or not b:
        return None
    return b / a
