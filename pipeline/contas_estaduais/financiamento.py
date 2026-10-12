"""Receitas correntes e margem contábil do RREO 01 preservado.

Não inclui intra-orçamentárias, refinanciamento destacado nem ajustes de RCL.
"""
import math

RECEBIDA = "Até o Bimestre (c)"
LIQUIDADA = "DESPESAS LIQUIDADAS ATÉ O BIMESTRE (h)"
CAMPOS = {
    "receitas_correntes": ("ReceitasCorrentes", RECEBIDA),
    "tributaria": ("ReceitaTributaria", RECEBIDA),
    "contribuicoes": ("ReceitaDeContribuicoes", RECEBIDA),
    "transferencias_correntes": ("TransferenciasCorrentes", RECEBIDA),
    "receitas_capital": ("ReceitasDeCapital", RECEBIDA),
    "despesas_correntes": ("DespesasCorrentes", LIQUIDADA),
}


def mapear(itens, receita_total):
    valores = {}
    for campo, (conta, coluna) in CAMPOS.items():
        linhas = [r for r in itens if r.get("cod_conta") == conta and r.get("coluna") == coluna]
        if len(linhas) != 1:
            raise ValueError(f"Financiamento: campo ausente ou duplicado: {campo}")
        v = linhas[0].get("valor")
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
            raise ValueError(f"Financiamento: valor inválido: {campo}")
        valores[campo] = v
    v = valores
    if v["receitas_correntes"] <= 0:
        raise ValueError("Financiamento: receitas correntes não positivas")
    if any(x < 0 for x in v.values()):
        # Preservar a fonte; valores negativos precisam de apresentação própria,
        # não podem ser transformados silenciosamente em uma composição positiva.
        raise ValueError("Financiamento: valor negativo exige exame do perímetro")
    if abs(v["receitas_correntes"] + v["receitas_capital"] - receita_total) > .02:
        raise ValueError("Financiamento: receitas correntes e de capital não reconciliam")
    residual = v["receitas_correntes"] - v["tributaria"] - v["contribuicoes"] - v["transferencias_correntes"]
    if residual < 0:
        raise ValueError("Financiamento: parcelas excedem as receitas correntes")
    v["demais_correntes_agrupadas"] = residual
    margem = v["receitas_correntes"] - v["despesas_correntes"]
    return dict(valores=v, margem_nominal=margem, indicadores={
        "CE-10": 100 * margem / v["receitas_correntes"],
        "CE-14": 100 * v["transferencias_correntes"] / v["receitas_correntes"],
    })
