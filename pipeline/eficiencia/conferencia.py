"""Conferência da despesa da DCA e elegibilidade para comparação (política 1.2; a 1.1 somava as linhas da MSC em módulo).

Três dimensões separadas em cada observação de despesa:

1. existência do valor oficial: a DCA tem a linha "12 - Educação" (status OBSERVADO);
2. resultado da conferência: comparação com o RREO do 6º bimestre e, quando a diferença é
   material, com a Matriz de Saldos Contábeis (MSC) de dezembro;
3. elegibilidade: se o valor pode entrar em comparações entre capitais, medianas e variações
   que pressupõem o mesmo perímetro.

Política determinística (docs/obee/METODOLOGIA.md, seção 2):

    d = DCA − RREO (exceto intraorçamentárias)

    RREO ausente ou sem a linha                   NAO_CONFERIDO      não elegível
    |d| ≤ R$ 1,00                                 CONFERE            elegível
    |d| ≤ 0,1% da DCA                             DIFERENCA_MENOR    elegível, com nota
    diferença material e MSC sem intra = DCA      RECONCILIADA_MSC   elegível, com nota
    diferença material e MSC total = DCA,
        com intraorçamentária (modalidade 91) > 0 PERIMETRO_INTRA_MSC não elegível; quebra de série
    diferença material sem reconciliação          PENDENTE           não elegível

A MSC só reconcilia quando foi capturada para aquele ente e exercício: a evidência é refeita a
cada execução a partir do arquivo preservado, e a conferência registra os sha256 da DCA, do RREO
e da MSC usados. Um exercício novo ou uma DCA retificada não herda a reconciliação anterior.
A coincidência entre a diferença e o bloco intraorçamentário do RREO não basta para declarar
mudança de perímetro: sem a MSC, o caso fica PENDENTE.
"""
import os

from pipeline.eficiencia import base

VERSAO_POLITICA = "1.2"
TOL_ARREDONDAMENTO = 1.0          # reais
TOL_RELATIVA = 0.001              # 0,1% do valor da DCA
MSC_CONTAS_LIQUIDADO = ("6221303", "6221304", "6221307")


def saldo_liquido(linha):
    """Saldo da linha da MSC com o sinal da natureza do valor (política 1.2).

    A MSC informa o valor em módulo e a natureza do valor ("D" débito, "C" crédito) de cada linha
    (Anexo I da Portaria STN 642/2019, "Natureza do Valor"). As contas 6.2.2.1.3.xx são de natureza
    credora: uma linha "C" aumenta o saldo e uma linha "D" o reduz (o saldo da conta é créditos menos
    débitos). Somar todas as linhas em módulo, como fazia a política 1.1, contava duas vezes a
    liquidação transferida de uma conta para outra no encerramento. Natureza ausente ou diferente de
    "C" e "D" não é interpretada: levanta ValueError."""
    nat = linha.get("natureza_conta")
    if nat not in ("C", "D"):
        raise ValueError(f"natureza do valor inválida na MSC: {nat!r}")
    v = float(linha["valor"])
    return v if nat == "C" else -v

ELEGIVEIS = {"CONFERE", "DIFERENCA_MENOR", "RECONCILIADA_MSC"}

ROTULO = {
    "CONFERE": "Confere com o RREO",
    "DIFERENCA_MENOR": "Diferença com o RREO abaixo de 0,1%",
    "RECONCILIADA_MSC": "Diferença com o RREO, DCA confirmada pela MSC",
    "PERIMETRO_INTRA_MSC": "Perímetro distinto: inclui despesas intraorçamentárias",
    "PENDENTE": "Conferência pendente: diferença material sem explicação",
    "NAO_CONFERIDO": "Não conferido: RREO indisponível",
}


def brl(v):
    txt = f"{abs(v):,.2f}".replace(",", "§").replace(".", ",").replace("§", ".")
    return ("−R$ " if v < 0 else "R$ ") + txt


