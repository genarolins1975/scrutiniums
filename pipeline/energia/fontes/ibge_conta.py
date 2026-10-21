"""IPCA do IBGE (SIDRA, tabela 1737) para o módulo Conta de luz.

A comparação entre reajuste de tarifa e inflação usa o número-índice do IPCA
(variável 2266, base dez/1993 = 100) e mede a inflação de um período pela razão
entre índices; a variação acumulada em 12 meses publicada pelo próprio IBGE
(variável 2265) entra só como conferência por caminho independente.
"""
import json

URL_SIDRA = "https://apisidra.ibge.gov.br/values/t/1737/n1/all/v/2266,2265/p/all?formato=json"
URL_TABELA = "https://sidra.ibge.gov.br/tabela/1737"
LICENCA_IBGE = ("Dados públicos do IBGE; reprodução permitida com citação da fonte "
                "(IBGE, Sistema IBGE de Recuperação Automática, SIDRA)")
VARIAVEIS = {"2266": "indice", "2265": "var12m"}


def linhas_ipca(corpo):
    """JSON do SIDRA → [(variavel, 'AAAA-MM', valor)]. A primeira linha do SIDRA é o
    cabeçalho descritivo. Valor '...' ou '-' (não disponível) vira ausência."""
    dados = json.loads(corpo.decode("utf-8") if isinstance(corpo, (bytes, bytearray)) else corpo)
    if not dados or dados[0].get("V") != "Valor":
        raise RuntimeError("SIDRA 1737: resposta sem o cabeçalho esperado")
    out = []
    for d in dados[1:]:
        var = VARIAVEIS.get(d.get("D2C"))
        per = d.get("D3C") or ""
        if not var or len(per) != 6:
            continue
        try:
            v = float(d.get("V"))
        except (TypeError, ValueError):
            v = None
        out.append((var, f"{per[:4]}-{per[4:]}", v))
    return out
