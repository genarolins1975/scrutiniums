"""Referências estatísticas do grupo de capitais: uma única regra para cartões, gráficos, tabela e downloads.

Para cada indicador, componente, etapa, ano e grupo (todas as capitais ou as de uma região):

* o grupo é o conjunto de capitais da região, ou as 26 capitais;
* entram nas estatísticas só as observações com valor e elegíveis para comparação (a mesma regra
  que seleciona os pontos do gráfico e as linhas da tabela);
* média simples (peso igual por capital), mediana, mínimo, máximo, primeiro e terceiro quartis;
* capitais dos extremos, com empates;
* razão agregada (soma dos numeradores ÷ soma dos denominadores dos MESMOS pares) para as razões que
  publicam numerador e denominador. Não é a média das capitais: pesa cada capital pelo seu denominador.

Cálculo com a precisão original (ponto flutuante de 64 bits); o arredondamento é da exibição.

Convenções:

* mediana: valor central; com número par de valores, a média dos dois centrais;
* quartis: interpolação linear entre os valores ordenados, posição (n − 1) × p (tipo 7 de Hyndman e Fan,
  o mesmo do QUARTIL.INC das planilhas e do padrão do R e do NumPy);
* empates: a mínima e a máxima listam todas as capitais com o mesmo valor;
* grupo pequeno: com menos de LIMIAR_QUARTIS valores, os quartis são calculados e gravados, mas marcados
  `quartis_exibicao: false`. É uma política de apresentação, não uma garantia estatística: a interface
  mostra os pontos e o tamanho do grupo, não uma faixa central com aparente precisão.
"""
from pipeline.eficiencia import entes

VERSAO = "1.0"
LIMIAR_QUARTIS = 8

# indicadores sem estatística de grupo (decomposições e contexto de composição)
IGNORADOS = {"edu.despesa.subfuncao", "edu.despesa.ponte_matricula"}


def quantil(ordenados, p):
    """Quantil de tipo 7 de uma lista já ordenada (posição (n − 1) × p, interpolação linear)."""
    n = len(ordenados)
    if n == 0:
        return None
    pos = (n - 1) * p
    i = int(pos)
    f = pos - i
    if i + 1 >= n:
        return float(ordenados[-1])
    return float(ordenados[i]) + f * (float(ordenados[i + 1]) - float(ordenados[i]))


def mediana(valores):
    s = sorted(valores)
    n = len(s)
    if not n:
        return None
    m = n // 2
    return float(s[m]) if n % 2 else (float(s[m - 1]) + float(s[m])) / 2


def estatisticas(pares):
    """pares: lista de (cod, valor, numerador, denominador). numerador e denominador podem ser None.
    Devolve o dicionário de estatísticas (sem os campos de identificação do grupo)."""
    n = len(pares)
    if n == 0:
        return {"n": 0, "media": None, "mediana": None, "minimo": None, "maximo": None, "q1": None, "q3": None,
                "capitais_minimo": [], "capitais_maximo": [], "quartis_exibicao": False,
                "soma_numerador": None, "soma_denominador": None, "razao_agregada": None, "pares": []}
    vals = [p[1] for p in pares]
    ordenados = sorted(vals)
    mn, mx = ordenados[0], ordenados[-1]
    com_calculo = all(p[2] is not None and p[3] is not None for p in pares)
    sn = sum(p[2] for p in pares) if com_calculo else None
    sd = sum(p[3] for p in pares) if com_calculo else None
    return {
        "n": n,
        "media": sum(vals) / n,
        "mediana": mediana(vals),
        "minimo": mn,
        "maximo": mx,
        "q1": quantil(ordenados, 0.25),
        "q3": quantil(ordenados, 0.75),
        "capitais_minimo": sorted(p[0] for p in pares if p[1] == mn),
        "capitais_maximo": sorted(p[0] for p in pares if p[1] == mx),
        "quartis_exibicao": n >= LIMIAR_QUARTIS,
        "soma_numerador": sn,
        "soma_denominador": sd,
        "razao_agregada": (sn / sd) if com_calculo and sd else None,
        "pares": sorted(p[0] for p in pares),
    }


def grupos():
    """Grupos de comparação: todas as capitais e cada região, com os códigos IBGE de seus membros."""
    caps = entes.capitais()
    out = {"todas": [c["cod_ibge"] for c in caps]}
    for r in entes.REGIOES:
        out[r] = [c["cod_ibge"] for c in caps if c["regiao"] == r]
    return out


def calcula(obs):
    """Estatísticas por (indicador, componente, etapa, ano, grupo) a partir das observações."""
    por_chave = {}
    for o in obs:
        if o["indicador"] in IGNORADOS:
            continue
        por_chave.setdefault((o["indicador"], o["componente"], o["etapa"], o["ano"]), {})[o["ente"]] = o
    g = grupos()
    out = []
    for (ind, comp, etapa, ano), por_ente in sorted(por_chave.items(), key=lambda kv: (kv[0][0], kv[0][1] or "", kv[0][2] or "", kv[0][3])):
        for nome_grupo, membros in g.items():
            com_valor, pares = 0, []
            for cod in membros:
                o = por_ente.get(cod)
                if o is None or o["status"] != "OBSERVADO" or o["valor"] is None:
                    continue
                com_valor += 1
                if not o.get("elegivel_comparacao"):
                    continue
                c = o.get("calculo") or {}
                pares.append((cod, float(o["valor"]), c.get("numerador"), c.get("denominador")))
            est = estatisticas(pares)
            out.append({"indicador": ind, "componente": comp, "etapa": etapa, "ano": ano, "grupo": nome_grupo,
                        "capitais_no_grupo": len(membros), "capitais_com_valor": com_valor, **est})
    return out


POLITICA = {
    "versao": VERSAO,
    "media": "Média aritmética simples das capitais na comparação: cada capital tem o mesmo peso.",
    "razao_agregada": "Soma dos numeradores dividida pela soma dos denominadores dos mesmos pares válidos e da mesma definição; pesa cada capital pelo seu denominador. Só existe para razões com numerador e denominador publicados.",
    "mediana": "Valor central; com número par de valores, a média dos dois centrais.",
    "quartis": "Interpolação linear entre os valores ordenados, posição (n − 1) × p (tipo 7, como o QUARTIL.INC das planilhas).",
    "limiar_quartis": LIMIAR_QUARTIS,
    "limiar_quartis_nota": "Política de apresentação: com menos de 8 valores no grupo, a interface mostra os pontos e o tamanho do grupo, não a faixa entre quartis. Não é garantia estatística.",
    "empates": "A mínima e a máxima listam todas as capitais com o mesmo valor.",
    "elegibilidade": "Entram só valores observados e elegíveis para comparação, a mesma regra do gráfico e da tabela; a capital selecionada integra o grupo quando é elegível.",
    "precisao": "Cálculo com a precisão original; arredondamento só na exibição.",
    "nacional": "Referência nacional oficial tem cálculo e universo definidos pela fonte e não é a média das capitais.",
}
