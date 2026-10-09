"""Conferência da despesa da DCA na função 10 (Saúde) e elegibilidade para comparação.

Mesma política determinística do OBEE em Educação (versão 1.2, `pipeline/eficiencia/conferencia.py`), aplicada à função 10:

    d = DCA − RREO (exceto intraorçamentárias, função Saúde, liquidado até o 6º bimestre)

    RREO ausente ou sem a linha                   NAO_CONFERIDO      não elegível
    |d| ≤ R$ 1,00                                 CONFERE            elegível
    |d| ≤ 0,1% da DCA                             DIFERENCA_MENOR    elegível, com nota
    diferença material e MSC sem intra = DCA      RECONCILIADA_MSC   elegível, com nota
    diferença material e MSC total = DCA,
        com intraorçamentária (modalidade 91) > 0 PERIMETRO_INTRA_MSC não elegível; quebra de série
    diferença material sem reconciliação          PENDENTE           não elegível

A MSC só reconcilia quando foi capturada para o ente e o exercício; a evidência é refeita a cada execução a partir do
arquivo preservado, com o sha256 das três fontes. A soma da MSC respeita a natureza do valor (D e C): nunca em módulo
(erro corrigido em Educação na rodada 6, não repetido aqui). As tolerâncias não se ampliam para fazer um caso passar.
"""
import os

from pipeline.eficiencia import conferencia as CF
from pipeline.eficiencia_saude import base

VERSAO_POLITICA = CF.VERSAO_POLITICA
TOL_ARREDONDAMENTO = CF.TOL_ARREDONDAMENTO
TOL_RELATIVA = CF.TOL_RELATIVA
MSC_CONTAS_LIQUIDADO = CF.MSC_CONTAS_LIQUIDADO
ELEGIVEIS = CF.ELEGIVEIS
brl = CF.brl
pct_br = CF.pct_br
saldo_liquido = CF.saldo_liquido

ROTULO = {
    "CONFERE": "Confere com o RREO",
    "DIFERENCA_MENOR": "Diferença com o RREO abaixo de 0,1%",
    "RECONCILIADA_MSC": "Diferença com o RREO, DCA confirmada pela MSC",
    "PERIMETRO_INTRA_MSC": "Perímetro distinto: inclui despesas intraorçamentárias",
    "PENDENTE": "Conferência pendente: diferença material sem explicação",
    "NAO_CONFERIDO": "Não conferido: RREO indisponível",
}


def _arquivo(*partes):
    caminho = os.path.join(base.SEED, *partes)
    return caminho if os.path.exists(caminho) else None


def _sha(caminho):
    return base.sha256_arquivo(caminho) if caminho else None


def rreo(cod, ano):
    """{'exceto_intra', 'intra', 'sha256'} do RREO do 6º bimestre (linha Saúde), ou None sem captura."""
    caminho = _arquivo("siconfi", "rreo_anexo_02_b6", f"{cod}_{ano}.json.gz")
    if not caminho:
        return None
    out = {"exceto_intra": None, "intra": None, "sha256": _sha(caminho)}
    for x in base.le_json_gz(caminho):
        if x.get("conta") == "Saúde" and str(x.get("coluna", "")).startswith("DESPESAS LIQUIDADAS ATÉ O BIMESTRE (d)"):
            out["exceto_intra" if "Exceto" in x.get("rotulo", "") else "intra"] = float(x["valor"])
    return out


def msc(cod, ano):
    """{'liquidado_total', 'intra_mod91', 'sha256'} da MSC de dezembro, função 10, ou None."""
    caminho = _arquivo("siconfi", "msc_funcao10", f"{cod}_{ano}_12.json.gz")
    if not caminho:
        return None
    tot = intra = 0.0
    for x in base.le_json_gz(caminho):
        if str(x.get("funcao")) != "10" or str(x.get("conta_contabil", ""))[:7] not in MSC_CONTAS_LIQUIDADO:
            continue
        v = saldo_liquido(x)
        tot += v
        if str(x.get("natureza_despesa") or "")[2:4] == "91":
            intra += v
    return {"liquidado_total": round(tot, 2), "intra_mod91": round(intra, 2), "sha256": _sha(caminho)}


def dca_sha(cod, ano):
    return _sha(_arquivo("siconfi", "dca_anexo_i_e", f"{cod}_{ano}.json.gz"))


def classifica(dca, r, m):
    """Classifica a conferência. A regra é a de Educação; só os textos citam a função Saúde. Nunca divide por zero
    nem trata ausência como conferência."""
    c = CF.classifica(dca, r, m)
    for k in ("motivo_inelegibilidade", "explicacao"):
        if isinstance(c.get(k), str):
            c[k] = c[k].replace("função Educação", "função Saúde").replace("da Educação", "da Saúde").replace("função 12", "função 10")
    c["evidencias"] = [e.replace("função 12", "função 10") for e in c.get("evidencias", [])]
    return c


def conferencia(cod, ano, dca):
    r, mm = rreo(cod, ano), msc(cod, ano)
    c = classifica(dca, r, mm)
    c["fontes_sha256"] = {"dca": dca_sha(cod, ano), "rreo": r.get("sha256") if r else None, "msc": mm.get("sha256") if mm else None}
    c["rotulo"] = ROTULO[c["situacao"]]
    return c
