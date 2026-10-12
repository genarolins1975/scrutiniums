"""Composicao economica da despesa liquidada; sem intra/refinanciamento."""
import math
COLUNA = "DESPESAS LIQUIDADAS ATÉ O BIMESTRE (h)"
GRUPOS = {
    "PessoalEEncargosSociais": "correntes",
    "JurosEEncargosDaDivida": "correntes",
    "OutrasDespesasCorrentes": "correntes",
    "Investimentos": "capital",
    "InversoesFinanceiras": "capital",
    "AmortizacaoDaDivida": "capital",
}


def mapear(itens, total):
    valores = {}
    for conta in [*GRUPOS, 'DespesasCorrentes', 'DespesasDeCapital']:
        linhas = [r for r in itens if r.get('cod_conta') == conta and r.get('coluna') == COLUNA]
        if len(linhas) != 1:
            raise ValueError('Despesa: conta ausente ou duplicada: ' + conta)
        v = linhas[0].get('valor')
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or v < 0:
            raise ValueError('Despesa: valor invalido: ' + conta)
        valores[conta] = v
    if not isinstance(total, (int, float)) or isinstance(total, bool) or not math.isfinite(total) or total <= 0:
        raise ValueError('Despesa: total nao positivo ou invalido')
    for grupo, conta in [('correntes', 'DespesasCorrentes'), ('capital', 'DespesasDeCapital')]:
        soma = sum(valores[k] for k, g in GRUPOS.items() if g == grupo)
        if abs(soma - valores[conta]) > .02:
            raise ValueError('Despesa: grupos nao reconciliam com ' + conta)
    if abs(valores['DespesasCorrentes'] + valores['DespesasDeCapital'] - total) > .02:
        raise ValueError('Despesa: categorias nao reconciliam com total')
    return dict(coluna=COLUNA, valores=valores,
                partes=[dict(conta=k, grupo=g, valor=valores[k], percentual=100*valores[k]/total) for k,g in GRUPOS.items()])
