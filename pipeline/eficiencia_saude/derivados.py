"""Derivados da despesa em Saúde a partir da MSC de dezembro (função 10).

Abertura por natureza da despesa: grupos 3.1 (pessoal e encargos), 3.2 e 3.3 (outras despesas correntes) e 4.4, 4.5 e 4.6
(despesas de capital: investimentos, inversões financeiras e amortização da dívida). A abertura só é publicada quando as
três categorias, somadas, reproduzem a DCA (saldo líquido das contas de despesa liquidada, sem a modalidade 91, tolerância
de R$ 1,00). Categoria sem linha na MSC vale zero porque a soma completa fecha: não há ausência a distinguir.

A natureza do valor (D ou C) entra na soma com sinal; somar em módulo é o erro de Educação corrigido na rodada 6.
"""
from pipeline.eficiencia_saude import conferencia as CF

CATEGORIAS = [
    ("pessoal", "Pessoal e encargos sociais", ("31",)),
    ("outras_correntes", "Outras despesas correntes", ("32", "33")),
    ("capital", "Despesas de capital", ("44", "45", "46")),
]
GRUPO_PARA_CATEGORIA = {g: c for c, _, gs in CATEGORIAS for g in gs}
TOLERANCIA = 1.0


def liquido_por_categoria(linhas):
    """({categoria: saldo líquido liquidado sem modalidade 91}, [grupos desconhecidos], intra mod91) das linhas da MSC (função 10)."""
    soma = {c: 0.0 for c, _, _ in CATEGORIAS}
    desconhecidos = set()
    intra = 0.0
    for x in linhas:
        if str(x.get("funcao")) != "10" or str(x.get("conta_contabil", ""))[:7] not in CF.MSC_CONTAS_LIQUIDADO:
            continue
        nat = str(x.get("natureza_despesa") or "")
        v = CF.saldo_liquido(x)
        if nat[2:4] == "91":
            intra += v
            continue
        cat = GRUPO_PARA_CATEGORIA.get(nat[:2])
        if cat is None:
            desconhecidos.add(nat[:2] or "sem natureza")
            continue
        soma[cat] += v
    return {c: round(v, 2) for c, v in soma.items()}, sorted(desconhecidos), round(intra, 2)


def reconcilia(soma, dca):
    return abs(sum(soma.values()) - dca) <= TOLERANCIA