def pct_br(v, casas=1):
    return f"{v:+.{casas}f}".replace(".", ",").replace("-", "−") + "%"


# ---------------------------------------------------------------- leitura das evidências

def _arquivo(*partes):
    caminho = os.path.join(base.SEED, *partes)
    return caminho if os.path.exists(caminho) else None


def _sha(caminho):
    return base.sha256_arquivo(caminho) if caminho else None


def rreo(cod, ano):
    """{'exceto_intra', 'intra', 'sha256'} do RREO do 6º bimestre, ou None sem captura."""
    caminho = _arquivo("siconfi", "rreo_anexo_02_b6", f"{cod}_{ano}.json.gz")
    if not caminho:
        return None
    out = {"exceto_intra": None, "intra": None, "sha256": _sha(caminho)}
    for x in base.le_json_gz(caminho):
        if x.get("conta") == "Educação" and str(x.get("coluna", "")).startswith("DESPESAS LIQUIDADAS ATÉ O BIMESTRE"):
            out["exceto_intra" if "Exceto" in x.get("rotulo", "") else "intra"] = float(x["valor"])
    return out


def msc(cod, ano):
    """{'liquidado_total', 'intra_mod91', 'sha256'} da MSC de dezembro, função 12, ou None."""
    caminho = _arquivo("siconfi", "msc_funcao12", f"{cod}_{ano}_12.json.gz")
    if not caminho:
        return None
    tot = intra = 0.0
    for x in base.le_json_gz(caminho):
        if str(x.get("funcao")) != "12" or str(x.get("conta_contabil", ""))[:7] not in MSC_CONTAS_LIQUIDADO:
            continue
        v = saldo_liquido(x)
        tot += v
        if str(x.get("natureza_despesa") or "")[2:4] == "91":
            intra += v
    return {"liquidado_total": round(tot, 2), "intra_mod91": round(intra, 2), "sha256": _sha(caminho)}


def dca_sha(cod, ano):
    return _sha(_arquivo("siconfi", "dca_anexo_i_e", f"{cod}_{ano}.json.gz"))


# ---------------------------------------------------------------- classificação (pura)

def classifica(dca, r, m):
    """Classifica a conferência. dca: valor liquidado (> 0) ou None; r: dict do RREO ou None;
    m: dict da MSC ou None. Nunca divide por zero nem trata ausência como conferência."""
    out = {"versao_politica": VERSAO_POLITICA, "rreo": None, "msc": None, "diferenca": None,
           "diferenca_pct_dca": None, "evidencias": [], "quebra_serie": False}
    if dca is None:
        out.update(situacao="NAO_CONFERIDO", elegivel_comparacao=False,
                   motivo_inelegibilidade="Sem valor na DCA.", explicacao="Sem valor na DCA para conferir.")
        return out
    if r is None or r.get("exceto_intra") is None:
        out.update(situacao="NAO_CONFERIDO", elegivel_comparacao=False,
                   motivo_inelegibilidade="Conferência com o RREO não realizada: relatório ou linha da Educação indisponível.",
                   explicacao="O RREO do 6º bimestre não está disponível para este exercício; o valor da DCA não foi conferido.")
        return out
    rr = r["exceto_intra"]
    d = round(dca - rr, 2)
    pct = round(100 * d / dca, 4) if dca else None
    out.update(rreo={"exceto_intra": round(rr, 2), "intra": None if r.get("intra") is None else round(r["intra"], 2)},
               diferenca=d, diferenca_pct_dca=pct)
    if abs(d) <= TOL_ARREDONDAMENTO:
        out.update(situacao="CONFERE", elegivel_comparacao=True, motivo_inelegibilidade=None,
                   explicacao="Igual ao RREO do 6º bimestre (diferença de até R$ 1,00).")
        return out
    if dca > 0 and abs(d) <= TOL_RELATIVA * dca:
        out.update(situacao="DIFERENCA_MENOR", elegivel_comparacao=True, motivo_inelegibilidade=None,
                   explicacao=(f"O RREO do 6º bimestre informa {brl(rr)}; a DCA informa {brl(dca)}. Diferença de {brl(d)} "
                               f"({pct_br(pct, 3)} da DCA), abaixo do limiar de 0,1%."))
        return out
    texto_dif = f"diferença de {brl(d)}" + (f", {pct_br(pct)} da DCA" if pct is not None else "")
    if m is not None:
        out["msc"] = {"liquidado_total": m["liquidado_total"], "intra_mod91": m["intra_mod91"],
                      "sem_intra": round(m["liquidado_total"] - m["intra_mod91"], 2)}
        sem_intra = out["msc"]["sem_intra"]
        if abs(dca - sem_intra) <= TOL_ARREDONDAMENTO:
            out["evidencias"] = [
                f"MSC de dezembro, função 12, contas de despesa liquidada: {brl(m['liquidado_total'])}.",
                f"Parcela intraorçamentária na MSC (modalidade 91): {brl(m['intra_mod91'])}.",
                f"MSC sem intraorçamentárias: {brl(sem_intra)}, igual à DCA.",
            ]
            out.update(situacao="RECONCILIADA_MSC", elegivel_comparacao=True, motivo_inelegibilidade=None,
                       explicacao=(f"O RREO do 6º bimestre informa {brl(rr)} ({texto_dif}). A Matriz de Saldos Contábeis de "
                                   f"dezembro confirma o valor da DCA ({brl(sem_intra)} liquidados na função Educação, sem "
                                   "intraorçamentárias). O RREO diverge da DCA e da MSC e não foi retificado até a data da captura."))
            return out
        if abs(dca - m["liquidado_total"]) <= TOL_ARREDONDAMENTO and m["intra_mod91"] > TOL_ARREDONDAMENTO:
            out["evidencias"] = [
                f"MSC de dezembro, função 12, despesa liquidada total: {brl(m['liquidado_total'])}, igual à DCA.",
                f"Dessa despesa, {brl(m['intra_mod91'])} têm modalidade 91 (aplicação direta em operações intraorçamentárias).",
            ]
            out.update(situacao="PERIMETRO_INTRA_MSC", elegivel_comparacao=False, quebra_serie=True,
                       motivo_inelegibilidade=("Perímetro distinto: a DCA deste exercício inclui na função Educação despesas "
                                               "intraorçamentárias, que as demais declarações apresentam em linha separada."),
                       explicacao=(f"O RREO do 6º bimestre informa {brl(rr)} sem intraorçamentárias ({texto_dif}). A MSC de "
                                   f"dezembro mostra que a DCA reúne {brl(m['intra_mod91'])} de despesas intraorçamentárias "
                                   "(modalidade 91) na função Educação. O valor oficial fica disponível para consulta, fora de "
                                   "comparações entre capitais e de variações com exercícios de outro perímetro."))
            return out
    out.update(situacao="PENDENTE", elegivel_comparacao=False,
               motivo_inelegibilidade="Conferência pendente: diferença material entre DCA e RREO sem explicação documentada.",
               explicacao=(f"O RREO do 6º bimestre informa {brl(rr)}; a DCA informa {brl(dca)} ({texto_dif}). A diferença "
                           "não foi explicada por conceito, período, perímetro ou terceira fonte."
                           + (" A MSC capturada também não reconcilia." if m is not None else "")))
    return out


def conferencia(cod, ano, dca):
    """Conferência de um ente e exercício a partir das evidências preservadas no seed."""
    r, m = rreo(cod, ano), msc(cod, ano)
    c = classifica(dca, r, m)
    c["fontes_sha256"] = {"dca": dca_sha(cod, ano), "rreo": r.get("sha256") if r else None,
                          "msc": m.get("sha256") if m else None}
    c["rotulo"] = ROTULO[c["situacao"]]
    return c
